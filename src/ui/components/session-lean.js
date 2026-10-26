// v58.81 (owner 2026-10-26): two 오늘 blocks beside the six-axis verdict — the market clock with the Korea↔US link check
// (domain/market/session-bridge.js) and the probabilistic lean (domain/market/market-lean.js). Neither changes the
// verdict; both say what they are built from.
import { el } from './dom.js';
import { buildSessionBridge, renderSessionBridgeContext } from '../../domain/market/session-bridge.js';
import { buildMarketLean, renderMarketLeanContext } from '../../domain/market/market-lean.js';
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { MARKET_TEMPERATURE, STRESS_OUTCOMES, refreshSharedArtifact, sharedArtifactIsStale } from '../../data/shared-artifacts.js';

const VERDICT_WORDS = Object.freeze({ supports: '근거 맞음', partial: '일부 맞음', against: '근거 약함', unknown: '판단 보류' });

function snapshotOf(root, store) {
  return store?.getState?.()?.marketSnapshot || root?.AIO_ARCH?.getMarketSnapshot?.() || null;
}

// The AI context (src/ai/context/market-content.js) reads these two hooks so its boot module imports neither model.
const SESSION_QUESTION = /지금|오늘|현재|장전|프리마켓|선물|개장|마감|한국|코스피|코스닥|원화|환율|시장\s*(?:상황|흐름|어때)|왜\s*(?:빠|올|내|떨)/;
const LEAN_QUESTION = /우위|매수|매도|확률|가능성|유리|불리|앞으로|향후|전망|시장\s*(?:상황|흐름|어때)/;
// Both readers rebuild from the current regime and shared artifacts at question time, so a refresh made after the reader
// left 오늘 (a new temperature or stress artifact, a later close) reaches the answer.
// currentRegime comes from the caller (market-regime.js) so this lazy chunk does not re-split the boot selectors.
function exposeContextReaders(root, store, currentRegime) {
  if (!root || root.__aioMarketNowContext || typeof currentRegime !== 'function') return;
  root.__aioMarketNowContext = (text = '') => {
    const lean = () => { const regime = currentRegime(); return leanModel(root, regime?.available ? regime : null); };
    return [
      SESSION_QUESTION.test(text) ? renderSessionBridgeContext(buildSessionBridge({ nowMs: Date.now(), snapshot: snapshotOf(root, store) })) : '',
      LEAN_QUESTION.test(text) ? renderMarketLeanContext(lean()) : ''
    ].filter(Boolean).join('\n');
  };
}

function leanModel(root, regime) {
  // R670: the VIX band is read on the same completed US close as the verdict, not the after-hours print.
  const history = root?._aioHistory || [];
  const vix = buildCloseSeries(history, 'vix', { through: regime?.asOf || closeBasis(history) }).at(-1)?.value ?? null;
  return buildMarketLean({ regime, stress: root?.[STRESS_OUTCOMES.key] || null, temperature: root?.[MARKET_TEMPERATURE.key] || null, vix });
}

export function paintSessionBridge(doc, root, store, anchor) {
  if (!doc || !anchor) return null;
  const model = buildSessionBridge({ nowMs: Date.now(), snapshot: snapshotOf(root, store) });
  let box = doc.getElementById('home-session-bridge');
  if (!model.available) { if (box) box.hidden = true; return model; }
  if (!box) { box = el(doc, 'div', null, 'session-bridge'); box.id = 'home-session-bridge'; anchor.insertAdjacentElement('afterend', box); }
  const nodes = [el(doc, 'p', model.clockLine, 'session-bridge__clock')];
  // The line above (home-kr-line) is the last completed Korean close; during the session these checks read today's
  // intraday move, so the head names the session it explains (date, 진행 중 with the observation time, or 마감).
  if (model.koreaRead) {
    const head = el(doc, 'p', null, 'session-bridge__head');
    head.append(el(doc, 'strong', model.koreaHead ? `${model.koreaHead}, 왜 움직였나` : '한국장이 왜 움직였나'), doc.createTextNode(` ${model.koreaRead}`));
    nodes.push(head);
  }
  if (model.links.length) {
    const list = el(doc, 'ul', null, 'session-bridge__links');
    for (const link of model.links) {
      const item = el(doc, 'li', null, 'session-bridge__link');
      item.dataset.verdict = link.verdict;
      item.append(el(doc, 'span', link.label, 'session-bridge__label'), doc.createTextNode(' '), el(doc, 'span', VERDICT_WORDS[link.verdict], 'session-bridge__verdict'), el(doc, 'span', ` ${link.evidence}. ${link.text}`, 'session-bridge__text'));
      list.append(item);
    }
    // Live layout (owner reading standard, 3-5 lines a block): the four checks fold under one summary on the face.
    const more = el(doc, 'details', null, 'session-bridge__more');
    more.append(el(doc, 'summary', `원인 후보 ${model.links.length}가지 점검`), list);
    nodes.push(more);
  }
  for (const [text, className] of [[model.futuresLine ? `미국 선물: ${model.futuresLine}` : null, model.futuresStale ? 'session-bridge__line is-stale' : 'session-bridge__line'], [model.next, 'session-bridge__line'], [model.oil, 'session-bridge__line']]) {
    if (text) nodes.push(el(doc, 'p', text, className));
  }
  box.replaceChildren(...nodes);
  box.title = '판정(6개 지표)은 직전 미국 종가 기준입니다. 이 칸은 그 뒤 공개 시세(한국 종가, 미국 선물, 아시아 지수, 환율)를 이어 읽은 점검이며 판정 합계에 넣지 않습니다.';
  box.hidden = false;
  return model;
}

