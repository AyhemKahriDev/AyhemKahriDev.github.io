# Sponsorship — rate card, payment and process

The arcade stays free because a few labelled sponsor slots pay for nothing more than the
time it takes to keep publishing. This file is the internal playbook behind `/advertise/`:
what is for sale, what it costs, how payment works, and how a slot goes live.

**Current facts (update these when they change):**

- Site: <https://spielkunst.pages.dev/> (mirror: <https://ayhemkahridev.github.io/>)
- Catalogue: 551 games, 9 categories, 4 languages (EN/FR/AR/DE)
- Daily puzzle: a new grid every day at midnight UTC, with an archive
- Slots sold: **0** — every category slot and the site-wide slot are open
- Traffic: no analytics by design. Do not claim impression numbers anywhere.

## What is for sale

| Slot | Where it shows | Price |
| --- | --- | --- |
| Launch week | Any slot, one week, first month only | $5 |
| Category slot | Every page of one category + its hub | $15 / month |
| Site-wide slot | Every game and category page | $35 / month |

- One sponsor per category, enforced by hand — no two brands fight for the same card.
- A slot is a text card (or a small logo/wordmark image hosted by the sponsor) always marked
  **Sponsored**, plus one link (`rel="sponsored nofollow"`, opens in a new tab).
- No pop-ups, no interstitials, no auto-play media, no tracking scripts, ever.
- Flat price: no impressions, no bidding, no renewal traps. Month-to-month.

## What the sponsor is actually buying

Placement in front of players who came for a game or the daily puzzle — not scale. The
honest pitch is "a quiet, labelled card beside one category", and the price reflects that.
Never promise impressions or clicks we cannot count.

## Payment — invoice, paid after the slot is live

1. Sponsor sends: name, what they advertise, the link, and the category (or "site-wide").
2. We check it fits (see below) and answer the same day.
3. The slot goes live on the next build — usually the same day — and the sponsor sees it on
   the real site **before paying**.
4. Invoice is issued once live: **bank transfer or Payoneer**, USD, monthly in advance.
   No card processor, no Stripe, no platform cut.
5. Renewal is a fresh invoice each month. Cancel any time; no refunds for a month already
   running.

Invoice line that works:

> spielkunst — sponsored placement, <category/site-wide>, <month>
> One labelled sponsor card, one link. Month-to-month, cancellable.
> Amount: $<price>. Payment: bank transfer or Payoneer.

## What fits and what does not

**Fits:** games (especially ones already in the catalogue or their authors), game-dev tools,
word-game and puzzle books, education, family-friendly indie newsletters.

**Does not fit:** gambling, crypto/trading, adult content, anything aimed at children with
tracking or upsells, political campaigns, and anything that needs an ad network script.

## How a slot goes live

`content/sponsors.json` is the only file to touch:

```json
{
  "slots": [
    {
      "title": "Your Brand",
      "subtitle": "One line about the thing",
      "href": "https://example.com/?utm_source=spielkunst",
      "image": "https://example.com/logo.png",
      "categories": ["word"]
    },
    {
      "title": "Site-wide sponsor",
      "href": "https://example.com",
      "categories": []
    }
  ]
}
```

- `title` and `href` are required; `subtitle`, `image` and `categories` are optional.
- Empty `categories` = site-wide. One slot per category.
- Commit, push, CI builds and deploys. Empty slots fall back to the arcade's own games.
- Keep the sponsor's invoice and dates in the table below, not in the JSON.

## Inventory log

| Period | Slot | Sponsor | Amount | Invoice sent | Paid |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — |

## Outreach rules

- Five messages a week, maximum. Personalise every one; no bulk blasts.
- Never claim traffic, impressions or click-through numbers — we cannot measure them.
- Offer the launch-week price for the first month, then the listed monthly price.
- Send the real card on the real site before asking for money; that is the whole close.
- Keep one sponsor per category, even if two offers arrive; honesty is the product.

Send-ready messages live in [`outreach-pitch.md`](../outreach-pitch.md).
