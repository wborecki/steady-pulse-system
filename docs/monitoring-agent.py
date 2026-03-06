#!/usr/bin/env python3
"""
Monitoring Agent — lightweight HTTP server for systemctl, Docker & server metrics.

Usage:
    python3 monitoring-agent.py [--port 9100] [--token YOUR_SECRET_TOKEN] [--allowed-ips 1.2.3.4,5.6.7.8]

    Or via environment variables:
        AGENT_PORT=9100
        AGENT_TOKEN=your_secret_token
        AGENT_ALLOWED_IPS=1.2.3.4,5.6.7.8

Security:
    --token          Required. Authenticates callers via Bearer token.
    --allowed-ips    Optional. Comma-separated IPs that can connect.
                     If not set, any IP with a valid token can connect.
                     Supabase Edge Function IPs vary; use with caution.

    Recommended: combine with UFW firewall for defense in depth:
        sudo ufw allow from <SUPABASE_IP> to any port 9100
        sudo ufw deny 9100
        sudo ufw enable

Endpoints:
    POST /systemctl     — returns status of specified systemd services
    GET  /systemctl/list — auto-discovery of running systemd services
    GET  /containers    — returns Docker container stats (auto-discovery)
    GET  /metrics       — returns server metrics (CPU, RAM, swap, disk, load, network, uptime)
    GET  /processes     — returns top processes by CPU/memory
    POST /postgresql    — PostgreSQL metrics (connection_string or host/port/user/password/database)
    POST /mssql         — MSSQL/Azure SQL metrics (host/port/user/password/database)
    GET  /health        — agent health check
    GET  /version       — current agent version
    POST /update        — self-update from GitHub

Install as systemd service:
    curl -fsSL https://raw.githubusercontent.com/Solutions-in-BI/steady-pulse-system/main/docs/install-agent.sh | sudo bash -s -- --token SEU_TOKEN
"""

import argparse
import http.server
import ipaddress
import json
import os
import socket
import subprocess
import time
import urllib.request

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

AGENT_VERSION = "2.5.0"
GITHUB_RAW_URL = "https://raw.githubusercontent.com/Solutions-in-BI/steady-pulse-system/main/docs/monitoring-agent.py"


def get_config():
    parser = argparse.ArgumentParser(description="Monitoring Agent")
    parser.add_argument("--port", type=int, default=int(os.environ.get("AGENT_PORT", "9100")))
    parser.add_argument("--token", type=str, default=os.environ.get("AGENT_TOKEN", ""))
    parser.add_argument("--allowed-ips", type=str, default=os.environ.get("AGENT_ALLOWED_IPS", ""),
                        help="Comma-separated list of IPs or CIDR ranges allowed to connect. Empty = allow all.")
    return parser.parse_args()


CONFIG = get_config()


def parse_allowed_networks(raw: str) -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    """Parse comma-separated IPs/CIDRs into network objects."""
    networks = []
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry:
            continue
        try:
            networks.append(ipaddress.ip_network(entry, strict=False))
        except ValueError:
            print(f"⚠️  Invalid IP/CIDR in allowed-ips: {entry!r} — skipping")
    return networks


ALLOWED_NETWORKS = parse_allowed_networks(CONFIG.allowed_ips)

# ---------------------------------------------------------------------------
# Server metrics helpers
# ---------------------------------------------------------------------------


def get_cpu_percent() -> float:
    """Get CPU usage percentage from /proc/stat."""
    try:
        with open("/proc/stat") as f:
            line1 = f.readline().split()
        time.sleep(0.1)
        with open("/proc/stat") as f:
            line2 = f.readline().split()

        vals1 = [int(x) for x in line1[1:]]
        vals2 = [int(x) for x in line2[1:]]
        idle1 = vals1[3] + (vals1[4] if len(vals1) > 4 else 0)
        idle2 = vals2[3] + (vals2[4] if len(vals2) > 4 else 0)
        total1 = sum(vals1)
        total2 = sum(vals2)
        total_diff = total2 - total1
        idle_diff = idle2 - idle1
        if total_diff == 0:
            return 0.0
        return round((1 - idle_diff / total_diff) * 100, 2)
    except Exception:
        return 0.0


def get_memory_info() -> dict:
    """Get memory info from /proc/meminfo."""
    try:
        info = {}
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split(":")
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = parts[1].strip().split()[0]
                    info[key] = int(val)  # in kB

        total = info.get("MemTotal", 0)
        available = info.get("MemAvailable", 0)
        used = total - available
        return {
            "total_mb": round(total / 1024, 2),
            "used_mb": round(used / 1024, 2),
            "available_mb": round(available / 1024, 2),
            "percent": round((used / total) * 100, 2) if total > 0 else 0,
        }
    except Exception:
        return {"total_mb": 0, "used_mb": 0, "available_mb": 0, "percent": 0}


