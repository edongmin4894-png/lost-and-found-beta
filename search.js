/**
 * search.js
 * '질문에 답하며 좁혀가는' 분실물 검색 로직
 * 1) 대분류 선택 → 2) 소분류 선택 → 3) 색상 선택 → 4) 특징 주관식 입력 → 5) 결과 표시
 *
 * 4단계에서 입력한 문장은, 앞선 조건(대분류/소분류/색상)을 만족한 물건들의
 * 등록 시 '상세 특징' 텍스트와 비교해서 일치율(%)을 계산하고, 60% 이상인
 * 물건만 우선적으로 보여줍니다. (calcMatchScore 참고)
 */

// Apps Script 배포 후 얻은 웹앱 URL을 여기에 붙여넣으세요. (index.html과 동일한 URL)
const SCRIPT_URL = 'https://script.google.com/macros/s/여기에_배포된_웹앱_ID를_입력하세요/exec';

const MATCH_THRESHOLD = 60; // 특징 일치율 기준선 (%)

const quizArea = document.getElementById('quizArea');
const progressDots = document.getElementById('progressDots');
const breadcrumbEl = document.getElementById('breadcrumb');

const STEP_LABELS = ['대분류', '소분류', '색상', '특징'];

// featureText: null = 아직 이 단계에 답 안 함 / '' = 건너뜀 / 그 외 = 사용자가 적은 문장
let state = { main: null, sub: null, color: null, featureText: null };
let allItemsCache = null;

function currentStepIndex() {
  if (!state.main) return 0;
  if (!state.sub) return 1;
  if (!state.color) return 2;
  if (state.featureText === null) return 3;
  return 4; // results
}

function renderProgress() {
  const step = currentStepIndex();
  progressDots.innerHTML = STEP_LABELS.map((_, i) => {
    let cls = '';
    if (i < step) cls = 'done';
    else if (i === step) cls = 'current';
    return `<span class="${cls}"></span>`;
  }).join('');
}

function renderBreadcrumb() {
  const parts = [];
  if (state.main) parts.push(`<b>${escapeHtml(state.main)}</b>`);
  if (state.sub) parts.push(`<b>${escapeHtml(state.sub)}</b>`);
  if (state.color) parts.push(`<b>${escapeHtml(state.color)}</b>`);
  if (state.featureText) parts.push(`<b>"${escapeHtml(truncate(state.featureText, 14))}"</b>`);
  breadcrumbEl.innerHTML = parts.length ? parts.join(' <span style="color:#C4C8D8">›</span> ') : '&nbsp;';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function goBack() {
  const step = currentStepIndex();
  if (step === 4) { state.featureText = null; }
  else if (step === 3) { state.color = null; }
  else if (step === 2) { state.sub = null; }
  else if (step === 1) { state.main = null; }
  render();
}

function restart() {
  state = { main: null, sub: null, color: null, featureText: null };
  allItemsCache = null;
  render();
}

function render() {
  renderProgress();
  renderBreadcrumb();

  const step = currentStepIndex();

  if (step === 0) {
    renderQuestion('잃어버리신 물건의 전체적인 카테고리는 무엇인가요?',
      CATEGORY_TREE.map(c => c.name),
      (choice) => { state.main = choice; render(); });
  } else if (step === 1) {
    const cat = CATEGORY_TREE.find(c => c.name === state.main);
    renderQuestion('조금 더 구체적으로 어떤 물건인가요?',
      cat.children,
      (choice) => { state.sub = choice; render(); },
      true);
  } else if (step === 2) {
    renderQuestion('물건의 색상은 무엇인가요?',
      COLOR_OPTIONS,
      (choice) => { state.color = choice; render(); },
      true);
  } else if (step === 3) {
    renderFeatureStep();
  } else {
    renderResults();
  }
}

function renderQuestion(question, options, onSelect, showBack) {
  const optionsHtml = options.map(opt =>
    `<button type="button" class="option-btn" data-value="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`
  ).join('');

  quizArea.innerHTML = `
    <p class="quiz-question">${escapeHtml(question)}</p>
    <div class="quiz-options">${optionsHtml}</div>
    <div class="quiz-nav">
      ${showBack ? '<button type="button" class="text-btn" id="backBtn">◀ 이전으로</button>' : '<span></span>'}
      <button type="button" class="text-btn" id="restartBtn">처음부터 다시</button>
    </div>
  `;

  quizArea.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => onSelect(btn.dataset.value));
  });
  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.addEventListener('click', goBack);
  document.getElementById('restartBtn').addEventListener('click', restart);
}

