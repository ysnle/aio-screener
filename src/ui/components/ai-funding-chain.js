// The AI funding chain (domain/themes/ai-funding-chain.js) on 테마와 섹터, under the AI supply chain's capex read: seven
// numbered links down one thin connector, each a title, its rule-decided state as a small tag and at most three dated
// figure rows (researched rows carry the quiet 조사 mark). Every row sits in the raw-table fold, the rules in the method
// fold, the sources in theirs. Other screens print one line of it with a link here (fundingChainPointer).
import { el } from './dom.js';
import { kindFold, rawTable } from './indicator-face.js';
import { aiFundingChain } from '../../domain/themes/ai-funding-chain.js';
import { FUNDING_CHAIN_WORDS as W } from '../../domain/content/funding-chain-words.js';
import { RESEARCH_WORDS } from '../../domain/research/words.js';
import { fundingChainInputs, requestFundingChainInputs } from '../../data/funding-chain.js';

const AUTO_SOURCES = Object.freeze([
  'SEC EDGAR 현금흐름표(10-Q·10-K): 설비투자, 영업현금흐름, 잉여현금흐름',
  'FRED: ICE BofA 채권 금리·스프레드, 미국 10년 국채, 연준 목표 금리, 연준 자산·재무부 계좌(TGA)·역레포'
]);

/** Asks for the chain's three artifacts (joined with any request in flight); onChange runs when a new copy lands. */
export const requestFundingChain = requestFundingChainInputs;

/** The chain from the copies in hand; `request` also asks for the artifacts and repaints on arrival. */
export function fundingChainFor(root, { request = null, nowMs = Date.now() } = {}) {
  if (request) requestFundingChain(root, request);
  return aiFundingChain(fundingChainInputs(root, { nowMs }));
}

function rowNode(doc, row) {
  const li = el(doc, 'li', null, 'funding-chain__row');
  li.dataset.kind = row.kind;
  li.dataset.row = row.id;
  const head = [row.label, row.period, row.forecast ? RESEARCH_WORDS.forecast : null].filter(Boolean).join(' ');
  li.append(el(doc, 'span', head, 'funding-chain__label'), doc.createTextNode(' '), el(doc, 'strong', row.value.text, 'funding-chain__value'));
  if (row.change?.text) li.append(doc.createTextNode(' · '), el(doc, 'span', row.change.text, 'funding-chain__change'));
  if (row.record) li.append(doc.createTextNode(' · '), el(doc, 'span', row.record, 'funding-chain__record'));
  li.append(doc.createTextNode(' · '), el(doc, 'span', row.date.text, 'funding-chain__date'));
  if (row.kind === 'researched') li.append(doc.createTextNode(' '), el(doc, 'span', RESEARCH_WORDS.mark, 'funding-chain__mark'));
  if (row.stale) li.append(doc.createTextNode(' '), el(doc, 'span', RESEARCH_WORDS.stale, 'funding-chain__mark is-stale'));
  if (row.note) li.append(doc.createTextNode(' — '), el(doc, 'span', row.note, 'funding-chain__note'));
  return li;
}

function linkNode(doc, link) {
  const li = el(doc, 'li', null, 'funding-chain__link');
  li.dataset.link = link.id;
  if (link.state) li.dataset.state = link.state;
  const head = el(doc, 'p', null, 'funding-chain__head');
  head.append(el(doc, 'span', String(link.n), 'funding-chain__n'), el(doc, 'span', link.title, 'funding-chain__name'));
  if (link.stateWord) head.append(el(doc, 'span', link.stateWord, 'funding-chain__state'));
  li.append(head);
  if (link.empty) { li.append(el(doc, 'p', W.none, 'funding-chain__none')); return li; }
  const rows = el(doc, 'ul', null, 'funding-chain__rows');
  rows.append(...link.face.map((row) => rowNode(doc, row)));
  li.append(rows);
  return li;
}

/** The block, or null when no link has a row yet (nothing loaded). */
export function fundingChainBlock(doc, chain, { id = null } = {}) {
  if (!doc || !chain?.links?.some((link) => !link.empty)) return null;
  const box = el(doc, 'div', null, 'funding-chain');
  if (id) box.id = id;
  const titleId = id ? `${id}-title` : null;
  const title = el(doc, 'h3', W.title, 'funding-chain__title');
  if (titleId) { title.id = titleId; box.setAttribute('role', 'group'); box.setAttribute('aria-labelledby', titleId); }
  box.append(title);
  if (chain.said.text) box.append(el(doc, 'p', chain.said.text, 'ai-chain__reading funding-chain__said'));
  const list = el(doc, 'ol', null, 'funding-chain__links');
  list.append(...chain.links.map((link) => linkNode(doc, link)));
  box.append(list);
  const raw = chain.links.flatMap((link) => link.rows.map((row) => [`${link.n}. ${link.title} · ${row.label}${row.period ? ` ${row.period}` : ''}`,
    `${[row.value.text, row.change?.text, row.record].filter(Boolean).join(', ')} (${row.asOf}${row.kind === 'researched' ? `, ${RESEARCH_WORDS.mark}` : ''})`]));
  const folds = [
    kindFold(doc, 'raw-table', '고리별 전체 행', [rawTable(doc, raw, W.title)]),
    kindFold(doc, 'method', '상태 판정 규칙', [
      ...chain.ruleLines.map((line) => el(doc, 'p', line, 'ai-chain__member-list')),
      el(doc, 'p', `상태는 ${W.auto} 행으로만 정합니다. ${RESEARCH_WORDS.mark} 행은 사람이 공개 자료에서 확인한 값으로, 행마다 기준일이 있고 판정에 넣지 않습니다.`, 'ai-chain__member-list')
    ]),
    kindFold(doc, 'sources', null, [
      ...AUTO_SOURCES.map((text) => el(doc, 'p', text, 'ai-chain__member-list')),
      chain.sources.length ? (() => {
        const ul = el(doc, 'ul', null, 'research-ref__source-list');
        for (const source of chain.sources) {
          const a = el(doc, 'a', source.name);
          a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
          const li = el(doc, 'li'); li.append(a); ul.append(li);
        }
        return ul;
      })() : null
    ])
  ];
  box.append(...folds);
  return box;
}

/**
 * One line of the chain for another screen (매크로's credit chapter, the AI-capex scenario): the rule-decided count and a
 * button to 테마와 섹터 where the chain lives. Null while no automated link has a state.
 */
export function fundingChainPointer(doc, chain, { className = 'research-ref__line funding-chain__pointer' } = {}) {
  if (!doc || !chain?.said?.text) return null;
  const line = el(doc, 'p', null, className);
  const go = el(doc, 'button', W.pointer, 'flow-next-link funding-chain__go');
  go.type = 'button';
  go.dataset.action = 'showPage';
  go.dataset.arg = 'themes';
  line.append(doc.createTextNode(`${W.title}: ${chain.said.text}. `), go);
  return line;
}
