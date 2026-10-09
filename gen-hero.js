// Unduh foto wedding untuk slideshow panel kiri halaman login.
// Sumber: StockSnap (lisensi bebas pakai). Credit: img/hero/CREDITS.md
//
// Jalankan:  node gen-hero.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'img', 'hero');
const TMP = path.join(__dirname, 'img', '.hero-src');

// Foto: campuran potret & lanskap, nuansa hangat, sesuai tema brand.
// Potret dipakai lebih banyak karena panel kiri lebih tinggi dari lebar,
// jadi foto lanskap-potret hanya terpotong sedikit.
const SLIDES = [
  { id: 'KBSWTHYXXH', file: 'slide-01.jpg', title: 'Wedding Bride',  creator: 'Jeremy Wong' },
  { id: 'YJHZWANTEG', file: 'slide-02.jpg', title: 'Wedding Couple', creator: 'Jeremy Wong' },
  { id: 'KH7YRRTVTS', file: 'slide-03.jpg', title: 'Wedding Rings',  creator: 'Rickopan' },
  { id: 'G1TSJYDKVM', file: 'slide-04.jpg', title: 'Wedding Rings',  creator: 'Birch Landing Home' },
  { id: 'SK0MVDCLRY', file: 'slide-05.jpg', title: 'Cake Wedding',   creator: 'StockSnap' },
  { id: 'ZCTAYYQSLM', file: 'slide-06.jpg', title: 'Bride Groom',    creator: 'Tom Pumford' },
  { id: 'TLBIHPDMKL', file: 'slide-07.jpg', title: 'Cake Cutting',   creator: 'StockSnap' }
];

const CDN = 'https://cdn.stocksnap.io/img-thumbs/960w/';

async function grab(id) {
  const res = await fetch(CDN + id + '.jpg', {
    headers: { 'User-Agent': 'Mozilla/5.0 (demo asset fetch)' }
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' untuk ' + id);
  return Buffer.from(await res.arrayBuffer());
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });

  const credits = [];
  let total = 0;

  for (const s of SLIDES) {
    const tmp = path.join(TMP, s.file);
    try {
      const buf = await grab(s.id);
      fs.writeFileSync(tmp, buf);
    } catch (e) {
      console.log('GAGAL', s.id, '-', e.message);
      continue;
    }

    const meta = await sharp(tmp).metadata();
    // 960px sudah batas maksimal StockSnap. Compres ulang supaya ringan.
    const out = await sharp(tmp, { failOn: 'none' })
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true, progressive: true })
      .toFile(path.join(OUT, s.file));

    fs.unlinkSync(tmp);
    total += out.size;
    credits.push({ file: s.file, title: s.title, creator: s.creator, id: s.id,
                   w: out.width, h: out.height, kb: Math.round(out.size / 1024) });
    console.log('  ' + s.file + '  ' + out.width + 'x' + out.height
      + '  ' + Math.round(out.size / 1024) + ' KB');
  }

  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });

  // credit
  const rows = credits.map((c) =>
    '| `' + c.file + '` | ' + c.title + ' | ' + c.creator + ' | '
    + '[StockSnap](https://stocksnap.io/photo/' + c.id.toLowerCase() + ') |');
  fs.writeFileSync(path.join(OUT, 'CREDITS.md'),
    '# Sumber foto slideshow halaman login\n\n'
    + 'Foto-foto di folder ini dipakai sebagai latar slideshow pada panel kiri\n'
    + 'halaman masuk. Semuanya dari [StockSnap](https://stocksnap.io), lisensi\n'
    + 'bebas pakai tanpa syarat kredit. Daftar berikut sebagai catatan asal-usul.\n\n'
    + 'Dibuat ulang dengan `node gen-hero.js`.\n\n'
    + '| Berkas | Isi | Fotografer | Sumber |\n|---|---|---|---|\n'
    + rows.join('\n') + '\n');

  console.log('\ntotal ' + (total / 1024 / 1024).toFixed(2) + ' MB di img/hero');
  console.log('credit -> img/hero/CREDITS.md');
})();