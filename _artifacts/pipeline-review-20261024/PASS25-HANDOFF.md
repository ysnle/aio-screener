# PASS25 — 종목 해석·기업 설명·요청 시 종목 계산 연결 감사

2026-10-31 KST. 직접 판독, 제품 수정 없음. 아래 FULL은 파일 전체 판독이며 정상 판정이나 현재 배포 인증이 아니다. 앞선 PASS의 동시변경 한계를 유지한다.

## 판독 범위와 증거

전체 판독: src/domain/entity/{stock-read,ticker-symbol,out-of-universe-read,company-analysis,company-story,business-profiles}.js, src/domain/shared/{numeric-input,number}.js, src/data/{on-demand-symbol,company-profiles}.js, src/ui/components/company-story.js, scripts/{ci-company-profile-contract-check,sync-company-profiles}.mjs, _artifacts/company-profile-pilot-20261028/SCHEMA-v2.md.

연결 구간: src/ui/components/stock-read.js 255–320, src/app/compatibility-globals.js 245–305, src/domain/screener/factor-ranks.js 577–629 및 activeFactors 반환, src/ai/context/market-content.js 기업 context 연결. 이 파일들은 이번 구간 판독만으로 FULL 처리하지 않는다.

재현: `node _artifacts/pipeline-review-20261024/reproduce-pass25.mjs`, exit 0, 6개 반례 묶음. pass25-reproductions.json. 네트워크 없음, 주입된 reader만 사용. 현재 실데이터에서 모든 반례가 발생했다는 뜻은 아니다.

## P25-CACHE-01 — 유니버스 구성·모델 변경이 캐시에 반영되지 않음

on-demand-symbol.js universeKey는 rows.length와 가장 최신 factorSessionDate만 사용한다. [TEST]→[OTHER]로 동일 날짜·동일 개수 교체 시 TEST의 이전 in-universe가 계속 반환되는 반례를 재현했다. 요청 시 계산이 시작되지 않는다. ready 캐시도 동일 조건에서 과거 peer 구성을 유지한다. rankInputs의 사용자 가중치·regime·현재값 변경은 key에 없다. compatibility-globals는 실제 사용자 profile weights를 매 요청 시 공급하려 하지만 ready 캐시를 먼저 반환하면 공급 함수까지 도달하지 않는다.

또한 read 시작 때 rows를 붙잡고 remember 완료 때 universeKey를 다시 계산하므로, 요청 중 유니버스가 바뀌면 구 유니버스에 계산한 결과에 새 key가 붙는다. peek는 key 재검사를 하지 않는다. 실패 응답은 60초 후 재시도, 최대 동시 2개, listing/등록명 확인, provider 심볼 대조 등 보호는 정상이다.

개편: 종목 집합·artifact revision·모델/가중치 identity를 계산 시작 시 캡처해 결과에 부착. 종료 시 revision이 다르면 재계산 또는 이전 기준 참고로 표시. 가격/재무 재수집과 peer 재배치는 수명을 분리해 불필요한 재수집을 피한다. 회귀: 동일 개수 구성 교체, 같은 날 수정, 가중치 변경, 요청 중 새 유니버스, peek 후 load, 휴일 장기 탭.

## P25-STORY-01 — 새 보고서 미확인과 최신을 같은 상태로 처리

storyFreshness는 달력에 연구일 이후 보고서가 없으면 current를 반환한다. 연구일 없음과 2020년 연구·빈 달력 모두 current 재현. 정상 gate는 연구일 형식을 요구하므로 날짜 없음은 malformed runtime 후보이고, 빈/실패/조회기간 밖 달력은 별개 운영 경로다. UI는 stale일 때만 경고하며 연구일·실적기간은 표시하므로 날짜를 완전히 숨기는 문제는 아니다.

