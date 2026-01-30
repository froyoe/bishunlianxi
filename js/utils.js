// ===== 工具函数 & 音效 =====

// 检查localStorage配额
function checkStorageQuota() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return false;
    }
    return true;
  }
}

// 显示错误提示
let currentErrorDiv = null;
function showError(message, duration = 3000) {
  if (currentErrorDiv) {
    currentErrorDiv.remove();
    currentErrorDiv = null;
  }
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-toast';
  errorDiv.style.cssText = `
    position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
    background: #ff4d4f; color: #fff; padding: 12px 20px;
    border-radius: 8px; z-index: 1000; font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideDown 0.3s ease;
    max-width: 90%; word-wrap: break-word;
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  currentErrorDiv = errorDiv;
  
  setTimeout(() => {
    if (currentErrorDiv === errorDiv) {
      errorDiv.style.animation = 'slideUp 0.3s ease';
      setTimeout(() => {
        if (currentErrorDiv === errorDiv) {
          errorDiv.remove();
          currentErrorDiv = null;
        }
      }, 300);
    }
  }, duration);
}

// 带重试和缓存的网络请求
async function fetchWithRetry(url, retries = 3, delay = 1000) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('请求超时')), 5000);
  });
  
  for (let i = 0; i < retries; i++) {
    try {
      const fetchPromise = fetch(url).then(resp => {
        clearTimeout(timeoutId);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      });
      
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      return result;
    } catch (e) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
}

// ===== 音效引擎 =====
let soundEnabled = localStorage.getItem('bishun_sound') !== 'off';

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
// iOS 需要用户交互才能激活 AudioContext
document.addEventListener('touchstart', ensureAudio, { once: true });
document.addEventListener('click', ensureAudio, { once: true });

function playTone(freq, duration, type, vol, delay) {
  if (!soundEnabled) return;
  const ctx = ensureAudio();
  const t = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol || 0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('bishun_sound', soundEnabled ? 'on' : 'off');
  document.getElementById('soundBtn').innerHTML = soundEnabled ? '&#128264;' : '&#128263;';
  if (soundEnabled) SFX.tap();
}

const SFX = {
  tap() { playTone(800, 0.08, 'sine', 0.15); },
  correct() { playTone(880, 0.12, 'sine', 0.25); playTone(1100, 0.15, 'sine', 0.2, 0.08); },
  wrong() { playTone(300, 0.2, 'triangle', 0.2); playTone(250, 0.25, 'triangle', 0.15, 0.1); },
  perfect() {
    playTone(523, 0.15, 'sine', 0.25);
    playTone(659, 0.15, 'sine', 0.25, 0.12);
    playTone(784, 0.15, 'sine', 0.25, 0.24);
    playTone(1047, 0.3, 'sine', 0.3, 0.36);
  },
  done() { playTone(523, 0.18, 'sine', 0.2); playTone(659, 0.22, 'sine', 0.2, 0.15); },
  ready() { playTone(1047, 0.2, 'sine', 0.15); playTone(1319, 0.25, 'sine', 0.12, 0.12); },
};

// ===== 语音播报 =====
function speak(text, rate) {
  if (!soundEnabled || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = rate || 0.85;
  u.volume = 1;
  speechSynthesis.speak(u);
}

function speakQueue(text, rate) {
  if (!soundEnabled || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = rate || 0.8;
  u.volume = 1;
  speechSynthesis.speak(u);
}
