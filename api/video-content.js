const { requireAccess } = require('./auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Limber-Password');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAccess(req, res)) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const contentRes = await fetch(`https://api.openai.com/v1/videos/${id}/content`, {
      headers: { 'Authorization': `Bearer ${process.env.limber_key}` },
    });

    if (!contentRes.ok) {
      const body = await contentRes.json().catch(() => ({}));
      throw new Error(body.error?.message || `HTTP ${contentRes.status}`);
    }

    const buffer = Buffer.from(await contentRes.arrayBuffer());
    res.setHeader('Content-Type', contentRes.headers.get('content-type') || 'video/mp4');
    res.setHeader('Content-Length', buffer.length);
    res.status(200).end(buffer);
  } catch (err) {
    console.error('video content error:', err);
    res.status(500).json({ error: err.message || 'Video content download failed' });
  }
};
