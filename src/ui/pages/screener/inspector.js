// Screener inspector: why a row ranked where it did, its range and excess bars, compare tray.
import { signedBar, signedScale } from '../../components/signed-bar.js';
import { setStockSubject } from '../../navigation/route-hubs.js';
import { overlapSentence } from '../../../domain/screener/factor-overlap.js';
import { selectScreenerState } from '../../../state/selectors/screener.js';
import { SCREENER_FIELD_REGISTRY, readRowNumber } from '../../../data/contracts/screener.js';
import { FACTOR_LABELS } from '../../../domain/screener/row-presentation.js';
import { screenerMarket, marketRankingMetadata, formatScreenerPrice } from '../../../domain/screener/market-scope.js';
import { modelContraryEvidence } from '../../../domain/technical/bands.js';
import { signedText, finiteNumber as finite } from '../../../domain/shared/number.js';
import { stampDay } from '../../../domain/shared/session-date.js';
import { shortDate } from '../../../domain/content/date-labels.js';
import { SCREENER_COLUMN_REGISTRY, cell, conditionMarginText, conditionMargins, currentOverlap, liveRow, range52Position, returnText, scopedRows, text } from './model.js';
import { createColumnContent } from './table.js';
// 개편 v2 (3c): author·year evidence for the factors the score weights. Only the listed studies; a factor without one
// (추세, 추세 속도, 밸류) shows its definition and weight only.
const FACTOR_EVIDENCE = Object.freeze({
  momentum: '중기(3~12개월) 승자가 이후에도 앞서던 경향(Jegadeesh·Titman 1993) — 여기서는 1·3·6개월 수익률을 섞어 씁니다',
  lowvol: '변동성이 낮은 종목의 위험 대비 수익이 더 높던 저변동 이상 현상(Ang 외 2006, Frazzini·Pedersen 2014)',
  quality: '수익성이 높은 기업이 장기 초과수익을 내던 경향(Novy-Marx 2013, 매출총이익 기준) — 여기서는 ROE·마진·매출성장'
});

// 개편 v2 (3c): the row's 1·3·6-month returns beside SPY's on the same close — one diverging scale, the gap on the right.
// v58.56 (4b): the 52-week position in the inspector/sheet — the phone row shows only order, name, 1개월 and 백분위.
function renderWhyRange(documentRef, row) {
  const section = documentRef.getElementById('scr-why-range');
  const host = documentRef.getElementById('scr-why-range-body');
  if (!section || !host) return;
  const position = range52Position(row);
  section.hidden = position == null;
  if (position == null) { host.replaceChildren(); return; }
  const bar = documentRef.createElement('span');
  bar.className = 'scr-range52 scr-why-range-bar';
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `52주 저점과 고점 사이 ${Math.round(position * 100)}% 지점`);
  const dot = documentRef.createElement('span');
  dot.className = 'scr-range52-dot';
  dot.style.left = `${(position * 100).toFixed(1)}%`;
  bar.append(dot);
  const legend = documentRef.createElement('div');
  legend.className = 'scr-why-range-legend sx-meta';
  const part = (value) => { const node = documentRef.createElement('span'); node.textContent = value; return node; };
  legend.append(part(`저점 대비 ${returnText(row.pctFrom52wLow)}`), part(`${Math.round(position * 100)}% 지점`), part(`고점 대비 ${returnText(row.pctFrom52wHigh)}`));
  host.replaceChildren(bar, legend);
}

function renderExcessBars(documentRef, row, benchmark) {
  const section = documentRef.getElementById('scr-why-excess');
  const host = documentRef.getElementById('scr-why-excess-bars');
  if (!section || !host) return;
  const windows = [['ret1m', '1개월'], ['ret3m', '3개월'], ['ret6m', '6개월']]
    .map(([key, label]) => ({ key, label, stock: finite(row?.[key]), index: finite(benchmark?.[key]) }))
    .filter((item) => item.stock != null && item.index != null);
  section.hidden = !windows.length;
  host.replaceChildren();
  if (!windows.length) return;
  // Review fix: a gap is drawn only when the row and SPY close on the same session; otherwise both dates are named.
  const md = (value) => { const day = stampDay(value); return day ? shortDate(day) : null; };
  const rowDay = md(row?.factorSessionDate);
  const indexDay = md(benchmark?.factorSessionDate);
  if (!rowDay || !indexDay || rowDay !== indexDay) {
    const note = documentRef.createElement('p');
    note.className = 'sx-meta scr-excess-legend';
    note.textContent = `종목 종가(${rowDay || '날짜 미확인'})와 S&P 500(SPY) 종가(${indexDay || '날짜 미확인'})의 기준일이 같지 않아 차이를 그리지 않습니다.`;
    host.append(note);
    return;
  }
  // v59.55 (C3): the shared two-sided bar, coloured as on 종목's 지수 대비 bars (the stock by direction, SPY in light ink).
  const max = signedScale(windows.flatMap((item) => [item.stock, item.index]), 1);
  const bar = (value, kind) => signedBar(documentRef, value, max, { tone: kind === 'stock' ? 'dir' : 'bench', trackClass: `scr-excess-track is-${kind}` });
  for (const item of windows) {
    const gap = item.stock - item.index;
    const line = documentRef.createElement('div');
    line.className = 'scr-excess-row';
    line.title = `${item.label} 종목 ${returnText(item.stock)}, S&P 500(SPY) ${returnText(item.index)}`;
    const label = documentRef.createElement('span');
    label.className = 'scr-excess-label';
    label.textContent = item.label;
    const bars = documentRef.createElement('span');
    bars.className = 'scr-excess-bars';
    bars.append(bar(item.stock, 'stock'), bar(item.index, 'index'));
    const value = documentRef.createElement('span');
    // v59.55 (visual review): a return gap is a direction (rising red, falling blue), as on 종목's 지수 대비 bars.
    value.className = `scr-excess-value ${gap > 0 ? 'is-up' : gap < 0 ? 'is-down' : ''}`;
    value.textContent = signedText(gap, 1, '%p');
    line.append(label, bars, value);
    host.append(line);
  }
  const legend = documentRef.createElement('p');
  legend.className = 'sx-meta scr-excess-legend';
  legend.textContent = `색 막대 = 종목, 옅은 막대 = S&P 500(SPY), 오른쪽 = 차이, 둘 다 ${rowDay} 종가`;
  host.append(legend);
}

