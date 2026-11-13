// What a chat answer is doing while the reader waits: one pending state per run, read by the panel's status line
// (src/ui/components/chat-run-status.js). Pure: the clock is handed in, nothing here touches the page. Only the length
// of the streamed text is ever read, never the text itself (it is shown after the evidence and action filters).

export const RUN_PROGRESS = Object.freeze({ elapsedAfterSec: 5, slowAfterSec: 25, charsEveryMs: 500, stallShare: 0.6 });

export const RUN_STAGE_LABELS = Object.freeze({
  preparing: '질문에 맞는 자료를 고르는 중',
  searching: '웹에서 찾는 중',
  tools: '자료를 더 찾는 중',
  thinking: '생각하는 중',
  writing: '답변을 쓰는 중',
  checking: '숫자와 근거를 확인하는 중'
});

export const RUN_SLOW_NOTE = '자료 조회와 검색이 있으면 1~2분 걸릴 수 있습니다. 진행 중입니다.';
export const RUN_STALL_NOTE = '응답이 늦어지고 있습니다. 조금 더 기다립니다.';

const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const elapsedText = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : `${sec}초`);

/**
 * The stage a request starts in once it is sent: a hosted search the request must run (tool_choice 'required') is
 * `searching`; a request that reasons first (effort low or medium) is `thinking`; otherwise null (the stage stays).
 * The stream parser reads no search-progress event, so a search the model may skip (tool_choice 'auto') shows `thinking`.
 */
export function stageForRequest(body) {
  const searches = Array.isArray(body?.tools) && body.tools.some((tool) => tool?.type === 'web_search');
  if (searches && body.tool_choice === 'required') return 'searching';
  return ['low', 'medium'].includes(body?.reasoning?.effort) ? 'thinking' : null;
}

/**
 * One run's pending state. `stage(name, detail)` moves it (detail: the tools line from the tool loop), `chars(n)` records
 * the streamed length (moves to `writing`), `event()` records stream activity, `quiet(ms)` sets the stream's chunk
 * timeout (the stall note shows at 60 % of it without an event), `stages()` lists the stages passed, and `snapshot(at)`
 * returns { stage, base, counters, label, note, elapsedSec, slow, stalled }. The shown count changes at most twice a second.
 */
export function createRunProgress({ now = () => Date.now(), startedAt = now() } = {}) {
  let current = 'preparing', detail = '', latest = 0, shown = 0, shownAt = -Infinity, lastActivity = startedAt, quietMs = 0;
  const history = ['preparing'];
  const touch = () => { lastActivity = now(); };
  const api = {
    stage(name, value = '') {
      if (!RUN_STAGE_LABELS[name]) return api;
      if (name !== current) history.push(name);
      current = name;
      detail = String(value || '');
      touch();
      return api;
    },
    chars(n) {
      latest = Math.max(0, Math.floor(Number(n) || 0));
      if (latest > 0 && current !== 'writing' && current !== 'checking') api.stage('writing');
      touch();
      return api;
    },
    event() { touch(); return api; },
    quiet(ms) { quietMs = Number(ms) > 0 ? Number(ms) : 0; touch(); return api; },
    stages: () => history.slice(),
    snapshot(at = now()) {
      const elapsedSec = Math.max(0, Math.floor((at - startedAt) / 1000));
      if (latest !== shown && at - shownAt >= RUN_PROGRESS.charsEveryMs) { shown = latest; shownAt = at; }
      const base = current === 'tools'
        ? (detail.startsWith(RUN_STAGE_LABELS.tools) ? detail : `${RUN_STAGE_LABELS.tools}: ${detail || '추가 자료'}`)
        : RUN_STAGE_LABELS[current];
      const counters = (current === 'writing' ? ` (${grouped(shown)}자)` : '') + (elapsedSec >= RUN_PROGRESS.elapsedAfterSec ? ` · ${elapsedText(elapsedSec)}` : '');
      const slow = elapsedSec >= RUN_PROGRESS.slowAfterSec;
      const stalled = quietMs > 0 && current !== 'tools' && current !== 'checking' && at - lastActivity >= quietMs * RUN_PROGRESS.stallShare;
      const note = stalled ? RUN_STALL_NOTE : slow ? RUN_SLOW_NOTE : '';
      return { stage: current, base, counters, label: base + counters, note, elapsedSec, slow, stalled };
    }
  };
  return api;
}

/**
 * The hook callSharedAi calls (opts.onStage): 'sent' { body, quietMs } when a request goes out, 'event' when the stream
 * delivers anything, 'ended' when the last stream is complete (the answer is checked next). 'ended' returns what
 * `settle()` returns, so the caller can let the page paint the checking line before the synchronous filters run.
 */
export function progressHook(progress, { settle = () => undefined } = {}) {
  return (name, value) => {
    if (name === 'sent') {
      progress.quiet(value?.quietMs);
      const next = stageForRequest(value?.body);
      if (next) progress.stage(next);
    } else if (name === 'event') progress.event();
    else if (name === 'ended') { progress.stage('checking'); return settle(); }
    return undefined;
  };
}
