# 오늘

The 오늘 screen is the daily entry: a dashboard headline with the US-close verdict, the auto-written briefing, and the curated news list, switched by the hub tabs 요약 · 브리핑 · 뉴스.

## Sub-features

- `today-dashboard` — `#home-date-label` reads `<M/D> 미국 종가 기준`, `#home-hero-total` the verdict word and `#home-hero-components` the axis chips; `#home-hero-headline` is filled only while the verdict is held (판정 보류 reason).
- `today-briefing` — 오늘의 브리핑 with `#briefing-date-line` (guarded so it never shows a future time).
- `today-news` — `#news-window-label` (KST collection window, or `직전 수집본 …` when no fresh cycle), `#news-24h-count`, `#news-24h-sources` (`N개 출처`), `#market-news-count`; important list, full list with country/topic chips and type tabs, `#news-stale-banner`, `#news-refresh-btn`, Telegram scope `#news-tg-scope`.

## How to get to it (user POV)

- Sidebar 데일리 › 오늘 (default screen on first load).
- Hub tabs 요약 / 브리핑 / 뉴스.
- Deep links `#home`, `#briefing`, `#market-news`.

## Driving it with verify-aio

Preconditions:

- Doctor OK; `public-data/` has briefing and news snapshots.

- **Open.** Click sidebar `오늘`. `page-home` active; hub tabs exactly `요약,브리핑,뉴스`.
- **First-screen order (P2089).** `window._aioTodayVerdict` is a pending request for `public-data/today-verdict.json`; the served `index.html` `<head>` preloads `responsive.css` and holds no legacy `js/aio-*` script or script preload. The live `document.head` is the wrong place to look, because `aio-chat.js` (idle, or at once under webdriver) and `aio-qa-audits.js` are appended there after boot.
- **Verdict.** `#home-date-label` matches `/미국 종가 기준/`, `#home-hero-total` is not `판정 대기` and `#home-hero-components` has a child.
- **Briefing.** Tab `브리핑` → `page-briefing`; `#briefing-date-line` non-empty.
- **News.** Tab `뉴스` → `page-market-news`; `#news-window-label` matches `/KST|직전 수집본/`, `#news-24h-count` has a digit, `#news-24h-sources` matches `/개 출처/`, `#market-news-count` non-empty.
- **Proof.** `drive today` → `_artifacts/verify-aio/<run>/today-<viewport>/`.

## Gotchas

- The headline date is the last US close in the snapshot, not today.
- News counts change every data refresh; assert structure, never exact numbers.
- `#news-refresh-btn` is a live re-collect; locally it hits CORS and proves nothing.
