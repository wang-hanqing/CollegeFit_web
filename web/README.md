# CollegeFit web app

A static site: plain HTML, CSS and JavaScript modules, no build step, no server code.
Everything a student does stays in their browser.

## Preview on your computer

```bash
cd web
python3 -m http.server 8000
```

Open http://localhost:8000 in a browser. Opening `index.html` by double-clicking does not work,
because browsers block modules and data files loaded from `file://`.
Stop the server with Control + C.

## Structure

```
index.html        page shell; also sets a strict content security policy (no outside scripts, fonts or trackers)
css/app.css       design tokens at the top; logical properties only, so right-to-left works
fonts/            Rubik (OFL), split by script: Latin, Latin extended, Cyrillic, Arabic (also Dari)
js/config.js      languages, steps, data files
js/main.js        start-up, rendering, navigation, buttons
js/router.js      addresses like #/explore?lang=ar
js/state.js       the student's answers, saved links, reload protection
js/i18n.js        translations, text direction, number formatting
js/data.js        loads data/*.json and builds lookups
js/ui.js          header, sidebar (grade, steps, saved link), bottom bar, help
js/components.js  reusable choices: option cards, chips, error line, privacy note
js/views.js       which code shows each step; placeholders until a step is ported
js/steps/*.js     one file per step: render(), onChange(), onClick(), check(), pages()
js/logic/*.js     counting, ordering, lens results and comparisons, kept apart from the screen so they can be tested
data/             made by pipeline/export_web.py; do not edit by hand
i18n/en.json      English text, the source for every translation
i18n/<code>.json  translations; missing keys fall back to English
```

## Rules to keep

- **Privacy.** No accounts, no analytics, no outside requests. Answers live in memory, in `sessionStorage`
  (cleared when the tab closes, which matters on shared computers) and, only when a student asks,
  in a saved link after `#`, which browsers never send to the server.
- **Text.** Never write screen text in code. Add a key to `i18n/en.json` and call `t("key", value1, value2)`;
  placeholders are `{0}`, `{1}`.
- **Direction.** Use `inset-inline-start`, `margin-inline-end`, `padding-inline` and so on, never left/right.
  Icons that point forward or back get the class `directional` so they flip in Arabic and Dari.
- **Numbers.** Use `formatNumber` and `formatMoney` from `i18n.js`, not `toLocaleString`.

## Porting a step from Java

1. Create `js/steps/<step>.js` with `render(ctx)` and, if needed, `onChange(event, ctx)` and `check(answers)`.
2. Import it in `js/views.js` in place of the placeholder.
3. Reuse keys from `i18n/en.json`; shorten the English while porting and add new keys with a `web.` prefix.
4. Check the page in English and Arabic, on a phone-sized window.

## Tests against the Java version

From the project root (needs Node.js):

```bash
node tests/directions.test.mjs   # Step 2: fields, counts, two-year and four-year summary
node tests/explore.test.mjs      # Step 4: which colleges appear, their groups and their order
node tests/evaluate.test.mjs     # College details: every fact, label, reason and next step, word for word
node tests/compare.test.mjs      # Compare: markers, trade-off summary and degree levels, word for word
node tests/programs.test.mjs     # Program search list and college counts per state
```

Each compares the web version with a JSON file that a `tests/*Dump.java` program produced from the Java app's
own classes.

Where the web version is meant to differ from Java, the test checks only the shared part:
- Step 2 field cards: the web page lists every program in a field (five, then "Show all"); Java keeps the first
  three. The test compares the first three.

## Checking in the browser console

`CollegeFit` holds the current step, answers and loaded data, for example
`CollegeFit.data.colleges.length` or `CollegeFit.update({ kept: [190521] })`.
