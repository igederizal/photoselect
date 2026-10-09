# Dokumentasi Serah Terima
## Portal Seleksi Foto — MYHISTORIA

Untuk: MYHISTORIA — Wedding & Event Content Creator
Tanggal: 9 Oktober 2026
Versi: 1.0

Dokumen ini adalah panduan lengkap untuk memakai dan mengelola sistem secara utuh. Dokumen disusun dalam tiga bagian: pemakaian sehari-hari, arsitektur teknis, lalu operasional dan pemeliharaan.

---

## Daftar Isi

**Bagian A — Pemakaian**
1. Alur Kerja Harian
2. Panduan Admin (Operator)
3. Panduan Client (yang menerima tautan)
4. Keamanan dan Tindakan Wajib Sebelum Produksi

**Bagian B — Teknis**
5. Arsitektur Sistem
6. Struktur Kode dan Daftar File
7. Basis Data
8. Deployment dan CI/CD
9. Konfigurasi Environment Variable

**Bagian C — Operasional**
10. Pemeliharaan Rutin
11. Troubleshooting
12. Batasan yang Perlu Diketahui

---

# BAGIAN A — PEMAKAIAN

## 1. Alur Kerja Harian

```
ADMIN (EDITOR)                          CLIENT
───────────────                         ──────
1. Login ke panel admin
2. Tambah client        ───────→  Password dikirim via WhatsApp
3. Posting foto dari               4. Buka tautan, masuk dengan password
   Google Drive
   (satuan / folder)      ───────→  5. Lihat galeri foto acara
4. Atur batas pilihan                6. Ketuk lingkaran untuk menandai foto
   dan batas waktu         ───────→  7. Perbesar foto yang ingin dicek
5. Kirim tautan                      8. Tulis catatan untuk editor
                             ───────→  9. Tekan "Kirim Pilihan"
6. Salin foto terpilih
   ke folder Drive           Foto pilihan dan catatan langsung masuk
   "<Client>_Selected"       ke panel admin, siap diedit
```

Foto asli **tidak pernah dipindahkan** dari Google Drive. Yang disalin ke
folder `_Selected` adalah file asli berukuran penuh, sehingga kualitas cetak
untuk album 30×40 cm tetap terjaga.

---

## 2. Panduan Admin (Operator)

### 2.1 Login

1. Buka `https://myhistoria-portal.vercel.app`
2. Masukkan password admin pada kolom yang tersedia
3. Tekan **Masuk**

Sesi admin berlaku 12 jam. Setelah itu sistem meminta login ulang. Ini
memang disengaja.

### 2.2 Menambah Client Baru

1. Di bagian **Client Baru**, ketik nama client, misalnya `Budi`
2. Tekan **Tambah**
3. Password 8 karakter muncul otomatis di baris client
4. Klik password tersebut untuk menyalin, lalu kirim via WhatsApp

Password dibuat acak oleh sistem, bukan oleh Anda. Ini menjamin password
tidak bisa ditebak dan tidak pernah tersimpan di halaman web dalam bentuk
terbaca.

### 2.3 Posting Foto dari Google Drive

Pada halaman detail client, blok **Foto dari Google Drive** menyediakan tiga
tombol:

| Tombol | Fungsi |
|---|---|
| **Pilih Foto** | Pilih foto satuan atau beberapa sekaligus (Ctrl+klik) |
| **Import Folder** | Ambil seluruh isi satu folder, termasuk subfolder sampai 4 tingkat |
| **Kosongkan** | Hapus semua foto yang sudah diposting |

Setelah memilih, sistem otomatis membuat dua ukuran pratinjau untuk setiap
foto (1024 piksel untuk grid, 1600 piksel untuk perbesar) lalu menyimpan ke
server. Proses ini butuh beberapa detik untuk 200 foto, dan muncul indikator
progres di layar.

Foto yang formatnya tidak didukung (misalnya RAW tanpa konversi) akan
ditandai gagal. Periksa pesan hasil di akhir proses.

### 2.4 Mengatur Batas Pilihan dan Batas Waktu

| Pengaturan | Arti | Nilai "0" atau kosong |
|---|---|---|
| **Batas Pilihan Client** | Maksimal foto yang boleh dipilih | 0 berarti tanpa batas |
| **Batas Waktu Memilih** | Tanggal terakhir client boleh mengirim | Kosong berarti tanpa batas |

