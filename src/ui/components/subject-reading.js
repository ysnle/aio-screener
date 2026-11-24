// The per-subject AI reading on the face (src/ai/reading/subject-reading.js builds the packet and checks the answer). One
// paragraph or two under the screen's own facts, tagged "AI 분석" with the close it reads. Loaded by the 종목, 기술적 분석
// and 포트폴리오 screens only when they paint a subject.
//
// When it is written (budget: the reading-cost numbers in the hand-off of this change):
//   종목 and a chart — automatically a moment after the screen's facts settle, while the shared budget is 'ok' and this
//   browser has written fewer than AUTO_PER_DAY automatic readings today; otherwise an "AI 분석" button.
//   포트폴리오 — only from the button, and only with the portfolio AI consent the chat already asks for: what leaves the
//   browser is ticker, sector, weight and return (portfolioRowsForAI), nothing is stored outside this tab's memory.
// A reading is kept per subject per close (the packet's key, src/storage/subject-readings.js): 종목 and charts in this
// browser's store (public facts), the portfolio in memory only. On failure or an exhausted budget the screen keeps its rule facts and one line says why.
import { buildSubjectPacket, buildSubjectPrompt, validateSubjectReading } from '../../ai/reading/subject-reading.js';
import { buildReadingRetryPrompt, normalizeReading, readingBlocks } from '../../ai/reading/reading-core.js';
import { readingRoute, requestSharedReading } from '../../data/providers/shared-reading-request.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { cachedSubjectReading, rememberSubjectReading, takeAutoReading } from '../../storage/subject-readings.js';

export const AUTO_PER_DAY = 30;
const SETTLE_MS = 2500; // the facts of a 종목 arrive in steps (consensus, fiscal history); one request on the settled set
const POLICY = Object.freeze({
  stock: Object.freeze({ auto: true, consent: false }),
  chart: Object.freeze({ auto: true, consent: false }),
  portfolio: Object.freeze({ auto: false, consent: true })
});
const LINE = Object.freeze({
  budget: '이번 달 공용 AI 예산을 넘어 AI 분석을 쉬고 있습니다. 위 수치와 판정은 그대로입니다.',
  'rate-limit': '오늘 AI 요청 한도에 닿아 분석하지 못했습니다. 위 수치와 판정은 그대로입니다.',
  blocked: 'AI가 쓴 분석이 화면의 수치와 맞지 않아 싣지 않았습니다. 위 수치와 판정은 그대로입니다.',
  route: '공용 AI 연결을 확인하지 못해 분석하지 못했습니다. 위 수치와 판정은 그대로입니다.',
  failed: 'AI 응답을 받지 못했습니다. 위 수치와 판정은 그대로입니다.'
});
const pending = new Map();
const md = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function head(doc, packet) {
  const row = el(doc, 'p', 'screen-reading__head');
  row.append(el(doc, 'span', 'screen-reading__tag', 'AI 분석'), el(doc, 'span', 'screen-reading__basis', `${md(packet.basis)} 종가 기준`));
  return row;
}
function show(host, nodes) { host.replaceChildren(...nodes); host.hidden = false; }

/** Asks once, retries once with the blocking reasons, and returns { status: 'verified', text, basis } or { status, reason }. */
export async function writeSubjectReading(root, packet, { request = requestSharedReading } = {}) {
  const prompt = buildSubjectPrompt(packet);
  let answer = await request(root, prompt, { purpose: `subject-reading-${packet.kind}` });
  let text = answer?.text ? normalizeReading(answer.text) : null;
  let verdict = text ? validateSubjectReading(text, packet) : null;
  if (text && verdict.issues.length) {
    answer = await request(root, buildReadingRetryPrompt(prompt, verdict), { purpose: `subject-reading-${packet.kind}-retry` });
    text = answer?.text ? normalizeReading(answer.text) : null;
    verdict = text ? validateSubjectReading(text, packet) : null;
  }
  if (text && verdict && !verdict.issues.length) return { status: 'verified', text, basis: packet.basis, warnings: verdict.warnings };
  if (text) return { status: 'blocked', reason: 'blocked' };
  const reason = answer?.reason === 'budget' || answer?.reason === 'rate-limit' ? answer.reason : answer?.reason === 'no-route' || answer?.reason === 'route-not-ready' ? 'route' : 'failed';
  return { status: 'failed', reason };
}

