import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { selectNewsBundle } from '../../scripts/lib/news-selection.mjs';
const rows = ['Company reports quarterly revenue rose 50%', 'Correction: Company reports quarterly revenue fell 50%'].map((title,i)=>({title,link:`https://example.test/${i}`,source:'Reuters',tier:1,score:100-i,ts:1793316600000+i*1000,pubDate:'2026-10-29T23:30:00Z',topic:'equity',...(i?{correctionOf:'original'}:{})}));
const {out}=selectNewsBundle(rows,[]);
assert.equal(out.length,1);
assert.match(out[0].title,/rose/);
writeFileSync(new URL('./pass20-dedup.json',import.meta.url),JSON.stringify({input:rows,output:out},null,2)+'\n');
console.log('PASS20: server semantic dedup drops opposite-direction correction');
