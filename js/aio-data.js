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
  schemaVersion:'v53.4', lastBulkUpdate:'2026-10-13', staleAfterDays:30, replaceAfterDays:90,
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
  { sym:'GOOGL', name:'Alphabet', sector:'Communication Services', index:'SP500', memo:'[2026-08-09 REFERENCE] AI capex must be separated into contracted cloud/backlog conversion, utilization, depreciation and power delivery. Verify current filings, FCF, debt capacity and customer economics; capex alone is not demand proof.' },
  { sym:'MSFT', name:'Microsoft', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] AI demand monitor: distinguish contracted cloud/backlog conversion and operating-cash-flow acceleration from depreciation, financing and power-delivery constraints. Evidence must include current filings/earnings, not interview estimates alone.' },
  { sym:'AMZN', name:'Amazon', sector:'Consumer', index:'SP500', memo:'[2026-08-09 REFERENCE] AWS/AI infrastructure thesis depends on utilization, custom silicon, memory allocation and power/site execution. Monitor CapEx-to-revenue conversion, cash flow, GPU/ASIC economics and interconnection rather than headline token growth.' },
  { sym:'META', name:'Meta Platforms', sector:'Communication Services', index:'SP500' },
  { sym:'TSM', name:'TSMC', sector:'Technology', index:'ADR', memo:'[2026-08-09 TG-REFERENCE] Insider/BornLupin/HANA observations point to N3 capacity, advanced packaging and TPU/ASIC allocation as a supply-chain branch. Verify wafer starts, customer allocation, pricing and utilization from company/industry primary evidence; channel recirculation is not independent confirmation.' },
  { sym:'AVGO', name:'Broadcom', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] Custom ASIC/TPU demand is a system-economics thesis: networking, interconnect and software integration can determine deployment value. Verify customer commitments, LTA structure, margin/cash-flow conversion and power availability rather than treating AI CapEx alone as demand proof.' },
  { sym:'TSLA', name:'Tesla', sector:'Consumer', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] HANA relayed higher Optimus production ambitions and Chinese humanoid-robot scaling claims. Treat shipment/production numbers as hypotheses until filings, customer deployments and unit economics confirm; data collection and industrial validation remain the key bottlenecks.' },
  { sym:'LLY', name:'Eli Lilly', sector:'Healthcare', index:'SP500' },
  { sym:'WMT', name:'Walmart', sector:'Consumer Defensive', index:'SP500' },
  { sym:'JPM', name:'JPMorgan Chase', sector:'Financials', index:'SP500' },
  { sym:'V', name:'Visa', sector:'Financials', index:'SP500' },
  { sym:'XOM', name:'Exxon Mobil', sector:'Energy', index:'SP500' },
  { sym:'MA', name:'Mastercard', sector:'Financials', index:'SP500' },
  { sym:'UNH', name:'UnitedHealth', sector:'Healthcare', index:'SP500' },
  { sym:'JNJ', name:'Johnson & Johnson', sector:'Healthcare', index:'SP500' },
  { sym:'COST', name:'Costco', sector:'Consumer Defensive', index:'SP500' },
  { sym:'HD', name:'Home Depot', sector:'Consumer', index:'SP500' },
  { sym:'PG', name:'Procter & Gamble', sector:'Consumer Defensive', index:'SP500' },
  { sym:'ABBV', name:'AbbVie', sector:'Healthcare', index:'SP500' },
  { sym:'MRK', name:'Merck', sector:'Healthcare', index:'SP500' },
  { sym:'CRM', name:'Salesforce', sector:'Technology', index:'SP500' },
  { sym:'CVX', name:'Chevron', sector:'Energy', index:'SP500' },
  { sym:'AMD', name:'Advanced Micro Devices', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] The bull case does not require displacing NVIDIA outright: sufficient performance, cost, software compatibility and committed deployments can win allocation. Verify accelerator demand, memory/packaging access, customer ramp and sector-relative strength; a low-volume rebound is not durable demand.' },
  { sym:'NFLX', name:'Netflix', sector:'Communication Services', index:'SP500' },
  { sym:'PEP', name:'PepsiCo', sector:'Consumer Defensive', index:'SP500' },
  { sym:'KO', name:'Coca-Cola', sector:'Consumer Defensive', index:'SP500' },
  { sym:'MCD', name:'McDonald\'s', sector:'Consumer', index:'SP500' },
  { sym:'TMO', name:'Thermo Fisher', sector:'Healthcare', index:'SP500' },
  { sym:'ADBE', name:'Adobe', sector:'Technology', index:'SP500' },
  { sym:'ORCL', name:'Oracle', sector:'Technology', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] Insider channel highlighted a reported CDS/liability stress signal alongside AI-capacity narratives. Credit risk requires current CDS, debt maturity, lease/funding and cash-flow evidence; a forwarded headline is not a solvency conclusion.' },
  { sym:'BAC', name:'Bank of America', sector:'Financials', index:'SP500' },
  { sym:'CSCO', name:'Cisco Systems', sector:'Technology', index:'SP500' },
  { sym:'DIS', name:'Walt Disney', sector:'Communication Services', index:'SP500' },
  { sym:'PLTR', name:'Palantir', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] AI adoption should be tested through repeatable workflow/token usage and customer economics, not user-count narratives alone. Separate software demand from the physical compute, memory and power bottlenecks that support it.' },
  { sym:'MU', name:'Micron Technology', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] Memory is a P/ASP-and-multiple cycle, while LTA/prepayment changes supply allocation and bargaining power. Verify DRAM/HBM spot and contract pricing, inventory, customer commitments and the risk that low P/E precedes a cycle rollover.' },
  { sym:'CAT', name:'Caterpillar', sector:'Industrials', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] HANA relayed a reported Michael Burry short position. This is positioning/context only, not a fundamental short signal; verify filing/position date, valuation, orders, end-market cycle and price/volume confirmation.' },
  { sym:'RTX', name:'Raytheon Tech', sector:'Industrials', index:'SP500' },
  { sym:'GS', name:'Goldman Sachs', sector:'Financials', index:'SP500' },
  { sym:'GE', name:'GE Aerospace', sector:'Industrials', index:'SP500' },
  { sym:'INTC', name:'Intel', sector:'Technology', index:'SP500' },
  { sym:'LMT', name:'Lockheed Martin', sector:'Industrials', index:'SP500' },
  { sym:'ARM', name:'ARM Holdings', sector:'Technology', index:'ADR' },
  { sym:'QCOM', name:'Qualcomm', sector:'Technology', index:'SP500' },
  { sym:'PANW', name:'Palo Alto Networks', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] Cybersecurity leadership is a distinct software-demand branch. Verify recurring revenue, retention, margin/cash-flow conversion and valuation; peer strength or a high-volume move is not a standalone quality signal.' },
  { sym:'RBRK', name:'Rubrik', sector:'Technology', index:'NYSE', memo:'[2026-08-09 REFERENCE] Cybersecurity leadership is a separate software-demand branch from AI infrastructure. Verify recurring revenue, retention, margin/cash-flow conversion and valuation; a high-volume bounce or peer strength does not remove execution risk.' },
  { sym:'NOW', name:'ServiceNow', sector:'Technology', index:'SP500' },
  { sym:'CRWD', name:'CrowdStrike', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] Cybersecurity leadership needs confirmation through recurring revenue, retention, margin/cash-flow conversion and relative strength versus failed retests. Do not equate thematic leadership with an automatic entry.' },
  { sym:'CEG', name:'Constellation Energy', sector:'Utilities', index:'SP500', memo:'[2026-08-09 REFERENCE] AI power exposure is not only MWh: interconnection timing, PPA tenor/counterparty, ramp profile, transformer/grid constraints and local power pricing determine monetization. Treat power-quality claims as facility-specific until measured evidence is available.' },
  { sym:'BE', name:'Bloom Energy', sector:'Industrials', index:'SP500', memo:'[2026-08-09 REFERENCE] Onsite/behind-the-meter power can shorten AI capacity timelines, but the thesis depends on measured load profile, fuel/electricity economics, contract quality, maintenance and power-quality controls. Do not infer grid damage or broad ratepayer impact from a single report.' },
  { sym:'HON', name:'Honeywell', sector:'Industrials', index:'SP500' },
  { sym:'AMGN', name:'Amgen', sector:'Healthcare', index:'SP500' },
  { sym:'IBM', name:'IBM', sector:'Technology', index:'SP500' },
  { sym:'BA', name:'Boeing', sector:'Industrials', index:'SP500' },
  { sym:'NKE', name:'Nike', sector:'Consumer', index:'SP500' },
  { sym:'PFE', name:'Pfizer', sector:'Healthcare', index:'SP500' },
  { sym:'AXP', name:'American Express', sector:'Financials', index:'SP500' },
  { sym:'MMM', name:'3M', sector:'Industrials', index:'SP500' },
  { sym:'VZ', name:'Verizon', sector:'Communication Services', index:'SP500' },
  { sym:'TRV', name:'Travelers', sector:'Financials', index:'SP500' },
  { sym:'DOW', name:'Dow Inc', sector:'Materials', index:'SP500' },
  // ══════════════════════════════════════════════════════════════
  // S&P 500 — 추가 대형주
  // ══════════════════════════════════════════════════════════════
  { sym:'ASML', name:'ASML Holdings', sector:'Technology', index:'ADR' },
  { sym:'LIN', name:'Linde', sector:'Materials', index:'SP500' },
  { sym:'INTU', name:'Intuit', sector:'Technology', index:'SP500' },
  { sym:'BLK', name:'BlackRock', sector:'Financials', index:'SP500' },
  { sym:'ISRG', name:'Intuitive Surgical', sector:'Healthcare', index:'SP500' },
  { sym:'UBER', name:'Uber Technologies', sector:'Industrials', index:'SP500' },
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
  { sym:'XYZ', name:'Block', sector:'Financials', index:'SP500' },
  { sym:'COP', name:'ConocoPhillips', sector:'Energy', index:'SP500' },
  { sym:'SBUX', name:'Starbucks', sector:'Consumer', index:'SP500' },
  { sym:'BROS', name:'Dutch Bros', sector:'Consumer', index:'SP400' },
  { sym:'GILD', name:'Gilead Sciences', sector:'Healthcare', index:'SP500' },
  // ══════════════════════════════════════════════════════════════
  // NASDAQ-100 전용 (S&P500 미포함 또는 나스닥 특성 강조)
  // ══════════════════════════════════════════════════════════════
  { sym:'MRVL', name:'Marvell Technology', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] AI heterogeneity and custom silicon increase the importance of interconnect, networking and integration layers. Verify design wins, customer concentration, delivery timing, margin/cash-flow conversion and relative strength; partnership headlines alone are not proof of structural necessity.' },
  { sym:'SNPS', name:'Synopsys', sector:'Technology', index:'SP500' },
  { sym:'CDNS', name:'Cadence Design', sector:'Technology', index:'SP500' },
  { sym:'LRCX', name:'Lam Research', sector:'Technology', index:'SP500' },
  { sym:'KLAC', name:'KLA Corporation', sector:'Technology', index:'SP500' },
  { sym:'REGN', name:'Regeneron', sector:'Healthcare', index:'SP500' },
  { sym:'VRTX', name:'Vertex Pharma', sector:'Healthcare', index:'SP500' },
  { sym:'FTNT', name:'Fortinet', sector:'Technology', index:'SP500' },
  { sym:'MELI', name:'MercadoLibre', sector:'Technology', index:'NASDAQ100' },
  { sym:'DDOG', name:'Datadog', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] Software leadership is confirmed by durable usage, retention, margin and cash-flow conversion. Treat peer strength and cyber/observability rotation as a research lead, then verify valuation and earnings reaction.' },
  { sym:'SNOW', name:'Snowflake', sector:'Technology', index:'NYSE' },
  { sym:'ZS', name:'Zscaler', sector:'Technology', index:'NASDAQ' },
  { sym:'TTD', name:'The Trade Desk', sector:'Technology', index:'NASDAQ' },
  { sym:'SMCI', name:'Super Micro Computer', sector:'Technology', index:'SP500' },
  { sym:'IONQ', name:'IonQ', sector:'Technology', index:'NYSE' },
  { sym:'RKLB', name:'Rocket Lab USA', sector:'Industrials', index:'NASDAQ100' },
  { sym:'ASTS', name:'AST SpaceMobile', sector:'Technology', index:'NASDAQ' },
  // ══════════════════════════════════════════════════════════════
  // Russell 2000 — 주요 소형주
  // ══════════════════════════════════════════════════════════════
  { sym:'RGTI', name:'Rigetti Computing', sector:'Technology', index:'RUSSELL2000' },
  { sym:'XNDU', name:'Xanadu Quantum', sector:'Technology', index:'NASDAQ' },
  { sym:'AMKR', name:'Amkor Technology', sector:'Technology', index:'SP400' },
  { sym:'PLAB', name:'Photronics', sector:'Technology', index:'RUSSELL2000' },
  { sym:'ASX', name:'ASE Technology', sector:'Technology', index:'NYSE' },
  { sym:'LUNR', name:'Intuitive Machines', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'SMR', name:'NuScale Power', sector:'Utilities', index:'RUSSELL2000' },
  { sym:'CLS', name:'Celestica', sector:'Technology', index:'NYSE' },
  { sym:'FN', name:'Fabrinet', sector:'Technology', index:'SP400' },
  { sym:'ONTO', name:'Onto Innovation', sector:'Technology', index:'SP400' },
  { sym:'AFRM', name:'Affirm Holdings', sector:'Financials', index:'NASDAQ' },
  { sym:'SOFI', name:'SoFi Technologies', sector:'Financials', index:'NASDAQ' },
  { sym:'UPST', name:'Upstart Holdings', sector:'Financials', index:'RUSSELL2000' },
  { sym:'RIOT', name:'Riot Platforms', sector:'Financials', index:'RUSSELL2000' },
  { sym:'MARA', name:'Marathon Digital', sector:'Financials', index:'RUSSELL2000' },
  { sym:'RDW', name:'Redwire', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'JOBY', name:'Joby Aviation', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'DNA', name:'Ginkgo Bioworks', sector:'Healthcare', index:'RUSSELL2000' },
  { sym:'QUBT', name:'Quantum Computing', sector:'Technology', index:'RUSSELL2000' },
  { sym:'CAVA', name:'CAVA Group', sector:'Consumer', index:'SP400' },
  { sym:'SOUN', name:'SoundHound AI', sector:'Technology', index:'RUSSELL2000' },
  { sym:'CRWV', name:'CoreWeave', sector:'Technology', index:'NASDAQ100', memo:'[2026-08-09 REFERENCE] Neocloud is a Q·capital game: utilization/backlog must outrun rental-price deflation while GPU depreciation, leases, funding cost, power access and counterparty concentration remain survivable. Verify current spread, runway, renewal pricing and contract quality.' },
  { sym:'NBIS', name:'Nebius Group', sector:'Technology', index:'NASDAQ100', memo:'[2026-08-09 REFERENCE] Neocloud setup requires both utilization economics and price/volume structure. For a supply-side short, require overhead supply, failed reclaim/retest and borrow/flow evidence; never infer a short from relative weakness alone.' },
  { sym:'IREN', name:'IREN Limited', sector:'Technology', index:'NASDAQ', memo:'[2026-08-09 REFERENCE] Power-cost/site optionality can matter for neocloud economics, but utilization, customer contract funding, GPU depreciation, grid/interconnection and execution remain the kill switches.' },
  { sym:'CORZ', name:'Core Scientific', sector:'Technology', index:'RUSSELL2000' },
  { sym:'BIRD', name:'Allbirds', sector:'Consumer', index:'NASDAQ' },
  // ══════════════════════════════════════════════════════════════
  // HOT / 트렌딩 / 주도주 — 시가총액 무관, 시장 관심도 높은 종목
  // ══════════════════════════════════════════════════════════════
  // ── AI / 광학 / 데이터센터 인프라 ──
  { sym:'AAOI', name:'Applied Optoelectronics', sector:'Technology', index:'NASDAQ' },
  { sym:'COHR', name:'Coherent Corp', sector:'Technology', index:'SP500' },
  { sym:'LITE', name:'Lumentum', sector:'Technology', index:'SP500' },
  { sym:'CRDO', name:'Credo Technology', sector:'Technology', index:'NASDAQ' },
  { sym:'POET', name:'POET Technologies', sector:'Technology', index:'OTC' },
  { sym:'CIEN', name:'Ciena', sector:'Technology', index:'SP500' },
  { sym:'GLW', name:'Corning', sector:'Technology', index:'SP500' },
  { sym:'VRT', name:'Vertiv Holdings', sector:'Industrials', index:'SP500', memo:'[2026-08-09 REFERENCE] AI data-center bottleneck lens: cooling, power distribution and rack-level delivery benefit from rising compute density, but validate backlog, margin, project timing and customer power availability. Total demand is not the same as executable site capacity.' },
  { sym:'DELL', name:'Dell Technologies', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] AI server demand should be decomposed into backlog conversion, GPU/memory availability, delivery margin, working capital and customer power readiness. Shipment headlines are weaker evidence than cash conversion and renewal economics.' },
  { sym:'HPE', name:'Hewlett Packard Enterprise', sector:'Technology', index:'SP500', memo:'[2026-08-09 REFERENCE] AI systems thesis requires server/cluster demand plus financing, networking, cooling and power-delivery execution. Verify backlog quality, margin/cash-flow conversion and deployment timing; a capacity announcement is not utilization proof.' },
  // ── 헬스케어 / 비만치료 / 텔레헬스 ──
  { sym:'HIMS', name:'Hims & Hers Health', sector:'Healthcare', index:'SP400' },
  { sym:'AEHR', name:'Aehr Test Systems', sector:'Technology', index:'RUSSELL2000' },
  { sym:'VIAV', name:'Viavi Solutions', sector:'Technology', index:'SP400' },
  // ── 소셜미디어 / 플랫폼 / 미디어 ──
  { sym:'RDDT', name:'Reddit', sector:'Communication Services', index:'SP500' },
  { sym:'PINS', name:'Pinterest', sector:'Communication Services', index:'SP400' },
  { sym:'SNAP', name:'Snap Inc', sector:'Communication Services', index:'NYSE' },
  { sym:'RBLX', name:'Roblox', sector:'Communication Services', index:'NYSE' },
  { sym:'SPOT', name:'Spotify', sector:'Communication Services', index:'NYSE' },
  // ── AI 인프라 / 소프트웨어 ──
  { sym:'TEM', name:'Tempus AI', sector:'Healthcare', index:'NASDAQ' },
  { sym:'AI', name:'C3.ai', sector:'Technology', index:'RUSSELL2000' },
  { sym:'PATH', name:'UiPath', sector:'Technology', index:'SP400' },
  { sym:'CRSP', name:'CRISPR Therapeutics', sector:'Healthcare', index:'RUSSELL2000' },
  { sym:'NET', name:'Cloudflare', sector:'Technology', index:'NYSE' },
  { sym:'MDB', name:'MongoDB', sector:'Technology', index:'NASDAQ' },
  { sym:'GTLB', name:'GitLab', sector:'Technology', index:'NASDAQ' },
  { sym:'ESTC', name:'Elastic', sector:'Technology', index:'NYSE' },
  // ── 핀테크 / 결제 / 크립토 ──
  { sym:'HOOD', name:'Robinhood', sector:'Financials', index:'SP500' },
  { sym:'MSTR', name:'MicroStrategy', sector:'Technology', index:'NASDAQ100' },
  // ── 전력 / 에너지 / 원전 ──
  { sym:'NRG', name:'NRG Energy', sector:'Utilities', index:'SP500' },
  { sym:'CCJ', name:'Cameco', sector:'Energy', index:'NYSE' },
  { sym:'OKLO', name:'Oklo Inc', sector:'Utilities', index:'NYSE' },
  { sym:'TLN', name:'Talen Energy', sector:'Utilities', index:'SP400' },
  // ── 자동차 / 모빌리티 ──
  { sym:'RIVN', name:'Rivian Automotive', sector:'Consumer', index:'NASDAQ' },
  { sym:'LCID', name:'Lucid Group', sector:'Consumer', index:'RUSSELL2000' },
  { sym:'GM', name:'General Motors', sector:'Consumer', index:'SP500' },
  { sym:'F', name:'Ford Motor', sector:'Consumer', index:'SP500' },
  // ── 우주 / 방산 확장 ──
  { sym:'PL', name:'Planet Labs', sector:'Technology', index:'NYSE' },
  // ── 우주 순수 플레이 (2026 확장) ──
  { sym:'NVTS', name:'Navitas Semiconductor', sector:'Technology', index:'RUSSELL2000' },
  { sym:'WOLF', name:'Wolfspeed', sector:'Technology', index:'RUSSELL2000' },
  { sym:'FLY', name:'Firefly Aerospace', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'VOYG', name:'Voyager Technologies', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'KRMN', name:'Karman Holdings', sector:'Industrials', index:'NYSE' },
  { sym:'BKSY', name:'BlackSky', sector:'Technology', index:'RUSSELL2000' },
  { sym:'IRDM', name:'Iridium', sector:'Communication Services', index:'NASDAQ' },
  { sym:'VSAT', name:'Viasat', sector:'Communication Services', index:'RUSSELL2000' },
  { sym:'GSAT', name:'Globalstar', sector:'Communication Services', index:'NASDAQ' },
  { sym:'SPIR', name:'Spire Global', sector:'Technology', index:'RUSSELL2000' },
  { sym:'SATL', name:'Satellogic', sector:'Technology', index:'RUSSELL2000' },
  // SPCE removed — Virgin Galactic defunct, replaced by LUNR/RDW (already in DB above)
  // ── 게임 / 엔터테인먼트 ──
  { sym:'TTWO', name:'Take-Two Interactive', sector:'Communication Services', index:'SP500' },
  // ── 소비재 / 리테일 / 라이프스타일 ──
  { sym:'LULU', name:'Lululemon', sector:'Consumer', index:'SP500' },
  { sym:'DECK', name:'Deckers Outdoor', sector:'Consumer', index:'SP500' },
  { sym:'CELH', name:'Celsius Holdings', sector:'Consumer Defensive', index:'SP400' },
  { sym:'ONON', name:'On Holding', sector:'Consumer', index:'NYSE' },
  // ── 방어적 배당 / 인프라 ──
  { sym:'TRGP', name:'Targa Resources', sector:'Energy', index:'SP500' },
  { sym:'WMB', name:'Williams Companies', sector:'Energy', index:'SP500' },
  { sym:'SEI', name:'Solaris Energy Infrastructure', sector:'Energy', index:'RUSSELL2000' },
  { sym:'LBRT', name:'Liberty Energy', sector:'Energy', index:'RUSSELL2000' },
  { sym:'KMI', name:'Kinder Morgan', sector:'Energy', index:'SP500' },
  // ── 산업재 / 건설 / 광업 ──
  { sym:'URI', name:'United Rentals', sector:'Industrials', index:'SP500' },
  { sym:'FCX', name:'Freeport-McMoRan', sector:'Materials', index:'SP500' },
  { sym:'NUE', name:'Nucor', sector:'Materials', index:'SP500', memo:'[2026-08-09 REFERENCE] Steel strength is a sector-relative leadership observation, not an AI inference. Verify order book, shipments, realized pricing, input costs, margins and volume-backed continuation.' },
  { sym:'RS', name:'Reliance, Inc.', sector:'Materials', index:'SP400', memo:'[2026-08-09 REFERENCE] Steel/metal distribution strength is a relative-strength lead. Confirm with operating data, margin/cycle exposure, support/retest behavior and volume; do not promote a chart observation to a fundamental thesis without filings.' },
  // ── 기타 주목 종목 ──
  { sym:'SHOP', name:'Shopify', sector:'Technology', index:'NASDAQ100' },
  { sym:'ABNB', name:'Airbnb', sector:'Consumer', index:'SP500' },
  { sym:'DASH', name:'DoorDash', sector:'Consumer', index:'SP500' },
  { sym:'ROKU', name:'Roku', sector:'Communication Services', index:'SP400' },
  { sym:'DUOL', name:'Duolingo', sector:'Technology', index:'SP400' },
  { sym:'APP', name:'AppLovin', sector:'Communication Services', index:'SP500' },
  { sym:'AXON', name:'Axon Enterprise', sector:'Industrials', index:'SP500' },
  { sym:'WDAY', name:'Workday', sector:'Technology', index:'SP500' },
  { sym:'MNDY', name:'Monday.com', sector:'Technology', index:'NASDAQ' },
  { sym:'BKNG', name:'Booking Holdings', sector:'Consumer', index:'SP500' },
  { sym:'TOST', name:'Toast', sector:'Technology', index:'SP400' },
  { sym:'GRAB', name:'Grab Holdings', sector:'Technology', index:'NASDAQ' },
  { sym:'SE', name:'Sea Limited', sector:'Technology', index:'ADR' },
  { sym:'NU', name:'Nu Holdings', sector:'Financials', index:'NYSE' },
  { sym:'PYPL', name:'PayPal', sector:'Financials', index:'SP500' },
  { sym:'GME', name:'GameStop', sector:'Consumer', index:'SP400' },
  { sym:'AMC', name:'AMC Entertainment', sector:'Communication Services', index:'RUSSELL2000' },
  { sym:'PLBY', name:'PLBY Group', sector:'Consumer', index:'RUSSELL2000' },
  { sym:'IWM', name:'iShares Russell 2000 ETF', sector:'ETF', index:'ETF' },
  { sym:'DIA', name:'SPDR Dow Jones ETF', sector:'ETF', index:'ETF' },
  { sym:'BRK-B', name:'Berkshire Hathaway B', sector:'Financials', index:'SP500' },
  { sym:'ABT', name:'Abbott Laboratories', sector:'Healthcare', index:'SP500' },
  { sym:'PM', name:'Philip Morris', sector:'Consumer Defensive', index:'SP500' },
  { sym:'PGR', name:'Progressive Corp', sector:'Financials', index:'SP500' },
  { sym:'UNP', name:'Union Pacific', sector:'Industrials', index:'SP500' },
  { sym:'TJX', name:'TJX Companies', sector:'Consumer', index:'SP500' },
  { sym:'C', name:'Citigroup', sector:'Financials', index:'SP500' },
  { sym:'SCHW', name:'Charles Schwab', sector:'Financials', index:'SP500' },
  { sym:'ADP', name:'Automatic Data Processing', sector:'Industrials', index:'SP500' },
  { sym:'BMY', name:'Bristol Myers Squibb', sector:'Healthcare', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] Insider relayed an FT-reported M&A discussion involving AstraZeneca/BMS. Treat as unconfirmed corporate-action context until company filings or authoritative reports confirm parties, terms, probability and regulatory path.' },
  { sym:'PLD', name:'Prologis', sector:'Real Estate', index:'SP500' },
  { sym:'BSX', name:'Boston Scientific', sector:'Healthcare', index:'SP500' },
  { sym:'ADI', name:'Analog Devices', sector:'Technology', index:'SP500' },
  { sym:'MDLZ', name:'Mondelez', sector:'Consumer Defensive', index:'SP500' },
  { sym:'CI', name:'Cigna Group', sector:'Healthcare', index:'SP500' },
  { sym:'SYK', name:'Stryker Corp', sector:'Healthcare', index:'SP500' },
  { sym:'WM', name:'Waste Management', sector:'Industrials', index:'SP500' },
  { sym:'DUK', name:'Duke Energy', sector:'Utilities', index:'SP500' },
  { sym:'CME', name:'CME Group', sector:'Financials', index:'SP500' },
  { sym:'EOG', name:'EOG Resources', sector:'Energy', index:'SP500' },
  { sym:'AON', name:'Aon', sector:'Financials', index:'SP500' },
  { sym:'CL', name:'Colgate-Palmolive', sector:'Consumer Defensive', index:'SP500' },
  { sym:'ICE', name:'Intercontinental Exchange', sector:'Financials', index:'SP500' },
  { sym:'MSI', name:'Motorola Solutions', sector:'Technology', index:'SP500' },
  { sym:'APH', name:'Amphenol', sector:'Technology', index:'SP500' },
  { sym:'NSC', name:'Norfolk Southern', sector:'Industrials', index:'SP500' },
  { sym:'CTAS', name:'Cintas', sector:'Industrials', index:'SP500' },
  { sym:'ORLY', name:'O\'Reilly Automotive', sector:'Consumer', index:'SP500' },
  { sym:'AZO', name:'AutoZone', sector:'Consumer', index:'SP500' },
  { sym:'MCK', name:'McKesson', sector:'Healthcare', index:'SP500' },
  { sym:'MCO', name:'Moody\'s', sector:'Financials', index:'SP500' },
  { sym:'MAR', name:'Marriott International', sector:'Consumer', index:'SP500' },
  { sym:'AIG', name:'American International Group', sector:'Financials', index:'SP500' },
  { sym:'SHW', name:'Sherwin-Williams', sector:'Materials', index:'SP500' },
  { sym:'FISV', name:'Fiserv', sector:'Financials', index:'SP500' },
  { sym:'SPG', name:'Simon Property Group', sector:'Real Estate', index:'SP500' },
  { sym:'WELL', name:'Welltower', sector:'Real Estate', index:'SP500' },
  { sym:'AFL', name:'Aflac', sector:'Financials', index:'SP500' },
  { sym:'ECL', name:'Ecolab', sector:'Materials', index:'SP500' },
  { sym:'MET', name:'MetLife', sector:'Financials', index:'SP500' },
  { sym:'PRU', name:'Prudential Financial', sector:'Financials', index:'SP500' },
  { sym:'TROW', name:'T. Rowe Price', sector:'Financials', index:'SP500' },
  { sym:'TGT', name:'Target', sector:'Consumer Defensive', index:'SP500' },
  { sym:'EBAY', name:'eBay', sector:'Consumer', index:'SP500' },
  { sym:'PCAR', name:'PACCAR Inc', sector:'Industrials', index:'SP500' },
  { sym:'DD', name:'DuPont de Nemours', sector:'Industrials', index:'SP500' },
  { sym:'HCA', name:'HCA Healthcare', sector:'Healthcare', index:'SP500' },
  { sym:'ROP', name:'Roper Technologies', sector:'Technology', index:'SP500' },
  { sym:'DHR', name:'Danaher', sector:'Healthcare', index:'SP500' },
  // P1449: 'A'는 Agilent Technologies이다 (INC0001090872, SEC name: AGILENT TECHNOLOGIES, INC.).
  // Avantor는 AVTR이고 SCREENER_DB에 없다 — 테마 화면이 'A'를 Avantor로 표기하면 요약/재무 화면
  // 과 같은 티커가 두 회사를 가리켰다(P1339: 티커 추측 금지).
  { sym:'A', name:'Agilent Technologies', sector:'Healthcare', index:'SP500' },
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
  { sym:'PAYX', name:'Paychex', sector:'Industrials', index:'SP500' },
  { sym:'IQV', name:'IQVIA Holdings', sector:'Healthcare', index:'SP500' },
  { sym:'BNY', name:'BNY Mellon', sector:'Financials', index:'SP500' },
  { sym:'STZ', name:'Constellation Brands', sector:'Consumer Defensive', index:'SP500' },
  { sym:'CNC', name:'Centene', sector:'Healthcare', index:'SP500' },
  { sym:'NXPI', name:'NXP Semiconductors', sector:'Technology', index:'SP500' },
  { sym:'GPN', name:'Global Payments', sector:'Financials', index:'SP500' },
  { sym:'CTSH', name:'Cognizant', sector:'Technology', index:'SP500' },
  { sym:'MSCI', name:'MSCI Inc', sector:'Financials', index:'SP500' },
  { sym:'OTIS', name:'Otis Worldwide', sector:'Industrials', index:'SP500' },
  { sym:'KEYS', name:'Keysight Technologies', sector:'Technology', index:'SP500' },
  { sym:'TDG', name:'Transdigm Group', sector:'Industrials', index:'SP500' },
  { sym:'STE', name:'Steris plc', sector:'Healthcare', index:'SP500' },
  { sym:'COF', name:'Capital One', sector:'Financials', index:'SP500' },
  { sym:'RMD', name:'ResMed', sector:'Healthcare', index:'SP500' },
  { sym:'VRSK', name:'Verisk Analytics', sector:'Industrials', index:'SP500' },
  { sym:'EFX', name:'Equifax', sector:'Industrials', index:'SP500' },
  { sym:'HUBB', name:'Hubbell Inc', sector:'Industrials', index:'SP500' },

  // ═══ v33.1: 시총 $10B+ 전종목 + 핵심 ETF + 유명 소형주 (368개) ═══
  { sym:'GOOG', name:'Alphabet Class C', sector:'Communication Services', index:'SP500', shareClassOf:'GOOGL' },
  { sym:'GEV', name:'GE Vernova', sector:'Industrials', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] Aether/BornLupin/HANA themes point to data-center power, grid, transmission and ESS constraints. Verify equipment backlog, utility orders, project timing, margin and permitted interconnection; announced demand is not recognized revenue.' },
  { sym:'TMUS', name:'T-Mobile US', sector:'Communication Services', index:'SP500' },
  { sym:'TXN', name:'Texas Instruments', sector:'Technology', index:'SP500' },
  { sym:'ANET', name:'Arista Networks', sector:'Technology', index:'SP500' },
  { sym:'ETN', name:'Eaton Corp', sector:'Industrials', index:'SP500', memo:'[2026-08-09 REFERENCE] Grid/AI data-center exposure is a power-quality and equipment-cycle thesis: switchgear, transformers and distribution must handle density and load volatility. Verify orders, lead times, margin and actual interconnection demand.' },
  { sym:'NVT', name:'nVent Electric', sector:'Industrials', index:'SP400', memo:'[2026-08-09 TG-REFERENCE] Power-quality and high-density data-center equipment are a downstream beneficiary hypothesis. Verify enclosure/distribution backlog, pricing, lead times, thermal requirements and customer/site readiness.' },
  { sym:'CB', name:'Chubb Ltd', sector:'Financials', index:'SP500' },
  { sym:'ACN', name:'Accenture', sector:'Technology', index:'SP500' },
  { sym:'PH', name:'Parker-Hannifin', sector:'Industrials', index:'SP500' },
  { sym:'MDT', name:'Medtronic', sector:'Healthcare', index:'SP500' },
  { sym:'MO', name:'Altria Group', sector:'Consumer Defensive', index:'SP500' },
  { sym:'NEM', name:'Newmont Corp', sector:'Materials', index:'SP500' },
  { sym:'SO', name:'Southern Company', sector:'Utilities', index:'SP500' },
  { sym:'CMCSA', name:'Comcast', sector:'Communication Services', index:'SP500' },
  { sym:'SNDK', name:'SanDisk', sector:'Technology', index:'SP500', memo:'[2026-08-13 REFERENCE · Sandisk Investor Day] 구조 프레임: AI 추론의 긴 context·KV cache·staging/fast data lake → enterprise SSD/NAND 수요 → NBM 다년 계약의 mix·volume·floor 조건 → bit/wafer·yield·capital intensity → reported FCF/share와 자본환원. 회사 목표(FY28~30 mid-to-high-teens 성장, 약 80% non-GAAP GM, 약 50% adjusted FCF margin)는 현재 실적이 아닌 forward-looking claim이다. 확인: NBM 매출 비중·기간·고객집중, RPO/TCV의 매출·현금 전환, BiCS9/10 yield·cost/bit·qualification, JV 현금흐름, 세금·운전자본·조정항목, diluted shares와 buyback 평균가. 반증: floor/계약 수정, mix·마진 정상화, 기술전환·수율 지연, 고객집중, capex 상승. HBF는 표준화→sample→qualification→양산·채택을 거쳐야 하는 옵션이며 현재 매출과 분리한다. Source: Sandisk 2026 Investor Day IR (2026-08-13); 공식 공시로 후속 검증.' },
  { sym:'WDC', name:'Western Digital', sector:'Technology', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] HANA/Insider memory posts emphasize LTA, NAND pricing and AI-storage demand. Verify contract coverage, spot/contract spread, inventory, customer concentration and cycle rollover; target-price recirculation is not evidence.' },
  { sym:'HWM', name:'Howmet Aerospace', sector:'Industrials', index:'SP500' },
  { sym:'EQIX', name:'Equinix', sector:'Real Estate', index:'SP500' },
  { sym:'TT', name:'Trane Technologies', sector:'Industrials', index:'SP500' },
  { sym:'CVS', name:'CVS Health', sector:'Healthcare', index:'SP500' },
  { sym:'STX', name:'Seagate Tech', sector:'Technology', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] AI inference/storage demand should be tested through exabyte shipments, pricing, mix, cloud customers and cash conversion. Telegram storage commentary is a discovery lead, not a current demand estimate.' },
  { sym:'SIMO', name:'Silicon Motion', sector:'Technology', index:'NASDAQ' },
  { sym:'285A.T', name:'Kioxia Holdings', sector:'Technology', index:'TSE', memo:'[2026-08-09 TG-REFERENCE] Insider highlighted PCIe 6.0/UFS 5.0 NAND roadmap claims. Verify mass-production timing, qualification, customer design wins, yield and NAND pricing from company/industry evidence.' },
  { sym:'8035.T', name:'Tokyo Electron', sector:'Technology', index:'TSE' },
  { sym:'6702.T', name:'Fujitsu', sector:'Technology', index:'TSE' },
  { sym:'FDX', name:'FedEx', sector:'Industrials', index:'SP500' },
  { sym:'PWR', name:'Quanta Services', sector:'Industrials', index:'SP500', memo:'[2026-08-09 REFERENCE] AI capacity bottlenecks can migrate from chips to transmission, substations and interconnection queues. Track backlog conversion, permitting, utility capex and project execution; headline queue size is not revenue.' },
  { sym:'POWL', name:'Powell Industries', sector:'Industrials', index:'NASDAQ' },
  { sym:'MTZ', name:'MasTec', sector:'Industrials', index:'SP400' },
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
  { sym:'KEX', name:'Kirby Corp', sector:'Industrials', index:'SP400' },
  { sym:'RCL', name:'Royal Caribbean', sector:'Consumer', index:'SP500' },
  { sym:'EMR', name:'Emerson Electric', sector:'Industrials', index:'SP500' },
  { sym:'CSX', name:'CSX Corp', sector:'Industrials', index:'SP500' },
  { sym:'PSX', name:'Phillips 66', sector:'Energy', index:'SP500', memo:'[2026-08-09 REFERENCE] Refinery strength must be decomposed into crack spread, inventory, utilization, turnaround and regional basis. Lower crude is only one input and does not by itself prove durable earnings.' },
  { sym:'DINO', name:'HF Sinclair', sector:'Energy', index:'SP400', memo:'[2026-08-09 REFERENCE] Refiners can benefit from lower crude input costs only through the full crack-spread, inventory, utilization and turnaround chain. Separate crude-price beta from product demand, regional basis and maintenance risk.' },
  { sym:'VLO', name:'Valero Energy', sector:'Energy', index:'SP500', memo:'[2026-08-09 REFERENCE] Refiner relative strength can persist without crude confirmation, but the operating bridge is crack spreads, product demand, inventory, utilization and maintenance. Use price action as a lead, not a conclusion.' },
  { sym:'CRH', name:'CRH plc', sector:'Materials', index:'SP500' },
  { sym:'HLT', name:'Hilton', sector:'Consumer', index:'SP500' },
  { sym:'ROST', name:'Ross Stores', sector:'Consumer', index:'SP500' },
  { sym:'MPC', name:'Marathon Petroleum', sector:'Energy', index:'SP500', memo:'[2026-08-09 REFERENCE] Refinery leadership requires a full crack-spread and operating check: product demand, inventory, utilization, turnaround and regional basis. Separate a lower-crude tailwind from durable cash-flow evidence.' },  { sym:'RSG', name:'Republic Services', sector:'Industrials', index:'SP500' },
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
  { sym:'CTVA', name:'Corteva', sector:'Materials', index:'SP400' },
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
  { sym:'TER', name:'Teradyne', sector:'Technology', index:'SP500' },
  { sym:'2454.TW', name:'MediaTek', sector:'Technology', index:'TWSE', memo:'[2026-08-09 TG-REFERENCE] Insider/HANA relayed Google TPU supply-chain participation and future-node demand. Verify design-win status, tape-out/production timing, fee economics and customer concentration; forecast unit counts remain reference-only.' },
  { sym:'EW', name:'Edwards Lifesciences', sector:'Healthcare', index:'SP500' },
  { sym:'ETR', name:'Entergy', sector:'Utilities', index:'SP500' },
  { sym:'GRMN', name:'Garmin', sector:'Consumer', index:'SP500' },
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
  { sym:'HIG', name:'Hartford Financial', sector:'Financials', index:'SP500' },
  { sym:'ACGL', name:'Arch Capital', sector:'Financials', index:'SP500' },
  { sym:'IFF', name:'Intl Flavors & Fragrances', sector:'Materials', index:'SP500' },
  { sym:'STT', name:'State Street', sector:'Financials', index:'SP500' },
  { sym:'KVUE', name:'Kenvue', sector:'Consumer Defensive', index:'SP500' },
  { sym:'PPG', name:'PPG Industries', sector:'Materials', index:'SP500' },
  { sym:'VLTO', name:'Veralto', sector:'Industrials', index:'SP500' },
  { sym:'GEHC', name:'GE HealthCare', sector:'Healthcare', index:'SP500' },
  { sym:'HPQ', name:'HP Inc', sector:'Technology', index:'SP500' },
  { sym:'MTB', name:'M&T Bank', sector:'Financials', index:'SP500' },
  { sym:'LDOS', name:'Leidos Holdings', sector:'Industrials', index:'SP500' },
  { sym:'IT', name:'Gartner', sector:'Technology', index:'SP500' },
  { sym:'CPAY', name:'Corpay', sector:'Financials', index:'SP500' },
  { sym:'WST', name:'West Pharma', sector:'Healthcare', index:'SP500' },
  { sym:'PHM', name:'PulteGroup', sector:'Consumer', index:'SP500' },
  { sym:'SBAC', name:'SBA Communications', sector:'Real Estate', index:'SP500' },
  { sym:'RF', name:'Regions Financial', sector:'Financials', index:'SP500' },
  { sym:'WRB', name:'Berkley Corp', sector:'Financials', index:'SP500' },
  { sym:'NTAP', name:'NetApp', sector:'Technology', index:'SP500' },
  { sym:'MTD', name:'Mettler-Toledo', sector:'Healthcare', index:'SP500' },
  { sym:'AWK', name:'American Water Works', sector:'Utilities', index:'SP500' },
  { sym:'ATO', name:'Atmos Energy', sector:'Utilities', index:'SP500' },
  { sym:'PPL', name:'PPL Corp', sector:'Utilities', index:'SP500' },
  { sym:'ESS', name:'Essex Property', sector:'Real Estate', index:'SP500' },
  { sym:'EIX', name:'Edison Intl', sector:'Utilities', index:'SP500' },
  { sym:'DG', name:'Dollar General', sector:'Consumer Defensive', index:'SP500' },
  { sym:'EXR', name:'Extra Space Storage', sector:'Real Estate', index:'SP500' },
  { sym:'CDW', name:'CDW Corp', sector:'Technology', index:'SP500' },
  { sym:'IRM', name:'Iron Mountain', sector:'Real Estate', index:'SP500' },
  { sym:'CLX', name:'Clorox', sector:'Consumer Defensive', index:'SP500' },
  { sym:'MAA', name:'Mid-America Apartment', sector:'Real Estate', index:'SP500' },
  { sym:'GDDY', name:'GoDaddy', sector:'Technology', index:'SP500' },
  { sym:'TSCO', name:'Tractor Supply', sector:'Consumer', index:'SP500' },
  { sym:'VTR', name:'Ventas', sector:'Real Estate', index:'SP500' },
  { sym:'LII', name:'Lennox Intl', sector:'Industrials', index:'SP500' },
  { sym:'ZBRA', name:'Zebra Technologies', sector:'Technology', index:'SP500' },
  { sym:'CHD', name:'Church & Dwight', sector:'Consumer Defensive', index:'SP500' },
  { sym:'VRSN', name:'VeriSign', sector:'Technology', index:'SP500' },
  { sym:'PKG', name:'Packaging Corp', sector:'Materials', index:'SP500' },
  { sym:'MKTX', name:'MarketAxess', sector:'Financials', index:'NASDAQ' },
  { sym:'LYV', name:'Live Nation', sector:'Communication Services', index:'SP500' },
  { sym:'TYL', name:'Tyler Technologies', sector:'Technology', index:'SP500' },
  { sym:'CBOE', name:'Cboe Global Markets', sector:'Financials', index:'SP500' },
  { sym:'BR', name:'Broadridge Financial', sector:'Industrials', index:'SP500' },
  { sym:'STLD', name:'Steel Dynamics', sector:'Materials', index:'SP500', memo:'[2026-08-09 REFERENCE] Steel leadership is a relative-strength observation. Verify shipments, price/mix, input costs, margins, capital allocation and volume-backed continuation before treating it as a durable cycle signal.' },
  { sym:'FE', name:'FirstEnergy', sector:'Utilities', index:'SP500' },
  { sym:'J', name:'Jacobs Solutions', sector:'Industrials', index:'SP500' },
  { sym:'LUV', name:'Southwest Airlines', sector:'Industrials', index:'SP500' },
  { sym:'CAG', name:'Conagra Brands', sector:'Consumer Defensive', index:'NYSE' },
  { sym:'NI', name:'NiSource', sector:'Utilities', index:'SP500' },
  { sym:'KDP', name:'Keurig Dr Pepper', sector:'Consumer Defensive', index:'SP500' },
  { sym:'EG', name:'Everest Group', sector:'Financials', index:'SP500' },
  { sym:'HAL', name:'Halliburton', sector:'Energy', index:'SP500' },
  { sym:'CFG', name:'Citizens Financial', sector:'Financials', index:'SP500' },
  { sym:'WTW', name:'Willis Towers Watson', sector:'Financials', index:'SP500' },
  { sym:'KEY', name:'KeyCorp', sector:'Financials', index:'SP500' },
  { sym:'BRO', name:'Brown & Brown', sector:'Financials', index:'SP500' },
  { sym:'MOH', name:'Molina Healthcare', sector:'Healthcare', index:'SP400' },
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
  { sym:'WSO', name:'Watsco', sector:'Industrials', index:'SP400' },
  { sym:'BAX', name:'Baxter Intl', sector:'Healthcare', index:'SP500' },
  { sym:'CPB', name:'Campbell Soup', sector:'Consumer Defensive', index:'NASDAQ' },
  { sym:'DVA', name:'DaVita', sector:'Healthcare', index:'SP500' },
  { sym:'PODD', name:'Insulet', sector:'Healthcare', index:'SP500' },
  { sym:'WAT', name:'Waters Corp', sector:'Healthcare', index:'SP500' },
  { sym:'EXPD', name:'Expeditors Intl', sector:'Industrials', index:'SP500' },
  { sym:'CINF', name:'Cincinnati Financial', sector:'Financials', index:'SP500' },
  { sym:'POOL', name:'Pool Corp', sector:'Consumer', index:'NASDAQ' },
  { sym:'EMN', name:'Eastman Chemical', sector:'Materials', index:'NYSE' },
  { sym:'NVR', name:'NVR Inc', sector:'Consumer', index:'SP500' },
  { sym:'BLDR', name:'Builders FirstSource', sector:'Consumer', index:'NYSE' },
  { sym:'NTRS', name:'Northern Trust', sector:'Financials', index:'SP500' },
  { sym:'LKQ', name:'LKQ Corp', sector:'Consumer', index:'NASDAQ' },
  { sym:'FSLR', name:'First Solar', sector:'Technology', index:'SP500' },
  { sym:'ENPH', name:'Enphase Energy', sector:'Technology', index:'NASDAQ' },
  { sym:'ON', name:'ON Semiconductor', sector:'Technology', index:'SP500' },
  { sym:'SWKS', name:'Skyworks Solutions', sector:'Technology', index:'SP500' },
  { sym:'JBHT', name:'JB Hunt Transport', sector:'Industrials', index:'SP500' },
  { sym:'JBL', name:'Jabil Inc', sector:'Technology', index:'SP500' },
  { sym:'RL', name:'Ralph Lauren', sector:'Consumer', index:'SP500' },
  { sym:'KIM', name:'Kimco Realty', sector:'Real Estate', index:'SP500' },
  { sym:'TFX', name:'Teleflex', sector:'Healthcare', index:'NYSE' },
  { sym:'ILMN', name:'Illumina', sector:'Healthcare', index:'SP500' },
  { sym:'PTC', name:'PTC Inc', sector:'Technology', index:'SP500' },
  { sym:'ALB', name:'Albemarle', sector:'Materials', index:'SP500', memo:'[2026-08-09 TG-REFERENCE] HANA battery posts describe lithium inventory/tightness and a potential second-half demand recovery. Verify lithium spot/contract prices, inventory days, brine/conversion volumes, capex and EV/ESS demand; channel estimates are not current commodity data.' },
  { sym:'ALGN', name:'Align Technology', sector:'Healthcare', index:'SP500' },
  { sym:'NCLH', name:'Norwegian Cruise', sector:'Consumer', index:'SP500' },
  { sym:'BBWI', name:'Bath & Body Works', sector:'Consumer', index:'SP400' },
  { sym:'MGM', name:'MGM Resorts', sector:'Consumer', index:'SP500' },
  { sym:'APTV', name:'Aptiv', sector:'Consumer', index:'SP500' },
  { sym:'GEN', name:'Gen Digital', sector:'Technology', index:'SP500' },
  { sym:'CZR', name:'Caesars Entertainment', sector:'Consumer', index:'NASDAQ' },
  { sym:'CE', name:'Celanese', sector:'Materials', index:'NYSE' },
  { sym:'GL', name:'Globe Life', sector:'Financials', index:'SP500' },
  { sym:'HRL', name:'Hormel Foods', sector:'Consumer Defensive', index:'SP500' },
  { sym:'AES', name:'AES Corp', sector:'Utilities', index:'SP500' },
  { sym:'CMS', name:'CMS Energy', sector:'Utilities', index:'SP500' },
  { sym:'AKAM', name:'Akamai', sector:'Technology', index:'SP500' },
  { sym:'UDR', name:'UDR Inc', sector:'Real Estate', index:'SP500' },
  { sym:'BXP', name:'Boston Properties', sector:'Real Estate', index:'SP500' },
  { sym:'ALLE', name:'Allegion', sector:'Industrials', index:'SP500' },
  { sym:'AIZ', name:'Assurant', sector:'Financials', index:'SP500' },
  { sym:'MHK', name:'Mohawk Industries', sector:'Consumer', index:'NYSE' },
  { sym:'MTCH', name:'Match Group', sector:'Communication Services', index:'NASDAQ' },
  { sym:'GNRC', name:'Generac', sector:'Industrials', index:'SP500' },
  { sym:'RHI', name:'Robert Half', sector:'Industrials', index:'NYSE' },
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
  { sym:'BIO', name:'Bio-Rad Labs', sector:'Healthcare', index:'SP400' },
  { sym:'VTRS', name:'Viatris', sector:'Healthcare', index:'SP500' },
  { sym:'CRL', name:'Charles River Labs', sector:'Healthcare', index:'SP500' },
  { sym:'TPR', name:'Tapestry', sector:'Consumer', index:'SP500' },
  { sym:'SWK', name:'Stanley Black & Decker', sector:'Industrials', index:'SP500' },
  { sym:'PAYC', name:'Paycom', sector:'Technology', index:'NYSE' },
  { sym:'EPAM', name:'EPAM Systems', sector:'Technology', index:'NYSE' },
  { sym:'RVTY', name:'Revvity', sector:'Healthcare', index:'SP500' },
  { sym:'SOLV', name:'Solventum', sector:'Healthcare', index:'SP500' },
  { sym:'BWA', name:'BorgWarner', sector:'Industrials', index:'SP400' },
  { sym:'SKYD', name:'Skydance', sector:'Communication Services', index:'SP500' },
  { sym:'WYNN', name:'Wynn Resorts', sector:'Consumer', index:'SP500' },
  { sym:'CHTR', name:'Charter Communications', sector:'Communication Services', index:'SP500' },
  { sym:'CPRT', name:'Copart', sector:'Industrials', index:'SP500' },
  { sym:'DLTR', name:'Dollar Tree', sector:'Consumer Defensive', index:'SP500' },
  { sym:'DXCM', name:'DexCom', sector:'Healthcare', index:'SP500' },
  { sym:'GFS', name:'GlobalFoundries', sector:'Technology', index:'NASDAQ' },
  { sym:'MCHP', name:'Microchip Technology', sector:'Technology', index:'SP500' },
  { sym:'ODFL', name:'Old Dominion Freight', sector:'Industrials', index:'SP500' },
  { sym:'FOXA', name:'Fox Corp A', sector:'Communication Services', index:'SP500' },
  { sym:'FOX', name:'Fox Corp B', sector:'Communication Services', index:'SP500', shareClassOf:'FOXA' },
  { sym:'NWSA', name:'News Corp A', sector:'Communication Services', index:'SP500' },
  { sym:'NWS', name:'News Corp B', sector:'Communication Services', index:'SP500', shareClassOf:'NWSA' },
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
  { sym:'SNY', name:'Sanofi', sector:'Healthcare', index:'NASDAQ' },
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
  { sym:'NTES', name:'NetEase', sector:'Technology', index:'NASDAQ' },
  { sym:'JD', name:'JD.com', sector:'Technology', index:'NASDAQ' },
  { sym:'BIDU', name:'Baidu', sector:'Technology', index:'NASDAQ' },
  { sym:'TCOM', name:'Trip.com', sector:'Consumer', index:'NASDAQ' },
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
  { sym:'LNG', name:'Cheniere Energy', sector:'Energy', index:'NYSE' },
  { sym:'CCEP', name:'Coca-Cola Europacific', sector:'Consumer Defensive', index:'NASDAQ100' },
  { sym:'CCL', name:'Carnival Corp', sector:'Consumer', index:'SP500' },
  { sym:'ALNY', name:'Alnylam Pharma', sector:'Healthcare', index:'NASDAQ100' },
  { sym:'ARGX', name:'argenx SE', sector:'Healthcare', index:'NASDAQ' },
  { sym:'TKO', name:'TKO Group', sector:'Communication Services', index:'SP500' },
  { sym:'FERG', name:'Ferguson Enterprises', sector:'Industrials', index:'SP500' },
  { sym:'TRI', name:'Thomson Reuters', sector:'Industrials', index:'NASDAQ100' },
  { sym:'MDLN', name:'Medline Inc', sector:'Healthcare', index:'NASDAQ' },
  { sym:'WCN', name:'Waste Connections', sector:'Industrials', index:'NYSE' },
  { sym:'HEI', name:'HEICO Corp', sector:'Industrials', index:'NYSE' },
  { sym:'FER', name:'Ferrovial', sector:'Industrials', index:'NASDAQ100' },
  { sym:'TEAM', name:'Atlassian', sector:'Technology', index:'NASDAQ' },
  { sym:'RKT', name:'Rocket Companies', sector:'Financials', index:'NYSE' },
  { sym:'SPY', name:'SPDR S&P 500 ETF', sector:'ETF', index:'ETF' },
  { sym:'QQQ', name:'Invesco QQQ Trust', sector:'ETF', index:'ETF' },
  { sym:'VTI', name:'Vanguard Total Market', sector:'ETF', index:'ETF' },
  { sym:'VOO', name:'Vanguard S&P 500', sector:'ETF', index:'ETF' },
  { sym:'IVV', name:'iShares Core S&P 500', sector:'ETF', index:'ETF' },
  { sym:'SOXX', name:'iShares Semiconductor', sector:'ETF', index:'ETF' },
  { sym:'ARKK', name:'ARK Innovation', sector:'ETF', index:'ETF' },
  { sym:'ARKG', name:'ARK Genomic', sector:'ETF', index:'ETF' },
  { sym:'ARKF', name:'ARK Fintech', sector:'ETF', index:'ETF' },
  { sym:'GLD', name:'SPDR Gold', sector:'ETF', index:'ETF' },
  { sym:'SLV', name:'iShares Silver', sector:'ETF', index:'ETF' },
  { sym:'USO', name:'US Oil Fund', sector:'ETF', index:'ETF' },
  { sym:'TLT', name:'iShares 20+ Treasury', sector:'ETF', index:'ETF' },
  { sym:'TIP', name:'iShares TIPS', sector:'ETF', index:'ETF' },
  { sym:'HYG', name:'iShares High Yield', sector:'ETF', index:'ETF' },
  { sym:'LQD', name:'iShares Inv Grade', sector:'ETF', index:'ETF' },
  { sym:'SHY', name:'iShares 1-3Y Treasury', sector:'ETF', index:'ETF' },
  { sym:'BND', name:'Vanguard Total Bond', sector:'ETF', index:'ETF' },
  { sym:'AGG', name:'iShares US Aggregate', sector:'ETF', index:'ETF' },
  { sym:'EEM', name:'iShares Emerging', sector:'ETF', index:'ETF' },
  { sym:'EFA', name:'iShares EAFE', sector:'ETF', index:'ETF' },
  { sym:'FXI', name:'iShares China', sector:'ETF', index:'ETF' },
  { sym:'EWJ', name:'iShares Japan', sector:'ETF', index:'ETF' },
  { sym:'EWY', name:'iShares Korea', sector:'ETF', index:'ETF' },
  { sym:'VWO', name:'Vanguard Emerging', sector:'ETF', index:'ETF' },
  { sym:'INDA', name:'iShares India', sector:'ETF', index:'ETF' },
  { sym:'VXX', name:'iPath VIX', sector:'ETF', index:'ETF' },
  { sym:'UVXY', name:'ProShares Ultra VIX', sector:'ETF', index:'ETF' },


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
  { sym:'ADM', name:'Archer-Daniels-Midland', sector:'Consumer Defensive', index:'SP500' },
  { sym:'ES', name:'Eversource Energy', sector:'Utilities', index:'SP500' },
  { sym:'FANUY', name:'Fanuc Corp', sector:'Industrials', index:'ADR' },
  // IIVI removed — merged into COHR (Coherent Corp)
  { sym:'JETS', name:'US Global Jets ETF', sector:'ETF', index:'ETF' },
  { sym:'NDSN', name:'Nordson Corp', sector:'Industrials', index:'SP500' },
  { sym:'PNW', name:'Pinnacle West Capital', sector:'Utilities', index:'SP500' },
  { sym:'TPL', name:'Texas Pacific Land', sector:'Energy', index:'SP500' },
  // ── THEME↔SCREENER 불일치 보강 (v34.7 감사) ──
  { sym:'AA', name:'Alcoa Corp', sector:'Materials', index:'SP400' },
  { sym:'BIIB', name:'Biogen', sector:'Healthcare', index:'SP500' },
  { sym:'CLSK', name:'CleanSpark', sector:'Technology', index:'RUSSELL2000' },
  { sym:'ETSY', name:'Etsy', sector:'Consumer', index:'NYSE' },
  { sym:'LAC', name:'Lithium Americas', sector:'Materials', index:'NYSE' },
  { sym:'MP', name:'MP Materials', sector:'Materials', index:'SP400' },
  { sym:'RUN', name:'Sunrun', sector:'Utilities', index:'RUSSELL2000' },
  { sym:'SEDG', name:'SolarEdge Technologies', sector:'Technology', index:'NASDAQ' },
  { sym:'STAG', name:'STAG Industrial', sector:'Real Estate', index:'SP400' },
  { sym:'IBIT', name:'iShares Bitcoin Trust ETF', sector:'ETF', index:'ETF' },
  { sym:'BITO', name:'ProShares Bitcoin Strategy ETF', sector:'ETF', index:'ETF' },
  { sym:'QBTS', name:'D-Wave Quantum', sector:'Technology', index:'RUSSELL2000' },
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
  { sym:'042700.KS', name:'한미반도체', sector:'Technology', index:'KOSPI' },
  { sym:'009150.KS', name:'삼성전기', sector:'Technology', index:'KOSPI' },
  { sym:'402340.KS', name:'SK스퀘어', sector:'Technology', index:'KOSPI' },
  { sym:'039030.KQ', name:'이오테크닉스', sector:'Technology', index:'KOSDAQ', memo:'[2026-08-09 TG-REFERENCE] BornLupin relayed a government-supported super-乙 project for high-speed laser heat-treatment equipment. Verify official award, scope, timing, customer qualification and revenue recognition.' },
  { sym:'403870.KQ', name:'HPSP', sector:'Technology', index:'KOSDAQ' },
  { sym:'058470.KQ', name:'리노공업', sector:'Technology', index:'KOSDAQ' },
  { sym:'240810.KQ', name:'원익IPS', sector:'Technology', index:'KOSDAQ' },
  { sym:'000990.KS', name:'DB하이텍', sector:'Technology', index:'KOSPI' },
  { sym:'036930.KQ', name:'주성엔지니어링', sector:'Technology', index:'KOSDAQ' },
  { sym:'131970.KQ', name:'두산테스나', sector:'Technology', index:'KOSDAQ' },
  { sym:'005290.KQ', name:'동진쎄미켐', sector:'Materials', index:'KOSDAQ' },
  { sym:'357780.KQ', name:'솔브레인', sector:'Materials', index:'KOSDAQ' },
  { sym:'025560.KS', name:'미래산업', sector:'Technology', index:'KOSPI' },

  //  K-방산 (defense)
  { sym:'047810.KS', name:'한국항공우주(KAI)', sector:'Industrials', index:'KOSPI' },
  { sym:'079550.KS', name:'LIG디펜스앤에어로스페이스', sector:'Industrials', index:'KOSPI' },
  { sym:'064350.KS', name:'현대로템', sector:'Industrials', index:'KOSPI' },
  { sym:'272210.KS', name:'한화시스템', sector:'Industrials', index:'KOSPI' },
  { sym:'000880.KS', name:'한화', sector:'Industrials', index:'KOSPI' },
  { sym:'103140.KS', name:'풍산', sector:'Industrials', index:'KOSPI' },

  //  조선 (shipbuilding)
  { sym:'329180.KS', name:'HD현대중공업', sector:'Industrials', index:'KOSPI' },
  { sym:'009540.KS', name:'HD한국조선해양', sector:'Industrials', index:'KOSPI' },
  { sym:'010140.KS', name:'삼성중공업', sector:'Industrials', index:'KOSPI' },
  { sym:'267250.KS', name:'HD현대', sector:'Industrials', index:'KOSPI' },
  { sym:'082740.KS', name:'한화엔진', sector:'Industrials', index:'KOSPI' },
  { sym:'011200.KS', name:'HMM', sector:'Industrials', index:'KOSPI' },

  // 전력기기 (power-grid)
  { sym:'298040.KS', name:'효성중공업', sector:'Industrials', index:'KOSPI' },
  { sym:'267260.KS', name:'HD현대일렉트릭', sector:'Industrials', index:'KOSPI' },
  { sym:'010120.KS', name:'LS일렉트릭', sector:'Industrials', index:'KOSPI' },
  { sym:'103590.KS', name:'일진전기', sector:'Industrials', index:'KOSPI' },
  { sym:'006260.KS', name:'LS', sector:'Industrials', index:'KOSPI' },
  { sym:'229640.KS', name:'LS에코에너지', sector:'Industrials', index:'KOSPI' },
  { sym:'000500.KS', name:'가온전선', sector:'Industrials', index:'KOSPI' },
  { sym:'033100.KQ', name:'제룡전기', sector:'Industrials', index:'KOSDAQ' },

  //  원전 (nuclear)
  { sym:'034020.KS', name:'두산에너빌리티', sector:'Industrials', index:'KOSPI' },
  { sym:'052690.KS', name:'한전기술', sector:'Industrials', index:'KOSPI' },
  { sym:'051600.KS', name:'한전KPS', sector:'Industrials', index:'KOSPI' },
  { sym:'092200.KS', name:'디아이씨', sector:'Industrials', index:'KOSPI' },

  //  2차전지 (battery)
  { sym:'005490.KS', name:'POSCO홀딩스', sector:'Materials', index:'KOSPI' },
  { sym:'096770.KS', name:'SK이노베이션', sector:'Energy', index:'KOSPI' },
  { sym:'247540.KQ', name:'에코프로비엠', sector:'Materials', index:'KOSDAQ', memo:'[2026-08-09 TG-REFERENCE] BornLupin/HANA battery posts frame ESS, North America non-China supply and lithium/VC tightness as separate hypotheses. Verify order disclosure, eligible-origin rules, raw-material cost pass-through, inventory and customer qualification.' },
  { sym:'086520.KQ', name:'에코프로', sector:'Materials', index:'KOSDAQ' },
  { sym:'003670.KS', name:'포스코퓨처엠', sector:'Materials', index:'KOSPI', memo:'[2026-08-09 TG-REFERENCE] HANA/BornLupin relay North American ESS order-cycle and non-China material sourcing themes. Verify signed contract, volume, timing, subsidy/origin eligibility and margin; sector narrative alone is not an order.' },
  { sym:'066970.KS', name:'엘앤에프', sector:'Materials', index:'KOSPI' },

  //  바이오 (bio)
  { sym:'196170.KQ', name:'알테오젠', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'128940.KS', name:'한미약품', sector:'Healthcare', index:'KOSPI' },
  { sym:'028300.KQ', name:'HLB', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'000100.KS', name:'유한양행', sector:'Healthcare', index:'KOSPI' },
  { sym:'145020.KQ', name:'휴젤', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'302440.KS', name:'SK바이오사이언스', sector:'Healthcare', index:'KOSPI' },
  { sym:'141080.KQ', name:'리가켐바이오', sector:'Healthcare', index:'KOSDAQ' },

  //  K-뷰티 (kbeauty)
  { sym:'090430.KS', name:'아모레퍼시픽', sector:'Consumer', index:'KOSPI' },
  { sym:'051900.KS', name:'LG생활건강', sector:'Consumer', index:'KOSPI' },
  { sym:'044820.KS', name:'코스맥스BTI', sector:'Consumer', index:'KOSPI' },
  { sym:'192820.KS', name:'코스맥스', sector:'Consumer', index:'KOSPI' },
  { sym:'161890.KS', name:'한국콜마', sector:'Consumer', index:'KOSPI' },
  { sym:'278470.KS', name:'에이피알(APR)', sector:'Consumer', index:'KOSPI', memo:'[2026-08-09 TG-REFERENCE] BornLupin relayed sell-side commentary on North America/Europe growth and a reported target price. Verify DART revenue by region, channel mix, promotion/FX/tariff effects, margin normalization and valuation; target-price recirculation is not current evidence.' },
  { sym:'257720.KQ', name:'실리콘투', sector:'Consumer', index:'KOSDAQ' },
  { sym:'237880.KQ', name:'클리오', sector:'Consumer', index:'KOSDAQ' },
  { sym:'950130.KQ', name:'엑세스바이오', sector:'Healthcare', index:'KOSDAQ' },

  //  K-콘텐츠 (kcontent)
  { sym:'352820.KS', name:'하이브', sector:'Communication Services', index:'KOSPI' },
  { sym:'041510.KQ', name:'SM엔터테인먼트', sector:'Communication Services', index:'KOSDAQ' },
  { sym:'035900.KQ', name:'JYP엔터테인먼트', sector:'Communication Services', index:'KOSDAQ' },
  { sym:'122870.KQ', name:'YG엔터테인먼트', sector:'Communication Services', index:'KOSDAQ' },
  { sym:'253450.KQ', name:'스튜디오드래곤', sector:'Communication Services', index:'KOSDAQ' },
  { sym:'035760.KQ', name:'CJ ENM', sector:'Communication Services', index:'KOSDAQ' },
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
  { sym:'454910.KS', name:'두산로보틱스', sector:'Technology', index:'KOSPI' },
  { sym:'277810.KQ', name:'레인보우로보틱스', sector:'Technology', index:'KOSDAQ' },
  { sym:'315640.KQ', name:'딥노이드', sector:'Technology', index:'KOSDAQ' },
  { sym:'178320.KQ', name:'서진시스템', sector:'Technology', index:'KOSDAQ' },
  { sym:'090360.KQ', name:'로보스타', sector:'Technology', index:'KOSDAQ' },

  //  금융 (finance)
  { sym:'086790.KS', name:'하나금융지주', sector:'Financials', index:'KOSPI' },
  { sym:'032830.KS', name:'삼성생명', sector:'Financials', index:'KOSPI' },
  { sym:'000810.KS', name:'삼성화재', sector:'Financials', index:'KOSPI' },
  { sym:'323410.KS', name:'카카오뱅크', sector:'Financials', index:'KOSPI' },
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
  { sym:'294870.KS', name:'IPARK현대산업개발', sector:'Industrials', index:'KOSPI' }, // v57.81: KRX KIND 상장법인목록 회사명 (2026-10-15 확인, 구 HDC현대산업개발)
  { sym:'094480.KQ', name:'갤럭시아머니트리', sector:'Financials', index:'KOSDAQ' },

  // 유통/소비재 (retail)
  { sym:'004170.KS', name:'신세계', sector:'Consumer', index:'KOSPI' },
  { sym:'023530.KS', name:'롯데쇼핑', sector:'Consumer', index:'KOSPI' },
  { sym:'069960.KS', name:'현대백화점', sector:'Consumer', index:'KOSPI' },

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
  { sym:'036570.KS', name:'NC', sector:'Communication Services', index:'KOSPI' }, // v57.81: KRX KIND 상장법인목록 회사명 (2026-10-15 확인, 구 엔씨소프트)
  { sym:'030000.KS', name:'제일기획', sector:'Communication Services', index:'KOSPI' },
  { sym:'004020.KS', name:'현대제철', sector:'Materials', index:'KOSPI' },
  { sym:'011780.KS', name:'금호석유', sector:'Materials', index:'KOSPI' },
  { sym:'009830.KS', name:'한화솔루션', sector:'Technology', index:'KOSPI' },  { sym:'030520.KQ', name:'한컴', sector:'Technology', index:'KOSDAQ' }, // v57.81: KRX KIND 상장법인목록 회사명 (2026-10-15 확인, 구 한글과컴퓨터)
  { sym:'041020.KQ', name:'폴라리스오피스', sector:'Technology', index:'KOSDAQ' },
  { sym:'304100.KQ', name:'솔트룩스', sector:'Technology', index:'KOSDAQ' },
  { sym:'005940.KS', name:'NH투자증권', sector:'Financials', index:'KOSPI' },
  { sym:'039490.KS', name:'키움증권', sector:'Financials', index:'KOSPI' },
  { sym:'003490.KS', name:'대한항공', sector:'Industrials', index:'KOSPI' },
  { sym:'020560.KS', name:'아시아나항공', sector:'Industrials', index:'KOSPI' },
  { sym:'180640.KS', name:'한진칼', sector:'Industrials', index:'KOSPI' },
  { sym:'326030.KS', name:'SK바이오팜', sector:'Healthcare', index:'KOSPI' },
  { sym:'ALAB', name:'Astera Labs', sector:'Technology', index:'NASDAQ100' },
  { sym:'LSCC', name:'Lattice Semiconductor', sector:'Technology', index:'SP400' },
  // 2026-10-01 universe review (P1378): S&P 500 constituents missing from the curated list —
  // source: Wikipedia constituents table (Aug 2026 revision), liquidity confirmed by the next screener run.
  { sym:'AOS', name:'A. O. Smith', sector:'Industrials', index:'SP500' },
  { sym:'AMCR', name:'Amcor', sector:'Materials', index:'SP500' },
  { sym:'AEE', name:'Ameren', sector:'Utilities', index:'SP500' },
  { sym:'APA', name:'APA Corporation', sector:'Energy', index:'SP500' },
  { sym:'AVY', name:'Avery Dennison', sector:'Materials', index:'SP500' },
  { sym:'BALL', name:'Ball Corporation', sector:'Materials', index:'SP500' },
  { sym:'BBY', name:'Best Buy', sector:'Consumer', index:'SP500' },
  { sym:'BF-B', name:'Brown–Forman', sector:'Consumer Defensive', index:'SP500' },
  { sym:'CASY', name:'Casey\'s', sector:'Consumer Defensive', index:'SP500' },
  { sym:'CNP', name:'CenterPoint Energy', sector:'Utilities', index:'SP500' },
  { sym:'CF', name:'CF Industries', sector:'Materials', index:'SP500' },
  { sym:'CSGP', name:'CoStar Group', sector:'Real Estate', index:'SP500' },
  { sym:'CCI', name:'Crown Castle', sector:'Real Estate', index:'SP500' },
  { sym:'DRI', name:'Darden Restaurants', sector:'Consumer', index:'SP500' },
  { sym:'DTE', name:'DTE Energy', sector:'Utilities', index:'SP500' },
  { sym:'ECHO', name:'EchoStar', sector:'Communication Services', index:'SP500' },
  { sym:'EME', name:'Emcor', sector:'Industrials', index:'SP500' },
  { sym:'ERIE', name:'Erie Indemnity', sector:'Financials', index:'SP500' },
  { sym:'EL', name:'Estée Lauder Companies (The)', sector:'Consumer Defensive', index:'SP500' },
  { sym:'P', name:'Everpure', sector:'Technology', index:'SP500' },
  { sym:'EXE', name:'Expand Energy', sector:'Energy', index:'SP500' },
  { sym:'EXPE', name:'Expedia Group', sector:'Consumer', index:'SP500' },
  { sym:'FDXF', name:'FedEx Freight', sector:'Industrials', index:'SP500' },
  { sym:'FIS', name:'Fidelity National Information Services', sector:'Financials', index:'SP500' },
  { sym:'FLEX', name:'Flex Ltd.', sector:'Technology', index:'SP500' },
  { sym:'FTV', name:'Fortive', sector:'Industrials', index:'SP500' },
  { sym:'BEN', name:'Franklin Resources', sector:'Financials', index:'SP500' },
  { sym:'GPC', name:'Genuine Parts Company', sector:'Consumer', index:'SP500' },
  { sym:'HAS', name:'Hasbro', sector:'Consumer', index:'SP500' },
  { sym:'DOC', name:'Healthpeak Properties', sector:'Real Estate', index:'SP500' },
  { sym:'HONA', name:'Honeywell Aerospace', sector:'Industrials', index:'SP500' },
  { sym:'HST', name:'Host Hotels & Resorts', sector:'Real Estate', index:'SP500' },
  { sym:'HBAN', name:'Huntington Bancshares', sector:'Financials', index:'SP500' },
  { sym:'IR', name:'Ingersoll Rand', sector:'Industrials', index:'SP500' },
  { sym:'IBKR', name:'Interactive Brokers', sector:'Financials', index:'SP500' },
  { sym:'IP', name:'International Paper', sector:'Materials', index:'SP500' },
  { sym:'IVZ', name:'Invesco', sector:'Financials', index:'SP500' },
  { sym:'INVH', name:'Invitation Homes', sector:'Real Estate', index:'SP500' },
  { sym:'JKHY', name:'Jack Henry & Associates', sector:'Financials', index:'SP500' },
  { sym:'KMB', name:'Kimberly-Clark', sector:'Consumer Defensive', index:'SP500' },
  { sym:'LH', name:'Labcorp', sector:'Healthcare', index:'SP500' },
  { sym:'LVS', name:'Las Vegas Sands', sector:'Consumer', index:'SP500' },
  { sym:'LEN', name:'Lennar', sector:'Consumer', index:'SP500' },
  { sym:'L', name:'Loews Corporation', sector:'Financials', index:'SP500' },
  { sym:'LYB', name:'LyondellBasell', sector:'Materials', index:'SP500' },
  { sym:'MLM', name:'Martin Marietta Materials', sector:'Materials', index:'SP500' },
  { sym:'MKC', name:'McCormick & Company', sector:'Consumer Defensive', index:'SP500' },
  { sym:'MOS', name:'Mosaic Company (The)', sector:'Materials', index:'SP500' },
  { sym:'OMC', name:'Omnicom Group', sector:'Communication Services', index:'SP500' },
  { sym:'PNR', name:'Pentair', sector:'Industrials', index:'SP500' },
  { sym:'PCG', name:'PG&E Corporation', sector:'Utilities', index:'SP500' },
  { sym:'Q', name:'Qnity Electronics', sector:'Technology', index:'SP500' },
  { sym:'RJF', name:'Raymond James Financial', sector:'Financials', index:'SP500' },
  { sym:'ROL', name:'Rollins, Inc.', sector:'Industrials', index:'SP500' },
  { sym:'SJM', name:'J.M. Smucker Company (The)', sector:'Consumer Defensive', index:'SP500' },
  { sym:'SW', name:'Smurfit Westrock', sector:'Materials', index:'SP500' },
  { sym:'SYF', name:'Synchrony Financial', sector:'Financials', index:'SP500' },
  { sym:'TDY', name:'Teledyne Technologies', sector:'Technology', index:'SP500' },
  { sym:'TRMB', name:'Trimble Inc.', sector:'Technology', index:'SP500' },
  { sym:'TSN', name:'Tyson Foods', sector:'Consumer Defensive', index:'SP500' },
  { sym:'ULTA', name:'Ulta Beauty', sector:'Consumer', index:'SP500' },
  { sym:'UAL', name:'United Airlines Holdings', sector:'Industrials', index:'SP500' },
  { sym:'UHS', name:'Universal Health Services', sector:'Healthcare', index:'SP500' },
  { sym:'VEEV', name:'Veeva Systems', sector:'Healthcare', index:'SP500' },
  { sym:'VICI', name:'Vici Properties', sector:'Real Estate', index:'SP500' },
  { sym:'VMRK', name:'Vivmark Residential', sector:'Real Estate', index:'SP500' },
  { sym:'VMC', name:'Vulcan Materials Company', sector:'Materials', index:'SP500' },
  { sym:'WSM', name:'Williams-Sonoma, Inc.', sector:'Consumer', index:'SP500' },
  { sym:'XYL', name:'Xylem Inc.', sector:'Industrials', index:'SP500' },
  { sym:'ZBH', name:'Zimmer Biomet', sector:'Healthcare', index:'SP500' },
  // P1589 (2026-10-10 universe review): theme members without published returns, each verified on Yahoo chart;
  // KR suffix from the listing exchange (KSE=.KS, KOSDAQ=.KQ), never inferred.
  { sym:'ACLS', name:'Axcelis Technologies', sector:'Technology', index:'RUSSELL2000' },
  { sym:'ENTG', name:'Entegris', sector:'Technology', index:'SP400' },
  { sym:'UCTT', name:'Ultra Clean Holdings', sector:'Technology', index:'RUSSELL2000' },
  { sym:'MOD', name:'Modine Manufacturing', sector:'Industrials', index:'NYSE' },
  { sym:'WULF', name:'TeraWulf', sector:'Technology', index:'NASDAQ' },
  { sym:'CIFR', name:'Cipher Digital', sector:'Technology', index:'RUSSELL2000' },
  { sym:'S', name:'SentinelOne', sector:'Technology', index:'NYSE' },
  { sym:'DK', name:'Delek US Holdings', sector:'Energy', index:'RUSSELL2000' },
  { sym:'FTI', name:'TechnipFMC', sector:'Energy', index:'SP400' },
  { sym:'NOV', name:'NOV Inc', sector:'Energy', index:'SP400' },
  { sym:'WHD', name:'Cactus Inc', sector:'Energy', index:'RUSSELL2000' },
  { sym:'LEU', name:'Centrus Energy', sector:'Energy', index:'RUSSELL2000' },
  { sym:'BWXT', name:'BWX Technologies', sector:'Industrials', index:'SP400' },
  { sym:'NNE', name:'NANO Nuclear Energy', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'NXT', name:'Nextpower', sector:'Industrials', index:'SP400' },
  { sym:'ARRY', name:'Array Technologies', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'SHLS', name:'Shoals Technologies', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'FLNC', name:'Fluence Energy', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'PLUG', name:'Plug Power', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'FCEL', name:'FuelCell Energy', sector:'Industrials', index:'RUSSELL2000' },
  { sym:'VKTX', name:'Viking Therapeutics', sector:'Healthcare', index:'NASDAQ' },
  { sym:'KTOS', name:'Kratos Defense & Security', sector:'Industrials', index:'SP400' },
  { sym:'AVAV', name:'AeroVironment', sector:'Industrials', index:'SP400' },
  { sym:'SYM', name:'Symbotic', sector:'Industrials', index:'NASDAQ' },
  { sym:'MBLY', name:'Mobileye', sector:'Technology', index:'NASDAQ' },
  { sym:'LYFT', name:'Lyft', sector:'Technology', index:'NASDAQ' },
  { sym:'DKNG', name:'DraftKings', sector:'Consumer', index:'NASDAQ' },
  { sym:'FLUT', name:'Flutter Entertainment', sector:'Consumer', index:'NYSE' },
  { sym:'PENN', name:'PENN Entertainment', sector:'Consumer', index:'RUSSELL2000' },
  { sym:'KGC', name:'Kinross Gold', sector:'Materials', index:'NYSE' },
  { sym:'APLD', name:'Applied Digital', sector:'Technology', index:'NASDAQ' },
  { sym:'007660.KS', name:'이수페타시스', sector:'Technology', index:'KOSPI' },
  { sym:'095340.KQ', name:'ISC', sector:'Technology', index:'KOSDAQ' },
  { sym:'071970.KS', name:'HD현대마린엔진', sector:'Industrials', index:'KOSPI' },
  { sym:'001440.KS', name:'대한전선', sector:'Industrials', index:'KOSPI' },
  { sym:'062040.KS', name:'산일전기', sector:'Industrials', index:'KOSPI' },
  { sym:'083650.KQ', name:'비에이치아이', sector:'Industrials', index:'KOSDAQ' },
  { sym:'018290.KQ', name:'브이티', sector:'Consumer Defensive', index:'KOSDAQ' },
  { sym:'214150.KQ', name:'클래시스', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'439090.KQ', name:'마녀공장', sector:'Consumer Defensive', index:'KOSDAQ' },
  { sym:'108490.KQ', name:'로보티즈', sector:'Technology', index:'KOSDAQ' },
  { sym:'388720.KQ', name:'유일로보틱스', sector:'Technology', index:'KOSDAQ' },
  { sym:'090710.KQ', name:'휴림로봇', sector:'Technology', index:'KOSDAQ' },
  { sym:'041190.KQ', name:'우리기술투자', sector:'Financials', index:'KOSDAQ' },
  { sym:'047080.KQ', name:'한빛소프트', sector:'Technology', index:'KOSDAQ' },
  { sym:'006360.KS', name:'GS건설', sector:'Industrials', index:'KOSPI' },
  { sym:'375500.KS', name:'DL이앤씨', sector:'Industrials', index:'KOSPI' },
  { sym:'028050.KS', name:'삼성E&A', sector:'Industrials', index:'KOSPI' },
  { sym:'139480.KS', name:'이마트', sector:'Consumer', index:'KOSPI' },
  { sym:'007070.KS', name:'GS리테일', sector:'Consumer', index:'KOSPI' },
  { sym:'282330.KS', name:'BGF리테일', sector:'Consumer', index:'KOSPI' },
  { sym:'000120.KS', name:'CJ대한통운', sector:'Industrials', index:'KOSPI' },
  { sym:'328130.KQ', name:'루닛', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'338220.KQ', name:'뷰노', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'322510.KQ', name:'제이엘케이', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'049950.KQ', name:'미래컴퍼니', sector:'Technology', index:'KOSDAQ' },
  { sym:'145720.KS', name:'덴티움', sector:'Healthcare', index:'KOSPI' },
  { sym:'018670.KS', name:'SK가스', sector:'Energy', index:'KOSPI' },
  { sym:'050890.KQ', name:'쏠리드', sector:'Technology', index:'KOSDAQ' },
  { sym:'032500.KQ', name:'케이엠더블유', sector:'Technology', index:'KOSDAQ' },
  { sym:'218410.KQ', name:'RFHIC', sector:'Technology', index:'KOSDAQ' },
  { sym:'138080.KQ', name:'오이솔루션', sector:'Technology', index:'KOSDAQ' },
  { sym:'112610.KS', name:'씨에스윈드', sector:'Industrials', index:'KOSPI' },
  { sym:'336260.KS', name:'두산퓨얼셀', sector:'Industrials', index:'KOSPI' },
  { sym:'017390.KS', name:'서울도시가스', sector:'Utilities', index:'KOSPI' }, // v57.81: KRX KIND 상장법인목록 회사명 (2026-10-15 확인, 구 서울가스)
  { sym:'003830.KS', name:'대한화섬', sector:'Materials', index:'KOSPI' },
  { sym:'007310.KS', name:'오뚜기', sector:'Consumer Defensive', index:'KOSPI' },
  // 2026-10-13 universe review (V01·V05·V06·V10·V14·V18, worker D4): members taken only from the official
  // holdings files — IVV/IJH/IWM holdings 2026-10-09, Nasdaq-100 list 2026-10-12, KODEX 200·KOSDAQ150 PDF
  // 2026-10-08. US names from the Nasdaq Trader listed-symbol directory (2026-10-13); US sector = the holdings
  // file's GICS sector; KR sector from the KRX KIND listed-company industry/products. index: IVV=SP500,
  // Nasdaq-100=NASDAQ100, IJH=SP400, IWM=RUSSELL2000; otherwise the listing exchange.
  { sym:'SPCX', name:'SpaceX (Space Exploration Technologies)', sector:'Technology', index:'NASDAQ100' },
  { sym:'TWLO', name:'Twilio', sector:'Technology', index:'SP500' },
  { sym:'VYLR', name:'Vylor', sector:'Consumer Defensive', index:'SP500' },
  { sym:'OKTA', name:'Okta', sector:'Technology', index:'SP400' },
  { sym:'MTSI', name:'MACOM Technology Solutions Holdings', sector:'Technology', index:'SP400' },
  { sym:'SNX', name:'TD SYNNEX', sector:'Technology', index:'SP400' },
  { sym:'NTNX', name:'Nutanix', sector:'Technology', index:'SP400' },
  { sym:'DT', name:'Dynatrace', sector:'Technology', index:'SP400' },
  { sym:'MKSI', name:'MKS', sector:'Technology', index:'SP400' },
  { sym:'SMTC', name:'Semtech', sector:'Technology', index:'SP400' },
  { sym:'SITM', name:'SiTime', sector:'Technology', index:'SP400' },
  { sym:'FORM', name:'FormFactor', sector:'Technology', index:'SP400' },
  { sym:'PEGA', name:'Pegasystems', sector:'Technology', index:'SP400' },
  { sym:'ATI', name:'ATI', sector:'Industrials', index:'SP400' },
  { sym:'XPO', name:'XPO', sector:'Industrials', index:'SP400' },
  { sym:'WWD', name:'Woodward', sector:'Industrials', index:'SP400' },
  { sym:'CRS', name:'Carpenter Technology', sector:'Industrials', index:'SP400' },
  { sym:'CW', name:'Curtiss-Wright', sector:'Industrials', index:'SP400' },
  { sym:'ITT', name:'ITT', sector:'Industrials', index:'SP400' },
  { sym:'WCC', name:'WESCO International', sector:'Industrials', index:'SP400' },
  { sym:'RBC', name:'RBC Bearings', sector:'Industrials', index:'SP400' },
  { sym:'UTHR', name:'United Therapeutics', sector:'Healthcare', index:'SP400' },
  { sym:'THC', name:'Tenet Healthcare', sector:'Healthcare', index:'SP400' },
  { sym:'ROIV', name:'Roivant Sciences', sector:'Healthcare', index:'SP400' },
  { sym:'EXEL', name:'Exelixis', sector:'Healthcare', index:'SP400' },
  { sym:'NBIX', name:'Neurocrine Biosciences', sector:'Healthcare', index:'SP400' },
  { sym:'JAZZ', name:'Jazz Pharmaceuticals', sector:'Healthcare', index:'SP400' },
  { sym:'MEDP', name:'Medpace Holdings', sector:'Healthcare', index:'SP400' },
  { sym:'PEN', name:'Penumbra', sector:'Healthcare', index:'SP400' },
  { sym:'GMED', name:'Globus Medical', sector:'Healthcare', index:'SP400' },
  { sym:'USFD', name:'US Foods Holding', sector:'Consumer Defensive', index:'SP400' },
  { sym:'PFGC', name:'Performance Food Group', sector:'Consumer Defensive', index:'SP400' },
  { sym:'BJ', name:'BJ\'s Wholesale Club Holdings', sector:'Consumer Defensive', index:'SP400' },
  { sym:'COKE', name:'Coca-Cola Consolidated', sector:'Consumer Defensive', index:'SP400' },
  { sym:'DAR', name:'Darling Ingredients', sector:'Consumer Defensive', index:'SP400' },
  { sym:'CART', name:'Maplebear', sector:'Consumer Defensive', index:'SP400' },
  { sym:'ELF', name:'e.l.f. Beauty', sector:'Consumer Defensive', index:'SP400' },
  { sym:'SFM', name:'Sprouts Farmers Market', sector:'Consumer Defensive', index:'SP400' },
  { sym:'RGLD', name:'Royal Gold', sector:'Materials', index:'SP400' },
  { sym:'CDE', name:'Coeur Mining', sector:'Materials', index:'SP400' },
  { sym:'RPM', name:'RPM International', sector:'Materials', index:'SP400' },
  { sym:'CCK', name:'Crown Holdings', sector:'Materials', index:'SP400' },
  { sym:'HL', name:'Hecla Mining', sector:'Materials', index:'SP400' },
  { sym:'SOLS', name:'Solstice Advanced Materials', sector:'Materials', index:'SP400' },
  { sym:'ATR', name:'AptarGroup', sector:'Materials', index:'SP400' },
  { sym:'CLF', name:'Cleveland-Cliffs', sector:'Materials', index:'SP400' },
  { sym:'PR', name:'Permian Resources', sector:'Energy', index:'SP400' },
  { sym:'OVV', name:'Ovintiv', sector:'Energy', index:'SP400' },
  { sym:'DTM', name:'DT Midstream', sector:'Energy', index:'SP400' },
  { sym:'AR', name:'Antero Resources', sector:'Energy', index:'SP400' },
  { sym:'RRC', name:'Range Resources', sector:'Energy', index:'SP400' },
  { sym:'VNOM', name:'Viper Energy', sector:'Energy', index:'SP400' },
  { sym:'CHRD', name:'Chord Energy', sector:'Energy', index:'SP400' },
  { sym:'BURL', name:'Burlington Stores', sector:'Consumer', index:'SP400' },
  { sym:'SN', name:'SharkNinja', sector:'Consumer', index:'SP400' },
  { sym:'ARMK', name:'Aramark', sector:'Consumer', index:'SP400' },
  { sym:'SGI', name:'Somnigroup International', sector:'Consumer', index:'SP400' },
  { sym:'TOL', name:'Toll Brothers', sector:'Consumer', index:'SP400' },
  { sym:'FIVE', name:'Five Below', sector:'Consumer', index:'SP400' },
  { sym:'TXRH', name:'Texas Roadhouse', sector:'Consumer', index:'SP400' },
  { sym:'SCI', name:'Service Corporation International', sector:'Consumer', index:'SP400' },
  { sym:'EWBC', name:'East West Bancorp', sector:'Financials', index:'SP400' },
  { sym:'RGA', name:'Reinsurance Group of America', sector:'Financials', index:'SP400' },
  { sym:'PNFP', name:'Pinnacle Financial Partners', sector:'Financials', index:'SP400' },
  { sym:'NLY', name:'Annaly Capital Management', sector:'Financials', index:'SP400' },
  { sym:'RNR', name:'RenaissanceRe Holdings', sector:'Financials', index:'SP400' },
  { sym:'EQH', name:'Equitable Holdings', sector:'Financials', index:'SP400' },
  { sym:'UNM', name:'Unum Group', sector:'Financials', index:'SP400' },
  { sym:'FHN', name:'First Horizon', sector:'Financials', index:'SP400' },
  { sym:'WPC', name:'W. P. Carey', sector:'Real Estate', index:'SP400' },
  { sym:'SUI', name:'Sun Communities', sector:'Real Estate', index:'SP400' },
  { sym:'JLL', name:'Jones Lang LaSalle', sector:'Real Estate', index:'SP400' },
  { sym:'OHI', name:'Omega Healthcare Investors', sector:'Real Estate', index:'SP400' },
  { sym:'LAMR', name:'Lamar Advertising', sector:'Real Estate', index:'SP400' },
  { sym:'ELS', name:'Equity Lifestyle Properties', sector:'Real Estate', index:'SP400' },
  { sym:'GLPI', name:'Gaming and Leisure Properties', sector:'Real Estate', index:'SP400' },
  { sym:'AHR', name:'American Healthcare REIT', sector:'Real Estate', index:'SP400' },
  { sym:'WTRG', name:'Essential Utilities', sector:'Utilities', index:'SP400' },
  { sym:'OGE', name:'OGE Energy', sector:'Utilities', index:'SP400' },
  { sym:'UGI', name:'UGI', sector:'Utilities', index:'SP400' },
  { sym:'IDA', name:'IDACORP', sector:'Utilities', index:'SP400' },
  { sym:'NFG', name:'National Fuel Gas', sector:'Utilities', index:'SP400' },
  { sym:'SWX', name:'Southwest Gas Holdings', sector:'Utilities', index:'SP400' },
  { sym:'TXNM', name:'TXNM Energy', sector:'Utilities', index:'SP400' },
  { sym:'BKH', name:'Black Hills', sector:'Utilities', index:'SP400' },
  { sym:'NYT', name:'New York Times', sector:'Communication Services', index:'SP400' },
  { sym:'SIRI', name:'SiriusXM Holdings', sector:'Communication Services', index:'SP400' },
  { sym:'NXST', name:'Nexstar Media Group', sector:'Communication Services', index:'SP400' },
  { sym:'WMG', name:'Warner Music Group', sector:'Communication Services', index:'SP400' },
  { sym:'COHU', name:'Cohu', sector:'Technology', index:'RUSSELL2000' },
  { sym:'KLIC', name:'Kulicke and Soffa Industries', sector:'Technology', index:'RUSSELL2000' },
  { sym:'APPN', name:'Appian', sector:'Technology', index:'RUSSELL2000' },
  { sym:'PRCT', name:'PROCEPT BioRobotics', sector:'Healthcare', index:'RUSSELL2000' },
  // v59.44 (owner 2026-10-30, "AI/반도체/DC 관련 종목들 대폭 확장"): AI-chain names already in the extended universe,
  // promoted so the 테마 groups and the AI-chain block on 오늘 read their closes. Names and exchanges are the Nasdaq Trader
  // listing rows of the US listings artifact (each with its SEC CIK); index is the listing exchange.
  { sym:'RMBS', name:'Rambus', sector:'Technology', index:'NASDAQ' },
  { sym:'AEIS', name:'Advanced Energy Industries', sector:'Technology', index:'NASDAQ' },
  { sym:'ICHR', name:'Ichor Holdings', sector:'Technology', index:'NASDAQ' },
  { sym:'CAMT', name:'Camtek', sector:'Technology', index:'NASDAQ' },
  { sym:'NVMI', name:'Nova', sector:'Technology', index:'NASDAQ' },
  { sym:'ACMR', name:'ACM Research', sector:'Technology', index:'NASDAQ' },
  { sym:'TSEM', name:'Tower Semiconductor', sector:'Technology', index:'NASDAQ' },
  { sym:'AXTI', name:'AXT', sector:'Technology', index:'NASDAQ' },
  { sym:'CEVA', name:'CEVA', sector:'Technology', index:'NASDAQ' },
  { sym:'AMBA', name:'Ambarella', sector:'Technology', index:'NASDAQ' },
  { sym:'VSH', name:'Vishay Intertechnology', sector:'Technology', index:'NYSE' },
  { sym:'SANM', name:'Sanmina', sector:'Technology', index:'NASDAQ' },
  { sym:'STRL', name:'Sterling Infrastructure', sector:'Industrials', index:'NASDAQ' },
  { sym:'HUT', name:'Hut 8', sector:'Technology', index:'NASDAQ' },
  { sym:'BTDR', name:'Bitdeer Technologies', sector:'Technology', index:'NASDAQ' },
  { sym:'GLXY', name:'Galaxy Digital', sector:'Financials', index:'NASDAQ' },
  // KOSDAQ150 weight top 40 not yet in the universe (KODEX KOSDAQ150 PDF 2026-10-08), then KOSPI200 top 20
  // (KODEX 200 PDF 2026-10-08). Names are the PDF names; 131970.KQ is 두산테스나, the real 테크윙 is 089030.KQ.
  { sym:'222800.KQ', name:'심텍', sector:'Technology', index:'KOSDAQ' },
  { sym:'000250.KQ', name:'삼천당제약', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'087010.KQ', name:'펩트론', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'319660.KQ', name:'피에스케이', sector:'Technology', index:'KOSDAQ' },
  { sym:'080220.KQ', name:'제주반도체', sector:'Technology', index:'KOSDAQ' },
  { sym:'067310.KQ', name:'하나마이크론', sector:'Technology', index:'KOSDAQ' },
  { sym:'084370.KQ', name:'유진테크', sector:'Technology', index:'KOSDAQ' },
  { sym:'298380.KQ', name:'에이비엘바이오', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'214450.KQ', name:'파마리서치', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'226950.KQ', name:'올릭스', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'032820.KQ', name:'우리기술', sector:'Industrials', index:'KOSDAQ' },
  { sym:'095610.KQ', name:'테스', sector:'Technology', index:'KOSDAQ' },
  { sym:'098460.KQ', name:'고영', sector:'Technology', index:'KOSDAQ' },
  { sym:'131290.KQ', name:'티에스이', sector:'Technology', index:'KOSDAQ' },
  { sym:'347850.KQ', name:'디앤디파마텍', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'064760.KQ', name:'티씨케이', sector:'Technology', index:'KOSDAQ' },
  { sym:'310210.KQ', name:'보로노이', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'089970.KQ', name:'브이엠', sector:'Technology', index:'KOSDAQ' },
  { sym:'031980.KQ', name:'피에스케이홀딩스', sector:'Technology', index:'KOSDAQ' },
  { sym:'089030.KQ', name:'테크윙', sector:'Technology', index:'KOSDAQ' },
  { sym:'140860.KQ', name:'파크시스템스', sector:'Technology', index:'KOSDAQ' },
  { sym:'058610.KQ', name:'에스피지', sector:'Industrials', index:'KOSDAQ' },
  { sym:'039200.KQ', name:'오스코텍', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'323280.KQ', name:'태성', sector:'Technology', index:'KOSDAQ' },
  { sym:'290650.KQ', name:'엘앤씨바이오', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'007390.KQ', name:'네이처셀', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'078600.KQ', name:'대주전자재료', sector:'Technology', index:'KOSDAQ' },
  { sym:'237690.KQ', name:'에스티팜', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'096530.KQ', name:'씨젠', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'030530.KQ', name:'원익홀딩스', sector:'Materials', index:'KOSDAQ' },
  { sym:'319400.KQ', name:'현대무벡스', sector:'Industrials', index:'KOSDAQ' },
  { sym:'043260.KQ', name:'성호전자', sector:'Technology', index:'KOSDAQ' },
  { sym:'183300.KQ', name:'코미코', sector:'Technology', index:'KOSDAQ' },
  { sym:'101490.KQ', name:'에스앤에스텍', sector:'Technology', index:'KOSDAQ' },
  { sym:'445680.KQ', name:'큐리옥스바이오시스템즈', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'036540.KQ', name:'SFA반도체', sector:'Technology', index:'KOSDAQ' },
  { sym:'068760.KQ', name:'셀트리온제약', sector:'Healthcare', index:'KOSDAQ' },
  { sym:'082920.KQ', name:'비츠로셀', sector:'Technology', index:'KOSDAQ' },
  { sym:'241710.KQ', name:'코스메카코리아', sector:'Consumer', index:'KOSDAQ' },
  { sym:'161580.KQ', name:'필옵틱스', sector:'Technology', index:'KOSDAQ' },
  { sym:'033780.KS', name:'KT&G', sector:'Consumer Defensive', index:'KOSPI' },
  { sym:'000150.KS', name:'두산', sector:'Technology', index:'KOSPI' },
  { sym:'011070.KS', name:'LG이노텍', sector:'Technology', index:'KOSPI' },
  { sym:'010130.KS', name:'고려아연', sector:'Materials', index:'KOSPI' },
  { sym:'005830.KS', name:'DB손해보험', sector:'Financials', index:'KOSPI' },
  { sym:'071050.KS', name:'한국금융지주', sector:'Financials', index:'KOSPI' },
  { sym:'021240.KS', name:'코웨이', sector:'Consumer', index:'KOSPI' },
  { sym:'175330.KS', name:'JB금융지주', sector:'Financials', index:'KOSPI' },
  { sym:'161390.KS', name:'한국타이어앤테크놀로지', sector:'Consumer', index:'KOSPI' },
  { sym:'443060.KS', name:'HD현대마린솔루션', sector:'Industrials', index:'KOSPI' },
  { sym:'138930.KS', name:'BNK금융지주', sector:'Financials', index:'KOSPI' },
  { sym:'064400.KS', name:'LG씨엔에스', sector:'Technology', index:'KOSPI' },
  { sym:'267270.KS', name:'HD건설기계', sector:'Industrials', index:'KOSPI' },
  { sym:'010060.KS', name:'OCI홀딩스', sector:'Materials', index:'KOSPI' },
  { sym:'241560.KS', name:'두산밥캣', sector:'Industrials', index:'KOSPI' },
  { sym:'011790.KS', name:'SKC', sector:'Materials', index:'KOSPI' },
  { sym:'001450.KS', name:'현대해상', sector:'Financials', index:'KOSPI' },
  { sym:'047050.KS', name:'포스코인터내셔널', sector:'Industrials', index:'KOSPI' },
  { sym:'034220.KS', name:'LG디스플레이', sector:'Technology', index:'KOSPI' },
  { sym:'014680.KS', name:'한솔케미칼', sector:'Materials', index:'KOSPI' },
];

