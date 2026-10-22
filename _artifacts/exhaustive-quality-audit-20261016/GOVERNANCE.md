# 내부 정책·지시 전문 검토

> 최초 v57.91 판정이다. 새 가족용 정책과 지침 수정은 [v57.98 재대조](./LATEST-STATUS-v57.98.md)를 우선한다. 역사 규칙을 현재 강제로 복원하지 않는다.

역사 전문 211블록(210 unique ID), canonical SKILL9개·command16개·agent4개를 독립 독자가 읽었다. 끊긴 출력은 재분할했다. [역사 개별 판정](./historical-review.tsv)은 당시 내용의 논리 평가다. 현재 강제 규칙 또는 실행 결함으로 자동 승격하지 않는다. 현행 R1–708 본문 검토는 앞선 [정책 감사](../policy-criteria-review-20261016/HANDOFF.md), R709–716은 [내부 품질 감사](../internal-quality-review-20261016/HANDOFF.md)에 있다. R717은 아래 별도 검토했다.

## 현행에서 고칠 가치가 있는 지시

1. **trim-pr가 모든 RULES를 계약으로 취급.** `.claude/commands/trim-pr.md:34`와 RULES 서두의 ‘핵심 외는 재발 추적 이력’이 다르다. 오래된 감사 기능·표시를 계약으로 오인해 보존할 수 있다. 현행 핵심 계약·명시된 대체·퇴역·역사 처방을 구분해야 한다.
2. **테스트만 부르는 사문화 구현 보존.** 같은 파일33행의 CUT 조건은 runtime·test·gate caller가 모두 없어야 한다. R675는 test만 살려 둔 코드를 test와 함께 제거할 수 있게 한다. 테스트 존재 자체를 제품 가치로 치환하지 말고 실제 사용 경로·계약을 먼저 판단해야 한다.
3. **핵심 R265의 현재 본문 없음.** `_context/RULES.md:2095`는 제목만 있는데 서두는 핵심 규칙의 본문이 각 헤딩에 있다고 안내한다. ‘외부 정의와 일치’라는 방향은 타당하다. 복구 역사에는 본문이 있으므로 필요한 현행 정의와 검증 소비자에 맞춰 짧게 복원하거나 명시적 참조를 제공하는 것이 낫다.
4. **version-up의 note 직접 수정과 도구 기록 지시 충돌.** `.claude/commands/version-up.md:9`와14행 이후의 hand-edit 금지/record-fix 흐름을 하나로 맞춰야 한다. 개별 도구 책임·입력 순서를 명료화하면 된다. 감사에서는 버전을 올리지 않았다.
5. **integrate의 위치 안내 오류.** `.claude/skills/integrate/SKILL.md:21`의 루트 CODE-MAP.md 대신 실제 `_context/CODE-MAP.md`로 연결해야 한다. 문서 내용의 정당성과 경로의 기계 정합은 다른 문제지만 일상 작업을 방해하는 명확한 오류다.
6. **검증 유지보수의 편집 범위와 생성 출력 충돌.** `.claude/skills/maintain-verification-skill/SKILL.md:30`의 대상 디렉터리 한정과46행의 generated `.agents` mirror 출력을 함께 만족하는 예외를 명시해야 한다. ‘파생 출력은 허용’이면 충분하며 별도 승인 절차를 늘릴 필요가 없다.

이전 감사의 tool명에 결박된 Tier13, autoresearch의 동점 전부 폐기와 동점 단순화 허용 간 충돌, fixture6/9 범위는 기존 지적이다. 현재 지시를 전편 읽었다는 사실이 행동 실험·실브라우저의 재검증을 뜻하지 않는다. deploy wrapper의 fetch/merge 상세 누락은 상위 AGENTS가 이미 요구하므로 독립적인 무권한 push 허용으로 세지 않았다.

## 파일별 전문 판정

