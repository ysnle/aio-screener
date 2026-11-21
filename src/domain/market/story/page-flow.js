// P1431 (owner direction 2026-10-04): a page must read as one argument, not a stack of independent
// cards — every section says what it adds to the page's conclusion, and the page ends with where the
// same reading continues. These sentences are computed from the same series and rules the cards use;
// a section with missing inputs says what it cannot add instead of inventing a reading.
import { isDefensiveSector, SECTOR_ETF_LABELS, AXIS_LABELS, axisNames } from '../interpretation/concepts.js';

// v58.74 (text audit): the RRG rows carry legacy labels ('소비재', '필수소비') beside chips that say 경기소비재/필수소비재.
const sectorName = (item) => SECTOR_ETF_LABELS[String(item?.symbol || '').toUpperCase()] || item?.label || item?.symbol;
import { hasFinalConsonant, withTopicParticle } from '../../content/korean-particle.js';
import { rrgRecentReading } from '../../themes/recent-check.js';
import { signedText } from '../../shared/number.js';
import { normalizeSectorKey } from '../../screener/sector-label.js';

const signed = (value, digits = 1, unit = '') => signedText(Number(value), digits, unit);

// 시장 상태: each burden or neutral axis points to the screen that explains it.
const AXIS_ROUTES = Object.freeze({
  trend: { route: 'charts', action: 'aioOpenMarketChart', arg: 'SPY', label: 'S&P 500 차트', why: (axis) => `${axisState(axis)} — 일봉과 50·200일선 위치` },
  breadth: { route: 'breadth', label: '시장 폭', why: (axis) => `${axisState(axis)} — 참여 종목의 6개월 추이와 빠지거나 들어온 종목` },
  volatility: { route: 'sentiment', label: '투자 심리', why: (axis) => `${axisState(axis)} — 옵션 헤지 수요·심리와 같은 쪽인지` },
  rates: { route: 'fxbond', label: '금리와 환율', why: (axis) => `${axisState(axis)} — 실질금리와 수익률 곡선 중 어디에서 오는지` },
  credit: { route: 'sentiment', label: '투자 심리', why: (axis) => `${axisState(axis)} — 공포 심리와 함께 움직이는지` },
  commodities: { route: 'macro', label: '매크로', why: (axis) => `${axisState(axis)} — 물가와 금리 경로에 주는 압력` }
});
const axisState = (axis) => `${AXIS_LABELS[axis.id]} ${axis.stateLabel}`;
const SIX_AXES = axisNames();

// I02/I14: 시장 상태 always continues to 테마 · 섹터 with the same leader names the rotation read uses; in a narrow tape
// (index near its high, participation burden) the item names the S&P 500 map that shows which members carry the index.
export function regimeFlow({ regime = null, groups = {} } = {}) {
  if (!regime?.available) return { next: [] };
  const order = { burden: 0, neutral: 1, favorable: 2, unknown: 3 };
  const seen = new Set();
  const next = [];
  for (const axis of [...regime.axes].filter((row) => AXIS_ROUTES[row.id]).sort((a, b) => order[a.state] - order[b.state])) {
    const target = AXIS_ROUTES[axis.id];
    if (axis.state === 'favorable' || axis.state === 'unknown' || seen.has(target.route)) continue;
    seen.add(target.route);
    next.push({ route: target.route, action: target.action, arg: target.arg, label: target.label, why: target.why(axis), tone: axis.state });
  }
  const breadth = regime.axes.find((row) => row.id === 'breadth');
  const leaders = rotationLeaders(groups);
  const narrow = breadth?.state === 'burden' && breadth?.narrow;
  // v57.81: while the leadership break holds, the map link says the leaders are falling too and that RRG trails price.
  next.push(narrow && regime.leadershipBreak
    ? { route: 'themes', label: 'S&P 500 지도, 섹터', why: `주도 영역까지 밀리는 중 — 어느 종목·섹터가 지수를 끌어내렸는지(지도 타일 넓이 = 지수 비중)${leaders ? `. 상대강도(약 50일 기준) ${leaders}는 몇 주 늦게 반영됩니다` : ''}` }
    : narrow
    ? { route: 'themes', label: 'S&P 500 지도, 섹터', why: `지수는 고점권인데 참여가 좁음 — 지수를 끌어올린 종목(지도 타일 넓이 = 지수 비중)${leaders ? `과 상대강도(약 50일 기준) ${leaders}` : ''}` }
    : { route: 'themes', label: '테마와 섹터', why: leaders ? `섹터 회전의 상대강도(약 50일 기준) ${leaders} — 6개 지표의 판정이 어느 업종에서 나타나는지` : '6개 지표의 판정이 어느 섹터·테마에서 나타나는지' });
  return { next };
}

