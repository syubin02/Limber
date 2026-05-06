'use strict';

// ===== STATE =====
let currentMode = 'split';
let splitImage = { base64: null, type: null };
let splitOutputText = '';
let accessPassword = '';
let activeThreeCleanup = null;

const API_BASE_URL = window.location.protocol === 'file:'
  ? 'https://limber-steel.vercel.app'
  : '';

const TONE_INPUT_LABELS = {
  neutral: '중립',
  formal: '격식체',
  casual: '구어체',
};

const TONE_INPUT_VALUES = {
  neutral: 'neutral',
  formal: 'formal',
  casual: 'casual',
  '중립': 'neutral',
  '격식체': 'formal',
  '구어체': 'casual',
};

const FORMAT_INPUT_VALUES = {
  text: 'text',
  image: 'image',
  audio: 'audio',
  video: 'video',
  object3d: 'object3d',
  space: 'space',
  translate: 'text',
  explain: 'text',
  summarize: 'text',
  bullets: 'text',
  rewrite: 'text',
  '텍스트': 'text',
  '텍스트 생성': 'text',
  '번역': 'text',
  '설명': 'text',
  '설명/해석': 'text',
  '요약': 'text',
  '불릿': 'text',
  '불릿포인트': 'text',
  '재작성': 'text',
  '이미지': 'image',
  '이미지 생성': 'image',
  '음성': 'audio',
  '음성 생성': 'audio',
  '동영상': 'video',
  '동영상 생성': 'video',
  '3D': 'object3d',
  '3D 오브젝트': 'object3d',
  '공간': 'space',
};

const CONTROL_LABELS = {
  format: {
    text: '텍스트 생성',
    image: '이미지 생성',
    audio: '음성 생성',
    video: '동영상 생성',
    object3d: '3D 오브젝트',
    space: '공간',
  },
  lang: {
    ko: '한국어',
    en: 'English',
    ja: '日本語',
    zh: '中文',
    es: 'Español',
  },
};

// Node canvas state
const nodeMap = new Map();
let nodeIdSeq = 0;
let canvasTx = { x: 0, y: 0, scale: 1 };
let isPanning = false;
let panAnchor = { x: 0, y: 0 };

// ===== DOM REFS =====
const $ = id => document.getElementById(id);

const splitView        = $('split-view');
const nodeView         = $('node-view');
const splitBtn         = $('split-btn');
const nodeBtn          = $('node-btn');
const settingsBtn      = $('settings-btn');
const authLogout       = $('auth-logout');
const authGate         = $('auth-gate');
const authForm         = $('auth-form');
const authPassword     = $('auth-password');
const authError        = $('auth-error');
const settingsPanel    = $('settings-panel');
const settingsBackdrop = $('settings-backdrop');
const closeSettings    = $('close-settings');
const inputText        = $('input-text');
const inputBody        = $('input-body');
const dropOverlay      = $('drop-overlay');
const imagePreviewWrap = $('image-preview-wrap');
const imagePreview     = $('image-preview');
const removeImage      = $('remove-image');
const clearInput       = $('clear-input');
const translateBtn     = $('translate-btn');
const outFormat        = $('out-format');
const formatCombo      = $('format-combo');
const outFormatBtn     = $('out-format-btn');
const outFormatMenu    = $('out-format-menu');
const outTone          = $('out-tone');
const toneCombo        = $('tone-combo');
const toneMenuBtn      = $('tone-menu-btn');
const toneMenu         = $('tone-menu');
const outLang          = $('out-lang');
const outLangBtn       = $('out-lang-btn');
const outLangMenu      = $('out-lang-menu');
const outputPlaceholder= $('output-placeholder');
const outputText       = $('output-text');
const outputImageWrap  = $('output-image-wrap');
const outputImageEl    = $('output-image');
const outputImagePrompt= $('output-image-prompt');
const imageLoading     = $('image-loading');
const outputVideoWrap  = $('output-video-wrap');
const outputVideoEl    = $('output-video');
const outputVideoPrompt= $('output-video-prompt');
const outputThreeWrap  = $('output-three-wrap');
const outputThreeView  = $('output-three-view');
const outputThreeTitle = $('output-three-title');
const outputThreeHint  = $('output-three-hint');
const videoLoading     = $('video-loading');
const videoElapsed     = $('video-elapsed');
const outputAudioWrap  = $('output-audio-wrap');
const outputAudioText  = $('output-audio-text');
const audioGenerating  = $('audio-generating');
const audioPlayer      = $('audio-player');
const speakBtn         = $('speak-btn');
const skeletonWrap     = $('skeleton-wrap');
const copyOutput       = $('copy-output');
const downloadOutput   = $('download-output');
const nodeCanvas       = $('node-canvas');
const connectionsSvg   = $('connections-svg');
const addRootNode      = $('add-root-node');
const resetViewBtn     = $('reset-view-btn');
const nodeEmptyState   = $('node-empty-state');
const defaultFormat    = $('default-format');
const defaultTone      = $('default-tone');
const defaultLang      = $('default-lang');
const toastEl          = $('toast');

// ===== INIT =====
function init() {
  bindAuthGate();
  loadPersistedSettings();
  bindModeToggle();
  bindSettingsPanel();
  bindFormatMenu();
  bindCustomSelect(outLang, outLangBtn, outLangMenu, CONTROL_LABELS.lang);
  bindToneMenu();
  bindSplitInput();
  bindSplitTranslate();
  bindSpeakButton();
  bindNodeCanvas();
  bindNodeToolbar();
}

// ===== ACCESS GATE =====
function getAccessPassword() {
  return accessPassword;
}

