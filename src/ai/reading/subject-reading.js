// The per-subject AI reading — one stock (종목 개요), one chart (기술적 분석 › 종목 분석) or the reader's own portfolio —
// written on demand in the browser, because it cannot be precomputed: about 900 symbols a day would not fit the shared
// budget, and the portfolio is the reader's private, client-side data. The facts are what the screen already computed
// (the company model, the stock lens the AI panel reads, the chart analysis, the portfolio read and its AI rows); the
// instruction, prompt shape and checks are the per-screen readings' (reading-core.js). Pure: the component
// (src/ui/components/subject-reading.js) gathers the inputs, asks the Worker and keeps the cache.
import { buildReadingPrompt, coreReadingIssues, coreReadingWarnings, readingKey } from './reading-core.js';
import { readNumber as finite, signedText } from '../../domain/shared/number.js';
import { hasLeadingIsoDay } from '../../domain/shared/session-date.js';

const md = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const iso = (value) => (hasLeadingIsoDay(value) ? String(value).slice(0, 10) : null);
const pct = (value, digits = 1) => `${signedText(value, digits)}%`;
const text = (value, max = 240) => (typeof value === 'string' && value.trim() ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const pairs = (rows, max = 8) => (Array.isArray(rows) ? rows : []).filter((row) => Array.isArray(row) && row[0] && row[1] != null && row[1] !== '').slice(0, max).map(([label, value]) => `${label} ${value}`).join('; ');
const regimeLine = (regime) => (regime?.available && regime.overall ? `미국 시장 상태 판정: ${regime.overall}` : '');

// ---- the registry: kind → { name, guide, facts(input) } ----------------------------------------------------------------------
export const SUBJECT_READINGS = Object.freeze({
  // 종목 개요: what the business is, what the price already asks of it, the last reported year and quarter, the trend,
  // and what would change the read. Inputs: the company model (domain/entity/company-analysis.js buildCompanyAnalysis),
  // the valuation line under the price (company-analysis.js keyMetricsLine), the stock lens as the AI panel reads it
  // (stock-lens-cards.js installStockLensGlobal) and the market state.
  stock: Object.freeze({
    name: '종목',
    guide: '- 이 회사가 무엇으로 돈을 벌고, 지금 주가가 무엇을 이미 기대하고 있는지로 엽니다(밸류에이션과 최근 실적을 함께). 추세와 시장 상태가 그 기대를 받치는지 짚고, 다음 실적이나 조건 중 무엇이 확인되면 판단이 굳어지고 무엇이 나오면 바뀌는지로 맺습니다. 자료가 없는 항목은 없다고 짧게 말하고 채워 넣지 않습니다.',
    facts({ company = null, valuation = '', lens = null, regime = null } = {}) {
      if (!company?.available || !company.symbol) return null;
      const evidence = company.marketEvidence || {};
      const basis = iso(evidence.asOf) || iso(company.price?.observedAt);
      if (!basis) return null;
      const returns = evidence.returns || {};
      const trend = [['1개월', returns.ret1m], ['3개월', returns.ret3m], ['6개월', returns.ret6m]].filter(([, value]) => finite(value) != null).map(([label, value]) => `${label} ${pct(value)}`);
      const position = [['50일선 대비', evidence.pctSma50], ['200일선 대비', evidence.pctSma200]].filter(([, value]) => finite(value) != null).map(([label, value]) => `${label} ${pct(value)}`);
      const id = company.identity || {};
      const fiscal = (company.financial?.fiscal?.points || []).map((point) => `${point.title}: ${text(point.text, 200)}`).slice(0, 4);
      const metrics = (lens?.lens?.metrics || []).filter((row) => row.value && row.value !== '미확인').slice(0, 6).map((row) => `${row.metric} ${row.value}${row.trend ? ` (${row.trend})` : ''}`);
      const thesis = lens?.thesis || null;
      return {
        subject: company.symbol, basis,
        lines: [`기준일: ${md(basis)} 종가`, `종목: ${company.symbol} ${id.name && id.name !== company.symbol ? id.name : ''} · ${[id.market, id.sector, id.industry].filter(Boolean).join(' · ')}`.trim(),
          company.business?.description ? `사업: ${text(company.business.description, 320)}` : '사업: 사업 설명 자료 없음',
          (company.associations || []).length ? `연결 테마: ${company.associations.map((item) => item.name).slice(0, 4).join(', ')}` : '',
          valuation ? `밸류에이션: ${text(valuation, 300)}` : '밸류에이션: 자료 없음',
          fiscal.length ? `최근 회계연도(${company.financial?.periodEnd || '기준 미확인'}): ${fiscal.join(' / ')}` : '',
          metrics.length ? `${lens.lens.name || '핵심 지표'}: ${metrics.join('; ')}` : '',
          trend.length || position.length ? `가격 추세: ${[...trend, ...position].join(' · ')}` : '',
          thesis?.priced ? `주가에 반영된 기대(규칙으로 계산): ${text(thesis.priced, 260)}` : '',
          ...(Array.isArray(thesis?.breaks) ? thesis.breaks.slice(0, 2).map((item) => `가설이 깨지는 조건: ${text(item, 200)}`) : []),
          ...(Array.isArray(lens?.watch) ? lens.watch.slice(0, 4).map((item) => `확인할 것: ${text(item, 200)}`) : []),
          lens?.marketLink ? `시장과의 연결: ${text(lens.marketLink, 240)}` : '', regimeLine(regime),
          ...(company.risks || []).slice(0, 2).map((risk) => `관찰: ${text(risk.text, 200)}`)].filter(Boolean)
      };
    }
  }),
  // 기술적 분석 › 종목 분석: the one chart the slot draws (domain/technical/chart-analysis.js analyzeChart, its levels and
  // chart-scenarios.js buildChartScenarios) and the market state.
  chart: Object.freeze({
    name: '기술적 분석',
    guide: '- 이 차트가 지금 어떤 자리인지로 엽니다(추세 상태어와 기준선 위치). 가까운 지지·저항과 거래량이 그 자리를 받치는지, 시장 상태와 같은 쪽인지 짚고, 조건별 시나리오 중 어느 가격이 확인되면 판단이 바뀌는지로 맺습니다. 상태어와 가격 수준은 묶음의 것만 씁니다. 진입가·손절가·목표가는 쓰지 않습니다.',
    facts({ symbol = '', analysis = null, scenarios = null, regime = null } = {}) {
      if (!analysis?.available || !symbol) return null;
      const basis = iso(analysis.asOf);
      if (!basis) return null;
      return {
        subject: String(symbol).toUpperCase(), basis,
        lines: [`기준일: ${md(basis)} 종가`, `종목: ${String(symbol).toUpperCase()}`, analysis.stateLabel ? `추세 상태어(규칙으로 정함): ${analysis.stateLabel}` : '',
          pairs(analysis.evidence) ? `근거: ${pairs(analysis.evidence)}` : '', analysis.flip ? `상태가 바뀌는 조건: ${text(analysis.flip, 240)}` : '',
          analysis.weinstein?.text ? `단계: ${text(analysis.weinstein.text, 160)}` : '',
          finite(analysis.templatePass) != null ? `추세 템플릿 충족: ${analysis.templatePass}/8` : '',
          finite(analysis.fromHigh) != null ? `52주 고점 대비 ${pct(analysis.fromHigh)}` : '',
          ...(scenarios?.available ? (scenarios.scenarios || []).map((row) => `시나리오 ${row.title}: ${text(row.text, 220)}`) : []),
          regimeLine(regime)].filter(Boolean)
      };
    }
  }),
  // 포트폴리오: what leaves the browser is what the chat's portfolio turn may carry (domain/portfolio/portfolio-read.js
  // portfolioRowsForAI: ticker, sector, weight and return only, in the base currency, with the valuation date), the read's
  // trend and sector shares, and the market state. No quantity, cost, amount, memo or account.
  portfolio: Object.freeze({
    name: '포트폴리오',
    guide: '- 이 보유 구성이 지금 시장 상태에서 어디에 노출돼 있는지로 엽니다: 비중이 몰린 곳, 보유 종목들이 공유하는 업종·흐름, 하락 추세에 있는 비중. 시장 상태가 바뀌면 어느 보유가 먼저 영향을 받는지로 맺습니다. 개별 종목의 매수·매도·비중 조절 지시는 하지 않습니다.',
    facts({ rows = null, read = null, regime = null } = {}) {
      const list = (rows?.rows || []).filter((row) => row?.ticker && finite(row.allocationPct) != null);
      const basis = iso(rows?.asOf);
      if (!rows?.available || !list.length || !basis) return null;
      const sorted = [...list].sort((a, b) => b.allocationPct - a.allocationPct);
      const top3 = sorted.slice(0, 3).reduce((sum, row) => sum + row.allocationPct, 0);
      return {
        subject: 'portfolio', basis,
        lines: [`기준일: ${md(basis)} 평가`, `보유 ${list.length}종목, 기준 통화 ${rows.baseCurrency || '미확인'}${finite(rows.cashPct) != null ? `, 현금 ${finite(rows.cashPct).toFixed(1)}%` : ''}`,
          `상위 3종목 비중 합계 ${top3.toFixed(1)}%`,
          ...sorted.slice(0, 10).map((row) => `보유: ${row.ticker}${row.sector ? ` (${row.sector})` : ''} 비중 ${Number(row.allocationPct).toFixed(1)}%${finite(row.returnPct) != null ? ` · 수익률 ${pct(row.returnPct)}` : ''}`),
          (read?.trendMix || []).length ? `평가액 기준 추세 상태: ${read.trendMix.filter((row) => row.pct > 0).map((row) => `${row.label} ${row.pct.toFixed(0)}%`).join(' · ')}` : '',
          (read?.sectorMix || []).length ? `섹터 비중: ${read.sectorMix.slice(0, 6).map((row) => `${row.label} ${row.pct.toFixed(0)}%${row.quadrant?.label ? ` (섹터 회전 ${row.quadrant.label})` : ''}`).join('; ')}` : '',
          regimeLine(regime), regime?.leadership?.summary ? `주도주 흐름: ${text(regime.leadership.summary, 200)}` : ''].filter(Boolean)
      };
    }
  })
});
export const SUBJECT_READING_KINDS = Object.freeze(Object.keys(SUBJECT_READINGS));

/** { kind, subject, basis, lines, key } or null. `key` changes with any fact (per subject per completed close). */
export function buildSubjectPacket(kind, input) {
  const spec = SUBJECT_READINGS[kind];
  if (!spec) return null;
  let facts = null;
  try { facts = spec.facts(input || {}); } catch (_) { facts = null; }
  if (!facts?.lines?.length || !iso(facts.basis)) return null;
  const lines = facts.lines.map((line) => String(line).replace(/\s+/g, ' ').trim()).filter(Boolean);
  return { kind, subject: facts.subject, basis: facts.basis, lines, key: `${kind}:${facts.subject}:${facts.basis}:${readingKey(lines)}` };
}

export function buildSubjectPrompt(packet) {
  const spec = SUBJECT_READINGS[packet?.kind];
  return buildReadingPrompt({ name: spec?.name || '', guide: spec?.guide || '', lines: packet?.lines || [] });
}

/** { issues, warnings }: the shared blocking checks (figures, orders, probabilities, size, language) and warnings. */
export function validateSubjectReading(textValue, packet) {
  return { issues: coreReadingIssues(textValue, packet), warnings: coreReadingWarnings(textValue) };
}
