// P1468 (review 2026-10-04, "팩터 중복"): momentum, trend and the Kalman slope are all computed from the
// same price path. Instead of asserting that they overlap, measure it on today's ranked universe:
// pairwise Spearman correlation of the sector-normalized factor z-scores, and the effective number of
// independent signals of the active factors (participation ratio of the correlation matrix's
// eigenvalues: (Σλ)² ÷ Σλ²; equals the factor count when uncorrelated, 1 when identical).
// The weights are not changed here — a decorrelated model is a different model and must be validated
// as one (the candidate record, P1465, is where that evidence accumulates).
const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function ranks(values) {
  const order = values.map((value, index) => [value, index]).sort((a, b) => a[0] - b[0]);
  const out = new Array(values.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
    const average = (i + j) / 2;
    for (let k = i; k <= j; k += 1) out[order[k][1]] = average;
    i = j + 1;
  }
  return out;
}

export function spearmanPairs(xs, ys) {
  const rx = ranks(xs);
  const ry = ranks(ys);
  const n = rx.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i += 1) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

// Eigenvalues of a small symmetric matrix (Jacobi rotations).
function symmetricEigenvalues(matrix) {
  const n = matrix.length;
  const a = matrix.map((row) => [...row]);
  for (let sweep = 0; sweep < 60; sweep += 1) {
    let off = 0;
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) off += a[p][q] ** 2;
    if (off < 1e-12) break;
    for (let p = 0; p < n; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k += 1) {
          const akp = a[k][p]; const akq = a[k][q];
          a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k += 1) {
          const apk = a[p][k]; const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
        }
      }
    }
  }
  return a.map((row, i) => row[i]);
}

export const FACTOR_LABELS = Object.freeze({ momentum: '모멘텀', trend: '추세', lowvol: '저변동', kalman: '칼만 추세', size: '규모', value: '밸류', quality: '퀄리티' });

export function measureFactorOverlap(rows = [], activeFactors = []) {
  const factors = (activeFactors || []).filter((factor) => FACTOR_LABELS[factor]);
  if (factors.length < 2) return null;
  const complete = (rows || []).filter((row) => factors.every((factor) => finite(row?.[`_z_${factor}`]) != null));
  if (complete.length < 30) return null;
  const column = (factor) => complete.map((row) => row[`_z_${factor}`]);
  const matrix = factors.map((a) => factors.map((b) => (a === b ? 1 : spearmanPairs(column(a), column(b)) ?? 0)));
  const pairs = [];
  for (let i = 0; i < factors.length; i += 1) {
    for (let j = i + 1; j < factors.length; j += 1) pairs.push({ a: factors[i], b: factors[j], label: `${FACTOR_LABELS[factors[i]]}–${FACTOR_LABELS[factors[j]]}`, rho: Math.round(matrix[i][j] * 100) / 100 });
  }
  const eigen = symmetricEigenvalues(matrix).map((value) => Math.max(0, value));
  const sum = eigen.reduce((a, b) => a + b, 0);
  const sumSq = eigen.reduce((a, b) => a + b * b, 0);
  const effective = sumSq > 0 ? sum * sum / sumSq : null;
  return {
    n: complete.length,
    factors,
    pairs: pairs.sort((x, y) => Math.abs(y.rho) - Math.abs(x.rho)),
    effective: effective == null ? null : Math.round(effective * 10) / 10
  };
}

export function overlapSentence(overlap) {
  if (!overlap) return '모멘텀·추세·칼만 추세는 같은 가격 움직임에서 계산돼 서로 겹칠 수 있습니다(오늘 표본으로는 측정하지 못했습니다).';
  const strongest = overlap.pairs[0];
  const high = overlap.pairs.filter((pair) => Math.abs(pair.rho) >= 0.6).map((pair) => `${pair.label} ${pair.rho.toFixed(2)}`);
  return `오늘 ${overlap.n}종목에서 잰 순위 상관: ${high.length ? high.join(' · ') : `가장 높은 쌍 ${strongest.label} ${strongest.rho.toFixed(2)}`} — 지표 ${overlap.factors.length}개가 실질적으로는 독립된 신호 약 ${overlap.effective?.toFixed(1) ?? '—'}개만큼의 정보입니다. 함께 높다고 근거가 그 수만큼 쌓인 것은 아닙니다.`;
}
