# v59.55 흐름 점검 · 연결 개편 핸드오프 (2026-11-01)

다음 세션(클라우드)이 이어받는 문서. 맥락이지 증거가 아니다 — 지금 HEAD에서 다시 확인하고 손댄다.

## 소유자 요청 (이 배치, 원문 요지)

1. 사용자가 쓰고 싶게, 깔끔하고 쉽게. 찾기 힘든 정보·뉴스를 모아 선별·가공·분석해 쉽게 풀어 준다.
2. 전문 데이터와 개념을 연결해 전체 로직과 시장 흐름을 보여 준다.
3. 매매 작업 지원: 매수/매도, 종목·섹터 선정, 목표가·손절가, 차트 분석, 현금 비중, 관망·대응, 포트폴리오, 시장 따라가기, AI 상담.
4. 페이지마다 주제를 시각 자료로 독립 분석하고, 마지막에 전체를 연결해 의미·시장 흐름·시나리오·확인할 것·대응을 준다.
5. 부족한 데이터는 수집 파이프라인에 채우고, 데이터 연결과 자동화를 함께 챙긴다.
6. 텔레그램 글은 복붙하지 않는다. 분석 파이프라인과 AI에 넣어 가공한 뒤 다른 정보와 자연스럽게 통합한다(채널이 튀지 않게).

## 반영된 것 (v59.55, CHANGELOG 항목 a–i)

- 시장 상태 '무슨 일이 있었나': `src/domain/market/market-story.js`, `src/ui/components/market-story.js` (지연 로딩).
- 8개 시장 화면 끝 '연결해서 보면': `src/domain/market/market-synthesis.js`, `src/ui/components/market-synthesis.js`, `page-flow.js` `SYNTHESIS_PAGES`. 공유 해석(`latestMarketInterpretation`)만 읽는다.
- 매크로 주제별 6장: `src/domain/macro/macro-chapters.js`, `src/ui/components/macro-chapters.js`.
- 텔레그램 가공 표시: `src/domain/news/channel-lines.js`가 `telegram-digest.json` `signals`를 앱 문장으로 바꾼다. 신호 없는 글은 화면에 안 나오고 AI(narrative-context, 채팅)에만 들어간다. 뉴스 카드 '시장 신호', 원문 피드는 개발 모드 전용, 기사 목록에서 채널 행 제외, '텔레그램' 칩 제거.
- 수집: `history.json`에 은(SI=F) `silver` 열. 다음 Actions 실행에서 1년 백필 — 첫 실행 뒤 열이 채워졌는지 확인.
- 이전 항목: 시각 점검 A/B/C, Chart.js 퇴역, 정렬 토큰 `--sx-card-pad-x`, 흐름 5~7 (CHANGELOG v59.55).

## 열린 항목 (우선순위)

1. **목표가·손절가 저장** — `src/ui/components/stock-chart-coach.js` `PLANS`가 메모리 Map이라 새로고침하면 사라진다. 제안: 진입가·손절가·목표가만 `createStorageGateway()`로 저장(그린 선 `stock-chart-drawings.js`와 같은 방식), 투입 금액·전체 자본은 계속 저장하지 않음(v58.75 원칙). UI 모듈의 저장소 접근은 storage gateway만 허용(아키텍처 계약).
2. **화면별 AI 질문 버튼** — 종목(`stock-read.js`), 차트(`stock-chart.js`), 포트폴리오(`portfolio-read.js`), 스크리너(`screener-read.js`)에 `button.q-chip[data-action=_aioAskInPanel]` 2~3개. 패턴은 `market-story.js` `askRow`. 공용 헬퍼로 뽑을 것.
3. **화면별 깊은 분석 보강** — 시장 폭·심리·금리환율·테마·뉴스는 끝 카드만 붙었다. 각 화면에 '그림 하나 + 짧은 읽기 + 접기 하나' 분석 블록.
4. **종목·스크리너·포트폴리오 재설계** — 시나리오 노출은 이미 있음(`stock-lens.js` `buildSituationRead`, `portfolio-read.js` `scenarioExposure`). 중복 카드 금지, 구조 개편 여부는 소유자와 확인.
5. **수집 공백**: `BOK_API_KEY`(외국인 수급, 소유자 시크릿), DART 키(소유자 결정), 하이퍼스케일러 분기 capex(10-Q 누적값 차분), Form 4 정규화, 지표 예상치, ISM 수치(권리 제한), aetherjapanresearch 채널 수집 실패.
6. **미확인**: 텔레그램 변경의 실제 화면 확인(게이트만 통과), `_aioApplyTelegramDigestToScreenerDb` 스크리너 메모에 원문이 들어가는지 점검.
7. **이전 배치 보류**: 시장 폭 차트 3→1, 금리 상관 높이, 매크로 표면 WTI 차트, 테마 산점도 라벨 겹침, 원칙 그래프 노드 겹침, 수익률 곡선 라벨 충돌.
8. **소유자 결정 필요**: 국면에 따른 현금 비중 정책, 알림 인프라.

## 소유자 원칙 (메모리에만 있던 것 — 반드시 지킬 것)

- 답변은 한국어, 화면·답변 어디에도 이모지 금지.
- 출처(제공자·URL)는 숫자 옆에 쓰지 않는다. 날짜는 남기고, 출처는 호버와 페이지별 '데이터 출처' 접기에.
- 미국이 먼저, 한국은 '한국'으로 두 번째.
- 섹션마다 그림 하나 + 짧은 읽기(3~5줄, 130~230자) + 접기 하나. 표면은 쉽게, 전문 분석은 접기로(지우지 말고 옮긴다).
- 사용법 설명은 줄이고 분석·연결 문장은 유지.
- 텔레그램 원문은 화면에 내지 않는다 — `channelLineFor`/`signalLine`을 거친다.
- 근거로 반대 의견을 낸다(소유자는 비전문가). 라벨은 실제 주 데이터로 확인한 뒤 붙인다.
- 편집을 모은 뒤 영향 범위 QA 한 번(`node scripts/qa-runner.mjs affected --files a,b`, 백그라운드). QA 도중 소스 수정 금지(소스 변경 감시가 실행을 실패시킴).
- 커밋·푸시는 요청 시에만, 배치 끝에 푸시 여부를 한 번 묻는다. 푸시 전 origin을 병합하고 충돌 파일·충돌 표시를 확인, 푸시는 `set -e`로 따로.
- 기록은 `record-fix.mjs`(change-only 항목) → `generate-workspace-state --write` → `ci-text-pin-ratchet-check --write`. 생성 파일 손편집 금지.
- 게이트 주의: `index.html`·`js/aio-data.js` 줄 수 증가 금지(`ci-decomp-hotspot-check`), 부팅 번들 예산(새 화면 블록은 지연 `import()`), 로컬 `finite` 대신 `readNumber`, 정규식 용어는 경계 포함, 터치 텍스트 최소 11px, 보조 텍스트 예산 클래스 단어(caption/hint/note/meta 등) 피하기.
- 서브에이전트는 읽기 전용, opus medium.

## 다음 행동

열린 항목 1·2를 먼저(작고 독립적), 그다음 3, 4는 소유자 확인 후.