def get_swap_info() -> dict:
    """Get swap info from /proc/meminfo."""
    try:
        info = {}
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split(":")
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = parts[1].strip().split()[0]
                    info[key] = int(val)  # in kB

        total = info.get("SwapTotal", 0)
        free = info.get("SwapFree", 0)
        used = total - free
        return {
            "total_mb": round(total / 1024, 2),
            "used_mb": round(used / 1024, 2),
            "free_mb": round(free / 1024, 2),
            "percent": round((used / total) * 100, 2) if total > 0 else 0,
        }
    except Exception:
        return {"total_mb": 0, "used_mb": 0, "free_mb": 0, "percent": 0}


def get_disk_info() -> list:
    """Get disk usage via df command."""
    try:
        result = subprocess.run(
            ["df", "-B1", "--output=target,size,used,avail,pcent", "-x", "tmpfs", "-x", "devtmpfs", "-x", "overlay"],
            capture_output=True, text=True, timeout=5,
        )
        disks = []
        for line in result.stdout.strip().split("\n")[1:]:
            parts = line.split()
            if len(parts) >= 5:
                disks.append({
                    "mount": parts[0],
                    "total_gb": round(int(parts[1]) / (1024**3), 2),
                    "used_gb": round(int(parts[2]) / (1024**3), 2),
                    "available_gb": round(int(parts[3]) / (1024**3), 2),
                    "percent": float(parts[4].replace("%", "")),
                })
        return disks
    except Exception:
        return []


def get_load_average() -> dict:
    """Get load average from /proc/loadavg."""
    try:
        with open("/proc/loadavg") as f:
            parts = f.readline().split()
        return {
            "load_1": float(parts[0]),
            "load_5": float(parts[1]),
            "load_15": float(parts[2]),
        }
    except Exception:
        return {"load_1": 0, "load_5": 0, "load_15": 0}


def get_network_info() -> list:
    """Get network interface stats from /proc/net/dev."""
    try:
        interfaces = []
        with open("/proc/net/dev") as f:
            lines = f.readlines()[2:]  # skip header lines
        for line in lines:
            parts = line.split(":")
            if len(parts) != 2:
                continue
            iface = parts[0].strip()
            if iface == "lo":
                continue  # skip loopback
            vals = parts[1].split()
            if len(vals) < 10:
                continue
            rx_bytes = int(vals[0])
            tx_bytes = int(vals[8])
            interfaces.append({
                "interface": iface,
                "rx_bytes": rx_bytes,
                "tx_bytes": tx_bytes,
                "rx_mb": round(rx_bytes / (1024 * 1024), 2),
                "tx_mb": round(tx_bytes / (1024 * 1024), 2),
            })
        return interfaces
    except Exception:
        return []


def get_uptime_seconds() -> float:
    """Get system uptime from /proc/uptime."""
    try:
        with open("/proc/uptime") as f:
            return round(float(f.readline().split()[0]), 2)
    except Exception:
        return 0.0


def get_server_metrics() -> dict:
    """Collect all server metrics."""
    cpu_cores = os.cpu_count() or 1
    return {
        "cpu_percent": get_cpu_percent(),
        "cpu_cores": cpu_cores,
        "memory": get_memory_info(),
        "swap": get_swap_info(),
        "disks": get_disk_info(),
        "load_average": get_load_average(),
        "network": get_network_info(),
        "uptime_seconds": get_uptime_seconds(),
        "hostname": socket.gethostname(),
        "timestamp": time.time(),
    }


# ---------------------------------------------------------------------------
# Process helpers
# ---------------------------------------------------------------------------


def get_top_processes(limit: int = 10) -> list:
    """Get top processes by CPU and memory usage."""
    try:
        result = subprocess.run(
            ["ps", "aux", "--sort=-%cpu"],
            capture_output=True, text=True, timeout=5,
        )
        processes = []
        lines = result.stdout.strip().split("\n")[1:]  # skip header
        for line in lines[:limit]:
            parts = line.split(None, 10)
            if len(parts) < 11:
                continue
            try:
                processes.append({
                    "user": parts[0],
                    "pid": int(parts[1]),
                    "cpu_percent": float(parts[2]),
                    "memory_percent": float(parts[3]),
                    "vsz_mb": round(int(parts[4]) / 1024, 1),
                    "rss_mb": round(int(parts[5]) / 1024, 1),
                    "state": parts[7],
                    "command": parts[10][:120],
                })
            except (ValueError, IndexError):
                continue
        return processes
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Systemctl helpers
# ---------------------------------------------------------------------------


