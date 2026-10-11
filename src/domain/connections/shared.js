// P1607: server configuration, caller access and a data artifact are different evidence.
export function describeSharedConnection(health, httpOk = true) {
  if (!httpOk || health?.schemaVersion !== 'aio-worker-health.v1') return { ok: false, reason: 'WORKER_NOT_READY', label: '공용 AI 연결 미확인' };
  if ((health.ai?.appTokenRequired || health.relay?.appTokenRequired) && health.ai?.appTokenAccepted !== true) {
    return { ok: false, reason: 'AUTH_FAILED', label: '공용 AI 연결 설정 확인 필요' };
  }
  const ready = health.ai?.ready === true && health.ai?.provider === 'openai' && health.ai?.model === 'gpt-6-luna';
  return { ok: ready, reason: ready ? 'SHARED_WORKER' : 'WORKER_NOT_READY', label: ready ? '공용 AI 연결 준비됨 · 개인 AI 키 불필요' : '공용 AI 연결 준비 안 됨' };
}
