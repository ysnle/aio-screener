---
verified_by: agent
last_verified: 2026-06-05
confidence: high
target_version: v50.12
measured_env: Claude Preview (python http.server, desktop 1280×900 + mobile 375)
scope: 21 route pages · 2 axes (클러터/중복 · 초보자 직관성/위계)
out_of_scope: 접근성 심화 · 온보딩 진입 UX · 코드 시정(리포트 후 합의)
---

# 프론트엔드/UX 라이브 audit 리포트 — v50.12 (2026-06-05)

> **시정 현황 (v50.13, 2026-06-08)**: 21페이지를 `showPage`로 하나씩 진입해 섹션 단위로 재점검 후 시정 완료 — **P0 가시 dev/버전 마커 전부 제거**(§63/§58/§62/§55·Claude Mythos·v49.64·v50.x refreshed/기준·Fallback Only/prominent), **STALE/STATIC/OK/REF 배지 한글화**(전역), **홈 쿼터 중복 제거**, **breadth routine 200일선 제거**, **용어집 +7**(RRG/OAS/OPEX/소르티노/피오트로스키/ZBT/맥스페인). 라이브 검증: 가시 dev마커 0·영문 배지 0·콘솔 JS에러 0·회귀 0. **보류**: macro/fxbond/themes/signal-CP1~8 CHAT_CONTEXTS의 4월-2026 내러티브 + KR 테마 `[MM/DD]` 접두사(가시 UI 아니거나 데이터-refresh 영역) → 별도 de-stale 과제. market-news 150건 밀도·portfolio refresh 3종은 by-design 수용.

> 사용자 요청: "각 페이지 UI/UX/레이아웃(배치/구조/비율)을 라이브로 세밀 점검. 초보자에게 친화·직관·친절·접근 쉬움·잘 설명하는지, **불필요/쓸데없는 내용은 없는지** 확인." 진행 방식 = audit 리포트 먼저. 우선 2축 = ① 클러터/중복 제거 · ② 초보자 직관성/위계. (접근성·온보딩 제외.)

## 0. 방법론 + 측정 환경 caveat (중요)

- **스크린샷은 폭/비율 판단에 신뢰 불가**: 이 preview는 dpr 스케일링으로 스크린샷이 콘텐츠 폭을 왜곡한다. 실제로 "데스크탑 공간 낭비/모바일 200px" 인상은 **거짓 artifact**였고, `getBoundingClientRect` 측정 결과 홈은 데스크탑 995px를 2/3/4열 그리드로 채우고 모바일도 폭(359/375)을 채운다. → 본 리포트의 모든 정량 판단은 **`preview_eval` 측정 + 기존 AIO audit** 근거이며, 스크린샷은 일반 외형에만 보조 사용했다.
- 측정 도구: 21개 `#page-*` DOM을 (숨김 상태로도) textContent·요소수·마커·data-action으로 전수 측정 + `getDuplicateContentAudit`/`getDataActionHandlerAudit`/`getColorContrastAudit`/`getTableAccessibilityAudit` + `window.GLOSSARY`(260항).

## 1. 전역 baseline (기본기는 양호)

| 항목 | 결과 |
|---|---|
| 레이아웃/반응형 | **양호** — 그리드 정상 reflow, 가로 overflow 0 (1280/375 모두) |
| WCAG AA 색대비 | **0 실패** (`getColorContrastAudit`) |
| 테이블 접근성 | **0 이슈** (`getTableAccessibilityAudit`) |
| 죽은 버튼(미연결 data-action) | **0건** (`getDataActionHandlerAudit` ok) |
| 핵심 결론/우선 카드 | **21페이지 모두 존재**(`aio-page-brief`/conclusion/primary) |
| 용어집 | `window.GLOSSARY` 260항 — 핵심 33용어 중 **26 커버** |

→ **하드 결함(깨진 레이아웃·대비·죽은 UI)은 없다.** 개선 여지는 ① 클러터(중복 지표·개발자 마커 누출·과밀) ② 초보자 직관성(전문용어 미정의·밀도)에 집중된다.

## 2. 페이지별 측정 요약

