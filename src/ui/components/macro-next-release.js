// Legacy unification (2026-10-26, roadmap item 11, screen 거시 · 금리): the macro header's next-release line and the
// 한국 거시 fold's 기준일 badges moved here from js/aio-core.js (window.AIO.renderMacroNextRelease,
// window._aioRenderKrMacroFreshnessBadges, _initMacroPage). Output and attributes are unchanged. The release clock is
// still read through the boot bridges (src/app/compatibility-globals.js _aioMacroReleaseNotYet/_aioReleaseKstLabel)
// so this module imports nothing and adds no chunk split to the boot set.

// P1505: a release is named for the reader ("미국 CPI"), not by the agency code ("BLS CPI").
const RELEASE_LABELS = Object.freeze({ 'us-nfp': '미국 고용보고서', 'us-cpi': '미국 CPI', 'us-pce': '미국 PCE 물가', 'us-ism-mfg': 'ISM 제조업 지수', 'us-ism-svc': 'ISM 서비스업 지수', 'us-retail': '미국 소매판매', 'us-fomc': 'FOMC 금리 결정', 'us-fed-rate': 'FOMC 금리 결정', 'kr-bok': '한국은행 금리 결정', 'conf-gtc-dc': 'NVIDIA GTC' });

// v57.91: '10/28(수) FOMC 금리 결정' when no KST time is known.
function shortDayLabel(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ''));
  return m ? `${Number(m[2])}/${Number(m[3])}(${'일월화수목금토'.charAt(new Date(Date.UTC(+m[1], m[2] - 1, +m[3])).getUTCDay())}) ` : (date ? `${date} ` : '');
}

export function renderMacroNextRelease({ documentRef = globalThis.document, root = globalThis, now = Date.now() } = {}) {
  const el = documentRef?.getElementById?.('macro-next-release');
  const releases = root.AIO_MACRO_CALENDAR?.releases;
  // P1844 (codex F07): native release clock
  const notYet = typeof root._aioMacroReleaseNotYet === 'function' ? root._aioMacroReleaseNotYet : (k, d, n, t) => d >= t;
  if (!el) return null;
  if (!releases) {
    el.textContent = '공식 일정 원천 수신 대기';
    el.setAttribute('data-runtime-state', 'unavailable');
    el.setAttribute('data-operational-use', 'blocked');
    return null;
  }
  const todayKst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  let upcoming = Object.keys(releases)
    .map((key) => ({ key, name: releases[key].name, date: releases[key].nextRelease }))
    .filter((item) => item.date && notYet(item.key, item.date, now, todayKst))
    .sort((a, b) => a.date.localeCompare(b.date));
  // v57.88 (screen audit): US first — the 미국 거시 header named 한국은행 (10/22) while the scenarios named FOMC (10/28).
  upcoming = upcoming.filter((i) => /^us-/.test(i.key)).concat(upcoming.filter((i) => !/^us-/.test(i.key)));
  if (!upcoming.length) {
    el.textContent = '다음 주요 발표 일정 확인 필요';
    el.setAttribute('data-runtime-state', 'unavailable');
    el.setAttribute('data-operational-use', 'calendar-only');
    return null;
  }
  const next = upcoming[0];
  const kstWhen = typeof root._aioReleaseKstLabel === 'function' ? root._aioReleaseKstLabel(next.key, next.date) : null; // v58.80 first-users F09: KST like the body
  el.textContent = `다음 주요 발표: ${kstWhen ? `${kstWhen} KST ` : shortDayLabel(next.date)}${RELEASE_LABELS[next.key] || next.name}`;
  el.setAttribute('data-runtime-state', 'official-reference');
  el.setAttribute('data-operational-use', 'calendar-only');
  return next;
}

// v52.42 (P657/EF-16): one "기준: MM/DD (N일 전)" badge from the shared _fieldTs on the three main 한국 거시 cards.
const KR_MACRO_BADGES = Object.freeze([['kr-macro-bokrate-freshness', 'bok_rate'], ['kr-macro-cpi-freshness', 'kr_cpi'], ['kr-macro-pmi-freshness', 'kr_pmi']]);

export function renderKrMacroFreshnessBadges({ documentRef = globalThis.document, root = globalThis } = {}) {
  const ts = root.DATA_SNAPSHOT?._fieldTs || {};
  for (const [id, key] of KR_MACRO_BADGES) {
    const el = documentRef?.getElementById?.(id);
    const dateStr = ts[key];
    if (!el) continue;
    if (!dateStr) {
      el.textContent = '기준: 미수신';
      el.style.color = 'var(--text-muted)';
      el.setAttribute('data-runtime-state', 'unavailable');
      continue;
    }
    const days = typeof root._aioStaleDays === 'function' ? root._aioStaleDays(dateStr) : Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    el.textContent = `기준: ${dateStr.slice(5).replace('-', '/')} (${days}일 전)`;
    el.style.color = days > 30 ? 'var(--data-amber)' : 'var(--text-muted)';
  }
}