// 브리핑 (I21): the briefing's statements and 자산별 흐름 boxes continue to the screen that explains each asset group,
// in the order the read ranked them; 시장 상태 first because it judges the same closes on six axes.
const BRIEFING_ROUTES = Object.freeze({
  index: { route: 'breadth', label: '시장 폭', why: '지수와 참여 종목이 같은 방향인지, 괴리가 어디서 커지는지' },
  rates: { route: 'fxbond', label: '금리와 환율', why: '금리 움직임이 실질금리·기대인플레·수익률 곡선 중 어디서 오는지' },
  commodities: { route: 'macro', label: '매크로', why: '유가·금·달러 움직임이 물가와 금리 경로에 주는 압력' },
  risk: { route: 'sentiment', label: '투자 심리', why: '변동성·신용·공포 심리가 같은 쪽을 가리키는지' },
  // P1727: the Korea box continues to 시장 상태's 한국 시장 board (코스피·코스닥·원화·한국 표본 참여도), not 거시 경제.
  korea: { route: 'signal', label: '시장 상태, 한국 시장', why: '코스피·코스닥과 원화, AIO 추적 종목(한국)의 참여도를 미국 판정과 따로 확인', ctx: { anchor: 'regime-board-kr' } }
});
// P1727: the asset groups whose moves usually start in the news continue to that topic of 뉴스 as well (one link at most).
// The context names the news topic/country chip; the news page applies it when it reads the handoff.
const BRIEFING_NEWS = Object.freeze({
  commodities: { route: 'market-news', label: '뉴스, 에너지', why: '유가를 움직인 공급·지정학 기사', ctx: { topic: 'energy' } },
  risk: { route: 'market-news', label: '뉴스, 지정학', why: '변동성·위험 회피를 부른 사건 기사', ctx: { topic: 'geo' } },
  korea: { route: 'market-news', label: '뉴스, 한국', why: '한국 증시 움직임과 관련된 기사', ctx: { country: 'kr' } }
});

export function briefingFlow({ read = null } = {}) {
  if (!read?.available) return { next: [] };
  const lead = new Set((read.statements || []).slice(0, 4).map((row) => row.axis));
  const next = [];
  const seen = new Set();
  const keyOf = (item) => `${item.route}#${item.ctx?.anchor || ''}`;
  // P1727: when the Korea sentence is in the four-sentence lead, its board comes first.
  if (lead.has('korea')) { next.push({ ...BRIEFING_ROUTES.korea }); seen.add(keyOf(BRIEFING_ROUTES.korea)); }
  next.push({ route: 'signal', label: '시장 상태', why: `오늘 해석이 6개 지표(${SIX_AXES}) 판정과 같은 쪽인지` });
  seen.add('signal#');
  const axes = [...(read.statements || []).map((row) => row.axis), ...(read.drivers || []).filter((row) => row.values?.length).map((row) => row.id)];
  for (const axis of axes) {
    const target = BRIEFING_ROUTES[axis];
    if (!target || seen.has(keyOf(target)) || next.length >= 4) continue;
    seen.add(keyOf(target));
    const title = (read.drivers || []).find((row) => row.id === axis)?.title;
    next.push({ ...target, why: `${title ? `자산별 흐름 '${title}' — ` : ''}${target.why}` });
  }
  const newsAxis = [...(read.statements || []).slice(0, 4).map((row) => row.axis)].find((axis) => BRIEFING_NEWS[axis]);
  if (newsAxis) next.push(BRIEFING_NEWS[newsAxis]);
  return { next };
}

