// Screener 사후 검증 view: factor weights, back-test, conditional evidence and the validation banner.
import { SCENARIO_STATE, loadArtifact } from '../../../data/artifact-registry.js';
import { renderScreenerValidation, readValidationState, renderValidationHero } from '../../components/screener-validation.js';
import { buildPopulationRankingIdentity, liveScreenerModelFingerprint } from '../../../domain/screener/model-fingerprint.js';
import { measuredCandidateEntries, summarizeCandidateArchive } from '../../../domain/screener/candidate-record.js';
import { overlapSentence } from '../../../domain/screener/factor-overlap.js';
import { renderScreenerRead, reapplyScreenerNextLead } from '../../components/screener-read.js';
import { selectScreenerState } from '../../../state/selectors/screener.js';
import { FACTOR_LABELS, describeStaleDates } from '../../../domain/screener/row-presentation.js';
import { CONDITIONAL_EVIDENCE_DISCLAIMER, CONDITIONAL_EVIDENCE_VERSION } from '../../../domain/screener/conditional-evidence.js';
import { EVIDENCE_LINEAGE_VERSION } from '../../../domain/screener/evidence-lineage.js';
import { marketRankingMetadata } from '../../../domain/screener/market-scope.js';
import { refreshSharedArtifact } from '../../../data/shared-artifacts.js';
import { renderNextSteps } from '../../components/page-flow.js';
import { signedText, directionOf, finiteNumber as finite } from '../../../domain/shared/number.js';
import { el } from './filters.js';
import { REGIME_DESCRIPTIONS, cell, currentOverlap, scopedRows, selectedValue, text, withThemeStages } from './model.js';
// 개편 v2 (3c/5h): the validation state before the table (amber banner) and the 사후 검증 summary. One reading of the
// same back-test the 과거 검증 panel details: the gate file's status, the net top-minus-bottom spread, the net count of
// rebalances the top fifth led, and whether the sample can decide (12 rebalances and |t| ≥ 2).
export function renderValidationState(documentRef, root, metadata, listingMarket) {
  const banner = documentRef.getElementById('scr-validation-banner');
  const read = readValidationState({ metadata, root, listingMarket });
  if (banner) {
    banner.hidden = false;
    banner.dataset.validationState = read.state;
    // v59.55 (alignment pass): one plain line on every device instead of two jargon chips (검증 요건 미충족, 판단 불가).
    const plain = read.chips.includes('판단 불가') ? '과거 검증으로는 아직 효과를 판단할 수 없습니다' : read.chips.join(', ');
    const chips = documentRef.createElement('span');
    chips.className = 'scr-banner-chips scr-banner-text';
    chips.textContent = `${plain ? `${plain} — ` : ''}순위는 확인할 후보 목록입니다`;
    // v59.51 (content audit): the 순위 view carries the state chips and the link; the sentence is the 사후 검증 hero's.
    banner.title = read.sentence;
    const link = documentRef.createElement('button');
    link.type = 'button';
    link.className = 'sx-link scr-banner-link';
    link.dataset.aioScreenerAction = 'tab';
    link.dataset.aioScreenerArg = 'backtest';
    link.textContent = '검증 보기 ›';
    // v58.56 (4b): the phone shows one line — the state words and what the ranking is — and the line itself opens 사후 검증.
    const short = documentRef.createElement('button');
    short.type = 'button';
    short.className = 'scr-banner-short';
    short.dataset.aioScreenerAction = 'tab';
    short.dataset.aioScreenerArg = 'backtest';
    short.textContent = `${plain ? `${plain} — ` : ''}순위는 확인할 후보 목록 ›`;
    short.title = read.sentence;
    banner.replaceChildren(chips, link, short);
  }
  renderValidationHero({ documentRef, read });
}
export function renderStaleNote(documentRef, body) {
  const table = body?.closest?.('table');
  if (!table) return;
  let note = documentRef.getElementById('scr-stale-note');
  const message = describeStaleDates([...body.querySelectorAll('[data-stale-as-of]')].map((cell) => cell.dataset.staleAsOf));
  if (!message) { if (note) note.hidden = true; return; }
  if (!note) {
    note = documentRef.createElement('div');
    note.id = 'scr-stale-note';
    note.setAttribute('role', 'note');
    note.className = 'scr-stale-note';
    const anchor = table.parentElement && table.parentElement !== body.ownerDocument?.body ? table.parentElement : table;
    anchor.parentElement?.insertBefore(note, anchor);
  }
  note.hidden = false;
  note.textContent = message;
}

