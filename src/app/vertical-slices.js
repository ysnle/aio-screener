// Wave 3: the page work is delivered as ten vertical slices. This registry is
// the executable boundary for route pairing, required producer intent, and the
// acceptance checks that every slice must carry before it can be called done.
const ACCEPTANCE = Object.freeze(['lifecycle', 'data', 'renderer', 'chart', 'narrative', 'requiredData', 'states', 'chartFallback', 'directEntry', 'mobileKeyboard', 'routeReentry', 'outage', 'copyReview']);

export const VERTICAL_SLICE_CONTRACTS = Object.freeze([
  Object.freeze({ id: 'vs01-home-signal', order: 1, routes: Object.freeze(['home', 'signal']), requiredData: Object.freeze(['quotes', 'sentiment', 'breadth', 'technicals', 'vixHistory', 'hySpread']), acceptance: ACCEPTANCE }),
  Object.freeze({ id: 'vs02-technical-ticker', order: 2, routes: Object.freeze(['technical', 'ticker']), requiredData: Object.freeze(['quotes', 'technicals', 'news']), acceptance: ACCEPTANCE }),
  Object.freeze({ id: 'vs03-macro-fxbond', order: 3, routes: Object.freeze(['macro', 'fxbond']), requiredData: Object.freeze(['quotes', 'fred', 'hySpread']), acceptance: ACCEPTANCE }),
  Object.freeze({ id: 'vs04-themes-detail', order: 4, routes: Object.freeze(['themes', 'theme-detail']), requiredData: Object.freeze(['quotes', 'technicals']), acceptance: ACCEPTANCE }),
  Object.freeze({ id: 'vs05-fundamental-screener', order: 5, routes: Object.freeze(['fundamental', 'screener']), requiredData: Object.freeze(['quotes', 'screenerArtifact']), acceptance: ACCEPTANCE }),
  Object.freeze({ id: 'vs06-breadth-sentiment', order: 6, routes: Object.freeze(['breadth', 'sentiment']), requiredData: Object.freeze(['breadth', 'quotes', 'sentiment', 'vixHistory', 'hySpread']), acceptance: ACCEPTANCE }),
  Object.freeze({ id: 'vs07-briefing-news', order: 7, routes: Object.freeze(['briefing', 'market-news']), requiredData: Object.freeze(['news', 'quotes', 'sentiment', 'breadth']), acceptance: ACCEPTANCE }),
  Object.freeze({ id: 'vs08-portfolio', order: 8, routes: Object.freeze(['portfolio']), requiredData: Object.freeze(['quotes']), acceptance: ACCEPTANCE }),
  Object.freeze({ id: 'vs09-options', order: 9, routes: Object.freeze(['options']), requiredData: Object.freeze(['quotes', 'sentiment', 'vixHistory']), acceptance: ACCEPTANCE }),
  Object.freeze({ id: 'vs10-guide', order: 10, routes: Object.freeze(['guide']), requiredData: Object.freeze([]), acceptance: ACCEPTANCE }),
  Object.freeze({ id: 'vs11-principles', order: 11, routes: Object.freeze(['principles']), requiredData: Object.freeze([]), acceptance: ACCEPTANCE }),
  Object.freeze({ id: 'vs12-masters', order: 12, routes: Object.freeze(['masters']), requiredData: Object.freeze([]), acceptance: ACCEPTANCE }),
  Object.freeze({ id: 'vs13-atlas', order: 13, routes: Object.freeze(['atlas']), requiredData: Object.freeze([]), acceptance: ACCEPTANCE })
]);

const ROUTE_TO_SLICE = new Map(VERTICAL_SLICE_CONTRACTS.flatMap((slice) => slice.routes.map((route) => [route, slice])));

export function getVerticalSliceContract(route) {
  return ROUTE_TO_SLICE.get(String(route || '').replace(/^page-/, '')) || null;
}

export function auditVerticalSliceContracts(routeIds = []) {
  const expectedRoutes = new Set(routeIds.map((route) => String(route).replace(/^page-/, '')));
  const declaredRoutes = new Set(VERTICAL_SLICE_CONTRACTS.flatMap((slice) => slice.routes));
  const missingRoutes = [...expectedRoutes].filter((route) => !declaredRoutes.has(route));
  const duplicateRoutes = [...declaredRoutes].filter((route) => VERTICAL_SLICE_CONTRACTS.filter((slice) => slice.routes.includes(route)).length > 1);
  const missingAcceptance = VERTICAL_SLICE_CONTRACTS.flatMap((slice) => ACCEPTANCE.filter((item) => !slice.acceptance.includes(item)).map((item) => `${slice.id}:${item}`));
  return Object.freeze({
    ok: missingRoutes.length === 0 && duplicateRoutes.length === 0 && missingAcceptance.length === 0,
    sliceCount: VERTICAL_SLICE_CONTRACTS.length,
    coveredRoutes: [...declaredRoutes],
    missingRoutes,
    duplicateRoutes,
    missingAcceptance
  });
}
