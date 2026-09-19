#!/usr/bin/env node

// Retired product scope: quantitative practice labs are outside the product
// boundary, so this producer publishes nothing and must not.
//
// It used to keep the full generator below an early `process.exit(0)`, leaving
// 42 lines of unreachable code that still looked like a live producer while its
// previously generated output (`public-data/knowledge/quantitative-labs.json`
// and `quantitative-labs/*.json`, 16 files) stayed published: frozen at
// 2026-08-12, read by no client, absent from the coverage census, and carrying
// `conceptIds` in a private `concept:` namespace that resolved to nothing in
// the corpus. The artifacts were retired with the dead generator (P1109).

console.log(JSON.stringify({
  status: 'EXCLUDED_BY_PRODUCT_SCOPE',
  reason: '퀴즈·연습문제·교육용 정량 랩은 사용자 요청 범위 밖이며 제품 artifact를 생성하지 않습니다.',
  publishedArtifacts: []
}, null, 2));
