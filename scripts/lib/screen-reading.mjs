// The per-screen AI reading (owner 2026-11-18, text architecture). Facts — figures, state labels, the close date —
// are the code's, in its fixed vocabulary; the reading that connects them is written by the shared model once per change
// of a screen's facts, checked here, and published only when it passes. Pure functions: the producer
// (scripts/producer/screen-readings.mjs) brings the interpretation, the published artifacts and the requester.
//
// The fact packet is built from the same domain functions the screens draw (the shared interpretation of
// scripts/lib/market-interpretation-inputs.mjs interpretationFromArtifacts — the browser builds the same object through
// src/data/selectors/interpretation.js — and, per screen, the model its board renders). A packet carries titles, state
// labels, evidence rows, flip conditions and bases; a sentence the code assembled never enters it. A screen joins the
// readings by adding one builder to SCREEN_READING_SCREENS. The instruction, the prompt shape and the figure check are
// shared with the browser's per-subject readings (src/ai/reading/reading-core.js).
//
// Interpretation is never blocked. The validator blocks a figure or date the packet does not carry, a
// state label that contradicts the packet's, an order, an invented percentage probability, a leaked prompt label,
// non-Korean text and a reading longer than the face allows; thin grounds and possibility words are warnings only.
import { createHash } from 'node:crypto';
import { isIsoDay } from '../../src/domain/shared/session-date.js';
import { readNumber as finite, signedText } from '../../src/domain/shared/number.js';
import { analysisInterpretationWarnings, axisStateClaimIssues, PROMPT_SECTION_LABEL, publishedTextIssues, sessionMoveIssues, validateAnalysisAdmission } from './market-analysis-validate.mjs';
import { buildSentimentModel } from '../../src/domain/market/sentiment/sentiment-model.js';
import { buildMarketOpening, openingFactLines, DIAGNOSIS_WORDS } from '../../src/domain/market/story/market-story.js';
import { REBOUND_WORDS } from '../../src/domain/market/story/rebound.js';
import { SCREEN_STORY } from '../../src/domain/market/story/screen-story.js';
import { indexChartReadings, chartsConclusion, indexVolumeRead } from '../../src/domain/technical/market-charts.js';
import { rallyAttemptRead } from '../../src/domain/market/regime/rally-attempt.js';
import { buildRatesFx } from '../../src/domain/macro/rates-fx.js';
import { channelClaimLines } from '../../src/domain/news/channel-claims.js';
import {
  READING_CONDITIONAL, READING_MAX_CHARS, READING_MIN_CHARS, READING_RULES, READING_SECTIONS, buildReadingPrompt, buildReadingRetryPrompt,
  coreReadingIssues, coreReadingWarnings, normalizeReading, packetFigures, unsupportedFigures
} from '../../src/ai/reading/reading-core.js';

export { packetFigures, unsupportedFigures };
export const SCREEN_READING_SCHEMA = 'screen-readings.v1';
export const SCREEN_READING_MAX_CHARS = READING_MAX_CHARS; // at most two blocks of 130–230 characters (시장 상태: three, reading-limits.js)
export const SCREEN_READING_MIN_CHARS = READING_MIN_CHARS;

const md = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const pct = (value, digits = 1) => `${signedText(value, digits)}%`;
// A row marked (참고) is shown beside an axis but does not judge it (공포·탐욕 on the credit axis). It is left out: it is not
// what the verdict rests on, and the history revises it within the day (F&G 25 → 26 → 27 for the 11/17 close across the
// 11/18 refreshes), which would re-key the packet and call the model again for a figure the verdict ignores.
const evidenceText = (evidence) => (Array.isArray(evidence) ? evidence : []).filter((row) => Array.isArray(row) && row[1] != null && row[1] !== '' && !/\(참고\)/.test(String(row[0])))
  .map(([label, value]) => `${label} ${value}`).join('; ');
const LEADERSHIP_STATE = Object.freeze({ break: '주도 영역(반도체·AI) 이탈 확인', weak: '주도 영역(반도체·AI) 약세, 시장 전체 확산은 미확인', holding: '주도 영역(반도체·AI) 유지' });

