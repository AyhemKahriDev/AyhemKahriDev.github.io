# How a game gets into the catalogue

The catalogue is 253 games. Ten are hand-written engine games; the other 243 are
third-party repositories vendored into `third-party/` and published from
`content/harvest-published.json`. This page covers the second path: how a
repository on GitHub becomes a page on the site, what it costs, and where the
pipeline keeps its state.

The code lives in `scripts/harvest-games.mjs` (the four-phase driver) and
`scripts/harvest/` (the modules it calls). Everything below is behaviour of those
files, not a description of an older version.

---

## The path, in order

```
GitHub search  ->  candidates.json  ->  preflight  ->  vendor + prune  ->  browser gate  ->  import  ->  build
```

**1. Candidate** — `scripts/harvest/queries.mjs` holds 124 distinct queries in 8
genre families (`arcade`, `puzzle`, `word`, `action`, `board`, `racing`,
`strategy`, `sandbox`). The sweep crosses each query with the 9 licences in
`SEARCH_LICENCES` and asks GitHub's repository search for 100 results a page.
`filters.mjs` then answers one question per result — `rejectReason()` returns a
string, and only an empty string is accepted:

- an `owner/name`, a licence id on the 13-entry allowlist (MIT, Apache-2.0,
  BSD-2/3-Clause, ISC, CC0-1.0, Unlicense, 0BSD, GPL-2.0/3.0, LGPL-2.1/3.0,
  MPL-2.0 — AGPL is deliberately absent), a non-zero size under 6 MB, at least
  `HARVEST_MIN_STARS`;
- a *strong* game word in the name or description (`tetris`, `solitaire`,
  `nonogram`, `tower defense`, …). A bare "game" is not enough;
- nothing that marks it as a library, tutorial, course, portfolio or template;
- nothing from the `HARDWARE` pattern: `esp8266`, `esp32`, `arduino`, `raspberry
  pi`, `neopixel`, `firmware`, `microcontroller`, `stm32`, `atmega`,
  `platformio`, `wordclock`, `led matrix`, `fpga`. Firmware projects advertise
  the games they run — "Pong and Tetris on a 32×8 matrix" is a hardware
  repository, and there is nothing on the site to play. The importer repeats this
  test on the way in, because a repository's description can change after it was
  swept.

Repositories on `content/blocked.json` (14 of them) are dropped here, before any
download, so a hand-rejected repo costs nothing on the next sweep.

**2. Preflight** — one `GET /repos/{repo}/git/trees/{branch}?recursive=1` call
answers "can this be served as a page?" for the whole repository.
`scripts/harvest/entry.mjs` then ranks every `.html` in that tree and returns the
best one: root `index.html` (100), `dist/` (90), `build/` (88), `public/` (86),
`docs/` (84 — the GitHub Pages convention), `game|games|src|www|app|play/` (80),
any other `index.html` three directories deep or fewer (60, +5 when a `.js` sits
beside it), and a lone root `game.html` (40). `tests/`, `examples/`, `demo/`,
`node_modules/` and documentation-site output are never candidates.

The entry path is carried in the verdict, so vendor, validate and import all
address the same file. Verdicts are cached in `.harvest/preflight.json` and
written after every new one — a run killed half way through does not pay for the
same lookups again.

**3. Vendor and prune** — the tarball comes from
`codeload.github.com/<repo>/tar.gz` (not the API, so it does not spend the core
budget), extracted to a per-repo temp directory, and copied into
`third-party/<slug>/`. Refusals at this step: an archive under 2 kB or over 25 MB,
a download that times out after 180 s, no entry HTML after extraction, or an entry
that did not survive the prune. `prune-vendored.mjs` runs *before* the copy
reaches git: `.apk`, `.psd`, `.map`, `.yml`, platform project trees and any media
file over 1 MB whose name appears in no HTML/JS/CSS in the same game. `docs/` is
never pruned — many games publish from there. The game keeps its `LICENSE` and
gains an `ARCADEFORK-NOTICE.md` naming the repository, the author and the licence.

**4. Browser gate** — `validate.mjs` opens every vendored entry in headless
Chrome, `--workers` pages at a time (6 by default), serving the working tree from
`scripts/serve-root.mjs` on port 4191. Each page gets 2,200 ms to settle, then
`judgeGame()` from `scripts/embed-health.mjs` looks at the same evidence the
post-build audit looks at: status code, failed same-origin requests, JS errors,
painted pixels, controls, text. Pass, `dead` or `inconclusive`. A `dead` game is
deleted from `third-party/` on the spot; an `inconclusive` one (a browser that
died) is kept for the next run. Nothing is ever appended to `content/blocked.json`
automatically — that list is a human decision.

**5. Import** — `import.mjs` is the only place a repository becomes a published
game, and it enforces the rules a 500-game catalogue needs:

