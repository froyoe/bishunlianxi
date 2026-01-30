// ===== 本地存储管理 =====
const STORAGE_KEY = 'bishun_records';
const STORAGE_VERSION = '1.0';

function loadRecords() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return {};
    const parsed = JSON.parse(data);
    if (parsed._version !== STORAGE_VERSION) {
      // 可以在此添加版本迁移逻辑
    }
    return parsed;
  } catch (e) {
    console.error('读取学习记录失败:', e);
    return {};
  }
}

function saveRecords(r) {
  try {
    if (!checkStorageQuota()) {
      showError('💾 存储空间不足，无法保存学习记录');
      return false;
    }
    r._version = STORAGE_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    return true;
  } catch (e) {
    console.error('保存学习记录失败:', e);
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      showError('💾 存储空间不足，请清理浏览器缓存后重试');
    } else {
      showError('⚠️ 保存失败，请重试');
    }
    return false;
  }
}

function getCharRecord(ch) {
  const r = loadRecords();
  return r[ch] || { attempts: 0, correct: 0 };
}

function recordResult(ch, isCorrect) {
  const r = loadRecords();
  if (!r[ch]) r[ch] = { attempts: 0, correct: 0 };
  r[ch].attempts++;
  if (isCorrect) r[ch].correct++;
  const saved = saveRecords(r);
  if (!saved) {
    // 尝试清理旧数据
    try {
      const allChars = UNITS.flatMap(u => u.lessons.flatMap(l => l.chars.split('')));
      const oldChars = Object.keys(r).filter(k => k !== '_version' && !allChars.includes(k));
      oldChars.forEach(k => delete r[k]);
      saveRecords(r);
    } catch (e) {
      console.error('清理旧数据失败:', e);
    }
  }
}
