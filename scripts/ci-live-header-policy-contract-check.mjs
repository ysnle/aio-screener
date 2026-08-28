import { evaluateLiveHeader, resolveLiveHeaderPolicy } from './live-header-policy.mjs';

const errors = [];
const check = (label, condition) => { if (!condition) errors.push(label); };

check('GitHub Pages defaults to operator-required', resolveLiveHeaderPolicy('https://example.github.io/app') === 'operator-required');
check('custom origins default to enforce', resolveLiveHeaderPolicy('https://markets.example.com') === 'enforce');
check('explicit enforce overrides GitHub Pages default', resolveLiveHeaderPolicy('https://example.github.io/app', 'enforce') === 'enforce');
check('missing GitHub Pages header is an operator warning', evaluateLiveHeader('operator-required', '', 'nosniff').outcome === 'WARN');
check('missing enforced header is a failure', evaluateLiveHeader('enforce', '', 'nosniff').outcome === 'FAIL');
check('matching enforced header passes', evaluateLiveHeader('enforce', 'nosniff', 'nosniff').outcome === 'PASS');

if (errors.length) {
  console.error('Live header policy contract failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}

console.log('Live header policy contract OK: github.io=operator-required/WARN, custom=enforce/FAIL, matching=PASS.');
