> 2026-10-03 통합 메모: 이 보고서의 v56.99 · P1410–P1413은 이미 배포된 v56.99와 번호가 겹쳐 v57.06 · P1421–P1424로 다시 기록됐다(R681·R682 유지). 기록 원본은 `_artifacts/claude-continuation-20261001/fix-1421~1424.json`.

**공용 AI 전환 및 개인 데이터 API 검증 — 2026-10-03 17:44 KST**

로컬 v56.99 구현과 필요한 회귀 검증을 완료했다. 실서비스 전환과 전체 QA 성공은 아직 완료되지 않았다. 이번 작업에서 커밋, 푸시, 배포, 유료 AI 호출 또는 로컬 시장 데이터 생산은 하지 않았다. 스킬을 사용하지 않았다. 독립 Worker·클라이언트·Actions·확장 API 검토 결과를 통합했고, 최종 판단은 실제 코드·공식 문서·실행 증거에 근거한다.

**구현한 내용**

- 모든 앱 AI 생성 경로는 OpenAI `gpt-6-luna`를 사용하는 공용 Worker `/openai`로 통일했다. 채팅, 심층 응답, 뉴스 번역, Actions 분석이 같은 UTC 월 예산을 사용한다. 개인 AI 키와 다른 유료 제공자 우회 경로는 비활성화했다. 과거 저장 키는 삭제하지 않고 비활성 상태로 보존했다.
- 운영자 OpenAI 키는 Worker Secret이 소유한다. 브라우저에는 제공자 키를 전달하지 않는다. Actions는 별도 비공개 인증 토큰으로 Worker에 요청한다. 공개 앱 토큰과 Origin은 비공개 사용자 인증이 아니며, 남용이 있어도 전체 예산 상한을 넘는 예약은 거절하도록 설계했다.
- Durable Object의 원자적 월 예산은 최대 $10이다. 보수적 비용 예약 후 정상 완료·검증된 usage만 정산한다. 실패·중단·불명확한 사용량은 예약을 유지한다. 기존 예산 기록을 보존한다. 유료 AI 웹 검색은 사용하지 않는다.
- 실제 로컬 브라우저에서 개인 AI 키 입력칸 제거, 선택형 개인 데이터 설정, rss2json 입력 복원, 해제된 FRED 중계 동의를 확인했다. 배포가 보류된 AI는 ‘공용 연결 준비 중’으로 표시하고 실제 생성 경로도 차단한다.
- FMP 현행 API 매핑·필드 정규화·모든 실제 호출의 로컬 한도를 한 native 모듈로 모았다. 종목과 보고 기간을 보존하고, 분기 전망에는 `period=quarter`를 명시한다. 날짜가 없는 기관 보유·실적 통화 기록은 날짜를 추정하지 않고 보류한다. 신규 무료 계정의 유료 데이터 접근권을 만들어 주는 전환은 아니다.
- Twelve Data 지표 6개를 한 요청에 묶어도 6 credit으로 예약한다. 인증·한도 거절 이후 추가 호출 폭주를 멈춘다. RSS는 공용 Worker 원문 조회를 우선하고 실패 시 rss2json을 사용한다. 키가 없는 rss2json 요청에는 키가 필요한 count 옵션을 보내지 않는다. NewsData 무료 계정의 지연 가능성을 표시한다.
- 번역 중 들어온 새 기사는 대기열에 보관하고 다음 배치에서 처리한다. 기존 legacy 파일 크기 제한을 높이지 않았다. P1410–P1413, R681–R682와 실행 게이트를 기록했다.

**키의 소유자와 용도**

| API | 운영자 키 | 사용자의 개인 키 |
|---|---|---|
| OpenAI | GitHub 배포용 Secret → Worker Secret. 모든 앱 AI의 공통 예산 | 입력하지 않음 |
| Finnhub | Actions의 공통 일정 데이터 수집 | 선택적 추가 시세·뉴스·기업 자료 조회 |
| Twelve Data | Actions의 제한된 ETF 시세 대체 경로 | 선택적 차트·기술 지표 조회 |
| FRED | Actions의 공통 거시 자료 수집; 운영자 본인 조회 smoke | 개인 추가 조회 시 본인 키. 공용 중계는 명시적 동의 필요 |
| FMP | 현재 공통 수집·Worker 키 없음 | 선택적 본인 계정 조회. 무료 계정의 실제 허용 범위에 한정 |
| NewsData | 현재 공통 수집·Worker 키 없음 | 선택적 뉴스 보강. 무료 요금제는 지연 가능 |
| rss2json | 현재 운영자 키 없음. 공용 RSS 원문 경로가 우선 | 변환 대체 경로의 선택적 개인 키 |

따라서 여섯 개인 API를 모두 발급·입력해야 앱을 사용할 수 있는 것은 아니다. GitHub Secret 등록은 다른 사용자의 개인 연결을 설정하지 않는다. 기존 Worker의 FRED 운영자 Secret을 자동 삭제하지 않았지만 새 개인 조회 경로에서는 사용하지 않고 개인 키 없는 요청을 거절한다. BOK/KOSIS 운영자 중계는 별도 계약을 유지한다. 키 저장과 실제 호출 성공, 최신성, 계정별 데이터 접근권은 서로 다른 증거다.

