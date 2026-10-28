// Expect cases for 오늘 "지난 마감 이후 변화" (buildDailyChanges): the headline, each compared move and the measures
// named as not compared, for an ordinary session pair, a US holiday gap, a missing previous value and too little history.
export const suite = { name: 'daily-changes', source: 'src/domain/briefing/daily-diff.js' };

const row = (date, values) => ({ date, ...values });
const base = { spx: 6800, nasdaq: 23000, vix: 17.2, tnx: 4.12, dxy: 101.4, wti: 88.1, breadth50: 61, fg: 55, kospi: 4100, kosdaq: 900, usdkrw: 1395 };

const print = (diff) => !diff.available ? `unavailable: ${diff.reason}` : [
  `basis: ${diff.prevDate} → ${diff.date}${diff.missing?.length ? ` (사이 거래일 ${diff.missing.join(', ')})` : ''}`,
  `headline: ${diff.headline}`,
  ...diff.moves.map((move) => `- ${move.label}: ${move.text}${move.level ? ` (수준 ${move.level})` : ''}${move.market === 'KR' ? ` [한국 ${move.from} → ${move.to}]` : ''}`),
  ...diff.notComparedNotes.map((note) => `- 비교 안 함 ${note.label}: ${note.reason}`)
].join('\n');

export default async function cases({ load }) {
  const { buildDailyChanges } = await load(suite.source);
  const scenarios = [
    ['ordinary-pair-with-large-index-move', { now: '2026-10-28T00:30:00Z', history: [
      row('2026-10-26', base),
      row('2026-10-27', { ...base, spx: 6650, nasdaq: 22300, vix: 21.9, tnx: 4.05, dxy: 101.9, wti: 86.0, breadth50: 52, fg: 41, kospi: 4010, kosdaq: 880, usdkrw: 1402 })
    ] }],
    ['thanksgiving-gap', { now: '2026-11-28T03:00:00Z', history: [
      row('2026-11-25', base),
      row('2026-11-27', { ...base, spx: 6830, vix: 16.8 })
    ] }],
    ['previous-value-missing', { now: '2026-10-28T08:00:00Z', history: [
      row('2026-10-26', { spx: 6800, vix: 17.2 }),
      row('2026-10-27', { spx: 6812, vix: 17.0, wti: 87.5, tnx: 4.1 })
    ] }],
    ['one-session-only', { now: '2026-10-28T08:00:00Z', history: [row('2026-10-27', base)] }]
  ];
  return scenarios.map(([name, input]) => ({ name, input, output: print(buildDailyChanges(input.history, { now: Date.parse(input.now) })) }));
}
