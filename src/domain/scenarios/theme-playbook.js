// P1743 (owner 2026-10-13): every theme — US THEME_MAP and KR_THEME_MAP alike — read the same way, so the owner's
// examples (a software rally against a semiconductor pullback, bottlenecks in photonics/memory/power) come out of a
// rule rather than a hand-written note. For each theme:
//   stage    — 주도 지속 / 추세 속 조정 / 반등 시도 / 약세 지속, from the measured 6-month (or 3-month) and 1-month medians
//   wind     — tailwind or headwind under the leading and the alternative macro branch (exposure tags × branch lists)
//   choices  — the four choices with their opportunity cost for that stage × wind, and the relatively favoured one
//   evidence — met-condition count, the macro branch's market-pricing direction, and the proxy ETF's past outcomes in
//              the same stage (scenario-outcomes.json) with its sample size
//   thesis   — the structural hypothesis and what would break it (exposures.js), so a pullback in a structural theme
//              is read against its own break conditions
// Rotation is read from all themes at once: which exposure tags gained and lost over the month.
// No price, size, timing or named stock; stock-level selection stays on the theme, chart, company and screener screens.
import { EXPOSURE_TAGS, WIND_LABELS, themeProfile, windFor } from './exposures.js';
import { THEME_STATES, themeStateOf, frequencyText } from './analogs.js';
import { CHOICES } from '../market/macro-crossroads.js';

export const THEME_PLAYBOOK_VERSION = 'theme-playbook.v1';
const finite = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const median = (values) => { const list = values.filter((v) => finite(v) != null).sort((a, b) => a - b); if (!list.length) return null; const m = Math.floor(list.length / 2); return list.length % 2 ? list[m] : (list[m - 1] + list[m]) / 2; };
const pct = (value) => value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
const marketWord = (row) => (row.market === 'KR' ? '국내' : '미국');

