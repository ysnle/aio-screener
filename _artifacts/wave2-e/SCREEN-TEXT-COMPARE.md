# wave2-e screen-text comparison (S17~S19 content move)

Tool: `node scripts/research-screen-text-snapshot.mjs` (Playwright, 1440x900, service workers blocked, remote requests aborted).

| Run | Before (integration-20261104) | After (wave2-e-research) | States | Changed |
|---|---|---|---|---|
| Base set (principles tree/graph, 60 concept-map nodes, 8 paths, atlas, masters) | `screen-text-before.json` | `screen-text-after.json` | 72 | 0 |
| Extended set (+ every 5th 산업 지도 node, 19 domains, 7 AI 기초 layers, every 4th concept) | `screen-text-before-full.json` | `screen-text-after-full.json` | 140 | 5 |

The five changed states differ in one line only: the domain-overview heading `이 분야를 읽는 순서` -> `세부 영역`, a wording edit that was live in the working tree while the extended run was capturing. That edit is recorded separately (pending record 02, QUALITY-BAR). No research sentence changed.

Content fingerprint (strings in order, sha256) of the four moved sources equals the pre-move code: `architecture/research-content-baseline.json`, checked by `node scripts/ci-research-content-source.mjs`.
