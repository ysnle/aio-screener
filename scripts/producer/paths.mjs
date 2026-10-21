// Public artifact paths shared by the producer modules (scripts/producer/*) and scripts/fetch-data.mjs.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = `${dirname(fileURLToPath(import.meta.url))}/../..`;
export const OUT = `${REPO_ROOT}/public-data/data.json`;
export const HIST = `${REPO_ROOT}/public-data/history.json`;
export const SCENARIO_STATE_OUT = `${REPO_ROOT}/public-data/scenario-state.json`;
export const SCENARIO_OUTCOMES_OUT = `${REPO_ROOT}/public-data/scenario-outcomes.json`;
export const MARKET_SNAPSHOT_OUT = `${REPO_ROOT}/public-data/market-snapshot.json`;
export const SEC_FUNDAMENTALS_OUT = `${REPO_ROOT}/public-data/sec-fundamentals.json`;
export const EARNINGS_CALENDAR_OUT = `${REPO_ROOT}/public-data/earnings-calendar.json`; // read-only here (fetch-earnings-calendar.mjs writes it)
