// Map: features/market.md
import { openFromNav, tabTo, expectText, expectCount, expectTabs } from '../lib/drive.mjs';

export default {
  title: '시장 상태 (개요 · 시장 폭 · 투자 심리)',
  steps: [
    ['nav 시장 상태 → 개요', (p) => openFromNav(p, '시장 상태', 'page-signal')],
    ['허브 탭 3개', (p) => expectTabs(p, ['개요', '시장 폭', '투자 심리'])],
    ['국면 판정 확정 (판정 대기 아님)', async (p) => ({
      ...(await expectText(p, '#regime-overall')),
      ...(await expectText(p, '#regime-basis', { pattern: /종가 기준/ }))
    })],
    // v60.31 (안 A): the hero sentence and its 판정 근거 fold left; the reason is each row's two lines (판정 사유, flip).
    ['반대 근거 줄 · 충돌 조합', async (p) => ({
      ...(await expectCount(p, '#regime-conflicts li', 1)),
      counter: await p.evaluate(() => { const n = document.getElementById('regime-counter'); return n && !n.hidden ? n.innerText.trim() : '(none: count is even or no axis leans the other way)'; })
    })],
    ['미국 6개 축 행(접힘 없음, 풀이 2줄) + 한국 참고 보드', async (p) => {
      const out = { ...(await expectCount(p, '#regime-board .ind-row', 6)), ...(await expectCount(p, '#regime-board .ind-row__line.is-flip', 6)), ...(await expectCount(p, '#regime-board-kr > *', 1)) };
      const folded = await p.$$eval('#regime-board details, #regime-board-watch details', (n) => n.length);
      if (folded) throw new Error(`${folded} <details> inside the indicator rows (v60.31: rows are never folded)`);
      return { ...out, rowFolds: folded };
    }],
    // v60.31: the fold census — every visible <details> on the screen (all views) by data-fold-kind; any without a kind fails.
    ['접힘 종류 집계', async (p) => {
      const census = await p.evaluate(() => {
        const page = document.getElementById('page-signal');
        const before = page.dataset.view;
        const out = {};
        for (const view of ['now', 'story', 'korea']) {
          page.dataset.view = view;
          const shown = [...page.querySelectorAll('details')].filter((d) => d.checkVisibility?.() ?? d.getClientRects().length > 0)
            .filter((d) => !d.parentElement.closest('details:not([open])'));
          out[view] = shown.reduce((acc, d) => { const kind = d.dataset.foldKind || `unmarked:${d.className || d.id || 'details'}`; acc[kind] = (acc[kind] || 0) + 1; return acc; }, {});
        }
        page.dataset.view = before;
        return out;
      });
      const unmarkedNow = Object.keys(census.now).filter((kind) => kind.startsWith('unmarked'));
      if (unmarkedNow.length) throw new Error(`지금 view has folds outside raw-table/method/sources: ${unmarkedNow.join(', ')}`);
      return census;
    }],
    ['탭 시장 폭', (p) => tabTo(p, '시장 폭', 'page-breadth')],
    // v60.31 (안 A): the verdict, its condition and the counter line, then each measure as an unfolded row and its chart.
    ['시장 폭 판정 · 지표 행 · 추세 카드', async (p) => {
      await p.waitForFunction(() => { const el = document.querySelector('#breadth-state'); return el && !el.classList.contains('is-unknown') && el.innerText.trim() && el.innerText.trim() !== '판정 대기'; }, null, { timeout: 25000 });
      const out = { ...(await expectText(p, '#breadth-state')), ...(await expectText(p, '#breadth-read', { min: 4 })), ...(await expectText(p, '#breadth-flip', { pattern: /판정이 바뀌는 조건/ })),
        ...(await expectCount(p, '#breadth-chart-grid .bb-rows > .ind-row', 9)), ...(await expectCount(p, '#breadth-chart-grid .trend-card', 9)) };
      const rowFolds = await p.$$eval('#breadth-chart-grid .bb-rows details', (n) => n.length);
      if (rowFolds) throw new Error(`${rowFolds} <details> inside the breadth rows (v60.31: rows are never folded)`);
      return { ...out, counter: await p.evaluate(() => { const n = document.getElementById('breadth-counter'); return n && !n.hidden ? n.innerText.trim() : '(none)'; }) };
    }],
    ['시장 폭 접힘 종류 집계', (p) => foldCensus(p, 'page-breadth')],
    ['탭 투자 심리', (p) => tabTo(p, '투자 심리', 'page-sentiment')],
    ['투자 심리 판정 · 상태어 집계 · 지표 행', async (p) => {
      const out = {
        ...(await expectText(p, '#sentiment-basis')),
        ...(await expectText(p, '#sentiment-state')),
        ...(await expectText(p, '#sentiment-synthesis', { min: 10 })),
        ...(await expectCount(p, '#sentiment-card-grid > .ind-row', 4)),
        ...(await expectCount(p, '#sentiment-chart-grid .trend-card', 1))
      };
      const rowFolds = await p.$$eval('#sentiment-card-grid details', (n) => n.length);
      if (rowFolds) throw new Error(`${rowFolds} <details> inside the sentiment rows (v60.31: rows are never folded)`);
      return { ...out, counter: await p.evaluate(() => { const n = document.getElementById('sentiment-counter'); return n && !n.hidden ? n.innerText.trim() : '(none)'; }) };
    }],
    ['투자 심리 접힘 종류 집계', (p) => foldCensus(p, 'page-sentiment')]
  ]
};

// v60.31: every visible <details> on one screen by data-fold-kind; one without a kind fails.
async function foldCensus(p, pageId) {
  const census = await p.evaluate((id) => {
    const page = document.getElementById(id);
    const shown = [...page.querySelectorAll('details')].filter((d) => d.checkVisibility?.() ?? d.getClientRects().length > 0).filter((d) => !d.parentElement.closest('details:not([open])'));
    return shown.reduce((acc, d) => { const kind = d.dataset.foldKind || `unmarked:${d.className || d.id || 'details'}`; acc[kind] = (acc[kind] || 0) + 1; return acc; }, {});
  }, pageId);
  const unmarked = Object.keys(census).filter((kind) => kind.startsWith('unmarked'));
  if (unmarked.length) throw new Error(`${pageId} has folds outside raw-table/method/sources: ${unmarked.join(', ')}`);
  return census;
}
