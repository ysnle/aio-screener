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
