# arcadefork

Free browser arcade. Many games, many categories, **zero running cost**.

- **Live:** `https://arcadefork.pages.dev/` — Cloudflare Pages, free forever
- **Fallback:** `https://ayhemkahridev.github.io/` — GitHub Pages, same build
- **Optional, never required:** `arcadefork.com` (also free to register: `.net` `.io` `.gg` `.games` `.fun`)

No accounts, no tracking walls, no paywalls, and **no purchase is required at any
point**. Ten games are built on the arcadefork engine; the other 243 are
open-source projects vendored with their own licences. The engine bundle — the
code that boots a first-party game — is **24.9 kB gzipped** (75 kB raw). A
vendored game ships what its author wrote and none of our code.

---

## Quick start

```bash
npm ci                 # install exactly what the lockfile pins
npm run dev            # vite dev server
npm test               # 91 node:test cases - the catalogue and harvest rules, no browser
npm run build          # -> dist/ (static site, deployable as-is)
npm run audit          # content, links, embeds, assets, size, then live game health
npm run smoke          # headless-chrome smoke test of every page + game
npm run serve:dist     # serve dist/ locally on :4178
npm run daily          # print today's puzzle and answers
```

How a game gets into the catalogue, end to end: **[docs/HARVEST.md](docs/HARVEST.md)**.
Conventions that bind any automated contributor: **[AGENTS.md](AGENTS.md)**.

---

## How it works

### The daily puzzle is a pure function of the date

`src/shared/daily.js` hashes the date into a seed, and `mulberry32` generates the
board from that seed. **No server, no API, no database.**

That means:

- every player worldwide gets the same grid on the same day
- the static site builder and the browser agree on the answers, so the SEO answer
  pages can never drift from the real puzzle
- there is nothing to host or keep running

A rolling window of **30 days back and 7 days forward** is rebuilt on every deploy.
Each date produces two pages:

```
/daily/2026-10-21/           the puzzle
/daily/2026-10-21/answers/   the solved grid + every word and its coordinates
```

### Layout

```
src/
  engine/        runtime shared by every game
    types.ts     GameSpec / GameInstance / EngineContext contracts
    loop.ts      fixed-timestep loop (60Hz and 120Hz behave identically)
    input.ts     pointer + touch handling
    audio.ts     synthesised SFX via WebAudio - no audio files, no licence
    storage.ts   namespaced localStorage
    analytics.ts dataLayer, or a first-party endpoint, or nothing
    ads.ts       Poki / CrazyGames SDK detection, house ads as the fallback
    share.ts     Web Share API with a rendered card, clipboard fallback
    render.ts    palette + canvas helpers
  shared/        deterministic content (daily.js, wordlists.js)
  games/         one file per game
  host.ts        boots a game: canvas, HUD, overlays, share, keyboard
content/
  games.json              engine games + the category list (hand-written)
  engine-new.json         newer engine games, a separate layer for a clean merge
  curated.json            hand-picked third-party entries
  harvest-published.json  machine-curated harvest output (import.mjs writes it)
  games.generated.json    legacy harvest output, rewritten by `npm run harvest`
  overlays.json           category/title/copy patches, applied last, by id
  blocked.json            repos that must never be published again
  overrides.json          per-game embed fixes for the harvest
scripts/
  build-site.mjs static site generator
  catalogue.mjs  merges the catalogue layers
  harvest/       the harvest pipeline - see docs/HARVEST.md
  daily.mjs      print today's puzzle (used by the content pipeline)
  smoke.mjs      headless browser test
  serve-dist.mjs static server
```

`scripts/catalogue.mjs` merges five catalogue layers by id — earlier layer wins —
then applies `content/overlays.json` as a sixth, last layer of patches, and the
site builder and the in-game registry both read the result, so a game's SEO copy
and its runtime cannot disagree. An overlay that patches an id no layer produced
is a build error rather than a silent no-op, so a renamed game cannot keep its old
copy unnoticed.

The rule that matters for anyone editing curation: **`content/games.generated.json`
is machine-owned.** The harvest rewrites it wholesale, so hand-written copy there
is lost on the next sweep. Curation belongs in a layer above it
(`content/curated.json`) or in `content/overlays.json`.

---

## The games

**253 games in 9 categories** — 10 built on the arcadefork engine, 243 vendored
from open-source repositories.

