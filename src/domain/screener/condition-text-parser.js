// v58.63: the sentence parser for custom screener conditions, split out of custom-conditions.js so the boot bundle
// does not carry it — the panel loads it on the 적용 click. Conditions themselves (labels, bounds, evaluation) stay in
// custom-conditions.js, which this module reads.
import { CONDITION_BOUNDS as BOUNDS, normalizeConditions } from './custom-conditions.js';

// Sentence → conditions. Rules run longest-phrase first and consume what they match; the rest is reported back
// so a reader sees what was not understood instead of a silently wider result.
const NUM = '(\\d+(?:\\.\\d+)?)';
const SIGNED = '(-?\\d+(?:\\.\\d+)?)';
const MIN_WORDS = '(?:이상|초과|넘는|넘게|보다\\s*(?:큰|높은))';
const MAX_WORDS = '(?:이하|미만|아래|까지|보다\\s*(?:작은|낮은))';
const PARSE_RULES = [
  // v58.80 (first-users F34): RSI and period returns, with an explicit direction word (a bare "RSI 30" is reported back).
  [new RegExp(`rsi\\s*(?:\\(?\\s*14\\s*일?\\s*\\)?\\s*)?(?:가|이)?\\s*${NUM}\\s*${MAX_WORDS}`, 'i'), (m) => ({ id: 'rsi-max', value: +m[1] })],
  [new RegExp(`rsi\\s*(?:\\(?\\s*14\\s*일?\\s*\\)?\\s*)?(?:가|이)?\\s*${NUM}\\s*${MIN_WORDS}`, 'i'), (m) => ({ id: 'rsi-min', value: +m[1] })],
  [/과매도/, () => ({ id: 'rsi-max', value: 30 })],
  [/과매수/, () => ({ id: 'rsi-min', value: 70 })],
  [new RegExp(`([13])\\s*개월\\s*(?:수익률|상승률|등락률|수익)?\\s*(?:이|가)?\\s*${SIGNED}\\s*%?\\s*${MIN_WORDS}`), (m) => ({ id: `ret${m[1]}m-min`, value: +m[2] })],
  [new RegExp(`([13])\\s*개월\\s*(?:수익률|상승률|등락률|수익)?\\s*(?:이|가)?\\s*${SIGNED}\\s*%?\\s*${MAX_WORDS}`), (m) => ({ id: `ret${m[1]}m-max`, value: +m[2] })],
  // v58.71: research-channel reports, before the 실적/성장 rules below.
  [/목표\s*(?:주)?가\s*(?:상향|올린|올라간)/, () => ({ id: 'tg-pt-raise', value: 1 })],
  [/(?:투자\s*)?의견\s*상향|업그레이드/, () => ({ id: 'tg-upgrade' })],
  [/(?:실적|어닝)\s*(?:서프라이즈|예상\s*상회|컨센서스\s*상회|비트)|(?:예상|컨센서스)\s*(?:를\s*)?(?:상회|웃돈)\s*실적/, () => ({ id: 'tg-earnings-beat' })],
  // v57.87: the follow-through phrases first (more specific than the ADR / VCP rules below).
  [/포켓\s*피벗/i, () => ({ id: 'pocket-pivot' })],
  [new RegExp(`${NUM}\\s*번째\\s*베이스\\s*(?:이하|까지)?`), (m) => ({ id: 'early-base', value: +m[1] })],
  [/(?:초기|첫|이른)\s*베이스/, () => ({ id: 'early-base', value: 2 })],
  [/(?:지수\s*)?하락일(?:에)?\s*(?:버틴|강한|덜\s*빠진)|덜\s*빠진|상대\s*회복력?/, () => ({ id: 'down-day-hold', value: 60 })],
  [/(?:클라이맥스|과열\s*징후)\s*(?:없는|없음|제외)/, () => ({ id: 'no-climax' })],
  // v57.88 (review): the numeric form first — otherwise the rvol rule below took "거래량 실린" and inverted the request.
  [new RegExp(`(?:거래량\\s*실린\\s*)?하락일\\s*${NUM}\\s*일\\s*(?:이하|미만|까지)`), (m) => ({ id: 'few-heavy-down', value: +m[1] })],
  [/(?:거래량\s*실린\s*)?하락일\s*(?:적은|적게)/, () => ({ id: 'few-heavy-down', value: 4 })],
  [/하방\s*과?\s*확장|과매도\s*확장|50\s*일선\s*(?:아래로?|밑으로?)\s*(?:멀리|크게)/, () => ({ id: 'down-extended', value: 4 })],
  [/확장\s*(?:전(?![체부])|안\s*된|되지\s*않은)|50\s*일선\s*(?:근처|가까운)/, () => ({ id: 'not-extended', value: 4 })],
  [new RegExp(`(?:adr|변동폭)\\s*${NUM}\\s*%?\\s*(?:이상|초과|넘는|넘게|보다\\s*큰)`, 'i'), (m) => ({ id: 'adr-min', value: +m[1] })],
  [new RegExp(`(?:forward|포워드|선행)\\s*per\\s*${NUM}\\s*배?\\s*(?:이하|미만|아래)?`, 'i'), (m) => ({ id: 'fwdpe-max', value: +m[1] })],
  [new RegExp(`per\\s*${NUM}\\s*배?\\s*(?:이하|미만|아래)?`, 'i'), (m) => ({ id: 'pe-max', value: +m[1] })],
  [/저\s*per|저평가/i, () => ({ id: 'pe-max', value: 15 })],
  [new RegExp(`pbr\\s*${NUM}\\s*배?\\s*(?:이하|미만|아래)?`, 'i'), (m) => ({ id: 'pb-max', value: +m[1] })],
  [new RegExp(`roe\\s*${NUM}\\s*%?\\s*(?:이상|초과|넘는)?`, 'i'), (m) => ({ id: 'roe-min', value: +m[1] })],
  [new RegExp(`(?:매출\\s*)?성장(?:률)?\\s*${NUM}\\s*%?\\s*(?:이상|초과|넘는)?`), (m) => ({ id: 'growth-min', value: +m[1] })],
  // v59.44: the cash conditions, ahead of 마진 so "FCF 마진 10%" is not read as the net margin.
  [new RegExp(`(?:잉여\\s*현금\\s*흐름|fcf)\\s*(?:마진|비율)?\\s*${NUM}\\s*%?\\s*(?:이상|초과)?`, 'i'), (m) => ({ id: 'fcf-margin-min', value: +m[1] })],
  [new RegExp(`(?:설비\\s*투자|capex)\\s*(?:비중|비율|강도)?\\s*(?:매출(?:의|\\s*대비)?\\s*)?${NUM}\\s*%?\\s*(?:이하|미만)?`, 'i'), (m) => ({ id: 'capex-intensity-max', value: +m[1] })],
  [new RegExp(`(?:순?이익률|마진)\\s*${NUM}\\s*%?\\s*(?:이상|초과)?`), (m) => ({ id: 'margin-min', value: +m[1] })],
  [new RegExp(`거래대금\\s*\\$?${NUM}\\s*(?:백만|m)?\\s*(?:달러)?\\s*(?:이상)?`, 'i'), (m) => ({ id: 'liquidity-min', value: +m[1] })],
  [new RegExp(`거래량\\s*${NUM}\\s*배\\s*(?:이상)?`), (m) => ({ id: 'rvol', value: +m[1] })],
  [/거래량\s*(?:급증|증가|실린|터진|많은)(?!\s*하락)/, () => ({ id: 'rvol', value: 1.5 })],
  [new RegExp(`(?:adr|변동폭)\\s*${NUM}\\s*%?\\s*(?:이하|미만)?`, 'i'), (m) => ({ id: 'tight', value: +m[1] })],
  [/vcp\s*돌파|피벗\s*돌파/i, () => ({ id: 'vcp-breakout' })],
  [/vcp(?:\s*패턴)?|수렴|변동성\s*(?:축소|수축)/i, () => ({ id: 'vcp' })],
  [new RegExp(`(?:52\\s*주\\s*)?(?:신고가|고점)\\s*(?:근처|부근|대비)\\s*${NUM}\\s*%?\\s*(?:이내)?`), (m) => ({ id: 'near-high', value: +m[1] })],
  [/(?:52\s*주\s*)?(?:신고가|고점)\s*(?:근처|부근)/, () => ({ id: 'near-high', value: 5 })],
  [/(?:52\s*주\s*)?신고가/, () => ({ id: 'new-high' })],
  [/(?:50\s*일?선?\s*[/·,\s]*\s*200\s*일?선?|중기|장기)\s*(?:이동평균\s*)?(?:일선?\s*)?정배열/, () => ({ id: 'ma-long' })],
  [/(?:5\s*[/·,]\s*10\s*[/·,]\s*20|단기)\s*(?:일선?\s*)?(?:이동평균\s*)?정배열|(?:\d+\s*일선?\s*)*정배열/, () => ({ id: 'ma-short' })]
];
const FILLER = /(?:이면서|이고|이며|면서|그리고|및|하는|하고|있는|중인|종목들?|주식|찾아\s*줘|보여\s*줘|[,·/+&]|\s)+/g;
const STOP_WORDS = /^(?:[을를이가은는의에도로와과인한]|으로|보여주고|보여주는|보이는|나타나는|나타내는|만족하는|있고|하고|중|등|등등|패턴을?|조건)$/;

