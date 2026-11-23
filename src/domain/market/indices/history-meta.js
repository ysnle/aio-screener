export function historyFieldMeta(row, field) {
  const meta = row && typeof row === 'object' ? row.fieldMeta?.[field] : null;
  return meta && typeof meta === 'object' ? meta : null;
}
