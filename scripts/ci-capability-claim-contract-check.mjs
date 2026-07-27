import fs from 'node:fs';
import { CAPABILITY_MANIFEST, CAPABILITY_MANIFEST_VERSION, auditCapabilityClaims } from '../src/domain/content/capability-manifest.js';

const html = fs.readFileSync('index.html', 'utf8');
const guideStart = html.indexOf('<div class="page" id="page-guide">');
const guideEnd = html.indexOf('<div class="page" id="page-glossary">', guideStart);
const guide = guideStart >= 0 ? html.slice(guideStart, guideEnd > guideStart ? guideEnd : undefined) : '';
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(CAPABILITY_MANIFEST_VERSION === 'wave4.capability.v1', `unexpected manifest version: ${CAPABILITY_MANIFEST_VERSION}`);
check(CAPABILITY_MANIFEST.length === 9, `expected 9 capability rows, got ${CAPABILITY_MANIFEST.length}`);
check(guide.includes('data-aio-capability-manifest="wave4.capability.v1"'), 'guide is not marked with the capability manifest version');

const ids = [...guide.matchAll(/data-aio-capability-claim[^>]*data-capability="([^"]+)"/g)].map((match) => match[1]);
check(ids.length === CAPABILITY_MANIFEST.length, `guide claim marker count mismatch: ${ids.length}`);
check(new Set(ids).size === ids.length, 'guide capability claim ids are duplicated');
for (const row of CAPABILITY_MANIFEST) check(ids.includes(row.id), `guide is missing capability claim: ${row.id}`);

const forbiddenLegacyGuideClaims = [
  '75+ = 매수우호',
  'Leading 사분면 섹터 선별',
  'Stage 2 초입=매수 타이밍',
  '극단 공포 구간 → 분할 매수',
  'Fed 금리가 핵심. 인상기=방어, 인하기=공격',
  '10Y 급등=주식↓, 곡선 역전=침체 신호',
  '50+소스 실시간 뉴스',
  '외인+기관 동반매수=강상승'
];
for (const claim of forbiddenLegacyGuideClaims) check(!guide.includes(claim), `retired guide claim remains: ${claim}`);

const safeAudit = auditCapabilityClaims({ claims: CAPABILITY_MANIFEST.map((row) => ({
  dataset: { capability: row.id, claimMode: row.status === 'optional' ? 'optional' : row.status === 'conditional' ? 'conditional' : 'reference' },
  textContent: row.wording
})) });
check(safeAudit.ok, `safe capability claims failed: ${JSON.stringify(safeAudit.issues)}`);
const blockedAudit = auditCapabilityClaims({ claims: [{ dataset: { capability: 'stage', claimMode: 'reference' }, textContent: 'Stage 2 = 매수' }] });
check(!blockedAudit.ok && blockedAudit.issues.some((issue) => issue.issues.includes('forbidden-claim')), 'forbidden capability claim did not fail closed');

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, version: CAPABILITY_MANIFEST_VERSION, capabilities: CAPABILITY_MANIFEST.length, guideMarkers: ids.length }));
