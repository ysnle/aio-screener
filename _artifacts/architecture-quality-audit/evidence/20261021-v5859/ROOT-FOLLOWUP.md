> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 주 담당자 추가 전문 검토

추가 계승: 이전 d36bb256 legacy-current-reading.tsv의 aio-data 전문 hash899a41...와 실제 base blob을 맞추고, v58.59까지의 전체 변경1줄(home 이름)을 읽었다. 최신 aio-data는 기준전문+전체diff로 보완했으며 이번100만 자 재독으로 세지 않는다. chat의1줄, pages의7줄, workspace의6줄 변경도 읽었지만 기준 전문이 없는 경로는 DIFF_ONLY로 남겼다.

`stock-read.js`405행, `daily-loop.js`470행을 직접 끝까지 읽었다. root-reading.tsv에 고정 v58.59 원문 SHA와 범위를 남겼다. v58.60 차이9개에 두 파일은 없으므로 해당 소스 내용은 같다. worker 위임의 추가 실행 한도로 끝나지 않은 작업을 FULL로 세지 않고, 이 두 파일만 root가 실제 보완했다. legacy chat 첫180000자 전문 읽기는 실행되지 않아 완료로 기록하지 않는다.

stock-read의 새 재무 checkTile은 line178에서 fiscalPeriodEnd의 달력연도를 직접 잘라 쓰며, 공개된 LDOS 실제 화면의 FY2026과 일치한다. R&D 카드 line224도 같은 방식으로 짧은 FY 축을 만든다. domain analysis-read D59-02와 합쳐 한 오류 클래스로 보완해야 한다. 기업 요약의 FY2025/새 카드 FY2026 동시 표시는 BROWSER/OFFICIAL-CROSSCHECK에 있다.

같은 파일의 source/market 필터, symbol로 제한한 async callback, factor session과 지수 비교의 동일 날짜 검사, 순위 분모, 상대 수익률의 공통0축, 정확한 최신 FY receipt reconcile, close/date를 포함한 분석 signature와 슬라이더 유지 경계를 읽었다. async symbol guard만으로 모든 동일 종목의 새 입력 경쟁을 인증하지는 않는다. 추가 확정 actionable은 FY 외에는 없다.

daily-loop는 접힘 open 상태를 재사용하고, 한국 일정의 표시 날짜를 KST로 만들며, 캘린더 미수신/일정 없음과8개 종목 절단·생략 개수를 구별한다. 내 종목의 price는 deriveQuotePresentation을 거치고, 뉴스 링크는 http(s)와 noopener/noreferrer를 제한한다. 워치리스트 추가 항목의 이동 대상 scr-watchlist-only는 실제 index.html에 존재하므로 ‘사라진 필터’ 후보는 제외했다.

판단 조건의 renderer는 종가 기준과 거리의 정규화 의미를 툴팁에 넣고, needsMore 및 함께 필요한 조건을 표시한다. 현재3개 실제 판정 경계의 독립 실행은 domain-complete-result.json과 맞는다. 연속된 live 재렌더에서 모든 펼침/포커스 상태를 유지하는지는 코드 읽기만으로 전부 인증하지 않았다.

NOTED: liveSinceClose/koreaQuoteChip의 Number(live.pct)는 null을0으로 취급하는 구간이 있다. 그러나 실제 caller의 기본 종가·quote 정규화가 이 입력을 사용자에게 도달시키는지 확인하지 않았으므로 새 사용자 결함으로 확정하지 않는다. 기존 한국 theme 미수신+0.00% finding과 근거 수준이 다르다.
