'use strict';

// ===== STATE =====
let currentMode = 'split';
let splitImage = { base64: null, type: null };
let splitOutputText = '';

// Node canvas state
const nodeMap = new Map();
let nodeIdSeq = 0;
let canvasTx = { x: 0, y: 0, scale: 1 };
let isPanning = false;
let panAnchor = { x: 0, y: 0 };

// ===== DOM REFS =====
const $ = id => document.getElementById(id);

const splitView       = $('split-view');
const nodeView        = $('node-view');
const splitBtn        = $('split-btn');
const nodeBtn         = $('node-btn');
const settingsBtn     = $('settings-btn');
const settingsPanel   = $('settings-panel');
const settingsBackdrop= $('settings-backdrop');
const closeSettings   = $('close-settings');
const apiKeyInput     = $('api-key-input');
const saveApiKey      = $('save-api-key');
const apiStatus       = $('api-status');
const inputText       = $('input-text');
const inputBody       = $('input-body');
const dropOverlay     = $('drop-overlay');
const imagePreviewWrap= $('image-preview-wrap');
const imagePreview    = $('image-preview');
const removeImage     = $('remove-image');
const clearInput      = $('clear-input');
const translateBtn    = $('translate-btn');
const outFormat       = $('out-format');
const outTone         = $('out-tone');
const outLang         = $('out-lang');
const outputPlaceholder=$('output-placeholder');
const outputText      = $('output-text');
const outputImageWrap = $('output-image-wrap');
const outputImageEl   = $('output-image');
const outputImagePrompt=$('output-image-prompt');
const imageLoading    = $('image-loading');
const outputAudioWrap = $('output-audio-wrap');
const outputAudioText = $('output-audio-text');
const audioGenerating = $('audio-generating');
const audioPlayer     = $('audio-player');
const speakBtn        = $('speak-btn');
const skeletonWrap    = $('skeleton-wrap');
const copyOutput      = $('copy-output');
const downloadOutput  = $('download-output');
const nodeCanvas      = $('node-canvas');
const connectionsSvg  = $('connections-svg');
const addRootNode     = $('add-root-node');
const resetViewBtn    = $('reset-view-btn');
const nodeEmptyState  = $('node-empty-state');
const defaultFormat   = $('default-format');
const defaultTone     = $('default-tone');
const defaultLang     = $('default-lang');
const toastEl         = $('toast');

// ===== INIT =====
function init() {
  loadPersistedSettings();
  bindModeToggle();
  bindSettingsPanel();
  bindSplitInput();
  bindSplitTranslate();
  bindSpeakButton();
  bindNodeCanvas();
  bindNodeToolbar();
}

// ===== SETTINGS PERSISTENCE =====
function loadPersistedSettings() {
  const key = localStorage.getItem('limber_api_key');
  if (key) {
    apiKeyInput.value = key;
    setApiStatus('API 키 저장됨', 'ok');
  }

  const fmt  = localStorage.getItem('limber_format') || 'translate';
  const tone = localStorage.getItem('limber_tone')   || 'neutral';
  const lang = localStorage.getItem('limber_lang')   || 'ko';

  outFormat.value = fmt;
  outTone.value   = tone;
  outLang.value   = lang;
  defaultFormat.value = fmt;
  defaultTone.value   = tone;
  defaultLang.value   = lang;
}

function setApiStatus(msg, cls) {
  apiStatus.textContent = msg;
  apiStatus.className = 'api-status ' + (cls || '');
}

// ===== MODE TOGGLE =====
function bindModeToggle() {
  splitBtn.addEventListener('click', () => switchMode('split'));
  nodeBtn.addEventListener('click',  () => switchMode('node'));
}

function switchMode(mode) {
  currentMode = mode;
  const toSplit = mode === 'split';
  splitView.hidden = !toSplit;
  nodeView.hidden  = toSplit;
  splitBtn.classList.toggle('active', toSplit);
  nodeBtn.classList.toggle('active', !toSplit);
  if (!toSplit) requestAnimationFrame(redrawConnections);
}

