# ⭐ Starstruck

A tiny, fast arcade game in a single HTML file. Steer a comet with your mouse or
finger, catch stars to chain combos, dodge asteroids, and grab gold stars for a
shield — or something better.

**▶️ [Play it here](https://pjo.github.io/starstruck/)**

## How to play

- **Move** — mouse, touch, or arrow keys / `WASD`
- **Catch stars** — chain them within the combo window to score up to **×8**
- **Gold stars** — grant a shield, or trigger a **STARSTRUCK!** frenzy
- **Dodge asteroids** — a hit costs a life (or your shield)
- **Pause** — `P` or `Esc`

Your best score is saved locally in the browser.

## Global leaderboard

Sign in with a magic link (just your email — no password), pick a username, and
your best scores land on a global Top 10. Auth and storage are handled by
[Supabase](https://supabase.com); the game itself stays a static file on GitHub
Pages and talks to Supabase over HTTPS. Row-level security ([`supabase/schema.sql`](supabase/schema.sql))
ensures players can only write their own scores, and emails are never exposed.

The leaderboard degrades gracefully: with no backend configured the game is
fully playable and simply shows "coming soon".

### Wiring up the backend

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql).
3. In **Authentication → URL Configuration**, add the Pages URL
   (`https://pjo.github.io/starstruck/`) as both the Site URL and a Redirect URL.
4. Put the project's **URL** and **anon/public key** (Settings → API) into the
   config block at the bottom of [`index.html`](index.html).

## Tech

No build step, no dependencies. Rendering (Canvas 2D), procedural audio (Web
Audio API), and game logic all live in [`index.html`](index.html); the
leaderboard uses the Supabase JS client loaded from a CDN. Just open the file in
a browser to play.

## Development

```sh
# Serve locally (any static server works)
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deployment

Pushing to `main` automatically publishes to GitHub Pages via the workflow in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

## License

[MIT](LICENSE)
