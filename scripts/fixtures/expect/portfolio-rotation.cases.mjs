// Expect cases for the portfolio rotation sentence (P2115): what 포트폴리오 prints for a sector held in the RRG band or
// reversing against its quadrant. The reversal clause from recent-check.js starts with ', ', so a strip that only knew
// ' · ' left "사분면이지만 , 최근 5거래일 …" on screen.
export const suite = { name: 'portfolio-rotation', source: 'src/domain/portfolio/portfolio-read.js' };

const quiet = Array.from({ length: 60 }, (_, i) => ({ sessionDate: `d${i}`, value: 100 + Math.sin(i / 3) * 0.6 }));
const falling = [...quiet, ...[100.4, 99.2, 98.0, 96.9, 95.9].map((value, i) => ({ sessionDate: `e${i}`, value }))];
const rows = [{ sym: 'MSFT', sector: 'Technology', pctSma50: 5.95, pctSma200: 23.1 }];
const surface = { rows: [{ symbol: 'MSFT', value: 100 }] };

export default async function cases({ load }) {
  const { buildPortfolioRead } = await load(suite.source);
  const scenarios = [
    ['leading-reversing-fell', { quadrant: 'Leading', rsRatio: 105, rsMomentum: 103, relativeStrength: falling }],
    ['band-with-reversal', { quadrant: 'Leading', rsRatio: 100.33, rsMomentum: 102.02, relativeStrength: falling }],
    ['clear-leading', { quadrant: 'Leading', rsRatio: 105, rsMomentum: 103, relativeStrength: quiet }]
  ];
  return scenarios.map(([name, xlk]) => {
    const read = buildPortfolioRead({ surface, rows, rotation: { XLK: xlk } });
    const quadrant = read.sectorMix?.[0]?.quadrant;
    const rotation = read.points?.find((point) => point.id === 'rotation');
    const input = { ...xlk, relativeStrength: `${xlk.relativeStrength.length} points, last ${xlk.relativeStrength.at(-1).value}` };
    return { name, input, output: [`quadrant: ${quadrant?.label ?? '(없음)'} | why: ${quadrant?.why || '(없음)'}`, `tone: ${rotation?.tone ?? '(없음)'}`, `text: ${rotation?.text ?? '(없음)'}`].join('\n') };
  });
}
