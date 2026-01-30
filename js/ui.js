// ===== UI 渲染与交互 =====

function showNav(show) {
  const m = show ? 'add' : 'remove';
  document.getElementById('backBtn').classList[m]('show');
  document.getElementById('homeBtn').classList[m]('show');
}

function showOnly(id) {
  ['unitList','charPage','practicePage','summaryPage'].forEach(k => {
    document.getElementById(k).classList.add('page-hidden');
  });
  const el = document.getElementById(id);
  el.classList.remove('page-hidden');
  if (id === 'practicePage') el.style.display = 'flex';
  else el.style.display = '';
  el.classList.remove('fade-in');
  void el.offsetWidth;
  el.classList.add('fade-in');
}

function getStars(rec) {
  if (rec.attempts === 0) return '';
  const rate = rec.correct / rec.attempts;
  if (rate >= 0.8) return '⭐⭐⭐';
  if (rate >= 0.5) return '⭐⭐';
  return '⭐';
}

function getStarLabel(rec) {
  if (rec.attempts === 0) return '还没练过';
  const stars = getStars(rec);
  return `${stars} 练了${rec.attempts}次`;
}

function renderUnits() {
  currentView = 'units';
  showNav(false);
  document.getElementById('headerTitle').innerHTML = '&#9997;&#65039; 写字小课堂';
  showOnly('unitList');

  const records = loadRecords();
  document.getElementById('unitList').innerHTML = UNITS.map((u, i) => {
    const allChars = u.lessons.flatMap(l => l.chars.split(''));
    const practiced = allChars.filter(c => records[c] && records[c].attempts > 0).length;
    const pct = allChars.length ? Math.round(practiced / allChars.length * 100) : 0;
    return `<div class="unit-card" onclick="openUnit(${i})">
      <div class="unit-icon" style="background:${u.color}">${u.icon}</div>
      <div style="flex:1">
        <h3>${u.name}</h3>
        <div class="progress-text">已练 ${practiced}/${allChars.length} 个字</div>
        <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      </div>
      <span class="arrow">›</span>
    </div>`;
  }).join('');
}

function openUnit(idx) {
  currentView = 'chars';
  currentUnit = idx;
  const unit = UNITS[idx];
  showNav(true);
  document.getElementById('headerTitle').textContent = unit.icon + ' ' + unit.name;
  showOnly('charPage');

  currentCharList = unit.lessons.flatMap(l => l.chars.split(''));
  const records = loadRecords();
  
  let html = '';
  unit.lessons.forEach(lesson => {
    html += `<div class="lesson-title">${lesson.title}</div><div class="char-grid">`;
    lesson.chars.split('').forEach(ch => {
      const rec = records[ch] || { attempts: 0, correct: 0 };
      const stars = getStars(rec);
      const rate = rec.attempts > 0 ? rec.correct / rec.attempts : -1;
      let cls = '';
      if (rate >= 0.8) cls = 'mastered';
      else if (rate >= 0 && rate < 0.5) cls = 'struggling';
      const dot = DIFFICULT_CHARS.has(ch) ? '<span class="difficult-dot">&#128293;</span>' : '';
      html += `<div class="char-cell ${cls}" onclick="openPractice('${ch}')">
        ${dot}${ch}<span class="stars">${stars}</span></div>`;
    });
    html += '</div>';
  });

  const allChars = unit.lessons.flatMap(l => l.chars.split(''));
  const weakChars = allChars.filter(ch => {
    const rec = records[ch];
    if (!rec || rec.attempts === 0) return false;
    const rate = rec.correct / rec.attempts;
    return rate < 0.5;
  });

  html += `<div class="btn-row" style="margin-top:24px">
    <button class="btn btn-warning btn-small" onclick="showSummary()">&#128202; 看看掌握情况</button>
    ${weakChars.length > 0 ? `<button class="btn btn-danger btn-small" onclick="reviewWeakChars(${JSON.stringify(weakChars).replace(/"/g, '&quot;')})">&#128293; 复习薄弱字 (${weakChars.length})</button>` : ''}
  </div>`;
  document.getElementById('charPage').innerHTML = html;
}

function renderPracticeButtons(state) {
  const el = document.getElementById('practiceButtons');
  let hasNext = false;
  if (reviewMode) {
    hasNext = reviewCharIndex >= 0 && reviewCharIndex < reviewCharList.length - 1;
  } else {
    hasNext = currentCharIndex >= 0 && currentCharIndex < currentCharList.length - 1;
  }
  
  if (state === 'init') {
    el.innerHTML = `<button class="btn btn-primary btn-small" onclick="playAnimation()">&#128065; 再看一遍</button>`;
  } else if (state === 'ready') {
    el.innerHTML = `
      <button class="btn btn-success" onclick="startQuiz()">&#9997;&#65039; 我来写！</button>
      <button class="btn btn-outline btn-small" onclick="playAnimation()">&#128065; 再看一遍</button>`;
  } else if (state === 'quizzing') {
    el.innerHTML = `<button class="btn btn-outline btn-small" onclick="resetChar()">&#128260; 重新写</button>`;
  } else if (state === 'done') {
    const reviewBadge = reviewMode ? `<span style="font-size:12px;background:#ff4d4f;color:#fff;padding:2px 8px;border-radius:10px;margin-left:8px">复习模式</span>` : '';
    el.innerHTML = `
      <button class="btn btn-success btn-small" onclick="startQuiz()">&#9997;&#65039; 再写一次</button>
      <button class="btn btn-outline btn-small" onclick="playAnimation()">&#128065; 看笔顺</button>
      ${hasNext ? `<button class="btn btn-next btn-small" onclick="nextChar()">&#128073; 下一个字</button>${reviewBadge}` : reviewBadge}`;
  }
}

