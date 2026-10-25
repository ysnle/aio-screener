# 지식·개발운영 파이프라인 2차 판독 기록

2026-10-24, 현재 공유 작업 트리 v58.74. cstack review의 읽기 전용 조사이며 이 파일만 작성한다. 제품 코드·생산 데이터·원장·버전 수정, producer/generator 실행, 외부 API, commit/push/deploy는 하지 않았다. 다른 작업자의 동시 변경은 보존한다.

**판독 진행 중.** 아래의 `전체`는 파일 소스를 처음부터 끝까지 읽었다는 뜻이며 모든 입력 조합 실행·내용 사실 검증·브라우저 검증을 뜻하지 않는다. `부분`은 인용 구간/진입점·I/O·주요 분기만 읽었고 전수 의미 검수는 미완료다. 게이트 칸은 연결된 검증 경로이지 이번 실행 PASS가 아니다. 기본 날짜가 고정된 지식 산출물은 정적 reference이며 생성 실행 시각을 시장 관측 시각으로 쓰지 않는다.

## 지식 생성 경로

공통: `scripts/ci-knowledge-generated-parity-check.mjs:104`의 순서화된 builder 목록이 임시 복사본에서 생성하며 `knowledge-build-candidate.yml`은 후보 SHA·바이트 hash와 humanReviewRequired를 담아 업로드한다. canonical 지식 자동 게시가 아니다. 독립 작성 입력(content·domain pack·catalog)과 생성된 JSON을 구별한다. 대부분 atomic-write는 파일별 원자성이고 여러 파일의 트랜잭션을 보장하지 않는다.

