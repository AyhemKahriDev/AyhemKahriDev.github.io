# arcadefork

Free browser arcade. Many games, many categories, zero running cost.

- **Live (free subdomain):** `https://arcadefork.pages.dev`
- **Domain (recommended, ~$10/yr):** `arcadefork.com` — also free: `.net` `.io` `.gg` `.games` `.fun`

No accounts, no tracking walls, no paywalls. Every game is one HTML file's worth of
JavaScript — the whole runtime is **~14 kB gzipped**.

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

### Cloudflare Pages

1. Create a free Cloudflare account.
2. **Workers & Pages -> Create -> Pages -> Connect to Git**.
3. Repository: this project. Build command: `npm run build`. Output directory: `dist`.
4. Done — you get `https://arcadefork.pages.dev` with HTTPS and a global CDN.

Free tier limits that matter: **500 builds/month** and **unlimited static
requests** (no bandwidth cap). A million visits costs $0.

`.github/workflows/deploy.yml` builds and deploys on every push to `main` and
re-runs daily at 00:10 UTC to refresh the rolling puzzle window. Add
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repo secrets to use it.

### Other free options

- GitHub Pages (`username.github.io`)
- Netlify / Vercel free tier
- Cloudflare R2 (10 GB, no egress fees) for the reel files

---

## The one purchase worth making

**A domain: `arcadefork.com`, about $10/year.** Everything else can be free.

Google AdSense will not approve a `pages.dev`, `vercel.app` or `github.io`
subdomain, because you cannot prove domain ownership. So without a domain you
cannot run AdSense or Ad Manager on your own site — which is where the money is
once the site has traffic.

The rule that keeps this honest: **buy the domain with the first money that
comes in.** Until then, revenue comes from the platforms that host and pay you
(itch.io, Poki, CrazyGames), which need no domain at all.

Also note AdSense rejects "templated, machine-generated pages at scale". Every
game must be genuinely distinct — different mechanic, different content, different
keyword target. That is why the games here are real games and not reskins.

---

## Monetization, in the order you should switch them on

| Channel | Needs | Notes |
|---|---|---|
| itch.io | nothing | They host, you keep ~90-100% of ad revenue. Free hosting. |
| Poki / CrazyGames | nothing | They host, revenue share (~50/50). Their traffic, not yours. |
| AdSense / Ad Manager | own domain | Best RPM on your own traffic. |
| Rewarded ads | portal SDK | Highest RPM per impression, opt-in only. |
| Telegram Mini App | nothing | Needs only an HTTPS URL; Telegram Stars for IAP. |
| House ads | nothing | Already implemented — promotes your own catalogue. |

Free-tier ceilings to watch: Pages 500 builds/month, Workers 100k requests/day
(unused — puzzles are generated at build time), R2 10 GB.

---

## Submitting to the portals

**itch.io** — create a project, upload a zip of the built game, tick "This file
will be played in the browser". Their pages rank on Google and can host ad code.

**Poki** (developers.poki.com) and **CrazyGames** (docs.crazygames.com) both take
a zipped HTML5 build and run their own SDK. The engine detects `window.poki` or
`window.CrazyGames` at runtime and routes ad calls to them automatically — see
`src/engine/ads.ts`. Build a standalone zip per game with:

```bash
npm run build
cd dist && zip -r ../snake.zip games/snake index.html assets/ styles.css favicon.svg
```

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
| `npm run typecheck` | `tsc --noEmit` |
| `npm run daily` | Print today's puzzle + answers |
