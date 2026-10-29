/**
 * Deprecated entry point. The harvest pipeline is scripts/harvest/cli.mjs.
 *
 *   node scripts/harvest-games.mjs sweep      -> node scripts/harvest/cli.mjs sweep
 *   node scripts/harvest-games.mjs vendor     -> node scripts/harvest/cli.mjs vendor
 *   node scripts/harvest-games.mjs validate   -> node scripts/harvest/cli.mjs validate
 *   node scripts/harvest-games.mjs generate   -> node scripts/harvest/cli.mjs import
 *   node scripts/harvest-games.mjs all        -> node scripts/harvest/cli.mjs all
 *
 * This file is a forwarding shim and nothing else. It exists for exactly two
 * callers that still name it and that this change may not edit:
 *
 *   - scripts/harvest/batch.mjs spawns `harvest-games.mjs vendor`, and the
 *     docs (README.md, docs/HARVEST.md) tell people to run its phases;
 *   - tests/legacy-pipeline.test.js imports generate(), resolveEntry(),
 *     planValidation(), safeEntry() and PUBLISHED_COMMENT from it.
 *
 * Everything is re-exported from scripts/harvest/cli.mjs, so there is one
 * implementation of each: the query list, licence map, slugify, shouldAccept
 * copy, vendor implementation, README scraper, category rules and generate()
 * body that used to live in this file now come from scripts/harvest/*.
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { main } from './harvest/cli.mjs';

export * from './harvest/cli.mjs';

const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return process.argv[1].endsWith('harvest-games.mjs');
  }
})();

if (invokedDirectly) await main(process.argv.slice(2));
