// P1621: bounded, question-selected facts from the same native models used by the screens.
import { buildBreadthSnapshot } from '../../domain/market/breadth-snapshot.js';
import { buildGroupStrength } from '../../domain/themes/group-strength.js';
import { buildChartScenarios, buildVolumeByPrice } from '../../domain/technical/chart-scenarios.js';
import { koreaParticipationContext } from '../../domain/market/korea-participation.js';
import { companyAnalysisContext } from '../../domain/entity/company-analysis.js';
import { renderMarketScenarioContext, buildMarketScenarios } from '../../domain/market/regime-scenarios.js';
import { renderScenarioOutlookContext } from '../../domain/market/scenario-outlook.js';
import { outlookForRoot } from '../../ui/components/scenario-outlook.js';
import { buildMarketGuide, renderMarketGuideContext } from '../../domain/guide/market-guide.js';
import { latestCompletedUsSession } from '../../domain/market/market-calendar.js';
import { collectMarketInputs } from '../../data/selectors/market-inputs.js';
import { buildMarketRegime } from '../../domain/briefing/market-read.js';
import { renderMacroCrossroadsContext } from '../../domain/market/macro-crossroads.js';
import { crossroadsForRoot } from '../../ui/components/macro-crossroads.js';
import { renderThemePlaybookContext } from '../../domain/scenarios/theme-playbook.js';
import { themePlaybookForRoot } from '../../ui/components/theme-playbook.js';
import { conditionLabel, parseConditionValue } from '../../domain/screener/custom-conditions.js';

