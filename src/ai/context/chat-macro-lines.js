// The chat's macro and fxbond domain blocks. Each figure is a typed row the screens print and the claim registry binds:
// completed closes (source=close-basis) and the official releases (source=macro-release), with its own date and
// evidenceId. A live quote or an undated snapshot figure appears only when no typed row exists, and is labelled as
// reference that the answer may not state as current.
import { readNumber } from '../../domain/shared/number.js';

const UNIT_TEXT = { percent: '%', bp: 'bp', thousands: '천 명', index: '', usd_per_barrel: '달러', usd_per_ounce: '달러', krw_per_usd: '원' };
const signed = (v) => `${v > 0 ? '+' : ''}${v}`;
const joinParts = (list) => list.filter(Boolean).join(', ');

/** Korean time on any device ('YYYY-MM-DD HH:mm KST'); '' when Intl is unavailable. */
export function kstStamp(at = new Date()) {
  try {
    const parts = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(at instanceof Date ? at : new Date(at)).forEach((part) => { parts[part.type] = part.value; });
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour === '24' ? '00' : parts.hour}:${parts.minute} KST`;
  } catch { return ''; }
}

export function citeEvidenceRow(r, name, isSigned = false) {
  if (!r) return null;
  const when = r.period === 'month' ? `${String(r.asOf).slice(0, 7)} 기준월` : `${String(r.asOf).slice(0, 10)}${r.source === 'close-basis' ? ' 종가' : ' 관측'}`;
  return `${name} ${isSigned ? signed(r.value) : r.value}${UNIT_TEXT[r.unit] ?? ''} (${when}, evidenceId=${r.evidenceId})`;
}

/** The lines for ctxId 'macro' | 'kr-macro' | 'fxbond' (header first), or [] when nothing is available. */
export function buildChatMacroLines({ ctxId, root = globalThis, timeLabel = '' } = {}) {
  let ev = [];
  try { ev = typeof root._aioScreenBasisEvidence === 'function' ? (root._aioScreenBasisEvidence() || []) : []; } catch { ev = []; }
  const row = (metric) => ev.find((r) => r && r.metric === metric) || null;
  const cite = citeEvidenceRow;
  const snap = root.DATA_SNAPSHOT || {};
  const pick = (...keys) => { for (const k of keys) { const v = snap[k]; if (v != null && v !== '') return v; } return null; };
  // One rates line for both blocks (the question builder drops an identical line when both are selected).
  const rateLine = () => {
    const parts = joinParts([cite(row('close.us10y'), '10Y'), cite(row('close.us10y.chg20d'), '10Y 20거래일', true), cite(row('macro.us2y'), '2Y'), cite(row('macro.curve_2s10s'), '10Y−2Y', true)]);
    return parts ? `• 미 국채: ${parts}${row('macro.curve_2s10s') ? ' — 금리차는 공식 곡선의 같은 날 값이며, 역전 자체보다 역전이 풀리며 가팔라지는 시점이 과거 경기침체와 더 가까웠습니다(시점 판단에는 쓰지 않음)' : ''}` : null;
  };
  const lines = [];

  if (ctxId === 'macro' || ctxId === 'kr-macro') { // 'kr-macro' = the question-selected Korean domain block (market-content.js)
    const vixLine = cite(row('close.vix'), 'VIX');
    if (vixLine) lines.push(`• 변동성: ${vixLine}`);
    const infl = joinParts([cite(row('macro.cpi_yoy'), 'CPI'), cite(row('macro.core_cpi_yoy'), '근원 CPI'), cite(row('macro.pce_yoy'), 'PCE'), cite(row('macro.core_pce_yoy'), '근원 PCE'),
      cite(row('macro.core_pce_3m_ann'), '근원 PCE 3개월 연율'), cite(row('macro.core_pce_mom'), '근원 PCE 전월 대비', true)]);
    if (infl) lines.push(`• 물가(전년 대비, 공식 발표): ${infl}`);
    else {
      // No typed release rows yet (macro block not loaded): the snapshot values are unbound reference only.
      const ref = [['CPI', pick('cpi', 'cpiYoy')], ['근원 CPI', pick('coreCpi', 'coreCpiYoy')], ['PCE', pick('pce', 'pceYoy')], ['근원 PCE', pick('corePce', 'corePceYoy')]]
        .map(([name, v]) => (readNumber(v) != null ? `${name} ${readNumber(v)}%` : null)).filter(Boolean);
      if (ref.length) lines.push(`• 물가(스냅샷 참고, 근거 행 없음 — 현재 수치로 단정하지 않음): ${ref.join(', ')}`);
    }
    const jobs = joinParts([cite(row('macro.unemployment'), '실업률'), cite(row('macro.nfp_change'), '비농업 고용 전월 대비', true), cite(row('macro.ahe_yoy'), '시간당 임금 전년 대비')]);
    if (jobs) lines.push(`• 고용(공식 발표): ${jobs}`);
    // The policy rate is the target range the screen shows (AIO.getFedPolicyRange); the next FOMC comes from the official calendar.
    try { (root.AIO?.buildChatPolicyLines?.({ root, includeKorea: ctxId === 'kr-macro' }) || []).forEach((line) => lines.push(line)); } catch {}
    const rates = rateLine(); if (rates) lines.push(rates);
    const real = row('macro.real10y'), be = row('macro.breakeven10');
    const realBe = joinParts([cite(real, '10Y 실질금리'), cite(be, '10Y 기대인플레이션')]);
    if (realBe) lines.push(`• 실질금리·기대인플레이션: ${realBe}${real && be && real.asOf !== be.asOf ? ' — 두 값의 관측일이 달라 합이 10Y와 같다고 쓰지 않음' : ''}`);
    if (lines.length) lines.unshift(`【거시 도메인 데이터 (화면과 같은 확정 종가·공식 발표), ${timeLabel}】`);
  } else if (ctxId === 'fxbond') {
    const fx = joinParts([cite(row('close.dxy'), 'DXY'), cite(row('close.dxy.chg20d'), 'DXY 20거래일', true), cite(row('close.usdkrw'), '원/달러'), cite(row('close.usdkrw.chg20d'), '원/달러 20거래일', true)]);
    if (fx) lines.push(`• 달러·환율: ${fx} — 달러 강약은 20거래일 변화로 판단(원/달러 상승 = 원화 약세)`);
    else {
      const dxy = readNumber(root._liveData?.['DX-Y.NYB']?.price) ?? readNumber(pick('dxy'));
      if (dxy != null) lines.push(`• 달러(DXY, 실시간/스냅샷 참고, 기준일 미확인): ${dxy.toFixed(2)} — 수준만으로 강약을 단정하지 않음`);
    }
    const rates = rateLine(); if (rates) lines.push(rates);
    // The credit level is the FRED HY OAS (bp), not the HYG price (which carries rate duration).
    const hyRow = row('close.hy_oas');
    if (hyRow) lines.push(`• 크레딧: ${cite(hyRow, '하이일드 스프레드(HY OAS)')}`);
    else {
      const hyBp = readNumber(root._hySpreadBp);
      if (hyBp != null) lines.push(`• 크레딧(HY OAS, 기준일 미확인): ${Math.round(hyBp)}bp`);
    }
    if (lines.length) lines.unshift(`【외환·채권 도메인 데이터 (화면과 같은 확정 종가·공식 발표), ${timeLabel}】`);
  }
  return lines;
}
