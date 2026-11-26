#!/usr/bin/env node
// The words the screens print as named measures must have a glossary entry. The glossary a reader searches is
// assembled at runtime (src/ui/knowledge/glossary-bridge.js): js/aio-glossary.js, the screen-term lists under
// src/domain/knowledge/ and the canonical concepts (concept-core.js). A UI word is covered when it equals an entry's term,
// the term before its bracket, a name inside the bracket, or one of its aliases.
//   1. REQUIRED_UI_TERMS — words a screen prints that had no entry (칼만, 포켓 피벗, CVaR, …). Add a word here when a
//      screen starts printing a new named measure.
//   2. Every screener column label (SCREENER_COLUMN_REGISTRY) is covered, maps to a named entry (COLUMN_TERMS), or is
//      declared plain (PLAIN_COLUMN_LABELS). A new column fails until it is classified.
//   3. Every TERM_MARKS target names an assembled entry.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

export const REQUIRED_UI_TERMS = Object.freeze([
  '칼만', '추세 속도', '혁신', '후속 확인', '포켓 피벗', '일드갭', '주식위험프리미엄', 'ERP', '발생액 비율', 'CVaR',
  '거래량 배수', 'RVOL', '종합 순위', '전체 순위', '베이스', '앵커 VWAP'
]);
// Column label → the glossary entry that defines it (the label is a short form of that entry).
export const COLUMN_TERMS = Object.freeze({
  '시총': '시가총액(Market Cap)',
  '52주 고점 대비': '52주 신고가/신저가',
  '52주 위치': '52주 신고가/신저가',
  'RS 백분위(6개월)': '상대강도 순위(RS Rank)',
  'RS 백분위(12개월)': '상대강도 순위(RS Rank)',
  'vs 50MA': '이동평균 (50일선 · 200일선)',
  '50일선 거리(변동폭 배수)': '이동평균 (50일선 · 200일선)',
  '수축 구조(VCP)·충족도': 'VCP 패턴',
  '수축': 'VCP 패턴',
  // The ladder 돌파 대기 ⊂ 베이스 완성 ⊂ 템플릿 통과 stands on the 8-check trend template, defined under SEPA.
  '후보 상태': 'SEPA (Specific Entry Point Analysis)',
  '피벗 대비': '피벗 (피벗 가격)',
  '밸류': '팩터',
  '퀄리티': '팩터'
});
// Plain words and app controls: the column hint says what they are; they name no measure to look up.
export const PLAIN_COLUMN_LABELS = Object.freeze(['관심', '순서', '상위', '1주', '1개월', '6M', '순이익률', '매출 성장', '일평균 변동폭', '거래대금(30일)', '상대 상태', '테마 단계', '최신뉴스·근거', '미충족 이유', '다음 실적']);

const norm = (text) => String(text || '').toLowerCase().replace(/[\s·,()（）\-−_/]/g, '');

export async function assembledGlossary() {
  const context = {};
  vm.runInNewContext(`${fs.readFileSync(path.join(ROOT, 'js/aio-glossary.js'), 'utf8')}\n;this.__glossary = GLOSSARY;`, context);
  const { SCREEN_TERM_MARKED } = await load('src/domain/knowledge/screen-term-marked.js');
  const { SCREEN_TERM_ADDITIONS } = await load('src/domain/knowledge/screen-term-additions.js');
  const { DEFERRED_SCREEN_TERMS } = await load('src/domain/knowledge/deferred-screen-terms.js');
  const { CONCEPT_CORE } = await load('src/domain/knowledge/concept-core.js');
  return [
    ...context.__glossary, ...SCREEN_TERM_MARKED, ...SCREEN_TERM_ADDITIONS, ...DEFERRED_SCREEN_TERMS,
    ...CONCEPT_CORE.map((concept) => ({ term: concept.term, alias: [...concept.aliases, ...(concept.covers || [])].join(', ') }))
  ];
}

export function glossaryNames(entries) {
  const names = new Set();
  for (const entry of entries) {
    const term = String(entry?.term || '');
    names.add(norm(term));
    names.add(norm(term.replace(/\s*[(（].*$/, '')));
    for (const match of term.matchAll(/[(（]([^)）]*)[)）]/g)) for (const part of match[1].split(/[·,]/)) names.add(norm(part));
    // Aliases are comma lists (js/aio-glossary.js) or space lists (screen-term files): a phrase of up to four words counts.
    for (const piece of String(entry?.alias || '').split(/[,、]/)) {
      names.add(norm(piece));
      const words = piece.trim().split(/\s+/);
      for (let i = 0; i < words.length; i += 1) for (let k = 1; k <= 4 && i + k <= words.length; k += 1) names.add(norm(words.slice(i, i + k).join(' ')));
    }
  }
  names.delete('');
  return names;
}

export async function checkGlossaryVocabulary() {
  const entries = await assembledGlossary();
  const names = glossaryNames(entries);
  const terms = new Set(entries.map((entry) => entry.term));
  const failures = [];
  for (const word of REQUIRED_UI_TERMS) if (!names.has(norm(word))) failures.push(`UI word "${word}" has no glossary entry`);
  const { SCREENER_COLUMN_REGISTRY } = await load('src/ui/pages/screener/model.js');
  const labels = new Set();
  for (const column of SCREENER_COLUMN_REGISTRY) {
    const label = String(column.label || '');
    labels.add(label);
    if (names.has(norm(label))) continue;
    if (Object.hasOwn(COLUMN_TERMS, label)) { if (!terms.has(COLUMN_TERMS[label])) failures.push(`column "${label}" maps to missing entry "${COLUMN_TERMS[label]}"`); continue; }
    if (PLAIN_COLUMN_LABELS.includes(label)) continue;
    failures.push(`screener column "${label}" (${column.key}) has no glossary entry and is not declared in COLUMN_TERMS or PLAIN_COLUMN_LABELS`);
  }
  for (const label of [...Object.keys(COLUMN_TERMS), ...PLAIN_COLUMN_LABELS]) if (!labels.has(label)) failures.push(`stale classification: no screener column is labelled "${label}"`);
  const { TERM_MARKS } = await load('src/ui/components/term-marks.js');
  for (const [text, term] of TERM_MARKS) if (!terms.has(term)) failures.push(`term mark "${text}" names missing entry "${term}"`);
  return { entries: entries.length, required: REQUIRED_UI_TERMS.length, columns: SCREENER_COLUMN_REGISTRY.length, failures };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const result = await checkGlossaryVocabulary();
  if (result.failures.length) {
    console.error(`[glossary-vocabulary] FAIL ${result.failures.length}`);
    for (const failure of result.failures) console.error(` - ${failure}`);
    process.exit(1);
  }
  console.log(`[glossary-vocabulary] OK: ${result.required} UI words, ${result.columns} screener columns, assembled glossary ${result.entries} entries`);
}
