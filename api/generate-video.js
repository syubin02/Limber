const { requireAccess } = require('./auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Limber-Password');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAccess(req, res)) return;

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  try {
    const form = new FormData();
    form.set('model', 'sora-2');
    form.set('prompt', prompt);
    form.set('size', '1280x720');
    form.set('seconds', '8');

    const createRes = await fetch('https://api.openai.com/v1/videos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.limber_key}`,
      },
      body: form,
    });

    if (!createRes.ok) {
      const body = await createRes.json().catch(() => ({}));
      throw new Error(body.error?.message || `HTTP ${createRes.status}`);
    }

    const data = await createRes.json();
    res.status(200).json({ id: data.id });
  } catch (err) {
    console.error('video gen error:', err);
    res.status(500).json({ error: err.message || 'Video generation failed' });
  }
}