**Original** — built on the arcadefork engine (`content/games.json` and
`content/engine-new.json`):

| Game | Category | What it is |
|---|---|---|
| Daily Word Search | Word | Date-seeded 10x10 grid, 100 seconds, answer archive for every date |
| 2048 Merge | Puzzle | Slide and merge tiles toward 2048 |
| Neon Snake | Arcade | Classic snake, edges wrap so runs stay long |
| Memory Match | Brain | Find all the pairs in as few moves as possible |
| Daily Sudoku | Puzzle | Date-seeded grid with one solution |
| Minesweeper | Brain | Classic minefield, flag and clear |
| Neon Breakout | Arcade | Brick breaker with a phosphor palette |
| Lights Out | Puzzle | Toggle the grid until every light is off |
| Simon Says | Brain | Repeat a growing colour-and-tone sequence |
| Typing Sprint | Word | Type the falling words before they land |

**Open source** — 243 repositories vendored verbatim with their original
licences, credited on [/credits/](https://arcadefork.pages.dev/credits/) with a
link back to each source. Three were hand-picked and live in `content/games.json`
next to the engine games (The Evolution of Trust and Loopy by Nicky Case, CC0;
Javascript Tetris by Jake Gordon, MIT); the rest arrive through the harvest below.

### The harvest pipeline

```bash
npm run harvest                                       # sweep -> vendor -> validate -> generate
node scripts/harvest/batch.mjs --target 500 --batch 250   # rounds of vendor -> validate -> import
```

`scripts/harvest-games.mjs` runs four phases, each writing a report to
`.harvest/` so a killed run resumes instead of starting over:

| Phase | What it does |
|---|---|
| `sweep` | 124 GitHub search queries across 8 genre families (arcade, puzzle, word, action, board, racing, strategy, sandbox), each crossed with 9 licences, filtered by `scripts/harvest/filters.mjs`: a licence on the allowlist (permissive **and** copyleft — GPL/LGPL/MPL are fine because the vendored copy ships its original licence and this repository is the corresponding source), a plausible size, a game signal in the name or description, and nothing that says library, tutorial, framework, portfolio — or firmware. |
| `vendor` | One `git/trees?recursive=1` call per repo discovers the entry HTML (`docs/index.html`, `dist/index.html`, a root `game.html`, ...; see `scripts/harvest/entry.mjs`). Passing repos are downloaded concurrently, pruned of files a browser can never use, and shipped with their `LICENSE` plus an `ARCADEFORK-NOTICE.md` crediting author, licence and source. |
| `validate` | **The quality gate.** Opens each vendored game in headless Chrome, several at a time, and judges it with the same `judgeGame()` the post-build audit uses. It must paint or present a real interface, and must not have a missing script, a fatal JS error or a 4xx page. Failures are deleted, not published. |
| `generate` | Rewrites `content/games.generated.json` from the survivors. No hand-written copy goes in there — it is the one file a harvest overwrites. |

A full sweep is 124 queries × 9 licences × 10 pages: thousands of search calls at
30/minute, which looks like a hang and burns the API budget for nothing. It is
therefore bounded, and the budget is the knob:

```bash
HARVEST_TARGET=40 HARVEST_PAGES=3 HARVEST_CALLS=120 npm run harvest
```

`HARVEST_TARGET` stops once there are enough new candidates, `HARVEST_PAGES` limits
page depth, `HARVEST_CALLS` caps the API outright, and repos already in
`third-party/` are skipped. A sweep that finds nothing now fails loudly: `gh()`
returns `''` on any error, so an unauthenticated run used to "succeed" with an
empty catalogue.

The build only copies games the catalogue references, so a harvest run in progress
can never publish a game that has not passed the gate. The smoke test and
`npm run audit:health` then load every published game in a real browser, which is
how games that only break inside the delivered iframe get caught.

The catalogues are capped, not just filtered: `import.mjs` publishes at most 80
games per genre family when the batch driver runs it (40 is the importer's own
default), at most `--budget` new pages per run, collapses duplicate titles to one
page, and refuses any game without a passing browser verdict. 14 repositories are
on `content/blocked.json` — vendored, opened in a browser and rejected (a landing
page rather than a game, or a build step a browser cannot run) — so they cannot
come back on the next sweep.

Full detail, including the cost of each knob and what to do when a batch stops
making progress: **[docs/HARVEST.md](docs/HARVEST.md)**.

---

## Adding a game

The whole point is that this is cheap. Budget: **under two hours per game**.

1. Copy `src/games/memory.ts` as the template. Implement `GameInstance`:
   `update(dt)`, `render(ctx)`, `hud()`, optional `pointerDown/Move/Up`, `key`,
   `shareCard`, and set `this.result` when the round ends.
2. Register it in `src/games/index.ts`.
3. Add its metadata to `content/games.json` (title, description, keywords,
   how-to-play, FAQ, accent colour, category). A game added later as part of a
   merge goes in `content/engine-new.json` instead, which is the same shape in a
   separate layer.
4. `npm test && npm run audit:content && npm run build && npm run smoke`.

A harvested game needs none of that: `import.mjs` writes its metadata into
`content/harvest-published.json`. If a harvested entry needs a better category, a
cleaner title or player-facing copy, patch it in `content/overlays.json` by id —
never in `content/games.generated.json`, which the harvest rewrites.

Optional metadata both shells understand: `"mobile": "native"` when the game
already handles touch itself (no pad, no swipe interception), and
`"pad": { "a": "KeyZ" }` to remap a pad key for a game with unusual controls.

The site builder then creates the game page, the category page picks it up, the
sitemap updates, and the home page grid refreshes — no other edits.

### House ads

With no ad account yet, the end-of-round overlay promotes another game in the
catalogue (`src/engine/ads.ts`). That is free inventory that lengthens the
session. When a real network is connected, the same call site uses it instead.

---

## Deploying (free)

### Cloudflare Pages — the live site

`https://arcadefork.pages.dev/` is served from the Cloudflare Pages project
`arcadefork`. Deploy from the terminal:

```bash
npm run build
npm run deploy:cloudflare
```

The token is read from `CLOUDFLARE_API_TOKEN` or from `~/.cf_token`, so it
never has to appear in a terminal history or a chat transcript. The account id
is baked into the script.

To have Cloudflare build on every push instead, connect the repository in the
dashboard: **Workers & Pages → arcadefork → Settings → Builds & deployments →
Connect to Git repository**. Build command `npm run build`, output directory
`dist`. That needs no token in the repo at all, which is the safer option for a
public repository.

### GitHub Pages — the fallback

The same source also publishes to `ayhemkahridev.github.io` via
`.github/workflows/deploy.yml`, which builds and pushes `dist/` to the
`gh-pages` branch on every push to `main` and every night at 00:10 UTC.

Because the repo is named after the account, GitHub serves it at the **root** of
`ayhemkahridev.github.io` — no subpath, so every absolute path in the site
works untouched.

`npm ci --ignore-scripts` is used because npm 11 gates install scripts; esbuild
ships its binary as an optional dependency, so this is safe.

To publish a change to both:

```bash
git push                        # -> GitHub Pages
npm run deploy:cloudflare       # -> arcadefork.pages.dev
```

---

## Interface

### The identity: "Signal"

One system, three ingredients — ink, signal, coin.

| Token | Value | Used for |
|---|---|---|
| Ink | `#08090a` stage, `#131518` panels | every surface |
| Paper | `#f6f3eb` (warm white, never `#fff`) | all type |
| Signal | `#c9f94b` acid lime | actions, marks, focus, the word "fork" |
| Coin | `#ffc46b` amber | the daily grid only |

- **Type** — Bricolage Grotesque (display), Outfit (UI), Geist Mono (labels
  and data). All three are SIL OFL and **self-hosted** from `/fonts`, latin
  subset only: no third-party connection, no privacy leak, no font flash.
  Total: 115 kB for all three variable faces.
- **Mark** — a token with a play triangle cut into it: the coin you would
  once have inserted, and the button you press instead. It is the same drawing
  in the wordmark, the favicon, the app icons and the social card, and it
  still reads at 16px where a thinner mark turned to mush.
- **Hairlines, not borders** — every surface is a single `inset` 1px line plus
  a soft close shadow, so panels read as one material rather than a stack of
  boxes.
- **Motion** — designeer.xyz's easing vocabulary (`--e-out`,
  `--e-spring`, `--e-io`), 140–520 ms, reveals staggered 26 ms apart.
  `prefers-reduced-motion` turns all of it off.

