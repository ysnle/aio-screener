import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function assessWorkerSetup(proxy, fast, secretNames = []) {
  const present = new Set(secretNames);
  return {
    aiReady: proxy?.ai?.ready === true,
    fastQuotesObserved: fast?.coverage || null,
    dispatchConfigured: fast?.schedulerDispatch?.configured === true,
    dispatchReason: fast?.schedulerDispatch?.lastObservation?.reason || null,
    githubCredentials: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'AIO_QUOTES_KV_ID', 'OPENAI_API_KEY', 'AIO_AUTOMATION_TOKEN', 'AIO_REFRESH_DISPATCH_TOKEN'].map(name => ({name, present:present.has(name)})),
    relay: { fred: 'retired from the Worker relay (v57.79); scheduled artifacts use Actions credentials', bokConfigured:proxy?.relay?.configured?.bok === true, kosisConfigured:proxy?.relay?.configured?.kosis === true },
    cloudflareAccountVerification: 'NOT_VERIFIED_WITH_ACCOUNT_AUTH',
    notes: ['Health readiness does not certify answers or remaining monthly budget.', 'Credential presence does not certify permissions, expiry or values.', 'Fast quote observation does not enable its public-config route.']
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const config = JSON.parse(readFileSync(resolve(root, 'public-config.json'), 'utf8'));
  const probe = async url => {
    try {
      const res = await fetch(url, { headers:{ Origin:'https://ysnle.github.io', 'X-AIO-App-Token':'aio-screener-app-v1' }, signal:AbortSignal.timeout(8000) });
      if (!res.ok) return { error:'HTTP_' + res.status };
      return await res.json();
    } catch { return {error:'PROBE_UNAVAILABLE'}; }
  };
  const [proxy,fast] = await Promise.all([probe(config.ai.workerUrl + '/health'), probe('https://aio-screener-data-plane.zmfhd007.workers.dev/health')]);
  let secretNames = [], githubVerification = 'NOT_REQUESTED';
  if (process.argv.includes('--github')) {
    try {
      secretNames = JSON.parse(execFileSync('gh',['secret','list','--repo','ysnle/aio-screener','--json','name'], {encoding:'utf8',timeout:30000})).map(row=>row.name);
      githubVerification = 'NAMES_ONLY';
    } catch { githubVerification = 'UNAVAILABLE'; }
  }
  const report = { schemaVersion:'aio-worker-setup.v1', checkedAt:new Date().toISOString(), githubVerification, proxyRevision:proxy.revision || null, publicFastQuotesEnabled:config.marketData?.fastQuotes?.enabled === true, ...assessWorkerSetup(proxy,fast,secretNames) };
  const dir = resolve(root,'_artifacts/worker-structure-20261011');
  mkdirSync(dir,{recursive:true});
  writeFileSync(resolve(dir,'worker-setup.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