def get_systemctl_unit(service_name: str) -> dict:
    """Get status of a single systemd unit via `systemctl show`."""
    try:
        props = "ActiveState,SubState,MainPID,MemoryCurrent,ActiveEnterTimestamp"
        result = subprocess.run(
            ["systemctl", "show", service_name, f"--property={props}"],
            capture_output=True, text=True, timeout=10,
        )
        data = {}
        for line in result.stdout.strip().split("\n"):
            if "=" in line:
                k, v = line.split("=", 1)
                data[k.strip()] = v.strip()

        uptime_seconds = None
        ts = data.get("ActiveEnterTimestamp", "")
        if ts and ts != "n/a" and ts != "":
            try:
                from datetime import datetime
                for fmt in ["%a %Y-%m-%d %H:%M:%S %Z", "%a %Y-%m-%d %H:%M:%S %z"]:
                    try:
                        dt = datetime.strptime(ts, fmt)
                        uptime_seconds = int(time.time() - dt.timestamp())
                        break
                    except ValueError:
                        continue
            except Exception:
                pass

        memory_bytes = None
        mem_raw = data.get("MemoryCurrent", "")
        if mem_raw and mem_raw not in ("[not set]", "infinity", ""):
            try:
                memory_bytes = int(mem_raw)
            except ValueError:
                pass

        pid = None
        pid_raw = data.get("MainPID", "0")
        if pid_raw and pid_raw != "0":
            try:
                pid = int(pid_raw)
            except ValueError:
                pass

        return {
            "name": service_name,
            "active_state": data.get("ActiveState", "unknown"),
            "sub_state": data.get("SubState", "unknown"),
            "pid": pid,
            "memory_bytes": memory_bytes,
            "uptime_seconds": uptime_seconds,
        }
    except subprocess.TimeoutExpired:
        return {"name": service_name, "active_state": "unknown", "sub_state": "timeout", "pid": None, "memory_bytes": None, "uptime_seconds": None}
    except FileNotFoundError:
        return {"name": service_name, "active_state": "unknown", "sub_state": "systemctl-not-found", "pid": None, "memory_bytes": None, "uptime_seconds": None}


# ---------------------------------------------------------------------------
# Systemctl list (auto-discovery)
# ---------------------------------------------------------------------------


def list_systemd_services() -> list[dict]:
    """List all running systemd services (auto-discovery)."""
    try:
        result = subprocess.run(
            ["systemctl", "list-units", "--type=service", "--state=running", "--no-legend", "--no-pager"],
            capture_output=True, text=True, timeout=10,
        )
        services = []
        for line in result.stdout.strip().split("\n"):
            parts = line.split()
            if len(parts) >= 4:
                name = parts[0]
                sub_state = parts[3] if len(parts) > 3 else "unknown"
                description = " ".join(parts[4:]) if len(parts) > 4 else ""
                services.append({
                    "name": name,
                    "sub_state": sub_state,
                    "description": description,
                })
        return services
    except subprocess.TimeoutExpired:
        return []
    except FileNotFoundError:
        return []


# ---------------------------------------------------------------------------
# Docker helpers (via Unix socket — no external deps)
# ---------------------------------------------------------------------------


def docker_api_get(path: str, timeout: float = 10.0) -> dict | list | None:
    """Make a GET request to Docker Engine API via Unix socket."""
    sock_path = "/var/run/docker.sock"
    if not os.path.exists(sock_path):
        return None

    try:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect(sock_path)
        request = f"GET {path} HTTP/1.0\r\nHost: localhost\r\n\r\n"
        sock.sendall(request.encode())

        response = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            response += chunk
        sock.close()

        parts = response.split(b"\r\n\r\n", 1)
        if len(parts) < 2:
            return None
        body = parts[1]
        return json.loads(body)
    except Exception:
        return None


def get_containers() -> list[dict]:
    """Get all containers with stats (auto-discovery)."""
    containers_raw = docker_api_get("/containers/json?all=true")
    if containers_raw is None:
        return []

    results = []
    for c in containers_raw:
        name = (c.get("Names") or ["/unknown"])[0].lstrip("/")
        image = c.get("Image", "unknown")
        status = c.get("Status", "unknown")
        state = c.get("State", "unknown")
        created = c.get("Created", 0)

        health = None
        restart_count = 0
        inspect = docker_api_get(f"/containers/{c['Id']}/json")
        if inspect:
            if inspect.get("State", {}).get("Health"):
                health = inspect["State"]["Health"].get("Status")
            restart_count = inspect.get("RestartCount", 0)

        cpu_percent = 0.0
        memory_percent = 0.0
        memory_mb = 0.0
        network_in_mb = 0.0
        network_out_mb = 0.0

        if state == "running":
            stats = docker_api_get(f"/containers/{c['Id']}/stats?stream=false")
            if stats:
                cpu_delta = (stats.get("cpu_stats", {}).get("cpu_usage", {}).get("total_usage", 0) -
                             stats.get("precpu_stats", {}).get("cpu_usage", {}).get("total_usage", 0))
                system_delta = (stats.get("cpu_stats", {}).get("system_cpu_usage", 0) -
                                stats.get("precpu_stats", {}).get("system_cpu_usage", 0))
                num_cpus = stats.get("cpu_stats", {}).get("online_cpus", 1) or 1
                if system_delta > 0:
                    cpu_percent = round((cpu_delta / system_delta) * num_cpus * 100, 2)

                mem_usage = stats.get("memory_stats", {}).get("usage", 0)
                mem_limit = stats.get("memory_stats", {}).get("limit", 1)
                memory_mb = round(mem_usage / (1024 * 1024), 2)
                if mem_limit > 0:
                    memory_percent = round((mem_usage / mem_limit) * 100, 2)

                networks = stats.get("networks", {})
                for iface in networks.values():
                    network_in_mb += iface.get("rx_bytes", 0)
                    network_out_mb += iface.get("tx_bytes", 0)
                network_in_mb = round(network_in_mb / (1024 * 1024), 2)
                network_out_mb = round(network_out_mb / (1024 * 1024), 2)

        results.append({
            "name": name,
            "image": image,
            "status": status,
            "state": state,
            "health": health,
            "cpu_percent": cpu_percent,
            "memory_percent": memory_percent,
            "memory_mb": memory_mb,
            "network_in_mb": network_in_mb,
            "network_out_mb": network_out_mb,
            "restart_count": restart_count,
            "created": created,
        })

    return results


