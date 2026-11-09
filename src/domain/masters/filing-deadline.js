// ADR-0003 S3: the 13F currentness rule, moved unchanged from src/ui/pages/masters.js so the page renders a
// verdict instead of computing one.
// 13F is due 45 days after each quarter end; a holding set is stale once the following quarter's deadline has passed.
export function thirteenFStale(periodOfReport, now = Date.now()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(periodOfReport || ''));
  if (!match) return false;
  const nextQuarterEnd = Date.UTC(Number(match[1]), Number(match[2]) + 3, 0);
  // A deadline on a weekend rolls to the next Monday (SEC business-day rule); holidays are ignored.
  let due = nextQuarterEnd + 45 * 86400000;
  const weekday = new Date(due).getUTCDay();
  if (weekday === 6) due += 2 * 86400000;
  else if (weekday === 0) due += 86400000;
  return now >= due + 86400000;
}