/** One axis as a fact line: title, state label, evidence rows, the flip condition and its basis when it is not the screen's. */
function axisLine(axis, asOf) {
  if (!axis?.title || !axis.stateLabel) return null;
  const basis = axis.basis && axis.basis !== md(asOf) ? ` (기준 ${axis.basis})` : axis.asOf && /^\d{4}-\d{2}/.test(axis.asOf) && axis.asOf.slice(0, 10) !== asOf ? ` (기준 ${axis.asOf.slice(0, 7)})` : '';
  const evidence = evidenceText(axis.evidence);
  return `${axis.title}: ${axis.verdictLabel || axis.stateLabel}${basis}${evidence ? ` · 근거: ${evidence}` : ''}${axis.flip ? ` · 판정이 바뀌는 조건: ${axis.flip}` : ''}`;
}
const countsLine = (counts, total) => {
  if (!counts) return '';
  const parts = [['양호', counts.favorable], ['중립', counts.neutral], ['부담', counts.burden], ['확인 불가', counts.unknown]].filter(([, n]) => Number(n) > 0 || n === 0).filter(([label, n]) => label !== '확인 불가' || n > 0);
  return `${total}개 지표 중 ${parts.map(([label, n]) => `${label} ${n}`).join(' · ')}`;
};
const usAxes = (regime) => (regime?.axes || []).filter((axis) => axis && axis.id !== 'korea'); // the counted six (market-read.js)
const statesOf = (axes) => Object.fromEntries(axes.filter((axis) => axis?.id && axis.state).map((axis) => [axis.id, axis.state]));
const titledStates = (axes) => axes.filter((axis) => axis?.title && axis.stateLabel).map((axis) => ({ id: axis.id, title: axis.title, stateLabel: axis.stateLabel }));
const historyOf = (interpretation) => (Array.isArray(interpretation?.inputs?.history) ? interpretation.inputs.history : []);
// `session`: the latest session's ledger, after-close prints and filing summaries ({ day, afterHours, briefs }), when the producer read them.
// The regime and the release calendar give the cross-market rows their axis states and the next inflation release.
const openingOf = (interpretation, longrun, through, session = {}) => buildMarketOpening({ history: historyOf(interpretation), macroHistory: interpretation?.inputs?.macroHistory || null, longrun, through,
  day: session.day || null, afterHours: session.afterHours || null, briefs: session.briefs || null, regime: interpretation?.regime || null, events: interpretation?.events || [] });