const FAVOURED = {
  leading: { tail: ['hold'], head: ['hold'], mixed: ['hold'], none: ['hold'] },
  pullback: { tail: ['stage'], head: ['wait'], mixed: ['stage', 'wait'], none: ['stage', 'wait'] },
  rebound: { tail: ['stage'], head: ['wait'], mixed: ['wait'], none: ['wait'] },
  weak: { tail: ['wait'], head: ['wait'], mixed: ['wait'], none: ['wait'] }
};
const WHY = {
  leading: { tail: '추세와 거시 순풍이 같은 방향이라 보유를 이어 가는 쪽의 기회비용이 작습니다. 새로 들어가는 것은 이미 오른 가격(50일선과의 거리)을 감수하는 일입니다.',
    head: '추세는 강하지만 거시 역풍이 있어, 보유는 유지하되 역풍이 실제 실적으로 번지는지 확인하는 쪽이 맞습니다.',
    other: '추세가 살아 있는 동안에는 보유를 이어 가는 쪽의 기회비용이 작습니다.' },
  pullback: { tail: '긴 추세는 살아 있고 거시도 순풍인 조정은, 나눠 들어가는 쪽이 바닥 시점을 맞히지 않고도 다음 상승을 놓치지 않는 조합입니다. 구조 가설이 깨지는 신호가 나오면 멈춥니다.',
    head: '긴 추세가 살아 있어도 거시 역풍 속 조정은 더 깊어질 수 있어, 역풍이 약해지는 것을 기다리는 쪽의 비용이 작습니다.',
    other: '조정이 추세 붕괴인지 쉬어 가기인지 50일선 위 종목 비율로 가늠하며, 확인되면 나눠 들어가는 쪽이 맞습니다.' },
  rebound: { tail: '하락 추세 속 반등이지만 거시 순풍이 있어, 반등이 추세 전환으로 이어지는지 확인하며 나눠 보는 편이 맞습니다.',
    head: '역풍 속 반등은 짧게 끝나는 경우가 많아, 추세 전환이 확인될 때까지 기다리는 쪽의 비용이 작습니다.',
    other: '하락 추세 속 반등은 전환인지 확인하기 전까지 기다리는 쪽의 비용이 작습니다.' },
  weak: { tail: '거시 순풍에도 약세가 이어진다면 업종 고유의 문제가 있을 수 있어, 원인이 확인될 때까지 기다리는 쪽이 맞습니다.',
    head: '약세와 거시 역풍이 겹쳐 기다림의 비용이 가장 작은 조합입니다.',
    other: '약세가 이어지는 동안 기다림의 비용은 작습니다.' }
};
const CHOICE_TEXT = {
  leading: { wait: '기다리는 동안 추세가 이어지면 놓친 상승이 기회비용이 됩니다.', stage: '새로 나눠 들어가면 이미 벌어진 50일선과의 거리를 감수합니다 — 쉬어 가는 구간을 기다리는 편이 비용이 작을 수 있습니다.', hold: '추세가 살아 있는 동안 보유를 이어 가는 비용은 작습니다.', defend: '추세가 강할 때의 방어 전환은 남은 상승을 포기하는 기회비용이 큽니다.' },
  pullback: { wait: '조정이 쉬어 가기로 끝나면 다음 상승을 놓치는 것이 기회비용입니다.', stage: '나눠 들어가면 바닥을 맞히지 않아도 되지만, 하락이 길어지면 평균 가격도 함께 내려갑니다 — 구조 가설이 깨지는 신호가 중단 조건입니다.', hold: '보유는 조정 폭이 긴 추세 안에 머무는지(6개월 수익 범위 안인지) 확인하며 유지합니다.', defend: '조정 중의 방어 전환은 반등을 놓치는 비용이 클 수 있습니다.' },
  rebound: { wait: '반등이 전환으로 이어지면 초입을 놓치는 것이 기회비용입니다.', stage: '반등 초기에 나눠 들어가면 전환을 일부 잡지만, 반등이 실패하면 하락 추세로 되돌아갑니다.', hold: '보유는 반등이 이전 고점·50일선을 회복하는지 확인하며 유지합니다.', defend: '하락 추세가 끝나지 않았다면 방어 쪽이 손실을 줄입니다.' },
  weak: { wait: '약세가 이어지는 동안 기다림의 비용은 작습니다.', stage: '약세 속 분할은 "싸 보임"에 기대기 쉬워, 추세 회복 신호 없이 나눠 들어가는 비용이 큽니다.', hold: '보유는 약세의 원인(실적·업황)을 확인하며 비중을 점검합니다.', defend: '약세 업종 비중을 줄이는 쪽의 기회비용은 작습니다.' }
};

// The 3-month median between the long trend and the month tells a pause-and-resume apart from a straight run.
function midNote(state, ret6m, ret3m) {
  if (ret6m == null || ret3m == null) return '';
  if (state === 'leading' && ret3m < 0) return ' · 3개월로는 조정 구간이었다가 최근 1개월 다시 오름';
  if (state === 'pullback' && ret3m < 0) return ' · 3개월째 밀리는 중';
  if (state === 'rebound' && ret3m > 0) return ' · 3개월 기준으로는 이미 회복 중';
  return '';
}

function depthOk(trend, ret1m) {
  if (trend == null || ret1m == null || ret1m >= 0) return null;
  const before = ((1 + trend / 100) / (1 + ret1m / 100) - 1) * 100; // gain up to the start of the month
  return before > 0 ? -ret1m <= before / 2 : false;
}

