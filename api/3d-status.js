const { requireAccess } = require('./auth');

function getMeshyKey() {
  return process.env.meshy_key || process.env.MESHY_KEY || '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Limber-Password');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAccess(req, res)) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  const apiKey = getMeshyKey();
  if (!apiKey) return res.status(500).json({ error: 'meshy_key is not configured' });

  try {
    const response = await fetch(`https://api.meshy.ai/openapi/v2/text-to-3d/${encodeURIComponent(id)}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || `Meshy ${response.status}`);

    res.status(200).json({
      status: data.status,
      progress: data.progress || 0,
      url: data.model_urls?.glb || null,
      thumbnailUrl: data.thumbnail_url || null,
      error: data.task_error?.message || null,
    });
  } catch (err) {
    console.error('3d status error:', err.message);
    res.status(500).json({ error: err.message || '3D status check failed' });
  }
};
