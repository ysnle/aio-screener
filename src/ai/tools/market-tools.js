// Chat tools about the market as a whole: the screener query, the 매크로 release rows, the long-history scenario and
// theme-stage records, and the news cache. Each wraps a reader the screens or the chat already use.
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

const objectSchema = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const latest = (values) => values.map(day).filter(Boolean).sort().at(-1) || null;
const MACRO_TOPICS = Object.freeze({ macro: '미국 매크로', 'kr-macro': '한국 매크로', fxbond: '환율·채권' });

const screen = {
  name: 'screen',
  description: '앱 종목 DB를 조건으로 거른 결과(최대 12종목)를 돌려준다. 조건 예: "반도체 대형주 RSI 30 이하", "소형주 과매도", "S&P 500 퀀트 상위".',
  parameters: objectSchema({ query: { type: 'string', description: '한국어 또는 영어 조건 문장' } }),
  maxChars: 5000,
  label: () => '조건 검색',
  async run({ query }, { root }) {
    if (typeof root?._aioRunScreenerQuery !== 'function' || typeof root?._formatScreenerResultPrompt !== 'function') return { error: '종목 DB를 읽을 수 없습니다.' };
    const result = root._aioRunScreenerQuery(String(query || '').slice(0, 200), { recentTickers: [] });
    const text = result?.matched ? String(root._formatScreenerResultPrompt(result) || '').trim() : '';
    if (!text) return { error: '조건에 맞는 종목이 없거나 조건을 읽지 못했습니다. 섹터·테마·시총·RSI·시그널 같은 조건으로 다시 요청하세요.' };
    const asOf = latest((result.rows || []).map((row) => row?.factorSessionDate)) || day(root?.AIO?.screenerFactorAsOf?.());
    if (!asOf) return { error: '종목 DB의 기준일을 확인하지 못했습니다.' };
    return { text, asOf: `팩터 ${asOf} 종가`, entities: (result.rows || []).map((row) => row?.sym).filter(Boolean) };
  }
};

const macro = {
  name: 'macro',
  description: '매크로 화면과 같은 확정 종가·공식 발표 수치를 돌려준다. topic: macro(미국 물가·고용·금리·VIX·정책금리), kr-macro(한국 정책 포함), fxbond(달러·환율·국채·크레딧).',
  parameters: objectSchema({ topic: { type: 'string', enum: Object.keys(MACRO_TOPICS), description: '자료 묶음' } }),
  label: (args) => `${MACRO_TOPICS[args?.topic] || '매크로'} 지표`,
  async run({ topic }, { root, now }) {
    if (!MACRO_TOPICS[topic]) return { error: `topic은 ${Object.keys(MACRO_TOPICS).join(', ')} 중 하나입니다.` };
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
  const h = record.month;
  if (!h) return [];
  const strength = h.strength;
  const allHit = record.base?.hitRate;
  const risk = vixBandRiskLine(record);
  return [`VIX ${vix.value.toFixed(1)}(${day(vix.date)}) — ${record.label} 구간: ${strength.figures ? `21거래일 뒤 오른 비율 ${h.hitRate}%${allHit != null ? `(평소 ${allHit}%)` : ''}, 중앙값 ${h.median}%, 나쁜 쪽 10% ${h.p10}% 이하` : '사례가 적어 비율로 말하지 않음'}, ${strength.tag}.`,
    ...(risk ? [risk.text] : [])];
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
    return { text: String(found).trim(), asOf: `${kstStamp(now)} 조회, 항목별 경과 시간 표기`, entities: sym ? [sym] : [] };
  }
};

export const MARKET_TOOLS = [screen, macro, scenarioRecord, news];
