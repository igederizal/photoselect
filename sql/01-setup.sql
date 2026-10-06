-- ============================================================
-- TAHAP 1 - PERSIAPAN (aman, situs yang sedang live TIDAK terganggu)
-- Jalankan file ini di Supabase → SQL Editor → New query → Run
-- ============================================================

-- 0. Beri izin database ke service_role
--    (dicek: secret key baru bisa baca tabel setelah ini)
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select, update on sequences to service_role;
grant all on all tables in schema storage to service_role;
grant all on all sequences in schema storage to service_role;

-- 1. Kolom baru untuk menyimpan password dalam bentuk aman
--    clients: pw_hash (untuk cek login) + pw_enc (untuk ditampilkan admin)
--    admin  : pw_hash saja (password admin tidak bisa dibaca lagi)
alter table public.clients add column if not exists pw_hash text;
alter table public.clients add column if not exists pw_enc text;
alter table public.admin   add column if not exists pw_hash text;

-- 2. Tabel session client (token acak, bukan password)
create table if not exists public.client_sessions (
  token uuid primary key default gen_random_uuid(),
  client_id integer not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists idx_client_sessions_client on public.client_sessions(client_id);
create index if not exists idx_client_sessions_expires on public.client_sessions(expires_at);

-- 3. Tabel session admin (berlaku 12 jam)
create table if not exists public.admin_sessions (
  token uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours')
);
create index if not exists idx_admin_sessions_expires on public.admin_sessions(expires_at);

-- 4. Bersihkan session kedaluwarsa (aman, hanya data sampah)
delete from public.client_sessions where expires_at < now();
delete from public.admin_sessions  where expires_at < now();

-- 5. Diagnosa: service_role harus punya bypassrls = true
--    (kalau false, kabari saya - nanti perlu perintah tambahan)
select rolname, rolbypassrls, rolsuper
from pg_roles
where rolname in ('anon', 'authenticated', 'service_role')
order by rolname;

-- ============================================================
-- Setelah file ini: kata "Success" → kabari saya (sertakan hasil
-- query nomor 5), lalu saya lanjut migrasi password + deploy.
-- JANGAN enable RLS dulu (itu tahap 3, nanti saya kasih file-nya).
-- ============================================================