Kedua pengaturan ini bersifat opsional dan langsung berlaku tanpa tombol
simpan. Bila batas waktu diisi, client melihat hitung mundur di bar atas
galerinya.

### 2.5 Menyalin Foto Terpilih ke Google Drive

1. Pastikan client sudah menekan **Kirim Pilihan** (terlihat di panel detail)
2. Tekan **Salin ke Folder Drive**
3. Sistem membuat folder `<Nama>_Selected` di root Google Drive Anda, lalu
   menyalin file asli ke dalamnya
4. Foto yang namanya sudah ada di folder tersebut **dilewati**, bukan diduplikasi
5. Link folder otomatis tersimpan dan bisa dibuka lewat tombol **Buka Folder di Drive**

Folder yang dihapus lewat tombol **Hapus Folder Salinan** masuk ke Trash
Google Drive dan masih bisa dipulihkan selama 30 hari. Folder ini berisi
salinan saja, foto asli tidak tersentuh.

### 2.6 Mengubah Status Pengerjaan

Tiga status yang tersedia:

| Status | Arti |
|---|---|
| **Menunggu** | Client belum mengirim pilihan, atau masih memilih |
| **Diproses** | Pilihan sudah masuk, foto sedang diedit atau dicetak |
| **Selesai** | Album sudah selesai |

Gunakan filter di atas daftar client untuk melihat hanya satu status.

### 2.7 Mengubah Password Admin

Bagian **Pengaturan** → **Password admin**. Masukkan password lama dan yang
baru (minimal 6 karakter), lalu tekan **Ubah**. Password baru langsung aktif,
tidak perlu logout.

### 2.8 Menghapus Data

| Tombol | Dampak |
|---|---|
| **Hapus Client** (dalam detail) | Menghapus data client dan seluruh thumbnail-nya |
| **Hapus semua data** (Pengaturan) | Menghapus seluruh data client di database |

Keduanya tidak dapat dibatalkan. Thumbnail di server ikut terhapus agar
penyimpanan tidak menumpuk. Foto asli di Google Drive tidak pernah terhapus.

---

## 3. Panduan Client (yang menerima tautan)

Teks di dalam kotak tanda kutip bisa dikirim langsung ke client apa adanya,
atau diringkas saat dijelaskan lisan.

> Anda akan menerima **satu tautan** dari kami. Buka tautan tersebut di
> browser, HP, atau laptop. Masukkan password yang kami kirim via WhatsApp.
>
> 1. **Lihat galeri.** Semua foto acara Anda sudah tersedia. Geser ke bawah
>    untuk melihat seluruh foto.
> 2. **Tandai foto.** Ketuk **lingkaran di sudut kiri atas foto** untuk
>    menandai foto yang mau dicetak. Ketuk lagi untuk membatalkan.
> 3. **Perbesar bila perlu.** Ketuk bagian tengah foto untuk melihat versi
>    besar, lalu geser antar foto dengan tombol panah. Tombol **Pilih** di
>    bawah foto besar berguna saat foto sedang tampil besar.
> 4. **Tulis catatan.** Ada kolom "Catatan untuk Editor" di bagian bawah
>    halaman. Tulis saja permintaan Anda, misalnya "tolong yang natural, jangan
>    terlalu terang".
> 5. **Kirim.** Tekan **Kirim Pilihan ke Admin**. Selesai.
>
> Anda boleh masuk dari HP dan laptop sekaligus. Pilihan Anda yang sudah
> tersimpan akan muncul kembali setiap kali Anda membuka tautan.

**Catatan tambahan untuk client:**

- Batas jumlah foto (bila ditetapkan) tampil di bagian atas halaman
- Bila ada batas waktu, hitung mundur tampil di bar atas
- Client tidak perlu membuat akun atau memasang aplikasi apa pun

---

## 4. Keamanan dan Tindakan Wajib Sebelum Produksi

### 4.1 Yang sudah diterapkan

