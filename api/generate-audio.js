const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VOICE_MAP = { ko: 'nova', ja: 'shimmer', zh: 'shimmer', es: 'alloy', en: 'alloy' };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, lang } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const voice = VOICE_MAP[lang] || 'nova';

  try {
    const mp3 = await client.audio.speech.create({
      model: 'tts-1-hd',
      voice,
      input: text.slice(0, 4096),
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end(buffer);
  } catch (err) {
    console.error('audio gen error:', err);
    res.status(500).json({ error: err.message || 'Audio generation failed' });
  }
}