// 테마 · 섹터: what the RRG quadrants say together, tied to the 시장 상태 breadth axis.
// The defensive set is the shared concept (src/domain/market/interpretation/concepts.js): XLRE trades on the rate path.
const QUADRANT_WORDS = Object.freeze({ Leading: '선도', Improving: '개선', Weakening: '약화', Lagging: '후행' });

// The leader names one rotation read and every link that quotes it share: "선도 기술·통신서비스 · 개선 유틸리티".
// v57.81: a sector whose last five sessions of relative strength ran hard against its quadrant carries that clause
// (src/domain/themes/recent-check.js rrgRecentReading), so "선도 XLK" is not read as leading now.
export function rotationLeaders(groups = {}) {
  const names = (key) => (groups?.[key] || []).map((item) => {
    const name = sectorName(item);
    return name && item.recentReversal ? `${name}(최근 5거래일 ${item.recentReversal})` : name;
  }).filter(Boolean);
  return [names('Leading').length ? `선도 ${names('Leading').join('·')}` : null, names('Improving').length ? `개선 ${names('Improving').join('·')}` : null].filter(Boolean).join(', ');
}

// I09: RRG sector ETF -> the screener universe's English sector value (public-data/screener-universe.json `sector`).
export const SECTOR_ETF_SCREENER_SECTOR = Object.freeze({
  XLK: 'Technology', XLC: 'Communication Services', XLY: 'Consumer', XLP: 'Consumer Defensive', XLV: 'Healthcare', XLF: 'Financials',
  XLE: 'Energy', XLI: 'Industrials', XLU: 'Utilities', XLB: 'Materials', XLRE: 'Real Estate'
});

