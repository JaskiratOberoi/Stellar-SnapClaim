// Usage (from app/): npm i --no-save sharp opentype.js && node scripts/brand.js .
// Regenerates assets/images/* and public/* from the mark. Needs no installed font: Fraunces is read from node_modules.
// Draws the SnapClaim mark (sage tile, Fraunces "S", a small lens) and renders every icon size.
// Text is converted to paths from the bundled Fraunces files, so no font needs to be installed.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const opentype = require('opentype.js');

const app = process.argv[2];
const regular = opentype.parse(fs.readFileSync(path.join(app, 'node_modules/@expo-google-fonts/fraunces/400Regular/Fraunces_400Regular.ttf')));
const italic = opentype.parse(fs.readFileSync(path.join(app, 'node_modules/@expo-google-fonts/fraunces/400Regular_Italic/Fraunces_400Regular_Italic.ttf')));

const SAGE = '#718B78';
const CREAM = '#F6F4EF';
const INK = '#242321';
const MUTED = '#6B675F';

/** Path data for text, placed so its bounding box is centred at (cx, cy) unless anchor says otherwise. */
function textPath(font, text, size, cx, cy, anchor = 'center') {
  // Per glyph, so a kerning pair that yields NaN cannot poison the whole word.
  const scale = size / font.unitsPerEm;
  let x = 0;
  const parts = [];
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const glyphs = font.stringToGlyphs(text);
  glyphs.forEach((g, i) => {
    const p = g.getPath(x, 0, size);
    const bb = p.getBoundingBox();
    if (p.commands.length) { x1 = Math.min(x1, bb.x1); y1 = Math.min(y1, bb.y1); x2 = Math.max(x2, bb.x2); y2 = Math.max(y2, bb.y2); }
    parts.push({ g, x });
    let adv = g.advanceWidth * scale;
    if (i < glyphs.length - 1) { const k = font.getKerningValue(g, glyphs[i + 1]); if (Number.isFinite(k)) adv += k * scale; }
    x += adv;
  });
  const w = x2 - x1, h = y2 - y1;
  const dx = anchor === 'left' ? cx - x1 : cx - x1 - w / 2;
  const dy = cy - y1 - h / 2;
  const d = parts.map(({ g, x }) => g.getPath(x + dx, dy, size).toPathData(3)).join(' ');
  return { d, width: w, height: h };
}

/** The mark: tile + glyph + lens, in a size×size box. `tile` false draws glyph and lens only. */
function mark(size, { tile = true, fg = CREAM, bg = SAGE, scale = 1 } = {}) {
  const s = size * scale;
  const off = (size - s) / 2;
  const glyph = textPath(regular, 'S', s * 0.66, off + s * 0.47, off + s * 0.5);
  const lensR = s * 0.085;
  const lensX = off + s * 0.74;
  const lensY = off + s * 0.69;
  const stroke = s * 0.03;
  return `
    ${tile ? `<rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.225}" fill="${bg}"/>` : ''}
    <path d="${glyph.d}" fill="${fg}"/>
    <circle cx="${lensX}" cy="${lensY}" r="${lensR}" fill="none" stroke="${fg}" stroke-width="${stroke}" opacity="0.92"/>`;
}

const svg = (w, h, body, bg) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}${body}</svg>`);

async function png(buffer, out, resize) {
  let img = sharp(buffer, { density: 300 });
  if (resize) img = img.resize(resize, resize);
  await img.png({ compressionLevel: 9, palette: true }).toFile(out);
  console.log('wrote', path.relative(app, out));
}

(async () => {
  const img = (f) => path.join(app, 'assets/images', f);
  const pub = (f) => path.join(app, 'public', f);
  fs.mkdirSync(path.join(app, 'public'), { recursive: true });

  // App icon: opaque tile (iOS wants no alpha).
  await png(svg(1024, 1024, mark(1024)), img('icon.png'));
  // Android adaptive: the glyph on a transparent foreground inside the safe zone, a flat background, a monochrome layer.
  await png(svg(1024, 1024, mark(1024, { tile: false, scale: 0.62 })), img('android-icon-foreground.png'));
  await png(svg(1024, 1024, '', SAGE), img('android-icon-background.png'));
  await png(svg(1024, 1024, mark(1024, { tile: false, scale: 0.62, fg: '#FFFFFF' })), img('android-icon-monochrome.png'));
  // Splash: the tile alone on transparent, drawn at the configured width.
  await png(svg(512, 512, mark(512)), img('splash-icon.png'));
  // Favicon and web icons.
  await png(svg(1024, 1024, mark(1024)), img('favicon.png'), 64);
  for (const size of [32, 180, 192, 512]) await png(svg(1024, 1024, mark(1024)), pub(`icon-${size}.png`), size);
  // Maskable: the tile fills the canvas, glyph within the safe zone.
  await png(svg(1024, 1024, `<rect width="1024" height="1024" fill="${SAGE}"/>${mark(1024, { tile: false, scale: 0.7 })}`), pub('icon-maskable-512.png'), 512);

  // Social card: mark, wordmark, tagline on the cream ground.
  const word = textPath(regular, 'SnapClaim', 150, 400, 265, 'left');
  const tag = textPath(italic, 'Snap the bill. Clear the claim.', 54, 400, 365, 'left');
  const line = textPath(regular, 'Expense claims for Qugen Pathlabs', 34, 400, 440, 'left');
  const og = svg(1200, 630, `
    <g transform="translate(140,195)">${mark(240)}</g>
    <path d="${word.d}" fill="${INK}"/>
    <path d="${tag.d}" fill="${MUTED}"/>
    <path d="${line.d}" fill="${MUTED}" opacity="0.8"/>`, CREAM);
  await png(og, pub('og.png'));
})().catch((e) => { console.error(e); process.exit(1); });