// P1621: share page-independent selection between both legacy chat callers.
export function buildQuestionDomainContext({ ctxId, query = '', root = {}, readDomain = () => '' } = {}) {
  const contexts = new Set();
  if (/^(macro|fxbond|themes|theme-detail)$/.test(ctxId)) contexts.add(ctxId); // v57.54: kr-macro/kr-themes are no longer chat contexts
  const text = String(query || '');
  if (/CPI|PCE|FOMC|인플레|물가|고용|실업|연준|거시/i.test(text)) contexts.add('macro');
  if (/DXY|OAS|달러|환율|국채|채권|금리|스프레드/i.test(text)) contexts.add('fxbond');
  if (/섹터|테마|업종|로테이션/i.test(text)) contexts.add('themes');
  // P1740: Korean policy/official-release questions get the Korean macro block (BOK rate, CPI, export flash, 금통위);
  // it already carries the US block, so the plain macro one is dropped to avoid sending it twice.
  if (/한국은행|한은|기준금리|금통위|한국\s*(?:물가|소비자물가|cpi|경제|수출)|국내\s*물가|수출\s*(?:잠정|동향|증가|감소)/i.test(text)) contexts.add('kr-macro');
  if (contexts.has('kr-macro')) contexts.delete('macro');
  const parts = [...contexts].map(readDomain).filter(Boolean);
  // v57.61: the screener's 맞춤 조건 decide which rows the table shows; without them the AI judged a different list.
  const custom = ctxId === 'screener' ? parseConditionValue(root.document?.getElementById?.('scr-custom-conditions')?.value).map(conditionLabel).filter(Boolean) : [];
  if (custom.length) parts.push(`스크리너 화면에 적용된 맞춤 조건(모두 만족하는 종목만 표에 남음, 매매 신호 아님): ${custom.join(' · ')}`);
  // v57.77 perf: rows only, through the shared row snapshot (the bare getScreenerState() call cloned the whole slice again).
  const screenerRows = root.AIO_ARCH?.getScreenerRows?.();
  const facts = buildMarketContentContext({ query: text, history: root._aioHistory || [], themes: root.THEME_MAP || [], rows: screenerRows || root.SCREENER_DB || [] });
  if (facts) parts.push(facts);
  if (/시장|시나리오|앞으로|향후|관찰|금리|신용|변동성/.test(text) && root._aioHistory?.length) {
    // P1729: the same inputs as the 시장 상태 screen (credit, rates, macro history, now) — history alone made the AI say
    // "신용 관측이 없어 보류" while the screen judged the credit axis.
    const scenarios = renderMarketScenarioContext(collectMarketInputs(root));
    if(scenarios) parts.push(scenarios);
  }
  // P1742: forward, rate/inflation/jobs and "what should I do" questions get the same branches the 거시 screen draws.
  if (/앞으로|향후|전망|시나리오|대응|어떻게\s*(?:해야|하지|할까|될까)|뭘\s*해야|무엇을\s*해야|금리|물가|CPI|PCE|고용|연준|FOMC|유가|경기|침체|인하|인상/i.test(text) && root._aioHistory?.length) {
    try {
      const regime = buildMarketRegime(collectMarketInputs(root));
      // P1743: with the automated record (what changed since the last refreshes, how the latest releases scored).
      const model = crossroadsForRoot(root, { regime });
      const crossroads = renderMacroCrossroadsContext(model, { state: root._aioScenarioState || null });
      if (crossroads) parts.push(crossroads);
    } catch (_) {}
  }
  // Owner 2026-10-19: forward, "what should I do", attitude/strategy and "what not to be fooled by" questions get the
  // shared market guide (the 오늘 card) and the structure outlook's check/caution/ignore lists, so the chat explains with
  // the same synthesis and concept layer as the screens.
  if (/앞으로|향후|전망|시나리오|대응|어떻게\s*(?:해야|하지|할까|될까|봐야)|뭘\s*해야|무엇을\s*해야|유리|기회비용|태도|마인드|마음가짐|전략|기법|속지|믿어|믿을|조심|주의할|지향|지양|초보|배우|공부|시장\s*(?:상황|해석|어때)/i.test(text) && root._aioHistory?.length) {
    try {
      const inputs = collectMarketInputs(root);
      const regime = buildMarketRegime(inputs);
      const scenarios = regime.available ? buildMarketScenarios(inputs, { regime }) : null;
      const outlook = scenarios?.available ? outlookForRoot(root, { scenarios, regime }) : null;
      const structure = renderScenarioOutlookContext(outlook);
      if (structure) parts.push(structure);
      const guide = renderMarketGuideContext(buildMarketGuide({ regime, outlook, crossroads: crossroadsForRoot(root, { regime }) }));
      if (guide) parts.push(guide);
    } catch (_) {}
  }
  // P1743: theme/sector, rotation and "should I stage into X" questions get every theme read by the same rule
  // (stage × macro wind × choices × evidence × structural hypothesis), not only the themes the question names.
  if ((ctxId === 'themes' || ctxId === 'theme-detail' || /섹터|테마|업종|로테이션|순환|주도|병목|조정|반등|분할|비중|들어가|살까|담을|앞으로|향후|대응/.test(text)) && root._aioHistory?.length) {
    try {
      const rows = screenerRows || root.SCREENER_DB || [];
      const { playbook } = themePlaybookForRoot(root, { getState: () => ({ screener: { rows } }) });
      const themesBlock = renderThemePlaybookContext(playbook, { query: text });
      if (themesBlock) parts.push(themesBlock);
    } catch (_) {}
  }
  if (/한국|코스피|코스닥|원화|한국.*시장|국내.*시장/.test(text)) {
    const korea = koreaParticipationContext(root.__aioKoreaParticipation);
    if (korea) parts.push(korea);
  }
  const cached = root.__aioStockChartAnalysis;
  const company = root.__aioCompanyAnalysis;
  // X22: role/industry words ("멀티에셋 PM 관점", "서버/HW") are not a requested company unless they are the screen's own symbol.
  const roleWords = ['AI','PM','HW','SW','IR','HR','PR','UI','UX','IB','PE','VC','EM','DM','CEO','CFO','CIO','ESG','GPU','CPU','HBM','LLM','EV','ESS'];
  const requested = (text.match(/\b[A-Z]{1,6}(?:\.(?:KS|KQ))?\b|\b\d{6}(?:\.(?:KS|KQ))?\b/g) || []).filter(id => !['RSI','MACD','EMA','SMA','ADX','VCP','OHLCV','USD','KRW'].includes(id) && (!roleWords.includes(id) || id === company?.symbol || id === cached?.symbol));
  const sameIssuer = requested.some(id => id === cached?.symbol || (/^\d{6}$/.test(id) && cached?.symbol === `${id}.KS`) || (/^\d{6}$/.test(id) && cached?.symbol === `${id}.KQ`));
  if(company?.symbol && /기업|회사|사업|경쟁|해자|재무|실적|현금|위험|분석/.test(text) && (requested.includes(company.symbol) || (ctxId==='ticker' && !requested.length))) parts.push(companyAnalysisContext(company));
  if (cached?.symbol && /차트|시나리오|매물대|가격대|돌파|저항|지지/i.test(text) && (sameIssuer || (ctxId === 'technical' && !requested.length))) {
    const scenarios = buildChartScenarios(cached.analysis), profile = buildVolumeByPrice(cached.analysis?.bars || []);
    if (scenarios.available) parts.push(`화면과 동일한 ${cached.symbol} 완료 일봉 기준 ${scenarios.asOf}. 조건부 흐름(예측 확률/목표가가 아님):\n${scenarios.scenarios.map(item => `${item.title}: ${item.text}`).join('\n')}`);
    if (profile.available) parts.push(`일봉 추정 거래 집중 가격대: ${profile.zones.map(zone => `${zone.low.toFixed(2)}~${zone.high.toFixed(2)} (${zone.share.toFixed(1)}%)`).join(', ')}. ${profile.start}~${profile.end}. 거래량을 일봉 저가~고가에 균등 배분한 참고치이며 실제 가격별 체결 매물대/보유원가/매수·매도 우위가 아님.`);
  }
  return parts.join('\n');
}

