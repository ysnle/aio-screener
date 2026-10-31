// v57.84 (P1855/R711): one parser for the R ledger, shared by ci-ledger-integrity-check and ci-record-fix-check.
// Since the v59.48 class restructure every rule in RULES.md is a `## R<n>.` heading. The parser still reads the two older
// shapes (`### R<n>.`, inline `**R<n> —` bodies) so a ledger from an older commit (git 46bad2f6) counts the same.
export function ruleIdOccurrences(text) {
  const source = String(text);
  const headings = [...source.matchAll(/^#{2,3} R(\d+)(-[A-Z0-9]+)?\./gm)].filter((match) => !match[2]).map((match) => Number(match[1]));
  const inline = [...source.matchAll(/^\*\*R(\d+) —/gm)].map((match) => Number(match[1]));
  return [...headings, ...inline];
}

export function definedRuleIds(text) {
  return new Set(ruleIdOccurrences(text));
}