const leadershipLine = (regime) => (LEADERSHIP_STATE[regime?.leadership?.state] ? `주도주 흐름: ${LEADERSHIP_STATE[regime.leadership.state]}` : '');
// A theme's state label carries its window in parentheses; the head is the state word, the rest the basis.
const stateHead = (theme) => String(theme.stateLabel || theme.state || '').split(/[,(]/)[0].trim();
const themeLine = (theme) => [`${theme.label}: ${theme.stateLabel || theme.state}`,
  finite(theme.ret1m) != null ? `1개월 ${pct(theme.ret1m)}` : '', finite(theme.ret5d) != null ? `5일 ${pct(theme.ret5d)}` : '',
  finite(theme.above50) != null ? `50일선 위 종목 ${Math.round(theme.above50)}%` : '', theme.windText ? `시나리오 바람: ${theme.windText}` : ''].filter(Boolean).join(' · ');
const byRet1m = (list) => [...list].filter((theme) => finite(theme.ret1m) != null).sort((a, b) => b.ret1m - a.ret1m);

// The channels' economic releases against forecast (telegram-digest.json signals) the 매크로 packet carries: the last week's,
// each behind the channel-claim tag (src/domain/news/channel-claims.js), never post text.
const CHANNEL_RELEASE_DAYS = 7;
const daysBefore = (isoDay, days) => new Date(Date.parse(`${isoDay}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);

// ---- the market story every screen reads beside its own facts ------------------------------------------------------------
// A screen's own indicators say little alone: the breadth figures need the session they belong to, the policy axis needs
// where the 2-year prices the path, a theme ranking needs where the latest move gathered. Each screen declares which
// lines of the opening (market-story.js openingFactLines) it reads (`story`, screen-story.js — the screen's fixed tie shows the same ones), and one sentence on how to tie them to its
// own question (`storyGuide`). The lines are the same ones 시장 상태 reads, so two screens cannot tell different days.
const STORY_LINE = Object.freeze({
  session: /^최근 세션: /, gathered: /^최근 세션에 /, spread: /^반등 저점 뒤 갈린 곳: /, split: /^최근 세션 S&P 500 업종별 기여: /,
  credit: /^다른 시장 신용/, dollar: /^다른 시장 달러/, volatility: /^다른 시장 변동성/, rates: /^다른 시장 금리/
});
function storyLinesOf(spec, interpretation, context = {}) {
  const asOf = interpretation?.regime?.asOf;
  if (!spec?.story?.length || !isIsoDay(asOf)) return [];
  const opening = openingOf(interpretation, context.longrun || null, asOf, { day: context.day || null, afterHours: context.data?.afterHours || null, briefs: context.briefs || null });
  if (!opening.available) return [];
  return openingFactLines(opening).filter((line) => spec.story.some((id) => STORY_LINE[id].test(line))).map((line) => `시장 이야기 ${line}`);
}

// ---- the registry: screen id → { name (as the screen is called), guide, facts(interpretation, context) } -----------------
// facts() returns { basis, lines, axes } or null when the screen has nothing to read today. `axes` (id, state, title,
// stateLabel) feed the state-word check; they are not part of the key. `context` carries what the producer reads beside
// the interpretation: { longrun (index-longrun.json), data (data.json), telegram (telegram-digest.json), day (market-day.json), briefs (event-briefs.json) }.
export const SCREEN_READING_SCREENS = Object.freeze({
  signal: Object.freeze({
    name: '시장 상태',
    // The screen opens with the story (주도주 · 시장 전체 · 진단, market-story.js); the reading
    // continues it and says what the price reflects. `guide` is this screen's own instruction, after the shared rules.
    // The chain the owner asked for: the session, where it gathered, whether it spread, whether the other
    // markets confirm it (each with what it means here), what would keep a rebound going. It needs a third block.
    guide: [
      '- 이 화면은 블록을 3개까지 씁니다(블록마다 3~5문장 130~230자). 한 줄기로 잇습니다: 무슨 일이 있었나(최근 세션) → 어디에 몰렸나(테마·큰 종목) → 시장 전체로 번졌나(업종별 기여·시장 폭) → 다른 시장이 확인하나(신용·달러·변동성·금리를 하나씩, 각각 지금 이 움직임에서 무슨 뜻인지 한 마디로) → 무엇이 나와야 반등이 이어지나(금리 경로 가격, 다음 물가 발표, 실적).',
      '- 첫째 블록은 세션과 쏠림·확산, 둘째 블록은 다른 시장의 확인, 셋째 블록은 이어지려면 무엇이 나와야 하고 무엇이 나오면 바뀌는지를 맡습니다.',
      '- 첫 문장은 종합 판정 낱말("시장 상태는 … 부담 우세입니다")로 열지 말고 최근 세션 이야기로 엽니다: 주도주가 얼마나 움직였고, 시장 전체는 얼마나 덜 움직였고, 그 차이가 말하는 진단.',
      '- "다른 시장" 줄의 상태어(양호·중립·부담·확인 불가)와 금리 경로 낱말(인상 반영·동결 부근·인하 반영)은 묶음의 것만 씁니다. 금리 경로는 2년물로 어림한 값이라 인상·인하 횟수나 확률로 쓰지 않습니다. 줄의 "지금 뜻"은 그대로 옮기지 말고 앞뒤 사실과 이어 풀어 씁니다.',
      '- 진단 상태어(쏠림 되돌림·침체형·금융 불안형·판단 보류)는 묶음에 적힌 것만 쓰고, 바뀌는 조건도 묶음의 것을 씁니다.',
      '- 묶음에 반등 상태어(반등 시도·추세 회복·반등 실패)가 있으면 그것만 쓰고, 반등 폭과 남은 낙폭을 함께, 200일선 위치와 반등 실패 기준(저점)을 묶음의 수치로 씁니다. 하루 반등을 추세 전환으로 단정하지 않습니다.',
      '- 지금 가격이 무엇을 반영하는지 묶음의 수치로 한 문장 씁니다. "싸다·매력적"은 조건으로만 씁니다("이익 추정치가 유지되면 …", "꺾이면 …"). 단정하지 않습니다.'
    ].join('\n'),
    facts(interpretation, { longrun = null, day = null, data = null, briefs = null } = {}) {
      const regime = interpretation?.regime;
      if (!regime?.available || !regime.asOf) return null;
      const axes = usAxes(regime);
      const opening = openingOf(interpretation, longrun, regime.asOf, { day, afterHours: data?.afterHours || null, briefs });
      return {
        basis: regime.asOf, axes, diagnosis: opening.available && opening.diagnosis?.state !== 'none' ? opening.diagnosis?.word || null : null,
        rebound: opening.available ? opening.rebound?.word || null : null,
        lines: [`기준일: ${md(regime.asOf)} 미국 종가`, ...openingFactLines(opening).map((line) => `시장 이야기 ${line}`), `종합 판정: ${regime.overall} (${countsLine(regime.counts, axes.length)})`,
          leadershipLine(regime), ...axes.map((axis) => axisLine(axis, regime.asOf))].filter(Boolean)
      };
    }
  }),
  breadth: Object.freeze({
    name: '시장 폭',
    story: SCREEN_STORY.breadth,
    storyGuide: '- "시장 이야기" 줄이 있으면 최근 세션에서 지수와 종목이 왜 다르게 움직였는지를 업종별 기여로 설명합니다: 어느 업종이 지수를 끌었고 나머지는 어느 쪽이었는지.',
    guide: '- 지수와 종목 다수가 같은 방향인지가 이 화면의 질문입니다. 폭이 지수 움직임을 받치는지, 일부 대형주만 끌고 가는지로 판단을 엽니다.',
    facts(interpretation) {
      const regime = interpretation?.regime;
      const axis = (regime?.axes || []).find((row) => row.id === 'breadth');
      if (!regime?.available || !regime.asOf || !axis?.stateLabel) return null;
      return {
        basis: regime.asOf, axes: [axis],
        lines: [`기준일: ${md(regime.asOf)} 미국 종가`, axisLine(axis, regime.asOf), `시장 상태 종합 판정: ${regime.overall} (${countsLine(regime.counts, usAxes(regime).length)})`, leadershipLine(regime)].filter(Boolean)
      };
    }
  }),
  macro: Object.freeze({
    name: '매크로',
    story: SCREEN_STORY.macro,
    storyGuide: '- "시장 이야기" 줄이 있으면 시장이 금리 경로를 어디에 두고 있는지(인상 반영·동결 부근·인하 반영)와 다음 물가 발표가 그것을 어느 쪽으로 바꿀 수 있는지를 주식과 이어서 씁니다.',
    guide: '- 성장·물가 국면이 증시에 어느 쪽으로 작용하는지로 엽니다. 발표 기준월이 종가보다 오래된 지표는 그 시차를 짧게 밝히고, 다음 발표가 무엇을 바꿀 수 있는지로 맺습니다.',
    facts(interpretation, { telegram = null } = {}) {
      const regime = interpretation?.regime;
      const read = interpretation?.macroRead;
      const axes = (read?.axes || []).filter((axis) => axis?.title && axis.stateLabel);
      if (!regime?.asOf || !read || !axes.length) return null;
      const quadrant = read.regime || {};
      const inputs = (Array.isArray(quadrant.inputs) ? quadrant.inputs : []).filter((row) => Array.isArray(row) && row[0])
        .map(([label, value, , verdict]) => `${label} ${value}${verdict ? ` (판정: ${verdict})` : ''}`);
      return {
        basis: regime.asOf, axes,
        lines: [`기준일: ${md(regime.asOf)} 미국 종가와 그때까지의 공식 발표`, quadrant.label ? `성장 × 물가 국면: ${quadrant.available ? `${quadrant.label} — ` : ''}${quadrant.verdict || quadrant.label}` : '',
          inputs.length ? `국면 입력: ${inputs.join('; ')}` : '', read.counts ? `증시 영향 요인 판정: ${countsLine(read.counts, axes.length)}` : '',
          ...axes.map((axis) => axisLine(axis, regime.asOf)),
          ...channelClaimLines(telegram?.signals, { catalog: telegram?.sourceCatalog, market: true, since: daysBefore(regime.asOf, CHANNEL_RELEASE_DAYS), max: 3 })].filter(Boolean)
      };
    }
  }),
  // 투자 심리: the shared 심리 verdict (a reference row outside the six), the screen's indicator cards as title, value, state
  // word, distance and change (src/domain/market/sentiment/sentiment-model.js, from the interpretation's own market input,
  // AAII included), and the two 시장 상태 axes the screen sets beside them (credit, volatility).
  sentiment: Object.freeze({
    name: '투자 심리',
    story: SCREEN_STORY.sentiment,
    storyGuide: '- "시장 이야기" 줄이 있으면 심리 지표가 최근 세션의 움직임과 같은 말을 하는지(공포가 그날 하락과 같은 곳을 가리키는지) 한 문장으로 잇습니다.',
    guide: '- 심리가 가격보다 앞서 있는지 뒤처져 있는지로 엽니다. 공포나 탐욕 쪽 쏠림은 그 자체로 방향이 아니라 이미 가격에 들어간 정도로 읽고, 신용·변동성이 그 읽기를 받치는지 짚습니다.',
    facts(interpretation) {
      const regime = interpretation?.regime;
      const sentiment = (regime?.watchAxes || []).find((row) => row.id === 'sentiment');
      if (!regime?.available || !regime.asOf || !interpretation?.inputs || !sentiment?.stateLabel) return null;
      const model = buildSentimentModel(interpretation.inputs);
      const context = usAxes(regime).filter((axis) => axis.id === 'credit' || axis.id === 'volatility');
      const cards = model.cards.filter((card) => card.value !== '—').map((card) => `${card.title}: ${card.value}${card.state ? ` (${card.state.label})` : ''}${card.distance ? ` · ${card.distance}` : ''}${card.change ? ` · ${card.change}` : ''}${card.basisStatus === 'aligned' ? '' : ` · 관측: ${card.basis}`}`);
      return {
        basis: regime.asOf, axes: [sentiment, ...context],
        lines: [`기준일: ${md(regime.asOf)} 미국 종가`, `${axisLine(sentiment, regime.asOf)} (시장 상태 6개 지표 합계 밖의 참고 지표)`, ...cards, ...context.map((axis) => axisLine(axis, regime.asOf))].filter(Boolean)
      };
    }
  }),
  // 금리와 환율: the board's own model (src/domain/macro/rates-fx.js buildRatesFx — the treasury curve and its move, the
  // 10-year close series the rates axis reads, TIPS and breakeven, the high-yield spread, the dollar, won and yen with the
  // carry rule) and the two 시장 상태 axes the tab sets beside them (rates, and the won/yen axis).
  fxbond: Object.freeze({
    name: '금리와 환율',
    story: SCREEN_STORY.fxbond,
    storyGuide: '- "시장 이야기" 줄이 있으면 금리 경로 줄의 뜻(인상 반영·동결 부근·인하 반영)을 밸류에이션 판단에 이어 씁니다.',
    guide: '- 금리와 환율이 지금 주식의 밸류에이션과 한국 투자자에게 어느 쪽으로 작용하는지로 엽니다. 곡선의 움직임(어느 쪽 금리가 움직였나)이 성장 기대인지 물가·재정 부담인지를 묶음의 상태어로만 말하고, 원·엔의 움직임은 달러와 함께 짚습니다.',
    facts(interpretation, { data = null } = {}) {
      const regime = interpretation?.regime;
      if (!regime?.asOf) return null;
      const model = buildRatesFx({ macro: data?.macro || null, history: historyOf(interpretation), macroHistory: interpretation?.inputs?.macroHistory || null });
      const t = model?.treasury;
      if (!(t?.yields || []).some((row) => finite(row.value) != null)) return null;
      const yields = t.yields.filter((row) => finite(row.value) != null).map((row) => `${row.label} ${Number(row.value).toFixed(2)}%${finite(row.week) != null ? ` (1주 ${signedText(row.week * 100, 0)}bp)` : ''}`);
      const curve = (t.curve || []).filter((row) => finite(row.value) != null).map((row) => `${row.label} ${signedText(row.value, 2)}%p`);
      const tnx = model.tnxChange || {};
      const fx = (model.fx || []).filter((card) => card.available).map((card) => `${card.label} ${card.valueText}${finite(card.day) != null ? ` (1일 ${pct(card.day, 2)}` : ' ('}${finite(card.change20) != null ? `, 20거래일 ${pct(card.change20)})` : ')'}`.replace(' ()', ''));
      const levels = [...(model.real || []), model.credit].filter((row) => row && row.value != null).map((row) => `${row.label} ${row.valueText}${row.weekText ? ` (${row.weekText})` : ''}${row.asOf && row.asOf !== regime.asOf ? ` (기준 ${md(row.asOf)})` : ''}`);
      const axes = (regime.axes || []).filter((axis) => axis.id === 'rates' || axis.id === 'korea');
      return {
        basis: regime.asOf, axes,
        lines: [`기준일: ${md(regime.asOf)} 미국 종가${t.asOf && t.asOf !== regime.asOf ? `, 국채 수익률 곡선 ${md(t.asOf)} 고시` : ''}`,
          `국채 금리: ${yields.join('; ')}`, curve.length ? `금리차: ${curve.join('; ')}` : '', t.dynamics?.label ? `곡선 움직임(규칙으로 정함): ${t.dynamics.label}` : '',
          finite(tnx.d5Bp) != null || finite(tnx.d20Bp) != null ? `10년물 종가 변화: 5거래일 ${signedText(tnx.d5Bp, 0)}bp · 20거래일 ${signedText(tnx.d20Bp, 0)}bp` : '',
          levels.length ? `실질금리·기대물가·신용: ${levels.join('; ')}` : '', fx.length ? `환율: ${fx.join('; ')}` : '',
          model.carry?.available ? `엔 캐리 규칙: 엔/달러 20거래일 ${pct(-model.carry.yenStrength)} — ${model.carry.burden ? '엔 급강세 기준 넘음(부담)' : '엔 급강세 기준 아래'}` : '',
          ...axes.map((axis) => axisLine(axis, regime.asOf))].filter(Boolean)
      };
    }
  }),
  // 기술적 분석 (시장 지수 view): each index's trend word and position from its published closes (market-charts.js
  // indexChartReadings, the cards' fallback reading), the S&P 500's distribution days, the Nasdaq Composite's rally attempt
  // and follow-through, and the Nasdaq 100 / S&P 500 rebound with its cross-market checks (market-story.js).
  charts: Object.freeze({
    name: '기술적 분석',
    guide: '- 차트가 지금 어떤 자리인지로 엽니다: 지수들이 같은 추세 낱말에 모여 있는지 갈라져 있는지, 가장 약한 지수가 무엇을 말하는지. 거래량(분배일), 반등 확인 신호, 반등의 다른 시장 확인을 이어서 지금 반등을 믿을 근거가 쌓였는지 판단합니다. 추세 낱말과 반등 상태어는 묶음의 것만 씁니다.',
    facts(interpretation, { longrun = null } = {}) {
      const regime = interpretation?.regime;
      const history = historyOf(interpretation);
      if (!regime?.asOf || !history.length) return null;
      const readings = indexChartReadings(history).filter((reading) => reading?.trendWord);
      if (!readings.length) return null;
      const opening = openingOf(interpretation, longrun, regime.asOf);
      const rally = rallyAttemptRead(history, { through: regime.asOf });
      const distribution = indexVolumeRead(history, 'spx');
      const rebound = openingFactLines(opening).filter((line) => line.startsWith('반등'));
      return {
        basis: regime.asOf, axes: [], rebound: opening.available ? opening.rebound?.word || null : null,
        lines: [`기준일: ${md(regime.asOf)} 미국 종가`, `지수 추세 집계: ${chartsConclusion(readings)}`,
          ...readings.map((reading) => `${reading.label}: ${reading.trendWord}${reading.facts ? ` · ${reading.facts}` : ''}${finite(reading.rsi) != null ? ` · RSI ${Math.round(reading.rsi)}` : ''}${reading.asOf && reading.asOf !== regime.asOf ? ` (기준 ${md(reading.asOf)})` : ''}`),
          distribution ? `S&P 500 ${distribution.text.replace(/^거래량:\s*/, '')}` : '',
          rally ? `나스닥 종합 반등 확인 신호: ${rally.state} · 규칙: ${rally.rule}` : '', ...rebound, leadershipLine(regime)].filter(Boolean)
      };
    }
  }),
  // 테마와 섹터: the theme stages the screen's stage map and lists draw (interpretation.playbook — theme-playbook.js, the
  // same object themePlaybookForRoot returns), the leading and weak US themes by one-month return, the macro sensitivities
  // ranked, and the leadership state.
  themes: Object.freeze({
    name: '테마와 섹터',
    story: SCREEN_STORY.themes,
    storyGuide: '- "시장 이야기" 줄이 있으면 최근 세션에 움직임이 몰린 테마와, 같은 테마 안에서도 반등 뒤 갈린 곳(되찾은 쪽과 뒤처진 쪽)을 짚습니다. 한 테마를 한 덩어리로 말하지 않습니다.',
    guide: '- 돈이 어디로 가고 어디서 빠지는지로 엽니다. 강한 테마와 약한 테마가 같은 바람(금리·경기·AI 투자)을 공유하는지, 단계 낱말이 1개월 수익률과 같은 쪽인지 짚고, 단계가 바뀌는 조건으로 맺습니다. 단계 낱말은 묶음의 것만 씁니다.',
    facts(interpretation) {
      const playbook = interpretation?.playbook;
      const us = (playbook?.themes || []).filter((theme) => theme.market === 'US');
      const basis = playbook?.asOfByMarket?.US || playbook?.asOf || null;
      if (!playbook?.available || !us.length || !isIsoDay(basis)) return null;
      const leading = byRet1m(us.filter((theme) => theme.state === 'leading')).slice(0, 3);
      const weak = byRet1m(us.filter((theme) => theme.state === 'weak')).reverse().slice(0, 3);
      const counts = Object.entries(us.reduce((acc, theme) => { const word = stateHead(theme); return { ...acc, [word]: (acc[word] || 0) + 1 }; }, {})).map(([word, n]) => `${word} ${n}개`).join(' · ');
      const tags = (playbook.rotation?.tags || []).filter((tag) => finite(tag.ret1m) != null);
      const sensitivity = tags.length > 3 ? [...tags.slice(0, 2), ...tags.slice(-2)] : tags;
      const names = (list) => (Array.isArray(list) ? list : []).map((item) => item?.label || item).filter((item) => typeof item === 'string').slice(0, 3);
      const highlights = [['구조적 눌림', names(playbook.highlights?.structuralPullbacks)], ['역풍 속 주도', names(playbook.highlights?.headwindLeaders)], ['순풍 속 부진', names(playbook.highlights?.tailwindLaggards)]].filter(([, list]) => list.length);
      return {
        basis, axes: [],
        lines: [`기준일: ${md(basis)} 미국 종가`, `미국 테마 ${us.length}개의 단계: ${counts}`,
          ...leading.map((theme) => `강한 테마 ${themeLine(theme)}`), ...weak.map((theme) => `약한 테마 ${themeLine(theme)}`),
          sensitivity.length ? `민감도 묶음 1개월(높은 순·낮은 순): ${sensitivity.map((tag) => `${tag.label} ${pct(tag.ret1m)}`).join('; ')}` : '',
          ...highlights.map(([label, list]) => `${label}: ${list.join(', ')}`), leadershipLine(interpretation?.regime)].filter(Boolean)
      };
    }
  }),
  // 한국 (테마와 섹터의 한국 탭): the Korean theme stages (the playbook's KR rows, kr-themes.js krThemeArtifactRead through
  // buildMarketInterpretation) on the Korean close, and the won/yen axis of 시장 상태.
  korea: Object.freeze({
    name: '한국',
    story: SCREEN_STORY.korea,
    storyGuide: '- "시장 이야기" 줄이 있으면 미국 주도 영역의 최근 세션과 반등 뒤 한국 메모리 종목의 움직임을 나란히 놓고, 한국이 미국 반등을 따라갔는지 못 따라갔는지 말합니다.',
    guide: '- 한국 테마 중 어디가 버티고 어디가 밀리는지로 엽니다. 미국 주도 영역과 같은 방향인지, 원화 움직임이 그 흐름에 보태는지 덜어내는지 짚습니다. 한국 자료가 얇으면 얇다고 말합니다.',
    facts(interpretation) {
      const playbook = interpretation?.playbook;
      const kr = (playbook?.themes || []).filter((theme) => theme.market === 'KR' && finite(theme.ret1m) != null);
      const basis = playbook?.asOfByMarket?.KR || null;
      if (!playbook?.available || !kr.length || !isIsoDay(basis)) return null;
      const ranked = byRet1m(kr);
      const shown = ranked.length > 6 ? [...ranked.slice(0, 3), ...ranked.slice(-3)] : ranked;
      const axis = (interpretation?.regime?.axes || []).find((row) => row.id === 'korea');
      return {
        basis, axes: axis ? [axis] : [],
        lines: [`기준일: ${md(basis)} 한국 종가`, `한국 테마 ${kr.length}개 (1개월 수익률 높은 순과 낮은 순)`, ...shown.map((theme) => `한국 테마 ${themeLine(theme)}`),
          leadershipLine(interpretation?.regime) ? `미국 ${leadershipLine(interpretation.regime)}` : '', axis ? axisLine(axis, interpretation.regime.asOf) : ''].filter(Boolean)
      };
    }
  })
});
export const SCREEN_READING_IDS = Object.freeze(Object.keys(SCREEN_READING_SCREENS));

/** { screen, basis, lines, key, axisStates, axes } — `key` is the first 16 hex of the lines' sha1 (same lines, same key). */
export function buildScreenPacket(screen, interpretation, context = {}) {
  const spec = SCREEN_READING_SCREENS[screen];
  if (!spec) return null;
  let facts = null;
  try { facts = spec.facts(interpretation, context); } catch (_) { facts = null; }
  if (!facts?.lines?.length || !isIsoDay(facts.basis)) return null;
  const lines = [...facts.lines, ...storyLinesOf(spec, interpretation, context)].map((line) => String(line).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const key = createHash('sha1').update(lines.join('\n')).digest('hex').slice(0, 16);
  return { screen, basis: facts.basis, lines, key, axisStates: statesOf(facts.axes || []), axes: titledStates(facts.axes || []), diagnosis: facts.diagnosis || null, rebound: facts.rebound || null };
}

// ---- prompt ----------------------------------------------------------------------------------------------------------------
// The rules are the same text for every screen, subject and day, so they lead (a cacheable prefix); the guide and facts follow.
export const SCREEN_READING_SECTIONS = READING_SECTIONS;
export const SCREEN_READING_RULES = READING_RULES;

export function buildScreenReadingPrompt(packet) {
  const spec = SCREEN_READING_SCREENS[packet?.screen];
  const tied = spec?.storyGuide && (packet?.lines || []).some((line) => line.startsWith('시장 이야기 ')) ? spec.storyGuide : '';
  return buildReadingPrompt({ name: spec?.name || '', guide: [spec?.guide, tied].filter(Boolean).join('\n'), lines: packet?.lines || [] });
}
export const buildScreenReadingRetryPrompt = buildReadingRetryPrompt;

// ---- state words -----------------------------------------------------------------------------------------------------------
// The market-reading check (axisStateClaimIssues) reads "id: state" lines; the packet's axis states are handed to it in
// that form. It knows the market axes' own words (추세, 시장 폭, 변동성, 금리, 신용); every packet axis is also read by its
// title: the title (or its head, "환율 (원, 엔)" → 환율) followed directly by another state label.
const STATE_WORD = '(양호|중립|부담|확인\\s?불가)';
const escape = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function titleForms(title) {
  const full = String(title || '').trim();
  const head = full.replace(/\s*\([^)]*\)\s*$/, '').split(/,\s*/)[0].trim();
  return [...new Set([full, head])].filter((form) => form.length >= 2);
}
function titledStateIssues(text, axes = []) {
  const issues = [];
  const sentences = String(text || '').replace(/「[^」]*」|'[^']*'|"[^"]*"/g, '').split(/(?<=[.?!。])\s+|\n+/);
  for (const sentence of sentences) {
    for (const clause of sentence.split(/[,，;；]|(?<=지만|으나|는데|반면|면서)\s/)) {
      if (READING_CONDITIONAL.test(clause)) continue;
      for (const axis of axes) {
        for (const form of titleForms(axis.title)) {
          const match = clause.match(new RegExp(`${escape(form)}(?:\\s?(?:축|지표|요인|판정))?(?:은|는|이|가|도)?\\s?(?:지금\\s?|여전히\\s?|아직\\s?)?['‘"“]?${STATE_WORD}(?![가-힣]*\\s?(?:으로|로)\\s?바뀌)`));
          if (match && match[1].replace(/\s/g, ' ') !== axis.stateLabel.replace(/\s/g, ' ')) issues.push(`state-contradiction:${axis.title} ${match[1]}`);
        }
      }
    }
  }
  return [...new Set(issues)];
}

