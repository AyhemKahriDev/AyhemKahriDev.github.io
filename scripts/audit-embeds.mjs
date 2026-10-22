/**
 * Audit the catalogue for embeds that are not really games, or that could
 * navigate the player out of the arcade.
 *
 * Uses the same detector the harvest validator uses
 * (scripts/personal-page.mjs), so the rules cannot drift apart.
 *
 * Usage: node scripts/audit-embeds.mjs [--json]
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { personalPageSignals } from './personal-page.mjs';
import { refreshIsExternal } from './sanitize-embed.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const curated = JSON.parse(readFileSync(join(ROOT, 'content/games.json'), 'utf8'));
const generated = JSON.parse(readFileSync(join(ROOT, 'content/games.generated.json'), 'utf8'));
const GAMES = [...curated.games, ...(generated.games ?? generated)];

const rows = [];
for (const g of GAMES) {
  if (!g.embed?.src) continue;
  const p = join(ROOT, 'dist', g.embed.src.replace(/^\/+/, ''));
  if (!existsSync(p)) {
    rows.push({ id: g.id, verdict: 'MISSING', why: 'embed file not in the build' });
    continue;
  }
  const html = readFileSync(p, 'utf8');
  const signals = personalPageSignals(html);
  const topTarget = (html.match(/target\s*=\s*(["'])_top\1/gi) || []).length;
  // A meta refresh to somewhere else is a redirect out of the arcade. A
  // relative one is how some games hand over to their real page.
  const refresh = (html.match(/<meta\s+http-equiv=["']?refresh["']?[^>]*>/gi) || []).filter(
    refreshIsExternal,
  ).length;
  if (signals.verdict !== 'game' || topTarget || refresh) {
    rows.push({
      id: g.id,
      verdict: signals.verdict,
      identityLinks: signals.identityLinks.slice(0, 4),
      personalText: signals.personalText,
      payment: signals.payment,
      topTarget,
      refresh,
    });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else if (!rows.length) {
  console.log(`clean: ${GAMES.filter((g) => g.embed).length} embedded games, no personal pages, no top-frame links`);
} else {
  console.log(`${rows.length} embed(s) need attention:`);
  for (const r of rows) console.log(' -', r.id, JSON.stringify(r));
}
