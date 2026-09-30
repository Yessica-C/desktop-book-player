from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import mimetypes
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse

try:
    from .audiobook import library
except ImportError:
    from audiobook import library

PORT = int(os.environ.get("BOOK_PLAYER_PORT", "8765"))


class Handler(BaseHTTPRequestHandler):
    def send_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.send_json({"status": "ok"})
            return

        parsed_path = urlparse(self.path)
        if parsed_path.path == "/audiobooks":
            self.send_json({"audiobooks": list(library.to_dict().values())})
            return

        if parsed_path.path == "/audio":
            self.send_audio(parse_qs(parsed_path.query).get("filename", [""])[0])
            print(f"Request for audio file: {parse_qs(parsed_path.query).get('filename', [''])[0]}")
            return

        self.send_response(404)
        self.end_headers()

    def send_audio(self, filename: str) -> None:
        print(f"send_audio of file: {filename}")
        audiobook = library.get(filename)
        if audiobook is None:
            self.send_json({"error": "audiobook not found"}, status=404)
            return

        audio_path = Path(audiobook.filename)
        if not audio_path.is_file():
            self.send_json({"error": "audio file not found"}, status=404)
            return

        file_size = audio_path.stat().st_size
        range_header = self.headers.get("Range")
        start = 0
        end = file_size - 1

        if range_header:
            try:
                range_value = range_header.removeprefix("bytes=").split(",", 1)[0]
                range_start, range_end = range_value.split("-", 1)
                if range_start:
                    start = int(range_start)
                    if range_end:
                        end = int(range_end)
                else:
                    suffix_length = int(range_end)
                    start = max(file_size - suffix_length, 0)

                if start < 0 or start >= file_size or end < start:
                    raise ValueError
                end = min(end, file_size - 1)
            except (TypeError, ValueError):
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{file_size}")
                self.end_headers()
                return

        content_length = end - start + 1
        self.send_response(206 if range_header else 200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", mimetypes.guess_type(audio_path.name)[0] or "application/octet-stream")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(content_length))
        if range_header:
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.end_headers()
        with audio_path.open("rb") as audio_file:
            audio_file.seek(start)
            remaining = content_length
            while remaining:
                chunk = audio_file.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def do_POST(self):
        if urlparse(self.path).path != "/audiobooks":
            self.send_response(404)
            self.end_headers()
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length))
            audiobook = library.get_or_create(payload["filename"], payload.get("title"))
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            self.send_json({"error": "filename is required"}, status=400)
            return

        self.send_json(audiobook.to_dict(), status=201)

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Python backend listening on port {server.server_address[1]}", flush=True)
    server.serve_forever()
