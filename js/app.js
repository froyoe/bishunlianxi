// ===== 核心逻辑 =====

async function openPractice(ch) {
  currentView = 'practice';
  currentChar = ch;
  if (reviewMode) {
    currentCharIndex = reviewCharIndex;
  } else {
    currentCharIndex = currentCharList.indexOf(ch);
  }
  quizActive = false;
  clearStrokeSpeech();
  showNav(true);
  
  const titlePrefix = reviewMode ? '📚 复习：' : '练习：';
  document.getElementById('headerTitle').textContent = titlePrefix + ch;
  showOnly('practicePage');

  const diff = DIFFICULT_CHARS.has(ch) ? '<span class="char-tag">&#128293; 易错字，要多练</span>' : '';
  document.getElementById('practiceHeader').innerHTML = `<div class="big-char">${ch}</div>${diff}`;

  updateStatsStars(ch);
  renderPracticeButtons('init');
  document.getElementById('feedbackArea').innerHTML = '<div class="feedback-text hint">&#128264; 听一听，看一看…</div>';

  try {
    await loadStrokeNames(ch);
  } catch (e) {
    console.error('加载笔画数据异常:', e);
  }

  speak(ch, 0.7);

  const wrap = document.getElementById('writerWrap');
  const size = Math.min(320, wrap.clientWidth) - 6;
  document.getElementById('writerTarget').innerHTML = '';
  
  writer = HanziWriter.create('writerTarget', ch, {
    width: size, height: size, padding: 10,
    showOutline: true, showCharacter: false,
    strokeAnimationSpeed: 1, delayBetweenStrokes: 1200,
    strokeColor: '#333', outlineColor: '#ddd',
    drawingColor: '#5b8ff9', drawingWidth: 8,
    showHintAfterMisses: 2,
    highlightOnComplete: true,
    highlightColor: '#52c41a',
    leniency: 1.2,
  });

  renderPracticeButtons('animating');
  setTimeout(() => {
    if (currentChar !== ch) return;
    animateWithStrokeNames();
  }, 900);
}

function animateWithStrokeNames() {
  if (!writer) return;
  clearStrokeSpeech();

  const names = currentStrokeNames;
  const INTERVAL = 1600;

  if (names.length > 0) {
    names.forEach((name, i) => {
      const t = setTimeout(() => {
        speakQueue(name, 0.8);
        document.getElementById('feedbackArea').innerHTML =
          `<div class="feedback-text hint">第${i + 1}笔：${name}</div>`;
      }, i * INTERVAL);
      strokeSpeechTimers.push(t);
    });
  }

  writer.animateCharacter({
    onComplete: () => {
      SFX.ready();
      const summary = names.length > 0
        ? `<div style="font-size:14px;color:var(--text-light);margin-top:4px">笔顺：${names.join(' - ')}</div>`
        : '';
      document.getElementById('feedbackArea').innerHTML =
        `<div class="feedback-text hint">&#128079; 看完啦！点下面按钮自己写写看</div>${summary}`;
      renderPracticeButtons('ready');
    }
  });
}

function skipToQuiz() {
  if (!writer) return;
  SFX.tap();
  clearStrokeSpeech();
  writer.cancelQuiz();
  writer.hideCharacter();
  document.getElementById('feedbackArea').innerHTML =
    '<div class="feedback-text hint">&#128221; 用手指按顺序写吧！</div>';
  renderPracticeButtons('ready');
}

function playAnimation() {
  if (!writer) return;
  SFX.tap();
  quizActive = false;
  speak(currentChar, 0.7);
  document.getElementById('feedbackArea').innerHTML = '<div class="feedback-text hint">&#128064; 仔细看哦…</div>';
  renderPracticeButtons('animating');
  writer.hideCharacter();
  setTimeout(() => animateWithStrokeNames(), 700);
}

