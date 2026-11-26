// Chat tools about the market as a whole: the screener query, the 테마 screen's sector and theme flow, the 매크로 release
// rows, the long-history scenario and theme-stage records, and the news cache. Each wraps a reader the screens or the chat already use.
import { buildChatMacroLines, kstStamp } from '../context/chat-macro-lines.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { SCENARIO_OUTCOMES, STRESS_OUTCOMES } from '../../data/artifact-registry.js';
import { currentScenarioOutcomes } from '../../domain/scenarios/outcome-fingerprints.js';
import { branchDecisionFrame, decisionFrameContext, themeDecisionFrame } from '../../domain/scenarios/decision-frame.js';
import { correctionReading } from '../../domain/scenarios/correction-base-rates.js';
import { vixBandRecord, vixBandRiskLine } from '../../domain/market/signal/vix-band-record.js';
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { BRANCH_ANALOGS, THEME_STATES, THEME_OUTCOME_BENCHMARK, frequencyText, themeOutcomeCurrent } from '../../domain/scenarios/analogs.js';
import { readNumber } from '../../domain/shared/number.js';
import { stampDay as day } from '../../domain/shared/session-date.js';
import { resolveToolSymbol, symbolLabel } from './symbol.js';
import { SCREEN_LIMIT, SCREEN_MARKETS, SCREEN_SORTS, SCREEN_SYMBOL_LIMIT, formatScreenResult, runScreen, screenerInput } from '../context/screener-query.js';
import { CUSTOM_CONDITIONS, conditionSource } from '../../domain/screener/custom-conditions.js';
import { CAP_BUCKETS } from '../../domain/screener/row-presentation.js';
import { requestConsensusEstimates } from '../../data/consensus-estimates.js';
import { interpretationStore, screenerRowsForRoot } from '../../data/selectors/interpretation.js';
import { rankSectorPeriod, sectorPeriodMode, themeItemLabel, themeMembersFor, usCloseSession, viewItems } from '../../data/selectors/theme-flow.js';
import { selectThemesItems } from '../../state/selectors/themes.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { capReading } from '../../domain/screener/row-presentation.js';
import { krThemeLabel } from '../../domain/themes/kr-themes.js';
import { signedText } from '../../domain/shared/number.js';
import { fundingChainInputs, loadFundingChainInputs } from '../../data/funding-chain.js';
import { marketReadingFundingLines } from '../../domain/themes/ai-funding-chain.js';

const objectSchema = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const latest = (values) => values.map(day).filter(Boolean).sort().at(-1) || null;
const FUNDING_TOPIC = 'ai-funding';
const MACRO_TOPICS = Object.freeze({ macro: '미국 매크로', 'kr-macro': '한국 매크로', fxbond: '환율·채권', [FUNDING_TOPIC]: 'AI 자금 조달 사슬' });

// The AI funding chain (테마와 섹터) with the hand-researched rows behind it: capex against cash flow, bond yields and
// spreads, and the figures no machine source publishes (single-name CDS, private credit, compute and memory prices, fund
// flows). The same lines the AI market reading is given. A researched row is a dated reference value read from a source
// page, never a live quote; each line says which kind it is and its own date.
async function fundingTopic(root, now) {
  await loadFundingChainInputs(root);
  const lines = marketReadingFundingLines(fundingChainInputs(root, { nowMs: now }));
  // Every line states its own date after the same word; the newest of them dates the whole result.
  const asOf = latest(lines.flatMap((line) => line.split('기준일 ').slice(1).map((part) => part.slice(0, 10))));
  if (!asOf) return { error: 'AI 자금 조달 사슬 자료를 받지 못했습니다. 없는 값은 추정하지 않는다.' };
  return { text: lines.join('\n'), asOf: `가장 최근 기준일 ${asOf}, 항목별 기준일은 각 줄 — 조사 자료는 그날 확인한 참고 값이며 실시간 시세가 아니다`, entities: [] };
}

