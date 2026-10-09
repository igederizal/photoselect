# Foto Contoh untuk Mode Demo

Folder ini hanya dipakai untuk **mode demo**, yaitu saat situs dibuka dengan
alamat berakhiran `?demo=1`. Isinya tidak pernah masuk ke database sungguhan
dan tidak pernah diunggah ke Google Drive.

## Isi folder

| Berkas | Keterangan |
|---|---|
| `photos.js` | Daftar 14 foto contoh, dibaca `demo-mode.js` |
| `demo-mode.js` | Logika mode demo: data klien contoh dan pengganti pemanggilan server |
| `img/p01-s.jpg` … `p14-s.jpg` | Ukuran 640 px, untuk grid di layar |
| `img/p01-l.jpg` … `p14-l.jpg` | Ukuran 1024 px, untuk perbesar (lightbox) |

Dua ukuran dipakai agar halaman tetap ringan di HP, sama seperti foto
sungguhan yang diproses server.

## Cara memakai

```
https://myhistoria-portal.vercel.app/?demo=1
```

| Peran | Password |
|---|---|
| Admin | `demoadmin` |
| Klien (Fauziyah & Rizal) | `Fauzi8Riz` |
| Klien (Ahmad & Sinta) | `Ahmad24Snt` |
| Klien (Bagus & Laras) | `Bagus17Lrs` |
| Klien (Dimas & Ayu) | `Dimas30Ayu` |

Tanpa `?demo=1`, situs berjalan seperti biasa dan memakai data sungguhan.

## Yang tidak berfungsi di mode demo

| Fitur | Kenapa |
|---|---|
| Pilih Foto / Import Folder dari Google Drive | Perlu akun Google dan token asli |
| Salin ke Folder Drive | Folder sungguhan tidak dibuat, hanya simulasi |
| Hapus Folder Salinan | Tidak ada folder sungguhan yang dihapus |
| Foto masuk ke database | Semua perubahan hanya ada di memória browser |

## Membuat ulang foto contoh

Kalau `img/` perlu dibuat ulang, jalankan dari folder proyek:

```bash
node gen-demo.js
```

Skrip ini membaca sumber dari `preview/img/web/`, memotong ukuran, lalu
menulis `img/` dan `photos.js` sekaligus.

## Menghapus mode demo

Tambahkan `demo` ke `.vercelignore`, lalu hapus dua baris `<script>` di
`index.html` yang memuat `demo/photos.js` dan `demo/demo-mode.js`.
## Sumber foto

Semua foto contoh diambil dari [StockSnap](https://stocksnap.io), lisensi
bebas pakai tanpa syarat kredit. Daftar berikut tetap disertakan
sebagai catatan asal-usul gambar.

| Berkas di demo/img | Isi | Fotografer | Sumber |
|---|---|---|---|
| `p01-s.jpg` / `p01-l.jpg` | Wedding Bride | Jeremy Wong | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/KBSWTHYXXH.jpg) |
| `p02-s.jpg` / `p02-l.jpg` | Bride Groom | Tom Pumford | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/ZCTAYYQSLM.jpg) |
| `p03-s.jpg` / `p03-l.jpg` | Wedding Couple | Jeremy Wong | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/YJHZWANTEG.jpg) |
| `p04-s.jpg` / `p04-l.jpg` | Wedding Rings | Rickopan | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/KH7YRRTVTS.jpg) |
| `p05-s.jpg` / `p05-l.jpg` | Wedding Rings | Birch Landing Home | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/C1ZAW5IMSC.jpg) |
| `p06-s.jpg` / `p06-l.jpg` | Wedding Rings | Matt Bango | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/DMPJHGKK6E.jpg) |
| `p07-s.jpg` / `p07-l.jpg` | Wedding Ring | Birch Landing Home | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/WZQVVNDMIQ.jpg) |
| `p08-s.jpg` / `p08-l.jpg` | Wedding Rings | Birch Landing Home | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/G1TSJYDKVM.jpg) |
| `p09-s.jpg` / `p09-l.jpg` | Wedding Rings | Candace McDaniel | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/U2PHHMFDI2.jpg) |
| `p10-s.jpg` / `p10-l.jpg` | Juice Cocktails | Fernando Arcos | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/3YELAUQN98.jpg) |
| `p11-s.jpg` / `p11-l.jpg` | Bride Groom | - | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/ZCTAYYQSLM.jpg) |
| `p12-s.jpg` / `p12-l.jpg` | Cake Weddingday | - | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/YZFKHEEDQF.jpg) |
| `p13-s.jpg` / `p13-l.jpg` | Cake Wedding | - | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/SK0MVDCLRY.jpg) |
| `p14-s.jpg` / `p14-l.jpg` | Cakecut Wedding | - | [StockSnap](https://cdn.stocksnap.io/img-thumbs/960w/TLBIHPDMKL.jpg) |