function themeRow({ market, id, label, ret1m, ret3m, ret6m, above50, basis, groups = [], members = null, crossroads, credit, outcomes }) {
  const profile = themeProfile(market, id);
  const tags = profile?.tags || [];
  const trend = ret6m ?? ret3m;
  const state = themeStateOf(trend, ret1m);
  const lead = crossroads?.items?.find((item) => item.id === crossroads.leadId) || null;
  const alt = crossroads?.items?.find((item) => item.id === crossroads.altId) || null;
  const wind = { lead: windFor(tags, lead), alt: windFor(tags, alt) };
  const deep = state === 'pullback' && depthOk(trend, ret1m) === false;
  const favored = deep ? ['wait'] : state ? FAVOURED[state][wind.lead] : [];
  const why = deep ? '1개월 낙폭이 그 전까지 오른 폭의 절반을 넘어, 쉬어 가기보다 추세가 꺾이는 신호일 수 있습니다. 낙폭이 멈추고 50일선 위 종목 비율이 회복되는지 확인하기 전까지 기다리는 쪽의 비용이 작습니다.'
    : state ? (WHY[state][wind.lead] || WHY[state].other) : '';
  const conditions = state ? [
    [`긴 추세 유지 (${ret6m != null ? '6개월' : '3개월'} 중앙값 플러스)`, trend == null ? null : trend > 0],
    ['조정이 무너지지 않음 (50일선 위 종목 30% 이상)', above50 == null ? null : above50 >= 30],
    [`선두 거시 길에서 순풍 또는 중립${lead ? ` ('${lead.title.split(' — ')[0]}')` : ''}`, lead ? wind.lead !== 'head' : null],
    ['신용 안정 (신용 축 부담 아님)', credit == null || credit === 'unknown' ? null : credit !== 'burden'],
    // A drop that has taken back more than half of the gain before it is no longer a pause inside the trend.
    ...(state === 'pullback' ? [['조정 깊이 (1개월 낙폭이 그 전까지 오른 폭의 절반 이하)', depthOk(trend, ret1m)]] : [])
  ] : [];
  const known = conditions.filter(([, ok]) => ok != null);
  const met = known.filter(([, ok]) => ok).length;
  const proxy = outcomes?.themes?.[id]?.[state];
  const proxySymbol = outcomes?.themes?.[id]?.symbol;
  return {
    market, id, label, tags, tagLabels: tags.map((tag) => EXPOSURE_TAGS[tag]), thesis: profile?.thesis || null, breaks: profile?.breaks || [],
    ret1m, ret3m, ret6m, above50, basis, members, state, stateLabel: state ? `${THEME_STATES[state]}${midNote(state, ret6m, ret3m)}` : '판정 보류',
    wind, windText: lead ? `선두 길 '${lead.title.split(' — ')[0]}'에서 ${WIND_LABELS[wind.lead]}${alt ? ` · 함께 볼 길 '${alt.title.split(' — ')[0]}'에서 ${WIND_LABELS[wind.alt]}` : ''}` : '거시 갈림길 판단 보류',
    favored, favoredWhy: why, choices: state ? CHOICE_TEXT[state] : {},
    fit: known.length < 2 ? '판단 보류' : `조건 부합 ${met}/${conditions.length}`, met, total: conditions.length, known: known.length,
    basisText: conditions.map(([text, ok]) => `${text} ${ok == null ? '확인 불가' : ok ? '충족' : '미충족'}`),
    past: proxy ? frequencyText({ ...proxy, subject: proxySymbol }, `대표 ETF ${proxySymbol}가 같은 단계(${THEME_STATES[state].split(' (')[0]})였을 때`, { source: '장기 일봉 기록' }) : '같은 단계의 장기 과거 기록(대표 ETF)이 없어 빈도를 말하지 않습니다.',
    positioning: '레버리지·포지션 쏠림을 직접 재는 자료는 없습니다 — 1개월 낙폭과 50일선 위 비율로만 가격 쪽 단서를 봅니다.',
    groups
  };
}

/**
 * @param {object} input
 * @param {Array} input.usGroups buildGroupStrength().groups (current session only)
 * @param {Array} input.krThemes krThemeArtifactRead().themes
 * @param {object} input.crossroads buildMacroCrossroads() result
 * @param {string} [input.credit] credit axis state
 * @param {object} [input.outcomes] scenario-outcomes.v1
 * @param {object} [input.labels] US theme id → Korean name
 */
