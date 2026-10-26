// v58.82 (roadmap 12): transport for the feedback note (src/ui/components/feedback-form.js) and the owner's read.
// The AIO Worker is the only destination; the operator token travels as a header, never in a URL.
export async function sendFeedback({ fetchImpl, workerUrl, appToken, text, route, version }) {
  try {
    const response = await fetchImpl(workerUrl + '/feedback', {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-AIO-App-Token': appToken || '' },
      body: JSON.stringify({ text, route, version }),
    });
    if (response.status === 201) return 'sent';
    return response.status === 429 ? 'limit' : 'failed';
  } catch { return 'failed'; }
}


export async function readFeedback({ fetchImpl, workerUrl, operatorToken }) {
  try {
    const response = await fetchImpl(workerUrl + '/_ops/feedback', { credentials: 'omit', cache: 'no-store', headers: { 'X-AIO-Operator-Token': operatorToken } });
    if (!response.ok) return { ok: false, status: response.status };
    const items = (await response.json())?.items;
    return { ok: true, items: Array.isArray(items) ? items : [] };
  } catch { return { ok: false, status: 0 }; }
}
