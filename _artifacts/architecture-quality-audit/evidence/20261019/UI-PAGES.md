> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# UI / 설명 계약 독립 감사

MODE: review · 대상 v58.20 / df6f0b33abd1c15c268d818efcbfc3c5547ed9b0. 범위 판정: df6f0b33 원문 30 FULL / 0 PARTIAL. PRE-EXISTING warning 5건. 최신 v58.50 판정은 포함하지 않음.

## 입증된 PRE-EXISTING finding

### UI-01 [warning] 선행 레슨을 모두 제거하는 정규식
- 위치: `src/ui/knowledge/concepts-view.js:283`.
- Trigger → failure: 원리 레슨 D6를 열면 artifact의 `D2 명목·실질금리`, `D3 기준금리와 시장금리`가 `/^[A-O]d{1,2}$/` 필터에서 탈락한다. 연결 열의 “먼저 알아둘 레슨”이 렌더되지 않는다.
- 호출 경로: principles.js의 lessonLibrary load → conceptsData() → renderConceptsPage()의 lesson 분기.
- Proof: `node _artifacts/architecture-quality-audit-20261019/reproduce-ui-pages.mjs`에서 현행 module body를 import하고 실제 lesson-library.json으로 D6를 렌더했다. 선언 2개, prerequisite heading false.
- 반론/도달성: 많은 기존 prerequisites는 문장이라 이 로직이 원래 링크하지 못하지만, D6의 2개는 실제 존재하는 D2/D3 ID이고 의도된 링크 대상이다. 현재 artifact로 재현된다.
- 최소 대안: `d`를 `\d`로 복구. artifact 문장 전체 재구조화는 이 결함 해결에 불필요.

### UI-02 [warning] 종목 요약 손익이 원가 통화를 무시
- 위치: `src/ui/pages/entity.js:244` (계산 244–245, 표시 253).
- Trigger → failure: 원가 통화 KRW인 AAPL 1주, 평균 원가 140000을 저장하고 USD 100 시세를 열면 `-$139,900 (-99.9%)`를 표시한다. USD 시세에서 KRW 원가를 직접 빼므로 단위가 성립하지 않는 금액이다.
- 호출 경로: js/aio-workspace.js:474–511의 원가 통화 입력/저장 → portfolio state holdings → createEntityPage render → renderTickerActivity. portfolio/surface.js:233,269–343은 같은 costCurrency를 인식해 환산 또는 보류하지만 entity는 이 계약을 우회한다.
- Proof: 위 audit-only 재현 스크립트가 현행 entity module body를 import하고 실제 렌더 함수에 정상 holdings shape를 넣어 결과를 assert했다.
- 반론/도달성: USD 원가/시세가 같으면 계산은 맞지만, 제품이 별도 원가 통화를 명시 입력으로 지원한다. 실제 저장 shape다. 브라우저 재현은 아직 미실시.
- 최소 대안: 이미 만든 portfolio surface의 동일 symbol 손익을 사용하거나 costCurrency/priceCurrency 불일치 시 환산 근거 없음을 표시하며 손익 보류. 별도 FX 계산기를 추가할 필요 없음.

## 증거 경계

보고/ledger/로컬 fixture 외 제품 코드와 데이터는 변경하지 않았다. 네트워크, producer, 유료 AI, commit/push/deploy 미실행. 위 proof는 mock DOM을 사용한 현행 모듈 headless 실행이며 실제 브라우저 PASS가 아니다. independence: limited (동일 모델 별도 reviewer).

