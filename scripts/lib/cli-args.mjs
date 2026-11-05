// v59.70: strict argument parsing for the scripts that write the ledgers and the version (apply-pending-records,
// record-fix, bump-version). theme-sector ran `apply-pending-records.mjs --help` on 2026-11-04: the script ignored the
// unknown flag, bumped to v59.70, recorded every thread's entries and deleted the pending files. Now an unknown flag
// fails before anything is read, and --help (or -h) prints the usage and exits 0. ci-record-fix-check replays both.
//
//   const args = parseCliArgs(argv, { usage, flags: ['--dry-run'], options: ['--dir'], positional: { max: 1 } });
//   if (args.help) { console.log(usage); process.exit(0); }
//
// flags take no value, options take the next argument; positional collects the rest in order.
export class CliArgsError extends Error {}

export function parseCliArgs(argv, { usage = '', flags = [], options = [], positional = { min: 0, max: Infinity } } = {}) {
  const result = { help: false, flags: new Set(), options: {}, positional: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') { result.help = true; return result; }
    if (arg.startsWith('-')) {
      if (flags.includes(arg)) { result.flags.add(arg); continue; }
      if (options.includes(arg)) {
        const value = argv[index + 1];
        if (value == null || value.startsWith('--')) throw new CliArgsError(`${arg} needs a value\n${usage}`);
        result.options[arg] = value;
        index += 1;
        continue;
      }
      throw new CliArgsError(`unknown argument ${arg}\n${usage}`);
    }
    result.positional.push(arg);
  }
  const { min = 0, max = Infinity } = positional;
  if (result.positional.length < min || result.positional.length > max) throw new CliArgsError(`expected ${min === max ? min : `${min}-${max}`} positional argument(s), got ${result.positional.length}\n${usage}`);
  return result;
}
