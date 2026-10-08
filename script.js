// =====================
// STATE
// =====================
let clients = [];
let currentClient = null;
let selectedFiles = [];   // berisi ID foto yang dicentang
let currentPhotos = [];   // pool foto di grid: {id, name, thumb, zoom}
let renderedCount = 0;    // berapa foto sudah dirender di grid
const RENDER_BATCH = 60;  // foto per batch (biar HP tidak berat)
let loadObserver = null;  // pemicu muat foto berikutnya saat scroll
let pickerTargetId = null; // client yang sedang dipilihkan foto oleh admin
let pickerToken = '';       // token untuk akses Drive API (baca isi folder)
let pickerMode = 'photos';  // 'photos' = pilih foto satuan, 'folder' = import folder
const MAX_PHOTOS = 5000;    // batas foto per client
const GOOGLE_AUTH_TTL = 24 * 60 * 60 * 1000; // login Google admin berlaku 24 jam

// =====================
// SESI (token dari server - password tidak pernah disimpan di browser)
// =====================
let adminToken = localStorage.getItem('mh_admin_token') || '';
let clientToken = localStorage.getItem('mh_client_token') || '';

async function api(action, payload = {}) {
  const token = action.startsWith('admin_') ? adminToken : clientToken;
  const resp = await fetch('/api/app', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action, token: token, ...payload })
  });
  const j = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(j.error || ('HTTP ' + resp.status));
  return j;
}

function clearAdminSession() {
  adminToken = '';
  localStorage.removeItem('mh_admin_token');
}

function clearClientSession() {
  clientToken = '';
  localStorage.removeItem('mh_client_token');
  currentClient = null;
  selectedFiles = [];
  currentPhotos = [];
}

// Escape HTML: nama/catatan client tidak boleh jadi kode
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

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

function openDrivePicker(clientId, mode) {
  if (!GOOGLE_API_KEY) {
    showModal('⚠️', 'API key Google belum diisi di script.js');
    return;
  }
  if (!window.google || !google.accounts || !google.accounts.oauth2) {
    showModal('⚠️', 'Google API belum termuat. Muat ulang halaman lalu coba lagi.');
    return;
  }

  pickerMode = mode === 'folder' ? 'folder' : 'photos';
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
    el.textContent = 'tersambung \u00b7 berlaku sampai ' +
      until.toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } else {
    el.textContent = 'belum tersambung \u00b7 diminta login saat pilih foto';
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
  const builder = new google.picker.PickerBuilder()
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .setTitle(pickerMode === 'folder'
      ? 'Klik 1x folder lalu Select untuk ambil semua isinya, atau klik 2x untuk masuk dan pilih sebagian'
      : 'Pilih foto - klik untuk memilih, Ctrl+klik untuk beberapa')
    .setOAuthToken(token)
    .setDeveloperKey(GOOGLE_API_KEY)
    .setCallback(onPickerCallback);

  if (pickerMode === 'folder') {
    // Tampilkan folder DAN file di dalamnya, supaya bisa:
    //   - klik 1x folder  -> Select  = ambil seluruh isi folder
    //   - klik 2x folder  -> masuk   = pilih sebagian foto di dalamnya
    builder.addView(
      new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes('application/vnd.google-apps.folder,image/jpeg,image/png,image/webp,image/gif,image/heic')
    );
  } else {
    // Hanya file: daftar foto satuan, bisa pilih beberapa
    builder.addView(
      new google.picker.DocsView().setMimeTypes('image/jpeg,image/png,image/webp,image/gif,image/heic')
    );
  }

  const picker = builder.build();
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
  const toSave = photos.map(p => ({ id: p.id, name: p.name, thumb: p.thumb || '', zoom: p.zoom || '' }));

  try {
    await api('admin_save_photos', { id: target.id, photos: toSave });
  } catch (e) {
    showModal('❌', 'Gagal simpan foto: ' + e.message);
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
          p.zoom = r.zoomUrl || '';
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
      // Server thumbnail tidak tersedia (mis. dibuka langsung tanpa server Vercel).
      // Thumbnail hanya bisa dibuat server-side (butuh kunci database), jadi dilewati.
      if (!firstError) firstError = 'Server thumbnail tidak tersedia (butuh /api/thumb)';
      for (const p of chunk) { fail++; processed++; }
    }

    showModal('⏳', `Menyimpan thumbnail... ${processed}/${total}`);
  }

  return { ok: ok, fail: fail, error: firstError };
}

// =====================
// LOAD DATA (lewat server, bukan langsung ke database)
// =====================
async function refreshAdminList() {
  clients = (await api('admin_list')).clients || [];
  renderClientList();
}

