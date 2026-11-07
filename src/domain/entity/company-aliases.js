// v59.74 (owner 2026-11-07 '돈과 기술이 어떻게/어디서 흐르는지'): the names the researched stories use for one another.
// The company graph (company-graph.js) links two stories only when a supplier, customer, rival or money-flow line names
// the other company by one of these exact spellings (case-sensitive, whole word; the longest name wins, so 'Samsung SDI'
// is never read as 'Samsung'). A name not listed stays plain text: nothing is inferred from a ticker-shaped word (P1339).
// Three unlisted AI labs that sit at the end of many money flows are kept as named nodes without a ticker.
export const COMPANY_ALIASES = Object.freeze({
  '000660.KS': ['SK hynix', 'SK Hynix', 'SK하이닉스'], '005380.KS': ['Hyundai Motor', '현대자동차', '현대차'],
  '005930.KS': ['Samsung Electronics', 'Samsung Foundry', '삼성전자', 'Samsung'], '006400.KS': ['Samsung SDI', '삼성SDI'],
  '009150.KS': ['Samsung Electro-Mechanics', '삼성전기'], '012450.KS': ['Hanwha Aerospace', '한화에어로스페이스'],
  '034020.KS': ['Doosan Enerbility', '두산에너빌리티'], '036930.KQ': ['Jusung Engineering', '주성엔지니어링'],
  '105560.KS': ['KB Financial', 'KB금융'], '402340.KS': ['SK Square', 'SK스퀘어'],
  '000270.KS': ['Kia', '기아'], '010120.KS': ['LS ELECTRIC', 'LS Electric', 'LS일렉트릭'],
  '035420.KS': ['NAVER', '네이버'], '042700.KS': ['Hanmi Semiconductor', '한미반도체'],
  '055550.KS': ['Shinhan Financial Group', 'Shinhan Financial', '신한금융', '신한지주'], '066570.KS': ['LG Electronics', 'LG전자', 'LGE'],
  '068270.KS': ['Celltrion', '셀트리온'], '207940.KS': ['Samsung Biologics', '삼성바이오로직스'],
  '267260.KS': ['HD Hyundai Electric', 'HD현대일렉트릭'], '329180.KS': ['HD Hyundai Heavy Industries', 'HD현대중공업'],
  '373220.KS': ['LG Energy Solution', 'LG에너지솔루션', 'LGES'],
  AAOI: ['Applied Optoelectronics'], AAPL: ['Apple'], ABBV: ['AbbVie'], ACLS: ['Axcelis'], ACMR: ['ACM Research'], ACN: ['Accenture'],
  ADBE: ['Adobe'], ADI: ['Analog Devices'], ADSK: ['Autodesk'], AEIS: ['Advanced Energy'], AI: ['C3.ai'], ALAB: ['Astera Labs'],
  AMAT: ['Applied Materials'], AMBA: ['Ambarella'], AMD: ['AMD', 'Advanced Micro Devices'], AMGN: ['Amgen'], AMKR: ['Amkor'],
  AMZN: ['Amazon Web Services', 'Amazon', 'AWS'], ANET: ['Arista'], APH: ['Amphenol'], APLD: ['Applied Digital'], APP: ['AppLovin'],
  APPN: ['Appian'], ARM: ['Arm Holdings', 'Arm'], ASML: ['ASML'], ASX: ['ASE Technology', 'ASE'], AVGO: ['Broadcom'], AXTI: ['AXT'],
  BA: ['Boeing'], BAC: ['Bank of America'], BE: ['Bloom Energy'], BKNG: ['Booking Holdings'], 'BRK-B': ['Berkshire Hathaway'],
  BRO: ['Brown & Brown'], BTDR: ['Bitdeer'], C: ['Citigroup'], CAMT: ['Camtek'], CARR: ['Carrier Global'], CAT: ['Caterpillar'],
  CDNS: ['Cadence'], CEVA: ['Ceva'], CIEN: ['Ciena'], CIFR: ['Cipher Digital', 'Cipher Mining'], CLS: ['Celestica'],
  COHR: ['Coherent'], COHU: ['Cohu'], COIN: ['Coinbase'], CORZ: ['Core Scientific'], COST: ['Costco'], CRDO: ['Credo'],
  CRM: ['Salesforce'], CRWD: ['CrowdStrike'], CRWV: ['CoreWeave'], CSCO: ['Cisco'], CVX: ['Chevron'], DDOG: ['Datadog'],
  DELL: ['Dell'], EME: ['EMCOR'], ENTG: ['Entegris'], EQIX: ['Equinix'], ESTC: ['Elastic N.V.'], ETN: ['Eaton'],
  FIX: ['Comfort Systems'], FLEX: ['Flex Ltd'], FN: ['Fabrinet'], FORM: ['FormFactor'], FTNT: ['Fortinet'], GE: ['GE Aerospace'],
  GEV: ['GE Vernova'], GFS: ['GlobalFoundries'], GLW: ['Corning'], GLXY: ['Galaxy Digital'], GOOGL: ['Google Cloud', 'Alphabet', 'Google'],
  GS: ['Goldman Sachs'], HD: ['Home Depot'], HOOD: ['Robinhood'], HPE: ['Hewlett Packard Enterprise', 'HPE'], HUBB: ['Hubbell'],
  HUT: ['Hut 8'], IBM: ['IBM'], ICHR: ['Ichor'], INTC: ['Intel Foundry', 'Intel'], INTU: ['Intuit'], IREN: ['IREN'], JBL: ['Jabil'],
  JCI: ['Johnson Controls'], JNJ: ['Johnson & Johnson'], JPM: ['JPMorgan Chase', 'JPMorgan'], KLAC: ['KLA'], KLIC: ['Kulicke'],
  KO: ['Coca-Cola'], LITE: ['Lumentum'], LLY: ['Eli Lilly', 'Lilly'], LRCX: ['Lam Research'], LSCC: ['Lattice Semiconductor', 'Lattice'],
  MA: ['Mastercard'], MCD: ["McDonald's"], MCHP: ['Microchip'], MDB: ['MongoDB'], MDT: ['Medtronic'], META: ['Meta Platforms', 'Meta'],
  MKSI: ['MKS Instruments', 'MKS Inc'], MOD: ['Modine'], MPWR: ['Monolithic Power'], MRK: ['Merck'], MRNA: ['Moderna'], MRVL: ['Marvell'],
  MSFT: ['Microsoft Azure', 'Microsoft', 'Azure'], MSTR: ['MicroStrategy'], MTSI: ['MACOM'], MU: ['Micron'], NBIS: ['Nebius'],
  NEE: ['NextEra'], NET: ['Cloudflare'], NFLX: ['Netflix'], NKE: ['NIKE', 'Nike'], NOW: ['ServiceNow'], NTAP: ['NetApp'],
  NU: ['Nubank', 'Nu Holdings'], NVDA: ['NVIDIA', 'Nvidia', '엔비디아'], NVMI: ['Nova Ltd'], NVT: ['nVent'], NXPI: ['NXP'],
  ON: ['onsemi', 'ON Semiconductor'], ONTO: ['Onto Innovation'], ORCL: ['Oracle'], PANW: ['Palo Alto Networks'], PATH: ['UiPath'],
  PEGA: ['Pegasystems'], PEP: ['PepsiCo'], PG: ['Procter & Gamble'], PLAB: ['Photronics'], PLTR: ['Palantir'], POWL: ['Powell Industries'],
  PRCT: ['PROCEPT'], PWR: ['Quanta Services'], QCOM: ['Qualcomm'], RBRK: ['Rubrik'], RKLB: ['Rocket Lab'], RMBS: ['Rambus'],
  S: ['SentinelOne'], SANM: ['Sanmina'], SHOP: ['Shopify'], SIMO: ['Silicon Motion'], SITM: ['SiTime'], SMCI: ['Supermicro', 'Super Micro'],
  SMTC: ['Semtech'], SNDK: ['Sandisk', 'SanDisk'], SNOW: ['Snowflake'], SNPS: ['Synopsys'], SPCX: ['SpaceX'], STRL: ['Sterling Infrastructure'],
  STX: ['Seagate'], TEAM: ['Atlassian'], TER: ['Teradyne'], TMO: ['Thermo Fisher'], TSEM: ['Tower Semiconductor'], TSLA: ['Tesla'],
  TSM: ['TSMC'], TT: ['Trane'], TTD: ['The Trade Desk', 'Trade Desk'], TXN: ['Texas Instruments'], UCTT: ['Ultra Clean'],
  UMC: ['UMC'], UNH: ['UnitedHealth'], V: ['Visa'], VIAV: ['Viavi'], VLO: ['Valero'], VRT: ['Vertiv'], VSH: ['Vishay'], VZ: ['Verizon'],
  WDAY: ['Workday'], WDC: ['Western Digital'], WFC: ['Wells Fargo'], WMT: ['Walmart'], WULF: ['TeraWulf'], XOM: ['ExxonMobil', 'Exxon Mobil'],
  ZS: ['Zscaler'],
  // v59.74 expansion (owner 2026-11-07: US leaders and retail-popular names first). Bare words that also read as plain
  // English or as another company's text ('Block', 'Square', 'Hims', 'Vertex', 'Constellation', 'Progressive',
  // 'Intuitive', 'Snap', 'Celsius') are left out on purpose.
  ABNB: ['Airbnb'], ABT: ['Abbott Laboratories', 'Abbott'], AFRM: ['Affirm Holdings', 'Affirm'], ASTS: ['AST SpaceMobile'],
  AVAV: ['AeroVironment'], AXP: ['American Express', 'Amex'], BABA: ['Alibaba Group', 'Alibaba Cloud', 'Alibaba'], BLK: ['BlackRock'],
  BMY: ['Bristol Myers Squibb', 'Bristol-Myers Squibb'], CCJ: ['Cameco'], CEG: ['Constellation Energy'], CELH: ['Celsius Holdings'],
  CMCSA: ['Comcast', 'NBCUniversal'], COP: ['ConocoPhillips'], CVNA: ['Carvana'], CVS: ['CVS Health', 'CVS Caremark', 'Aetna'],
  DASH: ['DoorDash'], DE: ['John Deere', 'Deere'], DHR: ['Danaher'], DIS: ['Walt Disney', 'Disney'], DKNG: ['DraftKings'],
  ELV: ['Elevance Health', 'Anthem'], ENPH: ['Enphase Energy', 'Enphase'], F: ['Ford Motor Company', 'Ford Motor', 'Ford'], FSLR: ['First Solar'],
  GD: ['General Dynamics', 'Gulfstream'], GILD: ['Gilead Sciences', 'Gilead'], GM: ['General Motors'], HIMS: ['Hims & Hers'],
  IONQ: ['IonQ'], ISRG: ['Intuitive Surgical'], JOBY: ['Joby Aviation', 'Joby'], KTOS: ['Kratos Defense', 'Kratos'], LCID: ['Lucid Group', 'Lucid Motors'],
  LEU: ['Centrus Energy', 'Centrus'], LHX: ['L3Harris'], LIN: ['Linde'], LMT: ['Lockheed Martin', 'Lockheed'], LULU: ['Lululemon'],
  MELI: ['MercadoLibre', 'Mercado Libre', 'Mercado Pago'], MS: ['Morgan Stanley'], NOC: ['Northrop Grumman'], NRG: ['NRG Energy'], OKLO: ['Oklo'],
  OKTA: ['Okta'], PDD: ['PDD Holdings', 'Temu', 'Pinduoduo'], PFE: ['Pfizer'], PGR: ['Progressive Corporation', 'Progressive Insurance'],
  PINS: ['Pinterest'], PM: ['Philip Morris International'], PYPL: ['PayPal', 'Venmo'], QBTS: ['D-Wave Quantum', 'D-Wave'],
  RBLX: ['Roblox'], RDDT: ['Reddit'], RGTI: ['Rigetti Computing', 'Rigetti'], RIVN: ['Rivian'], ROKU: ['Roku'],
  RTX: ['RTX', 'Raytheon', 'Pratt & Whitney', 'Collins Aerospace'], SBUX: ['Starbucks'], SCHW: ['Charles Schwab', 'Schwab'],
  SE: ['Sea Limited', 'Shopee'], SMR: ['NuScale Power', 'NuScale'], SNAP: ['Snap Inc.', 'Snapchat'], SOFI: ['SoFi Technologies', 'SoFi'],
  SPGI: ['S&P Global'], SPOT: ['Spotify'], T: ['AT&T'], TLN: ['Talen Energy', 'Talen'], TMUS: ['T-Mobile US', 'T-Mobile'],
  UBER: ['Uber Technologies', 'Uber'], UNP: ['Union Pacific'], UPST: ['Upstart'], VRTX: ['Vertex Pharmaceuticals'], VST: ['Vistra'],
  XYZ: ['Block, Inc.', 'Cash App', 'Afterpay']
});

/** Unlisted companies that end many AI money flows. Shown by name, never linked to a stock page. */
export const PRIVATE_NODES = Object.freeze({ '@OpenAI': ['OpenAI'], '@Anthropic': ['Anthropic'], '@xAI': ['xAI'] });

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole word: no Latin letter or digit right before or after (Hangul particles after a Korean name are fine).
const ENTRIES = Object.entries({ ...COMPANY_ALIASES, ...PRIVATE_NODES })
  .flatMap(([id, names]) => names.map((name) => ({ id, name })))
  .sort((a, b) => b.name.length - a.name.length);
const PATTERN = new RegExp(`(?<![A-Za-z0-9])(${ENTRIES.map((e) => escape(e.name)).join('|')})(?![A-Za-z0-9])`, 'g');
const BY_NAME = new Map(ENTRIES.map((e) => [e.name, e.id]));

/** The registry ids a line of story text names, in order of first mention, each once. */
export function companiesNamedIn(text) {
  const out = [];
  for (const match of String(text || '').matchAll(PATTERN)) {
    const id = BY_NAME.get(match[1]);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}