// ===== SETTINGS PANEL =====
function bindSettingsPanel() {
  settingsBtn.addEventListener('click', openSettingsPanel);
  closeSettings.addEventListener('click', closeSettingsPanel);
  settingsBackdrop.addEventListener('click', closeSettingsPanel);

  saveApiKey.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) { setApiStatus('키를 입력해주세요', 'err'); return; }
    localStorage.setItem('limber_api_key', key);
    setApiStatus('저장되었습니다', 'ok');
    showToast('API 키 저장 완료');
  });

  defaultFormat.addEventListener('change', () => {
    localStorage.setItem('limber_format', defaultFormat.value);
    outFormat.value = defaultFormat.value;
  });
  defaultTone.addEventListener('change', () => {
    localStorage.setItem('limber_tone', defaultTone.value);
    outTone.value = defaultTone.value;
  });
  defaultLang.addEventListener('change', () => {
    localStorage.setItem('limber_lang', defaultLang.value);
    outLang.value = defaultLang.value;
  });
}

function openSettingsPanel() {
  settingsPanel.classList.add('open');
  settingsBackdrop.classList.add('visible');
}

function closeSettingsPanel() {
  settingsPanel.classList.remove('open');
  settingsBackdrop.classList.remove('visible');
}

// ===== SPLIT INPUT =====
function bindSplitInput() {
  clearInput.addEventListener('click', () => {
    inputText.value = '';
    clearSplitImage();
  });

  removeImage.addEventListener('click', clearSplitImage);

  // Drag-and-drop — textarea intercepts events so listen on both
  function handleDragEnter(e) {
    e.preventDefault();
    if (hasFiles(e.dataTransfer)) dropOverlay.classList.add('active');
  }
  function handleDragOver(e) { e.preventDefault(); }
  function handleDragLeave(e) {
    if (!inputBody.contains(e.relatedTarget)) dropOverlay.classList.remove('active');
  }
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropOverlay.classList.remove('active');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadSplitImage(file);
  }

  [inputBody, inputText].forEach(el => {
    el.addEventListener('dragenter', handleDragEnter);
    el.addEventListener('dragover',  handleDragOver);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop',      handleDrop);
  });

}

function hasFiles(dt) {
  return dt && Array.from(dt.types || []).includes('Files');
}

function loadSplitImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    splitImage.base64 = dataUrl.split(',')[1];
    splitImage.type   = file.type;
    imagePreview.src  = dataUrl;
    imagePreviewWrap.hidden = false;
  };
  reader.readAsDataURL(file);
}

function clearSplitImage() {
  splitImage = { base64: null, type: null };
  imagePreviewWrap.hidden = true;
  imagePreview.src = '';
}

// ===== SPLIT TRANSLATE =====
function bindSplitTranslate() {
  translateBtn.addEventListener('click', async () => {
    const text = inputText.value.trim();
    if (!text && !splitImage.base64) {
      showToast('텍스트 또는 이미지를 입력해주세요');
      return;
    }
    if (!getApiKey()) { openSettingsPanel(); showToast('먼저 API 키를 입력해주세요'); return; }

    setSplitLoading(true);
    try {
      const fmt = outFormat.value;
      const result = await callClaude({
        text,
        imageBase64: splitImage.base64,
        imageType: splitImage.type,
        format: fmt,
        tone: outTone.value,
        lang: outLang.value
      });

      if (fmt === 'image') {
        showSplitImage(result);
      } else if (fmt === 'audio') {
        showSplitAudio(result);
      } else {
        splitOutputText = result;
        showSplitOutput(result);
      }
    } catch (err) {
      setSplitLoading(false);
      outputPlaceholder.hidden = false;
      showToast('오류: ' + (err.message || '알 수 없는 오류'));
    }
  });

  copyOutput.addEventListener('click', () => {
    if (!splitOutputText) return;
    navigator.clipboard.writeText(splitOutputText).then(() => showToast('클립보드에 복사됨'));
  });

  downloadOutput.addEventListener('click', () => {
    if (outFormat.value === 'image') {
      downloadImage(outputImageEl.src);
    } else if (splitOutputText) {
      triggerDownload(splitOutputText, 'limber-output.txt');
    }
  });
}

