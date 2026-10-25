# arcadefork

Free browser arcade. Many games, many categories, **zero running cost**.

- **Live:** `https://arcadefork.pages.dev/` — Cloudflare Pages, free forever
- **Fallback:** `https://ayhemkahridev.github.io/` — GitHub Pages, same build
- **Optional, never required:** `arcadefork.com` (also free to register: `.net` `.io` `.gg` `.games` `.fun`)

No accounts, no tracking walls, no paywalls, and **no purchase is required at any
point**. Every game is one HTML file's worth of JavaScript — the whole runtime is
**~14 kB gzipped**.

---

## Quick start

```bash
npm install
npm run dev            # vite dev server
npm run build          # -> dist/ (static site, deployable as-is)
npm run serve:dist     # serve dist/ locally on :4178
npm run smoke          # headless-chrome smoke test of every page + game
npm run audit          # links, embeds, assets and a live check of every game
npm run daily          # print today's puzzle and answers
```

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
  games.json     single source of truth for titles, copy, FAQ, keywords
scripts/
  build-site.mjs static site generator
  daily.mjs      print today's puzzle (used by the content pipeline)
  smoke.mjs      headless browser test
  serve-dist.mjs static server
```

`content/games.json` drives both the site builder and the in-game registry, so a
game's SEO copy and its runtime can never disagree.

---

## The games

**Original** — built on the arcadefork engine:

| Game | Category | What it is |
|---|---|---|
| Daily Word Search | Word | Date-seeded 10x10 grid, 100 seconds, answer archive for every date |
| 2048 Merge | Puzzle | Slide and merge tiles toward 2048 |
| Neon Snake | Arcade | Classic snake, edges wrap so runs stay long |
| Memory Match | Brain | Find all the pairs in as few moves as possible |

**Open source** — vendored verbatim with their original licences, credited on
[/credits/](https://arcadefork.pages.dev/credits/): The Evolution of Trust, Loopy
(Nicky Case, CC0), Javascript Tetris (Jake Gordon, MIT), Pacman (mumuy, MIT),
plus a larger catalogue harvested from GitHub.

### The harvest pipeline

```bash
npm run harvest          # sweep -> vendor -> validate -> generate
```

`scripts/harvest-games.mjs` runs four phases:

| Phase | What it does |
|---|---|
| `sweep` | 60+ GitHub searches across game topics and naming conventions. Filters to permissive **and copyleft** licences (GPL/LGPL/MPL are fine here because the vendored copy ships its original licence and this repository is the corresponding source), then to repos that are actually games rather than libraries or tutorials. |
| `vendor` | Downloads each repo, keeps the original `LICENSE`, writes an `ARCADEFORK-NOTICE.md` crediting author, licence and source, re-encodes oversized audio and localises any external resource the game hotlinks. |
| `validate` | **The quality gate.** Loads each vendored game in headless Chrome. It must actually paint or present a real interface, and must not have same-origin resource failures. Failures are deleted, not published. |
| `generate` | Writes `content/games.generated.json`: unique title, description, keywords, how-to-play and FAQ per game, derived from the repo README so the copy is real rather than templated. |

The build only copies games the catalogue references, so a harvest run in
progress can never publish a game that has not passed the gate. The smoke test
loads every published game in a real browser on every run.

Rough numbers: 700 candidates swept across 60+ GitHub queries, 301 vendored,
**every one judged in a real browser** — 162 passed, 101 rejected for blank
frames / missing scripts / fatal errors, 3 kept for a later pass, and 7 more
cut by the smoke test for only failing inside the iframe they are actually
delivered in. The gate is the point — a broken game or a near-duplicate page
is worse than fewer games.

Of the 162 that passed the harvest gate, five turned out to be unusable when
they were actually played (a landing page rather than a game, or a game that
needs a build step) and are now on `content/blocked.json`. The rest are
repaired by `npm run fix:embeds` and re-checked in a browser by
`npm run audit:health`, which is how the 31 games that shipped broken were
found and fixed.

---

## Adding a game

The whole point is that this is cheap. Budget: **under two hours per game**.

1. Copy `src/games/memory.ts` as the template. Implement `GameInstance`:
   `update(dt)`, `render(ctx)`, `hud()`, optional `pointerDown/Move/Up`, `key`,
   `shareCard`, and set `this.result` when the round ends.
2. Register it in `src/games/index.ts`.
3. Add its metadata to `content/games.json` (title, description, keywords,
   how-to-play, FAQ, accent colour, category).
4. `npm run build && npm run smoke`.

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
- **Mark** — a path that forks: two branches from one line. It is the same
  drawing in the wordmark, the favicon, the app icons and the social card.
- **Hairlines, not borders** — every surface is a single `inset` 1px line plus
  a soft close shadow, so panels read as one material rather than a stack of
  boxes.
- **Motion** — designeer.xyz's easing vocabulary (`--e-out`,
  `--e-spring`, `--e-io`), 140–520 ms, reveals staggered 26 ms apart.
  `prefers-reduced-motion` turns all of it off.

### Layout

- **Phone** — the game fills the first screen, 44px minimum touch targets,
  safe-area insets for notches, a horizontally scrolling category strip, and
  two game cards per row.
- **Tablet** — two-column card grids, wider play area, the side rail moves
  below the game.
- **Desktop** — a two-column shell: the game on the left, a side rail on the
  right with the game name, category links, "keep playing" links and the
  sponsor slot. The board itself is capped so it is not lost in a wide column.
### Themes

Six coats, one system. A theme only swaps tokens — stage, panels, ink on
stage, the signal colour and the coin. Shape, spacing, type and motion never
change, so every theme is the same product in a different colour.

| Theme | Stage | Signal | Character |
|---|---|---|---|
| **Signal** (default) | near-black | acid lime | the identity |
| **Lights on** | paper | olive-lime | daylight, projectors |
| **Coin-op** | warm black | amber | the cabinet |
| **Ice** | blue-black | cyan | cool, arcade-classic |
| **DMG** | olive-black | 1989 green | the handheld |
| **Vapor** | violet | hot pink | neon night |

The picker lives in the header (a paint-chip button). It is a real menu
button: `↑`/`↓`, `Home`/`End`, `Esc`, click-outside, and the current theme is
marked with `aria-checked`. The choice persists in `localStorage` and is
applied by an inline script **before first paint**, so there is no flash. The
browser chrome colour (`theme-color`) follows the theme too.

Every theme is contrast-checked: body, secondary, meta, coin and on-signal
text all clear AA (the numbers are in
`~/open-code-hub/design-god/arcadefork-identity.md`).
- **Keyboard** — visible focus rings, `/` focuses search, `Esc` clears it, `R`
  restarts a game, `M` mutes, arrows and WASD move, `Space` starts.

### Search and browsing

- The header search is a real form: it lands on `/games/?q=…`, which the page
  reads on load, so a search result is a shareable URL.
- `/games/` filters as you type across titles, categories and keywords, with
  category chips, A→Z / Z→A sorting, a live count in an `aria-live` region and
  an honest empty state.
- Categories wider than twelve games collapse behind a "Show all N" button, so
  the page opens as a menu rather than a 110-tile wall.
- "Random" respects the category you are looking at.

### Offline

`/sw.js` is a small service worker: navigations are network-first (a deploy is
picked up immediately) and every other same-origin GET is
stale-while-revalidate. A game you have played once still opens with no
connection. The manifest makes the arcade installable, with a maskable icon and
two shortcuts.

### Security headers

`public/_headers` sets a Content-Security-Policy (self-only scripts, styles,
fonts and frames), `nosniff`, a referrer policy, `X-Frame-Options: SAMEORIGIN`
and a Permissions-Policy that denies camera, microphone and location.

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
| `npm run build` | Bundle + generate the static site into `dist/` |
| `npm run serve:dist` | Serve `dist/` on :4178 |
| `npm run smoke` | Headless Chrome test: every page, every game, SEO assertions |
| `npm run audit` | The full gate: links, embed rules, asset resolution, live game health |
| `npm run audit:links` | Every internal link and every sitemap URL resolves to a real file |
| `npm run audit:embeds` | No embedded game is a personal page or can navigate out of the arcade |
| `npm run audit:assets` | Every script, style and asset a published game asks for exists |
| `npm run audit:health` | Every published game loads, starts and paints in a real browser |
| `npm run fix:embeds` | Repair the vendored games (see below) |
| `npm run package:itch` | Standalone zip per game for itch.io / Poki / CrazyGames |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run daily` | Print today's puzzle + answers |
| `npm run vendor:games` | Download and refresh the vendored open-source games |
| `npm run og:image` | Re-render the social preview card |

The health check also runs against the live site, so production can be
verified without a deploy:

```bash
AUDIT_ORIGIN=https://arcadefork.pages.dev npm run audit:health
```

---

## The quality gate

A games site lives or dies on whether the games actually work. A page that
looks fine in a screenshot and is broken when you press play is worse than no
page at all, so every game is checked in a real browser before it ships.

```bash
npm run build && npm run audit
```

| Check | What it catches |
|---|---|
| `audit:links` | A link to a page that was never built, a sitemap URL with no page |
| `audit:embeds` | An embedded game that is really the author's homepage, a donation wall or a crypto payment page |
| `audit:assets` | A game whose script, style or image does not exist - the game cannot run |
| `audit:health` | A game that loads but never paints, throws a JavaScript error, or waits behind a start screen nobody can find |
| `smoke` | Every page of the site: one `h1`, a title, a description, a canonical, valid JSON-LD, a working board |

All of them run in CI before a deploy, so a broken game cannot reach the
live site.

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
