// Owner 2026-10-25: "맞춤" in the AI panel header — the reader sets how answers should explain (experience, lens,
// horizon, loss tolerance, markets, interests, length). The profile is stored on this device and every question
// carries it through window.AIO.aiProfileContext (read by js/aio-chat.js _buildUserProfileContext). It adapts the
// explanation only; the boundary text lives in src/ai/session/user-profile.js.
import { PROFILE_FIELDS, PROFILE_KEY, MAX_LENSES, MAX_INTERESTS_CHARS, buildProfileContext, clearProfile, isProfileSet, loadProfile, profileSummary, saveProfile } from '../../ai/session/user-profile.js';
import { LEARN_KEY, LEARN_CONSENT_KEY, clearLearned, learningEnabled, loadLearned, recordUsage, setLearning, summarizeLearned } from '../../ai/session/usage-learning.js';
import { el } from './dom.js';

const SCREEN_NAME = { home: '오늘', briefing: '브리핑', macro: '거시', fxbond: '금리·환율', themes: '테마', 'theme-detail': '테마', signal: '시장 상태', breadth: '시장 폭', sentiment: '투자 심리', ticker: '종목', technical: '차트', fundamental: '재무', screener: '스크리너', portfolio: '포트폴리오', 'market-news': '뉴스', principles: '개념', atlas: '산업 지도', masters: '투자 대가', guide: '안내' };
const TICKER_ROUTES = new Set(['ticker', 'technical', 'fundamental']);
const LENS_NAME = Object.fromEntries(PROFILE_FIELDS.lenses.map(([id, label]) => [id, label]));

const GROUPS = [
  ['level', '경험', 'radio'],
  ['lenses', `먼저 볼 관점 (최대 ${MAX_LENSES}개)`, 'checkbox'],
  ['horizon', '투자 기간', 'radio'],
  ['risk', '손실을 얼마나 견디나', 'radio'],
  ['markets', '시장', 'radio'],
  ['length', '답변 길이', 'radio']
];

