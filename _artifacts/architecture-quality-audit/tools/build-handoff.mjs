import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = fs.realpathSync(process.cwd());
const dir = path.resolve(root, '_artifacts/architecture-quality-audit');
if (fs.existsSync(path.join(dir, 'reviews/remaining-20261022/continuation.json'))) throw new Error('Historical consolidation generator: continuation exists; refuse to overwrite the current handoff. Use tools/continue-review.mjs for the current ledger.');
const latest = path.join(dir, 'evidence/20261021-v5859');
const migration = JSON.parse(fs.readFileSync(path.join(dir, 'migration.json'), 'utf8'));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const toolingPath = path.join(dir, 'evidence/20261018/TOOLING.md');
let tooling = fs.readFileSync(toolingPath, 'utf8');
tooling = tooling.replace('ci 게이트 추가60개 전문 검토는', 'ci 게이트 추가60개 대상 중25개 전문 검토·35개 미독 상태는');
fs.writeFileSync(toolingPath, tooling);
const corrected = migration.entries.find(r => r.relocatedPath.endsWith('/20261018/TOOLING.md'));
if (!corrected.transformation.includes('REVIEW_CORRECTION')) corrected.transformation += '; REVIEW_CORRECTION: 60 TARGETS / 25 FULL / 35 UNREAD';
corrected.relocatedSha256 = digest(fs.readFileSync(toolingPath));
corrected.bytesAfter = fs.statSync(toolingPath).size;
fs.writeFileSync(path.join(dir, 'migration.json'), JSON.stringify(migration, null, 2) + '\n');
const read = name => fs.readFileSync(path.join(latest, name), 'utf8');
const handoff = read('HANDOFF.md');
const table = handoff.match(/\| 묶음 \|[\s\S]*?(?=\n\n)/)?.[0];
if (!table || (table.match(/\| A\d\d /g) || []).length !== 27) throw new Error('Latest handoff must contain the expected 27 identified groups');
const latestTable = table.replace(/\]\(\.\/([^)]*)\)/g, ']\(./evidence/20261021-v5859/$1)');
const historyRows = [
  {"id":"C01 / F01","source":"evidence/20261018/REPRODUCED.md","title":"검색 clear 후 지연 응답","status":"PAST_REPRO_RECHECK_NEEDED","note":"검색 clear race와 관심목록 저장 대상 race는 별개"},
  {"id":"C02","source":"evidence/20261018/REPRODUCED.md","title":"QA 의존 입력","status":"COVERED_BY_A06","note":"현행 gate로 옮겨 재현"},
  {"id":"C03","source":"evidence/20261018/REPRODUCED.md","title":"NOT 입력 identity","status":"PAST_REPRO_RECHECK_NEEDED","note":"결과와 입력 식별자 불일치"},
  {"id":"C04","source":"evidence/20261018/REPRODUCED.md","title":"상수 팩터 독립성","status":"PAST_REPRO_RECHECK_NEEDED","note":"분산0과 무상관 구별"},
  {"id":"C05","source":"evidence/20261018/REPRODUCED.md","title":"미연결 regime hold 시계","status":"RETIRED_CODE","note":"후속에서 코드 삭제 확인"},
  {"id":"C06 / D1 / F-FIN-01","source":"evidence/20261019/FINANCIAL.md","title":"가격 필드 정규화 누락","status":"PAST_REPRO_RECHECK_NEEDED","note":"PER·보유 평가의 같은 클래스"},
  {"id":"C07","source":"evidence/20261018/REPRODUCED.md","title":"빈 이익의0% 표시","status":"PAST_REPRO_RECHECK_NEEDED","note":"결측과 실제0 구별"},
  {"id":"C08","source":"evidence/20261018/REPRODUCED.md","title":"상대 차트 날짜 결합","status":"PAST_REPRO_RECHECK_NEEDED","note":"원가손익 기간 창작과 별개"},
  {"id":"C09","source":"evidence/20261018/REPRODUCED.md","title":"SW 타 앱 캐시 삭제","status":"PAST_REPRO_RECHECK_NEEDED","note":"실제 피해는 미측정"},
  {"id":"C10","source":"evidence/20261018/REPRODUCED.md","title":"숨김 텍스트 성공 판정","status":"PAST_REPRO_RECHECK_NEEDED","note":"가시성 oracle"},
  {"id":"C11","source":"evidence/20261018/REPRODUCED.md","title":"실질금리 설명 부호","status":"COVERED_BY_A03","note":"A03로 포함"},
  {"id":"C12","source":"evidence/20261018/REPRODUCED.md","title":"금리 결측 예외","status":"COVERED_BY_A02","note":"A02로 포함"},
  {"id":"C13","source":"evidence/20261018/REPRODUCED.md","title":"차트 fallback null→0","status":"PAST_REPRO_RECHECK_NEEDED","note":"CDN 실패 격리 반례"},
  {"id":"C14 / CI-C8","source":"evidence/20261018/REPRODUCED.md","title":"CSP 수집 경로","status":"PAST_REPRO_RECHECK_NEEDED","note":"sink 수를 취약점 수로 확대 금지"},
  {"id":"D2","source":"evidence/20261018/DATA-AI.md","title":"테마 종가/live 혼합","status":"PAST_STATIC_RECHECK_NEEDED","note":"당시 정적 caller 확인"},
  {"id":"D3","source":"evidence/20261018/DATA-AI.md","title":"유니버스 밖 종목의 세션 캐시","status":"PAST_STATIC_RECHECK_NEEDED","note":"주기·revision 실효 경계"},
  {"id":"D4","source":"evidence/20261018/DATA-AI.md","title":"relay 불확실 실패의 예약 해제","status":"PAST_STATIC_RECHECK_NEEDED","note":"OpenAI 월 예산과 별개"},
  {"id":"D5 / D6","source":"evidence/20261018/DATA-AI.md","title":"권리·허용 용도 전달","status":"POTENTIAL_REACHABILITY_OPEN","note":"당시T3 차단·도달성 미확정"},
  {"id":"M1 / M2","source":"evidence/20261018/DATA-AI.md","title":"캐시 소유권·AI/UI 의존","status":"CONSIDER","note":"유지보수 의견"},
  {"id":"CI-C1..C7","source":"evidence/20261018/TOOLING-CI-1.md","title":"CI별 oracle·쓰기 부작용","status":"PAST_FINDINGS_RECHECK_NEEDED","note":"60대상 중25 FULL로 정정"},
  {"id":"UI-01","source":"evidence/20261019/UI-PAGES.md","title":"선수 레슨 소실","status":"PAST_REPRO_RECHECK_NEEDED","note":"D6의 D2/D3 연결"},
  {"id":"UI-02","source":"evidence/20261019/UI-PAGES.md","title":"종목 손익의 통화 불일치","status":"PAST_REPRO_RECHECK_NEEDED","note":"domain E01 해소와 별개 UI"},
  {"id":"UI-03","source":"evidence/20261019/UI-PAGES.md","title":"스크리너 설명 signature","status":"PAST_REPRO_RECHECK_NEEDED","note":"A12 inspector와 별개"},
  {"id":"UI-04","source":"evidence/20261019/UI-PAGES.md","title":"산업 지도 선택 소실","status":"PAST_BROWSER_RECHECK_NEEDED","note":"과거 브라우저와 최신 증거 구별"},
  {"id":"UI-05","source":"evidence/20261019/UI-PAGES.md","title":"13F 혼합 분기 비교","status":"PAST_REPRO_RECHECK_NEEDED","note":"같은 reportPeriod 비교 필요"},
  {"id":"BND-01","source":"evidence/20261019/BOUNDARIES.md","title":"비동기 관심목록 저장 대상","status":"PAST_REPRO_RECHECK_NEEDED","note":"검색 후보 표시 race와 별개"},
  {"id":"LD-01 / LD-02","source":"evidence/20261019/LEGACY-DATA.md","title":"한국 결측·KST 실적 날짜","status":"COVERED_BY_A05_A04","note":"A05/A04로 포함"},
  {"id":"M01 / M02 / M03","source":"evidence/20261019/MACRO-MARKET.md","title":"거시3건","status":"LAST_REPRO_V5852_RECHECK_NEEDED","note":"최종 재현v58.52, 최신 지속 재검증"},
  {"id":"F-DELTA-01","source":"evidence/20261021/FINANCIAL-DELTA.md","title":"지수 이익의 만료 계약","status":"PAST_REPRO_RECHECK_NEEDED","note":"현재 실제 stale 발생 미확인"},
  {"id":"I01","source":"evidence/20261021/INTERPRETATION.md","title":"과거 표본 충돌 유실","status":"PAST_REPRO_RECHECK_NEEDED","note":"요약·AI 경계"},
  {"id":"I02","source":"evidence/20261021/INTERPRETATION.md","title":"분기 개수의 비용 최적성 표현","status":"CONSIDER","note":"의견/외부 실증 미검증"},
  {"id":"trade-journal follow-up","source":"evidence/20261021/UI-DELTA.md","title":"매매일지 손익·현금 설명","status":"PAST_REPRO_RECHECK_NEEDED","note":"A09/A10과 다른 consumer"}
];
const headingIndex = [];
for (const item of migration.entries.filter(r => r.relocatedPath.endsWith('.md'))) {
  const relative = path.relative(dir, path.resolve(root, item.relocatedPath)).replaceAll('\\', '/');
  fs.readFileSync(path.resolve(root, item.relocatedPath), 'utf8').split('\n').forEach((line, i) => {
    if (/^#{2,4}\s+(?:.*?\b)?(?:C\d+|D\d+|F\d+|UI-\d+|LD-\d+|M\d+|I\d+|BND-\d+|F-DELTA-\d+)/.test(line)) headingIndex.push({ source: relative, line: i + 1, heading: line.replace(/^#+\s*/, ''), boundary: 'Section locator only; not a unique current defect count or an ACT ON classification.' });
  });
}
fs.writeFileSync(path.join(dir, 'historical-findings.json'), JSON.stringify({ boundary: 'Past findings and tradeoffs retain their own source/ref. No automatic closure or sum with A01–A27.', rows: historyRows, sectionIndex: headingIndex }, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'FINDINGS-HISTORY.md'), `# 과거 발견의 상태 연결\n\nA01–A27은 누적 발견 전량이 아니다. 아래 항목은 과거 입증·정적 후보·의견을 보존하는 연결표이며 합산 결함 수로 쓰지 않는다. 최신 지속 여부를 확인하지 않은 항목은 해결로 간주하지 않는다. 문서 안의 세부 기각·미확정 후보는 원문의 판정을 따른다.\n\n| 과거 ID | 내용 | 통합 상태 | 근거·경계 |\n|---|---|---|---|\n` + historyRows.map(r => `| ${r.id} | ${r.title} | ${r.status} | [원문](./${r.source}) — ${r.note} |`).join('\n') + '\n\n이름이 비슷해도 서로 다른 producer/consumer의 오류는 합치지 않는다. 원장 오인증7행은 후속 정정 완료이며 R719 삭제 미검출 gate 결함은 별도 미해결이다. 관련 선행 자료 E01–E08은v57.98에서 해당 반례가 해소됐고, 실제 DOM/공급자/투자 정확도 인증은 아니다.\n');
const snapshotRows = migration.entries.reduce((map, r) => { const id = r.relocatedPath.split('/')[3]; map.set(id, (map.get(id) || 0) + 1); return map; }, new Map());
const main = `# Architecture 품질 감사 — 통합 핸드오프\n\n통합·재검토: **2026-10-22 KST**. 이 파일이 단일 최신 진입점이다. 날짜별5개 폴더의 원본482파일을 이 폴더 안으로 모았다. **자료 통합은 완료하되 전체 코드·콘텐츠 감사는 IN_PROGRESS**다. 제품 결함을 수정하거나 프로젝트 commit/push/deploy하지 않았다.\n\n## 먼저 읽을 판단\n\n전면 재작성보다 법인 일치, 결측·날짜·통화·기간 보존, 응답 지시 경계, 실제 실패를 잡는 QA가 우선이다. 우선 보완 후보는 HWM 공시 오연결(A01), 원가손익을 가짜30일 추이로 표시(A20), 매매 지시 필터 누락(A15), 과거 성공 cache로 실패 retry 해소(A25)다. [정책·구조 판단](./evidence/20261021-v5859/DECISION-QUALITY.md)에 유지할 설계와 작은 대안을 함께 적었다. 기능 폐지나 대규모 개편을 시행한 것은 아니다.\n\n## 범위와 상태\n\n주 원장은v58.59 \`7e2411432f6ca0e5f02528b209b013bf5f7ff2dc\`의 실행·설정 소스850개다. 전문 근거405개는 직접71 / 기준전문+전체diff22 / 동일SHA 계승312로 나뉜다. 동일 생성 mirror13개, 부분·변경분·미검토432개가 남아 있다. 지식 본문·데이터셋의 전수 의미 검토는 별도 범위다. [coverage](./coverage.json), [파일별 원장](./reading-ledger.tsv)을 따른다. 이 통합으로 전문 수를 늘리지 않았다.\n\n보완 기록은v58.60 \`659ffbad252f9eeacfa49a6ad1b895df87f66597\`의 제한된 delta와 당시 미커밋v58.62 선택4파일뿐이다. 현재 작업 트리 전체나 배포 SHA를 인증하지 않는다. A01–A27은 주 기준에서 추적하는27묶음이며 이전 발견 전체가 아니다. [과거 발견 연결표](./FINDINGS-HISTORY.md)의 별도 잔여를 삭제·해결로 간주하지 않는다.\n\n## 주 기준의 발견27묶음\n\n${latestTable}\n\nA01의 CIK 정본 불일치는11개지만 다른 법인으로 공식 확인한 것은HWM/AAOI/AFRM3개, 실제 consumer 격리 재현은HWM1개다. 나머지8개를 확정 오연결로 세지 않는다. A08의 FY domain/UI/browser 증거, A10의 현금·FX 반례는 각 하나의 원인 묶음이다. A06(의존 입력 누락)과 A25(실패 뒤 과거 성공 재사용)는 다른 결함이다.\n\n## 검증 결과를 읽는 법\n\n실브라우저는 과거v58.50/52와 실제Pages v58.59의 기록이다. v58.59 주 메뉴8개, LDOS DCF, inspector, 키보드 검색, 휴대폰/태블릿 일부 증거는 [BROWSER](./evidence/20261021-v5859/BROWSER.md)에 있다. footer 버전 관측을 배포 전체 bytes 일치로 올리지 않는다. 이번 통합에서 새 live/browser·유료AI·producer는 실행하지 않는다.\n\n이전14개 preflight 통과, helper41개 구문 검사, boot raw1,496,044/gzip544,662 bytes는 각각 당시 범위의 증거다. helper41개가 모두 실행된 것은 아니며 반례 probe 종료0은 제품 정상 PASS가 아니다. v58.60 marketAnalysis는verified여서 과거blocked를 현재 요약으로 쓰지 않는다. verified도 경제적 인과·투자 우위의 인증은 아니다. [과거 검증 기록](./evidence/20261021-v5859/VALIDATION.md), [이번 통합 검증](./VALIDATION.md)을 구별한다.\n\n## 재검토하며 바로잡은 내용\n\n- 20261018 TOOLING의 ‘CI60개 전문’ 문구는 원래 TSV/독립 보고에 맞춰 **60대상 중25전문·35미독**으로 정정했다. 원본은archive에 보존했다.\n- 이전 감사 원장의 잘못된FULL 승격7행은 이미 후속에서 정정됐다. 이를 현재 미해결로 재등록하지 않고 현행405/13/432를 유지한다.\n- 과거 C/D/UI/M/LD/I 계열의 별도 잔여를 [연결표](./FINDINGS-HISTORY.md)에 남겼다. domain E01의 통화손익 보류 개선이 다른 UI consumer의 통화 오류 해소를 뜻하지 않는다.\n- v57.98 E01–E08 반례 해소, 당시full/external PASS/FAIL, 뒤 버전의 browser/VM 결과는 날짜·SHA·증거 단계별로 보존한다. 합산해 전체PASS를 만들지 않는다.\n\n## 연관된 선행 핸드오프\n\nArchitecture 폴더 밖의 관련 자료도 다시 검토했다. [10/15 개편 감사](../codex-reform-audit-20261015/HANDOFF.md), [내부 정책·논리](../internal-quality-review-20261016/HANDOFF.md), [기준·규칙 평가](../policy-criteria-review-20261016/HANDOFF.md), [10/16 전수 감사](../exhaustive-quality-audit-20261016/HANDOFF.md)와 [v57.98 재대조](../exhaustive-quality-audit-20261016/LATEST-STATUS-v57.98.md)를 연결한다. 이 폴더 밖의 다른 프로젝트/과거 모든 핸드오프를 이동하거나 새로 인증한 것은 아니다. 전문 읽기와 재검토 범위는 [재검토 기록](./REVIEW-CORRECTIONS.md)에 있다.\n\n## 보존 위치\n\n| snapshot | 파일 수 | 역할 |\n|---|---:|---|\n${[...snapshotRows].map(([id, count]) => `| [${id}](./evidence/${id}/) | ${count} | 당시 고정REF의 보고·원시 증거·helper |`).join('\n')}\n\n[원본archive](./originals.zip)는482개 파일의 통합 전 바이트를 보존한다. [original-files.json](./original-files.json)은 각 원본 SHA/새 경로/archive entry, [migration.json](./migration.json)은 문서 링크·helper 경로 변경의 예외를 기록한다. raw JSON/로그/TSV는 당시 경로 문자열까지 그대로 둔다. 루트 reading-ledger는 그 원장의 evidence 경로만 옮긴 파생 view다. 원문 재현 스크립트는 현재 입력/producer를 사용할 수 있으므로 경로 정리만으로 전부 재실행·안전 인증하지 않는다.\n\n남은 제품 감사432개와 과거 발견의 최신 지속 여부는 다음 감사 범위다. 이 요청에서는 자료 통합·재검토·정합성 확인을 마감하며 제품 수정은 하지 않는다.\n`;
fs.writeFileSync(path.join(dir, 'HANDOFF.md'), main);
console.log(JSON.stringify({ master: path.relative(root, path.join(dir, 'HANDOFF.md')), primaryGroups: 27, historicalRows: historyRows.length, historicalSectionLocators: headingIndex.length, correction: 'CI 60 targets / 25 FULL / 35 unread' }));