export function buildThemePlaybook({ usGroups = [], krThemes = [], crossroads = null, credit = null, outcomes = null, labels = {} } = {}) {
  const byTheme = new Map();
  for (const group of usGroups) {
    if (!group?.themeId || group.current === false) continue;
    if (!byTheme.has(group.themeId)) byTheme.set(group.themeId, []);
    byTheme.get(group.themeId).push(group);
  }
  const rows = [];
  for (const [id, groups] of byTheme) {
    const ret1m = median(groups.map((g) => g.ret1m)), ret3m = median(groups.map((g) => g.ret3m)), ret6m = median(groups.map((g) => g.ret6m));
    if (ret1m == null) continue;
    rows.push(themeRow({ market: 'US', id, label: labels[id] || groups[0].themeName || id, ret1m, ret3m, ret6m, above50: median(groups.map((g) => g.above50Pct)),
      basis: groups.map((g) => g.basis).filter(Boolean).sort().at(-1) || null,
      groups: groups.map((g) => ({ name: g.name, ret1m: g.ret1m, ret3m: g.ret3m, ret6m: g.ret6m, above50: g.above50Pct, state: themeStateOf(g.ret6m ?? g.ret3m, g.ret1m) })),
      crossroads, credit, outcomes }));
  }
  for (const theme of krThemes) {
    if (!(theme?.covered >= 3) || theme.ret1m == null) continue;
    rows.push(themeRow({ market: 'KR', id: theme.id, label: theme.label, ret1m: theme.ret1m, ret3m: theme.ret3m, ret6m: null, above50: theme.above50Pct, members: theme.covered, crossroads, credit, outcomes }));
  }
  const rotation = rotationOf(rows);
  const highlights = {
    // Only well-supported pullbacks (most known conditions met, including the depth check) are surfaced.
    structuralPullbacks: rows.filter((row) => row.state === 'pullback' && row.wind.lead !== 'head' && row.known >= 3 && row.met / row.known >= 0.75).sort((a, b) => b.met - a.met || b.ret1m - a.ret1m),
    headwindLeaders: rows.filter((row) => row.state === 'leading' && row.wind.lead === 'head'),
    tailwindLaggards: rows.filter((row) => row.state === 'weak' && row.wind.lead === 'tail')
  };
  return { available: rows.length > 0, version: THEME_PLAYBOOK_VERSION, themes: rows, rotation, highlights,
    asOf: rows.map((row) => row.basis).filter(Boolean).sort().at(-1) || null };
}

/** Which exposure tags gained and lost over the month, across every measured theme. */
export function rotationOf(rows) {
  const tally = new Map();
  for (const row of rows) for (const tag of row.tags) {
    if (!tally.has(tag)) tally.set(tag, []);
    tally.get(tag).push(row.ret1m);
  }
  const tags = [...tally].filter(([, values]) => values.length >= 2).map(([tag, values]) => ({ tag, label: EXPOSURE_TAGS[tag], ret1m: median(values), n: values.length })).sort((a, b) => b.ret1m - a.ret1m);
  const sorted = [...rows].sort((a, b) => b.ret1m - a.ret1m);
  const gainers = sorted.slice(0, 4), losers = sorted.slice(-4).reverse();
  const top = tags[0], bottom = tags[tags.length - 1];
  const spread = top && bottom ? top.ret1m - bottom.ret1m : null;
  // US and KR themes share names (반도체, 에너지): every named theme carries its market, and the sentence says where
  // the named moves sit when one market dominates them.
  const named = (row) => `${marketWord(row)} ${row.label}(${pct(row.ret1m)})`;
  const listed = [...gainers, ...losers.filter((row) => !gainers.includes(row))];
  const kr = listed.filter((row) => row.market === 'KR').length;
  const dominant = listed.length >= 4 && kr >= Math.ceil(listed.length * 0.75) ? ['국내', kr] : listed.length >= 4 && listed.length - kr >= Math.ceil(listed.length * 0.75) ? ['미국', listed.length - kr] : null;
  const where = dominant ? ` 이름이 나온 ${listed.length}개 중 ${dominant[1]}개가 ${dominant[0]} 테마라 이 움직임은 주로 ${dominant[0]} 시장의 것입니다.` : listed.length ? ' 미국·국내 테마에 함께 나타난 움직임입니다.' : '';
  const text = !top || !bottom || top === bottom ? '테마 기록이 부족해 가격 기준 강약 이동을 읽지 않습니다.'
    : spread < 3 ? `최근 1개월 테마 성격별 차이가 작습니다(가장 강한 '${top.label}' ${pct(top.ret1m)}, 가장 약한 '${bottom.label}' ${pct(bottom.ret1m)}) — 뚜렷한 가격 기준 강약 이동은 보이지 않습니다.`
      : `최근 1개월 가격 기준으로 '${bottom.label}' 성격의 테마(중앙값 ${pct(bottom.ret1m)})에서 '${top.label}' 성격의 테마(중앙값 ${pct(top.ret1m)})로 힘이 옮겨 갔습니다. 강한 쪽: ${gainers.map(named).join(', ')} · 약한 쪽: ${losers.map(named).join(', ')}.${where} 가격 흐름만으로 본 강약 이동이며 실제 자금 유출입 자료는 아닙니다.`;
  return { tags, gainers, losers, market: dominant ? dominant[0] : null, text };
}