function setSplitLoading(on) {
  translateBtn.disabled    = on;
  skeletonWrap.hidden      = !on;
  outputPlaceholder.hidden = on;
  if (on) {
    outputText.hidden      = true;
    outputImageWrap.hidden = true;
    outputAudioWrap.hidden = true;
    imageLoading.hidden    = true;
    speakBtn.disabled      = true;
    stopSpeaking();
  }
}

function showSplitOutput(text) {
  setSplitLoading(false);
  outputText.textContent = text;
  outputText.hidden      = false;
  outputImageWrap.hidden = true;
  outputAudioWrap.hidden = true;
  speakBtn.disabled      = false;
}

// ===== SPEAK BUTTON (Web Speech API) =====
function bindSpeakButton() {
  if (!('speechSynthesis' in window)) { speakBtn.hidden = true; return; }

  speakBtn.addEventListener('click', () => {
    if (speechSynthesis.speaking) {
      stopSpeaking();
    } else {
      const text = splitOutputText || outputAudioText.textContent;
      if (!text) return;
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES' }[outLang.value] || 'ko-KR';
      utt.onend = () => speakBtn.classList.remove('speaking');
      utt.onerror = () => speakBtn.classList.remove('speaking');
      speechSynthesis.speak(utt);
      speakBtn.classList.add('speaking');
    }
  });
}

function stopSpeaking() {
  if ('speechSynthesis' in window && speechSynthesis.speaking) speechSynthesis.cancel();
  speakBtn.classList.remove('speaking');
}

function showSplitImage(prompt) {
  // Claude returned the prompt — switch from text skeleton to image loading UI
  skeletonWrap.hidden      = true;
  outputText.hidden        = true;
  outputImageWrap.hidden   = true;
  outputPlaceholder.hidden = true;
  imageLoading.hidden      = false;
  translateBtn.disabled    = true;

  outputImagePrompt.textContent = prompt;
  const url = buildPollinationsUrl(prompt);

  function onLoad() {
    clearTimeout(timer);
    outputImageEl.removeEventListener('load',  onLoad);
    outputImageEl.removeEventListener('error', onError);
    imageLoading.hidden    = true;
    outputImageWrap.hidden = false;
    translateBtn.disabled  = false;
  }

  function onError() {
    clearTimeout(timer);
    outputImageEl.removeEventListener('load',  onLoad);
    outputImageEl.removeEventListener('error', onError);
    imageLoading.hidden      = true;
    outputPlaceholder.hidden = false;
    translateBtn.disabled    = false;
    showToast('이미지 생성에 실패했습니다. 다시 시도해주세요.');
  }

  // 90s timeout — Pollinations can be slow under load
  const timer = setTimeout(() => {
    outputImageEl.removeEventListener('load',  onLoad);
    outputImageEl.removeEventListener('error', onError);
    outputImageEl.src        = '';
    imageLoading.hidden      = true;
    outputPlaceholder.hidden = false;
    translateBtn.disabled    = false;
    showToast('이미지 생성 시간이 초과됐습니다. 다시 시도해주세요.');
  }, 90000);

  outputImageEl.addEventListener('load',  onLoad);
  outputImageEl.addEventListener('error', onError);
  outputImageEl.src = url;
}

function showSplitAudio(text) {
  setSplitLoading(false);
  outputAudioText.textContent = text;
  outputAudioWrap.hidden      = false;
  audioGenerating.hidden      = false;
  audioPlayer.hidden          = true;
  speakBtn.disabled           = false;

  const voice = { ko: 'nova', ja: 'shimmer', zh: 'shimmer', es: 'alloy', en: 'alloy' }[outLang.value] || 'nova';
  const url   = 'https://text.pollinations.ai/' +
    encodeURIComponent(text.slice(0, 800)) +
    '?model=openai-audio&voice=' + voice;

  function onCanPlay() {
    audioPlayer.removeEventListener('canplaythrough', onCanPlay);
    audioPlayer.removeEventListener('error', onAudioErr);
    audioGenerating.hidden = true;
    audioPlayer.hidden     = false;
  }
  function onAudioErr() {
    audioPlayer.removeEventListener('canplaythrough', onCanPlay);
    audioPlayer.removeEventListener('error', onAudioErr);
    audioGenerating.hidden = true;
    showToast('음성 생성에 실패했습니다. 다시 시도해주세요.');
  }

  audioPlayer.addEventListener('canplaythrough', onCanPlay);
  audioPlayer.addEventListener('error', onAudioErr);
  audioPlayer.src = url;
  audioPlayer.load();
}

