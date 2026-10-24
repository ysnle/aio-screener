// v58.75 (owner 2026-10-24, '고르는 법' layer B): how an expert reads one company — the lens for its kind of business, where
// it stands against its named theme peers, the situations that favour or burden it, a thesis template with its checks and
// break signals, and the market link. Pure: everything comes in as arguments (parsed SEC history, screener rows, consensus,
// scenario state, regime). The app never picks: these are facts, conditions and counts — no price, weight, grade or odds.
import { finiteFact as finite, fiscalYearLabel } from './period.js';
import { themeProfile, windFor, WIND_LABELS, EXPOSURE_TAGS } from '../scenarios/exposures.js';
import { BRANCHES } from '../market/macro-crossroads.js';
import { signedText } from '../shared/number.js';

const pct = (value, digits = 1) => (value == null ? null : `${value.toFixed(digits)}%`);
const usdShort = (value) => {
  const abs = Math.abs(value);
  const body = abs >= 1e12 ? `${(abs / 1e12).toFixed(2)}T` : abs >= 1e9 ? `${(abs / 1e9).toFixed(1)}B` : `${(abs / 1e6).toFixed(0)}M`;
  return `${value < 0 ? '-' : ''}$${body}`;
};
const branchTitle = (branch) => String(branch?.title || '').split(' — ')[0];
export const UNCONFIRMED = '미확인';

