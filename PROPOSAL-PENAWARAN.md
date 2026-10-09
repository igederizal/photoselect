# Proposal Penawaran
## Portal Seleksi Foto MYHISTORIA

**Untuk:** MYHISTORIA — Wedding & Event Content Creator
**Judul Proyek:** Portal Seleksi Foto Klien (aplikasi web)
**Tanggal:** 9 Oktober 2026
**Versi Dokumen:** 1.0
**Status:** Menunggu persetujuan

---

## A. Ringkasan Eksekutif

MYHISTORIA menjalankan bisnis fotografi resepsi. Foto asli setiap acara
selalu berada di Google Drive, lalu hasil akhirnya dicetak menjadi album.
Setiap acara selalu melewati proses yang sama: kumpulan foto dikirim ke
client, client memilih, lalu editor mencocokkan nama file satu per satu.

Portal Seleksi Foto mengubah proses tersebut menjadi satu tautan web.
Client melihat galeri foto acaranya, menandai foto yang mau dicetak,
menulis catatan untuk editor, lalu menekan satu tombol. Editor membuka satu
panel, melihat semua client yang menunggu tindakan, dan menyalin foto
terpilih ke folder Google Drive dalam satu klik.

**Nilai utama:** waktu pengumpulan foto terpilih turun dari 3–5 jam per
acara menjadi satu operasi tombol, dan tidak ada lagi pesan ambigu seperti
"pilih yang nomor 7 ya".

---

## B. Situasi Saat Ini dan Dampaknya

| Kondisi sekarang | Dampak operasional |
|---|---|
| Foto dikirim bertahap melalui chat | Client lupa foto yang sudah dikirim, sering menanyakan ulang |
| Client memberi instruksi lewat teks, misalnya "yang nomor 7" | Nomor berubah saat foto dikirim ulang, salah pilih |
| Editor mencocokkan nama file satu per satu | 3–5 jam per acara |
| Instruksi client tersebar di beberapa percakapan | Editor lupa permintaan khusus, misalnya jangan over-saturate |
| Sulit tahu client mana yang sudah memilih | Foto dan data menumpuk, tidak ada status yang jelas |
| Riwayat foto terpilih tidak tersimpan rapi | Album lama sulit ditelusuri kembali |

---

## C. Solusi yang Ditawarkan

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

Yang tidak berubah: **foto asli tetap di Google Drive** dan tidak
dipindahkan ke server mana pun. Yang disalin ke folder terpisah adalah file
asli berukuran 4000–6000 piksel, sehingga kualitas cetak untuk album
30×40 cm tetap terjaga.

---

## D. Fitur yang Dibangun

### D.1 Untuk Client

| Fitur | Manfaat bagi client |
|---|---|
| Login dengan password | Tidak perlu daftar akun, tidak perlu memasang aplikasi |
| Galeri foto di satu halaman | Semua foto acara terlihat dalam satu layar |
| Penandaan foto | Ketuk lingkaran di sudut foto untuk menandai, ketuk lagi untuk melepas |
| Perbesar foto | Ketuk foto untuk melihat detail, geser antar foto dengan panah |
| Batas jumlah pilihan | Admin dapat menetapkan maksimal, client tidak bisa memilih melebihi |
| Batas waktu | Hitung mundur tampil di bar atas bila admin menetapkan tenggat |
| Catatan untuk editor | Kolom khusus untuk instruksi teknis dan permintaan khusus |
| Ringan di HP | Foto dimuat bertahap 60 per batch, tidak berat di koneksi seluler |

### D.2 Untuk Admin / Editor

| Fitur | Manfaat bagi editor |
|---|---|
| Ringkasan angka | Langsung terlihat jumlah client Menunggu, Diproses, dan Selesai |
| Tambah client | Password dibuat otomatis 8 karakter, tinggal klik untuk menyalin |
| Posting foto dari Drive | Pilih foto satuan atau import satu folder sekaligus, sampai 5.000 foto |
| Batas jumlah dan batas waktu | Atur maksimal pilihan per client beserta tanggal tenggat |
| Panel detail client | Satu panel berisi catatan client, pratinjau foto terpilih, dan semua tindakan |
| Salin ke folder Drive | Foto terpilih dikumpulkan otomatis ke folder `<Client>_Selected` |
| Status pengerjaan | Tandai Menunggu, Diproses, atau Selesai, lengkap dengan filter |
| Reset password | Password baru dibuat otomatis bila client lupa |
| Verifikasi password | Tanda peringatan muncul bila password tampilan tidak cocok dengan hash tersimpan |
| Hapus data | Hapus per client atau seluruh data, termasuk thumbnail di penyimpanan |

---

## E. Pengalaman Pengguna

Desain mengikuti identitas MYHISTORIA: nuansa gelap, aksen emas, tipografi
Cormorant Garamond dan Inter. Diuji pada tiga ukuran layar.

