/**
 * Deploy the built site to Cloudflare Pages -> arcadefork.pages.dev
 *
 *   npm run build && npm run deploy:cloudflare
 *
 * Needs CLOUDFLARE_API_TOKEN and (optionally) CLOUDFLARE_ACCOUNT_ID in the
 * environment. The token is read from the environment first, then from
 * ~/.cf_token so it never has to appear in a chat transcript.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const project = process.env.CF_PAGES_PROJECT ?? 'arcadefork';
// Account ids are not secrets - they appear in dashboard URLs and API calls.
const account = process.env.CLOUDFLARE_ACCOUNT_ID ?? '881a840e88ac4b61c1ab06b87918c796';

function token() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const file = join(process.env.HOME ?? '', '.cf_token');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  console.error(
    'No Cloudflare token found.\n' +
      'Set CLOUDFLARE_API_TOKEN, or write it to ~/.cf_token',
  );
  process.exit(1);
}

function main() {
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('dist/ not found - run `npm run build` first');
    process.exit(1);
  }

  const env = {
    ...process.env,
    CLOUDFLARE_API_TOKEN: token(),
    CLOUDFLARE_ACCOUNT_ID: account,
  };

  // Confirm the token and pick up the account id if it was not supplied.
  if (!env.CLOUDFLARE_ACCOUNT_ID) {
    try {
      const out = execFileSync('npx', ['wrangler', 'whoami'], {
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const m = out.match(/([0-9a-f]{32})/i);
      if (m) env.CLOUDFLARE_ACCOUNT_ID = m[1];
      console.log('account id:', m ? m[1] : 'not found in whoami output');
    } catch {
      console.log('whoami did not report an account id, continuing without it');
    }
  }

  console.log(`deploying dist/ to Cloudflare Pages project "${project}"`);
  execFileSync(
    'npx',
    ['wrangler', 'pages', 'deploy', 'dist', '--project-name', project, '--branch', 'main'],
    { env, stdio: 'inherit' },
  );
  console.log(`\nlive at https://${project}.pages.dev`);
}

main();