// ARX-16 compatibility boundary: quantitative and identity consumers should
// read the canonical native screener state when it is ready. The legacy DB is
// a fallback only, and native rows may be enriched with fields that the
// published artifact does not yet carry (for example curated memo metadata).
// E2/S-C (P1241): row resolution now has one owner — `src/data/screener-row-policy.js`, bridged as
// `AIO_ARCH.resolveScreenerRows`. Owner decision: a published-but-empty native state is authoritative
// and the bundled DB is only a pre-publication compatibility read, declared by this call site's intent.
// The optional `root` is kept so the shadow harness can execute this path on synthetic input.
function _aioGetCanonicalScreenerRows(root) {
  var w = root || window;
  try {
    var arch = w.AIO_ARCH;
    if (arch && typeof arch.resolveScreenerRows === 'function') {
      return arch.resolveScreenerRows('bundled-compat');
    }
  } catch (_) {}
  // Pre-native-boot bundle (no AIO_ARCH at all): no canonical reader exists, so the bundled DB is the
  // only available row set. This is the same declared policy, not a second chain.
  var rows = (w.AIO_ARCH && typeof w.AIO_ARCH.getScreenerRows === 'function') ? w.AIO_ARCH.getScreenerRows() : null;
  if (Array.isArray(rows) && rows.length) return rows;
  return Array.isArray(w.SCREENER_DB) ? w.SCREENER_DB : [];
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
      return it && (tag ? Array.isArray(it.tags) && it.tags[0] === tag : Array.isArray(it.tickers) && it.tickers.indexOf(ticker) >= 0); // v57.81: a category's sample is a post whose primary tag it is (no reuse)
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

function _aioTelegramTextNames(text, sym, name) { var code = sym.replace(/\.(KS|KQ)$/, ''), bare = String(name || '').replace(/[\s,]*(Inc\.?|Corp\.?|Corporation|Co\.?|Ltd\.?|Holdings|plc|주식회사|\(주\))\s*$/i, '').trim(); var esc = function(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  if (new RegExp('(^|[^A-Za-z0-9])' + esc(code) + '($|[^A-Za-z0-9])').test(text)) return true;
  if (bare.length < 2) return false;
  // v59.42: an English name is a whole word ('ARM' is not in 'alarm'); a Korean name stays a substring (조사 attach).
  return /^[\x20-\x7e]+$/.test(bare) ? new RegExp('(^|[^a-z0-9])' + esc(bare.toLowerCase()) + '($|[^a-z0-9])').test(text.toLowerCase()) : text.toLowerCase().indexOf(bare.toLowerCase()) >= 0; }
function _aioBuildTelegramMemoOverlay(raw, merged) {
  var items = [];
  // current24h → broadItems → topItems 순서 (P598: 서버는 더 이상 미압축 raw.items를 보내지 않는다).
  if (raw && Array.isArray(raw.current24hItems) && raw.current24hItems.length) items = raw.current24hItems;
  else if (raw && Array.isArray(raw.broadItems) && raw.broadItems.length) items = raw.broadItems;
  else if (raw && Array.isArray(raw.topItems) && raw.topItems.length) items = raw.topItems;
  var date = _aioTelegramDigestMemoDate(raw, merged);
  var byTicker = {};
  // v57.81: a post reaches a memo only when its shown text names the ticker or the company (a premarket list tagged 000660.KS was the SK하이닉스 memo).
  var names = {}; (typeof SCREENER_DB !== 'undefined' && Array.isArray(SCREENER_DB) ? SCREENER_DB : []).forEach(function(r) { if (r && r.sym) names[String(r.sym).toUpperCase()] = String(r.name || ''); });
  items.forEach(function(item) {
    if (!item || !Array.isArray(item.tickers) || !item.tickers.length) return;
    var text = _aioCleanTelegramMemoText(item.text || item.title || item.summary || '');
    if (!text) return;
    var score = Number(item.score || 0) || 0;
    item.tickers.forEach(function(t) {
      var sym = String(t || '').toUpperCase().trim();
      if (!sym || !_aioTelegramTextNames(text, sym, names[sym])) return;
      if (!byTicker[sym]) byTicker[sym] = [];
      if (byTicker[sym].length < 3) byTicker[sym].push({ text:text, score:score, channel:item.channel || '', url:item.url || '' });
    });
  });
  var overlays = {};
  Object.keys(byTicker).forEach(function(sym) {
    var rows = byTicker[sym].sort(function(a, b) { return (b.score || 0) - (a.score || 0); }).slice(0, 2);
    if (!rows.length) return;
    var body = rows.map(function(r) { return r.text; }).join(' / ');
    var suffix = rows.length > 1 ? ', auto ' + rows.length + ' posts' : ', auto';
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
    window.AIO_TELEGRAM_CURRENT_ITEMS = merged.rawCurrent24hItems || []; window.AIO_TELEGRAM_SIGNALS = raw && Array.isArray(raw.signals) ? raw.signals : null; // v58.71: screener conditions
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
    var url = './public-data/telegram-digest.json'; // v57.61 (perf): no-cache revalidation, no hourly buster
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
  'kr-macro':    ['한국 거시 소식',            4,  true,  'score', false],
  'kr-technical':['한국 차트 소식',              3,  false, 'score', true ],
};
// 카테고리 → 한국어 라벨 + CSS 클래스
var _TG_CAT_MAP = {
  'kr-market':  { label:'한국장',     cls:'tg-cat-kr'     },
  'semi':       { label:'반도체',     cls:'tg-cat-semi'   },
  'credit':     { label:'신용·자금',  cls:'tg-cat-macro'  },
  'macro':      { label:'거시',     cls:'tg-cat-macro'  },
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
  // P1503: the channel's own handle plus its coverage, so a reader can find and judge the original.
  aetherjapanresearch: '@aetherjapanresearch, 일본·아시아 반도체',
  insidertracking:     '@insidertracking, 미국 속보',
  bornlupin:           '@bornlupin, 한국 반도체·증권사 자료',
  HANAchina:           '@HANAchina, 중국·신흥국',
};
var _TG_KR_NAME = {
  '005930.KS':'삼성전자','000660.KS':'SK하이닉스','009150.KS':'삼성전기',
  '6981.T':'무라타','285A.T':'키옥시아','000270.KS':'기아','005380.KS':'현대차',
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

  // 1) P1729 (coordinator 2026-10-13): the word-count 긍정/부정/중립 '어조' tone was a residue of the retired
  // sentiment badges (P1391/T17) — a grade with no validated basis. It is no longer computed or shown.

  // 2) 1차 카테고리
  // P1503: the card label is the most specific tag, not the first matched — a revenue note matched credit,
  // macro and earnings in that order and read as 자금조달.
  // v58.75 (persona review): a war statement read as 한국장 and a market wrap as 실적 — geo and macro now rank ahead of
  // earnings, health care and Korea; a producer that marks its lead-sentence tags (`lead`) is read from those first, and a
  // negated topic ("실적 제외") never labels the card.
  var _tgTags = it.tags || ['market-note'];
  var _tgPool = typeof it.lead === 'number' && it.lead > 0 ? _tgTags.slice(0, it.lead) : _tgTags;
  if (_tgPool.length > 1 && /(?:실적|어닝)\s*(?:발표\s*)?(?:은|을|를)?\s*(?:제외|빼고|무관)|excluding earnings/i.test(raw)) _tgPool = _tgPool.filter(function(t) { return t !== 'earnings'; });
  var primaryTag = ['insider','geo','macro','earnings','semi','optical','power','healthcare','ai-policy','crypto','credit','japan','kr-market','flows','equity','market-note'].find(function(t) { return _tgPool.indexOf(t) >= 0; }) || _tgPool[0] || 'market-note';
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

  // 6) 티커 방향 (base class 항상 포함) — only a signed number printed next to the ticker colours it (P1729: no
  // fallback to the retired word-count tone).
  var tickerHtml = (it.tickers || []).slice(0, 4).map(function(tk) {
    var tkRe = new RegExp(tk.replace(/\./g, '\\.') + '[^가-힣]{0,20}([+\\-▲▼]\\d)', 'i');
    var m = raw.match(tkRe);
    var dirCls = '';
    if (m) dirCls = /[+▲]/.test(m[1]) ? ' tg-ticker-bull' : ' tg-ticker-bear';
    var label = _TG_KR_NAME[tk] || escHtml(tk);
    return '<span class="tg-ticker' + dirCls + '">' + label + '</span>';
  }).join('');

  return { cat: cat, hlHeadline: hlHeadline, body: body, tickerHtml: tickerHtml };
}

function _aioTelegramStandalone(text) {
  var t = String(text || '').replace(/https?:\/\/\S+/g, '').replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '').replace(/\s+/g, ' ').trim();
  if (t.length < 20) return false;
  if (/^(받\)|위\s|위에\s|해당\s|이\s?사진|사진\s|↑|☝|\^)/.test(t)) return false;
  if (/사진|이미지|첨부/.test(t) && t.length < 40) return false;
  if (!/[가-힣]/.test(t) && t.length < 40) return false;
  return true;
}
window._aioTelegramStandalone = _aioTelegramStandalone;

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
      // P1503: say what the reader is looking at — public channels, a completed 24-hour window, a link per post.
      var _tgChannels = (window.AIO_TELEGRAM_WEEKLY_DIGEST && Array.isArray(window.AIO_TELEGRAM_WEEKLY_DIGEST.channels) && window.AIO_TELEGRAM_WEEKLY_DIGEST.channels.length) || 4;
      var note = n.status === 'success' ? '텔레그램 공개 채널 ' + _tgChannels + '곳, 지난 24시간, 글마다 원문 링크' : n.status === 'partial' ? '조건에 맞는 글 일부만 표시, 참고용' : '지난 24시간 안에 표시할 글 없음';
      return '<div class="tg-source-state ' + cls + '" data-external-source="telegram:' + escHtml(pageId) + '" data-state="' + n.status + '" title="' + escHtml(note) + '">' +
        '<span class="tg-source-state-dot"></span>' + escHtml(n.label) + ', ' + escHtml(note) + '</div>';
    };
    if (!items.length || !tags.length) return statusMarkup('unavailable', 0, maxItems);

    // 태그 필터 + Codex review 2026-10-05: posts that only make sense beside the channel's previous message
    // (a photo caption, "위 …", "해당 …", a two-letter reply like "BE") carry no information on their own.
    var filtered = items.filter(function(it) {
      return (it.tags || []).some(function(t) { return tags.indexOf(t) >= 0; }) && _aioTelegramStandalone(it.text || it.summary || '');
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
    var matchedCount = filtered.length; // v59.42: the header says how many matched, not only how many fit
    filtered = filtered.slice(0, maxItems);
    if (!filtered.length) return statusMarkup('unavailable', 0, maxItems);

    // 카드 사전 처리 (P1729: no tone tally)
    var cards = filtered.map(function(it) {
      return { it: it, info: _aioProcessTelegramItem(it) };
    });

    // 헤더
    var latestDate = (filtered[0].localDateKst || '').slice(5, 10);
    var currentWindow = window.AIO_TELEGRAM_WEEKLY_DIGEST && window.AIO_TELEGRAM_WEEKLY_DIGEST.current24hWindow;
    var windowLabel = currentWindow && currentWindow.label
      ? currentWindow.label
      : (window.AIO_TELEGRAM_WEEKLY_DIGEST && window.AIO_TELEGRAM_WEEKLY_DIGEST.window) || '지난 24시간';
    var feedCls = 'tg-live-feed' + (compact ? ' tg-compact' : '');
    var feedState = filtered.length < maxItems ? 'partial' : 'success';
    var html = '<div class="' + feedCls + '">' + statusMarkup(feedState, filtered.length, maxItems);

    html += '<div class="tg-live-feed-hd">'
          + '<span class="tg-live-dot"></span>'
          + '<span class="tg-live-hd-label">' + feedLabel + '</span>'
          + '<span class="tg-live-hd-ts" title="' + escHtml(windowLabel) + '">' + escHtml(latestDate) + ', ' + filtered.length + '건 표시' + (matchedCount > filtered.length ? ', 해당 ' + matchedCount + '건' : '') + ', 수집 당시 24시간 자료</span>'
          + '</div>';

    // 카드 렌더
    cards.forEach(function(item, cardIdx) {
      var it = item.it, info = item.info;
      var src = _TG_CH_SRC[it.channel] || (it.channel || '');
      var date = (it.localDateKst || '').slice(5, 10);

      html += '<div class="tg-card">'
            + '<a href="' + escHtml(escUrl(it.url || '#')) + '" target="_blank" rel="noopener" class="tg-card-inner">'
            + '<div class="tg-card-hd">'
            + '<span class="tg-cat ' + info.cat.cls + '">' + escHtml(info.cat.label) + '</span>'
            + '<span class="tg-card-src">' + escHtml(src) + ', ' + escHtml(date) + '</span>'
            + '</div>'
            + '<div class="tg-card-headline">' + info.hlHeadline + '</div>'
            + (showBody && info.body && (pageId !== 'market-news' || cardIdx < 3) ? '<div class="tg-card-body">' + info.body + '</div>' : '') // v57.54: the full feed opens 3 bodies, then headlines
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
    if (!document.body.classList.contains('aio-dev-mode') && pageId !== 'briefing' && pageId !== 'market-news') {
      el.replaceChildren();
      return;
    }
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

var _scrSortCol = 'mcap';
var _scrSortAsc = false;
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
  '네오클라우드': ['CRWV','NBIS','IREN','CIFR','WULF','CLSK'],
  'neocloud': ['CRWV','NBIS','IREN','CIFR','WULF','CLSK'],
  '상대강도': ['SPY','QQQ','IWM','DIA','SMH','XBI','ARKG','CRWD','PANW','RBRK','VLO','MPC','PSX'],
  'relative strength': ['SPY','QQQ','IWM','DIA','SMH','XBI','ARKG','CRWD','PANW','RBRK','VLO','MPC','PSX'],
  '지수확인': ['SPY','QQQ','IWM','DIA','RSP','SMH','SOXX'],
  '시장확인': ['SPY','QQQ','IWM','DIA','RSP','SMH','SOXX'],
  'earnings risk': ['NVDA','CRWD','PANW','RBRK','SMH','XBI','ARKG'],
  '실적리스크': ['NVDA','CRWD','PANW','RBRK','SMH','XBI','ARKG'],
  'billable it': ['CRWV','NBIS','IREN','CIFR','WULF','CLSK','EQIX','DLR'],
  'billableit': ['CRWV','NBIS','IREN','CIFR','WULF','CLSK','EQIX','DLR'],
  'owner fcf': ['CRWV','NBIS','IREN','CIFR','WULF','CLSK'],
  'replacement capex': ['CRWV','NBIS','IREN','CIFR','WULF','CLSK','VRT','ETN'],
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
  '게임': ['TTWO','RBLX','NTES'],
  'gaming': ['TTWO','RBLX','NTES'],
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
  '게임확장': ['TTWO','RBLX','NTES','SONY','MTCH'],
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
  '코스닥': ['042700.KS','196170.KQ','247540.KQ','044820.KS','192820.KS','454910.KS','277810.KQ','278470.KS','323410.KS','033100.KQ'],
  'kospi': ['005930.KS','000660.KS','373220.KS','207940.KS','005380.KS','012450.KS','000270.KS','035420.KS','068270.KS','105560.KS'],
  'kosdaq': ['042700.KS','196170.KQ','247540.KQ','044820.KS','192820.KS','454910.KS','277810.KQ','278470.KS','323410.KS','033100.KQ'],
  'k반도체': ['005930.KS','000660.KS','042700.KS','009150.KS','402340.KS','039030.KQ','403870.KQ','058470.KQ'],
  'k방산': ['012450.KS','047810.KS','079550.KS','064350.KS','272210.KS','000880.KS','103140.KS'],
  'k조선': ['042660.KS','329180.KS','009540.KS','010140.KS','267250.KS'],
  'k전력': ['298040.KS','267260.KS','010120.KS','015760.KS','103590.KS','006260.KS'],
  'k원전': ['034020.KS','000720.KS','052690.KS','051600.KS'],
  'k배터리': ['373220.KS','006400.KS','247540.KQ','051910.KS','005490.KS','096770.KS','086520.KQ','003670.KQ','066970.KQ'],
  'k바이오': ['068270.KS','207940.KS','196170.KQ','128940.KS','028300.KQ','000100.KS','326030.KS','141080.KQ'],
  'k뷰티': ['090430.KS','051900.KS','044820.KS','192820.KS','161890.KS','278470.KS','257720.KQ','237880.KQ'],
  'k콘텐츠': ['259960.KS','352820.KS','041510.KQ','035900.KQ','122870.KQ','253450.KS','035760.KS'],
  'k푸드': ['003230.KS','097950.KS','271560.KS','004370.KS','280360.KS','005180.KS','000080.KS'],
  'k금융': ['105560.KS','055550.KS','086790.KS','316140.KS','138040.KS','032830.KS','000810.KS','323410.KS'],
  'k로봇': ['454910.KS','277810.KQ','178320.KQ','005380.KS'],
  'k자동차': ['005380.KS','000270.KS','012330.KS','086280.KS','204320.KS'],
  '밸류업': ['105560.KS','055550.KS','086790.KS','316140.KS','138040.KS','005380.KS','000270.KS'],
  '삼성': ['005930.KS','207940.KS','006400.KS','009150.KS','032830.KS','000810.KS','018260.KS','028260.KS','016360.KS'],
  '현대': ['005380.KS','000270.KS','012330.KS','086280.KS','267260.KS','329180.KS','009540.KS','000720.KS','064350.KS'],
  'sk': ['000660.KS','402340.KS','096770.KS','017670.KS','034730.KS','326030.KS'],
  '한화': ['012450.KS','042660.KS','272210.KS','000880.KS','082740.KS','009830.KS'],
  'lg': ['373220.KS','051910.KS','051900.KS','003550.KS','066570.KS','032640.KS'],
};


// v59.40: the trader profiles (AIO_TRADER_PROFILES, _aioGetActiveProfile, _aioSetProfile) moved to src/domain/screener/trader-profiles.js and src/app/trader-profiles.js.
// v58.80 (first-users F29): _aioWatchlistGet/_aioWLToggle read and write the 관심 종목 lists (src/data/watchlist-store.js).


// v50.38 트랙1: 누락됐던 _fetchYahooChartData 복구 (핵심 버그 — 8곳에서 호출되나 정의 부재였음).
//   스파크라인(_aioBuildSparklineSvg)·OHLCV 폴백(fetchOHLCVWithFallback)·VIX/HY/SPY 차트가 공통 의존.
//   Yahoo v8 chart를 fetchViaProxy(CORS 프록시 체인 + stale-cache 폴백) 경유로 받아 OHLCV 배열 반환.
//   소비자 기대 형태: { closes, adjustedCloses, opens, highs, lows, volumes, timestamps }(유닉스초).
//   기술분석/OHLC는 raw close를 유지하고, 총수익/월말 백테스트는 별도 adjustedCloses를
//   명시적으로 선택해야 한다. Yahoo가 adjusted series를 생략하면 partial/unavailable로
//   표시하며 raw close를 adjusted로 위장하지 않는다.
async function _aioFetchYahooChartData(symbol, range, interval, requestOptions) {
  if (!symbol) return null;
  range = range || '1mo';
  interval = interval || '1d';
  var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) +
    '?range=' + encodeURIComponent(range) + '&interval=' + encodeURIComponent(interval) + '&includePrePost=false';
  try {
    var json;
    if (typeof fetchViaProxy === 'function') {
      json = await fetchViaProxy(url, { parseJson: true, timeout: 5000, totalTimeout: 12000, signal: requestOptions && requestOptions.signal,
        accept: function(payload) {
          var candidate = payload && payload.chart && payload.chart.result && payload.chart.result[0];
          return !!(candidate && candidate.meta && String(candidate.meta.symbol).toUpperCase() === String(symbol).toUpperCase()
            && Array.isArray(candidate.timestamp) && candidate.timestamp.length && candidate.indicators && candidate.indicators.quote);
        }
      });
    } else {
      var r = await fetchWithTimeout(url, { signal: requestOptions && requestOptions.signal }, 7000);
      json = await r.json();
    }
    var res = json && json.chart && json.chart.result && json.chart.result[0];
    if (!res || !res.meta || String(res.meta.symbol || '').toUpperCase() !== String(symbol).toUpperCase()) return null;
    var indicators = res.indicators || {};
    var q = (indicators.quote && indicators.quote[0]) || {};
    var adjusted = (indicators.adjclose && indicators.adjclose[0] && indicators.adjclose[0].adjclose) || null;
    var timestamps = Array.isArray(res.timestamp) ? res.timestamp : [];
    var closes = Array.isArray(q.close) ? q.close : [];
    var hasAlignedAdjusted = Array.isArray(adjusted) && adjusted.length === timestamps.length;
    var comparableBars = 0;
    var adjustedBars = 0;
    for (var ai = 0; ai < Math.min(timestamps.length, closes.length); ai++) {
      var rawClose = closes[ai];
      if (typeof rawClose !== 'number' || !isFinite(rawClose) || rawClose <= 0) continue;
      comparableBars++;
      if (hasAlignedAdjusted && typeof adjusted[ai] === 'number' && isFinite(adjusted[ai]) && adjusted[ai] > 0) adjustedBars++;
    }
    var adjustedCloseStatus = !Array.isArray(adjusted) ? 'unavailable'
      : (hasAlignedAdjusted && comparableBars > 0 && adjustedBars === comparableBars ? 'complete' : 'partial');
    return {
      symbol: symbol,
      interval: interval,
      timestamps: timestamps,
      closes: closes,
      // Keep provider index alignment and nulls. Never filter this array
      // independently from timestamps: portfolio month-end selection depends
      // on the exact bar/date relationship.
      adjustedCloses: Array.isArray(adjusted) ? adjusted.slice() : null,
      adjCloses: Array.isArray(adjusted) ? adjusted.slice() : null,
      adjustedCloseStatus: adjustedCloseStatus,
      adjustedCloseCoveragePct: comparableBars ? Math.round(adjustedBars / comparableBars * 1000) / 10 : 0,
      backtestEligible: adjustedCloseStatus === 'complete',
      backtestPriceBasis: adjustedCloseStatus === 'complete' ? 'adjusted-close' : null,
      opens: q.open || [],
      highs: q.high || [],
      lows: q.low || [],
      volumes: q.volume || [],
      meta: res.meta || null,
      transport: json._aioTransport || null,
      sourceKind: 'T3_PUBLIC_DELAYED',
      allowedUse: adjustedCloseStatus === 'complete' ? 'research-history-adjusted-close' : 'research-history-raw-only'
    };
  } catch(e) {
    if (typeof _aioLog === 'function') _aioLog('warn', 'fetch', '_fetchYahooChartData 실패 ' + symbol + ': ' + (e && e.message || e));
    return null;
  }
}
// P1756: lightweight-charts loads on first chart use (index.html coordinateChartDependency). The 종목 차트
// (src/ui/components/stock-chart.js) reads window.LightweightCharts right after this fetch resolves, so while that
// screen is open the fetch also waits — in parallel, bounded — for the library instead of racing it.
// A classic script's top-level function is itself a window property, so the producer is captured before
// window._aioFetchYahooChartData is reassigned (otherwise the wrapper would call itself).
var _aioFetchYahooChartDataDirect = _aioFetchYahooChartData;
function _aioChartDataForScreen(symbol, range, interval, requestOptions) {
  var data = _aioFetchYahooChartDataDirect(symbol, range, interval, requestOptions);
  var screen = typeof document !== 'undefined' ? document.getElementById('page-technical') : null;
  if (!screen || !screen.classList.contains('active') || typeof window.LightweightCharts !== 'undefined'
    || typeof window._aioEnsureChartLibrary !== 'function') return data;
  var library = Promise.race([
    Promise.resolve(window._aioEnsureChartLibrary('lwc')).catch(function() { return null; }),
    new Promise(function(resolve) { setTimeout(resolve, 8000); })
  ]);
  return Promise.all([data, library]).then(function(settled) { return settled[0]; });
}
window._fetchYahooChartData = _aioFetchYahooChartDataDirect;
window._aioFetchYahooChartData = _aioChartDataForScreen;
// 모듈 스코프에서도 typeof _fetchYahooChartData 가드가 통하도록 로컬 별칭 (aio-ui.js 등 비-window 참조 호환)
var _fetchYahooChartData = window._fetchYahooChartData;


// v39.2: screener 제거됨
// v58.76: switchThemeMode (ETF / 세부 테마 toggle of the retired #page-theme-detail block) is retired.
// ═══════════════════════════════════════════════════════════════
// AIO LIVE DATA ENGINE v1.0
// 나라별 우선순위 기반 멀티소스 실시간 뉴스 + 시세 데이터
// ═══════════════════════════════════════════════════════════════

// ── 소스 정의 ─────────────────────────────────────────────────

// ── Country flag mapping ────────────────────────────────────────
const COUNTRY_FLAG = {
  us: '', kr: '', asia: '', eu: '',
  jp: '', cn: '', tw: '', sg: '',
  gb: '', de: '', fr: '', au: '',
};
function getCountryFlag(country) {
  return COUNTRY_FLAG[country] || COUNTRY_FLAG[(country||'').toLowerCase()] || '';
}

/* ═══════════════════════════════════════════════════════════════
   v20 DATA ENGINE — 실시간 & 지연 데이터 통합 모듈
   Budget: shared AI at most $20/month (owner 2026-10-11) · GitHub Pages static hosting
   ═══════════════════════════════════════════════════════════════ */

// ── API Endpoints (모두 무료 또는 CORS 허용) ──────────────────
const DATA_APIS = {
  // v57.76: the Alpha Vantage / Twelve Data / FRED / Finnhub entries held only personal-key getters (retired v57.67).
  // 5. CoinGecko (기존 유지 — 암호화폐)
  coingecko: { base: 'https://api.coingecko.com/api/v3', key: () => '', limit: '30/min free' },
  // v47.10: exchangeRate / altFearGreed 제거 — 선언만 있고 호출 0건 (dead code P112)
};

// ── 유틸리티: 타임아웃 fetch ──────────────────────────────────
// P1423: transport and provider contracts belong to the native module.
function fetchWithTimeout(url, opts = {}, ms = 8000) {
  return window._aioPersonalProviderTransport.fetchWithTimeout(url, opts, ms);
}

// ── v30.11 Task 11: CORS 프록시 레지스트리 (단일 진실 원천) ──────────────────
// v59.22: _cfWorkerUrl, _aioRelayUrl and _aioRelayFetch moved to src/data/providers/proxy-transport.js.

// P715: SCREENER_DB signal enum(BUY/HOLD/WATCH/SELL)은 내부 분류 키로만 유지하고,
// 사용자 표면에는 관측형 라벨만 렌더한다(시스템 발화형 매매 지시 금지 — P714 연장).
function _scrSignalLabel(sig) {
  return { BUY:'강세 구조', HOLD:'중립', WATCH:'관찰', SELL:'약세 구조' }[sig] || sig || '—';
}
try { window._scrSignalLabel = _scrSignalLabel; } catch(_) {}

// v59.22: the shared-Worker host mirror, _PROXY_REGISTRY, the proxy response checks and cache, and fetchViaProxy moved to
// src/data/providers/proxy-transport.js.

// v57.76: the personal-key Finnhub WebSocket, Twelve Data indicators (fetchTechnicalIndicators) and Twelve Data
// OHLCV (fetchOHLCV) were removed with the retired personal keys; fetchOHLCVWithFallback reads Yahoo through the Worker.

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
    if (typeof window._fetchYahooChartData !== 'function') return _attachOHLCVQuality([], { source: 'fallback-empty', missing: true });
    var yahooInterval = interval === '1month' ? '1mo' : interval === '1week' ? '1wk' : '1d';
    var y = await window._fetchYahooChartData(symbol, _yahooRangeForOHLCV(interval, bars), yahooInterval);
    if (!y || !Array.isArray(y.closes)) return _attachOHLCVQuality([], { source: 'yahoo-fallback', missing: true });
    var rows = y.closes.map(function(c, i) {
      var ts = y.timestamps && y.timestamps[i];
      var dt = ts ? new Date(ts * 1000).toISOString().substring(0, 10) : null;
      return { time: dt, open: y.opens && y.opens[i], high: y.highs && y.highs[i], low: y.lows && y.lows[i], close: c, volume: y.volumes && y.volumes[i] };
    });
    var normalized = _normalizeOHLCVRows(rows, bars);
    return _attachOHLCVQuality(normalized, { source: 'yahoo-fallback', interval: interval, observedAt: normalized.length ? normalized[normalized.length - 1].time : null, timestamp: Date.now() });
  } catch(e2) {
    if (typeof _aioLog === 'function') _aioLog('warn', 'fetch', 'fetchOHLCV yahoo fallback failed: ' + (e2 && e2.message || e2));
    return _attachOHLCVQuality([], { source: 'fallback-empty', error: true });
  }
}
window.fetchOHLCVWithFallback = fetchOHLCVWithFallback;

// v59.42: the option-sentiment chain (fetchOptionSentiment → fetchOpexCalendar / fetchPutCallRatios, _aioDataNextOpex)
// had no caller since options were retired (AGENTS); it is deleted. Put/call is read from the server artifact only.


// v59.26: _NAVER_NYSE, _naverUSCache, _toNaverReuters and fetchNaverUSData moved to src/data/providers/naver-us.js.

// v47.11: 5개 시리즈 추가 — DFEDTARU(기존 참조 L12997 있으나 등록 누락된 dead branch 해결)
//   + PAYEMS(비농업고용), M2SL(M2 통화량), DCOILWTICO(WTI 유가), MORTGAGE30US(30년 모기지)
//   → macro 페이지 + 브리핑 AI 프롬프트에서 활용 가능
const FRED_SERIES = {
  'BAMLH0A0HYM2': { name: 'HY Spread', unit: 'bp' }, // multiplier 제거 (사문화 필드)
  'T10Y2Y':       { name: '10Y-2Y Spread', el: null, unit: 'percentage-point' },
  'T10Y3M':       { name: '10Y-3M Spread', el: null, unit: '%' },
  'DGS2':         { name: '2Y Treasury', el: null, unit: '%' },
  'DGS5':         { name: '5Y Treasury', el: null, unit: '%' },
  'DGS10':        { name: '10Y Treasury', el: null, unit: '%' },
  'DGS20':        { name: '20Y Treasury', el: null, unit: '%' },
  'DGS30':        { name: '30Y Treasury', el: null, unit: '%' },
  'DTWEXBGS':     { name: 'Trade Weighted USD', el: null, unit: '' },
  'VIXCLS':       { name: 'VIX Close', el: null, unit: '' },
  'ICSA':         { name: 'Initial Claims', el: null, unit: 'K', multiplier: 0.001 },
  // P1114: a year-over-year series is displayed with a `%` suffix, so declaring
  // an empty unit published a declaration that did not state the unit the reader
  // sees. The suffix is now declared. `unit: ''` remains only for series that
  // genuinely have no unit (index levels).
  'CPIAUCNS':     { name: 'CPI-U headline (NSA)', el: null, unit: '%', yoy: true }, // 시장 표준 발표 헤드라인
  'CPILFENS':     { name: 'Core CPI-U (NSA)', el: null, unit: '%', yoy: true },
  'CPIAUCSL':     { name: 'CPI-U analytical (SA)', el: null, unit: '%', yoy: true },
  'CPILFESL':     { name: 'Core CPI-U analytical (SA)', el: null, unit: '%', yoy: true },
  // v47.11 신규
  'DFEDTARU':     { name: 'Fed Funds Target Upper', el: null, unit: '%' },
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
  // The SA/NSA CPI entries above are deliberately separate.  Do not collapse
  // them back into one generic CPI key: their YoY values can differ and have
  // different release/display semantics.
  'PCEPI':        { name: 'PCE', el: null, unit: '%', yoy: true },          // 헤드라인 PCE (연준 선호)
  'PCEPILFE':     { name: 'Core PCE', el: null, unit: '%', yoy: true }      // 근원 PCE (연준 2% 목표 기준)
};

// v48.59: BOK ECOS API fetcher — 한국은행 기준금리/환율/수출 (무료, 회원가입)
// 통계 코드: 722Y001=기준금리, 036Y002=CPI, 901Y014=GDP, 403Y001=수출, 403Y003=수입
async function fetchBokEcos(statCode, cycle, startDate, endDate, itemCode1) {
  function _extractBok(data) {
    if (data && data.contents && typeof data.contents === 'string') { try { data = JSON.parse(data.contents); } catch(e) {} }
    return (data && data.StatisticSearch && data.StatisticSearch.row) || null;
  }
  // 2차: Worker 릴레이 — ECOS는 CORS 헤더를 보내지 않아 브라우저 직접 호출이 불가능하다.
  const relayUrl = _aioRelayUrl('bok', { statCode, cycle, start: startDate, end: endDate, item: itemCode1 });
  if (relayUrl) {
    try {
      const r = await _aioRelayFetch(relayUrl, 8000);
      if (r.ok) { const rows = _extractBok(await r.json()); if (rows) return rows; }
      else if (r.status === 503 && typeof _aioLog === 'function') _aioLog('warn', 'fetch', 'BOK ECOS 릴레이 미구성(운영자 키 없음)');
    } catch(e) { /* fall through to the direct attempt */ }
  }

  // ECOS는 실패해도 화면이 조용히 비지 않도록 호출자가 알 수 있게 상태를 남긴다.
  if (typeof _reportApiError === 'function') _reportApiError('bok', 'BOK ECOS 사용 가능한 경로 없음');
  return null;
}

// v48.59: 한국 거시 지표 일괄 수집 → data-snap 바인딩
async function fetchAllBokData() {
  // v56: /relay(운영자 키)만으로 동작한다. v57.76: 개인 키 경로 제거.
  if (!_cfWorkerUrl()) { console.log('[AIO] BOK ECOS relay not set'); return null; }
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
  const unwrap = (data) => {
    if (data && data.contents && typeof data.contents === 'string') { try { return JSON.parse(data.contents); } catch(e) {} }
    return data;
  };
  // 2차: Worker 릴레이 — KOSIS도 CORS 헤더를 보내지 않아 직접 호출이 불가능하다.
  const relayUrl = _aioRelayUrl('kosis', { orgId, tblId, itmId, prdSe });
  if (relayUrl) {
    try {
      const r = await _aioRelayFetch(relayUrl, 8000);
      if (r.ok) return unwrap(await r.json());
      else if (r.status === 503 && typeof _aioLog === 'function') _aioLog('warn', 'fetch', 'KOSIS 릴레이 미구성(운영자 키 없음)');
    } catch(e) { /* fall through to the direct attempt */ }
  }

  if (typeof _reportApiError === 'function') _reportApiError('kosis', 'KOSIS 사용 가능한 경로 없음');
  return null;
}

// v48.59: 한국 통계청 주요 지표 일괄 (CPI · 실업률 · 수출입)
async function fetchAllKosisData() {
  // v56: /relay(운영자 키)만으로 동작한다. v57.76: 개인 키 경로 제거.
  if (!_cfWorkerUrl()) { console.log('[AIO] KOSIS relay not set'); return null; }
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

// v57.76: the personal-key FRED live query (fetchFredSeries: personal Worker, consented relay, direct call) was removed
// with the retired personal keys. Macro series come from the server artifact (data.json) applied by the boot path.
async function fetchAllFredData() {
  if (typeof _reportApiError === 'function') _reportApiError('fred', 'FRED live query retired; server data active');
  return null;
}

function applyFredToUI(data) {
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
  // CPI headline/core는 BLS release convention과 맞춘 NSA 시리즈를 기본으로
  // 사용하고, SA 시계열은 명시적인 별도 snapshot 필드로만 보존한다.
  function _fredYoYSnap(seriesId, snapKey) {
    const e = data[seriesId];
    if (!e || typeof e.yoy !== 'number' || !isFinite(e.yoy)) return;
    const yoy = e.yoy;
    _updSnap(snapKey, function(){ return (yoy >= 0 ? '+' : '') + yoy.toFixed(1) + '%'; });
  }
  _fredYoYSnap('CPIAUCNS', 'cpi');        // 비교표 호환 (US CPI-U headline YoY, NSA)
  _fredYoYSnap('CPIAUCNS', 'cpi-yoy');    // 전용 카드
  _fredYoYSnap('CPILFENS', 'core-cpi-yoy');
  _fredYoYSnap('CPIAUCSL', 'cpi-sa-yoy'); // analytical SA companion
  _fredYoYSnap('CPILFESL', 'core-cpi-sa-yoy');
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
      if (data['CPIAUCNS'] && typeof data['CPIAUCNS'].yoy === 'number') _setLiveSnap('cpi', +data['CPIAUCNS'].yoy.toFixed(1));
      if (data['CPILFENS'] && typeof data['CPILFENS'].yoy === 'number') _setLiveSnap('coreCpi', +data['CPILFENS'].yoy.toFixed(1));
      if (data['CPIAUCSL'] && typeof data['CPIAUCSL'].yoy === 'number') _setLiveSnap('cpiSa', +data['CPIAUCSL'].yoy.toFixed(1));
      if (data['CPILFESL'] && typeof data['CPILFESL'].yoy === 'number') _setLiveSnap('coreCpiSa', +data['CPILFESL'].yoy.toFixed(1));
      if (data['PCEPI'] && typeof data['PCEPI'].yoy === 'number') _setLiveSnap('pce', +data['PCEPI'].yoy.toFixed(1));
      if (data['PCEPILFE'] && typeof data['PCEPILFE'].yoy === 'number') _setLiveSnap('corePce', +data['PCEPILFE'].yoy.toFixed(1));
      if (data['PAYEMS'] && data['PAYEMS'].value != null && data['PAYEMS'].prevValue != null) {
        _setLiveSnap('nfp', Math.round(data['PAYEMS'].value - data['PAYEMS'].prevValue));
      }
      if (data['FEDFUNDS'] && typeof data['FEDFUNDS'].value === 'number') _setLiveSnap('fedRate', +data['FEDFUNDS'].value.toFixed(2));
      if (data['UNRATE'] && typeof data['UNRATE'].value === 'number') {
        // P1142: 선언 키 usUnemploy에도 기록(기존 'unemploy'는 data-snap DOM 계약 유지).
        var _unrate = +data['UNRATE'].value.toFixed(1);
        _setLiveSnap('unemploy', _unrate);
        _setLiveSnap('usUnemploy', _unrate);
      }
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
  }

  // Keep every Treasury maturity available to both the legacy curve renderer
  // and native consumers.  The server bridge uses the same aliases below;
  // this also prevents a personal FRED refresh from reintroducing a 5Y/20Y
  // gap after the official server artifact was projected.
  if (data['DGS5']) {
    window._live5Y = data['DGS5'].value;
    if (window.DATA_SNAPSHOT) window.DATA_SNAPSHOT.fvx = data['DGS5'].value;
  }
  // v31.9: DGS10 Yahoo 실시간 → _live10Y 동기화 (yield curve 계산용)
  if (data['DGS10']) {
    window._live10Y = data['DGS10'].value;
    if (window.DATA_SNAPSHOT) window.DATA_SNAPSHOT.tnx = data['DGS10'].value;
  }
  if (data['DGS20']) {
    window._live20Y = data['DGS20'].value;
    if (window.DATA_SNAPSHOT) window.DATA_SNAPSHOT.tnx20y = data['DGS20'].value;
  }
  if (data['DGS30']) {
    window._live30Y = data['DGS30'].value;
    if (window.DATA_SNAPSHOT) window.DATA_SNAPSHOT.tyx = data['DGS30'].value;
  }
  if (data['T10Y2Y']) {
    if (window.DATA_SNAPSHOT) window.DATA_SNAPSHOT.t10y2y = data['T10Y2Y'].value;
  }
  // v31.9: VIXCLS Yahoo 실시간 → 센티먼트 히스토리에 최신값 주입
  if (data['VIXCLS'] && data['VIXCLS']._source && data['VIXCLS']._source.startsWith('yahoo-')) {
    window._liveVIXCLS = data['VIXCLS'].value;
  }

  // v57.60: retired spread-2s10s-* writers removed (nodes no longer exist); DATA_SNAPSHOT.t10y2y above stays.

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

  // v57.60: retired yc-2y / yc-2y-track / dxy-1m writers removed (nodes no longer exist).

  // v31.9: FRED 데이터 신선도 요약 콘솔 로그
  const fredSummary = Object.entries(data).map(([id, d]) => {
    const src = d._source ? (d._source.startsWith('yahoo') ? 'Yahoo' : 'FRED') : 'FRED';
    return `  ${id}: ${typeof d.value === 'number' ? d.value.toFixed(2) : d.value} (${src} ${d.date})`;
  }).join('\n');
  if (Object.keys(data).length > 0) {
    console.log('[AIO v31.9] FRED/Yahoo 통합 데이터 현황:\n' + fredSummary);
  }
}

// P1425: the FRED 12-month browser charts (personal-key only since P1422) left with the 거시 rebuild;
// the 거시 경제 board shows the producer-published official releases.

// ═══ 7. 시장 폭 (Breadth) — 서버 산출물 소유 (클라이언트 수집 없음) ═══════
async function fetchBreadthData() {
  // The server artifact is the primary value-specific collector and the native breadth board owns
  // the route. P1754: the client-side top-movers call that used to follow here was removed — its
  // response was no longer rendered anywhere and it only spent the shared Alpha Vantage quota.
  var screenerBreadth = typeof window._aioScreenerBreadth === 'function' ? window._aioScreenerBreadth() : null;
  if (screenerBreadth && screenerBreadth.state.status === 'verified_current') {
    return { updated:false, source:'screener-breadth-primary' };
  }
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
      var vixHistory = parsed.timestamps.map(function(timestamp, i) {
        return { date: new Date(timestamp * 1000).toISOString().slice(0, 10), value: parsed.closes[i] };
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

// v59.33: the data refresh scheduler (REFRESH_SCHEDULE, page on-enter refresh, visibility pause, AIO.runScheduledRefresh) moved to src/app/refresh-scheduler.js.

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
      forceRefresh: !!scope.forceFresh,
      signal: scope.signal || null
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
    var truth = null;
    try { truth = window.AIO && typeof window.AIO.evaluateDataTruth === 'function' ? window.AIO.evaluateDataTruth(t, live || {}, (window._dataSource && window._dataSource[t]) || {}) : null; } catch(_) {}
    var cross = truth && truth.crossSource ? truth.crossSource : null;
    try {
      if (!cross && window.AIO && typeof window.AIO.getCrossSourceQuoteValidation === 'function') cross = window.AIO.getCrossSourceQuoteValidation(t);
    } catch(_crossAudit) {}
    var evidence = window.AIO && typeof window.AIO.buildAIQuoteEvidenceRow === 'function'
      ? window.AIO.buildAIQuoteEvidenceRow(t, live, { truth: truth })
      : { ticker: t, hasQuote: false, hasLivePrice: false, truthStatus: 'unknown', decisionUse: false, status: 'blocked', blockers: ['quote-evidence-helper-missing'] };
    var observedMs = evidence.observedAt ? Date.parse(evidence.observedAt) : NaN;
    var ageMs = Number.isFinite(observedMs) ? Math.max(0, Date.now() - observedMs) : NaN;
    var quoteOk = evidence.status !== 'blocked' && evidence.decisionUse === true && Number.isFinite(ageMs) && ageMs <= 2 * 60 * 1000;
    var row = Object.assign({}, evidence, {
      hasLivePrice: evidence.hasQuote === true,
      quoteAgeMs: Number.isFinite(ageMs) ? ageMs : null,
      quoteAgeSec: Number.isFinite(ageMs) ? Math.round(ageMs / 1000) : null,
      truthIssues: (evidence.truthIssues || []).concat(evidence.blockers || []),
      crossSourceStatus: cross && cross.status || 'unknown',
      crossSourceCount: cross && typeof cross.independentCount === 'number' ? cross.independentCount : 0,
      crossSourceMismatches: cross ? [].concat(cross.blockingMismatches || [], cross.warningMismatches || []) : [],
      status: evidence.status === 'blocked' ? 'blocked' : (quoteOk ? 'ok' : 'refresh_required')
    });
    return row;
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
          var lookupCtrl = new AbortController();
          var relayScopeAbort = function() { try { lookupCtrl.abort(); } catch(_) {} };
          if (scope.signal && typeof scope.signal.addEventListener === 'function') {
            if (scope.signal.aborted) relayScopeAbort();
            else scope.signal.addEventListener('abort', relayScopeAbort, { once: true });
          }
          var lookupPromise = dynamicTickerLookup(t, { forceFresh: true, reason: 'chat-answer-preflight', signal: lookupCtrl.signal });
          var r = await (typeof _withTimeout === 'function'
            ? _withTimeout(lookupPromise, 3500, null, function() { try { lookupCtrl.abort(); } catch(_) {} })
            : lookupPromise);
          if (scope.signal && typeof scope.signal.removeEventListener === 'function') scope.signal.removeEventListener('abort', relayScopeAbort);
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

// v59.20: updateDataStatusError and updateDataStatus moved to src/ui/components/data-status-surface.js (one owner of the
// data-status surfaces).

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
        // v59.42: this reply can arrive while the module graph is still loading, before src/app/compatibility-globals.js
        // installs window.updateDataStatus ('updateDataStatus is not defined' at boot). The surface reads
        // _aioSWVersion on its own next render, so a reply before install only skips this one repaint.
        if (typeof window.updateDataStatus === 'function') window.updateDataStatus();
      }
    };
    navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [mc.port2]);
  } catch(e) {}
}
function _aioRequestSWControllerReload() {
  try {
    if (sessionStorage.getItem('aio_sw_controller_reload_v1') === '1') return;
    sessionStorage.setItem('aio_sw_controller_reload_v1', '1');
    setTimeout(function() { try { if (window.location && typeof window.location.reload === 'function') window.location.reload(); } catch (_) {} }, 80);
  } catch (_) {}
}
// P1901: only an update takeover reloads
var _aioHadSWController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
if (navigator.serviceWorker && navigator.serviceWorker.addEventListener) {
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    window._aioSWVersion = ''; window._aioSWMismatchLogged = '';
    if (_aioHadSWController) _aioRequestSWControllerReload();
    _aioHadSWController = true;
    _querySWVersion();
  });
}
_querySWVersion();
let _aioMarketSnapshotMeta = null;
try {
  window.addEventListener('aio:marketSnapshot', function(e) {
    _aioMarketSnapshotMeta = e && e.detail ? e.detail : null;
    window._aioMarketSnapshotMeta = _aioMarketSnapshotMeta;
  });
} catch (_) {}