export function renderFactorTab(documentRef, metadata) {
  const ranking = metadata?.ranking || {};
  const bars = documentRef.getElementById('scr-factor-bars');
  const weights = ranking.appliedFactorWeights || ranking.activeFactorWeights || {};
  const factors = ranking.activeFactors || [];
  if (bars) {
    bars.replaceChildren();
    const maxWeight = Math.max(1, ...factors.map((key) => Number(weights[key]) || 0));
    factors.forEach((key) => {
      const item = FACTOR_LABELS[key] || { label: key, color: 'var(--text-secondary)', description: '' };
      const row = documentRef.createElement('div');
      row.className = 'scr-factor-row';
      row.title = item.description;
      const label = documentRef.createElement('span');
      label.textContent = item.label;
      label.className = 'scr-factor-label';
      label.style.color = item.color;
      const track = documentRef.createElement('div');
       track.className = 'scr-factor-track';
      const fill = documentRef.createElement('div');
      fill.className = 'scr-factor-fill';
      fill.style.background = item.color;
      fill.style.width = `${Math.round((Number(weights[key]) || 0) / maxWeight * 100)}%`;
      track.appendChild(fill);
      const value = documentRef.createElement('span');
      value.textContent = `${Math.round((Number(weights[key]) || 0) * 100)}%`;
      value.className = 'scr-factor-value';
      row.append(label, track, value);
      bars.appendChild(row);
    });
    if (!factors.length) bars.appendChild(text(documentRef, '활성 팩터 없음 — 서버 산출물 미수신'));
  }
  const regime = ranking.activeFactorRegime || '중립';
  const regimeNode = documentRef.getElementById('screener-regime-note');
  if (regimeNode) regimeNode.textContent = regime;
  const desc = documentRef.getElementById('scr-regime-desc');
  if (desc) desc.textContent = REGIME_DESCRIPTIONS[regime] || '검증·승인 전에는 중립 고정 가중치를 적용하고 국면 틸트는 후보 진단으로만 표시합니다.';
  const confidenceNode = documentRef.getElementById('screener-factor-confidence');
  if (confidenceNode) {
    const confidence = finite(ranking.confidence);
    const composite = finite(ranking.compositeConfidence);
    // D9 (2026-10-17 audit): the run's input status in words, not the model's enum.
    const status = ({ ready: '정상', partial: '일부 제한', unavailable: '계산 불가' })[ranking.qualityStatus] || '계산 불가';
    confidenceNode.textContent = confidence == null
      ? '입력 신뢰도 산출 불가 — 미래 수익률 확률이 아닙니다.'
      : `행 근거 평균 ${Math.round(confidence * 100)}%, 횡단면 진단 ${composite == null ? '—' : `${Math.round(composite * 100)}%`}, 품질 ${status}, 미래 수익률 확률 아님`;
  }
  const diagnosticsNode = documentRef.getElementById('screener-factor-diagnostics');
  if (diagnosticsNode) {
    const sector = ranking.sectorNeutrality || {};
    const outliers = ranking.outlierDiagnostics || {};
    const turnover = ranking.turnoverStability || {};
    const regimeStability = ranking.regimeStability || {};
    // LC-41: Number(null) === 0 and Number.isFinite(0) === true, so a missing diagnostic rendered
    // as a measured zero ("상위군 회전 null%", "(0개 그룹)"). A count is only a count when the
    // producer actually sent a number — null/'' stay unmeasured.
    const countOrNull = (value) => (value == null || value === '' || typeof value === 'boolean') ? null : finite(Number(value));
    const sectorGroups = countOrNull(sector.groups);
    const sectorUnknown = countOrNull(sector.unknownRows);
    const outlierCount = countOrNull(outliers.totalOutliers);
    const turnoverPct = countOrNull(turnover.turnoverPct);
    const parts = [
      `섹터 중립 ${({ observed: '적용', partial: '일부 적용', unavailable: '확인 불가' })[sector.status] || '미확인'}${sectorGroups != null ? ` (${sectorGroups}개 그룹${sectorUnknown ? `, 미분류 ${sectorUnknown}` : ''})` : ''}`,
      `극단치 완화 ${outlierCount != null ? `${outlierCount}건` : '미확인'}`,
      // D10 (2026-10-17 audit): no caller supplies a prior ranking or regime snapshot, so these two read
      // '이전 스냅샷 없음' on every visit. They appear only when they were actually measured.
      turnover.status === 'observed' && turnoverPct != null ? `상위군 회전 ${turnoverPct}%` : null,
      ['stable', 'transition'].includes(regimeStability.status) ? `국면 안정성 ${regimeStability.status === 'stable' ? '유지' : '전환'}` : null
    ].filter(Boolean);
    diagnosticsNode.textContent = `${parts.join(', ')}, 연구용 상대 순위이며 매매 신호/자동 가중 승격에 사용하지 않습니다.`;
    diagnosticsNode.dataset.decisionEligible = String(ranking.researchBoundary?.decisionEligible === true);
  }
}

