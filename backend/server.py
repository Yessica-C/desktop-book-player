from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import mimetypes
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse

PORT = int(os.environ.get("BOOK_PLAYER_PORT", "8765"))

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            return

        self.send_response(404)
        self.end_headers()


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Python backend listening on port {server.server_address[1]}", flush=True)
    server.serve_forever()
