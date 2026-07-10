# FABLE 라이브 전수 감사 — 2026-07-04 (Sonnet 5 인계용)

> **작성**: Fable 5 (진단 전용 세션, 코드 무수정). 라이브 사이트 `https://ysnle.github.io/aio-screener/` v52.4 기준, 2026-07-04 21:00~23:00 KST 실측.
> **범위**: ① GitHub Actions 인프라 ② 라이브 데이터 산출물 8종 ③ 22/22 페이지 헤드리스 시각 검토 + 인터랙션(티커/기업분석 검색, 스크리너 정렬·고급필터, AI 채팅 패널, 모바일 390px) ④ 로컬 헤드리스 스위트(skip-list 밖 실패 0 확인).
> **방법론 주의**: 정적 분석 아님 — 전 항목 라이브 실화면/실로그/실페이로드 실측 (PAGE-UX-AUDIT 오탐 사태 재발 방지, P·v50.50 참조). 스크린샷 원본은 Fable 세션 스크래치패드에 있었음(휘발) — 재현 방법은 각 항목에 명시.
> **상태(2026-07-10, WO-8/P669 문서 현재성 패킷에서 추가)**: **P0~P3, P5, P6 전부 코드로 해소됨**(P602/P603/P609/P610/P604~608/P611~616 — 상세는 루트 `CLAUDE.md` v52.7~v52.15 요약과 `_context/BUG-POSTMORTEM.md` 각 P번호 참조). **P4(FMP 키 플랜 오류)는 운영자 액션 항목**이라 코드로 해소되는 성격이 아니며, 사용자가 "현행 UX 유지"로 명시적으로 확정(컬럼 숨김 등 대안 미채택) — 이 역시 open이 아니라 결정에 의해 closed로 분류. 이 문서 자체의 발견 목록은 **전부 resolved/closed-by-decision**이며 추가로 열려 있는 항목 없음.

---

## P0. [인프라·근본원인] workflow_run 배포가 항상 "한 사이클 전" 트리를 배포

**실증 체인**:
1. 2026-07-04 11:56:57Z refresh-data run이 새 데이터 커밋 `1df0078` push (data.json generatedAt 11:57:08Z)
2. 11:57:21Z CI(workflow_run) 발화 → deploy job 성공 (11:57:35~47Z)
3. **deploy job 로그 실측: `ref: 34646a82…` 체크아웃** — `1df0078`이 아니라 refresh run이 *시작될 때의* 커밋
4. 결과: 라이브 data.json은 Last-Modified 11:57:41 GMT(새 배포)인데 내용은 **10:27 산출물** (배포 자체는 성공했으나 낡은 트리)

**원인**: `.github/workflows/ci.yml`의 3개 job(validate/headless-tests/deploy) 공통 `ref: ${{ github.event.workflow_run.head_sha || github.sha }}`. `workflow_run.head_sha`는 트리거한 run이 **push한 커밋이 아니라 그 run이 출발한 커밋**. 봇 사이클 N의 CI는 사이클 N-1 데이터를 배포·검증한다.

**파급**:
- cron 실발화가 30분이 아니라 실측 1.5~4.2h 간격(아래 P2)이므로 라이브 신선도는 최악 **~8h 지연**
- 7/4 워치독 실패 2건(07:17Z·09:32Z)의 실원인 — deploy-pages 간헐 실패(P601)와는 **별개의** 원인
- P591의 "workflow_run 경로 검증 완료"는 "배포가 돈다"까지만 유효했음. "무엇을 배포하는지"는 이번에 처음 검증됨
- validate도 같은 ref → 새 데이터 커밋은 구문 검증조차 안 거침

**수정 방향(제안)**: workflow_run 이벤트일 때 checkout ref를 `github.event.workflow_run.head_branch`(= main 브랜치 헤드)로. 3개 job 각 1줄. push/PR 이벤트 경로는 무변경. 수정 후 검증: 다음 봇 사이클에서 `gh run view <ci-run> --log | grep "HEAD is now"`가 그 사이클의 데이터 커밋 SHA인지 + 라이브 data.json generatedAt이 같은 사이클인지 확인.

## P1. [기능 사망] 뉴스 번역 파이프라인 — 전 페이지 "[번역 대기]"만 노출

