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
node scripts/daily.mjs # print today's puzzle and answers
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
[/credits/](https://ayhemkahridev.github.io/credits/):

| Game | By | Licence |
|---|---|---|
| The Evolution of Trust | Nicky Case | CC0-1.0 |
| Loopy | Nicky Case | CC0-1.0 |
| Javascript Tetris | Jake Gordon | MIT |
| Pacman | mumuy | MIT |

### Adding an open-source game

```bash
npm run vendor:games
```

`scripts/vendor-games.mjs` downloads the repositories, copies them into
`third-party/<id>/`, keeps the original `LICENSE`, writes a
`ARCADEFORK-NOTICE.md` with the author, licence and source link, re-encodes
oversized audio, and **localises any external resource the game hotlinks** so
the vendored copy makes no third-party requests. The build copies
`third-party/` into `dist/` automatically.

The smoke test loads every vendored game in a real browser, inside its iframe,
and fails if it does not paint.

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

The layout is built mobile-first and adapts up:

- **Phone** — full-bleed play area, 44px minimum touch targets, safe-area
  insets for notches, horizontal-scroll nav, game cards stacked one per row.
- **Tablet** — two-column card grids, wider play area, the side rail moves
  below the game.
- **Desktop** — a two-column shell: the game on the left, a side rail on the
  right with the game name, category links, "keep playing" links and the
  sponsor slot. The play area is capped at 760px so the board is not lost in a
  wide column.
- **Motion** — every transition is under 320ms on a shared easing curve, cards
  lift and glow on hover, and `prefers-reduced-motion` turns all of it off.
- **Keyboard** — visible focus rings, `R` restarts, `M` mutes, arrows and WASD
  move.

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
| `npm run package:itch` | Standalone zip per game for itch.io / Poki / CrazyGames |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run daily` | Print today's puzzle + answers |
| `npm run vendor:games` | Download and refresh the vendored open-source games |
