// Read-only review counterexamples. No producers, app state, or secrets.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { stripUnverifiedCurrentNumericSentences } from '../../src/ai/response/publication.js';
import { buildAttribution } from '../../src/domain/portfolio/attribution.js';
import { buildGroupStrength } from '../../src/domain/themes/group-strength.js';

const input = 'VIX 14.84, 미 10년물 5.24%입니다. 시장 폭 50.7%입니다. 출처 https://apnews.com/article/example?utm_source=openai 입니다.';
const source = fs.readFileSync('src/ui/components/portfolio-read.js', 'utf8');
const chatSource = fs.readFileSync('js/aio-chat.js', 'utf8');
const tickerExtractor = chatSource.match(/function _extractTickers\(text\) \{[\s\S]*?\n\}/)?.[0];
if (!tickerExtractor) throw new Error('Current ticker extractor changed; inspect again');
const extractTickers = new Function(`${tickerExtractor}; return _extractTickers;`)();
const closure = source.match(/const marketReturnFor = \(symbol\) => \{[\s\S]*?\n  \};/)?.[0];
if (!closure) throw new Error('Current closure changed; review extraction again');
const factory = new Function('spy', 'benchmarkRowFor', 'history', `${closure}; return marketReturnFor;`);
const benchmarkRowFor = symbol => ({ market: /\.(KS|KQ)$/.test(symbol) ? 'KR' : 'US', ret3m: 10, label: 'price-index' });
const validSpy = factory({ ret3m: 11 }, benchmarkRowFor, []);
const missingSpy = factory(null, benchmarkRowFor, []);
const attribution = buildAttribution({
  holdings: [{symbol:'AAA', value:100}],
  rowFor: () => ({ret3m:20, asOf:'2025-01-01'}),
  marketReturnFor: () => ({ret3m:11, asOf:'2026-10-12', label:'SPY'})
});
const rows = ['AAA','BBB','CCC','DDD'].map((sym, i) => ({sym, ret1m:i===3?100:10, ret3m:i===3?100:10, ret6m:i===3?100:10, pctSma50:1, factorSessionDate:i===3?'2026-10-01':'2026-10-09', factorQuality:{status:i===3?'STALE':'CURRENT'}}));
const group = buildGroupStrength({ themes:[{id:'t',nameKr:'가상',subThemes:[{name:'가상',tickers:rows.map(r=>r.sym)}]}], rows, benchmark:{asOf:'2026-10-09', ret3m:2} }).groups[0];
const baseline = JSON.parse(fs.readFileSync('.cache/aio-qa/sessions/expert-live-review-20261013.json','utf8'));
const drift = Object.entries(baseline.files).filter(([p,h]) => !fs.existsSync(p) || crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==h).map(([p])=>p);
const result = {
  capturedAt:new Date().toISOString(),
  evidenceLevel:'offline current-source counterexample; not actual holdings or live generation',
  aiSentenceFilter:{input, output:stripUnverifiedCurrentNumericSentences(input)},
  aiEntityExtraction:{roleQuery:extractTickers('기관 멀티에셋 PM 관점에서 시장 상태를 검토하세요'),industryQuery:extractTickers('서버/HW·정유·사이버보안 테마를 비교하세요'),explicitTicker:extractTickers('$PM 기업을 분석하세요')},
  portfolioBenchmark:{validSpyUS:validSpy('AAA'), validSpyKR:validSpy('005930.KS')??null, missingSpyUS:missingSpy('AAA')??null},
  mismatchedReturnDates:{available:attribution.available, window:attribution.window, excessPct:attribution.excessPct},
  themeExcludedMember:{median:group.ret3m, leader:group.leader, current:group.current, basis:group.basis, rankedMembers:group.rankedMembers.map(r=>({sym:r.sym,rank:r.rank,basis:r.basis}))},
  baselineDrift:{baselineFiles:Object.keys(baseline.files).length, paths:drift}
};
fs.writeFileSync('_artifacts/expert-live-review-20261013/counterexamples.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