/** Theme block for the AI: rotation, the notable combinations, and the themes a question names (or the most notable). */
export function renderThemePlaybookContext(model, { query = '' } = {}) {
  if (!model?.available) return '';
  const named = model.themes.filter((row) => row.label && query.includes(row.label.split(/[ /·]/)[0]));
  const notable = [...model.highlights.structuralPullbacks.slice(0, 4), ...model.highlights.headwindLeaders.slice(0, 2), ...model.highlights.tailwindLaggards.slice(0, 2), ...model.rotation.gainers.slice(0, 2), ...model.rotation.losers.slice(0, 2)];
  const picked = [...new Map([...named, ...notable].map((row) => [`${row.market}:${row.id}`, row])).values()].slice(0, 10);
  const line = (row) => `- [${row.market}] ${row.label}: ${row.stateLabel} (1개월 ${pct(row.ret1m)}${row.ret3m != null ? ` · 3개월 ${pct(row.ret3m)}` : ''}${row.ret6m != null ? ` · 6개월 ${pct(row.ret6m)}` : ''}${row.above50 != null ? ` · 50일선 위 ${row.above50}%` : ''}). 성격: ${row.tagLabels.join(', ') || '미분류'}. 거시: ${row.windText}. ${row.fit} [${row.basisText.join(', ')}]. 상대적으로 유리한 쪽: ${row.favored.map((key) => CHOICES[key]).join(', ') || '판단 보류'} — ${row.favoredWhy} 과거: ${row.past}${row.thesis ? ` 구조 가설: ${row.thesis}. 가설이 깨지는 신호: ${row.breaks.join(', ')}.` : ''}`;
  return [`【테마 갈림길 — 모든 테마를 같은 규칙으로(${model.asOf || '기준일 미확인'} 완료 종가)】`, `가격 기준 강약 이동(자금 유출입 자료 아님): ${model.rotation.text}`,
    model.highlights.structuralPullbacks.length ? `추세 속 조정 + 거시 역풍 아님: ${model.highlights.structuralPullbacks.slice(0, 6).map((r) => `${marketWord(r)} ${r.label}(${pct(r.ret1m)})`).join(', ')}` : '',
    model.highlights.headwindLeaders.length ? `거시 역풍에도 주도: ${model.highlights.headwindLeaders.map((r) => `${marketWord(r)} ${r.label}`).join(', ')} — 업종 고유 동력(실적·구조 수요) 확인 필요` : '',
    ...picked.map(line),
    '레버리지·포지션 쏠림은 직접 자료가 없다 — 주장하려면 웹 출처를 붙이고, 없으면 가격 단서(낙폭·50일선 위 비율)로만 말하라. 세부 종목은 테마 상세·차트·기업·스크리너에서 사용자가 고른다.'].filter(Boolean).join('\n');
}
