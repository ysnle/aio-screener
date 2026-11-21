// v60.31 (owner 2026-11-18, text architecture): the per-screen AI reading. Facts — figures, state labels, the close date —
// are the code's, in its fixed vocabulary; the reading that connects them is written by the shared model once per change
// of a screen's facts, checked here, and published only when it passes. Pure functions: the producer
// (scripts/producer/screen-readings.mjs) brings the interpretation and the requester.
//
// The fact packet is built from the same interpretation the screens draw (scripts/lib/market-interpretation-inputs.mjs
// interpretationFromArtifacts — the browser builds the same object through src/data/selectors/interpretation.js). An axis
// gives only its title, state label, evidence rows, flip condition and basis; its `read` (a sentence the code assembled)
// never enters the packet. A screen joins the readings by adding one builder to SCREEN_READING_SCREENS.
//
// Owner 2026-11-17: interpretation is never blocked. The validator blocks a figure or date the packet does not carry, a
// state label that contradicts the packet's, an order, an invented percentage probability, a leaked prompt label,
// non-Korean text and a reading longer than the face allows; thin grounds and possibility words are warnings only.
import { createHash } from 'node:crypto';
import { printedValueAgrees, signAgrees } from '../../src/domain/shared/figure-agreement.js';
import { isIsoDay } from '../../src/domain/shared/session-date.js';
import { analysisInterpretationWarnings, axisStateClaimIssues, PROMPT_SECTION_LABEL, publishedTextIssues, validateAnalysisAdmission } from './market-analysis-validate.mjs';
import { buildSentimentModel } from '../../src/domain/market/sentiment/sentiment-model.js';

export const SCREEN_READING_SCHEMA = 'screen-readings.v1';
export const SCREEN_READING_MAX_CHARS = 400; // the face's paragraph (3–5 sentences, about 130–230 characters asked)
export const SCREEN_READING_MIN_CHARS = 60;

const md = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
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
  return `${axis.title}: ${axis.stateLabel}${basis}${evidence ? ` · 근거: ${evidence}` : ''}${axis.flip ? ` · 판정이 바뀌는 조건: ${axis.flip}` : ''}`;
}
const countsLine = (counts, total) => {
  if (!counts) return '';
  const parts = [['양호', counts.favorable], ['중립', counts.neutral], ['부담', counts.burden], ['확인 불가', counts.unknown]].filter(([, n]) => Number(n) > 0 || n === 0).filter(([label, n]) => label !== '확인 불가' || n > 0);
  return `${total}개 지표 중 ${parts.map(([label, n]) => `${label} ${n}`).join(' · ')}`;
};
const usAxes = (regime) => (regime?.axes || []).filter((axis) => axis && axis.id !== 'korea'); // the counted six (market-read.js)
const statesOf = (axes) => Object.fromEntries(axes.filter((axis) => axis?.id && axis.state).map((axis) => [axis.id, axis.state]));
const titledStates = (axes) => axes.filter((axis) => axis?.title && axis.stateLabel).map((axis) => ({ id: axis.id, title: axis.title, stateLabel: axis.stateLabel }));