function apiHeaders(extra) {
  const headers = Object.assign({}, extra);
  const password = getAccessPassword();
  if (password) headers['X-Limber-Password'] = password;
  return headers;
}

function apiUrl(path) {
  return API_BASE_URL + path;
}

async function assertApiOk(res) {
  if (res.ok) return;
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    accessPassword = '';
    showAuthGate('비밀번호를 다시 확인해주세요');
    throw new Error('비밀번호 확인 필요');
  }
  throw new Error(body.error || `HTTP ${res.status}`);
}

function bindAuthGate() {
  if (!authGate || !authForm) return;

  authForm.addEventListener('submit', e => {
    e.preventDefault();
    const password = authPassword.value.trim();
    if (!password) {
      authError.textContent = '비밀번호를 입력해주세요';
      authPassword.focus();
      return;
    }
    accessPassword = password;
    hideAuthGate();
    showToast('잠금 해제됨');
  });

  if (authLogout) {
    authLogout.addEventListener('click', () => {
      accessPassword = '';
      showAuthGate('잠겼습니다');
    });
  }

  showAuthGate();
}

function showAuthGate(message) {
  authGate.hidden = false;
  authError.textContent = message || '';
  authPassword.value = '';
  requestAnimationFrame(() => authPassword.focus());
}

function hideAuthGate() {
  authGate.hidden = true;
  authError.textContent = '';
}

// ===== SETTINGS PERSISTENCE =====
function loadPersistedSettings() {
  const fmt  = normalizeStoredFormat(localStorage.getItem('limber_format') || 'text');
  const tone = localStorage.getItem('limber_tone')   || 'neutral';
  const lang = localStorage.getItem('limber_lang')   || 'ko';

  outFormat.value = formatInputValue(fmt);
  outTone.value   = toneInputValue(tone);
  setCustomSelectValue(outLang, outLangBtn, CONTROL_LABELS.lang, lang);
  if (defaultFormat) defaultFormat.value = fmt;
  if (defaultTone)   defaultTone.value   = tone;
  if (defaultLang)   defaultLang.value   = lang;
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

  if (defaultFormat) {
    defaultFormat.addEventListener('change', () => {
      localStorage.setItem('limber_format', defaultFormat.value);
      outFormat.value = formatInputValue(defaultFormat.value);
    });
  }
  if (defaultTone) {
    defaultTone.addEventListener('change', () => {
      localStorage.setItem('limber_tone', defaultTone.value);
      outTone.value = toneInputValue(defaultTone.value);
    });
  }
  if (defaultLang) {
    defaultLang.addEventListener('change', () => {
      localStorage.setItem('limber_lang', defaultLang.value);
      setCustomSelectValue(outLang, outLangBtn, CONTROL_LABELS.lang, defaultLang.value);
    });
  }
}

function formatInputValue(format) {
  return CONTROL_LABELS.format[normalizeStoredFormat(format)] || format || CONTROL_LABELS.format.text;
}

function resolveFormatInput(value) {
  const raw = value.trim();
  const format = FORMAT_INPUT_VALUES[raw];
  if (format) return { format, customFormat: '' };
  return { format: 'custom', customFormat: raw };
}

function normalizeStoredFormat(format) {
  return FORMAT_INPUT_VALUES[format] || format || 'text';
}

function bindFormatMenu() {
  if (!outFormatBtn || !outFormatMenu || !formatCombo) return;

  outFormatBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleFormatMenu(true);
    outFormat.focus();
  });

  outFormatMenu.addEventListener('click', e => {
    const option = e.target.closest('[data-select-value]');
    if (!option) return;
    outFormat.value = formatInputValue(option.dataset.selectValue);
    toggleFormatMenu(false);
    outFormat.focus();
  });

  outFormat.addEventListener('focus', () => toggleFormatMenu(true));
  outFormat.addEventListener('keydown', e => {
    if (e.key === 'Escape') toggleFormatMenu(false);
  });

  document.addEventListener('click', e => {
    if (!formatCombo.contains(e.target)) toggleFormatMenu(false);
  });
}

function toggleFormatMenu(open) {
  outFormatMenu.hidden = !open;
  outFormatBtn.setAttribute('aria-expanded', String(open));
}

function bindCustomSelect(input, button, menu, labels) {
  if (!input || !button || !menu) return;

  button.addEventListener('click', e => {
    e.stopPropagation();
    toggleCustomSelect(menu, button, menu.hidden);
  });

  menu.addEventListener('click', e => {
    const option = e.target.closest('[data-select-value]');
    if (!option) return;
    setCustomSelectValue(input, button, labels, option.dataset.selectValue);
    toggleCustomSelect(menu, button, false);
  });

  button.addEventListener('keydown', e => {
    if (e.key === 'Escape') toggleCustomSelect(menu, button, false);
  });

  document.addEventListener('click', e => {
    if (!menu.parentElement.contains(e.target)) toggleCustomSelect(menu, button, false);
  });
}

function setCustomSelectValue(input, button, labels, value) {
  input.value = value;
  const label = labels[value] || value;
  button.querySelector('span').textContent = label;
}

function toggleCustomSelect(menu, button, open) {
  document.querySelectorAll('.select-menu').forEach(otherMenu => {
    if (otherMenu !== menu) {
      otherMenu.hidden = true;
      const otherButton = otherMenu.parentElement.querySelector('.select-display');
      if (otherButton) otherButton.setAttribute('aria-expanded', 'false');
    }
  });
  menu.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
}

function toneInputValue(tone) {
  return TONE_INPUT_LABELS[tone] || tone || TONE_INPUT_LABELS.neutral;
}

function resolveToneInput(value) {
  const raw = value.trim();
  const tone = TONE_INPUT_VALUES[raw];
  if (tone) return { tone, customStyle: '' };
  return { tone: 'neutral', customStyle: raw };
}