// ── 1. Lens registry ────────────────────────────────────────────────────────────────────────────────────────────────
// Each metric id is computed by METRICS below from the collected filings; an id whose data this site does not collect
// (inventory, customer concentration, NIM, CET1, backlog, FFO …) always reads '미확인' with what to check instead.
const M = (id, why) => Object.freeze({ id, why });
export const STOCK_LENSES = Object.freeze({
  semis: { label: '반도체', why: '수요(AI·PC·스마트폰)와 재고·가격이 도는 경기순환이 겹친 업종이라, 성장과 사이클 위치를 함께 봅니다.',
    metrics: [M('revenueGrowth', '매출 성장이 분기마다 빨라지는지 느려지는지가 사이클 위치를 보여 줍니다.'), M('grossMargin', '가격 결정력과 공장 가동률이 매출총이익률에 먼저 드러납니다.'),
      M('capexIntensity', '설비투자가 매출보다 빠르게 늘면 몇 분기 뒤 공급 과잉의 씨앗이 됩니다.'), M('inventory', '재고가 매출보다 빠르게 쌓이면 가격 하락 전환의 신호입니다.'),
      M('revisions', '애널리스트 이익 전망이 오르는 쪽인지 내리는 쪽인지가 사이클 방향을 먼저 반영합니다.'), M('rdRatio', '다음 세대 공정·설계 경쟁력은 연구개발 지출로 유지됩니다.')] },
  software: { label: '소프트웨어', why: '구독 매출의 성장과, 그 성장을 얼마의 비용(특히 주식보상)으로 사는지가 핵심입니다.',
    metrics: [M('revenueGrowth', '구독 사업은 매출 성장률이 가치의 대부분을 설명합니다.'), M('grossMargin', '소프트웨어는 원가가 낮아 매출총이익률이 높게 유지되는지가 기본입니다.'),
      M('operatingMargin', '성장이 둔화될 때 이익률이 올라오는지가 성숙 단계의 확인점입니다.'), M('sbcRatio', '주식보상은 현금흐름에 더해지지만 주주 지분을 희석하는 실제 비용입니다.'),
      M('fcfMargin', '현금 기준 수익성 — 주식보상을 빼고도 남는지 함께 봅니다.'), M('retention', '기존 고객이 지출을 늘리는지(순매출 유지율)가 성장의 질입니다.')] },
  internet: { label: '인터넷·플랫폼', why: '광고·구독 매출 성장과, AI 투자 비용이 현금흐름을 얼마나 먹는지가 이익을 좌우합니다.',
    metrics: [M('revenueGrowth', '광고 경기와 사용자 확대가 매출 성장에 바로 드러납니다.'), M('operatingMargin', '플랫폼 지배력은 높은 영업이익률로 나타납니다.'),
      M('capexIntensity', 'AI 데이터센터 투자가 매출 대비 얼마나 큰지가 이익의 압박 요인입니다.'), M('fcfMargin', '투자를 하고도 현금이 남는지 확인합니다.'),
      M('shareholderReturn', '남는 현금을 자사주·배당으로 돌리는지가 주당 가치에 영향을 줍니다.'), M('revisions', '이익 전망 수정 방향이 투자 비용 부담을 먼저 반영합니다.')] },
  hardware: { label: '하드웨어·인프라 장비', why: '설비투자 사이클에 매출이 따라가는 업종이라, 성장 속도와 마진, 투자 부담을 함께 봅니다.',
    metrics: [M('revenueGrowth', '고객의 설비투자 속도가 매출 성장으로 나타납니다.'), M('grossMargin', '부품 원가와 가격 협상력이 매출총이익률에 드러납니다.'),
      M('capexIntensity', '생산능력 확충이 매출보다 앞서는지 확인합니다.'), M('netCash', '사이클이 꺾일 때 버틸 재무 여력입니다.'), M('revisions', '고객 투자 계획 변화가 이익 전망에 먼저 반영됩니다.')] },
  energy: { label: '에너지', why: '유가·가스 가격이 이익을 직접 좌우하므로, 가격이 내려가도 현금을 남기는 체력과 주주환원을 봅니다.',
    metrics: [M('oilSensitivity', '유가 1달러 변화가 이익에 주는 영향 — 회사 공시(민감도 표)에서 확인합니다.'), M('fcfMargin', '설비투자 뒤에도 현금이 남는지가 업종의 핵심입니다.'),
      M('shareholderReturn', '남는 현금의 자사주·배당 환원 비율이 투자 매력의 큰 부분입니다.'), M('leverage', '유가가 내려갈 때 부채가 부담이 되는지 확인합니다.'), M('capexIntensity', '낮은 설비투자는 현금을 늘리지만 생산 유지 여력을 줄입니다.')] },
  financials: { label: '금융', why: '금리차·신용 비용·자본 여력이 이익을 결정하며, 일반 기업의 매출·현금흐름 지표가 그대로 맞지 않습니다.',
    metrics: [M('roe', '자기자본으로 얼마를 버는지가 금융사 가치의 기본 척도입니다.'), M('nim', '대출·예금 금리차(순이자마진)가 이자 이익을 결정합니다.'),
      M('cet1', '보통주 자본비율은 손실을 견디는 여력과 주주환원 여지를 정합니다.'), M('creditCost', '대손비용이 늘기 시작하면 이익이 먼저 꺾입니다.'),
      M('dividends', '배당과 자사주 환원이 금융주 수익의 큰 부분입니다.'), M('revisions', '이익 전망 수정이 금리·신용 환경 변화를 반영합니다.')] },
  healthcare: { label: '헬스케어·바이오', why: '신약 파이프라인과 연구개발 투자, 특허 만료 일정이 미래 매출을 좌우합니다.',
    metrics: [M('revenueGrowth', '기존 제품과 신제품의 매출 성장 흐름입니다.'), M('rdRatio', '연구개발 비율이 파이프라인 투자의 크기를 보여 줍니다.'),
      M('operatingMargin', '제품 가격과 판매 비용이 영업이익률에 드러납니다.'), M('fcfMargin', '연구개발 뒤에도 현금이 남는지 확인합니다.'), M('pipeline', '임상 단계·특허 만료 일정은 회사 공시에서 확인합니다.')] },
  staples: { label: '필수소비재', why: '경기와 무관한 수요라 이익률이 얼마나 안정적인지와 배당 지속성이 핵심입니다.',
    metrics: [M('grossMargin', '원가 상승을 가격에 넘기는 힘이 매출총이익률의 안정성으로 나타납니다.'), M('operatingMargin', '광고·유통 비용을 쓴 뒤의 본업 수익성입니다.'),
      M('revenueGrowth', '가격 인상과 물량이 매출 성장을 나눠 설명합니다.'), M('dividends', '배당이 잉여현금 안에서 지급되는지가 지속성의 기준입니다.'), M('leverage', '안정 업종이라도 부채가 많으면 금리 부담이 커집니다.')] },
  consumer: { label: '경기소비재', why: '고용·소비 심리에 따라 매출이 흔들리는 업종이라, 성장과 마진, 재고를 봅니다.',
    metrics: [M('revenueGrowth', '소비 경기가 매출 성장에 바로 드러납니다.'), M('grossMargin', '할인 판매가 늘면 매출총이익률이 먼저 낮아집니다.'),
      M('operatingMargin', '고정비가 커서 매출이 줄면 이익률이 크게 흔들립니다.'), M('inventory', '재고가 쌓이면 할인 판매로 이어집니다.'), M('revisions', '소비 경기 변화가 이익 전망에 먼저 반영됩니다.')] },
  industrials: { label: '산업재', why: '설비투자·인프라 경기를 따라가는 업종이라, 수주와 마진, 현금 전환을 봅니다.',
    metrics: [M('revenueGrowth', '고객의 설비투자 경기가 매출 성장으로 나타납니다.'), M('operatingMargin', '가격 전가와 생산 효율이 영업이익률에 드러납니다.'),
      M('backlog', '수주잔고는 미래 매출의 가시성 — 회사 공시에서 확인합니다.'), M('fcfMargin', '이익이 현금으로 들어오는지 확인합니다.'), M('capexIntensity', '생산능력 투자 부담입니다.')] },
  utilities: { label: '유틸리티', why: '규제 요금 아래 안정 현금흐름이지만 설비투자와 부채가 커서 금리에 민감합니다.',
    metrics: [M('leverage', '부채 비중이 커서 금리 변화가 이익과 가치에 크게 작용합니다.'), M('capexIntensity', '전력망·발전 투자 규모가 요금 기반과 조달 필요를 정합니다.'),
      M('dividends', '배당이 투자 매력의 중심입니다.'), M('roe', '규제 당국이 허용하는 수익률 근처에서 움직입니다.')] },
  reits: { label: '리츠', why: '임대료 현금흐름을 금리와 비교해 가치가 매겨지므로 배당·부채·운영 현금흐름을 봅니다.',
    metrics: [M('ffo', '리츠의 이익 척도인 운영자금(FFO)은 회사 공시에서 확인합니다.'), M('dividends', '배당이 수익의 대부분입니다.'),
      M('leverage', '차환 금리가 오르면 부채 부담이 커집니다.'), M('revenueGrowth', '임대료 인상과 점유율이 매출 성장으로 나타납니다.')] },
  general: { label: '일반 기업', why: '성장·수익성·자본 효율·현금·부채의 기본 다섯 가지를 봅니다.',
    metrics: [M('revenueGrowth', '사업이 커지고 있는지의 기본입니다.'), M('netMargin', '매출에서 남는 이익의 비율입니다.'), M('roe', '자기자본으로 얼마를 버는지입니다.'),
      M('fcfMargin', '이익이 현금으로 들어오는지입니다.'), M('leverage', '부채가 자기자본 대비 얼마나 큰지입니다.')] }
});

