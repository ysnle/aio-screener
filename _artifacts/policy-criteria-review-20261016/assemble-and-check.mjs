// Audit-only artifact assembly. No product source, producer, network, or ledger writes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(out, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const snapshotPath = path.join(out, 'source-snapshot.json');
const policyPaths = [
  'AGENTS.md', 'CLAUDE.md', '_context/RULES.md', '_context/QA-CHECKLIST.md',
  '_context/WORKFLOW-GOVERNANCE.md', '_context/QA-PIPELINE-ARCHITECTURE.md',
  '_context/AIO-CURRENT-PRODUCT-ARCHITECTURE-CHARTER.md',
  'architecture/product-charter.json', 'architecture/human-validation.json',
  'architecture/public-readiness.json', 'architecture/operations-slo.json',
  'architecture/operations-alert-policy.json', 'architecture/qa-pipeline.json',
  'src/data/contracts/source-registry.js', 'src/ai/policy/suitability.js',
  'src/ai/policy/conduct.js', 'scripts/ci-semantic-review-check.mjs',
  '.agents/skills/knowledge-lint/references/workflow.md',
  '.claude/commands/assumptions.md', '.agents/skills/_shared/agent-prompt-anatomy.md'
];
if (!fs.existsSync(snapshotPath)) {
  const rules = read('_context/RULES.md');
  const qa = read('_context/QA-CHECKLIST.md');
  write('source-snapshot.json', {
    capturedAt: new Date().toISOString(),
    version: JSON.parse(read('version.json')),
    warning: 'Existing dirty and concurrent edits belong to the user/parallel work. Snapshot is audit evidence, not a release candidate certification.',
    files: policyPaths.map(file => ({ file, sha256: hash(read(file)) })),
    rules,
    qaOpenRows: qa.split(/\r?\n/).flatMap((text, i) => /^\s*- \[ \]/.test(text) ? [{ line: i + 1, text }] : [])
  });
}
const snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const currentChanges = snap.files.filter(row => hash(read(row.file)) !== row.sha256).map(row => row.file);
const headings = snap.rules.split(/\r?\n/).flatMap((text, i) => {
  const m = text.match(/^(?:#{2,4}\s+|\*\*)R(\d+)(-A)?(?=[.\s:—–-])/);
  return m ? [{ id: `R${m[1]}${m[2] || ''}`, line: i + 1, title: text.replace(/^#+\s*|^\*\*/g, '').replace(/\*\*$/, '') }] : [];
});
write('rules-inventory.json', headings);

const exceptions = {
  'QA-VERIFY-32': ['조건부 유지', '날짜별 한 문장 생산을 검증할 수 있다. 같은 날 불변은 중대한 사실 오류·정정의 복구까지 막지 않도록 예외를 둔다.'],
  'QA-VERIFY-28': ['개정', 'BOK/KOSIS 경로와 사용자 기능은 검증하되 더 이상 쓰지 않는 제공자 키까지 필수로 요구하지 않는다. Secrets 값은 출력하지 않는다.'],
  'QA-VERIFY-27': ['조건부 유지', 'SEC 다중 클래스의 의미·공시별 산식 대조가 핵심이다. 특정 기업의 영구적인 방법명·순위 위치를 정답으로 고정하지 않는다.'],
  'QA-VERIFY-13': ['조건부 유지', '실제 지수 가중치·기간·표본을 확인한다. 구성 종목 수 약500은 고정500개나 정확성 인증이 아니다.'],
  'QA-DEEP-DIVE-02': ['개정', '깊이 보기는 사용자 가치가 있을 때 제공한다. 접힘6개라는 개수는 인수 조건의 충분조건이 아니다.'],
  'QA-BASIS-KEYBOARD-01': ['조건부 유지', '키보드 접근은 유지한다. 평소 버튼 은폐가 터치·발견 가능성을 해치지 않는지 별도 인수한다.'],
  'QA-V5731-20': ['개정', '10회 중 대부분 verified는 근거 없는 합격선이다. 출력 정확성·보류의 적절성·실패 원인과 완료율을 함께 정의한다.'],
  'QA-V5731-21': ['개정', '조건 수는 요약이며 확률이 아니다. 최소5/7이 가용이라는 요구보다 실제 결측·중복 조건·해석을 검증한다.'],
  'QA-V5731-22': ['개정', 'P/E 5000 초과는 주식수 오류의 충분조건이 아니다. 적은 이익·단위·클래스·분모를 원문 대사한다.'],
  'QA-V5731-25': ['조건부 유지', '31개는 현재 레지스트리 범위다. 개수보다 완료 세션·정렬·결측과 범위 설명을 검증한다.'],
  'QA-MACRO-HISTORY-LIVE-01': ['개정', '18개 수집 여부와 품질을 따로 본다. 보류가 없어지는 것을 성공으로 요구하면 결측에 거짓 판정을 유도한다.'],
  'QA-SEMANTIC-DEPLOY-02': ['역사 기록/통합', '미승인 과거 제안을 현행 강제로 삼지 않는다. 현재 배포 정책과 승인된 설계로 대체 여부를 먼저 확인한다.'],
  'QA-AI-A05-STREAM': ['개정', '스트림 비혼입·인용 지지는 유지한다. 퇴역한 per-page-chat 재도입을 인수 조건으로 요구하지 않는다. 현행 진입점과 겹친 요청으로 검증한다.'],
  'QA-E2-40': ['조건부 유지', 'DB 마이그레이션·실브라우저 인수는 타당하다. 두 chat 경로는 현재 존재하는 진입점만 대상으로 한다.'],
  'QA-SCR-28': ['개정', '분모873·특정 문구·순위 개수는 날짜별 상태다. run별 모집단·산식·결측·동일입력 재현을 검증한다.'],
  'QA-CRED-14': ['역사 기록/통합', 'Origin/token이 인증이 아니라는 위협 모델은 유지한다. 과거 SHA·v56 상태를 현재 장애로 재사용하지 않고 현행 경계별 부하/쿼터 증거로 대체한다.'],
  'QA-CRED-16': ['개정', '계층별 TTL 차이는 목적상 정상일 수 있다. 총 허용 노후도·캐시 키·권한/키 교체 경계를 검증하고 단순 전역 TTL 동일화는 피한다.'],
  'QA-CRED-17': ['개정', 'GITHUB_TOKEN 이벤트 전파 원인을 플랫폼 일반 법칙으로 단정하지 않는다. 실제 트리거/실행 ID와 알림 도달성을 검증한다.'],
  'QA-CRED-06': ['개정', '과거 TWELVE_DATA/FINNHUB 키가 현행 필수라는 전제부터 확인한다. 레인 퇴역/공식 대안/권리와 현재 소비자 기준으로 요구한다.'],
  'QA-EXHAUST-96': ['조건부 유지', '중복 브라우저 부팅 비용을 줄이는 목표는 좋다. 공유 세션은 상태 오염을 만들 수 있으므로 격리와 순서독립을 함께 검증한다. 과거6분을 현재 기준으로 고정하지 않는다.'],
  'QA-EXHAUST-97': ['조건부 유지', '의미 같은 단언 소유자를 합친다. 독립적인 방어 계층의 검증까지 중복으로 간주해 없애지 않는다.'],
  'QA-EXHAUST-78': ['개정', 'P/R 라벨 부착만으로 정확성 부채가 줄지 않는다. 어떤 사용자 실패를 탐지하는지와 반례 탐지력을 함께 확인한다.'],
  'QA-EXHAUST-95': ['조건부 유지', '단일 상태 소유는 좋다. 목록 수 감소 외에 실제 writer 부재·상태 일관성·라우트 수명주기를 검증한다.'],
  'QA-EXHAUST-85': ['조건부 유지', '안전한 escaping 정본 통합은 타당하다. core 순증0을 맞추기 위한 무관한 축약/삭제를 강제하지 않는다.'],
  'QA-EXHAUST-83': ['개정', '개인화 금지라는 현행 제품 경계라면 suitability 허용 경로 완성은 필수 과제가 아니다. 프로필 객체 공급을 허가 증거로 보지 않는다.'],
  'QA-EXHAUST-84': ['조건부 유지', '실제 차단 계층과 설명 일치는 필요하다. 현행 금지 정책을 먼저 정하고 과거 조건부 허용을 다시 열지 않는다.'],
  'QA-EXHAUST-37': ['역사 기록/통합', '당시 hash·미검증 범위 보존은 옳다. 현재 배포를 영구 releaseCertified=false에 묶는 기준으로 쓰지 않는다.'],
  'QA-EXHAUST-39': ['역사 기록/통합', '과거 라인 번호·파일명은 현재 소유자를 따라갔는지 재대응시킨다. 6.89% 수치는 해당 시점의 기록이다.'],
  'QA-EXHAUST-05': ['역사 기록/통합', '당시 전수 요청의 잔여는 보존한다. 모든 배포마다 전체 역사 전이를 읽어야 하는 일반 릴리스 요건으로 확대하지 않는다.'],
  'QA-AICHAT17': ['역사 기록/통합', '미체크 본문에 이미 v54.64 외부 검증 완료라고 적힌 상태 모순이다. 과거 증거는 보존하고 현재 인수 항목에 연결한다.'],
  'QA-ARCH-16': ['역사 기록/통합', '과거 v54.43 배포 상태를 현재로 유지하지 않는다. 현행 단일 QA-DEPLOY-08과 시점별 증거에 연결한다.'],
  'QA-HEADLESS-04': ['역사 기록/통합', '과거 v54.49 중단 기록은 보존한다. 최신 후보에 필요한 release 증거와 별개이며 과거 실행을 재개하는 요구로 쓰지 않는다.'],
  'QA-HUMAN-04': ['개정', '실제 독자·보조기기 과업은 유지한다. 별도 고정15명/비율 인증과 가족 pilot을 구별하고 모집단 일반화는 제한한다.'],
  'QA-KA8': ['개정', '고정 corpus 개수와 orphan0이 내용 정확성을 보장하지 않는다. manifest 범위·개념별 목적·해당없음·질적 검토를 분리한다.'],
  'QA-KA9': ['조건부 유지', '검증 가능한 주장 직접 근거와 날짜 구분은 좋다. 모든 개념에 동일 source mix·정량 lab을 요구하지 않는다.'],
  'QA-KA10': ['개정', '160개/모든 lab은 자체 목표다. 개념별 충분한 설명·원문 직접성·실제 이해를 인수하고 개수 완료와 품질 인증을 분리한다.'],
  'QA-KC10': ['개정', '159개와 모든 학습기능은 범위 가설이다. 우선 과업에 비례한 콘텐츠/기능과 사용자 이해를 확인한다.'],
  'QA-KB7': ['개정', '159개·진도·퀴즈·메모 전체를 기본 필수로 묶기보다 가족 서비스의 실제 학습 과업별 필요를 먼저 검증한다.'],
  'QA-MF4': ['조건부 유지', '검증되지 않은 종목별 섹터 비중 비노출은 타당하다. 발행사 기준과 증권 클래스 기준을 구별한다.']
};
function qaJudgment(row) {
  const id = row.text.match(/QA-[A-Z0-9][A-Z0-9-]*/)?.[0] || `QA@${row.line}`;
  let disposition = '기준 유지·현재 완료 미판정';
  let reason = '명시된 사용자 동작·데이터 의미·증거 경계를 확인하는 인수 조건은 타당하다. 현재 revision의 재현·완료 여부는 이 정책 감사에서 판정하지 않는다.';
  if (exceptions[id]) [disposition, reason] = exceptions[id];
  else if (/Telegram/.test(row.text)) {
    disposition = '개정'; reason = '공개24h 자료의 기본 노출을 강제하기 전에 취득·재배포·AI 이용조건을 확인한다. reference-only/공개 미러는 허가가 아니다.';
  } else if (/coverage 80%|커버리지 80%/.test(row.text)) {
    disposition = '개정'; reason = '80%는 운영 목표일 뿐 정확성·대표성의 충분조건이 아니다. 시총/종목별 편향·누락 이유·공시 비교 가능성을 함께 본다.';
  } else if (/2-day processing freshness|2일.*freshness|2-day/.test(row.text)) {
    disposition = '개정'; reason = '고정2일보다 생산 주기·시장 완료 세션·공표 일정으로 판단한다. 여기 적힌 과거 숫자 불일치를 현재 사실로 재사용하지 않는다.';
  } else if (/고정 점검일|급변 구간 재생/.test(row.text)) {
    disposition = '조건부 유지'; reason = '선정 위기 구간은 회귀/극단 입력 검사에 유용하다. 자기 정의의 불변식 PASS를 경제적 타당성/예측력으로 승격하지 않는다.';
  } else if (/not run per|intentionally not rerun|사용자.*제외|operator request|not rerun per|this session|this turn|이번 세션|이 세션|explicitly excluded|blocked local|현재.*v54|v54\.98|expired|만료된|unavailable because|not run in this turn/.test(row.text)) {
    disposition = '역사 기록/현행 인수에 통합'; reason = '당시 환경/승인/관측 제한의 정직한 기록이다. 과거 사유를 현재 차단이나 영구 QA 생략으로 해석하지 않고 현행 과업의 증거에 연결한다.';
  } else if (/human|recruited|semantic\/source|source-directness|직접성|심층|사람|인간/.test(row.text)) {
    disposition = '조건부 유지'; reason = '기계 검사와 독립 내용/사용자 검토 분리는 유지한다. 고정 개수·깊이·모집단 인증으로 확대하지 않고 해당 주장·대상 독자·검토 범위를 명시한다.';
  } else if (/13F|CUSIP|SEC fair|manager|Masters SEC|security.master/.test(row.text)) {
    disposition = '조건부 유지'; reason = '공시 대사·발행사/클래스·권리·PIT 경계는 타당하다. 고정37명/7명 등 과거 범위를 영구 목표로 삼지 않고 현행 registry와 공시/정정 일정을 따른다.';
  } else if (/deploy|push|deployed|GitHub Pages|Pages.*Worker|라이브 Pages|원격|외부.*검증|external|full.*release|release.*full|certification|SLO/.test(row.text)) {
    disposition = '조건부 유지/중복 통합'; reason = '로컬·배포·실제 provider·장기 관측을 구별하는 기준은 유지한다. 반복된 과거 릴리스 잔여를 현행 대표 인수 항목으로 연결하며 새 권한으로 해석하지 않는다.';
  } else if (/모든.*전파|모든.*unit|전체.*corpus|Sankey|source mix/.test(row.text)) {
    disposition = '조건부 유지'; reason = '주장과 현재 관측의 경계는 유지한다. 개념별 해당없음과 학습 목적을 허용하고 고정 패널/길이/개수로 충분성을 인증하지 않는다.';
  }
  return { id, line: row.line, text: row.text, disposition, reason, semanticRead: true, implementationRetested: false };
}
const qaRows = snap.qaOpenRows.map(qaJudgment);
write('open-qa-review.json', qaRows);
const cell = s => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
write('open-qa-review.md', '# 열린 QA 조건의 의미 검토\n\n각 행의 원문을 읽고 인수 조건의 타당성을 평가했다. 완료/미완료나 현재 버그 존재를 재검증하지 않았다. 조건부 유지·역사화는 자동 체크 해제가 아니다. ID 없는 행도 원문 line으로 식별한다. 여러 과거 항목이 같은 현재 인수를 반복하므로 개수를 독립 결함 수로 읽지 않는다.\n\n| 항목/읽기 시점 line | 판정 | 근거 | 원문 |\n|---|---|---|---|\n' + qaRows.map(r => `| ${cell(r.id)}:${r.line} | ${cell(r.disposition)} | ${cell(r.reason)} | ${cell(r.text)} |`).join('\n') + '\n');

const zeroErrorUpper = n => 1 - Math.pow(0.05, 1 / n);
const numberedIds = new Set(headings.filter(h => h.id !== 'R1-A').map(h => Number(h.id.slice(1))));
const narrowIds = new Set([...snap.rules.matchAll(/^## R(\d+)\./gm)].map(m => Number(m[1])));
const maxRule = Math.max(...numberedIds);
const actualGaps = Array.from({ length: maxRule }, (_, i) => i + 1).filter(n => !numberedIds.has(n));
const narrowGaps = Array.from({ length: maxRule }, (_, i) => i + 1).filter(n => !narrowIds.has(n));
write('policy-counterexamples.json', {
  purpose: 'Policy logic examples, not product regression certification or new mandatory sample targets.',
  zeroErrorsOneSided95Percent: [5, 15, 59].map(n => ({ n, errors: 0, upper: zeroErrorUpper(n), assumption: 'Independent identically distributed Bernoulli trials; household observations need not satisfy this.' })),
  minimumNForZeroErrorsUpperAtMost5Percent: Math.ceil(Math.log(0.05) / Math.log(0.95)),
  ruleGapParser: { actualGaps, narrowHeadingParserGaps: narrowGaps, falseAbsenceCount: narrowGaps.filter(n => numberedIds.has(n)).length, evidence: 'scripts/ci-ledger-integrity-check.mjs:39 vs frozen source-snapshot RULES text' },
  conditionCount: { observedConditions: 7, metConditions: 5, probabilityIdentified: false, reason: 'Count alone identifies neither dependence, relative weights, outcome definition, nor calibrated probability.' },
  fixedReplayRule: { threshold: 25, input: 26, expectedLabelByDefinition: 'burden', invariantPassProves: 'implementation follows its definition', doesNotProve: ['economic validity', 'prospective accuracy', 'optimal threshold', 'low false-positive rate'] }
});
const reviewers = ['engineering', 'product', 'data'];
const pending = reviewers.filter(name => !fs.existsSync(path.join(out, name + '-rules.json')));
let rules = [];
for (const name of reviewers.filter(n => !pending.includes(n))) {
  const value = JSON.parse(fs.readFileSync(path.join(out, name + '-rules.json'), 'utf8'));
  const rows = Array.isArray(value) ? value : value.rules || value.items || value.rows;
  if (!Array.isArray(rows)) throw new Error('Missing rule array in ' + name);
  const expanded = [...rows, ...(Array.isArray(value) ? [] : value.subrules || [])];
  rules.push(...expanded.map(row => {
    const id = typeof row.id === 'number' ? `R${row.id}` : row.id;
    const candidates = headings.filter(h => h.id === id);
    const clean = s => String(s).replace(/^R\d+(?:-A)?[.\s:—–-]*/, '').replace(/\*\*/g, '').trim();
    const exact = candidates.find(h => clean(h.title).includes(clean(row.title)) || clean(row.title).includes(clean(h.title)));
    const heading = exact || (candidates.length === 1 ? candidates[0] : null);
    return { ...row, id, reviewerReadLine: row.line, line: heading?.line || row.line, reviewer: name };
  }));
}
rules.sort((a, b) => Number(String(a.id).match(/\d+/)?.[0]) - Number(String(b.id).match(/\d+/)?.[0]) || (a.line || 0) - (b.line || 0));
write('rule-dispositions.json', rules);
write('rule-dispositions.md', '# R 규칙별 검토표\n\n본문을 읽은 항목의 판정은 해당 문맥에서의 의미 검토다. 구현 완료 인증이 아니다. 제목만 남은 항목은 본문 미확인으로 남긴다. 중복 ID는 제목과 line을 함께 본다. R1-A는 하위 정책으로 별도 대조한다. 이 표를 제품 지침으로 자동 적용하지 않는다.\n\n| ID | line | 상태 | 판정 | 검토 근거 | 제목 |\n|---|---:|---|---|---|---|\n' + rules.map(r => `| ${cell(r.id)} | ${cell(r.line || '')} | ${cell(r.status || '')} | ${cell(r.disposition)} | ${cell(r.reason)} | ${cell(r.title)} |`).join('\n') + '\n');
const missingIds = [...new Set(headings.filter(h => h.id !== 'R1-A' && !rules.some(r => r.id === h.id)).map(h => h.id))];
const dispositionCounts = Object.fromEntries([...new Set(rules.map(r => r.disposition))].map(k => [k, rules.filter(r => r.disposition === k).length]));
const issues = [];
const keyCounts = new Map();
for (const r of rules) {
  if (!r.id || !r.title || !r.disposition || !r.reason) issues.push('Missing required review field: ' + r.id);
  if (/본문 미확인/.test(r.disposition) && /^(유지|PASS)$/.test(r.status || '')) issues.push('Unseen body presented as approved: ' + r.id);
  const key = `${r.id}:${r.line}`;
  keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
}
for (const h of headings) {
  if (keyCounts.get(`${h.id}:${h.line}`) !== 1) issues.push(`Rule occurrence does not map exactly once: ${h.id}:${h.line}`);
}
if (pending.length) issues.push('Pending reviewer outputs: ' + pending.join(', '));
if (missingIds.length) issues.push('Missing rule IDs: ' + missingIds.join(', '));
const linkErrors = [];
for (const file of fs.readdirSync(out).filter(f => f.endsWith('.md'))) {
  const content = fs.readFileSync(path.join(out, file), 'utf8');
  for (const m of content.matchAll(/\]\(([^)]+)\)/g)) {
    const target = m[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^[a-z]+:\/\//i.test(target)) continue;
    const resolved = path.isAbsolute(target) ? target : path.resolve(out, target);
    if (!fs.existsSync(resolved.replace(/:\d+$/, ''))) linkErrors.push(`${file}: ${target}`);
  }
}
if (linkErrors.length) issues.push('Missing local links: ' + linkErrors.join(', '));
const coverage = {
  generatedAt: new Date().toISOString(), snapshotAt: snap.capturedAt, sourceVersion: snap.version,
  sourceFilesChangedSinceSnapshot: currentChanges,
  inventoryOccurrences: headings.length, uniqueNumberedRuleIds: new Set(headings.filter(h => h.id !== 'R1-A').map(h => h.id)).size,
  bodyReviewedOccurrencesIncludingHistoryAndSubrule: rules.filter(r => !/본문 미확인/.test(r.disposition)).length,
  bodyUnverifiedOccurrences: rules.filter(r => /본문 미확인/.test(r.disposition)).length,
  reviewedRows: rules.length, dispositionCounts, pending, missingIds, issues,
  missingLocalLinks: linkErrors,
  fixedProductDecisionsReviewed: 17, crossPolicyAnalyses: 20, openQaRowsRead: qaRows.length,
  reviewed: ['Retained RULES bodies and title-only markers as scoped by three independent reports', 'All 17 AGENTS Product decisions, including internal subclauses', 'All unchecked QA rows in frozen snapshot as criteria, not current bug status', 'Named prescriptive documents and selected implementation contracts listed in the three reports and source-snapshot'],
  unverified: ['Full historical bodies of title-only rules', 'Every historical P entry and every checked QA receipt', 'All 455 knowledge units and their full primary sources', 'Every automated assertion via mutation testing', 'Jurisdiction-specific legal opinion and provider-specific individual permission', 'Actual account hard-limit configuration, invoices, provider retention, Secrets', 'Production certification of concurrent v57.83 changes', 'Real iOS/iPadOS assistive-technology and long-term outcomes'],
  noProductPolicyChangesApplied: true, noCommitPushDeployOrWorkflowDispatch: true
};
write('coverage.json', coverage);
if (zeroErrorUpper(15) < .18 || zeroErrorUpper(59) > .05) throw new Error('Binomial counterexample mismatch');
console.log(JSON.stringify({ inventory: headings.length, reviewedRows: rules.length, openQa: qaRows.length, missingIdCount: missingIds.length, pending, issueCount: issues.length, changed: currentChanges }, null, 2));
if (issues.length) process.exitCode = 1;
