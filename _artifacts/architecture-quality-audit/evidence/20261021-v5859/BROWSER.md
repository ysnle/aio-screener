> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 실제 브라우저 후속 — v58.59

2026-10-21 실제 GitHub Pages, Chromium IAB. 화면 footer의 v58.59를 관측했다. 배포 SHA 동일성 인증은 아니다. 데스크톱 기본 크기, 390×844 휴대폰 viewport, 820×1180 태블릿 viewport를 사용했고 임시 크기는 reset했다. 실제 iPhone/iPad 기기 테스트는 아니다.

## ACT ON — 프리셋 변경 후 이전 종목 근거 유지

스크리너의 균형 상대 순위에서 자동 NVDA inspector가 전체 308위/838을 표시했다. 모멘텀 지속을 선택하면 조건 통과 수는341→268, 첫 행은 MRNA로 바뀌지만 inspector 본문은 그대로였다. 같은 프리셋에서 NVDA를 검색하면 표에는 전체249위, inspector에는308위가 동시에 남았다. NVDA 행을 명시적으로 다시 누르자 inspector도249위로 정상 갱신됐다. NVDA가 새 조건에서 제외됐다는 주장은 하지 않는다.

`browser-inspector-observation.json`, `browser-inspector-positive-control.json`, `browser-screener-before.txt`, `browser-screener-after.txt/.png`가 증거다. 코드 원인은 selectDefinition이 activeRow를 유지하고 renderNow가 renderWhyDrawer를 갱신하지 않는 경계다. 이전 객체를 새 실행 근거로 남기지 말고, 선택 symbol을 현재 결과에서 다시 도출하는 수정이 작다. 표의 정렬·시세 변경도 같은 경계에서 확인할 필요가 있지만 이번에 모두 재현했다고 주장하지 않는다.

## ACT ON — 검색 결과로 Tab 이동하면 결과가 사라지고 포커스를 잃음

리서치 라이브러리 통합 검색에 HBM 입력→10개 결과 표시→Tab 입력. 직후에는 첫 결과 BUTTON에 포커스가 간다. 다른 소스 검토 후 다시 관측하면 BODY에 포커스가 있고 listbox는 hidden=true/display:none이다. `research-shell.js:282`의 input blur 뒤180ms 무조건 숨김이 결과 내부의 키보드 이동도 닫는다. 결과 영역 전체의 focusout/relatedTarget을 판단해야 한다.

`browser-search-before.txt`, `browser-search-after-tab.txt/.png`, `browser-search-keyboard-observation.json`. 순간 관측만으로 정상 판정하지 않고 blur 타이머 이후도 확인했다. v58.52의 같은 문제를 최신 브라우저에서 재확인했다.

## ACT ON — LDOS의 동일 회계연도 오표기

실제 `#ticker?sym=LDOS`에서 네 가지 확인은 FY2026, 기업 요약은 FY2025, 새 역 DCF는 FY2026으로 표시된다. 공시 마감일은2026-01-02로 같다. [SEC Leidos 10-K의 Reporting Periods](https://www.sec.gov/Archives/edgar/data/1336920/000133692026000030/ldos-20260102.htm)는 이 기간을 fiscal2025로 명시한다. `browser-phone-ldos-dcf.txt/.png`에 실제 계산식의 FY2026도 남겼다. domain D59-02와 같은 클래스이며 중복 집계하지 않는다. `stock-read.js:178`, `analysis-read.js:20`, R&D 축의 직접 substring까지 공통 fiscalYearLabel 소비로 맞추는 것이 일관된 보완이다.

## 확인된 정상 동작과 시각 판단

- 주 메뉴8개에 해당하는 home/signal/macro/ticker/themes/screener/portfolio/principles의 실제 내용과 URL을 확인했다. phone-* 파일과 browser-events.json에 저장했다. 종목은 LDOS 실제 상세까지, 포트폴리오는 빈 상태만 확인했다.
- 태블릿 TEAM 표 행에서 Enter로 근거 dialog를 열고 Escape로 닫았다. 보이는 dialog가 없어지고 포커스가 TEAM TR로 복원됐다(`browser-tablet-escape.json`). 이는 해당 경로의 결과이며 전체 모달/Tab 순환 인증은 아니다.
- 휴대폰 home은 ‘다소 부담’과 미국 종가/한국 마감 기준을 첫 화면에서 구분한다. 거시 사분면과 종목의 공개된 DCF 식·한계도 화면에서 확인했다. 데이터 없는 DuPont은 수집 대기라고 표시하고 숫자를 만들지 않았다.
- CONSIDER: 휴대폰 home 첫844px에서는 질문형 오늘의 한 문장과 상태·설명이 대부분을 차지하고 추이 차트는 아래로 밀린다. 상태 한 단어의 가독성은 개선됐지만 ‘결론→차트→근거’ 목표와의 배치는 더 다듬을 여지가 있다. 사용자 이해 시간을 실측한 결과는 아니다.
- CONSIDER: LDOS의1년 차트는 확보364일/요구365일이라는 이유로 비활성이다. 자료 정직성을 유지하면서 ‘확보364일’ 차트를 열어 주는 선택도 검토할 만하다. 통계 비교에 부족한 기간을1년으로 속여 쓰자는 제안은 아니다.

## 한계와 시도 기록

테마 화면에서 CDP 지연 및 한 번의 메뉴 클릭 후 미이동이 있었다. 현재 상태를 다시 읽고 키보드 메뉴로 이동을 확인했다. 자동화 지연만으로 제품 성능 결함을 확정하지 않았다. browser-events의 첫 phone-portfolio 시도는 실제 URL이 themes였으며 성공으로 세지 않는다. 이후 같은 이름의 최종 capture는 실제 portfolio다. 초기 로딩/오프스크린 content-visibility가 빈 AX처럼 보이는 경우도 실제 DOM과 구별했다.

AI는 수동 전송하지 않았고, 보유·현금·PIN·백업 파일을 변경하지 않았다. 화면을 보는 과정의 자동 시세/뉴스 요청 비용을 계측하지 않았으므로 전체 세션 과금0을 인증하지 않는다. 모든 라우트·상태·스크린리더·대비·터치·실제 기기·배포 성능 인증은 남는다. v58.60 변경의 새 실브라우저 검증으로 이 기록을 승격하지 않는다.
