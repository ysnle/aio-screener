const PLACEHOLDER_CONTACT = /(?:example\.com|contact@|research@|your[-_.]?email|localhost)/i;
const SEC_FORMS = /^(13F-(?:HR|NT))(?:\/A)?$/;
const OWNERSHIP_FORMS = /^SC 13(?:D|G)(?:\/A)?$/;

export function requireSecUserAgent(env = process.env) {
  const value = String(env.SEC_USER_AGENT || '').trim();
  if (!value || PLACEHOLDER_CONTACT.test(value) || !/@/.test(value)) {
    throw new Error('SEC_USER_AGENT must identify AIO Screener and include a monitored contact email; placeholders are rejected.');
  }
  return value;
}

export function normalizeCik(value) {
  return String(value || '').replace(/\D/g, '').padStart(10, '0');
}

export function archiveBase(cik, accession) {
  return `https://www.sec.gov/Archives/edgar/data/${normalizeCik(cik).replace(/^0+/, '')}/${String(accession).replace(/-/g, '')}`;
}

export function filingIndexUrl(cik, accession) {
  return `${archiveBase(cik, accession)}/${accession}-index.html`;
}

function submissionRows(payload) {
  const recent = payload?.filings?.recent || {};
  const forms = Array.isArray(recent.form) ? recent.form : [];
  return forms.map((form, index) => ({
    form,
    baseForm: String(form).replace(/\/A$/, ''),
    isAmendment: /\/A$/.test(String(form)),
    accession: recent.accessionNumber?.[index] || null,
    filedAt: recent.filingDate?.[index] || null,
    acceptedAt: recent.acceptanceDateTime?.[index] || null,
    periodOfReport: recent.reportDate?.[index] || null,
    primaryDocument: recent.primaryDocument?.[index] || null,
    primaryDocDescription: recent.primaryDocDescription?.[index] || null
  }));
}

export function recentSubmissionRows(payload) {
  return submissionRows(payload).filter((row) => SEC_FORMS.test(String(row.form)) && row.accession && row.periodOfReport);
}

export function recentOwnershipRows(payload) {
  return submissionRows(payload)
    .filter((row) => OWNERSHIP_FORMS.test(String(row.form)) && row.accession && row.filedAt)
    .sort((a, b) => String(b.filedAt).localeCompare(String(a.filedAt)) || String(b.accession).localeCompare(String(a.accession)));
}

function byNewest(a, b) {
  return String(b.periodOfReport).localeCompare(String(a.periodOfReport))
    || String(b.filedAt).localeCompare(String(a.filedAt))
    || String(b.accession).localeCompare(String(a.accession));
}

export function select13fFilings(payload) {
  const rows = recentSubmissionRows(payload).sort(byNewest);
  const latestSubmission = rows[0] || null;
  const holdingsRows = rows.filter((row) => row.baseForm === '13F-HR');
  const latestHoldings = holdingsRows[0] || null;
  const priorHoldings = holdingsRows.find((row) => row.periodOfReport < String(latestHoldings?.periodOfReport || '')) || null;
  const latestPeriodSubmissions = latestHoldings
    ? rows.filter((row) => row.periodOfReport === latestSubmission.periodOfReport)
    : [];
  const priorPeriodSubmissions = priorHoldings
    ? rows.filter((row) => row.periodOfReport === priorHoldings.periodOfReport)
    : [];
  return { rows, latestSubmission, latestHoldings, priorHoldings, latestPeriodSubmissions, priorPeriodSubmissions };
}

export function withArchiveUrls(cik, filing) {
  if (!filing) return null;
  const base = archiveBase(cik, filing.accession);
  const primaryDocumentUrl = filing.primaryDocument ? `${base}/${filing.primaryDocument}` : null;
  return {
    ...filing,
    indexUrl: filingIndexUrl(cik, filing.accession),
    primaryDocumentUrl,
    primaryDocumentXml: /\.xml(?:$|\?)/i.test(primaryDocumentUrl || '') ? primaryDocumentUrl : null
  };
}