# ---------------------------------------------------------------------------
# PostgreSQL helper
# ---------------------------------------------------------------------------


def check_postgresql(config: dict) -> dict:
    """Connect to PostgreSQL and collect database metrics.

    Requires psycopg2: pip install psycopg2-binary
    Accepts either 'connection_string' or individual host/port/user/password/database fields.
    """
    try:
        import psycopg2  # type: ignore
        import psycopg2.extras  # type: ignore
    except ImportError:
        return {"success": False, "error": "psycopg2 not installed. Run: pip install psycopg2-binary"}

    # Build connection params
    conn_str = (config.get("connection_string") or "").strip()
    # Normalise SQLAlchemy-style URI to plain libpq format
    if conn_str.startswith("postgresql+"):
        conn_str = "postgresql" + conn_str[conn_str.index("://"):]

    host = (config.get("host") or "").strip()
    database = (config.get("database") or "").strip()
    username = (config.get("username") or config.get("user") or "").strip()
    password = (config.get("password") or "").strip()
    port = int(config.get("port", 5432))
    ssl_mode = (config.get("sslmode") or "").strip()

    start = time.time()
    try:
        if conn_str:
            conn = psycopg2.connect(conn_str, connect_timeout=15)
        elif host and database and username:
            kw = dict(host=host, port=port, dbname=database, user=username, password=password, connect_timeout=15)
            if ssl_mode:
                kw["sslmode"] = ssl_mode
            conn = psycopg2.connect(**kw)
        else:
            return {"success": False, "error": "Provide connection_string or host/database/username/password"}

        conn.autocommit = True
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        connect_time = round((time.time() - start) * 1000)

        # 1. Database size
        cur.execute("SELECT pg_database_size(current_database()) AS db_size, pg_size_pretty(pg_database_size(current_database())) AS db_size_pretty")
        size_row = cur.fetchone()
        db_size_bytes = int(size_row["db_size"]) if size_row else 0
        db_size_pretty = size_row["db_size_pretty"] if size_row else "0"

        # 2. Connections
        cur.execute("""
            SELECT count(*) AS total,
                   count(*) FILTER (WHERE state = 'active') AS active,
                   count(*) FILTER (WHERE state = 'idle') AS idle,
                   count(*) FILTER (WHERE wait_event IS NOT NULL) AS waiting
            FROM pg_stat_activity WHERE backend_type = 'client backend'
        """)
        conn_row = cur.fetchone()
        total_conns = int(conn_row["total"]) if conn_row else 0
        active_conns = int(conn_row["active"]) if conn_row else 0
        idle_conns = int(conn_row["idle"]) if conn_row else 0
        waiting_conns = int(conn_row["waiting"]) if conn_row else 0

        # 3. Cache hit ratio
        cur.execute("""
            SELECT ROUND(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 2) AS cache_hit_ratio
            FROM pg_stat_database WHERE datname = current_database()
        """)
        cache_row = cur.fetchone()
        cache_hit = float(cache_row["cache_hit_ratio"]) if cache_row and cache_row["cache_hit_ratio"] else 0.0

        # 4. Top tables by size
        cur.execute("""
            SELECT schemaname, relname,
                   pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
                   n_live_tup AS row_count,
                   n_dead_tup AS dead_tuples,
                   CASE WHEN n_live_tup > 0 THEN ROUND(100.0 * n_dead_tup / n_live_tup, 2) ELSE 0 END AS bloat_percent
            FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 5
        """)
        top_tables = [dict(r) for r in cur.fetchall()]
        # Convert Decimals to float for JSON serialisation
        for t in top_tables:
            for k, v in t.items():
                if hasattr(v, "__float__"):
                    t[k] = float(v)

        # 5. Replication lag
        cur.execute("""
            SELECT CASE WHEN pg_is_in_recovery()
                THEN EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp())
                ELSE 0 END AS replication_lag_seconds
        """)
        rep_row = cur.fetchone()
        replication_lag = float(rep_row["replication_lag_seconds"]) if rep_row and rep_row["replication_lag_seconds"] else 0.0

        # 6. Transaction stats
        cur.execute("""
            SELECT xact_commit, xact_rollback, deadlocks, conflicts,
                   tup_returned, tup_fetched, tup_inserted, tup_updated, tup_deleted
            FROM pg_stat_database WHERE datname = current_database()
        """)
        tx_row = cur.fetchone()
        transactions = {}
        if tx_row:
            transactions = {k: int(v) if v is not None else 0 for k, v in dict(tx_row).items()}

        # 7. Max connections setting
        cur.execute("SHOW max_connections")
        max_conns_row = cur.fetchone()
        max_connections = int(max_conns_row["max_connections"]) if max_conns_row else 100

        cur.close()
        conn.close()
        response_time = round((time.time() - start) * 1000)

        # Connection usage percentage
        conn_percent = round((total_conns / max_connections) * 100, 2) if max_connections > 0 else 0

        # Determine status
        status = "online"
        if cache_hit < 80 or active_conns > 50:
            status = "warning"

        return {
            "success": True,
            "response_time": response_time,
            "metrics": {
                "cpu": min(conn_percent, 100),  # connection % as cpu proxy
                "memory": cache_hit,  # cache hit as memory efficiency
                "disk": 0,
                "status": status,
                "response_time": connect_time,
                "error_message": None,
                "details": {
                    "db_size": db_size_pretty,
                    "db_size_bytes": db_size_bytes,
                    "connections": {
                        "total": total_conns,
                        "active": active_conns,
                        "idle": idle_conns,
                        "waiting": waiting_conns,
                        "max": max_connections,
                    },
                    "cache_hit_ratio": cache_hit,
                    "transactions": transactions,
                    "top_tables": top_tables,
                    "replication_lag_seconds": replication_lag,
                },
            },
        }
    except Exception as e:
        response_time = round((time.time() - start) * 1000)
        return {"success": False, "error": str(e), "response_time": response_time}


