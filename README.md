<p align="center">
  <img src="src/app/assets/bjcpid-logo-transparent.png" alt="BJCPid logo" width="180">
</p>

<h1 align="center">BJCPid</h1>

<p align="center">
  <strong>Boston Wort Processors Present</strong><br>
  A local-first BJCP beer style matching tool for tasting notes and scoresheet-style sensory evidence.
</p>

<p align="center">
  <a href="https://wort.org"><strong>Learn more about the Boston Wort Processors at wort.org</strong></a>
</p>

BJCPid is a browser-based study and feedback aid for identifying plausible
BJCP beer styles from tasting notes. Enter sensory evidence in a guided
scoresheet or free-note format, then run a deterministic local matcher against
the bundled BJCP 2021 beer style archive.

The app runs entirely in the browser after the page loads. Tasting notes are
not sent to a server by this application.

> [!IMPORTANT]
> **This project is vibecoded.** The initial application, parser, matcher,
> interface, tests, and documentation were produced through an AI-assisted
> conversation with OpenAI Codex, directed and reviewed by the repository owner.
> It has automated tests and has been reviewed for public release, but it should
> not be treated as professionally audited judging, competition, or production
> software. See [AI_DISCLOSURE.md](AI_DISCLOSURE.md) for the full disclosure.

## About the Boston Wort Processors

The [Boston Wort Processors](https://wort.org) are a Boston-area homebrew club
founded in 1984. The club brings brewers together through meetings, education,
competitions, shared resources, and community events.

Visit [wort.org](https://wort.org) to learn about the club, membership,
upcoming events, educational resources, and homebrewing activities.

## What it does

- Provides guided BJCP scoresheet inputs for aroma, appearance, flavor,
  mouthfeel, overall impression, and specialty notes.
- Supports a free-note mode for pasted or loosely structured tasting notes.
- Extracts simple sensory descriptors such as color, clarity, bitterness,
  sweetness, body, carbonation, malt character, hop character, fermentation
  character, acidity, roast, smoke, wood, barrel, and common faults.
- Tracks simple negations such as `no diacetyl` or `without smoke`.
- Ranks plausible BJCP styles with a deterministic local matcher.
- Shows matched evidence, conflicts, missing evidence, fit score, support
  score, and evidence completeness.
- Lets you add target styles to compare intended styles against the ranked
  candidates.
- Displays bundled BJCP style write-ups with local evidence highlights.
- Copies a diagnostic JSON payload that can be used when reporting matcher
  feedback.

## Data Source

The bundled style archive was generated from the official BJCP 2021 beer style
Markdown pages:

- Source index: <https://styles.bjcp.org/bjcp-2021-beer/>
- Edition: BJCP Beer Style Guidelines 2021, version 1.25

The local archive is included so the app can run without a backend. Guideline
text remains copyright Beer Judge Certification Program, Inc. and is used here
for educational and study purposes. The most current master version can be
found at <https://www.bjcp.org>.

To rebuild the local archive from the official Markdown pages:

```bash
npm run import:bjcp
```

## Requirements

- Node.js 20 or newer
- npm
- A modern web browser
- Internet access only when installing dependencies or rebuilding the BJCP data
  archive

No database, account, credentials, API keys, or hosted service are required.

## Run Locally

Clone the repository:

```bash
git clone https://github.com/vincemancuso/bjcpid.git
cd bjcpid
```

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Open the local URL printed by Vite, usually <http://localhost:5173>.

Stop the server with `Ctrl+C`.

## Development and Tests

Run the test suite:

```bash
npm test
```

Build the production bundle:

```bash
npm run build
```

The suite covers:

- BJCP style data loading;
- full guideline archive availability;
- descriptor qualification for supported, optional, required, and prohibited
  traits;
- parser handling for sectioned text, inferred sections, descriptors, and
  simple negation;
- matcher ranking, confidence, specialty-style handling, color conflicts,
  scale-distance scoring, and required hallmark checks.

## Project Structure

```text
src/app/                         React interface and CSS
src/app/assets/                  Runtime logo asset
src/data/bjcp/2021-1.25/         Bundled BJCP style archive
src/domain/bjcp/                 BJCP data types and descriptor qualification
src/domain/matching/             Deterministic style matcher
src/domain/tasting/              Tasting profile types
src/parsing/                     Rule-based tasting-note parser
scripts/importOfficialBjcpGuidelines.mjs
                                  Official BJCP Markdown import script
tests/                           Parser and matcher tests
public/favicon.png               Browser favicon
```

## How Matching Works

BJCPid does not use a language model at runtime. It parses supplied tasting
evidence into a structured profile, compares that profile with local BJCP style
data, and ranks the top candidates with fixed scoring rules.

Scores are intended to be explainable rather than authoritative. The matcher
rewards direct evidence, softens weak or optional evidence, penalizes conflicts,
and limits confidence when notes are sparse.

## Known Limitations

- The parser is intentionally simple and can miss nuance, sarcasm, unusual
  phrasing, or complex negation.
- A high score means the supplied evidence fits a style; it does not prove the
  beer was brewed to that style.
- Specialty styles still require human judgment about declared ingredients,
  base style, and competition entry instructions.
- The bundled BJCP archive may lag future BJCP updates until regenerated.
- Browser datalist behavior differs slightly across browsers.
- The tool is intended for local study and feedback, not as a competition
  judging authority.

## Privacy Notes

BJCPid is a static Vite/React app. It does not include analytics, a backend, or
external API calls for tasting notes. Clipboard access is used only when you
click the copy button.

## Affiliation Disclaimer

BJCP and Beer Judge Certification Program names identify the public style
guideline source. This project is not affiliated with, endorsed by, or
maintained by the Beer Judge Certification Program.

Boston Wort Processors credit is included with appreciation for the club and
its homebrewing community. The repository is maintained independently.