const THEME_LENS = Object.freeze({ semiconductor: 'semis', photonics: 'semis', software: 'software', comm: 'internet', ai_infra: 'hardware', energy: 'energy', financials: 'financials',
  healthcare: 'healthcare', staples: 'staples', consumer_disc: 'consumer', industrials: 'industrials', defense: 'industrials', robotics: 'industrials', materials: 'industrials',
  utilities: 'utilities', reits: 'reits', semi: 'semis', 'ai-sw': 'software', 'power-grid': 'industrials', bio: 'healthcare', finance: 'financials', energy_kr: 'energy',
  shipbuilding: 'industrials', construction: 'industrials', kfood: 'staples', retail: 'consumer', auto: 'consumer', telecom: 'utilities' });
const SECTOR_LENS = Object.freeze({ Energy: 'energy', 'Financial Services': 'financials', Financials: 'financials', Healthcare: 'healthcare', 'Consumer Defensive': 'staples',
  Consumer: 'consumer', 'Consumer Cyclical': 'consumer', Industrials: 'industrials', Utilities: 'utilities', 'Real Estate': 'reits', 'Communication Services': 'internet', Materials: 'industrials' });
function sicLens(sic) {
  const code = Number(sic);
  if (!Number.isFinite(code)) return null;
  if (code === 3674) return 'semis';
  if (code >= 7370 && code <= 7379) return 'software';
  if ((code >= 3570 && code <= 3579) || (code >= 3660 && code <= 3679)) return 'hardware';
  if ((code >= 1300 && code <= 1399) || code === 2911) return 'energy';
  if (code >= 4900 && code <= 4991) return 'utilities';
  if (code === 6798) return 'reits';
  if (code >= 6000 && code <= 6799) return 'financials';
  if ((code >= 2833 && code <= 2836) || (code >= 3841 && code <= 3851) || (code >= 8000 && code <= 8099)) return 'healthcare';
  return null;
}
/** The SEC SIC code first (the issuer's own classification), then the AIO theme, then the sector. */
export function lensIdFor({ sic = null, themeIds = [], sector = null } = {}) {
  const bySic = sicLens(sic);
  if (bySic) return { id: bySic, basis: `SEC 산업분류 SIC ${sic}` };
  const theme = (themeIds || []).find((id) => THEME_LENS[id]);
  if (theme) return { id: THEME_LENS[theme], basis: 'AIO 테마' };
  if (SECTOR_LENS[sector]) return { id: SECTOR_LENS[sector], basis: '섹터' };
  return { id: 'general', basis: '분류 미확인' };
}