// ═══ 10. 초기화 (마스터 부팅 시퀀스: v59.36~ src/app/boot-sequence.js의 initV20DataEngine이 부팅 때 cleanupProxyCache를 부른다) ═══
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

/* v59.31: the IndexedDB news cache (_idbOpen, _idbMigrateLegacyNews, _idbSaveNews, _idbLoadNews) moved to src/storage/news-cache.js. */

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
  // v57.81 (P1755 path read): with no event payload, read only the fields used here; the bare call cloned the whole slice.
  var state = nativeState || (arch && typeof arch.getScreenerState === 'function' ? { status: arch.getScreenerState('status'), revision: arch.getScreenerState('revision'), metadata: arch.getScreenerState('metadata') } : null);
  if (!state || typeof state !== 'object' || (!nativeState && state.status == null && state.metadata == null)) return false;
  var metadata = state.metadata && typeof state.metadata === 'object' ? state.metadata : {};
  var asOf = metadata.asOf || state.revision || null;
  if (window.SCREENER_DB_META && asOf) {
    var staleAfterDays = metadata.universeStaleAfterDays;
    if (metadata.universeLastBulkUpdate) window.SCREENER_DB_META.lastBulkUpdate = String(metadata.universeLastBulkUpdate).slice(0, 10);
    if (staleAfterDays != null && staleAfterDays !== '' && isFinite(Number(staleAfterDays))) window.SCREENER_DB_META.staleAfterDays = Number(staleAfterDays);
    window.SCREENER_DB_META.currentness = metadata.universeCurrentness || 'UNKNOWN';
    window.SCREENER_DB_META.stale = metadata.universeFreshnessStatus === 'stale';
  }
  if (typeof _aioApplyScreenerBreadth === 'function' && metadata.breadth) _aioApplyScreenerBreadth({ breadth: metadata.breadth });
  if (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs && asOf) {
    window.DATA_SNAPSHOT._fieldTs.screener = asOf;
  }
  // The screener artifact's load state is read from the native slice (src/data/page-completeness.js screenerLoadState).
  try { if (typeof _aioRenderDataFreshness === 'function') _aioRenderDataFreshness(); } catch (_) {}
  return true;
}
window._aioApplyNativeScreenerState = _aioApplyNativeScreenerState;
// Native screener metadata by path (no slice clone). The legacy readers below take these instead of the copies this
// projection used to keep in _aioServerScreener / _aioScreenerFactorAsOf / _aioScreenerFactorObservedAt / _aioFactorBacktest.
function _aioScreenerMetadata(path) {
  var arch = window.AIO_ARCH;
  try { return arch && typeof arch.getScreenerState === 'function' ? arch.getScreenerState('metadata.' + path) : undefined; } catch (_) { return undefined; }
}
function _aioScreenerFactorAsOf() {
  var arch = window.AIO_ARCH;
  try { return _aioScreenerMetadata('asOf') || (arch && typeof arch.getScreenerState === 'function' ? arch.getScreenerState('revision') : null) || null; } catch (_) { return null; }
}
// v59.42: _aioScreenerFactorBacktest left with its only reader, the deleted legacy factor-backtest diagram.
try {
  window.addEventListener('aio:nativeScreenerReady', function(event) {
    _aioApplyNativeScreenerState(event && event.detail);
  });
} catch (_) {}

