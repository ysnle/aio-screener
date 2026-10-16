// v57.81: the reading of an out-of-universe symbol's on-demand placement (src/data/on-demand-symbol.js). Pure. It says
// where the symbol would sit against the current published universe under the same ranking model, when that was
// computed, and which inputs were and were not available. No grade, no estimate: a missing input is named as missing,
// and a row under the model's evidence floor gets no position at all.
import { withTopicParticle } from '../content/korean-particle.js';

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const md = (date) => (/^\d{4}-\d{2}-\d{2}/.test(String(date || '')) ? `${Number(String(date).slice(5, 7))}/${Number(String(date).slice(8, 10))}` : null);

export const OUT_OF_UNIVERSE_TITLE = '랭킹 대상 밖 종목 — 현재 유니버스 기준 위치';

const BLOCKED_LABEL = Object.freeze({
  observedAt_missing: '관측 시각 없음', source_tier_missing_or_unknown: '출처 등급 없음', allowedUse_missing: '사용 범위 없음',
  allowedUse_blocked: '사용 범위 제한', quality_missing: '품질 기록 없음', quality_stale_or_blocked: '오래된 값', observedAt_stale_or_future: '관측일이 오래됨'
});
const FIELD_LABEL = Object.freeze({ ret1m: '1개월 수익률', ret3m: '3개월 수익률', ret6m: '6개월 수익률', pctSma50: '50일선 거리', pctSma200: '200일선 거리',
  vol: '60일 변동성', mcap: '시가총액(실시간)', pe: 'PER', pb: 'PBR', roe: 'ROE', margin: '순이익률', revGrowth: '매출 성장률', kalmanVelConf: '추세 속도', kalmanVel: '추세 속도' });
const labels = (fields) => [...new Set(fields.map((field) => FIELD_LABEL[field] || field))].join(', ');
const SEC_STATUS_TEXT = Object.freeze({
  'no-cik': 'SEC 등록번호(CIK)를 상장 목록에서 확인하지 못해 재무 공시를 읽지 않았습니다',
  unavailable: 'SEC 재무 공시를 받지 못했습니다',
  'no-annual-facts': 'SEC 공시에 비교 가능한 연간 매출·순이익 항목이 없습니다',
  'no-current-fields': '최근 15개월 안의 연간 공시가 없어 재무 지표를 쓰지 않았습니다',
  'not-applicable': 'ETF는 발행사 재무 지표가 없습니다'
});

export function kstStamp(iso) {
  const ms = Date.parse(iso || '');
  return Number.isFinite(ms) ? `${new Date(ms).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false }).slice(0, 16)} 한국 시간` : null;
}