export function rotationFlow({ groups: allGroups = {}, regime = null, revisions = null } = {}) {
  // v59.70 (owner): a reference-only ETF (DRAM, NCLD: a few months listed, swap-heavy) stays on the scatter but is never a
  // named leader, laggard or count in the verdict; its theme's benchmark (SOXX, SKYY) carries the reading.
  const groups = Object.fromEntries(Object.entries(allGroups).map(([key, list]) => [key, (list || []).filter((item) => item?.referenceOnly !== true)]));
  const names = (key) => (groups[key] || []).map(sectorName);
  const total = Object.keys(QUADRANT_WORDS).reduce((sum, key) => sum + (groups[key] || []).length, 0);
  if (!total) return { read: '상대강도·모멘텀 기록이 없어 섹터 회전을 읽지 못했습니다.', next: [] };
  const lead = groups.Leading || [];
  const improving = groups.Improving || [];
  const lagging = groups.Lagging || [];
  const ahead = [...lead, ...improving];
  const defensiveAhead = ahead.filter((item) => isDefensiveSector(item.symbol)).length;
  // Coordinator follow-up (M08 class, 2026-10-13): quadrant membership alone does not establish a "위험 선호/회피 회전"
  // verdict, so the line only counts which kinds of sectors sit ahead of the benchmark.
  const style = !ahead.length ? '시장 대비 나아진 섹터(선도·개선)가 없습니다'
    : `선도·개선 ${ahead.length}개 중 방어 업종 ${defensiveAhead}개, 경기 민감 업종 ${ahead.length - defensiveAhead}개입니다`;
  const concentration = lead.length <= 2 && lagging.length >= Math.ceil(total / 2)
    ? ` ${total}개 중 선도 ${lead.length}개, 후행 ${lagging.length}개입니다. 기준이 시가총액 가중 S&P 500(SPY)이라 대형 기술주 비중이 클수록 나머지 섹터가 후행에 몰리기 쉽습니다.` : '';
  const breadth = regime?.axes?.find((row) => row.id === 'breadth');
  const tie = concentration && breadth?.state === 'burden' ? ' 시장 상태의 시장 폭 부담(참여 종목 감소)과 같은 그림입니다.'
    : concentration && breadth?.state === 'favorable' ? ' 다만 시장 폭은 양호라 종목 참여는 아직 넓습니다.' : '';
  // P1599 (F104): the headline names the leaders and the counts; every sector already sits in the quadrant
  // cards right below, so listing all eleven here made the one-line read a paragraph.
  const counts = concentration ? '' : ` ${names('Weakening').length ? `약화는 ${names('Weakening').join('·')}, ` : '약화는 없고, '}${lagging.length ? `후행은 ${names('Lagging').join('·')}입니다.` : '후행은 없습니다.'}`;
  const leaders = lead.length ? rotationLeaders(groups) : ['선도 섹터 없음', rotationLeaders({ Improving: improving })].filter(Boolean).join(', ');
  // v57.81 (audit): the quadrants are a ~50-session reading, and a point within the neutral band around 100 (경계) is
  // kept out of the verdict leaders and named apart.
  const border = groups.Border || [];
  // v57.91: one sentence — the names first, then why, then any five-session reversal.
  const reversals = border.filter((item) => item.recentReversal).map((item) => `${withTopicParticle(sectorName(item))} 최근 5거래일 ${item.recentReversal}`);
  const borderText = border.length ? ` ${withTopicParticle(border.map(sectorName).join('·'))} 100 근처(기준선 부근)라 사분면을 정하지 않았습니다${reversals.length ? `(${reversals.join(', ')})` : ''}.` : '';
  // v58.74 (text audit 테마 C1): price against earnings — a sector trailing on relative strength while its analysts revise
  // up the most is the disagreement an expert looks at first (it resolves when one side gives way).
  const revRank = (Array.isArray(revisions) ? revisions : []).filter((row) => Number.isFinite(row?.revision)).slice(0, 2);
  const behind = [...(groups.Lagging || []).map((item) => [item, '후행']), ...(groups.Weakening || []).map((item) => [item, '약화'])];
  const split = behind.map(([item, word]) => {
    const sector = SECTOR_ETF_SCREENER_SECTOR[String(item.symbol || '').toUpperCase()];
    const index = revRank.findIndex((row) => normalizeSectorKey(row.sector) === normalizeSectorKey(sector) && row.revision > 0);
    return index >= 0 ? { name: sectorName(item), word, rank: index, revision: revRank[index].revision } : null;
  }).filter(Boolean)[0];
  const earningsSplit = split ? ` ${withTopicParticle(split.name)} 이익 전망 상향 우위가 ${signedText(split.revision * 100, 0, '%')}로 ${split.rank === 0 ? '가장 높은데' : '두 번째로 높은데'} 상대강도는 ${split.word}${hasFinalConsonant(split.word) ? '이라' : '라'}, 가격과 이익 전망이 엇갈립니다. 상향이 가격으로 이어지는지가 확인할 점입니다.` : '';
  const read = `약 50일 상대강도 기준 ${leaders}. ${style}.${concentration}${counts}${borderText}${tie}${earningsSplit}`;
  const next = [];
  // I09: the screener opens on the first improving sector (the screener reads ctx.sector, an English universe sector).
  const firstSector = improving.map((item) => SECTOR_ETF_SCREENER_SECTOR[String(item.symbol || '').toUpperCase()]).find(Boolean) || null;
  const firstLabel = firstSector ? improving.find((item) => SECTOR_ETF_SCREENER_SECTOR[String(item.symbol || '').toUpperCase()] === firstSector) : null;
  if (improving.length) next.push({ route: 'screener', label: '스크리너', why: `개선 사분면(${names('Improving').join('·')})에서 상대강도가 먼저 오르는 종목${firstSector && improving.length > 1 ? ` — ${firstLabel.label || firstLabel.symbol} 섹터부터` : ''}`,
    ...(firstSector ? { ctx: { sector: firstSector } } : {}) });
  if (breadth) next.push({ route: 'breadth', label: '시장 폭', why: `섹터 쏠림이 참여 종목 수(${AXIS_LABELS.breadth} ${breadth.stateLabel})에도 나타나는지` });
  next.push({ route: 'macro', label: '매크로', why: '금리·유가·달러가 어느 업종에 유리한 국면인지' });
  return { read, next };
}