function bindToneMenu() {
  if (!toneMenuBtn || !toneMenu || !toneCombo) return;

  toneMenuBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleToneMenu(toneMenu.hidden);
  });

  toneMenu.addEventListener('click', e => {
    const preset = e.target.closest('[data-tone-preset]');
    if (!preset) return;
    outTone.value = preset.dataset.tonePreset;
    toggleToneMenu(false);
    outTone.focus();
  });

  outTone.addEventListener('focus', () => toggleToneMenu(true));
  outTone.addEventListener('keydown', e => {
    if (e.key === 'Escape') toggleToneMenu(false);
  });

  document.addEventListener('click', e => {
    if (!toneCombo.contains(e.target)) toggleToneMenu(false);
  });
}

function toggleToneMenu(open) {
  toneMenu.hidden = !open;
  toneMenuBtn.setAttribute('aria-expanded', String(open));
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

  function handleDragEnter(e) {
    e.preventDefault();
    if (hasFiles(e.dataTransfer)) dropOverlay.classList.add('active');
  }
  function handleDragOver(e)  { e.preventDefault(); }
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

    setSplitLoading(true);
    try {
      const formatPayload = resolveFormatInput(outFormat.value);
      const fmt = formatPayload.format;
      const tonePayload = resolveToneInput(outTone.value);
      const result = await callChat({
        text,
        imageBase64: splitImage.base64,
        imageType:   splitImage.type,
        format: fmt,
        customFormat: formatPayload.customFormat,
        tone:   tonePayload.tone,
        lang:   outLang.value,
        customStyle: tonePayload.customStyle,
      });

      if (fmt === 'image') {
        await showSplitImage(result);
      } else if (fmt === 'audio') {
        await showSplitAudio(result);
      } else if (fmt === 'video') {
        await showSplitVideo(result);
      } else if (fmt === 'object3d') {
        await showSplitGeneratedObject(result);
      } else if (fmt === 'space') {
        await showSplitGeneratedSpace(result);
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
    if (resolveFormatInput(outFormat.value).format === 'image') {
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
    outputVideoWrap.hidden = true;
    outputThreeWrap.hidden = true;
    imageLoading.hidden    = true;
    videoLoading.hidden    = true;
    clearThreeOutput();
    speakBtn.disabled      = true;
    stopSpeaking();
    stopVideoTimer();
  }
}

function showSplitOutput(text) {
  setSplitLoading(false);
  outputPlaceholder.hidden = true;
  outputText.textContent = text;
  outputText.hidden      = false;
  outputImageWrap.hidden = true;
  outputAudioWrap.hidden = true;
  outputVideoWrap.hidden = true;
  outputThreeWrap.hidden = true;
  clearThreeOutput();
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
      utt.onend  = () => speakBtn.classList.remove('speaking');
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

// ===== IMAGE OUTPUT (DALL-E 3) =====
async function showSplitImage(prompt) {
  skeletonWrap.hidden      = true;
  outputText.hidden        = true;
  outputImageWrap.hidden   = true;
  outputThreeWrap.hidden   = true;
  clearThreeOutput();
  outputPlaceholder.hidden = true;
  imageLoading.hidden      = false;
  translateBtn.disabled    = true;

  try {
    const res = await fetch(apiUrl('/api/generate-image'), {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prompt }),
    });
    await assertApiOk(res);
    const { url, revisedPrompt } = await res.json();

    outputImagePrompt.textContent = revisedPrompt || prompt;

    await new Promise((resolve, reject) => {
      function onLoad() {
        outputImageEl.removeEventListener('load',  onLoad);
        outputImageEl.removeEventListener('error', onError);
        resolve();
      }
      function onError() {
        outputImageEl.removeEventListener('load',  onLoad);
        outputImageEl.removeEventListener('error', onError);
        reject(new Error('이미지 로드 실패'));
      }
      outputImageEl.addEventListener('load',  onLoad);
      outputImageEl.addEventListener('error', onError);
      outputImageEl.src = url;
    });

    imageLoading.hidden    = false;
    outputImageWrap.hidden = false;
  } catch (err) {
    showToast('이미지 생성 오류: ' + (err.message || ''));
    outputPlaceholder.hidden = false;
  } finally {
    imageLoading.hidden   = true;
    translateBtn.disabled = false;
  }
}

// ===== AUDIO OUTPUT (OpenAI TTS HD) =====
async function showSplitAudio(text) {
  setSplitLoading(false);
  outputPlaceholder.hidden = true;
  outputText.hidden        = true;
  outputImageWrap.hidden   = true;
  outputVideoWrap.hidden   = true;
  outputThreeWrap.hidden   = true;
  clearThreeOutput();
  outputAudioText.textContent = text;
  outputAudioWrap.hidden      = false;
  audioGenerating.hidden      = false;
  audioPlayer.hidden          = true;
  speakBtn.disabled           = false;

  try {
    const res = await fetch(apiUrl('/api/generate-audio'), {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text, lang: outLang.value }),
    });
    await assertApiOk(res);

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    audioPlayer.src    = blobUrl;
    audioGenerating.hidden = true;
    audioPlayer.hidden     = false;
  } catch (err) {
    audioGenerating.hidden = true;
    showToast('음성 생성 오류: ' + (err.message || ''));
  }
}

