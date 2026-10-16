// v57.84 (P1855/R711): one parser for the R ledger, shared by ci-ledger-integrity-check and ci-record-fix-check.
// RULES.md uses three real shapes — `## R<n>.`, the older `### R<n>.` (R1-A style suffixes are sub-rules of R<n>),
// and range sections (`## R172~R178.`) whose rules are inline `**R<n> —` bodies.
export function ruleIdOccurrences(text) {
  const source = String(text);
  const headings = [...source.matchAll(/^#{2,3} R(\d+)(-[A-Z0-9]+)?\./gm)].filter((match) => !match[2]).map((match) => Number(match[1]));
  const inline = [...source.matchAll(/^\*\*R(\d+) —/gm)].map((match) => Number(match[1]));
  return [...headings, ...inline];
}

export function definedRuleIds(text) {
  return new Set(ruleIdOccurrences(text));
}
