# wave2-e QUALITY-BAR check (research screens, 2026-11-04, local 8791)

Screens: `_artifacts/wave2-e/screens/`.

| Width · theme | State | File |
|---|---|---|
| 1440 light | 산업 지도 node (guide chips + reading text) | `1440-light-atlas-node-story.jpg` |
| 1440 light | 개념 지도 graph, node AI CAPEX | `1440-light-principles-map.jpg` |
| 1440 light | 개념 사전 일드갭 (reading text from JSON) | `1440-light-principles-concept.jpg` |
| 1440 light | AI 기초 layer F2 (layer titles from JSON) | `1440-light-atlas-foundations.jpg` |
| 1440 dark | 산업 지도 domain overview | `1440-dark-atlas-domain.jpg` |
| 768 light | 대가 보유 종목 | `768-light-masters.jpg` (captured mid fade-in) |
| 768 light | X bookmark frame 신용 스트레스가 번지는 세 층 | `768-light-xbm-credit-frame.jpg` |
| 390 dark | 산업 지도 node DRAM·HBM | `390-dark-atlas-node-story.jpg` |
| 390 dark | 개념 사전 일드갭 | `390-dark-principles-concept.jpg` |
| 390 light | domain overview after the heading edit | `390-light-atlas-domain-after-label-edit.jpg` (mid fade-in) |

| # | Item | Result |
|---|---|---|
| 1 | Numbers | Unchanged: moved copy is fingerprint-equal to the old code; no number was edited |
| 2 | Text | Four page-code wording edits (below); research copy unchanged |
| 3 | Alignment | No horizontal scroll at 1440 / 768 / 390 (scrollWidth = viewport) |
| 4 | States | Catalog load failure shows a retry notice (new path); stories/copy loads re-render when they land, as the old lazy import did. Failure path not exercised in the browser |
| 5 | Interaction | Node, domain, layer and concept selection render from the fetched JSON |
| 6 | Wording | Fixed: '이 분야를 읽는 순서' -> '세부 영역'; atlas arrival '~순서를 확인하세요' paragraph -> '관점, 관찰 기간' line; principles arrival paragraphs -> one arrow line each; masters '두 축을 구분해 읽습니다' -> one fact. Not changed: research prose (D8 keeps content as reviewed) |
| 7 | Composition | Same layout as before; no new sections |
| 8 | Freshness | Not applicable (reference copy, no dated values) |
| 9 | Accessibility | Contrast not measured; same components and tokens as before |

Not checked: AI panel answers (the local Worker is not connected); the catalog-failure notice in a real browser; arrival-context edits on screen (they need a cross-route handoff; checked in source only).

X bookmark frames (4): still on 개념·분석 → 분석 노트; titles one line at 1440 and 768; search reaches them via the generated index (the index already carried every frame, so dropping the learning-core merge in knowledge-search removed nothing).

## Screen review 19 / 28 / 30 (2026-11-04)

Before/after: `_artifacts/wave2-e/screens/review-fixes/{before,after}-{1440,768,390}-{light,dark}-{atlas-domain,principles-frame,principles-hub,masters-bars}.png` (24 + 24, `capture-review-fixes.mjs`).

| # | Before | After |
|---|---|---|
| 19 | '먼저 알아둘 개념'(노트·레슨 옆 칸), '먼저 알아둘 레슨', 노트 목록 '…매도가 끝나 가는지를 읽는 방법', '…국면을 읽는 방법', 분야 개요 '이 분야를 읽는 핵심은' | '쓰인 개념', '선행 레슨', 주제 앞 명사형 제목 2편, '핵심은'. 분야 개요 긴 분석 문단 = '분야 분석' 접기(삭제 없음) |
| 28 | 'AXP, American Expres…' 잘림 | 티커만(AAPL·AXP·GOOGL·GOOG); 이름은 title·aria-label |
| 30 | 휴대폰에서 둘째 카드가 오른쪽에 잘려 보이고 표시 없음 | 같은 가로 넘김 + 아래 점 3개(현재 카드 표시). 768/1440은 기존 격자 그대로 |

Gate `scripts/ci-research-heading-wording.mjs`: passes now; on HEAD 2bb5fa47 fails with 99 errors (94 notes' '먼저 알아둘 개념', 2 list labels + their h2, the '이 분야를 읽는 핵심은' paragraph). Not covered: the concepts-view lesson aside is not mounted (its '선행 레슨' title is fixed in code; the frame columns cover the shared '쓰인 개념' block). Horizontal page scroll: none at any width (scrollWidth = viewport).
Not changed: masters overview h2 '돈을 굴리는 방식별로 13F 읽기' (outside the review list and the gate pattern).

## masters.js split (2026-11-04)

1,647 → 931 lines (+ `src/ui/pages/masters-views.js` 727). Evidence: `_artifacts/wave2-e/masters-split-snapshot.mjs`; `masters-split-{before,after}.json` 52 states, 0 changed (before run twice: 0 changed, so the snapshot is deterministic); `screens/masters-split/{before,after}-*.png` 12 pairs byte-identical. Three moved `Number.isFinite(Number(x))` reads became `readNumber` (shared-primitive ratchet refuses moved growth); differs only for null/'' inputs, which the current data does not contain.