달력은 보고서 확인 근거이지 완전한 보고 이력 보증이 아니다. 과거 예정일이 지나면 actual이 없어도 보고된 것으로 간주하므로 취소·연기/미확인 일정은 반대 방향의 오판도 가능하다. 동일 연구일 보고서를 무조건 미반영으로 취급하는 규칙은 보수적이나 재조사 후에도 stale이 남을 수 있다. UTC today와 미국/KR 발표 시각도 구분되지 않는다.

개편: current/stale/unknown을 분리하고 profile에 반영된 report id·기간·발표시각을 기록. 달력 coverage와 수집 상태를 전달하고, 새 보고서 확인 이벤트로 재조사 대상 목록을 만든다. 최신 보고서가 발견되지 않았다는 사유만으로 최신을 인증하지 않는다. AI context는 저장된 연구 텍스트와 일반적인 '새 실적 우선' 문구만 받고 UI의 stale/newReport를 받지 않아 해석 근거가 갈라진다. 같은 freshness 판정을 텍스트에도 포함할 것.

## P25-STORY-02 — 같은 날 내용 정정이 index·탭 캐시에서 감지되지 않음

sync-company-profiles는 index revision을 symbol/name/file/researchedAt/period/layer의 목록으로만 해시한다. 매출·출처·설명 내용 정정은 revision을 바꾸지 않는다. requestCompanyStory 역시 have.researchedAt===entry.researchedAt이면 본문을 다시 받지 않는다. index 갱신이 성공해도 같은 날 정정은 열린 탭에 반영되지 않는다. entry 삭제 시 store의 이전 본문을 지우지 않아 companyStoryFor가 계속 반환할 수 있다.

개편: 각 본문의 내용 hash를 index row에 포함하고 그 hash로 캐시 검증. 요청 시작 revision과 응답을 대조. 제거/사용중단 항목은 저장된 본문과 AI context도 함께 무효화. source directory 복사는 파일별 즉시 덮어쓰기 후 검증하므로 잘못된 중간 파일에 실패하면 일부만 갱신된다. validate→staging→원자적 반영 흐름 제안. 실행은 하지 않았다.

## P25-STORY-03 — 금액·비중·출처 gate가 의미를 충분히 보장하지 못함

- moneyText(1,'USD mn')은 `0억 달러`로 반올림되어 양의 100만 달러가 0으로 읽힌다. 작은 단위 전환 또는 0.1억 미만 표현이 필요하다. 음수의 -0도 함께 회귀한다.
- segmentBars는 Number(s.share)를 검사하므로 명시적 null 비중이 0%로 출력된다. schema가 unknown=null을 요구하는 계약과 충돌한다. undefined일 때는 수집된 segment 합계로 비중을 산출하므로 일부 사업부만 수록하면 회사 전체 매출 비중처럼 과장된다. 분모·커버리지 표시와 총매출 대조 필요.
- amountScale은 단위 크기만 통일하고 통화는 환산하지 않는다. 여러 통화 항목이 섞이면 막대와 합계가 잘못된다. 현재 corpus 혼합통화 발생은 별도 실자료 확인 대상. useOfCash의 R&D/현금항목 중복, 회계기간 차이도 단순 합산 전 검증 필요.
- gate는 src가 있을 때 참조 id의 존재만 검사한다. 숫자의 src 필수성/상위출처 상속/실제 기간·본문 수치 일치/중복 source id는 보장하지 않는다. STEPS의 빈 객체·빈 배열도 대부분 통과한다. 'every number dated and sourced'라는 SCHEMA-v2 의미와 gate 보장은 다르다. gate PASS를 조사 검증으로 보고하면 안 된다.
- UI의 '다가오는 일정'은 현재 날짜로 필터하지 않고 정적 calendar를 전부 표시한다. 시간 경과 후 과거 이벤트도 다가오는 것으로 남을 수 있다. stale 안내는 숫자·가이던스만 이전 기준이라 설명하지만 경영진/경쟁/생산도 개편 시 바뀔 수 있어 항목별 재검토 조건 필요.

