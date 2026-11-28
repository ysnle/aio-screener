// 금리와 환율 › 금리: the one driver the macro scenarios share (rateHub of the shared crossroads model), after the curve
// card. (owner 2026-11-20, face never folded) the conditions for lower rates are the reading — one compact list on the face
// (label, state, next release); how rates reach stocks, the proxy caveat and whether lower rates are always good are the
// method fold; the auction rows are the raw-table fold. The scenarios themselves are 시장 상태 › 시나리오와 전망's.
import { foldSummary, kindFold, markFold } from './indicator-face.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { auctionLine, latestByTenor, AUCTION_METHOD } from '../../domain/macro/treasury-auctions.js';
import { crossAssetVerdicts } from '../../domain/macro/cross-asset-relations.js';
import { signedText } from '../../domain/shared/number.js';
import { TREASURY_AUCTIONS } from '../../data/artifact-registry.js';
import { el } from './dom.js';

// Rates against the other assets on the same 20 sessions: one row per cross-asset verdict, its fixed state word and the
// legs it read with their dates. The verdicts are cross-asset-relations'; this only draws them.
const LEG_NAMES = { spx: 'S&P 500', gold: '금', tlt: '장기채(TLT)', dxy: '달러 지수', realYield10: '10년 실질금리', tnx: '10년물', rut: '러셀 2000', rsp: '동일가중 S&P 500', vix: 'VIX', hyOas: '하이일드 스프레드', usdjpy: '엔/달러', eurusd: '유로/달러', eurjpy: '유로/엔', audjpy: '호주달러/엔', audusd: '호주달러/달러' };
const BP_LEGS = new Set(['realYield10', 'hyOas']);
const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
function legsText(legs) {
  const groups = new Map();
  for (const [key, leg] of Object.entries(legs)) {
    if (!leg) continue;
    const span = `${md(leg.from)}→${md(leg.to)}`;
    const figure = key === 'tnx' ? signedText(Math.round(leg.value * 100), 0, 'bp') : BP_LEGS.has(key) ? signedText(leg.value, 0, 'bp') : signedText(leg.value, 1, '%');
    groups.set(span, [...(groups.get(span) || []), `${LEG_NAMES[key]} ${figure}`]);
  }
  return [...groups].map(([span, figures]) => `${figures.join(', ')} (${span})`).join('; ');
}
/** The four rows as data: { id, label, state, named, evidence }. */
export function crossAssetRows(v) {
  if (!v?.asOf) return [];
  const c = v.cashOrRealRate, y = v.yen;
  return [
    { label: '주식·금·장기채·달러', item: c, idle: c.bundle ? '실질금리 자료 대기' : '묶음 아님' },
    { label: '금리와 달러', item: v.ratesDollar, idle: '이름 붙은 유형 아님' },
    { label: '금리 하락의 종류', item: v.rateFall, idle: '10년물 하락 아님' },
    { label: '엔/달러 하락의 출처', item: y, idle: y.legs.usdjpy?.value < 0 ? '하락 폭 기준 아래' : '엔/달러 하락 아님', note: y.state && y.riskFxWeak ?'호주달러 약세 동반' : '' },
  ].map(({ label, item, idle, note }) => ({ id: item.id, label, named: !!item.state, state: `${item.label || idle}${note ? ` · ${note}` : ''}`, evidence: legsText(item.legs) }));
}
function crossAssetBlock(doc, verdicts) {
  const rows = crossAssetRows(verdicts);
  if (!rows.length) return [];
  // A named relation is a card with its figures; the rows with none share one muted line, so a quiet month is one line.
  const list = el(doc, 'ul', null, 'xr-paths');
  for (const item of rows.filter((row) => row.named)) {
    const row = el(doc, 'li', null, 'xr-path is-met');
    row.dataset.crossAsset = item.id;
    row.append(el(doc, 'b', item.label, 'xr-path-label'), el(doc, 'span', ` ${item.state}`, 'xr-path-state'));
    if (item.evidence) row.append(el(doc, 'p', item.evidence, 'xr-path-evidence'));
    list.append(row);
  }
  const idle = rows.filter((row) => !row.named);
  const quiet = idle.length ? el(doc, 'p', `${idle.length === rows.length ? '이름 붙은 관계 없음' : '해당 없음'} — ${idle.map((row) => `${row.label}: ${row.state}`).join(' · ')}`, 'xr-path-evidence') : null;
  if (quiet) quiet.dataset.crossAssetIdle = String(idle.length);
  return [el(doc, 'h3', `금리와 다른 자산 — ${verdicts.window}거래일`, 'xr-h4'), ...(list.children.length ? [list] : []), ...(quiet ? [quiet] : [])];
}

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
  const interpretation = marketInterpretation(root);
  const model = interpretation?.crossroads;
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
  parts.push(...crossAssetBlock(doc, crossAssetVerdicts(interpretation.inputs?.history || [], interpretation.inputs?.macroHistory || null)));
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