**Halaman masuk** — layout terbagi, panel kiri menampilkan brand, panel kanan
berisi form password. Transisi halus ke galeri setelah berhasil.

**Galeri client** — bar atas menempel berisi logo, nama client, jumlah foto
terpilih, hitung mundur, dan tombol kirim. Grid foto 5 kolom di laptop dan
3 kolom di HP.

**Panel admin** — empat kartu ringkasan angka, lalu satu baris per client
berisi nama, status, password yang bisa diklik untuk disalin, dan jumlah
foto. Klik baris untuk membuka panel detail.

Tangkapan layar tersedia sebagai lampiran pada bagian Lampiran A.

---

## F. Keamanan dan Privasi Data

| Aspek | Penerapan |
|---|---|
| Password client | Disimpan sebagai hash SHA-256; salinan terenkripsi AES-256-GCM untuk ditampilkan ke admin |
| Password admin | Hash SHA-256 saja, tidak dapat dibaca kembali oleh siapa pun |
| Pemeriksaan login | Dilakukan di server, tidak pernah di browser |
| Token sesi | Token acak, berlaku 12 jam untuk admin dan 30 hari untuk client |
| Perbandingan password | `timingSafeEqual`, tahan serangan berbasis waktu |
| Kunci database | Hanya di environment server, tidak ada di kode yang bisa dibaca publik |
| Batas jumlah dan batas waktu | Ditegakkan di server, bukan hanya di tampilan |
| Akses database | Row Level Security aktif; kolom password versi lama dihapus |
| Escaping input | Nama client dan catatan di-escape sebelum ditampilkan, mencegah injeksi HTML |

**Tidak ada password yang tersimpan di halaman web.** Siapa pun yang membuka
"View Source" tidak akan menemukan password client dalam bentuk terbaca.

### Catatan penting sebelum produksi

Dua hal wajib dikerjakan sebelum tautan dikirim ke client sungguhan:

1. **Ganti password admin bawaan.** Password awal `admin1234` hanya untuk
   uji coba. Ganti lewat panel admin pada bagian Pengaturan.
2. **Batasi API key Google pada domain produksi** di Google Cloud Console,
   langkah rinci ada di Lampiran B.

Selain itu ada dua penguatan teknis yang disarankan dikerjakan sebelum
sistem dipakai penuh, dijelaskan pada Lampiran B poin 4: file thumbnail
dapat diakses siapa pun yang memiliki tautannya, dan login belum memiliki
batas percobaan. Keduanya tidak menghalangi pemakaian, tetapi cukup mudah
diperbaiki.

---

## G. Biaya Operasional

| Komponen | Plans | Biaya |
|---|---|---|
| Hosting web | Vercel Hobby | Rp 0 |
| Database dan penyimpanan | Supabase Free | Rp 0 |
| Akses Google Drive API | Standard | Rp 0 |
| Domain, opsional | — | Rp 0 – 150.000 / tahun |
| **Total** | | **Rp 0 / bulan** |

Domain tidak wajib. Sistem tetap berjalan di alamat subdomain bawaan. Domain
hanya perlu dibeli jika client ingin alamat sendiri, misalnya
`pilihfoto.myhistoria.com`.

---

## H. Kapasitas Paket Gratis dan Jalur Upgrade

| Sumber daya | Paket gratis | Kebutuhan per client | Estimasi kapasitas |
|---|---|---|---|
| Penyimpanan thumbnail | 1 GB | ± 100 MB untuk 200 foto | ± 8–10 client |
| Bandwidth | 5 GB per bulan | ± 40 MB per sesi client penuh | ± 120 sesi client per bulan |
| Database | 500 MB | tidak signifikan | ribuan client |

Angka di atas adalah estimasi. Ukuran foto asli dari kamera berbeda-beda
pada setiap acara, sehingga angka pasti baru diketahui setelah 2–3 acara
nyata.

**Jalur upgrade bila kuota mendekati batas:**

| Plans | Estimasi biaya | Kapasitas |
|---|---|---|
| Supabase Pro | sekitar US$25 per bulan | ± 100 GB penyimpanan, ± 250 GB bandwidth |
| Vercel Pro | sekitar US$20 per bulan | Timeout fungsi lebih panjang, kuota lebih tinggi |

Keduanya belum diperlukan sekarang. Angka tersebut tersedia sebagai opsi
cadangan apabila jumlah client tumbuh melewati kapasitas paket gratis.

---

## I. Ruang Lingkup Pekerjaan

### Termasuk

- Desain antarmuka halaman masuk, galeri client, dan panel admin
- Integrasi Google Drive: login Google, pemilih file, dan import folder
- Pemrosesan gambar otomatis, tiap foto menjadi dua ukuran pratinjau
- API di sisi server untuk login, sesi, data client, dan pengiriman pilihan
- Basis data dan penyimpanan thumbnail
- Pengujian otomatis dan visual pada desktop serta HP
- Dokumentasi teknis dan panduan operasional
- Penyerahan kode dan pelatihan singkat untuk admin