### UI-03 [warning] 스크리너 해석의 샘플 signature가 유효 입력 변경을 무시
- 위치: `src/ui/pages/screener.js:1873` (skip 판정 1874).
- Trigger → failure: 행 수와 처음 5개 sym/screenRank를 유지한 채 나머지 상위권의 추세·고점 데이터를 새 immutable rows 배열로 갱신하면 표는 새 행을 렌더해도 “지금 순위가 말하는 것”은 이전 비율을 유지한다.
- 호출 경로: screener store slice 교체 → subscribeToSlices:2862 → renderWithControls:2853 → rerender(표) + renderRead → sampled signature return. 실제 해석 입력은 components/screener-read.js:66–72 → domain/screener/screener-read.js의 상위 20% 전체 행 pctSma50/adrPct/pctFrom52wHigh·sector 등.
- Proof: audit fixture가 페이지의 정확한 renderRead closure 원문을 추출 실행했다. 50행에서 첫 5행과 모든 순위를 유지하고 6–10위 추세·고점 데이터를 바꾸면 domain 해석은 100%→50%이지만 입력 2회에 renderer 호출은 1회였다.
- 반론/도달성: historyLoaded는 signature를 비우므로 해당 이벤트가 반드시 동반될 때는 가려진다. screener slice 구독과 refresh:done/liveQuotes 경로는 signature를 비우지 않으며, 행 수·첫5순위가 그대로인 데이터/비중 변경은 금지된 상태가 아니다. 행 객체를 교체한다는 모듈 자체 계약과도 일치한다.
- 최소 대안: immutable rows identity와 실제 metadata/validation/rotation/scenario input revision으로 무효화하거나 비교를 제거한다. 첫5행 샘플을 더 크게 만드는 것은 계약 해결이 아니다.

### UI-04 [warning] 산업 지도에서 개념/분석 노트 이동 시 선택이 소실
- 위치: `src/ui/pages/atlas.js:750` 및 751.
- Trigger → failure: 산업 지도 memory-dram-hbm 문서 연결 열에서 관련 노트 memory-optics 또는 개념 hbm을 누르면 principles 기본 페이지가 열린다. 요청한 문서 선택 mode/node가 중간에 지워진다.
- 호출 경로: industry-view.js relatedNotes의 버튼 → atlas onFrame/onConcept → history.pushState(mode/node) → route('principles') → root.showPage → legacy/compatibility-facade.js:278의 originalShowPage 선행 실행 → js/aio-core.js:18763–18771 부근의 plain-route query 정리 → principles mount가 null mode/node를 읽음.
- Proof: audit fixture가 현행 atlas callback 원문과 현행 legacy showPage의 history block 원문을 함께 실행했다. 양쪽 모두 최종 URL `https://example.test/aio/#principles`, parseKnowledgeRouteState의 mode/node가 null이다. memory-dram-hbm→hbm→memory-optics 연결은 현행 concept-surfaces/learning-core의 실제 연결이다.
- 반론/도달성: facade는 URL을 먼저 보존해 주지 않고 legacy 원본을 먼저 실행한다. root.showPage가 없는 host라면 route 자체가 동작하지 않으며 이 제품 경로는 showPage를 제공한다. 실제 browser navigation은 미실시.
- 최소 대안: 이 두 callback도 이미 있는 navigateKnowledgeRoute({ page:'principles', params:{mode,node} })를 사용한다. research-shell/glossary-bridge가 쓰는 동일 계약이므로 새 라우터 불필요.

## 읽기 범위와 판정 경계

기준 revision df6f0b33의 pages12개 + knowledge18개 = 30개를 모두 전문 읽었다. 각 파일 SHA256과 읽기 구간·개별판정은 ui-pages-reading.tsv에 저장했다. 후속 미독4개 완독 과정은 UI-PAGES-CONTINUED.md에 기록했다. FULL은 해당 원문을 모두 읽었다는 뜻이며 도메인·artifact 전체 의미 인증이나 브라우저 PASS가 아니다.

진행 중 작업트리가 v58.50으로 바뀌어 후속 읽기를 git show df6f0b33:path로 고정했다. 먼저 읽은 최신본의 공통부분은 재사용하고, baseline과 다른 삭제 원문은 diff에서 추가 전문 읽어 보정했다. 원장 SHA256은 마지막에 baseline Git blob bytes와30/30 일치했다. 현재 작업트리와는11개가 다르므로 findings는 고정 기준의 PRE-EXISTING 결과이며 최신 제품의 결함 지속 여부는 별도 재검증해야 한다.

## 구조 판단

