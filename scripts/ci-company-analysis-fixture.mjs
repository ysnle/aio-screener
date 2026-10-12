// P1624: examples are regression cases; the analysis contract is identical for every issuer.
import assert from 'node:assert/strict';
import { buildCompanyAnalysis, companyAnalysisContext } from '../src/domain/entity/company-analysis.js';
const nowMs=Date.parse('2026-10-11T18:00:00Z');
const row={sym:'XYZ',name:'Example Company',market:'US',currency:'USD',factorSessionDate:'2026-10-09',ret3m:10,pctSma50:4,pctSma200:8,assetType:'stock'};
const model=buildCompanyAnalysis({symbol:'XYZ',row,rows:[row],nowMs});
assert.equal(model.business.description,null,'P1624 any issuer without sourced business text stays unavailable');
assert.equal(model.marketEvidence.relative.rank,1,'P1624 common rank compares the exact market/session');
const foreign=buildCompanyAnalysis({symbol:'OTHER',row,summary:{symbol:'XYZ',quote:{price:4,observedAt:'2026-10-09'}},fundamentals:{symbol:'XYZ',periodType:'FY',revenue:100},nowMs});
assert.equal(foreign.price.value,null,'P1624 another issuer cannot inherit the quote');
assert.equal(foreign.financial.fiscal.available,false,'P1624 another issuer cannot inherit the fiscal receipt');
const etf=buildCompanyAnalysis({symbol:'XYZ',row:{...row,instrumentRef:{assetType:'ETF'}},nowMs});
assert.equal(etf.financial.status,'not-applicable','P1624 ETF is not interpreted as a business company');
const kr=buildCompanyAnalysis({symbol:'005930.KS',row:{...row,sym:'005930.KS',market:'KR',currency:'KRW',factorSessionDate:'2026-10-08'},nowMs});
assert.equal(kr.identity.market,'KR','P1624 Korean issuer has its own market');
assert.equal(kr.financial.status,'kr-disclosure-required','P1624 US SEC data does not fill missing Korean filings');
assert.match(companyAnalysisContext(model),/내부 사업 설명 미수집.*웹검색/,'P1624 missing business evidence is explicitly passed to qualitative AI retrieval');
console.log('PASS P1624 company analysis: universal issuer contract, same-market facts, ETF/KR/missing/foreign-receipt boundaries.');
