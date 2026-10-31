# PASS10 — 공통 artifact 로딩에서 시나리오·포트폴리오 표시까지

2026-10-28 / cstack review / v59.42 관측 / 에이전트 없이 주 담당자 직접 수행.
Important 0 · Pre-existing 2. 제품 수정 없음. 전체 전수 의미 검토는 진행 중이다.

## P10-STATE-01 — 다운로드 최신성과 관측 최신성 혼동, 상태 검증이 소비자마다 다름

ACT ON / medium / 실제 loader·domain·view-model 재현. 이전 감사의 LKG 상태 문제와 같은 결함 계열이지만, 이번 범위는 shared-artifacts → scenario-state → 테마·보유 종목 소비 경로다.

근거: `src/data/shared-artifacts.js:10`은 loadedAt/서버 generatedAt으로 재다운로드 여부를 판단하고 :40은 schemaVersion만 검사한다. :44는 응답 수신 시각을 loadedAt으로 기록한다. sharedArtifactState(:19)는 payload가 있으면 ready다. 이는 네트워크 캐시 정책으로는 가능하지만 관측 최신성을 보장하지 않는다. `theme-stage.js:12`도 status=current만 검사한다. `theme-playbook.js:302`의 fallback은 playbookVersion만 확인한다. `portfolio-checklist.js:106`은 themes를 직접 읽어 상태 검사를 우회한다.

재현: 외부 네트워크 대신 주입한 Response가 schema와 playbookVersion은 맞고 generatedAt/basis는2020-01-01인 자료를 반환했다. 실제 refreshSharedArtifact 호출 후 ready, reloadNeeded=false였고 themeStagesFor는 약세 단계1건, themeRotationRead는 옛 회전 문장, thesisRows는 ‘테마 단계 약함’을 반환했다. 자료 status만 pending으로 바꾸면 공통 themeStagesFor는0건인데 회전과 보유 종목 경로는 계속 해당 상태를 반환했다. 원본 publication status와 cadence/session admission이 서로 다른 계약이라는 사실을 보여 준다.

도달 경로: macro-crossroads.js:338의 themeLines가 live playbook이 없으면 artifact를 사용한다. :341 이후 표시 문장은 테마 설명과 1개월 수익률을 조합하며 해당 fallback의 기준일을 추가하지 않는다. portfolio-checklist.js:144는 signals를 ‘켜진 신호’로 표시한다. 연구 라이브러리 theme-stage-links.js:14도 상태 검사 없이 읽고 :36은 행이 아예 없을 때만 refresh를 호출한다. 행이 있으면 재진입 때에도 이 함수 자체는 TTL을 확인하지 않는다. 다른 화면의 refresh가 갱신해 줄 가능성은 있으므로 모든 세션이 무조건 영구 stale이라고 주장하지 않는다.

영향: producer/배포 갱신이 멈췄거나 오래된 응답을 받은 경우, 읽기에 성공했다는 사실만으로 과거 테마 단계가 현재 논지 점검에 들어갈 수 있다. 현재 운영 자료가 실제2020년이라는 뜻은 아니며, 배포·브라우저 발생 빈도는 미확인이다.

개편안: 로드 상태(loading/failed/ready)와 관측 사용 가능 상태(최신/지연/참고/없음)를 별도로 반환한다. 공통 시나리오 reader가 시장별 basis와 최신 완료 세션, payload 상태, 모델 버전을 함께 판정하게 하고 모든 소비자가 이를 사용한다. 참고 상태는 마지막 날짜와 함께 보존하되 현재 신호 충족 수에는 넣지 않는다. 주간 과거 빈도 artifact에는 일일 시나리오와 다른 cadence를 적용한다. 기본 회귀 사례: 오래된 payload를 방금 수신, pending payload, 실패 후 LKG, US/KR 서로 다른 완료 세션, 모델 버전 불일치, 연구 화면 단독 재진입.

## P10-PF-02 — 관측이 없어서 검사하지 못한 경우도 ‘신호 없음’

ACT ON / medium / 실제 thesisRows 반환 및 renderer 소스 확인, 브라우저 미실행.

`src/ui/components/portfolio-checklist.js:111`은 signals=[]에서 시작한다. 가격·테마·컨센서스·실적일이 없으면 각각 아무것도 추가하지 않고, 반환 객체에는 checked/unknown 범위가 없다. :144는 배열이 비어 있으면 ‘신호 없음’으로 출력한다. 반면 같은 파일의 portfolioCriteria는 unknown 개수를 명시한다.

재현: 평가액100의 합성 종목 AUDIT 한 개, root={}, bySymbol 기본 빈 Map을 실제 thesisRows에 전달하면 signals=[]다. 가격·테마·전망·달력 자료가 전혀 없는 상황이 정상 검사 후 경고0개와 같은 표현으로 이어진다. 이 입력은 초기 로딩·자료 없는 종목에서 가능하다. 결측을 0으로 보여 주는 것이 아니라 ‘검사 결과 없음’을 ‘경고 없음’으로 의미 변환하는 결함이다.

