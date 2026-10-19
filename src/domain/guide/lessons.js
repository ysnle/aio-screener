// Owner 2026-10-19 ("시나리오·대응 가이드와 학습"): the stable concept layer behind every interpretation — the attitude to
// bring, the strategies worth knowing, what not to be fooled by and what to trust. Each lesson is a general principle
// (never an instruction about the reader's own holdings, R698) with a link to the matching concept in the principles
// library (public-data/principles/lesson-library.json ids). `live(ctx)` returns the sentence that ties the lesson to
// today's measured state, or null when today's data does not touch it — so the lesson shown always matches the
// situation, and the same registry serves the screens, the AI context and the scenario-state producer.
import { pastEvidence } from '../scenarios/analogs.js';
import { hasFinalConsonant } from '../content/korean-particle.js';

export const LESSON_KINDS = Object.freeze({
  attitude: '태도',
  strategy: '전략 · 기법',
  trap: '속지 말 것',
  trust: '믿을 것'
});

const axisState = (ctx, id) => ctx?.regime?.axes?.find((axis) => axis.id === id)?.state || 'unknown';
const branch = (ctx, id) => ctx?.crossroads?.items?.find((item) => item.id === id) || null;
const lead = (ctx) => (ctx?.crossroads?.leadId ? branch(ctx, ctx.crossroads.leadId) : null);
const short = (title) => String(title || '').split(' — ')[0];
const subject = (word) => `${word}${hasFinalConsonant(word) ? '이' : '가'}`;
const liveIds = (ctx) => new Set((ctx?.direction?.live || []).map((row) => row.id));