| Aspek | Penerapan di kode |
|---|---|
| Password client | Hash SHA-256 untuk login; salinan terenkripsi AES-256-GCM untuk ditampilkan ke admin |
| Password admin | Hash SHA-256 saja, tidak dapat dibaca kembali |
| Pemeriksaan login | Di server (`api/app.js`), tidak pernah di browser |
| Sesi admin | Token acak, berlaku 12 jam, dihapus otomatis saat kedaluwarsa |
| Sesi client | Token acak, berlaku 30 hari, maksimal 5 sesi aktif per client |
| Perbandingan password | `crypto.timingSafeEqual`, tahan serangan berbasis waktu |
| Kunci database | Hanya di environment Vercel, tidak ada di kode publik |
| Akses database | Row Level Security aktif di keempat tabel |
| Password versi lama | Kolom `password` dihapus dari database |
| Escaping input | Nama dan catatan di-escape sebelum masuk HTML |
| Batas jumlah foto | Ditegakkan di server, bukan hanya di browser |
| Batas waktu | Ditegakkan di server saat pengiriman |

### 4.2 Wajib sebelum produksi

**1. Ganti password admin bawaan.**

Password `admin1234` hanya untuk uji coba. Pola `admin` diikuti angka pendek
ada di daftar tebakan terpopuler dan akan ditemukan pemindai dalam hitungan
detik. Ganti lewat **Pengaturan → Password admin**.

**2. Batasi API key Google pada domain produksi.**

API key Google saat ini tersembed di `script.js` dan terlihat oleh siapa pun
yang membuka View Source. Ini bukan kerentanan karena key hanya dipakai untuk
membuka pemilih file, bukan untuk mengakses data. Langkah pengunciannya
tetap perlu dilakukan:

1. Buka Google Cloud Console → **APIs & Services** → **Credentials**
2. Pilih API key yang dipakai, klik **Edit**
3. Pada **Application restrictions**, pilih **HTTP referrers (websites)**
4. Tambahkan: `https://myhistoria-portal.vercel.app/*`
5. Klik **Save**

### 4.3 Penguatan yang disarankan

Dua hal berikut tidak menghalangi pemakaian, tetapi disarankan dikerjakan
sebelum sistem dipakai penuh:

**1. File thumbnail dapat diakses siapa pun yang memiliki tautannya.**

Thumbnail disimpan di bucket Supabase publik. Siapa pun yang mengetahui URL
persis suatu thumbnail dapat membukanya tanpa login. URL-nya berupa
`<SUPABASE_URL>/storage/v1/object/public/thumbs/<id_client>/<file_id>.jpg`.

Dampaknya terbatas: nama file `file_id` berasal dari Google Drive dan tidak
dapat ditebak tanpa mengetahui ID-nya. Namun foto acara bersifat pribadi,
jadi ini layak diperketat.

Cara memperketat: ubah bucket `thumbs` menjadi privat, lalu layani permintaan
gambar lewat fungsi server yang memeriksa token sesi client sebelum
mengirim file. Perubahan ini menyentuh `api/thumb.js` dan seluruh URL
thumbnail di database, jadi perlu pengujian ulang.

**2. Login belum dibatasi frekuensinya.**

Endpoint `client_login` dan `admin_login` tidak punya rate limit. Password
client 8 karakter acak cukup kuat untuk sulit ditebak secara online, tetapi
tanpa rate limit, skrip otomatis bisa mencoba tanpa batas. Yang paling
berisiko adalah akun admin, karena password admin bisa ditebak dari daftar
kata umum.

Cara memperketat: tambahkan penghitung percobaan per IP di tabel terpisah.
Tambahkan juga login dua langkah untuk admin, misalnya kode sekali pakai yang
dikirim via WhatsApp.

---

# BAGIAN B — TEKNIS

## 5. Arsitektur Sistem

| Komponen | Teknologi | Peran |
|---|---|---|
| Frontend | HTML, CSS, JavaScript murni | Antarmuka, tanpa framework |
| Backend | Node.js, Vercel Functions | Validasi, sesi, operasi database |
| Database | Supabase Postgres | Data client, sesi |
| Penyimpanan | Supabase Storage, bucket `thumbs` | Thumbnail foto |
| Sumber foto | Google Drive API v3 | Foto asli, kualitas cetak |
| Hosting | Vercel | Deploy otomatis dari GitHub |