const UNCOLLECTED = Object.freeze({ inventory: '재고 — 10-Q 재무상태표의 재고자산과 재고 일수', retention: '순매출 유지율 — 실적 발표 자료', oilSensitivity: '유가 민감도 — 10-K 위험 요인·민감도 표',
  nim: '순이자마진 — 분기 실적 자료', cet1: 'CET1 자본비율 — 분기 실적 자료', creditCost: '대손비용 — 10-Q 손익계산서', pipeline: '임상·특허 일정 — 10-K 사업 설명',
  backlog: '수주잔고 — 실적 발표 자료', ffo: 'FFO — 리츠 보충 자료' });

// ctx: { history (annual, newest last), trailing (buildTrailingYearRead), quarterRead (buildQuarterRead), marginCash (buildMarginCashRead),
//        rd (buildRdRead), consensus (consensus row), surprise (buildSurpriseRead) }
function metricValue(id, ctx) {
  const years = (ctx.history || []).filter((year) => finite(year?.revenue) > 0);
  const latest = years.at(-1) || null;
  const prior = years.at(-2) || null;
  const label = latest ? fiscalYearLabel(latest.periodEnd) || '최근 연도' : null;
  const ladder = ctx.marginCash?.state === 'ready' ? ctx.marginCash : null;
  const step = (sid) => ladder?.ladder?.find((row) => row.id === sid) || null;
  const ratio = (num, den) => (finite(num) != null && finite(den) > 0 ? finite(num) / finite(den) * 100 : null);
  switch (id) {
    case 'revenueGrowth': {
      const fy = prior?.revenue > 0 && latest ? (latest.revenue / prior.revenue - 1) * 100 : null;
      const ttm = ctx.trailing?.revenueYoy ?? null;
      const q = ctx.quarterRead?.latest?.revenueYoy ?? null;
      if (fy == null && ttm == null && q == null) return null;
      return { text: [ttm != null ? `최근 4개 분기 ${signedText(ttm, 1, '%')}` : null, q != null ? `직전 분기 전년비 ${signedText(q, 1, '%')}` : null, fy != null ? `${label} ${signedText(fy, 1, '%')}` : null].filter(Boolean).join(', '),
        trend: ttm != null && fy != null ? (ttm > fy + 3 ? '빨라짐' : ttm < fy - 3 ? '느려짐' : '비슷') : null };
    }
    case 'grossMargin': case 'operatingMargin': {
      const s = step(id === 'grossMargin' ? 'gross' : 'operating');
      if (!s || s.value == null) return null;
      return { text: `${pct(s.value)}${s.prior != null ? `(${ladder.priorLabel} ${pct(s.prior)})` : ''}, ${ladder.label}`, trend: s.prior != null ? (s.value > s.prior + 1 ? '상승' : s.value < s.prior - 1 ? '하락' : '유지') : null };
    }
    case 'netMargin': {
      const now = ctx.trailing?.margin ?? ratio(latest?.netIncome, latest?.revenue);
      if (now == null) return null;
      const then = ctx.trailing?.priorMargin ?? ratio(prior?.netIncome, prior?.revenue);
      return { text: `${pct(now)}${then != null ? `(1년 전 ${pct(then)})` : ''}${ctx.trailing ? ', 최근 4개 분기' : `, ${label}`}`, trend: then != null ? (now > then + 1 ? '상승' : now < then - 1 ? '하락' : '유지') : null };
    }
    case 'fcfMargin': {
      const value = latest && finite(latest.operatingCashFlow) != null && finite(latest.capex) != null ? ratio(latest.operatingCashFlow - latest.capex, latest.revenue) : null;
      return value == null ? null : { text: `${pct(value)}, ${label}`, trend: null };
    }
    case 'capexIntensity': {
      const now = ratio(latest?.capex, latest?.revenue);
      if (now == null) return null;
      const then = ratio(prior?.capex, prior?.revenue);
      return { text: `매출의 ${pct(now)}${then != null ? `(전년 ${pct(then)})` : ''}, ${label}`, trend: then != null ? (now > then + 0.5 ? '늘어남' : now < then - 0.5 ? '줄어듦' : '비슷') : null };
    }
    case 'rdRatio': return ctx.rd?.state === 'ready' ? { text: `매출의 ${pct(ctx.rd.latest.ratio * 100)}, ${ctx.rd.latest.label}`, trend: ctx.rd.deltaPp != null ? (ctx.rd.deltaPp > 0.5 ? '늘어남' : ctx.rd.deltaPp < -0.5 ? '줄어듦' : '비슷') : null } : null;
    case 'sbcRatio': return ladder?.capital?.sbcRatio != null ? { text: `매출의 ${pct(ladder.capital.sbcRatio)}, ${ladder.label}`, trend: null } : null;
    case 'shareholderReturn': return ladder?.capital?.returnedShareOfFcf != null ? { text: `자사주·배당 합이 잉여현금의 ${ladder.capital.returnedShareOfFcf.toFixed(0)}%, ${ladder.label}`, trend: null } : null;
    case 'dividends': return ladder?.capital?.dividends != null ? { text: `배당 ${usdShort(ladder.capital.dividends)}${ladder.capital.fcf > 0 ? `(잉여현금의 ${(ladder.capital.dividends / ladder.capital.fcf * 100).toFixed(0)}%)` : ''}, ${ladder.label}`, trend: null } : null;
    case 'netCash': return ladder?.cash?.net != null ? { text: `${ladder.cash.net >= 0 ? '순현금' : '순부채'} ${usdShort(Math.abs(ladder.cash.net))}, ${ladder.label} 말`, trend: null } : null;
    case 'leverage': {
      const value = latest && finite(latest.longTermDebt) != null && finite(latest.equity) > 0 ? latest.longTermDebt / latest.equity * 100 : null;
      return value == null ? null : { text: `장기부채가 자기자본의 ${value.toFixed(0)}%, ${label}`, trend: null };
    }
    case 'roe': {
      const value = latest && prior && finite(latest.netIncome) != null && latest.equity > 0 && prior.equity > 0 ? latest.netIncome / ((latest.equity + prior.equity) / 2) * 100 : null;
      return value == null ? null : { text: `${pct(value)}(평균 자기자본), ${label}`, trend: null };
    }
    case 'revisions': {
      const fwd = ctx.consensus?.fwd;
      if (!fwd) return null;
      const up = finite(fwd.up4w) || 0, down = finite(fwd.down4w) || 0;
      return { text: up || down ? `최근 4주 상향 ${up}, 하향 ${down}` : '최근 4주 변경 없음', trend: up > down ? '상향 우세' : down > up ? '하향 우세' : '중립' };
    }
    default: return null;
  }
}

