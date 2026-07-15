---
verified_by: Codex (official provider documentation + local pipeline execution)
last_verified: 2026-07-15
confidence: high
auto_refresh: false
target_version: v52.93
---

# 외부 데이터 의존성 대체 계획

## 결론

`전체 데이터 자동 최신화: 미완료`는 한 종류의 문제가 아니다.

1. **구조적 결함**: 파일 생성시각과 실제 관측시각 혼용, 실패 산출물 덮어쓰기, 한 공급자 응답을 현재값으로 승격, 라이브 모델과 백테스트 모델 불일치.
2. **구현 미완료**: 공식 API가 있지만 어댑터·정규화·수정공시·기업행위 처리가 아직 없음.
3. **운영자 의존**: API 키, 관리자 승인, 사용자 인증 세션이 필요함.
4. **권리/비용 의존**: 실시간 시세·옵션·한국 수급·설문은 무료 공개 API로 동등 대체할 수 없음.

따라서 API 목록만 늘리는 방식으로는 해결되지 않는다. 공급자마다 `수집 성공`, `관측시각`, `권리`, `커버리지`, `품질`, `의사결정 사용 가능`을 별도 상태로 관리해야 한다.

## 카테고리별 판정

| 카테고리 | 현재 경로 | 우선 대체 경로 | 판정 |
|---|---|---|---|
| 미국 시세/일봉 | Yahoo + Twelve 무료 폴백 | Stooq EOD 교차검증 후보 | 통합 실시간/NBBO 무료 동등 대체 불가, reference/EOD로 제한 |
| 미국 재무 | SEC companyfacts bounded batch + FMP 비기본 경로 | SEC companyfacts/frames/bulk ZIP + 자체 XBRL 정규화 | v52.93 무료 annual 정규화·누적 경로 구현, `SEC_USER_AGENT` 필요, TTM/전체 커버리지는 미완료 |
| 미국 매크로 | FRED | FRED/ALFRED + BLS/BEA/Treasury 공식 어댑터 | 자동화 가능, 현재도 연결됨 |
| 한국 매크로 | BOK ECOS/KOSIS 키 의존 | ECOS/KOSIS/data.go.kr 공식 어댑터 | 자동화 가능, 키·시리즈 매핑 필요 |
| 한국 EOD/기본정보 | Yahoo/Naver | KRX Open API | 승인키·출처표시·제3자 제공 제한 검토 필요 |
| 한국 실시간/수급/공매도 | Naver proxy 일부 | KRX/Koscom 또는 라이선스 벤더 | 무료 동등 대체 불가, 계약 영역 |
| 브레드쓰 | 일부 프록시/스냅샷 | AIO 유니버스 자체 계산; 추후 point-in-time 전종목 유니버스 | v52.92에서 일봉 기반 자동 계산 연결, 공식 거래소 폭은 아님 |
| Put/Call | Cboe 공식 일별 통계 server ingest + snapshot 최후 폴백 | Cboe Daily Market Statistics | v52.93 구현, delayed daily로만 사용, 실시간 옵션 지표 아님 |
| AAII/NAAIM/II | 주간 스냅샷 | 공식 라이선스/구독 또는 수동 검증 | 무료 동등 API 없음. VIX/F&G로 바꾸면 다른 지표임 |
| 뉴스/이벤트 | 다중 RSS + 선택적 Finnhub/NewsData | GDELT Event/GKG + 규제기관/기업 RSS | 무료 대체·중복화 가능, 본문 재배포 권리 분리 필요 |
| Telegram | 공개 웹/RSS mirror | 관리 채널은 Bot API; 임의 공개 채널은 승인된 MTProto/TDLib 세션 또는 라이선스 집계 | 익명 스크래핑은 운영 주경로로 부적합 |
| 옵션 체인/Greeks | FMP 등 선택 공급자 | 무료 동등 경로 없음 | education/reference 유지, OPRA/거래소 권리 필요 |
| 어닝/경제 캘린더 | Finnhub → FMP | SEC filing events + 기업 IR/공식 발표 일정 | 부분 자동화 가능, 단일 무료 소스로 완전 대체 어려움 |
| 한국 공시/재무 | 직접 확인 중심 | OpenDART 공시·재무·XBRL | 자동화 가능, 정정공시·연결/별도·기간 정규화 필요 |
| 암호화폐 | CoinGecko | 거래소 공개 API 다중 교차 또는 라이선스 통합 피드 | 대체 가능, 거래소·통화·시점 정규화 필요 |

## 목표 구조

관찰 가능한 상용 스크리너와 공식 차트 데이터피드 문서에서 공통으로 확인되는 패턴을 AIO에 맞춰 적용한다. 개별 업체의 비공개 내부 구현을 안다고 주장하지 않는다.