- no passing verdict, no page;
- one page per title: `dedupeByTitle()` keeps the richest of each fold
  (`"The Snake: Reloaded"` and `"snake reloaded!"` are the same game, and a title
  may repeat at most 3 times);
- `--caps` games per genre family (80 when the batch driver runs it, 40 is the
  importer's default), so snake and tetris cannot become the whole site;
- `--budget` new pages per run.

Copy and category are derived, not scraped: `copy.mjs` turns the repository name,
description and README into a title, tagline, description, three controls and two
questions from a fixed vocabulary, and refuses to emit developer jargon;
`category.mjs` maps the genre family onto one of the 9 catalogue categories.
Same input, same output — no clock, no randomness, so a rebuild does not churn the
catalogue. All of it is written to `content/harvest-published.json`, which is
machine-owned.

**6. Build** — the batch driver does *not* build. `npm run build` copies only the
`third-party/` directories the merged catalogue references, prunes them again,
sanitises each page (strips meta refresh, forces `target="_top"`, adds
`rel="noopener"`), and then the gates run. A harvest in progress therefore cannot
publish a game that has not passed the browser gate.

---

## The four knobs that cost something

| Knob | Default | What it changes | What it costs |
|---|---|---|---|
| `HARVEST_FAMILY` | all 8 | Which genre slices the sweep walks, comma-separated (`arcade,puzzle`) or `--family` | API calls and wall time. `arcade` alone is 20 queries × 9 licences; at `HARVEST_PAGES=10` its ceiling is 1,800 calls, about 63 minutes at 2.1 s each. Dropping to one family is the cheapest way to test a query change. |
| `HARVEST_LIMIT` | 0 (no cap) | Maximum repositories to *vendor* in this run. Repositories already on disk do not count against it | Wall time and bandwidth only — no API calls. A 250-repo round is 250 tarball downloads plus at least one preflight call each. |
| `HARVEST_CONCURRENCY` | 6 (max 32) | Parallel downloads in the vendor phase | Nothing in API terms; more sockets and more disk. Nothing in the repository measures the best value — 6 to 8 is the range the defaults use. |
| `HARVEST_MIN_STARS` | 2 (`stars:>=2`; `0` means `stars:>=0`) | Star floor pushed into every search query | Free, but it decides the supply. The floor used to be a hard-coded `stars:>2`, which excluded the long tail where most small open-source games live. Lowering it finds more candidates and more junk — the browser gate, not popularity, is what should reject them. |

`HARVEST_TARGET`, `HARVEST_PAGES` and `HARVEST_CALLS` also exist and bound the
sweep itself: stop once there are enough candidates, how deep to page, and a hard
ceiling on search calls. Set at least one of them — an unbounded sweep is hours.

---

## The API budget

GitHub allows **30 search requests a minute** and **5,000 core requests an hour**
for an authenticated token. `gh api rate_limit` reports both for the token in use,
which is the only way to know which budget a run is spending:

```bash
$ gh api rate_limit --jq '{core: .resources.core, search: .resources.search}'
{"core":{"limit":5000,...},"search":{"limit":30,...}}
```

The sweep sleeps 2.1 s between search calls, which keeps a long run just under
30 a minute instead of spending its budget waiting for a reset. An empty response
is read as "rate limited", not "no results": `ghSearch()` asks `rate_limit` for the
reset time and retries up to four times. That detail is why an earlier run
collected 144 candidates out of a 1,600 target and still looked successful.

**Genre slices run sequentially, deliberately.** The 30/minute cap is shared by
the whole run, so parallel families would not go faster — they would queue against
the same window and burn their retries. One family at a time also makes the
progress line readable and a slice's cost attributable. It prints
`sweep: <calls> calls, <n> candidates (<query> / <licence> / p<page>)` every 25
calls. At the default `HARVEST_PAGES=10` the ceiling for all eight families is
11,160 calls — 6.5 hours at 2.1 s, and the 30/minute cap alone would not allow
less than 6.2.

Preflight is the other consumer: one tree call per repository, cached forever, so a
250-repo round is at least 250 core calls against the 5,000/hour budget (more when
a repository has no branch argument and the fallback contents listing has to walk
its directories). The tarballs come from `codeload`, which does not count.

---

## Running a batch

```bash
node scripts/harvest/batch.mjs --target 500 --batch 250
```

The driver repeats `vendor → validate → import` for at most 12 rounds, passing
`HARVEST_LIMIT=<batch>`, `HARVEST_CONCURRENCY=8`, `--workers=6` and
`--caps=80 --budget=<target>` down to each phase. It stops when
`content/harvest-published.json` reaches the target, or when a whole round adds
nothing — at which point the honest answer is that the current queries are
exhausted, not that the script should be run again.

It never builds and never runs a gate, so it cannot publish a half-validated
catalogue. After it finishes:

```bash
npm test && npm run build && npm run audit && npm run smoke
```

One phase at a time, when you want to watch a single step:

```bash
node scripts/harvest-games.mjs sweep      # search only, writes .harvest/candidates.json
node scripts/harvest-games.mjs vendor     # download + prune
node scripts/harvest/validate.mjs --workers 6 --verbose
node scripts/harvest/import.mjs --caps 80 --budget 500
```

### Resuming

Every phase checkpoints, so a killed run resumes rather than restarts:

- **sweep** keeps `candidates.json` and checkpoints every 50 calls. Repositories
  already in `third-party/`, already on the block list and already in
  `skipped.json` are not re-added.
- **vendor** skips any slug that already has `.harvested.json` — no re-download —
  and `HARVEST_LIMIT` counts only repositories still pending.
- **validate** skips any `.harvested.json` with `validated: true`, and rewrites
  `validated.json` atomically after every verdict, so a crash loses at most the
  pages that were open.
- **import** is pure and idempotent: it rebuilds `content/harvest-published.json`
  from the reports every time.

---

## What gets rejected, and why

| Rejection | Where | Reason |
|---|---|---|
| No licence, or a licence not on the allowlist | sweep (`filters.mjs`) and preflight | We ship the code; without terms we cannot. AGPL is excluded on purpose — it carries obligations for network-served modifications this project will not take on. |
| No usable HTML entry within 3 directories | preflight (`entry.mjs`), reported as `no root index.html and no nested entry (no usable html entry within 3 directories)` | A repository with no page to open is not a game. The old rule demanded `index.html` at the root and refused 181 of 212 candidates; the entry is discovered now, but a game buried four directories down is usually a demo inside a larger project. |
| Hardware or firmware | sweep (`HARDWARE`) and import | A firmware project advertises the games it runs — an ESP8266 word clock that lists "Pong, Tetris and Snake" is a repository with a web UI and no game. The importer repeats the test, so a description edited after the sweep cannot get in that way. |
| Looks like a library, course, template or portfolio | sweep (`SKIP_WORDS`, `NAME_REJECT`) | `html5-game-engine` is the engine, not a game. The repository *name* is held to a stricter rule than the description, because a real game may mention a tutorial it followed. |
| Too large | sweep (6 MB) and vendor (25 MB archive) | A repository that size is not a browser game; it is a game plus its art pipeline, or a Unity project. |
| Dead page | validate, then `audit:health` | The browser gate deletes it. `audit:health` re-checks the exact `embed.src` the catalogue publishes, which is not always the file the validator opened. |
| Landing page, donation wall, crypto page, shop | `audit:embeds` | A page that is about the game rather than the game. Those go on `content/blocked.json` so the sweep cannot bring them back. |

The block list and the override list do opposite jobs:
`content/blocked.json` names repositories that must never be published;
`content/overrides.json` points a catalogue entry at the right file when the
repository's `index.html` is the project's landing page and the game is elsewhere.

---

## Where the state lives

Everything transient is in `.harvest/`, which is git-ignored. The durable state is
`third-party/<slug>/` (the game plus its `.harvested.json`) and the two files the
pipeline writes into `content/`.

| File | Written by | Contents | Safe to delete? |
|---|---|---|---|
| `.harvest/candidates.json` | sweep | Every repo the search has accepted, sorted by stars | Yes, but it is the most expensive file in the pipeline to rebuild — a full sweep is hours of API calls. Delete it only if you want to start the search from nothing. |
| `.harvest/preflight.json` | preflight | Tree listing + entry + verdict per repo | Yes. Costs one API call per repository to rebuild. Keep it — that is the whole point of the cache. |
| `.harvest/vendored.json` | vendor | The metadata of everything on disk | Yes, rewritten by the next `vendor` run. |
| `.harvest/failed.json` | vendor | Repositories whose download or extraction failed | Yes. Rewritten by every vendor run, empty when nothing failed. |
| `.harvest/skipped.json` | vendor | Repos preflight refused (no entry, no licence) | Yes. They will be re-preflighted once, which costs an API call each. |
| `.harvest/validated.json` | validate | One verdict per slug: `pass`, `dead` or `inconclusive` | **No.** It is the only record of the browser gate, and `import.mjs` refuses to run without it (`exit 1`). Deleting it does not break the published catalogue, but it means re-opening every game in a browser. |
| `.harvest/tmp/` | vendor | Per-repo extraction directories | Yes, always. Never inspected. |
| `third-party/<slug>/.harvested.json` | vendor / validate | The repository's metadata, entry path, licence, `validated: true` | Only if you intend to re-download and re-validate that game. |

To rebuild the catalogue from what is already on disk without touching the
network:

```bash
node scripts/harvest/validate.mjs     # re-judges only what is not already validated
node scripts/harvest/import.mjs --caps 80 --budget 500
```
