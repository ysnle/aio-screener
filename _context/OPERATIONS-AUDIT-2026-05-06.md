---
verified_by: codex
last_verified: 2026-05-06
confidence: high
target_version: v48.80
---

# Operations Audit - 2026-05-06

## Scope

This audit focuses on long-running operation and self-operation risks, separate from visual/page QA:

- deploy/version/cache rotation
- browser self-diagnostics
- external API degradation and fallback visibility
- local storage/cache survivability
- operator handoff through project documents

## Findings

| Area | Status | Notes |
|---|---|---|
| App/version parity | fixed | `APP_VERSION`, `version.json`, static title/badge, and `sw.js` are synchronized to v48.80. |
| Service worker cache rotation | fixed | `SW_VERSION` was stale at v48.66; v48.80 rotates `aio-shell-*` and `aio-data-*` caches on activation. |
| SW observability | fixed | `sw.js` now supports `GET_HEALTH` with version, build, cache names, and cache keys. |
| Runtime mismatch visibility | fixed | `data-status-panel` now appends the controlled SW version and warns if SW/app versions diverge. |
| Operator health check | fixed | `AIO.getOperationalHealth()` returns app, SW, storage, API, RSS, cache, last-fetch, and log-rate status in one snapshot. |
| API fault isolation | already present | `_apiHealth`, `_reportApiOk`, `_reportApiError`, proxy backoff, stale-cache fallback, and RSS source health are active. |
| Storage survivability | already present | `AIO_Cache`, stale proxy cache cleanup, quote TTL checks, and localStorage availability guards are present. |

## Operator Command

Run this in the browser console after the app loads:

```js
AIO.getOperationalHealth()
```

Expected steady state:

- `status` is `ok` or `warn` while external public APIs are rate-limited.
- `appVersion` matches `serviceWorker.version` after the service worker controls the page.
- `storage.localStorage` is `true`.
- `api.error` is `0` unless an upstream API is genuinely down.

## Regression Guard

Before deploy, assert these release sync points:

```text
index.html title/badge = js/aio-core.js APP_VERSION = version.json.version = sw.js SW_VERSION
```

Then load the deployed site once, hard-refresh if a prior service worker is active, and evaluate:

```js
AIO.getOperationalHealth().serviceWorker
```

The service worker version should settle to the current app version after activation.
