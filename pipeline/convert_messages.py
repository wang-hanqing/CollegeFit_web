"""
Step 3: Java screen text -> i18n/en.json (the source file for all translations)

Reads messages_en.properties from the Java version and writes:
  i18n/en.json          key -> English text, in the original order
  i18n/en.context.json  key -> section and comments, to help translators and reviewers

Placeholders change from Java's %s to numbered {0}, {1}, ... so that translations
can put them in a different order. A literal %% becomes %.

Run from the project root:
  python pipeline/convert_messages.py path/to/JAVA_CollegeFit/src/messages_en.properties
"""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "i18n"

SECTION = re.compile(r"^#\s*-+\s*(.+?)\s*-+\s*$")
ESCAPES = {"n": "\n", "t": "\t", "\\": "\\", "=": "=", ":": ":", " ": " ", "#": "#", "!": "!"}


def unescape(value):
    return re.sub(r"\\(.)", lambda m: ESCAPES.get(m.group(1), m.group(1)), value)


def convert_placeholders(value):
    if "%s" not in value:
        return value
    counter = iter(range(1000))
    value = re.sub(r"%s", lambda m: "{" + str(next(counter)) + "}", value)
    return value.replace("%%", "%")


def parse(path):
    messages, context = {}, {}
    section, comments = "", []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped:
            comments = []
            continue
        if stripped.startswith(("#", "!")):
            match = SECTION.match(stripped)
            if match:
                section, comments = match.group(1), []
            else:
                comments.append(stripped.lstrip("#! ").strip())
            continue
        key, _, value = stripped.partition("=")
        key = key.strip()
        if key in messages:
            print(f"Warning: duplicate key {key}")
        messages[key] = convert_placeholders(unescape(value.strip()))
        context[key] = {"section": section}
        if comments:
            context[key]["note"] = " ".join(comments)
    return messages, context


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source = Path(sys.argv[1])
    messages, context = parse(source)

    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in [("en.json", messages), ("en.context.json", context)]:
        (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    words = sum(len(re.findall(r"[A-Za-z']+", v)) for v in messages.values())
    with_placeholders = sum("{0}" in v for v in messages.values())
    print(f"en.json: {len(messages)} texts, about {words:,} words, {with_placeholders} with placeholders")


if __name__ == "__main__":
    main()
