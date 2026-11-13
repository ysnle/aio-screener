// Chat tools about the market as a whole: the screener query, the 매크로 release rows, the long-history scenario and
// theme-stage records, and the news cache. Each wraps a reader the screens or the chat already use.
import { buildChatMacroLines, kstStamp } from '../context/chat-macro-lines.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { SCENARIO_OUTCOMES } from '../../data/artifact-registry.js';
import { BRANCH_ANALOGS, THEME_STATES, frequencyText } from '../../domain/scenarios/analogs.js';
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
  return Object.keys(THEME_STATES).filter((state) => theme?.[state]?.n >= 1)
    .map((state) => frequencyText({ ...theme[state], subject: symbol }, `${id} 대표 ETF ${symbol}가 ${THEME_STATES[state].split(' (')[0]} 단계였을 때`, { source: '장기 일봉 기록' }));
}

const scenarioRecord = {
  name: 'scenario_record',
  description: `과거에 비슷한 시장 움직임이나 테마 단계가 있었을 때 이후 흐름의 빈도 기록을 돌려준다. id는 시장 갈림길(${Object.keys(BRANCH_ANALOGS).join(', ')}) 또는 테마(semiconductor, software, energy, ai_infra 등 영문 테마 id).`,
  parameters: objectSchema({ id: { type: 'string', description: '시장 갈림길 id 또는 테마 id' } }),
  label: (args) => (BRANCH_ANALOGS[args?.id] ? '과거 비슷한 시장 기록' : `${String(args?.id || '테마')} 테마 과거 기록`),
  async run({ id }, { root }) {
    await refreshSharedArtifact(root, SCENARIO_OUTCOMES).catch(() => null);
    const outcomes = root?.[SCENARIO_OUTCOMES.key] || null;
    const through = day(outcomes?.to);
    if (!outcomes || !through) return { error: '장기 과거 기록을 아직 받지 못했습니다.' };
    const key = String(id || '').trim();
    let lines = [];
    if (BRANCH_ANALOGS[key] && outcomes.branches?.[key]) lines = [frequencyText(outcomes.branches[key], BRANCH_ANALOGS[key].label, { source: outcomes.sourceLabel || '장기 일봉 기록' })];
    else if (outcomes.themes?.[key]) lines = themeLines(outcomes.themes[key], key);
    if (!lines.length) return { error: `기록이 없는 id입니다: ${key.slice(0, 40)}. 가능한 id: ${[...Object.keys(BRANCH_ANALOGS), ...Object.keys(outcomes.themes || {})].join(', ')}` };
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
