import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filings = JSON.parse(await fs.readFile(path.join(root, 'public-data', 'masters', 'filings.json'), 'utf8'));
const userAgent = 'AIO Screener research contact research@example.com';

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function archiveBase(cik, accession) {
  const numericCik = String(cik).replace(/^0+/, '');
  const accessionPath = accession.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${numericCik}/${accessionPath}`;
}

function selectPrior(recent, current) {
  const rows = recent.form.map((form, index) => ({
    form,
    accession: recent.accessionNumber[index],
    filedAt: recent.filingDate[index],
    periodOfReport: recent.reportDate[index],
    primaryDocument: recent.primaryDocument[index]
  })).filter((row) => row.form === '13F-HR' && row.periodOfReport && row.accession !== current.accession);
  const priorPeriod = rows.map((row) => row.periodOfReport).filter((period) => period < current.periodOfReport).sort().at(-1);
  return rows.find((row) => row.periodOfReport === priorPeriod) || null;
}

const output = [];
for (const manager of filings.managers.filter((item) => item.latestFiling?.cik || item.cik)) {
  if (!manager.latestFiling || !manager.cik) continue;
  const recent = await fetchJson(`https://data.sec.gov/submissions/CIK${manager.cik}.json`);
  const prior = selectPrior(recent.filings.recent, {
    accession: manager.latestFiling.accession,
    periodOfReport: manager.latestFiling.periodOfReport
  });
  if (!prior) {
    output.push({ id: manager.id, cik: manager.cik, priorFiling: null });
    continue;
  }
  const base = archiveBase(manager.cik, prior.accession);
  const indexJson = await fetchJson(`${base}/index.json`);
  const files = indexJson.directory?.item || [];
  const xmlCandidates = files
    .map((item) => item.name)
    .filter((name) => /\.xml$/i.test(name) && !/primary_doc\.xml$/i.test(name))
    .sort((a, b) => Number(/(info|13f|table)/i.test(b)) - Number(/(info|13f|table)/i.test(a)));
  let informationTableXml = null;
  for (const file of xmlCandidates) {
    const candidate = `${base}/${file}`;
    const response = await fetch(candidate, { headers: { 'User-Agent': userAgent, Accept: 'application/xml,text/xml' } });
    if (response.ok && /<[^>]*infoTable\b/i.test(await response.text())) {
      informationTableXml = candidate;
      break;
    }
  }
  output.push({
    id: manager.id,
    cik: manager.cik,
    priorFiling: informationTableXml ? {
      form: prior.form,
      accession: prior.accession,
      periodOfReport: prior.periodOfReport,
      filedAt: prior.filedAt,
      indexUrl: `${base}/${prior.accession}-index.html`,
      primaryDocumentXml: `${base}/${prior.primaryDocument}`,
      informationTableXml,
      informationTableHtml: informationTableXml.replace(/\.xml$/i, '.html')
    } : null
  });
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