/** Each entry: id, kind, title, principle (what is generally true), why (the mechanism), concept (principles lesson id). */
export const LESSONS = Object.freeze([
  {
    id: 'survive-first', kind: 'attitude', concept: 'J4', title: '수익보다 먼저 살아남기',
    principle: '큰 손실은 회복에 더 큰 수익이 필요합니다(-50%를 메우려면 +100%). 부담 신호가 많은 때일수록 얼마를 벌지보다 얼마까지 잃을 수 있는지가 결과를 가릅니다.',
    why: '손실과 회복은 비대칭이라, 시장에 오래 남아 있는 것 자체가 복리의 조건입니다.',
    live: (ctx) => { const n = ctx?.regime?.counts?.burden; return n >= 3 ? `오늘 미국 6개 지표 중 부담이 ${n}개입니다.` : null; }
  },
  {
    id: 'conditions-not-forecasts', kind: 'attitude', concept: 'J5', title: '맞히기보다 조건으로 생각하기',
    principle: '"앞으로 오를까"를 맞히려 하기보다 "이 조건이 나오면 이렇게, 저 조건이 나오면 저렇게"를 미리 정해 두면, 어느 쪽으로 가도 당황하지 않습니다.',
    why: '시장의 다음 움직임은 아무도 정확히 모르지만, 어떤 조건에서 무엇이 바뀌는지는 미리 알 수 있습니다.',
    live: (ctx) => { const e = ctx?.crossroads?.nextEvent; return e ? `다음 갈림길은 ${e.date.slice(5).replace('-', '/')} ${e.name}입니다 — 결과별로 무엇이 달라지는지는 시나리오에 적혀 있습니다.` : null; },
    base: true
  },
  {
    id: 'waiting-is-a-choice', kind: 'attitude', concept: 'A1', title: '기다림도 선택이다',
    principle: '현금은 수익이 0인 상태가 아니라 다음 기회를 고를 수 있는 선택권입니다. 기다림에도 비용(놓친 상승)이 있고, 그 비용은 현금성 자산의 이자만큼 줄어듭니다.',
    why: '기회비용은 고르지 않은 대안의 가치입니다. 기다림의 비용과 서두름의 비용을 같은 저울에 올려야 공정한 비교가 됩니다.',
    live: (ctx) => {
      const top = ctx?.direction?.robust;
      if (!top || !['wait', 'defend'].includes(top)) return null;
      const cash = ctx?.crossroads?.cash;
      return `지금 살아 있는 시나리오에서는 서두르는 쪽의 비용이 더 크게 적혀 있습니다${cash ? ` · 현금성 자산 이자(SOFR) ${cash.value.toFixed(2)}%` : ''}.`;
    }
  },
  {
    id: 'fear-is-not-a-signal', kind: 'attitude', concept: 'H4', title: '공포에 팔고 환호에 사지 않기',
    principle: '많은 사람이 겁낼 때 가격은 이미 나쁜 소식을 상당 부분 반영하고, 모두가 낙관할 때는 좋은 소식이 이미 들어가 있습니다. 감정이 가장 강할 때가 판단이 가장 흐린 때입니다.',
    why: '군중의 감정은 가격을 한쪽으로 과하게 밀었다가 되돌립니다. 다만 공포가 크다는 것만으로 바닥이 확인되지는 않습니다.',
    live: (ctx) => {
      const w = ctx?.regime?.bottomWatch;
      if (!w || !(w.exhaustionMet >= 1)) return null;
      return `바닥 확인 조건 중 매도 소진 ${w.exhaustionMet}/${w.exhaustion.length} · 회복 확인 ${w.confirmationMet}/${w.confirmation.length}입니다 — 소진과 확인은 따로 셉니다.`;
    }
  },
  {
    id: 'no-chasing', kind: 'attitude', concept: 'H4', title: '놓칠까 봐 쫓지 않기',
    principle: '이미 많이 오른 것을 뒤늦게 쫓으면 기대가 가장 높을 때 사게 됩니다. 기회는 한 번만 오지 않습니다.',
    why: '추격은 이미 반영된 기대에 값을 치르는 일이라, 작은 실망에도 손실이 커집니다.',
    live: (ctx) => (ctx?.regime?.counts?.favorable >= 4 ? `미국 6개 지표 중 양호가 ${ctx.regime.counts.favorable}개입니다 — 좋은 소식이 가격에 많이 들어간 때일 수 있습니다.` : null)
  },
  {
    id: 'staged-entry', kind: 'strategy', concept: 'J3', title: '나눠서 들어가기 (분할 접근)',
    principle: '한 번에 들어가면 시점 하나에 결과가 걸리고, 끝까지 기다리면 상승을 놓칠 수 있습니다. 나눠서 들어가면 두 위험을 함께 줄이고, 각 단계에 "다음 단계로 가는 조건"을 붙이면 감정이 아니라 조건으로 움직이게 됩니다.',
    why: '불확실할 때 한 번의 결정에 모든 것을 거는 것보다 결정을 여러 번으로 나누는 편이 후회의 최대치를 줄입니다.',
    live: (ctx) => {
      const ids = liveIds(ctx);
      const favoring = (ctx?.direction?.live || []).filter((row) => row.favored.includes('stage')).map((row) => `'${short(row.title)}'`);
      const w = ctx?.regime?.bottomWatch;
      if (favoring.length) return `${favoring.join('·')}에서 분할 접근이 상대적으로 유리하게 적혀 있습니다.`;
      // Not while a live branch names staging costly (the avoid list would say the opposite).
      if ((ctx?.direction?.live || []).some((row) => row.costly.includes('stage'))) return null;
      if (w && w.exhaustionMet >= 2 && !ids.has('creditstress')) return `매도 소진 신호 ${w.exhaustionMet}개 · 회복 확인 ${w.confirmationMet}개 — 소진과 확인이 따로 움직이는 때입니다.`;
      return null;
    }
  },
  {
    id: 'know-when-wrong', kind: 'strategy', concept: 'J5', title: "'틀렸다'의 기준을 먼저 정하기",
    principle: '어떤 판단이든 "무엇이 나오면 이 생각이 틀린 것인가"가 미리 정해져 있으면, 손실이 감정이 아니라 조건으로 관리됩니다. 기준이 없으면 버티는 이유를 나중에 지어내게 됩니다.',
    why: '사후에 만든 이유는 확증 편향을 키웁니다. 사전에 적은 반증 조건만이 생각을 바꿀 계기가 됩니다.',
    live: (ctx) => { const row = lead(ctx); const text = row?.invalidation?.[0]; return text ? `지금 중심 시나리오 ${subject(`'${short(row.title)}'`)} 빗나가는 조건: ${text}.` : null; },
    base: true
  },
  {
    id: 'size-by-loss', kind: 'strategy', concept: 'J3', title: '확신이 아니라 감당할 손실로 크기 정하기',
    principle: '얼마나 확신하느냐가 아니라 틀렸을 때 얼마를 잃어도 괜찮은가로 크기를 정하면, 변동성이 큰 때 크기가 저절로 작아집니다.',
    why: '변동성이 두 배면 같은 크기의 손실 폭도 두 배가 됩니다. 크기는 변동성과 함께 움직여야 합니다.',
    live: (ctx) => (axisState(ctx, 'volatility') === 'burden' ? '오늘 변동성 지표가 부담입니다 — 같은 크기라도 평소보다 흔들림이 큽니다.' : null)
  },
  {
    id: 'watch-participation', kind: 'strategy', concept: 'I4', title: '지수보다 참여와 주도 영역 보기',
    principle: '지수는 시가총액이 큰 몇 종목이 끌고 갈 수 있습니다. 얼마나 많은 종목이 함께 오르는지(시장 폭)와 주도 영역이 버티는지가 흐름의 체력을 보여 줍니다.',
    why: '참여가 좁은 상승은 주도 종목 몇 개가 꺾이면 지수 전체가 함께 흔들립니다.',
    live: (ctx) => {
      const L = ctx?.regime?.leadership;
      if (L?.break) return `주도 영역이 꺾이는 신호가 확인됐습니다(${L.summary || '나스닥 100 약세'}).`;
      if (axisState(ctx, 'trend') === 'favorable' && axisState(ctx, 'breadth') === 'burden') return '추세는 양호한데 시장 폭은 부담입니다 — 소수 종목이 지수를 받치는 모양입니다.';
      return null;
    }
  },
  {
    id: 'confirm-after-release', kind: 'strategy', concept: 'H2', title: '발표 전에는 예측보다 준비',
    principle: '가격을 움직이는 것은 발표 숫자 자체가 아니라 기대와의 차이(서프라이즈)입니다. 발표 전에 결과별 대응을 정해 두고, 결과는 확인한 뒤 반영합니다.',
    why: '기대가 이미 가격에 들어가 있어, 좋은 숫자에도 떨어지고 나쁜 숫자에도 오를 수 있습니다.',
    live: (ctx) => {
      const e = ctx?.crossroads?.nextEvent; const now = ctx?.nowMs;
      if (!e || !Number.isFinite(now)) return null;
      const days = Math.round((Date.parse(`${e.date}T12:00:00Z`) - now) / 86400000);
      return days >= 0 && days <= 7 ? `${days === 0 ? '오늘' : `${days}일 뒤`} ${e.name} 결과가 나옵니다.` : null;
    }
  },
  {
    id: 'cheap-after-fall', kind: 'trap', concept: 'G6', title: "'많이 빠졌으니 싸다'",
    principle: '가격이 내렸다고 싸진 것은 아닙니다. 이익 전망이 함께 내려가면 가격이 내려도 밸류에이션은 그대로이거나 오히려 비싸집니다.',
    why: '싸다는 판단은 가격이 아니라 가격 ÷ 앞으로의 이익으로 합니다. 하락 추세에서는 그 이익이 아직 내려가는 중일 수 있습니다.',
    live: (ctx) => (axisState(ctx, 'trend') === 'burden' || ctx?.regime?.leadership?.break ? '오늘 추세가 부담이거나 주도 영역이 꺾이는 중입니다.' : null)
  },
  {
    id: 'one-day-move', kind: 'trap', concept: 'H4', title: '하루 반등·하루 급락',
    principle: '하루의 큰 움직임은 흐름이 바뀌었다는 증거가 되기 어렵습니다. 약세장에서도 큰 반등은 자주 나오고, 강세장에서도 큰 하락이 섞입니다.',
    why: '흐름의 전환은 여러 날에 걸친 참여 확대와 기준선(50일선·200일선) 회복으로 확인됩니다.',
    live: (ctx) => {
      const id = ctx?.outlook?.leadId; const item = ctx?.outlook?.items?.find((row) => row.id === id);
      return item && (item.transition || id === 'weakness') ? `지금 시장 흐름은 '${item.title}'입니다 — 하루 반등만으로는 이 흐름이 끝났는지 알 수 없습니다.` : null;
    }
  },
  {
    id: 'index-high', kind: 'trap', concept: 'G7', title: "'지수 신고가 = 시장 전체가 강함'",
    principle: '지수가 신고가여도 대부분 종목은 내리고 있을 수 있습니다. 지수는 큰 종목의 무게가 크기 때문입니다.',
    why: '시가총액 가중 지수는 상위 몇 종목이 전체 방향을 정할 수 있습니다.',
    live: (ctx) => (axisState(ctx, 'breadth') === 'burden' && axisState(ctx, 'trend') !== 'burden' ? '오늘 시장 폭이 부담인데 추세는 부담이 아닙니다.' : null)
  },
  {
    id: 'rate-cut-good', kind: 'trap', concept: 'D5', title: "'금리 인하는 무조건 호재'",
    principle: '물가가 잡혀서 내리는 금리와 경기가 꺾여서 내리는 금리는 다릅니다. 뒤의 경우에는 이익 감소가 금리 하락의 효과를 압도하기 쉽습니다.',
    why: '주가는 할인율(금리)과 이익 두 가지로 움직입니다. 금리만 보면 절반만 보는 셈입니다.',
    live: (ctx) => {
      const hits = ['slowdown', 'aibust'].map((id) => branch(ctx, id)).filter((row) => row && row.met > 0);
      return hits.length ? `${hits.map((row) => `'${short(row.title)}' ${row.fit}`).join(' · ')} — 금리는 내려도 이익이 꺾이는 시나리오입니다.` : null;
    }
  },
  {
    // v58.32 expertise review: which end of the curve moved says why rates moved (curveDynamics, 20 sessions of 2y/10y).
    id: 'read-the-curve', kind: 'strategy', concept: 'E2', title: '금리는 어느 쪽 끝이 움직였는지로 읽기',
    principle: '"금리가 내렸다"만으로는 좋고 나쁨을 알 수 없습니다. 2년물(정책 기대)과 10년물(성장·물가·기간 프리미엄) 중 어느 쪽이 더 움직였는지가 이유를 알려 줍니다.',
    why: '단기금리가 더 내리면 인하 기대(경기 둔화 또는 물가 안정), 장기금리가 더 오르면 재정·물가·기간 프리미엄 부담입니다. 같은 금리 하락도 이유에 따라 주식에 반대로 작용합니다.',
    live: (ctx) => {
      const c = ctx?.curve;
      return c?.kind ? `${c.fact} ${c.label.split(' — ')[0]}: ${c.reading}`
        : c?.uninverted ? c.uninversionReading : null;
    }
  },
  {
    // v58.32 expertise review: S&P 500 consensus revision breadth (buildIndexEarnings) — the direction of estimates.
    id: 'earnings-revisions', kind: 'trust', concept: 'H2', title: '이익 전망이 고쳐지는 방향',
    principle: '주가는 기대보다 먼저 흔들리지만, 애널리스트가 이익 전망을 올리는 회사가 많은지 내리는 회사가 많은지는 기업 현장의 변화를 더 꾸준히 보여 줍니다.',
    why: '주가는 결국 이익을 따라갑니다. 전망을 내리는 회사가 늘어나는 동안의 반등은 오래가기 어렵고, 올리는 회사가 늘면 조정이 와도 바탕이 남습니다.',
    live: (ctx) => {
      const e = ctx?.indexEarnings;
      if (!e?.available || !Number.isFinite(e.breadth) || !(e.up + e.down > 0)) return null;
      // up/down count estimate revisions (not companies), as the index-earnings card labels them; same ±0.1 tilt.
      return `최근 4주 S&P 500 이익 전망 수정은 상향 ${e.up}건 · 하향 ${e.down}건 — ${e.breadth >= 0.1 ? '올리는 쪽이 우세합니다' : e.breadth <= -0.1 ? '내리는 쪽이 우세합니다' : '양쪽이 비슷합니다'}.`;
    }
  },
  {
    id: 'headline-rumor', kind: 'trap', concept: 'H2', title: '헤드라인과 확인 안 된 소문',
    principle: '자극적인 헤드라인과 출처가 불분명한 소문은 빠르게 퍼지지만 대부분 가격에 오래 남지 않습니다. 공식 발표·실제 수치로 확인될 때까지는 판단의 근거가 아니라 확인할 거리입니다.',
    why: '확인되지 않은 정보로 움직이면 정보가 사실로 밝혀지기 전의 변동만 떠안게 됩니다.',
    live: () => null,
    base: true
  },
  {
    id: 'past-repeats', kind: 'trap', concept: 'H3', title: "'과거에 이랬으니 이번에도'",
    principle: '과거 비슷한 때의 결과는 참고일 뿐입니다. 표본이 적으면 우연일 수 있고, 전체 기간의 평균(기준선)과 다르지 않으면 그 조건만의 정보도 아닙니다.',
    why: '과거 빈도는 늘 같은 기록 전체의 기준선과 표본 수를 함께 봐야 의미가 생깁니다.',
    live: (ctx) => {
      const row = lead(ctx); const past = row?.past;
      if (!past?.n) return null;
      if (past.n < 10) return `'${short(row.title)}'의 과거 비교 표본은 ${past.n}번뿐이라 비율로 말하지 않습니다.`;
      if (pastEvidence(past).informative === false) return `'${short(row.title)}'의 과거 비교는 ${past.n}번이지만 전체 기준선과 구별되지 않아, 이 움직임만으로는 방향을 말할 수 없습니다.`;
      return row.pastConflict ? `'${short(row.title)}'의 과거 빈도는 이 시나리오의 결론과 다른 쪽을 가리킵니다(비슷한 때 ${row.pastConflict.sharePct}% 상승 · 전체 ${row.pastConflict.basePct}%).` : null;
    }
  },
  {
    id: 'count-not-probability', kind: 'trap', concept: 'H3', title: "'조건 충족 수 = 확률'",
    principle: '"조건 4개 중 3개 충족"은 그만큼 그 시나리오의 모양에 가깝다는 뜻이지 "확률 75%"라는 뜻이 아닙니다. 검증 없이 만든 확률 숫자는 정확해 보이기만 합니다.',
    why: '확률은 같은 조건에서 반복된 결과로만 말할 수 있습니다. 이 화면은 조건 수·시장 가격 방향·과거 빈도를 따로 보여 줍니다.',
    live: () => null,
    base: true
  },
  {
    id: 'trust-closes', kind: 'trust', concept: 'H1', title: '확정 종가와 공식 발표',
    principle: '장중 시세와 뉴스는 빠르지만 흔들립니다. 판단의 기준은 확정 종가, 공식 통계 발표, 날짜가 적힌 기록입니다.',
    why: '같은 기준으로 매일 비교할 수 있어야 변화가 진짜인지 구분할 수 있습니다.',
    live: () => null, // the basis date is on every card already; a live trust lesson (credit, base rate) goes first
    base: true
  },
  {
    id: 'trust-credit', kind: 'trust', concept: 'E4', title: '신용 스프레드',
    principle: '주가는 기대로 움직이지만, 회사채 금리 차이(신용 스프레드)는 실제로 돈을 빌려주는 사람들이 매기는 위험의 값입니다. 주가와 신용이 다른 말을 할 때는 신용 쪽을 더 무겁게 봅니다.',
    why: '돈줄이 마르면 이익보다 먼저 자금 조달이 막히고, 그 신호는 스프레드에 먼저 나타납니다.',
    live: (ctx) => {
      const state = axisState(ctx, 'credit');
      return state === 'burden' ? '오늘 신용 지표가 부담입니다 — 약세의 원인이 자금 쪽에 있는지 보는 신호입니다.'
        : state === 'favorable' && axisState(ctx, 'breadth') === 'burden' ? '시장 폭은 약하지만 신용은 안정입니다 — 자금 경색이 약세를 이끄는 신호는 아직 없습니다.' : null;
    }
  },
  {
    id: 'trust-base-rate', kind: 'trust', concept: 'H3', title: '기준선과 함께 보는 과거 빈도',
    principle: '"비슷한 때 이후 64% 올랐다"는 숫자는, 같은 기록 전체에서 아무 날이나 골라도 64% 올랐다면 새로운 정보가 아닙니다. 기준선과 표본 수가 함께 있을 때만 믿을 만합니다.',
    why: '주식은 장기적으로 오르는 날이 더 많아, 기준선 없이 본 상승 비율은 늘 좋아 보입니다.',
    live: (ctx) => { const row = lead(ctx); const e = pastEvidence(row?.past); return e.informative ? `'${short(row.title)}' 비교: 비슷한 때 ${e.n}번 중 ${e.sharePct}% 상승 · 전체 기준선 ${e.baseUpPct}% — 이 차이가 조건이 더하는 정보입니다.` : null; }
  }
]);

