-- ============================================================
-- TAHAP 4 - BATAS WAKTU PILIHAN (opsional, aman)
-- Jalankan di Supabase → SQL Editor → New query → Run
--
-- Menambah kolom deadline: kapan client harus selesai memilih.
-- Kolom kosong / NULL = tanpa batas waktu (seluruh client lama
-- tidak akan ikut berubah).
-- ============================================================

alter table public.clients add column if not exists deadline timestamptz;

-- Sanity check: kolom harus muncul di daftar
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'clients'
  and column_name = 'deadline';

-- Lihat client beserta batas waktunya (kalau mau diisi manual)
select id, name, status, deadline
from public.clients
order by id;

-- ============================================================
-- Setelah ini: deploy ulang backend (api/app.js), lalu batas
-- waktu bisa diisi dari panel admin.
-- ============================================================