// Audit 2026-10-14: the AI panel was disabled on 투자 대가(masters) and 사용 안내(guide) although the panel's evidence
// builder already reads 13F holdings for the masters focus. The classic panel's map lives in js/aio-chat.js, which may
// not grow (decomposition ratchet), so the two screens are registered here through the same globals it reads.
const EXTRA = Object.freeze([
  { page: 'masters', ctx: 'masters', title: 'AI 운용사 보유 분석가', focus: 'masters', chips: ['이 운용사의 보유 구조', '분기 사이 바뀐 것', '13F로 알 수 없는 것', '내 관심 종목과 겹치는 곳'] },
  { page: 'guide', ctx: 'guide', title: 'AI 화면 안내', focus: 'principles', chips: ['어느 화면부터 볼까', '갈림길은 어떻게 읽나', '테마 단계 읽는 법', '내 종목 확인 순서'] }
]);

export function installPanelContexts(root = globalThis) {
  const map = root._aiCtxMap;
  const contexts = root.CHAT_CONTEXTS;
  const create = root._aioCreateEvidenceContext;
  if (!map || !contexts || typeof create !== 'function') return 0;
  let added = 0;
  for (const row of EXTRA) {
    if (!map[row.page]) map[row.page] = row.ctx;
    if (!contexts[row.ctx]) { contexts[row.ctx] = create(row.title, row.focus); added += 1; }
    if (root._aiDefaultChips && !root._aiDefaultChips[row.ctx]) root._aiDefaultChips[row.ctx] = row.chips;
  }
  return added;
}
