module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const pollRes = await fetch(`https://api.openai.com/v1/video/generations/${id}`, {
      headers: { 'Authorization': `Bearer ${process.env.limber_key}` },
    });

    if (!pollRes.ok) {
      const body = await pollRes.json().catch(() => ({}));
      throw new Error(body.error?.message || `HTTP ${pollRes.status}`);
    }

    const data = await pollRes.json();
    const url = data.data?.[0]?.url || null;
    res.status(200).json({ status: data.status, url });
  } catch (err) {
    console.error('video status error:', err);
    res.status(500).json({ error: err.message || 'Status check failed' });
  }
}
