// The one way a chat tool turns what the model typed into a symbol: the app's own normaliser (a six-digit KRX code or a
// registered Korean name becomes `005930.KS`, a registered company name its ticker) and the app's own known-symbol check
// (name registry, KRX list, screener universe, US listings confirmed this session). Both are installed at boot by
// src/app/compatibility-globals.js. A symbol the app does not know is refused, never guessed.

/** The canonical symbol for `raw`, or null when the app does not know it. */
export function resolveToolSymbol(root, raw) {
  const text = String(raw ?? '').normalize('NFKC').trim();
  if (!text || text.length > 40) return null;
  if (typeof root?._aioNormalizeTickerInput !== 'function' || typeof root?._aioIsKnownTicker !== 'function') return null;
  let symbol = '';
  try { symbol = String(root._aioNormalizeTickerInput(text) || '').trim().toUpperCase(); } catch (_) { return null; }
  if (!symbol) return null;
  try { return root._aioIsKnownTicker(symbol) ? symbol : null; } catch (_) { return null; }
}

/** The reader-facing name of a symbol: the registry's Korean or English name, the KRX name, else the symbol. */
export function symbolLabel(root, symbol) {
  const id = String(symbol || '').toUpperCase();
  const entry = root?.AIO_TICKER_NAME_REGISTRY?.entries?.[id];
  const kr = root?.KR_STOCK_DB?.[id.replace(/\.K[SQ]$/, '')]?.name;
  return String(entry?.kr || kr || entry?.en || id);
}

export const unknownSymbolText = (raw) => `등록되지 않은 종목입니다: ${String(raw ?? '').slice(0, 40)}. 화면에 등록된 티커나 회사 이름으로만 요청할 수 있습니다.`;
export const isKrSymbol = (symbol) => /\.K[SQ]$/i.test(String(symbol || ''));
