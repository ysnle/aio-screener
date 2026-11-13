// Two-ticker reference material in the shapes the unified chat injects, for the "a figure belongs to its subject" checks
// (src/ai/response/publication.js supportedNumbersFromText with `entities`).
// - tickerEnrichment: the text _fetchTickerDataForChat (js/aio-chat.js) returns — market header, then per ticker a ━
//   separator, the 【X 데이터 블록 …】 header, the price bullet and the indented label lines, no blank line between tickers.
// - technicalEnrichment: the text chatTechnicalBlock (src/ai/context/technical-lines.js) returns — one ━━ [X …] ━━ block
//   per symbol, blank lines between them.
// Both are wrapped by the caller through the real window.AIO.buildAIUntrustedBlock, as chatSendUnified does.
export const SUBJECT_ENTITIES = Object.freeze([
  { id: 'NVDA', names: ['NVIDIA', '엔비디아', 'nvidia', 'nvda'] },
  { id: 'AMD', names: ['Advanced Micro Devices', 'AMD', 'amd'] }
]);

const RULE = '━'.repeat(60);

export const MARKET_HEADER_FIGURES = ['6,812.4', '15.2', '4.95%'];

export function tickerEnrichment() {
  const ticker = (sym, name, lines) => [RULE, `【${sym} 데이터 블록, 일괄 fetched 2026-11-12 09:00 KST (각 라벨에 개별 source 명시)】`,
    'AI 답변 시 모든 정량 인용에 (출처, 기준일) 괄호 동반 의무 — ABSOLUTE RULES 16조 (R142).', ...lines];
  return '\n\n【현재 시장 환경 (자동 헤더, 화면과 같은 직전 확정 종가, 기준일: 2026-11-11)】\n'
    + '• **SPX**: 6,812.4, **VIX**: [안정] 15.2 (통상 범위), **10Y**: 4.95%, **F&G**: 48 (중립)\n\n'
    + '【사용자가 물어본 종목 실시간 데이터】\n'
    + ticker('NVDA', 'NVIDIA', [
      '• NVDA (NVIDIA): $180.25 (+1.23%) [NASDAQ]',
      '  [주가 추이] 추세 상승(50·200일선 기준) · 5거래일 +2.1%, 1개월 -6.2%, 3개월 +8.4% · 52주 범위 71% 위치(고점 대비 -9.8%) · RSI 48 (종목 화면과 같은 스크리너 행, 11/11 종가)',
      '  [Naver 컨센서스] 목표가: $220.50 ($150.00~$275.00) | 추천: 4.50/5 | 업사이드: +22.3%',
      '  [FCF Yield] 2.10%, fair (FMP) — note',
      '  [EV/EBITDA] 33.0x (sector median 19.2x), premium'
    ]).join('\n') + '\n'
    + ticker('AMD', 'Advanced Micro Devices', [
      '• AMD (Advanced Micro Devices): $142.10 (-0.84%) [NASDAQ]',
      '  [주가 추이] 추세 중립(50·200일선 기준) · 5거래일 -1.4%, 1개월 +3.3%, 3개월 -4.0% · 52주 범위 55% 위치(고점 대비 -18.1%) · RSI 52 (종목 화면과 같은 스크리너 행, 11/11 종가)',
      '  [Naver 컨센서스] 목표가: $175.00 ($120.00~$210.00) | 추천: 4.10/5 | 업사이드: +23.2%',
      '  [FCF Yield] 1.40%, fair (FMP) — note',
      '  [EV/EBITDA] 41.2x (sector median 19.2x), premium'
    ]).join('\n')
    + '\n\nABSOLUTE RULES (fixture):\n1. 위 실시간 데이터 블록의 수치만 인용.\n';
}

export function technicalEnrichment() {
  return '\n\n【종목 기술적 실측 데이터 (차트 화면 일봉 판정)】\n' + [
    '━━ [NVDA 기술적 데이터, 일봉 260봉, 차트 화면과 같은 완료 봉 기준] ━━\n• 종가 $180.25 (2026-11-11, +1.23%), RSI(14) 48.0 (2026-11-11 종가, 스크리너 값) 중립\n• 이동평균: 20일 $176.40, 50일 $183.10, 200일 $162.00 — 정배열',
    '━━ [AMD 기술적 데이터, 일봉 260봉, 차트 화면과 같은 완료 봉 기준] ━━\n• 종가 $142.10 (2026-11-11, -0.84%), RSI(14) 52.0 (2026-11-11 종가, 스크리너 값) 중립\n• 이동평균: 20일 $139.80, 50일 $145.60, 200일 $131.20 — 혼조'
  ].join('\n\n') + '\n';
}

/** The lines of one ticker's own material in both blocks (for counting what should belong to it). */
export function ownLines(sym) {
  const enrichment = tickerEnrichment().split('\n');
  const from = enrichment.findIndex((line) => line.startsWith(`【${sym} 데이터 블록`));
  const to = enrichment.findIndex((line, index) => index > from && (line.startsWith('━') || line.startsWith('ABSOLUTE')));
  const technical = technicalEnrichment().split('\n\n').find((block) => block.includes(`[${sym} 기술적 데이터`)) || '';
  return enrichment.slice(from, to < 0 ? undefined : to).concat(technical.split('\n'));
}

/** The wrapped prompt text as chatSendUnified appends it. */
export function wrappedReference(buildAIUntrustedBlock) {
  return buildAIUntrustedBlock('TICKER_ENRICHMENT', tickerEnrichment(), { maxChars: 12000 })
    + buildAIUntrustedBlock('TECHNICAL_ENRICHMENT', technicalEnrichment(), { maxChars: 10000 });
}
