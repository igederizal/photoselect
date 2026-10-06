// =====================
// STATE
// =====================
let clients = [];
let currentClient = null;
let adminPassword = 'admin123';
let selectedFiles = [];   // berisi ID foto yang dicentang
let currentPhotos = [];   // pool foto di grid: {id, name, thumb}
let pickerTargetId = null; // client yang sedang dipilihkan foto oleh admin
let pickerToken = '';       // token untuk akses Drive API (baca isi folder)
const MAX_PHOTOS = 5000;    // batas foto per client
const GOOGLE_AUTH_TTL = 24 * 60 * 60 * 1000; // login Google admin berlaku 24 jam

// Izin Drive: baca semua + buat folder + salin file (untuk fitur folder terpilih)
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const SCOPE_ID = 'drive-full-v1';

// Token Google di-cache. Login interaktif terakhir berlaku 24 jam
// (di dalam jendela itu token di-refresh senyap tanpa popup login)
let cachedToken = '';
let tokenExpiry = 0;
let gAuthTime = 0;            // waktu login Google interaktif terakhir
let forceAccountChooser = false; // true setelah admin klik "Ganti Akun"

try {
  cachedToken = localStorage.getItem('g_access_token') || '';
  tokenExpiry = parseInt(localStorage.getItem('g_token_expiry') || '0', 10);
  gAuthTime = parseInt(localStorage.getItem('g_auth_time') || '0', 10);

  // Scope izin berubah → buang token lama, paksa login ulang dengan izin baru
  if (localStorage.getItem('g_scope') !== SCOPE_ID) {
    cachedToken = '';
    tokenExpiry = 0;
    gAuthTime = 0;
    localStorage.removeItem('g_access_token');
    localStorage.removeItem('g_token_expiry');
    localStorage.removeItem('g_auth_time');
  }
} catch (e) {}

// Session lama (sebelum ada hitungan 24 jam) → mulai hitung dari sekarang
if (cachedToken && !gAuthTime) gAuthTime = Date.now();

// =====================
// GOOGLE DRIVE / PICKER
// =====================
const GOOGLE_CLIENT_ID = '382982310484-vjlock63pis42qe559rk04ie5uikj27s.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyAJRLdv3VKWh3EP1WiZxYUqE9rDYSaAAik';

function openDrivePicker(clientId) {
  if (!GOOGLE_API_KEY) {
    showModal('⚠️', 'API key Google belum diisi di script.js');
    return;
  }
  if (!window.google || !google.accounts || !google.accounts.oauth2) {
    showModal('⚠️', 'Google API belum termuat. Muat ulang halaman lalu coba lagi.');
    return;
  }

  pickerTargetId = clientId;
  pickerToken = '';

  getDriveToken(showPicker);
}

function getDriveToken(callback) {
  // Pakai token cache kalau masih berlaku — tanpa popup login
  if (cachedToken && Date.now() < tokenExpiry) {
    callback(cachedToken);
    return;
  }

  const withinTtl = gAuthTime > 0 && (Date.now() - gAuthTime) < GOOGLE_AUTH_TTL;
  const prompt = forceAccountChooser ? 'select_account'
               : withinTtl ? 'none'   // senyap, tanpa popup
               : '';                  // login interaktif (lewat 24 jam / pertama kali)
  requestGoogleToken(prompt, callback, prompt === 'none');
}

function requestGoogleToken(prompt, callback, canRetry) {
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: (resp) => {
      if (resp.error) {
        // Token senyap gagal → coba tampilan login biasa
        if (canRetry) {
          requestGoogleToken(forceAccountChooser ? 'select_account' : '', callback, false);
          return;
        }
        showModal('❌', 'Gagal login Google: ' + resp.error);
        return;
      }
      cachedToken = resp.access_token;
      tokenExpiry = Date.now() + ((resp.expires_in || 3600) - 120) * 1000;
      if (prompt !== 'none') {
        gAuthTime = Date.now(); // hanya login interaktif yang me-reset hitungan 24 jam
        forceAccountChooser = false;
      }
      try {
        localStorage.setItem('g_access_token', cachedToken);
        localStorage.setItem('g_token_expiry', String(tokenExpiry));
        localStorage.setItem('g_auth_time', String(gAuthTime));
        localStorage.setItem('g_scope', SCOPE_ID);
      } catch (e) {}
      callback(cachedToken);
    }
  });
  tokenClient.requestAccessToken({ prompt: prompt });
}

