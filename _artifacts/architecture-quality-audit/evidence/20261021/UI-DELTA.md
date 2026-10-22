> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# UI 고정 REF 추가 검토

MODE: review | VERDICT: FAIL | REF: d36bb256ddf60468d6c7a134628053c5796be6be (v58.52)

FINDINGS: 2 actionable (warning / medium). 제품 소스 수정·Git mutation·producer·외부 API·유료 AI 실행 없음.

## 범위와 읽기 증거

기준은 df6f0b33의 `ui-pages-reading.tsv` FULL 30파일이다. 각 기준 SHA-256을 `git show df6f0b33:<path>` 원문과 대조해 모두 일치함을 확인했다. 16개 변경 경로의 전체 diff(4 삭제·11 수정·1 신규)를 읽고 의미를 검토했다. 신규 knowledge-search.js, 추가 소유 portfolio-trade-journal.js UI/domain 두 파일은 전문을 읽었다. 최종 원장 33행 = 현재 29파일 + 삭제 4파일이며, FULL 18행·FULL_DIFF_REVIEW 15행이다. 변경 없는 15파일의 FULL은 기존 전문 읽기 증거와 동일 hash를 계승한 것이며 이번에 다시 전문을 읽었다는 뜻이 아니다.

스킬은 cstack review와 review-rubric을 읽었다. correctness/root-cause lens로 검토했으며 다른 담당자 결론을 독립 투표로 세지 않았다. INDEPENDENCE: limited (동일 모델의 독립 담당자). 브라우저는 root 소유이므로 실행하지 않았다.

## ACT ON UI-D01 — 결측 평가정보를 원칙 위반/준수로 변환

- 위치: `src/ui/panels/portfolio-trade-journal.js:118`~`122`, `src/domain/portfolio/trade-journal.js:180` 부근 rulesMirror.
- 트리거: 현금을 입력하지 않았거나 자산 평가가 보류된 보유 2개가 있고, 저장된 내 원칙은 현금 최소 20%, 종목 최대 1개이다.
- 실패: derivePortfolioSurface가 `cashPct:null`, `holdingCount:2`를 내는데 bookOf는 `cashPct:0`, `weights:[]`를 넘긴다. 화면은 `현금 최소 20% — 벗어남 — 지금 현금 0.0%`, `보유 종목 최대 1개 — 지킴 — 지금 0개`를 표시한다. 실제 보유 개수와 결측 상태가 모두 바뀐다.
- 실행 증거: ui-delta-repro.mjs는 고정 REF의 derivePortfolioSurface, 추출한 실제 bookOf, 실제 rulesMirror를 실행했다. 위 결과를 assert하고 통과했다. 렌더 경로는 pages/portfolio.js render → renderTradeJournal → renderDynamic → rulesMirror → `지킴/벗어남` 텍스트이다.
- 수정 방향: 현금 결측을 유지하고, 보유 개수는 평가 여부와 분리해 surface.holdingCount/holdingsKnown으로 전달한다. 비중 판정만 weights를 쓴다.

## ACT ON UI-D02 — 손익 보류 원가/시세를 다시 비교해 -99.9% 손절 위반 생성

- 위치: `src/ui/panels/portfolio-trade-journal.js:120`~`121`.
- 트리거: MSFT 1주, 매수가 140000 KRW, 시세 통화 미선언(상장 통화 USD), 확정 종가 100 USD, 환산 근거 없음, 내 손절 원칙 10%.
- 실패: surface는 `costCurrencyState:cost-price-mismatch-held`, `totalPnlPct:null`로 손익을 보류한다. bookOf의 `!row.currency`가 참이라 USD raw price 100을 KRW raw avgCost 140000으로 나눠 `원칙보다 깊은 평가 손실 MSFT -99.9%`를 표시한다. surface의 상장 통화 fallback 및 환산/보류 계약을 우회한 신규 계산이다.
- 실행 증거: ui-delta-repro.mjs가 실제 surface → bookOf → rulesMirror 경로에서 손익 보류와 -99.9% 위반의 동시 발생을 assert했다.
- 수정 방향: 이미 surface가 같은 기준 통화로 만든 row.value/row.cost 및 costCurrencyState/환산 상태를 사용하고, 손익 보류 행은 판정 보류한다.

## 나머지 delta 판단

지식 검색 분리는 동일 ranker를 유지하며 glossary first-search에서 index와 module을 함께 불러온다. research-shell의 import도 새 모듈로 바뀌었다. 삭제된 UI knowledge evidence/graph/path/tree는 고정 REF production import 잔존이 없다(동명 domain 파일은 별개). supplied-material bridge는 기존 metadata 필드만 새 reference-index에서 소비한다.

news 미확인 라벨, screener ticker-prefix 검색·PE 표기 상한·독립 후보기록 문구·비동기 레슨 갱신, themes KR 진입 handoff·상세 close-focus follow·index earnings 호출을 주변 호출자와 대조했다. 이 범위에서 추가로 입증한 결함은 없다. themes의 60초 observer 및 타이머와 화면 레이아웃은 코드 검토만 했으며 실브라우저 검증 주장을 하지 않는다. inline→CSS 이동은 대응 class 및 glossary/portfolio stylesheet를 대조했고, 전체 화면 시각 동등성을 인증하지 않는다.

## 저장·조회·백업 경계

UI onClick는 normalizeTrade/normalizeJournal 또는 normalizeRules 후 `_aioPortfolioTrades.write`를 await한다. classic shell의 write는 `_pfDeclarationWrite(PF_TRADES_KEY)` → createDeclarationsStore.write → runtime cache + safeLS의 기존 경로를 사용한다. read는 getPortfolioTrades가 lock 검사 후 declarations store를 읽는다. `aio_portfolio_trades`가 core Vault personal/sensitive key 목록과 financial-security PERSONAL_KEYS에 포함됨을 고정 REF에서 확인했다. safeLS는 PIN이 잠겨 있으면 영구 저장을 거부한다. 따라서 잠긴 상태가 평문 ciphertext overwrite를 만든다는 후보는 DISMISSED이다. 실제 PIN 암호화 lifecycle은 실행하지 않았으며 이 검토로 인증하지 않는다.

백업 snapshot은 getPortfolioTrades를 포함하고, export는 거래 key의 암호화 잠금도 검사한다. portfolio-backup.build/parse가 normalizeJournal을 사용하며, restore는 trades 섹션이 있으면 선언 저장 경로로 기록한다. 고정 REF의 실제 buildPortfolioBackup→JSON→parsePortfolioBackup에서 거래 1개와 maxPositions 규칙의 일치 roundtrip을 실행해 PASS했다. 이전 bundle에 trades 섹션이 없으면 저장 일지를 유지하는 의도는 코드 주석/restore 조건과 일치한다.

## 실행한 검사

- `node _artifacts/architecture-quality-audit-20261021/ui-delta-repro.mjs`: 두 결함 재현 assert 통과 + backup roundtrip PASS.
- `node _artifacts/architecture-quality-audit-20261021/ui-delta-ledger.mjs`: 기준 hash 30개 일치, 원장 33행 생성.
- 모든 제품 원문과 repro module은 `git show <고정 SHA>:<path>`로 읽었다. 작업 트리의 동시 변경을 검토 대상으로 혼합하지 않았다.

SAFETY FACT: surface의 결측/통화 보류가 새 journal mirror까지 유지된다는 계약은 반증됨(실행 증거 단계 4). 브라우저·배포·잠금 UI lifecycle·전체 QA는 미실행. 커밋·푸시·배포 없음.
