// v59.70 (L3, legacy core wave 2): the home 오늘의 질문 renderer (#home-operator-note) and the topbar server data age
// badge (#server-data-age) moved here unchanged from js/aio-data.js, so the two home status sinks have one native owner;
// the operator-note.json loader and its placeholder check went to src/data/operator-note.js (ui code does not fetch). Callers keep the same window globals; src/app/compatibility-globals.js
// installs this before DOMContentLoaded, as data-status-surface.js is.
import { installOperatorNote } from '../../data/operator-note.js';

export function installHomeStatusSurface(window = globalThis, document = globalThis.document) {
  installOperatorNote(window);
  var escHtml = function(value) { return window.escHtml(value); }; // js/aio-data.js escHtml, a classic global by the time either writer runs
  var _aioIsOperatorNotePlaceholder = window._aioIsOperatorNotePlaceholder; // src/data/operator-note.js

  // P569/R260: this was defined 3 times in this file (v-baseline, v51.40, v51.43) — only the
  // last definition below ever took effect (each `function` redeclaration + `window.x =`
  // silently overwrote the previous one), so the two earlier ~25-line copies were fully dead:
  // any future fix applied to them would compile fine and have zero effect. Removed rather than
  // left as unreachable code.
  // v57.71 (owner 2026-10-15): the operator note becomes "오늘의 한 문장" — one sentence that names the day's market
  // tension. The producer writes it once per 08:00 KST day (data.json marketAnalysis.sentence); an operator line in
  // operator-note.json (`sentence`, `updated` = that day) takes its place. Older than the previous day, nothing shows.
  function _aioRenderOperatorNote() {
    var el = document.getElementById('home-operator-note');
    if (!el) return;
    var day = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
    var yesterday = new Date(Date.now() + 3600000 - 86400000).toISOString().slice(0, 10);
    var note = window._aioOperatorNote;
    var manual = note && note.visible !== false && !_aioIsOperatorNotePlaceholder(note) && note.sentence && note.updated === day
      ? { text: String(note.sentence), day: note.updated, by: '운영자' } : null;
    var produced = window._aioMarketSentence;
    var line = manual || (produced && produced.text && (produced.day === day || produced.day === yesterday) ? { text: String(produced.text), day: produced.day, by: null } : null);
    if (!line) { el.style.display = 'none'; el.innerHTML = ''; return; }
    var md = Number(line.day.slice(5, 7)) + '/' + Number(line.day.slice(8, 10));
    el.innerHTML =
      '<div class="aio-operator-note-card aio-operator-note-priority aio-market-sentence" data-source-kind="REFERENCE" data-operational-use="reference-only" data-sentence-day="' + escHtml(line.day) + '">' +
        '<div class="aio-operator-note-meta">' +
          '<span class="aio-operator-note-kicker">오늘의 질문</span>' +
          '<span class="aio-operator-note-date">' + escHtml(md) + ' 작성' + (line.by ? ', ' + escHtml(line.by) : '') + '</span>' + // v58.80 (first-users run-4): the writing day, not the close it reads
        '</div>' +
        '<div class="aio-operator-note-title">' + escHtml(line.text) + '</div>' + // v59.51: the note sits inside the home verdict card, which already leads with the verdict it questions
      '</div>';
    el.style.display = 'block';
  }
  window._aioRenderOperatorNote = _aioRenderOperatorNote;

  // v50.24/WO-4: 서버 데이터 나이를 topbar 배지로 표면화 — 사용자가 "지금 보는 데이터가 N분 전 것"을
  // 항상 알 수 있게. 60분+ amber, 180분+ red. ageMin은 _serverDataMeta.generatedAt 기준으로 매번 재계산
  // (배지 갱신 타이머가 1분마다 호출해도 나이가 정확히 카운트업되도록).
  function _aioRenderServerDataAge() {
    try {
      var el = document.getElementById('server-data-age');
      if (!el) return;
      var meta = window._serverDataMeta;
      if (!meta || !meta.generatedAt) { el.style.display = 'none'; return; }
      var generatedMs = new Date(meta.generatedAt).getTime();
      if (!isFinite(generatedMs)) { el.style.display = 'none'; return; }
      var age = Math.max(0, Math.round((Date.now() - generatedMs) / 60000));
      // KST 시각 포맷 (UTC+9)
      var d = new Date(new Date(meta.generatedAt).getTime() + 9 * 3600000);
      var kst = (d.getUTCMonth()+1) + '-' + String(d.getUTCDate()).padStart(2,'0')
              + ' ' + String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0') + ' KST';
      var txt, cls, title;
      if (meta.marketCyclePublished !== true) {
        txt = '' + kst + ' 시도';
        cls = 'fb-static';
        title = '최근 서버 시도는 시장 스냅샷으로 발행되지 않았습니다. 현재 시세는 마지막 성공본(LKG) 참고자료일 수 있습니다.\n'
          + kst + ' | cycle=' + (meta.cycleStatus || 'unknown');
      } else if (age < 60)       { txt = '' + kst + ' 갱신'; cls = 'fb-live';   title = '서버(GitHub Actions)가 ' + age + '분 전 수집한 데이터 — 신선\n' + kst + ' | 시세 ' + (meta.symbolsOk||'?') + '개'; }
      else if (age < 180) { txt = '' + kst + ' 갱신'; cls = 'fb-static'; title = '서버 데이터 ' + age + '분 경과 (자동 갱신 대기)\n' + kst + ' | 시세 ' + (meta.symbolsOk||'?') + '개'; }
      else {
        var h = Math.floor(age / 60);
        txt = '' + kst + ' (' + h + 'h 전)'; cls = 'fb-stale';
        title = '서버 데이터 ' + h + '시간 경과 — GitHub Actions cron이 지연/중단됐을 수 있음\n' + kst;
      }
      el.textContent = txt;
      el.className = 'freshness-badge ' + cls;
      el.style.display = '';
      el.title = title;
      el.setAttribute('data-server-age-min', String(age));
      if (typeof _aioSchedulePublicReadiness === 'function') _aioSchedulePublicReadiness(250);
    } catch(_) {}
  }
  window._aioRenderServerDataAge = _aioRenderServerDataAge;
}
