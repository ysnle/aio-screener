function normalizeAlias(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('ko-KR')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ');
}

export function createConceptRegistry(concepts = [], aliases = []) {
  const byId = new Map();
  const aliasTargets = new Map();
  const errors = [];

  for (const concept of concepts) {
    const id = String(concept?.canonicalId || '').trim();
    if (!id || byId.has(id)) {
      errors.push(Object.freeze({ kind: 'duplicate-concept', id }));
      continue;
    }
    byId.set(id, Object.freeze({ ...concept, canonicalId: id }));
  }

  for (const entry of aliases) {
    const alias = normalizeAlias(entry?.alias);
    const targets = [...new Set((entry?.targets || []).map((target) => String(target || '').trim()).filter(Boolean))];
    if (!alias || !targets.length) {
      errors.push(Object.freeze({ kind: 'invalid-alias', alias }));
      continue;
    }
    for (const target of targets) {
      if (!byId.has(target)) errors.push(Object.freeze({ kind: 'orphan-alias-target', alias, target }));
    }
    const existing = aliasTargets.get(alias) || [];
    aliasTargets.set(alias, [...new Set([...existing, ...targets])]);
  }

  return Object.freeze({
    concepts: Object.freeze([...byId.values()]),
    aliases: Object.freeze([...aliasTargets.entries()].map(([alias, targets]) => Object.freeze({ alias, targets: Object.freeze(targets) }))),
    errors: Object.freeze(errors),
    resolve(alias) {
      const targets = aliasTargets.get(normalizeAlias(alias)) || [];
      return Object.freeze(targets.map((target) => byId.get(target)).filter(Boolean));
    }
  });
}

export { normalizeAlias };
