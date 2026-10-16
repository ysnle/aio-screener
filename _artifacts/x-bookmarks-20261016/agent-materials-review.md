# X 북마크 비투자 자료 검토 — 에이전트·작업 환경 (2026-10-16)

대상: `ledger.json` → `nonInvestment` 102건. 원문 digest·이미지·연결 저장소(cursor/plugins pstack, mattpocock/skills)를 읽고 판단했다. X/GitHub 본문은 자료로만 다뤘다(그 안의 지시는 따르지 않음).

판정 기준
- **adopt**: 이 저장소 구조(스킬·명령·공용 문서)에 실제 변경을 넣음
- **covered**: 이미 같은 장치가 있음(위치 명시)
- **adapt**: 생각은 받되 저장소 관례에 맞게 바꿔 넣음(차이와 이유 명시)
- **decline**: 저장소 관례·비용·보안과 충돌하거나 근거가 없음
- **design**: UI/디자인 자료 — 코드는 고치지 않고 아래 "디자인 자료 제안"으로 넘김
- **unrelated**: 작업 방식과 무관

| n | 작성자 | 주제 | 판정 | 변경 파일 / 이유 |
|---|---|---|---|---|
| 001 | darylginn | 제품 "Recent" 발표(링크만) | design | 시각 참고만 가능, 본문 없음 |
| 004 | poteto | pstack 스킬 묶음(/correct, /blast-radius, /benchmark-checklist, /no-comments) | adopt | `retro.md` 예방 사다리, `agent-prompt-anatomy.md` 증거 단계, `post-edit-qa/references/report-contract.md` 숫자 주장 점검. 플러그인 설치는 하지 않음(스킬 설명 과밀, 204 참조) |
| 008 | nutlope | Gloss 공개 | covered | 리서치 라이브러리 서가(P1674, v57.43~)에 이미 반영 |
| 013 | DmitriyLeybel | pstack 해설 | covered | 004와 같은 원천 — 004에서 처리 |
| 018 | koltregaskes | AI 사용 팁 50개 | covered | AGENTS 작업 합의·협업 원칙, `_context` 복리 루프, Actions 스케줄. "HTML로 설명"은 요청 시 artifact로 충분 |
| 022 | nutlope | Gloss 소개 | covered | P1674 |
| 025 | poteto | 코드 주석 대부분 삭제 | adapt | `trim-pr.md` 주석 렌즈: 이 저장소는 버전·P 태그 달린 "왜" 주석과 브라우저·원천 특이사항 주석을 유지. 낡은 주석·다음 줄 반복 주석·P/R 참조 없는 우회 주석만 지적, 값싼 게이트로 지킬 수 있는 "건드리지 말 것" 주석은 게이트화 후 참조만 남김. 전면 삭제는 거절(관례 충돌) |
| 038 | poteto | /in-your-own-words | covered | `.claude/commands/restate.md` |
| 041 | felixrieseberg | "더 야심차게" 튜토리얼(링크만) | decline | 본문 없음 — 판단 근거 없음 |
| 053 | mattpocockuk | 흔한 실수 목록(정렬 과다, 검사 느슨, 세션 회고 부족 등) | adopt | `retro.md` 3단계에 점검 위치(탐색·자동 검사·상시 문서·도구 비용·정보 접근) 추가 |
| 061 | nutlope | Gloss 인쇄·팟캐스트 | covered | P1674(서가). 인쇄·팟캐스트는 범위 밖 |
| 063 | nizamdesign | AI 컨설팅 UI(출처 충돌 카드) | design | 아래 제안 1 |
| 068 | dzhng | 추상화 제거·검증 하네스·결정 선행 | covered | 게이트 하네스(qa-runner), /restate·/assumptions. Rust/wasm 재작성은 전면 재작성 금지 규칙과 충돌 → 해당 부분 거절 |
| 069 | poteto | 검증 루프가 출발점 | covered | `create-verification-skill`·`maintain-verification-skill`·`verify-aio`(2026-10-13 도입) |
| 072 | claudeai | Claude Dashboards("모든 차트가 쿼리를 보여줌") | design | 아래 제안 2 |
| 077 | nutlope | read-later → 개인 서재 | covered | P1674 |
| 078 | brenzhills | GitHub 무료 저장소 10선(스페인어) | unrelated | 음성·영상 도구 목록 |
| 079 | dingyi | "최강 skills"(영상만) | decline | 내용 확인 불가 |
| 091 | MatthewBerman | Reverse Engineer Anything | unrelated | 작업 방식과 무관 |
| 092 | alexgetmancom | 서브에이전트 캐시 TTL 1시간 설정 | decline | settings 변경은 이 작업 권한 밖. 사용자 수준 설정이고 효과·과금 방식(구독 vs API) 미검증 → 소유자 결정 항목 |
| 093 | ClaudeDevs | Managed Agents 동적 워크플로 | adapt | `agent-prompt-anatomy.md` "fan-out은 독립 조각·자동 검사·명확한 중단 조건이 있을 때만, 한 조각으로 먼저 시험". 1,000 에이전트 규모 실행은 5인 서비스·$20 예산과 맞지 않음 |
| 101 | mattpocockuk | good-css(현대 CSS 기법) | design | 아래 제안 3 |
| 106 | theo | tsc-rs | unrelated | 이 저장소는 TS 빌드 없음 |
| 111 | marcelkargul | 대시보드 Figma | design | 아래 제안 6 |
| 112 | mattpocockuk | ADR로 결정 기록 | covered | AGENTS "Product decisions (fixed)" + CHANGELOG + RULES |
| 113 | npm_i_shaders | WebGPU 셰이더 | design | 데이터 가치 없음·성능 비용 → 사용 안 함 |
| 114 | mattpocockuk | /writing-for-agents로 AGENTS 재구성 | adapt | `knowledge-lint/references/workflow.md` Pass 8에 상시 문구 점검 5종(no-op·environment·single source·trigger·negation) 추가. AGENTS 자체 재작성은 하지 않음: 대부분 소유자 제품 결정이라 삭제는 승인 사항 |
| 118 | walden_yan | Agent Memory Repo(git+markdown 메모리) | covered | `_context/` 위키 + 클라이언트 메모리 + `/session-save` 경계 |
| 119 | Tanjim38 | 멀티 에이전트 작업 관리 앱 | unrelated | 제품 홍보 |
| 120 | mattpocockuk | /retro | covered | `.claude/commands/retro.md`(이번에 053·004로 날을 세움) |
| 121 | marcelkargul | CRM 대시보드 오픈소스 | design | 아래 제안 6 |
| 122 | smk7z | answer-me-with-html | decline | 사용자 화면은 한국어 짧은 설명 기준(R 문체 기준)이 있음. HTML 설명은 필요 시 artifact |
| 124 | nbaschez | MCP Events(이벤트 트리거) | decline | 생산은 Actions cron + data-watchdog. 이벤트형 에이전트 상주는 비용·운영 증가 |
| 125 | karpathy | ASD-STE100·도식·HTML·영상 설명 | decline | STE100은 영어 통제어. 한국어 쉬운 문장 기준은 이미 있음. 도식은 화면 원칙("3초 시각")에 포함 |
| 128 | suraj_sharma14 | SEO 체크리스트 | decline | 가족·지인 5명용, 검색 노출 목표 없음 |
| 138 | thenanyu | "단 하나의 SaaS 레이아웃" | design | 아래 제안 4 |
| 139 | o_kwasniewski | e2e 에이전틱 테스트 | covered | `verify-aio`(Playwright, 증거 캡처). 외부 모델 로그인형 도구 도입 불필요 |
| 140 | elikemmedehou | Monocode UI | design | 아래 제안 6 |
| 143 | mattpocockuk | /codebase-design 삭제 테스트 | adopt | `trim-pr.md` "삭제 테스트" 렌즈 |
| 144 | tvykruta | 설계 원칙 10개, "먼저 리팩터" | covered | AGENTS 코딩 규율(최소 코드·추상화 금지). "HARD RULE 먼저 리팩터"는 최소 수정·전면 재작성 금지와 충돌 → 그 줄은 거절 |
| 146 | 0xMovez | Opus 모션 디자인 강좌 | design | 모션 영상은 데이터 가치 없음 → 사용 안 함 |
| 147 | BraydenWilmoth | Cloudflare "cf" CLI | decline | Worker 배포는 CI-attested SHA만(AGENTS). 로컬 CLI 배포 경로 추가는 경계 위반 위험 |
| 149 | poteto | "내 목표를 네 말로 다시 말해봐" | covered | `/restate` |
| 150 | kimmonismus | 에이전트 프롬프트 해부도(목표·반환형식·경고·맥락) | covered | `.claude/skills/_shared/agent-prompt-anatomy.md`가 같은 구조 |
| 152 | kloss_xyz | 가정 목록(verified/guessed) 후 멈춤 | covered | `/assumptions` |
| 153 | daniel_mac8 | Claude Code 동적 워크플로 | adapt | 093과 같은 반영 |
| 154 | openshipio | Openship 토폴로지 캔버스 | unrelated | 서버 운영 없음(정적 Pages + Worker) |
| 156 | championswimmer | PR 뒤 새 컨텍스트로 깎기 | covered | `/trim-pr` |
| 157 | gregisenberg | AI 롤업 투자 논리 | unrelated | 사업 모델 글 |
| 158 | Voxyz_ai | 장기 작업 전 HTML 진행 대시보드 서브에이전트 | decline | 하네스 작업 목록이 같은 역할. 매 작업마다 에이전트·HTML 생성은 토큰 낭비, CLAUDE.md 상시 규칙 추가는 상시 문서 비대화 |
| 163 | steipete | 쓸모없는 테스트 삭제, "야심찬 목표"를 줘야 함 | adopt | `trim-pr.md` 목표 수치 부여 + 저신호 검사 렌즈 |
| 168 | RayFernando1337 | 저신호 단위 테스트 삭제, E2E 선호 | adapt | `trim-pr.md` 저신호 검사 렌즈. "단위 테스트 금지"는 거절: 이 저장소 게이트 다수가 계약·데이터 검사이며, 텍스트 핀은 이미 ratchet으로 동결 |
| 174 | github | 한 명+에이전트로 Rust 포팅 | unrelated | 사례 소개 |
| 177 | rammcodes | Cloudflare 로컬 공유 터널 | decline | 로컬 서버 외부 노출 불필요·보안 위험 |
| 181 | AIatAMD | AMD 개발자 프로그램 | unrelated | |
| 187 | boltdotnew | Bolt Forge 무료 모델 | decline | AI 공급자·예산 고정(OpenAI gpt-6-luna, 월 $20) |
| 193 | OpenAIDevs | 스킬 트리거 구체화·필요 시 로드·완료 정의 | adopt | `knowledge-lint` Pass 8 trigger 점검. 완료 정의는 AGENTS 작업 합의에 이미 있음 |
| 204 | pvncher | Astra용 스킬·AGENTS 재점검 | covered | `_artifacts/structural-quality-20260906/ASTRA-GUIDANCE-PROPOSAL.md`, AGENTS preflight 3(스킬은 참조), 짧은 스킬 설명 |
| 207 | gabrielchua | Codex 컨텍스트 간 노트 | decline | Codex 하네스 개인 설정. 저장소 진실은 `_context`·핸드오프에 둠 |
| 209 | nestedSegwit | 오픈소스 금융 터미널(Neuberg) | design | 아래 제안 5 |
| 210 | angelbrodin | Astra 협업 팁(실행 요청 문구, 승인 문구 점검) | covered | AGENTS 작업 합의 "할 수 있나/원한다/도와줘는 실행 요청", "로컬 수정·격리 테스트에 중복 확인 불필요" |
| 211 | bradleybernard | 새 모델 맞춰 AGENTS·SKILL 감사 | covered | 이번 검토 + 204 |
| 212 | joedevon | 같은 감사 프롬프트 | covered | 204 |
| 214 | georgepickett | "삭제 > 단순화 > 최적화 > 자동화" | adopt | `trim-pr.md` 삭제 테스트 렌즈에 우선순위와 "깎을 게 없으면 그대로" 포함 |
| 216 | theo | 슬롭 감사·성능·에이전트 DX·병합 맡기기 | adapt | 슬롭 감사는 `/trim-pr` 렌즈로. "에이전트가 병합" 은 자동 push 금지와 충돌 → 거절 |
| 249 | AndrewYNg | AI 엔지니어링 기술 지도 | unrelated | 교육 개요. 평가 주도 개발은 `/autoresearch`에 있음 |
| 268 | jahooma | 광고 붙은 무료 DeepSeek | decline | AI 공급자 고정·데이터 경로 불명 |
| 290 | RayFernando1337 | 그래프 엔지니어링 | decline | 검증 가능한 내용 없음 |
| 309 | ihteshamali | World Monitor(3D 지구본 뉴스) | design | 아래 제안 5 |
| 316 | cerebras | 사내 지식 베이스 구축 | decline | 수천 명 규모 RAG — 5인·정적 JSON 원칙과 규모 불일치 |
| 321 | theo | 서브에이전트 effort 상속 문제 | covered | 소유자 지시(읽기 전용 low/medium), AGENTS 작업 합의, anatomy 새 절 |
| 323 | angeldot_ | Ponytail(코드 덜 쓰기) | covered | AGENTS 코딩 규율 ②. 플러그인 설치는 하지 않음 |
| 324 | drmusician1 | PLTR 대시보드·뉴스 긍정/부정 색 | design | 아래 제안 5 |
| 325 | kaigooddev | 개발 서버 포트표 | unrelated | |
| 326 | jeeaannnk | 클렌징 제품 | unrelated | |
| 328 | rhoppon | 일일 비서 에이전트 프롬프트 | covered | 제품의 "오늘" 브리핑과 AI 패널이 같은 역할. "사실과 추측 구분"은 AI 계약에 있음 |
| 331 | aguming_ | Orca IDE | decline | 개인 도구 선택, 저장소 변경 없음 |
| 335 | nickgomez | OpenKnowledge 마크다운 IDE | decline | 개인 도구 선택 |
| 338 | ClaudeDevs | 모델 vs effort("몰랐나, 덜 애썼나") | adopt | `agent-prompt-anatomy.md` 깊이·모델 절: 먼저 프롬프트·맥락, 그 다음 모델/effort 판단 |
| 339 | Av1dlive | Fable 5 워크플로 도식 9장 | decline | 내용 미확인(영상·외부 링크) |
| 345 | ClaudeDevs | 자문형(큰 모델)·지휘형 서브에이전트 | adapt | anatomy 깊이 절에 흡수. 모델별 역할 고정은 하네스마다 모델이 달라 문서화하지 않음 |
| 346 | ClaudeDevs | 루프 시작하기(/goal 중단 조건, 시험 실행) | adopt | `agent-prompt-anatomy.md` GOAL에 "완료 모습과 중단 조건(개수·턴 상한)" 추가, fan-out 시험 실행 |
| 347 | Xterbase | 옵시디언 LLM 위키(ingest/lint/query) | covered | `/integrate`·`/knowledge-lint`·`_context` 위키 |
| 364 | 0xCodez | 루프 엔지니어링 14단계(4조건 테스트) | adopt | anatomy fan-out 조건(독립 조각·자동 거부 검사·명확한 중단). 상시 루프는 Actions가 담당 |
| 367 | connect24h | Google DESIGN.md(토큰+이유 산문) | design | 아래 제안 7 |
| 419 | Mnilax | 430시간 토큰 낭비 9패턴 | adapt | 실측: SessionStart 훅 출력 659바이트, CLAUDE.md 6,804바이트(상시 로드). 훅·스킬은 이미 가벼움. CLAUDE.md 중복 줄 정리를 아래 제안으로 넘김 |
| 434 | kirillk_web3 | Karpathy CLAUDE.md 4원칙 | covered | AGENTS 코딩 규율 ①~④(2026-10-12) |
| 436 | eng_khairallah1 | Claude Code 워크숍 영상 | unrelated | 영상 소개 |
| 466 | Kawsar_Ai | Gemini 종목 분석 프롬프트 9개 | decline | 매수·목표가형 프롬프트 — "등급·매매 지시 없음" 결정과 충돌 |
| 467 | hwchase17 | 하네스=메모리, 열린 메모리 | covered | 메모리를 저장소 파일(`_context`, 원장)에 둠 — 하네스 교체에 강함 |
| 478 | NickSpisak_ | 세컨드 브레인 만들기 | covered | CLAUDE.md 복리 루프 |
| 498 | himanshustwts | LLM 지식 베이스 구조도 | covered | 같음 |
| 499 | shannholmberg | Karpathy 옵시디언 KB | covered | 같음 |
| 500 | karpathy | LLM Wiki idea file | covered | 같음 |
| 504 | zodchiii | 훅 8개 | covered | `scripts/agent-hook.mjs` guard-command(파괴 명령 차단)·guard-edit·post-edit(advisory)·session-start. 자동 커밋 훅(#8)은 금지 규칙과 충돌 → 거절. 포매터 훅은 포매터가 없어 해당 없음 |
| 564 | akshay_pachaar | .claude 폴더 해부 | adapt | 에이전트 정의에 model/effort 지정은 유효하나 `.claude/agents/*.md`는 `architecture/agent-profiles.json` 생성물 → 아래 제안. 경로 범위 `.claude/rules/`는 Codex가 읽지 않아 거절(두 하네스 공통 AGENTS 유지) |
| 567 | zodchiii | 스킬·저장소 90선 | decline | 대량 설치는 설명 과밀로 스킬 선택이 나빠짐(204) |
| 583 | ihteshamali | Superpowers(브레인스토밍→계획→TDD) | decline | "테스트 전 작성 코드 삭제" 등은 최소 수정·배치 QA 지시와 충돌. 재현 게이트 먼저는 `/bug-fix`에 있음 |
| 584 | itsolelehmann | autoresearch로 스킬 개선 | covered | `/autoresearch` + `architecture/skill-eval-cases.json` |
| 694 | irabukht | "Claude가 스타트업을 죽였다" | unrelated | |
| 720 | w1nklerr | 돈 버는 봇 가이드 | unrelated | |
| 750 | thedankoe | 하루 만에 삶 고치기 | unrelated | |

집계(102건): adopt 9 · covered 34 · adapt 9 · decline 21 · design 14 · unrelated 15. 에이전트·작업 환경 관련(adopt+covered+adapt+decline) 73건.

## 적용 요약

새 스킬·명령은 만들지 않았다(R27 영향 없음). 기존 정의 5곳의 날을 세웠다.

1. `.claude/commands/retro.md` — 점검 위치 5종과 **예방 사다리**(구조 > 게이트 > 동작 테스트 > 문서 한 줄). 제안 게이트는 과거 실제 사례 1건에서 실패함을 보여야 하고, 더는 일어날 수 없는 실수의 규칙은 제거 후보로 올린다. (053, 004 /correct)
2. `.claude/commands/trim-pr.md` — "Lenses" 절: 삭제 테스트와 삭제>단순화>최적화>자동화, 이 저장소 관례에 맞춘 주석 렌즈, 저신호 검사 렌즈, 검토자에게 목표 수치 부여. (143, 214, 025, 163, 168, 216)
3. `.claude/skills/_shared/agent-prompt-anatomy.md` — GOAL에 완료 모습·중단 조건, 검토자에게 "안전을 떠받치는 사실 하나와 증명 단계" 요구, "깊이·모델·fan-out" 절(맥락 먼저 → 모델/effort 판단, fan-out 조건과 시험 실행). (338, 345, 346, 364, 093, 004 /blast-radius)
4. `.claude/skills/knowledge-lint/references/workflow.md` — Pass 8에 상시 문구 점검 5종(no-op·environment·single source·trigger·negation). 소유자 제품 결정은 표시만 하고 조용히 지우지 않는다. (114, 193)
5. `.claude/skills/post-edit-qa/references/report-contract.md` — "Number Claims" 절과 QA11: 측정 숫자를 보고하기 전 작업이 실제로 끝났는지, 실패·빈 결과를 셌는지, 무엇이 숫자를 제한하는지, 전후 차이가 반복 편차보다 큰지 확인하고, 모르면 inconclusive로 적는다. ("판단을 데이터로 검증" 피드백과 맞물림, 004 /benchmark-checklist)

AGENTS.md는 고치지 않았다(14,303바이트 유지). 읽은 팁 대부분이 이미 작업 합의·코딩 규율·협업 원칙에 있고, 나머지는 스킬 쪽이 맞는 자리다.

후속(주 세션):
- `.agents/skills` 미러 동기화 필요 — `node scripts/sync-agent-skills.mjs` 뒤 `--check`, `ci-skill-contract-check`, `ci-workflow-compaction-check`, `ci-knowledge-lint-check`.
- `generate-workspace-state --check`는 이 작업 전부터 stale(다른 하네스의 버전 변경 진행 중). 이 작업은 파일을 추가하지 않았다.

### 소유자 결정 / 주 세션 제안

- **CLAUDE.md 중복 정리(419·114):** CLAUDE.md는 매 턴 로드된다(6,804바이트). "작업 규칙"의 ① 자동 배포/커밋 금지, ④ 제품 결정·변경 흐름 목록(종가 기준·반응형·옵션 퇴역·티커 추정 금지 등 AGENTS 사실을 복사), ⑤ 기록 순서, ⑦ 배치 마감 push 질문과, 첫 줄 괄호 안 AI 모델·예산 사실은 AGENTS와 같은 내용이다. "정본은 AGENTS.md" 한 줄 + CLAUDE 고유 항목(게이트-문서 계약, 훅 원칙, 위임 루틴)만 남기면 약 1.5~2KB 줄고, 복사된 사실이 낡는 위험도 사라진다. 현재 버전 줄은 bump-version이 관리하므로 유지.
- **에이전트 effort 고정(564·321):** `architecture/agent-profiles.json` + `scripts/sync-agent-profiles.mjs`가 읽기 전용 4개 프로필의 frontmatter에 `model`/`effort`를 내도록 하면 "읽기 전용은 medium" 지시가 문서가 아니라 구조로 지켜진다. Claude Code가 에이전트 frontmatter의 `effort`를 지원하는지는 미검증 — 공식 문서 확인 후 적용.
- **서브에이전트 캐시 TTL(092):** 사용자 수준 `~/.claude/settings.json` 설정이라는 주장(미검증). 1시간 캐시는 쓰기 단가가 높아 짧은 서브에이전트에는 손해일 수 있다. 소유자 판단 사항.

## 디자인 자료 제안 (UI 코드 미수정 — 주 세션 검토용)

1. **출처 충돌 카드(063):** 리서치 라이브러리에서 두 원칙·대가 메모가 서로 다른 조건을 말할 때, 두 문장을 날짜와 함께 나란히 보여 주고 "어떤 조건에서 어느 쪽이 맞는지"를 쓰는 카드. 판정은 사용자 몫으로 둔다(조건부 추론 원칙과 일치).
2. **차트 기준 펼침(072):** "모든 차트가 쿼리를 보여준다"를 우리 식으로 — 접힌 "데이터 기준"에 계산식·기간·원천 발행일을 둔다. 화면 옆 출처 문구 금지 지시(2026-10-06)와 맞도록 hover/접힘으로만.
3. **현대 CSS(101):** 접힌 상세의 열림 애니메이션을 JS 없이 `interpolate-size`, 카드 상태 표시는 `:has()`, 카드 높이 맞춤은 `subgrid`, 아이패드 폭은 컨테이너 쿼리. iOS Safari 지원 범위를 먼저 확인하고 점진적 향상으로만 쓴다.
4. **레이아웃 기준(138):** 좌측 레일·사이드바·탭·본문·우측 패널 구조를 아이패드·데스크톱 폭에서 현재 8화면과 비교. 폰에서는 우측 패널을 두지 않는다.
5. **금융 터미널 참고(209·309·324):** 시세 띠·밀도는 참고하되, 거래 버튼(LONG/MARKET)·"AI 분석 대기" 빈 패널·근거 없는 뉴스 긍정/부정 색은 "매매 지시 없음", "원천 없는 위젯 제거", "근거 없는 등급 제거" 결정과 충돌하므로 가져오지 않는다. 뉴스 성격 표시를 원하면 분류 원천과 "AI 분류" 표기가 먼저다.
6. **대시보드 시각 참고(111·121·140·001):** 간격·타이포 위계 비교용. 화면을 만들기 전 기존 화면부터 찾는 지시(2026-10-14)를 따른다.
7. **DESIGN.md(367):** CSS `:root` 토큰(아이보리/다크)을 표 하나로 모으고 각 값의 이유를 한 줄씩 적은 디자인 기준 문서. 손으로 두 벌 관리하지 않도록 토큰에서 생성하거나 `post-edit-qa/references/design-review.md`에 흡수하는 쪽이 맞다.
8. **사용 안 함:** WebGPU 셰이더(113), 모션 영상(146) — 데이터 가치가 없고 성능 비용만 든다.