// ---- the registry: screen id → { name (as the screen is called), facts(interpretation) } -------------------------------------
// facts() returns { basis, lines, axes } or null when the screen has nothing to read today. `axes` (id, state, title,
// stateLabel) feed the state-word check; they are not part of the key.
export const SCREEN_READING_SCREENS = Object.freeze({
  signal: Object.freeze({
    name: '시장 상태',
    facts(interpretation) {
      const regime = interpretation?.regime;
      if (!regime?.available || !regime.asOf) return null;
      const axes = usAxes(regime);
      return {
        basis: regime.asOf, axes,
        lines: [`기준일: ${md(regime.asOf)} 미국 종가`, `종합 판정: ${regime.overall} (${countsLine(regime.counts, axes.length)})`,
          LEADERSHIP_STATE[regime.leadership?.state] ? `주도주 흐름: ${LEADERSHIP_STATE[regime.leadership.state]}` : '', ...axes.map((axis) => axisLine(axis, regime.asOf))].filter(Boolean)
      };
    }
  }),
  breadth: Object.freeze({
    name: '시장 폭',
    facts(interpretation) {
      const regime = interpretation?.regime;
      const axis = (regime?.axes || []).find((row) => row.id === 'breadth');
      if (!regime?.available || !regime.asOf || !axis?.stateLabel) return null;
      return {
        basis: regime.asOf, axes: [axis],
        lines: [`기준일: ${md(regime.asOf)} 미국 종가`, axisLine(axis, regime.asOf), `시장 상태 종합 판정: ${regime.overall} (${countsLine(regime.counts, usAxes(regime).length)})`].filter(Boolean)
      };
    }
  }),
  macro: Object.freeze({
    name: '매크로',
    facts(interpretation) {
      const regime = interpretation?.regime;
      const read = interpretation?.macroRead;
      const axes = (read?.axes || []).filter((axis) => axis?.title && axis.stateLabel);
      if (!regime?.asOf || !read || !axes.length) return null;
      const quadrant = read.regime || {};
      const inputs = (Array.isArray(quadrant.inputs) ? quadrant.inputs : []).filter((row) => Array.isArray(row) && row[0])
        .map(([label, value, , verdict]) => `${label} ${value}${verdict ? ` (판정: ${verdict})` : ''}`);
      return {
        basis: regime.asOf, axes,
        lines: [`기준일: ${md(regime.asOf)} 미국 종가와 그때까지의 공식 발표`, quadrant.label ? `성장 × 물가 국면: ${quadrant.label}` : '',
          inputs.length ? `국면 입력: ${inputs.join('; ')}` : '', read.counts ? `증시 영향 요인 판정: ${countsLine(read.counts, axes.length)}` : '',
          ...axes.map((axis) => axisLine(axis, regime.asOf))].filter(Boolean)
      };
    }
  }),
  // 투자 심리: the shared 심리 verdict (a reference row outside the six), the screen's indicator cards as title, value, state
  // word, distance and change (src/domain/market/sentiment/sentiment-model.js, from the interpretation's own market input,
  // AAII included), and the two 시장 상태 axes the screen sets beside them (credit, volatility).
  sentiment: Object.freeze({
    name: '투자 심리',
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
  })
});
export const SCREEN_READING_IDS = Object.freeze(Object.keys(SCREEN_READING_SCREENS));

