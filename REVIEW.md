# AIO 리뷰 기준

리뷰어(cstack, `.claude/agents/code-reviewer.md`, Codex)가 이 저장소에서 무엇을 결함으로 보고 어떻게 보고하는지 정한다. 제품 결정은 `AGENTS.md`, 정책은 `_context/RULES.md`가 정본이고, 이 문서는 리뷰 관점만 담는다. 사람 시간은 리뷰 시간과 나쁜 변경을 고치는 시간을 합쳐 센다(Claude Code 팀 리뷰 방식, 2026-10).

## 이 저장소에서 실패란

1. 화면·AI가 사실이 아닌 것을 말한다 — 지어낸 숫자, 날짜 없이 현재처럼 보이는 오래된 값, 결측을 0이나 추정으로 채움, 티커 추정, 근거 없는 등급·확률, 가격·수량·시점 지시.
2. 문서·레지스트리가 거짓말한다 — 바뀐 코드와 어긋난 `CLAUDE.md`·`AGENTS.md`·스킬·`CODE-MAP` 줄, `architecture/route-owners.json`·`qa-pipeline.json`이 변경을 엉뚱한 게이트로 보내거나 아무 게이트로도 보내지 않음.
3. 정본이 갈라진다 — 생성 파일 손편집, 두 번째 정본 추가, 로컬에서 producer를 돌린 흔적(`public-data/` 손편집).
4. 비용·비밀 경계가 샌다 — AI 호출이 공용 Worker 원장을 우회, 키·토큰이 클라이언트·로그·URL에 노출.
5. 수명주기가 샌다 — 재진입 시 타이머·리스너·차트 중복, 소유자 없는 abort/timeout, 정리 단계에서 지우지 않은 진행 표시.
6. 게이트가 증명하지 않는다 — 수정 전 상태에서도 통과하는 검사, 소스 텍스트 핀(출력 검사로 바꾼다), 낮은 단계 증거를 높은 단계로 보고(정적 PASS를 브라우저·라이브로).

## 변경 경로로 정하는 위험

작성자가 아니라 바뀐 경로가 위험을 정한다. 아래 경로가 diff에 있으면 결론 줄에 따로 적고, 에이전트 리뷰 통과로 소유자 확인을 대신하지 않는다. 소유자에게는 무엇이 잘못될 수 있는지와 되돌리는 방법을 쉬운 말로 적는다.

- `.github/workflows/**` — 배포·데이터 갱신·권한
- `worker/**`, `cloudflare-worker-proxy.js` — AI 예산 원장·비밀
- `sw.js`, `_headers` — 캐시·배포 경계
- `scripts/bump-version.mjs`, `scripts/record-fix.mjs`, `scripts/resolve-generated-conflicts.mjs` — 원장·버전 기록
- `.claude/settings*.json`, `scripts/agent-hook.mjs` — 에이전트 권한
- `AGENTS.md`의 Product decisions

## 보지 않는 것

- `data: refresh …` 커밋의 `public-data/**` 값 자체(스키마·producer 변경은 본다).
- `_artifacts/**` — 시점 증거.
- 생성 파일 — `_context/CURRENT-STATE.md`, `_context/CONTEXT-CATALOG.json`, `.agents/**` 미러, `_context/*-baseline.json`. diff 대신 생성기와 생성 명령을 본다.
- 스타일·이름·중복·주석 취향. 드문 경합·보안 가설은 실패 양상과 가능성을 함께 적고 Important로 올리지 않는다(AGENTS 코딩 규율 ②).

## 보고 형식

- 첫 줄에 개수를 쓴다: `Important n · Pre-existing n`. 없으면 `발견 없음`이라고 쓴다.
- 발견마다 `파일:줄`, 실패 시나리오(입력·상태 → 틀린 출력), 결함 종류. 파일 이름을 추측하지 않는다.
- 태그: **Important**(이 변경이 만든 실제 결함) · **Pre-existing**(변경 전부터 있던 결함 — 작성자 탓이 아니며 별도 후속) · **Nit**(요청할 때만).
- 정적·headless·브라우저·라이브 증거를 나눠 쓴다. 확인하지 못한 것은 확인하지 못했다고 쓴다.

## 리뷰가 끝나는 조건

- 기본은 리뷰 1회 + 수정. 다시 리뷰하면 2라운드부터는 직전 이후 diff와 열린 발견만 본다.
- 최대 3라운드. 보안·비밀·AI 예산·데이터 손실·동시성에서 근거 있는 Important가 열려 있을 때만 5라운드까지.
- 이미 낸 발견을 다시 내지 않는다. 한 줄이 아니라 결함 종류를 말해 같은 종류를 한 번에 고치게 한다.
- 3라운드 뒤에도 남으면 접근을 다시 보라고 적고 멈춘다. 라운드 소진은 승인이 아니다.
- 리뷰가 diff를 키우면 먼저 줄인다. 지우거나 좁히는 수정을 먼저 고른다.

## 리뷰어를 고치는 방법

- 발견마다 처리를 남긴다: 고침 · 틀림 · 의도됨 · 상관없음. 틀림·상관없음이 늘면 긴 프롬프트가 아니라 이 문서 한 줄, 게이트, lint로 옮긴다.
- `architecture/review-eval-cases.jsonl` — 실제 사고(`_context/BUG-POSTMORTEM.md`)에서 만든 버그 사례와 깨끗한 사례. 리뷰어 프롬프트·이 문서·도구·모델을 바꾸면 전체를 다시 돌려 recall(버그 파일·줄을 맞힌 비율)과 깨끗한 사례의 해로운 오탐을 비교하고, 나빠지면 되돌린다. `node scripts/review-eval.mjs --check`(사례 확인), `--packet <id>`(리뷰어에게 줄 diff), `--score <findings.json>`(채점).
- 새 사고(P 항목)가 리뷰로 잡을 수 있던 종류면 사례를 하나 더한다.
