const { requireAccess } = require('./auth');

function isAllowedModelUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Limber-Password');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAccess(req, res)) return;

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  if (!isAllowedModelUrl(url)) return res.status(400).json({ error: 'invalid model url' });

  try {
    const modelRes = await fetch(url);
    if (!modelRes.ok) {
      throw new Error(`Model download failed (${modelRes.status})`);
    }

    const buffer = Buffer.from(await modelRes.arrayBuffer());
    res.setHeader('Content-Type', modelRes.headers.get('content-type') || 'model/gltf-binary');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(200).end(buffer);
  } catch (err) {
    console.error('3d model proxy error:', err.message);
    res.status(502).json({ error: err.message || '3D model download failed' });
  }
};
