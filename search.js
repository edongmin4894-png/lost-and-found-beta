/**
 * search.js
 * '질문에 답하며 좁혀가는' 분실물 검색 로직
 * 1) 대분류 선택 → 2) 소분류 선택 → 3) 색상 선택 → 4) 결과 표시
 */

// Apps Script 배포 후 얻은 웹앱 URL을 여기에 붙여넣으세요. (index.html과 동일한 URL)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzSBKhSyjNlJNyekhKNh0vu0Q6TUpqFSuGWkwANb7RafQQ6gpWNnDSTxHExNIHiel4q/exec';

const quizArea = document.getElementById('quizArea');
const progressDots = document.getElementById('progressDots');
const breadcrumbEl = document.getElementById('breadcrumb');

const STEP_LABELS = ['대분류', '소분류', '색상'];

let state = { main: null, sub: null, color: null };
let allItemsCache = null;

function currentStepIndex() {
  if (!state.main) return 0;
  if (!state.sub) return 1;
  if (!state.color) return 2;
  return 3; // results
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
  breadcrumbEl.innerHTML = parts.length ? parts.join(' <span style="color:#C4C8D8">›</span> ') : '&nbsp;';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function goBack() {
  const step = currentStepIndex();
  if (step === 3) { state.color = null; }
  else if (step === 2) { state.sub = null; }
  else if (step === 1) { state.main = null; }
  render();
}

function restart() {
  state = { main: null, sub: null, color: null };
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

async function renderResults() {
  quizArea.innerHTML = `<p class="state-msg">일치하는 분실물을 찾는 중이에요...</p>`;

  try {
    const items = await getAllItems();

    const exact = items.filter(i =>
      i.mainCategory === state.main && i.subCategory === state.sub && i.color === state.color
    );

    let list = exact;
    let note = '';

    if (list.length === 0) {
      const relaxed = items.filter(i =>
        i.mainCategory === state.main && i.subCategory === state.sub
      );
      if (relaxed.length > 0) {
        list = relaxed;
        note = '색상까지 정확히 일치하는 물건은 없지만, 같은 종류의 분실물이에요.';
      }
    }

    renderResultList(list, note);
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
        <span class="meta">${escapeHtml(item.subCategory || '')} · ${escapeHtml(item.color || '')}</span>
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