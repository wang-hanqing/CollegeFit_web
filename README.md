# CollegeFit (web)

A free, private college exploration tool for newly arrived immigrant high school students,
built during an internship with the International Rescue Committee (IRC).
It helps students who are new to the U.S. college system explore options with public data
and narrow down to a short list they can explain and compare.

**Try it:** https://wang-hanqing.github.io/CollegeFit_web/

This is the web version of [CollegeFit (Java)](https://github.com/wang-hanqing/JAVA_CollegeFit),
rebuilt as a static site so students can open it on a phone with no installation.

## Design principles

- **No overall score.** Colleges are grouped by type and ordered by the student's own priorities.
- **Honest data.** Missing or differently measured numbers are labeled, never ranked as if comparable.
  Degree counts describe program size, not quality.
- **Private by design.** No accounts, no tracking, no data sent anywhere. Answers stay in the browser
  and are cleared when the tab closes.
- **For every student.** Nine languages planned, including Arabic and Dari (right to left).

## How it works

```
pipeline/   Python: public raw data -> data/processed/*.csv -> web/data/*.json
web/        the site: HTML, CSS and JavaScript modules, no build step
tests/      checks that the web version gives the same results as the Java version
```

See `pipeline/README.md` and `web/README.md` for details. Each push to `main` runs the tests and,
if they pass, publishes `web/` to GitHub Pages.

## Data

- U.S. Department of Education, College Scorecard (institution and field-of-study data)
- U.S. Department of Labor, O\*NET database (CC BY 4.0)
- NCES and BLS, CIP 2020 to SOC 2018 crosswalk

Historical, school-level data. Not an admission prediction or a financial aid offer.

## Future data enrichment

Ideas that need a new data source. Not built yet; each should follow the design principles above.

### Careers shown for a field ("I'm not sure yet" path, Step 2)

**Now.** Each field card shows three careers linked to the student's interests. They are the careers that the
CIP-SOC crosswalk links to the most programs in that field (then the lower Job Zone, then the title). This favors
broad roles that many programs lead to, such as Regulatory Affairs Managers in Business, rather than the careers
students are most likely to know or find work in.

**Idea.** Add employment counts from the BLS Occupational Employment and Wage Statistics (OEWS) program and show the
careers with the most workers, in the student's state when available, otherwise nationally (for example, Accountants
and Auditors, or General and Operations Managers, in Business).

**To decide before building:**
- State or national counts (state counts are missing for some small occupations)
- Whether to show the number of workers on the card, or use it only for the order
- How to word it so it describes how common a job is, not how good or how well paid it is
- Add the year to Help, "About the data", like the other sources
