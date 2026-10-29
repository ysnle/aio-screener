// v59.43: earnings-results filings on EDGAR, shared by the event-brief producer and the earnings-calendar gap check.
// Requests go through createSecClient (scripts/lib/sec-edgar.mjs: declared User-Agent, paced, retried). This module only
// parses: the submissions feed into rows with their 8-K items, the full submission text into its documents, and HTML
// into plain text for the brief's number check.
import { archiveBase, normalizeCik } from './sec-edgar.mjs';

export const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
export const submissionsUrl = (cik) => `https://data.sec.gov/submissions/CIK${normalizeCik(cik)}.json`;
export const submissionTextUrl = (cik, accession) => `${archiveBase(cik, accession)}/${accession}.txt`;

/** Exact ticker → CIK from SEC's own list (no fuzzy match: a ticker the list does not carry has no CIK). */
export function tickerCikMap(payload) {
  const map = new Map();
  for (const row of Object.values(payload || {})) if (row?.ticker && Number.isFinite(Number(row.cik_str))) map.set(String(row.ticker).toUpperCase(), Number(row.cik_str));
  return map;
}

/** The recent filings with their 8-K item list: { accession, form, items, filingDate, acceptedAt, primaryDocument }. */
export function filingRowsWithItems(submissions) {
  const recent = submissions?.filings?.recent;
  if (!recent || !Array.isArray(recent.accessionNumber)) return [];
  return recent.accessionNumber.map((accession, i) => ({
    accession,
    form: recent.form?.[i] || '',
    items: String(recent.items?.[i] || ''),
    filingDate: recent.filingDate?.[i] || null,
    acceptedAt: recent.acceptanceDateTime?.[i] || null,
    primaryDocument: recent.primaryDocument?.[i] || null
  }));
}

/** An 8-K that reports results (Item 2.02 Results of Operations and Financial Condition). */
export const isResultsFiling = (row) => row?.form === '8-K' && /(?:^|,)\s*2\.02\b/.test(row.items || '');

/** The documents of a full submission text file: [{ type, filename, text }]. */
export function submissionDocuments(fullText) {
  const docs = [];
  for (const match of String(fullText || '').matchAll(/<DOCUMENT>([\s\S]*?)<\/DOCUMENT>/g)) {
    const block = match[1];
    docs.push({
      type: (block.match(/<TYPE>([^\n<]+)/) || [])[1]?.trim() || '',
      filename: (block.match(/<FILENAME>([^\n<]+)/) || [])[1]?.trim() || '',
      text: (block.match(/<TEXT>([\s\S]*?)<\/TEXT>/) || [])[1] || ''
    });
  }
  return docs;
}

/** The results exhibit: EX-99.1 first, else the first EX-99.x. */
export function resultsExhibit(fullText) {
  const docs = submissionDocuments(fullText).filter((doc) => /^EX-99/i.test(doc.type));
  return docs.find((doc) => /^EX-99\.1$/i.test(doc.type)) || docs[0] || null;
}

/** A 6-K exhibit (foreign issuers file no Item 2.02) counts as a results release only when it reads like one. */
export const looksLikeQuarterlyResults = (text) => /\b(?:first|second|third|fourth)\s+quarter\b|\b[1-4]Q\s?\d{2}\b|\bQ[1-4]\s?\d{2,4}\b/i.test(text)
  && /\b(?:net\s+)?revenues?\b/i.test(text) && /\b(?:earnings|results|net income)\b/i.test(text);

export function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n').replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}