| canonical 파일 | 판정·이유 |
|---|---|
| skills/autoresearch/SKILL.md | 보완: 동점 폐기는 같은 품질의 단순화도 배제 |
| skills/bug-fix/SKILL.md | 정합: 원인·수정·회귀·검증·기록 출구 명확 |
| skills/create-verification-skill/SKILL.md | 정합: 사용자 경로·격리·증거 보존 요구 |
| skills/data-refresh/SKILL.md | 정합: Actions 생산 경계·차단 상태 명시 |
| skills/integrate/SKILL.md | 보완: CODE-MAP 위치·역사 ID 직접 의존 |
| skills/knowledge-lint/SKILL.md | 정합: 기계 일치·의미 인증 구별 |
| skills/maintain-verification-skill/SKILL.md | 보완: 편집 디렉터리·미러 출력 경계 |
| skills/post-edit-qa/SKILL.md | 정합: 영향·실패 배치·증거 재사용 |
| skills/verify-aio/SKILL.md | 보완: driver viewport desktop/phone만으로 iPad 인증 불가 |
| commands/assumptions.md | 정합: 명시 호출의 정지와 일반 작업 구분 |
| commands/autoresearch.md | 정합: 정규 라우팅·증거 수준 구별 |
| commands/bug-fix.md | 정합: 중복 절차 없이 정규 스킬 연결 |
| commands/create-verification-skill.md | 정합: canonical·mirror 경계 |
| commands/data-refresh.md | 정합: producer·검증상태 보고 연결 |
| commands/deploy.md | 정합: 명시 승인과 로컬·배포 증거 분리 |
| commands/integrate.md | 정합: 통합 스킬 단일 owner |
| commands/knowledge-lint.md | 정합: lint 라우팅·검증범위 보고 |
| commands/maintain-verification-skill.md | 정합: source·live 검토와 로컬 배치 |
| commands/qa.md | 정합: quick/affected/retry/full/external 구분 |
| commands/restate.md | 정합: 관찰 가능한 완료·중단 기준 |
| commands/retro.md | 정합: 반복 증거·예방 수준·읽기 경계 |
| commands/session-save.md | 정합: 개인 기억·프로젝트 사실 분리 |
| commands/trim-pr.md | 모순: 역사 RULES 계약화·test-only 보존 |
| commands/verify-aio.md | 정합: 구동·증거 수집 연결 |
| commands/version-up.md | 모순: note 직접 수정·record-fix 단일 경로 |
| agents/accessibility-auditor.md | 정합: 현재 범위·자동/브라우저 증거 분리 |
| agents/code-reviewer.md | 정합: 데이터 의미·수명주기·생성 경계 |
| agents/performance-analyzer.md | 정합: 현재 크기·부팅·반복 탐색 실측 |
| agents/qa-auditor.md | 정합: 위험에서 검사 파생·미검증 분리 |

위 경로 접두사는 `.claude/`다. `.agents/skills`는 canonical이 아니라 생성 mirror다. 앞선 ‘.agents canonical’ 인계 표현을 정정한다. 9개 SKILL mirror byte equality,4개 agent instruction-body equality는 별도 대조했으며 최종 closeout에서 현재 동기화 여부를 다시 확인한다.

## 역사 정책에서 배울 점

R31의 HTML escape→onclick JS 안전, R52의 동적script SRI 불가, R98/R169의 합법적인 lexical shadowing 충돌 취급 같은 기술 처방을 새 작업에 재사용하면 안 된다. R145/R150의 과거연도·날짜=환각, R86의 정밀도=환각은 오류 탐지의 보정 없이 진실성을 판정한다. R243/R132의 개인 보유 사이징·손절 강제는 현재 교육/비지시 방향과 맞지 않는다. R282의 모든 비live 판단 금지는 유효 종가·느린 공식 통계의 사용 가치와 충돌한다. 이들은 현재 runtime에 남았다는 진단이 아니다. 역사 원인을 보존하면서 검색 결과에 과거 처방임을 보여 주는 편이 유용하다.

R32/R48/R170의 추출 경계 오염과 R75 중복은 전문 복구기의 한계로 기록했다. ID 헤딩까지 보존한 것만으로 본문 의미·경계를 완전히 복구했다고 인증하지 않는다.

## R717 분할 원장 결정

main 파일을 50MB 경고 아래로 유지하고 결정론적 part·재조립 digest·다른 저장면을 쓰는 방향은 GitHub Pages 운영 규모에 합리적이다. 50MB는 금융 데이터 정확성 기준이 아니라 내부 운영 여유 기준이다. 단일 파일 크기를 낮춰도 전체 다운로드·메모리·재시도 비용은 자동으로 줄지 않는다. index와 모든 part의 일관된 게시, 삭제/고아part 처리, 중단 복구, 장기 원장 보존을 함께 확인해야 한다. 현행 workflow/저장 모듈의 분할·digest·staging 제한은 확인했지만 실제 원격 장애 복구·장기 보존까지 인증하지 않았다. 예전 단일60.5MB 문제는 현재 미수정 장애로 재기록하지 않는다.