function renderFeatureStep() {
  quizArea.innerHTML = `
    <p class="quiz-question">떠오르는 물건의 특징을 자유롭게 적어주세요.</p>
    <p class="quiz-subtext">브랜드, 무늬, 스티커, 흠집, 안에 든 물건 등 기억나는 대로 적을수록 더 정확하게 찾아드려요.</p>
    <textarea id="featureInput" placeholder="예: 옆면에 곰돌이 키링이 달려 있고, 안에 학생증이 들어있어요."></textarea>
    <button type="button" class="primary" id="featureSubmitBtn" style="margin-top:12px;">결과 보기</button>
    <div class="quiz-nav">
      <button type="button" class="text-btn" id="backBtn">◀ 이전으로</button>
      <button type="button" class="text-btn" id="skipBtn">특징 입력 없이 보기</button>
    </div>
  `;

  document.getElementById('featureSubmitBtn').addEventListener('click', () => {
    const val = document.getElementById('featureInput').value.trim();
    state.featureText = val; // 빈 값이면 건너뛴 것과 동일하게 처리됨
    render();
  });
  document.getElementById('backBtn').addEventListener('click', goBack);
  document.getElementById('skipBtn').addEventListener('click', () => {
    state.featureText = '';
    render();
  });
}

/**
 * 사용자가 적은 문장과 등록된 물건의 특징 텍스트를 비교해 일치율(0~100)을 계산합니다.
 * 형태소 분석 없이 2글자 이상 단어 단위로 쪼갠 뒤, 서로 부분 문자열로 포함되는지를
 * 확인하는 방식입니다 (조사가 붙어도 어느 정도 매칭되도록). 완벽한 의미 분석은 아니고
 * 간단한 키워드 겹침 기반의 근사치라는 점을 참고해주세요.
 */
const PARTICLES = ['은', '는', '이', '가', '을', '를', '에', '의', '도', '만', '과', '와', '요'];

function stripParticle(token) {
  // 명사 끝에 흔히 붙는 조사를 하나 떼어내서 어근끼리 비교되게 함 (예: 학생증이 → 학생증)
  if (token.length > 2 && PARTICLES.includes(token[token.length - 1])) {
    return token.slice(0, -1);
  }
  return token;
}

