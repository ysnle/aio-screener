// The day's market investigation as chat context: the same admitted block 오늘 shows (src/data/server-investigation.js),
// so a question about what happened today is answered from the investigation the reader sees, with the evidence kind of
// each cause kept (reported versus inferred). 오늘 shows the block only for the close it stands on (closeBasis of the
// page's history); an investigation of an earlier close is still handed over, named as that session's and as absent from
// the screen, so it is never told as today's.
import { serverInvestigation } from '../../data/server-investigation.js';
import { closeBasis } from '../../domain/market/session/close-series.js';

const KIND = Object.freeze({ price: '가격 자료로 확인', official: '공식 발표', news: '보도', inference: '추론' });
const md = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };

/** '' when there is no admitted investigation. */
export function investigationContext(root) {
  let block = null;
  try { block = serverInvestigation(root); } catch (_) { block = null; }
  if (!block) return '';
  const when = `${md(block.session.us)} 미국 종가`;
  const basis = closeBasis(Array.isArray(root?._aioHistory) ? root._aioHistory : []);
  const earlier = !!basis && block.session.us !== basis;
  if (block.status === 'quiet') return earlier ? '' : `오늘의 시장 조사 (${when}): 평소 변동 범위를 벗어난 움직임이나 바뀐 판정이 없어 조사하지 않음.`;
  const causes = block.causes.map((cause) => `- ${KIND[cause.kind]}${cause.outlet ? ` · ${cause.outlet}` : ''}${cause.date ? ` ${md(cause.date)}` : ''}: ${cause.claim}`);
  const head = earlier
    ? `이전 세션의 시장 조사 (${when} — 화면의 기준 종가는 ${md(basis)}이라 오늘 화면에는 없는 글. 그날의 원인으로만 쓰고 ${md(basis)} 움직임의 원인으로 말하지 말 것):`
    : `오늘의 시장 조사 (${when}, 오늘 화면과 같은 글 — 원인을 말할 때 이 조사와 근거 종류를 따르고, 다르면 무엇이 다른지 밝힐 것):`;
  return [head,
    `판정: ${block.verdict}`, ...block.paragraphs, ...(causes.length ? ['원인과 근거 종류:', ...causes] : []),
    ...(block.unknowns.length ? [`확인하지 못한 것: ${block.unknowns.join(' / ')}`] : [])].join('\n');
}
