// The screener route's public surface. The page lives in ./screener/ (model, filters, table, views, validation-tab,
// inspector, workbench, page); this file keeps the import path the router, the stock pages and the gates use.
export {
  SCREENER_COLUMN_REGISTRY, factorScoreColor, entryTiming, liveRow, mergeThemeAliases, extensionMultiple, pivotDistancePct,
  marketReturnPercentiles, conditionMargins, range52Position, forwardPe, customRead, sortRows,
  capFilterValue, visibleRank, rankGrade, vcpStageLabel, describeStaleDates, profileComputability, factorSessionLag, describeRankingHold
} from './screener/model.js';
export { filterRows, syncRankFilterLabels, syncScreenerControlAvailability } from './screener/filters.js';
export { createScreenerPage } from './screener/page.js';