function calcMatchScore(userText, itemText) {
  const tokenize = (str) => (str || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .map(stripParticle);

  const userTokens = tokenize(userText);
  const itemTokens = tokenize(itemText);
  if (userTokens.length === 0 || itemTokens.length === 0) return 0;

  let matchedCount = 0;
  userTokens.forEach(ut => {
    const hit = itemTokens.some(it => it.includes(ut) || ut.includes(it));
    if (hit) matchedCount++;
  });

  return Math.round((matchedCount / userTokens.length) * 100);
}

async function renderResults() {
  quizArea.innerHTML = `<p class="state-msg">일치하는 분실물을 찾는 중이에요...</p>`;

  try {
    const items = await getAllItems();

    const exact = items.filter(i =>
      i.mainCategory === state.main && i.subCategory === state.sub && i.color === state.color
    );

    let candidates = exact;
    let categoryNote = '';

    if (candidates.length === 0) {
      const relaxed = items.filter(i =>
        i.mainCategory === state.main && i.subCategory === state.sub
      );
      if (relaxed.length > 0) {
        candidates = relaxed;
        categoryNote = '색상까지 정확히 일치하는 물건은 없지만, 같은 종류의 분실물이에요.';
      }
    }

    if (candidates.length === 0) {
      renderResultList([], '');
      return;
    }

    // 특징을 건너뛴 경우: 점수 계산 없이 카테고리/색상 기준 결과만 보여줌
    if (!state.featureText) {
      renderResultList(candidates.map(i => ({ ...i, matchScore: null })), categoryNote);
      return;
    }

    const scored = candidates
      .map(item => ({
        ...item,
        matchScore: calcMatchScore(state.featureText, `${item.itemName} ${item.features}`)
      }))
      .sort((a, b) => b.matchScore - a.matchScore);

    const matched = scored.filter(i => i.matchScore >= MATCH_THRESHOLD);

    if (matched.length > 0) {
      renderResultList(matched, categoryNote);
    } else {
      renderNoMatchState(scored, categoryNote);
    }
  } catch (err) {
    console.error(err);
    quizArea.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <p>목록을 불러오지 못했어요.<br>잠시 후 다시 시도해주세요.</p>
        <div class="quiz-nav" style="justify-content:center; margin-top:14px;">
          <button type="button" class="text-btn" id="restartBtn">처음부터 다시</button>
        </div>
      </div>`;
    document.getElementById('restartBtn').addEventListener('click', restart);
  }
}

function renderNoMatchState(scoredCandidates, categoryNote) {
  quizArea.innerHTML = `
    <div class="empty-state">
      <div class="icon">🔍</div>
      <p>입력하신 특징과 ${MATCH_THRESHOLD}% 이상 일치하는 물건이 없어요.</p>
      <div class="quiz-nav" style="justify-content:center; margin-top:14px; gap:10px;">
        <button type="button" class="text-btn" id="showAllBtn">특징 조건 없이 전체 보기</button>
      </div>
      <div class="quiz-nav" style="justify-content:center; margin-top:4px; gap:10px;">
        <button type="button" class="text-btn" id="backBtn">◀ 다른 특징으로 다시 적기</button>
        <button type="button" class="text-btn" id="restartBtn">처음부터 다시</button>
      </div>
    </div>`;
  document.getElementById('showAllBtn').addEventListener('click', () => {
    renderResultList(scoredCandidates, categoryNote);
  });
  document.getElementById('backBtn').addEventListener('click', goBack);
  document.getElementById('restartBtn').addEventListener('click', restart);
}

function renderResultList(list, note) {
  if (list.length === 0) {
    quizArea.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔍</div>
        <p>아직 등록된 일치하는 분실물이 없어요.<br>학교 분실물 보관 장소에 직접 문의해보세요.</p>
        <div class="quiz-nav" style="justify-content:center; margin-top:14px;">
          <button type="button" class="text-btn" id="backBtn">◀ 다른 조건으로 찾기</button>
          <button type="button" class="text-btn" id="restartBtn">처음부터 다시</button>
        </div>
      </div>`;
    document.getElementById('backBtn').addEventListener('click', goBack);
    document.getElementById('restartBtn').addEventListener('click', restart);
    return;
  }

  const cardsHtml = list.map(item => `
    <div class="result-card">
      <img src="${item.imageUrl || ''}" alt="${escapeHtml(item.itemName || '')}" loading="lazy"
           onerror="this.style.visibility='hidden'">
      <div class="info">
        <h3>${escapeHtml(item.itemName || '이름 없음')}</h3>
        <p>${escapeHtml(item.features || '')}</p>
        <span class="meta">${escapeHtml(item.subCategory || '')} · ${escapeHtml(item.color || '')}${item.matchScore != null ? ` · 일치율 ${item.matchScore}%` : ''}</span>
      </div>
    </div>
  `).join('');

  quizArea.innerHTML = `
    <div class="result-summary">
      ${note ? `<p>${escapeHtml(note)}</p>` : ''}
      총 <b>${list.length}</b>개의 분실물을 찾았어요.
    </div>
    <div class="result-grid">${cardsHtml}</div>
    <div class="quiz-nav" style="justify-content:center; margin-top:18px;">
      <button type="button" class="text-btn" id="backBtn">◀ 다른 조건으로 찾기</button>
      <button type="button" class="text-btn" id="restartBtn">처음부터 다시</button>
    </div>
  `;
  document.getElementById('backBtn').addEventListener('click', goBack);
  document.getElementById('restartBtn').addEventListener('click', restart);
}

async function getAllItems() {
  if (allItemsCache) return allItemsCache;
  const res = await fetch(SCRIPT_URL);
  if (!res.ok) throw new Error('네트워크 오류');
  allItemsCache = await res.json();
  return allItemsCache;
}

render();