// v58.63 (architecture audit SCR04): conditions combine with AND only. "또는" used to be filler, so "PER 10 이하 또는 ROE
// 20 이상" silently became AND; a threshold followed by the opposite direction ("PER 20 이상") became the cap. Both are
// reported in `unsupported` and the panel applies nothing, keeping the sentence for the reader to rewrite.
const OR_WORDS = /또는|혹은|이거나|(?:^|\s)or(?=\s|$)|거나(?=[\s,]|$)/i;
const STRICT_WORDS = /미만|초과|넘는|넘게|보다\s*(?:큰|작은|많은|적은|높은|낮은)|아래/;
const AFTER_MAX_INVERTED = /^\s*(이상|초과|넘는|넘게|보다\s*(?:큰|많은|높은))/;
const AFTER_MIN_INVERTED = /^\s*(이하|미만|아래|까지|보다\s*(?:작은|적은|낮은))/;
// v58.63: the liquidity condition is in $ millions; "거래대금 50억 이상" matched the number alone, applied $50M and sent
// "억 이상" to the name search (zero rows). A won unit after the number is reported, not converted.
const AFTER_WON_UNIT = /^\s*(조|억|천만|만|원)\s*원?/;

export function parseConditionText(text) {
  let rest = ` ${String(text || '')} `;
  const conditions = [];
  const unsupported = [];
  const reasons = new Set(); // v58.80 run-5: which rule refused, so the note names only that one
  const or = rest.match(OR_WORDS);
  if (or) { unsupported.push(or[0].trim()); reasons.add('or'); }
  for (const [pattern, build] of PARSE_RULES) {
    let match = rest.match(pattern);
    while (match) {
      const condition = build(match);
      let end = match.index + match[0].length;
      const bound = BOUNDS[condition.id];
      const won = condition.id === 'liquidity-min' && rest.slice(end).match(AFTER_WON_UNIT);
      const inverted = !won && bound && rest.slice(end).match(bound[1] === 'max' ? AFTER_MAX_INVERTED : AFTER_MIN_INVERTED);
      if (won) {
        unsupported.push(`${match[0].trim()}${won[1]}`); reasons.add('won');
        end += won[0].length;
        const tail = rest.slice(end).match(/^\s*(?:이상|이하|초과|미만)/);
        if (tail) end += tail[0].length;
      } else if (inverted) {
        unsupported.push(`${match[0].trim()} ${inverted[1]}`); reasons.add('inverted');
        end += inverted[0].length;
      } else conditions.push(bound && STRICT_WORDS.test(match[0]) ? { ...condition, strict: true } : condition);
      rest = `${rest.slice(0, match.index)} ${rest.slice(end)}`;
      match = rest.match(pattern);
    }
  }
  const unknown = rest.replace(OR_WORDS, ' ').replace(FILLER, ' ').split(' ').filter((word) => word && !STOP_WORDS.test(word)).join(' ');
  const out = { conditions: normalizeConditions(conditions), unknown };
  return unsupported.length ? { ...out, unsupported, reasons: [...reasons] } : out;
}
