// P1519: one evidence-publication policy shared by the legacy adapter and native ESM.
export function claimEvidenceId(row) {
  return String(row && (row.evidenceId || row.documentId || row.id) || '').trim();
}

export function claimEvidenceTuple(row) {
  row = row || {};
  return JSON.stringify({
    source: String(row.source || row.publisher || row.canonicalUrl || row.sourceUrl || '').trim(),
    asOf: String(row.asOf || row.publishedAt || row.retrievedAt || '').trim(),
    metric: String(row.metric || row.metricId || '').trim(),
    entity: String(row.entity || row.entityId || row.ticker || row.symbol || '').trim(),
    value: row.value == null ? null : (typeof row.value === 'number' ? row.value : String(row.value).trim()),
    unit: String(row.unit || '').trim(),
    scale: String(row.scale || 'raw').trim()
  });
}

export function evidenceCanPublish(row, nowMs = Date.now()) {
  var status = String(row && (row.status || row.truthStatus) || '').toLowerCase();
  var rights = String(row && row.rights || '').toUpperCase();
  var allowedUse = String(row && row.allowedUse || '').toLowerCase();
  var asOfTime = Date.parse(row && (row.asOf || row.observedAt || row.publishedAt || row.retrievedAt) || '');
  var futureAsOf = Number.isFinite(asOfTime) && asOfTime > nowMs + 60000;
  return !!claimEvidenceId(row) &&
    /^(ok|verified|fresh|live|reference|results_found)$/.test(status) &&
    !/(blocked|missing|stale|mismatch|invalid|refresh_required|unavailable|conflict|contradicted)/.test(status) &&
    !/^(SNIPPET|SUMMARY)$/.test(String(row && row.contentDepth || '')) &&
    rights !== 'BLOCKED' && allowedUse !== 'none' && !futureAsOf;
}

export function claimSourceUrl(value) {
  try {
    var url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'oc'].forEach(function(key) { url.searchParams.delete(key); });
    return url.toString().replace(/\/$/, '');
  } catch (_) { return ''; }
}

// P1525 (audit H104 class): a current-sensitive sentence carrying a count or a magnitude must be bound to evidence, not
// slip through because its unit was not on the list. Counts (개/곳/건/명/종목) and Korean magnitudes (조/억/만) are
// covered; 개월/개년 stay out so a period like "3개월" is not read as a current figure.
export function hasCurrentNumericContent(value) {
  return /(?:[$₩€]\s*\d[\d,.]*|\d[\d,.]*\s*(?:%|bp|bps|원|달러|USD|배|포인트|pt|지수)|(?:VIX|PER|PBR|PSR|PEG|ROE|RSI|주가|시세|환율|금리|시가총액|매출|영업이익)\s*(?:는|은|이|:)?\s*\d[\d,.]*|(?:현재|최신|지금|오늘)[^.!?。！？\n]{0,40}?\d[\d,.]*|\d[\d,.]*\s*(?:개(?![월년])|곳|건|명|종목|조|억|만)|\b(?:19|20)\d{2}-\d{2}-\d{2}(?!\d))/i.test(String(value || ''));
}

