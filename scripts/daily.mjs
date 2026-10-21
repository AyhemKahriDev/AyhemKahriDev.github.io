/**
 * Print today's puzzle. Used by the content pipeline (social posts, reels,
 * the ad-factory capture step) so every channel publishes the same board.
 *
 *   node scripts/daily.mjs            -> today's puzzle
 *   node scripts/daily.mjs 2026-10-21 -> a specific date
 *   node scripts/daily.mjs --json     -> machine readable
 */
import content from '../content/games.json' with { type: 'json' };
import { generateWordBoard, boardAnswers, dateSeed, todayISO } from '../src/shared/daily.js';
import { themeForDate } from '../src/shared/wordlists.js';

const args = process.argv.slice(2);
const base = content.site.baseUrl.replace(/\/$/, '');
const jsonOut = args.includes('--json');
const dateArg = args.find((a) => !a.startsWith('--'));
const date = dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg) ? dateArg : todayISO();

const theme = themeForDate(date, dateSeed(date));
const board = generateWordBoard(date, theme, 10, 11);
const answers = boardAnswers(board);

if (jsonOut) {
  console.log(
    JSON.stringify(
      {
        date,
        theme: { id: theme.id, title: theme.title, accent: theme.accent },
        grid: board.grid,
        words: answers,
        url: `${base}/daily/${date}/`,
        answersUrl: `${base}/daily/${date}/answers/`,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`Daily Word Search — ${date} (${theme.title})`);
  console.log('');
  for (const row of board.grid) console.log('  ' + row.join(' '));
  console.log('');
  console.log('Words: ' + answers.map((a) => a.word).join(', '));
  console.log('');
  for (const a of answers) console.log(`  ${a.word.padEnd(12)} ${a.start} -> ${a.end}`);
  console.log('');
  console.log(`${base}/daily/${date}/`);
}
