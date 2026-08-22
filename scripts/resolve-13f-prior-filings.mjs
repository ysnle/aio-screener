import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveBase, createSecClient } from './lib/sec-edgar.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filingsPath = path.join(root, 'public-data', 'masters', 'filings.json');
const filings = JSON.parse(await fs.readFile(filingsPath, 'utf8'));
const secClient = createSecClient();

function selectPrior(recent, current) {
  const rows = recent.form.map((form, index) => ({
    form,
    accession: recent.accessionNumber[index],
    filedAt: recent.filingDate[index],
    periodOfReport: recent.reportDate[index],
    primaryDocument: recent.primaryDocument[index]
  })).filter((row) => /^13F-HR(?:\/A)?$/.test(row.form) && row.periodOfReport && row.accession !== current.accession);
  const priorPeriod = rows.map((row) => row.periodOfReport).filter((period) => period < current.periodOfReport).sort().at(-1);
  return rows.find((row) => row.periodOfReport === priorPeriod) || null;
}

const output = [];
for (const manager of filings.managers.filter((item) => item.latestFiling?.cik || item.cik)) {
  if (!manager.latestFiling || !manager.cik) continue;
  const recent = await secClient.json(`https://data.sec.gov/submissions/CIK${manager.cik}.json`);
  const prior = selectPrior(recent.filings.recent, {
    accession: manager.latestFiling.accession,
    periodOfReport: manager.latestFiling.periodOfReport
  });
  if (!prior) {
    output.push({ id: manager.id, cik: manager.cik, priorFiling: null });
    continue;
  }
  const base = archiveBase(manager.cik, prior.accession);
  const indexJson = await secClient.json(`${base}/index.json`);
  const files = indexJson.directory?.item || [];
  const xmlCandidates = files
    .map((item) => item.name)
    .filter((name) => /\.xml$/i.test(name) && !/primary_doc\.xml$/i.test(name))
    .sort((a, b) => Number(/(info|13f|table)/i.test(b)) - Number(/(info|13f|table)/i.test(a)));
  let informationTableXml = null;
  for (const file of xmlCandidates) {
    const candidate = `${base}/${file}`;
    const xml = await secClient.text(candidate);
    if (/<[^>]*infoTable\b/i.test(xml)) {
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

const resolvedById = new Map(output.map((row) => [row.id, row.priorFiling]));
const result = {
  ...filings,
  reviewedAt: new Date().toISOString().slice(0, 10),
  managers: filings.managers.map((manager) => resolvedById.has(manager.id)
    ? { ...manager, priorFiling: resolvedById.get(manager.id) }
    : manager)
};
await fs.writeFile(filingsPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  ok: true,
  output: 'public-data/masters/filings.json',
  resolvedManagers: output.filter((row) => row.priorFiling).length,
  periods: Object.fromEntries(output.map((row) => [row.id, row.priorFiling?.periodOfReport || null]))
}));
