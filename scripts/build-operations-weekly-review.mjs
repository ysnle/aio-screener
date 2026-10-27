#!/usr/bin/env node
// Collects the weekly operator review evidence (v58.84) and prints the issue body to stdout.
// Runs only in .github/workflows/operations-weekly-review.yml. Token values are sent only to
// their own issuer and never printed; `--status-file` receives needsAction for the workflow.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import endpoints from '../architecture/worker-endpoints.json' with { type: 'json' };
import { evaluateWeeklyReview, parseGithubTokenExpiration, renderWeeklyReviewMarkdown } from './lib/operations-weekly-review.mjs';

export const WEEKLY_REVIEW_MARKER = '<!-- aio-operations-weekly-review -->';
const TIMEOUT_MS = 15_000;

async function request(fetchImpl, url, headers) {
  try {
    return await fetchImpl(url, { headers, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (_) {
    return null;
  }
}

async function githubDispatchToken(fetchImpl, token, repo) {
  if (!token) return { configured: false };
  const res = await request(fetchImpl, `https://api.github.com/repos/${repo}`, {
    Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'aio-operations-weekly-review'
  });
  if (!res) return { configured: true, valid: false, httpStatus: 'network' };
  const header = res.headers.get('github-authentication-token-expiration');
  return { configured: true, valid: res.ok, httpStatus: res.status, expiresAt: header ? parseGithubTokenExpiration(header) ?? 'unparsed' : null };
}

async function cloudflareToken(fetchImpl, token, accountId) {
  if (!token) return { configured: false };
  const headers = { Authorization: `Bearer ${token}` };
  // User-owned tokens verify at /user/tokens/verify; account-owned tokens only at the account path.
  const urls = ['https://api.cloudflare.com/client/v4/user/tokens/verify'];
  if (accountId) urls.push(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/tokens/verify`);
  let lastStatus = 'network';
  for (const url of urls) {
    const res = await request(fetchImpl, url, headers);
    if (!res) continue;
    lastStatus = res.status;
    const body = await res.json().catch(() => null);
    if (res.ok && body?.success === true && body.result?.status === 'active') {
      return { configured: true, valid: true, httpStatus: res.status, expiresAt: body.result.expires_on || null };
    }
  }
  return { configured: true, valid: false, httpStatus: lastStatus };
}

async function repoSizeKb(fetchImpl, token, repo) {
  const res = await request(fetchImpl, `https://api.github.com/repos/${repo}`, {
    Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'aio-operations-weekly-review'
  });
  const body = res?.ok ? await res.json().catch(() => null) : null;
  return Number.isSafeInteger(body?.size) ? body.size : null;
}

// v59.27: falls back to the automation token the Worker also accepts here, so no extra secret is needed.
async function aiUsage(fetchImpl, operatorToken, automationToken) {
  if (!operatorToken && !automationToken) return { configured: false };
  const url = new URL(endpoints.proxy.operatorAiUsagePath, endpoints.proxy.baseUrl).href;
  const res = await request(fetchImpl, url, operatorToken ? { 'X-AIO-Operator-Token': operatorToken } : { 'X-AIO-Automation-Token': automationToken });
  const body = res?.ok ? await res.json().catch(() => null) : null;
  return { configured: true, monthlyReservedMicroUsd: body?.monthlyReservedMicroUsd, monthlyBudgetMicroUsd: body?.monthlyBudgetMicroUsd };
}

export async function collectWeeklyReview({ fetchImpl = globalThis.fetch, env = process.env, now = new Date().toISOString() } = {}) {
  const repo = env.GITHUB_REPOSITORY || 'ysnle/aio-screener';
  const [dispatch, cloudflare, size, usage] = await Promise.all([
    githubDispatchToken(fetchImpl, env.AIO_REFRESH_DISPATCH_TOKEN, repo),
    cloudflareToken(fetchImpl, env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID),
    repoSizeKb(fetchImpl, env.GITHUB_TOKEN, repo),
    aiUsage(fetchImpl, env.AIO_OPERATOR_TOKEN, env.AIO_AUTOMATION_TOKEN)
  ]);
  return evaluateWeeklyReview({ now, githubDispatchToken: dispatch, cloudflareToken: cloudflare, repoSizeKb: size, aiUsage: usage });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const statusIndex = process.argv.indexOf('--status-file');
  const review = await collectWeeklyReview();
  if (statusIndex > 0) writeFileSync(process.argv[statusIndex + 1], `needs_action=${review.needsAction}\n`);
  process.stdout.write(`${renderWeeklyReviewMarkdown(review, WEEKLY_REVIEW_MARKER)}\n`);
}