// =====================
// ADMIN: STATUS & GANTI AKUN GOOGLE
// =====================
function updateGoogleAuthStatus() {
  const el = document.getElementById('gauth-status');
  if (!el) return;

  const active = cachedToken && Date.now() < tokenExpiry;
  const withinTtl = gAuthTime > 0 && (Date.now() - gAuthTime) < GOOGLE_AUTH_TTL;

  if (active || withinTtl) {
    const until = new Date(gAuthTime + GOOGLE_AUTH_TTL);
    el.innerHTML = `✅ <strong>Tersambung</strong> — otomatis tanpa login sampai
      ${until.toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
  } else {
    el.innerHTML = `⚪ <strong>Belum tersambung</strong> — akan diminta login saat pilih foto`;
  }
}

function changeGoogleAccount() {
  if (!confirm('Ganti akun Google untuk akses Drive?\n\nSaat klik "Pilih Foto" berikutnya, jendela pilihan akun Google akan muncul.')) return;

  cachedToken = '';
  tokenExpiry = 0;
  gAuthTime = 0;
  forceAccountChooser = true;
  try {
    localStorage.removeItem('g_access_token');
    localStorage.removeItem('g_token_expiry');
    localStorage.removeItem('g_auth_time');
  } catch (e) {}

  updateGoogleAuthStatus();
  showModal('🔄',
    'Akun Google dihapus dari website.\n\n' +
    'Saat klik "📷 Pilih Foto / Folder dari Drive" berikutnya, ' +
    'pilih akun Google yang diinginkan.'
  );
}

function showPicker(token) {
  pickerToken = token;
  gapi.load('picker', { callback: () => buildPicker(token) });
}

function buildPicker(token) {
  const filesView = new google.picker.DocsView()
    .setMimeTypes('image/jpeg,image/png,image/webp,image/gif,image/heic');

  const foldersView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
    .setSelectFolderEnabled(true);

  const picker = new google.picker.PickerBuilder()
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .setTitle('Pilih foto atau folder (semua foto dalam folder akan diambil)')
    .setOAuthToken(token)
    .setDeveloperKey(GOOGLE_API_KEY)
    .addView(filesView)
    .addView(foldersView)
    .setCallback(onPickerCallback)
    .build();
  picker.setVisible(true);
}

// Ambil semua foto dalam satu folder (rekursif ke subfolder)
async function listFolderPhotos(folderId, token, out, depth) {
  if (out.length >= MAX_PHOTOS || depth > 4) return;

  let pageToken = '';
  do {
    const url = 'https://www.googleapis.com/drive/v3/files?' +
      new URLSearchParams({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken,files(id,name,mimeType,thumbnailLink)',
        pageSize: '1000',
        pageToken: pageToken
      }).toString();

    const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);

    for (const f of (data.files || [])) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        await listFolderPhotos(f.id, token, out, depth + 1);
      } else if (f.mimeType && f.mimeType.startsWith('image/')) {
        out.push({ id: f.id, name: f.name, thumb: '', thumbLink: f.thumbnailLink || '' });
      }
      if (out.length >= MAX_PHOTOS) break;
    }

    showModal('⏳', `Mengambil foto dari Drive... ${out.length} foto`);
    pageToken = data.nextPageToken || '';
  } while (pageToken && out.length < MAX_PHOTOS);
}

async function onPickerCallback(data) {
  if (data.action !== google.picker.Action.PICKED) return;

  const target = clients.find(c => c.id === pickerTargetId);
  if (!target) return;

  const docs = data[google.picker.Response.DOCUMENTS] || [];
  const photos = (target.photos || []).map(p => ({ ...p }));
  const newOnes = [];
  let added = 0;

  showModal('⏳', 'Mengambil foto dari Drive...');

  for (const d of docs) {
    if (d.mimeType === 'application/vnd.google-apps.folder') {
      const out = [];
      try {
        await listFolderPhotos(d.id, pickerToken, out, 0);
      } catch (e) {
        showModal('❌', 'Gagal membaca folder: ' + e.message);
        return;
      }
      out.forEach(p => {
        if (!photos.some(x => x.id === p.id) && photos.length < MAX_PHOTOS) {
          photos.push(p);
          newOnes.push(p);
          added++;
        }
      });
    } else if (d.mimeType && d.mimeType.startsWith('image/')) {
      if (!photos.some(p => p.id === d.id) && photos.length < MAX_PHOTOS) {
        const p = { id: d.id, name: d.name, thumb: '', thumbLink: '' };
        photos.push(p);
        newOnes.push(p);
        added++;
      }
    }
    if (photos.length >= MAX_PHOTOS) break;
  }

  if (added === 0) {
    showModal('ℹ️', 'Tidak ada foto baru yang dipilih.');
    return;
  }

  // Simpan thumbnail ke Supabase Storage supaya client bisa lihat tanpa Google
  // (termasuk foto lama yang thumb-nya belum pernah tersimpan — re-import jadi perbaikan)
  const needThumb = photos.filter(p => !p.thumb || !p.thumb.includes('/storage/'));
  let thumbResult = { ok: 0, fail: 0 };
  try {
    thumbResult = await cacheThumbnails(needThumb, pickerToken, target.id);
  } catch (e) {
    console.warn('Thumbnail cache error:', e);
  }

  // Simpan tanpa thumbLink (bersifat sementara)
  const toSave = photos.map(p => ({ id: p.id, name: p.name, thumb: p.thumb || '' }));

  const { error } = await db
    .from('clients')
    .update({ photos: toSave })
    .eq('id', target.id);

  if (error) {
    showModal('❌', 'Gagal simpan foto: ' + error.message);
    return;
  }

  target.photos = toSave;
  renderClientList();
  showModal('✅',
    `${added} foto berhasil diposting ke "${target.name}"!\n` +
    `Total foto: ${toSave.length}${toSave.length >= MAX_PHOTOS ? ' (maksimal ' + MAX_PHOTOS + ')' : ''}\n` +
    `Thumbnail tersimpan: ${thumbResult.ok} gagal: ${thumbResult.fail}` +
    (thumbResult.fail > 0 && thumbResult.error ? `\n\nError: ${thumbResult.error}` : '') + `\n\n` +
    `Client sekarang bisa memilih foto ini.`
  );
}

// =====================
// SIMPAN THUMBNAIL KE SUPABASE STORAGE (via server /api/thumb)
// =====================
async function cacheThumbnails(items, token, clientId) {
  const total = items.length;
  if (total === 0) return { ok: 0, fail: 0 };

  let ok = 0, fail = 0;
  let processed = 0;
  let firstError = '';
  let useDirect = false; // fallback langsung (untuk localhost tanpa server Vercel)
  const BATCH = 40;

  for (let i = 0; i < total; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    let results = null;

    if (!useDirect) {
      try {
        const resp = await fetch('/api/thumb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, clientId: clientId, ids: chunk.map(p => p.id) })
        });
        if (resp.status === 404) {
          useDirect = true; // tidak ada server (mis. localhost) → proses langsung
        } else if (resp.ok) {
          const j = await resp.json();
          results = j.results || [];
        } else {
          const j = await resp.json().catch(() => ({}));
          throw new Error(j.error || ('server HTTP ' + resp.status));
        }
      } catch (e) {
        if (!firstError) firstError = 'api/thumb: ' + String(e.message || e);
        if (!useDirect) {
          console.warn('api/thumb tidak terjangkau, fallback langsung:', e);
          useDirect = true;
        }
      }
    }

    if (results) {
      results.forEach(r => {
        const p = chunk.find(x => x.id === r.id);
        if (p && r.ok) {
          p.thumb = r.url;
          p.thumbLink = '';
          ok++;
        } else {
          fail++;
          if (!firstError && r.error) firstError = r.error;
          console.warn('Server thumb error:', r.id, r.error);
        }
        processed++;
      });
    } else {
      // Fallback: download via googleapis (CORS aman) → resize di browser → upload
      for (const p of chunk) {
        try {
          const r = await fetch(
            `https://www.googleapis.com/drive/v3/files/${p.id}?alt=media`,
            { headers: { Authorization: 'Bearer ' + token } }
          );
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const blob = await resizeBlob(await r.blob(), 1024);
          const path = `${clientId}/${p.id}.jpg`;
          const { error } = await db.storage.from('thumbs')
            .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
          if (error) throw error;
          const { data: pub } = db.storage.from('thumbs').getPublicUrl(path);
          p.thumb = pub.publicUrl;
          p.thumbLink = '';
          ok++;
        } catch (e) {
          if (!firstError) firstError = 'direct: ' + String(e.message || e);
          console.warn('Gagal thumbnail', p.name, e);
          fail++;
        }
        processed++;
      }
    }

    showModal('⏳', `Menyimpan thumbnail... ${processed}/${total}`);
  }

  return { ok: ok, fail: fail, error: firstError };
}