### Layout

- **Phone** — the game fills the first screen, 44px minimum touch targets,
  safe-area insets for notches, a horizontally scrolling category strip, and
  two game cards per row. A game page opens immersive and thumb-playable.

- **Tablet** — two-column card grids, wider play area, the side rail moves
  below the game.
- **Desktop** — a two-column shell: the game on the left, a side rail on the
  right with the game name, category links, "keep playing" links and the
  sponsor slot. The board itself is capped so it is not lost in a wide column.

### Phone play — the pad, the swipe, the end of the refresh

Almost every game is somebody else's page in an iframe, and nearly all of them
only ever listened for a keyboard. On a phone that is unplayable, and worse: the
swipe you reach for is the browser's, so steering a game pulled the page down to
refresh it and lost the run.

`public/play.js` (game pages only, ~10 kB) fixes that in three moves:

- **A pad that speaks keyboard.** Two-thumb D-pad plus A/B/P/R dispatches real
  `KeyboardEvent`s into the game's own document. Same origin, so it is allowed;
  the legacy `keyCode` is defined by hand because that is the field the games
  actually switch on. Held directions auto-repeat like a real keyboard.
- **Swipes as arrows.** A swipe on the game becomes the matching arrow and a tap
  becomes Space. Handlers run in the capture phase on the frame's document, so a
  game cannot swallow the gesture. A game that is already touch-native is marked
  `"mobile": "native"` in `content/games.json` and gets neither.
