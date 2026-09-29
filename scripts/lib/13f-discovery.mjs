import { normalizeCik, recentOwnershipRows, select13fFilings, withArchiveUrls } from './sec-edgar.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

export function is13FFilingSeason(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  for (let year = date.getUTCFullYear() - 1; year <= date.getUTCFullYear(); year += 1) {
    for (const quarterEndMonth of [2, 5, 8, 11]) {
      const quarterEnd = Date.UTC(year, quarterEndMonth + 1, 0);
      if (day > quarterEnd && day <= quarterEnd + 45 * DAY_MS) return true;
    }
  }
  return false;
}

function managerIdFor(profile) {
  return profile?.id || profile?.managerId || null;
}

export function ownershipFailureFields(manager, checkedAt, reason) {
  const lastKnownGoodOwnershipEvents = manager?.ownershipStatus === 'BLOCKED'
    ? (manager.lastKnownGoodOwnershipEvents || manager.ownershipEvents || [])
    : (manager?.ownershipEvents || []);
  return {
    ownershipStatus: 'BLOCKED',
    ownershipEvents: [],
    ownershipCheckedAt: checkedAt,
    ownershipBlockReason: reason,
    lastKnownGoodOwnershipEvents
  };
}

function ownershipOnlyManagerUpdate(manager, outcome, checkedAt) {
  if (outcome.status === 'BLOCKED') {
    return {
      ...manager,
      ...ownershipFailureFields(manager, checkedAt, outcome.reason)
    };
  }

  const {
    lastKnownGoodOwnershipEvents: _lastKnownGoodOwnershipEvents,
    ownershipBlockReason: _ownershipBlockReason,
    ...preserved
  } = manager;
  return {
    ...preserved,
    ownershipStatus: 'DISCOVERED',
    ownershipEvents: outcome.ownershipEvents,
    ownershipCheckedAt: checkedAt
  };
}

export async function updateOwnershipOnlyDiscovery({
  discoveryArtifact,
  holdingsArtifact,
  filerProfiles,
  checkedAt,
  fetchSubmissions
}) {
  if (!Array.isArray(discoveryArtifact?.managers) || !Array.isArray(filerProfiles)) {
    throw new Error('Ownership-only discovery requires existing filing managers and filer profiles');
  }
  if (!discoveryArtifact.coverage || typeof discoveryArtifact.coverage !== 'object') {
    throw new Error('Ownership-only discovery requires existing filing coverage');
  }
  if (typeof fetchSubmissions !== 'function') throw new Error('Ownership-only discovery requires a submissions fetcher');

  const discoveryById = new Map(discoveryArtifact.managers.map((manager) => [manager.managerId, manager]));
  const holdingsById = new Map((holdingsArtifact?.managers || []).map((manager) => [manager.id || manager.managerId, manager]));
  const profileIds = new Set();
  for (const profile of filerProfiles) {
    const managerId = managerIdFor(profile);
    if (!managerId || profileIds.has(managerId)) throw new Error(`Invalid or duplicate 13F manager profile: ${managerId || '(missing id)'}`);
    profileIds.add(managerId);
    const current = discoveryById.get(managerId);
    if (!current) throw new Error(`Filing discovery artifact is missing configured manager ${managerId}`);
    if (normalizeCik(current.cik) !== normalizeCik(profile.cik)) throw new Error(`Filing discovery CIK mismatch for ${managerId}`);
  }
  const discoveredFilerIds = new Set(discoveryArtifact.managers.filter((manager) => manager.cik).map((manager) => manager.managerId));
  if (discoveredFilerIds.size !== profileIds.size || [...discoveredFilerIds].some((managerId) => !profileIds.has(managerId))) {
    throw new Error('Ownership-only filer profiles do not match the existing discovery artifact');
  }

  const outcomes = new Map();
  const pending13fHrTriggers = [];
  for (const profile of filerProfiles) {
    const managerId = managerIdFor(profile);
    const cik = normalizeCik(profile.cik);
    try {
      const payload = await fetchSubmissions(cik);
      if (!Array.isArray(payload?.filings?.recent?.form)) {
        throw new Error('SEC submissions payload lacks recent filing forms');
      }
      const ownershipEvents = recentOwnershipRows(payload)
        .slice(0, 10)
        .map((filing) => withArchiveUrls(cik, filing));
      const latestHoldings = select13fFilings(payload).latestHoldings;
      const connectedAccession = holdingsById.get(managerId)?.latestFiling?.accession || null;
      outcomes.set(managerId, { status: 'DISCOVERED', ownershipEvents });

      // A weekly row import can fail after SEC discovery. Re-evaluate this
      // trigger against the currently connected holdings artifact on every
      // poll so a failed weekly run cannot consume the new-filing signal.
      if (latestHoldings?.accession && latestHoldings.accession !== connectedAccession) {
        pending13fHrTriggers.push({
          managerId,
          cik,
          accession: latestHoldings.accession,
          form: latestHoldings.form,
          periodOfReport: latestHoldings.periodOfReport,
          connectedAccession
        });
      }
    } catch (error) {
      outcomes.set(managerId, {
        status: 'BLOCKED',
        reason: String(error?.message || error)
      });
    }
  }

  const managers = discoveryArtifact.managers.map((manager) => {
    const outcome = outcomes.get(manager.managerId);
    return outcome ? ownershipOnlyManagerUpdate(manager, outcome, checkedAt) : manager;
  });
  const currentOwnershipManagers = managers.filter((manager) => manager.ownershipStatus !== 'BLOCKED');
  const artifact = {
    ...discoveryArtifact,
    ownershipCheckedAt: checkedAt,
    coverage: {
      ...discoveryArtifact.coverage,
      ownershipEvents: currentOwnershipManagers.reduce((sum, manager) => sum + (manager.ownershipEvents || []).length, 0),
      ownershipManagers: currentOwnershipManagers.filter((manager) => (manager.ownershipEvents || []).length > 0).length,
      ownershipBlocked: managers.filter((manager) => manager.ownershipStatus === 'BLOCKED').length
    },
    managers
  };
  return { artifact, pending13fHrTriggers, in13fFilingSeason: is13FFilingSeason(checkedAt) };
}
