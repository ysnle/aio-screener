import { researchSnapshotStore } from '../../data/research-snapshots.js';
const basisLabel = (basis) => ({ 'regular-session-close': '미국 정규장 종가', 'regular-close-delta': '직전 미국 정규장 종가 대비',
  'previous-regular-close': '직전 미국 정규장 종가 대비', 'provider-previous-value': '공급자가 제공한 직전 값 대비', 'daily-close-reference': '일별 종가 참고값',
  unknown: '가격 기준 미제공', unavailable: '가격 기준 미제공' })[basis] || (basis && !/^[a-z0-9-]+$/.test(basis) ? basis : '가격 기준 확인 필요');
export function ensureResearchSnapshots({ documentRef: doc, root, host, kind, collect }) {
  if (!host) return;
  let panel = host.querySelector(`[data-research-snapshots="${kind}"]`);
  if (panel) { panel._update(collect); return; } // Preserve a draft only for its issuer/session.
  panel = doc.createElement('details'); panel.dataset.researchSnapshots = kind;
  panel.style.cssText = 'margin:14px 0;padding:10px 12px;border:1px solid var(--border-subtle);font-size:12px;';
  const title = doc.createElement('summary');
  title.textContent = kind === 'briefing' ? '브리핑 저장본 · 날짜별 확인' : '이 종목의 메모 · 당시 근거 저장';
  const note = doc.createElement('textarea'); note.rows = 2; note.maxLength = 2000;
  note.setAttribute('aria-label', kind === 'briefing' ? '브리핑 저장 메모' : '종목 근거 메모');
  note.placeholder = '다음에 확인할 내용 (선택)'; note.style.cssText = 'display:block;width:100%;margin:8px 0;';
  const save = doc.createElement('button'); save.type = 'button'; save.textContent = '현재 근거 저장';
  const status = doc.createElement('div'); status.setAttribute('role', 'status');
  const undo = doc.createElement('button'); undo.type = 'button'; undo.hidden = true; undo.textContent = '방금 삭제 되돌리기';
  const list = doc.createElement('div');
  const store = researchSnapshotStore(root);
  panel._collect = collect;
  const drafts = new Map();
  const contextKey = (collector) => kind === 'stock' ? collector()?.symbol || '' : collector()?.sessionDate || '';
  let currentKey = contextKey(collect);
  const draw = () => {
    const symbol = kind === 'stock' ? panel._collect()?.symbol : null;
    const rows = store.list(kind).filter((row) => kind !== 'stock' || row.content.symbol === symbol);
    list.replaceChildren();
    if (!rows.length) list.textContent = '직접 저장한 자료가 없습니다.';
    for (const row of rows) {
      const content = row.content, detail = doc.createElement('details'), label = doc.createElement('summary');
      label.textContent = kind === 'briefing' ? `${content.sessionDate} 미국 종가 · 저장 ${row.savedAt.slice(0, 10)} UTC` : `${content.symbol} · 저장 ${row.savedAt.replace('T', ' ').slice(0, 16)} UTC`;
      const body = doc.createElement('div'); body.style.whiteSpace = 'pre-wrap';
      body.textContent = kind === 'briefing'
        ? [content.headline, content.interpretation ? `해석 · ${content.interpretation}` : '', ...content.facts.map((fact) => `${fact.label} · ${fact.value} · 관찰 ${fact.observedAt || '미제공'} · ${fact.source || '원 공급자 미제공'} · ${fact.basis || '기준 미제공'}`), ...content.checks.map((check) => `다음 확인 · ${check}`), `수집본 발행 ${row.publishedAt || '미제공'} · ${content.source || '출처 미제공'} · ${content.version || ''}`, content.note].filter(Boolean).join('\n')
        : [content.name, content.note, `가격 ${content.quote.value ?? '미제공'} ${content.quote.currency || '통화 미제공'}`, `관찰 ${content.quote.observedAt || '미제공'} · ${content.quote.source || '출처 미제공'} · ${basisLabel(content.quote.basis)}`].filter(Boolean).join('\n');
      const remove = doc.createElement('button'); remove.type = 'button'; remove.textContent = '이 저장본 삭제';
      let confirmed = false;
      remove.addEventListener('click', () => {
        if (!confirmed) { confirmed = true; remove.textContent = '다시 눌러 삭제 확인'; return; }
        store.remove(row.id); undo.hidden = false;
        status.textContent = store.status() === 'persistent' ? '저장본을 삭제했습니다. 앱을 닫기 전에 되돌릴 수 있습니다.' : '현재 앱 세션에서 삭제했습니다. 브라우저 저장에는 반영하지 못했습니다.';
        draw();
      });
      detail.append(label, body, remove); list.appendChild(detail);
    }
  };
  panel._update = (collector) => {
    const nextKey = contextKey(collector);
    panel._collect = collector;
    if (nextKey !== currentKey) {
      drafts.set(currentKey, note.value); currentKey = nextKey;
      note.value = drafts.get(currentKey) || ''; status.textContent = ''; draw();
    }
  };
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      await store.capture({ ...panel._collect(), note: note.value });
      status.textContent = store.status() === 'persistent' ? '이 브라우저에 저장했습니다. 저장 당시 근거는 이후 갱신으로 바뀌지 않습니다.' : '브라우저 저장을 사용할 수 없어 현재 앱 세션에서만 보관합니다.';
      draw();
    } catch (error) { status.textContent = error.message; }
    finally { save.disabled = false; }
  });
  panel.addEventListener('toggle', () => { if (panel.open) draw(); });
  undo.addEventListener('click', () => {
    if (store.undoRemove()) { undo.hidden = true; status.textContent = store.status() === 'persistent' ? '삭제를 되돌렸습니다.' : '현재 앱 세션에서 삭제를 되돌렸습니다.'; draw(); }
    else status.textContent = '저장 공간이 가득 차 되돌릴 수 없습니다. 저장본을 먼저 정리해 주세요.';
  });
  panel.append(title, note, save, status, undo, list);
  // Layout review 2026-10-18: the page's 데이터 출처 fold stays the last block, so the saved-notes panel goes above it.
  const sources = host.querySelector(':scope > details.page-sources');
  if (sources) host.insertBefore(panel, sources); else host.appendChild(panel);
  draw();
}