// The device store is handed in by the app layer (ui/ai modules never open browser storage themselves).
export function installAIProfile(root = globalThis, doc = root.document, { storage = null } = {}) {
  if (!doc || root.__aioAIProfile) return root.__aioAIProfile || null;
  const panelRoot = doc.getElementById('ai-panel');
  const head = panelRoot?.querySelector('.ai-ph');
  if (!panelRoot || !head) return null;
  let profile = loadProfile(storage);
  const learnedSummary = () => (learningEnabled(storage) ? summarizeLearned(loadLearned(storage)) : null);
  root.AIO = root.AIO || {};
  root.AIO.aiProfileContext = () => buildProfileContext(profile, learnedSummary());

  // Owner 2026-10-25: use teaches the profile only after the reader turns it on (recordUsage stores nothing otherwise).
  // Counts only: a screen opened, a completed question's topics, and the ticker or theme the app itself resolved.
  const record = (event) => { try { recordUsage(storage, event); } catch (_) { /* learning never blocks the panel */ } };
  const onScreen = (event) => {
    const route = typeof event?.detail === 'string' ? event.detail : '';
    if (!route) return;
    record({ kind: 'screen', route });
    if (TICKER_ROUTES.has(route) && root._currentTickerId) record({ kind: 'ticker', id: String(root._currentTickerId).toUpperCase() });
  };
  const onTheme = (event) => {
    const detail = event?.detail?.themeDetail;
    if (detail?.id) record({ kind: 'theme', id: String(detail.id), label: detail.label });
  };
  doc.addEventListener?.('aio:pageShown', onScreen);
  // This module loads after boot, so the screen the reader opened with is recorded here.
  const opening = String(doc.querySelector?.('.page.active')?.id || '').replace(/^page-/, '');
  if (opening) onScreen({ detail: opening });
  doc.addEventListener?.('aio:themeDetailShown', onTheme);
  const previousSave = root.saveChatEntry;
  if (typeof previousSave === 'function') {
    root.saveChatEntry = function (ctxId, question, answer) {
      record({ kind: 'question', text: question });
      if (TICKER_ROUTES.has(ctxId) && root._currentTickerId) record({ kind: 'ticker', id: String(root._currentTickerId).toUpperCase() });
      return previousSave.apply(this, arguments);
    };
  }

  const button = el(doc, 'button', '맞춤', 'ai-session-head-btn ai-profile-btn'); button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'ai-profile-sheet');
  const controls = head.querySelector('.ai-session-controls');
  if (controls) controls.prepend(button); else head.insertBefore(button, head.querySelector('.ai-ph-close'));
  const refreshButton = () => {
    const set = isProfileSet(profile) || learningEnabled(storage);
    button.textContent = set ? '맞춤 켜짐' : '맞춤';
    button.classList.toggle('is-on', set);
    button.title = set ? `답변 맞춤: ${profileSummary(profile) || '설정됨'}` : '답변을 내 경험과 관점에 맞추기';
  };
  refreshButton();

  const sheet = el(doc, 'div', null, 'ai-session-list ai-profile-sheet');
  sheet.id = 'ai-profile-sheet';
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', '답변 맞춤 설정');
  panelRoot.append(sheet);

  // 사용 기록으로 맞추기: off by default; on shows what was learned and can wipe it; off wipes it too.
  function learningSection() {
    const set = el(doc, 'fieldset', null, 'ai-profile-group ai-profile-learn');
    set.append(el(doc, 'legend', '사용 기록으로 맞추기', 'ai-profile-legend'));
    const toggle = el(doc, 'label', null, 'ai-profile-switch');
    const box = doc.createElement('input');
    box.type = 'checkbox'; box.name = 'learn'; box.checked = learningEnabled(storage);
    toggle.append(box, el(doc, 'span', '이 브라우저의 사용 기록으로 맞추기'));
    set.append(toggle, el(doc, 'p', '여는 화면, 질문 주제, 본 종목·테마의 횟수만 이 브라우저에 쌓습니다. 질문 원문은 저장하지 않습니다. 요약은 질문과 함께 AI에 전달되고, 위에서 직접 고른 설정이 항상 우선합니다. 끄면 쌓인 기록도 지웁니다.', 'ai-profile-lede'));
    const body = el(doc, 'div', null, 'ai-profile-learned');
    const paint = () => {
      if (!learningEnabled(storage)) { body.replaceChildren(); return; }
      const s = summarizeLearned(loadLearned(storage));
      if (s.empty) { body.replaceChildren(el(doc, 'p', '아직 쌓인 기록이 없습니다. 화면을 보고 질문하면 여기에 요약이 나타납니다.', 'ai-session-meta')); return; }
      const rows = [
        ['자주 연 화면', [...new Set(s.screens.map((id) => SCREEN_NAME[id] || id))].join(', ')],
        ['먼저 볼 관점(추정)', s.lenses.map((id) => LENS_NAME[id] || id).join(', ')],
        ['자주 본 종목·테마', [...s.tickers, ...s.themeLabels].join(', ')],
        ['최근 질문', s.questions ? `${s.questions}개${Number.isFinite(s.definitionShare) ? `, 용어 정의 질문 ${Math.round(s.definitionShare * 100)}%` : ''}` : ''],
        ['기록 시작', s.since ? `${new Date(s.since).getMonth() + 1}/${new Date(s.since).getDate()}` : '']
      ].filter(([, value]) => value);
      const list = el(doc, 'dl', null, 'ai-profile-learned-list');
      for (const [label, value] of rows) list.append(el(doc, 'dt', label), el(doc, 'dd', value));
      const wipe = el(doc, 'button', '학습 기록 지우기', 'ai-session-delete'); wipe.type = 'button';
      wipe.addEventListener('click', () => {
        if (wipe.dataset.confirm !== '1') { wipe.dataset.confirm = '1'; wipe.textContent = '한 번 더 누르면 지웁니다'; return; }
        clearLearned(storage); paint();
      });
      body.replaceChildren(list, wipe);
    };
    box.addEventListener('change', () => { setLearning(storage, box.checked); paint(); refreshButton(); });
    paint();
    set.append(body);
    return set;
  }

  function close({ focusButton = true } = {}) {
    sheet.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) button.focus?.();
  }
  function open() {
    const top = el(doc, 'div', null, 'ai-session-list-head');
    const back = el(doc, 'button', '닫기', 'ai-session-btn'); back.type = 'button';
    back.addEventListener('click', () => close());
    top.append(el(doc, 'h3', '답변 맞춤', 'ai-session-list-title'), back);
    const form = el(doc, 'form', null, 'ai-profile-form');
    form.noValidate = true;
    form.append(el(doc, 'p', '답의 깊이, 근거를 놓는 순서, 예시, 길이가 바뀝니다. 종목이나 사고팔 시점을 대신 고르지는 않습니다.', 'ai-profile-lede'));
    for (const [field, legend, type] of GROUPS) {
      const set = el(doc, 'fieldset', null, 'ai-profile-group');
      set.append(el(doc, 'legend', legend, 'ai-profile-legend'));
      const row = el(doc, 'div', null, 'ai-profile-options');
      for (const [id, label] of PROFILE_FIELDS[field]) {
        const wrap = el(doc, 'label', null, 'ai-profile-option');
        const input = doc.createElement('input');
        input.type = type; input.name = field; input.value = id;
        input.checked = field === 'lenses' ? profile.lenses.includes(id) : profile[field] === id;
        wrap.append(input, el(doc, 'span', label));
        row.append(wrap);
      }
      set.append(row);
      form.append(set);
    }
    // A radio cannot be unchosen by a second tap; this lets the reader take a single choice back to "미설정".
    form.addEventListener('click', (event) => {
      const input = event.target?.closest?.('input[type="radio"]');
      if (!input) return;
      if (input.dataset.wasChecked === '1') { input.checked = false; input.dataset.wasChecked = '0'; }
      form.querySelectorAll(`input[name="${input.name}"]`).forEach((other) => { other.dataset.wasChecked = other.checked ? '1' : '0'; });
    });
    form.querySelectorAll('input[type="radio"]').forEach((input) => { input.dataset.wasChecked = input.checked ? '1' : '0'; });
    form.addEventListener('change', (event) => {
      if (event.target?.name !== 'lenses') return;
      const picked = [...form.querySelectorAll('input[name="lenses"]:checked')];
      if (picked.length > MAX_LENSES) event.target.checked = false;
    });
    const interests = el(doc, 'label', null, 'ai-profile-text');
    interests.append(el(doc, 'span', '관심 분야 (선택, 예: 반도체, 전력망)', 'ai-profile-legend'));
    const text = doc.createElement('input');
    text.type = 'text'; text.name = 'interests'; text.maxLength = MAX_INTERESTS_CHARS; text.value = profile.interests || '';
    text.autocomplete = 'off';
    interests.append(text);
    form.append(interests, learningSection());
    const status = el(doc, 'p', isProfileSet(profile) ? `지금: ${profileSummary(profile) || '설정됨'}${learningEnabled(storage) ? ', 비어 있는 칸은 사용 기록으로' : ''}`
      : learningEnabled(storage) ? '지금: 직접 고른 설정 없음, 사용 기록 요약으로 맞춤' : '지금: 미설정 (성향을 가정하지 않고 답합니다)', 'ai-session-meta ai-profile-status');
    status.setAttribute('role', 'status');
    const foot = el(doc, 'div', null, 'ai-session-foot');
    const reset = el(doc, 'button', '초기화', 'ai-session-delete'); reset.type = 'button';
    const save = el(doc, 'button', '저장', 'ai-session-btn is-primary'); save.type = 'submit';
    reset.addEventListener('click', () => {
      clearProfile(storage); profile = loadProfile(storage); refreshButton(); open();
      sheet.querySelector('.ai-profile-status').textContent = '초기화했습니다. 성향을 가정하지 않고 답합니다.';
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = { lenses: [...form.querySelectorAll('input[name="lenses"]:checked')].map((i) => i.value), interests: text.value };
      for (const [field, , type] of GROUPS) if (type === 'radio') data[field] = form.querySelector(`input[name="${field}"]:checked`)?.value || null;
      profile = saveProfile(storage, data);
      refreshButton();
      close();
    });
    foot.append(el(doc, 'p', '이 브라우저에만 저장, 질문할 때 AI에 함께 전달', 'ai-session-meta'), reset, save);
    form.append(status, foot);
    sheet.replaceChildren(top, form);
    sheet.style.top = `${head.offsetHeight || 52}px`; // the header wraps on a phone; the sheet starts below it
    sheet.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    form.querySelector('input')?.focus?.();
  }
  button.addEventListener('click', () => {
    if (!sheet.hidden) { close(); return; }
    head.querySelector('[aria-controls="ai-session-list"][aria-expanded="true"]')?.click(); // one sheet at a time
    open();
  });
  sheet.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } });
  // Another tab saved a profile: this tab's next question uses it.
  root.addEventListener?.('storage', (event) => {
    if (![PROFILE_KEY, LEARN_KEY, LEARN_CONSENT_KEY].includes(event?.key)) return;
    profile = loadProfile(storage); refreshButton();
  });
  const api = { get profile() { return profile; }, open, close };
  root.__aioAIProfile = api;
  return api;
}
