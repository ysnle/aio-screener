// v59.44 (owner 2026-10-30): the AI supply chain on 오늘, before the release summaries — one bar per group for the
// one-month median move with the last session beside it, a sentence of counts, and each group's members in a fold.
// A lazy chunk like the release summaries; the rows and themes are the screener's and the 테마 screen's, already loaded.
import { el } from './dom.js';
import { frameHead, markFrame } from './section-frame.js';
import { aiChainFlow } from '../../domain/briefing/ai-chain-flow.js';

// Rounded first, so a move under 0.05% reads 0.0% and is flat, never "+0.0%" or "-0.0%".
const tenth = (value) => (value == null ? null : Math.round(value * 10) / 10 || 0);
const signed = (value) => { const v = tenth(value); return v == null ? '-' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`; };
const direction = (value) => { const v = tenth(value); return v == null || v === 0 ? 'flat' : v < 0 ? 'down' : 'up'; };

function sessionLabel(root) {
  const day = root?.AIO_ARCH?.getScreenerState?.('metadata.factorSessionDateByMarket')?.US || '';
  const [, m, d] = String(day).split('-').map(Number);
  return m && d ? `${m}/${d} 종가 기준` : '종가 기준';
}

export function paintHomeAiChain(doc, root, loop) {
  if (!doc || !loop) return null;
  const rows = root?.AIO_ARCH?.getScreenerState?.('rows') || [];
  const flow = aiChainFlow({ themes: root?.THEME_MAP || [], rows });
  let host = doc.getElementById('home-ai-chain');
  if (!flow.groups.length) { if (host) host.hidden = true; return flow; }
  if (!host) {
    host = el(doc, 'section', null, 'daily-block ai-chain');
    host.id = 'home-ai-chain';
    host.setAttribute('aria-labelledby', 'home-ai-chain-title');
    const anchor = doc.getElementById('home-event-briefs') || doc.getElementById('home-overnight');
    if (anchor?.parentElement === loop) anchor.insertAdjacentElement(anchor.id === 'home-event-briefs' ? 'beforebegin' : 'afterend', host); else loop.prepend(host);
  }
  const head = frameHead(doc, { title: 'AI 공급망 흐름', titleId: 'home-ai-chain-title', titleClass: 'briefing-h2' });
  head.classList.add('daily-card-head');
  head.title = '테마 화면의 반도체·AI 인프라·광통신 묶음별 미국 종목 중앙값입니다. 막대는 한 달, 숫자는 지난 거래일';
  markFrame(host, 'home.ai-chain');
  const scale = Math.max(...flow.groups.map((group) => Math.abs(group.ret1m || 0)), 1);
  const chart = el(doc, 'ul', null, 'ai-chain__bars');
  chart.setAttribute('aria-label', `묶음별 한 달 중앙값, ${sessionLabel(root)}`);
  for (const group of flow.groups) {
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
  const legend = el(doc, 'p', `한 달 · 지난 거래일, ${sessionLabel(root)}`, 'ai-chain__scale');
  const fold = el(doc, 'details', null, 'ai-chain__members');
  fold.append(el(doc, 'summary', '묶음별 종목 보기'));
  for (const group of flow.groups) {
    fold.append(el(doc, 'p', group.name, 'event-brief__sub'),
      el(doc, 'p', group.members.map((member) => `${member.sym} ${signed(member.ret1m)}(지난 거래일 ${signed(member.ret1d)})`).join(', '), 'ai-chain__member-list'));
  }
  const more = el(doc, 'button', '테마별 흐름 → 테마와 섹터', 'flow-next-link daily-card-more');
  more.type = 'button';
  more.dataset.action = 'showPage';
  more.dataset.arg = 'themes';
  host.replaceChildren(head, el(doc, 'p', flow.reading, 'ai-chain__reading'), legend, chart, fold, more);
  host.hidden = false;
  return flow;
}