export function paintMarketLean(doc, root, regime, anchor, rerender = null) {
  if (!doc || !anchor) return null;
  for (const spec of [STRESS_OUTCOMES, MARKET_TEMPERATURE]) {
    if (sharedArtifactIsStale(root, spec.key, spec)) refreshSharedArtifact(root, spec).then(({ changed }) => { if (changed && typeof rerender === 'function') rerender(); }).catch(() => {});
  }
  const model = leanModel(root, regime);
  let box = doc.getElementById('home-lean');
  if (!model.us.available) { if (box) box.hidden = true; return model; }
  if (!box) { box = el(doc, 'div', null, 'market-lean'); box.id = 'home-lean'; anchor.insertAdjacentElement('afterend', box); }
  const head = el(doc, 'div', null, 'market-lean__head');
  const chip = el(doc, 'span', model.us.label, 'market-lean__state');
  chip.dataset.score = model.us.key;
  head.append(el(doc, 'span', '매수·매도 우위 (미국 시장 전체, 약 1개월)', 'market-lean__title'), chip);
  const items = el(doc, 'ul', null, 'market-lean__items');
  for (const item of model.us.items) {
    const li = el(doc, 'li', item.text, 'market-lean__item');
    li.dataset.vote = String(item.vote);
    items.append(li);
  }
  const more = el(doc, 'details', null, 'market-lean__more');
  more.append(el(doc, 'summary', '근거와 바뀌는 조건'), items);
  if (model.us.flip) more.append(el(doc, 'p', `바뀌는 조건: ${model.us.flip}`, 'market-lean__note'));
  more.append(el(doc, 'p', `이 기울기에서 일반적으로 덜 불리한 선택: ${model.us.choices.join(', ')}.`, 'market-lean__note'));
  // The disclaimer sits in the fold and on the chip's hover, not as an open line (v58.79 secondary text budget).
  const disclaimer = '시장 전체의 조건부 설명이며 개별 종목의 매수·매도 지시나 가격 예측이 아닙니다.';
  chip.title = disclaimer;
  more.append(el(doc, 'p', disclaimer, 'market-lean__note'));
  const nodes = [head, el(doc, 'p', model.us.read, 'market-lean__read'), more];
  if (model.kr.available) {
    const kr = el(doc, 'details', null, 'market-lean__kr');
    const list = el(doc, 'ul', null, 'market-lean__items');
    for (const item of model.kr.items) list.append(el(doc, 'li', item.text, 'market-lean__item'));
    kr.append(el(doc, 'summary', `한국 참고: ${model.kr.label}`), el(doc, 'p', model.kr.read, 'market-lean__read'), list);
    nodes.push(kr);
  }
  box.replaceChildren(...nodes);
  box.hidden = false;
  return model;
}

// The 오늘 hero call (src/ui/components/market-regime.js renderHomeRegime): clock and links under the Korea line, lean under the leaders.
export function paintHome(doc, root, store, regime, rerender, currentRegime) {
  exposeContextReaders(root, store, currentRegime);
  paintSessionBridge(doc, root, store, doc.getElementById('home-kr-line') || doc.getElementById('home-hero-headline'));
  paintMarketLean(doc, root, regime?.available ? regime : null, doc.getElementById('home-hero-leaders'), rerender);
}
