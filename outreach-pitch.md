# Sponsor-outreach pitch (one message, send as-is)

Subject: One quiet sponsor slot on arcadefork (free games, daily puzzle)

Hi <name>,

I run arcadefork — a free browser arcade, live at https://arcadefork.pages.dev/.
Seven games, a daily word puzzle that brings the same players back every day,
and a promise I take seriously: everything stays free, no pop-ups, ever.

There is one labelled "Sponsored" card per category, shown beside that
category's games — that is the whole format. No interstitials, no tracking
scripts. You are buying a clean placement, not a flood of impressions, which is
why the price is flat and small:

- Launch week: $5 (first week, any slot)
- Category slot: $15/month
- Site-wide slot: $35/month

If that fits your thing, reply with your name, what you'd like shown and the
link, and I'll put the card live on the next build — you see it on the real
site before you pay anything.

Why you: your product is exactly the thing people who spend their break in a
word-games category would pick up (a word-puzzle book, an indie word game, a
tool teachers use, a newsletter about games). Wrong fit: anything you couldn't
explain to a nine-year-old.

— Ayhem, arcadefork

---

## Where this goes

- Candidate audiences worth one sentence each: indie dev forums (your own
  projects), word-game niches (r/wordgames, puzzle-book sellers on Gumroad),
  gamedev tool makers, education newsletters.
- cadence: 5 messages a week under one rule — never more than one slot per
  category, so the pitch stays honest ("one sponsor per category" is true).
- When someone bites: add to `content/sponsors.json` slots
  `{ title, href, subtitle, categories: ['word'] }`, run `npm run build` +
  deploy, then send the payment link.

## Working the plan without waiting

- Ko-fi tip jar (~10 min, free): create at ko-fi.com, put the profile URL into
  `content/sponsors.json` → `tips.kofi`, rebuild, footer link goes live.
- The daily-puzzle answer pages are the traffic engine: they index every day
  (30-day rolling window + sitemap). More traffic → higher slot demand → raise
  prices on renewal only, never mid-term.
EOF