function paintReading(doc, host, packet, reading) {
  show(host, [head(doc, packet), ...readingBlocks(reading.text).map((block) => el(doc, 'p', 'screen-reading__text', block))]);
}
function paintLine(doc, host, packet, reason) { show(host, [head(doc, packet), el(doc, 'p', 'screen-reading__note', LINE[reason] || LINE.failed)]); }

function run(doc, root, hostId, packet) {
  const host = doc.getElementById(hostId);
  if (!host || host.dataset.readingKey !== packet.key) return;
  show(host, [head(doc, packet), el(doc, 'p', 'screen-reading__note screen-reading__wait', 'AI가 이 화면의 사실을 읽고 있습니다.')]);
  writeSubjectReading(root, packet).then((result) => {
    if (result.status === 'verified') rememberSubjectReading(root, packet, { text: result.text, basis: result.basis });
    const now = doc.getElementById(hostId);
    if (!now || now.dataset.readingKey !== packet.key) return;
    if (result.status === 'verified') paintReading(doc, now, packet, result);
    else paintLine(doc, now, packet, result.reason);
  }).catch(() => { const now = doc.getElementById(hostId); if (now?.dataset.readingKey === packet.key) paintLine(doc, now, packet, 'failed'); });
}

function paintButton(doc, root, hostId, packet) {
  const host = doc.getElementById(hostId);
  if (!host) return;
  const button = el(doc, 'button', 'flow-next-link screen-reading__ask', 'AI 분석');
  button.type = 'button';
  const consent = POLICY[packet.kind].consent;
  const note = consent ? el(doc, 'p', 'screen-reading__note', '보유 종목의 기호·업종·비중·수익률만 공용 AI로 보내고, 수량·금액·메모는 보내지 않습니다. 결과는 이 탭에만 남습니다.') : null;
  button.addEventListener('click', () => {
    if (consent && root?.AIO?.hasPortfolioAIConsent?.() !== true) root?.AIO?.setPortfolioAIConsent?.(true);
    run(doc, root, hostId, packet);
  });
  show(host, [head(doc, packet), ...(note ? [note] : []), button]);
}

/**
 * Paints the reading of `kind` for `input` into `#hostId`: the cached reading, a waiting state then the reading, a button,
 * or one line saying why there is none. Without a packet the host is emptied and hidden.
 */
export function mountSubjectReading({ documentRef: doc, root = globalThis, hostId, kind, input = {} } = {}) {
  const host = doc?.getElementById?.(hostId);
  if (!host || !POLICY[kind]) return null;
  let regime = null;
  try { regime = marketInterpretation(root).regime || null; } catch (_) { regime = null; }
  const packet = buildSubjectPacket(kind, { ...input, regime });
  if (!packet) { host.replaceChildren(); host.hidden = true; delete host.dataset.readingKey; return null; }
  if (host.dataset.readingKey === packet.key && host.childElementCount) return packet;
  host.dataset.readingKey = packet.key;
  const hit = cachedSubjectReading(root, packet);
  if (hit?.text) { paintReading(doc, host, packet, hit); return packet; }
  // The facts settle before anything is asked: a later mount of the same subject replaces the pending one.
  const slot = `${kind}:${packet.subject}`;
  clearTimeout(pending.get(slot));
  host.replaceChildren(); host.hidden = true;
  pending.set(slot, setTimeout(() => {
    pending.delete(slot);
    if (doc.getElementById(hostId)?.dataset.readingKey !== packet.key) return;
    readingRoute(root).then((route) => {
      const now = doc.getElementById(hostId);
      if (!now || now.dataset.readingKey !== packet.key) return;
      if (!route.ok) { paintLine(doc, now, packet, 'route'); return; }
      if (route.budgetState === 'exhausted') { paintLine(doc, now, packet, 'budget'); return; }
      const today = new Date().toISOString().slice(0, 10);
      if (POLICY[kind].auto && route.budgetState === 'ok' && takeAutoReading(root, today, AUTO_PER_DAY)) run(doc, root, hostId, packet);
      else paintButton(doc, root, hostId, packet);
    }).catch(() => {});
  }, SETTLE_MS));
  return packet;
}
