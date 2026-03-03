#!/usr/bin/env python3
"""
Monitoring Agent — lightweight HTTP server for systemctl, Docker & server metrics.

Usage:
    python3 monitoring-agent.py [--port 9100] [--token YOUR_SECRET_TOKEN]

    Or via environment variables:
        AGENT_PORT=9100
        AGENT_TOKEN=your_secret_token

Endpoints:
    POST /systemctl     — returns status of specified systemd services
    GET  /systemctl/list — auto-discovery of running systemd services
    GET  /containers    — returns Docker container stats (auto-discovery)
    GET  /metrics       — returns server metrics (CPU, RAM, swap, disk, load, network, uptime)
    GET  /processes     — returns top processes by CPU/memory
    GET  /health        — agent health check
    GET  /version       — current agent version
    POST /update        — self-update from GitHub

Install as systemd service:
    curl -fsSL https://raw.githubusercontent.com/Solutions-in-BI/steady-pulse-system/main/docs/install-agent.sh | sudo bash -s -- --token SEU_TOKEN
"""

import argparse
import http.server
import json
import os
import socket
import subprocess
import time
import urllib.request

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

AGENT_VERSION = "2.1.0"
GITHUB_RAW_URL = "https://raw.githubusercontent.com/Solutions-in-BI/steady-pulse-system/main/docs/monitoring-agent.py"


def get_config():
    parser = argparse.ArgumentParser(description="Monitoring Agent")
    parser.add_argument("--port", type=int, default=int(os.environ.get("AGENT_PORT", "9100")))
    parser.add_argument("--token", type=str, default=os.environ.get("AGENT_TOKEN", ""))
    return parser.parse_args()


CONFIG = get_config()

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

    def check_auth(self) -> bool:
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
                "endpoints": ["/health", "/systemctl", "/systemctl/list", "/containers", "/metrics", "/processes", "/version", "/update"],
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
    print(f"📡 Endpoints: /health, /systemctl, /containers, /metrics, /processes, /version, /update")
    if CONFIG.token:
        print(f"🔒 Authentication enabled (token required)")
    else:
        print(f"⚠️  No authentication token set. Use --token or AGENT_TOKEN env var.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Agent stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
