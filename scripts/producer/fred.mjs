// FRED API plane (the operator key in Actions): the configured series with their deltas and year-over-year reads.
// Split out of scripts/fetch-data.mjs (pipeline redesign, 2026-10-19); fetch-data.mjs keeps the run order and re-exports
// every name it exported before.
import { round } from '../lib/producer-math.mjs';
import { fetchJSON } from '../lib/producer-http.mjs';
import { FRED_SERIES } from '../lib/macro-sources.mjs';
import { deriveFredCycle } from '../lib/refresh-continuity.mjs';

// ── FRED ──
export async function fetchFred(key) {
  const attemptedAt = new Date().toISOString();
  if (!key) return {
    _source: 'fred:no-key',
    _attemptedAt: attemptedAt,
    _successfulSeries: [],
    _failedSeries: [],
    _failureReason: 'api-key-not-configured'
  };
  // P565/R256: a single failed FRED series used to be swallowed with no log and no field-level
  // flag — only the aggregate macroKeyCount dropped by one, with nothing telling anyone WHICH
  // series broke. enrichFundamentals (FMP) already detects and surfaces plan/auth errors
  // explicitly; this brings FRED to the same standard so a stale/broken series (the mechanism
  // behind Fed/BOJ/BOK/BOE rates going 15-62 days stale) is visible instead of silent.
  const out = { _source: 'fred', _attemptedAt: attemptedAt, _failedSeries: [], _successfulSeries: [] };
  const markFailed = (field) => {
    if (!out._failedSeries.includes(field)) out._failedSeries.push(field);
  };
  for (const [field, spec] of Object.entries(FRED_SERIES)) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${spec.id}` +
        `&api_key=${key}&file_type=json&sort_order=desc&limit=14`;
      // P1336: one transient runner→FRED abort failed CPI/UNRATE for a whole cycle; retry once after 3 s.
      const j = await fetchJSON(url).catch(async () => { await new Promise((r) => setTimeout(r, 3000)); return fetchJSON(url); });
      // A provider can return an HTTP-success JSON envelope containing no
      // usable observations (rate-limit/error payload, '.', or NaN).  Such a
      // response is a failed series, never a current null/zero observation.
      const obs = (j.observations || [])
        .map((o) => ({ d: String(o?.date || ''), v: Number.parseFloat(o?.value) }))
        .filter((o) => /^\d{4}-\d{2}-\d{2}$/.test(o.d) && Number.isFinite(o.v))
        .sort((a, b) => b.d.localeCompare(a.d));
      if (!obs.length) {
        markFailed(field);
        continue;
      }
      let succeeded = false;
      if (spec.kind === 'level') {
        // v51.97/Phase 2 [B2]: scale — 시리즈 원 단위(예: HOUST=천 단위)를 소비처 단위(백만)로
        // 변환. 미지정 시 1(기존 fedRate/unemployment 등 동작 불변).
        const scale = spec.scale || 1;
        const level = round(obs[0].v * scale, 3);
        if (level === null) {
          markFailed(field);
          continue;
        }
        out[field] = level;
        succeeded = true;
        // MoM delta: 이번 달 레벨 - 지난 달 레벨
        if (obs.length >= 2) {
          const delta = round((obs[0].v - obs[1].v) * scale, 3);
          if (delta !== null) out[field + 'Delta'] = delta;
        }
        // P1390: a one-week change (5 observations) for daily series that drive the briefing read.
        if (spec.delta5 && obs.length >= 6) {
          const delta5 = round((obs[0].v - obs[5].v) * scale, 3);
          if (delta5 !== null) out[field + 'Delta5'] = delta5;
        }
      } else if (spec.kind === 'mom_pct') {
        // v51.97/Phase 2 [B2]: 레벨(예: RSAFS 소매판매 $) 시리즈의 전월 대비 변화율(%).
        if (obs.length >= 2 && obs[1].v !== 0) {
          const change = round((obs[0].v / obs[1].v - 1) * 100, 1);
          if (change !== null) {
            out[field] = change;
            succeeded = true;
          }
        }
      } else if (spec.kind === 'yoy') {
        const cur = obs[0];
        // Do not substitute the oldest available point when an exact
        // twelve-month comparator is absent: that would label a 13/14-month
        // change as YoY and silently falsify the observation period.
        const yoy = obs.find(o => monthsBetween(o.d, cur.d) === 12);
        const curYoY = (yoy && yoy.v !== 0) ? round((cur.v / yoy.v - 1) * 100, 1) : null;
        if (curYoY !== null) {
          out[field] = curYoY;
          succeeded = true;
        }
        // MoM delta in YoY rate: 이번 달 YoY - 지난 달 YoY (인플레이션 속도 변화)
        if (obs.length >= 2) {
          const prev = obs[1];
          const yoyPrev = obs.find(o => monthsBetween(o.d, prev.d) === 12);
          const prevYoY = (yoyPrev && yoyPrev.v !== 0 && yoyPrev.d !== yoy?.d)
            ? round((prev.v / yoyPrev.v - 1) * 100, 1) : null;
          if (curYoY !== null && prevYoY !== null) out[field + 'Delta'] = round(curYoY - prevYoY, 1);
        }
      } else if (spec.kind === 'mom_diff') {
        if (obs.length >= 2 && Number.isFinite(obs[0].v - obs[1].v)) {
          out[field] = Math.round(obs[0].v - obs[1].v); // 천명
          succeeded = true;
        }
        // 전월 대비 delta: 이번 달 변화 - 지난 달 변화
        if (succeeded && obs.length >= 3) {
          const delta = Math.round((obs[0].v - obs[1].v) - (obs[1].v - obs[2].v));
          if (Number.isFinite(delta)) out[field + 'Delta'] = delta;
        }
      }
      if (succeeded) {
        out._successfulSeries.push(field);
        out['_asOf_' + field] = obs[0].d;
      } else {
        markFailed(field);
      }
    } catch (e) {
      markFailed(field);
      console.warn(`[fetch-data] FRED series 실패: ${field} (${spec.id}) — ${e.message}`);
    }
  }
  return out;
}

function monthsBetween(a, b) {
  const da = new Date(a), db = new Date(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

// A FRED cycle is successful only when every configured series has a finite value. Partial responses remain usable
// through per-field LKG merge, but the cycle cannot claim a fresh aggregate timestamp. v50.78: hasKey (Secret present)
// and fetchOk (data actually received) stay separate so a missing Secret never reads as an API failure.
export function deriveFredPlane({ configured, macroRaw, previousMacro, previousMeta, attemptedAt }) {
  const expected = Object.keys(FRED_SERIES);
  const cycle = deriveFredCycle({ configured, expected, current: macroRaw || {}, previous: previousMacro || {}, previousMeta: previousMeta || {}, attemptedAt });
  return { expected, cycle, fetched: cycle.successful, failed: cycle.failed, fetchOk: cycle.complete, lkgUsed: cycle.lkgUsed };
}
