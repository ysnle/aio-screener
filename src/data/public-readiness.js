// v59.35 (roadmap 11, layer 4 boot sequence): the public share readiness model moved out of js/aio-data.js unchanged —
// _aioBuildPublicShareReadiness with its text helpers, AIO.getPublicShareReadiness and AIO.getDataReconciliationStatus.
// It reads state and returns a model; the developer-mode panel that draws it (_aioRenderPublicReadiness) stays in
// js/aio-data.js. The functions stay window globals for those classic callers; src/app/compatibility-globals.js
// installs this before DOMContentLoaded.
export function installPublicReadiness(window = globalThis) {
  // P1126/R619: 이스케이프 구현은 escHtml 하나만 둔다. 여기 있던 5줄짜리 재구현은
  // escHtml과 문자 집합이 동일해( & < > " ) 분기할 이유가 없었고, 둘이 갈라지면
  // 한쪽만 고치는 조용한 보안 드리프트가 된다.
  function _aioPublicReadinessEsc(s) {
    return escHtml(s == null ? '' : s);
  }

  function _aioKstShortFromIso(iso) {
    if (!iso) return '미수신';
    var t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return String(iso).slice(0, 16);
    var d = new Date(t + 9 * 3600000);
    return String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(d.getUTCDate()).padStart(2, '0') + ' ' +
      String(d.getUTCHours()).padStart(2, '0') + ':' +
      String(d.getUTCMinutes()).padStart(2, '0') + ' KST';
  }

  function _aioPublicReadinessSourceText(kind, label) {
    var normalized = String(kind || label || '').toUpperCase();
    var map = {
      LIVE: '실시간',
      DELAYED: '지연 수신',
      SNAPSHOT: '스냅샷',
      REFERENCE: '참고 자료',
      UNAVAILABLE: '미수신'
    };
    return map[normalized] || '상태 확인 중';
  }

  function _aioPublicReadinessPageText(pageId) {
    var map = {
      home: '오늘',
      signal: '매매 시그널',
      breadth: '시장 폭',
      sentiment: '투자 심리',
      briefing: '오늘의 브리핑',
      technical: '차트/기술',
      macro: '거시경제',
      fxbond: '환율/채권',
      fundamental: '기업 분석',
      themes: '테마/트렌드',
      'theme-detail': '테마 상세',
      ticker: '종목 분석',
      portfolio: '포트폴리오',
      'market-news': '시장 뉴스',
      screener: '퀀트 스크리너',
      guide: '도움말',
      glossary: '용어 사전',
      mindset: '투자 마인드'
    };
    return map[pageId] || '페이지';
  }

  function _aioBuildPublicShareReadiness(opts) {
    opts = opts || {};
    var detailed = opts.full === true || !!(window.AIO && window.AIO.isDetailedAuditMode && window.AIO.isDetailedAuditMode());
    var version = (typeof APP_VERSION === 'string' ? APP_VERSION : (window.AIO && window.AIO.version) || '');
    var meta = window._serverDataMeta || null;
    var pageAudit = null;
    var pipelineAudit = null;
    var shareAudit = null;
    if (detailed) {
      try { pageAudit = window.AIO && window.AIO.getPageEvidenceCurrentnessAudit ? window.AIO.getPageEvidenceCurrentnessAudit() : null; } catch(_) {}
      try { pipelineAudit = window.AIO && window.AIO.getDataPipelineAudit ? window.AIO.getDataPipelineAudit() : null; } catch(_) {}
      try { shareAudit = window.AIO && window.AIO.getShareReadinessAudit ? window.AIO.getShareReadinessAudit({ skipEssence: true }) : null; } catch(_) {}
    } else {
      // Public boot must never execute deployment/share audits. Build the visible home status
      // from already-materialized evidence and server metadata; CI/dev mode owns full scans.
      var activePage = document.querySelector('.page.active');
      var activeId = activePage && String(activePage.id || '').replace(/^page-/, '') || 'home';
      var activeEvidence = null;
      try { activeEvidence = window.AIO && window.AIO.getPageEvidenceState ? window.AIO.getPageEvidenceState(activeId) : null; } catch(_) {}
      if (activeEvidence) {
        pageAudit = {
          status: activeEvidence.caveat ? 'pass' : 'warn',
          pageCount: 1,
          missingCaveat: activeEvidence.caveat ? [] : [activeId],
          liveOverstatement: [],
          rows: [Object.assign({ pageId: activeId }, activeEvidence)]
        };
      }
      pipelineAudit = {
        status: meta && meta.generatedAt ? 'ok' : 'warn',
        issues: meta && meta.generatedAt ? [] : ['public-data metadata pending']
      };
    }

    var blockers = [];
    var warnings = [];
    var ageMin = null;
    if (meta && meta.generatedAt) {
      ageMin = Math.max(0, Math.round((Date.now() - new Date(meta.generatedAt).getTime()) / 60000));
      if (ageMin > 360) blockers.push('public-data가 6시간 이상 지연');
      else if (ageMin > 180) warnings.push('public-data가 3시간 이상 지연');
    } else {
      warnings.push('public-data 기준 시각 미수신');
    }
    if (meta && meta.marketCyclePublished !== true) {
      blockers.push('시장 스냅샷 cycle 미발행 — 시도 시각을 시장 관측 시각으로 사용하지 않음');
    }
    if (!pageAudit) warnings.push('페이지 현재성 감사 미수신');
    else if (pageAudit.status !== 'pass') warnings.push('페이지 현재성 주의: ' + (pageAudit.missingCaveat || []).slice(0, 3).join(', '));
    if (!pipelineAudit) warnings.push('데이터 파이프라인 감사 미수신');
    else if (pipelineAudit.status !== 'ok') warnings.push('데이터 파이프라인 주의: ' + (pipelineAudit.issues || []).slice(0, 2).join(' / '));
    // v52.14 P6/P611/R206: shareAudit.blockers는 "full surface audit fail: N issue(s)" 같은 영문 내부
    // 감사 로그 원문 — 일반 방문자에게 노출하면 무의미+불안만 유발(R206 dev-marker 금지 취지). 건수만 한국어로 요약.
    var reconciliation = meta && meta.reconciliation;
    if (!reconciliation || reconciliation.status === 'unavailable') warnings.push('22개 데이터 범주 상태 미수신');
    else if (reconciliation.status === 'stale') blockers.push('시장 스냅샷과 데이터 범주 상태 revision 불일치');
    else {
      var runtimeBlocked = Array.isArray(reconciliation.runtimeBlockedCategories) ? reconciliation.runtimeBlockedCategories : [];
      var partialCategories = Array.isArray(reconciliation.partialCategories) ? reconciliation.partialCategories : [];
      if (runtimeBlocked.length) blockers.push('자동 데이터 경로 차단 ' + runtimeBlocked.length + '건: ' + runtimeBlocked.slice(0, 4).join(', '));
      if (partialCategories.length) warnings.push('부분 조정 데이터 범주 ' + partialCategories.length + '건');
    }
    if (shareAudit && shareAudit.blockers && shareAudit.blockers.length) {
      blockers.push('배포 전 점검 항목 ' + shareAudit.blockers.length + '건 확인 필요');
    } else if (shareAudit && shareAudit.warnings && shareAudit.warnings.length) {
      warnings.push('공유 readiness 경고 ' + shareAudit.warnings.length + '건');
    }

    var pageRows = pageAudit && Array.isArray(pageAudit.rows) ? pageAudit.rows.slice() : [];
    var sourceRank = { LIVE: 5, DELAYED: 4, SNAPSHOT: 3, REFERENCE: 2, UNAVAILABLE: 1 };
    var pageEvidenceRows = pageRows.map(function(r) {
      var kind = String(r.sourceKind || 'SNAPSHOT').toUpperCase();
      return {
        pageId: r.pageId || '',
        sourceKind: kind,
        sourceLabel: r.sourceLabel || kind,
        asOf: r.asOf || '',
        confidence: r.confidence || '',
        caveat: r.caveat || '',
        liveDom: r.liveDom || 0,
        snapshotDom: r.snapshotDom || 0,
        referenceDom: r.referenceDom || 0,
        unavailableDom: r.unavailableDom || 0,
        blockers: r.blockers || [],
        rank: sourceRank[kind] || 0
      };
    }).sort(function(a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return String(a.pageId).localeCompare(String(b.pageId));
    });
    var weakPages = pageEvidenceRows.filter(function(r) {
      return r.sourceKind === 'UNAVAILABLE' || r.sourceKind === 'REFERENCE' || (r.blockers && r.blockers.length);
    }).map(function(r) { return r.pageId + ':' + r.sourceKind; });
    // v52.14 P6/P611/R206: 원문 "weak page evidence pageId:UNAVAILABLE, ..." 영문 enum 나열 대신 건수만 한국어 요약.
    if (weakPages.length) warnings.push('일부 페이지 데이터 근거 보강 필요 (' + weakPages.length + '건)');

    var status = blockers.length ? 'block' : (warnings.length ? 'warn' : 'ok');
    return {
      status: status,
      label: status === 'ok' ? '베타 공유 가능' : (status === 'warn' ? '주의 후 공유' : '공개 전 차단'),
      version: version || 'unknown',
      dataLabel: meta && meta.generatedAt ? _aioKstShortFromIso(meta.generatedAt) + (ageMin != null ? ', ' + ageMin + '분 전' : '') : 'public-data 미수신',
      dataStatus: meta && meta.newsOk === false ? '뉴스 백스톱 주의' : (meta && meta.symbolsOk ? '서버 스냅샷 시세 ' + meta.symbolsOk + '개 수신' : '수신 상태 확인 중'),
      pageStatus: pageAudit ? (pageAudit.status === 'pass' ? pageAudit.pageCount + '개 페이지 현재성 통과' : '현재성 주의 ' + ((pageAudit.missingCaveat || []).length + (pageAudit.liveOverstatement || []).length) + '건') : '페이지 감사 대기',
      pipelineStatus: pipelineAudit ? (pipelineAudit.status === 'ok' ? '파이프라인 OK' : '파이프라인 WARN') : '파이프라인 감사 대기',
      pageEvidenceRows: pageEvidenceRows,
      weakPages: weakPages,
      blockers: blockers,
      warnings: warnings,
      generatedAt: new Date().toISOString(),
      auditMode: detailed ? 'detailed' : 'runtime'
    };
  }
  window._aioBuildPublicShareReadiness = _aioBuildPublicShareReadiness;
  window.AIO = window.AIO || {};
  window.AIO.getPublicShareReadiness = function(opts) {
    return _aioBuildPublicShareReadiness(Object.assign({ full: true }, opts || {}));
  };
  window.AIO.getDataReconciliationStatus = function() {
    var value = window._serverDataMeta && window._serverDataMeta.reconciliation;
    return value ? JSON.parse(JSON.stringify(value)) : { status:'unavailable', checkedAt:Date.now() };
  };

  window._aioPublicReadinessEsc = _aioPublicReadinessEsc;
  window._aioKstShortFromIso = _aioKstShortFromIso;
  window._aioPublicReadinessSourceText = _aioPublicReadinessSourceText;
  window._aioPublicReadinessPageText = _aioPublicReadinessPageText;
  return window;
}
