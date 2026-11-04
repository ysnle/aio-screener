// v59.70 (data audit R2): the one reader of a history.json row's per-field provenance (row.fieldMeta[field]). The
// published file still carries the full object on every row (4.4 MB of its 4.7 MB); routing every browser reader
// through this accessor lets that encoding be compacted later (shared per-field defaults, varying keys per row) by
// changing this file and the producer alone. Returns the field's provenance object or null.
export function historyFieldMeta(row, field) {
  const meta = row && typeof row === 'object' ? row.fieldMeta?.[field] : null;
  return meta && typeof meta === 'object' ? meta : null;
}
