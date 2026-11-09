// v59.70 (D5, owner decision): the 한국 기준금리·물가·수출 facts the retired 매크로 fold (#kr-integrated-macro) showed now sit
// as one card on the 시장 상태 한국 board. Pure: reads the DATA_SNAPSHOT fields the snapshot writer (js/aio-core.js)
// already settles — a held or expired reference arrives there as null, so nothing here re-decides expiry.
import { readNumber } from '../../shared/number.js';

const md = (iso) => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${Number(m[1])}/${Number(m[2])}` : ''; };

export function koreaExportText(ref) {
  const billion = readNumber(ref?.exportsBillionUsd);
  if (!ref || ref.status === 'stale-reference' || billion == null) return '';
  const period = String(ref.periodLabel || '공식 잠정치').replace(/^\d{4}-(\d{2})-(\d{2})~(\d{2})$/, (m, mo, d1, d2) => `${Number(mo)}/${Number(d1)}~${Number(d2)}`);
  const yoy = readNumber(ref.exportsYoyPct);
  const amount = Math.round(billion * 10).toLocaleString('ko-KR');
  const change = yoy != null ? `, 전년 같은 기간 대비 ${yoy > 0 ? '+' : ''}${yoy.toFixed(1)}%` : '';
  // Same-period comparisons this large are mostly the calendar (holidays, working days).
  const calendar = yoy != null && Math.abs(yoy) >= 30 ? '(같은 날짜 구간 비교라 명절·조업일수 차이가 크게 섞일 수 있습니다)' : '';
  return `수출(${period} 잠정) ${amount}억 달러${change}${calendar}`;
}

/** { title, caption, value, lines } or null when no Korean policy, price or export fact is current. */
export function koreaPolicyCard(snapshot) {
  const s = snapshot || {};
  const rate = readNumber(s.bokRate);
  const cpi = readNumber(s.krCpi);
  const exportText = koreaExportText(s.krExportReference);
  if (rate == null && cpi == null && !exportText) return null;
  const basis = md(s._fieldTs?.bok_rate);
  const caption = ['한국은행 공식 발표', s.bokStatus ? `${s.bokStatus}${basis ? ` ${basis} 결정` : ''}` : (basis ? `${basis} 결정` : '')].filter(Boolean).join(', ');
  const lines = [];
  if (s.bokNext) lines.push(`다음 금통위 ${s.bokNext}`);
  if (cpi != null) {
    const gap = cpi - 2;
    lines.push(`소비자물가 전년 대비 ${cpi > 0 ? '+' : ''}${cpi.toFixed(1)}%, ${Math.abs(gap) < 0.05 ? '목표 2%와 같은 수준' : `목표 2%보다 ${Math.abs(gap).toFixed(1)}%p ${gap > 0 ? '높음' : '낮음'}`}`);
  }
  if (exportText) lines.push(exportText);
  return { title: '한국 금리·물가·수출', caption, value: rate != null ? `기준금리 ${rate.toFixed(2)}%` : '기준금리 기한 지남', lines };
}