// P1443 (review 2026-10-04): one validation view. The legacy SVG under this panel read '계산 불가' while
// the same artifact carried ICs; it is removed. Shown here: per-factor and composite IC (Spearman rank
// correlation between the ranking and the next 21 sessions' return), the top-minus-bottom quintile spread
// gross and net of cost on the same ±1 exposure, how many rebalances the top quintile actually beat the
// bottom (not a per-stock direction accuracy), the 10-year 120-stock study, and what the result means.
export function renderBacktest(documentRef, metadata, root = globalThis, rows = null) {
  const panel = documentRef.getElementById('screener-backtest-panel');
  if (!panel) return;
  panel.replaceChildren();
  const el = (tag, text, className) => { const node = documentRef.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  if (metadata?.selectionMarket === 'KR') {
    panel.append(el('p', '한국 시장 전용 사후 검증은 아직 없습니다. 미국/혼합 시장의 검증 수치를 한국 순위의 검증으로 표시하지 않습니다.', 'scr-empty-state'));
    return;
  }
  const backtest = metadata?.backtest;
  const hasObservedIC = backtest?.ic && Object.values(backtest.ic).some((value) => finite(value) != null);
  if (!hasObservedIC) {
    const message = el('div', '검증 데이터 없음', 'scr-empty-state');
    message.dataset.statusCode = 'NO_BACKTEST_DATA';
    if (metadata?.detail) message.appendChild(el('div', metadata.detail, 'scr-empty-detail'));
    panel.appendChild(message);
    return;
  }
  const ic = backtest.ic || {};
  // P1449: the "same calculation" claim must be proven by the stored model fingerprint, not by
  // prose — a hand-written parity sentence drifted from the applied weights once (37.0/27.4/
  // 21.9/13.7 vs 39.0/28.0/22.0/11.0 renormalized) while both claimed one model.
  const fingerprintMatches = backtest.modelFingerprint != null ? backtest.modelFingerprint === liveScreenerModelFingerprint(metadata?.ranking?.appliedFactorWeights) : false;
  const composite = finite(ic.composite);
  const net = finite(backtest.quantileSpreadNet);
  const gross = finite(backtest.quantileSpread);
  const rebalances = finite(backtest.rebalancesCounted) ?? (Array.isArray(backtest.rebalanceDates) ? backtest.rebalanceDates.length : null);
  // v57.81: one count basis with the reading above (summarizeValidation uses netHitRate) — net of cost, named as such.
  // A record without the net rate shows the gross count labelled 비용 전, never unlabelled.
  const netWinRate = finite(backtest.netHitRate);
  const winBasis = netWinRate != null ? '비용 후' : '비용 전';
  const winRate = netWinRate ?? finite(backtest.hitRate);
  const wins = winRate != null && rebalances ? Math.round(winRate / 100 * rebalances) : null;
  // 2026-10-13 review S05: the fingerprint proves the factor definition and weights; the IC/spread sample itself
  // pools the US and KR rows (n=986), so the sentence names the pooled sample instead of claiming one population.
  const parity = fingerprintMatches ? `현재 화면 순위와 같은 모델(같은 팩터 정의, 같은 가중 지문)로 과거 시점을 다시 매긴 결과입니다 — 순위는 시장별로 매기지만 IC·분위 수익률은 미국·한국 합산 표본(${backtest.n ?? '—'}종목)입니다`
    : backtest.modelFingerprint == null ? '이 검증 기록은 계산 방식 기록이 생기기 전에 만들어져 지금 화면 순위와 같은 모델인지 확인할 수 없습니다 — 지금 순위의 검증으로 읽지 않습니다(다음 데이터 갱신부터 지문이 붙습니다)'
      : '저장된 검증 기록의 계산 방식이 지금 화면 순위와 다릅니다(다른 가중치 프로필이거나 이전 모델) — 이 기록은 지금 순위의 검증으로 읽지 않습니다';
  const verdict = composite == null ? '종합 IC가 계산되지 않았습니다.'
    : composite > 0.03 && net != null && net > 0 ? `최근 ${rebalances ?? '—'}번의 시점에서 순위가 다음 21거래일 수익률과 약하게 같은 방향(IC ${composite.toFixed(3)})이었고 상위 20%가 하위보다 비용 후 ${net.toFixed(2)}% 앞섰습니다. 표본이 작아 우연과 구분되지는 않습니다.`
      : `최근 ${rebalances ?? '—'}번의 시점에서 순위와 이후 수익률의 관계가 확인되지 않았습니다(종합 IC ${composite.toFixed(3)}, 상위−하위 비용 후 ${net == null ? '—' : `${net.toFixed(2)}%`}). 이 실험에서 순위의 우월성이 보이지 않았다는 뜻이며, 전략이 영구히 무효라는 증명은 아닙니다.`;
  panel.append(el('p', verdict, 'briefing-read-headline'), el('p', parity, 'theme-strength-basis'));
  const labels = { momentum: '모멘텀', trend: '추세', lowvol: '저변동', kalman: '추세 속도', composite: '종합 순위' };
  const bars = el('div', null, 'scr-ic-bars');
  // v59.69 (visual audit): half the track is 0.2 unless a value is larger — a larger IC used to clip silently at the edge.
  const icMax = Math.max(0.2, ...Object.keys(labels).map((key) => Math.abs(finite(ic[key]) ?? 0)));
  for (const [key, label] of Object.entries(labels)) {
    const value = finite(ic[key]);
    const line = el('div', null, 'scr-ic-row');
    const track = el('div', null, 'scr-ic-track');
    const dir = directionOf(value, 3);
    const fill = el('span', null, `scr-ic-fill ${dir === 'up' ? 'is-up' : dir === 'down' ? 'is-down' : ''}`);
    if (dir) { fill.style.width = `${Math.min(50, Math.abs(value) / icMax * 50).toFixed(1)}%`; fill.style[dir === 'up' ? 'left' : 'right'] = '50%'; }
    track.append(fill);
    line.append(el('span', label, 'scr-ic-label'), track, el('span', signedText(value, 3, '', { plus: false }), 'scr-ic-value'));
    bars.append(line);
  }
  panel.append(bars);
  const facts = el('dl', null, 'regime-evidence');
  const add = (k, v) => facts.append(el('dt', k), el('dd', v));
  add('상위−하위 20% (21거래일)', `비용 전 ${gross == null ? '—' : `${gross.toFixed(2)}%`}, 비용 후 ${net == null ? '—' : `${net.toFixed(2)}%`} (같은 ±1 노출 기준)`);
  add('상위가 하위를 앞선 횟수', wins == null ? '—' : `${winBasis} 기준 ${rebalances}번 중 ${wins}번 — 종목별 방향 적중률이 아니라 분위 수익률 차이가 양수였던 리밸런스의 비율입니다`);
  add('표본', `미국·한국 합산 ${backtest.n ?? '—'}종목, 리밸런스 ${rebalances ?? '—'}회, 현재 종목 구성(생존 편향), 거래비용은 가정값`);
  add('검증하지 않은 요인', (backtest.modelParity?.notValidated || backtest.excludedFactors || ['size', 'value, quality']).join(', '));
  add('가중치', `${backtest.weightRegime || 'NEUTRAL'} 고정 — 국면 틸트 후보는 검증·적용되지 않음`);
  add('겹치는 근거', `${overlapSentence(currentOverlap(rows, metadata?.ranking))} 가중치는 바꾸지 않았습니다 — 겹침을 줄인 모델은 다른 모델이라 실제 순위 기록으로 따로 검증해야 합니다.`);
  panel.append(facts);
  const longrun = root?._aioFactorLongrun;
  const ref = longrun?.walkForward?.referencePeriod?.ic?.composite;
  const hold = longrun?.walkForward?.holdout?.ic?.composite ?? longrun?.walkForward?.holdoutPeriod?.ic?.composite;
  const fwd21 = longrun?.overallByHorizon?.fwd21d?.ic?.composite;
  if (longrun) {
    panel.append(el('p', `10년 연구(시가총액 상위 현재 생존 ${longrun.universe?.fullUniverseSize ?? 120}종목, 이전 모델): 21거래일 종합 IC ${fwd21 == null ? '—' : Number(fwd21).toFixed(3)}, 기준 기간 ${ref == null ? '—' : Number(ref).toFixed(3)}, 검증 기간(holdout) ${hold == null ? '—' : Number(hold).toFixed(3)}. 기간이 길어도 현재 살아남은 대형주만 담은 실험이라 검증된 전략이라고 부를 수 없습니다.`, 'theme-strength-basis'));
  }
  renderCandidateRecord(panel, el, root?._aioCandidateArchive, metadata?.populationRanking || metadata?.ranking);
}

// P1465: the forward record — what the default ranking listed each session, measured 21 of each
// stock's own sessions later. Unlike the back-test, the list was written before the outcome existed.
function renderCandidateRecord(panel, el, archive, populationRanking) {
  const box = el('section', null, 'scr-candidate-record');
  box.append(el('h3', '실제 순위 기록 — 앞으로 쌓이는 검증', 'stock-read-vis-title'));
  if (!archive || !Array.isArray(archive.entries)) { box.append(el('p', '기록 파일을 아직 받지 못했습니다.', 'theme-strength-basis')); panel.append(box); return; }
  const summary = summarizeCandidateArchive(archive);
  const measured = measuredCandidateEntries(archive, 30);
  // The record pools both markets under one identity of every market's model; compare it with the same population.
  const liveIdentity = populationRanking?.appliedFactorWeights || populationRanking?.byMarket ? buildPopulationRankingIdentity(populationRanking) : null;
  const sameModel = summary.identity && liveIdentity ? summary.identity === liveIdentity : null;
  if (!summary.recorded) {
    box.append(el('p', '첫 기록은 다음 스크리너 갱신에서 시작됩니다. 매 거래일 기본 순위의 상위·하위 20%를 먼저 적어 두고, 21거래일 뒤 실제 수익률을 채웁니다.', 'theme-strength-basis'));
  } else if (!summary.measured) {
    box.append(el('p', `${summary.firstDate}부터 ${summary.recorded}일 기록 중 — 아직 21거래일이 지난 기록이 없어 결과가 없습니다. 첫 결과는 첫 기록 후 21거래일(약 한 달) 뒤에 나옵니다.`, 'briefing-read-headline'));
  } else {
    const spread = summary.meanSpreadPct;
    const vsAll = summary.meanTopVsUniversePct;
    const ind = summary.independent;
    if (ind) {
      const ic = (stat) => (stat?.mean == null ? '—' : `${signedText(stat.mean, 3)}${stat.t != null ? ` (t ${stat.t.toFixed(1)})` : ''}`);
      const verdict = ind.decision === 'supported' ? '미국 순위가 다음 21거래일 수익률과 통계적으로 같은 방향이었습니다.'
        : ind.decision === 'not-supported' && ind.icUS?.mean < 0 && ind.icUS?.t <= -2 ? `겹치지 않는 기록 ${ind.icUS.n ?? ind.n}개로 보면 미국 순위가 이후 수익률과 오히려 반대 방향이었습니다 — 순위를 매수 후보 근거로 쓰지 마세요.`
        : ind.decision === 'not-supported' ? `겹치지 않는 기록 ${ind.icUS?.n ?? ind.n}개로 보면 미국 순위와 이후 수익률의 관계가 우연과 구분되지 않습니다 — 순위를 매수 후보 근거로 쓰지 마세요.`
          : `기간이 겹치지 않는 기록이 ${Math.min(ind.n || 0, ind.icUS?.n ?? ind.n ?? 0)}개라 판단하지 않습니다(${ind.min}개부터 판단, 약 1년).`;
      box.append(el('p', `검증 판정: ${verdict} 순위 정보계수(IC, 순위와 이후 수익률의 순위상관) — 미국 ${ic(ind.icUS)}, 한국 ${ic(ind.icKR)}.`, 'briefing-read-headline'));
    }
    box.append(el('p', `결과가 나온 ${summary.measured}일 평균: 상위 20%가 하위 20%보다 ${signedText(spread, 2)}%p, 전체 평균보다 ${signedText(vsAll, 2)}%p(21거래일, 비용 제외). 상위가 전체를 앞선 날은 ${summary.measured}일 중 ${summary.topBeatUniverse}일입니다.${summary.measured < 20 ? ' 아직 날 수가 적고 이어지는 날끼리 기간이 겹쳐, 우연과 구분할 수 없습니다.' : ' 이어지는 날끼리 21거래일 기간이 겹쳐 독립된 표본 수는 날 수보다 훨씬 적습니다.'}`, 'briefing-read-headline'));
    const bars = el('div', null, 'scr-ic-bars');
    const max = Math.max(1, ...measured.map((entry) => Math.abs(entry.outcome.topVsUniversePct || 0)));
    for (const entry of measured.slice(-12)) {
      const value = entry.outcome.topVsUniversePct;
      const line = el('div', null, 'scr-ic-row');
      const track = el('div', null, 'scr-ic-track');
      const dir = directionOf(value, 2);
      const fill = el('span', null, `scr-ic-fill ${dir === 'up' ? 'is-up' : dir === 'down' ? 'is-down' : ''}`);
      fill.style.width = dir ? `${Math.min(50, Math.abs(value) / max * 50).toFixed(1)}%` : '0%';
      if (dir) fill.style[dir === 'up' ? 'left' : 'right'] = '50%';
      track.append(fill);
      line.append(el('span', entry.date.slice(5), 'scr-ic-label'), track, el('span', `${signedText(value, 2)}%p`, 'scr-ic-value'));
      bars.append(line);
    }
    box.append(bars, el('p', '막대 = 그날 기록한 상위 20%의 21거래일 수익률 − 같은 날 순위가 매겨진 전체 평균', 'theme-strength-basis'));
  }
  const notes = ['기본 가중 순위로 기록합니다'];
  if (sameModel === false) notes.push('지금 화면의 순위 모델(선택한 프로필의 가중치나 계산에 들어간 팩터)이 기록한 모델과 달라, 이 기록은 지금 화면 순위의 검증이 아닙니다');
  if (summary.sameModelRecorded < summary.recorded) notes.push(`모델이 바뀐 뒤의 ${summary.sameModelRecorded}일만 평균에 넣었습니다`);
  notes.push('종목마다 자기 시장의 거래일로 21일을 세고, 수정주가 기준·같은 비중·거래비용 제외입니다');
  box.append(el('p', `${notes.join(', ')}.`, 'theme-strength-basis'));
  panel.append(box);
}

export function renderConditionalEvidence(documentRef, metadata) {
  const panel = documentRef.getElementById('screener-conditional-evidence-panel');
  if (!panel) return;
  panel.replaceChildren();
  const evidence = metadata?.conditionalEvidence;
  const researchContext = metadata?.researchContext || {};
  const evidenceContractValid = evidence && typeof evidence === 'object'
    && evidence.version === CONDITIONAL_EVIDENCE_VERSION
    && evidence.lineageVersion === EVIDENCE_LINEAGE_VERSION
    && evidence.decisionEligible === false
    && evidence.sample && typeof evidence.sample === 'object'
    && (evidence.lineage?.status === 'CURRENT_CANDIDATE' || evidence.status === 'NO_DATA');
  const statusLabels = {
    READY: '연구용 표시 가능',
    LOW_SAMPLE: '표본 경고',
    LOW_SAMPLE_BLOCKED: '표본 부족으로 보류',
    // v59.45 (P6-STAT-01): overlapping, open or reversed outcome windows are not independent trials.
    INDEPENDENCE_UNVERIFIED: '결과 기간 확인 안 돼 보류',
    BLOCKED: '출처·이용 권리·거래 세션 확인 안 됨',
    NO_DATA: '검증 자료 없음'
  };
  const status = statusLabels[evidenceContractValid ? evidence.status : evidence ? 'BLOCKED' : 'NO_DATA'] || '조건별 통계 미수신';
  panel.dataset.statusCode = evidenceContractValid ? evidence.status : evidence ? 'BLOCKED' : 'NO_CONDITIONAL_EVIDENCE';
  // v59.56 (screen review): with no conditional statistics at all, the card was an empty '검증 자료 없음' box in 사후 검증;
  // it stays out of the view until a statistic exists (a blocked one still shows why it is withheld).
  panel.closest?.('#scr-tab-evidence')?.classList.toggle('is-empty', !evidence);
  const header = documentRef.createElement('div');
  header.className = 'scr-evidence-header';
  const title = documentRef.createElement('strong');
  title.textContent = evidence?.conditionLabel || '이 조건의 검증 자료';
  title.style.color = 'var(--text-secondary)';
  const badge = documentRef.createElement('span');
  badge.textContent = status;
  badge.className = `scr-evidence-badge ${evidence?.status === 'READY' ? 'scr-tone-up' : 'scr-tone-warn'}`;
  header.append(title, badge);
  panel.appendChild(header);
  if (!evidenceContractValid) {
    const message = documentRef.createElement('div');
    message.className = 'scr-empty-state';
    message.dataset.statusCode = evidence ? 'BLOCKED' : 'NO_CONDITIONAL_EVIDENCE';
    // Codex browser audit H47: the empty state spoke in pipeline terms (artifact, lineage, PIT). The reader is told
    // what this tab would show and why it is empty; pipeline identifiers move to the hover title.
    message.textContent = evidence ? '이 조건의 과거 통계가 검증을 통과하지 못해 표시하지 않습니다' : '이 조건의 과거 발생 빈도 통계는 아직 제공하지 않습니다';
    const detail = documentRef.createElement('div');
    detail.className = 'scr-empty-detail';
    detail.title = `파이프라인 ${researchContext.pipelineVersion || 'market-evidence-pipeline.v1'}`;
    detail.textContent = evidence
      ? '자료 버전·출처·이용 권리·거래 세션 정보가 모두 맞을 때만 통계를 보여 줍니다. 지금 스크리너 값으로 대신 계산하지 않습니다.'
      : '분 단위 가격과 거래 세션 자료가 연결되면, 같은 조건이 과거에 몇 번 나타나 몇 번 맞았는지를 표본 수와 신뢰 구간으로 보여 줍니다. 지금 스크리너 값으로 확률을 대신 계산하지 않습니다.';
    detail.title += `, lineage ${researchContext.evidenceLineageVersion || EVIDENCE_LINEAGE_VERSION}`;
    message.appendChild(detail);
    panel.appendChild(message);
    return;
  }
  const query = documentRef.createElement('div');
  query.className = 'scr-evidence-query';
  // v57.77: plain words on screen; the source ids move to the hover title (sources stay off the numbers).
  query.textContent = `조건: ${evidence.queryEcho || '조건 내용 미수신'}, 마지막 관측: ${evidence.lastObservedAt ? String(evidence.lastObservedAt).slice(0, 16).replace('T', ' ') : '—'}`;
  query.title = `자료 출처 ${evidence.lineage?.sourceIds?.join(', ') || '—'}`;
  panel.appendChild(query);
  const grid = documentRef.createElement('div');
  grid.className = 'scr-evidence-grid';
  const sample = evidence.sample || {};
  // A rate over windows that are not independent (or not yet closed) is not shown as a hit rate.
  const withheld = evidence.status === 'INDEPENDENCE_UNVERIFIED';
  const ci = withheld ? null : sample.confidenceInterval;
  const metricValues = [
    ['나타난 횟수', sample.trials ?? '—'],
    ['맞은 횟수', withheld ? '—' : (sample.successes ?? '—')],
    ['맞은 비율', withheld || sample.estimate == null ? '—' : `${(sample.estimate * 100).toFixed(1)}%`],
    ['95% 범위', ci ?`${(ci.low * 100).toFixed(1)}~${(ci.high * 100).toFixed(1)}%` : '—']
  ];
  metricValues.forEach(([label, value]) => {
    const card = documentRef.createElement('div');
    card.className = 'scr-evidence-card';
    const name = documentRef.createElement('div');
    name.textContent = label;
    name.className = 'scr-evidence-label';
    const result = documentRef.createElement('strong');
    result.textContent = String(value);
    result.className = 'scr-evidence-result';
    card.append(name, result);
    grid.appendChild(card);
  });
  panel.appendChild(grid);
  const details = documentRef.createElement('div');
  details.className = 'scr-evidence-details';
  const stability = evidence.stability || {};
  const recency = evidence.recency || {};
  const distribution = evidence.distribution || {};
  // v57.77: plain Korean on screen; the pipeline identifiers (lineage status, rights/calendar ids, allowed use) go to the hover title.
  details.textContent = `앞·뒤 절반 기간의 결과가 비슷한지 ${stability.status || '—'}${stability.intervalOverlap == null ? '' : `, 두 기간의 범위 겹침 ${stability.intervalOverlap ? '예' : '아니오'}`}, 최근 나타난 횟수 ${recency.trials ?? '—'}, 최근 맞은 비율 ${recency.estimate == null ? '—' : `${(recency.estimate * 100).toFixed(1)}%`}, 맞은 경우의 결과 하위 25%/중앙/상위 25% ${[distribution.p25, distribution.median, distribution.p75].map((value) => value == null ? '—' : Number(value).toFixed(3)).join(' / ')}, 제외 ${evidence.excludedObservationCount ?? 0}건`;
  panel.appendChild(details);
  const boundary = documentRef.createElement('div');
  boundary.className = 'scr-evidence-boundary';
  boundary.textContent = `참고용 통계, ${evidence.blockedReasons?.length ? `보류 사유 ${evidence.blockedReasons.length}건` : evidence.lineage?.status === 'CURRENT_CANDIDATE' ? '자료 출처·이용 권리·거래 세션 확인됨' : '자료 출처 확인 전'}`;
  // v57.79: lineage tokens are machine metadata, not reader text ([title] becomes a visible basis card).
  boundary.dataset.aioLineage = `${evidence.lineage?.status || 'LINEAGE_UNCONFIRMED'}, 권리 ${evidence.lineage?.rightsIds?.join(', ') || '미확인'}, 캘린더 ${evidence.lineage?.calendarIds?.join(', ') || '미확인'}, ${evidence.allowedUse || 'reference-only'}${evidence.blockedReasons?.length ? `, ${evidence.blockedReasons.join(', ')}` : ''}`;
  panel.appendChild(boundary);
  const disclaimer = documentRef.createElement('div');
  disclaimer.className = 'scr-evidence-disclaimer';
  disclaimer.textContent = evidence.disclaimer || CONDITIONAL_EVIDENCE_DISCLAIMER;
  panel.appendChild(disclaimer);
}

/** The ranking reading and the validation artifacts read once per mount. */
export function createValidationController(ctx) {
  const { documentRef, root, store, page, bag, workbench, sortState, visibleLimit, columnState, selectedSymbols, compareSymbols, liveReader, watchlistReader, profileReader, onWatchlistToggle, onProfileChange, onUniverseScopeChange } = ctx;
      // P1437: the lead reading of the ranking — recomputed only when the ranked set or validation changes.
      ctx.readSignature = '';
      // v58.63 (architecture audit UI-03): the signature samples only the first five ranks, so new rows with the same top
      // five (other top-quintile trend/high data changed) kept the old reading. The store replaces the rows array on
      // every update; a different array is a different input.
      let readRowsRef = null;
      ctx.renderRead = () => {
        const sourceRows = selectScreenerState(store?.getState?.() || {})?.rows || [];
        const rows = scopedRows(sourceRows, selectedValue(documentRef, 'scr-listing-market') || 'US');
        const signature = `${selectedValue(documentRef, 'scr-listing-market')}|${root?._aioScenarioState?.status || ''}:${root?._aioScenarioState?.generatedAt || ''}|${rows.length}|${rows.slice(0, 5).map((row) => `${row?.sym}:${row?.screenRank}`).join(',')}|${(root?._aioScreenerBacktestHistory || []).length}|${(root?._aioHistory || []).length}|${Object.keys(root?._serverDataMeta?.rotationHistory?.items || {}).length}`;
        if (signature === ctx.readSignature && sourceRows === readRowsRef) return;
        ctx.readSignature = signature;
        readRowsRef = sourceRows;
        const listingMarket = selectedValue(documentRef, 'scr-listing-market') || 'US';
        const validation = documentRef.getElementById('screener-validation');
        if (validation) validation.hidden = listingMarket === 'KR';
        if (listingMarket === 'KR') {
          const host = documentRef.getElementById('screener-read');
          if (host) {
            const heading = documentRef.createElement('h2'); heading.className = 'briefing-h2'; heading.textContent = '한국 종목끼리 비교하는 순위';
            const note = documentRef.createElement('p'); note.textContent = `한국 상장 ${rows.length}종목을 독립 비교합니다. 팩터 비중·데이터 범위는 아래에 표시하며 미국 업종 회전과 과거 검증을 이 순위의 근거로 섞지 않습니다.`;
            host.replaceChildren(heading, note);
          }
          // v58.80 (first-users bundle 8): the 순위 view kept the US reading ("순위 계산 810종목 … 기술·산업재 쏠림") over the KR table.
          const rankRead = documentRef.getElementById('screener-rank-read');
          if (rankRead) { rankRead.hidden = true; rankRead.textContent = ''; }
          // v57.50 I22: the KR ranking also continues somewhere — the Korean themes it sits in and its first name
          // (the table-lead sync below re-points the ticker link to the filtered table's first row).
          const ranked = rows.filter((row) => finite(row?.screenRank) != null).sort((a, b) => a.screenRank - b.screenRank);
          const lead = ranked[0] || null;
          renderNextSteps(documentRef, documentRef.getElementById('screener-next'), [
            { route: 'themes', label: '한국 테마', why: '상위권 한국 종목이 몰린 테마가 확정 종가 기준으로 어떻게 움직였는지', ctx: { anchor: 'kr-integrated-themes' } },
            ...(lead ? [{ action: 'showTicker', arg: lead.sym, route: 'ticker', label: `순위 맨 앞 ${lead.sym}`, why: `${lead.name || lead.sym} — 한국 순위 맨 앞 종목을 개요·차트·재무로 확인(검증 전이라 후보로 읽음)` }] : [])
          ]);
          reapplyScreenerNextLead(documentRef);
        } else {
          const next = documentRef.getElementById('screener-next'); if (next) next.hidden = false;
          renderScreenerRead({ documentRef, root, rows: withThemeStages(root, rows) });
        }
      };
      // 2026-10-14 audit #5: theme stage rows for the reading's "상위권의 테마 단계" (nothing renders until status is ok).
      // v58.75: the table's 테마 단계 column reads the same state, so the table redraws too.
      refreshSharedArtifact(root, SCENARIO_STATE).then(({ changed }) => { if (changed && ctx.mountActive) { ctx.readSignature = ''; ctx.renderRead(); ctx.renderNow(); } }).catch(() => {});
      // P1419: post-hoc validation of the default ranking (small daily artifacts, read once per mount).
      renderScreenerValidation({ documentRef, root });
      {
        const fetchFn = root?.fetch || globalThis.fetch;
        if (typeof fetchFn === 'function') {
          Promise.all([
            loadArtifact(root, 'backtest-history.json').catch(() => null),
            loadArtifact(root, 'model-validation-status.json').catch(() => null),
            loadArtifact(root, 'factor-backtest-longrun.json').catch(() => null),
            loadArtifact(root, 'screener-candidate-archive.json').catch(() => null),
            // 개편 v2 (3c/5h): the validation gate's status and blockers drive the banner before the table.
            loadArtifact(root, 'screener-validation-gate.json').catch(() => null)
          ]).then(([history, status, longrun, candidates, gate]) => {
            if (gate && typeof gate === 'object') root._aioScreenerValidationGate = gate;
            if (candidates && typeof candidates === 'object') root._aioCandidateArchive = candidates; // P1465: forward candidate record
            if (Array.isArray(history)) root._aioScreenerBacktestHistory = history;
            if (status && typeof status === 'object') root._aioModelValidationStatus = status;
            if (longrun && typeof longrun === 'object') root._aioFactorLongrun = longrun; // P1443: 10-year study shown with its limits
            if (ctx.mountActive) {
              renderScreenerValidation({ documentRef, root }); ctx.readSignature = ''; ctx.renderRead();
              // The 10-year study and the candidate record arrive after the first render of the 검증 view.
              const latest = selectScreenerState(store?.getState?.() || {});
              renderBacktest(documentRef, { ...latest?.metadata, populationRanking: latest?.metadata?.ranking || null, selectionMarket: selectedValue(documentRef, 'scr-listing-market') || 'US', ranking: marketRankingMetadata(latest?.metadata, selectedValue(documentRef, 'scr-listing-market') || 'US') }, root, scopedRows(latest?.rows || [], selectedValue(documentRef, 'scr-listing-market') || 'US'));
              renderValidationState(documentRef, root, latest?.metadata, selectedValue(documentRef, 'scr-listing-market') || 'US');
            }
          });
        }
      }
}
