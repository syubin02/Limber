const { requireAccess } = require('./auth');

function getMeshyKey() {
  return process.env.meshy_key || process.env.MESHY_KEY || '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Limber-Password');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAccess(req, res)) return;

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const apiKey = getMeshyKey();
  if (!apiKey) return res.status(500).json({ error: 'meshy_key is not configured' });

  try {
    const response = await fetch('https://api.meshy.ai/openapi/v2/text-to-3d', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'preview',
        prompt: prompt.slice(0, 600),
        ai_model: 'latest',
        model_type: 'standard',
        target_formats: ['glb'],
        moderation: true,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || `Meshy ${response.status}`);

    res.status(200).json({ id: data.result });
  } catch (err) {
    console.error('3d gen error:', err.message);
    res.status(500).json({ error: err.message || '3D generation failed' });
  }
};
