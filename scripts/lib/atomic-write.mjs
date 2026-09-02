import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let sequence = 0;
const RENAME_RETRY_DELAYS_MS = Object.freeze([10, 25, 50, 100, 200, 400, 800, 1200]);
const RETRYABLE_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY', 'UNKNOWN']);
const waitArray = new Int32Array(new SharedArrayBuffer(4));

function temporaryPath(target) {
  sequence += 1;
  return `${target}.${process.pid}.${sequence}.tmp`;
}

function renameWithRetrySync(temporary, target) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      fs.renameSync(temporary, target);
      return;
    } catch (error) {
      const retryable = RETRYABLE_RENAME_CODES.has(error?.code);
      if (!retryable || attempt >= RENAME_RETRY_DELAYS_MS.length) throw error;
      Atomics.wait(waitArray, 0, 0, RENAME_RETRY_DELAYS_MS[attempt]);
    }
  }
}

async function renameWithRetry(temporary, target) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fsp.rename(temporary, target);
      return;
    } catch (error) {
      const retryable = RETRYABLE_RENAME_CODES.has(error?.code);
      if (!retryable || attempt >= RENAME_RETRY_DELAYS_MS.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_DELAYS_MS[attempt]));
    }
  }
}

export function atomicWriteFileSync(target, data, options = 'utf8') {
  if (target instanceof URL) target = fileURLToPath(target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = temporaryPath(target);
  try {
    fs.writeFileSync(temporary, data, options);
    renameWithRetrySync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

export function atomicWriteJsonSync(target, value) {
  atomicWriteFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function atomicWriteFile(target, data, options = 'utf8') {
  if (target instanceof URL) target = fileURLToPath(target);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const temporary = temporaryPath(target);
  try {
    await fsp.writeFile(temporary, data, options);
    await renameWithRetry(temporary, target);
  } finally {
    await fsp.rm(temporary, { force: true }).catch(() => {});
  }
}
