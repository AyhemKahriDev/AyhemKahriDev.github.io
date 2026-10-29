# AGENTS.md

Conventions for any automated contributor — an agent, a script, or a human working
in a batch. They describe what this repository is, so a change that breaks one of
them is wrong even if the tests pass.

## The product rules

- **Zero running cost.** No paid services, no paid APIs, no paid hosting tier. The
  site is static files on Cloudflare Pages with the GitHub Pages repository as the
  fallback. If a change needs a server, a database, a queue or a subscription, it
  is not this project.
- **Zero new dependencies.** `package.json` has `devDependencies` only — vite, the
  Cloudflare vite plugin, typescript, wrangler, puppeteer-core — and nothing ships
  to the browser except what `src/` and `public/` contain. Do not add a runtime
  library to draw a rectangle. A new dev dependency needs a reason a reviewer can
  check: the gate cannot run without it, or it replaces a hand-rolled script that
  is already failing.
- **Static output only.** `npm run build` writes `dist/` and that is the
  artefact. No SSR, no client-side data fetching from a third party, no
  `fetch()` to an API the site does not own.
- **Every game is free to play.** No paywall, no sign-up wall, no "unlock the full
  game", no interstitial, no ad before a game starts. Games are open source
  vendored with their licences, or engine games written here.
- **Every game is playable with one thumb.** Phone first: a game must be playable
  with one hand on a phone held upright. That means the on-screen pad or native
  touch handling, no pull-to-refresh swallowing a swipe, and no control that needs
  a mouse. `npm run check:mobile` is the gate; a game that only works with a
  keyboard is not finished.

## The content rules

- **Copy must pass `npm run audit:content`.** That means no developer jargon in
  player-facing text (`npm`, `repo`, `canvas element`, `in:description`, …), no two
  games sharing a title, and no overlay pointing at an id no catalogue layer
  produced. Run it after any change to `content/`.
- **`content/games.generated.json` is machine-owned.** `npm run harvest` rewrites
  it wholesale; anything hand-written there is lost on the next sweep. Curation
  belongs in the layers above it:

  | What you want to change | Where it goes |
  |---|---|
  | Category, title or player-facing copy of any game | `content/overlays.json`, by game id |
  | A hand-picked third-party game | `content/curated.json` |
  | An engine game | `content/games.json` (or `content/engine-new.json` for a merge) |
  | Which file of a vendored repo to embed | `content/overrides.json` |
  | A repository that must never be published | `content/blocked.json` |

- **Never invent a number.** Game counts, category counts, bundle sizes and
  timings in the docs come from a command whose output is pasted next to them.
  `README.md` and `docs/HARVEST.md` are the two documents that must stay true.

## The workflow rules

- `npm test` (91 cases, no browser) and `npm run typecheck` before a commit.
  `npm run build && npm run audit && npm run smoke` before a deploy. CI runs
  typecheck, build, audit, smoke and themes; it does not run `npm test` yet, so
  that one is on you.
- Do not commit `dist/`, `.harvest/` or `.smoke/`. They are git-ignored and they
  are build products, not sources.
- A harvest writes `content/harvest-published.json` and `.harvest/`. It never
  builds and never runs a gate, so a harvest branch is not a deploy.
- Two changes touching `content/` merge badly by hand: the catalogue is ordered
  by layer and de-duplicated by id, so re-run `npm test` and `npm run
  audit:content` after any merge, not before it.
