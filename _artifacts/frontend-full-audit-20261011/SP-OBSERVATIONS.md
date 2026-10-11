# SP-OBSERVATIONS — #screener · #portfolio (frontend-full-audit-20261011)

- 관측: 2026-10-11 09:07Z · warm 로드(#home 웜업 6s → SPA 해시 이동, 각 라우트 5s) · 1440x900 headless Chromium
- 기준일: 오늘 2026-10-11(일) · 마지막 미국장 2026-10-09(금) 종가 · 마지막 한국장 2026-10-08(목, 10/9 한글날 휴장)
- 산출물: `SP-OBSERVATIONS.json`(상세) + 스크린샷 `sp-screener.png`, `sp-portfolio.png`
- 등급: A=틀린/낡은 데이터 · B=같은 값 다른 basis · C=기준일/상태칩 오류 · D=카피/UX
- **건수: A 0 · B 2 · C 1 · D 3 (총 6)**

## A/B 요약 (한 줄)
- **B**: 스크리너 준비 개수(985/993·99.2%)가 산출물 `ok=989`(99.6%)와 어긋나고 basis 미표기(중복 X-A2), 재무 커버리지는 79.6%(분모 813)·SEC 652/757·data.json 649 세 basis 가 동시 노출.
- **A 없음**: 기준일 표기(팩터 US 10/9·KR 10/8, 수집/생성 10/10)는 데이터와 일치. 데이터 형태의 유일한 공백(후보 테이블 '가격' 컬럼 12/12행 `—`)은 차단된 라이브 시세 계층 탓으로 판단해 A로 계상하지 않고 blocked 로 분류.

## 발견

### SP-B1 · B · screener · **중복: X-A2**
- **위치** `src/ui/pages/screener.js:1260`(#screener-readiness-note), `:1702`(#scr-readiness-preview), `index.html:9285`(#scr-funnel-ready)
- **expected** `screener.json.ok=989`, `universe=993`(99.6%), `dataRowCount=989` (basis: `public-data/screener.json` → ok/universe/data; `screener-universe.json` → meta.recordCount)
- **actual** "종목 993 · 계산 준비 985" / "필드 준비 985/993 · 99.2%" — **X-A2 재확인(불일치 지속)**
- **수정** 라벨 분리: "수집 성공 989/993(99.6%)" vs "현재 프리셋 필수 필드 충족 985/993(ret3m·pctSma200·rsi14)" — 각 수치에 분모·산출 주체 부착
- **확신도** high (985=프리셋 필드 충족 eligibleCount, 989=Yahoo 조회 성공 수)

### SP-B2 · B · screener
- **위치** 스크리너 헤더 커버리지 문구 + `[data-screener-provenance]`(index.html:9233)
- **expected** `fundamentalCoveragePct=79.6`(647/**813**), SEC `652/757`, `data.json.meta.secFundamentalsCount=649` (basis: `screener.json` → fundamentalCount/CoveragePct/CoverageDenominator/CoverageScope; `data.json` → meta)
- **actual** 화면에 "공시 재무 자료가 있는 종목 79.6%"와 provenance "SEC FY 652/757"이 함께 — 분모 813 대 유니버스 993 불일치 미표기, SEC 수치는 산출물 간(652 vs 649)도 상이
- **수정** 커버리지 한 문장으로 통일 + 분모·스코프(US 813)와 출처 병기, SEC 스코프는 라벨에 명시
- **확신도** medium

### SP-C1 · C · screener + portfolio
- **위치** 공통 판단 배너(페이지 상단, 두 라우트 동일 문구)
- **expected** 데이터 도착·최신: screener asOf `2026-10-10T13:01Z`, 993행/985 준비; market-snapshot `status="published"` 16/16; 최신 사이클 `data.json.meta.cycleId = kst-0800-2026-10-09T23:00:00Z`(=10/10 08:00 KST)
- **actual** 두 화면 모두 "판단 보류 · 필수 현재성 근거 미수신 / **데이터: 미수신** / 공통컷 지연 · 10/10/08:00 KST / 시점 불일치"
- **수정** "데이터: 미수신"을 대상별로 분해(정적 스냅샷 도착 vs 실시간 시세 근거 미수신), 공통컷 지연 근거(다음 사이클 시각) 노출
- **확신도** low — 라이브 시세 도달 환경에서는 문구가 달라질 수 있음(환경 의존)

### SP-D1 · D · portfolio
- **위치** `src/ui/pages/portfolio.js:206`(#pf-sector-breakdown 빈 상태)
- **expected** 빈 포트폴리오는 "종목을 추가하면 …" 안내 (동일 화면 형제: donutLegend="종목을 추가하면 비중이 표시됩니다", checks="평가액이 있는 포지션을 추가하면 점검이 표시됩니다", analysisStatus(valuation=empty)="포트폴리오 등록 후 자동 계산됩니다.")
- **actual** "포트폴리오 **데이터 수신을 기다리는 중**입니다" (데이터 로딩 대기처럼 읽힘)
- **수정** 빈 상태 문구 "종목을 추가하면 섹터 비중이 표시됩니다" 로 교체
- **확신도** high

### SP-D2 · D · screener
- **위치** `src/ui/pages/screener.js:1249-1260`(#screener-readiness-note · identityNote)
- **expected** 심볼·이름·섹터 993/993 보유, 가격 랭킹 985행 계산 (basis: `screener-universe.json` meta.recordCount=993/note; `screener.json` ok=989)
- **actual** 요약줄 리드 = "식별 metadata 미확인 **993개**(mic_missing·asset_type_missing·currency_missing)" → 전량 미확인처럼 읽힘
- **수정** 랭킹 무영향 경고는 말미/접힘으로, 리드에는 신선도·실제 영향 결측만
- **확신도** low (P1167 의도 경고일 수 있음 — 우선순위/가독성 관찰)

### SP-D3 · D · screener
- **위치** `index.html:9233` `[data-screener-provenance]` + `#scr-data-status`(details 9231-9234)
- **expected** 출처 문구 1회 노출
- **actual** 동일 provenance 문구가 독립 div 로 1회 + #scr-data-status 내부에 재포함(2회)
- **수정** 한쪽 제거 또는 상세는 색인·링크만
- **확신도** low

## 알려진 참고 재확인

| ref | 결과 | 내용 |
|---|---|---|
| **SMOKE-B1** | **재현 안 됨 (warm)** | "이어서 볼 곳"에서 `시장 상태 → why = "순위가 놓인 환경 — **혼조**"`. 웜업 시 `#home-hero-total="혼조"`, 국면 available=true. 즉 cold 딥링크 한정 타이밍 문제로 보임 → **중복: SMOKE-B1 (미재현)** |
| **X-A2** | **재현됨** | 화면 985 vs 데이터 `ok=989` → 발견 **SP-B1 (중복: X-A2)** |

## 추출값(요약)

**screener** — 기준일 표기: `연구용 스냅샷 · 팩터 US 2026-10-09 · KR 2026-10-08 세션 종가 기준(일봉 바 시작 2026-10-09 13:30 · bar-start) · 수집/생성 2026-10-10 13:01 · 종목 유니버스 최신 · 모델 검증 BLOCKED · 공식 거래소 breadth 아님`
- 검증 게이트 라벨: `순위 사후 검증 | 상위−하위 20% -0.84% · 2/6회 앞섬 | 2026-10-10 계산 · 986종목 · 과거 6번 시점(147~42거래일 전) · 21거래일 보유 · 비용 +0.42% · IC -0.003 | 예측력 검증 미완료`
- 이어서 볼 곳: `[표 첫 행 MPC → / 지금 표 …]`, `[시장 상태 → / 순위가 놓인 환경 — 혼조]`
- 누락값 표기: `—`(em dash, 페이지 204개). 별도 라벨 `검증 자료 없음`
- 후보 테이블(렌더 12행, 헤더 11열): 전 행 `가격="—"`. 예) `☆+ / 100 / 상위1% / MPC·Marathon Petroleum / — / -3.2% / +15.9% / +53.7% / 73.5 / 4.9배 / 기반 형성 · 충족도 45` …(전 행 JSON 참조)

**portfolio**(빈 상태) —
- 빈 안내: `포트폴리오가 비어 있습니다 / 티커 · 수량 · 매수 단가를 입력하면 보유 현황과 리스크 분석이 시작됩니다. / [첫 종목 추가] / 보유 내역은 이 브라우저에만 저장됩니다 … PIN 설정 후 저장 시 AES-256 암호화.`
- 통화 표기: 빈 포트폴리오에선 전부 `—`(#pf-currency-note, #pf-total-value, #pf-cash-hero). 경로상 USD=`$`, KRW=`₩`, 기타=코드
- 커버리지 공개 문구: 빈 상태에선 미노출(비어 있지 않을 때 "공개된 기준값이 있는 항목만 양호/주의로 판정 …")
- 도넛/차트 라벨: `#pf-donut-legend = "종목을 추가하면 비중이 표시됩니다"`(도넛 미렌더). 섹터 집중도 빈 문구는 SP-D1
- 참고: `변동성 구간 VIX 14.8(10/9 종가) · 저변동 구간`

## blocked
1. **라이브 시세 계층** — 외부 차단(CORS allowlist)으로 스크리너 '가격' 전량 `—`, 포트폴리오 "시세 출처 확인 대기/갱신 —". 라이브 환경 재확인 필요.
2. **포지션 입력/평가 흐름** — 읽기 전용 지시로 포지션 미입력 → 통화/손익/도넛 실값 경로 관측 불가.
