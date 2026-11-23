// The growth × inflation quadrant's rule in words, for the 매크로 method fold, with the speed's hold band and the verdict
// line. Kept out of macro-read.js (a boot module): only the lazy macro board reads it.
// A direction is set only by a signal past its cut. Within the dead band (growth: half the slowdown step
// around the cut; prices: |3-month pace − year| below the re-acceleration step) the direction is held, and "no slowdown
// signal" alone is not read as 견조 — 견조 needs the payroll level the growth axis calls solid.
import { RULES } from '../rules/thresholds.js';

const G = RULES.growth;
const I = RULES.inflation;

export const REGIME_CRITERIA = `성장 방향: Sahm 지표 ${G.sahmWatchAt}%p 이상이거나 최근 3개월 일자리 증가가 그 전 3개월보다 ${G.payrollSlowdownK / 10}만 명 넘게 적으면 둔화, 둔화 신호가 없고 3개월 평균이 ${G.payrollSolidK / 10}만 명 이상이면 견조, 둘 다 아니면 확인 안 됨, 둔화 기준과의 차이가 ${(G.payrollSlowdownK / 2 * 1000).toLocaleString('en-US')}명 미만이면 근소(경계)로 보고 방향을 정하지 않음. 물가 속도: 근원 PCE와 근원 CPI 각각의 최근 3개월 속도(연율)와 전년 대비의 차이가 ${I.reaccelPp}%p 이상이면 그 쪽(빠르면 상승, 느리면 둔화), 정해진 방향은 차이가 ${I.holdPp}%p 안으로 돌아올 때까지 유지(최근 ${I.latchMonths}개월 발표 기준), 두 지표가 같은 쪽이면 그 방향, 반대쪽이면 엇갈림, 그 밖에는 보류, 방향이 바뀌는 선까지 ${I.edgePp}%p 미만이면 경계. 두 방향이 모두 정해질 때만 사분면에 점을 찍고, 판정 줄은 늘 물가 수준(목표 ${I.targetPct}%, ${I.nearTargetPct}% 초과면 목표 위), 속도, 성장, 연준 국면(최근 180일 기준금리 변경) 순으로 씁니다.`;
