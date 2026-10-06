// P1428 (Codex review 2026-10-04): the user guide described retired surfaces (0~100 환경 점수, Action Item,
// 스윙/데이 모드, old screen names). The 화면 안내 is now rendered from ROUTE_HUBS — the same table that
// draws the menu and the in-page tabs — plus this text, so a screen added, renamed or merged shows up in the
// guide automatically, and ci-capability-claim-contract-check rejects retired terms in the guide.

export const GUIDE_SCREEN_TEXT = Object.freeze({
  today: Object.freeze({
    question: '오늘 시장은 어떤 상태이고, 무엇이 달라졌나?'
  }),
  market: Object.freeze({
    question: '지금 주식시장의 바탕(추세·참여·변동성·금리·신용·유가와 달러)은 우호적인가, 부담인가?'
  }),
  macro: Object.freeze({
    question: '경기·물가·금리·환율이 어느 방향으로 움직이고, 그것이 주가에 어떻게 전달되나?'
  }),
  themes: Object.freeze({
    question: '어떤 산업·테마의 가격이 시장보다 강하고, 그 안에서 누가 앞서나?'
  }),
  stock: Object.freeze({
    question: '이 회사는 어떤 회사이고, 차트는 어떤 상태인가?'
  }),
  screener: Object.freeze({
    question: '조건에 맞는 종목은 무엇이고, 그 순위는 과거에 실제로 통했나?'
  }),
  portfolio: Object.freeze({
    question: '내 보유 종목의 비중과 위험은 어떤가?'
  }),
  learn: Object.freeze({
    question: '개념의 정의와 전달 경로, 산업의 수익 구조, 운용사의 방식과 13F에 보이는 것은 무엇인가?'
  })
});