- **Immersive by default.** On a coarse pointer the page becomes the game:
  `100dvh`, no rail, no article, page scroll locked, safe-area aware, an always
  visible Exit, and `overscroll-behavior: none` on `html`/`body` plus on the
  frame's own document — that pair is what actually kills pull-to-refresh.

Games that paint a fixed box smaller than the frame are scaled to the frame's
width (never past 2×) and the frame is shrunk to the result, so an old 300 px
game is not a postage stamp in a field of its own white background. Keys for a
game with unusual controls are declared per game: `"pad": { "a": "KeyZ" }`.

Verified on a 390×844 touch viewport by `npm run check:mobile`, which asserts the
scroll lock, that a swipe moves the page by zero pixels, and that a pad press is
delivered *inside* the game — the three things a desktop smoke test cannot see.

### Difficulty

The four engine games take a level: **Easy / Normal / Hard**, chosen from the
segmented control in the game's top bar. It is one setting shared by the
whole arcade (`localStorage → af:difficulty`) and it is read when a round is
created, so changing it starts a fresh round at the new level rather than
silently altering the one in progress. On a phone the three buttons collapse
to E / N / H so they fit beside the HUD.

What the level changes, precisely: word search timer (150 / 100 / 60
seconds), memory grid (4x3 / 4x4 / 6x4), snake tick (180 / 150 / 110 ms).
2048 has fixed rules and ignores the setting. A `?d=easy|normal|hard` query
parameter overrides the stored value for one visit.

### Themes

Nine coats, one system. Six of them swap colour only — stage, panels, ink on
stage, the signal colour and the coin — so they are the same product in a
different colour. Three go further and move shape and type as well, because a
cartridge does not have 12px rounded corners: `pixel` is the 16-bit coat, `crt`
adds a scanline grid, `newsprint` is a light printed page.

| Theme | Stage | Signal | Character |
|---|---|---|---|
| **Signal** (default) | near-black | acid lime | the identity |
| **Lights on** | paper | olive-lime | daylight, projectors |
| **Coin-op** | warm black | amber | the cabinet |
| **Ice** | blue-black | cyan | cool, arcade-classic |
| **DMG** | olive-black | 1989 green | the handheld |
| **Vapor** | violet | hot pink | neon night |
| **Pixel** | indigo | gold | 16-bit cartridge: zero radius, hard 2px edges, offset shadows, Silkscreen + Pixelify Sans, stepped easing, 8px tile floor |
| **CRT** | phosphor black | green | a green tube with a real scanline grid and glowing headings |
| **Newsprint** | paper | brick red | printed page, light chrome |

`pixel` and `newsprint` are the reason shape is tokenised: `--r-*`, `--lift*`,
`--f-*` and the easing set are all theme-scoped, so the pixel coat squares the
corners once instead of leaving a stray 12px round on two panels. Its micro
type gets a 12px floor — a 5×7 pixel face turns to mush below that.