// ===== 3D / SPACE OUTPUT (Three.js) =====
function showSplitThree(rawSpec, mode) {
  setSplitLoading(false);
  outputPlaceholder.hidden = true;
  outputText.hidden        = true;
  outputImageWrap.hidden   = true;
  outputAudioWrap.hidden   = true;
  outputVideoWrap.hidden   = true;
  outputThreeWrap.hidden   = false;
  speakBtn.disabled        = true;

  const spec = parseSceneSpec(rawSpec, mode);
  outputThreeTitle.textContent = spec.title || (mode === 'space' ? '공간' : '3D 오브젝트');
  outputThreeHint.textContent = mode === 'space'
    ? '드래그로 좌우상하 둘러보기'
    : '드래그로 회전, 휠로 확대/축소';

  clearThreeOutput();
  if (!window.THREE) {
    outputThreeView.textContent = '3D 렌더러를 불러오지 못했습니다.';
    return;
  }

  activeThreeCleanup = mode === 'space'
    ? renderSpaceScene(outputThreeView, spec)
    : renderObjectScene(outputThreeView, spec);
}

async function showSplitGeneratedObject(prompt) {
  const progress = prepareThreeLoading('실제 3D 오브젝트 생성 중', 'Meshy가 GLB 모델을 만들고 있습니다. 보통 3-8분 정도 소요됩니다.');
  progress.update({ percent: 2, status: '작업 요청 준비 중', detail: '프롬프트를 3D 생성 서버로 보내고 있습니다.' });
  try {
    const startRes = await fetch(apiUrl('/api/generate-3d'), {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prompt }),
    });
    await assertApiOk(startRes);
    const { id } = await startRes.json();
    progress.update({ percent: 5, status: '작업 접수 완료', detail: `작업 ID ${String(id).slice(0, 8)}... 대기열에 들어갔습니다.` });

    const deadline = Date.now() + 12 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 6000));
      const statusRes = await fetch(apiUrl(`/api/3d-status?id=${encodeURIComponent(id)}`), {
        headers: apiHeaders(),
      });
      await assertApiOk(statusRes);
      const status = await statusRes.json();

      progress.update({
        percent: Math.max(5, Math.min(99, status.progress || 0)),
        status: formatMeshyStatus(status.status),
        detail: '형태 생성, 텍스처 구성, GLB 패키징을 순서대로 처리 중입니다.',
      });
      if (status.status === 'SUCCEEDED' && !status.url) {
        throw new Error('Meshy 생성은 완료됐지만 GLB 파일 URL을 받지 못했습니다. 다시 시도해주세요.');
      }
      if (status.status === 'SUCCEEDED' && status.url) {
        progress.update({ percent: 100, status: 'GLB 모델 준비 완료', detail: '브라우저 렌더러로 불러오는 중입니다.' });
        outputThreeTitle.textContent = '3D 오브젝트';
        outputThreeHint.textContent = '드래그로 회전, 휠로 확대/축소';
        clearThreeOutput();
        activeThreeCleanup = renderGlbObject(outputThreeView, status.url);
        translateBtn.disabled = false;
        return;
      }
      if (status.status === 'FAILED') throw new Error(status.error || '3D 생성 실패');
      if (status.status === 'EXPIRED') throw new Error('Meshy 작업이 만료되었습니다. 다시 생성해주세요.');
    }
    throw new Error('시간 초과 (12분)');
  } catch (err) {
    translateBtn.disabled = false;
    progress.fail(err.message || '3D 생성 오류');
    outputThreeHint.textContent = err.message || '3D 생성 오류';
    showToast('3D 생성 오류: ' + (err.message || ''));
  }
}

async function showSplitGeneratedSpace(prompt) {
  const progress = prepareThreeLoading('360 공간 생성 중', '이미지 모델이 파노라마 공간을 만들고 있습니다.');
  progress.update({ percent: 15, status: '파노라마 생성 요청 중', detail: '360도 공간 텍스처를 만들고 있습니다.' });
  try {
    const res = await fetch(apiUrl('/api/generate-image'), {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prompt }),
    });
    await assertApiOk(res);
    const { url } = await res.json();
    progress.update({ percent: 90, status: '공간 이미지 준비 완료', detail: '3D 파노라마 구에 텍스처를 입히는 중입니다.' });
    outputThreeTitle.textContent = '공간';
    outputThreeHint.textContent = '드래그로 좌우상하 둘러보기';
    clearThreeOutput();
    activeThreeCleanup = renderPanoramaImage(outputThreeView, url);
    translateBtn.disabled = false;
  } catch (err) {
    translateBtn.disabled = false;
    progress.fail(err.message || '공간 생성 오류');
    outputThreeHint.textContent = err.message || '공간 생성 오류';
    showToast('공간 생성 오류: ' + (err.message || ''));
  }
}

function prepareThreeLoading(title, hint) {
  setSplitLoading(false);
  outputPlaceholder.hidden = true;
  outputText.hidden        = true;
  outputImageWrap.hidden   = true;
  outputAudioWrap.hidden   = true;
  outputVideoWrap.hidden   = true;
  outputThreeWrap.hidden   = false;
  speakBtn.disabled        = true;
  translateBtn.disabled    = true;
  clearThreeOutput();
  outputThreeView.innerHTML = `
    <div class="three-loading">
      <div class="three-loading-panel">
        <div class="image-spinner"></div>
        <p class="three-loading-status">준비 중</p>
        <div class="three-progress-track">
          <div class="three-progress-bar" style="width:0%"></div>
        </div>
        <p class="three-progress-meta">0% · 0:00 경과</p>
        <p class="three-loading-detail">생성 작업을 준비하고 있습니다.</p>
      </div>
    </div>`;
  outputThreeTitle.textContent = title;
  outputThreeHint.textContent = hint;
  return makeThreeProgressController();
}