# ---------------------------------------------------------------------------
# MSSQL / Azure SQL helper
# ---------------------------------------------------------------------------


def check_mssql(config: dict) -> dict:
    """Connect to MSSQL/Azure SQL and collect resource metrics.

    Requires pymssql: pip install pymssql
    """
    try:
        import pymssql  # type: ignore
    except ImportError:
        return {"success": False, "error": "pymssql not installed. Run: pip install pymssql"}

    host = (config.get("host") or "").strip()
    database = (config.get("database") or "").strip()
    username = (config.get("username") or "").strip()
    password = (config.get("password") or "").strip()
    port = int(config.get("port", 1433))
    tls = config.get("encrypt", True)

    if not all([host, database, username, password]):
        return {"success": False, "error": "Missing required fields: host, database, username, password"}

    start = time.time()
    try:
        conn = pymssql.connect(
            server=host,
            user=username,
            password=password,
            database=database,
            port=port,
            login_timeout=15,
            timeout=15,
            tds_version="7.3",
            conn_properties="",
        )
        cursor = conn.cursor(as_dict=True)

        # 1. Resource stats
        cpu_percent = 0.0
        memory_percent = 0.0
        data_io_percent = 0.0
        log_write_percent = 0.0
        max_worker_percent = 0.0
        max_session_percent = 0.0
        try:
            cursor.execute("""
                SELECT TOP 1
                    avg_cpu_percent,
                    avg_data_io_percent,
                    avg_log_write_percent,
                    avg_memory_usage_percent,
                    max_worker_percent,
                    max_session_percent
                FROM sys.dm_db_resource_stats
                ORDER BY end_time DESC
            """)
            row = cursor.fetchone()
            if row:
                cpu_percent = float(row.get("avg_cpu_percent", 0) or 0)
                memory_percent = float(row.get("avg_memory_usage_percent", 0) or 0)
                data_io_percent = float(row.get("avg_data_io_percent", 0) or 0)
                log_write_percent = float(row.get("avg_log_write_percent", 0) or 0)
                max_worker_percent = float(row.get("max_worker_percent", 0) or 0)
                max_session_percent = float(row.get("max_session_percent", 0) or 0)
        except Exception:
            pass  # DMV might not be available on all editions

        # 2. Storage stats
        used_mb = 0
        allocated_mb = 0
        storage_percent = 0.0
        try:
            cursor.execute("""
                SELECT
                    SUM(CAST(FILEPROPERTY(name, 'SpaceUsed') AS BIGINT) * 8 / 1024) AS used_mb,
                    SUM(size * 8 / 1024) AS allocated_mb
                FROM sys.database_files
                WHERE type_desc = 'ROWS'
            """)
            row = cursor.fetchone()
            if row:
                used_mb = int(row.get("used_mb", 0) or 0)
                allocated_mb = int(row.get("allocated_mb", 0) or 0)
                if allocated_mb > 0:
                    storage_percent = round((used_mb / allocated_mb) * 100, 2)
        except Exception:
            pass

        # 3. Connection stats
        active_connections = 0
        total_sessions = 0
        try:
            cursor.execute("SELECT COUNT(*) AS cnt FROM sys.dm_exec_sessions WHERE is_user_process = 1 AND status = 'running'")
            row = cursor.fetchone()
            active_connections = int(row["cnt"]) if row else 0

            cursor.execute("SELECT COUNT(*) AS cnt FROM sys.dm_exec_sessions WHERE is_user_process = 1")
            row = cursor.fetchone()
            total_sessions = int(row["cnt"]) if row else 0
        except Exception:
            pass

        # 4. Top waits
        top_waits = []
        try:
            cursor.execute("""
                SELECT TOP 5
                    wait_type, waiting_tasks_count, wait_time_ms
                FROM sys.dm_os_wait_stats
                WHERE waiting_tasks_count > 0
                    AND wait_type NOT LIKE '%SLEEP%'
                    AND wait_type NOT LIKE '%IDLE%'
                    AND wait_type NOT LIKE '%QUEUE%'
                    AND wait_type NOT LIKE 'BROKER%'
                    AND wait_type NOT LIKE 'XE%'
                    AND wait_type NOT LIKE 'WAITFOR'
                ORDER BY wait_time_ms DESC
            """)
            top_waits = [dict(r) for r in cursor.fetchall()]
        except Exception:
            pass

        conn.close()
        response_time = round((time.time() - start) * 1000)

        # Determine status
        status = "online"
        if cpu_percent > 90 or memory_percent > 90 or storage_percent > 95:
            status = "warning"

        return {
            "success": True,
            "response_time": response_time,
            "metrics": {
                "cpu_percent": round(cpu_percent, 2),
                "memory_percent": round(memory_percent, 2),
                "storage_percent": storage_percent,
                "active_connections": active_connections,
                "avg_response_time": response_time,
                "status": status,
                "error_message": None,
                "details": {
                    "avg_data_io_percent": data_io_percent,
                    "avg_log_write_percent": log_write_percent,
                    "max_worker_percent": max_worker_percent,
                    "max_session_percent": max_session_percent,
                    "used_mb": used_mb,
                    "allocated_mb": allocated_mb,
                    "total_sessions": total_sessions,
                    "active_connections": active_connections,
                    "top_waits": top_waits,
                },
            },
        }
    except Exception as e:
        response_time = round((time.time() - start) * 1000)
        return {"success": False, "error": str(e), "response_time": response_time}


