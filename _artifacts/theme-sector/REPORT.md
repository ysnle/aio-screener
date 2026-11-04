# theme-sector 보고 (v59.70 후보, 2026-11-04)

브랜치 `claude/theme-sector-86e4f9`. push·bump-version·record-fix는 하지 않았다. 기록 항목: `_artifacts/pending-records/theme-sector/01~05`.

## 1. ETF 대조표

상장 확인은 운용사 페이지에서 했다(URNM만 Nasdaq 시세 API로 확인, 추가하지 않음).

| 테마 | 이미 있던 것 | 이번에 추가 | 확인 링크 |
|---|---|---|---|
| 반도체 | SMH | **SOXX** (iShares, 30종) | ishares.com/us/products/239705 |
| 메모리 | — | **DRAM** (Roundhill Memory, 2026-04 상장, 스와프 비중 큼) | roundhillinvestments.com/etf/dram |
| 클라우드 | — | **SKYY** (First Trust, 넓은 클라우드) | ftportfolios.com …Ticker=SKYY |
| GPU 클라우드 | — | **NCLD** (Roundhill Neocloud, 2026-08 상장. 넓은 클라우드 ETF가 아니라 NBIS·CRWV·IREN 같은 GPU 호스팅) | roundhillinvestments.com/etf/ncld |
| 소프트웨어 | IGV | — | ishares.com/us/products/239771 |
| 사이버보안 | HACK | — (CIBR·BUG 확인했지만 HACK과 겹쳐 추가하지 않음, P1590) | amplifyetfs.com/hack |
| AI·로보틱스 | BOTZ | — (AIQ 확인, 미추가) | globalxetfs.com/funds/botz |
| 데이터센터 | — | **DTCR** (Global X, 대부분 타워·데이터센터 리츠) | globalxetfs.com/funds/dtcr |
| 전력망 | — | **GRID** (First Trust Smart Grid) | ftportfolios.com …Ticker=GRID |
| 원전·우라늄 | URA | **NLR** (VanEck Uranium & Nuclear) | vaneck.com …/uranium-nuclear-energy-etf-nlr |
| 방산 | ITA | — (XAR·SHLD 확인, 미추가) | ishares.com/us/products/239502 |
| 바이오 | XBI | — (IBB 확인, 미추가) | ssga.com …/xbi |
| 금융 세부 | XLF, KRE | **IAI**(증권·거래소), **KIE**(보험) (KBE 확인, KRE와 겹쳐 미추가) | ishares.com/us/products/239504, ssga.com …/kie |
| 에너지 세부 | XLE, XOP, OIH, AMLP, ICLN | — (TAN 확인, ICLN과 겹쳐 미추가) | — |
| 소비 세부 | XLY, XLP, XRT, ITB | **PEJ**(레저) (XHB는 ITB와 겹쳐 미추가) | invesco.com …/invesco-leisure-and-entertainment-etf |
| 리츠 | XLRE | — (VNQ 확인, 미추가) | investor.vanguard.com …/vnq |
| 한국 | — | **EWY** (iShares MSCI South Korea) | ishares.com/us/products/239681 |

이로써 회전 대상은 31개에서 42개가 됐다(`js/aio-pages.js` RRG_SUBSECTORS = `scripts/lib/rotation-history.mjs` ROTATION_SYMBOLS, 게이트 P1358로 일치 검사). 새 ETF 점은 다음 refresh-data 실행 뒤부터 그려진다. 그 전에는 막대가 '—'이다. 30분 실행마다 Yahoo 일봉 요청이 11건 늘어난다.

## 2. 구성 종목 보충

대표 ETF 상위 10 보유 종목 가운데 스크리너 유니버스에 있는데 어느 테마에도 없던 종목만 넣었다.

- HONA (Honeywell Aerospace, ITA 상위 10, 11/2 기준) → 방산/항공우주 · 항공기/부품
- OKTA (HACK 상위 10, 11/3 기준) → 소프트웨어/클라우드 · 사이버보안
- EXEL, UTHR (XBI 상위 10, 11/2 기준) → 헬스케어 · 바이오텍

편입하지 않은 것과 이유:
- 유니버스에 없음: NTSK, UEC, NXE, DNN, HALO, NTRA, DOCN, GDS, SKHY.
- 어디에 넣을지 근거가 약함: NTNX, P(Everpure).

