"""backend/server.py — Robust server launcher for Robot Vision Quality Inspection Workstation.

Handles:
- Detecting if an existing instance is already running to prevent duplicate processes
- Dynamically allocating port 8000 (with fallbacks to 8080, 8001) if occupied
- Automatically launching the default web browser (Chrome, Edge, etc.)
- Running Uvicorn server in a reliable cross-platform manner
"""
from __future__ import annotations

import json
import logging
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("robot_vision_launcher")


def is_app_already_running(port: int = 8000) -> bool:
    """Check if our Robot Vision API is already active on the specified port."""
    url = f"http://127.0.0.1:{port}/api/health"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RobotVisionLauncher"})
        with urllib.request.urlopen(req, timeout=1.0) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("status") == "ok" and "Robot Vision" in data.get("service", ""):
                    return True
    except Exception:
        pass
    return False


def is_port_free(port: int) -> bool:
    """Check if a TCP port on localhost can be bound."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(("127.0.0.1", port))
        s.close()
        return True
    except OSError:
        return False


def find_suitable_port(preferred: int = 8000, fallbacks: list[int] = [8080, 8001, 8888]) -> int | None:
    """Find a free TCP port among preferred and fallback options."""
    for p in [preferred] + fallbacks:
        if is_port_free(p):
            return p
    return None


def wait_and_open_browser(url: str, port: int, timeout_sec: float = 12.0) -> None:
    """Poll the FastAPI health endpoint until the server is verified ready, then open the browser."""
    def _worker():
        t0 = time.time()
        health_url = f"http://127.0.0.1:{port}/api/health"
        while time.time() - t0 < timeout_sec:
            try:
                req = urllib.request.Request(health_url, headers={"User-Agent": "RobotVisionPoller"})
                with urllib.request.urlopen(req, timeout=0.6) as resp:
                    if resp.status == 200:
                        log.info("Server verified healthy on port %d. Opening browser -> %s", port, url)
                        webbrowser.open(url)
                        return
            except Exception:
                time.sleep(0.25)
        # Fallback if health endpoint took longer than timeout
        log.warning("Health poll timed out; attempting browser launch anyway -> %s", url)
        webbrowser.open(url)

    t = threading.Thread(target=_worker, daemon=True)
    t.start()



def main():
    preferred_port = 8000

    # 1. Check if the server is ALREADY running from a previous instance
    if is_app_already_running(preferred_port):
        url = f"http://localhost:{preferred_port}"
        print()
        print("======================================================================")
        print("  [INFO] Robot Vision Workstation is ALREADY running!")
        print(f"  URL: {url}")
        print("  Preventing duplicate server process.")
        print("  Opening browser to existing instance...")
        print("======================================================================")
        print()
        webbrowser.open(url)
        return 0

    # 2. Check port availability
    target_port = find_suitable_port(preferred_port)
    if target_port is None:
        log.error("Ports %s and all fallbacks are occupied.", [preferred_port, 8080, 8001])
        print()
        print("[ERROR] Could not find an available network port for the server.")
        print("Please check for running processes occupying ports 8000 or 8080.")
        return 1

    if target_port != preferred_port:
        print()
        print(f"[WARNING] Port {preferred_port} is in use by another application.")
        print(f"[INFO] Using fallback port {target_port} instead.")
        print()

    url = f"http://localhost:{target_port}"

    print()
    print("======================================================================")
    print("  ROBOT VISION: AUTOMATED QUALITY INSPECTION WORKSTATION")
    print("  Stage 3 Comprehensive Review | College Engineering Micro-Project")
    print("  Shah & Anchor Kutchhi Engineering College | Om Nathwani")
    print("======================================================================")
    print(f"  Local Web Workstation URL: {url}")
    print("  Opening Google Chrome / Default Browser...")
    print("  Press Ctrl+C to stop the server.")
    print("======================================================================")
    print()

    # 3. Schedule browser opening after verifying server is responding
    wait_and_open_browser(url, target_port)

    # 4. Start Uvicorn
    import uvicorn
    from backend.app import app

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=target_port,
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
