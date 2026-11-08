import argparse
import json
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from fitting import analyze, demo, fit, load_spectrum, select_models, spectrum


class Handler(BaseHTTPRequestHandler):
    def send(self, body, content_type, status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        assets = {
            "/": ("index.html", "text/html; charset=utf-8"),
            "/export-menu.js": ("export-menu.js", "text/javascript; charset=utf-8"),
            "/tool-theme.css": ("tool-theme.css", "text/css; charset=utf-8"),
            "/fit-worker.js": ("fit-worker.js", "text/javascript; charset=utf-8"),
            "/circuit-diagram.js": ("circuit-diagram.js", "text/javascript; charset=utf-8"),
            "/circuit-editor.js": ("circuit-editor.js", "text/javascript; charset=utf-8"),
            "/fitting.py": ("fitting.py", "text/plain; charset=utf-8"),
            "/circuits.py": ("circuits.py", "text/plain; charset=utf-8"),
            "/projection.js": ("projection.js", "text/javascript; charset=utf-8"),
            "/spectrum-preview.js": ("spectrum-preview.js", "text/javascript; charset=utf-8"),
            "/graph-editor.js": ("graph-editor.js", "text/javascript; charset=utf-8"),
            "/examples.json": ("examples.json", "application/json; charset=utf-8"),
        }
        if self.path not in assets:
            self.send_error(404)
            return
        name, mime = assets[self.path]
        self.send(Path(__file__).with_name(name).read_bytes(), mime)

    def do_POST(self):
        if self.path not in ("/fit", "/demo"):
            self.send_error(404)
            return
        try:
            size = int(self.headers.get("Content-Length", 0))
            if not 0 <= size <= 2_000_000:
                raise ValueError("Datei zu groß (maximal 2 MB).")
            data = self.rfile.read(size)
            components = self.headers.get("X-Components", "R,C,Q")
            if "X-Element-Limit" in self.headers:
                topology = json.loads(self.headers["X-Circuit"]) if "X-Circuit" in self.headers else None
                result = analyze(data, self.headers.get("X-Spectrum-Type"), components,
                                 int(self.headers["X-Element-Limit"]), self.path == "/demo", topology)
            else:
                f, z = demo() if self.path == "/demo" else load_spectrum(data, self.headers.get("X-Spectrum-Type"))
                models = select_models(components, int(self.headers.get("X-Parameter-Limit", 7)))
                fits = sorted((fit(kind, f, z) for kind in models), key=lambda item: item["aicc"])
                result = dict(f=f.tolist(), real=z.real.tolist(), imag=z.imag.tolist(), fits=fits)
            self.send(json.dumps(result, allow_nan=False).encode(), "application/json")
        except (ValueError, TypeError, UnicodeError) as exc:
            self.send(json.dumps({"error": str(exc)}).encode(), "application/json", 400)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--open", action="store_true", help="Startseite im Standardbrowser öffnen")
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), Handler) as server:
        url = f"http://127.0.0.1:{server.server_port}/"
        print(f"EIS Fit läuft unter {url}", flush=True)
        if args.open:
            webbrowser.open(url)
        server.serve_forever()
