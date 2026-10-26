// P1633: what each market path would mean for the reader — how many of its conditions the current closes meet,
// the related sectors and themes, and what to check, watch and ignore. T06 (expert review 2026-10-13, coordinator
// decision): the '개연성 높음/중간/낮음' grade became "현재 조건 충족 n/m" (a count, not a likelihood), and the
// allocation/timing advice (현금·단기채 비중, 기다리는 쪽, 기준선 가까운 종목이 유리) was removed — each path keeps only
// what it would mean, what confirms it and what would refute it. No price, size or timing instruction.
import { CHOICE_WORDS } from '../content/choice-words.js';
import { creditStable, isDefensiveSector } from '../interpretation/concepts.js';
import { RULES } from '../rules/thresholds.js';
import { TRANSITION_TITLE } from './regime-scenarios.js';
import { resolveMarketCalendarSession } from './market-calendar.js';
import { shortDate } from '../content/date-labels.js';
import { withDirectionParticle, withSubjectParticle } from '../content/korean-particle.js';
import { rsRecentCheck, rrgSettledQuadrant } from '../themes/recent-check.js';
import { signedText } from '../shared/number.js';

export const SCENARIO_OUTLOOK_VERSION = 'scenario-outlook.v1';

// v58.68: the label map lives with the defensive set in concepts.js (a leaf module the money-flow line can import without
// a cycle through market-read); this re-export keeps every existing reader.
export { SECTOR_ETF_LABELS } from '../interpretation/concepts.js';
// The defensive set and the credit rule are the shared concepts (src/domain/interpretation/concepts.js).

const join = (items) => items.filter(Boolean).join(', ');
// v57.81: the next US session after the basis close — the transition reading names when it is checked next.
function nextUsSession(asOf) {
  const start = Date.parse(`${asOf}T12:00:00Z`);
  if (!Number.isFinite(start)) return null;
  for (let day = 1; day <= 10; day += 1) {
    const date = new Date(start + day * 86400000).toISOString().slice(0, 10);
    if (resolveMarketCalendarSession({ market: 'US', date }).status === 'open') return date;
  }
  return null;
}
// v57.81 (audit 2026-10-15): RRG quadrants trail price by weeks — XLK sat in 선도 while it trailed SPY by 5.4% in a week.
// The five-session check is the themes screen's (rsRecentCheck: the relative-strength line, sector / SPY, against twice
// its own typical five-session move), so 테마·섹터 and the market screens drop the same 선도. Null when the line does
// not end on the row's own session.
export function sectorRecentCheck(row) {
  const line = Array.isArray(row?.relativeStrength) ? row.relativeStrength : null;
  if (!line || (row.sessionDate && line[line.length - 1]?.sessionDate !== row.sessionDate)) return null;
  const check = rsRecentCheck(line);
  return check ? { rel5: check.change, fell: check.fell, threshold: check.threshold } : null;
}
export const sectorRelative5d = (row) => sectorRecentCheck(row)?.rel5 ?? null;
// v57.84 (owner decision 3-3): the settled quadrant (the row's own-noise band + hysteresis), as on 테마 · 섹터; the raw
// quadrant only when the row has no coordinates.
const quadrantOf = (row) => { const settled = rrgSettledQuadrant(row); return settled && settled !== 'Border' ? settled : settled ? null : row?.quadrant; };
export const leaderFading = (row) => quadrantOf(row) === 'Leading' && row?.fell === true && Number.isFinite(row?.rel5);
// v57.81: the themes screen's RRG neutral band — a point too close to 100 is 경계, not 선도/개선.
export const rrgBorder = (row) => rrgSettledQuadrant(row) === 'Border';
const rel5Text = (rows) => rows.map((row) => `${row.label} 상대강도 ${signedText(row.rel5, 1)}%`).join(', ');
const likelihoodOf = (met, total, confirmed) => confirmed ? '높음' : met / total >= 0.5 ? '중간' : '낮음'; // internal ordering key only
export const fitLabel = (met, total) => `조건 충족 ${met}/${total}`; // P1745: one notation with the branches

/**
 * @param {object} input
 * @param {object} input.scenarios buildMarketScenarios() result
 * @param {object} input.regime buildMarketRegime() result
 * @param {{symbol:string,label:string,quadrant:string}[]} [input.sectors] produced RRG rows (current session only)
 * @param {{name:string,ret3m:number}[]} [input.themes] US sub-theme strength, strongest first
 */