점검 결과:
- 미국은 18개 테마, 97개 세부 테마다. 한 세부 테마 안에서 겹치는 종목은 0개다. 테마를 가로지르는 중복은 32종목이다(NVDA는 반도체와 AI 인프라에 모두 있다). 이 중복은 설계상 의도한 것이다.
- 모든 구성 종목이 스크리너에 있다.
- 한국은 28개 테마에 197개 자리, 고유 종목 161개다. 겹침이 큰 테마는 방산·UAM·우주(5종목 공유)와 통신·양자(같은 종목)다.

## 3. 결함별 근본 원인과 수정

**(1) RRG 겹침, '선도 20, 개선 0'**
- 원인: data.json `rotationHistory`가 11/2 기준이었다. 11/3 21:05Z 마감 뒤 `selectProducedRotation`이 이를 버렸다.
- 그러자 provider가 `_priceHistory`로 RRG를 다시 계산했다. 섹터는 Yahoo 일봉이었지만 세부 업종은 30초 세션 틱이었고, 마감 뒤에는 같은 가격만 반복됐다.
- 상수 가격을 SPY 일봉으로 나눠 정규화하면 가격과 상관없이 같은 값이 된다. node 재현에서 가격 95.1, 101.4, 210.2가 모두 96.521 / 98.426이 됐다.
- 수정(데이터 감사 R1):
  - 점은 산출물에서만 가져온다. 테마 화면은 한 세션 전 산출물을 `lagging`으로 표시해 읽고, 두 세션 늦으면 거부한다.
  - 클라이언트 재계산, 정의 기본값(`item.rsRatio`, `item.quadrant`), P721 일봉 수화를 지웠다.
  - 다른 화면의 엄격한 세션 검사는 그대로 둔다.
- 증거: `_artifacts/theme-sector/after/log.json`. 데스크톱, 다크, 폰에서 11섹터·세부 업종·전체를 3회 왕복했고 세 번 모두 같은 분포가 나왔다(세부 업종 기준 선도 6, 개선 2, 약화 1, 후행 5, 기준선 부근 6).

**(2) '미국 0', 빈 사분면**
- 원인 1: `buildGroupStrength`가 최신 세션 전 기준일의 그룹을 `current:false`로 표시했고, `buildThemePlaybook`이 이를 모두 버렸다. 그래서 매일 미국 마감 뒤 스크리너가 갱신될 때까지 약 1.5시간 동안 미국 테마가 0개가 됐다.
- 원인 2: 지도는 행이 0개인 미국을 기본으로 열었다.
- 수정:
  - 가장 새 기준일의 그룹은 `lagging.US`로 표시해 읽는다. 미국 행은 '지금 주도' 강조를 보류한다(P1681).
  - 지도는 테마가 있는 시장으로 연다.
  - 제목은 '테마 시나리오'로 바꿨다(매크로 이름 규칙). 본문의 '거시 부담/수혜'는 '매크로'로 바꿨다.

**(3) 신선도(11/2 배지)**
- 원천: `refresh data` 커밋이 11/3 12:56Z 뒤로 약 10시간 멈췄다. actions-reliability 몫이다. 노트: `side-session-notes/…/theme-sector-freshness.md`.
- 화면: 세 곳이 같은 꼬리표 '11/2 종가 기준, 11/3 반영 전'을 쓴다(`src/ui/components/session-lag.js`).

## 4. 화면 개편(D)

- 첫 문장은 11섹터 가운데 하루 강했던 3곳과 약했던 2곳, 그리고 1주 기준 강약을 말한다. 50일 회전 판정은 회전 보기 아래로 옮겼다.
- 섹터 카드는 '등락'(기본)과 '회전' 두 보기다. 범위 버튼(11섹터, 세부 업종, 전체) 하나가 두 보기를 함께 바꾼다. 페이지 머리의 중복 범위 버튼은 뺐다. 기간 기본값은 1일이다. 보기를 바꿀 때 160ms 페이드가 있고, 움직임 줄이기 설정을 켜면 끈다.
- 세부 테마 순위는 1일, 1주, 1개월, 3개월 탭과 순위 막대 하나로 바꿨다.
  - 행을 누르면 구성 종목이 펼쳐진다: 종목 수익률 막대, 중앙값 대비, 동일가중 기여(수익률 ÷ 측정 종목 수).
  - 여러 기간 표와 순위 변화는 접기('기간별 표와 순위 변화')로 옮겼다.
  - 값이 없는 기간 탭은 disabled다.
- 상태 처리:
  - 행: hover, pressed(:active), aria-expanded, focus-visible.
  - 빈 상태와 로딩은 기존 문구를 쓴다.

