// v57.70 (2026-10-15 audit): Telegram summaries reached the news screen with pictographs ("▶️ 주요 코멘트", "☁️ CRWV"),
// box-drawing rules ("━━━━") and quoted Chinese originals ("韩国首尔综指下跌6%。"), against the no-emoji rule. A segment
// written in Chinese with no Hangul is the channel's quoted source, not its Korean summary, and is left out; a single
// Hanja inside a Korean sentence (中, 韓) stays. Pure: no I/O.
const HAN = /[㐀-䶿一-鿿]/g;
const HANGUL = /[가-힣]/;

export function cleanTelegramText(text) {
  return String(text || '')
    .replace(/\p{Extended_Pictographic}|️|⃣/gu, '')
    .replace(/[─-╿■-◿]+/g, ' ')
    .split(/(?<=[\n。])|(?=>)/)
    .filter((segment) => (segment.match(HAN) || []).length < 3 || HANGUL.test(segment))
    .join('');
}
