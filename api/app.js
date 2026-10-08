// ============================================================
// API APLIKASI - semua akses database lewat sini (server-side)
// Dipakai oleh admin DAN client. Browser tidak pernah bicara
// langsung ke database lagi.
// ============================================================
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sdrfwrepoufuuxxvawsh.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PW_ENC_KEY = process.env.PW_ENC_KEY || '';

const BUCKET = 'thumbs';
const CLIENT_SESSION_DAYS = 30;
const ADMIN_SESSION_HOURS = 12;
const MAX_PHOTOS = 5000;
const MAX_NAME = 80;
const MAX_NOTE = 2000;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---------- kripto password ----------
function sha256(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

function encryptText(plain) {
  const key = Buffer.from(PW_ENC_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

function decryptText(b64) {
  const key = Buffer.from(PW_ENC_KEY, 'hex');
  const b = Buffer.from(b64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString('utf8');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function str(v, max) {
  return String(v == null ? '' : v).slice(0, max);
}

// ---------- session ----------
async function getAdminSession(token) {
  if (!token) return null;
  const { data } = await db
    .from('admin_sessions')
    .select('token,expires_at')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data || null;
}

async function getClientSession(token) {
  if (!token) return null;
  const { data } = await db
    .from('client_sessions')
    .select('client_id,expires_at')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data || null;
}

// ---------- data client ----------
function publicClient(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    folder: c.folder,
    status: c.status,
    note: c.note || '',
    photos: c.photos || [],
    selected_files: c.selected_files || [],
    submitted: !!c.submitted,
    max_select: c.max_select || 0,
    deadline: c.deadline || null
  };
}

function adminClient(c) {
  if (!c) return null;
  const out = publicClient(c);
  // Password hanya untuk tampilan admin (disenkripsi di server, dikirim via HTTPS)
  let pwOk = null;
  try {
    const plain = c.pw_enc ? decryptText(c.pw_enc) : '';
    out.password = plain;
    // verifikasi: apakah password yang tampil = password yang berlaku (dicek via hash)
    pwOk = !!(plain && c.pw_hash) && safeEqual(sha256(plain), c.pw_hash);
  } catch (e) {
    console.error('gagal dekripsi password client', c.id, e.message);
    out.password = '';
    pwOk = false;
  }
  out.pw_ok = pwOk;
  return out;
}

function genPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let pw = '';
  const rnd = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) pw += chars[rnd[i] % chars.length];
  return pw;
}

// ---------- thumbnail ----------
async function cleanupThumbs(clientId) {
  const prefix = String(clientId) + '/';
  let removed = 0;
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw new Error('storage list: ' + error.message);
    const files = (data || []).filter(f => f.name && (f.id || f.name.includes('.')));
    if (files.length === 0) break;
    const { error: rmErr } = await db.storage
      .from(BUCKET)
      .remove(files.map(f => prefix + f.name));
    if (rmErr) throw new Error('storage remove: ' + rmErr.message);
    removed += files.length;
    if (files.length < 1000) break;
  }
  return removed;
}

// ============================================================
// HANDLER
// ============================================================
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!SERVICE_KEY) return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum di-set di server' });
  if (!/^[0-9a-f]{64}$/i.test(PW_ENC_KEY)) return res.status(503).json({ error: 'PW_ENC_KEY belum di-set di server' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; }
  }
  body = body || {};

  const action = str(body.action, 40);
  const token = str(body.token, 64);

  try {
    // ================= ADMIN =================
    if (action === 'admin_login') {
      const password = str(body.password, 200);
      const { data: admin, error } = await db
        .from('admin').select('id,pw_hash').limit(1).single();
      if (error) throw new Error('DB: ' + error.message);
      if (!admin || !admin.pw_hash) return res.status(503).json({ error: 'Password admin belum dimigrasi' });
      if (!safeEqual(sha256(password), admin.pw_hash)) return res.status(401).json({ error: 'Password salah' });

      await db.from('admin_sessions').delete().lt('expires_at', new Date().toISOString());
      const expires = new Date(Date.now() + ADMIN_SESSION_HOURS * 3600 * 1000).toISOString();
      const { data: s, error: se } = await db
        .from('admin_sessions').insert({ expires_at: expires }).select('token,expires_at').single();
      if (se) throw new Error('DB: ' + se.message);
      return res.status(200).json({ ok: true, token: s.token, expires_at: s.expires_at });
    }

    if (action === 'admin_session') {
      const s = await getAdminSession(token);
      if (!s) return res.status(401).json({ error: 'Sesi admin habis, login ulang' });
      return res.status(200).json({ ok: true, expires_at: s.expires_at });
    }

    if (action === 'admin_logout') {
      await db.from('admin_sessions').delete().eq('token', token);
      return res.status(200).json({ ok: true });
    }

    if (action === 'admin_verify_password') {
      const password = str(body.password, 200);
      if (!password) return res.status(400).json({ error: 'Masukkan password dulu' });
      const h = sha256(password);

      const { data: c } = await db.from('clients')
        .select('id,name').eq('pw_hash', h).maybeSingle();
      if (c) return res.status(200).json({ ok: true, result: 'client', id: c.id, name: c.name });

      const { data: a } = await db.from('admin')
        .select('id').eq('pw_hash', h).maybeSingle();
      if (a) return res.status(200).json({ ok: true, result: 'admin', name: 'Admin' });

      return res.status(200).json({ ok: true, result: 'none' });
    }

    if (action === 'admin_change_password') {
      const s = await getAdminSession(token);
      if (!s) return res.status(401).json({ error: 'Sesi admin habis, login ulang' });
      const cur = str(body.currentPassword, 200);
      const next = str(body.newPassword, 200);
      if (next.length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter' });

      const { data: admin } = await db.from('admin').select('pw_hash').limit(1).single();
      if (!admin || !safeEqual(sha256(cur), admin.pw_hash)) {
        return res.status(401).json({ error: 'Password saat ini salah' });
      }
      const { error } = await db.from('admin')
        .update({ pw_hash: sha256(next) }).eq('id', admin.id || 1);
      if (error) throw new Error('DB: ' + error.message);

      // Verifikasi ulang: pastikan password baru yang tersimpan benar-benar yang diketik
      const { data: cek } = await db.from('admin').select('pw_hash').limit(1).single();
      const verified = !!cek && safeEqual(cek.pw_hash, sha256(next));

      return res.status(200).json({ ok: true, verified });
    }

    if (action.startsWith('admin_')) {
      const s = await getAdminSession(token);
      if (!s) return res.status(401).json({ error: 'Sesi admin habis, login ulang' });

      if (action === 'admin_list') {
        const { data, error } = await db.from('clients').select('*').order('id');
        if (error) throw new Error('DB: ' + error.message);
        return res.status(200).json({ ok: true, clients: (data || []).map(adminClient) });
      }

      if (action === 'admin_add_client') {
        const name = str(body.name, MAX_NAME).trim();
        if (!name) return res.status(400).json({ error: 'Nama client wajib diisi' });
        const folder = 'Project_' + name.replace(/\s+/g, '_');

        const { data: existing } = await db.from('clients').select('id,name');
        if ((existing || []).some(c => String(c.name).toLowerCase() === name.toLowerCase())) {
          return res.status(400).json({ error: 'Nama client sudah ada' });
        }

        // password acak, dijamin unik
        let password = '', hash = '';
        for (let i = 0; i < 6; i++) {
          password = genPassword();
          hash = sha256(password);
          const { data: dup } = await db.from('clients').select('id').eq('pw_hash', hash).maybeSingle();
          if (!dup) break;
        }

        const { data, error } = await db.from('clients').insert({
          name, folder, status: 'Menunggu', note: '',
          selected_files: [], submitted: false, photos: [], max_select: 0,
          pw_hash: hash, pw_enc: encryptText(password)
        }).select('*').single();
        if (error) throw new Error('DB: ' + error.message);
        return res.status(200).json({ ok: true, client: adminClient(data) });
      }

      const id = parseInt(body.id, 10);
      if (action !== 'admin_delete_all' && (!id || isNaN(id))) {
        return res.status(400).json({ error: 'id client tidak valid' });
      }

      if (action === 'admin_update_status') {
        const status = str(body.status, 20);
        if (!['Menunggu', 'Diproses', 'Selesai'].includes(status)) {
          return res.status(400).json({ error: 'Status tidak valid' });
        }
        const { error } = await db.from('clients').update({ status }).eq('id', id);
        if (error) throw new Error('DB: ' + error.message);
        return res.status(200).json({ ok: true });
      }

      if (action === 'admin_set_max') {
        let n = parseInt(body.max, 10);
        if (isNaN(n) || n < 0) n = 0;
        if (n > MAX_PHOTOS) n = MAX_PHOTOS;
        const { error } = await db.from('clients').update({ max_select: n }).eq('id', id);
        if (error) throw new Error('DB: ' + error.message);
        return res.status(200).json({ ok: true, max_select: n });
      }

      // batas waktu pilihan client (kosong = tanpa batas)
      if (action === 'admin_set_deadline') {
        let dl = null;
        if (body.deadline) {
          dl = new Date(body.deadline);
          if (isNaN(dl.getTime())) return res.status(400).json({ error: 'Tanggal tidak valid' });
        }
        const { error } = await db.from('clients').update({ deadline: dl }).eq('id', id);
        if (error) throw new Error('DB: ' + error.message);
        return res.status(200).json({ ok: true, deadline: dl });
      }

      if (action === 'admin_save_photos') {
        const arr = Array.isArray(body.photos) ? body.photos.slice(0, MAX_PHOTOS) : [];
        const photos = arr
          .filter(p => p && p.id)
          .map(p => ({
            id: str(p.id, 200),
            name: str(p.name, 300),
            thumb: str(p.thumb, 600),
            zoom: str(p.zoom, 600)
          }));
        const { error } = await db.from('clients').update({ photos }).eq('id', id);
        if (error) throw new Error('DB: ' + error.message);
        return res.status(200).json({ ok: true, total: photos.length });
      }

      if (action === 'admin_set_folder') {
        const url = str(body.url, 300);
        if (url && !/^https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+/.test(url)) {
          return res.status(400).json({ error: 'Link folder tidak valid' });
        }
        const { error } = await db.from('clients')
          .update({ selected_folder: url || null }).eq('id', id);
        if (error) throw new Error('DB: ' + error.message);
        return res.status(200).json({ ok: true });
      }

      if (action === 'admin_reset_password') {
        let password = '', hash = '';
        for (let i = 0; i < 6; i++) {
          password = genPassword();
          hash = sha256(password);
          const { data: dup } = await db.from('clients').select('id').eq('pw_hash', hash).maybeSingle();
          if (!dup) break;
        }
        const { error } = await db.from('clients')
          .update({ pw_hash: hash, pw_enc: encryptText(password) }).eq('id', id);
        if (error) throw new Error('DB: ' + error.message);
        return res.status(200).json({ ok: true, password });
      }

      if (action === 'admin_clear_photos') {
        const { error } = await db.from('clients').update({ photos: [] }).eq('id', id);
        if (error) throw new Error('DB: ' + error.message);
        let thumbs = 0;
        try { thumbs = await cleanupThumbs(id); } catch (e) { console.error('thumb:', e.message); }
        return res.status(200).json({ ok: true, thumbs });
      }

      if (action === 'admin_delete_client') {
        const { error } = await db.from('clients').delete().eq('id', id);
        if (error) throw new Error('DB: ' + error.message);
        let thumbs = 0;
        try { thumbs = await cleanupThumbs(id); } catch (e) { console.error('thumb:', e.message); }
        return res.status(200).json({ ok: true, thumbs });
      }

      if (action === 'admin_delete_all') {
        const { data: all } = await db.from('clients').select('id');
        const { error } = await db.from('clients').delete().gt('id', 0);
        if (error) throw new Error('DB: ' + error.message);
        let thumbs = 0;
        for (const c of all || []) {
          try { thumbs += await cleanupThumbs(c.id); } catch (e) { console.error('thumb:', e.message); }
        }
        return res.status(200).json({ ok: true, thumbs });
      }

      return res.status(400).json({ error: 'Aksi tidak dikenal: ' + action });
    }

    // ================= CLIENT =================
    if (action === 'client_login') {
      const password = str(body.password, 200);
      const { data: c, error } = await db.from('clients')
        .select('*').eq('pw_hash', sha256(password)).maybeSingle();
      if (error) throw new Error('DB: ' + error.message);
      if (!c) return res.status(401).json({ error: 'Password salah' });

      // bersihkan sesi kedaluwarsa saja - jangan hapus sesi lain
      // (client boleh login di HP + laptop sekaligus)
      await db.from('client_sessions').delete()
        .eq('client_id', c.id).lt('expires_at', new Date().toISOString());

      // batasi 5 sesi aktif per client
      const { data: active } = await db.from('client_sessions')
        .select('token').eq('client_id', c.id)
        .order('created_at', { ascending: false });
      if ((active || []).length >= 5) {
        await db.from('client_sessions').delete()
          .in('token', (active || []).slice(4).map(s => s.token));
      }

      const expires = new Date(Date.now() + CLIENT_SESSION_DAYS * 86400 * 1000).toISOString();
      const { data: s, error: se } = await db.from('client_sessions')
        .insert({ client_id: c.id, expires_at: expires })
        .select('token,expires_at').single();
      if (se) throw new Error('DB: ' + se.message);
      return res.status(200).json({ ok: true, token: s.token, client: publicClient(c) });
    }

    if (action === 'client_session') {
      const sess = await getClientSession(token);
      if (!sess) return res.status(401).json({ error: 'Sesi habis, login ulang' });
      const { data: c, error } = await db.from('clients').select('*').eq('id', sess.client_id).single();
      if (error) throw new Error('DB: ' + error.message);
      return res.status(200).json({ ok: true, client: publicClient(c) });
    }

    if (action === 'client_logout') {
      await db.from('client_sessions').delete().eq('token', token);
      return res.status(200).json({ ok: true });
    }

    if (action === 'client_submit') {
      const sess = await getClientSession(token);
      if (!sess) return res.status(401).json({ error: 'Sesi habis, login ulang' });

      const { data: c, error } = await db.from('clients').select('*').eq('id', sess.client_id).single();
      if (error) throw new Error('DB: ' + error.message);

      const pool = c.photos || [];
      const wanted = Array.isArray(body.selected_files) ? body.selected_files : [];
      // hanya id yang benar-benar ada di pool foto client ini
      const chosen = pool.filter(p => wanted.some(w => str(w && w.id, 200) === p.id));

      const max = c.max_select || 0;
      if (max > 0 && chosen.length > max) {
        return res.status(400).json({ error: `Batas maksimal ${max} foto` });
      }

      // kalau admin menetapkan batas waktu, tolak pilihan yang masuk setelah lewat
      if (c.deadline && new Date(c.deadline).getTime() < Date.now()) {
        return res.status(400).json({ error: 'Batas waktu memilih foto sudah lewat' });
      }

      const note = str(body.note, MAX_NOTE).trim();
      const { error: ue } = await db.from('clients').update({
        selected_files: chosen.map(p => ({ id: p.id, name: p.name, thumb: p.thumb, zoom: p.zoom })),
        note,
        submitted: true
      }).eq('id', c.id);
      if (ue) throw new Error('DB: ' + ue.message);

      const { data: fresh } = await db.from('clients').select('*').eq('id', c.id).single();
      return res.status(200).json({ ok: true, total: chosen.length, client: publicClient(fresh) });
    }

    return res.status(400).json({ error: 'Aksi tidak dikenal: ' + action });
  } catch (e) {
    console.error('API error:', action, e);
    return res.status(500).json({ error: String(e.message || e) });
  }
};