async function resizeBlob(blobIn, maxW) {
  try {
    const bmp = await createImageBitmap(blobIn);
    const scale = Math.min(1, maxW / bmp.width);
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const out = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.8));
    return out || blobIn;
  } catch (e) {
    return blobIn;
  }
}

// =====================
// GENERATE PASSWORD
// =====================
function createRandomPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let pw = '';
  for (let i = 0; i < 8; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}

// =====================
// LOAD DATA DARI SUPABASE
// =====================
async function loadClients() {
  const { data, error } = await db
    .from('clients')
    .select('*')
    .order('id');

  if (error) {
    console.error('Gagal load clients:', error);
    return;
  }
  clients = data || [];
}

async function loadAdminPassword() {
  const { data, error } = await db
    .from('admin')
    .select('password')
    .limit(1)
    .single();

  if (data && data.password) {
    adminPassword = data.password;
  }
}

// =====================
// LOGIN (tunggal: client ATAU admin)
// =====================
async function clientLogin() {
  const input = document.getElementById('client-password').value.trim();
  const errorEl = document.getElementById('login-error');

  if (!input) {
    errorEl.textContent = '❌ Masukkan password dulu!';
    errorEl.classList.remove('hidden');
    return;
  }

  // 1. Cek password admin
  if (input === adminPassword) {
    errorEl.classList.add('hidden');
    document.getElementById('client-password').value = '';
    openAdmin();
    return;
  }

  // 2. Cek password client dari Supabase
  const { data, error } = await db
    .from('clients')
    .select('*')
    .eq('password', input)
    .maybeSingle();

  if (!data) {
    errorEl.textContent = '❌ Password salah! Coba lagi.';
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');
  currentClient = data;
  document.getElementById('section-login').classList.add('hidden');
  document.getElementById('client-password').value = '';
  showGallery(currentClient);
  localStorage.setItem('logged_client_id', data.id);
}

// =====================
// BUKA PANEL ADMIN
// =====================
function openAdmin() {
  document.getElementById('section-login').classList.add('hidden');
  document.getElementById('section-gallery').classList.add('hidden');
  document.getElementById('section-admin').classList.remove('hidden');
  renderClientList();
  updateGoogleAuthStatus();
}

function adminLogout() {
  document.getElementById('section-admin').classList.add('hidden');
  document.getElementById('section-login').classList.remove('hidden');
  document.getElementById('client-password').value = '';
}

async function changeAdminPassword() {
  const input = document.getElementById('new-admin-pw').value;
  if (!input || input.length < 4) {
    alert('Password minimal 4 karakter!');
    return;
  }

  const { error } = await db
    .from('admin')
    .update({ password: input })
    .eq('id', 1);

  if (error) {
    alert('Gagal update password admin!');
    return;
  }

  adminPassword = input;
  document.getElementById('new-admin-pw').value = '';
  showModal('✅', `Password admin berhasil diubah ke: ${input}\n\nIngat password ini untuk login berikutnya!`);
}

// =====================
// ADMIN: TAMBAH CLIENT
// =====================
async function addClient() {
  const nameInput = document.getElementById('new-client-name');
  const name = nameInput.value.trim();

  if (!name) { alert('Masukkan nama client dulu!'); return; }
  if (clients.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    alert('Nama client sudah ada!'); return;
  }

  const password = createRandomPassword();
  const folderName = `Project_${name.replace(/\s+/g, '_')}`;

  const newClient = {
    name: name,
    password: password,
    folder: folderName,
    status: 'Menunggu',
    note: '',
    selected_files: [],
    submitted: false
  };

  const { data, error } = await db
    .from('clients')
    .insert([newClient])
    .select()
    .single();

  if (error) {
    alert('Gagal simpan ke database!\n\nError: ' + error.message + '\nCode: ' + error.code + '\nDetails: ' + JSON.stringify(error, null, 2));
    console.error('Add client error:', error);
    return;
  }

  clients.push(data);
  renderClientList();
  nameInput.value = '';

  showModal('✅',
    `Client "${name}" berhasil ditambahkan!\n\n` +
    `Password: ${password}\n` +
    `Folder: ${folderName}\n\n` +
    `Kirim password ini ke client Anda.`
  );
}

// =====================
// ADMIN: HAPUS CLIENT
// =====================
async function deleteClient(id) {
  const client = clients.find(c => c.id === id);
  if (!client) return;
  if (!confirm(`Hapus client "${client.name}"?`)) return;

  const { error } = await db
    .from('clients')
    .delete()
    .eq('id', id);

  if (error) {
    alert('Gagal hapus dari database!');
    return;
  }

  clients = clients.filter(c => c.id !== id);
  renderClientList();
}

// =====================
// ADMIN: UBAH STATUS
// =====================
async function changeStatus(id, newStatus) {
  const { error } = await db
    .from('clients')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) {
    alert('Gagal update status!');
    return;
  }

  const client = clients.find(c => c.id === id);
  if (client) client.status = newStatus;
  renderClientList();
}

