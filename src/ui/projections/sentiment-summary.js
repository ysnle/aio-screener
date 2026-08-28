function formatScore(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(0) : '—';
}

function setText(documentRef, id, value) {
  const element = documentRef?.getElementById(id);
  if (element) element.textContent = value;
}

// Small cross-route projection kept outside the sentiment route chunk. Bootstrap can
// update canonical score sinks without eagerly loading the chart-heavy page renderer.
export function renderSentimentSummaryProjection(documentRef, summary) {
  const scoreText = formatScore(summary?.fearGreed?.score);
  setText(documentRef, 'fg-score-big', scoreText);
  setText(documentRef, 'fg-score-val', scoreText);
  setText(documentRef, 'fg-rating-text', summary?.fearGreed?.label || '판정 보류');
  setText(documentRef, 'vix-term-regime-text', summary?.vixTermStructure?.regime || '판정 보류');
}
