// ============================================================
// MODE DEMO - data contoh tanpa server
//
// Aktif dengan membuka:  index.html?demo=1
// Semua data hanya disimpan di browser. Tidak ada yang masuk
// database sungguhan, tidak ada foto yang diunggah ke Google Drive.
//
// Password demo:
//   admin  : demoadmin
//   klien  : Fauzi8Riz / Ahmad24Snt / Bagus17Lrs / Dimas30Ayu
// ============================================================
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('demo') !== '1') return;

  const P = window.DEMO_PHOTOS || [];
  const DAY = 86400000;
  const now = Date.now();
  const iso = (offsetDays) => new Date(now + offsetDays * DAY).toISOString();

  // --- data contoh -------------------------------------------
  function pick(n) { return P.slice(0, n).map((p) => ({ ...p })); }
  function pickFrom(start, n) {
    return P.slice(start, start + n).map((p) => ({ ...p }));
  }

  // nama lain supaya tidak menutupi variabel global aplikasi
  // (demoClients, currentClient, CD_ID milik script.js)
  const demoClients = [
    {
      id: 101,
      name: 'Fauziyah & Rizal',
      folder: 'Project_Fauziyah_Rizal',
      status: 'Diproses',
      password: 'Fauzi8Riz',
      max_select: 0,
      deadline: iso(6),
      submitted: true,
      note: 'Tolong yang natural, jangan terlalu terang. '
          + 'Untuk foto bersama tolong di-backup yang lepas semua ya. '
          + 'Cincin mohon close-up, emasnya jangan shimmering.',
      photos: pick(14),
      selected_files: [0, 1, 2, 3, 4, 5].map((i) => ({ ...P[i] })),
      selected_folder: 'https://drive.google.com/drive/folders/DEMOcontoh'
    },
    {
      id: 102,
      name: 'Ahmad & Sinta',
      folder: 'Project_Ahmad_Sinta',
      status: 'Menunggu',
      password: 'Ahmad24Snt',
      max_select: 8,
      deadline: iso(3),
      submitted: true,
      note: 'Boleh pilih yang paling bagus ya, biar saya yang putuskan. '
          + 'Kuenya jangan yang Cheese.',
      photos: pick(14),
      selected_files: [1, 3, 5, 7].map((i) => ({ ...P[i] })),
      selected_folder: null
    },
    {
      id: 103,
      name: 'Bagus & Laras',
      folder: 'Project_Bagus_Laras',
      status: 'Menunggu',
      password: 'Bagus17Lrs',
      max_select: 10,
      deadline: null,
      submitted: false,
      note: '',
      photos: pickFrom(2, 12),
      selected_files: [],
      selected_folder: null
    },
    {
      id: 104,
      name: 'Dimas & Ayu',
      folder: 'Project_Dimas_Ayu',
      status: 'Selesai',
      password: 'Dimas30Ayu',
      max_select: 0,
      deadline: null,
      submitted: true,
      note: 'Sudah pas semua, terima kasih banyak!',
      photos: pick(14),
      selected_files: [2, 6, 8, 9, 11].map((i) => ({ ...P[i] })),
      selected_folder: 'https://drive.google.com/drive/folders/DEMOselesai'
    }
  ];

  const ADMIN_PASSWORD = 'demoadmin';
  const statuses = ['Menunggu', 'Diproses', 'Selesai'];

  function publicClient(c) {
    return {
      id: c.id, name: c.name, folder: c.folder, status: c.status,
      note: c.note || '', photos: c.photos || [], selected_files: c.selected_files || [],
      submitted: !!c.submitted, max_select: c.max_select || 0, deadline: c.deadline || null
    };
  }
  function adminClient(c) {
    const o = publicClient(c);
    o.password = c.password;
    o.pw_ok = true;
    o.selected_folder = c.selected_folder || null;
    return o;
  }

  function err(msg) { const e = new Error(msg); e.demoHttp = true; throw e; }
  const find = (id) => demoClients.find((c) => String(c.id) === String(id));

  // --- ganti fungsi api() ------------------------------------
  const realApi = window.api;
  window.api = async function (action, payload) {
    payload = payload || {};
    let c = null;

    switch (action) {
      case 'admin_login':
        if (payload.password !== ADMIN_PASSWORD) err('Password salah');
        return { ok: true, token: 'demo-admin-token', expires_at: iso(0.5) };

      case 'admin_session':
        return { ok: true, expires_at: iso(0.5) };

      case 'admin_logout':
        return { ok: true };

      case 'admin_list':
        return { ok: true, clients: demoClients.map(adminClient) };

      case 'admin_add_client': {
        const name = String(payload.name || '').trim();
        if (!name) err('Nama client wajib diisi');
        if (demoClients.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
          err('Nama client sudah ada');
        }
        const made = {
          id: 200 + demoClients.length, name, folder: 'Project_' + name.replace(/\s+/g, '_'),
          status: 'Menunggu', password: 'Demo' + Math.floor(Math.random() * 9000 + 1000),
          max_select: 0, deadline: null, submitted: false, note: '',
          photos: [], selected_files: [], selected_folder: null
        };
        demoClients.push(made);
        return { ok: true, client: adminClient(made) };
      }

      case 'admin_update_status':
        c = find(payload.id);
        if (!c) err('id client tidak valid');
        if (!statuses.includes(payload.status)) err('Status tidak valid');
        c.status = payload.status;
        return { ok: true };

      case 'admin_set_max':
        c = find(payload.id);
        if (!c) err('id client tidak valid');
        c.max_select = Math.max(0, parseInt(payload.max, 10) || 0);
        return { ok: true, max_select: c.max_select };

      case 'admin_set_deadline':
        c = find(payload.id);
        if (!c) err('id client tidak valid');
        c.deadline = payload.deadline ? new Date(payload.deadline).toISOString() : null;
        return { ok: true, deadline: c.deadline };

      case 'admin_reset_password':
        c = find(payload.id);
        if (!c) err('id client tidak valid');
        c.password = 'Demo' + Math.floor(Math.random() * 9000 + 1000);
        return { ok: true, password: c.password };

      case 'admin_change_password':
        if (payload.currentPassword !== ADMIN_PASSWORD) err('Password saat ini salah');
        return { ok: true, verified: true };

      case 'admin_clear_photos':
        c = find(payload.id);
        if (!c) err('id client tidak valid');
        c.photos = [];
        return { ok: true, thumbs: 0 };

      case 'admin_delete_client': {
        c = find(payload.id);
        if (!c) err('id client tidak valid');
        demoClients.splice(demoClients.indexOf(c), 1);
        return { ok: true, thumbs: 0 };
      }

      case 'admin_delete_all':
        demoClients.length = 0;
        return { ok: true, thumbs: 0 };

      case 'admin_save_photos':
        // di mode demo tidak bisa menarik dari Drive
        err('Mode demo: foto contoh sudah tersedia, tidak bisa ambil dari Drive.');

        // eslint-disable-next-line no-fallthrough
      case 'admin_set_folder':
      case 'admin_verify_password':
      case 'admin_verify':
        return { ok: true, result: 'none' };

      case 'client_login': {
        c = demoClients.find((x) => x.password === String(payload.password || '').trim());
        if (!c) err('Password salah');
        return { ok: true, token: 'demo-token-' + c.id, client: publicClient(c) };
      }

      case 'client_session':
        return { ok: true, client: publicClient(demoClients[0]) };

      case 'client_logout':
        return { ok: true };

      case 'client_submit': {
        c = find(activeClientId);
        if (!c) err('Sesi habis, login ulang');
        const pool = c.photos || [];
        const wanted = Array.isArray(payload.selected_files) ? payload.selected_files : [];
        const chosen = pool.filter((p) => wanted.some((w) => String(w && w.id) === p.id));
        const max = c.max_select || 0;
        if (max > 0 && chosen.length > max) err('Batas maksimal ' + max + ' foto');
        if (c.deadline && new Date(c.deadline).getTime() < Date.now()) {
          err('Batas waktu memilih foto sudah lewat');
        }
        c.selected_files = chosen.map((p) => ({ id: p.id, name: p.name, thumb: p.thumb, zoom: p.zoom }));
        c.note = String(payload.note || '').slice(0, 2000).trim();
        c.submitted = true;
        return { ok: true, total: chosen.length, client: publicClient(c) };
      }

      default:
        // aksi lain: teruskan ke server sungguhan
        return realApi.call(window, action, payload);
    }
  };

  // client_submit perlu tahu client mana yang sedang login.
  // Catatan: variabel let di script.js (currentClient, clients, CD_ID)
  // TIDAK menempel ke window, jadi harus dipanggil dengan nama biasa.
  let activeClientId = null;
  const realShowGallery = window.showGallery;
  window.showGallery = function (client) {
    if (client && client.id) activeClientId = client.id;
    return realShowGallery.call(window, client);
  };

  // aksi Google Drive tidak tersedia di mode demo
  window.openDrivePicker = function () {
    showModal('📷', 'Mode demo: foto contoh sudah tersedia.\n'
      + 'Untuk memakai foto sungguhan, buka situs tanpa ?demo=1.');
  };
  window.copySelectedToDrive = function () {
    const c = demoClients.find((x) => String(x.id) === String(CD_ID));
    if (!c) return;
    if (!c.submitted || !(c.selected_files || []).length) {
      showModal('ℹ️', 'Client ini belum mengirim pilihan foto.');
      return;
    }
    const folder = c.folder + '_Selected';
    c.selected_folder = 'https://drive.google.com/drive/folders/DEMOcontoh';
    renderClientList();
    showModal('✅',
      'Mode demo: folder "' + folder + '" tidak benar-benar dibuat.\n\n'
      + 'Disalin (contoh): ' + c.selected_files.length + ' foto\n\n'
      + 'Di situs sungguhan, folder ini dibuat di Google Drive Anda.');
  };
  window.deleteSelectedFolder = function (id) {
    const c = demoClients.find((x) => String(x.id) === String(id));
    if (c) { c.selected_folder = null; renderClientList(); }
    showModal('🗑️', 'Mode demo: tidak ada folder sungguhan yang dihapus.');
  };
  window.changeGoogleAccount = function () {
    showModal('ℹ️', 'Mode demo: sambungan Google Drive tidak dipakai.');
  };
  // baris "Google Drive" di panel Pengaturan harus ikut beri tahu mode demo
  window.updateGoogleAuthStatus = function () {
    const st = document.getElementById('gauth-status');
    if (st) st.textContent = 'Mode demo - tidak terhubung';
    const dot = document.querySelector('.adm-top .live');
    if (dot) dot.innerHTML = '<i></i>Mode demo';
  };

  // --- penanda mode demo ------------------------------------
  window.DEMO_MODE = true;
  document.addEventListener('DOMContentLoaded', function () {
    document.documentElement.classList.add('demo-mode');
    const hint = document.querySelector('.login-hint');
    if (hint) {
      hint.innerHTML = 'Mode demo &middot; admin: <b>demoadmin</b> &middot; klien: <b>Fauzi8Riz</b>';
      hint.classList.add('demo-hint');
    }
    const st = document.getElementById('gauth-status');
    if (st) st.textContent = 'Mode demo - tidak terhubung';
  });

  window.DEMO_CLIENT_PASSWORDS = demoClients.map((c) => ({ name: c.name, password: c.password }));
})();