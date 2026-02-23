#!/usr/bin/env python3
"""SimpleHero dev server.

Serves static files from project root and exposes /status.
- /status -> 200 when dist/main.js exists, otherwise 400
"""

from __future__ import annotations

import json
import os
import subprocess
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
HOST = "0.0.0.0"
PORT = int(os.getenv("PORT", "8081"))

BUILD_STATUS = {
    "ok": False,
    "message": "typescript not built",
}


def compile_typescript() -> None:
    """Compile TypeScript before serving."""
    tsc_bin = ROOT / "node_modules" / ".bin" / "tsc"
    command = [str(tsc_bin), "-p", "tsconfig.json"]

    if not tsc_bin.exists():
        BUILD_STATUS["ok"] = False
        BUILD_STATUS["message"] = "typescript compiler missing: run npm install"
        return

    result = subprocess.run(
        command,
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode == 0:
        BUILD_STATUS["ok"] = True
        BUILD_STATUS["message"] = "ready"
        return

    BUILD_STATUS["ok"] = False
    stderr = result.stderr.strip() or result.stdout.strip() or "tsc failed"
    BUILD_STATUS["message"] = f"typescript build failed: {stderr}"


class DevHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path == "/status":
            self._handle_status()
            return

        if self.path == "/":
            self.path = "/src/views/index.html"

        return super().do_GET()

    def _handle_status(self) -> None:
        bundle_path = ROOT / "dist" / "main.js"
        ready = BUILD_STATUS["ok"] and bundle_path.exists()

        status_code = HTTPStatus.OK if ready else HTTPStatus.BAD_REQUEST
        payload = {
            "ok": ready,
            "status": int(status_code),
            "message": BUILD_STATUS["message"] if not ready else "ready",
        }

        response = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)


def main() -> None:
    compile_typescript()

    with ThreadingHTTPServer((HOST, PORT), DevHandler) as server:
        print(f"SimpleHero dev server on http://{HOST}:{PORT}")
        print(f"Open http://localhost:{PORT}/src/views/index.html")
        print(f"Health: http://localhost:{PORT}/status")
        print(f"Build status: {BUILD_STATUS['message']}")
        server.serve_forever()


if __name__ == "__main__":
    main()