# ---------------------------------------------------------------------------
# Remote exec helpers
# ---------------------------------------------------------------------------

# Commands that are allowed to run via /exec endpoint.
# Each entry maps a command name to either True (allow any args) or a list of
# allowed sub-commands / flags.  Only the first token of the user-supplied
# command is checked against this set, so "ls -la /tmp" passes because "ls"
# is in the allow-list.
ALLOWED_COMMANDS: dict[str, bool] = {
    # Navigation / listing
    "ls": True, "cat": True, "head": True, "tail": True,
    "wc": True, "du": True, "df": True, "stat": True, "file": True,
    "tree": True, "realpath": True, "readlink": True, "basename": True,
    "dirname": True, "pwd": True, "whoami": True, "id": True, "date": True,
    # Text processing
    "grep": True, "awk": True, "sort": True, "uniq": True,
    "cut": True, "tr": True, "diff": True, "comm": True,
    # System info
    "uname": True, "hostname": True, "uptime": True, "free": True,
    "top": True, "htop": True, "vmstat": True, "iostat": True,
    "lscpu": True, "lsblk": True, "lsmem": True, "nproc": True,
    "arch": True, "mount": True, "lsof": True, "ss": True,
    "netstat": True, "ip": True, "ifconfig": True, "route": True,
    # Processes
    "ps": True, "pgrep": True, "pidof": True,
    # Systemd (restricted subcommands checked separately below)
    "systemctl": True, "journalctl": True,
    # Docker (restricted subcommands checked separately below)
    "docker": True, "docker-compose": True,
    # Logs
    "dmesg": True, "last": True, "lastlog": True,
    # Network diagnostics (read-only)
    "ping": True, "traceroute": True, "dig": True, "nslookup": True,
    # Package info (read-only)
    "dpkg": True, "rpm": True,
    # Misc
    "echo": True, "env": True, "printenv": True, "which": True,
    "type": True, "whereis": True,
}

# Tokens / patterns that are NEVER allowed anywhere in the command string,
# to mitigate chaining / redirect injection.
BLOCKED_PATTERNS = [
    "&&", "||", ">>", ">", "|", ";", "`", "$(", "${",
    "\n", "\r", "\x00",
    "rm ", "rm\t", "rmdir", "mkfs", "dd ", "shred",
    "chmod", "chown", "chgrp",
    "shutdown", "reboot", "poweroff", "halt", "init ",
    "kill ", "killall", "pkill",
    "useradd", "userdel", "usermod", "passwd", "adduser",
    "iptables", "ufw", "firewall",
    "mount ", "umount",
    "mkfs", "fdisk", "parted",
    "crontab", "at ",
    "/dev/sd", "/dev/null",
    "-exec", "-delete", "-execdir",  # find dangerous flags
    " -i ", " -i\t",  # sed in-place editing
    "curl ", "wget ",  # SSRF risk
    "python", "node ", "perl ", "ruby ",  # arbitrary code execution
    "pip ", "pip3 ", "npm ", "apt ", "yum ",  # package managers
]