// Lessons a specific screen raises (chart, screener) — in the full library everywhere, shown live on their own screen.
// Handed over by "전문성 공백 점검" (expertise-gap REPORT 2026-10-19): chart-reading pitfalls, the screener rank's lack of
// predictive evidence, and comparing a level with expectations and its own history.
const SCREEN_LESSONS = [
  {
    id: 'level-vs-expectation', kind: 'trust', concept: 'H2', title: '숫자는 기대·자기 역사와 비교해서',
    principle: '"물가 3%", "실업률 4%" 같은 수준 하나로는 좋고 나쁨을 알 수 없습니다. 시장이 기대했던 값, 그 지표의 과거 범위, 다른 시장의 같은 지표와 비교했을 때 비로소 의미가 생깁니다.',
    why: '가격은 이미 기대를 반영하고 있어, 기대와의 차이와 평소 범위를 벗어난 정도가 움직임을 만듭니다.',
    live: () => null, base: true
  },
  {
    id: 'breakout-without-volume', kind: 'trap', scope: 'chart', concept: 'H1', title: '거래량 없는 돌파',
    principle: '가격이 저항선을 넘어도 거래량이 평소보다 늘지 않으면 참여가 얇은 돌파라 다시 밀려 내려오기 쉽습니다.',
    why: '돌파의 힘은 새로 사려는 사람의 수에서 나오고, 그 수는 거래량으로 드러납니다.',
    live: () => null
  },
  {
    id: 'extended-entry', kind: 'trap', scope: 'chart', concept: 'H4', title: '이미 멀리 달아난 뒤의 진입',
    principle: '평균선에서 평소 변동폭의 여러 배만큼 떨어진 뒤에는 작은 되돌림에도 손실 폭이 커집니다. 좋은 종목이어도 늘어난 자리는 좋은 자리가 아닐 수 있습니다.',
    why: '가격은 평균선 쪽으로 되돌아가려는 경향이 있어, 멀어질수록 되돌림의 크기도 커집니다.',
    live: () => null
  },
  {
    id: 'news-gap', kind: 'trap', scope: 'chart', concept: 'H2', title: '뉴스로 생긴 갭',
    principle: '뉴스로 크게 뛰거나 빠진 갭은 첫날 움직임이 과장되기 쉽습니다. 갭이 며칠 동안 메워지지 않고 유지되는지가 진짜 변화인지 가르는 기준입니다.',
    why: '첫 반응은 감정과 포지션 정리가 섞여 있고, 며칠 뒤에야 새 정보가 가격에 자리를 잡습니다.',
    live: () => null
  },
  {
    id: 'weekly-filters-daily', kind: 'strategy', scope: 'chart', concept: 'J5', title: '큰 흐름이 작은 흐름을 거른다',
    principle: '주봉이 내려가는 중의 일봉 돌파는 큰 흐름을 거스르는 신호라 실패가 잦습니다. 일봉 신호는 주봉 방향과 같을 때 더 믿을 만합니다.',
    why: '더 긴 시간대에는 더 많은 참여자의 결정이 쌓여 있어, 짧은 시간대의 신호를 이기는 경우가 많습니다.',
    live: () => null
  },
  {
    id: 'rank-is-not-edge', kind: 'trap', scope: 'screener', concept: 'H3', title: "'순위가 높으면 오른다'",
    principle: '스크리너의 순위는 조건에 맞는 정도를 정렬한 것이지 앞으로의 수익을 예측한 점수가 아닙니다. 순위가 수익과 같은 방향이었는지는 순위를 먼저 적어 두고 나중에 결과를 채운 기록으로만 말할 수 있습니다.',
    why: '과거 데이터로 만든 순위는 살아남은 종목만 보는 편향과 우연에 쉽게 속습니다. 순위는 살펴볼 후보를 줄이는 도구입니다.',
    // Expertise review 2 (2026-10-19): what the forward record says now (candidate-record independentEvidence), so the
    // lesson never states a verdict the record has not reached. It describes the whole ranking, not one stock.
    screenWide: true,
    live: (ctx) => {
      const ind = ctx?.rankEvidence;
      if (!ind?.decision) return null;
      // The record keeps only the default-weight ranking and decides on the US rank IC alone, so every sentence names
      // that scope (a KR tab or a selected profile is not what was tested), and the count is the one the decision used.
      const scope = '기본 가중치 미국 순위';
      const ic = ind.icUS || {};
      if (ind.decision === 'supported') return `지금 기록(겹치지 않는 ${ic.n ?? ind.n}개)에서는 ${scope}가 다음 21거래일 수익률과 통계적으로 같은 방향이었습니다. 그래도 순위는 후보를 줄이는 근거이고, 진입 자리와 손실 한도는 따로 정해야 합니다.`;
      if (ind.decision === 'not-supported') {
        if (ic.mean < 0 && ic.t <= -2) return `지금 기록(겹치지 않는 ${ic.n ?? ind.n}개)에서는 ${scope}가 다음 21거래일 수익률과 오히려 반대 방향이었습니다. 상위 순위를 매수 후보의 근거로 쓰지 말 것.`;
        return `지금 기록(겹치지 않는 ${ic.n ?? ind.n}개)에서는 ${scope}와 이후 수익률 사이에 같은 방향의 관계가 확인되지 않았습니다(우연과 구분되지 않습니다). 순위만으로 고르지 말고 이유를 따로 확인할 것.`;
      }
      const n = Math.min(ind.n || 0, ic.n ?? ind.n ?? 0);
      return n ? `${scope}를 판단할 겹치지 않는 기록이 ${n}개뿐이라(${ind.min}개부터 판단) 순위가 수익과 같은 방향인지는 아직 모릅니다.`
        : `순위를 먼저 적어 두는 기록의 결과가 아직 없어(겹치지 않는 기록 ${ind.min}개부터 판단) ${scope}가 수익과 같은 방향인지는 아직 모릅니다.`;
    }
  }
];

