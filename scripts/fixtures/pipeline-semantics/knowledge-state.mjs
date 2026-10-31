// scripts/fixtures/pipeline-semantics/knowledge-state.mjs — v59.45 pipeline review regressions (shared artifact load/cache/currentness, page completeness and readiness, interpretation inputs, knowledge sources/graph/relations/learning state, evidence store, freshness badge, server macro load)
import assert from 'node:assert/strict';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)) };
};
const NOW = Date.parse('2026-10-30T00:00:00Z');

export const cases = [
  { id: 'P10-STATE-01', name: '연구 화면 테마 단계는 pending 기록을 현재 단계로 보이지 않는다', run: async ({ load }) => {
      const { themeStageBlock } = await load('src/ui/knowledge/theme-stage-links.js');
      const el = () => ({ dataset: {}, textContent: '', title: '', append() {}, appendChild() {}, addEventListener() {} });
      const box = el();
      const root = { THEME_MAP: [{ id: 'audit', nameKr: '감사 테마' }],
        _aioScenarioState: { status: 'pending', themes: [{ market: 'US', id: 'audit', stateLabel: '약세 지속 (규칙)', ret1m: -3 }] } };
      const facts = [];
      const doc = { createElement: () => { const node = el(); facts.push(node); return node; } };
      themeStageBlock(doc, root, ['audit'], () => box);
      assert.ok(facts.some((node) => node.textContent === '단계 수신 대기'));
      assert.ok(!facts.some((node) => /약세 지속/.test(node.textContent)));
  } },
  { id: 'P10-STATE-01', name: '행이 이미 있어도 재진입 때 TTL이 지난 기록을 다시 요청한다', run: async ({ load }) => {
      const { themeStageBlock } = await load('src/ui/knowledge/theme-stage-links.js');
      const { SCENARIO_STATE } = await load('src/data/shared-artifacts.js');
      let requests = 0;
      const el = () => ({ dataset: {}, textContent: '', append() {}, appendChild() {}, addEventListener() {} });
      const root = { THEME_MAP: [{ id: 'audit', nameKr: '감사 테마' }],
        _aioScenarioState: { status: 'current', themes: [{ market: 'US', id: 'audit', stateLabel: '주도 지속', ret1m: 1 }] },
        __aioSharedArtifacts: { [SCENARIO_STATE.key]: { loadedAt: Date.now() - 2 * SCENARIO_STATE.maxAgeMs, failedAt: 0, inFlight: null } },
        fetch: async () => { requests += 1; return new Response(JSON.stringify({ schemaVersion: 'scenario-state.v1', status: 'current', generatedAt: '2026-10-30T00:00:00Z', themes: [] })); } };
      themeStageBlock({ createElement: el }, root, ['audit'], () => el());
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(requests, 1);
  } },
  { id: 'P28-COMPLETENESS-01', name: '성공 시각이 없거나 미래·불량이면 loaded로 인증하지 않는다', run: async ({ load }) => {
      const { pageDataCompleteness } = await load('src/data/page-completeness.js');
      const contract = { requiredProducers: ['x'], maxAge: { x: 1000 }, minCoverage: { x: 80 } };
      for (const lastSuccessfulAt of ['bad', '2099-01-01T00:00:00Z', null]) {
        const out = pageDataCompleteness('home', contract, () => ({ status: 'loaded', lastSuccessfulAt, coverage: 100 }), NOW);
        assert.notEqual(out.status, 'loaded', String(lastSuccessfulAt));
        assert.equal(out.producers.x.status, 'unknown');
      }
  } },
  { id: 'P28-COMPLETENESS-01', name: 'coverage NaN·null은 최소 coverage를 통과하지 않고 empty 상태는 issue가 된다', run: async ({ load }) => {
      const { pageDataCompleteness } = await load('src/data/page-completeness.js');
      const contract = { requiredProducers: ['x'], maxAge: { x: 1000 }, minCoverage: { x: 80 } };
      const fresh = new Date(NOW - 10).toISOString();
      assert.notEqual(pageDataCompleteness('p', contract, () => ({ status: 'loaded', lastSuccessfulAt: fresh, coverage: NaN }), NOW).status, 'loaded');
      assert.notEqual(pageDataCompleteness('p', contract, () => ({ status: 'loaded', lastSuccessfulAt: fresh, coverage: null }), NOW).status, 'loaded');
      assert.equal(pageDataCompleteness('p', contract, () => ({ status: 'empty' }), NOW).status, 'empty');
      assert.equal(pageDataCompleteness('p', contract, () => ({ status: 'loaded', lastSuccessfulAt: fresh, coverage: 100 }), NOW).status, 'loaded');
  } },
  { id: 'P28-COMPLETENESS-01', name: 'partial 스크리너는 backtest가 있어도 ready가 아니고 breadth에 100%를 주지 않는다', run: async ({ load }) => {
      const { screenerLoadState, producerState } = await load('src/data/page-completeness.js');
      const screener = { status: 'partial', updatedAt: '2026-10-29T13:45:00Z', metadata: { backtest: true, universeFreshnessStatus: 'current' } };
      assert.equal(screenerLoadState(screener).status, 'partial');
      const ready = { ...screener, status: 'current', metadata: { ...screener.metadata, universe: 1000, artifactRows: 900 } };
      const breadth = producerState('breadth', { meta: { generatedAt: '2026-10-30T00:00:00Z' }, screener: ready });
      assert.notEqual(breadth.coverage, 100);
      assert.equal(breadth.lastSuccessfulAt, '2026-10-29T13:45:00Z');
      assert.equal(producerState('screenerArtifact', { meta: {}, screener: ready }).coverage, 90);
  } },
  { id: 'P28-AUDIT-01', name: '감사한 화면이 0개면 loaded가 아니고 reader 객체를 바꾸지 않는다', run: async ({ load }) => {
      const { auditPageDataCompleteness, pageDataCompleteness } = await load('src/data/page-completeness.js');
      assert.notEqual(auditPageDataCompleteness([], []).status, 'loaded');
      const shared = { status: 'loaded', lastSuccessfulAt: new Date(NOW - 5000).toISOString(), coverage: 100 };
      pageDataCompleteness('a', { requiredProducers: ['x'], maxAge: { x: 1000 } }, () => shared, NOW);
      assert.equal(shared.status, 'loaded');
      assert.equal(pageDataCompleteness('b', { requiredProducers: ['x'], maxAge: { x: 60000 } }, () => shared, NOW).status, 'loaded');
  } },
  { id: 'P28-AUDIT-01', name: '미래 generatedAt은 0분 전·공유 가능으로 표시하지 않는다', run: async ({ load }) => {
      const { installPublicReadiness } = await load('src/data/public-readiness.js');
      const fake = { AIO: { version: 'fixture', getPageEvidenceCurrentnessAudit: () => ({ status: 'pass', pageCount: 1, rows: [] }), getDataPipelineAudit: () => ({ status: 'ok' }), getShareReadinessAudit: () => ({ blockers: [], warnings: [] }) },
        _serverDataMeta: { generatedAt: '2099-01-01T00:00:00Z', marketCyclePublished: true, reconciliation: { status: 'ok' } } };
      installPublicReadiness(fake);
      const readiness = fake.AIO.getPublicShareReadiness();
      assert.notEqual(readiness.status, 'ok');
      assert.doesNotMatch(readiness.dataLabel, /0분 전/);
  } },
  { id: 'P28-INTERPRETATION-01', name: '주입한 nowMs가 regime 입력 시계(market.now)까지 같다', run: async ({ load }) => {
      const { collectInterpretationInputs } = await load('src/data/selectors/interpretation.js');
      const input = collectInterpretationInputs({}, { nowMs: NOW });
      assert.equal(input.market.now, NOW);
  } },
  { id: 'P28-CONTRACT-01', name: '스크리너 행 변환 예외는 rows 단계 오류로 남고 전체 해석을 멈추지 않는다', run: async ({ load }) => {
      const { buildMarketInterpretation } = await load('src/domain/interpretation/market-interpretation.js');
      const bad = { get fieldReadiness() { throw new Error('getter'); } };
      const out = buildMarketInterpretation({ market: { history: [] }, screenerRows: [bad], nowMs: NOW });
      assert.ok(out.errors.rows);
      assert.equal(out.groups, null);
  } },
  { id: 'P29-EVIDENCE-01', name: '같은 id·URL의 철회·사용 제한 불일치는 충돌로 남는다', run: async ({ load }) => {
      const { createEvidenceRegistry, createClaimRegistry } = await load('src/domain/knowledge/evidence.js');
      const reg = createEvidenceRegistry([{ id: 's', url: 'https://example.com', verification: 'verified', reviewedAt: '2020-01-01', allowedUse: 'ANY' }],
        [{ id: 's', url: 'https://example.com', verification: 'revoked', reviewedAt: '2026-10-30', allowedUse: 'NONE' }]);
      assert.deepEqual(reg.conflicts.map((row) => row.field).sort(), ['allowedUse', 'verification']);
      const narrowed = createEvidenceRegistry([{ id: 't', url: 'https://example.com/t' }], [{ id: 't', url: 'https://example.com/t', allowedUse: 'NONE' }]);
      assert.equal(narrowed.resolve('t').allowedUse, 'NONE');
      assert.deepEqual(createClaimRegistry([{ id: 'c', sourceIds: [] }], reg).unsourced, ['c']);
  } },
  { id: 'P29-GRAPH-01', name: '재정규화해도 추정 필드 흔적이 남고 같은 기본 id 중복을 센다', run: async ({ load }) => {
      const { normalizeKnowledgeEdge, inspectKnowledgeGraph } = await load('src/domain/knowledge/graph.js');
      const edge = normalizeKnowledgeEdge({ from: 'a', to: 'b', relation: '참고' }, { reviewedAt: '2026-10-30' });
      assert.ok(inspectKnowledgeGraph({ nodeIds: ['a', 'b'], edges: [edge] }).inferredEdges.length > 0);
      const second = normalizeKnowledgeEdge({ ...edge, type: 'CAUSES', id: undefined });
      const graph = inspectKnowledgeGraph({ nodeIds: ['a', 'b', 'b'], edges: [edge, second] });
      assert.deepEqual(graph.duplicateEdgeIds, [edge.id]);
      assert.deepEqual(graph.duplicateNodeIds, ['b']);
  } },
  { id: 'P29-RELATION-01', name: '노출(EXPOSES_TO)은 대체·경쟁이 아니고 조건·출처가 전달된다', run: async ({ load }) => {
      const { typedRelations } = await load('src/domain/knowledge/atlas-relations.js');
      const rel = typedRelations({ nodes: [{ nodeId: 'a' }, { nodeId: 'b' }], relationshipModel: { crossDomainEdges: [
        { id: 'x1', from: 'a', to: 'b', type: 'EXPOSES_TO', conditions: ['only in X'], sourceIds: ['s'] },
        { id: 'x2', from: 'b', to: 'a', type: 'REQUIRES', conditions: [], sourceIds: [] }] } });
      const exposure = rel.get('a').find((item) => item.sourceType === 'EXPOSES_TO');
      assert.notEqual(exposure.type, 'substitute');
      assert.deepEqual(exposure.conditions, ['only in X']);
      const need = rel.get('b').find((item) => item.sourceType === 'REQUIRES');
      assert.equal(need.label, '필요한 것');
      assert.notEqual(rel.get('a').find((item) => item.sourceType === 'REQUIRES').label, need.label);
  } },
  { id: 'P29-LEARNING-01', name: '두 탭이 같은 저장소에 메모를 쓰면 둘 다 남는다', run: async ({ load }) => {
      const { createLearningState } = await load('src/domain/knowledge/learning-state.js');
      const storage = memoryStorage();
      const a = createLearningState({ storage }), b = createLearningState({ storage });
      a.setNote('a', 'first'); b.setNote('b', 'second'); a.toggleBookmark('x');
      const reloaded = createLearningState({ storage }).snapshot();
      assert.equal(reloaded.notes.a?.value, 'first');
      assert.equal(reloaded.notes.b?.value, 'second');
      assert.deepEqual(reloaded.bookmarks, ['x']);
  } },
  { id: 'P29-CADENCE-01', name: '미래 검토일(2099)은 기한 안으로 세지 않는다', run: async ({ load }) => {
      const { isOverdue } = await load('src/domain/knowledge/knowledge-cadence.js');
      assert.equal(isOverdue('observation', '2099-01-01', NOW), true);
      assert.equal(isOverdue('observation', '2026-10-30', NOW), false);
  } },
  { id: 'P30-LOAD-01', name: '검증 실패 artifact는 1분 뒤 재요청해 서버 수정본을 받는다(그 안에는 재요청 없음)', run: async ({ load }) => {
      const { loadKnowledgeCapabilities } = await load('src/data/knowledge/load-capabilities.js');
      let calls = 0, clock = NOW;
      const fetcher = async () => ({ ok: true, json: async () => ({ valid: ++calls > 1 }) });
      const def = [{ key: 'test', url: 'fixture-p30.json', validate: (value) => value.valid }];
      assert.equal((await loadKnowledgeCapabilities(fetcher, def, { now: () => clock })).test.status, 'fallback');
      assert.equal((await loadKnowledgeCapabilities(fetcher, def, { now: () => clock })).test.status, 'fallback');
      assert.equal(calls, 1);
      clock += 61 * 1000;
      assert.equal((await loadKnowledgeCapabilities(fetcher, def, { now: () => clock })).test.status, 'connected');
      assert.equal(calls, 2);
  } },
  { id: 'P30-LOAD-01', name: '같은 key가 두 번 있으면 한 번만 읽는다', run: async ({ load }) => {
      const { createKnowledgeCapabilityBatchLoader } = await load('src/ui/knowledge/capability-loader.js');
      let seen = null;
      const loader = createKnowledgeCapabilityBatchLoader({ fetchFn: async () => ({}), state: {}, loadCapabilities: async (_, pending) => { seen = pending; return {}; } });
      await loader.load([{ key: 'k', url: 'a.json' }, { key: 'k', url: 'b.json' }]);
      assert.deepEqual(seen.map((row) => row.url), ['a.json']);
  } },
  { id: 'P30-LINK-01', name: '자격 정보가 든 URL은 안전한 출처 링크가 아니다', run: async ({ load }) => {
      const { safeExternalHref } = await load('src/ui/knowledge/safe-external-link.js');
      assert.equal(safeExternalHref('https://publisher.example@other.example/path'), null);
      assert.equal(safeExternalHref('https://www.sec.gov/Archives/x'), 'https://www.sec.gov/Archives/x');
  } },
  { id: 'R2-03', name: '미래 시각 관측이 지금 관측을 막지 않는다', run: async ({ load }) => {
      const { createEvidenceStore } = await load('src/data/evidence-store.js');
      const { applyFreshness } = await load('src/data/quality/freshness.js');
      const now = Date.now();
      const store = createEvidenceStore();
      const row = (value, observedMs) => applyFreshness({ metric: 'vix', value, unit: 'index', sourceKind: 'legacy-runtime', status: 'live', observedAt: new Date(observedMs).toISOString(), fetchedAt: new Date(now).toISOString() }, { now, maxAgeMs: 120000 });
      store.ingest(row(99, now + 6 * 3600e3));
      store.ingest(row(17, now - 1000));
      assert.equal(store.get('vix').value, 17);
  } },
  { id: 'R2-06', name: '40일 뒤 시각은 방금·fresh 배지가 아니다', run: async () => {
      const previous = globalThis.localStorage;
      globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
      try {
        const { installFreshnessEngine } = await import(new URL('../../../src/data/quality/freshness-engine.js', import.meta.url));
        const w = {}; installFreshnessEngine(w);
        const future = Date.now() + 40 * 86400000;
        assert.equal(w.FRESHNESS_ENGINE.isStale(future, 'report'), true);
        assert.notEqual(w.FRESHNESS_ENGINE.formatRelative(future), '방금');
        assert.doesNotMatch(w.FRESHNESS_ENGINE.staleBadge(future, 'report'), /--fresh/);
      } finally { globalThis.localStorage = previous; }
  } },
  { id: 'R2-07', name: '없는 만기 금리는 0%로 채우지 않는다', run: async ({ load }) => {
      const { installServerDataLoader } = await load('src/data/server-data-loader.js');
      const w = { DATA_SNAPSHOT: {}, _fredData: {} };
      installServerDataLoader(w);
      const apply = w._aioApplyServerTreasuryEvidence;
      assert.equal(typeof apply, 'function');
      const out = apply({ dgs10: 4.1, _asOf_dgs10: '2026-10-29', dgs20: null, _treasury: null }, { generatedAt: '2026-10-30T00:00:00Z' });
      assert.ok(!out.fields.includes('dgs20'));
      assert.notEqual(w.DATA_SNAPSHOT.tnx20y, 0);
  } },
];