# Subcommands allowed for systemctl (includes restart/start/stop for service management)
SYSTEMCTL_ALLOWED_SUBCOMMANDS = {
    "status", "is-active", "is-enabled", "is-failed",
    "list-units", "list-unit-files", "show",
    "restart", "start", "stop", "reload",
}

# Subcommands allowed for docker (read-only + restart)
DOCKER_ALLOWED_SUBCOMMANDS = {
    "ps", "logs", "inspect", "stats", "top", "images",
    "info", "version", "compose",
    "restart", "start", "stop",
}


def validate_exec_command(command: str) -> str | None:
    """Validate a command and return an error message or None if OK."""
    stripped = command.strip()
    if not stripped:
        return "Empty command"

    # Check blocked patterns
    for pat in BLOCKED_PATTERNS:
        if pat in stripped:
            return f"Blocked pattern detected: {pat.strip()!r}"

    # Get first token (the actual binary)
    tokens = stripped.split()
    first_token = tokens[0]
    # Strip path (e.g. /usr/bin/ls -> ls)
    binary = first_token.rsplit("/", 1)[-1]

    if binary not in ALLOWED_COMMANDS:
        return f"Command not allowed: {binary!r}. Only read-only diagnostic commands are permitted."

    # Validate systemctl subcommands
    if binary == "systemctl" and len(tokens) > 1:
        sub = tokens[1]
        if sub.startswith("-"):
            pass  # flags like --no-pager are OK
        elif sub not in SYSTEMCTL_ALLOWED_SUBCOMMANDS:
            return f"systemctl subcommand not allowed: {sub!r}. Allowed: {', '.join(sorted(SYSTEMCTL_ALLOWED_SUBCOMMANDS))}"

    # Validate docker subcommands
    if binary in ("docker", "docker-compose") and len(tokens) > 1:
        sub = tokens[1]
        if sub.startswith("-"):
            pass  # flags like --format are OK
        elif sub not in DOCKER_ALLOWED_SUBCOMMANDS:
            return f"docker subcommand not allowed: {sub!r}. Allowed: {', '.join(sorted(DOCKER_ALLOWED_SUBCOMMANDS))}"

    return None


def execute_command(command: str, timeout_seconds: int = 30) -> dict:
    """Execute a validated command and return stdout/stderr."""
    error = validate_exec_command(command)
    if error:
        return {"success": False, "error": error, "exit_code": -1, "stdout": "", "stderr": ""}

    clamped_timeout = min(max(timeout_seconds, 1), 60)
    try:
        result = subprocess.run(
            command.split(),
            capture_output=True,
            text=True,
            timeout=clamped_timeout,
            env={**os.environ, "LANG": "C.UTF-8"},
        )
        # Truncate output to 64 KB to avoid huge payloads
        max_out = 65536
        return {
            "success": result.returncode == 0,
            "exit_code": result.returncode,
            "stdout": result.stdout[:max_out],
            "stderr": result.stderr[:max_out],
            "truncated": len(result.stdout) > max_out or len(result.stderr) > max_out,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"Command timed out after {clamped_timeout}s", "exit_code": -1, "stdout": "", "stderr": ""}
    except FileNotFoundError:
        return {"success": False, "error": f"Command not found: {command.split()[0]!r}", "exit_code": -1, "stdout": "", "stderr": ""}
    except Exception as e:
        return {"success": False, "error": str(e), "exit_code": -1, "stdout": "", "stderr": ""}


# ---------------------------------------------------------------------------
# Self-update helpers
# ---------------------------------------------------------------------------