// ---- the validator ---------------------------------------------------------------------------------------------------------
const SENTENCES = (body) => body.split(/(?<=[.?!。])\s+/);

/** { issues, warnings } for one reading against its packet. Issues block publication; warnings are recorded with it. */
export function validateScreenReading(text, packet) {
  const body = String(text || '').trim();
  const issues = coreReadingIssues(body, packet);
  const warnings = [];
  if (issues[0] === 'empty') return { issues, warnings };
  if (PROMPT_SECTION_LABEL.test(body)) issues.push('prompt-label-leak');
  const context = Object.entries(packet?.axisStates || {}).map(([id, state]) => `${id}: ${state}`).join('\n');
  for (const issue of axisStateClaimIssues(body, { context })) issues.push(`state-contradiction:${issue.split(':')[1] || ''}`);
  issues.push(...titledStateIssues(body, packet?.axes || []));
  issues.push(...validateAnalysisAdmission(body.replace(/\n\s*\n/g, ' '), { context: (packet?.lines || []).join('\n') }).filter((issue) => issue.startsWith('condition-count')));
  issues.push(...publishedTextIssues(body.replace(/\n\s*\n/g, ' ')));
  // An index move under the session's date is that session's own (market-analysis-validate.mjs sessionMoveIssues).
  issues.push(...sessionMoveIssues(body, { context: (packet?.lines || []).join('\n') }));
  warnings.push(...analysisInterpretationWarnings(body), ...coreReadingWarnings(body));
  // Interpretation warns. A diagnosis word other than the packet's outside a conditional clause and an opening on the
  // tally word are recorded, never blocking.
  if (packet?.diagnosis) {
    const other = Object.values(DIAGNOSIS_WORDS).filter((word) => word !== packet.diagnosis);
    if (SENTENCES(body).some((sentence) => !READING_CONDITIONAL.test(sentence) && other.some((word) => sentence.includes(word)))) warnings.push('diagnosis-word');
  }
  // The rebound word the same way: another state word outside a conditional clause warns ("…로 마감하면 반등 실패" is a condition).
  const reboundOthers = Object.values(REBOUND_WORDS).filter((word) => word !== packet?.rebound);
  if ((packet?.screen === 'signal' || packet?.screen === 'charts') && SENTENCES(body).some((sentence) => !READING_CONDITIONAL.test(sentence) && reboundOthers.some((word) => sentence.includes(word)))) warnings.push('rebound-word');
  if (/^[^.。]*(?:판정|시장 상태)[^.。]*(?:부담 우세|양호 우세|혼조|판정 보류)/.test(body)) warnings.push('tally-opening');
  return { issues: [...new Set(issues)], warnings: [...new Set(warnings)] };
}

/** The model's answer as at most two blocks (reading-core.js normalizeReading). */
export const normalizeScreenReading = normalizeReading;
