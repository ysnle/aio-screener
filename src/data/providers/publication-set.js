/**
 * P1173 (17 작업 단위 4 / O07): a snapshot is only as usable as the input set it was combined from.
 *
 * The screener provider reads screener.json, screener-universe.json and model-validation-status.json
 * concurrently and combines them unconditionally. Freshness and per-field readiness were checked for
 * each file on its own, but nothing said whether the three belong to a publication the consumer can
 * use together — and the content-addressed snapshotId identifies the row set that arrived, not that
 * the inputs are a compatible set. Files with different cadences do NOT have to share a generation
 * date; what must not happen is silently combining a set that violates the declared policy.
 *
 * The policy is declared here rather than copied from a document: which members make up the set,
 * which schema/model versions this consumer knows how to read, and which members must agree on
 * something observable. A member whose schema this consumer does not know, or a set whose declared
 * and observed universe sizes disagree, is reported as INCOMPATIBLE instead of being combined.
 */
export const PUBLICATION_SET_VERSION = 'publication-set.v1';

export function createPublicationPolicy(input = {}) {
  return Object.freeze({
    version: PUBLICATION_SET_VERSION,
    members: Object.freeze(Array.isArray(input.members) ? input.members.map(String) : []),
    supportedSchemas: Object.freeze(Object.fromEntries(Object.entries(input.supportedSchemas || {})
      .map(([member, versions]) => [String(member), Object.freeze((Array.isArray(versions) ? versions : [versions]).map(String))]))),
    // Members may be refreshed on their own cadence. Equal generation dates are not required; a
    // disagreement is only a defect when the members are declared to be comparable on a field.
    requiresSameGeneration: input.requiresSameGeneration === true,
    comparableFields: Object.freeze(Object.fromEntries(Object.entries(input.comparableFields || {})
      .map(([field, members]) => [String(field), Object.freeze((Array.isArray(members) ? members : [members]).map(String))])))
  });
}

export function evaluatePublicationSet({ members = [], policy, previous = null } = {}) {
  const active = policy || createPublicationPolicy({});
  const rows = (Array.isArray(members) ? members : []).map((member) => Object.freeze({
    member: String(member?.member || 'unknown'),
    present: member?.present !== false,
    revision: member?.revision == null ? null : String(member.revision),
    observedAt: member?.observedAt == null ? null : String(member.observedAt),
    schemaVersion: member?.schemaVersion == null ? null : String(member.schemaVersion),
    universeSize: Number.isFinite(member?.universeSize) ? Number(member.universeSize) : null,
    detail: member?.detail == null ? null : String(member.detail)
  }));
  const byName = new Map(rows.map((row) => [row.member, row]));
  const missing = active.members.filter((name) => !byName.get(name)?.present);
  const incompatibilities = [];

  rows.filter((row) => row.present && row.schemaVersion).forEach((row) => {
    const supported = active.supportedSchemas[row.member];
    if (!supported || !supported.length) return;
    if (!supported.includes(row.schemaVersion)) {
      incompatibilities.push(Object.freeze({
        member: row.member, reason: 'schema-not-supported', declared: row.schemaVersion, supported
      }));
    }
  });

  // A universe size the screener artifact declares but the universe artifact does not contain means
  // the rows were enriched against a different universe — two publications combined into one set.
  Object.entries(active.comparableFields).forEach(([field, names]) => {
    const declared = names
      .map((name) => ({ name, value: byName.get(name)?.present ? byName.get(name)[field] : null }))
      .filter((entry) => entry.value != null);
    if (declared.length < 2) return;
    const distinct = new Set(declared.map((entry) => entry.value));
    if (distinct.size > 1) {
      incompatibilities.push(Object.freeze({
        member: declared.map((entry) => entry.name).join('+'),
        reason: `${field}-disagreement`,
        declared: Object.freeze(declared.map((entry) => Object.freeze({ member: entry.name, value: entry.value }))),
        members: Object.freeze(names.slice())
      }));
    }
  });

  const previousRevisions = previous?.revisions && typeof previous.revisions === 'object' ? previous.revisions : null;
  const advanced = previousRevisions
    ? rows.filter((row) => previousRevisions[row.member] != null && row.revision != null && previousRevisions[row.member] !== row.revision).map((row) => row.member)
    : [];
  if (active.requiresSameGeneration && previousRevisions && advanced.length && advanced.length < active.members.length) {
    incompatibilities.push(Object.freeze({ member: advanced.join(','), reason: 'partial-rollout', advanced, members: active.members }));
  }

  const unjudged = rows.filter((row) => row.present && !row.schemaVersion).map((row) => row.member);
  const status = incompatibilities.length ? 'INCOMPATIBLE' : missing.length ? 'UNVERIFIABLE' : 'COHERENT';
  return Object.freeze({
    version: PUBLICATION_SET_VERSION,
    status,
    policy: active,
    members: Object.freeze(rows),
    missing: Object.freeze(missing),
    // Declares which member of the set could not be judged for compatibility at all, instead of
    // letting "no schema declared" read as "compatible".
    unjudged: Object.freeze(unjudged),
    incompatibilities: Object.freeze(incompatibilities),
    advancedSincePreviousRead: Object.freeze(advanced),
    // Only INCOMPATIBLE blocks the read: an unverifiable set is reported, not silently promoted.
    compatible: status !== 'INCOMPATIBLE',
    checked: status !== 'UNVERIFIABLE',
    reason: status === 'INCOMPATIBLE'
      ? `publication-set-incompatible:${incompatibilities.map((entry) => entry.reason).join('+')}`
      : status === 'UNVERIFIABLE' ? `publication-set-unverifiable:${missing.join('+')}` : 'publication-set-coherent'
  });
}