// X02 (2026-10-13): a period/question mark only ends a sentence when it is not glued to the next
// ASCII token — "14.84", "apnews.com" and "?utm_source" stay whole, so a dropped numeric claim
// leaves no "84, 미 10년물 5." fragment and a kept URL is never re-joined with inserted spaces.
export function splitAnswerSentences(line) {
  var text = String(line || '');
  var pieces = [];
  var start = 0;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    var ends = '。！？'.indexOf(ch) >= 0 || ('.!?'.indexOf(ch) >= 0 && !/[A-Za-z0-9_%\/=&#~+\-]/.test(text[i + 1] || ''));
    if (!ends) continue;
    while (i + 1 < text.length && '.!?。！？'.indexOf(text[i + 1]) >= 0) i++;
    pieces.push(text.slice(start, i + 1));
    start = i + 1;
  }
  if (start < text.length) pieces.push(text.slice(start));
  return pieces.map(function(piece) { return piece.trim(); }).filter(Boolean);
}

export function stripUnverifiedCurrentNumericSentences(value) {
  return String(value || '').split('\n').map(function(line) {
    if (!line.trim()) return '';
    // P1681: a date or number inside a cited URL path ("…/2026/10/12/fed-…") is not a current claim of the sentence.
    var kept = splitAnswerSentences(line).filter(function(sentence) { return !hasCurrentNumericContent(sentence.replace(/(?:https?:\/\/|www\.)\S+/gi, ' ')); }).join(' ');
    return kept || null;
  }).filter(function(line) { return line !== null; }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function extractAnswerFallback(rawText, currentSensitive) {
  var raw = String(rawText || '');
  var hasControlBlock = /\[\/?AI_ANSWER_PLAN\]/i.test(raw);
  if (!hasControlBlock) return currentSensitive ? stripUnverifiedCurrentNumericSentences(raw) : raw.trim();
  var values = [];
  var fieldRe = /"(?:summary|body)"\s*:\s*("(?:\\.|[^"\\])*")/g;
  var match;
  while ((match = fieldRe.exec(raw)) && values.length < 8) {
    try {
      var decoded = JSON.parse(match[1]);
      if (decoded && values.indexOf(decoded) < 0) values.push(decoded);
    } catch (_) {}
  }
  var fallback = values.join('\n\n').trim();
  return currentSensitive ? stripUnverifiedCurrentNumericSentences(fallback) : fallback;
}

// v57.48 review #19: an answer opened with up to five "※" notices, three of them in English ("decision-grade",
// "Web Research", "Evidence"). The reader now gets one Korean line naming what was not confirmed; each detailed
// notice moves to the folded answer-evidence panel. `publishedClaimCount` keeps the line truthful when some values
// were confirmed (close-basis or live) and only the rest was withheld.
const NUMERIC_DROP_REASONS = ['answer-plan-claim-degraded', 'current-numeric-claim-unverified', 'typed-claim-validation'];
const CURRENT_GAP_REASONS = ['market-session-evidence-unavailable', 'current-evidence-limited', 'research-evidence-unavailable', 'research-freshness-unverified'];
export function summarizeAnswerLimitations(reasons = [], { publishedClaimCount = 0 } = {}) {
  var list = Array.from(new Set(Array.isArray(reasons) ? reasons.map(String) : []));
  var phrases = [];
  var numericDropped = list.some(function(reason) { return NUMERIC_DROP_REASONS.indexOf(reason) >= 0; });
  var currentGap = list.some(function(reason) { return CURRENT_GAP_REASONS.indexOf(reason) >= 0; });
  if (publishedClaimCount > 0 && (numericDropped || currentGap)) phrases.push(numericDropped ? '일부 최신 수치 확인 안 됨 — 확인된 값만 표시' : '표시한 값 외의 최신 수치는 확인 안 됨');
  else if (numericDropped || currentGap) phrases.push('최신 수치 확인 안 됨 — 일반 설명만');
  if (list.indexOf('suitability-context-missing') >= 0) phrases.push('투자 성향 정보 없음 — 조건부 분석');
  if (list.indexOf('model-output-truncated') >= 0) phrases.push('응답 길이 한도 — 일부만 표시');
  var premise = list.filter(function(reason) { return /^premise-/.test(reason); })[0];
  if (premise) phrases.push(premise === 'premise-contradicted' ? '질문 전제와 반대 관측 — 조건부 설명' : '질문 전제 확인 안 됨 — 조건부 설명');
  return phrases.length ? '※ ' + phrases.join(' · ') : '';
}

export function buildPublishableAnswerPlan(plan, bindingEvidence, currentSensitive, { nowMs = Date.now() } = {}) {
  if (!plan) return { plan: null, droppedClaims: [], unboundEvidenceIds: [] };
  var rows = (Array.isArray(bindingEvidence) ? bindingEvidence : []).filter(row => evidenceCanPublish(row, nowMs));
  var bindingIds = new Set(rows.map(claimEvidenceId));
  var claims = plan.claims && Array.isArray(plan.claims.claims) ? plan.claims.claims : [];
  var droppedClaims = [];
  var unboundEvidenceIds = [];
  var boundLabels = new Map();
  var safeClaims = claims.filter(function(claim) {
    var reasons = [];
    var type = String(claim && claim.type || '');
    var ids = Array.isArray(claim && claim.evidenceIds) ? claim.evidenceIds.map(String) : [];
    // P1688 live check (2026-10-13): the model labelled exact registry copies type "market_data"; a claim that carries a
    // metric and a numeric value is numeric whatever its label, so it is validated (not dropped as untyped content).
    var numeric = /^(?:numeric|metric|percentage|probability)$/.test(type) || (type !== 'text' && !!(claim && claim.metric) && typeof (claim && claim.value) === 'number');
    if (numeric) {
      if (typeof claim.value !== 'number' || !isFinite(claim.value)) reasons.push('numeric-value');
      if (!claim.unit || !claim.asOf || !claim.source || !ids.length) reasons.push('traceability');
    }
    if (currentSensitive && (!claim.asOf || !claim.source || !ids.length)) reasons.push('current-traceability');
    if (type === 'probability' && !(claim.calibration && claim.calibration.modelId)) reasons.push('calibration');
    if (claim.allowedUse === 'decision' && (!ids.length || claim.status !== 'verified')) reasons.push('decision-use');
    ids.forEach(function(id) { if (!bindingIds.has(id)) { reasons.push('evidence-unbound'); unboundEvidenceIds.push(id); } });
    var boundRows = rows.filter(function(row) { return ids.indexOf(claimEvidenceId(row)) >= 0; });
    if (currentSensitive && !numeric && hasCurrentNumericContent(claim.text)) reasons.push('untyped-numeric-content');
    var matchedRow = null;
    if ((numeric || currentSensitive || ids.length) && !boundRows.some(function(row) {
      var source = String(claim.source || '').trim();
      var sourceMatches = source && (source === String(row.source || '').trim() || source === String(row.publisher || '').trim() ||
        (claimSourceUrl(source) && [claimSourceUrl(row.canonicalUrl), claimSourceUrl(row.sourceUrl)].indexOf(claimSourceUrl(source)) >= 0));
      var claimTime = Date.parse(claim.asOf);
      var rowTime = Date.parse(row.asOf || row.publishedAt || '');
      var timeMatches = Number.isFinite(claimTime) && claimTime === rowTime;
      var rowEntity = String(row.entity || row.ticker || row.symbol || '').trim();
      var identityMatches = !!claim.metric && claim.metric === row.metric &&
        String(claim.entity || '').trim() === rowEntity &&
        String(claim.scale || 'raw') === String(row.scale || 'raw');
      var matches = sourceMatches && (!(numeric || currentSensitive) || timeMatches) &&
        (!numeric || (identityMatches && typeof row.value === 'number' && claim.value === row.value && claim.unit === row.unit));
      if (matches) matchedRow = row;
      return matches;
    })) reasons.push('evidence-content-mismatch');
    if (claim.status === 'blocked') reasons.push('claim-blocked');
    if (reasons.length) {
      droppedClaims.push({ claimId: claim.claimId || null, reasons: Array.from(new Set(reasons)) });
      return false;
    }
    if (matchedRow && matchedRow.label) boundLabels.set(claim, String(matchedRow.label));
    return true;
  }).map(function(claim) {
    if (!/^(?:numeric|metric|percentage|probability)$/.test(String(claim.type || '')) && !(String(claim.type || '') !== 'text' && claim.metric && typeof claim.value === 'number')) return claim;
    // Render the verified tuple separately; model prose must not smuggle a
    // second, conflicting number alongside a valid structured value.
    // v57.48 #7: a bound evidence row that carries its own display label (close-basis rows: "VIX 종가") names the value.
    var label = boundLabels.get(claim) || [claim.entity, claim.metric].filter(Boolean).join(' · ');
    return Object.assign({}, claim, { text: label || '검증된 수치' });
  });
  var summary = currentSensitive ? stripUnverifiedCurrentNumericSentences(plan.summary) : String(plan.summary || '').trim();
  var sections = (Array.isArray(plan.sections) ? plan.sections : []).map(function(section) {
    if (typeof section === 'string') return currentSensitive ? stripUnverifiedCurrentNumericSentences(section) : section;
    if (!section || typeof section !== 'object') return null;
    return Object.assign({}, section, { title: currentSensitive ? stripUnverifiedCurrentNumericSentences(section.title) : section.title, body: currentSensitive ? stripUnverifiedCurrentNumericSentences(section.body) : section.body });
  }).filter(function(section) { return typeof section === 'string' ? !!section.trim() : !!(section && section.title && section.body); });
  return {
    plan: Object.assign({}, plan, { summary: summary, sections: sections, claims: { schemaVersion: 'claim-ledger.v1', claims: safeClaims }, citations: (Array.isArray(plan.citations) ? plan.citations : []).filter(function(citation) {
      var url = claimSourceUrl(typeof citation === 'string' ? citation : citation && citation.url);
      return url && rows.some(function(row) { return [claimSourceUrl(row.canonicalUrl), claimSourceUrl(row.sourceUrl), claimSourceUrl(row.source)].indexOf(url) >= 0; });
    }) }),
    droppedClaims: droppedClaims,
    unboundEvidenceIds: Array.from(new Set(unboundEvidenceIds))
  };
}
