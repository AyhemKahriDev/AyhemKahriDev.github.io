# Name check — evidence behind the choice of `spielkunst`

Measured 2026-10-30 in `/home/ayhem/hermes/projects/arcadefork`. Every table below is a record of real output, not a recollection. Re-run the commands before trusting them: `pages.dev` subdomains are unclaimed, not reserved, so a free name can be taken tomorrow.

## Method

A name has to be free in three namespaces that matter for a zero-budget static site:

| Namespace | Why | Free looks like |
| --- | --- | --- |
| `https://<name>.pages.dev` | the free host; the Cloudflare Pages **project name** is the public URL | HTTP `000` (no DNS record). `200` = a project owns it. `404`/`5xx` = treat as taken |
| `https://api.github.com/orgs/<name>` | the repo lives in an org | `404` |
| `https://registry.npmjs.org/<name>` | cheap proxy for "a software product already uses this word" | `404` |

```bash
for n in spielkunst; do
  pd=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$n.pages.dev")
  npm=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://registry.npmjs.org/$n")
  org=$(gh api "/orgs/$n" --silent -i 2>/dev/null | head -1 | grep -q 404 && echo FREE || echo TAKEN)
  printf '%-11s pages=%s npm=%s org=%s\n' "$n" "$pd" "$npm" "$org"
done
```
Result for the chosen name:
```
spielkunst  pages=000 npm=404 org=FREE
```

Two method notes that cost a round to learn:

- **GitHub *usernames* are not the signal.** Usernames are 400 M deep and mostly taken; a project registers an **org**. An earlier round wrongly marked names down for a taken username (`stellarpit`, `cabinette`, `quartern`, `coinpit`, `ludera`, `jocari`, `voidnest`).
- **The method needs a control.** `000` must mean "free", not "my curl is broken":
  ```bash
  curl -s -o /dev/null -w 'taken:%{http_code}\n' https://arcadefork.pages.dev                     # 200
  curl -s -o /dev/null -w 'nonsense:%{http_code}\n' https://qzxvbplk.pages.dev                     # 000
  ```

## What four rounds measured

| Round | Register | Generated | Free in all three |
| --- | --- | --- | --- |
| 1 | `-kade` coinages | 30 | 6 (4 with a caveat) |
| 2 | star names, "play" in ten languages, Arabic roots, zero-promise words | 35 | 1 |
| 3 | constellations; arcade & board-game vocabulary; compounds | 52 | 16 |
| 4 | English verbs of play, cabinet sounds, German compounds, Latin roots, non-cliché astronomy | 63 | 15 (2 clean after search) |
| 5 | German `Spiel-` compounds and astronomy (**the chosen register**) | 16 | 14 |

The finding, stated once: **any name that is short, common and meaningful is already owned.** What stays free is an obscure word, a compound, or a name you already own.

## The three checks a script cannot run

Each of these killed a candidate that had passed every infrastructure test.

1. **Association.** `kurzweil` — German for "pastime", free everywhere. Ray Kurzweil exists. Dead.
2. **Slang in the language the URL is read in.** `spielkunst` is fine; `spielzeug` / `spielplatz` carry `spiel`, which reads as "a sales pitch" to English speakers. Notable but acceptable for a German word.
3. **Ownership in-category.** `spielkunst.itch.io` — an artist's videogame-art account (Johannes Davies). `dicewell` — "a free browser game to play & remix" on 8x.gg. `moonhollow` — a Steam game. `starhollow` — a Minecraft SMP server. `spielkunst`'s collision is the softest of these (one person, not a product), and it was accepted deliberately.

## Say-it-aloud, three languages

| Name | German | French ear | Arabic | Length |
| --- | --- | --- | --- | --- |
| spielkunst | SHPEE L-kunst | "spiel-kunst", `kunst` ≈ art | شبيل كونست | 10 ASCII |

No umlaut, no ß — a clean URL and a clean wordmark.

## The decision

`spielkunst`, chosen for the German signal (the operator is learning German and relocating to Germany) over `cavort` and `capriole`, which were cleaner but carried no personal meaning. The full trade — the itch.io artist, the §8 MarkenG descriptiveness — is recorded in `docs/BRAND.md`.