// 테마 · 섹터: what the sub-theme ranking says beyond its order — where short-term momentum is moving
// (1-month rank well ahead of 3-month) and which leaders are cooling.
export function themeStrengthLead(model = null, { stages = null } = {}) {
  const groups = Array.isArray(model?.groups) ? model.groups : [];
  if (groups.length < 5) return '';
  const label = (group) => group.name;
  const top = groups.slice(0, 5);
  // P1591 (T06): a group already named among the top three is not repeated as "moving up", and
  // "반대로" is used only when the previous clause really is the contrast (cooling leaders).
  const named = new Set(groups.slice(0, 3).map((group) => group.id ?? group.name));
  // The largest rank gains first — the same order as the rank-move figure under the list, so the text names what it draws.
  const improving = groups.filter((group) => group.direction === 'improving' && !named.has(group.id ?? group.name))
    .sort((a, b) => ((b.rank3m ?? 0) - (b.rank1m ?? 0)) - ((a.rank3m ?? 0) - (a.rank1m ?? 0))).slice(0, 3);
  // v58.74: a rank fall whose last week beat the index is not '식는 중' (cybersecurity +11.3%, data/AI +9.5% on 10/23's week).
  const cooling = top.filter((group) => group.direction === 'weakening' && !(group.recent?.move > 0));
  const healthy = top.filter((group) => group.above50Pct != null && group.above50Pct >= 75).length;
  // v57.91: every clause ends in -입니다 (the lead mixed '…플랫폼. …식는 중. …곳.').
  // v58.75 (persona review): the top three were named here and again in the hero top-5 card and the table right below;
  // the lead keeps only what the order does not say (cooling, rising, participation, the parent theme's stage).
  const parts = [];
  const topic = (text) => { const code = String(text).charCodeAt(String(text).length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 ? '은' : '는'; };
  const joined = (list) => list.map(label).join(', ');
  if (cooling.length) parts.push(`상위 5개 중 ${joined(cooling)}${topic(label(cooling[cooling.length - 1]))} 1개월 순위가 3개월 순위보다 크게 밀려 강세가 식는 중입니다`);
  // v57.81 (audit): "최근 강해지는 곳" only when the last five sessions did not fall beyond the group's typical weekly move
  // (group.recent, recent-check.js); otherwise the rank gain is said with the week that contradicts it.
  const rising = improving.filter((group) => !group.recent?.broken), held = improving.filter((group) => group.recent?.broken);
  if (rising.length) parts.push(`${cooling.length ? '반대로 ' : ''}${joined(rising)}${topic(label(rising[rising.length - 1]))} 1개월 순위가 크게 올라 최근 강해지는 곳입니다`);
  if (held.length) parts.push(`${held.map((group) => `${group.name}(최근 5거래일 ${signed(group.recent.ret5d, 1, '%')})`).join(', ')}${topic(held[held.length - 1].name)} 1개월 순위는 올랐지만 최근 5거래일에 평소 1주 움직임의 2배를 넘게 밀려 강해지는 중으로 보지 않습니다`);
  parts.push(healthy === top.length ? `상위 ${top.length}개 모두 구성 종목 대부분이 50일선 위에 있습니다` : healthy ? `상위 ${top.length}개 중 ${healthy}개는 구성 종목 대부분이 50일선 위에 있습니다` : `상위 ${top.length}개 중 구성 종목 대부분이 50일선 위인 곳은 없습니다`);
  // v58.74 (text audit 테마 C6): the sub-theme ranking tied to the theme stage — when two or more of the top five share a
  // parent theme, that theme's stage and its wind under the central scenario are named.
  const byTheme = new Map();
  for (const group of top) if (group.themeId) byTheme.set(group.themeId, [...(byTheme.get(group.themeId) || []), group]);
  const [themeId, members] = [...byTheme.entries()].sort((a, b) => b[1].length - a[1].length)[0] || [];
  const stageRow = members?.length >= 2 && Array.isArray(stages) ? stages.find((row) => row.market === 'US' && row.id === themeId && row.state) : null;
  // The stage is the long trend; a short-window ranking led by a theme in a weak stage is said to be a rebound inside it.
  const stageName = String(stageRow?.stateLabel || '').split(' (')[0];
  if (stageRow) parts.push(`상위 5개 중 ${members.length}개가 속한 ${withTopicParticle(stageRow.label)} 긴 추세로 본 테마 시나리오에서 '${stageName}' 단계${/^중심 시나리오/.test(stageRow.windText || '') ? `이고 ${stageRow.windText.split(', 대안')[0]}` : ''}입니다${/약세|하락/.test(stageName) && model.windowLabel ? ` — ${model.windowLabel} 순위 상위는 그 안에서의 반등입니다` : ''}`);
  return `${parts.join('. ')}.`;
}

// 테마 상세: inside one theme — which sub-themes carry it, where short-term momentum is moving, and how
// the theme ETF sits in the sector rotation. Groups come from buildGroupStrength (screener artifact medians).
export function themeDetailFlow({ themeId, themeName = null, groups = [], etf = null, rotation = {}, stage = null } = {}) {
  const mine = (groups || []).filter((group) => group.themeId === themeId);
  if (!mine.length) return { read: '', rows: [], next: [] };
  // D15: a group with fewer than four members is reference only; it never names the strongest/weakest sub-theme.
  // A group without a measured 3-month return cannot be named strongest/weakest either (it read "통합 메이저(—)").
  const headline = mine.filter((group) => group.smallSample !== true && group.ret3m != null);
  // v58.63 (architecture audit M03): with every group a small sample the fallback to `mine` revived exactly the groups D15
  // holds back; no headline group means no strongest/weakest sentence.
  const byThree = [...headline].sort((a, b) => (b.ret3m ?? -1e9) - (a.ret3m ?? -1e9));
  const strongest = byThree[0];
  const weakest = byThree[byThree.length - 1];
  const improving = mine.filter((group) => group.direction === 'improving');
  // v57.81: a rank gain whose last five sessions fell beyond the group's typical weekly move is not "moving toward".
  const moving = improving.filter((group) => !group.recent?.broken), held = improving.filter((group) => group.recent?.broken);
  const cooling = mine.filter((group) => group.direction === 'weakening' && !(group.recent?.move > 0));
  // v57.81: the ETF's quadrant names its ~50-session window, the neutral band (경계) and a five-session reversal.
  const quadrant = etf && rotation[etf] ? rrgRecentReading(rotation[etf], rotation[etf].relativeStrength)?.label || null : null;
  const pct = (value) => (value == null ? '—' : `${signedText(value, 1)}%`);
  const parts = [];
  const rotationDate = etf && rotation[etf]?.sessionDate ? `${Number(rotation[etf].sessionDate.slice(5, 7))}/${Number(rotation[etf].sessionDate.slice(8, 10))} 종가 기준 ` : '';
  if (quadrant) parts.push(`테마 ETF ${withTopicParticle(etf)} ${rotationDate}S&P 500 대비 상대강도 회전에서 ${quadrant}입니다`); // P1747: not one of the 11 sector cards above
  // v58.74 (text audit 테마 C4): the ~50-session quadrant and the long-trend stage can disagree (XLU 선도 on the quadrant,
  // 약세 지속 over six months); the expert names the disagreement and what settles it.
  const qWord = quadrant && !/^기준선 부근/.test(quadrant) ? quadrant.replace(/\(.*$/, '') : '';
  const qStrong = /^(선도|개선)$/.test(qWord), qWeak = /^(약화|후행)$/.test(qWord);
  const longStrong = ['leading', 'pullback', 'fading'].includes(stage?.state), longWeak = ['weak', 'rebound'].includes(stage?.state);
  if (stage?.label && ((qStrong && longWeak) || (qWeak && longStrong))) parts.push(`다만 ${stage.window || '긴'} 추세 단계는 '${stage.label}'${hasFinalConsonant(stage.label) ? '이라' : '라'}, ${qStrong ? '짧은 강세가 긴 추세를 돌려세우는지' : '짧은 약세가 긴 추세를 꺾는지'}가 확인할 점입니다`);
  if (byThree.length >= 2 && strongest.ret3m != null && weakest.ret3m != null) parts.push(`3개월 기준 가장 강한 곳은 ${strongest.name}(${pct(strongest.ret3m)}), 가장 약한 곳은 ${weakest.name}(${pct(weakest.ret3m)})입니다`);
  if (moving.length && moving.length === mine.length && mine.length >= 2) {
    // P1449/R679: an improving 1-month vs 3-month rank is a RELATIVE PRICE observation. Without a
    // volume/flow input this is not evidence of money inflow (the house wording used by the
    // themes page itself: 테마 페이지의 '자금 유입은 별도 근거가 필요합니다').
    parts.push('세부 테마 전부가 1개월 순위를 크게 끌어올렸습니다 — 특정 종목이 아니라 테마 전체의 상대 강세가 같은 방향입니다(가격 기준 관측이며 자금 유입의 증거는 아닙니다)');
  }
  else if (moving.length) parts.push(`1개월 순위는 ${moving.map((group) => group.name).join(', ')} 쪽이 크게 올랐습니다(가격 기준)`);
  const subject = (text) => { const code = String(text).charCodeAt(String(text).length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 ? '이' : '가'; };
  if (held.length) parts.push(`1개월 순위는 ${held.map((group) => group.name).join(', ')}${subject(held[held.length - 1].name)} 올랐지만 최근 5거래일 ${held.map((group) => signed(group.recent.ret5d, 1, '%')).join(', ')}로 크게 밀렸습니다`);
  const topic = (text) => { const code = String(text).charCodeAt(String(text).length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 ? '은' : '는'; };
  if (cooling.length) parts.push(`${cooling.map((group) => group.name).join(', ')}${topic(cooling[cooling.length - 1].name)} 1개월 순위가 3개월 순위보다 크게 밀렸습니다`);
  // I09: the theme read continues to the stocks (screener) and to whether the move is broad (시장 폭).
  const sector = etf ? SECTOR_ETF_SCREENER_SECTOR[String(etf).toUpperCase()] || null : null;
  const next = [
    // v58.75 (persona review, D-6): the screener search takes a theme name and lists that theme's curated members
    // (mergeThemeAliases); the sector start stays only when the theme name is not known.
    { route: 'screener', label: themeName ? `스크리너에서 ${themeName} 종목 보기` : '스크리너', why: `${strongest ? `${strongest.name} 등 ` : ''}세부 테마 종목을 모멘텀·추세 순위로 비교${themeName ? '' : sector ? '(같은 섹터부터)' : ''}`, ...(themeName ? { ctx: { q: themeName } } : sector ? { ctx: { sector } } : {}) },
    { route: 'breadth', label: '시장 폭', why: '이 테마 흐름이 시장 전체 참여 폭과 같은 방향인지' }
  ];
  // D15 (review R2): small groups stay in the table as reference rows, after the ranked ones.
  const rows = [...byThree, ...mine.filter((group) => !byThree.includes(group)).sort((a, b) => (b.ret3m ?? -1e9) - (a.ret3m ?? -1e9))];
  return { read: parts.length ? `${parts.join('. ')}.` : '', rows, next };
}

// v57.77: 뉴스 continues to the two screens that turn a headline into a market reading — 브리핑 (how the closes moved)
// and 시장 상태 (whether the six-axis verdict shifted). A 한국 country filter opens 시장 상태 at the Korea board.
export function newsFlow({ countryFilter = 'all' } = {}) {
  const next = [{ route: 'briefing', label: '브리핑', why: '기사 속 사건이 최근 마감의 지수·금리·유가·달러 움직임과 같은 쪽이었는지' }];
  next.push(String(countryFilter || '').toLowerCase() === 'kr'
    ? { route: 'signal', label: '시장 상태, 한국 시장', why: '한국 기사와 코스피·코스닥·원화, AIO 추적 종목(한국)의 참여도가 같은 방향인지', ctx: { anchor: 'regime-board-kr' } }
    : { route: 'signal', label: '시장 상태', why: `사건이 6개 지표(${SIX_AXES}) 판정을 바꿀 만큼 가격에 반영됐는지` });
  return { next };
}