- 전문 읽은 knowledge 렌더러는 대체로 textContent/명시 DOM으로 원문을 표시한다. URL을 갖는 외부 출처는 safe-external-link를 통하며 evidence.js의 직접 URL 경로는 registry의 trusted source contract를 추적해야 안전성 범위를 확정할 수 있다. 직접 URL이 있다는 사실만으로 XSS finding을 만들지 않았다.
- 가장 가치 있는 최소 정리는 두 중복 계약 우회 제거다. entity 보유손익을 portfolio domain surface와 공유하고, atlas 문서 이동을 이미 있는 knowledge-route helper로 통일하면 현재 입증된 잘못된 숫자/선택 소실을 고친다. framework/DI 도입이나 feature 제거는 근거가 없다.
- screener readSignature는 출력의 입력 책임을 샘플값으로 대체한다. 입력 revision/identity와 캐시 경계를 맞추는 국소 정리가 필요하다.
- 지식 문서 본문, 지도, 우측 연결은 분리돼 있어 DOM 조립 자체를 재작성할 근거는 찾지 못했다. prerequisite regex 문제는 선언한 domain 관계를 UI에 전달하는 한 줄 계약 결함이다.

## 실행 증거

`node _artifacts/architecture-quality-audit-20261019/reproduce-ui-pages.mjs` → 5개 case assertion 성공(D6, 통화손익, signature, atlas 2개 callback). 처음 2개는 현행 모듈 import + mock DOM, 나머지는 현행 소스의 정확한 closure/block 추출 실행이다. 모두 headless이며 브라우저 검증이 아니다.


## 종료 source hash 대조

원장30개 경로의 SHA256을 git show df6f0b33 blob bytes와 직접 비교: 30/30 일치. 작업트리가 변경된11개 파일은 기준 revision과 구분했다. 이 감사의 source 대상은 항상 df6f0b33이다.


### UI-05 [warning] 종목 역조회가 서로 다른 분기 신고가치를 같은 가격으로 대조
- 위치: src/ui/pages/masters.js:229–230 (괴리 표시241–242).
- Trigger → failure: 대가 보유 종목에서 AMZN을 역조회하면 2026-03-31 Pershing 신고가치를 2026-06-30 다른 운용사의 신고가치와 같은 비교집단에 넣는다. Pershing의 주당$208.27에 “다른 신고보다12.6% 낮음”을 붙이고 하단에는 정정 신고 여부를 확인하라고 한다. 보고 기준일이 달라 정상적으로 변할 수 있는 가격 차이를 신고 괴리/정정 점검 대상으로 잘못 해석한다.
- 호출 경로: loadOptionalArtifact(tickerIndex) → createTickerLookup → manager별 최신 reportPeriod 선택 → 모든 manager summaries의 impliedPrice를 단일 median으로 비교. UI는 각 운용사의 분기를 표시하지만 median 그룹을 분리하지 않는다.
- Proof: baseline ticker-index-reference.json49개 record 중8개가 manager별 최신분기 혼합이다. 실제 holdings-summary와 detectValueScaleSuspects/withholdSuspectValues/withholdManagerValues 및 요약행 merge를 그대로 적용한 AMZN 비교에서 median238.340000028915, Pershing2026-03-31의2385104083/11451981=208.27000001135175, gap=-12.616430315480077%였다. 다른 주된 운용사들의 기준일은2026-06-30이다. value-scale.js는 baseline과 현재 diff가 없음을 먼저 확인했다. 네트워크/producer 미사용.
- 반론/도달성: 값 단위 의심 행을 이미 보류하는 경로를 적용한 뒤에도 남는다. 각 행에 분기표시가 있어도 “다른 신고보다 낮음/정정 신고 확인”이라는 비교의 시간축 오류를 해결하지는 않는다. 실제 artifact 기반 계산 재현이며 브라우저 PASS는 아니다.
- 최소 대안: 동일 reportPeriod·동일 증권/수량단위의 직접 보유끼리만 median을 계산하고 충분한 같은분기 표본이 없으면 괴리 문구를 생략한다. 기존 분기 자체의 표시를 제거할 필요는 없다.

## 후속 미확정 후보

보관 실행 replay의 Why drawer가 activeResult.snapshotMetadata 대신 현재 store의 appliedFactorWeights를 읽는다(screener.js2062부근). 과거 가중치로 저장한 실행을 다른 현재 profile에서 재현하면 설명 기여분이 달라질 수 있다. source callchain은 확인했지만 실제 archived snapshot을 주입한 replay end-to-end 실행은 하지 않아 UNPROVEN이며5개 입증 finding에 넣지 않았다.

최초 audit-only fixture 실행은 v58.20 작업트리일 때의 증거다. 지금 재실행하면 최신 경로를 읽으므로 baseline 재현으로 취급하지 않는다. 최신 finding 재검증은 root 담당이다.