Prinsip arsitektur utama: **password tidak pernah menyentuh kode frontend.**
Semua pemeriksaan login dan seluruh operasi database terjadi di server. Browser
hanya mengirim `action` dan `token`, tidak pernah `SUPABASE_SERVICE_ROLE_KEY`.

### Alur gambar

```
Foto asli (Google Drive, 4000–6000 px)
        │
        │  api/thumb.js menarik via Drive API, diproses dengan sharp
        ▼
    dua ukuran pratinjau:
        │
        ├── 1024 px, kualitas 80 → Supabase Storage, untuk grid
        └── 1600 px, kualitas 75 → Supabase Storage, untuk perbesar
```

Ukuran 1600 px dipilih karena hemat sekitar 54% ruang penyimpanan dibanding
2000 px, dan masih tajam untuk layar laptop.

**Foto asli tidak pernah dipindahkan.** Ketika admin menyalin pilihan ke
folder Drive, yang disalin adalah file asli, sehingga kualitas cetak 300 dpi
untuk album 30×40 cm terjaga sepenuhnya.

### Struktur database

Empat tabel, semuanya di schema `public`:

| Tabel | Isi | Akses |
|---|---|---|
| `clients` | Data client, foto, pilihan, password | `service_role` saja |
| `admin` | Hash password admin, satu baris | `service_role` saja |
| `client_sessions` | Token sesi client, berlaku 30 hari | `service_role` saja |
| `admin_sessions` | Token sesi admin, berlaku 12 jam | `service_role` saja |

---

## 6. Struktur Kode dan Daftar File

```
index.html              Halaman tunggal: login, galeri client, panel admin
style.css               Seluruh tampilan
script.js               Seluruh logika frontend dan integrasi Google
api/
  app.js                Backend: login, sesi, CRUD client, submit pilihan
  thumb.js              Ambil foto dari Drive, resize, upload ke Supabase
sql/
  01-setup.sql          Persiapan database, sudah dijalankan
  03-lockdown.sql       Aktifkan Row Level Security, sudah dijalankan
  04-deadline.sql       Tambah kolom batas waktu, opsional
  05-set-admin-password.sql  Atur password admin
preview/                Mockup desain dan tangkapan layar, tidak ikut deploy
vercel.json             Konfigurasi Vercel
package.json            Dependensi
```

Jumlah baris saat ini: `index.html` 307, `script.js` 1535, `style.css`
sekitar 1.900, `api/app.js` 453, `api/thumb.js` 91.

Dua dependensi produksi: `@supabase/supabase-js` dan `sharp`. `playwright`
hanya dipakai untuk pengujian screenshot di folder `preview`.

### Peran `server.js`

Berkas `server.js` adalah server statis sederhana untuk pratinjau lokal dan
sudah masuk `.gitignore`, jadi tidak ikut ter-deploy. Jangan dipakai di
produksi.

### Konvensi kode

- JavaScript memakai `let` dan `const`, fungsi bertipe arrow untuk callback
- Nama variabel dan komentar berbahasa Indonesia
- Setiap fungsi API berada di dalam satu blok `if (action === '...')`
- Nilai sensitif dibaca dari `process.env`, dengan fallback hanya untuk
  `SUPABASE_URL`

---

## 7. Basis Data

### Kolom penting pada tabel `clients`

| Kolom | Tipe | Fungsi |
|---|---|---|
| `id` | serial | Kunci utama |
| `name` | text | Nama client |
| `folder` | text | Nama folder Drive, format `Project_<Nama>` |
| `status` | text | `Menunggu`, `Diproses`, atau `Selesai` |
| `photos` | jsonb | Daftar foto: `{id, name, thumb, zoom}` |
| `selected_files` | jsonb | Foto yang dipilih client |
| `submitted` | boolean | Apakah client sudah mengirim |
| `note` | text | Catatan client untuk editor, maksimal 2000 karakter |
| `max_select` | integer | Batas pilihan, 0 berarti tanpa batas |
| `deadline` | timestamptz | Batas waktu memilih, null berarti tanpa batas |
| `selected_folder` | text | Link folder salinan di Drive |
| `pw_hash` | text | SHA-256 password untuk login |
| `pw_enc` | text | Password terenkripsi AES-256-GCM untuk tampilan admin |

