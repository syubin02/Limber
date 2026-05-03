module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  try {
    const createRes = await fetch('https://api.openai.com/v1/video/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.limber_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sora',
        prompt,
        n: 1,
        size: '1280x720',
        duration: 5,
      }),
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