// =====================
// LOGIN (tunggal: client ATAU admin, dicek server)
// =====================
async function clientLogin() {
  const input = document.getElementById('client-password').value.trim();
  const errorEl = document.getElementById('login-error');

  if (!input) {
    errorEl.textContent = 'Masukkan password dulu';
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');
  const pwField = document.getElementById('client-password');
  pwField.classList.remove('bad');
  pwField.value = '';

  // 1. Coba sebagai admin
  try {
    const r = await api('admin_login', { password: input });
    adminToken = r.token;
    localStorage.setItem('mh_admin_token', adminToken);
    clearClientSession();
    clients = (await api('admin_list')).clients || [];
    openAdmin();
    return;
  } catch (e) { /* bukan password admin, lanjut coba client */ }

  // 2. Coba sebagai client
  try {
    const r = await api('client_login', { password: input });
    clientToken = r.token;
    localStorage.setItem('mh_client_token', clientToken);
    clearAdminSession();
    currentClient = r.client;
    setView('gallery');
    switchSection('section-gallery');
    showGallery(currentClient);
    return;
  } catch (e) {
    errorEl.textContent = 'Password salah, coba lagi';
    errorEl.classList.remove('hidden');
    document.getElementById('client-password').classList.add('bad');
  }
}

// =====================
// TRANSISI HALAMAN
// =====================
// Semua halaman punya bar sendiri, jadi header brand global tidak dipakai lagi.
function setView(view) {
  document.body.classList.toggle('view-login', view === 'login');
  document.body.classList.toggle('view-gallery', view === 'gallery');
  document.body.classList.toggle('view-admin', view === 'admin');
}

// Mengganti isi layar dengan fade singkat supaya tidak "lompat"
function switchSection(target) {
  const login = document.getElementById('section-login');
  const admin = document.getElementById('section-admin');
  const gallery = document.getElementById('section-gallery');
  const next = document.getElementById(target);
  const current = [login, admin, gallery].find(s => s && !s.classList.contains('hidden'));

  if (current === next) return;
  if (!current || !next) {
    [login, admin, gallery].forEach(s => s && s.classList.add('hidden'));
    if (next) next.classList.remove('hidden');
    return;
  }

  current.style.opacity = '0';
  setTimeout(() => {
    current.classList.add('hidden');
    current.style.opacity = '';
    next.classList.remove('hidden');
    window.scrollTo(0, 0);
    next.style.opacity = '0';
    // paksa reflow supaya transisi opacity benar-benar jalan
    void next.offsetHeight;
    next.style.transition = 'opacity 0.4s ease';
    next.style.opacity = '1';
  }, 260);
}

// =====================
// BUKA PANEL ADMIN
// =====================
function openAdmin() {
  setView('admin');
  switchSection('section-admin');
  renderClientList();
  updateGoogleAuthStatus();
}

function adminLogout() {
  api('admin_logout').catch(() => {});
  clearAdminSession();
  setView('login');
  switchSection('section-login');
  document.getElementById('client-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
}

async function changeAdminPassword() {
  const cur = document.getElementById('current-admin-pw').value;
  const input = document.getElementById('new-admin-pw').value;
  if (!input || input.length < 6) {
    alert('Password baru minimal 6 karakter!');
    return;
  }

  let hasil;
  try {
    hasil = await api('admin_change_password', { currentPassword: cur, newPassword: input });
  } catch (e) {
    alert('Gagal update password admin!\n\n' + e.message);
    return;
  }

  document.getElementById('current-admin-pw').value = '';
  document.getElementById('new-admin-pw').value = '';

  showModal('✅',
    'Password admin berhasil diubah.\n\n' +
    'Password baru: ' + input + '\n\n' +
    (hasil.verified
      ? '✅ Sudah diverifikasi: password baru ini aktif dan siap dipakai login.'
      : '⚠️ Penyimpanan terverifikasi, tapi password baru gagal dicek ulang. Coba ganti sekali lagi.')
  );
}

// Lihat / sembunyikan password pada input form
function toggleInputPw(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const jadiTerlihat = el.type === 'password';
  el.type = jadiTerlihat ? 'text' : 'password';
  btn.textContent = jadiTerlihat ? '🙈' : '👁';
  btn.title = jadiTerlihat ? 'Sembunyikan password' : 'Lihat password';
}

// =====================
// ADMIN: TAMBAH CLIENT
// =====================
async function addClient() {
  const nameInput = document.getElementById('new-client-name');
  const name = nameInput.value.trim();

  if (!name) { showToast('Isi nama client dulu', true); nameInput.focus(); return; }

  let created;
  try {
    const r = await api('admin_add_client', { name: name });
    created = r.client;
  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message, true);
    return;
  }

  clients.unshift(created);
  setFilter(null, 'Semua');
  renderClientList();
  nameInput.value = '';
  nameInput.blur();

  const msg = document.getElementById('admin-message');
  if (msg) {
    msg.textContent = 'Client "' + name + '" dibuat. Password: ' +
      (created.password || '(buka detail untuk lihat)');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 8000);
  }
  showToast('Client "' + name + '" dibuat');
  openClientDetail(created.id);
}