- signal/macro/briefing/sentiment/breadth/fxbond/technical/fundamental/themes 등 **뉴스 블록이 있는 모든 페이지**에서 뉴스 항목이 `[번역 대기] 지정학 · Yahoo Finance 기사 · 중요도 49 (25h)` 형태로만 렌더 — **헤드라인 원문조차 표시 안 됨**. 18~36시간 지속 = 일시 현상 아님
- 서버 키 모드는 살아있음(사이드바 쿼터 UI "일일 51회 · 남은 횟수 51회" — **오늘 소진 0인데도 번역이 전부 대기**) → 쿼터 고갈이 아니라 번역 호출 경로 자체가 실행되지 않거나 실패 중
- 용의 경로: `autoTranslateNews`의 `_aioClaudeTarget` 서버키 라우팅(v50.53 2C, CF Worker `/anthropic`) — Worker 측 오류/KV 캡/CORS, 또는 부스트 뉴스 즉시 번역 요청(P554/R245)의 조건 미충족
- **이중 결함**: 번역 실패 시 v50.95 `_aioBuildNewsLocalKoreanInsight` 폴백(한국어 요약 생성)이 이 뉴스 리스트 표면에는 적용되지 않고, 원문 헤드라인 표시 폴백도 없음 → 번역 죽으면 뉴스 기능 전체가 죽는 구조
- 브리핑 페이지 "핵심 뉴스" 섹션도 동일 — 브리핑의 핵심 가치 사라진 상태

## P2. [인프라] "30분 cron"의 실발화는 1.5~4.2시간 간격

- `refresh-data.yml` cron 정의는 `17,47 * * * *`(정상)이나 GitHub 스케줄러 스로틀링으로 최근 48h 실측 간격 1.0~4.2h(중앙값 ~1.8h)
- 코드로 완전 해결 불가(GitHub 무료 러너 특성). P0 수정 시 체감 지연이 절반으로. 문서의 "30분마다" 서술(CLAUDE.md 등)은 "30분 cron 정의·실발화 1~4h"로 정정 권장
- 워치독 360min 임계는 P0 수정 후에도 간헐 걸릴 수 있음(4.2h 간격 + 배포 실패 겹치면) — 임계 조정 논의는 P0 수정 후에

## P3. [하드 브레이크] kr-technical: TradingView 위젯 사망 + 진입 시 오류 모달

- 페이지 진입 즉시 **"TradingView 에서만 제공되는 심볼입니다" 모달**이 뜨고, 차트는 `KRX:005930 · 시0 고0 저0 종0 0 (0%)` + 붉은 X 빈 상태 (헤드리스 실화면 재현 100%)
- 원인 추정: TradingView 무료 embed의 KRX 데이터 제공 중단/제한 (KRX는 TV에서 유료·거래소 계약 데이터)
- 방문자 전원이 오류 팝업을 강제로 봐야 함 — 22페이지 중 유일한 하드 브레이크. 위젯 심볼 변경(KRX→다른 소스), 위젯 제거+자체 캔버스 대체, 또는 실패 감지 시 위젯 숨김 필요

## P4. [운영자 액션] FMP 키 플랜 오류 → 밸류/퀄리티/어닝 전멸

- `screener.json`: `fmpHasKey:true, fmpOk:false, fmpCount:0, fmpPlanError:true` — 키는 등록됐으나 403/401 플랜 오류
- 가시 결과: 스크리너 873행 × 밸류·퀄리티 2컬럼 전부 "—"(대시 셀 총 ~4,120개), ticker cockpit KEY METRICS(Market Cap 등) "—", 활성 팩터 5개로 축소
- 앱의 정직 표시(v51.65 배너·컬럼 헤더 경고)는 정상 작동 중. **운영자가 FMP 대시보드에서 키/플랜 확인 필요** (코드 작업 아님). 복구 전까지 밸류/퀄리티 컬럼 숨김(또는 "FMP 필요" 1컬럼 축약)이 나은 UX

## P5. [신뢰 훼손] 콘텐츠 정확성·정합성 결함 목록