export const ALL_LESSONS = Object.freeze([...LESSONS, ...SCREEN_LESSONS]);
export const LESSON_BY_ID = Object.freeze(Object.fromEntries(ALL_LESSONS.map((lesson) => [lesson.id, lesson])));

/** The lessons today's data touches (with their live sentence), at most `perKind` per kind, plus the base lessons when room remains. */
export function selectLessons(ctx, { perKind = 2, limit = 7, scope = 'market' } = {}) {
  const rows = ALL_LESSONS.filter((lesson) => (lesson.scope || 'market') === scope).map((lesson) => { let reason = null; try { reason = lesson.live(ctx); } catch (_) { reason = null; } return { ...lesson, reason }; });
  const picked = [];
  const count = {};
  const take = (row) => { if (!row || picked.length >= limit || (count[row.kind] || 0) >= perKind || picked.includes(row)) return; picked.push(row); count[row.kind] = (count[row.kind] || 0) + 1; };
  const order = Object.keys(LESSON_KINDS);
  // Every kind gets its best entry first (a live one, else a base one), then the remaining live ones, then base ones.
  for (const kind of order) take(rows.find((row) => row.kind === kind && row.reason) || rows.find((row) => row.kind === kind && row.base));
  rows.filter((row) => row.reason).forEach(take);
  rows.filter((row) => row.base).forEach(take);
  return picked.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).map(({ live, ...row }) => row);
}