/** { screen, basis, lines, key, axisStates, axes } — `key` is the first 16 hex of the lines' sha1 (same lines, same key). */
export function buildScreenPacket(screen, interpretation) {
  const spec = SCREEN_READING_SCREENS[screen];
  if (!spec) return null;
  let facts = null;
  try { facts = spec.facts(interpretation); } catch (_) { facts = null; }
  if (!facts?.lines?.length || !isIsoDay(facts.basis)) return null;
  const lines = facts.lines.map((line) => String(line).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const key = createHash('sha1').update(lines.join('\n')).digest('hex').slice(0, 16);
  return { screen, basis: facts.basis, lines, key, axisStates: statesOf(facts.axes || []), axes: titledStates(facts.axes || []) };
}

// ---- prompt ----------------------------------------------------------------------------------------------------------------
// The rules are the same text for every screen and day, so they lead (a cacheable prefix); the screen and its facts follow.
export const SCREEN_READING_SECTIONS = Object.freeze({ rules: '[규칙]', facts: '[사실 묶음]', retry: '[다시 쓰기]' });
export const SCREEN_READING_RULES = [
  SCREEN_READING_SECTIONS.rules,
  '투자 리서치 화면의 맨 위에 붙는 짧은 읽기 한 문단을 한국어로 씁니다. 아래 사실 묶음이 화면이 이미 보여 주는 사실 전부입니다.',
  '- 3~5문장, 130~230자 정도의 한 문단. 줄바꿈·목록·제목·괄호 속 출처 없이 이어지는 글로 씁니다.',
  '- 처음 보는 사람도 읽히는 쉬운 말로, 그날 상황을 이어서 설명합니다: 무엇이 부담이고 무엇이 버티는지, 그 둘이 서로 어떻게 이어지는지, 무엇이 바뀌면 읽기가 달라지는지.',
  '- 수치와 날짜는 사실 묶음에 있는 것만 그대로 옮깁니다. 새 수치를 계산하거나 더하거나 빼지 않습니다(차이·합계·평균도 쓰지 않음). 날짜는 M/D로 씁니다.',
  '- 지표의 상태는 묶음의 낱말(양호·중립·부담·확인 불가)로만 말하고, 묶음과 다른 상태를 붙이지 않습니다.',
  '- 조건을 단 시나리오 설명("~하면 ~쪽으로 읽힙니다")은 써도 됩니다. 매수·매도 지시와 % 확률은 쓰지 않습니다.',
  '- 근거가 얇으면 얇다고 짧게 말하되 판단을 미루지 않습니다.',
  '- 교과서 말투("~하는 법", "~란 무엇인가", 정의 나열)와 독자에게 할 일을 시키는 말투를 쓰지 않습니다.',
  '- 이모지, 자료 출처·제공자 이름, 이 지시문의 꺾쇠 표시를 쓰지 않습니다. 화면 이름은 묶음에 적힌 이름 그대로 씁니다(경제 화면은 "매크로").',
  '- 답은 그 문단만 씁니다.'
].join('\n');

export function buildScreenReadingPrompt(packet) {
  const name = SCREEN_READING_SCREENS[packet?.screen]?.name || '';
  return `${SCREEN_READING_RULES}\n\n${SCREEN_READING_SECTIONS.facts}\n화면: ${name}\n${(packet?.lines || []).map((line) => `- ${line}`).join('\n')}`;
}

const ISSUE_TEXT = Object.freeze({
  'figure-unsupported': (detail) => `사실 묶음에 없는 수치나 날짜를 썼습니다${detail ? `(${detail})` : ''}. 묶음의 수치만 그대로 옮기세요.`,
  'state-contradiction': (detail) => `지표의 상태를 묶음과 다르게 썼습니다${detail ? `(${detail})` : ''}. 묶음의 상태 낱말을 쓰세요.`,
  'trade-instruction': () => '매수·매도 지시가 있습니다. 조건을 단 설명으로 바꾸세요.',
  'probability-claim': () => '% 확률을 썼습니다. 확률 수치 없이 쓰세요.',
  'too-long': () => `너무 깁니다. ${SCREEN_READING_MAX_CHARS}자 안으로 줄이세요.`,
  'too-short': () => '너무 짧습니다. 3~5문장으로 쓰세요.',
  'language-not-korean': () => '한국어로 쓰세요.',
  'prompt-label-leak': () => '지시문의 표시를 옮겨 적었습니다. 문단만 쓰세요.',
  'emoji': () => '이모지를 빼세요.',
  'published-text-malformed': () => '괄호나 문장 끝이 깨졌습니다. 완결된 문장으로 쓰세요.'
});
/** The retry: the same prompt with the blocking reasons (codes and the offending figures only, never the rejected text). */
export function buildScreenReadingRetryPrompt(prompt, verdict) {
  const lines = (verdict?.issues || []).map((issue) => {
    const [code, detail] = String(issue).split(/:(.*)/s);
    return `- ${(ISSUE_TEXT[code] || (() => `규칙 위반(${code})`))(detail)}`;
  });
  return `${prompt}\n\n${SCREEN_READING_SECTIONS.retry}\n직전 답은 다음 이유로 게시하지 않았습니다. 같은 규칙으로 처음부터 다시 쓰세요.\n${[...new Set(lines)].join('\n')}`;
}

// ---- figures ---------------------------------------------------------------------------------------------------------------
// A printed figure: an optional sign, digits (thousands commas, decimals) and its unit family. 'pct' (%), 'pp' (%p), 'bp' (bp)
// must meet the same family in the packet; any other figure ('plain': levels, 달러, 개, 배, 일, 거래일 …) meets any family.
const DATE_MD = /(?<![\d.,/])(\d{1,2})\s?\/\s?(\d{1,2})(?![\d.,/%])|(\d{1,2})월\s?(\d{1,2})일/g;
const FIGURE = /(?<![\d.,A-Za-z])([+\-−]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?![\d,])\s?(%p|%\s?포인트|%|(?<![A-Za-z])bps?(?![A-Za-z]))?/g;
const familyOf = (unit) => !unit ? 'plain' : /^%(?:p|\s?포인트)$/.test(unit) ? 'pp' : unit === '%' ? 'pct' : 'bp';
function figuresOf(text) {
  const body = String(text || '');
  const dates = [];
  const masked = body.replace(DATE_MD, (match, m1, d1, m2, d2, offset) => {
    const month = Number(m1 ?? m2), day = Number(d1 ?? d2);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) { dates.push({ text: match, md: `${month}/${day}`, parts: [month, day] }); return ' '.repeat(match.length); }
    return match;
  });
  const figures = [];
  for (const match of masked.matchAll(FIGURE)) {
    // A hyphen joined to a word before it ("11/17-11/18", "S&P500-") is not a sign.
    const before = masked.slice(Math.max(0, match.index - 1), match.index);
    const sign = match[1] && !/[\dA-Za-z가-힣]/.test(before) ? (match[1] === '+' ? 1 : -1) : 0;
    const digits = Number(match[2].replace(/,/g, ''));
    const places = (match[3] || '').length;
    const written = Number(`${digits}${places ? `.${match[3]}` : ''}`);
    figures.push({ text: match[0].trim(), sign, written, places, value: sign < 0 ? -written : written, family: familyOf(match[4] ? match[4].replace(/s$/, '') : '') });
  }
  return { dates, figures };
}

/** The packet's figures and dates, read with the same rules as the text. */
export function packetFigures(packet) {
  const { dates, figures } = figuresOf((packet?.lines || []).join('\n'));
  const dateSet = new Set(dates.map((row) => row.md));
  if (packet?.basis) dateSet.add(md(packet.basis));
  return { dates: dateSet, figures };
}