// =====================
// ADMIN: RESET PASSWORD CLIENT
// =====================
async function resetClientPassword(id) {
  const client = clients.find(c => c.id === id);
  if (!client) return;
  if (!confirm(`Generate password baru untuk "${client.name}"?\n\nPassword lama tidak berlaku lagi.`)) return;

  let password;
  try {
    const r = await api('admin_reset_password', { id: id });
    password = r.password;
  } catch (e) {
    alert('Gagal reset password!\n\n' + e.message);
    return;
  }

  client.password = password;
  renderClientList();
  // password baru harus langsung terlihat, jadi buka lagi panel detail
  if (CD_ID !== null) openClientDetail(client.id);
  showToast('Password baru: ' + password);
}

// =====================
// ADMIN: HAPUS CLIENT
// =====================
async function deleteClient(id) {
  const client = clients.find(c => c.id === id);
  if (!client) return;
  if (!confirm(`Hapus client "${client.name}"?\n\nThumbnail-nya juga akan dihapus dari Supabase.`)) return;

  let thumbs = 0;
  try {
    const r = await api('admin_delete_client', { id: id });
    thumbs = r.thumbs || 0;
  } catch (e) {
    alert('Gagal hapus dari database!\n\n' + e.message);
    return;
  }

  clients = clients.filter(c => c.id !== id);
  renderClientList();
  if (thumbs > 0) showToast(`Thumbnail dibersihkan: ${thumbs} file`);
}

// =====================
// ADMIN: UBAH STATUS
// =====================
async function changeStatus(id, newStatus) {
  try {
    await api('admin_update_status', { id: id, status: newStatus });
  } catch (e) {
    alert('Gagal update status!\n\n' + e.message);
    return;
  }

  const client = clients.find(c => String(c.id) === String(id));
  if (client) client.status = newStatus;
  renderClientList();
  // panel detail masih terbuka: segarkan supaya label status ikut berubah
  if (CD_ID !== null && String(CD_ID) === String(id)) openClientDetail(id);
  showToast('Status: ' + newStatus);
}

// =====================
// ADMIN: BATAS WAKTU PILIHAN CLIENT
// =====================
async function setDeadline(id, value) {
  const client = clients.find(c => String(c.id) === String(id));
  if (!client) return;

  let deadline = null;
  if (value) {
    // input type=date tidak punya jam; pakai akhir hari agar tidak cutoff di pagi hari
    const d = new Date(value + 'T23:59:59');
    if (isNaN(d.getTime())) { showToast('Tanggal tidak valid', true); return; }
    deadline = d.toISOString();
  }

  try {
    await api('admin_set_deadline', { id: id, deadline: deadline });
  } catch (e) {
    showToast('Gagal menyimpan batas waktu: ' + e.message, true);
    return;
  }

  client.deadline = deadline;
  renderClientList();
  if (CD_ID !== null) openClientDetail(id);
  showToast(deadline ? 'Batas waktu disimpan' : 'Batas waktu dihapus');
}

