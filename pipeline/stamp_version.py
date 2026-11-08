"""
Marks every file of the published site with a version, so browsers load a matching set after an update.

GitHub Pages lets browsers keep files for up to 10 minutes. Without a version, a student could get the new
index.html with old scripts, or old data with new code. This adds ?v=<version> to the stylesheet, every
JavaScript import, and (through VERSION in js/config.js) every data and translation file.

Used by .github/workflows/pages.yml on a copy of web/; the files in the repository stay unchanged.
    python pipeline/stamp_version.py <site folder> <version>
"""
from pathlib import Path
import re
import sys


def stamp(site: Path, version: str) -> None:
    index = site / "index.html"
    html = index.read_text(encoding="utf-8")
    html = re.sub(r'(href="css/[^"?]+\.css)"', rf'\1?v={version}"', html)
    html = re.sub(r'(src="js/[^"?]+\.js)"', rf'\1?v={version}"', html)
    index.write_text(html, encoding="utf-8")

    changed = 0
    for script in (site / "js").rglob("*.js"):
        code = script.read_text(encoding="utf-8")
        # import ... from "./x.js"  and  import "./x.js"
        new = re.sub(r'''((?:from|import)\s+["'])(\.{1,2}/[^"'?]+\.js)(["'])''', rf'\1\2?v={version}\3', code)
        if script.name == "config.js":
            new = new.replace('export const VERSION = "dev";', f'export const VERSION = "{version}";')
        if new != code:
            script.write_text(new, encoding="utf-8")
            changed += 1
    print(f"Stamped version {version}: index.html and {changed} scripts")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    stamp(Path(sys.argv[1]), sys.argv[2])
