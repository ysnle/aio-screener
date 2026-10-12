import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const file = 'js/aio-pages.js';
let source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const mapStart = source.indexOf('var THEME_MAP = [');
const mapEnd = source.indexOf('\n];', mapStart) + 3;
const themes = runInNewContext(source.slice(mapStart + 'var THEME_MAP = '.length, mapEnd - 1));
for (const theme of themes) {
  const union = [...new Set(theme.subThemes.flatMap(sub => sub.tickers))];
  const before = 'leaders:[' + theme.leaders.map(symbol => `'${symbol}'`).join(',') + ']';
  const leaders = [...theme.leaders.filter(symbol => union.includes(symbol)), ...union.filter(symbol => !theme.leaders.includes(symbol))];
  source = source.replace(before, 'leaders:[' + leaders.map(symbol => `'${symbol}'`).join(',') + ']');
}
const quote = value => "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const literal = value => typeof value === 'string' ? quote(value) : Array.isArray(value) ? '[' + value.map(literal).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.entries(value).map(([key, val]) => key + ':' + literal(val)).join(',') + '}' : String(value);
const edits = {
  photonics: sub => { if (!sub.tickers.includes('FN')) sub.tickers.push('FN'); delete sub.weights; },
  cybersec: sub => { sub.tickers = sub.tickers.filter(symbol => symbol !== 'CYBR'); if (!sub.tickers.includes('RBRK')) sub.tickers.push('RBRK'); delete sub.weights; },
  ai_chip: sub => { sub.tickers = sub.tickers.filter(symbol => symbol !== 'SMCI'); delete sub.weights; },
  dc_infra: sub => { if (!sub.tickers.includes('SMCI')) sub.tickers.push('SMCI'); delete sub.weights; },
  oil_major: sub => { if (!sub.tickers.includes('SHEL')) sub.tickers.push('SHEL'); delete sub.weights; },
  btc_etf: sub => { sub.name = 'BTC 현물·선물 ETF'; sub.desc = '비트코인 ETF: IBIT·FBTC·ARKB·BITB·HODL은 현물, BITO는 선물·스왑 노출이며 비트코인을 직접 보유하지 않습니다.'; },
  mlp_pipe: sub => { if (!sub.tickers.includes('ENB')) sub.tickers.push('ENB'); delete sub.weights; sub.name = '미드스트림/파이프라인'; sub.desc = '에너지 운송·미드스트림 사업. 법적 MLP와 일반 법인이 함께 있으며 배당·과세 구조는 종목별로 다릅니다.'; }
};
source = source.split('\n').map(line => {
  const id = line.match(/^  \{id:'([^']+)'/);
  if (!id || !edits[id[1]]) return line;
  const sub = runInNewContext('(' + line.trim().replace(/,$/, '') + ')');
  edits[id[1]](sub);
  return '  ' + literal(sub) + ',';
}).join('\n');
source = source.replace('하위 테마당 3종목 이상', '분류는 실제 사업 역할을 따르고 수익률 순위만 3개 이상 표본에서 계산');
source = source.replace('leaders = 전체 구성 종목의 시가총액 순(2026-10-09 스냅샷)', 'leaders = 전체 구성 종목(목록 순서는 시가총액 순위가 아님)');
source = source.replaceAll("'ETF가중('", "'설정가중(참고 '");
writeFileSync(file, source);
console.log('Updated evidence-backed memberships; changed custom composites use equal weights.');
