/**
 * Repairs for vendored third-party games.
 *
 *   node scripts/embed-fixes.mjs            # fix third-party/ in place
 *   node scripts/embed-fixes.mjs --dist     # fix the built copy in dist/
 *
 * A vendored game is written to run from the root of its own repository. As
 * soon as it is served from /third-party/<name>/, three things break:
 *
 *   1. Root-absolute references ("/scripts/main.js") ask the site root for a
 *      file that lives inside the game folder, so the script never loads.
 *   2. References to a file that moved into a sub-folder upstream
 *      ("nokiafc22.ttf" when it now lives in FontFiles/) 404.
 *   3. Script tags for files the author deleted upstream stay in the page
 *      and throw a 404 on every load.
 *
 * All three are repaired here, generically: a repair only fires when the
 * target file actually exists inside the game folder, so nothing is guessed.
 * Every change is written into that game's ARCADEFORK-NOTICE.md, because the
 * vendored copy is no longer byte-for-byte upstream.
 *
 * Resolution bases follow the HTML spec, which matters:
 *   - a reference in an HTML file resolves against that file's directory
 *   - a reference in a CSS file resolves against that file's directory
 *   - a reference in a JavaScript file resolves against the *document*,
 *     not against the script, so it is resolved against the game root
 */
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targetRoot = process.argv.includes('--dist')
  ? join(root, 'dist/third-party')
  : join(root, 'third-party');

const TEXT_EXT = new Set(['.html', '.htm', '.js', '.mjs', '.css']);

/** Folders that are never part of the playable game. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'docs', 'doc', 'test', 'tests', '__tests__',
  'example', 'examples', 'demo', 'demos', 'src', 'lib',
]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Every file in the game, indexed by its base name. */
function indexFiles(gameDir) {
  const map = new Map();
  for (const file of walk(gameDir)) {
    const rel = relative(gameDir, file).split('\\').join('/');
    const base = rel.split('/').pop();
    if (!map.has(base)) map.set(base, []);
    map.get(base).push(rel);
  }
  return map;
}

/**
 * Where does `ref` point, and where should it point?
 *
 * @returns {{target: string, changed: boolean}|null} null when the file
 *          cannot be found in the game folder at all.
 */