FRED는 각 앱 사용자의 본인 키를 요구한다. 공용 중계에 동의하면 개인 키가 고정 FRED 조회 목적지로 전달된다. 중계 응답은 private/no-store이며 키를 로그·캐시·서버 저장소에 저장하거나 리다이렉트하지 않는다. [FRED 공식 키 정책](https://fred.stlouisfed.org/docs/api/api_key.html)

**월 $10의 의미**

공식 단가 기준으로 입력 20,000 token·출력 2,000 token의 응답은 약 $0.003이다. 5명이 하루 10번씩 30일 이용하면 채팅만 약 $4.50이다. 번역·자동 분석·추론·캐시 쓰기·오류 예약은 별도 소비이므로 이것은 총액 보장이 아닌 사용량 예시다. 앱은 예산이 소진되면 AI를 중단한다. 모든 기능을 무제한 계속 제공하면서 $10 이하를 보장하지 않는다. [GPT-6 Luna 공식 단가](https://developers.openai.com/api/docs/models/gpt-6-luna)

이 상한은 이 Worker를 통과한 앱 사용량에 적용한다. 같은 OpenAI 프로젝트를 다른 앱이 사용하거나 별도 유료 제품을 사용하면 이 장부가 그 청구를 막지 못한다. 전용 프로젝트와 제공자 측 $10 hard limit을 함께 설정해야 한다. 제공자의 한도도 진행 중인 요청에 따른 작은 초과 가능성을 별도로 설명한다. 실제 월 청구서는 아직 검증하지 않았다. [OpenAI 지출 한도](https://developers.openai.com/api/docs/guides/spend-limits)

**검증 증거**

| 증거 수준 | 결과 | 범위와 한계 |
|---|---|---|
| 정적·계약·워크스페이스 | 최종 affected: 103 PASS, 14 CACHED, 1 FAIL, 31 SKIP | run `2026-10-03T08-43-18-868Z-17032-atdkss`. 캐시는 동일 내용 해시의 이전 성공이며, 실패 1건 때문에 후속 단계 31개는 실행되지 않음 |
| Headless 런타임 | 1137/1137 PASS, 111개 그룹 | 최종 코드로 실행. 외부 CDN·시장 요청의 차단 로그가 있으며 실제 제공자 품질 검증은 아님 |
| Worker·개인 API 실행 fixture | PASS | 실제 구현을 사용한 모의 upstream: 예산·완료 응답·개인 FRED 동의·FMP 변환·가중 credit·RSS 대체·보류된 AI 차단 |
| Responses 브라우저 fixture | PASS, 오류 0 | PUBLISHED 구성과 완료 JSON/SSE를 모의 제공. 공용 채팅·상한·idempotency·대기열 번역 검증. 실제 OpenAI 답변 품질은 아님 |
| 로컬 실제 화면 | 확인 | 설정을 열어 개인 입력칸, AI 키 부재, FRED 동의 해제, ‘공용 연결 준비 중’ 상태 확인. 개인 키를 입력하지 않음 |
| 배포된 Worker 공개 health | 구버전 v56.91 | OpenAI provider/model 준비 증거가 없음. 실제 전환 완료로 판정하지 않음 |
| GitHub Secret 메타데이터 | OPENAI_API_KEY 등록, AIO_AUTOMATION_TOKEN 없음 | Secret 이름·등록 시간만 조회. 키 값은 읽지 않음 |

정적/계약 결과는 `.cache/aio-qa/runs/2026-10-03T08-43-18-868Z-17032-atdkss.json`, 브라우저·headless 로그는 `.cache/luna-public-route-final.log` 및 `.cache/luna-headless-final.log`에 있다.

**남은 차단과 미검증**

1. 기존 `public-data/data.json`의 거시 출처/최신성 짝이 맞지 않아 artifact-semantics 게이트가 실패한다. 파일의 Git blob은 HEAD와 동일한 `9f1e0b687adc137a3f888c9154418b2798a3a060`이다. 생성 코드의 이전 수정과 별개로 실제 산출물은 승인된 GitHub Actions 생산 경로에서 갱신해야 한다. 생성 데이터를 손으로 보정하거나 게이트를 완화하지 않았다.
2. Actions 인증용 `AIO_AUTOMATION_TOKEN`을 GitHub Secret에 별도 등록해야 한다. 32자 이상의 충분한 난수 토큰이며 OpenAI 키와 다른 용도다. Worker 배포 절차가 이를 동일한 Worker Secret으로 공급한다. OPENAI_API_KEY 등록만으로 Worker가 전환되지는 않는다.
3. 현재 커밋·푸시·배포는 수행하지 않았다. 별도 명시적 요청 후 release QA와 CI-attested SHA 경로를 따라야 한다. 구버전 Worker를 새 코드의 성공 증거로 사용하지 않는다.
4. 실제 각 무료 계정의 접근 가능한 데이터, provider quota header, 관측 시각, 응답 품질과 표시·재배포 권한은 미검증이다. 특히 FMP 무료 계정은 현행 endpoint라도 기능별 제한이 있고, 표시 권한은 별도 조건이 있다. 가족·지인용이라는 사실만으로 모든 데이터 표시 권한이 확정되지 않는다. 유료 플랜은 구매하지 않았다. [FMP 요금·표시 조건](https://site.financialmodelingprep.com/pricing-plans), [FMP 현행 API](https://site.financialmodelingprep.com/developer/docs/quickstart)
5. Twelve Data의 로컬 가중 credit 가드는 다른 기기·앱의 계정 전체 사용량 또는 분당 한도까지 보장하지 않는다. RSS와 뉴스의 출처 접근 가능성, 정확성·지연·수집 권한 역시 실제 제공자 증거가 필요하다. [Twelve Data credit 정책](https://support.twelvedata.com/en/articles/5615854-credits), [rss2json 옵션](https://rss2json.com/docs), [NewsData 요금제](https://newsdata.io/blog/pricing-plan-in-newsdata-io/)

이번 결과는 ‘로컬 구현과 해당 회귀 검증 완료’다. 전체 코드베이스의 의미 검토 완료, 모든 실제 API의 완벽한 활용, 배포 완료 또는 투자 판단에 사용할 데이터 품질 인증으로 확대하지 않는다.
