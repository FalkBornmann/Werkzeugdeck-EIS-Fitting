"""Build the standalone EIS-Fitting browser application."""
import re
from pathlib import Path
from shutil import copyfile

source = Path(__file__).resolve().parent
target = source / "dist"
target.mkdir(exist_ok=True)
html = (source / "index.html").read_text(encoding="utf-8")
if not re.search(r'<meta\b[^>]*name=["\']eis-runtime["\']', html, re.IGNORECASE):
    html = html.replace("<title>", '<meta name="eis-runtime" content="browser">\n<title>', 1)
(target / "index.html").write_text(html, encoding="utf-8")
for name in ("export-menu.js", "tool-theme.css", "fit-worker.js", "circuit-diagram.js", "circuit-presets.js", "circuit-editor.js", "graph-editor.js", "projection.js", "spectrum-preview.js", "examples.json", "fitting.py", "circuits.py"):
    copyfile(source / name, target / name)
