// SEC information-table rows have no verified cross-quarter row identity.
// Security-level comparisons belong only to the aggregated change ledger.
export function rawHoldingRow(row) {
  return {
    ...row,
    priorValue: null,
    priorShares: null,
    valueDelta: null,
    sharesDelta: null,
    action: 'UNAVAILABLE',
    actionConfidence: 'NOT_AVAILABLE',
    actionBasis: 'NOT_AVAILABLE',
    comparisonStatus: 'RAW_ROW_NOT_COMPARABLE'
  };
}

// The pending security-master boundary counts what the published holdings carry: distinct CUSIPs and issuer names over
// every current row, nothing mapped yet. The runtime builder writes these into index.json and security-master.json from
// the holdings it just read; carried over from the previous files, they went stale as soon as a new 13F quarter changed
// the rows, and the masters contract refused every full 13F chain from 11/06 (run 43652766608).
export function securityMasterBoundary(holdings) {
  const rows = holdings?.allHoldings || [];
  const rawUniqueCusips = new Set(rows.map((row) => row.cusipNormalized || row.cusip).filter(Boolean)).size;
  const rawUniqueIssuerNames = new Set(rows.map((row) => row.issuer).filter(Boolean)).size;
  return {
    index: { normalizationStatus: 'PENDING_VERIFIED_SECURITY_MASTER', rawUniqueCusips, rawUniqueIssuerNames, mappedRows: 0, securityMasterArtifact: 'public-data/masters/security-master.json' },
    coverage: { rawUniqueCusips, rawUniqueIssuerNames, mappedRows: 0, recordsPublished: 0, sectorWeightsPublished: false },
  };
}