function figureAgrees(figure, known) {
  return known.some((row) => (figure.family === 'plain' || row.family === figure.family) && printedValueAgrees(figure.written, figure.places, Math.abs(row.value)) && signAgrees(figure.sign, row.value));
}

/** The text's figures and dates the packet does not carry (a date the packet lacks may still be a ratio of two packet figures). */
export function unsupportedFigures(text, packet) {
  const known = packetFigures(packet);
  const { dates, figures } = figuresOf(text);
  const plain = (n) => ({ sign: 0, written: n, places: 0, family: 'plain' });
  return [
    ...dates.filter((row) => !known.dates.has(row.md) && !row.parts.every((n) => figureAgrees(plain(n), known.figures))).map((row) => row.text),
    ...figures.filter((figure) => !figureAgrees(figure, known.figures)).map((figure) => figure.text)
  ];
}

// ---- state words -----------------------------------------------------------------------------------------------------------
// The market-reading check (axisStateClaimIssues) reads "id: state" lines; the packet's axis states are handed to it in
// that form. It knows the market axes' own words (추세, 시장 폭, 변동성, 금리, 신용); every packet axis is also read by its
// title: the title (or its head, "환율 (원, 엔)" → 환율) followed directly by another state label.
const STATE_WORD = '(양호|중립|부담|확인\\s?불가)';
const CONDITIONAL = /(?:하면|이면|되면|라면|으면|면\s|경우|바뀌|전환|돌아서|넘어가)/;
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
      if (CONDITIONAL.test(clause)) continue;
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
const EMOJI = /\p{Extended_Pictographic}/u;
const SOURCE_NAMES = /(?<![A-Za-z])(?:FRED|CNN|Yahoo|Bloomberg|Reuters|Cboe|CBOE|Investing\.com|WSJ)(?![A-Za-z])|야후|블룸버그|로이터/;
const LATIN_TERMS = /S&P|\b[A-Z]{2,}(?:\s?\d+)?\b|\bSahm\b/g; // tickers and indicator names are Latin by nature (P1585)

/** { issues, warnings } for one reading against its packet. Issues block publication; warnings are recorded with it. */
export function validateScreenReading(text, packet) {
  const body = String(text || '').trim();
  const issues = [];
  const warnings = [];
  if (!body) return { issues: ['empty'], warnings };
  if (body.length > SCREEN_READING_MAX_CHARS) issues.push('too-long');
  if (body.length < SCREEN_READING_MIN_CHARS) issues.push('too-short');
  if (PROMPT_SECTION_LABEL.test(body) || Object.values(SCREEN_READING_SECTIONS).some((label) => body.includes(label)) || /사실\s?묶음/.test(body)) issues.push('prompt-label-leak');
  if (EMOJI.test(body)) issues.push('emoji');
  const prose = body.replace(LATIN_TERMS, ' ');
  const hangul = (prose.match(/[가-힣]/g) || []).length;
  const latin = (prose.match(/[A-Za-z]/g) || []).length;
  if (hangul < 30 || (latin >= 30 && hangul < latin * 0.6)) issues.push('language-not-korean');
  const missing = unsupportedFigures(body, packet);
  if (missing.length) issues.push(`figure-unsupported:${[...new Set(missing)].slice(0, 6).join(', ')}`);
  const context = Object.entries(packet?.axisStates || {}).map(([id, state]) => `${id}: ${state}`).join('\n');
  for (const issue of axisStateClaimIssues(body, { context })) issues.push(`state-contradiction:${issue.split(':')[1] || ''}`);
  issues.push(...titledStateIssues(body, packet?.axes || []));
  issues.push(...validateAnalysisAdmission(body, { context: (packet?.lines || []).join('\n') }).filter((issue) => issue === 'trade-instruction' || issue === 'probability-claim' || issue.startsWith('condition-count')));
  issues.push(...publishedTextIssues(body));
  warnings.push(...analysisInterpretationWarnings(body));
  const sentences = body.split(/(?<=[.?!。])\s+/).filter((sentence) => /[가-힣]/.test(sentence)).length;
  if (sentences < 3 || sentences > 5) warnings.push(`sentence-count:${sentences}`);
  if (SOURCE_NAMES.test(body)) warnings.push('source-name');
  if (/거시\s?경제/.test(body)) warnings.push('macro-screen-name');
  return { issues: [...new Set(issues)], warnings: [...new Set(warnings)] };
}

/** The model's answer as one paragraph: surrounding quotes and line breaks removed. */
export function normalizeScreenReading(text) {
  return String(text ?? '').replace(/^\s*["“'‘]|["”'’]\s*$/g, '').replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
