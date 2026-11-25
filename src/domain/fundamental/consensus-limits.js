// How old a consensus estimate and the close beside it may be. Kept apart from consensus-read.js so the index-earnings
// stage (in the boot path) reads the two limits without bringing the stock card's whole reader with it.
export const CONSENSUS_MAX_AGE_DAYS = 21;
/** A close more than 10 calendar days old (about a week of sessions plus a holiday weekend) is not the current price. */
export const CONSENSUS_PRICE_MAX_AGE_DAYS = 10;