let _aioServerMacroReady = false;
let _aioServerHyReady = false;

// v59.34: the server data loader (the Treasury curve projection and _aioLoadServerData) moved to src/data/server-data-loader.js.

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
    // v58.80 (first-users R2-5): always MM-DD HH:MM — "가격 09:02 KST" beside a dated factor time read as undated.
    return mm + '-' + dd + ' ' + hh + ':' + min + ' KST';
  } catch(e) { return raw; }
};

// v59.38: the v51.67 delta display (_aioRenderDeltas, _aioSetDeltaEl, _aioRenderLiveFearGreedDelta and the aio_delta_* refs) is retired —
// none of its 12 target ids exists in index.html or src/, so it painted nothing; 홈 F&G 전일 변화 is native (P1428).

// v51.66: 전 페이지 데이터 신선도 UI — screener 듀얼 타임스탬프 + macro FRED 기준 시각
function _aioRenderDataFreshness() {
  try {
    // 스크리너: 팩터 기준시각 | 가격 기준시각
    var asEl = document.querySelector('#page-screener [data-factor-asof]');
    if (asEl) {
      var scrObservedAt = _aioScreenerMetadata('factorObservedAt');
      var scrTs = scrObservedAt ? _aioKstShortFromIso(scrObservedAt) : null;
      var scrGeneratedTs = window._aioGetFieldTs('screener');
      var priceTs = window._aioGetFieldTs('prices');
      if (scrTs && priceTs) {
        asEl.textContent = '팩터 관측 ' + scrTs + (scrGeneratedTs ? ', 파일 ' + scrGeneratedTs : '') + ' | 가격 ' + priceTs;
      } else if (scrTs) {
        asEl.textContent = '팩터 관측 ' + scrTs + (scrGeneratedTs ? ', 파일 ' + scrGeneratedTs : '');
      } else if (_aioScreenerFactorAsOf()) {
        asEl.textContent = '팩터 기준 ' + String(_aioScreenerFactorAsOf()).slice(0, 10);
      } else {
        asEl.textContent = '팩터 데이터 대기';
      }
    }
    // v57.77: the macro FRED stamp writer (#macro-fred-ts) left with its absent element.
    if (typeof _aioSchedulePublicReadiness === 'function') _aioSchedulePublicReadiness(250);
  } catch(_) {}
}
window._aioRenderDataFreshness = _aioRenderDataFreshness;

