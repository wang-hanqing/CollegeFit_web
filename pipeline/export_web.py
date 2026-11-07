"""
Step 2 of the CollegeFit data pipeline: data/processed/*.csv -> web/data/*.json

The browser loads these files directly, so they are kept small:
  - each table is stored as {"fields": [...], "rows": [[...], ...]} instead of repeating keys
  - numbers are real numbers, missing values are null
  - program names are stored once in cip.json instead of on every program row

Outputs (web/data/):
  colleges.json        one row per college
  programs.json        one row per college x program x credential level
  cip.json             program code -> program name
  interest_links.json  interest type -> career -> program family
  meta.json            sources, build date and row counts

Run from the project root:  python pipeline/export_web.py
"""
from datetime import date
from pathlib import Path
import gzip
import json

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PROCESSED = ROOT / "data" / "processed"
OUT = ROOT / "web" / "data"

# Columns that look numeric but must stay text (codes with leading zeros, names, links)
TEXT_COLUMNS = {"INSTNM", "CITY", "STABBR", "INSTURL", "NPCURL",
                "CIPCODE", "CIPDESC", "INTEREST", "FAMILY", "SOC", "TITLE", "CIP4"}

SOURCES = [
    "U.S. Department of Education, College Scorecard (Most Recent Institution-Level and Field-of-Study data)",
    "U.S. Department of Labor, O*NET database (CC BY 4.0)",
    "NCES and BLS, CIP 2020 to SOC 2018 crosswalk",
]


def to_value(v, column):
    if v == "":
        return None
    if column in TEXT_COLUMNS:
        return v
    number = float(v)
    return int(number) if number.is_integer() else number


def table(df):
    fields = list(df.columns)
    rows = [[to_value(v, c) for v, c in zip(row, fields)] for row in df.itertuples(index=False)]
    return {"fields": fields, "rows": rows}


def write_json(name, data):
    path = OUT / name
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8")), len(gzip.compress(text.encode("utf-8"), 9))


def read(name):
    return pd.read_csv(PROCESSED / name, dtype=str, keep_default_na=False)


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    colleges = read("colleges.csv")
    programs = read("programs.csv")
    links = read("interest_links.csv")

    # Program names once, keyed by code
    cip = (programs[["CIPCODE", "CIPDESC"]].drop_duplicates("CIPCODE")
           .assign(CIPDESC=lambda d: d["CIPDESC"].str.rstrip("."))
           .set_index("CIPCODE")["CIPDESC"].sort_index().to_dict())
    programs = programs.drop(columns="CIPDESC")

    meta = {
        "built": date.today().isoformat(),
        "sources": SOURCES,
        "counts": {"colleges": len(colleges), "programs": len(programs),
                   "program_codes": len(cip), "interest_links": len(links)},
    }

    outputs = {
        "colleges.json": table(colleges),
        "programs.json": table(programs),
        "cip.json": cip,
        "interest_links.json": table(links),
        "meta.json": meta,
    }

    total_raw = total_gz = 0
    print(f"{'file':<22}{'size':>10}{'gzipped':>10}")
    for name, data in outputs.items():
        raw, gz = write_json(name, data)
        total_raw += raw
        total_gz += gz
        print(f"{name:<22}{raw / 1024:>8.0f}KB{gz / 1024:>8.0f}KB")
    print(f"{'total':<22}{total_raw / 1024:>8.0f}KB{total_gz / 1024:>8.0f}KB")


if __name__ == "__main__":
    main()
