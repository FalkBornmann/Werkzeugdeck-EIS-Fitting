"""Build the standalone EIS-Fitting browser application."""
from pathlib import Path
from shutil import copyfile

source = Path(__file__).resolve().parent
target = source / "dist"
target.mkdir(exist_ok=True)
html = (source / "index.html").read_text(encoding="utf-8")
if 'name="eis-runtime"' not in html:
    html = html.replace("<title>", '<meta name="eis-runtime" content="browser">\n<title>', 1)
(target / "index.html").write_text(html, encoding="utf-8")
for name in ("fit-worker.js", "circuit-diagram.js", "circuit-editor.js", "fitting.py", "circuits.py"):
    copyfile(source / name, target / name)