| # | 위치 | 증상 | 비고 |
|---|------|------|------|
| 5a | macro 헤더 + briefing 일정 | **"BLS NFP 2026-07-05" — 일요일** (불가능한 발표일) | 캘린더 auto-advance 로직 오류. T759는 이 값을 통과시킴 — 요일 검증 없음 |
| 5b | kr-technical·kr-home | **VKOSPI 27.00 (공포)** 정적 폴백 vs 실제 정상 구간(~15-17) | skip-list 잔여 T278/T422의 가시적 피해 — 사용자에게 잘못된 공포 신호 |
| 5c | themes 한 화면 내 | 우상단 칩 "**Late Cycle · 방어 주도**" vs 본문 "동적 사이클 판정: **Mid Cycle (Expansion)**" 동시 표시 | 정적 칩 vs 동적 판정 이원화 — 소스 단일화 필요 (R265 계열) |
| 5d | briefing 스코어 스트립 | "F&G —" (같은 시각 홈·sentiment는 32 표시) | 스트립의 F&G 배선 누락 |
| 5e | briefing 헤더 | "…7월 FOMC 공식 일"에서 문장 중간 잘림(말줄임 없음) | verdict 문자열 truncation 처리 |
| 5f | ticker cockpit | 포트폴리오 미등록 신규 방문자에게 "**Your P&L: +$6,633 (+46.4%)**" 표시 | 데모/시드 데이터 누출 의심 — 같은 세션 portfolio 페이지는 전부 "—"(빈 상태 정상)여서 모순. 소스 확인 필요 |
| 5g | sentiment | NAAIM(5-28)·투자전문가 황소/곰(5-27)·AAII(5-27) **5주+ 정적** + "수동 갱신 필요" | 표시는 정직함. /data-refresh 백로그 |
| 5h | market-news 피드 | 동일 SK하이닉스 ADR 기사가 채널만 다르게(Aether-JP/Insider-US) 연속 2건 중복 노출 | 크로스채널 dedup 미비 |
| 5i | theme-detail | 브레드크럼 "AIO/테마/—" (테마명 대신 대시) · "주요 AI ETF" 표에 NVDA(개별주)가 holdings "Self"로 포함 | 소소한 데이터/라벨 정리 |
| 5j | screener 가격 컬럼 | 모멘텀 정렬 시 상위 랭크 행(BE/MRNA/AFRM 등) **가격 전부 "—"** — 라이브 시세가 ~85심볼만 커버, 나머지 788종목은 가격 공란 | FMP와 무관한 별개 공백. screener.json에 서버 종가 포함(fetchHistory 마지막 종가 재사용) 검토 가치 |
| 5k | signal 지수 카드 | 휴장일(7/4)에 S&P "+0.00%" vs NASDAQ "▼-0.80%" 동시 표시 — 같은 행에서 상태 불일치 + 0.00%가 "보합"으로 오독됨 | 휴장 감지 시 "휴장" 라벨 대체 검토 |
| 5l | technical SPY 포지셔닝 카드 | 내부 통계 "3M 수익 0.0% · RSI 50.0" — 정확히 기본값 형태라 미계산 의심 (0.7%/-1.8%는 계산됨) | 실측 필요: `calcTechnicalSnapshot` 소스별 값 대조 |
| 5m | sentiment HY 카드 | HY 스프레드 패널 "Live: 289bp" vs 같은 세션 `DATA_SNAPSHOT.hySpread` 275bp | 낮은 확신 — 측정 시점/시리즈 차이 가능. 소스 단일화 여부만 확인 |

## P6. [UX 구조] 운영자 표면과 사용자 표면의 미분리 (디자인 총평의 핵심)

- **홈 중앙 경고 pill 11개 연속**(FMP + 수동 매크로 8종 경과 + SMA): 개별 기능은 설계대로나 합산 결과는 "고장난 시스템" 인상 + 알람 피로. → 1줄 요약+펼치기 또는 운영자 모드 게이트 제안
- **PUBLIC STATUS 카드에 영어 내부 감사 로그 원문 노출**: `deployment: full surface audit fail: 22 issue(s) · deep review audit fail: 2 issue(s) · weak page evidence ticker:UNAVAILABLE, …` — T776(dev 마커 누출) 계열인데 이 표면은 게이트 미포착. 일반 사용자에게 무의미+불안 유발
- **페이지 전환 시 섹션 제목에 파란 포커스 테두리** 상시 노출(전 페이지, 스크린샷 9/12에서 확인): a11y 포커스 관리의 부산물. `:focus-visible`로 전환하면 키보드 사용자 보호 유지하며 해소
- **AI 채팅 패널 초기 상태가 완전 공백**: 페이지별 페르소나 제목/하단 칩은 좋으나 본문이 텅 빔 — 첫 안내 메시지/컨텍스트 요약 1줄이면 개선. 부수 관찰: fundamental에서 자동 채워진 프롬프트("NVDA 종합 기업 분석해줘…")가 다른 페이지 채팅 입력창에 그대로 남아 따라다님
- 기술분석 SPY 포지셔닝 카드 반폭 배치(우측 공백), sentiment VIX 미니카드 옆 대형 공백 — 그리드 불균형 2건
- 운영자 노트(홈 최상단 고정)가 4일 경과(6-30) 상태로 노출 — 노트에도 경과일 배지 제안
- 모바일(390px) 상단바 우측 버튼 텍스트 잘림("완료"→"완") — 상단바 좁은 폭 대응
- 같은 텔레그램 상위 아이템 3~4건(트럼프 포트폴리오/청와대 대도약/JPM 반도체)이 home·signal·macro·sentiment·breadth·fxbond 6개 페이지에 동일 반복 노출 — 페이지 태그 필터가 있으나 상위 스코어 항목이 전 태그에 걸쳐 있어 페이지별 차별성 희석 (설계 판단 사안)

