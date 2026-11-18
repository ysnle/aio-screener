// The words for a ticker entered twice: the add form's 합치기/바꾸기 dialog and the import notice for merged rows. The
// merge rule is src/domain/portfolio/holding-merge.js; this panel loads with it on first use (window._aioHoldingMerge),
// outside the boot set.
import { mergeHoldingPair, mergeDuplicatePositions } from '../../domain/portfolio/holding-merge.js';
import { listingCurrency } from '../../domain/portfolio/fx.js';

export { mergeDuplicatePositions };

// A price with no currency entered is in the listing's own currency (the table reads it that way), so the lot names a
// currency only when it differs from the listing's.
const CURRENCY_WORD = Object.freeze({ KRW: '원', USD: '달러' });
const currencyText = (code, ticker) => (!code || code === listingCurrency(ticker) ? '' : CURRENCY_WORD[code] || ` ${code}`);
const lot = (qty, cost, currency, ticker) => `수량 ${qty}주${cost != null ? `, 매수 단가 ${Number(cost).toLocaleString()}${currencyText(currency, ticker)}` : ''}`;
const currencyName = (code, ticker) => (code ? CURRENCY_WORD[code] || code : `상장 통화${CURRENCY_WORD[listingCurrency(ticker)] ? `(${CURRENCY_WORD[listingCurrency(ticker)]})` : ''}`);

/** The dialog for adding a held ticker again: { merged (position or null), message }. */
export function duplicateHoldingDialog(held, incoming) {
  const result = mergeHoldingPair(held, incoming);
  const ticker = held.ticker;
  const why = result.ok ? ` 합치면 ${lot(result.position.qty, result.position.cost, result.position.costCurrency, ticker)}(수량 가중평균)이 됩니다.`
    : result.reason === 'cost-currency-differs' ? ` 매수 단가 통화가 달라(보유 ${currencyName(result.existingCurrency, ticker)}, 입력 ${currencyName(result.incomingCurrency, ticker)}) 평균을 낼 수 없어 합칠 수 없습니다.`
      : ' 매수 단가가 없는 쪽이 있어 평균을 낼 수 없어 합칠 수 없습니다.';
  const message = `보유 목록에 이미 ${ticker} 종목이 있습니다(보유 ${lot(held.qty, held.cost, held.costCurrency, ticker)}). 입력: ${lot(incoming.qty, incoming.cost, incoming.costCurrency, ticker)}.${why} 바꾸기는 기존 수량·단가 대신 입력한 값을 저장합니다.`;
  return { merged: result.ok ? result.position : null, message };
}

/** The import confirmation's clause for tickers whose rows were merged (parsePortfolioBackup adjustments.positionsMerged). */
export function mergedImportText(notes) {
  const list = Array.isArray(notes) ? notes : [];
  if (!list.length) return '';
  return '같은 종목이 여러 줄이라 한 줄로 합침: ' + list.map((note) => `${note.ticker} ${note.rows}줄${note.priced ? '(수량 합산, 단가 가중평균, 목표 비중 합산)' : '(수량 합산, 단가 통화가 다르거나 없어 단가 미확인)'}`).join(', ');
}
