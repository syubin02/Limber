const { requireAccess } = require('./auth');

function buildSystemPrompt(format, tone, lang, customStyle, customFormat) {
  const langName = { ko: '한국어', en: 'English', ja: '日本語', zh: '中文', es: 'Español' }[lang] || lang;
  const toneName = {
    neutral: '중립적이고 자연스러운 문체',
    formal:  '격식체와 공식적인 문체',
    casual:  '친근하고 구어적인 문체',
  }[tone] || tone;

  const toneInstruction = customStyle
    ? `다음 말투/스타일을 완벽하게 흉내내줘: "${customStyle}". 그 말투의 특징적인 표현, 어투, 리듬을 그대로 살려야 해.`
    : `${toneName}를 사용해.`;

  const prompts = {
    translate: `주어진 텍스트(또는 이미지의 텍스트)를 ${langName}로 번역해줘. ${toneInstruction} 번역문만 출력해.`,
    explain:   `주어진 텍스트(또는 이미지)를 ${langName}로 상세히 설명하고 해석해줘. ${toneInstruction} 핵심 개념과 맥락을 포함해.`,
    summarize: `주어진 텍스트(또는 이미지의 텍스트)의 핵심을 ${langName}로 간결하게 요약해줘. ${toneInstruction}`,
    bullets:   `주어진 텍스트(또는 이미지의 텍스트)의 핵심 내용을 ${langName}로 불릿 포인트(•) 목록으로 정리해줘. ${toneInstruction}`,
    rewrite:   `주어진 텍스트를 ${langName}로 다시 작성해줘. ${toneInstruction} 의미는 유지하되 표현을 바꿔줘.`,
    image:     `사용자가 입력한 내용을 분석하여, DALL-E 3 이미지 생성 모델에 최적화된 영어 프롬프트를 작성해줘. 시각적으로 구체적이고 풍부한 묘사를 포함해야 해. 프롬프트 텍스트만 출력해. 다른 설명, 따옴표, 머릿말은 절대 쓰지 마.`,
    audio:     `주어진 텍스트(또는 이미지의 텍스트)를 ${langName}로 번역하거나 처리해줘. ${toneInstruction} 음성으로 읽기 좋게 자연스러운 문장으로 작성해. 텍스트만 출력해.`,
    video:     `사용자가 입력한 내용을 분석하여, Sora 동영상 생성 모델에 최적화된 영어 프롬프트를 작성해줘. 동적인 카메라 움직임, 조명, 분위기를 구체적으로 묘사해야 해. 프롬프트 텍스트만 출력해. 다른 설명, 따옴표, 머릿말은 절대 쓰지 마.`,
    object3d:  `사용자가 입력한 내용을 text-to-3D 모델에 넣을 영어 프롬프트로 변환해줘. 오브젝트의 실제 형태, 구조, 주요 부품, 재질, 비율, 스타일을 구체적으로 써. 배경이나 카메라 설명은 빼고 오브젝트만 묘사해. 프롬프트 텍스트만 출력해. 다른 설명, 따옴표, 머릿말은 절대 쓰지 마.`,
    space:     `사용자가 입력한 내용을 360도 equirectangular panorama 이미지 생성 모델에 넣을 영어 프롬프트로 변환해줘. 실내/실외 공간 구조, 바닥, 천장/하늘, 전후좌우로 이어지는 환경, 조명, 분위기를 구체적으로 묘사하고 "seamless 360 equirectangular panorama, full spherical environment, 2:1 aspect ratio"를 포함해. 프롬프트 텍스트만 출력해. 다른 설명, 따옴표, 머릿말은 절대 쓰지 마.`,
    custom:    `주어진 텍스트(또는 이미지의 텍스트)를 ${langName}로 처리하되, 출력 형태는 사용자가 지정한 "${customFormat || '자유 형식'}"에 맞춰 작성해줘. ${toneInstruction} 결과물만 출력하고 불필요한 설명은 쓰지 마.`,
  };

  return prompts[format] || prompts.translate;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Limber-Password');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAccess(req, res)) return;

  const { text, imageBase64, imageType, format, customFormat, tone, lang, customStyle } = req.body || {};
  if (!text && !imageBase64) return res.status(400).json({ error: 'text or imageBase64 required' });

  const userContent = imageBase64
    ? [
        { type: 'image_url', image_url: { url: `data:${imageType || 'image/png'};base64,${imageBase64}`, detail: 'high' } },
        { type: 'text', text: text || '이 이미지의 텍스트를 지시에 따라 처리해줘' },
      ]
    : [{ type: 'text', text }];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.limber_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2048,
        messages: [
          { role: 'system', content: buildSystemPrompt(format || 'translate', tone || 'neutral', lang || 'ko', customStyle || '', customFormat || '') },
          { role: 'user', content: userContent },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `OpenAI ${response.status}`);

    res.status(200).json({ result: data.choices[0].message.content });
  } catch (err) {
    console.error('chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
