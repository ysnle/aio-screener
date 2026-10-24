import { signedText } from '../shared/number.js';
// P1654: OpenDART annual accounts (public-data/kr-fundamentals.json) as readable points for a Korean listing.
// Figures are the filing's own KRW values; ratios are computed from the same report and say which basis they use.
export const KR_FUNDAMENTALS = Object.freeze({ key: '_aioKrFundamentals', url: './public-data/kr-fundamentals.json', schemas: ['kr-fundamentals.v1'], maxAgeMs: 12 * 60 * 60 * 1000, maxBytes: 1024 * 1024 });

const krw = (value) => {
  if (!Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(abs >= 1e14 ? 0 : 1)}조원`;
  if (abs >= 1e8) return `${sign}${Math.round(abs / 1e8).toLocaleString('en-US')}억원`;
  return `${sign}${Math.round(abs).toLocaleString('en-US')}원`;
};
const growth = (now, then) => (Number.isFinite(now) && Number.isFinite(then) && then > 0 ? (now / then - 1) * 100 : null);
const signed = (value) => `${signedText(value, 1)}%`;

export function krFundamentalPoints(company) {
  if (!company?.current) return null;
  const c = company.current, p = company.prior || {};
  const points = [];
  if (Number.isFinite(c.revenue)) {
    const g = growth(c.revenue, p.revenue);
    points.push({ id: 'growth', title: '매출', text: `${krw(c.revenue)}${g == null ? '' : ` (전년 대비 ${signed(g)})`}` });
  }
  if (Number.isFinite(c.operatingIncome) && Number.isFinite(c.revenue) && c.revenue > 0) {
    const margin = c.operatingIncome / c.revenue * 100;
    const prior = Number.isFinite(p.operatingIncome) && p.revenue > 0 ? p.operatingIncome / p.revenue * 100 : null;
    points.push({ id: 'margin', title: '영업이익률', text: `${margin.toFixed(1)}%${prior == null ? '' : ` (전년 ${prior.toFixed(1)}%)`}, 영업이익 ${krw(c.operatingIncome)}` });
  }
  if (Number.isFinite(c.netIncome) && Number.isFinite(c.equity) && c.equity > 0) {
    points.push({ id: 'roe', title: '자기자본이익률(ROE)', text: `${(c.netIncome / c.equity * 100).toFixed(1)}%, 순이익 ${krw(c.netIncome)} (기말 자본 기준)` });
  }
  if (Number.isFinite(c.liabilities) && Number.isFinite(c.equity) && c.equity > 0) {
    points.push({ id: 'debt', title: '부채비율', text: `${(c.liabilities / c.equity * 100).toFixed(0)}% (부채 ${krw(c.liabilities)} / 자본 ${krw(c.equity)})` });
  }
  if (!points.length) return null;
  return {
    points,
    basisLines: [
      `${company.fiscalYear} 회계연도 사업보고서, ${company.basis === 'CFS' ? '연결' : '별도'} 재무제표`,
      company.receiptNo ? `전자공시 접수번호 ${company.receiptNo}` : '접수번호 미확인',
      '금융감독원 전자공시(OpenDART) 주요계정, 주가 수익률 기간과 직접 동일시하지 않습니다.'
    ]
  };
}
