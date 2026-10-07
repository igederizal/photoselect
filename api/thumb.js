// Kunci database hanya dari env Vercel (tidak ada kunci yang tertanam di kode anymore)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sdrfwrepoufuuxxvawsh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const BATCH_MAX = 40;
const CONCURRENCY = 6;
const SIZE_GALERI = 1024;  // untuk grid di layar
const SIZE_ZOOM = 1600;    // untuk perbesar (dimuat saat diklik) - hemat ~54% storage vs 2000px

async function uploadThumb(path, buf) {
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/thumbs/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true'
    },
    body: buf
  });
  if (!up.ok) throw new Error('Supabase ' + up.status + ': ' + (await up.text()));
}

async function processOne(fileId, token, clientId) {
  try {
    // 1. Download foto asli dari Drive (server-side, tanpa CORS)
    const driveResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!driveResp.ok) throw new Error('Drive HTTP ' + driveResp.status);
    const inBuf = Buffer.from(await driveResp.arrayBuffer());

    // 2. Resize jadi 2 ukuran: galeri (ringan) + zoom (tajam)
    const sharp = require('sharp');
    const base = sharp(inBuf, { failOn: 'none' });
    const galeri = await base.clone()
      .resize({ width: SIZE_GALERI, height: SIZE_GALERI, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    const zoom = await base.clone()
      .resize({ width: SIZE_ZOOM, height: SIZE_ZOOM, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    // 3. Upload keduanya ke Supabase Storage (bucket: thumbs)
    const pathGaleri = `${clientId}/${fileId}.jpg`;
    const pathZoom = `${clientId}/${fileId}-zoom.jpg`;
    await uploadThumb(pathGaleri, galeri);
    await uploadThumb(pathZoom, zoom);

    return {
      id: fileId,
      ok: true,
      url: `${SUPABASE_URL}/storage/v1/object/public/thumbs/${pathGaleri}`,
      zoomUrl: `${SUPABASE_URL}/storage/v1/object/public/thumbs/${pathZoom}`
    };
  } catch (e) {
    console.error('thumb fail', fileId, e);
    return { id: fileId, ok: false, error: String(e.message || e) };
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, clientId, ids } = req.body || {};
  if (!token || !clientId || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'token/clientId/ids wajib diisi' });
  }

  const batch = ids.slice(0, BATCH_MAX);
  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < batch.length) {
      const i = idx++;
      results.push(await processOne(batch[i], token, clientId));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batch.length) }, () => worker())
  );

  res.status(200).json({ results });
}
