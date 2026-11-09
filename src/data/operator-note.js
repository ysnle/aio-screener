// v59.70 (L3): the operator-note.json loader and its placeholder check, moved unchanged from js/aio-data.js. The note
// renders through window._aioRenderOperatorNote (src/ui/components/home-status-surface.js).
import { artifactUrl } from './artifact-registry.js';
export function installOperatorNote(window = globalThis) {
  function _aioIsOperatorNotePlaceholder(note) {
    try {
      var title = String((note && note.title) || '');
      var body = String((note && note.body) || '');
      return /제목을 여기에 작성하세요|운영자 노트 — 제목/.test(title) ||
             /여기에 본문을 작성하세요|예시: 나스닥 RSI/.test(body);
    } catch(_) { return true; }
  }
  async function _aioLoadOperatorNote() {
    try {
      var url = artifactUrl('operator-note.json'); // v57.61 (perf): no-cache revalidation, no buster
      var r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) return;
      var d = await r.json();
      var _noteAgeDays = (Date.now() - Date.parse(String((d && d.updated) || '') + 'T00:00:00+09:00')) / 86400000; if (d && d.visible !== false && !_aioIsOperatorNotePlaceholder(d) && Number.isFinite(_noteAgeDays) && _noteAgeDays <= 14) { // P1652: a dated note is hidden (and kept out of AI context) after 14 days
        window._aioOperatorNote = d;
        if (typeof window._aioRenderOperatorNote === 'function') window._aioRenderOperatorNote();
      } else {
        window._aioOperatorNote = null;
        if (typeof window._aioRenderOperatorNote === 'function') window._aioRenderOperatorNote();
      }
    } catch(_) {}
  }
  window._aioLoadOperatorNote = _aioLoadOperatorNote;
  window._aioIsOperatorNotePlaceholder = _aioIsOperatorNotePlaceholder;
}