## 양호 확인 (회귀 아님 — 재작업 불필요)

- 가시 텍스트: undefined/NaN/[object Object]/깨진 한글/dev 마커/로딩 잔류 **22페이지 전부 0건**
- 가로 오버플로 0(데스크톱 1440 + 모바일 390), 모바일 홈 스택 재배치 정상
- 결론-우선 헤더 + 데이터 등급 + 신뢰도 % 22페이지 일관 — 최대 강점
- 스크리너: 873행, 정렬(모멘텀 클릭 → 순서 변경 실측), 고급 필터 열림, KPI 바 정상
- 티커 검색(NVDA→콕핏 렌더), 기업분석 검색(접수+정직한 로딩), 수급/kr-themes 폴백 경고 정직
- sentiment 하부 차트 전부 렌더(F&G 게이지·VIX 기간구조·NAAIM·황소곰·HY·AAII·풋콜) — "blank canvas 21개"는 숨김 차트 풀로 판명(가시 blank 0에 준함)
- options 페이지 폐기 안내 명확, 사이드바에서 이미 제거됨
- B2 신설 FRED 3종(주택착공/소매판매/임금) 서버 공급 + macro 페이지 실렌더
- telegram-digest v52.1 다이어트 라이브 반영(0.66MB, items 필드 없음), broadItems 360 주입
- 로컬 헤드리스 스위트: **skip-list 밖 실패 0** (896/921 베이스라인 유지)
- deploy retry 스텝(v52.4) 정상 배선(1차 성공 시 skip 확인). 실전 발동 사례는 아직 없음
- F&G asOf 36h(7/3 00:59Z)는 미 독립기념일 휴장 전 마지막 CNN 갱신 — 무해 (fearGreedOk:true)
- `backtest-history.json` 일별 upsert 누적 시작(7/3·7/4 — 설계대로), `score-backtest-history.json` 표본 자동 성장(n5d 19→20, n21d 3→4), `statisticallyMeaningful:false` 정직 유지
- 관찰만: 11:56Z refresh run에서 telegram-digest는 재생성 안 됨(10:27 유지) — 커서 스로틀(P571/R262) 특성일 가능성. P0 수정 후 재관찰

## 권장 작업 순서 (Sonnet 5)

1. **P0** ci.yml checkout ref 수정 (3줄) → 다음 봇 사이클로 실검증
2. **P1** 번역 경로 사망 원인 규명(CF Worker `/anthropic` 응답 실측부터) + "번역 실패 시 원문 헤드라인 표시" 폴백 (P1은 원인 불명 상태이므로 조사 먼저, 수정안 확인 후 진행)
3. **P3** kr-technical TradingView 실패 처리 (모달 억제 + 위젯 폴백)
4. **P5a/5b/5d/5e** 콘텐츠 정확성 4건 (각각 소규모)
5. **P6** 홈 경고 pill 접기 + PUBLIC STATUS 내부 로그 분리 + focus-visible (UX 설계 판단 필요 — 사용자 확인 권장)
6. **P4·P5g** 운영자 액션 안내 (FMP 키, /data-refresh로 심리지표 수동 갱신)
- 각 항목 R1 버전 동기화·R3 사후분석·헤드리스 재실행은 기존 규칙대로

## 커버리지 명세 (이 감사가 본 것/못 본 것)

- 봄: 22/22 페이지 데스크톱 실화면, sentiment 하부 2구간, 인터랙션 6종, 모바일 홈 실화면 + screener/signal 오버플로 수치, 콘솔 에러(7~10건 — FRED 클라 브릿지 403/422/503, 서버 폴백으로 UI 무영향), 라이브 산출물 8종 페이로드, Actions 3워크플로 48h 이력
- 못 봄: 모바일 screener/signal 실화면(채팅 오버레이에 가려짐 — 오버플로 수치만 확인), 다크 외 테마(앱이 다크 전용), 실제 AI 채팅 응답 품질(전송 미실행 — 서버 쿼터 소모 회피), 색상 대비(WCAG) 정량 측정, guide/fxbond/themes/market-news 스크롤 최하단
