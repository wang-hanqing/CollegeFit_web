# CollegeFit data pipeline

Turns public raw data into the small files the web app loads. Nothing here touches student data.

```
data/raw/        ->  build_data.py  ->  data/processed/*.csv  ->  export_web.py  ->  web/data/*.json
Java messages    ->  convert_messages.py                      ->  i18n/en.json
```

## 1. Get the raw data (not stored in Git)

Put these files in `data/raw/`:

| File | Source |
| --- | --- |
| `Most-Recent-Cohorts-Institution.csv` | College Scorecard, https://collegescorecard.ed.gov/data/ |
| `Most-Recent-Cohorts-Field-of-Study.csv` | College Scorecard, same page |
| `CIP2020_SOC2018_Crosswalk.xlsx` | NCES, https://nces.ed.gov/ipeds/cipcode/resources.aspx?y=56 |
| `Career Interest Types.xlsx`, `Job Zones.xlsx` | O*NET database (Excel), https://www.onetcenter.org/database.html |

The O*NET files can sit directly in `data/raw/` or in the unzipped `data/raw/db_31_0_excel/` folder.
File names with spaces or underscores both work.

## 2. Run

From the project root, with the virtual environment active (`source .venv/bin/activate`):

```bash
pip install -r requirements.txt
python pipeline/build_data.py
python pipeline/export_web.py
python pipeline/convert_messages.py ../JAVA_CollegeFit/src/messages_en.properties
```

The last command only needs to run once: after that, `i18n/en.json` is edited directly.

## 3. Check

`build_data.py` uses the same rules as the Java version, so with the same raw files the outputs match it exactly:

| File | Rows (June 2026 release) |
| --- | --- |
| `colleges.csv` | 2,989 |
| `programs.csv` | 105,248 (2,960 colleges) |
| `interest_links.csv` | 1,548 |

`export_web.py` prints file sizes. The web data should stay under about 1 MB gzipped (June 2026: 920 KB).

## Scope rules

- Colleges: currently operating, not online-only, public or private nonprofit, mainly award certificates,
  associate or bachelor's degrees, highest degree associate or above, and at least one undergraduate.
- Programs: associate and bachelor's credentials at those colleges.
- Interest links: O*NET occupations in Job Zones 3 to 5 (excluding postsecondary teachers), linked to programs
  through the CIP-SOC crosswalk, kept only when the program exists in the Scorecard data.

## Yearly update

When a new College Scorecard release comes out: replace the two CSV files in `data/raw/`, run steps 2 and 3,
compare the new row counts with the old ones, update the release date in `help.data` in `i18n/en.json`, and commit
`data/processed/` and `web/data/` together.
