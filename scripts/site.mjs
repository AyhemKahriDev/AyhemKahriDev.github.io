/**
 * The single source of truth for the site's identity: `content/games.json` `site`.
 *
 * The name is interpolated into 300+ generated descriptions and FAQ answers, so
 * it must never be typed a second time. Import this instead.
 */
import { readFileSync } from 'node:fs';

export const SITE = JSON.parse(
  readFileSync(new URL('../content/games.json', import.meta.url), 'utf8'),
).site;

/** The name as it appears in generated copy. */
export const SITE_NAME = SITE.name;
