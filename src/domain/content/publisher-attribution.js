// Sources stay off the face: a number or claim on the screen carries its date, and the publisher sits in the folded
// 데이터 출처 list or a hover. An AI reading that writes "연합뉴스에 따르면", "CNBC 보도에 따르면" or "(Reuters)" puts the
// publisher back on the face. This repair takes the publisher out of those attributions and keeps the sentence; it never
// decides whether a reading is published (the validators record a 'publisher-named' warning beside it).
const LATIN = ['Reuters', 'Bloomberg', 'CNBC', 'Associated Press', 'AP News', 'Wall Street Journal', 'WSJ', 'Financial Times', 'MarketWatch',
  "Barron's", 'Yahoo Finance', 'Yonhap', 'Infomax', 'Investing\\.com', 'Seeking Alpha'];
// The Korean labels of the same feeds (scripts/lib/news-selection.mjs tiers), and the wire services' Korean names.
const HANGUL = ['연합뉴스', '연합인포맥스', '로이터', '블룸버그', '월스트리트저널', '월스트리트 저널', '파이낸셜타임스', '파이낸셜 타임스', '마켓워치', '배런스',
  '뉴스1', '뉴시스', '한국경제', '한경닷컴', '매일경제', '서울경제', '머니투데이', '이데일리', '파이낸셜뉴스', '헤럴드경제', '아시아경제', '조선비즈', '이투데이',
  '야후 파이낸스', 'AP통신', 'AP 통신'];
const NAME = `(?:(?<![A-Za-z])(?:${LATIN.join('|')})(?![A-Za-z])|(?<![가-힣A-Za-z])(?:${HANGUL.join('|')}))(?:\\s?통신)?`;
const IN_BRACKETS = new RegExp(`\\s?[(（]\\s*${NAME}(?:\\s?(?:보도|기사|뉴스))?\\s*[)）]`, 'g');
// "CNBC 보도에 따르면" keeps "보도에 따르면"; "연합뉴스에 따르면," leaves the sentence its own subject.
const WITH_NOUN = new RegExp(`${NAME}(?:의|이|가)?\\s?(보도|기사|분석|집계|조사|전망)에\\s?따르면`, 'g');
const BARE = new RegExp(`${NAME}에\\s?따르면[,，]?\\s*`, 'g');

/** `text` with publisher names taken out of its attributions; `named` says whether any was found. */
export function stripPublisherAttribution(text) {
  const before = String(text ?? '');
  const after = before.replace(IN_BRACKETS, '').replace(WITH_NOUN, '$1에 따르면').replace(BARE, '')
    .replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([.,。，])/g, '$1');
  return { text: after, named: after !== before };
}
