// Runs several checks inside one QA gate (v58.86 gate consolidation). Each section is the body of a check that used to be
// its own scripts/ci-*.mjs gate; a section fails when it throws, calls process.exit(non-zero) or leaves process.exitCode
// set. Every section runs even after an earlier one fails, and the gate exits 1 naming each failed section.
//
// v60.50 (data-path split): a section is `[label, body, reads]`, where `reads` says what its verdict depends on —
// 'data' (artifacts a producer writes, public-data/**) or 'code' (code and pinned fixtures, including a code test that only
// borrows a published file as input). In a data run (DATA_RUN_ENV, set by scripts/qa-runner.mjs) the `code` sections are
// skipped and counted; everywhere else every section runs. A section that declares neither fails the gate.
import { isDataRun } from './qa-live-data.mjs';

export const SECTION_READS = Object.freeze(['code', 'data']);

class SectionExit extends Error {
  constructor(code) {
    super(`section exit ${code}`);
    this.code = code;
  }
}

export async function runSections(gateName, sections, env = process.env) {
  const undeclared = sections.filter(([, , reads]) => !SECTION_READS.includes(reads)).map(([label]) => label);
  if (undeclared.length) {
    console.error(`[${gateName}] section(s) declare no input (${SECTION_READS.join('|')}): ${undeclared.join(', ')}`);
    process.exit(1);
  }
  const skipped = isDataRun(env) ? sections.filter(([, , reads]) => reads === 'code') : [];
  const run = sections.filter((section) => !skipped.includes(section));
  if (skipped.length) console.log(`[${gateName}] data run: ${skipped.length} code section(s) skipped: ${skipped.map(([label]) => label).join(', ')}`);
  const failed = [];
  const realExit = process.exit;
  for (const [label, body] of run) {
    const outerExitCode = process.exitCode;
    process.exitCode = undefined;
    let code = 0;
    process.exit = (value = 0) => { throw new SectionExit(value); };
    try {
      await body();
      code = Number(process.exitCode || 0);
    } catch (error) {
      if (error instanceof SectionExit) code = Number(error.code || 0);
      else {
        console.error(error?.stack || error);
        code = 1;
      }
    } finally {
      process.exit = realExit;
      process.exitCode = outerExitCode;
    }
    if (code) {
      failed.push(label);
      console.error(`[${gateName}] FAIL section ${label}`);
    }
  }
  if (failed.length) {
    console.error(`[${gateName}] ${failed.length}/${run.length} section(s) failed: ${failed.join(', ')}`);
    process.exit(1);
  }
  console.log(`[${gateName}] OK: ${run.length} section(s): ${run.map(([label]) => label).join(', ')}${skipped.length ? ` (${skipped.length} code section(s) skipped in this data run)` : ''}`);
}
