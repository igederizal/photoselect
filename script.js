// =====================
// STATE
// =====================
let clients = [];
let currentClient = null;
let selectedFiles = [];   // berisi ID foto yang dicentang
let currentPhotos = [];   // pool foto di grid: {id, name, thumb}
let pickerTargetId = null; // client yang sedang dipilihkan foto oleh admin
let pickerToken = '';       // token untuk akses Drive API (baca isi folder)
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
    errorEl.textContent = '❌ Masukkan password dulu!';
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');
  document.getElementById('client-password').value = '';

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
    document.getElementById('section-login').classList.add('hidden');
    showGallery(currentClient);
    return;
  } catch (e) {
    errorEl.textContent = '❌ Password salah! Coba lagi.';
    errorEl.classList.remove('hidden');
  }
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
  api('admin_logout').catch(() => {});
  clearAdminSession();
  document.getElementById('section-admin').classList.add('hidden');
  document.getElementById('section-login').classList.remove('hidden');
  document.getElementById('client-password').value = '';
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

  if (!name) { alert('Masukkan nama client dulu!'); return; }

  let created;
  try {
    const r = await api('admin_add_client', { name: name });
    created = r.client;
  } catch (e) {
    alert('Gagal simpan ke database!\n\n' + e.message);
    return;
  }

  clients.push(created);
  renderClientList();
  nameInput.value = '';

  showModal('✅',
    `Client "${name}" berhasil ditambahkan!\n\n` +
    `Password: ${created.password}\n` +
    `Folder: ${created.folder}\n\n` +
    `Kirim password ini ke client Anda.`
  );
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
  showModal('🔑', `Password baru untuk "${client.name}":\n\n${password}\n\nKirim password ini ke client.`);
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
    // Jangan tampilkan ribuan nama file (bikin panel admin berat)
    const shownNames = fileNames.slice(0, 8).map(esc).join(', ');
    const moreNames = fileNames.length > 8 ? ` … +${fileNames.length - 8} lainnya` : '';
    const photoCount = (client.photos || []).length;
    const selectedInfo = client.submitted && files.length > 0
      ? `<div class="selected-info">✅ ${files.length} foto dipilih: ${shownNames}${moreNames}</div>`
      : '';
    const noteInfo = client.note
      ? `<div class="note-box">📝 ${esc(client.note)}</div>`
      : '<div class="note-box"><span class="no-note">Belum ada catatan</span></div>';

    return `
    <div class="client-row client-card">
      <div class="client-top">
        <div class="client-num">${idx + 1}</div>
        <div class="client-info">
          <span class="name">${esc(client.name)}</span>
          <span class="folder">📁 ${esc(client.folder)}</span>
        </div>
        <div class="pw-wrap">
          <div class="pw-box" data-cid="${client.id}" onclick="copyPassword(${client.id})" title="Klik untuk copy (otomatis diverifikasi)">
            ${esc(client.password || '—')}
          </div>
          <button class="pw-eye" onclick="togglePassword(${client.id})" title="Lihat / sembunyikan password">👁</button>
          ${client.pw_ok === false ? '<span class="pw-warn" title="Password tidak cocok dengan hash - Reset password">⚠</span>' : ''}
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
        ${client.selected_folder ? `
        <a class="folder-link" href="${client.selected_folder}" target="_blank" rel="noopener">🔗 Buka folder di Drive</a>
        <button class="clear-photo-btn" onclick="deleteSelectedFolder(${client.id})" title="Pindahkan folder salinan ke Trash Google Drive">🗑️ Hapus folder salinan</button>` : ''}
      </div>` : ''}
      ${noteInfo}

      <div class="client-bottom">
        <button class="reset-pw-btn" onclick="resetClientPassword(${client.id})" title="Buat password baru">🔑 Reset password</button>
        <button class="delete-btn" onclick="deleteClient(${client.id})">Hapus</button>
      </div>
    </div>
  `;
  }).join('');
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

function copyPassword(id) {
  const client = clients.find(c => c.id === id);
  if (!client) return;
  const pw = client.password || '';
  if (!pw) { showModal('⚠️', 'Password belum tersedia. Coba 🔑 Reset password.'); return; }

  // Verifikasi dulu ke server: pastikan password yang tampil benar-benar berlaku
  api('admin_verify_password', { password: pw })
    .then(r => {
      if (r.result !== 'client') {
        showModal('⚠️', 'Password yang ditampilkan tidak cocok dengan database.\n\nSebaiknya klik "🔑 Reset password" untuk membuat yang baru.');
        return;
      }
      return navigator.clipboard.writeText(pw).then(() => {
        showModal('📋', `Password "${pw}" berhasil di-copy!\n\n(terverifikasi ✓ untuk ${r.name})`);
      });
    })
    .catch(() => {
      navigator.clipboard.writeText(pw).then(() => {
        showModal('📋', `Password "${pw}" berhasil di-copy!`);
      }).catch(() => {
        showModal('📋', `Password: ${pw}\n(Salin manual ya)`);
      });
    });
}

// Sembunyikan / tampilkan password (cegah ketikan terlihat saat share layar)
function togglePassword(id) {
  const box = document.querySelector(`.pw-box[data-cid="${id}"]`);
  if (box) box.classList.toggle('masked');
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
    const fallback = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(p.id) + '&sz=w400';
    const safeName = esc(p.name);
    const thumbHtml = p.thumb || p.id
      ? `<img src="${esc(p.thumb || fallback)}" alt="${safeName}" loading="lazy"
               onerror="this.onerror=null;this.src='${fallback}'">`
      : '📷';
    return `
    <div class="file-card ${isSelected ? 'selected' : ''}" data-id="${esc(p.id)}" onclick="toggleSelect('${esc(p.id)}')">
      <div class="check-mark">✓</div>
      <button class="zoom-btn" title="Perbesar"
              onclick="event.stopPropagation(); zoomPhoto('${esc(p.id)}')">🔍</button>
      <div class="file-thumb">${thumbHtml}</div>
      <div class="file-info">
        <div class="fname">${safeName}</div>
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
      showGallery(currentClient);
      return;
    } catch (e) {
      clearClientSession();
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
