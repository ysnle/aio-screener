// scripts/lib/clock-offset.mjs — v60.49. Loaded through NODE_OPTIONS=--import, so child processes follow: moves the
// process's wall clock by AIO_CLOCK_OFFSET_MS milliseconds. Only the clock with no argument moves — Date.now() and
// new Date() — so dates a check spells out stay as written. vm contexts get the same clock (a check that runs browser
// code in a sandbox would otherwise compare times from two clocks days apart, which no real day does); a sandbox that
// brings its own Date keeps it. With AIO_CLOCK_READS_FILE set, a process that read the wall clock appends one line
// there at exit. ci-clock-shift-check uses both to run the contract checks on every weekday and on market holidays.
import vm from 'node:vm';
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

const offset = Number(process.env.AIO_CLOCK_OFFSET_MS);
// Source, so the same clock can be installed inside a vm context (whose Date is its own). `reads` counts wall-clock reads.
const SHIFT = `(function (offset, reads) {
  var Real = Date;
  if (Real.__aioClockOffset === offset) return;
  function wall() { reads.count += 1; return Real.now() + offset; }
  function ShiftedDate() {
    if (!new.target) return new Real(wall()).toString();
    return Reflect.construct(Real, arguments.length ? Array.prototype.slice.call(arguments) : [wall()], new.target);
  }
  Object.setPrototypeOf(ShiftedDate, Real);
  ShiftedDate.prototype = Real.prototype;
  ShiftedDate.now = function now() { return wall(); };
  ShiftedDate.__aioClockOffset = offset;
  globalThis.Date = ShiftedDate;
})`;

if (Number.isFinite(offset) && process.env.AIO_CLOCK_OFFSET_MS !== '') {
  const reads = { count: 0 };
  (0, eval)(SHIFT)(offset, reads);
  const { createContext } = vm;
  vm.createContext = (context = {}, options) => {
    const own = Object.hasOwn(context, 'Date');
    const made = createContext(context, options);
    if (!own) vm.runInContext(SHIFT, made)(offset, reads);
    return made;
  };
  vm.runInNewContext = (code, context, options) => vm.runInContext(code, vm.createContext(context || {}), options);
  vm.Script.prototype.runInNewContext = function (context, options) { return this.runInContext(vm.createContext(context || {}), options); };
  syncBuiltinESMExports();
  const readsFile = process.env.AIO_CLOCK_READS_FILE;
  if (readsFile) process.on('exit', () => { if (reads.count) appendFileSync(readsFile, `${process.argv[1] || process.argv0} ${reads.count}\n`); });
}
