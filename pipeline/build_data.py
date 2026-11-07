"""
Step 1 of the CollegeFit data pipeline: raw files -> data/processed/*.csv

Same rules as the Java version (notebooks 03_export and 04_interests in JAVA_CollegeFit),
so the processed files should match row for row.

Inputs (data/raw/):
  Most-Recent-Cohorts-Institution.csv        College Scorecard, institution level
  Most-Recent-Cohorts-Field-of-Study.csv     College Scorecard, field of study
  CIP2020_SOC2018_Crosswalk.xlsx             NCES/BLS program-to-career crosswalk
  Career Interest Types.xlsx, Job Zones.xlsx O*NET database (in data/raw/ or data/raw/db_*_excel/)

Outputs (data/processed/):
  colleges.csv, programs.csv, interest_links.csv

Run from the project root:  python pipeline/build_data.py
"""
from pathlib import Path
import sys

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"

MISSING = ["NA", "PS", "NULL", "PrivacySuppressed"]


def find_file(*names):
    """Look for a raw file in data/raw/ and any O*NET folder inside it.
    Accepts both 'Job Zones.xlsx' and 'Job_Zones.xlsx' spellings."""
    candidates = []
    for name in names:
        candidates += [name, name.replace(" ", "_")]
    folders = [RAW] + sorted(p for p in RAW.glob("db_*") if p.is_dir())
    for folder in folders:
        for name in candidates:
            if (folder / name).exists():
                return folder / name
    sys.exit(f"Missing raw file: {names[0]} (looked in {', '.join(str(f) for f in folders)})")


def clean_url(u):
    u = u.strip()
    if u == "":
        return u
    if not u.lower().startswith(("http://", "https://")):
        u = "https://" + u
    return u.replace(" ", "%20")


def build_colleges():
    inst = pd.read_csv(find_file("Most-Recent-Cohorts-Institution.csv"), dtype=str,
                       keep_default_na=False, low_memory=False)

    scope = inst[(inst["CURROPER"] == "1")                 # currently operating
                 & (inst["DISTANCEONLY"] != "1")           # not online-only
                 & (inst["CONTROL"].isin(["1", "2"]))      # public or private nonprofit
                 & (inst["PREDDEG"].isin(["1", "2", "3"]))
                 & (inst["HIGHDEG"].isin(["2", "3", "4"]))
                 & (inst["UGDS"] != "0")].copy()

    keep = ["UNITID", "INSTNM", "CITY", "STABBR", "CONTROL", "PREDDEG", "HIGHDEG",
            "INSTURL", "NPCURL",
            "OPENADMP", "ADM_RATE", "ADMCON7",
            "SATVR25", "SATVR75", "SATMT25", "SATMT75", "ACTCM25", "ACTCM75",
            "COSTT4_A", "TUITIONFEE_IN", "TUITIONFEE_OUT",
            "LOCALE", "REGION", "UGDS", "LATITUDE", "LONGITUDE",
            "C150_4", "C150_L4", "TRANS_4", "TRANS_L4", "STUFACR"]
    colleges = scope[keep].copy()

    # Net price: publics use the _PUB column, privates the _PRIV column
    public = scope["CONTROL"] == "1"
    colleges["NPT4"] = scope["NPT4_PUB"].where(public, scope["NPT4_PRIV"])
    for i in range(1, 6):
        colleges[f"NPT4{i}"] = scope[f"NPT4{i}_PUB"].where(public, scope[f"NPT4{i}_PRIV"])

    # Same column order as the Java version: net price columns right after LONGITUDE
    npt = ["NPT4"] + [f"NPT4{i}" for i in range(1, 6)]
    cols = [c for c in colleges.columns if c not in npt]
    at = cols.index("LONGITUDE") + 1
    colleges = colleges[cols[:at] + npt + cols[at:]]

    colleges = colleges.replace(MISSING, "")             # one missing convention: empty string
    for c in ["INSTURL", "NPCURL"]:
        colleges[c] = colleges[c].map(clean_url)
    return colleges