// The screen tool runs the screener screen's own conditions (custom-conditions.js) through the chat's screener engine, all
// joined by AND as the screen joins them. The cash conditions (FCF margin, capex ÷ revenue) read metrics the screener
// page's lazy UI chunk builds from the SEC fiscal history (root._aioScreenerCash); this tool cannot build them, so they
// apply only when the page has already built them and are otherwise reported as not applied. Forward PER loads the
// consensus file when asked for; the research-channel conditions read the digest signals the page already holds.
// The tool does not claim "same as the screen" while dropping the cash conditions silently: its result
// names the conditions applied by id and every requested one it could not evaluate, with the reason.
const SCREEN_CONDITION_IDS = CUSTOM_CONDITIONS.map((item) => item.id);
const CASH_CONDITION_IDS = CUSTOM_CONDITIONS.filter((item) => item.source === 'sec-fiscal-history').map((item) => item.id);
const CASH_UNAVAILABLE = '현금흐름 지표는 스크리너 화면에서 이 조건을 켜야 계산되고, 아직 계산되지 않아 이 도구가 판정할 수 없음';
function screenConditionPlan(requested, root) {
  const applied = [], skipped = [];
  for (const item of Array.isArray(requested) ? requested : []) {
    const id = String(item?.id || '');
    if (!SCREEN_CONDITION_IDS.includes(id)) skipped.push({ id: id || '(빈 id)', reason: '스크리너 조건 목록에 없는 id' });
    else if (CASH_CONDITION_IDS.includes(id) && !root?._aioScreenerCash?.map) skipped.push({ id, reason: CASH_UNAVAILABLE });
    else applied.push(item);
  }
  return { applied, skipped };
}
const nullable = (type, description) => ({ type: [type, 'null'], description });
const screen = {
  name: 'screen',
  description: `스크리너 화면의 조건 정의로 앱 종목 DB를 걸러 최대 12종목을 돌려준다(조건별 통과 수와 0종목일 때 막은 조건 포함). 조건은 화면처럼 모두 만족(AND)만 된다. ${CASH_CONDITION_IDS.join('·')}는 스크리너 화면이 현금흐름 지표를 계산해 둔 뒤에만 적용되고, 결과는 적용한 조건 id와 적용하지 못한 조건·이유를 밝힌다. 질문의 조건을 아래 구조로 옮겨 호출한다. 예: "PER 20배 이하이고 3개월 주가가 오른 미국 대형주" → market US, sizes [MEGA, LARGE], conditions [{id: pe-max, value: 20, strict: false}, {id: ret3m-min, value: 0, strict: true}].`,
  parameters: objectSchema({
    symbols: { type: 'array', items: { type: 'string' }, description: `종목을 지정해 그 종목의 스크리너 행을 읽는다(최대 ${SCREEN_SYMBOL_LIMIT}개, 티커나 종목명). 종목 화면·스크리너 표와 같은 PER·PBR·ROE·순이익률·매출 성장률·배당수익률·기간 수익률·50일선 대비가 온다. 지정하면 시장·크기·섹터·테마·지수 범위는 쓰지 않는다. 조건 검색이면 빈 배열` },
    market: { type: 'string', enum: [...SCREEN_MARKETS], description: '상장 시장(US 미국, KR 한국). 말이 없으면 US' },
    sizes: { type: 'array', items: { type: 'string', enum: Object.keys(CAP_BUCKETS) }, description: `시가총액 구간(스크리너 필터와 같은 경계): ${Object.entries(CAP_BUCKETS).map(([id, label]) => `${id} ${label}`).join(', ')}. "대형주"는 보통 MEGA와 LARGE. 빈 배열은 제한 없음. 한국 종목은 시가총액 자료가 없다` },
    sector: nullable('string', '섹터: Technology, Communication Services, Consumer, Consumer Defensive, Healthcare, Financials, Energy, Industrials, Utilities, Materials, Real Estate, ETF 또는 한국어 섹터어(반도체, 금융, 바이오 등). 없으면 null'),
    theme: nullable('string', '앱 테마 이름(방산, 원전, 우주, 전력 등). 섹터와 함께 쓰면 둘 다 만족. 없으면 null'),
    index: nullable('string', '지수 편입: SP500, NASDAQ100, SP400, RUSSELL2000, KOSPI, KOSDAQ. 없으면 null'),
    conditions: { type: 'array', items: objectSchema({
      id: { type: 'string', enum: SCREEN_CONDITION_IDS },
      value: nullable('number', '조건의 n 값. null이면 기본값'),
      strict: { type: 'boolean', description: 'true면 경계값을 뺀다(이하→미만, 이상→초과). "오른"은 ret3m-min 0 strict true' }
    }), description: `모두 만족(AND)해야 하는 조건. ${CUSTOM_CONDITIONS.map((item) => `${item.id}: ${item.label.replace('{n}', 'n')}${item.value != null ? ` [n 기본 ${item.value}]` : ''}`).join('; ')}` },
    sort: { type: 'string', enum: Object.keys(SCREEN_SORTS), description: `정렬 기준: ${Object.entries(SCREEN_SORTS).map(([id, label]) => `${id} ${label}`).join(', ')}. 말이 없으면 marketCap` },
    order: { type: 'string', enum: ['desc', 'asc'], description: 'desc 큰 값부터, asc 작은 값부터(PER 낮은 순은 asc)' },
    limit: { type: 'integer', description: `돌려받을 종목 수(1~${SCREEN_LIMIT})` }
  }),
  maxChars: 6000,
  label: () => '조건 검색',
  async run(args, { root, now }) {
    const { applied: conditions, skipped } = screenConditionPlan(args?.conditions, root);
    if (conditions.some((item) => conditionSource(item.id) === 'consensus-estimates')) await requestConsensusEstimates(root);
    const input = screenerInput(root, { now });
    if (!input.rows.length) return { error: '종목 DB를 읽을 수 없습니다.' };
    const symbols = (Array.isArray(args?.symbols) ? args.symbols : []).map((word) => resolveToolSymbol(root, word) || String(word || '').trim().toUpperCase()).filter(Boolean);
    const result = runScreen({ ...args, symbols, conditions }, input);
    if (!result.matched) return { error: result.error };
    const asOf = latest(result.rows.map((row) => row.factorSessionDate)) || latest(input.rows.map((row) => row?.factorSessionDate)) || day(input.rankAsOf);
    if (!asOf) return { error: '종목 DB의 기준일을 확인하지 못했습니다.' };
    const [head, ...body] = formatScreenResult(result).split('\n');
    const plan = [`적용한 조건 id: ${conditions.length ? conditions.map((item) => item.id).join(', ') : '없음'}`,
      ...(skipped.length ? [`적용하지 못한 조건(결과는 이 조건 없이 거른 것): ${skipped.map((item) => `${item.id} — ${item.reason}`).join('; ')}`] : [])];
    return { text: [head, ...plan, ...body].join('\n'), asOf: `팩터 ${asOf} 종가`, entities: result.rows.map((row) => row.sym) };
  }
};