function buildPollinationsUrl(prompt) {
  const seed = Math.floor(Math.random() * 99999);
  return 'https://image.pollinations.ai/prompt/' +
    encodeURIComponent(prompt) +
    '?width=896&height=640&model=flux&nologo=true&seed=' + seed;
}

async function downloadImage(src) {
  try {
    const res  = await fetch(src);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'limber-image.png' });
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    showToast('이미지 다운로드에 실패했습니다.');
  }
}

// ===== CLAUDE API =====
function getApiKey() {
  return localStorage.getItem('limber_api_key') || '';
}

async function callClaude({ text, imageBase64, imageType, format, tone, lang }) {
  const key = getApiKey();
  const system = buildSystemPrompt(format, tone, lang);

  const content = imageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: imageType || 'image/png', data: imageBase64 } },
        { type: 'text',  text: text || '이 이미지의 텍스트를 지시에 따라 처리해줘' }
      ]
    : [{ type: 'text', text }];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content }]
    })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

function buildSystemPrompt(format, tone, lang) {
  const langName = { ko: '한국어', en: 'English', ja: '日本語', zh: '中文', es: 'Español' }[lang] || lang;
  const toneName = { neutral: '중립적이고 자연스러운 문체', formal: '격식체와 공식적인 문체', casual: '친근하고 구어적인 문체' }[tone] || tone;

  const prompts = {
    translate: `주어진 텍스트(또는 이미지의 텍스트)를 ${langName}로 번역해줘. ${toneName}를 사용해. 번역문만 출력해.`,
    explain:   `주어진 텍스트(또는 이미지)를 ${langName}로 상세히 설명하고 해석해줘. ${toneName}를 사용해. 핵심 개념과 맥락을 포함해.`,
    summarize: `주어진 텍스트(또는 이미지의 텍스트)의 핵심을 ${langName}로 간결하게 요약해줘. ${toneName}를 사용해.`,
    bullets:   `주어진 텍스트(또는 이미지의 텍스트)의 핵심 내용을 ${langName}로 불릿 포인트(•) 목록으로 정리해줘. ${toneName}를 사용해.`,
    rewrite:   `주어진 텍스트를 ${langName}로, ${toneName}로 다시 작성해줘. 의미는 유지하되 표현을 바꿔줘.`,
    image:     `사용자가 입력한 내용을 분석하여, FLUX 이미지 생성 모델에 최적화된 영어 프롬프트를 작성해줘. 시각적으로 구체적이고 풍부한 묘사를 포함해야 해. 프롬프트 텍스트만 출력해. 다른 설명, 따옴표, 머릿말은 절대 쓰지 마. 예시 형식: "a serene mountain lake at sunrise, golden light reflecting on calm water, misty pine forest, photorealistic, cinematic"`,
    audio:     `주어진 텍스트(또는 이미지의 텍스트)를 ${langName}로 번역하거나 처리해줘. ${toneName}를 사용해. 음성으로 읽기 좋게 자연스러운 문장으로 작성해. 텍스트만 출력해.`
  };

  return prompts[format] || prompts.translate;
}

// ===== NODE CANVAS =====
function bindNodeCanvas() {
  const nv = nodeView;

  nv.addEventListener('mousedown', e => {
    if (e.target !== nv && e.target !== nodeCanvas && e.target !== connectionsSvg) return;
    isPanning = true;
    panAnchor = { x: e.clientX - canvasTx.x, y: e.clientY - canvasTx.y };
    nv.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', e => {
    if (!isPanning) return;
    canvasTx.x = e.clientX - panAnchor.x;
    canvasTx.y = e.clientY - panAnchor.y;
    applyCanvasTx();
  });

  window.addEventListener('mouseup', () => {
    if (!isPanning) return;
    isPanning = false;
    nodeView.style.cursor = 'grab';
  });

  nv.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1 / 0.92;
    const next = Math.max(0.25, Math.min(3, canvasTx.scale * factor));
    const rect = nv.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    canvasTx.x = mx - (mx - canvasTx.x) * (next / canvasTx.scale);
    canvasTx.y = my - (my - canvasTx.y) * (next / canvasTx.scale);
    canvasTx.scale = next;
    applyCanvasTx();
    redrawConnections();
  }, { passive: false });
}

