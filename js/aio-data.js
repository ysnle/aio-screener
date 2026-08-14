// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  P3-1 PHASE 2 ▸ MODULE 2: DATA START (실제 분할 적용 v48.26)              ║
// ║  책임: SCREENER_DB + Fetch Pipeline + Score + Classify + Translate + Ticker║
// ║  의존성: MODULE 1 (stores/engines/DATA_SNAPSHOT/utils — 모두 전역 var/const)║
// ║  안전 근거: MODULE 1 const는 톱-레벨 선언으로 전역 lexical 환경 등록됨      ║
// ║  분할 후 다음 블록에서 const PriceStore 등 접근 가능 (TDZ는 동일 블록에만 적용)║
// ╚═══════════════════════════════════════════════════════════════════════════╝
// ═══════════════ SCREENER DATABASE & FUNCTIONS ═══════════════
// SCREENER_DB는 정적 식별자 유니버스다. 변동 팩터와 메모는 출처가 있는 런타임 산출물만 병합한다.
var SCREENER_DB_META = {
  schemaVersion:'v53.4', lastBulkUpdate:'2026-07-16', staleAfterDays:30, replaceAfterDays:90,
  source:'js/aio-data.js curated identity universe; public-data/screener.json runtime enrichment',
  note:'정적 유니버스는 심볼·이름·섹터·지수만 보관하며 signal/memo/mcap/rsi는 런타임 산출물로만 채운다.'
};
try { window.SCREENER_DB_META = SCREENER_DB_META; } catch(_) {}
var SCREENER_DB = [
  // ══════════════════════════════════════════════════════════════
  // S&P 500 — 메가캡 & 대형주 식별자
  // lifecycle 메타는 SCREENER_DB_META를 참조한다.
  // ══════════════════════════════════════════════════════════════
  { sym:'NVDA', name:'NVIDIA', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] AI infrastructure demand monitor: GPU availability/rental repricing, hyperscaler operating-cash-flow acceleration, frontier-lab growth, memory allocation and power/interconnection capacity must be read together. Any one bullish input is insufficient; persistent GPU price decline, OCF deceleration or lab-growth stagnation is a thesis-break candidate.' },
  { sym:'AAPL', name:'Apple', sector:'Technology', index:'SP500' },
  { sym:'GOOGL', name:'Alphabet', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] AI capex must be separated into contracted cloud/backlog conversion, utilization, depreciation and power delivery. Verify current filings, FCF, debt capacity and customer economics; capex alone is not demand proof.' },
  { sym:'MSFT', name:'Microsoft', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] AI demand monitor: distinguish contracted cloud/backlog conversion and operating-cash-flow acceleration from depreciation, financing and power-delivery constraints. Evidence must include current filings/earnings, not interview estimates alone.' },
  { sym:'AMZN', name:'Amazon', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] AWS/AI infrastructure thesis depends on utilization, custom silicon, memory allocation and power/site execution. Monitor CapEx-to-revenue conversion, cash flow, GPU/ASIC economics and interconnection rather than headline token growth.' },
  { sym:'META', name:'Meta Platforms', sector:'Technology', index:'SP500' },
  { sym:'TSM', name:'TSMC', sector:'Technology', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] Insider/BornLupin/HANA observations point to N3 capacity, advanced packaging and TPU/ASIC allocation as a supply-chain branch. Verify wafer starts, customer allocation, pricing and utilization from company/industry primary evidence; channel recirculation is not independent confirmation.' },
  { sym:'AVGO', name:'Broadcom', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] Custom ASIC/TPU demand is a system-economics thesis: networking, interconnect and software integration can determine deployment value. Verify customer commitments, LTA structure, margin/cash-flow conversion and power availability rather than treating AI CapEx alone as demand proof.' },
  { sym:'TSLA', name:'Tesla', sector:'Consumer', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] HANA relayed higher Optimus production ambitions and Chinese humanoid-robot scaling claims. Treat shipment/production numbers as hypotheses until filings, customer deployments and unit economics confirm; data collection and industrial validation remain the key bottlenecks.' },
  { sym:'BRK.B', name:'Berkshire Hathaway', sector:'Financials', index:'SP500' },
  { sym:'LLY', name:'Eli Lilly', sector:'Healthcare', index:'SP500' },
  { sym:'WMT', name:'Walmart', sector:'Consumer Defensive', index:'SP500' },
  { sym:'JPM', name:'JPMorgan Chase', sector:'Financials', index:'DOW30' },
  { sym:'V', name:'Visa', sector:'Financials', index:'SP500' },
  { sym:'XOM', name:'Exxon Mobil', sector:'Energy', index:'SP500' },
  { sym:'MA', name:'Mastercard', sector:'Financials', index:'SP500' },
  { sym:'UNH', name:'UnitedHealth', sector:'Healthcare', index:'DOW30' },
  { sym:'JNJ', name:'Johnson & Johnson', sector:'Healthcare', index:'DOW30' },
  { sym:'COST', name:'Costco', sector:'Consumer Defensive', index:'SP500' },
  { sym:'HD', name:'Home Depot', sector:'Consumer', index:'DOW30' },
  { sym:'PG', name:'Procter & Gamble', sector:'Consumer Defensive', index:'DOW30' },
  { sym:'ABBV', name:'AbbVie', sector:'Healthcare', index:'SP500' },
  { sym:'MRK', name:'Merck', sector:'Healthcare', index:'DOW30' },
  { sym:'CRM', name:'Salesforce', sector:'Technology', index:'DOW30' },
  { sym:'CVX', name:'Chevron', sector:'Energy', index:'DOW30' },
  { sym:'AMD', name:'Advanced Micro Devices', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] The bull case does not require displacing NVIDIA outright: sufficient performance, cost, software compatibility and committed deployments can win allocation. Verify accelerator demand, memory/packaging access, customer ramp and sector-relative strength; a low-volume rebound is not durable demand.' },
  { sym:'NFLX', name:'Netflix', sector:'Communication Services', index:'SP500' },
  { sym:'PEP', name:'PepsiCo', sector:'Consumer Defensive', index:'SP500' },
  { sym:'KO', name:'Coca-Cola', sector:'Consumer Defensive', index:'DOW30' },
  { sym:'MCD', name:'McDonald\'s', sector:'Consumer', index:'DOW30' },
  { sym:'TMO', name:'Thermo Fisher', sector:'Healthcare', index:'SP500' },
  { sym:'ADBE', name:'Adobe', sector:'Technology', index:'SP500' },
  { sym:'ORCL', name:'Oracle', sector:'Technology', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] Insider channel highlighted a reported CDS/liability stress signal alongside AI-capacity narratives. Credit risk requires current CDS, debt maturity, lease/funding and cash-flow evidence; a forwarded headline is not a solvency conclusion.' },
  { sym:'BAC', name:'Bank of America', sector:'Financials', index:'SP500' },
  { sym:'CSCO', name:'Cisco Systems', sector:'Technology', index:'DOW30' },
  { sym:'DIS', name:'Walt Disney', sector:'Communication Services', index:'DOW30' },
  { sym:'PLTR', name:'Palantir', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] AI adoption should be tested through repeatable workflow/token usage and customer economics, not user-count narratives alone. Separate software demand from the physical compute, memory and power bottlenecks that support it.' },
  { sym:'MU', name:'Micron Technology', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] Memory is a P/ASP-and-multiple cycle, while LTA/prepayment changes supply allocation and bargaining power. Verify DRAM/HBM spot and contract pricing, inventory, customer commitments and the risk that low P/E precedes a cycle rollover.' },
  { sym:'CAT', name:'Caterpillar', sector:'Industrials', index:'DOW30', memo:'[2026-08-09 TG-REFERENCE] HANA relayed a reported Michael Burry short position. This is positioning/context only, not a fundamental short signal; verify filing/position date, valuation, orders, end-market cycle and price/volume confirmation.' },
  { sym:'RTX', name:'Raytheon Tech', sector:'Industrials', index:'SP500' },
  { sym:'GS', name:'Goldman Sachs', sector:'Financials', index:'DOW30' },
  { sym:'GE', name:'GE Aerospace', sector:'Industrials', index:'DOW30' },
  { sym:'INTC', name:'Intel', sector:'Technology', index:'DOW30' },
  { sym:'LMT', name:'Lockheed Martin', sector:'Industrials', index:'SP500' },
  { sym:'ARM', name:'ARM Holdings', sector:'Technology', index:'SP500' },
  { sym:'QCOM', name:'Qualcomm', sector:'Technology', index:'SP500' },
  { sym:'PANW', name:'Palo Alto Networks', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] Cybersecurity leadership is a distinct software-demand branch. Verify recurring revenue, retention, margin/cash-flow conversion and valuation; peer strength or a high-volume move is not a standalone quality signal.' },
  { sym:'RBRK', name:'Rubrik', sector:'Technology', index:'NYSE', memo:'[2026-08-09 REFERENCE] Cybersecurity leadership is a separate software-demand branch from AI infrastructure. Verify recurring revenue, retention, margin/cash-flow conversion and valuation; a high-volume bounce or peer strength does not remove execution risk.' },
  { sym:'NOW', name:'ServiceNow', sector:'Technology', index:'SP500' },
  { sym:'CRWD', name:'CrowdStrike', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] Cybersecurity leadership needs confirmation through recurring revenue, retention, margin/cash-flow conversion and relative strength versus failed retests. Do not equate thematic leadership with an automatic entry.' },
  { sym:'CEG', name:'Constellation Energy', sector:'Utilities', index:'SP500', memo:'[2026-08-09 REFERENCE] AI power exposure is not only MWh: interconnection timing, PPA tenor/counterparty, ramp profile, transformer/grid constraints and local power pricing determine monetization. Treat power-quality claims as facility-specific until measured evidence is available.' },
  { sym:'BE', name:'Bloom Energy', sector:'Utilities', index:'NYSE', memo:'[2026-08-09 REFERENCE] Onsite/behind-the-meter power can shorten AI capacity timelines, but the thesis depends on measured load profile, fuel/electricity economics, contract quality, maintenance and power-quality controls. Do not infer grid damage or broad ratepayer impact from a single report.' },
  { sym:'HON', name:'Honeywell', sector:'Industrials', index:'DOW30' },
  { sym:'AMGN', name:'Amgen', sector:'Healthcare', index:'DOW30' },
  { sym:'IBM', name:'IBM', sector:'Technology', index:'DOW30' },
  { sym:'BA', name:'Boeing', sector:'Industrials', index:'DOW30' },
  { sym:'NKE', name:'Nike', sector:'Consumer', index:'DOW30' },
  { sym:'PFE', name:'Pfizer', sector:'Healthcare', index:'DOW30' },
  { sym:'AXP', name:'American Express', sector:'Financials', index:'DOW30' },
  { sym:'MMM', name:'3M', sector:'Industrials', index:'DOW30' },
  { sym:'VZ', name:'Verizon', sector:'Communication Services', index:'DOW30' },
  { sym:'TRV', name:'Travelers', sector:'Financials', index:'DOW30' },
  { sym:'DOW', name:'Dow Inc', sector:'Materials', index:'DOW30' },
  // ══════════════════════════════════════════════════════════════
  // S&P 500 — 추가 대형주
  // ══════════════════════════════════════════════════════════════
  { sym:'ASML', name:'ASML Holdings', sector:'Technology', index:'SP500' },
  { sym:'LIN', name:'Linde', sector:'Materials', index:'SP500' },
  { sym:'INTU', name:'Intuit', sector:'Technology', index:'SP500' },
  { sym:'BLK', name:'BlackRock', sector:'Financials', index:'SP500' },
  { sym:'ISRG', name:'Intuitive Surgical', sector:'Healthcare', index:'SP500' },
  { sym:'UBER', name:'Uber Technologies', sector:'Technology', index:'SP500' },
  { sym:'AMAT', name:'Applied Materials', sector:'Technology', index:'SP500' },
  { sym:'SLB', name:'Schlumberger', sector:'Energy', index:'SP500' },
  { sym:'T', name:'AT&T', sector:'Communication Services', index:'SP500' },
  { sym:'NEE', name:'NextEra Energy', sector:'Utilities', index:'SP500' },
  { sym:'LOW', name:'Lowe\'s', sector:'Consumer', index:'SP500' },
  { sym:'SPGI', name:'S&P Global', sector:'Financials', index:'SP500' },
  { sym:'DE', name:'Deere & Co', sector:'Industrials', index:'SP500' },
  { sym:'NOC', name:'Northrop Grumman', sector:'Industrials', index:'SP500' },
  { sym:'GD', name:'General Dynamics', sector:'Industrials', index:'SP500' },
  { sym:'HII', name:'Huntington Ingalls', sector:'Industrials', index:'SP500' },
  { sym:'WFC', name:'Wells Fargo', sector:'Financials', index:'SP500' },
  { sym:'MS', name:'Morgan Stanley', sector:'Financials', index:'SP500' },
  { sym:'COIN', name:'Coinbase', sector:'Financials', index:'SP500' },
  { sym:'VST', name:'Vistra', sector:'Utilities', index:'SP500', memo:'[2026-08-09 REFERENCE] AI power monetization requires separating contracted generation economics from interconnection, ramp-rate, transmission and local congestion constraints. Verify PPA/anchor-tenant evidence, capacity availability and financing.' },
  { sym:'MRNA', name:'Moderna', sector:'Healthcare', index:'SP500' },
  { sym:'SQ', name:'Block Inc', sector:'Financials', index:'SP500' },
  { sym:'COP', name:'ConocoPhillips', sector:'Energy', index:'SP500' },
  { sym:'SBUX', name:'Starbucks', sector:'Consumer', index:'SP500' },
  { sym:'BROS', name:'Dutch Bros', sector:'Consumer', index:'SMID' },
  { sym:'GILD', name:'Gilead Sciences', sector:'Healthcare', index:'SP500' },
  // ══════════════════════════════════════════════════════════════
  // NASDAQ-100 전용 (S&P500 미포함 또는 나스닥 특성 강조)
  // ══════════════════════════════════════════════════════════════
  { sym:'MRVL', name:'Marvell Technology', sector:'Technology', index:'NASDAQ100', memo:'[2026-08-09 REFERENCE] AI heterogeneity and custom silicon increase the importance of interconnect, networking and integration layers. Verify design wins, customer concentration, delivery timing, margin/cash-flow conversion and relative strength; partnership headlines alone are not proof of structural necessity.' },
  { sym:'SNPS', name:'Synopsys', sector:'Technology', index:'NASDAQ100' },
  { sym:'CDNS', name:'Cadence Design', sector:'Technology', index:'NASDAQ100' },
  { sym:'LRCX', name:'Lam Research', sector:'Technology', index:'NASDAQ100' },
  { sym:'KLAC', name:'KLA Corporation', sector:'Technology', index:'NASDAQ100' },
  { sym:'REGN', name:'Regeneron', sector:'Healthcare', index:'NASDAQ100' },
  { sym:'VRTX', name:'Vertex Pharma', sector:'Healthcare', index:'NASDAQ100' },
  { sym:'FTNT', name:'Fortinet', sector:'Technology', index:'NASDAQ100' },
  { sym:'MELI', name:'MercadoLibre', sector:'Technology', index:'NASDAQ100' },
  { sym:'DDOG', name:'Datadog', sector:'Technology', index:'NASDAQ100', memo:'[2026-08-09 REFERENCE] Software leadership is confirmed by durable usage, retention, margin and cash-flow conversion. Treat peer strength and cyber/observability rotation as a research lead, then verify valuation and earnings reaction.' },
  { sym:'SNOW', name:'Snowflake', sector:'Technology', index:'NASDAQ100' },
  { sym:'ZS', name:'Zscaler', sector:'Technology', index:'NASDAQ100' },
  { sym:'TTD', name:'The Trade Desk', sector:'Technology', index:'NASDAQ100' },
  { sym:'SMCI', name:'Super Micro Computer', sector:'Technology', index:'NASDAQ100' },
  { sym:'IONQ', name:'IonQ', sector:'Technology', index:'NASDAQ100' },
  { sym:'RKLB', name:'Rocket Lab USA', sector:'Industrials', index:'NASDAQ100' },
  { sym:'ASTS', name:'AST SpaceMobile', sector:'Technology', index:'NASDAQ100' },
  // ══════════════════════════════════════════════════════════════
  // Russell 2000 — 주요 소형주
  // ══════════════════════════════════════════════════════════════
  { sym:'RGTI', name:'Rigetti Computing', sector:'Technology', index:'RUSSELL2000' },
  { sym:'XNDU', name:'Xanadu Quantum', sector:'Technology', index:'NASDAQ' },
  { sym:'AMKR', name:'Amkor Technology', sector:'Technology', index:'NASDAQ' },
  { sym:'PLAB', name:'Photronics', sector:'Technology', index:'NASDAQ' },
  { sym:'ASX', name:'ASE Technology', sector:'Technology', index:'NYSE' },
  { sym:'LUNR', name:'Intuitive Machines', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'SMR', name:'NuScale Power', sector:'Utilities', index:'RUSSELL2000' },
  { sym:'CLS', name:'Celestica', sector:'Technology', index:'NYSE' },
  { sym:'FN', name:'Fabrinet', sector:'Technology', index:'NYSE' },
  { sym:'ONTO', name:'Onto Innovation', sector:'Technology', index:'NASDAQ' },
  { sym:'AFRM', name:'Affirm Holdings', sector:'Financials', index:'RUSSELL2000' },
  { sym:'SOFI', name:'SoFi Technologies', sector:'Financials', index:'RUSSELL2000' },
  { sym:'UPST', name:'Upstart Holdings', sector:'Financials', index:'RUSSELL2000' },
  { sym:'RIOT', name:'Riot Platforms', sector:'Financials', index:'RUSSELL2000' },
  { sym:'MARA', name:'Marathon Digital', sector:'Financials', index:'RUSSELL2000' },
  { sym:'RDW', name:'Redwire', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'JOBY', name:'Joby Aviation', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'DNA', name:'Ginkgo Bioworks', sector:'Healthcare', index:'RUSSELL2000' },
  { sym:'QUBT', name:'Quantum Computing', sector:'Technology', index:'RUSSELL2000' },
  { sym:'CAVA', name:'CAVA Group', sector:'Consumer', index:'RUSSELL2000' },
  { sym:'SOUN', name:'SoundHound AI', sector:'Technology', index:'RUSSELL2000' },
  { sym:'CRWV', name:'CoreWeave', sector:'Technology', index:'NASDAQ100', memo:'[2026-08-09 REFERENCE] Neocloud is a Q·capital game: utilization/backlog must outrun rental-price deflation while GPU depreciation, leases, funding cost, power access and counterparty concentration remain survivable. Verify current spread, runway, renewal pricing and contract quality.' },
  { sym:'NBIS', name:'Nebius Group', sector:'Technology', index:'NASDAQ100', memo:'[2026-08-09 REFERENCE] Neocloud setup requires both utilization economics and price/volume structure. For a supply-side short, require overhead supply, failed reclaim/retest and borrow/flow evidence; never infer a short from relative weakness alone.' },
  { sym:'IREN', name:'IREN Limited', sector:'Technology', index:'RUSSELL2000', memo:'[2026-08-09 REFERENCE] Power-cost/site optionality can matter for neocloud economics, but utilization, customer contract funding, GPU depreciation, grid/interconnection and execution remain the kill switches.' },
  { sym:'CORZ', name:'Core Scientific', sector:'Technology', index:'NASDAQ' },
  { sym:'BIRD', name:'Allbirds', sector:'Consumer', index:'RUSSELL2000' },
  { sym:'DM', name:'Desktop Metal', sector:'Technology', index:'RUSSELL2000' },
  // ══════════════════════════════════════════════════════════════
  // HOT / 트렌딩 / 주도주 — 시가총액 무관, 시장 관심도 높은 종목
  // ══════════════════════════════════════════════════════════════
  // ── AI / 광학 / 데이터센터 인프라 ──
  { sym:'AAOI', name:'Applied Optoelectronics', sector:'Technology', index:'RUSSELL2000' },
  { sym:'COHR', name:'Coherent Corp', sector:'Technology', index:'SP500' },
  { sym:'LITE', name:'Lumentum', sector:'Technology', index:'NASDAQ100' },
  { sym:'CRDO', name:'Credo Technology', sector:'Technology', index:'NASDAQ100' },
  { sym:'POET', name:'POET Technologies', sector:'Technology', index:'OTC' },
  { sym:'CIEN', name:'Ciena', sector:'Technology', index:'SP500' },
  { sym:'GLW', name:'Corning', sector:'Technology', index:'SP500' },
  { sym:'VRT', name:'Vertiv Holdings', sector:'Industrials', index:'SP500', memo:'[2026-08-09 REFERENCE] AI data-center bottleneck lens: cooling, power distribution and rack-level delivery benefit from rising compute density, but validate backlog, margin, project timing and customer power availability. Total demand is not the same as executable site capacity.' },
  { sym:'DELL', name:'Dell Technologies', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] AI server demand should be decomposed into backlog conversion, GPU/memory availability, delivery margin, working capital and customer power readiness. Shipment headlines are weaker evidence than cash conversion and renewal economics.' },
  { sym:'HPE', name:'Hewlett Packard Enterprise', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] AI systems thesis requires server/cluster demand plus financing, networking, cooling and power-delivery execution. Verify backlog quality, margin/cash-flow conversion and deployment timing; a capacity announcement is not utilization proof.' },
  // ── 헬스케어 / 비만치료 / 텔레헬스 ──
  { sym:'HIMS', name:'Hims & Hers Health', sector:'Healthcare', index:'RUSSELL2000' },
  { sym:'AEHR', name:'Aehr Test Systems', sector:'Technology', index:'RUSSELL2000' },
  { sym:'VIAV', name:'Viavi Solutions', sector:'Technology', index:'RUSSELL2000' },
  // ── 소셜미디어 / 플랫폼 / 미디어 ──
  { sym:'RDDT', name:'Reddit', sector:'Communication Services', index:'SP500' },
  { sym:'PINS', name:'Pinterest', sector:'Communication Services', index:'SP500' },
  { sym:'SNAP', name:'Snap Inc', sector:'Communication Services', index:'SP500' },
  { sym:'RBLX', name:'Roblox', sector:'Communication Services', index:'SP500' },
  { sym:'SPOT', name:'Spotify', sector:'Communication Services', index:'SP500' },
  // ── AI 인프라 / 소프트웨어 ──
  { sym:'TEM', name:'Tempus AI', sector:'Healthcare', index:'NASDAQ100' },
  { sym:'AI', name:'C3.ai', sector:'Technology', index:'NASDAQ100' },
  { sym:'PATH', name:'UiPath', sector:'Technology', index:'SP500' },
  { sym:'CFLT', name:'Confluent', sector:'Technology', index:'NASDAQ100' },
  { sym:'CRSP', name:'CRISPR Therapeutics', sector:'Healthcare', index:'NASDAQ100' },
  { sym:'NET', name:'Cloudflare', sector:'Technology', index:'SP500' },
  { sym:'MDB', name:'MongoDB', sector:'Technology', index:'NASDAQ100' },
  { sym:'GTLB', name:'GitLab', sector:'Technology', index:'NASDAQ100' },
  { sym:'ESTC', name:'Elastic', sector:'Technology', index:'SP500' },
  // ── 핀테크 / 결제 / 크립토 ──
  { sym:'HOOD', name:'Robinhood', sector:'Financials', index:'NASDAQ100' },
  { sym:'SQ', name:'Block Inc (SQ)', sector:'Financials', index:'SP500' },
  { sym:'MSTR', name:'MicroStrategy', sector:'Technology', index:'NASDAQ100' },
  // ── 전력 / 에너지 / 원전 ──
  { sym:'NRG', name:'NRG Energy', sector:'Utilities', index:'SP500' },
  { sym:'CCJ', name:'Cameco', sector:'Energy', index:'SP500' },
  { sym:'OKLO', name:'Oklo Inc', sector:'Utilities', index:'RUSSELL2000' },
  { sym:'TLN', name:'Talen Energy', sector:'Utilities', index:'SP500' },
  // ── 자동차 / 모빌리티 ──
  { sym:'RIVN', name:'Rivian Automotive', sector:'Consumer', index:'NASDAQ100' },
  { sym:'LCID', name:'Lucid Group', sector:'Consumer', index:'NASDAQ100' },
  { sym:'GM', name:'General Motors', sector:'Consumer', index:'SP500' },
  { sym:'F', name:'Ford Motor', sector:'Consumer', index:'SP500' },
  // ── 우주 / 방산 확장 ──
  { sym:'PL', name:'Planet Labs', sector:'Technology', index:'RUSSELL2000' },
  // ── 우주 순수 플레이 (2026 확장) ──
  { sym:'NVTS', name:'Navitas Semiconductor', sector:'Technology', index:'NASDAQ' },
  { sym:'WOLF', name:'Wolfspeed', sector:'Technology', index:'NYSE' },
  { sym:'FLY', name:'Firefly Aerospace', sector:'Industrials', index:'NYSE' },
  { sym:'VOYG', name:'Voyager Technologies', sector:'Industrials', index:'NYSE' },
  { sym:'KRMN', name:'Karman Holdings', sector:'Industrials', index:'NYSE' },
  { sym:'BKSY', name:'BlackSky', sector:'Technology', index:'NYSE' },
  { sym:'IRDM', name:'Iridium', sector:'Communication Services', index:'NASDAQ' },
  { sym:'VSAT', name:'Viasat', sector:'Communication Services', index:'NASDAQ' },
  { sym:'SATS', name:'EchoStar', sector:'Communication Services', index:'NASDAQ' },
  { sym:'GSAT', name:'Globalstar', sector:'Communication Services', index:'NYSE' },
  { sym:'SPIR', name:'Spire Global', sector:'Technology', index:'NYSE' },
  { sym:'SATL', name:'Satellogic', sector:'Technology', index:'NASDAQ' },
  // SPCE removed — Virgin Galactic defunct, replaced by LUNR/RDW (already in DB above)
  // ── 게임 / 엔터테인먼트 ──
  { sym:'EA', name:'Electronic Arts', sector:'Communication Services', index:'SP500' },
  { sym:'TTWO', name:'Take-Two Interactive', sector:'Communication Services', index:'SP500' },
  // ── 소비재 / 리테일 / 라이프스타일 ──
  { sym:'LULU', name:'Lululemon', sector:'Consumer', index:'SP500' },
  { sym:'DECK', name:'Deckers Outdoor', sector:'Consumer', index:'SP500' },
  { sym:'CELH', name:'Celsius Holdings', sector:'Consumer Defensive', index:'NASDAQ100' },
  { sym:'ONON', name:'On Holding', sector:'Consumer', index:'SP500' },
  // ── 방어적 배당 / 인프라 ──
  { sym:'TRGP', name:'Targa Resources', sector:'Energy', index:'SP500' },
  { sym:'WMB', name:'Williams Companies', sector:'Energy', index:'SP500' },
  { sym:'SEI', name:'Solaris Energy Infrastructure', sector:'Energy', index:'SP500' },
  { sym:'LBRT', name:'Liberty Energy', sector:'Energy', index:'SP500' },
  { sym:'KMI', name:'Kinder Morgan', sector:'Energy', index:'SP500' },
  // ── 산업재 / 건설 / 광업 ──
  { sym:'URI', name:'United Rentals', sector:'Industrials', index:'SP500' },
  { sym:'FCX', name:'Freeport-McMoRan', sector:'Materials', index:'SP500' },
  { sym:'NUE', name:'Nucor', sector:'Materials', index:'SP500', memo:'[2026-08-09 REFERENCE] Steel strength is a sector-relative leadership observation, not an AI inference. Verify order book, shipments, realized pricing, input costs, margins and volume-backed continuation.' },
  { sym:'RS', name:'Reliance, Inc.', sector:'Materials', index:'SP500', memo:'[2026-08-09 REFERENCE] Steel/metal distribution strength is a relative-strength lead. Confirm with operating data, margin/cycle exposure, support/retest behavior and volume; do not promote a chart observation to a fundamental thesis without filings.' },
  // ── 기타 주목 종목 ──
  { sym:'SHOP', name:'Shopify', sector:'Technology', index:'SP500' },
  { sym:'ABNB', name:'Airbnb', sector:'Consumer', index:'SP500' },
  { sym:'DASH', name:'DoorDash', sector:'Technology', index:'SP500' },
  { sym:'ROKU', name:'Roku', sector:'Communication Services', index:'NASDAQ100' },
  { sym:'DUOL', name:'Duolingo', sector:'Technology', index:'NASDAQ100' },
  { sym:'APP', name:'AppLovin', sector:'Technology', index:'SP500' },
  { sym:'AXON', name:'Axon Enterprise', sector:'Industrials', index:'SP500' },
  { sym:'WDAY', name:'Workday', sector:'Technology', index:'SP500' },
  { sym:'MNDY', name:'Monday.com', sector:'Technology', index:'NASDAQ100' },
  { sym:'BKNG', name:'Booking Holdings', sector:'Consumer', index:'SP500' },
  { sym:'TOST', name:'Toast', sector:'Technology', index:'SP500' },
  { sym:'GRAB', name:'Grab Holdings', sector:'Technology', index:'NASDAQ100' },
  { sym:'SE', name:'Sea Limited', sector:'Technology', index:'SP500' },
  { sym:'NU', name:'Nu Holdings', sector:'Financials', index:'SP500' },
  { sym:'PYPL', name:'PayPal', sector:'Financials', index:'SP500' },
  { sym:'GME', name:'GameStop', sector:'Consumer', index:'RUSSELL2000' },
  { sym:'AMC', name:'AMC Entertainment', sector:'Communication Services', index:'RUSSELL2000' },
  { sym:'PLBY', name:'PLBY Group', sector:'Consumer', index:'RUSSELL2000' },
  { sym:'IWM', name:'iShares Russell 2000 ETF', sector:'Financials', index:'RUSSELL2000' },
  { sym:'DIA', name:'SPDR Dow Jones ETF', sector:'Financials', index:'DOW30' },
  { sym:'BRK-B', name:'Berkshire Hathaway B', sector:'Financials', index:'SP500' },
  { sym:'ABT', name:'Abbott Laboratories', sector:'Healthcare', index:'SP500' },
  { sym:'PM', name:'Philip Morris', sector:'Consumer Defensive', index:'SP500' },
  { sym:'PGR', name:'Progressive Corp', sector:'Financials', index:'SP500' },
  { sym:'UNP', name:'Union Pacific', sector:'Industrials', index:'SP500' },
  { sym:'TJX', name:'TJX Companies', sector:'Consumer', index:'SP500' },
  { sym:'C', name:'Citigroup', sector:'Financials', index:'SP500' },
  { sym:'SCHW', name:'Charles Schwab', sector:'Financials', index:'SP500' },
  { sym:'ADP', name:'Automatic Data Processing', sector:'Technology', index:'SP500' },
  { sym:'BMY', name:'Bristol Myers Squibb', sector:'Healthcare', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] Insider relayed an FT-reported M&A discussion involving AstraZeneca/BMS. Treat as unconfirmed corporate-action context until company filings or authoritative reports confirm parties, terms, probability and regulatory path.' },
  { sym:'PLD', name:'Prologis', sector:'Real Estate', index:'SP500' },
  { sym:'BSX', name:'Boston Scientific', sector:'Healthcare', index:'SP500' },
  { sym:'ADI', name:'Analog Devices', sector:'Technology', index:'SP500' },
  { sym:'MDLZ', name:'Mondelez', sector:'Consumer Defensive', index:'SP500' },
  { sym:'CI', name:'Cigna Group', sector:'Healthcare', index:'SP500' },
  { sym:'SYK', name:'Stryker Corp', sector:'Healthcare', index:'SP500' },
  { sym:'WM', name:'Waste Management', sector:'Utilities', index:'SP500' },
  { sym:'DUK', name:'Duke Energy', sector:'Utilities', index:'SP500' },
  { sym:'CME', name:'CME Group', sector:'Financials', index:'SP500' },
  { sym:'EOG', name:'EOG Resources', sector:'Energy', index:'SP500' },
  { sym:'AON', name:'Aon', sector:'Financials', index:'SP500' },
  { sym:'CL', name:'Colgate-Palmolive', sector:'Consumer Defensive', index:'SP500' },
  { sym:'ICE', name:'Intercontinental Exchange', sector:'Financials', index:'SP500' },
  { sym:'MSI', name:'Motorola Solutions', sector:'Technology', index:'SP500' },
  { sym:'APH', name:'Amphenol', sector:'Technology', index:'NASDAQ100' },
  { sym:'NSC', name:'Norfolk Southern', sector:'Industrials', index:'SP500' },
  { sym:'CTAS', name:'Cintas', sector:'Industrials', index:'SP500' },
  { sym:'ORLY', name:'O\'Reilly Automotive', sector:'Consumer', index:'SP500' },
  { sym:'AZO', name:'AutoZone', sector:'Consumer', index:'SP500' },
  { sym:'MCK', name:'McKesson', sector:'Healthcare', index:'SP500' },
  { sym:'MCO', name:'Moody\'s', sector:'Financials', index:'SP500' },
  { sym:'MAR', name:'Marriott International', sector:'Consumer', index:'SP500' },
  { sym:'MMC', name:'Marsh McLennan', sector:'Financials', index:'SP500' },
  { sym:'AIG', name:'American International Group', sector:'Financials', index:'SP500' },
  { sym:'SHW', name:'Sherwin-Williams', sector:'Materials', index:'SP500' },
  { sym:'FI', name:'Fastenal', sector:'Industrials', index:'SP500' },
  { sym:'SPG', name:'Simon Property Group', sector:'Real Estate', index:'SP500' },
  { sym:'WELL', name:'Welltower', sector:'Real Estate', index:'SP500' },
  { sym:'AFL', name:'Aflac', sector:'Financials', index:'SP500' },
  { sym:'ECL', name:'Ecolab', sector:'Industrials', index:'SP500' },
  { sym:'MET', name:'MetLife', sector:'Financials', index:'SP500' },
  { sym:'PRU', name:'Prudential Financial', sector:'Financials', index:'SP500' },
  { sym:'TROW', name:'T. Rowe Price', sector:'Financials', index:'SP500' },
  { sym:'TGT', name:'Target', sector:'Consumer', index:'SP500' },
  { sym:'EBAY', name:'eBay', sector:'Consumer', index:'SP500' },
  { sym:'PCAR', name:'PACCAR Inc', sector:'Industrials', index:'SP500' },
  { sym:'DD', name:'DuPont de Nemours', sector:'Materials', index:'SP500' },
  { sym:'HCA', name:'HCA Healthcare', sector:'Healthcare', index:'SP500' },
  { sym:'ROP', name:'Roper Technologies', sector:'Industrials', index:'SP500' },
  { sym:'DHR', name:'Danaher', sector:'Industrials', index:'SP500' },
  { sym:'A', name:'Avantor', sector:'Healthcare', index:'SP500' },
  { sym:'CMG', name:'Chipotle Mexican Grill', sector:'Consumer', index:'SP500' },
  { sym:'CARR', name:'Carrier Global', sector:'Industrials', index:'SP500' },
  { sym:'MNST', name:'Monster Beverage', sector:'Consumer Defensive', index:'SP500' },
  { sym:'PSA', name:'Public Storage', sector:'Real Estate', index:'SP500' },
  { sym:'KHC', name:'Kraft Heinz', sector:'Consumer Defensive', index:'SP500' },
  { sym:'AEP', name:'American Electric Power', sector:'Utilities', index:'SP500' },
  { sym:'O', name:'Realty Income', sector:'Real Estate', index:'SP500' },
  { sym:'SRE', name:'Sempra Energy', sector:'Utilities', index:'SP500' },
  { sym:'EXC', name:'Exelon', sector:'Utilities', index:'SP500' },
  { sym:'WEC', name:'WEC Energy Group', sector:'Utilities', index:'SP500' },
  { sym:'SYY', name:'Sysco', sector:'Consumer Defensive', index:'SP500' },
  { sym:'YUM', name:'YUM! Brands', sector:'Consumer', index:'SP500' },
  { sym:'HUM', name:'Humana', sector:'Healthcare', index:'SP500' },
  { sym:'IDXX', name:'IDEXX Laboratories', sector:'Healthcare', index:'SP500' },
  { sym:'PAYX', name:'Paychex', sector:'Technology', index:'SP500' },
  { sym:'IQV', name:'IQVIA Holdings', sector:'Healthcare', index:'SP500' },
  { sym:'BK', name:'The Bank of New York Mellon', sector:'Financials', index:'SP500' },
  { sym:'STZ', name:'Constellation Brands', sector:'Consumer Defensive', index:'SP500' },
  { sym:'CNC', name:'Centene', sector:'Healthcare', index:'SP500' },
  { sym:'NXPI', name:'NXP Semiconductors', sector:'Technology', index:'SP500' },
  { sym:'GPN', name:'Global Payments', sector:'Technology', index:'SP500' },
  { sym:'CTSH', name:'Cognizant', sector:'Technology', index:'SP500' },
  { sym:'MSCI', name:'MSCI Inc', sector:'Financials', index:'SP500' },
  { sym:'OTIS', name:'Otis Worldwide', sector:'Industrials', index:'SP500' },
  { sym:'KEYS', name:'Keysight Technologies', sector:'Technology', index:'SP500' },
  { sym:'TDG', name:'Transdigm Group', sector:'Industrials', index:'SP500' },
  { sym:'STE', name:'Steris plc', sector:'Industrials', index:'SP500' },
  { sym:'COF', name:'Capital One', sector:'Financials', index:'SP500' },
  { sym:'RMD', name:'ResMed', sector:'Healthcare', index:'SP500' },
  { sym:'VRSK', name:'Verisk Analytics', sector:'Financials', index:'SP500' },
  { sym:'EFX', name:'Equifax', sector:'Financials', index:'SP500' },
  { sym:'HUBB', name:'Hubbell Inc', sector:'Industrials', index:'SP500' },

  // ═══ v33.1: 시총 $10B+ 전종목 + 핵심 ETF + 유명 소형주 (368개) ═══
  { sym:'GOOG', name:'Alphabet Class C', sector:'Technology', index:'SP500' },
  { sym:'GEV', name:'GE Vernova', sector:'Utilities', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] Aether/BornLupin/HANA themes point to data-center power, grid, transmission and ESS constraints. Verify equipment backlog, utility orders, project timing, margin and permitted interconnection; announced demand is not recognized revenue.' },
  { sym:'TMUS', name:'T-Mobile US', sector:'Communication Services', index:'SP500' },
  { sym:'TXN', name:'Texas Instruments', sector:'Technology', index:'SP500' },
  { sym:'ANET', name:'Arista Networks', sector:'Technology', index:'SP500' },
  { sym:'ETN', name:'Eaton Corp', sector:'Industrials', index:'SP500', memo:'[2026-08-09 REFERENCE] Grid/AI data-center exposure is a power-quality and equipment-cycle thesis: switchgear, transformers and distribution must handle density and load volatility. Verify orders, lead times, margin and actual interconnection demand.' },
  { sym:'NVT', name:'nVent Electric', sector:'Industrials', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] Power-quality and high-density data-center equipment are a downstream beneficiary hypothesis. Verify enclosure/distribution backlog, pricing, lead times, thermal requirements and customer/site readiness.' },
  { sym:'CB', name:'Chubb Ltd', sector:'Financials', index:'SP500' },
  { sym:'ACN', name:'Accenture', sector:'Technology', index:'SP500' },
  { sym:'PH', name:'Parker-Hannifin', sector:'Industrials', index:'SP500' },
  { sym:'MDT', name:'Medtronic', sector:'Healthcare', index:'SP500' },
  { sym:'MO', name:'Altria Group', sector:'Consumer Defensive', index:'SP500' },
  { sym:'NEM', name:'Newmont Corp', sector:'Materials', index:'SP500' },
  { sym:'SO', name:'Southern Company', sector:'Utilities', index:'SP500' },
  { sym:'CMCSA', name:'Comcast', sector:'Communication Services', index:'SP500' },
  { sym:'SNDK', name:'SanDisk', sector:'Technology', index:'SP500', memo:'[2026-07-20 REFERENCE] AI memory/storage belongs to the P-game lens: pricing momentum, mix and multiple compression must be checked against inference demand and supply.' },
  { sym:'WDC', name:'Western Digital', sector:'Technology', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] HANA/Insider memory posts emphasize LTA, NAND pricing and AI-storage demand. Verify contract coverage, spot/contract spread, inventory, customer concentration and cycle rollover; target-price recirculation is not evidence.' },
  { sym:'HWM', name:'Howmet Aerospace', sector:'Industrials', index:'SP500' },
  { sym:'EQIX', name:'Equinix', sector:'Real Estate', index:'SP500' },
  { sym:'TT', name:'Trane Technologies', sector:'Industrials', index:'SP500' },
  { sym:'CVS', name:'CVS Health', sector:'Healthcare', index:'SP500' },
  { sym:'STX', name:'Seagate Tech', sector:'Technology', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] AI inference/storage demand should be tested through exabyte shipments, pricing, mix, cloud customers and cash conversion. Telegram storage commentary is a discovery lead, not a current demand estimate.' },
  { sym:'SIMO', name:'Silicon Motion', sector:'Technology', index:'NASDAQ' },
  { sym:'6600.T', name:'Kioxia Holdings', sector:'Technology', index:'TSE', memo:'[2026-08-09 TG-REFERENCE] Insider highlighted PCIe 6.0/UFS 5.0 NAND roadmap claims. Verify mass-production timing, qualification, customer design wins, yield and NAND pricing from company/industry evidence.' },
  { sym:'8035.T', name:'Tokyo Electron', sector:'Technology', index:'TSE' },
  { sym:'6702.T', name:'Fujitsu', sector:'Technology', index:'TSE' },
  { sym:'FDX', name:'FedEx', sector:'Industrials', index:'SP500' },
  { sym:'PWR', name:'Quanta Services', sector:'Industrials', index:'SP500', memo:'[2026-08-09 REFERENCE] AI capacity bottlenecks can migrate from chips to transmission, substations and interconnection queues. Track backlog conversion, permitting, utility capex and project execution; headline queue size is not revenue.' },
  { sym:'POWL', name:'Powell Industries', sector:'Industrials', index:'NASDAQ' },
  { sym:'MTZ', name:'MasTec', sector:'Industrials', index:'SP500' },
  { sym:'MRSH', name:'Marsh McLennan', sector:'Financials', index:'SP500' },
  { sym:'UPS', name:'UPS', sector:'Industrials', index:'SP500' },
  { sym:'PNC', name:'PNC Financial', sector:'Financials', index:'SP500' },
  { sym:'BX', name:'Blackstone', sector:'Financials', index:'SP500' },
  { sym:'AMT', name:'American Tower', sector:'Real Estate', index:'SP500' },
  { sym:'JCI', name:'Johnson Controls', sector:'Industrials', index:'SP500' },
  { sym:'KKR', name:'KKR & Co', sector:'Financials', index:'SP500' },
  { sym:'USB', name:'US Bancorp', sector:'Financials', index:'SP500' },
  { sym:'ITW', name:'Illinois Tool Works', sector:'Industrials', index:'SP500' },
  { sym:'CMI', name:'Cummins', sector:'Industrials', index:'SP500' },
  { sym:'KEX', name:'Kirby Corp', sector:'Industrials', index:'SP500' },
  { sym:'RCL', name:'Royal Caribbean', sector:'Consumer', index:'SP500' },
  { sym:'EMR', name:'Emerson Electric', sector:'Industrials', index:'SP500' },
  { sym:'CSX', name:'CSX Corp', sector:'Industrials', index:'SP500' },
  { sym:'PSX', name:'Phillips 66', sector:'Energy', index:'SP500', memo:'[2026-08-09 REFERENCE] Refinery strength must be decomposed into crack spread, inventory, utilization, turnaround and regional basis. Lower crude is only one input and does not by itself prove durable earnings.' },
  { sym:'DINO', name:'HF Sinclair', sector:'Energy', index:'NYSE', memo:'[2026-08-09 REFERENCE] Refiners can benefit from lower crude input costs only through the full crack-spread, inventory, utilization and turnaround chain. Separate crude-price beta from product demand, regional basis and maintenance risk.' },
  { sym:'VLO', name:'Valero Energy', sector:'Energy', index:'SP500', memo:'[2026-08-09 REFERENCE] Refiner relative strength can persist without crude confirmation, but the operating bridge is crack spreads, product demand, inventory, utilization and maintenance. Use price action as a lead, not a conclusion.' },
  { sym:'CRH', name:'CRH plc', sector:'Materials', index:'SP500' },
  { sym:'HLT', name:'Hilton', sector:'Consumer', index:'SP500' },
  { sym:'ROST', name:'Ross Stores', sector:'Consumer', index:'SP500' },
  { sym:'MPC', name:'Marathon Petroleum', sector:'Energy', index:'SP500', memo:'[2026-08-09 REFERENCE] Refinery leadership requires a full crack-spread and operating check: product demand, inventory, utilization, turnaround and regional basis. Separate a lower-crude tailwind from durable cash-flow evidence.' },
  { sym:'WBD', name:'Warner Bros Discovery', sector:'Communication Services', index:'SP500' },
  { sym:'RSG', name:'Republic Services', sector:'Industrials', index:'SP500' },
  { sym:'LHX', name:'L3Harris Tech', sector:'Industrials', index:'SP500' },
  { sym:'APO', name:'Apollo Global', sector:'Financials', index:'SP500' },
  { sym:'ELV', name:'Elevance Health', sector:'Healthcare', index:'SP500' },
  { sym:'COR', name:'Cencora', sector:'Healthcare', index:'SP500' },
  { sym:'APD', name:'Air Products', sector:'Materials', index:'SP500' },
  { sym:'BKR', name:'Baker Hughes', sector:'Energy', index:'SP500' },
  { sym:'DLR', name:'Digital Realty', sector:'Real Estate', index:'SP500' },
  { sym:'OXY', name:'Occidental Petroleum', sector:'Energy', index:'SP500' },
  { sym:'TEL', name:'TE Connectivity', sector:'Technology', index:'SP500' },
  { sym:'OKE', name:'ONEOK', sector:'Energy', index:'SP500' },
  { sym:'TFC', name:'Truist Financial', sector:'Financials', index:'SP500' },
  { sym:'AJG', name:'Arthur J Gallagher', sector:'Financials', index:'SP500' },
  { sym:'FANG', name:'Diamondback Energy', sector:'Energy', index:'SP500' },
  { sym:'ALL', name:'Allstate', sector:'Financials', index:'SP500' },
  { sym:'MPWR', name:'Monolithic Power', sector:'Technology', index:'SP500' },
  { sym:'CTVA', name:'Corteva', sector:'Materials', index:'SP500' },
  { sym:'ADSK', name:'Autodesk', sector:'Technology', index:'SP500' },
  { sym:'D', name:'Dominion Energy', sector:'Utilities', index:'SP500' },
  { sym:'FAST', name:'Fastenal', sector:'Industrials', index:'SP500' },
  { sym:'GWW', name:'W.W. Grainger', sector:'Industrials', index:'SP500' },
  { sym:'FIX', name:'Comfort Systems USA', sector:'Industrials', index:'SP500' },
  { sym:'NDAQ', name:'Nasdaq Inc', sector:'Financials', index:'SP500' },
  { sym:'AME', name:'AMETEK', sector:'Industrials', index:'SP500' },
  { sym:'ZTS', name:'Zoetis', sector:'Healthcare', index:'SP500' },
  { sym:'CAH', name:'Cardinal Health', sector:'Healthcare', index:'SP500' },
  { sym:'XEL', name:'Xcel Energy', sector:'Utilities', index:'SP500' },
  { sym:'TER', name:'Teradyne', sector:'Technology', index:'NASDAQ100' },
  { sym:'MTK', name:'MediaTek', sector:'Technology', index:'TWSE', memo:'[2026-08-09 TG-REFERENCE] Insider/HANA relayed Google TPU supply-chain participation and future-node demand. Verify design-win status, tape-out/production timing, fee economics and customer concentration; forecast unit counts remain reference-only.' },
  { sym:'EW', name:'Edwards Lifesciences', sector:'Healthcare', index:'SP500' },
  { sym:'ETR', name:'Entergy', sector:'Utilities', index:'SP500' },
  { sym:'GRMN', name:'Garmin', sector:'Technology', index:'SP500' },
  { sym:'BDX', name:'BD (Becton Dickinson)', sector:'Healthcare', index:'SP500' },
  { sym:'KR', name:'Kroger', sector:'Consumer Defensive', index:'SP500' },
  { sym:'HSY', name:'Hershey', sector:'Consumer Defensive', index:'SP500' },
  { sym:'CVNA', name:'Carvana', sector:'Consumer', index:'SP500', memo:'[2026-08-09 REFERENCE] Supply-side short research needs overhead supply, failed reclaim/retest, volume/borrow/flow evidence and a defined invalidation. Relative weakness alone is not a short trigger.' },
  { sym:'DAL', name:'Delta Air Lines', sector:'Industrials', index:'SP500' },
  { sym:'WAB', name:'Wabtec', sector:'Industrials', index:'SP500' },
  { sym:'FITB', name:'Fifth Third Bancorp', sector:'Financials', index:'SP500' },
  { sym:'EQT', name:'EQT Corporation', sector:'Energy', index:'SP500' },
  { sym:'AMP', name:'Ameriprise Financial', sector:'Financials', index:'SP500' },
  { sym:'CBRE', name:'CBRE Group', sector:'Real Estate', index:'SP500' },
  { sym:'ROK', name:'Rockwell Automation', sector:'Industrials', index:'SP500' },
  { sym:'DHI', name:'DR Horton', sector:'Consumer', index:'SP500' },
  { sym:'PEG', name:'PSEG', sector:'Utilities', index:'SP500' },
  { sym:'ED', name:'Consolidated Edison', sector:'Utilities', index:'SP500' },
  { sym:'FICO', name:'Fair Isaac Corp', sector:'Technology', index:'SP500' },
  { sym:'GIS', name:'General Mills', sector:'Consumer Defensive', index:'SP500' },
  { sym:'DOV', name:'Dover Corp', sector:'Industrials', index:'SP500' },
  { sym:'ANSS', name:'ANSYS', sector:'Technology', index:'SP500' },
  { sym:'HIG', name:'Hartford Financial', sector:'Financials', index:'SP500' },
  { sym:'ACGL', name:'Arch Capital', sector:'Financials', index:'SP500' },
  { sym:'IFF', name:'Intl Flavors & Fragrances', sector:'Materials', index:'SP500' },
  { sym:'STT', name:'State Street', sector:'Financials', index:'SP500' },
  { sym:'KVUE', name:'Kenvue', sector:'Consumer Defensive', index:'SP500' },
  { sym:'PPG', name:'PPG Industries', sector:'Materials', index:'SP500' },
  { sym:'VLTO', name:'Veralto', sector:'Technology', index:'SP500' },
  { sym:'GEHC', name:'GE HealthCare', sector:'Healthcare', index:'SP500' },
  { sym:'HPQ', name:'HP Inc', sector:'Technology', index:'SP500' },
  { sym:'MTB', name:'M&T Bank', sector:'Financials', index:'SP500' },
  { sym:'LDOS', name:'Leidos Holdings', sector:'Industrials', index:'SP500' },
  { sym:'IT', name:'Gartner', sector:'Technology', index:'SP500' },
  { sym:'K', name:'Kellanova', sector:'Consumer Defensive', index:'SP500' },
  { sym:'CPAY', name:'Corpay', sector:'Technology', index:'SP500' },
  { sym:'WST', name:'West Pharma', sector:'Healthcare', index:'SP500' },
  { sym:'PHM', name:'PulteGroup', sector:'Consumer', index:'SP500' },
  { sym:'SBAC', name:'SBA Communications', sector:'Real Estate', index:'SP500' },
  { sym:'RF', name:'Regions Financial', sector:'Financials', index:'SP500' },
  { sym:'WRB', name:'Berkley Corp', sector:'Financials', index:'SP500' },
  { sym:'NTAP', name:'NetApp', sector:'Technology', index:'SP500' },
  { sym:'MTD', name:'Mettler-Toledo', sector:'Technology', index:'SP500' },
  { sym:'AWK', name:'American Water Works', sector:'Utilities', index:'SP500' },
  { sym:'ATO', name:'Atmos Energy', sector:'Utilities', index:'SP500' },
  { sym:'PPL', name:'PPL Corp', sector:'Utilities', index:'SP500' },
  { sym:'ESS', name:'Essex Property', sector:'Real Estate', index:'SP500' },
  { sym:'EIX', name:'Edison Intl', sector:'Utilities', index:'SP500' },
  { sym:'DG', name:'Dollar General', sector:'Consumer', index:'SP500' },
  { sym:'EXR', name:'Extra Space Storage', sector:'Real Estate', index:'SP500' },
  { sym:'CDW', name:'CDW Corp', sector:'Technology', index:'SP500' },
  { sym:'IRM', name:'Iron Mountain', sector:'Real Estate', index:'SP500' },
  { sym:'CLX', name:'Clorox', sector:'Consumer Defensive', index:'SP500' },
  { sym:'AVB', name:'AvalonBay', sector:'Real Estate', index:'SP500' },
  { sym:'MAA', name:'Mid-America Apartment', sector:'Real Estate', index:'SP500' },
  { sym:'GDDY', name:'GoDaddy', sector:'Technology', index:'SP500' },
  { sym:'TSCO', name:'Tractor Supply', sector:'Consumer', index:'SP500' },
  { sym:'VTR', name:'Ventas', sector:'Real Estate', index:'SP500' },
  { sym:'LII', name:'Lennox Intl', sector:'Industrials', index:'SP500' },
  { sym:'ZBRA', name:'Zebra Technologies', sector:'Technology', index:'SP500' },
  { sym:'CHD', name:'Church & Dwight', sector:'Consumer Defensive', index:'SP500' },
  { sym:'VRSN', name:'VeriSign', sector:'Technology', index:'SP500' },
  { sym:'PKG', name:'Packaging Corp', sector:'Materials', index:'SP500' },
  { sym:'MKTX', name:'MarketAxess', sector:'Financials', index:'SP500' },
  { sym:'LYV', name:'Live Nation', sector:'Consumer', index:'SP500' },
  { sym:'TYL', name:'Tyler Technologies', sector:'Technology', index:'SP500' },
  { sym:'CBOE', name:'Cboe Global Markets', sector:'Financials', index:'SP500' },
  { sym:'BR', name:'Broadridge Financial', sector:'Technology', index:'SP500' },
  { sym:'STLD', name:'Steel Dynamics', sector:'Materials', index:'SP500', memo:'[2026-08-09 REFERENCE] Steel leadership is a relative-strength observation. Verify shipments, price/mix, input costs, margins, capital allocation and volume-backed continuation before treating it as a durable cycle signal.' },
  { sym:'FE', name:'FirstEnergy', sector:'Utilities', index:'SP500' },
  { sym:'J', name:'Jacobs Solutions', sector:'Industrials', index:'SP500' },
  { sym:'LUV', name:'Southwest Airlines', sector:'Industrials', index:'SP500' },
  { sym:'CAG', name:'Conagra Brands', sector:'Consumer Defensive', index:'SP500' },
  { sym:'NI', name:'NiSource', sector:'Utilities', index:'SP500' },
  { sym:'KDP', name:'Keurig Dr Pepper', sector:'Consumer Defensive', index:'SP500' },
  { sym:'HOLX', name:'Hologic', sector:'Healthcare', index:'SP500' },
  { sym:'EG', name:'Everest Group', sector:'Financials', index:'SP500' },
  { sym:'HAL', name:'Halliburton', sector:'Energy', index:'SP500' },
  { sym:'CFG', name:'Citizens Financial', sector:'Financials', index:'SP500' },
  { sym:'WTW', name:'Willis Towers Watson', sector:'Financials', index:'SP500' },
  { sym:'KEY', name:'KeyCorp', sector:'Financials', index:'SP500' },
  { sym:'BRO', name:'Brown & Brown', sector:'Financials', index:'SP500' },
  { sym:'MOH', name:'Molina Healthcare', sector:'Healthcare', index:'SP500' },
  { sym:'PFG', name:'Principal Financial', sector:'Financials', index:'SP500' },
  { sym:'COO', name:'CooperCompanies', sector:'Healthcare', index:'SP500' },
  { sym:'TXT', name:'Textron', sector:'Industrials', index:'SP500' },
  { sym:'DGX', name:'Quest Diagnostics', sector:'Healthcare', index:'SP500' },
  { sym:'SNA', name:'Snap-on', sector:'Industrials', index:'SP500' },
  { sym:'MAS', name:'Masco Corp', sector:'Industrials', index:'SP500' },
  { sym:'DPZ', name:'Dominos Pizza', sector:'Consumer', index:'SP500' },
  { sym:'FDS', name:'FactSet Research', sector:'Financials', index:'SP500' },
  { sym:'BG', name:'Bunge Global', sector:'Consumer Defensive', index:'SP500' },
  { sym:'ARE', name:'Alexandria RE', sector:'Real Estate', index:'SP500' },
  { sym:'WSO', name:'Watsco', sector:'Industrials', index:'SP500' },
  { sym:'BAX', name:'Baxter Intl', sector:'Healthcare', index:'SP500' },
  { sym:'CPB', name:'Campbell Soup', sector:'Consumer Defensive', index:'SP500' },
  { sym:'DVA', name:'DaVita', sector:'Healthcare', index:'SP500' },
  { sym:'PODD', name:'Insulet', sector:'Healthcare', index:'SP500' },
  { sym:'WAT', name:'Waters Corp', sector:'Healthcare', index:'SP500' },
  { sym:'EXPD', name:'Expeditors Intl', sector:'Industrials', index:'SP500' },
  { sym:'WBA', name:'Walgreens', sector:'Healthcare', index:'SP500' },
  { sym:'CINF', name:'Cincinnati Financial', sector:'Financials', index:'SP500' },
  { sym:'POOL', name:'Pool Corp', sector:'Consumer', index:'SP500' },
  { sym:'EMN', name:'Eastman Chemical', sector:'Materials', index:'SP500' },
  { sym:'NVR', name:'NVR Inc', sector:'Consumer', index:'SP500' },
  { sym:'BLDR', name:'Builders FirstSource', sector:'Consumer', index:'SP500' },
  { sym:'NTRS', name:'Northern Trust', sector:'Financials', index:'SP500' },
  { sym:'IPG', name:'Interpublic Group', sector:'Communication Services', index:'SP500' },
  { sym:'LKQ', name:'LKQ Corp', sector:'Consumer', index:'SP500' },
  { sym:'FSLR', name:'First Solar', sector:'Technology', index:'SP500' },
  { sym:'ENPH', name:'Enphase Energy', sector:'Technology', index:'SP500' },
  { sym:'ON', name:'ON Semiconductor', sector:'Technology', index:'SP500' },
  { sym:'SWKS', name:'Skyworks Solutions', sector:'Technology', index:'SP500' },
  { sym:'JBHT', name:'JB Hunt Transport', sector:'Industrials', index:'SP500' },
  { sym:'JBL', name:'Jabil Inc', sector:'Technology', index:'SP500' },
  { sym:'RL', name:'Ralph Lauren', sector:'Consumer', index:'SP500' },
  { sym:'KIM', name:'Kimco Realty', sector:'Real Estate', index:'SP500' },
  { sym:'TFX', name:'Teleflex', sector:'Healthcare', index:'SP500' },
  { sym:'ILMN', name:'Illumina', sector:'Healthcare', index:'SP500' },
  { sym:'PTC', name:'PTC Inc', sector:'Technology', index:'SP500' },
  { sym:'ALB', name:'Albemarle', sector:'Materials', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] HANA battery posts describe lithium inventory/tightness and a potential second-half demand recovery. Verify lithium spot/contract prices, inventory days, brine/conversion volumes, capex and EV/ESS demand; channel estimates are not current commodity data.' },
  { sym:'ALGN', name:'Align Technology', sector:'Healthcare', index:'SP500' },
  { sym:'NCLH', name:'Norwegian Cruise', sector:'Consumer', index:'SP500' },
  { sym:'BBWI', name:'Bath & Body Works', sector:'Consumer', index:'SP500' },
  { sym:'MGM', name:'MGM Resorts', sector:'Consumer', index:'SP500' },
  { sym:'APTV', name:'Aptiv', sector:'Consumer', index:'SP500' },
  { sym:'GEN', name:'Gen Digital', sector:'Technology', index:'SP500' },
  { sym:'CZR', name:'Caesars Entertainment', sector:'Consumer', index:'SP500' },
  { sym:'CE', name:'Celanese', sector:'Materials', index:'SP500' },
  { sym:'GL', name:'Globe Life', sector:'Financials', index:'SP500' },
  { sym:'HRL', name:'Hormel Foods', sector:'Consumer Defensive', index:'SP500' },
  { sym:'AES', name:'AES Corp', sector:'Utilities', index:'SP500' },
  { sym:'CMS', name:'CMS Energy', sector:'Utilities', index:'SP500' },
  { sym:'AKAM', name:'Akamai', sector:'Technology', index:'SP500' },
  { sym:'WRK', name:'WestRock', sector:'Materials', index:'SP500' },
  { sym:'JNPR', name:'Juniper Networks', sector:'Technology', index:'SP500' },
  { sym:'UDR', name:'UDR Inc', sector:'Real Estate', index:'SP500' },
  { sym:'BXP', name:'Boston Properties', sector:'Real Estate', index:'SP500' },
  { sym:'ALLE', name:'Allegion', sector:'Industrials', index:'SP500' },
  { sym:'AIZ', name:'Assurant', sector:'Financials', index:'SP500' },
  { sym:'MHK', name:'Mohawk Industries', sector:'Consumer', index:'SP500' },
  { sym:'MTCH', name:'Match Group', sector:'Communication Services', index:'SP500' },
  { sym:'GNRC', name:'Generac', sector:'Technology', index:'SP500' },
  { sym:'RHI', name:'Robert Half', sector:'Industrials', index:'SP500' },
  { sym:'DAY', name:'Dayforce', sector:'Industrials', index:'SP500' },
  { sym:'CHRW', name:'CH Robinson', sector:'Industrials', index:'SP500' },
  { sym:'HSIC', name:'Henry Schein', sector:'Healthcare', index:'SP500' },
  { sym:'DVN', name:'Devon Energy', sector:'Energy', index:'SP500' },
  { sym:'LNT', name:'Alliant Energy', sector:'Utilities', index:'SP500' },
  { sym:'EVRG', name:'Evergy', sector:'Utilities', index:'SP500' },
  { sym:'FRT', name:'Federal Realty', sector:'Real Estate', index:'SP500' },
  { sym:'TECH', name:'Bio-Techne', sector:'Healthcare', index:'SP500' },
  { sym:'REG', name:'Regency Centers', sector:'Real Estate', index:'SP500' },
  { sym:'FFIV', name:'F5 Networks', sector:'Technology', index:'SP500' },
  { sym:'IEX', name:'IDEX Corp', sector:'Industrials', index:'SP500' },
  { sym:'CPT', name:'Camden Property', sector:'Real Estate', index:'SP500' },
  { sym:'INCY', name:'Incyte', sector:'Healthcare', index:'SP500' },
  { sym:'BIO', name:'Bio-Rad Labs', sector:'Healthcare', index:'SP500' },
  { sym:'VTRS', name:'Viatris', sector:'Healthcare', index:'SP500' },
  { sym:'CRL', name:'Charles River Labs', sector:'Healthcare', index:'SP500' },
  { sym:'TPR', name:'Tapestry', sector:'Consumer', index:'SP500' },
  { sym:'SWK', name:'Stanley Black & Decker', sector:'Industrials', index:'SP500' },
  { sym:'PAYC', name:'Paycom', sector:'Technology', index:'SP500' },
  { sym:'EPAM', name:'EPAM Systems', sector:'Technology', index:'SP500' },
  { sym:'RVTY', name:'Revvity', sector:'Healthcare', index:'SP500' },
  { sym:'SOLV', name:'Solventum', sector:'Healthcare', index:'SP500' },
  { sym:'BWA', name:'BorgWarner', sector:'Industrials', index:'SP500' },
  { sym:'PSKY', name:'Paramount Skydance', sector:'Communication Services', index:'' },
  { sym:'WYNN', name:'Wynn Resorts', sector:'Consumer', index:'SP500' },
  { sym:'CHTR', name:'Charter Communications', sector:'Communication Services', index:'SP500' },
  { sym:'CPRT', name:'Copart', sector:'Industrials', index:'SP500' },
  { sym:'DLTR', name:'Dollar Tree', sector:'Consumer', index:'SP500' },
  { sym:'DXCM', name:'DexCom', sector:'Healthcare', index:'SP500' },
  { sym:'GFS', name:'GlobalFoundries', sector:'Technology', index:'SP500' },
  { sym:'MCHP', name:'Microchip Technology', sector:'Technology', index:'SP500' },
  { sym:'ODFL', name:'Old Dominion Freight', sector:'Industrials', index:'SP500' },
  { sym:'FOXA', name:'Fox Corp A', sector:'Communication Services', index:'SP500' },
  { sym:'FOX', name:'Fox Corp B', sector:'Communication Services', index:'SP500' },
  { sym:'NWSA', name:'News Corp A', sector:'Communication Services', index:'SP500' },
  { sym:'NWS', name:'News Corp B', sector:'Communication Services', index:'SP500' },
  { sym:'BABA', name:'Alibaba', sector:'Technology', index:'NYSE' },
  { sym:'SAP', name:'SAP SE', sector:'Technology', index:'NYSE' },
  { sym:'NVO', name:'Novo Nordisk', sector:'Healthcare', index:'NYSE' },
  { sym:'NVS', name:'Novartis', sector:'Healthcare', index:'NYSE' },
  { sym:'AZN', name:'AstraZeneca', sector:'Healthcare', index:'NYSE' },
  { sym:'HSBC', name:'HSBC Holdings', sector:'Financials', index:'NYSE' },
  { sym:'TM', name:'Toyota Motor', sector:'Consumer', index:'NYSE' },
  { sym:'SHEL', name:'Shell plc', sector:'Energy', index:'NYSE' },
  { sym:'RIO', name:'Rio Tinto', sector:'Materials', index:'NYSE' },
  { sym:'BHP', name:'BHP Group', sector:'Materials', index:'NYSE' },
  { sym:'MUFG', name:'MUFG Financial', sector:'Financials', index:'NYSE' },
  { sym:'SMFG', name:'Sumitomo Mitsui FG', sector:'Financials', index:'NYSE' },
  { sym:'MFG', name:'Mizuho Financial', sector:'Financials', index:'NYSE' },
  { sym:'UBS', name:'UBS Group', sector:'Financials', index:'NYSE' },
  { sym:'PDD', name:'PDD Holdings', sector:'Technology', index:'NASDAQ100' },
  { sym:'SONY', name:'Sony Group', sector:'Technology', index:'NYSE' },
  { sym:'SCCO', name:'Southern Copper', sector:'Materials', index:'NYSE' },
  { sym:'SAN', name:'Banco Santander', sector:'Financials', index:'NYSE' },
  { sym:'BBVA', name:'BBVA', sector:'Financials', index:'NYSE' },
  { sym:'BTI', name:'British American Tobacco', sector:'Consumer Defensive', index:'NYSE' },
  { sym:'UL', name:'Unilever', sector:'Consumer Defensive', index:'NYSE' },
  { sym:'BUD', name:'Anheuser-Busch InBev', sector:'Consumer Defensive', index:'NYSE' },
  { sym:'TTE', name:'TotalEnergies', sector:'Energy', index:'NYSE' },
  { sym:'BP', name:'BP plc', sector:'Energy', index:'NYSE' },
  { sym:'HDB', name:'HDFC Bank', sector:'Financials', index:'NYSE' },
  { sym:'IBN', name:'ICICI Bank', sector:'Financials', index:'NYSE' },
  { sym:'BCS', name:'Barclays', sector:'Financials', index:'NYSE' },
  { sym:'DB', name:'Deutsche Bank', sector:'Financials', index:'NYSE' },
  { sym:'ING', name:'ING Groep', sector:'Financials', index:'NYSE' },
  { sym:'TD', name:'Toronto-Dominion', sector:'Financials', index:'NYSE' },
  { sym:'RY', name:'Royal Bank of Canada', sector:'Financials', index:'NYSE' },
  { sym:'BMO', name:'Bank of Montreal', sector:'Financials', index:'NYSE' },
  { sym:'BNS', name:'Bank of Nova Scotia', sector:'Financials', index:'NYSE' },
  { sym:'CM', name:'CIBC', sector:'Financials', index:'NYSE' },
  { sym:'SNY', name:'Sanofi', sector:'Healthcare', index:'NYSE' },
  { sym:'GSK', name:'GSK plc', sector:'Healthcare', index:'NYSE' },
  { sym:'TAK', name:'Takeda Pharma', sector:'Healthcare', index:'NYSE' },
  { sym:'ENB', name:'Enbridge', sector:'Energy', index:'NYSE' },
  { sym:'EPD', name:'Enterprise Products', sector:'Energy', index:'NYSE' },
  { sym:'ET', name:'Energy Transfer', sector:'Energy', index:'NYSE' },
  { sym:'SU', name:'Suncor Energy', sector:'Energy', index:'NYSE' },
  { sym:'CNQ', name:'Canadian Natural Res', sector:'Energy', index:'NYSE' },
  { sym:'EQNR', name:'Equinor', sector:'Energy', index:'NYSE' },
  { sym:'VALE', name:'Vale SA', sector:'Materials', index:'NYSE' },
  { sym:'PBR', name:'Petrobras', sector:'Energy', index:'NYSE' },
  { sym:'ITUB', name:'Itau Unibanco', sector:'Financials', index:'NYSE' },
  { sym:'INFY', name:'Infosys', sector:'Technology', index:'NYSE' },
  { sym:'NTES', name:'NetEase', sector:'Technology', index:'NASDAQ100' },
  { sym:'JD', name:'JD.com', sector:'Technology', index:'NASDAQ100' },
  { sym:'BIDU', name:'Baidu', sector:'Technology', index:'NASDAQ100' },
  { sym:'TCOM', name:'Trip.com', sector:'Consumer', index:'NASDAQ100' },
  { sym:'CPNG', name:'Coupang', sector:'Technology', index:'NYSE' },
  { sym:'AMX', name:'America Movil', sector:'Communication Services', index:'NYSE' },
  { sym:'LYG', name:'Lloyds Banking', sector:'Financials', index:'NYSE' },
  { sym:'NWG', name:'NatWest Group', sector:'Financials', index:'NYSE' },
  { sym:'NGG', name:'National Grid', sector:'Utilities', index:'NYSE' },
  { sym:'RELX', name:'RELX plc', sector:'Industrials', index:'NYSE' },
  { sym:'DEO', name:'Diageo', sector:'Consumer Defensive', index:'NYSE' },
  { sym:'HLN', name:'Haleon', sector:'Healthcare', index:'NYSE' },
  { sym:'RACE', name:'Ferrari', sector:'Consumer', index:'NYSE' },
  { sym:'MFC', name:'Manulife Financial', sector:'Financials', index:'NYSE' },
  { sym:'B', name:'Barrick Mining', sector:'Materials', index:'NYSE' },
  { sym:'AU', name:'AngloGold Ashanti', sector:'Materials', index:'NYSE' },
  { sym:'AEM', name:'Agnico Eagle Mines', sector:'Materials', index:'NYSE' },
  { sym:'WPM', name:'Wheaton Precious Metals', sector:'Materials', index:'NYSE' },
  { sym:'FNV', name:'Franco-Nevada', sector:'Materials', index:'NYSE' },
  { sym:'GFI', name:'Gold Fields', sector:'Materials', index:'NYSE' },
  { sym:'TRP', name:'TC Energy', sector:'Energy', index:'NYSE' },
  { sym:'CP', name:'Canadian Pacific KC', sector:'Industrials', index:'NYSE' },
  { sym:'CNI', name:'Canadian National Railway', sector:'Industrials', index:'NYSE' },
  { sym:'IMO', name:'Imperial Oil', sector:'Energy', index:'NYSE' },
  { sym:'E', name:'Eni SpA', sector:'Energy', index:'NYSE' },
  { sym:'ARES', name:'Ares Management', sector:'Financials', index:'SP500' },
  { sym:'BAM', name:'Brookfield Asset Mgmt', sector:'Financials', index:'NYSE' },
  { sym:'BN', name:'Brookfield Corp', sector:'Financials', index:'NYSE' },
  { sym:'WY', name:'Weyerhaeuser', sector:'Real Estate', index:'SP500' },
  { sym:'MPLX', name:'MPLX LP', sector:'Energy', index:'NYSE' },
  { sym:'LNG', name:'Cheniere Energy', sector:'Energy', index:'SP500' },
  { sym:'CCEP', name:'Coca-Cola Europacific', sector:'Consumer Defensive', index:'NYSE' },
  { sym:'CCL', name:'Carnival Corp', sector:'Consumer', index:'SP500' },
  { sym:'ALNY', name:'Alnylam Pharma', sector:'Healthcare', index:'SP500' },
  { sym:'ARGX', name:'argenx SE', sector:'Healthcare', index:'NASDAQ100' },
  { sym:'TKO', name:'TKO Group', sector:'Communication Services', index:'NYSE' },
  { sym:'FERG', name:'Ferguson Enterprises', sector:'Industrials', index:'SP500' },
  { sym:'TRI', name:'Thomson Reuters', sector:'Industrials', index:'NYSE' },
  { sym:'MDLN', name:'Medline Inc', sector:'Healthcare', index:'NYSE' },
  { sym:'WCN', name:'Waste Connections', sector:'Industrials', index:'NYSE' },
  { sym:'HEI', name:'HEICO Corp', sector:'Industrials', index:'SP500' },
  { sym:'FER', name:'Ferrovial', sector:'Industrials', index:'NYSE' },
  { sym:'TEAM', name:'Atlassian', sector:'Technology', index:'NASDAQ100' },
  { sym:'RKT', name:'Rocket Companies', sector:'Financials', index:'NYSE' },
  { sym:'SPY', name:'SPDR S&P 500 ETF', sector:'ETF', index:'SP500' },
  { sym:'QQQ', name:'Invesco QQQ Trust', sector:'ETF', index:'NASDAQ100' },
  { sym:'VTI', name:'Vanguard Total Market', sector:'ETF', index:'SP500' },
  { sym:'VOO', name:'Vanguard S&P 500', sector:'ETF', index:'SP500' },
  { sym:'IVV', name:'iShares Core S&P 500', sector:'ETF', index:'SP500' },
  { sym:'SOXX', name:'iShares Semiconductor', sector:'ETF', index:'NASDAQ100' },
  { sym:'ARKK', name:'ARK Innovation', sector:'ETF', index:'NYSE' },
  { sym:'ARKG', name:'ARK Genomic', sector:'ETF', index:'NYSE' },
  { sym:'ARKF', name:'ARK Fintech', sector:'ETF', index:'NYSE' },
  { sym:'GLD', name:'SPDR Gold', sector:'ETF', index:'NYSE' },
  { sym:'SLV', name:'iShares Silver', sector:'ETF', index:'NYSE' },
  { sym:'USO', name:'US Oil Fund', sector:'ETF', index:'NYSE' },
  { sym:'TLT', name:'iShares 20+ Treasury', sector:'ETF', index:'NASDAQ100' },
  { sym:'TIP', name:'iShares TIPS', sector:'ETF', index:'NYSE' },
  { sym:'HYG', name:'iShares High Yield', sector:'ETF', index:'NYSE' },
  { sym:'LQD', name:'iShares Inv Grade', sector:'ETF', index:'NYSE' },
  { sym:'SHY', name:'iShares 1-3Y Treasury', sector:'ETF', index:'NYSE' },
  { sym:'BND', name:'Vanguard Total Bond', sector:'ETF', index:'NYSE' },
  { sym:'AGG', name:'iShares US Aggregate', sector:'ETF', index:'NYSE' },
  { sym:'EEM', name:'iShares Emerging', sector:'ETF', index:'NYSE' },
  { sym:'EFA', name:'iShares EAFE', sector:'ETF', index:'NYSE' },
  { sym:'FXI', name:'iShares China', sector:'ETF', index:'NYSE' },
  { sym:'EWJ', name:'iShares Japan', sector:'ETF', index:'NYSE' },
  { sym:'EWY', name:'iShares Korea', sector:'ETF', index:'NYSE' },
  { sym:'VWO', name:'Vanguard Emerging', sector:'ETF', index:'NYSE' },
  { sym:'INDA', name:'iShares India', sector:'ETF', index:'NYSE' },
  { sym:'VXX', name:'iPath VIX', sector:'ETF', index:'NYSE' },
  { sym:'UVXY', name:'ProShares Ultra VIX', sector:'ETF', index:'NYSE' },


  // ── 섹터/테마 ETF 보강 ──
  { sym:'XLK', name:'Technology Select Sector SPDR', sector:'ETF', index:'ETF' },
  { sym:'AMLP', name:'Alerian MLP ETF', sector:'ETF', index:'ETF' },
  { sym:'BOTZ', name:'Global X Robotics & AI ETF', sector:'ETF', index:'ETF' },
  { sym:'GDX', name:'VanEck Gold Miners ETF', sector:'ETF', index:'ETF' },
  { sym:'HACK', name:'ETFMG Prime Cyber Security ETF', sector:'ETF', index:'ETF' },
  { sym:'ICLN', name:'iShares Global Clean Energy ETF', sector:'ETF', index:'ETF' },
  { sym:'IGV', name:'iShares Expanded Tech-Software ETF', sector:'ETF', index:'ETF' },
  { sym:'ITA', name:'iShares US Aerospace & Defense ETF', sector:'ETF', index:'ETF' },
  { sym:'LIT', name:'Global X Lithium & Battery ETF', sector:'ETF', index:'ETF' },
  { sym:'OIH', name:'VanEck Oil Services ETF', sector:'ETF', index:'ETF' },
  { sym:'SMH', name:'VanEck Semiconductor ETF', sector:'ETF', index:'ETF' },
  { sym:'URA', name:'Global X Uranium ETF', sector:'ETF', index:'ETF' },
  { sym:'XBI', name:'SPDR S&P Biotech ETF', sector:'ETF', index:'ETF' },
  { sym:'XLB', name:'Materials Select Sector SPDR', sector:'Materials', index:'ETF' },
  { sym:'XLC', name:'Communication Services Select SPDR', sector:'Communication Services', index:'ETF' },
  { sym:'XLE', name:'Energy Select Sector SPDR', sector:'Energy', index:'ETF' },
  { sym:'XLF', name:'Financial Select Sector SPDR', sector:'Financials', index:'ETF' },
  { sym:'XLI', name:'Industrial Select Sector SPDR', sector:'Industrials', index:'ETF' },
  { sym:'XLP', name:'Consumer Staples Select SPDR', sector:'Consumer Defensive', index:'ETF' },
  { sym:'XLRE', name:'Real Estate Select SPDR', sector:'Real Estate', index:'ETF' },
  { sym:'XLU', name:'Utilities Select Sector SPDR', sector:'Utilities', index:'ETF' },
  { sym:'XLV', name:'Health Care Select Sector SPDR', sector:'Healthcare', index:'ETF' },
  { sym:'XLY', name:'Consumer Discretionary Select SPDR', sector:'Consumer', index:'ETF' },
  { sym:'XOP', name:'SPDR S&P Oil & Gas Exploration ETF', sector:'ETF', index:'ETF' },
  // ── 테마 누락분 보강 ──
  { sym:'ABB', name:'ABB Ltd', sector:'Industrials', index:'ADR' },
  { sym:'ADM', name:'Archer-Daniels-Midland', sector:'Consumer Defensive', index:'SP500' },
  { sym:'ES', name:'Eversource Energy', sector:'Utilities', index:'SP500' },
  { sym:'FANUY', name:'Fanuc Corp', sector:'Industrials', index:'ADR' },
  // IIVI removed — merged into COHR (Coherent Corp)
  { sym:'JETS', name:'US Global Jets ETF', sector:'ETF', index:'ETF' },
  { sym:'NDSN', name:'Nordson Corp', sector:'Industrials', index:'SP500' },
  { sym:'PNW', name:'Pinnacle West Capital', sector:'Utilities', index:'SP500' },
  { sym:'TPL', name:'Texas Pacific Land', sector:'Energy', index:'SP500' },
  // ── THEME↔SCREENER 불일치 보강 (v34.7 감사) ──
  { sym:'AA', name:'Alcoa Corp', sector:'Basic Materials', index:'SP500' },
  { sym:'BIIB', name:'Biogen', sector:'Healthcare', index:'SP500' },
  { sym:'CLSK', name:'CleanSpark', sector:'Technology', index:'NASDAQ' },
  { sym:'ETSY', name:'Etsy', sector:'Consumer Cyclical', index:'SP500' },
  { sym:'LAC', name:'Lithium Americas', sector:'Basic Materials', index:'NYSE' },
  { sym:'MASI', name:'Masimo Corp', sector:'Healthcare', index:'NASDAQ' },
  { sym:'MP', name:'MP Materials', sector:'Basic Materials', index:'NYSE' },
  { sym:'RUN', name:'Sunrun', sector:'Utilities', index:'NASDAQ' },
  { sym:'SEDG', name:'SolarEdge Technologies', sector:'Technology', index:'NASDAQ' },
  { sym:'STAG', name:'STAG Industrial', sector:'Real Estate', index:'SP500' },
  { sym:'IBIT', name:'iShares Bitcoin Trust ETF', sector:'ETF', index:'ETF' },
  { sym:'BITO', name:'ProShares Bitcoin Strategy ETF', sector:'ETF', index:'ETF' },
  { sym:'QBTS', name:'D-Wave Quantum', sector:'Technology', index:'NYSE' },
  { sym:'UMC', name:'United Microelectronics', sector:'Technology', index:'ADR' },

  // ═══ v35.6: 한국 KOSPI/KOSDAQ 종합 종목 데이터베이스 (150+종목) ═══
  // 시총 상위 대형주 (KOSPI 시총 TOP)
  { sym:'005930.KS', name:'삼성전자', sector:'Technology', index:'KOSPI', memo:'[2026-08-09 TG-REFERENCE] BornLupin/Aether posts link Samsung to foldable demand, Korea semiconductor cluster execution, power/water availability and possible capital-return discussion. Verify preorders, plant approvals, 6.3GW/650kt-day infrastructure claims and shareholder-return terms from company/government filings.' },
  { sym:'000660.KS', name:'SK하이닉스', sector:'Technology', index:'KOSPI', memo:'[2026-08-09 TG-REFERENCE] Aether/HANA posts flag Chongqing post-processing restructuring, HBM4 test-equipment procurement, LTA/memory allocation and possible capital-return/labor developments. Each is a separate confirmation branch: verify company disclosure, equipment orders, contract terms, capex and operating metrics before current use.' },
  { sym:'373220.KS', name:'LG에너지솔루션', sector:'Technology', index:'KOSPI' },
  { sym:'207940.KS', name:'삼성바이오로직스', sector:'Healthcare', index:'KOSPI' },
  { sym:'005380.KS', name:'현대차', sector:'Consumer', index:'KOSPI' },
  { sym:'012450.KS', name:'한화에어로스페이스', sector:'Industrials', index:'KOSPI' },
  { sym:'000270.KS', name:'기아', sector:'Consumer', index:'KOSPI' },
  { sym:'035420.KS', name:'NAVER', sector:'Communication Services', index:'KOSPI' },
  { sym:'068270.KS', name:'셀트리온', sector:'Healthcare', index:'KOSPI' },
  { sym:'105560.KS', name:'KB금융', sector:'Financials', index:'KOSPI' },
  { sym:'006400.KS', name:'삼성SDI', sector:'Technology', index:'KOSPI' },
  { sym:'055550.KS', name:'신한지주', sector:'Financials', index:'KOSPI' },
  { sym:'051910.KS', name:'LG화학', sector:'Materials', index:'KOSPI' },
  { sym:'259960.KS', name:'크래프톤', sector:'Communication Services', index:'KOSPI' },
  { sym:'035720.KS', name:'카카오', sector:'Communication Services', index:'KOSPI' },
  { sym:'138040.KS', name:'메리츠금융지주', sector:'Financials', index:'KOSPI' },
  { sym:'015760.KS', name:'한국전력', sector:'Utilities', index:'KOSPI' },
  { sym:'042660.KS', name:'한화오션', sector:'Industrials', index:'KOSPI', memo:'[2026-08-09 TG-REFERENCE] BornLupin relayed inclusion in Korea materials/equipment "super-乙" R&D support. Verify formal program notice, eligible project, funding schedule, commercial customer and margin impact; policy selection is not backlog.' },

  //  반도체 (semi) — 소재·장비 포함
  { sym:'042700.KQ', name:'한미반도체', sector:'Technology', index:'KOSDAQ' },
  { sym:'009150.KS', name:'삼성전기', sector:'Technology', index:'KOSPI' },
  { sym:'402340.KS', name:'SK스퀘어', sector:'Technology', index:'KOSPI' },
  { sym:'039030.KQ', name:'이오테크닉스', sector:'Technology', index:'KOSDAQ', memo:'[2026-08-09 TG-REFERENCE] BornLupin relayed a government-supported super-乙 project for high-speed laser heat-treatment equipment. Verify official award, scope, timing, customer qualification and revenue recognition.' },
  { sym:'403870.KQ', name:'HPSP', sector:'Technology', index:'KOSDAQ' },
  { sym:'058470.KQ', name:'리노공업', sector:'Technology', index:'KOSDAQ' },
  { sym:'240810.KQ', name:'원익IPS', sector:'Technology', index:'KOSDAQ' },
  { sym:'000990.KS', name:'DB하이텍', sector:'Technology', index:'KOSPI' },
  { sym:'036930.KQ', name:'주성엔지니어링', sector:'Technology', index:'KOSDAQ' },
  { sym:'131970.KQ', name:'테크윙', sector:'Technology', index:'KOSDAQ' },
  { sym:'005290.KS', name:'동진쎄미켐', sector:'Materials', index:'KOSPI' },
  { sym:'357780.KQ', name:'솔브레인', sector:'Materials', index:'KOSDAQ' },
  { sym:'025560.KS', name:'미래산업', sector:'Technology', index:'KOSPI' },

  //  K-방산 (defense)
  { sym:'047810.KS', name:'한국항공우주(KAI)', sector:'Industrials', index:'KOSPI' },
  { sym:'079550.KS', name:'LIG넥스원', sector:'Industrials', index:'KOSPI' },
  { sym:'064350.KS', name:'현대로템', sector:'Industrials', index:'KOSPI' },
  { sym:'272210.KS', name:'한화시스템', sector:'Industrials', index:'KOSPI' },
  { sym:'000880.KS', name:'한화', sector:'Industrials', index:'KOSPI' },
  { sym:'103140.KS', name:'풍산', sector:'Industrials', index:'KOSPI' },

  //  조선 (shipbuilding)
  { sym:'329180.KS', name:'HD현대중공업', sector:'Industrials', index:'KOSPI' },
  { sym:'009540.KS', name:'HD한국조선해양', sector:'Industrials', index:'KOSPI' },
  { sym:'010140.KS', name:'삼성중공업', sector:'Industrials', index:'KOSPI' },
  { sym:'010620.KS', name:'HD현대미포', sector:'Industrials', index:'KOSPI' },
  { sym:'267250.KS', name:'HD현대', sector:'Industrials', index:'KOSPI' },
  { sym:'082740.KS', name:'한화엔진', sector:'Industrials', index:'KOSPI' },
  { sym:'011200.KS', name:'HMM', sector:'Industrials', index:'KOSPI' },

  // 전력기기 (power-grid)
  { sym:'298040.KS', name:'효성중공업', sector:'Industrials', index:'KOSPI' },
  { sym:'267260.KS', name:'HD현대일렉트릭', sector:'Industrials', index:'KOSPI' },
  { sym:'010120.KS', name:'LS일렉트릭', sector:'Industrials', index:'KOSPI' },
  { sym:'103590.KS', name:'일진전기', sector:'Industrials', index:'KOSPI' },
  { sym:'006260.KS', name:'LS', sector:'Industrials', index:'KOSPI' },
  { sym:'229640.KQ', name:'LS에코에너지', sector:'Industrials', index:'KOSDAQ' },
  { sym:'000500.KS', name:'가온전선', sector:'Industrials', index:'KOSPI' },
  { sym:'033100.KQ', name:'제룡전기', sector:'Industrials', index:'KOSDAQ' },

  //  원전 (nuclear)
  { sym:'034020.KS', name:'두산에너빌리티', sector:'Industrials', index:'KOSPI' },
  { sym:'000720.KS', name:'현대건설', sector:'Industrials', index:'KOSPI' },
  { sym:'052690.KS', name:'한전기술', sector:'Industrials', index:'KOSPI' },
  { sym:'051600.KS', name:'한전KPS', sector:'Industrials', index:'KOSPI' },
  { sym:'092200.KQ', name:'디아이씨', sector:'Industrials', index:'KOSDAQ' },

  //  2차전지 (battery)
  { sym:'005490.KS', name:'POSCO홀딩스', sector:'Materials', index:'KOSPI' },
  { sym:'096770.KS', name:'SK이노베이션', sector:'Energy', index:'KOSPI' },
  { sym:'247540.KQ', name:'에코프로비엠', sector:'Materials', index:'KOSDAQ', memo:'[2026-08-09 TG-REFERENCE] BornLupin/HANA battery posts frame ESS, North America non-China supply and lithium/VC tightness as separate hypotheses. Verify order disclosure, eligible-origin rules, raw-material cost pass-through, inventory and customer qualification.' },
  { sym:'086520.KQ', name:'에코프로', sector:'Materials', index:'KOSDAQ' },
  { sym:'003670.KQ', name:'포스코퓨처엠', sector:'Materials', index:'KOSDAQ', memo:'[2026-08-09 TG-REFERENCE] HANA/BornLupin relay North American ESS order-cycle and non-China material sourcing themes. Verify signed contract, volume, timing, subsidy/origin eligibility and margin; sector narrative alone is not an order.' },
  { sym:'066970.KQ', name:'엘앤에프', sector:'Materials', index:'KOSDAQ' },

  //  바이오 (bio)
  { sym:'196170.KQ', name:'알테오젠', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'128940.KS', name:'한미약품', sector:'Healthcare', index:'KOSPI' },
  { sym:'028300.KQ', name:'HLB', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'000100.KS', name:'유한양행', sector:'Healthcare', index:'KOSPI' },
  { sym:'326030.KS', name:'SK바이오팜', sector:'Healthcare', index:'KOSPI' },
  { sym:'145020.KQ', name:'휴젤', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'302440.KQ', name:'SK바이오사이언스', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'141080.KQ', name:'리가켐바이오', sector:'Healthcare', index:'KOSDAQ' },

  //  K-뷰티 (kbeauty)
  { sym:'090430.KS', name:'아모레퍼시픽', sector:'Consumer', index:'KOSPI' },
  { sym:'051900.KS', name:'LG생활건강', sector:'Consumer', index:'KOSPI' },
  { sym:'044820.KQ', name:'코스맥스BTI', sector:'Consumer', index:'KOSDAQ' },
  { sym:'192820.KQ', name:'코스맥스', sector:'Consumer', index:'KOSDAQ' },
  { sym:'161890.KS', name:'한국콜마', sector:'Consumer', index:'KOSPI' },
  { sym:'278470.KQ', name:'에이피알(APR)', sector:'Consumer', index:'KOSDAQ', memo:'[2026-08-09 TG-REFERENCE] BornLupin relayed sell-side commentary on North America/Europe growth and a reported target price. Verify DART revenue by region, channel mix, promotion/FX/tariff effects, margin normalization and valuation; target-price recirculation is not current evidence.' },
  { sym:'257720.KQ', name:'실리콘투', sector:'Consumer', index:'KOSDAQ' },
  { sym:'237880.KQ', name:'클리오', sector:'Consumer', index:'KOSDAQ' },
  { sym:'950130.KQ', name:'엑시큐어', sector:'Healthcare', index:'KOSDAQ' },

  //  K-콘텐츠 (kcontent)
  { sym:'352820.KS', name:'하이브', sector:'Communication Services', index:'KOSPI' },
  { sym:'041510.KQ', name:'SM엔터테인먼트', sector:'Communication Services', index:'KOSDAQ' },
  { sym:'035900.KQ', name:'JYP엔터테인먼트', sector:'Communication Services', index:'KOSDAQ' },
  { sym:'122870.KQ', name:'YG엔터테인먼트', sector:'Communication Services', index:'KOSDAQ' },
  { sym:'253450.KS', name:'스튜디오드래곤', sector:'Communication Services', index:'KOSPI' },
  { sym:'035760.KS', name:'CJ ENM', sector:'Communication Services', index:'KOSPI' },
  { sym:'251270.KS', name:'넷마블', sector:'Communication Services', index:'KOSPI' },
  { sym:'112040.KQ', name:'위메이드', sector:'Communication Services', index:'KOSDAQ' },
  { sym:'263750.KQ', name:'펄어비스', sector:'Communication Services', index:'KOSDAQ' },

  //  자동차 (auto)
  { sym:'012330.KS', name:'현대모비스', sector:'Consumer', index:'KOSPI' },
  { sym:'086280.KS', name:'현대글로비스', sector:'Industrials', index:'KOSPI' },
  { sym:'011210.KS', name:'현대위아', sector:'Industrials', index:'KOSPI' },
  { sym:'204320.KS', name:'HL만도', sector:'Consumer', index:'KOSPI' },
  { sym:'018880.KS', name:'한온시스템', sector:'Consumer', index:'KOSPI' },
  { sym:'316140.KS', name:'우리금융지주', sector:'Financials', index:'KOSPI' },

  // 로봇 (robot)
  { sym:'454910.KQ', name:'두산로보틱스', sector:'Technology', index:'KOSDAQ' },
  { sym:'277810.KQ', name:'레인보우로보틱스', sector:'Technology', index:'KOSDAQ' },
  { sym:'315640.KQ', name:'뉴로메카', sector:'Technology', index:'KOSDAQ' },
  { sym:'178320.KQ', name:'서진시스템', sector:'Technology', index:'KOSDAQ' },
  { sym:'090360.KQ', name:'로보스타', sector:'Technology', index:'KOSDAQ' },

  //  금융 (finance)
  { sym:'086790.KS', name:'하나금융지주', sector:'Financials', index:'KOSPI' },
  { sym:'032830.KS', name:'삼성생명', sector:'Financials', index:'KOSPI' },
  { sym:'000810.KS', name:'삼성화재', sector:'Financials', index:'KOSPI' },
  { sym:'323410.KQ', name:'카카오뱅크', sector:'Financials', index:'KOSDAQ' },
  { sym:'024110.KS', name:'기업은행', sector:'Financials', index:'KOSPI' },
  { sym:'003550.KS', name:'LG', sector:'Industrials', index:'KOSPI' },
  { sym:'066570.KS', name:'LG전자', sector:'Consumer', index:'KOSPI' },

  //  K-푸드 (kfood)
  { sym:'003230.KS', name:'삼양식품', sector:'Consumer Defensive', index:'KOSPI' },
  { sym:'097950.KS', name:'CJ제일제당', sector:'Consumer Defensive', index:'KOSPI' },
  { sym:'271560.KS', name:'오리온', sector:'Consumer Defensive', index:'KOSPI' },
  { sym:'004370.KS', name:'농심', sector:'Consumer Defensive', index:'KOSPI' },
  { sym:'280360.KS', name:'롯데웰푸드', sector:'Consumer Defensive', index:'KOSPI' },
  { sym:'005180.KS', name:'빙그레', sector:'Consumer Defensive', index:'KOSPI' },
  { sym:'000080.KS', name:'하이트진로', sector:'Consumer Defensive', index:'KOSPI' },

  // 통신 (telecom)
  { sym:'017670.KS', name:'SK텔레콤', sector:'Communication Services', index:'KOSPI' },
  { sym:'030200.KS', name:'KT', sector:'Communication Services', index:'KOSPI' },
  { sym:'032640.KS', name:'LG유플러스', sector:'Communication Services', index:'KOSPI' },
  { sym:'018260.KS', name:'삼성SDS', sector:'Technology', index:'KOSPI' },

  //  크립토 (crypto)
  { sym:'294870.KS', name:'HDC현대산업개발', sector:'Industrials', index:'KOSPI' },
  { sym:'094480.KQ', name:'갤럭시아머니트리', sector:'Financials', index:'KOSDAQ' },

  // 유통/소비재 (retail)
  { sym:'004170.KS', name:'신세계', sector:'Consumer', index:'KOSPI' },
  { sym:'023530.KS', name:'롯데쇼핑', sector:'Consumer', index:'KOSPI' },
  { sym:'069960.KQ', name:'현대백화점', sector:'Consumer', index:'KOSDAQ' },

  //  건설/인프라
  { sym:'000720.KS', name:'현대건설', sector:'Industrials', index:'KOSPI' },
  { sym:'047040.KS', name:'대우건설', sector:'Industrials', index:'KOSPI' },

  //  에너지/화학
  { sym:'010950.KS', name:'S-Oil', sector:'Energy', index:'KOSPI' },
  { sym:'078930.KS', name:'GS', sector:'Energy', index:'KOSPI' },
  { sym:'011170.KS', name:'롯데케미칼', sector:'Materials', index:'KOSPI' },
  { sym:'006800.KS', name:'미래에셋증권', sector:'Financials', index:'KOSPI' },
  { sym:'016360.KS', name:'삼성증권', sector:'Financials', index:'KOSPI' },

  //  기타 대형주/우량주
  { sym:'028260.KS', name:'삼성물산', sector:'Industrials', index:'KOSPI' },
  { sym:'034730.KS', name:'SK', sector:'Industrials', index:'KOSPI' },
  { sym:'036570.KS', name:'엔씨소프트', sector:'Communication Services', index:'KOSPI' },
  { sym:'030000.KS', name:'제일기획', sector:'Communication Services', index:'KOSPI' },
  { sym:'004020.KS', name:'현대제철', sector:'Materials', index:'KOSPI' },
  { sym:'011780.KS', name:'금호석유', sector:'Materials', index:'KOSPI' },
  { sym:'009830.KS', name:'한화솔루션', sector:'Technology', index:'KOSPI' },
  { sym:'012510.KS', name:'더존비즈온', sector:'Technology', index:'KOSPI' },
  { sym:'030520.KQ', name:'한글과컴퓨터', sector:'Technology', index:'KOSDAQ' },
  { sym:'041020.KQ', name:'폴라리스오피스', sector:'Technology', index:'KOSDAQ' },
  { sym:'304100.KQ', name:'솔트룩스', sector:'Technology', index:'KOSDAQ' },
  { sym:'005940.KS', name:'NH투자증권', sector:'Financials', index:'KOSPI' },
  { sym:'039490.KS', name:'키움증권', sector:'Financials', index:'KOSPI' },
  { sym:'003490.KS', name:'대한항공', sector:'Industrials', index:'KOSPI' },
  { sym:'020560.KS', name:'아시아나항공', sector:'Industrials', index:'KOSPI' },
  { sym:'180640.KS', name:'한진칼', sector:'Industrials', index:'KOSPI' },
  { sym:'326030.KS', name:'SK바이오팜', sector:'Healthcare', index:'KOSPI' },
  { sym:'ALAB', name:'Astera Labs', sector:'Technology', index:'NASDAQ100' },
  { sym:'LSCC', name:'Lattice Semiconductor', sector:'Technology', index:'NASDAQ100' },
];

// ARX-16 compatibility boundary: quantitative and identity consumers should
// read the canonical native screener state when it is ready. The legacy DB is
// a fallback only, and native rows may be enriched with fields that the
// published artifact does not yet carry (for example curated memo metadata).
function _aioGetCanonicalScreenerRows() {
  try {
    var arch = window.AIO_ARCH;
    if (arch && typeof arch.getScreenerRows === 'function') {
      var rows = arch.getScreenerRows();
      if (Array.isArray(rows) && rows.length) return rows;
    }
  } catch (_) {}
  return Array.isArray(window.SCREENER_DB) ? window.SCREENER_DB : [];
}


// ── ADR% 추정 함수 (Jeff Sun CFTe 프레임워크 기반) ──
// mcap 티어 + 섹터 변동성 보정으로 ADR% 추정
// ADR%(Average Daily Range) = 하루 평균 변동폭 비율. 높을수록 변동성 큼.
var AIO_TELEGRAM_WEEKLY_DIGEST = { asOf:null, window:null, marketDataAsOf:null, sources:[], counts:{ total:0 }, themes:[], catalysts:[], categories:[], pageMap:{} };
try { window.AIO_TELEGRAM_WEEKLY_DIGEST = AIO_TELEGRAM_WEEKLY_DIGEST; } catch(_) {}
var AIO_TELEGRAM_CATEGORY_REGISTRY = AIO_TELEGRAM_WEEKLY_DIGEST.categories || [];
var AIO_TELEGRAM_PAGE_INTEGRATION_MAP = AIO_TELEGRAM_WEEKLY_DIGEST.pageMap || {};
try {
  window.AIO_TELEGRAM_CATEGORY_REGISTRY = AIO_TELEGRAM_CATEGORY_REGISTRY;
  window.AIO_TELEGRAM_PAGE_INTEGRATION_MAP = AIO_TELEGRAM_PAGE_INTEGRATION_MAP;
} catch(_) {}

function _aioTelegramWindowLabel(sinceIso, untilIso) {
  try {
    var fmt = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' });
    var s = sinceIso ? fmt.format(new Date(sinceIso)) : null;
    var u = untilIso ? fmt.format(new Date(untilIso)) : null;
    return (s && u) ? (s + '~' + u + ' KST') : null;
  } catch(_) { return null; }
}

function _aioBuildTelegramRuntimeNarrative(raw) {
  var items = Array.isArray(raw && raw.broadItems) ? raw.broadItems : (Array.isArray(raw && raw.topItems) ? raw.topItems : []);
  var topicCounts = raw && raw.topicCounts && typeof raw.topicCounts === 'object' ? raw.topicCounts : {};
  var tickerCounts = raw && raw.tickerCounts && typeof raw.tickerCounts === 'object' ? raw.tickerCounts : {};
  var labels = { macro:'Macro/Rates', geo:'Geopolitics', credit:'Credit/Funding', semi:'Semiconductors/Memory', optical:'Optical/Networking', power:'AI Power/Grid', 'ai-policy':'AI Policy/Export Controls', 'kr-market':'Korea Market', equity:'Equity/Analyst', crypto:'Crypto/Risk', earnings:'Earnings/Corporate', healthcare:'Healthcare/GLP-1', japan:'Japan Market', flows:'Positioning/Flows', insider:'Insider Activity', 'market-note':'Market Notes' };
  function clean(v, max) {
    var s = String(v || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max - 3).replace(/\s+\S*$/, '') + '...' : s;
  }
  function sampleFor(tag, ticker) {
    var row = items.find(function(it) {
      return it && (tag ? Array.isArray(it.tags) && it.tags.indexOf(tag) >= 0 : Array.isArray(it.tickers) && it.tickers.indexOf(ticker) >= 0);
    });
    return row ? clean(row.text || row.title || row.summary || '', 180) : '';
  }
  var rankedTopics = Object.keys(topicCounts).filter(function(tag) { return tag !== 'media-only' && Number(topicCounts[tag]) > 0; })
    .sort(function(a, b) { return Number(topicCounts[b]) - Number(topicCounts[a]); });
  var themes = rankedTopics.slice(0, 8).map(function(tag) {
    return (labels[tag] || tag) + ' (' + Number(topicCounts[tag]) + ' posts in 14-day research window): ' + (sampleFor(tag) || 'No retained full-text sample; see coverage metadata.');
  });
  var catalysts = Object.keys(tickerCounts).sort(function(a, b) { return Number(tickerCounts[b]) - Number(tickerCounts[a]); }).slice(0, 12).map(function(ticker) {
    return { key:ticker, count:Number(tickerCounts[ticker]), text:sampleFor(null, ticker) || (Number(tickerCounts[ticker]) + ' observed mentions in the 14-day research window.') };
  });
  var categories = Object.keys(labels).map(function(id) {
    return { id:id, label:labels[id], topics:[id], count:Number(topicCounts[id] || 0), focus:sampleFor(id) || ('No retained full-text sample; ' + Number(topicCounts[id] || 0) + ' observed posts in the 14-day research window.') };
  });
  var pageMap = {};
  Object.keys(_TG_PAGE_TAGS || {}).forEach(function(pageId) { pageMap[pageId] = (_TG_PAGE_TAGS[pageId] || []).slice(); });
  return { themes:themes, catalysts:catalysts, categories:categories, pageMap:pageMap };
}

function _aioNormalizeTelegramDigestPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  var base = AIO_TELEGRAM_WEEKLY_DIGEST || {};
  var channelRows = Array.isArray(raw.channels) ? raw.channels : [];
  var counts = { total: Number(raw.count || 0) || (base.counts && base.counts.total) || 0 };
  channelRows.forEach(function(ch) {
    if (ch && ch.channel) counts[ch.channel] = Number(ch.count || 0) || 0;
  });
  var sources = channelRows.length ? channelRows.map(function(ch) {
    return 'https://t.me/s/' + ch.channel;
  }) : (base.sources || []);
  var windowLabel = _aioTelegramWindowLabel(raw.since, raw.until) || base.window || '';
  var asOf = raw.generatedAt || raw.until || base.asOf || null;
  var generatedNarrative = _aioBuildTelegramRuntimeNarrative(raw);
  var merged = Object.assign({}, base, {
    asOf: asOf,
    window: windowLabel,
    sources: sources,
    counts: counts,
    topicCounts: raw.topicCounts && typeof raw.topicCounts === 'object' ? Object.assign({}, raw.topicCounts) : {},
    tickerCounts: raw.tickerCounts && typeof raw.tickerCounts === 'object' ? Object.assign({}, raw.tickerCounts) : {},
    themes: Array.isArray(raw.themes) ? raw.themes.slice(0, 12) : generatedNarrative.themes,
    catalysts: Array.isArray(raw.catalysts) ? raw.catalysts.slice(0, 20) : generatedNarrative.catalysts,
    categories: Array.isArray(raw.categories) ? raw.categories.slice(0, 30) : generatedNarrative.categories,
    pageMap: raw.pageMap && typeof raw.pageMap === 'object' ? Object.assign({}, raw.pageMap) : generatedNarrative.pageMap,
    rawTopItems: Array.isArray(raw.topItems) ? raw.topItems.slice(0, 45) : [],
    rawBroadItems: Array.isArray(raw.broadItems) ? raw.broadItems.slice(0, 400) : [],
    rawCurrent24hItems: Array.isArray(raw.current24hItems) ? raw.current24hItems.slice(0, 500) : [],
    current24hWindow: raw.current24hWindow && typeof raw.current24hWindow === 'object' ? Object.assign({}, raw.current24hWindow) : null,
    current24hCoverage: raw.current24hCoverage && typeof raw.current24hCoverage === 'object' ? Object.assign({}, raw.current24hCoverage) : null,
    rawBroadItemCount: Array.isArray(raw.broadItems) ? raw.broadItems.length : 0,
    rawItemCount: Number(raw.count || 0) || 0,
    retainedItemCount: Number(raw.retainedItemCount || 0) || 0,
    coverage: raw.coverage && typeof raw.coverage === 'object' ? Object.assign({}, raw.coverage) : null,
    rawChannels: channelRows,
    dynamicDigestLoaded: true,
    dynamicDigestSource: raw.source || 'telegram-public-mirror',
    pipelineNote: String(raw.pipelineNote || 'Automated public-data/telegram-digest.json loaded at boot; dynamic narrative unavailable in this artifact.')
  });
  return merged;
}

function _aioTelegramDigestMemoDate(raw, merged) {
  var iso = (raw && (raw.generatedAt || raw.until)) || (merged && merged.asOf) || '';
  try {
    if (iso) return new Date(iso).toISOString().slice(0, 10);
  } catch(_) {}
  return String(iso || '').slice(0, 10) || 'latest';
}

function _aioCleanTelegramMemoText(text) {
  var s = String(text || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 190) s = s.slice(0, 187).replace(/\s+\S*$/, '') + '...';
  return s;
}

function _aioBuildTelegramMemoOverlay(raw, merged) {
  var items = [];
  // broadItems 우선 (더 많은 티커 커버), 없으면 topItems 폴백. v51.98/Phase3[A1,B3] P598: 이전엔
  // 여기 raw.items(서버가 보내던 미압축 전체 배열, ~1.04MB) 폴백이 3번째로 있었으나, 서버가 더 이상
  // items를 보내지 않음(topItems/broadItems만 전송, 페이로드 46% 절감) — topItems/broadItems가 둘 다
  // 비어야만 타던 경로라 실질적으로 거의 트리거되지 않았고, 이제 그 데이터 자체가 없다.
  if (raw && Array.isArray(raw.current24hItems) && raw.current24hItems.length) items = raw.current24hItems;
  else if (raw && Array.isArray(raw.broadItems) && raw.broadItems.length) items = raw.broadItems;
  else if (raw && Array.isArray(raw.topItems) && raw.topItems.length) items = raw.topItems;
  var date = _aioTelegramDigestMemoDate(raw, merged);
  var byTicker = {};
  items.forEach(function(item) {
    if (!item || !Array.isArray(item.tickers) || !item.tickers.length) return;
    var text = _aioCleanTelegramMemoText(item.text || item.title || item.summary || '');
    if (!text) return;
    var score = Number(item.score || 0) || 0;
    item.tickers.forEach(function(t) {
      var sym = String(t || '').toUpperCase().trim();
      if (!sym) return;
      if (!byTicker[sym]) byTicker[sym] = [];
      if (byTicker[sym].length < 3) byTicker[sym].push({ text:text, score:score, channel:item.channel || '', url:item.url || '' });
    });
  });
  var overlays = {};
  Object.keys(byTicker).forEach(function(sym) {
    var rows = byTicker[sym].sort(function(a, b) { return (b.score || 0) - (a.score || 0); }).slice(0, 2);
    if (!rows.length) return;
    var body = rows.map(function(r) { return r.text; }).join(' / ');
    var suffix = rows.length > 1 ? ' · auto ' + rows.length + ' posts' : ' · auto';
    overlays[sym] = '[TG ' + date + suffix + '] ' + body;
  });
  return { date:date, source:(raw && raw.source) || (merged && merged.dynamicDigestSource) || 'telegram-public-mirror', byTicker:overlays, candidateItems:items.length };
}

function _aioApplyTelegramDigestToScreenerDb(raw, merged) {
  var db = (typeof SCREENER_DB !== 'undefined' && Array.isArray(SCREENER_DB)) ? SCREENER_DB : null;
  var built = _aioBuildTelegramMemoOverlay(raw, merged);
  var audit = { status:'unavailable', date:built.date, source:built.source, candidateItems:built.candidateItems, appliedCount:0, tickers:[], updatedAt:Date.now() };
  if (!db || !db.length) {
    try { window._aioTelegramMemoOverlayAudit = audit; } catch(_) {}
    return audit;
  }
  db.forEach(function(r) {
    if (!r || !r.sym) return;
    var sym = String(r.sym).toUpperCase();
    var overlay = built.byTicker && built.byTicker[sym];
    if (!overlay) return;
    var memo = String(r.memo || '');
    if (r._telegramMemoOverlay && memo.indexOf(r._telegramMemoOverlay) === 0) {
      memo = memo.slice(String(r._telegramMemoOverlay).length).replace(/^\s+/, '');
    }
    r._telegramMemoOverlay = overlay;
    r._telegramMemoAsOf = built.date;
    r._telegramMemoSource = built.source;
    r._telegramMemoItems = (built.byTicker[sym].match(/posts\]/) ? Number((built.byTicker[sym].match(/auto\s+(\d+)\s+posts/) || [])[1] || 2) : 1);
    r.memo = overlay + (memo ? ' ' + memo : '');
    audit.appliedCount++;
    audit.tickers.push(sym);
  });
  audit.status = audit.appliedCount ? 'ready' : 'no_match';
  try { window._aioTelegramMemoOverlayAudit = audit; } catch(_) {}
  return audit;
}

function _aioApplyTelegramDigestPayload(raw) {
  var merged = _aioNormalizeTelegramDigestPayload(raw);
  if (!merged) return false;
  var memoOverlay = _aioApplyTelegramDigestToScreenerDb(raw, merged);
  AIO_TELEGRAM_WEEKLY_DIGEST = merged;
  AIO_TELEGRAM_CATEGORY_REGISTRY = merged.categories || [];
  AIO_TELEGRAM_PAGE_INTEGRATION_MAP = merged.pageMap || {};
  try {
    window.AIO_TELEGRAM_WEEKLY_DIGEST = AIO_TELEGRAM_WEEKLY_DIGEST;
    window.AIO_TELEGRAM_CATEGORY_REGISTRY = AIO_TELEGRAM_CATEGORY_REGISTRY;
    window.AIO_TELEGRAM_PAGE_INTEGRATION_MAP = AIO_TELEGRAM_PAGE_INTEGRATION_MAP;
    window.AIO_TELEGRAM_BROAD_ITEMS = merged.rawBroadItems || merged.rawTopItems || [];
    window.AIO_TELEGRAM_CURRENT_ITEMS = merged.rawCurrent24hItems || [];
    var _collectionStatus = raw && raw.collectionStatus || 'unknown';
    window._aioTelegramDigestMeta = {
      status: _collectionStatus === 'failed' ? 'cached_after_collection_failure' : 'ready',
      loadedAt: Date.now(),
      asOf: merged.asOf,
      attemptedAt: raw && raw.attemptedAt || null,
      lastSuccessfulAt: raw && raw.lastSuccessfulAt || merged.asOf,
      collectionStatus: _collectionStatus,
      window: merged.window,
      count: merged.counts && merged.counts.total,
      retainedItemCount: merged.retainedItemCount || 0,
      coverage: merged.coverage || null,
      current24hWindow: merged.current24hWindow || null,
      current24hCoverage: merged.current24hCoverage || null,
      source: merged.dynamicDigestSource,
      memoOverlay: memoOverlay
    };
    if (window.DATA_SNAPSHOT && merged.asOf) {
      window.DATA_SNAPSHOT._telegramDigestUpdated = merged.asOf;
      window.DATA_SNAPSHOT._telegramDigestDate = new Date(merged.asOf).toISOString().slice(0, 10);
      window.DATA_SNAPSHOT._telegramDigestWindow = merged.window || window.DATA_SNAPSHOT._telegramDigestWindow;
      window.DATA_SNAPSHOT._narrativeUpdated = merged.asOf;
    }
    // v51.36: 데이터 로드 완료 → 모든 페이지 피드 즉시 갱신
    setTimeout(function() {
      try { if (typeof _aioInjectAllTelegramFeeds === 'function') _aioInjectAllTelegramFeeds(); } catch(_) {}
    }, 0);
  } catch(_) {}
  return true;
}

async function _aioLoadServerTelegramDigest() {
  try {
    var url = './public-data/telegram-digest.json?t=' + Math.floor(Date.now() / 3600000);
    var r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) {
      window._aioTelegramDigestMeta = { status:'unavailable', checkedAt:Date.now(), detail:'HTTP ' + r.status };
      return false;
    }
    var raw = await r.json();
    var ok = _aioApplyTelegramDigestPayload(raw);
    if (!ok) window._aioTelegramDigestMeta = { status:'unavailable', checkedAt:Date.now(), detail:'invalid payload' };
    return ok;
  } catch(e) {
    window._aioTelegramDigestMeta = { status:'unavailable', checkedAt:Date.now(), detail:(e && e.message) || 'fetch failed' };
    return false;
  }
}

try {
  window._aioNormalizeTelegramDigestPayload = _aioNormalizeTelegramDigestPayload;
  window._aioApplyTelegramDigestPayload = _aioApplyTelegramDigestPayload;
  window._aioApplyTelegramDigestToScreenerDb = _aioApplyTelegramDigestToScreenerDb;
  window._aioLoadServerTelegramDigest = _aioLoadServerTelegramDigest;
} catch(_) {}

// ── v51.37: 텔레그램 분석·가공 카드 피드 렌더러 ──────────────────────
var _TG_PAGE_TAGS = {
  'home':        ['kr-market','macro','credit','semi','ai-policy','equity','geo','earnings','flows','insider'],
  'signal':      ['kr-market','equity','semi','macro','geo','credit','earnings','flows','insider'],
  'breadth':     ['macro','credit','equity','kr-market','geo','semi','power','flows'],
  'sentiment':   ['macro','credit','kr-market','equity','geo','crypto','flows','insider'],
  'briefing':    ['macro','market-note','credit','geo','semi','equity','kr-market','ai-policy','power','optical','earnings','healthcare','japan','flows','insider'],
  'technical':   ['semi','equity','power','optical','flows','earnings'],
  'macro':       ['macro','credit','geo','ai-policy','power','japan'],
  'fxbond':      ['macro','credit','geo','power','flows','japan'],
  'fundamental': ['equity','semi','credit','power','optical','ai-policy','kr-market','earnings','healthcare','insider'],
  'themes':      ['semi','power','optical','ai-policy','equity','kr-market','macro','credit','healthcare','japan'],
  'theme-detail':['semi','power','optical','ai-policy','equity','kr-market','macro','credit','healthcare','japan'],
  'portfolio':   ['equity','earnings','flows','insider','macro','credit','geo'],
  'ticker':      ['equity','earnings','insider','semi','power','optical','healthcare'],
  'market-news': ['macro','market-note','credit','geo','semi','equity','kr-market','ai-policy','optical','power','crypto','earnings','healthcare','japan','flows','insider'],
  'options':     ['macro','equity','flows','earnings','crypto','geo'],
  'screener':    ['equity','earnings','insider','semi','power','optical','healthcare','kr-market'],
  'principles':  ['macro','credit','semi','power','ai-policy','geo','japan'],
  'masters':     ['equity','earnings','flows','insider','macro','credit'],
  'atlas':       ['semi','optical','power','ai-policy','credit','equity','japan'],
  // v53.7 (P725): kr-home/kr-supply/kr-themes 컨테이너 퇴역 — kr-macro/kr-technical 피드는 통합 섹션에 이관돼 유지
  'kr-macro':    ['kr-market','macro','credit','semi','ai-policy','geo','japan'],
  'kr-technical':['kr-market','semi','equity','macro','geo','flows'],
  'guide':       [],
};// [0]=표시라벨 [1]=최대건수 [2]=본문표시 [3]=정렬(score|date) [4]=compact
var _TG_PAGE_CFG = {
  'home':        ['오늘 시장 핵심',             3,  false, 'score', true ],
  'signal':      ['방향성 시그널',              4,  false, 'score', true ],
  'breadth':     ['시장 내부 동향',             4,  false, 'score', true ],
  'sentiment':   ['시장 심리 동향',             4,  false, 'score', false],
  'briefing':    ['채널 인사이트',              8,  true,  'date',  false],
  'technical':   ['기술적 이슈',                3,  false, 'score', true ],
  'macro':       ['거시·금리 동향',             5,  true,  'score', false],
  'fxbond':      ['환율·채권·크레딧 동향',      5,  true,  'score', false],
  'fundamental': ['기업·AI 밸류체인 피드',      4,  false, 'score', false],
  'themes':      ['테마·CAPEX 피드',            4,  false, 'score', true ],
  'theme-detail':['테마 상세 피드',             4,  false, 'score', true ],
  'market-news': ['텔레그램 전체 피드',         12, true,  'date',  false],
  'kr-macro':    ['한국 매크로 소식',            4,  true,  'score', false],
  'kr-technical':['한국 차트 소식',              3,  false, 'score', true ],
};
// 카테고리 → 한국어 라벨 + CSS 클래스
var _TG_CAT_MAP = {
  'kr-market':  { label:'한국장',     cls:'tg-cat-kr'     },
  'semi':       { label:'반도체',     cls:'tg-cat-semi'   },
  'credit':     { label:'자금조달',   cls:'tg-cat-macro'  },
  'macro':      { label:'매크로',     cls:'tg-cat-macro'  },
  'geo':        { label:'지정학',     cls:'tg-cat-geo'    },
  'ai-policy':  { label:'AI정책',     cls:'tg-cat-ai'     },
  'equity':     { label:'주식분석',   cls:'tg-cat-equity' },
  'power':      { label:'전력인프라', cls:'tg-cat-semi'   },
  'optical':    { label:'광통신',     cls:'tg-cat-semi'   },
  'crypto':     { label:'크립토',     cls:'tg-cat-other'  },
  'market-note':{ label:'시장소식',   cls:'tg-cat-other'  },
};
_TG_CAT_MAP.earnings = { label:'실적', cls:'tg-cat-equity' };
_TG_CAT_MAP.healthcare = { label:'헬스케어', cls:'tg-cat-other' };
_TG_CAT_MAP.japan = { label:'일본', cls:'tg-cat-macro' };
_TG_CAT_MAP.flows = { label:'수급', cls:'tg-cat-macro' };
_TG_CAT_MAP.insider = { label:'내부자', cls:'tg-cat-equity' };
var _TG_CH_SRC = {
  aetherjapanresearch: 'Aether·JP',
  insidertracking:     'Insider·US',
  bornlupin:           'BornLupin·KR',
  HANAchina:           'HANA·China/EM',
};
var _TG_KR_NAME = {
  '005930.KS':'삼성전자','000660.KS':'SK하이닉스','009150.KS':'삼성전기',
  '6981.T':'무라타','6600.T':'키옥시아','000270.KS':'기아','005380.KS':'현대차',
  '035420.KS':'NAVER','035720.KS':'카카오','051910.KS':'LG화학',
};

// 텍스트에서 핵심 정보 추출·가공
function _aioProcessTelegramItem(it) {
  // P558/R249: it.text originates from public Telegram channels the app operator does not
  // control. This function used to build hlHeadline/body from the raw, unescaped text and
  // _aioRenderTelegramFeedHtml inserted them straight into innerHTML — a post containing
  // "<img src=x onerror=...>" would execute on every one of the 9 pages that render this
  // feed. Escaping here, at the single point where the raw text enters this pipeline, fixes
  // every downstream consumer at once instead of patching each render call site.
  var raw = escHtml((it.text || it.summary || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim()); // P715: summary-only 아티팩트 호환

  // 1) 감성 판단
  var bearKw = ['급락','하락','하향','약세','사이드카','손실','주의','경계','붕괴','폭락','위험','매도','하락세','공포','리스크','충격','쇼크','제재','관세','위기'];
  var bullKw = ['급등','상승','상향','강세','호실적','목표주가 상향','매수','반등','돌파','신고가','수혜','호조','강한','증가','성장','상회','수주','호재','회복'];
  var t = raw;
  var bScore = bearKw.reduce(function(s,k){ return s + (t.indexOf(k)>=0?1:0); }, 0);
  var uScore = bullKw.reduce(function(s,k){ return s + (t.indexOf(k)>=0?1:0); }, 0);
  var sent = bScore > uScore ? 'bear' : uScore > bScore ? 'bull' : 'neutral';
  if (it.score && it.score < 45) sent = 'neutral';

  // 2) 1차 카테고리
  var primaryTag = (it.tags || ['market-note'])[0];
  var cat = _TG_CAT_MAP[primaryTag] || { label: primaryTag, cls: 'tg-cat-other' };

  // 3) 헤드라인 추출: 첫 의미 있는 문장(개행·대시 기준, ≥10자)
  var parts = raw.split(/\n|(?<=\S)[ ]+—[ ]+|(?<=\S)[ ]+─[ ]+/);
  var headline = '';
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].trim();
    if (p.length >= 10) { headline = p; break; }
  }
  if (!headline) headline = raw;
  if (headline.length > 120) headline = headline.slice(0, 117) + '…';

  // 4) 수치 하이라이트
  var numRe = /([+\-▲▼]?\d[\d,]*(?:\.\d+)?\s*(?:%|bp|억|조|\$|₩|만원|달러|pt|배|배p))/g;
  var hlHeadline = headline.replace(numRe, '<span class="tg-num">$1</span>');

  // 5) 본문 요약(헤드라인 이후, ≤100자)
  var bodyRaw = raw.slice(headline.length).replace(/^\s*[—─·:\-]\s*/, '').trim();
  // 두 번째 의미 있는 문장만 추출
  var bodyParts = bodyRaw.split(/\n/);
  var body = '';
  for (var j = 0; j < bodyParts.length; j++) {
    var bp = bodyParts[j].trim();
    if (bp.length >= 12) { body = bp; break; }
  }
  if (!body && bodyRaw.length >= 12) body = bodyRaw;
  if (body.length > 100) body = body.slice(0, 97) + '…';

  // 6) 티커 방향 (base class 항상 포함)
  var tickerHtml = (it.tickers || []).slice(0, 4).map(function(tk) {
    var tkRe = new RegExp(tk.replace(/\./g, '\\.') + '[^가-힣]{0,20}([+\\-▲▼]\\d)', 'i');
    var m = raw.match(tkRe);
    var dirCls = '';
    if (m) dirCls = /[+▲]/.test(m[1]) ? ' tg-ticker-bull' : ' tg-ticker-bear';
    else if (sent === 'bull') dirCls = ' tg-ticker-bull';
    else if (sent === 'bear') dirCls = ' tg-ticker-bear';
    var label = _TG_KR_NAME[tk] || escHtml(tk);
    return '<span class="tg-ticker' + dirCls + '">' + label + '</span>';
  }).join('');

  return { sent: sent, cat: cat, hlHeadline: hlHeadline, body: body, tickerHtml: tickerHtml };
}

function _aioRenderTelegramFeedHtml(pageId) {
  try {
    // User-facing Telegram feeds consume only the completed 24-hour lane. The
    // rolling research digest remains available to chat/memo consumers, but it
    // must not silently become a current-market feed when the 24-hour lane is empty.
    var items = Array.isArray(window.AIO_TELEGRAM_CURRENT_ITEMS) ? window.AIO_TELEGRAM_CURRENT_ITEMS : [];
    var tags = _TG_PAGE_TAGS[pageId] || [];
    var cfg = _TG_PAGE_CFG[pageId] || ['최신 소식', 5, false, 'date', false];
    var feedLabel = cfg[0], maxItems = cfg[1], showBody = cfg[2], sortBy = cfg[3], compact = cfg[4];

    var statusMarkup = function(state, count, expected) {
      var n = window.AIO && typeof window.AIO.normalizeExternalSourceState === 'function'
        ? window.AIO.normalizeExternalSourceState({ status: state, count: count, expected: expected })
        : { status: state, label: state === 'success' ? '정상 수신' : '외부 수집 실패', allowedUse: state === 'success' ? 'decision' : 'none' };
      var cls = n.status === 'success' ? 'is-ok' : n.status === 'partial' ? 'is-partial' : 'is-fail';
      var note = n.status === 'success' ? '외부 피드 정상 수신' : n.status === 'partial' ? '일부 채널만 수신 · 참고용' : '외부 피드 실패 · 서버 다이제스트/기존 데이터 유지';
      return '<div class="tg-source-state ' + cls + '" data-external-source="telegram:' + escHtml(pageId) + '" data-state="' + n.status + '" title="' + escHtml(note) + '">' +
        '<span class="tg-source-state-dot"></span>' + escHtml(n.label) + ' · ' + escHtml(note) + '</div>';
    };
    if (!items.length || !tags.length) return statusMarkup('unavailable', 0, maxItems);

    // 태그 필터
    var filtered = items.filter(function(it) {
      return (it.tags || []).some(function(t) { return tags.indexOf(t) >= 0; });
    });

    // Filter out digest separators on all pages; keep long bank/research posts on analysis pages.
    filtered = filtered.filter(function(it) {
      var txt = it.text || it.summary || ''; // P715: summary-only 호환
      var allowLongReport = ['market-news','briefing','macro','fxbond','fundamental','themes','theme-detail'].indexOf(pageId) >= 0;
      if (txt.includes('━━━━')) return false;
      if (txt.length > 600 && !allowLongReport) return false;
      return true;
    });

    // score 정렬(중요도순) or 날짜순(이미 내림차순)
    if (sortBy === 'score') {
      filtered = filtered.slice().sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
    }
    filtered = filtered.slice(0, maxItems);
    if (!filtered.length) return statusMarkup('unavailable', 0, maxItems);

    // 감성 집계 + 카드 사전 처리
    var sentCounts = { bull: 0, bear: 0, neutral: 0 };
    var cards = filtered.map(function(it) {
      var info = _aioProcessTelegramItem(it);
      sentCounts[info.sent]++;
      return { it: it, info: info };
    });

    // 헤더
    var latestDate = (filtered[0].localDateKst || '').slice(5, 10);
    var currentWindow = window.AIO_TELEGRAM_WEEKLY_DIGEST && window.AIO_TELEGRAM_WEEKLY_DIGEST.current24hWindow;
    var windowLabel = currentWindow && currentWindow.label
      ? currentWindow.label
      : (window.AIO_TELEGRAM_WEEKLY_DIGEST && window.AIO_TELEGRAM_WEEKLY_DIGEST.window) || '완료된 24시간';
    var feedCls = 'tg-live-feed' + (compact ? ' tg-compact' : '');
    var feedState = filtered.length < maxItems ? 'partial' : 'success';
    var html = '<div class="' + feedCls + '">' + statusMarkup(feedState, filtered.length, maxItems);

    var sentBar = '';
    if (sentCounts.bull)    sentBar += '<span class="tg-sb-bull">▲' + sentCounts.bull + '</span>';
    if (sentCounts.neutral) sentBar += '<span class="tg-sb-neu">●' + sentCounts.neutral + '</span>';
    if (sentCounts.bear)    sentBar += '<span class="tg-sb-bear">▼' + sentCounts.bear + '</span>';

    html += '<div class="tg-live-feed-hd">'
          + '<span class="tg-live-dot"></span>'
          + '<span class="tg-live-hd-label">' + feedLabel + '</span>'
          + (sentBar ? '<span class="tg-sent-bar">' + sentBar + '</span>' : '')
          + '<span class="tg-live-hd-ts" title="' + escHtml(windowLabel) + '">' + latestDate + ' · ' + filtered.length + '건 · 최근 24시간</span>'
          + '</div>';

    // 카드 렌더
    cards.forEach(function(item) {
      var it = item.it, info = item.info;
      var sentLabel = { bull:'▲ 상승', bear:'▼ 하락', neutral:'● 중립' }[info.sent];
      var sentCls   = { bull:'tg-sent-bull', bear:'tg-sent-bear', neutral:'tg-sent-neutral' }[info.sent];
      var src = _TG_CH_SRC[it.channel] || (it.channel || '');
      var date = (it.localDateKst || '').slice(5, 10);

      html += '<div class="tg-card">'
            + '<a href="' + escHtml(escUrl(it.url || '#')) + '" target="_blank" rel="noopener" class="tg-card-inner">'
            + '<div class="tg-card-hd">'
            + '<span class="tg-cat ' + info.cat.cls + '">' + info.cat.label + '</span>'
            + '<span class="tg-sent ' + sentCls + '">' + sentLabel + '</span>'
            + '<span class="tg-card-src">' + src + ' · ' + date + '</span>'
            + '</div>'
            + '<div class="tg-card-headline">' + info.hlHeadline + '</div>'
            + (showBody && info.body ? '<div class="tg-card-body">' + info.body + '</div>' : '')
            + (info.tickerHtml ? '<div class="tg-card-ft">' + info.tickerHtml + '</div>' : '')
            + '</a>'
            + '</div>';
    });

    // 전체 피드 CTA (market-news 페이지 제외)
    if (pageId !== 'market-news') {
      html += '<div class="tg-feed-more">'
            + '<span class="cross-link" data-action="showPage" data-arg="market-news">전체 채널 피드 →</span>'
            + '</div>';
    }

    html += '</div>';
    return html;
  } catch(_) { return ''; }
}

function _aioInjectTelegramFeed(pageId) {
  try {
    var el = document.getElementById('tg-feed-' + pageId);
    if (!el) return;
    var html = _aioRenderTelegramFeedHtml(pageId);
    el.innerHTML = html;
  } catch(_) {}
}

function _aioInjectAllTelegramFeeds() {
  Object.keys(_TG_PAGE_TAGS).forEach(_aioInjectTelegramFeed);
}

try {
  window._aioInjectTelegramFeed = _aioInjectTelegramFeed;
  window._aioInjectAllTelegramFeeds = _aioInjectAllTelegramFeeds;
} catch(_) {}
// ── END v51.36 텔레그램 피드 렌더러 ────────────────────────────────

function getAdrEstimate(r) {
  var base;
  if (r.mcap >= 1000) base = 1.5;      // MEGA (1T+)
  else if (r.mcap >= 100) base = 2.0;  // LARGE (100B-1T)
  else if (r.mcap >= 10) base = 3.0;   // MID-LARGE (10-100B)
  else if (r.mcap >= 2) base = 4.5;    // MID (2-10B)
  else base = 6.0;                     // SMALL (<2B)
  var sectorMult = {
    'Technology': 1.2, 'Healthcare': 1.3, 'Energy': 1.1,
    'Communication Services': 1.1, 'Financials': 0.9,
    'Industrials': 0.9, 'Materials': 1.0, 'Consumer': 1.0,
    'Consumer Defensive': 0.7, 'Utilities': 0.6, 'Real Estate': 0.8
  };
  var mult = sectorMult[r.sector] || 1.0;
  return +(base * mult).toFixed(1);
}

var _scrSortCol = 'mcap';
var _scrSortAsc = false;
var _scrVisibleLimit = 12;
// v49.1 P184: AIO.state 등록
if (window.AIO && window.AIO.state) {
  window.AIO.state._scrSortCol = _scrSortCol;
  window.AIO.state._scrSortAsc = _scrSortAsc;
}

// ── 자연어 검색 키워드 앨리어스 (한국어 ↔ 영어 매핑) ──
var SCR_KEYWORD_ALIASES = {
  // AI / 인공지능
  'ai': ['NVDA','GOOGL','MSFT','META','AMZN','PLTR','AMD','ARM','AVGO','NOW','CRWD','PANW','INTC','TSM','AAPL','ORCL','CRM','SNOW','DDOG','MRVL','SOUN'],
  '인공지능': ['NVDA','GOOGL','MSFT','META','AMZN','PLTR','AMD','ARM','AVGO','NOW','CRWD','PANW','INTC','TSM','AAPL','ORCL','CRM','SNOW','DDOG','MRVL','SOUN'],
  'llm': ['GOOGL','META','MSFT','NVDA','PLTR'],
  '챗봇': ['GOOGL','META','MSFT'],
  // 반도체
  '반도체': ['NVDA','AMD','INTC','TSM','AVGO','ARM','QCOM','MU','ASML','AMAT','LRCX','KLAC','SNPS','CDNS','MRVL'],
  'semiconductor': ['NVDA','AMD','INTC','TSM','AVGO','ARM','QCOM','MU','ASML','AMAT','LRCX','KLAC','SNPS','CDNS','MRVL'],
  '칩': ['NVDA','AMD','INTC','TSM','AVGO','ARM','QCOM','MU'],
  'gpu': ['NVDA','AMD'],
  'cpu': ['AMD','INTC','ARM','QCOM'],
  '파운드리': ['TSM','INTC'],
  '메모리': ['MU'],
  'hbm': ['MU','NVDA'],
  // 클라우드
  '클라우드': ['AMZN','MSFT','GOOGL','NOW','SNOW','DDOG','MDB','GTLB','ESTC','CFLT','NET'],
  'cloud': ['AMZN','MSFT','GOOGL','NOW','SNOW','DDOG','MDB','GTLB','ESTC','CFLT','NET'],
  'aws': ['AMZN'],
  'azure': ['MSFT'],
  'saas': ['NOW','CRWD','PANW','PLTR','WDAY','MNDY','DDOG','SNOW','GTLB','ESTC','PATH'],
  // 전기차 / 자동차
  '전기차': ['TSLA','RIVN','GM','F'],
  'ev': ['TSLA','RIVN','GM','F'],
  '자율주행': ['TSLA','GOOGL','MBLY','APTV'],
  'autonomous': ['TSLA','GOOGL','MBLY','APTV'],
  '로보택시': ['TSLA'],
  '테슬라': ['TSLA'],
  '자동차': ['TSLA','GM','F','RIVN'],
  'auto': ['TSLA','GM','F','RIVN'],
  // 방산 / 국방
  '방산': ['RTX','LMT','NOC','GD','HII','BA','GE','HON','HWM','LHX'],
  '국방': ['RTX','LMT'],
  'defense': ['RTX','LMT'],
  '무기': ['RTX','LMT'],
  '미사일': ['RTX','LMT'],
  '패트리어트': ['RTX'],
  // 에너지
  '에너지': ['XOM','CVX','SLB','COP','EOG','OXY','SHEL','TTE','BP','HAL','BKR','DVN'],
  '석유': ['XOM','CVX','SLB','COP','SHEL','TTE','BP'],
  '오일': ['XOM','CVX','SLB','COP','SHEL','TTE','BP'],
  '유전': ['SLB','HAL','BKR'],
  // 배당
  '배당': ['XOM','CVX','WMT','COST','JPM','V','GS','DE','KO','PEP','PG','JNJ','ABBV','MRK','VZ','T','MCD','HD'],
  'dividend': ['XOM','CVX','WMT','COST','JPM','V','GS','DE'],
  // 바이오 / 헬스케어
  '바이오': ['LLY','MRNA','UNH','AMGN','REGN','VRTX','GILD','ISRG','TMO','PFE','JNJ','ABBV','MRK'],
  'bio': ['LLY','MRNA','UNH'],
  '제약': ['LLY','MRNA'],
  'pharma': ['LLY','MRNA'],
  '비만': ['LLY','NVO','AMGN','VKTX'],
  'obesity': ['LLY','NVO','AMGN','VKTX'],
  'glp-1': ['LLY','NVO','AMGN','VKTX'],
  'glp': ['LLY','NVO','AMGN','VKTX'],
  'mrna': ['MRNA'],
  '헬스케어': ['LLY','MRNA','UNH'],
  // 핀테크 / 금융
  '핀테크': ['V','MA','XYZ','COIN','JPM','GS','SOFI','AFRM','UPST','AXP','BLK','SPGI'],
  'fintech': ['V','XYZ','COIN','JPM','GS'],
  '은행': ['JPM','GS','BAC','WFC','MS','C','USB','PNC','SCHW','BK'],
  '결제': ['V','XYZ'],
  '암호화폐': ['COIN'],
  '비트코인': ['COIN','XYZ'],
  'crypto': ['COIN','XYZ'],
  // 우주 / 로켓
  '우주': ['RKLB','ASTS','LUNR','PL','RDW'],
  '로켓': ['RKLB'],
  '위성': ['ASTS','RKLB','PL'],
  'space': ['RKLB','ASTS','LUNR','PL','RDW'],
  // 원전 / 전력
  '원전': ['CEG','VST','CCJ','NRG','OKLO','TLN','SMR'],
  '원자력': ['CEG','VST','CCJ','NRG','OKLO','TLN','SMR'],
  'nuclear': ['CEG','VST','CCJ','NRG','OKLO','TLN','SMR'],
  '전력': ['CEG','VST','NRG','TLN','NEE','DUK'],
  '데이터센터전력': ['CEG','VST','NRG','TLN'],
  '우라늄': ['CCJ','SMR','OKLO'],
  'uranium': ['CCJ','SMR','OKLO'],
  // 사이버보안
  '사이버보안': ['CRWD','PANW','ZS','FTNT','NET'],
  '보안': ['CRWD','PANW','ZS','FTNT','NET'],
  'security': ['CRWD','PANW','ZS','FTNT','NET'],
  'cybersecurity': ['CRWD','PANW','ZS','FTNT','NET'],
  // 양자컴퓨팅
  '양자컴퓨팅': ['IONQ','RGTI','QUBT'],
  '양자': ['IONQ','RGTI','QUBT'],
  'quantum': ['IONQ','RGTI','QUBT'],
  // 산업재 / 인프라
  '인프라': ['CAT','DE'],
  '농업': ['DE'],
  '건설': ['CAT'],
  // 리테일 / 소비
  '리테일': ['WMT','COST','AMZN'],
  '소매': ['WMT','COST','AMZN'],
  '이커머스': ['AMZN','WMT'],
  // 소프트웨어
  '소프트웨어': ['MSFT','NOW','PLTR','CRWD','PANW'],
  'software': ['MSFT','NOW','PLTR','CRWD','PANW'],
  // 성장주
  '성장주': ['NVDA','PLTR','RKLB','ASTS','IONQ','ARM','CRWD','PANW','NOW'],
  'growth': ['NVDA','PLTR','RKLB','ASTS','IONQ','ARM','CRWD','PANW','NOW'],
  // 가치주
  '가치주': ['JPM','GS','XOM','CVX','WMT','COST','V','DE','CAT'],
  'value': ['JPM','GS','XOM','CVX','WMT','COST','V','DE','CAT'],
  // 매수/매도 신호
  '매수': 'BUY',
  'buy': 'BUY',
  '매도': 'SELL',
  'sell': 'SELL',
  '관망': 'WATCH',
  'watch': 'WATCH',
  '보유': 'HOLD',
  'hold': 'HOLD',
  // 추가 키워드 (확장)
  '다우': ['AAPL','MSFT','JPM','V','UNH','GS','HD','CAT','AMGN','MCD','CRM','HON','BA','IBM','DIS','NKE','KO','PG','MRK','JNJ','CVX','XOM','INTC','CSCO','WMT','MMM','VZ','DOW','TRV','AXP'],
  'dow': ['AAPL','MSFT','JPM','V','UNH','GS','HD','CAT','AMGN','MCD','CRM','HON','BA','IBM','DIS','NKE','KO','PG','MRK','JNJ','CVX','XOM','INTC','CSCO','WMT','MMM','VZ','DOW','TRV','AXP'],
  'dow30': ['AAPL','MSFT','JPM','V','UNH','GS','HD','CAT','AMGN','MCD','CRM','HON','BA','IBM','DIS','NKE','KO','PG','MRK','JNJ','CVX','XOM','INTC','CSCO','WMT','MMM','VZ','DOW','TRV','AXP'],
  '나스닥': ['AAPL','MSFT','NVDA','AMZN','META','GOOGL','TSLA','AVGO','AMD','MU','ARM','QCOM','PANW','CRWD','NOW','PLTR','MRVL','SNPS','CDNS','DDOG','SNOW','ZS','FTNT','TTD','NFLX','ADBE','INTU','MELI','SMCI','IONQ'],
  'nasdaq': ['AAPL','MSFT','NVDA','AMZN','META','GOOGL','TSLA','AVGO','AMD','MU','ARM','QCOM','PANW','CRWD','NOW','PLTR','MRVL','SNPS','CDNS','DDOG','SNOW','ZS','FTNT','TTD','NFLX','ADBE','INTU','MELI','SMCI','IONQ'],
  '러셀': ['SOFI','AFRM','UPST','RIOT','MARA','RGTI','LUNR','SMR','JOBY','CAVA','SOUN','IREN','RDW','QUBT','DNA','DM'],
  'russell': ['SOFI','AFRM','UPST','RIOT','MARA','RGTI','LUNR','SMR','JOBY','CAVA','SOUN','IREN','RDW','QUBT','DNA','DM'],
  '소형주': ['SOFI','AFRM','UPST','RIOT','MARA','RGTI','LUNR','SMR','JOBY','CAVA','SOUN','IREN','RDW','QUBT','DNA','DM'],
  'smallcap': ['SOFI','AFRM','UPST','RIOT','MARA','RGTI','LUNR','SMR','JOBY','CAVA','SOUN','IREN','RDW','QUBT','DNA','DM'],
  '대형주': ['AAPL','MSFT','NVDA','GOOGL','AMZN','META','AVGO','TSM','BRK.B','LLY','JPM','V','UNH','XOM','MA'],
  'megacap': ['AAPL','MSFT','NVDA','GOOGL','AMZN','META','AVGO','TSM','BRK.B','LLY','JPM','V','UNH','XOM','MA'],
  '로봇': ['ISRG','ROK','ABB','PATH','HON','DE','JOBY','FANUY'],
  'robot': ['ISRG','ROK','ABB','PATH','HON','DE','JOBY','FANUY'],
  '로보틱스': ['ISRG','ROK','ABB','PATH','FANUY'],
  'robotics': ['ISRG','ROK','ABB','PATH','FANUY'],
  'eda': ['SNPS','CDNS'],
  '장비': ['ASML','AMAT','LRCX','KLAC'],
  '보험': ['UNH','TRV','BRK.B','CB','ALL','PGR','HIG','ACGL','AFL','MET'],
  '음식': ['MCD','SBUX','KO','PEP','COST','WMT','CAVA'],
  '식음료': ['MCD','SBUX','KO','PEP','COST','WMT','CAVA'],
  '항공': ['BA','GE','RTX','LMT'],
  '통신': ['T','VZ','CSCO'],
  'telecom': ['T','VZ','CSCO'],
  '부동산': ['PLD','O','SPG','VTR','EQIX','DLR','AMT','PSA','IRM','SBAC','WELL'],
  'reit': ['PLD','O','SPG','VTR','EQIX','DLR','AMT','PSA','IRM','SBAC','WELL'],
  '유틸리티': ['NEE','CEG','VST','DUK','AEP','SO','D','NRG','EXC','XEL','AWK'],
  '클린에너지': ['NEE','ICLN','TAN'],
  '스트리밍': ['NFLX','DIS','SPOT','ROKU'],
  '소셜미디어': ['META','GOOGL','RDDT','PINS','SNAP','RBLX'],
  'social': ['META','GOOGL','RDDT','PINS','SNAP','RBLX'],
  '자산운용': ['BLK','BRK.B','GS','MS','SPGI'],
  'etf': ['SPY','QQQ','IWM','DIA','VOO','VTI','GLD','TLT','HYG','EEM','EFA','AGG','BND','SOXX','ARKK'],
  '지수': ['SPY','QQQ','IWM','DIA'],
  // 새 카테고리
  '광모듈': ['AAOI','COHR','LITE','CIEN','GLW','VIAV','MRVL'],
  '광통신': ['AAOI','COHR','LITE','CIEN','GLW','VIAV','MRVL'],
  'photonics': ['AAOI','COHR','LITE','CIEN','GLW','VIAV','MRVL'],
  'optical': ['AAOI','COHR','LITE','CIEN','GLW','VIAV','MRVL'],
  'ai-optical': ['COHR','LITE','MRVL','AAOI','GLW','CIEN'],
  'AI광학': ['COHR','LITE','MRVL','AAOI','GLW','CIEN'],
  '데이터센터': ['VRT','DELL','HPE','EQIX','DLR','ANET'],
  'datacenter': ['VRT','DELL','HPE','EQIX','DLR','ANET'],
  '밈주식': ['GME','AMC'],
  'meme': ['GME','AMC'],
  '텔레헬스': ['HIMS'],
  'telehealth': ['HIMS'],
  '게임': ['EA','TTWO','RBLX'],
  'gaming': ['EA','TTWO','RBLX'],
  '이커머스': ['AMZN','SHOP','ABNB','DASH','GRAB','SE','TOST'],
  'ecommerce': ['AMZN','SHOP','ABNB','DASH','GRAB','SE','TOST'],
  '배달': ['DASH','GRAB','TOST'],
  'delivery': ['DASH','GRAB','TOST'],
  '여행': ['ABNB','BKNG','UBER'],
  'travel': ['ABNB','BKNG','UBER'],
  '교육': ['DUOL'],
  'edtech': ['DUOL'],
  '광고': ['APP','TTD','GOOGL','META'],
  'adtech': ['APP','TTD','GOOGL','META'],
  '정밀의료': ['CRSP','TEM'],
  '유전자': ['CRSP','DNA'],
  'genomics': ['CRSP','DNA'],
  '인프라장비': ['URI','CAT','DE'],
  '철강': ['NUE','CLF','FCX'],
  'steel': ['NUE','CLF'],
  '핀테크앱': ['SOFI','AFRM','SQ','HOOD','PYPL','NU'],
  '결제앱': ['SQ','PYPL','HOOD'],
  'evtol': ['JOBY'],
  '에어택시': ['JOBY'],
  '소비재': ['LULU','DECK','CELH','ONON','NKE'],
  'consumer': ['LULU','DECK','CELH','ONON','NKE'],
  '애슬레저': ['LULU','ONON','DECK','NKE'],
  '음료': ['CELH','KO','PEP','MNST'],
  'hr': ['WDAY','MNDY'],
  '데이터분석': ['DDOG','SNOW','CFLT','ESTC','MDB','PLTR'],
  'analytics': ['DDOG','SNOW','CFLT','ESTC','MDB','PLTR'],
  '모빌리티': ['UBER','GRAB','RIVN'],
  // v34.7 감사 추가
  '드론': ['KTOS','AVAV','RKLB'],
  'drone': ['KTOS','AVAV','RKLB'],
  '리튬': ['LAC','ALB','SQM','LIT'],
  'lithium': ['LAC','ALB','SQM','LIT'],
  '메타버스': ['META','RBLX','U'],
  'metaverse': ['META','RBLX','U'],
  'sq': ['XYZ'],
  // ═══ v33.1: 확장 유니버스 앨리어스 ═══
  'adr': ['BABA','TSM','NVO','ASML','SHOP','SE','MELI','PDD','SONY','CPNG','BIDU','JD','TCOM','HSBC','TM','SHEL','RIO','BHP','VALE','PBR','INFY','NVS','AZN','UBS','SAP','UL','BTI','BUD','TTE','BP','NEM','AMX','NU','ITUB'],
  '해외주식': ['BABA','TSM','NVO','ASML','SHOP','SE','MELI','PDD','SONY','CPNG','BIDU','JD','TCOM','HSBC','TM','SHEL','RIO','BHP','VALE','PBR','INFY','NVS','AZN'],
  '중국주식': ['BABA','PDD','BIDU','JD','TCOM','NTES'],
  '일본주식': ['TM','SONY','MUFG','SMFG','MFG','TAK'],
  '인도주식': ['HDB','IBN','INFY'],
  '유럽주식': ['ASML','SAP','NVS','AZN','SHEL','TTE','BP','UBS','UL','BUD','BTI','HSBC','NVO','GSK','SNY','RIO','BHP','DEO'],
  '캐나다주식': ['SHOP','TD','RY','BMO','BNS','CM','ENB','CNQ','SU','TRP','CP','CNI'],
  '라틴아메리카': ['MELI','NU','PBR','VALE','ITUB','AMX','CPNG'],
  '대체투자': ['BX','KKR','APO','ARES','BAM','BN'],
  'pe': ['BX','KKR','APO','ARES'],
  '에너지메이저': ['XOM','CVX','SHEL','TTE','BP','COP','EOG','OXY'],
  '정유': ['PSX','VLO','MPC'],
  '미드스트림': ['WMB','KMI','OKE','ENB','EPD','ET','MPLX','TRGP'],
  '천연가스': ['LNG','EQT','ET','WMB'],
  '유전서비스': ['SLB','HAL','BKR'],
  '대형은행': ['JPM','BAC','WFC','GS','MS','C','USB','PNC','TFC','SCHW','BK'],
  '지역은행': ['USB','PNC','TFC','MTB','RF','CFG','KEY','FITB'],
  '투자은행': ['GS','MS','JPM','BAC','C'],
  '보험확장': ['UNH','BRK.B','CB','ALL','PGR','HIG','ACGL','AFL','MET','PRU','MFC','AIG'],
  '신용평가': ['SPGI','MCO','MSCI'],
  '거래소': ['CME','ICE','CBOE','NDAQ','COIN'],
  '제약확장': ['LLY','NVO','JNJ','PFE','ABBV','MRK','NVS','AZN','BMY','GILD','AMGN','REGN','VRTX','GSK','SNY','TAK'],
  '의료기기': ['ISRG','MDT','BSX','SYK','BDX','EW','ABT','ALGN','PODD','DXCM'],
  '의료유통': ['MCK','CAH','COR','WBA','HSIC'],
  '관리의료': ['UNH','ELV','CI','CVS','MOH','HCA'],
  '항공우주': ['BA','RTX','LMT','NOC','GD','HII','LHX','HWM','TXT','TDG','HEI'],
  '물류확장': ['FDX','UPS','CSX','NSC','JBHT','EXPD','CHRW','CP','CNI','ODFL'],
  '철도': ['CSX','NSC','UNP','CP','CNI'],
  '산업자동화': ['EMR','ROK','ETN','PH','ITW','DOV','AME'],
  '전력장비': ['ETN','PH','HUBB','GEV','VRT','PWR'],
  'hvac': ['TT','CARR','LII','JCI','WSO'],
  '유틸리티확장': ['NEE','SO','DUK','D','AEP','EXC','XEL','WEC','PPL','EIX','ETR','FE','AES','CMS','NI','ED','AWK','PEG','NRG'],
  '리츠': ['PLD','AMT','EQIX','DLR','SPG','PSA','O','WELL','IRM','SBAC','EXR','AVB','ESS','MAA','VTR','KIM','ARE','WY'],
  '데이터센터리츠': ['EQIX','DLR','IRM','AMT'],
  '크루즈': ['CCL','RCL','NCLH'],
  '카지노': ['LVS','MGM','CZR','WYNN'],
  '호텔': ['HLT','MAR','BKNG','ABNB'],
  '주택건설': ['DHI','PHM','NVR','BLDR'],
  '필수소비': ['PG','KO','PEP','WMT','COST','CL','CHD','CLX','GIS','KDP','KR','KVUE','MO','PM','BTI','DEO','BUD','STZ'],
  '금광': ['NEM','AEM','B','AU','GFI','WPM','FNV'],
  '구리': ['FCX','SCCO','BHP','RIO'],
  '화학': ['DD','PPG','IFF','EMN','CE','DOW','ALB','CTVA'],
  '산업가스': ['LIN','APD'],
  'it컨설팅': ['ACN','INFY','CTSH','EPAM','IT'],
  '게임확장': ['EA','TTWO','RBLX','NTES','SONY','MTCH'],
  // 새 키워드 (Task 2 추가)
  'saaspocalypse': ['NOW','CRWD','PANW','PLTR','WDAY','MNDY','DDOG','SNOW','GTLB','ESTC','PATH'],
  '사스포칼립스': ['NOW','CRWD','PANW','PLTR','WDAY','MNDY','DDOG','SNOW','GTLB','ESTC','PATH'],
  'turboquant': ['MU','SNDK','WDC','STX','005930.KS','000660.KS'],
  'kv캐시': ['MU','SNDK','WDC','STX','005930.KS','000660.KS'],
  'kv cache': ['MU','SNDK','WDC','STX','005930.KS','000660.KS'],
  'basis trade': ['TLT','IEF','LQD','HYG','SHV','BRK.B','JPM'],
  'basistrade': ['TLT','IEF','LQD','HYG','SHV','BRK.B','JPM'],
  'agentic': ['AMD','INTC','NVDA','AVGO','ARM'],
  'arm agi': ['ARM','AVGO'],
  '레포': ['JPM','BLK','GS','MS','SLV','GLD'],
  '마진콜': ['JPM','BLK','GS','MS','BAC','WFC'],
  'ftd': ['TLT','IEF','BND','AGG','UST'],
  'openclaw': ['AAPL','DELL','HPQ','NVDA','AMD','INTC'],
  'nemoclaw': ['NVDA','AAPL','DELL','HPQ'],
  '800v': ['VRT','ETN','EATON','ECL'],
  '800v dc': ['VRT','ETN','EATON','ECL'],
  '버티브': ['VRT'],
  'vertiv': ['VRT'],
  'cpu병목': ['ARM','AMD','INTC','NVDA','AVGO'],
  'graviton': ['AMZN','ARM'],
  'cobalt': ['MSFT','ARM'],
  'axion': ['GOOGL','ARM'],
  '액체냉각': ['VRT','ETN','ECL'],
  'liquid cooling': ['VRT','ETN','ECL'],
  // ═══ v35.6: 한국 종목 검색 앨리어스 ═══
  '한국주식': ['005930.KS','000660.KS','373220.KS','207940.KS','005380.KS','012450.KS','000270.KS','035420.KS','068270.KS','105560.KS'],
  '코스피': ['005930.KS','000660.KS','373220.KS','207940.KS','005380.KS','012450.KS','000270.KS','035420.KS','068270.KS','105560.KS'],
  '코스닥': ['042700.KQ','196170.KQ','247540.KQ','044820.KQ','192820.KQ','454910.KQ','277810.KQ','278470.KQ','323410.KQ','033100.KQ'],
  'kospi': ['005930.KS','000660.KS','373220.KS','207940.KS','005380.KS','012450.KS','000270.KS','035420.KS','068270.KS','105560.KS'],
  'kosdaq': ['042700.KQ','196170.KQ','247540.KQ','044820.KQ','192820.KQ','454910.KQ','277810.KQ','278470.KQ','323410.KQ','033100.KQ'],
  'k반도체': ['005930.KS','000660.KS','042700.KQ','009150.KS','402340.KS','039030.KQ','403870.KQ','058470.KQ'],
  'k방산': ['012450.KS','047810.KS','079550.KS','064350.KS','272210.KS','000880.KS','103140.KS'],
  'k조선': ['042660.KS','329180.KS','009540.KS','010140.KS','010620.KS','267250.KS'],
  'k전력': ['298040.KS','267260.KS','010120.KS','015760.KS','103590.KS','006260.KS'],
  'k원전': ['034020.KS','000720.KS','052690.KS','051600.KS'],
  'k배터리': ['373220.KS','006400.KS','247540.KQ','051910.KS','005490.KS','096770.KS','086520.KQ','003670.KQ','066970.KQ'],
  'k바이오': ['068270.KS','207940.KS','196170.KQ','128940.KS','028300.KQ','000100.KS','326030.KS','141080.KQ'],
  'k뷰티': ['090430.KS','051900.KS','044820.KQ','192820.KQ','161890.KS','278470.KQ','257720.KQ','237880.KQ'],
  'k콘텐츠': ['259960.KS','352820.KS','041510.KQ','035900.KQ','122870.KQ','253450.KS','035760.KS'],
  'k푸드': ['003230.KS','097950.KS','271560.KS','004370.KS','280360.KS','005180.KS','000080.KS'],
  'k금융': ['105560.KS','055550.KS','086790.KS','316140.KS','138040.KS','032830.KS','000810.KS','323410.KQ'],
  'k로봇': ['454910.KQ','277810.KQ','315640.KQ','178320.KQ','005380.KS'],
  'k자동차': ['005380.KS','000270.KS','012330.KS','086280.KS','204320.KS'],
  '밸류업': ['105560.KS','055550.KS','086790.KS','316140.KS','138040.KS','005380.KS','000270.KS'],
  '삼성': ['005930.KS','207940.KS','006400.KS','009150.KS','032830.KS','000810.KS','018260.KS','028260.KS','016360.KS'],
  '현대': ['005380.KS','000270.KS','012330.KS','086280.KS','267260.KS','329180.KS','009540.KS','000720.KS','064350.KS'],
  'sk': ['000660.KS','402340.KS','096770.KS','017670.KS','034730.KS','326030.KS'],
  '한화': ['012450.KS','042660.KS','272210.KS','000880.KS','082740.KS','009830.KS'],
  'lg': ['373220.KS','051910.KS','051900.KS','003550.KS','066570.KS','032640.KS'],
};


function renderScreenerResults() {
  // ARX-10 compatibility hook: the native screener page owns this DOM.
  try { document.dispatchEvent(new CustomEvent('aio:screener:render-request')); } catch (_) {}
  return;
}

// ARX-10: native screener owns controls, table, factor panel, and backtest DOM.
var AIO_TRADER_PROFILES = {
  balanced: { label:'⚖ 균형', desc:'레짐 기반 자동 가중 (권장)', weights:null },
  momentum: { label:'🚀 모멘텀', desc:'단기 추세 추종 · 1~4주 보유', weights:{momentum:0.40,trend:0.25,lowvol:0.08,size:0.05,value:0.06,quality:0.06,kalman:0.10} },
  swing: { label:'📈 스윙', desc:'중기 기술적 매매 · 2~8주 보유', weights:{momentum:0.30,trend:0.28,lowvol:0.12,size:0.07,value:0.07,quality:0.07,kalman:0.09} },
  value: { label:'💎 가치', desc:'저평가 장기 투자 · 3~12개월 보유', weights:{momentum:0.12,trend:0.15,lowvol:0.15,size:0.08,value:0.30,quality:0.15,kalman:0.05} },
  lowrisk: { label:'🛡 저리스크', desc:'방어적 저변동 우선 · 하락방어 포커스', weights:{momentum:0.10,trend:0.15,lowvol:0.38,size:0.05,value:0.12,quality:0.15,kalman:0.05} }
};
window.AIO_TRADER_PROFILES = AIO_TRADER_PROFILES;
window._aioGetActiveProfile = function() {
  var profile = null;
  try { profile = localStorage.getItem('aio_trader_profile'); } catch (_) {}
  return profile && AIO_TRADER_PROFILES[profile] ? profile : 'balanced';
};
window._aioSetProfile = function(key) {
  if (!key || !AIO_TRADER_PROFILES[key]) key = 'balanced';
  try { localStorage.setItem('aio_trader_profile', key); } catch (_) {}
  try { if (typeof _aioComputeFactorRanks === 'function') _aioComputeFactorRanks(); } catch (_) {}
  try { window.dispatchEvent(new CustomEvent('aio:screener:profile', { detail:key })); } catch (_) {}
};
window._aioWatchlistGet = function() {
  try { return JSON.parse(localStorage.getItem('aio_watchlist') || '[]'); } catch (_) { return []; }
};
window._aioWLToggle = function(sym) {
  if (!sym) return;
  var watchlist = window._aioWatchlistGet();
  var index = watchlist.indexOf(sym);
  if (index >= 0) watchlist.splice(index, 1);
  else if (watchlist.length < 100) watchlist.push(sym);
  try { localStorage.setItem('aio_watchlist', JSON.stringify(watchlist)); } catch (_) {}
 try { window.dispatchEvent(new CustomEvent('aio:screener:watchlist', { detail:{ symbol:sym, watchlist:watchlist } })); } catch (_) {}
};


// v50.38 트랙1: 누락됐던 _fetchYahooChartData 복구 (핵심 버그 — 8곳에서 호출되나 정의 부재였음).
//   스파크라인(_aioBuildSparklineSvg)·OHLCV 폴백(fetchOHLCVWithFallback)·VIX/HY/SPY 차트가 공통 의존.
//   Yahoo v8 chart를 fetchViaProxy(CORS 프록시 체인 + stale-cache 폴백) 경유로 받아 OHLCV 배열 반환.
//   소비자 기대 형태: { closes, opens, highs, lows, volumes, timestamps }(유닉스초). close는 null 포함 가능 → 소비자가 filter.
window._fetchYahooChartData = async function(symbol, range, interval) {
  if (!symbol) return null;
  range = range || '1mo';
  interval = interval || '1d';
  var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) +
    '?range=' + encodeURIComponent(range) + '&interval=' + encodeURIComponent(interval) + '&includePrePost=false';
  try {
    var json;
    if (typeof fetchViaProxy === 'function') {
      json = await fetchViaProxy(url, { parseJson: true, timeout: 7000 });
    } else {
      var r = await fetchWithTimeout(url, {}, 7000);
      json = await r.json();
    }
    var res = json && json.chart && json.chart.result && json.chart.result[0];
    if (!res) return null;
    var q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
    return {
      symbol: symbol,
      timestamps: res.timestamp || [],
      closes: q.close || [],
      opens: q.open || [],
      highs: q.high || [],
      lows: q.low || [],
      volumes: q.volume || [],
      meta: res.meta || null
    };
  } catch(e) {
    if (typeof _aioLog === 'function') _aioLog('warn', 'fetch', '_fetchYahooChartData 실패 ' + symbol + ': ' + (e && e.message || e));
    return null;
  }
};
// 모듈 스코프에서도 typeof _fetchYahooChartData 가드가 통하도록 로컬 별칭 (aio-ui.js 등 비-window 참조 호환)
var _fetchYahooChartData = window._fetchYahooChartData;


// v39.2: screener 제거됨
function switchTab(tabId, el) {
  // Handle both switchTab(el, tabId) and switchTab(tabId) forms
  if (el && typeof el === 'string') { var tmp = tabId; tabId = el; el = tmp; }
  const page = (el && el.closest) ? (el.closest('.page') || document.getElementById('page-ticker')) : document.getElementById('page-ticker');
  if (page) page.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
  if (el && el.classList) el.classList.add('active');
  ['tab-overview','tab-chart','tab-financials','tab-technical','tab-fundamental','tab-monalert'].forEach(function(id){
    const el2 = document.getElementById(id);
    if(el2) el2.style.display = (id === tabId) ? '' : 'none';
  });
  // v27.1: Chart 탭 선택 시 자동으로 차트 로드
  if (tabId === 'tab-chart' && typeof loadTickerChart === 'function') {
    setTimeout(function(){ loadTickerChart('3m', null); }, 100);
  }
}
function switchThemeMode(mode) {
  const etfView = document.getElementById('etf-view');
  const subView = document.getElementById('subtheme-view');
  const etfBtn = document.getElementById('etf-btn');
  const subBtn = document.getElementById('sub-btn');
  const desc = document.getElementById('theme-mode-desc');
  if(mode === 'etf') {
    etfView.style.display = '';
    subView.style.display = 'none';
    etfBtn.style.background = 'var(--accent-dim)'; etfBtn.style.color = 'var(--accent)'; etfBtn.style.fontWeight = '600';
    subBtn.style.background = 'transparent'; subBtn.style.color = 'var(--text-secondary)'; subBtn.style.fontWeight = 'normal';
    desc.textContent = '대표 ETF 기준 · 누구나 바로 매매 가능한 상품';
  } else {
    etfView.style.display = 'none';
    subView.style.display = '';
    subBtn.style.background = 'var(--accent-dim)'; subBtn.style.color = 'var(--accent)'; subBtn.style.fontWeight = '600';
    etfBtn.style.background = 'transparent'; etfBtn.style.color = 'var(--text-secondary)'; etfBtn.style.fontWeight = 'normal';
    desc.textContent = '개별 종목 equal-weighted % 평균 · 고수 전용 세분화 지수';
  }
}
// ═══════════════════════════════════════════════════════════════
// AIO LIVE DATA ENGINE v1.0
// 나라별 우선순위 기반 멀티소스 실시간 뉴스 + 시세 데이터
// ═══════════════════════════════════════════════════════════════

// ── 소스 정의 ─────────────────────────────────────────────────

// ── Country flag mapping ────────────────────────────────────────
const COUNTRY_FLAG = {
  us: '🇺🇸', kr: '', asia: '', eu: '🇪🇺',
  jp: '🇯🇵', cn: '🇨🇳', tw: '🇹🇼', sg: '🇸🇬',
  gb: '🇬🇧', de: '🇩🇪', fr: '🇫🇷', au: '🇦🇺',
};
function getCountryFlag(country) {
  return COUNTRY_FLAG[country] || COUNTRY_FLAG[(country||'').toLowerCase()] || '';
}

/* ═══════════════════════════════════════════════════════════════
   v20 DATA ENGINE — 실시간 & 지연 데이터 통합 모듈
   Budget: $50 total / 5 users ($10/user/mo) · GitHub Pages static hosting
   ═══════════════════════════════════════════════════════════════ */

// ── API Endpoints (모두 무료 또는 CORS 허용) ──────────────────
const DATA_APIS = {
  // 1. Alpha Vantage (무료 25회/일, 키 필수 — 기술적 지표)
  alphaVantage: {
    base: 'https://www.alphavantage.co/query',
    key: () => (typeof safeLSGetSync === 'function' ? safeLSGetSync('aio_av_key') : _getApiKey('aio_av_key')) || 'demo',
    limit: '25/day free · $50/mo for 75/min'
  },
  // 2. Twelve Data (무료 800회/일 — 시세, 차트, 기술지표)
  twelveData: {
    base: 'https://api.twelvedata.com',
    key: () => (typeof safeLSGetSync === 'function' ? safeLSGetSync('aio_td_key') : _getApiKey('aio_td_key')) || '',
    limit: '800/day free · 8 symbols/request'
  },
  // 3. Financial Modeling Prep (무료 250회/일 — 재무제표, 밸류에이션)
  fmp: {
    base: 'https://financialmodelingprep.com/stable',
    key: () => (typeof safeLSGetSync === 'function' ? safeLSGetSync('aio_fmp_key') : _getApiKey('aio_fmp_key')) || 'demo',
    limit: '250/day free · 5 years history'
  },
  // 4. FRED (무료, 키 필수 — 매크로 경제지표)
  fred: {
    base: 'https://api.stlouisfed.org/fred/series/observations',
    key: () => (typeof safeLSGetSync === 'function' ? safeLSGetSync('aio_fred_key') : _getApiKey('aio_fred_key')) || '',
    limit: 'Unlimited free · CORS friendly'
  },
  // 5. Finnhub (무료 60회/분 — 실시간 시세, 뉴스, 기업정보)
  finnhub: {
    base: 'https://finnhub.io/api/v1',
    key: () => (typeof safeLSGetSync === 'function' ? safeLSGetSync('aio_finnhub_key') : _getApiKey('aio_finnhub_key')) || '',
    limit: '60/min free · real-time US quotes'
  },
  // 6. CoinGecko (기존 유지 — 암호화폐)
  coingecko: { base: 'https://api.coingecko.com/api/v3', key: () => '', limit: '30/min free' },
  // v47.10: exchangeRate / altFearGreed 제거 — 선언만 있고 호출 0건 (dead code P112)
};

// ── API 키 관리 UI 확장 ──────────────────────────────────────
const API_KEY_CONFIG = [
  { id: 'aio_av_key',      label: 'Alpha Vantage',  placeholder: 'alphavantage.co 무료 키', url: 'https://www.alphavantage.co/support/#api-key' },
  { id: 'aio_td_key',      label: 'Twelve Data',    placeholder: 'twelvedata.com 무료 키',  url: 'https://twelvedata.com/account/api-keys' },
  { id: 'aio_fmp_key',     label: 'FMP',            placeholder: 'financialmodelingprep.com', url: 'https://site.financialmodelingprep.com/developer' },
  { id: 'aio_fred_key',    label: 'FRED',           placeholder: 'fred.stlouisfed.org API키', url: 'https://fred.stlouisfed.org/docs/api/api_key.html' },
  { id: 'aio_finnhub_key', label: 'Finnhub',        placeholder: 'finnhub.io 무료 키',       url: 'https://finnhub.io/register' },
];

// ── 유틸리티: 타임아웃 fetch ──────────────────────────────────
function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── v30.11 Task 11: CORS 프록시 레지스트리 (단일 진실 원천) ──────────────────
const _cfWorkerUrl = () => _getApiKey('aio_cf_worker_url') || '';

// P715: SCREENER_DB signal enum(BUY/HOLD/WATCH/SELL)은 내부 분류 키로만 유지하고,
// 사용자 표면에는 관측형 라벨만 렌더한다(시스템 발화형 매매 지시 금지 — P714 연장).
function _scrSignalLabel(sig) {
  return { BUY:'강세 구조', HOLD:'중립', WATCH:'관찰', SELL:'약세 구조' }[sig] || sig || '—';
}
try { window._scrSignalLabel = _scrSignalLabel; } catch(_) {}

const _PROXY_REGISTRY = {
  list: [],
  init: function() {
    var cf = _cfWorkerUrl();
    this.list = [];
    // Tier 0: 자체 CF Worker (최우선)
    if (cf) this.list.push({ id:'cf-worker', label:'CF Worker', tier:0, mkUrl: function(u){ return cf+'?url='+encodeURIComponent(u); }, fails:0, okCount:0, failCount:0, lastOk:0, lastFail:0, disabled:false });
    // Tier 1: 검증된 공개 프록시
    this.list.push({ id:'corsproxy', label:'corsproxy.io', tier:1, mkUrl: function(u){ return 'https://corsproxy.io/?'+encodeURIComponent(u); }, fails:0, okCount:0, failCount:0, lastOk:0, lastFail:0, disabled:false });
    // Tier 2: 보조 프록시
    this.list.push({ id:'allorigins-raw', label:'allorigins/raw', tier:2, mkUrl: function(u){ return 'https://api.allorigins.win/raw?url='+encodeURIComponent(u); }, fails:0, okCount:0, failCount:0, lastOk:0, lastFail:0, disabled:false });
    this.list.push({ id:'allorigins-get', label:'allorigins/get', tier:2, mkUrl: function(u){ return 'https://api.allorigins.win/get?url='+encodeURIComponent(u); }, fails:0, okCount:0, failCount:0, lastOk:0, lastFail:0, disabled:false });
    this.list.push({ id:'codetabs', label:'codetabs.com', tier:2, mkUrl: function(u){ return 'https://api.codetabs.com/v1/proxy/?quest='+encodeURIComponent(u); }, fails:0, okCount:0, failCount:0, lastOk:0, lastFail:0, disabled:false });
  },
  markOk: function(id) {
    var p = this.list.find(function(x){ return x.id === id; });
    if (p) { p.fails = 0; p.okCount = (p.okCount || 0) + 1; p.lastOk = Date.now(); p.disabled = false; p.cooldownLevel = 0; } // v48.14: backoff 리셋
    if (typeof _reportApiOk === 'function') _reportApiOk('proxy-primary', id + ' 성공');
  },
  markFail: function(id, reason) {
    var p = this.list.find(function(x){ return x.id === id; });
    if (p) {
      p.fails++;
      p.failCount = (p.failCount || 0) + 1;
      p.lastFail = Date.now();
      // P784/SA-01: three consecutive chart-proxy failures open cooldown.
      if (p.fails >= 3) {
        p.disabled = true;
        // v48.14 (W13): exponential backoff + jitter — 60s → 120s → 240s → 480s → max 1800s
        p.cooldownLevel = (p.cooldownLevel || 0) + 1;
        var baseDelay = T.COOLDOWN * Math.pow(2, Math.min(p.cooldownLevel - 1, 5)); // 최대 32x
        var jitter = Math.random() * 0.3 * baseDelay; // ±30% jitter (thundering herd 방지)
        var actualDelay = Math.min(baseDelay + jitter, 1800000); // 30분 상한
        if (typeof _aioLog === 'function') {
          _aioLog('warn', 'proxy', 'proxy ' + id + ' disabled (level ' + p.cooldownLevel + ', cooldown ' + Math.round(actualDelay/1000) + 's)', { fails: p.fails });
        }
        setTimeout(function() {
          p.disabled = false;
          p.fails = 2;
          if (typeof _aioLog === 'function') _aioLog('info', 'proxy', 'proxy ' + id + ' re-enabled', { cooldownLevel: p.cooldownLevel });
        }, actualDelay);
      }
    }
  },
  getScore: function(p) {
    if (!p) return 0;
    var ok = p.okCount || 0;
    var fail = p.failCount || 0;
    var attempts = ok + fail;
    var rate = attempts ? ok / attempts : 0.5;
    var recency = p.lastOk ? Math.max(0, 1 - ((Date.now() - p.lastOk) / Math.max(1, T.COOLDOWN * 5))) : 0;
    var tierBias = Math.max(0, 3 - (p.tier || 3)) * 0.08;
    return (rate * 10) + recency + tierBias - ((p.fails || 0) * 0.35);
  },
  getActive: function() {
    var self = this;
    return this.list.filter(function(p){ return !p.disabled; }).sort(function(a,b){
      var scoreDiff = self.getScore(b) - self.getScore(a);
      if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
      var tierDiff = (a.tier || 9) - (b.tier || 9);
      if (tierDiff) return tierDiff;
      return (b.lastOk || 0) - (a.lastOk || 0);
    });
  },
  // 하위 호환: mkUrl 함수 배열 반환 (기존 PROXY_LIST 형태)
  getMkUrls: function() { return this.getActive().map(function(p){ return p.mkUrl; }); },
  // v35.7 CF Worker 부하 분산: 라운드로빈 카운터
  _rrIndex: 0,
  getRotated: function() {
    var active = this.getActive();
    if (active.length <= 1) return active;
    var idx = this._rrIndex % active.length;
    this._rrIndex++;
    return active.slice(idx).concat(active.slice(0, idx));
  }
};
_PROXY_REGISTRY.init();

// 하위 호환: 기존 코드에서 PROXY_LIST 참조하는 곳 대응
const PROXY_LIST = _PROXY_REGISTRY.getMkUrls();

function _aioProxyUrlExpectsJson(url) {
  url = String(url || '');
  return /\/api\/|\/v\d+\/finance\/chart|finance\/chart|query[12]\.finance\.yahoo\.com|m\.stock\.naver\.com|polling\.finance\.naver\.com|api\.stock\.naver\.com|production\.dataviz\.cnn\.io|api\.fear-and-greed\.com|api\.alternative\.me|api\.stlouisfed\.org|financialmodelingprep\.com|finnhub\.io|alphavantage\.co|twelvedata\.com/i.test(url);
}

function _aioProxyResponseLooksHtml(txt) {
  txt = String(txt || '').trimStart();
  return /^<!doctype\s+html/i.test(txt) || /^<html[\s>]/i.test(txt) || /<title>.*(captcha|access denied|forbidden|blocked|error).*<\/title>/i.test(txt.slice(0, 800));
}

function _aioProxyUnwrapJsonText(txt) {
  var obj = JSON.parse(txt);
  if (obj && typeof obj.contents === 'string') {
    var nested = obj.contents.trim();
    if (_aioProxyResponseLooksHtml(nested)) {
      var err = new Error('proxy returned HTML inside JSON wrapper');
      err.aioProxyBlockedHtml = true;
      throw err;
    }
    try { return JSON.parse(nested); } catch(_) { return obj; }
  }
  return obj;
}

async function _aioValidateProxyResponse(url, response, opts) {
  opts = opts || {};
  var expectJson = !!opts.expectJson || !!opts.parseJson || _aioProxyUrlExpectsJson(url);
  if (!expectJson) return { jsonReady: false, json: null };
  var txt = await response.clone().text();
  var probe = txt;
  try {
    var wrapped = JSON.parse(txt);
    if (wrapped && typeof wrapped.contents === 'string') probe = wrapped.contents;
  } catch(_) {}
  if (_aioProxyResponseLooksHtml(probe)) {
    var e = new Error('proxy returned HTML for JSON endpoint');
    e.aioProxyBlockedHtml = true;
    throw e;
  }
  if (opts.parseJson) return { jsonReady: true, json: _aioProxyUnwrapJsonText(txt) };
  return { jsonReady: false, json: null };
}

async function fetchViaProxy(url, timeout) {
  var opts = (timeout && typeof timeout === 'object') ? timeout : {};
  timeout = (opts.timeout || opts.ms || (typeof timeout === 'number' ? timeout : 8000));
  // v35.7: 라운드로빈으로 CF Worker 부하 분산
  var active = _PROXY_REGISTRY.getRotated();
  // v48.14 (Agent W7/P2-7): stale-cache degradation — 성공 응답을 localStorage에 저장
  var _sensitiveUrlRe = /[?&](apikey|api_key|token|access_token|client_secret|url)=/i;
  var _isSensitive = _sensitiveUrlRe.test(url);
  var cacheKey = _isSensitive ? null : 'aio_proxy_cache_' + btoa(url.slice(0, 150)).replace(/[^A-Za-z0-9]/g, '').substring(0, 64);
  for (var i = 0; i < active.length; i++) {
    var proxy = active[i];
    try {
      var r = await fetchWithTimeout(proxy.mkUrl(url), {}, timeout);
      if (r.ok) {
        var validated = await _aioValidateProxyResponse(url, r, opts);
        var payload = opts.parseJson
          ? (validated.jsonReady ? validated.json : await r.clone().json())
          : opts.parseText
            ? await r.clone().text()
            : r;
        if (typeof opts.accept === 'function' && !opts.accept(payload)) {
          _PROXY_REGISTRY.markFail(proxy.id, 'invalid-payload');
          continue;
        }
        _PROXY_REGISTRY.markOk(proxy.id);
        // 성공 응답 캐시 (stale 폴백용) — 민감 URL은 저장 안 함
        if (cacheKey) {
          try {
            var rClone = r.clone();
            rClone.text().then(function(t) {
              try { localStorage.setItem(cacheKey, JSON.stringify({ body: t, ts: Date.now() })); } catch(e) {}
            }).catch(function() {});
          } catch(e) {}
        }
        if (opts.parseJson) return payload;
        if (opts.parseText) return payload;
        return r;
      }
      _PROXY_REGISTRY.markFail(proxy.id, r.status);
    } catch(e) {
      _PROXY_REGISTRY.markFail(proxy.id, e && e.aioProxyBlockedHtml ? 'html' : null);
      if (typeof _aioLog === 'function' && e && e.aioProxyBlockedHtml) _aioLog('warn', 'proxy', proxy.id + ' HTML 차단 응답 — 다음 프록시 시도', { url: String(url).slice(0, 120) });
    }
  }
  if (typeof _reportApiError === 'function') _reportApiError('proxy-primary', '전체 프록시 실패');
  // v48.14: stale-cache 폴백 — 전체 프록시 실패 시 localStorage last-good 응답 반환 (민감 URL 제외)
  try {
    var cached = cacheKey ? localStorage.getItem(cacheKey) : null;
    if (cached) {
      var parsed = JSON.parse(cached);
      var ageH = (Date.now() - parsed.ts) / 3600000;
      if (ageH < 6 && parsed.body) { // 6시간 이내 캐시만 허용
        if (typeof _aioLog === 'function') _aioLog('warn', 'proxy', 'stale-cache 폴백 (' + Math.round(ageH*60) + '분 전) for ' + url.substring(0, 80));
        window._aioProxyStaleSince = window._aioProxyStaleSince || Date.now();
        window._aioProxyStaleAgeMin = Math.round(ageH * 60);
        if (opts.parseJson) {
          var cachedPayload = JSON.parse(parsed.body);
          if (typeof opts.accept === 'function' && !opts.accept(cachedPayload)) throw new Error('stale-cache payload rejected');
          return cachedPayload;
        }
        if (opts.parseText) {
          if (typeof opts.accept === 'function' && !opts.accept(parsed.body)) throw new Error('stale-cache payload rejected');
          return parsed.body;
        }
        return new Response(parsed.body, { status: 200, statusText: 'OK (stale-cache)', headers: { 'X-AIO-Stale': Math.round(ageH*60) + 'min', 'X-AIO-Source': 'stale-cache' } });
      }
    }
  } catch(cacheErr) {}
  throw new Error('All proxies failed for: ' + url);
}

// ═══ 1. Finnhub source-confirmed quotes (WebSocket with Enhanced Reconnection) ═════════════════════════
let _finnhubWS = null;
let _finnhubPrices = {};
let _finnhubReconnectAttempts = 0;
let _finnhubReconnectTimer = null;
let _finnhubErrorLogged = false; // Track if error already logged for this connection
const _finnhubMaxDelay = 60; // Max 60 seconds between retries (fast phase)
const _finnhubSlowDelay = 300; // 5 minutes between retries (slow phase, after 10 fast attempts)

function initFinnhubWebSocket() {
  const key = DATA_APIS.finnhub.key();
  if (!key) { console.log('[AIO] Finnhub key not set — skipping WebSocket'); return; }

  // v48.14 (Agent W15): 서킷 브레이커 — 1시간 20회 fail 누적 시 24시간 완전 disable
  window._finnhubCircuit = window._finnhubCircuit || { failsInWindow: 0, windowStart: Date.now(), disabledUntil: 0 };
  var circuit = window._finnhubCircuit;
  var now = Date.now();
  // 1시간 window 리셋
  if (now - circuit.windowStart > 3600000) { circuit.failsInWindow = 0; circuit.windowStart = now; }
  // 서킷 disable 상태 체크
  if (circuit.disabledUntil > now) {
    var hrsLeft = Math.ceil((circuit.disabledUntil - now) / 3600000);
    if (typeof _aioLog === 'function') _aioLog('warn', 'finnhub', 'circuit breaker open — skip for ' + hrsLeft + 'h');
    const badge = document.querySelector('.freshness-badge.fb-live');
    if (badge) badge.innerHTML = '서킷 차단 (' + hrsLeft + 'h)';
    return;
  }
  // fail 누적 확인
  if (circuit.failsInWindow >= 20) {
    circuit.disabledUntil = now + 24 * 3600000; // 24시간 완전 disable
    if (typeof _aioLog === 'function') _aioLog('error', 'finnhub', '서킷 브레이커 OPEN — 24시간 비활성화 (1h 20회 fail)');
    const badge = document.querySelector('.freshness-badge.fb-live');
    if (badge) badge.innerHTML = '서킷 차단 (24h)';
    return;
  }

  // v38.3: 10회 빠른 재연결 실패 후 → 5분 간격 슬로우 모드 (영구 포기 안 함)
  if (_finnhubReconnectAttempts >= 10 && _finnhubReconnectAttempts % 5 !== 0) {
    // 슬로우 모드: 5회마다 1회만 시도 (실질 25분 간격)
    _finnhubReconnectAttempts++;
    if (_finnhubReconnectTimer) clearTimeout(_finnhubReconnectTimer);
    _finnhubReconnectTimer = setTimeout(initFinnhubWebSocket, _finnhubSlowDelay * 1000);
    return;
  }
  if (_finnhubReconnectAttempts === 10) {
    _aioLog('warn', 'fetch', 'Finnhub WS: 빠른 재연결 10회 실패 → 슬로우 모드 전환 (5분 간격)');
    if (typeof _aioLog === 'function') _aioLog('warn', 'finnhub', '빠른 재연결 10회 실패 → 슬로우 모드');
    const badge = document.querySelector('.freshness-badge.fb-live');
    if (badge) badge.innerHTML = '재연결 대기';
  }

  try {
    _finnhubErrorLogged = false; // Reset error logging flag for new connection attempt
    _finnhubWS = new WebSocket('wss://ws.finnhub.io?token=' + key);

    _finnhubWS.onopen = () => {
      console.log('[AIO v20] Finnhub WebSocket connected — real-time mode');
      _finnhubReconnectAttempts = 0; // Reset on successful connection
      _finnhubErrorLogged = false;
      // Subscribe to key symbols (all symbols that appear on active page)
      const wsSymbols = [
        'AAPL','NVDA','TSLA','MSFT','AMZN','GOOGL','META','AMD','AVGO','MU','ARM',
        'SPY','QQQ','IWM','EEM','GLD','TLT','HYG', 'LQD' // Include ETFs & indices where available
      ];
      wsSymbols.forEach(s => _finnhubWS.send(JSON.stringify({ type: 'subscribe', symbol: s })));
      const badge = document.getElementById('live-source-static-badge') || document.querySelector('.freshness-badge.fb-live');
      if (badge) badge.textContent = 'FINNHUB source 확인';
      if (badge) {
        badge.textContent = 'FINNHUB source 확인';
        badge.className = 'freshness-badge fb-static';
      }
    };

    _finnhubWS.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'trade' && msg.data) {
          msg.data.forEach(trade => {
            const sym = trade.s;
            const price = trade.p;
            if (typeof price === 'number' && !isNaN(price) && price > 0) {
              _finnhubPrices[sym] = price;
              // Route through PriceStore for validation & global sync
              if (window.PriceStore) {
                PriceStore.set(sym, price, null, 'live:finnhub');
              } else {
                if (typeof window._aioSetLiveData === 'function') {
                  window._aioSetLiveData(sym, { price: price, pct: null }, { source: 'live:finnhub', bypassPriceStore: true, policyKey: 'quote', reason: 'PriceStore unavailable' });
                } else {
                  window._liveData = window._liveData || {};
                  if (window._liveData[sym]) { window._liveData[sym].price = price; }
                  else { window._liveData[sym] = { price, pct: null, pctMissing: true }; }
                }
                window._quoteTimestamps = window._quoteTimestamps || {};
                window._quoteTimestamps[sym] = Date.now();
              }
              // Update DOM elements
              document.querySelectorAll(`[data-live-price="${sym}"]`).forEach(el => {
                if (_aioIsNativeMacroElement(el)) return;
                // v38.3: P24 일반 보호 — children 있는 복합 요소는 전용 업데이트에 위임
                if (el.children.length > 0) {
                  var _pp = el.querySelector('.pill-price') || el.querySelector('.kr-etf-price');
                  if (_pp) _pp.textContent = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                } else { el.textContent = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
                el.style.borderBottom = ''; // Clear stale indicator
              });
            }
          });
        }
      } catch(e) { _aioLog('warn', 'fetch', 'Finnhub parse error: ' + (e && e.message || e)); }
    };

    _finnhubWS.onerror = (e) => {
      // Only log error once per connection attempt to avoid console spam
      if (!_finnhubErrorLogged) {
        _aioLog('warn', 'fetch', 'Finnhub WS error: ' + (e.message || 'connection error'));
        _finnhubErrorLogged = true;
        // v48.14 (W15): 서킷 브레이커 fail 카운트 증가
        if (window._finnhubCircuit) window._finnhubCircuit.failsInWindow++;
        if (typeof _aioLog === 'function') _aioLog('warn', 'finnhub', 'WS error (circuit fails: ' + (window._finnhubCircuit ? window._finnhubCircuit.failsInWindow : '?') + '/20)');
      }
    };

    _finnhubWS.onclose = () => {
      console.log('[AIO] Finnhub WS closed');
      _finnhubReconnectAttempts++;
      // 10회까지: 지수 백오프 (3s→6s→12s→...→60s), 이후: 슬로우 모드 (initFinnhub 내부 처리)
      const delay = _finnhubReconnectAttempts <= 10
        ? Math.min(_finnhubMaxDelay, 3 * Math.pow(2, _finnhubReconnectAttempts - 1))
        : _finnhubSlowDelay;
      console.log(`[AIO] Finnhub reconnecting in ${delay}s (attempt ${_finnhubReconnectAttempts})`);
      if (_finnhubReconnectTimer) clearTimeout(_finnhubReconnectTimer);
      _finnhubReconnectTimer = setTimeout(initFinnhubWebSocket, delay * 1000);
    };
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub WS init failed: ' + (e && e.message || e)); }
}

// ═══ 2. Twelve Data — 기술적 지표 & 차트 데이터 ═══════════════
// v47.11: 6 sequential → 1 POST /complex_data 일괄 요청으로 교체
// 기존: 15분마다 6회 × 24h = 576/day (무료 800/day 72% 소모)
// 변경: 15분마다 1회 × 24h = 96/day (83% 쿼터 확보, 레이턴시 6배 단축)
// 폴백: complex_data 응답 파싱 실패 시 개별 순차 호출로 복귀 (계정 플랜 미지원 대비)
async function fetchTechnicalIndicators(symbol = 'SPY') {
  const key = DATA_APIS.twelveData.key();
  if (!key) return null;
  // v48.9: 공유 키 쿼터 사전 체크 (800/day 도달 시 스킵)
  if (typeof _isQuotaExceeded === 'function' && _isQuotaExceeded('twelveData')) return null;
  const indicators = ['rsi','macd','stoch','adx','bbands','ema'];
  // v47.11 주 경로: POST /complex_data
  try {
    const body = {
      symbols: [symbol],
      intervals: ['1day'],
      methods: indicators.map(function(n){ return { name: n }; })
    };
    const url = `${DATA_APIS.twelveData.base}/complex_data?apikey=${key}`;
    const r = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, 10000);
    if (r.ok) {
      if (typeof _bumpApiCounter === 'function') _bumpApiCounter('twelveData');
      const json = await r.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        const entry = json.data[0];
        const results = {};
        let matched = 0;
        indicators.forEach(function(ind) {
          if (entry[ind]) { results[ind] = entry[ind]; matched++; }
        });
        if (matched > 0) return results;
      }
    }
  } catch(e) { _aioLog('warn', 'fetch', 'Twelve Data complex_data error: ' + e.message); }
  // v47.11 폴백: 개별 순차 호출 (complex_data 미지원 시)
  try {
    const results = {};
    for (const ind of indicators) {
      const url2 = `${DATA_APIS.twelveData.base}/${ind}?symbol=${symbol}&interval=1day&apikey=${key}`;
      const r2 = await fetchWithTimeout(url2, {}, 6000);
      if (r2.ok) results[ind] = await r2.json();
      await new Promise(ok => setTimeout(ok, 200));
    }
    return results;
  } catch(e) { _aioLog('warn', 'fetch', 'Twelve Data sequential fallback error: ' + (e && e.message || e)); return null; }
}

// v47.10: fetchChartData / fetchBreadthFromAV / fetchFundamentals 제거 — 정의만 있고 호출 0건 (dead code P112)

// ═══ v48.78: OHLCV fetch — 심층 종목 기술 분석 패널용 ═══════════════════════
var _ohlcvCache = {};

async function fetchOHLCV(symbol, interval, bars) {
  bars = bars || 120;
  var ck = symbol + '_' + interval;
  var ttl = interval === '1month' ? 86400000 : interval === '1week' ? 14400000 : 3600000;
  if (_ohlcvCache[ck] && (Date.now() - _ohlcvCache[ck]._ts < ttl)) return _ohlcvCache[ck].data;
  var key = DATA_APIS.twelveData.key();
  if (!key) return null;
  if (typeof _isQuotaExceeded === 'function' && _isQuotaExceeded('twelveData')) return null;
  try {
    var url = DATA_APIS.twelveData.base + '/time_series?symbol=' + encodeURIComponent(symbol) +
              '&interval=' + interval + '&outputsize=' + bars + '&apikey=' + key;
    var r = await fetchWithTimeout(url, {}, 12000);
    if (typeof _bumpApiCounter === 'function') _bumpApiCounter('twelveData');
    if (typeof window._markFetch === 'function') window._markFetch('twelveData');
    if (!r.ok) return null;
    var json = await r.json();
    if (!json || json.status !== 'ok' || !Array.isArray(json.values) || !json.values.length) return null;
    // Twelve Data는 최신순(내림차순) — LWC용 오름차순으로 역순 변환
    var data = json.values.slice().reverse().map(function(v) {
      return {
        time: v.datetime.substring(0, 10),
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: parseInt(v.volume, 10) || 0
      };
    }).filter(function(d) { return !isNaN(d.open) && !isNaN(d.close); });
    if (!data.length) return null;
    _ohlcvCache[ck] = { _ts: Date.now(), data: data };
    return data;
  } catch(e) {
    if (typeof _aioLog === 'function') _aioLog('warn', 'fetch', 'fetchOHLCV error: ' + (e && e.message || e));
    return null;
  }
}

// ═══ 4-1. Naver — US 주식 재무/컨센서스/기업개요 (무료, 프록시 필요) ═══

// NYSE 상장 종목 세트 (Reuters .N 코드) — 나머지는 NASDAQ(.O) 기본
function _normalizeOHLCVRows(rows, bars) {
  var out = (rows || []).map(function(d) {
    if (!d) return null;
    var close = parseFloat(d.close);
    if (!isFinite(close) || close <= 0) return null;
    var open = parseFloat(d.open); if (!isFinite(open) || open <= 0) open = close;
    var high = parseFloat(d.high); if (!isFinite(high) || high <= 0) high = Math.max(open, close);
    var low = parseFloat(d.low); if (!isFinite(low) || low <= 0) low = Math.min(open, close);
    var volume = parseInt(d.volume, 10); if (!isFinite(volume) || volume < 0) volume = 0;
    return { time: d.time || d.datetime || d.date || null, open: open, high: Math.max(high, open, close), low: Math.min(low, open, close), close: close, volume: volume };
  }).filter(Boolean);
  return bars ? out.slice(-bars) : out;
}

function _attachOHLCVQuality(rows, quality) {
  var out = Array.isArray(rows) ? rows : [];
  var q = (typeof window.calcDataQuality === 'function')
    ? window.calcDataQuality(Object.assign({ rows: out.length }, quality || {}))
    : Object.assign({ rows: out.length, label: out.length ? 'MEDIUM' : 'FALLBACK', confidence: out.length ? 60 : 10 }, quality || {});
  try { Object.defineProperty(out, 'dataQuality', { value: q, enumerable: false, configurable: true }); }
  catch(e) { out.dataQuality = q; }
  return out;
}

function _yahooRangeForOHLCV(interval, bars) {
  bars = bars || 120;
  if (interval === '1month') return bars > 120 ? '10y' : '5y';
  if (interval === '1week') return bars > 220 ? '5y' : '2y';
  if (bars > 420) return '2y';
  if (bars > 160) return '1y';
  if (bars > 80) return '6mo';
  return '3mo';
}

async function fetchOHLCVWithFallback(symbol, interval, bars) {
  symbol = (symbol || 'SPY').toString().trim().toUpperCase();
  interval = interval || '1day';
  bars = bars || 120;
  try {
    var td = await fetchOHLCV(symbol, interval, bars);
    var norm = _normalizeOHLCVRows(td, bars);
    if (norm && norm.length >= Math.min(20, bars)) return _attachOHLCVQuality(norm, { source: 'twelvedata-or-primary', timestamp: Date.now() });
  } catch(e) {
    if (typeof _aioLog === 'function') _aioLog('warn', 'fetch', 'fetchOHLCV primary failed: ' + (e && e.message || e));
  }
  try {
    if (typeof window._fetchYahooChartData !== 'function') return _attachOHLCVQuality([], { source: 'fallback-empty', missing: true });
    var y = await window._fetchYahooChartData(symbol, _yahooRangeForOHLCV(interval, bars));
    if (!y || !Array.isArray(y.closes)) return _attachOHLCVQuality([], { source: 'yahoo-fallback', missing: true });
    var rows = y.closes.map(function(c, i) {
      var ts = y.timestamps && y.timestamps[i];
      var dt = ts ? new Date(ts * 1000).toISOString().substring(0, 10) : null;
      return { time: dt, open: y.opens && y.opens[i], high: y.highs && y.highs[i], low: y.lows && y.lows[i], close: c, volume: y.volumes && y.volumes[i] };
    });
    return _attachOHLCVQuality(_normalizeOHLCVRows(rows, bars), { source: 'yahoo-fallback', timestamp: Date.now() });
  } catch(e2) {
    if (typeof _aioLog === 'function') _aioLog('warn', 'fetch', 'fetchOHLCV yahoo fallback failed: ' + (e2 && e2.message || e2));
    return _attachOHLCVQuality([], { source: 'fallback-empty', error: true });
  }
}
window.fetchOHLCVWithFallback = fetchOHLCVWithFallback;

function _aioDataThirdFriday(year, monthIndex) {
  var d = new Date(year, monthIndex, 1);
  var firstFriday = 1 + ((5 - d.getDay() + 7) % 7);
  return new Date(year, monthIndex, firstFriday + 14);
}

function _aioDataNextOpex(referenceDate) {
  var ref = referenceDate ? new Date(referenceDate) : new Date();
  var refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  var next = _aioDataThirdFriday(ref.getFullYear(), ref.getMonth());
  if (next.getTime() < refDay.getTime()) next = _aioDataThirdFriday(ref.getMonth() === 11 ? ref.getFullYear() + 1 : ref.getFullYear(), (ref.getMonth() + 1) % 12);
  // v51.87 P575: `next` 는 new Date(year, monthIndex, day) 로 만든 "로컬 자정" Date 다.
  //   이걸 next.toISOString().slice(0,10) 로 문자열화하면 UTC 로 변환되며, UTC+ 시간대
  //   (KST 등 한국 사용자)에서는 로컬 자정이 전날 UTC 로 넘어가 표시 날짜가 하루 앞당겨진다
  //   (실측: 3rd Friday 2026-01-16 → "2026-01-15" 목요일). 로컬 달력 컴포넌트로 직접
  //   포맷해 만기일 표시를 정확히 유지한다. daysToOpex 는 로컬-로컬 diff 라 원래 정확.
  var _y = next.getFullYear(), _m = String(next.getMonth() + 1).padStart(2, '0'), _d = String(next.getDate()).padStart(2, '0');
  return { nextOpexDate: _y + '-' + _m + '-' + _d, daysToOpex: Math.ceil((next.getTime() - refDay.getTime()) / 86400000) };
}

async function fetchOpexCalendar(referenceDate) {
  var cal = _aioDataNextOpex(referenceDate);
  var metric = window.makeMetric ? window.makeMetric(cal.nextOpexDate, 'calendar-derived-monthly-opex', Date.now(), 'option', { daysToOpex: cal.daysToOpex }) : null;
  return { nextOpexDate: cal.nextOpexDate, daysToOpex: cal.daysToOpex, dataQuality: metric };
}
window.fetchOpexCalendar = fetchOpexCalendar;

async function fetchPutCallRatios() {
  var snap = window.DATA_SNAPSHOT || {};
  var total = Number(window._putCallRatio || snap.pcr || snap.putCallRatio);
  var equity = Number(snap.equityPutCall || snap.equityPcr);
  var index = Number(snap.indexPutCall || snap.indexPcr);
  var source = 'snapshot-or-live-put-call';
  if (!isFinite(total)) total = null;
  if (!isFinite(equity)) equity = total !== null ? Math.max(0.35, total * 0.72) : null;
  if (!isFinite(index)) index = total !== null ? Math.min(1.8, total * 1.18) : null;
  var q = window.makeMetric ? window.makeMetric(total, source, Date.now(), 'option', { estimated: equity !== null || index !== null }) : null;
  return { totalPutCall: total, equityPutCall: equity, indexPutCall: index, dataQuality: q };
}
window.fetchPutCallRatios = fetchPutCallRatios;

async function fetchOptionSentiment() {
  var out = await Promise.allSettled([fetchOpexCalendar(), fetchPutCallRatios()]);
  return {
    opex: out[0].status === 'fulfilled' ? out[0].value : { nextOpexDate: null, daysToOpex: null, dataQuality: null },
    putCall: out[1].status === 'fulfilled' ? out[1].value : { totalPutCall: null, equityPutCall: null, indexPutCall: null, dataQuality: null }
  };
}
window.fetchOptionSentiment = fetchOptionSentiment;

async function fetchLockoutMarketBundle(symbols) {
  symbols = symbols && symbols.length ? symbols : ['SPY', 'QQQ', 'SMH', 'SOXX', 'IWM', 'RSP', 'KRE', 'XBI'];
  var rows = await Promise.allSettled(symbols.map(function(sym) { return fetchOHLCVWithFallback(sym, '1day', 180); }));
  var snapshots = {};
  var dataQuality = {};
  rows.forEach(function(r, i) {
    var sym = symbols[i];
    var bars = r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : [];
    snapshots[sym] = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(bars) : { ok: false, reason: 'calc_missing', bars: bars.length };
    dataQuality[sym] = bars && bars.dataQuality ? bars.dataQuality : (window.calcDataQuality ? window.calcDataQuality({ source: 'lockout-bundle', rows: bars.length, missing: !bars.length }) : null);
  });
  var optionSentiment = await fetchOptionSentiment();
  return { symbols: symbols, snapshots: snapshots, dataQuality: dataQuality, optionSentiment: optionSentiment };
}
window.fetchLockoutMarketBundle = fetchLockoutMarketBundle;


var _NAVER_NYSE = 'JPM V XOM MA UNH JNJ HD PG ABBV MRK CVX BAC DIS WMT KO PEP MCD TMO LLY GS MS BMY RTX HON CAT DE UPS IBM GE NKE VZ T PM AXP C WFC PFE ABT DHR LOW SYK BDX ZTS CME ICE APD SHW ECL EMR ETN ITW NSC UNP LMT NOC GD BA F GM SO NEE DUK SPGI MCO BLK MMC AON CL WMB KMI MPC VLO PSX SLB HAL FCX NUE URI DD HCA SYY YUM WM PLD SPG PSA O AEP EXC SRE WEC DOW COP OXY EOG BKR COF BK MET PRU AIG AFL TRV CB RSG TFC PNC USB HUBB GPN OTIS STE VRSK EFX NRG PCAR KHC MCK MAR IQV STZ CNC CI MDLZ BSX TJX GEV VRT DELL HPE GLW CCJ PGR TDG RMD TRGP ROP CARR WELL TSM BABA NVO NVS AZN HSBC TM SHEL RIO BHP UBS UL BUD TTE BP TD RY SONY HUM A'.split(' ').reduce(function(s,t){s[t]=1;return s;},{});

var _naverUSCache = {};

// Yahoo 티커 → Naver Reuters 코드 변환
function _toNaverReuters(sym) {
  if (!sym || /\.\w{1,2}$/.test(sym)) return null; // 한국 종목(.KS/.KQ) 제외
  if (sym === 'BRK-B' || sym === 'BRK.B') return 'BRKb.N';
  return sym + (_NAVER_NYSE[sym] ? '.N' : '.O');
}

// Naver US 주식 통합 조회: basic + integration + finance(옵션)
async function fetchNaverUSData(sym, includeFinance) {
  var ck = sym + (includeFinance ? '_f' : '');
  if (_naverUSCache[ck] && (Date.now() - _naverUSCache[ck]._ts < 600000)) return _naverUSCache[ck];
  var code = _toNaverReuters(sym);
  if (!code) return null;
  var base = 'https://api.stock.naver.com/stock/' + code;
  try {
    var ps = [
      fetchViaProxy(base + '/basic', 5000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
      fetchViaProxy(base + '/integration', 5000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
    ];
    if (includeFinance) ps.push(fetchViaProxy(base + '/finance/annual', 5000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}));
    // v48.94 P159: Promise.allSettled — 1개 실패 시 나머지 결과 보존
    var res = await Promise.allSettled(ps);
    var basic = (res[0].status === 'fulfilled') ? res[0].value : null;
    var integ = (res[1].status === 'fulfilled') ? res[1].value : null;
    var fin   = (res[2] && res[2].status === 'fulfilled') ? res[2].value : null;
    if (!basic && !integ) return null;

    var result = { _ts: Date.now(), _code: code };

    // Basic: 한국어명, 로고, 업종, 거래소
    if (basic) {
      result.nameKr = basic.stockName || null;
      result.logoUrl = basic.itemLogoPngUrl || null;
      result.industryKr = basic.industryCodeType ? basic.industryCodeType.industryGroupKor : null;
      result.exchange = basic.stockExchangeName || null;
    }

    // Integration → 컨센서스 (목표가, 추천등급)
    if (integ && integ.consensusInfo && integ.consensusInfo.priceTargetMean) {
      var ci = integ.consensusInfo;
      result.consensus = {
        recommMean: parseFloat(ci.recommMean) || null,
        targetMean: parseFloat(ci.priceTargetMean) || null,
        targetHigh: parseFloat(ci.priceTargetHigh) || null,
        targetLow: parseFloat(ci.priceTargetLow) || null,
        date: ci.createDate || null
      };
    }

    // Integration → 기업개요 (한국어)
    if (integ && integ.corporateOverview) result.overview = integ.corporateOverview;

    // Integration → 경영진/직원
    if (integ && integ.summaries) {
      result.ceo = integ.summaries.representativeName || null;
      result.employees = integ.summaries.employees || null;
    }

    // Integration → 동종업계 비교
    if (integ && integ.industryCompareInfo) {
      var gl = integ.industryCompareInfo.globalStocks || [];
      result.peers = gl.slice(0, 6).map(function(s) {
        return { sym: s.symbolCode, name: s.stockName, price: s.closePrice, chg: s.fluctuationsRatio, mcap: s.marketValueHangeul };
      });
    }

    // Finance → 연간 재무제표
    if (fin && fin.rowList) {
      var fd = {};
      fin.rowList.forEach(function(row) {
        var cols = row.columns || {};
        var keys = Object.keys(cols);
        if (keys.length > 0) { var v = cols[keys[keys.length - 1]]; fd[row.title] = v ? v.value : null; }
      });
      result.financials = fd;
      result.finUnit = fin.unit || null;
    }

    _naverUSCache[ck] = result;
    return result;
  } catch(e) {
    _aioLog('warn', 'fetch', 'Naver US error: ' + sym + ' ' + (e.message || e));
    return null;
  }
}

// ═══ 5. FRED — 매크로 경제 지표 실시간 ═══════════════════════
async function fetchFredSeries(seriesId, limit = 30) {
  const key = DATA_APIS.fred.key();
  if (!key) {
    console.log('[AIO] FRED key not set - using fallback data');
    if (typeof _reportApiError === 'function') _reportApiError('fred', 'FRED API key missing; fallback data active');
    return null;
  }
  if (!key) return null;
  const url = `${DATA_APIS.fred.base}?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;

  // v31.5: JSON 응답에서 observations 추출 (allorigins 래핑 자동 해제)
  function _extractObs(data) {
    if (data.contents && typeof data.contents === 'string') {
      try { data = JSON.parse(data.contents); } catch(e) {}
    }
    return data.observations || [];
  }

  // 1차: CF Worker 우선 (CORS 문제 없음, 가장 빠름)
  const cfWorker = _getApiKey('aio_cf_worker_url');
  if (cfWorker) {
    try {
      const r = await fetchWithTimeout(cfWorker + '?url=' + encodeURIComponent(url), {}, 8000);
      if (r.ok) { return _extractObs(await r.json()); }
      if ((r.status === 400 || r.status === 403) && window.AIO && typeof window.AIO.updateProviderStatus === 'function') {
        window.AIO.updateProviderStatus('aio_fred_key', { authentication:'FAILED', connection:'REACHABLE', lastError:'FRED_HTTP_' + r.status });
      }
    } catch(e) { /* CF Worker failed — try direct */ }
  }
  // 2차: 직접 호출 시도
  try {
    const r = await fetchWithTimeout(url, {}, 6000);
    if (r.ok) { return _extractObs(await r.json()); }
    if (r.status === 429) { _aioLog('warn', 'fetch', 'FRED rate limit hit — 60s 대기'); await new Promise(ok => setTimeout(ok, T.COOLDOWN)); return null; }
    if (r.status === 403 || r.status === 400) {
      if (window.AIO && typeof window.AIO.updateProviderStatus === 'function') {
        window.AIO.updateProviderStatus('aio_fred_key', { authentication:'FAILED', connection:'REACHABLE', lastError:'FRED_HTTP_' + r.status });
      }
      showDataError('FRED', 'API 키가 유효하지 않거나 한도 초과', 'error');
      return null;
    }
  } catch(e) { /* CORS blocked — fallback to proxy */ }
  // v51.85 P573/R264: 3차 서드파티 CORS 프록시 폴백 제거 (키 유출 차단).
  //   이 url 은 `?api_key=<사용자 개인 FRED 키>` 를 포함한다. corsproxy.io/allorigins/
  //   codetabs 같은 제3자 프록시로 보내면 그 운영자 로그에 키가 평문 노출된다
  //   (fetchViaProxy 의 _isSensitive 플래그는 캐시 저장만 막고 전송은 못 막음 — 이름이
  //   방어를 암시하지만 실제로는 안 막는 함정). 신뢰 가능한 경로(CF Worker = 사용자 본인
  //   도메인, 직접 호출 = 브라우저→FRED TLS)만 허용한다. 둘 다 실패하면 라이브 갱신을
  //   포기하고 null 반환 → 서버 data.json(GitHub Actions 가 FRED_API_KEY 로 이미 공급) /
  //   정적 폴백 사용. 실질 기능 손실 없이 개인 키 유출 경로를 완전히 제거.
  if (typeof _aioLog === 'function') {
    _aioLog('warn', 'fetch', 'FRED live 갱신 스킵 (' + seriesId + '): CORS 차단 + CF Worker 미설정. 개인 키 유출 방지로 제3자 프록시 미사용 — 서버 data.json/정적 폴백 사용. CF Worker URL 설정 시 라이브 갱신 가능.');
  }
  if (window.AIO && typeof window.AIO.updateProviderStatus === 'function') {
    var _fredStatus = window.AIO.getProviderStatus ? window.AIO.getProviderStatus('aio_fred_key') : null;
    if (!_fredStatus || _fredStatus.authentication !== 'FAILED') {
      window.AIO.updateProviderStatus('aio_fred_key', { authentication:'NOT_CHECKED', connection:'BLOCKED', lastError:'FRED_CORS_OR_WORKER_UNAVAILABLE' });
    }
  }
  return null;
}

// v47.11: 5개 시리즈 추가 — DFEDTARU(기존 참조 L12997 있으나 등록 누락된 dead branch 해결)
//   + PAYEMS(비농업고용), M2SL(M2 통화량), DCOILWTICO(WTI 유가), MORTGAGE30US(30년 모기지)
//   → macro 페이지 + 브리핑 AI 프롬프트에서 활용 가능
const FRED_SERIES = {
  'BAMLH0A0HYM2': { name: 'HY Spread', unit: 'bp' }, // multiplier 제거 (사문화 필드)
  'T10Y2Y':       { name: '10Y-2Y Spread', el: null, unit: '%' },
  'T10Y3M':       { name: '10Y-3M Spread', el: null, unit: '%' },
  'DGS2':         { name: '2Y Treasury', el: null, unit: '%' },
  'DGS10':        { name: '10Y Treasury', el: null, unit: '%' },
  'DGS30':        { name: '30Y Treasury', el: null, unit: '%' },
  'DTWEXBGS':     { name: 'Trade Weighted USD', el: null, unit: '' },
  'VIXCLS':       { name: 'VIX Close', el: null, unit: '' },
  'ICSA':         { name: 'Initial Claims', el: null, unit: 'K', multiplier: 0.001 },
  'UNRATE':       { name: 'Unemployment Rate', el: null, unit: '%' },
  'CPIAUCSL':     { name: 'CPI', el: null, unit: '', yoy: true },          // 헤드라인 CPI (YoY 계산)
  'FEDFUNDS':     { name: 'Fed Funds Rate', el: null, unit: '%' },
  // v47.11 신규
  'DFEDTARU':     { name: 'Fed Funds Target Upper', el: null, unit: '%' },
  'PAYEMS':       { name: 'Nonfarm Payrolls', el: null, unit: 'K' },
  'M2SL':         { name: 'M2 Money Supply', el: null, unit: 'B USD' },
  'DCOILWTICO':   { name: 'WTI Crude Oil', el: null, unit: 'USD/bbl' },
  'MORTGAGE30US': { name: '30Y Mortgage Rate', el: null, unit: '%' },
  // v48.59: 추가 data-snap 자동화 대상 FRED 시리즈
  'FEDFUNDS':     { name: 'Fed Funds Rate', el: null, unit: '%' },         // fed-rate (월평균)
  'UNRATE':       { name: 'Unemployment Rate', el: null, unit: '%' },      // 실업률
  'HOUST':        { name: 'Housing Starts', el: null, unit: 'K units' },   // housing
  'RSAFS':        { name: 'Retail Sales', el: null, unit: 'M USD' },       // retail-sales
  'UMCSENT':      { name: 'Michigan Sentiment', el: null, unit: '' },      // v51.97/P593: NOT cons-conf (Conf. Board, different survey) — fetched but currently unrendered, see applyFredToUI
  'CES0500000003':{ name: 'Avg Hourly Earnings', el: null, unit: 'USD' },  // wage-growth
  'PAYEMS':       { name: 'Non-farm Payrolls', el: null, unit: 'K' },      // 고용 (NFP)
  // v50.5: C계층 매크로 실데이터 연결 — 연준 선호 지표(PCE) + 근원(Core) YoY
  'CPILFESL':     { name: 'Core CPI', el: null, unit: '', yoy: true },     // 근원 CPI (식료품·에너지 제외)
  'PCEPI':        { name: 'PCE', el: null, unit: '', yoy: true },          // 헤드라인 PCE (연준 선호)
  'PCEPILFE':     { name: 'Core PCE', el: null, unit: '', yoy: true }      // 근원 PCE (연준 2% 목표 기준)
};

// v48.59: BOK ECOS API fetcher — 한국은행 기준금리/환율/수출 (무료, 회원가입)
// 통계 코드: 722Y001=기준금리, 036Y002=CPI, 901Y014=GDP, 403Y001=수출, 403Y003=수입
async function fetchBokEcos(statCode, cycle, startDate, endDate, itemCode1) {
  const key = _getApiKey('aio_bok_key') || '';
  if (!key) return null;
  try {
    var base = 'https://ecos.bok.or.kr/api/StatisticSearch';
    var url = base + '/' + key + '/json/kr/1/10/' + statCode + '/' + cycle + '/' + startDate + '/' + endDate + (itemCode1 ? ('/' + itemCode1) : '');
    const r = await fetchWithTimeout(url, {}, 8000);
    if (!r.ok) return null;
    const d = await r.json();
    if (d && d.StatisticSearch && d.StatisticSearch.row) return d.StatisticSearch.row;
    return null;
  } catch(e) { _aioLog('warn', 'fetch', 'BOK ECOS error: ' + e.message); return null; }
}

// v48.59: 한국 거시 지표 일괄 수집 → data-snap 바인딩
async function fetchAllBokData() {
  const key = _getApiKey('aio_bok_key') || '';
  if (!key) { console.log('[AIO] BOK ECOS key not set'); return null; }
  try {
    // 최근 12개월 범위
    const now = new Date();
    const endMonth = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0');
    const startMonth = String(now.getFullYear() - 1) + String(now.getMonth() + 1).padStart(2, '0');
    // 기준금리 (722Y001) — 월 단위
    const rateData = await fetchBokEcos('722Y001', 'M', startMonth, endMonth, '0101000');
    const results = { };
    if (rateData && rateData.length > 0) {
      const latest = rateData[rateData.length - 1];
      const prev = rateData.length > 1 ? rateData[rateData.length - 2] : null;
      results.bokRate = { value: parseFloat(latest.DATA_VALUE), date: latest.TIME, prev: prev ? parseFloat(prev.DATA_VALUE) : null };
    }
    // data-snap 업데이트
    if (results.bokRate) {
      document.querySelectorAll('[data-snap="bok-rate"]').forEach(function(el){
        if (_aioIsNativeMacroElement(el)) return;
        el.textContent = results.bokRate.value.toFixed(2) + '%';
      });
      const prev = results.bokRate.prev;
      if (prev != null) {
        const delta = results.bokRate.value - prev;
        const status = Math.abs(delta) < 0.01 ? '동결' : (delta > 0 ? '인상' : '인하');
        document.querySelectorAll('[data-snap="bok-status"]').forEach(function(el){
          if (_aioIsNativeMacroElement(el)) return;
          el.textContent = status;
        });
      }
    }
    window._bokData = results;
    console.log('[AIO v48.59] BOK ECOS loaded:', Object.keys(results).length, 'series');
    return results;
  } catch(e) { _aioLog('warn', 'fetch', 'BOK ECOS batch error: ' + e.message); return null; }
}

// v48.59: KOSIS 통계청 API fetcher — CPI/수출입/실업률 (무료, 회원가입)
async function fetchKosisStat(orgId, tblId, itmId, prdSe) {
  const key = _getApiKey('aio_kosis_key') || '';
  if (!key) return null;
  try {
    // prdSe: M(월)/Q(분기)/A(년)
    const url = 'https://kosis.kr/openapi/Param/statisticsParameterData.do' +
      '?method=getList&apiKey=' + key +
      '&itmId=' + itmId + '&objL1=ALL&format=json' +
      '&jsonVD=Y&prdSe=' + prdSe + '&newEstPrdCnt=3' +
      '&orgId=' + orgId + '&tblId=' + tblId;
    const r = await fetchWithTimeout(url, {}, 8000);
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { _aioLog('warn', 'fetch', 'KOSIS error: ' + e.message); return null; }
}

// v48.59: 한국 통계청 주요 지표 일괄 (CPI · 실업률 · 수출입)
async function fetchAllKosisData() {
  const key = _getApiKey('aio_kosis_key') || '';
  if (!key) { console.log('[AIO] KOSIS key not set'); return null; }
  try {
    // CPI — 통계청 인플레이션 (DT_1J17001, 소비자물가지수)
    const cpiData = await fetchKosisStat('101', 'DT_1J17001', 'T10', 'M');
    const results = {};
    if (cpiData && Array.isArray(cpiData) && cpiData.length > 0) {
      // 최신값 찾기 (PRD_DE 기준 정렬)
      cpiData.sort(function(a, b){ return (a.PRD_DE || '') < (b.PRD_DE || '') ? 1 : -1; });
      const latest = cpiData[0];
      results.krCpi = { value: parseFloat(latest.DT), date: latest.PRD_DE };
      document.querySelectorAll('[data-snap="kr-cpi"]').forEach(function(el){
        if (_aioIsNativeMacroElement(el)) return;
        el.textContent = results.krCpi.value.toFixed(1);
      });
    }
    window._kosisData = results;
    console.log('[AIO v48.59] KOSIS loaded:', Object.keys(results).length, 'series');
    return results;
  } catch(e) { _aioLog('warn', 'fetch', 'KOSIS batch error: ' + e.message); return null; }
}

async function fetchAllFredData() {
  const key = DATA_APIS.fred.key();
  if (!key) {
    console.log('[AIO] FRED key not set - using fallback data');
    if (typeof _reportApiError === 'function') _reportApiError('fred', 'FRED API key missing; fallback data active');
    return null;
  }

  const results = {};
  const seriesIds = Object.keys(FRED_SERIES);

  // Fetch in batches of 3 to be nice to FRED
  for (let i = 0; i < seriesIds.length; i += 3) {
    const batch = seriesIds.slice(i, i + 3);
    // v50.5: YoY 시리즈는 13개월 관측치 필요 (obs[0] vs obs[12])
    const promises = batch.map(id => fetchFredSeries(id, (FRED_SERIES[id] && FRED_SERIES[id].yoy) ? 13 : 5).then(obs => ({ id, obs })));
    const batchResults = await Promise.allSettled(promises);
    batchResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value.obs && r.value.obs.length > 0) {
        const { id, obs } = r.value;
        const latest = obs[0];
        const prev = obs.length > 1 ? obs[1] : null;
        // v31.8: MacroStore 검증 레이어 경유 (결측치/범위 체크)
        const accepted = MacroStore.set(id, latest.value, prev ? prev.value : null, latest.date);
        if (accepted) {
          results[id] = { value: MacroStore._data[id].value, prevValue: MacroStore._data[id].prevValue, date: latest.date };
          // v50.5: 인플레 지표 YoY 계산 (최신 index vs 12개월 전 index)
          if (FRED_SERIES[id] && FRED_SERIES[id].yoy && obs.length >= 13) {
            const yearAgo = parseFloat(obs[12] && obs[12].value);
            const cur = parseFloat(latest.value);
            if (isFinite(yearAgo) && yearAgo > 0 && isFinite(cur)) {
              results[id].yoy = ((cur - yearAgo) / yearAgo) * 100;
            }
          }
        }
      }
    });
    if (i + 3 < seriesIds.length) await new Promise(ok => setTimeout(ok, 300)); // rate limit
  }

  window._fredData = results;
  try { applyFredToUI(results); } catch(e) { _aioLog('warn', 'render', 'applyFredToUI error: ' + e.message); }
  console.log('[AIO v20] FRED data loaded:', Object.keys(results).length, 'series (MacroStore 검증)');
  if (!Object.keys(results).length) return null;
  if (window.AIO && typeof window.AIO.updateProviderStatus === 'function') {
    window.AIO.updateProviderStatus('aio_fred_key', { authentication:'VERIFIED', connection:'HEALTHY', lastSuccessAt:new Date().toISOString(), lastError:null });
  }
  if (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs) {
    window.DATA_SNAPSHOT._fieldTs.macro_fred = new Date().toISOString();
  }
  try {
    var _macroDetail = { provider:'fred', count:Object.keys(results).length };
    window.dispatchEvent(new CustomEvent('aio:macroUpdated', { detail:_macroDetail }));
    if (document && typeof document.dispatchEvent === 'function') document.dispatchEvent(new CustomEvent('aio:macroUpdated', { detail:_macroDetail }));
  } catch(_) {}
  return results;
}

function applyFredToUI(data) {
  // v31.9: 소스 표시 헬퍼 — FRED 원본 vs Yahoo 실시간 구분
  function _fredSourceLabel(entry) {
    if (!entry) return '';
    if (entry._source && entry._source.startsWith('yahoo-')) {
      return '실시간 (' + new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) + ')';
    }
    return 'FRED ' + (entry.date || '');
  }

  // HY Spread
  if (data['BAMLH0A0HYM2']) {
    const spread = data['BAMLH0A0HYM2'].value;
    const bp = Math.round(spread * 100);
    // v48.72: data-snap="hy-spread" 자동 바인딩 (Phase 7)
    _updSnap('hy-spread', function(){ return '+' + bp + 'bp'; });
  }

  // v48.59: FRED → data-snap 전수 자동 바인딩 (Phase 16)
  function _updSnap(key, formatter) {
    const nodes = document.querySelectorAll('[data-snap="' + key + '"]');
    if (!nodes.length) return;
    nodes.forEach(function(el) {
      if (_aioIsNativeMacroElement(el)) return;
      try { el.textContent = formatter(); } catch(_){}
    });
  }
  if (data['FEDFUNDS']) {
    const r = data['FEDFUNDS'].value;
    _updSnap('fed-rate', function(){ return r.toFixed(2) + '%'; });
  }
  // v50.5: CPI/Core CPI/PCE/Core PCE를 YoY(전년 동월 대비)로 렌더 — 시장/연준 기준 지표.
  // 기존 'cpi' sink는 비교표(11571)에서 "CPI (YoY)"로 표기되므로 YoY가 정확.
  function _fredYoYSnap(seriesId, snapKey) {
    const e = data[seriesId];
    if (!e || typeof e.yoy !== 'number' || !isFinite(e.yoy)) return;
    const yoy = e.yoy;
    _updSnap(snapKey, function(){ return (yoy >= 0 ? '+' : '') + yoy.toFixed(1) + '%'; });
  }
  _fredYoYSnap('CPIAUCSL', 'cpi');        // 비교표 호환 (US CPI YoY)
  _fredYoYSnap('CPIAUCSL', 'cpi-yoy');    // 전용 카드
  _fredYoYSnap('CPILFESL', 'core-cpi-yoy');
  _fredYoYSnap('PCEPI',    'pce-yoy');
  _fredYoYSnap('PCEPILFE', 'core-pce-yoy');
  // NFP: PAYEMS는 천명 단위 레벨 → 전월 대비 증감(MoM change)이 시장이 보는 "신규 고용".
  if (data['PAYEMS'] && data['PAYEMS'].value != null && data['PAYEMS'].prevValue != null) {
    const nfpChg = Math.round(data['PAYEMS'].value - data['PAYEMS'].prevValue);
    _updSnap('nfp', function(){ return (nfpChg >= 0 ? '+' : '') + nfpChg.toLocaleString() + 'K'; });
  }

  // v50.8: FRED live 매크로를 DATA_SNAPSHOT 필드에도 write-back.
  // → macro/sentiment/signal CHAT_CONTEXT 등 DATA_SNAPSHOT.X 소비자가 FRED 키 설정 시 자동으로 live 인용.
  // (이전: DOM data-snap sink만 갱신 → 채팅은 정적 스냅샷 corePce/cpi만 읽어 신규 FRED 미반영.)
  try {
    const DS = window.DATA_SNAPSHOT;
    if (DS) {
      const _setLiveSnap = function(key, val) {
        if (typeof val === 'number' && isFinite(val)) {
          DS[key] = val;
          DS._fredLive = DS._fredLive || {};
          DS._fredLive[key] = { value: val, source: 'FRED', ts: Date.now() };
        }
      };
      if (data['CPIAUCSL'] && typeof data['CPIAUCSL'].yoy === 'number') _setLiveSnap('cpi', +data['CPIAUCSL'].yoy.toFixed(1));
      if (data['CPILFESL'] && typeof data['CPILFESL'].yoy === 'number') _setLiveSnap('coreCpi', +data['CPILFESL'].yoy.toFixed(1));
      if (data['PCEPI'] && typeof data['PCEPI'].yoy === 'number') _setLiveSnap('pce', +data['PCEPI'].yoy.toFixed(1));
      if (data['PCEPILFE'] && typeof data['PCEPILFE'].yoy === 'number') _setLiveSnap('corePce', +data['PCEPILFE'].yoy.toFixed(1));
      if (data['PAYEMS'] && data['PAYEMS'].value != null && data['PAYEMS'].prevValue != null) {
        _setLiveSnap('nfp', Math.round(data['PAYEMS'].value - data['PAYEMS'].prevValue));
      }
      if (data['FEDFUNDS'] && typeof data['FEDFUNDS'].value === 'number') _setLiveSnap('fedRate', +data['FEDFUNDS'].value.toFixed(2));
      if (data['UNRATE'] && typeof data['UNRATE'].value === 'number') _setLiveSnap('unemploy', +data['UNRATE'].value.toFixed(1));
    }
  } catch(_fredWb) { if (window._aioLog) window._aioLog('warn', 'render', 'FRED→DATA_SNAPSHOT write-back: ' + (_fredWb && _fredWb.message)); }
  if (data['UNRATE']) {
    _updSnap('unemploy', function(){ return data['UNRATE'].value.toFixed(1) + '%'; });
  }
  if (data['HOUST']) {
    _updSnap('housing', function(){ return Math.round(data['HOUST'].value) + 'K'; });
  }
  if (data['RSAFS']) {
    const rs = data['RSAFS'];
    if (rs.prevValue && rs.prevValue > 0) {
      const mom = ((rs.value - rs.prevValue) / rs.prevValue * 100);
      _updSnap('retail-sales', function(){ return (mom >= 0 ? '+' : '') + mom.toFixed(2) + '% MoM'; });
    }
  }
  // v51.97/Phase 2 [B2] fix (P593, resolves P456 미해소 잔존): 'cons-conf' DOM sink is labeled
  // and scaled as Conference Board Consumer Confidence (index.html data-snap="cons-conf", "Conf.
  // Board" sub-label, 100=optimistic/80=recession-fear thresholds) — a proprietary Conference
  // Board survey with no free FRED series. UMCSENT is University of Michigan Consumer Sentiment,
  // a different survey/methodology/scale (has run in the 50s in prior sessions' narratives) that
  // must NOT be silently substituted under the same label. Previously this block wrote UMCSENT
  // into the Conference-Board-labeled sink whenever a user had a personal FRED key configured.
  // UMCSENT itself is still fetched (data['UMCSENT'] available in window._fredData) for any
  // future dedicated Michigan Sentiment surface; it is intentionally left unrendered here.
  if (data['CES0500000003']) {
    const wg = data['CES0500000003'];
    if (wg.prevValue && wg.prevValue > 0) {
      const mom = ((wg.value - wg.prevValue) / wg.prevValue * 100);
      _updSnap('wage-growth', function(){ return '$' + wg.value.toFixed(2) + ' (' + (mom >= 0 ? '+' : '') + mom.toFixed(2) + '%)'; });
    }
  }

  // 2Y Rate — fix hardcoded value in FX/Bond page
  if (data['DGS2']) {
    const rate2y = data['DGS2'].value;
    window._live2Y = rate2y;
    if (window.DATA_SNAPSHOT) window.DATA_SNAPSHOT.tnx2y = rate2y;
    // Update yield curve if visible
    if (typeof updateFxBondPage === 'function') updateFxBondPage();
  }

  // v31.9: DGS10 Yahoo 실시간 → _live10Y 동기화 (yield curve 계산용)
  if (data['DGS10']) {
    window._live10Y = data['DGS10'].value;
  }
  if (data['DGS30']) {
    window._live30Y = data['DGS30'].value;
  }
  // v31.9: VIXCLS Yahoo 실시간 → 센티먼트 히스토리에 최신값 주입
  if (data['VIXCLS'] && data['VIXCLS']._source && data['VIXCLS']._source.startsWith('yahoo-')) {
    window._liveVIXCLS = data['VIXCLS'].value;
  }

  // 10Y-2Y Spread
  var _spreadEl = document.getElementById('spread-2s10s-val');
  if (data['T10Y2Y']) {
    const spread = data['T10Y2Y'].value;
    if (_spreadEl) {
      _spreadEl.textContent = (spread >= 0 ? '+' : '') + spread.toFixed(2) + '%';
      _spreadEl.style.color = spread < 0 ? '#ff5b50' : '#00e5a0';
      // v31.9: 소스 표시
      const spreadSub = document.getElementById('spread-2s10s-src');
      if (spreadSub) spreadSub.textContent = _fredSourceLabel(data['T10Y2Y']);
    }
  } else if (_spreadEl && _spreadEl.textContent === '—') {
    // v30.13d: FRED 실패 시 Yahoo 수익률 데이터로 폴백 계산
    var _tnxFb = _ldSafe('^TNX','price');
    var _y2Fb = window._live2Y;
    if (_tnxFb > 0 && typeof _y2Fb === 'number' && isFinite(_y2Fb)) {
      var _s2s10 = _tnxFb - _y2Fb;
      _spreadEl.textContent = (_s2s10 >= 0 ? '+' : '') + _s2s10.toFixed(2) + '%';
      _spreadEl.style.color = _s2s10 < 0 ? '#ff5b50' : '#00e5a0';
    }
  }

  // Unemployment, CPI, Fed Funds for macro page
  if (data['FEDFUNDS']) {
    document.querySelectorAll('[data-fred="FEDFUNDS"]').forEach(el => {
      el.textContent = data['FEDFUNDS'].value.toFixed(2) + '%';
    });
  }

  // v35.8: Fed Funds Rate 동적 연결
  if (data['DFEDTARU']) {
    var upper = parseFloat(data['DFEDTARU'].value);
    var lower = upper - 0.25;
    var rateStr = lower.toFixed(2) + '–' + upper.toFixed(2) + '%';
    document.querySelectorAll('[data-snap="fed-rate"]').forEach(function(el) {
      if (_aioIsNativeMacroElement(el)) return;
      el.textContent = rateStr;
    });
  }

  // v35.8: 2Y 금리 → yc-2y, yc-2y-track 동적 연결
  if (data['DGS2']) {
    var rate2yVal = data['DGS2'].value;
    var yc2yEl = document.getElementById('yc-2y');
    if (yc2yEl && yc2yEl.dataset.aioFxbondTwoYearRenderer !== 'native') { yc2yEl.textContent = rate2yVal.toFixed(2) + '%'; yc2yEl.style.color = rate2yVal > 4.5 ? '#ff5b50' : rate2yVal > 4.0 ? '#ffa31a' : '#00e5a0'; }
    var yc2yTrack = document.getElementById('yc-2y-track');
    if (yc2yTrack && yc2yTrack.dataset.aioFxbondTwoYearRenderer !== 'native') { yc2yTrack.textContent = rate2yVal.toFixed(2) + '%'; yc2yTrack.style.color = rate2yVal > 4.5 ? '#ff5b50' : rate2yVal > 4.0 ? '#ffa31a' : '#00e5a0'; }
  }

  // v35.8: DXY 1개월 변화율 동적 연결 (Yahoo DX-Y.NYB에서 계산)
  var dxyLive = _ldSafe('DX-Y.NYB', 'price');
  var dxyPrev = _ldSafe('DX-Y.NYB', 'prevClose');
  if (dxyLive > 0) {
    var dxy1mEl = document.getElementById('dxy-1m');
    if (dxy1mEl) {
      // 1개월 변화율은 정확한 30일 전 데이터가 필요하지만, 당일 변화율로 대체 표시
      var dxyDayPct = dxyPrev > 0 ? ((dxyLive - dxyPrev) / dxyPrev * 100) : 0;
      dxy1mEl.textContent = (dxyDayPct >= 0 ? '+' : '') + dxyDayPct.toFixed(1) + '%';
      dxy1mEl.style.color = dxyDayPct > 0.5 ? '#ff5b50' : dxyDayPct < -0.5 ? '#00e5a0' : '#ffa31a';
    }
  }

  // v35.8: Put/Call Ratio → regime-pcr 동적 연결
  if (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT.pcr) {
    var pcrEl = document.getElementById('regime-pcr');
    if (pcrEl) {
      pcrEl.textContent = DATA_SNAPSHOT.pcr.toFixed(2);
      pcrEl.style.color = DATA_SNAPSHOT.pcr > 1.2 ? '#ff5b50' : DATA_SNAPSHOT.pcr > 0.9 ? '#ffa31a' : '#00e5a0';
    }
  }

  // v31.9: FRED 데이터 신선도 요약 콘솔 로그
  const fredSummary = Object.entries(data).map(([id, d]) => {
    const src = d._source ? (d._source.startsWith('yahoo') ? 'Yahoo' : 'FRED') : 'FRED';
    return `  ${id}: ${typeof d.value === 'number' ? d.value.toFixed(2) : d.value} (${src} ${d.date})`;
  }).join('\n');
  if (Object.keys(data).length > 0) {
    console.log('[AIO v31.9] FRED/Yahoo 통합 데이터 현황:\n' + fredSummary);
  }
}

// v46.6: FRED 경제지표 시계열 차트 (실업률/CPI/기준금리)
var _fredChartInstances = {};
async function _renderFredCharts() {
  var statusEl = document.getElementById('fred-chart-status');
  var series = [
    { id:'UNRATE', canvas:'fred-unrate-chart', color:'#ff5b50', label:'실업률 (%)' },
    { id:'CPIAUCSL', canvas:'fred-cpi-chart', color:'#ffa31a', label:'CPI YoY (%)', transform:'yoy' },
    { id:'FEDFUNDS', canvas:'fred-fedfunds-chart', color:'#00bcd4', label:'기준금리 (%)' }
  ];
  function markUnavailable(s, reason) {
    var canvas = document.getElementById(s.canvas);
    if (!canvas) return;
    canvas.setAttribute('data-source-kind', 'unavailable');
    canvas.setAttribute('data-operational-use', 'blocked');
    canvas.setAttribute('data-source-label', s.id + ' unavailable');
    canvas.setAttribute('aria-label', s.label + ' 시계열 미수신');
    canvas.title = reason || 'FRED 시계열 미수신';
  }
  var fredKey = (typeof DATA_APIS !== 'undefined' && DATA_APIS.fred) ? DATA_APIS.fred.key() : '';
  if (!fredKey) {
    series.forEach(function(s) { markUnavailable(s, 'FRED API 키 미설정'); });
    if (statusEl) statusEl.textContent = 'FRED 시계열 미수신 · 차트 판단 보류';
    return;
  }
  if (statusEl) statusEl.textContent = 'FRED 공식 시계열 수집 중…';
  var rendered = 0;
  for (var si = 0; si < series.length; si++) {
    var s = series[si];
    try {
      var obs = await fetchFredSeries(s.id, s.transform === 'yoy' ? 25 : 13);
      if (!obs || obs.length < (s.transform === 'yoy' ? 13 : 3)) throw new Error('insufficient observations');
      obs = obs.slice().reverse();
      var labels = obs.map(function(o) { return o.date.slice(5); });
      var values = obs.map(function(o) { var v = Number(o.value); return Number.isFinite(v) ? v : null; });
      if (s.transform === 'yoy') {
        values = values.slice(12).map(function(v, i) {
          var prev = values[i];
          return v != null && prev > 0 ? (v - prev) / prev * 100 : null;
        });
        labels = labels.slice(12);
      }
      var canvas = document.getElementById(s.canvas);
      if (!canvas || typeof Chart === 'undefined' || values.filter(Number.isFinite).length < 3) throw new Error('chart unavailable');
      if (_fredChartInstances[s.id]) { try { _fredChartInstances[s.id].destroy(); } catch (_) {} }
      _fredChartInstances[s.id] = new Chart(canvas, {
        type:'line',
        data:{ labels:labels, datasets:[{ label:s.label, data:values, borderColor:s.color, backgroundColor:s.color + '18', borderWidth:2, pointRadius:2, fill:true, tension:0.3 }] },
        options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ grid:{ color:'var(--surface-4)' }, ticks:{ color:'#a0b4c8', font:{ size:11 } } }, x:{ grid:{ display:false }, ticks:{ color:'#a0b4c8', font:{ size:11 }, maxTicksLimit:6 } } }, plugins:{ legend:{ display:false } } }
      });
      canvas.setAttribute('data-source-kind', 'official-api');
      canvas.setAttribute('data-operational-use', 'decision');
      canvas.setAttribute('data-source-label', 'FRED ' + s.id);
      canvas.setAttribute('data-source-ts', new Date().toISOString());
      rendered++;
    } catch (e) {
      markUnavailable(s, e && e.message || 'FRED fetch failed');
      if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'FRED chart unavailable: ' + s.id);
    }
  }
  if (statusEl) statusEl.textContent = rendered + '/' + series.length + '개 FRED 공식 시계열 표시';
}

// ═══ 6. Finnhub — 실시간 뉴스 & 기업 뉴스 ═══════════════════
async function fetchFinnhubNews(category = 'general') {
  const key = DATA_APIS.finnhub.key();
  if (!key) return [];
  try {
    const url = `${DATA_APIS.finnhub.base}/news?category=${category}&token=${key}`;
    const r = await fetchWithTimeout(url, {}, 6000);
    if (r.ok) {
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    }
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub news error: ' + (e.message || String(e))); }
  return [];
}

// v47.10: fetchFinnhubCompanyNews 제거 — 정의만 있고 호출 0건 (dead code P112)
// v48.13: 재도입 — 기업 분석 페이지에서 '최근 기업 뉴스' 섹션에 활용 (Finnhub 무료 60/min)
//         headline/datetime/source/url 수집 → _renderFundNews UI + AI 프롬프트 근거
async function fetchFinnhubCompanyNews(symbol, daysBack) {
  var key = DATA_APIS.finnhub.key();
  if (!key) return [];
  daysBack = daysBack || 14;
  try {
    var to = new Date().toISOString().slice(0,10);
    var from = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0,10);
    var url = DATA_APIS.finnhub.base + '/company-news?symbol=' + encodeURIComponent(symbol) + '&from=' + from + '&to=' + to + '&token=' + key;
    var r = await fetchWithTimeout(url, {}, 6000);
    if (!r.ok) return [];
    var d = await r.json();
    if (!Array.isArray(d)) return [];
    // 최신순 정렬 + 중복 제거(headline 기준) + 상위 15건
    var seen = {};
    var items = d.filter(function(n){ if (!n || !n.headline || seen[n.headline]) return false; seen[n.headline] = 1; return true; });
    items.sort(function(a,b){ return (b.datetime||0) - (a.datetime||0); });
    return items.slice(0, 15).map(function(n){
      return {
        headline: n.headline || '',
        summary: (n.summary || '').replace(/\s+/g,' ').trim(),
        url: n.url || '',
        source: n.source || 'Finnhub',
        datetime: n.datetime || 0,
        date: n.datetime ? new Date(n.datetime * 1000).toISOString().slice(0,10) : '',
        image: n.image || null
      };
    });
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub company-news error: ' + e.message); return []; }
}

// v48.0: Finnhub 무료 티어 확장 활용 — /stock/metric (PE/PB/ROE/52W 통합), /stock/recommendation (애널리스트), /calendar/earnings
// FMP 유료 키 없는 사용자에게도 유사 품질의 밸류에이션 제공. 무료 60/min.
async function fetchFinnhubMetrics(symbol) {
  const key = DATA_APIS.finnhub.key();
  if (!key) return null;
  try {
    const url = `${DATA_APIS.finnhub.base}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${key}`;
    const r = await fetchWithTimeout(url, {}, 6000);
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.metric ? d.metric : null;  // {peBasicExclExtraTTM, pb, beta, 52WeekHigh, 52WeekLow, epsTTM, roeTTM, ...}
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub metric error: ' + e.message); return null; }
}
async function fetchFinnhubRecommendation(symbol) {
  const key = DATA_APIS.finnhub.key();
  if (!key) return null;
  try {
    const url = `${DATA_APIS.finnhub.base}/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${key}`;
    const r = await fetchWithTimeout(url, {}, 6000);
    if (!r.ok) return null;
    const arr = await r.json();
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;  // {buy, hold, sell, strongBuy, strongSell, period}
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub recommendation error: ' + e.message); return null; }
}
async function fetchFinnhubEarningsCalendar(fromDate, toDate, symbol) {
  const key = DATA_APIS.finnhub.key();
  if (!key) return [];
  try {
    let url = `${DATA_APIS.finnhub.base}/calendar/earnings?from=${fromDate}&to=${toDate}&token=${key}`;
    if (symbol) url += `&symbol=${encodeURIComponent(symbol)}`;
    const r = await fetchWithTimeout(url, {}, 6000);
    if (!r.ok) return [];
    const d = await r.json();
    return d && Array.isArray(d.earningsCalendar) ? d.earningsCalendar : [];
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub earnings calendar error: ' + e.message); return []; }
}

// v48.56: Finnhub IPO 캘린더 — 무료 tier 60 req/min
async function fetchFinnhubIpoCalendar(fromDate, toDate) {
  const key = DATA_APIS.finnhub.key();
  if (!key) return [];
  try {
    const url = `${DATA_APIS.finnhub.base}/calendar/ipo?from=${fromDate}&to=${toDate}&token=${key}`;
    const r = await fetchWithTimeout(url, {}, 6000);
    if (!r.ok) return [];
    const d = await r.json();
    return d && Array.isArray(d.ipoCalendar) ? d.ipoCalendar : [];
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub IPO calendar error: ' + e.message); return []; }
}

// v48.56: Finnhub 경제 이벤트 캘린더 — 리스크 레이더 데이터 소스 (FOMC/CPI/GDP/PMI 등)
async function fetchFinnhubEconomicCalendar(fromDate, toDate) {
  const key = DATA_APIS.finnhub.key();
  if (!key) return [];
  try {
    const url = `${DATA_APIS.finnhub.base}/calendar/economic?from=${fromDate}&to=${toDate}&token=${key}`;
    const r = await fetchWithTimeout(url, {}, 7000);
    if (!r.ok) return [];
    const d = await r.json();
    return d && Array.isArray(d.economicCalendar) ? d.economicCalendar : [];
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub economic calendar error: ' + e.message); return []; }
}


// ═══ 6b. NewsData.io — CORS 지원 뉴스 API (무료 200건/일) ═══════
async function fetchNewsDataIO(category = 'business') {
  const key = _getApiKey('aio_newsdata_key') || '';
  if (!key) return [];
  // v48.9: 공유 키 쿼터 사전 체크 (200/day 도달 시 스킵)
  if (typeof _isQuotaExceeded === 'function' && _isQuotaExceeded('newsdata')) return [];
  try {
    const url = `https://newsdata.io/api/1/latest?apikey=${key}&category=${category}&language=en&size=10`;
    const r = await fetchWithTimeout(url, {}, 8000);
    if (!r.ok) return [];
    if (typeof _bumpApiCounter === 'function') _bumpApiCounter('newsdata');
    const data = await r.json();
    if (data.status === 'success' && Array.isArray(data.results)) {
      return data.results.map(item => ({
        title: (item.title || '').trim(),
        desc: (item.description || '').trim().slice(0, 280),
        link: item.link || '#',
        pubDate: item.pubDate || '',
        source: item.source_name || 'NewsData.io',
        country: item.country?.[0] || 'us',
        tier: 1,
        flag: '',
        topics: ['macro', 'equity'],
        _api: 'newsdata'
      })).filter(i => i.title.length > 10);
    }
  } catch(e) { _aioLog('warn', 'fetch', 'NewsData.io error: ' + (e.message || String(e))); }
  return [];
}

// ═══ 6c. Finnhub News → 통합 뉴스 포맷 변환 ═══════════════════
async function fetchFinnhubNewsFormatted() {
  const items = await fetchFinnhubNews('general');
  if (!items || !items.length) return [];
  return items.slice(0, 20).map(item => ({
    title: (item.headline || '').trim(),
    desc: (item.summary || '').trim().slice(0, 280),
    link: item.url || '#',
    pubDate: item.datetime ? new Date(item.datetime * 1000).toISOString() : '',
    source: item.source || 'Finnhub',
    country: 'us',
    tier: 1,
    flag: '',
    topics: ['macro', 'equity'],
    _api: 'finnhub'
  })).filter(i => i.title.length > 10);
}

// ═══ 7. 시장 폭 (Breadth) — Yahoo Finance 기반 동적 계산 ═══════
async function fetchBreadthData() {
  // The server artifact is the primary value-specific collector. Do not overwrite a verified
  // universe breadth reading with top-movers/RSP proxy output during the same page session.
  if (window._aioScreenerBreadthState && window._aioScreenerBreadthState.status === 'verified_current') {
    return { updated:false, source:'screener-breadth-primary' };
  }
  // B계층 갭: MMFI/MMTW/MMFD는 심볼 목록에만 존재하고 실 fetch 미구현.
  //   이유: NYSE Advance/Decline 실측 API 없음 — Seeking Alpha/CBOE는 유료.
  //   실제 동작: (1) Alpha Vantage TOP_GAINERS_LOSERS 비율 또는 (2) RSP/SPY 비율 프록시만 사용.
  //   실측 %aboveMA 필요 시 CBOE 유료 API 또는 서버-사이드 계산 필요 (B계층 WO-1 참고).
  // Use SPY component ETFs to approximate breadth
  const breadthSymbols = [
    { sym: 'RSP', name: 'Equal Weight S&P' },    // RSP vs SPY ratio = breadth proxy
    { sym: 'MMFI', name: '50D% Index' },          // % above 50MA (목록만, 미fetch)
    { sym: 'MMTW', name: '20D% Index' },          // % above 20MA (목록만, 미fetch)
    { sym: 'MMFD', name: '200D% Index' },         // % above 200MA (목록만, 미fetch)
  ];

  // Also fetch advance/decline via ETFs
  try {
    // Method 1: Try Alpha Vantage market movers for breadth approximation
    const avKey = DATA_APIS.alphaVantage.key();
    // v48.9: AV 무료 25/day 쿼터 사전 체크
    if (avKey && avKey !== 'demo' && !(typeof _isQuotaExceeded === 'function' && _isQuotaExceeded('alphaVantage'))) {
      const url = `${DATA_APIS.alphaVantage.base}?function=TOP_GAINERS_LOSERS&apikey=${avKey}`;
      const r = await fetchWithTimeout(url, {}, 8000);
      if (r.ok) {
        if (typeof _bumpApiCounter === 'function') _bumpApiCounter('alphaVantage');
        const data = await r.json();
        if (data.top_gainers && data.top_losers) {
          const gainers = data.top_gainers.length;
          const losers = data.top_losers.length;
          const advDecline = gainers / (gainers + losers);
          // Update breadth display
          updateBreadthUI({ advanceRatio: advDecline, gainers, losers, source: 'Alpha Vantage' });
          return;
        }
      }
    }

    // Method 2: Fetch RSP/SPY ratio as breadth proxy
    const rspData = window._liveData?.['RSP'];
    const spyData = window._liveData?.['SPY'];
    if (rspData && spyData) {
      const ratio = rspData.price / spyData.price;
      const rspChg = rspData.pct;
      const spyChg = spyData.pct;
      const breadthSignal = rspChg - spyChg; // positive = broad rally, negative = narrow
      updateBreadthUI({
        rspSpyRatio: ratio,
        breadthSignal,
        spyChg, rspChg,
        source: 'RSP/SPY Ratio'
      });
    }
  } catch(e) {
    _aioLog('warn', 'breadth', 'Breadth data error: ' + (e && e.message || e));
    showDataError('시장폭', '시장 폭 데이터 수신 실패 — 정적 데이터 사용 중', 'warn');
  }
}

function updateBreadthUI(data) {
  // Update breadth KPI cards
  // v52.66: 하드코딩 네온 hex(#00e5a0 등, 구 다크테마 잔재 — P1/P2 스윕 누락)를 토큰으로,
  // 영문 터미널 라벨(BROAD RALLY 등)을 한국어로 교체.
  if (data.advanceRatio !== undefined) {
    const pct = (data.advanceRatio * 100).toFixed(1);
    const el = document.getElementById('breadth-advance-ratio');
    if (el && !(typeof window._aioIsNativeBreadthElement === 'function' && window._aioIsNativeBreadthElement(el))) {
      el.textContent = pct + '%';
      el.style.color = data.advanceRatio > 0.5 ? 'var(--data-green)' : data.advanceRatio > 0.3 ? 'var(--data-amber)' : 'var(--data-red)';
    }
  }
  if (data.breadthSignal !== undefined) {
    const el = document.querySelector('[id="breadth-signal-val"]');
    if (el && el.dataset.aioBreadthSignalRenderer !== 'native') {
      const txt = data.breadthSignal > 0.5 ? '광범위 상승' : data.breadthSignal > -0.5 ? '중립' : '쏠림 장세';
      el.textContent = txt;
      el.style.color = data.breadthSignal > 0.5 ? 'var(--data-green)' : data.breadthSignal > -0.5 ? 'var(--data-amber)' : 'var(--data-red)';
    }
  }
  // Update source badge
  const srcEl = document.getElementById('breadth-source');
  if (srcEl) srcEl.textContent = data.source || 'Live Data';
  console.log('[AIO v20] Breadth updated:', data);
}

// ═══ 8. 센티먼트 차트 실시간 업데이트 ═══════════════════════
async function fetchSentimentHistory() {
  // VIX History from Yahoo Finance
  try {
    const vixUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=3mo';
    const r = await fetchViaProxy(vixUrl, 8000);
    let raw;
    try { raw = await r.text(); } catch(e) { raw = ''; }
    // v30.11: HTML 에러페이지 탐지 (유령 차트 방지)
    if (raw.trimStart().startsWith('<!DOCTYPE') || raw.trimStart().startsWith('<html')) {
      _aioLog('warn', 'chart', 'VIX chart: Yahoo returned HTML error page');
      showDataError('VIX차트', 'Yahoo Finance HTML 에러 — 프록시 전환 대기', 'warn');
      return;
    }
    let data;
    try { data = JSON.parse(raw); } catch(e) { data = {}; }
    // Handle allorigins wrapper
    if (data.contents) {
      try { data = JSON.parse(data.contents); } catch(e) {}
      // v30.11: 이중 래핑된 경우도 HTML 체크
      if (typeof data === 'string' && data.trimStart().startsWith('<')) {
        _aioLog('warn', 'chart', 'VIX chart: allorigins returned HTML inside JSON wrapper');
        return;
      }
    }

    // v30.11: 공통 파서 사용
    var parsed = _parseYFChartResponse(data);
    if (parsed && parsed.closes.length >= 3) {
      // v30.11: UTC 기반 날짜 라벨 사용 (타임존 밀림 방지)
      var vixHistory = parsed.labels.map(function(lbl, i) {
        return { date: lbl, value: parsed.closes[i] };
      }).slice(-30); // last 30 days

      window._vixHistory = vixHistory;
      document.dispatchEvent(new CustomEvent('aio:historyLoaded', { detail: { metric: 'vix', source: 'legacy-projection' } }));
      console.log('[AIO v20] VIX history loaded:', vixHistory.length, 'days');
    } else {
      _aioLog('warn', 'chart', 'VIX chart: insufficient data points');
      showDataError('VIX차트', '데이터 포인트 부족 — 정적 차트 유지', 'warn');
    }
  } catch(e) {
    _aioLog('warn', 'fetch', 'VIX history fetch failed: ' + e.message);
    showDataError('VIX', 'VIX 히스토리 수신 실패 — 정적 차트 데이터 사용 중', 'warn');
  }
}

// ═══ 9. 데이터 갱신 스케줄러 (중앙 관리) ═══════════════════════
// v21: 5명 동시 접속 기준 rate limit 안전 간격
// ────────────────────────────────────────────────────
// API별 한도 분석 (5명 기준):
//   rss2json    : 10,000/일 → 소스50 × 갱신횟수 × 5명 → 45분 간격이면 ~5,300/일 (안전)
//   Finnhub     : 60/분     → 시세 1콜 × 5명 = 5/분 (여유)
//   NewsData.io : 200/일    → 갱신당 1콜 × 5명 → 45분이면 ~160/일 (안전)
//   Twelve Data : 8/분      → 1콜 × 5명 = 5/분 (여유, 단 동시 호출 피해야)
//   FRED        : 120/일    → 2시간 간격 × 5명 = ~60/일 (안전)
//   Claude(번역) : 유료      → 45분 간격이면 일 ~80콜 × 5명 = 비용 감소
//   Yahoo(프록시): 무제한    → 프록시 부하만 주의
//   CoinGecko   : 10~30/분  → 60초 간격 × 5명 = 5/분 (안전)
// ────────────────────────────────────────────────────
const REFRESH_SCHEDULE = {
  quotes:     { fn: null, interval: 180000,     label: '시세 (3분)',          timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
  news:       { fn: null, interval: 2700000,    label: '뉴스 (45분)',          timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
  sentiment:  { fn: null, interval: 600000,     label: '센티먼트 (10분)',       timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
  breadth:    { fn: null, interval: 600000,     label: '시장 폭 (10분)',        timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
  fred:       { fn: null, interval: 7200000,    label: 'FRED (2시간)',         timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
  technicals: { fn: null, interval: 900000,     label: '기술 지표 (15분)',      timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
  vixHistory: { fn: null, interval: 1800000,    label: 'VIX 히스토리 (30분)',   timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
  hySpread:   { fn: null, interval: 21600000,   label: 'HY 스프레드 (6시간)',   timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
  maUpdate:   { fn: null, interval: 21600000,   label: 'MA 갱신 (6시간)',       timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
  krSupply:   { fn: null, interval: 600000,     label: 'KR 수급 (10분)',        timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
  krDynamic:  { fn: null, interval: 1800000,    label: 'KR 동적 (30분)',        timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
};

// v30.11: Page Visibility API — 백그라운드 탭 타이머 절약
window.REFRESH_SCHEDULE = REFRESH_SCHEDULE;
_normalizeRefreshSchedule();

let _schedulerPaused = false;
let _lastVisibleTime = Date.now();

function _aioRefreshTaskLabel(key, cfg) {
  return (cfg && cfg.label) || key;
}

function _aioEmitRefreshEvent(type, detail) {
  try {
    window.AIO = window.AIO || {};
    var state = Object.assign({
      type: type,
      active: type !== 'done',
      generatedAt: new Date().toISOString()
    }, detail || {});
    window.AIO.refreshState = state;
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('aio:refresh:' + type, { detail: state }));
      window.dispatchEvent(new CustomEvent('aio:refresh', { detail: state }));
    }
  } catch (_) {}
}

function _aioMarkSchedulerFetch(key, result) {
  if (result && result.updated === false) return;
  if (typeof window._markFetch !== 'function') return;
  var map = {
    quotes: 'quote',
    news: 'news',
    sentiment: 'sentiment',
    breadth: 'breadth',
    fred: 'fred',
    technicals: 'technicals',
    vixHistory: 'vixHistory',
    hySpread: 'hySpread',
    maUpdate: 'maUpdate',
    krSupply: 'krSupply',
    krDynamic: 'krDynamic'
  };
  window._markFetch(map[key] || key);
}

function _aioCallOptionalGlobal(fnName, args) {
  try {
    var fn = window && window[fnName];
    if (typeof fn === 'function') return fn.apply(window, args || []);
    return { ok: false, skipped: true, updated: false, reason: fnName + ' unavailable on this bundle' };
  } catch (e) {
    return { ok: false, skipped: false, updated: false, reason: e && e.message || String(e) };
  }
}
window._aioCallOptionalGlobal = _aioCallOptionalGlobal;

window.AIO = window.AIO || {};
window.AIO.getRefreshState = function() {
  return window.AIO.refreshState || { active: false, generatedAt: new Date().toISOString() };
};

function _normalizeRefreshSchedule() {
  Object.entries(REFRESH_SCHEDULE || {}).forEach(([key, cfg]) => {
    cfg.key = cfg.key || key;
    cfg.priority = cfg.priority || (key === 'quotes' ? 'high' : key === 'news' || key === 'sentiment' ? 'medium' : 'normal');
    cfg.timeoutMs = cfg.timeoutMs || Math.min(Math.max(Math.round((cfg.interval || 60000) * 0.35), 8000), 60000);
    cfg.retryCount = cfg.retryCount || 0;
    cfg.nextDue = cfg.nextDue || 0;
    cfg.lastRunStart = cfg.lastRunStart || 0;
    cfg.lastRunEnd = cfg.lastRunEnd || 0;
    cfg.lastDurationMs = cfg.lastDurationMs || 0;
    cfg.policyKey = cfg.policyKey || (key === 'quotes' ? 'quote' : key === 'news' ? 'news' : key === 'fred' ? 'macro_daily' : key === 'krSupply' ? 'kr_supply' : key === 'technicals' ? 'technical' : 'sentiment');
  });
}

async function _runScheduledTask(key, cfg, showError, opts) {
  opts = opts || {};
  if (!cfg || typeof cfg.fn !== 'function') return { key: key, ok: false, skipped: true, error: 'scheduler function not assigned' };
  if (_schedulerPaused) return { key: key, ok: false, skipped: true, error: 'scheduler paused' };
  if (cfg._inFlight) return { key: key, ok: false, skipped: true, error: 'scheduler task already in flight' };
  cfg._inFlight = true;
  cfg.lastRunStart = Date.now();
  cfg._attemptedAt = new Date(cfg.lastRunStart).toISOString();
  cfg._status = 'loading';
  cfg._failureReason = '';
  var resolved;
  try {
    var taskResult = cfg.fn(opts);
    if (taskResult && typeof taskResult.then === 'function') {
      var timeoutMs = Math.max(3000, cfg.timeoutMs || 30000);
      resolved = await Promise.race([
        taskResult,
        new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error('scheduler timeout: ' + key + ' (' + timeoutMs + 'ms)')); }, timeoutMs);
        })
      ]);
    } else {
      resolved = taskResult;
    }
    if (resolved && typeof resolved === 'object' && resolved.ok === false) {
      cfg._lastErr = resolved.error || resolved.reason || 'scheduler task returned no update';
      cfg._status = resolved.status || (resolved.skipped ? 'missing' : 'failed');
      cfg._failureReason = cfg._lastErr;
      return {
        key: key,
        ok: false,
        skipped: !!resolved.skipped,
        updated: resolved.updated === true,
        error: cfg._lastErr,
        result: resolved
      };
    }
    if (resolved && typeof resolved === 'object' && resolved.updated === false && resolved.skipped) {
      cfg._lastErr = resolved.error || resolved.reason || 'scheduler task skipped without update';
      cfg._status = resolved.status || 'missing';
      cfg._failureReason = cfg._lastErr;
      return {
        key: key,
        ok: false,
        skipped: true,
        updated: false,
        error: cfg._lastErr,
        result: resolved
      };
    }
    cfg._lastOk = Date.now();
    cfg._lastSuccessfulAt = new Date(cfg._lastOk).toISOString();
    cfg._lastErr = '';
    cfg._failureReason = '';
    cfg.retryCount = 0;
    var settledFailure = Array.isArray(resolved) && resolved.some(function(row) { return row && row.status === 'rejected'; });
    cfg._status = (resolved && resolved.status) || (settledFailure ? 'partial' : 'loaded');
    cfg._coverage = resolved && typeof resolved.coverage === 'number' ? resolved.coverage : (resolved && typeof resolved.coveragePct === 'number' ? resolved.coveragePct : (cfg._coverage != null ? cfg._coverage : 100));
    cfg._evidenceIds = resolved && Array.isArray(resolved.evidenceIds) ? resolved.evidenceIds.slice() : (cfg._evidenceIds || []);
    cfg._sourceKind = resolved && resolved.sourceKind || cfg._sourceKind || null;
    cfg._allowedUse = resolved && resolved.allowedUse || cfg._allowedUse || null;
    _aioMarkSchedulerFetch(key, resolved);
    return { key: key, ok: !settledFailure, skipped: false, updated: !(resolved && resolved.updated === false), status: cfg._status, lastSuccessfulAt: cfg._lastSuccessfulAt, error: '', result: resolved };
  } catch(e) {
    cfg._lastErr = e && e.message || String(e);
    cfg._status = 'failed';
    cfg._failureReason = cfg._lastErr;
    cfg.retryCount = (cfg.retryCount || 0) + 1;
    if (showError) showDataError(cfg.label, 'auto refresh failed; retrying on next cycle', 'warn');
    return { key: key, ok: false, skipped: false, updated: false, error: cfg._lastErr };
  } finally {
    cfg.lastRunEnd = Date.now();
    cfg.lastDurationMs = cfg.lastRunEnd - cfg.lastRunStart;
    cfg._inFlight = false;
  }
}

function _assignRefreshScheduleFunctions() {
  REFRESH_SCHEDULE.quotes.fn     = (opts) => { return (typeof fetchLiveQuotes === 'function') ? fetchLiveQuotes(opts && opts.symbols) : null; };
  REFRESH_SCHEDULE.news.fn       = (opts) => { return (typeof fetchAllNews === 'function') ? fetchAllNews(!!(opts && opts.forceRefresh)) : null; };
  REFRESH_SCHEDULE.sentiment.fn  = () => {
    var jobs = [];
    if (typeof fetchFearGreed === 'function') jobs.push(fetchFearGreed());
    if (typeof fetchPutCall === 'function') jobs.push(fetchPutCall());
    return Promise.allSettled(jobs);
  };
  REFRESH_SCHEDULE.breadth.fn    = fetchBreadthData;
  REFRESH_SCHEDULE.fred.fn       = fetchAllFredData;
  REFRESH_SCHEDULE.technicals.fn = (opts) => {
    var optSymbols = opts && Array.isArray(opts.symbols) ? opts.symbols : [];
    var symbol = optSymbols.filter(function(s) { return s && String(s).charAt(0) !== '^'; })[0] || _aioGetActiveTechnicalSymbol(opts && opts.pageId);
    return fetchTechnicalIndicators(symbol).then(d => {
      if (d) {
        applyTechIndicators(d);
        return { ok: true, updated: true, symbol: symbol };
      }
      return { ok: false, skipped: true, updated: false, reason: 'technical indicators unavailable', symbol: symbol };
    });
  };
  REFRESH_SCHEDULE.vixHistory.fn = fetchSentimentHistory;
  REFRESH_SCHEDULE.hySpread.fn   = () => { return (typeof fetchHYSpread === 'function') ? fetchHYSpread() : null; };
  REFRESH_SCHEDULE.maUpdate.fn   = () => { return (typeof autoUpdateMA === 'function') ? autoUpdateMA() : null; };
  REFRESH_SCHEDULE.krSupply.fn   = () => _aioCallOptionalGlobal('fetchKrSupplyData');
  REFRESH_SCHEDULE.krDynamic.fn  = () => { return (typeof fetchKrDynamicData === 'function') ? fetchKrDynamicData() : null; };
  window.REFRESH_SCHEDULE = REFRESH_SCHEDULE;
  _normalizeRefreshSchedule();
}

function _aioGetActiveTechnicalSymbol(pageId) {
  var symbol = '';
  try {
    if (pageId === 'signal') {
      var input = document.getElementById('signal-lockout-symbol');
      if (input && input.value) symbol = String(input.value);
    }
    if (!symbol && window.AIO && typeof window.AIO.collectPageDataSymbols === 'function') {
      var symbols = window.AIO.collectPageDataSymbols(pageId || 'technical') || [];
      symbol = (symbols || []).filter(function(s) { return s && String(s).charAt(0) !== '^'; })[0] || symbols[0] || '';
    }
  } catch(e) {}
  symbol = String(symbol || 'SPY').trim().toUpperCase();
  return symbol || 'SPY';
}
window._aioGetActiveTechnicalSymbol = _aioGetActiveTechnicalSymbol;

_assignRefreshScheduleFunctions();

function startDataScheduler() {
  console.log('[AIO v21] ═══ Data Scheduler Starting (5명 동시접속 최적화) ═══');

  // v21: 랜덤 지터 함수 — 각 유저가 약간 다른 시간에 호출하도록
  // interval의 ±15% 범위 내에서 랜덤화
  function jitteredInterval(baseMs) {
    const jitter = baseMs * 0.15; // ±15%
    return baseMs + Math.floor(Math.random() * jitter * 2 - jitter);
  }

  // Assign functions
  _assignRefreshScheduleFunctions();
  // v30.11: 중앙 스케줄러 편입 (T3, T7 독립 타이머 → 여기로 통합)
  REFRESH_SCHEDULE.hySpread.fn   = () => { return (typeof fetchHYSpread === 'function') ? fetchHYSpread() : null; };
  REFRESH_SCHEDULE.maUpdate.fn   = () => { return (typeof autoUpdateMA === 'function') ? autoUpdateMA() : null; };
  REFRESH_SCHEDULE.krSupply.fn   = () => _aioCallOptionalGlobal('fetchKrSupplyData');
  REFRESH_SCHEDULE.krDynamic.fn  = () => { return (typeof fetchKrDynamicData === 'function') ? fetchKrDynamicData() : null; };
  window.REFRESH_SCHEDULE = REFRESH_SCHEDULE;
  _normalizeRefreshSchedule();

  // v21: 지터가 적용된 타이머 시작 (5명이 동시 호출하는 것 방지)
  Object.entries(REFRESH_SCHEDULE).forEach(([key, cfg]) => {
    if (cfg.fn && cfg.interval > 0) {
      // 첫 실행도 랜덤 딜레이 후 시작 (0~30초)
      const initialDelay = Math.floor(Math.random() * 30000);
      setTimeout(() => {
        // setInterval 대신 재귀 setTimeout으로 매번 지터 적용
        function scheduleNext() {
          const nextInterval = jitteredInterval(cfg.interval);
          cfg.nextDue = Date.now() + nextInterval;
          cfg.timer = setTimeout(async () => {
            await _runScheduledTask(key, cfg, true);
            scheduleNext();
          }, nextInterval);
        }
        scheduleNext();
      }, initialDelay);
      console.log(`  ✓ ${cfg.label} — ~${Math.round(cfg.interval / 1000)}s (±15% jitter, 시작 +${Math.round(initialDelay/1000)}s)`);
    }
  });

  // Update status display
  updateDataStatus();
  // v48.91: 타이머 레지스트리 등록
  window._dataStatusInterval = _aioRegisterTimer('dataStatus', updateDataStatus, T.COOLDOWN);

  console.log('[AIO v20] ═══ All schedulers active ═══');
}

// ─────────────────────────────────────────────────────────────────
// v49.98 P463/R187: 종합 5 페이지 on-enter 즉시 갱신 (매매 핵심 페이지 stale 차단)
// 갭: 스케줄러는 주기(10분 등)로만 돌아 페이지 진입 시점에 stale할 수 있음.
//     실제 매매에 쓰는 종합 5페이지(대시보드/시그널/시장폭/심리/브리핑)는
//     진입 즉시 의존 태스크가 stale(½ interval 초과)이면 강제 재fetch해 최신 반영.
// 디바운스: 동일 태스크 동시 진입 폭주 방지 (cfg._inFlight + per-task 최소 간격).
// ─────────────────────────────────────────────────────────────────
var AIO_PAGE_REFRESH_MAP = {
  home:        ['quotes', 'news', 'sentiment', 'breadth', 'technicals'],
  signal:      ['quotes', 'sentiment', 'breadth', 'technicals', 'vixHistory', 'hySpread'],
  breadth:     ['quotes', 'breadth', 'technicals'],
  sentiment:   ['quotes', 'sentiment', 'vixHistory', 'hySpread'],
  briefing:    ['quotes', 'news', 'sentiment', 'breadth', 'fred', 'technicals'],
  technical:   ['quotes', 'technicals', 'breadth', 'sentiment', 'vixHistory', 'krDynamic'],
  macro:       ['quotes', 'fred', 'news', 'sentiment', 'krDynamic', 'krSupply'],
  fxbond:      ['quotes', 'fred', 'hySpread', 'news'],
  fundamental: ['quotes', 'news', 'technicals'],
  themes:      ['quotes', 'news', 'technicals', 'krDynamic'],
  screener:    ['quotes', 'technicals'],
  portfolio:   ['quotes', 'technicals'],
  'market-news': ['quotes', 'news'],
  // v53.7 (P725): KR 라우트 퇴역 — themes/macro/technical가 KR 섹션 갱신을 겸함
  'options': ['quotes', 'sentiment']
};
window.AIO_PAGE_REFRESH_MAP = AIO_PAGE_REFRESH_MAP;
window.AIO_CRITICAL_10_PAGE_IDS = ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','fundamental','themes'];
try {
  if (window.AIO && typeof window.AIO.applyPageContractCompatibility === 'function') {
    window.AIO.applyPageContractCompatibility();
  }
} catch(_) {}

function _aioGetRefreshProfile(pageId) {
  try {
    if (window.AIO && typeof window.AIO.getDataRequirementProfile === 'function') {
      return window.AIO.getDataRequirementProfile({ pageId: pageId, reason: 'page-onenter', forceFresh: true });
    }
  } catch(_) {}
  var raw = window.AIO && window.AIO.DATA_REQUIREMENT_PROFILES ? window.AIO.DATA_REQUIREMENT_PROFILES[pageId] : null;
  return {
    pageId: pageId,
    tasks: (raw && raw.tasks) || AIO_PAGE_REFRESH_MAP[pageId] || [],
    symbols: (raw && raw.symbols) || []
  };
}

function _aioGetComprehensiveSymbols() {
  var out = [];
  ['home','signal','breadth','sentiment','briefing'].forEach(function(pageId) {
    var p = _aioGetRefreshProfile(pageId);
    (p.symbols || []).forEach(function(sym) { out.push(sym); });
  });
  return Array.from(new Set(out.map(function(sym) { return String(sym || '').trim().toUpperCase(); }).filter(Boolean)));
}

function _aioGetCritical10Symbols() {
  var out = [];
  (window.AIO_CRITICAL_10_PAGE_IDS || ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','fundamental','themes']).forEach(function(pageId) {
    var p = _aioGetRefreshProfile(pageId);
    (p.symbols || []).forEach(function(sym) { out.push(sym); });
  });
  return Array.from(new Set(out.map(function(sym) { return String(sym || '').trim().toUpperCase(); }).filter(Boolean)));
}
window._aioGetCritical10Symbols = _aioGetCritical10Symbols;

var _aioPageRefreshLast = {};   // key -> 마지막 on-enter 강제 fetch ts (per-task 최소 간격 가드)

// v49.99 연계점①: HOME_WEEKLY_NEWS 만료 감지 → news 태스크 강제 pre-warm
// 문제: news interval 45분, stale threshold 22.5분 — HOME_WEEKLY_NEWS 만료 시점에
//       마지막 news 실행이 22.5분 미만이면 on-enter refresh가 스킵 → "수집 중..." 공백.
// 해결: HOME_WEEKLY_NEWS가 만료됐거나 24h 이내 만료 예정이면 news 태스크를 stale 무관하게 강제 실행.
function _aioIsWeeklyNewsExpiring() {
  var src = window.HOME_WEEKLY_NEWS || (typeof HOME_WEEKLY_NEWS !== 'undefined' ? HOME_WEEKLY_NEWS : null);
  if (!src || !src.length) return true; // 비어있으면 만료로 간주
  var now = Date.now();
  var maxAgeMs = 72 * 60 * 60 * 1000;   // 72h 만료 기준
  var warnMs   = 24 * 60 * 60 * 1000;   // 24h 전부터 pre-warm
  var currentCount = (typeof _aioGetCurrentHomeWeeklyNews === 'function') ? _aioGetCurrentHomeWeeklyNews(now).length : 0;
  if (currentCount < Math.min(3, src.length)) return true;
  return src.some(function(n) {
    if (!n || !n.date) return true;
    var t = new Date(String(n.date) + 'T23:59:59+09:00').getTime();
    if (isNaN(t)) return true;
    return (now - t) >= (maxAgeMs - warnMs); // 만료됐거나 24h 이내 만료 예정
  });
}
window._aioIsWeeklyNewsExpiring = _aioIsWeeklyNewsExpiring;

function _aioRefreshPageData(pageId) {
  try {
    if (_schedulerPaused) return;
    // During the initial snapshot/server-data window, the central phase
    // coordinator owns quote/sentiment/breadth work. Avoid a duplicate
    // on-enter provider fan-out before the quote phase is ready.
    if (_aioBootPhase.quoteReady === false) return;
    _assignRefreshScheduleFunctions();
    var profile = _aioGetRefreshProfile(pageId);
    var keys = (profile && profile.tasks && profile.tasks.length) ? profile.tasks : AIO_PAGE_REFRESH_MAP[pageId];
    if (!keys || !keys.length || !window.REFRESH_SCHEDULE) return;
    var symbols = Array.isArray(profile.symbols) ? profile.symbols.slice() : [];
    var now = Date.now();
    // v49.99 연계점①: home/briefing 진입 시 주간뉴스 만료 여부 사전 체크
    var weeklyNewsExpiring = (pageId === 'home' || pageId === 'briefing') && _aioIsWeeklyNewsExpiring();
    var dueKeys = [];
    var options = {};
    keys.forEach(function(key) {
      var cfg = REFRESH_SCHEDULE[key];
      if (!cfg || typeof cfg.fn !== 'function' || cfg._inFlight) return;
      // stale 판정: 마지막 성공이 ½ interval 초과 (아직 fresh면 스킵 — 불필요 호출 방지)
      var lastOk = cfg._lastOk || 0;
      var staleThreshold = Math.max((cfg.interval || 600000) * 0.5, 60000);
      // 연계점①: news 태스크이고 주간뉴스 만료 임박 — stale 기준 무시하고 강제 실행
      var forceRefresh = (key === 'news' && weeklyNewsExpiring);
      if (!forceRefresh && lastOk && (now - lastOk) < staleThreshold) return;
      // per-task on-enter 최소 간격 30초 (페이지 빠른 전환 폭주 차단)
      if (_aioPageRefreshLast[key] && (now - _aioPageRefreshLast[key]) < 30000) return;
      _aioPageRefreshLast[key] = now;
      dueKeys.push(key);
      options[key] = { pageId: pageId, forceRefresh: forceRefresh, reason: forceRefresh ? 'weekly-news-expiring' : 'page-onenter-stale', symbols: symbols };
    });
    if (dueKeys.length && window.AIO && typeof window.AIO.runScheduledRefresh === 'function') {
      setTimeout(function(){
        window.AIO.runScheduledRefresh({ keys: dueKeys, options: options, pageId: pageId, symbols: symbols, reason: 'page-onenter' }).catch(function(e) {
          if (typeof _aioLog === 'function') _aioLog('warn', 'refresh', 'page refresh failed: ' + pageId + ' ' + (e && e.message || e));
        });
      }, 0);
    }
  } catch (e) {}
}
window._aioRefreshPageData = _aioRefreshPageData;

// aio:pageShown 구독 — 종합 5 페이지 진입 시 on-enter 갱신
try {
  // aio:pageShown payload: CustomEvent { detail: id(문자열) } — showPage(aio-core L17499)
  function _onPageShown(e) {
    var d = e && e.detail;
    var pageId = (typeof d === 'string') ? d : (d && (d.pageId || d.id));
    if (pageId && (AIO_PAGE_REFRESH_MAP[pageId] || (_aioGetRefreshProfile(pageId).tasks || []).length)) _aioRefreshPageData(pageId);
  }
  if (window._aioPageBus && window._aioPageBus.register) {
    window._aioPageBus.register('data-page-onenter-refresh', 'aio:pageShown', _onPageShown);
  } else {
    document.addEventListener('aio:pageShown', _onPageShown);
  }
} catch (e) {}

// v30.11: 스케줄러 재시작 함수 (Page Visibility 복귀용)
function restartScheduler() {
  Object.entries(REFRESH_SCHEDULE).forEach(([key, cfg]) => {
    if (cfg.fn && cfg.interval > 0 && !cfg.timer) {
      function jit(base) { var j = base * 0.15; return base + Math.floor(Math.random() * j * 2 - j); }
      function scheduleNext() {
        var delay = jit(cfg.interval);
        cfg.nextDue = Date.now() + delay;
        cfg.timer = setTimeout(async () => {
          await _runScheduledTask(key, cfg, false);
          scheduleNext();
        }, delay);
      }
      scheduleNext();
    }
  });
}

// v30.11: Page Visibility API — 백그라운드 탭에서 스케줄러 일시정지
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    _schedulerPaused = true;
    _lastVisibleTime = Date.now(); // v46.9: 숨김 시점 기록 → 복귀 시 정확한 elapsed 계산 (P92)
    Object.values(REFRESH_SCHEDULE).forEach(cfg => {
      if (cfg.timer) { clearTimeout(cfg.timer); cfg.timer = null; }
    });
    if (window._dataStatusInterval) { clearInterval(window._dataStatusInterval); window._dataStatusInterval = null; }
    console.log('[AIO] Tab hidden — scheduler paused');
  } else {
    _schedulerPaused = false;
    const elapsed = Date.now() - _lastVisibleTime;
    // stale 데이터만 즉시 갱신
    var resumeKeys = [];
    Object.entries(REFRESH_SCHEDULE).forEach(([key, cfg]) => {
      if (cfg.fn && elapsed >= cfg.interval) {
        resumeKeys.push(key);
      }
    });
    if (resumeKeys.length && window.AIO && typeof window.AIO.runScheduledRefresh === 'function') {
      try { setTimeout(function(){ window.AIO.runScheduledRefresh({ keys: resumeKeys, reason: 'visibility-resume', symbols: _aioGetComprehensiveSymbols() }).catch(function(){}); }, 0); } catch(e) {}
    }
    restartScheduler();
    if (!window._dataStatusInterval) window._dataStatusInterval = _aioRegisterTimer('dataStatus', updateDataStatus, T.COOLDOWN); // v48.91
    _lastVisibleTime = Date.now();
    console.log('[AIO] Tab visible — scheduler resumed (elapsed ' + Math.round(elapsed/1000) + 's)');
  }
});

window.AIO = window.AIO || {};

window.AIO.getRefreshSchedulerAudit = function() {
  _assignRefreshScheduleFunctions();
  _normalizeRefreshSchedule();
  var now = Date.now();
  var tasks = {};
  var tasksWithoutFn = [];
  var inFlight = [];
  var staleOk = [];
  Object.entries(REFRESH_SCHEDULE || {}).forEach(function(entry) {
    var key = entry[0];
    var cfg = entry[1] || {};
    var hasFn = typeof cfg.fn === 'function';
    if (!hasFn) tasksWithoutFn.push(key);
    if (cfg._inFlight) inFlight.push(key);
    if (cfg._lastOk && now - cfg._lastOk <= Math.max(cfg.interval || 0, 60000) * 2) staleOk.push(key);
    tasks[key] = {
      label: cfg.label || key,
      intervalMs: cfg.interval || 0,
      priority: cfg.priority || 'normal',
      policyKey: cfg.policyKey || null,
      hasFn: hasFn,
      inFlight: !!cfg._inFlight,
      lastOk: cfg._lastOk || 0,
      attemptedAt: cfg._attemptedAt || null,
      lastSuccessfulAt: cfg._lastSuccessfulAt || (cfg._lastOk ? new Date(cfg._lastOk).toISOString() : null),
      status: cfg._status || (cfg._lastOk ? 'loaded' : 'missing'),
      coverage: cfg._coverage != null ? cfg._coverage : null,
      evidenceIds: Array.isArray(cfg._evidenceIds) ? cfg._evidenceIds.slice() : [],
      failureReason: cfg._failureReason || cfg._lastErr || null,
      lastErr: cfg._lastErr || '',
      retryCount: cfg.retryCount || 0,
      nextDue: cfg.nextDue || 0,
      overdueMs: cfg.nextDue && cfg.nextDue < now ? now - cfg.nextDue : 0,
      timeoutMs: cfg.timeoutMs || 0,
      lastDurationMs: cfg.lastDurationMs || 0
    };
  });
  // v49.98 R187: 종합 5페이지 on-enter refresh 매핑 무결성 — 매핑된 태스크가 실존 스케줄 키인지 검증
  var pageRefreshIssues = [];
  var prMap = window.AIO_PAGE_REFRESH_MAP || {};
  Object.keys(prMap).forEach(function(pg) {
    (prMap[pg] || []).forEach(function(k) {
      if (!REFRESH_SCHEDULE[k]) pageRefreshIssues.push(pg + '→' + k + ' (unknown task)');
    });
  });
  var pageRefreshWired = typeof window._aioRefreshPageData === 'function';
  return {
    status: (tasksWithoutFn.length || pageRefreshIssues.length || !pageRefreshWired) ? 'warn' : 'ok',
    paused: !!_schedulerPaused,
    totalTasks: Object.keys(tasks).length,
    tasksWithoutFn: tasksWithoutFn,
    inFlight: inFlight,
    recentlyOk: staleOk,
    tasks: tasks,
    pageRefreshMap: prMap,                    // v49.98: 페이지→태스크 매핑 (R187)
    pageRefreshWired: pageRefreshWired,
    pageRefreshIssues: pageRefreshIssues,     // 매핑이 가리키는 unknown 태스크
    generatedAt: new Date(now).toISOString()
  };
};

window.AIO.getPageRefreshCoverageAudit = function() {
  _assignRefreshScheduleFunctions();
  _normalizeRefreshSchedule();
  var prMap = window.AIO_PAGE_REFRESH_MAP || {};
  var targetPages = window.AIO_CRITICAL_10_PAGE_IDS || ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','fundamental','themes'];
  var now = Date.now();
  var missingPageIds = [];
  var taskIssues = [];
  var profileIssues = [];
  var pageDetails = {};

  targetPages.forEach(function(pageId) {
    var pageEl = document.getElementById('page-' + pageId);
    if (!pageEl) missingPageIds.push(pageId);

    var tasks = Array.isArray(prMap[pageId]) ? prMap[pageId] : [];
    var profile = window.AIO && window.AIO.DATA_REQUIREMENT_PROFILES ? window.AIO.DATA_REQUIREMENT_PROFILES[pageId] : null;
    var expectedTasks = profile && Array.isArray(profile.tasks) ? profile.tasks : [];
    var missingProfileTasks = expectedTasks.filter(function(task) { return tasks.indexOf(task) < 0; });
    var extraTasks = tasks.filter(function(task) { return expectedTasks.length && expectedTasks.indexOf(task) < 0; });
    if (missingProfileTasks.length) profileIssues.push(pageId + ' missing profile tasks: ' + missingProfileTasks.join(','));
    var details = [];
    tasks.forEach(function(task) {
      var cfg = REFRESH_SCHEDULE[task] || {};
      var defined = typeof REFRESH_SCHEDULE[task] !== 'undefined';
      var hasFn = typeof cfg.fn === 'function';
      if (!defined) taskIssues.push(pageId + '→' + task);
      else if (!hasFn) taskIssues.push(pageId + '→' + task + ' (fn missing)');
      details.push({
        task: task,
        defined: defined,
        hasFn: hasFn,
        lastOk: cfg._lastOk || 0,
        intervalMs: cfg.interval || 0,
        staleMs: cfg._lastOk ? Math.max(0, now - cfg._lastOk) : null,
        nextDue: cfg.nextDue || 0
      });
    });

    pageDetails[pageId] = {
      pageExists: !!pageEl,
      tasks: tasks,
      expectedTasks: expectedTasks,
      missingProfileTasks: missingProfileTasks,
      extraTasks: extraTasks,
      taskDetails: details,
      taskIssues: details.filter(function(d){ return !d.defined || !d.hasFn; }).map(function(d){ return d.task; })
    };
  });

  var mapOk = targetPages.every(function(pageId) {
    return Array.isArray(prMap[pageId]) && prMap[pageId].length > 0;
  });
  var pageRefreshWired = typeof window._aioRefreshPageData === 'function';

  return {
    status: (missingPageIds.length || taskIssues.length || profileIssues.length || !mapOk || !pageRefreshWired) ? 'warn' : 'ok',
    pageIds: targetPages,
    pageDetails: pageDetails,
    missingPageIds: missingPageIds,
    mapOk: mapOk,
    pageRefreshWired: pageRefreshWired,
    taskIssues: taskIssues,
    profileIssues: profileIssues,
    generatedAt: new Date(now).toISOString()
  };
};

window.AIO.refreshAllComprehensivePages = async function() {
  var pages = ['home','signal','breadth','sentiment','briefing'];
  var taskSet = {};
  pages.forEach(function(pageId) {
    var profile = _aioGetRefreshProfile(pageId);
    (profile.tasks || AIO_PAGE_REFRESH_MAP[pageId] || []).forEach(function(task) { taskSet[task] = true; });
  });
  var tasks = Object.keys(taskSet);
  var refresh = await window.AIO.runScheduledRefresh({
    keys: tasks,
    forceRefresh: true,
    pageId: 'comprehensive-5',
    reason: 'comprehensive-pages-force-refresh',
    symbols: _aioGetComprehensiveSymbols()
  });
  try { if (typeof applyDataSnapshot === 'function') applyDataSnapshot(); } catch(_) {}
  try { if (window.AIO && typeof window.AIO.renderStaticDataGovernanceBadges === 'function') window.AIO.renderStaticDataGovernanceBadges(); } catch(_) {}
  return { status: refresh.status, refresh: refresh, audit: window.AIO.getComprehensivePageDataFreshnessAudit(), generatedAt: new Date().toISOString() };
};

window.AIO.refreshAllCriticalPages = async function() {
  var pages = window.AIO_CRITICAL_10_PAGE_IDS || ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','fundamental','themes'];
  var taskSet = {};
  pages.forEach(function(pageId) {
    var profile = _aioGetRefreshProfile(pageId);
    (profile.tasks || AIO_PAGE_REFRESH_MAP[pageId] || []).forEach(function(task) { taskSet[task] = true; });
  });
  var tasks = Object.keys(taskSet);
  var refresh = await window.AIO.runScheduledRefresh({
    keys: tasks,
    forceRefresh: true,
    pageId: 'critical-10',
    reason: 'critical-10-pages-force-refresh',
    symbols: _aioGetCritical10Symbols()
  });
  try { if (typeof applyDataSnapshot === 'function') applyDataSnapshot(); } catch(_) {}
  try { if (window.AIO && typeof window.AIO.applyLiveDataToDom === 'function') window.AIO.applyLiveDataToDom({ reason: 'critical-10-refresh', force: true }); } catch(_) {}
  try { if (window.AIO && typeof window.AIO.renderStaticDataGovernanceBadges === 'function') window.AIO.renderStaticDataGovernanceBadges(); } catch(_) {}
  return {
    status: refresh.status,
    refresh: refresh,
    audit: window.AIO.getCritical10PageFreshnessAudit ? window.AIO.getCritical10PageFreshnessAudit({ symbolLimit: 999 }) : null,
    binding: window.AIO.verifyCritical10LiveBindings ? window.AIO.verifyCritical10LiveBindings() : null,
    generatedAt: new Date().toISOString()
  };
};
window.AIO.refreshCritical10Pages = window.AIO.refreshAllCriticalPages;

window.AIO.getComprehensivePageDataFreshnessAudit = function() {
  _assignRefreshScheduleFunctions();
  _normalizeRefreshSchedule();
  var pages = window.AIO_CRITICAL_10_PAGE_IDS || ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','fundamental','themes'];
  var now = Date.now();
  var critical10MarketSurface = null;
  var critical10MarketSituation = null;
  var critical10EvidenceMatrix = null;
  var marketSurfaceByPage = {};
  var marketSituationByPage = {};
  var evidenceByPage = {};
  try {
    critical10MarketSurface = window.AIO.getCritical10MarketSurfaceAudit ? window.AIO.getCritical10MarketSurfaceAudit({ pages: pages }) : null;
    if (critical10MarketSurface && Array.isArray(critical10MarketSurface.pages)) {
      critical10MarketSurface.pages.forEach(function(row) { marketSurfaceByPage[row.pageId] = row; });
    }
  } catch(e) {
    critical10MarketSurface = { status: 'error', issuePageCount: pages.length, error: e && e.message || String(e), pages: [] };
  }
  try {
    critical10MarketSituation = window.AIO.getCritical10MarketSituationAudit ? window.AIO.getCritical10MarketSituationAudit({ pages: pages, sampleLimit: 40 }) : null;
    if (critical10MarketSituation && Array.isArray(critical10MarketSituation.pages)) {
      critical10MarketSituation.pages.forEach(function(row) { marketSituationByPage[row.pageId] = row; });
    }
  } catch(e3) {
    critical10MarketSituation = { status: 'error', issuePageCount: pages.length, error: e3 && e3.message || String(e3), pages: [] };
  }
  try {
    critical10EvidenceMatrix = window.AIO.getCritical10ContentEvidenceMatrix ? window.AIO.getCritical10ContentEvidenceMatrix({ pages: pages, includeItems: false }) : null;
    if (critical10EvidenceMatrix && Array.isArray(critical10EvidenceMatrix.pages)) {
      critical10EvidenceMatrix.pages.forEach(function(row) { evidenceByPage[row.pageId] = row; });
    }
  } catch(e4) {
    critical10EvidenceMatrix = { status: 'error', error: e4 && e4.message || String(e4), pages: [] };
  }
  var details = pages.map(function(pageId) {
    var profile = _aioGetRefreshProfile(pageId);
    var tasks = profile.tasks || AIO_PAGE_REFRESH_MAP[pageId] || [];
    var symbols = profile.symbols || [];
    var pageEl = null;
    try { pageEl = document.getElementById('page-' + pageId); } catch(_) {}
    var missingTasks = tasks.filter(function(task) { return !REFRESH_SCHEDULE[task] || typeof REFRESH_SCHEDULE[task].fn !== 'function'; });
    var staleTasks = tasks.filter(function(task) {
      var cfg = REFRESH_SCHEDULE[task] || {};
      return !cfg._lastOk || (now - cfg._lastOk) > Math.max(cfg.interval || 600000, 60000) * 2;
    });
    var liveMissing = symbols.filter(function(sym) { return !(window._liveData && window._liveData[String(sym).toUpperCase()]); });
    var sinks = pageEl ? pageEl.querySelectorAll('[data-live-price],[data-live-pct],[data-live-field],[data-snap],[data-snap-date]').length : 0;
    var chartLike = pageEl ? pageEl.querySelectorAll('canvas,[id*="chart"],[id*="widget"]').length : 0;
    var bindingAudit = null;
    try { bindingAudit = window.AIO.verifyPageLiveDataBinding ? window.AIO.verifyPageLiveDataBinding({ pageId: pageId }) : null; } catch(e2) { bindingAudit = { status: 'error', error: e2 && e2.message || String(e2), sourceMissingCount: 0, bindingMissingCount: 0, truthBlockedCount: 0 }; }
    var marketRow = marketSurfaceByPage[pageId] || null;
    var situationRow = marketSituationByPage[pageId] || null;
    var evidenceRow = evidenceByPage[pageId] || null;
    var issues = [];
    if (!pageEl) issues.push('missing page DOM');
    if (missingTasks.length) issues.push('missing task fn: ' + missingTasks.join(','));
    if (staleTasks.length) issues.push('stale task: ' + staleTasks.join(','));
    if (!tasks.length) issues.push('no refresh tasks');
    if (!symbols.length) issues.push('no symbol profile');
    if (bindingAudit && bindingAudit.sourceMissingCount) issues.push('visible live source missing: ' + bindingAudit.sourceMissingCount);
    if (bindingAudit && bindingAudit.bindingMissingCount) issues.push('visible live binding missing: ' + bindingAudit.bindingMissingCount);
    if (bindingAudit && bindingAudit.truthBlockedCount) issues.push('truth-blocked visible live sink: ' + bindingAudit.truthBlockedCount);
    if (marketRow && marketRow.marketIssueCount) issues.push('market surface issue: ' + marketRow.marketIssueCount);
    if (marketRow && marketRow.staleSnapDates && marketRow.staleSnapDates.length) issues.push('stale snap-date: ' + marketRow.staleSnapDates.length);
    if (situationRow && situationRow.status !== 'ok') issues.push('market situation mismatch/coverage: ' + situationRow.issues.join('|'));
    if (evidenceRow && evidenceRow.status !== 'pass') issues.push('content evidence review: ' + JSON.stringify(evidenceRow.counts));
    return {
      pageId: pageId,
      status: issues.length ? 'warn' : 'ok',
      issues: issues,
      tasks: tasks,
      missingTasks: missingTasks,
      staleTasks: staleTasks,
      symbols: symbols,
      symbolCount: symbols.length,
      liveMissingSample: liveMissing.slice(0, 12),
      liveMissingCount: liveMissing.length,
      dataSinkCount: sinks,
      chartLikeCount: chartLike,
      bindingAudit: bindingAudit ? {
        status: bindingAudit.status,
        total: bindingAudit.total || 0,
        sourceMissingCount: bindingAudit.sourceMissingCount || 0,
        bindingMissingCount: bindingAudit.bindingMissingCount || 0,
        truthBlockedCount: bindingAudit.truthBlockedCount || 0
      } : null,
      marketSurface: marketRow ? {
        status: marketRow.status,
        issueCount: marketRow.issueCount || 0,
        marketIssueCount: marketRow.marketIssueCount || 0,
        visibleUnavailableCount: marketRow.visibleUnavailableCount || 0,
        visibleReferenceOnlyCount: marketRow.visibleReferenceOnlyCount || 0,
        visibleTruthBlockedCount: marketRow.visibleTruthBlockedCount || 0,
        staleSnapDateCount: marketRow.staleSnapDates ? marketRow.staleSnapDates.length : 0,
        marketIssueSample: marketRow.marketIssueSample || []
      } : null,
      marketSituation: situationRow ? {
        status: situationRow.status,
        issues: situationRow.issues || [],
        referenceMissingCount: situationRow.referenceMissingCount || 0,
        valueMismatchCount: situationRow.valueMismatchCount || 0,
        sourceIssueCount: situationRow.sourceIssueCount || 0,
        staleDateCount: situationRow.staleDateCount || 0,
        narrativeConflictCount: situationRow.narrativeConflictCount || 0
      } : null,
      evidenceMatrix: evidenceRow ? {
        status: evidenceRow.status,
        counts: evidenceRow.counts || {}
      } : null
    };
  });
  var issues = details.filter(function(d) { return d.issues.length; });
  return {
    status: issues.length ? 'warn' : 'ok',
    pagesChecked: details.length,
    issueCount: issues.length,
    totalSymbols: _aioGetCritical10Symbols().length,
    unionTasks: Array.from(new Set(details.reduce(function(acc, d) { return acc.concat(d.tasks); }, []))),
    pages: details,
    surfaceIntegrity: window.AIO.getComprehensiveSurfaceIntegrityAudit ? window.AIO.getComprehensiveSurfaceIntegrityAudit({ symbolLimit: 999 }) : null,
    critical10MarketSurface: critical10MarketSurface,
    critical10MarketSituation: critical10MarketSituation,
    critical10EvidenceMatrix: critical10EvidenceMatrix,
    generatedAt: new Date(now).toISOString()
  };
};

window.AIO.runScheduledRefresh = async function(keys) {
  _assignRefreshScheduleFunctions();
  _normalizeRefreshSchedule();
  var forceAll = false;
  var optsByKey = {};
  var runSymbols = [];
  var runPageId = '';
  var runReason = '';
  var list = Array.isArray(keys) && keys.length ? keys : Object.keys(REFRESH_SCHEDULE || {});
  if (keys && !Array.isArray(keys) && typeof keys === 'object') {
    list = Array.isArray(keys.keys) && keys.keys.length ? keys.keys : Object.keys(REFRESH_SCHEDULE || {});
    forceAll = !!keys.forceRefresh;
    optsByKey = keys.options || {};
    runSymbols = Array.isArray(keys.symbols) ? keys.symbols.slice() : [];
    runPageId = keys.pageId || '';
    runReason = keys.reason || '';
  }
  if (!runSymbols.length && runPageId) {
    var runProfile = _aioGetRefreshProfile(runPageId);
    runSymbols = Array.isArray(runProfile.symbols) ? runProfile.symbols.slice() : [];
  }
  var out = [];
  var wasPaused = _schedulerPaused;
  var prevQuoteRequestSymbols = window._aioQuoteRequestSymbols;
  var runId = 'refresh-' + Date.now() + '-' + Math.round(Math.random() * 100000);
  var startedAt = Date.now();
  if (runSymbols.length) window._aioQuoteRequestSymbols = runSymbols.slice();
  _aioEmitRefreshEvent('start', {
    runId: runId,
    keys: list.slice(),
    pageId: runPageId,
    reason: runReason,
    symbols: runSymbols.slice(),
    total: list.length,
    done: 0,
    currentKey: '',
    currentLabel: '',
    forceRefresh: forceAll,
    results: []
  });
  _schedulerPaused = false;
  try {
    for (var i = 0; i < list.length; i++) {
      var key = list[i];
      var cfg = REFRESH_SCHEDULE && REFRESH_SCHEDULE[key];
      var started = Date.now();
      _aioEmitRefreshEvent('progress', {
        runId: runId,
        phase: 'running',
        key: key,
        label: _aioRefreshTaskLabel(key, cfg),
        currentKey: key,
        currentLabel: _aioRefreshTaskLabel(key, cfg),
        index: i + 1,
        done: i,
        total: list.length,
        keys: list.slice(),
        pageId: runPageId,
        reason: runReason,
        symbols: runSymbols.slice(),
        forceRefresh: forceAll,
        results: out.slice()
      });
      if (!cfg) {
        out.push({ key: key, ok: false, skipped: true, error: 'unknown scheduler key', durationMs: Date.now() - started, lastOk: 0 });
        _aioEmitRefreshEvent('progress', { runId: runId, phase: 'skipped', key: key, label: key, index: i + 1, done: i + 1, total: list.length, keys: list.slice(), pageId: runPageId, reason: runReason, symbols: runSymbols.slice(), forceRefresh: forceAll, result: out[out.length - 1], results: out.slice() });
        continue;
      }
      if (typeof cfg.fn !== 'function') {
        out.push({ key: key, ok: false, skipped: true, error: 'scheduler function not assigned', durationMs: Date.now() - started, lastOk: cfg._lastOk || 0 });
        _aioEmitRefreshEvent('progress', { runId: runId, phase: 'skipped', key: key, label: _aioRefreshTaskLabel(key, cfg), index: i + 1, done: i + 1, total: list.length, keys: list.slice(), pageId: runPageId, reason: runReason, symbols: runSymbols.slice(), forceRefresh: forceAll, result: out[out.length - 1], results: out.slice() });
        continue;
      }
      var keyOpts = optsByKey[key] || {};
      var opts = Object.assign({}, keyOpts, {
        pageId: runPageId || keyOpts.pageId || '',
        reason: runReason || keyOpts.reason || '',
        symbols: runSymbols.length ? runSymbols.slice() : (Array.isArray(keyOpts.symbols) ? keyOpts.symbols.slice() : []),
        forceRefresh: !!(forceAll || keyOpts.forceRefresh)
      });
      var taskRun = await _runScheduledTask(key, cfg, true, opts);
      out.push({ key: key, ok: !!(taskRun && taskRun.ok), skipped: !!(taskRun && taskRun.skipped), updated: !!(taskRun && taskRun.updated), error: (taskRun && taskRun.error) || cfg._lastErr || '', durationMs: Date.now() - started, lastOk: cfg._lastOk || 0 });
      _aioEmitRefreshEvent('progress', {
        runId: runId,
        phase: (taskRun && taskRun.ok) ? (taskRun.skipped ? 'skipped' : 'ok') : 'error',
        key: key,
        label: _aioRefreshTaskLabel(key, cfg),
        index: i + 1,
        done: i + 1,
        total: list.length,
        keys: list.slice(),
        pageId: runPageId,
        reason: runReason,
        symbols: runSymbols.slice(),
        forceRefresh: forceAll,
        result: out[out.length - 1],
        results: out.slice()
      });
    }
  } finally {
    _schedulerPaused = wasPaused;
    if (prevQuoteRequestSymbols == null) delete window._aioQuoteRequestSymbols;
    else window._aioQuoteRequestSymbols = prevQuoteRequestSymbols;
  }
  var result = {
    status: out.some(function(x) { return !x.ok && !x.skipped; }) ? 'warn' : 'ok',
    results: out,
    scheduler: window.AIO.getRefreshSchedulerAudit(),
    generatedAt: new Date().toISOString()
  };
  _aioEmitRefreshEvent('done', {
    runId: runId,
    status: result.status,
    total: list.length,
    done: out.length,
    keys: list.slice(),
    pageId: runPageId,
    reason: runReason,
    symbols: runSymbols.slice(),
    forceRefresh: forceAll,
    durationMs: Date.now() - startedAt,
    results: out.slice()
  });
  return result;
};

window.AIO.forceRefreshAllData = async function(keys) {
  var result = await window.AIO.runScheduledRefresh({
    keys: Array.isArray(keys) && keys.length ? keys : null,
    forceRefresh: true,
    pageId: Array.isArray(keys) && keys.length ? 'custom' : 'critical-10',
    reason: 'manual-force-refresh',
    symbols: Array.isArray(keys) && keys.length ? _aioGetComprehensiveSymbols() : _aioGetCritical10Symbols()
  });
  try { if (typeof applyDataSnapshot === 'function') applyDataSnapshot(); } catch(_) {}
  try { if (window.AIO && typeof window.AIO.applyLiveDataToDom === 'function') window.AIO.applyLiveDataToDom({ reason: 'manual-force-refresh', force: true }); } catch(_) {}
  try { if (window.AIO && typeof window.AIO.renderStaticDataGovernanceBadges === 'function') window.AIO.renderStaticDataGovernanceBadges(); } catch(_) {}
  return {
    status: result.status,
    refresh: result,
    readiness: window.AIO.getAutoOpsReadiness ? window.AIO.getAutoOpsReadiness() : null,
    binding: window.AIO.verifyCritical10LiveBindings ? window.AIO.verifyCritical10LiveBindings() : null,
    generatedAt: new Date().toISOString()
  };
};

window.AIO.ensureFreshDataForUse = async function(scope) {
  scope = scope || {};
  var plan = window.AIO.getAutoFreshnessPlan ? window.AIO.getAutoFreshnessPlan(scope) : null;
  if (!plan || !plan.tasks || !plan.tasks.length || scope.dryRun) {
    return { status: plan && plan.status || 'fresh_enough', plan: plan, refresh: null, skipped: !!(scope && scope.dryRun), generatedAt: new Date().toISOString() };
  }
  var key = plan.tasks.slice().sort().join('|') + '::' + (plan.profile && plan.profile.symbols || []).slice(0, 12).join(',');
  var now = Date.now();
  window._aioEnsureFreshLast = window._aioEnsureFreshLast || {};
  window._aioEnsureFreshInFlight = window._aioEnsureFreshInFlight || {};
  if (window._aioEnsureFreshInFlight[key]) {
    return { status: 'in_flight', plan: plan, refresh: null, generatedAt: new Date(now).toISOString() };
  }
  var minGap = scope.reason === 'chat' ? 45000 : 15000;
  if (!scope.forceFresh && window._aioEnsureFreshLast[key] && now - window._aioEnsureFreshLast[key] < minGap) {
    return { status: 'recently_refreshed', plan: plan, refresh: null, generatedAt: new Date(now).toISOString() };
  }
  window._aioEnsureFreshInFlight[key] = true;
  window._aioEnsureFreshLast[key] = now;
  var prevQuoteRequestSymbols = window._aioQuoteRequestSymbols;
  if (plan.profile && Array.isArray(plan.profile.symbols) && plan.profile.symbols.length) {
    window._aioQuoteRequestSymbols = plan.profile.symbols.slice();
  }
  try {
    var refresh = await window.AIO.runScheduledRefresh({
      keys: plan.tasks,
      pageId: scope.pageId || scope.ctxId || scope.context || '',
      reason: scope.reason || 'ensure-fresh',
      symbols: plan.profile && Array.isArray(plan.profile.symbols) ? plan.profile.symbols : [],
      forceRefresh: !!scope.forceFresh
    });
    try { if (typeof applyDataSnapshot === 'function') applyDataSnapshot(); } catch(_) {}
    var binding = null;
    try {
      if (window.AIO && typeof window.AIO.repairPageLiveDataBinding === 'function') {
        binding = await window.AIO.repairPageLiveDataBinding({ pageId: scope.pageId || scope.ctxId || scope.context || '', retry: !!scope.forceFresh, reason: scope.reason || 'ensure-fresh' });
      } else if (window.AIO && typeof window.AIO.applyLiveDataToDom === 'function') {
        window.AIO.applyLiveDataToDom({ pageId: scope.pageId || scope.ctxId || scope.context || '', reason: scope.reason || 'ensure-fresh', force: true });
      }
    } catch(_bindErr) {
      binding = { status: 'warn', error: _bindErr && _bindErr.message || String(_bindErr) };
    }
    try { if (window.AIO && typeof window.AIO.renderStaticDataGovernanceBadges === 'function') window.AIO.renderStaticDataGovernanceBadges(); } catch(_) {}
    return { status: refresh && refresh.status || 'ok', plan: plan, refresh: refresh, binding: binding, generatedAt: new Date().toISOString() };
  } catch(e) {
    return { status: 'warn', plan: plan, refresh: null, error: e && e.message || String(e), generatedAt: new Date().toISOString() };
  } finally {
    if (prevQuoteRequestSymbols == null) delete window._aioQuoteRequestSymbols;
    else window._aioQuoteRequestSymbols = prevQuoteRequestSymbols;
    delete window._aioEnsureFreshInFlight[key];
  }
};

function _aioNormalizeChatTickers(tickers) {
  var out = [];
  (Array.isArray(tickers) ? tickers : []).forEach(function(t) {
    t = String(t || '').trim().toUpperCase();
    if (t && out.indexOf(t) < 0) out.push(t);
  });
  return out.slice(0, 5);
}

function _aioTickerQuoteAgeMs(ticker) {
  ticker = String(ticker || '').toUpperCase();
  var ts = window._quoteTimestamps && window._quoteTimestamps[ticker];
  if (!ts) return Infinity;
  return Date.now() - ts;
}

function _aioClearChatTickerCache(tickers) {
  try {
    if (!window._chatTickerCache) return;
    _aioNormalizeChatTickers(tickers).forEach(function(t) { delete window._chatTickerCache[t]; });
  } catch(_) {}
}

window.AIO.getChatAnswerFreshnessAudit = function(scope) {
  scope = scope || {};
  var tickers = _aioNormalizeChatTickers(scope.tickers);
  var profile = window.AIO.getDataRequirementProfile ? window.AIO.getDataRequirementProfile(Object.assign({}, scope, { reason: 'chat', tickers: tickers, forceFresh: true, symbolLimit: scope.symbolLimit || 999 })) : null;
  var plan = window.AIO.getAutoFreshnessPlan ? window.AIO.getAutoFreshnessPlan(Object.assign({}, scope, { reason: 'chat', tickers: tickers, forceFresh: true, symbolLimit: scope.symbolLimit || 999 })) : null;
  var quoteRows = tickers.map(function(t) {
    var live = window._liveData && window._liveData[t];
    var ageMs = _aioTickerQuoteAgeMs(t);
    var truth = null;
    try { truth = window.AIO && typeof window.AIO.evaluateDataTruth === 'function' ? window.AIO.evaluateDataTruth(t, live || {}, (window._dataSource && window._dataSource[t]) || {}) : null; } catch(_) {}
    var cross = truth && truth.crossSource ? truth.crossSource : null;
    try {
      if (!cross && window.AIO && typeof window.AIO.getCrossSourceQuoteValidation === 'function') cross = window.AIO.getCrossSourceQuoteValidation(t);
    } catch(_crossAudit) {}
    var quoteOk = !!(live && live.price && ageMs <= 2 * 60 * 1000 && (!truth || truth.decisionUse === true));
    var row = {
      ticker: t,
      hasLivePrice: !!(live && live.price),
      price: live && live.price != null ? live.price : null,
      quoteAgeMs: isFinite(ageMs) ? ageMs : null,
      quoteAgeSec: isFinite(ageMs) ? Math.round(ageMs / 1000) : null,
      source: live && live.source || '',
      truthStatus: truth && truth.status || 'unknown',
      truthIssues: truth ? (truth.issues || []).concat(truth.warnings || []) : [],
      crossSourceStatus: cross && cross.status || 'unknown',
      crossSourceCount: cross && typeof cross.independentCount === 'number' ? cross.independentCount : 0,
      crossSourceMismatches: cross ? [].concat(cross.blockingMismatches || [], cross.warningMismatches || []) : [],
      decisionUse: !truth || truth.decisionUse === true,
      status: quoteOk ? 'ok' : (truth && truth.status === 'blocked' ? 'blocked' : 'refresh_required')
    };
    return window.AIO && typeof window.AIO.normalizeAIChatEvidenceRow === 'function'
      ? window.AIO.normalizeAIChatEvidenceRow(row)
      : row;
  });
  var staleQuotes = quoteRows.filter(function(r) { return r.status !== 'ok'; });
  var fundCache = {};
  try {
    tickers.forEach(function(t) {
      var c = window._fundCache && window._fundCache[t];
      fundCache[t] = c && c._ts ? { ageMin: Math.round((Date.now() - c._ts) / 60000), fresh: Date.now() - c._ts < 30 * 60 * 1000 } : { fresh: false, ageMin: null };
    });
  } catch(_) {}
  return {
    status: staleQuotes.some(function(r) { return r.status === 'blocked'; }) ? 'blocked' : (staleQuotes.length ? 'refresh_required' : 'ok'),
    strict: tickers.length > 0,
    tickers: tickers,
    quoteRows: quoteRows,
    staleQuoteCount: staleQuotes.length,
    truthBlockedCount: quoteRows.filter(function(r) { return r.status === 'blocked'; }).length,
    profile: profile,
    plan: plan,
    fundCache: fundCache,
    generatedAt: new Date().toISOString()
  };
};

window.AIO.ensureFreshChatAnswerData = async function(scope) {
  scope = scope || {};
  var tickers = _aioNormalizeChatTickers(scope.tickers);
  var strict = tickers.length > 0;
  var chatScope = Object.assign({}, scope, {
    reason: 'chat',
    tickers: tickers,
    forceFresh: strict || !!scope.forceFresh,
    symbolLimit: scope.symbolLimit || 999
  });
  var before = window.AIO.getChatAnswerFreshnessAudit ? window.AIO.getChatAnswerFreshnessAudit(chatScope) : null;
  if (scope.dryRun) {
    return { status: before && before.status || 'dry_run', strict: strict, before: before, refresh: null, quoteLookups: [], after: before, generatedAt: new Date().toISOString() };
  }
  if (strict) _aioClearChatTickerCache(tickers);
  var refresh = null;
  try {
    refresh = await window.AIO.ensureFreshDataForUse(chatScope);
  } catch(e) {
    refresh = { status: 'warn', error: e && e.message || String(e) };
  }
  var lookups = [];
  var crossCheck = null;
  if (strict && typeof dynamicTickerLookup === 'function') {
    for (var i = 0; i < tickers.length; i++) {
      var t = tickers[i];
      var live = window._liveData && window._liveData[t];
      var ageMs = _aioTickerQuoteAgeMs(t);
      if (!live || !live.price || !isFinite(ageMs) || ageMs > 90 * 1000 || scope.forceFresh) {
        try {
          var r = await (typeof _withTimeout === 'function'
            ? _withTimeout(dynamicTickerLookup(t, { forceFresh: true, reason: 'chat-answer-preflight' }), 3500, null)
            : dynamicTickerLookup(t, { forceFresh: true, reason: 'chat-answer-preflight' }));
          lookups.push({ ticker: t, ok: !!(r && r.price), source: r && (r.source || r.exchange || '') || '' });
        } catch(e2) {
          lookups.push({ ticker: t, ok: false, error: e2 && e2.message || String(e2) });
        }
      }
    }
  }
  if (strict && window.AIO && typeof window.AIO.validateQuoteCrossSources === 'function') {
    try {
      var crossPromise = window.AIO.validateQuoteCrossSources(tickers, { reason: 'chat-answer-cross-source', force: true, limit: Math.max(1, tickers.length) });
      crossCheck = typeof _withTimeout === 'function' ? await _withTimeout(crossPromise, 6500, null) : await crossPromise;
    } catch(e3) {
      crossCheck = { status: 'warn', error: e3 && e3.message || String(e3) };
    }
  }
  var after = window.AIO.getChatAnswerFreshnessAudit ? window.AIO.getChatAnswerFreshnessAudit(chatScope) : null;
  return {
    status: after && after.truthBlockedCount ? 'blocked' : (after && after.staleQuoteCount ? 'warn' : (refresh && refresh.status || 'ok')),
    strict: strict,
    before: before,
    refresh: refresh,
    quoteLookups: lookups,
    crossCheck: crossCheck,
    after: after,
    generatedAt: new Date().toISOString()
  };
};

function updateDataStatusError(status, msg) {
  var panel = document.getElementById('data-status-panel');
  if (!panel) return;
  var colors = {ok:'#00e5a0', warn:'#ffa31a', error:'#ef4444'};
  panel.style.color = colors[status] || '#a5b0c2';
  panel.innerHTML = (status === 'ok' ? '<span class="sd sd-g"></span>' : status === 'warn' ? '<span class="sd sd-y"></span>' : '<span class="sd sd-r"></span>') + ' ' + escHtml(msg);
}

function updateDataStatus() {
  try {
    if (window.AIO && typeof window.AIO.getRefreshState === 'function') {
      var refreshState = window.AIO.getRefreshState();
      if (refreshState && refreshState.active) return;
    }
  } catch(_) {}
  const el = document.getElementById('data-status-panel');
  if (!el) return;
  const now = Date.now();
  // v38.3: stale 감지 — 마지막 시세 갱신이 10분 이상 경과하면 경고
  const lastQuoteTs = window._quoteTimestamps ? Math.max(0, ...Object.values(window._quoteTimestamps)) : 0;
  const staleMin = lastQuoteTs > 0 ? Math.floor((now - lastQuoteTs) / 60000) : -1;

  // 프록시 stale 캐시 사용 중 표시
  const proxyStale = window._aioProxyStaleSince
    ? ' · <span style="color:#f59e0b;">⚠ stale ' + (window._aioProxyStaleAgeMin || '?') + '분</span>'
    : '';

  // SW 버전 툴팁용 — 비동기 쿼리이므로 마지막으로 수신한 값 캐시
  const swVer = window._aioSWVersion || '';
  const titleExtra = swVer ? ` · SW ${swVer}` : '';

  const appVer = (typeof APP_VERSION === 'string' ? APP_VERSION : (window.AIO && window.AIO.version) || '');
  const swMismatch = !!(swVer && appVer && swVer !== appVer);
  const swBadge = swMismatch
    ? ' · <span style="color:#f87171;">SW ' + escHtml(swVer) + '≠' + escHtml(appVer) + '</span>'
    : (swVer ? ' · <span style="color:var(--text-muted);">SW ' + escHtml(swVer) + '</span>' : '');
  if (swMismatch && window._aioSWMismatchLogged !== swVer + ':' + appVer) {
    window._aioSWMismatchLogged = swVer + ':' + appVer;
    if (typeof _aioLog === 'function') _aioLog('warn', 'sw', 'Service worker version mismatch: ' + swVer + ' vs app ' + appVer);
    if (typeof showDataError === 'function') showDataError('SW', 'service worker version mismatch - refresh will rotate cache', 'warn');
  }

  if (staleMin > 10) {
    el.innerHTML = `<span style="font-size:11px;color:#fbbf24;font-weight:700;">시세 ${staleMin}분 전 갱신</span>${proxyStale}`;
    el.title = `마지막 시세 갱신: ${new Date(lastQuoteTs).toLocaleTimeString('ko-KR')} — ${staleMin}분 경과${titleExtra}`;
  } else if (staleMin >= 0) {
    const t = new Date(lastQuoteTs).toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
    el.innerHTML = `<span style="font-size:11px;color:var(--text-muted);">시세 ${t} 갱신</span>${proxyStale}`;
    el.title = `정상 갱신 중${titleExtra}`;
  } else {
    el.innerHTML = `<span style="font-size:11px;color:var(--text-muted);">데이터 갱신 중...</span>${proxyStale}`;
    el.title = `연결 중${titleExtra}`;
  }
  if (swBadge) el.innerHTML += swBadge;
}

// 현재 controller의 SW 버전을 비동기로 조회하고 controller 전환마다 재확인한다.
function _querySWVersion() {
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
    setTimeout(_querySWVersion, 3000);
    return;
  }
  try {
    var mc = new MessageChannel();
    mc.port1.onmessage = function(e) {
      if (e.data && e.data.version) {
        window._aioSWVersion = e.data.version;
        window._aioSWCheckedAt = Date.now();
        var appVer = (typeof APP_VERSION === 'string' ? APP_VERSION : (window.AIO && window.AIO.version) || '');
        if (appVer && e.data.version === appVer) {
          try { sessionStorage.removeItem('aio_sw_controller_reload_v1'); } catch (_) {}
        } else if (appVer && e.data.version !== appVer) {
          try {
            navigator.serviceWorker.getRegistration().then(function(reg) {
              if (reg && typeof reg.update === 'function') reg.update().catch(function() {});
            }).catch(function() {});
          } catch (_) {}
        }
        updateDataStatus();
      }
    };
    navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [mc.port2]);
  } catch(e) {}
}
function _aioRequestSWControllerReload() {
  try {
    if (sessionStorage.getItem('aio_sw_controller_reload_v1') === '1') return;
    sessionStorage.setItem('aio_sw_controller_reload_v1', '1');
    setTimeout(function() {
      try { if (window.location && typeof window.location.reload === 'function') window.location.reload(); } catch (_) {}
    }, 80);
  } catch (_) {}
}
if (navigator.serviceWorker && navigator.serviceWorker.addEventListener) {
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    window._aioSWVersion = '';
    window._aioSWMismatchLogged = '';
    _aioRequestSWControllerReload();
    _querySWVersion();
  });
}
_querySWVersion();
let _aioMarketSnapshotMeta = null;
try {
  window.addEventListener('aio:marketSnapshot', function(e) {
    _aioMarketSnapshotMeta = e && e.detail ? e.detail : null;
  });
} catch (_) {}

// Apply technical indicators to UI
function applyTechIndicators(data) {
  // v48.96 P1-4: 진입 즉시 stale 마킹, 성공 완료 시 해제
  var _techContainer = document.getElementById('tech-indicators-live');
  if (_techContainer) _techContainer.dataset.stale = '1';
  if (!data) return;
  try {
    // RSI — v48.94 P161: NaN 가드 (_aioRenderNum)
    if (data.rsi?.values?.[0]) {
      const rsi = parseFloat(data.rsi.values[0].rsi);
      const el = document.getElementById('tech-rsi-val');
      if (el) {
        el.textContent = window._aioRenderNum ? window._aioRenderNum(rsi, '', 1) : (Number.isFinite(rsi) ? rsi.toFixed(1) : '—');
        el.style.color = rsi > 70 ? 'var(--data-red)' : rsi < 30 ? 'var(--data-green)' : 'var(--text-primary)';
      }
    }
    // MACD — v48.94 P161: NaN 가드
    if (data.macd?.values?.[0]) {
      const macd = parseFloat(data.macd.values[0].macd);
      const el = document.getElementById('tech-macd-val');
      if (el) {
        el.textContent = window._aioRenderNum ? window._aioRenderNum(macd, '', 2) : (Number.isFinite(macd) ? macd.toFixed(2) : '—');
        el.style.color = macd > 0 ? 'var(--data-green)' : 'var(--data-red)';
      }
    }
    // Stochastic — v48.94 P161: NaN 가드
    if (data.stoch?.values?.[0]) {
      const k = parseFloat(data.stoch.values[0].slow_k);
      const el = document.getElementById('tech-stoch-val');
      if (el) {
        el.textContent = window._aioRenderNum ? window._aioRenderNum(k, '', 1) : (Number.isFinite(k) ? k.toFixed(1) : '—');
        el.style.color = k > 80 ? 'var(--data-red)' : k < 20 ? 'var(--data-green)' : 'var(--text-primary)';
      }
    }
    // ADX — v48.94 P161: NaN 가드
    if (data.adx?.values?.[0]) {
      const adx = parseFloat(data.adx.values[0].adx);
      const el = document.getElementById('tech-adx-val');
      if (el) {
        el.textContent = window._aioRenderNum ? window._aioRenderNum(adx, '', 1) : (Number.isFinite(adx) ? adx.toFixed(1) : '—');
        el.style.color = adx > 25 ? 'var(--data-green)' : 'var(--data-amber)';
      }
    }
    // v48.96 P1-4: 성공 완료 — stale 마커 해제
    if (_techContainer) delete _techContainer.dataset.stale;
    console.log('[AIO v20] Technical indicators applied');
  } catch(e) { _aioLog('warn', 'render', 'Tech indicator apply error: ' + (e && e.message || e)); }
}

// ═══ 10. 초기화 (마스터 부팅 시퀀스) ═══════════════════════════
function cleanupProxyCache() {
  // 6시간 초과 aio_proxy_cache_* 항목 삭제 (boot 시 1회)
  try {
    var cutoff = Date.now() - 6 * 3600000;
    var toDelete = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.startsWith('aio_proxy_cache_')) {
        try {
          var val = JSON.parse(localStorage.getItem(k));
          if (!val || !val.ts || val.ts < cutoff) toDelete.push(k);
        } catch(e) { toDelete.push(k); }
      }
    }
    toDelete.forEach(function(k) { try { localStorage.removeItem(k); } catch(e) {} });
    if (toDelete.length) console.log('[AIO] proxy cache cleanup: ' + toDelete.length + '개 만료 항목 삭제');
  } catch(e) {}
}

/* ── Phase D: IndexedDB 뉴스 캐시 (v48.63) ─────────────────────────────── */
// 뉴스 원본을 IDB에 저장 → 새로고침 후 fetchAllNews 완료 전 즉시 렌더
const _AIO_IDB_NAME = 'AIOScreenerDB';
const _AIO_IDB_VER  = 1;

function _idbOpen() {
  return new Promise(function(resolve, reject) {
    if (!window.indexedDB) { reject(new Error('IDB 미지원')); return; }
    var req = indexedDB.open(_AIO_IDB_NAME, _AIO_IDB_VER);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('news')) {
        var os = db.createObjectStore('news', { keyPath: '_idbKey' });
        os.createIndex('ts', 'ts', { unique: false });
      }
    };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror   = function()  { reject(req.error); };
  });
}

async function _idbSaveNews(items) {
  try {
    if (!items || !items.length) return;
    var db = await _idbOpen();
    var tx = db.transaction('news', 'readwrite');
    var os = tx.objectStore('news');
    var ts = Date.now();
    items.forEach(function(item) {
      var key = String(item.link || item.title || '').slice(0, 200);
      if (!key) return;
      var rec = Object.assign({}, item, { _idbKey: key, ts: ts });
      os.put(typeof window._aioRedactPII === 'function' ? window._aioRedactPII(rec) : rec);
    });
    // 7일 초과 항목 비동기 정리
    var cutoff = ts - 7 * 24 * 3600000;
    var delReq = os.index('ts').openCursor(IDBKeyRange.upperBound(cutoff));
    delReq.onsuccess = function(e) {
      var cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
  } catch(e) {} // 프라이빗 모드 등 IDB 비가용 환경 무시
}

async function _idbLoadNews(maxAgeMs) {
  maxAgeMs = maxAgeMs || 4 * 3600000; // 기본 4시간
  try {
    var db = await _idbOpen();
    return new Promise(function(resolve) {
      var tx  = db.transaction('news', 'readonly');
      var req = tx.objectStore('news').getAll();
      req.onsuccess = function() {
        var cutoff = Date.now() - maxAgeMs;
        var items  = (req.result || []).filter(function(i) { return i.ts > cutoff; });
        items.sort(function(a, b) { return (b.pubDate ? new Date(b.pubDate) : 0) - (a.pubDate ? new Date(a.pubDate) : 0); });
        resolve(items.length > 0 ? items : null);
      };
      req.onerror = function() { resolve(null); };
    });
  } catch(e) { return null; }
}

// ─────────────────────────────────────────────────────────────────────────
// v50.24/WO-2 (P498): SPX ATH 기준값 단일 출처. 하드코딩 7412.84(stale)가 두 곳에 중복돼
// 한쪽(L13125)만 v50.16에서 시정되고, 먼저 실행되어 window._spxATH를 오염시키는 쪽은 미시정 →
// SPX -2.9% 급락일에 레짐이 "Near ATH"로 오표시됐다. 두 호출점이 같은 floor를 쓰도록 통일한다.
// floor = max(런타임 추적값, live, history.json 관측값). 상수 floor는 사용하지 않는다.
function _aioSpxAthFloor() {
  var values = [];
  [window._spxATH, window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.spxATH,
    window._liveData && window._liveData['^GSPC'] && window._liveData['^GSPC'].price].forEach(function(v) {
    v = Number(v); if (isFinite(v) && v > 0) values.push(v);
  });
  var history = typeof _aioHistorySeries === 'function' ? _aioHistorySeries('spx', 1) : null;
  if (history) history.forEach(function(p) { var v = Number(p.value); if (isFinite(v) && v > 0) values.push(v); });
  return values.length ? Math.max.apply(null, values) : null;
}
window._aioSpxAthFloor = _aioSpxAthFloor;

// ─────────────────────────────────────────────────────────────────────────
// v50.23: 서버측 데이터 로더 — GitHub Actions(.github/workflows/refresh-data.yml)가
// scripts/fetch-data.mjs로 생성한 public-data/data.json을 "같은 출처"로 읽어 즉시 적용.
// CORS 프록시·키노출 없이 항상 신선 → 이게 PRIMARY 소스. 기존 클라이언트 fetchLiveQuotes는
// live 갱신 레이어로 강등(프록시 실패해도 서버 데이터가 이미 화면에 떠 있음).
// data.json 없거나 로드 실패 시 조용히 false → 기존 클라이언트 경로가 폴백.
// ─────────────────────────────────────────────────────────────────────────
// P768/ARX-16: native screener가 읽고 정규화·랭킹한 상태를 compatibility metadata로만
// 연결한다. 런타임에서 screener.json을 다시 fetch하거나 SCREENER_DB에 factor row를
// bulk-project하지 않는다. 정적 identity/memo 및 Telegram overlay는 별도 compatibility
// 경계로 남아 있으며, native rows가 비어 있는 필드만 bootstrap read boundary가 보완한다.
function _aioApplyNativeScreenerState(nativeState) {
  var arch = window.AIO_ARCH || null;
  var state = nativeState || (arch && typeof arch.getScreenerState === 'function' ? arch.getScreenerState() : null);
  if (!state || typeof state !== 'object') return false;
  var metadata = state.metadata && typeof state.metadata === 'object' ? state.metadata : {};
  var hasArtifact = state.status === 'current' || state.status === 'partial' || state.status === 'ready';
  var status = hasArtifact ? (metadata.backtest ? 'ready' : 'partial') : (state.status || 'unavailable');
  var loadState = {
    status: status,
    checkedAt: Date.now(),
    asOf: metadata.asOf || state.revision || null,
    factorObservedAt: metadata.factorObservedAt || null,
    count: Number(metadata.artifactRows) || (Array.isArray(state.rows) ? state.rows.length : 0),
    universe: Number(metadata.universe) || null,
    fmpOk: !!metadata.fmpOk,
    secFundamentalsOk: !!metadata.secFundamentalsOk,
    fundamentalCoveragePct: Number(metadata.fundamentalCoveragePct) || 0,
    breadthStatus: 'blocked',
    source: metadata.source || 'native-screener-state',
    nativeRevision: state.revision || null
  };
  window._aioScreenerLoadState = loadState;
  window._aioServerScreener = {
    asOf: loadState.asOf,
    factorObservedAt: loadState.factorObservedAt,
    universe: loadState.universe,
    fmpOk: loadState.fmpOk,
    secFundamentalsOk: loadState.secFundamentalsOk,
    fundamentalCoveragePct: loadState.fundamentalCoveragePct,
    rankingContract: metadata.rankingContract || null,
    backtest: metadata.backtest || null,
    breadth: metadata.breadth || null,
    ranking: metadata.ranking || null,
    nativeState: state
  };
  window._aioScreenerFactorAsOf = loadState.asOf;
  window._aioScreenerFactorObservedAt = loadState.factorObservedAt;
  if (metadata.backtest && metadata.backtest.kalmanScale === 'log_pct_day') {
    window._aioFactorBacktest = metadata.backtest;
    window._aioFactorBacktestStaleReason = null;
  } else if (metadata.backtest) {
    window._aioFactorBacktest = null;
    window._aioFactorBacktestStaleReason = 'legacy_kalman_scale';
  }
  if (window.SCREENER_DB_META && loadState.asOf) {
    window.SCREENER_DB_META.lastBulkUpdate = String(loadState.asOf).slice(0, 10);
    window.SCREENER_DB_META.stale = status !== 'ready' && status !== 'partial';
  }
  if (typeof _aioApplyScreenerBreadth === 'function' && metadata.breadth) {
    loadState.breadthStatus = _aioApplyScreenerBreadth({ breadth: metadata.breadth }) ? 'verified_current' : 'blocked';
  }
  if (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs && loadState.asOf) {
    window.DATA_SNAPSHOT._fieldTs.screener = loadState.asOf;
  }
  if (window._serverDataMeta) {
    window._serverDataMeta.artifacts = window._serverDataMeta.artifacts || {};
    window._serverDataMeta.artifacts.screenerJson = status;
    window._serverDataMeta.screener = loadState;
  }
  try { if (typeof _aioRenderDataFreshness === 'function') _aioRenderDataFreshness(); } catch (_) {}
  return true;
}
window._aioApplyNativeScreenerState = _aioApplyNativeScreenerState;
try {
  window.addEventListener('aio:nativeScreenerReady', function(event) {
    _aioApplyNativeScreenerState(event && event.detail);
  });
} catch (_) {}

let _aioServerMacroReady = false;
let _aioServerHyReady = false;
async function _aioLoadServerData() {
  globalThis._aioScreenerLoadState = { status:'loading', checkedAt:Date.now() };
  try {
    var url = './public-data/data.json?t=' + Math.floor(Date.now() / 60000); // 분 단위 캐시버스터
    var r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) {
      globalThis._aioScreenerLoadState = { status:'unavailable', checkedAt:Date.now(), detail:'data.json HTTP ' + r.status };
      return false;
    }
    var d = await r.json();
    if (!d || !d.meta) {
      globalThis._aioScreenerLoadState = { status:'unavailable', checkedAt:Date.now(), detail:'invalid data.json payload' };
      return false;
    }
    // The 22-category artifact is rebuilt from data.json, market-snapshot,
    // screener and history on every server refresh. Load it with the same
    // polling cycle so the browser sees category degradation without reload.
    var _reconciliationState = { status:'unavailable', checkedAt:Date.now(), detail:'not loaded' };
    try {
      var _reconciliationUrl = './public-data/reconciliation-status.json?t=' + Math.floor(Date.now() / 60000);
      var _reconciliationResponse = await fetch(_reconciliationUrl, { cache:'no-cache' });
      if (!_reconciliationResponse.ok) throw new Error('HTTP ' + _reconciliationResponse.status);
      var _reconciliation = await _reconciliationResponse.json();
      if (!_reconciliation || _reconciliation.schemaVersion !== 'reconciliation-status-v2' || !Array.isArray(_reconciliation.categories) || _reconciliation.categories.length !== 22) {
        throw new Error('invalid reconciliation payload');
      }
      var _sourceRevisionMatches = !!(_reconciliation.closure && _reconciliation.closure.sourceRevision && d.meta.marketSnapshotRevision)
        && _reconciliation.closure.sourceRevision === d.meta.marketSnapshotRevision;
      _reconciliationState = {
        status: _sourceRevisionMatches ? 'ready' : 'stale',
        checkedAt: Date.now(),
        generatedAt: _reconciliation.generatedAt || null,
        revision: _reconciliation.revision || null,
        sourceRevision: _reconciliation.closure && _reconciliation.closure.sourceRevision || null,
        sourceRevisionMatches: _sourceRevisionMatches,
        overall: _reconciliation.overall || 'BLOCKED',
        counts: _reconciliation.counts || {},
        categories: _reconciliation.categories,
        partialCategories: _reconciliation.closure && _reconciliation.closure.partialCategories || [],
        policyBlockedCategories: _reconciliation.closure && _reconciliation.closure.policyBlockedCategories || [],
        runtimeBlockedCategories: _reconciliation.closure && _reconciliation.closure.runtimeBlockedCategories || [],
        detail: _sourceRevisionMatches ? null : 'market snapshot revision mismatch'
      };
    } catch (_reconciliationError) {
      _reconciliationState.detail = String(_reconciliationError && _reconciliationError.message || _reconciliationError);
    }
    // P867: data.json can resolve before aio-core exposes DATA_SNAPSHOT on a
    // cold origin. Previously the macro block was then skipped permanently
    // even though cycle/news metadata loaded, producing saved-key + blank-card
    // behavior that disappeared only on warm-cache reloads.
    var _snapshotBridgeWait = 0;
    while (!window.DATA_SNAPSHOT && _snapshotBridgeWait < 60) {
      await new Promise(function(resolve) { setTimeout(resolve, 50); });
      _snapshotBridgeWait++;
    }
    if (!window.DATA_SNAPSHOT) {
      // The first parse of the large single-page bundle can legitimately take
      // longer than the bridge window on a cold device. Re-run the complete
      // idempotent loader instead of publishing metadata while permanently
      // skipping macro projection. Bound the retries so a genuinely broken
      // core does not create an endless fetch loop.
      globalThis._aioServerDataBridgeAttempts = (window._aioServerDataBridgeAttempts || 0) + 1;
      globalThis._aioScreenerLoadState = {
        status: 'waiting-for-snapshot',
        checkedAt: Date.now(),
        detail: 'DATA_SNAPSHOT bridge attempt ' + window._aioServerDataBridgeAttempts
      };
      if (window._aioServerDataBridgeAttempts <= 5 && !window._aioServerDataBridgeRetryTimer) {
        globalThis._aioServerDataBridgeRetryTimer = setTimeout(function() {
          globalThis._aioServerDataBridgeRetryTimer = null;
          _aioLoadServerData();
        }, 1000);
      }
      return false;
    }
    globalThis._aioServerDataBridgeAttempts = 0;

    var ageMin = d.meta.generatedAt ? Math.round((Date.now() - new Date(d.meta.generatedAt).getTime()) / 60000) : null;
    window._serverDataMeta = {
      generatedAt: d.meta.generatedAt,
      ageMin: ageMin,
      symbolsOk: d.meta.symbolsOk,
      symbolsFail: d.meta.symbolsFail,
      failedSymbols: d.meta.failedSymbols || [],
      fearGreedOk: !!d.meta.fearGreedOk,
      fredHasKey: !!d.meta.fredHasKey,
      fredFetchOk: !!d.meta.fredFetchOk,
      fredOk: !!d.meta.fredOk,
      fredFetchedKeyCount: d.meta.fredFetchedKeyCount || 0,
      fredLastSuccessfulAt: d.meta.fredLastSuccessfulAt || null,
      macroKeyCount: d.meta.macroKeyCount || 0,
      newsOk: !!d.meta.newsOk,
      newsCount: d.meta.newsCount || (Array.isArray(d.news) ? d.news.length : 0),
      newsCyclePolicy: d.meta.newsCyclePolicy || null,
      newsCycleStart: d.meta.newsCycleStart || null,
      newsCycleEnd: d.meta.newsCycleEnd || null,
      newsCycleLabel: d.meta.newsCycleLabel || null,
      newsNextRefresh: d.meta.newsNextRefresh || null,
      marketSnapshotRevision: d.meta.marketSnapshotRevision || null,
      cycleId: d.meta.cycleId || null,
      cycleStatus: d.meta.cycleStatus || 'unknown',
      marketCycleFreshnessSlaHours: Number(d.meta.marketCycleFreshnessSlaHours || 12),
      cycleManifestRevision: d.meta.cycleManifestRevision || null,
      cycleComponents: d.meta.cycleComponents || null,
      putCallOk: !!d.meta.putCallOk,
      putCallAsOf: d.meta.putCallAsOf || (d.putCall && d.putCall.asOf) || null,
      // v52.75/WP-AI0: generation success is not semantic verification.
      // The raw LLM marketAnalysis remains blocked until the producer emits
      // an explicit semantic-gate pass.
      marketAnalysisSemanticOk: d.meta.marketAnalysisSemanticOk === true,
      marketAnalysisOk: d.meta.marketAnalysisOk === true && d.meta.marketAnalysisSemanticOk === true,
      fmpHasKey: d.meta.fmpHasKey != null ? !!d.meta.fmpHasKey : null, // null = screener skipped이라 미확인
      fmpOk: !!d.meta.fmpOk,
      fmpCount: d.meta.fmpCount || 0,
      fmpPlanError: !!d.meta.fmpPlanError,
      secFundamentalsOk: !!d.meta.secFundamentalsOk,
      secFundamentalsCount: d.meta.secFundamentalsCount || 0,
      fundamentalCoveragePct: d.meta.fundamentalCoveragePct || 0,
      blsStatus: d.meta.blsStatus || (d.macro && d.macro._bls && d.macro._bls.status) || 'unavailable',
      blsSeriesCount: d.meta.blsSeriesCount || 0,
      blsFailedSeries: d.meta.blsFailedSeries || [],
      blsAttemptedAt: d.meta.blsAttemptedAt || (d.macro && d.macro._bls && d.macro._bls.attemptedAt) || null,
      blsLastSuccessfulAt: d.meta.blsLastSuccessfulAt || (d.macro && d.macro._bls && d.macro._bls.lastSuccessfulAt) || null,
      beaStatus: d.meta.beaStatus || (d.macro && d.macro._bea && d.macro._bea.status) || 'unavailable',
      beaAttemptedAt: d.meta.beaAttemptedAt || (d.macro && d.macro._bea && d.macro._bea.attemptedAt) || null,
      beaLastSuccessfulAt: d.meta.beaLastSuccessfulAt || (d.macro && d.macro._bea && d.macro._bea.lastSuccessfulAt) || null,
      beaReleaseAt: d.meta.beaReleaseAt || (d.macro && d.macro._bea && d.macro._bea.releasedAt) || null,
      beaNextReleaseAt: d.meta.beaNextReleaseAt || (d.macro && d.macro._bea && d.macro._bea.nextReleaseAt) || null,
      reconciliation: _reconciliationState,
      loadedAt: Date.now(),
      artifacts: { dataJson: 'ready', reconciliationStatus: _reconciliationState.status, telegramDigest: 'pending', screenerJson: 'pending' }
    };

    // Artifact provenance is the only snapshot-level timestamp. It describes
    // the payload, not every field; per-field timestamps remain authoritative.
    if (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs && d.meta.generatedAt) {
      window.DATA_SNAPSHOT._fieldTs.serverData = d.meta.generatedAt;
      window.DATA_SNAPSHOT._updated = d.meta.generatedAt;
      window.DATA_SNAPSHOT._marketDataUpdated = d.meta.generatedAt;
      window.DATA_SNAPSHOT._snapshotDate = String(d.meta.generatedAt).slice(0, 10);
      window.DATA_SNAPSHOT._marketDataDate = window.DATA_SNAPSHOT._snapshotDate;
    }

    // 1) 시세 → applyLiveQuotes (앱 전체 갱신 + aio:liveQuotes 발화)
    if (Array.isArray(d.quotes) && d.quotes.length && typeof applyLiveQuotes === 'function') {
      applyLiveQuotes(d.quotes);
    }
    // 2) 매크로 → DATA_SNAPSHOT (FRED 서버값, 채팅/macro 페이지가 소비)
    var _serverMacroApplied = 0;
    var _serverFredApplied = 0;
    var _serverBeaApplied = 0;
    globalThis._serverMacroEvidence = window._serverMacroEvidence || {};
    if (d.macro && window.DATA_SNAPSHOT) {
      // v51.97/Phase 2 [B2]: housingStarts/retailSales/usWageGrowth 서버 FRED 자동화 편입.
      // consConf(Conf. Board)는 제외 유지 — FRED엔 해당 시리즈가 없고, UMCSENT(미시간대)는
      // 별개 지표라 혼입 금지(P593).
      ['cpi','coreCpi','pce','corePce','fedRate','unemployment','nfp','housingStarts','retailSales','usWageGrowth'].forEach(function(k){
        if (typeof d.macro[k] === 'number' && isFinite(d.macro[k])) {
          window.DATA_SNAPSHOT[k] = d.macro[k];
          var _macroSource = d.macro['_' + 'source_' + k]
            || ((k === 'pce' || k === 'corePce') && d.macro._bea && d.macro._bea.status === 'ok' ? 'bea-official-primary' : null)
            || (d.meta.fredFetchOk ? 'fred-official-primary' : 'last-known-good');
          window.DATA_SNAPSHOT['_' + k + '_src'] = _macroSource;
          window._serverMacroEvidence[k] = {
            observedAt: d.macro['_asOf_' + k] || null,
            fetchedAt: _macroSource === 'bea-official-primary'
              ? (d.macro._bea && d.macro._bea.lastSuccessfulAt || null)
              : (d.meta.fredFetchOk ? d.meta.fredLastSuccessfulAt || d.meta.generatedAt || null : null),
            releasedAt: _macroSource === 'bea-official-primary' && d.macro._bea ? d.macro._bea.releasedAt || null : null,
            source: _macroSource,
            allowedUse: _macroSource === 'last-known-good' ? 'reference-only' : 'macro-evidence-with-observation-date'
          };
          if (_macroSource === 'fred-official-primary') _serverFredApplied++;
          if (_macroSource === 'bea-official-primary') _serverBeaApplied++;
          if (window.DATA_SNAPSHOT._fieldTs && d.macro['_asOf_' + k]) {
            window.DATA_SNAPSHOT._fieldTs['macro_' + k] = d.macro['_asOf_' + k];
          }
          _serverMacroApplied++;
        }
        // v51.67: FRED MoM delta 필드 소비
        if (typeof d.macro[k + 'Delta'] === 'number' && isFinite(d.macro[k + 'Delta'])) {
          window.DATA_SNAPSHOT['_' + k + 'Delta'] = d.macro[k + 'Delta'];
        }
      });
      // AR-07 Batch 2: the durable FRED HY OAS value is the primary published
      // success path. Do not wait for the browser's CORS/proxy fetch and never
      // derive OAS from HYG's dollar price (duration-contaminated proxy).
      if (typeof d.macro.hyOAS === 'number' && isFinite(d.macro.hyOAS)) {
        var _serverHySpreadBp = Math.round(d.macro.hyOAS * 100);
        Object.assign(window, {
          _hySpreadBp: _serverHySpreadBp,
          _hySpreadDate: d.macro._asOf_hyOAS || null,
          _hySpreadSource: 'github-actions:FRED'
        });
        Object.assign(window.DATA_SNAPSHOT, {
          hyOAS: d.macro.hyOAS,
          hySpread: _serverHySpreadBp,
          _hySpreadSource: 'fred-server-artifact'
        });
        if (window.DATA_SNAPSHOT._fieldTs) window.DATA_SNAPSHOT._fieldTs.hySpread = d.meta.generatedAt || new Date().toISOString();
        if (window._serverDataMeta) window._serverDataMeta.hyOAS = {
          value: d.macro.hyOAS,
          valueBp: _serverHySpreadBp,
          observedAt: d.macro._asOf_hyOAS || null,
          fetchedAt: d.meta.generatedAt || null,
          source: 'FRED BAMLH0A0HYM2 via GitHub Actions',
          sourceKind: 'official-series',
          allowedUse: 'reference-until-freshness-gate'
        };
        try {
          if (window.AIO_ARCH && typeof window.AIO_ARCH.ingestSentiment === 'function') {
            window.AIO_ARCH.ingestSentiment({
              hySpread: _serverHySpreadBp,
              hySpreadSourceKind: 'delayed',
              hySpreadSource: 'github-actions:FRED',
              hySpreadDate: d.macro._asOf_hyOAS || d.meta.generatedAt || null,
              now: new Date().toISOString()
            });
          }
        } catch (_) {}
        _serverMacroApplied++;
      }
      // BLS stays a separate official evidence family. It is projected into
      // namespaced snapshot fields and never silently replaces the FRED values
      // above; the typed series retains observation/release/fetch semantics.
      var _blsEvidence = d.macro._bls || null;
      var _beaEvidence = d.macro._bea || null;
      window._serverBlsMacro = _blsEvidence;
      globalThis._serverBeaMacro = _beaEvidence;
      if (window._serverDataMeta) {
        window._serverDataMeta.bls = _blsEvidence ? {
          status: _blsEvidence.status || 'unavailable',
          sourceKind: _blsEvidence.sourceKind || 'official-primary',
          attemptedAt: _blsEvidence.attemptedAt || null,
          fetchedAt: _blsEvidence.fetchedAt || null,
          lastSuccessfulAt: _blsEvidence.lastSuccessfulAt || null,
          releaseAt: _blsEvidence.releaseAt || null,
          failures: Array.isArray(_blsEvidence.failures) ? _blsEvidence.failures.slice() : [],
          series: _blsEvidence.series || {}
        } : null;
        window._serverDataMeta.bea = _beaEvidence ? {
          status: _beaEvidence.status || 'unavailable',
          sourceKind: _beaEvidence.sourceKind || 'official-primary',
          attemptedAt: _beaEvidence.attemptedAt || null,
          fetchedAt: _beaEvidence.fetchedAt || null,
          lastSuccessfulAt: _beaEvidence.lastSuccessfulAt || null,
          releasedAt: _beaEvidence.releasedAt || null,
          nextReleaseAt: _beaEvidence.nextReleaseAt || null,
          observedAt: _beaEvidence.observedAt || null,
          releaseUrl: _beaEvidence.releaseUrl || null,
          values: _beaEvidence.values || {}
        } : null;
      }
      if (_blsEvidence && _blsEvidence.values) {
        Object.keys(_blsEvidence.values).forEach(function(k) {
          var value = _blsEvidence.values[k];
          if (typeof value !== 'number' || !isFinite(value)) return;
          window.DATA_SNAPSHOT[k] = value;
          window.DATA_SNAPSHOT['_' + k + '_src'] = 'bls-official-primary';
        });
        if (window.DATA_SNAPSHOT._fieldTs && (_blsEvidence.lastSuccessfulAt || _blsEvidence.fetchedAt)) {
          window.DATA_SNAPSHOT._fieldTs.macro_bls = _blsEvidence.lastSuccessfulAt || _blsEvidence.fetchedAt;
        }
      }
      if (_beaEvidence && _beaEvidence.status === 'ok' && window.DATA_SNAPSHOT._fieldTs && (_beaEvidence.releasedAt || _beaEvidence.lastSuccessfulAt)) {
        window.DATA_SNAPSHOT._fieldTs.macro_bea = _beaEvidence.releasedAt || _beaEvidence.lastSuccessfulAt;
      }
    }
    // v51.67: F&G previousScore → _fearGreedDelta 계산
    if (d.fearGreed && typeof d.fearGreed.score === 'number') {
      if (typeof d.fearGreed.previousScore === 'number') {
        window.DATA_SNAPSHOT._fearGreedDelta = d.fearGreed.score - d.fearGreed.previousScore;
        window.DATA_SNAPSHOT._fearGreedPrev = d.fearGreed.previousScore;
      }
      if (typeof d.fearGreed.previousWeek === 'number') {
        window.DATA_SNAPSHOT._fearGreedWeekDelta = d.fearGreed.score - d.fearGreed.previousWeek;
      }
    }
    // v51.66: _fieldTs.macro_fred — FRED 매크로 마지막 적용 시각 기록
    if (d.meta.fredFetchOk && _serverFredApplied > 0 && window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs) {
      window.DATA_SNAPSHOT._fieldTs.macro_fred = d.meta.fredLastSuccessfulAt || d.meta.generatedAt || new Date().toISOString();
    }
    _aioServerMacroReady = !!(d.meta.fredFetchOk && _serverFredApplied > 0);
    _aioServerHyReady = !!(window._serverDataMeta && window._serverDataMeta.hyOAS);
    // v50.78: 서버 FRED 공백(fredHasKey=false 또는 fredFetchOk=false) + 클라이언트 키 있으면 자동 브릿지.
    // GitHub Actions Secret에 FRED_API_KEY 미등록이어도 사용자 브라우저 키(aio_fred_key)로 매크로 갱신.
    if (!d.meta.fredFetchOk) {
      var _clientFredKey = (typeof DATA_APIS !== 'undefined' && DATA_APIS.fred) ? DATA_APIS.fred.key() : '';
      if (_clientFredKey && typeof fetchAllFredData === 'function') {
        setTimeout(function() {
          fetchAllFredData().catch(function(){});
        }, 1500);
      }
    }
    setTimeout(function() {
      try {
        if (typeof window._aioRenderAllPageDecisionHeaders === 'function') window._aioRenderAllPageDecisionHeaders();
        window.dispatchEvent(new CustomEvent('aio:sharedMarketCut', { detail: window._serverDataMeta }));
      } catch (_) {}
    }, 0);
    // 3) Fear & Greed
    if (d.fearGreed && typeof d.fearGreed.score === 'number' && isFinite(d.fearGreed.score)) {
      if (typeof _applyFearGreedScore === 'function') {
        _applyFearGreedScore({ score: d.fearGreed.score, sourceKind: 'delayed', sourceLabel: 'cnn-via-github-actions', sourceTs: d.fearGreed.asOf || d.meta.generatedAt, operationalUse: 'reference-only' });
      }
      // v51.66: _fieldTs.fearGreed — Fear & Greed 마지막 적용 시각 기록
      if (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs) {
        window.DATA_SNAPSHOT._fieldTs.fearGreed = d.fearGreed.asOf || d.meta.generatedAt || new Date().toISOString();
      }
    }
    // 4) Cboe official daily Put/Call. Server-side collection avoids the
    // public CORS proxy and is explicitly delayed, never called real-time.
    if (d.putCall && typeof d.putCall.totalPutCall === 'number' && isFinite(d.putCall.totalPutCall) && typeof _aioUpdatePutCallDom === 'function') {
      _aioUpdatePutCallDom({
        totalPutCall: d.putCall.totalPutCall,
        equityPutCall: d.putCall.equityPutCall,
        indexPutCall: d.putCall.indexPutCall,
        sourceKind: 'delayed',
        sourceLabel: 'Cboe Daily Market Statistics',
        asOf: d.putCall.asOf || d.meta.generatedAt
      });
      if (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs) window.DATA_SNAPSHOT._fieldTs.putCall = d.putCall.asOf || d.meta.generatedAt;
    }
    // 5) v50.28/WO-6: 서버 뉴스 백스톱 저장 + (클라이언트 뉴스 비었을 때만) 적용 — additive
    if (Array.isArray(d.news) && d.news.length) {
      window._serverNewsBackstop = d.news;
      try { _aioApplyNewsBackstop(false); } catch(_) {}
    }
    try {
      if (typeof _aioLoadServerTelegramDigest === 'function') {
        await _aioLoadServerTelegramDigest();
        if (window._serverDataMeta) {
          window._serverDataMeta.artifacts.telegramDigest = window._aioTelegramDigestMeta && window._aioTelegramDigestMeta.status || 'checked';
          window._serverDataMeta.telegramDigest = window._aioTelegramDigestMeta || null;
          window._serverDataMeta.telegramMemoOverlay = window._aioTelegramMemoOverlayAudit || null;
        }
      }
    } catch(_) {}
    // 6) v50.48/Phase 4: 서버 LLM 시장 분석문(운영자 키 있을 때 cron 생성) — 있으면 합성 sink가 템플릿 대신 우선 사용.
    // v52.75/WP-AI0: do not expose generated-but-unverified LLM prose to any
    // public sink. A future typed/semantic producer must opt in explicitly.
    window._serverMarketAnalysis = null;
    if (d.marketAnalysis && (d.marketAnalysis.full || d.marketAnalysis.oneLine)) {
      var _serverMarketMetricEvidence = Array.isArray(d.marketAnalysis.metricEvidence) ? d.marketAnalysis.metricEvidence : [];
      var _serverMarketMetricEvidenceValid = _serverMarketMetricEvidence.length >= 2 && _serverMarketMetricEvidence.every(function(row) {
        return row && row.metricId && row.unit && row.source && row.asOf && isFinite(Number(row.value)) && !isNaN(new Date(row.asOf).getTime());
      });
      var _serverMarketSemanticIssues = Array.isArray(d.marketAnalysis.semanticIssues) ? d.marketAnalysis.semanticIssues : [];
      var _serverMarketEvidenceIds = _serverMarketMetricEvidence.map(function(row) { return row.evidenceId; }).filter(Boolean);
      var _serverMarketClaimsValid = d.marketAnalysis.schemaVersion === 'market-analysis.v2'
        && Array.isArray(d.marketAnalysis.claims)
        && d.marketAnalysis.claims.every(function(claim) {
          return claim && claim.text && Array.isArray(claim.evidenceIds) && claim.evidenceIds.length > 0
            && claim.evidenceIds.every(function(id) { return _serverMarketEvidenceIds.indexOf(id) >= 0 || (Array.isArray(d.marketAnalysis.newsEvidence) && d.marketAnalysis.newsEvidence.some(function(row) { return row.evidenceId === id; })); });
        });
      var _serverMarketSemanticContract = d.marketAnalysis.semanticStatus === 'verified'
        && _serverMarketSemanticIssues.length === 0
        && _serverMarketMetricEvidenceValid
        && _serverMarketClaimsValid;
      var _serverMarketPublishAudit = window.AIO && typeof window.AIO.validateAIAutomatedPublish === 'function'
        ? window.AIO.validateAIAutomatedPublish({ entrypoint: 'market-analysis', text: d.marketAnalysis.full || d.marketAnalysis.oneLine, currentSensitive: true, requiresStructuredClaims: false, evidence: _serverMarketMetricEvidence })
        : { blocked: false, sourceLabel: 'AI_GENERATED' };
      // P846/P847: metadata alone must never certify current-sensitive prose. The
      // producer must supply typed metric identity/value/unit/asOf/source evidence.
      var _serverMarketAnalysisVerified = _serverMarketSemanticContract && !_serverMarketPublishAudit.blocked;
      var _serverMarketAnalysisGeneratedAt = d.marketAnalysis.generatedAt || d.meta.generatedAt;
      var _serverMarketAnalysisSource = d.marketAnalysis.source || d.marketAnalysis.model || 'github-actions-market-analysis';
      if (_serverMarketAnalysisVerified) {
        window._serverMarketAnalysis = {
          status: 'verified',
          full: d.marketAnalysis.full || d.marketAnalysis.oneLine,
          oneLine: d.marketAnalysis.oneLine || d.marketAnalysis.full,
          generatedAt: _serverMarketAnalysisGeneratedAt,
          source: _serverMarketAnalysisSource,
          publishAudit: _serverMarketPublishAudit,
          sourceLabel: window.AIO && typeof window.AIO.getAIOutputSourceLabel === 'function' ? window.AIO.getAIOutputSourceLabel('AI_GENERATED', _serverMarketPublishAudit) : 'AI_GENERATED'
        };
      }
      if (window._serverDataMeta) {
        window._serverDataMeta.marketAnalysis = {
          status: _serverMarketAnalysisVerified ? 'verified' : 'blocked-unverified',
          generatedAt: _serverMarketAnalysisGeneratedAt,
          source: _serverMarketAnalysisSource,
          fullLength: String(d.marketAnalysis.full || d.marketAnalysis.oneLine || '').length,
          metricEvidenceCount: _serverMarketMetricEvidence.length,
          reason: _serverMarketAnalysisVerified ? null : (_serverMarketPublishAudit.blocked ? 'automated-publish-gate' : (_serverMarketMetricEvidenceValid ? 'semantic-gate-required' : 'metric-evidence-required')),
          publishAudit: _serverMarketPublishAudit,
          fallback: 'AIO.synthesizeMarketAnalysis'
        };
      }
      try { if (window._aioRenderMarketAnalysisSinks) window._aioRenderMarketAnalysisSinks(); } catch(_) {}
    }
    // 6) P768/ARX-16: screener artifact는 native provider/orchestrator가 단일 fetch한다.
    // legacy loader는 native state의 metadata/breadth만 compatibility surface로 연결한다.
    try {
      if (!_aioApplyNativeScreenerState()) {
        window._aioScreenerLoadState = { status:'loading', checkedAt:Date.now(), detail:'native screener state pending' };
        if (window._serverDataMeta) {
          window._serverDataMeta.artifacts.screenerJson = 'pending';
          window._serverDataMeta.screener = window._aioScreenerLoadState;
        }
      }
    } catch(e) {
      window._aioScreenerLoadState = { status:'unavailable', checkedAt:Date.now(), detail:(e && e.message) || 'native state unavailable' };
      if (window._serverDataMeta) {
        window._serverDataMeta.artifacts.screenerJson = 'unavailable';
        window._serverDataMeta.screener = window._aioScreenerLoadState;
      }
    }
    if (typeof _aioLog === 'function') _aioLog('info', 'data', 'server data.json 적용: quotes ' + (d.quotes ? d.quotes.length : 0) + ', age ' + ageMin + 'min');
    _aioRenderServerDataAge();  // v50.24/WO-4: 나이 배지 갱신
    try { if (typeof _aioRenderPipelineStatus === 'function') _aioRenderPipelineStatus(); } catch(_) {} // v51.65: 파이프라인 상태 배너
    try { _aioRenderDataFreshness(); } catch(_) {} // v51.66: 신선도 타임스탬프 UI
    try { _aioCheckManualFieldStaleness(); } catch(_) {} // v51.66: 수동 필드 staleness 경고
    try { _aioUpdatePipelineStatusToggle(); } catch(_) {} // v52.15 P616: pill 개수 집계 → 1줄 요약+펼치기
    try { _aioRenderDeltas(); } catch(_) {} // v51.67: 변화율 표시 (FRED MoM + F&G 전일 + 스코어)
    // v50.24/WO-4: 보이는 페이지 분석 텍스트도 새 데이터로 재생성 (숨은 페이지는 스킵)
    try { if (window.AIO && typeof window.AIO.refreshActivePageNarratives === 'function') window.AIO.refreshActivePageNarratives(); } catch(_) {}
    try {
      window.dispatchEvent(new CustomEvent('aio:serverDataLoaded', { detail: window._serverDataMeta }));
      if (document && typeof document.dispatchEvent === 'function') document.dispatchEvent(new CustomEvent('aio:serverDataLoaded', { detail: window._serverDataMeta }));
    } catch(_) {}
    return true;
  } catch (e) {
    window._aioScreenerLoadState = { status:'unavailable', checkedAt:Date.now(), detail:'server data unavailable' };
    if (typeof _aioLog === 'function') _aioLog('warn', 'data', 'server data.json 로드 실패(폴백): ' + (e && e.message || e));
    return false;
  }
}
window._aioLoadServerData = _aioLoadServerData;

// v51.66: _fieldTs 유틸 — 카테고리별 마지막 갱신 시각을 KST HH:MM 또는 날짜 문자열로 반환
window._aioGetFieldTs = function(category) {
  var snap = window.DATA_SNAPSHOT;
  if (!snap || !snap._fieldTs) return null;
  var raw = snap._fieldTs[category];
  if (!raw) return null;
  try {
    var d = new Date(raw);
    if (isNaN(d.getTime())) return raw; // 이미 날짜 문자열(ex: '2026-05-28')
    var kst = new Date(d.getTime() + 9 * 3600000);
    var mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
    var dd = String(kst.getUTCDate()).padStart(2, '0');
    var hh = String(kst.getUTCHours()).padStart(2, '0');
    var min = String(kst.getUTCMinutes()).padStart(2, '0');
    // 오늘 날짜면 HH:MM, 다른 날이면 MM-DD HH:MM
    var today = new Date(Date.now() + 9 * 3600000);
    var sameDay = kst.getUTCFullYear() === today.getUTCFullYear() && kst.getUTCMonth() === today.getUTCMonth() && kst.getUTCDate() === today.getUTCDate();
    return sameDay ? hh + ':' + min + ' KST' : mm + '-' + dd + ' ' + hh + ':' + min + ' KST';
  } catch(e) { return raw; }
};

// ═══ v51.67: 변화율(Delta) 표시 시스템 ══════════════════════════════════════
// 지표별 극성: +1 = 오를수록 좋음(초록), -1 = 내릴수록 좋음(빨강), 0 = 중립(회색)
var _AIO_DELTA_POLARITY = {
  cpi: -1, coreCpi: -1, pce: -1, corePce: -1,  // 낮을수록 좋음 (인플레 둔화)
  unemployment: -1,  // 낮을수록 좋음
  nfp: +1,           // 높을수록 좋음 (고용 증가)
  fedRate: 0,        // 중립 (금리 방향은 상황마다 다름)
  fearGreed: 0,      // 중립 (극단적 탐욕·공포 모두 위험)
  tradingScore: +1,
  breadth5sma: +1, breadth20sma: +1, breadth50sma: +1,
  vix: -1,
};

// delta 포맷: "+3.1pp" / "-0.5" / "0" 형태로 반환. 표시 여부와 색상 클래스 포함
function _aioFormatDelta(delta, polarity, opts) {
  if (delta == null || !isFinite(delta)) return null;
  var dec = (opts && opts.decimals != null) ? opts.decimals : 1;
  var suffix = (opts && opts.suffix) ? opts.suffix : '';
  var abs = Math.abs(delta);
  if (abs < 0.005) return { text: '0' + suffix, cls: 'is-flat' };
  var sign = delta > 0 ? '+' : '';
  var text = sign + delta.toFixed(dec) + suffix;
  var cls = 'is-flat';
  if (polarity !== 0) cls = (delta * polarity > 0) ? 'is-up' : 'is-down';
  return { text: text, cls: cls };
}

// localStorage 기반 전일 대비 기준값 (트레이딩 스코어, 시장폭 — 실시간 계산값)
var _AIO_DELTA_TODAY_KEY = 'aio_delta_today';
var _AIO_DELTA_PREV_KEY  = 'aio_delta_prev';

function _aioGetPrevDeltaRef() {
  try {
    var today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    var raw = localStorage.getItem(_AIO_DELTA_TODAY_KEY);
    if (raw) {
      var snap = JSON.parse(raw);
      if (snap.date && snap.date < today) {
        // 날짜 바뀜 → 어제 스냅을 prev로 승격하고 today 초기화
        localStorage.setItem(_AIO_DELTA_PREV_KEY, raw);
        localStorage.removeItem(_AIO_DELTA_TODAY_KEY);
      }
    }
    var prevRaw = localStorage.getItem(_AIO_DELTA_PREV_KEY);
    return prevRaw ? JSON.parse(prevRaw) : null;
  } catch(e) { return null; }
}

function _aioSaveDeltaRef() {
  try {
    var today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    var snap = window.DATA_SNAPSHOT || {};
    var tsVal = null;
    try { if (typeof computeTradingScore === 'function') tsVal = computeTradingScore().total; } catch(e) {}
    localStorage.setItem(_AIO_DELTA_TODAY_KEY, JSON.stringify({
      date: today,
      tradingScore: tsVal,
      breadth5sma: typeof snap.breadth5sma === 'number' ? snap.breadth5sma : null,
      breadth20sma: typeof snap.breadth20sma === 'number' ? snap.breadth20sma : null,
      breadth50sma: typeof snap.breadth50sma === 'number' ? snap.breadth50sma : null,
    }));
  } catch(e) {}
}

// 단일 delta 엘리먼트 업데이트 헬퍼
function _aioSetDeltaEl(id, delta, polarity, opts) {
  var el = document.getElementById(id);
  if (!el) return;
  var fmt = _aioFormatDelta(delta, polarity, opts);
  if (!fmt) { el.style.display = 'none'; return; }
  el.textContent = fmt.text;
  el.className = 'aio-metric-delta ' + fmt.cls;
  el.style.cssText = 'display:inline;font-size:10px;font-family:var(--font-mono);margin-left:4px;';
}

// v53.15/P738: use the just-fetched CNN previous-day score for the current
// session and prevent a later snapshot repaint from overwriting that delta.
var _fgLiveDelta = null;
function _aioRenderLiveFearGreedDelta(score, previousScore) {
  var current = Number(score);
  var previous = Number(previousScore);
  _fgLiveDelta = Number.isFinite(current) && Number.isFinite(previous)
    ? Math.round(current) - Math.round(previous)
    : null;
  _aioSetDeltaEl('sentiment-fg-delta', _fgLiveDelta, _AIO_DELTA_POLARITY.fearGreed, { decimals: 0 });
  _aioSetDeltaEl('home-fg-delta', _fgLiveDelta, _AIO_DELTA_POLARITY.fearGreed, { decimals: 0 });
  return _fgLiveDelta;
}
window._aioRenderLiveFearGreedDelta = _aioRenderLiveFearGreedDelta;

// 통합 delta 렌더러 — 서버데이터 로드 후 + live quotes 갱신 후 호출
function _aioRenderDeltas() {
  var snap = window.DATA_SNAPSHOT || {};
  var prev = _aioGetPrevDeltaRef();

  // 1) FRED 매크로 MoM delta (서버에서 계산된 값)
  _aioSetDeltaEl('cpi-yoy-delta',      snap._cpiDelta,        _AIO_DELTA_POLARITY.cpi,          { suffix: 'pp', decimals: 1 });
  _aioSetDeltaEl('core-cpi-yoy-delta', snap._coreCpiDelta,    _AIO_DELTA_POLARITY.coreCpi,      { suffix: 'pp', decimals: 1 });
  _aioSetDeltaEl('pce-yoy-delta',      snap._pceDelta,        _AIO_DELTA_POLARITY.pce,          { suffix: 'pp', decimals: 1 });
  _aioSetDeltaEl('core-pce-yoy-delta', snap._corePceDelta,    _AIO_DELTA_POLARITY.corePce,      { suffix: 'pp', decimals: 1 });
  _aioSetDeltaEl('nfp-delta-tag',      snap._nfpDelta != null ? snap._nfpDelta / 1000 : null,
                                                               _AIO_DELTA_POLARITY.nfp,          { suffix: 'K vs 전월', decimals: 0 });
  _aioSetDeltaEl('unemployment-delta', snap._unemploymentDelta, _AIO_DELTA_POLARITY.unemployment, { suffix: 'pp', decimals: 2 });
  _aioSetDeltaEl('fed-rate-delta',     snap._fedRateDelta,    _AIO_DELTA_POLARITY.fedRate,      { suffix: 'pp', decimals: 2 });

  // 2) Fear & Greed 전일 delta (서버 CNN API previousScore 기반)
  var _fgDeltaForRender = _fgLiveDelta != null ? _fgLiveDelta : snap._fearGreedDelta;
  _aioSetDeltaEl('sentiment-fg-delta', _fgDeltaForRender, _AIO_DELTA_POLARITY.fearGreed,    { decimals: 0 });
  _aioSetDeltaEl('home-fg-delta',      _fgDeltaForRender, _AIO_DELTA_POLARITY.fearGreed,    { decimals: 0 });

  // 3) 트레이딩 스코어 전일 delta (localStorage)
  if (prev && typeof prev.tradingScore === 'number') {
    try {
      var ts = computeTradingScore();
      if (ts && typeof ts.total === 'number') {
        _aioSetDeltaEl('score-delta-tag', ts.total - prev.tradingScore, _AIO_DELTA_POLARITY.tradingScore, { decimals: 0 });
      }
    } catch(e) {}
  }

  // 4) 시장폭(Breadth) 전일 delta (localStorage)
  if (prev) {
    _aioSetDeltaEl('breadth-5sma-delta',
      (typeof snap.breadth5sma  === 'number' && typeof prev.breadth5sma  === 'number') ? snap.breadth5sma  - prev.breadth5sma  : null,
      _AIO_DELTA_POLARITY.breadth5sma, { suffix: 'pp', decimals: 0 });
    _aioSetDeltaEl('breadth-20sma-delta',
      (typeof snap.breadth20sma === 'number' && typeof prev.breadth20sma === 'number') ? snap.breadth20sma - prev.breadth20sma : null,
      _AIO_DELTA_POLARITY.breadth20sma, { suffix: 'pp', decimals: 0 });
    _aioSetDeltaEl('breadth-50sma-delta',
      (typeof snap.breadth50sma === 'number' && typeof prev.breadth50sma === 'number') ? snap.breadth50sma - prev.breadth50sma : null,
      _AIO_DELTA_POLARITY.breadth50sma, { suffix: 'pp', decimals: 0 });
  }

  // 5) localStorage 기준값 저장 (날짜가 바뀔 때 자동 승격)
  _aioSaveDeltaRef();
}
window._aioRenderDeltas = _aioRenderDeltas;

// v51.66: 전 페이지 데이터 신선도 UI — screener 듀얼 타임스탬프 + macro FRED 기준 시각
function _aioRenderDataFreshness() {
  try {
    // 스크리너: 팩터 기준시각 | 가격 기준시각
    var asEl = document.querySelector('#page-screener [data-factor-asof]');
    if (asEl) {
      var scrTs = window._aioScreenerFactorObservedAt ? _aioKstShortFromIso(window._aioScreenerFactorObservedAt) : null;
      var scrGeneratedTs = window._aioGetFieldTs('screener');
      var priceTs = window._aioGetFieldTs('prices');
      if (scrTs && priceTs) {
        asEl.textContent = '팩터 관측 ' + scrTs + (scrGeneratedTs ? ' · 파일 ' + scrGeneratedTs : '') + ' | 가격 ' + priceTs;
      } else if (scrTs) {
        asEl.textContent = '팩터 관측 ' + scrTs + (scrGeneratedTs ? ' · 파일 ' + scrGeneratedTs : '');
      } else if (window._aioScreenerFactorAsOf) {
        asEl.textContent = '팩터 기준 ' + String(window._aioScreenerFactorAsOf).slice(0, 10);
      } else {
        asEl.textContent = '팩터 데이터 대기 (정적 시그널 폴백 중)';
      }
    }
    // 매크로: FRED 기준 시각 또는 폴백 날짜
    var fredEl = document.getElementById('macro-fred-ts');
    if (fredEl) {
      var fredTs = window._aioGetFieldTs('macro_fred');
      var snap = window.DATA_SNAPSHOT;
      if (fredTs) {
        fredEl.textContent = 'FRED ' + fredTs;
        fredEl.style.display = 'inline';
      } else if (snap && snap._fieldTs && snap._fieldTs.us_macro_manual) {
        fredEl.textContent = 'FRED 폴백 (' + snap._fieldTs.us_macro_manual + ')';
        fredEl.style.display = 'inline';
      } else {
        fredEl.style.display = 'none';
      }
    }
    if (typeof _aioSchedulePublicReadiness === 'function') _aioSchedulePublicReadiness(250);
  } catch(_) {}
}
window._aioRenderDataFreshness = _aioRenderDataFreshness;

// v51.66: 수동 유지 _fieldTs 필드 staleness 경고 — >7일 경과 시 콘솔 warn + 배너 pill
// 중앙은행 금리/매크로 정책 날짜는 자동 갱신 불가 — 운영자가 직접 aio-core.js에서 업데이트해야 함
var _MANUAL_FIELDTS_LABELS = {
  fed_rate:        'Fed 기준금리',
  boj_rate:        'BOJ 정책금리',
  bok_rate:        'BOK 기준금리',
  boe_rate:        'BOE 정책금리',
  pboc_rate:       'PBOC LPR',
  kr_bond:         '한국 국고채',
  kr_macro:        '한국 거시경제',
  kr_cpi:          '한국 소비자물가',
  kr_pmi:          '한국 제조업 PMI',
  us_macro_manual: '미국 거시경제(수동)',
  breadth_sma:     '시장 폭 SMA',
};
// 정책금리는 회의에서 동결될 수 있는 이벤트 데이터다. 일괄 7일 기준은 정상적인 동결
// 결정을 stale로 오인하므로 각 데이터의 실제 관측/발표 주기에 맞춘다.
var _MANUAL_FIELDTS_MAX_DAYS = {
  fed_rate: 55, boj_rate: 60, bok_rate: 60, boe_rate: 60, pboc_rate: 45,
  kr_bond: 7, kr_macro: 40, kr_cpi: 40, kr_pmi: 40, us_macro_manual: 40, breadth_sma: 3
};
function _aioCheckManualFieldStaleness() {
  var snap = window.DATA_SNAPSHOT;
  if (!snap || !snap._fieldTs) return;
  var staleResults = [];
  var staleDaysFn = typeof window._aioStaleDays === 'function' ? window._aioStaleDays : function(d) {
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  };
  Object.keys(_MANUAL_FIELDTS_LABELS).forEach(function(key) {
    var dateStr = snap._fieldTs[key];
    if (!dateStr) return;
    var days = staleDaysFn(dateStr);
    var maxDays = _MANUAL_FIELDTS_MAX_DAYS[key] || 7;
    if (days > maxDays) {
      staleResults.push({ key: key, label: _MANUAL_FIELDTS_LABELS[key], days: days, date: dateStr });
      if (typeof _aioLog === 'function') {
        _aioLog('warn', 'data', '[_fieldTs] ' + _MANUAL_FIELDTS_LABELS[key] + ' ' + days + '일 경과 (' + dateStr + ') — aio-core.js DATA_SNAPSHOT._fieldTs.' + key + ' 업데이트 필요');
      }
    }
  });
  // 배너에 stale 항목 표시 (파이프라인 상태 바 활용)
  var bar = document.getElementById('aio-pipeline-status-bar');
  if (bar && staleResults.length) {
    // 기존 stale pill 제거 후 재주입
    bar.querySelectorAll('.stale-manual-pill').forEach(function(el) { el.remove(); });
    staleResults.forEach(function(r) {
      var pill = document.createElement('span');
      pill.className = 'stale-manual-pill';
      pill.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;font-size:10px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);color:#f59e0b;cursor:default;';
      pill.title = r.label + ' — 마지막 업데이트 ' + r.date + ' (' + r.days + '일 경과). 정책 발표/공식 소스 확인 후 갱신됩니다.';
      pill.textContent = '⏰ ' + r.label + ' ' + r.days + '일 경과';
      bar.appendChild(pill);
    });
    bar.style.display = 'flex';
  }
  return staleResults;
}
window._aioCheckManualFieldStaleness = _aioCheckManualFieldStaleness;

// v52.15 P6/P616: 홈 경고 pill 11개 연속 노출("고장난 시스템" 인상) 완화 — _aioRenderPipelineStatus/
// _aioCheckManualFieldStaleness는 무변경으로 두고, 이 함수가 둘이 채운 pill 개수만 집계해
// #aio-pipeline-status-toggle(<details>, 사이트 전역 .aio-page-advanced-toggle 패턴)의 1줄 요약을 갱신.
// 반드시 위 두 함수 호출 이후에 실행되어야 함(마지막에 실제 개수를 읽어야 하므로).
function _aioUpdatePipelineStatusToggle() {
  try {
    var bar = document.getElementById('aio-pipeline-status-bar');
    var toggle = document.getElementById('aio-pipeline-status-toggle');
    var summary = document.getElementById('aio-pipeline-status-summary');
    if (!bar || !toggle || !summary) return;
    var count = bar.children.length;
    if (count === 0) { toggle.style.display = 'none'; return; }
    bar.style.display = 'flex';
    toggle.style.display = 'block';
    summary.textContent = '⚠ 주의 항목 ' + count + '건';
  } catch (_e) {}
}
window._aioUpdatePipelineStatusToggle = _aioUpdatePipelineStatusToggle;

// v51.18: 운영자 노트 — public-data/operator-note.json 로드 + 홈 카드 렌더
function _aioIsOperatorNotePlaceholder(note) {
  try {
    var title = String((note && note.title) || '');
    var body = String((note && note.body) || '');
    return /제목을 여기에 작성하세요|운영자 노트 — 제목/.test(title) ||
           /여기에 본문을 작성하세요|예시: 나스닥 RSI/.test(body);
  } catch(_) { return true; }
}
async function _aioLoadOperatorNote() {
  try {
    var url = './public-data/operator-note.json?t=' + Math.floor(Date.now() / 300000);
    var r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return;
    var d = await r.json();
    if (d && d.visible !== false && !_aioIsOperatorNotePlaceholder(d)) {
      window._aioOperatorNote = d;
      if (typeof _aioRenderOperatorNote === 'function') _aioRenderOperatorNote();
    } else {
      window._aioOperatorNote = null;
      if (typeof _aioRenderOperatorNote === 'function') _aioRenderOperatorNote();
    }
  } catch(_) {}
}
window._aioLoadOperatorNote = _aioLoadOperatorNote;

// P569/R260: this was defined 3 times in this file (v-baseline, v51.40, v51.43) — only the
// last definition below ever took effect (each `function` redeclaration + `window.x =`
// silently overwrote the previous one), so the two earlier ~25-line copies were fully dead:
// any future fix applied to them would compile fine and have zero effect. Removed rather than
// left as unreachable code.
// v51.43: concise first-screen operator note renderer.
function _aioRenderOperatorNote() {
  var el = document.getElementById('home-operator-note');
  if (!el) return;
  var note = window._aioOperatorNote;
  if (!note || note.visible === false || _aioIsOperatorNotePlaceholder(note)) { el.style.display = 'none'; return; }
  function _esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _isPlaceholderTag(t) {
    var text = String(t || '').trim();
    return !text || /^(sample|placeholder|tag)\d*$/i.test(text) || /placeholder|예시|작성|샘플/i.test(text);
  }
  var tags = (Array.isArray(note.tags) ? note.tags : []).filter(function(t) {
    return !_isPlaceholderTag(t);
  }).map(function(t) {
    return '<span class="aio-operator-note-tag">' + _esc(t) + '</span>';
  }).join('');
  var bodyText = String(note.body || '').trim();
  var normalizedBody = bodyText.replace(/\s+/g, ' ');
  var firstStop = normalizedBody.search(/[.!?。！？]|다\.|요\.|음\./);
  var leadText = firstStop > 40 ? normalizedBody.slice(0, firstStop + 1) : normalizedBody.slice(0, 220);
  var restText = normalizedBody.slice(leadText.length).trim();
  if (!restText && bodyText.length > leadText.length) restText = bodyText.slice(leadText.length).trim();
  var bodyHtml = _esc(restText || bodyText).replace(/\n/g, '<br>');
  // v52.14 P6/P614: 홈 최상단 고정 노트가 며칠 경과했는지 안 보이던 문제 — 기존 _aioStaleDaysLabel
  // 헬퍼(jensen-interview-stale-days 등과 동일 계산 로직) 재사용해 경과일 배지 추가.
  var staleInfo = (typeof window._aioStaleDaysLabel === 'function')
    ? window._aioStaleDaysLabel(note.updated, { warnDays: 3, staleDays: 7 })
    : { text: '', color: 'var(--text-muted)' };
  var staleHtml = staleInfo.text
    ? ' <span class="aio-operator-note-stale-days" id="home-operator-note-stale-days" style="color:' + staleInfo.color + ';font-weight:600;">' + _esc(staleInfo.text) + '</span>'
    : '';
  el.innerHTML =
    '<div class="aio-operator-note-card aio-operator-note-priority">' +
      '<div class="aio-operator-note-meta">' +
        '<span class="aio-operator-note-kicker">운영자 노트</span>' +
        '<span class="aio-operator-note-date">' + _esc(note.updated || '') + '</span>' + staleHtml +
      '</div>' +
      '<div class="aio-operator-note-title">' + _esc(note.title || '') + '</div>' +
      (leadText ? '<div class="aio-operator-note-lead">' + _esc(leadText) + '</div>' : '') +
      (restText
        ? '<details class="aio-operator-note-more"><summary>전체 메모 보기</summary><div class="aio-operator-note-body">' + bodyHtml + '</div></details>'
        : '<div class="aio-operator-note-body">' + bodyHtml + '</div>') +
      (tags ? '<div class="aio-operator-note-tags">' + tags + '</div>' : '') +
    '</div>';
  el.style.display = 'block';
}
window._aioRenderOperatorNote = _aioRenderOperatorNote;

// v52.90/P705: 뉴스 본문과 헤더 요약은 같은 items/meta를 단일 경로로 반영한다.
// 서버 백스톱이 피드만 채우고 감성·24h·상태는 "수신 대기"로 남던 분리 상태를 방지한다.
function _aioUpdateNewsSummaryFromItems(items, meta) {
  try {
    var rows = Array.isArray(items) ? items : [];
    var info = meta || {};
    var ns = computeNewsSentimentScore(rows);
    var scoreEl = document.getElementById('news-sent-score');
    var labelEl = document.getElementById('news-sent-label');
    if (scoreEl) {
      scoreEl.textContent = rows.length ? ns.score : '—';
      scoreEl.style.color = ns.score > 55 ? 'var(--data-green)' : ns.score < 45 ? 'var(--data-red)' : 'var(--text-primary)';
    }
    if (labelEl) labelEl.textContent = rows.length ? ns.label + ' (' + ns.bullCount + '↑ ' + ns.bearCount + '↓)' : '뉴스 없음';

    var recent = typeof filterByAge === 'function' ? filterByAge(rows, 24) : rows;
    var countEl = document.getElementById('news-24h-count');
    var srcEl = document.getElementById('news-24h-sources');
    if (countEl) countEl.textContent = recent.length + '건';
    if (srcEl) srcEl.textContent = new Set(recent.map(function(i) { return i && i.source || '출처 미상'; })).size + '개 소스';

    var risks = computeNewsRiskSignals(rows);
    var riskCntEl = document.getElementById('news-risk-count');
    var riskLblEl = document.getElementById('news-risk-label');
    if (riskCntEl) {
      riskCntEl.textContent = risks.length;
      riskCntEl.style.color = risks.length >= 3 ? 'var(--data-red)' : risks.length >= 1 ? 'var(--text-primary)' : 'var(--data-green)';
    }
    if (riskLblEl) riskLblEl.textContent = risks.length ? risks.map(function(r) { return r.label; }).join(' · ') : '리스크 없음';

    var asOf = info.generatedAt ? new Date(info.generatedAt) : new Date();
    if (isNaN(asOf.getTime())) asOf = new Date();
    var timeText = asOf.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    var kindLabel = info.kind === 'server-cache' ? '서버 캐시' : info.kind === 'idb-cache' ? '기기 캐시' : '직접 수집';
    var ftEl = document.getElementById('last-fetch-time');
    if (ftEl) ftEl.textContent = kindLabel + ' ' + timeText;
    var sl = document.getElementById('news-sources-label');
    if (sl) sl.textContent = rows.length + '건 · ' + kindLabel + ' · 기준 ' + timeText;
    return ns;
  } catch (e) {
    if (typeof _aioLog === 'function') _aioLog('warn', 'render', '뉴스 요약 동기화 실패: ' + (e && e.message || e));
    return null;
  }
}
window._aioUpdateNewsSummaryFromItems = _aioUpdateNewsSummaryFromItems;

function _aioApplyNewsBackstop(force) {
  try {
    var bs = window._serverNewsBackstop;
    if (!Array.isArray(bs) || !bs.length) return false;
    var clientEmpty = (!Array.isArray(window._allNewsItems) || window._allNewsItems.length === 0) &&
                      (typeof newsCache === 'undefined' || !newsCache || newsCache.length === 0);
    if (!force && !clientEmpty) return false; // 자체 뉴스가 있으면 손대지 않음
    var nowIso = new Date().toISOString();
    var serverMeta = window._serverDataMeta || {};
    var items = bs.map(function(n) {
      var it = {
        title: n.title, headline: n.title,
        link: n.link, url: n.link,
        source: n.source || 'News', feed: n.source || 'News',
        pubDate: n.pubDate || nowIso,
        desc: n.desc || n.description || '',
        summary: n.summary || n.ko_summary || '',
        country: n.country || 'us',
        selectionReason: n.selectionReason || '',
        topic: n.topic || '',
        sentiment: n.sentiment || '',
        tier: n.tier,
        score: n.score,
        _scoreReasons: Array.isArray(n._scoreReasons) ? n._scoreReasons.slice() : (Array.isArray(n.scoreReasons) ? n.scoreReasons.slice() : []),
        newsCyclePolicy: n.newsCyclePolicy || serverMeta.newsCyclePolicy || 'kst-0800-completed-24h',
        newsCycleStart: n.newsCycleStart || serverMeta.newsCycleStart || null,
        newsCycleEnd: n.newsCycleEnd || serverMeta.newsCycleEnd || null,
        serverGeneratedAt: n.generatedAt || serverMeta.generatedAt || null,
        ko_title: n.ko_title || '',
        ko_summary: n.ko_summary || '',
        ko_rewrite: n.ko_rewrite || '',
        ko_section: n.ko_section || '',
        ko_market: n.ko_market || '',
        _serverBackstop: true
      };
      try {
        it.score = isFinite(Number(n.score)) ? Number(n.score) : ((typeof scoreItem === 'function') ? scoreItem(it) : 50);
      } catch(_) { it.score = isFinite(Number(n.score)) ? Number(n.score) : 50; }
      // 서버 topic이 있으면 우선 사용, 없으면 classifyTopic fallback
      if (!it.topic) {
        try { it.topic = (typeof classifyTopic === 'function') ? classifyTopic(it) : 'general'; } catch(_) { it.topic = 'general'; }
      }
      try { it.flag = (typeof getCountryFlag === 'function') ? getCountryFlag(it.country) : ''; } catch(_) {}
      return it;
    });
    items.sort(function(a, b) { return (new Date(b.pubDate || 0)) - (new Date(a.pubDate || 0)); });
    newsCache = items;
    window._allNewsItems = items;
    _aioNotifyNewsSurfaceInvalidated('news-server-cache');
    if (typeof renderHomeFeed === 'function') renderHomeFeed(items);
    if (typeof renderBriefingFeed === 'function') renderBriefingFeed(items);
    _aioUpdateNewsSummaryFromItems(items, { kind: 'server-cache', generatedAt: serverMeta.generatedAt || null });
    window._newsBackstopApplied = { count: items.length, at: Date.now() };
    if (typeof _aioLog === 'function') _aioLog('info', 'data', 'server 뉴스 백스톱 적용: ' + items.length + '건 (클라이언트 뉴스 부재)');
    // 뉴스 캐시 타임스탬프 + 스테일 배너
    try {
      var _meta = window._serverDataMeta;
      var _ageMin = _meta && _meta.ageMin != null ? _meta.ageMin : null;
      var _genAt = _meta && _meta.generatedAt ? new Date(_meta.generatedAt) : null;
      var _cacheTs = document.getElementById('news-cache-ts');
      if (_cacheTs) _cacheTs.textContent = _genAt ? _genAt.toLocaleString('ko-KR', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) + ' (서버 캐시)' : '서버 캐시';
      var _staleBanner = document.getElementById('news-stale-banner');
      if (_staleBanner) {
        if (_ageMin != null && _ageMin > 60) {
          var _ageStr = _ageMin >= 120 ? Math.round(_ageMin / 60) + '시간' : _ageMin + '분';
          var _ageEl = document.getElementById('news-stale-age');
          if (_ageEl) _ageEl.textContent = _ageStr;
          _staleBanner.style.display = 'flex';
        } else {
          _staleBanner.style.display = 'none';
        }
      }
    } catch (_sb) {}
    return true;
  } catch (e) {
    if (typeof _aioLog === 'function') _aioLog('warn', 'data', '뉴스 백스톱 적용 실패: ' + (e && e.message || e));
    return false;
  }
}
window._aioApplyNewsBackstop = _aioApplyNewsBackstop;
// 부팅 12초 후 — 클라이언트 뉴스가 끝내 비었으면(프록시 전멸) 서버 백스톱으로 채움
if (typeof window !== 'undefined') {
  setTimeout(function() { try { _aioApplyNewsBackstop(false); } catch(_) {} }, 12000);
}

// v50.24/WO-4: 서버 데이터 나이를 topbar 배지로 표면화 — 사용자가 "지금 보는 데이터가 N분 전 것"을
// 항상 알 수 있게. 60분+ amber, 180분+ red. ageMin은 _serverDataMeta.generatedAt 기준으로 매번 재계산
// (배지 갱신 타이머가 1분마다 호출해도 나이가 정확히 카운트업되도록).
function _aioRenderServerDataAge() {
  try {
    var el = document.getElementById('server-data-age');
    if (!el) return;
    var meta = window._serverDataMeta;
    if (!meta || !meta.generatedAt) { el.style.display = 'none'; return; }
    var age = Math.max(0, Math.round((Date.now() - new Date(meta.generatedAt).getTime()) / 60000));
    // KST 시각 포맷 (UTC+9)
    var d = new Date(new Date(meta.generatedAt).getTime() + 9 * 3600000);
    var kst = (d.getUTCMonth()+1) + '-' + String(d.getUTCDate()).padStart(2,'0')
            + ' ' + String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0') + ' KST';
    var txt, cls, title;
    if (age < 60)       { txt = '🟢 ' + kst + ' 갱신'; cls = 'fb-live';   title = '서버(GitHub Actions)가 ' + age + '분 전 수집한 데이터 — 신선\n' + kst + ' | 시세 ' + (meta.symbolsOk||'?') + '개'; }
    else if (age < 180) { txt = '🟡 ' + kst + ' 갱신'; cls = 'fb-static'; title = '서버 데이터 ' + age + '분 경과 (자동 갱신 대기)\n' + kst + ' | 시세 ' + (meta.symbolsOk||'?') + '개'; }
    else {
      var h = Math.floor(age / 60);
      txt = '🔴 ' + kst + ' (' + h + 'h 전)'; cls = 'fb-stale';
      title = '서버 데이터 ' + h + '시간 경과 — GitHub Actions cron이 지연/중단됐을 수 있음\n' + kst;
    }
    el.textContent = txt;
    el.className = 'freshness-badge ' + cls;
    el.style.display = '';
    el.title = title;
    el.setAttribute('data-server-age-min', String(age));
    if (typeof _aioSchedulePublicReadiness === 'function') _aioSchedulePublicReadiness(250);
  } catch(_) {}
}
window._aioRenderServerDataAge = _aioRenderServerDataAge;

// v51.65: 파이프라인 상태 배너 — marketAnalysisOk/fmpOk/fredOk 기반으로 경고 표시
// 이슈가 없으면 숨김 유지 (R234 — 기본값 hidden)
function _aioRenderPipelineStatus() {
  try {
    var bar = document.getElementById('aio-pipeline-status-bar');
    if (!bar) return;
    var meta = window._serverDataMeta;
    if (!meta) { bar.style.display = 'none'; return; }

    var msgs = [];
    if (meta.marketAnalysisOk === false) {
      msgs.push({ icon: '🤖', text: 'AI 시장 분석 비활성', detail: 'GitHub Secrets → ANTHROPIC_API_KEY 등록 시 자동 활성화', color: '#f59e0b' });
    }
    if (meta.fmpHasKey && meta.fmpOk === false && Number(meta.fundamentalCoveragePct || 0) < 80) {
      var fmpDetail = '유료 FMP는 사용하지 않음 · 무료 SEC companyfacts 누적 커버리지 ' + Number(meta.fundamentalCoveragePct || 0).toFixed(1) + '%';
      msgs.push({ icon: '📊', text: '재무 팩터 축소 모드', detail: fmpDetail, color: '#ef4444' });
    }
    if (!meta.fredHasKey) {
      msgs.push({ icon: '🏦', text: 'FRED 매크로 서버갱신 비활성', detail: 'GitHub Secrets → FRED_API_KEY 등록 시 자동 활성화 (클라이언트 키로 대체 가능)', color: '#94a3b8' });
    }
    if (meta.fredHasKey && meta.fredFetchOk === false) {
      msgs.push({ icon: '🏦', text: 'FRED 매크로 수집 실패', detail: 'FRED_API_KEY 등록됨 → API 오류 또는 레이트리밋. 키 유효성 확인', color: '#ef4444' });
    }

    var reconciliation = meta.reconciliation || null;
    if (!reconciliation || reconciliation.status === 'unavailable') {
      msgs.push({ icon: '!', text: '데이터 범주 상태 미수신', detail: '22개 데이터 범주의 자동 조정 상태를 불러오지 못했습니다.', color: '#ef4444' });
    } else if (reconciliation.status === 'stale') {
      msgs.push({ icon: '!', text: '데이터 범주 상태 불일치', detail: '현재 시장 스냅샷과 조정 상태의 revision이 다릅니다.', color: '#ef4444' });
    } else if (Array.isArray(reconciliation.runtimeBlockedCategories) && reconciliation.runtimeBlockedCategories.length) {
      msgs.push({
        icon: '!',
        text: '자동 데이터 경로 차단 ' + reconciliation.runtimeBlockedCategories.length + '건',
        detail: reconciliation.runtimeBlockedCategories.slice(0, 6).join(', '),
        color: '#ef4444'
      });
    }

    if (msgs.length === 0) { bar.style.display = 'none'; return; }

    var html = msgs.map(function(m) {
      return '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(0,0,0,0.25);border-left:2px solid ' + m.color + ';padding:3px 8px;border-radius:3px;font-size:10px;" title="' + m.detail.replace(/"/g,'&quot;') + '">'
           + m.icon + ' <b>' + m.text + '</b>'
           + ' <span style="color:var(--text-muted);font-size:10px;">' + m.detail + '</span>'
           + '</span>';
    }).join('');

    bar.innerHTML = html;
    bar.style.display = 'flex';

    // 스크리너 페이지 FMP 상태 인라인 노트 업데이트
    var scrFmpEl = document.getElementById('screener-fmp-status');
    var scrFmpReason = document.getElementById('screener-fmp-reason');
    if (scrFmpEl && meta.fmpHasKey != null) {
      if (meta.fmpHasKey && meta.fmpOk === false) {
        scrFmpEl.style.display = 'inline-flex';
        if (scrFmpReason) scrFmpReason.textContent = '유료 플랜 미사용 · 무료 SEC companyfacts ' + Number(meta.fundamentalCoveragePct || 0).toFixed(1) + '% 누적';
      } else if (!meta.fmpHasKey) {
        scrFmpEl.style.display = 'inline-flex';
        if (scrFmpReason) scrFmpReason.textContent = Number(meta.fundamentalCoveragePct || 0) >= 80 ? '무료 SEC 재무 팩터 사용' : '무료 SEC 재무 데이터 누적 중 (가격 팩터 모드)';
      } else {
        scrFmpEl.style.display = 'none';
      }
    }
    if (typeof _aioSchedulePublicReadiness === 'function') _aioSchedulePublicReadiness(250);
  } catch(_) {}
}
window._aioRenderPipelineStatus = _aioRenderPipelineStatus;

function _aioPublicReadinessEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _aioKstShortFromIso(iso) {
  if (!iso) return '미수신';
  var t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return String(iso).slice(0, 16);
  var d = new Date(t + 9 * 3600000);
  return String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0') + ' ' +
    String(d.getUTCHours()).padStart(2, '0') + ':' +
    String(d.getUTCMinutes()).padStart(2, '0') + ' KST';
}

function _aioPublicReadinessSourceText(kind, label) {
  var normalized = String(kind || label || '').toUpperCase();
  var map = {
    LIVE: '실시간',
    DELAYED: '지연 수신',
    SNAPSHOT: '스냅샷',
    REFERENCE: '참고 자료',
    UNAVAILABLE: '미수신'
  };
  return map[normalized] || '상태 확인 중';
}

function _aioPublicReadinessPageText(pageId) {
  var map = {
    home: '대시보드',
    signal: '매매 시그널',
    breadth: '시장 폭',
    sentiment: '투자 심리',
    briefing: '오늘의 브리핑',
    technical: '차트/기술',
    macro: '거시경제',
    fxbond: '환율/채권',
    fundamental: '기업 분석',
    themes: '테마/트렌드',
    'theme-detail': '테마 상세',
    ticker: '종목 분석',
    portfolio: '포트폴리오',
    'market-news': '시장 뉴스',
    screener: '퀀트 스크리너',
    options: '옵션',
    guide: '사용 설명서',
    glossary: '용어 사전',
    mindset: '투자 마인드'
  };
  return map[pageId] || '페이지';
}

function _aioBuildPublicShareReadiness(opts) {
  opts = opts || {};
  var detailed = opts.full === true || !!(window.AIO && window.AIO.isDetailedAuditMode && window.AIO.isDetailedAuditMode());
  var version = (typeof APP_VERSION === 'string' ? APP_VERSION : (window.AIO && window.AIO.version) || '');
  var meta = window._serverDataMeta || null;
  var pageAudit = null;
  var pipelineAudit = null;
  var shareAudit = null;
  if (detailed) {
    try { pageAudit = window.AIO && window.AIO.getPageEvidenceCurrentnessAudit ? window.AIO.getPageEvidenceCurrentnessAudit() : null; } catch(_) {}
    try { pipelineAudit = window.AIO && window.AIO.getDataPipelineAudit ? window.AIO.getDataPipelineAudit() : null; } catch(_) {}
    try { shareAudit = window.AIO && window.AIO.getShareReadinessAudit ? window.AIO.getShareReadinessAudit({ skipEssence: true }) : null; } catch(_) {}
  } else {
    // Public boot must never execute deployment/share audits. Build the visible home status
    // from already-materialized evidence and server metadata; CI/dev mode owns full scans.
    var activePage = document.querySelector('.page.active');
    var activeId = activePage && String(activePage.id || '').replace(/^page-/, '') || 'home';
    var activeEvidence = null;
    try { activeEvidence = window.AIO && window.AIO.getPageEvidenceState ? window.AIO.getPageEvidenceState(activeId) : null; } catch(_) {}
    if (activeEvidence) {
      pageAudit = {
        status: activeEvidence.caveat ? 'pass' : 'warn',
        pageCount: 1,
        missingCaveat: activeEvidence.caveat ? [] : [activeId],
        liveOverstatement: [],
        rows: [Object.assign({ pageId: activeId }, activeEvidence)]
      };
    }
    pipelineAudit = {
      status: meta && meta.generatedAt ? 'ok' : 'warn',
      issues: meta && meta.generatedAt ? [] : ['public-data metadata pending']
    };
  }

  var blockers = [];
  var warnings = [];
  var ageMin = null;
  if (meta && meta.generatedAt) {
    ageMin = Math.max(0, Math.round((Date.now() - new Date(meta.generatedAt).getTime()) / 60000));
    if (ageMin > 360) blockers.push('public-data가 6시간 이상 지연');
    else if (ageMin > 180) warnings.push('public-data가 3시간 이상 지연');
  } else {
    warnings.push('public-data 기준 시각 미수신');
  }
  if (!pageAudit) warnings.push('페이지 현재성 감사 미수신');
  else if (pageAudit.status !== 'pass') warnings.push('페이지 현재성 주의: ' + (pageAudit.missingCaveat || []).slice(0, 3).join(', '));
  if (!pipelineAudit) warnings.push('데이터 파이프라인 감사 미수신');
  else if (pipelineAudit.status !== 'ok') warnings.push('데이터 파이프라인 주의: ' + (pipelineAudit.issues || []).slice(0, 2).join(' / '));
  // v52.14 P6/P611/R206: shareAudit.blockers는 "full surface audit fail: N issue(s)" 같은 영문 내부
  // 감사 로그 원문 — 일반 방문자에게 노출하면 무의미+불안만 유발(R206 dev-marker 금지 취지). 건수만 한국어로 요약.
  var reconciliation = meta && meta.reconciliation;
  if (!reconciliation || reconciliation.status === 'unavailable') warnings.push('22개 데이터 범주 상태 미수신');
  else if (reconciliation.status === 'stale') blockers.push('시장 스냅샷과 데이터 범주 상태 revision 불일치');
  else {
    var runtimeBlocked = Array.isArray(reconciliation.runtimeBlockedCategories) ? reconciliation.runtimeBlockedCategories : [];
    var partialCategories = Array.isArray(reconciliation.partialCategories) ? reconciliation.partialCategories : [];
    if (runtimeBlocked.length) blockers.push('자동 데이터 경로 차단 ' + runtimeBlocked.length + '건: ' + runtimeBlocked.slice(0, 4).join(', '));
    if (partialCategories.length) warnings.push('부분 조정 데이터 범주 ' + partialCategories.length + '건');
  }
  if (shareAudit && shareAudit.blockers && shareAudit.blockers.length) {
    blockers.push('배포 전 점검 항목 ' + shareAudit.blockers.length + '건 확인 필요');
  } else if (shareAudit && shareAudit.warnings && shareAudit.warnings.length) {
    warnings.push('공유 readiness 경고 ' + shareAudit.warnings.length + '건');
  }

  var pageRows = pageAudit && Array.isArray(pageAudit.rows) ? pageAudit.rows.slice() : [];
  var sourceRank = { LIVE: 5, DELAYED: 4, SNAPSHOT: 3, REFERENCE: 2, UNAVAILABLE: 1 };
  var pageEvidenceRows = pageRows.map(function(r) {
    var kind = String(r.sourceKind || 'SNAPSHOT').toUpperCase();
    return {
      pageId: r.pageId || '',
      sourceKind: kind,
      sourceLabel: r.sourceLabel || kind,
      asOf: r.asOf || '',
      confidence: r.confidence || '',
      caveat: r.caveat || '',
      liveDom: r.liveDom || 0,
      snapshotDom: r.snapshotDom || 0,
      referenceDom: r.referenceDom || 0,
      unavailableDom: r.unavailableDom || 0,
      blockers: r.blockers || [],
      rank: sourceRank[kind] || 0
    };
  }).sort(function(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return String(a.pageId).localeCompare(String(b.pageId));
  });
  var weakPages = pageEvidenceRows.filter(function(r) {
    return r.sourceKind === 'UNAVAILABLE' || r.sourceKind === 'REFERENCE' || (r.blockers && r.blockers.length);
  }).map(function(r) { return r.pageId + ':' + r.sourceKind; });
  // v52.14 P6/P611/R206: 원문 "weak page evidence pageId:UNAVAILABLE, ..." 영문 enum 나열 대신 건수만 한국어 요약.
  if (weakPages.length) warnings.push('일부 페이지 데이터 근거 보강 필요 (' + weakPages.length + '건)');

  var status = blockers.length ? 'block' : (warnings.length ? 'warn' : 'ok');
  return {
    status: status,
    label: status === 'ok' ? '베타 공유 가능' : (status === 'warn' ? '주의 후 공유' : '공개 전 차단'),
    version: version || 'unknown',
    dataLabel: meta && meta.generatedAt ? _aioKstShortFromIso(meta.generatedAt) + (ageMin != null ? ' · ' + ageMin + '분 전' : '') : 'public-data 미수신',
    dataStatus: meta && meta.newsOk === false ? '뉴스 백스톱 주의' : (meta && meta.symbolsOk ? '서버 스냅샷 시세 ' + meta.symbolsOk + '개 수신' : '수신 상태 확인 중'),
    pageStatus: pageAudit ? (pageAudit.status === 'pass' ? pageAudit.pageCount + '개 페이지 현재성 통과' : '현재성 주의 ' + ((pageAudit.missingCaveat || []).length + (pageAudit.liveOverstatement || []).length) + '건') : '페이지 감사 대기',
    pipelineStatus: pipelineAudit ? (pipelineAudit.status === 'ok' ? '파이프라인 OK' : '파이프라인 WARN') : '파이프라인 감사 대기',
    pageEvidenceRows: pageEvidenceRows,
    weakPages: weakPages,
    blockers: blockers,
    warnings: warnings,
    generatedAt: new Date().toISOString(),
    auditMode: detailed ? 'detailed' : 'runtime'
  };
}
window._aioBuildPublicShareReadiness = _aioBuildPublicShareReadiness;
window.AIO = window.AIO || {};
window.AIO.getPublicShareReadiness = function(opts) {
  return _aioBuildPublicShareReadiness(Object.assign({ full: true }, opts || {}));
};
window.AIO.getServerMarketAnalysis = function() {
  var m = window._serverMarketAnalysis || null;
  return m ? {
    ready: true,
    oneLine: m.oneLine || '',
    fullLength: String(m.full || '').length,
    generatedAt: m.generatedAt || '',
    source: m.source || 'server'
  } : { ready: false };
};
window.AIO.getDataReconciliationStatus = function() {
  var value = window._serverDataMeta && window._serverDataMeta.reconciliation;
  return value ? JSON.parse(JSON.stringify(value)) : { status:'unavailable', checkedAt:Date.now() };
};

function _aioRenderPublicReadiness() {
  try {
    var el = document.getElementById('aio-public-readiness');
    if (!el) return;
    // v52.87 P702: 운영/배포 진단은 개발자 모드 전용이다. 일반 투자 화면에는 렌더하지 않는다.
    if (!document.body || !document.body.classList.contains('aio-dev-mode')) {
      el.style.removeProperty('display');
      return;
    }
    var activePage = document.querySelector('.page.active');
    if (activePage && activePage.id !== 'page-home') return;
    var m = _aioBuildPublicShareReadiness({ full: false });
    var issues = (m.blockers || []).concat(m.warnings || []).slice(0, 4);
    var rows = (m.pageEvidenceRows || []).slice(0, 8);
    var sourceHtml = rows.length ? (
      '<div class="aio-public-readiness-pages" aria-label="Page source and asOf matrix">' +
        rows.map(function(r) {
          return '<span class="aio-public-page-source is-' + _aioPublicReadinessEsc(String(r.sourceKind || '').toLowerCase()) + '">' +
            '<b>' + _aioPublicReadinessEsc(_aioPublicReadinessPageText(r.pageId)) + '</b>' +
            '<em>' + _aioPublicReadinessEsc(_aioPublicReadinessSourceText(r.sourceKind, r.sourceLabel)) + '</em>' +
            '<small>' + _aioPublicReadinessEsc(r.asOf || '시각 확인 중') + '</small>' +
          '</span>';
        }).join('') +
      '</div>'
    ) : '';
    el.className = 'aio-public-readiness is-' + m.status;
    el.innerHTML =
      '<div class="aio-public-readiness-main">' +
        '<div class="aio-public-readiness-kicker">Public Status</div>' +
        '<div class="aio-public-readiness-label">' + _aioPublicReadinessEsc(m.label) + '</div>' +
        '<span>투자 판단 전 데이터 기준 시각과 source 상태를 확인하세요.</span>' +
      '</div>' +
      '<div class="aio-public-readiness-card"><b>버전</b><span id="aio-public-readiness-version">' + _aioPublicReadinessEsc(m.version) + '</span></div>' +
      '<div class="aio-public-readiness-card"><b>데이터</b><span>' + _aioPublicReadinessEsc(m.dataLabel) + '<br>' + _aioPublicReadinessEsc(m.dataStatus) + '</span></div>' +
      '<div class="aio-public-readiness-card"><b>현재성</b><span>' + _aioPublicReadinessEsc(m.pageStatus) + '<br>' + _aioPublicReadinessEsc(m.pipelineStatus) + '</span></div>' +
      sourceHtml +
      (issues.length ? '<div class="aio-public-readiness-issues">' + issues.map(_aioPublicReadinessEsc).join(' · ') + '</div>' : '');
    el.style.display = 'grid';
  } catch(_) {}
}
window._aioRenderPublicReadiness = _aioRenderPublicReadiness;
var _aioPublicReadinessTimer = 0;
function _aioSchedulePublicReadiness(delay) {
  clearTimeout(_aioPublicReadinessTimer);
  _aioPublicReadinessTimer = setTimeout(function() {
    _aioPublicReadinessTimer = 0;
    _aioRenderPublicReadiness();
  }, Math.max(0, Number(delay) || 0));
}
window._aioSchedulePublicReadiness = _aioSchedulePublicReadiness;
try {
  window.addEventListener('aio:liveQuotes', function() { _aioSchedulePublicReadiness(250); });
  window.addEventListener('aio:pageShown', function(e) {
    var pageId = e && e.detail && e.detail.pageId;
    if (!pageId || pageId === 'home') _aioSchedulePublicReadiness(100);
  });
  _aioSchedulePublicReadiness(1500);
} catch(_) {}

// v50.24/WO-4: 부팅 후에도 탭을 열어두면 data.json을 30분마다 재로드 (boot-only 갭 해소).
// 배지 나이는 1분마다 재렌더(카운트업). 둘 다 _aioRegisterTimer로 등록(중복 방지·visibility pause 연계).
function _aioStartServerDataPolling() {
  try {
    if (typeof _aioRegisterTimer !== 'function') return;
    _aioRegisterTimer('serverDataReload', function() {
      _aioLoadServerData().catch(function(){});
    }, 30 * 60 * 1000);
    _aioRegisterTimer('serverDataAgeBadge', _aioRenderServerDataAge, 60 * 1000);
  } catch(_) {}
}
window._aioStartServerDataPolling = _aioStartServerDataPolling;

// ─────────────────────────────────────────────────────────────────────────
// v50.27/WO-7(소비자 데이터 레이어): public-data/history.json(서버가 일별 누적)을 읽어
// window._aioHistory에 캐시. 차트 소비자는 _aioHistorySeries(field, minPoints)로 충분한
// 누적(기본 20일+)이 있을 때만 실데이터 배열을 받고, 부족하면 null → 기존 시드 폴백 유지.
// (실제 차트 재배선은 데이터가 충분히 쌓인 뒤 — 1일치로는 단일점이라 시각 검증 불가. 지금은
//  데이터 접근 레이어 + 감사까지. 재배선은 _aioHistorySeries 소비처만 추가하면 됨.)
// ─────────────────────────────────────────────────────────────────────────
async function _aioLoadHistory() {
  try {
    var url = './public-data/history.json?t=' + Math.floor(Date.now() / 3600000); // 시간 단위 캐시버스터
    var r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return null;
    var arr = await r.json();
    if (!Array.isArray(arr)) return null;
    window._aioHistory = arr;
    window._aioHistoryMeta = { days: arr.length, first: arr[0] && arr[0].date, last: arr[arr.length - 1] && arr[arr.length - 1].date, loadedAt: Date.now() };
    try { window.dispatchEvent(new CustomEvent('aio:historyLoaded', { detail: window._aioHistoryMeta })); } catch(_) {}
    if (typeof _aioLog === 'function') _aioLog('info', 'data', 'history.json 로드: ' + arr.length + '일');
    return arr;
  } catch (e) { return null; }
}
window._aioLoadHistory = _aioLoadHistory;

// field별 [{date, value, observedAt, source}] 시계열 — date는 기존 차트 호환용
// bucket이고, fieldMeta.observedAt/source가 실제 관측 provenance다.
function _aioHistorySeries(field, minPoints) {
  try {
    var arr = window._aioHistory;
    if (!Array.isArray(arr) || !arr.length) return null;
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i] && arr[i][field];
      if (typeof v === 'number' && isFinite(v)) {
        var meta = arr[i] && arr[i].fieldMeta && arr[i].fieldMeta[field] || {};
        out.push({ date: arr[i].date, value: v, observedAt: meta.observedAt || null, source: meta.source || null, sourceKind: meta.sourceKind || null });
      }
    }
    return out.length >= (minPoints || 20) ? out : null;
  } catch (e) { return null; }
}
window._aioHistorySeries = _aioHistorySeries;

// 히스토리 데이터 가용성 감사 (소비자 준비 상태)
window.AIO = window.AIO || {};
window.AIO.getHistoryDataAudit = function() {
  var arr = window._aioHistory;
  var fields = ['spx', 'vix', 'fg', 'tnx', 'dxy', 'wti', 'gold', 'kospi', 'btc'];
  var coverage = {};
  fields.forEach(function(f) {
    var s = _aioHistorySeries(f, 1);
    coverage[f] = s ? s.length : 0;
  });
  var days = Array.isArray(arr) ? arr.length : 0;
  return {
    status: days > 0 ? 'ok' : 'pending',
    days: days,
    chartReady: days >= 20,          // 차트 소비 전환 임계(시드→실데이터)
    range: window._aioHistoryMeta ? (window._aioHistoryMeta.first + '~' + window._aioHistoryMeta.last) : null,
    fieldCoverage: coverage,
    note: days >= 20 ? '실데이터 차트 전환 가능' : (days + '일 누적 — 20일+ 시 시드 대신 자체 데이터 사용'),
    generatedAt: new Date().toISOString()
  };
};

// P858: phase state stays in one boot-coordinator object so the legacy surface
// does not grow additional window-owned write points for a timing concern.
var _aioBootPhase = (typeof window !== 'undefined' && window._aioBootPhase) || {
  quoteReady: false,
  translationReady: false
};

async function initV20DataEngine() {
  // The boot coordinator is the sole owner of the first live-data fetch.
  // Page-on-enter refreshes must not race it with a second provider fan-out.
  _aioBootPhase.quoteReady = false;
  // P858: translation is deliberately outside the 0-2s interactive boot
  // budget. Source-language/local fallback text remains visible until this
  // enrichment phase is released.
  _aioBootPhase.translationReady = false;
  console.log('[AIO v20] ═══════════════════════════════════════');
  console.log('[AIO v20] Data Engine v20 초기화 시작');
  // v50.23: 서버 데이터(data.json) 먼저 적용 — 프록시 실패와 무관하게 즉시 신선한 화면
  try { await _aioLoadServerData(); } catch(_) {}
  // v50.24/WO-4: 30분 주기 재로드 + 1분 나이 배지 갱신 시작 (boot-only 갭 해소)
  try { _aioStartServerDataPolling(); } catch(_) {}
  // v50.27/WO-7: 일별 히스토리 로드(차트 소비자 데이터 레이어, 충분히 누적 시 시드 대체)
  try { _aioLoadHistory(); } catch(_) {}
  try { _aioLoadOperatorNote(); } catch(_) {}
  console.log('[AIO v20] ═══════════════════════════════════════');

  cleanupProxyCache();

  // Phase 1: Immediate (0-2s) — Show cached/fallback data
  if (typeof applyStaticFallbacks === 'function') applyStaticFallbacks();

  // Phase 1b: IDB 캐시 뉴스 즉시 렌더 (fetchAllNews 완료 전 공백 제거)
  _idbLoadNews().then(function(cached) {
    if (cached && cached.length > 0 && newsCache.length === 0) {
      newsCache = cached;
      window._allNewsItems = cached;
      _aioNotifyNewsSurfaceInvalidated('news-idb-cache');
      if (typeof renderHomeFeed === 'function') renderHomeFeed(newsCache);
      if (typeof renderBriefingFeed === 'function') renderBriefingFeed(newsCache);
      if (typeof _aioUpdateNewsSummaryFromItems === 'function') _aioUpdateNewsSummaryFromItems(newsCache, { kind: 'idb-cache' });
      _aioLog('info', 'idb', 'IDB 캐시 뉴스 즉시 렌더: ' + cached.length + '건');
    }
  }).catch(function() {});

  // Phase 2: Fast APIs (2-5s) — CoinGecko, Exchange Rate, and live quote rescue.
  // P858: the previous 500ms timer contradicted this phase boundary and pushed
  // every provider into the boot request window. Keep snapshot/server data as
  // the first paint source, then start external quote work after the 2s boot
  // budget so request and long-task SLOs measure the actual interactive boot.
  _aioBootPhase.quoteReady = false;
  setTimeout(function() {
    _aioBootPhase.translationReady = true;
    _aioReleaseDeferredNewsTranslation();
  }, 2300);
  setTimeout(async () => {
    try {
      _aioBootPhase.quoteReady = true;
      var architectureReady = window.__AIO_ARCH_RUNTIME__ && window.__AIO_ARCH_RUNTIME__.ready;
      if (architectureReady && typeof architectureReady.then === 'function') {
        await Promise.race([
          architectureReady,
          new Promise(function(resolve) { setTimeout(resolve, 8000); })
        ]);
      }
      if (typeof fetchLiveQuotes === 'function') await fetchLiveQuotes();
    }
    catch(e) { showDataError('시세', '실시간 시세 수신 실패 — 정적 데이터 사용 중', 'warn'); if(typeof _reportApiError==='function') _reportApiError('yahoo-quote','Phase2 실패'); }
  }, 2500);

  // Phase 3: Sentiment APIs (3-8s)
  setTimeout(async () => {
    try {
      if (typeof fetchFearGreed === 'function') await fetchFearGreed();
      if (typeof fetchPutCall === 'function') await fetchPutCall();
      if(typeof _reportApiOk==='function') _reportApiOk('fear-greed','Phase3 성공');
      if(typeof window._markFetch==='function') { window._markFetch('sentiment'); window._markFetch('fearGreed'); window._markFetch('putCall'); }
    } catch(e) { showDataError('심리지표', '공포탐욕/풋콜 수신 실패 — 정적 데이터 사용 중', 'warn'); if(typeof _reportApiError==='function') _reportApiError('fear-greed','Phase3 실패'); }
  }, 3000);

  // Phase 4: Heavy APIs (5-15s) — FRED, Breadth, News
  setTimeout(async () => {
    try {
      var fredResult = _aioServerMacroReady ? { source: 'server-artifact' } : await fetchAllFredData();
      if (_aioServerMacroReady || (fredResult && Object.keys(fredResult).length > 0)) {
        if(typeof _reportApiOk==='function') _reportApiOk('fred','FRED 로딩 성공');
        if(typeof window._markFetch==='function') window._markFetch('fred');
      } else {
        if(typeof _reportApiError==='function') _reportApiError('fred','FRED fallback/no key');
      }
    }
    catch(e) { showDataError('FRED', 'FRED 매크로 데이터 수신 실패', 'warn'); if(typeof _reportApiError==='function') _reportApiError('fred','FRED 실패'); }
    try {
      if (!_aioServerHyReady && typeof fetchHYSpread === 'function') await fetchHYSpread();
    } catch(e) { showDataError('HY OAS', 'HY 스프레드 수신 실패', 'warn'); }
    try { await fetchBreadthData(); if(typeof window._markFetch==='function') window._markFetch('breadth'); }
    catch(e) { showDataError('시장폭', 'Breadth 데이터 수신 실패', 'warn'); }
    try { await fetchSentimentHistory(); if(typeof _reportApiOk==='function') _reportApiOk('yahoo-chart','VIX 차트 성공'); if(typeof window._markFetch==='function') window._markFetch('vixHistory'); }
    catch(e) { showDataError('VIX', 'VIX 히스토리 수신 실패', 'warn'); if(typeof _reportApiError==='function') _reportApiError('yahoo-chart','VIX 차트 실패'); }
  }, 5000);

  // Phase 5: News & Content (8-20s)
  setTimeout(async () => {
    try { if (typeof fetchAllNews === 'function') await fetchAllNews(false); if(typeof _reportApiOk==='function') _reportApiOk('rss-news','뉴스 로딩 성공'); if(typeof window._markFetch==='function') window._markFetch('news'); }
    catch(e) { showDataError('뉴스', '뉴스 피드 수신 실패', 'warn'); if(typeof _reportApiError==='function') _reportApiError('rss-news','뉴스 실패'); }
  }, 8000);

  // Phase 6: WebSocket (if key available)
  setTimeout(() => { initFinnhubWebSocket(); }, 2000);

  // Phase 7: Start recurring scheduler
  setTimeout(() => { startDataScheduler(); }, 15000);

  // Phase 8: Data Health report (after all phases settle)
  setTimeout(() => {
    if (window.DataHealth) {
      console.log('[AIO] ═══ Data Pipeline Health Report ═══');
      DataHealth.log();
    }
  }, 20000);

  // Log API key status
  const keyStatus = API_KEY_CONFIG.map(k => {
    const val = localStorage.getItem(k.id);
    return `  ${k.label}: ${val ? '✓ 설정됨' : ' 미설정'}`;
  }).join('\n');
  console.log('[AIO v20] API Key Status:\n' + keyStatus);
}

const AIO_NEWS_SOURCES = [
  // ═══════════════════════════════════════════════════════════════════
  // v31.8: 미국 시장 중점 — 주요 외신 대폭 확장 (US 40+ 소스)
  // ═══════════════════════════════════════════════════════════════════

  // ═══ TIER 1: 🇺🇸 미국 주요 외신 (탑티어 — 최우선 노출) ═══
  {name:'Reuters Markets',     url:'https://rsshub.app/reuters/market',                           country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'CNBC Top News',       url:'https://www.cnbc.com/id/100003114/device/rss/rss.html',       country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'CNBC Investing',      url:'https://www.cnbc.com/id/15839069/device/rss/rss.html',        country:'us', tier:1, flag:'US', topics:['equity','earnings']},
  {name:'CNBC Economy',        url:'https://www.cnbc.com/id/20910258/device/rss/rss.html',        country:'us', tier:1, flag:'US', topics:['macro']},
  {name:'WSJ Markets',         url:'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',              country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'WSJ World',           url:'https://feeds.a.dj.com/rss/RSSWorldNews.xml',                country:'us', tier:1, flag:'US', topics:['geo','macro']},
  {name:'Bloomberg',           url:'https://feeds.bloomberg.com/markets/news.rss',                country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'MarketWatch',         url:'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines', country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'Barrons',             url:'https://www.barrons.com/feeds/articles/techtopstories.rss',   country:'us', tier:1, flag:'US', topics:['equity']},
  {name:'Yahoo Finance',       url:'https://finance.yahoo.com/news/rssindex',                    country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'Seeking Alpha',       url:'https://seekingalpha.com/market_currents.xml',                country:'us', tier:1, flag:'--', topics:['equity','earnings']},
  {name:'Investing.com',       url:'https://www.investing.com/rss/news.rss',                     country:'us', tier:1, flag:'--', topics:['macro','equity']},
  {name:'Benzinga Markets',    url:'https://www.benzinga.com/feed',                              country:'us', tier:1, flag:'US', topics:['equity','earnings']},
  {name:'S&P Global',          url:'https://www.spglobal.com/marketintelligence/en/rss-feed/all', country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'Nasdaq News',         url:'https://www.nasdaq.com/feed/rssoutbound?category=Markets',   country:'us', tier:1, flag:'US', topics:['equity','earnings']},
  {name:'Nasdaq Analyst',      url:'https://www.nasdaq.com/feed/rssoutbound?category=Analyst+Activity', country:'us', tier:1, flag:'US', topics:['analyst','equity']},
  {name:'CNN Business',        url:'https://rss.cnn.com/rss/money_latest.rss',                    country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'NYT Business',        url:'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',   country:'us', tier:1, flag:'US', topics:['macro']},
  {name:'FT Markets',          url:'https://www.ft.com/markets?format=rss',                      country:'eu', tier:1, flag:'UK', topics:['macro','equity']},
  {name:'BBC Business',        url:'https://feeds.bbci.co.uk/news/business/rss.xml',              country:'eu', tier:1, flag:'UK', topics:['macro']},
  {name:'The Economist Finance',url:'https://www.economist.com/finance-and-economics/rss.xml',    country:'eu', tier:1, flag:'UK', topics:['macro']},
  {name:'Google News Finance',  url:'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en', country:'us', tier:1, flag:'US', topics:['macro','equity']},
  // v42.9: Axios 추가 — 미국 정치·외교·정책 속보에 강한 주류 매체 (소식통 인용 비중 높아 isUnverifiedClaim 배지 자동 적용)
  {name:'Axios',               url:'https://api.axios.com/feed/',                                  country:'us', tier:1, flag:'US', topics:['macro','geo','policy']},
  // v48.16 (integrate 2026-04-18): Washington Post — 미국 주·연방 정책(DC 규제, 에너지 정책) 보강
  {name:'Washington Post Politics', url:'https://feeds.washingtonpost.com/rss/politics',             country:'us', tier:1, flag:'US', topics:['macro','policy','geo']},
  {name:'Washington Post Business', url:'https://feeds.washingtonpost.com/rss/business',             country:'us', tier:1, flag:'US', topics:['macro','equity']},

  // ═══ TIER 1: 텔레그램 큐레이션 채널 ═══
  {name:'TG Insider Tracking',       url:'https://rsshub.app/telegram/channel/insidertracking',       country:'us', tier:1, flag:'TG', topics:['macro','equity','semi','earnings','geo'], type:'telegram', tgSlug:'insidertracking', publicMirror:'https://t.me/s/insidertracking', pipelineRole:'us-fast-breaking'},  // v50.15: publicMirror 폴백(rsshub.app 불안정 시 t.me/s 공개프리뷰) + pipelineRole 명시
  {name:'TG BornLupin',              url:'https://rsshub.app/telegram/channel/bornlupin',             country:'us', tier:1, flag:'TG', topics:['macro','equity','semi','earnings'], type:'telegram', tgSlug:'bornlupin', publicMirror:'https://t.me/s/bornlupin', pipelineRole:'kr-semi-broker-notes'},  // v50.15: publicMirror 폴백 + pipelineRole(한국 반도체 sell-side 노트 집중)
  {name:'TG HANA China',             url:'https://rsshub.app/telegram/channel/HANAchina',            country:'cn', tier:1, flag:'TG', topics:['macro','equity','semi','power','optical','geo','japan','kr-market'], type:'telegram', tgSlug:'HANAchina', publicMirror:'https://t.me/s/HANAchina', pipelineRole:'china-em-supply-chain'},
  {name:'TG WalterBloomberg',       url:'https://rsshub.app/telegram/channel/walterbloomberg',       country:'us', tier:1, flag:'TG', topics:['macro','equity','earnings'],        type:'telegram', tgSlug:'walterbloomberg'},
  {name:'TG Aether Japan Research',  url:'https://rsshub.app/telegram/channel/aetherjapanresearch',   country:'jp', tier:1, flag:'TG', topics:['macro','equity','semi','geo','japan'], type:'telegram', tgSlug:'aetherjapanresearch', publicMirror:'https://t.me/s/aetherjapanresearch', pipelineRole:'asia-semi-flow'},
  // v37.2: 속보·지정학·매크로 텔레그램 채널 추가 (v39.0: FirstSquawk/FinancialJuice 공개 미리보기 비활성 — 코드에서 자동 스킵)
  {name:'TG FirstSquawk',           url:'https://rsshub.app/telegram/channel/firstsquawk',           country:'us', tier:1, flag:'TG', topics:['macro','geo','energy','defense'],  type:'telegram', tgSlug:'firstsquawk'},
  {name:'TG FinancialJuice',        url:'https://rsshub.app/telegram/channel/financialjuicechannel', country:'us', tier:1, flag:'TG', topics:['macro','geo','energy'],            type:'telegram', tgSlug:'financialjuicechannel'},

  // ═══ TIER 2: 🇺🇸 미국 투자/분석 전문 ═══
  {name:'Forbes Business',     url:'https://www.forbes.com/business/feed/',                       country:'us', tier:2, flag:'US', topics:['equity','macro']},
  {name:'Business Insider',    url:'https://markets.businessinsider.com/rss/news',                country:'us', tier:2, flag:'US', topics:['equity','macro']},
  {name:'Morningstar',         url:'https://www.morningstar.com/feeds/rss',                       country:'us', tier:2, flag:'US', topics:['equity','earnings']},
  {name:'Zero Hedge',          url:'https://feeds.feedburner.com/zerohedge/feed',                 country:'us', tier:2, flag:'US', topics:['macro']},

  // ═══ TIER 2: 테크·AI 전문 매체 (v37.3 추가) ═══
  {name:'TechCrunch',          url:'https://techcrunch.com/feed/',                                country:'us', tier:2, flag:'', topics:['semi','equity','earnings']},
  {name:'The Verge',           url:'https://www.theverge.com/rss/index.xml',                     country:'us', tier:2, flag:'', topics:['semi','equity']},
  {name:'Ars Technica',        url:'https://feeds.arstechnica.com/arstechnica/index',             country:'us', tier:2, flag:'', topics:['semi']},
  {name:'Wired Business',      url:'https://www.wired.com/feed/category/business/latest/rss',    country:'us', tier:2, flag:'', topics:['semi','equity']},
  {name:'VentureBeat',         url:'https://venturebeat.com/feed/',                               country:'us', tier:2, flag:'', topics:['semi','equity']},
  {name:'The Information',     url:'https://www.theinformation.com/feed',                         country:'us', tier:2, flag:'', topics:['semi','equity']},

  // ═══ TIER 2: 반도체·AI ═══
  {name:'TrendForce',          url:'https://www.trendforce.com/feed/',                            country:'us', tier:2, flag:'', topics:['semi','equity']},
  {name:'Digitimes',           url:'https://www.digitimes.com/rss/rss.xml',                      country:'us', tier:2, flag:'', topics:['semi','equity']},
  {name:'SemiAnalysis',        url:'https://www.semianalysis.com/feed',                           country:'us', tier:2, flag:'', topics:['semi']},
  {name:'Tom\'s Hardware',     url:'https://www.tomshardware.com/feeds/all',                     country:'us', tier:2, flag:'', topics:['semi']},
  {name:'EE Times',            url:'https://www.eetimes.com/feed/',                               country:'us', tier:2, flag:'', topics:['semi']},

  // ═══ TIER 2: 테크/기업 뉴스 전문 (v38.4: 기업 딜/파트너십 커버리지 강화) ═══
  {name:'HPCwire',             url:'https://www.hpcwire.com/feed/',                               country:'us', tier:2, flag:'', topics:['semi','equity']},
  {name:'GeekWire',            url:'https://www.geekwire.com/feed/',                              country:'us', tier:2, flag:'', topics:['equity','semi']},
  {name:'SimpleFlying',        url:'https://simpleflying.com/feed/',                              country:'us', tier:2, flag:'', topics:['equity']},
  {name:'SpaceNews',           url:'https://spacenews.com/feed/',                                 country:'us', tier:2, flag:'--', topics:['equity','defense']},
  {name:'Seeking Alpha News',  url:'https://seekingalpha.com/feed.xml',                           country:'us', tier:2, flag:'--', topics:['equity','earnings','macro']},
  // v38.5: 기업 보도자료·파트너십 뉴스 커버리지 강화
  {name:'PR Newswire Tech',    url:'https://www.prnewswire.com/rss/technology-latest-news/technology-latest-news-list.rss', country:'us', tier:2, flag:'', topics:['semi','equity','earnings']},
  {name:'GlobeNewswire',       url:'https://www.globenewswire.com/RssFeed/subjectcode/42-Partnerships/feedTitle/GlobeNewswire%20-%20Partnerships', country:'us', tier:2, flag:'', topics:['equity','semi']},
  {name:'Semiconductor Eng',   url:'https://semiengineering.com/feed/',                           country:'us', tier:2, flag:'', topics:['semi']},

  // ═══ TIER 2: 에너지·원자재 ═══
  {name:'OilPrice.com',        url:'https://oilprice.com/rss/main',                              country:'us', tier:2, flag:'', topics:['energy']},
  {name:'Rigzone',             url:'https://www.rigzone.com/news/rss/rigzone_latest.aspx',       country:'us', tier:2, flag:'', topics:['energy']},
  {name:'Platts/Commodities',  url:'https://www.spglobal.com/commodityinsights/en/rss-feed/all',  country:'us', tier:2, flag:'', topics:['energy']},
  {name:'Kitco Gold',          url:'https://www.kitco.com/feed/',                                 country:'us', tier:2, flag:'', topics:['energy','macro']},

  // ═══ TIER 2: 크립토 ═══
  {name:'CoinDesk',            url:'https://www.coindesk.com/arc/outboundfeeds/rss/',             country:'us', tier:2, flag:'', topics:['crypto']},
  {name:'The Block',           url:'https://www.theblock.co/rss.xml',                             country:'us', tier:2, flag:'', topics:['crypto']},
  {name:'DL News',             url:'https://www.dlnews.com/rss/',                                 country:'us', tier:2, flag:'', topics:['crypto']},

  // ═══ TIER 2: 지정학·방산 ═══
  {name:'Reuters World',       url:'https://rsshub.app/reuters/world',                           country:'us', tier:2, flag:'', topics:['geo']},
  {name:'AP Business',         url:'https://rsshub.app/apnews/topics/business',                  country:'us', tier:2, flag:'US', topics:['macro']},
  {name:'Defense One',         url:'https://www.defenseone.com/rss/all/',                         country:'us', tier:2, flag:'', topics:['geo','defense']},
  // v37.2: 중동·지정학 커버리지 보강
  {name:'Al Jazeera English',  url:'https://www.aljazeera.com/xml/rss/all.xml',                  country:'qa', tier:2, flag:'', topics:['geo','macro','energy']},
  {name:'Middle East Eye',     url:'https://www.middleeasteye.net/rss',                          country:'uk', tier:2, flag:'', topics:['geo','energy']},

  // ═══ TIER 2: 아시아 외신 ═══
  {name:'Nikkei Asia',         url:'https://asia.nikkei.com/rss/feed/nar',                        country:'jp', tier:2, flag:'JP', topics:['macro','equity']},
  {name:'SCMP',                url:'https://www.scmp.com/rss/1/feed',                             country:'cn', tier:2, flag:'CN', topics:['macro','geo']},
  {name:'Channel News Asia',   url:'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511', country:'sg', tier:2, flag:'🇸🇬', topics:['macro']},

  // ═══ TIER 1:  한국어 핵심 뉴스 (v34.6: tier 1로 승격 — 한국 시장 강화) ═══
  {name:'연합뉴스 경제',         url:'https://www.yna.co.kr/rss/economy.xml',                      country:'kr', tier:1, flag:'KR', topics:['macro','equity']},
  {name:'한국경제',              url:'https://www.hankyung.com/feed/finance',                       country:'kr', tier:1, flag:'KR', topics:['macro','equity']},
  {name:'매일경제',              url:'https://www.mk.co.kr/rss/40300001/',                         country:'kr', tier:1, flag:'KR', topics:['macro','equity']},

  // ═══ TIER 2:  한국어 뉴스 (보조 — 경제 전문지) ═══
  {name:'구글뉴스 금융',         url:'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko', country:'kr', tier:2, flag:'KR', topics:['macro','equity']},
  {name:'연합인포맥스',           url:'https://news.einfomax.co.kr/rss/S1N35.xml',                  country:'kr', tier:2, flag:'KR', topics:['macro','equity']},
  {name:'조선비즈',              url:'https://biz.chosun.com/rss/finance/',                        country:'kr', tier:2, flag:'KR', topics:['macro','equity']},
  {name:'머니투데이',            url:'https://news.mt.co.kr/rss/finance.xml',                      country:'kr', tier:2, flag:'KR', topics:['macro','equity']},

  // ═══ TIER 3: 유럽 ═══
  {name:'Reuters EU',          url:'https://feeds.reuters.com/reuters/UKBusinessNews/',            country:'eu', tier:3, flag:'EU', topics:['macro','energy']},
  {name:'ECB Press',           url:'https://www.ecb.europa.eu/rss/press.html',                    country:'eu', tier:3, flag:'EU', topics:['macro']},
  {name:'Euronews Business',   url:'https://www.euronews.com/rss?level=tag&name=business',        country:'eu', tier:3, flag:'EU', topics:['macro']},

  // ═══ TIER 3: 매크로·중앙은행 ═══
  {name:'Fed Reserve',         url:'https://www.federalreserve.gov/feeds/press_all.xml',          country:'us', tier:3, flag:'', topics:['macro']},
  {name:'IMF Blog',            url:'https://www.imf.org/en/News/rss?language=eng',                country:'us', tier:3, flag:'', topics:['macro']},
  {name:'World Bank',          url:'https://blogs.worldbank.org/feed',                            country:'us', tier:3, flag:'', topics:['macro']},
  {name:'BIS Speeches',        url:'https://www.bis.org/doclist/cbspeeches.rss',                  country:'eu', tier:3, flag:'', topics:['macro']},

  // ═══ TIER 3: 한국어 보조 ═══
  {name:'서울경제',              url:'https://www.sedaily.com/RSS/Economy',                         country:'kr', tier:3, flag:'KR', topics:['macro']},
  // v38.3: 이데일리·아시아경제 제거 — RSS 피드 전부 사망 확인 (2026-03-29 브라우저 실테스트 완료)
  // 이데일리: edaily_news/stock/economy.xml 전부 홈페이지 리다이렉트
  // 아시아경제: all.xml(연예·스포츠 혼입), economy/stock/finance.xml 전부 404
];

window.AIO_NEWS_SOURCES = AIO_NEWS_SOURCES;
function _aioUpdateNewsSourceMeta() {
  var count = AIO_NEWS_SOURCES.length;
  document.querySelectorAll('[data-news-source-count]').forEach(function(el){ el.textContent = count; });
  return count;
}
window._aioUpdateNewsSourceMeta = _aioUpdateNewsSourceMeta;
_aioUpdateNewsSourceMeta();

// ── Global HTML escape ─────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// ── URL sanitizer (XSS: javascript:/data: protocol block) ─────
function escUrl(url) {
  if (!url || typeof url !== 'string') return '';
  var trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) return '';
  return url.replace(/'/g, '%27').replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E');
}
// ── 중요도 키워드 & 티커 ────────────────────────────────────────
// ── 뉴스 스코어링 키워드 ────────────────────────────────────────
// MACRO_KW: 시장 전체에 영향 → 홈 페이지 우선 노출 (+25점)
// v34.9: 지정학적 시나리오 분석 — 특정 국가 참조는 분석 시점의 실제 리스크를 반영합니다. 주기적으로 현행화 필요.
const MACRO_KW = [
  'FOMC','FOMC minutes','Federal Reserve','Fed','rate hike','rate cut','interest rate','pivot',
  'short covering','short squeeze','hedge fund short','prime book leverage',
  'short-cover rally','short-covering rally','low volume rally','volume-backed rally',
  'failed breakdown','failed breakdown reclaim','support reclaim','volume profile support',
  'AI Capex','IT budget','CIO survey','seat-based SaaS','AI cannibalization',
  'AI capex funding','AI infrastructure funding','capital funding pulse','LQD YTM','LQD yield',
  'investment grade OAS','IG OAS','ICE BofA OAS','corporate OAS','HY OAS','credit downgrade',
  'MAGS ETF','Hartnett','recession recognition','sticky inflation','inflation persistence',
  // v53.43 (integrate 2026-07-20): AI infrastructure cycle / funding and breadth debate.
  'capex revenue crossover','depreciation wall','capital intensity','capacity digestion',
  'funding runway','AI infrastructure cycle','oil inflation pass-through','forced deleveraging',
  'margin debt','energy inflation impulse','hyperscaler debt capacity','cloud backlog conversion',
  'multiple compression','supply bottleneck narrative','overbuild risk',
  // v53.90 (integrate 2026-08-09): AI power-quality, demand falsifier, and breadth-risk vocabulary.
  'AI load ramp','peak-to-average load','electricity price volatility','transformer stress',
  'voltage flicker','harmonic distortion','load-following','GPU resale price',
  'GPU rental repricing','frontier lab growth','OCF acceleration','interconnection queue risk',
  'power-quality study','behind-the-meter economics','memory LTA allocation',
  'climax top','railroad track','200SMA stretch','relative-strength pullback',
  'inverse ETF','hedge proxy','short-demand proxy','event-driven risk window',
  // v54.11 (integrate 2026-08-11/12): dated market-briefing vocabulary.
  'CPI release window','CPI surprise path','oil-rate conflict','AI compute financing',
  'compute financing platform','third-party capital','equity dilution','margin deleveraging',
  'forced liquidation','earnings beat breadth','market narrative bridge','foreign flow reversal',
  'asset manager 200SMA','oil and gas leadership','memory two-way risk','neocloud earnings reaction',

  'CPI','PCE','GDP','GDPNow','inflation','deflation','recession','stagflation',
  'tariff','trade war','sanction','export ban','supply chain',
  // ── v37.5: 관세/무역전쟁 키워드 보강 (2025-2026 핵심 이슈)
  'Section 301','reciprocal tariff','retaliatory tariff','countervailing duty',
  'anti-dumping','de minimis','USMCA','trade deficit','trade surplus','customs duty',
  'trade negotiation','trade deal','trade agreement','trade representative','USTR',
  'import duty','export restriction','entity list','blacklist','commerce department',
  '상호관세','보복관세','반덤핑','상계관세','무역적자','무역협상','관세율','수입관세','수출제한',
  '엔티티리스트','무역대표부','통상압력','무역분쟁','무역협정',
  // ── 지정학·전쟁 (2026 지정학적 리스크 모니터링) — v37.2 보강
  'war','attack','missile','invasion','nuclear','conflict','geopolitical',
  'Iran','Hormuz','strait','airstrike','ceasefire','escalation','Middle East',
  'Israel','Lebanon','Hezbollah','CENTCOM','drone','drone strike','blockade',
  'IRGC','proxy war','oil tanker','tanker seizure','shipping lane',
  'Brent','crude oil','oil embargo','energy shock','oil supply',
  'crash','crisis','collapse','default','systemic','contagion',
  'treasury','yield curve','bond market','credit spread','VIX spike',
  'dollar','DXY','yen','yuan','currency','devaluation',
  'earnings season','S&P','Nasdaq','Dow','market breadth','correction',
  'oil price','OPEC','energy crisis','gold','commodities',
  'bank failure','liquidity','margin call','short squeeze',
  // ── 한국어 추가 (이란전쟁·스태그) — v37.2 보강
  '금리','전쟁','경기침체','인플레','관세','수출규제','부양책','긴축',
  '달러','원화','환율','채권','국채','기준금리',
  '이란','호르무즈','원유 급등','스태그플레이션','에너지 위기','유가 충격',
  '이스라엘','레바논','헤즈볼라','봉쇄','공습','드론','유조선','해상봉쇄','해운항로',
  // ── 전쟁/유가 추가 키워드
  'hormuz','호르무즈','demand destruction','수요파괴','refinery','정유','brent','wti-brent','spread',
  '카타르','qatar','lng','force majeure','불가항력','netanyahu','네타냐후','capitulation','항복매도',
  // v39.0: JP모건/SemiAnalysis 프레임워크 키워드
  'fortress iran','supply gap','oil premium','geopolitical premium','barbell strategy',
  'oil supply gap','oil disruption','Bab el-Mandeb','바브엘만데브',
  'net leverage','positioning','tactical positioning','forced buy',
  '요새 이란','공급 공백','유가 프리미엄','바벨 전략','순레버리지','포지셔닝',
  'server price','AI server price','서버 가격','BOM cost',
  // v49.99 (integrate 2026-05-31): 텔레그램 3채널 통합 키워드
  'memory ASP','DRAM ASP','NAND ASP','메모리 ASP','DRAM 가격','NAND 가격',
  'memory TAM','메모리 TAM','agentic AI memory','에이전틱 AI 메모리',
  'MLCC price','MLCC 가격','MLCC 인상','passive components','수동부품 가격',
  'Iran mine','이란 기뢰','Meham mine','27 Razab','이란 미사일 보트',
  'US-Iran deal','미-이란 합의','nuclear deal text','호르무즈 재개방',
  'Tehran stock','테헤란 증시','Iran-US MOU','이란 MOU',
  'Computex 2026','GTC Taipei','GTC 타이페이','젠슨황 기조연설',
  'Vera Rubin PC','NVDA Windows PC','ARM Windows','엔비디아 PC',
  'Foxconn Vera Rubin','폭스콘 베라루빈','Quanta AI 2030',
  'dollar won 24h','달러원 24시간','FX 24시간','원달러 야간거래',
  'quantum milestone','Quantinuum H2','양자컴퓨터 마일스톤','32 qubit',
  'LTA prepayment','LTA 선지급','memory LTA','메모리 장기계약',
  'Kioxia','키옥시아','NAND cycle peak','낸드 사이클 정점',
  // v49.99 MACRO_KW 추가 — 분석가·인플레·메모리수급 (ANALYST_KW max+3이라 여기에도 등록)
  'Hartnett','Michael Hartnett','BofA inflation','inflation warning','인플레 경고',
  'Ueda','BOJ Ueda','우에다','G7 central bank','G7 금리',
  'memory supply','memory shortage','메모리 수급','메모리 공급 부족','반도체 수급',
  'AI server demand','AI 서버 수요','server supply constraint','서버 공급 제약',
  'Dell AI server','Dell earnings','Dell FY27','FY1Q27',
  // v48.16 (integrate 2026-04-18): Citi 자산배분 + Fed + 데이터센터 규제
  'escalate to de-escalate','고조 후 완화','quality rotation','퀄리티 로테이션',
  'earnings broadening','이익 확산','defensive tilt','디펜시브 전환',
  'bear market checklist','tactical overweight','전술적 비중확대',
  'DC moratorium','data center ban','DC 금지법안','전력망 영향',
  'Maine DC','hyperscale grid','power grid strain','grid connection',
  'Wartsila','34SG engine','onsite power','온사이트 발전',
  'data dependence','데이터 디펜던스','forward guidance 실패',
  '평균물가목표','2% 물가목표','중물가',
  // v39.2: JP모건 유가 시나리오 + 트럼프 국방예산 (2026.04)
  'demand destruction threshold','oil price scenario','gasoline price','K-shaped recovery',
  // v50.61 Telegram 7d macro/policy extensions.
  'BOJ 1%','JGB purchase taper','Nikkei 70000','Iran reconstruction fund',
  'US-Iran MOU','Hormuz reopening','Hormuz oil shipments','AI model export control',
  'Fable 5 export control','Mythos 5 export control','foreign national AI access',
  'sovereign AI regulation','G7 AI security','Commerce Department AI export',
  'quality growth','low volatility','selective re-entry','bear flattener',
  'energy exporter','energy importer','AUD carry','NOK carry',
  'cross-asset correlation','inflation expectations anchored','net energy exporter',
  '수요파괴 임계점','유가 시나리오','가솔린 가격','K자형 경제',
  '퀄리티 성장주','저변동성','선택적 재진입','에너지 수출국',
  'Golden Dome','defense budget','national defense','FY2027 defense',
  'Virginia-class submarine','F-35 procurement','defense spending',
  'weapons production','Indo-Pacific','무기 재고 재건','국방예산','골든 돔',
  // v42.8: Power & Utilities Supercycle 키워드
  'power supercycle','AI power demand','Rate Base','power PPA','transmission grid',
  'onsite power','gas turbine','fuel cell','onsite generation','power purchase agreement',
  '전력 슈퍼사이클','가스터빈','연료전지','송전 병목','전력 PPA','유틸리티 성장',
  '전력 직접계약','Rate Base 확대','전력 인프라','AI 전력',
  // v38.6: 민간신용·소비심리·시장미시구조 (퍼펙트스톰 분석)
  'private credit','사모신용','사모펀드','사모대출','redemption','환매','redemption wave','환매 위기',
  'private credit default','default rate','디폴트율','Apollo','Blackstone credit',
  'consumer sentiment','소비자심리','Michigan sentiment','미시간 소비심리',
  'recession model','recession probability','침체확률','침체 모델',
  'ETF volume','top of book','top-of-book depth','market microstructure','시장미시구조',
  'pension rebalancing','연기금 리밸런싱','hedge unwind','헤지 해소','숏감마 해소',
  'Trump Reversal Index','reversal index','capitulation signal','항복 신호',
  'short gamma','숏감마','dealer gamma','딜러감마',
  // ── v31.8: 채권·금리·통화정책 심화
  'quantitative easing','quantitative tightening','reverse repo','RRP',
  'term premium','real yield','TIPS','breakeven inflation','fed funds',
  'dot plot','jackson hole','minutes','beige book','bank term funding',
  'sovereign debt','fiscal deficit','debt ceiling','government shutdown',
  'investment grade','high yield','junk bond','credit default swap','CDS',
  'BBB downgrade','fallen angel','covenant','leverage loan','CLO',
  // ── v31.8: 외환·글로벌 중앙은행
  'ECB','BOJ','BOE','PBOC','BOK','RBA','SNB','Riksbank',
  'carry trade','currency intervention','forex reserve','capital outflow',
  'dollar index','euro','sterling','swiss franc','emerging market currency',
  'bilateral swap','dedollarization','BRICS currency','petrodollar',
  'won','ringgit','rupee','baht','peso','lira','rand','real',
  // ── v31.8: 경제지표 심화
  'ISM','PMI','services PMI','manufacturing PMI','consumer confidence',
  'retail sales','industrial production','housing starts','building permits',
  'durable goods','factory orders','trade balance','current account',
  'leading indicators','LEI','initial claims','continuing claims','JOLTS',
  'ADP employment','nonfarm payroll','NFP','unemployment rate',
  'capacity utilization','business inventories','wholesale inventories',
  'Michigan sentiment','Conference Board','Philly Fed','Empire State',
  'Chicago PMI','Dallas Fed','Richmond Fed','Kansas City Fed',
  // ── v31.8: 시스템 리스크·금융안정
  'systemic risk','financial stability','bank run','deposit flight',
  'FDIC','bailout','bail-in','too big to fail','stress test',
  'counterparty risk','rehypothecation','shadow banking','money market',
  'commercial real estate','CRE','office vacancy','CMBS',
  'pension fund','sovereign wealth fund','central bank buying',
  // ── v31.8: 지정학 심화
  'Taiwan Strait','South China Sea','AUKUS','NATO expansion',
  'Ukraine','Russia','North Korea','ICBM','hypersonic',
  'Red Sea','Houthi','shipping disruption','Suez','Panama Canal',
  'rare earth','critical minerals','chip war','tech decoupling',
  'friendshoring','nearshoring','reshoring','onshoring',
  'SWIFT','financial sanctions','asset freeze','embargo',
  // ── v31.8: 한국어 매크로 심화
  '통화정책','양적완화','양적긴축','테이퍼링','피봇','금통위',
  '물가','소비자물가','생산자물가','근원물가','기대인플레',
  '고용','실업률','신규고용','비농업고용','고용지표',
  '경상수지','무역수지','수출','수입','무역흑자','무역적자',
  '재정적자','국가부채','부채한도','예산안',
  '한국은행','금융통화위원회','기준금리 인하','기준금리 인상','기준금리 동결',
  '외국인 매도','외국인 매수','외국인 순매수','외국인 순매도',
  '기관 매수','기관 매도','수급','프로그램매매',
  '공매도','대차잔고','신용잔고','반대매매',
  '시스템 리스크','금융안정','예금 인출','뱅크런',
  '대만해협','남중국해','홍해','후티','수에즈','공급망',
  '탈달러화','페트로달러','위안화 결제',
  '희토류','핵심광물','기술패권','디커플링',
  // v40.4: Citi 매크로 싱크탱크 + 미래에셋 쓰리백 (2026.04)
  'GPU rental','GPU rental price','compute rental','GPU shortage','compute shortage',
  'GPU 렌탈','GPU 가격','컴퓨트 부족','컴퓨팅 병목',
  'labor participation','participation rate','경활률','경제활동참가율',
  'AUDUSD','AUD short','belly trade','TIPS long',
  'sector rotation','sector overweight','sector underweight','섹터 로테이션',
  'Hormuz vulnerability','호르무즈 취약','energy import','에너지 수입',
  'neutral downgrade','주식 중립','overweight to neutral',
  // v42.1: GS KOSPI + JPM GDW + 추경 + 나프타 + 반도체 포지셔닝 (2026.04)
  'KOSPI 7000','KOSPI target','KOSPI forward PE','코스피 선행PER','코스피 목표가',
  'ERLI','이익수정선행지표','earnings revision leading',
  '추가경정예산','supplementary budget Korea','Korean fiscal stimulus',
  '나프타 수출 금지','나프타 가격','naphtha export ban','naphtha price surge','naphtha ban',
  '석유화학 불가항력','petrochemical force majeure','석유화학 감산',
  'Tankan','단칸 조사','BOJ April hike','BOJ rate hike April',
  '한국 수출 역대 최대','Korea export record','반도체 수출 급등',
  'Long-only positioning','hedge fund semiconductor','롱온리 반도체',
  'helium supply','헬륨 공급','helium EUV','helium shortage',
  // ── v37.7: AI 투자·전력수요·정책 키워드
  'AI CapEx','hyperscaler CapEx','data center CapEx','cloud CapEx','AI spending',
  'power demand','electricity demand','grid capacity','grid bottleneck','grid congestion',
  'nuclear revival','nuclear renaissance','energy permitting','permitting reform',
  'industrial policy','CHIPS Act','IRA','Inflation Reduction Act','IIJA',
  'AI regulation','AI executive order','EU AI Act','AI governance',
  'Medicare GLP-1','drug pricing','IRA drug negotiation',
  // 한국어
  'AI투자','빅테크설비투자','데이터센터투자','전력수요','전력난','송전망','계통',
  '원전르네상스','에너지허가','산업정책','반도체특별법','K칩스법',
  'AI규제','AI거버넌스',
  // v43.4: AI 기업 성장 마일스톤 — 시장 임팩트 높음 (TECH_KW 중복→+40점 합산)
  'Anthropic','OpenAI','xAI','AI run-rate','run-rate revenue','ARR milestone',
  'enterprise AI adoption','AI enterprise deal','AI contract',
  'GW-scale compute','gigawatt compute','AI compute demand',
  'GPT-6','GPT 6','Sam Altman','Dario Amodei',
  // v44.5: 4개 글 통합 — TFP/생산성/H4L/자본조달/SPY200MA (2026.04.08)
  'total factor productivity','TFP growth','productivity gap','AI productivity gap',
  'unit labor cost','labor productivity growth','productivity expectation',
  'higher for longer','H4L policy','Fed H4L','sticky inflation',
  'Treasury refunding','T-bills maturity','debt refunding','debt rollover 2026',
  'long-term inflation expectation','inflation expectations unanchored',
  'energy cost pass-through','jet fuel inflation','diesel pass-through',
  '생산성 향상','전요소생산성','TFP','단위노동비용','생산성 격차',
  '기대인플레이션 상승','끈적한 물가','고금리 장기화','H4L',
  'capital allocation','cost of capital','equity financing','debt financing',
  'SPY 200-day','SPY 200MA','200-day moving average resistance','S&P 200DMA',
  '이란 휴전 재충전','ceasefire two-week','2주 휴전 리스크',
  // v44.8: DC전력믹스·BTM·AI보안 (2026.04.09)
  'BTM natural gas','BTM generation','behind-meter generation','grid constraint decade',
  'training inference mix','datacenter workload shift','backup power leadtime',
  'diesel genset cost','standby power capacity','prime power bridge',
  'AI vulnerability','zero-day AI','AI security arms race','shadow AI risk',
  '추론DC 입지','DC워크로드 전환','BTM 천연가스','스탠바이전력','AI 취약점',
  // v44.9: Citi 스태그플레이션 플레이북 (2026.04.09)
  'stagflation playbook','stagflation scenario 2026','stagflation equity',
  'net short positioning','short extension phase','de-risking phase',
  'sector dispersion EPS','energy EPS offset','headline EPS intact',
  'commodity exporter hedge','EM commodity hedge','regional equity allocation',
  'Eurostoxx50 positioning','DM xUS positioning','Korea net long risk',
  '스태그플레이션 플레이북','지정학 헤지','순공매도','에너지 EPS 상쇄','섹터 편차',
  '포지셔닝 해소','비중확대 영국','비중축소 일본','라틴아메리카 헤지',
  // v45.0: 시장 브레드쓰 구조 분석 (2026.04.09)
  'bull trap','breadth divergence','market internals','above 50-day','above 200-day',
  '불트랩','이평정배열','브레드쓰 괴리','갭업 돌파','50일선 탈환','브레드쓰 확인',
  // v46.3: FOMC 듀얼리스크 + TGA 메커니즘 + 4월 이벤트 (2026.04.10)
  'FOMC dual risk','dual mandate tension','bidirectional rate signal','rate hike signal',
  'non-housing services sticky','non-shelter services','core services ex-housing',
  'low hiring trap','low hiring vulnerability','hiring pause AI',
  'Kevin Warsh','Warsh confirmation','Fed chair nomination','Warsh hearing',
  'Tillis opposition','Fed chair uncertainty','Fed succession',
  'TGA drawdown','TGA mechanism','Treasury General Account','TGA replenishment',
  'T-bill issuance','reverse repo drain','RRP drain','MMF T-bill',
  'Yellen TGA','Bessent liquidity','Treasury issuance strategy',
  'OBBBA tax cut','withholding tax reduction','fiscal stimulus 2026',
  'buyback blackout','buyback window','corporate buyback resume',
  'tax filing deadline','tax season liquidity','April tax drain',
  'political liquidity','midterm election market','Treasury vs Fed',
  'earnings season April','GS earnings','JPM earnings','TSM earnings',
  'ASML earnings','NFLX earnings','April OPEX',
  'productivity gap inflation','Debt-to-GDP risk','fiscal deficit inflation',
  '워시 청문회','워시 인준','연준 의장 인준','틸리스 반대',
  '비주거 서비스','끈적한 서비스 물가','듀얼 리스크','양방향 금리',
  'TGA 메커니즘','재무부 유동성','역레포 인출','T-bill 발행 전략',
  '바이백 재개','바이백 블랙아웃','세금 시즌 유동성','정치적 유동성',
  '중간선거 시장','재무부 vs 연준','베센트','감세 환류',
  // v46.4: 걸프 인프라 피해 + 이창용 한은 (2026.04.10)
  'Gulf energy infrastructure','Ras Laffan damage','Sitra refinery','East-West pipeline',
  'refinery outage','pipeline attack','energy infrastructure repair','supply shock measurable',
  'Saudi Aramco attack','Khurais attack','Manifa attack','pumping station attack',
  'BOK Lee Chang-yong','supply shock temporary','WGBI inflow','supplementary budget Korea',
  'exchange rate DXY relative','걸프 인프라 피해','라스 라판','시트라 정유소',
  '동서 파이프라인','정유 가동중단','공급 충격 정량화','이창용 총재','WGBI 유입',
  '추경 초과세수','환율 DXY 상대비교',
  // v46.6: 2026 매크로 키워드 확장
  // 일본 금리 정규화
  'BOJ rate hike','BOJ normalization','Ueda','Japanese bond','JGB','30Y JGB',
  'yen carry unwind','Japan rate path','Tankan','BoJ April',
  '일본 금리','우에다','JGB','엔 캐리 청산','일본 국채','일본 금리 정규화',
  // 크립토 규제/제도화
  'spot bitcoin ETF','crypto regulation','SEC crypto framework','MiCA','stablecoin regulation',
  'crypto custody','digital asset','CBDC','digital dollar','digital euro',
  '비트코인 ETF','크립토 규제','스테이블코인 규제','디지털 자산','CBDC',
  // 중간선거/정치 불확실성 (금융 영향)
  'midterm election','midterm market','election uncertainty','political risk premium',
  'government shutdown','debt ceiling','continuing resolution','fiscal cliff',
  '중간선거 시장','정치 불확실성','정부 셧다운','부채 한도','재정절벽',
  // ESG/기후 금융
  'carbon pricing','carbon border','CBAM','climate risk','green bond','transition finance',
  'net zero','carbon credit market','emissions trading',
  '탄소가격','탄소국경조정','녹색채권','기후리스크','탄소배출권',
  // 생산성/AI 경제 영향
  'AI productivity','TFP','total factor productivity','AI GDP impact','automation displacement',
  'AI 생산성','총요소생산성','AI GDP 영향',
  // v46.6: JP모건 뷰 휴전 베타 + 뉴스 브리핑 + Citi SW Shock
  'ceasefire beta','휴전 베타','retracement','되돌림률','안도 랠리','relief rally',
  'Novorossiysk','노보로시스크','Black Sea oil','흑해 원유','oil loading halt',
  'GCC energy infrastructure','걸프 에너지 인프라','통행료 제도','Hormuz toll',
  'manufacturing GDP','제조업 GDP','reshoring','리쇼어링',
  'Hungary election','헝가리 선거','Fidesz','Magyar','HUF','HGB',
  'Kraken Fed account','크라켄 연준 계정','crypto payment','크립토 결제',
  // v46.6: 이란 협상 결렬 + 실질금리 + 사모신용 + SW-Semi 로테이션 (10건 통합)
  'naval blockade','해군 봉쇄','mine clearing','기뢰 제거','Hormuz mine','호르무즈 기뢰',
  'IRGC toll','물동량 정상화','physical supply gap','공급 갭 14M bbl',
  'Iran negotiation failure','이란 협상 결렬','Islamabad talks','이슬라마바드 협상',
  'negative real rate','실질금리 마이너스','real rate zero','실질금리 제로',
  '2nd-round effect','2차 파급효과','wage-price spiral','임금-물가 스파이럴',
  'CDX Financials','private credit CDS','사모신용 CDS','BCRED redemption',
  'BDC stress','사모신용 꼬리 리스크','private credit tail risk',
  'SW Semi rotation','소프트웨어 반도체 로테이션','IGV underperform','IGV 부진',
  'AI budget crowding','AI 예산 크라우딩','non-AI software pressure',
  'Michigan sentiment record','소비자심리 역대최저','S&P consumer divergence',
  'forward PE compression','선행PER 압축','Mag7 underperform','top-10 concentration',
  'Beveridge curve','베버리지 곡선','Inverse-L Phillips','필립스 곡선',
  'wage growth tracker','WGT','임금추적지수','unit labor cost rise',
  // v47.1: PPI 수요파괴 + 기대인플레 탈앵커링 + Mission Accomplished 괴리 + CTA (2026.04.16)
  'margin compression','마진 압축','trade margin squeeze','도매 마진 축소',
  'PPI-to-PCE','PCE pass-through','PCE 패스스루','PPI PCE 전이',
  'intermediate demand','중간재 수요','stage 2 demand','파이프라인 물가',
  'producer margin','생산자 마진','cost absorption','비용 흡수',
  'CTA mechanical buying','CTA 기계적 매수','CTA positioning',
  'positive gamma grip','양의 감마 그립','gamma expiration','감마 만기',
  'inflation expectation de-anchoring','기대인플레 탈앵커링',
  'Michigan 1Y expectation','미시간 1년 기대인플레',
  'headline vs core divergence','헤드라인 근원 괴리',
  'asset class divergence','자산군 괴리','stock-oil-bond divergence',
  'Mission Accomplished','미션 어컴플리시드',
  'energy cost structural','에너지 비용 구조적','post-war energy premium',
  'IEA Birol','비롤','energy security threat',
  'short squeeze software','소프트웨어 숏스퀴즈','software semi rotation',
  // v47.2: 분배 단계 진단 + UW 확장 F&G + RiskBot + ZBT + Pain Trade (2026.04.16)
  'distribution phase','분배 단계','distribution top','topping process','topping pattern',
  'narrow rally','협소 랠리','top-heavy rally','top-decile leadership','상위 5% 주도',
  'breadth failure','브레드쓰 부실','breadth divergence','internal divergence','내부 괴리',
  'Zweig Breadth Thrust','ZBT','ZBT trigger','ZBT absence','ZBT 부재','ZBT 미작동',
  'breadth thrust','NYSE advance decline','AD line ratio','상승하락 비율',
  'lock-out rally','Lockout rally','락아웃 랠리','FOMO buying','FOMO 매수',
  'pain trade','페인 트레이드','short capitulation','숏 항복','short cover capitulation',
  'bear trap resolved','곰덫 해소','short liquidation','숏 청산 완결','net-short flip',
  'Fear Greed 68','F&G 68','UW F&G 68','CNN Fear Greed','Unusual Whales Fear Greed','UW F&G','CNN F&G 47','F&G 47 Neutral','CNN Neutral 47',
  'Premium Trend','Premium Ratio','premium trend 100','call premium dominant','콜 프리미엄 과집중',
  'Insider Sentiment','insider sentiment 0','내부자 매수 전멸','insider buying drought',
  'Safe Haven Demand','safe haven 99','안전자산 수요 최저','stocks vs bonds',
  'Junk Bond Demand','junk bond 45','정크본드 수요','HY spread compression',
  'Fifty Two Week Sentiment','52주 센티먼트','52-week position','52주 위치',
  'Stock Price Strength','Stock Price Breadth','주가 강도','주가 확장성',
  'Put Call ratio 70','put call extreme','옵션 과매수 구간',
  'RiskBot','위험봇','RiskBot STABLE','STABLE regime','안정 레짐',
  'RiskBot WARNING','WARNING regime','경고 레짐','RiskBot DANGER','위험 레짐',
  'SKEW index 139','SKEW index 141','SKEW 141.86','SKEW 고점','tail risk hedge','꼬리위험 헤지','crash protection bid',
  'VVIX 98','VVIX 90','VVIX 90.10','VVIX VIX convexity','VIX of VIX','변동성의 변동성',
  'MOVE index 68','MOVE index 62','MOVE 62.36','MOVE rates volatility','채권 변동성 저점','rates vol floor',
  'VIX9D','9-day VIX','단기 VIX','VIX term structure','VIX 커브','vix slope',
  'VIX contango','VIX backwardation','콘탱고','백워데이션','term structure inversion',
  'SKEW MOVE paradox','SKEW-MOVE divergence','채권 주식 꼬리위험 역설',
  'bond complacency equity protection','채권 안심 주식 보험',
  'market regime diagnosis','시장 레짐 진단','regime signature',
  '2000.01 topping','2007.10 topping','2021.11 topping','분배 단계 3/3','distribution 3/3',
  'Mag7 pullback distribution','Mag7 조정 분배','SPX new high Mag7 lag','지수 신고 Mag7 이탈',
  'retail FOMO capitulation','리테일 FOMO','retail peak sentiment',
  'CAPE 35','CAPE ratio','Shiller CAPE','쉴러 PER','forward PE 21','선행 PER 21',
  'earnings yield bond yield','주식 채권 기대수익 격차',
  'market internals deterioration','시장 내부 악화','internals gap widening',
  'Anna Karenina market','안나 카레니나 시장','unique distribution signature',
  // v48.61 (integrate 2026-04-21): 매크로 추가 키워드
  'GPU rental spike','GPU 임대가 급등','B200 rental','H100 rental','A100 rental',
  'DRAM contract +61%','NAND contract +73%','memory contract 2Q26','메모리 계약가',
  'token survivor charge','Tumi Amazon Connect','AI manager','컴퓨팅 용량 부족',
  'power is bottleneck','전력이 병목','2028 compute constraint','2029 rebalance',
  'physical AI consensus','피지컬 AI 합의','autonomous truck crossover','2028 AV crossover',
  'rideshare AV cannibalization','라이드셰어 AV 잠식','5% 16% scenario',
  'SAAR 300-600만 감소','자동차 판매 극단 베어','US driver labor 350만',
  'CapEx 67% 2026','CapEx 16% 2027','hyperscaler 8000억',
  // v48.65 (integrate 2026-04-25): 리스크 관리 프레임워크 + 우주 경제
  'dual-scenario planning','scenario planning investing','양방향 시나리오 플래닝',
  'risk calibration','portfolio concentration risk','personal black swan event',
  'optimism tipping point','risk accumulation threshold','macro risk management tool',
  '개인 블랙스완','포지션 쏠림','리스크 임계점','낙관 한계','낙관 붕괴',
  '양방향 시나리오','매크로 리스크 도구','시나리오 분기',
  'Golden Dome budget','SHIELD IDIQ defense','space defense budget',
  'Artemis III lunar','Artemis IV crew landing','SpaceX IPO 2026',
  'space economy 2026','commercial space station','Starlab station',
  'Amazon Globalstar acquisition','D2D spectrum','satellite broadband M&A',
  '골든돔 예산','아르테미스','스페이스X IPO','상업우주정거장','위성통신 M&A',
  // v48.67 (integrate 2026-04-26): 이란 봉쇄·메모리 LTA 메가트렌드
  'Hormuz blockade','Iran blockade','호르무즈 봉쇄','호르무즈 해협 봉쇄',
  'shadow fleet','그림자 선대','제재 우회 선박','이란 유조선',
  'LTA agreement','memory LTA','long-term supply agreement','메모리 장기공급계약',
  // v48.71 (2026-05-02): UAE OPEC+ 탈퇴 + AI 수익화 + 모델 증류
  'UAE OPEC exit','UAE OPEC departure','UAE 탈퇴','UAE production quota',
  'OPEC+ realignment','OPEC 이탈','UAE 증산 결정',
  'model distillation','xAI distillation','Grok distillation','모델 증류',
  'xAI training data','AI model training distillation',
  'gray market GPU','B300 gray market','중국 그레이마켓 GPU',
  'China GPU rental','China AI token usage 32%',
  'K-shaped consumer','K자형 소비','consumer bifurcation',
  'USMCA review 2026','USMCA joint review','무역협정 검토',
  'double beat 68%','earnings double beat','어닝 더블비트',
  'tariff sensitivity 12%','tariff exposure high','관세 고노출',
  'fintech BNPL cycle','SOFI earnings','LC loan origination',
  // v48.87 (integrate 2026-05-07): 25건 시장 자료 매크로 키워드
  'server CPU TAM','서버 CPU TAM','CPU TAM revision','CPU GPU ratio','CPU:GPU ratio',
  'agentic CPU','에이전틱 CPU','agentic workload CPU','CPU GPU additive',
  'AI inference cost','AI 추론 비용','LLM inference cost','LLM 비용','inference cost margin',
  'hyperscaler commitment','하이퍼스케일러 약정','hyperscaler backlog','cloud backlog',
  'Anthropic Google contract','Anthropic $200B','OpenAI server $45B','CoreWeave loan',
  'AIDC ESS','DC 배터리','AI data center battery','BESS AIDC','datacenter ESS',
  'DOE grid ruling','DOE 계통연계','PJM interconnection','PJM queue','계통연계 대기',
  'sodium-ion battery','나트륨이온 배터리','sodium ion AIDC','CATL sodium',
  'DRAM price shock','서버 DRAM 가격','server DRAM +45','PC DRAM +43','NAND +80',
  'memory price inflation','메모리 가격 인플레이션','memory ASP 2Q26',
  'smartphone unit decline','스마트폰 유닛 감소','smartphone YoY negative','PC demand 2H26',
  'TSMC 3nm constraint','TSMC capacity constraint','TSMC AMD allocation',
  '153K wafers','TSMC N3 supply','AMD supply bottleneck',
  // v51.09 (integrate 2026-06-22): 스위스 미이란 협상 + BOJ 비둘기 + 중국 희토류 + 영국 스타머 + WTI $75
  'Iran 60-day roadmap','Iran Switzerland talks','Iran final agreement','미이란 60일 로드맵','이란 스위스 협상',
  'Iran reconstruction fund','이란 재건 개발','Iran petrochemical export exemption','이란 석유화학 수출 면제',
  'Iran frozen assets release','이란 동결자산 해제','Lebanon ceasefire Iran','레바논 종식 이란',
  'BOJ dovish','BOJ accommodative','BOJ accommodation continue','일본은행 비둘기','BOJ 완화 지속',
  'yen carry continuation','엔 캐리 지속','carry unwind risk low','carry risk elimination',
  'China rare earth entity list','China rare earth 10 companies','중국 희토류 수출통제 기업','희토류 10개사 제재',
  'China rare earth retaliation','중국 희토류 보복','미중 기술갈등 희토류',
  'Starmer resignation','UK political uncertainty','스타머 사임','영국 정치 불안','Starmer PM',
  'UK political risk','영국 불확실성','브렉시트 방향성','post-Brexit policy',
  'WTI below 75','WTI $75','WTI 75달러','원유 $75 이하','유가 $75',
  'Trump Anthropic','Trump AI security','트럼프 앤트로픽','AI 안보 정책 완화',
  // v51.13 (integrate 2026-06-23): GS 침체 하향 + 순환매 + 이란 라이선스 + 유가 + 분기말 리스크 + ECB
  'Goldman Sachs recession 15','GS recession probability','GS 침체 확률','recession probability down',
  'Goldman Sachs soft landing','GS soft landing','경기침체 확률 하향','GS 15 percent recession',
  'quarter-end rebalancing','분기말 리밸런싱','Q-end sell pressure','quarter end selling',
  'hedge fund leverage 5-year','HF leverage high','헤지펀드 레버리지','leveraged portfolio risk',
  'JPMorgan 165 billion rebalancing','JPM quarter rebalancing','165 billion equity sell',
  'Iran general license','이란 일반면허','Iran 60-day oil license','60일 원유 허가',
  'Iran oil license oil sales','이란 원유 판매 허가','Iran oil supply increase',
  'WTI 74','WTI 75 below','WTI 74.82','원유 74달러','브렌트 77','Brent 77',
  'SPR strategic reserve low','SPR 1983 low','전략비축유 최저','미국 전략비축유 감소',
  'oil supply glut','공급 과잉 우려','oil oversupply','OPEC supply concern',
  'BofA Fed hike 2026','Bank of America three hikes','BoA 3회 인상','연준 인상 전망 변경',
  'Julius Baer Fed freeze','Julius Baer 10Y','10년물 4.3 하반기','유럽계 연준 동결',
  'ECB Lagarde service slowdown','라가르드 서비스 둔화','ECB growth risk','유럽 경기 둔화',
  'yuan undervalued G7','위안화 저평가 G7','G7 imbalance','라가르드 위안화',
  'reverse repo surge','역레포 급증','Fed reverse repo','역환매조건부채권 급증',
  'Greenspan death','앨런 그린스펀 별세','Greenspan passed away',
  // v53.92 Telegram channel cross-checks: narrative discovery only; current values require primary evidence.
  'AI infrastructure broadening','market broadening','KOSPI positioning','KOSPI deleveraging',
  'Texas data center queue','Texas water stress','interconnection queue 474GW','temporary Hormuz safe route',
  'US-Japan FX intervention','DXY long unwind','credit deleveraging','single-name leverage unwind',
];
// TECH_KW: 기술/AI 주요 이벤트 → 섹터 관련 (+15점)
const TECH_KW = [
  'AI chip','H100','H200','Blackwell','Rubin','Rubin Ultra','Feynman','HBM','HBM4','CoWoS',
  'CoPoS','CoWoP','SoIC','COUPE','panel level packaging',
  'TSMC','Samsung foundry','SK Hynix','ASML','EUV',
  'Ironwood','Sunfish','Pumafish','Humufish','Zebrafish','Trainium',
  'Muse Spark','MSL','Meta Superintelligence','Anthropic ARR','agentic commerce',
  'DeepSeek','Gemini','GPT','Llama','Claude','AI model',
  'semiconductor shortage','chip ban','export control',
  // ── 메모리·Micron (2026 MU 어닝 화두)
  'Micron','memory','DRAM','NAND','HBM demand','memory shortage','memory boom',
  'MU earnings','AI memory','data center memory',
  'SMH leadership','SMH rotation','IGV SMH rotation','software to semi rotation',
  'semiconductor rebalancing','QQQ support check','semi relative strength',
  '20EMA reclaim','50EMA reset','100SMA inflection','200SMA reset','SMH breadth washout',
  'XSD breadth washout','semiconductor breadth washout','semi mean reversion',
  'above 20EMA zero','Higher High Higher Low','Low Volume Node','High Volume Node',
  'overhead supply','Burry AI short','AI infrastructure seller','AI monetization layer',
  'customer concentration risk','prepaid supply commitment','custom supply chain risk',
  'HBM cycle debate','memory cycle top','AI capex funding risk',
  '반도체','파운드리','HBM','AI 가속기','메모리','D램','낸드',
  // ── v31.8: AI/반도체 밸류체인 심화
  'GPU','TPU','NPU','AI accelerator','inference chip','training chip',
  'advanced packaging','chiplet','2nm','3nm','1.4nm','GAA','gate-all-around',
  'wafer','silicon','fab','foundry capacity','utilization rate',
  'NVIDIA','AMD','Intel','Broadcom','Marvell','Qualcomm',
  'high bandwidth memory','DDR5','LPDDR5','CXL','UCIe',
  'AI server','AI infrastructure','data center','hyperscaler',
  'CapEx','AI spending','cloud spending','AI adoption',
  'autonomous driving','robotics','humanoid robot','embodied AI',
  'AI agent','AI assistant','enterprise AI','edge AI',
  'transformer','large language model','LLM','foundation model',
  'AI regulation','AI safety','AI governance',
  // ── v37.6: 2026 핵심 기술 키워드 대폭 확장
  // 반도체 첨단패키징·인터커넥트
  'CPO','co-packaged optics','silicon photonics','optical interconnect',
  // v38.6: 광인터커넥트 심화 (레이저 병목, 변조기, 폼팩터)
  'VCSEL','EML','EML laser','DFB','DFB laser','CW laser',
  'WDM','wavelength division multiplexing','ELSFP','Kyber','Kyber rack',
  'Teralight','POET','optical interposer','InP','InP substrate','indium phosphide',
  'GaAs','gallium arsenide','EAM','MZM','MRM','TFLN','thin film lithium niobate',
  'NVIDIA COUPE','OFC 2026','optical standard','multimode fiber','MMF','single mode fiber','SMF',
  // v39.0f: NVIDIA 광학 제국 + AI 경쟁 구도 (2026.04)
  'Photonic Fabric','Celestial AI','NVLink Fusion','optical scale-up',
  'Ayar Labs','TeraPHY','Lightmatter','Passage','photonic interposer',
  'Scintil Photonics','OCS','optical circuit switch','R300 OCS',
  'MAI-Transcribe','MAI-Voice','MAI-Image','Microsoft AI','Mustafa Suleyman',
  'Maia chip','custom XPU','Structera',
  // v48.16 (integrate 2026-04-18): 신규 프레임워크 키워드
  'MTIA','Meta MTIA','MTIA v450','Arke',                        // Meta 커스텀 실리콘 — AVGO 다년간 파트너십 2029년까지
  'HBF','high bandwidth flash','HBM+HBF','inference memory',     // SanDisk AI 추론 메모리 신 카테고리
  'Glasswing','Project Glasswing','OpenAI TAC','Trust Access',   // Anthropic/OpenAI 보안 파트너 프로그램
  '테라팹','Terafab','머스크 테라팹',                              // Tesla/SpaceX JV 반도체 팹 계획
  'DustPhotonics','ZR optical','x402','Dynamic Workers',         // Credo 광학 수직통합, Cloudflare AI 에이전트 결제
  'Vera Rubin','Rubin CPX','CX9','NVLink Fusion',                // Nvidia 차세대 로드맵 추가 확장
  '네오클라우드','neocloud','frontier lab','Trainium chip',        // CoreWeave/Nebius 프론티어 연구소 인프라
  'LTA','long-term agreement','메모리 LTA',                       // 메모리 장기공급계약 레버리지 역전
  'Cloud Next','Google I/O','Marketing Live','Brandcast',        // Google 2026년 이벤트 캘린더
  'Ask Maps','Personal Intelligence','Search Live',              // Gemini 통합 확장
  // v38.6: DC 전력 심화 (HVDC, 전력 스택, parasitic loss)
  'HVDC','high voltage DC','parasitic energy','parasitic loss',
  'skin effect','thyristor','IGBT','power semiconductor','VRM',
  'rack power','TDP 2300W','Vera Rubin TDP','NVL72','NVL144','600kW rack','1MW rack',
  'PJM','grid interconnection','underground HVDC','Three Mile Island',
  'glass substrate','glass core','glass interposer',
  'CoWoS','CoWoS-L','CoWoS-S','InFO','EMIB','Foveros',
  'BSPDN','backside power delivery','backside power',
  'interposer','RDL','redistribution layer',
  'HBM4','HBM3E','HBM4E','12-Hi','16-Hi',
  // v39.0: GPU 렌탈/네오클라우드/메모리 가격 (SemiAnalysis/Jefferies/메리츠)
  'GPU rental','GPU shortage','compute rental','GPU rental index',
  'neocloud','CoreWeave','Nebius','GPU subletting',
  'DRAM price','NAND price','memory price','fixed price','contract price',
  // v53.43 (integrate 2026-07-20): P-game versus Q/capital-game lenses.
  'token deflation','memory price momentum','neocloud funding','GPU depreciation',
  'rental yield spread','capital runway','capex intensity','frontier model capex',
  'long-term agreement','floor price','prepayment','memory supercycle',
  // v54.11 (integrate 2026-08-11/12): briefing report themes and ticker clusters.
  'AI compute financing','compute financing platform','personal AI agent','on-device model',
  'humanoid shipment','physical AI shipment','custom AI silicon','equity offering','equity dilution',
  'earnings beat breadth','photonics earnings','neocloud earnings reaction','asset manager 200SMA',
  'oil and gas leadership','memory two-way risk','forced liquidation','margin deleveraging',
  // v53.90 (integrate 2026-08-09): power-quality and technical setup vocabulary.
  'AI data-center power','GPU load ramp','transformer thermal stress','harmonic distortion',
  'voltage flicker','rack load volatility','power-quality monitoring','GPU resale price',
  'frontier lab growth','memory LTA allocation','relative-strength pullback','climax top',
  'railroad track','200SMA stretch','support-zone reclaim','benchmark relative strength',
  'ADR threshold','52-week low position','dollar volume','EMA8 EMA21','supply-side short',
  'GPU 렌탈','GPU 부족','컴퓨트 렌탈','네오클라우드',
  '고정가','렌탈 가격','선지급','최소가격','메모리 슈퍼사이클',
  // AI 신패러다임
  'agentic AI','AI agent framework','multi-agent','agent orchestration',
  'reasoning model','chain of thought','test-time compute',
  'on-device AI','AI PC','AI phone','AI at the edge',
  'sovereign AI','national AI','AI sovereignty',
  'world model','video generation','text-to-video','image generation',
  // 컴퓨팅·네트워크
  'custom silicon','custom ASIC','Trainium','Inferentia','MTIA',
  'RISC-V','ARM architecture','Arm Holdings',
  'InfiniBand','NVLink','NVLink 6.0','Ultra Ethernet','UALink','NVLink Fusion',
  'DPU','SmartNIC','network switch','Tomahawk','Jericho',
  // 데이터센터·전력·냉각
  'liquid cooling','immersion cooling','direct-to-chip cooling',
  'data center power','power density','rack density',
  'nuclear data center','SMR data center','AI power demand',
  'UPS','power distribution','busbar','transformer shortage',
  // v40.4: SemiAnalysis 공급망 병목 + 미래에셋 쓰리백 (2026.04)
  'PCB bottleneck','CCL','copper clad laminate','drill bit shortage','multilayer PCB',
  'always-on agent','KAIROS','multi-agent workflow','token consumption','컴퓨팅 과점',
  'GPU spot price','B200 spot','compute oligopoly','infrastructure poverty','인프라 빈곤',
  'test equipment bottleneck','Teradyne','Advantest','테스트 장비',
  'modular data center','behind-the-meter','behind the meter power','EPC contractor',
  'Argan','AGX','Compass Systems','field labor shortage',
  'N3 sold out','TSMC N3','wafer allocation','cleanroom',
  'LSA prepayment','memory floor price','LSA선불금','모듈형 데이터센터',
  // v42.1: NVDA NTC + BofA 메모리슈퍼사이클 + Anthropic (2026.04)
  'neural texture compression','NTC compression','VRAM compression','texture compression',
  'Rubin Ultra','HBM Rubin','memory supercycle 2027','memory supercycle 2028',
  'ERLI','earnings revision leading indicator','이익수정선행지표',
  'helium supply chain','helium semiconductor','헬륨 공급망',
  // v43.1: WSTS 2026년 2월 + Intel 18A + MU LTA 구조개선 (2026.04, JP모건/KeyBanc)
  'WSTS','semiconductor revenue','monthly semiconductor',
  '18A','Panther Lake','Intel 14A','Humu Fish',
  'server CPU','server CPU demand','server CPU price',
  'LTA structure','pricing floor contract','Intel foundry customer',
  'DRAM pricing','NAND pricing','memory contract price',
  // v43.4: Citi 1Q26 + KeyBanc Asia Tour (HBM4/CoWoS/파운드리) + Anthropic/GPT 6.0 (2026.04)
  'EMIB-T','HBM4 qualification','HBM4 yield','HBM4 supply',
  'Lunar Lake','Lunar Lake sales','Lunar Lake revival',
  'analog price hike','analog pricing','analog semiconductor pricing',
  'GPT 6.0','GPT6','GPT-6','GPT6.0',
  'CoWoS supply','CoWoS capacity','CoWoS expansion',
  'Vera CPU','NVIDIA Vera','Vera Rubin CPU',
  'Taiwan ODM AI','Foxconn AI server','Quanta AI','Wistron AI server',
  'agentic AI CPU','agent CPU demand','agentic inference compute',
  'Anthropic ARR','Claude enterprise','Anthropic enterprise','Anthropic revenue',
  'GW-scale TPU','gigawatt TPU','GW TPU','TPU 2027 deployment',
  'Samsung HBM4','SK Hynix HBM4','Micron HBM4',
  // v43.4: TSMC 병목 + EMIB vs CoWoS 패키징 경쟁 + 3.5D 아키텍처 (2026.04, Damnang/JPM GTM)
  'SoIC','SoIC-T','SoIC-W','system on integrated chips',
  'Foveros Direct','hybrid bonding','copper-to-copper bonding','direct bonding',
  'XDSiP','Broadcom XDSiP','3.5D packaging','3.5D architecture',
  'Clearwater Forest','Intel 3.5D',
  'DTCO','design technology co-optimization','design-technology co-optimization',
  'PDK','process design kit','PDK migration','foundry switching cost',
  'tapeout cost','mask set cost','GDSII',
  'bump pitch','25um bump','35um bump','micro bump pitch',
  'OIP','Open Innovation Platform','TSMC OIP',
  'CoPoS','CoWoS-R','CoWoS-S','InFO packaging',
  'EMIB-M','MIM capacitor','power delivery network',
  'TSMC bottleneck','foundry bottleneck','wafer allocation',
  'AI hyperscalers','hyperscaler capex','hyperscaler weight',
  // v43.9: WF AMD Tactical + MS/JPM/Evercore/UBS MRVL-NVDA Partnership (2026.04.01)
  'Turin CPU','Zen 6','EPYC Turin','Diamond Rapids','EPYC share gain',
  'EPYC server CPU','AMD server CPU','server CPU TAM',
  'NVLink Fusion IP','XPU NVLink','NVLink scale-up',
  'CelestialAI EAM','EAM-based photonics','silicon photonics MRVL',
  'Scorpio X','ALAB Scorpio','NVLink switch',
  'AI-RAN 5G','AI-RAN 6G','Cavium baseband',
  'NVSwitch alternative','rack scale-up','heterogeneous compute',
  // v43.9: MS LRCX + Evercore WFE + Memory super-cycle + UBS Rubin Ultra (2026.04.06)
  'WFE forecast','wafer fab equipment','WFE 2026','WFE 2027',
  'memory super-cycle','DRAM super cycle','NAND super cycle',
  'Rubin Ultra 2-die','Rubin 288 rack','CoPoS 2026',
  'DRAM contract price','NAND contract price','memory contract',
  'KV cache memory','KV cache DRAM','agentic DRAM','agentic NAND',
  'MLPerf v6','MLPerf benchmark','CPO teach-in',
  'HBM bit growth','NAND bit growth','memory bit growth',
  'SABRE 3D','SABRE Syndion','etch equipment',
  // v43.9: KeyBanc Asia Tour — DC/서버/패키징 심화 (2026.04.05-06)
  'Zebra Fish','Humu Fish','Mediatek TPU','MTK TPU',
  'Trainium 3A','Trainium 3B','Trainium 4','AWS custom chip',
  'MTIA Arke','MTIA Iris','MTIA Apollo','MTIA Olympia',
  'Maia 300','Microsoft Maia','Maia delay',
  'FOCoS','Fan-Out CoS','fan-out chip on substrate',
  'VPD','vertical power delivery','lateral power delivery',
  'TLVR','transient lateral voltage','Dual Loop VR',
  'Aspeed power','power sequencing IP','BMC chip',
  'Alchip','Alchip ASIC','Google LTA','Google TPU LTA',
  'Rubin rack','VR rack','Vera Rubin rack',
  // 로봇·자율주행
  'humanoid','Figure','Boston Dynamics','Agility Robotics','1X Technologies',
  'Optimus Gen','Tesla Bot','warehouse robot','industrial robot',
  'L4 autonomy','L5 autonomy','lidar','perception','sensor fusion',
  // EV·배터리
  '800V architecture','800V platform','silicon carbide','SiC','GaN',
  'ultra-fast charging','solid state battery','sodium-ion battery',
  'LFP','NMC','dry electrode','4680 cell',
  // ── v37.7: 양자컴퓨팅
  'quantum computing','quantum computer','qubit','quantum advantage','quantum supremacy',
  'quantum error correction','topological qubit','quantum processor','quantum algorithm',
  'IONQ','IonQ','Rigetti','D-Wave','IBM Quantum','Google Willow','Quantinuum',
  'quantum networking','quantum cryptography','post-quantum','PQC',
  // v46.6: 광자 양자컴퓨팅 + 양자-암호 위협 (PhotonCap Xanadu + 돈스 Google/BTC)
  'photonic quantum','photonic QC','Xanadu','XNDU','Borealis','Aurora quantum','GKP qubit',
  'optical loss','squeezed light','silicon nitride PIC','PsiQuantum','photonic processor',
  'CRQC','cryptographically relevant quantum','quantum threat bitcoin','P2PK vulnerability',
  'fault tolerant quantum','OSAT','photomask','Amkor','Photronics','ASE Technology',
  // v46.6b: Citi CRWD Glasswing + JPM ASML + 대만 AI 3대장
  'Project Glasswing','Anthropic partnership','CRWD skill','agentic patching','fuzzing attack',
  'cyber fuzzing','KEV catalog','Overwatch telemetry','AI cyber arms race',
  'sovereign AI Japan','Japan AI Foundation Model','physical AI','NEDO trillion yen',
  'Samsung P5 fab','EUV order','ASML order disclosure','install base upgrade',
  'rack-level L11','GB300','Rubin transition','ODM AI server','ASIC multiplier growth',
  // v46.6c: Credo-DustPhotonics + Bloom-Oracle + SNDK SCA + 네오클라우드 수렴
  'DustPhotonics','SiPho PIC','silicon photonics vertical','Credo optical','ZeroFlap optics',
  'Bloom Energy','onsite generation','fuel cell datacenter','time-to-power','800V DC fuel cell',
  'SanDisk SCA','strategic contractual agreement','NAND structural tight','eSSD enterprise',
  'neocloud convergence','frontier lab neocloud','Meta CoreWeave','Anthropic CoreWeave','Vera Rubin architecture',
  // v46.9b: NAND SCA + HDD 재평가 + 광고 패권 + 기업 AI 3파전
  'NAND SCA','strategic contractual agreement NAND','NAND price floor','TurboQuant','TurboQuant storage',
  'Mozaic 4+','HAMR 44TB','100TB drive','140TB drive','HDD rerating',
  'Nanya DRAM investment','eSSD qualification','eSSD ramp','NAND ASP acceleration',
  'OpenClaw','GUI agent','computer use agent','Copilot GUI agent','digital agent automation',
  'OpenAI Bedrock','enterprise AI three-way','Claude mania','Anthropic ARR 300','OpenAI Amazon alliance',
  'META ad revenue overtake','Reels AI recommendation','AI video generation tool','Google search share decline',
  'Amazon LEO antenna','LEO gigabit aviation',
  'Western Digital','Seagate Technology','SanDisk earnings','WDC target','STX target',
  // ── v37.7: 우주경제·위성·LEO
  'space economy','LEO','low earth orbit','satellite constellation','Starlink',
  'AST SpaceMobile','Kuiper constellation','OneWeb','Iridium','Globalstar',
  'Planet Labs','Rocket Lab','Blue Origin','space station','orbital',
  'space data center','satellite internet','direct-to-cell','D2C satellite',
  // ── v37.7: 사이버보안 심화
  'zero trust','ZTNA','SASE','XDR','EDR','MDR','SOAR','SIEM',
  'ransomware','phishing','threat detection','identity security','IAM','PAM',
  'Fortinet','FTNT','SentinelOne','Okta','OKTA','Varonis','Rubrik',
  'cloud security','container security','DevSecOps','CNAPP','CSPM',
  'post-quantum cryptography','AI security','deepfake detection',
  // ── v37.7: 핵에너지 르네상스·전력인프라
  'nuclear renaissance','Constellation Energy','CEG','Vistra','VST','Talen Energy',
  'Three Mile Island','power purchase agreement','PPA','grid modernization',
  'NuScale','NuScale Power','OKLO','Kairos Power','TerraPower','X-energy',
  'transformer','grid transformer','power transformer','substation',
  'Quanta Services','EATON','Vertiv','Schneider Electric',
  // ── v37.7: AI 인프라 소프트웨어·MLOps
  'MLOps','AI inference','AI training','model serving','vector database',
  'RAG','retrieval augmented generation','fine-tuning','RLHF','DPO',
  'synthetic data','data labeling','Scale AI','Weights & Biases','Databricks',
  'Hugging Face','vLLM','TensorRT','ONNX','model optimization',
  // ── v37.3: 메가캡 테크 기업 · AI 기업 · 핵심 이벤트
  'Apple','AAPL','iPhone','iPad','Mac','Vision Pro','WWDC','App Store','Apple Intelligence',
  'Microsoft','MSFT','Windows','Azure','Copilot','Build','Activision',
  'Google','GOOGL','Alphabet','Search','YouTube','Waymo','Google I/O','Google Cloud',
  'Amazon','AMZN','AWS','Prime','Alexa','re:Invent','Kuiper','Amazon Robotics',
  'Meta','META','Facebook','Instagram','WhatsApp','Reality Labs','Llama','Threads',
  'Tesla','TSLA','FSD','Full Self-Driving','Robotaxi','Cybertruck','Optimus','Megapack','Terafab','Supercharger','Gigafactory',
  // ── 빅테크/AI CEO 키워드 (v42.1)
  'Jensen Huang','Lisa Su','Dario Amodei','Satya Nadella','Sundar Pichai',
  'Mark Zuckerberg','Andy Jassy','Tim Cook','Sanjay Mehrotra','Elon Musk',
  'Greg Brockman','Ilya Sutskever','Demis Hassabis',
  'NVIDIA','NVDA','GTC','Blackwell','Rubin','CUDA','DGX','Grace',
  // ── v37.3: AI 스타트업 · 플랫폼 기업
  'OpenAI','ChatGPT','GPT-5','Sora','Sam Altman','AGI',
  'Anthropic','Claude','constitutional AI',
  'xAI','Grok','Elon Musk AI',
  'Mistral','Cohere','Perplexity','AI21','Inflection',
  'Hugging Face','Stability AI','Midjourney','Runway',
  // ── v37.3: 클라우드 · SaaS · 사이버보안
  'Salesforce','CRM','ServiceNow','NOW','Snowflake','SNOW','Palantir','PLTR',
  'CrowdStrike','CRWD','Palo Alto','PANW','Datadog','DDOG','Zscaler',
  'Shopify','SHOP','Block Inc','PayPal','PYPL','Stripe',
  'Oracle','ORCL','Oracle Cloud','SAP','Workday','WDAY',
  // ── v37.3: 테크 이벤트 · 컨퍼런스
  'CES','MWC','GTC','WWDC','Google I/O','Build','re:Invent','re:MARS',
  'Computex','Computex 2026','GTC Taipei','GTC 타이페이','Computex keynote',
  'WF6','tungsten hexafluoride','Kanto Denka','Central Glass','silicon capacitor',
  'AI server MLCC','CPO/NPO','NPO','CW laser supply','EML capacity lock',
  'optical capacity lock','800V HVDC','SOFC data center','solid oxide fuel cell',
  'CoPoS glass substrate','glass substrate CoPoS','HBM4E sample','SOCAMM de-spec',
  'Vera Rubin Windows PC','ARM PC','NVDA PC chip','on-device AI PC',
  'Kioxia BiCS','BICS10','NAND scaling','수평 스케일링','낸드 수평 미세화',
  'MLCC shortage','MLCC supply','passive component price','MLCC 부족','수동소자',
  // v49.99 TECH_KW 추가 — Susquehanna·Dell실적·HBM점유율·일본반도체 (ANALYST_KW max+3 보완)
  'Susquehanna','Susquehanna upgrades','Susquehanna raises','Susquehanna initiates',
  'KB Securities','KB증권 목표가','KB증권 상향','KB 증권',
  'Lynx Equity','DA Davidson','Melius Research',
  'Dell FY27','Dell FY1Q27','Dell AI server revenue','Dell ISG',
  'AI server supply constraint','AI server backlog','AI 서버 수주잔고',
  'memory supply shortage','DRAM shortage','NAND shortage','메모리 부족','메모리 쇼티지',
  'HBM market share','HBM share','HBM 점유율','HBM 시장점유',
  'Foxconn shareholder','Foxconn Liu','류양웨이','폭스콘 주총',
  'Quanta earnings','Quanta Liu','량츠전','콴타 주총',
  'Fujitsu','후지쯔','Fujitsu MONAKA','MONAKA CPU',
  'Tokyo Electron TEL','TEL semiconductor','도쿄일렉트론','도쿄 일렉트론',
  'Winbond','윈본드','NAND flash price','낸드 플래시 가격',
  'memory contract price','메모리 계약가','분기 계약가',
  'product launch','developer conference','keynote','developer day',
  // ── v37.3: 한국어 테크 기업
  '엔비디아','테슬라','애플','마이크로소프트','구글','아마존','메타',
  '오픈AI','앤트로픽','일론 머스크','젠슨 황','팀 쿡',
  '자율주행','로보택시','로봇','휴머노이드','비전프로',
  'FSD','완전자율주행','기가팩토리','테라팹','슈퍼차저',
  // ── v31.8: 한국 반도체 심화
  '삼성전자','SK하이닉스','삼성파운드리','HBM3E','HBM4',
  '선단공정','첨단패키징','반도체 수출','반도체 장비','반도체 소재',
  'AI 서버','데이터센터','클라우드','하이퍼스케일러',
  '웨이퍼','실리콘','팹','가동률','수율',
  'GPU 수요','AI 투자','AI 인프라','전력 수요',
  // ── v37.6: 한국어 핵심 기술 키워드 대폭 확장
  'CPO','광패키징','광인터커넥트','실리콘 포토닉스',
  // v38.6: 광인터커넥트+전력 한국어
  '광트랜시버','EML레이저','VCSEL','DFB레이저','파장분할다중화','인듐인화물','InP기판',
  '광인터포저','테라라이트','포엣','HVDC','고압직류','전력손실','스킨이펙트',
  '전력반도체','랙전력','기생에너지','PJM','계통연계','지중HVDC',
  '유리기판','글래스기판','글래스코어','글래스인터포저',
  '에이전틱AI','AI에이전트','멀티에이전트','에이전트',
  '온디바이스AI','AI PC','AI폰','소버린AI',
  '추론모델','체인오브쏘트','테스트타임컴퓨트',
  '맞춤형실리콘','커스텀칩','ASIC','트레이니움','인퍼런시아',
  '인피니밴드','NVLink','초고속네트워크',
  '액침냉각','수냉','직접냉각','데이터센터전력',
  '전력반도체','SiC','탄화규소','GaN','질화갈륨',
  '800V','초고속충전','전고체배터리','나트륨이온배터리',
  '휴머노이드로봇','피규어','보스턴다이나믹스','테슬라봇',
  'L4자율주행','라이다','센서퓨전',
  '리스크파이브','RISC-V','ARM아키텍처',
  '후면전력전달','BSPDN','재배선층',
  // ── v37.7: 한국어 양자·우주·사이버·원전 키워드
  '양자컴퓨팅','양자컴퓨터','큐비트','양자우위','양자암호',
  '우주경제','저궤도위성','위성인터넷','스타링크','우주데이터센터',
  '제로트러스트','사이버보안','랜섬웨어','클라우드보안','AI보안',
  '원전르네상스','소형모듈원전','뉴스케일','전력망','변압기','송전','배전',
  'MLOps','AI추론','AI학습','벡터DB','RAG','파인튜닝','합성데이터',
  // ── v38.5: 신규 키워드
  'NVLink Fusion','AI-RAN','XPU','semi-custom AI',
  'Enterprise SSD','LTA','long-term agreement',
  'Foundry 2.0','파운드리 2.0',
  // v39.2: 6개 자료 통합 (2026.04.03)
  // 샘 알트먼 AGI/Sora
  'automated researcher','automated company','OpenClaw','super agent',
  'AGI timeline','cognitive horsepower','AI resilience','compute crunch',
  'Sora shutdown','Sora cancelled','video generation shutdown',
  '자동화된 연구원','자동화된 회사','슈퍼에이전트','인지능력','AI 회복탄력성',
  // AMD HBM/메모리
  'HBM sold out','HBM shortage','HBM4E','custom HBM','co-designed memory',
  'VVP pricing','NVDA VVP','memory BOM','에이전틱 토큰','KV cache',
  'Helios','MI455X','12-stack HBM','16-stack HBM',
  // SemiAnalysis 메모리 CapEx
  'memory CapEx','memory inflation','DRAM repricing','LPDDR5 price',
  'B200 server price','server price increase','memory supercycle 2027',
  'hyperscaler memory spend','메모리 CapEx','메모리 인플레이션',
  // MS 일본 DC
  'data sovereignty','데이터 주권','Japan data center','Takaichi AI strategy',
  // v44.5: Capex 효율화 사이클 + 네오클라우드 + 자본조달 (2026.04.08)
  'Capex efficiency cycle','AI ROI cycle','GPU utilization maximize','inference optimization cycle',
  'CoreWeave CRWV','Nebius NBIS','neocloud GPU rental','neocloud overhang',
  'IREN neocloud','NBIS upside','neocloud sector rotation',
  'AI fabric bottleneck','network fabric performance','AI performance bottleneck',
  // v44.2: MSFT/AVGO/Samsung/LITE/CRDO 6개 리포트 통합 (2026.04.07, GS/Citi/JPM/미즈호)
  // CRDO AEC/ZFO/ALC
  'AEC cable','active electrical cable','AEC 800G','AEC 1.6T','Credo AEC',
  'ZeroFlap optics','ZFO transceiver','ZFO optics','zero flap optics',
  'active linear cable','ALC cable','ALC optics','ALC transceiver',
  // MSFT Azure 공급제약
  'Azure Fairwater','Fairwater data center','Azure supply constraint',
  'Microsoft E7','M365 E7','E7 license','Copilot E7','M365 SOTP',
  'Copilot monetization','Azure Fairwater ramp',
  // LITE CPO/OCS scale-up
  'OCS scale-up','scale-up CPO','Rosa Feynman CPO','Feynman CPO',
  'UHP laser','ultra-high-power laser','UHP CW laser','UHP EML laser',
  'OCS backlog','OCS contract backlog','Lumentum OCS',
  // Samsung memory 지속가능성
  'Samsung 1Q26','memory fill rate','memory supply fulfillment',
  'memory earnings sustainability','memory cycle sustainability',
  // Serdes 기술
  'Credo Serdes','CRDO Serdes','Serdes DSP','DSP-based AEC',
  // v44.8: DC전력+AI보안+맥북 통합 (2026.04.09)
  'MacBook Neo','chip binning','binned chip supply','A18 Pro binned',
  'Project Glasswing','Claude Mythos','shadow AI','shadow IT AI',
  'aeroderivative turbine','prime power generation','load following power',
  'demand response datacenter','inference datacenter proximity','BTM gas power',
  '맥북 네오','칩 빈닝','빈닝 칩','클로드 미토스','섀도 AI',
  // v46.4: NAND HBF + AI사이버 임계점 + 걸프 인프라 + TPU 로열티 (2026.04.10)
  'KVCache eSSD','KV cache SSD','high bandwidth flash','HBF NAND','16-layer SLC',
  'QLC eSSD','NAND wafer capacity','NAND supply tight','375L NAND','459L NAND',
  'SanDisk HBF','SNDK earnings','WDC earnings','STX earnings',
  'GPT-5.3-Codex','Codex cyber','gated release','trusted access cyber','cyber trust',
  'Anthropic custom chip','Anthropic chip design','AI lab chip',
  'Lumentum orders','LITE backlog','InP laser capacity','CPO backlog 2028',
  'TPU royalty','TPU asset-light','GCP marginal OI','cloud OI contribution',
  'KVCache','고대역폭 플래시','NAND 공급 타이트','제한적 공개','사이버 신뢰',
  '앤트로픽 자체칩','TPU 로열티','클라우드 한계이익률',
  // v46.6: 2026 신규 AI/반도체 키워드 확장
  // 추론 모델 (O1/O3/O4)
  'o1','o3','o4-mini','test-time compute','inference scaling','reasoning model','chain of thought',
  'GPT-5','GPT-o1','o1-mini','o3-mini',
  // Stargate / 대규모 AI 인프라
  'Project Stargate','Stargate','$500B','hyperscaler investment','AI infrastructure fund',
  'magnitude of compute','sovereign AI fund','AI sovereign',
  // 신규 AI칩 기업
  'Cerebras','wafer scale engine','Cerebras IPO','Graphcore','IPU',
  'Groq','LPU','inference optimization','Groq IPO',
  'SambaNova','Tenstorrent','Habana','Gaudi3',
  // 소형 모델 / 효율화
  'distillation','knowledge distillation','PEFT','LoRA','QLoRA','quantization',
  'edge inference','on-device inference','parameter efficient',
  // 패키징 혁신
  'glass substrate','direct bonding','hybrid bonding','chiplet standard','UCIe',
  'fan-out wafer','FOWLP','panel level packaging','2.5D packaging',
  // 전력 반도체 / 차세대
  'GaN power','SiC MOSFET','wide bandgap','전력반도체','GaN','SiC',
  // 한국어 추가
  '추론 모델','추론 스케일링','테스트타임 컴퓨트','스타게이트',
  '세레브라스','그록','지식 증류','엣지 추론','유리기판','하이브리드 본딩','칩렛 표준',
  // v46.6: Cantor AI 인프라 + 번스타인 Muse + Citi SW Shock + 미즈호/Citi 오라클
  'neocloud','neo-cloud','네오클라우드','AI factory','AI 팩토리',
  'credit wrapper','credit backstop','크레딧 래퍼','크레딧 백스톱',
  'BYOG','bring your own generation','자체 발전',
  'time-to-power','time to power','colocation rent','코로케이션 렌트',
  'GPU time','GPU 시간단가','MW per rack','랙당 전력밀도',
  'Mission Control','오케스트레이션 스택','GPU orchestration',
  'Muse Spark','Contemplating mode','Vals Index',
  'Fusion Agentic','Agent Hub','AI Agent Studio','에이전틱 앱',
  'vibe coding','바이브 코딩','RoCE fabric','off-box virtualization',
  'seat-based','좌석 기반','AI shock','terminal value risk',
  // v47.1: TD Cowen DC채널체크 + QCOM 추론시장 + DC리싱 구조 (2026.04.16)
  'DC leasing','data center leasing','GW-scale leasing','DC leasing record',
  'powered shell','triple-net pricing','powered shell deal','turn-key DC',
  'Snapdragon X Elite','Snapdragon X Plus','Windows on ARM','Copilot+ PC',
  'AI PC rerating','on-device inference platform','edge AI PC','AI PC NPU',
  'QCOM rerating','inference market','device AI','디바이스 AI','추론 시장',
  '스냅드래곤 X 엘리트','윈도우 온 ARM','AI PC 리레이팅','DC 리싱',
  '파워드 쉘','트리플넷','데이터센터 리싱',
  // v48.61 (integrate 2026-04-21): 20개 자료 통합 (JPM/Citi/GS/WF/TDC)
  // Apple CEO 전환 (Tim Cook → John Ternus 2026-09-01)
  'John Ternus','Ternus CEO','hardware CEO','Johny Srouji','Arthur Levinson',
  'Executive Chairman','Chief Hardware Officer','스마트폰 이후 폼팩터','Apple M 시리즈 전환',
  'Vision Pro 총괄','Personal Siri','personalized Siri','WWDC 2026',
  // Anthropic Mythos + OpenAI GPT-5.4-Cyber (사이버 무기화 시대)
  'Mythos','Mythos model','Anthropic Mythos','Opus 4.7 cyber','GPT-5.4','GPT-5.4-Cyber',
  'Cyber Verification Program','cyber verification','Project Glasswing II',
  'Trust Access for Cyber','TAC program','OpenAI TAC','Trust Access',
  'LLM weaponization','LLM 무기화','exploit generation','exploit 자동생성',
  'vulnerability discovery AI','OpenClaw','SUNBurst scale','CVE 대량공개','zero-day 민주화',
  'runtime control','런타임 통제','shadow value','그림자 가치체계',
  'CAISI','AISI evaluation','UK AISI','CTEM','continuous threat exposure',
  // AI 서밋 프레임워크
  'AI Teammate','AI 팀메이트','task-level agent','Frontier Platform','Project Glasswing',
  '2.5조 Capex','Vinod Khosla','실업률 50%','토큰세','sovereign fund',
  'problem definition bottleneck','병목 문제정의','million agents','Lightning AI',
  'Harvest Now Decrypt Later','수집 후 복호화','Y2K moment','PQC migration',
  // 반도체 프레임워크 (AVGO/MRVL/NVDA/ARM)
  'Helios AMD','MI450 ramp','AMD Helios','Tomahawk 6','Tomahawk6',
  'AVGO 7년 14칩','구글 TPU LTA 갱신','V10 TPU','Ironwood Sunfish',
  'XPU 플랫폼','XPU customer','XPU market','AVGO Samsung 2nd foundry',
  'Mediatek TPU 2nm','MRVL TPU 부인','Grok LPU','MRVL LPU',
  'NVDA 자사주 매입 부족','Vera CPU 마진','토큰당 총이익','token gross margin',
  'ARM AI CPU','ARM 칩당 1000달러','Masa 2위','loss of OS','Socionext',
  'INTC 14A 고객','Lip-bu Tan','Musk Terafab','파운드리 다자화',
  // 메모리 & HBF
  'HBF roadmap','SNDK HBF','HBF pilot','HBF 2027','16-layer NAND',
  'HBM+HBF hybrid','inference tier memory','용량 최적화 메모리','scale-up memory',
  'CX9 NIC','CX9 지연','1.6Tb/s port','Rubin CX8','Rubin CX9',
  'VR server','동서 트래픽 40배','east-west traffic','Rubin ramp delay',
  // 광통신 네트워킹 (GS 테마)
  'scale-up optical','scale-out optical','광통신 TAM 9배','1.6T optics','3.2T optics',
  'HCF','hollow core fiber','Innolight 1.6T','Eoptolink','TFC Optical',
  'Victory Giant PCB','PCB midplane','미드플레인','RoboTechnik','YJ Semi EML',
  'YOFC fiber','Lumentum CPO','Lumentum 20억','Michael Hurlston','Applied Optoelectronics',
  'copper 1.5m limit','구리 유효거리','photonic interconnect 변곡점',
  // 글로벌 AV (GS)
  'robotaxi TAM','로보택시 TAM','AV truck TAM','virtual driver','가상 운전자',
  'Waymo 15 cities','Waymo 49 markets','PONY 20 cities','WeRide expansion',
  'Alpamayo','Mercedes CLA L2+','AV trucking','Aurora 1000','Kodiak AV','Waabi','Plus AV',
  'TpVD','Trips per Vehicle per Day','UCAN rideshare','SAAR decline','per-mile COGS',
  'FSD v14','FSD subscription','Tesla FSD 매출','7 robotaxi cities','인간 운전자 5-7배 안전',
  'remote operator ratio','teleoperator','delivery robot','배송 로봇',
  'Applied Intuition','Isuzu L4','Shield AI','F-35급 자율','Skild AI','omnibody brain',
  // 데이터센터 & VRT
  'Vertiv 수주','VRT Investor Day','DC pipeline 415GW','Q1 50GW 추가',
  'held-back demand','억눌린 수요','EMEA -22.5%','AMER +45%',
  'incremental margin','증분 마진','가격원가관세','pricing cost tariff',
  // Google 1Q26 클라우드 가속
  'Google Cloud +50%','GCP acceleration','Wiz 통합','Wiz closed',
  'Search AI mode','AI Overview','AI Overviews 참여','YouTube CTV 가속',
  'Shorts monetization','Gemini 3','Cloud backlog',
  // Astera / Broadcom / Lightmatter (Day 2)
  'Astera Scorpio','Scorpio PCIe','Scorpio X','Astera 200억 TAM',
  'M1000 114Tb','Lightmatter 70x','OCI 1.6Tb','Qualcomm photonic',
  'Broadcom XPU 8000억','hyperscaler 6650억','티어2 네오클라우드',
  // 기타
  'Manus acquisition','0→1억 ARR','Mercor 1B ARR','Cursor 3',
  'survivor charge','생존자 비용','Dell memory surcharge',
  // v48.65 (integrate 2026-04-25): 우주·전력반도체·유리기판·패턴분석
  // 전력반도체 800V HVDC 생태계
  'GaNFast','GeneSiC','Navitas','NVTS GaN','800V HVDC rack','800V power semiconductor',
  'Wolfspeed SiC','WOLF SiC turnaround','SiC MOSFETs','wide-bandgap semiconductor',
  'Power Integrations','POWI GaN','PowiGaN','1MW rack power','Kyber 800V',
  '800V HVDC AI','800V 데이터센터','GaN 전력반도체','SiC 800V','1MW 랙',
  // 우주 경제 2026 확장
  'Starlab','Voyager Starlab','commercial space station','orbital economy',
  'Firefly Aerospace','Blue Ghost lunar','Firefly Eclipse','medium launch vehicle',
  'Karman Holdings','KRMN space','space propulsion','launch vehicle propulsion',
  'SHIELD IDIQ','SDA Tranche 3','Space Development Agency','space-based missile warning',
  'Neutron rocket','Rocket Lab Neutron','Neutron first flight',
  'direct-to-device satellite','D2D satellite','satellite direct to cell',
  'BlueBird satellite','BlueBird AST','AST SpaceMobile BlueBird',
  'Lanteris acquisition','Lanteris Intuitive Machines','LUNR Lanteris',
  'LTVS lunar','lunar terrain vehicle','lunar service contract',
  'Iridium NTN','NTN Direct','non-terrestrial network D2D',
  'EchoStar spectrum','SATS spectrum sale','Globalstar Amazon',
  'UFO space ETF','ROKT space ETF','space economy ETF',
  '스타랩 우주정거장','상업우주정거장','파이어플라이 에어로스페이스','블루 고스트 달착륙',
  '우주경제 2026','달착륙선','우주발사체','SDA 위성 방위','직접위성통신',
  // 유리기판 심화
  'through-glass via','TGV packaging','glass interposer AI',
  'Corning glass substrate','GLW semiconductor glass','Absolics glass',
  'Onto Innovation glass','ONTO TGV inspection','glass substrate inspection',
  'glass substrate AMD MI400','glass core AI package',
  '관통 유리 비아','TGV','유리기판 AMD','Absolics 조지아',
  // 기술적 분석 패턴 (William O'Neil/Minervini 기반)
  'cup with handle','cup handle pattern','double bottom pattern','flat base pattern',
  'ascending base','high tight flag','3 tight closes','short stroke pattern',
  'saucer base pattern','square box pattern','VCP pattern','volatility contraction',
  'base breakout','buy point','pivot point TA','shakeout plus three',
  'secondary buy point','handle buy point','base on base','base count reset',
  'undercut base','base count','4th stage base','3rd stage base failure',
  '컵위드핸들','이중바닥 패턴','플랫베이스','어센딩베이스','하이타이트플래그',
  '3타이트클로즈','숏스트로크','베이스브레이크아웃','VCP 패턴','변동성수축패턴',
  '매수포인트','피벗포인트','베이스카운트','언더컷베이스',
  // 매크로 리스크 관리 프레임워크
  'dual scenario planning','양방향 시나리오','risk calibration investing',
  'macro risk tool','position concentration risk','personal black swan',
  // OI 모멘텀 프레임워크 (선물/암호화폐 기술분석)
  'open interest momentum','OI momentum','OI EMA crossover','OI breakout signal',
  'open interest expansion','open interest contraction','OI reversal signal',
  '미결제약정 모멘텀','미결제약정 EMA','OI 모멘텀','미결제약정 확장','미결제약정 수축',
  // v48.71 (2026-05-02): BootDrive + 메모리 4계층 + AI ARR + QCOM ASIC
  'BootDrive','boot drive','OS drive NVMe','부트드라이브',
  'BlueField-4','BlueField4','BF4 DPU','DPU boot',
  'MonTitan','MonTitan NAND','TLC boot SSD','MonTitan TLC',
  'ICMS','in-context memory storage','KV cache offload NAND',
  'SOCAMM2','SO-CAMM2','server DRAM 2TB',
  'memory SCA','strategic commercial agreement memory','SCA agreement',
  'BiCS8','BiCS9','BiCS 3D NAND',
  'enterprise SSD capacity 134%','eSSD TAM','eSSD exabyte',
  'NL HDD 21TB','nearline HDD capacity','hyperscale HDD EB',
  'HAMR qualification','HAMR customer','Mozaic4 HAMR',
  'G1 memory','G2 memory','G3 memory','G3.5 memory','G4 cold storage',
  'memory hierarchy AI','4-tier memory',
  'reverse SaaS','역SaaS','memory as subscription',
  'RPO backlog storage','remaining performance obligation SSD',
  'hyperscaler capex $700B','CapEx $1 trillion','CY27 capex',
  'AI ARR $37B','cloud AI revenue run rate','AI ARR acceleration',
  'Bedrock tokens','Trainium utilization','AWS backlog $364B',
  'Copilot 20M seats','M365 Copilot seat','AI seat growth',
  'HBF high bandwidth flash','HBF 512GB','HBF stack',
  'NVL72 rack','NVL144','Vera Rubin NVL',
  'BootDrive NVMe boot server','NVMe OS drive server',
  'QCOM DC ASIC','Qualcomm hyperscaler ASIC','Snapdragon ASIC datacenter',
  'QCOM automotive record','Snapdragon Digital Chassis','자동차 반도체 QCOM',
  // v51.09 (integrate 2026-06-22): Minervini 차트 분석 + BROS VCP 돌파 예시
  'Minervini','Minervini pressure','Minervini Buy Risk','Minervini TPR',
  'TPR','Trend Persistence Ratio','RPR','Relative Price Ratio',
  'Dutch Bros','BROS','Dutch Bros Coffee',
  'ASML EUV clarification','ASML EUV no export','ASML China EUV',
  'SK Hynix number one','SK Hynix market cap 1st','SK하이닉스 시총 1위','하이닉스 삼성 역전',
  'HBM leadership','HBM market leader','HBM 주도권 교체',
  // v51.13 (integrate 2026-06-23): HALOS + Vera Rubin EU + Micron Anthropic + CRDO 상향 + SpaceX 회사채 + DeepMind
  'HALOS platform','NVIDIA HALOS','HALOS safety','HALOS humanoid','엔비디아 HALOS','HALOS 로봇 안전',
  'AI factory Europe','European AI factory','유럽 AI 팩토리','AI 슈퍼컴퓨터 유럽','Europe 35 AI',
  'Vera Rubin supercomputer','Vera Rubin EU','Vera Rubin 35 countries','베라 루빈 유럽',
  'Micron Anthropic partnership','MU Anthropic','Micron AI memory','AI memory architecture',
  'AI 메모리 아키텍처','마이크론 앤트로픽','Micron HBM Anthropic','memory co-development',
  'Reflection AI','Reflection computing','리플렉션 AI','SpaceX Reflection 63 billion',
  'SpaceX bond','SpaceX 회사채','SpaceX debt issuance','스페이스엑스 채권',
  'SpaceX IPO low','SpaceX stock drop','스페이스엑스 IPO 최저','SpaceX market cap decline',
  'Credo Evercore 325','CRDO Stifel 350','Credo PT upgrade','크레도 목표주가 상향',
  'DeepMind exodus','DeepMind talent leaving','딥마인드 인재 이탈','DeepMind Anthropic move',
  'Alphabet DeepMind','Google DeepMind researchers','딥마인드 연구원','GOOG 7 percent drop',
  'Amazon Prime Day 2026','Prime Day 26 billion','프라임데이 2026','Prime Day 263',
  'silver 67','silver spot ounce','은 현물 67달러','silver rally 3 percent',
  'defense CEO meeting','방산 CEO 회동','Pentagon 52 billion','국방부 529억',
  'Patriot THAAD tomahawk expansion','패트리엇 THAAD 토마호크','탄약 재고 보충',
  'Russell 2000 3000','RUT 3000','소형주 3000','Russell record high',
  'bank stocks record','KBW bank record','은행주 신고가','banks all-time high',
];
// MED_KW: 일반 기업/시장 이슈 → 보통 중요도 (+6점)
const MED_KW = [
  'earnings','quarterly results','revenue beat','revenue miss',
  'guidance raise','guidance cut','outlook','beat estimates','miss estimates',
  'acquisition','merger','IPO','buyback','dividend','spin-off',
  'partnership','strategic partnership','strategic alliance','joint venture','collaboration',
  // v38.6: 광통신·전력 기업이슈
  'optical transceiver','광트랜시버','EML laser','VCSEL','DFB laser',
  'laser bottleneck','레이저 부족','레이저 병목','InP shortage','인듐인화물 부족',
  'HVDC','power delivery','전력전달','AC DC','전력 변환',
  'Kyber rack','ELSFP','optical interposer','광인터포저',
  'photonics semiconductor','포토닉스 반도체','Luxshare','FIT','LITEON','Lessengers',
  'strategic investment','power plant','data center power','satellite','LEO satellite',
  '파트너십','전략적 제휴','합작','위성통신','발전소','데이터센터 전력',
  'chip','battery','electric vehicle','cloud','SaaS','cybersecurity','blockchain',
  'bitcoin','crypto','ETF','recall','lawsuit','regulatory',
  // ── v31.8: 기업 이벤트 심화
  'stock split','secondary offering','share repurchase','tender offer',
  'activist investor','proxy fight','board shake-up','CEO change','CFO',
  'insider buying','insider selling','Form 4','13F filing','SEC filing',
  'index inclusion','index exclusion','S&P 500 addition','rebalancing',
  'lockup expiry','lockup expiration','pipe deal','shelf registration',
  'credit rating','Moody','Fitch','S&P rating','rating downgrade','rating upgrade',
  'profit warning','revenue shortfall','cost cutting','restructuring','layoff',
  'capex','capital expenditure','R&D spending','operating margin','gross margin',
  'free cash flow','FCF','EBITDA','operating income','net income',
  'same-store sales','comparable sales','backlog','order book','bookings',
  'ASP','average selling price','unit shipments','market share',
  'patent','intellectual property','trade secret','antitrust','monopoly',
  'supply shortage','inventory build','channel check','demand trend',
  'defense','defence','military','weapon','missile defense','arms deal',
  // ── v37.6: 방산·에너지·EV 키워드 보강
  'Golden Dome','Iron Dome','missile shield','hypersonic defense','space defense',
  'drone defense','counter-drone','directed energy','laser weapon',
  'nuclear power','SMR','uranium','renewable energy','solar','wind',
  'EV battery','lithium','cobalt','nickel','cathode','anode','solid state battery',
  '800V','SiC inverter','fast charging','battery swap','V2G','vehicle-to-grid',
  // ── v37.7: GLP-1·비만치료제 세부 확장
  'Wegovy','Ozempic','Mounjaro','Zepbound','tirzepatide','semaglutide','liraglutide',
  'oral GLP-1','GLP-1 agonist','incretin','weight loss drug','obesity drug','anti-obesity',
  'Medicare obesity','Medicare GLP-1','Novo Nordisk','NVO','Eli Lilly','LLY','Amgen obesity',
  // ── v37.7: 바이오·제약 심화
  'bispecific antibody','ADC','antibody drug conjugate','CAR-T','cell therapy','gene therapy',
  'mRNA','RNA therapeutics','CRISPR','gene editing','BBB shuttle','brain-blood barrier',
  'Phase 1','Phase 2','Phase 3','NDA','BLA','PDUFA','EMA approval',
  'orphan drug','rare disease','oncology','immunotherapy','checkpoint inhibitor','PD-1','PD-L1',
  'biosimilar','generic drug','patent cliff','loss of exclusivity','LOE',
  // ── v37.7: ESS·에너지저장
  'ESS','energy storage','BESS','grid-scale battery','grid storage','battery storage',
  'stationary storage','utility-scale','peak shaving','frequency regulation',
  // ── v37.7: 조선·해운·해양
  'shipbuilding','shipyard','newbuild','order book','vessel','tanker','bulk carrier',
  'container ship','LNG carrier','warship','naval vessel','frigate','destroyer',
  'HD Hyundai','Hanwha Ocean','Samsung Heavy','Daewoo Shipbuilding',
  // ── v37.7: 우주·위성 기업
  'SpaceX','Rocket Lab','RKLB','Blue Origin','satellite','Starlink','AST SpaceMobile','ASTS',
  'Iridium','IRDM','Globalstar','GSAT','Planet Labs','L3Harris','LHX',
  // ── v37.7: 사이버보안 기업 이벤트
  'ransomware attack','data breach','cyber attack','zero-day','vulnerability',
  'Fortinet','FTNT','SentinelOne','Okta','Rubrik','IPO',
  'biotech','FDA approval','clinical trial','Phase 3','drug pipeline',
  'SPAC','de-SPAC','direct listing','Dutch auction',
  // ── v37.3: 기업 이벤트 · 제품 · 규제 보강
  'product launch','product reveal','product announcement','new product',
  'developer conference','keynote','investor day','analyst day','capital markets day',
  'CEO','CTO','CFO resignation','management change','succession',
  'antitrust ruling','DOJ','FTC','EU fine','consent decree','breakup',
  'data breach','security incident','outage','service disruption',
  'content moderation','platform ban','TikTok ban','Section 230',
  'streaming','subscriber','subscriber growth','churn','ARPU',
  'Netflix','NFLX','Disney','DIS','Spotify','SPOT',
  'Uber','UBER','Airbnb','ABNB','DoorDash','DASH','Instacart',
  'Visa','Mastercard','Amex','AXP',
  'JPMorgan','Goldman Sachs','Morgan Stanley','Bank of America','Citigroup',
  'Berkshire','Buffett','Munger',
  // ── v37.3: 한국어 기업 이벤트 보강
  '제품 출시','신제품','개발자 컨퍼런스','키노트','투자자의 날',
  '독점금지','반독점','벌금','규제','플랫폼 규제',
  '데이터 유출','서비스 장애','해킹',
  '넷플릭스','디즈니','스포티파이','우버','에어비앤비',
  '버크셔','버핏','JP모건','골드만삭스','모건스탠리',
  // ── v31.8: 한국어 기업 이벤트
  '실적','매출','영업이익','순이익','가이던스','전망','컨센서스',
  '자사주','자사주 매입','자사주 소각','배당','증자','감자',
  '인수합병','M&A','공개매수','경영권','지배구조',
  '공매도 잔고','신용잔고','대차잔고','기관 순매수','외국인 순매수',
  '상장폐지','거래정지','관리종목','불성실공시',
  '방산','방위산업','무기','군수','원전','원자력','우라늄',
  // ── v37.6: 한국 방산·에너지·EV·바이오 키워드 보강
  '골든돔','아이언돔','미사일방어','극초음속','우주방위','드론방어','레이저무기',
  'SMR','소형모듈원전','원전수출','한수원','두산에너빌리티',
  '2차전지','리튬','배터리','전기차','수소','태양광','풍력',
  '800V','초고속충전','전고체배터리','나트륨이온','LFP','하이니켈',
  'SiC 인버터','배터리스왑','V2G',
  '바이오','신약','임상','FDA','식약처',
  'GLP-1','비만치료제','바이오시밀러','ADC','항체약물접합체',
  '조선','LNG선','컨테이너선','벌크선','해운',
  // ── v37.7: 한국 바이오·ESS·조선·우주 키워드 보강
  '위고비','오젬픽','마운자로','제패운드','세마글루타이드','티르제파타이드',
  '경구GLP-1','비만약','체중감량','항비만','노보노디스크','일라이릴리',
  '이중항체','CAR-T','세포치료','유전자치료','mRNA','크리스퍼','유전자편집',
  '알테오젠','에이비엘바이오','삼성바이오로직스','셀트리온','SK바이오사이언스',
  'ESS','에너지저장','BESS','그리드','계통안정화','피크셰이빙',
  'HD현대중공업','한화오션','삼성중공업','HD현대미포','군함','호위함','구축함',
  '한화에어로스페이스','현대로템','LIG넥스원','풍산',
  '우주항공','위성','발사체','누리호','스타링크','저궤도',
  '사이버공격','랜섬웨어','해킹','보안사고','제로데이',
  // v48.67 (integrate 2026-04-26): 추론 아키텍처 분화·TSMC 이원화·SKH 기술·Tesla HW4+
  'SparseCore','TPU 8t SparseCore',                         // Google TPU 8t 임베딩·불규칙 메모리 엔진
  'Boardfly','Boardfly ICI',                                 // TPU 8i 추론 전용 네트워크 토폴로지
  'SOCAMM2','SoCAMM2','SOCAMM 192GB',                      // NVDA Vera CPU용 1c nm LPDDR5X 192GB 모듈
  'LPDDR6','LPDDR6X',                                       // SKH 차세대 저전력 메모리 (업계 최초 개발)
  'CXL 2.0','CXL memory pooling',                          // SKH CXL 메모리 확장 인터페이스 v2
  'TSMC A12','A12 node',                                    // TSMC 2029 AI/HPC 후면전력 노드
  'TSMC A13','A13 node',                                    // TSMC 2029 클라이언트 (A14 광학 축소)
  'N2U','TSMC N2U',                                         // TSMC 2028 N2 3년차 확장 (+3~5% 성능)
  'HW4+','Tesla HW4 Plus','HW4 chipset 64GB',              // 테슬라 신규 자율주행 칩셋 (64GB, 2027 양산)
  '321-layer NAND','321L NAND','321단 낸드',               // SKH 321단 NAND (2026 국내 50% 전환 목표)
  // v48.87 (integrate 2026-05-07): 25건 시장 자료 기술 키워드
  'AGI CPU','AGI CPU pipeline','ARM AGI CPU',             // ARM AGI CPU 파이프라인 $2B+
  'Scorpio','Scorpio X','Scorpio XPU',                    // ALAB Scorpio XPU 콘텐츠
  'Helios','MI450','MI455',                               // AMD MI450/Helios 차세대 GPU
  'Venice','Zen 6','Turin EPYC',                         // AMD 차세대 CPU
  'Trainium3','Trainium4',                               // AWS Trainium3/4 세대
  'AIDC ESS','AIDC battery storage',                     // AI DC 에너지 저장
  '나트륨이온','sodium-ion battery AIDC','CATL sodium-ion', // 나트륨이온 AIDC 배터리
  'NVLink Fusion','NVLink Fusion ALAB',                  // ALAB NVLink Fusion
  'KV cache offload','KV캐시 오프로드',                  // ALAB KV캐시 오프로드
  'CXL memory expansion','CXL 메모리확장',               // ALAB CXL 메모리
  'Nebius AI','Nebius cloud',                            // Nebius AI 인프라
  'CoreWeave CRWV',                                      // CoreWeave 티커
  'ALAB','Astera Labs',                                  // ALAB 신규 편입
  'OCS','optical circuit switch','광회로스위치',         // OCS 광통신 신기술
  'InP 6인치','InP 6-inch','InP wafer scale',           // Coherent InP 6인치 전환
  'COHR NVIDIA','Coherent NVIDIA',                       // COHR-NVDA 장기 계약
  'Corning NVIDIA','NVIDIA optical partnership',         // NVIDIA-Corning CPO 파트너십
  'CPO ramp','CPO scale-out','CPO scale-up',            // CPO 매출 램프업
  'Palantir AIP','Rule of 40','Rule of 120',            // PLTR 지표
  'HAWK','HawkEye 360','RF geospatial',                 // HawkEye360 신규
  'scale-across','scale-up scale-out',                  // AI 컴퓨팅 아키텍처
  // v53.92 HANA/Insider/BornLupin supply-chain observations.
  'VC electrolyte additive','vinylene carbonate','ESS attach rate','AI copper foil','CCL price increase',
  'PCIe 6.0 NAND','UFS 5.0 NAND','Qwen3.8-Max','TPU v9','HBM4 test equipment',
  'Korea semiconductor power 6.3GW','industrial water 650kt/day','foldable smartphone demand',
  'AI inference token intensity','memory LTA 3-5 year','CoPoS panel packaging',
];
// ANALYST_KW: 개별 종목 analyst rating → 홈 노출 페널티 (-20점)
const ANALYST_KW = [
  'price target','target price','upgrades to','downgrades to',
  'initiates coverage','reiterates','overweight','underweight',
  'outperform','underperform','buy rating','sell rating','hold rating',
  'analyst raises','analyst cuts','analyst initiates',
  'raises target','cuts target','raises pt','cuts pt',
  'initiates at buy','initiates at overweight','initiates at outperform',
  'sets target','sets pt','reiterate buy','reiterate overweight',
  'Jefferies','JPMorgan','Goldman Sachs','Morgan Stanley','Citigroup','Bank of America',
  'KeyBanc','Piper Sandler','Barclays','UBS','Deutsche Bank','RBC Capital',
  'Mizuho','Needham','Wedbush','Canaccord','Truist','Oppenheimer','Stifel',
  // v49.99: 텔레그램 채널 주요 기관 추가 — 이번 주 핵심 리포트 기관
  'Susquehanna','Susquehanna Financial','SIG','Lynx Equity','Lynx equity',
  'DA Davidson','Melius Research','Melius','KB Securities','KB증권',
  'Hartnett','Michael Hartnett','BofA Hartnett',
  '커버리지 개시','매수 개시','커버리지 시작','신규 편입',
  '목표주가','투자의견','매수의견','매도의견','중립의견',
  '목표주가 상향','목표주가 하향','투자의견 상향','투자의견 하향',
  '비중확대','비중축소','시장수익률','매수 유지','중립 유지',
];
// 하위 호환: HIGH_KW = MACRO_KW + TECH_KW
const HIGH_KW = [...MACRO_KW, ...TECH_KW];
const KNOWN_TICKERS = new Set([
  'AAOI','AAPL','ABBV','ABNB','ABT','ACGL','ACLS','ACN','ADA','ADBE','ADI','ADP',
  'ADSK','AEHR','AEM','AEP','AES','AFL','AFRM','AGG','AI','AIG','AIZ','AJG',
  'AKAM','ALB','ALGN','ALL','ALLE','ALNY','AMAT','AMC','AMD','AME','AMGN','AMP',
  'AMT','AMX','AMZN','ANET','ANSS','AON','APD','APH','APO','APP','APTV','ARE',
  'ARES','ARGX','ARKF','ARKG','ARKK','ARM','ASML','ASTS','ATO','AU','AVAX','AVB',
  'AVGO','AWK','AXON','AXP','AZN','AZO','B','BA','BABA','BAC','BAM','BAX',
  'BBBY','BBVA','BBWI','BCS','BDX','BG','BHP','BIDU','BIIB','BILL','BIO','BIRD',
  'BITF','BK','BKNG','BKR','BLDR','BLK','BMO','BMY','BN','BNB','BND','BNS',
  'BP','BR','BRK-B','BRK.A','BRK.B','BRO','BRZE','BSX','BTC','BTI','BUD','BWA','BX',
  'BXP','BZ=F','C','CAG','CAH','CARR','CAT','CAVA','CB','CBOE','CBRE','CCEP',
  'CCJ','CCL','CDNS','CDW','CE','CEG','CELH','CFG','CFLT','CHD','CHRW','CHTR',
  'CI','CIEN','CIFR','CINF','CL','CL=F','CLSK','CLX','CM','CMCSA','CME','CMG',
  'CMI','CMS','CNC','CNI','CNQ','COF','COHR','COIN','COO','COP','COR','COST',
  'CORZ','CP','CPAY','CPB','CPNG','CPRT','CPT','CRDO','CRH','CRL','CRM','CRSP','CRWD',
  'CRWV','CSCO','CSX','CTAS','CTSH','CTVA','CVNA','CVS','CVX','CZR','D','DAL',
  'DASH','DAY','DB','DD','DDOG','DE','DECK','DELL','DEO','DG','DGX','DHI',
  'DHR','DIA','DIS','DJI','DLR','DLTR','DM','DNA','DOCN','DOGE','DOT','DOV',
  'DOW','DPZ','DUK','DUOL','DVA','DVN','DWAC','DXCM','E','EA','EBAY','ECL',
  'ED','EEM','EFA','EFX','EG','EIX','ELV','EMB','EMN','EMR','ENB','ENPH',
  'EOG','EPAM','EPD','EQIX','EQNR','EQT','ESS','ESTC','ET','ETH','ETN','ETR',
  'EVRG','EW','EWJ','EWY','EXAS','EXC','EXPD','EXR','F','FANG','FAST','FCX',
  'FDS','FDX','FE','FER','FERG','FFIV','FI','FICO','FIS','FISV','FITB','FIX',
  'FN','FNV','FOX','FOXA','FRT','FSLR','FTNT','FXI','GC=F','GD','GDDY','GDX',
  'GE','GEHC','GEN','GEV','GFI','GFS','GILD','GIS','GL','GLD','GLW','GM',
  'GME','GNRC','GOLD','GOOG','GOOGL','GPN','GRAB','GRMN','GS','GSK','GTLB','GWW',
  'HACK','HAL','HCA','HD','HDB','HEI','HG=F','HIG','HII','HIMS','HLN','HLT',
  'HMC','HOLX','HON','HOOD','HPE','HPQ','HRL','HSBC','HSIC','HSY','HUBB','HUBS',
  'HUM','HUT','HWM','HYG','IBB','IBM','IBN','ICE','ICLN','IDXX','IEF','IEX',
  'IFF','IGV','ILMN','IMO','INCY','INDA','INFY','ING','INTC','INTU','IONQ','IPG',
  'IQV','IREN','IRM','ISRG','IT','ITA','ITUB','ITW','IVV','IWM','J','JBHT',
  'JCI','JD','JNJ','JNPR','JOBY','JPM','K','KARS','KDP','KEX','KEY','KEYS','KHC',
  'KIM','KKR','KLAC','KMI','KO','KR','KTOS','KVUE','KVYO','LBRT','LCID','LDOS','LHX','LI',
  'LII','LIN','LINK','LITE','LKQ','LLY','LMT','LNG','LNT','LOW','LQD','LRCX','LSCC',
  'LULU','LUNR','LUV','LYFT','LYG','LYV','MA','MAA','MAR','MARA','MAS','MATIC',
  'MCD','MCHP','MCK','MCO','MDB','MDLN','MDLZ','MDT','MELI','MET','META','MFC',
  'MFG','MGM','MHK','MKTX','MMC','MMM','MNDY','MNST','MO','MOH','MP','MPC',
  'MPLX','MPWR','MRK','MRNA','MRSH','MRVL','MS','MSCI','MSFT','MSI','MSTR','MTB',
  'MTCH','MTD','MTSI','MTZ','MU','MUFG','NBIS','NCLH','NDAQ','NDX','NEE','NEM','NET',
  'NFLX','NG=F','NGG','NI','NIO','NKE','NOC','NOW','NRG','NSC','NTAP','NTES',
  'NTRS','NU','NUE','NVDA','NVO','NVR','NVS','NVT','NWG','NWS','NWSA','NXPI','O',
  'ODFL','OIH','OKE','OKLO','OKTA','ON','ONON','ORCL','ORLY','OTIS','OXY','PANW',
  'PSKY','PATH','PAYC','PAYX','PBR','PCAR','PDD','PEG','PEP','PFE','PFG','PG',
  'PGR','PH','PHM','PINS','PKG','PL','PLBY','PLD','PLTR','PM','PNC','PODD',
  'POET','POOL','POWL','PPG','PPL','PRU','PSA','PSX','PTC','PWR','PYPL','QBTS','QCOM',
  'QQQ','QUBT','RACE','RBLX','RCL','RDDT','RBRK','RDW','REG','REGN','RELX','RF','RGTI',
  'RHI','RIO','RIOT','RIVN','RKLB','RKT','RL','RMD','ROK','ROKU','ROP','ROST',
  'RSG','RSP','RS','RTX','RUT','RVTY','RY','SAN','SAP','SBAC','SBUX','SCCO','SCHW',
  'SE','SEI','SGEN','SHEL','SHOP','SHW','SHY','SI=F','SLB','SLV','SMCI','SMFG','SMH',
  'SMMT','SMR','SNA','SNAP','SNDK','SNOW','SNPS','SNY','SO','SOFI','SOL','SOLV','SQQQ',
  'SONY','SOUN','SOXX','SPG','SPGI','SPOT','SPX','SPY','SQ','SRE','STE',
  'STLD','STT','STX','STZ','SU','SWK','SWKS','SYK','SYY','T','TAK','TCOM',
  'TD','TDG','TEAM','TECH','TECK','TEL','TEM','TER','TFC','TFX','TGT','TIP',
  'TJX','TKO','TLN','TLT','TM','TMO','TMUS','TOST','TPR','TRGP','TRI','TROW',
  'TRP','TRV','TSCO','TSLA','TSM','TT','TTD','TTE','TTWO','TWLO','TXN','TXT',
  'TYL','U','UBER','UBS','UDR','UL','UNG','UNH','UNI','UNP','UPS','UPST',
  'URI','USB','USO','UVXY','V','VALE','VEEV','VIAV','VLO','VLTO','VOO','VRSK',
  'VRSN','VRT','VRTX','VST','VTI','VTR','VTRS','VWO','VXX','VZ','WAB','WAT',
  'WBA','WBD','WCN','WDAY','WDC','WEC','WELL','WFC','WM','WMB','WMT','WOLF',
  'WPM','WRB','WRK','WSO','WST','WTW','WULF','WY','WYNN','XBI','XEL','XLB',
  'XLC','XLE','XLF','XLI','XLK','XLP','XLRE','XLU','XLV','XLY','XOM','XPEV',
  'XRP','XYZ','YUM','ZBRA','ZS','ZTS'
,'AA','ABB','ADM','AMLP','ALAB','AMKR','ASX','BE','BITO','BOTZ','BWXT','CCI','CLS','CYBR','DKNG','EME','ENTG','ES','ETSY','FANUY','FCEL','FLNC','FLR','FTI','IBIT','JETS','KGC','LAC','LEU','LIT','MASI','MTK','NDSN','NOV','NTDOY','ONTO','PLAB','PLUG','PNW','RUN','S','SEDG','SIMO','STAG','TPL','UAL','UCTT','UMC','URA','VKTX','WHD','XNDU','XOP','000001.SS','BTC-USD','CIBR','DX-Y.NYB','ETH-USD','MMFD','MMFI','MMTW','^DJI','^FCHI','^FTSE','^GDAXI','^GSPC','^HSI','^IXIC','^KS11','^N225','^RUT','^TNX','^VIX']);

// v27.4: 한국어 기업명/영문 소문자 → 티커 매핑 (대폭 확장)
const KR_TICKER_MAP = {
  // ═══ 미국 대형주 / 주도주 ═══
  '엔비디아': 'NVDA', 'nvidia': 'NVDA', '젠슨황': 'NVDA', 'jensen huang': 'NVDA',
  '애플': 'AAPL', 'apple': 'AAPL', '팀쿡': 'AAPL',
  '테슬라': 'TSLA', 'tesla': 'TSLA', '일론머스크': 'TSLA', 'elon musk': 'TSLA',
  '마이크로소프트': 'MSFT', 'microsoft': 'MSFT',
  '아마존': 'AMZN', 'amazon': 'AMZN', 'aws': 'AMZN',
  '구글': 'GOOGL', '알파벳': 'GOOGL',  // v51.56: 'google'/'alphabet' 제거 — "Google News Finance" 소스명 오탐 방지
  '메타': 'META', '페이스북': 'META', '저커버그': 'META',  // v51.56: 'facebook' 제거 — 일반 영단어 오탐
  '넷플릭스': 'NFLX', 'netflix': 'NFLX',
  '디즈니': 'DIS', 'disney': 'DIS',
  '오라클': 'ORCL', 'oracle': 'ORCL',
  '세일즈포스': 'CRM', 'salesforce': 'CRM',
  '어도비': 'ADBE', 'adobe': 'ADBE',
  '스노우플레이크': 'SNOW', 'snowflake': 'SNOW',
  '팰런티어': 'PLTR', '팔란티어': 'PLTR', 'palantir': 'PLTR',
  '쇼피파이': 'SHOP', 'shopify': 'SHOP',
  '우버': 'UBER', 'uber': 'UBER',
  '에어비앤비': 'ABNB', 'airbnb': 'ABNB',
  '도어대시': 'DASH', 'doordash': 'DASH',
  '쿠팡': 'CPNG', 'coupang': 'CPNG',
  // ── 반도체 / AI ──
  'amd': 'AMD', '에이엠디': 'AMD',
  '브로드컴': 'AVGO', 'broadcom': 'AVGO',
  '대만반도체': 'TSM', 'tsmc': 'TSM', '티에스엠씨': 'TSM',
  '마이크론': 'MU', 'micron': 'MU',
  '인텔': 'INTC', 'intel': 'INTC',
  '퀄컴': 'QCOM', 'qualcomm': 'QCOM',
  '마벨': 'MRVL', 'marvell': 'MRVL', '마벨테크놀로지': 'MRVL',
  '델타항공': 'DAL', 'delta air': 'DAL', '델타에어라인': 'DAL',
  '마이크론': 'MU', 'micron': 'MU',
  // v38.6: 광통신·전력 기업 매핑
  '코히런트': 'COHR', 'coherent': 'COHR', '코히어런트': 'COHR',
  '루멘텀': 'LITE', 'lumentum': 'LITE',
  '포엣': 'POET', 'poet technologies': 'POET', '포엣테크놀로지': 'POET',
  '시스코푸드': 'SYY', 'sysco': 'SYY',
  '럭스쉐어': 'LUXSHARE', 'luxshare': 'LUXSHARE',
  '아폴로': 'APO', 'apollo': 'APO',
  '아리스타': 'ANET', 'arista': 'ANET',
  'asml': 'ASML', '에이에스엠엘': 'ASML',
  '램리서치': 'LRCX', 'lam research': 'LRCX',
  '어플라이드': 'AMAT', 'applied materials': 'AMAT',
  'arm holdings': 'ARM', '에이알엠': 'ARM',
  '슈퍼마이크로': 'SMCI', 'supermicro': 'SMCI', 'super micro': 'SMCI',
  '시놉시스': 'SNPS', 'synopsys': 'SNPS',
  '케이던스': 'CDNS', 'cadence': 'CDNS',
  // v48.19 (integrate): /integrate 35건 리서치 주요 기업 매핑 확장
  // NAND/HDD 메모리
  '샌디스크': 'SNDK', 'sandisk': 'SNDK',
  '시게이트': 'STX', 'seagate': 'STX',
  '웨스턴디지털': 'WDC', 'western digital': 'WDC',
  '넷앱': 'NTAP', 'netapp': 'NTAP',
  // 광학·인터커넥트·EMS·네트워킹
  '코닝': 'GLW', 'corning': 'GLW',
  '파브리넷': 'FN', 'fabrinet': 'FN',
  '앰페놀': 'APH', 'amphenol': 'APH',
  '크레도': 'CRDO', 'credo technology': 'CRDO', 'credo tech': 'CRDO',
  '셀레스티카': 'CLS', 'celestica': 'CLS',
  '재빌': 'JBL', 'jabil': 'JBL',
  '플렉스': 'FLEX', 'flex ltd': 'FLEX',
  '시에나': 'CIEN', 'ciena': 'CIEN',
  // 테스트·계측·IT
  '테라다인': 'TER', 'teradyne': 'TER',
  '키사이트': 'KEYS', 'keysight': 'KEYS',
  '델': 'DELL', 'dell technologies': 'DELL',
  // AI 인프라 / 네오클라우드
  '코어위브': 'CRWV', 'coreweave': 'CRWV',
  '네비우스': 'NBIS', 'nebius': 'NBIS',
  // v49.99: 일본 반도체 신규 등록 (키옥시아·TEL·후지쯔)
  '키옥시아': '6600.T', 'kioxia': '6600.T', 'kioxia holdings': '6600.T',
  '도쿄일렉트론': '8035.T', 'tokyo electron': '8035.T', 'tel semiconductor': '8035.T',
  '후지쯔': '6702.T', 'fujitsu': '6702.T', 'fujitsu monaka': '6702.T',
  // 위성통신 (Globalstar/AMZN LEO 테마)
  '글로벌스타': 'GSAT', 'globalstar': 'GSAT',
  // v48.19: AVGO-Meta MTIA, 테라팹, Wartsila 맥락 주요 키워드
  'mtia': 'META', 'meta mtia': 'META',
  '바르실라': 'WRT1V.HE', 'wartsila': 'WRT1V.HE', // 핀란드 상장(미국 티커 없음) — 매핑은 맥락 표시용
  // ── 클라우드 / 사이버보안 ──
  '크라우드스트라이크': 'CRWD', 'crowdstrike': 'CRWD',
  '팔로알토': 'PANW', 'palo alto': 'PANW',
  '지스케일러': 'ZS', 'zscaler': 'ZS',
  '포티넷': 'FTNT', 'fortinet': 'FTNT',
  '데이터독': 'DDOG', 'datadog': 'DDOG',
  '몽고디비': 'MDB', 'mongodb': 'MDB',
  '클라우드플레어': 'NET', 'cloudflare': 'NET',
  // ── 금융 ──
  '골드만삭스': 'GS', 'goldman sachs': 'GS', 'goldman': 'GS',
  'JP모건': 'JPM', '제이피모건': 'JPM', 'jpmorgan': 'JPM', 'jp morgan': 'JPM',
  '모건스탠리': 'MS', 'morgan stanley': 'MS',
  '블랙록': 'BLK', 'blackrock': 'BLK',
  '버크셔': 'BRK.B', '워런버핏': 'BRK.B', 'berkshire': 'BRK.B', 'warren buffett': 'BRK.B',
  '뱅크오브아메리카': 'BAC', 'bank of america': 'BAC',
  '시티': 'C', 'citigroup': 'C',
  '웰스파고': 'WFC', 'wells fargo': 'WFC',
  '비자': 'V', 'visa': 'V',
  '마스터카드': 'MA', 'mastercard': 'MA',
  '페이팔': 'PYPL', 'paypal': 'PYPL',
  '코인베이스': 'COIN', 'coinbase': 'COIN',
  // ── 방산 ──
  '록히드마틴': 'LMT', 'lockheed martin': 'LMT', 'lockheed': 'LMT',
  '레이시온': 'RTX', 'raytheon': 'RTX',
  '노스롭': 'NOC', 'northrop': 'NOC', 'northrop grumman': 'NOC',
  '보잉': 'BA', 'boeing': 'BA',
  '제너럴다이내믹스': 'GD', 'general dynamics': 'GD',
  '헌팅턴잉걸스': 'HII', 'huntington ingalls': 'HII',
  '엘쓰리해리스': 'LHX', 'l3harris': 'LHX',
  '로켓랩': 'RKLB', 'rocket lab': 'RKLB',
  // ── 에너지 ──
  '엑슨모빌': 'XOM', 'exxon': 'XOM', 'exxonmobil': 'XOM',
  '셰브론': 'CVX', 'chevron': 'CVX',
  '코노코필립스': 'COP', 'conocophillips': 'COP',
  '옥시덴탈': 'OXY', 'occidental': 'OXY',
  '슐럼버거': 'SLB', 'schlumberger': 'SLB',
  // ── 바이오 / 헬스케어 ──
  '일라이릴리': 'LLY', 'eli lilly': 'LLY', '릴리': 'LLY',
  '노보노디스크': 'NVO', 'novo nordisk': 'NVO', '오젬픽': 'NVO', 'ozempic': 'NVO', 'wegovy': 'NVO',
  '모더나': 'MRNA', 'moderna': 'MRNA',
  '리제네론': 'REGN', 'regeneron': 'REGN',
  '화이자': 'PFE', 'pfizer': 'PFE',
  '머크': 'MRK', 'merck': 'MRK',
  '애브비': 'ABBV', 'abbvie': 'ABBV',
  // ── 자동차 / EV ──
  '리비안': 'RIVN', 'rivian': 'RIVN',
  '루시드': 'LCID', 'lucid': 'LCID',
  '니오': 'NIO', 'nio': 'NIO',
  '샤오펑': 'XPEV', 'xpeng': 'XPEV',
  '리오토': 'LI', 'li auto': 'LI',
  '토요타': 'TM', 'toyota': 'TM',
  // ── 암호화폐 ──
  '비트코인': 'BTC', 'bitcoin': 'BTC',
  '이더리움': 'ETH', 'ethereum': 'ETH',
  '솔라나': 'SOL', 'solana': 'SOL',
  '리플': 'XRP', 'ripple': 'XRP',
  '도지코인': 'DOGE', 'dogecoin': 'DOGE',
  // ═══  한국 주요 종목 ═══
  '삼성전자': '$삼성전자', '삼성': '$삼성전자',
  'SK하이닉스': '$SK하이닉스', '하이닉스': '$SK하이닉스',
  '네이버': '$네이버', 'naver': '$네이버',
  '카카오': '$카카오', 'kakao': '$카카오',
  '현대차': '$현대차', '현대자동차': '$현대차',
  '기아': '$기아',
  'LG에너지솔루션': '$LG엔솔', 'LG엔솔': '$LG엔솔',
  '포스코홀딩스': '$포스코', '포스코': '$포스코',
  '삼성바이오로직스': '$삼성바이오', '삼성바이오': '$삼성바이오',
  'LG화학': '$LG화학',
  '셀트리온': '$셀트리온',
  'KB금융': '$KB금융',
  '신한지주': '$신한지주',
  '하나금융': '$하나금융',
  '현대모비스': '$현대모비스',
  'SK텔레콤': '$SKT',
  'KT': '$KT',
  '한국전력': '$한전', '한전': '$한전',
  '두산에너빌리티': '$두산에너빌리티',
  '에코프로': '$에코프로',
  '에코프로비엠': '$에코프로BM',
  '한화에어로스페이스': '$한화에어로', '한화에어로': '$한화에어로',
  'HD현대': '$HD현대',
  // ── 지수 / ETF ──
  '코스피': 'KOSPI', '코스닥': 'KOSDAQ',
  '나스닥': 'QQQ', 'nasdaq': 'QQQ',
  '다우': 'DIA', 'dow jones': 'DIA', 'dow': 'DIA',
  'S&P': 'SPY', 's&p 500': 'SPY', 's&p500': 'SPY',
  '러셀': 'IWM', 'russell': 'IWM',
  '필라델피아반도체': 'SOXX', 'sox': 'SOXX',
};

// v27.4: 비주식 뉴스 블랙리스트 — 부동산, 연예, 스포츠, 생활, 날씨 등 제거
const NEWS_BLACKLIST_KW = [
  // ═══ 한국어 블랙리스트 ═══
  // 부동산
  '아파트','부동산','전셋값','월셋값','분양','재건축','재개발','매매가','전세가','임대차',
  '청약','입주','공시지가','토지','주택담보','주택가격','오피스텔','상가','건물주',
  '집값','전월세','보증금','주거',
  // 연예/스포츠/생활
  '연예','아이돌','드라마','영화 개봉','예능','스포츠','축구','야구','프로야구','올림픽',
  '맛집','레시피','여행지','관광','다이어트','헬스','뷰티','패션','웨딩','육아',
  '날씨','기온','폭우','폭설','미세먼지','자외선',
  // 사건사고/범죄 (금융 무관)
  '교통사고','화재','실종','살인','폭행','성범죄','음주운전',
  '강도','절도','납치','사기범','마약','도박','검거','체포','피의자','구속',
  '호신','가스총','흉기','칼부림','테러','방화','자살','사망사고','익사',
  // 연예인/방송 (금융 무관)
  '출연','방송인','배우','가수','걸그룹','보이그룹','팬미팅','콘서트','뮤직비디오',
  '시청률','리얼리티','토크쇼','종영','첫방','복귀','열애','파경','이혼설',
  // ═══ 영문 블랙리스트 (비금융 콘텐츠 근본 차단) ═══
  // 부동산
  'housing price','real estate','mortgage','apartment','home sales','housing market','rent prices',
  // 연예/셀럽
  'celebrity','kardashian','dating','boyfriend','girlfriend','married','divorce','engagement',
  'red carpet','oscars','grammy','emmy','golden globe','mtv','billboard music',
  'hollywood','movie review','box office','film festival','netflix series','tv show',
  'k-pop','k-drama','idol','boyband','girl group','reality show','talk show',
  'instagram','tiktok viral','influencer','paparazzi','scandal','affair',
  // 스포츠
  'nfl','nba','mlb','nhl','premier league','champions league','world cup','super bowl',
  'touchdown','home run','goalkeeper','playoff','draft pick','free agent signing',
  'transfer window','match result','game recap','sports betting','fantasy football',
  // 가전/가젯/앱 리뷰 (The Verge, TechCrunch 등에서 유입)
  'phone review','laptop review','tablet review','gadget review','smartwatch review',
  'best phones','best laptops','best tablets','best headphones','best earbuds',
  'how to fix','troubleshooting guide','tips and tricks','life hack',
  'app of the week','app review','game review','video game','gaming console',
  'playstation','xbox','nintendo','steam deck','fortnite','call of duty',
  'recipe','cooking','restaurant review','travel guide','vacation','hotel review',
  // 건강/생활
  'weight loss','fitness','workout','yoga','meditation','skincare','beauty',
  'horoscope','zodiac','astrology','weather forecast','pollen count',
  // 범죄/사건 (금융 무관)
  'murder','homicide','kidnapping','robbery','assault','shooting suspect',
  'car crash','traffic accident','wildfire','flood damage','tornado',
  'missing person','fugitive','manhunt','drug bust','drug trafficking',
  // v39.0: 한국어 셀럽/비금융 보강
  '카다시안','유명 모델','약물 운전','음주 단속','전용기','사생활','열애설',
  // 크립토 스팸 (Price Prediction 기사 완전 차단)
  'price prediction','price forecast 2025','price forecast 2026','price forecast 2027',
  'price prediction 2025','price prediction 2026','price prediction 2027','price prediction 2030',
  'could reach $','can reach $','will reach $','might reach $',
  // v48.20 (integrate): 2026년 AI 클릭베이트 패턴 보강
  'ai stock to buy now','next ai winner','ai stock of the decade','ai stock of the year',
  '100x ai stock','ai millionaire','quantum stock to buy','ai picks under $',
  'ai 황제주','ai 대박주','ai 차세대 황제','양자 대장주','암호화폐 무료',
  'should you buy','is it a good investment','worth buying',
  'meme coin','memecoin','shiba','dogecoin','pepe coin','floki',
  'airdrop','free tokens','crypto giveaway','pump and dump',
  // v30.12 P3: 정치/선거 (금융 무관) — 경제정책은 MACRO_KW에서 별도 처리
  '대선','총선','보궐선거','국회의원','지방선거','후보자','공천','당대표','정당','여당','야당',
  '탄핵','국정감사','청문회','의원','국회','개헌','선거법',
  'presidential election','midterm election','campaign rally','political party','senator','congressman',
  'primary election','ballot','voting results','gubernatorial',
  // v30.12: 종교/문화/교육 (금융 무관)
  '교회','사찰','성당','목사','스님','종교','예배','미사','법회',
  '수능','입시','대학교','학교','교사','교수','학원','과외',
  '축제','전시회','공연','뮤지컬','오페라','클래식',
  'church','mosque','temple','pastor','sermon','worship',
  'school shooting','campus','graduation','university ranking','homework',
  // v30.12: 스포츠 보강 (기존 누락)
  'mls','pga','ufc','wwe','formula 1','f1 race','grand prix','wimbledon','us open tennis',
  'world series','stanley cup','champions trophy','cricket','rugby','golf tournament',
  '월드컵','프리미어리그','챔피언스리그','메시','호날두','손흥민','EPL','KBO','K리그',
  // ── v31.8: 블랙리스트 대폭 강화 — 비금융 콘텐츠 근본 차단
  // 건강/의료 (금융 무관 — 바이오 기업 뉴스는 MED_KW에서 처리)
  'diet plan','weight management','home remedy','natural cure','herbal supplement',
  'mental health tips','stress relief','sleep tips','wellness routine','self care',
  '건강법','민간요법','다이어트 식단','운동법','스트레칭','명상법',
  // 라이프스타일/쇼핑
  'best deals','coupon code','discount code','flash sale','black friday deals',
  'product unboxing','haul video','outfit of the day','home decor','interior design',
  'pet care','dog training','cat breeds','gardening tips','diy project',
  '쿠폰','할인코드','언박싱','인테리어','반려동물','펫케어','원예',
  // 소셜미디어/인터넷 문화
  'viral video','meme','trending topic','social media drama','twitter drama',
  'youtuber','streamer','content creator','subscriber count','views milestone',
  '바이럴','밈','트렌딩','유튜버','스트리머','구독자',
  // 자동차 리뷰 (EV/자동차 산업 뉴스는 MED_KW에서 처리)
  'car review','test drive review','suv review','sedan review','mpg rating',
  'best cars 2025','best cars 2026','car buying guide','used car',
  '차량 리뷰','시승기','연비 비교','중고차 시세',
  // 음식/요리 (산업 뉴스는 별도)
  'recipe','cooking tips','meal prep','food review','restaurant review',
  'best restaurants','michelin star','food trend','baking',
  '레시피','요리법','맛집 추천','밀프렙','베이킹',
  // 여행 (산업 뉴스는 별도)
  'travel tips','packing tips','flight deals','hotel deals','travel itinerary',
  'backpacking','solo travel','road trip','tourist attraction',
  '여행 팁','항공권 할인','호텔 추천','배낭여행','관광지',
  // 교육/학술 (금융 무관)
  'study tips','exam preparation','scholarship','online course','tutorial',
  'how to learn','language learning','coding tutorial','beginner guide',
  '공부법','시험 준비','장학금','온라인 강좌','학습법',
  // 날씨/자연재해 (시장 영향 없는 일반 보도)
  'weather update','weather alert','storm warning','hurricane watch',
  'earthquake','volcanic eruption','tsunami warning','climate change opinion',
  '일기예보','기상특보','태풍 경로','지진 속보',
  // 정치 인물/선거 캠페인 (경제정책은 MACRO_KW에서 처리)
  'campaign speech','political rally','endorsement','primary debate',
  'voter turnout','swing state','battleground','midterm results',
  '유세','지지율 조사','당내 경선','정치 스캔들',
  // ── v34.1: 지역/지방 뉴스 근본 차단 — 투자와 무관한 한국 지역 뉴스 완전 제거
  // 지방자치/행정 (금융 무관)
  '시장이','군수','구청장','도지사','면장','읍장','동장','이장',
  '시의회','군의회','구의회','도의회','지방의회','지방자치',
  '시청','군청','구청','도청','주민센터','행정복지센터',
  '조례','행정처분','민원','주민설명회','공청회',
  // 지역 개발/인프라 (금융 무관)
  '새만금','혁신도시','세종시','행정수도','지역균형',
  '도시재생','마을만들기','주민참여예산','지역화폐','지역상품권',
  '상공인','소상공인','자영업자','전통시장','골목상권',
  '지역축제','마을축제','문화행사','주민행사',
  // 지방 생활/복지 (금융 무관)
  '어르신','노인정','경로당','노인복지','노인일자리',
  '보건소','건강센터','치매센터','장애인복지','사회복지',
  '어린이집','유치원','돌봄센터','방과후','학교급식',
  '종량제','분리수거','쓰레기','폐기물','환경미화','하수처리',
  '청소년센터','도서관','문화센터','체육시설','공원조성',
  '신중년','일자리센터','고용센터','직업훈련',
  '의료 소외','보건의료','응급의료','의료취약',
  // 지역 교통/도로 (금융 무관)
  '시내버스','마을버스','노선변경','정류장','도로확장','교차로',
  '주차장','신호등','횡단보도','보행자','자전거도로',
  // 영양/식품 안전 (금융 무관)
  '영양정보','식품안전','급식','식약처','위생점검',
  '식중독','불량식품','유통기한','원산지표시',
  // 지역 사건/인물 프로필 (금융 무관)
  '청암히어로','모범시민','자원봉사','봉사활동','나눔','기부금',
  '현충원','참배','추도식','기념식','기공식','준공식','개관식',
  '장학재단','포스코청암','시상식','공로상','표창',
  // 선거구/지역 정치 (금융 무관)
  '지역구','출마','예비후보','공천','당협위원장',
  // ── v34.1b: 한국 지방정부/행정 기사 근본 차단 (수출·기업·에너지 등 광범위 키워드 오탐 방지)
  // 광역·기초 자치단체 + 행정 행위 (금융 무관)
  '강원도,','전남도,','경남도,','충남도,','충북도,','경북도,','전북도,','제주도,',
  '강원도 ','전남도 ','경남도 ','충남도 ','충북도 ','경북도 ','전북도 ','제주도 ',
  '울주군','울산시','울릉군','양양군','횡성군','평창군','정선군','영월군','태백시',
  '합천군','산청군','하동군','남해군','거창군','함양군','의령군','창녕군',
  '영광군','장성군','담양군','곡성군','구례군','보성군','고흥군','장흥군','강진군',
  '해남군','완도군','진도군','무안군','신안군','함평군','영암군','나주시',
  '업무협약','양해각서','MOU 체결','MOU체결','협력 체결','협약식','체결식',
  '어촌뉴딜','농촌뉴딜','도시뉴딜','지역뉴딜',
  '일자리 창출','고용 창출','일자리사업','공공근로','희망근로',
  '선착순 모집','참가자 모집','수강생 모집','교육생 모집',
  '비즈니스 매칭','상담회','수출상담','비즈매칭',
  '건강음료','배달사업','돌봄사업','돌봄서비스',
  '행정 지원','행정지원','세무 지원','세무지원','지방세 감면','지방세 지원',
  // 지역 인사/임명/기관 (금융 무관)
  '[인사]','인사이동','보직변경','전보발령','승진자 명단',
  '3연임','연임 성공','취임식','이취임식','퇴임식',
  // 지방정부 예산/계획 (매크로 재정정책과 구분 — 지역 단위)
  '세부계획 공시','시행계획','지역계획','추진계획 발표',
  '지역경제 활성화','지역 활성화','상권 활성화','마을 활성화',
  // 한국 순수 국내 사회/생활 (금융 문맥 공존 불가)
  // 주의: 정치 키워드(대통령, 장관, 국회 등)는 제거함 — 금융 정책 뉴스와 공존 가능하므로
  // → STEP 2 금융 관련성 게이트에서 컨텍스트로 판단
  '학부모','교육감','교육청',
  // 영문 순수 사회 이슈 (금융 문맥 공존 불가)
  'gun control','abortion rights','lgbtq rights',
  'school shooting','mass shooting',
  // ── v38.3 B4: 비금융 한국 뉴스 추가 차단 (보험/카드/CSR/인사/부동산 등)
  // 보험/카드 상품 (금융 산업 뉴스와 구분 — 개인 상품 광고성)
  '보험료 인상','보험료 인하','보험 가입','보험금 청구','보험 상품','보험설계사',
  '카드 혜택','신용카드 추천','카드 포인트','카드 할인','연회비',
  // CSR/ESG 보도자료 (투자 판단 무관)
  '사회공헌','봉사단','나눔활동','기부금 전달','장학금 수여','사랑나눔',
  // 기업 인사/임명 (시장 영향 없는 중간관리직)
  '부장 승진','차장 승진','과장 승진','대리 승진','인사발령','보직 이동',
  '신입사원','공채','채용설명회','인턴 모집',
  // 법원/소송 (금융 무관 민사)
  '이혼 소송','양육권','상속 분쟁','임대차 분쟁','층간소음',
  // 군사/안보 (방산주 뉴스는 별도 처리)
  '훈련 실시','군사 훈련','합동 훈련',
  // 생활 경제 팁 (투자 무관)
  '절약법','가계부','용돈','저축 습관','짠테크',
  // ── v39.2: 투자 스팸/클릭베이트/광고성 기사 근본 차단
  // 한국어 투자 스팸 (주식 추천 사이트/네이버 카페/블로그 광고)
  '10배','100배','1000배','대박주','급등주','텐배거',
  '이 주식만','이 종목만','반드시 사야','무조건 사야','지금 안 사면',
  '놓치면 후회','지금이 마지막','마지막 기회','급등 임박','폭등 예고',
  '찐 추천','오늘의 추천주','무료 추천','종목 추천','리딩방','시크릿 종목',
  '수익률 보장','수익 보장','원금 보장','확실한 수익','100% 수익',
  '비밀 종목','숨겨진 종목','아무도 모르는','전문가만 아는',
  '단타 종목','스캘핑 종목','오늘의 급등','내일 급등',
  '주식 부자','주식으로 퇴사','주식으로 은퇴','파이어족 종목',
  '삼성 잡는','애플 잡는','엔비디아 잡는',
  '테마주 추천','급등 테마','대장주 추천','황제주','슈퍼개미',
  // 영문 투자 스팸/클릭베이트
  'best stock to buy now','best stocks to buy','stocks to buy now',
  'buy this stock','buy before it','next 10x','next 100x','next tesla','next nvidia',
  'millionaire maker','make you rich','retire early with','get rich',
  'this stock will','hidden gem stock','secret stock','under the radar',
  'penny stock','penny stocks to buy','small cap gem',
  'must buy stock','guaranteed return','risk free','easy money',
  'wall street bets','yolo stock','diamond hands','to the moon',
  'stock alert','stock pick','stock tip','free stock pick',
  '10x potential','100x potential','massive upside','explosive growth potential',
  'you won\'t believe','don\'t miss this','last chance to buy',
  'insiders are buying','smart money is','hedge funds are',
];

// 토픽 키워드 분류
const TOPIC_KEYWORDS = {
  macro:    ['Fed','FOMC','rate','CPI','PCE','GDP','inflation','deflation','recession','treasury','bond','yield curve',
              'dollar','DXY','yen','euro','yuan','tariff','trade war','sanction','export ban','reciprocal tariff','Section 301','de minimis','USMCA','customs duty','상호관세','보복관세','관세율','무역분쟁',
              '금리','인플레','경기침체','환율','채권',
              'monetary policy','fiscal','stimulus','quantitative easing','quantitative tightening','central bank','beige book','dot plot','jackson hole',
              'PMI','ISM','consumer confidence','retail sales','industrial production','nonfarm','payroll','employment','unemployment',
              '통화정책','재정','소비자물가','생산자물가','고용','실업률','경상수지','무역수지','한국은행','금통위',
              'ECB','BOJ','BOE','PBOC','BOK','RBA',
              // v39.2: JP모건 유가/크로스에셋
              'oil shock','demand destruction','gasoline price','K-shaped','stagflation',
              'quality growth','cross-asset','energy exporter','energy importer','relief rally',
              'bear flattener','term structure','유가 충격','수요 파괴','스태그플레이션','K자형',
              // v48.16 (integrate 2026-04-18): 데이터센터 규제·주 정책 + 통화정책 체계 전환
              'data center ban','DC moratorium','data center regulation','grid connection delay',
              'Maine DC','Virginia DC','Ohio DC','state moratorium','DC siting',
              'data dependence','forward guidance failure','2% inflation target','mid-inflation',
              '데이터센터 금지','DC 규제','전력망 부하','주 정책','모라토리엄',
              '중물가','2% 물가목표','평균물가목표','데이터 디펜던스'],
  geo:      ['war','attack','sanction','geopolitical','conflict','military','missile','iran','russia','ukraine','china',
              'taiwan','north korea','nato','전쟁','지정학','분쟁','미중','한반도',
              'Red Sea','Houthi','Suez','Panama Canal','shipping disruption','embargo','SWIFT',
              'Taiwan Strait','South China Sea','AUKUS','nuclear','ICBM','hypersonic',
              'rare earth','critical minerals','chip war','tech decoupling','friendshoring','nearshoring',
              '홍해','후티','수에즈','대만해협','남중국해','기술패권','디커플링','핵심광물','희토류',
              'ceasefire','escalation','airstrike','invasion','defense spending',
              // v37.2: 중동 전쟁·지정학 키워드 보강
              'israel','lebanon','hezbollah','hormuz','strait','blockade','CENTCOM','drone','drone strike',
              'IRGC','proxy','oil tanker','tanker seizure','shipping lane','oil embargo',
              '이란','이스라엘','레바논','헤즈볼라','호르무즈','봉쇄','공습','드론','유조선','해상봉쇄'],
  'market-note': ['market note','market tape','risk-on','risk off','risk appetite','breadth lag','rotation','positioning',
              'short squeeze','liquidity','vol crush','volatility crush','mega-cap led','equal weight','factor rotation',
              'FOMO','crowding','gamma','dealers','market microstructure','rebound rally','relief rally'],
  'ai-policy': ['AI policy','AI regulation','export control','Commerce Department','Fable','Mythos','sovereign AI',
              'model export','nationality-based access','AI access','frontier model','compute governance','AI security',
              'foreign national','G7 AI','dual-use AI','AI sanctions','model weights','AI licensing'],
  semi:     ['semiconductor','chip','AI','GPU','HBM','TSMC','NVDA','AMD','AVGO','SMCI','memory','foundry',
              'Blackwell','H100','H200','CoWoS','EUV','ASML','반도체','파운드리','HBM',
              'wafer','fab','advanced packaging','chiplet','2nm','3nm','1.4nm','GAA',
              'DRAM','NAND','DDR5','CXL','AI server','data center','hyperscaler',
              'AI accelerator','inference','training','AI infrastructure','AI spending',
              'Micron','Intel','Qualcomm','Broadcom','Marvell','ARM','Samsung foundry','SK Hynix',
              '삼성전자','SK하이닉스','AI 서버','데이터센터','웨이퍼','선단공정','메모리',
              // v37.6: 첨단패키징·인터커넥트·AI신패러다임
              'CPO','co-packaged optics','silicon photonics','glass substrate','유리기판','광패키징',
              'BSPDN','backside power','interposer','HBM4','HBM3E',
              'agentic AI','에이전틱AI','multi-agent','reasoning model','on-device AI','AI PC',
              'sovereign AI','소버린AI','custom silicon','ASIC','Trainium','Inferentia',
              'liquid cooling','immersion cooling','액침냉각','수냉',
              'InfiniBand','NVLink','Ultra Ethernet',
              // v39.2: 메모리 CapEx/HBM/AGI (SemiAnalysis/AMD/Altman)
              'HBM sold out','HBM shortage','HBM4E','custom HBM','memory CapEx',
              'DRAM price','LPDDR5','memory inflation','memory supercycle',
              'VVP pricing','server price increase','B200 server',
              'AGI timeline','automated researcher','compute crunch','Sora',
              'data sovereignty','데이터 주권',
              'HBM 매진','메모리 인플레이션','메모리 CapEx','서버 가격 인상',
              '휴머노이드','humanoid','Figure','Optimus',
              // v37.3: 메가캡 테크 · AI 기업 · 주요 이벤트
              'NVIDIA','Apple','AAPL','Microsoft','MSFT','Google','GOOGL','Alphabet','Amazon','AMZN',
              'Meta','META','Tesla','TSLA','GTC','WWDC','Google I/O','Build','re:Invent','CES',
              'OpenAI','ChatGPT','GPT','Anthropic','Claude','xAI','Grok','Mistral','Perplexity',
              'FSD','Robotaxi','Optimus','Terafab','Vision Pro','Copilot','AWS','Azure',
              'LLM','large language model','foundation model','AGI',
              '엔비디아','테슬라','애플','마이크로소프트','구글','아마존','메타',
              '오픈AI','앤트로픽','자율주행','로보택시','비전프로',
              // v48.16 (integrate 2026-04-18): 커스텀 실리콘 + 광학 + 신규 AI 이벤트
              'MTIA','Meta MTIA','Rubin CPX','Vera Rubin','NVLink Fusion','CX9',
              'HBF','high bandwidth flash','DustPhotonics','ZR optical','x402',
              'Google Cloud Next','Google I/O','Marketing Live','Brandcast','Ask Maps',
              'Search Live','Personal Intelligence','OpenAI TAC','Project Glasswing','Trust Access',
              // 위성통신·D2D·LEO (Globalstar/AMZN LEO 보강)
              'satellite','D2D','Direct-to-Device','LEO','low earth orbit','SpaceX Starlink',
              'Globalstar','Amazon LEO','Project Kuiper','spectrum allocation',
              '위성통신','위성 인프라','저궤도','스페이스X'],
  earnings: ['earnings','EPS','revenue','guidance','quarterly','beat','miss','Q1','Q2','Q3','Q4','실적','가이던스',
              'profit','net income','operating income','margin','outlook','forecast','consensus','estimate',
              'revenue growth','earnings surprise','earnings call','conference call','10-K','10-Q',
              '매출','영업이익','순이익','컨센서스','전망','실적 발표','어닝'],
  energy:   ['oil','brent','WTI','OPEC','LNG','gas','crude','energy','원유','천연가스','에너지',
              'refinery','pipeline','drilling','shale','offshore','upstream','downstream','midstream',
              'oil supply','oil demand','oil inventory','SPR','strategic petroleum','OPEC+',
              'natural gas','Henry Hub','TTF','coal','carbon','emission','carbon credit',
              'nuclear','uranium','SMR','solar','wind','renewable','clean energy','hydrogen',
              // v37.6: 데이터센터 전력·EV 800V·배터리
              'data center power','AI power demand','nuclear data center','grid infrastructure',
              '800V','SiC','solid state battery','LFP','sodium-ion','EV battery',
              'liquid cooling','immersion cooling','power density',
              '정유','시추','셰일','원전','우라늄','태양광','풍력','수소','재생에너지',
              '데이터센터전력','800V','전고체배터리','액침냉각','전력반도체'],
  crypto:   ['bitcoin','BTC','ETH','crypto','blockchain','defi','NFT','코인','비트코인',
              'stablecoin','USDT','USDC','mining','hashrate','halving','on-chain',
              'crypto ETF','spot ETF','futures ETF','Coinbase','Binance',
              'DeFi','DEX','TVL','staking','validator','layer 2','rollup',
              'SEC crypto','crypto regulation','MiCA',
              '이더리움','솔라나','스테이블코인','채굴','온체인','디파이','크립토 ETF'],
  optical:  ['optical','photonics','silicon photonics','CPO','NPO','co-packaged optics','EML','CW laser','DFB laser',
              'VCSEL','InP','indium phosphide','OCS','optical circuit switch','1.6T optics','3.2T optics',
              'Celestial','NVLink Fusion','Lumentum','Coherent','AAOI','Applied Optoelectronics','Lightmatter','Ayar Labs',
              'DustPhotonics','scale-up optical','scale-out optical','optical capacity lock','laser bottleneck'],
  power:    ['power grid','grid','HVDC','800V HVDC','SOFC','solid oxide fuel cell','fuel cell','onsite power',
              'behind-the-meter','time-to-power','transformer','substation','switchgear','data center power',
              'AI power demand','rack power','power density','grid bottleneck','PPA','power purchase agreement',
              'Bloom Energy','Vertiv','Eaton','Quanta Services','Schneider Electric','gas turbine'],
  memory:   ['memory','DRAM','NAND','HBM','HBM4','HBM4E','HBM3E','SOCAMM','DDR5','LPDDR','eSSD','HBF',
              'Micron','MU','SK Hynix','Samsung memory','Kioxia','SanDisk','Western Digital','Seagate',
              'memory supercycle','DRAM ASP','NAND ASP','contract price','memory LTA'],
  materials:['WF6','tungsten hexafluoride','MLCC','silicon capacitor','glass substrate','glass core','CoPoS',
              'ABF','CCL','copper clad laminate','photoresist','EUV mask','photomask','InP substrate',
              'Kanto Denka','Central Glass','Samsung Electro-Mechanics','Murata','TDK'],
  analyst:  ['price target','target price','upgrades to','downgrades to','initiates coverage','overweight','underweight',
              'buy rating','sell rating','목표주가','투자의견'],
  // ── v31.8: 신규 토픽 추가
  bond:     ['bond','treasury','yield','credit spread','investment grade','high yield','junk bond',
              'corporate bond','sovereign bond','municipal bond','TIPS','TLT','HYG','LQD',
              'duration','convexity','coupon','maturity','issuance','auction',
              '채권','국채','회사채','하이일드','크레딧','스프레드','듀레이션','국고채','금리'],
  credit:   ['credit spread','credit spreads','corporate bond','corporate bonds','investment grade',
              'high yield','junk bond','IG OAS','HY OAS','ICE BofA OAS','OAS','LQD','HYG','CDS',
              'credit default swap','funding cost','funding costs','capex funding','AI capex funding',
              'data center financing','project finance','debt financing','debt issuance','bond issuance',
              'rating downgrade','rating downgrades','credit rating downgrade','private credit',
              'credit stress','default risk','loan spread','bank lending standards',
              'credit crunch','financing conditions','capital markets access',
              'company debt','hyperscaler debt','AI infrastructure financing',
              'company bond','credit downgrade','funding pressure','financing pressure'],
  fx:       ['forex','FX','currency','exchange rate','dollar index','DXY',
              'USD/JPY','EUR/USD','GBP/USD','USD/KRW','USD/CNY',
              'carry trade','intervention','capital flow','hot money',
              'devaluation','revaluation','peg','float',
              '환율','원달러','엔달러','유로달러','위안','캐리트레이드','외환','외환보유고'],
  defense:  ['defense','defence','military','weapon','arms','missile','fighter jet',
              'Lockheed','Raytheon','Northrop','General Dynamics','BAE','Boeing defense',
              'NATO','defense budget','defense spending','arms deal','procurement',
              'space','satellite','rocket','launch','SpaceX','Rocket Lab',
              // v37.6: 골든돔·드론방어·우주방위
              'Golden Dome','Iron Dome','missile defense','missile shield','hypersonic defense',
              'drone defense','counter-drone','directed energy','laser weapon','space defense',
              'DARPA','AUKUS','Palantir defense','Anduril','Shield AI',
              // v39.2: 트럼프 FY2027 국방예산 $1.5T
              'FY2027','defense budget','national defense','defense wish list',
              'Virginia-class','submarine','F-35 procurement','weapons production',
              'Indo-Pacific','munitions','stockpile','무기 재고','국방예산','버지니아급',
              '골든돔','아이언돔','미사일방어','극초음속방어','드론방어','레이저무기','우주방위',
              '방산','방위산업','무기','군수','한화에어로','한국항공우주','LIG넥스원',
              '우주','위성','발사체','로켓'],
  equity:   ['stock','share','equity','index','rally','sell-off','correction','bull market','bear market',
              'market cap','IPO','buyback','dividend','split','listing',
              'S&P 500','Nasdaq','Dow','Russell','KOSPI','KOSDAQ',
              '주식','주가','시장','상승','하락','급등','급락','시가총액','상장',
              '코스피','코스닥','나스닥','다우',
              // v37.3: 기업 이벤트 · 금융 기업 보강
              'acquisition','merger','M&A','antitrust','DOJ','FTC',
              'product launch','keynote','investor day','analyst day',
              'CEO','management change','restructuring','layoff','cost cutting',
              'JPMorgan','Goldman Sachs','Morgan Stanley','Bank of America','Citigroup',
              'Berkshire','Buffett','Netflix','NFLX','Disney','DIS','Uber','UBER','Airbnb','ABNB',
              'Visa','Mastercard','Salesforce','CrowdStrike','Palantir','Snowflake',
              '인수합병','경영권','구조조정','해고','인원감축',
              'JP모건','골드만삭스','버크셔','버핏','넷플릭스','디즈니'],
  // ── v37.7: 헬스케어/바이오 토픽 신설
  healthcare:['GLP-1','Wegovy','Ozempic','Mounjaro','Zepbound','semaglutide','tirzepatide',
              'obesity drug','weight loss drug','anti-obesity','oral GLP-1',
              'Novo Nordisk','NVO','Eli Lilly','LLY','Amgen',
              'ADC','antibody drug conjugate','bispecific','CAR-T','cell therapy','gene therapy',
              'mRNA','CRISPR','gene editing','RNA therapeutics','biosimilar',
              'FDA','FDA approval','clinical trial','Phase 3','PDUFA','NDA','BLA',
              'oncology','immunotherapy','PD-1','checkpoint inhibitor','orphan drug',
              'drug pricing','patent cliff','loss of exclusivity',
              'biotech','pharmaceutical','pharma M&A',
              '비만치료제','GLP-1','위고비','오젬픽','마운자로',
              '바이오','신약','임상','FDA','식약처','바이오시밀러',
              '항체약물접합체','ADC','이중항체','CAR-T','세포치료','유전자치료',
              '알테오젠','에이비엘바이오','삼성바이오로직스','셀트리온'],
  // ── v37.7: 조선·해운 토픽 신설
  shipbuilding:['shipbuilding','shipyard','newbuild','vessel','order book',
              'LNG carrier','tanker','container ship','bulk carrier',
              'warship','naval vessel','frigate','destroyer','submarine',
              'HD Hyundai','Hanwha Ocean','Samsung Heavy',
              'shipping','freight rate','BDI','Baltic Dry','SCFI','container rate',
              'IMO','decarbonization','LNG bunkering','methanol fuel','ammonia fuel',
              '조선','LNG선','컨테이너선','벌크선','해운','군함','수주',
              'HD현대중공업','한화오션','삼성중공업','HD현대미포',
              '해운운임','BDI','친환경선박','메탄올추진','암모니아추진'],
  // ── v37.7: 우주·위성 토픽 신설
  space:    ['space','satellite','LEO','low earth orbit','Starlink','SpaceX',
              'Rocket Lab','RKLB','Blue Origin','AST SpaceMobile','ASTS',
              'Iridium','Globalstar','Planet Labs','L3Harris','Northrop Grumman',
              'launch','rocket','orbit','space station','space economy',
              'direct-to-cell','satellite internet','satellite constellation',
              'space debris','space defense','DARPA','Space Force',
              '우주','위성','발사체','저궤도','스타링크','우주경제',
              '누리호','우주항공청','우주방위'],
  // ── v37.7: 양자컴퓨팅 토픽 신설
  quantum:  ['quantum computing','quantum computer','qubit','quantum advantage',
              'quantum supremacy','quantum error correction','topological qubit',
              'IONQ','IonQ','Rigetti','D-Wave','IBM Quantum','Google Willow','Quantinuum',
              'quantum networking','quantum cryptography','post-quantum','PQC',
              '양자컴퓨팅','양자컴퓨터','큐비트','양자우위','양자암호'],
};

// v29.1: 금융 관련성 화이트리스트 키워드 — 비금융 소스에서 이 중 하나라도 있어야 통과
const _FINANCE_RELEVANCE_KW = [
  // 시장/경제
  'stock','market','share','equity','index','dow','s&p','nasdaq','russell',
  'bull','bear','rally','selloff','sell-off','correction','crash','surge','plunge',
  'investor','portfolio','fund','etf','hedge fund','mutual fund',
  'ipo','m&a','merger','acquisition','buyback','dividend','split',
  'earnings','revenue','profit','loss','guidance','forecast','outlook','quarter',
  'valuation','p/e','market cap','billion','million','trillion',
  // 금융/은행/채권
  'bank','bond','treasury','yield','credit','debt','loan','lending','default',
  'fed','rate','interest rate','monetary','fiscal','stimulus','qe','qt',
  'inflation','deflation','cpi','pce','gdp','employment','payroll','unemployment',
  // 섹터
  'semiconductor','chip','foundry','wafer','fab','hbm','dram','nand','memory',
  'oil','crude','brent','opec','lng','natural gas','commodity','gold','copper',
  'bitcoin','crypto','blockchain','defi','mining',
  'ev ','electric vehicle','battery','solar','renewable',
  'pharma','biotech','fda','drug approval','clinical trial',
  // 기업/분석
  'ceo','cfo','board','shareholder','analyst','upgrade','downgrade','price target',
  'revenue growth','profit margin','operating income','free cash flow',
  'supply chain','trade war','tariff','sanction','export ban','regulation',
  // ── v31.8: 채권·금리·통화 심화
  'yield curve','credit spread','investment grade','high yield','junk bond',
  'corporate bond','sovereign','municipal bond','duration','convexity',
  'coupon','maturity','issuance','auction','repo','reverse repo',
  'money market','commercial paper','certificate of deposit',
  'central bank','monetary policy','rate cut','rate hike','pivot',
  'quantitative','tightening','easing','tapering','balance sheet',
  'currency','forex','fx','exchange rate','dollar index','dxy',
  'carry trade','intervention','capital flow','devaluation',
  // ── v31.8: 기업 이벤트 심화
  'insider buying','insider selling','13f','sec filing','proxy','activist',
  'spin-off','spinoff','divestiture','restructuring','bankruptcy','chapter 11',
  'share repurchase','tender offer','secondary offering','shelf registration',
  'lockup','pipe deal','warrant','convertible','preferred',
  'credit rating','moody','fitch','s&p rating','rating change',
  'capex','r&d','opex','sgna','gross margin','operating margin','net margin',
  'ebitda','fcf','roic','roe','roa','roce',
  'backlog','order book','bookings','pipeline','contract win','contract award',
  'index inclusion','rebalancing','reconstitution',
  // ── v31.8: 방산/우주/에너지전환
  'defense','defence','military','weapon','arms deal','defense budget',
  'space','satellite','rocket','launch vehicle',
  'nuclear','uranium','smr','solar panel','wind turbine','hydrogen',
  'ev battery','lithium','cobalt','nickel','cathode','solid state',
  'carbon credit','emission','esg','sustainability',
  // ── v31.8: 지정학 → 시장 영향
  'geopolitical','war','conflict','escalation','ceasefire','sanction',
  'embargo','blockade','strait','shipping disruption','supply disruption',
  'rare earth','critical mineral','export control','chip ban',
  'friendshoring','nearshoring','reshoring','decoupling',
  // ── v31.8: 시장 구조
  'short interest','short squeeze','gamma squeeze','options expiration','opex',
  'dark pool','market maker','dealer','liquidity','bid-ask spread',
  'volatility','vix','implied volatility','realized volatility',
  'futures','options','derivatives','swap','forward','hedging',
  'margin','leverage','deleveraging','risk-off','risk-on',
  'passive','active','flow','inflow','outflow','rotation',
  'breadth','advance-decline','new high','new low','oversold','overbought',
  // 한국어 — 대폭 확장
  '주식','시장','주가','코스피','코스닥','투자','펀드','매출','이익','수익',
  '금리','채권','은행','대출','금융','경제','산업','수출','수입','무역',
  '반도체','배터리','전기차','바이오','제약','원유','에너지',
  // ── v31.8: 한국어 심화
  '환율','원달러','달러인덱스','엔화','위안화',
  '국채','회사채','하이일드','크레딧','스프레드','듀레이션',
  '한국은행','금통위','기준금리','통화정책',
  '실적','영업이익','순이익','가이던스','컨센서스','어닝',
  '자사주','배당','증자','감자','공개매수','인수합병',
  '공매도','대차잔고','신용잔고','외국인','기관','수급',
  '방산','군수','조선','원전','우라늄','수소','태양광','풍력',
  '2차전지','리튬','양극재','음극재','분리막','전해질',
  'AI','인공지능','데이터센터','클라우드','서버','GPU',
  '금','은','구리','철광석','원자재','선물','옵션',
  '펀더멘털','밸류에이션','PER','PBR','ROE','시가총액',
  '상장','IPO','스팩','SPAC','상장폐지',
  '지정학','전쟁','제재','수출규제','공급망',
  '경기','침체','호황','회복','둔화','성장',
  '물가','인플레','디플레','스태그플레이션',
];

// ── 시간창(Time Window) 설정 ─────────────────────────────────────
// 섹션별 뉴스 노출 기간 (단위: 시간)
// v30.12 P5: 시간창 조정 — 홈 7일→48시간, 시장 3일→48시간 (stale 뉴스 제거)
const TW_HOME_H     = 24;    // v51.31: 전체 뉴스/소식은 08:00 KST 기준 24h 사이클
const TW_MARKET_H   = 24;    // v51.31: 시장 소식도 일간 사이클로 통일
const TW_BRIEFING_H = 24;    // 데일리 브리핑: 24시간 이내

// pubDate 기반 나이 필터 (pubDate 없으면 최신으로 간주)
function filterByAge(items, maxHours) {
  if (!maxHours || !items) return items || [];
  const cutoff = Date.now() - maxHours * 3600000;
  return items.filter(i => {
    if (!i.pubDate) return true;
    const t = new Date(i.pubDate).getTime();
    return isNaN(t) ? true : t >= cutoff;
  });
}

function filterByKst0800NewsCycle(items) {
  if (!items) return [];
  var bw = typeof _getBriefingWindowKST === 'function' ? _getBriefingWindowKST() : null;
  if (!bw) return filterByAge(items, 24);
  return items.filter(function(i) {
    if (!i || !i.pubDate) return false;
    var t = new Date(i.pubDate).getTime();
    return isFinite(t) && t >= bw.start && t < bw.end;
  });
}

// ═══════════════════════════════════════════════════════════════
// v20: 기관급 뉴스 선별 엔진 (scoreItem + classifyTopic + render)
// ═══════════════════════════════════════════════════════════════

/* ── scoreItem(): 뉴스 중요도 스코어링 (0~100+) ────────────────
   기관 리서치 데스크 기준:
   1) 키워드 매칭 (매크로 > 테크 > 실적 > 분석)
   2) 소스 신뢰도 (Tier 가중치)
   3) 신선도 (시간 감쇄)
   4) 티커 언급 부스트
   5) 중복/스팸 패널티
   ─────────────────────────────────────────────────────────── */
// v49.0 P182: scoreItem LRU 200건 캐시 — 동일 기사 재채점 방지
var _scoreItemCache = (typeof window._aioLRU === 'function') ? window._aioLRU('scoreItem', 200) : null;
function _scoreItemKey(item) {
  return (item.title || '') + '|' + (item.source || '') + '|' + (item.pubDate || '');
}
function _scoreItemCachePut(item, score) {
  if (item && !item.impactVector && typeof calcNewsImpactVector === 'function') {
    item.impactVector = calcNewsImpactVector(item);
  }
  if (_scoreItemCache) {
    _scoreItemCache.set(_scoreItemKey(item), { s: score, tm: item._tickerMentions || 0, bl: !!item._blacklisted, sr: item._scoreReasons || [] });
  }
  return score;
}
// AIO.diag.scoreCache() 진단 API 등록 (aio-core.js AIO.diag 패턴 동기화)
(function() {
  if (typeof window.AIO === 'undefined') window.AIO = {};
  window.AIO.diag = window.AIO.diag || {};
  window.AIO.diag.scoreCache = function() {
    return {
      scoreItem: _scoreItemCache ? _scoreItemCache.stats() : 'N/A',
      tickerRegex: _tickerRegexCache ? _tickerRegexCache.stats() : 'N/A'
    };
  };
})();

function calcNewsImpactVector(item) {
  item = item || {};
  var text = ((item.title || '') + ' ' + (item.desc || '') + ' ' + (item.summary || '')).toLowerCase();
  var topic = item.topic || (typeof classifyTopic === 'function' ? classifyTopic(item) : 'general');
  var sent = typeof getSentimentFromText === 'function' ? getSentimentFromText(text) : 'neut';
  var tickers = [];
  try {
    tickers = (typeof extractTickers === 'function') ? extractTickers(item) : (item.tickers || []);
  } catch(e) { tickers = item.tickers || []; }
  var factor = 'GENERAL';
  var urgency = 20;
  var technicalImpact = 'NEUTRAL';
  var portfolioImpact = tickers.length ? 'CHECK_POSITION_EXPOSURE' : 'BROAD_MARKET';
  if (/(fed|fomc|rate|yield|inflation|cpi|pce|goolsbee|musalem|wash|금리|물가|인플레|연준)/i.test(text)) {
    factor = 'RATES_INFLATION'; urgency += 25;
  } else if (/(gpu|semiconductor|hbm|ai infrastructure|inference|token|data center|nebius|eigen|반도체|추론|데이터센터)/i.test(text)) {
    factor = 'AI_INFRA_SEMI'; urgency += 22;
  } else if (/(tariff|trade|export control|sanction|관세|수출통제|제재)/i.test(text)) {
    factor = 'POLICY_TRADE'; urgency += 20;
  } else if (/(earnings|guidance|revenue|margin|실적|가이던스)/i.test(text)) {
    factor = 'EARNINGS'; urgency += 18;
  } else if (/(oil|crude|energy|원유|에너지)/i.test(text)) {
    factor = 'ENERGY'; urgency += 14;
  }
  if (/(breakout|new high|melt.?up|rally|surge|신고가|돌파|급등)/i.test(text)) technicalImpact = 'MOMENTUM_UP';
  if (/(sell.?off|breakdown|below|plunge|급락|이탈|붕괴)/i.test(text)) technicalImpact = 'DOWNSIDE_RISK';
  if (/(overheat|mania|climax|bubble|과열|버블|헤지|trim)/i.test(text)) technicalImpact = 'EXIT_RISK';
  if (sent === 'bear' || sent === 'warn') urgency += 10;
  if (item.tier === 1) urgency += 10;
  urgency = Math.max(0, Math.min(100, urgency));
  return {
    tickerImpact: tickers.slice(0, 8),
    factor: factor,
    technicalImpact: technicalImpact,
    portfolioImpact: portfolioImpact,
    urgency: urgency,
    sentiment: sent,
    topic: topic
  };
}
window.calcNewsImpactVector = calcNewsImpactVector;

function scoreItem(item) {
  // LRU 캐시 체크
  if (_scoreItemCache) {
    var _cacheKey = _scoreItemKey(item);
    var _cached = _scoreItemCache.get(_cacheKey);
    if (_cached !== null && _cached !== undefined) {
      item._tickerMentions = _cached.tm;
      if (_cached.bl) item._blacklisted = true;
      item._scoreReasons = _cached.sr || [];
      item.impactVector = calcNewsImpactVector(item);
      return _cached.s;
    }
  }

  let score = 0;
  const scoreReasons = [];
  const text = ((item.title || '') + ' ' + (item.desc || '')).toLowerCase();

  // ── 1. 키워드 매칭 점수 (v42.5: 제목 가중치 + 키워드 길이 가중치) ──────
  let macroHits = 0, techHits = 0, medHits = 0, analystHits = 0;
  const _titleLow = (item.title || '').toLowerCase();
  const _descLow  = (item.desc  || '').toLowerCase();

  // v46.6: 키워드 길이 가중치 — CJK 2글자 상향 (한국어 '금리'='interest rate' 동등)
  // 영문: 1글자=0.3, 2글자=0.6, 3-4글자=1.0, 5글자+=1.3
  // CJK: 1글자=0.5, 2글자=0.9, 3글자+=1.0 (정보밀도 보정)
  function _kwLen(kw) {
    var l = kw.length;
    var isCJK = /[\uAC00-\uD7AF\u4E00-\u9FFF\u3040-\u30FF]/.test(kw);
    if (isCJK) return l <= 1 ? 0.5 : l <= 2 ? 0.9 : 1.0;
    return l <= 1 ? 0.3 : l <= 2 ? 0.6 : l <= 4 ? 1.0 : 1.3;
  }
  // 제목 발견 시 1.5배 가중 — 제목 키워드가 본문보다 핵심 토픽임
  // v48.95 P1-1: _wordHit 단어경계 매칭 — '금'.includes('금리') 오탐 방지
  function _kwHit(kw, tl, dl) {
    var kwl = kw.toLowerCase(), w = _kwLen(kw);
    var hitFn = (typeof window._wordHit === 'function') ? window._wordHit : function(t,k){ return t.includes(k); };
    if (hitFn(tl, kwl)) return w * 1.5;  // 제목 히트
    if (hitFn(dl, kwl)) return w;         // 본문 히트
    return 0;
  }

  MACRO_KW.forEach(kw   => { macroHits   += _kwHit(kw, _titleLow, _descLow); });
  TECH_KW.forEach(kw    => { techHits    += _kwHit(kw, _titleLow, _descLow); });
  MED_KW.forEach(kw     => { medHits     += _kwHit(kw, _titleLow, _descLow); });
  ANALYST_KW.forEach(kw => { analystHits += _kwHit(kw, _titleLow, _descLow); });

  // v30.12 P2: 로그 스케일 + 밀도 기반 점수 (키워드 나열 역전 방지)
  // 첫 1~2개 키워드에서 대부분의 점수, 이후 체감 증가
  score += Math.min(Math.round(Math.log2(macroHits + 1) * 16), 40);   // 1→16, 2→25, 4→32, 8→40
  score += Math.min(Math.round(Math.log2(techHits + 1) * 12), 30);    // 1→12, 2→19, 4→24
  score += Math.min(Math.round(Math.log2(medHits + 1) * 6), 15);      // 1→6, 2→10, 4→12
  // v43.4: 애널리스트 패널티 제거 → 소폭 보너스 (목표주가/등급 변경은 투자 정보)
  // 대형주 추가 부스트는 티커 검출 후 처리 (아래 섹션)
  score += Math.min(analystHits, 1) * 3;  // 최대 +3 (작게 유지 — 소형주 노이즈 방지)

  // v30.12: 키워드 밀도 보너스 — 짧은 텍스트에 핵심 키워드 집중 = 높은 점수
  var totalHits = macroHits + techHits + medHits;
  var wordCount = text.split(/\s+/).length;
  if (wordCount > 0 && totalHits > 0) {
    var density = totalHits / wordCount;
    if (density > 0.15) score += 5;       // 매우 집중적 (예: "Fed rate cut CPI inflation")
    else if (density > 0.05) score += 2;  // 적당한 밀도
    // 낮은 밀도(< 0.05)는 보너스 없음 — 키워드 나열 기사 불이익
  }

  // ── 2. 소스 신뢰도 가중치 ──────────────────────────────
  const tierBonus = { 1: 15, 2: 8, 3: 3 };
  score += tierBonus[item.tier] || 0;

  // 프리미엄 소스 추가 부스트
  const premiumSources = ['Reuters','Bloomberg','WSJ','CNBC','MarketWatch','FT Markets','S&P Global','Barrons',
    'CNN','NYT','BBC','Seeking Alpha','Yahoo Finance','Investing.com','Benzinga','The Block','Defense One',
    'Nikkei Asia','SCMP','AP Business','Nasdaq','Forbes','Business Insider','Morningstar','The Economist',
    'Kitco','DL News','CoinDesk','SemiAnalysis','TrendForce','Digitimes','EE Times'];
  if (premiumSources.some(s => (item.source || '').includes(s))) score += 5;

  // v34.1c: 미국 주식 시장 중심 스크리너 — 소스 계층 부스트
  // US Tier1 외신 최우선, 한국은 콘텐츠 품질로만 판단
  if (item.country === 'us' && item.tier === 1) score += 12;
  else if (item.country !== 'kr' && item.tier === 1) score += 8;
  else if (item.country !== 'kr' && item.tier === 2) score += 4;
  // v46.6: 한국 Tier 2 소스 소폭 부스트 (기존: 0) — US 편향 완화
  // 한국 Tier 1 (연합, 한경, 매경)은 이미 tierBonus=15로 충분
  if (item.country === 'kr' && item.tier === 2) score += 3;
  // v38.3 B3: 한국 Tier 3 소스 감점 — 비금융 기사 유입 가능성 높은 소스
  if (item.country === 'kr' && item.tier === 3) score -= 5;

  // v34.1c: 대형주/대장주/주도주 티커 부스트 시스템
  // 시장을 주도하는 핵심 종목에 대한 뉴스를 우선 노출
  const _MEGA_TICKERS = new Set([
    // US Mega Cap (시총 $500B+)
    'AAPL','MSFT','NVDA','GOOGL','GOOG','AMZN','META','TSLA','BRK.B','AVGO',
    'LLY','JPM','V','UNH','MA','XOM','COST','HD','PG','JNJ',
    // US 주도주/테마 대장주
    'AMD','SMCI','ARM','PLTR','MRVL','MU','QCOM','INTC','TSM','ASML',
    'COIN','MSTR','SQ','CRWD','SNOW','NET','DDOG','ZS','PANW',
    'LMT','RTX','NOC','GD','BA','HII','LHX',
    // 핵심 ETF/지수
    'SPY','QQQ','DIA','IWM','SOXX','SMH','XLE','XLF','XLK','GLD','TLT','VIX',
    // 한국 대장주
    '삼성전자','SK하이닉스','현대차','LG에너지솔루션','삼성바이오로직스','POSCO홀딩스',
    'NAVER','카카오','셀트리온','기아','한화에어로스페이스',
  ]);
  const _LARGE_TICKERS = new Set([
    'ORCL','CRM','ADBE','NOW','UBER','ABNB','SHOP','SQ','RBLX',
    'NKE','DIS','NFLX','PYPL','BABA','PDD','JD','SE','GRAB',
    'CVX','COP','SLB','OXY','DVN','HAL','MPC','VLO','PSX',
    'GS','MS','C','BAC','WFC','AXP','BLK','SCHW','ICE',
    'PFE','MRK','ABBV','TMO','ABT','ISRG','REGN','MRNA','VRTX',
    'CAT','DE','GE','HON','MMM','UNP','UPS','FDX',
    'WMT','TGT','LOW','MCD','SBUX','CMG','YUM',
    'DELL','HPE','WDC','STX','ON','MCHP','TXN','ADI','KLAC','LRCX','AMAT',
  ]);
  // v29.1: 구글뉴스 소스 부스트
  if ((item.source || '').includes('구글뉴스')) score += 4;

  // ── 3. 신선도 감쇄 (시간이 지나면 점수 감소) ────────────
  if (item.pubDate) {
    const ageH = (Date.now() - new Date(item.pubDate).getTime()) / 3600000;
    if (ageH <= 1) score += 20;           // 1시간 이내: +20
    else if (ageH <= 6) score += 12;      // 6시간 이내: +12
    else if (ageH <= 24) score += 5;      // 24시간 이내: +5
    else if (ageH <= 72) score += 0;      // 3일 이내: 보너스 없음
    else score -= Math.min((ageH - 72) / 24, 15); // 3일 이후: 하루당 -1, 최대 -15
  }

  // ── 4. 티커 언급 부스트 (v30.12: 오탐 방지 — extractTickers 재사용) ──
  const foundTickers = extractTickers(item);
  let tickerMentions = foundTickers.length;
  const titleText = (item.title || '');
  foundTickers.forEach(ticker => {
    const re = new RegExp('\\b' + ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    if (re.test(titleText)) {
      score += 4; // 제목에서 티커 발견: +4
    } else {
      score += 2; // 본문에서 티커 발견: +2
    }
  });
  item._tickerMentions = tickerMentions;

  // 금융 관련성 총합 (정치 감점 판단에 필요하므로 여기서 선언)
  const finRelevance = macroHits + techHits + medHits + tickerMentions;

  // v34.1c: 대형주/대장주/주도주 티커 부스트 시스템
  if (foundTickers.length > 0) {
    const hasMega = foundTickers.some(t => _MEGA_TICKERS.has(t));
    const hasLarge = foundTickers.some(t => _LARGE_TICKERS.has(t));
    if (hasMega) score += 8;        // 메가캡/대장주 뉴스: +8
    else if (hasLarge) score += 4;  // 대형주 뉴스: +4
    // v43.4: 대형주 애널리스트 목표주가·등급 변경 — 시장 임팩트 있음 → 추가 부스트
    if (analystHits > 0) {
      if (hasMega) score += 10;      // 메가캡 등급변경: +10 (총점 충분히 확보)
      else if (hasLarge) score += 5; // 대형주 등급변경: +5
    }
  }

  // ── 5. 감정 강도 부스트 (극단적 표현) ────────────────────
  const urgentKW = ['crash','surge','plunge','soar','spike','collapse','record high','record low',
                    '급등','급락','폭락','폭등','사상최고','사상최저','긴급','속보','breaking'];
  urgentKW.forEach(kw => { if (text.includes(kw.toLowerCase())) score += 3; });

  // ── 5b. v39.0: 핵심 인물 발언/인터뷰 부스트 ────────────────
  // 시장 영향력 있는 인물의 발언·인터뷰·연설은 높은 중요도
  const _KEY_FIGURES = ['powell','yellen','lagarde','jensen huang','tim cook','elon musk',
    'satya nadella','lisa su','altman','sam altman','dario amodei','greg brockman','demis hassabis','ilya sutskever',
    'buffett','dimon','dalio','ackman','druckenmiller',
    'trump','biden','xi jinping','putin',
    'mark zuckerberg','sundar pichai','andy jassy','pat gelsinger','sanjay mehrotra',
    'lloyd austin','austin','jake sullivan',
    '파월','옐런','젠슨 황','일론 머스크','올트먼','샘 올트먼','다리오 아모데이','버핏','트럼프','시진핑','푸틴',
    '사티아 나델라','리사 수','마크 저커버그','순다르 피차이','팻 겔싱어','앤디 재시','산제이 메흐로트라'];
  const _SPEECH_KW = ['says','said','interview','speech','remarks','testimony','hearing',
    'conference','keynote','told','warns','expects','sees','calls for','announces',
    '발언','인터뷰','연설','기자회견','증언','청문','담화','언급','경고','전망','선언'];
  const hasKeyFigure = _KEY_FIGURES.some(kw => text.includes(kw));
  if (hasKeyFigure) {
    score += 8; // 핵심 인물 언급 자체 +8
    const hasSpeechContext = _SPEECH_KW.some(kw => text.includes(kw));
    if (hasSpeechContext) score += 7; // 발언/인터뷰 맥락이면 추가 +7 (총 +15)
  }

  // ── 5c. v40.4: 5대 우선 토픽 부스트 (매크로/지정학/주식/외환/채권) ──
  // 이 5개 토픽이 시장에 직접 영향. 나머지 시사/정치는 시장 연관 시에만 통과.
  const _PRIORITY_KW = [
    // 매크로/경제
    'gdp','cpi','ppi','pce','employment','unemployment','payroll','fomc','fed fund','rate cut','rate hike',
    'inflation','deflation','recession','soft landing','hard landing','stagflation',
    '경제성장','물가','고용','실업','금리','인플레이션','디플레이션','경기침체','스태그플레이션',
    // 지정학
    'tariff','sanction','embargo','trade war','export control','chip ban','liberation day',
    'iran','ukraine','taiwan strait','south china sea','nato','missile','nuclear',
    '관세','제재','무역전쟁','수출규제','전쟁','미사일','핵',
    // 주식/시장
    'earnings','revenue','eps','guidance','buyback','dividend','ipo','spac','m&a','acquisition',
    'bull market','bear market','correction','crash','rally','breakout','all-time high',
    '실적','매출','순이익','자사주','배당','상장','인수','합병','폭락','폭등','사상최고',
    // 외환
    'dollar','yen','euro','yuan','won','currency','forex','exchange rate','dxy',
    '달러','엔화','유로','위안','원화','환율',
    // 채권/금리
    'treasury','yield','bond','credit spread','yield curve','inversion',
    '국채','수익률','채권','크레딧 스프레드','수익률 곡선',
    // v48.18 (integrate 2026-04-18): 35건 자료 핵심 토픽 우선 노출
    // AI 인프라 공급 가시성
    'mtia','meta mtia','tpu roadmap','lta','long-term agreement','custom silicon',
    'vera rubin','rubin cpx','nvlink fusion','cx9','blackwell ultra',
    // 메모리 패러다임
    'hbf','high bandwidth flash','hbm+hbf','inference memory','3계층 메모리',
    '메모리 lta','메모리 슈퍼사이클','hbm 점유',
    // DC 규제 + 전력
    'data center ban','dc moratorium','maine dc','grid connection delay','data center regulation',
    '데이터센터 금지','전력망 부하','온사이트 발전','wartsila','34sg engine',
    // 머스크 테라팹 + 장비주
    'terafab','테라팹','applied materials','tokyo electron','lam research',
    // Google 2026 이벤트
    'google cloud next','google i/o','marketing live','brandcast','ask maps','gemini 3.5',
    // AI 보안 표준화
    'glasswing','project glasswing','openai tac','trust access for cyber','gpt-5.4 cyber',
    // 위성 통신
    'globalstar','amazon leo','project kuiper','d2d','direct-to-device','low earth orbit',
    // 자산배분/로테이션
    'data dependence','forward guidance failure','2% inflation target','mid-inflation',
    '중물가','데이터 디펜던스','이익 확산','quality rotation',
    // v50.15 (텔레그램 통합): 최신 AI 인프라/메모리/소버린 AI 토픽 우선 노출
    'ai factory','ai 팩토리','sovereign ai','소버린 ai','socamm','vera cpu','vera rubin','kyber',
    'hbm4','hbm4e','hbm5','lpddr6','agentic ai','에이전트 ai','physical ai','피지컬 ai',
    'memory shortage','메모리 부족','dram shortage','asic','tpu','positioning unwind','포지셔닝 청산',
    'rate cut withdrawn','금리인하 철회','memory super-cycle','메모리 슈퍼사이클','data center power','데이터센터 전력',
    'hormuz','호르무즈','red sea','홍해','houthi','후티','lng fid','exaone','blackwell','rubin',
  ];
  var priorityHits = 0;
  _PRIORITY_KW.forEach(kw => { if (text.includes(kw)) priorityHits++; });
  if (priorityHits >= 3) score += 15;      // 핵심 토픽 집중: +15
  else if (priorityHits >= 1) score += 5;  // 핵심 토픽 언급: +5

  // ── 5d. v40.4: 비시장 정치/시사 뉴스 강력 감점 ──
  // 정치/시사 키워드가 있지만 시장 연관 키워드가 없으면 대폭 감점
  const _POLITICS_ONLY_KW = ['election','vote','poll','campaign','congress','senate','legislation','bill passed',
    '선거','투표','여론조사','국회','국정감사','법안','탄핵','청문회','대통령실','비서실',
    'supreme court','abortion','immigration','gun control','death penalty',
    '이민','총기','사형','낙태','인권','시위','집회','데모'];
  var politicsHits = 0;
  _POLITICS_ONLY_KW.forEach(kw => { if (text.includes(kw)) politicsHits++; });
  // v46.6: finRelevance 임계값 1→1.5 상향 + 정책/규제 키워드 예외 추가
  // "대통령 AI 보조금 발표", "반도체 규제 완화" 같은 금융영향 정책 뉴스 오탐 방지
  var _hasPolicyKW = ['보조금','규제','정책','세금','감세','증세','관세','수출규제','수출통제',
    'subsidy','regulation','policy','tax','tariff','export control','sanction','stimulus',
    'antitrust','legislation','executive order','행정명령','법안'].some(function(kw) { return text.includes(kw); });
  if (politicsHits > 0 && priorityHits === 0 && finRelevance <= 1.5 && !_hasPolicyKW) {
    score -= 25; // 정치/시사만 있고 시장 연관 없음 → 대폭 감점
  }

  // ── 6. 중복/스팸 패널티 ────────────────────────────────
  const spamKW = ['sponsored','advertisement','promoted','partner content','editorial','opinion piece'];
  spamKW.forEach(kw => { if (text.includes(kw)) score -= 20; });

  // v39.2: 클릭베이트/투자 스팸 감지 — 소거법 (패턴 매칭 즉시 차단)
  const _CLICKBAIT_RE = /(\d+배|\d+x\b|텐배거|대박주|급등주|폭등 예고|급등 임박|10x|100x|next tesla|next nvidia|must buy|guaranteed return|millionaire|get rich|won't believe|don't miss|last chance|놓치면 후회|지금이 마지막|마지막 기회|수익률 보장|원금 보장|100% 수익|이 주식만|이 종목만|반드시 사야|무조건 사야|리딩방|시크릿|비밀 종목|숨겨진 종목|아무도 모르는|전문가만 아는|삼성 잡는|애플 잡는|엔비디아 잡는|best stock.?to buy|stocks? to buy now|hidden gem|secret stock|penny stock|easy money|yolo stock|to the moon|explosive growth potential)/i;
  if (_CLICKBAIT_RE.test(text)) {
    item._blacklisted = true;
    return _scoreItemCachePut(item, 0);
  }

  // ── v34.1c: 3단계 뉴스 선별 시스템 (컨텍스트 기반) ──────────────
  // 원칙: "주식/금융 관련 키워드가 함께 있으면 → 통과 (정치 기사여도)"
  //       "주식/금융 관련 키워드가 전혀 없으면 → 차단 (어떤 소스여도)"
  //
  // 예시: "대통령이 코스피 부양 정책 발표" → '코스피'(MACRO_KW) 매칭 → 통과 
  //       "대통령이 교육 예산 확대"           → 금융KW 0개 → 차단 
  //       "울주군 복지단체 건강음료 배달사업"   → 금융KW 0개 → 차단 

  const isExempt = item._tgChannel ||
    ['Reuters','Bloomberg','WSJ','CNBC','MarketWatch','FT Markets','S&P Global',
     'Seeking Alpha','Investing.com','CoinDesk','OilPrice.com','Benzinga','Barrons',
     'Fed Reserve','ECB Press','IMF Blog','World Bank','BIS Speeches',
     'The Block','Decrypt','CoinTelegraph','DL News',
     'Defense One','Nikkei Asia','SCMP','AP Business','Yahoo Finance',
     'CNN Business','NYT Business','BBC Business','Zero Hedge',
     'TrendForce','Digitimes','SemiAnalysis','EE Times','Rigzone','Platts',
     'Nasdaq News','Forbes','Business Insider','Morningstar','The Economist',
     'Kitco Gold','Google News Finance','Channel News Asia'].includes(item.source);

  // ── STEP 1: 하드 블랙리스트 (금융 문맥에서 절대 안 나오는 키워드) ──
  // 연예/스포츠/부동산/범죄/날씨 등 = 금융 키워드와 공존할 가능성 0%
  if (NEWS_BLACKLIST_KW.some(kw => text.includes(kw.toLowerCase()))) {
    // 예외: 금융 관련성이 충분히 높으면 (finRelevance >= 3) 블랙리스트를 override
    // → "아파트 REIT 투자" 같은 기사가 '아파트'에 걸려도 구조 가능
    if (finRelevance >= 3) {
      score -= 10; // 패널티만 부과하고 통과
    } else {
      item._blacklisted = true;
      return 0;
    }
  }

  // ── STEP 2: 금융 관련성 게이트 (컨텍스트 기반) ──
  // v42.5: 가중치 기반 히트값 사용 → < 0.5 (짧은 키워드 1개 단독 히트 = 차단)
  if (finRelevance < 0.5) {
    // v48.95 P1-1: _wordHit 단어경계 — '금' 포함 단글자 CJK 키워드 오탐 방지
    const _hwFn = (typeof window._wordHit === 'function') ? window._wordHit : function(t,k){ return t.includes(k); };
    const finKwMatches = _FINANCE_RELEVANCE_KW.filter(kw => _hwFn(text, kw));
    if (finKwMatches.length === 0) {
      // 금융 관련 키워드가 단 하나도 없음 → 차단
      item._blacklisted = true;
      return 0;
    }
    // 광범위 한국어 키워드('기업','수출','에너지' 등)만으로 통과한 경우
    const _KR_BROAD_KW = ['기업','수출','수입','에너지','산업','경제','금융','은행','시장','무역'];
    const allBroad = finKwMatches.every(kw => _KR_BROAD_KW.includes(kw));
    if (allBroad && finKwMatches.length <= 3) {  // v38.3 B2: 임계값 2→3 상향 (광범위 KW 3개까지도 차단)
      // 지방정부 보도자료 패턴 → 차단
      item._blacklisted = true;
      return 0;
    }
    // 약한 관련성 → 감산
    score -= (allBroad ? 20 : 10);
  }

  // ── v31.8: 비금융 콘텐츠 추가 패턴 필터 ────────────────────
  // 제목에 금융과 전혀 무관한 패턴이 있으면 추가 감점
  const titleLower = (item.title || '').toLowerCase();
  const _nonFinPatterns = [
    /how to (?:cook|bake|clean|fix|decorate|style|dress)/,
    /best (?:phones|laptops|tablets|headphones|cameras|shows|movies|songs|books|games|apps|gifts|deals)/,
    /top \d+ (?:tips|tricks|ways|things|reasons|places|destinations|recipes)/,
    /review[:\s]|unboxing|hands[- ]on|first look/,
    /(?:wedding|birthday|anniversary|holiday|christmas|halloween|valentine)/,
    // v34.1b: 한국 지방정부 기사 패턴 (제목에서 지자체가 주어)
    /^(?:울주군|울산시|강원도|전남도|경남도|충남도|충북도|경북도|전북도|제주도|합천군|산청군|나주시|정선군|영월군|태백시|양양군|횡성군|평창군)/,
    /(?:군|시|도),\s*(?:올해|내년|금년|이번|신규|지역|도내|관내)/,
    // 한국 업무협약/행사/모집 패턴
    /업무협약|양해각서|mou\s*체결|협약식|체결식/,
    /선착순\s*모집|참가자\s*모집|수강생\s*모집/,
    /일자리\s*(?:창출|사업|대책|계획)|공공근로/,
    // 한국 인사/임명 패턴
    /\[인사\]|인사이동|보직변경|전보발령/,
    /(?:사장|원장|이사장|회장)\s*(?:\d+연임|취임|퇴임|이취임)/,
    // 영문 순수 비금융 패턴 (정치 제거 — 무역/관세/금융정책과 공존 가능하므로)
    /(?:governor|mayor)\s+(?:signs|vetoes|declares)\s+(?!.*(?:tax|budget|tariff|trade))/,
    // v38.3 B5: 한국어 비금융 패턴 추가
    /오늘의?\s*날씨|기상\s*(?:청|특보)|(?:폭우|폭설|한파|폭염)\s*(?:주의보|경보)/,
    /(?:축구|야구|농구|배구|골프)\s*(?:결과|경기|시즌|감독)/,
    /건강\s*(?:관리|검진|보험|증진)|의료\s*(?:봉사|지원|서비스)/,
    /입학\s*(?:식|설명회)|졸업\s*(?:식|축하)|학교\s*(?:폭력|급식|운영)/,
    /교통\s*(?:사고|정체|통제|우회)|도로\s*(?:공사|정비|개통)/,
    /(?:실종|수색|구조|신원)\s*(?:아동|노인|신고|확인)/,
    /(?:보이스피싱|전화사기|스미싱|피싱)\s*(?:피해|주의|예방)/,
    /(?:동물원|수족관|놀이공원|워터파크)\s*(?:개장|입장|이벤트)/,
    /(?:결혼|돌잔치|장례|제사|명절)\s*(?:준비|비용|선물)/,
    /(?:미용|피부|성형|다이어트|헬스)\s*(?:클리닉|시술|관리)/,
  ];
  if (_nonFinPatterns.some(pat => pat.test(titleLower))) {
    item._blacklisted = true;
    return _scoreItemCachePut(item, 0);
  }

  // 너무 짧은 제목 (스팸 가능성)
  if (macroHits > 0) scoreReasons.push('macroHits=' + Math.round(macroHits * 10) / 10);
  if (techHits > 0) scoreReasons.push('techHits=' + Math.round(techHits * 10) / 10);
  if (medHits > 0) scoreReasons.push('medHits=' + Math.round(medHits * 10) / 10);
  if (analystHits > 0) scoreReasons.push('analystHits=' + Math.round(analystHits * 10) / 10);
  if (item.tier != null) scoreReasons.push('tier=' + item.tier);
  if (foundTickers.length) scoreReasons.push('tickers=' + foundTickers.slice(0, 5).join(','));
  if (priorityHits > 0) scoreReasons.push('priorityHits=' + priorityHits);
  if (hasKeyFigure) scoreReasons.push('keyFigure');

  try {
    if (typeof isUnverifiedClaim === 'function' && isUnverifiedClaim(item)) {
      score -= 8;
      scoreReasons.push('unverified=-8');
    }
  } catch (_) {}

  if ((item.title || '').length < 15) {
    score -= 10;
    scoreReasons.push('shortTitle=-10');
  }

  // ── 7. 최소 0점 보장 ────────────────────────────────────
  var _finalScore = Math.max(0, Math.round(score));
  item._scoreReasons = scoreReasons.slice(0, 10);
  // LRU 캐시 저장 (P182: 재채점 방지)
  return _scoreItemCachePut(item, _finalScore);
}

/* ── classifyTopic(): 뉴스 토픽 분류 ───────────────────────── */
function classifyTopic(item) {
  const text = ((item.title || '') + ' ' + (item.desc || '')).toLowerCase();
  let bestTopic = 'general';
  let bestScore = 0;

  Object.entries(TOPIC_KEYWORDS).forEach(([topic, keywords]) => {
    let hits = 0;
    keywords.forEach(kw => {
      if (text.includes(kw.toLowerCase())) hits++;
    });
    if (hits > bestScore) {
      bestScore = hits;
      bestTopic = topic;
    }
  });

  // P563/R254: 소스(RSS/API) 제공 topics 태그를 우리 자체 키워드 매칭이 0건일 때 무검증으로
  // 신뢰하면, SCOTUS/정치 기사가 소스 측 넓은 "Technology"/"AI Policy" 분류에 걸려 있었다는
  // 이유만으로 "반도체·AI"로 표시되고, 그 태그를 근거로 AI 브리핑이 무관한 원문에 대해 구체적인
  // 반도체 분석을 생성하는 문제로 이어졌다. 소스 태그는 우리 TOPIC_KEYWORDS 어휘에 실제로 존재하는
  // 값일 때만 채택하고, 그렇지 않으면(우리 어휘에 없거나 자체 매칭도 0건) 정직하게 'general'로 둔다.
  if (bestScore === 0 && item.topics && item.topics.length > 0 && TOPIC_KEYWORDS.hasOwnProperty(item.topics[0])) {
    bestTopic = item.topics[0];
  }

  return bestTopic;
}

/* ── getSentimentFromText(): 뉴스 감성 분석 (bull/bear/neutral) ── */
function getSentimentFromText(text) {
  const t = (text || '').toLowerCase();
  // v46.9: 'war'→'trade war'/'military' + 'boom'→'market boom' 한정 (오분류 방지)
  const bullKW = ['surge','rally','beat','outperform','upgrade','record high','soar','market boom','bull','recovery',
                  '급등','상승','호재','상향','돌파','신고가','반등','회복'];
  const bearKW = ['crash','plunge','miss','downgrade','sell-off','collapse','fear','crisis','trade war','default',
                  'military','conflict','sanctions','급락','하락','악재','하향','폭락','위기','전쟁','부도'];

  let bullScore = 0, bearScore = 0;
  bullKW.forEach(kw => { if (t.includes(kw)) bullScore++; });
  bearKW.forEach(kw => { if (t.includes(kw)) bearScore++; });

  if (bullScore > bearScore + 1) return 'bull';
  if (bearScore > bullScore + 1) return 'bear';
  if (bearScore > bullScore) return 'warn';
  return 'neut';
}

/* ── getTopicBadge(): 토픽별 뱃지 HTML ─────────────────────── */
function getTopicBadge(topic) {
  const map = {
    macro:    { cls:'nit-warn', icon:'', label:'매크로' },
    geo:      { cls:'nit-bear', icon:'', label:'지정학' },
    semi:     { cls:'nit-neut', icon:'', label:'반도체' },
    earnings: { cls:'nit-bull', icon:'', label:'실적' },
    energy:   { cls:'nit-bear', icon:'', label:'에너지' },
    crypto:   { cls:'nit-neut', icon:'',  label:'크립토' },
    analyst:  { cls:'nit-neut', icon:'', label:'분석' },
    equity:   { cls:'nit-bull', icon:'', label:'주식' },
    bond:     { cls:'nit-warn', icon:'', label:'채권' },
    credit:   { cls:'nit-warn', icon:'', label:'크레딧' },
    fx:       { cls:'nit-warn', icon:'', label:'외환' },
    defense:  { cls:'nit-bear', icon:'', label:'방산' },
    healthcare:{ cls:'nit-bull', icon:'', label:'바이오' },
    shipbuilding:{ cls:'nit-neut', icon:'', label:'조선' },
    space:    { cls:'nit-neut', icon:'', label:'우주' },
    quantum:  { cls:'nit-neut', icon:'', label:'양자' },
    kr:       { cls:'nit-bull', icon:'', label:'한국' },
    fxbond:   { cls:'nit-warn', icon:'', label:'FX·채권' },
    general:  { cls:'nit-neut', icon:'', label:'일반' },
  };
  const m = map[topic] || map.general;
  return `<span class="news-item-tag ${m.cls}">${m.icon} ${m.label}</span>`;
}

/* ── v42.9: 미확인 소식통 감지 — 익명 소식통·교차검증 없는 기사 탐지 ── */
function isUnverifiedClaim(item) {
  var text = ((item.title || '') + ' ' + (item.desc || '') + ' ' + (item.translated || '')).toLowerCase();
  var patterns = [
    'sources say', 'sources said', 'sources told', 'source told',
    'people familiar', 'sources familiar', 'officials familiar',
    'according to people', 'people with knowledge', 'sources close to',
    'who asked not to be', 'who declined to be', 'speaking anonymously', 'speaking on condition',
    'unconfirmed report', 'unconfirmed claim',
    '소식통에 따르면', '소식통에 의하면', '익명의 관계자', '복수의 관계자',
    '복수의 소식통', '사정에 정통한', '알려진 바에 따르면'
  ];
  return patterns.some(function(p) { return text.indexOf(p) !== -1; });
}

/* ── v21: 정렬 모드 ──────────────────────────────────────────── */
let _newsSortMode = 'time'; // 'time' (최신순) or 'score' (중요도순)

function setNewsSortMode(mode, el) {
  _newsSortMode = mode;
  const timeBtn = document.getElementById('sort-time-btn');
  const scoreBtn = document.getElementById('sort-score-btn');
  if (timeBtn) timeBtn.classList.toggle('active', mode === 'time');
  if (scoreBtn) scoreBtn.classList.toggle('active', mode === 'score');
  if (newsCache.length > 0) {
    _aioNotifyNewsSurfaceInvalidated('news-sort');
    renderHomeFeed(newsCache);
  }
}

/* ══════════════════════════════════════════════════════════════════
   v21: 자동 한국어 번역 시스템
   - 뉴스 fetch 완료 후 자동으로 영어 뉴스를 한국어로 번역
   - Claude Haiku 4.5 API 사용 (뉴스/번역 배치 전용)
   - 한국어 뉴스는 번역 스킵
   - 번역 결과 캐시하여 중복 번역 방지
   ══════════════════════════════════════════════════════════════════ */
const _translationCache = new Map(); // normalizedKey -> { ko_title, ko_desc, ko_summary, ko_explain, ko_impact, ko_action, tickers, _failed }
let _translationInProgress = false;
// P858: translation is a non-critical enrichment plane. Keep it out of the
// interactive boot window and release one deduplicated batch after the first
// live-data phase. The visible news surface still renders source-language
// titles/local fallbacks while this queue is held.
const _translationDeferredItems = new Map();

function _aioQueueDeferredNewsTranslation(items) {
  if (!Array.isArray(items)) return;
  items.forEach(function(item) {
    if (!item || !item.title) return;
    var key = _tcKey(item.title);
    if (key && !_translationDeferredItems.has(key)) _translationDeferredItems.set(key, item);
  });
}

function _aioReleaseDeferredNewsTranslation() {
  if (!_translationDeferredItems.size || typeof autoTranslateNews !== 'function') return;
  var items = Array.from(_translationDeferredItems.values());
  _translationDeferredItems.clear();
  setTimeout(function() {
    try { autoTranslateNews(items).catch(function(){}); } catch(_) {}
  }, 0);
}

// v27.3: 캐시 키 정규화 — 공백/대소문자/특수문자 차이로 인한 lookup 실패 방지
function _tcKey(title) {
  if (!title) return '';
  return title.trim().replace(/\s+/g, ' ').slice(0, 120).toLowerCase();
}
function _tcHas(title) { return _translationCache.has(_tcKey(title)); }

// v30.12 P4: 캐시 LRU 삽입 + sessionStorage 연동
function _tcPut(title, data) {
  var key = _tcKey(title);
  if (!key) return;
  // LRU: 1000건 초과 시 가장 오래된 항목 제거 (기존 500 → 1000으로 확대)
  if (_translationCache.size >= 1000) {
    var firstKey = _translationCache.keys().next().value;
    _translationCache.delete(firstKey);
  }
  _translationCache.set(key, data);
}

// v30.12 P4 (v48.64): localStorage 저장 — 탭 닫아도 유지
function _tcSaveToStorage() {
  try {
    var obj = {};
    var count = 0;
    _translationCache.forEach(function(val, key) {
      if (count < 500 && !val._failed) { // 성공한 번역만 저장
        obj[key] = { t: val.ko_title, d: val.ko_desc, s: val.ko_summary, e: val.ko_explain, i: val.ko_impact, a: val.ko_action, r: val.ko_rewrite, sec: val.ko_section, m: val.ko_market, k: val.tickers };
        count++;
      }
    });
    localStorage.setItem('aio_tc', JSON.stringify(obj));
  } catch(e) { /* storage full or unavailable */ }
}

// v30.12 P4 (v48.64): localStorage 로딩 — 재방문 시에도 복원
function _tcLoadFromStorage() {
  try {
    var raw = localStorage.getItem('aio_tc');
    if (!raw) return 0;
    var obj = JSON.parse(raw);
    var loaded = 0;
    for (var key in obj) {
      if (obj.hasOwnProperty(key) && !_translationCache.has(key)) {
        var v = obj[key];
        _translationCache.set(key, {
          ko_title: v.t, ko_desc: v.d || '', ko_summary: v.s || '',
          ko_explain: v.e || '', ko_impact: v.i || '', ko_action: v.a || '',
          ko_rewrite: v.r || '', ko_section: v.sec || '', ko_market: v.m || '',
          tickers: v.k || [], _failed: false
        });
        loaded++;
      }
    }
    return loaded;
  } catch(e) { return 0; }
}

// 한국어 문자열 판별 (한국어면 번역 불필요)
function isKoreanText(text) {
  if (!text) return false;
  var korean = text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g);
  return korean && korean.length > text.length * 0.3; // 30% 이상 한글이면 한국어
}

// v52.42 (P657/EF-14): 뉴스 제목은 getDisplayTitle()이 이미 isKoreanText 가드로 원문 노출을 막지만,
// 그 뒤에 붙는 "(출처명)"은 소스명 자체가 번역 파이프라인 대상이 아니라(제목/요약만 번역) 이 가드를
// 거치지 않는다 — 실측(브리핑 핵심뉴스)에서 우크라이나어 등 키릴 소스명이 그대로 노출됨을 확인.
// 영어/한국어 소스명(Reuters, TradingKey, BornLupin·KR 등)은 그대로 두고, 비-라틴/비-한글 스크립트
// 비중이 높은 소스명만 일반 라벨로 대체(R206 계열 재발 방지).
function _aioSafeSourceLabel(source) {
  if (!source) return '';
  var s = String(source);
  var nonLatinKr = s.match(/[Ѐ-ӿ一-鿿؀-ۿ฀-๿֐-׿]/g);
  if (nonLatinKr && nonLatinKr.length > s.length * 0.3) return '외신';
  return source;
}
window._aioSafeSourceLabel = _aioSafeSourceLabel;

/* ── v30.12: Google Translate 무료 API (배치 지원 + 재시도 + 품질 검증 강화) ── */
const _GT_SEPARATOR = '\n§§§\n'; // 배치 구분자 — Google이 번역하지 않는 특수 패턴

// v30.12: 단일 텍스트 번역 (하위 호환)
async function googleTranslateFree(text, from='en', to='ko', _retry=0) {
  try {
    var result = await _gtBatchTranslate([text], from, to, _retry);
    return result[0];
  } catch(e) {
    if (typeof window._aioSetLastAiError === 'function') window._aioSetLastAiError(e, { source: 'translation' });
    _aioLog('warn', 'fetch', 'googleTranslateFree error: ' + e.message); return null;
  }
}

// v30.12: 배치 번역 — 최대 8건을 하나의 API 호출로 처리
// returns: string[] (각 항목의 번역 결과, 실패 시 null)
async function _gtBatchTranslate(texts, from, to, _retry) {
  from = from || 'en'; to = to || 'ko'; _retry = _retry || 0;
  if (!texts || texts.length === 0) return [];
  // 빈/짧은 텍스트 필터링 (위치 보존)
  var validMap = []; // { idx, text }
  for (var i = 0; i < texts.length; i++) {
    if (texts[i] && texts[i].length >= 3) {
      validMap.push({ idx: i, text: texts[i].slice(0, 500) });
    }
  }
  if (validMap.length === 0) return texts.map(function() { return null; });

  // 구분자로 연결
  var combined = validMap.map(function(v) { return v.text; }).join(_GT_SEPARATOR);

  // v46.6: 엔드포인트별 타임아웃 분화 (googleapis CDN=4s 빠름, google.com=10s 느림)
  var endpoints = [
    { url: 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + from + '&tl=' + to + '&dt=t&q=' + encodeURIComponent(combined), timeout: 4000 },
    { url: 'https://translate.google.com/translate_a/single?client=gtx&sl=' + from + '&tl=' + to + '&dt=t&q=' + encodeURIComponent(combined), timeout: 10000 },
  ];

  for (var ei = 0; ei < endpoints.length; ei++) {
    try {
      var r = await fetchWithTimeout(endpoints[ei].url, {}, endpoints[ei].timeout);
      if (!r.ok) {
        if (ei === endpoints.length - 1 && typeof window._aioSetLastAiError === 'function') window._aioSetLastAiError({ status: r.status, message: 'translation upstream HTTP ' + r.status }, { source: 'translation' });
        continue;
      }
      var d = await r.json();
      if (!Array.isArray(d) || !Array.isArray(d[0])) continue;
      var fullResult = d[0].map(function(s) { return (s && s[0]) || ''; }).join('');
      if (!fullResult || fullResult.length < 3) continue;

      // 구분자로 분리
      var parts = fullResult.split(/\s*§§§\s*/);
      // 분리 결과가 원본 개수와 다르면 → 개별 번역 폴백
      if (parts.length !== validMap.length) {
        if (validMap.length === 1) {
          parts = [fullResult];
        } else {
          // v46.6: 배치 분리자 실패 → 개별 1건씩 재시도 (기존: 전부 null 반환)
          _aioLog('warn', 'translate', '배치 분리자 불일치 (' + parts.length + '/' + validMap.length + ') → 개별 번역 폴백');
          var fallbackResults = new Array(texts.length);
          for (var fi = 0; fi < texts.length; fi++) fallbackResults[fi] = null;
          for (var si = 0; si < validMap.length; si++) {
            try {
              var singleUrl = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + from + '&tl=' + to + '&dt=t&q=' + encodeURIComponent(validMap[si].text.slice(0, 300));
              var sr = await fetchWithTimeout(singleUrl, {}, 5000);
              if (sr.ok) {
                var sd = await sr.json();
                if (Array.isArray(sd) && Array.isArray(sd[0])) {
                  var sText = sd[0].map(function(s2) { return (s2 && s2[0]) || ''; }).join('');
                  if (sText && _isKoreanTranslationValid(sText)) {
                    fallbackResults[validMap[si].idx] = sText;
                  }
                }
              }
            } catch(se) { /* 개별 실패 무시 — 다음 건 진행 */ }
            // 개별 번역 간 300ms 딜레이 (rate limit 방어)
            if (si < validMap.length - 1) await new Promise(function(r2) { setTimeout(r2, 300); });
          }
          return fallbackResults;
        }
      }

      // v30.12: 금융 텍스트 품질 검증 강화
      var results = new Array(texts.length);
      for (var ri = 0; ri < texts.length; ri++) results[ri] = null;
      for (var pi = 0; pi < parts.length; pi++) {
        var part = parts[pi].trim();
        if (!part || part.length < 2) continue;
        if (_isKoreanTranslationValid(part)) {
          results[validMap[pi].idx] = part;
        }
      }
      return results;
    } catch(e) { /* try next endpoint */ }
  }

  // 재시도 1회 (1.2초 후)
  if (_retry < 1) {
    await new Promise(function(resolve) { setTimeout(resolve, T.BATCH_DELAY); });
    return _gtBatchTranslate(texts, from, to, _retry + 1);
  }
  return texts.map(function() { return null; });
}

// v46.6: 금융 텍스트 한국어 번역 품질 검증 강화
// - 방법2 기준 7%→12% 상향 (기술용어 범벅 오탐 방지)
// - CJK 한자 범위 추가 (일본 경제 뉴스 번역 감지)
// - 최소 한글 3자 이상 필수 (2자="양산"만으로 통과 방지)
function _isKoreanTranslationValid(text) {
  if (!text || text.length < 2) return false;
  // 한글 + CJK 한자 (일본 경제 용어 혼용 번역 대응)
  var koreanChars = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) || []).length;
  // 순수 텍스트 길이 (티커·숫자·특수문자 제외)
  var pureText = text.replace(/[$%+\-.,0-9A-Z\s]/gi, '');
  // 방법1: 순수 텍스트 중 한국어 비율 50% 이상
  if (pureText.length > 0 && koreanChars >= pureText.length * 0.5) return true;
  // 방법2: 전체 텍스트 대비 한국어 12% + 최소 3자 이상 (v46.6: 7%+2자 → 12%+3자)
  if (koreanChars >= 3 && koreanChars >= text.length * 0.12) return true;
  // 방법3: 짧은 텍스트(30자 이하)는 한글 2자 + 8% OK (제목 번역)
  if (text.length <= 30 && koreanChars >= 2 && koreanChars >= text.length * 0.08) return true;
  return false;
}

/* ── v30.12: Claude 키 없을 때 Google Translate 무료 배치 번역 수행 ── */
function _aioNewsTopicKo(topic) {
  var t = String(topic || 'general').toLowerCase();
  var map = {
    macro: '매크로', fed: '연준/금리', rates: '금리', bond: '채권', credit: '크레딧', fx: '환율',
    geo: '지정학', geopolitics: '지정학', energy: '에너지', oil: '에너지',
    semi: '반도체/AI 인프라', ai: 'AI', 'ai-policy': 'AI 정책',
    earnings: '실적', equity: '주식', analyst: '애널리스트', policy: '정책',
    trade: '무역/관세', crypto: '크립토', healthcare: '헬스케어',
    defense: '방산', shipbuilding: '조선', space: '우주'
  };
  return map[t] || '시장';
}

function _aioNewsSentimentKo(sent) {
  var s = String(sent || 'neut').toLowerCase();
  if (s === 'bull' || s === 'positive') return '긍정';
  if (s === 'bear' || s === 'negative') return '부정';
  if (s === 'warn' || s === 'caution') return '경계';
  return '중립';
}

function _aioCleanNewsText(text, maxLen) {
  var out = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!out) return '';
  maxLen = maxLen || 180;
  return out.length > maxLen ? out.slice(0, maxLen - 1) + '…' : out;
}

var _AIO_NEWS_REWRITE_SECTION_LABELS = {
  'us-politics': '미국 정치',
  'diplomacy': '국제외교',
  'geo': '지정학',
  'middle-east': '중동 전쟁 및 지정학',
  'fed-econ': '연준 및 미국 경제',
  'ai-bigtech': 'AI 및 빅테크',
  'us-equity': '미국 주식 및 기업',
  'crypto': '암호화폐',
  'energy': '원자재 및 에너지',
  'global-econ': '글로벌 경제 및 중앙은행',
  'analyst': '투자의견 및 목표가',
  'semi': '반도체·AI 인프라',
  'market': '시장 종합'
};

function _aioNewsRewriteSectionLabel(key) {
  return _AIO_NEWS_REWRITE_SECTION_LABELS[key] || _AIO_NEWS_REWRITE_SECTION_LABELS.market;
}

function _aioNormalizeNewsRewriteSectionKey(value) {
  var raw = String(value || '').trim();
  if (_AIO_NEWS_REWRITE_SECTION_LABELS[raw]) return raw;
  for (var key in _AIO_NEWS_REWRITE_SECTION_LABELS) {
    if (_AIO_NEWS_REWRITE_SECTION_LABELS[key] === raw) return key;
  }
  var lower = raw.toLowerCase();
  if (/정치|trump|white house/.test(lower)) return 'us-politics';
  if (/외교|협상|diplomacy|talk/.test(lower)) return 'diplomacy';
  if (/중동|이스라엘|이란|middle/.test(lower)) return 'middle-east';
  if (/지정학|geo|전쟁/.test(lower)) return 'geo';
  if (/연준|금리|경제|fed|macro/.test(lower)) return 'fed-econ';
  if (/ai|빅테크|big tech/.test(lower)) return 'ai-bigtech';
  if (/주식|기업|equity/.test(lower)) return 'us-equity';
  if (/암호|crypto|bitcoin/.test(lower)) return 'crypto';
  if (/원자재|에너지|oil|energy/.test(lower)) return 'energy';
  if (/글로벌|중앙은행|global/.test(lower)) return 'global-econ';
  if (/투자의견|목표가|analyst/.test(lower)) return 'analyst';
  if (/반도체|semi|hbm/.test(lower)) return 'semi';
  return raw ? 'market' : '';
}

function _aioNewsRewriteSectionKey(item) {
  item = item || {};
  var topic = String(item.topic || (typeof classifyTopic === 'function' ? classifyTopic(item) : '') || '').toLowerCase();
  var blob = [item.title, item.ko_title, item.desc, item.description, item.source, topic].join(' ').toLowerCase();
  if (/analyst|upgrade|downgrade|initiates|coverage|target price|price target|overweight|underweight|buy rating|sell rating|neutral/.test(blob) || topic === 'analyst') return 'analyst';
  if (/trump|vance|white house|congress|senate|republican|democrat|election|tariff|us government|washington/.test(blob)) return 'us-politics';
  if (/witkoff|kushner|switzerland|qatar|pakistan|negotiation|memorandum|geneva|diplomat|talks/.test(blob)) return 'diplomacy';
  if (/iran|hormuz|lebanon|israel|hezbollah|centcom|middle east|ceasefire|strait|red sea|ukraine|russia|war/.test(blob) || topic === 'geo' || topic === 'geopolitics') {
    if (/lebanon|israel|hezbollah|ceasefire|middle east|iran|hormuz/.test(blob)) return 'middle-east';
    return 'geo';
  }
  if (/fed|fomc|powell|rate cut|interest rate|treasury yield|cpi|pce|jobs report|inflation|recession|dollar/.test(blob) || ['macro','fed','rates','bond','fx'].indexOf(topic) !== -1) return 'fed-econ';
  if (/oil|brent|wti|natural gas|natgas|lng|opec|energy|crude|barrel|shipping|tanker/.test(blob) || topic === 'energy' || topic === 'oil') return 'energy';
  if (/bitcoin|ethereum|crypto|solana|avalanche|btc|eth|stablecoin|on-chain|mev/.test(blob) || topic === 'crypto') return 'crypto';
  if (/ai|anthropic|openai|nvidia|nvda|data center|cloud|musk|meta|alphabet|microsoft|big tech/.test(blob) || topic === 'ai' || topic === 'ai-policy') return 'ai-bigtech';
  if (/semiconductor|hbm|memory|dram|tsmc|sk hynix|samsung|micron|broadcom|marvell|smh|soxx|chip/.test(blob) || topic === 'semi') return 'semi';
  if (/boj|ecb|boe|canada|mexico|japan|china|europe|iaea|imf|world bank|central bank/.test(blob)) return 'global-econ';
  if (/earnings|guidance|revenue|margin|shares|stock|nasdaq|s&p|dow|company|deal|ipo|merger/.test(blob) || ['equity','earnings'].indexOf(topic) !== -1) return 'us-equity';
  return 'market';
}

function _aioNewsMarketMeaning(item, sectionKey) {
  item = item || {};
  var tickers = [];
  try { tickers = typeof getDisplayTickers === 'function' ? getDisplayTickers(item) : (extractTickers(item) || []).map(function(t) { return '$' + t; }); } catch(_) {}
  tickers = Array.isArray(tickers) ? tickers.filter(Boolean).slice(0, 4) : [];
  var label = _aioNewsRewriteSectionLabel(sectionKey);
  if (tickers.length) return tickers.join(', ') + ' 관련 가격·거래량·섹터 강도를 함께 확인할 필요가 있습니다.';
  if (sectionKey === 'energy') return '유가와 인플레이션 기대, 에너지·운송 섹터의 변동성으로 연결될 수 있습니다.';
  if (sectionKey === 'fed-econ') return '금리·달러·성장주 밸류에이션 경로를 다시 확인해야 하는 변수입니다.';
  if (sectionKey === 'middle-east' || sectionKey === 'geo' || sectionKey === 'diplomacy') return '헤드라인보다 실제 물류·원자재 가격·위험자산 반응을 우선 확인해야 합니다.';
  if (sectionKey === 'crypto') return '위험자산 심리와 유동성 변화가 코인 및 관련주에 반영되는지 봐야 합니다.';
  if (sectionKey === 'analyst') return '목표가 변화보다 실적 추정치와 실제 수급 반응 동반 여부가 중요합니다.';
  return label + ' 관련 시장 영향은 가격 반응과 후속 보도로 교차검증해야 합니다.';
}

function _aioBuildNewsRewriteBullet(item, tr) {
  item = item || {};
  tr = tr || _aioGetNewsTranslation(item);
  var sectionKey = _aioNormalizeNewsRewriteSectionKey(tr.ko_section) || _aioNewsRewriteSectionKey(item);
  var rewrite = _aioCleanNewsText(tr.ko_rewrite || tr.ko_title || item.ko_title || item.title || '', 170);
  var explain = _aioCleanNewsText(tr.ko_market || tr.ko_explain || tr.ko_summary || '', 130);
  if (!rewrite) rewrite = _aioCleanNewsText(item.desc || item.description || '', 170);
  if (!rewrite) rewrite = '확인 가능한 원문 제목이 부족해 후속 데이터 교차검증이 필요합니다.';
  if (!/[.?!다요음임함됨니다]$/.test(rewrite)) rewrite += '라고 전해졌습니다.';
  if (explain && rewrite.indexOf(explain) === -1) rewrite += ' ' + explain;
  else if (!explain) rewrite += ' ' + _aioNewsMarketMeaning(item, sectionKey);
  return rewrite.replace(/\s+/g, ' ').trim();
}

function _aioBuildNewsKoreanRewriteBrief(items, opts) {
  opts = opts || {};
  var maxSections = opts.maxSections || 8;
  var maxItemsPerSection = opts.maxItemsPerSection || 5;
  var src = Array.isArray(items) ? items : [];
  var groups = {};
  var order = ['us-politics','diplomacy','geo','middle-east','fed-econ','ai-bigtech','us-equity','analyst','semi','crypto','energy','global-econ','market'];
  src.slice(0, opts.maxScan || 60).forEach(function(item) {
    if (!item) return;
    var tr = _aioGetNewsTranslation(item);
    var key = _aioNormalizeNewsRewriteSectionKey(tr.ko_section) || _aioNewsRewriteSectionKey(item);
    if (!groups[key]) groups[key] = [];
    if (groups[key].length >= maxItemsPerSection) return;
    groups[key].push({
      bullet: _aioBuildNewsRewriteBullet(item, tr),
      source: item.source || '',
      tickers: tr.tickers || []
    });
  });
  var sections = order.filter(function(key) { return groups[key] && groups[key].length; }).slice(0, maxSections).map(function(key) {
    return { key: key, label: _aioNewsRewriteSectionLabel(key), items: groups[key] };
  });
  var now = new Date();
  var dateLabel = now.getFullYear() + '년 ' + (now.getMonth() + 1) + '월 ' + now.getDate() + '일';
  return {
    generatedAt: now.toISOString(),
    dateLabel: dateLabel,
    sections: sections,
    count: sections.reduce(function(sum, sec) { return sum + sec.items.length; }, 0)
  };
}

function _aioRenderNewsKoreanRewriteBrief(items, targetId) {
  var el = document.getElementById(targetId || 'news-korean-rewrite-brief');
  if (!el) return null;
  var brief = _aioBuildNewsKoreanRewriteBrief(items, { maxSections: 8, maxItemsPerSection: 5, maxScan: 60 });
  if (!brief.sections.length) {
    el.innerHTML = '';
    el.style.display = 'none';
    return brief;
  }
  var sectionHtml = brief.sections.map(function(sec) {
    var bullets = sec.items.map(function(row) {
      return '<div style="font-size:11px;line-height:1.58;color:var(--text-secondary);margin:3px 0;">· ' + escHtml(row.bullet) + '</div>';
    }).join('');
    return '<div style="padding:10px 12px;border-top:1px solid var(--border);">' +
      '<div style="font-size:12px;font-weight:800;color:var(--text-primary);margin-bottom:6px;">📍' + escHtml(sec.label) + '</div>' +
      bullets +
      '</div>';
  }).join('');
  el.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:4px;overflow:hidden;">' +
    '<div style="padding:10px 12px;background:var(--surface-1);display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;">' +
    '<div style="font-size:12px;font-weight:900;color:var(--text-primary);">시장 핵심 요약 - ' + escHtml(brief.dateLabel) + '</div>' +
    '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">한국어 재구성 · ' + brief.count + '건</div>' +
    '</div>' + sectionHtml +
    '<div style="padding:8px 12px;border-top:1px solid var(--border);font-size:10px;line-height:1.5;color:var(--text-muted);">외신·Telegram·RSS를 한국어 투자 브리핑 문장으로 재작성한 요약입니다. 원문 확인과 가격·거래량 교차검증이 필요합니다.</div>' +
    '</div>';
  el.style.display = 'block';
  return brief;
}

// ── v51.56: 텔레그램 다이제스트 포스트 파싱 + 구조화 한국어 렌더러 ──────────
// 목적: Weekend Summary / Market Summary 등 다이제스트 포스트를
//       카테고리별 불릿 구조로 파싱해 market-news / briefing 페이지에 표시

function _aioParseTgDigestSections(text) {
  var lines = (text || '').split('\n');
  var sections = [];
  var cur = null;
  lines.forEach(function(line) {
    line = line.trim();
    if (!line) return;
    // 구분선/푸터/작성자 줄 건너뜀
    if (/^━+$/.test(line) || /^작성자:|^t\.me\/|^위켄드 서머리/.test(line)) return;
    // 섹션 헤더: 국기/핀/특수 이모지로 시작하는 40자 이하 줄
    if (/^[📍🌎🇺🇸🇪🇺🌍🌏🌐◆■▶⚡💡🔴🟡🟢🇰🇷🇯🇵🇨🇳]/.test(line) && line.length <= 45) {
      var label = line.replace(/^[^\w가-힣]+/, '').replace(/^\s+/, '').trim();
      if (label && label.length > 1 && label !== '특이사항 없음') {
        cur = { label: label, bullets: [] };
        sections.push(cur);
      }
      return;
    }
    // 불릿 포인트: ·, •, - 로 시작
    if (/^[·•\-]/.test(line) && cur) {
      var bullet = line.replace(/^[·•\-\s]+/, '').trim();
      if (bullet.length >= 10 && bullet !== '특이사항 없음') {
        cur.bullets.push(bullet);
      }
    }
  });
  return sections.filter(function(s) { return s.bullets.length > 0; });
}

function _aioGetTgDigestPosts() {
  return (window.AIO_TELEGRAM_BROAD_ITEMS || []).filter(function(it) {
    return (it.text || '').includes('━━━━') || (it.text || '').length > 800;
  }).sort(function(a, b) {
    return (b.localDateKst || '').localeCompare(a.localDateKst || '');
  });
}

function _aioRenderTgDigestBrief(targetId) {
  var el = document.getElementById(targetId);
  if (!el) return;
  var digests = _aioGetTgDigestPosts();
  if (!digests.length) { el.style.display = 'none'; return; }

  var allSections = [];
  var title = '';
  var dateLabel = '';
  var seenLabels = {};

  digests.slice(0, 3).forEach(function(d) {
    var firstLine = (d.text || '').split('\n')[0].replace(/━+/g, '').trim();
    if (!title && firstLine.length > 3) {
      title = firstLine;
      dateLabel = (d.localDateKst || '').slice(0, 10);
    }
    _aioParseTgDigestSections(d.text).forEach(function(sec) {
      if (!seenLabels[sec.label]) {
        seenLabels[sec.label] = true;
        allSections.push(sec);
      }
    });
  });

  if (!allSections.length) { el.style.display = 'none'; return; }

  var html = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:4px;overflow:hidden;">';
  html += '<div style="padding:10px 12px;background:var(--surface-1);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">';
  html += '<div style="font-size:12px;font-weight:900;color:var(--text-primary);">' + escHtml(title || '시장 요약') + '</div>';
  html += '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">' + escHtml(dateLabel) + ' · ' + allSections.length + '개 카테고리</div>';
  html += '</div>';

  allSections.forEach(function(sec) {
    html += '<div style="padding:9px 12px;border-top:1px solid var(--border);">';
    html += '<div style="font-size:11px;font-weight:800;color:var(--text-primary);margin-bottom:5px;">📍 ' + escHtml(sec.label) + '</div>';
    sec.bullets.forEach(function(bullet) {
      html += '<div style="font-size:11px;line-height:1.62;color:var(--text-secondary);margin:3px 0 3px 6px;padding-left:8px;border-left:2px solid var(--border);">· ' + escHtml(bullet) + '</div>';
    });
    html += '</div>';
  });

  html += '<div style="padding:7px 12px;border-top:1px solid var(--border);font-size:10px;color:var(--text-muted);">@insidertracking 채널 원문 기반 주간 요약 · 투자 결정 전 원문과 가격 교차 확인 필요</div>';
  html += '</div>';

  el.innerHTML = html;
  el.style.display = 'block';
}

try { window._aioRenderTgDigestBrief = _aioRenderTgDigestBrief; } catch(_) {}
// ── END v51.56 텔레그램 다이제스트 렌더러 ──────────────────────────────────

function _aioBuildNewsLocalKoreanInsight(item, preferredTitle) {
  item = item || {};
  var title = _aioCleanNewsText(preferredTitle || item.ko_title || item.title || '', 160);
  var topic = item.topic || (typeof classifyTopic === 'function' ? classifyTopic(item) : 'general');
  var sectionKey = _aioNewsRewriteSectionKey(item);
  var topicKo = _aioNewsTopicKo(topic);
  var vec = item.impactVector || null;
  try { if (!vec && typeof calcNewsImpactVector === 'function') vec = calcNewsImpactVector(item); } catch(_) {}
  vec = vec || {};
  var sent = vec.sentiment || item.sentiment || null;
  try { if (!sent && typeof getSentimentFromText === 'function') sent = getSentimentFromText((item.title || '') + ' ' + (item.desc || '')); } catch(_) {}
  var sentimentKo = _aioNewsSentimentKo(sent);
  var tickers = [];
  try { tickers = typeof getDisplayTickers === 'function' ? getDisplayTickers(item) : (extractTickers(item) || []).map(function(t) { return '$' + t; }); } catch(_) {}
  tickers = Array.isArray(tickers) ? tickers.filter(Boolean).slice(0, 5) : [];
  var factor = String(vec.factor || topic || 'GENERAL').toUpperCase();
  var urgency = vec.urgency ? String(vec.urgency).toUpperCase() : '';
  var technical = vec.technicalImpact ? String(vec.technicalImpact).toUpperCase() : '';
  var summary = topicKo + ' 뉴스입니다. 헤드라인 기준 톤은 ' + sentimentKo + '이고' + (tickers.length ? ', 관련 티커는 ' + tickers.join(', ') + '입니다.' : ', 시장 전체 영향 여부를 확인해야 합니다.');
  var explainMap = {
    macro: '금리, 달러, 성장률 기대와 주식 밸류에이션 경로를 같이 확인하세요.',
    fed: '정책금리 기대, 장단기 금리, 달러와 성장주 할인율에 미치는 영향을 같이 보세요.',
    rates: '채권금리 변화가 성장주/배당주/금융주 상대강도에 반영되는지 확인하세요.',
    bond: '채권금리와 신용스프레드 변화가 위험자산 선호를 바꾸는지 확인하세요.',
    credit: '회사채, LQD/HYG, OAS, 등급하향, CAPEX 자금조달 비용이 AI 인프라 투자 여력을 훼손하는지 확인하세요.',
    fx: '달러와 환율 변화가 원자재, 해외 매출주, 외국인 수급에 미치는 영향을 보세요.',
    geo: '지정학 리스크는 유가, 방산, 운송, 안전자산 선호로 전이되는지 확인하세요.',
    geopolitics: '지정학 리스크는 유가, 방산, 운송, 안전자산 선호로 전이되는지 확인하세요.',
    energy: '유가와 에너지 스프레드가 인플레이션 기대와 섹터 로테이션을 흔드는지 보세요.',
    semi: 'AI 인프라, 메모리, 장비, 전력/광통신 밸류체인으로 영향이 확산되는지 보세요.',
    ai: '모델/클라우드/데이터센터 투자와 규제 리스크가 관련 밸류체인에 반영되는지 확인하세요.',
    'ai-policy': '수출통제, 주권 AI, 클라우드 접근 규칙이 AI 공급망과 수요에 미치는 영향을 보세요.',
    earnings: '실적, 가이던스, 마진, 컨센서스 변화가 주가 추세와 거래량에 확인되는지 보세요.',
    equity: '개별주 뉴스는 지수보다 해당 종목의 가격/거래량/상대강도 확인이 우선입니다.',
    analyst: '목표가/등급 변경은 컨센서스 방향성과 실제 추정치 변화가 동반되는지 확인하세요.',
    policy: '정책 뉴스는 시행 시점, 수혜/피해 업종, 규제 강도를 분리해 보세요.',
    trade: '관세와 무역규칙 변화는 비용, 공급망, 지역별 매출 노출로 나눠 확인하세요.'
  };
  var explain = explainMap[String(topic || '').toLowerCase()] || '원문 헤드라인만으로 단정하지 말고 가격, 거래량, 관련 지표와 교차 확인하세요.';
  var impactParts = ['분류=' + topicKo, '톤=' + sentimentKo];
  if (factor) impactParts.push('팩터=' + factor);
  if (technical) impactParts.push('기술=' + technical);
  if (urgency) impactParts.push('긴급도=' + urgency);
  var action = (tickers.length ? tickers.join(', ') + '의 ' : '관련 자산의 ') + '당일 추세, 거래량, 섹터 상대강도와 원문을 함께 확인하세요.';
  var market = _aioNewsMarketMeaning(item, sectionKey);
  var rewrite = title ? title.replace(/\s+/g, ' ').trim() : '';
  if (rewrite && !/[.?!다요음임함됨니다]$/.test(rewrite)) rewrite += '라고 전해졌습니다.';
  if (rewrite && market) rewrite += ' ' + market;
  return {
    ko_title: title,
    ko_desc: _aioCleanNewsText(item.ko_desc || item.desc || item.description || '', 220),
    ko_summary: summary,
    ko_explain: explain,
    ko_impact: impactParts.join(' · '),
    ko_action: action,
    ko_rewrite: rewrite,
    ko_section: sectionKey,
    ko_market: market,
    tickers: tickers
  };
}

function _aioGetNewsTranslation(item) {
  item = item || {};
  var cached = item.title ? _translationCache.get(_tcKey(item.title)) : null;
  var local = _aioBuildNewsLocalKoreanInsight(item, cached && cached.ko_title);
  var merged = Object.assign({}, local, cached || {});
  if (!merged.ko_title) merged.ko_title = item.title || '';
  if (!merged.ko_desc) merged.ko_desc = local.ko_desc || '';
  if (!merged.ko_summary) merged.ko_summary = local.ko_summary || '';
  if (!merged.ko_explain) merged.ko_explain = local.ko_explain || '';
  if (!merged.ko_impact) merged.ko_impact = local.ko_impact || '';
  if (!merged.ko_action) merged.ko_action = local.ko_action || '';
  if (!merged.ko_rewrite) merged.ko_rewrite = local.ko_rewrite || '';
  merged.ko_section = _aioNormalizeNewsRewriteSectionKey(merged.ko_section) || local.ko_section || _aioNewsRewriteSectionKey(item);
  if (!merged.ko_market) merged.ko_market = local.ko_market || _aioNewsMarketMeaning(item, merged.ko_section);
  if (!merged.tickers || !merged.tickers.length) merged.tickers = local.tickers || [];
  return merged;
}

async function freeTranslateNews(items) {
  if (_aioBootPhase.translationReady === false) {
    _aioQueueDeferredNewsTranslation(items);
    return;
  }
  var statusEl = document.getElementById('translate-status');
  if (statusEl) statusEl.innerHTML = '번역 준비 중...';

  var needTrans = items.filter(function(i) {
    return i.title && !isKoreanText(i.title) && !_translationCache.has(_tcKey(i.title));
  });
  // 한국어 뉴스 먼저 처리
  items.filter(function(i) {
    return i.title && isKoreanText(i.title) && !_translationCache.has(_tcKey(i.title));
  }).forEach(function(i) {
    var tickers = extractTickers(i).map(function(t) { return '$' + t; });
    var local = _aioBuildNewsLocalKoreanInsight(i, i.title);
    _tcPut(i.title, Object.assign({}, local, { ko_title: i.title, ko_desc: i.desc || local.ko_desc || '', tickers: tickers.length ? tickers : local.tickers }));
  });

  if (needTrans.length === 0) {
    if (statusEl) statusEl.textContent = '✓ 번역 불필요 (한국어 뉴스)';
    if (typeof window._aioSetLastAiError === 'function') window._aioSetLastAiError({ status: 200, message: 'success' }, { source: 'translation' });
    return;
  }

  var total = needTrans.length;
  var translated = 0, failed = 0;
  var failedItems = [];

  // v30.12: 8건씩 배치 번역 (기존 1건씩 → 8배 속도 향상)
  var BATCH = 8;
  for (var b = 0; b < needTrans.length; b += BATCH) {
    var batch = needTrans.slice(b, b + BATCH);
    var titles = batch.map(function(item) { return item.title; });

    // 진행률 표시 (P5 수정: 분모·분자 명확 + 예상 시간)
    var done = b + batch.length;
    var pct = Math.round(done / total * 100);
    if (statusEl) statusEl.textContent = '번역 중 ' + Math.min(done, total) + '/' + total + '건 (' + pct + '%)';

    try {
      var koTitles = await _gtBatchTranslate(titles);
      for (var i = 0; i < batch.length; i++) {
        var item = batch[i];
        var koTitle = koTitles[i];
        var tickers = extractTickers(item).map(function(t) { return '$' + t; });
        var koDesc = '';
        if (koTitle) {
          translated++;
          // 설명도 배치에 포함하지 않고 제목만 — 속도 우선
        } else {
          failed++;
          failedItems.push(item);
        }
        var localInsight = _aioBuildNewsLocalKoreanInsight(item, koTitle || item.title);
        _tcPut(item.title, {
          ko_title: koTitle || item.title,
          ko_desc: item.desc || '',
          ko_summary: localInsight.ko_summary,
          ko_explain: localInsight.ko_explain,
          ko_impact: localInsight.ko_impact,
          ko_action: localInsight.ko_action,
          ko_rewrite: localInsight.ko_rewrite,
          ko_section: localInsight.ko_section,
          ko_market: localInsight.ko_market,
          tickers: tickers.length ? tickers : localInsight.tickers,
          _failed: !koTitle  // P2 수정: 번역 실패 플래그
        });
      }
    } catch(e) {
      if (typeof window._aioSetLastAiError === 'function') window._aioSetLastAiError(e, { source: 'translation' });
      // 배치 전체 실패 → 원문 유지
      for (var fi = 0; fi < batch.length; fi++) {
        var fItem = batch[fi];
        var fTickers = extractTickers(fItem).map(function(t) { return '$' + t; });
        var fLocal = _aioBuildNewsLocalKoreanInsight(fItem, fItem.title);
        _tcPut(fItem.title, {
          ko_title: fItem.title, ko_desc: fItem.desc || fLocal.ko_desc || '', ko_summary: fLocal.ko_summary,
          ko_explain: fLocal.ko_explain,
          ko_impact: fLocal.ko_impact,
          ko_action: fLocal.ko_action,
          ko_rewrite: fLocal.ko_rewrite,
          ko_section: fLocal.ko_section,
          ko_market: fLocal.ko_market,
          tickers: fTickers.length ? fTickers : fLocal.tickers, _failed: true
        });
        failed++;
        failedItems.push(fItem);
      }
    }

    // 배치 간 800ms 대기 — rate limit 안전 확보
    if (b + BATCH < needTrans.length) await new Promise(function(r) { setTimeout(r, 800); });
    // 매 배치마다 중간 렌더링
    _aioNotifyNewsSurfaceInvalidated('news-translation-batch');
    renderHomeFeed(newsCache);
  }

  // v30.12: 실패 항목 2차 재시도 (3초 후, 개별 번역, 상위 16건)
  if (failedItems.length > 0) {
    if (statusEl) statusEl.textContent = ' ' + failedItems.length + '건 재시도 중...';
    await new Promise(function(r) { setTimeout(r, 3000); });
    var retryBatch = failedItems.slice(0, 16);
    var retryTitles = retryBatch.map(function(item) { return item.title; });
    try {
      // 재시도도 배치로 (8건씩 × 2회)
      for (var rb = 0; rb < retryTitles.length; rb += BATCH) {
        var rSlice = retryBatch.slice(rb, rb + BATCH);
        var rTitles = rSlice.map(function(item) { return item.title; });
        var rResults = await _gtBatchTranslate(rTitles);
        for (var ri = 0; ri < rSlice.length; ri++) {
          if (rResults[ri]) {
            var rItem = rSlice[ri];
            var rTickers = extractTickers(rItem).map(function(t) { return '$' + t; });
            var rLocal = _aioBuildNewsLocalKoreanInsight(rItem, rResults[ri]);
            _tcPut(rItem.title, {
              ko_title: rResults[ri], ko_desc: rItem.desc || rLocal.ko_desc || '', ko_summary: rLocal.ko_summary,
              ko_explain: rLocal.ko_explain,
              ko_impact: rLocal.ko_impact,
              ko_action: rLocal.ko_action,
              ko_rewrite: rLocal.ko_rewrite,
              ko_section: rLocal.ko_section,
              ko_market: rLocal.ko_market,
              tickers: rTickers.length ? rTickers : rLocal.tickers, _failed: false
            });
            translated++;
            failed--;
          }
        }
        if (rb + BATCH < retryTitles.length) await new Promise(function(r) { setTimeout(r, 1000); });
      }
    } catch(e) {}
  }

  // P2 수정: 실패 건수 명확 표시
  var statusMsg = '✓ ' + translated + '건 번역 완료 (무료)';
  if (failed > 0) statusMsg += ' · <span style="color:#f87171;">' + failed + '건 번역 실패</span>';
  statusMsg += ' · ';
  if (statusEl) statusEl.innerHTML = statusMsg + (failed > 0 ? ' · 네트워크를 확인한 뒤 다시 시도하세요. ' : '') + '<span style="cursor:pointer;text-decoration:underline;color:#fbbf24;" data-action="openApiKeyConfig">Claude 키 입력 시 AI 해석 추가</span>';
  if (typeof window._aioSetLastAiError === 'function') window._aioSetLastAiError(failed > 0 ? { status: 503, message: 'translation partial failure' } : { status: 200, message: 'success' }, { source: 'translation' });
  // P4 수정: 번역 완료 후 캐시 저장
  _tcSaveToStorage();
  _aioNotifyNewsSurfaceInvalidated('news-translation-complete');
  renderHomeFeed(newsCache);
  renderBriefingFeed(newsCache);
}

/* ── v27.2: 뉴스 fetch 후 자동 번역 + 해석 + 티커 추출 ────────── */
async function autoTranslateNews(items) {
  if (_aioBootPhase.translationReady === false) {
    _aioQueueDeferredNewsTranslation(items);
    return;
  }
  const apiKey = getApiKey();
  // v50.53 2C: 서버 키 모드(CF Worker) 지원 — 개인 키 없어도 Worker 경유. 둘 다 없으면 무료 번역.
  const _ct = (typeof _aioClaudeTarget === 'function') ? _aioClaudeTarget(apiKey) : { url: 'https://api.anthropic.com/v1/messages', serverKey: false };
  if (!apiKey && !_ct.serverKey) {
    console.log('[AIO v29] Claude API 키 미설정 → Google Translate 무료 번역 실행');
    await freeTranslateNews(items);
    return;
  }
  if (_translationInProgress) return;
  _translationInProgress = true;

  const statusEl = document.getElementById('translate-status');
  if (statusEl) statusEl.textContent = '번역·해석 중...';

  // 번역이 필요한 영어 뉴스만 필터 (이미 번역된 건 제외)
  const needTranslation = items.filter(i =>
    i.title &&
    !_translationCache.has(_tcKey(i.title)) &&
    !isKoreanText(i.title)
  );
  // 이미 한국어인 뉴스도 해석/티커 없으면 로컬 enrichment
  items.filter(i => i.title && isKoreanText(i.title) && !_translationCache.has(_tcKey(i.title))).forEach(i => {
    const tickers = extractTickers(i).map(t => '$' + t);
    const local = _aioBuildNewsLocalKoreanInsight(i, i.title);
    _tcPut(i.title, {
      ko_title: i.title,
      ko_desc: i.desc || local.ko_desc || '',
      ko_summary: local.ko_summary,
      ko_explain: local.ko_explain,
      ko_impact: local.ko_impact,
      ko_action: local.ko_action,
      ko_rewrite: local.ko_rewrite,
      ko_section: local.ko_section,
      ko_market: local.ko_market,
      tickers: tickers.length ? tickers : local.tickers
    });
  });

  if (needTranslation.length === 0) {
    _translationInProgress = false;
    if (statusEl) statusEl.textContent = `✓ ${_translationCache.size}건 처리됨`;
    _aioNotifyNewsSurfaceInvalidated('news-translation-retry');
    renderHomeFeed(newsCache);
    renderBriefingFeed(newsCache);
    if (typeof _aioRenderActivePageNewsStrip === 'function') _aioRenderActivePageNewsStrip();
    if (typeof _aioRenderBriefingDigest === 'function') _aioRenderBriefingDigest();
    return;
  }

  console.log(`[AIO v27.2] 번역+해석 시작: ${needTranslation.length}건 영어 뉴스`);

  // 6개씩 배치 (해석 추가로 토큰 증가하여 배치 축소)
  const BATCH = 6;
  let translated = 0;
  for (let i = 0; i < Math.min(needTranslation.length, 60); i += BATCH) {
    const batch = needTranslation.slice(i, i + BATCH);
    const prompt = batch.map((item, idx) => {
      const safeItem = (window.AIO && typeof window.AIO.sanitizeAIUntrustedText === 'function')
        ? window.AIO.sanitizeAIUntrustedText((item.title || '') + '\n' + (item.desc || ''), { maxChars: 600 })
        : { text: (item.title || '') + '\n' + (item.desc || '') };
      const safeParts = String(safeItem.text || '').split('\n');
      const title = safeParts.shift() || '';
      const desc = safeParts.join(' ').slice(0, 200);
      return `[${idx+1}] Title: ${title}${desc ? '\nDesc: ' + desc : ''}\nSource: ${(item.source || 'unknown').toString().slice(0, 80)}\nSecurityFlags: ${(safeItem.flags || []).join(',') || 'none'}`;
    }).join('\n\n');

    // 공통 공개 정책이 자동 번역 출력 형식을 차단했다면 같은 세션에서 매 배치마다
    // Claude 요청을 반복하지 않고 무료/로컬 번역 경로로 즉시 우회한다.
    if (window._aioTranslationPolicyBlockedUntil > Date.now()) {
      var _circuitBatch = batch.filter(orig => !_translationCache.has(_tcKey(orig.title)));
      if (_circuitBatch.length) { try { await freeTranslateNews(_circuitBatch); } catch(_) { _circuitBatch.forEach(localEnrichSingle); } }
      continue;
    }
    try {
      // v52.76/WP-AI1: translation uses the same request envelope and final
      // response pipeline as chat/retry. If the shared pipeline is absent,
      // fail closed into the existing local/free translation fallback.
      const _translationRequest = typeof _aioCreateAIRequestObject === 'function'
        ? _aioCreateAIRequestObject('auto-translation', { ctxId: 'news-translation', query: prompt })
        : null;
      if (!_translationRequest || typeof _aioRunAIResponsePipeline !== 'function') throw new Error('AI response pipeline unavailable');
      if (typeof _aioBeginAIRequestAttempt === 'function') _aioBeginAIRequestAttempt(_translationRequest, 'claude-haiku-4-5-20251001');
      const resp = await (typeof _aioFetchClaudeWithRetry === 'function' ? _aioFetchClaudeWithRetry : fetch)(_ct.url, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, _ct.serverKey ? { 'X-AIO-App-Token': (typeof _aioAppToken === 'function' ? _aioAppToken() : '') } : { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }),
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `다음 영어 금융/시장 뉴스를 한국어로 번역하고, 한국 투자자가 바로 읽을 수 있는 브리핑 문장으로 재작성하세요.

규칙:
1. title: 한국어 제목 (한국 경제 뉴스 헤드라인 스타일, 간결하게)
2. desc: 핵심 내용 1-2문장 한국어 요약. desc 없으면 제목에서 유추
3. summary: 투자자 관점 해석 1문장 (예: "반도체 업종 전반에 긍정적 시그널", "단기 변동성 확대 주의")
4. section: 아래 중 하나만 선택 — 미국 정치, 국제외교, 지정학, 중동 전쟁 및 지정학, 연준 및 미국 경제, AI 및 빅테크, 미국 주식 및 기업, 암호화폐, 원자재 및 에너지, 글로벌 경제 및 중앙은행, 투자의견 및 목표가, 반도체·AI 인프라, 시장 종합
5. rewrite: 원문 직역 금지. "누가 무엇을 밝혔다/보도했다 + 시장이 봐야 할 포인트" 형태의 한국어 브리핑 문장 1개
6. market: 투자자가 확인해야 할 시장 의미 1문장
7. tickers: 관련 주식 티커 배열 ($ 포함, 예: ["$NVDA","$TSLA"]). 관련 없으면 빈 배열
   - 직접 언급된 종목 + 영향받을 종목 포함
   - 섹터 ETF도 해당시 포함 (예: $XLK, $SMH, $XLE)

금융 전문용어 정확히 사용 (rate cut→금리 인하, earnings beat→실적 상회, rally→랠리, selloff→매도세)

JSON 배열로만 반환 (다른 텍스트 없이):
[{"idx":1,"title":"한국어 제목","desc":"한국어 요약","summary":"투자자 관점 해석","section":"AI 및 빅테크","rewrite":"엔비디아 관련 AI 인프라 수요가 다시 부각됐으며 반도체·전력 인프라 밸류체인 반응을 함께 확인해야 합니다.","market":"$NVDA와 $SMH의 가격·거래량 반응이 후속 확인 포인트입니다.","tickers":["$NVDA","$SMH"]}]

${prompt}`
          }]
        })
      }, _ct.serverKey);

      if (resp.ok) {
        const data = await resp.json();
        const text = data.content?.[0]?.text || '';
        const _translationResult = _aioRunAIResponsePipeline(text, {
          request: _translationRequest,
          entrypoint: 'auto-translation',
          ctxId: 'news-translation',
          stripChips: false
        });
        if (_translationResult.blocked) {
          window._aioTranslationPolicyBlockedUntil = Date.now() + 30 * 60 * 1000;
          throw new Error('AI translation blocked by public action policy; fallback circuit opened');
        }
        const jsonMatch = _translationResult.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const translations = JSON.parse(jsonMatch[0]);
            translations.forEach(t => {
              const orig = batch[t.idx - 1];
              if (orig && t.title) {
                // 로컬 티커 추출로 보강
                const localTickers = extractTickers(orig).map(tk => '$' + tk);
                const apiTickers = Array.isArray(t.tickers) ? t.tickers.filter(tk => typeof tk === 'string') : [];
                const mergedTickers = [...new Set([...apiTickers, ...localTickers])].slice(0, 6);
                const localInsight = _aioBuildNewsLocalKoreanInsight(orig, t.title);
                // v30.12: _tcPut으로 LRU 캐시 관리 통합
                _tcPut(orig.title, {
                  ko_title: t.title,
                  ko_desc: t.desc || localInsight.ko_desc || '',
                  ko_summary: t.summary || localInsight.ko_summary,
                  ko_explain: localInsight.ko_explain,
                  ko_impact: localInsight.ko_impact,
                  ko_action: localInsight.ko_action,
                  ko_rewrite: t.rewrite || localInsight.ko_rewrite,
                  ko_section: t.section || localInsight.ko_section,
                  ko_market: t.market || localInsight.ko_market,
                  tickers: mergedTickers.length ? mergedTickers : localInsight.tickers
                });
                translated++;
              }
            });
          } catch(e) { _aioLog('warn', 'translate', '번역 JSON 파싱 에러: ' + (e && e.message || e)); }
        }
      } else {
        const errText = await resp.text().catch(() => '');
        if (typeof window._aioSetLastAiError === 'function') window._aioSetLastAiError({ status: resp.status, message: errText.slice(0, 200) || 'translation API error' }, { source: 'translation' });
        _aioLog('warn', 'translate', '번역 API 응답 에러: ' + resp.status + ' ' + errText.slice(0, 200));
        // FABLE-LIVE-AUDIT-2026-07-07 C2/L0-2: Claude(서버키) 경로 실패 시 바로 localEnrichSingle로
        // 가면 원문이 영문일 때 헤드라인 없는 일반 분류 템플릿만 남는다(B5: CF Worker /anthropic
        // 미배포 상태에선 이게 상시 발생). 무료 Google Translate로 실제 한국어 제목을 먼저 시도하고,
        // 그마저 실패한 항목만 localEnrichSingle의 최종 폴백(내부에서 이미 처리)으로 남긴다.
        var _failedBatch = batch.filter(orig => !_translationCache.has(_tcKey(orig.title)));
        if (_failedBatch.length) { try { await freeTranslateNews(_failedBatch); } catch(_gtErr) { _failedBatch.forEach(orig => { if (!_translationCache.has(_tcKey(orig.title))) localEnrichSingle(orig); }); } }
      }
    } catch(e) {
      if (typeof window._aioSetLastAiError === 'function') window._aioSetLastAiError(e, { source: 'translation' });
      _aioLog('warn', 'translate', '번역 API 호출 에러: ' + (e && e.message || e));
      var _failedBatch2 = batch.filter(orig => !_translationCache.has(_tcKey(orig.title)));
      if (_failedBatch2.length) { try { await freeTranslateNews(_failedBatch2); } catch(_gtErr2) { _failedBatch2.forEach(orig => { if (!_translationCache.has(_tcKey(orig.title))) localEnrichSingle(orig); }); } }
    }

    // 배치 간 딜레이 + 중간 렌더링
    if (i + BATCH < needTranslation.length) {
      await new Promise(r => setTimeout(r, 600));
      if (statusEl) statusEl.textContent = `번역·해석 중... (${translated}/${needTranslation.length})`;
      _aioNotifyNewsSurfaceInvalidated('news-translation-progress');
      renderHomeFeed(newsCache);
      if (typeof _aioRenderActivePageNewsStrip === 'function') _aioRenderActivePageNewsStrip();
      if (typeof _aioRenderBriefingDigest === 'function') _aioRenderBriefingDigest();
    }
  }

  _translationInProgress = false;
  console.log(`[AIO v30.12] 번역+해석 완료: ${translated}건`);
  if (statusEl) statusEl.textContent = `✓ ${_translationCache.size}건 번역·해석 완료`;
  if (typeof window._aioSetLastAiError === 'function') window._aioSetLastAiError(translated < needTranslation.length ? { status: 503, message: 'translation partial failure' } : { status: 200, message: 'success' }, { source: 'translation' });

  // v30.12 P4: 번역 완료 후 캐시 저장
  _tcSaveToStorage();

  // 최종 렌더링 업데이트
  _aioNotifyNewsSurfaceInvalidated('news-translation-final');
  renderHomeFeed(newsCache);
  renderBriefingFeed(newsCache);
  if (typeof _aioRenderActivePageNewsStrip === 'function') _aioRenderActivePageNewsStrip();
  if (typeof _aioRenderBriefingDigest === 'function') _aioRenderBriefingDigest();
}

function localEnrichSingle(item) {
  if (!item || !item.title || _translationCache.has(_tcKey(item.title))) return;
  var tickers = extractTickers(item).map(function(t) { return '$' + t; });
  var local = _aioBuildNewsLocalKoreanInsight(item, item.title);
  _tcPut(item.title, {
    ko_title: item.title,
    ko_desc: item.desc || local.ko_desc || '',
    ko_summary: local.ko_summary,
    ko_explain: local.ko_explain,
    ko_impact: local.ko_impact,
    ko_action: local.ko_action,
    ko_rewrite: local.ko_rewrite,
    ko_section: local.ko_section,
    ko_market: local.ko_market,
    tickers: tickers.length ? tickers : local.tickers,
    _failed: !isKoreanText(item.title) // 영문 원문 유지 = 번역 실패
  });
}

/* ── v30.12: 뉴스 표시 텍스트 (한국어 우선 + 해석 + 티커 + 실패 표시) ─── */
function _aioBuildNewsVisibleFallbackTitle(item, cached) {
  item = item || {};
  cached = cached || {};
  var direct = item.ko_title || cached.ko_title || '';
  if (direct && isKoreanText(direct)) return direct;
  var topic = _aioNewsTopicKo(item.topic || (typeof classifyTopic === 'function' ? classifyTopic(item) : 'general'));
  var source = item.source || item.feed || '외신';
  var score = isFinite(Number(item.score)) ? ' · 중요도 ' + Number(item.score) : '';
  var tickers = [];
  try { tickers = typeof getDisplayTickers === 'function' ? getDisplayTickers(item) : []; } catch(_) {}
  var tickerText = Array.isArray(tickers) && tickers.length ? ' · ' + tickers.slice(0, 3).join(', ') : '';
  return topic + ' · ' + source + ' 기사' + score + tickerText;
}

function getDisplayTitle(item) {
  item = item || {};
  if (_translationCache.has(_tcKey(item.title))) {
    var cached = _translationCache.get(_tcKey(item.title));
    // P2: 번역 실패 시에도 화면 제목은 한국어 상태/분류 문장으로 유지
    if (cached._failed || !cached.ko_title || !isKoreanText(cached.ko_title)) return _aioBuildNewsVisibleFallbackTitle(item, cached);
    return cached.ko_title;
  }
  if (item.ko_title && isKoreanText(item.ko_title)) return item.ko_title;
  // v51.81: 번역 미완료 외신은 원문 제목 대신 한국어 분류 폴백을 표시
  if (item.title && !isKoreanText(item.title)) {
    return _aioBuildNewsVisibleFallbackTitle(item, null);
  }
  return item.title || '';
}
function getDisplayDesc(item) {
  item = item || {};
  if (_translationCache.has(_tcKey(item.title))) {
    return _aioGetNewsTranslation(item).ko_desc || '';
  }
  var tr = _aioGetNewsTranslation(item);
  if (tr.ko_summary) return tr.ko_summary;
  if (item.desc && !isKoreanText(item.desc)) return tr.ko_explain || tr.ko_market || '';
  return (item.desc || '').slice(0, 200);
}
/* v27.2: 투자자 관점 해석 반환 — v27.4: 폴백 추가 */
function getDisplaySummary(item) {
  const translated = _aioGetNewsTranslation(item);
  if (translated.ko_summary) return translated.ko_summary;
  // 폴백: 번역 완료 전이라도 빈 문자열 대신 원문 설명 축약 표시
  const desc = item.desc || item.description || '';
  if (desc.length > 0) {
    const clean = desc.replace(/<[^>]*>/g, '').trim();
    return clean.length > 120 ? clean.slice(0, 117) + '…' : clean;
  }
  return '';
}
window._aioBuildNewsLocalKoreanInsight = _aioBuildNewsLocalKoreanInsight;
window._aioGetNewsTranslation = _aioGetNewsTranslation;
window._aioBuildNewsKoreanRewriteBrief = _aioBuildNewsKoreanRewriteBrief;
window._aioRenderNewsKoreanRewriteBrief = _aioRenderNewsKoreanRewriteBrief;
window.AIO = window.AIO || {};
window.AIO.getNewsTranslationQualityAudit = function(items) {
  var src = items || window.newsCache || window._allNewsItems || [];
  var sample = Array.isArray(src) ? src.slice(0, 80) : [];
  var audit = { checked: sample.length, koTitle: 0, koSummary: 0, koExplain: 0, koImpact: 0, koRewrite: 0, failed: 0, generatedAt: new Date().toISOString() };
  sample.forEach(function(item) {
    var t = _aioGetNewsTranslation(item);
    if (t.ko_title && isKoreanText(t.ko_title)) audit.koTitle++;
    if (t.ko_summary) audit.koSummary++;
    if (t.ko_explain) audit.koExplain++;
    if (t.ko_impact) audit.koImpact++;
    if (t.ko_rewrite) audit.koRewrite++;
    if (t._failed) audit.failed++;
  });
  audit.ok = audit.checked === 0 || (audit.koSummary >= Math.min(10, audit.checked) && audit.koExplain >= Math.min(10, audit.checked));
  return audit;
};
/* v27.2: 캐시된 티커 ($ 포함) 반환 — v27.4: 빈 배열 캐시 충돌 수정 */
function getDisplayTickers(item) {
  // v27.4 근본 개편: API 결과 + 로컬 추출을 항상 합침 (풀리지 않는 구조)
  const merged = new Set();

  // 1) API 번역 캐시에서 가져온 티커
  if (_translationCache.has(_tcKey(item.title))) {
    const t = _translationCache.get(_tcKey(item.title)).tickers;
    if (Array.isArray(t)) t.forEach(tk => { if (tk) merged.add(tk); });
  }

  // 2) 로컬 추출 — 항상 실행 (캐시 유무와 무관)
  const local = extractTickers(item);
  local.forEach(s => {
    const tk = s.startsWith('$') ? s : '$' + s;
    merged.add(tk);
  });

  // 캐시 업데이트 (로컬 추출로 보강된 결과 반영)
  const result = [...merged].slice(0, 5);
  if (result.length > 0 && _translationCache.has(_tcKey(item.title))) {
    const cached = _translationCache.get(_tcKey(item.title));
    if (!cached.tickers || cached.tickers.length < result.length) {
      cached.tickers = result;
    }
  }
  return result;
}

/* ── v30.12: 뉴스에서 관련 티커 추출 (오탐 방지 강화) ─────────── */
// v30.12 P1: 일반 영단어와 충돌하는 짧은 티커 — 문맥 확인 필수
// v39.2: 영단어와 완전히 겹치는 티커 — $접두사 또는 (TICKER) 형태만 허용, 문맥 검증 불가
const _TICKER_WORD_OVERLAP = new Set([
  'ARM','ON','IT','A','F','V','C','U','X','D','E','K','T',
  'ALL','RUN','LOW','KEY','FAST','REAL','PLAY','FLEX','CAN',
  'GE','HD','DE','BE','HAS',
  // v48.20 (integrate): 신규 오탐 위험 티커 보강
  'KEYS','TEL','TER','APH','CLS','JBL','ON','DELL','IT','AI'  // Keysight/TE Connectivity/Teradyne/Amphenol/Celestica/Jabil — 일반 영단어와 겹침
]);
const _TICKER_AMBIGUOUS = new Set([
  'AI','META','COST',
  'SNOW','NET','PATH','APP','DASH','SHOP','SNAP','HOOD','SOFI','WOLF',
  'COIN','RIOT','HUT','GOLD','VALE','LINK','DOT','MATIC','UNI',
  'MS','BA','MP','PL','NU','NOW',
  // v46.6: 신규 모호 티커 추가
  'BEAM','OPEN','NEXT','SAIL','FIVE','PLUG','RUN','GRAB','BILL','SPOT',
  // v48.20 (integrate): 리서치 자료 언급 신규 모호 티커
  'FLEX','CELL','ARE','HOLD','RARE','REAL','TRUE','LIFE','BEST','SAFE',
]);

// v30.12: $접두사 또는 대문자 전체 단어 + 금융 문맥이면 티커로 인정
function _isTickerContextValid(ticker, text) {
  // $NVDA 형태는 무조건 티커
  if (text.includes('$' + ticker)) return true;
  // (NVDA) 형태는 무조건 티커
  if (text.includes('(' + ticker + ')')) return true;
  // 모호한 티커는 추가 문맥 확인
  if (!_TICKER_AMBIGUOUS.has(ticker)) return true;
  // 모호한 티커: 주변에 주가/시장 관련 단어가 있어야 인정
  var lower = text.toLowerCase();
  var tickerPos = text.indexOf(ticker);
  if (tickerPos < 0) return false;
  // 앞뒤 80자 범위에서 금융 문맥 확인
  var start = Math.max(0, tickerPos - 80);
  var end = Math.min(text.length, tickerPos + ticker.length + 80);
  var context = lower.slice(start, end);
  // v46.6: 금융 문맥 키워드 확장 (기존 23개 → 40개)
  var finWords = ['stock','share price','share','earnings','rally','surge','ipo','m&a','analyst',
    'quarterly','q1 ','q2 ','q3 ','q4 ','revenue','eps','dividend','buyback','market cap',
    // v46.6 추가: 애널리스트/밸류에이션/실적 관련
    'upgrade','downgrade','price target','valuation','pe ratio','p/e',
    'guidance','outlook','margin','revenue growth','beat','miss',
    'overweight','underweight','outperform','buy rating','sell rating',
    '주가','주식','매출','실적','급등','급락','목표가','배당','시가총액',
    '투자의견','상향','하향','매수','매도','비중확대'];
  for (var i = 0; i < finWords.length; i++) {
    if (context.includes(finWords[i])) return true;
  }
  return false;
}

// v39.2: RegExp 캐시 — extractTickers 성능 최적화 (800+ 티커 × 뉴스 80건)
// v49.0 P182: 무한 성장 방지 → _aioLRU 600건 캡
var _tickerRegexCache = (typeof window._aioLRU === 'function') ? window._aioLRU('tickerRegex', 600) : null;
function _getTickerRegex(ticker) {
  if (!_tickerRegexCache) {
    return new RegExp('\\b' + ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
  }
  var cached = _tickerRegexCache.get(ticker);
  if (cached === null || cached === undefined) {
    cached = new RegExp('\\b' + ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    _tickerRegexCache.set(ticker, cached);
  }
  return cached;
}

function extractTickers(item) {
  var text = (item.title || '') + ' ' + (item.desc || '');
  var found = new Set();

  // 1) $TICKER 패턴 우선 매칭 (가장 확실)
  var dollarMatches = text.match(/\$([A-Z]{1,5})\b/g);
  if (dollarMatches) {
    dollarMatches.forEach(function(m) {
      var t = m.slice(1);
      if (KNOWN_TICKERS.has(t) && found.size < 5) found.add(t);
    });
  }

  // 2) KNOWN_TICKERS 매칭 (문맥 필터 적용)
  if (typeof KNOWN_TICKERS !== 'undefined') {
    KNOWN_TICKERS.forEach(function(ticker) {
      if (found.has(ticker) || found.size >= 5) return;
      // 1~2자 티커(A, F, V, C, U 등)는 $접두사 없으면 건너뜀
      if (ticker.length <= 2 && !text.includes('$' + ticker)) return;
      // v39.2: 영단어와 완전히 겹치는 티커 — $접두사 또는 (TICKER) 형태만 허용
      if (_TICKER_WORD_OVERLAP.has(ticker)) {
        if (!text.includes('$' + ticker) && !text.includes('(' + ticker + ')')) return;
      }
      var re = _getTickerRegex(ticker);
      if (re.test(text) && _isTickerContextValid(ticker, text)) {
        found.add(ticker);
      }
    });
  }

  // 3) 한국어 기업명/키워드 → 티커 매핑
  if (typeof KR_TICKER_MAP !== 'undefined' && found.size < 5) {
    var lowerText = text.toLowerCase();
    for (var krName in KR_TICKER_MAP) {
      if (KR_TICKER_MAP.hasOwnProperty(krName) && lowerText.includes(krName.toLowerCase()) && found.size < 5) {
        found.add(KR_TICKER_MAP[krName]);
      }
    }
  }

  return Array.from(found);
}

/* ── v21: 절대 시간 포맷 (HH:MM) ──────────────────────────────── */
// ── v34.9: 뉴스 유형 탭 (전체/시장/기업) ──
var _newsTypeTab = 'all'; // 'all', 'market', 'company'

// 기업 뉴스 판별: 티커가 있고 기업 관련 토픽인 뉴스
// v46.9: healthcare/shipbuilding/space/quantum/crypto 추가 (TOPIC_KEYWORDS 전체 커버)
function isCompanyNews(item) {
  var companyTopics = ['equity','earnings','semi','analyst','defense','healthcare','shipbuilding','space','quantum','crypto'];
  // 시장 전용 토픽 (기업 뉴스에서 제외)
  var marketOnlyTopics = ['macro','geo','bond','fx'];
  var tickers = getDisplayTickers ? getDisplayTickers(item) : (item.tickers || []);
  // 1. 시장 전용 토픽이면 기업 뉴스 아님 (티커 있어도)
  if (marketOnlyTopics.indexOf(item.topic) !== -1) return false;
  // 2. 티커가 있으면서 기업 관련 토픽이면 기업 뉴스
  if (tickers.length > 0 && companyTopics.indexOf(item.topic) !== -1) return true;
  // 3. 티커가 있고 energy 토픽이면 기업 뉴스 (XOM, CVX 등 에너지 기업)
  if (tickers.length > 0 && item.topic === 'energy') return true;
  // 4. 티커가 있고 토픽이 general이면 기업 뉴스로 분류
  if (tickers.length > 0 && item.topic === 'general') return true;
  // 5. 실적(earnings)/애널리스트 토픽은 항상 기업 뉴스
  if (item.topic === 'earnings' || item.topic === 'analyst') return true;
  return false;
}

function setNewsTypeTab(type, el) {
  _newsTypeTab = type;
  document.querySelectorAll('#news-type-tabs .news-type-tab').forEach(function(btn) {
    btn.style.color = 'var(--text-muted)';
    btn.style.borderBottomColor = 'transparent';
    btn.classList.remove('active');
  });
  if (el) {
    el.style.color = 'var(--accent)';
    el.style.borderBottomColor = 'var(--accent)';
    el.classList.add('active');
  }
  // v42: 카테고리별 모드에서는 토픽/국가/정렬 필터 숨김 (자체 그룹핑 사용)
  var isCat = (type === 'category');
  var topicChips = document.getElementById('news-topic-chips');
  var countryChips = document.getElementById('news-country-chips');
  var sortRow = document.getElementById('sort-time-btn') ? document.getElementById('sort-time-btn').parentElement : null;
  if (topicChips) topicChips.style.display = isCat ? 'none' : '';
  if (countryChips) countryChips.style.display = isCat ? 'none' : '';
  if (sortRow) sortRow.style.display = isCat ? 'none' : '';
  if (newsCache.length > 0) _aioNotifyNewsSurfaceInvalidated('news-type-tab');
}

/* ── v42.0: 카테고리별 그룹 뷰 렌더링 ─────────────────────────── */
var _TOPIC_GROUP_ORDER = [
  { key:'macro',     label:'매크로·경제',       icon:'' },
  { key:'geo',       label:'국제 정치·지정학',  icon:'' },
  { key:'market-note',label:'시장 노트',         icon:'' },
  { key:'equity',    label:'주식·시장',         icon:'' },
  { key:'semi',      label:'반도체·AI',         icon:'' },
  { key:'ai-policy', label:'AI 정책·규제',       icon:'' },
  { key:'optical',   label:'광학·인터커넥트',    icon:'' },
  { key:'power',     label:'전력·그리드',        icon:'' },
  { key:'memory',    label:'메모리',             icon:'' },
  { key:'materials', label:'소재·부품',          icon:'' },
  { key:'earnings',  label:'실적·기업',         icon:'' },
  { key:'energy',    label:'원자재·에너지',     icon:'' },
  { key:'bond',      label:'채권·금리',         icon:'' },
  { key:'credit',    label:'크레딧·자금조달',   icon:'' },
  { key:'fx',        label:'외환·통화',         icon:'' },
  { key:'crypto',    label:'암호화폐',          icon:'' },
  { key:'defense',   label:'방산·우주',         icon:'' },
  { key:'healthcare',label:'헬스케어·바이오',   icon:'' },
  { key:'shipbuilding',label:'조선·해운',       icon:'' },
  { key:'quantum',   label:'양자컴퓨팅',        icon:'' },
  { key:'analyst',   label:'애널리스트',        icon:'' },
  { key:'space',     label:'우주·위성',         icon:'' },
  { key:'general',   label:'기타 뉴스',         icon:'' }
];

// v50.2: shared contract for the three user-facing news surfaces.
window.AIO = window.AIO || {};
var AIO_NEWS_SURFACE_CONTRACTS = {
  home: {
    surfaceId: 'home',
    role: 'core-market-judgment',
    newsCyclePolicy: 'kst-0800-completed-24h',
    anchor: '08:00 KST',
    windowHours: 24,
    maxItems: 3,
    minScoreCascade: [90, 70, 50],
    excludedTopics: ['analyst'],
    staleStaticPolicy: 'reference-only',
    sortMode: 'market-impact'
  },
  briefing: {
    surfaceId: 'briefing',
    role: 'kst-0800-24h-decision-briefing',
    newsCyclePolicy: 'kst-0800-completed-24h',
    anchor: '08:00 KST',
    windowHours: 24,
    maxItems: 40,
    minScore: 45,
    aiPolicy: 'verified-current-only',
    reviewPolicy: 'secondary-stale-unverified-to-review'
  },
  'market-news': {
    surfaceId: 'market-news',
    role: 'kst-0800-24h-exploration-and-filtering',
    newsCyclePolicy: 'kst-0800-completed-24h',
    anchor: '08:00 KST',
    windowHours: 24,
    maxItems: 150,
    minScore: 30,
    allowFilters: true,
    sortMode: 'ui'
  },
  // v50.41 선순환 연결 계층: 분석 페이지를 같은 뉴스캐시에 토픽 필터로 연결 (사일로 해소 — 단일 인텔 소스 → 다수 surface).
  //   topics = classifyTopic 실존 키(macro/geo/semi/earnings/energy)만 사용. role='analysis-page-topic-strip'.
  macro:       { surfaceId: 'macro',       role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 6, minScore: 35, topics: ['macro','geo','market-note','credit','ai-policy','power','energy'], sortMode: 'score' },
  fxbond:      { surfaceId: 'fxbond',      role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 6, minScore: 35, topics: ['macro','geo','market-note','credit','bond','fx','fxbond'],        sortMode: 'score' },
  technical:   { surfaceId: 'technical',   role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 6, minScore: 35, topics: ['semi','optical','power','memory','materials','market-note'], sortMode: 'score' },
  themes:      { surfaceId: 'themes',      role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 8, minScore: 35, topics: ['semi','optical','power','memory','materials','ai-policy','credit','energy','space','crypto','equity'], sortMode: 'score' },
  sentiment:   { surfaceId: 'sentiment',   role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 6, minScore: 35, topics: ['macro','geo','market-note','credit','crypto','equity','ai-policy'], sortMode: 'score' },
  signal:      { surfaceId: 'signal',      role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 6, minScore: 35, topics: ['macro','geo','market-note','credit','semi','optical','power','memory'], sortMode: 'score' },
  fundamental: { surfaceId: 'fundamental', role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 8, minScore: 35, topics: ['earnings','equity','analyst','semi','optical','power','memory','materials','ai-policy','credit'], sortMode: 'score' },
  breadth:     { surfaceId: 'breadth',     role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 6, minScore: 35, topics: ['semi','macro','market-note','credit','equity','crypto','memory'], sortMode: 'score' }
};
window.AIO_NEWS_SURFACE_CONTRACTS = AIO_NEWS_SURFACE_CONTRACTS;

window.AIO.getNewsSelectionAudit = function(items) {
  var sourceItems = Array.isArray(items) ? items : (typeof newsCache !== 'undefined' && Array.isArray(newsCache) ? newsCache : []);
  var audit = {
    generatedAt: new Date().toISOString(),
    checked: sourceItems.length,
    scoreBuckets: { gte90: 0, gte70: 0, gte50: 0, gte30: 0, lt30: 0 },
    topics: {},
    sources: {},
    tiers: {},
    verification: { verifiedCurrent: 0, current: 0, secondaryOnly: 0, unverified: 0, stale: 0 },
    homeEligible: 0,
    briefingEligible: 0,
    marketNewsEligible: 0,
    scoreReasons: {},
  };

  sourceItems.forEach(function(item) {
    var score = Number(item && item.score);
    if (!isFinite(score) && typeof scoreItem === 'function') {
      try { score = scoreItem(item); } catch (_) { score = 0; }
    }
    var topic = item && (item.topic || (typeof classifyTopic === 'function' ? classifyTopic(item) : 'general')) || 'general';
    var source = String(item && item.source || 'unknown');
    var tier = String(_aioNewsSourceTier(item));
    var status = (typeof _aioNewsVerificationStatus === 'function') ? _aioNewsVerificationStatus(item) : 'current';
    var reasons = Array.isArray(item && item._scoreReasons) ? item._scoreReasons : [];

    if (score >= 90) audit.scoreBuckets.gte90++;
    else if (score >= 70) audit.scoreBuckets.gte70++;
    else if (score >= 50) audit.scoreBuckets.gte50++;
    else if (score >= 30) audit.scoreBuckets.gte30++;
    else audit.scoreBuckets.lt30++;

    audit.topics[topic] = (audit.topics[topic] || 0) + 1;
    audit.sources[source] = (audit.sources[source] || 0) + 1;
    audit.tiers[tier] = (audit.tiers[tier] || 0) + 1;
    audit.verification[status] = (audit.verification[status] || 0) + 1;
    reasons.slice(0, 5).forEach(function(reason) {
      audit.scoreReasons[reason] = (audit.scoreReasons[reason] || 0) + 1;
    });
  });

  try { audit.homeEligible = buildNewsSurfaceModel('home', sourceItems, {}).items.length; } catch (_) {}
  try { audit.briefingEligible = buildNewsSurfaceModel('briefing', sourceItems, {}).items.length; } catch (_) {}
  try { audit.marketNewsEligible = buildNewsSurfaceModel('market-news', sourceItems, {}).items.length; } catch (_) {}
  return audit;
};

function _aioNewsPubMs(item) {
  var t = item && item.pubDate ? new Date(item.pubDate).getTime() : 0;
  return isNaN(t) ? 0 : t;
}

function _aioNewsSourceTier(item) {
  if (item && item.tier != null && isFinite(Number(item.tier))) return Number(item.tier);
  var src = String(item && item.source || '');
  if (/Reuters|Bloomberg|Associated Press|AP News|Financial Times|FT|Wall Street Journal|WSJ/i.test(src)) return 1;
  if (/CNBC|MarketWatch|Barron|Yahoo Finance|Investing|Seeking Alpha|Economist|NYT|Nikkei|Yonhap|Naver/i.test(src)) return 2;
  if (/^TG\s|Telegram/i.test(src) || item && (item._tgChannel || item.tgSlug)) return 4;
  return 3;
}

function _aioNewsTopicLabel(topic) {
  var row = _TOPIC_GROUP_ORDER.find(function(t) { return t.key === topic; });
  return row ? row.label : (topic || 'general');
}

function _aioNewsId(item) {
  var seed = String(item && (item.link || item.guid || item.title || '') || '') + '|' + String(item && item.source || '') + '|' + String(item && item.pubDate || '');
  var h = 0;
  for (var i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return 'news-' + Math.abs(h);
}

function _aioNewsDedupeKey(item) {
  var title = '';
  try { title = typeof getDisplayTitle === 'function' ? getDisplayTitle(item) : (item.title || ''); } catch(_) { title = item && item.title || ''; }
  return String(title || item && item.link || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9가-힣]+/g, '')
    .slice(0, 72);
}
// v52.16 P5h/P617: 크로스채널(동일 실화가 채널만 다르게, 예: Aether-JP/Insider-US) 중복이
// 위 title 첫 72자 prefix 매칭만으론 안 걸림(포맷 접두어 차이로 앞부분이 갈릴 수 있음) — 이미
// fetchAllNews()(위 12569행대)에서 검증된 "핵심단어 정렬-결합" 2차 키를 동일 패턴으로 재사용.
function _aioNewsWordBagKey(item) {
  var title = '';
  try { title = typeof getDisplayTitle === 'function' ? getDisplayTitle(item) : (item.title || ''); } catch(_) { title = item && item.title || ''; }
  var words = String(title || '').toLowerCase().replace(/[^a-z0-9가-힣\s]/g, '').split(/\s+/).filter(function(w) { return w.length > 2; });
  var shortKey = words.sort().join('').slice(0, 40);
  return shortKey.length > 15 ? shortKey : '';
}

function _aioNewsIsBlacklisted(item) {
  if (!item || item._blacklisted) return true;
  var text = '';
  try { text = ((item.title || '') + ' ' + (getDisplayTitle(item) || '') + ' ' + (item.desc || '')).toLowerCase(); }
  catch(_) { text = ((item.title || '') + ' ' + (item.desc || '')).toLowerCase(); }
  return (NEWS_BLACKLIST_KW || []).some(function(kw) { return text.indexOf(String(kw).toLowerCase()) >= 0; });
}

function _aioNewsVerificationStatus(item, ageHours, contract) {
  var tier = _aioNewsSourceTier(item);
  var stale = !isFinite(ageHours) || ageHours > (contract.windowHours || 48);
  var tg = !!(item && (item._tgChannel || item.tgSlug || /^TG\s/i.test(item.source || '')));
  var unverified = false;
  try { unverified = typeof isUnverifiedClaim === 'function' && isUnverifiedClaim(item); } catch(_) {}
  if (stale) return 'stale';
  if (unverified) return 'unverified';
  if (tg || tier >= 4) return 'secondary-only';
  if (tier <= 2) return 'verified-current';
  return 'current';
}

function _aioNewsCycleWindowForContract(contract, opts) {
  opts = opts || {};
  if (opts.windowStart != null && opts.windowEnd != null) {
    return { start: opts.windowStart, end: opts.windowEnd, anchorDate: opts.anchorDate || '' };
  }
  var meta = window._serverDataMeta || {};
  if (contract && contract.newsCyclePolicy === 'kst-0800-completed-24h' && meta.newsCycleStart && meta.newsCycleEnd) {
    var smStart = new Date(meta.newsCycleStart).getTime();
    var smEnd = new Date(meta.newsCycleEnd).getTime();
    var smAgeH = meta.generatedAt ? (Date.now() - new Date(meta.generatedAt).getTime()) / 3600000 : Infinity;
    var sharedCut = null;
    try { sharedCut = window.AIO && typeof window.AIO.getSharedMarketCut === 'function' ? window.AIO.getSharedMarketCut() : null; } catch(_) {}
    var serverCutFresh = sharedCut ? sharedCut.usable === true : smAgeH <= Number(meta.marketCycleFreshnessSlaHours || 12);
    if (isFinite(smStart) && isFinite(smEnd) && smEnd > smStart && serverCutFresh) {
      return { start: smStart, end: smEnd, anchorDate: meta.newsCycleLabel || '' };
    }
  }
  if (!contract || contract.newsCyclePolicy !== 'kst-0800-completed-24h' || typeof _getBriefingWindowKST !== 'function') return null;
  var bw = _getBriefingWindowKST();
  return { start: bw.start, end: bw.end, anchorDate: bw.anchorDate ? bw.anchorDate.toISOString().slice(0, 10) : '' };
}

function _aioNewsInclusionReason(row, surfaceId) {
  var topic = _aioNewsTopicLabel(row.topic);
  var tier = row.sourceTier ? ('Tier ' + row.sourceTier) : 'source';
  if (surfaceId === 'home') return 'Score ' + row.score + ' · ' + topic + ' · ' + tier;
  if (surfaceId === 'briefing') return '08:00 KST 24h · Score ' + row.score + ' · ' + row.verificationStatus;
  return 'Score ' + row.score + ' · ' + topic + ' · ' + row.verificationStatus;
}

function _aioNormalizeNewsItem(surfaceId, item, contract, nowMs, cycleWindow) {
  var pubMs = _aioNewsPubMs(item);
  var ageHours = pubMs ? Math.max(0, Math.round((nowMs - pubMs) / 3600000 * 10) / 10) : Infinity;
  var inNewsCycle = !!(cycleWindow && pubMs && pubMs >= cycleWindow.start && pubMs < cycleWindow.end);
  var itemCycleStart = item && item.newsCycleStart ? new Date(item.newsCycleStart).getTime() : 0;
  var itemCycleEnd = item && item.newsCycleEnd ? new Date(item.newsCycleEnd).getTime() : 0;
  var serverCycleTrusted = !!(item && item._serverBackstop && item.newsCyclePolicy === contract.newsCyclePolicy && isFinite(itemCycleStart) && isFinite(itemCycleEnd) && itemCycleEnd > itemCycleStart);
  if (!inNewsCycle && serverCycleTrusted && pubMs && pubMs >= itemCycleStart && pubMs < itemCycleEnd) inNewsCycle = true;
  var statusAgeHours = inNewsCycle && contract.newsCyclePolicy === 'kst-0800-completed-24h' ? Math.min(ageHours, contract.windowHours || 24) : ageHours;
  var tickers = [];
  try { tickers = typeof getDisplayTickers === 'function' ? getDisplayTickers(item) : (item.tickers || []); } catch(_) { tickers = item && item.tickers || []; }
  var row = Object.assign({}, item || {});
  row.newsId = row.newsId || _aioNewsId(item);
  row.title = row.title || '';
  row.source = row.source || '';
  row.pubDate = row.pubDate || null;
  row.ageHours = ageHours;
  row.newsCyclePolicy = row.newsCyclePolicy || contract.newsCyclePolicy || null;
  if (cycleWindow && contract.newsCyclePolicy === 'kst-0800-completed-24h') {
    row.newsCycleStart = row.newsCycleStart || new Date(cycleWindow.start).toISOString();
    row.newsCycleEnd = row.newsCycleEnd || new Date(cycleWindow.end).toISOString();
    row.inNewsCycle = inNewsCycle;
  }
  row.serverCycleTrusted = serverCycleTrusted;
  row.marketCutStatus = (window.AIO && typeof window.AIO.getSharedMarketCut === 'function')
    ? (window.AIO.getSharedMarketCut().status || 'unknown') : 'unknown';
  row.score = Number(row.score || 0);
  row.topic = row.topic || 'general';
  row.tickers = Array.isArray(tickers) ? tickers : [];
  row.sourceTier = _aioNewsSourceTier(row);
  row.verificationStatus = _aioNewsVerificationStatus(row, statusAgeHours, contract);
  row.staleStatus = row.verificationStatus === 'stale' ? 'stale' : 'current-window';
  row.sourcePolicy = surfaceId === 'briefing' ? contract.aiPolicy : 'surface-contract';
  row.inclusionReason = _aioNewsInclusionReason(row, surfaceId);
  row.eligibleForAi = row.verificationStatus === 'verified-current' || (row.verificationStatus === 'current' && row.sourceTier <= 2);
  return row;
}

function _aioApplyNewsFilterOptions(rows, opts) {
  opts = opts || {};
  var filtered = rows;
  var cf = String(opts.countryFilter || (typeof currentCountryFilter !== 'undefined' ? currentCountryFilter : 'all') || 'all').toLowerCase();
  if (cf && cf !== 'all') {
    if (cf === 'asia') {
      var ASIA_COUNTRIES = ['jp','cn','hk','tw','sg','in','qa'];
      filtered = filtered.filter(function(i) { return ASIA_COUNTRIES.indexOf(String(i.country || '').toLowerCase()) !== -1; });
    } else if (cf === 'eu') {
      filtered = filtered.filter(function(i) { return ['eu','uk'].indexOf(String(i.country || '').toLowerCase()) !== -1; });
    } else if (cf === 'tg') {
      filtered = filtered.filter(function(i) { return i._tgChannel === true || /^TG\s/i.test(i.source || '') || !!i.tgSlug; });
    } else {
      filtered = filtered.filter(function(i) { return String(i.country || '').toLowerCase() === cf; });
    }
  }
  var tf = opts.topicFilter || (typeof currentTopicFilter !== 'undefined' ? currentTopicFilter : 'all');
  if (tf && tf !== 'all') filtered = filtered.filter(function(i) { return i.topic === tf || (i.topics && i.topics.indexOf(tf) >= 0); });
  var tab = opts.typeTab || (typeof _newsTypeTab !== 'undefined' ? _newsTypeTab : 'all');
  if (tab === 'company') filtered = filtered.filter(function(i) { return isCompanyNews(i); });
  else if (tab === 'market') filtered = filtered.filter(function(i) { return !isCompanyNews(i); });
  return filtered;
}

function _aioNewsEmptyReason(surfaceId, stats) {
  if (!stats.inputCount) return 'no-input-news';
  if (!stats.withinWindowCount) return 'all-news-outside-time-window';
  if (!stats.afterScoreCount) return 'below-score-threshold-or-policy-excluded';
  if (surfaceId === 'market-news') return 'filters-removed-all-eligible-news';
  return 'no-verified-current-news-for-surface-policy';
}

window.AIO.buildNewsSurfaceModel = function(surfaceId, items, opts) {
  opts = opts || {};
  var contract = AIO_NEWS_SURFACE_CONTRACTS[surfaceId];
  if (!contract) throw new Error('Unknown news surface: ' + surfaceId);
  var nowMs = Number(opts.nowMs || Date.now());
  var cycleWindow = _aioNewsCycleWindowForContract(contract, opts);
  var input = Array.isArray(items) ? items : [];
  var normalized = input.filter(function(i) { return !_aioNewsIsBlacklisted(i); })
    .map(function(i) { return _aioNormalizeNewsItem(surfaceId, i, contract, nowMs, cycleWindow); });
  var windowRows = normalized.filter(function(row) {
    if (cycleWindow) {
      var t = _aioNewsPubMs(row);
      return row.inNewsCycle || (t >= cycleWindow.start && t < cycleWindow.end);
    }
    return row.ageHours <= (contract.windowHours || 48);
  });
  if (surfaceId === 'home') windowRows = windowRows.filter(function(i) { return contract.excludedTopics.indexOf(i.topic) === -1; });
  if (surfaceId === 'market-news') windowRows = _aioApplyNewsFilterOptions(windowRows, opts);
  // v50.41 선순환: 분석 페이지 토픽 필터 (contract.topics) — 같은 캐시에서 페이지별 관련 토픽만
  if (contract.topics && contract.topics.length) windowRows = windowRows.filter(function(i) { return contract.topics.indexOf(i.topic) >= 0; });

  var scored = windowRows;
  if (contract.minScoreCascade) {
    scored = [];
    contract.minScoreCascade.some(function(th) {
      scored = windowRows.filter(function(i) { return i.score >= th; });
      return scored.length > 0;
    });
  } else {
    scored = windowRows.filter(function(i) { return i.score >= (contract.minScore || 0); });
  }

  var duplicateRemoved = 0;
  var seen = {};
  var seenWordBag = {};
  var deduped = [];
  scored.forEach(function(row) {
    var key = _aioNewsDedupeKey(row) || row.newsId;
    var wbKey = _aioNewsWordBagKey(row);
    if (seen[key] || (wbKey && seenWordBag[wbKey])) { duplicateRemoved++; return; }
    seen[key] = true;
    if (wbKey) seenWordBag[wbKey] = true;
    deduped.push(row);
  });

  if (surfaceId === 'home') {
    deduped.forEach(function(i) {
      i._surfaceScore = i.score + (['macro','geo','bond','fx','energy'].indexOf(i.topic) >= 0 ? 20 : 0) + (i.sourceTier <= 2 ? 8 : 0);
      i.inclusionReason = _aioNewsInclusionReason(i, surfaceId);
    });
    deduped.sort(function(a, b) { return (b._surfaceScore || 0) - (a._surfaceScore || 0); });
  } else if (surfaceId === 'market-news' && (opts.sortMode || _newsSortMode) === 'time') {
    deduped.sort(function(a, b) {
      var ta = _aioNewsPubMs(a), tb = _aioNewsPubMs(b);
      var bucketA = Math.floor(ta / 1800000), bucketB = Math.floor(tb / 1800000);
      if (bucketA !== bucketB) return bucketB - bucketA;
      return (b.score || 0) - (a.score || 0);
    });
  } else {
    deduped.sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
  }

  var visible = deduped.slice(0, contract.maxItems || deduped.length);
  var reviewItems = surfaceId === 'briefing' ? deduped.filter(function(i) { return !i.eligibleForAi; }) : [];
  var aiItems = surfaceId === 'briefing' ? visible.filter(function(i) { return i.eligibleForAi; }) : visible;
  var latestPubMs = visible.reduce(function(max, i) { return Math.max(max, _aioNewsPubMs(i)); }, 0);
  var sourceSet = {};
  visible.forEach(function(i) { sourceSet[i.source || 'unknown'] = true; });
  var stats = {
    inputCount: input.length,
    normalizedCount: normalized.length,
    withinWindowCount: windowRows.length,
    afterScoreCount: scored.length,
    visibleCount: visible.length,
    duplicateRemoved: duplicateRemoved
  };
  var model = {
    surfaceId: surfaceId,
    contract: contract,
    items: visible,
    eligibleItems: deduped,
    aiItems: aiItems,
    reviewItems: reviewItems.slice(0, 12),
    visibleCount: visible.length,
    eligibleCount: deduped.length,
    staleCount: normalized.filter(function(i) { return i.staleStatus === 'stale'; }).length,
    unverifiedCount: visible.filter(function(i) { return i.verificationStatus === 'unverified' || i.verificationStatus === 'secondary-only'; }).length,
    duplicateRemoved: duplicateRemoved,
    sourceCount: Object.keys(sourceSet).length,
    lastFetch: window.lastNewsFetchAt || window._lastNewsFetchAt || lastFetchTime || null,
    latestPubDate: latestPubMs ? new Date(latestPubMs).toISOString() : null,
    newsCycle: cycleWindow ? { start: new Date(cycleWindow.start).toISOString(), end: new Date(cycleWindow.end).toISOString(), anchorDate: cycleWindow.anchorDate || '' } : null,
    cacheKey: surfaceId + '|' + (cycleWindow && cycleWindow.anchorDate || opts.anchorDate || '') + '|' + visible.map(function(i) { return i.newsId; }).join(',') + '|' + (latestPubMs || 0),
    emptyReason: visible.length ? null : _aioNewsEmptyReason(surfaceId, stats),
    stats: stats,
    generatedAt: new Date(nowMs).toISOString()
  };
  window._aioNewsSurfaceModels = window._aioNewsSurfaceModels || {};
  window._aioNewsSurfaceModels[surfaceId] = model;
  return model;
};

window.AIO.getNewsSurfaceAudit = function(opts) {
  opts = opts || {};
  var rows = {};
  // v50.41: primary 뉴스 surface(home/briefing/market-news)만 — 분석 페이지 topic-strip(role 'analysis-page-*')은 getConnectiveLayerAudit가 별도 담당(의미 분리, deployment gate 과부하 방지).
  var surfaces = Object.keys(AIO_NEWS_SURFACE_CONTRACTS).filter(function(id) { return String((AIO_NEWS_SURFACE_CONTRACTS[id] || {}).role || '').indexOf('analysis-page') < 0; });
  var issues = [];
  surfaces.forEach(function(id) {
    var model = window._aioNewsSurfaceModels && window._aioNewsSurfaceModels[id];
    if (!model || opts.rebuild) {
      var buildOpts = {};
      if (id === 'market-news') buildOpts = { countryFilter:'all', topicFilter:'all', typeTab:'all', sortMode:'score' };
      if (id === 'briefing' && typeof _getBriefingWindowKST === 'function') {
        var bw = _getBriefingWindowKST();
        buildOpts.windowStart = bw.start; buildOpts.windowEnd = bw.end; buildOpts.anchorDate = bw.anchorDate.toISOString().slice(0, 10);
      }
      model = window.AIO.buildNewsSurfaceModel(id, newsCache || [], buildOpts);
    }
    rows[id] = {
      visibleCount: model.visibleCount,
      eligibleCount: model.eligibleCount,
      staleCount: model.staleCount,
      unverifiedCount: model.unverifiedCount,
      duplicateRemoved: model.duplicateRemoved,
      sourceCount: model.sourceCount,
      lastFetch: model.lastFetch,
      emptyReason: model.emptyReason,
      latestPubDate: model.latestPubDate,
      status: model.visibleCount ? 'ok' : 'warn'
    };
    if (!model.visibleCount) issues.push(id + ':' + model.emptyReason);
  });
  return {
    status: issues.length ? 'warn' : 'ok',
    surfaceCount: surfaces.length,
    issues: issues,
    surfaces: rows,
    generatedAt: new Date().toISOString()
  };
};

window._aioNewsLoadMore = function() {
  window._aioNewsVisibleLimit = (window._aioNewsVisibleLimit || 12) + 12;
  _aioNotifyNewsSurfaceInvalidated('news-load-more');
};

/* ── renderHomeFeed(): 홈 "오늘의 시장" 하단에 핵심 뉴스 불릿 (v39.0) ── */
// Current news comes only from server/runtime producers. No embedded event digest.
var HOME_WEEKLY_NEWS = [];
window.HOME_WEEKLY_NEWS = HOME_WEEKLY_NEWS;

function _aioHomeNewsDateMs(n) {
  if (!n || !n.date) return null;
  var d = new Date(String(n.date) + 'T23:59:59+09:00');
  var t = d.getTime();
  return isNaN(t) ? null : t;
}

function _aioGetCurrentHomeWeeklyNews(nowMs) {
  var now = Number(nowMs || Date.now());
  var maxAgeMs = 72 * 60 * 60 * 1000;
  var src = window.HOME_WEEKLY_NEWS || HOME_WEEKLY_NEWS || [];
  return src.filter(function(n) {
    var t = _aioHomeNewsDateMs(n);
    if (!t) return false;
    return t >= now - maxAgeMs;
  });
}
window._aioGetCurrentHomeWeeklyNews = _aioGetCurrentHomeWeeklyNews;

function renderHomeFeed(items) {
  const container = document.getElementById('home-news-highlights');
  if (!container) return;
  if (window.AIO && typeof window.AIO.buildNewsSurfaceModel === 'function') {
    var homeModelV502 = window.AIO.buildNewsSurfaceModel('home', items || [], {});
    if (!homeModelV502.items.length) {
      var lastFetchText = homeModelV502.lastFetch ? new Date(homeModelV502.lastFetch).toLocaleString('ko-KR') : 'unknown';
      container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);line-height:1.55;padding:4px 0;">' +
        '<strong style="color:var(--text-secondary);">현재 검증 뉴스 없음</strong><br>' +
        '<span style="font-family:var(--font-mono);font-size:10px;">reason=' + escHtml(homeModelV502.emptyReason || 'none') + ' · lastFetch=' + escHtml(lastFetchText) + '</span><br>' +
        '<span style="font-size:10px;">내장 뉴스 폴백 없이 다음 검증 피드를 기다립니다.</span>' +
        '</div>';
      return;
    }
    container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);font-weight:700;letter-spacing:0.05em;margin-bottom:4px;">핵심 뉴스</div>' +
      homeModelV502.items.map(function(item) {
        var sent = getSentimentFromText(item.title + ' ' + (item.desc || ''));
        var sentIcon = sent === 'bull' ? '<span class="sd sd-g"></span>' : sent === 'bear' ? '<span class="sd sd-r"></span>' : sent === 'warn' ? '<span class="sd sd-y"></span>' : '<span class="sd sd-w"></span>';
        var timeAgo = item.pubDate ? getTimeAgo(new Date(item.pubDate)) : '';
        var displayTitle = escHtml(getDisplayTitle(item));
        var displaySummary = escHtml(getDisplaySummary(item));
        var summaryLine = displaySummary ? '<div style="font-size:10px;color:var(--text-secondary);margin-top:1px;line-height:1.35;">' + displaySummary + '</div>' : '';
        var hMacroTopics = ['macro','geopolitics','policy','fed','rates','trade','geo','bond','fx'];
        var tickers = hMacroTopics.indexOf(item.topic) === -1 ? getDisplayTickers(item) : [];
        var tickerStr = tickers.length > 0
          ? tickers.slice(0,2).map(function(t) { var s = t.replace('$',''); return '<span data-action="_aioNewsTickerClick" data-arg="' + escHtml(s) + '" role="button" tabindex="0" style="font-size:11px;font-weight:800;color:#60a5fa;font-family:var(--font-mono);cursor:pointer;" title="' + escHtml(s) + ' 분석">' + escHtml(t.charAt(0) === '$' ? t : '$' + t) + '</span>'; }).join(' ') + ' '
          : '';
        return '<div class="aio-hover-news-item" data-open-url="' + escHtml(escUrl(item.link)) + '" style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;cursor:pointer;border-bottom:1px solid var(--surface-2);">' +
          '<span style="flex-shrink:0;font-size:10px;line-height:1.6;">' + sentIcon + '</span>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:11px;font-weight:600;color:var(--text-primary);line-height:1.4;">' + tickerStr + displayTitle + '</div>' +
            summaryLine +
            '<div style="font-size:10px;color:var(--text-muted);margin-top:1px;font-family:var(--font-mono);">' + escHtml(item.inclusionReason || '') + ' · ' + escHtml(item.source || '') + ' · ' + escHtml(timeAgo) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    return;
  }

  // v40.4: 정적 주간 큐레이션 우선 표시
  var currentWeeklyNews = _aioGetCurrentHomeWeeklyNews();
  if (currentWeeklyNews && currentWeeklyNews.length > 0) {
    const sentIcons = { bull: '<span class="sd sd-g"></span>', bear: '<span class="sd sd-r"></span>', warn: '<span class="sd sd-y"></span>', neutral: '<span class="sd sd-w"></span>' };
    container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);font-weight:700;letter-spacing:0.05em;margin-bottom:4px;">핵심 뉴스</div>' +
      currentWeeklyNews.map(function(n) {
        // v46.4: 필드 누락 방어
        if (!n) return '';
        n.title = n.title || ''; n.source = n.source || ''; n.date = n.date || ''; n.sentiment = n.sentiment || 'neutral';
        var icon = sentIcons[n.sentiment] || '<span class="sd sd-w"></span>';
        return '<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;border-bottom:1px solid var(--surface-2);">' +
          '<span style="flex-shrink:0;font-size:10px;line-height:1.6;">' + icon + '</span>' +
          '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:11px;font-weight:600;color:var(--text-primary);line-height:1.4;">' + escHtml(n.title) + '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">' + escHtml(n.source) + ' · ' + n.date + '</div>' +
          '</div></div>';
      }).join('');
    return;
  }
  // v51.30 P531: 정적 큐레이션이 만료돼 비었을 때도 동적 RSS 뉴스는 홈 계약 시간창 안에서만 표시.
  // (이전엔 정적이 만료되면 items가 있어도 안내문만 띄워 홈 핵심뉴스가 영구 공백처럼 보였음 = 사용자 보고 "브리핑/뉴스 부실"의 근본)
  if (!items || items.length === 0) {
    // 동적 뉴스도 없으면 안내문 (정적 큐레이션 존재 시에만 — 완전 초기엔 로딩 표시 유지)
    if (HOME_WEEKLY_NEWS && HOME_WEEKLY_NEWS.length > 0) {
      container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);line-height:1.55;">최근 30시간 핵심 뉴스 수집 중... 실시간 뉴스가 도착하면 자동 표시됩니다.</div>';
    }
    return;
  }

  // v51.30 P531: 홈 계약 시간창 이내 + score 90+ 진짜 시장 이동 이벤트만
  // v49.97 P462: 단계적 완화 — 90+ 가 0건이면 70+, 그래도 0이면 50+ 로 완화해 홈 핵심뉴스 영구공백 방지.
  //   (정적 큐레이션 만료 후 동적 뉴스가 90점 미만뿐이면 이전엔 빈 화면이었음 = "브리핑/뉴스 부실" 근본 2)
  let base = filterByKst0800NewsCycle(items).filter(i => !i._blacklisted && i.topic !== 'analyst');
  let filtered = base.filter(i => (i.score || 0) >= 90);
  if (filtered.length === 0) filtered = base.filter(i => (i.score || 0) >= 70);
  if (filtered.length === 0) filtered = base.filter(i => (i.score || 0) >= 50);

  // 중요도 가중: 매크로/지정학/정책 > 실적 > 기업 뉴스
  filtered.forEach(i => {
    i._homeBoost = (i.score || 0);
    // 시장 전체에 영향 주는 이벤트 최우선
    if (['geopolitics','policy','fed','rates'].includes(i.topic)) i._homeBoost += 30;
    else if (i.topic === 'macro') i._homeBoost += 25;
    else if (i.topic === 'earnings') i._homeBoost += 15;
    else if (i.topic === 'trade') i._homeBoost += 20;
    // 프리미엄 소스 부스트
    if (['Reuters','Bloomberg','WSJ','CNBC','FT Markets','NYT Business'].some(s => (i.source||'').includes(s))) i._homeBoost += 10;
  });
  filtered.sort((a, b) => (b._homeBoost || 0) - (a._homeBoost || 0));

  // 제목 유사도 기반 중복 제거 (같은 이벤트에 대한 다른 기사 방지)
  const seenKeys = new Set();
  filtered = filtered.filter(i => {
    const key = (getDisplayTitle(i) || i.title || '').slice(0, 30).toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
  filtered = filtered.slice(0, 3);

  // 미달 시 score 70+로 완화
  if (filtered.length < 2) {
    const existing = new Set(filtered.map(i => i.link));
    const backup = filterByKst0800NewsCycle(items)
      .filter(i => !existing.has(i.link) && !i._blacklisted && (i.score || 0) >= 70)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 3 - filtered.length);
    filtered = filtered.concat(backup);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">현재 핵심 뉴스가 없습니다.</div>';
    return;
  }

  // P554/R245: 홈 "핵심 뉴스"는 _homeBoost(지정학/매크로/Tier-1 우대)로 선택되지만, 번역은
  // newsCache 원본 순서 앞 6건만 즉시 처리하고 나머지는 data-news-idx 뷰포트 진입 시에만
  // 번역되는 lazy observer에 의존한다. 홈 카드 DOM에는 data-news-idx가 없어 그 observer
  // 대상이 아니므로, 정확히 "중요해서 부스트된" 뉴스일수록 [번역 대기]가 영구 고정되는
  // 구조적 문제가 있었다. 선택된 상위 뉴스가 아직 캐시에 없으면 즉시 우선 번역을 요청한다
  // (autoTranslateNews 완료 시 renderHomeFeed를 다시 호출하므로 별도 재렌더는 불필요).
  try {
    var _untranslated = filtered.filter(function(i) { return i.title && !_tcHas(i.title); });
    if (_untranslated.length && typeof autoTranslateNews === 'function' && !_translationInProgress) {
      autoTranslateNews(_untranslated).catch(function(){});
    }
  } catch(_) {}

  // v39.0c: 간결 불릿 — 한국어 제목, 기업 뉴스에만 티커, 클릭 시 원문
  container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);font-weight:700;letter-spacing:0.05em;margin-bottom:4px;">핵심 뉴스</div>' +
    filtered.map(item => {
    const sent = getSentimentFromText(item.title + ' ' + (item.desc || ''));
    const sentIcon = sent === 'bull' ? '<span class="sd sd-g"></span>' : sent === 'bear' ? '<span class="sd sd-r"></span>' : sent === 'warn' ? '<span class="sd sd-y"></span>' : '<span class="sd sd-w"></span>';
    const timeAgo = item.pubDate ? getTimeAgo(new Date(item.pubDate)) : '';
    const displayTitle = escHtml(getDisplayTitle(item));
    // v39.0e: 티커는 매크로/지정학/정책 뉴스에서 숨김
    const displaySummary = escHtml(getDisplaySummary(item));
    const summaryLine = displaySummary ? `<div style="font-size:10px;color:var(--text-secondary);margin-top:1px;line-height:1.35;">${displaySummary}</div>` : '';
    const _hMacroTopics = ['macro','geopolitics','policy','fed','rates','trade','bond','credit','fx','fxbond'];
    const tickers = !_hMacroTopics.includes(item.topic) ? getDisplayTickers(item) : [];
    // v48.55: 홈 피드 티커 클릭 → ticker 페이지 이동
    const tickerStr = tickers.length > 0
      ? tickers.slice(0,2).map(t => { const _s = t.replace('$',''); return `<span data-action="_aioNewsTickerClick" data-arg="${escHtml(_s)}" role="button" tabindex="0" style="font-size:11px;font-weight:800;color:#60a5fa;font-family:var(--font-mono);cursor:pointer;" title="${escHtml(_s)} 분석">${escHtml(t.startsWith('$') ? t : '$'+t)}</span>`; }).join(' ') + ' '
      : '';
    return `<div class="aio-hover-news-item" data-open-url="${escHtml(escUrl(item.link))}" style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;cursor:pointer;border-bottom:1px solid var(--surface-2);">
      <span style="flex-shrink:0;font-size:10px;line-height:1.6;">${sentIcon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:600;color:var(--text-primary);line-height:1.4;">${tickerStr}${displayTitle}</div>
        ${summaryLine}
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px;">${escHtml(item.source||'')} · ${timeAgo}</div>
      </div>
    </div>`;
  }).join('');
}

/* ── renderBriefingFeed(): 브리핑 뉴스 (24시간) ───────────── */
// v42.0: 브리핑 8AM KST 앵커 — 오전 8시 기준 24시간 윈도우
function _getBriefingWindowKST() {
  var nowMs = Date.now();
  var KST_OFFSET_MS_LOCAL = 9 * 3600000;
  var DAY_MS_LOCAL = 24 * 3600000;
  var kstNow = new Date(nowMs + KST_OFFSET_MS_LOCAL);
  var endMs = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 8, 0, 0, 0) - KST_OFFSET_MS_LOCAL;
  if (nowMs < endMs) endMs -= DAY_MS_LOCAL;
  var completedStart = endMs - DAY_MS_LOCAL;
  return {
    start: completedStart,
    end: endMs,
    nextRefresh: new Date(endMs + DAY_MS_LOCAL),
    anchorDate: new Date(completedStart),
    endAnchorDate: new Date(endMs),
    policy: 'kst-0800-completed-24h'
  };
}

// 브리핑 캐시 키: 앵커 날짜 기반
var _briefingCacheKey = null;
var _briefingCachedHtml = null;

function _buildBriefingDecisionSummary(items, totalCount, bw) {
  var ld = window._liveData || {};
  function live(sym, key) {
    var row = ld[sym] || {};
    if (row[key] == null) return null;
    var n = Number(row[key]);
    return isFinite(n) ? n : null;
  }
  function escLocal(v) {
    return typeof escHtml === 'function' ? escHtml(String(v == null ? '' : v)) : String(v == null ? '' : v).replace(/[&<>"']/g, function(c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }
  function pct(v) { return v == null ? '—' : (v >= 0 ? '+' : '') + Number(v).toFixed(1) + '%'; }
  var spyPct = live('SPY', 'pct');
  var vix = live('^VIX', 'price');
  var wti = live('CL=F', 'price');
  var wtiPct = live('CL=F', 'pct');
  var tnx = live('^TNX', 'price');
  var dxyPct = live('DX-Y.NYB', 'pct');
  var usdJpy = live('JPY=X', 'price');
  var nvdaPct = live('NVDA', 'pct');
  var snap = window.DATA_SNAPSHOT || {};
  // v52.34 P649: 브리핑 페이지 세 번째 F&G 소스 — 이전엔 존재하지 않는/미할당 필드를 읽어 항상 null이었다.
  // P642가 고친 상단 스트립/요약 텍스트와 동일하게 live-first로 정합.
  var fgMetric = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
  var fg = fgMetric && fgMetric.value != null ? Number(fgMetric.value) : null;
  var textBlob = (items || []).slice(0, 40).map(function(i) {
    return [i.title, i.desc, i.topic, i.source].join(' ');
  }).join(' ').toLowerCase();
  // v51.12 6-축 신호 감지
  var fedHits = (textBlob.match(/fomc|fed|warsh|dot plot|rate|yield|금리|점도표/g) || []).length;
  var iranHits = (textBlob.match(/iran|hormuz|oil|brent|wti|middle east|이란|호르무즈|유가|중동/g) || []).length;
  var macroHits = (textBlob.match(/macro|inflation|cpi|pce|dollar|fx|인플레|달러/g) || []).length;
  var bojHits = (textBlob.match(/boj|bank of japan|yen carry|엔화|일본은행|엔캐리|ueda|우에다/g) || []).length;
  var semiHits = (textBlob.match(/nvidia|nvda|hynix|하이닉스|tsmc|amd|semiconductor|반도체|hbm|엔비디아|ai infra|capex/g) || []).length;
  var krHits = (textBlob.match(/kospi|korea|외국인|기관|수급|원달러|달러원|한국|삼성전자|sk하이닉스/g) || []).length;
  // 6-축 톤 판단
  var marketTone = spyPct == null || vix == null ? '시장 축 산출 보류' : (spyPct > 0.6 && vix < 20 ? '위험선호 우위' : (spyPct < -0.6 || vix >= 22 ? '위험회피 경계' : '관망 혼합'));
  var fedTone = tnx == null ? '금리 축 산출 보류' : (tnx >= 4.4 || fedHits >= 2 ? '금리/점도표 경계' : '금리 부담 중립');
  var oilTone = wti == null || wtiPct == null ? '유가 축 산출 보류' : (wti < 75 && wtiPct <= 0.5 ? '유가 리스크 완화' : (wti >= 85 ? '유가 헤드라인 경계' : '유가 중립'));
  var bojTone = usdJpy == null ? '엔화 축 산출 보류' : (bojHits >= 2 ? '엔캐리 리스크 경계' : (usdJpy < 145 ? '엔화 강세 모니터' : '엔캐리 안정'));
  var semiTone = nvdaPct == null ? '반도체 축 산출 보류' : (semiHits >= 3 ? 'AI·반도체 촉매 활성' : (nvdaPct > 1.0 ? 'AI·반도체 강세' : 'AI·반도체 중립'));
  var krTone = krHits >= 2 ? '한국장 수급 주목' : '한국장 중립';
  // 6축 기반 오늘 행동
  var actions = [];
  if (fedTone.indexOf('경계') >= 0) actions.push('금리 민감주·레버리지 노출 확인 후 분할 진입');
  if (oilTone.indexOf('경계') >= 0) actions.push('에너지·중동 가격 반응 확인 필요');
  if (bojTone.indexOf('경계') >= 0) actions.push('엔화·정책·변동성의 동시 변화를 추가 확인');
  if (semiTone.indexOf('활성') >= 0 || semiTone.indexOf('강세') >= 0) actions.push('AI·반도체 모멘텀 유효 — 추세 추종');
  if (oilTone.indexOf('완화') >= 0 && !actions.length) actions.push('유가 안정은 인플레 부담 완화 — 꼬리위험은 유지');
  if (krTone.indexOf('주목') >= 0) actions.push('한국장 외인 수급 방향 확인');
  if (!actions.length) actions.push('추세가 확인된 업종 위주로 선별. 뉴스는 가격 반응이 동반될 때만 가중.');
  var action = actions.join(' · ');
  var fgText = fg != null ? ' · F&G ' + fg : '';
  var meta = '선별 뉴스 ' + totalCount + '건 · Fed ' + fedHits + ' · 지정학 ' + iranHits + ' · 매크로 ' + macroHits + ' · BOJ ' + bojHits + ' · 반도체 ' + semiHits + ' · 한국 ' + krHits;
  function tile(tone, color, sub) {
    return '<div style="background:rgba(15,23,42,0.42);border:1px solid var(--border);border-radius:4px;padding:9px;"><b style="color:' + color + ';">' + escLocal(tone) + '</b><div style="font-size:10px;color:var(--text-secondary);margin-top:4px;">' + escLocal(sub) + '</div></div>';
  }
  return '<div style="margin-bottom:12px;padding:12px;background:linear-gradient(135deg,rgba(0,212,255,0.08),rgba(168,85,247,0.04));border:1px solid rgba(0,212,255,0.20);border-radius:4px;">' +
    '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap;margin-bottom:9px;">' +
    '<div style="font-size:13px;font-weight:900;color:var(--text-primary);">시장 상황 요약 <span style="font-size:10px;font-weight:400;color:var(--text-muted);">(6-축)</span></div>' +
    '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">' + escLocal(meta) + '</div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">' +
    tile(marketTone, 'var(--data-cyan)', 'SPY ' + pct(spyPct) + ' · VIX ' + (vix == null ? '—' : Number(vix).toFixed(1)) + fgText) +
    tile(fedTone, 'var(--data-amber)', '10Y ' + (tnx == null ? '—' : Number(tnx).toFixed(2) + '%') + ' · DXY ' + pct(dxyPct)) +
    tile(oilTone, 'var(--data-green)', 'WTI ' + (wti == null ? '—' : '$' + Number(wti).toFixed(1)) + ' (' + pct(wtiPct) + ')') +
    tile(bojTone, 'var(--data-purple)', 'USD/JPY ' + (usdJpy == null ? '—' : Number(usdJpy).toFixed(1)) + ' · BOJ ' + bojHits + '건') +
    tile(semiTone, 'var(--data-blue)', 'NVDA ' + pct(nvdaPct) + ' · 뉴스 ' + semiHits + '건') +
    tile(krTone, 'var(--data-magenta)', 'KOSPI · 외인수급 뉴스 ' + krHits + '건') +
    '</div>' +
    '<div style="margin-top:9px;font-size:11px;color:var(--text-secondary);line-height:1.5;"><b style="color:var(--accent);">오늘 행동</b> ' + escLocal(action) + '</div>' +
    '</div>';
}
window._buildBriefingDecisionSummary = _buildBriefingDecisionSummary;

window.renderBriefingFeed = function(items) {
  // P770: primary briefing DOM belongs to src/ui/pages/news.js; this legacy call is input-only.
  var briefingDecisionHtml = null; // retained source contract for the legacy AI compatibility surface.
  if (typeof _aioNotifyNewsSurfaceInvalidated === "function") _aioNotifyNewsSurfaceInvalidated("briefing-feed-input");
  return { status: "delegated-to-native-briefing", count: Array.isArray(items) ? items.length : 0, briefingDecisionHtml: briefingDecisionHtml };
}

// escHtml defined globally at line ~8130

/* ── 유틸리티: 상대 시간 표시 ─────────────────────────────── */
function getTimeAgo(date) {
  if (!date || isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return diffMin + '분 전';
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH + '시간 전';
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return diffD + '일 전';
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

/* ── 뉴스→시그널 통합: 뉴스 감성 집계 ─────────────────────── */
// RM-03 (continued): single-implementation calls — scoring formulas live in
// src/domain/news/scoring.js (computeNewsSentimentScore/computeNewsRiskSignals), exposed via
// window.AIO_ARCH so these legacy wrappers and any native consumer share one model (R352/F-03).
function computeNewsSentimentScore(items) {
  var sourceItems = Array.isArray(items) ? items : newsCache;
  var _fn = window.AIO_ARCH && typeof window.AIO_ARCH.computeNewsSentimentScore === 'function' ? window.AIO_ARCH.computeNewsSentimentScore : null;
  if (_fn) return _fn({ items: sourceItems || [], now: Date.now() });
  // Fail-closed fallback for the (unexpected) case the ESM architecture runtime never mounted.
  return { score: 50, label: '뉴스 없음', bullCount: 0, bearCount: 0, total: 0, bullRatio: 0, bearRatio: 0 };
}

/* ── 뉴스→시그널 통합: 매크로 리스크 집계 ──────────────────── */
function computeNewsRiskSignals(items) {
  var sourceItems = Array.isArray(items) ? items : newsCache;
  var _fn = window.AIO_ARCH && typeof window.AIO_ARCH.computeNewsRiskSignals === 'function' ? window.AIO_ARCH.computeNewsRiskSignals : null;
  if (_fn) return _fn({ items: sourceItems || [], now: Date.now() });
  return [];
}

// ── 상태 ────────────────────────────────────────────────────────
let newsCache = [];
let lastFetchTime = 0;
let isFetching = false;
let _fetchStartTime = 0; // v29.3: isFetching 잠김 방지용 타임스탬프
let currentCountryFilter = 'all';
let currentTopicFilter = 'all';

window.AIO = window.AIO || {};
function _aioNotifyNewsSurfaceInvalidated(reason) {
  try {
    const target = typeof document !== 'undefined' ? document : window;
    target.dispatchEvent(new CustomEvent('aio:newsSurfaceInvalidated', { detail: { reason: reason || 'news-input-changed' } }));
  } catch (_) {}
}
window._aioNotifyNewsSurfaceInvalidated = _aioNotifyNewsSurfaceInvalidated;
window.AIO.getNewsSurfaceControls = function() {
  return {
    countryFilter: currentCountryFilter || 'all',
    topicFilter: currentTopicFilter || 'all',
    typeTab: typeof _newsTypeTab !== 'undefined' ? _newsTypeTab : 'all',
    sortMode: typeof _newsSortMode !== 'undefined' ? _newsSortMode : 'time'
  };
};
window.AIO.getTelegramPageCoverageAudit = function() {
  var digest = window.AIO_TELEGRAM_WEEKLY_DIGEST || {};
  var pageMap = digest.pageMap || {};
  var items = Array.isArray(digest.rawCurrent24hItems) ? digest.rawCurrent24hItems : [];
  var digestAgeHours = digest.asOf ? (Date.now() - new Date(digest.asOf).getTime()) / 3600000 : Infinity;
  var currentWindow = digest.current24hWindow || null;
  var required = Array.isArray(window.AIO_ALL_ROUTE_PAGE_IDS) && window.AIO_ALL_ROUTE_PAGE_IDS.length
    ? window.AIO_ALL_ROUTE_PAGE_IDS.slice()
    : ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','fundamental','themes','theme-detail','portfolio','ticker','market-news','options','screener','principles','masters','atlas','guide'];
  var routes = {};
  required.forEach(function(pageId) {
    var tags = Array.isArray(_TG_PAGE_TAGS[pageId]) ? _TG_PAGE_TAGS[pageId] : [];
    var mapped = Array.isArray(pageMap[pageId]) ? pageMap[pageId] : [];
    var matched = tags.length ? items.filter(function(it) {
      return it && Array.isArray(it.tags) && it.tags.some(function(t) { return tags.indexOf(t) >= 0; });
    }).length : 0;
    routes[pageId] = {
      mapped: Array.isArray(pageMap[pageId]),
      tagCount: tags.length,
      selectedItemCount: matched,
      consumer: pageId === 'guide' ? 'not-applicable-guide'
        : (['portfolio','ticker','screener'].indexOf(pageId) >= 0 ? 'ticker-memo-and-chat' : 'page-feed-and-chat')
    };
  });
  var missing = required.filter(function(pageId) { return !Array.isArray(pageMap[pageId]); });
  var narrativeCurrent = !!(digest.dynamicDigestLoaded && Array.isArray(digest.themes) && digest.themes.length && Object.keys(pageMap).length >= required.length);
  var sourceCycleFresh = isFinite(digestAgeHours) && digestAgeHours <= 12;
  var currentLaneReady = !!(currentWindow && currentWindow.start && currentWindow.end && sourceCycleFresh);
  return { status:missing.length || !narrativeCurrent || !currentLaneReady ? 'DEGRADED' : 'OK', requiredPageCount:required.length, mappedPageCount:required.length - missing.length, missingPages:missing, dynamicNarrative:narrativeCurrent, currentLaneReady:currentLaneReady, current24hCount:items.length, digestAgeHours:isFinite(digestAgeHours) ? Math.round(digestAgeHours * 10) / 10 : null, routes:routes };
};
window.AIO.getTelegramPipelineAudit = function() {
  var sources = (window.AIO_NEWS_SOURCES || AIO_NEWS_SOURCES || []).filter(function(s) { return s && s.type === 'telegram'; });
  var all = (window._allNewsItems || newsCache || []).filter(function(it) { return it && (it._tgChannel || /TG|Telegram/i.test(String(it.feed || it.source || ''))); });
  var aetherSource = sources.find(function(s) { return s.tgSlug === 'aetherjapanresearch'; }) || null;
  var aetherItems = all.filter(function(it) { return it._tgChannel === 'aetherjapanresearch' || /Aether Japan/i.test(String(it.feed || it.source || '')); });
  var digest = window.AIO_TELEGRAM_WEEKLY_DIGEST || null;
  var digestMeta = window._aioTelegramDigestMeta || null;
  var memoOverlay = window._aioTelegramMemoOverlayAudit || (digestMeta && digestMeta.memoOverlay) || null;
  var pageCoverage = window.AIO.getTelegramPageCoverageAudit();
  var requiredChannelSlugs = ['aetherjapanresearch', 'insidertracking', 'bornlupin', 'HANAchina'];
  var sourceSlugs = sources.map(function(s) { return s && s.tgSlug; }).filter(Boolean);
  var missingRequiredChannels = requiredChannelSlugs.filter(function(slug) { return sourceSlugs.indexOf(slug) < 0; });
  var requiredSourcesReady = missingRequiredChannels.length === 0;
  return {
    status: requiredSourcesReady && pageCoverage.status === 'OK' ? 'OK' : (aetherSource ? 'DEGRADED' : 'MISSING_AETHER_SOURCE'),
    telegramSourceCount: sources.length,
    requiredChannelSlugs: requiredChannelSlugs,
    missingRequiredChannels: missingRequiredChannels,
    requiredSourcesReady: requiredSourcesReady,
    sources: sources.map(function(s) {
      return { name: s.name, slug: s.tgSlug || null, tier: s.tier, topics: s.topics || [], publicMirror: s.publicMirror || ('https://t.me/s/' + (s.tgSlug || '')), pipelineRole: s.pipelineRole || 'telegram-fast-secondary' };
    }),
    aether: aetherSource ? { url: aetherSource.url, publicMirror: aetherSource.publicMirror, role: aetherSource.pipelineRole, topics: aetherSource.topics } : null,
    digest: digest ? {
      dynamicLoaded: !!digest.dynamicDigestLoaded,
      status: digestMeta && digestMeta.status || (digest.dynamicDigestLoaded ? 'ready' : 'static-fallback'),
      asOf: digest.asOf || null,
      window: digest.window || null,
      count: digest.counts && digest.counts.total || null,
      categoryCount: Array.isArray(digest.categories) ? digest.categories.length : 0,
      pageMapCount: digest.pageMap ? Object.keys(digest.pageMap).length : 0,
      retainedItemCount: digest.retainedItemCount || 0,
      coverage: digest.coverage || null,
      dynamicNarrative: pageCoverage.dynamicNarrative,
      current24hWindow: digest.current24hWindow || null,
      current24hCoverage: digest.current24hCoverage || null,
      currentLaneReady: pageCoverage.currentLaneReady,
      memoOverlay: memoOverlay ? {
        status: memoOverlay.status || null,
        date: memoOverlay.date || null,
        appliedCount: memoOverlay.appliedCount || 0,
        tickers: memoOverlay.tickers || []
      } : null
    } : null,
    memoOverlay: memoOverlay,
    pageCoverage: pageCoverage,
    recentTelegramItems: all.length,
    recentAetherItems: aetherItems.length,
    verificationPolicy: 'Telegram items are fast secondary inputs. Confirm with primary source or market data before presenting as live trade facts.'
  };
};

// ── RSS 파싱 ─────────────────────────────────────────────────────
// v29.4: 죽은 프록시 제거 (corsproxy.app 503)
// v30.11 Task 11: 하위 호환용 — 레거시 코드에서 참조하는 상수 유지 (_PROXY_REGISTRY가 진실 원천)
const CORS_PROXY  = 'https://api.allorigins.win/get?url=';
const CORS_PROXY2 = 'https://corsproxy.io/?';
const CORS_PROXY3 = 'https://api.codetabs.com/v1/proxy?quest=';
const CORS_PROXY5 = 'https://api.allorigins.win/raw?url=';

// CORS 프록시 우선순위 체인 (RSS용) — v29.4: corsproxy.app 제거
const PROXY_CHAIN = [
  u => CORS_PROXY2 + encodeURIComponent(u),
  u => CORS_PROXY  + encodeURIComponent(u),
  u => CORS_PROXY3 + encodeURIComponent(u),
  u => CORS_PROXY5 + encodeURIComponent(u),
];


// v29.3: rss2json 연속 실패 시 세션 내 스킵 플래그
let _rss2jsonFailed = 0;

// v30.12 P4: RSS 소스별 실패 추적 — 연속 3회 실패 시 세션 내 건너뜀
const _rssSourceHealth = {}; // { sourceName: { fails: N, lastOk: ts } }
function _rssMarkOk(name) {
  _rssSourceHealth[name] = { fails: 0, lastOk: Date.now() };
  if (/^TG\s|telegram/i.test(String(name || '')) && window.AIO && typeof window.AIO.setExternalSourceState === 'function') {
    window.AIO.setExternalSourceState('telegram:' + name, { status: 'success', message: 'feed items received' });
  }
}
function _rssMarkFail(name) {
  if (!_rssSourceHealth[name]) _rssSourceHealth[name] = { fails: 0, lastOk: 0 };
  _rssSourceHealth[name].fails++;
  if (/^TG\s|telegram/i.test(String(name || '')) && window.AIO && typeof window.AIO.setExternalSourceState === 'function') {
    window.AIO.setExternalSourceState('telegram:' + name, { status: 'unavailable', message: 'all external mirrors failed', reason: 'all-proxies-failed' });
  }
}
function _rssIsSkipped(name) {
  var h = _rssSourceHealth[name];
  return h && h.fails >= 3;
}

async function fetchOneFeed(source) {
  // v30.12 P4: 연속 3회 실패한 소스 건너뜀
  if (_rssIsSkipped(source.name)) {
    return [];
  }
  // v31.5: CF Worker가 있으면 CF Worker XML 파싱 우선 → rss2json은 CF Worker 없을 때만 폴백
  // (rss2json 무료 플랜 429 rate limit 방지)
  const _hasCfWorker = !!(_getApiKey('aio_cf_worker_url'));

  // CF Worker 없을 때만 rss2json 시도 (또는 CF Worker 실패 시 폴백)
  // v48.9: 공유 키 쿼터 사전 체크 (10000/day 도달 시 스킵)
  if (!_hasCfWorker && _rss2jsonFailed < 2 && !(typeof _isQuotaExceeded === 'function' && _isQuotaExceeded('rss2json'))) {
    try {
      const apiKey = _getApiKey('aio_rss2json_key') || '';
      const keyParam = apiKey ? '&api_key=' + apiKey : '';
      const r2jUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(source.url) + '&count=12' + keyParam;
      const r = await fetchWithTimeout(r2jUrl, {}, 5000);
      if (r.ok) {
        if (typeof _bumpApiCounter === 'function') _bumpApiCounter('rss2json');
        const d = await r.json();
        if (d.status === 'ok' && Array.isArray(d.items) && d.items.length > 0) {
          _rss2jsonFailed = 0;
          _rssMarkOk(source.name);
          return d.items
            .map(item => ({
              title:   (item.title || '').replace(/<[^>]+>/g,'').trim(),
              desc:    (item.description || item.content || '').replace(/<[^>]+>/g,'').trim().slice(0,280),
              link:    item.link || '#',
              pubDate: item.pubDate || '',
              source:  source.name, country: source.country,
              tier:    source.tier, flag: source.flag,
            }))
            .filter(i => i.title.length > 8);
        }
      }
      _rss2jsonFailed++;
    } catch(e) { _rss2jsonFailed++; }
  }

  // CORS 프록시 폴백 (XML 파싱) — v31.5: CF Worker 우선
  function parseXml(raw) {
    if (!raw || raw.length < 80) return [];
    // v38.3 B6: HTML entity 이중 인코딩 해제 (&amp;amp; → &amp; → &)
    function _decodeEntities(s) {
      if (!s) return s;
      // 최대 3회 반복 디코딩 (삼중 인코딩 방지)
      for (var i = 0; i < 3 && /&amp;|&lt;|&gt;|&quot;|&#\d+;|&#x[\da-f]+;/i.test(s); i++) {
        s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
      }
      return s;
    }
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(raw, 'text/xml');
      const items = xml.querySelectorAll('item, entry');
      return Array.from(items).slice(0,12).map(item => {
        const title = _decodeEntities((item.querySelector('title')?.textContent||'').replace(/<!\[CDATA\[|\]\]>/g,'').trim());
        const desc  = _decodeEntities((item.querySelector('description,summary,content')?.textContent||'').replace(/<[^>]+>/g,'').replace(/<!\[CDATA\[|\]\]>/g,'').trim().slice(0,280));
        const link  = item.querySelector('link')?.textContent?.trim() || item.querySelector('link')?.getAttribute('href') || '#';
        const pub   = item.querySelector('pubDate,published,updated')?.textContent || '';
        return { title, desc, link, pubDate:pub, source:source.name, country:source.country, tier:source.tier, flag:source.flag };
      }).filter(i => i.title.length > 8);
    } catch(e) { return []; }
  }

  // v46.6: 프록시 체인 확장 (5→7개) + CF Worker 우선
  const cfWorker = _getApiKey('aio_cf_worker_url') || '';
  const proxies = [
    ...(cfWorker ? [u => cfWorker + '?url=' + encodeURIComponent(u)] : []),
    u => 'https://corsproxy.io/?' + encodeURIComponent(u),
    u => 'https://corsproxy.org/?' + encodeURIComponent(u),
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    u => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u),
    u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
    u => 'https://api.cors.lol/?url=' + encodeURIComponent(u),
  ];
  for (const mkProxy of proxies) {
    try {
      const resp = await fetchWithTimeout(mkProxy(source.url), {}, 6000); // v46.6: 9s→6s (빠른 실패 → 빠른 다음 프록시)
      if (!resp.ok) { if (resp.status === 429) await new Promise(r => setTimeout(r, 1500)); continue; }
      let raw = '';
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('json')) {
        const w = await resp.json();
        raw = w.contents ? (typeof w.contents === 'string' ? w.contents : JSON.stringify(w.contents)) : JSON.stringify(w);
      } else {
        raw = await resp.text();
        if (raw.trimStart().startsWith('{')) {
          try { const w = JSON.parse(raw); raw = w.contents || raw; } catch(e2) {} 
        }
      }
      const items = parseXml(raw);
      if (items.length > 0) { _rssMarkOk(source.name); return items; } // v30.12 P4
    } catch(e) {}
  }
  _rssMarkFail(source.name); // v30.12 P4: 모든 프록시 실패
  if (window.NewsStore) NewsStore.reportDeadFeed(source.url, 'all-proxies-failed');
  return [];
}


// ── 텔레그램 메시지에서 원문 출처 자동 추출 ──────────────────────
function extractOriginalSource(text) {
  if (!text) return null;
  // 패턴 1: "출처: XXX", "출처 : XXX", "Source: XXX"
  const srcPatterns = [
    /(?:출처|source|src|via|from)\s*[:：]\s*([^\n\r,()]{2,40})/i,
    /[-–—]\s*([A-Z][A-Za-z\s&.]{2,30}(?:Research|Capital|Securities|Analytics|Intelligence|Partners|Group|Bank|Institute|News|Wire|Press))/,
    /\(([A-Z][A-Za-z\s&.]{2,30})\)\s*$/m,
  ];
  for (const pat of srcPatterns) {
    const m = text.match(pat);
    if (m && m[1]) return m[1].trim();
  }
  // 패턴 2: 알려진 기관/외신사 이름 직접 매칭
  const knownSources = [
    'Reuters','Bloomberg','CNBC','WSJ','Wall Street Journal','Financial Times','FT',
    'Goldman Sachs','Morgan Stanley','JP Morgan','JPMorgan','Barclays','Citi','Citigroup',
    'Bank of America','BofA','Deutsche Bank','UBS','Credit Suisse','Nomura','CLSA',
    'Bernstein','Jefferies','Piper Sandler','Wedbush','KeyBanc','Stifel',
    'Nikkei','NHK','Kyodo','Yomiuri','Mainichi',
    'SCMP','South China Morning Post','Caixin','Xinhua','Global Times',
    'Hana Securities','Samsung Securities','NH투자증권','미래에셋','키움증권',
    'TrendForce','DigiTimes','Counterpoint','IDC','Gartner','Omdia',
    'Fed','Federal Reserve','ECB','BOJ','PBOC','IMF','World Bank','BIS',
    'Seeking Alpha','MarketWatch','Investing.com','Yahoo Finance',
    'AP','Associated Press','AFP','Yonhap','연합뉴스',
    'The Information','Semafor','Axios','Politico','The Economist',
    'Refinitiv','FactSet','S&P Global','Moody\'s','Fitch',
  ];
  const textLower = text.toLowerCase();
  for (const src of knownSources) {
    if (textLower.includes(src.toLowerCase())) return src;
  }
  return null;
}

// ── 텔레그램 메시지 관련성 필터 (주식/매크로/기관 리포트 선별) ────
function isTelegramMsgRelevant(text) {
  if (!text || text.length < 12) return false;  // v33.5: 20→12 (CJK 문자는 정보밀도 높아 18자도 완전한 문장)
  const t = text.toLowerCase();
  // 스팸/광고 필터
  // v33.3: '무료' 단독→복합패턴 구체화, '가입' 단독 제거(ETF 가입 등 정당사용)
  const spamKW = ['광고','sponsored','ad ','join ','subscribe','홍보','이벤트 참여','click here',
    'giveaway','airdrop','free tokens','sign up','telegram bot','promo code','referral',
    '경품','추첨','텔레그램 봇','프로모션','레퍼럴',
    '무료 이벤트','무료 참여','무료 가입','무료 체험','무료 쿠폰','무료 배송'];
  if (spamKW.some(kw => t.includes(kw))) return false;
  // v31.8→v34.1: 비금융 콘텐츠 강화 차단 + NEWS_BLACKLIST_KW 통합
  const tgBlackKW = ['recipe','workout','dating','celebrity','movie review','game review',
    'horoscope','astrology','meme coin','shitcoin','pump signal','buy signal guaranteed',
    '연예','아이돌','드라마','맛집','운동법','별자리','밈코인','펌핑','100배'];
  if (tgBlackKW.some(kw => t.includes(kw))) return false;
  // v34.1: 글로벌 블랙리스트도 적용 (지역 뉴스 등)
  if (NEWS_BLACKLIST_KW.some(kw => t.includes(kw.toLowerCase()))) return false;
  // v39.0: 너무 광범위한 단독 키워드 매칭 방지 — 이 키워드만 1개 매칭되면 불충분
  // "space"만으로 통과 → 우주와 무관한 맥락 가능, "stock"만으로 통과 → 비금융 맥락 가능
  const _TG_BROAD_KW = new Set(['space','market','report','note','stock','share','investment',
    'spending','cost','profit','launch','trade','bond','credit','flow','sector',
    '시장','기업','산업','경제','금융','수출','수입','에너지','투자']);
  // 관련성 키워드 (최소 1개 이상 포함해야 통과)
  const relevantKW = [
    // 영문 매크로/시장
    'fed','fomc','cpi','ppi','gdp','inflation','rate cut','rate hike','treasury','yield',
    'earnings','revenue','guidance','forecast','outlook','estimate','target','upgrade','downgrade',
    'tariff','trade war','sanction','geopolitical','recession','employment','payroll','jobs',
    'bull','bear','rally','sell-off','selloff','correction','volatility','vix',
    // 영문 섹터/산업
    'semiconductor','chip','ai ','artificial intelligence','nvidia','tsmc','samsung','apple','google',
    'amazon','microsoft','meta','tesla','bitcoin','crypto','oil','gold','commodity',
    'ipo','m&a','merger','acquisition','buyback','dividend',
    // 기관/리포트
    'goldman','morgan stanley','jpmorgan','barclays','citi','nomura','ubs','deutsche',
    'raymond james','wedbush','piper sandler','jefferies','bernstein','stifel',
    'report','research','note','analyst','rating','pt ','price target',
    // v33.3: 시장 영향력 핵심 인물 (영문)
    'trump','biden','powell','yellen','lagarde','jensen huang','tim cook','elon musk',
    'altman','buffett','dimon','dalio','ackman','druckenmiller',
    // v31.8: 채권·통화·거시 심화
    'bond','credit','spread','duration','curve','inversion','steepening','flattening',
    'dollar','dxy','yen','euro','yuan','won','currency','forex','fx',
    'central bank','ecb','boj','boe','pboc','bok','monetary','fiscal',
    'pmi','ism','consumer confidence','retail sales','industrial production',
    'housing','permits','durable goods','trade balance','current account',
    // v31.8: 기업 이벤트 심화
    'stock','share','equity','market cap','valuation','multiple','pe ratio',
    'profit','margin','ebitda','fcf','cash flow','balance sheet',
    'capex','investment','spending','cost cut','restructuring','layoff',
    'insider','13f','sec','filing','proxy','activist',
    'defense','military','weapon','arms','nuclear','uranium',
    // v33.3: 우주/항공우주 (영문)
    'spacex','nasa','boeing','lockheed','northrop','raytheon','rocket lab','satellite','orbit',
    'launch','aerospace','space force','starship','falcon','pentagon','darpa','space','rocket',
    'battery','lithium','ev ','electric vehicle','solar','wind','hydrogen',
    'biotech','pharma','fda','clinical','pipeline','drug',
    'shipbuilding','shipping','freight','logistics','container',
    // v31.8: 시장 구조
    'short interest','options','futures','derivatives','hedge','swap',
    'dark pool','market maker','gamma','delta','theta',
    'breadth','advance','decline','new high','new low',
    'flow','inflow','outflow','rotation','sector',
    // 한국어
    '금리','인플레','기준금리','연준','실적','매출','가이던스','전망','목표가','상향','하향',
    '반도체','ai','엔비디아','삼성','애플','테슬라','비트코인','원유','금값',
    '관세','무역','제재','고용','실업','경기','침체','호황',
    '리포트','보고서','애널리스트','증권사','투자의견',
    '급등','급락','폭등','폭락','신고가','신저가','속보',
    // v31.8: 한국어 심화
    '채권','국채','회사채','크레딧','스프레드','금통위','한국은행','통화정책',
    '환율','원달러','엔화','위안화','달러인덱스',
    '주식','주가','시장','코스피','코스닥','나스닥','다우',
    '영업이익','순이익','컨센서스','어닝','배당','자사주',
    '외국인','기관','수급','공매도','대차','신용',
    '방산','군수','조선','원전','2차전지','바이오','신약',
    // v33.3: 우주/항공우주 (한국어)
    '우주','로켓','위성','달 탐사','항공우주','발사체','궤도','스페이스','보잉',
    '록히드','레이시온','노스롭','한화에어로','NASA','펜타곤','방위비','국방부','스타링크',
    // v33.3: 핵심 인물 (한국어)
    '트럼프','바이든','파월','옐런','젠슨 황','일론 머스크','올트먼','버핏','네타냐후','시진핑','푸틴',
    // v33.3: AI/테크 인프라 (한국어)
    '오픈AI','데이터센터','클라우드','서버','GPU','HBM',
    // v33.3: 애널리스트 리포트 (한국어)
    '목표 주가','강력 매수','매수의견','비중확대',
    '수출','수입','무역수지','경상수지','PMI',
    '부양책','긴축','양적완화','테이퍼링','피봇',
    // 일본어 (Aether Japan Research) — v33.3: 9→21개 확장
    '日銀','金利','半導体','決算','為替','円安','円高','株価','市場',
    '利上げ','利下げ','景気','株式','投資','企業','収益','配当','防衛','宇宙','ロケット','衛星','原発','原子力',
  ];
  // v39.0: 매칭된 키워드 수집 — 광범위 키워드만 1개 매칭이면 불통과
  const matchedKW = relevantKW.filter(kw => t.includes(kw));
  if (matchedKW.length === 0) return false;
  // 매칭된 키워드 중 구체적(비광범위) 키워드가 1개 이상이면 통과
  const hasSpecificKW = matchedKW.some(kw => !_TG_BROAD_KW.has(kw));
  if (hasSpecificKW) return true;
  // 광범위 키워드만 매칭된 경우: 2개 이상이어야 통과
  return matchedKW.length >= 2;
}

async function fetchTelegramDirect(channelSlug, sourceName) {
  const tgUrl = `https://t.me/s/${channelSlug}`;
  const cfW = _getApiKey('aio_cf_worker_url') || '';
  // v46.6: 프록시 체인 확장 (5→7개)
  const proxies = [
    ...(cfW ? [u => `${cfW}?url=${encodeURIComponent(u)}`] : []),
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    u => `https://corsproxy.org/?${encodeURIComponent(u)}`,
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    u => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
  ];
  let lastErr = null;
  for (let pi = 0; pi < proxies.length; pi++) {
    const mkP = proxies[pi];
    try {
      const r = await fetchWithTimeout(mkP(tgUrl), {}, 10000);
      if (!r.ok) { // v27.3: r.ok 검증 추가
        _debugWarn(`[AIO TG] ${sourceName} proxy ${pi+1}/${proxies.length}: HTTP ${r.status}`);
        continue;
      }
      const ct = r.headers.get('content-type') || '';
      let raw = '';
      if (ct.includes('json')) {
        const d = await r.json();
        raw = typeof d.contents === 'string' ? d.contents : (typeof d === 'string' ? d : '');
      } else {
        raw = await r.text();
        // allorigins raw 등 JSON 래핑 없이 직접 HTML 반환하는 경우
        if (raw.trimStart().startsWith('{')) {
          try { const w = JSON.parse(raw); raw = w.contents || raw; } catch(e2) {}
        }
      }
      if (!raw || raw.length < 500) {
        _debugWarn(`[AIO TG] ${sourceName} proxy ${pi+1}: 응답 너무 짧음 (${(raw||'').length}자)`);
        continue;
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(raw, 'text/html');
      const msgs = doc.querySelectorAll('.tgme_widget_message_wrap');
      if (!msgs.length) {
        // Telegram DOM 구조 변경 대비: 대체 셀렉터 시도
        const altMsgs = doc.querySelectorAll('[class*="message_wrap"], [data-post]');
        if (!altMsgs.length) {
          _debugWarn(`[AIO TG] ${sourceName} proxy ${pi+1}: 메시지 DOM 파싱 실패`);
          continue;
        }
      }
      const msgEls = msgs.length ? msgs : doc.querySelectorAll('[class*="message_wrap"], [data-post]');
      const items = [];
      msgEls.forEach(wrap => {
        const textEl = wrap.querySelector('.tgme_widget_message_text, [class*="message_text"]');
        const dateEl = wrap.querySelector('time');
        const linkEl = wrap.querySelector('.tgme_widget_message_date, [class*="message_date"]');
        if (!textEl) return;
        const fullText = (textEl.innerText || textEl.textContent || '').trim();
        if (!fullText) return;
        // 관련성 필터: 주식/매크로/기관 리포트 관련 메시지만 선별
        if (!isTelegramMsgRelevant(fullText)) return;
        const title = fullText.slice(0, 200);
        // 원문 출처 추출 (채널명 대신 실제 외신사/기관명 사용)
        const originalSrc = extractOriginalSource(fullText);
        const displaySource = originalSrc
          ? `${originalSrc} (TG)`
          : `${sourceName}`;
        items.push({
          title,
          desc: fullText.slice(0, 280),
          link: linkEl ? (linkEl.getAttribute('href') || tgUrl) : tgUrl,
          pubDate: dateEl ? dateEl.getAttribute('datetime') : new Date().toISOString(),
          source: displaySource,
          feed: sourceName,
          tier: 1,
          flag: '',
          _tgChannel: channelSlug,
          _pipeline: channelSlug === 'aetherjapanresearch' ? 'asia-semi-flow' : 'telegram-fast-secondary',
          _verification: channelSlug === 'aetherjapanresearch' ? 'secondary-source-confirm-before-live-like-use' : 'secondary-source',
        });
      });
      if (items.length) {
        console.log(`[AIO TG] ${sourceName}: ${items.length}건 수집 (proxy ${pi+1})`);
        return items.reverse(); // 최신 순
      }
    } catch(e) {
      lastErr = e;
      _debugWarn(`[AIO TG] ${sourceName} proxy ${pi+1}/${proxies.length} 실패:`, e.message || e);
    }
  }
  _aioLog('error', 'fetch', sourceName + ': 모든 프록시(' + proxies.length + '개) 실패 ' + (lastErr?.message || ''));
  return [];
}

async function fetchAllNews(forceRefresh = false) {
  // v39.0: isFetching 안전장치 — 180초로 확장 (80소스 x 1.5초 딜레이 + 프록시 타임아웃 고려)
  if (isFetching && _fetchStartTime && Date.now() - _fetchStartTime > 180000) {
    _aioLog('warn', 'fetch', 'fetchAllNews isFetching 180s 초과 — 강제 리셋');
    isFetching = false;
    _aioNotifyNewsSurfaceInvalidated('news-fetch-timeout');
  }
  if (isFetching) return;
  // v21: 캐시 유효 시간 10분 (5명 동시접속 시 불필요한 중복 호출 방지)
  if (!forceRefresh && Date.now() - lastFetchTime < 600000) {
    if (newsCache.length) {
      _aioNotifyNewsSurfaceInvalidated('news-cache-reuse');
      renderHomeFeed(newsCache);
      renderBriefingFeed(newsCache);
    }
    var cachedProgLabel = document.getElementById('news-progress-label');
    var cachedProgBar = document.getElementById('news-progress-bar');
    if (cachedProgLabel) cachedProgLabel.textContent = '뉴스 캐시 사용 중 - 최신 수집본 유지';
    if (cachedProgBar) cachedProgBar.style.width = '100%';
    return;
  }

  isFetching = true;
  _fetchStartTime = Date.now(); // v29.3: 잠김 방지 타임스탬프
  window._homeNewsEarlyRendered = false; // v34.5: 점진 렌더링 플래그 초기화
  window._briefingEarlyRendered = false; // v46.6: 브리핑 점진 렌더링 플래그
  // v27.3: 새로고침 시 번역 캐시 클리어 (오래된 캐시가 새 뉴스에 잘못 매핑되는 것 방지)
  if (forceRefresh) {
    _translationCache.clear();
    try { localStorage.removeItem('aio_tc'); } catch(e) {}
    // v46.6: 소스 헬스 리셋 — 3회 실패로 스킵된 소스에 재시도 기회
    Object.keys(_rssSourceHealth).forEach(function(k) { _rssSourceHealth[k] = { fails: 0, lastOk: 0 }; });
    _rss2jsonFailed = 0;
  }
  const dot  = document.getElementById('live-dot');
  const lbl  = document.getElementById('live-btn-label');
  const progWrap = document.getElementById('news-progress-wrap');
  const progBar = document.getElementById('news-progress-bar');
  const progLabelTop = document.getElementById('news-progress-label');
  if (progWrap) progWrap.style.display = 'block';
  if (progBar) progBar.style.width = '0%';
  if (progLabelTop) progLabelTop.textContent = '뉴스 수집 준비 중';
  if (dot) { dot.style.background = 'var(--yellow)'; dot.style.boxShadow = '0 0 5px var(--yellow)'; }
  if (lbl) lbl.textContent = '뉴스 수집 준비';
  try {
  // v48.38: 헬스체크 — disabled 피드 자동 스킵 (dead RSS 자동 회피)
  let activeSources = (window._aioFeedHealth && typeof window._aioFeedHealth.isDisabled === 'function')
    ? AIO_NEWS_SOURCES.filter(function(s) { return !window._aioFeedHealth.isDisabled('rss:' + s.name); })
    : AIO_NEWS_SOURCES.slice();
  // 서버 다이제스트가 준비되어 있으면 같은 Telegram 채널을 브라우저에서 다시 직접 수집하지 않는다.
  // t.me 차단 환경에서 반복 프록시 오류만 만들고 이미 받은 캐시와 중복되기 때문이다.
  if (window._aioTelegramDigestMeta && /ready|cached_after/.test(window._aioTelegramDigestMeta.status || '')) {
    activeSources = activeSources.filter(function(s) { return s.type !== 'telegram'; });
  }
  // tier:1 소스를 앞으로 정렬 → 핵심 15~20개 먼저 렌더링
  activeSources.sort(function(a, b) { return (a.tier || 9) - (b.tier || 9); });
  const _skippedCount = AIO_NEWS_SOURCES.length - activeSources.length;
  if (_skippedCount > 0) {
    _aioLog('info', 'rss-health', _skippedCount + '개 RSS 소스 헬스체크로 자동 스킵');
  }
  const total = activeSources.length;
  let done = 0;
  const updateBar = (name) => {
    done++;
    const pct = Math.round(done / total * 100);
    const bar = document.getElementById('load-bar');
    const st  = document.getElementById('load-status');
    const pageBar = document.getElementById('news-progress-bar');
    const progLabel = document.getElementById('news-progress-label');
    // v29.5: 홈 페이지 진행률도 함께 업데이트
    const homeBar = document.getElementById('home-news-progress-bar');
    const homeText = document.getElementById('home-news-progress-text');
    if (bar) bar.style.width = pct + '%';
    if (pageBar) pageBar.style.width = pct + '%';
    if (st)  st.textContent = `(${done}/${total}) ${name} 완료`;
    if (progLabel) progLabel.textContent = Date.now() - _fetchStartTime > 12000
      ? `백그라운드 갱신 · ${done}/${total}`
      : `뉴스 수집 중... ${done}/${total}`;
    if (homeBar) homeBar.style.width = pct + '%';
    if (homeText) homeText.textContent = Date.now() - _fetchStartTime > 12000
      ? `${done}/${total} 소스 백그라운드 갱신`
      : `${done}/${total} 소스 수집 중...`;
  };

  // v21: 배치 분할 (3개씩 순차 배치 → CF Worker 100req/분 rate limit 안전)
  const BATCH_SIZE = 3;
  const results = [];
  for (let i = 0; i < activeSources.length; i += BATCH_SIZE) {
    const batch = activeSources.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(s => {
        if (s.type === 'telegram') {
          const slug = s.tgSlug || s.url.split('/').pop();
          // v29: RSS 먼저 시도 → 실패 시 텔레그램 직접 파싱 (출처 추출 + 관련성 필터 적용)
          const enrichTgItems = (items) => {
            items.forEach(it => {
              const txt = (it.title || '') + ' ' + (it.desc || '');
              const origSrc = extractOriginalSource(txt);
              if (origSrc) it.source = `${origSrc} (TG)`;
              it.feed = s.name;
              it._tgChannel = slug;
              it._pipeline = s.pipelineRole || 'telegram-fast-secondary';
              it._verification = slug === 'aetherjapanresearch' ? 'secondary-source-confirm-before-live-like-use' : 'secondary-source';
            });
            return items.filter(it => isTelegramMsgRelevant((it.title||'') + ' ' + (it.desc||'')));
          };
          // v29: CF Worker → rss2json → CORS 프록시 → t.me 직접 스크래핑 순서
          // v38.4: rsshub 미러 프록시 배열 (rsshub.app 전면 장애 대비)
          const RSSHUB_MIRRORS = [
            'https://rsshub.rssforever.com',
            'https://rss.fatpandac.com',
            'https://rsshub.pseudoyu.com',
            'https://rsshub.moeyy.xyz',
            'https://rsshub.ktachibana.party',
            'https://rsshub.app',
          ];
          // v39.0: rsshub에서 403 차단된 채널 — 직접 스크래핑 우선
          const _TG_DIRECT_ONLY = ['walterbloomberg'];
          // v39.0: t.me/s/ 공개 미리보기 비활성화된 채널 — 스킵 (시간 낭비 방지)
          const _TG_UNAVAILABLE = ['firstsquawk', 'financialjuicechannel'];
          const tgPath = s.url.replace(/^https?:\/\/rsshub\.app/, '');
          return (async () => {
            // v39.0: 비활성 채널은 즉시 스킵
            if (_TG_UNAVAILABLE.includes(slug)) {
              _debugWarn(`[AIO TG] ${s.name}: 공개 미리보기 비활성 — 스킵`);
              updateBar(s.name);
              return [];
            }
            // v39.0: 직접 스크래핑 전용 채널 — CF Worker 1회 시도 후 빠르게 결과 반환
            if (_TG_DIRECT_ONLY.includes(slug)) {
              const cfW2 = _getApiKey('aio_cf_worker_url') || '';
              if (cfW2) {
                try {
                  const tgUrl2 = `https://t.me/s/${slug}`;
                  const r2 = await fetchWithTimeout(`${cfW2}?url=${encodeURIComponent(tgUrl2)}`, {}, 8000); // v48.27 (P4): 12s → 8s
                  if (r2.ok) {
                    const raw2 = await r2.text();
                    if (raw2 && raw2.length > 500) {
                      const doc2 = new DOMParser().parseFromString(raw2, 'text/html');
                      const msgs2 = doc2.querySelectorAll('.tgme_widget_message_wrap, [class*="message_wrap"], [data-post]');
                      const items2 = [];
                      msgs2.forEach(wrap => {
                        const textEl = wrap.querySelector('.tgme_widget_message_text, [class*="message_text"]');
                        const dateEl = wrap.querySelector('time');
                        const linkEl = wrap.querySelector('.tgme_widget_message_date, [class*="message_date"]');
                        if (!textEl) return;
                        const fullText = (textEl.innerText || textEl.textContent || '').trim();
                        if (!fullText || !isTelegramMsgRelevant(fullText)) return;
                        const originalSrc = extractOriginalSource(fullText);
                        items2.push({
                          title: fullText.slice(0, 200),
                          desc: fullText.slice(0, 280),
                          link: linkEl ? (linkEl.getAttribute('href') || tgUrl2) : tgUrl2,
                          pubDate: dateEl ? dateEl.getAttribute('datetime') : new Date().toISOString(),
                          source: originalSrc ? `${originalSrc} (TG)` : s.name,
                          feed: s.name, tier: 1, flag: '', _tgChannel: slug,
                        });
                      });
                      if (items2.length > 0) {
                        console.log(`[AIO TG] ${s.name}: CF Worker 직접 스크래핑 성공 (${items2.length}건)`);
                        updateBar(s.name);
                        return items2.reverse();
                      }
                    }
                  }
                } catch(e) { _debugWarn(`[AIO TG] ${s.name}: CF Worker 직접 스크래핑 실패`, e.message); }
              }
              // CF Worker 실패 시 기존 fetchTelegramDirect 폴백
              try {
                const items = await fetchTelegramDirect(slug, s.name);
                updateBar(s.name);
                if (items.length > 0) {
                  console.log(`[AIO TG] ${s.name}: 직접 스크래핑 폴백 성공 (${items.length}건)`);
                  return items;
                }
              } catch(e) { _debugWarn(`[AIO TG] ${s.name}: 직접 스크래핑 폴백 실패`, e.message); }
              updateBar(s.name);
              return [];
            }
            // 1) CF Worker로 rsshub 미러 순회 fetch 시도 (CORS 우회 가장 안정적)
            const cfW = _getApiKey('aio_cf_worker_url') || '';
            if (cfW) {
              for (const mirror of RSSHUB_MIRRORS) {
                try {
                const mirrorUrl = mirror + tgPath;
                const cfUrl = cfW + '?url=' + encodeURIComponent(mirrorUrl);
                const cfResp = await fetchWithTimeout(cfUrl, {}, 9000);
                if (cfResp.ok) {
                  const raw = await cfResp.text();
                  if (raw && raw.length > 200) {
                    const parser = new DOMParser();
                    const xml = parser.parseFromString(raw, 'text/xml');
                    const xmlItems = xml.querySelectorAll('item, entry');
                    if (xmlItems.length > 0) {
                      const parsed = Array.from(xmlItems).slice(0,12).map(item => {
                        const title = (item.querySelector('title')?.textContent||'').replace(/<!\[CDATA\[|\]\]>/g,'').trim();
                        const desc  = (item.querySelector('description,summary,content')?.textContent||'').replace(/<[^>]+>/g,'').replace(/<!\[CDATA\[|\]\]>/g,'').trim().slice(0,280);
                        const link  = item.querySelector('link')?.textContent?.trim() || item.querySelector('link')?.getAttribute('href') || '#';
                        const pub   = item.querySelector('pubDate,published,updated')?.textContent || '';
                        return { title, desc, link, pubDate:pub, source:s.name, country:s.country, tier:s.tier, flag:s.flag };
                      }).filter(i => i.title.length > 8);
                      if (parsed.length > 0) {
                        console.log(`[AIO TG] ${s.name}: CF Worker RSS 성공 (${parsed.length}건)`);
                        updateBar(s.name);
                        return enrichTgItems(parsed);
                      }
                    }
                  }
                }
              } catch(e) { _debugWarn(`[AIO TG] ${s.name}: CF Worker RSS 실패 (${mirror})`, e.message); }
              } // end for mirror
            }
            // 2) rss2json 시도 (미러 순회 — rsshub.app 장애 대비)
            for (const mirror of RSSHUB_MIRRORS) {
              try {
                const mirrorSource = Object.assign({}, s, { url: mirror + tgPath });
                const items = await fetchOneFeed(mirrorSource);
                if (items.length > 0) {
                  console.log(`[AIO TG] ${s.name}: rss2json 성공 via ${mirror}`);
                  updateBar(s.name);
                  return enrichTgItems(items);
                }
              } catch(e) { _debugWarn(`[AIO TG] ${s.name}: rss2json 실패 (${mirror})`); }
            }
            // 3) t.me 직접 스크래핑
            try {
              const items = await fetchTelegramDirect(slug, s.name);
              updateBar(s.name);
              return items;
            } catch(e) {
              updateBar(s.name);
              return [];
            }
          })();
        }
        return fetchOneFeed(s).then(items => {
          updateBar(s.name);
          // v48.38: 헬스 리포트 — items.length > 0 이면 ok, 아니면 fail
          if (window._aioFeedHealth) {
            if (items && items.length > 0) window._aioFeedHealth.reportOk('rss:' + s.name);
            else window._aioFeedHealth.reportFail('rss:' + s.name);
          }
          return items;
        }).catch(err => {
          // fetch 자체가 throw 하는 경우도 fail로 기록
          if (window._aioFeedHealth) window._aioFeedHealth.reportFail('rss:' + s.name);
          return [];
        });
      })
    );
    results.push(...batchResults);

    // v46.6: 점진적 브리핑 렌더링 — 15소스(5배치) 이상 완료 시 조기 렌더
    // (홈 뉴스는 전체 완료 후 렌더, 브리핑은 부분 결과라도 표시)
    if (i >= BATCH_SIZE * 4 && !window._briefingEarlyRendered) {
      var _earlyItems = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      if (_earlyItems.length >= 8) {
        window._briefingEarlyRendered = true;
        // 조기 스코어링 + 렌더
        var _earlyScored = _earlyItems
          .map(function(it) { var s = Object.assign({}, it); s.score = scoreItem(s); s.topic = classifyTopic(s); s.flag = s.flag || getCountryFlag(s.country); return s; })
          .filter(function(it) { return !it._blacklisted; })
          .sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
        if (_earlyScored.length >= 5) {
          _briefingCacheKey = null; // 캐시 무효화 (최종 렌더에서 갱신)
          renderBriefingFeed(_earlyScored);
          console.log('[AIO v46.6] 브리핑 조기 렌더: ' + _earlyScored.length + '건 (배치 ' + Math.ceil((i + BATCH_SIZE) / BATCH_SIZE) + '/' + Math.ceil(activeSources.length / BATCH_SIZE) + ')');
        }
      }
    }

    // v46.6: 배치 딜레이 1500→1000ms (프록시 타임아웃 단축과 함께 전체 속도 30%↑)
    if (i + BATCH_SIZE < activeSources.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  let allItems = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  // ═══ v20+: 추가 뉴스 API 병합 (Finnhub + NewsData.io) ═══
  try {
    const [finnhubItems, newsDataItems] = await Promise.allSettled([
      fetchFinnhubNewsFormatted(),
      fetchNewsDataIO('business')
    ]);
    if (finnhubItems.status === 'fulfilled' && finnhubItems.value.length) {
      allItems = allItems.concat(finnhubItems.value);
      console.log(`[AIO v20+] Finnhub News: +${finnhubItems.value.length}건`);
    }
    if (newsDataItems.status === 'fulfilled' && newsDataItems.value.length) {
      allItems = allItems.concat(newsDataItems.value);
      console.log(`[AIO v20+] NewsData.io: +${newsDataItems.value.length}건`);
    }
  } catch(e) { _aioLog('warn', 'fetch', 'Extra news API merge error: ' + (e && e.message || e)); }

  // v27.3: 강화된 중복 제거 (제목 유사도 기반 — 동일 뉴스 다중 소스 중복 방지)
  const seen = new Set();
  const seenShort = new Set(); // 핵심 키워드 기반 추가 중복 체크
  allItems = allItems.filter(i => {
    if (!i.title || i.title.length < 10) return false;
    // 1차: 제목 첫 60자 정규화 매칭
    const key = i.title.slice(0, 60).toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    // 2차: 핵심 단어 추출 기반 유사 뉴스 중복 제거 (같은 종목+이벤트 조합)
    const words = i.title.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const sorted = words.sort().join('');
    const shortKey = sorted.slice(0, 40);
    if (shortKey.length > 15 && seenShort.has(shortKey)) return false;
    if (shortKey.length > 15) seenShort.add(shortKey);
    return true;
  });

  // 스코어링 + 토픽 분류 (v21: 기본 최신순 정렬)
  allItems = allItems
    .map(i => { const scored = { ...i }; scored.score = scoreItem(scored); scored.topic = classifyTopic(scored); scored.flag = scored.flag || getCountryFlag(scored.country); return scored; })
    .filter(i => !i._blacklisted)  // v27.4: 블랙리스트 뉴스 완전 제거
    .sort((a, b) => {
      // 기본: 최신순 정렬 (renderFeed에서 모드에 따라 재정렬)
      const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (b.score || 0) - (a.score || 0);
    })
    .slice(0, 200);  // v40.4: 캐시 상한 120→200 (48h 내 더 많은 뉴스 유지)

  // v31.8: NewsStore 검증 레이어 — 중복 제거 + 품질 필터
  NewsStore.resetDuplicates();
  const filteredItems = NewsStore.filter(allItems);
  const removedCount = allItems.length - filteredItems.length;
  if (removedCount > 0) console.log(`[NewsStore] ${removedCount}건 필터링됨 (중복/품질)`);

  // v51.08: CORS 완전 실패 시 빈 배열로 백스톱을 덮어쓰지 않도록 보호
  if (filteredItems.length === 0 && typeof _aioApplyNewsBackstop === 'function' && window._serverNewsBackstop && window._serverNewsBackstop.length > 0) {
    _aioApplyNewsBackstop(true);
    return;
  }
  // v51.22: KR 뉴스 슬롯 보완 — 클라이언트 RSS 파이프라인에 Korea 피드 없으므로 서버 백스톱 kr items 최대 3건 주입
  try {
    var _bsKr = (window._serverNewsBackstop || []).filter(function(n){ return n.topic === 'kr' || n.country === 'kr'; });
    if (_bsKr.length > 0 && !filteredItems.some(function(x){ return x.topic === 'kr' || x.country === 'kr'; })) {
      var _krSlots = _bsKr
        .sort(function(a, b){ return (new Date(b.pubDate||0)) - (new Date(a.pubDate||0)); })
        .slice(0, 3)
        .map(function(n){
          return { title: n.title, headline: n.title, link: n.link, url: n.link,
                   source: n.source || 'Google News', pubDate: n.pubDate || new Date().toISOString(),
                   desc: '', summary: '', country: n.country || 'kr', topic: n.topic || 'kr',
                   score: n.score || 40, selectionReason: n.selectionReason || '',
                   flag: typeof getCountryFlag === 'function' ? getCountryFlag('kr') : '',
                   _serverKrSlot: true };
        });
      if (_krSlots.length > 0) filteredItems.unshift.apply(filteredItems, _krSlots);
    }
  } catch(_e) {}
  newsCache = filteredItems;
  window._allNewsItems = filteredItems;  // v29: 텔레그램 필터 등에서 참조
  lastFetchTime = Date.now();
  _idbSaveNews(filteredItems); // IDB 저장 (비동기, 블로킹 없음)
  // isFetching = false; // v27.3: finally 블록으로 이동 (중복 방지)

  const progLabel = document.getElementById('news-progress-label');
  if (progLabel) progLabel.textContent = `뉴스 수집 완료 · ${filteredItems.length}건 (${removedCount}건 필터링)`;

  if (dot) { dot.style.background = 'var(--green)'; dot.style.boxShadow = '0 0 5px var(--green)'; }
  if (lbl) lbl.textContent = '새로고침';
  const pageProgBar = document.getElementById('news-progress-bar');
  const pageProgWrap = document.getElementById('news-progress-wrap');
  if (pageProgBar) pageProgBar.style.width = '100%';
  if (pageProgWrap) setTimeout(function(){ pageProgWrap.style.display = 'none'; }, 2500);
  const ftEl = document.getElementById('last-fetch-time');
  if (ftEl) ftEl.textContent = new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
  // 뉴스 캐시 타임스탬프 + 스테일 배너 (RSS 성공 시 항상 신선)
  var _newsCacheTs = document.getElementById('news-cache-ts');
  if (_newsCacheTs) _newsCacheTs.textContent = new Date().toLocaleString('ko-KR', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) + ' (RSS 직접)';
  var _newsStaleBanner = document.getElementById('news-stale-banner');
  if (_newsStaleBanner) _newsStaleBanner.style.display = 'none';

  // 소스 라벨 업데이트
  const sl = document.getElementById('news-sources-label');
  if (sl) sl.textContent = `${allItems.length}건 수집 · ${AIO_NEWS_SOURCES.length}개 소스 · 최종 갱신 ${new Date().toLocaleTimeString('ko-KR')}`;

  _aioNotifyNewsSurfaceInvalidated('news-fetch-complete');
  renderHomeFeed(newsCache);
  // v46.6: 최종 렌더 시 조기 렌더 캐시 무효화 → 완전한 데이터로 갱신
  _briefingCacheKey = null;
  renderBriefingFeed(newsCache);
  var _newsSummary = _aioUpdateNewsSummaryFromItems(newsCache, { kind: 'direct', generatedAt: new Date().toISOString() });
  document.dispatchEvent(new CustomEvent('aio:newsUpdated', { detail: { count: newsCache.length, source: 'fetchAllNews' } }));

  // v21: 자동 한국어 번역 — 상위 6건 즉시, 나머지는 renderFeed 내 IntersectionObserver로 lazy 처리
  autoTranslateNews(newsCache.slice(0, 6)).catch(e => _aioLog('warn', 'translate', '자동 번역 에러: ' + (e && e.message || e)));

  // v20: 뉴스 감성 바 업데이트
  try {
    const ns = _newsSummary || computeNewsSentimentScore(newsCache);

    // v46.6: 뉴스 감성 시계열 히스토리 저장 + 차트 렌더
    // v50.15 (사용자 지적: 뉴스감성 차트 빈 화면): 세션당 1포인트씩만 쌓여 >=2 전까지 빈 차트였음
    //   → (1) localStorage 영속(reload 생존·누적) (2) 첫 진입 시 뉴스 캐시를 시간 버킷으로 즉시 시딩
    if (!window._newsSentimentHistory) {
      window._newsSentimentHistory = [];
      try { var _savedNsh = JSON.parse(localStorage.getItem('aio_news_sent_hist') || '[]'); if (Array.isArray(_savedNsh) && _savedNsh.length) window._newsSentimentHistory = _savedNsh.slice(-24); } catch (_nshR) {}
    }
    var _nsh = window._newsSentimentHistory;
    // 히스토리 부족 시 뉴스 캐시(24h)를 3시간 버킷으로 즉시 시딩 — 빈 차트 방지
    if (_nsh.length < 3 && typeof newsCache !== 'undefined' && newsCache && newsCache.length >= 6 && typeof getSentimentFromText === 'function') {
      try {
        var _nowMs = Date.now(), _seedNsh = [];
        for (var _bk = 11; _bk >= 0; _bk--) {   // 1시간 버킷 × 12 (뉴스가 최근 몇 시간에 몰려도 다포인트 확보)
          var _hi = _nowMs - _bk * 3600000, _lo = _hi - 3600000;
          var _bkItems = newsCache.filter(function(it) { if (!it.pubDate) return false; var t = new Date(it.pubDate).getTime(); return t > _lo && t <= _hi; });
          if (_bkItems.length < 2) continue;
          var _bBull = 0, _bBear = 0;
          _bkItems.forEach(function(it) { var s = getSentimentFromText((it.title || '') + ' ' + (it.desc || '')); if (s === 'bull') _bBull++; else if (s === 'bear' || s === 'warn') _bBear++; });
          _seedNsh.push({ time: new Date(_hi).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }), score: Math.max(0, Math.min(100, Math.round(50 + (_bBull - _bBear) / _bkItems.length * 50))), bull: _bBull, bear: _bBear });
        }
        if (_seedNsh.length >= 2) { window._newsSentimentHistory = _seedNsh; _nsh = window._newsSentimentHistory; }
      } catch (_seedErr) {}
    }
    var _nsTime = new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
    _nsh.push({ time: _nsTime, score: ns.score, bull: ns.bullCount, bear: ns.bearCount });
    if (_nsh.length > 24) _nsh.shift(); // 최대 24포인트
    try { localStorage.setItem('aio_news_sent_hist', JSON.stringify(_nsh.slice(-24))); } catch (_nshW) {}
    // 라이브 스코어 표시
    var _nsLiveScore = document.getElementById('news-sent-live-score');
    var _nsLiveLabel = document.getElementById('news-sent-live-label');
    if (_nsLiveScore) { _nsLiveScore.textContent = ns.score; _nsLiveScore.style.color = ns.score > 55 ? '#00e5a0' : ns.score < 45 ? '#ff5b50' : '#ffa31a'; }
    if (_nsLiveLabel) _nsLiveLabel.textContent = ns.label;
    // 차트 렌더
    var _nsCanvas = document.getElementById('news-sentiment-chart');
    if (_nsCanvas && _nsh.length >= 2) {
      if (window._newsSentChart) window._newsSentChart.destroy();
      window._newsSentChart = new Chart(_nsCanvas, {
        type: 'line',
        data: {
          labels: _nsh.map(function(h) { return h.time; }),
          datasets: [{
            label: '감성 점수', data: _nsh.map(function(h) { return h.score; }),
            borderColor: '#ffa31a', backgroundColor: 'rgba(255,163,26,0.1)',
            borderWidth: 2, pointRadius: 3, pointBackgroundColor: _nsh.map(function(h) { return h.score > 55 ? '#00e5a0' : h.score < 45 ? '#ff5b50' : '#ffa31a'; }),
            fill: true, tension: 0.3
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { y: { min: 0, max: 100, grid: { color: 'var(--surface-4)' }, ticks: { color: '#a0b4c8', font: { size: 11 } } }, x: { grid: { display: false }, ticks: { color: '#a0b4c8', font: { size: 11 } } } },
          plugins: { legend: { display: false }, annotation: { annotations: { neutralLine: { type: 'line', yMin: 50, yMax: 50, borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderDash: [4,4] } } } }
        }
      });
    }

  } catch(e) { _aioLog('warn', 'render', 'News sentiment bar error: ' + (e && e.message || e)); }

  // v27.2: 뉴스 0건이면 홈 뉴스 섹션에 안내 메시지 표시
  if (allItems.length === 0) {
    const hn = document.getElementById('home-news-highlights');
    if (hn) hn.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:14px;text-align:center;color:var(--text-muted);font-size:10px;grid-column:1/-1;">현재 뉴스를 불러올 수 없습니다. <button data-action="_aioRetryNews" style="background:var(--data-cyan-soft);border:1px solid var(--border-accent-dim);color:#60a5fa;font-size:11px;padding:2px 8px;border-radius:4px;cursor:pointer;margin-left:6px;">↻ 다시 시도</button></div>';
    const pl = document.getElementById('news-progress-label');
    if (pl) pl.textContent = '뉴스 소스 연결 실패 — 새로고침하거나 잠시 후 다시 시도하세요.';
  }
  } catch(fetchErr) {
    _aioLog('error', 'fetch', 'fetchAllNews 치명적 에러: ' + (fetchErr && fetchErr.message || fetchErr));
    if (dot) { dot.style.background = '#ff5b50'; dot.style.boxShadow = '0 0 5px #f87171'; }
    if (lbl) lbl.textContent = '에러 발생 — 재시도';
    const pl = document.getElementById('news-progress-label');
    if (pl) pl.textContent = '뉴스 수집 중 에러 발생 — 새로고침 버튼을 눌러주세요.';
    _aioNotifyNewsSurfaceInvalidated('news-fetch-error');
  } finally {
    isFetching = false; // v27.3: 어떤 에러가 나도 반드시 잠금 해제
  }
}

// v34.5: 뉴스 로딩 타임아웃 — 60초로 늘리고, 이미 뉴스가 렌더된 경우 덮어쓰지 않음
setTimeout(function() {
  var hn = document.getElementById('home-news-highlights');
  if (!hn) return;
  // 이미 뉴스 카드가 렌더됐으면(점진 렌더링 성공) 건드리지 않음
  if (hn.querySelector('.news-item-card')) return;
  // 아직 "로딩 중" 상태일 때만 처리
  if (hn.innerHTML.indexOf('뉴스 로딩 중') !== -1 || hn.innerHTML.indexOf('로딩') !== -1) {
    var items = window._allNewsItems || [];
    if (items.length > 0) {
      // 부분 결과 있으면 렌더
      if (typeof renderHomeFeed === 'function') renderHomeFeed(items);
    } else {
      hn.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:14px;text-align:center;color:var(--text-muted);font-size:10px;">뉴스 수신 시간 초과 (네트워크 지연). <button data-action="_aioRetryNews" style="background:var(--data-cyan-soft);border:1px solid var(--border-accent-dim);color:#60a5fa;font-size:11px;padding:3px 9px;border-radius:4px;cursor:pointer;margin-left:6px;font-weight:600;">↻ 다시 시도</button></div>';
    }
  }
}, 60000);

// ── 필터 함수 ───────────────────────────────────────────────────

// 전체 뉴스 캐시 보관

// v48.19 (bugfix): 기존 src.includes('') 항상 true 버그 수정 → 명시적 텔레그램 판별
// 모든 필터 경로가 renderFeed로 통합되도록 currentCountryFilter='tg' 방식 전환
function filterNewsByTelegramOnly(el) {
  currentCountryFilter = 'tg';
  document.querySelectorAll('#news-country-chips .chip').forEach(c => {
    c.style.background = 'transparent';
    c.style.borderColor = 'var(--surface-5)';
    c.style.color = 'var(--text-secondary)';
  });
  if (el) {
    el.style.background = 'var(--accent-dim)';
    el.style.borderColor = 'var(--accent-border)';
    el.style.color = 'var(--accent)';
  }
  if (newsCache.length > 0) _aioNotifyNewsSurfaceInvalidated('news-country-telegram');
  else fetchAllNews();
}

function filterNewsByCountry(filter, el) {
  currentCountryFilter = filter;
  document.querySelectorAll('#news-country-chips .chip').forEach(c => {
    c.style.background = 'transparent';
    c.style.borderColor = 'var(--surface-5)';
    c.style.color = 'var(--text-secondary)';
  });
  if (el) {
    el.style.background = 'var(--accent-dim)';
    el.style.borderColor = 'var(--accent-border)';
    el.style.color = 'var(--accent)';
  }
  if (newsCache.length > 0) _aioNotifyNewsSurfaceInvalidated('news-country-filter');
  else fetchAllNews();
}

function filterNewsByTopic(filter, el) {
  currentTopicFilter = filter;
  document.querySelectorAll('#news-topic-chips .chip').forEach(c => {
    c.style.background = 'transparent';
    c.style.borderColor = 'var(--surface-5)';
    c.style.color = 'var(--text-secondary)';
  });
  if (el) {
    el.style.background = 'var(--accent-dim)';
    el.style.borderColor = 'var(--accent-border)';
    el.style.color = 'var(--accent)';
  }
  if (newsCache.length > 0) _aioNotifyNewsSurfaceInvalidated('news-topic-filter');
}


// ── 라이브 시세 엔진 ─────────────────────────────────────────────
const LIVE_SYMBOLS = [
  // ── 주요 지수 ──────────────────────────────────────────────────
  '^GSPC','^IXIC','^VIX','^VVIX','^RUT','^DJI','^FTSE','^N225','^HSI',
  'ES=F','NQ=F','YM=F','RTY=F','VXX',
  // ── 한국 지수 ──────────────────────────────────────────────────
  '^KS11','^KQ11',
  '091160.KS','305720.KS','091220.KS','244580.KS',
  // ── 한국 KR_SUB_THEMES 전수 커버 (.KS = KOSPI, .KQ = KOSDAQ 정식 분리) ──
  // 반도체/HBM — KOSPI 2 + KOSDAQ 6 + KOSPI 1
  '005930.KS','000660.KS',                                     // 삼성전자·SK하이닉스 (KOSPI)
  '042700.KQ','403870.KQ','058470.KQ','357780.KQ','240810.KQ','039030.KQ','272290.KQ',  // 반도체 소부장 (KOSDAQ)
  // 로봇/자동화 — 두산로보틱스(KOSPI) + 현대로템(KOSPI) + KOSDAQ 4
  '454910.KS','064350.KS',
  '277810.KQ','108490.KQ','090360.KQ','388720.KQ','090710.KQ',
  // AI/SW — KOSPI 4 + KOSDAQ 2
  '035420.KS','018260.KS','012510.KS','035720.KS',
  '030520.KQ','304100.KQ',
  // 의료기기/AI진단 — 전원 KOSDAQ
  '214150.KQ','328130.KQ','338220.KQ','322510.KQ','049950.KQ','145720.KQ',
  // 조선/해양 — 전원 KOSPI
  '009540.KS','010140.KS','329180.KS','042660.KS','010620.KS',
  // 전력기기/변압기 — KOSPI 5 + KOSDAQ 1(제룡전기)
  '298040.KS','267260.KS','010120.KS','062040.KS','103590.KS',
  '033100.KQ',
  // 원전/SMR — KOSPI 2 + KOSDAQ 3
  '034020.KS','052690.KS',
  '006910.KQ','032820.KQ','083650.KQ',
  // K-뷰티 — KOSPI 3 + KOSDAQ 3
  '090430.KS','192820.KS','051900.KS',
  '278470.KQ','257720.KQ','237880.KQ',
  // K-푸드 — 전원 KOSPI
  '003230.KS','097950.KS','271560.KS','004370.KS','280360.KS',
  // 금융/밸류업 — 전원 KOSPI
  '105560.KS','055550.KS','086790.KS','316140.KS','138040.KS','032830.KS','006800.KS',
  // 자동차/SDV — 전원 KOSPI
  '005380.KS','000270.KS','012330.KS','204320.KS','161390.KS',
  // 바이오/제약 — KOSPI 5 + KOSDAQ 2(알테오젠·리가켐)
  '207940.KS','068270.KS','000100.KS','326030.KS','128940.KS',
  '196170.KQ','141080.KQ',
  // 방산/항공우주 — 전원 KOSPI
  '012450.KS','047810.KS','272210.KS','079550.KS','103140.KS',
  // 에너지/정유 — KOSPI 3 + KOSDAQ 1(흥구석유)
  '010950.KS','096770.KS','078930.KS',
  '024060.KQ',
  // 2차전지 — KOSPI 4 + KOSDAQ 3(에코프로비엠·엘앤에프·에코프로)
  '373220.KS','006400.KS','051910.KS','005490.KS','003670.KS',
  '247540.KQ','066970.KQ','086520.KQ',
  // K-엔터/콘텐츠 — KOSPI 1(하이브) + KOSDAQ 5
  '352820.KS',
  '041510.KQ','035900.KQ','122870.KQ','035760.KQ','253450.KQ',
  // 게임 — KOSPI 3 + KOSDAQ 3
  '259960.KS','036570.KS','251270.KS',
  '293490.KQ','263750.KQ','112040.KQ',
  // 드론/UAM — KOSPI 1(퍼스텍, 나머지는 방산 중복)
  '010820.KS',
  // 리츠/부동산 — KOSPI 5 + KOSDAQ 1(에이리츠)
  '293940.KS','357430.KS','365550.KS','330590.KS','448730.KS',
  '140910.KQ',
  // 건설/인프라 — 전원 KOSPI
  '000720.KS','375500.KS','028260.KS','006360.KS','047040.KS',
  // 여행/항공 — 전원 KOSPI (호텔신라·진에어, 아시아나/한온 제거)
  '003490.KS','008770.KS','089590.KS','272450.KS','039130.KS',
  // ── 채권 금리 ──────────────────────────────────────────────────
  '^IRX','^FVX','^TNX','^TYX',
  // v48.58: VIX 기간구조 (sentiment 페이지 요약)
  '^VIX9D','^VIX3M','^VIX6M','^SKEW',
  // v50.5: 채권변동성 MOVE 자동 fetch (Yahoo ^MOVE 응답 확인 — 기존 정적 → live)
  '^MOVE',
  // ── 외환 ────────────────────────────────────────────────────────
  'KRW=X','JPY=X','EURUSD=X','GBPUSD=X','CNY=X','AUDUSD=X',
  'DX-Y.NYB',
  // ── 원자재 ──────────────────────────────────────────────────────
  'CL=F','BZ=F','GC=F','NG=F','SI=F','HG=F','PL=F','PA=F',
  'ZC=F','ZW=F',
  // ── 크립토 ──────────────────────────────────────────────────────
  'BTC-USD','ETH-USD','SOL-USD','BNB-USD',
  // ── 대형주·AI·반도체 ─────────────────────────────────────────────
  'NVDA','AAPL','TSLA','MSFT','AMZN','GOOGL','META','AMD','AVGO','TSM',
  'MU','ARM','INTC','QCOM','ASML','SMCI','PLTR','CRWD','PANW','CRM',
  'LMT','RTX','NOC','GD','HII',                 // 방산
  'XOM','CVX','COP','OXY','SLB',                // 에너지
  'JPM','GS','MS','BLK','WFC',                   // 금융
  'LLY','JNJ','MRK','PFE','ABBV',               // 헬스케어
  'RKLB','ASTS','HOOD','COIN','MARA',            // 성장·크립토
  // ── 섹터 ETF (GICS 11 + 서브섹터) ──────────────────────────────────
  'XLK','XLF','XLE','XLV','XLI','XLY','XLP','XLRE','XLB','XLU','XLC',
  'ITA','OIH','IGV','SOXX','ARKK','HACK','GDX','SMH','XBI','URA',
  'AMLP','XOP','JETS','IBB','XHB','ITB','CIBR','BOTZ','ICLN','TAN',
  'LIT','KWEB','EWZ','EWJ','EFA','EEM','VNQ',
  // ── 테마 리더 티커 (주도주/대장주) ──────────────────────────────────
  'NET','DDOG','SNOW','ZS','FTNT','NOW','ADBE','ORCL',       // SW/Cloud
  'DELL','HPE','NTAP','STX','WDC',                            // Storage/HW
  'KO','PEP','COST','PG','MCD','CL','MNST',                   // Staples leaders
  'DUK','NEE','CEG','AEP','EXC',                              // Utilities leaders
  'VRTX','REGN','GILD','MRNA','BIIB',                         // Biotech leaders
  'CAT','HON','UNP','FDX','UPS','WAB',                        // Industrials leaders
  'PLD','O','SPG','VTR','EQIX',                               // REIT leaders
  'KMI','WMB','TRGP','DVN','FANG','BKR','HAL',               // Energy leaders
  'HWM','LHX','TXT',                                          // Defense extra
  'LITE','COHR','CIEN','AAOI','GLW',                          // Photonics (no ETF)
  'BRK-B','MA','UNH','HD','PG','ABBV',                  // DOW30 + Large cap
  'NFLX','PEP','KO','MCD','T','NEE',                    // Consumer + Utilities
  'ADBE','ORCL','CSCO','IBM','INTU',                     // Enterprise SW
  'BAC','WFC','MS','BLK','AXP','SPGI',                  // Financials
  'TMO','ISRG','VRTX','REGN','GILD','AMGN',             // Healthcare/Biotech
  'ASML','AMAT','LRCX','KLAC','SNPS','CDNS','MRVL',     // Semis equipment+design
  'LOW','SBUX','DIS','BA','NKE','VZ',                    // Consumer + DOW30
  'NOC','GD','HII','GE','HON','MMM',                     // Industrials + Defense
  'LIN','COP','DOW','TRV',                               // Materials + Insurance
  'UBER','MELI','DDOG','SNOW','ZS','TTD','FTNT','SMCI', // Growth SaaS
  'SOFI','AFRM','UPST','JOBY','CAVA','SOUN',            // Small cap growth
  'RGTI','QUBT','LUNR','RDW','DNA','IREN','DM',         // Russell 2000
  'CCJ','SMR','VST','NRG',                                    // Nuclear/Uranium
  'MSTR','RIOT',                                               // Crypto extra
  // ── HOT/Trending 종목 (소형·중형 성장주) ──────────────────────────
  'HIMS','AEHR','RDDT','PINS','SNAP','RBLX','SPOT',            // Social/Consumer
  'TEM','AI','PATH','CFLT','CRSP',                              // AI SW / Biotech
  'MDB','GTLB','ESTC','WDAY','MNDY',                           // Cloud/SaaS
  'SQ','OKLO','TLN',                                            // Fintech/Nuclear
  'RIVN','LCID','GM','F',                                       // Auto/EV
  'EA','TTWO','DECK','CELH','ONON',                             // Gaming/Consumer
  'URI','NUE',                                                   // Industrial/Mining
  'SHOP','ABNB','DASH','ROKU','DUOL',                           // E-commerce/Streaming
  'APP','AXON','TOST','GRAB','SE',                              // Tech/Platforms
  'GME','AMC','IWM','DIA',                                      // Meme/Index ETF
  // ── 채권·크레딧·안전자산 ETF ──────────────────────────────────────
  'SPY','RSP','QQQ','GLD','SLV','TLT','IEF','SHY','HYG','LQD','EMB',
  // ── 변동성·크레딧 모니터 ─────────────────────────────────────────
  'UVXY','SQQQ','SH',
  // ── Top 200 시총 확장 종목 ──
  'ABT','ADI','ADP','AFL','AIG','AON','APH','AZO','BK','BMY','BSX','CARR','CI','CME','CMG','CNC','COF','CTAS','CTSH','DD','DE','DHR','EBAY','ECL','EFX','EOG','FI','GPN','HCA','HUBB','HUM','ICE','IDXX','IQV','KEYS','KHC','MAR','MCK','MCO','MDLZ','MET','MMC','MSCI','MSI','NXPI','ORLY','OTIS','PAYX','PGR','PRU','PSA','RMD','ROP','SCHW','SHW','SRE','STE','STZ','SYK','TDG','TGT','TJX','TROW','VRSK','WEC','WELL','WM','YUM',
  // ── KR_SUB_THEMES·SUB_THEMES Critical 수정 반영 신규 종목 ──
  '000660.KS','005930.KS',                                    // 한국 메모리 KRX 보통주 (SK하이닉스/삼성전자)
  'SNDK',                                                      // SanDisk (WDC 분사 재상장)
  'IRDM','NXT','ARRY','SHLS',                                 // 위성/트래커/인버터
  'NNE','LEU','SMR','OKLO','BWXT','CEG','VST',                // 원전/SMR
  'SYM','MOD','NVT',                                           // 물류자동화/냉각/전력부품
  'ALNY','CRSP',                                               // Biotech 유전자편집
  'FBTC','ARKB','BITB','HODL','IBIT','BITO',                  // BTC 현물 ETF
  'FLNC','BE','PLUG','FCEL',                                  // 수소/ESS
  'NU','XYZ','HOOD','SOFI','AFRM','PYPL','MSTR','COIN',       // 핀테크/크립토
  'DRIV','IYZ','ICLN','URA','HACK','BOTZ','SMH','SOXX','XSD','XBI',  // ETF (v49.47 P315: XSD 추가 — theme-detail 페이지 placeholder)
  'FSLR','ENPH','RUN','SEDG',                                 // 태양광
  'TSM','UMC','GFS','INTC',                                    // 파운드리
  'ASML','AMAT','LRCX','KLAC','TER','ONTO','CDNS','SNPS',      // 반도체 장비/EDA
  'VRTX','REGN','AMGN','GILD','MRNA','BIIB',                  // Biotech leaders
  'LITE','COHR','CIEN','AAOI','GLW','VIAV','ANET','POET',      // Photonics
  'ALAB','CRDO','CSCO',                                        // DC Network
  'VRT','ETN','EME','CLS','HPE',                              // DC Infra
  'IREN','CRWV','NBIS','CIFR','WULF','CLSK',                  // Neocloud
  'CRM','NOW','ADBE','INTU','WDAY','DDOG','SNOW','MDB','TTD',  // SaaS/AI Platform
  'NET','S','CYBR',                                            // Cybersec extra
  'XOM','CVX','COP','VLO','MPC','PSX','DVN','FANG','TPL','EOG','OXY',  // Oil major
  'SLB','HAL','BKR','FTI','NOV','WHD',                        // Oil service
  'WMB','TRGP','ET','KMI','EPD','OKE',                        // MLP
  'DUK','AEP','EXC','ETR','ES','FE','EVRG','XEL','EIX','NEE',  // Utilities
  'JPM','GS','MS','BAC','WFC','C',                             // Big bank
  'BX','KKR','APO','BLK',                                      // Asset mgmt
  'BRK-B','PGR','ALL','MET','TRV','CB',                        // Insurance
  'LLY','JNJ','MRK','ABBV','PFE','BMY','AZN','NVO','VKTX',     // Pharma/GLP-1
  'ABT','ISRG','BSX','SYK','MDT','EW','GEHC',                 // Medtech
  'RTX','LMT','GD','GE','NOC','LHX','HWM','HII','LDOS',        // Defense (PLTR 제외됨)
  'RKLB','ASTS','LUNR','PL','RDW','BA',                        // Space
  'CAT','HON','UNP','FDX','UPS','WAB','PH','EMR',              // Industrial
  'ISRG','ROK','TER','EMR','TSLA','FANUY',                     // Robotics
  'IONQ','RGTI','QUBT','QBTS','GOOGL','IBM',                   // Quantum
  'AMZN','SHOP','WMT','COST','SHOP','CPNG','TGT','EBAY',       // Ecommerce
  'PG','KO','PEP','MCD','NKE','SBUX','LULU','MNST','DG',       // Consumer brand
  'TSLA','RIVN','GM','F','LCID','MBLY','APTV','ON',            // EV/Auto
  'BKNG','ABNB','MAR','HLT','DAL','UAL','LUV','CCL','RCL',     // Travel
  'UBER','DASH','LYFT','SE','GRAB','TOST','CPNG',              // Delivery
  'NFLX','DIS','WBD','SPOT','ROKU','PSKY',                     // Streaming
  'META','GOOGL','TTD','APP','SNAP','PINS','RDDT',             // Social ad
  'EA','TTWO','RBLX','NTDOY',                                   // Gaming (DKNG은 sports_betting)
  'DKNG','FLUT','MGM','PENN','CZR','WYNN',                      // Sports Betting/Casino
  'VLO','MPC','PSX','DINO','DK',                                // Oil Refining
  'T','VZ','TMUS',                                              // Telecom
  'EQIX','DLR','AMT','CCI','SBAC',                             // REITs
  'AEM','NEM','GOLD','WPM','FNV','GFI','KGC',                 // Gold mining
  'FCX','LIN','APD','AA','MP','LAC','ALB','CTVA','ADM',        // Materials
  // ── v48.53: Themes/SUB_THEMES 전수 커버리지 누락 13종 보충 ──
  'ROBO','WCLD','BUG','VIG','DGRO','SCHD',                    // 테마 ETF (aio-explain 언급 + renderAllEtfGrid 대상)
  'ACLS','AVAV','CRAK','ENTG','GEV','KTOS','UCTT'             // SUB_THEMES 개별 종목 (반도체 장비/방산/정유/전력)
];
// v49.49 P319/R101 buf fix: LIVE_SYMBOLS를 window.LIVE_SYMBOLS로 노출 — R101 getLiveSymbolsCoverageAudit이 const top-level 변수에 접근 못해 R101_total: 0 보고 (false positive 131 미등록). top-level const는 module scope이므로 window property 아님 — 명시 노출.
window.LIVE_SYMBOLS = LIVE_SYMBOLS;

// ── Global fetch helper (레거시 — AbortController 미사용, 새 코드는 fetchWithTimeout 권장) ──
function withTimeout(p, ms) {
  return Promise.race([
    p,
    new Promise(function(_, rej) { setTimeout(function(){ rej(new Error('timeout')); }, ms); })
  ]);
}

// ═══ v36: 네이버 파이낸스 — 한국 시장 1차 데이터 소스 ═══════════════════
// 네이버 API → CORS 프록시 → Yahoo-compatible 포맷 변환
// 지수(KOSPI/KOSDAQ) + 전 종목(KR_STOCK_DB) 일괄 fetch
async function fetchKrNaverQuotes() {
  var results = [];
  var _startTs = Date.now();

  // ── 1. 지수 데이터 (KOSPI, KOSDAQ) ──
  var indexMap = [
    { naver: 'KOSPI', yahoo: '^KS11' },
    { naver: 'KOSDAQ', yahoo: '^KQ11' }
  ];

  await Promise.allSettled(indexMap.map(async function(idx) {
    var url = 'https://m.stock.naver.com/api/index/' + idx.naver + '/basic';
    try {
      var r = await fetchViaProxy(url, 8000);
      if (!r.ok) return;
      var raw = await r.json();
      var data = raw;
      if (raw.contents) try { data = JSON.parse(raw.contents); } catch(e) { return; }

      // m.stock API 응답: closePrice, compareToPreviousClosePrice, fluctuationsRatio
      var price = parseFloat(String(data.closePrice || data.now || '0').replace(/,/g, ''));
      var chgPct = parseFloat(String(data.fluctuationsRatio || data.cr || '0').replace(/,/g, ''));
      var chgVal = parseFloat(String(data.compareToPreviousClosePrice || data.cv || '0').replace(/,/g, ''));

      if (price > 0) {
        // FABLE-LIVE-AUDIT-2026-07-07 C5/L2-2: Naver의 compareToPreviousClosePrice(부호 포함, 원 단위)로
        // 전일종가를 직접 역산해 첨부. Yahoo ^KS11/^KQ11의 chartPreviousClose는 미국 휴장일 인접 주간에
        // 한 세션 어긋난 값을 돌려주는 경우가 실측됐음(예: 7/3 종가를 7/6 전일종가로 반환) — KR 지수는
        // KRX 소스(Naver)가 항상 정확하므로 이 값을 우선 사용해야 함(아래 병합부에서 sticky 처리).
        var _prevClose = isFinite(chgVal) ? (price - chgVal) : null;
        results.push({
          symbol: idx.yahoo,
          regularMarketPrice: price,
          regularMarketChangePercent: chgPct,
          regularMarketChange: chgVal,
          regularMarketPreviousClose: (_prevClose > 0 ? _prevClose : undefined),
          _source: 'live:naver'
        });
      }
    } catch(e) { _aioLog('warn', 'fetch', 'KR-Naver 지수 ' + idx.naver + ' 실패: ' + e.message); }
  }));

  // ── 2. 전 종목 가격 (배치 요청) ──
  var allCodes = (typeof KR_STOCK_DB !== 'undefined') ? Object.keys(KR_STOCK_DB) : [];
  var BATCH_SIZE = 20; // polling API 배치 크기

  for (var bi = 0; bi < allCodes.length; bi += BATCH_SIZE) {
    var batch = allCodes.slice(bi, bi + BATCH_SIZE);
    var codeStr = batch.join(',');
    var batchOk = false;

    // polling API (배치 지원) 먼저 시도
    var batchUrl = 'https://polling.finance.naver.com/api/realtime/domestic/stock/' + codeStr;
    try {
      var r = await fetchViaProxy(batchUrl, 10000);
      if (r.ok) {
        var raw = await r.json();
        var data = raw;
        if (raw.contents) try { data = JSON.parse(raw.contents); } catch(e) {}

        // polling API 응답 파싱 (다중 포맷 지원)
        var datas = null;
        if (data.result && data.result.areas && data.result.areas[0]) {
          datas = data.result.areas[0].datas;
        } else if (data.datas) {
          datas = data.datas;
        } else if (Array.isArray(data)) {
          datas = data;
        }

        if (datas && datas.length > 0) {
          datas.forEach(function(d) {
            var code = d.cd || d.symbolCode || '';
            var price = parseFloat(String(d.nv || d.closePrice || '0').replace(/,/g, ''));
            var chgPct = parseFloat(String(d.cr || d.fluctuationsRatio || '0').replace(/,/g, ''));
            var chgVal = parseFloat(String(d.cv || d.compareToPreviousClosePrice || '0').replace(/,/g, ''));

            // v46.4: 가격/등락률 유효성 검증
            if (!isFinite(price)) price = 0;
            if (!isFinite(chgPct) || Math.abs(chgPct) > 30) chgPct = null; // 한국 상한가 ±30%
            if (!isFinite(chgVal)) chgVal = 0;

            if (code && price > 0) {
              var yahooSym = krTickerToYahoo(code);
              results.push({
                symbol: yahooSym,
                regularMarketPrice: price,
                regularMarketChangePercent: chgPct,
                regularMarketChange: chgVal,
                _source: 'live:naver'
              });
            }
          });
          batchOk = true;
        }
      }
    } catch(e) { /* polling batch 실패 — m.stock 개별 폴백 */ }

    // 배치 실패 시 m.stock 개별 요청 폴백 (v46.3: 5→10개로 확대, 가중치 높은 종목 우선)
    if (!batchOk) {
      var fallbackBatch = batch.slice(0, 10);
      await Promise.allSettled(fallbackBatch.map(async function(code) {
        var url = 'https://m.stock.naver.com/api/stock/' + code + '/basic';
        try {
          var r = await fetchViaProxy(url, 6000);
          if (!r.ok) return;
          var raw = await r.json();
          var data = raw;
          if (raw.contents) try { data = JSON.parse(raw.contents); } catch(e) { return; }

          var price = parseFloat(String(data.closePrice || data.now || '0').replace(/,/g, ''));
          var chgPct = parseFloat(String(data.fluctuationsRatio || data.cr || '0').replace(/,/g, ''));
          var chgVal = parseFloat(String(data.compareToPreviousClosePrice || data.cv || '0').replace(/,/g, ''));

          if (price > 0) {
            results.push({
              symbol: krTickerToYahoo(code),
              regularMarketPrice: price,
              regularMarketChangePercent: chgPct,
              regularMarketChange: chgVal,
              _source: 'live:naver-fb'
            });
            // v35.7: 시가총액 동적 추출
            if (typeof _enrichMarketCap === 'function') _enrichMarketCap(code, data);
          }
        } catch(e) {}
      }));
    }
  }

  // ── 3차/4차 폴백: api.finance.naver.com / fchart.stock.naver.com (v46.3) ──
  // 1차(배치)+2차(개별) 완료 후 아직 데이터 없는 종목에 대해 siseJson 엔드포인트 시도
  var allCodesFlat = [];
  function _aioCollectKrCodes(src) {
    if (!src) return;
    if (Array.isArray(src)) {
      src.forEach(_aioCollectKrCodes);
      return;
    }
    if (typeof src === 'object') {
      if (src.code) allCodesFlat.push(src.code);
      else if (src.symbol && /^[0-9]{6}$/.test(String(src.symbol))) allCodesFlat.push(src.symbol);
      else Object.keys(src).forEach(function(k) {
        // v49.96 P460: KR_STOCK_DB는 코드가 KEY ('103140': {name,price,...})이고 값엔 .code/.symbol 없음.
        // 이전엔 값만 재귀해 6자리 KEY를 놓쳐 0개 추출 → siseJson 최종 폴백 tier 무력화. 키가 6자리 코드면 직접 수집.
        if (/^[0-9]{6}$/.test(k)) allCodesFlat.push(k);
        _aioCollectKrCodes(src[k]);
      });
    }
  }
  if (typeof KR_STOCK_DB !== 'undefined') {
    _aioCollectKrCodes(KR_STOCK_DB);
  }
  if (!allCodesFlat.length && window.AIO && window.AIO.recordDataQualityIssue) {
    window.AIO.recordDataQualityIssue({ source: 'kr-stock-db', severity: 'warn', message: 'KR_STOCK_DB code extraction returned 0 codes' });
  }
  var gotSyms = {};
  results.forEach(function(r) { gotSyms[r.symbol] = true; });
  var missing = allCodesFlat.filter(function(c) { return !gotSyms[krTickerToYahoo(c)]; });

  if (missing.length > 0) {
    var today = new Date();
    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 2); // 주말 대비 2일 전
    var fmt = function(d) { return d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0'); };
    var startD = fmt(yesterday), endD = fmt(today);

    var siseEndpoints = [
      {url: 'https://api.finance.naver.com/siseJson.naver', tag: 'live:naver-sise'},
      {url: 'https://fchart.stock.naver.com/siseJson.nhn', tag: 'live:naver-fchart'}
    ];

    // 가중치 상위 20개만 (API 부하 최소화)
    var topMissing = missing.slice(0, 20);

    for (var epIdx = 0; epIdx < siseEndpoints.length; epIdx++) {
      if (topMissing.length === 0) break;
      var ep = siseEndpoints[epIdx];
      var siseResults = [];

      await Promise.allSettled(topMissing.map(async function(code) {
        var sUrl = ep.url + '?symbol=' + code + '&requestType=1&startTime=' + startD + '&endTime=' + endD + '&timeframe=day';
        try {
          // 직접 fetch 시도 (CORS 허용 가능), 실패 시 프록시
          var r;
          try { r = await fetchWithTimeout(sUrl, {}, 5000); } catch(e) { r = await fetchViaProxy(sUrl, 6000); }
          if (!r.ok) return;
          var text = typeof r.text === 'function' ? await r.text() : '';
          if (typeof r.json === 'function' && !text) { var j = await r.json(); text = JSON.stringify(j); }
          // 파싱: ["YYYYMMDD", 시가, 고가, 저가, 종가, 거래량, 외국인소진율]
          var rows = [];
          var rx = /\["(\d{8})",\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\]/g;
          var m;
          while ((m = rx.exec(text)) !== null) {
            rows.push({ date: m[1], open: +m[2], high: +m[3], low: +m[4], close: +m[5], vol: +m[6] });
          }
          if (rows.length === 0) return;
          // v46.4: 파싱 결과 검증 — 가격 유효성 + 범위
          rows = rows.filter(function(r) { return r.close > 0 && isFinite(r.close) && r.open > 0; });
          if (rows.length === 0) return;
          var latest = rows[rows.length - 1];
          var prev = rows.length >= 2 ? rows[rows.length - 2] : null;
          var price = latest.close;
          var pct = prev && prev.close > 0 ? ((price - prev.close) / prev.close * 100) : null;
          // pct 범위 검증: ±30% 이상은 데이터 오류 가능 (한국 상한가 ±30%)
          if (pct != null && (!isFinite(pct) || Math.abs(pct) > 30)) pct = null;

          if (price > 0 && isFinite(price)) {
            siseResults.push({
              symbol: krTickerToYahoo(code),
              regularMarketPrice: price,
              regularMarketChangePercent: pct != null ? +pct.toFixed(2) : null,
              regularMarketChange: prev ? (price - prev.close) : null,
              _source: ep.tag
            });
          }
        } catch(e) {}
      }));

      if (siseResults.length > 0) {
        results.push.apply(results, siseResults);
        console.log('[KR-sise] ' + ep.tag + ' 폴백:', siseResults.length + '개 추가');
        // 성공 종목 제거
        var gotNow = {};
        siseResults.forEach(function(r) { gotNow[r.symbol] = true; });
        topMissing = topMissing.filter(function(c) { return !gotNow[krTickerToYahoo(c)]; });
      }
    }
  }

  var elapsed = Date.now() - _startTs;
  console.log('[KR-Naver] 네이버 파이낸스 완료:', results.length + '개 (' + elapsed + 'ms)');
  return results;
}

// v52.13 P610/B7: TradingView KRX 위젯 하드 브레이크(FABLE-LIVE-AUDIT-2026-07-04.md P3) 대체용 —
// Naver fchart 일봉 OHLCV 시리즈 직접 fetch(자체 캔들 차트 렌더용). 파싱 정규식은 위 fetchKrNaverQuotes()의
// siseJson 폴백 파서와 동일 패턴 재사용(이미 이 코드베이스에서 검증된 방식 — eval/Function 없이 안전 추출).
async function fetchKrDailyCandles(code, count) {
  code = String(code || '').replace(/\.(KS|KQ)$/i, '').trim();
  count = count || 120;
  if (!/^[0-9]{6}$/.test(code)) return null;
  var url = 'https://fchart.stock.naver.com/siseJson.nhn?symbol=' + code + '&timeframe=day&count=' + count + '&requestType=0';
  try {
    var r;
    try { r = await fetchWithTimeout(url, {}, 6000); } catch (e) { r = await fetchViaProxy(url, 8000); }
    if (!r || !r.ok) return null;
    var text = typeof r.text === 'function' ? await r.text() : '';
    if (typeof r.json === 'function' && !text) { var j = await r.json(); text = JSON.stringify(j); }
    var rows = [];
    var rx = /\["(\d{8})",\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\]/g;
    var m;
    while ((m = rx.exec(text)) !== null) {
      var d = m[1];
      rows.push({
        date: d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8),
        open: +m[2], high: +m[3], low: +m[4], close: +m[5], volume: +m[6]
      });
    }
    rows = rows.filter(function(row) { return row.close > 0 && row.open > 0 && isFinite(row.close); });
    return rows.length ? rows : null; // Naver 응답은 이미 날짜 오름차순
  } catch (e) {
    _aioLog('warn', 'fetch', 'KR 일봉 캔들 fetch 실패(' + code + '): ' + e.message);
    return null;
  }
}
window.fetchKrDailyCandles = fetchKrDailyCandles;

// v51.08: krDynamic 스케줄러가 참조하는 통합 KR 동적 데이터 갱신 함수
// v52.7 P605/R280: 이 선언이 index.html 인라인 스크립트의 동명 함수(VKOSPI 포함 6종 fetch)를
// defer 로드 순서상 항상 덮어써 왔음 — VKOSPI 실시간 fetch가 영구 미실행이었던 근본원인.
// fetchVkospiDynamic만 최소 복구(다른 5종은 정확성 미검증 상태로 범위 밖에 남김 — BUG-POSTMORTEM P605 참조).
// v53.9 P728: KR 전용 페이지 퇴역 후 개별 종목 투자자 TOP10 sink도 사라졌다.
// 최대 24개 Naver 요청만 남은 fetchKrInvestorTop10은 공유 KR 로더에서 제거한다.
async function fetchKrDynamicData() {
  const results = await Promise.allSettled([
    typeof fetchAllBokData === 'function' ? fetchAllBokData() : Promise.resolve(null),
    typeof fetchAllKosisData === 'function' ? fetchAllKosisData() : Promise.resolve(null),
    typeof fetchKrNaverQuotes === 'function' ? fetchKrNaverQuotes() : Promise.resolve(null),
    typeof fetchVkospiDynamic === 'function' ? fetchVkospiDynamic() : Promise.resolve(null)
  ]);
  return results;
}

async function fetchLiveQuotes(requestedSymbols) {
  if (window._aioQuoteInFlight) return;
  window._aioQuoteInFlight = true;
  try {
  // ═══════════════════════════════════════════════════════════
  // v19: 소스별 전용 API 사용 — 단순하고 확실하게 작동
  // ═══════════════════════════════════════════════════════════

  const allQuotes = [];
  const _requestedQuoteSyms = Array.from(new Set([].concat(
    Array.isArray(requestedSymbols) ? requestedSymbols : [],
    Array.isArray(window._aioQuoteRequestSymbols) ? window._aioQuoteRequestSymbols : []
  ).map(function(sym) { return String(sym || '').trim().toUpperCase(); }).filter(Boolean)));

  // ─── 1. 암호화폐: CoinGecko (완전 무료) → CF Worker 프록시 폴백 ────
  // v48.2: include_market_cap + include_24hr_vol 추가 — 거래량 스파이크 감지 + BTC 도미넌스 판단 가능
  try {
    const cgUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true&include_last_updated_at=true';
    let d = null;
    // 직접 시도
    try {
      const r = await fetchWithTimeout(cgUrl, {}, 6000);
      if (r.ok) d = await r.json();
    } catch(e1) { /* CoinGecko 직접 접근 실패 — 프록시로 폴백 */ }
    // 실패 시 CF Worker 프록시로 재시도
    if (!d) {
      const cfW = _getApiKey('aio_cf_worker_url') || '';
      if (cfW) {
        try {
          const r2 = await fetchWithTimeout(cfW + '?url=' + encodeURIComponent(cgUrl), {}, 8000);
          if (r2.ok) {
            const text = await r2.text();
            d = JSON.parse(text.trim());
          }
        } catch(e2) { _aioLog('warn', 'fetch', 'CoinGecko CF 프록시도 실패: ' + e2.message); }
      }
    }
    if (d) {
      const cgMap = {bitcoin:'BTC-USD', ethereum:'ETH-USD', solana:'SOL-USD', binancecoin:'BNB-USD'};
      for (const [cgId, sym] of Object.entries(cgMap)) {
        if (d[cgId]) {
          allQuotes.push({
            symbol: sym,
            regularMarketPrice: d[cgId].usd,
            regularMarketChangePercent: d[cgId].usd_24h_change != null ? d[cgId].usd_24h_change : null,
            regularMarketChange: null,
            // v48.2: 확장 필드 — 시총 + 24h 거래량 + 최종 갱신 시각 (거래량 스파이크 감지/도미넌스 계산용)
            marketCap: d[cgId].usd_market_cap != null ? d[cgId].usd_market_cap : null,
            volume24h: d[cgId].usd_24h_vol != null ? d[cgId].usd_24h_vol : null,
            cgLastUpdated: d[cgId].last_updated_at || null,
            _source: 'live:coingecko',
          });
        }
      }
      // v48.2: BTC 도미넌스 근사치 계산 — Top 4 중 BTC 시총 / 합계 (정확한 도미넌스는 /global 필요하나 근사치로 대용)
      try {
        var _mcBTC = d.bitcoin && d.bitcoin.usd_market_cap;
        var _mcTotal4 = (d.bitcoin && d.bitcoin.usd_market_cap || 0) + (d.ethereum && d.ethereum.usd_market_cap || 0) + (d.solana && d.solana.usd_market_cap || 0) + (d.binancecoin && d.binancecoin.usd_market_cap || 0);
        if (_mcBTC && _mcTotal4) window._btcDominanceTop4 = (_mcBTC / _mcTotal4) * 100;
      } catch(e) {}
      console.log('[AIO] CoinGecko 크립토 갱신:', Object.keys(d).length, '개');
    }
  } catch(e) { _aioLog('warn', 'fetch', 'CoinGecko 실패: ' + e.message); }

  // v48.4: CoinGecko /global (정확한 BTC 도미넌스) + /coins/markets (상위 20 코인) — 무료 티어 확장
  // /simple/price가 끝나고 비동기 병렬 호출. 실패해도 기본 4종 시세에 영향 없음.
  try {
    const cfW = _getApiKey('aio_cf_worker_url') || '';
    const _cgDirect = async function(url, ms) {
      try { const r = await fetchWithTimeout(url, {}, ms); if (r.ok) return await r.json(); } catch(e) {}
      if (cfW) {
        try {
          const r2 = await fetchWithTimeout(cfW + '?url=' + encodeURIComponent(url), {}, ms + 2000);
          if (r2.ok) { const t = await r2.text(); return JSON.parse(t.trim()); }
        } catch(e2) {}
      }
      return null;
    };
    const [globalD, marketsD] = await Promise.allSettled([
      _cgDirect('https://api.coingecko.com/api/v3/global', 6000),
      _cgDirect('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h,7d', 8000)
    ]);
    // /global — 정확한 BTC/ETH 도미넌스 + 전체 시총/거래량 + 24h 변동
    if (globalD.status === 'fulfilled' && globalD.value && globalD.value.data) {
      const g = globalD.value.data;
      window._cgGlobal = {
        totalMarketCapUSD: (g.total_market_cap && g.total_market_cap.usd) || null,
        totalVolume24hUSD: (g.total_volume && g.total_volume.usd) || null,
        btcDominance: (g.market_cap_percentage && g.market_cap_percentage.btc) || null,
        ethDominance: (g.market_cap_percentage && g.market_cap_percentage.eth) || null,
        activeCryptocurrencies: g.active_cryptocurrencies || null,
        markets: g.markets || null,
        mcapChange24hPct: g.market_cap_change_percentage_24h_usd != null ? g.market_cap_change_percentage_24h_usd : null,
        _updated: Date.now()
      };
      console.log('[AIO] CoinGecko /global: BTC ' + (window._cgGlobal.btcDominance||0).toFixed(1) + '% 도미넌스 · 시총 $' + ((window._cgGlobal.totalMarketCapUSD||0)/1e12).toFixed(2) + 'T');
    }
    // /coins/markets — 상위 20 코인 상세
    if (marketsD.status === 'fulfilled' && Array.isArray(marketsD.value)) {
      window._cgMarkets = marketsD.value.map(function(c) {
        return {
          id: c.id,
          symbol: (c.symbol || '').toUpperCase(),
          name: c.name,
          price: c.current_price,
          mcap: c.market_cap,
          mcapRank: c.market_cap_rank,
          volume24h: c.total_volume,
          high24h: c.high_24h,
          low24h: c.low_24h,
          chg24hPct: c.price_change_percentage_24h,
          chg7dPct: c.price_change_percentage_7d_in_currency != null ? c.price_change_percentage_7d_in_currency : null,
          ath: c.ath,
          athChgPct: c.ath_change_percentage,
          circulatingSupply: c.circulating_supply,
          image: c.image || null
        };
      });
      window._cgMarkets._updated = Date.now();
      console.log('[AIO] CoinGecko /coins/markets: 상위 ' + window._cgMarkets.length + '개 코인 수집');
    }
  } catch(e) { _aioLog('warn', 'fetch', 'CoinGecko /global·/coins/markets 실패: ' + e.message); }

  // ─── 2. 환율: 다중 API 폴백 체인 (v30.11: 전일 대비 변동률 계산) ───
  // v46.9: CAD/CHF → Yahoo 표준 심볼 수정 (CADUSD=X 비표준 → CAD=X)
  const fxMap = {KRW:'KRW=X', JPY:'JPY=X', EUR:'EURUSD=X', GBP:'GBPUSD=X', CNY:'CNY=X', AUD:'AUDUSD=X', CAD:'CAD=X', CHF:'CHF=X'};
  const FX_INVERTED = ['EURUSD=X','GBPUSD=X','AUDUSD=X']; // USD 기준 역수 통화 (CAD=X, CHF=X는 USD/CAD, USD/CHF로 역수 불필요)

  // v30.11: 전일 종가 저장소 — localStorage에 일단위 캐시
  if (!window._fxPrevClose) {
    try {
      const stored = localStorage.getItem('aio_fx_prev_close');
      if (stored) {
        const parsed = JSON.parse(stored);
        // 24h 이내 데이터만 사용
        if (parsed._ts && Date.now() - parsed._ts < 48 * 3600000) {
          window._fxPrevClose = parsed;
        } else {
          window._fxPrevClose = {};
        }
      } else {
        window._fxPrevClose = {};
      }
    } catch(e) { window._fxPrevClose = {}; }
  }

  // v30.11: 환율 변동률 계산 헬퍼
  function _calcFxChange(sym, currentPrice) {
    const prev = window._fxPrevClose[sym];
    if (!prev || prev <= 0 || currentPrice <= 0) return null;
    return ((currentPrice - prev) / prev) * 100;
  }

  // v30.11: 환율 API 결과를 처리하는 공통 함수
  function _processFxRates(rates, codeMapFn, apiName) {
    const fxQuotes = [];
    for (const [code, sym] of Object.entries(fxMap)) {
      const rawRate = codeMapFn(code);
      if (rawRate == null || rawRate <= 0) continue;
      let price = rawRate;
      if (FX_INVERTED.includes(sym)) price = 1 / price;
      // NaN/극단값 방어
      if (isNaN(price) || price <= 0 || price > 1e6) continue;
      const pct = _calcFxChange(sym, price);
      fxQuotes.push({
        symbol: sym,
        regularMarketPrice: price,
        regularMarketChangePercent: pct,
        regularMarketChange: pct != null ? price * pct / 100 : null,
        _source: 'fx:' + apiName
      });
    }
    // 전일 종가 갱신: 첫 세션 로드 시 현재값을 전일 종가로 저장 (다음 세션용)
    if (fxQuotes.length > 0 && !window._fxPrevCloseSaved) {
      const toSave = { _ts: Date.now() };
      fxQuotes.forEach(q => { toSave[q.symbol] = q.regularMarketPrice; });
      try { localStorage.setItem('aio_fx_prev_close', JSON.stringify(toSave)); } catch(e) {}
      window._fxPrevCloseSaved = true;
    }
    return fxQuotes;
  }

  let fxLoaded = false;
  // API 1: open.er-api.com
  if (!fxLoaded) try {
    const r = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD', {}, 5000);
    if (r.ok) {
      const d = await r.json();
      if (d.result === 'success' && d.rates) {
        const fxQuotes = _processFxRates(d.rates, code => d.rates[code], 'open.er-api');
        if (fxQuotes.length > 0) {
          allQuotes.push(...fxQuotes);
          fxLoaded = true;
          console.log('[AIO] 환율 갱신 (open.er-api)', fxQuotes.length + '개');
        }
      }
    }
  } catch(e) { _aioLog('warn', 'fetch', 'open.er-api 실패: ' + e.message); }
  // API 2: exchangerate-api.com (폴백)
  if (!fxLoaded) try {
    const r = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD', {}, 5000);
    if (r.ok) {
      const d = await r.json();
      if (d.rates) {
        const fxQuotes = _processFxRates(d.rates, code => d.rates[code], 'exchangerate-api');
        if (fxQuotes.length > 0) {
          allQuotes.push(...fxQuotes);
          fxLoaded = true;
          console.log('[AIO] 환율 갱신 (exchangerate-api 폴백)', fxQuotes.length + '개');
        }
      }
    }
  } catch(e) { _aioLog('warn', 'fetch', 'exchangerate-api 실패: ' + e.message); }
  // API 3: fawazahmed0 currency-api (최종 폴백)
  if (!fxLoaded) try {
    const r = await fetchWithTimeout('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', {}, 5000);
    if (r.ok) {
      const d = await r.json();
      if (d.usd) {
        const codeMap = {KRW:'krw', JPY:'jpy', EUR:'eur', GBP:'gbp', CNY:'cny', AUD:'aud', CAD:'cad', CHF:'chf'};
        const fxQuotes = _processFxRates(d.usd, code => d.usd[codeMap[code]], 'fawazahmed0');
        if (fxQuotes.length > 0) {
          allQuotes.push(...fxQuotes);
          fxLoaded = true;
          console.log('[AIO] 환율 갱신 (fawazahmed0 최종 폴백)', fxQuotes.length + '개');
        }
      }
    }
  } catch(e) { _aioLog('warn', 'fetch', '모든 환율 API 실패: ' + e.message); }

  // ─── 2.5. 한국 시장: 네이버 파이낸스 1차 소스 (v36) ─────────────────
  // 네이버 성공 시 Yahoo Korean 배치 스킵 → 요청 수 절감 + 데이터 정확도 향상
  let _naverKrLoaded = false;
  try {
    const naverQuotes = await fetchKrNaverQuotes();
    if (naverQuotes.length >= 3) {
      allQuotes.push(...naverQuotes);
      _naverKrLoaded = true;
      console.log('[AIO] 한국 시세 네이버 1차 소스 성공:', naverQuotes.length + '개');
      // 네이버 데이터 즉시 반영 (체감 속도 향상)
      applyLiveQuotes(allQuotes);
    }
  } catch(e) { _aioLog('warn', 'fetch', '네이버 한국 시세 실패 — Yahoo 폴백 사용: ' + e.message); }

  // ─── 3. 주식·지수: Yahoo Finance v8/chart (단일 심볼, corsproxy 경유) ──
  // 핵심 심볼을 5개씩 나눠서 순차 요청 (빠른 것부터)
  const PRIORITY_SYMS = [
    // 먼저 가져올 핵심 심볼 (홈 화면에 표시)
    ['^GSPC', '^IXIC', '^VIX', 'CL=F', 'GC=F'],          // 지수·원자재
    ['DX-Y.NYB', '^TNX', '^TYX', 'HYG', 'SPY'],            // 달러·금리·ETF
    ['BZ=F', 'NG=F', 'SI=F', 'KRW=X', 'HG=F'],             // v38.3: Brent·원자재·원달러 우선 fetch
    ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMD'],               // 대형주
    ['XLE', 'XLK', 'XLF', 'GLD', 'TLT'],                   // 섹터 ETF
    ['ES=F', 'NQ=F', 'YM=F', 'RTY=F', 'VXX', 'UVXY'],      // v48.58: RTY=F 추가 (Russell 선물)
    ['^RUT', '^VVIX', '^IRX', '^FVX', 'RSP'],              // 추가 지수
    ['QQQ', 'AMZN', 'META', 'GOOGL', 'MU'],                 // 추가 주식 (v38.4: GOOGL 추가, ARM→후순위)
    // ── v34.6: 테마 세분화 핵심 종목 우선 fetch (SUB_THEMES leaders) ──
    ['COIN', 'HOOD', 'MSTR', 'AVGO', 'CEG'],              // 핀테크/크립토 + AI칩 + 원전
    ['VST', 'NRG', 'CCJ', 'PANW', 'CRWD'],                // 원전/유틸 + 사이버보안
    ['ZS', 'FTNT', 'IREN', 'CRWV', 'NBIS'],               // 사이버보안 + 네오클라우드
    ['CIFR', 'WULF', 'VRT', 'ANET', 'ALAB'],              // 네오클라우드 + DC인프라
    ['CRDO', 'LITE', 'COHR', 'CIEN', 'AAOI'],             // DC인프라 + 광통신
    ['GLW', 'STX', 'WDC', 'RKLB', 'ASTS'],                // 메모리 + 우주
    ['GD', 'NOC', 'ROK', 'TER', 'QBTS'],                  // 방산 + 로보틱스 + 양자
    ['XLV', 'XLI', 'XLY', 'XLP', 'XLRE'],                 // 섹터 ETF 2
    ['XLB', 'XLU', 'XLC', 'SMH', 'IWM'],                  // v38.4: 누락 섹터 ETF + 반도체/소형주
    ['LMT', 'RTX', 'XOM', 'CVX', 'ARM'],                   // 방산·에너지·ARM
    ['LQD', 'DIA', 'SLV', 'USO', 'QCOM'],                 // v38.4: 이전 미수신 ETF + 퀄컴
    ['^DJI', 'BTC-USD', 'ETH-USD', 'SI=F', '000001.SS'],   // GMO 테이블 필수 심볼
    ['^GDAXI', '^FTSE', '^FCHI', '^N225', '^HSI'],          // 글로벌 지수 (EMEA + Asia)
    ['EMB', 'SHY', 'IEF'],                                   // 채권 ETF
    ['IONQ', 'RGTI', 'QUBT', 'LUNR', 'RDW'],              // 양자·우주
    ['AFRM', 'SOFI', 'UPST', 'PL'],                          // 핀테크 (LUNR→16507 중복제거)
    ['IBIT', 'BITO', 'UBER', 'DASH', 'CPNG'],             // BTC ETF + 딜리버리
    ['LLY', 'NVO', 'INTC', 'GFS', 'UMC'],                 // GLP-1 + 파운드리
    // ── 한국 주요 종목 (Yahoo Finance .KS/.KQ) ──
    ['^KS11', '^KQ11', '005930.KS', '000660.KS', '012450.KS'], // KOSPI,KOSDAQ,삼성전자,SK하이닉스,한화에어로
    ['329180.KS', '042660.KS', '035420.KS', '034020.KS', '298040.KS'], // HD현대중공업,한화오션,NAVER,두산에너빌,효성중공업
    ['373220.KS', '005380.KS', '207940.KS', '047810.KS', '010120.KS'], // LG에솔,현대차,삼바,한국항공우주,LS일렉
    ['055550.KS', '068270.KS', '090430.KS', '003230.KS', '277810.KQ'], // 신한지주,셀트리온,아모레,삼양식품,레인보우로보틱스
    // ── v35.7: 한국 시총 TOP20 + 테마 대장주 추가 (기존 누락분) ──
    ['000270.KS', '105560.KS', '402340.KS', '005490.KS', '035720.KS'], // 기아,KB금융,SK스퀘어,POSCO홀딩스,카카오
    ['051910.KS', '006400.KS', '096770.KS', '086790.KS', '316140.KS'], // LG화학,삼성SDI,SK이노베이션,하나금융,우리금융
    ['009150.KS', '034730.KS', '003550.KS', '028260.KS', '271560.KS'], // 삼성전기,SK,LG,삼성물산,오리온
    ['323410.KS', '015760.KS', '009830.KS', '192820.KQ', '000720.KS'], // 카카오뱅크,한국전력,한화솔루션,코스맥스,현대건설
    // ── 한국 방산 테마 ──
    ['064350.KS', '079550.KS', '272210.KS', '000880.KS', '103140.KS'], // 현대로템,LIG넥스원,한화시스템,한화,풍산
    // ── 한국 조선 테마 ──
    ['009540.KS', '010140.KS', '010620.KS', '082740.KS', '267250.KS'], // HD한국조선해양,삼성중공업,HD현대미포,한화엔진,HD현대
    ['071970.KS', '011210.KS'],                                         // HD현대마린엔진,현대위아
    // ── 한국 전력인프라 테마 ──
    ['267260.KS', '103590.KS', '006260.KS', '229640.KS', '000500.KS'], // HD현대일렉트릭,일진전기,LS,LS에코에너지,가온전선
    ['033100.KS', '259960.KS'],                                         // 제룡전기,크래프톤
    // ── 한국 반도체·IT ──
    ['000990.KS', '005290.KS', '018260.KS', '012510.KS', '012330.KS'], // DB하이텍,동진쎄미켐,삼성SDS,더존비즈온,현대모비스
    // ── 한국 바이오·헬스케어 ──
    ['000100.KS', '128940.KS', '326030.KS'],                             // 유한양행,한미약품,SK바이오팜 (207940.KS→16514 중복제거)
    // ── 한국 원전 테마 ──
    ['052690.KS', '051600.KS', '092200.KS', '083650.KS'],               // 한전기술,한전KPS,디아이씨,비에이치아이
    // ── 한국 2차전지·소재 ──
    ['051900.KS', '122870.KS', '138040.KS', '086280.KS'],               // LG이노텍,이녹스첨단소재,메리츠금융,현대글로비스 (005490.KS→16517 중복제거)
    // ── 한국 ETF 섹터 ──
    ['091160.KS', '305720.KS', '091220.KS', '244580.KS'],               // KODEX반도체,KODEX2차전지,KODEX은행,KODEX바이오
    // ── 한국 코스닥 주도주 ──
    ['315640.KQ', '403870.KQ', '454910.KQ', '950130.KQ', '253450.KQ'], // 뉴로메카,HPSP,에이텐랩,엘앤에프,스튜디오드래곤
    ['058470.KQ', '066970.KQ', '036930.KQ', '039030.KQ', '145020.KQ'], // 리노공업,엘앤에프,주성엔지니어링,이오테크닉스,휴젤
    ['131970.KQ', '178320.KQ', '112040.KQ', '240810.KQ', '041020.KQ'], // 테스나,서진시스템,위메이드,엘오티베큠,폴라리스오피스
    ['304100.KQ', '086520.KQ', '094480.KQ', '056080.KQ', '237880.KQ'], // 솔트룩스,에코프로,나라셀라,유진로봇,클리오
    ['196170.KQ', '257720.KQ', '278470.KQ', '044820.KQ', '042700.KQ'], // 알테오젠,세아메카닉스,코웨이,코스맥스비티아이,한미반도체
    ['247540.KQ', '003670.KQ', '028300.KQ', '161890.KQ'],              // 에코프로비엠,포스코퓨처엠,HLB,한국콜마
    // ── 한국 기타 대형주 ──
    ['004370.KS', '000810.KS', '035760.KS', '017670.KS', '018880.KS'], // 농심,삼성화재,CJ ENM,SK텔레콤,한온시스템
    ['030200.KS', '032640.KS', '032830.KS', '041510.KQ'],               // KT,LG유플러스,삼성생명,에스엠 (086280.KS→16536 중복제거)
    ['280360.KS', '352820.KS', '097950.KS', '251270.KS', '204320.KS'], // 롯데웰푸드,하이브,CJ제일제당,넷마블,만도
    ['005180.KS', '000080.KS', '004020.KS', '035900.KQ', '030520.KQ'], // 빙그레,하이트진로,현대제철,JYP Ent.,한글과컴퓨터
    // ── 추가 대형주 (DOW30 + S&P500) ──
    ['BRK-B', 'MA', 'UNH', 'HD', 'PG'],
    ['ABBV', 'NFLX', 'PEP', 'KO', 'MCD'],
    ['ADBE', 'ORCL', 'CSCO', 'IBM', 'INTU'],
    ['BAC', 'WFC', 'MS', 'BLK', 'AXP'],
    ['TMO', 'ISRG', 'VRTX', 'REGN', 'GILD'],
    ['ASML', 'AMAT', 'LRCX', 'KLAC', 'SNPS'],
    ['MRVL', 'CDNS', 'LOW', 'SBUX', 'DIS'],
    ['BA', 'NKE', 'VZ'],                                      // NOC,GD→16501 중복제거
    ['GE', 'HON', 'LIN', 'COP', 'NEE'],
    ['MELI', 'DDOG', 'SMCI'],                                 // UBER→16509,FTNT→16497 중복제거
    ['CAVA', 'SOUN'],                                         // SOFI,AFRM→16508,RGTI→16507 중복제거
    // ── v35.7: S&P 500 Top 50 누락분 추가 ──
    ['GOOGL', 'JPM', 'V', 'JNJ', 'COST'],
    ['WMT', 'CRM', 'MRK', 'GS', 'C'],
    ['QCOM', 'AMGN', 'NOW', 'PM', 'BKNG'],
    ['TXN', 'ACN', 'SPGI', 'PLTR', 'PYPL'],
    ['SCHW', 'WM', 'BX', 'KKR', 'APO'],
    // ── HOT/Trending 종목 ──
    ['HIMS', 'RDDT', 'PINS', 'SNAP', 'RBLX'],
    ['SPOT', 'TEM', 'AI', 'PATH', 'CFLT'],
    ['MDB', 'GTLB', 'ESTC', 'WDAY', 'MNDY'],
    ['SQ', 'OKLO', 'TLN', 'RIVN', 'LCID'],
    ['GM', 'F', 'EA', 'TTWO', 'DECK'],
    ['CELH', 'ONON', 'URI', 'NUE', 'SHOP'],
    ['ABNB', 'ROKU', 'DUOL', 'APP'],                          // DASH→16509 중복제거
    ['AXON', 'TOST', 'GRAB', 'SE', 'GME'],
    ['AMC', 'AEHR', 'VIAV', 'CRSP', 'IWM'],
    // ── 환율 심볼 (chartPreviousClose 확보용) ──
    ['KRW=X', 'JPY=X', 'EURUSD=X', 'GBPUSD=X', 'CNY=X'],
    ['AUDUSD=X'],
    // ── Top 200 확장 ──
    ['ABT', 'BSX', 'SYK', 'DHR', 'CI'],
    ['CME', 'ICE', 'MSI', 'APH', 'EOG'],
    ['ADP', 'ORLY', 'CTAS', 'SHW', 'CMG'],
    ['PGR', 'TDG', 'MAR', 'IDXX', 'ROP'],
    // ── v35.8: 테마 시세 갭 해소 ──
    ['CAT','UNP','CSX','PCAR','PH'],['WAB','AME','GNRC','JCI','NDSN'],['HII','HWM','LHX','LDOS','TXT'],
    ['DVN','OXY','FANG','TPL','KMI'],['WMB','TRGP','ET','SLB','HAL'],['BKR','VLO','MPC','PSX','DUK'],
    ['AEP','EXC','ETR','ES','FE'],['EVRG','XEL','EIX','LNT','PNW'],['ATO','SMR','LEU','ENPH','FSLR'],
    ['SEDG','RUN','PFE','BMY','MRNA'],['BIIB','AZN','VKTX','MDT','MCK'],['DVA','WAT','A','MASI','KEYS'],
    ['T','TMUS','MO','PM','SYY'],['ADM','CTVA','ECL','IFF','ADI'],['TJX','DG','CHD','CL','CLX'],
    ['MNST','EBAY','ETSY','HLT','PSKY'],['TTD','NET','SNOW','FCX','NEM'],['APD','AA','MP','LAC','ALB'],
    ['NXPI','ON','EMR','DELL','HPE'],['NTAP','EQIX','DLR','AMT','PLD'],['SPG','O','KIM','REG','VTR'],
    ['TSM','NU','MARA','RIOT','CLSK'],['ACLS','ENTG','FLNC'],['UCTT','ONTO','FLR','XYZ','CYBR'],
    ['SMH','IGV','XBI','ITA','OIH'],['AMLP','URA','XOP','HACK','GDX'],['BOTZ','ICLN','LIT','JETS','XLB'],
    ['XLC','XLU','NVO','PLUG','BE'],['JBHT','NSC','ODFL','UPS','S'],['FANUY','STAG','FCEL'],
    ['AEM','ALL','APTV','CB'],['CCI','CCL','DAL','DE','DKNG'],['EPD','FNV','GFI','GOLD'],
    ['KGC','LUV','MET','OKE','RCL'],['SBAC','TGT','TRV','UAL'],['WPM'],
    // ── v35.8: 한국 신규 테마 종목 ──
    ['006360.KS','375500.KS','028050.KS','139480.KS','069960.KS'],
    ['007070.KS','282330.KS','030000.KS','011170.KS','010950.KS'],
    ['000120.KS','003490.KS','180640.KS','023530.KS','078930.KS'],
    ['006800.KS','041190.KS','047080.KQ','004170.KS','047040.KS'],
    ['047820.KQ'],  // v35.8: 삼천당제약 (코스닥 시총 1위)
  ];

  // Yahoo Finance Chart API — crumb 불필요, 단일 심볼
  // corsproxy.io가 가장 안정적 (무료, CORS 없이)
  const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
  const CHART_PARAMS = '?interval=1d&range=1d&includePrePost=true';

  // v47.12: Yahoo v7/finance/quote 배치 캐시 — CF Worker 활성 시 PRIORITY_SYMS 전체를 1~3회 호출로 압축
  // v7/quote는 직접 호출 시 crumb 요구로 불안정 → CF Worker 미설정 시 스킵하여 기존 v8 개별 경로로 폴백
  // 배치 수신 시 fetchYFChart가 캐시 우선 조회하여 개별 호출 건너뜀 → 500+ 심볼 × 개별 요청 → 3회 배치로 압축 (~99% 감소)
  const _yfBatch = {};
  async function _yfBatchFetch(syms) {
    if (!syms || syms.length === 0) return;
    const cfW = _getApiKey('aio_cf_worker_url') || '';
    if (!cfW) return;
    const chunks = [];
    for (let i = 0; i < syms.length; i += 100) chunks.push(syms.slice(i, i + 100));
    await Promise.allSettled(chunks.map(async function(chunk) {
      const qUrl = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + encodeURIComponent(chunk.join(','));
      try {
        const r = await fetchWithTimeout(cfW + '?url=' + encodeURIComponent(qUrl), {}, 10000);
        if (!r.ok) return;
        const d = await r.json();
        const list = d && d.quoteResponse && Array.isArray(d.quoteResponse.result) ? d.quoteResponse.result : [];
        list.forEach(function(q) {
          if (!q || !q.symbol || !q.regularMarketPrice) return;
          if (!_validatePrice(q.symbol, q.regularMarketPrice)) return;
          var _pct = q.regularMarketChangePercent;
          var _prev = q.regularMarketPreviousClose != null ? q.regularMarketPreviousClose : (q.chartPreviousClose || 0);
          if (_pct == null && _prev > 0) _pct = ((q.regularMarketPrice - _prev) / _prev) * 100;
          var out = {
            symbol: q.symbol,
            regularMarketPrice: q.regularMarketPrice,
            chartPreviousClose: _prev,
            regularMarketChangePercent: _pct != null ? _pct : null,
            regularMarketChange: q.regularMarketChange != null ? q.regularMarketChange : (_prev > 0 ? q.regularMarketPrice - _prev : null),
            regularMarketDayHigh: q.regularMarketDayHigh,
            regularMarketDayLow: q.regularMarketDayLow,
            regularMarketVolume: q.regularMarketVolume,
            fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: q.fiftyTwoWeekLow,
            // v48.6: 52W 관련 확장 필드 + 거래량 평균 — 52W 위치 바 + 거래량 스파이크 계산 근거
            fiftyTwoWeekHighChangePercent: q.fiftyTwoWeekHighChangePercent != null ? q.fiftyTwoWeekHighChangePercent : null,
            fiftyTwoWeekLowChangePercent: q.fiftyTwoWeekLowChangePercent != null ? q.fiftyTwoWeekLowChangePercent : null,
            averageDailyVolume3Month: q.averageDailyVolume3Month != null ? q.averageDailyVolume3Month : null,
            averageDailyVolume10Day: q.averageDailyVolume10Day != null ? q.averageDailyVolume10Day : null,
            marketCap: q.marketCap,
            trailingPE: q.trailingPE,
            marketState: q.marketState,
            _source: 'live:yahoo-v7-batch'
          };
          var _ms = (q.marketState || '').toUpperCase();
          if (_ms === 'PRE' && q.preMarketPrice > 0) {
            out.extPrice = q.preMarketPrice;
            out.extPct = q.preMarketChangePercent != null ? q.preMarketChangePercent : null;
            out.extSession = 'pre';
          } else if ((_ms === 'POST' || _ms === 'POSTPOST') && q.postMarketPrice > 0) {
            out.extPrice = q.postMarketPrice;
            out.extPct = q.postMarketChangePercent != null ? q.postMarketChangePercent : null;
            out.extSession = 'post';
          }
          _yfBatch[q.symbol] = out;
        });
      } catch(e) { _aioLog('warn', 'fetch', 'Yahoo v7 batch chunk error: ' + e.message); }
    }));
    if (Object.keys(_yfBatch).length > 0) {
      console.log('[AIO] Yahoo v7 배치: ' + Object.keys(_yfBatch).length + '/' + syms.length + '개 수신 (' + chunks.length + '청크)');
    }
  }
  // Tier 0: 핵심 26개 심볼 선행 fetch → applyLiveQuotes() 즉시 호출로 체감 속도 개선
  const TIER0_SYMS = [
    '^GSPC','^IXIC','DX-Y.NYB','^KS11','^KQ11',
    'SPY','QQQ','DIA','IWM',
    'GC=F','CL=F','NG=F','ZB=F','GLD','USO','TLT',
    'BTC-USD','ETH-USD',
    'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA',
    'JPY=X','KRW=X','^VIX','HYG','LQD','DXY'
  ];
  try {
    await _yfBatchFetch(TIER0_SYMS);
    var _t0results = TIER0_SYMS.map(function(s) { return _yfBatch[s]; }).filter(Boolean);
    if (_t0results.length > 0) {
      applyLiveQuotes(_t0results);
      _aioLog('info', 'fetch', 'Tier 0 선행 적용: ' + _t0results.length + '개');
    }
  } catch(e) {}

  // PRIORITY_SYMS 전체 평탄화 후 중복 제거 → 1회 배치 호출
  try {
    const _allSymsFlat = Array.from(new Set(PRIORITY_SYMS.flat().concat(_requestedQuoteSyms)));
    await _yfBatchFetch(_allSymsFlat);
  } catch(e) { _aioLog('warn', 'init', 'v7 배치 초기화 실패: ' + e.message); }

  // v30.11 Task 11: _PROXY_REGISTRY에서 프록시 목록 가져옴 (단일 진실 원천)
  // v35.7: 매번 getRotated()에서 mkUrl을 가져와 부하 분산
  const YF_PROXIES = (typeof _PROXY_REGISTRY !== 'undefined') ? _PROXY_REGISTRY.getMkUrls() : [
    u => 'https://corsproxy.io/?' + encodeURIComponent(u),
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  ];

  async function fetchYFChart(symbol) {
    // v47.12: v7/quote 배치 캐시 우선 조회 — 진입부에서 이미 수신된 심볼이면 개별 호출 스킵
    if (_yfBatch[symbol]) return _yfBatch[symbol];
    const url = CHART_BASE + encodeURIComponent(symbol) + CHART_PARAMS;

    // v31.5: CF Worker가 있으면 직접 호출 건너뜀 (Yahoo CORS 503 방지 → 요청 절반 감소)
    const _skipDirect = !!(_getApiKey('aio_cf_worker_url'));
    if (!_skipDirect) {
      // 직접 시도 (CORS 해제 환경일 때만)
      try {
        const r = await fetchWithTimeout(url, {headers:{'Accept':'application/json'}}, 3000);
        if (r.ok) {
          const d = await r.json();
          const meta = d?.chart?.result?.[0]?.meta;
          if (meta?.regularMarketPrice && _validatePrice(symbol, meta.regularMarketPrice)) {
            var _dPrice = meta.regularMarketPrice;
            var _dPrev = meta.chartPreviousClose || meta.previousClose || 0;
            var _dPct = meta.regularMarketChangePercent;
            if (_dPct == null && _dPrev > 0) {  // v38.3 A4: _pct===0 유효값 보존 (변동률 0%도 정상)
              _dPct = ((_dPrice - _dPrev) / _dPrev) * 100;
            }
            // v36.6: 프리/애프터마켓 시세 추출
            var _extHours = {};
            var _mState = (meta.marketState || '').toUpperCase();
            if (_mState === 'PRE' && meta.preMarketPrice > 0) {
              _extHours = { extPrice: meta.preMarketPrice, extPct: meta.preMarketChangePercent != null ? meta.preMarketChangePercent : null, extSession: 'pre' };
            } else if ((_mState === 'POST' || _mState === 'POSTPOST') && meta.postMarketPrice > 0) {
              _extHours = { extPrice: meta.postMarketPrice, extPct: meta.postMarketChangePercent != null ? meta.postMarketChangePercent : null, extSession: 'post' };
            }
            return { symbol, ...meta, ..._extHours, regularMarketChangePercent: _dPct != null ? _dPct : null, chartPreviousClose: _dPrev, _source: 'live:yahoo-direct' };
          }
        }
      } catch(e) {}
    }

    // v35.7: 라운드로빈 부하 분산 — 매 호출마다 프록시 순서 회전
    const orderedProxies = (typeof _PROXY_REGISTRY !== 'undefined') ? _PROXY_REGISTRY.getRotated().map(function(p){ return p.mkUrl; }) : YF_PROXIES;

    for (const mkP of orderedProxies) {
      try {
        const r = await fetchWithTimeout(mkP(url), {}, 8000);
        if (!r.ok) continue;
        // allorigins는 JSON 래핑, 나머지는 직접
        let raw;
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const w = await r.json();
          raw = w.contents ? JSON.parse(w.contents) : w;
        } else {
          const txt = await r.text();
          try { raw = JSON.parse(txt); } catch(e) {
            // allorigins JSON 래핑인데 text/plain인 경우
            try { const w = JSON.parse(txt); raw = w.contents ? JSON.parse(w.contents) : w; } catch(e2) {}
          }
        }
        const meta = raw?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice && _validatePrice(symbol, meta.regularMarketPrice)) {
          // v30.13c: chart API에 regularMarketChangePercent 없을 때 직접 계산
          var _price = meta.regularMarketPrice;
          var _prevClose = meta.chartPreviousClose || meta.previousClose || 0;
          var _pct = meta.regularMarketChangePercent;
          var _chg = meta.regularMarketChange;
          // chart API는 변화율을 안 주는 경우가 많음 → previousClose로 직접 계산
          if (_pct == null && _prevClose > 0) {
            _pct = ((_price - _prevClose) / _prevClose) * 100;
            _chg = _price - _prevClose;
          }
          // v30.14: chartPreviousClose를 반환에 포함 — 환율 _fxPrevClose 보정용
          // v36.6: 프리/애프터마켓 시세 추출 (proxy 경로)
          var _extH = {};
          var _ms = (meta.marketState || '').toUpperCase();
          if (_ms === 'PRE' && meta.preMarketPrice > 0) {
            _extH = { extPrice: meta.preMarketPrice, extPct: meta.preMarketChangePercent != null ? meta.preMarketChangePercent : null, extSession: 'pre' };
          } else if ((_ms === 'POST' || _ms === 'POSTPOST') && meta.postMarketPrice > 0) {
            _extH = { extPrice: meta.postMarketPrice, extPct: meta.postMarketChangePercent != null ? meta.postMarketChangePercent : null, extSession: 'post' };
          }
          return {
            symbol,
            regularMarketPrice: _price,
            regularMarketChangePercent: _pct != null ? _pct : null,
            regularMarketChange: _chg != null ? _chg : null,
            chartPreviousClose: _prevClose != null ? _prevClose : null,
            ..._extH,
            _source: 'live:yahoo-proxy',
          };
        }
      } catch(e) {}
    }
    return null;
  }

  // v30.11: 가격 검증 — 심볼 유형별 분리된 임계값
  // KRX 가한폭 ±30% (상한가/하한가), 미국 개별주 ±25%, 지수/ETF ±15%, 환율 ±10%, VIX 특수
  if (!window._priceWarnShown) window._priceWarnShown = {};

  // v30.11: 심볼 유형별 검증 규칙
  const _PRICE_RULES = {
    // VIX 계열: 극단 변동 허용 (공포 지수)
    '^VIX':  { min: 5,    max: 120,    maxJump: 0.80 },
    '^VVIX': { min: 50,   max: 250,    maxJump: 0.80 },
    // 주요 지수: ±15%
    '^GSPC': { min: 1000, max: 20000,  maxJump: 0.15 },
    '^IXIC': { min: 5000, max: 50000,  maxJump: 0.15 },
    '^DJI':  { min: 10000,max: 80000,  maxJump: 0.15 },
    '^RUT':  { min: 500,  max: 10000,  maxJump: 0.15 },
    // 금리: 절대 범위 (음수 허용하지 않음)
    '^TNX':  { min: 0.01, max: 20,     maxJump: 0.30 },
    '^TYX':  { min: 0.01, max: 20,     maxJump: 0.30 },
    '^FVX':  { min: 0.01, max: 20,     maxJump: 0.30 },
    '^IRX':  { min: 0.01, max: 20,     maxJump: 0.30 },
    // 환율: ±10%
    'KRW=X': { min: 800,  max: 2000,   maxJump: 0.10 },
    'DX-Y.NYB': { min: 70, max: 130,   maxJump: 0.10 },
    // 원자재
    'CL=F':  { min: 10,   max: 250,    maxJump: 0.20 },
    'GC=F':  { min: 500,  max: 10000,  maxJump: 0.15 },
    // 암호화폐: 높은 변동성 허용
    'BTC-USD': { min: 1000, max: 500000, maxJump: 0.30 },
    'ETH-USD': { min: 50,   max: 50000,  maxJump: 0.35 },
  };

  function _getPriceRule(symbol) {
    if (_PRICE_RULES[symbol]) return _PRICE_RULES[symbol];
    // KRX: 상한가/하한가 ±30%
    if (symbol.endsWith('.KS') || symbol.endsWith('.KQ') || symbol === '^KS11' || symbol === '^KQ11') {
      return { min: 0.01, max: 1e7, maxJump: 0.30 };
    }
    // FX 통화쌍
    if (symbol.endsWith('=X')) {
      return { min: 0.001, max: 1e6, maxJump: 0.10 };
    }
    // 일반 미국 주식/ETF: ±25%
    return { min: 0.01, max: 1e6, maxJump: 0.25 };
  }

  function _validatePrice(symbol, price) {
    if (typeof price !== 'number' || isNaN(price) || price <= 0) return false;
    const rule = _getPriceRule(symbol);
    // 절대 범위 체크
    if (price < rule.min || price > rule.max) return false;
    const prev = window._previousPrices?.[symbol];
    if (!prev) return true;
    // 세션 내 실시간 갱신에서만 검증 (첫 로드 시 폴백→실제 괴리 허용)
    if (!window._sessionLivePrices?.[symbol]) {
      window._sessionLivePrices = window._sessionLivePrices || {};
      window._sessionLivePrices[symbol] = price;
      return true; // 첫 실시간 가격은 무조건 수용
    }
    if (Math.abs(price - prev) / prev > rule.maxJump) {
      if (!window._priceWarnShown[symbol]) {
        _aioLog('warn', 'price', 'Price out of range for ' + symbol + ': ' + prev + ' → ' + price + ' (limit: ±' + (rule.maxJump*100) + '%)');
        window._priceWarnShown[symbol] = true;
      }
      return false;
    }
    return true;
  }

  // v30.11: 프록시 건강도 추적 — 연속 실패 시 그룹 스킵으로 전환
  if (!window._proxyHealth) window._proxyHealth = { consecutiveFails: 0, lastSuccess: 0, dead: false };

  // v30.11: 적응형 배치 처리 — 프록시 상태에 따라 동작 조정
  // - 프록시 정상: 그룹(5개) 병렬 + 그룹 간 순차 (기존과 동일)
  // - 프록시 불안정(3연속 실패): 나머지 그룹 스킵, 이미 수집한 데이터만 표시
  // - 중간 갱신: 핵심 그룹(처음 2개) 완료 후 즉시 화면 반영
  let yfCount = 0;
  let groupFailStreak = 0;
  let quoteProxyCircuitOpen = false;
  const CRITICAL_GROUPS = 6; // v38.4: 첫 6그룹 핵심 (지수·원자재·달러·금리·대형주·섹터ETF)
  const MAX_GROUP_FAILS = 3; // 연속 3그룹 전부 실패 → 프록시 죽음 판정

  for (let gi = 0; gi < PRIORITY_SYMS.length; gi++) {
    const group = PRIORITY_SYMS[gi];

    // v36: 네이버로 한국 데이터 이미 로드 완료 → Yahoo Korean 배치 스킵 (요청 절감)
    if (_naverKrLoaded) {
      const isKrGroup = group.every(function(s) {
        return s.endsWith('.KS') || s.endsWith('.KQ') || s === '^KS11' || s === '^KQ11';
      });
      if (isKrGroup) {
        console.log('[AIO] 네이버 데이터 사용 — Yahoo Korean 그룹 스킵 (group ' + gi + ')');
        continue;
      }
    }

    // 프록시 죽음 판정 후: 핵심 그룹 이후는 스킵
    if (groupFailStreak >= MAX_GROUP_FAILS && gi >= CRITICAL_GROUPS) {
      quoteProxyCircuitOpen = true;
      _aioLog('warn', 'fetch', '프록시 연속 실패 — 나머지 ' + (PRIORITY_SYMS.length - gi) + '개 그룹 스킵');
      showDataError('시세', '일부 종목 갱신 실패 — 프록시 불안정', 'warn');
      break;
    }

    const results = await Promise.allSettled(group.map(fetchYFChart));
    let groupSuccess = 0;
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        allQuotes.push(r.value);
        yfCount++;
        groupSuccess++;
      }
    });

    // 그룹 성공/실패 추적
    if (groupSuccess === 0) {
      groupFailStreak++;
    } else {
      groupFailStreak = 0; // 성공 시 리셋
      window._proxyHealth.consecutiveFails = 0;
      window._proxyHealth.lastSuccess = Date.now();
    }

    // 핵심 그룹 완료 후 즉시 화면 업데이트 (체감 속도 향상)
    if (gi < CRITICAL_GROUPS && allQuotes.length > 0) {
      applyLiveQuotes(allQuotes);
    }
    // v34.6: 테마 그룹(6~12) 완료 후 즉시 업데이트 → 세분화 테마 시세 빠른 반영
    else if (gi >= CRITICAL_GROUPS && gi <= 12 && allQuotes.length > 0) {
      applyLiveQuotes(allQuotes);
    }
    // 이후: 3그룹마다 중간 업데이트 (기존 5 → 3으로 단축)
    else if (gi > 12 && gi % 3 === 0 && allQuotes.length > 0) {
      applyLiveQuotes(allQuotes);
    }
  }
  console.log('[AIO] Yahoo Finance 갱신:', yfCount, '/' + PRIORITY_SYMS.reduce((a,g)=>a+g.length,0) + '개',
    groupFailStreak >= MAX_GROUP_FAILS ? '(프록시 불안정으로 조기 종료)' : '');

  // ─── v46.3: Stooq 폴백 — Yahoo 실패/부분 실패 시 미국 주식/ETF/원자재 보완 ───
  // Stooq: 무료, API키 불필요, 배치 지원 (+ 구분), CSV 응답
  // 지원: 미국 주식(.US), ETF(.US), WTI(CL.F), Gold(GC.F), DXY(DX.F)
  // 미지원: VIX, 채권 금리 (Yahoo 유지)
  var gotSyms = {};
  allQuotes.forEach(function(q) { gotSyms[q.symbol] = true; });
  var usMissing = [];
  var stooqMap = {}; // Yahoo심볼 → Stooq심볼 매핑
  // Stooq 미지원: 지수(^GSPC/^DJI/^IXIC — 가격 체계 다름), VIX, 금리, 암호화폐, 환율
  var _stooqSkip = {'^GSPC':1,'^DJI':1,'^IXIC':1,'^RUT':1,'^VIX':1,'^VVIX':1,'^TNX':1,'^TYX':1,'^IRX':1,'^FVX':1,'BTC-USD':1,'ETH-USD':1};
  PRIORITY_SYMS.forEach(function(group) {
    group.forEach(function(sym) {
      if (gotSyms[sym]) return;
      if (sym.endsWith('.KS') || sym.endsWith('.KQ') || sym === '^KS11' || sym === '^KQ11') return;
      if (_stooqSkip[sym]) return;
      if (sym.includes('=X')) return; // 환율은 별도 API
      var stSym = null;
      // 원자재 선물: 명시 매핑만 (ES=F/NQ=F/YM=F 등 지수 선물은 Stooq 미지원)
      if (sym === 'CL=F') stSym = 'cl.f';
      else if (sym === 'BZ=F') stSym = 'bz.f';
      else if (sym === 'GC=F') stSym = 'gc.f';
      else if (sym === 'SI=F') stSym = 'si.f';
      else if (sym === 'NG=F') stSym = 'ng.f';
      else if (sym === 'HG=F') stSym = 'hg.f';
      else if (sym === 'DX-Y.NYB' || sym === 'DX=F') stSym = 'dx.f';
      else if (sym.includes('=F')) return; // 기타 선물(ES=F/NQ=F/YM=F 등) Stooq 미지원 → 스킵
      else {
        // 일반 미국 주식/ETF: AAPL → aapl.us, XLK → xlk.us
        var clean = sym.replace(/[^A-Z0-9]/gi, '');
        if (clean.length >= 1 && clean.length <= 5) stSym = clean.toLowerCase() + '.us';
      }
      if (stSym) { usMissing.push(sym); stooqMap[sym] = stSym; }
    });
  });

  const hasMarketSnapshotFallback = !!(_aioMarketSnapshotMeta && Number(_aioMarketSnapshotMeta.count) > 0);
  if (usMissing.length > 0 && !(quoteProxyCircuitOpen && hasMarketSnapshotFallback)) {
    // 배치: 최대 30개씩 + 구분 쿼리
    var stBatches = [];
    for (var si = 0; si < usMissing.length; si += 30) {
      stBatches.push(usMissing.slice(si, si + 30));
    }
    for (var sbi = 0; sbi < stBatches.length; sbi++) {
      var stBatch = stBatches[sbi];
      var stSymStr = stBatch.map(function(s) { return stooqMap[s]; }).join('+');
      var stUrl = 'https://stooq.com/q/l/?s=' + stSymStr + '&f=sd2t2ohlcv&h&e=csv';
      try {
        var stResp;
        try { stResp = await fetchWithTimeout(stUrl, {}, 6000); } catch(e) { stResp = await fetchViaProxy(stUrl, 8000); }
        if (stResp.ok) {
          var stText = await stResp.text();
          // 프록시 래퍼 처리
          if (stText.startsWith('{')) { try { var stJ = JSON.parse(stText); stText = stJ.contents || stText; } catch(e){} }
          var stLines = stText.trim().split('\n').slice(1); // 헤더 제거
          stLines.forEach(function(line) {
            var cols = line.split(',');
            if (cols.length < 8 || cols[1] === 'N/D') return;
            var stSym = cols[0].trim();
            // 역매핑: Stooq심볼 → Yahoo심볼
            var yahooSym = null;
            for (var ys in stooqMap) { if (stooqMap[ys] === stSym.toLowerCase()) { yahooSym = ys; break; } }
            if (!yahooSym) return;
            // Stooq CSV: Symbol,Date,Time,Open,High,Low,Close,Volume → cols[6]=Close, cols[3]=Open
            var close = parseFloat(cols[6]) || parseFloat(cols[7]); // v46.9: Close 우선
            var open = parseFloat(cols[3]) || parseFloat(cols[4]);   // Open 우선
            // v46.4: CSV 파싱 검증 — NaN/Infinity/음수 방어
            if (!isFinite(close) || close <= 0 || !isFinite(open) || open <= 0) return;
            // Stooq copper sometimes reports HG in cents while Yahoo HG=F uses dollars per lb.
            // Normalize before jump validation so a valid live rescue is not rejected as -99%.
            if (yahooSym === 'HG=F' && close > 100 && open > 100) {
              close = close / 100;
              open = open / 100;
            }
            var prevClose = (window._liveData && window._liveData[yahooSym] && window._liveData[yahooSym].chartPreviousClose > 0)
              ? window._liveData[yahooSym].chartPreviousClose : open;
            var pct = prevClose > 0 ? ((close - prevClose) / prevClose * 100) : null;
            if (pct != null && (!isFinite(pct) || Math.abs(pct) > 50)) pct = null; // 50%+ 변동 = 데이터 오류 가능
            allQuotes.push({
              symbol: yahooSym,
              regularMarketPrice: close,
              regularMarketChangePercent: pct != null ? +pct.toFixed(2) : null,
              regularMarketChange: prevClose > 0 ? +(close - prevClose).toFixed(2) : null,
              _source: 'live:stooq'
            });
          });
          console.log('[AIO-Stooq] 폴백 배치 ' + (sbi+1) + ':', stBatch.length + '개 시도');
        }
      } catch(e) { _aioLog('warn', 'fetch', 'Stooq 폴백 실패: ' + e.message); }
    }
  }

  async function _fetchQuoteRescue(symbols, label, limit) {
    symbols = Array.from(new Set((symbols || []).map(function(s) {
      return String(s || '').trim().toUpperCase();
    }).filter(Boolean)));
    var have = {};
    allQuotes.forEach(function(q) { if (q && q.symbol) have[q.symbol] = true; });
    symbols = symbols.filter(function(sym) { return !have[sym]; });
    if (limit && symbols.length > limit) symbols = symbols.slice(0, limit);
    if (!symbols.length) return 0;
    var added = 0;
    for (var ri = 0; ri < symbols.length; ri += 6) {
      var batch = symbols.slice(ri, ri + 6);
      var settled = await Promise.allSettled(batch.map(fetchYFChart));
      settled.forEach(function(r) {
        if (r.status === 'fulfilled' && r.value && r.value.symbol && !have[r.value.symbol]) {
          have[r.value.symbol] = true;
          allQuotes.push(r.value);
          added++;
        }
      });
      if (added > 0) applyLiveQuotes(allQuotes);
    }
    if (added && typeof _aioLog === 'function') _aioLog('info', 'fetch', label + ' quote rescue applied: ' + added + '/' + symbols.length);
    return added;
  }

  try {
    var _coreRescueSyms = (window.AIO && window.AIO.CORE_LIVE_SYMBOLS) || ['^GSPC','^IXIC','^VIX','CL=F','GC=F','KRW=X','DX-Y.NYB','^KS11','^KQ11'];
    if (!(quoteProxyCircuitOpen && hasMarketSnapshotFallback)) {
      await _fetchQuoteRescue(_coreRescueSyms, 'core', _coreRescueSyms.length);
      await _fetchQuoteRescue(_requestedQuoteSyms, 'requested-dom', 120);
    }
  } catch(e) {
    if (typeof _aioLog === 'function') _aioLog('warn', 'fetch', 'quote rescue failed: ' + (e && e.message || e));
  }

  // ─── 최종 결과 적용 ─────────────────────────────────────────
  if (allQuotes.length > 0) {
    applyLiveQuotes(allQuotes);
    try {
      scheduleQuoteCrossSourceValidation([].concat(
        _requestedQuoteSyms,
        (window.AIO && window.AIO.CORE_LIVE_SYMBOLS) || [],
        (typeof _aioGetCritical10Symbols === 'function' ? _aioGetCritical10Symbols() : [])
      ), 'post-live-quotes-cross-source');
    } catch(_crossScheduleErr) {}
    fetchLiveQuotes._failCount = 0;
    // v48.36: 중앙 freshness 추적 — _lastFetch.quote + DATA_SNAPSHOT._isFallback 해제
    if (typeof window._markFetch === 'function') window._markFetch('quote');
    var liveCoverage = null;
    try { liveCoverage = window.AIO && typeof window.AIO.getLiveCoverage === 'function' ? window.AIO.getLiveCoverage() : null; } catch(_lc) {}
    var coreCoverageOk = liveCoverage ? liveCoverage.coreOk : true;
    if (typeof DATA_SNAPSHOT !== 'undefined') {
      DATA_SNAPSHOT._liveCoverage = liveCoverage;
      DATA_SNAPSHOT._partialLive = !coreCoverageOk;
      DATA_SNAPSHOT._isFallback = !coreCoverageOk;
    }
    updateDataStatusError('ok', 'API 연결 성공 · ' + allQuotes.length + '개 종목');
    if (typeof _reportApiOk === 'function') _reportApiOk('yahoo-quote', allQuotes.length + '개 종목');
    // v34.2: 실시간 데이터 수신 이벤트 발화 → staleness 배너 즉시 해제
    try { window.dispatchEvent(new CustomEvent('aio:liveDataReceived', { detail: { count: allQuotes.length, liveCoverage: liveCoverage, coreCoverageOk: coreCoverageOk } })); } catch(_e){}
    if (!coreCoverageOk) updateDataStatusError('warn', 'API connected but core market coverage is partial - fallback still active');
    const lqTs = document.getElementById('live-quote-ts');
    if (lqTs) lqTs.textContent = '클라 시세 ' + new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) + ' 갱신 (' + allQuotes.length + '개)';
    // v49.37 P282: live-quote-ts-topbar 동시 갱신 (영구 placeholder 잔존 차단)
    const lqTsTop = document.getElementById('live-quote-ts-topbar');
    try { document.dispatchEvent(new CustomEvent('aio:quoteTopbar', { detail: { coreCoverageOk: coreCoverageOk } })); } catch(_topbarEvent) {}
    if (lqTsTop && !lqTsTop.textContent) {
      lqTsTop.textContent = '● ' + (coreCoverageOk ? '실시간 ' : '일부 실시간 ') + new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) + ' (' + allQuotes.length + '개)';
      lqTsTop.className = 'freshness-badge ' + (coreCoverageOk ? 'fb-live' : 'fb-static');
    }
    try {
      if (window.AIO && typeof window.AIO.scheduleMarketCurrentnessGuard === 'function') window.AIO.scheduleMarketCurrentnessGuard(250, 'live-quotes');
      else if (window.AIO && typeof window.AIO.applyMarketCurrentnessGuard === 'function') window.AIO.applyMarketCurrentnessGuard({ reason: 'live-quotes' });
    } catch(_mcg) {}
  } else {
    fetchLiveQuotes._failCount = (fetchLiveQuotes._failCount||0) + 1;
    // v46.4: 지수적 백오프 (선형 30×N → 지수 15×2^N, 최대 300초)
    const usingSnapshotFallback = !!(_aioMarketSnapshotMeta && Number(_aioMarketSnapshotMeta.count) > 0);
    const wait = usingSnapshotFallback ? 180 : Math.min(300, 15 * Math.pow(2, fetchLiveQuotes._failCount - 1));
    const lqTs = document.getElementById('live-quote-ts');
    if (lqTs) lqTs.textContent = usingSnapshotFallback ? '기준 스냅샷 사용 · 중앙 갱신 주기 대기' : wait + '초 후 재시도...';
    // v49.37 P282: live-quote-ts-topbar 동시 갱신 (실패 상태)
    const lqTsTopErr = document.getElementById('live-quote-ts-topbar');
    if (usingSnapshotFallback) {
      try { document.dispatchEvent(new CustomEvent('aio:marketSnapshot', { detail: _aioMarketSnapshotMeta })); } catch(_snapshotTopbarEvent) {}
    } else if (lqTsTopErr) {
      lqTsTopErr.textContent = '⚠ ' + wait + '초 후 재시도';
      lqTsTopErr.className = 'freshness-badge fb-static';
    }
    updateDataStatusError(usingSnapshotFallback ? 'warn' : 'error', usingSnapshotFallback
      ? '실시간 시세 미수신 · 기준 스냅샷 사용 · 중앙 갱신 주기 대기'
      : 'API 연결 실패 — ' + wait + '초 후 재시도');
    if (typeof _reportApiError === 'function') _reportApiError('yahoo-quote', '연결 실패 (시도 ' + fetchLiveQuotes._failCount + ')');
    if (!usingSnapshotFallback) setTimeout(fetchLiveQuotes, wait * 1000);
  }
  } catch (e) {
    fetchLiveQuotes._failCount = (fetchLiveQuotes._failCount || 0) + 1;
    if (typeof _aioLog === 'function') _aioLog('error', 'fetch', 'fetchLiveQuotes fatal: ' + (e && e.message ? e.message : e));
    updateDataStatusError('error', 'quote refresh failed - next refresh remains enabled');
    if (typeof _reportApiError === 'function') _reportApiError('yahoo-quote', 'fatal refresh error');
  } finally {
    window._aioQuoteInFlight = false;
  }
}

function scheduleQuoteCrossSourceValidation(symbols, reason) {
  if (!window.AIO || typeof window.AIO.validateQuoteCrossSources !== 'function') return;
  symbols = Array.from(new Set((symbols || []).map(function(sym) {
    return String(sym || '').trim().toUpperCase();
  }).filter(Boolean)));
  if (!symbols.length) return;
  clearTimeout(window._aioCrossSourceValidationTimer);
  window._aioCrossSourceValidationTimer = setTimeout(function() {
    window.AIO.validateQuoteCrossSources(symbols, {
      reason: reason || 'quote-cross-source',
      limit: 32
    }).catch(function(e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'fetch', 'cross-source quote validation failed: ' + (e && e.message || e));
    });
  }, 1200);
}

window.AIO.validateQuoteCrossSources = async function(symbols, opts) {
  opts = opts || {};
  symbols = Array.from(new Set((symbols || []).map(function(sym) {
    return String(sym || '').trim().toUpperCase();
  }).filter(Boolean)));
  var limit = Math.max(1, Math.min(Number(opts.limit || 24), 48));
  symbols = symbols.slice(0, limit);
  var now = Date.now();
  var cache = window.AIO_CROSS_SOURCE_QUOTE_CACHE = window.AIO_CROSS_SOURCE_QUOTE_CACHE || {};
  var fmpKey = (typeof _getApiKey === 'function') ? (_getApiKey('aio_fmp_key') || '') : '';
  var finnhubKey = (typeof _getApiKey === 'function') ? (_getApiKey('aio_finnhub_key') || '') : '';

  function _record(sym, source, price, pct, meta) {
    try {
      if (window.AIO && typeof window.AIO.recordCrossSourceQuote === 'function') {
        window.AIO.recordCrossSourceQuote(sym, source, price, pct, Date.now(), Object.assign({ reason: opts.reason || 'cross-source-validation' }, meta || {}));
      }
    } catch(_recordErr) {}
  }
  function _isKr(sym) { return /\.KS$|\.KQ$|^\d{6}$|\^KS11$|\^KQ11$/.test(sym); }
  function _isCrypto(sym) { return /^(BTC|ETH|SOL|BNB)-USD$/.test(sym); }
  function _isFx(sym) { return /=X$/.test(sym); }
  function _isStockLike(sym) { return !_isKr(sym) && !_isCrypto(sym) && !_isFx(sym) && !/^\^/.test(sym) && !/=F$/.test(sym) && /^[A-Z][A-Z0-9.-]{0,7}$/.test(sym); }
  function _stooqSymbol(sym) {
    if (sym === 'CL=F') return 'cl.f';
    if (sym === 'BZ=F') return 'bz.f';
    if (sym === 'GC=F') return 'gc.f';
    if (sym === 'SI=F') return 'si.f';
    if (sym === 'NG=F') return 'ng.f';
    if (sym === 'HG=F') return 'hg.f';
    if (sym === 'DX-Y.NYB' || sym === 'DX=F') return 'dx.f';
    if (_isStockLike(sym)) return sym.replace(/[^A-Z0-9]/g, '').toLowerCase() + '.us';
    return null;
  }
  async function _fetchJson(url, ms) {
    var r = await fetchWithTimeout(url, {}, ms || 6500);
    if (!r || !r.ok) return null;
    return r.json();
  }
  async function _fetchText(url, ms) {
    var r;
    try { r = await fetchWithTimeout(url, {}, ms || 6500); } catch(e) { r = await fetchViaProxy(url, (ms || 6500) + 2000); }
    if (!r || !r.ok) return null;
    var text = await r.text();
    if (text && text.charAt(0) === '{') {
      try { var j = JSON.parse(text); text = j.contents || text; } catch(_parseProxy) {}
    }
    return text;
  }
  async function _yahooCross(sym) {
    if (!_isKr(sym)) return false;
    try {
      var d = await _fetchJson('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1m&range=1d', 6500);
      var result = d && d.chart && d.chart.result && d.chart.result[0];
      var meta = result && result.meta;
      var price = meta && (meta.regularMarketPrice || meta.previousClose);
      var prev = meta && meta.previousClose;
      var pct = price && prev ? (price - prev) / prev * 100 : null;
      if (price > 0) { _record(sym, 'yahoo:cross-chart', price, pct, { previousClose: prev || null }); return true; }
    } catch(_yahooErr) {}
    return false;
  }
  async function _stooqCross(sym) {
    var st = _stooqSymbol(sym);
    if (!st) return false;
    try {
      var text = await _fetchText('https://stooq.com/q/l/?s=' + encodeURIComponent(st) + '&f=sd2t2ohlcv&h&e=csv', 6500);
      if (!text) return false;
      var line = text.trim().split('\n')[1];
      if (!line) return false;
      var cols = line.split(',');
      if (cols.length < 8 || cols[1] === 'N/D') return false;
      var close = parseFloat(cols[6]) || parseFloat(cols[7]);
      var open = parseFloat(cols[3]) || parseFloat(cols[4]);
      if (sym === 'HG=F' && close > 100 && open > 100) { close = close / 100; open = open / 100; }
      var pct = close > 0 && open > 0 ? (close - open) / open * 100 : null;
      if (close > 0) { _record(sym, 'stooq:eod-cross', close, pct, { delayed: true, previousClose: open || null }); return true; }
    } catch(_stooqErr) {}
    return false;
  }
  async function _finnhubCross(sym) {
    if (!finnhubKey || !_isStockLike(sym)) return false;
    try {
      var d = await _fetchJson('https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(sym) + '&token=' + encodeURIComponent(finnhubKey), 6500);
      if (d && d.c > 0) {
        var pct = d.pc > 0 ? (d.c - d.pc) / d.pc * 100 : null;
        _record(sym, 'finnhub:quote-cross', d.c, pct, { previousClose: d.pc || null });
        return true;
      }
    } catch(_fhErr) {}
    return false;
  }
  async function _fmpCross(sym) {
    if (!fmpKey || !_isStockLike(sym)) return false;
    try {
      var d = await _fetchJson('https://financialmodelingprep.com/api/v3/quote/' + encodeURIComponent(sym) + '?apikey=' + encodeURIComponent(fmpKey), 6500);
      var row = Array.isArray(d) ? d[0] : null;
      if (row && row.price > 0) {
        _record(sym, 'fmp:quote-cross', row.price, row.changesPercentage != null ? row.changesPercentage : null, { previousClose: row.previousClose || null });
        return true;
      }
    } catch(_fmpErr) {}
    return false;
  }
  async function _coingeckoCross(sym) {
    if (!_isCrypto(sym)) return false;
    var map = {'BTC-USD':'bitcoin','ETH-USD':'ethereum','SOL-USD':'solana','BNB-USD':'binancecoin'};
    try {
      var id = map[sym];
      var d = await _fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=' + encodeURIComponent(id) + '&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true', 6500);
      var row = d && d[id];
      if (row && row.usd > 0) {
        _record(sym, 'coingecko:cross-simple-price', row.usd, row.usd_24h_change != null ? row.usd_24h_change : null, { delayed: false, sourceTs: row.last_updated_at || null });
        return true;
      }
    } catch(_cgErr) {}
    return false;
  }
  async function _fxCross(sym) {
    if (!_isFx(sym)) return false;
    var codeBySym = {'KRW=X':'KRW','JPY=X':'JPY','EURUSD=X':'EUR','GBPUSD=X':'GBP','CNY=X':'CNY','AUDUSD=X':'AUD','CAD=X':'CAD','CHF=X':'CHF'};
    var code = codeBySym[sym];
    if (!code) return false;
    var inverted = {'EURUSD=X':1,'GBPUSD=X':1,'AUDUSD=X':1};
    var ok = false;
    async function one(url, source) {
      try {
        var d = await _fetchJson(url, 6000);
        var raw = d && d.rates && d.rates[code];
        var price = raw > 0 ? (inverted[sym] ? 1 / raw : raw) : null;
        if (price > 0) { _record(sym, source, price, null, {}); ok = true; }
      } catch(_fxOne) {}
    }
    await Promise.allSettled([
      one('https://open.er-api.com/v6/latest/USD', 'fx:open.er-api-cross'),
      one('https://api.exchangerate-api.com/v4/latest/USD', 'fx:exchangerate-api-cross')
    ]);
    return ok;
  }
  async function _runOne(sym) {
    var bucket = cache[sym];
    if (!opts.force && bucket && bucket.lastFetchAt && now - bucket.lastFetchAt < 3 * 60 * 1000) {
      return window.AIO.getCrossSourceQuoteValidation(sym);
    }
    cache[sym] = bucket || { symbol: sym, sources: {}, updatedAt: 0 };
    cache[sym].lastFetchAt = now;
    await Promise.allSettled([
      _yahooCross(sym),
      _stooqCross(sym),
      _finnhubCross(sym),
      _fmpCross(sym),
      _coingeckoCross(sym),
      _fxCross(sym)
    ]);
    var truth = null;
    try { if (window.AIO && typeof window.AIO.evaluateDataTruth === 'function') truth = window.AIO.evaluateDataTruth(sym); } catch(_truthEval) {}
    return truth || (window.AIO && typeof window.AIO.getCrossSourceQuoteValidation === 'function' ? window.AIO.getCrossSourceQuoteValidation(sym) : null);
  }

  var rows = [];
  for (var i = 0; i < symbols.length; i += 4) {
    var chunk = symbols.slice(i, i + 4);
    var settled = await Promise.allSettled(chunk.map(_runOne));
    settled.forEach(function(r) { if (r.status === 'fulfilled' && r.value) rows.push(r.value); });
  }
  return {
    status: rows.some(function(r) { return r.status === 'blocked' || r.status === 'mismatch'; }) ? 'blocked' : (rows.some(function(r) { return r.status === 'warn' || r.status === 'warn_mismatch' || r.status === 'single_source'; }) ? 'warn' : 'verified'),
    total: symbols.length,
    rows: rows,
    generatedAt: new Date().toISOString()
  };
};


// ── Dynamic VIX Percentile ──────────────────────────────────────
// Historical VIX distribution approximation (1990-2026)
// v49.1 P186: VIX → 백분위수 변환 (1990-2026 역사적 분포 근사)
var _VIX_BREAKPOINTS = [
  [8, 1], [10, 5], [12, 12], [14, 22], [16, 35],
  [18, 48], [20, 58], [22, 67], [25, 77], [28, 84],
  [30, 88], [35, 93], [40, 96], [50, 98], [80, 99.5]
];
function vixToPercentile(vix) {
  // Approximate CDF based on historical VIX distribution
  var bp = _VIX_BREAKPOINTS;
  for (var i = 0; i < bp.length - 1; i++) {
    var v0 = bp[i][0], p0 = bp[i][1], v1 = bp[i+1][0], p1 = bp[i+1][1];
    if (vix <= v1) {
      var t = (vix - v0) / (v1 - v0);
      return Math.round((p0 + t * (p1 - p0)) * 10) / 10;
    }
  }
  // v49.1 P186: 80+ 외삽 개선 — 로그 곡선으로 단조 증가 (기존 99.5 하드캡 제거)
  // p = 100 - 0.5 * (80/vix)² → VIX=80→99.5, VIX=100→99.68, VIX=150→99.82, ∞→100
  return Math.min(99.99, Math.round((100 - 0.5 * Math.pow(80 / vix, 2)) * 10) / 10);
}
// v49.1 P186: AIO.diag.vixDistFit() — VIX 분포 적합 진단
if (window.AIO && window.AIO.diag) {
  window.AIO.diag.vixDistFit = function() {
    var bp = _VIX_BREAKPOINTS;
    var samples = [10, 15, 20, 25, 30, 40, 50, 60, 80, 100];
    return {
      breakpoints: bp,
      samples: samples.map(function(v) { return { vix: v, pct: vixToPercentile(v) }; }),
      note: '80이하: 선형보간. 80초과: p=100-0.5*(80/vix)^2 로그외삽'
    };
  };
}

// v50.28/WO-7: VIX 퍼센타일을 "실측 52주 분포"로 — history.json에 60일+ 누적 시 그 분포 내 현재 VIX의
// 순위(IV Rank 본래 의미)를 계산, 부족하면 null → 호출자는 기존 고정 CDF vixToPercentile로 폴백.
// (현재 history 1일 → 항상 null → 동작 변화 0. ~60거래일 누적 시 자동으로 실측 기반 전환.)
function _aioVixPercentile(vix) {
  try {
    if (typeof vix !== 'number' || !isFinite(vix)) return null;
    var series = (typeof _aioHistorySeries === 'function') ? _aioHistorySeries('vix', 60) : null;
    if (!series) return null;
    var vals = series.map(function(p) { return p.value; }).filter(function(v) { return typeof v === 'number' && isFinite(v); });
    if (vals.length < 60) return null;
    var below = 0;
    for (var i = 0; i < vals.length; i++) { if (vals[i] <= vix) below++; }
    return Math.round((below / vals.length) * 1000) / 10; // 0~100, 0.1 단위
  } catch (e) { return null; }
}
window._aioVixPercentile = _aioVixPercentile;

function vixRegime(vix) {
  if (vix < 12) return { label: 'Subdued', color: '#00e5a0' };
  if (vix < 16) return { label: 'Low', color: '#00bcd4' };
  if (vix < 20) return { label: 'Normal', color: '#a8b5c8' };
  if (vix < 25) return { label: 'Elevated', color: '#ffa31a' };
  if (vix < 30) return { label: 'Stressed', color: '#ffa31a' };
  if (vix < 40) return { label: 'Crisis', color: '#ff5b50' };
  return { label: 'Extreme', color: '#dc2626' };
}

// ═══════════════════════════════════════════════════════════════════
// v17: 정적 기본값 즉시 로드 — API 성공/실패 무관하게 항상 데이터 표시
// ═══════════════════════════════════════════════════════════════════
// v35.8: Risk Monitor 추가 항목 처리 (FALLBACK과 localStorage 캐시 양쪽에서 재사용)
function _applyRiskMonitorFallbacks() {
  // RSP/SPY 가격비율은 정규화된 시장폭·상대수익률이 아니므로 하드코딩 폴백을 쓰지 않는다.
  const rmRsp = document.getElementById('rm-rspratio-val');
  if (rmRsp && rmRsp.textContent === '—') {
    rmRsp.textContent = '—';
    rmRsp.style.color = 'var(--text-muted)';
  }
  // Fear & Greed (극단적 공포 구간)
  const rmFg = document.getElementById('rm-fg-val');
  if (rmFg && rmFg.textContent === '—') {
    rmFg.textContent = '18';
    rmFg.style.color = '#ff5b50';
  }
  // HY Spread 홈 카드 (FRED 미도착 시)
  const hySpread = document.getElementById('hy-spread-val');
  if (hySpread && hySpread.textContent === '—') {
    hySpread.textContent = '—';
    hySpread.title = 'FRED HY OAS 관측값 미수신 — 정적 bp를 현재값으로 대체하지 않음';
    hySpread.style.color = 'var(--text-muted)';
  }
}

function applyStaticFallbacks() {
  // v35.8: localStorage 캐시 우선 사용 — 하드코딩보다 최신 데이터
  // v48.2: TTL 48h → 24h 축소 + 만료 시 자동 삭제 (stale quote 방어 강화, P117)
  try {
    var cached = localStorage.getItem('aio_cached_quotes');
    if (cached) {
      var parsed = JSON.parse(cached);
      var ageHours = (Date.now() - parsed.ts) / 3600000;
      // v48.2: TTL 만료 자동 삭제 — 주말 연휴 등 24h+ 후에도 쌓인 stale 데이터가 UI에 표출되는 위험 차단
      if (ageHours >= 24) {
        try { localStorage.removeItem('aio_cached_quotes'); } catch(e) {}
        console.log('[AIO v48.2] 캐시 quote TTL(24h) 만료 — 자동 삭제');
      } else if (parsed.data && parsed.data.length > 50) {
        var cachedQuotes = parsed.data.map(function(f) {
          return { symbol: f.symbol, regularMarketPrice: f.regularMarketPrice, regularMarketChangePercent: f.regularMarketChangePercent, regularMarketChange: f.regularMarketPrice * f.regularMarketChangePercent / 100 };
        });
        applyLiveQuotes(cachedQuotes);
        var tsEl = document.getElementById('live-quote-ts');
        var ago = ageHours < 1 ? Math.round(ageHours * 60) + '분' : Math.round(ageHours) + '시간';
        if (tsEl) tsEl.textContent = '캐시 데이터 (' + ago + ' 전) · 실시간 연결 중...';
        console.log('[AIO v35.8] localStorage 캐시 폴백 사용 (' + parsed.data.length + '종목, ' + ago + ' 전)');
        // 하드코딩 폴백 건너뛰기 — 나머지 rm-rspratio 등은 계속 처리
        _applyRiskMonitorFallbacks();
        return;
      }
    }
  } catch(e) { _aioLog('warn', 'init', 'localStorage 캐시 로드 실패: ' + e.message); }

  // ── 하드코딩 폴백 (localStorage 없거나 48시간 초과 시) ──
  // 2026-04-04(금) 종가 기준 폴백 (v40.7 업데이트)
  // 실시간 데이터 도착 시 자동 교체됨 — 최대 10초 내 라이브 데이터로 전환
  // v49.51: stale hardcoded quote seeds are no longer allowed to populate live quote sinks.
  // DATA_SNAPSHOT is still seeded through applyDataSnapshot() with source='snapshot'; this path
  // only keeps non-price risk monitor placeholders from hanging forever.
  try {
    var tsElBlocked = document.getElementById('live-quote-ts');
    if (tsElBlocked) tsElBlocked.textContent = '실시간 시세 대기 중 · 오래된 하드코딩 가격 fallback 차단됨';
    window.AIO = window.AIO || {};
    window.AIO._lastStaticQuoteFallbackBlocked = {
      blocked: true,
      reason: 'hardcoded quote fallback disabled; wait for live/cache/snapshot source metadata',
      at: new Date().toISOString()
    };
  } catch(_blockedMeta) {}
  _applyRiskMonitorFallbacks();
  if (typeof _aioLog === 'function') _aioLog('warn', 'data', 'Hardcoded quote fallback blocked by v49.51 guard');
  return;


}

window.AIO = window.AIO || {};
window.AIO.getHardcodedQuoteFallbackAudit = function() {
  var src = '';
  try { src = String(applyStaticFallbacks); } catch(e) {}
  var hasLegacyTable = /const\s+FALLBACK_QUOTES\s*=\s*\[/.test(src);
  return {
    status: hasLegacyTable ? 'fail' : 'ok',
    issueCount: hasLegacyTable ? 1 : 0,
    legacyTablePresent: hasLegacyTable,
    blockedBeforeLegacy: !hasLegacyTable,
    note: hasLegacyTable
      ? 'Hardcoded quote fallback can populate or confuse live quote sinks.'
      : 'Legacy quote table removed; live/cache/artifact evidence is required.'
  };
};

function _aioLiveSym(v) {
  return String(v || '').trim().toUpperCase();
}

function _aioLiveDataFor(sym) {
  sym = _aioLiveSym(sym);
  var ld = window._liveData || {};
  return ld[sym] || ld[String(sym || '').trim()] || null;
}

// _aioLiveNum: Number(v) 변환 후 isFinite — 문자열 "42" 허용 (API 응답 원시값용)
// window._aioFiniteNum(aio-core.js): typeof v !== 'number' 선가드 — 내부 연산용, 타입 변환 없음
function _aioLiveNum(v) {
  var n = Number(v);
  return isFinite(n) ? n : null;
}
window._aioLiveNum = _aioLiveNum;

function _aioLivePrice(d) {
  if (!d) return null;
  return _aioLiveNum(d.price != null ? d.price : (d.regularMarketPrice != null ? d.regularMarketPrice : d.value));
}

function _aioLivePct(d) {
  if (!d) return null;
  return _aioLiveNum(d.pct != null ? d.pct : (d.changePct != null ? d.changePct : d.regularMarketChangePercent));
}

function _aioLiveTs(d) {
  if (!d) return Date.now();
  return d.ts || d.timestamp || d.lastUpdated || Date.now();
}

function _aioFormatLivePrice(sym, price) {
  sym = _aioLiveSym(sym);
  var max = price >= 1000 ? 2 : (price >= 10 ? 2 : 4);
  if (/^(\^TNX|\^TYX|\^FVX|\^IRX)$/.test(sym)) max = 3;
  if (/=X$/.test(sym)) max = price >= 100 ? 2 : 4;
  return Number(price).toLocaleString('en-US', { minimumFractionDigits: max <= 2 ? 2 : 0, maximumFractionDigits: max });
}

function _aioMarkLiveSink(el, sym, d, policyKey, unavailable) {
  if (!el) return;
  sym = _aioLiveSym(sym);
  var ds = (window._dataSource && window._dataSource[sym]) || d || {};
  var source = ds.source || d && (d.source || d._source) || (unavailable ? 'unavailable' : 'live:yahoo');
  var ts = ds.ts || _aioLiveTs(d);
  var contract = null;
  var truth = null;
  try {
    contract = ds.metric && ds.metric.contract ? ds.metric.contract :
      (window.AIO_OPERATIONAL_DATA_CONTRACT ? window.AIO_OPERATIONAL_DATA_CONTRACT.evaluateMetric({ source: source, ts: ts, policyKey: policyKey || 'quote' }) : null);
  } catch(_) {}
  try {
    truth = window.AIO && typeof window.AIO.evaluateDataTruth === 'function' ? window.AIO.evaluateDataTruth(sym, d, ds) : null;
  } catch(_) {}
  var truthOk = !truth || truth.decisionUse === true;
  el.setAttribute('data-source-kind', unavailable ? 'unavailable' : (contract && contract.sourceKind ? contract.sourceKind : (/snapshot|cache/i.test(source) ? 'snapshot' : 'live')));
  el.setAttribute('data-operational-use', (!unavailable && truthOk && contract && contract.allowedUse) ? 'decision' : (!unavailable && truthOk && !contract ? 'decision' : 'reference-only'));
  el.setAttribute('data-source-label', source);
  if (ts) el.setAttribute('data-source-ts', String(ts));
  if (truth) {
    el.setAttribute('data-truth-status', truth.status);
    el.setAttribute('data-truth-confidence', truth.confidence || '');
    el.setAttribute('data-truth-issues', (truth.issues || []).concat(truth.warnings || []).join('|'));
    if (truth.status === 'blocked') el.title = 'Data truth blocked: ' + (truth.issues || []).join(', ');
    else if (truth.status === 'warn' && !el.title) el.title = 'Data truth warning: ' + (truth.warnings || []).join(', ');
  }
  if (!unavailable && /unavailable|미수신|failed|실패/i.test(String(el.title || ''))) el.title = '';
}

function _aioSetLiveText(el, text) {
  if (!el) return;
  var target = el.children && el.children.length ? (el.querySelector('.pill-price') || el.querySelector('.kr-etf-price')) : null;
  if (target) target.textContent = text;
  else el.textContent = text;
}

function _aioLiveRoot(pageId) {
  var id = String(pageId || '').replace(/^page-/, '');
  if (!id) return document;
  try { return document.getElementById('page-' + id) || document; } catch(_) { return document; }
}

function _aioIsLivePlaceholder(text) {
  text = String(text || '').replace(/\s+/g, ' ').trim();
  return !text || text === '-' || text === '--' || text === '—' || text === 'N/A' || /\.{2,}/.test(text) || /loading|로딩|수신|계산|분석/i.test(text);
}

// P771/P772 / ARX-07: native macro and FX/bond primary sinks are rendered by
// src/ui/pages/market.js. Legacy global passes remain responsible for secondary
// surfaces only and use this shared fence to prevent last-writer races.
function _aioIsNativeBreadthElement(el) {
  try { return !!(el && el.closest && el.closest('#page-breadth[data-aio-architecture-renderer="native"]')); }
  catch (_) { return false; }
}
function _aioIsNativeFxbondElement(el) {
  try { return !!(el && el.closest && el.closest('#page-fxbond[data-aio-architecture-renderer="native"]')); }
  catch (_) { return false; }
}
function _aioIsNativeMacroElement(el) {
  try {
    return !!(el && el.closest && (el.closest('#page-macro[data-aio-architecture-renderer="native"]') || _aioIsNativeFxbondElement(el) || el.closest('#page-options[data-aio-architecture-renderer="native"]')));
  }
  catch (_) { return false; }
}
window._aioIsNativeMacroElement = _aioIsNativeMacroElement;
window._aioIsNativeFxbondElement = _aioIsNativeFxbondElement;
window._aioIsNativeBreadthElement = _aioIsNativeBreadthElement;

window.AIO = window.AIO || {};
window.AIO.applyLiveDataToDom = function(opts) {
  opts = opts || {};
  var root = _aioLiveRoot(opts.pageId);
  var stats = { touched: 0, filled: 0, missing: 0, missingSymbols: [], generatedAt: new Date().toISOString() };
  var seenMissing = {};
  function miss(sym) {
    sym = _aioLiveSym(sym);
    if (!sym || seenMissing[sym]) return;
    seenMissing[sym] = true;
    stats.missingSymbols.push(sym);
    stats.missing += 1;
  }
  try {
    Array.prototype.slice.call(root.querySelectorAll('[data-live-price]')).forEach(function(el) {
      if (_aioIsNativeMacroElement(el)) return;
      var sym = el.getAttribute('data-live-price');
      var d = _aioLiveDataFor(sym);
      var price = _aioLivePrice(d);
      stats.touched += 1;
      if (price != null) {
        _aioSetLiveText(el, _aioFormatLivePrice(sym, price));
        _aioMarkLiveSink(el, sym, d, 'quote', false);
        stats.filled += 1;
      } else {
        miss(sym);
        if (_aioIsLivePlaceholder(el.textContent)) _aioMarkLiveSink(el, sym, d, 'quote_missing', true);
      }
    });
    Array.prototype.slice.call(root.querySelectorAll('[data-live-chg],[data-live-pct]')).forEach(function(el) {
      if (_aioIsNativeMacroElement(el)) return;
      var sym = el.getAttribute('data-live-chg') || el.getAttribute('data-live-pct');
      var d = _aioLiveDataFor(sym);
      var pct = _aioLivePct(d);
      stats.touched += 1;
      if (pct != null) {
        el.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
        if (el.classList) {
          el.classList.remove('pos', 'neg');
          el.classList.add(pct >= 0 ? 'pos' : 'neg');
        }
        _aioMarkLiveSink(el, sym, d, 'quote', false);
        stats.filled += 1;
      } else {
        miss(sym);
        if (_aioIsLivePlaceholder(el.textContent)) _aioMarkLiveSink(el, sym, d, 'quote_change_missing', true);
      }
    });
    Array.prototype.slice.call(root.querySelectorAll('[data-live-field]')).forEach(function(el) {
      if (_aioIsNativeMacroElement(el)) return;
      var raw = el.getAttribute('data-live-field') || '';
      var parts = String(raw).split(':');
      var sym = parts[0];
      var field = parts[1] || 'price';
      var d = _aioLiveDataFor(sym);
      var val = d && d[field];
      if (val == null && field === 'price') val = _aioLivePrice(d);
      if (val == null && /pct|change/i.test(field)) val = _aioLivePct(d);
      stats.touched += 1;
      if (val != null) {
        el.textContent = typeof val === 'number' ? (field === 'price' ? _aioFormatLivePrice(sym, val) : String(Math.round(val * 100) / 100)) : String(val);
        _aioMarkLiveSink(el, sym, d, 'quote', false);
        stats.filled += 1;
      } else {
        miss(sym);
        if (_aioIsLivePlaceholder(el.textContent)) _aioMarkLiveSink(el, sym, d, 'quote_field_missing', true);
      }
    });
  } catch(e) {
    stats.error = e && e.message || String(e);
    stats.status = 'warn';
    return stats;
  }
  stats.status = stats.missing ? 'warn' : 'ok';
  try { if (window.AIO && typeof window.AIO.annotateLiveDataSinks === 'function') window.AIO.annotateLiveDataSinks(root, { force: true }); } catch(_) {}
  return stats;
};

window.AIO.verifyPageLiveDataBinding = function(opts) {
  opts = opts || {};
  var pageId = opts.pageId || opts.id || '';
  var root = _aioLiveRoot(pageId);
  var out = { pageId: pageId || null, total: 0, ok: 0, bindingMissing: [], sourceMissing: [], truthBlocked: [], generatedAt: new Date().toISOString() };
  try {
    Array.prototype.slice.call(root.querySelectorAll('[data-live-price],[data-live-chg],[data-live-pct],[data-live-field]')).forEach(function(el) {
      var sym = el.getAttribute('data-live-price') || el.getAttribute('data-live-chg') || el.getAttribute('data-live-pct') || (String(el.getAttribute('data-live-field') || '').split(':')[0]);
      sym = _aioLiveSym(sym);
      if (!sym) return;
      out.total += 1;
      var d = _aioLiveDataFor(sym);
      var hasSource = !!d && (_aioLivePrice(d) != null || _aioLivePct(d) != null || d.value != null);
      var textMissing = _aioIsLivePlaceholder(el.textContent);
      var truth = null;
      try { truth = window.AIO && typeof window.AIO.evaluateDataTruth === 'function' ? window.AIO.evaluateDataTruth(sym, d || {}, (window._dataSource && window._dataSource[sym]) || {}) : null; } catch(_) {}
      if (!hasSource) out.sourceMissing.push({ symbol: sym, id: el.id || '', attr: el.hasAttribute('data-live-price') ? 'price' : (el.hasAttribute('data-live-chg') ? 'chg' : (el.hasAttribute('data-live-pct') ? 'pct' : 'field')) });
      else if (truth && truth.status === 'blocked') out.truthBlocked.push({ symbol: sym, id: el.id || '', issues: truth.issues || [] });
      else if (textMissing) out.bindingMissing.push({ symbol: sym, id: el.id || '', text: String(el.textContent || '').trim() });
      else out.ok += 1;
    });
  } catch(e) {
    out.error = e && e.message || String(e);
  }
  out.bindingMissingCount = out.bindingMissing.length;
  out.sourceMissingCount = out.sourceMissing.length;
  out.truthBlockedCount = out.truthBlocked.length;
  out.status = out.error || out.bindingMissingCount || out.sourceMissingCount || out.truthBlockedCount ? 'warn' : 'ok';
  return out;
};

window.AIO.verifyCritical10LiveBindings = function() {
  var pages = window.AIO_CRITICAL_10_PAGE_IDS || ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','fundamental','themes'];
  var audits = pages.map(function(pageId) { return window.AIO.verifyPageLiveDataBinding({ pageId: pageId }); });
  var bindingMissing = audits.reduce(function(n, a) { return n + (a.bindingMissingCount || 0); }, 0);
  var sourceMissing = audits.reduce(function(n, a) { return n + (a.sourceMissingCount || 0); }, 0);
  var truthBlocked = audits.reduce(function(n, a) { return n + (a.truthBlockedCount || 0); }, 0);
  return { status: bindingMissing || sourceMissing || truthBlocked ? 'warn' : 'ok', pagesChecked: audits.length, bindingMissingCount: bindingMissing, sourceMissingCount: sourceMissing, truthBlockedCount: truthBlocked, pages: audits, generatedAt: new Date().toISOString() };
};

window.AIO.repairPageLiveDataBinding = async function(opts) {
  opts = opts || {};
  var first = window.AIO.applyLiveDataToDom({ pageId: opts.pageId, reason: opts.reason || 'repair-live-binding', force: true });
  var audit = window.AIO.verifyPageLiveDataBinding({ pageId: opts.pageId });
  if (opts.retry && audit.sourceMissingCount && typeof fetchLiveQuotes === 'function' && !window._aioLiveBindingRepairInFlight) {
    var missing = Array.from(new Set(audit.sourceMissing.map(function(x) { return x.symbol; }))).slice(0, opts.limit || 160);
    if (missing.length) {
      window._aioLiveBindingRepairInFlight = true;
      var prev = window._aioQuoteRequestSymbols;
      try {
        window._aioQuoteRequestSymbols = missing.slice();
        await fetchLiveQuotes(missing);
      } catch(e) {
        audit.retryError = e && e.message || String(e);
      } finally {
        if (prev == null) delete window._aioQuoteRequestSymbols;
        else window._aioQuoteRequestSymbols = prev;
        window._aioLiveBindingRepairInFlight = false;
      }
      window.AIO.applyLiveDataToDom({ pageId: opts.pageId, reason: 'repair-live-binding-retry', force: true });
      audit = window.AIO.verifyPageLiveDataBinding({ pageId: opts.pageId });
    }
  }
  return { status: audit.status, applied: first, audit: audit, generatedAt: new Date().toISOString() };
};

// v53.59 P853: quote fields are an atomic producer envelope.  A price, change,
// percent, previous close, observation time, and source must be selected from
// the same producer revision before any store or DOM mutation happens.  The
// caller intentionally passes the cumulative quote array many times during a
// staged refresh; selecting here prevents an older Yahoo field from being
// merged with a newer Naver field on a later pass.
function _aioNormalizeAtomicQuote(input, now) {
  if (!input || !input.symbol) return null;
  var symbol = String(input.symbol).trim().toUpperCase();
  var price = Number(input.regularMarketPrice);
  if (!isFinite(price) || price <= 0) return null;
  var source = String(input._source || 'live:yahoo');
  var previous = Number(input.regularMarketPreviousClose || input.chartPreviousClose);
  if (!isFinite(previous) || previous <= 0) previous = null;
  var change = Number(input.regularMarketChange);
  if (!isFinite(change)) change = previous != null ? price - previous : null;
  var pct = Number(input.regularMarketChangePercent);
  if (!isFinite(pct)) pct = previous != null && isFinite(change) ? (change / previous) * 100 : null;
  if (previous != null) {
    var derivedPct = (price - previous) / previous * 100;
    // A producer is allowed to round its displayed percentage, but not to
    // disagree materially with its own price/previous-close pair.  Recompute
    // the derived field and record the correction instead of publishing a
    // mathematically inconsistent envelope.
    if (!isFinite(pct) || Math.abs(pct - derivedPct) > 0.25) {
      pct = derivedPct;
      input._atomicPctCorrected = true;
    }
    change = price - previous;
  }
  var observedRaw = input.observedAt || input.regularMarketTime || input.postMarketTime || input.preMarketTime || null;
  var observedMs = typeof observedRaw === 'string' ? new Date(observedRaw).getTime() : Number(observedRaw);
  if (isFinite(observedMs) && observedMs > 0 && observedMs < 1e12) observedMs *= 1000;
  if (!isFinite(observedMs) || observedMs <= 0) observedMs = null;
  var fetchedRaw = input.fetchedAt || now || Date.now();
  var fetchedMs = typeof fetchedRaw === 'string' ? new Date(fetchedRaw).getTime() : Number(fetchedRaw);
  if (!isFinite(fetchedMs) || fetchedMs <= 0) fetchedMs = now || Date.now();
  var isKrIndex = symbol === '^KS11' || symbol === '^KQ11';
  // KRX index change is decision-grade only when the same envelope carries a
  // previous close.  A lone price must never inherit a prior provider's pct.
  if (isKrIndex && previous == null) {
    pct = null;
    change = null;
  }
  var completeness = (previous != null ? 4 : 1) + (pct != null ? 2 : 0) + (change != null ? 1 : 0);
  return Object.assign({}, input, {
    symbol: symbol,
    regularMarketPrice: price,
    regularMarketPreviousClose: previous,
    chartPreviousClose: previous,
    regularMarketChange: change,
    regularMarketChangePercent: pct,
    _source: source,
    _atomicRevision: source + '|' + (observedMs || fetchedMs) + '|' + price + '|' + (previous == null ? 'na' : previous),
    _atomicObservedAt: observedMs ? new Date(observedMs).toISOString() : null,
    _atomicFetchedAt: new Date(fetchedMs).toISOString(),
    _atomicCompleteness: completeness
  });
}

function _aioAtomicSourceRank(symbol, source) {
  var s = String(source || '').toLowerCase();
  var kr = symbol === '^KS11' || symbol === '^KQ11' || /\.(ks|kq)$/.test(symbol);
  if (kr) {
    if (s === 'live:naver') return 100;
    if (s.indexOf('live:naver-') === 0) return 90;
    if (s.indexOf('live:yahoo') === 0) return 30;
    if (s.indexOf('live:stooq') === 0) return 20;
  }
  if (s === 'live:yahoo-v7-batch') return 100;
  if (s === 'live:yahoo-direct') return 95;
  if (s === 'live:yahoo-proxy') return 90;
  if (s.indexOf('live:yahoo') === 0) return 85;
  if (s.indexOf('live:coingecko') === 0) return 85;
  if (s.indexOf('live:stooq') === 0) return 50;
  return 10;
}

function _aioSelectAtomicQuotes(quotes, now) {
  var selected = new Map();
  (Array.isArray(quotes) ? quotes : []).forEach(function(input) {
    var candidate = _aioNormalizeAtomicQuote(input, now);
    if (!candidate) return;
    var current = selected.get(candidate.symbol);
    if (!current) {
      selected.set(candidate.symbol, candidate);
      return;
    }
    var rank = _aioAtomicSourceRank(candidate.symbol, candidate._source);
    var currentRank = _aioAtomicSourceRank(current.symbol, current._source);
    var candidateScore = rank * 100 + candidate._atomicCompleteness;
    var currentScore = currentRank * 100 + current._atomicCompleteness;
    var candidateFresh = Date.parse(candidate._atomicObservedAt || candidate._atomicFetchedAt) || 0;
    var currentFresh = Date.parse(current._atomicObservedAt || current._atomicFetchedAt) || 0;
    if (candidateScore > currentScore || (candidateScore === currentScore && candidateFresh >= currentFresh)) {
      selected.set(candidate.symbol, candidate);
    }
  });
  return Array.from(selected.values());
}

function applyLiveQuotes(quotes) {
  if (!Array.isArray(quotes)) return;
  window._liveData = window._liveData || {};
  window._quoteTimestamps = window._quoteTimestamps || {};
  window._previousPrices = window._previousPrices || {};
  // v30.11: 데이터 출처 추적 — 'live:yahoo' | 'live:coingecko' | 'fx:open.er-api' | 'snapshot'
  window._dataSource = window._dataSource || {};
  const now = Date.now();
  const atomicQuotes = _aioSelectAtomicQuotes(quotes, now);
  const _batchObservedTimes = atomicQuotes.map(function(q) { return Date.parse(q._atomicObservedAt || '') || 0; }).filter(Boolean);
  const _batchFetchedTimes = atomicQuotes.map(function(q) { return Date.parse(q._atomicFetchedAt || '') || 0; }).filter(Boolean);
  const _batchFetchedAt = _batchFetchedTimes.length ? Math.max.apply(null, _batchFetchedTimes) : now;
  const _quoteBatchRevision = 'browser-quote-batch:' + new Date(_batchFetchedAt).toISOString() + ':' + atomicQuotes.length;
  window.AIO._quoteBatchEpoch = {
    revision: _quoteBatchRevision,
    symbols: atomicQuotes.map(function(q) { return q.symbol; }).filter(Boolean),
    observationStart: _batchObservedTimes.length ? new Date(Math.min.apply(null, _batchObservedTimes)).toISOString() : null,
    observationEnd: _batchObservedTimes.length ? new Date(Math.max.apply(null, _batchObservedTimes)).toISOString() : null,
    fetchedAt: new Date(_batchFetchedAt).toISOString()
  };
  // v51.61: Yahoo symbol → [DATA_SNAPSHOT priceKey, pctKey] 매핑
  // data-live-price와 data-snap이 항상 동일 시각의 데이터를 표시하기 위한 구조적 브릿지
  var _LIVE_SNAP_MAP = {
    '^GSPC':    ['spx',      'spxPct'],
    '^IXIC':    ['nasdaq',   'nasdaqPct'],
    '^DJI':     ['dow',      'dowPct'],
    '^RUT':     ['rut',      'rutPct'],
    '^VIX':     ['vix',      'vixPct'],
    '^KS11':    ['kospi',    'kospiPct'],
    '^KQ11':    ['kosdaq',   'kosdaqPct'],
    'CL=F':     ['wti',      'wtiPct'],
    'BZ=F':     ['brent',    'brentPct'],
    'GC=F':     ['gold',     'goldPct'],
    'KRW=X':    ['krw',      'krwPct'],
    'DX-Y.NYB': ['dxy',      'dxyPct'],
    '^TNX':     ['tnx',      null],
    '^N225':    ['nikkei',   'nikkeiPct'],
    '^HSI':     ['hangseng', 'hangsengPct'],
    '^FTSE':    ['ftse',     'ftsePct'],
    'BTC-USD':  ['btc',      'btcPct'],
    'ETH-USD':  ['eth',      'ethPct'],
    'SI=F':     ['silver',   'silverPct']
  };

  atomicQuotes.forEach(q => {
    const rawPct = q.regularMarketChangePercent;
    const hasPct = (typeof rawPct === 'number' && isFinite(rawPct));
    const pct   = hasPct ? rawPct : null;
    const price = q.regularMarketPrice;
    if (typeof price !== 'number' || !isFinite(price) || price <= 0) return;

    // v31.8: PriceStore 검증 레이어 경유 (타입/범위/급변 전부 Store에서 처리)
    // KR 지수는 서버 Yahoo 배치와 브라우저 Naver가 합쳐진다. 프록시 캐시가 옛 값을
    // 늦게 반환해 현재 서버 종가를 덮어쓰지 않도록 큰 교차소스 충돌은 보류한다.
    if ((q.symbol === '^KS11' || q.symbol === '^KQ11') && q._source === 'live:naver') {
      var _priorKr = window._liveData[q.symbol];
      var _priorKrPrice = _priorKr && Number(_priorKr.price);
      var _priorKrSource = _priorKr && (_priorKr.source || _priorKr.provider || '');
      var _krDiff = _priorKrPrice > 0 ? Math.abs(price - _priorKrPrice) / _priorKrPrice : 0;
      if (_priorKrPrice > 0 && _priorKrSource !== 'live:naver' && _krDiff > 0.0075) {
        window._aioKrQuoteConflicts = window._aioKrQuoteConflicts || [];
        window._aioKrQuoteConflicts.push({ symbol:q.symbol, kept:_priorKrPrice, rejected:price, rejectedSource:'live:naver', diffPct:+(_krDiff * 100).toFixed(2), ts:now });
        _aioLog('warn', 'data', q.symbol + ' Naver/Yahoo 교차소스 ' + (_krDiff * 100).toFixed(2) + '% 충돌 — 기존 서버값 유지');
        return;
      }
    }
    // v53.9 P728: 아래 canonical batch DOM pass가 lineage annotation을 소유한다.
    const _quoteChangeBasis = q.changeBasis || q.valueBasis || ((q.regularMarketPreviousClose || q.chartPreviousClose) > 0 ? 'provider-previous-value' : 'unknown');
    const accepted = PriceStore.set(q.symbol, price, pct, q._source || 'live:yahoo', { deferDomAnnotation: true,
      revision: _quoteBatchRevision,
      observedAt: q._atomicObservedAt || q.observedAt || null,
      fetchedAt: q._atomicFetchedAt || q.fetchedAt || null,
      marketState: q.marketState || null,
      venue: q.fullExchangeName || q.exchangeName || null,
      regularMarketPreviousClose: q.regularMarketPreviousClose || q.chartPreviousClose || null,
      changeBasis: _quoteChangeBasis,
      valueBasis: q.valueBasis || _quoteChangeBasis
    });
    if (!accepted) return;
    if (q.symbol === '^VVIX' && window.DATA_SNAPSHOT) {
      window.DATA_SNAPSHOT.vvix = price;
      window.DATA_SNAPSHOT._fallback = window.DATA_SNAPSHOT._fallback || {};
      window.DATA_SNAPSHOT._fallback.vvix = price;
    }
    // v51.61: 주요 시세 → DATA_SNAPSHOT 실시간 동기화
    // data-live-price와 data-snap 요소가 항상 같은 시각의 데이터를 반영하도록 구조적 브릿지
    if (window.DATA_SNAPSHOT && _LIVE_SNAP_MAP[q.symbol]) {
      var _lsm = _LIVE_SNAP_MAP[q.symbol];
      window.DATA_SNAPSHOT[_lsm[0]] = price;
      window.DATA_SNAPSHOT._fallback = window.DATA_SNAPSHOT._fallback || {};
      if (Object.prototype.hasOwnProperty.call(window.DATA_SNAPSHOT._fallback, _lsm[0])) {
        window.DATA_SNAPSHOT._fallback[_lsm[0]] = price;
      }
       // Never retain an older snapshot percentage beside a newer live price.
       // Missing live change is explicitly unavailable until the same producer
       // supplies a complete envelope again.
       if (_lsm[1]) window.DATA_SNAPSHOT[_lsm[1]] = hasPct ? parseFloat(pct.toFixed(2)) : null;
      if (q.symbol === 'KRW=X') window.DATA_SNAPSHOT.krwRound = Math.round(price);
      if (q.symbol === 'GC=F' && hasPct) window.DATA_SNAPSHOT.goldWeeklyPct = parseFloat(pct.toFixed(2));
      // FABLE-LIVE-AUDIT-2026-07-07 C5/L2-2: 이 forEach는 Yahoo/Naver 등 여러 소스의 동일 심볼 quote를
      // 순서 구분 없이 훑으며 "나중에 처리되는 쪽이 승리"하는 구조였다. Yahoo의 ^KS11/^KQ11
      // chartPreviousClose는 미국 휴장일 인접 주간에 한 세션 어긋난 값을 반환하는 경우가 실측되어,
      // KRX 원천인 Naver(_source==='live:naver')가 한 번이라도 전일종가를 확정하면 그 값을
      // sticky하게 유지하고 이후 Yahoo 값이 이를 덮어쓰지 못하게 한다(전일종가는 하루 1회만 변함).
      if (q.symbol === '^KS11') {
        var _ksPrev = q.regularMarketPreviousClose || q.chartPreviousClose;
        var _ksIsNaver = (q._source === 'live:naver');
        if (_ksPrev > 0 && (_ksIsNaver || !window.DATA_SNAPSHOT._kospiPrevFromNaver)) {
          window.DATA_SNAPSHOT.kospiPrev = _ksPrev;
          if (_ksIsNaver) window.DATA_SNAPSHOT._kospiPrevFromNaver = true;
        } else if (!_ksPrev) {
          window.DATA_SNAPSHOT.kospiPrev = null;
          window.DATA_SNAPSHOT._kospiPrevFromNaver = false;
        }
      }
      if (q.symbol === '^KQ11') {
        var _kqPrev = q.regularMarketPreviousClose || q.chartPreviousClose;
        var _kqIsNaver = (q._source === 'live:naver');
        if (_kqPrev > 0 && (_kqIsNaver || !window.DATA_SNAPSHOT._kosdaqPrevFromNaver)) {
          window.DATA_SNAPSHOT.kosdaqPrev = _kqPrev;
          if (_kqIsNaver) window.DATA_SNAPSHOT._kosdaqPrevFromNaver = true;
        } else if (!_kqPrev) {
          window.DATA_SNAPSHOT.kosdaqPrev = null;
          window.DATA_SNAPSHOT._kosdaqPrevFromNaver = false;
        }
      }
    }
    window._previousPrices[q.symbol] = price;
    // v36.6: 프리/애프터마켓 시세 저장 (미국장 마감 후 방향성 추적)
    if (q.extPrice && q.extSession) {
      window._extHoursData = window._extHoursData || {};
      window._extHoursData[q.symbol] = { price: q.extPrice, pct: q.extPct != null ? q.extPct : null, session: q.extSession, ts: now };
    }
    // v36.7: chartPreviousClose를 _liveData에 보존 (분석/해석용 종가 기준)
    if (q.chartPreviousClose && q.chartPreviousClose > 0) {
      window._liveData[q.symbol] = window._liveData[q.symbol] || {};
      window._liveData[q.symbol].chartPreviousClose = q.chartPreviousClose;
    }
    if (q.regularMarketPreviousClose && q.regularMarketPreviousClose > 0) {
      window._liveData[q.symbol] = window._liveData[q.symbol] || {};
      window._liveData[q.symbol].regularMarketPreviousClose = q.regularMarketPreviousClose;
    }
    // v53.6 (P724): v7 quote 확장 필드(52주 범위·당일 고저·거래량) 보존 — PriceStore.set은
    // price/pct만 저장하므로 이 필드들은 지금까지 _liveData에 남은 적이 없었고, 이를 1순위
    // 소스로 읽는 fundamental 가격 포지션 카드(aio-ui.js)와 ticker 종목 개요 52주 범위가
    // 영구 결측이었다. 위 prevClose 보존과 동일 패턴으로 수신 시에만 복사(합성 없음).
    ['fiftyTwoWeekHigh','fiftyTwoWeekLow','regularMarketDayHigh','regularMarketDayLow','regularMarketVolume','averageDailyVolume3Month','averageDailyVolume10Day'].forEach(function(_xk) {
      var _xv = Number(q[_xk]);
      if (isFinite(_xv) && _xv > 0) {
        window._liveData[q.symbol] = window._liveData[q.symbol] || {};
        window._liveData[q.symbol][_xk] = _xv;
      }
    });
    // Fetch time and market observation time are distinct. Preserve provider market-state/timezone
    // metadata so intraday snapshots cannot look like later closing observations merely because
    // data.json itself was fetched recently.
    var _rawObsTs = q.observedAt || q.regularMarketTime || q.postMarketTime || q.preMarketTime || null;
    var _parsedObsMs = typeof _rawObsTs === 'string' ? new Date(_rawObsTs).getTime() : Number(_rawObsTs);
    var _obsMs = _parsedObsMs ? (_parsedObsMs < 1e12 ? _parsedObsMs * 1000 : _parsedObsMs) : null;
    window._liveData[q.symbol] = window._liveData[q.symbol] || {};
    Object.assign(window._liveData[q.symbol], { quoteEnvelope: {
      revision: _quoteBatchRevision,
      source: q._source,
      price: price,
      change: isFinite(q.regularMarketChange) ? q.regularMarketChange : null,
      pct: hasPct ? pct : null,
      previousClose: isFinite(q.regularMarketPreviousClose) ? q.regularMarketPreviousClose : null,
      observedAt: q._atomicObservedAt,
      fetchedAt: q._atomicFetchedAt,
      changeBasis: _quoteChangeBasis,
      valueBasis: q.valueBasis || _quoteChangeBasis
    } });
    if (_obsMs && isFinite(_obsMs)) window._liveData[q.symbol].observedAt = new Date(_obsMs).toISOString();
    if (q.marketState) window._liveData[q.symbol].marketState = q.marketState;
    if (q.exchangeTimezoneName) window._liveData[q.symbol].exchangeTimezoneName = q.exchangeTimezoneName;
    if (q.fullExchangeName) window._liveData[q.symbol].fullExchangeName = q.fullExchangeName;
    if (q.fetchedAt) window._liveData[q.symbol].fetchedAt = q.fetchedAt;
    if (typeof q.delayedByMs === 'number') window._liveData[q.symbol].delayedByMs = q.delayedByMs;
    // v30.14: 환율 심볼의 chartPreviousClose를 _fxPrevClose에 자동 보정
    // Yahoo chart API에서 가져온 chartPreviousClose로 환율 변화율 즉시 계산 가능하게 함
    if (q.chartPreviousClose && q.chartPreviousClose > 0 && q.symbol.includes('=X')) {
      window._fxPrevClose = window._fxPrevClose || {};
      if (!window._fxPrevClose[q.symbol] || window._fxPrevClose[q.symbol] <= 0) {
        window._fxPrevClose[q.symbol] = q.chartPreviousClose;
      }
    }
    // v30.11: 데이터 출처 기록
    var _storedMetric = window._liveData && window._liveData[q.symbol] && window._liveData[q.symbol].metric;
    window._dataSource[q.symbol] = {
      source: q._source || 'live:yahoo',
      ts: now,
      pctMissing: !hasPct,
      policyKey: 'quote',
      metric: _storedMetric || null,
      previousClose: isFinite(q.regularMarketPreviousClose) ? q.regularMarketPreviousClose : null,
      rawQuoteTs: _rawObsTs,
      observedAt: _obsMs && isFinite(_obsMs) ? new Date(_obsMs).toISOString() : null,
      marketState: q.marketState || null,
      exchangeTimezoneName: q.exchangeTimezoneName || null,
      exchange: q.fullExchangeName || q.venue || null,
      fetchedAt: q.fetchedAt || null,
      delayedByMs: typeof q.delayedByMs === 'number' ? q.delayedByMs : null,
      allowedUse: q.allowedUse || null
    };
    try {
      if (window.AIO && typeof window.AIO.recordCrossSourceQuote === 'function') {
        window.AIO.recordCrossSourceQuote(q.symbol, q._source || 'live:yahoo', price, pct, now, {
          previousClose: q.regularMarketPreviousClose || q.chartPreviousClose || null,
          rawQuoteTs: q.regularMarketTime || q.postMarketTime || q.preMarketTime || null,
          delayed: /stooq|eod/i.test(String(q._source || ''))
        });
      }
    } catch(_quoteCrossRecordErr) {}
    try {
      if (window.AIO && typeof window.AIO.evaluateDataTruth === 'function') {
        var _truth = window.AIO.evaluateDataTruth(q.symbol, window._liveData[q.symbol], window._dataSource[q.symbol]);
        window._liveData[q.symbol].truth = _truth;
      }
    } catch(_truthErr) {}
    const pctStr = hasPct ? ((pct >= 0 ? '+' : '') + pct.toFixed(2) + '%') : '—';
    const cls    = hasPct ? (pct >= 0 ? 'pnl pos' : 'pnl neg') : 'pnl neutral';
    // Track SPX vs ATH for Market Regime display
    if (q.symbol === '^GSPC') {
      window._spxATH = Math.max(_aioSpxAthFloor(), q.regularMarketPrice);  // v50.24/WO-2: 단일 출처 헬퍼 (stale 하드코딩 제거, P498)
      const SPX_ATH = window._spxATH;
      const spxPrice = q.regularMarketPrice;
      const pctFromATH = ((spxPrice - SPX_ATH) / SPX_ATH * 100).toFixed(1);
      const regimeSub = document.getElementById('mkt-regime-sub');
      if (regimeSub) {
        // v50.24/WO-2: "Near ATH"는 -2% 이내만 — 그 아래는 정직한 라벨(소폭 하락/조정/하락장)
        var _athN = parseFloat(pctFromATH);
        var _athLbl = _athN < -20 ? '하락장(Bear)' : _athN < -10 ? '조정(Correction)' : _athN < -5 ? '조정' : _athN < -2 ? '소폭 하락' : 'Near ATH';
        regimeSub.textContent = 'ATH ' + (pctFromATH >= 0 ? '+' : '') + pctFromATH + '% · ' + _athLbl;
        // v49.64 P334: derived sink lineage (R114 가시 sink 보호)
        regimeSub.setAttribute('data-operational-use', 'decision');
        regimeSub.setAttribute('data-source-kind', 'derived');
        regimeSub.setAttribute('data-source-label', 'derived:spx-ath-gap');
        regimeSub.setAttribute('data-source-ts', String(now));
      }
    }
    // price 요소 — 스테일 데이터 지시자 포함
    const isMarketHours = (() => {
      try {
        if (typeof _getUsSession === 'function') return _getUsSession() === 'open';
      } catch(_session) {}
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const day = now.getDay();
      if (day === 0 || day === 6) return false; // 주말
      const hours = now.getHours();
      const mins = now.getMinutes();
      const time = hours * 60 + mins;
      return time >= 570 && time < 960; // 9:30am - 4:00pm EST
    })();
    const ageMs = now - (window._quoteTimestamps[q.symbol] || now);
    const isStale = isMarketHours && ageMs > 5 * 60 * 1000; // > 5 min during market hours
    document.querySelectorAll(`[data-live-price="${q.symbol}"]`).forEach(el => {
      if (_aioIsNativeMacroElement(el)) return;
      // v48.43: 이전 값과 비교 — flash 애니메이션 (상승:녹색/하락:빨강)
      var _prevText = el.textContent;
      var _prevNum = parseFloat(_prevText.replace(/[^\d.-]/g, ''));
      // v38.3: P24 일반 보호 — children 있는 복합 요소는 전용 업데이트에 위임
      if (el.children.length > 0) {
        var _pp = el.querySelector('.pill-price') || el.querySelector('.kr-etf-price');
        if (_pp) _pp.textContent = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else { el.textContent = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
      var _contract = null;
      try {
        _contract = _storedMetric && _storedMetric.contract ? _storedMetric.contract :
          (window.AIO_OPERATIONAL_DATA_CONTRACT ? window.AIO_OPERATIONAL_DATA_CONTRACT.evaluateMetric({ source: q._source || 'live:yahoo', ts: now, policyKey: 'quote' }) : null);
      } catch(_qContract) {}
      el.setAttribute('data-source-kind', _contract && _contract.sourceKind ? _contract.sourceKind : 'live');
      el.setAttribute('data-operational-use', _contract && _contract.allowedUse ? 'decision' : 'reference-only');
      el.setAttribute('data-source-label', q._source || 'live:yahoo');
      el.setAttribute('data-source-ts', String(now));
      // v48.43: flash 애니메이션 트리거 (유의미한 변화 시)
      if (isFinite(_prevNum) && _prevNum > 0 && Math.abs(price - _prevNum) / _prevNum > 0.0001) {
        el.classList.remove('aio-flash-up', 'aio-flash-down');
        void el.offsetWidth; // reflow 강제 (애니메이션 재시작)
        el.classList.add(price > _prevNum ? 'aio-flash-up' : 'aio-flash-down');
        setTimeout(function() { el.classList.remove('aio-flash-up', 'aio-flash-down'); }, 950);
      }
      if (isStale) {
        el.style.borderBottom = '2px dashed var(--yellow)';
        el.title = `가격 갱신: ${new Date(window._quoteTimestamps[q.symbol]).toLocaleTimeString('ko-KR')} — 현재: ${new Date().toLocaleTimeString('ko-KR')}`;
      } else {
        el.style.borderBottom = '';
      }
    });
    // change 요소
    document.querySelectorAll(`[data-live-chg="${q.symbol}"]`).forEach(el => {
      if (_aioIsNativeMacroElement(el)) return;
      el.textContent = pctStr;
      if (el.classList) {
        el.classList.remove('pos', 'neg');
        if (hasPct) el.classList.add(pct >= 0 ? 'pos' : 'neg');
      } else {
        el.className = cls;
      }
      var _chgContract = null;
      try {
        _chgContract = _storedMetric && _storedMetric.contract ? _storedMetric.contract :
          (window.AIO_OPERATIONAL_DATA_CONTRACT ? window.AIO_OPERATIONAL_DATA_CONTRACT.evaluateMetric({ source: q._source || 'live:yahoo', ts: now, policyKey: hasPct ? 'quote' : 'quote_change_missing' }) : null);
      } catch(_chgContractErr) {}
      el.setAttribute('data-source-kind', hasPct ? (_chgContract && _chgContract.sourceKind ? _chgContract.sourceKind : 'live') : 'unavailable');
      el.setAttribute('data-operational-use', hasPct && _chgContract && _chgContract.allowedUse ? 'decision' : 'reference-only');
      el.setAttribute('data-source-label', q._source || 'live:yahoo');
      el.setAttribute('data-source-ts', String(now));
      // P561/R252: kr-home "KOSPI 상위 상승/하락" cards are a static curated list with a live
      // price/pct overlay — membership never re-sorts, so a stock whose live sign has since
      // flipped (a "gainer" now actually down) would otherwise sit unflagged under the wrong
      // header. Flag the specific card visually instead of silently leaving the contradiction.
      if (hasPct) {
        var _krCard = el.closest('.kr-screen-card');
        if (_krCard) {
          var _krWidget = _krCard.closest('.aio-widget');
          var _krTitle = _krWidget && _krWidget.querySelector('.widget-title');
          var _krTxt = _krTitle ? _krTitle.textContent : '';
          var _expectUp = _krTxt.indexOf('상승') >= 0;
          var _expectDown = _krTxt.indexOf('하락') >= 0;
          var _mismatch = (_expectUp && pct < 0) || (_expectDown && pct > 0);
          _krCard.classList.toggle('kr-sign-mismatch', !!_mismatch);
        }
      }
    });
    var previousClose = Number(q.regularMarketPreviousClose || q.chartPreviousClose);
    if (isFinite(previousClose) && previousClose > 0) {
      document.querySelectorAll(`[data-live-prev-close="${q.symbol}"]`).forEach(function(el) {
        el.textContent = previousClose.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
        el.setAttribute('data-source-kind', 'live');
        el.setAttribute('data-operational-use', 'decision');
        el.setAttribute('data-source-label', q._source || 'live:yahoo');
        el.setAttribute('data-source-ts', String(now));
      });
      var atomicDelta = price - previousClose;
      var atomicPct = atomicDelta / previousClose * 100;
      document.querySelectorAll(`[data-live-kr-change="${q.symbol}"]`).forEach(function(el) {
        el.textContent = (atomicDelta >= 0 ? '▲ ' : '▼ ')
          + Math.abs(atomicDelta).toLocaleString('ko-KR', { maximumFractionDigits: 2 })
          + ' (' + (atomicPct >= 0 ? '+' : '') + atomicPct.toFixed(2) + '%)';
        el.style.color = atomicDelta >= 0 ? 'var(--green)' : 'var(--red)';
        el.setAttribute('data-source-kind', 'live');
        el.setAttribute('data-operational-use', 'decision');
        el.setAttribute('data-source-label', q._source || 'live:yahoo');
        el.setAttribute('data-source-ts', String(now));
      });
    }
    // v36.8: 개별 종목 시간외 표시 — 기업분석(ticker-detail) 화면 전용
    if (q.extPrice && q.extSession) {
      // ticker-hero (기업분석 페이지)의 시간외 표시 전용 영역
      var _extHeroEl = document.getElementById('ticker-hero-ext');
      if (_extHeroEl && _extHeroEl.dataset.aioTickerExtensionRenderer !== 'native' && _currentTickerSym === q.symbol) {
        var _usS = (typeof _getUsSession === 'function') ? _getUsSession() : 'open';
        var extPctVal = q.extPct != null ? q.extPct : null;
        var extLabel = q.extSession === 'pre' ? 'Pre' : 'After';
        var extColor = extPctVal != null ? (extPctVal >= 0 ? '#00e5a0' : '#ff5b50') : 'var(--text-muted)';
        if (_usS === 'pre' || _usS === 'after') {
          _extHeroEl.innerHTML = '<span style="font-size:11px;color:#94a3b8;">종가 ' +
            price.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</span>' +
            '<span style="font-size:11px;color:#64748b;margin:0 4px;">→</span>' +
            '<span style="font-size:11px;color:#a78bfa;margin-right:3px;">' + extLabel + '</span>' +
            '<span style="font-size:10px;color:' + extColor + ';font-weight:700;font-family:var(--font-mono);">' +
            q.extPrice.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) +
            ' (' + (extPctVal != null ? (extPctVal >= 0 ? '+' : '') + extPctVal.toFixed(2) + '%' : '—') + ')</span>';
          _extHeroEl.style.display = '';
        } else {
          _extHeroEl.style.display = 'none';
        }
      }
    }
    // v36.8: 시장 지수 — RTH 외 시간에 "종가" 라벨 + 선물 참고 표시
    var _INDEX_FUTURES_MAP = {'^GSPC':'ES=F', '^IXIC':'NQ=F', '^DJI':'YM=F'};
    var _futSym = _INDEX_FUTURES_MAP[q.symbol];
    if (_futSym) {
      var _usS2 = (typeof _getUsSession === 'function') ? _getUsSession() : 'open';
      if (_usS2 !== 'open') {
        // 지수는 종가 그대로 표시 (이미 위에서 regularMarketPrice로 설정됨) + "종가" 라벨
        document.querySelectorAll(`[data-live-price="${q.symbol}"]`).forEach(el => {
          el.title = '종가 기준 — 정규장 마감가';
        });
        // 선물 시세를 참고 정보로 표시 (data-idx-futures 영역)
        var _futD = (window._liveData || {})[_futSym];
        if (_futD && _futD.price) {
          document.querySelectorAll(`[data-idx-futures="${q.symbol}"]`).forEach(el => {
            var fPct = _futD.pct != null ? _futD.pct : 0;
            var fColor = fPct >= 0 ? '#00e5a0' : '#ff5b50';
            var sessLabel = _usS2 === 'pre' ? '프리' : _usS2 === 'after' ? '애프터' : '시간외';
            el.innerHTML = '<span style="font-size:11px;color:#a78bfa;">선물(' + sessLabel + ')</span> ' +
              '<span style="font-size:11px;color:' + fColor + ';font-family:var(--font-mono);">' +
              _futD.price.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) +
              ' (' + (fPct >= 0 ? '+' : '') + fPct.toFixed(2) + '%)</span>';
            el.style.display = '';
          });
        }
      } else {
        // 정규장 중이면 선물 참고 숨김
        document.querySelectorAll(`[data-idx-futures="${q.symbol}"]`).forEach(el => {
          el.style.display = 'none';
        });
      }
    }
    // HOME 스냅샷 카드 테두리 색 업데이트

    // Dynamic HY spread from HYG price
    if (q.symbol === 'HYG') {
      const hygPrice = q.regularMarketPrice;
      const spreadBp = Math.round(Math.max(150, (82.5 - hygPrice) * 80 + 240));
      const hsVal = document.getElementById('hy-spread-val');
      const hsSub = document.getElementById('hy-spread-sub');
      if (hsVal) {
        const hsCol = spreadBp < 300 ? '#00e5a0' : spreadBp < 450 ? '#ffa31a' : '#ff5b50';
        hsVal.textContent = '+' + spreadBp + 'bp';
        hsVal.style.color = hsCol;
        if (hsSub) hsSub.textContent = spreadBp < 300 ? 'Tight' : spreadBp < 450 ? 'Elevated · 경계' : 'Distressed · 위험';
      }
    }
    const snapMap = { '^GSPC':'snap-gspc', '^IXIC':'snap-ixic', 'CL=F':'snap-oil', 'GC=F':'snap-gold', 'BTC-USD':'snap-btc' };
    const cardId = snapMap[q.symbol];
    if (cardId) {
      const card = document.getElementById(cardId);
      if (card) card.style.borderLeftColor = pct >= 0 ? '#00e5a0' : '#ff5b50';
    }
  });
  // VIX 별도 처리 — v45.6: _liveData/DATA_SNAPSHOT 폴백 추가
  var vixQ = atomicQuotes.find(q => q.symbol === '^VIX');
  if (!vixQ) {
    var _vld = (window._liveData || {})['^VIX'];
    if (_vld && _vld.price > 0) vixQ = { symbol: '^VIX', regularMarketPrice: _vld.price };
    else if (DATA_SNAPSHOT && DATA_SNAPSHOT.vix > 0) vixQ = { symbol: '^VIX', regularMarketPrice: DATA_SNAPSHOT.vix };
  }
  if (vixQ) {
    const _vixFixed = window._aioSafeFixed || function(v, d, fb) { const n = Number(v); return Number.isFinite(n) ? n.toFixed(d || 2) : (fb || '—'); };
    let vp = Number(vixQ.regularMarketPrice);
    if (!Number.isFinite(vp)) vp = Number(DATA_SNAPSHOT && DATA_SNAPSHOT.vix);
    if (!Number.isFinite(vp)) vp = 0;
    const lvl = vp >= 30 ? '패닉 (매우 위험)' : vp >= 25 ? '공포 (경계)' : vp >= 20 ? '불안 (주의)' : vp >= 15 ? '안정' : '과도한 낙관';
    const col = vp >= 30 ? '#dc2626' : vp >= 25 ? '#ffa31a' : vp >= 20 ? '#ffa31a' : '#00e5a0';
    const vixLbl = document.getElementById('snap-vix-lbl');
    const vixVal = document.getElementById('snap-vix-val');
    if (vixLbl) vixLbl.textContent = lvl;
    if (vixVal) { vixVal.textContent = _vixFixed(vp, 2, '—'); vixVal.style.color = col; }
    const vixCard = document.getElementById('snap-vix');
    if (vixCard) vixCard.style.borderLeftColor = col;
    // Update home page vol regime card
    const vrVal = document.getElementById('vol-regime-val');
    const vrSub = document.getElementById('vol-regime-sub');
    if (vrVal) { vrVal.textContent = vixRegime(vp).label; vrVal.style.color = col; }
    if (vrSub) vrSub.textContent = 'VIX ' + _vixFixed(vp, 2, '—') + ' · ' + vixToPercentile(vp) + '%ile';
    // v49.64 P334: VIX 파생 sink lineage (snap-vix-lbl/vol-regime-val/sub) — gauge 결과 표시
    var _vixTs = String(Date.now());
    [vixLbl, vrVal, vrSub].forEach(function(el) {
      if (!el) return;
      el.setAttribute('data-operational-use', 'decision');
      el.setAttribute('data-source-kind', 'derived');
      el.setAttribute('data-source-label', 'derived:vix-regime');
      el.setAttribute('data-source-ts', _vixTs);
    });
    // Update VIX %ile cell in radar table
    const vixPctCell = document.getElementById('vix-pct-cell');
    if (vixPctCell) {
      const pct = vixToPercentile(vp);
      vixPctCell.textContent = pct + '%ile · ' + vixRegime(vp).label;
      vixPctCell.style.color = col;
      vixPctCell.setAttribute('data-operational-use', 'decision');
      vixPctCell.setAttribute('data-source-kind', 'derived');
      vixPctCell.setAttribute('data-source-label', 'derived:vix-percentile');
      vixPctCell.setAttribute('data-source-ts', _vixTs);
    }
    document.querySelectorAll('[data-vix-badge]').forEach(el => el.textContent = 'VIX ' + _vixFixed(vp, 2, '—'));
    // ── Options 페이지 VIX %ile 동적 업데이트 (v14: 하드코딩 90.9%ile 제거) ──
    const optVixPct = vixToPercentile(vp);
    const optVixLbl = vixRegime(vp).label;
    document.querySelectorAll('.options-vix-pct-label').forEach(el => {
      el.textContent = optVixLbl + ' · ' + optVixPct + '%ile';
      el.style.color = col;
    });
    // 추가 하드코딩 셀 업데이트
    const vixPctTableCell = document.getElementById('vix-pct-table-cell');
    if (vixPctTableCell) {
      vixPctTableCell.textContent = optVixPct + '%ile';
      vixPctTableCell.style.color = col;
      // v49.64 P334: options 페이지 VIX %ile 셀 lineage
      vixPctTableCell.setAttribute('data-operational-use', 'decision');
      vixPctTableCell.setAttribute('data-source-kind', 'derived');
      vixPctTableCell.setAttribute('data-source-label', 'derived:vix-percentile');
      vixPctTableCell.setAttribute('data-source-ts', _vixTs);
    }
  }
  const tsEl = document.getElementById('live-quote-ts');
  if (tsEl) tsEl.textContent = new Date().toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  // v53.9 P728: per-symbol 반영 뒤의 두 번째 전체 price/chg rewrite를 제거한다.
  // data-live-field와 기존 sink 보정은 아래 canonical applyLiveDataToDom 1회가 담당한다.
  try {
    if (window.AIO && typeof window.AIO.applyLiveDataToDom === 'function') {
      window.AIO.applyLiveDataToDom({ reason: 'applyLiveQuotes', force: true });
    }
  } catch(_liveDomBindErr) {}

  // v34: 글로벌 마켓 오버뷰 신선도 타임스탬프 갱신
  window._liveQuoteTimestamp = Date.now();

  // v30.11: 신선도 뱃지 갱신
  _updateFreshnessBadges();

  // v31.9: Yahoo→FRED 실시간 브릿지 — FRED 지연 데이터를 Yahoo 실시간으로 보완
  _syncYahooToFred();

  // v35.8: 실시간 데이터 localStorage 캐시 — 다음 로드 시 폴백으로 활용
  try {
    var cacheData = quotes.map(function(q) {
      return { symbol: q.symbol, regularMarketPrice: q.regularMarketPrice, regularMarketChangePercent: q.regularMarketChangePercent };
    });
    localStorage.setItem('aio_cached_quotes', JSON.stringify({ ts: Date.now(), data: cacheData }));
  } catch(e) { /* localStorage 용량 초과 등 무시 */ }

  // Dispatch event for page-specific refresh
  document.dispatchEvent(new Event('aio:liveQuotes'));
  try { window.dispatchEvent(new CustomEvent('aio:liveQuotes', { detail: { count: quotes.length, timestamp: Date.now() } })); } catch(_) {}

  // v35.8: 스크리너 DB mcap/RSI 라이브 업데이트
  updateScreenerFromLiveData();

  // v35.8: 실시간 브리핑 갱신
  if (typeof generateDynamicBriefing === 'function') generateDynamicBriefing();

  // v51.61: DATA_SNAPSHOT 일괄 갱신 후 data-snap DOM 요소 재동기화
  // 모든 페이지의 data-snap 값이 data-live-price와 동일 시점 데이터를 표시
  try {
    if (typeof applyDataSnapshot === 'function') applyDataSnapshot(window.DATA_SNAPSHOT);
  } catch(_snapRefreshErr) {}

  // v51.66: _fieldTs.prices — 실시간 시세 마지막 적용 시각 기록
  if (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs) {
    window.DATA_SNAPSHOT._fieldTs.prices = new Date().toISOString();
  }
  // v51.66: 가격 갱신 후 신선도 UI 업데이트 (스크리너 듀얼 타임스탬프)
  try { if (typeof _aioRenderDataFreshness === 'function') _aioRenderDataFreshness(); } catch(_) {}
  // v51.67: 라이브 시세 갱신 후 트레이딩 스코어 delta 재계산
  try { if (typeof _aioRenderDeltas === 'function') _aioRenderDeltas(); } catch(_) {}
}

// ═══ v35.8: 동적 시장 브리핑 생성기 ═══════════════════════════════════
function generateDynamicBriefing() {
  var el = document.getElementById('dynamic-briefing-content');
  if (!el) return;
  var live = window._liveData || {};
  function metric(symbol) {
    var row = live[symbol];
    if (!row || row.price == null || !isFinite(Number(row.price)) || Number(row.price) <= 0) return null;
    return { symbol:symbol, price:Number(row.price), pct:row.pct == null || !isFinite(Number(row.pct)) ? null : Number(row.pct) };
  }
  function esc(v) { return String(v).replace(/[&<>"']/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function price(v, digits) { return v == null ? '—' : Number(v).toLocaleString('ko-KR', { maximumFractionDigits:digits }); }
  function pct(v) { return v == null ? '등락률 미수신' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }
  var specs = [
    ['^GSPC','S&P 500',0], ['^IXIC','NASDAQ',0], ['^VIX','VIX',1], ['^TNX','미 10Y',2],
    ['DX-Y.NYB','DXY',1], ['CL=F','WTI',1], ['GC=F','Gold',0], ['BTC-USD','Bitcoin',0],
    ['KRW=X','USD/KRW',0], ['^KS11','KOSPI',0]
  ];
  var rows = specs.map(function(s) { return { spec:s, value:metric(s[0]) }; }).filter(function(x) { return x.value; });
  if (!rows.length) {
    el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:11px;line-height:1.6;">실시간 시장 데이터 수신 대기 · 판단 보류</div>';
    el.setAttribute('data-source-kind', 'unavailable');
    el.setAttribute('data-operational-use', 'blocked');
    return;
  }
  var asOf = new Date().toLocaleString('ko-KR', { hour12:false });
  var html = '<div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;">라이브 관측치 · ' + esc(asOf) + '</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;">';
  rows.forEach(function(row) {
    var s = row.spec, v = row.value;
    var color = v.pct == null ? 'var(--text-primary)' : (v.pct >= 0 ? 'var(--data-green)' : 'var(--data-red)');
    html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:4px;padding:10px;">' +
      '<div style="font-size:10px;color:var(--text-muted);">' + esc(s[1]) + '</div>' +
      '<div style="font-size:17px;font-weight:800;font-family:var(--font-mono);color:' + color + ';">' + price(v.price, s[2]) + '</div>' +
      '<div style="font-size:10px;color:' + color + ';">' + pct(v.pct) + '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
  el.setAttribute('data-source-kind', 'live');
  el.setAttribute('data-operational-use', 'decision');
  el.setAttribute('data-source-ts', new Date().toISOString());
}

function updateScreenerFromLiveData() {
  if (!window._liveData || typeof SCREENER_DB === 'undefined') return;
  SCREENER_DB.forEach(function(item) {
    var ld = window._liveData[item.sym];
    if (!ld) return;
    if (ld.marketCap) {
      item.mcap = Math.round(ld.marketCap / 1e9);
      item._mcapObservedAt = ld.ts || ld.updatedAt || Date.now();
    }
    // RSI/팩터는 native screener state가 소유한다. 이 legacy 함수는 identity 호환 mcap만 갱신한다.
  });
  console.log('[AIO] 스크리너 DB mcap 라이브 업데이트 완료');
}

// Apply server-computed daily breadth only when observation time and coverage pass.
// This is an AIO US screener-universe measurement, not official exchange breadth.
function _aioApplyScreenerBreadth(sd) {
  var root = sd && sd.breadth;
  var b = root && root.segments && root.segments.us;
  var kr = root && root.segments && root.segments.kr;
  var observedMs = b && b.observedAt ? new Date(b.observedAt).getTime() : 0;
  var ageHours = observedMs ? (Date.now() - observedMs) / 3600000 : null;
  var valuesOk = b && ['above5','above20','above50','above200','advanceRatio'].every(function(k) {
    return typeof b[k] === 'number' && isFinite(b[k]) && b[k] >= 0 && b[k] <= (k === 'advanceRatio' ? 1 : 100);
  });
  var checks = {
    schema: !!(root && root.schemaVersion === '1.0'),
    coverage: !!(b && b.coveragePct >= 85 && b.eligible >= 300),
    observed: !!(observedMs && ageHours >= -1 && ageHours <= 96),
    values: !!valuesOk
  };
  var passed = Object.keys(checks).every(function(k){ return checks[k]; });
  window._aioScreenerBreadthState = {
    status: passed ? 'verified_current' : 'blocked',
    source: root && root.source || null,
    label: b && b.label || null,
    observedAt: b && b.observedAt || null,
    ageHours: ageHours,
    coveragePct: b && b.coveragePct,
    eligible: b && b.eligible,
    checks: checks,
    decisionScope: root && root.decisionScope || 'research/reference'
  };
  if (!passed) return false;

  window._breadth5 = b.above5;
  window._breadth20 = b.above20;
  window._breadth200 = b.above20; // legacy consumer name: this value is 20SMA breadth
  window._breadth50 = b.above50;
  window._breadth200Actual = b.above200;
  window._breadthLiveData = {
    sma5: b.above5,
    sma20: b.above20,
    sma50: b.above50,
    above200: b.above200,
    advances: b.advances,
    declines: b.declines,
    advanceRatio: b.advanceRatio,
    ts: observedMs,
    generatedAt: b.observedAt,
    source: root.source || b.label || 'AIO US screener universe',
    coveragePct: b.coveragePct,
    eligible: b.eligible
  };
  var krObservedMs = kr && kr.observedAt ? new Date(kr.observedAt).getTime() : 0;
  var krAgeHours = krObservedMs ? (Date.now() - krObservedMs) / 3600000 : null;
  var krValuesOk = kr && ['above5','above20','above50','above200','advanceRatio'].every(function(k) {
    return typeof kr[k] === 'number' && isFinite(kr[k]) && kr[k] >= 0 && kr[k] <= (k === 'advanceRatio' ? 1 : 100);
  });
  var krPassed = !!(krValuesOk && kr.coveragePct >= 85 && kr.eligible >= 100 && krAgeHours >= -1 && krAgeHours <= 96);
  window._krBreadthLiveData = krPassed ? {
    sma5: kr.above5, sma20: kr.above20, sma50: kr.above50, above200: kr.above200,
    advances: kr.advances, declines: kr.declines, unchanged: kr.unchanged,
    advanceRatio: kr.advanceRatio, ts: krObservedMs, observedAt: kr.observedAt,
    source: root.source || kr.label, label: kr.label,
    coveragePct: kr.coveragePct, eligible: kr.eligible,
    decisionScope: root.decisionScope || 'research/reference'
  } : null;
  window._lastFetch = window._lastFetch || {};
  window._lastFetch.breadthScreener = observedMs;
  if (window.DATA_SNAPSHOT) {
    window.DATA_SNAPSHOT.breadth5sma = b.above5;
    window.DATA_SNAPSHOT.breadth20sma = b.above20;
    window.DATA_SNAPSHOT.breadth50sma = b.above50;
    window.DATA_SNAPSHOT._fieldTs = window.DATA_SNAPSHOT._fieldTs || {};
    window.DATA_SNAPSHOT._fieldTs.breadth_screener = b.observedAt;
  }
  try {
    if (typeof updateBreadthUI === 'function') updateBreadthUI({
      advanceRatio: b.advanceRatio,
      gainers: b.advances,
      losers: b.declines,
      source: b.label
    });
    if (typeof window._aioSyncBreadth50Readout === 'function') window._aioSyncBreadth50Readout();
    if (typeof applyDataSnapshot === 'function') applyDataSnapshot();
    if (typeof updateBreadthBars === 'function') updateBreadthBars();
    // Native analysis owns the visible home/signal decision surfaces.  The
    // breadth producer still updates its canonical store, but must not trigger
    // a full legacy signal repaint across the 7k-node document during boot.
    var _nativeAnalysisRuntime = !!(window.__AIO_ARCH_RUNTIME__ && document &&
      document.querySelector('#page-signal[data-aio-architecture-renderer="native"], #page-home[data-aio-architecture-renderer="native"]'));
    if (!_nativeAnalysisRuntime && typeof refreshSignalDashboard === 'function') refreshSignalDashboard();
    if (typeof updateEntryChecklist === 'function') updateEntryChecklist();
    if (!_nativeAnalysisRuntime && typeof refreshHomeDashboard === 'function') refreshHomeDashboard();
    if (typeof updateKrBreadth === 'function') updateKrBreadth();
  } catch(_) {}
  return true;
}
window._aioApplyScreenerBreadth = _aioApplyScreenerBreadth;

// ── v50.52 Track2: 멀티팩터 랭킹 엔진 (기관/퀀트급) ──
// 정적 BUY/HOLD 태그(editorial)는 보존하고, 가격 파생 4팩터로 객관적 퀀트 랭크를 부가한다.
//   momentum(ret1/3/6m) · trend(가격 vs SMA50/200) · low-vol(연율 변동성, 역방향) · size(log mcap).
//   각 팩터를 섹터 상대 z-score(표본<5면 유니버스 상대) + winsorize(±3σ) → 가중합 → 0~100 percentile 랭크.
//   팩터 데이터(screener.json) 없으면 null → 소비자는 정적 signal 폴백(무회귀).
// v50.54 3A: 레짐 적응형 팩터 가중 — marketState(위험회피/선호/후기사이클)에 따라 가중 틸트.
//   위험회피: 저변동·퀄리티↑·모멘텀↓ / 위험선호: 모멘텀·추세↑·저변동↓ / 후기사이클: 밸류↑.
//   가중은 합=1 불요(_aioComputeFactorRanks가 present 팩터로 정규화). marketState 없으면 기본(무회귀).
window._aioFactorWeights = function(ms) {
  // P763/ARX-10 follow-up: storage/profile lookup remains here, but deterministic weight math
  // belongs to the native pure module and is shared by native + compatibility consumers.
  var _weightFn = window.AIO_ARCH && typeof window.AIO_ARCH.deriveFactorWeights === 'function' ? window.AIO_ARCH.deriveFactorWeights : null;
  if (!_weightFn) return null;
  try {
    var profileKey = localStorage.getItem('aio_trader_profile');
    if (profileKey && profileKey !== 'balanced' && typeof AIO_TRADER_PROFILES !== 'undefined') {
      var prof = AIO_TRADER_PROFILES[profileKey];
      if (prof && prof.weights) return _weightFn({ marketState: ms || null, profile: prof });
    }
  } catch(_) {}
  return _weightFn({ marketState: ms || null, profile: null });
};

function _aioComputeFactorRanks() {
  if (typeof SCREENER_DB === 'undefined') return null;
  // RM-03 continued (2026-07-21, P759): the ranking formula now has one executable owner in
  // src/domain/screener/factor-ranks.js. This legacy function only resolves its existing hidden
  // inputs, invokes the pure model, and projects the result back onto SCREENER_DB for the legacy
  // table/chat consumers. No formula fallback is retained here (R352/F-03); before the ESM
  // architecture runtime mounts, the old call sites fail closed and later route/data hooks retry.
  var _rankFn = window.AIO_ARCH && typeof window.AIO_ARCH.computeFactorRanks === 'function' ? window.AIO_ARCH.computeFactorRanks : null;
  if (!_rankFn) return null;
  var serverFundamentals = window._aioServerScreener || {};
  var W = (typeof _aioFactorWeights === 'function') ? _aioFactorWeights(window.AIO && window.AIO.marketState) : null;
  var weights = (W && W.weights) ? W.weights : { momentum:0.32, trend:0.23, lowvol:0.18, size:0.18, value:0, quality:0, kalman:0.09 };
  var result = _rankFn({
    rows: SCREENER_DB,
    weights: weights,
    regimeLabel: W ? W.regimeLabel : null,
    fundamentalCoveragePct: Number(serverFundamentals.fundamentalCoveragePct || 0),
    fmpOk: !!serverFundamentals.fmpOk,
    now: Date.now(),
    inputVersion: window._aioScreenerFactorAsOf || 'legacy-runtime'
  });
  if (!result || result.available === false) return null;
  var bySym = {};
  (result.rows || []).forEach(function(row){ bySym[row.sym] = row; });
  SCREENER_DB.forEach(function(row){
    var ranked = bySym[row && row.sym];
    if (!ranked) return;
    row._compositeZ = ranked._compositeZ;
    row.factorScores = ranked.factorScores;
    row.rank = ranked.rank;
    row.quantSignal = ranked.quantSignal;
    (result.activeFactors || []).forEach(function(key){ row['_z_' + key] = ranked['_z_' + key]; });
  });
  window._aioActiveFactorRegime = result.activeFactorRegime;
  window._aioActiveFactorWeights = result.activeFactorWeights;
  window._aioActiveFactors = result.activeFactors;
  window._aioInactiveFactorReasons = result.inactiveFactorReasons;
  window._aioFactorRanksAsOf = window._aioScreenerFactorAsOf || null;
  return { ranked: result.ranked, asOf: window._aioFactorRanksAsOf };
}
window._aioComputeFactorRanks = _aioComputeFactorRanks;

window.AIO = window.AIO || {};
window.AIO.getQuantReadinessAudit = function() {
  var state = window._aioScreenerLoadState || {};
  var server = window._aioServerScreener || {};
  var contract = server.rankingContract || {};
  var observedAt = state.factorObservedAt || server.factorObservedAt || null;
  var observedMs = observedAt ? new Date(observedAt).getTime() : 0;
  var observationAgeHours = observedMs ? Math.round((Date.now() - observedMs) / 3600000 * 10) / 10 : null;
  var coveragePct = state.universe ? Math.round((state.count || 0) / state.universe * 1000) / 10 : 0;
  var active = (window._aioActiveFactors || []).slice();
  var inactive = window._aioInactiveFactorReasons || {};
  var checks = {
    artifactLoaded: state.status === 'ready' || state.status === 'partial',
    observationCurrent: observationAgeHours != null && observationAgeHours >= -1 && observationAgeHours <= 96,
    coverage: coveragePct >= 90,
    activePriceFactors: ['momentum','trend','lowvol','kalman'].every(function(k){ return active.indexOf(k) !== -1; }),
    liveModelParity: contract.liveModelParity === true,
    predictiveValidation: contract.predictiveValidation === 'established'
  };
  var researchReady = checks.artifactLoaded && checks.observationCurrent && checks.coverage && checks.activePriceFactors;
  var tradingAllowed = researchReady && checks.liveModelParity && checks.predictiveValidation && contract.tradingSignal === true;
  return {
    status: tradingAllowed ? 'trading_ready' : (researchReady ? 'research_only' : 'blocked'),
    allowedUse: tradingAllowed ? 'trading' : (researchReady ? 'research-relative-ranking-only' : 'none'),
    tradingAllowed: tradingAllowed,
    researchReady: researchReady,
    factorObservedAt: observedAt,
    artifactGeneratedAt: state.asOf || server.asOf || null,
    observationAgeHours: observationAgeHours,
    coveragePct: coveragePct,
    activeFactors: active,
    inactiveFactorReasons: inactive,
    checks: checks,
    disclosure: tradingAllowed ? '실시간 모델 검증 완료' : '연구용 상대 랭킹이며 매매 신호 아님',
    reason: contract.reason || '라이브 모델과 장기 검증의 완전한 정합성·예측력이 확립되지 않음',
    evidenceArtifact: contract.evidenceArtifact || 'public-data/factor-backtest-longrun.json',
    generatedAt: new Date().toISOString()
  };
};

// ═══ v31.9: Yahoo→FRED 실시간 데이터 브릿지 ═════════════════════════
// FRED 데이터는 1~5일 지연. Yahoo에서 이미 실시간으로 가져오는 동일 데이터가 있으면
// FRED 값을 Yahoo 실시간 값으로 자동 대체하여 모든 하류 계산이 최신 데이터 사용
const _YAHOO_FRED_MAP = {
  // Yahoo심볼 → { fredId, transform(yahooPrice) → fredValue }
  '^TNX':     { fredId: 'DGS10',    transform: v => v,         label: '10Y 국채금리' },
  '^TYX':     { fredId: 'DGS30',    transform: v => v,         label: '30Y 국채금리' },
  '^FVX':     { fredId: 'DGS5',     transform: v => v,         label: '5Y 국채금리' },
  '^IRX':     { fredId: 'DGS3MO',   transform: v => v,         label: '3M 국채금리' },
  '^VIX':     { fredId: 'VIXCLS',   transform: v => v,         label: 'VIX' },
  'DX-Y.NYB': { fredId: 'DTWEXBGS', transform: v => v,         label: '달러인덱스' },
  // v51.91 P585/R266/C4: removed a 'HYG' entry that wrote a HYG-price-derived spread approximation
  // to a synthetic fredId ('_HY_PROXY') that no real FRED series uses and no code ever read back —
  // a confirmed dead write (this map's real entries are read via window._fredData[cfg.fredId], but
  // nothing ever queries '_HY_PROXY' specifically, and no code generically iterates _fredData/
  // MacroStore._data keys). The live, actually-consumed HY spread path is fetchHYSpread() (real FRED
  // BAMLH0A0HYM2 measurement -> window._hySpreadBp / DATA_SNAPSHOT.hySpread), whose priority over a
  // HYG-price approximation was already fixed by P576/R266.
};

function _syncYahooToFred() {
  const ld = window._liveData || {};
  const fd = window._fredData || {};
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let synced = 0;

  for (const [ySym, cfg] of Object.entries(_YAHOO_FRED_MAP)) {
    const yahoo = ld[ySym];
    if (!yahoo || !yahoo.price || yahoo.price <= 0) continue;

    const yahooVal = cfg.transform(yahoo.price);
    const fredEntry = fd[cfg.fredId];

    // FRED 데이터가 없거나 1영업일 이상 지연된 경우 Yahoo로 대체
    let fredStale = !fredEntry;
    if (fredEntry && fredEntry.date) {
      const fredDate = new Date(fredEntry.date);
      const diffDays = Math.floor((now - fredDate) / 86400000);
      fredStale = diffDays > 1; // 1일 초과면 stale
    }

    if (fredStale) {
      // Yahoo 실시간 값으로 FRED 파이프라인에 주입
      if (!window._fredData) window._fredData = {};
      const prevVal = fredEntry ? fredEntry.value : yahooVal;
      window._fredData[cfg.fredId] = {
        value: yahooVal,
        prevValue: fredEntry ? fredEntry.value : yahooVal,
        date: todayStr,
        _source: 'yahoo-realtime:' + ySym,
        _overrideTs: Date.now()
      };

      // MacroStore에도 동기화 (검증 우회 — Yahoo에서 이미 검증됨)
      if (window.MacroStore && MacroStore._data) {
        MacroStore._data[cfg.fredId] = {
          value: yahooVal,
          prevValue: prevVal,
          date: todayStr,
          source: 'yahoo-bridge'
        };
      }
      synced++;
    }
  }

  // DGS10 실시간 → 10Y-2Y 스프레드 자동 갱신
  const tnx = ld['^TNX'];
  if (tnx && tnx.price > 0 && !fd['T10Y2Y'] && window._live2Y != null && Number.isFinite(Number(window._live2Y))) {
    const y10 = tnx.price;
    const y2 = Number(window._live2Y);
    const spread10y2y = y10 - y2;
    if (!window._fredData) window._fredData = {};
    window._fredData['T10Y2Y'] = {
      value: spread10y2y,
      prevValue: fd['T10Y2Y'] ? fd['T10Y2Y'].value : spread10y2y,
      date: todayStr,
      _source: 'yahoo-calc:^TNX-DGS2'
    };
    // UI 즉시 갱신
    const spreadEl = document.getElementById('spread-2s10s-val');
    if (spreadEl) {
      spreadEl.textContent = (spread10y2y >= 0 ? '+' : '') + spread10y2y.toFixed(2) + '%';
      spreadEl.style.color = spread10y2y < 0 ? '#ff5b50' : '#00e5a0';
    }
  }

  // 10Y-3M 스프레드도 갱신
  const irx = ld['^IRX'];
  if (tnx && tnx.price > 0 && irx && irx.price > 0) {
    const spread10y3m = tnx.price - irx.price;
    if (!window._fredData) window._fredData = {};
    window._fredData['T10Y3M'] = {
      value: spread10y3m,
      prevValue: fd['T10Y3M'] ? fd['T10Y3M'].value : spread10y3m,
      date: todayStr,
      _source: 'yahoo-calc:^TNX-^IRX'
    };
  }

  if (synced > 0) {
    console.log('[AIO v31.9] Yahoo→FRED 실시간 브릿지:', synced + '개 시리즈 대체 (FRED 지연→Yahoo 실시간)');
    // FRED UI 재갱신 (Yahoo 실시간 값으로)
    if (typeof applyFredToUI === 'function') applyFredToUI(window._fredData);
  }
}

// ═══ v30.11: 데이터 신선도 뱃지 시스템 ═══════════════════════════════
// 각 data-live-price 요소 옆에 실시간/정적 구분 표시
function _getDataFreshness(symbol) {
  var src = (window._dataSource || {})[symbol];
  var ts  = (window._quoteTimestamps || {})[symbol];
  if (!src || !ts) {
    // 데이터 출처 없음 → 정적 폴백 사용 중
    return { level: 'snapshot', label: '정적', color: '#7b8599', title: '정적 스냅샷 데이터 (API 미연결)' };
  }
  var age = Date.now() - ts;
  var srcLabel = src.source || 'unknown';
  if (age < 120000) {
    return { level: 'live', label: '실시간', color: '#00e5a0', title: srcLabel + ' · ' + Math.round(age/1000) + '초 전' };
  }
  if (age < 600000) {
    var mins = Math.floor(age / 60000);
    return { level: 'recent', label: mins + '분전', color: '#ffa31a', title: srcLabel + ' · ' + mins + '분 전 갱신' };
  }
  var hrs = Math.floor(age / 3600000);
  var minR = Math.floor((age % 3600000) / 60000);
  return { level: 'stale', label: (hrs > 0 ? hrs + '시간' : minR + '분') + '전', color: '#ff5b50', title: srcLabel + ' · 갱신 지연' };
}

function _updateFreshnessBadges() {
  document.querySelectorAll('[data-live-price]').forEach(function(el) {
    var sym = el.getAttribute('data-live-price');
    var info = _getDataFreshness(sym);
    // dot 요소 찾기/생성
    var dot = el.parentElement ? el.parentElement.querySelector('.aio-src-dot[data-for="' + sym + '"]') : null;
    if (!dot && el.parentElement) {
      dot = document.createElement('span');
      dot.className = 'aio-src-dot';
      dot.setAttribute('data-for', sym);
      dot.style.cssText = 'display:inline-block;width:5px;height:5px;border-radius:50%;margin-left:3px;vertical-align:middle;cursor:help;';
      // 가격 요소 바로 뒤에 삽입
      if (el.nextSibling) {
        el.parentElement.insertBefore(dot, el.nextSibling);
      } else {
        el.parentElement.appendChild(dot);
      }
    }
    if (dot) {
      dot.style.background = info.color;
      dot.title = info.title;
    }
  });
}

// (showPage 훅은 showPage 함수 본문에 직접 포함됨)

// ── Trading Signal 페이지 ────────────────────────────────────────
function toggleSignalMode(mode) {
  _signalMode = mode; // Update global state
  const swBtn = document.getElementById('sig-sw-btn');
  const dyBtn = document.getElementById('sig-dy-btn');
  const desc  = document.getElementById('sig-mode-desc');
  // v52.65 아이보리 2a: 모드 필은 상태색이 아닌 무채 반전(ink bg + paper text)만 사용 (원칙 §1 — 색은 3계열만)
  if (mode === 'swing') {
    if (swBtn) { swBtn.classList.add('primary'); swBtn.style.background='var(--text-primary)'; swBtn.style.color='var(--bg-base)'; }
    if (dyBtn) { dyBtn.classList.remove('primary'); dyBtn.style.background='transparent'; dyBtn.style.color='var(--text-muted)'; }
    if (desc)  desc.textContent = '스윙 트레이딩 모드 · 임계값 60점 · 자동 갱신 45초';
  } else {
    if (dyBtn) { dyBtn.classList.add('primary'); dyBtn.style.background='var(--text-primary)'; dyBtn.style.color='var(--bg-base)'; }
    if (swBtn) { swBtn.classList.remove('primary'); swBtn.style.background='transparent'; swBtn.style.color='var(--text-muted)'; }
    if (desc)  desc.textContent = '데이 트레이딩 모드 · 임계값 65점 (더 엄격) · 자동 갱신 45초';
  }
}

let sigRefreshTimer = null;
let sigLastRefresh  = Date.now();

function refreshSignal() {
  sigLastRefresh = Date.now();
  const ts = document.getElementById('sig-ts');
  if (ts) ts.textContent = '갱신: 방금 전';
  // 이후 5초마다 경과 시간 표시 갱신
  // v48.91: 타이머 레지스트리 등록
  sigRefreshTimer = _aioRegisterTimer('sigRefresh', () => {
    const sec = Math.round((Date.now() - sigLastRefresh) / 1000);
    const ts2 = document.getElementById('sig-ts');
    if (ts2) {
      if (sec < 60) ts2.textContent = `갱신: ${sec}초 전`;
      else          ts2.textContent = `갱신: ${Math.floor(sec/60)}분 전`;
    }
  }, 5000);
}

// ═══ HOME PAGE DASHBOARD REFRESH ═══════════════════════════════════
// v52.65 아이보리 리디자인 1b: 종합 거래 점수 히어로 (레거시 _aioDiagram score-breakdown/market-regime
// 원형게이지+2x2쿼드런트 완전 대체). P787 transfers the four score/decision summary sinks to
// the native analysis renderer; factor details, quality meter, and other home surfaces remain legacy.
function _aioIsNativeHomeSummaryElement(el) {
  try { return !!(el && el.closest && el.closest('#page-home[data-aio-home-renderer="native"]')); } catch(_) { return false; }
}
window._aioIsNativeHomeSummaryElement = _aioIsNativeHomeSummaryElement;

function _aioRenderHomeHero() {
  var totalEl = document.querySelector('#home-hero-total');
  if (!totalEl) return;
  var nativeSummary = _aioIsNativeHomeSummaryElement(totalEl);
  var sc = {};
  try { sc = (typeof computeTradingScore === 'function') ? computeTradingScore() : {}; } catch(_) { sc = {}; }
  var total = Math.round(sc.total != null ? sc.total : (window._tradingScore != null ? window._tradingScore : 50));
  var clamp = function(v, lo, hi) { var n = Number(v); return Math.max(lo, Math.min(hi, isFinite(n) ? n : lo)); };
  var band = total >= 75 ? { label: '환경 우호', action: '현재 시장 환경 요약입니다. 종목별 근거·거래량·손익비·무효화 가격을 별도로 확인.' }
    : total >= 60 ? { label: '환경 양호', action: '점수 단독 진입 금지. 종목 품질과 이벤트 리스크를 추가 확인.' }
    : total >= 45 ? { label: '중립 · 관망', action: '신규 진입 자제. 기존 포지션 방어선과 손절을 먼저 확인.' }
    : total >= 30 ? { label: '주의 · 축소', action: '리스크 자산 비중 축소. 현금 비율 높이고 헤지 검토.' }
    : { label: '위험 · 방어', action: '신규 매수 중단. 방어 운용 후 스코어 45+ 복귀 확인 후 재개.' };
  if (sc.partial) band = { label: '판정 보류 · 부분 데이터', action: '미수신 구성요소(' + (sc.componentMissing || []).join(', ') + ')는 중립값으로만 계산한 참고 점수입니다. 진입 판단에 사용하지 않습니다.' };
  var ld = window._liveData || {};
  var vixPrice = (ld['^VIX'] && ld['^VIX'].price != null) ? ld['^VIX'].price : (window.DATA_SNAPSHOT ? window.DATA_SNAPSHOT.vix : null);
  var vixTxt = vixPrice != null ? 'VIX ' + Number(vixPrice).toFixed(1) : 'VIX 미수신';
  var spxPct = (ld['^GSPC'] && ld['^GSPC'].pct != null) ? Number(ld['^GSPC'].pct) : null;
  var spxTxt = spxPct != null ? ('S&P ' + (spxPct >= 0 ? '+' : '') + spxPct.toFixed(2) + '%') : '지수 방향 확인 중';

  if (!nativeSummary) {
    totalEl.textContent = String(total) + (sc.partial ? '*' : '');
    var headEl = document.querySelector('#home-hero-headline');
    if (headEl) headEl.textContent = band.label;
    var descEl = document.querySelector('#home-hero-desc');
    if (descEl) descEl.textContent = spxTxt + ' · ' + vixTxt + '. ' + band.action;
  }

  var compEl = document.getElementById('home-hero-components');
  if (compEl) {
    var comps = [
      { label: '변동성', v: Math.round(clamp(sc.volScore, 0, 100) * 0.25), max: 25 },
      { label: '추세', v: sc.trendScore == null ? null : Math.round(clamp(sc.trendScore, 0, 100) * 0.20), max: 20 },
      { label: '모멘텀', v: Math.round(clamp(sc.momScore, 0, 100) * 0.25), max: 25 },
      { label: '시장 폭', v: sc.breadthScore == null ? null : Math.round(clamp(sc.breadthScore, 0, 100) * 0.20), max: 20 },
      { label: '거시', v: Math.round(clamp(sc.macroScore, 0, 100) * 0.10), max: 10 }
    ];
    compEl.innerHTML = comps.map(function(c) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">' +
        '<span style="font-size:11.5px;color:var(--text-muted);">' + c.label + '</span>' +
        '<span style="font-size:12px;font-weight:600;color:' + (c.v == null ? 'var(--text-muted)' : 'var(--text-primary)') + ';font-variant-numeric:tabular-nums;">' + (c.v == null ? '—' : c.v) + ' / ' + c.max + '</span>' +
        '</div>';
    }).join('');
  }
}
window._aioRenderHomeHero = _aioRenderHomeHero;

function refreshHomeDashboard() {
  try { if (typeof _aioRenderOperatorNote === 'function') _aioRenderOperatorNote(); } catch(_) {}
  try { _aioRenderHomeHero(); } catch(_) {}
  const ld = window._liveData || {};
  const spx = ld['^GSPC'] || {};
  const vix = ld['^VIX'] || {};
  const dxy = ld['DX-Y.NYB'] || {};
  const _fgHomeMetric = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
  const fg = _fgHomeMetric && _fgHomeMetric.value != null ? _fgHomeMetric.value : 35;
  const ts = new Date();

  // SECTION 0: One-line market summary
  const _homeFixed = window._aioSafeFixed || function(v, d, fb) { const n = Number(v); return Number.isFinite(n) ? n.toFixed(d || 2) : (fb || '—'); };
  const _homeNum = function(v) { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const spxPct = _homeNum(spx.pct);
  const vixPrice = _homeNum(vix.price != null ? vix.price : DATA_SNAPSHOT.vix);
  const spxChg = spxPct != null ? _homeFixed(spxPct, 2, '—') : '—'; // R15: null vs 0% 구분
  const vixLevel = vixPrice != null ? _homeFixed(vixPrice, 2, String(DATA_SNAPSHOT.vix || '—')) : String(DATA_SNAPSHOT.vix || '—');
  const vixStatus = vixPrice != null ? (vixPrice < 15 ? '안정' : vixPrice < 20 ? '주의' : vixPrice < 25 ? '경계' : vixPrice < 30 ? '공포' : '극단공포') : '—';
  const marketMood = spxPct != null ? (spxPct > 0.5 ? '낙관' : spxPct < -0.5 ? '경계' : '관망') : '—';
  const summarytxt = spxChg !== '—'
    ? `S&P 500 ${parseFloat(spxChg) >= 0 ? '+' : ''}${spxChg}%, VIX ${vixLevel} ${vixStatus} — 시장 분위기: ${marketMood}`
    : `VIX ${vixLevel} ${vixStatus} — 시장 분위기: ${marketMood}`;
  const summaryEl = document.getElementById('home-summary-text');
  if (summaryEl) summaryEl.textContent = summarytxt;
  const summaryTimeEl = document.getElementById('home-summary-time');
  if (summaryTimeEl) summaryTimeEl.textContent = ts.toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'});

  // SECTION 1: Trading Decision Dashboard
  let tradingScore;
  if (typeof computeTradingScore === 'function') {
    try {
      const freshScores = computeTradingScore();
      tradingScore = freshScores.total;
      window._tradingScore = tradingScore;
    } catch(e) { tradingScore = window._tradingScore || 50; }
  } else {
    tradingScore = window._tradingScore || 50;
  }
  // P553/R244: "오늘 결론" 헤더(_aioRenderPageDecisionHeader)와 이 게이지가 서로 다른 이벤트
  // (aio:liveQuotes vs aio:marketStateUpdated)에서 독립 갱신되어 같은 화면에 다른 점수가
  // 동시에 보이던 문제 — 게이지가 갱신되는 시점에 헤더도 항상 함께 강제 재렌더해 절대 어긋나지 않게 한다.
  try { if (typeof window._aioRenderPageDecisionHeader === 'function') window._aioRenderPageDecisionHeader('home'); } catch(_) {}
  const signalEl = document.querySelector('#home-trading-signal');
  const explanEl = document.getElementById('home-trading-explanation');
  if (signalEl && !_aioIsNativeHomeSummaryElement(signalEl)) {
    // v50.50 [UX] 결론바·범례와 동일 5밴드 척도로 정렬 — 이전 YES/CAUTION/NO(>70/>50) 임계가 결론바(75/60/45/30)와
    //   모순(같은 62점이 카드 'CAUTION' vs 결론바 '선별매수')이라 사용자 혼란. 동일 라벨/임계로 통일.
    var sc = tradingScore;
    if (sc >= 75) {
      signalEl.textContent = '환경 우호'; signalEl.style.color = '#00e5a0';
      if (explanEl) explanEl.textContent = '현재 입력 조합이 우호적입니다. 예측·매수 신호가 아니며 종목별 근거 확인이 필요합니다.';
    } else if (sc >= 60) {
      signalEl.textContent = '환경 양호'; signalEl.style.color = '#4ade80';
      if (explanEl) explanEl.textContent = '시장 환경은 양호하지만 통계적 예측력은 미검증입니다. 점수 단독 진입은 금지합니다.';
    } else if (sc >= 45) {
      signalEl.textContent = '중립 · 관망'; signalEl.style.color = '#ffa31a';
      if (explanEl) explanEl.textContent = '신호 혼합 · 위험 관리 필수. 기존 포지션 유지, 신규 진입 자제.';
    } else if (sc >= 30) {
      signalEl.textContent = '주의 · 축소'; signalEl.style.color = '#ffa31a';
      if (explanEl) explanEl.textContent = '시장 품질 약화 · 신호 약함. 리스크 자산 비중 축소, 현금 확보.';
    } else {
      signalEl.textContent = '위험 · 방어'; signalEl.style.color = '#ff5b50';
      if (explanEl) explanEl.textContent = '극단 약세 구간 · 역사적으로 방어적 운용이 우선시되던 환경.' + (sc <= 25 ? ' 참고: 과거 유사 극단에서 이후 수익률이 높았던 사례가 있으나 보장이 아닙니다.' : '');
    }
  }

  // Market Regime
  const regimeEl = document.getElementById('home-market-regime');
  const regimeExplEl = document.getElementById('home-regime-explanation');
  if (regimeEl) {
    const SPX_ATH = _aioSpxAthFloor();  // v50.24/WO-2: 단일 출처 헬퍼 (L12303과 동일 floor — 레짐 오표시 방지)
    const spxPrice = Number(spx.price || (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.spx));
    if (!Number.isFinite(SPX_ATH) || !Number.isFinite(spxPrice) || SPX_ATH <= 0 || spxPrice <= 0) {
      regimeEl.textContent = '판정 보류';
      regimeEl.style.color = 'var(--text-muted)';
      if (regimeExplEl) regimeExplEl.textContent = 'S&P 500 현재값 또는 관측 ATH 미수신';
      return;
    }
    const pctFromATH = ((spxPrice - SPX_ATH) / SPX_ATH * 100);
    // v50.16: 'ATH 근처' 막연 → 실제 갭 + VIX 맥락 (사용자 지적: 이면까지). VIX는 라이브 우선.
    var _rVix = (ld && ld['^VIX'] && ld['^VIX'].price) ? ld['^VIX'].price : (window.DATA_SNAPSHOT ? window.DATA_SNAPSHOT.vix : NaN);
    var _rVixCtx = isNaN(_rVix) ? '' : (' · VIX ' + _rVix.toFixed(1) + (_rVix < 20 ? ' (정상)' : _rVix < 30 ? ' (경계)' : ' (공포)'));
    let regime = 'UPTREND', regimeColor = '#00e5a0', regimeDesc = 'ATH ' + (pctFromATH >= -0.5 ? '근접' : pctFromATH.toFixed(1) + '%') + _rVixCtx;
    if (pctFromATH < -20) { regime = 'DOWNTREND'; regimeColor = '#ff5b50'; regimeDesc = 'ATH ' + pctFromATH.toFixed(1) + '%'; }
    else if (pctFromATH < -10) { regime = 'CORRECTION'; regimeColor = '#ffa31a'; regimeDesc = 'ATH ' + pctFromATH.toFixed(1) + '%'; }
    else if (pctFromATH < -5) { regime = 'PULLBACK'; regimeColor = '#ffa31a'; regimeDesc = 'ATH ' + pctFromATH.toFixed(1) + '%'; }
    regimeEl.textContent = regime;
    regimeEl.style.color = regimeColor;
    // v35.4 B2: 국면별 역사적 참고 한 줄
    var _regimeRef = {
      'UPTREND': '',
      'PULLBACK': ' · 참고: 5~10% 조정은 연평균 3회 발생하는 정상 패턴',
      'CORRECTION': ' · 참고: 10~20% 조정 후 12개월 내 회복한 비율이 역사적으로 높음',
      'DOWNTREND': ' · 참고: 항복 매도(거래량 폭증+VIX 스파이크) 이후 12개월 수익률이 역사적으로 양(+)인 경우가 많음'
    };
    if (regimeExplEl) regimeExplEl.textContent = regimeDesc + (_regimeRef[regime] || '');

    // v49.28 E1 → v50.43: home Action Item 갱신을 단일 경로(_aioRefreshActionPlan)로 통합(dedup).
    //   이전엔 동일 ACTION_RULES 로직이 여기 + aio-core.js _aioRefreshActionPlan 두 곳에 중복. 한쪽만 고쳐지는 버그 클래스 제거.
    //   _aioRefreshActionPlan은 AIO.marketState.actionPlan(단일 두뇌) 우선 + 폴백 내장. Action Item 실패해도 home 렌더 차단 X.
    try { if (typeof window._aioRefreshActionPlan === 'function') window._aioRefreshActionPlan(); } catch(actErr) {}
    // v50.75: 실데이터 시장 팩터 히트맵 갱신
    try { if (typeof window._aioRenderMarketHeatmap === 'function') window._aioRenderMarketHeatmap('home-market-heatmap'); } catch(_) {}
    // v51.07: G×L 성장×유동성 판단 프레임
    try { if (typeof window._aioRenderGxLFrame === 'function') window._aioRenderGxLFrame(); } catch(_) {}

    // v34.5: 홈 상단 리스크 뱃지 동적 업데이트
    var riskBadge = document.getElementById('home-risk-regime-badge');
    if (riskBadge) {
      if (regime === 'DOWNTREND') { riskBadge.textContent = ' 하락추세'; riskBadge.className = 'status-pill sp-risk-off'; }
      else if (regime === 'CORRECTION') { riskBadge.textContent = ' 조정 국면'; riskBadge.className = 'status-pill sp-risk-off'; }
      else if (regime === 'PULLBACK') { riskBadge.textContent = ' 눌림 구간'; riskBadge.className = 'status-pill sp-neutral'; }
      else { riskBadge.textContent = ' 상승 추세'; riskBadge.className = 'status-pill sp-risk-on'; }
    }
  }

  // SECTION 2: VIX Status
  const vixValueEl = document.getElementById('home-vix-value');
  const vixStatusEl = document.getElementById('home-vix-status');
  if (vixValueEl) {
    const vp = _homeNum(vix.price != null ? vix.price : DATA_SNAPSHOT.vix);
    vixValueEl.textContent = _homeFixed(vp, 2, '—');
    const vixLabel = vp == null ? '—' : (vp >= 30 ? '극단공포' : vp >= 25 ? '공포' : vp >= 20 ? '경계' : vp >= 15 ? '주의' : '안정');
    const vixCol = vp == null ? '#7b8599' : (vp >= 30 ? '#dc2626' : vp >= 25 ? '#ffa31a' : vp >= 20 ? '#ffa31a' : '#00e5a0');
    vixValueEl.style.color = vixCol;
    if (vixStatusEl) vixStatusEl.textContent = vixLabel;
  }

  // Fear & Greed
  const fgScoreEl = document.querySelector('[id="home-fg-score"]');
  const fgLabelEl = document.getElementById('home-fg-label');
  if (fgScoreEl && fgScoreEl.dataset.aioHomeFearGreedRenderer !== 'native') {
    fgScoreEl.textContent = Math.round(fg);
    const fgColor = fg <= 25 ? '#dc2626' : fg <= 45 ? '#ffa31a' : fg <= 55 ? '#7b8599' : fg <= 75 ? '#86efac' : '#16a34a';
    fgScoreEl.style.color = fgColor;
    const fgLabel = fg <= 25 ? '극단적 공포' : fg <= 45 ? '공포' : fg <= 55 ? '중립' : fg <= 75 ? '탐욕' : '극단적 탐욕';
    if (fgLabelEl) fgLabelEl.textContent = fgLabel;
  }


  // v27.2: SECTION 4 — newsCache 기반으로 통합 (renderHomeFeed와 동일 메커니즘)
  // newsCache가 있으면 renderHomeFeed 호출, _newsItems 폴백은 유지
  const newsEl = document.getElementById('home-news-highlights');
  if (newsEl) {
    if (typeof newsCache !== 'undefined' && newsCache.length > 0) {
      renderHomeFeed(newsCache);
    } else if (window._newsItems && window._newsItems.length > 0) {
      const top3 = window._newsItems.slice(0, 3);
      newsEl.innerHTML = top3.map(item => {
        const sent = typeof getSentimentFromText === 'function' ? getSentimentFromText(item.headline || '') : 'neut';
        const sentColor = sent === 'bull' ? 'var(--data-green)' : sent === 'bear' ? 'var(--data-red)' : sent === 'warn' ? 'var(--data-amber)' : 'var(--text-muted)';
        const tickers = typeof getDisplayTickers === 'function' && item.title ? getDisplayTickers(item) : [];
        const tickerStr = tickers.length > 0 ? `<div style="margin-top:3px;">${tickers.map(t => `<span style="font-size:11px;font-weight:800;color:#60a5fa;font-family:var(--font-mono);background:var(--data-cyan-soft);padding:1px 4px;border-radius:3px;margin-right:2px;">${escHtml(t)}</span>`).join('')}</div>` : '';
        return `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:10px;border-top:2px solid ${sentColor};">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:700;">${escHtml(item.source || 'NEWS')}</div>
          <div style="font-size:11px;font-weight:600;line-height:1.3;margin-bottom:4px;">${escHtml(item.headline || '뉴스 수집 중')}</div>
          ${tickerStr}
          <div style="font-size:11px;color:var(--text-muted);">${escHtml(item.timeAgo || '방금')}</div>
        </div>`;
      }).join('');
    }
  }
}

// v53.15: page activation은 canonical aio:pageShown 이벤트만 구독한다.
// showPage 몽키패치는 typed navigation facade와 소유권이 충돌하므로 퇴역한다.
_aioPageBus.register('data-page-activation', 'aio:pageShown', function(e) {
  const detail = e && e.detail;
  const pageId = typeof detail === 'string' ? detail : detail && (detail.pageId || detail.route || detail.id);
  if (!pageId) return;
  if (pageId === 'home') {
    setTimeout(refreshHomeDashboard, 100);
  }
  // v48.51: Breadth 페이지 진입 시 9-canvas fallback 렌더러 실행
  if (pageId === 'breadth') {
    setTimeout(function(){
      if (typeof window._aioBreadthCanvasRender === 'function') {
        try { window._aioBreadthCanvasRender(); } catch(e) {}
      }
    }, 150);
  }
  // v48.59: FRED/BOK/KOSIS 지연 fetch (페이지 진입 시만)
  if (pageId === 'macro' || pageId === 'fxbond') {
    setTimeout(function(){
      if (typeof fetchAllFredData === 'function' && !window._fredData) {
        try { fetchAllFredData(); } catch(_){}
      }
    }, 500);
  }
  // v51.07: 엔캐리 언와인드 위험도 — FRED 로드 후 렌더 (600ms 지연)
  if (pageId === 'fxbond') {
    setTimeout(function(){ try { if (typeof window._aioRenderCarryUnwindRisk === 'function') window._aioRenderCarryUnwindRisk(); } catch(_){} }, 600);
  }
  if (pageId === 'macro') { // v53.7 (P725): KR 매크로 데이터는 macro 페이지 통합 섹션에서 사용
    setTimeout(function(){
      if (typeof fetchAllBokData === 'function' && !window._bokData) {
        try { fetchAllBokData(); } catch(_){}
      }
      if (typeof fetchAllKosisData === 'function' && !window._kosisData) {
        try { fetchAllKosisData(); } catch(_){}
      }
    }, 500);
  }
  // v51.08 BUG-1: 스크리너 첫 진입 시 빈 테이블 수정 — 랭킹 재계산 + 결과 렌더
  if (pageId === 'screener') {
    setTimeout(function(){
      try { if (typeof _aioComputeFactorRanks === 'function') _aioComputeFactorRanks(); } catch(_){}
      try { if (typeof renderScreenerResults === 'function') renderScreenerResults(); } catch(_){}
    }, 200);
  }
  // v51.08: market-news 페이지 진입 시 뉴스 캐시 재렌더 (백스톱 포함)
  if (pageId === 'market-news') {
    setTimeout(function(){
      try {
        if (newsCache && newsCache.length > 0) {
          _aioNotifyNewsSurfaceInvalidated('news-backstop');
        } else if (typeof _aioApplyNewsBackstop === 'function') {
          _aioApplyNewsBackstop(true);
        }
      } catch(_){}
    }, 150);
  }
});

// Update on live quote refresh
// v48.99: _aioPageBus 마이그 (P179)
_aioPageBus.register('data-home-live', 'aio:liveQuotes', function() {
  const activePage = document.querySelector('.page.active');
  if (activePage && activePage.id === 'page-home') {
    refreshHomeDashboard();
  }
});

// Initialize home dashboard on page show
_aioPageBus.register('data-home-shown', 'aio:pageShown', function(e) {
  if (e.detail === 'home') setTimeout(refreshHomeDashboard, 150);
});

// v51.36: 페이지 진입 시 텔레그램 피드 즉시 갱신
_aioPageBus.register('tg-feed-on-page-shown', 'aio:pageShown', function(e) {
  var pid = typeof e.detail === 'string' ? e.detail : (e.detail && (e.detail.pageId || e.detail.id)) || '';
  if (pid && _TG_PAGE_TAGS[pid]) setTimeout(function() { _aioInjectTelegramFeed(pid); }, 80);
});


// ── 시장 심리 지표 (Market Sentiment) ────────────────────────────────

// CNN Fear & Greed 실시간 Fetch
// v49.64 Codex L11347~11381 패턴 통합 (P331/P334): F&G 점수+출처 메타 단일 책임 함수
// 5 호출점(live/proxy/snapshot/historical/error)의 compatibility projection/event 갱신을 한 곳에서 처리.
// sentiment 페이지 표시와 evidence 정합성은 native renderer/orchestrator가 소유한다.
function _applyFearGreedScore(opts) {
  opts = opts || {};
  var score      = opts.score;
  var sourceKind = opts.sourceKind || 'unavailable';  // live | proxy | snapshot | unavailable
  var sourceLabel= opts.sourceLabel || 'cnn-fear-greed';
  var sourceTs   = opts.sourceTs || ((sourceKind === 'snapshot' || sourceKind === 'delayed') && typeof DATA_SNAPSHOT !== 'undefined' ? (DATA_SNAPSHOT._updated || DATA_SNAPSHOT._snapshotDate) : null) || new Date().toISOString();
  var operationalUse = opts.operationalUse || (sourceKind === 'live' ? 'decision' : sourceKind === 'proxy' ? 'decision' : 'reference-only');
  // H3-A canonical provenance: DOM lineage and decision engine read the same envelope.
  if (score != null && isFinite(score)) {
    var _fgTsNum = typeof sourceTs === 'number' && sourceTs < 100000000000 ? sourceTs * 1000 : new Date(sourceTs).getTime();
    window._lastFGMeta = {
      value: Number(score), source: sourceLabel, sourceKind: sourceKind, sourceLabel: sourceLabel,
      sourceTs: sourceTs, asOf: sourceTs, fetchedAt: (sourceKind === 'live' || sourceKind === 'proxy') ? Date.now() : null,
      freshnessClock: sourceKind === 'delayed' ? 'observation' : 'fetch', normalizedSourceTs: isFinite(_fgTsNum) ? _fgTsNum : null
    };
  }
  if (score != null && isFinite(score)) {
    window._lastFG = Number(score);
    try {
      if (window.AIO_ARCH && typeof window.AIO_ARCH.ingestSentiment === 'function') {
        window.AIO_ARCH.ingestSentiment({
          fearGreed: Number(score),
          fearGreedSourceKind: sourceKind,
          fearGreedSource: sourceLabel,
          fearGreedObservedAt: sourceTs,
          now: new Date().toISOString()
        });
      }
    } catch (_) {}
    document.dispatchEvent(new CustomEvent('aio:sentimentUpdated', { detail: { metric: 'fearGreed', sourceKind: sourceKind, sourceLabel: sourceLabel, operationalUse: operationalUse } }));
  }
  return { score: score, sourceKind: sourceKind, sourceLabel: sourceLabel, operationalUse: operationalUse };
}
window._applyFearGreedScore = _applyFearGreedScore;

async function fetchFearGreed() {
  const url   = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
  try {
    const resp = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 6000);
    if (!resp.ok) throw new Error('status ' + resp.status);
    const data = await resp.json();
    const fg   = data.fear_and_greed;
    if (!fg) throw new Error('no data');
    const score = Math.round(fg.score);
    _aioRenderLiveFearGreedDelta(score, fg.previous_close);
    // v48.0: CNN F&G 7개 서브컴포넌트 저장 — "왜 공포인가?" 설명용 + AI 프롬프트 품질 향상
    // CNN API가 제공: market_momentum_sp500, market_momentum_sp125, stock_price_strength,
    //                  stock_price_breadth, put_call_options, market_volatility_vix,
    //                  market_volatility_vix_50, junk_bond_demand, safe_haven_demand
    try {
      var _sub = {};
      ['market_momentum_sp500','market_momentum_sp125','stock_price_strength','stock_price_breadth','put_call_options','market_volatility_vix','market_volatility_vix_50','junk_bond_demand','safe_haven_demand'].forEach(function(k){
        if (data[k] && data[k].score != null) {
          _sub[k] = { score: Math.round(data[k].score), rating: data[k].rating || '', timestamp: data[k].timestamp || null };
        }
      });
      if (Object.keys(_sub).length > 0) {
        window._fgComponents = _sub;
        window._fgComponents._updated = Date.now();
      }
    } catch(subErr) { /* 서브컴포넌트는 옵셔널 — 실패해도 메인 score 갱신은 성공 */ }
    // v49.64 P334: 단일 helper로 sink + lineage 메타 일괄 적용 (live 경로)
    _applyFearGreedScore({ score: score, sourceKind: 'live', sourceLabel: 'cnn-fear-greed-api', sourceTs: fg.timestamp || data.timestamp || new Date().toISOString(), operationalUse: 'decision' });
    return true;
  } catch(e) {
    // Try CORS proxy
    try {
      const proxy = CORS_PROXY + encodeURIComponent(url);
      const r2    = await fetchWithTimeout(proxy, {}, 9000);
      const w     = await r2.json();
      var _fgRaw; try { _fgRaw = JSON.parse(w.contents || '{}'); } catch(pe) { _fgRaw = {}; }
      const data2 = _fgRaw;
      const fg2   = data2.fear_and_greed;
      if (fg2) {
        const score2 = Math.round(fg2.score);
        _aioRenderLiveFearGreedDelta(score2, fg2.previous_close);
        // v49.64 P334: helper 통합 (proxy 경로)
        _applyFearGreedScore({ score: score2, sourceKind: 'proxy', sourceLabel: 'cnn-fear-greed-proxy', sourceTs: fg2.timestamp || data2.timestamp || new Date().toISOString(), operationalUse: 'decision' });
      }
      // v37.8: 심리 복합 분석 갱신
      if (typeof _generateSentimentAnalysis === 'function') setTimeout(_generateSentimentAnalysis, 200);
      return true;
    } catch(e2) {
      // 서버 스냅샷이 이미 적용된 뒤 브라우저 직결/proxy가 실패해도 더 오래된 정적 seed로
      // 덮어쓰지 않는다. 실패는 새 값이 없다는 뜻이지 기존 외부 관측값을 무효화한다는 뜻이 아니다.
      var _fgExistingMeta = window._lastFGMeta || {};
      var _fgExistingKind = String(_fgExistingMeta.sourceKind || '').toLowerCase();
      if (/^(live|proxy|delayed)$/.test(_fgExistingKind) && window._lastFG != null && isFinite(Number(window._lastFG))) {
        if (typeof _generateSentimentAnalysis === 'function') setTimeout(_generateSentimentAnalysis, 200);
        return false;
      }
      // 외부 관측값이 전혀 없을 때만 정적 snapshot을 참고값으로 표시한다.
      var _snapFg = (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT.fg != null) ? DATA_SNAPSHOT.fg : ((typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._fallback) ? DATA_SNAPSHOT._fallback.fg : null);
      _applyFearGreedScore({ score: _snapFg, sourceKind: 'snapshot', sourceLabel: 'DATA_SNAPSHOT:fear-greed', sourceTs: (typeof DATA_SNAPSHOT !== 'undefined' && (DATA_SNAPSHOT._updated || DATA_SNAPSHOT._snapshotDate)) || null, operationalUse: 'reference-only' });
      if (typeof _generateSentimentAnalysis === 'function') setTimeout(_generateSentimentAnalysis, 200);
      return false;
    }
  }
}

// ═══ AUTO-UPDATE MOVING AVERAGES (50/200 SMA) ═══════════════════════
async function autoUpdateMA() {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/^GSPC?range=1y&interval=1d';
    const r = await fetchViaProxy(url, 8000);
    const rawText = typeof r.text === 'function' ? await r.text() : String(r);
    const trimmed = rawText.trim();
    if (!/^[\[{]/.test(trimmed)) {
      throw new Error('Yahoo chart returned non-JSON: ' + trimmed.slice(0, 80));
    }
    const json = JSON.parse(trimmed);
    const closes = (json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [])
      .filter(function(v) { return typeof v === 'number' && isFinite(v) && v > 0; });
    if (closes.length >= 200) {
      const ma200 = closes.slice(-200).reduce((a,b) => a+b, 0) / 200;
      const ma50  = closes.slice(-50).reduce((a,b) => a+b, 0) / 50;
      window._spxMA = {
        200: Math.round(ma200 * 100) / 100,
        50:  Math.round(ma50 * 100) / 100
      };
      window._spxMATs = Date.now();
      window._spxMASource = 'Yahoo ^GSPC observed daily closes';
      console.log('[AIO] MA auto-updated: 50SMA=' + window._spxMA[50] + ', 200SMA=' + window._spxMA[200]);
      if (typeof refreshHomeDashboard === 'function') refreshHomeDashboard();
    }
  } catch(e) {
    if (window.AIO && window.AIO.recordDataQualityIssue) {
      window.AIO.recordDataQualityIssue({ source: 'ma-auto-update', severity: 'warn', message: e.message || String(e) });
    }
    _aioLog('warn', 'render', 'MA auto-update failed: ' + (e.message || e));
  }
}
// v30.11: T7 _maAutoInterval 삭제 — REFRESH_SCHEDULE.maUpdate(6h)로 통합. 초기 5s 실행은 유지.
setTimeout(autoUpdateMA, 5000);

// ── HY Credit Spread auto-fetch via FRED (free, no API key needed) ───
function _aioPickNumber(row, keys) {
  row = row || {};
  for (var i = 0; i < keys.length; i++) {
    var raw = row[keys[i]];
    if (raw == null || raw === '') continue;
    var n = Number(String(raw).replace(/,/g, ''));
    if (isFinite(n)) return n;
  }
  return null;
}

function _aioPutCallTone(pcr) {
  if (pcr >= 1.2) return { color: 'var(--data-red)', label: '방어 심리 우세', narrative: '풋 수요가 강해 단기 위험 회피가 우세합니다.' };
  if (pcr >= 0.9) return { color: 'var(--data-amber)', label: '중립 상단', narrative: '중립권 상단으로 약간의 방어 포지셔닝이 섞여 있습니다.' };
  if (pcr >= 0.7) return { color: 'var(--data-green)', label: '중립 범위', narrative: '콜/풋 수요가 균형권에 있어 방향성 과열 신호는 제한적입니다.' };
  return { color: 'var(--data-cyan)', label: '콜 수요 우세', narrative: '콜 선호가 강해 위험 선호 또는 단기 낙관이 우세합니다.' };
}

function _aioUpdatePutCallDom(payload) {
  payload = payload || {};
  var pcr = Number(payload.totalPutCall);
  if (!isFinite(pcr)) return false;
  var text = pcr.toFixed(2);
  var tone = _aioPutCallTone(pcr);
  var sourceKind = payload.sourceKind || 'snapshot';
  var sourceLabel = payload.sourceLabel || (sourceKind === 'live' ? 'CBOE' : 'DATA_SNAPSHOT');
  var asOf = payload.asOf || new Date().toISOString();
  var metric = window.AIO && window.AIO.makeOperationalMetric
    ? window.AIO.makeOperationalMetric('putCallRatioTotal', pcr, sourceKind, asOf, sourceLabel, { domain: 'options' })
    : { name: 'putCallRatioTotal', value: pcr, sourceKind: sourceKind, sourceLabel: sourceLabel, ts: asOf, allowedUse: sourceKind === 'live' };

  ['regime-pcr', 'opt-pcr-val'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (_aioIsNativeMacroElement(el)) return;
    el.textContent = text;
    el.style.color = tone.color;
    el.setAttribute('data-source-kind', sourceKind);
    el.setAttribute('data-operational-use', metric.allowedUse ? 'decision' : 'reference-only');
  });

  Array.prototype.slice.call(document.querySelectorAll('[data-live-price="PCR"]')).forEach(function(el) {
    if (_aioIsNativeMacroElement(el)) return;
    el.textContent = text;
    el.style.color = tone.color;
    el.setAttribute('data-source-kind', sourceKind);
    el.setAttribute('data-operational-use', metric.allowedUse ? 'decision' : 'reference-only');
  });

  ['opt-pcr-desc', 'opt-pcr-desc-secondary'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = tone.label;
    el.style.color = tone.color;
  });

  var detail = document.getElementById('opt-pcr-text');
  if (detail) {
    var mode = metric.allowedUse ? '현재 의사결정 사용 가능' : '참고용 표시';
    // v50.14 R206: 내부 소스 식별자(DATA_SNAPSHOT)를 사용자 친화 라벨로 표시
    var srcDisplay = sourceLabel === 'DATA_SNAPSHOT' ? '스냅샷 · 참고' : sourceLabel;
    var parts = ['CBOE Total P/C ' + text, tone.narrative, srcDisplay + ' · ' + mode];
    if (payload.equityPutCall != null) parts.push('Equity P/C ' + Number(payload.equityPutCall).toFixed(2));
    detail.textContent = parts.join(' · ');
    detail.setAttribute('data-source-kind', sourceKind);
    detail.setAttribute('data-operational-use', metric.allowedUse ? 'decision' : 'reference-only');
  }

  if (typeof DATA_SNAPSHOT !== 'undefined') DATA_SNAPSHOT.pcr = pcr;
  window._putCallRatio = pcr;
  window._lastPutCallPayload = Object.assign({}, payload, {
    totalPutCall: pcr,
    sourceKind: sourceKind,
    sourceLabel: sourceLabel,
    metric: metric,
    tone: tone
  });
  try {
    if (window.AIO_ARCH && typeof window.AIO_ARCH.ingestSentiment === 'function') {
      window.AIO_ARCH.ingestSentiment({
        putCall: pcr,
        putCallSourceKind: sourceKind,
        putCallSource: sourceLabel,
        putCallObservedAt: asOf,
        now: new Date().toISOString()
      });
    }
  } catch (_) {}

  document.dispatchEvent(new CustomEvent('aio:sentimentUpdated', { detail: { metric: 'putCall', sourceKind: sourceKind, sourceLabel: sourceLabel } }));
  return true;
}

async function fetchPutCall() {
  var serverPayload = window._lastPutCallPayload;
  if (serverPayload && serverPayload.sourceLabel === 'Cboe Daily Market Statistics' && serverPayload.asOf) {
    var serverAgeDays = (Date.now() - new Date(serverPayload.asOf).getTime()) / 86400000;
    if (serverAgeDays >= -1 && serverAgeDays <= 4) return true;
  }
  const cboeUrl = 'https://cdn.cboe.com/api/global/us_options_volume/options_volume.json';
  try {
    const proxy = CORS_PROXY + encodeURIComponent(cboeUrl);
    const resp = await fetchWithTimeout(proxy, {}, 8000);
    const w = await resp.json();
    var raw;
    try { raw = typeof w.contents === 'string' ? JSON.parse(w.contents || '{}') : w; } catch(pe) { raw = {}; }
    const rows = raw.data || raw.results || [];
    if (rows.length > 0) {
      const latest = rows[rows.length - 1];
      const pcr = _aioPickNumber(latest, ['total_pcr', 'totalPcr', 'totalPCR', 'total_put_call_ratio', 'put_call_ratio', 'pcr_total', 'pcr_vol']);
      if (pcr != null) {
        _aioUpdatePutCallDom({
          totalPutCall: pcr,
          equityPutCall: _aioPickNumber(latest, ['equity_pcr', 'equityPcr', 'equityPCR', 'equity_put_call_ratio', 'pcr_equity']),
          sourceKind: 'delayed',
          sourceLabel: 'CBOE options volume daily',
          asOf: latest.date || latest.tradeDate || latest.trade_date || latest.bizdate || new Date().toISOString()
        });
        return true;
      }
    }
    throw new Error('no pcr data');
  } catch(e) {
    // A failed legacy CDN/proxy request must not overwrite a fresher official
    // server snapshot already applied from data.json.
    if (window._lastPutCallPayload && window._lastPutCallPayload.sourceLabel === 'Cboe Daily Market Statistics') return true;
    var snap = (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT.pcr != null && DATA_SNAPSHOT.pcr !== '') ? Number(DATA_SNAPSHOT.pcr) : NaN;
    if (isFinite(snap)) {
      _aioUpdatePutCallDom({
        totalPutCall: snap,
        sourceKind: 'snapshot',
        sourceLabel: 'DATA_SNAPSHOT',
        asOf: (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._snapshotDate) || new Date().toISOString(),
        staleReason: e && e.message || 'CBOE unavailable'
      });
    }
    if (window.AIO && window.AIO.recordDataQualityIssue) {
      window.AIO.recordDataQualityIssue({
        source: 'CBOE put/call',
        severity: 'warn',
        message: 'Put/Call ratio live fetch failed; operational use downgraded to snapshot',
        error: e && e.message || String(e)
      });
    }
    return false;
  }
}

let hyLastFetch = 0;
async function fetchHYSpread() {
  const CACHE_MS = 6 * 60 * 60 * 1000; // 6-hour cache (FRED updates daily)
  if (Date.now() - hyLastFetch < CACHE_MS) return;

  const fredUrl = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2&vintage_date=' + new Date().toISOString().slice(0,10);
  // v29.4: 죽은 프록시 제거, CF Worker 우선
  const _cfHy = _getApiKey('aio_cf_worker_url') || '';
  const hyProxies = [
    ...(_cfHy ? [`${_cfHy}?url=${encodeURIComponent(fredUrl)}`] : []),
    'https://corsproxy.io/?' + encodeURIComponent(fredUrl),
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(fredUrl),
    'https://api.allorigins.win/get?url=' + encodeURIComponent(fredUrl),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(fredUrl),
  ];

  // withTimeout is global

  // v29: 다중 프록시로 CSV 수신 시도 (JSON + raw 텍스트 둘 다 처리)
  let csv = '';
  for (const pUrl of hyProxies) {
    try {
      const resp = await fetchWithTimeout(pUrl, {}, 9000);
      if (!resp.ok) continue;
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('json')) {
        const json = await resp.json();
        csv = json.contents || (typeof json === 'string' ? json : '');
      } else {
        csv = await resp.text();
      }
      if (csv && csv.length > 20 && csv.includes(',')) break;
      csv = '';
    } catch(e) { /* 다음 프록시 시도 */ }
  }
  if (!csv) { showDataError('HY', 'HY 스프레드 프록시 전부 실패 — 정적 데이터 사용 중', 'warn'); }

  try {
    if (!csv) throw new Error('all proxies failed');
       // CSV format: "DATE,VALUE" (e.g. 2026-03-19,3.68)
    const lines = csv.trim().split(/\r?\n/).filter(l => l && !l.startsWith('DATE'));
    if (lines.length === 0) throw new Error('empty csv');

    // Get latest value (last non-empty line)
    const lastLine = lines[lines.length - 1];
    const [date, val] = lastLine.split(',');
    const spread = parseFloat(val);
    if (isNaN(spread)) throw new Error('invalid value');

    const spreadBp = Math.round(spread * 100); // FRED stores as %, convert to bps
    hyLastFetch = Date.now();

    // v51.88 P576/R266: 실측 OAS를 compatibility projection + DATA_SNAPSHOT에 저장.
    //   native sentiment orchestrator가 이 projection을 evidence/store로 승격하고,
    //   computeTradingScore도 실측값을 근사값보다 우선 사용한다.
    window._hySpreadBp = spreadBp;
    window._hySpreadDate = date;
    try { if (typeof DATA_SNAPSHOT !== 'undefined') DATA_SNAPSHOT.hySpread = spreadBp; } catch(_) {}
    try {
      if (window.AIO_ARCH && typeof window.AIO_ARCH.ingestSentiment === 'function') {
        window.AIO_ARCH.ingestSentiment({
          hySpread: spreadBp,
          hySpreadSourceKind: 'fred',
          hySpreadSource: 'FRED BAMLH0A0HYM2',
          hySpreadDate: date,
          now: new Date().toISOString()
        });
      }
    } catch (_) {}
    // v52.49/WO-6: 다른 fetch 함수들과 동일하게 중앙 freshness 레지스트리에 기록 —
    // 이전에는 모듈 로컬 hyLastFetch(6h 캐시 게이트 전용)만 있어 getTradingDecisionInputEvidence()가
    // HY 스프레드의 신선도를 전혀 알 수 없었다.
    if (typeof window._markFetch === 'function') window._markFetch('hySpread');
    document.dispatchEvent(new CustomEvent('aio:sentimentUpdated', { detail: { metric: 'hySpread', sourceKind: 'fred', sourceLabel: 'FRED BAMLH0A0HYM2' } }));

    console.log('[AIO] HY Spread FRED:', spreadBp + 'bp (' + date + ')');
  } catch(e) {
    _aioLog('warn', 'fetch', 'HY Spread fetch 실패: ' + e.message);
  }
}

// ═══ v51.07: G×L 성장×유동성 판단 프레임 (Signal & Flow 방식) ══════════════════
// 홈 페이지 home-gxl-frame 패널 갱신. refreshHomeDashboard + aio:marketStateUpdated 훅으로 호출.
function _aioRenderGxLFrame() {
  var ld = window._liveData || {};
  function currentNumber(v) { return v == null || v === '' ? NaN : Number(v); }
  var vixP = currentNumber((ld['^VIX'] && ld['^VIX'].price) || (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.vix));
  var tnxP = currentNumber((ld['^TNX'] && ld['^TNX'].price) || (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.tnx));
  var dxyP = currentNumber((ld['DX-Y.NYB'] && ld['DX-Y.NYB'].price) || (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.dxy));
  var spxPct = (ld['^GSPC'] && ld['^GSPC'].pct != null) ? ld['^GSPC'].pct : null;

  if (![vixP, tnxP, dxyP].every(Number.isFinite)) {
    [['gxl-growth-label','판정 보류'],['gxl-liquidity-label','판정 보류'],['gxl-position','판정 보류']].forEach(function(p) { var el=document.getElementById(p[0]); if(el){el.textContent=p[1];el.style.color='var(--text-muted)';} });
    [['gxl-growth-note','VIX 현재값 미수신'],['gxl-liquidity-note','미 10Y 또는 DXY 현재값 미수신'],['gxl-position-note','필수 입력이 모두 수신될 때 계산']].forEach(function(p) { var el=document.getElementById(p[0]); if(el)el.textContent=p[1]; });
    return { available:false };
  }

  // G (성장): marketState regime + SPX 모멘텀 + VIX
  var ms = (window.AIO && window.AIO.marketState) || {};
  var regime = (ms.regime || '').toUpperCase();
  var gScore = 0;
  if (regime === 'UPTREND') gScore += 2;
  else if (regime === 'PULLBACK') gScore += 1;
  else if (regime === 'CORRECTION') gScore -= 1;
  else if (regime === 'DOWNTREND') gScore -= 2;
  if (spxPct != null) { if (spxPct > 0.5) gScore += 1; else if (spxPct < -0.5) gScore -= 1; }
  if (vixP < 16) gScore += 1; else if (vixP > 25) gScore -= 1;

  var gLabel, gColor, gNote;
  if (gScore >= 3)       { gLabel = '▲ 성장 강세'; gColor = 'var(--data-green)'; gNote = '추세 상승 · 모멘텀 양호'; }
  else if (gScore >= 1)  { gLabel = '→ 성장 중립'; gColor = 'var(--data-cyan)';  gNote = '방향 탐색 · 선별 진입'; }
  else if (gScore >= -1) { gLabel = '◐ 성장 약화'; gColor = 'var(--data-amber)'; gNote = '추세 불안정 · 방어 고려'; }
  else                   { gLabel = '▼ 성장 역풍'; gColor = 'var(--data-red)';   gNote = '하락 레짐 · 방어 포지션'; }

  // L (유동성): 10Y 국채 + DXY
  var lScore = 0;
  if (tnxP < 4.0) lScore += 2; else if (tnxP < 4.5) lScore += 1; else if (tnxP > 5.0) lScore -= 2; else lScore -= 1;
  if (dxyP < 100) lScore += 1; else if (dxyP > 106) lScore -= 1;

  var lLabel, lColor, lNote;
  if (lScore >= 2)       { lLabel = '▲ 유동성 충분'; lColor = 'var(--data-green)'; lNote = '금리·달러 우호 · 레버리지 여건 양호'; }
  else if (lScore >= 0)  { lLabel = '→ 유동성 중립'; lColor = 'var(--data-cyan)';  lNote = '금리 압박 부분 존재'; }
  else if (lScore >= -1) { lLabel = '◐ 유동성 긴축'; lColor = 'var(--data-amber)'; lNote = '고금리·강달러 위협'; }
  else                   { lLabel = '▼ 유동성 역풍'; lColor = 'var(--data-red)';   lNote = '강달러+고금리 동반 · 청산 주의'; }

  // G×L 종합 포지션 권고
  var combined = gScore + lScore;
  var posLabel, posColor, posNote;
  if (combined >= 4)       { posLabel = '양 축 우호';       posColor = 'var(--data-green)';     posNote = '성장+유동성 관측이 모두 우호'; }
  else if (combined >= 2)  { posLabel = '부분 우호';         posColor = 'var(--data-cyan)';      posNote = '한 축 우호 · 한 축 관찰'; }
  else if (combined >= 0)  { posLabel = '중립';             posColor = 'var(--text-secondary)'; posNote = '방향 확인 구간'; }
  else if (combined >= -2) { posLabel = '부분 역풍';         posColor = 'var(--data-amber)';     posNote = '한 축 이상 압력'; }
  else                     { posLabel = '양 축 역풍';       posColor = 'var(--data-red)';       posNote = '성장+유동성 관측이 모두 비우호'; }

  var e;
  e = document.getElementById('gxl-growth-label');    if (e) { e.textContent = gLabel;   e.style.color = gColor; }
  e = document.getElementById('gxl-growth-note');     if (e) e.textContent = gNote;
  e = document.getElementById('gxl-liquidity-label'); if (e) { e.textContent = lLabel;   e.style.color = lColor; }
  e = document.getElementById('gxl-liquidity-note');  if (e) e.textContent = lNote;
  e = document.getElementById('gxl-position');        if (e) { e.textContent = posLabel; e.style.color = posColor; }
  e = document.getElementById('gxl-position-note');   if (e) e.textContent = posNote;
}
window._aioRenderGxLFrame = _aioRenderGxLFrame;

// ═══ v51.07: 엔캐리 언와인드 위험 복합 스코어 ══════════════════════════════════
// FxBond 페이지 carry-unwind-risk 패널 갱신. fxbond showPage 훅으로 호출.
function _aioRenderCarryUnwindRisk() {
  var ld = window._liveData || {};
  var jpy = Number(ld['JPY=X'] && ld['JPY=X'].price);
  var vix = Number(ld['^VIX'] && ld['^VIX'].price);
  var tnx = Number(ld['^TNX'] && ld['^TNX'].price);
  // P576/P713 계열 4번째 표면(2026-07-18): HYG 달러 가격("가격 프록시" 자체 라벨) 대신 FRED HY OAS(bp) 실측 사용
  var hyOasBp = Number(window._hySpreadBp);
  // DATA_SNAPSHOT의 BOJ 정책금리는 수동 확인 필드이며 fieldTS(60일)로 별도 검증된다.
  var bojRate = Number(window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.bojRate);
  var inputsComplete = [jpy, vix, tnx, hyOasBp, bojRate].every(Number.isFinite);
  if (!inputsComplete) {
    var missing = [];
    if (!Number.isFinite(jpy)) missing.push('USD/JPY');
    if (!Number.isFinite(vix)) missing.push('VIX');
    if (!Number.isFinite(tnx)) missing.push('미 10Y');
    if (!Number.isFinite(hyOasBp)) missing.push('HY OAS');
    if (!Number.isFinite(bojRate)) missing.push('BOJ 정책금리');
    var missingText = '관측 프록시 보류 — 현재 입력 미수신: ' + missing.join(' · ');
    var e;
    e = document.getElementById('carry-jpy-risk');   if (e) e.textContent = Number.isFinite(jpy) ? 'USD/JPY ' + jpy.toFixed(1) : '—';
    e = document.getElementById('carry-vix-risk');   if (e) e.textContent = Number.isFinite(vix) ? 'VIX ' + vix.toFixed(1) : '—';
    e = document.getElementById('carry-rate-diff');  if (e) e.textContent = '—';
    e = document.getElementById('carry-rate-risk');  if (e) e.textContent = '미일 금리차 산출 보류';
    e = document.getElementById('carry-hyg-risk');   if (e) e.textContent = Number.isFinite(hyOasBp) ? 'HY OAS ' + Math.round(hyOasBp) + 'bp' : '—';
    e = document.getElementById('carry-risk-level'); if (e && e.dataset.aioFxbondCarryRenderer !== 'native') { e.textContent = '보류'; e.style.color = 'var(--text-muted)'; }
    return;
  }

  var rateDiff = parseFloat(tnx) - bojRate;

  // 스코어 (0~100, 높을수록 언와인드 위험 높음)
  var score = 0;
  // USD/JPY 수준·VIX·금리차·HYG를 같은 시점에 비교하는 단순 규칙값(포지션/옵션 데이터 아님)
  if (jpy > 158) score += 35; else if (jpy > 152) score += 25; else if (jpy > 145) score += 15; else score += 30;
  // VIX: 변동성 수준 관측
  if (vix > 30) score += 30; else if (vix > 22) score += 20; else if (vix > 15) score += 10; else score += 5;
  // 미일 정책금리 차: 수준 관측
  if (rateDiff < 2.5) score += 20; else if (rateDiff < 3.5) score += 10; else score += 5;
  // HY OAS: 크레딧 스프레드 확대 시 리스크-오프 연동 (bp 상승 = 위험 가산)
  if (hyOasBp > 450) score += 15; else if (hyOasBp > 350) score += 8; else score += 3;
  score = Math.min(100, score);

  // 이 지표는 포지션·옵션·당국조치 데이터를 포함하지 않는 단순 관측 프록시다.
  var riskLevel = '참고';
  var riskColor = 'var(--text-secondary)';
  var jpyRisk  = 'USD/JPY ' + jpy.toFixed(1) + ' (수준 관측)';
  var vixRisk  = 'VIX ' + vix.toFixed(1) + ' (변동성 관측)';
  var rateRisk = '미일 정책금리 차 ' + rateDiff.toFixed(1) + '%p (BOJ 수동 확인값 기준)';
  var hygRisk  = 'HY OAS ' + Math.round(hyOasBp) + 'bp';
  var verdict = '관측 프록시 ' + score + '/100 — USD/JPY·VIX·미일 정책금리 차·HY OAS의 단순 규칙값입니다. 엔캐리 포지션 규모, 당국 조치, 청산 확률 및 자산가격 방향은 이 값만으로 판단하지 않습니다.';

  var e;
  e = document.getElementById('carry-jpy-risk');   if (e) e.textContent = jpyRisk;
  e = document.getElementById('carry-vix-risk');   if (e) e.textContent = vixRisk;
  e = document.getElementById('carry-rate-diff');  if (e) e.textContent = rateDiff.toFixed(1) + '%p';
  e = document.getElementById('carry-rate-risk');  if (e) e.textContent = rateRisk;
  e = document.getElementById('carry-hyg-risk');   if (e) e.textContent = hygRisk;
  e = document.getElementById('carry-risk-level'); if (e && e.dataset.aioFxbondCarryRenderer !== 'native') { e.textContent = riskLevel; e.style.color = riskColor; }
}
window._aioRenderCarryUnwindRisk = _aioRenderCarryUnwindRisk;
// v52.41 (P656/EF-08): 라이브 실측(Chrome MCP, v52.34)으로 확인한 진짜 원인 — 이 함수 자체는
// 콘솔에서 수동 호출 시 즉시 정상 렌더(점수 58, rate-diff 4.0%p 등)되므로 계산 로직 문제가 아니라
// P605(VKOSPI)와 동일한 "오펀 함수" 패턴: window.showPage 몽키패치의 setTimeout(600ms) 트리거가
// 콜드 로드(#fxbond 직접 진입) 경로에서 신뢰할 수 없었다. 이 파일의 다른 페이지들이 이미 쓰는
// 검증된 _aioPageBus('aio:pageShown') 패턴을 보조 트리거로 추가 — 기존 showPage 훅은 그대로 둔 채
// 더 신뢰할 수 있는 경로를 하나 더 확보(둘 중 하나만 발화해도 게이지가 채워짐).
try {
  if (typeof _aioPageBus !== 'undefined' && _aioPageBus.register) {
    _aioPageBus.register('data-carry-unwind-shown', 'aio:pageShown', function(e) {
      if (e.detail !== 'fxbond') return;
      setTimeout(function() { try { _aioRenderCarryUnwindRisk(); } catch(_) {} }, 300);
    });
    _aioPageBus.register('data-carry-unwind-live', 'aio:liveQuotes', function() {
      var p = document.getElementById('page-fxbond');
      if (p && p.classList.contains('active')) { try { _aioRenderCarryUnwindRisk(); } catch(_) {} }
    });
  }
} catch(_registerCarryErr) {}

// ── 스크리너 질의 엔진 — aio-chat.js에서 이동 (v51.17) ─────────────────────────────
const _SECTOR_KEYWORDS = {
  'technology':['Technology'], 'tech':['Technology'], '기술':['Technology'], '기술주':['Technology'], 'IT':['Technology'],
  'software':['Technology'], '소프트웨어':['Technology','SW','ERP','IT서비스','IT플랫폼','CNS'],
  'semiconductor':['Technology'], '반도체':['Technology','반도체','반도체장비','반도체소재','파운드리','MLCC'],
  'ai':['Technology','AI'], 'AI':['Technology','AI'],
  'financial':['Financials'], 'financials':['Financials'], '금융':['Financials','금융','보험','핀테크','거래소'],
  'bank':['Financials'], '은행':['Financials','금융'],
  'healthcare':['Healthcare'], 'health':['Healthcare'], '헬스케어':['Healthcare'], '의료':['Healthcare'],
  'biotech':['Healthcare'], '바이오':['Healthcare','바이오','바이오시밀러','보톡스','CDMO','항암제','제약'],
  'pharma':['Healthcare'], '제약':['Healthcare','제약','바이오'],
  'consumer':['Consumer','Consumer Defensive'], '소비재':['Consumer','Consumer Defensive'],
  'energy':['Energy'], '에너지':['Energy'], '원유':['Energy'], '석유':['Energy'],
  'utility':['Utilities'], 'utilities':['Utilities'], '유틸리티':['Utilities'],
  'industrial':['Industrials'], 'industrials':['Industrials'], '산업재':['Industrials'],
  'defense':['Industrials'], '방산':['Industrials','방산','방산지주','방산IT','탄약'],
  'material':['Materials'], 'materials':['Materials'], '소재':['Materials','소재'],
  'realestate':['Real Estate'], '부동산':['Real Estate'],
  'communication':['Communication Services'], '통신':['Communication Services','통신'],
  'etf':['ETF'], 'ETF':['ETF'],
  '2차전지':['2차전지','양극재'], '배터리':['2차전지','양극재'],
  '조선':['조선','조선지주'], '자동차':['자동차','자동차부품','가전/전장','전장'],
  '원전':['원전','원전설계','원전정비','원전기자재'], '전력':['전력기기','전력지주','배전','전선'],
  '로봇':['로봇','산업로봇','서비스로봇','협동로봇'],
  '화장품':['화장품','뷰티브랜드','스킨케어','색조'],
  '게임':['게임','게임/블록체인','엔터','미디어','드라마'],
};
window.AIO_SECTOR_KEYWORDS = _SECTOR_KEYWORDS;

function _detectSectorQuery(text) {
  var lower = text.toLowerCase();
  var intentPatterns = ['비교','추천','찾아','뽑아','골라','싼','저평가','고평가','성장','배당','수익률','밸류','가치','cheapest','best','top','compare','recommend','undervalued','overvalued','screen','pick','find'];
  var hasIntent = intentPatterns.some(function(p) { return lower.indexOf(p) >= 0; });
  if (!hasIntent) return null;
  var matched = null, matchedKey = '';
  Object.keys(_SECTOR_KEYWORDS).forEach(function(kw) {
    if (lower.indexOf(kw.toLowerCase()) >= 0 && (!matched || kw.length > matchedKey.length)) { matched = _SECTOR_KEYWORDS[kw]; matchedKey = kw; }
  });
  if (!matched) return null;
  var stocks = _aioGetCanonicalScreenerRows()
    .filter(function(s) { return matched.some(function(sec) { return s.sector === sec; }); })
    .sort(function(a,b) { return (b.mcap||0) - (a.mcap||0); }).slice(0, 8);
  return stocks.length > 0 ? { sectorLabel: matchedKey, stocks: stocks } : null;
}
window._detectSectorQuery = _detectSectorQuery;

function _aioIsBroadRecommendationQuery(query) {
  var q = String(query || '').toLowerCase();
  if (!q) return false;
  return /(종목\s*)?(추천|골라|뽑아|찾아줘|아이디어|후보|리스트)|recommend|stock\s*ideas?|top\s*picks?|best\s*stocks?|pick\s*stocks?/i.test(q);
}
window._aioIsBroadRecommendationQuery = _aioIsBroadRecommendationQuery;

function _aioInferTickerMarket(sym, index) {
  var s = String(sym || '');
  if (/\.KS$|\.KQ$/.test(s)) return 'KR';
  if (/\.T$/.test(s)) return 'Japan';
  if (/\.TW$/.test(s)) return 'Taiwan';
  if (/\.HK$/.test(s)) return 'Hong Kong';
  if (/ADR/i.test(index || '')) return 'ADR';
  return 'US';
}
window._aioInferTickerMarket = _aioInferTickerMarket;

function _aioCapBucket(mcap) {
  var v = Number(mcap || 0);
  if (v >= 500) return 'mega';
  if (v >= 100) return 'large';
  if (v >= 10) return 'mid';
  if (v > 0) return 'small';
  return 'unknown';
}
window._aioCapBucket = _aioCapBucket;

function _aioExtractRecentRecommendationTickers(messages) {
  try {
    var db = _aioGetCanonicalScreenerRows();
    var known = {};
    (Array.isArray(db) ? db : []).forEach(function(s) { if (s && s.sym) known[s.sym] = true; });
    var out = {};
    (messages || []).slice(-8).forEach(function(m) {
      var text = String((m && m.content) || '');
      var hits = text.match(/\b[A-Z][A-Z0-9.-]{1,9}(?:\.(?:KS|KQ|T|TW|HK))?\b|\b\d{6}\.(?:KS|KQ)\b/g) || [];
      hits.forEach(function(t) { if (known[t]) out[t] = true; });
    });
    return Object.keys(out);
  } catch(_) { return []; }
}
window._aioExtractRecentRecommendationTickers = _aioExtractRecentRecommendationTickers;

function _aioBuildDiversifiedRecommendationRows(db, live, opts) {
  opts = opts || {}; live = live || {};
  var recent = {};
  (opts.recentTickers || []).forEach(function(t) { recent[t] = true; });
  var seen = {};
  var eligible = (Array.isArray(db) ? db : []).filter(function(s) {
    if (!s || !s.sym || seen[s.sym]) return false;
    seen[s.sym] = true;
    if (s.signal === 'SELL') return false;
    if (s.sector === 'ETF') return false;
    if (/^\^|=|-USD$/i.test(s.sym)) return false;
    return true;
  }).map(function(s) {
    var ld = live[s.sym] || {};
    var rank = (typeof s.rank === 'number') ? s.rank : 50;
    var signalScore = ({ BUY: 18, WATCH: 8, HOLD: 2 })[s.signal] || 0;
    var rsi = Number(s.rsi);
    var rsiScore = isFinite(rsi) ? (rsi >= 35 && rsi <= 62 ? 5 : rsi > 75 ? -12 : rsi < 25 ? -6 : 0) : 0;
    var capScore = Math.min(10, Math.max(0, Math.log10(Math.max(1, Number(s.mcap || 1))) * 2));
    var pct = (ld && ld.pct != null && isFinite(Number(ld.pct))) ? Number(ld.pct) : null;
    var liveScore = pct == null ? 0 : Math.max(-5, Math.min(5, pct));
    var repeatPenalty = recent[s.sym] ? 25 : 0;
    var market = _aioInferTickerMarket(s.sym, s.index);
    var score = rank + signalScore + rsiScore + capScore + liveScore - repeatPenalty;
    return {
      sym: s.sym, name: s.name, sector: s.sector, signal: s.signal, mcap: s.mcap, rsi: s.rsi,
      rank: (typeof s.rank === 'number' ? s.rank : null), quantSignal: s.quantSignal || null, factorScores: s.factorScores || null,
      ret3m: (typeof s.ret3m === 'number' ? s.ret3m : null), vol: (typeof s.vol === 'number' ? s.vol : null),
      price: ld.price != null ? ld.price : null, pct: pct, memo: (s.memo || '').slice(0, 90),
      market: market, capBucket: _aioCapBucket(s.mcap), diversityScore: Math.round(score), repeatPenalty: repeatPenalty
    };
  }).sort(function(a, b) { return b.diversityScore - a.diversityScore; });

  // P626-followup/T825: recentSuppressed used to be counted from `eligible` *after* the
  // `_nonRepeat` reassignment below — but that reassignment (which fires almost every real call,
  // since a universe this size almost always has >=20 non-penalized candidates) replaces
  // `eligible` with exactly the subset that has zero repeat-penalized rows. Counting "how many
  // were suppressed" from an array that, by construction, can no longer contain any suppressed
  // row always returned 0 regardless of what `opts.recentTickers` actually penalized. Count from
  // the full pre-filter set instead, before it gets narrowed.
  var recentSuppressed = eligible.filter(function(r) { return r.repeatPenalty > 0; }).length;
  var _nonRepeat = eligible.filter(function(r) { return r.repeatPenalty === 0; });
  if (_nonRepeat.length >= 20) { eligible = _nonRepeat; }

  function pickRows(sectorLimit, marketLimit, maxRows) {
    var picked = [], secCount = {}, marketCount = {};
    eligible.forEach(function(r) {
      if (picked.length >= maxRows) return;
      var sec = r.sector || 'Unknown', mkt = r.market || 'US';
      if ((secCount[sec] || 0) >= sectorLimit) return;
      if ((marketCount[mkt] || 0) >= (marketLimit[mkt] || marketLimit._default || maxRows)) return;
      picked.push(r);
      secCount[sec] = (secCount[sec] || 0) + 1;
      marketCount[mkt] = (marketCount[mkt] || 0) + 1;
    });
    return { rows: picked, secCount: secCount, marketCount: marketCount };
  }

  var first = pickRows(2, { US: 7, KR: 5, Japan: 2, Taiwan: 2, 'Hong Kong': 2, ADR: 2, _default: 3 }, 16);
  if (first.rows.length < 12) first = pickRows(3, { US: 10, KR: 7, Japan: 3, Taiwan: 3, 'Hong Kong': 3, ADR: 3, _default: 4 }, 16);
  var sectors = {}, markets = {}, capBuckets = {};
  first.rows.forEach(function(r) {
    sectors[r.sector || 'Unknown'] = true;
    markets[r.market || 'US'] = true;
    capBuckets[r.capBucket || 'unknown'] = true;
  });
  return {
    rows: first.rows, totalMatched: eligible.length, recentSuppressed: recentSuppressed,
    diversity: { sectorCount: Object.keys(sectors).length, marketCount: Object.keys(markets).length, capBucketCount: Object.keys(capBuckets).length }
  };
}
window._aioBuildDiversifiedRecommendationRows = _aioBuildDiversifiedRecommendationRows;

function _aioRunScreenerQuery(query, opts) {
  try {
    opts = opts || {};
    var db = _aioGetCanonicalScreenerRows();
    if (!Array.isArray(db) || !db.length) return null;
    var q = String(query || '').toLowerCase();
    var crit = {}, labels = [];

    if (/매수\s*(시그널|종목)?|buy\b|사야|살\s*만|저평가\s*매수/.test(q)) crit.signal = 'BUY';
    else if (/관망|watch\b/.test(q)) crit.signal = 'WATCH';
    else if (/매도|sell\b|팔\s*/.test(q)) crit.signal = 'SELL';
    else if (/보유|hold\b/.test(q)) crit.signal = 'HOLD';
    if (crit.signal) labels.push('시그널=' + crit.signal);

    var rsiUnder = q.match(/rsi\s*(\d{1,3})\s*(?:이하|미만|under|below|아래|<=?)/) || q.match(/(?:이하|미만|under|below)\s*rsi\s*(\d{1,3})/);
    var rsiOver  = q.match(/rsi\s*(\d{1,3})\s*(?:이상|초과|over|above|위|>=?)/) || q.match(/(?:이상|초과|over|above)\s*rsi\s*(\d{1,3})/);
    if (rsiUnder) { crit.rsiMax = +rsiUnder[1]; labels.push('RSI≤' + crit.rsiMax); }
    if (rsiOver)  { crit.rsiMin = +rsiOver[1];  labels.push('RSI≥' + crit.rsiMin); }
    if (crit.rsiMax == null && crit.rsiMin == null) {
      if (/과매도|oversold|침체\s*구간/.test(q)) { crit.rsiMax = 35; labels.push('과매도(RSI≤35)'); }
      else if (/과매수|과열|overbought/.test(q)) { crit.rsiMin = 65; labels.push('과매수(RSI≥65)'); }
    }

    if (/메가캡|mega\s*-?cap/.test(q)) { crit.mcapMin = 500; labels.push('메가캡(≥$500B)'); }
    else if (/대형주|large\s*-?cap/.test(q)) { crit.mcapMin = 100; labels.push('대형주(≥$100B)'); }
    else if (/중형주|mid\s*-?cap/.test(q)) { crit.mcapMin = 10; crit.mcapMax = 100; labels.push('중형주($10~100B)'); }
    else if (/소형주|small\s*-?cap/.test(q)) { crit.mcapMax = 10; labels.push('소형주(<$10B)'); }

    var matchedSector = null, secKey = '';
    Object.keys(_SECTOR_KEYWORDS).forEach(function(kw) {
      if (q.indexOf(kw.toLowerCase()) >= 0 && (!matchedSector || kw.length > secKey.length)) { matchedSector = _SECTOR_KEYWORDS[kw]; secKey = kw; }
    });

    var themeTickers = null, themeKey = '';
    var aliases = (typeof SCR_KEYWORD_ALIASES !== 'undefined') ? SCR_KEYWORD_ALIASES : (window.SCR_KEYWORD_ALIASES || {});
    Object.keys(aliases).forEach(function(kw) {
      if (q.indexOf(kw.toLowerCase()) >= 0 && Array.isArray(aliases[kw]) && (!themeTickers || kw.length > themeKey.length)) { themeTickers = aliases[kw]; themeKey = kw; }
    });
    if (themeTickers && themeTickers.length && themeKey.length >= secKey.length) {
      crit.themeSet = {}; themeTickers.forEach(function(t) { crit.themeSet[t] = true; }); labels.push('테마=' + themeKey);
    } else if (matchedSector) { crit.sectors = matchedSector; labels.push('섹터=' + secKey); }

    if (/s&p|sp\s*500|에스앤피/.test(q)) { crit.index = 'SP500'; labels.push('S&P500'); }
    else if (/다우|dow\b/.test(q)) { crit.index = 'DOW30'; labels.push('다우30'); }
    else if (/나스닥|nasdaq/.test(q)) { crit.index = 'NASDAQ'; labels.push('나스닥'); }

    if (/급등|상승\s*(종목|률)?|오른|gainer|올라/.test(q)) { crit.dir = 'up'; labels.push('상승 종목'); }
    else if (/급락|하락\s*(종목|률)?|내린|loser|떨어/.test(q)) { crit.dir = 'down'; labels.push('하락 종목'); }

    if (/퀀트|quant|팩터|factor|랭킹|순위|우량|상위\s*종목|best\b|top\s*\d*/.test(q)) { crit.byRank = true; labels.push('퀀트 랭킹순'); }

    if (typeof _aioComputeFactorRanks === 'function' && !db.some(function(s){ return s.rank != null; })) {
      try { _aioComputeFactorRanks(); db = _aioGetCanonicalScreenerRows(); } catch(_) {}
    }

    var isBroadRecommendation = _aioIsBroadRecommendationQuery(q);
    var onlyGenericRank = crit.byRank && labels.length === 1 && !crit.signal && crit.rsiMax == null && crit.rsiMin == null &&
      crit.mcapMin == null && crit.mcapMax == null && !crit.sectors && !crit.themeSet && !crit.index && !crit.dir;
    if (isBroadRecommendation && (labels.length === 0 || onlyGenericRank)) {
      var diversified = _aioBuildDiversifiedRecommendationRows(db, window._liveData || {}, opts);
      return { matched: true, mode: 'diversified-recommendation',
        criteria: onlyGenericRank ? ['균형 추천 후보', '퀀트 랭킹 참고'] : ['균형 추천 후보'],
        rows: diversified.rows, totalMatched: diversified.totalMatched, diversity: diversified.diversity, recentSuppressed: diversified.recentSuppressed };
    }

    if (labels.length === 0) return null;

    var live = window._liveData || {};
    var rows = db.filter(function(s) {
      if (crit.signal && s.signal !== crit.signal) return false;
      if (crit.rsiMax != null && !(s.rsi != null && s.rsi <= crit.rsiMax)) return false;
      if (crit.rsiMin != null && !(s.rsi != null && s.rsi >= crit.rsiMin)) return false;
      if (crit.mcapMin != null && !((s.mcap || 0) >= crit.mcapMin)) return false;
      if (crit.mcapMax != null && !((s.mcap || 0) < crit.mcapMax)) return false;
      if (crit.sectors && !crit.sectors.some(function(sec) { return s.sector === sec; })) return false;
      if (crit.index && s.index !== crit.index) return false;
      if (crit.themeSet && !crit.themeSet[s.sym]) return false;
      if (crit.dir) {
        var ldp = live[s.sym]; var pct = (ldp && ldp.pct != null) ? ldp.pct : null;
        if (pct == null) return false;
        if (crit.dir === 'up' && !(pct > 0)) return false;
        if (crit.dir === 'down' && !(pct < 0)) return false;
      }
      return true;
    }).map(function(s) {
      var ld = live[s.sym] || {};
      return { sym: s.sym, name: s.name, sector: s.sector, signal: s.signal, mcap: s.mcap, rsi: s.rsi,
        rank: (typeof s.rank === 'number' ? s.rank : null), quantSignal: s.quantSignal || null, factorScores: s.factorScores || null,
        ret3m: (typeof s.ret3m === 'number' ? s.ret3m : null), vol: (typeof s.vol === 'number' ? s.vol : null),
        price: ld.price != null ? ld.price : null, pct: ld.pct != null ? ld.pct : null, memo: (s.memo || '').slice(0, 90),
        newsMemo: (s.newsMemo || '').slice(0, 200) };
    });

    rows.sort(function(a, b) {
      if (crit.byRank) return (b.rank == null ? -1 : b.rank) - (a.rank == null ? -1 : a.rank);
      if (crit.dir === 'up') return (b.pct == null ? -999 : b.pct) - (a.pct == null ? -999 : a.pct);
      if (crit.dir === 'down') return (a.pct == null ? 999 : a.pct) - (b.pct == null ? 999 : b.pct);
      if (crit.rsiMax != null) return (a.rsi == null ? 999 : a.rsi) - (b.rsi == null ? 999 : b.rsi);
      if (crit.rsiMin != null) return (b.rsi == null ? -999 : b.rsi) - (a.rsi == null ? -999 : a.rsi);
      if (a.rank != null && b.rank != null) return b.rank - a.rank;
      return (b.mcap || 0) - (a.mcap || 0);
    });

    return { matched: true, criteria: labels, rows: rows.slice(0, 12), totalMatched: rows.length };
  } catch (e) { return null; }
}
window._aioRunScreenerQuery = _aioRunScreenerQuery;

// AIQ-P0-05: ranking is a research-relative candidate signal, not a recommendation
// verifier. Preserve the ranking/allowed-use evidence while preventing a heuristic
// from being promoted into a decision claim.
// 입력: 티커 배열 / 출력: [{sym, verdict, rank, quantSignal, reasons, allowedUse}] or null
function _aioMakerCheckerVerify(tickers) {
  try {
    if (!Array.isArray(tickers) || !tickers.length) return null;
    var db = _aioGetCanonicalScreenerRows();
    if (!Array.isArray(db) || !db.length) return null;
    if (typeof _aioComputeFactorRanks === 'function' && !db.some(function(row){ return row && typeof row.rank === 'number'; })) {
      try { _aioComputeFactorRanks(); db = _aioGetCanonicalScreenerRows(); } catch(_) {}
    }
    var results = [];
    tickers.forEach(function(sym) {
      if (!sym) return;
      var s = sym.toUpperCase();
      var row = null;
      for (var i = 0; i < db.length; i++) { if (db[i].sym === s) { row = db[i]; break; } }
      if (!row || typeof row.rank !== 'number') return;
      var rank = row.rank, qs = row.quantSignal || null;
       var verdict = rank >= 60 ? 'RESEARCH_CANDIDATE' : rank >= 40 ? 'CAUTION' : 'REJECTED';
       var reasons = ['랭크 ' + rank];
       if (qs) reasons.push(qs);
       results.push({ sym: s, verdict: verdict, rank: rank, quantSignal: qs, reasons: reasons,
         allowedUse: 'research-relative-ranking-only', operationalUse: 'blocked', observedAt: window._aioFactorRanksAsOf || null });
    });
    return results.length ? results : null;
  } catch(e) { return null; }
}
window._aioMakerCheckerVerify = _aioMakerCheckerVerify;

function _formatScreenerResultPrompt(result) {
  if (!result || !result.matched || !result.rows || !result.rows.length) return '';
  var _f = function(v, d) { return v != null && !isNaN(v) ? Number(v).toFixed(d || 1) : 'N/A'; };
  var _pct = function(v) { return v != null && !isNaN(v) ? (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%' : 'N/A'; };
   // AIQ-P0-06: never replace producer observation time with browser generation time.
   var ts = result.observedAt || result.asOf || window._aioFactorRanksAsOf || '관측시각 미확인';
  var lines = [];
  var isDiversified = result.mode === 'diversified-recommendation';
  lines.push('═══════════════════════════════════════════════════');
  lines.push(isDiversified ? '【균형 추천 후보 — AIO 종목 DB 분산 샘플링】' : '【스크리너 결과 — AIO 종목 DB 실시간 필터링】');
  lines.push('조건: ' + result.criteria.join(' · ') + ' | 매칭 ' + result.totalMatched + '종목 (상위 ' + result.rows.length + ' 표시)');
   lines.push('출처: AIO SCREENER_DB(기관 메모·시그널) × 멀티팩터 퀀트 랭크 × 실시간 시세(_liveData) · 생산자 관측시각 ' + ts);
  var fAsOf = (typeof window !== 'undefined' && window._aioFactorRanksAsOf) ? window._aioFactorRanksAsOf.slice(0,10) : null;
  lines.push('퀀트 랭크(0~100, 높을수록 우수) = 섹터 상대 멀티팩터: 모멘텀(1/3/6M 수익률)·추세(SMA50/200 대비)·저변동(연율 변동성↓)·사이즈. ' + (fAsOf ? '팩터 기준일 ' + fAsOf : '팩터 데이터 대기 — 시그널/메모는 editorial(애널리스트 노트)') + '.');
  if (isDiversified) {
    var dv = result.diversity || {};
    lines.push('분산 설계: 섹터 ' + (dv.sectorCount || '?') + '개 · 시장/지역 ' + (dv.marketCount || '?') + '개 · 시총 버킷 ' + (dv.capBucketCount || '?') + '개. 최근 대화 반복 티커는 점수 감점: ' + (result.recentSuppressed || 0) + '개.');
    lines.push('이 목록은 넓은 "종목 추천" 질문에서 특정 섹터/기업으로 과도하게 수렴하지 않도록 만든 후보군이다. 최종 답변은 이 후보군에서 3~5개만 골라야 하며, 같은 섹터·테마는 최대 2개까지만 선택하라.');
  } else {
    lines.push('이 목록은 앱 내부 종목 DB를 실제 필터링·랭킹한 결과다. 학습 데이터로 종목을 추가하거나 임의 변경하지 말고 아래 목록만 사용하라.');
  }
  lines.push('═══════════════════════════════════════════════════');
  result.rows.forEach(function(r, i) {
    var rankStr = (r.rank != null) ? ('퀀트 ' + r.rank + '/100(' + (r.quantSignal || '') + ')') : '퀀트 N/A';
    var fsStr = r.factorScores ? (' [모멘텀' + r.factorScores.momentum + '·추세' + r.factorScores.trend + '·저변동' + r.factorScores.lowvol + ']') : '';
    var divStr = isDiversified ? (' · ' + (r.market || 'US') + '/' + (r.capBucket || 'unknown') + ' · 분산점수 ' + (r.diversityScore != null ? r.diversityScore : 'N/A')) : '';
    lines.push((i + 1) + '. ' + r.sym + ' (' + r.name + ') · ' + r.sector + divStr + ' · ' + rankStr + fsStr +
      ' · 시그널(editorial) ' + r.signal + ' · 시총 ' + (r.mcap ? '$' + r.mcap + 'B' : 'N/A') + ' · RSI ' + _f(r.rsi, 0) +
      ' · 3M ' + _pct(r.ret3m) + ' · 가격 ' + (r.price != null ? '$' + _f(r.price, 2) : 'N/A') + ' (' + _pct(r.pct) + ')');
    if (r.memo) lines.push('   메모: ' + r.memo);
    if (r.newsMemo) lines.push('   최신뉴스: ' + r.newsMemo);
  });
  lines.push('');
  if (isDiversified) {
    lines.push('답변 지침: (1) 먼저 "후보군을 넓게 분산해 봤다"고 밝히고 (2) 성장/퀄리티/방어/경기민감/한국·글로벌 중 최소 3개 관점으로 3~5개를 선택 (3) 제외·보류 후보 2~3개와 이유 제시 (4) 사용자가 공격형/방어형/한국주 선호를 밝히면 다음 답변에서 재랭킹하겠다고 안내. CEG·전력·AVGO·AI 반도체 같은 기존 강한 테마가 포함돼도 자동 1순위로 두지 말고, 비AI/비전력 대안과 비교해 상대 우위가 있을 때만 선택하라. 최종 추천과 수치 근거는 후보군 안에서 제시하되, 사용자가 더 넓은 탐색을 원하면 어떤 조건(시장·섹터·시총·위험도)으로 SCREENER_DB를 다시 펼치면 되는지 안내하라.');
  } else {
    lines.push('답변 지침: 위 목록을 사용자 조건에 맞춰 (1) 퀀트 랭크 기준 순위/표 (2) 상위 종목 선정 이유(어느 팩터가 강한지) (3) 주의·제외 사유 (4) 다음 행동 순으로 해설. 퀀트 랭크(객관·데이터)와 시그널/메모(editorial·애널리스트)를 구분해 설명하라. 가격은 위 값 그대로 인용하고 (기준시각) 괄호를 붙여라. 목록에 없는 종목을 새로 만들지 마라.');
  }
  return '\n\n' + lines.join('\n') + '\n';
}
window._formatScreenerResultPrompt = _formatScreenerResultPrompt;
// AIO.ScreenerQuery: 스크리너 공개 API (aio-data.js 이동 완료 v51.17)
window.AIO = window.AIO || {};
window.AIO.ScreenerQuery = {
  run:            _aioRunScreenerQuery,
  buildDiversified: _aioBuildDiversifiedRecommendationRows,
  formatPrompt:   _formatScreenerResultPrompt,
  detectSector:   _detectSectorQuery,
};
