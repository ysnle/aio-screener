// v59.44 (owner 2026-10-30): the AI supply chain on 오늘, before the release summaries — one bar per group for the
// one-month median move with the last session beside it, a sentence of counts, and each group's members in a fold.
// A lazy chunk like the release summaries; the rows and themes are the screener's and the 테마 screen's, already loaded.
import { el } from './dom.js';
import { frameHead, markFrame } from './section-frame.js';
import { aiChainFlow, defensiveContrast } from '../../domain/briefing/ai-chain-flow.js';
import { buildTwRevenueView, signedPct, TW_MONTHLY_REVENUE } from '../../domain/briefing/tw-monthly-revenue.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';

// Rounded first, so a move under 0.05% reads 0.0% and is flat, never "+0.0%" or "-0.0%".
const tenth = (value) => (value == null ? null : Math.round(value * 10) / 10 || 0);
const signed = (value) => { const v = tenth(value); return v == null ? '-' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`; };
const direction = (value) => { const v = tenth(value); return v == null || v === 0 ? 'flat' : v < 0 ? 'down' : 'up'; };

function sessionLabel(root) {
  const day = root?.AIO_ARCH?.getScreenerState?.('metadata.factorSessionDateByMarket')?.US || '';
  const [, m, d] = String(day).split('-').map(Number);
  return m && d ? `${m}/${d} 종가 기준` : '종가 기준';
}

/**
 * 오늘 (v59.51, content audit): the leaders' visual under the verdict — the five largest one-month moves as bars and one
 * plain sentence on the face; the full reading, the defensive contrast, every other group and each group's members open
 * under it (two layers, owner 2026-10-31). The host is static markup (#home-ai-chain).
 */
export function paintHomeAiChain(doc, root) {
  if (!doc?.getElementById('home-ai-chain')) return null;
  return paintAiChain(doc, root, { id: 'home-ai-chain', frame: 'home.ai-chain', more: true, limit: 5 });
}

/** 테마: the same block opens the page, above 섹터 회전 (owner 2026-10-30, each screen carries the AI-chain read). */
export function paintThemesAiChain(doc, root) {
  const page = doc?.getElementById('page-themes');
  if (!page) return null;
  return paintAiChain(doc, root, { id: 'themes-ai-chain', frame: 'themes.ai-chain', className: 'aio-section ai-chain', more: false, place: (host) => {
    host.id = 'themes-ai-chain';
    const head = page.querySelector(':scope > .page-head');
    if (head) head.insertAdjacentElement('afterend', host); else page.prepend(host);
  } });
}

// v59.56 (X-bookmark gap 2): Taiwan's monthly revenue under the US price medians — one sentence on the face, each
// group's year-on-year change and its companies in the fold. Requested once per load; a new copy repaints the block.
function twRevenue(doc, root, id, repaint) {
  (root.__aioTwRevenueRepaint ||= {})[id] = repaint; // home and 테마 each repaint their own block when a new copy lands
  if (!root.__aioTwRevenueRequested) {
    root.__aioTwRevenueRequested = true;
    const done = (payload, changed) => {
      root.__aioTwRevenueRequested = false;
      root.__aioTwRevenueLoad = payload ? 'loaded' : 'failed';
      if (changed) Object.values(root.__aioTwRevenueRepaint).forEach((fn) => fn());
    };
    refreshSharedArtifact(root, TW_MONTHLY_REVENUE).then(({ payload, changed }) => done(payload, changed)).catch(() => done(root[TW_MONTHLY_REVENUE.key] || null, false));
  }
  const view = buildTwRevenueView(root[TW_MONTHLY_REVENUE.key] || null, { loadState: root.__aioTwRevenueLoad || 'loading' });
  if (view.state !== 'ok') return null;
  const face = el(doc, 'p', view.reading, 'ai-chain__reading ai-chain__tw');
  face.title = `${view.source || '대만증권거래소 월매출'} · 회사가 신고한 월 매출 합계의 1년 전 같은 달 대비 변화`;
  const fold = [el(doc, 'p', `대만 월매출 (${Number(view.month.slice(5, 7))}월, 1년 전 같은 달 대비 · 지난달 대비)`, 'event-brief__sub')];
  for (const group of view.groups) {
    fold.push(el(doc, 'p', `${group.name} ${signedPct(group.yoyPct)} — ${group.members.map((m) => `${m.name} ${signedPct(m.yoyPct)}(지난달 대비 ${signedPct(m.momPct)})`).join(', ')}`, 'ai-chain__member-list'));
  }
  fold.push(el(doc, 'p', '대만 상장사는 매달 10일까지 전월 매출을 공시합니다. 미국 분기 실적보다 먼저 나오는 수요 신호이고, 묶음 값은 회사별 금액을 더해 계산합니다. 출처: 대만증권거래소 OpenAPI.', 'ai-chain__member-list'));
  return { face, fold };
}

function paintAiChain(doc, root, { id, frame, className, more: withLink, place, limit = Infinity }) {
  const rows = root?.AIO_ARCH?.getScreenerState?.('rows') || [];
  // v59.45 (P21-CHAIN-01): the medians use the same session the label prints.
  const session = root?.AIO_ARCH?.getScreenerState?.('metadata.factorSessionDateByMarket')?.US || null;
  const flow = aiChainFlow({ themes: root?.THEME_MAP || [], rows, session });
  let host = doc.getElementById(id);
  if (!flow.groups.length) { if (host) host.hidden = true; return flow; }
  if (!host) {
    host = el(doc, 'section', null, className);
    host.setAttribute('aria-labelledby', `${id}-title`);
    place(host);
  }
  const head = frameHead(doc, { title: 'AI 공급망 흐름', titleId: `${id}-title`, titleClass: 'briefing-h2' });
  head.classList.add('daily-card-head');
  head.title = '테마 화면의 반도체·AI 인프라·광통신 묶음별 미국 종목 중앙값입니다. 막대는 한 달, 숫자는 지난 거래일';
  markFrame(host, frame);
  const scale = Math.max(...flow.groups.map((group) => Math.abs(group.ret1m || 0)), 1);
  const barList = (groups) => {
    const chart = el(doc, 'ul', null, 'ai-chain__bars');
    chart.setAttribute('aria-label', `묶음별 한 달 중앙값, ${sessionLabel(root)}`);
    for (const group of groups) {
      const li = el(doc, 'li', null, 'ai-chain__row');
      const bar = el(doc, 'span', null, 'ai-chain__bar');
      bar.dataset.direction = direction(group.ret1m);
      bar.style.setProperty('--w', `${Math.round((Math.abs(group.ret1m || 0) / scale) * 100)}%`);
      const day = el(doc, 'span', signed(group.ret1d), 'ai-chain__day');
      day.dataset.direction = direction(group.ret1d);
      const name = el(doc, 'span', group.name, 'ai-chain__name');
      name.title = group.name;
      li.append(name, el(doc, 'span', null, 'ai-chain__track'), el(doc, 'span', signed(group.ret1m), 'ai-chain__month'), day);
      li.children[1].append(bar);
      li.children[2].dataset.direction = direction(group.ret1m);
      chart.append(li);
    }
    return chart;
  };
  // The face shows the `limit` largest one-month moves (by size, either direction); the rest open in the fold.
  const ranked = Number.isFinite(limit) ? [...flow.groups].sort((a, b) => Math.abs(b.ret1m || 0) - Math.abs(a.ret1m || 0)) : flow.groups;
  const shown = new Set(ranked.slice(0, limit));
  const chart = barList(flow.groups.filter((group) => shown.has(group)));
  const others = flow.groups.filter((group) => !shown.has(group));
  const legend = el(doc, 'p', `막대 한 달, 숫자 지난 거래일 · ${sessionLabel(root)}`, 'ai-chain__scale');
  const contrast = defensiveContrast(root?._serverDataMeta?.rotationHistory || null);
  const fullReading = contrast ? `${flow.reading} ${contrast}` : flow.reading;
  // Face: the reading's first sentence (the count of groups that fell); the full reading leads the fold.
  const faceReading = Number.isFinite(limit) ? (String(flow.reading).match(/^.*?다\.(?=\s|$)/)?.[0] || flow.reading) : fullReading;
  const wasOpen = !!host.querySelector(':scope > details')?.open;
  const fold = el(doc, 'details', null, 'ai-chain__members');
  fold.open = wasOpen;
  fold.append(el(doc, 'summary', Number.isFinite(limit) ? `전체 ${flow.groups.length}개 묶음과 종목` : '묶음별 종목 보기'));
  if (Number.isFinite(limit)) {
    fold.append(el(doc, 'p', fullReading, 'ai-chain__reading'));
    if (others.length) fold.append(barList(others));
    fold.append(el(doc, 'p', '막대는 묶음별 미국 종목의 한 달 수익률 중앙값, 오른쪽 숫자는 지난 거래일 중앙값입니다. 아래 종목은 한 달 수익률, 괄호 안은 지난 거래일입니다. 묶음은 테마 화면의 반도체·AI 인프라·광통신 분류를 따릅니다.', 'ai-chain__member-list'));
  }
  else fold.append(el(doc, 'p', '종목 옆 숫자는 한 달 수익률, 괄호 안은 지난 거래일입니다.', 'ai-chain__member-list'));
  // Taiwan's monthly revenue opens the member lists: a short block, read before the long US lists.
  const tw = twRevenue(doc, root, id, () => paintAiChain(doc, root, { id, frame, className, more: withLink, place, limit }));
  if (tw) fold.append(...tw.fold);
  for (const group of flow.groups) {
    fold.append(el(doc, 'p', group.name, 'event-brief__sub'),
      el(doc, 'p', group.members.map((member) => `${member.sym} ${signed(member.ret1m)}(${signed(member.ret1d)})`).join(', '), 'ai-chain__member-list'));
  }
  const more = el(doc, 'button', '테마별 흐름 → 테마와 섹터', 'flow-next-link daily-card-more');
  more.type = 'button';
  more.dataset.action = 'showPage';
  more.dataset.arg = 'themes';
  host.replaceChildren(head, el(doc, 'p', faceReading, 'ai-chain__reading'), legend, chart, ...(tw ? [tw.face] : []), fold, ...(withLink ? [more] : []));
  host.hidden = false;
  return flow;
}
