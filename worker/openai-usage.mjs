// P1421: observe upstream usage without modifying Responses JSON/SSE bytes.
// A malformed, truncated, failed, oversized or cancelled receipt never refunds.
export function createOpenAiReceiptObserver(contentType) {
  const isSse = /^text\/event-stream(?:;|$)/i.test(contentType || '');
  const decoder = new TextDecoder();
  let buffer = '';
  let bytes = 0;
  let invalid = false;
  let completedResponse = null;
  const maximum = 2 * 1024 * 1024;
  const parseFrame = frame => {
    const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return;
    try {
      const event = JSON.parse(data);
      if (event.type === 'response.completed') completedResponse = event.response;
      if (['error','response.failed','response.incomplete'].includes(event.type)) invalid = true;
    } catch { invalid = true; }
  };
  const consumeFrames = () => {
    let match;
    while ((match = /\r?\n\r?\n/.exec(buffer))) {
      parseFrame(buffer.slice(0, match.index));
      buffer = buffer.slice(match.index + match[0].length);
    }
    if (buffer.length > maximum) invalid = true;
  };
  return {
    push(chunk) {
      if (invalid) return;
      bytes += chunk.byteLength;
      if (bytes > maximum) { invalid = true; buffer = ''; return; }
      buffer += decoder.decode(chunk, { stream: true });
      if (isSse) consumeFrames();
    },
    finish() {
      if (invalid) return null;
      buffer += decoder.decode();
      if (isSse) {
        consumeFrames();
        // A terminal event must be a complete SSE frame, not a partial suffix.
        return !invalid && !buffer.trim() ? completedResponse : null;
      }
      try { return JSON.parse(buffer); } catch { return null; }
    }
  };
}