function locate(map, ref, gameDir, baseRel) {
  const clean = ref.split(/[?#]/)[0];
  if (!clean) return null;

  const norm = (p) => p.split('\\').join('/').replace(/^\.\//, '');

  // 1. Root-absolute. The browser asks the site root for this, which is
  //    never where a vendored game's files live, so the reference is broken
  //    unless the file is in the game folder - and then it must become
  //    document-relative.
  if (clean.startsWith('/')) {
    const inside = norm(clean);
    if (existsSync(join(gameDir, inside))) {
      return { target: inside, changed: true };
    }
    return null;
  }

  // 2. Exactly as written, relative to the base.
  const direct = norm(join(baseRel, clean));
  if (existsSync(join(gameDir, direct))) {
    return { target: direct, changed: false };
  }

  // 3. The file moved into a sub-folder. Only accept a unique match, and
  //    never guess when a file with that name sits next to the reference.
  const base = clean.split('/').pop();
  const hits = (map.get(base) ?? []).filter((p) => {
    if (p === direct) return false;
    if (dirname(p) === dirname(direct)) return false;
    return p.endsWith('/' + base);
  });
  if (hits.length === 1) return { target: hits[0], changed: true };

  return null;
}

/**
 * Rewrite `ref` so it points at `target`, keeping the query and hash.
 *
 * `from` and `target` are paths relative to the game folder, so the
 * computation is anchored there - never against the process working
 * directory, which lives somewhere else entirely.
 */
function refFor(ref, target, from, gameDir) {
  const suffix = ref.slice(ref.split(/[?#]/)[0].length);
  const rel = relative(join(gameDir, from), join(gameDir, target)).split('\\').join('/');
  const path = rel.startsWith('.') ? rel : './' + rel;
  return path + suffix;
}

/** Normalise a path for comparison and for join(). */
function normPath(p) {
  return p.split('\\').join('/').replace(/^\.\//, '');
}

const ATTR = /(\b(?:src|href)\s*=\s*)(["'])([^"']+)\2/gi;
const CSS_URL = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;
/**
 * A path written as a string inside JavaScript, e.g. "/sounds/blip.mp3" or
 * "/sounds/". JavaScript resolves those against the document, so a
 * root-absolute one is just as broken as a root-absolute src.
 */
const JS_PATH = /(["'`])(\/[A-Za-z0-9_\-./]*[A-Za-z0-9_\-])(["'`])/g;

/**
 * @param {string} file     absolute path
 * @param {string} gameDir  absolute path of the game folder
 * @param {Map} map         file index of the game folder
 * @param {string} baseRel  directory the references resolve against
 */
function repairFile(file, gameDir, map, baseRel) {
  const raw = readFileSync(file, 'utf8');
  const changes = [];

  const rewrite = (ref) => {
    if (!ref) return null;
    if (/^(https?:)?\/\//i.test(ref)) return null;
    if (/^(data:|mailto:|tel:|javascript:|#)/i.test(ref)) return null;
    // A reference with stray whitespace (" main2.js") is a typo the author
    // shipped. The trimmed name is what the browser should have asked for.
    const trimmed = ref.trim();
    if (trimmed !== ref && trimmed) {
      const found = locate(map, trimmed, gameDir, baseRel);
      if (found) {
        const next = refFor(trimmed, found.target, baseRel, gameDir);
        changes.push(`${JSON.stringify(ref)} -> ${next}`);
        return next;
      }
    }
    const found = locate(map, ref, gameDir, baseRel);
    if (!found) return null;
    if (!found.changed) return null;
    const next = refFor(ref, found.target, baseRel, gameDir);
    if (next === ref) return null;
    changes.push(`${ref} -> ${next}`);
    return next;
  };

  let html = raw.replace(ATTR, (match, prefix, quote, ref) => {
    const next = rewrite(ref);
    return next === null ? match : `${prefix}${quote}${next}${quote}`;
  });

  if (file.endsWith('.css')) {
    html = html.replace(CSS_URL, (match, quote, ref) => {
      const next = rewrite(ref);
      return next === null ? match : `url(${quote}${next}${quote})`;
    });
  }

  if (file.endsWith('.js') || file.endsWith('.mjs')) {
    html = html.replace(JS_PATH, (match, open, ref, close) => {
      // A route, a URL path or a config value is not a file reference. Only
      // a path that names a file inside the game is repaired.
      if (!/\.[A-Za-z0-9]{1,6}$/.test(ref)) return match;
      const found = locate(map, ref, gameDir, baseRel);
      if (!found || !found.changed) return match;
      const next = refFor(ref, found.target, baseRel, gameDir);
      if (next === ref) return match;
      changes.push(`${ref} -> ${next}`);
      return `${open}${next}${close}`;
    });
  }

  if (html !== raw) {
    writeFileSync(file, html);
    return changes;
  }
  return [];
}

/**
 * Remove <script src="..."> tags whose target is not in the game folder.
 *
 * The author deleted the file upstream and left the tag behind, so every
 * load throws a 404 for a script that is no longer needed.
 */
function dropDeadScripts(file, gameDir, map, baseRel) {
  // Only real markup is markup. A <script> tag inside a JavaScript template
  // string is a swagger snippet, not a script the page loads.
  if (!/\.html?$/i.test(file)) return [];

  const raw = readFileSync(file, 'utf8');
  const removed = [];
  const html = raw.replace(
    /<script\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>\s*<\/script>/gi,
    (match, quote, ref) => {
      if (!ref) return match;
      if (/^(https?:)?\/\//i.test(ref)) return match;
      if (/^(data:)/i.test(ref)) return match;
      if (/\$\{|\{\{|\bundefined\b|\[object/i.test(ref)) return match;
      if (locate(map, ref, gameDir, baseRel)) return match;
      if (!/\.m?js$/i.test(ref)) return match;
      removed.push(ref);
      return '';
    },
  );
  if (html !== raw) {
    writeFileSync(file, html);
    return removed;
  }
  return [];
}

const NOTICE = 'ARCADEFORK-NOTICE.md';

/**
 * Repairs the generic rules cannot make safely, listed one by one.
 *
 * A path built at runtime ("/sounds/" + fileName) cannot be resolved by
 * looking at the file system, and a path that also names a server route
 * cannot be repaired blindly. Those are handled here, by hand, per game.
 */
const PER_GAME = {
  'aerolab-blockrain-js': [
    {
      file: 'demo.html',
      from: "theme: 'individual'",
      to: "theme: 'custom'",
      why: "the 'individual' theme has no block images, so the game threw on every frame",
    },
  ],
  'parzibyte-hangman-javascript': [
    {
      file: 'index.html',
      insertBefore: '<script src="js/vue.min.js"></script>',
      insert: `<script>
/* arcadefork: the game keeps its word list in localStorage and refuses to
   start without one, so a first-time player got a redirect to the word
   manager instead of a game. Seed a starter list when there is none. */
(function () {
  try {
    if (localStorage.getItem('words')) return;
    localStorage.setItem('words', JSON.stringify([
      'APPLE', 'BRIDGE', 'CANDLE', 'DREAM', 'EAGLE', 'FLAME', 'GRAPE',
      'HONEY', 'IVORY', 'JADE', 'KETTLE', 'LEMON', 'MAPLE', 'NIGHT',
      'OCEAN', 'PIANO', 'QUICK', 'RIVER', 'STONE', 'TIGER', 'UMBRA',
      'VIOLET', 'WATER', 'YARDEN', 'ZEBRA',
    ]));
  } catch (e) {
    /* private mode - the game will ask for its own words */
  }
})();
</script>`,
      why: 'the game has no word list until the player builds one',
    },
  ],
  'stared-quantum-game': [
    {
      file: 'js/sound_service.js',
      from: '`/sounds/${def.file}`',
      to: '`sounds/${def.file}`',
      why: 'the sound paths are built at runtime, so the generic rules cannot see them',
    },
    {
      file: 'build.js',
      from: '"/sounds/"+',
      to: '"sounds/"+',
      why: 'the bundled build has the same runtime-built sound paths',
    },
  ],
  /* A file the author referenced but never committed is a 404 on every load.
     The reference is dropped; the element itself stays because the game's own
     script looks it up by id. */
  'simonlc-tetr-js': [
    {
      file: 'index.html',
      from: '<video id=bg src=bg.webm loop autoplay></video>',
      to: '<video id=bg loop autoplay></video>',
      why: 'bg.webm was never committed upstream, so every load asked for a file that cannot exist',
    },
  ],
  'humage-virtual-weiqi-go-surround-chess': [
    {
      file: 'css/weiqi.css',
      from: '#888 url(../image/chinese-ink-painting.jpg) no-repeat center center',
      to: '#888 no-repeat center center',
      why: 'chinese-ink-painting.jpg is not in the repository',
    },
    {
      file: 'index.html',
      from: '<img src="games/chess/image/virtual-weiqi-screenshot.jpg" alt="WeiQi Chinese Chess screenshot"> ',
      to: '',
      why: 'the screenshot it points at is not in the repository',
    },
  ],
};

function applyPerGame(name, gameDir, notes) {
  for (const fix of PER_GAME[name] ?? []) {
    const path = join(gameDir, fix.file);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, 'utf8');

    // A snippet is inserted before a marker.
    if (fix.insertBefore) {
      if (!raw.includes(fix.insertBefore)) continue;
      if (raw.includes(fix.insert)) continue; // already applied
      writeFileSync(path, raw.replace(fix.insertBefore, `${fix.insert}\n${fix.insertBefore}`));
      notes.push(`\`${fix.file}\`: inserted a starter word list (${fix.why})`);
      continue;
    }

    if (!raw.includes(fix.from)) continue;
    writeFileSync(path, raw.split(fix.from).join(fix.to));
    notes.push(`\`${fix.file}\`: \`${fix.from}\` -> \`${fix.to}\` (${fix.why})`);
  }
}

function appendNotice(gameDir, lines) {
  if (!lines.length) return;
  const path = join(gameDir, NOTICE);
  const marker = '## Local repairs';
  const fresh = lines.map((l) => `- ${l}`).join('\n');
  let text = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (text.includes(marker)) {
    // Already documented: replace the block so re-running does not duplicate.
    text = text.replace(new RegExp(`${marker}\\n[\\s\\S]*$`), `${marker}\n\n${fresh}\n`);
  } else {
    text = text.trimEnd() + `\n\n${marker}\n\n${fresh}\n`;
  }
  writeFileSync(path, text);
}

function main() {
  if (!existsSync(targetRoot)) {
    console.error(`embed-fixes: ${targetRoot} does not exist`);
    process.exit(1);
  }

  const games = readdirSync(targetRoot).filter((d) => statSync(join(targetRoot, d)).isDirectory());

  let total = 0;
  for (const name of games) {
    const gameDir = join(targetRoot, name);
    const map = indexFiles(gameDir);
    const notes = [];

    for (const file of walk(gameDir)) {
      const ext = file.slice(file.lastIndexOf('.'));
      if (!TEXT_EXT.has(ext)) continue;
      const fileRel = relative(gameDir, file).split('\\').join('/');
      if (fileRel.endsWith('.map')) continue;

      // HTML and CSS resolve against their own directory; JavaScript
      // resolves against the document that loads it, which is the nearest
      // index.html at or above the script.
      let baseRel;
      if (ext === '.js' || ext === '.mjs') {
        const dir = dirname(fileRel);
        baseRel =
          dir !== '.' && existsSync(join(gameDir, dir, 'index.html')) ? dir : '';
      } else {
        baseRel = dirname(fileRel);
      }

      // Repair first: a reference with stray whitespace is a typo that the
      // repair fixes, and only a reference that stays unresolvable is dead.
      for (const c of repairFile(file, gameDir, map, baseRel)) {
        notes.push(`\`${fileRel}\`: ${c}`);
      }
      for (const d of dropDeadScripts(file, gameDir, map, baseRel)) {
        notes.push(`\`${fileRel}\`: removed a dead <script> tag for \`${d}\``);
      }
    }

    // Repairs the generic rules cannot make are applied by hand.
    applyPerGame(name, gameDir, notes);

    if (notes.length) {
      appendNotice(gameDir, notes);
      total += notes.length;
      console.log(`  ${name}: ${notes.length} repair(s)`);
    }
  }

  console.log(
    `embed-fixes: ${total} repair(s) across ${games.length} games in ${relative(root, targetRoot)}/`,
  );
}

main();