The picker lives in the header (a paint-chip button). It is a real menu
button: `↑`/`↓`, `Home`/`End`, `Esc`, click-outside, and the current theme is
marked with `aria-checked`. The choice persists in `localStorage` and is
applied by an inline script **before first paint**, so there is no flash. The
browser chrome colour (`theme-color`) follows the theme too.

Every theme is contrast-checked — `npm run themes` parses the token blocks out
of `public/styles.css`, resolves the pairs that actually carry text and fails
the build on anything under WCAG AA (108 pairs across 9 themes today). The
check runs in CI with the other audits.
- **Keyboard** — visible focus rings, `/` focuses search, `Esc` clears it, `R`
  restarts a game, `M` mutes, arrows and WASD move, `Space` starts.

### Search and browsing

- The header search is a real form: it lands on `/games/?q=…`, which the page
  reads on load, so a search result is a shareable URL.
- `/games/` filters as you type across titles, categories and keywords, with
  category chips, A→Z / Z→A sorting, a live count in an `aria-live` region and
  an honest empty state.
- Categories wider than twelve games collapse behind a "Show all N" button, so
  the page opens as a menu rather than a 253-tile wall. The tiles are still in
  the HTML: the collapse only hides them, so search needs no request.
- "Random" respects the category you are looking at.

### Offline

`/sw.js` is a small service worker: navigations are network-first (a deploy is
picked up immediately, with a 3.5 s fallback so a dying connection cannot hang
the first paint) and every other same-origin GET is stale-while-revalidate. A
game you have played once still opens with no connection, and a page you have
never opened gets a plain "No connection" card instead of the browser's error.
The manifest makes the arcade installable, with a maskable icon and two
shortcuts.

The cache name carries the deploy's asset hash, injected by the site builder,
so each deploy starts a fresh cache and `activate` deletes the previous one.
It also trims itself to 140 entries: the whole catalogue plus art is otherwise a lot of
megabytes on a phone.

### Security headers

`public/_headers` sets a Content-Security-Policy (self-only scripts, styles,
fonts and frames), `nosniff`, a referrer policy, `X-Frame-Options: SAMEORIGIN`
and a Permissions-Policy that denies camera, microphone and location.

That file is a Cloudflare Pages feature. GitHub Pages ignores it and sends its
own `Cache-Control: max-age=600` for everything, so the fallback host is
unprotected by these headers — one more reason the canonical URLs point at
`arcadefork.pages.dev`.

---

## Making money without spending anything

There is no step in this project that costs money. Here is the ladder, cheapest
first. **Skip anything you don't want to do.**

### 1. itch.io — free hosting, and you keep the revenue

itch.io hosts the build for free, gives you a page that ranks on Google, lets you
embed ad code, and takes **10% by default — and you can set that to 0%** under
*Settings → Open revenue sharing*. No domain, no ad account, no approval.

```bash
npm run build
npm run package:itch      # -> dist/itch/<game>.zip, ready to upload
```

Upload the zip: *Create new project → kind "HTML" → upload "This file will be
played in the browser" → zip → upload.* The package is verified to run standalone.

### 2. Poki and CrazyGames — they host, they pay, they take nothing from you

Both take a zipped HTML5 build and run their own ad SDK. The engine detects
`window.poki` and `window.CrazyGames` at runtime and routes ad calls to them
automatically (see `src/engine/ads.ts`). Revenue is shared (~50/50 on Poki).
**No domain, no ad account, no cost.** The trade is that the traffic is theirs,
not yours — which is why your own site still matters for the long game.

### 3. Telegram Mini Apps — free distribution, free payments

Point a Telegram bot's Mini App at `https://ayhemkahridev.github.io/games/merge/` and
the game runs inside Telegram with haptics and Stars-based in-app purchases. The
WebApp integration is already in `src/host.ts` (expand, theme colours, haptic
feedback, vertical-swipe lock). Telegram needs only an HTTPS URL — a free
subdomain is fine.

### 4. Sell the ad slots yourself — no ad network required

`content/sponsors.json` holds the sponsor slots. You find a sponsor, they pay you
directly, you paste their details in, and it goes live on the next build. There is
no network to join, no minimum spend, no approval queue, and no cut of your
revenue.

```json
{
  "slots": [
    {
      "title": "Your Brand",
      "subtitle": "Sponsored",
      "href": "https://example.com",
      "categories": ["word"]
    }
  ]
}
```

A slot matching the category wins the end-of-round placement. With the file
empty, the slot promotes your own catalogue instead — which is free inventory that
lengthens the session.

