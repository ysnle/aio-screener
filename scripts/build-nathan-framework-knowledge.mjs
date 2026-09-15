#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NATHAN_FRAMEWORK_PACK } from '../src/domain/knowledge/nathan-framework-pack.js';
import { atomicWriteJsonSync } from './lib/atomic-write.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
atomicWriteJsonSync(path.join(root, 'public-data', 'knowledge', 'nathan-frameworks.json'), {
  ...NATHAN_FRAMEWORK_PACK,
  generatedAt: '2026-09-12',
  boundary: '직접 확인된 공개 연구자료에서 추출한 구조 프레임·용어·검증 절차만 보존한다. 원문 문구, 당시 수치, 예측, 목표, 방향성은 현재 사실이나 신호로 승격하지 않는다.'
});
console.log(JSON.stringify({
  status: 'PASS',
  concepts: NATHAN_FRAMEWORK_PACK.concepts.length,
  aliases: NATHAN_FRAMEWORK_PACK.aliases.length,
  articles: NATHAN_FRAMEWORK_PACK.articles.length
}, null, 2));
