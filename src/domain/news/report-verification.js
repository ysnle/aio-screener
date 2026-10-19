// One rule for "is this report confirmed?" (pipeline redesign, 2026-10-19). Owner 2026-10-18: rumours stay labelled as
// rumours. The news bundle, the intraday slot, the market timeline and the narrative context each carried their own
// pattern, so the same headline could be "[미확인]" in one place and plain in another (the Korean "관계자가 전했다"
// form and "알려졌다" were caught only by the narrative context; "market chatter" and "찌라시"-style wording only by the
// news bundle). Every producer and screen now asks this module.
//
// Levels: 'rumor' — the text itself names a rumour or speculation; 'unconfirmed' — an anonymous or unnamed-source
// report; 'reported' — neither. Published artifacts keep their existing contract: a news row carries
// verification 'unconfirmed' for either of the first two (reportIsUnconfirmed), the narrative context keeps both levels.
const RUMOR_EN = /\b(rumou?rs?|rumou?red|speculation|speculat(?:e|es|ing)|market chatter|chatter)\b/i;
const RUMOR_KO = /루머|소문|찌라시|파산설|매각설|인수설|합병설|설\s*(?:나와|돌아|확산|제기)/;
const ANONYMOUS_EN = /\b(people familiar|familiar with the matter|sources? (?:said|say|says)|according to (?:people|sources|a person)|unnamed sources?|people with knowledge|person with knowledge|reportedly|is said to|are said to|may be considering|unconfirmed)\b/i;
const ANONYMOUS_KO = /관계자(?:들)?\s*(?:\d+명)?\s*(?:에\s*따르면|를\s*인용|가\s*전|는\s*전|들이\s*전)|소식통|익명|미확인|알려졌|전해졌/;

export function reportVerification(text) {
  const value = String(text || '');
  if (RUMOR_EN.test(value) || RUMOR_KO.test(value)) return 'rumor';
  if (ANONYMOUS_EN.test(value) || ANONYMOUS_KO.test(value)) return 'unconfirmed';
  return 'reported';
}

export function reportIsUnconfirmed(text) {
  return reportVerification(text) !== 'reported';
}