/** Why drawer (inspector / bottom sheet), watchlist and compare tray. */
export function createInspectorController(ctx) {
  const { documentRef, root, store, page, bag, workbench, sortState, visibleLimit, columnState, selectedSymbols, compareSymbols, liveReader, watchlistReader, profileReader, onWatchlistToggle, onProfileChange, onUniverseScopeChange } = ctx;
       const setText = (id, value) => {
         const node = documentRef.getElementById(id);
         if (node) node.textContent = value == null || value === '' ? '—' : String(value);
         return node;
       };
       ctx.renderWhyDrawer = (row) => {
         const drawer = documentRef.getElementById('scr-why-drawer');
         if (!drawer || !row) return;
         const explanation = row.rankExplanation || {};
         const readiness = row.fieldReadiness?.coverage || {};
          // P1164/B04(12:W12-B): screenStatus=passed만으로 'WhyRanked'라 부르지 않는다.
          // 도메인이 분리한 필터/순위/설명 상태를 renderer도 그대로 사용한다.
          // LC-40: 엔진 어휘는 'ranked'/'unavailable'/'not-requested'다. 이전 비교('available')는
          // 절대 참이 될 수 없어 순위가 계산돼도 제목이 항상 '순위 계산 보류'로 고정됐다.
          const filterState = row.screenFilterState || row.screenStatus;
          const rankingState = row.screenRankingState || (row.screenRank != null ? 'ranked' : 'unavailable');
          const ordinalRank = finite(row.screenRank);
          const rawFactorRank = finite(explanation.contributions?.rank);
          const filterLabel = filterState === 'passed' ? '필터 통과'
            : filterState === 'rejected' ? '필터 미충족' : '필터 판정 보류';
          const rankingLabel = rankingState === 'ranked' ? '순위 계산됨'
            : rankingState === 'not-requested' ? '순위 미요청(필터 미통과)' : '순위 계산 불가';
          const title = filterState === 'passed'
            ? (rankingState === 'ranked' && ordinalRank != null ? '조건 통과' : '조건 통과, 순위 계산 보류')
            : (filterState === 'rejected' ? '조건 미충족' : '데이터 부족 — 판정 보류');
         const missing = explanation.missingEvidence || row.setupProfile?.missingEvidence || [];
         // v57.81: model-level contrary checks (five-session break, under the 20/50/200-day line, RSI regime) run on every
         // row, independent of the user's filters — MRVL after -13.8% in five sessions read "걸린 반대 조건 없음".
         const filterContrary = explanation.contraryEvidence || [];
         const modelContrary = modelContraryEvidence(row);
         const contrary = [...modelContrary.hits.map((hit) => `모델 점검: ${hit}`), ...filterContrary.map((hit) => `등록 조건: ${hit}`)];
         // 개편 v2 (3c): the inspector leads with the ticker, its order among ranked rows and the last close.
         setText('scr-why-title', row.sym || row.symbol || '종목');
         setText('scr-why-subtitle', row.name || '연구용 상대 순위 설명');
         const inspectState = selectScreenerState(store.getState()) || {};
         const rowMarket = screenerMarket(row);
         const rankedInMarket = scopedRows(inspectState.rows || [], rowMarket).filter((item) => finite(item?.screenRank) != null).length;
         // Review fix: the same guard as the table's 전체 순위 column (held ranking or a row that did not pass shows no order).
         const rankHoldNow = marketRankingMetadata(inspectState.metadata, rowMarket)?.available === false || !!root?._aioRankingHold;
         const ordinalForLine = rankHoldNow || row.screenStatus !== 'passed' ? null : finite(row.screenRank);
         setText('scr-why-rankline', ordinalForLine == null ? '순위 계산 보류' : `전체 ${ordinalForLine}위 / ${rankedInMarket || '—'}`);
         const inspectLive = liveRow(row, liveReader);
         const inspectPrice = finite(inspectLive.price);
         setText('scr-why-price', inspectPrice == null ? '—' : formatScreenerPrice(inspectPrice, String(row.instrumentRef?.currency || row.currency || '').trim().toUpperCase() || null));
         const moveNode = documentRef.getElementById('scr-why-move');
         const whyRet1m = readRowNumber(row, 'ret1m', 'display');
         if (moveNode) moveNode.textContent = whyRet1m == null ? '' : `1개월 ${returnText(whyRet1m)}`;
         if (moveNode) moveNode.className = `scr-why-move ${whyRet1m == null ? '' : whyRet1m >= 0 ? 'sx-up' : 'sx-down'}`;
         const benchmark = rowMarket === 'US' ? (inspectState.rows || []).find((item) => item?.sym === 'SPY') || null : null;
         const sameSession = !!benchmark && !!row.factorSessionDate && String(benchmark.factorSessionDate || '').slice(0, 10) === String(row.factorSessionDate).slice(0, 10);
         const excessOf = (key) => {
           const own = sameSession ? readRowNumber(row, key, 'display') : null, base = sameSession ? readRowNumber(benchmark, key, 'display') : null;
           return own != null && base != null ? own - base : null;
         };
          const factorConfidence = finite(row.confidence);
           // LC-40: 두 rank를 이름으로 분리한다 — 표시 순위는 통과 행의 서수, 팩터 원값은 순위
           // 입력(0~100)이다. 둘 다 'rank'라 부르면 서로 다른 숫자를 같은 값으로 오해한다.
           const rankText = `표시 순위 ${ordinalRank == null ? '—' : ordinalRank}, 팩터 원값 ${rawFactorRank == null ? '—' : rawFactorRank.toFixed(2)}`;
          // P1592 (F10): one reader line — rank, percentile, data completeness. The ledger detail
          // (filter/ranking states, raw factor input, factor confidence) stays on hover.
          const percentileValue = finite(row.rank);
          const statusEl = documentRef.getElementById('scr-why-status');
          // v59.55 (alignment pass): the rank and percentile are the panel head's numbers; repeating them here under another
          // population ("조건 통과 종목 중") read as a second rank. The line keeps the state and the data coverage.
          setText('scr-why-status', [
            title,
            readiness.coveragePct == null ? null : `자료 ${Math.round(readiness.coveragePct)}% 확보`
          ].filter(Boolean).join(' · '));
          if (statusEl) statusEl.title = `${filterLabel}, ${rankingLabel}, ${rankText}${percentileValue == null ? '' : `, 전체 백분위 ${percentileValue.toFixed(0)}`}, 팩터 근거 ${factorConfidence == null ? '—' : `${Math.round(factorConfidence * 100)}%`} (수익확률 아님)`;
         const uncheckedNote = modelContrary.unchecked.length ? ` 자료가 없어 점검하지 못한 항목: ${modelContrary.unchecked.join(', ')}.` : '';
         setText('scr-why-contrary', `${contrary.length ? contrary.join(', ') : row.screenStatus === 'unavailable' ? '필수 근거 미수신으로 등록 조건 판단을 보류했고, 모델 점검(5거래일 낙폭, 20·50·200일선, RSI)에는 걸리지 않았습니다.' : '모델 점검(5거래일 낙폭, 20·50·200일선, RSI)과 등록된 반대 조건 모두에 걸리지 않았습니다 — 위험이 없다는 뜻은 아닙니다.'}${uncheckedNote}`);
          // v58.75 (teach-and-check D7): the chosen screen's conditions with this row's values and the near-threshold ones.
          {
            let conditionDefinition = ctx.activeResult?.definition || ctx.activeDefinition;
            try { conditionDefinition = ctx.activeResult?.definition || ctx.buildVisualDefinition() || ctx.activeDefinition; } catch (_) {}
            const contraryNode = documentRef.getElementById('scr-why-contrary');
            let conditionNode = documentRef.getElementById('scr-why-conditions');
            if (!conditionNode && contraryNode?.parentElement) {
              const heading = documentRef.createElement('h4');
              heading.textContent = '조건과 경계';
              conditionNode = documentRef.createElement('p');
              conditionNode.id = 'scr-why-conditions';
              const firstHeading = contraryNode.parentElement.querySelector('h4');
              contraryNode.parentElement.insertBefore(heading, firstHeading);
              contraryNode.parentElement.insertBefore(conditionNode, firstHeading);
            }
            if (conditionNode) conditionNode.textContent = `${conditionDefinition?.name ? `${conditionDefinition.name} — ` : ''}${conditionMarginText(conditionMargins(conditionDefinition, row))}`;
          }
          const structureEvidence = row.setupProfile?.structureEvidence || {};
          const structureNote = structureEvidence.postEarningsBreakout === 'unavailable'
            ? '선택 근거 — 실적 후 돌파 확인 자료는 아직 받지 못했습니다'
            : `선택 근거 — 실적 후 돌파: ${structureEvidence.postEarningsBreakout}`;
          // Codex review 2026-10-05: the table showed a dimmed past value while this list called the same
          // field missing. A field with an older observation says so; only a field with no value is "없음".
          const describeMissing = (fieldId) => {
            if (fieldId === 'relative-rank' || fieldId === 'rank') return '상대 순위(이번 계산 보류)';
            const label = SCREENER_FIELD_REGISTRY.get(fieldId)?.label || fieldId;
            const field = row.fieldReadiness?.fields?.[fieldId];
            if (field && ['STALE', 'LAST_GOOD'].includes(field.status) && field.value != null) return `${label}(${String(field.observedAt || '').slice(5, 10).replace('-', '/') || '이전'} 값만 있음, 최신 아님)`;
            return `${label}(값 없음)`;
          };
          setText('scr-why-missing', `순위 필수값 — ${missing.length ? missing.map(describeMissing).join(', ') : '모두 있습니다'}. ${structureNote}.`);
         // v59.46 R3-05: a carried row names that this refresh did not read it.
         setText('scr-why-provenance', row.factorSessionDate ? `가격 기준 ${String(row.factorSessionDate).slice(0, 10)} 종가${row.retainedFrom ? ' — 이번 갱신에서 받지 못해 직전 자료를 이어 표시' : ''}` : '가격 기준일 확인 필요');
         // 개편 v2 (3c): one plain reading from the row's own closes — trend position, then the 3-month gap to the S&P 500
         // (SPY on the same close), then the completeness line that used to stand alone.
         const above50 = readRowNumber(row, 'pctSma50', 'display');
         const above200 = readRowNumber(row, 'pctSma200', 'display');
         const trendWords = above50 == null || above200 == null ? null
           : above50 >= 0 && above200 >= 0 ? '50일선과 200일선 위' : above50 < 0 && above200 < 0 ? '50일선과 200일선 아래'
             : above50 >= 0 ? '50일선 위, 200일선 아래' : '50일선 아래, 200일선 위';
         const excess3m = excessOf('ret3m');
         setText('scr-why-preview', [
           trendWords ? `종가가 ${trendWords}에 있습니다.` : null,
           excess3m == null ? null : `3개월 수익률(${returnText(readRowNumber(row, 'ret3m', 'display'))})은 S&P 500보다 ${Math.abs(excess3m).toFixed(1)}%p ${excess3m >= 0 ? '높습니다' : '낮습니다'}.`,
           `${missing.length ? `빠진 필수값 ${missing.length}개` : '빠진 필수값 없음'}, ${contrary.length ? `걸린 반대 조건 ${contrary.length}개` : row.screenStatus === 'unavailable' ? '판정 보류' : '걸린 반대 조건 없음'}.`
         ].filter(Boolean).join(' '));
         renderExcessBars(documentRef, row, benchmark);
         renderWhyRange(documentRef, row);
         const factorList = documentRef.getElementById('scr-why-factor-list');
         if (factorList) {
           factorList.replaceChildren();
           const factors = Object.entries(row.factorScores || {}).filter(([, value]) => finite(value) != null);
           // P1165 (12 W12-B): 막대는 '정규화 점수'다. 적용 가중치와 가중 기여를 같은 줄에서 분리해
           // 보여주고, 랭킹 합성이 실제로 무엇을 평균했는지(원값)도 이 자리에서 밝힌다.
           const appliedWeights = marketRankingMetadata(selectScreenerState(store.getState())?.metadata, screenerMarket(row)).appliedFactorWeights || {};
           const weightSum = factors.reduce((sum, [key]) => sum + (finite(appliedWeights[key]) == null ? 0 : Number(appliedWeights[key])), 0);
           if (!factors.length) factorList.appendChild(text(documentRef, '팩터 점수 미수신'));
           // 개편 v2 (3c): heaviest weight first; the author·year line appears only for a factor the score actually weights.
           const weightOf = (key) => finite(appliedWeights[key]) ?? 0;
           const evidenceLines = [];
           [...factors].sort((a, b) => weightOf(b[0]) - weightOf(a[0])).slice(0, 8).forEach(([key, value]) => {
             const item = documentRef.createElement('div');
             item.className = 'sx-factor scr-why-factor';
             const head = documentRef.createElement('div');
             head.className = 'sx-factor__head';
             const label = documentRef.createElement('span');
             label.textContent = FACTOR_LABELS[key]?.label || key; if (FACTOR_LABELS[key]?.description) { const desc = documentRef.createElement('span'); desc.className = 'sx-factor__desc'; desc.textContent = FACTOR_LABELS[key].description; label.append(desc); }
             const valueNode = documentRef.createElement('b');
             valueNode.textContent = Number(value).toFixed(0);
             head.append(label, valueNode);
             const track = documentRef.createElement('div');
             track.className = 'sx-factor__bar';
             const fill = documentRef.createElement('span');
             fill.style.width = `${Math.max(0, Math.min(100, Number(value)))}%`;
             track.appendChild(fill);
             const weight = finite(appliedWeights[key]);
             const share = weight != null && weightSum > 0 ? weight / weightSum : null;
             const contribution = share == null ? null : Number(value) * share;
             const note = documentRef.createElement('p');
             note.className = 'scr-why-factor-evidence';
             // v59.55 (visual audit): the bar line keeps weight and contribution; the study behind the factor moves to the fold below.
             if (share > 0 && FACTOR_EVIDENCE[key]) evidenceLines.push(`${FACTOR_LABELS[key]?.label || key}: ${FACTOR_EVIDENCE[key]}`);
             note.textContent = share == null ? '비중 미수신 — 순위 합산에 쓰이지 않았습니다' : `비중 ${Math.round(share * 100)}%${contribution == null ? '' : `, 기여 ${contribution.toFixed(1)}`}`;
             item.title = `${FACTOR_LABELS[key]?.description || key}, 정규화 점수 ${Number(value).toFixed(1)}, 적용 가중치 ${weight == null ? '미수신' : Number(weight).toFixed(3)}, 가중 기여 ${contribution == null ? '계산 불가' : contribution.toFixed(2)}`;
             item.append(head, track, note);
             factorList.appendChild(item);
           });
           // P1443 (review 2026-10-04): name the chain instead of calling different numbers '합성' —
           // the weighted sum of the bars is an intermediate value; the score shown is that sum's
           // percentile among computable stocks, and the displayed rank is the order among passing rows.
           const weightedSum = factors.reduce((sum, [key, value]) => {
             const weight = finite(appliedWeights[key]);
             return weight == null || !(weightSum > 0) ? sum : sum + Number(value) * weight / weightSum;
           }, 0);
           const percentile = finite(row.rank);
           const rankLine = documentRef.createElement('div');
           rankLine.className = 'scr-why-factor-note';
           rankLine.textContent = factors.length
             ? `계산 순서: ① 팩터마다 같은 섹터 안에서 정규화(막대, 0~100 환산) → ② 가중 합 ${weightedSum.toFixed(1)} → ③ 계산 가능한 종목들 사이에서 그 합의 백분위 ${percentile == null ? '—' : percentile.toFixed(0)}(100 = 맨 위, 만점이라는 뜻이 아님) → ④ 조건을 통과한 종목 중 ${ordinalRank == null ? '—' : `${ordinalRank}위`}. 가중 합과 백분위가 다른 것은 ③에서 다시 줄을 세우기 때문입니다.`
             : '팩터 점수 미수신 — 순위를 해석하지 않습니다.';
           // 개편 v2 (3c): the calculation chain and the factor overlap fold under the bars so the inspector stays short.
           const calc = documentRef.createElement('details');
           calc.className = 'scr-why-calc';
           const calcSummary = documentRef.createElement('summary');
           calcSummary.textContent = evidenceLines.length ? '점수 계산 순서, 요인 겹침, 연구 근거' : '점수 계산 순서, 요인 겹침';
           calc.append(calcSummary, rankLine);
           for (const line of evidenceLines) { const node = documentRef.createElement('p'); node.className = 'scr-why-factor-note'; node.textContent = line; calc.appendChild(node); }
           factorList.appendChild(calc);
           const overlap = documentRef.createElement('div');
           overlap.className = 'scr-why-factor-note';
           const screenState = selectScreenerState(store?.getState?.() || {});
           const overlapMarket = screenerMarket(row);
           overlap.textContent = `${overlapSentence(currentOverlap(screenState?.rows, marketRankingMetadata(screenState?.metadata, overlapMarket), overlapMarket))} 백분위는 기업의 질이나 상승 확률을 뜻하지 않습니다.`;
           calc.appendChild(overlap);
         }
         const ticker = documentRef.querySelector('[data-aio-screener-action="open-ticker"]');
         if (ticker) ticker.dataset.aioScreenerArg = row.sym || row.symbol || '';
         // v58.75 (teach-and-check D6): the next step of the top-down flow — this stock's chart, level map and plan check.
         if (ticker && !documentRef.querySelector('[data-aio-screener-action="open-chart-levels"]')) {
           const levelsButton = documentRef.createElement('button');
           levelsButton.type = 'button';
           levelsButton.className = 'sx-btn';
           levelsButton.dataset.aioScreenerAction = 'open-chart-levels';
           levelsButton.textContent = '차트·가격 레벨·내 계획 점검';
           ticker.insertAdjacentElement('afterend', levelsButton);
         }
         const levelsLink = documentRef.querySelector('[data-aio-screener-action="open-chart-levels"]');
         if (levelsLink) levelsLink.dataset.aioScreenerArg = row.sym || row.symbol || '';
         ctx.syncWhyCompare(row.sym || row.symbol || '');
         ctx.syncWhyWatchlist(row.sym || row.symbol || '');
         drawer.hidden = false;
       };
       // 개편 v2 (3c/4b/4c): the Why drawer is the inspector beside the table (≥1024px: 400px, iPad landscape 360px) and a
       // bottom sheet at 1023px and below (iPad portrait, phone). Focus moves into it on a tap and returns to the row on close.
       ctx.whyDrawerNode = documentRef.getElementById('scr-why-drawer');
       const NARROW_WHY = '(max-width: 1023px)';
       ctx.narrowWhy = () => Boolean(root?.matchMedia?.(NARROW_WHY)?.matches);
       ctx.selectedResultRow = () => {
         const symbol = ctx.activeRow?.sym || ctx.activeRow?.symbol;
         const body = documentRef.getElementById('screener-results-body');
         return symbol && body ? [...body.querySelectorAll('tr[data-aio-screener-ticker]')].find((node) => node.dataset.aioScreenerTicker === symbol) || null : null;
       };
       let sheetScrim = null;
       let sheetFrame = null;
       // Review fix: only a reader's tap opens the sheet — an inspector the wide layout opened by itself closes when the
       // screen narrows (iPad rotation) instead of turning into a sheet with a scrim nobody asked for.
       ctx.whyUserOpened = false;
       ctx.syncWhyMode = () => {
         if (!ctx.whyDrawerNode) return;
         const sheet = ctx.narrowWhy();
         if (sheet && !ctx.whyDrawerNode.hidden && !ctx.whyUserOpened) ctx.whyDrawerNode.hidden = true;
         ctx.whyDrawerNode.classList.toggle('sx-sheet', sheet);
         ctx.whyDrawerNode.classList.toggle('sx-inspector', !sheet);
         const open = sheet && !ctx.whyDrawerNode.hidden && page.dataset.scrView === 'rank';
         // In sheet mode the drawer is a modal dialog (Tab stays inside, see onWhyKeydown); beside the table it is an aside.
         if (open) { ctx.whyDrawerNode.setAttribute('role', 'dialog'); ctx.whyDrawerNode.setAttribute('aria-modal', 'true'); }
         else { ctx.whyDrawerNode.removeAttribute('role'); ctx.whyDrawerNode.removeAttribute('aria-modal'); }
         if (open && !sheetScrim) {
           sheetScrim = documentRef.createElement('div');
           sheetScrim.className = 'scr-sheet-scrim';
           sheetScrim.addEventListener('click', () => ctx.closeWhyDrawer());
           page.append(sheetScrim);
         }
         if (sheetScrim) sheetScrim.hidden = !open;
         if (!open) { ctx.whyDrawerNode.classList.remove('is-open'); return; }
         if (ctx.whyDrawerNode.classList.contains('is-open')) return;
         const raise = () => { sheetFrame = null; if (!ctx.whyDrawerNode.hidden) ctx.whyDrawerNode.classList.add('is-open'); };
         sheetFrame = root?.requestAnimationFrame ? root.requestAnimationFrame(raise) : (raise(), null);
       };
       ctx.placeWhyDrawer = () => { ctx.syncWhyMode(); return ctx.selectedResultRow(); };
       ctx.revealWhyDrawer = (row) => {
         if (!ctx.whyDrawerNode || ctx.whyDrawerNode.hidden) return;
         if (!ctx.whyDrawerNode.hasAttribute('tabindex')) ctx.whyDrawerNode.tabIndex = -1;
         ctx.whyDrawerNode.focus?.({ preventScroll: true });
         if (ctx.narrowWhy()) return; // the sheet is fixed to the bottom of the screen
         const view = root?.innerHeight || 0;
         const top = ctx.whyDrawerNode.getBoundingClientRect?.().top ?? 0;
         if (view && top >= -8 && top <= view * 0.6) return;
         const smooth = !root?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
         ctx.whyDrawerNode.scrollIntoView?.({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
         void row;
       };
       ctx.closeWhyDrawer = () => {
         if (!ctx.whyDrawerNode) return;
         ctx.whyDrawerNode.hidden = true;
         ctx.syncWhyMode();
         ctx.selectedResultRow()?.focus?.();
       };
       const onWhyKeydown = (event) => {
         if (event.key === 'Escape') { event.preventDefault(); ctx.closeWhyDrawer(); return; }
         if (event.key !== 'Tab' || ctx.whyDrawerNode.getAttribute('aria-modal') !== 'true') return;
         // Focus trap while the sheet is a modal dialog: Tab cycles inside it instead of reaching the page behind the scrim.
         const focusables = [...ctx.whyDrawerNode.querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
           .filter((node) => !node.disabled && node.getClientRects().length);
         if (!focusables.length) { event.preventDefault(); return; }
         const first = focusables[0];
         const last = focusables[focusables.length - 1];
         const active = documentRef.activeElement;
         if (event.shiftKey && (active === first || active === ctx.whyDrawerNode)) { event.preventDefault(); last.focus(); }
         else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
       };
       if (ctx.whyDrawerNode) {
         ctx.whyDrawerNode.addEventListener('keydown', onWhyKeydown);
         const narrowQuery = root?.matchMedia?.(NARROW_WHY);
         const onNarrowChange = () => ctx.syncWhyMode();
         narrowQuery?.addEventListener?.('change', onNarrowChange);
         bag.add(() => {
           narrowQuery?.removeEventListener?.('change', onNarrowChange);
           ctx.whyDrawerNode.removeEventListener('keydown', onWhyKeydown);
           if (sheetFrame != null) root?.cancelAnimationFrame?.(sheetFrame);
           ctx.whyDrawerNode.classList.remove('is-open');
           sheetScrim?.remove(); sheetScrim = null;
         });
       }
       // v58.56 (#12): 비교 lives only here (the row keeps ☆); the button names its state like the watchlist one.
       ctx.syncWhyCompare = (symbol) => {
         const button = documentRef.querySelector('[data-aio-screener-action="why-compare"]');
         if (!button) return;
         const inCompare = !!symbol && compareSymbols.has(symbol);
         button.dataset.aioScreenerArg = symbol || '';
         button.setAttribute('aria-pressed', inCompare ? 'true' : 'false');
         button.textContent = inCompare ? '비교에서 빼기' : `비교 추가${compareSymbols.size ? ` (${compareSymbols.size}/5)` : ''}`;
       };
       ctx.syncWhyWatchlist = (symbol) => {
         const button = documentRef.querySelector('[data-aio-screener-action="why-watchlist"]');
         if (!button) return;
         const inList = !!symbol && watchlistReader().includes(symbol);
         button.dataset.aioScreenerArg = symbol || '';
         button.setAttribute('aria-pressed', inList ? 'true' : 'false');
         button.textContent = inList ? '관심 종목에서 빼기' : '관심 종목 추가';
       };
       ctx.explainRow = (row) => {
         ctx.whyUserOpened = true;
         ctx.activeRow = row;
         selectedSymbols.clear();
         if (row?.sym || row?.symbol) selectedSymbols.add(row.sym || row.symbol);
         ctx.renderWhyDrawer(row);
         ctx.renderNow();
         ctx.revealWhyDrawer(ctx.placeWhyDrawer());
       };
       // 개편 v2 (3c): on a wide screen the inspector starts on the table's first row (no focus move, no scroll), as the
       // design shows one row selected; a phone or iPad portrait opens the sheet only on a tap.
       ctx.autoInspected = false;
       ctx.autoInspect = () => {
         if (ctx.autoInspected || ctx.activeRow || !ctx.whyDrawerNode || ctx.narrowWhy() || page.dataset.scrView !== 'rank') return false;
         const first = documentRef.querySelector('#screener-results-body tr[data-aio-screener-ticker]');
         const symbol = first?.dataset.aioScreenerTicker;
         const pool = ctx.activeRows || ctx.activePreview?.rows || selectScreenerState(store.getState())?.rows || [];
         const row = symbol ? pool.find((item) => (item.sym || item.symbol) === symbol) : null;
         if (!row) return false;
         ctx.autoInspected = true;
         ctx.whyUserOpened = false;
         ctx.activeRow = row;
         selectedSymbols.clear();
         selectedSymbols.add(symbol);
         ctx.renderWhyDrawer(row);
         return true;
       };
       // v58.63 (architecture audit A12): the inspector shows the selected symbol's row from the CURRENT result. A preset,
       // run or data refresh replaces the row objects, so the held row is re-read by symbol on every render (NVDA stayed at
       // 308위 beside a table that said 249위 until the row was clicked again). A symbol that left the result releases the
       // selection: wide screens fall back to the first row, an open phone/tablet sheet closes.
       ctx.refreshInspector = () => {
         if (!ctx.activeRow || !ctx.whyDrawerNode) return false;
         const symbol = ctx.activeRow.sym || ctx.activeRow.symbol;
         const pool = ctx.activeRows || ctx.activePreview?.rows || selectScreenerState(store.getState())?.rows || [];
         const fresh = symbol ? pool.find((item) => (item.sym || item.symbol) === symbol) : null;
         // v58.80 (first-users bundle 8): a filter that left the table empty kept the last stock's explanation beside it,
         // as if it were one of zero results. With no row on the table the inspector is put away until rows return.
         const tableRows = documentRef.getElementById('screener-results-body')?.querySelector('tr[data-aio-screener-ticker]');
         if (!tableRows && fresh) { ctx.activeRow = null; ctx.autoInspected = false; selectedSymbols.clear(); ctx.whyDrawerNode.hidden = true; ctx.syncWhyMode(); return false; }
         if (fresh === ctx.activeRow) return false;
         if (fresh) { ctx.activeRow = fresh; ctx.renderWhyDrawer(fresh); return false; }
         ctx.activeRow = null; ctx.autoInspected = false; selectedSymbols.clear();
         if (ctx.narrowWhy() && !ctx.whyDrawerNode.hidden) ctx.closeWhyDrawer();
         return true;
       };
       // v57.81 (phone/iPad parity audit): the "+" gave no sign near the row and the tray sits far below on a phone.
       // One status line pinned to the bottom of the screen says what changed and links to the tray.
       let compareNoticeTimer = null;
       ctx.showCompareNotice = (message) => {
         let notice = documentRef.getElementById('scr-compare-feedback');
         if (!notice) {
           notice = documentRef.createElement('div');
           notice.id = 'scr-compare-feedback';
           notice.className = 'scr-compare-feedback';
           notice.setAttribute('role', 'status');
           const textNode = documentRef.createElement('span');
           const go = documentRef.createElement('button');
           go.type = 'button';
           go.className = 'aio-btn-table';
           go.textContent = '비교 보기';
           go.setAttribute('aria-controls', 'scr-compare-tray');
           go.dataset.aioScreenerAction = 'show-compare';
           notice.append(textNode, go);
           page.append(notice);
         }
         notice.firstElementChild.textContent = message;
         notice.lastElementChild.hidden = compareSymbols.size === 0;
         notice.hidden = false;
         if (compareNoticeTimer) clearTimeout(compareNoticeTimer);
         compareNoticeTimer = setTimeout(() => { compareNoticeTimer = null; notice.hidden = true; }, 6000);
       };
       bag.add(() => { if (compareNoticeTimer) clearTimeout(compareNoticeTimer); compareNoticeTimer = null; documentRef.getElementById('scr-compare-feedback')?.remove(); });
       ctx.toggleCompare = (symbol) => {
         if (!symbol) return;
         let message;
         if (compareSymbols.has(symbol)) { compareSymbols.delete(symbol); message = `${symbol} 비교에서 뺌, ${compareSymbols.size}개`; }
         else if (compareSymbols.size < 5) { compareSymbols.add(symbol); message = `${symbol} 비교에 추가됨, ${compareSymbols.size}개`; }
         else message = '비교는 5개까지입니다, 하나를 빼고 다시 넣으세요';
         ctx.renderCompareTray();
         ctx.renderNow();
         ctx.showCompareNotice(message);
       };
       ctx.renderCompareTray = () => {
         const tray = documentRef.getElementById('scr-compare-tray');
         if (!tray) return;
         tray.hidden = compareSymbols.size === 0;
         const list = documentRef.getElementById('scr-compare-list');
         if (list) {
           list.replaceChildren();
           if (compareSymbols.size) {
             // P1599 (F08): the tray reads the same rows as the table (the preview carries price-derived fields).
             const rows = ctx.activeRows || ctx.activePreview?.rows || selectScreenerState(store.getState())?.rows || [];
             // v57.81: a US listing outside the universe compares on its on-demand row (same formulas, computed at request
             // time); its rank cell stays empty — it is not in the published ranking. Not yet read → requested once.
             const onDemandRow = (symbol) => {
               const record = root?._aioOnDemandSymbol?.(symbol);
               if (!record) { root?._aioRequestOnDemandSymbol?.(symbol)?.then?.(() => { if (compareSymbols.has(symbol)) ctx.renderCompareTray(); }); return null; }
               return record.status === 'ready' && record.row ? { ...record.row, rank: null, screenRank: null, screenStatus: 'on-demand', onDemandComputedAt: record.computedAt } : null;
             };
             const compared = [...compareSymbols].map((symbol) => rows.find((row) => (row.sym || row.symbol) === symbol) || onDemandRow(symbol) || { sym: symbol, screenStatus: 'unavailable' });
             const table = documentRef.createElement('table');
             table.setAttribute('aria-label', '선택 종목 비교');
             table.className = 'scr-compare-table';
             const heading = documentRef.createElement('tr');
             const label = documentRef.createElement('th');
             label.scope = 'col'; label.textContent = '동일 기준 비교'; heading.append(label);
             for (const row of compared) {
               const th = documentRef.createElement('th');
               th.scope = 'col';
               const button = documentRef.createElement('button');
               button.type = 'button'; button.className = 'aio-btn-table'; button.textContent = row.sym;
               button.setAttribute('aria-label', `${row.sym}${row.name ? ` ${row.name}` : ''} 종목 상세`);
               button.addEventListener('click', () => ctx.tickerHandler(row.sym));
               th.append(button);
               // P1599 (F08): the company name under the ticker — a six-digit KRX code alone is not a name.
               if (row.name) { const name = documentRef.createElement('div'); name.textContent = row.name; name.className = 'scr-compare-name'; th.append(name); }
               heading.append(th);
             }
             const head = documentRef.createElement('thead'); head.append(heading); table.append(head);
             const body = documentRef.createElement('tbody');
             // P1599 (F08): a comparison row where no compared stock has a value is dropped and named once below.
             const emptyRows = [];
             for (const key of ['rank', 'price', 'ret1m', 'ret3m', 'rsi', 'vcpScore', 'value', 'quality']) {
               const contents = compared.map((row) => createColumnContent(documentRef, row, key, { readLiveData: liveReader }));
               if (key !== 'price' && contents.every((node) => /^[\s—-]*$/.test(typeof node === 'string' || typeof node === 'number' ? String(node) : node?.textContent || ''))) { emptyRows.push(SCREENER_COLUMN_REGISTRY.find((column) => column.key === key).label); continue; }
               const tr = documentRef.createElement('tr');
               const th = documentRef.createElement('th');
               th.scope = 'row'; th.textContent = SCREENER_COLUMN_REGISTRY.find((column) => column.key === key).label;
               tr.append(th);
               contents.forEach((content) => tr.append(cell(documentRef, content)));
               body.append(tr);
             }
             table.append(body); list.append(table);
             if (emptyRows.length) { const note = documentRef.createElement('p'); note.className = 'scr-compare-note'; note.textContent = `비교 종목 모두 값이 없어 뺀 항목: ${emptyRows.join(', ')}`; list.append(note); }
             const outside = compared.filter((row) => row.screenStatus === 'on-demand');
             if (outside.length) { const note = documentRef.createElement('p'); note.className = 'scr-compare-on-demand'; note.textContent = `${outside.map((row) => row.sym).join(', ')}: 랭킹 대상 밖 종목 — 순위 칸은 비우고, 다른 값은 ${String(outside[0].onDemandComputedAt || '').slice(0, 10)} 요청 시 같은 공식으로 계산했습니다.`; list.append(note); }
           }
         }
         const count = documentRef.getElementById('scr-compare-count');
         if (count) count.textContent = String(compareSymbols.size);
       };
       // v57.81: the 종목 screen hands an out-of-universe listing to this tray (queued while the screener is not mounted).
       ctx.addCompare = (symbol) => {
         const id = String(symbol || '').trim().toUpperCase();
         if (!id || compareSymbols.has(id) || compareSymbols.size >= 5) return compareSymbols.has(id);
         compareSymbols.add(id); ctx.renderCompareTray(); ctx.renderNow(); return true;
       };
       root._aioAddScreenerCompare = ctx.addCompare;
       (Array.isArray(root._aioPendingCompare) ? root._aioPendingCompare.splice(0) : []).forEach(ctx.addCompare);
       bag.add(() => { if (root._aioAddScreenerCompare === ctx.addCompare) delete root._aioAddScreenerCompare; });
  ctx.actions.push((action, argument, actionNode) => {
    if (action === 'why-watchlist') {
           const symbol = argument || ctx.activeRow?.sym || ctx.activeRow?.symbol;
           if (symbol) { (onWatchlistToggle || root?._aioWLToggle)?.(symbol); ctx.rerender(); ctx.syncWhyWatchlist(symbol); }
    } else if (action === 'open-ticker') {
           ctx.tickerHandler(argument || ctx.activeRow?.sym || ctx.activeRow?.symbol);
    } else if (action === 'open-chart-levels') {
           // v58.75 (D6): name the 종목 screen's company, open its chart and land on the level map.
           const symbol = argument || ctx.activeRow?.sym || ctx.activeRow?.symbol;
           if (symbol) {
             setStockSubject({ root, documentRef, symbol });
             root.__aioChartScrollTo = 'chart-levels';
             root.showPage?.('technical');
           }
    } else if (action === 'why-compare') {
           const symbol = argument || ctx.activeRow?.sym || ctx.activeRow?.symbol;
           ctx.toggleCompare(symbol);
    } else if (action === 'close-why') {
           ctx.closeWhyDrawer();
    } else if (action === 'show-compare') {
           const tray = documentRef.getElementById('scr-compare-tray');
           if (tray && !tray.hidden) {
             if (!tray.hasAttribute('tabindex')) tray.tabIndex = -1;
             tray.focus({ preventScroll: true });
             tray.scrollIntoView?.({ block: 'start', behavior: root?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth' });
           }
           const notice = documentRef.getElementById('scr-compare-feedback');
           if (notice) notice.hidden = true;
    } else if (action === 'clear-compare') {
           compareSymbols.clear(); ctx.renderCompareTray(); ctx.renderNow();
    } else return false;
    return true;
  });
}