export function buildOutOfUniverseRead(record) {
  if (!record || !record.symbol) return { available: false, state: 'none' };
  const symbol = record.symbol;
  if (record.status === 'not-listed') return { available: false, state: 'not-listed', title: OUT_OF_UNIVERSE_TITLE,
    text: `${withTopicParticle(symbol)} 미국 상장 목록과 등록 종목명에서 확인되지 않아 위치를 계산하지 않았습니다. 티커 철자를 확인해 주세요.` };
  if (record.status === 'unavailable') return { available: false, state: 'unavailable', title: OUT_OF_UNIVERSE_TITLE,
    text: record.reason === 'too-few-completed-sessions'
      ? `${symbol}의 완료 거래일이 30일 미만이라 스크리너와 같은 수익률·추세 값을 만들 수 없습니다.`
      : `${symbol}의 1년 일봉을 받지 못해 위치를 계산하지 못했습니다. 잠시 후 종목을 다시 열면 다시 요청합니다.` };
  if (record.status !== 'ready') return { available: false, state: record.status || 'loading', title: OUT_OF_UNIVERSE_TITLE,
    text: `${withTopicParticle(symbol)} 스크리너 랭킹 대상 밖 종목입니다. 같은 공식으로 1년 일봉과 공시를 읽어 위치를 계산하는 중입니다.` };
  const placement = record.placement || null;
  const rank = finite(placement?.rank);
  const computed = kstStamp(record.computedAt) || record.computedAt;
  const session = md(record.sessionDate);
  const inputs = (placement?.inputs || []).map((input) => ({
    key: input.key, label: input.label, active: input.active, usable: input.usable,
    status: !input.active ? '모델에서 비활성' : input.usable ? '사용' : '빠짐',
    detail: !input.active ? '현재 유니버스 전체에서 이 항목의 유효값이 80%에 못 미쳐 모든 종목에서 빠진 항목입니다'
      : input.usable ? `입력: ${labels(input.present)}`
        // A lineage reason explains a value that exists but was refused; an absent value needs no lineage reason.
        : `빠진 입력: ${labels(input.missing.length ? input.missing : input.present)}${input.present.length && input.blockedReasons.length ? ` (${[...new Set(input.blockedReasons.map((reason) => BLOCKED_LABEL[reason] || reason))].join(', ')})` : ''}`
  }));
  const used = inputs.filter((input) => input.usable).map((input) => input.label);
  const missing = inputs.filter((input) => input.active && !input.usable).map((input) => input.label);
  const lines = [];
  const ranked = finite(placement?.ranked);
  if (rank != null) {
    const top = Math.max(1, 100 - rank);
    lines.push(`스크리너와 같은 가격·재무 공식으로 ${session ? `${session} 종가까지` : '완료 종가까지'}의 값을 계산해 현재 공개 유니버스${ranked ? ` ${ranked}종목` : ''}에 넣어 보면 상위 약 ${top}% 자리(백분위 ${rank})입니다.`);
  } else {
    lines.push(`스크리너 모델은 가중치의 80% 이상에 해당하는 입력이 있어야 위치를 매기는데, 이 종목은 그 기준에 못 미쳐 위치를 매기지 않았습니다.`);
  }
  lines.push(`계산에 쓴 항목: ${used.length ? used.join(', ') : '없음'}${missing.length ? ` · 빠진 항목: ${missing.join(', ')}` : ''}. 빠진 항목은 추정하지 않고 비워 둡니다.`);
  if (record.secStatus && record.secStatus !== 'ready' && SEC_STATUS_TEXT[record.secStatus]) lines.push(`${SEC_STATUS_TEXT[record.secStatus]}.`);
  lines.push(`${computed ? `${computed}에 요청 시 계산한 값` : '요청 시 계산한 값'}이며 공개 순위에는 들어가지 않습니다${record.row?.sector ? (record.classification?.sic ? ` · 섹터 ${record.row.sector}는 SEC 산업분류(SIC ${record.classification.sic}${record.classification.description ? ` ${record.classification.description}` : ''})를 옮긴 값입니다` : '') : ' · 섹터 분류가 없어 섹터 안이 아닌 유니버스 전체 기준으로 비교했습니다'}.`);
  return { available: rank != null, state: 'ready', title: OUT_OF_UNIVERSE_TITLE, symbol, rank, topPct: rank != null ? Math.max(1, 100 - rank) : null,
    ranked, computedAt: record.computedAt || null, computedLabel: computed, sessionDate: record.sessionDate || null, lines, inputs, used, missing,
    factorScores: placement?.factorScores || null, secStatus: record.secStatus || null };
}

/** One line for the AI context: the placement with its basis and what was missing. */
export function outOfUniverseContext(record) {
  const read = buildOutOfUniverseRead(record);
  if (read.state !== 'ready') return read.text ? `${OUT_OF_UNIVERSE_TITLE}: ${read.text}` : '';
  return `${OUT_OF_UNIVERSE_TITLE} (${record.symbol}): ${read.lines.join(' ')} 공개 스크리너 순위가 아니므로 '순위 n위'로 말하지 말고 요청 시 계산한 위치로만 설명한다.`;
}
