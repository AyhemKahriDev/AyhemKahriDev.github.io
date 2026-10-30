# Brand

- **Name:** `spielkunst`
- **URL:** https://spielkunst.pages.dev/
- **Meaning:** German, *the art of playing*. Chosen 2026-10-30 by the operator — a German learner relocating to Germany, for whom the name is a personal signal as well as a brand.
- **Always lowercase in copy.** It is a wordmark, not a sentence-initial noun — like `etsy` or `soundcloud`. Do not "correct" it to Spielkunst in prose.
- **Wordmark:** `spiel` in body weight, `kunst` in bold. The seam is the compound boundary, set in `scripts/shell.mjs`. A string sweep cannot produce this — it must stay hand-cut, and `tests/brand.test.js` enforces it.
- **One source of truth:** `content/games.json` → `site.name`, read through `scripts/site.mjs`. The name is interpolated into 299 generated descriptions and FAQ answers by `scripts/harvest/import.mjs`; never type it a second time.

## The trade, accepted with eyes open

Two facts were measured before the decision and are recorded here so nobody relitigates them in six months:

1. **`spielkunst.itch.io` exists** — an artist's videogame-art account ("dedicated to the exploration of the artistic potential of videogame technology", Johannes Davies). One individual, no products seen. Not a legal threat. It does mean a brand-name search surfaces them first, so **do not build traffic on the bare word**: rank on the product ("free browser games", "daily word search", category pages), not on the brand.
2. **A descriptive German compound is not registrable** as a trade mark for games (§8 MarkenG). Nobody can stop us using it; we can never stop anyone else. The mitigation is the same as above: the product is the moat, not the name.

## Rejected, with reasons (so they are not proposed again)

| Candidate | Killed by |
| --- | --- |
| `-kade` family (Cosmikade, Zerokade, Nebula9, Playeon, Orbitade…) | saturated: 6 of 30 free, 4 with a caveat |
| short real words (suhail, saiph, cygnus, igra, ludus, alea, najm…) | 34 of 35 already claimed on `pages.dev` |
| `spielstein` | spielstein.com — "Games & Puzzles by Dieter Stein", exact category |
| `spielgut` | spiel gut e.V., the Ulm toy-certification body |
| `spielkiste` | JUNIOR CLUB Spielkiste app (Europa-Park) + toy retailers |
| `wunderkammer`, `spielraum`, `spieltrieb` | taken on `pages.dev` / GitHub orgs |
| `kurzweil` | Ray Kurzweil owns the association |
| `cavort`, `capriole` | clean and free, but no personal signal — offered, not chosen |

## Method for next time

Measure `<name>.pages.dev`, `github.com/orgs/<name>`, `registry.npmjs.org/<name>`, then search the exact string **in the language the word comes from** plus English. Availability is not viability: `dicewell` passed every infrastructure check and is a browser game on 8x.gg; `moonhollow` is a Steam game. Check association (a famous person can own a word), slang in the language the URL is read in, and whether it can be said aloud after being heard once.

Evidence for every claim above: `docs/NAME-CHECK.md`.