function applyCanvasTx() {
  nodeCanvas.style.transform = `translate(${canvasTx.x}px,${canvasTx.y}px) scale(${canvasTx.scale})`;
}

function bindNodeToolbar() {
  addRootNode.addEventListener('click', () => {
    const rect = nodeView.getBoundingClientRect();
    const cx = (rect.width  / 2 - canvasTx.x) / canvasTx.scale - 155;
    const cy = (rect.height / 2 - canvasTx.y) / canvasTx.scale - 140;
    spawnNode(null, cx, cy, '');
  });

  resetViewBtn.addEventListener('click', () => {
    canvasTx = { x: 0, y: 0, scale: 1 };
    applyCanvasTx();
    redrawConnections();
  });
}

// ===== NODE CREATION =====
function spawnNode(parentId, x, y, inheritInput) {
  const id = 'n' + (++nodeIdSeq);
  const data = {
    id,
    parentId,
    x, y,
    input:  inheritInput || '',
    image:  { base64: null, type: null },
    format: localStorage.getItem('limber_format') || 'translate',
    tone:   localStorage.getItem('limber_tone')   || 'neutral',
    lang:   localStorage.getItem('limber_lang')   || 'ko',
    output: ''
  };
  nodeMap.set(id, data);
  renderNodeCard(data);
  updateEmptyState();
  requestAnimationFrame(redrawConnections);
  return id;
}

const FORMAT_LABELS = { translate: '번역', explain: '설명', summarize: '요약', bullets: '불릿', rewrite: '재작성', image: '이미지', audio: '음성' };

function renderNodeCard(data) {
  const { id, x, y, input, format, tone, lang, output } = data;

  const card = document.createElement('div');
  card.className = 'node-card';
  card.id = 'nc-' + id;
  card.style.cssText = `left:${x}px;top:${y}px`;

  card.innerHTML = `
    <div class="node-header" data-drag="${id}">
      <span class="node-badge" id="nb-${id}">${FORMAT_LABELS[format]}</span>
      <button class="node-close-btn" data-close="${id}" title="삭제">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M8 2L2 8M2 2l6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div class="node-body">
      <textarea class="node-textarea" data-ta="${id}" placeholder="텍스트 입력 또는 이미지 드래그" spellcheck="false">${escHtml(input)}</textarea>
      <div class="node-output ${output ? '' : 'is-empty'}" id="no-${id}">${output ? escHtml(output) : '번역 결과가 여기에 표시됩니다'}</div>
      <div class="node-selects">
        <select class="node-select" data-sel="${id}" data-field="format">
          <option value="translate" ${format==='translate'?'selected':''}>번역</option>
          <option value="explain"   ${format==='explain'  ?'selected':''}>설명</option>
          <option value="summarize" ${format==='summarize'?'selected':''}>요약</option>
          <option value="bullets"   ${format==='bullets'  ?'selected':''}>불릿</option>
          <option value="rewrite"   ${format==='rewrite'  ?'selected':''}>재작성</option>
          <option value="image"     ${format==='image'    ?'selected':''}>이미지</option>
          <option value="audio"     ${format==='audio'    ?'selected':''}>음성</option>
        </select>
        <select class="node-select" data-sel="${id}" data-field="tone">
          <option value="neutral" ${tone==='neutral'?'selected':''}>중립</option>
          <option value="formal"  ${tone==='formal' ?'selected':''}>격식체</option>
          <option value="casual"  ${tone==='casual' ?'selected':''}>구어체</option>
        </select>
        <select class="node-select" data-sel="${id}" data-field="lang">
          <option value="ko" ${lang==='ko'?'selected':''}>KO</option>
          <option value="en" ${lang==='en'?'selected':''}>EN</option>
          <option value="ja" ${lang==='ja'?'selected':''}>JA</option>
          <option value="zh" ${lang==='zh'?'selected':''}>ZH</option>
          <option value="es" ${lang==='es'?'selected':''}>ES</option>
        </select>
      </div>
      <div class="node-actions">
        <button class="node-btn node-btn-translate" data-tr="${id}">변환</button>
        <button class="node-btn node-btn-branch"    data-br="${id}">Branch +</button>
        <button class="node-btn node-btn-copy" data-cp="${id}" title="복사">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="4" y="4" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.3"/>
            <path d="M8 4V2.5A.5.5 0 007.5 2h-5a.5.5 0 00-.5.5v5a.5.5 0 00.5.5H4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>`;

  nodeCanvas.appendChild(card);
  attachNodeEvents(card, id);
}