export function buildLensRead({ lens = { id: 'general', basis: '' }, ...ctx } = {}) {
  const def = STOCK_LENSES[lens.id] || STOCK_LENSES.general;
  const rows = def.metrics.map((metric) => {
    const value = metricValue(metric.id, ctx);
    return { id: metric.id, why: metric.why, label: metricLabel(metric.id), value: value?.text || null, trend: value?.trend || null,
      check: value ? null : UNCOLLECTED[metric.id] || '이 회사 공시 수집본에 없음' };
  });
  return { id: lens.id, label: def.label, why: def.why, basis: lens.basis, rows, known: rows.filter((row) => row.value).length };
}
const METRIC_LABELS = Object.freeze({ revenueGrowth: '매출 성장', grossMargin: '매출총이익률', operatingMargin: '영업이익률', netMargin: '순이익률', fcfMargin: '잉여현금 마진',
  capexIntensity: '설비투자 ÷ 매출', rdRatio: 'R&D ÷ 매출', sbcRatio: '주식보상 ÷ 매출', shareholderReturn: '주주환원', dividends: '배당', netCash: '순현금·순부채', leverage: '부채 비중',
  roe: 'ROE', revisions: '이익 전망 수정', inventory: '재고', retention: '순매출 유지율', oilSensitivity: '유가 민감도', nim: '순이자마진', cet1: '자본비율(CET1)',
  creditCost: '대손비용', pipeline: '파이프라인', backlog: '수주잔고', ffo: 'FFO' });
export const metricLabel = (id) => METRIC_LABELS[id] || id;

