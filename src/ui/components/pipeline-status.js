// The 데이터 파이프라인 상태 bar (#aio-pipeline-status-bar with its one-line toggle) and the
// developer-mode 공개 준비 panel (#aio-public-readiness), moved from js/aio-data.js (_aioRenderPipelineStatus,
// _aioCheckManualFieldStaleness, _aioUpdatePipelineStatusToggle, _aioRenderPublicReadiness, _aioSchedulePublicReadiness).
// The notices are src/data/pipeline-notices.js and the readiness model src/data/public-readiness.js; this file only draws.
// src/app/legacy-screen-bridges.js installs the window names, so the server data loader keeps calling them.
import { escapeHtml } from '../html.js';
import { pipelineNotices, staleManualFields } from '../../data/pipeline-notices.js';

const noticeHtml = (m) => `<span class="lda-pipe" data-tone="${escapeHtml(m.tone)}" title="${escapeHtml(m.detail)}">${m.icon} <b>${m.text}</b> <span class="lda-pipe-detail">${m.detail}</span></span>`;

/**
 * One paint of the bar, in the legacy order: the notices replace its content, the stale hand-kept fields are appended as
 * pills, and the toggle summary counts what the bar holds.
 * `meta` is the server data meta; `universeStale` and `fieldTs`/`staleDays` come from the caller's state.
 */
export function renderPipelineStatus({ documentRef, meta, universeStale = false, fieldTs = null, staleDays = null, log = null }) {
  const bar = documentRef?.getElementById('aio-pipeline-status-bar');
  if (!bar) return null;
  const msgs = pipelineNotices(meta, { universeStale });
  if (!msgs) bar.style.display = 'none';
  else if (!msgs.length) bar.style.display = 'none';
  else { bar.innerHTML = msgs.map(noticeHtml).join(''); bar.style.display = 'flex'; }
  const stale = staleManualFields(fieldTs, staleDays);
  stale.forEach((r) => log?.('warn', 'data', `[_fieldTs] ${r.label} ${r.days}일 경과 (${r.date}) — aio-core.js DATA_SNAPSHOT._fieldTs.${r.key} 업데이트 필요`));
  if (stale.length) {
    bar.querySelectorAll('.stale-manual-pill').forEach((el) => el.remove());
    for (const r of stale) {
      const pill = documentRef.createElement('span');
      pill.className = 'stale-manual-pill'; // styled in legacy-data.css
      pill.title = `${r.label} — 마지막 업데이트 ${r.date} (${r.days}일 경과). 정책 발표/공식 소스 확인 후 갱신됩니다.`;
      pill.textContent = `${r.label} ${r.days}일 경과`;
      bar.appendChild(pill);
    }
    bar.style.display = 'flex';
  }
  const toggle = documentRef.getElementById('aio-pipeline-status-toggle');
  const summary = documentRef.getElementById('aio-pipeline-status-summary');
  if (toggle && summary) {
    const count = bar.children.length;
    if (!count) toggle.style.display = 'none';
    else { bar.style.display = 'flex'; toggle.style.display = 'block'; summary.textContent = `주의 항목 ${count}건`; }
  }
  return { notices: msgs, stale };
}

/** The 공개 준비 panel — developer mode on 오늘 only; the model is src/data/public-readiness.js. */
export function renderPublicReadiness({ documentRef, readiness, pageText, sourceText }) {
  const el = documentRef?.getElementById('aio-public-readiness');
  if (!el) return;
  if (!documentRef.body || !documentRef.body.classList.contains('aio-dev-mode')) { el.style.removeProperty('display'); return; }
  const activePage = documentRef.querySelector('.page.active');
  if (activePage && activePage.id !== 'page-home') return;
  const m = readiness({ full: false });
  const issues = (m.blockers || []).concat(m.warnings || []).slice(0, 4);
  const rows = (m.pageEvidenceRows || []).slice(0, 8);
  const sourceHtml = rows.length
    ? `<div class="aio-public-readiness-pages" aria-label="Page source and asOf matrix">${rows.map((r) => `<span class="aio-public-page-source is-${escapeHtml(String(r.sourceKind || '').toLowerCase())}"><b>${escapeHtml(pageText(r.pageId))}</b><em>${escapeHtml(sourceText(r.sourceKind, r.sourceLabel))}</em><small>${escapeHtml(r.asOf || '시각 확인 중')}</small></span>`).join('')}</div>`
    : '';
  el.className = `aio-public-readiness is-${m.status}`;
  el.innerHTML = `<div class="aio-public-readiness-main"><div class="aio-public-readiness-label">${escapeHtml(m.label)}</div></div>`
    + `<div class="aio-public-readiness-card"><b>버전</b><span id="aio-public-readiness-version">${escapeHtml(m.version)}</span></div>`
    + `<div class="aio-public-readiness-card"><b>데이터</b><span>${escapeHtml(m.dataLabel)}<br>${escapeHtml(m.dataStatus)}</span></div>`
    + `<div class="aio-public-readiness-card"><b>현재성</b><span>${escapeHtml(m.pageStatus)}<br>${escapeHtml(m.pipelineStatus)}</span></div>`
    + sourceHtml
    + (issues.length ? `<div class="aio-public-readiness-issues">${issues.map(escapeHtml).join(', ')}</div>` : '');
  el.style.display = 'grid';
}