| ID | 진입점·입력 → 변환·저장 → 소비 | 시간·실패 정책 / 검증 | 직접 판독 |
|---|---|---|---|
| K01 | `scripts/build-principles-lessons.mjs:5` stories/worked helpers+chapters+스크립트 원고 → 112 lesson, sourceScope·worked·story → principles/lesson-library.json → principles UI·article builder | 112개/중복 본문/없는 chapter/source label/worked 오류는 throw. 고정 reviewedAt, reference-only. principles contract·lesson parity·generated parity | 부분: 1–45, 192–366 및 출력 일부; 112개 원고 각각의 사실 검증 미완료 |
| K02 | `scripts/build-principles-edge-semantics.mjs:68` catalog edge relation → relation profile, endpoint key → src/domain/knowledge/principles-edge-semantics.js → 개념 관계 UI | 미매핑 relation throw, navigation은 인과로 승격 안 함, sources pending. ontology contract | 전체 1–85 |
| K03 | `scripts/build-nathan-framework-knowledge.mjs:5` NATHAN_FRAMEWORK_PACK → nathan-frameworks.json → concept·routes·AI retrieval | 고정 2026-09-12, current 숫자/예측 승격 금지. integrated/framework·knowledge parity | 전체 1–19; 입력 pack 전체 미판독 |
| K04 | `scripts/build-knowledge-concept-manifest.mjs:19` principles catalog+atlas taxonomy+Nathan/integrated concepts → namespaced canonical IDs, overlap equivalence, aliases → concepts.json/aliases.json → retrieval·coverage | manifest 기본 2026-08-11; legacy 중복은 explicit-equivalence. ontology contract | 전체 1–91 |
| K05 | `scripts/build-knowledge-evidence-registry.mjs:25` lessons/source packets/player-product/domain claims/research seeds → 정규화 source+claim registry → sources.json/claims.json → dossiers·AI retrieval | 모든 source allowedUse REFERENCE_ONLY. 동일 ID 상이 URL 충돌·미해결 source ref 집계 후 exit 1(파일은 먼저 씀). ontology/currentness/parity | 전체 1–149 |
| K06 | `scripts/enrich-knowledge-source-lessons.mjs:49` 기존 lesson.summary 또는 원문 → 공통 확장 문구 제거·short summary·deepStatus RECONSTRUCTION_REQUIRED → principles/atlas lesson 원위치 → articles | reference 심도를 꾸며내지 않음; JSON 읽기 오류 throw. source semantic/parity | 전체 1–70 |
| K07 | `scripts/build-integrated-market-ai-framework-knowledge.mjs:21` integrated pack+lesson/foundation/Nathan/concepts → 필수 fields·linked IDs 검증·audit/datedScene → integrated-market-ai-frameworks.json → library/retrieval | currentClaimsAllowed=false, rankingUse=none 아니면 throw. audit 일부 true는 고정 선언(외부 사실 인증 아님). integrated-framework contract | 전체 1–115 |
| K08 | `scripts/build-knowledge-articles-and-learning-graph.mjs:47` lessons+research-facts → whole-token fact matching, chapter/topic 범위 → article shards+articles.json+learning-graph.json → library lesson 학습·retrieval | 기본 2026-08-18; STRUCTURED_REFERENCE_DRAFT·semantic REQUIRED. 순서 기반 prerequisite/next. article contract/uniqueness·learning state·parity | 전체 1–195 |
| K09 | `scripts/build-knowledge-route-targets.mjs:34` lessons/catalog/Nathan → 전문 화면 route·metric·timeframe·returnContext → route-targets.json → 학습↔전문화면 bridge | 기본 고정 date; 샘플은 배열 index로 선택(lesson 축소 시 throw 가능). route-bridge contract | 전체 1–64 |
| K10 | `scripts/build-knowledge-search-index.mjs:21` concept aliases+frames+columns+lessons+atlas+manager catalog → 짧은 title/text/keys/deep link → search-index.json → glossary/library search | current 값 없음, deterministic; 파일/JSON 오류 throw. native-search·knowledge parity | 전체 1–79 |
| K11 | `scripts/build-ai-knowledge-retrieval-index.mjs:35` articles/concepts/aliases/sources/routes/packs/source lessons → explicit concept link와 text candidate 분리, topical source 최대 2 → ai-retrieval-index.json → AI knowledge retrieval | unknown explicit ID throw; source directness CANDIDATE_REVIEW_REQUIRED; framework sources는 비노출. generatedAt은 일부 입력 max. currentness/AI retrieval contract | 전체 1–184 |
| K12 | `scripts/build-knowledge-coverage-matrix.mjs:29` lessons/concepts/taxonomy/deep/domain/player/product/articles/research → unit별 authored/research/article/missing 상태 → coverage-matrix.json → dossier/runtime counts | browser NOT_RUN, reference only. 기존 dossier 상태를 읽는 순환 입력 있음. full-corpus coverage/parity | 전체 1–127 |
| K13 | `scripts/build-knowledge-research-dossiers.mjs:58` coverage+sources+claims+seeds+facts+articles → topic seed 및 fact 연결 → research-dossiers.json+unit shards → coverage/runtime | substring fact 매칭과 RESEARCHED 승격 결함은 부모가 재현·통합하므로 중복 finding 없음. searchedAt/method는 seed metadata의 재사용이지 이번 외부 검색 증거 아님. web-research-dossier gate | 전체 1–132 |
| K14 | `scripts/build-knowledge-domain-dossiers.mjs:23` guides/pack/taxonomy/deep/player-product → domain graph 후보·metrics·questions → domain-dossiers.json+shards → library/status | metric definition/graph edge 미정은 UNCLASSIFIED_CANDIDATE, 완료로 승격 안 함. sector-domain-depth | 전체 1–124 |
| K15 | `scripts/build-knowledge-runtime-index.mjs:10` coverage/research/domains/articles → count-only status-summary.json → runtime·CURRENT-STATE | 입력 generatedAt max, humanReviewComplete/publicationReady false 강제. runtime contract/parity | 전체 1–51 |
| K16 | `scripts/build-atlas-current-evidence-ledger.mjs:14` facts+source registry → 날짜·URL·statement 있는 row만 정규화 → atlas/current-evidence-ledger.json → atlas evidence | asOf 보존, currentOperationalClaimsPublished=0. current-observations/currentness-separation | 전체 1–66 |
| K17 | `scripts/reconcile-atlas-taxonomy.mjs:18` relationship chains/crossEdges+domain packets+players/products+claims → upstream/downstream·ROOT/LEAF/BRIDGE·source IDs/currentness policy → taxonomy와 claims 원위치 | 없는 edge endpoint는 무시, 미확인 mapping 명시. revision 오늘 날짜. atlas-contract; 전체 file transaction 아님 | 전체 1–93 |
| K18 | `scripts/build-research-reference-index.mjs:12` supplied-materials corpus → boot metadata+claim IDs → src/domain/research/reference-index.js → route protocol bridge·screener lineage; full corpus lazy loader 별도 | --check exact text mismatch exit 1, 기본 호출은 write. research-model/research-flow contract | 전체 1–53; corpus 내용은 별도 미완료 |

## 검증 경계

새 실행 검증 없음. 외부 source 문서의 실제 내용·권리·freshness 검수, 각 원고의 정확성, 모든 lesson의 렌더링, 배포된 retrieval 결과는 미검증이다. 경로를 읽고 스키마가 존재함을 확인한 것을 의미 정확성 PASS로 바꾸지 않는다.