function updateStatsStars(ch) {
  const rec = getCharRecord(ch);
  document.getElementById('statsStars').textContent = getStarLabel(rec);
}

function showSummary() {
  if (currentUnit === null) return;
  currentView = 'summary';
  const unit = UNITS[currentUnit];
  showOnly('summaryPage');

  const records = loadRecords();
  const allChars = unit.lessons.flatMap(l => l.chars.split(''));
  const mastered = allChars.filter(c => { const r = records[c]; return r && r.attempts > 0 && r.correct / r.attempts >= 0.8; }).length;
  const practiced = allChars.filter(c => records[c] && records[c].attempts > 0).length;

  let emoji = '&#128170;';
  let comment = '继续加油！';
  if (mastered === allChars.length) { emoji = '&#127942;'; comment = '全部掌握了，你真厉害！'; }
  else if (mastered > allChars.length * 0.6) { emoji = '&#127775;'; comment = '学得很好，再练练就全会了！'; }
  else if (practiced > 0) { emoji = '&#128522;'; comment = '有进步哦，继续练习！'; }
  else { emoji = '&#128075;'; comment = '开始练习吧！'; }

  let html = `<div class="summary-header">
    <div class="big-emoji">${emoji}</div>
    <h2>${unit.name}</h2>
    <div class="sub">${comment} 已掌握 ${mastered}/${allChars.length} 个字</div>
  </div><div class="summary-list">`;

  allChars.forEach(ch => {
    const rec = records[ch] || { attempts: 0, correct: 0 };
    const stars = getStars(rec);
    let badge, info;
    if (rec.attempts === 0) {
      badge = '<span class="badge badge-new">&#128218; 还没练</span>';
      info = '';
    } else {
      const rate = rec.correct / rec.attempts;
      info = `练了${rec.attempts}次 ${stars}`;
      if (rate >= 0.8) badge = '<span class="badge badge-star">&#127775; 掌握了</span>';
      else if (rate >= 0.5) badge = '<span class="badge badge-try">&#128170; 还要练</span>';
      else badge = '<span class="badge badge-hard">&#128293; 多练练</span>';
    }
    const diff = DIFFICULT_CHARS.has(ch) ? ' <span style="font-size:12px">&#128293;易错</span>' : '';
    html += `<div class="summary-item" onclick="openPractice('${ch}')" style="cursor:pointer">
      <span class="ch">${ch}</span><span class="info">${info}${diff}</span>${badge}</div>`;
  });

  html += `</div><div class="btn-row" style="margin-top:20px">
    <button class="btn btn-primary btn-small" onclick="goBack()">&#128072; 返回</button>
  </div>`;
  document.getElementById('summaryPage').innerHTML = html;
}

function celebrate() {
  const container = document.createElement('div');
  container.className = 'celebrate';
  document.body.appendChild(container);
  const colors = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#cc5de8','#20c997'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + '%';
    c.style.top = -10 + 'px';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDelay = Math.random() * 0.5 + 's';
    c.style.width = (6 + Math.random() * 8) + 'px';
    c.style.height = (6 + Math.random() * 8) + 'px';
    container.appendChild(c);
  }
  setTimeout(() => container.remove(), 2200);
}
