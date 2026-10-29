// Bundles index.html + src/*.js into single self-contained HTML files.
//   node build.js
// dist/wallbrawl-standalone.html  → full document, open anywhere
// dist/wallbrawl.html             → body-only fragment for claude.ai Artifacts
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/<script src="(src\/[^"]+)"><\/script>/g, (m, p) =>
  '<script>\n' + fs.readFileSync(path.join(root, p), 'utf8') + '\n</script>');

const artifact = html
  .replace(/^[\s\S]*?<head>/, '')
  .replace(/<\/head>\s*<body>/, '')
  .replace(/<\/body>\s*<\/html>\s*$/, '')
  .replace(/<meta[^>]*>\s*/g, '');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'wallbrawl-standalone.html'), html);
fs.writeFileSync(path.join(root, 'dist', 'wallbrawl.html'), artifact);
console.log('Built dist/wallbrawl-standalone.html and dist/wallbrawl.html');