function startQuiz() {
  if (!writer) return;
  SFX.tap();
  quizActive = true;
  document.getElementById('feedbackArea').innerHTML =
    '<div class="feedback-text hint">&#128221; 用手指按顺序写吧！</div>';
  renderPracticeButtons('quizzing');
  writer.hideCharacter();
  writer.quiz({
    onMistake(sd) {
      SFX.wrong();
      const expected = currentStrokeNames[sd.strokeNum] || '';
      const hint = expected ? `，这一笔是${expected}` : '';
      document.getElementById('feedbackArea').innerHTML =
        `<div class="feedback-text wrong">&#128528; 不太对${hint}，再试试</div>`;
      
      // 增强反馈：显示正确笔画动画
      writer.animateStroke(sd.strokeNum, {
        onComplete: () => {
             // 动画完成后不需额外操作，等待用户重试
        }
      });
    },
    onCorrectStroke(sd) {
      SFX.correct();
      const sName = currentStrokeNames[sd.strokeNum] || '';
      const encourages = ['&#128077; 对啦！', '&#127775; 真棒！', '&#128522; 没错！', '&#128170; 继续！', '&#10004;&#65039; 很好！'];
      const msg = encourages[sd.strokeNum % encourages.length];
      const nameTag = sName ? `<div style="font-size:15px;color:var(--text-light);margin-top:2px">${sName}</div>` : '';
      document.getElementById('feedbackArea').innerHTML =
        `<div class="feedback-text correct">${msg}</div>${nameTag}`;
      if (sName) speakQueue(sName, 0.9);
    },
    onComplete(summary) {
      quizActive = false;
      const ok = summary.totalMistakes === 0;
      recordResult(currentChar, ok);
      updateStatsStars(currentChar);
      renderPracticeButtons('done');
      if (ok) {
        SFX.perfect();
        document.getElementById('feedbackArea').innerHTML =
          `<div class="feedback-emoji">&#127881;&#127881;&#127881;</div>
           <div class="feedback-text correct">太棒了！全部正确！</div>`;
        celebrate();
      } else if (summary.totalMistakes <= 2) {
        SFX.done();
        document.getElementById('feedbackArea').innerHTML =
          `<div class="feedback-emoji">&#128170;</div>
           <div class="feedback-text" style="color:#fa8c16">不错哦，再练练就更好了！</div>`;
      } else {
        SFX.done();
        document.getElementById('feedbackArea').innerHTML =
          `<div class="feedback-emoji">&#128588;</div>
           <div class="feedback-text" style="color:var(--primary)">加油！多看几遍笔顺再写</div>`;
      }
    }
  });
}

function resetChar() { if (currentChar) openPractice(currentChar); }

function reviewWeakChars(chars) {
  if (!chars || chars.length === 0) {
    showError('没有需要复习的薄弱字', 2000);
    return;
  }
  reviewMode = true;
  reviewCharList = chars;
  reviewCharIndex = 0;
  showError(`📚 开始复习 ${chars.length} 个薄弱字`, 2000);
  openPractice(chars[0]);
  currentCharList = chars;
  currentCharIndex = 0;
}

function nextChar() {
  if (reviewMode && reviewCharIndex < reviewCharList.length - 1) {
    reviewCharIndex++;
    currentCharIndex = reviewCharIndex;
    openPractice(reviewCharList[reviewCharIndex]);
  } else if (!reviewMode && currentCharIndex < currentCharList.length - 1) {
    currentCharIndex++;
    openPractice(currentCharList[currentCharIndex]);
  } else if (reviewMode && reviewCharIndex >= reviewCharList.length - 1) {
    reviewMode = false;
    showError('🎉 薄弱字复习完成！', 3000);
    setTimeout(() => {
      if (currentUnit !== null) {
        openUnit(currentUnit);
      }
    }, 1500);
  }
}

function goBack() {
  clearStrokeSpeech();
  if (reviewMode) {
    reviewMode = false;
    reviewCharList = [];
    reviewCharIndex = -1;
  }
  if (currentView === 'practice' && currentUnit !== null) {
    openUnit(currentUnit);
  } else if (currentView === 'summary' && currentUnit !== null) {
    openUnit(currentUnit);
  } else {
    renderUnits();
  }
}

// 防止iPad上触摸写字时页面滚动
document.getElementById('writerWrap').addEventListener('touchmove', function(e) {
  e.preventDefault();
}, { passive: false });
document.getElementById('practicePage').addEventListener('touchmove', function(e) {
  if (e.target.closest('#writerWrap')) {
    e.preventDefault();
  }
}, { passive: false });

// 初始化监听
window.addEventListener('online', () => showError('✅ 网络已连接', 2000));
window.addEventListener('offline', () => showError('📡 网络已断开', 3000));

// 启动
renderUnits();
