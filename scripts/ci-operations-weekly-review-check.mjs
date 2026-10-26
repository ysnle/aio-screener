// v58.84: weekly operator review — token expiry, repository size and AI month status, offline.
import assert from 'node:assert/strict';
import { collectWeeklyReview, WEEKLY_REVIEW_MARKER } from './build-operations-weekly-review.mjs';
import { evaluateWeeklyReview, parseGithubTokenExpiration, renderWeeklyReviewMarkdown } from './lib/operations-weekly-review.mjs';

const NOW = '2026-11-02T10:00:00.000Z';
const status = (review, id) => review.findings.find((finding) => finding.id === id).status;

assert.equal(parseGithubTokenExpiration('2026-11-20 00:00:00 UTC'), '2026-11-20T00:00:00.000Z', 'v58.84 GitHub UTC expiry header');
assert.equal(parseGithubTokenExpiration('2026-11-20 09:00:00 +0900'), '2026-11-20T00:00:00.000Z', 'v58.84 GitHub offset expiry header');
assert.equal(parseGithubTokenExpiration('next tuesday'), null, 'v58.84 unparseable expiry header');

{
  const review = evaluateWeeklyReview({
    now: NOW,
    githubDispatchToken: { configured: true, valid: true, expiresAt: '2026-11-20T00:00:00.000Z' },
    cloudflareToken: { configured: true, valid: true, expiresAt: null },
    repoSizeKb: 742_000,
    aiUsage: { configured: true, monthlyReservedMicroUsd: 17_000_000, monthlyBudgetMicroUsd: 20_000_000 }
  });
  assert.equal(status(review, 'github-dispatch-token'), 'WARN', 'v58.84 expiry within 30 days warns');
  assert.equal(status(review, 'cloudflare-token'), 'CLEAR', 'v58.84 a token without expiry is clear');
  assert.equal(status(review, 'repo-size'), 'CLEAR', 'v58.84 725 MB is under the 900 MB warning');
  assert.equal(status(review, 'ai-monthly-budget'), 'WARN', 'v58.84 85% of the month warns');
  assert.equal(review.needsAction, true, 'v58.84 a warning needs action');
  const body = renderWeeklyReviewMarkdown(review, WEEKLY_REVIEW_MARKER);
  assert.ok(body.startsWith(WEEKLY_REVIEW_MARKER), 'v58.84 the issue body carries the marker');
  assert.ok(!/17[,.]?000|\$1[0-9]|micro/i.test(body), 'v58.84 R658: the public issue never carries the AI amount');
}

{
  const review = evaluateWeeklyReview({
    now: NOW,
    githubDispatchToken: { configured: true, valid: false, httpStatus: 401 },
    cloudflareToken: { configured: true, valid: true, expiresAt: '2026-10-30T00:00:00Z' },
    repoSizeKb: 2_200_000,
    aiUsage: { configured: false }
  });
  assert.equal(status(review, 'github-dispatch-token'), 'ALERT', 'v58.84 a rejected token alerts');
  assert.equal(status(review, 'cloudflare-token'), 'ALERT', 'v58.84 a past expiry alerts');
  assert.equal(status(review, 'repo-size'), 'ALERT', 'v58.84 over 2 GB alerts');
  assert.equal(status(review, 'ai-monthly-budget'), 'NOT_CONFIGURED', 'v58.84 no operator token is not configured');
}

{
  const review = evaluateWeeklyReview({ now: NOW, githubDispatchToken: { configured: false }, cloudflareToken: { configured: false }, repoSizeKb: null, aiUsage: { configured: false } });
  assert.equal(review.needsAction, false, 'v58.84 missing evidence never opens an action issue on its own');
  assert.equal(status(review, 'repo-size'), 'UNKNOWN', 'v58.84 unreadable size is unknown');
}

{
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), auth: init.headers.Authorization || init.headers['X-AIO-Operator-Token'] });
    if (String(url).includes('/user/tokens/verify')) return new Response(JSON.stringify({ success: false }), { status: 401 });
    if (String(url).includes('/accounts/acct/tokens/verify')) return Response.json({ success: true, result: { status: 'active', expires_on: '2027-06-01T00:00:00Z' } });
    if (String(url).includes('/_ops/ai-usage')) return Response.json({ monthlyReservedMicroUsd: 1_000_000, monthlyBudgetMicroUsd: 20_000_000 });
    const headers = init.headers.Authorization === 'Bearer pat' ? { 'github-authentication-token-expiration': '2027-03-01 00:00:00 UTC' } : {};
    return Response.json({ size: 742_000 }, { headers });
  };
  const review = await collectWeeklyReview({
    fetchImpl, now: NOW,
    env: { GITHUB_REPOSITORY: 'o/r', GITHUB_TOKEN: 'gh', AIO_REFRESH_DISPATCH_TOKEN: 'pat', CLOUDFLARE_API_TOKEN: 'cf', CLOUDFLARE_ACCOUNT_ID: 'acct', AIO_OPERATOR_TOKEN: 'op' }
  });
  assert.equal(status(review, 'github-dispatch-token'), 'CLEAR', 'v58.84 a far expiry is clear');
  assert.equal(status(review, 'cloudflare-token'), 'CLEAR', 'v58.84 an account-owned token verifies at the account path');
  assert.equal(status(review, 'ai-monthly-budget'), 'CLEAR', 'v58.84 5% of the month is clear');
  assert.equal(review.needsAction, false, 'v58.84 a clear week needs nothing');
  for (const call of calls) {
    if (call.url.startsWith('https://api.cloudflare.com/')) assert.equal(call.auth, 'Bearer cf', 'v58.84 the Cloudflare token goes only to Cloudflare');
    if (call.url.includes('/_ops/ai-usage')) assert.equal(call.auth, 'op', 'v58.84 the operator token goes only to the Worker');
  }
}

console.log('ci-operations-weekly-review-check: PASS');