// =====================
// ADMIN: KOSONGKAN FOTO CLIENT
// =====================
async function clearClientPhotos(id) {
  const client = clients.find(c => c.id === id);
  if (!client) return;
  if (!confirm(`Kosongkan semua foto untuk "${client.name}"?`)) return;

  const { error } = await db
    .from('clients')
    .update({ photos: [] })
    .eq('id', id);

  if (error) {
    alert('Gagal mengosongkan foto!');
    return;
  }

  client.photos = [];
  renderClientList();
}

// =====================
// ADMIN: SALIN FOTO TERPILIH KE FOTO DRIVE BARU
// =====================
async function findOrCreateFolder(token, name) {
  const esc = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `name = '${esc}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const url = 'https://www.googleapis.com/drive/v3/files?' +
    new URLSearchParams({ q: q, fields: 'files(id)', pageSize: '10' });

  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  if (j.files && j.files.length) return j.files[0].id;

  const cr = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, mimeType: 'application/vnd.google-apps.folder' })
  });
  const cj = await cr.json();
  if (cj.error) throw new Error(cj.error.message);
  return cj.id;
}

async function listChildNames(token, folderId) {
  const names = new Set();
  let pageToken = '';
  do {
    const url = 'https://www.googleapis.com/drive/v3/files?' +
      new URLSearchParams({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken,files(name)',
        pageSize: '1000',
        pageToken: pageToken
      }).toString();
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    (j.files || []).forEach(f => names.add(f.name));
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return names;
}

async function copySelectedToDrive(clientId) {
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  const sel = client.selected_files || [];
  if (!client.submitted || sel.length === 0) {
    showModal('ℹ️', 'Client ini belum mengirim pilihan foto.');
    return;
  }

  getDriveToken(async (token) => {
    try {
      const folderName = client.folder + '_Selected';
      showModal('⏳', `Mempersiapkan folder "${folderName}"...`);

      const folderId = await findOrCreateFolder(token, folderName);
      const existing = await listChildNames(token, folderId);

      const items = sel
        .map(f => (typeof f === 'string' ? { name: f } : { id: f.id, name: f.name }))
        .filter(f => f.id);

      let copied = 0, skipped = 0, failed = 0, done = 0;

      for (let i = 0; i < items.length; i += 4) {
        await Promise.all(items.slice(i, i + 4).map(async f => {
          done++;
          if (existing.has(f.name)) {
            skipped++;
            return;
          }

          try {
            const r = await fetch(
              `https://www.googleapis.com/drive/v3/files/${f.id}/copy`,
              {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: f.name, parents: [folderId] })
              }
            );
            const j = await r.json();
            if (j.error) throw new Error(j.error.message);
            copied++;
          } catch (e) {
            console.warn('Gagal salin', f.name, e);
            failed++;
          }
          showModal('⏳', `Menyalin foto ke Drive... ${done}/${items.length}`);
        }));
      }

      const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

      const { error } = await db
        .from('clients')
        .update({ selected_folder: folderUrl })
        .eq('id', client.id);

      if (error) console.warn('Gagal simpan link folder:', error);
      client.selected_folder = folderUrl;
      renderClientList();

      showModal('✅',
        `Folder "${folderName}" siap di Google Drive!\n\n` +
        `Disalin: ${copied}\n` +
        `Sudah ada (dilewati): ${skipped}\n` +
        `Gagal: ${failed}\n\n` +
        `Klik "🔗 Buka folder" di kartu client untuk membukanya.`
      );
    } catch (e) {
      showModal('❌', 'Gagal membuat folder: ' + e.message);
    }
  });
}