// ── 2. Strengths and weaknesses against named theme peers ───────────────────────────────────────────────────────────
// rows: [self, ...peers] with growth, margin, roe, fcfMargin, fwdPe, ret3m. Higher is the stronger side except the
// forward PER (a lower multiple is a lighter price burden). A metric needs this company's value and at least four values.
export const PEER_FACTS = Object.freeze([
  { id: 'growth', label: '매출 성장', unit: '%', better: 'high' }, { id: 'margin', label: '순이익률', unit: '%', better: 'high' },
  { id: 'roe', label: 'ROE', unit: '%', better: 'high' }, { id: 'fcfMargin', label: '잉여현금 마진', unit: '%', better: 'high' },
  { id: 'fwdPe', label: 'Forward PER', unit: '배', better: 'low' }, { id: 'ret3m', label: '3개월 주가 수익률', unit: '%', better: 'high' }
]);
export function buildPeerStrengths(rows = [], { max = 3 } = {}) {
  const self = rows.find((row) => row?.self);
  if (!self) return null;
  const facts = [];
  for (const fact of PEER_FACTS) {
    const value = finite(self[fact.id]);
    const values = rows.map((row) => finite(row[fact.id])).filter((v) => v != null);
    if (value == null || values.length < 4) continue;
    const ordered = [...values].sort((a, b) => (fact.better === 'high' ? b - a : a - b));
    const rank = ordered.indexOf(value) + 1;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const show = (v) => (fact.unit === '배' ? `${v.toFixed(1)}배` : `${v.toFixed(1)}%`);
    const side = (rank - 1) / Math.max(1, values.length - 1); // 0 = best, 1 = worst
    const versus = fact.better === 'low' ? (value < mid ? '보다 낮음' : value > mid ? '보다 높음' : '과 같음') : (value > mid ? '보다 높음' : value < mid ? '보다 낮음' : '과 같음');
    facts.push({ id: fact.id, label: fact.label, value, rank, n: values.length, median: mid, side,
      text: `${fact.label} ${show(value)}로 동종 ${values.length}곳 중 ${rank}위(중앙값 ${show(mid)}${versus})${fact.id === 'fwdPe' ? (value < mid ? ', 이익 대비 가격 부담이 가벼운 편' : value > mid ? ', 이익 대비 가격 부담이 무거운 편' : '') : ''}` });
  }
  if (!facts.length) return null;
  const strengths = facts.filter((f) => f.side < 0.5 && f.rank <= Math.ceil(f.n / 2)).sort((a, b) => a.side - b.side).slice(0, max);
  const weaknesses = facts.filter((f) => f.side > 0.5 && !strengths.includes(f)).sort((a, b) => b.side - a.side).slice(0, max);
  return { strengths, weaknesses, facts, peers: rows.length - 1 };
}

// ── 3. Situations that favour or burden the company (theme exposure tags × macro branches) ─────────────────────────────
export function buildSituationRead({ themes = [], market = 'US', scenario = null, beta = null } = {}) {
  const profiles = themes.map((theme) => ({ theme, profile: themeProfile(market, theme.id) })).filter((item) => item.profile);
  if (!profiles.length) return null;
  const tags = [...new Set(profiles.flatMap((item) => item.profile.tags))];
  const favour = BRANCHES.filter((branch) => windFor(tags, branch) === 'tail').map(branchTitle);
  const burden = BRANCHES.filter((branch) => windFor(tags, branch) === 'head').map(branchTitle);
  const leadId = scenario?.status === 'current' ? scenario?.crossroads?.leadId : null;
  const lead = leadId ? BRANCHES.find((branch) => branch.id === leadId) : null;
  const leadWind = lead ? windFor(tags, lead) : null;
  const leadItem = leadId ? scenario.crossroads.items?.find((item) => item.id === leadId) : null;
  return {
    tags: tags.map((tag) => EXPOSURE_TAGS[tag] || tag), favour, burden, themes: profiles.map((item) => ({ id: item.theme.id, label: item.theme.label, thesis: item.profile.thesis, breaks: item.profile.breaks })),
    lead: lead ? { title: branchTitle(lead), wind: WIND_LABELS[leadWind] || null, fit: leadItem?.fit || null } : null, beta,
    now: lead ? `지금 가장 맞는 시나리오 '${branchTitle(lead)}'${leadItem?.fit ? `(${leadItem.fit})` : ''}는 이 종목의 노출로 보면 ${WIND_LABELS[leadWind] || '판단 보류'} 쪽입니다.` : null
  };
}

// 1-year daily beta against the benchmark closes (aligned by date). null below 120 shared sessions.
export function dailyBeta(stockBars = [], benchmark = []) {
  const bench = new Map((benchmark || []).filter((p) => p?.date && finite(p.value) > 0).map((p) => [String(p.date).slice(0, 10), p.value]));
  const pairs = [];
  let prev = null;
  for (const bar of stockBars || []) {
    const date = String(bar?.date || '').slice(0, 10);
    const close = finite(bar?.close);
    if (!date || !(close > 0) || !bench.has(date)) continue;
    if (prev) pairs.push([close / prev.close - 1, bench.get(date) / prev.bench - 1]);
    prev = { close, bench: bench.get(date) };
  }
  const rows = pairs.slice(-252);
  if (rows.length < 120) return null;
  const mean = (i) => rows.reduce((s, r) => s + r[i], 0) / rows.length;
  const ms = mean(0), mb = mean(1);
  let cov = 0, varb = 0;
  for (const [s, b] of rows) { cov += (s - ms) * (b - mb); varb += (b - mb) ** 2; }
  return varb > 0 ? { value: cov / varb, sessions: rows.length } : null;
}

