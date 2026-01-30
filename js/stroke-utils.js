// ===== 笔画分析与识别 =====

let currentStrokeNames = [];
let strokeSpeechTimers = [];
const strokeCache = new Map();

function clearStrokeSpeech() {
  strokeSpeechTimers.forEach(t => clearTimeout(t));
  strokeSpeechTimers = [];
  if (window.speechSynthesis) speechSynthesis.cancel();
}

async function loadStrokeNames(ch) {
  if (strokeCache.has(ch)) {
    currentStrokeNames = strokeCache.get(ch);
    return;
  }

  try {
    // 使用 jsdelivr CDN 获取 HanziWriter 数据
    const url = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/' + encodeURIComponent(ch) + '.json';
    const data = await fetchWithRetry(url);
    
    // 优先使用权威笔画名称数据
    const officialStrokes = (typeof OFFICIAL_STROKES !== 'undefined' && OFFICIAL_STROKES[ch]) || null;
    
    if (officialStrokes && data.medians && officialStrokes.length === data.medians.length) {
      console.log(`[INFO] 使用权威笔画数据: ${ch}`, officialStrokes);
      currentStrokeNames = officialStrokes;
    } else {
      if (officialStrokes) {
        console.warn(`[WARN] 权威笔画数 (${officialStrokes.length}) 与 HanziWriter 笔画数 (${data.medians && data.medians.length}) 不一致: ${ch}。将回退到算法识别。`);
      }
      currentStrokeNames = data.medians.map(classifyStroke);
    }

    if (strokeCache.size < 100) {
      strokeCache.set(ch, currentStrokeNames);
    }
  } catch (e) {
    console.error('加载笔画数据失败:', e);
    currentStrokeNames = [];
    if (!navigator.onLine) {
      showError('📡 网络未连接，请检查网络后重试');
    } else {
      showError('⚠️ 加载笔画数据失败，请稍后重试');
    }
  }
}

function classifyStroke(median) {
  if (!median || median.length < 2) return '点';

  const tdx = median[median.length - 1][0] - median[0][0];
  const tdy = -(median[median.length - 1][1] - median[0][1]);
  const tlen = Math.sqrt(tdx * tdx + tdy * tdy);
  
  if (tlen < 35 && median.length <= 5) return '点';

  const segments = [];
  for (let i = 1; i < median.length; i++) {
    const dx = median[i][0] - median[i-1][0];
    const dy = -(median[i][1] - median[i-1][1]);
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 15) { 
      segments.push({ dx, dy, len, idx: i });
    }
  }

  if (segments.length === 0) return '点';

  const turns = [];
  for (let i = 1; i < segments.length; i++) {
    const a1 = Math.atan2(segments[i-1].dy, segments[i-1].dx);
    const a2 = Math.atan2(segments[i].dy, segments[i].dx);
    let diff = Math.abs(a2 - a1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    const deg = diff * 180 / Math.PI;
    if (deg > 40) {
      turns.push({ idx: segments[i].idx, angle: deg });
    }
  }

  if (turns.length === 0) {
    return dirName(tdx, tdy, tlen);
  }

  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];
  const d1 = getDirection(firstSeg.dx, firstSeg.dy, false);
  const d2 = getDirection(lastSeg.dx, lastSeg.dy, false);
  
  const isHook = lastSeg.dy < -10 && Math.abs(lastSeg.dx) < Math.abs(lastSeg.dy) * 0.8;
  const isUpward = lastSeg.dy < 0;

  if (isHook || d2 === '提') {
    if (d1 === '竖') {
      if (turns.length >= 2) {
        const midIdx = Math.floor(segments.length / 2);
        const midSeg = segments[midIdx];
        const midDir = getDirection(midSeg.dx, midSeg.dy, false);
        if (midDir === '横') return '竖弯钩';
      }
      if (lastSeg.dx > 15) return '竖提';
      return '竖钩';
    }
    if (d1 === '横') {
      if (turns.length >= 2) return '横折钩';
      return '横钩';
    }
    if (d1 === '撇') {
      if (turns.length >= 2) {
        const midSeg = segments[Math.floor(segments.length / 2)];
        const midDir = getDirection(midSeg.dx, midSeg.dy, false);
        if (midDir === '横') return '撇折';
      }
      return '斜钩';
    }
    if (d1 === '捺') return '卧钩';
    return d1 + '钩';
  }

  if (d1 === '横') {
    if (d2 === '竖') {
      if (turns.length >= 3 && isUpward) return '横折折钩';
      if (turns.length >= 2) return '横折折';
      return '横折';
    }
    if (d2 === '撇') return '横撇';
    if (d2 === '提' || isUpward) return '横钩';
    if (d2 === '捺') {
      if (turns.length >= 2) return '横折折';
      return '横折';
    }
  }

  if (d1 === '竖') {
    if (d2 === '横') {
      if (turns.length >= 3 && isUpward) return '竖折折钩';
      if (turns.length >= 2) return '竖折折';
      return '竖折';
    }
    if (d2 === '横' && turns.length >= 1) {
      if (isHook || isUpward) return '竖弯钩';
      return '竖弯';
    }
    if (d2 === '撇') {
      if (isUpward) return '竖弯钩';
      return '竖弯';
    }
    if (d2 === '提' || isHook) return '竖钩';
  }

  if (d1 === '撇') {
    if (d2 === '横' || d2 === '提') return '撇折';
    if (d2 === '点' || d2 === '捺') return '撇点';
    if (d2 === '竖') return '撇折';
  }

  if (d1 === '捺' && d2 === '点') return '捺点';

  return d1 + '折';
}

function getDirection(dx, dy, useLength = true) {
  const a = Math.atan2(dy, dx) * 180 / Math.PI;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  if (a >= -50 && a < -18) return '提';
  if (a >= -28 && a <= 28) return '横';
  if ((a >= 58 && a <= 122) || (a <= -58 && a >= -122)) return '竖';
  if ((a >= 122 && a <= 180) || (a <= -152 && a >= -180)) return '撇';
  if (a >= 28 && a < 58) {
    if (useLength && len < 200) return '点';
    return '捺';
  }
  if (a >= -18 && a < 28 && useLength && len < 200) return '点';
  
  if (a > 0 && a < 90) return useLength && len < 180 ? '点' : '捺';
  if (a >= 90 || a <= -90) return '撇';
  return '竖';
}

function dirName(dx, dy, len) {
  if (len === undefined) len = Math.sqrt(dx * dx + dy * dy);
  return getDirection(dx, dy, true);
}
