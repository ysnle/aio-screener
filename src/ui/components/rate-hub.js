import { crossroadsForRoot } from './macro-crossroads.js';
import { foldSummary, kindFold, markFold } from './indicator-face.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { auctionLine, latestByTenor, AUCTION_METHOD } from '../../domain/macro/treasury-auctions.js';
import { TREASURY_AUCTIONS } from '../../data/artifact-registry.js';
import { el } from './dom.js';

// Who is buying the new supply. The latest note and bond auction of each tenor
// against its own previous six, one line on the face and the per-tenor rows one fold down; a reference, never a condition.
const AUCTIONS_MAX_AGE_MS = 21 * 86400000;
function auctionBlock(doc, root, open) {
  const payload = root?.[TREASURY_AUCTIONS.key];
  const age = Date.now() - Date.parse(payload?.latestAuction || '');
  if (!payload?.summary || !(age >= 0 && age <= AUCTIONS_MAX_AGE_MS)) return null;
  const box = el(doc, 'div', null, 'xr-auctions');
  box.append(el(doc, 'p', `국채 입찰: ${payload.summary}`, 'xr-hub-now'));
  const fold = markFold(el(doc, 'details', null, 'xr-auctions-fold'), 'raw-table');
  fold.open = open;
  fold.append(foldSummary(doc, 'raw-table', '만기별 최근 입찰 결과'));
  const list = el(doc, 'ul', null, 'xr-evidence');
  for (const row of latestByTenor(payload.rows || [])) list.append(el(doc, 'li', auctionLine(row)));
  fold.append(list, el(doc, 'p', AUCTION_METHOD, 'xr-path-evidence'));
  box.append(fold);
  return box;
}

/** Renders (or hides) #rates-hub after the curve card of 금리와 환율. */
export function renderRateHub({ documentRef: doc, root }) {
  const curve = doc?.querySelector?.('#page-fxbond .mk-curve-card');
  if (!curve) return null;
  let hub = doc.getElementById('rates-hub');
  if (!hub) {
    hub = el(doc, 'section', null, 'briefing-block rates-block rates-hub');
    hub.id = 'rates-hub';
    hub.setAttribute('aria-labelledby', 'rates-hub-title');
    curve.insertAdjacentElement('afterend', hub);
    refreshSharedArtifact(root, TREASURY_AUCTIONS).then(({ changed }) => { if (changed) renderRateHub({ documentRef: doc, root }); }).catch(() => {});
  }
  const model = crossroadsForRoot(root);
  const rate = model?.rateHub;
  hub.hidden = !model?.available || !rate;
  if (hub.hidden) { hub.replaceChildren(); return null; }
  // A repaint (an artifact arriving) keeps a reader's open folds.
  const auctionsOpen = !!hub.querySelector('.xr-auctions-fold')?.open;
  const methodOpen = !!hub.querySelector(':scope > .ind-fold--method')?.open;
  const title = el(doc, 'h2', '시나리오의 중심, 금리', 'briefing-h2');
  title.id = 'rates-hub-title';
  const parts = [title];
  if (rate.policy) parts.push(el(doc, 'p', rate.policy, 'xr-hub-now')); // the policy path first
  if (rate.now) parts.push(el(doc, 'p', rate.now, 'xr-hub-now'));
  if (rate.tension) parts.push(el(doc, 'p', rate.tension, 'xr-tension'));
  const moving = rate.pathsDown.filter((path) => path.ok === true).length;
  parts.push(el(doc, 'h3', `금리가 내려가려면 — ${moving ? `조건 ${rate.pathsDown.length}가지 중 ${moving}가지 진행 중` : `조건 ${rate.pathsDown.length}가지, 아직 진행 중인 것 없음`}`, 'xr-h4'));
  const paths = el(doc, 'ul', null, 'xr-paths');
  for (const path of rate.pathsDown) {
    const row = el(doc, 'li', null, `xr-path is-${path.stateText ? 'mixed' : path.ok == null ? 'unknown' : path.ok ? 'met' : 'unmet'}`);
    row.append(el(doc, 'b', path.label, 'xr-path-label'), el(doc, 'span', ` ${path.stateText || (path.ok == null ? '확인 불가' : path.ok ? '진행 중' : '아직 아님')}`, 'xr-path-state'),
      el(doc, 'p', `${path.evidence}${path.next ? ` 확인: ${path.next}` : ''}`, 'xr-path-evidence'));
    paths.append(row);
  }
  parts.push(paths);
  const auctions = auctionBlock(doc, root, auctionsOpen);
  if (auctions) parts.push(auctions);
  const method = [rate.whyHigherHurts, rate.pricingNote, rate.caveat].filter(Boolean);
  if (method.length) {
    const fold = kindFold(doc, 'method', '금리가 주가에 닿는 경로와 이 수치의 한계', method.map((text) => el(doc, 'p', text, 'xr-path-evidence')));
    fold.open = methodOpen;
    parts.push(fold);
  }
  hub.replaceChildren(...parts);
  hub.dataset.aioRateHub = 'native';
  return rate;
}