// ── 4. Thesis template ─────────────────────────────────────────────────────────────────────────────────────────────
// implied: impliedGrowth result ({state, growth}) for the reverse DCF; trailing: buildTrailingYearRead; marginCash; consensus row;
// schedule: buildEarningsSchedule; levels: the chart level map for the symbol (_aioPriceLevelsFor) or null; peerPe: { value, median } forward PER vs peers.
export function buildThesisFrame({ implied = null, trailing = null, marginCash = null, consensus = null, schedule = null, levels = null, peerPe = null, situation = null } = {}) {
  const impliedPct = implied?.state === 'ready' ? implied.growth * 100 : null;
  const ttm = trailing?.revenueYoy ?? null;
  const op = marginCash?.state === 'ready' ? marginCash.ladder.find((row) => row.id === 'operating') : null;
  const netNow = trailing?.margin ?? null;
  const up = finite(consensus?.fwd?.up4w) || 0, down = finite(consensus?.fwd?.down4w) || 0;
  const support = levels?.supportCandidates?.[0] || null;
  const resistance = levels?.resistanceCandidates?.[0] || null;
  const price = (v) => `$${Number(v).toFixed(2)}`;
  const priced = impliedPct != null
    ? `지금 가격은 잉여현금흐름이 10년간 연 ${impliedPct.toFixed(1)}% 늘어난다고 가정합니다${ttm != null ? `. 실제 최근 4개 분기 매출 성장은 ${signedText(ttm, 1, '%')}입니다(매출과 현금흐름은 다른 숫자라, 같은 방향인지를 봅니다)` : ''}.`
    : implied?.state ? '역 DCF로 가격이 가정하는 성장률을 계산할 수 없는 상태입니다(잉여현금흐름 마이너스, 금융사, 주식 수·종가 미확인 등).' : null;
  const conditions = [
    impliedPct != null ? `성장이 가격이 가정한 연 ${impliedPct.toFixed(1)}% 이상으로 이어진다` : ttm != null ? `매출 성장(최근 4개 분기 ${signedText(ttm, 1, '%')})이 크게 꺾이지 않는다` : null,
    op?.value != null ? `영업이익률 ${op.value.toFixed(1)}% 수준이 유지된다` : netNow != null ? `순이익률 ${netNow.toFixed(1)}% 수준이 유지된다` : null,
    consensus?.fwd ? `이익 전망이 계속 위로 고쳐진다(지금 4주 상향 ${up}, 하향 ${down})` : null
  ].filter(Boolean);
  const checks = [
    schedule?.text ? `실적: ${schedule.text}` : null,
    consensus?.fwd ? '컨센서스: 다음 4주 동안 상향·하향 건수의 방향' : null,
    support || resistance ? `가격 레벨: ${[support ? `가장 가까운 아래 후보 ${price(support.price)}(${signedText(support.pct, 1, '%')})` : null, resistance ? `위 후보 ${price(resistance.price)}(${signedText(resistance.pct, 1, '%')})` : null].filter(Boolean).join(', ')} — 관찰할 가격대이며 보장이 아님` : '가격 레벨: 차트 화면의 레벨 지도에서 확인(차트를 열면 이 목록에도 표시)'
  ].filter(Boolean);
  const breaks = [
    impliedPct != null ? `성장이 연 ${impliedPct.toFixed(1)}% 아래로 둔화되는 흐름이 확인된다` : ttm != null ? '분기 매출 성장이 연속으로 느려진다' : null,
    op?.value != null ? `영업이익률이 ${op.prior != null ? `직전 해 ${op.prior.toFixed(1)}%` : `${op.value.toFixed(1)}%`} 아래로 내려간다` : netNow != null ? '순이익률이 1년 전 수준 아래로 내려간다' : null,
    consensus?.fwd ? '이익 전망 수정이 하향 우세로 바뀐다' : null,
    support ? `가장 가까운 아래 가격 후보 ${price(support.price)}를 종가로 이탈한다` : null,
    ...(situation?.themes?.[0]?.breaks || []).slice(0, 2).map((text) => `테마 논지 깨짐: ${text}`)
  ].filter(Boolean);
  const paths = [
    { id: 'earnings', label: '이익 성장 경로', holds: '매출과 이익률이 유지돼 이익이 늘면, 배수가 그대로여도 이익만큼 가치가 커집니다.', fails: '성장 둔화나 이익률 하락이 겹치면 이 경로가 약해집니다.' },
    { id: 'multiple', label: '밸류에이션(배수) 경로', holds: peerPe?.value != null && peerPe?.median != null ? `Forward PER ${peerPe.value.toFixed(1)}배가 동종 중앙값 ${peerPe.median.toFixed(1)}배보다 ${peerPe.value < peerPe.median ? '낮아, 전망이 계속 좋아질 때 배수가 동종 쪽으로 다시 매겨질 여지가 있습니다' : '높아, 배수가 더 오르려면 동종보다 빠른 성장이 확인돼야 합니다'}.` : '이익 전망이 좋아지고 시장 환경이 받쳐 주면 같은 이익에 더 높은 배수가 매겨질 수 있습니다.',
      fails: `금리 상승, 시장 부담 국면${situation?.lead?.wind === '부담' ? ', 지금처럼 선두 시나리오가 이 종목 테마에 부담인 환경' : ''}에서는 배수가 먼저 줄어듭니다.` }
  ];
  return { priced, impliedPct, ttm, conditions, checks, breaks, paths };
}

