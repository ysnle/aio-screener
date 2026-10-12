# 10월 구조 개선 변경 인벤토리

이 목록은 누락 방지와 의도·근거 탐색용이다. 각 행을 독립적인 의미 검수 PASS로 보지 않는다. 현재 코드 경로의 심층 리뷰는 연결된 영역 문서에 있으며, 과거 배포 SHA 재현·394편 콘텐츠 전편·운영 AI 답변은 별도 미검증이다.

확인한 non-data/non-merge commits: 79. 관련 ledger P1363~P1643: 281개. 기록상 Codex·Claude·Command Code 작업이 통합되어 있으므로 모든 변경을 Claude 단독 저작으로 단정하지 않는다.

## 커밋별 작업 의도와 소스 경계

| 날짜·SHA | 작업 의도(실제 subject) | 변경 파일 수 | 연결된 검토 |
|---|---|---:|---|
|2026-10-12 57833f62|v57.42: scenario guidance, chart intervals, AI narrative regime link, live research observations, regime radar, credit tiers, chart evidence, stock+company summary, sector moves, research shelf (P1632-P1642)|91|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-12 151f6e4e|v57.38-v57.41: responsive/identity, entity quality, market-separated ranking, regime scenarios, takeover review (P1618-P1631)|156|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-11 42d3988f|v57.37: P1617 follow-up - CLOSED_CURRENT promotion matches the session layer's KR calendar rule|1|문서·기록 전용/관련 계약 검사|
|2026-10-11 6fc64e25|chore: remove stray live smoke screenshot|1|문서·기록 전용/관련 계약 검사|
|2026-10-11 a3bfc153|v57.37: P1617 - calendar-derived closed-venue bound for KR indices (KRX holiday + weekend no longer fails the snapshot attempt)|7|문서·기록 전용/관련 계약 검사|
|2026-10-11 3ae992ad|v57.37: P1616 - P1608/P1609 gate contract sync (chat citation marker, evidence paths, web-search headless assertions)|13|[ENTITY](./ENTITY-FINDINGS.md)|
|2026-10-11 1913ebbe|v57.37: 전수 실브라우저 점검 기반 데이터 정합성·기준일 정직성 수정 (P1610-P1614)|245|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-11 dffd7400|v57.32: operations quality (Codex) + frontend visual pass and audit remainder (P1594-P1600, R701)|138|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-10 d5b7d19b|v57.31: data accuracy, theme taxonomy, sentiment composite and Codex frontend audit fixes (P1566-P1593, R700)|177|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-09 0cdb6199|Add the second re-check findings (P1557-P1565) to the v57.30 report|1|문서·기록 전용/관련 계약 검사|
|2026-10-09 d50f2f55|Unify the remaining VIX and Fear & Greed ladders, remove position percentages and invented scenario numbers, and harden the 13F, concentration and fast-plane checks (v57.30, P1557-P1565)|35|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-09 5687d308|Add the P1551-P1556 findings and the operator deadlines to the v57.30 report|1|문서·기록 전용/관련 계약 검사|
|2026-10-09 e72afabe|Guard chat visuals and signals against missing inputs, label scores as references, and give the BOK audit a grace window (v57.30, P1551-P1556)|27|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-09 7f6f1d8e|Record the hotspot growth for P1550 and add the second-round findings to the v57.30 report|2|[ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-09 aa432ff1|Stop attributing issuers by short aliases, acronyms and Korean substrings (v57.30, P1550)|9|문서·기록 전용/관련 계약 검사|
|2026-10-09 eeb8c2cd|Regenerate the workspace state after the test and gate fixes (v57.30)|1|문서·기록 전용/관련 계약 검사|
|2026-10-09 1409df7e|Remove grades, composites and instruction text from the technical, KR, portfolio and AI surfaces; harden producers and gates (v57.30, P1538-P1549)|44|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-09 cb65f553|Record the decision table and the full QA result in the v57.30 handoff report|8|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-09 b3d21407|Resolve the remaining owner-decision items in the recommended direction (v57.30, P1530-P1537)|59|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-08 a921b29c|Handoff report: final state of the v57.30 session|8|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-08 b7d0bbd6|Trend chart: thin month labels by available spacing (P1529)|15|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-08 91b30932|v57.30: version bump and ledger entries P1520-P1528, R691-R693|34|[ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-08 62ee5270|Fix four verified defects found by the structural review, each with a failing-first regression|7|[MARKET](./MARKET-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-08 139ac961|Industry map: separate product-linked companies from company-level role references (audit H88/H89)|2|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-08 c67af00f|Rewrite trading instructions and unsourced figures in live UI text as observation conditions|11|[MARKET](./MARKET-FINDINGS.md)|
|2026-10-08 ad6699c2|13F scale review now covers every consumer of filed dollar amounts|3|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-08 e4e66690|Harden the main-advance guard after independent review|4|[ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-08 7d46425b|Worker deploys converge after a data-only main advance; pictograph gate no longer depends on Node's Unicode tables|8|[ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-08 1d5769dc|Release v57.29: integrate local research UI and architecture improvements|121|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-07 ef7b8060|P1509: one rounding rule for the Fear & Greed day change across screens; ratchet and workspace state|14|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-07 5c53391a|Refresh generated workspace state after origin merge|2|문서·기록 전용/관련 계약 검사|
|2026-10-07 02bf8af7|P1508: artifact size headroom watchdog, 13D/G budget ahead of issuer fill, VIX badge close fallback|7|[ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-07 ed69d84a|v57.27: integrate owner X history (18 posts) — CFTC futures positioning, 50-day extension in ADR units, valuation/hike-cycle/capital-allocation notes (P1507)|47|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-07 f5fafa45|Record P1506 freshness baseline after origin data merge|9|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-07 378128e3|v57.25–v57.26: UI audit fixes, emoji removal, market-structure schedule, owner-material notes, telegram and news selection, sources off screen (P1498–P1506)|66|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-06 11e7c0de|v57.24: refresh candidate check reads staged deletions without rename folding (P1497)|31|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-06 f92f11e1|v57.23: relationship guides in Korean, SEC quarterly revenue and income trend (P1495-P1496)|36|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-06 1a6b9462|Archive unapplied Codex semantic-operations notes after integration audit|3|문서·기록 전용/관련 계약 검사|
|2026-10-06 449ae9c7|v57.19–v57.22: research library redesign, reading text, and Codex review fixes (P1462–P1494)|296|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-04 a4d1e080|v57.18 closeout: record the +2 workspace ratchet move (P1127/R620)|1|[ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-04 08ddd6e4|v57.18 final closeout fixes: rankHold render-path reference, ledger performance pointer race, masters compare accumulation preserved, vault e2e fixture moved with the contract|11|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-04 83acdab7|v57.18 follow-up: record the legacy-shell line ratchet raise (P1127/R620)|1|[ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-04 36f33034|v57.18: deep-review overhaul — data and calculation integrity (P1449-P1461)|69|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-04 99975a4d|v57.17: live invariant accepts the shared-Worker-only AI policy (P1448)|25|[ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-04 8ccfd1b6|v57.16: review fixes — completed-session factors, one model for ranking and validation, one currency for portfolio panels, SEC cash chain, benchmarks by market (P1442–P1447)|59|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-04 8b32da90|v57.15: theme detail flow from screener medians; price-vs-results and ROE readings on 재무 공시 (P1441)|34|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-04 dec65f4c|v57.14: SEC fiscal history as its own bounded artifact behind a manifest pointer; sub-theme ranking reading (P1440)|34|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-04 1eeabcd4|v57.13: screener refresh unblocked — SCR-OS-00 bounds the universe by the curated recordCount instead of 873 (P1439)|25|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-04 519758ac|v57.12: page redesign with connected readings — 종목 요약 · 차트 · 재무 공시, 스크리너, 포트폴리오 (P1434–P1438)|50|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-04 831599c0|v57.11: OpenAI fetch uses redirect 'manual' and refuses 3xx — Workers throw TypeError on redirect 'error' (P1433 follow-up)|2|[ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-04 74172354|v57.11: trim the OpenAI key before the Authorization header; report the upstream error class (P1433 follow-up)|2|[ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-04 f8d1a8af|v57.11: server AI unblocked for October by owner-stated prior spend; propagation-safe AI-proxy deploy check (P1433)|27|[ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-04 7396ce78|v57.10: refresh boot interaction report after merge QA|1|문서·기록 전용/관련 계약 검사|
|2026-10-04 c31a15fb|v57.10: five-stage restructure — one rule registry, missing-data states, 종목 as one screen, connected page flow, 오늘 daily loop (P1428–P1432)|75|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 02d9ccfd|v57.09: 거시 logic re-check and visual layer — one rule set, gauges on the deciding variable, regime map, traffic-light tiles (P1427)|38|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 ae9a2ed2|v57.08: 거시 경제 explains direction, equity impact and transmission; FRED macro history artifact (P1426)|47|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 2ee61aee|v57.07: 거시 rebuilt as two evidence boards — 거시 경제 and 금리 · 환율; fixed-threshold verdicts and dead legacy writers retired (P1425)|52|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 9bb7b3fe|v57.06: Codex GPT-6 Luna shared AI and personal provider contracts, renumbered onto main (P1421-P1424)|88|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 bc793b1d|v57.05: 차트 · 기술 leads with the stock chart; six-axis summary replaces the 0-100 health score (P1420)|34|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 8833f8c7|v57.04: screener position and post-hoc validation; yen carry score removed (P1419)|37|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 c6a40912|v57.03: 포트폴리오 점검 (Ghostfolio X-ray style) and hidden currency mixes in the totals (P1418)|36|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 9b38b5fd|v57.02: 테마 — sub-theme relative strength and the AI capex flow with lead times (P1417)|36|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 86771af2|v57.01: 시장 폭 leadership and index confirmation — highs/lows, 4% movers, 40-day ratio, distribution days, drilldown (P1416)|41|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 fbd76d94|v56.99: refresh promotion gate records producer deletions (P1415)|7|문서·기록 전용/관련 계약 검사|
|2026-10-03 0b36a546|v56.99: Codex structural review steps 2-4 — offline cache, legacy digest retired, sentiment renders, Worker transport (P1410-P1414)|45|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 33b1cf8d|v56.98: keep the bot's data identity in operations-status after the merge|1|문서·기록 전용/관련 계약 검사|
|2026-10-03 9e0a913d|v56.98: Codex structural review step 1 — entity identity, portfolio currency, lifecycle/HTTP/contract fixes (P1406-P1409)|45|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 ebd2cb2e|v56.97: Codex review fixes — one close basis, missing is not a verdict, contract/PIN/SEC/news/glossary (P1399-P1405)|55|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 22874840|v56.96: stock chart with evidence on price + setup state; a16z SoM II and chart techniques integrated (P1397-P1398)|39|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-03 91a98972|v56.95: USD/JPY + range-relative oil, 시장 폭 trend charts, 투자 심리 board (P1394-P1396)|46|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-02 cdb8bc58|v56.94: 시장 상태 six-axis regime board; score and swing/day toggle retired from UI (P1392-P1393)|43|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-02 cdb02857|v56.93: briefing rebuilt as a connected read, score v4, news important/full split (P1388-P1391)|53|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-02 1905f9d5|v56.92: 오늘 screen review — futures cards, point moves, diverse news, score fallback (P1380-P1387)|48|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-01 91c26dc4|v56.91: reliable refresh dispatch, S&P 500 universe review, F&G gate (P1377-P1379)|41|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md)|
|2026-10-01 9c8a67c6|docs: structure proposal progress and open operational decisions|1|문서·기록 전용/관련 계약 검사|
|2026-10-01 f4276d20|v56.90: data quality — Korean/session-true AI analysis, news coverage, SEC bank revenue, FOMC target range (P1372-P1376)|41|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-01 5ef98c19|v56.89: 8-screen navigation (phase 1), sourceless widget/grade cleanup (P1371), owner decisions recorded|42|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-01 f5836658|v56.88: Vault salt-only recovery, page-scope verdicts, SEC wording, RRG split, metric consistency, 13F retention (P1363-P1370)|56|[ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|
|2026-10-01 45742cf4|v56.87: observation integrity, Vault auth, provenance, AI budget, durable RRG, SEC scope (P1345-P1362, Codex)|206|[MARKET](./MARKET-FINDINGS.md), [ENTITY](./ENTITY-FINDINGS.md), [ARCHITECTURE](./ARCHITECTURE-FINDINGS.md), [UI-AND-AI](./UI-AND-AI-CHECKS.md)|

## 개별 작업 기록(P entry)

제목은 현재 ledger에서 추출했다. 원문 원인·수정·검증은 change-inventory.json에 해당 범위만 보존했다. 제목만 나열하고 구현을 자동 통과시키지 않는다.

| ID | 의도·문제 기록 제목 | 증거 경계 |
|---|---|---|
|P1363|v56.88 - Salt-only legacy Vault no longer dead-ends every unlock (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1364|v56.88 - Market-score verdict and caveat stay on score pages and describe the close-basis model (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1365|v56.88 - Unselected fundamental page no longer reads as an SEC receipt failure (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1366|v56.88 - A missing 1/5-session return no longer discards a valid durable RRG point (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1367|v56.88 - One VIX band across home, regime summary and chat (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1368|v56.88 - Signal page legacy widgets refresh on native navigation and never invent VIX (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1369|v56.88 - Diagnostic scores and units say what they measure (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1370|v56.88 - 13F manager projections stop re-hashing unchanged quarters every day (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1371|v56.89 - Sourceless widgets and ungrounded grades no longer read as data (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1372|v56.90 - Server AI market analysis must be Korean, heading-free and session-true (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1373|v56.90 - News selection covers Korea, FX/bonds and credit (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1374|v56.90 - SEC fundamentals cover banks reporting revenue net of interest expense (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1375|v56.90 - Policy-rate surfaces show the FOMC target range, not the FEDFUNDS monthly average (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1376|v56.90 - Remaining sourceless sinks: VIX9D/VIX6M cells and the macro consumer-confidence card (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1377|v56.91 - refresh-data actually runs every 30 minutes (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1378|v56.91 - Screener universe membership review before the hard expiry (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1379|v56.91 - F&G semantics gate accepts a newer intraday headline (2026-10-01)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1380|v56.92 - Home core news shows 4 diverse, translated headlines without developer notes (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1381|v56.92 - 오늘 headline cards: index futures, rates and oil (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1382|v56.92 - Headline-only earnings news carries estimate/actual context (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1383|v56.92 - Home summary uses only a verified Korean server analysis; no '?' template, no fabricated 50 (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1384|v56.92 - Reference score shows the previous completed close while the new close is pending (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1385|v56.92 - Newly added macro series publish an observed freshness marker (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1386|v56.92 - Static-db calendar gate honours the official schedule instead of breaking on each release day (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1387|v56.92 - Home headline cards show the point move and the secondary row shows changes (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1388|v56.93 - Reference score: macro/oil/credit inputs reach the model and F&G is no longer double-counted (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1389|v56.93 - Briefing rebuilt as schedule → connected read → asset drivers → next checks (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1390|v56.93 - Supplied-material frameworks integrated into the briefing read (real yield, curve, breadth, credit) (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1391|v56.93 - News screen leads with important stories; titles are real headlines; developer markers removed (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1392|v56.94 - 시장 상태 is a six-axis regime board; the 0-100 score and swing/day toggle leave user surfaces (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1393|v56.94 - Leftover developer copy removed (AI helper status, briefing date line, repeated disclaimers) (2026-10-02)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1394|v56.95 - Regime FX axis adds USD/JPY; oil is judged against its own 1-year range (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1395|v56.95 - 시장 폭 shows each participation measure as a trend chart with labelled axes (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1396|v56.95 - 투자 심리 is five equal cards and one synthesis; retired score and sourceless SKEW removed (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1397|v56.96 - 차트 · 기술: candlestick chart with VCP, pivot, events and an evidence panel (no grade) (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1398|v56.96 - Supplied research integrated: a16z State of Markets II, chart techniques, Raschke rules, earnings-slope principle (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1399|v56.97 - Market inputs share one close basis; missing is not a verdict; interpretation is tagged as a hypothesis (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1400|v56.97 - Architecture contract updated for the rebuilt briefing, 시장 상태, 시장 폭 and news screens (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1401|v56.97 - Portfolio PIN accepts the vault contract (4-20 characters); schedule separates time passed from result received (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1402|v56.97 - SEC equity: parent-company equity first; a conflicting NCI-inclusive tag no longer becomes the reported equity (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1403|v56.97 - News: a server backstop item from an older cycle is not restored as current (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1404|v56.97 - Glossary: market/limit orders, VWAP, accumulation/distribution, institutional streaks, breadth screen (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1405|v56.97 - 차트 · 기술 follows the stock opened on the 종목 screen (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1406|v56.98 - AI entity resolution: whole-word names and registry-confirmed symbols (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1407|v56.98 - Portfolio risk weights and totals carry one base currency (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1408|v56.98 - Event dedupe keeps the next genuine update; earnings retry; HTTP status kept; news mount cleanup (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1409|v56.98 - Return contract rejects unparseable times and mixed horizons (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1410|v56.99 - Service worker: data cache keyed without the ?t= cache-buster; writes tied to the event (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1411|v56.99 - Legacy briefing digest retired (hidden DOM, page/live hooks, translation requests) (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1412|v56.99 - Sentiment page: one input adapter, coalesced renders (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1413|v56.99 - Worker transport boundary: body deadline, streamed size cap, redirect policy (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1414|v56.99 - Fast-quote snapshot revision covers previous close, session and quality (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1415|v56.99 - Refresh promotion gate: producer deletions are part of the candidate (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1416|v57.01 - 시장 폭: 52-week highs/lows, 4% movers, 40-day ratio, distribution days and a contributor drilldown (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1417|v57.02 - 테마: sub-theme relative strength table and AI capex flow; history event also heard on window (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1418|v57.03 - 포트폴리오 점검 (single holding, single currency, region/type/sector/cash shares) and hidden currency mix in the totals (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1419|v57.04 - Screener 상위 N% instead of A-F, ranking post-hoc validation panel, yen carry score removed (Bank of Korea rate used as the Japan gap) (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1420|v57.05 - 차트 · 기술: retired market-health score replaced by the six-axis summary; stock chart first (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1421|v57.06 - AI migration preserves one budget and credential boundary (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1422|v57.06 - Personal data connections preserve provider contracts and credential ownership (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1423|v57.06 - Native provider transport and lossless concurrent translation handoff (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1424|v57.06 - Initialize shared AI readiness independently of translation activity (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1425|v57.07 - 거시 hub rebuilt as two evidence boards; fixed-threshold verdicts and dead legacy writers retired (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1426|v57.08 - 거시: direction, equity impact and transmission instead of isolated numbers (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1427|v57.09 - 거시: one rule set across the page, and every verdict shown as a picture plus a sentence (2026-10-03)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1428|v57.10 - Meaning fixes: one rule registry, no verdict from a missing input, guide describes the screens that exist (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1429|v57.10 - Missing-data experience: one empty state, no wall of dashes, a reading even when the live quote is absent (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1430|v57.10 - 종목 integration: 요약 · 차트 · 재무 공시 share one company; index cards open their own chart (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1431|v57.10 - Page logic flow: section leads, verdict first, next steps with reasons (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1432|v57.10 - 오늘 daily loop: 어제와 달라진 점 · 내 종목 · 다가오는 일정 · 내 종목 뉴스 (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1433|v57.11 - AI proxy: owner acknowledgement of a legacy month's spend, and propagation-safe deploy verification (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1434|v57.12 - 종목 요약: one connected reading of the stock with two pictures (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1435|v57.12 - 종목 차트: reading first, stage and template pictures, evidence folded (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1436|v57.12 - 재무 공시: annual trend from SEC filings, tied to price (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1437|v57.12 - 스크리너: the ranking explained before the table (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1438|v57.12 - 포트폴리오: the holdings read against the market (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1439|v57.13 - Screener refresh blocked by a hardcoded universe size (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1440|v57.14 - Fiscal history as its own artifact; sub-theme ranking reading (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1441|v57.15 - Theme detail flow from artifact data; sharper price-vs-results reading (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1442|v57.16 - Screener factors use completed sessions only (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1443|v57.16 - Ranking and validation use one model; the validation view says what it measured (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1444|v57.16 - 13F ledger scope and turnover label; KR themes read from completed closes (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1445|v57.16 - Portfolio panels share one currency and denominator (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1446|v57.16 - 재무 공시: cash chain, ROE basis, share count (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1447|v57.16 - Benchmarks by market (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1448|v57.17 - Live invariant check accepts the shared-Worker-only AI policy (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1449|v57.18 - The shipped SEC projection reconciles parent-company equity itself (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1450|v57.18 - 13F history lane composes amendments with the same policy as the reference lane (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1451|v57.18 - Stored screener validation carries the model fingerprint; one weights module everywhere (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1452|v57.18 - A failed re-rank discards the previous ranking; the backtest IC panel is visible again (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1453|v57.18 - Portfolio surface writers print the declared currency, not a hard-coded $ (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1454|v57.18 - Portfolio read: one currency hold, one value-weight denominator per dimension, one benchmark population (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1455|v57.18 - Ledger account performance reaches the screen even when the price-history check holds, and 수정 opens the form (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1456|v57.18 - Causal narrative sentences name level, direction and window on one observation basis (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1457|v57.18 - Breadth contributors carry asset type and a corporate-action suspicion flag (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1458|v57.18 - Macro sparkline says its date span and cadence; the theme cycle pill uses the rendered view's denominator (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1459|v57.18 - Ticker A is Agilent everywhere; chart range tabs respect the available history; news aliases match on word boundaries (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1460|v57.18 - Screener workbench user copy uses user vocabulary (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1461|v57.18 - Screener workbench user copy uses user vocabulary (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1462|v57.19 - 13F current/prior quarters state how their rows were assembled (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1463|v57.19 - The validation identity follows the weights the screen ranks with (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1464|v57.19 - The percentile column is called 백분위 (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1465|v57.19 - Forward candidate record of the ranking actually shown (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1466|v57.19 - Portfolio return attribution — market, sector, stock, FX, cash (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1467|v57.19 - 재무 공시 compares the company with same-sector filers (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1468|v57.19 - Factor overlap is measured, not asserted (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1469|v57.19 - Term premium (Kim-Wright) on the rates page (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1470|v57.19 - SEC page projection back under its 1 MiB bound (2026-10-04)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1471|v57.20 - Industry map relations are typed; list order is no longer a supply chain (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1472|v57.20 - Glossary definitions corrected; one concept source shared with the learning screens (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1473|v57.20 - 분석 프레임: issue-led analysis notes in a professional register (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1474|v57.20 - Unified knowledge search from the glossary (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1475|v57.20 - Lesson sources support the lesson; K7, O2, G7 corrected (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1476|v57.20 - Learning screens: entry order, readable links, guide consistency (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1477|v57.20 - Refresh cadence by kind of knowledge (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1478|v57.20 - Nathan framework sources name the post they are (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1479|v57.20 - Masters: what each way of managing money is for, and what 13F shows of it (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1480|v57.21 - 리서치 라이브러리: one research shell replaces the four learning pages (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1481|v57.21 - Reading text: lessons, AI foundations, industry nodes, domains and the dictionary read as short stories (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1482|v57.21 - AI 기초: F0 modules stuck on loading; process modules and a duplicate listed (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1483|v57.21 - Atlas deep links: view and domain parameters ignored or overwritten (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1484|v57.21 - Library loads with no failure state or retry (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1485|v57.21 - Masters: fail-closed value reconciliation restored; lookup copy in plain language (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1486|v57.21 - Relationship guides and the column link: old embedded view and an internal metric code (2026-10-05)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1487|v57.22 - 리서치 라이브러리: 정의·계산·도식이 서로 다른 말을 하던 항목 교정 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1488|v57.22 - 운용사·13F: 추가 보유만 담은 수정공시를 분기 전체처럼 비교 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1489|v57.22 - 같은 10년물에 오늘 +4bp, 금리·환율 −5bp (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1490|v57.22 - 스크리너 931종목 전부 순위 보류 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1491|v57.22 - META가 종목 화면에서 기술(XLK), 테마에서 통신(XLC) (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1492|v57.22 - 재무 공시가 현금흐름 없이 매출·이익만, PEG에 가격 판단을 붙임 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1493|v57.22 - 뉴스: 한국어 표시 아래 영어 기사, 오늘 08시 창과 10/4 기준시각 불일치, 맥락 없는 텔레그램 글 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1494|v57.22 - 화면 간 해석 기준·문구 불일치 일괄 정리 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1495|v57.23 - 관계 가이드 노드가 영어 용어 위주로 쓰여 있음 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1496|v57.23 - 재무 공시가 연간 10-K만 보여 최근 실적을 알 수 없음 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1497|v57.24 - 운영자 수동 데이터 갱신이 커밋 단계에서 계속 실패 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1498|v57.25 - 데이터 갱신 뒤 CI 실패 2건과 13D/G 발행사명 전부 공백 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1499|v57.25 - 화면 전수 점검에서 찾은 표시 결함 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1500|v57.25 - 화면 전체 이모지 제거와 재유입 차단 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1501|v57.25 - 다가오는 일정이 의사록·만기·휴장을 빼고 "일정 없음"으로 표시 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1502|v57.25 - 소유자 제공 자료의 관점을 분석 노트로 통합 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1503|v57.26 - 텔레그램 요약의 미디어 전용 오집계, 부분 문자열 분류, 첫 태그 표시 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1504|v57.26 - 뉴스 선별에 관련성 하한·출처 상한이 없어 스팸과 콘텐츠 농장이 섞임 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1505|v57.26 - 출처 문구 노출, 화면 간 중복, 빈 종목 화면, 혼합 라벨, 반복 태그 (2026-10-06)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1506|v57.26 - 거시 사분면과 판정 카드의 기준 차이 미설명, 지표 칸 배치, 고점 배지 문구 (2026-10-07)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1507|v57.27 - 소유자 X 기록 자료 통합 — 포지셔닝·진입 위치·밸류에이션·인상기 사례 (2026-10-07)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1508|v57.27 - 데이터 증가가 다음 코드 CI에서야 드러나던 운영 공백과 상단 VIX 빈칸 (2026-10-07)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1509|v57.27 - 같은 날 공포·탐욕 1일 변화가 홈 +3, 투자 심리 +4 (2026-10-07)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1510|v57.28 - 같은 이름의 기간·기준일이 화면마다 다른 계산을 가리킴 (Codex 브라우저 감사 H01·H02·H03·H18·H24·H31) (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1511|v57.28 - 피드의 주제 이름이 기사 관련성의 증거로 계산됨 — 날씨·바카라 글이 실적·한국 뉴스로 게시 (H04·H05·H06) (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1512|v57.28 - 스크리너 실행 결과·표·다음 종목 링크가 서로 다른 집합 (H43·H44·H45) (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1513|v57.28 - 13F 금액 단위 1,000배 불일치·역조회 누락·비교의 거짓 빈 결과 (H97·H98·H99·H101·H103) (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1514|v57.28 - AI가 화면과 다른 근거로 답하고 질문 버튼이 매매 지시를 약속 (H13·H104) (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1515|v57.28 - 라이브러리의 정의·계산·인과 단정과 탐색 구조 (H52~H55·H59~H66·H70~H78·H81·H106) (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1516|v57.28 - 관측 사실보다 강한 해석 문구 (H08·H11·H12·H15·H16·H19·H21·H25·H26·H29·H32·H33·H34·H38·H40·H42·H49) (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1517|v57.28 - 감사 2차: 재무·스크리너·13F·테마·시장 폭·거시·포트폴리오·레슨의 범위·근거 표기 (H09 H10 H14 H17 H20 H22 H23 H27 H28 H30 H35~H39 H41 H46~H48 H50 H51 H79~H86 H100 H102 H112~H114) (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1518|v57.29 - 공유 기반 소유권·본문 제한 시간·전체 QA 증명 경계 정비 (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1519|v57.29 - AI 공개 검증 정책을 native ESM으로 분리하고 모듈 부재를 안전하게 처리 (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1520|v57.30 - Worker deploys stranded when main advances only by data-refresh commits (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1521|v57.30 - P1500 pictograph gate verdict depended on the Node Unicode data version (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1522|v57.30 - 13F scale-review withholding covered only the top rows, comparisons and shards (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1523|v57.30 - Live UI text, glossary and help gave trading instructions and unsourced figures (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1524|v57.30 - Industry map listed company roles as if they were direct suppliers of a node (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1525|v57.30 - AI publication let a current-sensitive count or magnitude through without evidence (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1526|v57.30 - Compatibility event adapter called removed listeners and merged different Date/Map/Set events (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1527|v57.30 - Home KPI trend included a row after the close basis and disagreed with 시장 상태 (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1528|v57.30 - Macro chain compared a real yield and a breakeven observed on different days (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1529|v57.30 - Trend chart month labels overlapped once the time range grew, turning browser-viewport red on main (2026-10-08)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1530|v57.30 - 13F scale detection flagged the normal filer of a two-filer security next to the odd one (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1531|v57.30 - Industry map product lines were English registry text on a Korean page (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1532|v57.30 - A fast-plane snapshot whose quotes were all stale was adopted ahead of the durable snapshot (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1533|v57.30 - The pure exchange calendar lived in the AI layer, five domain modules imported upward, and two session counters disagreed (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1534|v57.30 - VIX and Fear & Greed band edges existed in a dozen copies that disagreed, and the regime alert depended on the legacy copy (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1535|v57.30 - Internal action enums and a position-size percentage were shown to readers, and AI prompts forced an action verdict (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1536|v57.30 - The concentration model weighted a position with a cached or reference price, and the legacy wrapper substituted the snapshot close (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1537|v57.30 - The news count did not say which list it covered, and the concept-map list printed a relation word without a direction (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1538|v57.30 - Technical, KR health, portfolio and moat surfaces showed A~D entry grades, 0-100 composites and instruction verdicts (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1539|v57.30 - The AI action gate replaced the whole answer on a keyword and the system prompt left room for a personalized action once suitability was known (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1540|v57.30 - Score bands read as advice although the long-run validation shows no positive relation (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1541|v57.30 - The Yahoo-to-FRED bridge mapped a 13-week discount rate onto the 3-month constant-maturity series and overwrote the 10Y-3M spread (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1542|v57.30 - The static-database calendar gate would have failed the whole release on 2026-10-15 although the schedule had not been refreshed by anyone (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1543|v57.30 - The legacy chat resolver guessed tickers from name fragments (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1544|v57.30 - Telegram digest tagged ordinary English words with tickers (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1545|v57.30 - The assertion-trace gate checked the format of a ledger id, not that the id exists (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1546|v57.30 - The technical brief, tactical overlay and page briefs carried English trade instructions and unvalidated 0-100 sums (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1547|v57.30 - Outbound fetches had a header-only deadline and the SEC client had none (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1548|v57.30 - Sourceless widgets and internal ids were visible on screen (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1549|v57.30 - Responsive blocks below the supported desktop width remained in the stylesheet (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1550|v57.30 - Chat and news attributed an issuer by a short alias, an uppercase acronym or a Korean substring (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1551|v57.30 - Chat diagrams drew defaults for missing inputs and the quiet-tape signal fired on a missing SPY change (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1552|v57.30 - The KR analysis paragraphs turned the 0-100 market score into a favourable/defensive narrative (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1553|v57.30 - A factor percentile was published for a lone rankable row (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1554|v57.30 - A score built on one of two appetite readings carried no partial marker (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1555|v57.30 - Reader copy exposed implementation terms, and the KR comparison table kept rows nothing wrote (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1556|v57.30 - The refresh audit would stop every 30-minute data commit on the day of the next BOK meeting (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1557|v57.30 - The home and briefing cards printed a position percentage next to a VIX ladder that disagreed with the VIX status (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1558|v57.30 - The technical brief showed raw English flag identifiers with action verbs, and missing inputs read as low load (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1559|v57.30 - Chat templates produced allocation percentages, invented elasticities and buy verdicts (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1560|v57.30 - One filer reporting 13F dollar values 1,000x too high got both normal filers withheld (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1561|v57.30 - Concentration weights were published as current while withheld positions had left the denominator (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1562|v57.30 - The regime drift alert called a move inside one Fear & Greed zone severe, and used old VIX names (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1563|v57.30 - A stopped Worker's last fast-plane snapshot kept its CURRENT labels and won over a fresh durable snapshot (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1564|v57.30 - Legacy files kept their own copies of the VIX and Fear & Greed ladders (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1565|v57.30 - KR analysis and the macro reading stated conclusions the inputs do not support (2026-10-09)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1566|v57.31 - Generated-conflict resolver picked the version branch data identity when merging the branch into main (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1567|v57.31 - Market score number and letter grade still shown in headers (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1568|v57.31 - Equity/index put-call ratios invented from the total ratio (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1569|v57.31 - Chart.js secondary CDN loaded without Subresource Integrity (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1570|v57.31 - US retail sales schedule ran out on 2026-10-15 (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1571|v57.31 - No guard against data files approaching the GitHub push limit (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1572|v57.31 - Failed BEA PCE fetch republished the carried row as ok (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1573|v57.31 - Cboe put/call labelled current regardless of its trading date (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1574|v57.31 - Portfolio card kept the VIX-to-max-exposure sizing ladder (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1575|v57.31 - Theme breadth counted leaders without a move as not rising; F&G 0 treated as missing (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1576|v57.31 - In-session price could be written to history as a completed close (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1577|v57.31 - Korea CPI reference and US CPI next-release date were out of date (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1578|v57.31 - Refresh dispatcher token could not be installed and its absence was invisible (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1579|v57.31 - Up/down colours ignored quote state and change basis (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1580|v57.31 - Exit-plan levels printed ATR substitutes as moving averages (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1581|v57.31 - Yahoo quote fallback printed a multi-day change as the daily change (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1582|v57.31 - SEC fundamentals hid the equity basis and showed a co-registrant name (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1583|v57.31 - Korea business-indicator widget showed permanent placeholders with fixed colours (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1584|v57.31 - A single AAII reference miss blocked the 30-minute market publish (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1585|v57.31 - Market-analysis validator rejected correct Korean analyses (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1586|v57.31 - Fear & Greed depended solely on a bot-gated CNN endpoint (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1587|v57.31 - A 1000x SEC share count published P/E 26,500 and P/B 4,461 (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1588|v57.31 - US theme taxonomy mixed misclassifications, missing industries and editorial weights (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1589|v57.31 - Universe and KR theme identities were wrong or dead (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1590|v57.31 - Sector rotation missed core industry groups and duplicated cybersecurity (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1591|v57.31 - Frontend audit round 1-3: light-theme diagrams, unreadable fiscal card, stale rotation read and overlapping concept graph (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1592|v57.31 - Frontend audit round 4-9: wrong-company news tag, cost-basis donut, skip-link blank page, desynced screener controls and learning-text errors (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1593|v57.31 - Frontend audit round 10: reversed part/whole relations, mismatched product links, fundamental tab losing its company and overstated copy (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1594|v57.32 - 시장 분석 검증의 지표 경계·반복 숫자·언어 판정 보완 (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1595|v57.32 - Worker 보완 예약 요청의 중복 억제와 접수 관측 (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1596|v57.32 - 운영 게이트 통과와 전체 건강 상태 분리 (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1597|v57.32 - 장기 SLO 조회·기간·cron 분모 무결성 보완 (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1598|v57.32 - 실패 알림의 최신 실행 소유권과 전체 서명 무결성 (2026-10-10)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1599|v57.32 - Frontend audit visual pass: dashboards and infographics answer the page question, with honest scales and colours (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1600|v57.32 - Frontend audit remainder: scoped knowledge claims, readable lesson sources, glossary accuracy, 13F price gaps, translation repairs and an industry overview map (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1601|v57.33 - 뉴스 사건·정정 보존과 정확한 회사 연결 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1602|v57.33 - 일정·공시 근거와 불변 로컬 리서치 저장 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1603|v57.33 - 범위가 명시된 브라우저 증거와 QA 실행 연결 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1604|v57.34 - 설명 버튼·키보드 단일 실행과 모드 전환 차트 가독성 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1605|v57.34 - 출처별 신용·측정·증거 충돌 프레임의 실제 소비 경로 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1606|v57.34 - 새 분석 노트의 화면과 통합 검색 간 소비 경로 불일치 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1607|v57.35 - 공용 자료와 개인 연결의 소비 경로·Worker 설정 상태 불일치 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1608|v57.36 - 조건부 OpenAI 웹검색·공용 $20 원장·내부 근거 우선 및 최신성 분리 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1609|v57.36 - 검색 토글의 실제 delegated change 인자·저장 상태 불일치 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1610|v57.37 - VIX 배지가 라이브 게이트 경로에만 묶여 전 라우트에서 'VIX —'로 고정되고, 시세 카운트 칩이 스냅샷(16종)·라이브(7종) 두 플레인이 같은 슬롯을 last-writer-wins로 덮어썼다 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1611|v57.37 - 같은 사실이 화면마다 다른 기준·분모·단위로 표시됐다: breadth '판정 대상'이 신고·신저 전용 분모(804)를 썼고, 혼합 basis 카드가 값별 관측일을 대표 칩 하나로 덮었으며, F&G '전일' 델타가 두 정의로 공존했다 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1612|v57.37 - 거시 카드가 결측월을 건너뛴 위치 오프셋으로 '1년 전'을 계산해 13개월 전 값(2.7%)을 표시했고, 기간 프리미엄 카드가 5거래일 지연을 무표기로 두었다 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1613|v57.37 - 종목 차트 탭이 선택 종목을 이어받지 못해 SPY로 남는 비결정 동작이 있었고, 같은 재무 화면에서 '관측 항목'이 7개와 6개로 이중 집계됐으며 ROE·매출·기준일 표기가 기준 없이 섞였다 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1614|v57.37 - 콜드 로드에서 스크리너 '이어서 볼 곳'이 '판정 대기'로 고정됐고, 필드 준비 985(필수 필드)와 수집 성공 989가 같은 정의로 읽혔으며 리서치·테마 화면의 표제·그룹·기준일 표기가 실제 데이터와 어긋났다 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1615|v57.37 - 13F 전체 체인 재실행이 저장 행 재사용 패스트패스에서 구성 근거(amendmentChain)를 복원하지 않아, 신규 index 빌더(체인 미기록)와 결합하면 두 번째 풀체인 실행부터 masters 계약 게이트가 확정 실패했다 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1616|v57.37 - P1608/P1609 조건부 검색 전환이 게이트·헤드리스 단언에 반영되지 않아 첫 CI에서 browser 3개 샤드가 실패했다 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1617|v57.37 - KRX 휴장일(한글날)이 주말과 맞닿으면 정상 종가가 72h 리시를 초과해 STALE_UNEXPECTED로 거부되고, 데이터 리프레시 발행이 fail-closed로 막혔다 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1618|v57.38 - 사용자 재승인 모바일·아이패드 반응형 화면 복원 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1619|v57.38 - 홈 지수·선물 혼용 및 hidden 스타일 덮어쓰기·상단 정체성 오류 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1620|v57.39 - 홈 시장 폭 요약·전체 테마 티커 누락과 용어사전 다크 모드 충돌 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1621|v57.39 - 기존 재무 화면 캐시로 채팅 자료가 생략되고 페이지 밖 도메인 질의가 연결되지 않음 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1622|v57.39 - 테마 핵심 종목 누락·사업/상품 오분류와 구성 종목 내부 비교 부재 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1623|v57.39 - 상대강도 기준일 혼합과 1% 미만 시장 폭 단위 확대 (2026-10-11)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1624|v57.40 - 종목 첫 진입 자료 연결과 기업 분석 공통 구조 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1625|v57.40 - 시장별 순위 모집단과 선택 정렬의 일치 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1626|v57.40 - 차트 조건부 흐름과 거래량 가격대의 근거 계약 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1627|v57.40 - 재무 손실 방향과 동일 회계기간 원본 정밀도 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1628|v57.40 - 시장 축 가독성·조건부 흐름과 한국 참여도 부족 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1629|v57.40 - 한국 휴장·주말 뒤 최신 종가 팩터 전체 보류 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1630|v57.41 - 인수 리뷰: 가격 표기 혼재, 재렌더 시 펼침·포커스 소실, 원천 없는 사업 설명 상시 안내, 시나리오 카드 과밀 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1631|v57.41 - 8화면 브라우저 대조: 용어 사전 딥링크 빈 화면과 화면 간 문구·분모·표기 불일치 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1632|v57.42 - 스크리너 생산 레인 실패: SEC 런타임 투영이 1MiB 상한 초과 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1633|v57.42 - 시장 시나리오에 개연성·대응 가능성·확인/주의/무시 항목이 없고 추세·시장 폭이 한 기간만 보임 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1634|v57.42 - 종목 차트가 일봉만 지원하고 캔들이 증권사 화면과 다르게 압축·미국식 색으로 그려짐 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1635|v57.42 - 자동 생성 AI 시장 해석이 수치 나열과 무의미한 문장으로 채워짐 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1636|v57.42 - 리서치 라이브러리 참고 관측값이 두 달 전 값으로 고정 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1637|v57.42 - 시장 상태에 축별 변화 방향을 한눈에 볼 그림이 없음 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1638|v57.42 - 신용 축이 하이일드 평균만 보고 취약 등급의 스트레스를 놓침 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1639|v57.42 - 차트 근거에 50일선 대비 확장 정도와 저점 반등 확인 지표가 없음 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1640|v57.42 - 종목 요약이 세 블록에서 같은 수익률·순위를 반복하고 기술·재무 분석으로 이어지지 않음 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1641|v57.42 - 오늘 화면에 섹터별 등락이 없어 하루 순환매를 볼 수 없음 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1642|v57.42 - 리서치 라이브러리에서 전체 소장 자료를 한눈에 볼 수 없음 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
|P1643|v57.42 - 숫자 설명이 브라우저 기본 툴팁에만 있어 휴대폰·키보드에서 보이지 않고 관측 시점도 없음 (2026-10-12)|관련 영역 추적·계약 검사; 개별 투자 의미/과거 live 미인증|