// =====================
// ADMIN: BATAS FOTO DIPILIH
// =====================
async function setMaxSelect(id, val) {
  const client = clients.find(c => c.id === id);
  if (!client) return;
  let n = parseInt(val, 10);
  if (isNaN(n) || n < 0) n = 0;

  const { error } = await db.from('clients').update({ max_select: n }).eq('id', id);
  if (error) {
    showToast('Gagal simpan batas foto');
    return;
  }
  client.max_select = n;
  showToast(n > 0 ? `Batas disimpan: maksimal ${n} foto dipilih` : 'Batas dilepas (tanpa batas)');
}

// =====================
// ADMIN: RENDER LIST
// =====================
function renderClientList() {
  const container = document.getElementById('client-list');

  if (clients.length === 0) {
    container.innerHTML = '<p class="empty-msg">Belum ada client. Tambahkan client baru di atas.</p>';
    return;
  }

  container.innerHTML = clients.map((client, idx) => {
    const statusClass = 'status-' + client.status.toLowerCase();
    const files = client.selected_files || [];
    const fileNames = files.map(f => (typeof f === 'string' ? f : f.name));
    const photoCount = (client.photos || []).length;
    const selectedInfo = client.submitted && files.length > 0
      ? `<div class="selected-info">✅ ${files.length} foto dipilih: ${fileNames.join(', ')}</div>`
      : '';
    const noteInfo = client.note
      ? `<div class="note-box">📝 ${client.note}</div>`
      : '<div class="note-box"><span class="no-note">Belum ada catatan</span></div>';

    return `
    <div class="client-row client-card">
      <div class="client-top">
        <div class="client-num">${idx + 1}</div>
        <div class="client-info">
          <span class="name">${client.name}</span>
          <span class="folder">📁 ${client.folder}</span>
        </div>
        <div class="pw-box" onclick="copyPassword('${client.password}')" title="Klik untuk copy">
          ${client.password}
        </div>
      </div>

      <div class="client-detail">
        <span class="status-badge ${statusClass}">${client.status}</span>
        <div class="status-picker">
          <button class="status-btn s-menunggu" onclick="changeStatus(${client.id}, 'Menunggu')">Menunggu</button>
          <button class="status-btn s-diproses" onclick="changeStatus(${client.id}, 'Diproses')">Diproses</button>
          <button class="status-btn s-selesai" onclick="changeStatus(${client.id}, 'Selesai')">Selesai</button>
        </div>
      </div>

      <div class="limit-row">
        <span>Maks. foto dipilih</span>
        <input type="number" min="0" value="${client.max_select || 0}"
               onchange="setMaxSelect(${client.id}, this.value)"
               title="Isi 0 untuk tanpa batas">
        <span class="limit-hint">0 = tanpa batas</span>
      </div>

      <div class="photo-actions">
        <button class="drive-btn" onclick="openDrivePicker(${client.id})">📷 Pilih Foto / Folder dari Drive</button>
        <span class="photo-count">🎞️ ${photoCount} foto diposting</span>
        ${photoCount > 0 ? `<button class="clear-photo-btn" onclick="clearClientPhotos(${client.id})">Kosongkan</button>` : ''}
      </div>

      ${selectedInfo}
      ${client.submitted && files.length > 0 ? `
      <div class="folder-actions">
        <button class="drive-btn" onclick="copySelectedToDrive(${client.id})">
          📁 Salin ${files.length} foto terpilih ke folder
        </button>
        ${client.selected_folder ? `<a class="folder-link" href="${client.selected_folder}" target="_blank" rel="noopener">🔗 Buka folder di Drive</a>` : ''}
      </div>` : ''}
      ${noteInfo}

      <button class="delete-btn" onclick="deleteClient(${client.id})">Hapus</button>
    </div>
  `;
  }).join('');
}

