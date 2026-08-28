// Phase 2 [B6] (FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md §4): "유니버스 데이터 승격" — extracts the
// hand-curated SCREENER_DB array (js/aio-data.js) into a real JSON artifact
// (public-data/screener-universe.json) so scripts/fetch-data.mjs's getScreenerSymbols() can
// read it directly instead of regex-scraping js/aio-data.js's source text.
//
// 왜 정규식이 아니라 실제 JS 평가인가: 이전 서버측 추출은
//   /\bsym:\s*'([A-Z0-9.\-]+)'/g  +  src.indexOf('\n];', a)
// 두 가지 정규식/문자열 탐색에 의존했다. sym 필드 자체는 안전(영숫자/점/대시만)하지만
// 배열 끝 탐지("\n];")는 취약하다 — 배열 내부에 그 정확한 바이트열이 나타나면(예: 코멘트,
// 중첩 구조) 조기 종료된다. 이 스크립트는 대신 괄호 depth를 실제로 추적해 배열 리터럴의
// 진짜 끝을 찾고, 찾은 텍스트를 `new Function('return ' + slice)()`로 실제 평가한다 —
// memo 필드의 자유 텍스트(따옴표/쉼표/콜론 포함 가능)를 정규식으로 필드별 추출하는 것보다
// 훨씬 견고하다(정확히 JS 엔진이 파싱하는 것과 동일).
//
// 사용법:
//   node scripts/sync-screener-universe.mjs         — 동기화 실행 + 파일 갱신
//   node scripts/sync-screener-universe.mjs --check — 갱신 없이 drift만 검사 (CI용, exit 1 시 drift)
//
// SSOT는 여전히 js/aio-data.js의 SCREENER_DB (/data-refresh 스킬이 편집하는 대상) — 이 JSON은
// 그로부터 생성되는 미러다. 클라이언트 부팅 시 비동기 로드로 전환(Fable 원안의 "클라는 부팅 시
// 로드")은 SCREENER_DB가 144개 참조 지점(js/aio-chat.js·aio-core.js·aio-data.js·aio-tests.js·
// aio-ui.js·index.html)에서 쓰이고 이를 안전하게 감싸는 기존 비동기 부팅 게이트가 없어 —
// Fable이 Phase 3 [A2](defer 전환 + 참조 시점 전수 감사)로 이미 분리해둔 것과 동일한 작업량이라
// 이번 Phase 2 세션에서는 하지 않는다(BUG-POSTMORTEM P590 참조).

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const SRC = resolve(ROOT, 'js/aio-data.js');
const OUT = resolve(ROOT, 'public-data/screener-universe.json');

// 소스 안에서 `varName = <literal>;` 리터럴을 괄호 depth 추적으로 정확히 슬라이싱해 평가한다.
// openCh/closeCh 쌍 depth가 0으로 돌아오는 지점을 문자열/이스케이프를 인식하며 찾는다.
function extractLiteral(src, declPattern, openCh, closeCh) {
  const m = declPattern.exec(src);
  if (!m) throw new Error(`선언부 미발견: ${declPattern}`);
  const declEnd = m.index + m[0].length;
  const openIdx = src.indexOf(openCh, declEnd);
  if (openIdx < 0) throw new Error(`여는 괄호(${openCh}) 미발견`);
  let depth = 0, inStr = null, i = openIdx;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) break; }
  }
  if (depth !== 0) throw new Error(`괄호 불균형(${openCh}/${closeCh}) — depth=${depth}`);
  const literalText = src.slice(openIdx, i + 1);
  // eslint-disable-next-line no-new-func
  return new Function(`'use strict'; return (${literalText});`)();
}

async function build() {
  const src = await readFile(SRC, 'utf8');
  const meta = extractLiteral(src, /var\s+SCREENER_DB_META\s*=\s*/g, '{', '}');
  const universe = extractLiteral(src, /var\s+SCREENER_DB\s*=\s*/g, '[', ']');
  if (!Array.isArray(universe) || universe.length < 100) {
    throw new Error(`universe 배열이 비정상적으로 작음: ${Array.isArray(universe) ? universe.length : typeof universe}건 (최소 100건 기대)`);
  }
  const bad = universe.filter(r => !r || typeof r.sym !== 'string' || !r.sym);
  if (bad.length) throw new Error(`sym 필드 없는 레코드 ${bad.length}건`);
  const uniqueSymbols = new Set(universe.map((row) => row.sym)).size;
  meta.recordCount = universe.length;
  meta.uniqueSymbols = uniqueSymbols;
  meta.duplicateSymbols = Math.max(0, universe.length - uniqueSymbols);
  const updatedAt = meta.lastBulkUpdate ? Date.parse(`${meta.lastBulkUpdate}T00:00:00Z`) : NaN;
  meta.currentness = Number.isFinite(updatedAt) && Number.isFinite(Number(meta.staleAfterDays)) && Date.now() - updatedAt > Number(meta.staleAfterDays) * 86400000 ? 'STALE' : 'CURRENT';
  return { meta, universe, generatedFrom: 'js/aio-data.js:SCREENER_DB', generatedBy: 'scripts/sync-screener-universe.mjs' };
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const fresh = await build();
  const freshText = JSON.stringify(fresh, null, 1) + '\n';

  if (checkOnly) {
    let existingText = null;
    try { existingText = await readFile(OUT, 'utf8'); } catch (_) {}
    if (existingText === freshText) {
      console.log(`[sync-screener-universe] OK — ${fresh.universe.length}건, drift 없음.`);
      return;
    }
    console.error(`[sync-screener-universe] ❌ drift 감지 — public-data/screener-universe.json이 js/aio-data.js의 SCREENER_DB와 어긋남.`);
    console.error(`  고치려면: node scripts/sync-screener-universe.mjs`);
    process.exit(1);
  }

  await writeFile(OUT, freshText, 'utf8');
  console.log(`[sync-screener-universe] ${fresh.universe.length}건 동기화 완료 → public-data/screener-universe.json`);
}

main().catch(e => { console.error('[sync-screener-universe] 실패:', e && e.message || e); process.exit(1); });
