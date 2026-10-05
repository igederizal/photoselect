// =====================
// STATE
// =====================
let clients = [];
let currentClient = null;
let adminPassword = 'admin123';
let selectedFiles = [];   // berisi ID foto yang dicentang
let currentPhotos = [];   // pool foto di grid: {id, name, thumb}

// =====================
// GOOGLE DRIVE / PICKER
// =====================
const GOOGLE_CLIENT_ID = '382982310484-l959cia5bpim0gj61tecij34q4k1sc5q.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyAJRLdv3VKWh3EP1WiZxYUqE9rDYSaAAik';

function openDrivePicker() {
  if (!GOOGLE_API_KEY) {
    showModal('⚠️', 'API key Google belum diisi di script.js');
    return;
  }
  if (!window.google || !google.accounts || !google.accounts.oauth2) {
    showModal('⚠️', 'Google API belum termuat. Muat ulang halaman lalu coba lagi.');
    return;
  }

  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    callback: (resp) => {
      if (resp.error) {
        showModal('❌', 'Gagal login Google: ' + resp.error);
        return;
      }
      showPicker(resp.access_token);
    }
  });
  tokenClient.requestAccessToken();
}

function showPicker(token) {
  gapi.load('picker', { callback: () => buildPicker(token) });
}

function buildPicker(token) {
  const docsView = new google.picker.DocsView()
    .setMimeTypes('image/jpeg,image/png,image/webp,image/gif,image/heic');

  const picker = new google.picker.PickerBuilder()
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .setTitle('Pilih Foto dari Drive Anda')
    .setOAuthToken(token)
    .setDeveloperKey(GOOGLE_API_KEY)
    .addView(docsView)
    .setCallback(onPickerCallback)
    .build();
  picker.setVisible(true);
}

function onPickerCallback(data) {
  if (data.action !== google.picker.Action.PICKED) return;

  const docs = data[google.picker.Response.DOCUMENTS] || [];
  let added = 0;

  docs.forEach(d => {
    if (d.mimeType && !d.mimeType.startsWith('image/')) return;
    if (currentPhotos.some(p => p.id === d.id)) return;

    const thumbs = d.thumbnails || [];
    const thumb = thumbs.length ? thumbs[thumbs.length - 1].url : '';
    currentPhotos.push({ id: d.id, name: d.name, thumb: thumb });
    if (!selectedFiles.includes(d.id)) selectedFiles.push(d.id);
    added++;
  });

  if (added === 0) {
    showModal('ℹ️', 'Tidak ada foto baru yang dipilih.');
  }
  renderFileGrid();
  updateSelectCount();
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
// ADMIN: RENDER LIST
// =====================
function renderClientList() {
  const container = document.getElementById('client-list');

  if (clients.length === 0) {
    container.innerHTML = '<p class="empty-msg">Belum ada client. Tambahkan client baru di atas.</p>';
    return;
  }

  container.innerHTML = clients.map(client => {
    const statusClass = 'status-' + client.status.toLowerCase();
    const files = client.selected_files || [];
    const fileNames = files.map(f => (typeof f === 'string' ? f : f.name));
    const selectedInfo = client.submitted && files.length > 0
      ? `<div class="selected-info">✅ ${files.length} foto dipilih: ${fileNames.join(', ')}</div>`
      : '';
    const noteInfo = client.note
      ? `<div class="note-box">📝 ${client.note}</div>`
      : '<div class="note-box"><span class="no-note">Belum ada catatan</span></div>';

    return `
    <div class="client-row client-card">
      <div class="client-top">
        <div class="client-num">${client.id}</div>
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

      ${selectedInfo}
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

  // Bangun pool foto dari pilihan tersimpan di Supabase
  const saved = client.selected_files || [];
  currentPhotos = saved.map(f => (typeof f === 'string'
    ? { id: f, name: f, thumb: '' }
    : f));
  selectedFiles = currentPhotos.map(p => p.id);

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
        <p>Belum ada foto. Klik tombol di bawah untuk memilih foto dari Google Drive Anda.</p>
        <button onclick="openDrivePicker()" class="drive-btn">📷 Pilih dari Google Drive</button>
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
    <div class="file-card ${isSelected ? 'selected' : ''}" onclick="toggleSelect('${p.id}')">
      <div class="check-mark">✓</div>
      <div class="file-thumb">${thumbHtml}</div>
      <div class="file-info">
        <div class="fname">${p.name}</div>
      </div>
    </div>
  `;
  }).join('');
}

// =====================
// TOGGLE PILIH FOTO
// =====================
function toggleSelect(fileId) {
  const idx = selectedFiles.indexOf(fileId);
  if (idx >= 0) {
    selectedFiles.splice(idx, 1);
  } else {
    selectedFiles.push(fileId);
  }
  renderFileGrid();
  updateSelectCount();
}

function toggleSelectAll() {
  const allIds = currentPhotos.map(p => p.id);

  if (allIds.length > 0 && selectedFiles.length === allIds.length) {
    selectedFiles = [];
  } else {
    selectedFiles = [...allIds];
  }
  renderFileGrid();
  updateSelectCount();
}

function updateSelectCount() {
  document.getElementById('select-count').textContent = `${selectedFiles.length} foto dipilih`;
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

function downloadAll() {
  if (!currentClient) return;
  showModal('📥', `Download semua file dari folder "${currentClient.folder}"\n\n*(Demo)*`);
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