function makeThreeProgressController() {
  const startedAt = Date.now();
  const statusEl = outputThreeView.querySelector('.three-loading-status');
  const barEl = outputThreeView.querySelector('.three-progress-bar');
  const metaEl = outputThreeView.querySelector('.three-progress-meta');
  const detailEl = outputThreeView.querySelector('.three-loading-detail');

  function elapsed() {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  return {
    update({ percent, status, detail }) {
      const value = Math.max(0, Math.min(100, Math.round(percent || 0)));
      if (statusEl && status) statusEl.textContent = status;
      if (barEl) barEl.style.width = `${value}%`;
      if (metaEl) metaEl.textContent = `${value}% · ${elapsed()} 경과`;
      if (detailEl && detail) detailEl.textContent = detail;
      outputThreeHint.textContent = `${status || '생성 중'} · ${value}% · ${elapsed()} 경과`;
    },
    fail(message) {
      if (statusEl) statusEl.textContent = '생성 실패';
      if (detailEl) detailEl.textContent = message;
      if (barEl) barEl.style.width = '100%';
      if (metaEl) metaEl.textContent = `중단됨 · ${elapsed()} 경과`;
    },
  };
}

function formatMeshyStatus(status) {
  return {
    PENDING: '대기열에서 순서 기다리는 중',
    IN_PROGRESS: '3D 형태 생성 중',
    SUCCEEDED: '생성 완료',
    FAILED: '생성 실패',
    EXPIRED: '작업 만료',
  }[status] || `3D 생성 중 (${status || 'processing'})`;
}

function clearThreeOutput() {
  if (activeThreeCleanup) {
    activeThreeCleanup();
    activeThreeCleanup = null;
  }
  if (outputThreeView) outputThreeView.innerHTML = '';
}

function parseSceneSpec(raw, mode) {
  const fallback = {
    title: mode === 'space' ? '상상 공간' : '상상 오브젝트',
    shape: 'crystal',
    sky: 'sunset',
    colors: ['#ff6100', '#f0ece8', '#4f9cff', '#111111'],
    material: 'metal',
    mood: '',
  };
  try {
    const clean = String(raw).replace(/^```json\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(clean);
    return Object.assign(fallback, parsed, {
      colors: Array.isArray(parsed.colors) && parsed.colors.length ? parsed.colors.slice(0, 5) : fallback.colors,
    });
  } catch {
    return fallback;
  }
}

function renderObjectScene(container, spec) {
  const { THREE } = window;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.6, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.PointLight(normalizeColor(spec.colors[2]), 2.2, 12);
  rim.position.set(-3, 2, 3);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);
  const material = makeThreeMaterial(spec);
  const geometry = makeObjectGeometry(spec.shape);
  const main = new THREE.Mesh(geometry, material);
  group.add(main);

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: normalizeColor(spec.colors[1]),
    metalness: 0.35,
    roughness: 0.28,
    emissive: normalizeColor(spec.colors[2]),
    emissiveIntensity: spec.material === 'neon' ? 0.25 : 0.04,
  });
  for (let i = 0; i < 6; i++) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 18, 18), accentMaterial);
    const angle = (Math.PI * 2 * i) / 6;
    bead.position.set(Math.cos(angle) * 1.55, Math.sin(angle * 2) * 0.32, Math.sin(angle) * 1.55);
    group.add(bead);
  }

  return runThreeViewport(container, renderer, scene, camera, group, { orbit: true });
}

function renderSpaceScene(container, spec) {
  const { THREE } = window;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
  camera.position.set(0, 0, 0.01);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const texture = new THREE.CanvasTexture(makePanoramaCanvas(spec));
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(35, 64, 32),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide }),
  );
  scene.add(sphere);

  return runThreeViewport(container, renderer, scene, camera, sphere, { panorama: true });
}

function renderPanoramaImage(container, url) {
  const { THREE } = window;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
  camera.position.set(0, 0, 0.01);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(35, 64, 32),
    new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide }),
  );
  scene.add(sphere);

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  loader.load(url, texture => {
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
    sphere.material.map = texture;
    sphere.material.color.setHex(0xffffff);
    sphere.material.needsUpdate = true;
  }, undefined, () => {
    outputThreeHint.textContent = '파노라마 이미지를 3D 텍스처로 불러오지 못했습니다.';
  });

  return runThreeViewport(container, renderer, scene, camera, sphere, { panorama: true });
}

function renderGlbObject(container, url) {
  const { THREE } = window;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.8, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(3, 5, 4);
  scene.add(key);
  const fill = new THREE.PointLight(0xff6100, 1.4, 10);
  fill.position.set(-3, 2, 3);
  scene.add(fill);

  const group = new THREE.Group();
  scene.add(group);

  const grid = new THREE.GridHelper(4, 12, 0xff6100, 0x333333);
  grid.position.y = -1.25;
  scene.add(grid);

  let alive = true;
  loadGlbModel(url)
    .then(model => {
      if (!alive) return;
      normalizeModel(model);
      group.add(model);
    })
    .catch(err => {
      if (!alive) return;
      outputThreeHint.textContent = err.message || 'GLB 모델을 불러오지 못했습니다.';
    });

  const cleanup = runThreeViewport(container, renderer, scene, camera, group, { orbit: true });
  return () => {
    alive = false;
    cleanup();
  };
}

const GLTF_LOADER_SCRIPT_URL = 'https://unpkg.com/three@0.149.0/examples/js/loaders/GLTFLoader.js';
let gltfLoaderPromise = null;

async function loadGlbModel(url) {
  const Loader = await getGltfLoader();
  return new Promise((resolve, reject) => {
    const loader = new Loader();
    loader.setCrossOrigin?.('anonymous');
    loader.load(url, gltf => {
      if (!gltf.scene) {
        reject(new Error('GLB 파일 안에서 3D 씬을 찾지 못했습니다.'));
        return;
      }
      resolve(gltf.scene);
    }, undefined, err => {
      reject(new Error(err?.message || 'GLB 모델을 불러오지 못했습니다.'));
    });
  });
}

async function getGltfLoader() {
  if (isConstructor(window.THREE?.GLTFLoader)) return window.THREE.GLTFLoader;
  if (!gltfLoaderPromise) {
    gltfLoaderPromise = loadScript(GLTF_LOADER_SCRIPT_URL);
  }
  await gltfLoaderPromise;
  if (isConstructor(window.THREE?.GLTFLoader)) return window.THREE.GLTFLoader;
  throw new Error('GLTFLoader를 초기화하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.');
}

function isConstructor(value) {
  if (typeof value !== 'function') return false;
  try {
    Reflect.construct(String, [], value);
    return true;
  } catch {
    return false;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${src}?v=20260506`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('GLTFLoader 스크립트를 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });
}

function normalizeModel(model) {
  const { THREE } = window;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2.6 / maxDim;
  model.position.sub(center);
  model.scale.setScalar(scale);
}

function makeThreeMaterial(spec) {
  const { THREE } = window;
  const base = normalizeColor(spec.colors[0]);
  const material = spec.material || 'metal';
  return new THREE.MeshStandardMaterial({
    color: base,
    metalness: material === 'metal' ? 0.75 : material === 'glass' ? 0.05 : 0.25,
    roughness: material === 'matte' ? 0.7 : 0.24,
    transparent: material === 'glass',
    opacity: material === 'glass' ? 0.72 : 1,
    emissive: material === 'neon' ? base : '#000000',
    emissiveIntensity: material === 'neon' ? 0.25 : 0,
  });
}

function makeObjectGeometry(shape) {
  const { THREE } = window;
  const kind = String(shape || '').toLowerCase();
  if (kind === 'sphere') return new THREE.SphereGeometry(1.25, 48, 32);
  if (kind === 'box') return new THREE.BoxGeometry(1.8, 1.8, 1.8, 5, 5, 5);
  if (kind === 'torus') return new THREE.TorusKnotGeometry(0.9, 0.28, 140, 18);
  if (kind === 'tower') return new THREE.ConeGeometry(0.85, 2.5, 6, 4);
  if (kind === 'vehicle') return new THREE.CapsuleGeometry(0.72, 1.2, 8, 24);
  return new THREE.IcosahedronGeometry(1.35, 1);
}

function runThreeViewport(container, renderer, scene, camera, subject, options) {
  let raf = 0;
  let dragging = false;
  let last = { x: 0, y: 0 };
  let yaw = 0;
  let pitch = 0;
  let distance = 6;
  let autoSpin = 0;

  function resize() {
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / Math.max(rect.height, 1);
    camera.updateProjectionMatrix();
  }

  function onPointerDown(e) {
    dragging = true;
    last = { x: e.clientX, y: e.clientY };
    container.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    yaw += dx * 0.008;
    pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.006));
  }
  function onPointerUp(e) {
    dragging = false;
    if (container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId);
  }
  function onWheel(e) {
    if (!options.orbit) return;
    e.preventDefault();
    distance = Math.max(3.2, Math.min(9, distance + e.deltaY * 0.006));
  }
  function animate() {
    if (options.panorama) {
      camera.rotation.order = 'YXZ';
      camera.rotation.y = -yaw;
      camera.rotation.x = -pitch;
    } else {
      autoSpin += 0.006;
      subject.rotation.x = pitch;
      subject.rotation.y = autoSpin + yaw;
      camera.position.z = distance;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  }

  resize();
  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerUp);
  container.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', resize);
  animate();

  return () => {
    cancelAnimationFrame(raf);
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerUp);
    container.removeEventListener('wheel', onWheel);
    window.removeEventListener('resize', resize);
    renderer.dispose();
  };
}

function makePanoramaCanvas(spec) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const colors = spec.colors || ['#10121f', '#ff8a3d', '#4f9cff', '#050505'];
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, normalizeColor(colors[0]));
  grad.addColorStop(0.52, normalizeColor(colors[1] || colors[0]));
  grad.addColorStop(1, normalizeColor(colors[3] || '#070707'));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const horizonY = canvas.height * 0.58;
  ctx.fillStyle = hexToRgba(colors[2] || '#ffffff', 0.18);
  for (let i = 0; i < 9; i++) {
    const x = i * 260 - 80;
    const h = 90 + (i % 4) * 42;
    ctx.fillRect(x, horizonY - h, 180, h);
  }
  ctx.fillStyle = hexToRgba('#ffffff', spec.sky === 'night' ? 0.75 : 0.28);
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height * 0.46;
    const r = Math.random() * 2.2 + 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = hexToRgba(colors[1] || '#ff6100', 0.65);
  ctx.beginPath();
  ctx.arc(canvas.width * 0.72, canvas.height * 0.32, 86, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

function normalizeColor(value) {
  const color = String(value || '#ff6100').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#ff6100';
}

function hexToRgba(hex, alpha) {
  const safe = normalizeColor(hex).slice(1);
  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ===== VIDEO OUTPUT (Sora 2) =====
let videoTimerId = null;

function startVideoTimer() {
  const start = Date.now();
  videoElapsed.textContent = '0:00 경과';
  videoTimerId = setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    videoElapsed.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} 경과`;
  }, 1000);
}

function stopVideoTimer() {
  clearInterval(videoTimerId);
  videoTimerId = null;
}

async function showSplitVideo(prompt) {
  skeletonWrap.hidden      = true;
  outputPlaceholder.hidden = true;
  outputVideoWrap.hidden   = true;
  outputThreeWrap.hidden   = true;
  clearThreeOutput();
  videoLoading.hidden      = false;
  translateBtn.disabled    = true;
  startVideoTimer();

  try {
    const startRes = await fetch(apiUrl('/api/generate-video'), {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prompt }),
    });
    await assertApiOk(startRes);
    const { id } = await startRes.json();

    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(apiUrl(`/api/video-status?id=${encodeURIComponent(id)}`), {
        headers: apiHeaders(),
      });
      await assertApiOk(statusRes);
      const status    = await statusRes.json();

      if (status.status === 'completed') {
        const url = await fetchVideoObjectUrl(id);
        stopVideoTimer();
        outputVideoPrompt.textContent = prompt;
        outputVideoEl.src             = url;
        videoLoading.hidden           = true;
        outputVideoWrap.hidden        = false;
        translateBtn.disabled         = false;
        return;
      }
      if (status.status === 'failed') throw new Error(status.error || '동영상 생성 실패');
    }
    throw new Error('시간 초과 (10분)');
  } catch (err) {
    stopVideoTimer();
    videoLoading.hidden      = true;
    outputPlaceholder.hidden = false;
    translateBtn.disabled    = false;
    showToast('동영상 생성 오류: ' + (err.message || ''));
  }
}

async function fetchVideoObjectUrl(id) {
  const res = await fetch(apiUrl(`/api/video-content?id=${encodeURIComponent(id)}`), {
    headers: apiHeaders(),
  });
  await assertApiOk(res);
  return URL.createObjectURL(await res.blob());
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

// ===== API =====
async function callChat({ text, imageBase64, imageType, format, customFormat, tone, lang, customStyle }) {
  const res = await fetch(apiUrl('/api/chat'), {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text, imageBase64, imageType, format, customFormat, tone, lang, customStyle }),
  });
  await assertApiOk(res);
  const data = await res.json();
  return data.result;
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
    const next   = Math.max(0.25, Math.min(3, canvasTx.scale * factor));
    const rect   = nv.getBoundingClientRect();
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
    format: normalizeStoredFormat(localStorage.getItem('limber_format') || 'text'),
    tone:   localStorage.getItem('limber_tone')   || 'neutral',
    lang:   localStorage.getItem('limber_lang')   || 'ko',
    output: '',
  };
  nodeMap.set(id, data);
  renderNodeCard(data);
  updateEmptyState();
  requestAnimationFrame(redrawConnections);
  return id;
}

const FORMAT_LABELS = { text: '텍스트 생성', image: '이미지', audio: '음성', video: '동영상', object3d: '3D', space: '공간' };

function renderNodeCard(data) {
  const { id, x, y, input, format, tone, lang, output } = data;

  const card = document.createElement('div');
  card.className = 'node-card node-pair';
  card.id = 'nc-' + id;
  card.style.cssText = `left:${x}px;top:${y}px`;

  card.innerHTML = `
    <div class="node-subcard node-input-card">
      <div class="node-header" data-drag="${id}">
        <span class="node-kind">Input</span>
        <button class="node-close-btn" data-close="${id}" title="삭제">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M8 2L2 8M2 2l6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="node-body">
        <textarea class="node-textarea" data-ta="${id}" placeholder="텍스트 입력 또는 이미지 드래그" spellcheck="false">${escHtml(input)}</textarea>
        <input type="text" class="node-custom-style" data-cst="${id}" placeholder="말투 직접 입력 (예: 오은영 말투, ISTP 말투)">
        <div class="node-selects">
          <select class="node-select" data-sel="${id}" data-field="format">
            <option value="text"      ${format==='text'     ?'selected':''}>텍스트 생성</option>
            <option value="image"     ${format==='image'    ?'selected':''}>이미지</option>
            <option value="audio"     ${format==='audio'    ?'selected':''}>음성</option>
            <option value="video"     ${format==='video'    ?'selected':''}>동영상</option>
            <option value="object3d"  ${format==='object3d' ?'selected':''}>3D</option>
            <option value="space"     ${format==='space'    ?'selected':''}>공간</option>
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
          <button class="node-btn node-btn-translate" data-tr="${id}">번역</button>
        </div>
      </div>
    </div>
    <div class="node-link" aria-hidden="true">
      <span class="node-port node-port-output"></span>
      <span class="node-link-line"></span>
      <span class="node-port node-port-input"></span>
    </div>
    <div class="node-subcard node-result-card">
      <div class="node-header" data-drag="${id}">
        <span class="node-badge" id="nb-${id}">${FORMAT_LABELS[format]}</span>
      </div>
      <div class="node-body">
        <div class="node-output ${output ? '' : 'is-empty'}" id="no-${id}">${output ? escHtml(output) : '결과가 여기에 표시됩니다'}</div>
        <div class="node-actions">
          <button class="node-btn node-btn-branch" data-br="${id}">Branch +</button>
          <button class="node-btn node-btn-copy" data-cp="${id}" title="복사">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="4" y="4" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.3"/>
              <path d="M8 4V2.5A.5.5 0 007.5 2h-5a.5.5 0 00-.5.5v5a.5.5 0 00.5.5H4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;

  nodeCanvas.appendChild(card);
  attachNodeEvents(card, id);
}

function attachNodeEvents(card, id) {
  card.addEventListener('mousedown', e => e.stopPropagation());

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

  card.addEventListener('click', e => {
    if (e.target.closest(`[data-close="${id}"]`)) { deleteNode(id); return; }
    if (e.target.closest(`[data-tr="${id}"]`))    { runNodeTranslate(id); return; }
    if (e.target.closest(`[data-br="${id}"]`))    { branchFromNode(id); return; }
    if (e.target.closest(`[data-cp="${id}"]`))    {
      const d = nodeMap.get(id);
      if (d && d.output) navigator.clipboard.writeText(d.output).then(() => showToast('복사됨'));
    }
  });

  card.addEventListener('change', e => {
    const sel = e.target.closest(`[data-sel]`);
    if (!sel) return;
    const d = nodeMap.get(id);
    if (!d) return;
    d[sel.dataset.field] = sel.value;
    if (sel.dataset.field === 'format') {
      document.getElementById('nb-' + id).textContent = FORMAT_LABELS[sel.value] || sel.value;
    }
  });

  card.addEventListener('input', e => {
    const ta = e.target.closest(`[data-ta]`);
    if (!ta) return;
    const d = nodeMap.get(id);
    if (d) d.input = ta.value;
  });

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
  if (!d.input && !d.image.base64) { showToast('텍스트 또는 이미지를 입력해주세요'); return; }

  const card = document.getElementById('nc-' + id);
  const trBtn = document.querySelector(`[data-tr="${id}"]`);
  const outEl = document.getElementById('no-' + id);
  const cstInput = card ? card.querySelector('[data-cst]') : null;
  if (!trBtn || !outEl) return;

  trBtn.disabled = true;
  trBtn.textContent = '처리 중...';
  outEl.innerHTML = '';
  outEl.className = 'node-output is-empty';

  try {
    const result = await callChat({
      text: d.input, imageBase64: d.image.base64, imageType: d.image.type,
      format: d.format, tone: d.tone, lang: d.lang,
      customStyle: cstInput ? cstInput.value.trim() : '',
    });
    d.output = result;

    if (d.format === 'object3d' || d.format === 'space') {
      const spec = parseSceneSpec(result, d.format);
      outEl.textContent = `${spec.title}\n${spec.mood || 'Split 뷰에서 인터랙티브 3D로 확인할 수 있습니다.'}`;
      outEl.className = 'node-output';
    } else if (d.format === 'image') {
      outEl.className = 'node-output';
      outEl.textContent = '이미지 생성 중...';
      const imgRes = await fetch(apiUrl('/api/generate-image'), {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prompt: result }),
      });
      await assertApiOk(imgRes);
      const { url } = await imgRes.json();
      const img = document.createElement('img');
      img.style.cssText = 'width:100%;border-radius:6px;display:block;margin-top:4px';
      img.alt = '생성된 이미지';
      img.src = url;
      outEl.innerHTML = '';
      outEl.appendChild(img);
    } else if (d.format === 'audio') {
      outEl.className = 'node-output';
      outEl.textContent = '음성 생성 중...';
      const audioRes = await fetch(apiUrl('/api/generate-audio'), {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ text: result, lang: d.lang }),
      });
      await assertApiOk(audioRes);
      const blob    = await audioRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      outEl.innerHTML = `<p style="font-size:12px;line-height:1.6;margin-bottom:8px">${escHtml(result)}</p>
        <audio controls preload="auto" style="width:100%;height:32px;border-radius:6px;accent-color:var(--primary)" src="${blobUrl}"></audio>`;
    } else if (d.format === 'video') {
      outEl.className   = 'node-output';
      outEl.textContent = '동영상 생성 중... (2–5분 소요)';
      const startRes = await fetch(apiUrl('/api/generate-video'), {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prompt: result }),
      });
      await assertApiOk(startRes);
      const { id: jobId } = await startRes.json();

      const deadline = Date.now() + 10 * 60 * 1000;
      let completed = false;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await fetch(apiUrl(`/api/video-status?id=${encodeURIComponent(jobId)}`), {
          headers: apiHeaders(),
        });
        await assertApiOk(statusRes);
        const status    = await statusRes.json();
        if (status.status === 'completed') {
          const url = await fetchVideoObjectUrl(jobId);
          outEl.innerHTML = `<video controls playsinline src="${url}"
            style="width:100%;border-radius:6px;display:block;max-height:200px;background:#000"></video>`;
          completed = true;
          break;
        }
        if (status.status === 'failed') throw new Error(status.error || '동영상 생성 실패');
      }
      if (!completed) throw new Error('시간 초과 (10분)');
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
    trBtn.textContent = '번역';
  }
}

