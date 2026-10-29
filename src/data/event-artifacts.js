// v59.42: the two artifacts only lazy chunks read (오늘 briefs and contributor lines, the 종목 brief), kept out of the boot
// registry in shared-artifacts.js. Loaded through refreshSharedArtifact like the others.
export const KR_INDEX_WEIGHTS = Object.freeze({ key: '_aioKrIndexWeights', url: './public-data/kr-index-weights.json', schemas: ['kr-index-weights.v1'], maxAgeMs: 60 * 60 * 1000, maxBytes: 64 * 1024 }); // KOSPI/KOSDAQ top-name weight proxies (event-briefs.yml)
export const EVENT_BRIEFS = Object.freeze({ key: '_aioEventBriefs', url: './public-data/event-briefs.json', schemas: ['event-briefs.v1'], maxAgeMs: 20 * 60 * 1000, maxBytes: 1024 * 1024 }); // FOMC and mover earnings briefs (event-briefs.yml)
