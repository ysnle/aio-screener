// Durable bridges extracted from the 2026-08-29 supplied research packet.
// This module is deliberately reference-only: it contains no current values,
// issuer rankings, prices, targets, or investment recommendations.
export const SUPPLIED_MATERIALS_REFERENCE = Object.freeze({
  id: 'supplied-materials-2026-08-29',
  sourceKind: 'REFERENCE',
  operationalUse: 'reference-only',
  reviewedAt: '2026-08-29',
  updatedAt: '2026-09-11',
  sourcePackets: Object.freeze([
    Object.freeze({ id: '2026-09-11-supplied-materials', reviewedAt: '2026-09-11', sourceKind: 'REFERENCE', linkCount: 8, readableSources: 8, unreadableSources: 0, mediaAuditCount: 1, note: 'X 8건과 DELL 실적 후 돌파 첨부 차트를 직접 확인. UTC/KST 게시시각, 인용 게시물, 미디어 상태와 시계열을 분리하고 현재 데이터로 승격하지 않음' }),
    Object.freeze({ id: '2026-09-05-supplied-materials', reviewedAt: '2026-09-05', sourceKind: 'REFERENCE', linkCount: 18, readableSources: 18, unreadableSources: 0, mediaAuditCount: 11, note: '사용자 제공 X 17건·Vela GitHub 1건과 첨부 고노고 일보 이미지를 직접 확인. 게시시각·본문·이미지·시계열을 분리하고 현재 데이터로 승격하지 않음' }),
    Object.freeze({ id: '2026-08-30-market-research', reviewedAt: '2026-08-30', sourceKind: 'REFERENCE', readableSources: 6, unreadableSources: 4, note: 'X Article 포인터 4건은 공개 본문이 404로 반환되어 추측하지 않음' }),
    Object.freeze({ id: '2026-08-30-jalapeno', reviewedAt: '2026-08-30', sourceKind: 'REFERENCE', note: '공식 OpenAI 설명은 primary confirmation 후보, zartbot의 세부 마이크로아키텍처는 inferred reference' }),
    Object.freeze({ id: '2026-08-29-market-research', reviewedAt: '2026-08-29', sourceKind: 'REFERENCE', note: 'X/GitHub·공식 문서·첨부 이미지·일부 403/부분 접근 자료를 읽기 상태별로 분리한 선행 패킷' })
  ]),
  sourceAudit: Object.freeze([
    Object.freeze({ id: 'packet-2026-09-11', label: '2026-09-11 직접 확인 기술·리스크·매크로 자료', linkCount: 8, readableCount: 8, blockedCount: 0, status: 'DIRECT_READ', note: 'X 8건의 본문·UTC 게시시각·KST 환산·인용 게시물과 첨부 DELL 차트를 직접 확인. 날짜 종속 수치·목표·방향성 주장은 REFERENCE로 제한' }),
    Object.freeze({ id: 'packet-2026-09-05', label: '2026-09-05 직접 확인 시장·AI·아키텍처 자료', linkCount: 18, readableCount: 18, blockedCount: 0, status: 'DIRECT_READ', note: 'X 17건과 LuxAlgo/Vela README·architecture·API 문서를 직접 읽고, Melvin/Trader/StockAnalyst 이미지와 첨부 고노고 일보를 시각 확인. 게시 시점과 현재 관측값을 분리' }),
    Object.freeze({ id: 'packet-2026-08-30', label: '이번 시장·AI 자료', linkCount: 10, readableCount: 6, blockedCount: 4, status: 'MIXED_ACCESS', note: '본문 확인 자료만 프레임 추출에 사용하고, Article pointer 4건은 내용 추측을 금지' }),
    Object.freeze({ id: 'packet-2026-08-29', label: '이전 시장·금융·AI 자료', linkCount: 17, readableCount: 0, blockedCount: 0, status: 'REFERENCE_PACKET', note: 'ParadisLabs·Yonsei·Minervini·Future Walker·KKDW·ZeroHedge·Micron·NVIDIA·Fed·Goldman Sachs gs-quant·첨부 도표 등을 읽기 상태별로 기록' }),
    Object.freeze({ id: 'nested-official-and-secondary', label: '중첩 문서·공식 자료', linkCount: 10, readableCount: 0, blockedCount: 0, status: 'MIXED_ACCESS', note: 'Tema HBF·BlackRock/Fed·BCG·Micron·JPMorgan·Citrini·AI Insider·Fed Warsh·NVIDIA·AI Bottlenecks; 접근 수준이 다른 자료의 해석을 현재 데이터로 승격하지 않음' })
  ]),
  sourceLinks: Object.freeze([
    'https://x.com/NathanYJLee/status/2097957777922793710',
    'https://x.com/Trader_Jesse_/status/2097868442309472608',
    'https://x.com/markminervini/status/2097722372757295582',
    'https://x.com/NathanYJLee/status/2097557593573199994',
    'https://x.com/laylaperfume/status/2096959904410193928',
    'https://x.com/gimduha77994334/status/2096762435315384622',
    'https://x.com/ProblemSniper/status/2096672934828093812',
    'https://x.com/BTC_WyckoffLab/status/2095358094956245419',
    'https://x.com/RealSimpleAriel/status/2093778843186418078',
    'https://x.com/InvestNorthwise/status/2093778247171424706',
    'https://x.com/tmmrwseoul/status/2088951001562906868',
    'https://x.com/tmmrwseoul/status/2094003866597802019',
    'https://x.com/RossHaber/status/2093867858065232159',
    'https://x.com/dons_korea/status/2093868524720758872',
    'https://x.com/jukan05/status/2093641673171669020',
    'https://zartbot.github.io/blog/arch/jalapeno/en.html',
    'https://x.com/gimduha77994334/status/2093679410507616760',
    'https://x.com/Trader_Jesse_/status/2093569705340756408',
    'https://openai.com/index/jalapeno-first-results/',
    'https://x.com/ParadisLabs/status/2093472998711771421',
    'https://x.com/Yonsei_dent/status/2093324017898008598',
    'https://x.com/markminervini/status/2093365115693244926',
    'https://x.com/Future__Walker/status/2093346533005779448',
    'https://x.com/KKDW_KOREA/status/2093345000348373429',
    'https://x.com/zerohedge/status/2093309457639858477',
    'https://x.com/fi56622380/status/2093040177711329673',
    'https://x.com/nick88886666/status/2092584653089800439',
    'https://github.com/goldmansachs/gs-quant',
    'https://x.com/sshleo84/status/2092582780140200416',
    'https://x.com/jinseongeo83473/status/2092370080088949037',
    'https://x.com/Trader_Jesse_/status/2092505959805648992',
    'https://x.com/gimduha77994334/status/2092462253723222461',
    'https://x.com/sniffshiba/status/2091828331310379484',
    'https://x.com/theodore_invest/status/2091897677709803883',
    'https://x.com/Future__Walker/status/2091861129823998056',
    'https://x.com/tmmrwseoul/status/2091505159222460767',
    'https://x.com/zerohedge/status/2095849461423456366',
    'https://x.com/amitisinvesting/status/2095688508597788864',
    'https://x.com/laylaperfume/status/2095270553406124090',
    'https://github.com/LuxAlgo/Vela',
    'https://github.com/LuxAlgo/Vela/blob/main/docs/architecture/overview.md',
    'https://github.com/LuxAlgo/Vela/blob/main/docs/user/api-reference.md',
    'https://x.com/amitisinvesting/status/2095329815767175320',
    'https://x.com/MelvinInvests/status/2094881976927113495',
    'https://x.com/markminervini/status/2095161472204599618',
    'https://x.com/gimduha77994334/status/2095069737545789450',
    'https://x.com/DrJStrategy/status/2094855932027023670',
    'https://x.com/gimduha77994334/status/2094963242414244137',
    'https://x.com/gimduha77994334/status/2094956632472219703',
    'https://x.com/aleabitoreddit/status/2094704372831920324',
    'https://x.com/Trader_Jesse_/status/2094389217782849928',
    'https://x.com/markminervini/status/2094407591006724563',
    'https://x.com/kishawn07/status/2093815152193970510',
    'https://x.com/StockAnalystPro/status/2093890963865473043'
  ]),
  sourceObservations: Object.freeze([
    Object.freeze({ id: 'NathanYJLee-2097957777922793710', author: 'Nathan | Factomind', sourceUrl: 'https://x.com/NathanYJLee/status/2097957777922793710', publishedAt: '2026-09-10T07:58:07.000Z', publishedAtKst: '2026-09-10T16:58:07+09:00', sourceKind: 'REFERENCE', status: 'DIRECT_READ', summary: '금융 레버리지와 방향성 레버리지를 분리하고, 예측보다 자금조달·노출 한도·리스크 관리를 우선' }),
    Object.freeze({ id: 'Trader-Jesse-2097868442309472608', author: 'Trader Jesse', sourceUrl: 'https://x.com/Trader_Jesse_/status/2097868442309472608', publishedAt: '2026-09-10T02:03:07.000Z', publishedAtKst: '2026-09-10T11:03:07+09:00', sourceKind: 'REFERENCE', status: 'DIRECT_READ', summary: 'Wedge Pop을 바닥·수렴 이후 이동평균 돌파와 거래량 동반의 구조적 진입 프레임으로 설명' }),
    Object.freeze({ id: 'markminervini-2097722372757295582', author: 'Mark Minervini', sourceUrl: 'https://x.com/markminervini/status/2097722372757295582', publishedAt: '2026-09-09T16:22:42.000Z', publishedAtKst: '2026-09-10T01:22:42+09:00', sourceKind: 'REFERENCE', status: 'DIRECT_READ', summary: '약화된 breadth·momentum과 이벤트 군집 속에서 선택성·헤지·시장 확인을 우선하고, 리더십 회전을 관찰' }),
    Object.freeze({ id: 'NathanYJLee-2097557593573199994', author: 'Nathan | Factomind', sourceUrl: 'https://x.com/NathanYJLee/status/2097557593573199994', publishedAt: '2026-09-09T05:27:55.000Z', publishedAtKst: '2026-09-09T14:27:55+09:00', sourceKind: 'REFERENCE', status: 'DIRECT_READ', summary: '수년 단위 성과와 일 단위 변동성의 불일치가 FOMO·과매매·레버리지 손실 루프를 만든다는 행동 리스크 프레임' }),
    Object.freeze({ id: 'laylaperfume-2096959904410193928', author: 'Humble', sourceUrl: 'https://x.com/laylaperfume/status/2096959904410193928', publishedAt: '2026-09-07T13:52:55.000Z', publishedAtKst: '2026-09-07T22:52:55+09:00', sourceKind: 'REFERENCE', status: 'DIRECT_READ', summary: 'Investment Surge가 Financing Surge·은행 대차대조표 여력·생산성으로 이어지는지 확인하는 매크로 가설' }),
    Object.freeze({ id: 'gimduha-2096762435315384622', author: '김두한', sourceUrl: 'https://x.com/gimduha77994334/status/2096762435315384622', publishedAt: '2026-09-07T00:48:15.000Z', publishedAtKst: '2026-09-07T09:48:15+09:00', sourceKind: 'REFERENCE', status: 'DIRECT_READ', summary: '달러 배관·온체인 레일은 프론트엔드 가격의 원인과 구분하고, 유동성 경색 때만 독립적 원인이 될 수 있다는 프레임' }),
    Object.freeze({ id: 'ProblemSniper-2096672934828093812', author: 'ProblemSniper', sourceUrl: 'https://x.com/ProblemSniper/status/2096672934828093812', publishedAt: '2026-09-06T18:52:36.000Z', publishedAtKst: '2026-09-07T03:52:36+09:00', sourceKind: 'REFERENCE', status: 'DIRECT_READ', summary: 'SPY·QQQ·SMH 구조와 고용·Fed 이벤트를 연결한 방향성 가설; 수치·확률·목표는 dated secondary claim으로 보류' }),
    Object.freeze({ id: 'BTC-WyckoffLab-2095358094956245419', author: '세력연구소 | Wyckoff Lab', sourceUrl: 'https://x.com/BTC_WyckoffLab/status/2095358094956245419', publishedAt: '2026-09-03T03:47:54.000Z', publishedAtKst: '2026-09-03T12:47:54+09:00', quotedPublishedAt: '2026-09-02T00:40:47.000Z', quotedPublishedAtKst: '2026-09-02T09:40:47+09:00', sourceKind: 'REFERENCE', status: 'DIRECT_READ', summary: '박스 지지에서 실제 매수 반응을 확인한 뒤 채널 중단·이전 저항과 재테스트를 순서대로 확인' })
  ]),
  mediaAudit: Object.freeze([
    Object.freeze({ id: 'attachment-dell-post-earnings-breakout-20260911', kind: 'attached-image', label: '첨부 DELL 실적 후 돌파 차트', status: 'DIRECT_READ', sourceRef: 'user-attachment-codex-clipboard-e7613f98-dc6e-4980-88ee-a57e8ef79608', observedWindow: 'visible Nov–Jun daily chart window; publication timestamp not embedded', note: 'Dell Technologies 일봉에서 Earnings → Post-earnings breakout, 이동평균 정렬·거래량을 관찰. 눈금·가격·날짜를 현재 수치로 OCR/복사하지 않고 이벤트 후 확인 프레임으로만 사용' }),
    Object.freeze({ id: 'attachment-gonnogo-daily-20260904', kind: 'attached-image', label: '고노고 일보 2026-09-04', status: 'DIRECT_READ', note: '원유·금리·FX·고용·AI·중국/G20 뉴스 군집의 구조와 당시 시점을 추출. 헤더 수치와 기사 결론은 current data로 복사하지 않음' }),
    Object.freeze({ id: 'melvin-ai-capex-sankey', kind: 'post-image', sourceRef: 'MelvinInvests-2094881976927113495', status: 'DIRECT_READ', note: 'BNP Paribas AI CAPEX Sankey의 반도체/WFE·네트워크·전력·냉각·시설 계층을 taxonomy로 보존' }),
    Object.freeze({ id: 'trader-equipment-cycle-image', kind: 'post-image', sourceRef: 'Trader-Jesse-2094389217782849928', status: 'DIRECT_READ', note: '장비 주문 선행 사이클을 보조하는 이미지. 이미지 자체는 추가 현재 수치 없음' }),
    Object.freeze({ id: 'stockanalyst-control-plane-images', kind: 'post-images', sourceRef: 'StockAnalystPro-2093890963865473043', count: 8, status: 'DIRECT_READ', note: 'AI physical/control/serving 계층, GitOps·멀티테넌시·FinOps·파트너 생태계 구조를 추출' })
  ]),
  // Claim-level extraction for the latest user-supplied packet.  This is the
  // durable analysis ledger: a source observation is not itself a framework,
  // and a framework is not a current market fact.  Keeping every field here
  // makes omissions visible to the bridge, chat and knowledge retriever.
  claimLedger: Object.freeze({
    schemaVersion: 'supplied-material-claims.v1',
    packetId: 'packet-2026-09-11',
    coverageBoundary: '완전성은 2026-09-11 사용자 제공 X 8건과 첨부 DELL 차트의 직접 확인 범위에 한정합니다. 이전 패킷의 주장이나 현재 시장값은 이 원장의 완전성에 포함하지 않습니다.',
    requiredFields: Object.freeze([
      'claimType', 'materialElement', 'observation', 'thesisLogic',
      'paradigmShift', 'mechanism', 'chartTechnique', 'indicatorInputs',
      'timeframe', 'confirmation', 'invalidation', 'counterclaim',
      'allowedConsumers', 'blockedConsumers', 'currentnessBoundary'
    ]),
    claims: Object.freeze([
      Object.freeze({
        id: 'claim-20260911-leverage-separation',
        sourceRefs: Object.freeze(['NathanYJLee-2097957777922793710']),
        claimType: 'risk-process',
        materialElement: '금융 레버리지·저비용 조달·방향성 레버리지를 분리하자는 주장',
        observation: '저비용 자금조달과 트레이딩 포지션의 방향성 위험은 같은 숫자가 아니며, 리스크 한도 위반과 담보·유동성 악화가 결과를 좌우한다는 설명입니다.',
        thesisLogic: '예측 방향보다 조달 구조와 노출의 비대칭 손실을 먼저 관리해야 한다는 논리입니다.',
        paradigmShift: '레버리지를 단일 배수나 강세 신호로 보던 모델에서 gross/net exposure·담보·조달비용·한도 관리 모델로 전환합니다.',
        mechanism: 'cheap funding/repo → collateral and financing capacity → gross/net exposure → margin/liquidity stress → forced de-risking',
        chartTechnique: 'not supported by source; 가격 차트 대신 노출·담보·조달 상태의 사건창을 기록',
        indicatorInputs: Object.freeze(['gross exposure', 'net exposure', 'financing cost', 'collateral', 'margin/liquidity', 'risk limit', 'directional beta']),
        timeframe: 'intraday/session/daily',
        confirmation: '실제 조달 조건·담보·마진·노출 한도와 손실 시나리오가 같은 관측창에 존재해야 합니다.',
        invalidation: '조달·담보·노출 데이터가 없거나 게시물의 배수 표현만 남아 있으면 레버리지 상태를 판정하지 않습니다.',
        counterclaim: '저비용 조달이 존재해도 방향성 베타가 낮거나 한도·담보가 충분하면 동일한 청산 위험으로 볼 수 없습니다.',
        allowedConsumers: Object.freeze(['chat:signal', 'chat:portfolio', 'screener:risk-explanation', 'knowledge:decision-hygiene']),
        blockedConsumers: Object.freeze(['rank', 'current-price', 'auto-order', '10x-threshold']),
        currentnessBoundary: '게시물의 레버리지 표현은 dated REFERENCE입니다. 현재 레버리지·마진·금리·담보값은 별도 LIVE/SNAPSHOT/공식 자료가 필요합니다.',
        transientElements: Object.freeze(['게시물의 10x 표현']),
        status: 'FRAMEWORK_EXTRACTED'
      }),
      Object.freeze({
        id: 'claim-20260911-wedge-pop-retest',
        sourceRefs: Object.freeze(['Trader-Jesse-2097868442309472608']),
        claimType: 'technical-setup',
        materialElement: 'Wedge Pop·기반/수렴 이후 이동평균 reclaim과 거래량 동반 돌파',
        observation: '패턴 이름보다 기반 또는 수렴, 이동평균 회복·돌파, 거래량과 가격 수용, 후속 추세와 리테스트 순서를 확인하는 진입 프레임입니다.',
        thesisLogic: '첫 터치나 모양의 유사성보다 공급 흡수와 돌파 후 수용을 확인해야 지속 가능성을 판단할 수 있다는 논리입니다.',
        paradigmShift: '패턴 라벨·목표가 중심 해석에서 구조 단계·거래량·종가 수용·리테스트 확인 모델로 전환합니다.',
        mechanism: 'base/contraction → MA reclaim/breakout → volume-backed acceptance → +1–5 session follow-through → retest or rejection',
        chartTechnique: 'daily OHLCV base/contraction, moving-average slope and reclaim, breakout close, volume expansion, retest/failed retest',
        indicatorInputs: Object.freeze(['base range', 'support/resistance', 'MA level/slope', 'breakout close', 'volume/RVOL', 'acceptance/rejection', 'retest']),
        timeframe: 'base/contraction → trigger → +1–5 sessions',
        confirmation: '돌파 캔들의 종가·거래량·가격 수용과 후속 세션 리테스트가 동일 종목·동일 세션 기준으로 확인되어야 합니다.',
        invalidation: '거래량 없는 돌파, 저항에서 종가 거부, 실패 리테스트, 기준선 이탈이면 패턴명을 진입 근거로 승격하지 않습니다.',
        counterclaim: '거래량 급증이 short-covering 또는 이벤트성 일회성일 수 있어 반복 수요를 보장하지 않습니다.',
        allowedConsumers: Object.freeze(['chat:technical', 'screener:structure-evidence', 'knowledge:chart-protocol', 'bridge:technical']),
        blockedConsumers: Object.freeze(['auto-entry', 'target-price', 'pattern-hit-rate', 'current-signal-without-ohlcv']),
        currentnessBoundary: '게시물의 구조 프레임만 REFERENCE로 재사용합니다. 현재 종목의 구조 상태는 OHLCV·이벤트 시각·거래량·리테스트를 다시 계산해야 합니다.',
        status: 'FRAMEWORK_EXTRACTED'
      }),
      Object.freeze({
        id: 'claim-20260911-market-proof-rotation',
        sourceRefs: Object.freeze(['markminervini-2097722372757295582']),
        claimType: 'market-regime-counterpoint',
        materialElement: '약화된 breadth/momentum 속 선택성, IWM 약세, 반도체·데이터센터와 소비·주택·금융·농업·에너지 간 회전 관찰',
        observation: '시장 전체 확인이 약한 환경에서 선택적 롱·대기·헤지 관점과 업종별 상대강도 차이를 제시한 dated commentary입니다.',
        thesisLogic: '지수 반등이나 소수 리더의 강세보다 participation·breadth·momentum과 리더십 회전을 확인해야 한다는 논리입니다.',
        paradigmShift: 'cap-weighted 지수 하나의 방향성 모델에서 equal-weight·small-cap·sector breadth·relative strength를 함께 보는 시장 확인 모델로 전환합니다.',
        mechanism: 'breadth/momentum weakening + event risk → leadership concentration/rotation → selective exposure or wait-for-proof',
        chartTechnique: 'cap-weighted vs equal-weight/small-cap relative-strength chart, breadth thrust/participation, sector rotation, event-window volume',
        indicatorInputs: Object.freeze(['breadth', 'momentum', 'IWM vs SPY relative strength', 'sector relative strength', 'volume', 'event calendar']),
        timeframe: '1–5 session reaction; 20–60 session swing; 50–200 session structure',
        confirmation: '동일 기준일·동일 유니버스에서 breadth 약화, 소형주 상대약세, 리더십 집중과 이벤트 반응이 함께 관찰되어야 합니다.',
        invalidation: 'breadth 확장·소형주 리클레임·리더십 분산이 반복되고 이벤트 후 가격 수용이 확인되면 약한 시장 확인 가설은 약해집니다.',
        counterclaim: 'ProblemSniper의 SPY/QQQ/SMH 구조·고용/Fed 이벤트 기반 방향성 가설은 이 관점과 긴장 관계가 있으므로 평균내지 않고 별도 attribution으로 유지합니다.',
        allowedConsumers: Object.freeze(['chat:breadth', 'chat:signal', 'screener:market-confirmation', 'knowledge:regime-comparison']),
        blockedConsumers: Object.freeze(['IWM-short-order', 'sector-trade-instruction', 'current-regime-without-breadth']),
        currentnessBoundary: '게시 당시의 breadth·rotation REFERENCE 관찰이며 현재 시장 레짐이나 short 포지션을 의미하지 않습니다. 현재 확인에는 producer의 동일 기준일 자료가 필요합니다.',
        transientElements: Object.freeze(['IWM 약세 프레임', '당시 업종 회전 스냅샷']),
        status: 'ATTRIBUTED_COUNTERPOINT'
      }),
      Object.freeze({
        id: 'claim-20260911-behavior-horizon',
        sourceRefs: Object.freeze(['NathanYJLee-2097557593573199994']),
        claimType: 'behavioral-risk',
        materialElement: '일일 변동성과 수년 성과의 간극, 소셜 비교·FOMO·과매매·손실 만회·레버리지 확대 루프',
        observation: '짧은 노이즈를 장기 성과로 오인하고 FOMO와 과매매가 손실·레버리지 확대를 반복시키는 의사결정 위험을 설명합니다.',
        thesisLogic: '가격 전망보다 투자자의 평가 지평·회전율·손실 대응이 결과를 훼손할 수 있다는 논리입니다.',
        paradigmShift: '단기 P&L과 자극적 비교를 성과 척도로 쓰던 모델에서 holding horizon·drawdown·turnover·recovery를 분리하는 행동 감사 모델로 전환합니다.',
        mechanism: 'daily noise/social comparison → FOMO/overtrading → loss or drawdown → revenge/leverage → larger tail risk',
        chartTechnique: 'not supported by source; performance-horizon overlay of daily volatility, drawdown/recovery and turnover',
        indicatorInputs: Object.freeze(['turnover', 'holding horizon', 'drawdown', 'recovery time', 'leverage', 'real purchasing power']),
        timeframe: 'daily noise ↔ monthly/annual/multi-year outcome cycle',
        confirmation: '개인 또는 전략별 거래·보유·손실·회복 기록이 같은 기간으로 정렬되어야 합니다.',
        invalidation: '개인 행동·거래 기록 없이 종목 방향성이나 수익 확률로 해석하면 이 자료의 범위를 벗어납니다.',
        counterclaim: '행동 루프는 위험 관리 질문을 제공하지만 개별 투자자의 실제 행동이나 자산 수익을 예측하지 않습니다.',
        allowedConsumers: Object.freeze(['chat:portfolio', 'chat:principles', 'knowledge:behavior-audit', 'bridge:portfolio']),
        blockedConsumers: Object.freeze(['ticker-forecast', 'return-probability', 'auto-sizing']),
        currentnessBoundary: '행동 프레임은 교육용 REFERENCE이며 개인 계정·성과 데이터가 주입되지 않으면 현재 상태를 판정하지 않습니다.',
        status: 'FRAMEWORK_EXTRACTED'
      }),
      Object.freeze({
        id: 'claim-20260911-investment-financing-productivity',
        sourceRefs: Object.freeze(['laylaperfume-2096959904410193928']),
        claimType: 'macro-transmission-hypothesis',
        materialElement: 'Investment Surge → Financing Surge → 은행/딜러 대차대조표 여력 → AI·인프라 CAPEX → Productivity Surge',
        observation: '투자 증가가 금융 중개와 실제 배치·가동을 통해 생산성으로 전환되는지, 아니면 인플레이션·장기금리·부채 부담으로 막히는지를 묻는 2차 해석 가설입니다.',
        thesisLogic: 'CAPEX 발표만으로 생산성 도약을 가정하지 않고 자금조달·설치·가동·노동생산성의 전달경로를 검증해야 한다는 논리입니다.',
        paradigmShift: '투자액을 곧바로 성장으로 보는 모델에서 financing capacity·utilization·productivity·inflation/long-rate guardrails를 함께 보는 전달창 모델로 전환합니다.',
        mechanism: 'private investment → credit/bank balance sheet → AI/infrastructure deployment → utilization → labor productivity, with inflation/long-rate/debt constraints',
        chartTechnique: 'lag-aligned overlay of CAPEX, credit supply, bank lending, utilization, productivity, inflation and long-rate series',
        indicatorInputs: Object.freeze(['private CAPEX', 'credit supply', 'bank balance sheet', 'long rates', 'utilization', 'labor productivity', 'inflation', 'debt/GDP']),
        timeframe: 'monthly/quarterly/annual; release date ↔ observation period and revision date',
        confirmation: '공식 신용·생산성·물가·장기금리 자료와 실제 CAPEX·가동률이 시간순으로 연결되어야 합니다.',
        invalidation: '투자·계약 발표만 있고 신용공급·가동률·생산성 개선이 없거나 금융·인플레이션 제약이 우세하면 생산성 전환 가설을 보류합니다.',
        counterclaim: '은행 대차대조표 확대가 자동으로 실물 생산성이나 주주 현금흐름으로 이어지지 않을 수 있습니다.',
        allowedConsumers: Object.freeze(['chat:macro', 'chat:themes', 'knowledge:macro-transmission', 'screener:theme-context']),
        blockedConsumers: Object.freeze(['GDP-forecast', 'current-inflation-claim', 'company-revenue-promotion']),
        currentnessBoundary: 'secondary commentary REFERENCE의 가설입니다. 시계열 값·정책 경로·현재 장기금리는 data-refresh 또는 공식 evidence로 별도 확인합니다.',
        status: 'HYPOTHESIS_UNVERIFIED'
      }),
      Object.freeze({
        id: 'claim-20260911-dollar-rails',
        sourceRefs: Object.freeze(['gimduha-2096762435315384622']),
        claimType: 'macro-market-plumbing',
        materialElement: '달러 약세·패권 서사와 결제/담보/repo 배관, 프론트엔드 자산가격을 분리',
        observation: '달러 약세나 패권 변화가 곧바로 시장의 원인이라는 해석을 경계하고, 배관은 평상시 결과·증폭기일 수 있으나 margin call·유동성 경색 때 독립 원인이 될 수 있다는 구분입니다.',
        thesisLogic: '프론트엔드 가격을 백엔드 배관의 단일 원인으로 환원하지 않고 정상 시기와 스트레스 시기의 인과 우세를 구분해야 한다는 논리입니다.',
        paradigmShift: '달러 방향성·패권 담론을 곧 유동성 원인으로 보던 모델에서 settlement·collateral·repo·dealer balance sheet와 가격 전달을 분리하는 모델로 전환합니다.',
        mechanism: 'settlement/collateral/repo stress → margin/liquidity premium → forced flow → FX and asset-price transmission; otherwise rails may follow price',
        chartTechnique: 'front-end yield/FX/asset price versus repo, reserves, collateral, basis, margin and dealer balance-sheet event study',
        indicatorInputs: Object.freeze(['FX/dollar', 'collateral quality', 'repo/reserves', 'margin calls', 'liquidity premium', 'basis', 'dealer balance sheet', 'asset price']),
        timeframe: 'daily/event/quarterly; normal regime versus stress window',
        confirmation: '유동성 프리미엄·repo/basis·담보·마진 변화가 가격 충격보다 선행하거나 동시 발생하고 독립 자료로 교차 확인되어야 합니다.',
        invalidation: '배관 스트레스가 없고 가격·거시 변수가 먼저 움직이면 배관을 독립 원인으로 승격하지 않습니다.',
        counterclaim: '달러 약세는 결제 인프라 붕괴나 패권 상실과 동일하지 않으며, 정상 시장에서는 가격의 결과 또는 증폭기일 수 있습니다.',
        allowedConsumers: Object.freeze(['chat:macro', 'chat:fxbond', 'knowledge:market-plumbing', 'bridge:macro']),
        blockedConsumers: Object.freeze(['dollar-collapse-claim', 'FX-trade-instruction', 'liquidity-state-without-repo']),
        currentnessBoundary: '게시물의 개념 구분만 REFERENCE로 보존합니다. 현재 달러·repo·담보·딜러 상태는 같은 관측시각의 공식/producer 자료가 필요합니다.',
        status: 'FRAMEWORK_EXTRACTED'
      }),
      Object.freeze({
        id: 'claim-20260911-spy-qqq-smh-directional-hypothesis',
        sourceRefs: Object.freeze(['ProblemSniper-2096672934828093812']),
        claimType: 'dated-directional-hypothesis',
        materialElement: 'SPY·QQQ·SMH 구조와 고용·Fed 이벤트를 연결한 방향성 가설 및 게시물 내 775/800/760 레벨',
        observation: '지수·반도체 구조와 고용/Fed 이벤트를 연결한 당시의 방향성 해석입니다. 게시물의 레벨은 역사적 문맥에 묶인 transient element입니다.',
        thesisLogic: '가격 구조와 강한 이벤트 결과가 특정 방향으로 이어질 수 있다는 가설이지만, 현재 사실이나 확률로 검증된 결론은 아닙니다.',
        paradigmShift: '단일 지수 방향성에서 SPY·QQQ·SMH 상대구조와 이벤트 전후 수용을 함께 보자는 측정 프레임으로만 제한적으로 재사용합니다.',
        mechanism: 'jobs/Fed event → index/semiconductor reaction → breadth/relative strength → follow-through or failure',
        chartTechnique: 'multi-asset OHLCV and relative-strength panels with event markers, support/resistance and post-event acceptance',
        indicatorInputs: Object.freeze(['SPY OHLCV', 'QQQ OHLCV', 'SMH OHLCV', 'breadth', 'relative strength', 'jobs/Fed timestamps', 'volume']),
        timeframe: 'event date ±1–5 sessions; 20–60 session swing for follow-through',
        confirmation: '고용/Fed 실제 발표시각·값과 세 지수의 같은 세션 가격·거래량·breadth 반응이 동행해야 합니다.',
        invalidation: '이벤트 후 지수 간 상대구조가 분화되거나 지지 이탈·돌파 실패가 발생하면 방향성 가설은 약화됩니다.',
        counterclaim: 'Minervini의 breadth 약화·선택성 관점과 충돌할 수 있어 두 해석을 별도 attribution으로 보존합니다.',
        allowedConsumers: Object.freeze(['chat:technical', 'chat:market', 'knowledge:hypothesis-testing', 'bridge:market']),
        blockedConsumers: Object.freeze(['hardcoded-level', 'current-target', 'probability', 'directional-order']),
        currentnessBoundary: '게시물 내 레벨과 방향은 dated secondary REFERENCE입니다. 현재 SPY·QQQ·SMH 값과 이벤트 결과는 live/snapshot/official evidence로 다시 확인합니다.',
        transientElements: Object.freeze(['게시물의 775/800/760 레벨', '당시 고용/Fed 해석']),
        status: 'HYPOTHESIS_UNVERIFIED'
      }),
      Object.freeze({
        id: 'claim-20260911-wyckoff-box-retest',
        sourceRefs: Object.freeze(['BTC-WyckoffLab-2095358094956245419']),
        quotedSourceRefs: Object.freeze(['quoted-post-20260902']),
        claimType: 'technical-structure',
        materialElement: 'CBRS 박스 지지 → 매수 반응 → PS/채널 중간 저항 → 후속 확인·리테스트',
        observation: '현재 게시물과 2026-09-02 인용 원문을 구분하여 박스 지지에서 실제 반응이 나왔는지, 중간 저항·후속 추세·리테스트를 순서대로 확인하는 구조 해석입니다.',
        thesisLogic: '박스 안의 위치와 반응·수용이 패턴 이름이나 단일 wick보다 중요하다는 논리입니다.',
        paradigmShift: '지지선 첫 터치와 목표가 중심 모델에서 volume/acceptance·저항·리테스트·무효화 상태 머신으로 전환합니다.',
        mechanism: 'range support → buying response → channel-mid/PS resistance → acceptance/follow-through → retest or failure',
        chartTechnique: 'Wyckoff-style range map with support, preliminary support, channel midpoint/resistance, volume response and retest markers',
        indicatorInputs: Object.freeze(['range high/low', 'support', 'buying response', 'volume', 'channel midpoint', 'retest', 'rejection']),
        timeframe: 'quoted observation date → same-day reaction → +1–5 sessions follow-through/retest',
        confirmation: '지지 반응의 거래량·종가 수용, 저항 돌파 후 유지, 리테스트 성공 여부를 같은 자산의 세션 데이터로 확인합니다.',
        invalidation: '지지 이탈·저항 거부·리테스트 실패가 발생하면 축적/상승 구조 해석을 보류합니다.',
        counterclaim: 'range 반응은 단기 수급이나 short-covering일 수 있어 중기 추세를 자동으로 보장하지 않습니다.',
        allowedConsumers: Object.freeze(['chat:technical', 'screener:structure-evidence', 'knowledge:chart-protocol']),
        blockedConsumers: Object.freeze(['target-price', 'pattern-certainty', 'auto-entry']),
        currentnessBoundary: '게시·인용 원문의 시간은 event REFERENCE입니다. 현재 구조는 재현 가능한 OHLCV·volume·retest 데이터가 있을 때만 표시합니다.',
        status: 'FRAMEWORK_EXTRACTED'
      }),
      Object.freeze({
        id: 'claim-20260911-dell-post-earnings-breakout',
        sourceRefs: Object.freeze(['attachment-dell-post-earnings-breakout-20260911']),
        claimType: 'event-driven-chart-observation',
        materialElement: '첨부 DELL 일봉의 earnings → post-earnings breakout, 이동평균 정렬·거래량',
        observation: '이미지의 보이는 Nov–Jun 일봉 창에서 실적 이벤트 이후 가격 돌파, 이동평균 정렬과 거래량을 시각적으로 확인한 관찰입니다. 이미지에는 신뢰할 수 있는 publication timestamp가 없습니다.',
        thesisLogic: '실적 이벤트가 가격·거래량·추세 구조로 확인되는지 보는 event-confirmation 프레임입니다.',
        paradigmShift: '차트 라벨이나 실적 서프라이즈만으로 결론을 내리던 모델에서 이벤트 시각·OHLCV·이동평균·거래량·후속 수용을 한 창에서 대조하는 모델로 전환합니다.',
        mechanism: 'earnings release → gap/price response → MA alignment and volume expansion → breakout acceptance → follow-through/retest',
        chartTechnique: 'daily event marker, moving-average stack/slope, volume expansion, breakout close, +1–5 session acceptance and retest',
        indicatorInputs: Object.freeze(['earnings timestamp', 'daily OHLCV', 'moving-average level/slope', 'volume/RVOL', 'gap', 'acceptance/rejection', 'retest']),
        timeframe: 'image-visible Nov–Jun window; event date ±1–5 sessions for confirmation',
        confirmation: 'DELL 공식 실적 발표시각과 동일 세션 OHLCV·거래량, 이동평균 정렬, 후속 가격 수용·리테스트를 재계산해야 합니다.',
        invalidation: '실적 후 갭이 거부되거나 거래량 없는 돌파·저항 재거부·리테스트 실패가 나타나면 post-earnings breakout 프레임을 확정하지 않습니다.',
        counterclaim: '이미지의 표시 기간·눈금·라벨은 현재 가격이나 미래 성과를 입증하지 않으며, 이벤트 반응은 단기 재평가 또는 short-covering일 수 있습니다.',
        allowedConsumers: Object.freeze(['chat:technical', 'screener:structure-evidence', 'knowledge:event-chart-protocol', 'bridge:technical']),
        blockedConsumers: Object.freeze(['current-DELL-price', 'earnings-surprise-fact', 'target-price', 'auto-entry']),
        currentnessBoundary: '첨부 이미지는 직접 확인된 REFERENCE media입니다. publication timestamp와 수치의 현재성은 미확인으로 유지하고, 현재 값은 DELL live/official evidence에서만 읽습니다.',
        transientElements: Object.freeze(['이미지의 가격 눈금', '이미지의 Nov–Jun 표시 창', '차트 라벨']),
        status: 'MEDIA_OBSERVATION_ONLY'
      })
    ])
  }),
  timeSeries: Object.freeze([
    Object.freeze({ id: 'market-reaction', label: '시장 반응창', window: '1–5 sessions', cadence: 'session/eod', metrics: Object.freeze(['gap', 'volume', 'acceptance/rejection', 'event reaction']), alignment: 'event timestamp와 거래 세션을 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'market-swing', label: '스윙·상대강도창', window: '20–60 sessions', cadence: 'daily/weekly', metrics: Object.freeze(['relative strength', 'breadth', 'extreme movers', 'concentration']), alignment: '동일 유니버스·동일 기준일 비교', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'market-trend', label: '중장기 추세창', window: '50–200 sessions', cadence: 'daily/weekly', metrics: Object.freeze(['MA level/slope', 'highs/lows', 'index confirmation', 'leadership']), alignment: 'cap-weighted·equal-weight·small-cap·sector를 함께 비교', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'event-window', label: '이벤트 전후창', window: 'event date ±1–5 sessions', cadence: 'event-linked', metrics: Object.freeze(['earnings', 'guidance', 'rates', 'gap', 'volume', 'price acceptance']), alignment: '발표시각·관측시각·세션 종료를 별도 보존', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'macro-release-lag', label: '거시 발표·전달 시차', window: 'release date ↔ observation period', cadence: 'daily/monthly/quarterly', metrics: Object.freeze(['policy/rates', 'mortgage', 'housing starts/permits', 'local fiscal/employment', 'inflation', 'revisions']), alignment: '발표일·관측기간·개정일·lead/lag를 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'institutional-quarter', label: '기관 보유 분기창', window: 'report period ↔ filed date ↔ next observable window', cadence: 'quarterly/filing', metrics: Object.freeze(['filer/CIK', 'CUSIP/share class', 'shares/value', 'corporate actions', 'price/volume']), alignment: '13F 신고 흔적과 현재 가격·수급을 같은 사건으로 합치지 않음', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'ai-request', label: 'AI 요청·사용자 경험창', window: 'request/session', cadence: 'request/session', metrics: Object.freeze(['TTFT', 'TBT/TTLT', 'tokens', 'batch', 'energy/request']), alignment: 'model·prompt·precision·system boundary를 고정', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'ai-workload-cohort', label: 'AI workload cohort창', window: 'model/workload cohort', cadence: 'daily/weekly', metrics: Object.freeze(['prefill/decode', 'KV traffic', 'precision', 'batch', 'support cost']), alignment: '모델·질의 형태·배치·정밀도별 cohort를 섞지 않음', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'ai-operations', label: 'AI 운영·가동률창', window: 'daily/weekly', cadence: 'daily/weekly', metrics: Object.freeze(['utilization', 'power/thermal', 'network tail', 'error/retry', 'autonomous hours']), alignment: '파일럿·출하와 반복 운영을 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'capital-quarter', label: '자본·자산수명 분기창', window: 'quarterly/asset life', cadence: 'quarterly/asset-life', metrics: Object.freeze(['CAPEX', 'depreciation', 'replacement reserve', 'financing', 'dilution', 'FCF', 'capacity monetization']), alignment: 'connected power·billable IT power·ARR·revenue·cash를 분모별로 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'qualification-milestones', label: '하드웨어 qualification창', window: 'sample → validation → yield → volume → customer mix', cadence: 'milestone/quarterly', metrics: Object.freeze(['sample', 'validation', 'yield', 'volume', 'qualification', 'customer mix']), alignment: '공급사 언급과 실제 매출·양산을 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'physical-ai-operations', label: 'Physical AI 운영창', window: 'pilot → repeat deployment', cadence: 'pilot/monthly', metrics: Object.freeze(['autonomous hours', 'interventions', 'task/cycle', 'uptime', 'repair', 'supervision']), alignment: '시연 영상·파일럿과 반복 배치·단위경제성을 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'software-usage-cohort', label: '소프트웨어 usage cohort창', window: 'contract → usage/outcome → renewal/cash', cadence: 'monthly/quarterly', metrics: Object.freeze(['usage', 'outcome', 'retention', 'margin', 'cash conversion']), alignment: 'seat·usage·outcome·인식매출·현금흐름의 분모를 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'event-cluster', label: '이벤트 군집·전달창', window: 'same-day → event date ±1–5 sessions → follow-through', cadence: 'event-linked/session', metrics: Object.freeze(['event timestamp', 'source class', 'asset reaction', 'cross-asset spillover', 'confirmation']), alignment: '복수 이벤트의 발표시각·자산 반응·후속 확인을 하나의 headline으로 합치지 않음', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'expectation-vintage', label: '기대치·실적 빈티지창', window: 'estimate vintage → release → revision → next guidance', cadence: 'event/quarterly', metrics: Object.freeze(['consensus vintage', 'actual', 'surprise', 'revision', 'guidance', 'price acceptance']), alignment: '실현 실적·12M forward 기대·가이던스·주가 반응의 빈티지를 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'ai-capex-flow', label: 'AI CAPEX 흐름창', window: 'budget → order → install → utilization → replacement', cadence: 'project/quarterly', metrics: Object.freeze(['semiconductors', 'WFE', 'networking', 'power', 'cooling', 'facilities', 'lead time']), alignment: 'Sankey 비중은 구조적 taxonomy로만 쓰고 기업별 노출·현재 금액과 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'equipment-cycle', label: '장비 사이클 전환창', window: 'demand → utilization → backlog → PO → delivery → revenue → FCF', cadence: 'monthly/quarterly', metrics: Object.freeze(['order', 'book-to-bill', 'backlog', 'delivery schedule', 'revenue', 'margin', 'service/spares', 'repeat PO']), alignment: '장비 주문과 최종 제품 매출의 인식 시차·고객별 반복 주문을 보존', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'treasury-plumbing', label: '국채 프론트엔드·백엔드 배관창', window: 'macro flow → secondary price/yield → repo/auction/dealer stress', cadence: 'daily/event/quarterly', metrics: Object.freeze(['front-end yield', 'long-end flow', 'basis', 'CTA/technical flow', 'repo', 'dealer balance sheet', 'auction']), alignment: '시장 가격·수급과 경매·repo·딜러 중개를 분리하고 위기 시 배관 우세 전환을 표시', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'seasonal-convergence', label: '계절성·확인 수렴창', window: '1-year/4-year/10-year context → 1–5/20–60/50–200 sessions', cadence: 'daily/weekly/annual', metrics: Object.freeze(['seasonal window', 'price action', 'rates', 'oil', 'leadership', 'breadth']), alignment: '계절성은 저가중 참고값이며 가격·금리·원유·리더십의 실제 동행 여부를 별도로 확인', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'ai-control-plane', label: 'AI 컨트롤 플레인 운영창', window: 'provision → schedule → isolate → observe → meter → revenue', cadence: 'request/daily/weekly/monthly', metrics: Object.freeze(['activation time', 'GPU utilization', 'tenant isolation', 'error/retry', 'tokens/GPU', 'tokens/W', 'FinOps', 'time-to-revenue']), alignment: '물리 인프라·클러스터 오케스트레이션·추론 serving·사용량 과금을 계층별로 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'capacity-cohort', label: '용량·계약 코호트창', window: 'power/site → acceptance → contract cohort → billable utilization → recognized revenue', cadence: 'project/monthly/quarterly', metrics: Object.freeze(['site/MW', 'IT power', 'energization', 'acceptance', 'ACV/RPO', 'utilization', 'revenue', 'cash']), alignment: '연말 exit ARR·계약 ACV·MW와 평균 가동·인식매출·현금을 같은 분모로 합치지 않음', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'owner-fcf-waterfall', label: '소유자 FCF·자본 워터폴창', window: 'revenue → operating cost → CAPEX → D&A → interest/lease → reserve → dilution → owner FCF', cadence: 'quarterly/asset-life', metrics: Object.freeze(['CAPEX', 'D&A', 'interest', 'lease', 'replacement reserve', 'debt', 'prepayment', 'dilution', 'owner FCF']), alignment: 'EBITDA·기업 FCF·owner FCF·자산 회수와 financing waterfall을 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'hypothesis-test', label: '가설·확인·무효화 이벤트창', window: 'hypothesis date → public filing/event → confirmation/invalidation', cadence: 'event/filing', metrics: Object.freeze(['claim', 'evidence class', 'test date', 'confirming evidence', 'counterevidence', 'status']), alignment: '미확인 추론을 종목 신호로 만들지 않고 다음 공시·계약·배치 이벤트를 테스트 노드로 고정', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'reporting-break', label: '사업부·보고 기준 단절창', window: 'old segment definition → transition disclosure → comparable restatement', cadence: 'quarterly/filing', metrics: Object.freeze(['segment definition', 'recast history', 'revenue', 'margin', 'backlog', 'comparability']), alignment: '사업부 재편·보고 변경 전후의 시계열을 동일 사업으로 연결하지 않음', sourceKind: 'REFERENCE', operationalUse: 'reference-only' })
    ,Object.freeze({ id: 'exposure-leverage', label: '조달 레버리지·방향성 노출창', window: 'financing state → exposure decision → stress/liquidation', cadence: 'intraday/session/daily', metrics: Object.freeze(['gross/net exposure', 'financing cost', 'collateral', 'margin/liquidity', 'risk limit', 'directional beta']), alignment: '조달 레버리지와 방향성 베팅·포지션 한도·담보/유동성을 한 숫자로 합치지 않음', sourceKind: 'REFERENCE', operationalUse: 'reference-only' })
    ,Object.freeze({ id: 'structure-confirmation', label: '구조·돌파·리테스트 확인창', window: 'base/contraction → trigger → +1–5 sessions → retest', cadence: 'daily/session', metrics: Object.freeze(['base', 'support', 'reclaim', 'breakout', 'volume', 'acceptance/rejection', 'retest', 'invalidation']), alignment: '첫 터치·패턴명과 확인된 수용·거래량·재테스트를 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' })
    ,Object.freeze({ id: 'behavior-horizon', label: '투자자 행동·성과 지평창', window: 'daily noise ↔ multi-year outcome cycle', cadence: 'daily/monthly/annual', metrics: Object.freeze(['turnover', 'FOMO', 'leverage', 'drawdown', 'recovery', 'holding horizon', 'real purchasing power']), alignment: '일봉 변동성과 수년 성과를 같은 성과평가 단위로 오인하지 않음', sourceKind: 'REFERENCE', operationalUse: 'reference-only' })
    ,Object.freeze({ id: 'investment-financing-productivity', label: '투자·자금조달·생산성 전달창', window: 'investment surge → financing capacity → deployment → productivity → inflation/debt', cadence: 'monthly/quarterly/annual', metrics: Object.freeze(['private CAPEX', 'bank balance sheet', 'credit supply', 'long rates', 'utilization', 'labor productivity', 'inflation', 'debt/GDP']), alignment: '정책 발언·민간 투자·신용공급·실물 생산성·물가를 발표일·관측기간으로 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' })
    ,Object.freeze({ id: 'dollar-rails', label: '달러 배관·프론트엔드 증폭창', window: 'settlement/collateral/repo → liquidity stress → price transmission', cadence: 'daily/event/quarterly', metrics: Object.freeze(['collateral quality', 'settlement rail', 'repo/reserves', 'margin call', 'liquidity premium', 'FX/dollar', 'asset price']), alignment: '달러 약세·패권·결제 인프라·시장 가격과 예외적 배관 스트레스를 같은 원인으로 합치지 않음', sourceKind: 'REFERENCE', operationalUse: 'reference-only' })
  ]),
  sections: Object.freeze([
    Object.freeze({
      id: 'market-principles',
      sourceRefs: Object.freeze(['ParadisLabs-2093472998711771421', 'zerohedge-2093309457639858477', 'gimduha-2093679410507616760', 'gimduha-2092462253723222461', 'Fed-Warsh-official']),
      timeSeriesIds: Object.freeze(['macro-release-lag', 'market-trend', 'market-reaction']),
      title: '시장 원리 · 금리·유동성·가격발견',
      thesis: '정책금리, 장기금리, 단기자금, 가격·포지셔닝은 같은 신호가 아니며 서로 다른 시간축으로 자산에 전달됩니다.',
      steps: Object.freeze([
        '정책금리·forward guidance → 기대·단기금리',
        '재정·국채·기업채 공급 → term premium·장기금리',
        'TGA·FIMA·repo·SOFR/OIS·MMF → 담보·현금·레버리지',
        '가격·거래량·시장 내부·포지셔닝 → 기대의 재조정'
      ]),
      observe: '정책금리와 장기금리, term premium, 발행·수요, repo/OIS/SOFR/MMF, 가격·breadth·포지셔닝을 같은 기준일로 대조',
      invalidation: '연결된 producer·관측일·동일 유니버스가 없으면 현재 방향·유동성 상태를 판정하지 않음'
    }),
    Object.freeze({
      id: 'institutional-flow',
      sourceRefs: Object.freeze(['13F-boundary', 'Goldman-Sachs-gs-quant', 'masters-SEC-artifacts']),
      timeSeriesIds: Object.freeze(['institutional-quarter', 'market-swing']),
      title: '13F · 공개 보유에서 흐름 검증까지',
      thesis: '13F는 기관의 실시간 행동이 아니라 분기 말 공개 흔적입니다. 기관 보유를 신호로 쓰려면 공시·정규화·가격·수급을 순서대로 대조해야 합니다.',
      steps: Object.freeze([
        'filer·CIK·filing·report period·filedAt 확인',
        'CUSIP·share class·corporate action 정규화',
        '이전 분기와 shares/value 변화 비교',
        '가격·거래량·ETF·short·insider·13D/G와 분리 대조'
      ]),
      observe: 'NEW/INCREASED/REDUCED/EXITED는 신고 주식 수 변화로만 표시하고, 실제 체결·전체 자산·현금·공매도로 확대 해석하지 않음',
      invalidation: 'ticker crosswalk·corporate-action review·동일 보고분기 또는 원문 filing이 없으면 기관 흐름 신호를 생성하지 않음'
    }),
    Object.freeze({
      id: 'ai-era-economics',
      sourceRefs: Object.freeze(['InvestNorthwise-2093778247171424706', 'ParadisLabs-2093472998711771421', 'Tema-HBF', 'BlackRock-AI-Fed', 'BCG-space-data-center', 'Micron-query-memory-power']),
      timeSeriesIds: Object.freeze(['ai-workload-cohort', 'ai-operations', 'capital-quarter']),
      title: 'AI 시대 · workload에서 현금흐름까지',
      thesis: 'AI 경제성은 GPU/FLOPS 하나가 아니라 사용량·질의 형태·메모리·전력·가동률·자본조달이 연결된 시스템 결과입니다.',
      steps: Object.freeze([
        '사용자·tokens/user → query mix',
        'prefill/KV/decode → 메모리·네트워크·전력',
        '가동률·검증·운영시간 → task 단위 경제성',
        'CAPEX·감가상각·이자·희석 → OCF/FCF·ROIC'
      ]),
      observe: 'latency·bandwidth·KV traffic·energy/query·utilization·qualification·yield·CAPEX/depreciation·FCF',
      invalidation: '발표·파일럿·출하·펀딩만 있고 실제 사용량·고객 지불·가동률·현금흐름 증거가 없으면 성장 서사를 승격하지 않음'
    }),
    Object.freeze({
      id: 'market-confirmation',
      sourceRefs: Object.freeze(['tmmrwseoul-2094003866597802019', 'RossHaber-2093867858065232159', 'tmmrwseoul-2088951001562906868']),
      timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend', 'event-window']),
      title: '시장 확인 · 지수·상대강도·이벤트',
      thesis: '한 지수의 반등이나 패턴 이름보다 시가총액가중 지수·동일가중·소형주·섹터 breadth·상대강도·거래량의 동행 여부가 시장 국면을 가르는 확인 증거입니다.',
      steps: Object.freeze([
        '관찰 사실과 해석을 분리하고 기준일·세션을 고정',
        'cap-weighted 지수 ↔ equal-weight·small-cap·섹터 상대강도 비교',
        '5/20/50/200일선 위치·기울기·신고가/신저가·거래량을 같은 창에서 대조',
        '실적 발표 전후 갭·거래량·가격 수용과 무효화 수준 확인'
      ]),
      observe: '1~5일 반응, 20~60일 추세, 50~200일 구조를 분리하고 실적·금리 이벤트 창을 별도 태그로 붙임',
      invalidation: '단일 종가·패턴 라벨·소수 대형주 지지만 있고 breadth·상대강도·거래량·이벤트 결과가 동행하지 않으면 시장 전체 확인으로 승격하지 않음'
    }),
    Object.freeze({
      id: 'macro-lagged-supply',
      sourceRefs: Object.freeze(['gimduha-2093679410507616760', 'RealSimpleAriel-2093778843186418078', 'Fed-Warsh-official']),
      timeSeriesIds: Object.freeze(['macro-release-lag', 'market-reaction']),
      title: '금리 · 주택 공급 · 고용의 시차',
      thesis: '금리 인상은 수요를 누르는 동시에 주택·건설 공급과 지방재정 경로를 늦출 수 있습니다. 어느 효과가 우세한지는 즉시 결론이 아니라 시차·고용·물가의 순서로 확인합니다.',
      steps: Object.freeze([
        '금리·모기지 → 주택 수요와 신규 공급의 서로 다른 리드타임',
        '주택 거래·가격·세수 → 지방정부 재정 → 교육·지방정부 고용',
        '고용·소득·수요와 공급 파이프라인을 같은 기준일로 정렬',
        '다음 고용·물가 발표에서 가설을 갱신하고 정책 경로는 조건부로 남김'
      ]),
      observe: '정책금리·장기금리·모기지·주택착공/허가·지방재정/고용·물가의 발표일과 관측기간을 구분',
      invalidation: '금리·주택·고용 사이의 시간순서와 독립 지표가 맞지 않거나 대체 요인이 더 강하면 단일 금리 인과로 설명하지 않음'
    }),
    Object.freeze({
      id: 'ai-inference-architecture',
      sourceRefs: Object.freeze(['OpenAI-Jalapeno', 'zartbot-Jalapeno', 'Tema-HBF', 'Micron-query-memory-power']),
      timeSeriesIds: Object.freeze(['ai-request', 'ai-workload-cohort', 'ai-operations']),
      title: 'AI 추론 아키텍처 · 시스템 공동설계',
      thesis: 'AI 시대의 경쟁 단위는 peak FLOPS가 아니라 사용자 경험을 만족시키는 tokens·energy·latency의 시스템 결과이며, 하드웨어·메모리·네트워크·컴파일러·검증 루프를 함께 봐야 합니다.',
      steps: Object.freeze([
        'Prefill·Decode·Draft·Verify의 병목과 사용자 SLO 분리',
        '데이터 이동·KV locality·메모리 거리·collective 통신을 시스템 비용으로 계상',
        '명확한 의미와 측정 가능한 배치 공간에서 AI가 placement·mapping·kernel을 탐색',
        '요청당 에너지·TTLT/TBT·tokens/W·전력·TCO를 실측하고 모델별로 재검증'
      ]),
      observe: '공식 성능·전력 측정과 추론 분석의 세부 추론을 분리하고, workload·모델·배치·정밀도·시스템 경계를 함께 기록',
      invalidation: '표준화된 workload에서 latency·energy·utilization·TCO 개선이 재현되지 않거나 새 모델 지원 비용이 이득을 잠식하는 경우'
    }),
    Object.freeze({
      id: 'ai-capacity-conversion',
      sourceRefs: Object.freeze(['InvestNorthwise-2093778247171424706', 'NBIS-vs-IREN-financing-attachment']),
      timeSeriesIds: Object.freeze(['capital-quarter', 'ai-operations', 'software-usage-cohort']),
      title: 'AI 용량 → 매출·현금 전환',
      thesis: 'AI 인프라의 투자 가능성은 연결 전력이나 계약 발표가 아니라 billable IT power, 가동·수락된 용량, 가격·이용률, 인식매출, 현금흐름과 자금조달의 연결에서 확인합니다.',
      steps: Object.freeze([
        'connected power → billable IT power → energization·acceptance 구분',
        '계약·exit ARR → recognized revenue → OCF/FCF의 인식 순서 확인',
        'marginal contract pricing과 fleet pricing, 회계수명과 경제수명 분리',
        'CAPEX·D&A·이자·희석·replacement reserve·financing waterfall을 함께 검증'
      ]),
      observe: 'capacity·utilization·ARR·revenue·cash의 기준일·분모·계약 상태와 자금조달 조건을 분기별로 고정',
      invalidation: '전력·계약·밸류에이션 숫자만 있고 실제 수락·사용량·고객 지불·현금흐름 또는 자금조달 증거가 없으면 전환 서사를 승격하지 않음'
    }),
    Object.freeze({
      id: 'ai-hardware-qualification',
      sourceRefs: Object.freeze(['GB200-GB300-VR200-supply-chain-attachment', 'Micron-query-memory-power', 'HBF-whitepaper']),
      timeSeriesIds: Object.freeze(['qualification-milestones', 'capital-quarter', 'ai-workload-cohort']),
      title: 'AI 하드웨어 · qualification에서 양산까지',
      thesis: '가속기 세대와 공급사 표는 투자 노출이 아니라 시스템 BOM·검증·수율·양산·고객 믹스가 시간에 따라 전환되는 qualification 지도입니다.',
      steps: Object.freeze([
        'compute tray·NVSwitch tray·PCB·CCL·copper·glass·resin·midplane 계층 분해',
        'sample → validation → yield → volume → customer mix 순서 기록',
        '대역폭·메모리·전력·열·네트워크 제약을 workload cohort와 연결',
        '공급사 언급·설계 채택과 실제 출하·매출·마진·현금 전환 분리'
      ]),
      observe: '부품·플랫폼·고객·양산 단계별 관측일과 변경 이력을 남기고, 단일 세대의 이름으로 미래 매출을 추정하지 않음',
      invalidation: 'qualification·yield·volume·고객 확인이 없거나 공급망 병목이 system-level latency·energy·TCO 개선으로 이어지지 않으면 노출 신호를 보류'
    }),
    Object.freeze({
      id: 'physical-ai-validation',
      sourceRefs: Object.freeze(['AI-Insider-humanoid-robotics', 'BCG-space-data-center']),
      timeSeriesIds: Object.freeze(['physical-ai-operations', 'capital-quarter']),
      title: 'Physical AI · 시연에서 반복 운영까지',
      thesis: '로봇·우주 인프라 자료는 시연 가능성보다 반복 배치에서의 자율시간, 개입, 작업 성공률, uptime, 수리·감독 비용으로 검증해야 합니다.',
      steps: Object.freeze([
        'pilot·demo·design win과 repeat deployment를 별도 상태로 기록',
        'autonomous hours·interventions·task/cycle·uptime·repair 측정',
        '환경·작업·안전·통신·열 조건별 성능 cohort 분리',
        'CAPEX·운영비·감독비·수익화·현금흐름으로 단위경제성 확인'
      ]),
      observe: '파일럿 날짜와 운영 기간, 개입률·실패·수리·감독의 분모를 고정하고 영상 한 편을 일반화하지 않음',
      invalidation: '반복 운영·고객 지불·신뢰성 데이터 없이 데모나 정책 기대만 존재하면 상용화·수익성 결론을 보류'
    }),
    Object.freeze({
      id: 'software-outcome-economics',
      sourceRefs: Object.freeze(['InvestNorthwise-2093778247171424706', 'JPMorgan-software-trends', 'Snowflake-unstructured-data-observation']),
      timeSeriesIds: Object.freeze(['software-usage-cohort', 'capital-quarter']),
      title: '소프트웨어 · seat에서 outcome·현금까지',
      thesis: 'AI 소프트웨어는 좌석 수나 발표된 ARR보다 실제 사용량·업무 결과·갱신·마진·현금 전환을 cohort로 확인해야 합니다.',
      steps: Object.freeze([
        'seat·contract·usage·outcome 단위를 분리',
        '비정형 데이터 → governed workflow → 반복 사용 경로 확인',
        'retention·support cost·gross margin·cash conversion을 cohort로 대조',
        'EV/EBITDA·ARR·매출·FCF를 서로 다른 분모로 해석'
      ]),
      observe: '계약 시점·사용량·결과·갱신·현금수취와 회계 인식 시점을 별도 보존',
      invalidation: '좌석·계약·valuation만 있고 usage/outcome·갱신·현금 데이터가 없으면 AI 수익화 질을 높게 평가하지 않음'
    }),
    Object.freeze({
      id: 'price-first-confirmation',
      sourceRefs: Object.freeze(['tmmrwseoul-2094003866597802019', 'tmmrwseoul-profile-observations', 'RealSimpleAriel-2093778843186418078', 'Yonsei-dent-2093324017898008598', 'Minervini-2093365115693244926']),
      timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend', 'event-window']),
      title: '가격 우선 · 패턴은 분류 도구',
      thesis: '가격·거래량·수용 여부가 1차 관찰이고, 갭·추세·패턴·지표는 그 관찰을 분류하는 도구입니다. 로그/선형 표시와 단일 지표를 혼동하지 않습니다.',
      steps: Object.freeze([
        '원시 가격·거래량·갭·변동성·수용을 먼저 저장',
        '20/50/200일선과 로그/선형 시각화를 별도 확인',
        'breadth·상대강도·리더십·극단 상승/하락을 동일 창에서 비교',
        '패턴 라벨은 관측 후에 붙이고 무효화·이벤트 창을 함께 표시'
      ]),
      observe: '1~5일 반응, 20~60일 스윙, 50~200일 추세를 섞지 않고 같은 유니버스·기준일로 비교',
      invalidation: '패턴 이름·단일 지표·현재 캔들만 있고 가격 수용·거래량·breadth·상대강도가 맞지 않으면 분류를 신호로 승격하지 않음'
    }),
    Object.freeze({
      id: 'market-risk-process',
      sourceRefs: Object.freeze(['RealSimpleAriel-2093778843186418078', 'RossHaber-2093867858065232159', 'gimduha-2093679410507616760', 'theodore-invest-2091897677709803883']),
      timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend', 'macro-release-lag']),
      title: '시장 리스크 · 노출·확인·무효화',
      thesis: '변동성이 큰 시장에서는 전망보다 노출 크기, 지수 확인, breadth·상대강도, 이벤트 위험, 무효화 조건을 하나의 과정으로 관리해야 합니다.',
      steps: Object.freeze([
        '지수·섹터·종목의 동행/괴리와 리더십 집중도를 확인',
        '실적·금리·정책 이벤트 전후 갭·거래량·수용을 기록',
        '변동성·유동성·포지셔닝에 따라 노출과 포지션 크기를 조정',
        '가설·무효화·재확인 조건을 시계열 로그로 남김'
      ]),
      observe: '노출·변동성·breadth·포지셔닝·이벤트 결과를 동일한 시간축에 놓고, 현재값과 dated reference를 구분',
      invalidation: '지수 확인·참여도·거래량·이벤트 결과가 맞지 않거나 반대 증거가 누적되면 기존 해석을 보류·갱신'
    }),
    Object.freeze({
      id: 'event-cluster-regime',
      sourceRefs: Object.freeze(['zerohedge-2095849461423456366', 'amitis-2095688508597788864', 'layla-2095270553406124090', 'gonnogo-daily-20260904']),
      timeSeriesIds: Object.freeze(['event-cluster', 'market-reaction', 'macro-release-lag']),
      title: '이벤트 군집 · 교차자산 전달',
      thesis: '지정학·원유·고용·중앙은행·실적·AI·규제 뉴스가 동시에 들어오면 단일 headline이나 당일 가격만으로 원인을 단정하지 않고 이벤트 군집과 전달 순서를 기록합니다.',
      steps: Object.freeze([
        '발표시각·출처등급·관측자산·직접 사실·해석을 분리',
        '원유·인플레이션 기대·Fed/BOJ·FX·채권·주식의 순차 반응을 같은 이벤트 ID로 연결',
        '동일 세션 반응과 1~5세션 follow-through를 분리',
        '후속 공식 발표·실적·가이던스·가격 수용이 최초 해석을 확인/무효화하는지 기록'
      ]),
      observe: 'event timestamp·source class·asset reaction·cross-asset spillover·confirmation을 event-cluster 시계열로 저장',
      invalidation: '출처·시각·자산 반응이 정렬되지 않거나 후속 관측이 반대이면 headline 하나를 레짐 변화로 승격하지 않음'
    }),
    Object.freeze({
      id: 'oil-shock-policy-branch',
      sourceRefs: Object.freeze(['zerohedge-2095849461423456366', 'amitis-2095688508597788864', 'layla-2095270553406124090', 'DrJStrategy-2094855932027023670', 'gonnogo-daily-20260904']),
      timeSeriesIds: Object.freeze(['event-cluster', 'macro-release-lag', 'market-reaction', 'treasury-plumbing']),
      title: '오일 공급충격 · 인플레이션과 성장의 분기',
      thesis: '외부 원유 공급충격은 구매력을 낮추고 비용·마진을 압박할 수 있지만, 국내 수요충격과 동일하지 않으므로 물가·성장·정책 경로를 분기해 확인합니다.',
      steps: Object.freeze([
        '지정학/공급 차질 → 원유·정제마진·운송비 → 기대인플레이션 경로 확인',
        '실질소득·소비·기업마진·고용을 통해 성장 둔화 경로를 별도 측정',
        'Fed 반응은 고용·core inflation·기대·금융여건과 함께 조건부로 기록',
        '장기금리·FX·신용·breadth의 동행 여부로 충격이 선택적인지 광범위한지 확인'
      ]),
      observe: '원유·물가·고용·소비·마진·금리·신용을 release date와 observation period로 정렬',
      invalidation: '공급충격 경로보다 국내 수요·임금·서비스 물가 또는 다른 공통요인이 강하면 정책 오류·1970년대 유사성을 사실처럼 사용하지 않음'
    }),
    Object.freeze({
      id: 'treasury-front-back-plumbing',
      sourceRefs: Object.freeze(['gimduha-2094963242414244137', 'gimduha-2094956632472219703', 'zerohedge-2095849461423456366']),
      timeSeriesIds: Object.freeze(['treasury-plumbing', 'macro-release-lag', 'market-reaction', 'institutional-quarter']),
      title: '국채시장 · 프론트엔드 가격과 백엔드 배관',
      thesis: '장기금리의 방향을 만드는 거시·매크로 자금과 이를 증폭하는 CTA/기술적 흐름을 repo·경매·딜러 대차대조표·basis 배관과 분리하되, 위기에서는 배관 스트레스가 가격을 지배할 수 있음을 레짐으로 표시합니다.',
      steps: Object.freeze([
        '2년·10년·30년 금리와 국채 가격·거래량·order flow를 secondary market 관측으로 저장',
        'buy-side macro·연기금·보험·글로벌 자금과 CTA·재량 momentum·basis를 flow class로 분류',
        'primary auction·repo·dealer balance sheet·eSLR·buyback은 중개·유동성 경로로 별도 기록',
        '평상시 first-order macro 우세와 스트레스 시 plumbing-dominance 전환을 구분'
      ]),
      observe: 'front-end yield·long-end flow·basis·CTA/technical flow·repo·dealer·auction의 발표일/관측일을 분리',
      invalidation: '단일 금리·basis trade·buyback만으로 장기 방향이나 완화 효과를 결론내리거나, 위기 레짐 근거가 없으면 plumbing dominance를 적용하지 않음'
    }),
    Object.freeze({
      id: 'expectation-credit-cycle',
      sourceRefs: Object.freeze(['gimduha-2095069737545789450', 'amitis-2095329815767175320', 'InvestNorthwise-2093778247171424706', 'MelvinInvests-2094881976927113495']),
      timeSeriesIds: Object.freeze(['expectation-vintage', 'capital-quarter', 'capacity-cohort', 'owner-fcf-waterfall']),
      title: '실현 이익 · 기대치 · CAPEX·신용 사이클',
      thesis: 'AI 기술과 현재 이익이 실재하더라도 12개월 forward 기대가 과도하면 별도의 기대치 버블이 생길 수 있으며, 투자 주도 이익은 CAPEX·신용·회수 가능성을 거쳐 검증해야 합니다.',
      steps: Object.freeze([
        'reported/realized earnings와 consensus·forward EPS의 vintage·revision·surprise를 분리',
        'CAPEX·계약·backlog·실제 사용량·가동률을 revenue·margin·FCF와 cohort로 연결',
        '고객 선급·프로젝트/리스/담보부채·증자·재융자와 owner FCF를 financing waterfall로 확인',
        'ROI·가격·가동률·신용스프레드가 악화될 때 기대치 재평가가 선택적/시스템적인지 점검'
      ]),
      observe: 'estimates vintage→release→revision→guidance, capex→depreciation/interest→cash, contract→recognition의 시차',
      invalidation: '현재 실적·현금·사용량·신용 경로가 없거나 dated secondary figures만 있으면 기대치 버블·신용 전환을 현재 신호로 만들지 않음'
    }),
    Object.freeze({
      id: 'ai-capex-flow',
      sourceRefs: Object.freeze(['MelvinInvests-2094881976927113495', 'aleabitoreddit-2094704372831920324', 'Trader-Jesse-2094389217782849928', 'amitis-2095329815767175320']),
      timeSeriesIds: Object.freeze(['ai-capex-flow', 'equipment-cycle', 'qualification-milestones', 'capital-quarter']),
      title: 'AI CAPEX 흐름 · 병목 계층 지도',
      thesis: 'AI CAPEX는 반도체·WFE·네트워킹·전력·냉각·시설로 분해해야 공급 병목과 수혜 경로를 추적할 수 있지만, Sankey 비중은 현재 기업 노출·밸류에이션이 아닌 구조적 taxonomy입니다.',
      steps: Object.freeze([
        '반도체를 accelerator·memory IC·CPU/other로 나누고 WFE·패키징·검사로 전개',
        '네트워크를 processors·cabling·switches·optical transceivers로 분리',
        '전력을 grid connection/generation·distribution·on-site routing, 냉각을 cold plate/CDU/chiller로 분리',
        'land·shell·fitout과 install/qualification/lead-time을 자본수명·가동률 시계열에 연결'
      ]),
      observe: 'budget·PO·lead time·installation·qualification·utilization·replacement의 프로젝트/분기 순서를 확인',
      invalidation: '고수준 추정치·단일 공급사 언급·첫 주문만 있고 고객 인증·반복 주문·실제 가동·현금 전환이 없으면 종목 노출로 승격하지 않음'
    }),
    Object.freeze({
      id: 'ai-equipment-cycle',
      sourceRefs: Object.freeze(['Trader-Jesse-2094389217782849928', 'aleabitoreddit-2094704372831920324', 'markminervini-2095161472204599618']),
      timeSeriesIds: Object.freeze(['equipment-cycle', 'ai-capex-flow', 'qualification-milestones', 'market-reaction']),
      title: 'AI 장비 사이클 · 제품 매출보다 앞선 주문',
      thesis: '공급 부족과 용량 확장은 장비 주문과 백로그를 먼저 움직일 수 있으므로 장비 사이클은 order→book-to-bill→backlog→delivery→revenue→margin→FCF의 계층으로 확인합니다.',
      steps: Object.freeze([
        '제품 수요·가동률·리드타임이 장비 주문으로 이어지는 선행 신호인지 확인',
        'first order와 repeat PO·second/third customer·서비스/스페어를 분리',
        '주문·납기·백로그를 매출 인식과 비교하고 고객 집중도·정상화 매출을 반영',
        '가동률 정체·lead time 정상화·supply constrained 표현 약화·book-to-bill 하락을 digestion 경보로 기록'
      ]),
      observe: '제품/장비/고객별 주문일·납기·설치·매출·마진·서비스 매출을 monthly/quarterly로 정렬',
      invalidation: '한 번의 대형 주문·secondary figure·제품 매출 상승만 있고 반복 PO·백로그·설치·현금 전환이 없으면 장비 사이클 지속으로 보지 않음'
    }),
    Object.freeze({
      id: 'ai-control-plane',
      sourceRefs: Object.freeze(['StockAnalystPro-2093890963865473043', 'LuxAlgo-Vela', 'Vela-architecture', 'Vela-API']),
      timeSeriesIds: Object.freeze(['ai-control-plane', 'ai-request', 'ai-operations', 'software-usage-cohort']),
      title: 'AI 컨트롤 플레인 · 토큰 공장의 운영 계층',
      thesis: 'AI 인프라의 경제성은 GPU 보유량만이 아니라 provisioning·scheduling·멀티테넌시·보안·관측성·FinOps·lifecycle과 serving의 실제 운영 결과로 결정됩니다.',
      steps: Object.freeze([
        'Layer 1: 전력·시설·GPU 클러스터 provisioning, policy, isolation, lifecycle, observability를 기록',
        'Layer 2: 모델 serving·batching·routing·caching·autoscaling·inference efficiency를 workload별로 기록',
        'vendor-neutral provider/renderer/engine port와 capability negotiation으로 교체 가능성을 보존',
        'activation time·GPU utilization·error/retry·tokens/GPU·tokens/W·time-to-revenue를 운영 결과로 확인'
      ]),
      observe: 'request/session·daily operations·monthly usage·quarterly capital의 시계열을 물리 계층/제어 계층/서비스 계층으로 분리',
      invalidation: '오케스트레이션 도입·파트너 명칭·벤치마크만 있고 실제 가동률·격리·장애·사용량·매출 개선이 재현되지 않으면 플랫폼 경제성으로 승격하지 않음'
    }),
    Object.freeze({
      id: 'capacity-cohort-waterfall',
      sourceRefs: Object.freeze(['InvestNorthwise-2093778247171424706', 'amitis-2095329815767175320', 'StockAnalystPro-2093890963865473043']),
      timeSeriesIds: Object.freeze(['capacity-cohort', 'owner-fcf-waterfall', 'capital-quarter', 'ai-operations']),
      title: 'AI 용량 · 계약 코호트·소유자 FCF',
      thesis: 'connected power·계약·exit ARR은 평균 billable 용량·인식매출·소유자 FCF와 다른 분모이므로 site mapping과 capital waterfall을 통해 durable fleet economics를 확인합니다.',
      steps: Object.freeze([
        'site·MW·connected power → IT power → energization/acceptance를 순서대로 확인',
        '계약 ACV/RPO·기간·선급·수락 조건을 계약 코호트와 실제 utilization·revenue로 연결',
        'CAPEX·감가상각·리스·이자·교체 reserve·프로젝트 부채·희석을 owner FCF에 반영',
        'owned·build-to-suit·colocation과 hyperscaler bridge/end-state를 site별로 분리'
      ]),
      observe: '프로젝트/월/분기별 평균·exit·인식·현금 지표를 같은 기간으로 덮어쓰지 않고 자금조달 조건과 함께 저장',
      invalidation: '지리·사이트 배정·고객 수락·실제 사용량·현금 회수·교체 자본이 없으면 연결 전력이나 ARR로 durable economics를 확정하지 않음'
    }),
    Object.freeze({
      id: 'seasonality-convergence',
      sourceRefs: Object.freeze(['markminervini-2094407591006724563', 'markminervini-2095161472204599618', 'RealSimpleAriel-2093778843186418078']),
      timeSeriesIds: Object.freeze(['seasonal-convergence', 'market-reaction', 'market-swing', 'market-trend']),
      title: '계절성 · 가격·금리·원유·리더십 수렴',
      thesis: '1년·4년·10년 계절/선거/십년 주기는 맥락일 뿐 신호가 아니며, 실제 가격·breadth·거래량·금리·원유·리더십 확인이 있을 때만 리스크 맥락을 강화합니다.',
      steps: Object.freeze([
        '계절성 창과 실제 가격 추세·지지/저항·거래량을 분리',
        '금리·달러·원유·금속·바이오·에너지 등 교차자산을 같은 기준일로 대조',
        '시장 breadth·소형주·동일가중·리더십 집중이 지수와 동행하는지 확인',
        '수렴이 약하면 계절성만으로 포지션·순위·자동 트리거를 만들지 않음'
      ]),
      observe: 'annual context → 1~5 sessions → 20~60 sessions → 50~200 sessions 순으로 정렬',
      invalidation: '가격과 리더십이 건설적이거나 계절성 반대의 실제 확인이 누적되면 계절성 경보를 낮은 가중치 참고로 되돌림'
    }),
    Object.freeze({
      id: 'hypothesis-event-test',
      sourceRefs: Object.freeze(['kishawn07-2093815152193970510', 'StockAnalystPro-2093890963865473043']),
      timeSeriesIds: Object.freeze(['hypothesis-test', 'event-cluster', 'capacity-cohort', 'reporting-break']),
      title: '미확인 가설 · 공시·계약·배치 테스트',
      thesis: '특정 고객·계약·인수·수직통합에 대한 추론은 가설로 남기고, 다음 공시·계약 허가·MW/일정·매출 인식·운영 데이터가 확인 또는 무효화하는 구조로 관리합니다.',
      steps: Object.freeze([
        'claim·evidence class·가설일·대안 설명을 명시',
        '확인 이벤트: 공식 prospectus/filing·기업 허가·계약 경제성·MW/배치 일정·매출 업데이트를 지정',
        '무효화 이벤트: 다른 고객·NDA·조건부 수락·미공시·일정 지연·재무 불일치를 지정',
        '상태는 HYPOTHESIS/CONFIRMED/INVALIDATED로만 관리하고 스크리너 점수와 분리'
      ]),
      observe: '가설일 이후의 public filing/event date와 증거 직접성을 test window로 저장',
      invalidation: '직접 증거가 없거나 반대 증거가 우세하면 추론을 종목 순위·현재 사실·매매 판단으로 승격하지 않음'
    }),
    Object.freeze({
      id: 'reporting-segment-break',
      sourceRefs: Object.freeze(['amitis-2095329815767175320', 'gimduha-2095069737545789450']),
      timeSeriesIds: Object.freeze(['reporting-break', 'expectation-vintage', 'capital-quarter']),
      title: '보고 세그먼트 변경 · 시계열 단절',
      thesis: '사업부·보고 체계가 바뀌면 이전 매출·마진·백로그 시계열을 같은 정의로 잇지 않고 변경일·재작성·비교 가능 구간을 표시합니다.',
      steps: Object.freeze([
        'segment definition·reporting date·effective period를 원문 공시에서 추출',
        'recast history·old/new mapping·비교 불가 구간을 별도 표시',
        '매출·마진·backlog·capex·고객집중을 변경 전후 같은 정의로 재계산',
        '가이던스·컨센서스 빈티지가 새 세그먼트 정의를 반영했는지 확인'
      ]),
      observe: '보고기간·공시일·재작성일·새 분류의 comparable window를 함께 저장',
      invalidation: '세그먼트 정의·재작성·기준일이 없으면 성장·마진·백로그 추세를 직접 비교하지 않음'
    }),
    Object.freeze({
      id: 'chart-core-ports',
      sourceRefs: Object.freeze(['LuxAlgo-Vela', 'Vela-architecture', 'Vela-API']),
      timeSeriesIds: Object.freeze(['market-reaction', 'market-trend', 'event-window', 'macro-release-lag']),
      title: '차트 코어 · 데이터·스크립트·렌더러 포트',
      thesis: 'Vela 자료의 핵심은 특정 패키지 도입이 아니라 canonical time/bar model과 좁은 포트로 market data·script/indicator·renderer를 분리하고, 현재/잠정 관측을 구분하는 구조입니다.',
      steps: Object.freeze([
        '모든 가격/이벤트 bar를 canonical epoch milliseconds와 명시적 observedAt으로 정규화',
        'data provider·indicator/script engine·renderer가 neutral series/overlay/patch만 교환하도록 경계를 유지',
        'history/tick/inputs/viewport 실행 원인과 provisional/final 상태를 구분',
        'capability negotiation·fail-soft lifecycle·no-dead-legend로 데이터 부재와 엔진 실패를 안전하게 표시'
      ]),
      observe: '시장·거시·기업 차트의 session/eod·event-linked·daily/weekly history를 동일 시간 기준으로 확인',
      invalidation: '렌더러의 시각 표현이나 단일 패키지 benchmark가 canonical observation·source·timeframe을 덮어쓰면 구조 계약을 위반한 것으로 보류'
    }),
    Object.freeze({
      id: 'supply-bottleneck-graph',
      sourceRefs: Object.freeze(['aleabitoreddit-2094704372831920324', 'Trader-Jesse-2094389217782849928', 'GB200-GB300-VR200-supply-chain-attachment']),
      timeSeriesIds: Object.freeze(['ai-capex-flow', 'equipment-cycle', 'qualification-milestones', 'capacity-cohort']),
      title: 'AI 공급망 · 병목·qualification 그래프',
      thesis: 'GPU→HBM→패키징→네트워크/광학→전력·냉각→저장장치로 이어지는 병목은 제품 BOM·공정 단계·리드타임·qualification·반복 주문 그래프로 추적해야 합니다.',
      steps: Object.freeze([
        '시스템 세대별 BOM과 공정 단계·콘텐츠 강도를 구분',
        'lead time·capacity·yield·qualification·고객 믹스의 상태와 변경일을 기록',
        '단일 부족 보도와 다수 고객 반복 주문·실제 설치·매출을 구분',
        '아키텍처 전환 시 기존 부품의 대체·재검증·공급사 집중 위험을 표시'
      ]),
      observe: 'sample→validation→yield→volume→customer mix와 demand→order→install→revenue를 겹쳐 확인',
      invalidation: '공급망 표·리드타임 주장만 있고 고객 인증·양산·반복 PO·현금화가 없으면 current exposure로 확정하지 않음'
    }),
    Object.freeze({
      id: 'leverage-exposure-discipline',
      sourceRefs: Object.freeze(['NathanYJLee-2097957777922793710', 'NathanYJLee-2097557593573199994']),
      timeSeriesIds: Object.freeze(['exposure-leverage', 'behavior-horizon', 'market-reaction']),
      title: '조달 레버리지와 방향성 노출 분리',
      thesis: '금융기관의 저비용 조달 레버리지는 사업 구조의 일부일 수 있지만, 그 레버리지로 방향성을 예측·베팅하는 것은 별도 위험이다. 스크리너는 레버리지를 권하지 않고 조달·담보·노출·한도·무효화의 분리를 질문으로 남겨야 한다.',
      steps: Object.freeze([
        'gross/net exposure·담보·조달 만기·금융비용·유동성 buffer를 구분',
        '자금조달 레버리지와 종목·시장 방향성 beta를 별도 기록',
        '예측 정확도보다 사전 리스크 한도·손실 허용·강제청산 경로를 확인',
        '일 단위 변동성과 수년 단위 성과를 분리해 행동 루프·과매매를 점검'
      ]),
      observe: '현재 exposure와 financing evidence가 모두 공식/사용자 입력으로 제공되는 경우에만 노출 맥락을 표시하며, 게시물의 10x 표현을 기본값·임계값으로 복사하지 않음',
      invalidation: '담보·조달비용·한도·관측시각이 없거나 directional risk와 funding risk를 분리할 수 없으면 레버리지 해석과 실행 문구를 보류'
    }),
    Object.freeze({
      id: 'wedge-pop-retest',
      sourceRefs: Object.freeze(['Trader-Jesse-2097868442309472608', 'BTC-WyckoffLab-2095358094956245419', 'attachment-dell-post-earnings-breakout-20260911']),
      timeSeriesIds: Object.freeze(['structure-confirmation', 'event-window', 'market-reaction']),
      title: 'Wedge Pop · 지지 반응 · 실적 후 돌파 확인',
      thesis: 'Wedge Pop, 박스 지지, 실적 후 돌파는 방향을 예언하는 라벨이 아니라 수렴/기반 → 촉발 → 거래량·수용 → 리테스트·저항 확인의 순서를 기록하는 구조 프레임이다.',
      steps: Object.freeze([
        '기반·수렴·지지 구간과 이전 저항을 일봉 OHLCV로 식별',
        '이동평균 reclaim·돌파·실적 이벤트와 거래량을 같은 세션 창에 정렬',
        '첫 반응 뒤 가격이 위에서 수용되는지, 매도세에 거부되는지 관찰',
        '리테스트 지지 또는 실패·재진입을 무효화 조건으로 남김'
      ]),
      observe: '발표시각·장중/종가·거래량·갭·수용/거부·+1~5세션 follow-through를 보존하며, 첨부 DELL 눈금과 CBRS의 가격·목표값은 현재 데이터로 복사하지 않음',
      invalidation: '거래량·OHLCV·이벤트 시각·리테스트가 없거나 돌파가 저항에서 거부되면 패턴명을 진입 신호로 승격하지 않음'
    }),
    Object.freeze({
      id: 'proof-before-exposure',
      sourceRefs: Object.freeze(['markminervini-2097722372757295582', 'ProblemSniper-2096672934828093812']),
      timeSeriesIds: Object.freeze(['event-cluster', 'market-swing', 'market-trend', 'structure-confirmation']),
      title: '시장 증명 전 노출·리더십 회전',
      thesis: '약화된 breadth·momentum에서 선택적 리더십을 관찰하고 시장이 증명할 때까지 노출을 제한한다는 신중론과, 고용/Fed·지수 구조를 근거로 한 방향성 가설은 서로 다른 의견으로 보존한다. 둘을 평균내어 단일 레짐으로 만들지 않는다.',
      steps: Object.freeze([
        '지수·동일가중·소형주·섹터 breadth와 상대강도를 같은 기준일로 비교',
        '리더십 회전·지지·돌파·이벤트 군집을 source/asOf와 함께 기록',
        '공격적 broad exposure와 selectivity/hedge 가설의 조건을 따로 표시',
        '후속 종가 수용·breadth 확장·실적/정책 확인으로 각 가설을 검증'
      ]),
      observe: 'Mark Minervini의 선택성·확인 대기와 ProblemSniper의 방향성 주장을 attribution·시점·증거 등급별로 병렬 보존',
      invalidation: '현재 breadth·상대강도·이벤트 데이터가 없거나 한 게시물의 목표/확률만 남으면 레짐·방향성을 현재 신호로 표시하지 않음'
    }),
    Object.freeze({
      id: 'investor-behavior-loop',
      sourceRefs: Object.freeze(['NathanYJLee-2097557593573199994', 'NathanYJLee-2097957777922793710']),
      timeSeriesIds: Object.freeze(['behavior-horizon', 'exposure-leverage', 'market-swing']),
      title: 'FOMO·과매매·레버리지 행동 루프',
      thesis: '일 단위 가격 소음과 수년 단위 투자 성과의 간극, 소셜 비교와 FOMO, 손실 만회 심리가 과매매·베팅 증액·레버리지 확대를 반복시킬 수 있다. 이는 종목 전망이 아니라 사용자 의사결정 품질을 점검하는 위험 프레임이다.',
      steps: Object.freeze([
        '성과 평가 horizon·turnover·손실 회복 시간과 실질 구매력 변화를 분리',
        '소셜 headline·단기 변동·레버리지 변화가 계획을 덮는지 기록',
        '가설·포지션·무효화·다음 확인일을 매매 후 저널에 고정',
        '손실 만회 목적의 규모 증가·방향성 예측 과신을 별도 경고로 표시'
      ]),
      observe: '현재 포트폴리오·거래기록이 제공될 때만 사용자 선택형 교육 맥락으로 사용하고, 제3자 게시물의 심리 묘사를 사용자 상태로 추정하지 않음',
      invalidation: '실제 horizon·거래·노출 정보가 없으면 행동 진단을 개인화하거나 실행 지시로 렌더링하지 않음'
    }),
    Object.freeze({
      id: 'investment-financing-productivity',
      sourceRefs: Object.freeze(['laylaperfume-2096959904410193928']),
      timeSeriesIds: Object.freeze(['investment-financing-productivity', 'treasury-plumbing', 'capital-quarter', 'expectation-vintage']),
      title: 'Investment Surge · Financing Surge · Productivity Surge',
      thesis: 'AI·인프라 투자가 경제 전반의 성장으로 이어지려면 민간 자본수요를 실제로 공급할 금융시스템 여력과 생산성 전환이 함께 확인되어야 한다는 가설이다. 글의 정책 연결은 2차 해석으로 남기고 공식 발언·은행 대차대조표·신용·생산성·물가·장기금리로 검증한다.',
      steps: Object.freeze([
        '민간 CAPEX·주문·설치·가동률을 Financing Surge와 분리',
        '커뮤니티은행·딜러·repo·국채시장 대차대조표 여력과 실제 신용공급을 확인',
        '투자 → 생산성·단위비용·고용·매출/현금 전환을 기업·거시 양쪽에서 측정',
        '장기금리·기대인플레이션·물가가 투자 사이클을 지지하는지 또는 압박하는지 분기'
      ]),
      observe: '2차 글의 Investment/Financing/Productivity 용어를 current claim이 아닌 hypothesis로 저장하고, 발표일·관측기간·개정일을 공식 데이터와 별도 정렬',
      invalidation: 'CAPEX만 늘고 신용·가동률·생산성·현금 전환이 없거나 물가·장기금리 압력이 커지면 성장/부채 경감 경로를 유지하지 않음'
    }),
    Object.freeze({
      id: 'dollar-rails-amplifier',
      sourceRefs: Object.freeze(['gimduha-2096762435315384622']),
      timeSeriesIds: Object.freeze(['dollar-rails', 'treasury-plumbing', 'market-reaction']),
      title: '달러 배관은 원인·결과·증폭기를 구분',
      thesis: '달러 약세, 달러 패권, 결제·담보·repo 인프라, 자산가격은 서로 다른 층위다. 배관은 평상시 자산가격 기대를 반영하는 결과·증폭기일 수 있지만 마진콜·유동성 경색·지급준비금 스트레스에서는 독립적 원인으로 전환될 수 있다.',
      steps: Object.freeze([
        '통화가치·국제결제·미국채 담보·repo/settlement rail을 별도 관측',
        '프론트엔드 가격·포지셔닝과 백엔드 유동성·담보 스트레스를 분리',
        '온체인 레일·스테이블코인·DTCC 등은 구조 참고로만 두고 실제 사용·규모·규제 증거를 확인',
        '예외적 plumbing dominance는 margin call·funding stress·price dislocation이 함께 나타날 때만 표시'
      ]),
      observe: '달러 약세를 패권 붕괴로 번역하지 않고, backend plumbing이 front-end price를 증폭한 사건인지 순서를 기록',
      invalidation: 'settlement·collateral·repo·margin 관측이 없으면 배관을 현재 시장 방향의 독립 원인으로 사용하지 않음'
    })
  ]),
  routeMappings: Object.freeze({
    home: Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'market-principles', 'macro-lagged-supply', 'event-cluster-regime', 'oil-shock-policy-branch', 'seasonality-convergence', 'proof-before-exposure', 'investor-behavior-loop']), timeSeriesIds: Object.freeze(['market-reaction', 'market-trend', 'macro-release-lag', 'event-cluster', 'seasonal-convergence', 'treasury-plumbing', 'behavior-horizon']) }),
    signal: Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'market-risk-process', 'institutional-flow', 'event-cluster-regime', 'seasonality-convergence', 'treasury-front-back-plumbing', 'leverage-exposure-discipline', 'proof-before-exposure', 'wedge-pop-retest']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'event-window', 'event-cluster', 'institutional-quarter', 'seasonal-convergence', 'treasury-plumbing', 'exposure-leverage', 'structure-confirmation']) }),
    technical: Object.freeze({ sectionIds: Object.freeze(['price-first-confirmation', 'market-confirmation', 'chart-core-ports', 'ai-equipment-cycle', 'seasonality-convergence', 'wedge-pop-retest', 'proof-before-exposure']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend', 'event-window', 'equipment-cycle', 'seasonal-convergence', 'structure-confirmation']) }),
    market: Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'market-principles', 'macro-lagged-supply', 'market-risk-process', 'event-cluster-regime', 'oil-shock-policy-branch', 'treasury-front-back-plumbing', 'seasonality-convergence', 'proof-before-exposure', 'dollar-rails-amplifier', 'investment-financing-productivity']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend', 'macro-release-lag', 'event-window', 'event-cluster', 'treasury-plumbing', 'seasonal-convergence', 'dollar-rails', 'investment-financing-productivity']) }),
    macro: Object.freeze({ sectionIds: Object.freeze(['market-principles', 'macro-lagged-supply', 'market-confirmation', 'event-cluster-regime', 'oil-shock-policy-branch', 'treasury-front-back-plumbing', 'expectation-credit-cycle', 'investment-financing-productivity', 'dollar-rails-amplifier']), timeSeriesIds: Object.freeze(['macro-release-lag', 'market-reaction', 'market-trend', 'event-cluster', 'treasury-plumbing', 'expectation-vintage', 'capital-quarter', 'investment-financing-productivity', 'dollar-rails']) }),
    fxbond: Object.freeze({ sectionIds: Object.freeze(['market-principles', 'market-risk-process', 'macro-lagged-supply', 'event-cluster-regime', 'oil-shock-policy-branch', 'treasury-front-back-plumbing', 'investment-financing-productivity', 'dollar-rails-amplifier']), timeSeriesIds: Object.freeze(['macro-release-lag', 'market-reaction', 'event-window', 'event-cluster', 'treasury-plumbing', 'investment-financing-productivity', 'dollar-rails']) }),
    breadth: Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'price-first-confirmation', 'market-risk-process', 'event-cluster-regime', 'seasonality-convergence', 'proof-before-exposure', 'wedge-pop-retest']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend', 'event-cluster', 'seasonal-convergence', 'structure-confirmation']) }),
    themes: Object.freeze({ sectionIds: Object.freeze(['ai-era-economics', 'ai-inference-architecture', 'ai-capacity-conversion', 'ai-hardware-qualification', 'physical-ai-validation', 'software-outcome-economics', 'ai-capex-flow', 'ai-equipment-cycle', 'ai-control-plane', 'capacity-cohort-waterfall', 'supply-bottleneck-graph', 'hypothesis-event-test', 'investment-financing-productivity']), timeSeriesIds: Object.freeze(['ai-request', 'ai-workload-cohort', 'ai-operations', 'capital-quarter', 'qualification-milestones', 'physical-ai-operations', 'software-usage-cohort', 'ai-capex-flow', 'equipment-cycle', 'ai-control-plane', 'capacity-cohort', 'owner-fcf-waterfall', 'hypothesis-test', 'investment-financing-productivity']) }),
    'theme-detail': Object.freeze({ sectionIds: Object.freeze(['ai-era-economics', 'ai-capacity-conversion', 'physical-ai-validation', 'software-outcome-economics', 'ai-capex-flow', 'ai-equipment-cycle', 'ai-control-plane', 'capacity-cohort-waterfall', 'supply-bottleneck-graph', 'hypothesis-event-test', 'investment-financing-productivity']), timeSeriesIds: Object.freeze(['ai-workload-cohort', 'ai-operations', 'capital-quarter', 'physical-ai-operations', 'software-usage-cohort', 'ai-capex-flow', 'equipment-cycle', 'ai-control-plane', 'capacity-cohort', 'owner-fcf-waterfall', 'hypothesis-test', 'investment-financing-productivity']) }),
    principles: Object.freeze({ sectionIds: Object.freeze(['market-principles', 'market-confirmation', 'macro-lagged-supply', 'institutional-flow', 'ai-era-economics', 'ai-inference-architecture', 'ai-capacity-conversion', 'market-risk-process', 'event-cluster-regime', 'oil-shock-policy-branch', 'treasury-front-back-plumbing', 'expectation-credit-cycle', 'seasonality-convergence', 'chart-core-ports', 'hypothesis-event-test', 'leverage-exposure-discipline', 'wedge-pop-retest', 'proof-before-exposure', 'investor-behavior-loop', 'investment-financing-productivity', 'dollar-rails-amplifier']), timeSeriesIds: Object.freeze(['market-reaction', 'market-trend', 'macro-release-lag', 'institutional-quarter', 'ai-workload-cohort', 'capital-quarter', 'event-cluster', 'expectation-vintage', 'treasury-plumbing', 'seasonal-convergence', 'hypothesis-test', 'exposure-leverage', 'structure-confirmation', 'behavior-horizon', 'investment-financing-productivity', 'dollar-rails']) }),
    atlas: Object.freeze({ sectionIds: Object.freeze(['ai-era-economics', 'ai-inference-architecture', 'ai-capacity-conversion', 'ai-hardware-qualification', 'market-principles', 'market-confirmation', 'macro-lagged-supply', 'institutional-flow', 'event-cluster-regime', 'oil-shock-policy-branch', 'treasury-front-back-plumbing', 'expectation-credit-cycle', 'ai-capex-flow', 'ai-equipment-cycle', 'ai-control-plane', 'capacity-cohort-waterfall', 'supply-bottleneck-graph', 'chart-core-ports', 'hypothesis-event-test', 'reporting-segment-break', 'wedge-pop-retest', 'investment-financing-productivity', 'dollar-rails-amplifier']), timeSeriesIds: Object.freeze(['market-reaction', 'market-trend', 'macro-release-lag', 'institutional-quarter', 'ai-request', 'ai-workload-cohort', 'capital-quarter', 'qualification-milestones', 'event-cluster', 'expectation-vintage', 'ai-capex-flow', 'equipment-cycle', 'treasury-plumbing', 'ai-control-plane', 'capacity-cohort', 'owner-fcf-waterfall', 'hypothesis-test', 'reporting-break', 'structure-confirmation', 'investment-financing-productivity', 'dollar-rails']) }),
    screener: Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'ai-era-economics', 'ai-capacity-conversion', 'ai-hardware-qualification', 'expectation-credit-cycle', 'ai-capex-flow', 'ai-equipment-cycle', 'ai-control-plane', 'capacity-cohort-waterfall', 'supply-bottleneck-graph', 'market-risk-process', 'chart-core-ports', 'wedge-pop-retest', 'leverage-exposure-discipline', 'proof-before-exposure', 'investment-financing-productivity']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend', 'event-window', 'ai-workload-cohort', 'ai-operations', 'capital-quarter', 'qualification-milestones', 'expectation-vintage', 'ai-capex-flow', 'equipment-cycle', 'ai-control-plane', 'capacity-cohort', 'owner-fcf-waterfall', 'structure-confirmation', 'exposure-leverage', 'investment-financing-productivity']) }),
    ticker: Object.freeze({ sectionIds: Object.freeze(['ai-era-economics', 'ai-capacity-conversion', 'ai-inference-architecture', 'institutional-flow', 'ai-control-plane', 'ai-equipment-cycle', 'expectation-credit-cycle', 'capacity-cohort-waterfall', 'hypothesis-event-test', 'reporting-segment-break', 'wedge-pop-retest', 'leverage-exposure-discipline', 'investment-financing-productivity']), timeSeriesIds: Object.freeze(['ai-request', 'ai-operations', 'capital-quarter', 'institutional-quarter', 'ai-control-plane', 'equipment-cycle', 'expectation-vintage', 'capacity-cohort', 'owner-fcf-waterfall', 'hypothesis-test', 'reporting-break', 'structure-confirmation', 'exposure-leverage', 'investment-financing-productivity']) }),
    fundamental: Object.freeze({ sectionIds: Object.freeze(['ai-capacity-conversion', 'software-outcome-economics', 'physical-ai-validation', 'institutional-flow', 'expectation-credit-cycle', 'capacity-cohort-waterfall', 'ai-control-plane', 'hypothesis-event-test', 'reporting-segment-break', 'investment-financing-productivity']), timeSeriesIds: Object.freeze(['software-usage-cohort', 'physical-ai-operations', 'capital-quarter', 'institutional-quarter', 'expectation-vintage', 'capacity-cohort', 'owner-fcf-waterfall', 'ai-control-plane', 'hypothesis-test', 'reporting-break', 'investment-financing-productivity']) }),
    options: Object.freeze({ sectionIds: Object.freeze(['market-principles', 'market-risk-process', 'event-cluster-regime', 'oil-shock-policy-branch', 'treasury-front-back-plumbing', 'seasonality-convergence']), timeSeriesIds: Object.freeze(['market-reaction', 'event-window', 'event-cluster', 'treasury-plumbing', 'seasonal-convergence']) }),
    portfolio: Object.freeze({ sectionIds: Object.freeze(['market-risk-process', 'market-principles', 'institutional-flow', 'ai-capacity-conversion', 'expectation-credit-cycle', 'treasury-front-back-plumbing', 'oil-shock-policy-branch', 'seasonality-convergence', 'leverage-exposure-discipline', 'investor-behavior-loop', 'proof-before-exposure', 'dollar-rails-amplifier']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'institutional-quarter', 'capital-quarter', 'expectation-vintage', 'treasury-plumbing', 'seasonal-convergence', 'owner-fcf-waterfall', 'exposure-leverage', 'behavior-horizon', 'dollar-rails']) }),
    masters: Object.freeze({ sectionIds: Object.freeze(['institutional-flow', 'market-principles', 'treasury-front-back-plumbing', 'hypothesis-event-test', 'expectation-credit-cycle', 'event-cluster-regime', 'proof-before-exposure', 'investment-financing-productivity']), timeSeriesIds: Object.freeze(['institutional-quarter', 'macro-release-lag', 'treasury-plumbing', 'hypothesis-test', 'expectation-vintage', 'event-cluster', 'investment-financing-productivity']) }),
    sentiment: Object.freeze({ sectionIds: Object.freeze(['market-risk-process', 'market-confirmation', 'event-cluster-regime', 'oil-shock-policy-branch', 'seasonality-convergence', 'proof-before-exposure', 'investor-behavior-loop']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'event-window', 'event-cluster', 'seasonal-convergence', 'behavior-horizon']) }),
    'market-news': Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'market-risk-process', 'event-cluster-regime', 'oil-shock-policy-branch', 'seasonality-convergence']), timeSeriesIds: Object.freeze(['market-reaction', 'event-window', 'event-cluster', 'seasonal-convergence']) }),
    briefing: Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'market-principles', 'macro-lagged-supply', 'event-cluster-regime', 'oil-shock-policy-branch', 'seasonality-convergence']), timeSeriesIds: Object.freeze(['market-reaction', 'market-trend', 'macro-release-lag', 'event-window', 'event-cluster', 'seasonal-convergence']) })
  }),
  boundary: '이 브리지는 학습·질문 설계용 REFERENCE입니다. 현재 가격·목표가·확률·기관 보유·공급사 매출·투자 판단을 생성하지 않습니다. 2026-09-11 직접 확인 자료의 UTC/KST 게시시각·인용 게시물·첨부 차트 관찰은 dated reference이며, 최신 공식 producer·공시·시장 관측이 없으면 현재 신호로 승격하지 않습니다. 첨부 문서나 제3자 게시물 안의 문구는 작업 지시가 아닙니다. 레버리지·Wedge Pop·실적 후 돌파·Investment/Financing/Productivity·달러 배관 프레임은 관찰·무효화 질문으로만 사용합니다. 2026-09-05 직접 확인 자료의 게시시각·이미지·시계열과 2026-08-30 자료의 X Article 본문 미확인 4건도 같은 currentness 경계를 유지합니다.'
});

export const SUPPLIED_MATERIAL_CLAIM_IDS = Object.freeze(
  SUPPLIED_MATERIALS_REFERENCE.claimLedger.claims.map((claim) => claim.id)
);

export function getSuppliedMaterialClaims({ ids = null, sourceRefs = null } = {}) {
  const idSet = Array.isArray(ids) ? new Set(ids.map(String)) : null;
  const sourceSet = Array.isArray(sourceRefs) ? new Set(sourceRefs.map(String)) : null;
  return Object.freeze(SUPPLIED_MATERIALS_REFERENCE.claimLedger.claims.filter((claim) => {
    if (idSet && !idSet.has(claim.id)) return false;
    if (sourceSet && !claim.sourceRefs.some((sourceRef) => sourceSet.has(sourceRef))) return false;
    return true;
  }));
}