// The 테마 screen's reads of where money is going, as lines: the sector bars (the screen's default window, beside SPY) and
// every theme's stage (the shared interpretation's playbook, the rows the stage table and the answer visual draw); with a
// theme, its stage and its members in the member table's default order (3개월 수익률 높은 순).
const FLOW_MARKETS = Object.freeze({ ALL: '미국·한국', US: '미국', KR: '한국' });
const FLOW_MEMBER_LIMIT = 10;
const FLOW_MEMBER_SORT = 'ret3m';
const flowPct = (value, digits = 1) => (value == null ? '—' : `${signedText(value, digits)}%`);
const stageName = (state) => (THEME_STATES[state] ? THEME_STATES[state].split(' (')[0] : '판정 보류');
const marketWord = (market) => (market === 'KR' ? '한국' : '미국');
const flowKey = (text) => String(text || '').toLowerCase().replace(/\s+/g, '');
// A playbook row's long window: 6개월 in the US, 3개월 in Korea (theme-playbook.js relativeStage).
const trendOf = (theme) => (theme.ret6m != null ? ['6개월', theme.ret6m] : ['3개월', theme.ret3m]);

function flowView(root, now) {
  const store = interpretationStore(root);
  const rows = screenerRowsForRoot(root, store);
  const playbook = marketInterpretation(root, { store, nowMs: now })?.playbook || null;
  return { rows, store: store || { getState: () => ({ screener: { rows } }) }, items: selectThemesItems(store?.getState?.() || {}), playbook: playbook?.available ? playbook : null };
}