// =====================
// ADMIN: HAPUS SEMUA DATA
// =====================
async function clearAllData() {
  if (!confirm('Hapus SEMUA data client? Tindakan ini tidak bisa dibatalkan!')) return;

  const { error } = await db
    .from('clients')
    .delete()
    .neq('id', 0);

  if (error) {
    alert('Gagal hapus data!');
    return;
  }

  clients = [];
  renderClientList();
  showModal('🗑️', 'Semua data client berhasil dihapus.');
}

function copyPassword(pw) {
  navigator.clipboard.writeText(pw).then(() => {
    showModal('📋', `Password "${pw}" berhasil di-copy!`);
  }).catch(() => {
    showModal('📋', `Password: ${pw}\n(Salin manual ya)`);
  });
}

// =====================
// TAMPILKAN GALLERY
// =====================
function showGallery(client) {
  document.getElementById('section-gallery').classList.remove('hidden');
  document.getElementById('gallery-folder-name').textContent = `📁 ${client.folder}`;
  document.getElementById('gallery-client-name').textContent = `Client: ${client.name}`;

  const statusEl = document.getElementById('gallery-status');
  statusEl.textContent = `Status: ${client.status}`;
  statusEl.className = 'status-badge status-' + client.status.toLowerCase();

  // Pool foto = yang diposting admin
  const photos = client.photos || [];
  currentPhotos = photos.map(p => ({ ...p }));

  // Pilihan tersimpan client (hanya yang masih ada di pool)
  const saved = client.selected_files || [];
  const savedIds = saved.map(f => (typeof f === 'string' ? f : f.id));
  selectedFiles = savedIds.filter(id => currentPhotos.some(p => p.id === id));

  document.getElementById('client-note').value = client.note || '';

  renderFileGrid();
  updateSelectCount();
}