def build_programs(colleges):
    fos = pd.read_csv(find_file("Most-Recent-Cohorts-Field-of-Study.csv"), dtype=str,
                      keep_default_na=False,
                      usecols=["UNITID", "CIPCODE", "CIPDESC", "CREDLEV",
                               "IPEDSCOUNT1", "IPEDSCOUNT2", "EARN_MDN_1YR"])
    programs = fos[(fos["UNITID"] != "NA")
                   & (fos["CREDLEV"].isin(["2", "3"]))      # associate and bachelor's
                   & (fos["UNITID"].isin(colleges["UNITID"]))].replace(MISSING, "")
    return programs


def build_interest_links(programs):
    # 1. O*NET: first career interest type (RIASEC) and Job Zone of each occupation
    types = {1: "R", 2: "I", 3: "A", 4: "S", 5: "E", 6: "C"}
    ci = pd.read_excel(find_file("Career Interest Types.xlsx"))
    first = ci[ci["Element Name"] == "First Interest High-Point"][["O*NET-SOC Code", "Data Value"]].copy()
    first["INTEREST"] = first["Data Value"].round().astype(int).map(types)
    zones = pd.read_excel(find_file("Job Zones.xlsx"))[["O*NET-SOC Code", "Title", "Job Zone"]]
    occ = zones.merge(first[["O*NET-SOC Code", "INTEREST"]], on="O*NET-SOC Code")
    occ = occ[occ["Job Zone"].isin([3, 4, 5])].copy()   # associate / bachelor's / graduate school
    occ["SOC"] = occ["O*NET-SOC Code"].str[:7]

    # One row per 6-digit SOC; keep the broad ".00" title when there is one
    occ = occ.sort_values("O*NET-SOC Code").groupby("SOC", as_index=False).first()
    occ = occ[~occ["SOC"].str.startswith("25-1")]       # postsecondary teachers link to almost every field

    # 2. NCES/BLS crosswalk: occupation (SOC 2018) -> program (CIP 2020)
    cw = pd.read_excel(find_file("CIP2020_SOC2018_Crosswalk.xlsx"), sheet_name="SOC-CIP", dtype=str)
    cw = cw[cw["CIP2020Code"] != "99.9999"].copy()
    cw["CIP6"] = cw["CIP2020Code"]
    cw["CIP4"] = cw["CIP6"].str.replace(".", "", regex=False).str[:4]
    links = occ.merge(cw[["SOC2018Code", "CIP6", "CIP4"]], left_on="SOC", right_on="SOC2018Code")
    links["FAMILY"] = links["CIP4"].str[:2]

    # 3. Keep programs that exist in the Scorecard program file
    known = set(programs["CIPCODE"].str.zfill(4))
    links = links[links["CIP4"].isin(known)].copy()

    # How closely a career is tied to a field: number of 6-digit programs in that field linked to it
    links["CIP6_LINKS"] = links.groupby(["SOC", "FAMILY"])["CIP6"].transform("nunique")
    return (links[["INTEREST", "FAMILY", "SOC", "Title", "Job Zone", "CIP6_LINKS", "CIP4"]]
            .drop_duplicates()
            .rename(columns={"Title": "TITLE", "Job Zone": "JOB_ZONE"})
            .sort_values(["INTEREST", "FAMILY", "SOC", "CIP4"]))


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    colleges = build_colleges()
    colleges.to_csv(OUT / "colleges.csv", index=False)
    print(f"colleges.csv        {len(colleges):>7,} rows")

    programs = build_programs(colleges)
    programs.to_csv(OUT / "programs.csv", index=False)
    print(f"programs.csv        {len(programs):>7,} rows, {programs['UNITID'].nunique():,} colleges")

    links = build_interest_links(programs)
    links.to_csv(OUT / "interest_links.csv", index=False)
    print(f"interest_links.csv  {len(links):>7,} rows")

    leftover = colleges.isin(["NA", "PS"]).sum().sum()
    if leftover:
        print(f"Warning: {leftover} NA/PS values left in colleges.csv")


if __name__ == "__main__":
    main()
