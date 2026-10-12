// Documentation inventory, not a data producer. Extract only the relevant dated ledger range.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../..');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024}).trim();
const commitRows=git('log','--since=2026-10-01','--no-merges','--format=%H%x09%aI%x09%an%x09%s').split('\n').filter(Boolean).map(line=>{const[sha,date,author,...subject]=line.split('\t');return{sha,date,author,subject:subject.join('\t')};}).filter(c=>!/^data: refresh/.test(c.subject));
const topicOf=files=>{
 const topics=[];
 if(files.some(p=>/market-read|market-regime|regime-|daily-|sentiment|macro-|breadth|briefing|sector-moves|rates-fx|\/news\.js|fetch-data/.test(p)))topics.push('MARKET-FINDINGS.md');
 if(files.some(p=>/entity|technical|stock-|fiscal|fundamental|screener|theme|portfolio|knowledge|principles|atlas|masters|research/.test(p)))topics.push('ENTITY-FINDINGS.md');
 if(files.some(p=>/architecture|bootstrap|route|worker|workflow|skill|agent|governance|cache|contract|deploy|budget|13f|13d/.test(p)))topics.push('ARCHITECTURE-FINDINGS.md');
 if(files.some(p=>/responsive|value-basis|styles|tooltip|chart|ui\//.test(p)))topics.push('UI-AND-AI-CHECKS.md');
 return [...new Set(topics)];
};
for(const c of commitRows){c.files=git('show','--format=','--name-only',c.sha).split('\n').filter(Boolean);c.reviewDocuments=topicOf(c.files);c.coverage='Related surfaces reviewed; per-commit deployed replay and every historical gate not certified';}
const ledger=readFileSync(resolve(root,'_context/BUG-POSTMORTEM.md'),'utf8');
const entries=[...ledger.matchAll(/^## (P(\d+))\s*[-—]\s*([^\n]+)([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].filter(m=>Number(m[2])>=1363&&Number(m[2])<=1643).map(m=>({id:m[1],title:m[3].trim(),record:m[4].trim(),coverage:'Inventory of intent/record; see area review, not an individual semantic PASS'}));
writeFileSync(resolve(out,'change-inventory.json'),JSON.stringify({head:git('rev-parse','HEAD'),range:'2026-10-01 through 2026-10-12',attribution:'Integrated history includes Claude, Codex and Command Code; git author alone does not identify the coding agent',commitCount:commitRows.length,ledgerEntryCount:entries.length,commits:commitRows,ledgerEntries:entries},null,2)+'\n');
const md=['# 10월 구조 개선 변경 인벤토리','', '이 목록은 누락 방지와 의도·근거 탐색용이다. 각 행을 독립적인 의미 검수 PASS로 보지 않는다. 현재 코드 경로의 심층 리뷰는 연결된 영역 문서에 있으며, 과거 배포 SHA 재현·394편 콘텐츠 전편·운영 AI 답변은 별도 미검증이다.', '',`확인한 non-data/non-merge commits: ${commitRows.length}. 관련 ledger P1363~P1643: ${entries.length}개. 기록상 Codex·Claude·Command Code 작업이 통합되어 있으므로 모든 변경을 Claude 단독 저작으로 단정하지 않는다.`, '', '## 커밋별 작업 의도와 소스 경계','', '| 날짜·SHA | 작업 의도(실제 subject) | 변경 파일 수 | 연결된 검토 |','|---|---|---:|---|',...commitRows.map(c=>`|${c.date.slice(0,10)} ${c.sha.slice(0,8)}|${c.subject.replaceAll('|','/')}|${c.files.length}|${c.reviewDocuments.map(p=>`[${p.replace('-FINDINGS.md','').replace('-CHECKS.md','')}](./${p})`).join(', ')||'문서·기록 전용/관련 계약 검사'}|`),'','## 개별 작업 기록(P entry)','','제목은 현재 ledger에서 추출했다. 원문 원인·수정·검증은 change-inventory.json에 해당 범위만 보존했다. 제목만 나열하고 구현을 자동 통과시키지 않는다.','', '| ID | 의도·문제 기록 제목 | 증거 경계 |','|---|---|---|',...entries.sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1))).map(e=>`|${e.id}|${e.title.replaceAll('|','/')}|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|`),''];
writeFileSync(resolve(out,'CHANGE-INVENTORY.md'),md.join('\n'));
console.log(JSON.stringify({commits:commitRows.length,entries:entries.length,output:'change-inventory.json / CHANGE-INVENTORY.md'}));
const baseline=JSON.parse(readFileSync(resolve(root,'.cache/aio-qa/sessions/codex-claude-structure-review-20261012.json'),'utf8'));
const altered=[];
for(const [file,hash] of Object.entries(baseline.files)){
 let current=null;try{current=createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex');}catch{}
 if(current!==hash)altered.push({file,before:hash,after:current});
}
writeFileSync(resolve(out,'preservation.json'),JSON.stringify({baselineCreatedAt:baseline.createdAt,baselineFileCount:Object.keys(baseline.files).length,headBefore:baseline.gitHead,headAfter:git('rev-parse','HEAD'),alteredPreExistingFiles:altered,onlyNewReviewArtifacts:altered.length===0},null,2)+'\n');
console.log(JSON.stringify({preExistingAltered:altered.length}));