보강안: 각 검사에 met/not-met/unknown과 기준일·사유를 반환하고, ‘확인한 n개 중 신호0, m개 미확인’으로 표현한다. 모든 검사가 unknown이면 확인 불가 또는 자료 대기로 표시한다. null pctSma50을 Number로 변환하는 코드도 있으나 이 경로는0을 경고로 세지 않으므로 독립 숫자 오류로 추가 집계하지 않는다. fresh negative 값, 정상 관측 후 신호0, 전체 결측, 일부 결측, 공급 실패를 구분하는 회귀 fixture가 필요하다.

## 파일별 판독 및 정상 계약

이번에 본문 전체를 직접 읽은 파일:

| 파일 | 연결·의미 검토 |
|---|---|
| src/data/selectors/interpretation.js | native store 등록·해제, bridge fallback, runtime 입력 수집, 객체 참조 및 분 단위 cache signature |
| src/data/selectors/market-inputs.js | credit/rates 입력과 개별 관측일, S&P500 폭 segment 수집 |
| src/data/shared-artifacts.js | TTL, server generation, 요청 병합, 실패 후1분 재시도 제한, schema 검사, LKG |
| src/data/artifact-cache.js | fetch identity 격리, integrity/크기별 cache key, LRU, consumer별 abort, header/body deadline 구분 |
| src/platform/http.js | 외부 abort 전달, 상태 코드 보존, stream stall, timeout 결과 envelope |
| src/data/consensus-estimates.js | 공유 artifact 요청 및 symbol별 단순 조회 |
| src/ui/knowledge/theme-stage-links.js | 연구 문서에서 테마 단계 읽기, 초기 fetch 후 text 갱신, 테마 링크 |
| src/ui/components/portfolio-checklist.js | 원칙 기준 충족/unknown 집계, 보유 논지의 네 종류 신호, 비동기 갱신 수명 |

macro-crossroads.js는 :300 이후 renderMacroCrossroads 후반·themeLines·compact 렌더를 읽었으며 파일 전체 판독으로 세지 않는다. theme-stage.js는 이전 전체 판독에 더해 이번에 다시 읽었다. AI가 사용하는 interpretation selector는 확인했지만 AI context 직렬화와 실제 응답 문구까지 이번 결과로 인증하지 않는다.

정상 확인: artifact cache는 URL뿐 아니라 integrity/크기 제한을 key에 포함한다. shared request에서 consumer 한 명의 abort와 마지막 consumer의 abort를 구분한다. HTTP는 비JSON 오류 응답의 HTTP status를 보존하는 경로가 있다. 이들은 소스 판독 확인이며 모든 경합·네트워크 동작 테스트를 통과했다는 뜻은 아니다.

추가 후보(미확정): maxBytes는 본문 전체 수신 후 검사하므로 전송·누적 메모리 자체의 streaming 상한은 아니다. HTTP stream stall은 다른 요청의 진행 시각도 참고해 한 요청의 정지를 더 오래 기다릴 수 있다(혼잡 링크를 고려한 명시된 설계). 현실적인 실패·영향 재현 전 신규 결함으로 세지 않는다. sharedArtifact의 changed는 generatedAt만 비교하므로 같은 시각의 내용 교체는 repaint를 발생시키지 않을 수 있으나 producer 계약과 실제 도달성을 확인해야 한다.

## 증거·남은 작업

`node _artifacts/pipeline-review-20261024/reproduce-pass10.mjs` exit0, 주입한 응답1회. pass10-reproductions.json에 관측 결과 저장. 제품 producer와 외부 fetch, 브라우저, 배포는 실행하지 않았다. baseline은 pipeline-review-pass10-20261028이며 소유 파일을 명시해 QA한다. 제품 코드·공개 데이터·정책·버전은 변경하지 않았다. commit/push/deploy 없음.

남은 연결은 AI context/응답의 freshness 전달, 재진입·장시간 탭 갱신, 현재 artifact 영향 집계, 이전 판독 이후 변경된19개 파일 재검토 및 파일 대장의 미대조 항목들이다. 이 문서는 전수 완료 보고가 아니다.

QA 결과: affected `2026-10-28T03-05-19-322Z-37008-s3rc3l`는 preflight pass3/cached9/fail0. 별도 fixture 구문 검사와 감사 폴더 git diff --check도 통과했다. generated-state는 현재 cache PASS였으며 이 감사에서 생성 문서를 고친 것은 아니다. runner는 다른 실패 batch `2026-10-28T02-54-04-647Z-28776-ti1pfd`를 이번 범위가 모두 덮지 않아 보존했다고 알렸다. 그 batch의 해결이나 전체 저장소 QA 성공을 주장하지 않는다. 현재 파일 대장 관측4519개 중4392개는 이전 증거와 파일별 미대조 상태다.
