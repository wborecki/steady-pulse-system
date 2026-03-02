#!/usr/bin/env python3
"""
Monitoring Agent — lightweight HTTP server for systemctl & Docker metrics.

Usage:
    python3 monitoring-agent.py [--port 9100] [--token YOUR_SECRET_TOKEN]

    Or via environment variables:
        AGENT_PORT=9100
        AGENT_TOKEN=your_secret_token

Endpoints:
    POST /systemctl   — returns status of specified systemd services
    GET  /containers  — returns Docker container stats
    GET  /health      — agent health check

Install as systemd service:
    sudo cp monitoring-agent.py /opt/monitoring-agent.py
    sudo chmod +x /opt/monitoring-agent.py
    sudo tee /etc/systemd/system/monitoring-agent.service << 'EOF'
    [Unit]
    Description=Monitoring Agent
    After=network.target

    [Service]
    Type=simple
    ExecStart=/usr/bin/python3 /opt/monitoring-agent.py --port 9100
    Environment=AGENT_TOKEN=your_secret_token
    Restart=always
    RestartSec=5

    [Install]
    WantedBy=multi-user.target
    EOF

    sudo systemctl daemon-reload
    sudo systemctl enable --now monitoring-agent
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

AGENT_VERSION = "1.0.0"


def get_config():
    parser = argparse.ArgumentParser(description="Monitoring Agent")
    parser.add_argument("--port", type=int, default=int(os.environ.get("AGENT_PORT", "9100")))
    parser.add_argument("--token", type=str, default=os.environ.get("AGENT_TOKEN", ""))
    return parser.parse_args()


CONFIG = get_config()

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

        # Calculate uptime
        uptime_seconds = None
        ts = data.get("ActiveEnterTimestamp", "")
        if ts and ts != "n/a" and ts != "":
            try:
                from datetime import datetime
                # systemctl outputs timestamps like "Mon 2025-01-01 12:00:00 UTC"
                # Try multiple formats
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
        return {
            "name": service_name,
            "active_state": "unknown",
            "sub_state": "timeout",
            "pid": None,
            "memory_bytes": None,
            "uptime_seconds": None,
        }
    except FileNotFoundError:
        return {
            "name": service_name,
            "active_state": "unknown",
            "sub_state": "systemctl-not-found",
            "pid": None,
            "memory_bytes": None,
            "uptime_seconds": None,
        }


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

        # Split headers and body
        parts = response.split(b"\r\n\r\n", 1)
        if len(parts) < 2:
            return None
        body = parts[1]
        return json.loads(body)
    except Exception:
        return None


def get_containers() -> list[dict]:
    """Get all containers with stats."""
    containers_raw = docker_api_get("/containers/json?all=true")
    if containers_raw is None:
        return []

    results = []
    for c in containers_raw:
        name = (c.get("Names") or ["/unknown"])[0].lstrip("/")
        image = c.get("Image", "unknown")
        status = c.get("Status", "unknown")
        state = c.get("State", "unknown")

        # Get health from inspect
        health = None
        inspect = docker_api_get(f"/containers/{c['Id']}/json")
        if inspect and inspect.get("State", {}).get("Health"):
            health = inspect["State"]["Health"].get("Status")

        # Get stats (one-shot)
        cpu_percent = 0.0
        memory_percent = 0.0
        memory_mb = 0.0
        network_in_mb = 0.0
        network_out_mb = 0.0

        if state == "running":
            stats = docker_api_get(f"/containers/{c['Id']}/stats?stream=false")
            if stats:
                # CPU calculation
                cpu_delta = (stats.get("cpu_stats", {}).get("cpu_usage", {}).get("total_usage", 0) -
                             stats.get("precpu_stats", {}).get("cpu_usage", {}).get("total_usage", 0))
                system_delta = (stats.get("cpu_stats", {}).get("system_cpu_usage", 0) -
                                stats.get("precpu_stats", {}).get("system_cpu_usage", 0))
                num_cpus = stats.get("cpu_stats", {}).get("online_cpus", 1) or 1
                if system_delta > 0:
                    cpu_percent = round((cpu_delta / system_delta) * num_cpus * 100, 2)

                # Memory calculation
                mem_usage = stats.get("memory_stats", {}).get("usage", 0)
                mem_limit = stats.get("memory_stats", {}).get("limit", 1)
                memory_mb = round(mem_usage / (1024 * 1024), 2)
                if mem_limit > 0:
                    memory_percent = round((mem_usage / mem_limit) * 100, 2)

                # Network
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
        })

    return results


# ---------------------------------------------------------------------------
# HTTP Server
# ---------------------------------------------------------------------------


class AgentHandler(http.server.BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        # Suppress default logging, or customize here
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
            })
        elif self.path == "/containers":
            containers = get_containers()
            self.send_json({"containers": containers})
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