| page | textLen | cards | 인터랙티브(종류) | 빈칸 | 전문용어 | dev마커(가시) | 주요 플래그 |
|---|---|---|---|---|---|---|---|
| home | 9,027 | 16 | 40 | 0 | 7 | (버전배지) | explain 토글 과다? |
| signal | 8,452 | 1 | 23(6) | 4 | **16(최다)** | **§63 누출** | 용어 과밀+§63 |
| breadth | 3,352 | 1 | 8 | 0 | 4 | — | 양호 |
| sentiment | 3,345 | 1 | 10 | 3 | 4 | — | 양호 |
| briefing | 14,326 | 33 | 44 | 3 | 5 | "v50.11 refreshed" | 밀도+버전배지 |
| technical | 4,815 | 1 | 16(9) | 4 | 7 | — | ZBT 미정의 |
| macro | 6,208 | **18** | 10 | 1 | 3 | — | **중복지표 ×3** |
| fxbond | 7,363 | 12 | 11 | **9(최다)** | 7 | — | **중복 ×5 + 빈칸** |
| fundamental | 5,227 | 8 | 20 | 4 | 5 | — | Piotroski 미정의 |
| themes | 3,102 | 1 | 19 | 2 | 2 | **§58/§62 누출** | 섹션마커 |
| theme-detail | 666 | 1 | 16 | 6 | 0 | — | 기본 빈 화면(선택 전) |
| portfolio | 3,120 | 1 | **40(21종)** | 0 | 4 | — | 인터랙티브 과다 |
| ticker | 2,616 | 1 | 20 | 0 | 5 | — | 양호 |
| market-news | **55,176** | **150** | 24 | 0 | 1 | — | **초고밀도** |
| options | 8,752 | 1 | 6 | 3 | 8 | **"v49.64서 제거"** | 개발 changelog 누출 |
| kr-home | 2,927 | 21 | 8 | 0 | 3 | — | 양호 |
| kr-supply | 1,763 | 3 | 12 | **8** | 0 | — | 빈칸 다수 |
| kr-themes | 835 | 1 | 18 | 0 | 0 | — | 최소 |
| kr-macro | 3,229 | 1 | 6 | 1 | 0 | "v50.4 기준" | 버전 스탬프 |
| kr-technical | 1,820 | 1 | 21 | 1 | 4 | — | 양호 |
| guide | 10,568 | 1 | 33 | 1 | 12 | — | 밀도(가이드라 정상) |

## 3. 축① 클러터/중복·불필요 — 발견

### A. 개발자/버전 마커가 사용자 텍스트에 노출 (P0 — 명백한 불필요)
사용자에게 의미 없는 내부 마커가 본문에 보인다:
- **options**: `"특정 종목·행사가·만기·프리미엄 예시는 v49.64에서 제거되었습니다 (실거래 혼동 차단)"` → 사용자는 "v49.64"를 알 필요 없음. "실거래 혼동 방지를 위해 구체 예시는 제공하지 않습니다"로 일반화.
- **signal**: `"...무기화 '수개월→수분' 단축(§63) · OpenAI TAC..."` → `(§63)` 내부 섹션 참조 제거.
- **themes**: `§58`/`§62` 섹션 마커 노출 → 제거.
- **briefing**: `"v50.11 refreshed"` 배지 → 날짜("2026-06-05 기준")로 대체 권장.
- **kr-macro**: `"v50.4 공식 캘린더 기준"` → "공식 6월 캘린더 기준"으로 버전 제거.
- (home `v50.12` = 시장현황 옆 앱 버전 배지 = 의도된 표시, 유지 OK.)
- 비고: `getTextSurfaceAudit` block 49·warn 917이 있으나 대부분 governance 메타(`data-text-role`/archive)로 비가시. **위 5건은 실제 가시 누출**로 확인.

### B. 중복 지표 표시 (P1 — 맥락 확인 후 정리)
`getDuplicateContentAudit` 11건. DOM 확인 결과 일부는 `macro-card`/표/요약strip 등 **맥락 분리**(요약+상세)로 정당, 일부는 단순 반복:
- **page-fxbond**: DXY ×5 · 10Y(^TNX) ×5 · HYG/KRW/JPY ×3 → **가장 과다**. 5회 노출은 요약+표+차트 라벨을 감안해도 과함 → 1~2회로 축소 검토.
- **page-macro**: Fed금리/DXY/유가/10Y/금 각 ×3 → 헤더 요약 + 카드 중복 가능성 → 요약strip vs 상세카드 역할 분리 후 한쪽만.
- **page-options**: VIX ×4 → IV Rank 기준선·헤더·표 맥락이면 일부 정당, 확인 후 정리.
- **권장**: 각 지표는 "요약 1 + 상세 1" 원칙(최대 2회), 차트 축/툴팁의 값 재노출은 시각 라벨이므로 카운트 제외 가능.

### C. 빈/placeholder UI (P2 — reference-only vs 죽은칸 구분)
- **fxbond 9칸 · kr-supply 8칸**의 "수신 대기/확인 대기" → 라이브 소스 없는 reference-only면 정상이나, **영구 빈칸이면 사용자에 무의미** → "데이터 없음 + 이유/다음행동" 안내로 전환하거나 숨김.

