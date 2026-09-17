#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/report-qa-failures.mjs — QA 실패 상세를 Step Summary로 내보낸다
//
// 배경 (P1083):
//   data-watchdog.yml의 요약 스텝은 JS 템플릿 리터럴을 `node -e "..."`로 넘겼고,
//   그 문자열이 bash에 먼저 확장되어 `${failed.map(...)}: bad substitution`으로
//   죽었다. 결과적으로 Step Summary가 빈 채로 발행되어, 실패한 게이트가 무엇인지
//   운영자가 알 수 없었다. 워치독이 20회 연속 red인데도 아무도 대응하지 못한
//   실질적 원인 중 하나다.
//
// 이 스크립트는 셸 확장을 거치지 않는 파일로 분리되어 있고, 리포트 스키마
// (aio-qa-run.v1)에 대해 단위 검증이 가능하다. 지정된 경로에 리포트가 없어도
// 절대 throw하지 않는다 — 실패 결론은 뒤따르는 스텝이 담당한다.
//
// 사용법:
//   node scripts/report-qa-failures.mjs [--report <path>] [--title <text>]
// 환경변수:
//   AIO_QA_CACHE_DIR   리포트 디렉터리 (기본 .cache/aio-qa)
//   AIO_QA_REPORT      리포트 경로 직접 지정
//   GITHUB_STEP_SUMMARY 있으면 그 파일에 append, 없으면 stdout만
// ─────────────────────────────────────────────────────────────────────────────

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const cacheDir = process.env.AIO_QA_CACHE_DIR ? resolve(process.env.AIO_QA_CACHE_DIR) : resolve('.cache/aio-qa');
const reportPath = valueOf('--report') || process.env.AIO_QA_REPORT || join(cacheDir, 'last-run.json');
const title = valueOf('--title') || 'QA run';

const lines = [];
const push = (line) => lines.push(line);
const shortSha = (value) => (typeof value === 'string' && value.length >= 12 ? value.slice(0, 12) : value);
const tail = (value, count = 3) =>
  String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-count)
    .join(' | ') || 'no detail';

let report = null;
let loadError = null;
try {
  report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8').replace(/^\uFEFF/, '')) : null;
  if (!report) loadError = `report not found at ${reportPath}`;
} catch (error) {
  loadError = error.message;
}

if (loadError) {
  push(`## ${title} failure detail`);
  push('');
  push(`- QA report unavailable: ${loadError}`);
  push('- The gate conclusions above are the authoritative signal; this summary only adds detail.');
  push('');
} else {
  const results = Array.isArray(report.results) ? report.results : [];
  const failed = results.filter((entry) => entry.status === 'FAIL');
  const skipped = results.filter((entry) => entry.status === 'SKIP');
  const counts = report.counts || {};
  const durationSeconds = Number.isFinite(report.durationMs) ? Math.round(report.durationMs / 100) / 10 : null;

  push(`## ${title} failure detail`);
  push('');
  push(`- Profile: \`${report.profile || 'unknown'}\` · groups: ${(report.groups || []).join(', ') || 'none'}${durationSeconds === null ? '' : ` · duration: ${durationSeconds}s`}`);
  push(`- Counts: pass=${counts.PASS || 0} cached=${counts.CACHED || 0} fail=${counts.FAIL || 0} skip=${counts.SKIP || 0}`);
  push(`- Revision: \`${shortSha(process.env.GITHUB_SHA) || 'local'}\``);
  push(`- Failed gates: ${failed.map((entry) => `${entry.id}${entry.timedOut ? ' (timeout)' : ''}`).join(', ') || 'none'}`);
  push(`- Failed gate details: ${failed.map((entry) => `${entry.id}: ${tail(entry.error || entry.output)}`).join(' ; ') || 'none'}`);
  push(`- Blocked/skipped gates: ${skipped.map((entry) => `${entry.id}${entry.blockedBy?.length ? `(blocked by ${entry.blockedBy.join(',')})` : ''}`).join(', ') || 'none'}`);
  push(`- QA report: ${reportPath}`);
  if (report.changeSource) push(`- Change source: ${report.changeSource}${(report.changedFiles || []).length ? ` (${(report.changedFiles || []).length} file(s))` : ''}`);
  push('');
}

const summary = `${lines.join('\n')}\n`;
if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  } catch (error) {
    console.error(`step summary append failed: ${error.message}`);
  }
}
console.log(summary);