### Tidak Termasuk, dapat ditambahkan terpisah

- Aplikasi native Android atau iOS
- Notifikasi email atau WhatsApp otomatis, saat ini password dikirim manual
- Pembayaran online, invoice, atau biaya layanan
- Beberapa akun admin dengan hak akses berbeda
- Integrasi ke software album atau vendor tertentu

---

## J. Tahapan Pelaksanaan

| Tahap | Kegiatan | Status |
|---|---|---|
| 1 | Desain dan pembangunan sistem | **Selesai** |
| 2 | Pengujian dengan data contoh, otomatis dan visual | **Selesai** |
| 3 | Uji coba dengan satu acara nyata | Siap dijalankan |
| 4 | Penyerahan dokumentasi dan pelatihan admin | Siap |
| 5 | Pemakaian penuh bersama client | Siap |

Estimasi waktu untuk tahap 3 sampai 5 adalah **2–3 hari kerja**, bergantung
pada ketersediaan akses Google Drive dan jadwal client.

---

## K. Penyerahan dan Dukungan

Yang diserahkan bersama sistem:

| Komponen | Keterangan |
|---|---|
| Kode sumber | Repository GitHub, branch `master` |
| Dokumentasi serah terima | `DOKUMENTASI-SERAH-TERIMA.md` |
| Panduan operasional | Bagian 2 dan 3 pada dokumen serah terima |
| Tangkapan layar UI | 38 gambar desktop dan HP |

**Dukungan awal, 30 hari pertama:**

| Jenis | Cakupan |
|---|---|
| Bug | Perbaikan gratis, respon dalam 1 x 24 jam |
| Pertanyaan penggunaan | Dijawab lewat kanal resmi MYHISTORIA |
| Permintaan fitur baru | Dinilai terpisah, di luar garansi |

**Setelah masa 30 hari:** perbaikan bug tetap dapat dikerjakan dengan biaya
yang disepakati terpisah.

---

## L. Garansi

Sistem dijamin berfungsi sesuai dokumen ini selama 30 hari sejak penyerahan.
Yang bergaransi: login client dan admin, posting foto dari Drive, galeri dan
penandaan foto, pengiriman pilihan, dan penyalinan ke folder Google Drive.

Yang tidak bergaransi: pemadaman akun Google oleh pemilik, kuota penyedia
layanan habis, perangkat atau jaringan yang rusak, dan penyimpangan yang
muncul karena password client dibocorkan pihak client.

---

## M. Persyaratan dari Client

Sangat sedikit, karena seluruh sistem berjalan di atas akun yang sudah ada:

1. **Akses Google Drive** untuk folder foto acara dan folder tujuan `_Selected`
2. **Pengubahan password admin** dari password bawaan sebelum produksi
3. **Satu client uji coba** untuk memastikan alur dari awal sampai akhir di
   perangkat yang benar-benar dipakai client
4. **Keputusan soal domain**, memakai subdomain bawaan atau domain sendiri

---

## N. Langkah Berikutnya

1. Client membaca dokumen ini dan menyatakan kesesuaiannya
2. Setelah disepakati, jalankan uji coba satu acara nyata, yaitu tahap 3
3. Pengubahan password admin dan konfigurasi API key sesuai Lampiran B
4. Penyerahan dokumentasi dan pelatihan singkat untuk admin
5. Mulai dipakai client

---

## Lampiran A — Tangkapan Layar

Tersedia di folder `preview/shots4/` dengan format PNG:

| Kode | Isi | Kode | Isi |
|---|---|---|---|
| `t1-login-*` | Halaman masuk | `t2-galeri-*` | Galeri client |
| `t1-salah-*` | Password salah | `t2a-grid-*` | Grid foto |
| `t2b-lightbox-*` | Perbesar foto | `t2c-terpilih-*` | Foto terpilih |
| `t3-admin-*` | Panel admin | `t4a-admin-*` | Ringkasan admin |
| `t4b-rows-*` | Baris client | `t4c-filter-*` | Filter status |
| `t4d-detail-*` | Panel detail | `t4e-tambah-*` | Tambah client |
| `t4f-deadline-*` | Batas waktu | `t5-admin-detail-*` | Detail admin di HP |

Format nama file: `*-desktop.png` untuk layar lebar dan `*-hp.png` untuk HP.

## Lampiran B — Catatan Teknis untuk Tim Client

Rincian konfigurasi awal, meliputi domain, API key, dan environment variable,
serta dua peringatan keamanan dijelaskan pada `DOKUMENTASI-SERAH-TERIMA.md`
bagian 9 dan bagian 4.

---

*MYHISTORIA — Wedding & Event Content Creator*
*Portal Seleksi Foto · Oktober 2026*