// Which principles each screen raises (the 오늘 card uses selectLessons over the whole market scope). Order is the
// screen's own priority; a lesson today's data touches moves ahead of the rest.
export const SCREEN_LESSON_IDS = Object.freeze({
  signal: ['watch-participation', 'earnings-revisions', 'index-high', 'one-day-move', 'fear-is-not-a-signal', 'trust-credit', 'no-chasing'],
  breadth: ['watch-participation', 'index-high', 'one-day-move', 'trust-closes'],
  sentiment: ['fear-is-not-a-signal', 'no-chasing', 'one-day-move', 'trust-credit'],
  macro: ['rate-cut-good', 'read-the-curve', 'level-vs-expectation', 'confirm-after-release', 'conditions-not-forecasts', 'count-not-probability', 'past-repeats', 'trust-base-rate'],
  fxbond: ['read-the-curve', 'level-vs-expectation', 'rate-cut-good', 'trust-credit', 'confirm-after-release'],
  themes: ['watch-participation', 'no-chasing', 'cheap-after-fall', 'past-repeats'],
  'theme-detail': ['no-chasing', 'cheap-after-fall', 'headline-rumor', 'past-repeats'],
  technical: ['breakout-without-volume', 'extended-entry', 'weekly-filters-daily', 'news-gap', 'know-when-wrong', 'cheap-after-fall'],
  ticker: ['cheap-after-fall', 'news-gap', 'headline-rumor', 'know-when-wrong'],
  fundamental: ['cheap-after-fall', 'earnings-revisions', 'level-vs-expectation', 'headline-rumor'],
  screener: ['rank-is-not-edge', 'extended-entry', 'past-repeats', 'no-chasing'],
  portfolio: ['survive-first', 'size-by-loss', 'staged-entry', 'know-when-wrong', 'waiting-is-a-choice'],
  briefing: ['headline-rumor', 'confirm-after-release', 'one-day-move', 'level-vs-expectation'],
  'market-news': ['headline-rumor', 'news-gap', 'one-day-move']
});

/** The lessons a screen raises, those today's data touches first (with their reason), at most `limit`. */
// A single stock's screens read the lesson as a principle: the live sentences describe the whole market, and a market
// reason ("중심 시나리오가 빗나가는 조건") beside one company's chart would read as if it were about that company.
const STOCK_SCREENS = new Set(['technical', 'ticker', 'fundamental', 'screener']);

export function selectScreenLessons(routeId, ctx, { limit = 4 } = {}) {
  const ids = SCREEN_LESSON_IDS[routeId] || [];
  const marketReasons = !STOCK_SCREENS.has(routeId);
  // screenWide lessons (the ranking's own record) describe the screen, not the company on it, so they keep their reason.
  const rows = ids.map((id) => LESSON_BY_ID[id]).filter(Boolean).map((lesson) => { let reason = null; try { reason = marketReasons || lesson.screenWide ? lesson.live(ctx) : null; } catch (_) { reason = null; } return { ...lesson, reason }; });
  return [...rows.filter((row) => row.reason), ...rows.filter((row) => !row.reason)].slice(0, limit).map(({ live, ...row }) => row);
}