export function buildScenarioOutlook({ scenarios, regime, sectors = [], themes = [] } = {}) {
  if (!scenarios?.available || !regime?.available) return { available: false, version: SCENARIO_OUTLOOK_VERSION, items: [] };
  const state = Object.fromEntries((regime.axes || []).map((axis) => [axis.id, axis.state]));
  const calm = (id) => state[id] && state[id] !== 'burden' && state[id] !== 'unknown';
  // v57.50 D01: "신용 안정" is the shared credit judgement's 'favorable' only (creditState in market-read). A neutral
  // credit axis — e.g. HY +45bp over 20 sessions — is not stable, and the unmet note says whether it is widening.
  const creditAxis = (regime.axes || []).find((axis) => axis.id === 'credit');
  const creditIsStable = creditStable(state.credit) === true;
  const creditNote = creditIsStable || state.credit === 'burden' ? null : state.credit === 'unknown' || !state.credit ? '확인 불가' : creditAxis?.widening ? '확대 중' : '신용 지표 중립';
  const leadingRows = sectors.filter((row) => quadrantOf(row) === 'Leading' && !leaderFading(row) && !rrgBorder(row));
  const fadingRows = sectors.filter(leaderFading);
  const leading = leadingRows.map((row) => row.label);
  const fadingNote = fadingRows.length ? `. 선도였지만 최근 5거래일 상대강도가 꺾인 업종: ${rel5Text(fadingRows)}` : '';
  const improvingRows = sectors.filter((row) => quadrantOf(row) === 'Improving' && !rrgBorder(row));
  const improving = improvingRows.map((row) => row.label);
  // v57.81: 약화(Weakening) is losing momentum — it is not called "버티는"; a fading 선도 is not either.
  const defensiveHolding = sectors.filter((row) => isDefensiveSector(row.symbol) && (quadrantOf(row) === 'Leading' || quadrantOf(row) === 'Improving') && !leaderFading(row) && !rrgBorder(row)).map((row) => row.label);
  const topThemeRows = themes.slice(0, 3);
  const topThemes = topThemeRows.map((row) => row.name);
  // v57.54 audit (9): the missing-rotation reason was developer copy on the reader's face; the sentence just points to 테마.
  const sectorNote = '';
  // v57.81 (owner 2026-10-15): 소수 종목 주도 needs the leaders to be holding; a break (regime.leadership) fails the check.
  const leadership = regime.leadership || { state: 'unknown', break: false };
  const leadersHolding = leadership.state === 'holding';
  const leadershipNote = leadersHolding ? null : leadership.break ? '주도 영역 이탈' : leadership.state === 'weak' ? '주도주 약세' : '확인 불가';
  const transition = !scenarios.held && !!leadership.break && !scenarios.scenarios.find((item) => item.id === 'weakness')?.confirmed;
  const nextCheck = nextUsSession(scenarios.asOf);
  const checks = {
    expansion: [['추세 양호', state.trend === 'favorable'], [`시장 폭 양호(50·200일선 위 ${RULES.breadth.broadAtLeast}% 이상)`, state.breadth === 'favorable'], ['신용 안정', creditIsStable, creditNote], ['변동성 안정', calm('volatility')]],
    concentration: [['추세 양호', state.trend === 'favorable'], [`시장 폭 부담(${RULES.breadth.weakBelow}% 미만)`, state.breadth === 'burden'], ['신용 안정', creditIsStable, creditNote], ['변동성 안정', calm('volatility')], ['주도 영역 유지', leadersHolding, leadershipNote]],
    weakness: [['추세 부담', state.trend === 'burden'], ['시장 폭 부담', state.breadth === 'burden'], ['신용 또는 변동성 부담', state.credit === 'burden' || state.volatility === 'burden']]
  };
  // I03: the names in "관련 섹터·테마" are also links — a sector opens 테마 · 섹터, a theme its detail page.
  const sectorLinks = (labels) => labels.map((label) => ({ kind: 'sector', label }));
  const themeLinks = topThemeRows.map((row) => ({ kind: 'theme', label: row.name, themeId: row.themeId || null }));
  const guide = {
    expansion: {
      posture: '이 흐름이라면 상승이 소수 대형주를 넘어 다수 종목으로 퍼지는 국면입니다. 그동안 뒤처졌던 업종과 중소형주의 참여가 함께 늘어나는지가 이 해석을 확인하는 근거입니다. 반증: 50일선·200일선 위 비율이 ' + RULES.breadth.broadAtLeast + '% 아래로 다시 내려오거나 하이일드 스프레드가 넓어지면 확산 해석을 다시 봅니다.',
      // v57.81: the RRG window is named (약 50일 기준) and a fading 선도 is listed apart with its five-session relative return.
      opportunity: (improving.length || leading.length ? `${improving.length ? `섹터 회전(RRG·약 50일 기준)에서 개선 중: ${join(improving)}` : '개선 중인 섹터는 아직 없음'}, 선도: ${join(leading) || '없음'}` : `확산이 확인되면 후행 업종의 개선 여부를 섹터 회전에서 확인합니다${sectorNote}.`) + fadingNote,
      // v58.80 (first-users bundle 1): the link form dropped fadingNote, so 선도 read five sectors here beside six on 테마와
      // 섹터 (경기소비재 fading). The fading and border leaders are their own parts, and the parts add up to that count.
      opportunityLinks: [{ label: '섹터 회전(약 50일 기준)에서 개선 중', links: sectorLinks(improving) }, { label: '선도', links: sectorLinks(leading) },
        { label: '선도였지만 최근 5거래일 상대강도가 꺾인 업종', links: sectorLinks(fadingRows.map((row) => row.label)) },
        { label: '선도와 다른 구역의 경계', links: sectorLinks(sectors.filter((row) => quadrantOf(row) === 'Leading' && !leaderFading(row) && rrgBorder(row)).map((row) => row.label)) }].filter((part) => part.links.length),
      check: [`50일선·200일선 위 종목 비율이 함께 ${RULES.breadth.broadAtLeast}% 이상을 유지하는지`, '52주 신고가 종목이 신저가보다 꾸준히 많은지', '러셀 2000이 S&P 500을 따라오거나 앞서는지'],
      caution: ['20일선 위 비율만 오르고 50일선 비율이 따라오지 않으면 확산이라고 보기 이릅니다.', '하이일드 스프레드가 다시 넓어지면 회복의 근거가 약해집니다.'],
      // P1727: "지수 하루 하락" read as "ignore today's -5.5% KOSPI"; the item names the ordinary US day and excludes rare moves.
      ignore: ['VIX의 하루 등락', '미국 지수의 평범한 하루 하락 — 참여 비율이 유지되면 추세 판단을 바꿀 근거가 아닙니다(기록상 드문 급락이나 한국 시장의 급락은 넘기지 않고 따로 확인).']
    },
    concentration: {
      posture: '이 흐름이라면 지수는 소수 주도 영역이 끌어올리고 나머지 종목의 참여는 약한 상태입니다. 주도 영역의 상대강도가 유지되는 동안 지수는 버틸 수 있지만, 주도 영역이 꺾이면 지수 전체가 함께 흔들릴 수 있습니다. 반증: 참여 비율이 다시 넓어지면 확산 쪽, 주도 섹터가 약화로 바뀌고 분배일이 늘면 약화 쪽을 확인합니다.',
      // C23: the sector names come from the relative-strength rotation (RRG quadrant), not from today's or this week's
      // returns — a sector can lead on relative strength while being the weakest tile on the 1-day map.
      // v57.81: RRG trails price by weeks; while the leadership break holds, the line says the leaders' recent drop beside it.
      opportunity: (leading.length || topThemes.length ? join([join(leading) && `상대강도 선도(RRG·약 50일 기준): ${join(leading)}`, topThemes.length && `3개월 상위 테마: ${join(topThemes)}`]) : `주도 섹터·테마는 테마 화면에서 확인합니다${sectorNote}.`) + fadingNote
        + (leadership.break && leadership.drop5 != null ? `, 상대강도는 몇 주 늦게 반영 — 나스닥 100은 최근 5거래일 ${signedText(leadership.drop5, 1)}%` : ''),
      opportunityLinks: [{ label: '상대강도 선도(RRG·약 50일 기준)', links: sectorLinks(leading) }, { label: '3개월 상위 테마', links: themeLinks }].filter((part) => part.links.length),
      check: ['주도 섹터의 상대강도가 유지되는지(선도 → 약화로 바뀌는지)', '지수 고점과 50일선 위 종목 비율의 괴리가 줄어드는지', '분배일(거래량 실린 하락일)이 늘어나는지'],
      caution: ['분배일이 누적되고 신저가 종목이 늘면, 집중 장세가 끝나 가는지 주도 섹터의 상대강도와 50일선 위 비율로 확인합니다.', '주도 종목 한두 개의 실적 실망이 지수 전체를 흔들 수 있습니다.'],
      ignore: ['후행 업종의 하루 반등 — 참여 비율이 넓어지기 전에는 흐름 전환으로 읽지 않습니다.', '지수 신고가 자체 — 참여가 좁으면 시장 전체가 강하다는 뜻이 아닙니다.']
    },
    weakness: {
      posture: '이 흐름이라면 지수와 참여도의 약화가 신용 또는 변동성 스트레스와 함께 나타나는 국면입니다. 하루 반등보다 지수의 50일선 회복과 시장 폭 개선이 함께 확인되는지가 흐름이 바뀌었는지 가르는 근거입니다. 반증: HY 확대가 멈추고 변동성이 진정되며(VIX 급등·단기 불안 비율 역전 해소) S&P 500이 50일선을 되찾으면 약화 해석을 다시 봅니다.',
      opportunity: defensiveHolding.length ? `상대강도로 버티는 방어 섹터(RRG·약 50일 기준, 하루 등락과 다를 수 있음): ${join(defensiveHolding)}` : `방어 섹터(헬스케어·필수소비재·유틸리티)의 상대강도를 섹터 회전에서 확인합니다${sectorNote}.`,
      opportunityLinks: [{ label: '상대강도로 버티는 방어 섹터(RRG·약 50일 기준, 하루 등락과 다를 수 있음)', links: sectorLinks(defensiveHolding) }].filter((part) => part.links.length),
      check: ['하이일드 스프레드 확대가 멈추는지', `VIX 단기 불안 비율 역전(${RULES.volatility.invertedRatioAt} 이상)이 풀리는지`, 'S&P 500이 50일선을 되찾는지(추세 판정이 바뀌는 선)'],
      caution: ['급락 직후 하루 반등만으로는 추세 회복을 확인할 수 없습니다 — 50일선 회복과 시장 폭 개선이 함께 필요합니다.', '"많이 빠져서 싸다"는 것은 추세 회복의 근거가 아닙니다.'],
      ignore: ['단기 과매도 지표 하나만의 신호', '하루짜리 정책·뉴스 헤드라인']
    }
  };
  // v57.81: while the leadership break holds and weakness is not yet confirmed, the weakness card reads as the transition —
  // what confirms it, what refutes it and when it is checked next. Descriptive only; the met count stays weakness's own.
  const transitionGuide = transition ? {
    title: TRANSITION_TITLE,
    // v58.74 (audit): 10/23 met the old falsifier (NDX 5d -0.8%, 신고가 43 > 신저가 35) while NDX sat 2.9% under its
    // 50일선 and the break held; the falsifier now names the hold rule, and the lead no longer claims breadth weakened.
    posture: `주도 영역(나스닥 100)이 꺾여, 소수 종목이 받치던 흐름이 동반 약세로 넘어가는지 확인하는 단계입니다. 확인: 추세가 부담으로 바뀌거나(S&P 500 200일선 이탈, 또는 하락하는 50일선 아래) 하이일드 스프레드 확대나 VIX 급등이 겹치면 동반 약세 쪽입니다. 반증: 나스닥 100이 50일선(${RULES.trend.bufferPct}% 이내)을 되찾고 5거래일 낙폭도 ${RULES.trend.leaderDrop5dPct}% 안이면 주도 영역 이탈이 풀려 소수 주도로 되돌아간 것으로 봅니다. 다음 확인: ${nextCheck ? `${shortDate(nextCheck)} ` : '다음 '}미국 확정 종가.`,
    check: ['나스닥 100이 50일선 위를 지키는지, 5거래일 낙폭이 줄어드는지', '신저가가 신고가보다 많은 날이 이어지는지', '러셀 2000이 200일선을 되찾는지', '하이일드 스프레드와 VIX가 함께 오르는지'],
    caution: ['하루 반등만으로 주도 영역이 회복됐다고 보지 않습니다.', '동반 약세 조건이 모두 갖춰지기 전까지는 전환을 확인하는 단계이지 확정이 아닙니다.'],
    leadershipBasis: `주도 영역 이탈 확인(${leadership.summary || ''}, 확인 ${leadership.met}/${leadership.confirmations?.length || 0})`,
    nextCheck
  } : null;
  const items = scenarios.scenarios.map((scenario) => {
    const list = checks[scenario.id] || [];
    const met = list.filter(([, ok]) => ok).length;
    const level = scenario.held ? '판단 보류' : likelihoodOf(met, list.length, scenario.confirmed);
    // v57.55 review (E2-06): every listed condition is required for the flow (scenarios.confirmed needs all of them), so
    // '3/4' with credit failing is not "almost there" — the missing condition is named and the flow reads as not formed.
    const missingNames = list.filter(([, ok]) => !ok).map(([label]) => label.split('(')[0]);
    const shortfall = !scenario.held && met > 0 && met < list.length ? `${withSubjectParticle(missingNames.join('·'))} 빠져 아직 성립하지 않음` : null;
    const basis = list.map(([label, ok, note]) => `${label} ${ok ? '충족' : `미충족${note ? `(${note})` : ''}`}`).join(', ');
    const item = { id: scenario.id, title: scenario.title, likelihood: level, fit: scenario.held ? '판단 보류' : fitLabel(met, list.length), shortfall, met, total: list.length, basis, ...guide[scenario.id] };
    if (scenario.id !== 'weakness' || !transitionGuide) return item;
    return { ...item, title: transitionGuide.title, transition: true, nextCheck: transitionGuide.nextCheck, posture: transitionGuide.posture, check: transitionGuide.check, caution: transitionGuide.caution,
      shortfall: missingNames.length ? `아직 빠진 동반 약세 조건: ${missingNames.join(', ')}` : null, basis: `${transitionGuide.leadershipBasis}, ${basis}` };
  });
  const order = { 높음: 3, 중간: 2, 낮음: 1, '판단 보류': 0 };
  // v57.84 (R707): a flow can lead only with its defining condition — 고른 상승 needs broad breadth, 소수 종목 주도 narrow
  // breadth, 동반 약세 a burdened trend. Ranking met/total across lists of 4, 5 and 3 conditions let 소수 종목 주도 lead at
  // 2/5 on 2026-10-15 with breadth neutral, i.e. without the one condition that names it.
  const defining = { expansion: state.breadth === 'favorable', concentration: state.breadth === 'burden', weakness: state.trend === 'burden' };
  const gated = items.filter((item) => defining[item.id]);
  // v57.81: the transition leads while it holds — a higher count elsewhere would otherwise name a flow whose premise broke.
  const lead = items.find((item) => item.transition) || [...gated].sort((a, b) => order[b.likelihood] - order[a.likelihood] || b.met / b.total - a.met / a.total)[0] || null;
  const headline = scenarios.held ? '필요한 관측이 없어 지금 어느 흐름에 가까운지 판단을 보류합니다.'
    : !lead ? '세 흐름 모두 이름을 정하는 핵심 조건(고른 상승은 넓은 시장 폭, 소수 종목 주도는 좁은 시장 폭, 동반 약세는 추세 부담)이 갖춰지지 않아 지금은 어느 흐름이라고 보기 이릅니다.'
      : lead.transition ? `소수 종목 주도의 전제였던 주도 영역이 꺾여, 지금은 ${withDirectionParticle(`'${lead.title}'`)} 읽습니다(${lead.fit}${lead.shortfall ? `, ${lead.shortfall}` : ''}).`
        : `핵심 조건을 갖춘 흐름은 '${lead.title}'(${lead.fit}${lead.shortfall ? `, ${lead.shortfall}` : ''})입니다.`;
  // I02: the rotation names travel with the outlook so 시장 상태's "이어서 볼 곳" can quote the same leaders.
  return { available: true, version: SCENARIO_OUTLOOK_VERSION, asOf: scenarios.asOf, headline, leadId: scenarios.held ? null : lead?.id || null, items,
    // v57.81: the rotation the links quote carries only leaders that are not fading on the last five sessions.
    rotation: { Leading: leadingRows, Improving: improvingRows, Fading: fadingRows } }; // M07: no lead while held
}

export function renderScenarioOutlookContext(outlook) {
  if (!outlook?.available) return '';
  return `${outlook.asOf} 확정 종가 기준 시나리오별 현재 조건 충족 수(규칙 충족 수이며 확률이나 가능성 등급이 아님). ${outlook.headline}\n`
    + outlook.items.map((item) => `${item.title}: ${item.fit} (${item.basis}). 읽기: ${item.posture} 관련 섹터·테마: ${item.opportunity} 확인: ${item.check.join('; ')} 조심: ${item.caution.join(' ')} 넘겨도 됨: ${item.ignore.join('; ')}`).join('\n')
    // P1742 (owner 2026-10-13, supersedes T06): choices and opportunity cost come from the 시나리오 block; only instructions stay out.
    + '\n가격·수량·시점·특정 종목 매매 지시는 하지 않는다. 선택지별 기회비용과 ' + CHOICE_WORDS.favored + '은 【향후 시나리오】 근거로만 말할 것.';
}
