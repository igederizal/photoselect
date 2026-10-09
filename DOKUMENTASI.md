# Portal Seleksi Foto — Dokumentasi Teknis

UntukMUHISTORIA · Wedding & Event Content Creator
Terakhir diperbarui: 9 Oktober 2026

---

## 1. Ringkasan

Portal web untuk streamline proses seleksi foto acara. Admin mengunggah
foto dari Google Drive, client memilih sendiri, lalu admin menyalin pilihan
tersebut ke folder Drive terpisah untuk diproses.

Fokus arsitektur: **password tidak pernah menyentuh kode frontend.** Semua
pemeriksaan login terjadi di server.

---

## 2. Alur Kerja

```
ADMIN                          CLIENT
─────                          ──────
1. Login panel admin
2. Tambah client  ──────────→  password dikirim via WhatsApp
3. Pilih Foto / Import Folder
   (ambil dari Google Drive,
    resize otomatis)
4. Kirim link ke client  ─────→ 5. Login dengan password
                             6. Lihat galeri foto
                             7. Pilih foto (ada batas)
                             8. Tulis catatan untuk editor
                             9. Kirim pilihan
10. Salin foto terpilih ─────→  folder "_Selected" di Drive
    ke folder Drive baru          → siap diedit
```

---

## 3. Struktur Teknis

| Komponen | Teknologi | Peran |
|---|---|---|
| Frontend | HTML + CSS + JS murni | Antarmuka, tanpa framework |
| Backend | Node.js (Vercel Functions) | Validasi, sesi, operasi database |
| Database | Supabase Postgres | Data client, foto, sesi |
| Penyimpanan | Supabase Storage | Thumbnail foto |
| Sumber foto | Google Drive API | Foto asli, kualitas cetak |
| Hosting | Vercel | Deploy otomatis dari GitHub |

### Alur gambar (penting)

```
Foto asli (Google Drive, ~4000-6000 px)
        │
        │  api/thumb.js menarik via Drive API
        ▼
   sharp resize jadi 2 ukuran:
        │
        ├── 1024 px (kualitas 80) → Supabase Storage, untuk grid
        └── 1600 px (kualitas 75) → Supabase Storage, untuk perbesar
```

**Foto asli tidak pernah dipindahkan.** Yang tersimpan di Supabase hanya
versi pratinjau. Ketika admin menyalin pilihan ke folder Drive, yang
disalin adalah **file asli** — sehingga kualitas cetak (300 dpi untuk
album 30×40 cm) sepenuhnya terjaga.

---

## 4. Keamanan

| Aspek | Implementasi |
|---|---|
| Password client | Disimpan sebagai SHA-256 hash + versi terenkripsi (AES-256-GCM) untuk tampilan admin |
| Password admin | SHA-256 hash saja, tidak bisa dibaca kembali |
| Login | Dicek di server (`api/app.js`), tidak pernah di browser |
| Sesi client | Token acak (UUID), berlaku terbatas, disimpan di tabel terpisah |
| Sesi admin | Token acak, berlaku 12 jam, dihapus otomatis saat kedaluwarsa |
| Perbandingan | `crypto.timingSafeEqual` (tahan timing attack) |
| Kunci API | Hanya di environment Vercel, tidak ada di kode |
| Akses database | Row Level Security diaktifkan (`03-lockdown.sql`) |

### Catatan penting untuk pemilik

Password admin `admin1234` adalah password sementara untuk fase uji. Sebelum
dipakai untuk client sungguhan, **ganti lewat panel admin** (Pengaturan →
Password admin). Pola `admin` + angka pendek ada di daftar tebakan
terpopuler dan akan ditemukan otomatis oleh pemindai dalam hitungan detik.

---

## 5. Fitur

### Untuk Client

