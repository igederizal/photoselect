# Proposal: Portal Seleksi Foto untuk MYHISTORIA

Dokumen penawaran · Oktober 2026

---

## Ringkasan

MYHISTORIA saat ini masih mengandalkan cara manual: mengirim banyak foto
lewat WhatsApp, menunggu client memilih, lalu mencocokkan nama file satu
per satu. Untuk acara dengan 200+ foto, proses ini memakan waktu berjam-jam
dan rawan salah kirim.

Portal Seleksi Foto menyelesaikan masalah tersebut dengan satu tautan.

---

## Masalah yang Dihadapi

| Kondisi sekarang | Dampak |
|---|---|
| Foto dikirim bertahap lewat chat | Client sering lupa atau menanyakan ulang |
| Client memberi tahu "pilih yang nomor 7" | Salah pilih, harus dikirim ulang |
| Mencocokkan nama file satu per satu | 3–5 jam per acara |
| Tidak ada catatan instruksi per acara | Editor lupa permintaan client |
| Sulit tahu client mana yang sudah kirim | Hosting dan file menumpuk |
| Nomor file bisa berubah saat dikirim ulang | Salah pilih foto untuk dicetak |

---

## Solusi

Portal web dengan alur berikut:

```
ADMIN MENGUNGGAH              CLIENT MEMILIH              ADMIN MEMPROSES
─────────────────────         ─────────────────           ─────────────────
Pilih foto dari        →   Buka tautan           →   Semua foto pilihan
Google Drive                 Login dengan password      otomatis terkumpul
                        →   Lihat galeri           →   dalam satu folder
                        →   Pilih foto             →   "_Selected"
                        →   Tulis catatan          →   → langsung diedit
                        →   Kirim pilihan
```

**Yang paling dihargai:** client tidak perlu transition — pilih foto,
satu klik kirim, dan admin tinggal menyalin. Tidak ada lagiCommunication
bolak-balik tentang "foto yang mana ya".

---

## Fitur Utama

### Untuk Client

| Fitur | Manfaat |
|---|---|
| Login via password | Tidak perlu daftar akun, tidak perlu install apa pun |
| Galeri foto | Semua foto dalam satu halaman, bisa di-scroll |
| Pilih foto | Ketuk lingkaran di sudut foto, langsung ditandai |
| Perbesar | Ketuk foto untuk melihat detail, geser antar foto |
| Batas jumlah | Admin mengatur maksimal, client tidak bisa pilih lebih |
| Catatan | Kolom khusus untuk instruksi seperti "jangan over-saturate" |
| Batas waktu | Hitung mundur jika admin menetapkan tenggat |

### Untuk Admin

| Fitur | Manfaat |
|---|---|
| Ringkasan | Langsung lihat client mana yang menunggu tindakan |
| Tambah client | Password dibuat otomatis, tinggal disalin |
| Ambil dari Drive | Pilih satuan atau import folder sekaligus |
| Salin ke folder Drive | Foto terpilih otomatis terkumpul, siap diedit |
| Ubah status | Tandai Menunggu / Diproses / Selesai |
| Atur batas | Tentukan maksimal foto per client |
| Verifikasi password | Dijamin password yang dikirim masih berlaku |

---

## Tampilan

**Halaman Login** — split layout: panel kiri menampilkan brand, panel
kanan form. Transisi halus ke galeri setelah berhasil.

**Galeri Client** — bar atas sticky berisi logo, nama client, jumlah
terpilih, dan tombol kirim. Grid foto 5 kolom (desktop) / 3 kolom (HP).
Tanda merah muncul saat batas terlampaui.

**Panel Admin** — ringkasan angka di atas, satu baris per client.
Klik baris untuk membuka panel detail berisi semua tindakan.

Desain mengikuti tema brand MYHISTORIA: nuansa gelap, aksen emas, tipografi
Cormorant Garamond.

---

## Keamanan

| Aspek | Cara penanganan |
|---|---|
| Password client | Hash SHA-256 + enkripsi AES-256-GCM |
| Password admin | Hash SHA-256, tidak bisa dibaca kembali |
| Login | Dicek di server, tidak pernah di browser |
| Sesi | Token acak, berlaku terbatas, auto-hapus |
| Kunci API | Hanya di server, tidak ada di kode |
| Database | Row Level Security aktif |

Password tidak pernah tersimpan di halaman web yang dilihat pengguna —
berarti tidak bisa dibaca siapa pun yang membuka "View Source".

> Catatan: password admin awal `admin1234` bersifat sementara untuk uji coba.
> Wajib diganti sebelum dipakai untuk client sungguhan (lewat panel admin).

---

## Biaya

| Komponen | Plans | Biaya |
|---|---|---|
| Hosting (Vercel) | Hobby | Rp 0 |
| Database + Penyimpanan (Supabase) | Free | Rp 0 |
| Google Drive API | Standard | Rp 0 |
| **Total** | | **Rp 0 / bulan** |

Termasuk pembaruan dan perbaikan bug selama masa aktif.

---

## Kapasitas Paket Gratis

| Sumber daya | Kapasitas | Setara |
|---|---|---|
| Penyimpanan foto | 1 GB | ± 20–40 client (200 foto) |
| Bandwidth | 5 GB/bulan | ± 150–200 sesi client |
| Database | 500 MB | Ribuan client |

Angka pasti akan terlihat setelah 2–3 acara. Kalau kuota mendekati batas,
naik ke plan berbayar cukup ~US$25/bulan.

---

## Yang Perlu Disiapkan dari Admin

Tidak ada. Yang dibutuhkan:

- Akun Google Drive (sudah ada) — foto tetap di situ, tidak dipindahkan
- Login ke panel admin memakai password

---

## Waktu dan Tahapan

| Tahap | Kegiatan | Status |
|---|---|---|
| 1 | Desain dan pembuatan sistem | ✅ Selesai |
| 2 | Pengujian dengan data contoh | ✅ Selesai |
| 3 | Uji coba dengan 1 acara sungguhan | Siap |
| 4 | Mulai dipakai client | Siap |

Sistem sudah siap dipakai. Yang tersisa adalah uji coba satu acara nyata
untuk memastikan alur Google Drive berjalan mulus.

---

## Setelah Sistem Diterapkan

**Yang berubah untuk workflow:**

- Waktu admin untuk mengumpulkan foto terpilih: dari 3–5 jam menjadi **klik satu tombol**
- Client tidak perlu chat bolak-balik
- Semua instruksi client tercatat di satu tempat
- Arsip foto tiap acara tertata rapi di Drive

**Yang tetap sama:**

- Foto asli tetap di Google Drive (tidak ada risiko kehilangan)
- Album dan hasilnya tetap dicetak seperti biasa
- Tidak ada biaya tambahan

---

*MYHISTORIA — Wedding & Event Content Creator*
*Portal Seleksi Foto · 2026*
