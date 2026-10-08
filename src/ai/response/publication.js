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

export function hasCurrentNumericContent(value) {
  return /(?:[$₩€]\s*\d[\d,.]*|\d[\d,.]*\s*(?:%|bp|bps|원|달러|USD|배|포인트|pt|지수)|(?:VIX|PER|PBR|PSR|PEG|ROE|RSI|주가|시세|환율|금리|시가총액|매출|영업이익)\s*(?:는|은|이|:)?\s*\d[\d,.]*|(?:현재|최신|지금|오늘)[^.!?。！？\n]{0,40}?\d[\d,.]*|\b(?:19|20)\d{2}-\d{2}-\d{2}\b)/i.test(String(value || ''));
}

export function stripUnverifiedCurrentNumericSentences(value) {
  var sentences = String(value || '').match(/[^.!?。！？\n]+[.!?。！？]?/g) || [];
  return sentences.filter(function(sentence) { return !hasCurrentNumericContent(sentence); }).join(' ').trim();
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

export function buildPublishableAnswerPlan(plan, bindingEvidence, currentSensitive, { nowMs = Date.now() } = {}) {
  if (!plan) return { plan: null, droppedClaims: [], unboundEvidenceIds: [] };
  var rows = (Array.isArray(bindingEvidence) ? bindingEvidence : []).filter(row => evidenceCanPublish(row, nowMs));
  var bindingIds = new Set(rows.map(claimEvidenceId));
  var claims = plan.claims && Array.isArray(plan.claims.claims) ? plan.claims.claims : [];
  var droppedClaims = [];
  var unboundEvidenceIds = [];
  var safeClaims = claims.filter(function(claim) {
    var reasons = [];
    var type = String(claim && claim.type || '');
    var ids = Array.isArray(claim && claim.evidenceIds) ? claim.evidenceIds.map(String) : [];
    if (/^(?:numeric|metric|percentage|probability)$/.test(type)) {
      if (typeof claim.value !== 'number' || !isFinite(claim.value)) reasons.push('numeric-value');
      if (!claim.unit || !claim.asOf || !claim.source || !ids.length) reasons.push('traceability');
    }
    if (currentSensitive && (!claim.asOf || !claim.source || !ids.length)) reasons.push('current-traceability');
    if (type === 'probability' && !(claim.calibration && claim.calibration.modelId)) reasons.push('calibration');
    if (claim.allowedUse === 'decision' && (!ids.length || claim.status !== 'verified')) reasons.push('decision-use');
    ids.forEach(function(id) { if (!bindingIds.has(id)) { reasons.push('evidence-unbound'); unboundEvidenceIds.push(id); } });
    var boundRows = rows.filter(function(row) { return ids.indexOf(claimEvidenceId(row)) >= 0; });
    var numeric = /^(?:numeric|metric|percentage|probability)$/.test(type);
    if (currentSensitive && !numeric && hasCurrentNumericContent(claim.text)) reasons.push('untyped-numeric-content');
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
      return sourceMatches && (!(numeric || currentSensitive) || timeMatches) &&
        (!numeric || (identityMatches && typeof row.value === 'number' && claim.value === row.value && claim.unit === row.unit));
    })) reasons.push('evidence-content-mismatch');
    if (claim.status === 'blocked') reasons.push('claim-blocked');
    if (reasons.length) {
      droppedClaims.push({ claimId: claim.claimId || null, reasons: Array.from(new Set(reasons)) });
      return false;
    }
    return true;
  }).map(function(claim) {
    if (!/^(?:numeric|metric|percentage|probability)$/.test(String(claim.type || ''))) return claim;
    // Render the verified tuple separately; model prose must not smuggle a
    // second, conflicting number alongside a valid structured value.
    var label = [claim.entity, claim.metric].filter(Boolean).join(' · ');
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