def get_remote_version() -> str | None:
    """Fetch the version from the latest agent on GitHub."""
    try:
        req = urllib.request.Request(GITHUB_RAW_URL, headers={"User-Agent": "monitoring-agent"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            for line in resp.read().decode().split("\n"):
                if line.startswith("AGENT_VERSION"):
                    return line.split('"')[1]
        return None
    except Exception:
        return None


def perform_update() -> dict:
    """Download latest agent from GitHub and restart the service."""
    try:
        remote_version = get_remote_version()
        if remote_version is None:
            return {"success": False, "error": "Could not fetch remote version"}

        if remote_version == AGENT_VERSION:
            return {"success": True, "updated": False, "current_version": AGENT_VERSION, "latest_version": remote_version, "message": "Already up to date"}

        agent_path = "/opt/monitoring-agent/monitoring-agent.py"
        tmp_path = "/tmp/monitoring-agent-update.py"

        req = urllib.request.Request(GITHUB_RAW_URL, headers={"User-Agent": "monitoring-agent"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            with open(tmp_path, "wb") as f:
                f.write(resp.read())

        with open(tmp_path) as f:
            content = f.read()
        if "AGENT_VERSION" not in content or "def main()" not in content:
            os.remove(tmp_path)
            return {"success": False, "error": "Downloaded file appears invalid"}

        os.replace(tmp_path, agent_path)
        os.chmod(agent_path, 0o755)

        subprocess.Popen(
            ["systemctl", "restart", "monitoring-agent"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

        return {
            "success": True,
            "updated": True,
            "current_version": AGENT_VERSION,
            "latest_version": remote_version,
            "message": f"Updated from {AGENT_VERSION} to {remote_version}. Restarting...",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ---------------------------------------------------------------------------
# HTTP Server
# ---------------------------------------------------------------------------


class AgentHandler(http.server.BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass

    def send_json(self, data: dict, status: int = 200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def check_ip(self) -> bool:
        """Check if the client IP is in the allowed list."""
        if not ALLOWED_NETWORKS:
            return True  # no restriction configured
        client_ip_str = self.client_address[0]
        try:
            client_ip = ipaddress.ip_address(client_ip_str)
        except ValueError:
            self.send_json({"error": f"invalid client IP: {client_ip_str}"}, 403)
            return False
        for net in ALLOWED_NETWORKS:
            if client_ip in net:
                return True
        self.send_json({"error": f"IP {client_ip_str} not allowed"}, 403)
        return False

    def check_auth(self) -> bool:
        if not self.check_ip():
            return False
        if not CONFIG.token:
            return True
        token = self.headers.get("Authorization", "").replace("Bearer ", "")
        if token == CONFIG.token:
            return True
        self.send_json({"error": "unauthorized"}, 401)
        return False

    def do_GET(self):
        if not self.check_auth():
            return

        if self.path == "/health":
            self.send_json({
                "status": "ok",
                "version": AGENT_VERSION,
                "timestamp": time.time(),
                "endpoints": ["/health", "/systemctl", "/systemctl/list", "/containers", "/metrics", "/processes", "/postgresql", "/mssql", "/exec", "/version", "/update"],
            })
        elif self.path == "/systemctl/list":
            services = list_systemd_services()
            self.send_json({"services": services})
        elif self.path == "/containers":
            containers = get_containers()
            self.send_json({"containers": containers})
        elif self.path == "/metrics":
            metrics = get_server_metrics()
            self.send_json(metrics)
        elif self.path == "/processes":
            processes = get_top_processes()
            self.send_json({"processes": processes})
        elif self.path == "/version":
            remote = get_remote_version()
            self.send_json({
                "current_version": AGENT_VERSION,
                "latest_version": remote,
                "update_available": remote is not None and remote != AGENT_VERSION,
            })
        else:
            self.send_json({"error": "not found"}, 404)

    def do_POST(self):
        if not self.check_auth():
            return

        if self.path == "/systemctl":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                self.send_json({"error": "invalid json"}, 400)
                return

            services = data.get("services", [])
            if not isinstance(services, list):
                self.send_json({"error": "'services' must be a list"}, 400)
                return

            units = [get_systemctl_unit(svc) for svc in services]
            self.send_json({"units": units})
        elif self.path == "/postgresql":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                self.send_json({"error": "invalid json"}, 400)
                return
            result = check_postgresql(data)
            self.send_json(result, 200 if result.get("success") else 500)
        elif self.path == "/mssql":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                self.send_json({"error": "invalid json"}, 400)
                return
            result = check_mssql(data)
            self.send_json(result, 200 if result.get("success") else 500)
        elif self.path == "/exec":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                self.send_json({"error": "invalid json"}, 400)
                return
            command = data.get("command", "").strip()
            if not command:
                self.send_json({"error": "'command' is required"}, 400)
                return
            timeout_seconds = int(data.get("timeout", 30))
            result = execute_command(command, timeout_seconds)
            self.send_json(result, 200 if result.get("success") else 400)
        elif self.path == "/update":
            result = perform_update()
            self.send_json(result, 200 if result.get("success") else 500)
        else:
            self.send_json({"error": "not found"}, 404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()


def main():
    server = http.server.HTTPServer(("0.0.0.0", CONFIG.port), AgentHandler)
    print(f"🚀 Monitoring Agent v{AGENT_VERSION} running on port {CONFIG.port}")
    print(f"📡 Endpoints: /health, /systemctl, /containers, /metrics, /processes, /postgresql, /mssql, /exec, /version, /update")
    if CONFIG.token:
        print(f"🔒 Authentication enabled (token required)")
    else:
        print(f"⚠️  No authentication token set. Use --token or AGENT_TOKEN env var.")
    if ALLOWED_NETWORKS:
        print(f"🛡️  IP allowlist active: {', '.join(str(n) for n in ALLOWED_NETWORKS)}")
    else:
        print(f"🌐 No IP restriction (any IP with valid token can connect)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Agent stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
