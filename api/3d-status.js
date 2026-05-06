const { requireAccess } = require('./auth');

function getMeshyKey() {
  return process.env.meshy_key || process.env.MESHY_KEY || '';
}

function meshyErrorMessage(status, data) {
  const raw = data.message || data.error || data.detail || '';
  if (status === 401 || status === 403) {
    return 'Meshy API 키 인증에 실패했습니다. Vercel의 meshy_key를 새 Meshy API 키로 교체해주세요.';
  }
  if (status === 402) {
    return 'Meshy 크레딧이 부족합니다. Meshy API credits를 충전해주세요.';
  }
  if (status === 404) {
    return 'Meshy 3D 작업을 찾지 못했습니다. 다시 생성해주세요.';
  }
  if (status === 429) {
    return 'Meshy 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  }
  return raw || `Meshy ${status}`;
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
    if (!response.ok) {
      const error = new Error(meshyErrorMessage(response.status, data));
      error.status = response.status;
      throw error;
    }

    res.status(200).json({
      status: data.status,
      progress: data.progress || 0,
      url: data.model_urls?.glb || null,
      thumbnailUrl: data.thumbnail_url || null,
      error: data.task_error?.message || null,
    });
  } catch (err) {
    console.error('3d status error:', err.message);
    const status = err.status === 402 || err.status === 404 || err.status === 429 ? err.status : 502;
    res.status(status).json({ error: err.message || '3D status check failed', providerStatus: err.status || null });
  }
};