// =====================
// RENDER FILE GRID + CHECKBOX
// =====================
function renderFileGrid() {
  const grid = document.getElementById('file-grid');

  if (currentPhotos.length === 0) {
    grid.innerHTML = `
      <div class="empty-grid">
        <span class="empty-icon">📷</span>
        <p>Belum ada foto di galeri ini.<br>Admin belum memposting foto untuk project Anda.</p>
      </div>`;
    return;
  }

  grid.innerHTML = currentPhotos.map(p => {
    const isSelected = selectedFiles.includes(p.id);
    const fallback = 'https://drive.google.com/thumbnail?id=' + p.id + '&sz=w400';
    const thumbHtml = p.thumb || p.id
      ? `<img src="${p.thumb || fallback}" alt="${p.name}" loading="lazy"
               onerror="this.onerror=null;this.src='${fallback}'">`
      : '📷';
    return `
    <div class="file-card ${isSelected ? 'selected' : ''}" data-id="${p.id}" onclick="toggleSelect('${p.id}')">
      <div class="check-mark">✓</div>
      <button class="zoom-btn" title="Perbesar"
              onclick="event.stopPropagation(); zoomPhoto('${p.id}')">🔍</button>
      <div class="file-thumb">${thumbHtml}</div>
      <div class="file-info">
        <div class="fname">${p.name}</div>
      </div>
    </div>
  `;
  }).join('');
}

// =====================
// ZOOM FOTO (pratinjau layar penuh)
// =====================
function zoomPhoto(fileId) {
  const p = currentPhotos.find(x => x.id === fileId);
  if (!p) return;

  const src = p.thumb || ('https://drive.google.com/thumbnail?id=' + p.id + '&sz=w1024');
  document.getElementById('zoom-img').src = src;
  document.getElementById('zoom-name').textContent = p.name;
  document.getElementById('zoom-overlay').classList.remove('hidden');
}