스크린샷:
- 전: `_artifacts/theme-sector/before/` (desktop-top, desktop-full, desktop-dark-*, rrg-*).
- 후: `_artifacts/theme-sector/after/`
  - desktop-top, desktop-dark-top, phone-top
  - *-rrg-{sectors,subsectors,all}-r0/r2
  - *-ranking-open, *-playbook
- verify-aio `drive themes`는 데스크톱과 폰 모두 9/9 PASS다(순위 펼침 단계 추가).

## 5. 데이터 감사 항목

- R1: 완료(위 3-1).
- R9 themeMedians: 완료. `src/domain/themes/theme-medians.js` 하나로 5곳을 모았다.
- R9 above50Pct → `breadthCounts`: data-refactor 브랜치에 있어 통합 때 바꾼다(group-strength.js, kr-themes.js).
- R11: 보류. 이유 두 가지:
  1. refresh-data.yml은 명시한 경로만 stage한다. 새 `rotation-detail.json`은 workflow에 `stage_if_exists` 한 줄이 들어가야 커밋된다(actions-reliability 몫).
  2. trail은 종목·포트폴리오·스크리너의 판정 폭(rrgZone)을, relativeStrength(152KB, 큰 쪽)는 recent-check를 정한다. 테마 화면만 lazy로 받으면 다른 화면의 판정이 달라진다.
  - 제안: 프로듀서가 `public-data/rotation-detail.json`(trail, relativeStrength)을 쓰고, data.json에는 좌표만 둔다. 로더 하나(`readRotationHistory()`)가 모든 소비자 앞에서 둘을 합친다. workflow에 stage 줄을 추가한다. 세 변경을 한 배치로 넣는다.

## 6. 통합 때 연결할 것

- `session-lag.js`의 기준일 입력을 `readArtifactFreshness(file).basisSession`으로 바꾼다.
- 칩 마크업을 `freshnessBadge(doc, freshness, { market })`로 바꾼다.
- 빈·로딩 상태를 `renderDataState`로 바꾼다.

이 모듈들이 이 브랜치에는 없어서 import하면 화면이 깨진다. 그래서 문구 출처만 한 곳으로 모아 두었다.

ui-states에 요청할 것:
- `.news-sort-btn:disabled` 스타일(현재 공용 규칙이 없다).
- `--surface-3` 토큰 확인.

## 7. 소유자 결정이 필요한 항목

1. 어느 테마에도 없는 S&P 대형주: AAPL(7.7%), IBM, ACN, MSI. 안은 두 가지다. '기술 하드웨어/IT 서비스' 테마를 새로 만들거나, GICS 'Software & Services'를 근거로 IT 서비스(ACN, IBM, CTSH, IT, EPAM)를 소프트웨어 테마의 세부 테마로 넣는다.
2. 한국 테마 겹침: UAM·우주가 방산과 5종목을 공유하고, 양자는 통신·포토닉스 종목과 같다. 통합할지, 대표 종목을 다르게 할지 정해야 한다.
3. NCLD·DRAM은 상장 3~7개월이고 스와프 비중이 크다. 벤치마크로 둘지(지금은 둠), 상장 1년 뒤 넣을지 정해야 한다.
4. 기간 기본값을 1일로 할지 1주로 할지. 지금은 1일이고, 1일 값이 없으면 1주를 쓴다.

## 8. 바뀐 파일

- `index.html`
- `js/aio-pages.js`
- `scripts/lib/rotation-history.mjs`
- `src/app/bootstrap.js`
- `src/data/providers/themes.js`
- `src/legacy/compatibility-facade.js`
- `src/domain/themes/{produced-rotation,group-strength,kr-themes,theme-medians*}.js`
- `src/domain/scenarios/{theme-playbook,theme-criteria}.js`
- `src/domain/briefing/ai-chain-flow.js`
- `src/ui/pages/themes.js`
- `src/ui/components/{theme-strength,theme-playbook-view,rrg-view,session-lag*,ai-answer-visuals}.js`
- `src/ui/styles/themes-page.css`
- 게이트: `scripts/ci-{esm-core-unit,runtime-contract,scenario-guidance-fixture}-check`
- verify-aio: `features/themes.md`, `scripts/features/themes.mjs`
- `_context/CURRENT-STATE.md`(생성물)
- cherry-pick 97c58be9 (reaction-read.js 제어문자)

(*는 새 파일)