// ── 5. What to keep watching ───────────────────────────────────────────────────────────────────────────────────────
export function buildWatchList({ schedule = null, consensus = null, trailing = null, row = null, stage = null, levels = null, benchmarkRet3m = null } = {}) {
  const items = [];
  if (schedule?.text) items.push({ id: 'earnings', label: '다음 실적', now: schedule.text, why: '가이던스와 마진 방향이 논지를 가장 직접 확인합니다.' });
  const fwd = consensus?.fwd;
  if (fwd) items.push({ id: 'revisions', label: '이익 전망 방향', now: `최근 4주 상향 ${finite(fwd.up4w) || 0}, 하향 ${finite(fwd.down4w) || 0}`, why: '가격보다 먼저 방향이 바뀌는 경우가 많습니다.' });
  if (trailing?.margin != null) items.push({ id: 'margin', label: '이익률 추세', now: `최근 4개 분기 순이익률 ${trailing.margin.toFixed(1)}%${trailing.priorMargin != null ? `(1년 전 ${trailing.priorMargin.toFixed(1)}%)` : ''}`, why: '성장보다 이익률이 먼저 꺾이는 일이 흔합니다.' });
  const r3 = finite(row?.ret3m);
  if (r3 != null) items.push({ id: 'relative', label: '상대강도', now: `3개월 ${signedText(r3, 1, '%')}${benchmarkRet3m != null ? `, 같은 기간 S&P 500 ${signedText(benchmarkRet3m, 1, '%')}` : ''}`, why: '지수보다 강한지 약한지가 수급의 방향입니다.' });
  const support = levels?.supportCandidates?.[0];
  const resistance = levels?.resistanceCandidates?.[0];
  if (support || resistance) items.push({ id: 'levels', label: '가까운 가격 레벨', now: [support ? `아래 $${support.price.toFixed(2)}` : null, resistance ? `위 $${resistance.price.toFixed(2)}` : null].filter(Boolean).join(', '), why: '관찰할 가격대이며 매매 가격 제안이 아닙니다.' });
  else if (finite(row?.vcpPivot)) items.push({ id: 'levels', label: '피벗', now: `$${Number(row.vcpPivot).toFixed(2)}`, why: '차트 판정의 기준 가격대이며 매매 가격 제안이 아닙니다.' });
  if (stage) items.push({ id: 'theme', label: '테마 단계', now: `${stage.label} ${stage.stateLabel}`, why: '테마 전체가 약해지면 개별 종목도 같은 방향으로 끌리기 쉽습니다.' });
  return items.slice(0, 6);
}

// ── 6. The market link line ────────────────────────────────────────────────────────────────────────────────────────
export function buildMarketLink({ regime = null, scenario = null, stage = null, themeLabel = null, tags = [] } = {}) {
  const parts = [];
  if (regime?.available && regime.overall) parts.push(`지금 시장 상태는 '${regime.overall}'`);
  const leadId = scenario?.status === 'current' ? scenario?.crossroads?.leadId : null;
  const lead = leadId ? BRANCHES.find((branch) => branch.id === leadId) : null;
  const item = leadId ? scenario.crossroads.items?.find((row) => row.id === leadId) : null;
  const wind = stage?.wind || (lead && tags.length ? WIND_LABELS[windFor(tags, lead)] : null);
  if (lead) parts.push(`가장 맞는 시나리오 '${branchTitle(lead)}'${item?.fit ? `(${item.fit})` : ''}`);
  if (!parts.length) return null;
  const theme = themeLabel ? `이 종목의 테마 '${themeLabel}'` : null;
  const tail = lead && theme && wind ? `에서 ${theme}는 ${wind === '영향 작음' ? '영향이 작은' : `${wind}`} 쪽입니다${stage?.stateLabel ? `(테마 단계: ${stage.stateLabel})` : ''}.` : '입니다.';
  return { text: `${parts.join(', ')}${tail}`, wind: wind || null, lead: lead ? branchTitle(lead) : null };
}