### D. 과다 인터랙티브 (P2)
- **portfolio 21종 data-action**: 모두 정당 기능(PIN잠금·워치리스트·포지션·리스크)이나 **refresh 버튼 3종**(`refreshPortfolioPrices`/`refreshPortfolioRisk`/`refreshPortfolioTechnicalRisk`) 분리 → 1개 "새로고침"으로 통합 검토(초보자 혼동↓).

### E. 초고밀도 (P1 — 압도/스크롤/성능)
- **market-news: 150 카드 / 55,176자** 한 화면 덤프 → "더 보기"/페이지네이션/기본 N건 제한 없으면 초보자 압도 + 렌더 부담. 상위 N건 + 더보기 권장.
- **briefing: 33 카드 / 14,326자** → 핵심 관전포인트 상단 고정 + 나머지 접기.

## 4. 축② 초보자 직관성/위계 — 발견

### A. 용어집 미등록 전문용어 7개 (P1)
페이지에 등장하나 `GLOSSARY`(260항)에 **없음** → 용어집 검색·툴팁이 빈손:
- **RRG**(home/breadth/themes/fxbond/guide) · **OAS**(signal/breadth/fxbond) · **OPEX**(signal/technical/options/guide) · **Sortino**(portfolio) · **Piotroski**(fundamental) · **ZBT**(technical) · **맥스페인**(options)
- → 7개 용어집 항목 추가(+ 첫 등장 페이지 인라인 1줄 풀이 cross-check).

### B. 전문용어 과밀 페이지 (P1)
- **signal 16개 · guide 12개 · options 8개**가 한 페이지에 집중. guide는 학습 목적이라 정상이나, **signal**은 매매 결정 페이지인데 RSI/ATR/VCP/SEPA/OPEX/SKEW/MOVE/OBV/콘탱고/백워데이션/감마… 16개가 밀집 → 초보자 진입장벽. 핵심 3~4개만 본문 노출 + 나머지는 "상세 보기" 토글/툴팁으로 이동 권장.

### C. 시각 위계 — 핵심 우선 배치는 OK, 강조 남발 점검 (P2)
- 21페이지 모두 상단에 핵심 카드(`aio-page-brief`/conclusion) 존재 → **기본 위계는 양호**.
- 단 `explainPanels` 카운트가 home 60·guide 33·signal 22·technical 22로 높음 → 교육 토글 자체는 유익하나 **기본 펼침 상태면 과밀**. 기본 접힘 + "핵심 보기" 우선이 유지되는지 페이지별 확인(시정 단계).

### D. 빈 상태 안내 (P2)
- **theme-detail**(기본 textLen 666·explainPanels 0): 테마 선택 전 빈 화면 → "테마를 선택하면 구성종목·RRG가 표시됩니다" 안내 유무 확인.
- fxbond/kr-supply 빈칸(축①-C와 연계): "왜 비었는지 + 무엇을 하면 되는지" 안내.

## 5. 우선순위 백로그 (시정 단계용)

**P0 (즉시·저위험·명백한 불필요)**
1. 가시 dev/버전 마커 5건 제거/일반화 — options "v49.64", signal §63, themes §58/§62, briefing "v50.11 refreshed", kr-macro "v50.4 기준".

**P1 (고영향)**
2. 용어집 7개 추가(RRG/OAS/OPEX/Sortino/Piotroski/ZBT/맥스페인) + 첫 등장 인라인 풀이.
3. fxbond/macro 중복 지표 축소(지표당 최대 2회: 요약+상세).
4. market-news 상위 N건 + 더보기(초고밀도 완화) · briefing 핵심 상단 + 나머지 접기.
5. signal 전문용어 과밀 완화(핵심 노출 + 상세 토글).

**P2 (정리·일관성)**
6. portfolio refresh 버튼 3종 → 1개 통합.
7. fxbond/kr-supply 영구 빈칸 → "데이터 없음+안내" 또는 숨김.
8. explainPanels 기본 접힘 상태 페이지별 확인.
9. theme-detail 등 빈 상태 안내 문구.

## 6. 비범위(별도 백로그)
- 접근성 심화(탭타겟 ≥44px·최소 폰트·키보드·ARIA) — 현 대비/테이블은 통과.
- 온보딩 모달(첫 방문 4 API 키 요구) 진입장벽 완화 — 사용자 결정상 이번 제외(기록만).
- macro/fxbond/themes CHAT_CONTEXTS 4월-2026 내러티브 de-stale(별건).

## 재현
```bash
python3 -m http.server 8080   # AIO 루트
```
```js
AIO.getDuplicateContentAudit(); AIO.getDataActionHandlerAudit(); AIO.getColorContrastAudit(); AIO.getTableAccessibilityAudit();
window.GLOSSARY.length;  // 260
// 페이지별 측정: #page-<id> textContent/querySelectorAll 카운트 (본 리포트 §2 재현)
```
