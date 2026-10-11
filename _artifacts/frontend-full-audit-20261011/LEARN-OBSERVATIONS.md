# LEARN-OBSERVATIONS — #principles / #atlas / #masters / #guide

- 감사일: **2026-10-11 (일)**, 리비전 v57.36, 서버 `http://127.0.0.1:8931` (감사자가 관리하지 않음)
- 방법: 스크래치패드 Node+Playwright 스크립트 **1개 · 1회 실행**(라우트당 렌더 대기 5초, 상호작용 후 2초). 스크린샷 4장 → `_artifacts/frontend-full-audit-20261011/learn-{principles,atlas,masters,guide}.png`
- 등급: **A 0 · B 2 · C 3 · D 4 (총 9)**

## A/B 한 줄 요약

**A 0건** — 이전에 알려진 A급 이슈(가이드가 퇴역 화면을 설명, 13F를 비분기로 표기, principles/atlas 빈 콘텐츠·깨진 링크·회사-티커 오매칭)는 **모두 재현되지 않았다**(가이드 8개 화면 = ROUTE_HUBS, 13F 라벨 전부 '보고분기', learn 3개 화면 모두 실제 콘텐츠 렌더, 링크 0개·빈 섹션 0개·오매칭 0건).
**B 2건** — (1) masters 상위 10 보유 표가 제목과 다른 기준으로 정렬돼 순번이 가치 순위가 아니다(버크셔 #1 Alphabet $28.16B, $65.95B Apple은 #4). (2) '운용 방식별 비교' 그룹에 13F 비신고주체(Mark Minervini, method-only)가 구분 표기 없이 섞여 있다.

## 관찰 상세

| ID | 등급 | 라우트 | 위치 | expected (근거) | actual | 수정 방향 | 확신도 |
|---|---|---|---|---|---|---|---|
| LEARN-B1 | B | masters | 상세 · '분기 변화 원장' 표(제목 "현재 신고 가치 상위 10개 보유…") | 제목·`#` 순번 = 신고 가치 내림차순 1..10 (holdings.json displayPolicy "Top 10 holdings by reported value") | 변화 있는 행을 가치순으로 먼저, 수량변화 0("변화 없음") 행을 뒤에 붙임. 오크트리 #8 CORE SCIENTIFIC $128.0M → #9 EXPAND ENERGY $477.6M → #10 VIPER $160.8M. 버크셔 #1 ALPHABET $28.16B, #4 APPLE $65.95B, #5 AXP $51.28B | 정렬 키를 신고 가치 내림차순으로 고정하거나 기준을 문구·헤더에 명시(순위가 아니면 `#` 대신 행 번호) | high |
| LEARN-B2 | B | masters | '운용 방식별 비교' 그룹(성장·혁신 7 등) | index.json policy: 방법론 전용 교육자는 *visibly separated*, filer/CIK/보유 행 없음 (methodOnlyProfiles=1, priorityManagerCount=38=37+1) | '성장·혁신 7'에 Fidelity/FMR, T. Rowe Price, Halvorsen, Coleman, Cathie Wood, Aschenbrenner와 **Mark Minervini**(13F 비신고)가 동일 표기로 노출. 그룹 합계 38에 방법론 전용 1명 포함 | 방법론 전용 프로필을 별도 배지/그룹("13F 미신고 · 방법론 참고")으로 분리하고 13F 그룹 합계에서 제외 | medium |
| LEARN-C1 | C | masters | 상세 요약('최신 보고분기 2026-06-30') | 보고분기 옆 제출·수집 기준일 칩 (filedAt 2026-08-14, reviewedAt 2026-10-06) | 보고분기 2026-06-30 / 이전 2026-03-31만 노출, 제출일·검토일 칩 없음 (13F가 분기 공시라는 라벨 자체는 정확) | 제출일(13F-HR 2026-08-14)·수집 기준일(2026-10-06) 칩 추가 | medium |
| LEARN-C2 | C | atlas | 도메인 개요 하단 '데이터 출처' | 참조 아티팩트 검토일 표시 (atlas/index.json reviewedAt=2026-08-15, REFERENCE_CONNECTED) | 화면에 기준일 전무(dates=[], quarters=[]), '데이터 출처' 뒤 본문도 없음 | 검토일(2026-08-15)과 성격(참조용 온톨로지·현재 기업 주장 금지) 표기 | medium |
| LEARN-C3 | C | principles | 문서 상단 / '데이터 출처' | 개념·레슨 문서도 기준일 노출 | 날짜 전무, 화면 수치는 콘텐츠 개수(34/12/84/112)뿐 | 문서 헤더 또는 출처 줄에 콘텐츠 검토일 추가 | low |
| LEARN-D1 | D | guide | 본문 연결 설정/유의사항/FAQ | 첫 방문 시 핵심 섹션 1개 이상 펼침 | innerText 1,720자, '화면 안내'와 '판정 기준표'만 노출. '연결 설정'→'반드시 읽어야 할 유의사항' 사이 본문이 innerText에 없음(접힘) | '유의사항' 기본 open 또는 목차 점프 시 `.box-collapsed` 열기 | low |
| LEARN-D2 | D | guide | `#guide-capability-manifest` (section.aio-widget) | 내용 존재 또는 DOM 제거 | innerText 0자의 빈 섹션(감사 통과 시 의도적 hidden) | 통과 시 위젯 미렌더 또는 `data-aio-empty="expected"` 마커로 QA 오탐 방지 | high |
| LEARN-D3 | D | 전 라우트 | index.html CDN preload | preload integrity가 실제 파일 해시와 일치 | 라우트마다 warning 3건: chart.js@4.4.0 / dompurify@3.0.9 / lightweight-charts@4.2.0 preload가 integrity mismatch로 폐기 | SRI 해시 갱신 또는 preload 속성 정합 | high |
| LEARN-D4 | D | masters | 탭 '13D/G 소유권' (src/ui/pages/masters.js:52,1076) | 13D/G는 수시 공시 → 13F '분기' 흐름과 분리, 데이터 없으면 '없음' 명시 (operations-status.json: 13D/G "not yet normalized") | 데이터 미연결 시 폴백이 상시 로딩 문구 "Schedule 13D/G 소유권 이벤트 원장을 불러오는 중입니다." | 종결 문구("준비 중 — 현재 제공하지 않음")로 교체, 제공 전 탭 숨김/준비 상태 칩 | medium |

## 화면 수치 ↔ 소스 대조 (요구: 화면당 5~10개)

**masters · Howard Marks / oaktree-capital-management** — 표시값 전부 `public-data/masters/holdings.json` verification과 일치
145개 ↔ reportedPositionCount=145 · 40.8% ↔ 40.8074525 · 54.6% ↔ 54.5844935 · $7.2B ↔ parsedValueTotal 7,206,070,520 · 신규40/확대51/축소33/변화없음21/제외42 ↔ {NEW:40,INCREASED:51,REDUCED:33,UNCHANGED:21,EXITED:42} · 전체 187개 ↔ comparisonRowCount=187 · 회전율 31.3% ↔ turnoverProxyPct=31.326 · 보고분기 2026-06-30 / 이전 2026-03-31 ↔ reportPeriod/priorReportPeriod · 신고 법인 "Oaktree Capital Management LP" ↔ cover.filingManager/CIK 0000949509

**masters · Warren Buffett / berkshire-hathaway** (before 스냅샷) — 동일 기준 일치
29개 · 68.7% · 88.5% · $299.3B · 신규1/증가7/감소6/변화없음15/제외1 · 전체 30개 · 회전율 7.8% ↔ reportedPositionCount 29 / 68.6515 / 88.4689 / 299,253,556,246 / {NEW:1,INCREASED:7,REDUCED:6,UNCHANGED:15,EXITED:1} / comparisonRowCount 30 / 7.7676 (13F-HR, filedAt 2026-08-14). 상위10 10행 합계 264.7B = total×88.47% 내부 일관.

**guide · 판정 기준표 12행** — `src/domain/rules/thresholds.js` RULES와 13/13 일치 (50·200일선, 60%/40%, VIX 18·25·0.95·1, 5일 +25%, 25bp·90%, 350bp·450bp·5일+25bp, WTI −5%/+10%/85%/달러+2%, 원·달러 ±2%·엔 3%, Sahm 0.3/0.5·10만, PCE 2.5/3/+0.5%p/2%, ±0.25%p·실질2%, 공포탐욕 25/45/55/75, 부담 셀 '또는').

**guide · 화면 안내 8개 화면** — `src/ui/navigation/route-hubs.js` ROUTE_HUBS와 8/8 일치: 오늘(대시보드·브리핑·뉴스) / 시장 상태(국면 판정·시장 폭·투자 심리) / 거시·금리(거시 경제·금리·환율) / 테마·섹터 / 종목(요약·차트·재무 공시) / 스크리너 / 포트폴리오 / 리서치 라이브러리(개념·분석 프레임·산업·밸류체인·운용사·13F). **삭제된 옵션 라우트·스윙/데이 모드·0~100 환경 점수 설명은 0건**(guide 내 '옵션' 문자열 없음).

**atlas · 헤더 수치** — '산업 지도 19' ↔ taxonomyDomains=19, 'AI 기초 7' ↔ foundationLayers=7, 좌측 도메인 목록 19개 = taxonomyDomains. '관계 가이드 5'는 대응 필드 미확인(unverified).

**principles · 수치** — 34/12/84/112 는 대응 소스 아티팩트를 특정하지 못해 대조 불가(unverified). 링크 0개 → 깨진 링크 0, 빈 섹션 0, 회사-티커 오매칭 0(티커 표기 자체 없음; `(CAGR)`는 정규식 오탐).

## 콘솔·네트워크

- **404 없음**(127.0.0.1:8931 자체는 전부 200). 실패는 전부 외부: `aio-proxy` 프록시 경유 요청 7건이 **403**, `/health` **CORS preflight 차단**, coingecko 직접 호출 실패. → learn 라우트 수치는 모두 정적 참조 아티팩트로 렌더됨.
- 라우트당 console error/warning 29~33건, 그중 **CDN preload integrity mismatch 3건**(전 라우트 공통, LEARN-D3).

## 상호작용 검증 결과

| 라우트 | 의도 | 실제 클릭 대상 | 효과 |
|---|---|---|---|
| principles | 개념 그래프 1회 확장 | 허브 탭 '개념·분석 프레임' | 무효(delta 0) — 그래프 확장 미검증 |
| atlas | 산업 노드 1회 진입 | 허브 탭 '산업·밸류체인' | 무효(delta 0) — URL에 `?view=domain&node=cloud-hyperscaler` 복원, 도메인 개요 열린 상태 |
| masters | 운용사 1회 선택 | 좌측 목차 'Howard Marks' | **유효** — 상세가 버크셔 → 오크트리로 전환 |
| guide | 목차 1회 이동 | '메뉴 지도'(_aioGuideJump/guide-screens) | 스크롤만, 텍스트 변화 0 |

## Blocked (추가 실행 필요)

1. **masters '13D/G 소유권' 탭의 실제 렌더 상태** — 상호작용 1회 제한으로 미개봉. 코드상 폴백은 상시 로딩 문구, 데이터는 `public-data/operations-status.json` 기준 미정규화 → 확인 시 LEARN-D4가 A로 승격될 수 있음.
2. principles 개념 그래프 확장 / atlas 산업 노드 진입 동작 자체(선택자 충돌로 미검증).
3. guide 목차 점프의 시각적 강조/포커스 효과.
4. principles 콘텐츠 수량 34/12/84/112의 소스 아티팩트.
5. atlas '관계 가이드 5'의 소스 필드.
6. guide 외부 링크 `https://github.com/ysnle/aio-screener/issues` 도달 여부(대화형 브라우징 금지).
7. 라이브 시세·뉴스 수치 — 프록시 403/CORS로 수집 불가.

## 산출물·제약

- 생성물: `LEARN-OBSERVATIONS.json`, `LEARN-OBSERVATIONS.md`, 스크린샷 4장(`learn-principles.png`, `learn-atlas.png`, `learn-masters.png`, `learn-guide.png`).
- 캡처 원본/스크립트: 스크래치패드 `learn-audit.cjs`, `learn-capture.json`, `digest.txt`, `masters-facts.txt`.
- 서버·프로젝트 파일·git은 수정하지 않았다. **도구 호출 예산(30회)은 초과**했다(탐색+캡처+대조). 위 blocked 항목만 후속 실행이 필요하다.
