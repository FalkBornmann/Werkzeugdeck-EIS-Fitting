"""Regression: the runtime selector in JavaScript is not a meta element."""
from pathlib import Path
import subprocess
import sys
import unittest

class WebBuildTests(unittest.TestCase):
    def test_browser_build_contains_runtime_meta_and_assets(self):
        source = Path(__file__).resolve().parent
        subprocess.run([sys.executable, str(source / "build_web.py")], check=True)
        html = (source / "dist/index.html").read_text(encoding="utf-8")
        self.assertRegex(html, r'<meta name="eis-runtime" content="browser">')
        for name in ("export-menu.js", "tool-theme.css", "fit-worker.js", "circuit-diagram.js", "circuit-editor.js", "graph-editor.js", "projection.js", "spectrum-preview.js", "examples.json", "fitting.py", "circuits.py"):
            self.assertTrue((source / "dist" / name).is_file(), name)

if __name__ == "__main__":
    unittest.main()
