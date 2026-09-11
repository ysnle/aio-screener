// Shared by the SEC producer and the historical selector. A missing fact is
// not zero; ratios must not join unrelated fiscal periods.
export function finiteFact(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sameFiscalPeriod(left, right) {
  const leftEnd = left?.periodEnd || left?.end;
  const rightEnd = right?.periodEnd || right?.end;
  if (!leftEnd || leftEnd !== rightEnd || !Number.isFinite(Date.parse(leftEnd))) return false;
  const leftStart = left?.periodStart || left?.start;
  const rightStart = right?.periodStart || right?.start;
  return !leftStart || !rightStart || leftStart === rightStart;
}

export function isPriorAnnualPeriod(current, prior) {
  const days = (Date.parse(current?.periodEnd || current?.end || '') - Date.parse(prior?.periodEnd || prior?.end || '')) / 86400000;
  // Matches the producer's supported annual duration range; a missing fiscal
  // year must never become a one-year growth observation.
  return Number.isFinite(days) && days >= 300 && days <= 400;
}