### 5. Free-tier ad networks (only if you want them)

Networks like Adsterra, PropellerAds or GamerAds accept free hosting subdomains
(no domain ownership check like AdSense). They pay less and use intrusive formats,
so treat them as a later option rather than the plan.

### What is *not* available to you, and why it does not matter

**Google AdSense will not approve a `pages.dev` / `vercel.app` / `github.io`
subdomain**, because you cannot prove domain ownership. That is the one thing
money would buy you. It is also the thing you do not need yet:

- AdSense needs traffic volume to be worth enabling at all
- The revenue above (itch.io + Poki + CrazyGames + direct sponsors) requires no
  domain and no approval
- If `arcadefork.com` ever becomes worth registering, it is a one-line change to
  `content/games.json → site.baseUrl` plus a 301 redirect map. Nothing in the code
  assumes a domain exists.

Also note AdSense rejects "templated, machine-generated pages at scale". Every
game must be genuinely distinct — different mechanic, different content, different
keyword target. That is why the games here are real games and not reskins.

### Free-tier ceilings to watch

Pages 500 builds/month · Workers 100k requests/day (unused — puzzles are generated
at build time) · R2 10 GB with no egress fees.

---

## Submitting to the portals

**itch.io** — `npm run package:itch` builds a standalone zip per game. Create a
project, kind "HTML", upload "This file will be played in the browser". Their
pages rank on Google, and you can embed ad code and keep the revenue.

**Poki** (developers.poki.com) and **CrazyGames** (docs.crazygames.com) both take
a zipped HTML5 build and run their own SDK. The engine detects `window.poki` or
`window.CrazyGames` at runtime and routes ad calls to them automatically — see
`src/engine/ads.ts`. The zip in `dist/itch/<game>.zip` is already in the right
shape for both.

Requirements on both portals: a loading screen, a mute button, keyboard
controls, mobile support, and no external requests other than their SDK. The
shell here already provides the mute button and touch controls.

---

## Content pipeline

The daily puzzle is the traffic hook and the retention loop:

```bash
node scripts/daily.mjs --json > today.json
```

That JSON is what the social pipeline needs. Because the `ad-factory` renderer
produces a 15-second vertical reel in about 15 seconds offline, every day can get
a fresh clip for TikTok / Reels / Shorts with no creative fatigue. Point the
renderer at `/daily/<date>/` to capture the board, feed the theme and word count
into the spec, and post.

---

## SEO notes

- Every page: unique title, meta description, canonical, one `h1`, JSON-LD.
- Game pages emit `VideoGame` + `FAQPage` structured data.
- Category pages emit `CollectionPage` with each game as a `VideoGame` member.
- The answer pages are the highest-intent pages in the niche — "word search
  answers for <date>" is what people actually type.
- Informational listicles are a dead end: AI Overviews cut position-1 CTR by
  58% (Ahrefs, Dec 2025). Tools, real data and solved grids survive.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm test` | 91 `node:test` cases: catalogue merge, harvest rules, copy, import. No browser, ~150 ms |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Bundle + generate the static site into `dist/` |
| `npm run serve:dist` | Serve `dist/` on :4178 |
| `npm run audit` | The full gate: `audit:content`, `audit:links`, `audit:embeds`, `audit:assets`, `audit:size`, `audit:health` |
| `npm run audit:content` | Developer jargon in player copy, duplicate titles, an overlay pointing at a missing id, a broken `robots.txt` |
| `npm run audit:links` | Every internal link and every sitemap URL resolves to a real file |
| `npm run audit:embeds` | No embedded game is a personal page or can navigate out of the arcade |
| `npm run audit:assets` | Every script, style and asset a published game asks for exists |
| `npm run audit:size` | 10 MB per game, 20 MB per file, 700 MB for all of `dist/` |
| `npm run audit:health` | Every published game loads, starts and paints in a real browser |
| `npm run smoke` | Headless Chrome test: every page, every game, SEO assertions |
| `npm run check:mobile` | Phone viewport: pad, swipe → arrow, scroll lock, no pull-to-refresh |
| `npm run themes` | Every text/background pair in all 9 themes is at least WCAG AA |
| `npm run harvest` | sweep → vendor → validate → generate (see [docs/HARVEST.md](docs/HARVEST.md)) |
| `node scripts/harvest/batch.mjs --target 500 --batch 250` | Rounds of vendor → validate → import until the catalogue hits the target |
| `npm run vendor:games` | Download and refresh the vendored open-source games |
| `npm run fix:embeds` | Repair the vendored games (see below) |
| `npm run package:itch` | Standalone zip per game for itch.io / Poki / CrazyGames |
| `npm run deploy` | `build` then `wrangler deploy` |
| `npm run daily` | Print today's puzzle + answers |
| `npm run og:image` | Re-render the social preview card |

The health check also runs against the live site, so production can be
verified without a deploy:

```bash
AUDIT_ORIGIN=https://arcadefork.pages.dev npm run audit:health
```

It checks four games at a time (`AUDIT_JOBS=8` to go wider). Any gate needs
Chrome; `scripts/chrome.mjs` finds a cached headless shell, a system Chrome or
`CHROME_PATH`, and the message when it finds none includes the one-line
install command.

```bash
npx @puppeteer/browsers install chrome-headless-shell@stable \
  --path ~/.cache/hyperframes/chrome
