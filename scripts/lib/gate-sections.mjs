// Runs several checks inside one QA gate (v58.86 gate consolidation). Each section is the body of a check that used to be
// its own scripts/ci-*.mjs gate; a section fails when it throws, calls process.exit(non-zero) or leaves process.exitCode
// set. Every section runs even after an earlier one fails, and the gate exits 1 naming each failed section.

class SectionExit extends Error {
  constructor(code) {
    super(`section exit ${code}`);
    this.code = code;
  }
}

export async function runSections(gateName, sections) {
  const failed = [];
  const realExit = process.exit;
  for (const [label, body] of sections) {
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
    console.error(`[${gateName}] ${failed.length}/${sections.length} section(s) failed: ${failed.join(', ')}`);
    process.exit(1);
  }
  console.log(`[${gateName}] OK: ${sections.length} section(s): ${sections.map(([label]) => label).join(', ')}`);
}
