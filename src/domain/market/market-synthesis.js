// v59.55 (owner 11/1, "마지막에는 전체 개념과 내용들을 유기적으로 연결해서 … 무엇을 확인하고 대응해야 되는지까지"): the one
// closing card every market screen ends with. Each screen first adds its own line (what this screen measured), then the
// same shared reading follows — the four-step market chain, the scenario branches with what confirms or breaks each,
// and where to lean and what to avoid. All of it comes from the shared interpretation (guide, crossroads, regime,
// marketRead), so 시장 상태, 매크로, 테마 and 브리핑 cannot tell four different stories.

const PAGE_LABELS = Object.freeze({
  signal: '국면 판정', breadth: '시장 폭', sentiment: '투자 심리', macro: '거시 경제', fxbond: '금리와 환율', themes: '테마와 섹터', briefing: '브리핑', news: '뉴스'
});

export function firstSentence(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  const hit = value.match(/^.+?(?:다|요|음)\.(?=\s|$)/);
  return (hit ? hit[0] : value).trim();
}

function axisLine(regime, id) {
  const axis = (regime?.axes || []).find((row) => row.id === id);
  if (!axis) return '';
  return `${axis.title} ${axis.stateLabel || ''} — ${firstSentence(axis.read)}`.replace(/\s+—\s+$/, '').trim();
}

// What this screen adds, in one line, from the same interpretation the screen itself reads.
export function pageLine(page, interpretation) {
  const { regime, macroRead, marketRead, flow } = interpretation || {};
  switch (page) {
    case 'signal': return regime?.heroLine || (regime?.available ? `미국 6개 지표 ${regime.overall}` : '');
    case 'breadth': return axisLine(regime, 'breadth');
    case 'sentiment': return axisLine(regime, 'volatility');
    case 'macro': {
      if (!macroRead?.available) return '';
      const c = macroRead.counts || {};
      const label = macroRead.regime?.label || macroRead.regime?.name || '';
      return `${label ? `${label}, ` : ''}증시에 주는 거시 6요인 양호 ${c.favorable ?? 0} · 중립 ${c.neutral ?? 0} · 부담 ${c.burden ?? 0}`;
    }
    case 'fxbond': return [axisLine(regime, 'rates'), axisLine(regime, 'korea')].filter(Boolean).join(' ');
    case 'themes': return flow?.available ? [flow.strongLine, flow.weakLine].filter(Boolean).join(', ') : firstSentence(interpretation?.outlook?.headline);
    case 'briefing': return firstSentence(marketRead?.headline);
    default: return '';
  }
}

/**
 * @param {object} interpretation buildMarketInterpretation()
 * @param {object} [options]
 * @param {string} [options.page] a SYNTHESIS_PAGES value
 */
export function buildMarketSynthesis(interpretation, { page = '' } = {}) {
  const guide = interpretation?.guide;
  if (!guide?.available) return { available: false };
  const live = guide.direction?.live || [];
  const watch = guide.direction?.watch || [];
  const role = (index, kind) => (kind === 'watch' ? '지켜볼 갈래' : guide.tiedIds?.length ? '동률' : index === 0 && guide.leadId ? '중심' : '대안');
  const branches = [...live.map((path, index) => ({ path, role: role(index, 'live') })), ...watch.map((path) => ({ path, role: role(0, 'watch') }))]
    .slice(0, 3).map(({ path, role: label }) => ({
      id: path.id, role: label, name: path.short, title: path.title, fit: path.fit, met: path.met, total: path.total,
      firmer: path.firmer && !/없음/.test(path.firmer) ? path.firmer : '', weaker: path.weaker && path.weaker !== '—' ? path.weaker : '',
      confirm: path.triggers?.[0] ? `${path.triggers[0].when} — ${path.triggers[0].text}` : '',
      breaks: Array.isArray(path.invalidation) && path.invalidation[0] ? String(path.invalidation[0].text || path.invalidation[0]) : ''
    }));
  const checks = [];
  if (guide.nextEvent?.name) checks.push(`${guide.nextEvent.when || guide.nextEvent.date} ${guide.nextEvent.name}`);
  for (const text of (interpretation.marketRead?.checks || []).slice(0, 2)) checks.push(String(text));
  return {
    available: true, asOf: guide.asOf, page, pageLabel: PAGE_LABELS[page] || '',
    pageLine: pageLine(page, interpretation),
    headline: guide.headline,
    chain: (guide.situation || []).map((row) => ({ id: row.id, label: row.label, text: firstSentence(row.text) || row.text })),
    branches,
    pursue: guide.stance?.pursue || [],
    avoid: guide.stance?.avoid || [],
    checks,
    caution: guide.note || ''
  };
}