function closeZoom() {
  const overlay = document.getElementById('zoom-overlay');
  overlay.classList.add('hidden');
  document.getElementById('zoom-img').src = '';
}

// =====================
// TOGGLE PILIH FOTO
// =====================
function toggleSelect(fileId) {
  const idx = selectedFiles.indexOf(fileId);
  if (idx >= 0) {
    selectedFiles.splice(idx, 1);
  } else {
    const max = (currentClient && currentClient.max_select) || 0;
    if (max > 0 && selectedFiles.length >= max) {
      showModal('⚠️', `Maksimal ${max} foto yang bisa dipilih.\n\nBatalkan salah satu pilihan dulu untuk mengganti.`);
      return;
    }
    selectedFiles.push(fileId);
  }

  // Update kartu saja (tanpa render ulang — cepat untuk ribuan foto)
  const card = document.querySelector(`.file-card[data-id="${fileId}"]`);
  if (card) card.classList.toggle('selected', selectedFiles.includes(fileId));
  updateSelectCount();
}

function updateSelectCount() {
  const max = (currentClient && currentClient.max_select) || 0;
  const label = max > 0
    ? `${selectedFiles.length} / ${max} foto dipilih`
    : `${selectedFiles.length} foto dipilih`;
  document.getElementById('select-count').textContent = label;
}

// =====================
// SUBMIT PILIHAN (kirim ke Supabase)
// =====================
async function submitSelection() {
  if (!currentClient) return;

  if (selectedFiles.length === 0) {
    showModal('⚠️', 'Pilih minimal 1 foto dulu sebelum kirim!');
    return;
  }

  const maxSel = (currentClient && currentClient.max_select) || 0;
  if (maxSel > 0 && selectedFiles.length > maxSel) {
    showModal('⚠️', `Batas maksimal ${maxSel} foto.\n\nKurangi pilihan Anda dulu sebelum kirim.`);
    return;
  }

  const note = document.getElementById('client-note').value.trim();

  const chosen = currentPhotos.filter(p => selectedFiles.includes(p.id));

  const { error } = await db
    .from('clients')
    .update({
      selected_files: chosen.map(p => ({ id: p.id, name: p.name, thumb: p.thumb })),
      note: note,
      submitted: true
    })
    .eq('id', currentClient.id);

  if (error) {
    alert('Gagal simpan pilihan!');
    console.error(error);
    return;
  }

  // Update state lokal
  currentClient.selected_files = chosen.map(p => ({ id: p.id, name: p.name, thumb: p.thumb }));
  currentClient.note = note;
  currentClient.submitted = true;

  const idx = clients.findIndex(c => c.id === currentClient.id);
  if (idx >= 0) clients[idx] = currentClient;

  showModal('✅',
    `Pilihan berhasil dikirim!\n\n` +
    `${chosen.length} foto terpilih\n` +
    `Catatan: ${note || '(tidak ada)'}\n\n` +
    `Admin akan melihat pilihan Anda.`
  );
}

// =====================
// VIEW / DOWNLOAD
// =====================
function viewFile(name, size) {
  showModal('🖼️', `${name}\nUkuran: ${size}`);
}

// =====================
// LOGOUT (client)
// =====================
function logout() {
  currentClient = null;
  selectedFiles = [];
  currentPhotos = [];
  localStorage.removeItem('logged_client_id');
  document.getElementById('client-password').value = '';
  document.getElementById('section-gallery').classList.add('hidden');
  document.getElementById('section-login').classList.remove('hidden');
}

// =====================
// MODAL
// =====================
function showModal(icon, text) {
  document.getElementById('modal-icon').textContent = icon;
  document.getElementById('modal-text').textContent = text;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

// =====================
// INIT (load dari Supabase)
// =====================
document.addEventListener('DOMContentLoaded', async function() {
  // Load data dari Supabase
  await loadClients();
  await loadAdminPassword();

  // Cek session login sebelumnya
  const savedId = localStorage.getItem('logged_client_id');
  if (savedId) {
    const fresh = clients.find(c => c.id === parseInt(savedId));
    if (fresh) {
      currentClient = fresh;
      document.getElementById('section-login').classList.add('hidden');
      showGallery(currentClient);
    } else {
      localStorage.removeItem('logged_client_id');
    }
  }
});

function showToast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