### Batasan yang ditegakkan di server

| Batasan | Nilai | Lokasi |
|---|---|---|
| Maksimal foto per client | 5.000 | `MAX_PHOTOS` di `api/app.js:16` |
| Panjang nama client | 80 karakter | `MAX_NAME` |
| Panjang catatan | 2.000 karakter | `MAX_NOTE` |
| Batas pilihan | diperiksa ulang di server saat submit | `api/app.js:427` |
| Batas waktu | diperiksa ulang di server saat submit | `api/app.js:432` |
| Id foto yang dikirim | hanya id yang benar-benar ada di pool foto client | `api/app.js:424` |

Pengecekan batas di server penting: tanpa itu, client bisa mengirim lebih
banyak foto daripada batas yang ditetapkan dengan mengubah kode di browser.

---

## 8. Deployment dan CI/CD

### Alur kerja

```
git push ke branch master
        │
        ▼
Vercel mendeteksi perubahan secara otomatis
        │
        ▼
Build dan deploy ke myhistoria-portal.vercel.app
```

Tidak ada langkah manual. Vercel terhubung ke repository GitHub
`igederizal/photoselect`, branch `master`.

### Konfigurasi `vercel.json`

```json
{
  "buildCommand": null,
  "outputDirectory": ".",
  "cleanUrls": true,
  "functions": {
    "api/thumb.js": { "maxDuration": 60 },
    "api/app.js": { "maxDuration": 30 }
  },
  "rewrites": [{ "source": "/", "destination": "/index.html" }]
}
```

Timeout 60 detik untuk `api/thumb` penting, karena setiap permintaan
memproses 40 foto dengan 6 pekerja paralel: mengunduh, resize, lalu
mengunggah ke penyimpanan.

### Yang tidak ikut deploy

`.vercelignore` dan `.gitignore` menahan `node_modules`, `preview`, dan
`server.js` agar tidak masuk paket deploy.

---

## 9. Konfigurasi Environment Variable

Diatur di Vercel: **Settings → Environment Variables**

| Variabel | Keterangan | Wajib |
|---|---|---|
| `SUPABASE_URL` | URL project Supabase | Ya |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key, bypass RLS | Ya |
| `PW_ENC_KEY` | Kunci enkripsi AES-256-GCM, 64 karakter heksadesimal | Ya |
| `GOOGLE_CLIENT_ID` | OAuth client ID Google | Tidak, ada fallback di kode |
| `GOOGLE_API_KEY` | API key Google | Tidak, ada fallback di kode |

### Membuat `PW_ENC_KEY`

Kunci enkripsi password client. Harus tepat 64 karakter heksadesimal, yaitu
32 byte. Buat di PowerShell:

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

**Jangan pernah mengubah kunci ini setelah ada client aktif.** Password yang
sudah terenkripsi tidak akan bisa didekripsi dengan kunci berbeda, dan kolom
password di panel admin akan tampil kosong.

### Domain sendiri

Bila client membeli domain, tambahkan domain tersebut di Vercel
(**Settings → Domains**) dan perbarui satu baris di `index.html`:

```html
<meta property="og:image" content="https://DOMAIN-BARU/logo-myhistoria.png">
```

---

# BAGIAN C — OPERASIONAL

## 10. Pemeliharaan Rutin

| Kegiatan | Frekuensi | Tempat |
|---|---|---|
| Cek pemakaian penyimpanan dan bandwidth | Bulanan | Supabase Dashboard → Usage |
| Cek kuota fungsi server | Bulanan | Vercel Dashboard → Usage |
| Ganti password admin bila ada kecurigaan | Bersamaan | Panel admin → Pengaturan |
| Reset password client yang sudah selesai | Setelah acara selesai | Panel admin → detail client |
| Bersihkan folder `_Selected` di Trash Drive | Setelah 30 hari | Google Drive → Sampah |
| Hapus data client lama beserta thumbnail | Setelah 3–4 acara | Panel admin → Hapus semua data |

Pembersihan adalah bagian penting. Tanpa itu, penyimpanan 1 GB akan habis
dalam 8–10 acara. Tombol **Hapus semua data** menghapus thumbnail
sekaligus, bukan hanya baris di database.

---

## 11. Troubleshooting