function attachNodeEvents(card, id) {
  // Stop canvas pan when interacting with card
  card.addEventListener('mousedown', e => e.stopPropagation());

  // Drag header
  const header = card.querySelector(`[data-drag="${id}"]`);
  let dragging = false, dragAnchor = {};

  header.addEventListener('mousedown', e => {
    if (e.target.closest(`[data-close]`)) return;
    e.preventDefault();
    dragging = true;
    const d = nodeMap.get(id);
    dragAnchor = { mx: e.clientX, my: e.clientY, nx: d.x, ny: d.y };
    card.classList.add('is-dragging');
  });

  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const d = nodeMap.get(id);
    if (!d) return;
    d.x = dragAnchor.nx + (e.clientX - dragAnchor.mx) / canvasTx.scale;
    d.y = dragAnchor.ny + (e.clientY - dragAnchor.my) / canvasTx.scale;
    card.style.left = d.x + 'px';
    card.style.top  = d.y + 'px';
    redrawConnections();
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    card.classList.remove('is-dragging');
  });

  // Delegated clicks
  card.addEventListener('click', e => {
    if (e.target.closest(`[data-close="${id}"]`)) { deleteNode(id); return; }
    if (e.target.closest(`[data-tr="${id}"]`))    { runNodeTranslate(id); return; }
    if (e.target.closest(`[data-br="${id}"]`))    { branchFromNode(id); return; }
    if (e.target.closest(`[data-cp="${id}"]`))    {
      const d = nodeMap.get(id);
      if (d && d.output) navigator.clipboard.writeText(d.output).then(() => showToast('복사됨'));
    }
  });

  // Select changes
  card.addEventListener('change', e => {
    const sel = e.target.closest(`[data-sel]`);
    if (!sel) return;
    const d = nodeMap.get(id);
    if (!d) return;
    d[sel.dataset.field] = sel.value;
    if (sel.dataset.field === 'format') {
      document.getElementById('nb-' + id).textContent = FORMAT_LABELS[sel.value];
    }
  });

  // Textarea sync
  card.addEventListener('input', e => {
    const ta = e.target.closest(`[data-ta]`);
    if (!ta) return;
    const d = nodeMap.get(id);
    if (d) d.input = ta.value;
  });

  // Image drop onto node — register on both card and its textarea
  const nodeTextarea = card.querySelector('.node-textarea');
  function nodeDropEnter(e) { e.preventDefault(); e.stopPropagation(); card.style.borderColor = 'var(--primary)'; }
  function nodeDropOver(e)  { e.preventDefault(); e.stopPropagation(); }
  function nodeDropLeave(e) { if (!card.contains(e.relatedTarget)) card.style.borderColor = ''; }
  function nodeDropDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    card.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const d = nodeMap.get(id);
      if (!d) return;
      d.image.base64 = ev.target.result.split(',')[1];
      d.image.type   = file.type;
      showToast('이미지 첨부됨');
    };
    reader.readAsDataURL(file);
  }

  [card, nodeTextarea].forEach(el => {
    el.addEventListener('dragenter', nodeDropEnter);
    el.addEventListener('dragover',  nodeDropOver);
    el.addEventListener('dragleave', nodeDropLeave);
    el.addEventListener('drop',      nodeDropDrop);
  });
}