// v51.66: 수동 유지 _fieldTs 필드 staleness 경고 — >7일 경과 시 콘솔 warn + 배너 pill
// 중앙은행 금리/매크로 정책 날짜는 자동 갱신 불가 — 운영자가 직접 aio-core.js에서 업데이트해야 함
var _MANUAL_FIELDTS_LABELS = {
  fed_rate:        'Fed 연방기금금리 월평균',
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
      pill.className = 'stale-manual-pill'; // styled in legacy-data.css
      pill.title = r.label + ' — 마지막 업데이트 ' + r.date + ' (' + r.days + '일 경과). 정책 발표/공식 소스 확인 후 갱신됩니다.';
      pill.textContent = '' + r.label + ' ' + r.days + '일 경과';
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
    summary.textContent = '주의 항목 ' + count + '건';
  } catch (_e) {}
}
window._aioUpdatePipelineStatusToggle = _aioUpdatePipelineStatusToggle;

// P1737: public-data/official-references.json (BOK base rate, KR CPI, KR exports; each item carries its own
// status). _aioLoadOfficialReferences runs after each data.json apply (v59.34~ from src/data/server-data-loader.js); a
// missing file (404) or another schema leaves the manual values in place.
var _aioOfficialReferencesInFlight = null;
function _aioLoadOfficialReferences() {
  if (_aioOfficialReferencesInFlight) return _aioOfficialReferencesInFlight;
  var url = './public-data/official-references.json'; // v57.61 (perf): no-cache revalidation, no buster
  _aioOfficialReferencesInFlight = fetch(url, { cache: 'no-cache' }).then(function(r) {
    return r.ok ? r.json() : null;
  }).then(function(payload) {
    if (!payload || !/^official-web-references\.v\d+$/.test(String(payload.schemaVersion || '')) || !payload.items || typeof payload.items !== 'object') return null;
    window._serverDataMeta = window._serverDataMeta || {};
    window._serverDataMeta.officialReferences = { schemaVersion: payload.schemaVersion, checkedAt: payload.checkedAt || null };
    if (window.AIO && typeof window.AIO.applyProducedReferences === 'function') return window.AIO.applyProducedReferences({ officialReferences: payload });
    return null;
  }).catch(function() { return null; }).then(function(result) { _aioOfficialReferencesInFlight = null; return result; });
  return _aioOfficialReferencesInFlight;
}

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
    var url = './public-data/operator-note.json'; // v57.61 (perf): no-cache revalidation, no buster
    var r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return;
    var d = await r.json();
    var _noteAgeDays = (Date.now() - Date.parse(String((d && d.updated) || '') + 'T00:00:00+09:00')) / 86400000; if (d && d.visible !== false && !_aioIsOperatorNotePlaceholder(d) && Number.isFinite(_noteAgeDays) && _noteAgeDays <= 14) { // P1652: a dated note is hidden (and kept out of AI context) after 14 days
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
// v57.71 (owner 2026-10-15): the operator note becomes "오늘의 한 문장" — one sentence that names the day's market
// tension. The producer writes it once per 08:00 KST day (data.json marketAnalysis.sentence); an operator line in
// operator-note.json (`sentence`, `updated` = that day) takes its place. Older than the previous day, nothing shows.
function _aioRenderOperatorNote() {
  var el = document.getElementById('home-operator-note');
  if (!el) return;
  var day = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
  var yesterday = new Date(Date.now() + 3600000 - 86400000).toISOString().slice(0, 10);
  var note = window._aioOperatorNote;
  var manual = note && note.visible !== false && !_aioIsOperatorNotePlaceholder(note) && note.sentence && note.updated === day
    ? { text: String(note.sentence), day: note.updated, by: '운영자' } : null;
  var produced = window._aioMarketSentence;
  var line = manual || (produced && produced.text && (produced.day === day || produced.day === yesterday) ? { text: String(produced.text), day: produced.day, by: null } : null);
  if (!line) { el.style.display = 'none'; el.innerHTML = ''; return; }
  var md = Number(line.day.slice(5, 7)) + '/' + Number(line.day.slice(8, 10));
  el.innerHTML =
    '<div class="aio-operator-note-card aio-operator-note-priority aio-market-sentence" data-source-kind="REFERENCE" data-operational-use="reference-only" data-sentence-day="' + escHtml(line.day) + '">' +
      '<div class="aio-operator-note-meta">' +
        '<span class="aio-operator-note-kicker">오늘의 질문</span>' +
        '<span class="aio-operator-note-date">' + escHtml(md) + ' 작성' + (line.by ? ', ' + escHtml(line.by) : '') + '</span>' + // v58.80 (first-users run-4): the writing day, not the close it reads
      '</div>' +
      (function(v) { return v ? '<div class="aio-operator-note-verdict">' + escHtml(v) + '</div>' : ''; })(typeof window._aioSentenceVerdict === 'function' ? window._aioSentenceVerdict() : '') + '<div class="aio-operator-note-title">' + escHtml(line.text) + '</div>' + // run-5 (owner decision delegated 2026-10-26): the verdict leads, the day's question follows under its own name
    '</div>';
  el.style.display = 'block';
}
window._aioRenderOperatorNote = _aioRenderOperatorNote;

// P1268: this compatibility producer keeps returning the legacy score projection for charts and
// signal consumers, while the native news route is the sole owner of the visible summary sinks.
// RSS/server/IDB producer behavior remains intact; it no longer races the native renderer's counts.
function _aioUpdateNewsSummaryFromItems(items, meta) {
  try {
    var rows = Array.isArray(items) ? items : [];
    var ns = computeNewsSentimentScore(rows);
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
    var serverMeta = window._serverDataMeta || {};
    var items = bs.map(function(n) {
      var it = {
        guid: n.guid, sourceArticleId: n.sourceArticleId, sourceStoryId: n.sourceStoryId, storyId: n.storyId,
        correctionOf: n.correctionOf, retractionOf: n.retractionOf, supersedes: n.supersedes, revisionType: n.revisionType,
        issuerId: n.issuerId, issuerCik: n.issuerCik, issuerSymbol: n.issuerSymbol, evidenceKind: n.evidenceKind,
        observedAt: n.observedAt || null, fetchedAt: n.fetchedAt || null,
        title: n.title, headline: n.title, titleKo: n.titleKo || null, // v57.55: translated once in Actions
        link: n.link, url: n.link,
        source: n.source || 'News', feed: n.source || 'News',
        // Missing publication time is undated reference material, not a
        // current event. Never manufacture `now` here: doing so lets an old
        // LKG headline enter the current-news score/window.
        pubDate: n.pubDate || null,
        desc: n.desc || n.description || '',
        summary: n.summary || n.ko_summary || '',
        country: n.country || 'us',
        selectionReason: n.selectionReason || '', verification: n.verification === 'unconfirmed' ? 'unconfirmed' : null, // 2026-10-18: rumours stay labelled
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
    if (typeof renderBriefingFeed === 'function') renderBriefingFeed(items);
    _aioUpdateNewsSummaryFromItems(items, { kind: 'server-cache', generatedAt: serverMeta.generatedAt || null });
    window._newsBackstopApplied = { count: items.length, at: Date.now() };
    if (typeof _aioLog === 'function') _aioLog('info', 'data', 'server 뉴스 백스톱 적용: ' + items.length + '건 (클라이언트 뉴스 부재)');
    // 스테일 배너 (v57.77: the absent #news-cache-ts stamp writer is retired)
    try {
      var _meta = window._serverDataMeta;
      var _ageMin = _meta && _meta.ageMin != null ? _meta.ageMin : null;
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
    var generatedMs = new Date(meta.generatedAt).getTime();
    if (!isFinite(generatedMs)) { el.style.display = 'none'; return; }
    var age = Math.max(0, Math.round((Date.now() - generatedMs) / 60000));
    // KST 시각 포맷 (UTC+9)
    var d = new Date(new Date(meta.generatedAt).getTime() + 9 * 3600000);
    var kst = (d.getUTCMonth()+1) + '-' + String(d.getUTCDate()).padStart(2,'0')
            + ' ' + String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0') + ' KST';
    var txt, cls, title;
    if (meta.marketCyclePublished !== true) {
      txt = '' + kst + ' 시도';
      cls = 'fb-static';
      title = '최근 서버 시도는 시장 스냅샷으로 발행되지 않았습니다. 현재 시세는 마지막 성공본(LKG) 참고자료일 수 있습니다.\n'
        + kst + ' | cycle=' + (meta.cycleStatus || 'unknown');
    } else if (age < 60)       { txt = '' + kst + ' 갱신'; cls = 'fb-live';   title = '서버(GitHub Actions)가 ' + age + '분 전 수집한 데이터 — 신선\n' + kst + ' | 시세 ' + (meta.symbolsOk||'?') + '개'; }
    else if (age < 180) { txt = '' + kst + ' 갱신'; cls = 'fb-static'; title = '서버 데이터 ' + age + '분 경과 (자동 갱신 대기)\n' + kst + ' | 시세 ' + (meta.symbolsOk||'?') + '개'; }
    else {
      var h = Math.floor(age / 60);
      txt = '' + kst + ' (' + h + 'h 전)'; cls = 'fb-stale';
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

    var msgs = Array.isArray(meta.pipelineNotices) ? meta.pipelineNotices.slice() : []; // v58.70: src/data/server-data.js
    if (meta.marketCyclePublished !== true) {
      msgs.push({ icon: '', text: '시장 스냅샷 미발행', detail: '최근 refresh 시도는 완전한 시장 cycle로 발행되지 않았습니다. 현재 시세는 마지막 성공본 참고자료입니다.', color: '#e5484d' });
    }
    if (meta.marketAnalysisOk === false) {
      msgs.push({ icon: '', text: 'AI 시장 분석 비활성', detail: '운영자의 공용 AI 연결 설정 후 자동 분석을 사용할 수 있습니다.', color: '#e2a336' });
    }
    if (meta.fmpHasKey && meta.fmpOk === false && (meta.fundamentalCoveragePct == null || Number(meta.fundamentalCoveragePct) < 80)) {
      var coverageValue = meta.fundamentalCoveragePct == null ? null : Number(meta.fundamentalCoveragePct);
      var coverageLabel = isFinite(coverageValue) ? coverageValue.toFixed(1) + '%' : '미확인';
      var fmpDetail = '유료 FMP는 사용하지 않음, 무료 SEC companyfacts 누적 커버리지 ' + coverageLabel;
      msgs.push({ icon: '', text: '재무 팩터 축소 모드', detail: fmpDetail, color: '#e5484d' });
    }
    if (_aioScreenerMetadata('universeFreshnessStatus') === 'stale') {
      msgs.push({ icon: '!', text: '스크리너 종목 유니버스 갱신 필요', detail: '팩터 파일과 종목 식별 유니버스의 기준일이 다릅니다. 현재 결과는 연구용 부분 상태입니다.', color: '#e2a336' });
    }
    if (!meta.fredHasKey) {
      msgs.push({ icon: '', text: 'FRED 거시 서버갱신 비활성', detail: 'GitHub Secrets → FRED_API_KEY 등록 시 자동 활성화', color: '#b9a88d' });
    }
    if (meta.fredHasKey && meta.fredFetchOk === false) {
      msgs.push({ icon: '', text: 'FRED 거시 수집 실패', detail: 'FRED_API_KEY 등록됨 → API 오류 또는 레이트리밋. 키 유효성 확인', color: '#e5484d' });
    }
    var reconciliation = meta.reconciliation || null;
    if (!reconciliation || reconciliation.status === 'unavailable') {
      msgs.push({ icon: '!', text: '데이터 범주 상태 미수신', detail: '22개 데이터 범주의 자동 조정 상태를 불러오지 못했습니다.', color: '#e5484d' });
    } else if (reconciliation.status === 'stale') {
      msgs.push({ icon: '!', text: '데이터 범주 상태 불일치', detail: '현재 시장 스냅샷과 조정 상태의 revision이 다릅니다.', color: '#e5484d' });
    } else if (Array.isArray(reconciliation.runtimeBlockedCategories) && reconciliation.runtimeBlockedCategories.length) {
      msgs.push({
        icon: '!',
        text: '자동 데이터 경로 차단 ' + reconciliation.runtimeBlockedCategories.length + '건',
        detail: reconciliation.runtimeBlockedCategories.slice(0, 6).join(', '),
        color: '#e5484d'
      });
    }

    if (msgs.length === 0) { bar.style.display = 'none'; return; }

    var html = msgs.map(function(m) {
      return '<span class="lda-pipe" style="border-left-color:' + m.color + ';" title="' + m.detail.replace(/"/g,'&quot;') + '">'
           + m.icon + ' <b>' + m.text + '</b>'
           + ' <span class="lda-pipe-detail">' + m.detail + '</span>'
           + '</span>';
    }).join('');

    bar.innerHTML = html;
    bar.style.display = 'flex';

    // v59.08: the 스크리너 재무 팩터 coverage note is drawn by src/ui/components/screener-fmp-status.js
    // (window._aioRenderScreenerFmpStatus, src/app/legacy-screen-bridges.js); the meta is kept for its install.
    window._aioScreenerFmpMeta = meta;
    if (typeof window._aioRenderScreenerFmpStatus === 'function') window._aioRenderScreenerFmpStatus(meta);
    if (typeof _aioSchedulePublicReadiness === 'function') _aioSchedulePublicReadiness(250);
  } catch(_) {}
}
window._aioRenderPipelineStatus = _aioRenderPipelineStatus;

// v59.35: the public share readiness model (_aioBuildPublicShareReadiness, AIO.getPublicShareReadiness, AIO.getDataReconciliationStatus) moved to src/data/public-readiness.js.

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
      (issues.length ? '<div class="aio-public-readiness-issues">' + issues.map(_aioPublicReadinessEsc).join(', ') + '</div>' : '');
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
    var detail = e && e.detail;
    var pageId = typeof detail === 'string' ? detail : detail && (detail.pageId || detail.id || detail.route);
    if (pageId === 'home') _aioSchedulePublicReadiness(100);
  });
  _aioSchedulePublicReadiness(1500);
} catch(_) {}

// v50.24/WO-4: 부팅 후에도 탭을 열어두면 data.json을 30분마다 재로드 (boot-only 갭 해소).
// 배지 나이는 1분마다 재렌더(카운트업). 둘 다 _aioRegisterTimer로 등록 — 탭 숨김 중엔 멈추고 복귀 시 주기 경과분 1회 실행(P1756).
function _aioStartServerDataPolling() {
  try {
    if (typeof _aioRegisterTimer !== 'function') return;
    _aioRegisterTimer('serverDataReload', function() {
      _aioLoadServerData().catch(function(){});
      // P1728: the KR previous-close check reads history; a tab left open overnight must not keep yesterday's basis.
      _aioLoadHistory().catch(function(){});
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
    var url = './public-data/history.json'; // v57.61 (perf): no ?t= — the no-cache fetch revalidates (304) instead of re-downloading 3MB each hour
    var bp = window.__aioBootPrefetch && window.__aioBootPrefetch.history, pre = bp && !bp.taken ? (bp.taken = true, bp.res) : null; var r = await (pre ? pre.catch(function() { return fetch(url, { cache: 'no-cache' }); }) : fetch(url, { cache: 'no-cache' })); // the <head> boot prefetch (src/data/boot-prefetch.js), once
    if (!r.ok) return null;
    var arr = await r.json();
    if (!Array.isArray(arr)) return null;
    window._aioHistory = arr;
    window._aioHistoryMeta = { days: arr.length, first: arr[0] && arr[0].date, last: arr[arr.length - 1] && arr[arr.length - 1].date, loadedAt: Date.now() };
    try { _aioUpdateVixBadge(_aioLiveVixValue()); } catch (_vixBadgeErr) {}
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
        // fieldMeta를 통째로 넘긴다: 이 주석이 말하는 "실제 관측 provenance"를
        // 소비자가 읽으려면 객체가 살아 있어야 한다. 이전에는 valueBasis가 여기서
        // 탈락해 차트가 항상 'completed-market-series' 리터럴을 표시했다(P1105).
        out.push({ date: arr[i].date, value: v, observedAt: meta.observedAt || null, source: meta.source || null, sourceKind: meta.sourceKind || null, valueBasis: meta.valueBasis || null, fieldMeta: arr[i].fieldMeta || null });
      }
    }
    return out.length >= (minPoints || 20) ? out : null;
  } catch (e) { return null; }
}
window._aioHistorySeries = _aioHistorySeries;

// v58.20: AIO.getHistoryDataAudit had no product caller — history consumers read _aioHistorySeries directly.

// P858: phase state stays in one boot-coordinator object so the legacy surface
// does not grow additional window-owned write points for a timing concern.
var _aioBootPhase = (typeof window !== 'undefined' && window._aioBootPhase) || {
  quoteReady: false,
  translationReady: false
};

// v59.36: the master boot sequence (initV20DataEngine) moved to src/app/boot-sequence.js.

const AIO_NEWS_SOURCES = [
  // v59.42 coverage pass (owner-approved): the 78 browser RSS feeds are retired. Production news is the server bundle
  // (scripts/lib/news-selection.mjs NEWS_FEEDS); P1756 skipped this run while that bundle was fresh, and otherwise the
  // shared Worker refused every feed host. The Telegram channels stay for the browser fallback and its pipeline audit.
  {name:'TG Insider Tracking',       url:'https://rsshub.app/telegram/channel/insidertracking',       country:'us', tier:1, flag:'TG', topics:['macro','equity','semi','earnings','geo'], type:'telegram', tgSlug:'insidertracking', publicMirror:'https://t.me/s/insidertracking', pipelineRole:'us-fast-breaking'},  // v50.15: publicMirror 폴백(rsshub.app 불안정 시 t.me/s 공개프리뷰) + pipelineRole 명시
  {name:'TG BornLupin',              url:'https://rsshub.app/telegram/channel/bornlupin',             country:'us', tier:1, flag:'TG', topics:['macro','equity','semi','earnings'], type:'telegram', tgSlug:'bornlupin', publicMirror:'https://t.me/s/bornlupin', pipelineRole:'kr-semi-broker-notes'},  // v50.15: publicMirror 폴백 + pipelineRole(한국 반도체 sell-side 노트 집중)
  {name:'TG HANA China',             url:'https://rsshub.app/telegram/channel/HANAchina',            country:'cn', tier:1, flag:'TG', topics:['macro','equity','semi','power','optical','geo','japan','kr-market'], type:'telegram', tgSlug:'HANAchina', publicMirror:'https://t.me/s/HANAchina', pipelineRole:'china-em-supply-chain'},
  {name:'TG WalterBloomberg',       url:'https://rsshub.app/telegram/channel/walterbloomberg',       country:'us', tier:1, flag:'TG', topics:['macro','equity','earnings'],        type:'telegram', tgSlug:'walterbloomberg'},
  {name:'TG Aether Japan Research',  url:'https://rsshub.app/telegram/channel/aetherjapanresearch',   country:'jp', tier:1, flag:'TG', topics:['macro','equity','semi','geo','japan'], type:'telegram', tgSlug:'aetherjapanresearch', publicMirror:'https://t.me/s/aetherjapanresearch', pipelineRole:'asia-semi-flow'},
  {name:'TG FirstSquawk',           url:'https://rsshub.app/telegram/channel/firstsquawk',           country:'us', tier:1, flag:'TG', topics:['macro','geo','energy','defense'],  type:'telegram', tgSlug:'firstsquawk'},
  {name:'TG FinancialJuice',        url:'https://rsshub.app/telegram/channel/financialjuicechannel', country:'us', tier:1, flag:'TG', topics:['macro','geo','energy'],            type:'telegram', tgSlug:'financialjuicechannel'},
];

window.AIO_NEWS_SOURCES = AIO_NEWS_SOURCES;
// v59.42: the 데이터 출처 fold names the server feeds; the browser-list count it printed is gone with the RSS feeds.

// ── Global HTML escape ─────────────────────────────────────────
// P1500 (owner 2026-10-06): no emoji or pictographs on screen. External text (headlines, the telegram
// digest, AI answers) can carry them, so every escaped string drops them; arrows ↔ ↗ ↙ ▶ ◀ stay.
var _AIO_PICTOGRAPH_RE = /(?:\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}])(?:️|⃣|‍\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}])*[  ]?/gu;
function _aioStripPictographs(s) {
  return String(s).replace(_AIO_PICTOGRAPH_RE, function(m) { return /^[↔↗↙▶◀]/u.test(m) ? m : ''; });
}
window._aioStripPictographs = _aioStripPictographs;
function escHtml(s) {
  return (typeof _aioStripPictographs === 'function' ? _aioStripPictographs(s) : String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// ── URL sanitizer (XSS: javascript:/data: protocol block) ─────
function escUrl(url) {
  if (!url || typeof url !== 'string') return '';
  var trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) return '';
  return url.replace(/'/g, '%27').replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E');
}
// ── 중요도 키워드 & 티커 ────────────────────────────────────────
// v59.42: the news keyword lists, scoring, exclusion and selection live in src/domain/news/selection.js
// (keywords: selection-keywords.js); src/app/news-selection-entry-points.js keeps the window names.
SCREENER_DB_META.recordCount = SCREENER_DB.length;
SCREENER_DB_META.uniqueSymbols = new Set(SCREENER_DB.map(function(row) { return row && row.sym; }).filter(Boolean)).size;
SCREENER_DB_META.duplicateSymbols = Math.max(0, SCREENER_DB_META.recordCount - SCREENER_DB_META.uniqueSymbols);
SCREENER_DB_META.stale = !SCREENER_DB_META.lastBulkUpdate || (Date.now() - new Date(SCREENER_DB_META.lastBulkUpdate + 'T00:00:00Z').getTime()) > (SCREENER_DB_META.staleAfterDays * 86400000);
SCREENER_DB_META.currentness = SCREENER_DB_META.stale ? 'STALE' : 'CURRENT';
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
  'SKYD','PATH','PAYC','PAYX','PBR','PCAR','PDD','PEG','PEP','PFE','PFG','PG',
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
  '키옥시아': '285A.T', 'kioxia': '285A.T', 'kioxia holdings': '285A.T',
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

/* ══════════════════════════════════════════════════════════════════
   v21: 자동 한국어 번역 시스템
   - 뉴스 fetch 완료 후 자동으로 영어 뉴스를 한국어로 번역
   - 공유 GPT-6 Luna API 사용 (뉴스/번역 배치 전용)
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
  var visibleText = String(text).replace(/<[^>]*>/g, '');
  var korean = visibleText.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g);
  return korean && korean.length > visibleText.length * 0.3;
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


// F27: the free machine translation renders finance idioms literally and can flip who affects whom
// ("exposure to X" became "X에 영향을 미치는"). These phrase repairs run on its titles only.
function _aioPolishMachineTitle(ko, en) {
  if (!ko) return ko;
  var out = String(ko)
    .replace(/(실적|수익)\s*통화\s*(기록|녹취록?|사본)/g, '실적 발표 컨퍼런스콜 녹취')
    .replace(/(실적|수익)\s*통화/g, '실적 발표 컨퍼런스콜')
    .replace(/(몸을|물리적으로|신체적으로)\s*토하게/g, '속이 뒤집히게');
  if (/exposure to/i.test(String(en || ''))) out = out.replace(/에\s*가장\s*큰\s*영향을\s*(미치는|주는)/g, '의 영향을 가장 크게 받는').replace(/에\s*영향을\s*(미치는|주는)/g, '의 영향을 받는');
  return out;
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
    macro: '거시', fed: '연준/금리', rates: '금리', bond: '채권', credit: '크레딧', fx: '환율',
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
  var summary = ''; // P1592 (F30): no local template — topic/tone/tickers are already badges; the card falls back to the article's own text
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
    ko_impact: impactParts.join(', '),
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

  // Codex review 2026-10-05: a failed or non-Korean cached translation still needs translation.
  var _hasUsableTranslation = function(i) {
    var cached = _translationCache.get(_tcKey(i.title));
    return !!(cached && !cached._failed && cached.ko_title && isKoreanText(cached.ko_title));
  };
  var needTrans = items.filter(function(i) {
    return i.title && !isKoreanText(i.title) && !_hasUsableTranslation(i);
  });
  var _foreignCount = items.filter(function(i) { return i.title && !isKoreanText(i.title); }).length;
  // 한국어 뉴스 먼저 처리
  items.filter(function(i) {
    return i.title && isKoreanText(i.title) && !_translationCache.has(_tcKey(i.title));
  }).forEach(function(i) {
    var tickers = extractTickers(i).map(function(t) { return '$' + t; });
    var local = _aioBuildNewsLocalKoreanInsight(i, i.title);
    _tcPut(i.title, Object.assign({}, local, { ko_title: i.title, ko_desc: i.desc || local.ko_desc || '', tickers: tickers.length ? tickers : local.tickers }));
  });

  if (needTrans.length === 0) {
    if (statusEl) statusEl.textContent = _foreignCount ? (function(ko) { return ko === _foreignCount ? '해외 기사 ' + _foreignCount + '건 모두 한국어 제목' : '해외 기사 ' + _foreignCount + '건 중 ' + ko + '건 한국어 제목, ' + (_foreignCount - ko) + '건은 원문 제목 그대로'; })(items.filter(function(i) { return i.title && !isKoreanText(i.title) && _hasUsableTranslation(i); }).length) : '한국어 기사만 있어 번역할 항목이 없습니다';
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
      var koTitles = (await _gtBatchTranslate(titles)).map(function(ko, ki) { return _aioPolishMachineTitle(ko, titles[ki]); });
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
  // Codex browser audit H05: "N건 번역 완료" counted API responses, including ones that came back in English.
  // The status counts only foreign headlines whose cached title is actually Korean; the rest stay original.
  var _usableKo = items.filter(function(i) { return i.title && !isKoreanText(i.title) && _hasUsableTranslation(i); }).length;
  var _stillOriginal = Math.max(0, _foreignCount - _usableKo);
  var statusMsg = _usableKo === _foreignCount ? '해외 기사 ' + _foreignCount + '건 모두 한국어 제목' : '해외 기사 ' + _foreignCount + '건 중 ' + _usableKo + '건 한국어 제목';
  if (_stillOriginal > 0) statusMsg += ', <span class="lda-tr-left">' + _stillOriginal + '건은 원문 제목 그대로</span>';
  failed = _stillOriginal;
  statusMsg += ', ';
  // v58.74 (text audit): the "공용 AI 연결 시 해석 추가" button only showed a toast — AI is always on — so it is gone.
  if (statusEl) statusEl.innerHTML = statusMsg.replace(/, $/, '') + (failed > 0 ? ', 네트워크를 확인한 뒤 다시 시도하세요.' : '.');
  if (typeof window._aioSetLastAiError === 'function') window._aioSetLastAiError(failed > 0 ? { status: 503, message: 'translation partial failure' } : { status: 200, message: 'success' }, { source: 'translation' });
  // P4 수정: 번역 완료 후 캐시 저장
  _tcSaveToStorage();
  _aioNotifyNewsSurfaceInvalidated('news-translation-complete');
  renderBriefingFeed(newsCache);
}

/* ── v27.2: 뉴스 fetch 후 자동 번역 + 해석 + 티커 추출 ────────── */
async function autoTranslateNews(items) { (items || []).forEach(function(i) { if (i && i.title && i.titleKo && isKoreanText(i.titleKo) && !_tcHas(i.title)) _tcPut(i.title, Object.assign({}, _aioBuildNewsLocalKoreanInsight(i, i.titleKo), { ko_title: i.titleKo, ko_desc: i.desc || '' })); }); // v57.55 review: a headline translated once in Actions (titleKo) is used as-is — no per-browser AI call or machine translation
  if (_aioBootPhase.translationReady === false) {
    _aioQueueDeferredNewsTranslation(items);
    return;
  }
  const route = typeof _aioEnsureClaudeRoute === 'function' ? await _aioEnsureClaudeRoute('') : { ok: false };
  const _ct = route.target;
  if (!route.ok || !_ct || !_ct.serverKey) {
    await freeTranslateNews(items);
    return;
  }
  if (_translationInProgress) { _aioQueueDeferredNewsTranslation(items); return; }
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
    renderBriefingFeed(newsCache);
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
      if (typeof _aioCreateAIRequestObject !== 'function' && window._aioAIPipelineReady) await window._aioAIPipelineReady; // v59.15: the pipeline module loads after boot
      const _translationRequest = typeof _aioCreateAIRequestObject === 'function'
        ? _aioCreateAIRequestObject('auto-translation', { ctxId: 'news-translation', query: prompt })
        : null;
      if (!_translationRequest || typeof _aioRunAIResponsePipeline !== 'function') throw new Error('AI response pipeline unavailable');
      if (typeof _aioBeginAIRequestAttempt === 'function') _aioBeginAIRequestAttempt(_translationRequest, 'gpt-6-luna');
      const resp = await (typeof _aioFetchClaudeWithRetry === 'function' ? _aioFetchClaudeWithRetry : fetch)(_ct.url, {
        method: 'POST',
        signal: AbortSignal.timeout(45000),
        headers: { 'Content-Type': 'application/json', 'X-AIO-App-Token': (typeof _aioAppToken === 'function' ? _aioAppToken() : ''), 'X-AIO-Idempotency-Key': _translationRequest.requestId },
        body: JSON.stringify({
          model: 'gpt-6-luna',
          max_output_tokens: Math.min(4000, Number(route.health?.ai?.maxTokens) || 4000),
          reasoning: { effort: 'none' }, store: false, stream: false,
          input: [{
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

금융 전문용어 정확히 사용 (rate cut→금리 인하, earnings beat→실적 상회, rally→랠리, selloff→매도세, earnings call→실적 발표 컨퍼런스콜)
원문의 주어와 영향 방향을 그대로 유지 (exposure to X→X의 영향을 받는). 관용구는 직역하지 말고 뜻으로 옮김

JSON 배열로만 반환 (다른 텍스트 없이):
[{"idx":1,"title":"한국어 제목","desc":"한국어 요약","summary":"투자자 관점 해석","section":"AI 및 빅테크","rewrite":"엔비디아 관련 AI 인프라 수요가 다시 부각됐으며 반도체·전력 인프라 밸류체인 반응을 함께 확인해야 합니다.","market":"$NVDA와 $SMH의 가격·거래량 반응이 후속 확인 포인트입니다.","tickers":["$NVDA","$SMH"]}]

${prompt}`
          }]
        })
      }, _ct.serverKey);

      if (resp.ok) {
        const data = await resp.json();
        if (data.status !== 'completed') throw new Error('AI translation incomplete');
        const text = (data.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text || '').join('');
        if (typeof window._aioTrackApiUsage === 'function' && data.usage) window._aioTrackApiUsage({ model: 'gpt-6-luna', inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens });
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
      }
    } catch(e) {
      if (typeof window._aioSetLastAiError === 'function') window._aioSetLastAiError(e, { source: 'translation' });
      _aioLog('warn', 'translate', '번역 API 호출 에러: ' + (e && e.message || e));
    }
    // v57.54: one fallback for an error, a thrown call, or a completed reply that omitted some idx (those were dropped uncached).
    var _failedBatch = batch.filter(orig => !_translationCache.has(_tcKey(orig.title)));
    if (_failedBatch.length) { try { await freeTranslateNews(_failedBatch); } catch(_gtErr) { _failedBatch.forEach(orig => { if (!_translationCache.has(_tcKey(orig.title))) localEnrichSingle(orig); }); } }

    // 배치 간 딜레이 + 중간 렌더링
    if (i + BATCH < needTranslation.length) {
      await new Promise(r => setTimeout(r, 600));
      if (statusEl) statusEl.textContent = `번역·해석 중... (${translated}/${needTranslation.length})`;
      _aioNotifyNewsSurfaceInvalidated('news-translation-progress');
    }
  }

  _translationInProgress = false;
  console.log(`[AIO v30.12] 번역+해석 완료: ${translated}건`);
  _aioReleaseDeferredNewsTranslation(); // P1423: process items queued during an active batch.
  if (statusEl) statusEl.textContent = `✓ ${_translationCache.size}건 번역·해석 완료`;
  if (typeof window._aioSetLastAiError === 'function') window._aioSetLastAiError(translated < needTranslation.length ? { status: 503, message: 'translation partial failure' } : { status: 200, message: 'success' }, { source: 'translation' });

  // v30.12 P4: 번역 완료 후 캐시 저장
  _tcSaveToStorage();

  // 최종 렌더링 업데이트
  _aioNotifyNewsSurfaceInvalidated('news-translation-final');
  renderBriefingFeed(newsCache);
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
// P1504: Google News titles end with " - Source"; the source is printed beside the title already.
function _aioTitleWithoutSource(item, text) {
  var title = String(text != null ? text : (item && item.title) || '');
  var src = String(item && item.source || '').trim();
  return src && title.slice(-(src.length + 3)) === ' - ' + src ? title.slice(0, -(src.length + 3)).trim() : title;
}
window._aioTitleWithoutSource = _aioTitleWithoutSource;
function getDisplayTitle(item) {
  item = item || {};
  if (_translationCache.has(_tcKey(item.title))) {
    var cached = _translationCache.get(_tcKey(item.title));
    // P1391: no translation → the original headline, never a generated '매크로 · Reuters 기사 · 중요도 48' line
    if (cached._failed || !cached.ko_title || !isKoreanText(cached.ko_title)) return _aioTitleWithoutSource(item);
    return _aioTitleWithoutSource(item, cached.ko_title);
  }
  if (item.ko_title && isKoreanText(item.ko_title)) return _aioTitleWithoutSource(item, item.ko_title);
  // P1391 (owner review 2026-10-02): an untranslated foreign headline is shown as written; the
  // generated category sentence (v51.81) carried no information and hid the actual story.
  return _aioTitleWithoutSource(item);
}
// Codex browser audit H05: Google News descriptions repeat the headline (plus the outlet), so the card showed
// the same English sentence twice. A description that only repeats the title is not a summary.
function _aioDescRepeatsTitle(item, text) {
  var norm = function(v) { return String(v || '').replace(/<[^>]*>/g, ' ').toLowerCase().replace(/[^a-z0-9가-힣]/g, ''); };
  var t = norm(item && item.title);
  var d = norm(text);
  return !!t && !!d && (d === t || (d.indexOf(t.slice(0, 40)) === 0 && d.length <= t.length + 40));
}
/* v27.2: 투자자 관점 해석 반환 — v27.4: 폴백 추가 */
function getDisplaySummary(item) {
  // P1428 (Codex review): only a real translation or the article's own description — the local template
  // ("○○ 뉴스입니다. 헤드라인 기준 톤은…") repeated the same generic sentence on every card.
  const cachedSummary = item && item.title ? _translationCache.get(_tcKey(item.title)) : null;
  if (cachedSummary && !cachedSummary._failed && cachedSummary.ko_summary && !/뉴스입니다\. 헤드라인 기준 톤은/.test(cachedSummary.ko_summary)) return cachedSummary.ko_summary; // P1592: older caches stored the template
  // 폴백: 번역 완료 전이라도 빈 문자열 대신 원문 설명 축약 표시
  const desc = item.desc || item.description || '';
  if (_aioDescRepeatsTitle(item, desc)) return '';
  if (desc.length > 0) {
    const clean = desc.replace(/<[^>]*>/g, '').trim();
    return clean.length > 120 ? clean.slice(0, 117) + '…' : clean;
  }
  return '';
}
window._aioBuildNewsLocalKoreanInsight = _aioBuildNewsLocalKoreanInsight;
window._aioGetNewsTranslation = _aioGetNewsTranslation;
window.AIO = window.AIO || {};
// v58.20: AIO.getNewsTranslationQualityAudit had no product caller — news cards call _aioGetNewsTranslation directly.
// Primary macro/geo/rates stories describe market conditions rather than a
// single issuable security. Suppressing inferred ticker badges on these rows
// prevents an ETF/company mention from being presented as an actionable entity
// link in the native and legacy news surfaces alike.
var _AIO_NEWS_TICKER_SUPPRESS_TOPICS = new Set([
  'macro','geopolitics','policy','fed','rates','trade','geo','bond','credit','fx','fxbond'
]);
function _aioSuppressNewsTickers(item) {
  return _AIO_NEWS_TICKER_SUPPRESS_TOPICS.has(String(item?.topic || '').trim().toLowerCase());
}

/* v27.2: 캐시된 티커 ($ 포함) 반환 — v27.4: 빈 배열 캐시 충돌 수정 */
function getDisplayTickers(item) {
  if (_aioSuppressNewsTickers(item)) return [];
  // v27.4 근본 개편: API 결과 + 로컬 추출을 항상 합침 (풀리지 않는 구조)
  const merged = new Set();

  // 1) API 번역 캐시에서 가져온 티커
  if (_translationCache.has(_tcKey(item.title))) {
    const t = _translationCache.get(_tcKey(item.title)).tickers;
    // P1592 (F26): translated/API tickers pass the same title/acronym gate as local extraction.
    const text = (item.title || '') + ' ' + (item.desc || '');
    if (Array.isArray(t)) t.forEach(tk => {
      const bare = String(tk || '').replace(/^\$/, '');
      if (!bare) return;
      if ((_TICKER_ROLE_ACRONYM.test(bare) || _TICKER_WORD_OVERLAP.has(bare)) && !text.includes('$' + bare) && !text.includes('(' + bare + ')')) return;
      merged.add(tk);
    });
  }

  // 2) 로컬 추출 — 항상 실행 (캐시 유무와 무관)
  const local = extractTickers(item);
  local.forEach(s => {
    const tk = s.startsWith('$') ? s : '$' + s;
    merged.add(tk);
  });

  // 캐시 업데이트 (로컬 추출로 보강된 결과 반영)
  const result = window._aioNewsStories ? window._aioNewsStories.issuers(item, [...merged]).map(s => '$' + s).slice(0, 5) : [];
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
// P1592 (F26): officer titles are also listed symbols ('Former FTX COO' opened CooperCompanies). A C?O
// title or common agency acronym counts only as $TICKER or (TICKER), never as a bare word.
const _TICKER_ROLE_ACRONYM = /^(?:C[A-Z]O|EVP|SVP|VP|GM|IPO|ETF|SEC|FDA|DOJ|FTC|NIH|EPA|ECB|IMF|GDP|CPI)$/;
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

function _aioNewsNameIsAttribution(lowerText, name) { if (!/[a-z]/.test(name) || name.length < 4) return false; var n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return new RegExp('(?:according to|says|said|by|from|at|via|per)\\s+' + n + '|' + n + "(?:'s)?\\s+(?:analysts?|strategists?|economists?|says|said|note|notes|sees|expects|upgrades?|downgrades?|raises|cuts|rates|initiates|reiterates)").test(lowerText); } // P1428: a broker cited as the source of a view ("..., Morgan Stanley says") is not the story's subject
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
      // Every escaped ticker regex requires this literal substring. Reject
      // absent symbols before touching the bounded regex LRU (universe > cache).
      if (!text.includes(ticker)) return;
      // 1~2자 티커(A, F, V, C, U 등)는 $접두사 없으면 건너뜀
      if (ticker.length <= 2 && !text.includes('$' + ticker)) return;
      // v39.2: 영단어와 완전히 겹치는 티커 — $접두사 또는 (TICKER) 형태만 허용
      if (_TICKER_WORD_OVERLAP.has(ticker) || _TICKER_ROLE_ACRONYM.test(ticker)) {
        if (!text.includes('$' + ticker) && !text.includes('(' + ticker + ')')) return;
      }
      var re = _getTickerRegex(ticker);
      if (re.test(text) && _isTickerContextValid(ticker, text)) {
        found.add(ticker);
      }
    });
  }

  // 3) 한국어 기업명·키워드 / 영문 별칭 → 티커 매핑
  // P1550: 한글 별칭이 1~2음절이면 앞이 한글이 아니고 뒤가 한글이 아니거나 조사일 때만 인정한다('모델'의 '델'은 DELL이 아니다).
  function _aioKrAliasInText(lowerText, alias) {
    if (lowerText.indexOf(alias) < 0) return false;
    if (alias.length >= 3 || !/^[가-힣]+$/.test(alias)) return true;
    var esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(?:^|[^가-힣])' + esc + '(?:$|[^가-힣]|(?:은|는|이|가|을|를|의|도|와|과|에|로|만)(?:$|[^가-힣]))').test(lowerText);
  }
  // P1449/R17: 영문 별칭은 단어 경계를 지킨다. plain includes는 "Artificial Intelligence"에서
  // INTC(intel), "downside"에서 DIA(dow) 같은 부분 문자열 오판을 만들었다. 한글 별칭은 JS \b가
  // 비ASCII 단어 경계를 인식하지 못하므로 기존 includes를 쓴다(한글 하위 문자열 오판은 관측된 급사 없음).
  if (typeof KR_TICKER_MAP !== 'undefined' && found.size < 5) {
    var lowerText = text.toLowerCase();
    for (var krName in KR_TICKER_MAP) {
      if (!KR_TICKER_MAP.hasOwnProperty(krName) || found.size >= 5) break;
      var aliasLower = String(krName).toLowerCase();
      if (/[^a-z0-9]/.test(aliasLower)) {
        // 한글 별칭 — JS \b가 비ASCII 경계를 인식하지 못해 기존 includes 유지.
        if (_aioKrAliasInText(lowerText, aliasLower) && !_aioNewsNameIsAttribution(lowerText, aliasLower)) found.add(KR_TICKER_MAP[krName]);
        continue;
      }
      if (!lowerText.includes(aliasLower)) continue;
      var aliasPattern = _getTickerRegex(aliasLower.replace(/[.*+?^${}()|[\]\\]/g, '$&'));
      if (aliasLower.length <= 2 || !aliasPattern.test(lowerText)) continue;
      if (_aioNewsNameIsAttribution(lowerText, aliasLower)) continue;
      found.add(KR_TICKER_MAP[krName]);
    }
  }

  return Array.from(found);
}

/* ── v21: 절대 시간 포맷 (HH:MM) ──────────────────────────────── */
window._aioNewsLoadMore = function() {
  window._aioNewsVisibleLimit = (window._aioNewsVisibleLimit || 12) + 12;
  _aioNotifyNewsSurfaceInvalidated('news-load-more');
};

/* ── HOME_WEEKLY_NEWS: retained for _aioGetCurrentHomeWeeklyNews readers (v57.76: the home news list itself is retired) ── */
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

// X20 (2026-10-13): which observations the AI narrative actually cites, in each market's own clock (v59.34~:
// src/data/server-data-loader.js passes _aioMarketAnalysisScope as describeScope) —
// "생성 10/12 20:16 KST · S&P 500·미 10년물 10/9 종가 · WTI·달러지수 10/12 20:06 KST 장중 · 코스피 10/12 종가".
function _aioMarketAnalysisScope(analysis, generatedAt) {
  try {
    var names = { 'market.spx': 'S&P 500', 'market.vix': 'VIX', 'market.us10y': '미 10년물', 'market.dxy': '달러지수', 'market.wti': 'WTI', 'market.gold': '금', 'market.kospi': '코스피', 'market.kosdaq': '코스닥', 'market.nasdaq': '나스닥' };
    var text = String(analysis && analysis.full || '');
    var part = function(date, tz, withTime) {
      var o = { timeZone: tz, month: 'numeric', day: 'numeric' };
      if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; o.hourCycle = 'h23'; }
      var p = {};
      new Intl.DateTimeFormat('en-US', o).formatToParts(date).forEach(function(x) { p[x.type] = x.value; });
      return p.month + '/' + p.day + (withTime ? ' ' + p.hour + ':' + p.minute : '');
    };
    var groups = [];
    var byKey = {};
    (Array.isArray(analysis && analysis.metricEvidence) ? analysis.metricEvidence : []).forEach(function(row) {
      if (!row || !names[row.metricId] || !row.asOf) return;
      var shortId = String(row.evidenceId || '').split(':').pop();
      if (shortId && text.indexOf(shortId) < 0) return;
      var at = new Date(row.asOf);
      if (isNaN(at.getTime())) return;
      var sess = row.session || row.basis, kr = /kospi|kosdaq/.test(row.metricId), nyH = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' }).format(at));
      var key = sess === 'DELAYED_IN_SESSION' ? part(at, 'Asia/Seoul', true) + ' KST 장중' // v57.54: a US pre-open/after-hours print (e.g. 09:05 ET) is not a close
        : (!kr && (sess === 'AFTER_HOURS' || sess === 'PRE_MARKET' || (sess !== 'MARKET_CLOSED' && nyH < 16))) ? part(at, 'Asia/Seoul', true) + ' KST 장외 시세' /* v58.74: the 10-year closes at 15:00 ET; a MARKET_CLOSED read is its close */ : part(at, kr ? 'Asia/Seoul' : 'America/New_York', false) + ' 종가';
      if (!byKey[key]) { byKey[key] = []; groups.push(key); }
      byKey[key].push(names[row.metricId]);
    });
    var gen = generatedAt ? new Date(generatedAt) : null;
    var head = gen && !isNaN(gen.getTime()) ? '생성 ' + part(gen, 'Asia/Seoul', true) + ' KST' : '';
    return [head].concat(groups.map(function(key) { return byKey[key].join('·') + ' ' + key; })).filter(Boolean).join(', ');
  } catch (_) { return ''; }
}

// src/ui/pages/news.js reads these two by name from window; this export is now their only runtime reference.
window.getTimeAgo = getTimeAgo;
window.getDisplaySummary = getDisplaySummary;

/* ── renderBriefingFeed(): 브리핑 뉴스 (24시간) ───────────── */
// v42.0: 브리핑 8AM KST 앵커 — 오전 8시 기준 24시간 윈도우
// v59.42: _getBriefingWindowKST is installed by src/app/news-selection-entry-points.js (over scoring.js briefingWindowKST).


window.renderBriefingFeed = function(items) {
  // P770: primary briefing DOM belongs to src/ui/pages/news.js; this legacy call is input-only.
  if (typeof _aioNotifyNewsSurfaceInvalidated === "function") _aioNotifyNewsSurfaceInvalidated("briefing-feed-input");
  return { status: "delegated-to-native-briefing", count: Array.isArray(items) ? items.length : 0 };
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

// v59.41: computeNewsSentimentScore/computeNewsRiskSignals (wrappers over src/domain/news/scoring.js) moved to src/app/score-entry-points.js.

// ── 상태 ────────────────────────────────────────────────────────
let newsCache = [];
let lastFetchTime = 0;
let isFetching = false;
let _fetchStartTime = 0; // v29.3: isFetching 잠김 방지용 타임스탬프

window.AIO = window.AIO || {};
function _aioNotifyNewsSurfaceInvalidated(reason) {
  try {
    const target = typeof document !== 'undefined' ? document : window;
    target.dispatchEvent(new CustomEvent('aio:newsSurfaceInvalidated', { detail: { reason: reason || 'news-input-changed' } }));
  } catch (_) {}
}
window._aioNotifyNewsSurfaceInvalidated = _aioNotifyNewsSurfaceInvalidated;
// v58.93: the progress line/bar is painted by src/ui/components/news-progress.js; the last step is kept for its install.
function _aioNewsProgress(state) {
  window._aioNewsProgressState = state;
  if (typeof window._aioRenderNewsProgress === 'function') window._aioRenderNewsProgress(state);
}
// v58.92: window.AIO.getNewsSurfaceControls and the chip/sort handlers are installed by src/app/compatibility-globals.js.
window._aioNewsCacheSize = function() { return newsCache.length; };
window.AIO.getTelegramPageCoverageAudit = function() {
  var digest = window.AIO_TELEGRAM_WEEKLY_DIGEST || {};
  var pageMap = digest.pageMap || {};
  var items = Array.isArray(digest.rawCurrent24hItems) ? digest.rawCurrent24hItems : [];
  var digestAgeHours = digest.asOf ? (Date.now() - new Date(digest.asOf).getTime()) / 3600000 : Infinity;
  var currentWindow = digest.current24hWindow || null;
  var required = Array.isArray(window.AIO_ALL_ROUTE_PAGE_IDS) && window.AIO_ALL_ROUTE_PAGE_IDS.length
    ? window.AIO_ALL_ROUTE_PAGE_IDS.slice()
    : ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','fundamental','themes','theme-detail','portfolio','ticker','market-news','screener','principles','masters','atlas','guide'];
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

// ── RSS 파싱 ─────────────────────────────────────────────────────

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
  const _hasCfWorker = !!_cfWorkerUrl();

  // CF Worker 없을 때만 rss2json 시도 (또는 CF Worker 실패 시 폴백)
  // v48.9: 공유 키 쿼터 사전 체크 (10000/day 도달 시 스킵)
  async function rss2jsonFallback() {
  if (_rss2jsonFailed < 2 && !(typeof _isQuotaExceeded === 'function' && _isQuotaExceeded('rss2json'))) {
    try {
      const r2jUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(source.url);
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
  return null;
  }
  if (!_hasCfWorker) {
    const rssItems = await rss2jsonFallback();
    if (rssItems && rssItems.length) return rssItems;
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

  try {
    const raw = await fetchViaProxy(source.url, { parseText:true, timeout:4000, totalTimeout:10000,
      accept: function(body) { return parseXml(body).length > 0; } });
    const items = parseXml(raw);
    if (items.length) { _rssMarkOk(source.name); return items; }
  } catch (_) {}
  if (_hasCfWorker) {
    const rssItems = await rss2jsonFallback();
    if (rssItems && rssItems.length) return rssItems;
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

// v59.29: isTelegramMsgRelevant and fetchTelegramDirect moved to src/data/providers/telegram-direct.js.

// P1756: data.json's news bundle counts as fresh for two hours after the artifact was generated (hourly producer).
function _aioServerNewsFresh() {
  var bundle = window._serverNewsBackstop;
  var meta = window._serverDataMeta || {};
  if (!Array.isArray(bundle) || !bundle.length || !meta.generatedAt) return false;
  var age = Date.now() - Date.parse(meta.generatedAt);
  return isFinite(age) && age > -300000 && age < 7200000;
}

async function fetchAllNews(forceRefresh = false) {
  // v39.0: isFetching 안전장치 — 180초로 확장 (80소스 x 1.5초 딜레이 + 프록시 타임아웃 고려)
  if (isFetching && _fetchStartTime && Date.now() - _fetchStartTime > 180000) {
    _aioLog('warn', 'fetch', 'fetchAllNews isFetching 180s 초과 — 강제 리셋');
    isFetching = false;
    _aioNotifyNewsSurfaceInvalidated('news-fetch-timeout');
  }
  if (isFetching) return;
  // P1756: while the server news bundle is fresh the browser RSS run is skipped. The news screens render that bundle
  // whenever the run returns nothing, and in production it always did: the shared Worker refuses every feed host and
  // the public relays abort, so a run was ~300 failed requests for an identical screen.
  var _serverNewsFresh = _aioServerNewsFresh();
  if (_serverNewsFresh) {
    if (!newsCache.length || forceRefresh) _aioApplyNewsBackstop(!!forceRefresh); if (forceRefresh && typeof showToast === 'function') showToast('뉴스는 서버가 ' + Math.max(1, Math.round((Date.now() - Date.parse((window._serverDataMeta || {}).generatedAt)) / 60000)) + '분 전에 모은 최신본입니다', 'info'); // v57.54: a forced refresh says why nothing new arrived
    return;
  }
  // v21: 캐시 유효 시간 10분 (5명 동시접속 시 불필요한 중복 호출 방지)
  if (!forceRefresh && Date.now() - lastFetchTime < 600000) {
    if (newsCache.length) {
      _aioNotifyNewsSurfaceInvalidated('news-cache-reuse');
      renderBriefingFeed(newsCache);
    }
    _aioNewsProgress({ phase: 'cached' });
    return;
  }

  isFetching = true;
  _fetchStartTime = Date.now(); // v29.3: 잠김 방지 타임스탬프
  // v27.3: 새로고침 시 번역 캐시 클리어 (오래된 캐시가 새 뉴스에 잘못 매핑되는 것 방지)
  if (forceRefresh) {
    _translationCache.clear();
    try { localStorage.removeItem('aio_tc'); } catch(e) {}
    // v46.6: 소스 헬스 리셋 — 3회 실패로 스킵된 소스에 재시도 기회
    Object.keys(_rssSourceHealth).forEach(function(k) { _rssSourceHealth[k] = { fails: 0, lastOk: 0 }; });
    _rss2jsonFailed = 0;
  }
  // v58.93: the hidden #live-dot/#live-btn-label writers left with their nodes.
  _aioNewsProgress({ phase: 'start' });
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
    _aioNewsProgress({ phase: 'step', done: done, total: total, elapsedMs: Date.now() - _fetchStartTime });
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
                          // Telegram markup may omit datetime. Preserve the
                          // omission so current-window consumers exclude it.
                          pubDate: dateEl ? dateEl.getAttribute('datetime') : null,
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

    // v58.94: the v46.6 early briefing render left — renderBriefingFeed only repaints the native briefing from the
    // current cache, so the partial batch it scored was never shown.

    // v46.6: 배치 딜레이 1500→1000ms (프록시 타임아웃 단축과 함께 전체 속도 30%↑)
    if (i + BATCH_SIZE < activeSources.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  let allItems = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  // P1601: retain distinct articles and every changed version; no prefix/wordbag inference.
  const seen = new Set();
  allItems = allItems.filter(i => {
    if (!i.title || i.title.length < 10) return false;
    const key = _aioNewsDedupeKey(i);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 스코어링 + 토픽 분류 (v21: 기본 최신순 정렬)
  allItems = allItems
    .map(i => { const scored = { ...i }; scored.score = scoreItem(scored); scored.topic = classifyTopic(scored); scored.flag = scored.flag || getCountryFlag(scored.country); return scored; })
    .filter(i => !i._blacklisted)  // v27.4: 블랙리스트 뉴스 완전 제거
    // Codex browser audit H04: the same floor as the server (P1504) — a headline that matches no market topic
    // ('general') is not market news, whichever feed returned it. Fewer honest items beat filled slots.
    .filter(i => i.topic !== 'general' || i._serverKrSlot)
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
                   source: n.source || 'Google News', pubDate: n.pubDate || null,
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

  _aioNewsProgress({ phase: 'done', count: filteredItems.length, removed: removedCount });
  const ftEl = document.getElementById('last-fetch-time');
  if (ftEl) ftEl.textContent = new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
  // 스테일 배너 (RSS 성공 시 항상 신선; v57.77: the absent #news-cache-ts stamp writer is retired)
  var _newsStaleBanner = document.getElementById('news-stale-banner');
  if (_newsStaleBanner) _newsStaleBanner.style.display = 'none';
  // v58.93: the hidden #news-sources-label writer left with its node.

  _aioNotifyNewsSurfaceInvalidated('news-fetch-complete');
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
      try {
        var _savedNsh = JSON.parse(localStorage.getItem('aio_news_sent_hist') || '[]');
        if (Array.isArray(_savedNsh) && _savedNsh.length) window._newsSentimentHistory = _savedNsh.slice(-24);
      } catch (_nshR) {}
    }
    // P1285/R635: old localStorage points predate the sample contract, so their
    // scores cannot be revalidated and are discarded before any chart can read them.
    var _minNewsSample = Number(window.AIO_ARCH && window.AIO_ARCH.MIN_NEWS_ANALYSIS_SAMPLE) || 5;
    var _normalizeNewsHistory = typeof window._aioNormalizeNewsSentimentHistory === 'function'
      ? window._aioNormalizeNewsSentimentHistory : function() { return []; }; // P1338: native owner, exposed by bootstrap
    var _nsh = _normalizeNewsHistory(window._newsSentimentHistory);
    window._newsSentimentHistory = _nsh;
    // 히스토리 부족 시 뉴스 캐시(24h)를 3시간 버킷으로 즉시 시딩 — 빈 차트 방지
    if (_nsh.length < 3 && typeof newsCache !== 'undefined' && newsCache && newsCache.length >= 6 && typeof getSentimentFromText === 'function') {
      try {
        var _nowMs = Date.now(), _seedNsh = [];
        for (var _bk = 11; _bk >= 0; _bk--) {   // 1시간 버킷 × 12 (뉴스가 최근 몇 시간에 몰려도 다포인트 확보)
          var _hi = _nowMs - _bk * 3600000, _lo = _hi - 3600000;
          var _bkItems = newsCache.filter(function(it) { if (!it.pubDate) return false; var t = new Date(it.pubDate).getTime(); return t > _lo && t <= _hi; });
          if (_bkItems.length < 2) continue;
          var _bucketScore = computeNewsSentimentScore(_bkItems);
          if (!_bucketScore || _bucketScore.sampleSufficient !== true || Number(_bucketScore.total) < _minNewsSample || _bucketScore.score == null) continue; // P1284/R633: only a sufficient eligible sample can seed a point.
          _seedNsh.push({ time: new Date(_hi).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }), score: _bucketScore.score, bull: _bucketScore.bullCount, bear: _bucketScore.bearCount, eligibleCount: _bucketScore.total, sampleSufficient: true, modelVersion: _bucketScore.modelVersion });
        }
        if (_seedNsh.length >= 2) { _nsh = _normalizeNewsHistory(_seedNsh); window._newsSentimentHistory = _nsh; }
      } catch (_seedErr) {}
    }
    var _nsTime = new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
    if (ns && ns.sampleSufficient === true && Number(ns.total) >= _minNewsSample && ns.score != null && Number.isFinite(Number(ns.score))) {
      _nsh.push({ time: _nsTime, score: Number(ns.score), bull: ns.bullCount, bear: ns.bearCount, eligibleCount: Number(ns.total), sampleSufficient: true, modelVersion: ns.modelVersion });
    }
    _nsh = _normalizeNewsHistory(_nsh); // drops pre-contract points and caps the chart history at 24.
    window._newsSentimentHistory = _nsh;
    try { localStorage.setItem('aio_news_sent_hist', JSON.stringify(_nsh.slice(-24))); } catch (_nshW) {}
    // v57.60: retired news-sent-live-* / news-sentiment-chart writers removed (nodes no longer exist); _nsh history above is still persisted.

  } catch(e) { _aioLog('warn', 'render', 'News sentiment bar error: ' + (e && e.message || e)); }

  // v27.2: 뉴스 0건이면 진행 라벨에 안내 메시지 표시 (v57.76: the retired home news list message is gone)
  if (allItems.length === 0) {
    _aioNewsProgress({ phase: 'empty' });
  }
  } catch(fetchErr) {
    _aioLog('error', 'fetch', 'fetchAllNews 치명적 에러: ' + (fetchErr && fetchErr.message || fetchErr));
    _aioNewsProgress({ phase: 'error' });
    _aioNotifyNewsSurfaceInvalidated('news-fetch-error');
  } finally {
    isFetching = false; // v27.3: 어떤 에러가 나도 반드시 잠금 해제
  }
}

// v57.76: the 60s home news loading-timeout writer was deleted with #home-news-highlights.

// ── 라이브 시세 엔진 ─────────────────────────────────────────────
const LIVE_SYMBOLS = [
  // ── 주요 지수 ──────────────────────────────────────────────────
  '^GSPC','^IXIC','^NDX','^VIX','^VVIX','^RUT','^DJI','^FTSE','^N225','^HSI',
  'ES=F','NQ=F','YM=F','RTY=F','VXX',
  // ── 한국 지수 ──────────────────────────────────────────────────
  '^KS11','^KQ11',
  '091160.KS','305720.KS','091220.KS','244580.KS',
  // ── 한국 KR_SUB_THEMES 전수 커버 (.KS = KOSPI, .KQ = KOSDAQ 정식 분리) ──
  // 반도체/HBM — KOSPI 2 + KOSDAQ 6 + KOSPI 1
  '005930.KS','000660.KS',                                     // 삼성전자·SK하이닉스 (KOSPI)
  '042700.KS','403870.KQ','058470.KQ','357780.KQ','240810.KQ','039030.KQ','272290.KQ',  // 반도체 소부장 (KOSDAQ)
  // 로봇/자동화 — 두산로보틱스(KOSPI) + 현대로템(KOSPI) + KOSDAQ 4
  '454910.KS','064350.KS',
  '277810.KQ','108490.KQ','090360.KQ','388720.KQ','090710.KQ',
  // AI/SW — KOSPI 4 + KOSDAQ 2
  '035420.KS','018260.KS','035720.KS',
  '030520.KQ','304100.KQ',
  // 의료기기/AI진단 — 전원 KOSDAQ
  '214150.KQ','328130.KQ','338220.KQ','322510.KQ','049950.KQ','145720.KQ',
  // 조선/해양 — 전원 KOSPI
  '009540.KS','010140.KS','329180.KS','042660.KS',
  // 전력기기/변압기 — KOSPI 5 + KOSDAQ 1(제룡전기)
  '298040.KS','267260.KS','010120.KS','062040.KS','103590.KS',
  '033100.KQ',
  // 원전/SMR — KOSPI 2 + KOSDAQ 3
  '034020.KS','052690.KS',
  '006910.KQ','032820.KQ','083650.KQ',
  // K-뷰티 — KOSPI 3 + KOSDAQ 3
  '090430.KS','192820.KS','051900.KS',
  '278470.KS','257720.KQ','237880.KQ',
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
  'TTWO','DECK','CELH','ONON',                                  // Gaming/Consumer
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
  'NFLX','DIS','SPOT','ROKU','SKYD',                           // Streaming (WBD acquired 10/6; PSKY now SKYD)
  'META','GOOGL','TTD','APP','SNAP','PINS','RDDT',             // Social ad
  'TTWO','RBLX','NTDOY',                                        // Gaming (DKNG은 sports_betting; EA went private 8/4)
  'DKNG','FLUT','MGM','PENN','CZR','WYNN',                      // Sports Betting/Casino
  'VLO','MPC','PSX','DINO','DK',                                // Oil Refining
  'T','VZ','TMUS',                                              // Telecom
  'EQIX','DLR','AMT','CCI','SBAC',                             // REITs
  'AEM','NEM','B','WPM','FNV','GFI','KGC',                    // Gold mining (Barrick = B)
  'FCX','LIN','APD','AA','MP','LAC','ALB','CTVA','ADM',        // Materials
  // ── v48.53: Themes/SUB_THEMES 전수 커버리지 누락 13종 보충 ──
  'ROBO','WCLD','BUG','VIG','DGRO','SCHD',                    // 테마 ETF (aio-explain 언급)
  'ACLS','AVAV','CRAK','ENTG','GEV','KTOS','UCTT'             // SUB_THEMES 개별 종목 (반도체 장비/방산/정유/전력)
];
// v49.49 P319/R101 buf fix: LIVE_SYMBOLS를 window.LIVE_SYMBOLS로 노출 — R101 getLiveSymbolsCoverageAudit이 const top-level 변수에 접근 못해 R101_total: 0 보고 (false positive 131 미등록). top-level const는 module scope이므로 window property 아님 — 명시 노출.
window.LIVE_SYMBOLS = LIVE_SYMBOLS;

// v59.28: fetchKrNaverQuotes and fetchKrDailyCandles moved to src/data/providers/naver-kr.js.

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

function _aioPlanQuoteGroups(requestedSymbols, coreSymbols) {
  const symbols = Array.from(new Set([].concat(requestedSymbols || [], coreSymbols || [])
    .map(function(symbol) { return String(symbol || '').trim().toUpperCase(); })
    .filter(function(symbol) { return /^[A-Z0-9^][A-Z0-9.^=\-]{0,19}$/.test(symbol); })));
  const groups = [];
  for (let i = 0; i < symbols.length; i += 5) groups.push(symbols.slice(i, i + 5));
  return groups;
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
  if (Date.now() - (window._aioCryptoQuoteAt || 0) > 300000) try { window._aioCryptoQuoteAt = Date.now(); // v58.80 (first-users): crypto once per 5 min, not on every screen's quote request
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
            _source: 'live:coingecko', sourceKind: 'T3_PUBLIC_DELAYED', allowedUse: 'reference-only', allowedUseCeiling: 'reference', rightsId: 'PUBLIC_REFERENCE', qualityStatus: 'CURRENT', quality: { status: 'CURRENT', stale: false, decisionUse: false, allowedUse: 'reference' },
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
    const cfW = _cfWorkerUrl();
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
      console.log('[AIO] CoinGecko /global: BTC ' + (window._cgGlobal.btcDominance||0).toFixed(1) + '% 도미넌스, 시총 $' + ((window._cgGlobal.totalMarketCapUSD||0)/1e12).toFixed(2) + 'T');
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

  // v30.11: 환율 API 결과를 처리하는 공통 함수
  function _processFxRates(rates, codeMapFn, apiName, observedAt) {
    const fxQuotes = [];
    for (const [code, sym] of Object.entries(fxMap)) {
      const rawRate = codeMapFn(code);
      if (rawRate == null || rawRate <= 0) continue;
      let price = rawRate;
      if (FX_INVERTED.includes(sym)) price = 1 / price;
      // NaN/극단값 방어
      if (isNaN(price) || price <= 0 || price > 1e6) continue;
      fxQuotes.push({
        symbol: sym,
        regularMarketPrice: price,
        regularMarketChangePercent: null,
        regularMarketChange: null,
        observedAt: observedAt || null,
        valueBasis: 'daily-reference-rate',
        changeBasis: 'unavailable',
        _source: 'reference:fx:' + apiName, sourceKind: 'T4_REFERENCE', allowedUse: 'reference-only', allowedUseCeiling: 'reference', rightsId: 'PUBLIC_REFERENCE', qualityStatus: 'CURRENT', quality: { status: 'CURRENT', stale: false, decisionUse: false, allowedUse: 'reference' }
      });
    }
    // A previous browser visit is not the prior market close. This source has
    // no comparable previous-session observation, so it supplies a level only.
    return fxQuotes;
  }

  let fxLoaded = false;
  // API 1: open.er-api.com
  if (!fxLoaded) try {
    const r = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD', {}, 5000);
    if (r.ok) {
      const d = await r.json();
      if (d.result === 'success' && d.rates) {
        const fxQuotes = _processFxRates(d.rates, code => d.rates[code], 'open.er-api', d.time_last_update_unix);
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
        const fxQuotes = _processFxRates(d.rates, code => d.rates[code], 'exchangerate-api', d.time_last_updated || d.date);
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
        const fxQuotes = _processFxRates(d.usd, code => d.usd[codeMap[code]], 'fawazahmed0', d.date);
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
    const naverQuotes = await fetchKrNaverQuotes(_requestedQuoteSyms);
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
  // The scheduler/request owns scope. Do not download the historical 500+
  // ticker catalogue on every refresh; the screener has its durable artifact.
  const PRIORITY_SYMS = _aioPlanQuoteGroups(_requestedQuoteSyms,
    (window.AIO && window.AIO.CORE_LIVE_SYMBOLS) ||
    ['^GSPC','^IXIC','^VIX','^SKEW','CL=F','GC=F','KRW=X','DX-Y.NYB','^KS11','^KQ11']);

  // Yahoo Finance Chart API — crumb 불필요, 단일 심볼
  // corsproxy.io가 가장 안정적 (무료, CORS 없이)
  const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
  const CHART_PARAMS = '?interval=1d&range=1d&includePrePost=true';

  // P1758: one quote poll = one Yahoo spark request per 20 symbols through the Worker. v7/finance/quote answered 401
  // (crumb required) on every cycle, so each symbol fell to its own chart request. spark's per-symbol meta is the same
  // object the v8 chart returns, so both paths share one mapper; per-symbol chart requests remain only for misses.
  const _yfBatch = {};
  function _yfQuoteFromMeta(symbol, meta, transport) {
    const price = meta.regularMarketPrice;
    // previousClose is the prior session; chartPreviousClose may be range-start.
    const previous = meta.previousClose ?? meta.chartPreviousClose ?? null;
    const pct = meta.regularMarketChangePercent ?? (previous > 0 ? (price - previous) / previous * 100 : null);
    const change = meta.regularMarketChange ?? (previous > 0 ? price - previous : null);
    const state = String(meta.marketState || '').toUpperCase();
    let extended = {};
    if (state === 'PRE' && meta.preMarketPrice > 0) extended = { extPrice:meta.preMarketPrice, extPct:meta.preMarketChangePercent ?? null, extSession:'pre' };
    if ((state === 'POST' || state === 'POSTPOST') && meta.postMarketPrice > 0) extended = { extPrice:meta.postMarketPrice, extPct:meta.postMarketChangePercent ?? null, extSession:'post' };
    return { ...meta, symbol, ...extended, regularMarketChangePercent:pct, regularMarketChange:change,
      chartPreviousClose:previous, _source:'live:yahoo-proxy', sourceKind:'T3_PUBLIC_DELAYED', allowedUse:'reference-only', allowedUseCeiling:'reference', rightsId:'PUBLIC_REFERENCE', qualityStatus:'CURRENT', quality:{ status:'CURRENT', stale:false, decisionUse:false, allowedUse:'reference' }, _transport:transport };
  }
  async function _yfBatchFetch(syms) {
    const chunks = [];
    for (let i = 0; i < (syms || []).length; i += 20) chunks.push(syms.slice(i, i + 20));
    await Promise.allSettled(chunks.map(async function(chunk) {
      const sUrl = 'https://query1.finance.yahoo.com/v7/finance/spark?symbols=' + chunk.map(encodeURIComponent).join(',') + '&range=1d&interval=1d';
      try {
        const d = await fetchViaProxy(sUrl, { parseJson:true, timeout:6000, totalTimeout:12000, accept: function(p) { return Array.isArray(p?.spark?.result); } });
        d.spark.result.forEach(function(row) {
          const meta = row?.response?.[0]?.meta, sym = String(row?.symbol || '').toUpperCase();
          if (meta && chunk.includes(sym) && String(meta.symbol || '').toUpperCase() === sym && _validatePrice(sym, meta.regularMarketPrice)) _yfBatch[sym] = _yfQuoteFromMeta(sym, meta, d._aioTransport);
        });
      } catch(e) { _aioLog('warn', 'fetch', 'Yahoo spark batch chunk error: ' + e.message); }
    }));
    if (Object.keys(_yfBatch).length > 0) console.log('[AIO] Yahoo spark 배치: ' + Object.keys(_yfBatch).length + '/' + syms.length + '개 수신 (' + chunks.length + '청크)');
  }

  async function fetchYFChart(symbol) {
    // v47.12: 배치 캐시 우선 조회 — 진입부에서 이미 수신된 심볼이면 개별 호출 스킵
    if (_yfBatch[symbol]) return _yfBatch[symbol];
    const url = CHART_BASE + encodeURIComponent(symbol) + CHART_PARAMS;
    try {
      const raw = await fetchViaProxy(url, { parseJson:true, timeout:4000, totalTimeout:10000,
        accept: function(payload) {
          const meta = payload?.chart?.result?.[0]?.meta;
          return meta && _validatePrice(symbol, meta.regularMarketPrice);
        }
      });
      return _yfQuoteFromMeta(symbol, raw.chart.result[0].meta, raw._aioTransport);
    } catch (_) {}
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
  // PRIORITY_SYMS 전체 평탄화 후 중복 제거 → 배치 호출 (_PRICE_RULES 초기화 뒤 — 검증이 그 상수를 읽는다)
  try {
    const _allSymsFlat = Array.from(new Set(PRIORITY_SYMS.flat().concat(_requestedQuoteSyms)));
    await _yfBatchFetch(_allSymsFlat);
  } catch(e) { _aioLog('warn', 'init', 'spark 배치 초기화 실패: ' + e.message); }


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

  // P1756: the Stooq CSV fallback was removed — every Stooq request answered 404 (direct and through the Worker), so it
  // only added ~20 failed requests per refresh cycle. The rescue chain below keeps its order.
  const hasMarketSnapshotFallback = !!(_aioMarketSnapshotMeta && Number(_aioMarketSnapshotMeta.count) > 0);

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
    updateDataStatusError('ok', 'API 연결 성공, ' + allQuotes.length + '개 종목');
    if (typeof _reportApiOk === 'function') _reportApiOk('yahoo-quote', allQuotes.length + '개 종목');
    // v34.2: 실시간 데이터 수신 이벤트 발화 → staleness 배너 즉시 해제
    try { window.dispatchEvent(new CustomEvent('aio:liveDataReceived', { detail: { count: allQuotes.length, liveCoverage: liveCoverage, coreCoverageOk: coreCoverageOk } })); } catch(_e){}
    if (!coreCoverageOk) updateDataStatusError('warn', 'API connected but core market coverage is partial - fallback still active');
    // P1326/R671: one presenter labels currentness from observation times (실시간/지연/종가/지난 시세).
    try { document.dispatchEvent(new CustomEvent('aio:quoteTopbar', { detail: { coreCoverageOk: coreCoverageOk } })); } catch(_topbarEvent) {}
    try {
      if (window.AIO && typeof window.AIO.scheduleSnapshotStaleBanner === 'function') window.AIO.scheduleSnapshotStaleBanner(250); // v59.42: the currentness guard it ran is retired
    } catch(_mcg) {}
    // v59.45 (R2-01): the refresh scheduler records success from this value; an undefined return read every run as 'loaded'.
    return { ok: true, updated: true, status: coreCoverageOk ? 'loaded' : 'partial', count: allQuotes.length };
  } else {
    fetchLiveQuotes._failCount = (fetchLiveQuotes._failCount||0) + 1;
    // v46.4: 지수적 백오프 (선형 30×N → 지수 15×2^N, 최대 300초)
    const usingSnapshotFallback = !!(_aioMarketSnapshotMeta && Number(_aioMarketSnapshotMeta.count) > 0);
    const wait = usingSnapshotFallback ? 180 : Math.min(300, 15 * Math.pow(2, fetchLiveQuotes._failCount - 1));
    // P1326/R671: a failed fetch does not replace the currentness label with transport text;
    // whatever observations exist keep their own label (종가/지난 시세/미수신).
    if (usingSnapshotFallback) {
      try { document.dispatchEvent(new CustomEvent('aio:marketSnapshot', { detail: _aioMarketSnapshotMeta })); } catch(_snapshotTopbarEvent) {}
    } else {
      try { document.dispatchEvent(new CustomEvent('aio:quoteTopbar', { detail: { retryInSec: wait } })); } catch(_retryTopbarEvent) {}
    }
    updateDataStatusError(usingSnapshotFallback ? 'warn' : 'error', usingSnapshotFallback
      ? '실시간 시세 미수신, 기준 스냅샷 사용, 중앙 갱신 주기 대기'
      : 'API 연결 실패 — ' + wait + '초 후 재시도');
    if (typeof _reportApiError === 'function') _reportApiError('yahoo-quote', '연결 실패 (시도 ' + fetchLiveQuotes._failCount + ')');
    if (!usingSnapshotFallback) setTimeout(fetchLiveQuotes, wait * 1000);
    return { ok: false, updated: false, status: 'failed', error: 'live quote refresh received no quotes' };
  }
  } catch (e) {
    fetchLiveQuotes._failCount = (fetchLiveQuotes._failCount || 0) + 1;
    if (typeof _aioLog === 'function') _aioLog('error', 'fetch', 'fetchLiveQuotes fatal: ' + (e && e.message ? e.message : e));
    updateDataStatusError('error', 'quote refresh failed - next refresh remains enabled');
    if (typeof _reportApiError === 'function') _reportApiError('yahoo-quote', 'fatal refresh error');
    return { ok: false, updated: false, status: 'failed', error: 'fetchLiveQuotes fatal: ' + (e && e.message ? e.message : e) };
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
  async function _fetchJson(url, ms) {
    var r = await fetchWithTimeout(url, {}, ms || 6500);
    if (!r || !r.ok) return null;
    return r.json();
  }
  async function _yahooCross(sym) {
    if (!_isKr(sym)) return false;
    try {
      // 2026-10-13 network audit: a direct browser call to Yahoo has no CORS grant (503 on 005930.KS/^KS11/^KQ11 every
      // cycle); the request goes through the Worker relay that allows this host.
      var d = await fetchViaProxy('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1m&range=1d', { parseJson: true, timeout: 6500 });
      var result = d && d.chart && d.chart.result && d.chart.result[0];
      var meta = result && result.meta;
      var price = meta && (meta.regularMarketPrice || meta.previousClose);
      var prev = meta && meta.previousClose;
      var pct = price && prev ? (price - prev) / prev * 100 : null;
      // P1728: the chart meta's previous close is the value that ran one KRX session behind; the cross-check records it
      // only when the verified previous KRX close agrees.
      var _krCross = price > 0 && typeof _aioVerifyKrQuoteChange === 'function'
        ? _aioVerifyKrQuoteChange({ symbol: sym, _source: 'yahoo:cross-chart', regularMarketTime: meta && meta.regularMarketTime, regularMarketPreviousClose: prev }, price, pct)
        : null;
      if (_krCross) { pct = _krCross.pct; prev = _krCross.prevClose; }
      if (price > 0) { _record(sym, 'yahoo:cross-chart', price, pct, { previousClose: prev || null }); return true; }
    } catch(_yahooErr) {}
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
      // P1756: Stooq cross-check removed (every symbol answered 404, direct and via the Worker).
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


// v59.42: _aioVixPercentile and vixRegime are deleted; neither had a runtime caller. The VIX bands live in
// src RULES.volatility (via window._aioVixBandIndex) and the sentiment route's own read model.

// ═══════════════════════════════════════════════════════════════════
// v17: 정적 기본값 즉시 로드 — API 성공/실패 무관하게 항상 데이터 표시
// ═══════════════════════════════════════════════════════════════════

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
      } else if (ageHours >= 0 && parsed.schema === 2 && parsed.data && parsed.data.length > 0) {
        var cachedQuotes = parsed.data.map(function(f) {
          return Object.assign({}, f, { _source:'snapshot', _originalSource:f._source, fetchedAt:f.fetchedAt || parsed.ts });
        });
        applyLiveQuotes(cachedQuotes);
        var ago = ageHours < 1 ? Math.round(ageHours * 60) + '분' : Math.round(ageHours) + '시간';
        console.log('[AIO v35.8] localStorage 캐시 폴백 사용 (' + parsed.data.length + '종목, ' + ago + ' 전)');
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
    window.AIO = window.AIO || {};
    window.AIO._lastStaticQuoteFallbackBlocked = {
      blocked: true,
      reason: 'hardcoded quote fallback disabled; wait for live/cache/snapshot source metadata',
      at: new Date().toISOString()
    };
  } catch(_blockedMeta) {}
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
  if (v == null || typeof v === 'boolean' || String(v).trim() === '') return null;
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
  if (/^(\^TNX|\^TYX|\^FVX|\^IRX)$/.test(sym)) max = 2;
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
  var truthOk = !!(truth && truth.decisionUse === true);
  var explicitSourceKind = ds.sourceKind || (d && d.sourceKind) || (d && d.quoteEnvelope && d.quoteEnvelope.sourceKind) || null;
  var explicitAllowedUse = ds.allowedUse || (d && d.allowedUse) || (d && d.quoteEnvelope && d.quoteEnvelope.allowedUse) || null;
  el.setAttribute('data-source-kind', unavailable ? 'unavailable' : (contract && contract.sourceKind ? contract.sourceKind : (explicitSourceKind || 'unavailable')));
  el.setAttribute('data-operational-use', (!unavailable && truthOk && contract && contract.allowedUse && explicitAllowedUse) ? 'decision' : 'reference-only');
  el.setAttribute('data-source-label', source);
  if (ts) el.setAttribute('data-source-ts', String(ts));
  if (truth) {
    el.setAttribute('data-truth-status', truth.status);
    el.setAttribute('data-truth-confidence', truth.confidence || '');
    el.setAttribute('data-truth-issues', (truth.issues || []).concat(truth.warnings || []).join('|'));
    // Codex browser audit H114: "Data truth blocked: non_operational_source:snapshot" reached hover text and the
    // accessibility tree. The verdict is about decision use, not about the number being false: the reader gets one
    // plain status (참고·지연), and the raw codes stay in data-truth-issues for operators.
    var _truthCodes = (truth.issues || []).concat(truth.warnings || []).join(' ');
    var _truthWhen = ts ? new Date(Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts)) : null;
    var _truthTime = _truthWhen && isFinite(_truthWhen.getTime()) ? ', 관측 ' + (function(p) { var g = function(t) { return (p.find(function(x) { return x.type === t; }) || {}).value || ''; }; return g('month') + '/' + g('day') + ' ' + g('hour') + ':' + g('minute') + ' KST'; })(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(_truthWhen)) : ''; // run-3 B7: one M/D HH:mm KST style
    if (truth.status === 'blocked' || truth.status === 'warn') {
      el.title = (/stale/.test(_truthCodes) ? '마지막으로 받은 값(장이 닫혀 있으면 마감 값)' : /snapshot|non_operational/.test(_truthCodes) ? '최근 수집본(참고용)' : '참고용 값') + _truthTime + ' — 화면 참고용이며 실시간 판단 근거로 쓰지 않습니다.';
    }
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
function _aioIsNativeFxbondElement(el) {
  try { return !!(el && el.closest && el.closest('#page-fxbond[data-aio-architecture-renderer="native"]')); }
  catch (_) { return false; }
}
function _aioIsNativeMacroElement(el) {
  try {
    return !!(el && el.closest && (el.closest('#kr-integrated-macro') ? /^(fed-target|kr-cpi|cpi)$/.test(el.getAttribute('data-snap') || '') : (el.closest('#page-macro[data-aio-architecture-renderer="native"]') || _aioIsNativeFxbondElement(el)))); // v57.81: the 한국 거시 user fold is shell-written except its native Korea/US table (src/ui/pages/market.js)
  }
  catch (_) { return false; }
}
window._aioIsNativeMacroElement = _aioIsNativeMacroElement;
window._aioIsNativeFxbondElement = _aioIsNativeFxbondElement;

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
      // LC-63/P1250: 변화량은 자기 본값과 한 observation이다 — 본값이 결측이면 변화량도 보류한다.
      if (pct != null && _aioLivePrice(d) == null) pct = null;
      stats.touched += 1;
      if (pct != null) {
        // P2111: the sign follows the printed digits (as signedText), so a move that rounds to zero is "0.00%", not "-0.00%".
        var shownPct = Number(Math.abs(pct).toFixed(2)) === 0 ? 0 : pct;
        var signOf = function(v, digits) { return Number(Math.abs(v).toFixed(digits)) === 0 ? '' : v > 0 ? '+' : '-'; };
        el.textContent = (function(unit, p) { var move = p - p / (1 + pct / 100), pctText = signOf(pct, 2) + Math.abs(pct).toFixed(2) + '%'; return unit === 'bp' ? signOf(move * 100, 1) + Math.abs(move * 100).toFixed(1) + 'bp' : unit === 'abs' ? signOf(move, 2) + Math.abs(move).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' (' + pctText + ')' : pctText; })(el.getAttribute('data-chg-unit'), _aioLivePrice(d)); // P1381/P1387: yields move in basis points; headline cards show the point move with the percent
        if (el.classList) {
          el.classList.remove('pos', 'neg', 'a11y-up', 'a11y-dn', 'a11y-hold');
          el.classList.add(shownPct >= 0 ? 'pos' : 'neg', shownPct > 0 ? 'a11y-up' : shownPct < 0 ? 'a11y-dn' : 'a11y-hold'); // P1387: ▲/▼ glyph set with the value, not by a later sweep
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
  var change = input.regularMarketChange == null || input.regularMarketChange === '' ? NaN : Number(input.regularMarketChange);
  if (!isFinite(change)) change = previous != null ? price - previous : null;
  var pct = input.regularMarketChangePercent == null || input.regularMarketChangePercent === '' ? NaN : Number(input.regularMarketChangePercent);
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
  var observedRaw = input.observedAt || input.regularMarketTime || input.cgLastUpdated || input.postMarketTime || input.preMarketTime || null;
  var observedMs = typeof observedRaw === 'string' ? new Date(observedRaw).getTime() : Number(observedRaw);
  if (isFinite(observedMs) && observedMs > 0 && observedMs < 1e12) observedMs *= 1000;
  if (!isFinite(observedMs) || observedMs <= 0) observedMs = null;
  // Source tier and allowed-use grants must be explicit producer fields. A
  // raw/live/current label is presentation metadata, not licensing or trading
  // authority. Missing fields remain missing so native decision consumers can
  // fail closed instead of manufacturing a grant from `_source`.
  var sourceKind = String(input.sourceKind || '').trim().toUpperCase() || null;
  var allowedUse = input.allowedUse == null || input.allowedUse === '' ? null : input.allowedUse;
  var allowedUseCeiling = input.allowedUseCeiling == null || input.allowedUseCeiling === '' ? null : input.allowedUseCeiling;
  var quality = input.quality && typeof input.quality === 'object' ? input.quality : null;
  var qualityStatus = input.qualityStatus || (quality && quality.status) || null;
  var rightsId = input.rightsId == null || input.rightsId === '' ? null : String(input.rightsId);
  var currency = String(input.currency || input.currencyCode || '').trim().toUpperCase() || null;
  var unit = String(input.unit || input.units || (currency || '')).trim().toUpperCase() || null;
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
    currency: currency,
    unit: unit,
    sourceKind: sourceKind,
    allowedUse: allowedUse,
    allowedUseCeiling: allowedUseCeiling,
    quality: quality,
    qualityStatus: qualityStatus,
    rightsId: rightsId,
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
    var candidateFresh = Date.parse(candidate._atomicObservedAt || '') || 0;
    var currentFresh = Date.parse(current._atomicObservedAt || '') || 0;
    // Provider preference breaks ties; it cannot promote an older observation
    // over a newer one or a collection timestamp over a real observation.
    if (candidateFresh > currentFresh || (candidateFresh === currentFresh && candidateScore >= currentScore)) {
      selected.set(candidate.symbol, candidate);
    }
  });
  return Array.from(selected.values());
}

function _aioVixCloseFromHistory() {
  try {
    var rows = window._aioHistory || [];
    for (var i = rows.length - 1; i >= 0; i--) {
      var v = Number(rows[i] && rows[i].vix);
      if (Number.isFinite(v) && v > 0) return v;
    }
  } catch (_) {}
  return null;
}

function _aioLiveVixValue() {
  try {
    var row = (window._liveData || {})['^VIX'];
    var p = Number(row && row.price);
    if (Number.isFinite(p) && p > 0) return p;
  } catch (_) {}
  return null;
}

function _aioUpdateVixBadge(vixValue) {
  var els = document.querySelectorAll('[data-vix-badge]');
  if (!els.length) return;
  var _vixFixed = window._aioSafeFixed || function(v, d, fb) { const n = Number(v); return Number.isFinite(n) ? n.toFixed(d || 2) : (fb || '—'); };
  var text = null;
  var vp = Number(vixValue);
  if (Number.isFinite(vp) && vp > 0) text = 'VIX ' + _vixFixed(vp, 2, '—');
  else { var close = _aioVixCloseFromHistory(); if (close != null) text = 'VIX ' + close.toFixed(2) + ' 종가'; }
  if (text == null) return;
  els.forEach(function(el) { el.textContent = text; });
}

// P1728 (2026-10-13): a Korean quote's daily change is measured from the previous completed KRX session's close.
// The provider's previous close ran one session behind after the 10/9 holiday (it dropped the 10/12 session):
// 005930 -6.59% against -5.58%, ^KQ11 -6.19% against -1.43%. The quote is checked against closes this page has
// already loaded — the producer's KR index history (window._aioHistory) and the reconciled screener row (ret1d of the
// same session). A disagreement is recomputed from the verified basis; with no verified basis the change is withheld
// ('전일 기준 미확인') rather than shown on an unknown base.
var _AIO_KR_INDEX_FIELD = { '^KS11': 'kospi', '^KQ11': 'kosdaq' };
function _aioKstSessionDate(value) {
  var ms = typeof value === 'number' ? (value > 0 && value < 1e12 ? value * 1000 : value) : Date.parse(value || '');
  if (!isFinite(ms) || ms <= 0) return null;
  return new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
}
// Latest history close of `field` in a KRX session before `sessionDate` (KST date of the observation, not the US cycle
// row carrying it). The history must reach the day before the session, so a missing session is a closed market day and
// not a producer run that has not happened yet.
function _aioKrIndexHistoryBasis(field, sessionDate, history) {
  var rows = Array.isArray(history) ? history : [];
  if (!field || !/^\d{4}-\d{2}-\d{2}$/.test(String(sessionDate || ''))) return null;
  var latestRowDate = null, best = null;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!row) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')) && (!latestRowDate || row.date > latestRowDate)) latestRowDate = row.date;
    var value = Number(row[field]);
    if (!(value > 0)) continue;
    var meta = (row.fieldMeta && row.fieldMeta[field]) || {};
    if (meta.observationRelation === 'current-session' || meta.valueBasis === 'current-session') continue;
    var session = _aioKstSessionDate(meta.observedAt) || (/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')) ? row.date : null);
    if (!session || session >= sessionDate) continue;
    if (!best || session >= best.date) best = { date: session, close: value };
  }
  var dayBefore = new Date(Date.parse(sessionDate + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  if (!best || !latestRowDate || latestRowDate < dayBefore) return null;
  // P1728 review: a history loaded before the previous KRX session closed (a tab kept open overnight) carries an older
  // close under a current-looking row date. Only a history fetched within the last six hours is a basis.
  var loadedAt = history === window._aioHistory && window._aioHistoryMeta ? Number(window._aioHistoryMeta.loadedAt) : null;
  if (loadedAt != null && Number.isFinite(loadedAt) && Date.now() - loadedAt > 6 * 3600000) return null;
  return best;
}
// Latest completed KRX close of an index with its own one-session change (both from the producer history).
function _aioKrIndexCloseRead(field, history) {
  var rows = Array.isArray(history) ? history : [];
  var last = null;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var value = row && Number(row[field]);
    if (!(value > 0)) continue;
    var meta = (row.fieldMeta && row.fieldMeta[field]) || {};
    if (meta.observationRelation === 'current-session' || meta.valueBasis === 'current-session') continue;
    var session = _aioKstSessionDate(meta.observedAt) || (/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')) ? row.date : null);
    if (session && (!last || session >= last.date)) last = { date: session, close: value };
  }
  if (!last) return null;
  var prev = _aioKrIndexHistoryBasis(field, last.date, rows);
  return { field: field, date: last.date, close: last.close, prevDate: prev ? prev.date : null, prevClose: prev ? prev.close : null,
    pct: prev && prev.close > 0 ? (last.close / prev.close - 1) * 100 : null };
}
function _aioKrScreenerRowFor(symbol) {
  try {
    var rows = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
    for (var i = 0; i < (rows || []).length; i++) {
      if (rows[i] && String(rows[i].sym || '').toUpperCase() === symbol) return rows[i];
    }
  } catch (_) {}
  return null;
}
// Verified one-session change of a KR symbol for a completed session: index from the history, stock from the
// reconciled screener row of that same session. null when no verified basis exists.
function _aioKrVerifiedDayChange(symbol, sessionDate, close) {
  var sym = String(symbol || '').toUpperCase();
  var field = _AIO_KR_INDEX_FIELD[sym];
  if (field) {
    var ref = _aioKrIndexHistoryBasis(field, sessionDate, window._aioHistory);
    var px = Number(close);
    return ref && px > 0 ? { pct: (px / ref.close - 1) * 100, prevClose: ref.close, basisDate: ref.date, basis: 'krx-history-previous-close' } : null;
  }
  if (!/\.(KS|KQ)$/.test(sym)) return null;
  var row = _aioKrScreenerRowFor(sym);
  var ret = row && row.ret1d != null && row.ret1d !== '' ? Number(row.ret1d) : NaN;
  if (!row || row.factorSessionDate !== sessionDate || !isFinite(ret)) return null;
  return { pct: ret, prevClose: Number(close) > 0 ? Number(close) / (1 + ret / 100) : null, basisDate: sessionDate, basis: 'screener-reconciled-session-change' };
}
// One quote: returns null for a non-KR or KRX-origin (Naver) quote, otherwise the change to publish and its basis.
function _aioVerifyKrQuoteChange(q, price, providerPct) {
  var sym = String(q && q.symbol || '').toUpperCase();
  var isIndex = !!_AIO_KR_INDEX_FIELD[sym];
  if (!isIndex && !/\.(KS|KQ)$/.test(sym)) return null;
  if (/^live:naver/.test(String(q._source || ''))) return null;
  var session = _aioKstSessionDate(q._atomicObservedAt || q.observedAt || q.regularMarketTime);
  var providerPrev = Number(q.regularMarketPreviousClose || q.chartPreviousClose);
  if (!(providerPrev > 0)) providerPrev = null;
  var hasProviderPct = typeof providerPct === 'number' && isFinite(providerPct);
  var out = { symbol: sym, session: session, providerPrev: providerPrev, providerPct: hasProviderPct ? providerPct : null,
    pct: null, prevClose: null, basis: 'kr-previous-close-unverified', basisDate: null, status: 'unverified' };
  if (!session) return out;
  var verified = _aioKrVerifiedDayChange(sym, session, price);
  if (verified) {
    var agrees = isIndex
      ? (providerPrev > 0 && Math.abs(providerPrev / verified.prevClose - 1) <= 0.0005)
      : (hasProviderPct && Math.abs(providerPct - verified.pct) <= 0.15);
    out.status = agrees ? 'agree' : 'corrected';
    out.basis = verified.basis;
    out.basisDate = verified.basisDate;
    // Agreeing provider values stay exact; a disagreement publishes the verified change.
    out.pct = agrees && hasProviderPct ? providerPct : verified.pct;
    out.prevClose = agrees && providerPrev ? providerPrev : verified.prevClose;
    return out;
  }
  // A stock in a session the screener has not closed yet: the provider's previous close is trusted only when the KRX
  // indices in the same session agree with the verified history (the off-by-one is a venue calendar fault).
  var health = window._aioKrPrevCloseHealth;
  if (!isIndex && health && health.session === session && health.status === 'agree' && hasProviderPct && providerPrev) {
    out.pct = providerPct; out.prevClose = providerPrev; out.basis = 'provider-previous-close-index-checked';
    out.basisDate = health.basisDate || null; out.status = 'agree';
  }
  return out;
}
// Offline harnesses evaluate this file section without a window; the browser gets the shared readers.
if (typeof window !== 'undefined') {
  window._aioKrIndexCloseRead = _aioKrIndexCloseRead;
  window._aioKrVerifiedDayChange = _aioKrVerifiedDayChange;
  window._aioVerifyKrQuoteChange = _aioVerifyKrQuoteChange;
}
// A quote withheld before the history/screener arrived is re-applied once they land, unless a newer quote replaced it.
function _aioReverifyKrQuotes() {
  var pending = window._aioKrPendingQuotes || {};
  var redo = [];
  Object.keys(pending).forEach(function(sym) {
    var entry = pending[sym];
    var live = window._liveData && window._liveData[sym];
    if (entry && live && live.revision === entry.revision) redo.push(entry.quote);
  });
  window._aioKrPendingQuotes = {};
  if (redo.length) applyLiveQuotes(redo);
}
try {
  window.addEventListener('aio:historyLoaded', _aioReverifyKrQuotes);
  document.addEventListener('aio:nativeScreenerReady', _aioReverifyKrQuotes);
} catch (_) {}

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

  // P1728: the KRX indices in this batch decide whether the provider's KR previous close can be trusted for stocks
  // whose session the screener has not closed yet (both must agree with the verified history).
  var _krHealthChecks = atomicQuotes.filter(function(q) { return _AIO_KR_INDEX_FIELD[q.symbol]; }).map(function(q) {
    return _aioVerifyKrQuoteChange(q, q.regularMarketPrice, q.regularMarketChangePercent);
  }).filter(Boolean);
  if (_krHealthChecks.length) {
    var _krHealthSession = _krHealthChecks[0].session;
    var _krSameSession = _krHealthChecks.every(function(c) { return c.session && c.session === _krHealthSession; });
    var _krAllAgree = _krSameSession && _krHealthChecks.every(function(c) { return c.status === 'agree'; });
    var _krAnyCorrected = _krHealthChecks.some(function(c) { return c.status === 'corrected'; });
    if (_krAllAgree || _krAnyCorrected) {
      window._aioKrPrevCloseHealth = { session: _krHealthSession, status: _krAllAgree ? 'agree' : 'disagree',
        basisDate: _krHealthChecks[0].basisDate, checkedAt: new Date(now).toISOString() };
    }
  }
  window._aioKrQuoteChecks = window._aioKrQuoteChecks || {};
  window._aioKrPendingQuotes = window._aioKrPendingQuotes || {};

  atomicQuotes.forEach(q => {
    const rawPct = q.regularMarketChangePercent;
    let hasPct = (typeof rawPct === 'number' && isFinite(rawPct));
    let pct   = hasPct ? rawPct : null;
    const price = q.regularMarketPrice;
    if (typeof price !== 'number' || !isFinite(price) || price <= 0) return;
    // P1728: Korean change from the verified previous KRX close (or withheld).
    const _krCheck = _aioVerifyKrQuoteChange(q, price, pct);
    if (_krCheck) {
      pct = _krCheck.pct;
      hasPct = (typeof pct === 'number' && isFinite(pct));
      window._aioKrQuoteChecks[q.symbol] = Object.assign({ checkedAt: new Date(now).toISOString() }, _krCheck);
      if (_krCheck.status === 'unverified') window._aioKrPendingQuotes[q.symbol] = { quote: q, revision: _quoteBatchRevision };
      else delete window._aioKrPendingQuotes[q.symbol];
      if (_krCheck.status === 'corrected') { var _krWarned = (window._aioPrevCloseWarned = window._aioPrevCloseWarned || {}), _krWarnKey = q.symbol + '|' + _krCheck.basisDate + '|' + _krCheck.providerPrev; if (!_krWarned[_krWarnKey]) { _krWarned[_krWarnKey] = 1; _aioLog('warn', 'data', q.symbol + ' 전일종가 불일치 — 제공처 ' + _krCheck.providerPrev + ' 대신 검증 기준(' + _krCheck.basisDate + ')으로 등락률 재계산 (같은 교정은 다시 기록하지 않음)'); } } // P1850 (codex F19): once per symbol, basis date and provider value (27x a session before)
    }

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
    const _quoteChangeBasis = _krCheck ? _krCheck.basis : (q.changeBasis || q.valueBasis || ((q.regularMarketPreviousClose || q.chartPreviousClose) > 0 ? 'provider-previous-value' : 'unknown'));
    const _quotePrevClose = _krCheck ? _krCheck.prevClose : (q.regularMarketPreviousClose || q.chartPreviousClose || null);
    // The price basis is unchanged by the change verification.
    const _quoteValueBasis = q.valueBasis || q.changeBasis || ((q.regularMarketPreviousClose || q.chartPreviousClose) > 0 ? 'provider-previous-value' : 'unknown');
    const accepted = PriceStore.set(q.symbol, price, pct, q._source || 'live:yahoo', { deferDomAnnotation: true,
      revision: _quoteBatchRevision,
      revisionId: _quoteBatchRevision,
      observedAt: q._atomicObservedAt || q.observedAt || null,
      fetchedAt: q._atomicFetchedAt || q.fetchedAt || null,
      sourceKind: q.sourceKind || null,
      allowedUse: q.allowedUse || null,
      allowedUseCeiling: q.allowedUseCeiling || null,
      quality: q.quality || null,
      qualityStatus: q.qualityStatus || null,
      rightsId: q.rightsId || null,
      marketState: q.marketState || null,
      venue: q.fullExchangeName || q.exchangeName || null,
      regularMarketPreviousClose: _quotePrevClose,
      changeBasis: _quoteChangeBasis,
      valueBasis: _quoteValueBasis, session: q.session || q.marketState || null, marketState: q.marketState || null
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
      // A daily quote change must never overwrite the separate weekly-return field.
      // FABLE-LIVE-AUDIT-2026-07-07 C5/L2-2: 이 forEach는 Yahoo/Naver 등 여러 소스의 동일 심볼 quote를
      // 순서 구분 없이 훑으며 "나중에 처리되는 쪽이 승리"하는 구조였다. Yahoo의 ^KS11/^KQ11
      // chartPreviousClose는 미국 휴장일 인접 주간에 한 세션 어긋난 값을 반환하는 경우가 실측되어,
      // KRX 원천인 Naver(_source==='live:naver')가 한 번이라도 전일종가를 확정하면 그 값을
      // sticky하게 유지하고 이후 Yahoo 값이 이를 덮어쓰지 못하게 한다(전일종가는 하루 1회만 변함).
      // P1728: a verified KRX history close counts as KRX-origin; an unverified provider value is not published.
      if (q.symbol === '^KS11') {
        var _ksPrev = _krCheck ? _krCheck.prevClose : (q.regularMarketPreviousClose || q.chartPreviousClose);
        var _ksIsNaver = (q._source === 'live:naver') || !!(_krCheck && _krCheck.status !== 'unverified');
        if (_ksPrev > 0 && (_ksIsNaver || !window.DATA_SNAPSHOT._kospiPrevFromNaver)) {
          window.DATA_SNAPSHOT.kospiPrev = _ksPrev;
          if (_ksIsNaver) window.DATA_SNAPSHOT._kospiPrevFromNaver = true;
        } else if (!_ksPrev) {
          window.DATA_SNAPSHOT.kospiPrev = null;
          window.DATA_SNAPSHOT._kospiPrevFromNaver = false;
        }
      }
      if (q.symbol === '^KQ11') {
        var _kqPrev = _krCheck ? _krCheck.prevClose : (q.regularMarketPreviousClose || q.chartPreviousClose);
        var _kqIsNaver = (q._source === 'live:naver') || !!(_krCheck && _krCheck.status !== 'unverified');
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
    // P1728: for a KR quote only the verified previous close is kept (an unverified provider value would let a
    // reader recompute the off-by-one change).
    if (_krCheck) {
      window._liveData[q.symbol] = window._liveData[q.symbol] || {};
      window._liveData[q.symbol].chartPreviousClose = _krCheck.prevClose || null;
      window._liveData[q.symbol].regularMarketPreviousClose = _krCheck.prevClose || null;
      window._liveData[q.symbol].krChangeCheck = { status: _krCheck.status, basis: _krCheck.basis, basisDate: _krCheck.basisDate, session: _krCheck.session, providerPrev: _krCheck.providerPrev };
    } else {
    if (q.chartPreviousClose && q.chartPreviousClose > 0) {
      window._liveData[q.symbol] = window._liveData[q.symbol] || {};
      window._liveData[q.symbol].chartPreviousClose = q.chartPreviousClose;
    }
    if (q.regularMarketPreviousClose && q.regularMarketPreviousClose > 0) {
      window._liveData[q.symbol] = window._liveData[q.symbol] || {};
      window._liveData[q.symbol].regularMarketPreviousClose = q.regularMarketPreviousClose;
    }
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
    var _existingLiveQuote = window._liveData[q.symbol] || {};
    var _quoteCurrency = q.currency || _existingLiveQuote.currency || null;
    var _quoteUnit = q.unit || _existingLiveQuote.unit || _quoteCurrency || null;
    Object.assign(window._liveData[q.symbol], {
      currency: _quoteCurrency,
      unit: _quoteUnit,
      quoteEnvelope: {
      revisionId: _quoteBatchRevision,
      source: q._source,
      price: price,
      change: _krCheck ? (_krCheck.prevClose > 0 && hasPct ? price - _krCheck.prevClose : null) : (isFinite(q.regularMarketChange) ? q.regularMarketChange : null),
      pct: hasPct ? pct : null,
      previousClose: _krCheck ? (_krCheck.prevClose || null) : (isFinite(q.regularMarketPreviousClose) ? q.regularMarketPreviousClose : null),
      changeBasisDate: _krCheck ? _krCheck.basisDate : null,
      changeCheck: _krCheck ? _krCheck.status : null,
      providerPreviousClose: _krCheck ? _krCheck.providerPrev : null,
      providerPct: _krCheck ? _krCheck.providerPct : null,
      observedAt: q._atomicObservedAt,
       fetchedAt: q._atomicFetchedAt,
       sourceKind: q.sourceKind || null,
       allowedUse: q.allowedUse || null,
       allowedUseCeiling: q.allowedUseCeiling || null,
       quality: q.quality || null,
       qualityStatus: q.qualityStatus || null,
       rightsId: q.rightsId || null,
       currency: _quoteCurrency,
      unit: _quoteUnit,
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
      currency: _quoteCurrency,
      unit: _quoteUnit,
      marketState: q.marketState || null,
      exchangeTimezoneName: q.exchangeTimezoneName || null,
      exchange: q.fullExchangeName || q.venue || null,
      fetchedAt: q.fetchedAt || null,
      delayedByMs: typeof q.delayedByMs === 'number' ? q.delayedByMs : null,
       sourceKind: q.sourceKind || null,
       allowedUse: q.allowedUse || null,
       allowedUseCeiling: q.allowedUseCeiling || null,
       quality: q.quality || null,
       qualityStatus: q.qualityStatus || null,
       rightsId: q.rightsId || null
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
    // The SPX all-time-high tracker and its floor helper only fed the retired 0-100 market-health grade; both are gone.
    // price 요소 — 스테일 데이터 지시자 포함
    const isMarketHours = (() => {
      try {
        if (typeof _getUsSession === 'function') return _getUsSession() === 'open';
      } catch(_session) {}
      return false; // No registered session clock means current-market status is unknown.
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
        el.style.color = atomicDelta >= 0 ? 'var(--dir-up)' : 'var(--dir-down)'; var _krIdxCard = el.closest && el.closest('.kr-idx-card'); if (_krIdxCard) { _krIdxCard.classList.toggle('up', atomicDelta > 0); _krIdxCard.classList.toggle('down', atomicDelta < 0); } // P1315: card direction follows the live delta, never static markup
        el.setAttribute('data-source-kind', 'live');
        el.setAttribute('data-operational-use', 'decision');
        el.setAttribute('data-source-label', q._source || 'live:yahoo');
        el.setAttribute('data-source-ts', String(now));
      });
    }
    // v59.02: the fenced after-hours hero fallback (#ticker-hero-ext) was deleted; entity.js renders it on every mount.
    // v36.8: 시장 지수 — RTH 외 시간에 "종가" 라벨 + 선물 참고 표시
    var _INDEX_FUTURES_MAP = {'^GSPC':'ES=F', '^NDX':'NQ=F', '^DJI':'YM=F'};
    var _futSym = _INDEX_FUTURES_MAP[q.symbol];
    if (_futSym) {
      var _usS2 = (typeof _getUsSession === 'function') ? _getUsSession() : 'unknown';
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
            var fColor = fPct >= 0 ? 'var(--dir-up)' : 'var(--dir-down)';
            var sessLabel = _usS2 === 'pre' ? '프리' : _usS2 === 'after' ? '애프터' : '시간외';
            el.innerHTML = '<span style="font-size:12px;color:var(--blue-11);">선물(' + sessLabel + ')</span> ' +
              '<span style="font-size:12px;color:' + fColor + ';font-family:var(--font-mono);">' +
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

    // HY OAS has its own FRED producer; HYG ETF prices are not a credit spread.
    const snapMap = { '^GSPC':'snap-gspc', '^IXIC':'snap-ixic', 'CL=F':'snap-oil', 'GC=F':'snap-gold', 'BTC-USD':'snap-btc' };
    const cardId = snapMap[q.symbol];
    if (cardId) {
      const card = document.getElementById(cardId);
      if (card) card.style.borderLeftColor = pct >= 0 ? 'var(--dir-up)' : 'var(--dir-down)';
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
    let vp = Number(vixQ.regularMarketPrice);
    if (!Number.isFinite(vp)) vp = Number(DATA_SNAPSHOT && DATA_SNAPSHOT.vix);
    var _vixLiveValue = (Number.isFinite(vp) && vp > 0) ? vp : null;
    // v57.60: retired VIX DOM writers (snap-vix*, vol-regime-*, vix-pct-cell, vix-pct-table-cell, .options-vix-pct-label) removed — no such nodes remain.
    // P1508: without a live quote the header showed 'VIX —' although the last close is in the daily history; show that close, labelled.
    _aioUpdateVixBadge(_vixLiveValue);
  }

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

  // v35.8: 실시간 데이터 localStorage 캐시 — 다음 로드 시 폴백으로 활용
  try {
    var cacheData = atomicQuotes.filter(function(q) { return q._source !== 'snapshot' && q._atomicObservedAt; }).map(function(q) {
      return { symbol:q.symbol, regularMarketPrice:q.regularMarketPrice, regularMarketChangePercent:q.regularMarketChangePercent,
        regularMarketChange:q.regularMarketChange, regularMarketPreviousClose:q.regularMarketPreviousClose,
        observedAt:q._atomicObservedAt, fetchedAt:q._atomicFetchedAt, _source:q._source, marketState:q.marketState || null };
    });
    if (cacheData.length) localStorage.setItem('aio_cached_quotes', JSON.stringify({ schema:2, ts:Date.now(), data:cacheData }));
  } catch(e) { /* localStorage 용량 초과 등 무시 */ }

  // Dispatch event for page-specific refresh
  document.dispatchEvent(new Event('aio:liveQuotes'));
  try { window.dispatchEvent(new CustomEvent('aio:liveQuotes', { detail: { count: quotes.length, timestamp: Date.now() } })); } catch(_) {}

  // v35.8: 스크리너 DB mcap/RSI 라이브 업데이트
  updateScreenerFromLiveData();

  // v51.61: DATA_SNAPSHOT 일괄 갱신 후 data-snap DOM 요소 재동기화
  // 모든 페이지의 data-snap 값이 data-live-price와 동일 시점 데이터를 표시
  try {
    if (typeof applyDataSnapshot === 'function') applyDataSnapshot(window.DATA_SNAPSHOT);
  } catch(_snapRefreshErr) {}

  // v51.66: _fieldTs.prices — 실시간 시세 마지막 적용 시각 기록
  if (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs) {
    window.DATA_SNAPSHOT._fieldTs.prices = _batchObservedTimes.length ? new Date(Math.max.apply(null, _batchObservedTimes)).toISOString() : null;
  }
  // v51.66: 가격 갱신 후 신선도 UI 업데이트 (스크리너 듀얼 타임스탬프)
  try { if (typeof _aioRenderDataFreshness === 'function') _aioRenderDataFreshness(); } catch(_) {}
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

// Apply server-computed daily breadth to the macro snapshot only when observation time and coverage pass
// (src/domain/market/screener-breadth.js checks it; every other breadth reader asks _aioScreenerBreadth()).
// This is an AIO US screener-universe measurement, not official exchange breadth.
function _aioApplyScreenerBreadth(sd) {
  var read = typeof window._aioScreenerBreadth === 'function' ? window._aioScreenerBreadth(sd && sd.breadth) : null;
  var b = read && read.us;
  if (!b) return false;
  var observedMs = b.ts;
  window._lastFetch = window._lastFetch || {};
  window._lastFetch.breadthScreener = observedMs;
  if (window.DATA_SNAPSHOT) {
    window.DATA_SNAPSHOT.breadth5sma = b.sma5;
    window.DATA_SNAPSHOT.breadth20sma = b.sma20;
    window.DATA_SNAPSHOT.breadth50sma = b.sma50;
    window.DATA_SNAPSHOT._fieldTs = window.DATA_SNAPSHOT._fieldTs || {};
    window.DATA_SNAPSHOT._fieldTs.breadth_screener = b.generatedAt;
  }
  try {
    if (typeof applyDataSnapshot === 'function') applyDataSnapshot();
    // Native analysis owns the visible home/signal decision surfaces.  The
    // breadth producer still updates its canonical store, but must not trigger
    // a full legacy signal repaint across the 7k-node document during boot.
    var _nativeAnalysisRuntime = !!(window.__AIO_ARCH_RUNTIME__ && document &&
      document.querySelector('#page-signal[data-aio-architecture-renderer="native"], #page-home[data-aio-architecture-renderer="native"]'));
    if (!_nativeAnalysisRuntime && typeof refreshSignalDashboard === 'function') refreshSignalDashboard();
    if (!_nativeAnalysisRuntime && typeof refreshHomeDashboard === 'function') refreshHomeDashboard();
  } catch(_) {}
  return true;
}
window._aioApplyScreenerBreadth = _aioApplyScreenerBreadth;

// v59.40: _aioFactorWeights (the saved trader profile through deriveFactorWeights) moved to src/app/trader-profiles.js.

// Legacy unification (2026-10-17): the legacy re-run of the factor ranking is retired. It
// ranked the same canonical rows the native screener orchestrator had already ranked with the same model and inputs,
// then projected the copy onto the identity-only SCREENER_DB and a set of window globals. Every consumer now reads the
// orchestrator's ranked rows (rank, factorScores, quantSignal) and its ranking hold (src/app/bootstrap.js).

// v59.42: the v31.9 Yahoo→FRED bridge (_syncYahooToFred) is retired. It wrote intraday ^TNX/^TYX/^FVX/^VIX quotes into
// _fredData[DGS10/DGS30/DGS5/VIXCLS] and MacroStore without validation, and built T10Y2Y from live quotes, so 거시·금리
// labelled an intraday quote 'FRED:<id>' (src/ui/pages/market.js) against the close-price policy. FRED slots now hold
// only official observations; intraday quotes stay in _liveData.

// ═══ v30.11: 데이터 신선도 뱃지 시스템 ═══════════════════════════════
// 각 data-live-price 요소 옆에 실시간/정적 구분 표시
function _getDataFreshness(symbol) {
  var src = (window._dataSource || {})[symbol];
  var ts  = (window._quoteTimestamps || {})[symbol];
  if (!src || !ts) {
    // 데이터 출처 없음 → 정적 폴백 사용 중
    return { level: 'snapshot', label: '정적', color: 'transparent', title: '정적 스냅샷 데이터 (API 미연결)' };
  }
  var age = Date.now() - ts;
  var srcLabel = src.source || 'unknown';
  if (age < 120000) {
    return { level: 'live', label: '실시간', color: 'var(--text-secondary)', title: srcLabel + ', ' + Math.round(age/1000) + '초 전' };
  }
  if (age < 600000) {
    var mins = Math.floor(age / 60000);
    return { level: 'recent', label: mins + '분전', color: 'var(--data-amber)', title: srcLabel + ', ' + mins + '분 전 갱신' };
  }
  var hrs = Math.floor(age / 3600000);
  var minR = Math.floor((age % 3600000) / 60000);
  return { level: 'stale', label: (hrs > 0 ? hrs + '시간' : minR + '분') + '전', color: 'transparent', title: srcLabel + ', 갱신 지연' }; // P1599 (A09/E16): freshness is not price direction — neutral filled/amber/hollow, never green/red
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
      dot.style.boxShadow = info.color === 'transparent' ? 'inset 0 0 0 1px var(--text-muted)' : 'none';
      dot.title = info.title; dot.setAttribute('role', 'img'); dot.setAttribute('aria-label', '시세 상태: ' + info.title);
    }
  });
}

// (showPage 훅은 showPage 함수 본문에 직접 포함됨)

// ── Trading Signal 페이지 ────────────────────────────────────────
// E2/LC-26: the mode is a real score input with one owner (AIO_ARCH.setSignalScoreMode), not
// presentation copy. The old text promised a separate day cutoff that trading-score.js never
// produced; the descriptor now states the one term the model actually applies and the native
// reader recomputes the same revision.
function toggleSignalMode(mode) {
  // The mode bridge is one grouped AIO_ARCH entry (get/set/describe) so the facade budget stays a
  // single key; the owner and the descriptor prose live in src/domain/signal/mode.js.
  var bridge = window.AIO_ARCH && window.AIO_ARCH.signalScoreMode ? window.AIO_ARCH.signalScoreMode : null;
  var normalized = bridge && typeof bridge.set === 'function'
    ? bridge.set(mode)
    : (String(mode || '').toLowerCase() === 'day' ? 'day' : 'swing');
  _signalMode = normalized; // legacy global kept in sync for compatibility readers
  if (window.AIO_PAGE_SCORE_MODE) window.AIO_PAGE_SCORE_MODE.signal = normalized;
  // P1392 retired the swing/day pill and its description line (sig-sw-btn/sig-dy-btn/sig-mode-desc);
  // the mode stays a score input and the native analysis slice carries its descriptor revision.
  // Recompute the shared score (legacy sinks) and let the native analysis slice re-derive from the
  // same revision so the pill, the hero and the score input cannot disagree.
  try { if (typeof refreshSignalDashboard === 'function') refreshSignalDashboard(); } catch(_) {}
  try { document.dispatchEvent(new CustomEvent('aio:signalScoreModeChanged', { detail: { mode: normalized } })); } catch(_) {}
}

// ═══ HOME PAGE DASHBOARD REFRESH ═══════════════════════════════════
// v52.65 아이보리 리디자인 1b: 종합 거래 점수 히어로 (레거시 _aioDiagram score-breakdown/market-regime
// 원형게이지+2x2쿼드런트 완전 대체). P787 transfers the four score/decision summary sinks to
// the native analysis renderer; factor details, quality meter, and other home surfaces remain legacy.
// v58.91 (legacy decomposition 3/8 오늘): the home VIX card renderer moved to src/ui/components/home-vix.js;
// window._aioRenderHomeVix is installed by src/app/compatibility-globals.js once that module loads.
function refreshHomeDashboard() {
  try { if (typeof _aioRenderOperatorNote === 'function') _aioRenderOperatorNote(); } catch(_) {}
  // v57.50 C06: the unused F&G read with a default of 35 is removed — the native home card owns F&G (P1010), and a
  // missing value is '—', never a substitute number.
  if (typeof window._aioRenderMarketAnalysisSinks === 'function') window._aioRenderMarketAnalysisSinks(); // P1383: the verified server analysis owns the home summary (old S&P/VIX mood line removed)

  // The score is still computed for its legacy readers (window._tradingScore: aio-core, aio-workspace,
  // aio-macro-tech); a failed computation keeps the last value and a missing score is never 50 (P1383).
  if (typeof computeTradingScore === 'function') {
    try { window._tradingScore = computeTradingScore().total; } catch(_) {}
  }
  // P553/R244: "오늘 결론" 헤더(_aioRenderPageDecisionHeader)와 이 게이지가 서로 다른 이벤트
  // (aio:liveQuotes vs aio:marketStateUpdated)에서 독립 갱신되어 같은 화면에 다른 점수가
  // 동시에 보이던 문제 — 게이지가 갱신되는 시점에 헤더도 항상 함께 강제 재렌더해 절대 어긋나지 않게 한다.
  try { if (typeof window._aioRenderPageDecisionHeader === 'function') window._aioRenderPageDecisionHeader('home'); } catch(_) {}
  // v57.50 I16 / v57.77: the retired home trading grid and the S&P 500 distance-from-high risk badge
  // left index.html, and v57.77 deleted their writers. The remaining home sinks are
  // the action items and the VIX card (v57.76: the heatmap and the home news list are retired).
  // v49.28 E1 → v50.43: home Action Item 갱신은 단일 경로(_aioRefreshActionPlan). 실패해도 home 렌더 차단 X.
  try { if (typeof window._aioRefreshActionPlan === 'function') window._aioRefreshActionPlan(); } catch(actErr) {}

  // VIX status
  if (typeof window._aioRenderHomeVix === 'function') window._aioRenderHomeVix((window._liveData || {})['^VIX'] || {});
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
  // v48.59: FRED/BOK/KOSIS 지연 fetch (페이지 진입 시만)
  if (pageId === 'macro' || pageId === 'fxbond') {
    setTimeout(function(){
      if (typeof fetchAllFredData === 'function' && !window._fredData) {
        try { fetchAllFredData(); } catch(_){}
      }
    }, 500);
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
  // The screener route's ranking runs in its native orchestrator on page show (the legacy 200 ms re-rank is retired).
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

// v57.77: the second home pageShown subscriber ('data-home-shown', +150 ms) is retired. It scheduled a duplicate
// refreshHomeDashboard on every home entry; 'data-page-activation' above is the single owner because it also
// reads object-shaped pageShown details ({pageId|route|id}).

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
  // CNN public-web observations may be current enough to display, but the
  // source registry caps them at reference use until licensed rights exist.
  var operationalUse = 'reference-only';
  // H3-A canonical provenance: DOM lineage and decision engine read the same envelope.
  if (score != null && isFinite(score)) {
    var _fgTsNum = typeof sourceTs === 'number' && sourceTs < 100000000000 ? sourceTs * 1000 : new Date(sourceTs).getTime();
    window._lastFGMeta = {
      value: Number(score), source: sourceLabel, sourceKind: sourceKind, sourceLabel: sourceLabel,
      sourceTs: sourceTs, asOf: sourceTs, fetchedAt: (sourceKind === 'live' || sourceKind === 'proxy') ? Date.now() : null,
      freshnessClock: sourceKind === 'delayed' ? 'observation' : 'fetch', normalizedSourceTs: isFinite(_fgTsNum) ? _fgTsNum : null,
      operationalUse: operationalUse, allowedUse: 'reference', allowedUseCeiling: 'reference'
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
          fearGreedAllowedUse: 'reference',
          fearGreedAllowedUseCeiling: 'reference',
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
    _applyFearGreedScore({ score: score, sourceKind: 'live', sourceLabel: 'cnn-fear-greed-api', sourceTs: fg.timestamp || data.timestamp || new Date().toISOString(), operationalUse: 'reference-only' });
    return true;
  } catch(e) {
    // Try CORS proxy — P1142: 정의 없는 CORS_PROXY 참조(ReferenceError)로 이 폴백은 한 번도
    // 실행된 적 없는 죽은 경로였다. 레지스트리 fetchViaProxy로 부활하고, 응답에서 fear_and_greed를
    // 못 읽으면 가짜 성공(true) 대신 실패로 처리해 아래 snapshot 폴백이 규칙대로 작동하게 한다.
    try {
      const r2 = await fetchViaProxy(url, 9000);
      if (!r2 || !r2.ok) throw new Error('proxy status ' + (r2 && r2.status));
      const w2 = await r2.json();
      var _fgRaw = (w2 && typeof w2.contents === 'string') ? (function(){ try { return JSON.parse(w2.contents); } catch(pe) { return {}; } })() : (w2 || {});
      const data2 = _fgRaw;
      const fg2   = data2.fear_and_greed;
      if (!fg2 || fg2.score == null) throw new Error('no fear_and_greed in proxy response');
      const score2 = Math.round(fg2.score);
      // v49.64 P334: helper 통합 (proxy 경로)
      _applyFearGreedScore({ score: score2, sourceKind: 'proxy', sourceLabel: 'cnn-fear-greed-proxy', sourceTs: fg2.timestamp || data2.timestamp || new Date().toISOString(), operationalUse: 'reference-only' });
      return true;
    } catch(e2) {
      // 서버 스냅샷이 이미 적용된 뒤 브라우저 직결/proxy가 실패해도 더 오래된 정적 seed로
      // 덮어쓰지 않는다. 실패는 새 값이 없다는 뜻이지 기존 외부 관측값을 무효화한다는 뜻이 아니다.
      var _fgExistingMeta = window._lastFGMeta || {};
      var _fgExistingKind = String(_fgExistingMeta.sourceKind || '').toLowerCase();
      if (/^(live|proxy|delayed)$/.test(_fgExistingKind) && window._lastFG != null && isFinite(Number(window._lastFG))) {
        return false;
      }
      // 외부 관측값이 전혀 없을 때만 정적 snapshot을 참고값으로 표시한다.
      var _snapFg = (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT.fg != null) ? DATA_SNAPSHOT.fg : ((typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._fallback) ? DATA_SNAPSHOT._fallback.fg : null);
      _applyFearGreedScore({ score: _snapFg, sourceKind: 'snapshot', sourceLabel: 'DATA_SNAPSHOT:fear-greed', sourceTs: (typeof DATA_SNAPSHOT !== 'undefined' && (DATA_SNAPSHOT._updated || DATA_SNAPSHOT._snapshotDate)) || null, operationalUse: 'reference-only' });
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
  var tone = _aioPutCallTone(pcr);
  var sourceKind = payload.sourceKind || 'snapshot';
  var sourceLabel = payload.sourceLabel || (sourceKind === 'live' ? 'CBOE' : 'DATA_SNAPSHOT');
  var asOf = payload.asOf || new Date().toISOString();
  var metric = window.AIO && window.AIO.makeOperationalMetric
    ? window.AIO.makeOperationalMetric('putCallRatioTotal', pcr, sourceKind, asOf, sourceLabel, { domain: 'options' })
    : { name: 'putCallRatioTotal', value: pcr, sourceKind: sourceKind, sourceLabel: sourceLabel, ts: asOf, allowedUse: sourceKind === 'live' };

  // P1754: the PCR DOM writers (macro regime cell, live-price PCR spans) had no targets left; the payload below feeds state only.
  if (typeof DATA_SNAPSHOT !== 'undefined') {
    DATA_SNAPSHOT.pcr = pcr;
    // The observed Cboe equity/index ratios are authoritative whenever the
    // producer supplies them. Previously only `pcr` was stored, so the OPEX/Gamma
    // panel always fell back to a total-derived estimate and displayed 1.10 for
    // an observed 0.96 (P1074).
    var observedEquity = Number(payload.equityPutCall);
    var observedIndex = Number(payload.indexPutCall);
    if (isFinite(observedEquity)) DATA_SNAPSHOT.equityPutCall = observedEquity;
    if (isFinite(observedIndex)) DATA_SNAPSHOT.indexPutCall = observedIndex;
  }
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
    // P1142: 정의 없는 CORS_PROXY 참조(ReferenceError → catch 흡수)로 서버 스냅샷이 없을 때의
    // 브라우저 CBOE 라이브 수집이 매 주기 조용히 실패했다. 레지스트리 fetchViaProxy로 부활.
    const resp = await fetchViaProxy(cboeUrl, 8000);
    if (!resp || !resp.ok) throw new Error('CBOE proxy status ' + (resp && resp.status));
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
          sourceKind: 'T3_PUBLIC_DELAYED',
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
  let csv = '';
  try {
    csv = await fetchViaProxy(fredUrl, { parseText:true, timeout:4000, totalTimeout:10000,
      accept: function(body) { return /^\s*(DATE|observation_date),BAMLH0A0HYM2/m.test(body); } });
  } catch (_) {}
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

// P1425: the legacy carry-unwind composite (arbitrary points for USD/JPY level, VIX, a US 10Y minus
// BOK-rate gap and HY OAS — the 58/100 score P1419 retired on the native side) was deleted with its
// panel; the 금리 · 환율 board states the yen 20-day rule shared with 시장 상태.

// Legacy unification (2026-10-17): the chat's natural-language screener query engine (sector keywords, broad
// recommendations, query parsing, prompt formatting) lives in src/ai/context/screener-query.js and reads the
// canonical, natively ranked rows; src/app/compatibility-globals.js binds the window names the chat calls.
// AIO.ScreenerQuery: 스크리너 공개 API (aio-data.js 이동 완료 v51.17)
window.AIO = window.AIO || {}