```

---

## The quality gate

A games site lives or dies on whether the games actually work. A page that
looks fine in a screenshot and is broken when you press play is worse than no
page at all, so every game is checked in a real browser before it ships.

```bash
npm test && npm run build && npm run audit && npm run smoke
```

| Check | What it catches |
|---|---|
| `test` | A catalogue merge that drops a layer, a preflight rule that accepts a repo with no licence, an importer that publishes a dead game or breaks the per-family cap. No browser needed |
| `audit:content` | Developer jargon in player-facing copy, two games sharing a title, an overlay patching an id no layer produced, a `robots.txt` with no sitemap |
| `audit:links` | A link to a page that was never built, a sitemap URL with no page |
| `audit:embeds` | An embedded game that is really the author's homepage, a donation wall, a crypto payment page or a shop selling its own source code |
| `audit:assets` | A game whose script, style or image does not exist - the game cannot run |
| `audit:size` | A game shipping its build tooling: 10 MB per game, 20 MB per file, 700 MB for all of `dist/` |
| `audit:health` | A game that loads but never paints, throws a JavaScript error, or waits behind a start screen nobody can find |
| `smoke` | Every page of the site: one `h1`, a title, a description, a canonical, valid JSON-LD, a working board |
| `themes` | A theme whose text does not reach WCAG AA on its own background (108 pairs, 9 themes) |
| `check:mobile` | Pull-to-refresh still enabled, a swipe that scrolls instead of steering, a pad too small for a thumb |

CI runs `typecheck`, `build`, `audit`, `smoke` and `themes` before every deploy,
so a broken game cannot reach the live site. `npm test` and `check:mobile` are
not in the workflow yet - run them yourself before a commit.

### Repairing a vendored game

A vendored game is written to run from the root of its own repository. Served
from `/third-party/<name>/` it breaks in three ways, and
`npm run fix:embeds` repairs all three:

1. **Root-absolute references.** `/scripts/main.js` asks the site root for a
   file that lives inside the game folder, so the script never loads. It
   becomes document-relative.
2. **Files that moved.** `nokiafc22.ttf` when the author moved it to
   `FontFiles/` 404s. It is rewritten to where the file actually is.
3. **Script tags for files the author deleted.** The tag stays in the page
   and throws a 404 on every load. It is removed.

A repair only fires when the target file really exists inside the game
folder, so nothing is guessed, and every change is written into that game's
`ARCADEFORK-NOTICE.md` — the vendored copy is no longer byte-for-byte
upstream, and the notice says so.

### Games that can never work

Some repositories cannot be a game here: the published page is the project's
landing page, or the game needs a build step (webpack, vite, emscripten) that
a browser cannot run. Those are listed in `content/blocked.json` and the
harvest pipeline skips them, so they cannot come back on the next run.
`content/overrides.json` does the opposite: it points a catalogue entry at the
right file when the repository's `index.html` is not the game.

---

## Making it sustainable (2026-10)

The games stay free and unpaywalled — that is a promise on every page. What
changed: the site can now pay for itself without an ad network.

- **Sponsor slots.** `/advertise/` sells labelled sponsor cards: one per
  category, no pop-ups, no tracking. Fill `content/sponsors.json` slots and the
  card goes live on the next build. The homepage "Cabinet slots" section shows
  the open slots honestly while they are unsold.
- **Tip jar.** Set `tips.kofi` (etc.) in `sponsors.json` to add footer tip
  links — ten minutes of setup, no fee beyond the processor.
- **Later, optional:** AdSense only when traffic justifies it. `ads.txt` and a
  privacy page are the gates; nothing else is needed first.

`outreach-pitch.md` is the one-paragraph message to send when offering a slot.

---

## Audit pass (2026-10-26)

The whole gate was run from a clean clone — `typecheck`, `build`, `audit:links`
(8,275 references), `audit:embeds` (149 embeds), `audit:assets`, `audit:health`
(every game in a real browser) and `smoke`. What it found, and what changed:

### Bugs fixed

| Where | Problem | Fix |
|---|---|---|
| `vite.config.ts`, `scripts/build-site.mjs` | `/assets/host.js` was served `immutable, max-age=31536000` but the filename never changed. Every returning visitor kept the first game bundle they ever downloaded — for a year. | The entry is content-hashed and the builder discovers the real filename. `package-itch` too. |
| `src/host.ts` | The HUD's `innerHTML` was rebuilt on every frame: 60–120 DOM writes a second for a scoreboard that changes once a second. | Rendered into a string and written only when it changes. |
| `src/host.ts`, `src/games/*` | `record` was computed as `score >= best` *after* `best` had been updated, so every result card announced a new personal best. | Games compare against the previous best before writing; `GameResult.record` carries it. |
| `public/sw.js` | The cache name was a constant, so the offline cache was never versioned, never cleaned, and could serve a stale stylesheet; 404/206 bodies were cached; no size limit; a navigation could hang on the network. | Cache named by the deploy's asset hash (injected at build), trimmed to 140 entries, only complete 200s stored, 3.5 s navigation fallback, and a real offline page. |
| `src/engine/analytics.ts` | With no analytics endpoint configured — the default — events queued forever in an array that could never drain. | Nothing is queued unless there is somewhere to send it; `pagehide` flush added. |
| `src/engine/storage.ts` | `inc()` went through `this.number`, which breaks the moment a caller destructures the storage object. | Reads the key directly. |
| `src/host.ts` | `Cmd/Ctrl+R` restarted the game *and* reloaded the page; keys were read while typing in a field; arrows scrolled the page mid-run; a finished round still accepted pointer input through the overlay. | Modifier, focus and input-target guards; arrows and space are claimed only while playing; `playing = false` when the result lands. |
| `scripts/audit-embed-assets.mjs` | Two games failed the asset gate because `src=` values like `${show.image ? …` and `imagePath()` were treated as filenames. | Refs that cannot be a path are skipped, so the gate only reports real misses. |
| `scripts/*.mjs` | Five copies of `findChrome`, each assuming one exact cache layout — all of them failed on a machine where the browser was installed correctly. | One `scripts/chrome.mjs` that walks the cache, then tries system paths, then `CHROME_PATH`. |
| `scripts/audit-embed-health.mjs` | Serial: one page at a time, 27 s for 15 games — the sweep was dominated by navigations and settle delays. | Four-way pool (`AUDIT_JOBS`); 7 s for the same 15, ~1 m 50 s for all 149. |
| `third-party/yongchaofan-jsblockout` | Four sound files the author never committed: four 404s on every load, silent game. | Four generated tones, documented in that game's `ARCADEFORK-NOTICE.md`. |

### Accessibility and polish

- The start and result cards are real dialogs now: `role="dialog"`,
  `aria-modal`, `aria-labelledby`, and focus moves to the primary button.
- The HUD is no longer `aria-live` (it ticked a screen reader every second).
  A hidden `role="status"` region announces the round start, the result, the
  difficulty change and the mute state instead.
- Skip link as the first tab stop, and the stage gets a `ResizeObserver` so
  the backing store follows rail reflow, font load, fullscreen and mobile
  browser-chrome collapse — not just `window.resize`.
- A splash on embedded games: on a slow connection 149 iframes of other
  people's pages used to look like a blank panel.
- Game pages emit `BreadcrumbList` alongside `VideoGame` and `FAQPage`.

### Feature added

**Difficulty** — Easy / Normal / Hard in the game top bar, shared across the
arcade, applied by starting a fresh round, and reflected in the start card.
The engine already read `ctx.difficulty`; nothing ever set it, so the whole
mechanism was dead code. `?d=` still overrides for one visit.