// ===== NODE BRANCH =====
function branchFromNode(parentId) {
  const parent = nodeMap.get(parentId);
  if (!parent) return;
  const sibCount = [...nodeMap.values()].filter(n => n.parentId === parentId).length;
  spawnNode(parentId, parent.x + 780, parent.y + sibCount * 220, parent.output || '');
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
    const pOut = cardEdgePoint(parent, parentCard, 'right');
    const cIn  = cardEdgePoint(nd, childCard, 'left');
    const dx   = Math.max(120, Math.abs(cIn.x - pOut.x) * 0.45);
    const pathD = `M${pOut.x},${pOut.y} C${pOut.x + dx},${pOut.y} ${cIn.x - dx},${cIn.y} ${cIn.x},${cIn.y}`;
    const path  = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('class', 'conn-path');
    connectionsSvg.appendChild(path);
  });
}

function cardEdgePoint(nd, card, edge) {
  const { scale: s, x: tx, y: ty } = canvasTx;
  const w = card.offsetWidth;
  const h = card.offsetHeight;
  const ax = nd.x * s + tx;
  const ay = nd.y * s + ty;
  if (edge === 'right') return { x: ax + w * s, y: ay + (h / 2) * s };
  if (edge === 'left') return { x: ax, y: ay + (h / 2) * s };
  if (edge === 'bottom') return { x: ax + (w / 2) * s, y: ay + h * s };
  return { x: ax + (w / 2) * s, y: ay };
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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== GO =====
init();