export function createSecClient({ userAgent = requireSecUserAgent(), minIntervalMs = 125, maxRetries = 3, fetchFn = globalThis.fetch } = {}) {
  if (typeof fetchFn !== 'function') throw new Error('fetch is unavailable');
  let lastRequestAt = 0;
  let requestQueue = Promise.resolve();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function requestNow(url, accept) {
    const delay = Math.max(0, lastRequestAt + minIntervalMs - Date.now());
    if (delay) await wait(delay);
    lastRequestAt = Date.now();
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const response = await fetchFn(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept-Encoding': 'gzip, deflate',
          Accept: accept
        }
      });
      if (response.ok) return response;
      if (![403, 429, 500, 502, 503, 504].includes(response.status) || attempt === maxRetries) {
        throw new Error(`${response.status} ${url}`);
      }
      await wait(500 * (2 ** attempt));
    }
    throw new Error(`SEC request failed: ${url}`);
  }
  function request(url, accept) {
    const pending = requestQueue.then(() => requestNow(url, accept));
    requestQueue = pending.catch(() => {});
    return pending;
  }
  return {
    async json(url) { return (await request(url, 'application/json')).json(); },
    async text(url) { return (await request(url, 'application/xml,text/xml,text/html;q=0.9,*/*;q=0.8')).text(); }
  };
}

export function findInformationTableFiles(directoryIndex, primaryDocument = '') {
  const names = (directoryIndex?.directory?.item || [])
    .map((item) => item?.name)
    .filter(Boolean)
    .filter((name) => /\.xml$/i.test(name))
    .filter((name) => name !== primaryDocument)
    .filter((name) => !/^(?:submission|header|metadata|.*\.xsd)$/i.test(name));
  return [...new Set(names)];
}

function secCoverTagValue(source, name) {
  const qualified = `(?:[A-Za-z_][\\w.-]*:)?${name}`;
  const match = String(source || '').match(new RegExp(`<${qualified}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${qualified}>`, 'i'));
  return match ? String(match[1]).replace(/<[^>]+>/g, '').trim() : null;
}

function checkedHtmlOption(source, labelPattern) {
  const checkbox = `<td[^>]*class=["'][^"']*CheckBox[^"']*["'][^>]*>\\s*(?:<span[^>]*>)?\\s*X\\s*(?:<\\/span>)?\\s*<\\/td>`;
  const label = `<td[^>]*class=["'][^"']*FormText[^"']*["'][^>]*>\\s*${labelPattern}`;
  return new RegExp(`${checkbox}\\s*${label}`, 'i').test(String(source || ''));
}

export function parse13fAmendmentMetadata(source = '') {
  const taggedType = secCoverTagValue(source, 'amendmentType');
  const taggedFlag = secCoverTagValue(source, 'isAmendment');
  const taggedNumber = secCoverTagValue(source, 'amendmentNo');
  const restatementChecked = checkedHtmlOption(source, 'is\\s+a\\s+restatement\\.');
  const newHoldingsChecked = checkedHtmlOption(source, 'adds\\s+new\\s+holdings\\s+entries\\.');
  const amendmentChecked = /Check here if Amendment<\/td>\s*<td[^>]*class=["'][^"']*CheckBox[^"']*["'][^>]*>\s*(?:<span[^>]*>)?\s*X/i.test(String(source || ''));
  const amendmentNumberText = String(source || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ');
  const fallbackNumber = amendmentNumberText.match(/Amendment Number:\s*(\d+)/i)?.[1] || null;
  return Object.freeze({
    isAmendment: taggedFlag != null ? String(taggedFlag).toLowerCase() === 'true' : amendmentChecked || restatementChecked || newHoldingsChecked,
    amendmentType: taggedType || (restatementChecked ? 'RESTATEMENT' : newHoldingsChecked ? 'NEW HOLDINGS' : null),
    amendmentNumber: Number(taggedNumber ?? fallbackNumber) || null
  });
}

export function assertNoPlaceholderSecUserAgents(source, label = 'source') {
  if (/research@example\.com|contact@example\.com|AIO Dashboard contact@example\.com/i.test(String(source))) {
    throw new Error(`${label} contains a placeholder SEC User-Agent`);
  }
}
