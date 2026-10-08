-- ============================================================
-- SET PASSWORD ADMIN
-- Jalankan di Supabase → SQL Editor → New query → Run
--
-- Password ini disimpan sebagai SHA-256 hash, sama seperti yang
-- dicek oleh api/app.js saat admin_login. Password aslinya TIDAK
-- pernah ditulis ke kode frontend.
-- ============================================================

update public.admin
set pw_hash = 'ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270'
where id = (select min(id) from public.admin);

-- Pastikan ada tepat satu baris admin
select count(*) as jumlah_admin from public.admin;

-- Verifikasi hash-nya cocok dengan "admin1234"
select pw_hash =
  encode(digest('admin1234', 'sha256'), 'hex') as cocok
from public.admin;

-- ============================================================
-- Catatan: password ini lemah & ada di daftar password umum.
-- Setelah situs live dan password dikirim ke client, ganti lagi
-- lewat panel admin (Ubah Password).
-- ============================================================