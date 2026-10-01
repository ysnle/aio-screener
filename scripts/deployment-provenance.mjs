// P1351: bounded run lists are discovery hints, never the final provenance authority.
export function isTrustedDeploymentRun(run, { repository, name, sha, runId, allowInProgress = false }) {
  return Number.isSafeInteger(Number(runId)) && Number(runId) > 0
    && Number(run?.id) === Number(runId)
    && run?.name === name && run?.head_branch === 'main'
    && run?.head_repository?.full_name === repository
    && /^[0-9a-f]{40}$/.test(sha || '') && run?.head_sha === sha
    && ['push', 'workflow_dispatch', 'workflow_run'].includes(run?.event)
    && ((run?.status === 'completed' && run?.conclusion === 'success')
      || (allowInProgress && run?.status === 'in_progress'));
}

export async function resolveProvenanceRun(runs, runId, readExact) {
  if (!Number.isSafeInteger(Number(runId)) || Number(runId) <= 0) throw new Error('invalid deployment provenance run id');
  const listed = runs?.find?.((run) => Number(run.id) === Number(runId));
  return listed || await readExact(Number(runId));
}
