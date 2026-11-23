export function monthLabel(date) {
  const text = String(date || '');
  const month = Number(text.slice(5, 7));
  return /^\d{4}-\d{2}/.test(text) && month ? `${text.slice(2, 4)}년 ${month}월` : '';
}

export function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

export function shortDateAgainst(date, latest) {
  const text = shortDate(date);
  const year = String(date || '').slice(0, 4);
  return text && /^\d{4}$/.test(year) && year !== String(latest || '').slice(0, 4) ? `${year}/${text}` : text;
}
