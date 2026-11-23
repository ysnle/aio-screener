// The value a custom screener condition reads from a row (custom-conditions.js `fields`). One reader for the screener
// table and the chat's screen tool: a registered field through its readiness, the filing figures (PER·PBR·ROE·이익률·
// 성장률) only under a usable filing status, the distance and pattern fields straight from the row, and the values whose
// file loads apart from the screener artifact (Forward PER, the cash metrics, the research-channel signals) from the
// readers the caller hands in — each reads null until its source has arrived.
import { SCREENER_FIELD_REGISTRY, fieldValueForPurpose } from '../../data/contracts/screener.js';
import { CHANNEL_SIGNAL_KEYS, channelSignalValue } from './channel-signals.js';
import { finiteNumber as finite } from '../shared/number.js';

export const FILING_KEYS = new Set(['pe', 'pb', 'roe', 'margin', 'revGrowth']);
const FILING_STATUSES = new Set(['CURRENT', 'DELAYED', 'INFERRED', 'STALE', 'LAST_GOOD']);
const FIELD_BY_ROW_KEY = new Map(SCREENER_FIELD_REGISTRY.fields.map((definition) => [definition.rowKey, definition.fieldId]));
const none = () => null;

/**
 * A `(row, key) => value` reader for evaluateCondition. forwardPe(row) gives the consensus multiple, cashMetrics(SYMBOL)
 * the { fcfMargin, capexIntensity } entry, channelSignals() the Telegram digest's signals array.
 */
export function conditionReader({ forwardPe = none, cashMetrics = none, channelSignals = none } = {}) {
  return (row, key) => {
    if (key === 'fwdPe') return forwardPe(row) ?? null;
    if (key === 'fcfMargin' || key === 'capexIntensity') return cashMetrics(String(row?.sym || row?.symbol || '').toUpperCase())?.[key] ?? null;
    if (CHANNEL_SIGNAL_KEYS.includes(key)) return channelSignalValue(channelSignals(), row, key);
    const fieldId = FIELD_BY_ROW_KEY.get(key);
    if (row?.fieldReadiness && fieldId && FILING_KEYS.has(key)) return FILING_STATUSES.has(row.fieldReadiness.fields?.[fieldId]?.status) ? finite(row[key]) : null;
    if (row?.fieldReadiness && fieldId) return fieldValueForPurpose(row, fieldId, 'calculation');
    return typeof row?.[key] === 'string' || typeof row?.[key] === 'boolean' || Array.isArray(row?.[key]) ? row[key] : finite(row?.[key]);
  };
}
