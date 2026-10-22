import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const ref='7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const rows=[
 ['js/aio-data.js','FULL_DIFF_REVIEW','이전 d36bb256 전문 원장+현재 전체1줄 변경(home 표시 이름) 검토; 기준 SHA 일치; 이번 전문 재독 아님'],
 ['js/aio-chat.js','DIFF_ONLY','d36bb256→고정 REF 전체1줄 변경(home 화면명)만 검토; 기준 전문 없음'],
 ['js/aio-pages.js','DIFF_ONLY','d36bb256→고정 REF 전체7줄 변경(상세 listener mount 전 theme id 보존) 검토; 기준 전문 없음'],
 ['js/aio-workspace.js','DIFF_ONLY','d36bb256→고정 REF 전체6줄 변경(표 열수/일일열 및 stress input publish) 검토; 기준 전문 없음'],
 ['src/ui/components/stock-read.js','FULL','root 전문 1–405행 연속 읽기; FY helper·on-demand·rank/benchmark·async symbol guard·분석 signature와 caller 경계; ROOT-FOLLOWUP.md'],
 ['src/ui/components/daily-loop.js','FULL','root 전문 1–470행 연속 읽기(1–155,156–315,316–470); 현재/종가·한국 기준·내 종목/일정/뉴스·거리 renderer·접힘 상태 의미 검토; ROOT-FOLLOWUP.md'],
 ['src/ui/knowledge/research-shell.js','PARTIAL','검색 blur/results 관련 구간 및 실제 browser Tab 타이머 이후 관측; 전문 재독 아님'],
].map(([path,status,reason])=>{const blob=execFileSync('git',['show',`${ref}:${path}`],{maxBuffer:16*1024*1024});const base=/DIFF/.test(status)?createHash('sha256').update(execFileSync('git',['show',`d36bb256ddf60468d6c7a134628053c5796be6be:${path}`],{maxBuffer:16*1024*1024})).digest('hex'):'';return{path,status,baseSha256:base,sha256:createHash('sha256').update(blob).digest('hex'),reason};});
writeFileSync(new URL('./root-reading.tsv',import.meta.url),'path\tstatus\tbaseSha256\tsha256\treason\n'+rows.map(r=>[r.path,r.status,r.baseSha256,r.sha256,r.reason].join('\t')).join('\n')+'\n');
console.log(JSON.stringify(rows,null,2));