- Login dengan password, tanpa daftar akun
- Galeri foto dengan pemuatan bertahap (60 foto per batch)
- Lingkaran di sudut foto untuk menandai pilihan
- Klik foto untuk melihat lebih besar, dengan navigasi panah kiri/kanan
- Batas jumlah foto sesuai ketentuan admin
- Hitung mundur batas waktu (bila admin mengaturnya)
- Kolom catatan untuk instruksi ke editor
- Beban ringan: thumbnail 1024 px, dimuat sesuai kebutuhan

### Untuk Admin

- Ringkasan: total client, status, jumlah foto diposting
- Satu baris ringkas per client: nama, status, password (klik = copy), jumlah foto
- Filter berdasarkan status
- Panel detail: ubah status, atur batas foto, atur batas waktu
- Ambil foto dari Drive: pilih satuan atau import folder
- Salin foto terpilih ke folder Drive terpisah
- Buka / hapus folder salinan di Drive
- Reset password client
- Verifikasi password sebelum disalin (mastikan cocok dengan database)

---

## 6. Batas Teknis (free tier)

| Sumber daya | Batas | Kebutuhan per client |
|---|---|---|
| Penyimpanan | 1 GB | ± 130–160 MB (214 foto) |
| Egress | 5 GB/bulan + 5 GB cached | ± 25–30 MB per sesi client |
| Database | 500 MB | Tidak signifikan |

Perkiraan kapasitas dengan kode saat ini: **20–40 client** di 1 GB storage.
Angka ini akan lebih pasti setelah 2–3 acara sungguhan dipakai, karena
ukuran foto asli Sony berbeda-beda.

---

## 7. Biaya

| Komponen | Biaya |
|---|---|
| Vercel (hosting) | Gratis — Hobby plan |
| Supabase | Gratis — Free plan |
| Google Drive API | Gratis (kuota harian) |

**Total biaya hosting: Rp 0/bulan.**

Meningkat ke plan berbayar hanya perlu kalau: jumlah client tumbuh jauh
melebihi kapasitas free, atau butuh lebih dari 2 project.

---

## 8. Batasan yang Perlu Diketahui

- Maksimal 5.000 foto per client (`MAX_PHOTOS` di `api/app.js`), tetapi pada free tier batas storage akan tercapai lebih dulu
- Thai đăng nhập admin berlaku 12 jam, lalu perlu login ulang
- Login Google berlaku 24 jam, lalu diminta login lagi
- Batas waktu client hanya ditegakkan kalau kolom `deadline` diisi

---

## 9. Kebutuhan Sistem

```
Node.js 18+
Akun Supabase (sudah ada)
Akun Vercel (sudah ter-link ke GitHub)
Environment variables di Vercel:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - PW_ENC_KEY
  - GOOGLE_CLIENT_ID
  - GOOGLE_API_KEY
```

---

## 10. Navigasi File

```
index.html          Halaman tunggal: login / galeri client / panel admin
style.css           Seluruh tampilan
script.js           Seluruh logika frontend + integrasi Google
api/app.js          Backend: login, sesi, CRUD client, submit pilihan
api/thumb.js        Ambil foto dari Drive, resize, upload ke Supabase
sql/01-setup.sql    Persiapan database (sudah dijalankan)
sql/03-lockdown.sql Aktifkan Row Level Security (sudah dijalankan)
sql/04-deadline.sql Tambah kolom batas waktu (opsional)
sql/05-set-admin-password.sql  Atur password admin
preview/            Mockup desain — tidak ikut deploy
```

---

## 11. Pemeliharaan

| Kegiatan | Frekuensi |
|---|---|
| Cek pemakaian storage & egress di dashboard Supabase | Bulanan |
| Ganti password admin jika ada kecurigaan | Bergantian |
| Ganti password client yang sudah selesai | Setelah acara selesai |
| Bersihkan folder salinan di Trash Drive | Setelah 30 hari |

Ada tombol "Hapus Semua Data Client" di panel admin untuk cleaning total
(juga menghapus thumbnail dari Supabase).

---

Dokumen ini bisa diperbarui sesuai kebutuhan. Hubungi melalui kanal resmi
MYHISTORIA.
