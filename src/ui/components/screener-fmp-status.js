// Legacy unification (2026-10-26, roadmap item 11, screen 스크리너): the 재무 팩터 coverage note (#screener-fmp-status,
// #screener-fmp-reason) moved here from _aioRenderPipelineStatus in js/aio-data.js. Texts and the 80% coverage line are
// unchanged. The pipeline status still reads the snapshot meta and calls window._aioRenderScreenerFmpStatus, which
// src/app/legacy-screen-bridges.js installs; the last meta seen before install is painted then.

const coverageText = (label) => `공시 재무 자료가 있는 종목 ${label}(US 유니버스 기준, 필드 혼합)만 재무 조건 판정 가능`;

export function renderScreenerFmpStatus(meta, { documentRef = globalThis.document } = {}) {
  const el = documentRef.getElementById('screener-fmp-status');
  const reason = documentRef.getElementById('screener-fmp-reason');
  if (!el || !meta || meta.fmpHasKey == null) return;
  const raw = meta.fundamentalCoveragePct == null ? null : Number(meta.fundamentalCoveragePct);
  const pct = raw != null && Number.isFinite(raw) ? raw : null;
  if (meta.fmpHasKey && meta.fmpOk === false) {
    el.style.display = 'inline-flex';
    if (reason) reason.textContent = coverageText(pct == null ? '미확인' : `${pct.toFixed(1)}%`);
  } else if (!meta.fmpHasKey) {
    el.style.display = 'inline-flex';
    // A missing coverage used to throw here (null.toFixed) and leave the initial '재무 자료 범위 확인 중'; it now says so.
    if (reason) reason.textContent = pct == null ? '재무 자료 범위 확인 중' : (pct >= 80 ? '재무 자료 충분' : coverageText(`${pct.toFixed(1)}%`));
  } else {
    el.style.display = 'none';
  }
}
