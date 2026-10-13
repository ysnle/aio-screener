// Map: features/ai-panel.md
import { expectCount, visibleText } from '../lib/drive.mjs';

const panelOpen = (p, open) => p.waitForFunction((o) => document.querySelector('#ai-panel')?.getAttribute('aria-hidden') === (o ? 'false' : 'true'), open, { timeout: 8000 });

export default {
  title: 'AI 도우미 패널 (열기 · 추천 칩 · Enter 전송 · 연결 불가 안내 · Esc 닫기)',
  steps: [
    ['topbar AI 도우미 → 패널 열림', async (p) => {
      await p.click('#topbar-ai-btn');
      await panelOpen(p, true);
      return { expanded: await p.getAttribute('#topbar-ai-btn', 'aria-expanded'), inert: await p.evaluate(() => document.querySelector('#ai-panel').hasAttribute('inert')) };
    }],
    ['추천 칩 표시', (p) => expectCount(p, '#ai-panel-chips .ai-chip', 1, 8000)],
    ['질문 입력 + Enter 전송', async (p, { baseUrl, sendAi, context }) => {
      const paid = [];
      context.on('request', (r) => { if (/\/openai\b/.test(r.url())) paid.push(r.url()); });
      const before = await p.$$eval('#ai-panel-msgs .ai-msg', (n) => n.length);
      await p.fill('#ai-panel-inp', 'PER이 뭐야?');
      await p.press('#ai-panel-inp', 'Enter');
      if (baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost')) {
        // Local origin: the Worker /health preflight is CORS-rejected, so the send is short-circuited before any paid call.
        await p.waitForFunction((n) => {
          const m = [...document.querySelectorAll('#ai-panel-msgs .ai-msg.ai')];
          return document.querySelectorAll('#ai-panel-msgs .ai-msg').length > n && /응답할 준비가 되지 않았습니다/.test(m.at(-1)?.innerText || '');
        }, before, { timeout: 25000 });
        const kept = await p.inputValue('#ai-panel-inp');
        if (kept !== 'PER이 뭐야?') throw new Error(`question not kept in input (saw "${kept}")`);
        if (paid.length) throw new Error(`paid request sent while Worker unreachable: ${paid[0]}`);
        return { degradedNotice: (await visibleText(p, '#ai-panel-msgs')).slice(-120), inputKept: true, paidRequests: 0, sidebarStatus: await visibleText(p, '#llm-switch-label') };
      }
      if (!sendAi) return { skipped: 'reachable Worker: answer costs shared budget; pass --send-ai' };
      await p.waitForFunction((n) => document.querySelectorAll('#ai-panel-msgs .ai-msg').length > n + 1, before, { timeout: 90000 });
      return { answer: (await visibleText(p, '#ai-panel-msgs')).slice(-300), paidRequests: paid.length };
    }],
    ['Esc 닫기', async (p) => {
      await p.keyboard.press('Escape');
      await panelOpen(p, false);
      return { closed: true, expanded: await p.getAttribute('#topbar-ai-btn', 'aria-expanded') };
    }]
  ]
};