function sectorFlowLines(root, { rows, items }) {
  const byRow = new Map(rows.filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  const mode = sectorPeriodMode(items, byRow);
  const close = usCloseSession(root);
  const { period, spy, rows: ranked } = rankSectorPeriod(viewItems(items, 'sectors'), byRow, mode, { close });
  const measured = ranked.filter((row) => row.pct != null);
  const session = mode === '1d' || mode === '1w';
  const asOf = session ? close || null : latest(measured.map((row) => byRow.get(row.symbol.toUpperCase())?.factorSessionDate));
  if (!measured.length || !asOf) return { lines: [], asOf: null };
  const digits = session ? 2 : 1;
  return { asOf, lines: [`미국 섹터 ${period[1]} 수익률 (${asOf} 종가${spy != null ? `, 같은 기간 SPY ${flowPct(spy, digits)}` : ''}, 높은 순):`,
    measured.map((bar) => `${themeItemLabel(root, bar.item)} ${bar.symbol} ${flowPct(bar.pct, digits)}${bar.vsSpy != null ? `(SPY 대비 ${signedText(bar.vsSpy, 1)}%p)` : ''}`).join(', ')] };
}

function stageFlowLines(playbook, market) {
  const list = playbook.themes.filter((theme) => theme.market === market);
  if (!list.length) return [];
  const versus = list.find((theme) => theme.relative)?.relative?.name;
  const lines = [`${marketWord(market)} 테마 단계 (${playbook.asOfByMarket?.[market] || '기준일 미확인'} 확정 종가, 긴 추세와 1개월 움직임을 ${versus ? `${versus} 대비로` : '절대 수익률로'} 판정${market === 'US' && playbook.lagging?.US ? ', 최근 거래일 종가 반영 전이라 참고용' : ''}):`];
  for (const state of [...Object.keys(THEME_STATES), null]) {
    const group = list.filter((theme) => (theme.state || null) === state).sort((a, b) => b.ret1m - a.ret1m);
    if (group.length) lines.push(`- ${stageName(state)} ${group.length}: ${group.map((theme) => { const [name, trend] = trendOf(theme); return `${theme.label}[${theme.id}] 1개월 ${flowPct(theme.ret1m)}, ${name} ${flowPct(trend)}`; }).join('; ')}`);
  }
  return lines;
}

function flowOverview(root, view, market) {
  const markets = market === 'ALL' ? ['US', 'KR'] : [market];
  const sectors = market === 'KR' ? { lines: [], asOf: null } : sectorFlowLines(root, view);
  const stages = view.playbook ? markets.flatMap((item) => stageFlowLines(view.playbook, item)) : [];
  const dates = [sectors.asOf ? `미국 섹터 ${sectors.asOf}` : null, ...(stages.length ? markets.map((item) => (view.playbook.asOfByMarket?.[item] ? `${marketWord(item)} 테마 ${view.playbook.asOfByMarket[item]}` : null)) : [])].filter(Boolean);
  if (!dates.length) return { error: '섹터 성과와 테마 단계 자료를 아직 받지 못했습니다.' };
  const rotation = market !== 'KR' && view.playbook?.rotation?.text ? [`1개월 테마 강약: ${view.playbook.rotation.text}`] : [];
  return { text: ['【섹터·테마 흐름 — 테마 화면과 같은 섹터 성과와 테마 단계, 가격 흐름 기준이며 자금 유출입 자료가 아님】', ...sectors.lines, ...stages, ...rotation,
    '한 테마의 단계 근거와 구성 종목은 level theme, theme에 [ ] 안의 id를 넣어 요청한다.'].join('\n'), asOf: `${dates.join(', ')} 종가`, entities: [] };
}

// The themes the 테마 screen lists: the playbook's rows, then a catalogued theme with no stage yet (too few closes).
function flowCandidates(root, playbook, market) {
  const out = [];
  for (const item of market === 'ALL' ? ['US', 'KR'] : [market]) {
    const rows = (playbook?.themes || []).filter((row) => row.market === item);
    const seen = new Set(rows.map((row) => row.id));
    out.push(...rows.map((row) => ({ market: item, id: row.id, label: row.label, row })));
    const catalog = item === 'US' ? (Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : []).map((theme) => [theme?.id, theme?.nameKr || theme?.id])
      : Object.keys(root?.KR_THEME_MAP || {}).map((id) => [id, krThemeLabel(id)]);
    for (const [id, label] of catalog) if (id && !seen.has(id)) out.push({ market: item, id: String(id), label: String(label), row: null });
  }
  return out;
}
function resolveFlowTheme(candidates, asked) {
  const key = flowKey(asked);
  if (!key) return null;
  const names = (item) => [item.id, item.label, ...String(item.label).split(/[/·]/)].map(flowKey).filter(Boolean);
  return candidates.find((item) => names(item).includes(key)) || (key.length >= 2 ? candidates.find((item) => names(item).some((name) => name.includes(key))) : null) || null;
}

function flowTheme(root, view, market, asked) {
  const candidates = flowCandidates(root, view.playbook, market);
  if (!candidates.length) return { error: '테마 목록을 아직 받지 못했습니다.' };
  const hit = resolveFlowTheme(candidates, asked);
  if (!hit) {
    const valid = ['US', 'KR'].map((item) => { const list = candidates.filter((entry) => entry.market === item); return list.length ? `${marketWord(item)} — ${list.map((entry) => `${entry.label}(${entry.id})`).join(', ')}` : null; });
    return { error: `없는 테마입니다: ${String(asked || '').slice(0, 40)}. 가능한 테마: ${valid.filter(Boolean).join('; ')}` };
  }
  const members = themeMembersFor(root, view.store, hit.market, hit.id);
  const value = (member, key) => readRowNumber(member.row, key, 'display');
  const measured = members.filter((member) => member.row && value(member, FLOW_MEMBER_SORT) != null).sort((a, b) => value(b, FLOW_MEMBER_SORT) - value(a, FLOW_MEMBER_SORT));
  const shown = measured.slice(0, FLOW_MEMBER_LIMIT);
  const stage = hit.row; // the playbook row (a theme's medians), not a screener row
  const basis = day(stage?.basis) || latest(shown.map((member) => member.row.factorSessionDate));
  if (!basis) return { error: `${marketWord(hit.market)} ${hit.label} 테마의 기준일을 확인하지 못했습니다.` };
  const lines = [`【테마 상세 — ${marketWord(hit.market)} ${hit.label} [${hit.id}], 테마 화면과 같은 단계와 구성 종목】`];
  if (stage) {
    const [name, trend] = trendOf(stage);
    lines.push(`단계: ${stage.stateLabel}`, `테마 중앙값(${basis} 종가): 1개월 ${flowPct(stage.ret1m)}, ${name} ${flowPct(trend)}${stage.above50 != null ? `, 50일선 위 종목 ${stage.above50}%` : ''}`);
  } else lines.push('단계: 판정 보류(같은 날 종가가 있는 구성 종목이 부족함)');
  lines.push(`구성 종목 ${members.length}개 중 3개월 수익률이 있는 ${measured.length}개, 3개월 수익률 높은 순 ${shown.length}개:`);
  shown.forEach((member, index) => {
    const name = [member.label, member.row.name].find((text) => text && text !== member.sym);
    const cap = capReading(member.row);
    const date = day(member.row.factorSessionDate);
    lines.push(`${index + 1}. ${member.sym}${name ? ` ${name}` : ''} · 1개월 ${flowPct(value(member, 'ret1m'))} · 3개월 ${flowPct(value(member, 'ret3m'))} · 52주 고점 대비 ${flowPct(value(member, 'pctFrom52wHigh'))}${cap?.billions != null ? ` · 시총 $${cap.billions.toFixed(1)}B` : ''}${date && date !== basis ? ` · ${date} 종가` : ''}`);
  });
  return { text: lines.join('\n'), asOf: `${basis} 종가`, entities: shown.map((member) => member.sym) };
}

const moneyFlow = {
  name: 'money_flow',
  description: '테마 화면과 같은 섹터·테마 흐름을 돌려준다. overview: 미국 11개 섹터의 기간 수익률 순위(화면 기본 기간, SPY 대비)와 미국·한국 테마를 단계(주도 지속, 추세 속 조정, 약세 지속 등)로 묶은 1개월·긴 추세 수익률. theme: 한 테마의 단계 근거와 구성 종목(3개월 수익률 높은 순, 1개월·3개월 수익률, 52주 고점 대비, 시총). 돈이 어디로 가는지는 overview로 섹터와 단계를 본 뒤 앞선 테마를 theme으로 내려가고, 종목 하나는 다른 도구로 본다.',
  parameters: objectSchema({
    market: { type: 'string', enum: Object.keys(FLOW_MARKETS), description: 'ALL 미국 먼저 한국 뒤, US 미국, KR 한국. theme에서는 테마를 찾을 시장' },
    level: { type: 'string', enum: ['overview', 'theme'], description: 'overview 섹터와 모든 테마의 단계, theme 한 테마의 상세' },
    theme: nullable('string', 'level theme일 때 테마 id나 이름(overview 결과의 [ ] 안 id, 방산, 원전, semiconductor 등). overview면 null')
  }),
  maxChars: 6000,
  label: (args) => (args?.level === 'theme' && args?.theme ? `${String(args.theme).slice(0, 20)} 테마 구성 종목` : '섹터·테마 흐름'),
  async run({ market, level, theme }, { root, now }) {
    const view = flowView(root, now);
    const scope = FLOW_MARKETS[market] ? market : 'ALL';
    return level === 'theme' ? flowTheme(root, view, scope, theme) : flowOverview(root, view, scope);
  }
};

const macro = {
  name: 'macro',
  description: '매크로 화면과 같은 확정 종가·공식 발표 수치를 돌려준다. topic: macro(미국 물가·고용·금리·VIX·정책금리), kr-macro(한국 정책 포함), fxbond(달러·환율·국채·크레딧), ai-funding(AI 설비투자 자금 조달 사슬: 빅테크 설비투자·현금흐름, 회사채 금리·스프레드, 손으로 조사한 개별 기업 CDS·사모 신용·GPU 임대료·메모리 가격·펀드 자금 흐름).',
  maxChars: 6000,
  parameters: objectSchema({ topic: { type: 'string', enum: Object.keys(MACRO_TOPICS), description: '자료 묶음' } }),
  label: (args) => (args?.topic === FUNDING_TOPIC ? MACRO_TOPICS[FUNDING_TOPIC] : `${MACRO_TOPICS[args?.topic] || '매크로'} 지표`),
  async run({ topic }, { root, now }) {
    if (!MACRO_TOPICS[topic]) return { error: `topic은 ${Object.keys(MACRO_TOPICS).join(', ')} 중 하나입니다.` };
    if (topic === FUNDING_TOPIC) return fundingTopic(root, now);
    const lines = buildChatMacroLines({ ctxId: topic, root, timeLabel: kstStamp(now) });
    let rows = [];
    try { rows = typeof root?._aioScreenBasisEvidence === 'function' ? root._aioScreenBasisEvidence() || [] : []; } catch (_) { rows = []; }
    const asOf = latest(rows.map((row) => row?.asOf));
    if (!lines.length || !asOf) return { error: `${MACRO_TOPICS[topic]} 자료가 아직 없습니다.` };
    return { text: lines.join('\n'), asOf: `가장 최근 관측 ${asOf}, 항목별 날짜는 괄호`, entities: [] };
  }
};

function themeLines(theme, id) {
  const symbol = theme?.symbol;
  // A record computed on another definition (its stamp differs from the live one) is not handed to the model as the
  // current stage record.
  if (theme && !themeOutcomeCurrent(theme, THEME_OUTCOME_BENCHMARK)) return [`${id} 대표 ETF ${symbol}의 단계별 장기 기록은 지금 단계 규칙과 다른 기준으로 계산돼 있어 쓰지 않습니다(다음 주간 갱신 때 다시 계산).`];
  return Object.keys(THEME_STATES).filter((state) => theme?.[state]?.n >= 1)
    .map((state) => frequencyText({ ...theme[state], subject: symbol }, `${id} 대표 ETF ${symbol}가 ${THEME_STATES[state].split(' (')[0]} 단계였을 때`, { source: '장기 일봉 기록' }));
}

// Decision frame inputs: the Nasdaq correction counts conditional on the depth the open correction has reached, and the
// published VIX-band record for today's band (stress-outcomes.json, read only under its live definition stamp).
function correctionLines(outcomes, root) {
  const rates = outcomes?.corrections;
  const series = buildCloseSeries(root?._aioHistory || [], 'nasdaq', { through: closeBasis(root?._aioHistory || []) });
  const last = series.at(-1);
  const reading = rates ? correctionReading(rates, { close: last?.value, closeDate: last?.date, recordClose: series.length ? Math.max(...series.map((point) => point.value)) : null, series }) : null;
  return reading ? [`${reading.lead}. ${reading.text} ${reading.definition}`] : [];
}
// One reader of the VIX-band record (vix-band-record.js) for this tool, 시장 상태 and chat context.
function vixBandLines(root) {
  const vix = buildCloseSeries(root?._aioHistory || [], 'vix', { through: closeBasis(root?._aioHistory || []) }).at(-1);
  const record = vixBandRecord(root?.[STRESS_OUTCOMES.key], vix?.value);
  const risk = vixBandRiskLine(record);
  if (!risk) return [];
  if (record.state !== 'current') return [risk.text];
  // The same non-overlapping cases as the screen's risk line (stressRiskSummary): the up share, its count and the
  // return quantiles, under the shared sample rule (under 10 cases no rate, 10–29 참고).
  const { risk: band, baseRisk: base } = record;
  const pct = (value) => `${Math.round(Number(value))}%`;
  const up = band.strength.figures
    ? `${record.horizon}거래일 뒤 오른 경우 ${pct(band.upShare)}(겹치지 않는 사례 ${band.cases}개 중 ${band.upCases}개${band.strength.reference ? ' · 참고' : ''}, 평소 ${pct(base.upShare)}), 중앙값 ${band.median}%, 나쁜 쪽 5% ${band.p05}% 이하`
    : band.strength.note;
  return [`VIX ${vix.value.toFixed(1)}(${day(vix.date)}) — ${record.label} 구간: ${up}`, risk.text];
}

const scenarioRecord = {
  name: 'scenario_record',
  description: `과거에 비슷한 시장 움직임이나 테마 단계가 있었을 때 이후 흐름의 빈도 기록과 판단 틀(가능성·이익·손실 폭·기회비용·틀렸을 때·근거 종류)을 돌려준다. id는 시장 갈림길(${Object.keys(BRANCH_ANALOGS).join(', ')}), 테마(semiconductor, software, energy, ai_infra 등 영문 테마 id), correction(나스닥 조정이 약세장으로 이어진 횟수, 지금 깊이까지 간 조정 기준), vix(오늘 VIX 구간의 과거 기록).`,
  parameters: objectSchema({ id: { type: 'string', description: '시장 갈림길 id, 테마 id, correction 또는 vix' } }),
  label: (args) => (BRANCH_ANALOGS[args?.id] || args?.id === 'correction' || args?.id === 'vix' ? '과거 비슷한 시장 기록' : `${String(args?.id || '테마')} 테마 과거 기록`),
  async run({ id }, { root }) {
    const key = String(id || '').trim();
    if (key === 'vix') {
      await refreshSharedArtifact(root, STRESS_OUTCOMES).catch(() => null);
      const lines = vixBandLines(root);
      return lines.length ? { text: `【과거 빈도 기록 · VIX 구간】\n${lines.join('\n')}`, asOf: `${day(root?.[STRESS_OUTCOMES.key]?.to) || '기준일 미확인'}까지의 일봉`, entities: [] } : { error: 'VIX 구간 기록을 지금 정의로 받지 못했습니다.' };
    }
    await refreshSharedArtifact(root, SCENARIO_OUTCOMES).catch(() => null);
    const outcomes = currentScenarioOutcomes(root?.[SCENARIO_OUTCOMES.key]);
    const through = day(outcomes?.to);
    if (!outcomes || !through) return { error: '장기 과거 기록을 아직 받지 못했습니다.' };
    let lines = [];
    // A branch or correction record published under another definition stamp is withheld by
    // currentScenarioOutcomes; the answer says so (as the theme path does), not that the id has no record.
    const restamped = (part) => !outcomes[part] && !!root?.[SCENARIO_OUTCOMES.key]?.[part];
    const pending = (what) => [`${what} 기록은 지금 정의와 다른 기준으로 계산돼 있어 쓰지 않습니다(다음 주간 갱신 때 다시 계산).`];
    if (key === 'correction') lines = restamped('corrections') ? pending('나스닥 조정 횟수') : correctionLines(outcomes, root);
    else if (BRANCH_ANALOGS[key] && restamped('branches') && root[SCENARIO_OUTCOMES.key].branches[key]) lines = pending(`${BRANCH_ANALOGS[key].label} 갈림길의 과거`);
    else if (BRANCH_ANALOGS[key] && outcomes.branches?.[key]) {
      // The same frame the branch card draws (its past record is this record when the stamps match).
      const model = marketInterpretation(root)?.crossroads;
      const item = model?.items?.find((row) => row.id === key);
      lines = [frequencyText(outcomes.branches[key], BRANCH_ANALOGS[key].label, { source: outcomes.sourceLabel || '장기 일봉 기록' }),
        item ? `판단 틀: ${decisionFrameContext(branchDecisionFrame(item, { cash: model.cash }))}` : ''].filter(Boolean);
    } else if (outcomes.themes?.[key]) {
      const row = marketInterpretation(root)?.playbook?.themes?.find((theme) => theme.market === 'US' && theme.id === key);
      const frame = row ? themeDecisionFrame(row, { cash: marketInterpretation(root)?.crossroads?.cash || null }) : null;
      lines = [...themeLines(outcomes.themes[key], key), frame ? `지금 단계의 판단 틀: ${decisionFrameContext(frame)}` : ''].filter(Boolean);
    }
    if (!lines.length) return { error: `기록이 없는 id입니다: ${key.slice(0, 40)}. 가능한 id: ${[...Object.keys(BRANCH_ANALOGS), ...Object.keys(outcomes.themes || {}), 'correction', 'vix'].join(', ')}` };
    return { text: `【과거 빈도 기록 · ${key}】\n${lines.join('\n')}`, asOf: `${through}까지의 일봉`, entities: [] };
  }
};

const news = {
  name: 'news',
  description: '앱이 이미 모은 뉴스 캐시에서 찾는다. query가 등록된 종목(티커·회사 이름)이면 그 종목 뉴스를 최근 days일(1~7)에서, 아니면 질문어와 맞는 시장 뉴스를 돌려준다.',
  parameters: objectSchema({ query: { type: 'string', description: '종목 또는 검색어' }, days: { type: 'integer', description: '종목 뉴스의 기간(1~7일)' } }),
  maxChars: 4000,
  label: (args, root) => { const sym = resolveToolSymbol(root, args?.query); return sym ? `${symbolLabel(root, sym)} 뉴스` : '관련 뉴스'; },
  async run({ query, days }, { root, now }) {
    const text = String(query || '').slice(0, 120).trim();
    if (!text) return { error: '검색어가 비어 있습니다.' };
    const sym = resolveToolSymbol(root, text);
    const asked = readNumber(days);
    const span = asked == null ? 3 : Math.min(7, Math.max(1, Math.round(asked)));
    let found = '';
    if (sym && typeof root?._aioTickerNewsFromCache === 'function') found = root._aioTickerNewsFromCache(sym, { windowHours: span * 24, max: 8 }) || '';
    else if (!sym && typeof root?._buildNewsContext === 'function') found = root._buildNewsContext(root._aiCurrentCtx || 'home', text) || '';
    if (!String(found).trim()) return { error: `${sym || text} 관련 뉴스가 캐시에 없습니다.` };
    // Headlines are outside text: the shared wrapper quarantines an item that reads like an instruction.
    if (typeof root?.AIO?.buildAIUntrustedBlock === 'function') found = root.AIO.buildAIUntrustedBlock(String(found).includes('텔레그램') ? 'NEWS_TELEGRAM' : 'NEWS', found, { maxChars: 3800 }) || found;
    return { text: String(found).trim(), asOf: `${kstStamp(now)} 조회, 항목별 경과 시간 표기`, entities: sym ? [sym] : [] };
  }
};

// The research and frameworks integrated into the app (the reader's supplied materials, imported research, the knowledge
// base), searched by the question. They are dated reference for mechanisms and frames, never current figures; a turn
// with the tools asks for them here instead of carrying them in every prompt.
const reference = {
  name: 'reference',
  description: '앱에 통합된 리서치·투자 프레임·학습 자료에서 질문과 관련된 부분을 찾아 돌려준다(작동 원리, 사이클·국면 프레임, 전략 개념, 과거 사례의 해석 틀). 개념·전략·프레임을 묻거나 해석의 틀이 필요할 때 쓴다. 날짜가 붙은 참고 자료이며 현재 수치의 근거가 아니다.',
  parameters: objectSchema({ query: { type: 'string', description: '찾을 주제를 한 문장으로(예: "신용 스프레드 확대가 주식에 전달되는 경로", "주도주 이탈 뒤 대응 원칙")' } }),
  maxChars: 6000,
  label: () => '통합 리서치 자료',
  async run({ query }, { root, now, signal }) {
    const ask = String(query || '').trim().slice(0, 300);
    if (!ask) return { error: '찾을 주제가 비어 있습니다.' };
    const parts = [];
    try { parts.push(String(root?.AIO?.buildAIRetrievalContext?.(ask, root?._aiCurrentCtx || 'home', { topK: 4, budgetTokens: 1200 }) || '').trim()); } catch (_) { /* this source is missing */ }
    try {
      const found = await root?.AIO_ARCH?.getAIOrchestrator?.()?.buildAIKnowledgeContext?.(ask, { topK: 3, maxChars: 3000, signal });
      parts.push(String(found?.context || '').trim());
    } catch (_) { /* this source is missing */ }
    for (const read of ['_aioAIInfraCycleContext', '_aioMarketLearningCurriculumContext']) {
      try { parts.push(String(root?.[read]?.(root?._aiCurrentCtx || 'home', ask) || '').trim()); } catch (_) { /* this source is missing */ }
    }
    const text = parts.filter(Boolean).join('\n\n');
    if (!text) return { error: '이 주제에 맞는 통합 리서치 자료가 없습니다. 일반 지식으로 설명하되 현재 수치는 다른 자료에서만 쓴다.' };
    return { text, asOf: `${new Date(now).toISOString().slice(0, 10)} 조회한 참고 자료 — 자료마다 작성일이 다르며 현재 수치가 아니다`, entities: [] };
  }
};

export const MARKET_TOOLS = [screen, moneyFlow, macro, scenarioRecord, news, reference];
