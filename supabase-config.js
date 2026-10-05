// Konfigurasi Supabase
const SUPABASE_URL = 'https://sdrfwrepoufuuxxvawsh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkcmZ3cmVwb3VmdXV4eHZhd3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNDc1MTQsImV4cCI6MjEwNjcyMzUxNH0.g_CmWjHKFiCioYoVRiB-a3AnNGxWbR5SUbBmiB2Jmd0';

// Inisialisasi Supabase Client
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
