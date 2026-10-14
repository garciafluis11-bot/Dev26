#!/usr/bin/env node
// Bundles index.html, styles.css and js/*.js into one self-contained HTML file.
//   node pia-intake/build.js                 -> pia-intake/dist/privacy-check.html
//   node pia-intake/build.js out.html --fragment   (body-only output for hosts that supply their own <html>/<head>)
'use strict';
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = args.find((a) => !a.startsWith('--')) || path.join(dir, 'dist', 'privacy-check.html');

let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + fs.readFileSync(path.join(dir, 'styles.css'), 'utf8') + '\n</style>');
html = html.replace(/<script src="(js\/[\w-]+\.js)"><\/script>/g, (m, src) => {
  // Escape "</script" inside inlined code so it can't end the tag early.
  const code = fs.readFileSync(path.join(dir, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>\n' + code + '\n</script>';
});

if (fragment) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta charset[^>]*>\s*/, '')
    .replace(/<meta name="viewport"[^>]*>\s*/, '');
  // Use the first <body> and the last </body>: inlined scripts contain those strings too.
  const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
  html = head.trim() + '\n' + body.trim() + '\n';
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('Wrote ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
