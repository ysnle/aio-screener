export function resolveLiveHeaderPolicy(baseUrl, configuredPolicy = '') {
  const explicit = String(configuredPolicy || '').trim().toLowerCase();
  if (explicit) return explicit;
  return /\.github\.io$/i.test(new URL(baseUrl).hostname) ? 'operator-required' : 'enforce';
}

export function evaluateLiveHeader(policy, actualValue, expectedFragment) {
  const actual = String(actualValue || '');
  const expected = String(expectedFragment || '');
  const matches = actual.toLowerCase().includes(expected.toLowerCase());
  return {
    matches,
    outcome: matches ? 'PASS' : (policy === 'enforce' ? 'FAIL' : 'WARN')
  };
}
