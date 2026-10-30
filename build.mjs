// Builds the single-file site.
//   docs/index.html  -> complete page (GitHub Pages, Google Cloud Storage, any static host, or open locally)
//   dist/artifact.html -> same page as a body fragment (for hosts that supply their own <html>/<head> wrapper)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const THREE_VERSION = '0.170.0';
const THREE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.min.js`;
const FONTS = 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;1,600&family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=MedievalSharp&family=Nunito:wght@900&family=Oswald:wght@600;700&family=Rye&display=swap';
const TITLE = 'Circleville Center Rehab';
const DESCRIPTION = "Walkable 3D concept of Circleville Center, 201-213 Lancaster Pike, after sealcoating, re-striping, a facade repaint and new Ben's Appliances and ACE Hardware signage.";

// 'three' is loaded straight from the pinned CDN URL (no import map needed); the addons are bundled.
const externalThreeOnly = {
  name: 'external-three',
  setup(b) { b.onResolve({ filter: /^three$/ }, () => ({ path: THREE_URL, external: true })); },
};

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  target: ['es2020'],
  plugins: [externalThreeOnly],
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const app = readFileSync('src/app.html', 'utf8');
const banner = readFileSync('assets/bens-banner.webp').toString('base64');

const head = `<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">`;

const scripts = `<script>
window.BENS_BANNER = "data:image/webp;base64,${banner}";
setTimeout(function () {
  if (window.__ccReady) return;
  var t = document.getElementById('loadText');
  if (t) t.textContent = 'The 3D engine could not load from cdn.jsdelivr.net. Check the internet connection and reload the page.';
}, 25000);
</script>
<script type="module">${js}</script>`;

// Full document. Unlisted: anyone with the link can open it, but search engines are asked not to index it
// (remove the robots tag to let it show up in search results).
const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
${head}
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESCRIPTION}">
</head>
<body>
${app}
${scripts}
</body>
</html>
`;
// Fragment: title first (hosts scan the first 8 KB for it)
const fragment = `${head}
${app}
${scripts}
`;

mkdirSync('docs', { recursive: true });
mkdirSync('dist', { recursive: true });
writeFileSync('docs/index.html', full);
writeFileSync('docs/.nojekyll', '');
writeFileSync('dist/artifact.html', fragment);
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`docs/index.html ${kb(full)} KB, dist/artifact.html ${kb(fragment)} KB (app js ${kb(js)} KB, banner ${(banner.length / 1024).toFixed(0)} KB)`);