```text
Provider adapters
  -> immutable raw evidence (원문/응답 해시/수집시각)
  -> canonical normalized store (심볼·통화·단위·관측시각)
  -> point-in-time universe + corporate actions
  -> derived jobs (기술지표·팩터·브레드쓰·점수)
  -> quality/freshness/rights gates
  -> versioned JSON/API/cache
  -> 페이지·차트·AI 소비자
```

핵심 운영 원칙:

- 실시간 스트림과 EOD 조정값을 분리하고 장 종료 후 재조정한다.
- 원시값을 덮어쓰지 않고 정규화·파생값을 재생성 가능하게 만든다.
- `generatedAt`, `observedAt`, `attemptedAt`, `lastSuccessfulAt`을 분리한다.
- 공급자별 circuit breaker와 마지막 정상값을 쓰되, 오래된 값은 현재 판단에서 차단한다.
- 심볼/거래소/MIC, 통화, 주식분할·배당, 상장폐지, 생존편향을 point-in-time으로 관리한다.
- 팩터 산식·유니버스·가중치·백테스트 버전을 하나의 모델 manifest로 묶는다.
- 화면과 AI에는 동일 Evidence ID·관측시각·sourceKind를 전달한다.
- 공급자 가용성과 구현 완료를 구분하며, 권리 미승인 데이터는 공개 화면에 승격하지 않는다.

## AIO 적용 순서

1. **완료**: 스크리너 전용 갱신 경로, 50% 핵심시세 실패 전 덮어쓰기 차단, 일봉 기반 US/KR 브레드쓰, 관측시각·커버리지 게이트, 퀀트 연구전용 계약.
2. **완료(v52.93)**: GitHub Actions `SCREENER_ONLY` 독립 6시간 workflow, semantic artifact validator, 종목별 관측시각·출처·사용범위.
3. **부분 완료(v52.93)**: SEC companyfacts annual 정규화·bounded 누적 adapter. 저장소 변수 `SEC_USER_AGENT` 등록과 80% 누적 전 value/quality는 계속 비활성.
4. **완료(v52.93)**: Cboe 공식 일별 Put/Call server ingest. CDN/공용 proxy는 주경로에서 제외.
5. **다음 P1**: OpenDART 정규화 어댑터와 수정공시/연결·별도/기간 저장소.
6. **다음 P1**: BLS/BEA/Treasury 공식 원발표와 ECOS/KOSIS server adapter.
7. **조건부 P1**: KRX Open API 승인·표시·제3자 제공 조건 확정 후 EOD 경로 교체.
8. **보류**: 무료 동등 경로가 없는 미국 통합 실시간 시세/NBBO, 한국 실시간 수급, 설문, options chain/Greeks는 유료로 대체하지 않고 reference/education으로 유지.

## 무료 플랜 제약

기본 자동화는 무료·공식 경로만 활성화한다. FMP 유료 endpoint와 라이선스 vendor는 기본 GitHub Actions에서 제거했다. 무료 키나 운영자 식별이 필요한 SEC/OpenDART/ECOS/KOSIS/KRX는 `operator_required`와 `connected`를 구분하며, 키·승인 전에는 현재 데이터로 표시하지 않는다.

## 공식 근거

- SEC EDGAR API: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- FRED observations/realtime: https://fred.stlouisfed.org/docs/api/fred/series_observations.html
- KRX Open API: https://openapi.krx.co.kr/contents/OPP/INFO/service/OPPINFO004.cmd
- KRX 수신/계약: https://openapi.krx.co.kr/contents/OPP/DATA/OPPDATA003.jsp
- OpenDART: https://opendart.fss.or.kr/intro/main.do
- BOK ECOS: https://ecos.bok.or.kr/api/#/
- Cboe Put/Call: https://www.cboe.com/data/mktstat.aspx
- Telegram Bot API/MTProto: https://core.telegram.org/bots/api / https://core.telegram.org/api
- GDELT: https://www.gdeltproject.org/
- TradingView Datafeed: https://www.tradingview.com/charting-library-docs/latest/connecting_data/datafeed-api/

## 브라우저 플러그인 장애 기록

인앱 Browser 호출이 다시 중단됐으므로 이번 검증은 브라우저로 간주하지 않았다. 플러그인 캐시 폴더 삭제는 런타임 연결·앱 버전·세션 프로세스 문제를 해결하지 못할 수 있다. 이번 작업은 직접 HTTP, 로컬 Chromium/Playwright, JSON 계약 검사로 대체하며 Browser 복구 여부는 별도 제품/플러그인 진단 범위다.
