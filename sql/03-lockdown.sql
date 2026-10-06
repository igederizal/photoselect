-- ============================================================
-- TAHAP 3 - LOCKDOWN (dijalankan setelah app baru live & teruji)
-- Menghapus akses publik ke seluruh data aplikasi.
-- ============================================================

-- 1. Hapus policy "izinkan semua orang" (penyebab kebocoran data)
drop policy if exists "allow_all_clients" on public.clients;
drop policy if exists "allow_all_admin" on public.admin;

-- 2. Pastikan RLS aktif di semua tabel aplikasi
--    (tanpa policy = hanya service_role yang bisa akses, karena bypassrls=true)
alter table public.clients enable row level security;
alter table public.admin enable row level security;
alter table public.client_sessions enable row level security;
alter table public.admin_sessions enable row level security;

-- 3. Hapus kolom password plaintext
--    (password client sudah tersimpan sebagai: hash untuk login + enkripsi untuk admin)
alter table public.clients alter column password drop not null;
alter table public.clients drop column if exists password;
alter table public.admin drop column if exists password;

-- 4. Storage: hapus policy anon yang berbahaya
--    (upload & hapus file thumbnail sekarang hanya lewat server)
drop policy if exists "anon insert thumbs" on storage.objects;
drop policy if exists "thumbs anon delete" on storage.objects;

-- 5. Defense in depth: cabut hak anon & authenticated
revoke all on table public.clients from anon, authenticated;
revoke all on table public.admin from anon, authenticated;
revoke all on table public.client_sessions from anon, authenticated;
revoke all on table public.admin_sessions from anon, authenticated;

-- 6. Verifikasi: tidak boleh ada policy untuk public/anon
select schemaname, tablename, policyname, roles::text from pg_policies
where schemaname in ('public', 'storage') order by schemaname, tablename;

-- ============================================================
-- Hasil yang diharapkan:
--   clients / admin / *_sessions -> hanya "anon select thumbs" (storage)
--   Query dengan anon/publishable key -> 401 permission denied
--   Fungsi server (service_role) -> tetap jalan normal
-- ============================================================