// ===== NODE TRANSLATE =====
async function runNodeTranslate(id) {
  const d = nodeMap.get(id);
  if (!d) return;

  if (!getApiKey()) { openSettingsPanel(); showToast('API 키를 입력해주세요'); return; }
  if (!d.input && !d.image.base64) { showToast('텍스트 또는 이미지를 입력해주세요'); return; }

  const trBtn = document.querySelector(`[data-tr="${id}"]`);
  const outEl = document.getElementById('no-' + id);

  trBtn.disabled = true;
  trBtn.textContent = '처리 중...';
  outEl.innerHTML = '';
  outEl.className = 'node-output is-empty';

  try {
    const result = await callClaude({
      text: d.input, imageBase64: d.image.base64, imageType: d.image.type,
      format: d.format, tone: d.tone, lang: d.lang
    });
    d.output = result;

    if (d.format === 'image') {
      outEl.className = 'node-output';
      const img = document.createElement('img');
      img.style.cssText = 'width:100%;border-radius:6px;display:block;margin-top:4px';
      img.alt = '생성된 이미지';
      img.src = buildPollinationsUrl(result);
      outEl.innerHTML = '';
      outEl.appendChild(img);
    } else if (d.format === 'audio') {
      outEl.className = 'node-output';
      const voice = { ko: 'nova', ja: 'shimmer', zh: 'shimmer', es: 'alloy', en: 'alloy' }[d.lang] || 'nova';
      const audioUrl = 'https://text.pollinations.ai/' +
        encodeURIComponent(result.slice(0, 800)) +
        '?model=openai-audio&voice=' + voice;
      outEl.innerHTML = `<p style="font-size:12px;line-height:1.6;margin-bottom:8px">${escHtml(result)}</p>
        <audio controls preload="auto" style="width:100%;height:32px;border-radius:6px;accent-color:var(--primary)" src="${audioUrl}"></audio>`;
    } else {
      outEl.textContent = result;
      outEl.className = 'node-output';
    }
  } catch (err) {
    outEl.textContent = '오류: ' + (err.message || '');
    outEl.className = 'node-output is-empty';
    showToast('번역 오류: ' + (err.message || ''));
  } finally {
    trBtn.disabled = false;
    trBtn.textContent = '변환';
  }
}

// ===== NODE BRANCH =====
function branchFromNode(parentId) {
  const parent = nodeMap.get(parentId);
  if (!parent) return;

  const sibCount = [...nodeMap.values()].filter(n => n.parentId === parentId).length;
  const offsetX = 340;
  const offsetY = 180 + sibCount * 80;

  spawnNode(parentId, parent.x + offsetX, parent.y + offsetY, parent.output || '');
}

// ===== NODE DELETE =====
function deleteNode(id) {
  const card = document.getElementById('nc-' + id);
  if (card) card.remove();

  [...nodeMap.values()]
    .filter(n => n.parentId === id)
    .forEach(n => deleteNode(n.id));

  nodeMap.delete(id);
  updateEmptyState();
  redrawConnections();
}

// ===== CONNECTIONS =====
function redrawConnections() {
  connectionsSvg.innerHTML = '';

  nodeMap.forEach(nd => {
    if (!nd.parentId) return;
    const parent = nodeMap.get(nd.parentId);
    if (!parent) return;

    const parentCard = document.getElementById('nc-' + nd.parentId);
    const childCard  = document.getElementById('nc-' + nd.id);
    if (!parentCard || !childCard) return;

    const pBot = cardEdgePoint(parent, parentCard, 'bottom');
    const cTop = cardEdgePoint(nd, childCard, 'top');

    const dy = Math.abs(cTop.y - pBot.y) * 0.5;
    const pathD = `M${pBot.x},${pBot.y} C${pBot.x},${pBot.y + dy} ${cTop.x},${cTop.y - dy} ${cTop.x},${cTop.y}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('class', 'conn-path');
    connectionsSvg.appendChild(path);
  });
}

function cardEdgePoint(nd, card, edge) {
  const s  = canvasTx.scale;
  const tx = canvasTx.x;
  const ty = canvasTx.y;
  const w  = card.offsetWidth;
  const h  = card.offsetHeight;
  const ax = nd.x * s + tx;
  const ay = nd.y * s + ty;
  return edge === 'bottom'
    ? { x: ax + (w / 2) * s, y: ay + h * s }
    : { x: ax + (w / 2) * s, y: ay };
}

// ===== EMPTY STATE =====
function updateEmptyState() {
  nodeEmptyState.classList.toggle('hidden', nodeMap.size > 0);
}

// ===== UTILITIES =====
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function triggerDownload(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== GO =====
init();
