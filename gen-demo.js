// Generate folder demo/: versi foto contoh untuk mode demo di web.
// Sumber: preview/img/web (foto StockSnap, lisensi bebas pakai).
// Credit lengkap: demo/CREDITS.md
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'preview', 'img', 'web');
const OUT = path.join(__dirname, 'demo', 'img');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// 14 foto: pengantin, cincin, kue, dekorasi acara
const NAMES = ['w01', 'w03', 'w04', 'w05', 'w06', 'w07', 'w08',
               'w09', 'w10', 'w11', 'x01', 'x02', 'x03', 'x04'];

// nama file asli, supaya terlihat seperti hasil edit dari kamera
const FILENAME = {
  w01: 'DSC_0412.jpg', w03: 'DSC_0438.jpg', w04: 'DSC_0451.jpg',
  w05: 'DSC_0477.jpg', w06: 'DSC_0490.jpg', w07: 'DSC_0503.jpg',
  w08: 'DSC_0519.jpg', w09: 'DSC_0534.jpg', w10: 'DSC_0548.jpg',
  w11: 'DSC_0562.jpg', x01: 'DSC_0577.jpg', x02: 'DSC_0591.jpg',
  x03: 'DSC_0608.jpg', x04: 'DSC_0622.jpg'
};

const SIZE_GRID = 640;   // untuk grid di layar
const SIZE_ZOOM = 1024;  // untuk perbesar

(async () => {
  const rows = [];
  for (let i = 0; i < NAMES.length; i++) {
    const base = NAMES[i];
    const src = path.join(SRC, base + '.jpg');
    if (!fs.existsSync(src)) { console.log('LEWATI (tidak ada):', base); continue; }

    const img = sharp(src, { failOn: 'none' });
    const meta = await img.metadata();

    const gridName = `p${String(i + 1).padStart(2, '0')}-s.jpg`;
    const zoomName = `p${String(i + 1).padStart(2, '0')}-l.jpg`;

    await img.clone()
      .resize({ width: SIZE_GRID, height: SIZE_GRID, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(path.join(OUT, gridName));

    await img.clone()
      .resize({ width: SIZE_ZOOM, height: SIZE_ZOOM, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(path.join(OUT, zoomName));

    const ratio = meta.width && meta.height ? (meta.width / meta.height) : 1.5;
    rows.push({ src: base, ratio: Number(ratio.toFixed(4)) });
  }

  // tulis manifest untuk mode demo
  const lines = rows.map((r, i) => {
    const n = String(i + 1).padStart(2, '0');
    return `  { id: 'demo-${n}', name: '${FILENAME[r.src]}', thumb: 'demo/img/p${n}-s.jpg', `
         + `zoom: 'demo/img/p${n}-l.jpg' }`;
  });
  const js = '// dibuat oleh gen-demo.js - jangan diedit manual\n'
    + 'window.DEMO_PHOTOS = [\n' + lines.join(',\n') + '\n];\n';
  fs.writeFileSync(path.join(__dirname, 'demo', 'photos.js'), js);

  console.log('dibuat ' + rows.length + ' foto (grid + zoom) -> demo/img');
  console.log('manifest -> demo/photos.js');
  rows.forEach((r, i) => console.log('  p' + String(i + 1).padStart(2, '0') + ' <- ' + r.src + '  rasio ' + r.ratio));
})();