## P25-READ-01 — 동률을 모든 기간 뒤처짐으로 서술

stock-read의 compared에서 ahead는 gap>0만 센다. 세 기간 모두 동일 수익률인 입력에 '비슷'과 '모든 기간에서 지수에 뒤졌습니다'가 함께 나온다. ahead/behind/tie를 따로 세거나 동일 relativeBand를 일관되게 적용. 0/±미세값/기간 결측/혼합 동률 회귀 필요.

초기 의심 철회: domain 함수는 benchmark 날짜를 자체 확인하지 않지만 실제 stock-read UI는 factorSessionDate로 index를 자르고 일치하지 않으면 모든 return을 null로 만든다. SPY도 동일 session만 채택. 따라서 정상 화면에 '날짜가 다른 지수 비교'가 발생한다고 이번 감사에서 주장하지 않는다. row identity도 UI find(sym)로 보호된다. 다른 caller가 생길 때 domain boundary 보강 후보로만 남긴다.

## P25-READ-02 — 비활성 모델·계산 불가 이유를 하나로 설명

out-of-universe-read는 모든 inactive input을 '유효값80% 미만'으로 설명한다. factor-ranks는 기본 가중치0도 비활성으로 만들며 explicit 요청 실패/최소 peer 부족 등으로 rank가 없을 수 있다. rank null의 설명도 항상 종목 가중 입력80% 부족이다. 입력 부족과 사용자가 고르지 않은 요소, 모델 실패는 다른 사실이다. placement에 model reason/inactiveFactorReasons를 전달하고 원인별 문구를 만들어야 한다. fixture는 렌더 함수의 단일 원인 강제만 확인했고 전체 랭킹 실행의 반례로 확대하지 않았다.

## 식별·기업 모형·숫자 입력 추가 관찰

- tickerDisplayName은 명시한 .KS/.KQ를 무시하고6자리 코드만으로 이름을 붙인다. 005930.KQ에도 삼성전자라는 이름이 붙는 함수 반례. 실제 시세가 다른 발행사로 치환됐다고는 확인하지 않았다. normalizeTickerInput은 명시 suffix를 유지하므로 이름 확인도 동일 identity를 써야 한다. bare code의 resolver 미주입 시 .KS 기본값은 거래소 추정 후보이며 실제 bridge 주입과 분리한다.
- company-analysis는 symbol 일치·공식 FY·미래 공시 배제·현재 SEC status를 검사한다. KR 공시와 ETF 재무는 별도 상태. business profile은 issuer와 HTTPS source를 요구한다. 이 보호를 유지한다. fiscalHistory의 symbol이 없으면 허용하는 하위 계약과 annual 기간 연결은 PASS19 문제에 연결된다.
- businessProfileFor는 sourceUrl의 https prefix만 검사하고 company-analysis는 URL 객체/credential을 추가 검사한다. 전자는 'sourced', 후자는 'missing'으로 갈릴 수 있다. 업무적으로 출처가 실제 설명을 지지하는지 확인하는 검수는 두 함수 모두 대신하지 못한다.
- readNumericInput은 NaN/Infinity·범위·빈값·browser badInput을 구별한다. 모든 쉼표/공백을 제거하는 계약이므로 잘못된 자릿수 구분도 허용한다. 이는 한국/미국 숫자 입력 UX 후보이며 실제 오입력 발생 증거는 아니다. 안전정수 검사는 없지만 현재 cash/amount ceiling은 별도로 제공한다.

## 검증·남은 범위

이번 반례는 pure/injected 함수 수준, 브라우저/실서비스/외부 출처 사실확인 없음. 회사별 JSON 전부를 직접 의미 검토했다는 주장은 하지 않는다. 해당 corpus와 주기 갱신 운영은 후속 잔여 범위다. 제품 코드 개선, producer 실행, commit/push/deploy 없음.
