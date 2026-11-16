import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const SHA = /^[0-9a-f]{40}$/;

// P1351: bounded run lists are discovery hints, never the final provenance authority.
function isTrustedRunIdentity(run, { repository, name, runId, allowInProgress = false }) {
  return Number.isSafeInteger(Number(runId)) && Number(runId) > 0
    && Number(run?.id) === Number(runId)
    && run?.name === name && run?.head_branch === 'main'
    && run?.head_repository?.full_name === repository
    && ['push', 'workflow_dispatch', 'workflow_run'].includes(run?.event)
    && ((run?.status === 'completed' && run?.conclusion === 'success')
      // P2112: the API can still report the running release as 'queued' while its own deploy job runs.
      || (allowInProgress && ['in_progress', 'queued'].includes(run?.status)));
}

export function isTrustedDeploymentRun(run, { sha, ...identity }) {
  return isTrustedRunIdentity(run, identity) && SHA.test(sha || '') && run?.head_sha === sha;
}

/** The Validate step's attested-release-rule block in pages-deploy.yml: the one definition of which SHA a CI run may release. */
export function attestedReleaseRule(workflowText = readFileSync(new URL('../.github/workflows/pages-deploy.yml', import.meta.url), 'utf8')) {
  const block = workflowText.match(/# attested-release-rule:begin[^\n]*\n([\s\S]*?)\n\s*# attested-release-rule:end/)?.[1];
  if (!block) throw new Error('pages-deploy.yml has no attested-release-rule block');
  return block.replace(/^ {10}/gm, '');
}

// The runner's bash; on Windows a PowerShell-launched node has no bash on PATH, so Git for Windows' own is used.
function bashExecutable() {
  if (process.platform !== 'win32') return 'bash';
  try {
    const gitBash = join(execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(), '..', '..', '..', 'bin', 'bash.exe');
    if (existsSync(gitBash)) return gitBash;
  } catch {}
  return 'bash';
}

/**
 * Runs the rule block as the Pages runner does (bash, set -euo pipefail) on an attestation document.
 * `explicitSha` is the SHA the release must equal; `workflowSha`/`ciHeadSha` are the CI run's head.
 * Returns { ok, sha, output }: sha is the attested SHA the rule accepted (stdout carries the runner annotations).
 */
export function runAttestedReleaseRule({ attestation, runId, repository, ciEvent, ciHeadSha, workflowSha = ciHeadSha, explicitSha = '' }, rule = attestedReleaseRule()) {
  const dir = mkdtempSync(join(tmpdir(), 'aio-attested-release-'));
  try {
    const file = join(dir, 'aio-release-attestation.json');
    writeFileSync(file, `${JSON.stringify(attestation)}\n`);
    const run = spawnSync(bashExecutable(), ['-c', `set -euo pipefail\n${rule}\nprintf 'accepted=%s\\n' "$sha"`], {
      encoding: 'utf8',
      env: { ...process.env, file, EXPECTED_RUN_ID: String(runId), GITHUB_REPOSITORY: repository, CI_EVENT: ciEvent || '', CI_HEAD_SHA: ciHeadSha || '', WORKFLOW_SHA: workflowSha || '', EXPLICIT_SHA: explicitSha || '' }
    });
    const output = `${run.stdout || ''}${run.stderr || ''}`.trim();
    const sha = /^accepted=([0-9a-f]{40})$/m.exec(run.stdout || '')?.[1] || null;
    return { ok: run.status === 0 && !!sha, sha, output: run.error ? `rule-unavailable: ${run.error.message}` : output, unavailable: !!run.error };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Whether a live deployment of `deployedSha` is one the Pages deploy would have released from this CI run. Pages
 * deploys the SHA in the run's aio-release-attestation artifact, not the run's head_sha (a dispatched run reports the
 * branch head at dispatch). The decision runs the deploy's own rule with the deployed SHA as the required SHA, so the
 * watchdog trusts exactly what the deploy accepts. Fetching the run and its attestation stays with the caller;
 * `attestation` null (with `unavailable` naming why) is untrusted.
 */
export function ciReleaseTrust({ run, runId, repository, attestation, unavailable = '', deployedSha }, rule = attestedReleaseRule()) {
  if (!isTrustedRunIdentity(run, { repository, name: 'CI', runId })) {
    return { trusted: false, reason: `CI run ${runId} is not a successful main CI run of ${repository} (event=${run?.event || 'missing'} conclusion=${run?.conclusion || 'missing'})` };
  }
  if (!SHA.test(deployedSha || '')) return { trusted: false, reason: `deployed sourceSha is not a commit id: ${deployedSha || 'missing'}` };
  if (!attestation) return { trusted: false, reason: `attestation-unavailable run=${runId}: ${unavailable || 'no aio-release-attestation artifact'}` };
  const verdict = runAttestedReleaseRule({ attestation, runId, repository, ciEvent: run.event, ciHeadSha: run.head_sha, explicitSha: deployedSha }, rule);
  if (verdict.unavailable) return { trusted: false, reason: verdict.output };
  const annotations = verdict.output.split(/\r?\n/).filter((line) => /^::(error|notice)::/.test(line)).map((line) => line.replace(/^::\w+::/, '')).join('; ');
  return verdict.ok
    ? { trusted: true, reason: `attested=${verdict.sha} event=${run.event} head=${run.head_sha}${annotations ? ` (${annotations})` : ''}` }
    : { trusted: false, reason: annotations || `the deploy's attestation validation rejected the artifact of run ${runId} (schema, testedSha, runId or repository)` };
}

/** Reads one file from an Actions artifact archive (zip, stored or deflated) through its central directory. */
export function readZipEntry(buffer, name) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('artifact archive has no zip directory');
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let entry = 0, count = buffer.readUInt16LE(eocd + 10); entry < count; entry += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('artifact archive directory is malformed');
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    if (buffer.toString('utf8', offset + 46, offset + 46 + nameLength) === name) {
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(start, start + size);
      if (method === 0) return data.toString('utf8');
      if (method === 8) return inflateRawSync(data).toString('utf8');
      throw new Error(`artifact archive entry ${name} uses unsupported compression ${method}`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`artifact archive has no ${name}`);
}

export async function resolveProvenanceRun(runs, runId, readExact) {
  if (!Number.isSafeInteger(Number(runId)) || Number(runId) <= 0) throw new Error('invalid deployment provenance run id');
  const listed = runs?.find?.((run) => Number(run.id) === Number(runId));
  return listed || await readExact(Number(runId));
}