### Client tidak bisa login

| Gejala | Penyebab | Solusi |
|---|---|---|
| "Password salah" | Password salah ketik | Minta client menyalin ulang dari panel admin |
| "Sesi habis, login ulang" | Sesi lebih dari 30 hari | Login ulang, pilihan sebelumnya tetap ada |
| Login berulang gagal | Kelima sesi aktif sudah tercapai | Tunggu atau logout di perangkat lain |

### Admin tidak bisa posting foto

| Gejala | Penyebab | Solusi |
|---|---|---|
| "Google API belum termuat" | Skrip Google gagal dimuat | Muat ulang halaman |
| Jendela login Google tidak muncul | Popup diblokir browser | Izinkan popup untuk domain ini |
| Login Google diminta tiap kali | Sudah lewat 24 jam, atau scope berubah | Normal, masukkan sekali saja |
| "Token Google tidak valid" | Login Google kedaluwarsa | Keluar dari panel admin, login ulang |
| "api/thumb tidak terjangkau" | Fungsi server timeout atau limit tercapai | Posting dalam kelompok lebih kecil, coba lagi |
| Thumbnail gagal, foto tidak tampil | File bukan gambar yang didukung | Konversi ke JPG atau PNG lebih dulu |

### Foto client tidak muncul di galerinya

1. Pastikan admin sudah tekan **Simpan** setelah posting foto, bukan hanya
   memilih di Drive
2. Cek di panel detail, blok **Foto dari Google Drive** menampilkan jumlah foto
3. Bila jumlah 0, posting ulang
4. Client perlu keluar dan masuk ulang untuk memuat data terbaru

### Permintaan catatan client tidak terlihat

Catatan hanya muncul setelah client menekan **Kirim Pilihan**. Bila client
sudah menandai foto tetapi belum menekan tombol kirim, catatan belum tersimpan.

### Foto tidak terkirim ke folder Drive

| Gejala | Penyebab | Solusi |
|---|---|---|
| "Client ini belum mengirim pilihan" | Client belum menekan kirim | Minta client mengirim |
| Folder tidak muncul di Drive | Login Google admin kedaluwarsa | Login ulang di panel Pengaturan |
| Sebagian foto gagal | Kuota atau file bermasalah | Baca jumlah gagal di pesan, ulangi untuk foto sisanya |
| Foto muncul sebagai duplikat | Nama file berbeda di sumber | Normal, folder tujuan menyimpan nama asli |

---

## 12. Batasan yang Perlu Diketahui

| Batasan | Nilai | Catatan |
|---|---|---|
| Maksimal foto per client | 5.000 | Pada paket gratis, batas penyimpanan tercapai lebih dulu |
| Sesi admin | 12 jam | Perlu login ulang setelahnya |
| Sesi client | 30 hari | Maksimal 5 perangkat sekaligus |
| Login Google admin | 24 jam | Diperpanjang senyap tanpa jendela login selama 24 jam itu |
| Import folder Drive | Maksimal 4 tingkat subfolder | Folder yang lebih dalam akan terpotong |
| Format foto | JPG, PNG, WebP, GIF, HEIC | File RAW perlu dikonversi lebih dulu |
| Batas waktu client | Hanya aktif bila diisi | Kolom kosong berarti tanpa batas |
| Halaman login | Menampilkan status client | Hanya teks status, bukan data sensitif |
| Password admin | Minimal 6 karakter | Tidak ada syarat komposisi karakter |

### Catatan tentang estimasi kapasitas

Kapasitas disebut sekitar 8–10 client pada penyimpanan 1 GB, dengan
perhitungan ± 100 MB untuk 200 foto. Angka ini bergantung pada ukuran file
hasil resize, yang bervariasi menurut isi foto. Setelah 2–3 acara nyata,
angka pastinya bisa disesuaikan.

---

## 13. Riwayat Perubahan

| Tanggal | Perubahan |
|---|---|
| 9 Oktober 2026 | Dokumen serah terima dibuat. Sistem versi 1.0 siap produksi setelah dua tindakan pada bagian 4.2. |

---

*MYHISTORIA — Wedding & Event Content Creator*
*Portal Seleksi Foto · Oktober 2026*
*Kontak: kanal resmi MYHISTORIA*