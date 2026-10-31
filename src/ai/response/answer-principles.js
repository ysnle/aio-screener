// P1740: one principles block chosen by the question. The old tail appended a training-cutoff claim for another
// model ("2025년 초"), a stock-only 6-step memo and six trend rules to every question (a PER definition got them too),
// and judged web search by grepping the prompt for "웹검색" while the real search decision came later.
export function buildAnswerPrinciples({ today, mode = 'analysis', hasTickers = false, hasTrend = false, liveStatus = '', newsInjected = false, webSearch = false, snapAgeHours = null, teachBlock = '' } = {}) {
  const lines = [
    '\n\n【오늘 날짜와 지식의 경계】',
    `• 오늘: ${today} (한국 시간)`,
    '• 모델이 미리 학습한 시장·기업 지식은 오늘보다 오래됐다. 가격·실적·뉴스·정책·일정 같은 현재 사실은 이 프롬프트에 주입된 데이터와 웹검색 결과만 쓰고, 기억 속 "최근"을 지금의 최근으로 말하지 마라. 개념·역사·작동 원리 설명에는 일반 지식을 써도 된다.',
  ];
  if (hasTickers) {
    lines.push('', '【종목 질문 규칙】',
      `1. 추세는 주입된 [주가 추이] 라벨과 완료 종가 기준 5거래일/20거래일/3개월 변화로만 판단한다${hasTrend ? '.' : ' — 이번에는 추이가 주입되지 않았으니 추세를 단정하지 마라.'}`,
      // v57.92 (internal audit A08): the old rule told the model to read a post-news drop as 재료 소진/후속 악재 — a cause
      // chosen before checking whether the whole market fell. The cause is now compared before it is named.
      '2. 뉴스와 가격 방향이 엇갈리면 원인을 정하기 전에 같은 기간 시장·업종 움직임, 금리·환율, 기대 대비 결과를 먼저 비교한다. 주입 자료로 가려지지 않으면 "이미 가격에 반영", "시장 전체 하락", "다른 악재"를 후보로 나란히 두고 원인 미확정으로 말한다.',
      '3. 애널리스트 목표가·컨센서스는 발표 시점과 함께 쓰고, 오래된 값은 참고로만 둔다.',
      mode === 'decision' || mode === 'analysis'
        ? '4. 종목 분석은 질문에 필요한 축만 골라 구성한다(전부 채울 필요 없음): 지금 이 종목에서 가장 중요한 한 가지 → 사업·성장 동력·경쟁 우위 → 실적·밸류에이션(주입 수치, 동종 대비 "왜 그 수준인가") → 낙관·비관 시나리오와 각각의 조건 → 다음 촉매와 판단을 바꿀 신호.'
        : '4. 사실 확인형 질문은 묻는 사실에 먼저 답하고, 그 사실을 해석하는 데 필요한 맥락만 덧붙인다.');
  }
  // v58.75 (persona review): the teach-and-check order (choosing-blocks.js teachAndCheckBlock), chosen by the caller.
  if (teachBlock) lines.push('', teachBlock);
  lines.push('', '【데이터 상태】', `• 실시간 시세: ${liveStatus}`);
  if (hasTickers) {
    lines.push(`• 주가 추이(5거래일/20거래일/3개월, 완료 종가): ${hasTrend ? '주입됨' : '미주입 — 추세 단정 금지'}`,
      '• 기업 재무: 주입된 공시·재무 블록에 있는 항목·기간만 쓴다. 시세 조회 성공은 재무 수집 성공이 아니며, 없는 지표는 미제공으로 밝힌다.');
  }
  lines.push(`• 뉴스: ${newsInjected ? '주입됨(시각 포함)' : '관련 뉴스 없음 — "최근 뉴스에 따르면"으로 시작하지 마라'}`,
    `• 웹검색: ${webSearch ? '이번 답변에서 사용 — 검색으로 확인한 사실은 출처와 날짜를 함께 밝혀라' : '사용하지 않음 — 주입 데이터 밖의 최신 사실은 단정하지 마라'}`);
  // v48.11: a static snapshot 72h+ old is never quoted as current.
  // v57.92 (internal audit A07): the file age says whether the pipeline is behind, not whether a value is current — an
  // unknown age was passed as 999 (printed "999시간(42일) 경과"), and a monthly figure before its next release or a holiday
  // close is still the latest value. Each value is judged by its own date; an unknown file age is said as unknown.
  lines.push('• 수치의 최신성은 각 수치에 붙은 기준일로 판단한다 — 월간 통계는 다음 발표 전까지 가장 최근 값이고, 휴장일에는 직전 완료 종가가 최신 종가다.');
  if (snapAgeHours == null) lines.push('• 정적 데이터: 생성 시각 확인 안 됨 — 인용할 때마다 그 수치의 기준일을 밝혀라');
  // v59.45 (pipeline review PASS12 후보): "정적 수치를 현재값으로 인용하지 마라" contradicted the per-value rule above — a
  // monthly figure in a four-day-old file is still the latest one. A late file now withholds only values its own date has passed.
  else if (snapAgeHours >= 72) lines.push(`• 정적 데이터: ${snapAgeHours}시간(${Math.round(snapAgeHours / 24)}일) 경과 — 기준일이 지난 수치(일간 시세 등)는 현재값으로 인용하지 마라`);
  else if (snapAgeHours >= 48) lines.push(`• 정적 데이터: ${snapAgeHours}시간 경과 — 인용 시 기준 시각을 밝혀라`);
  lines.push('• 없거나 확인되지 않은 데이터는 "확인되지 않음"으로 밝히고 추측으로 채우지 마라.');
  return `${lines.join('\n')}\n`;
}

// P1741: tell the model which app-drawn figures will sit under its answer, so the prose can point to them.
const VISUAL_LABEL = { price: '종가와 50·200일 이동평균 흐름(최근 약 6개월, 완료 일봉)', fundamentals: '분기(또는 연도)별 매출 막대와 순이익률(공시 기준)', relative: '종목별 상대 수익률(시작일=100, 최근 약 3개월)' };
export function describeAnswerVisuals(picks = []) {
  if (!picks.length) return '';
  return `\n【답변 아래에 함께 표시되는 그림】\n${picks.map((v) => `- ${v.symbols.join(', ')}: ${VISUAL_LABEL[v.kind] || v.kind}`).join('\n')}\n앱이 데이터로 직접 그리는 그림이다. 본문에서 "아래 그림"처럼 가리켜 무엇을 봐야 하는지 해석을 덧붙여도 되지만, 그림 속 수치를 추측해 쓰지 마라.\n`;
}

// v57.54 review: a retry after a searched attempt timed out runs without web search; its prompt must say so, or the
// model is told it searched and may present remembered facts as sourced, dated results.
const SEARCH_ON = '• 웹검색: 이번 답변에서 사용 — 검색으로 확인한 사실은 출처와 날짜를 함께 밝혀라';
const SEARCH_OFF = '• 웹검색: 사용하지 않음(지연으로 검색 없이 다시 시도) — 주입 데이터 밖의 최신 사실은 단정하지 마라';
export function promptWithoutWebSearch(prompt) {
  return String(prompt ?? '').split(SEARCH_ON).join(SEARCH_OFF);
}
