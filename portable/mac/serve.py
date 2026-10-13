#!/usr/bin/env python3
"""Loopback server for the Mac copy of Quire. Stdlib only."""

import argparse
import json
import os
import re
import secrets
import signal
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

PORTS = range(47321, 47341)
MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".pfb": "application/octet-stream",
    ".bcmap": "application/octet-stream",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".txt": "text/plain; charset=utf-8",
    ".pdf": "application/pdf",
}


class Launch:
    def __init__(self):
        self.lock = threading.Lock()
        self.name = ""
        self.blob = None
        self.token = 0
        self.gate = secrets.token_hex(16)

    def set_pdf(self, raw):
        path = Path(str(raw).strip().strip('"'))
        if not path.is_file() or path.suffix.lower() != ".pdf":
            return False
        data = path.read_bytes()
        with self.lock:
            self.name = path.name
            self.blob = data
            self.token += 1
        return True

    def snapshot(self):
        with self.lock:
            return self.name, self.blob, self.token


def open_browser(url):
    if sys.platform == "darwin":
        subprocess.Popen(["open", url])
    else:
        print(url, flush=True)


def try_handoff(port_file, pdf):
    if not port_file.is_file():
        return False
    match = re.match(r"^(\d+)\s+(\S+)$", port_file.read_text(encoding="utf-8").strip())
    if not match:
        return False
    port, gate = match.group(1), match.group(2)
    import urllib.error
    import urllib.request

    try:
        if pdf:
            request = urllib.request.Request(
                f"http://127.0.0.1:{port}/__quire/open",
                data=pdf.encode("utf-8"),
                headers={"X-Quire-Token": gate, "Content-Type": "text/plain; charset=utf-8"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=3) as response:
                response.read()
            open_browser(f"http://127.0.0.1:{port}/#launch")
            print("Opened in Quire. You can close this window. Leave the first Quire window open.", flush=True)
        else:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/__quire/launch.json", timeout=3) as response:
                response.read()
            open_browser(f"http://127.0.0.1:{port}/")
            print("Quire is already open. You can close this window.", flush=True)
        return True
    except (OSError, urllib.error.URLError):
        port_file.unlink(missing_ok=True)
        return False


def make_handler(root, launch):
    root = root.resolve()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            return

        def send_bytes(self, code, body, content_type):
            data = body or b""
            self.send_response(code)
            self.send_header("Cache-Control", "no-store")
            if content_type:
                self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if data and self.command != "HEAD":
                self.wfile.write(data)

        def do_HEAD(self):
            self.route(head=True)

        def do_GET(self):
            self.route(head=False)

        def do_POST(self):
            path = unquote(self.path.split("?", 1)[0])
            if path != "/__quire/open":
                self.send_bytes(404, b"Not found", "text/plain; charset=utf-8")
                return
            given = self.headers.get("X-Quire-Token", "")
            length = int(self.headers.get("Content-Length", "0") or "0")
            if length < 0 or length > 4000:
                self.send_bytes(400, b"Not a PDF", "text/plain; charset=utf-8")
                return
            posted = self.rfile.read(length).decode("utf-8", "replace")
            if given != launch.gate or not launch.set_pdf(posted):
                code = 403 if given != launch.gate else 400
                self.send_bytes(code, b"Not a PDF" if code == 400 else b"No", "text/plain; charset=utf-8")
                return
            self.send_bytes(204, b"", "")

        def route(self, head):
            path = unquote(self.path.split("?", 1)[0])
            if path == "/__quire/launch.json":
                name, blob, token = launch.snapshot()
                if token < 1 or blob is None:
                    self.send_bytes(204, b"", "application/json")
                else:
                    payload = json.dumps({"name": name, "token": token}).encode("utf-8")
                    self.send_bytes(200, payload, "application/json; charset=utf-8")
                return
            if path == "/__quire/launch.pdf":
                _name, blob, token = launch.snapshot()
                if token < 1 or blob is None:
                    self.send_bytes(404, b"Not found", "text/plain; charset=utf-8")
                else:
                    self.send_bytes(200, blob, "application/pdf")
                return
            rel = "/index.html" if path in ("", "/") else path
            rel = rel.lstrip("/")
            full = (root / rel).resolve()
            inside = full == root or str(full).startswith(str(root) + os.sep)
            if not inside or not full.is_file():
                self.send_bytes(404, b"Not found", "text/plain; charset=utf-8")
                return
            content_type = MIME.get(full.suffix.lower(), "")
            body = b"" if head else full.read_bytes()
            if head:
                self.send_response(200)
                self.send_header("Cache-Control", "no-store")
                if content_type:
                    self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(full.stat().st_size))
                self.end_headers()
                return
            self.send_bytes(200, body, content_type)

    return Handler


def serve(root, port_file, pdf):
    root = root.resolve()
    port_file = port_file.resolve()
    launch = Launch()
    if pdf and not launch.set_pdf(pdf):
        print("That file is not a PDF Quire can open.", flush=True)
        pdf = ""
    httpd = None
    for candidate in PORTS:
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", candidate), make_handler(root, launch))
            httpd.daemon_threads = True
            break
        except OSError:
            httpd = None
    if httpd is None:
        print("Quire could not open a local address. Close the other Quire window and try again.", flush=True)
        return 1
    port = httpd.server_address[1]
    port_file.write_text(f"{port} {launch.gate}\n", encoding="utf-8")

    def stop(_signum=None, _frame=None):
        threading.Thread(target=httpd.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    if hasattr(signal, "SIGHUP"):
        signal.signal(signal.SIGHUP, stop)
    url = f"http://127.0.0.1:{port}/#launch" if launch.token else f"http://127.0.0.1:{port}/"
    print("Quire is open in your browser.", flush=True)
    print("Leave this window open. Close it when you are finished.", flush=True)
    print(f"Address: {url.split('#')[0]}", flush=True)
    threading.Timer(0.2, lambda: open_browser(url)).start()
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()
        try:
            text = port_file.read_text(encoding="utf-8")
            if text.startswith(f"{port} "):
                port_file.unlink(missing_ok=True)
        except OSError:
            pass
    return 0


def main(argv):
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--root", required=True)
    parser.add_argument("--port-file", required=True)
    parser.add_argument("pdfs", nargs="*")
    args = parser.parse_args(argv)
    pdfs = [item for item in args.pdfs if not item.startswith("-") and item.lower().endswith(".pdf")]
    pdf = pdfs[0] if pdfs else ""
    port_file = Path(args.port_file)
    if try_handoff(port_file, pdf):
        return 0
    return serve(Path(args.root), port_file, pdf)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