// =====================
// ADMIN: KOSONGKAN FOTO CLIENT
// =====================
async function clearClientPhotos(id) {
  const client = clients.find(c => c.id === id);
  if (!client) return;
  if (!confirm(`Kosongkan semua foto untuk "${client.name}"?\n\nThumbnail tersimpan juga akan dihapus dari Supabase.`)) return;

  let thumbs = 0;
  try {
    const r = await api('admin_clear_photos', { id: id });
    thumbs = r.thumbs || 0;
  } catch (e) {
    alert('Gagal mengosongkan foto!\n\n' + e.message);
    return;
  }

  client.photos = [];
  renderClientList();
  if (thumbs > 0) showToast(`Thumbnail dibersihkan: ${thumbs} file`);
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

      try {
        await api('admin_set_folder', { id: client.id, url: folderUrl });
        client.selected_folder = folderUrl;
      } catch (e) {
        console.warn('Gagal simpan link folder:', e);
      }
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
// ADMIN: HAPUS FOLDER HASIL SALINAN (ke Trash Google Drive)
// =====================
function deleteSelectedFolder(id) {
  const client = clients.find(c => c.id === id);
  if (!client || !client.selected_folder) return;

  if (!confirm(
    `Hapus folder salinan "${client.folder}_Selected"?\n\n` +
    `Folder beserta isinya dipindahkan ke Trash Google Drive\n` +
    `(bisa dipulihkan selama 30 hari).\n\n` +
    `Foto asli client TIDAK terpengaruh.`)) return;

  getDriveToken(async (token) => {
    try {
      const m = client.selected_folder.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (!m) {
        showModal('❌', 'Link folder tidak valid.');
        return;
      }

      const resp = await fetch('https://www.googleapis.com/drive/v3/files/' + m[1], {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });

      if (!resp.ok && resp.status !== 404) {
        const j = await resp.json().catch(() => ({}));
        throw new Error((j.error && j.error.message) || ('HTTP ' + resp.status));
      }

      try {
        await api('admin_set_folder', { id: id, url: '' });
      } catch (e) {
        console.warn('Gagal simpan selected_folder:', e);
      }

      client.selected_folder = null;
      renderClientList();
      showModal('🗑️', 'Folder salinan dihapus (masuk Trash Google Drive).\n\nPulihkan dari Trash dalam 30 hari kalau masih perlu.');
    } catch (e) {
      showModal('❌', 'Gagal hapus folder: ' + e.message);
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

  try {
    await api('admin_set_max', { id: id, max: n });
  } catch (e) {
    showToast('Gagal simpan batas foto');
    return;
  }
  client.max_select = n;
  showToast(n > 0 ? `Batas disimpan: maksimal ${n} foto dipilih` : 'Batas dilepas (tanpa batas)');
}

// =====================
// ADMIN: RENDER LIST
// =====================
let clientFilter = 'Semua';
let CD_ID = null;      // client yang sedang dibuka di panel detail

function renderStats() {
  const n = { Menunggu: 0, Diproses: 0, Selesai: 0 };
  let foto = 0;
  for (const c of clients) {
    if (n[c.status] !== undefined) n[c.status]++;
    foto += (c.photos || []).length;
  }
  document.getElementById('st-total').textContent = clients.length;
  document.getElementById('st-menunggu').textContent = n.Menunggu;
  document.getElementById('st-diproses').textContent = n.Diproses;
  document.getElementById('st-foto').textContent = foto;

  const head = document.getElementById('admin-headline');
  if (clients.length === 0) head.textContent = 'Belum ada client.';
  else if (n.Menunggu > 0) head.textContent = 'Menunggu ' + n.Menunggu + ' client diproses.';
  else if (n.Diproses > 0) head.textContent = 'Menunggu ' + n.Diproses + ' client dikerjakan.';
  else head.textContent = 'Semua client selesai.';
}

function renderClientList() {
  const container = document.getElementById('client-list');
  renderStats();

  if (clients.length === 0) {
    container.innerHTML = '<p class="empty-msg">Belum ada client. Tambahkan client baru di atas.</p>';
    return;
  }

  const data = clientFilter === 'Semua'
    ? clients
    : clients.filter(c => c.status === clientFilter);

  if (data.length === 0) {
    container.innerHTML =
      `<p class="empty-msg">Tidak ada client berstatus ${esc(clientFilter)}.</p>`;
    return;
  }

  container.innerHTML = data.map(c => {
    const statusClass = 'status-' + String(c.status || '').toLowerCase();
    const files = c.selected_files || [];
    const photoCount = (c.photos || []).length;
    const pwTxt = c.password || '\u2014';

    return `
    <div class="cli" onclick="openClientDetail('${esc(c.id)}')">
      <div class="cli-main">
        <div class="cn">${esc(c.name)}</div>
        <div class="cm">
          <span class="st ${statusClass}">${esc(c.status)}</span>
          <span class="pw" data-cid="${esc(c.id)}" title="Klik untuk copy"
                onclick="event.stopPropagation();copyPassword('${esc(c.id)}', this)">${esc(pwTxt)}</span>
          ${c.pw_ok === false ? '<span class="pw-warn" title="Password tidak cocok dengan hash - Reset password">!</span>' : ''}
          <i class="cm-dot"></i><span>${photoCount} foto</span>
          <i class="cm-dot"></i><span>${(c.max_select || 0) > 0 ? 'maks ' + c.max_select : 'tanpa batas'}</span>
          ${c.submitted && files.length > 0
            ? '<i class="cm-dot"></i><span class="sent"><i></i>' + files.length + ' dipilih</span>' : ''}
        </div>
      </div>
      <div class="go" aria-hidden="true">&rsaquo;</div>
    </div>`;
  }).join('');
}

function setFilter(el, f) {
  clientFilter = f;
  document.querySelectorAll('.filters .chip').forEach(c => c.classList.remove('on'));
  if (el) el.classList.add('on');
  renderClientList();
}

function togglePwForm() {
  document.getElementById('pwband').classList.toggle('hidden');
}

function openClientDetail(id) {
  const c = clients.find(x => String(x.id) === String(id));
  if (!c) return;
  CD_ID = c.id;

  const files = c.selected_files || [];
  const photoCount = (c.photos || []).length;
  const statusClass = 'status-' + String(c.status || '').toLowerCase();

  document.getElementById('cd-name').textContent = c.name;
  document.getElementById('cd-meta').innerHTML =
    `<span class="st ${statusClass}">${esc(c.status)}</span>` +
    `<span>Folder ${esc(c.folder)}</span>`;

  document.getElementById('cd-kv').innerHTML =
    `<dt>Password</dt><dd><span class="pw" data-cid="${esc(c.id)}" style="cursor:pointer"
        onclick="copyPassword('${esc(c.id)}', this)">${esc(c.password || '\u2014')}</span></dd>` +
    `<dt>Foto diposting</dt><dd>${photoCount} foto</dd>` +
    `<dt>Status client</dt><dd>${c.submitted ? 'Sudah mengirim pilihan' : 'Belum mengirim'}</dd>`;

  const hasNote = !!(c.note && c.note.trim());
  document.getElementById('cd-note-blk').classList.toggle('hidden', !hasNote);
  if (hasNote) document.getElementById('cd-note').textContent = c.note;

  // pratinjau foto terpilih
  document.getElementById('cd-sel-blk').classList.toggle('hidden', files.length === 0);
  const th = document.getElementById('cd-thumbs');
  if (files.length > 0) {
    let html = '';
    for (let i = 0; i < Math.min(files.length, 6); i++) {
      const f = files[i];
      const src = (typeof f === 'object' && f.thumb) || '';
      html += src
        ? `<img src="${esc(src)}" alt="" loading="lazy">`
        : '<div class="thumb-ph">&#128247;</div>';
    }
    if (files.length > 6) html += '<div class="thumb-ph">+' + (files.length - 6) + '</div>';
    th.innerHTML = html;
  } else {
    th.innerHTML = '';
  }

  // status picker
  document.getElementById('cd-status').innerHTML = ['Menunggu', 'Diproses', 'Selesai']
    .map(s => `<button class="status-btn s-${s.toLowerCase()}"
        onclick="changeStatus(CD_ID,'${s}')">${s}</button>`).join('');

  document.getElementById('cd-photo-count').textContent =
    photoCount > 0 ? photoCount + ' foto terposting ke client ini.' : 'Belum ada foto diposting.';
  document.getElementById('cd-max').value = c.max_select || 0;

  // batas waktu (kalau diisi, tampil hitung mundur)
  const dlEl = document.getElementById('cd-deadline');
  const dlHint = document.getElementById('cd-deadline-hint');
  if (c.deadline) {
    const d = new Date(c.deadline);
    dlEl.value = isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    dlHint.textContent = 'Client harus selesai sebelum ' +
      d.toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } else {
    dlEl.value = '';
    dlHint.textContent = 'Belum ada batas waktu untuk client ini.';
  }

  // tombol folder Drive hanya relevan kalau client sudah kirim & sudah ada salinan
  const punyaSalinan = c.submitted && files.length > 0;
  document.getElementById('cd-copy-btn').style.display = punyaSalinan ? '' : 'none';
  const link = document.getElementById('cd-folder-link');
  const delF = document.getElementById('cd-del-folder');
  if (c.selected_folder) {
    link.href = c.selected_folder;
    link.style.display = '';
    delF.style.display = '';
  } else {
    link.style.display = 'none';
    delF.style.display = 'none';
  }

  document.getElementById('client-detail').classList.add('on');
  document.body.style.overflow = 'hidden';
}

function closeClientDetail() {
  document.getElementById('client-detail').classList.remove('on');
  document.body.style.overflow = '';
  CD_ID = null;
}

// =====================
// ADMIN: HAPUS SEMUA DATA
// =====================
async function clearAllData() {
  if (!confirm('Hapus SEMUA data client?\n\nThumbnail semua client juga akan dihapus dari Supabase.\nTindakan ini tidak bisa dibatalkan!')) return;

  let thumbs = 0;
  try {
    const r = await api('admin_delete_all');
    thumbs = r.thumbs || 0;
  } catch (e) {
    alert('Gagal hapus data!\n\n' + e.message);
    return;
  }

  clients = [];
  renderClientList();
  showModal('🗑️', thumbs > 0
    ? `Semua data client berhasil dihapus.\nThumbnail dibersihkan: ${thumbs} file.`
    : 'Semua data client berhasil dihapus.');
}

// Copy password client. Verifikasi dulu ke server supaya yang tersalin
// benar-benar password yang berlaku.
function copyPassword(id, el) {
  const client = clients.find(c => String(c.id) === String(id));
  if (!client) return;
  const pw = client.password || '';
  if (!pw) { showToast('Password belum tersedia, reset dulu', true); return; }

  const plain = () => {
    if (navigator.clipboard) return navigator.clipboard.writeText(pw);
    showToast('Password: ' + pw + ' (salin manual)');
    return Promise.resolve();
  };

  api('admin_verify_password', { password: pw })
    .then(r => {
      if (r.result !== 'client') {
        showToast('Password tidak cocok dengan database, reset dulu', true);
        return;
      }
      plain().then(() => {
        showToast('Password disalin untuk ' + (r.name || client.name));
        flashPw(el);
      });
    })
    .catch(plain);
}

// klik password menyalin; klik lagi menyembunyikan (aman saat share layar)
function flashPw(el) {
  if (!el) return;
  el.classList.add('ok');
  setTimeout(() => el.classList.remove('ok'), 900);
}

function togglePassword(id) {
  const box = document.querySelector(`.pw[data-cid="${id}"]`);
  if (box) box.classList.toggle('masked');
}

// =====================
// TAMPILKAN GALLERY
// =====================
function showGallery(client) {
  setView('gallery');
  document.getElementById('section-gallery').classList.remove('hidden');
  document.getElementById('gallery-client-name').textContent = client.name;

  const statusEl = document.getElementById('gallery-status');
  statusEl.textContent = client.status;

  // Pool foto = yang diposting admin
  const photos = client.photos || [];
  currentPhotos = photos.map(p => ({ ...p }));

  // Pilihan tersimpan client (hanya yang masih ada di pool)
  const saved = client.selected_files || [];
  const savedIds = saved.map(f => (typeof f === 'string' ? f : f.id));
  selectedFiles = savedIds.filter(id => currentPhotos.some(p => p.id === id));

  document.getElementById('client-note').value = client.note || '';

  const max = (client.max_select) || 0;
  const hint = document.getElementById('gallery-hint');
  if (hint) {
    hint.innerHTML = max > 0
      ? 'Ketuk lingkaran di sudut foto untuk menandainya \u2014 batas <strong>' + max + ' foto</strong>.'
      : 'Ketuk lingkaran di sudut foto untuk menandainya.';
  }

  renderFileGrid();
  updateSelectCount();
  setupDeadlineClock();
}

// =====================
// HITUNG MUNDUR BATAS WAKTU (client)
// =====================
let dlTimer = null;

function setupDeadlineClock() {
  clearInterval(dlTimer);
  const box = document.getElementById('client-deadline');
  const out = document.getElementById('dl-clock');
  if (!box || !out) return;

  const dl = currentClient && currentClient.deadline ? new Date(currentClient.deadline) : null;
  if (!dl || isNaN(dl.getTime())) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');

  const tick = () => {
    const ms = dl.getTime() - Date.now();
    if (ms <= 0) {
      out.textContent = 'Ditutup';
      box.classList.add('pasti');
      return;
    }
    const d = Math.floor(ms / 864e5);
    const h = Math.floor(ms % 864e5 / 36e5);
    const m = Math.floor(ms % 36e5 / 6e4);
    out.textContent = d + 'h ' + String(h).padStart(2, '0') + 'j ' + String(m).padStart(2, '0') + 'm';
    box.classList.toggle('pasti', d < 2);
  };
  tick();
  dlTimer = setInterval(tick, 30000);
}

// =====================
// RENDER FILE GRID + CHECKBOX (dimuat bertahap, ringan di HP)
// =====================
function fileCardHtml(p) {
  const isSelected = selectedFiles.includes(p.id);
  const fallback = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(p.id) + '&sz=w400';
  const safeName = esc(p.name);
  const thumbHtml = p.thumb || p.id
    ? `<img src="${esc(p.thumb || fallback)}" alt="${safeName}" loading="lazy" decoding="async"
               onerror="this.onerror=null;this.src='${fallback}'">`
    : '';
  // dua target terpisah: lingkaran = pilih/lepas, area foto = perbesar
  return `
    <div class="file-card ${isSelected ? 'selected' : ''}" data-id="${esc(p.id)}"
         onclick="zoomPhoto('${esc(p.id)}')" title="Perbesar">
      <div class="check-mark" title="Pilih / lepas foto ini"
           onclick="event.stopPropagation(); toggleSelect('${esc(p.id)}')"></div>
      <div class="file-thumb">${thumbHtml}</div>
      <div class="file-info"><div class="fname">${safeName}</div></div>
    </div>`;
}

function renderFileGrid() {
  const grid = document.getElementById('file-grid');
  renderedCount = 0;
  if (loadObserver) { loadObserver.disconnect(); loadObserver = null; }

  if (currentPhotos.length === 0) {
    grid.innerHTML = `
      <div class="empty-grid">
        <span class="empty-icon">📷</span>
        <p>Belum ada foto di galeri ini.<br>Admin belum memposting foto untuk project Anda.</p>
      </div>`;
    updateLoadMoreUI();
    return;
  }

  grid.innerHTML = '';
  appendNextBatch();
}

// Tambah 1 batch foto di bawah grid (dipakai juga oleh tombol & auto-scroll)
function appendNextBatch() {
  const grid = document.getElementById('file-grid');
  if (renderedCount >= currentPhotos.length) { updateLoadMoreUI(); return; }

  const slice = currentPhotos.slice(renderedCount, renderedCount + RENDER_BATCH);
  grid.insertAdjacentHTML('beforeend', slice.map(fileCardHtml).join(''));
  renderedCount += slice.length;

  updateLoadMoreUI();
  setupLoadObserver();
}

function updateLoadMoreUI() {
  const wrap = document.getElementById('load-more-wrap');
  const counter = document.getElementById('photo-counter');
  const btn = document.getElementById('load-more-btn');
  if (!wrap || !counter || !btn) return;

  const total = currentPhotos.length;
  if (total === 0 || renderedCount === 0) {
    wrap.classList.add('hidden');
    return;
  }

  if (renderedCount < total) {
    wrap.classList.remove('hidden');
    btn.classList.remove('hidden');
    counter.textContent = `Menampilkan ${renderedCount} dari ${total} foto`;
    btn.textContent = `Muat ${Math.min(RENDER_BATCH, total - renderedCount)} foto lagi`;
  } else {
    wrap.classList.remove('hidden');
    btn.classList.add('hidden');
    counter.textContent = `Semua ${total} foto sudah dimuat`;
  }
}

// Muat foto berikutnya otomatis saat user mendekati bawah
function setupLoadObserver() {
  if (loadObserver) loadObserver.disconnect();
  const sentinel = document.getElementById('load-more-wrap');
  if (!sentinel || renderedCount >= currentPhotos.length) return;
  if (!('IntersectionObserver' in window)) return;

  loadObserver = new IntersectionObserver((entries) => {
    if (entries[0] && entries[0].isIntersecting && renderedCount < currentPhotos.length) {
      appendNextBatch();
    }
  }, { rootMargin: '700px 0px' });
  loadObserver.observe(sentinel);
}

// =====================
// ZOOM FOTO (pratinjau layar penuh)
// =====================
let zoomId = null;   // foto yang sedang dibuka di lightbox

function zoomPhoto(fileId) {
  const p = currentPhotos.find(x => x.id === fileId);
  if (!p) return;
  zoomId = fileId;

  const img = document.getElementById('zoom-img');
  const loading = document.getElementById('zoom-loading');
  const fallback = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(p.id) + '&sz=w1024';

  // Tampilkan versi besar kalau ada, kalau belum pakai pratinjau
  if (p.zoom) {
    if (loading) loading.classList.remove('hidden');
    img.onload = () => { if (loading) loading.classList.add('hidden'); };
    img.onerror = () => {
      if (loading) loading.classList.add('hidden');
      img.onerror = null;
      img.src = p.thumb || fallback;
    };
    img.src = p.zoom;
  } else {
    if (loading) loading.classList.add('hidden');
    img.src = p.thumb || fallback;
  }

  document.getElementById('zoom-name').textContent = p.name;
  document.getElementById('zoom-overlay').classList.remove('hidden');
  zoomSyncPick();
}

// geser ke foto sebelum / sesudah (dalam urutan pool yang tampil)
function zoomStep(dir) {
  if (!zoomId) return;
  const i = currentPhotos.findIndex(p => p.id === zoomId);
  if (i < 0) return;
  const next = currentPhotos[(i + dir + currentPhotos.length) % currentPhotos.length];
  zoomPhoto(next.id);
}

// tombol "Pilih" di lightbox mengikuti status kartu yang sama
function zoomSyncPick() {
  const btn = document.getElementById('zoom-pick');
  if (!btn) return;
  const on = !!zoomId && selectedFiles.includes(zoomId);
  const max = selectMax();
  const penuh = max > 0 && !on && selectedFiles.length >= max;
  btn.classList.toggle('on', on);
  btn.textContent = on ? 'Lepas' : 'Pilih';
  btn.disabled = penuh;
  btn.title = penuh ? `Batas ${max} foto sudah tercapai` : '';
}

function zoomPick() {
  if (!zoomId) return;
  toggleSelect(zoomId);
}

function closeZoom() {
  const overlay = document.getElementById('zoom-overlay');
  const img = document.getElementById('zoom-img');
  const loading = document.getElementById('zoom-loading');
  overlay.classList.add('hidden');
  img.onload = null;
  img.onerror = null;
  img.src = '';
  if (loading) loading.classList.add('hidden');
  zoomId = null;
}

document.addEventListener('keydown', function (e) {
  const panel = document.getElementById('client-detail');
  if (panel && panel.classList.contains('on')) {
    if (e.key === 'Escape') closeClientDetail();
    return;
  }

  const overlay = document.getElementById('zoom-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeZoom();
  else if (e.key === 'ArrowLeft') zoomStep(-1);
  else if (e.key === 'ArrowRight') zoomStep(1);
});

document.getElementById('client-detail').addEventListener('click', function (e) {
  if (e.target === this) closeClientDetail();
});

// =====================
// TOGGLE PILIH FOTO
// =====================
function toggleSelect(fileId) {
  const idx = selectedFiles.indexOf(fileId);
  if (idx >= 0) {
    selectedFiles.splice(idx, 1);
  } else {
    const max = selectMax();
    if (max > 0 && selectedFiles.length >= max) {
      showToast(`Batas ${max} foto sudah tercapai`, true);
      shakeSubmit();
      return;
    }
    selectedFiles.push(fileId);
    if (max > 0 && selectedFiles.length === max) showToast(`Batas ${max} foto tercapai`);
  }

  // Update kartu saja (tanpa render ulang — cepat untuk ribuan foto)
  const card = document.querySelector(`.file-card[data-id="${fileId}"]`);
  if (card) card.classList.toggle('selected', selectedFiles.includes(fileId));
  updateSelectCount();
  zoomSyncPick();
}

function selectMax() {
  return (currentClient && currentClient.max_select) || 0;
}

function shakeSubmit() {
  const btn = document.getElementById('submit-btn');
  if (!btn) return;
  btn.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
     { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }],
    { duration: 320, easing: 'ease-in-out' }
  );
}

function updateSelectCount() {
  const max = selectMax();
  const label = max > 0
    ? `${selectedFiles.length} / ${max} dipilih`
    : `${selectedFiles.length} dipilih`;
  document.getElementById('select-count').textContent = label;
  const foot = document.getElementById('foot-count');
  if (foot) foot.textContent = label;
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

  const note = document.getElementById('client-note').value.trim();
  const chosen = currentPhotos.filter(p => selectedFiles.includes(p.id));

  let result;
  try {
    result = await api('client_submit', {
      selected_files: chosen.map(p => ({ id: p.id })),
      note: note
    });
  } catch (e) {
    showModal('❌', 'Gagal menyimpan pilihan:\n\n' + e.message);
    return;
  }

  currentClient = result.client;
  const idx = clients.findIndex(c => c.id === currentClient.id);
  if (idx >= 0) clients[idx] = currentClient;

  showModal('✅',
    `Pilihan berhasil dikirim!\n\n` +
    `${result.total} foto terpilih\n` +
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
  api('client_logout').catch(() => {});
  clearClientSession();
  document.getElementById('client-password').value = '';
  document.getElementById('client-password').classList.remove('bad');
  document.getElementById('login-error').classList.add('hidden');
  clearInterval(dlTimer);
  setView('login');
  switchSection('section-login');
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
// INIT: lanjutkan sesi sebelumnya (kalau masih valid)
// =====================
document.addEventListener('DOMContentLoaded', async function() {
  const loginEl = document.getElementById('section-login');

  if (adminToken) {
    try {
      await api('admin_session');
      clients = (await api('admin_list')).clients || [];
      loginEl.classList.add('hidden');
      openAdmin();
      return;
    } catch (e) {
      clearAdminSession();
    }
  }

  if (clientToken) {
    try {
      const r = await api('client_session');
      currentClient = r.client;
      loginEl.classList.add('hidden');
      setView('gallery');
      showGallery(currentClient);
      return;
    } catch (e) {
      clearClientSession();
    }
  }
});

let toastTimer = null;
function showToast(message, isBad) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.className = 'toast-box on' + (isBad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast-box'; }, 2400);
}
