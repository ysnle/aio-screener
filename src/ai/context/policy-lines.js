// P1740: the policy rates, Korean official references and release calendar the screens already read (P1731–P1737),
// in the chat's domain block. Each value carries its own reference date; a held (expired) value is said to be held,
// never filled. includeKorea adds the BOK rate, Korean CPI and the export flash.
import { releaseAtMs } from '../../domain/briefing/schedule.js';

const day = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? String(iso).slice(0, 10) : '');

export function buildChatPolicyLines({ root = globalThis, includeKorea = false, now = Date.now() } = {}) {
  const out = [];
  let snap = root.DATA_SNAPSHOT || {};
  const ts = snap._fieldTs || {};
  try {
    const fed = root.AIO?.getFedPolicyRange?.();
    if (fed?.range) out.push(`• 연준 목표금리 범위: ${fed.range}${day(fed.asOf) ? ` (기준 ${day(fed.asOf)})` : ''}`);
    else if (fed?.held) out.push('• 연준 목표금리 범위: 확인 기한이 지나 보류 — 수치를 추정하지 마라');
  } catch {}
  if (includeKorea) {
    // The expiry registry (P1736) decides whether a hand-kept or produced value may still be read as current.
    let exportsHeld = false;
    try { exportsHeld = !!root.AIO?.getManualReferenceState?.('krExports')?.held; } catch {}
    const published = Date.parse(snap.krExportReference?.publishedAt || '');
    if (exportsHeld || (published && (now - published) / 86400000 > 15)) {
      const at = day(snap.krExportReference?.publishedAt);
      out.push(`• 한국 수출 잠정치: 마지막 확인값${at ? `(공표 ${at})` : ''}이 확인 기한을 넘겨 현재 값으로 쓰지 않는다 — 최신 잠정치는 미확인`);
      snap = { ...snap, krExportReference: null };
    }
    const next = snap.bokNext ? ` · 다음 금통위 ${snap.bokNext}` : '';
    if (snap.bokRate != null) out.push(`• 한국은행 기준금리: ${snap.bokRate}%${snap.bokStatus ? ` · ${snap.bokStatus}` : ''}${day(ts.bok_rate) ? ` (기준 ${day(ts.bok_rate)})` : ''}${next}`);
    else out.push(`• 한국은행 기준금리: 확인 보류${next}`);
    if (snap.krCpi != null) out.push(`• 한국 소비자물가(전년 대비): ${snap.krCpi}%${snap.krCoreCpi != null ? ` · 근원 ${snap.krCoreCpi}%` : ''}${day(ts.kr_cpi) ? ` (공표 ${day(ts.kr_cpi)})` : ''}`);
    const ex = snap.krExportReference;
    if (ex?.exportsYoyPct != null) out.push(`• 한국 수출 잠정치: 전년 대비 ${ex.exportsYoyPct}%${ex.exportsBillionUsd != null ? ` · ${ex.exportsBillionUsd}십억 달러` : ''}${ex.periodLabel || ex.period ? ` (${ex.periodLabel || ex.period})` : ''}${day(ex.publishedAt) ? ` · 공표 ${day(ex.publishedAt)}` : ''}`);
  }
  try {
    const releases = root.AIO_MACRO_CALENDAR?.releases || {};
    const today = new Date(now).toISOString().slice(0, 10);
    const horizon = new Date(now + 21 * 86400000).toISOString().slice(0, 10);
    const upcoming = Object.entries(releases).map(([id, r]) => ({ id, name: r?.name || id, date: day(r?.nextRelease) }))
      // v58.81: a release whose time has passed is not upcoming (the UTC date alone kept this morning's release listed).
      .filter((r) => r.date && (Number.isFinite(releaseAtMs(r.id, r.date)) ? releaseAtMs(r.id, r.date) > now : r.date >= today) && r.date <= horizon && r.id !== 'us-fed-rate' && (includeKorea || !/^kr-/.test(r.id)))
      .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
    if (upcoming.length) out.push(`• 다가오는 공식 일정(3주): ${upcoming.map((r) => `${r.date.slice(5)} ${r.name}`).join(' · ')}`);
  } catch {}
  return out;
}