export function buildMarketContentContext({ query = '', history = [], themes = [], rows = [] } = {}) {
  const parts = [];
  if (/시장|상승.*하락|신고가|신저가|시장\s*폭|breadth|SMA\s*(50|200)|50일|200일/i.test(query)) {
    const snapshot = buildBreadthSnapshot(history);
    if (snapshot.cards.length) parts.push(`AIO 미국 수집 표본의 시장 폭 · ${snapshot.asOf} 종가 기준\n` + snapshot.cards.map((card) => `${card.title}: ${card.first} / ${card.second}. ${card.detail} 판정 ${card.eligible ?? '미확인'}개 / 대상 ${card.universe ?? '미확인'}개.`).join('\n'));
  }
  if (/테마|섹터|업종|구성\s*종목|상대강도/i.test(query)) {
    const model = buildGroupStrength({ themes, rows });
    const exact = model.groups.filter((group) => query.includes(group.name) || (group.themeName && query.includes(group.themeName)));
    const groups = exact.length ? exact : model.groups.slice(0, 15);
    // P1681 (X03): the AI reads the same stale admission the theme table prints.
    const usDates = rows.filter((row) => !/\.(KS|KQ)$/i.test(String(row?.sym || ''))).map((row) => String(row?.factorSessionDate || '')).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
    const expected = latestCompletedUsSession(Date.now(), { requirePrevious: false })?.date || null;
    const staleNote = usDates.length && expected && usDates[usDates.length - 1] < expected ? ` 미국 종가 기준일 ${usDates[usDates.length - 1]}은 최신 완료 거래일 ${expected} 이전이다 — 이 순위를 지금의 주도·개선으로 단정하지 말고 기준일 참고 값으로만 설명한다.` : '';
    if (groups.length) parts.push(`AIO 하위 테마 · 1/3/6개월 수익률 중앙값. 아래는 자료가 있는 테마이며 전체 시장이 아니다.${staleNote}\n` + groups.slice(0, 30).map((group) => {
      const dates = [...new Set(group.constituents.map((item) => rows.find((row) => String(row.sym).toUpperCase() === item.sym)?.factorSessionDate).filter(Boolean))];
      // X16 (2026-10-13): the theme table shows 1/3/6-month medians; the AI got only 3 months and said 1-month was missing.
      const pct = (value) => (value == null ? '보류' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`);
      return `${group.themeName} / ${group.name}: 중앙값 1개월 ${pct(group.ret1m)} · 3개월 ${group.ret3m == null ? '기준일 불일치/미확인으로 보류' : pct(group.ret3m)} · 6개월 ${pct(group.ret6m)}${group.rank1m != null && group.rank3m != null ? ` (테마 순위 1개월 ${group.rank1m}위 / 3개월 ${group.rank3m}위 — 같은 날 끝나는 두 기간의 비교이며 과거 순위 변화가 아님)` : ''}, 수익률 표본 ${group.members}/${group.listed}개, 구성 ${group.constituents.map((item) => item.sym).join(', ')}. 미국/한국 각각의 종가 기준일 ${dates.join(', ') || '미확인(현재 수치로 단정 금지)'}. 그룹 내부 3개월 수익률 순위: ${group.rankedMembers.map((member) => `${member.sym} ${member.rank == null ? '순위 보류/수익률 없음' : `${member.rank}위 ${member.ret3m.toFixed(1)}%`}`).join('; ')}.`;
    }).join('\n'));
  }
  return parts.join('\n\n');
}
