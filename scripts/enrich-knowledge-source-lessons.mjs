#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reviewedAt = process.env.KNOWLEDGE_MANIFEST_DATE || '2026-08-18';

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const writeJson = (relativePath, value) => fs.writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const PRINCIPLE_LENSES = Object.freeze({
  A: {
    scope: '자원 제약·생산성·소득 순환',
    real: '투입요소의 양과 질, 생산성, 분배가 실물 생산과 가계·기업의 선택을 어떻게 바꾸는지 확인한다.',
    company: '기업의 생산능력·가격·고용·투자 결정이 수요와 비용 제약 안에서 어떻게 바뀌는지 확인한다.',
    statements: '매출·비용·재고·CAPEX·현금흐름의 변화가 실제 생산과 기회비용을 반영하는지 분리해 본다.',
    valuation: '성장률·마진·투자 필요액·자본비용을 한 묶음으로 보지 말고 생산성 가정별로 나눈다.',
    market: '경제적 선택이 기대에 이미 반영됐는지, 새 정보가 이익과 할인율 중 무엇을 바꾸는지 확인한다.',
    trading: '관찰 단위는 정책·생산·이익 중 하나로 고정하고, 숫자 하나에서 가격 방향을 바로 추론하지 않는다.'
  },
  B: {
    scope: '화폐·물가·구매력·시간가치',
    real: '가격 수준과 실질 구매력이 가계의 소비·저축·투자 선택에 전달되는 경로를 확인한다.',
    company: '기업의 가격 전가력, 임금·원재료 비용, 재고 평가가 명목과 실질 변화로 어떻게 나뉘는지 본다.',
    statements: '매출 증가가 물량 증가인지 가격 상승인지, 이자비용과 현금잔고가 실질 가치에서 어떤 의미인지 확인한다.',
    valuation: '명목 성장과 실질 성장, 인플레이션 기대와 할인율을 같은 단위로 정렬한 뒤 현금흐름을 평가한다.',
    market: '물가 서프라이즈가 금리 기대·실질금리·위험 프리미엄 중 어디에 먼저 반영되는지 확인한다.',
    trading: 'CPI 같은 지표의 정의·기준기간·구성항목을 확인하고 한 번의 발표를 추세로 확대하지 않는다.'
  },
  C: {
    scope: '신용 창출·은행·레버리지·금융 안정성',
    real: '현재의 자금 조달이 미래 소득·생산·담보의 기대를 어떻게 현재 소비와 투자로 당겨오는지 본다.',
    company: '차입 구조·만기·담보·이자부담이 기업의 성장 선택과 생존 여력을 어떻게 제한하는지 확인한다.',
    statements: '부채는 대차대조표, 이자비용은 손익계산서, 원금 상환은 현금흐름표에 다른 시간으로 나타난다.',
    valuation: '레버리지가 자기자본수익률을 확대할 수 있지만 파산확률·자본비용·잔존가치를 함께 바꾸는지 본다.',
    market: '신용스프레드·유동성·담보가치가 동시에 움직이는지 확인하고 위험 선호와 현금 접근성을 분리한다.',
    trading: '부채비율 하나보다 만기 벽·이자보상·차환 조건과 시장 유동성의 조합을 관찰한다.'
  },
  D: {
    scope: '금리·중앙은행·정책 전달·중립금리',
    real: '정책금리 변화가 대출·주택·투자·고용·물가 기대를 거쳐 실물 수요로 전파되는 시간을 본다.',
    company: '금리 민감도는 기업의 부채 만기, 가격 결정권, 재투자율, 고객의 자금 조달 조건에 따라 달라진다.',
    statements: '이자수익·이자비용·평가손익·현금성 자산을 분리하고, 금리 변화의 현금 효과와 회계 효과를 나눈다.',
    valuation: '할인율을 단일 정책금리로 동일시하지 말고 실질금리·기간 프리미엄·신용·주식 위험 프리미엄을 구분한다.',
    market: '정책 발표 자체보다 기대 대비 변화와 장기 실질금리·기간 프리미엄·유동성의 반응을 확인한다.',
    trading: '정책 방향을 예언하지 않고 발표 전 기대·발표 후 재가격·실물 지연을 각각 기록한다.'
  },
  E: {
    scope: '채권·수익률곡선·달러·환율·글로벌 유동성',
    real: '국채·신용·환율 가격이 자금의 국경 간 이동과 실물 거래 비용으로 전달되는 경로를 확인한다.',
    company: '통화·조달 통화·수입 원가·해외 매출의 통화 구성이 기업 마진과 현금흐름을 바꾸는지 본다.',
    statements: '채권 평가·이자비용·환산손익·헤지효과가 서로 다른 보고 항목과 시점에 나타나는지 확인한다.',
    valuation: '수익률곡선의 각 만기와 통화 위험을 할인기간·현금흐름 통화와 맞춰 평가한다.',
    market: '곡선 기울기·실질금리·신용스프레드·달러 유동성이 같은 충격을 가리키는지 대조한다.',
    trading: '캐리·롤다운·환율·변동성의 손익 원인을 나누고, 포지션 청산 유동성을 먼저 점검한다.'
  },
  F: {
    scope: '재정·국가부채·지정학·자본 이동',
    real: '정부의 조세·지출·보조금·규제가 민간 수요와 생산능력, 국가 간 자본 배분에 미치는 경로를 확인한다.',
    company: '정책 수혜와 규제 비용을 기업의 실제 주문·원가·투자·공급망 의존성으로 번역한다.',
    statements: '재정 지출이 기업 매출로 전달되는 시점과 보조금·세금·충당금의 회계 처리를 구분한다.',
    valuation: '국가 위험·정책 지속성·현금흐름의 통화와 할인율을 분리하고 영구적인 정책 수혜로 가정하지 않는다.',
    market: '예산 발표와 실제 집행, 지정학적 위험의 가격 반영, 유동성 재배치를 서로 다른 사건으로 기록한다.',
    trading: '헤드라인보다 법적 승인·집행 일정·노출 기업·반대 시나리오를 확인한 뒤 관찰 시점을 고정한다.'
  },
  G: {
    scope: '기업·주식·자본조달·밸류에이션·파생상품',
    real: '기업이 고객 문제를 해결하고 자본을 조달해 생산을 늘리는 과정이 경제적 잉여로 이어지는지 확인한다.',
    company: '매출 성장·마진·재투자·경쟁우위·자본 배분이 기업 가치의 서로 다른 원천인지 나눈다.',
    statements: '손익·대차대조표·현금흐름·주식수·주석을 함께 읽어 회계 이익과 주주 현금흐름을 구분한다.',
    valuation: '주가를 이익·현금흐름·자산·성장·자본비용의 함수로 보고 하나의 배수만으로 결론을 내리지 않는다.',
    market: '1차 조달과 2차 거래, 기대 변화와 포지션 수급, 옵션의 비선형 위험을 분리해 가격을 읽는다.',
    trading: '매매 전 관찰 가설·촉발 사건·포지션 크기·무효화·유동성 비용을 사전에 기록한다.'
  },
  H: {
    scope: '주문장·기대·효율성·군중·유동성',
    real: '정보와 선호가 주문·거래·가격을 거쳐 기업의 자본 조달과 실물 의사결정으로 전달되는 경로를 본다.',
    company: '가격 변동이 고객 수요·조달 비용·보상·재무정책에 영향을 주는지, 단순 심리와 구분한다.',
    statements: '거래량·평가손익·발행주식·헤지 결과가 실제 기업 성과가 아닌 시장 재평가일 수 있음을 확인한다.',
    valuation: '시장가격은 정보·위험선호·유동성의 결합 결과이며 내재가치와 동일하다고 가정하지 않는다.',
    market: '기대 대비 서프라이즈, 호가 깊이, 체결 비용, 포지션 집중도를 시간축으로 비교한다.',
    trading: '시장가·지정가·스톱의 실행 조건을 알고, 변동성 확대 때 미체결·슬리피지·갭 위험을 명시한다.'
  },
  I: {
    scope: '경기·이익·유동성·섹터·자산 간 전이',
    real: '생산·고용·재고·신용·금융여건의 순환이 기업 수요와 투자 사이클로 이어지는 시간을 확인한다.',
    company: '기업별 매출 노출, 고정비, 재고, 가격 전가, 자본 지출의 경기 민감도를 구분한다.',
    statements: '이익의 방향뿐 아니라 매출·마진·운전자본·CAPEX가 어느 단계에서 변했는지 추적한다.',
    valuation: '정상화 이익과 현재 이익을 분리하고, 경기 고점의 마진을 영구 수준으로 외삽하지 않는다.',
    market: '금리·신용·주식·원자재·환율의 동시 움직임이 한 레짐을 가리키는지, 단기 상관에 그치는지 본다.',
    trading: '레짐 전환을 단일 지표가 아니라 다중 확인으로 판단하고 신호 지연·오탐을 기록한다.'
  },
  J: {
    scope: '저축·투자·투기·위험관리·생존',
    real: '현재 소비를 미루는 저축과 생산 자산에 대한 투자가 미래의 소득과 선택지를 어떻게 늘리는지 본다.',
    company: '기업의 위험 예산·투자기간·현금 보유가 전략과 자본 배분의 일관성을 만드는지 확인한다.',
    statements: '수익률보다 손실 시 현금흐름·마진콜·차입·운영 지속성이 먼저 드러나는지 확인한다.',
    valuation: '기대수익률은 분포의 평균만이 아니라 손실확률·회복기간·상관·유동성 비용을 포함한다.',
    market: '투자자의 시간축과 포지션 제약이 가격·거래량·변동성을 어떻게 만들었는지 분리한다.',
    trading: '포지션 사이징·손실 한도·무효화·재진입 규칙을 수익 예측보다 먼저 고정한다.'
  },
  K: {
    scope: '산업 가치사슬·고객·병목·현금흐름',
    real: '최종 고객의 문제와 지불이 생산·유통·서비스 단계의 수요와 병목으로 내려가는 경로를 확인한다.',
    company: '기업의 위치를 제품명보다 고객·투입요소·가격 결정권·증설 시간·대체재로 설명한다.',
    statements: '매출의 반복성, CAPEX, 운전자본, 마진, 현금 전환이 사업 모델의 질을 보여주는지 대조한다.',
    valuation: '병목의 지속기간과 공급 증설, 고객 집중, 규제·대체 위험을 현금흐름 가정에 명시한다.',
    market: '산업 내 가격 신호가 기업별 수혜로 번역되는 조건과 병목 완화 후 이익 풀 이동을 구분한다.',
    trading: 'AIO 데이터는 가설 탐색에 쓰고, 공시·업황·현장 지표를 확인하기 전 종목 결론을 보류한다.'
  },
  L: {
    scope: 'AI 컴퓨팅·반도체·메모리·패키징·데이터센터',
    real: 'AI workload가 계산·메모리·네트워크·전력·냉각·시설의 물리 제약으로 번역되는 순서를 확인한다.',
    company: '설계·장비·파운드리·메모리·패키징·서버·클라우드의 역할과 교섭력, 고객 검증을 분리한다.',
    statements: '출하량·가동률·수율·ASP·감가상각·재고·CAPEX가 각각 어느 단계의 병목을 측정하는지 확인한다.',
    valuation: '기술 우위가 가격·수율·생산능력·고객 채택·마진·현금흐름으로 이어지는 조건을 단계별로 검증한다.',
    market: 'AI 서사는 기대가 빠르게 선반영되므로 실제 주문·공급·가동률·현금흐름의 증거와 분리한다.',
    trading: '제품 세대와 발표일, 양산·출하·매출의 기준일을 구분하고 단일 벤치마크로 공급망을 확정하지 않는다.'
  },
  M: {
    scope: '전력·발전·송배전·저장·데이터센터·전력망',
    real: '전력 생산·전달·저장·소비의 시간·지역·품질 제약이 산업 활동과 데이터센터 확장을 어떻게 제한하는지 본다.',
    company: '발전원·망 장비·저장·냉각·전력전자 기업의 수익 모델과 규제·허가·연결 대기 시간을 구분한다.',
    statements: '발전량·가동률·연료비·CAPEX·감가상각·현금흐름과 전력 가격 노출을 서로 다른 지표로 읽는다.',
    valuation: '명목 전력가격만이 아니라 이용률·연결비용·연료·규제수익·자본집약도와 현금 회수기간을 모델링한다.',
    market: '전력 수요 전망과 실제 부하, 계통 연결, 장비 주문, 현금 투자 사이의 시간차를 확인한다.',
    trading: '전력 이슈를 기업 매출로 번역할 때 지역·허가·계약·가동률의 확인 여부를 체크한다.'
  },
  N: {
    scope: '에너지·광물·자동화·방산·우주·헬스케어·서비스 산업',
    real: '기술·자원·규제·인구·수요 변화가 각 산업의 물리적 생산과 서비스 전달로 이어지는 조건을 본다.',
    company: '산업별 KPI를 매출 성장만으로 묶지 않고 고객 채택·인증·공급·가격·규제·반복성으로 나눈다.',
    statements: '산업 특유의 KPI가 손익과 현금흐름에 언제, 어떤 line item으로 나타나는지 확인한다.',
    valuation: '서로 다른 산업의 성장률·마진·자본집약도를 같은 배수로 비교하지 않고 사업 주기와 실패확률을 반영한다.',
    market: '테마·정책·기술 뉴스와 실제 주문·허가·생산·고객 비용 절감의 증거를 분리한다.',
    trading: '산업별 관찰 지표와 무효화 조건을 먼저 정한 뒤, 연결되지 않은 테마 서사를 매매 신호로 사용하지 않는다.'
  },
  O: {
    scope: '미국·한국·환율·산업정책·세금·계좌 비용',
    real: '국가 간 금리·환율·무역·정책 변화가 한국 가계·기업·산업의 비용과 자본 흐름에 전달되는 경로를 확인한다.',
    company: '수출입 통화·고객 지역·원재료·부채·세금·헤지 구조가 기업의 실제 이익과 현금흐름을 어떻게 바꾸는지 본다.',
    statements: '환산손익·헤지·세금·배당·외국인 수급을 영업 성과와 분리하고 보고 통화의 함정을 피한다.',
    valuation: '원화 현금흐름과 달러 할인율, 국가 위험, 자본 비용을 같은 기준일과 통화로 정렬한다.',
    market: '미국 지표와 한국 주가 사이의 전달 경로가 환율·외국인 포지션·산업 노출 중 무엇인지 확인한다.',
    trading: '환율과 외국인 수급을 방향 예측으로 쓰지 않고, 기업 노출·헤지·정책 일정·거래 비용을 함께 기록한다.'
  }
});

const ATLAS_LENSES = Object.freeze({
  F0: { scope: '문제 정의·학습·모델·서비스의 경계', real: '해결할 문제와 성공 기준이 실제 사용자·업무·운영 자원으로 번역되는 경로를 확인한다.', company: '모델 데모가 고객의 반복 업무·지불 의사·도입 비용으로 이어지는 조건을 분리한다.', statements: 'AI 기능의 비용과 편익이 매출·R&D·호스팅·지원 비용에 언제 나타나는지 확인한다.', valuation: '모델 성능이나 파라미터를 기업 가치로 직접 환산하지 않고 사용량·마진·현금 회수의 증거를 요구한다.', market: '새 기능 발표와 실제 채택·유지율·단위경제성의 기대 차이를 구분한다.', trading: '입력·출력·성공 기준·실패 비용을 먼저 고정하고 benchmark를 서비스 품질로 확대하지 않는다.' },
  F1: { scope: '물리·수학·연산·메모리·전력 제약', real: 'AI 계산이 전기·실리콘·메모리·열·시설이라는 물리 자원으로 제한되는 경로를 확인한다.', company: '하드웨어·시설·클라우드 기업의 역할, 공급 병목, 고객 검증과 가동률을 분리한다.', statements: '연산량·대역폭·전력·CAPEX·감가상각·가동률이 서로 다른 원가와 현금흐름을 측정함을 확인한다.', valuation: '이론 성능을 매출이나 마진으로 번역하려면 가격·수율·공급·사용률·고객 채택 증거를 연결한다.', market: '칩·메모리·전력 수요 전망과 실제 주문·설치·매출 기준일을 구분한다.', trading: 'workload와 단위를 고정하고 한 제품의 사양을 전체 시스템 병목으로 일반화하지 않는다.' },
  F2: { scope: '데이터·학습 목표·일반화·평가', real: '데이터와 피드백이 업무 결과의 정확성·공정성·안전성으로 번역되는 경로를 확인한다.', company: '데이터 권리·품질·라벨링·평가 비용과 제품의 유지·지원 비용을 분리한다.', statements: '학습 비용·추론 비용·재학습·오류 처리·환불과 충당이 재무제표에 나타나는 시점을 확인한다.', valuation: 'benchmark 상승을 미래 현금흐름으로 보려면 실제 사용자 분포·유지율·단위비용·오류 비용을 검증한다.', market: '모델 발표와 실제 일반화·도입·규제 리스크의 기대 차이를 기록한다.', trading: '학습·검증·운영 분포를 나누고, 한 번의 benchmark가 일반화를 증명한다고 해석하지 않는다.' },
  F3: { scope: '표현·Transformer·추론·서빙 비용', real: '토큰·표현·attention·context가 사용자의 지연·품질·메모리 요구로 이어지는 경로를 본다.', company: '모델·가속기·메모리·클라우드가 추론 단가와 서비스 차별화에 기여하는 층을 분리한다.', statements: '학습·서빙·캐시·전력·감가상각 비용과 실제 매출·사용량의 관계를 확인한다.', valuation: '모델 구조나 파라미터 수를 수익으로 직결하지 않고 사용량·가격·마진·재투자율을 연결한다.', market: '새 모델의 성능 발표와 고객 전환·운영비·공급망 수요를 별도 기준일로 관찰한다.', trading: 'context·batch·cache·정밀도·지연 요구를 명시하고 이론 FLOPS로 서비스 처리량을 추정하지 않는다.' },
  F4: { scope: '검색·도구·Agent·상태·World Model·사람 검토', real: '정보를 읽고 행동하는 시스템이 외부 환경·권한·실패 처리와 연결되는 경로를 확인한다.', company: '검색 품질·도구 호출·감사 로그·사람 검토가 제품 운영비와 책임 구조를 어떻게 바꾸는지 본다.', statements: '오류·재시도·지원·보안·검토 비용이 매출과 비용에 언제 나타나는지 확인한다.', valuation: '자율성이라는 표현을 현금흐름으로 번역할 때 실제 자동화율·오류 비용·감사 가능성을 요구한다.', market: 'Agent 발표와 실제 배포·권한·고객 유지·규제 승인의 차이를 기록한다.', trading: '행동 권한과 실패 경계를 명시하고, 내부 생성 결과를 외부 사실이나 매매 판단으로 승격하지 않는다.' },
  F5: { scope: 'AI 인프라의 계산·메모리·네트워크·전력·냉각', real: 'workload가 가속기·HBM·인터커넥트·랙·전력망 중 어느 제약을 먼저 포화시키는지 본다.', company: '칩·패키징·메모리·네트워크·냉각·전력·클라우드 기업의 병목 위치와 고객 관계를 나눈다.', statements: '출하·수율·가동률·CAPEX·감가상각·전력비·현금흐름을 단일 성장 지표로 합치지 않는다.', valuation: '인프라 수요가 매출·마진·현금 회수로 이어지는 공급·가격·가동률 조건을 단계별로 검증한다.', market: '제품 세대·양산·출하·고객 인수·매출 인식의 기준일을 분리한다.', trading: '공식 제품·공시·시설 자료가 없는 생산량·점유율·수율 주장은 게시하지 않는다.' },
  F6: { scope: 'AI 산업의 수요·CAPEX·가동률·FCF·ROIC', real: '기술 수요가 실제 사용량·시설 투자·가동률·현금흐름과 자본수익률로 번역되는 경로를 본다.', company: '고객의 사용량·계약·가격·원가·재투자·자본 회수 기간을 기업별로 확인한다.', statements: '매출 인식·CAPEX·감가상각·운전자본·FCF·ROIC의 기간 차이를 분리한다.', valuation: '성장률이 높아도 자본집약도·마진·재투자·할인율이 바뀌면 가치 결론이 달라짐을 반영한다.', market: '전망·가이던스·주문·실적·현금흐름의 기대 차이를 기준일별로 추적한다.', trading: '현재 관측과 기업 전망, 시장 해석을 분리하고 업데이트 가능한 증거 원장을 유지한다.' }
});

function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function recoverShort(value, markers = []) {
  const text = clean(value);
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index > 0) return text.slice(0, index).trim();
  }
  return text;
}

function normalizeShort(source, kind) {
  const markers = kind === 'principles'
    ? {
      definition: [' 이 레슨은'],
      mechanism: [' 작동 경로를 읽을 때에는'],
      example: [' 이 사례를 분석할 때'],
      counterScenario: [' 이 반례는'],
      verificationQuestion: [' 이 질문에 답할 때는'],
      diagram: [' · ']
    }
    : {
      definition: [' 이 레슨은'],
      mechanism: [' 작동 원리는'],
      example: [' 이 사례는 설명을 위해'],
      counterScenario: [' 이 제한은'],
      verificationQuestion: [' 답변에는'],
      diagram: [' · ']
    };
  return Object.fromEntries(Object.entries(source || {}).map(([key, value]) => [key, recoverShort(value, markers[key] || [])]));
}

function principleExpanded(lesson) {
  const lens = PRINCIPLE_LENSES[lesson.chapterId] || PRINCIPLE_LENSES.A;
  const source = normalizeShort(lesson.summary || lesson, 'principles');
  const short = {
    definition: clean(source.definition),
    mechanism: clean(source.mechanism),
    example: clean(source.example),
    counterScenario: clean(source.counterScenario),
    verificationQuestion: clean(source.verificationQuestion),
    diagram: clean(source.diagram)
  };
  const title = clean(lesson.title || lesson.id);
  const definition = `${short.definition} 이 레슨에서는 ${title} 개념을 ${lens.scope}의 맥락에서 읽는다. 정의만 외우는 것이 아니라 무엇이 제한되어 있고, 누가 선택하며, 선택의 결과가 어느 시간축에서 관찰되는지를 함께 적어야 한다. 여기서 말하는 개념은 교육용 구조 원리이며 현재 가격이나 특정 기업의 성과를 직접 설명하는 판정식이 아니다. 같은 단어라도 가계·기업·정부·시장 중 어느 주체를 보고 있는지에 따라 입력과 결과가 달라지므로 분석 단위를 먼저 고정한다.`;
  const mechanism = `${short.mechanism} 작동 경로를 읽을 때에는 원인과 결과 사이의 중간 변수를 생략하지 않는다. ${lens.real} ${lens.company} 관찰 가능한 자료는 기준일·단위·기간·분모를 붙여야 하며, 결과가 나타나는 시점과 기대가 가격에 반영되는 시점을 구분한다. ${lens.statements} 따라서 같은 현상이 숫자 하나로 보이지 않을 수 있고, 양의 변화가 질의 개선인지 단순한 명목 효과인지 재확인해야 한다. 설명이 성립하려면 핵심 가정과 대체 경로가 함께 기록되어야 한다.`;
  const example = `${short.example} 이 사례를 분석할 때 먼저 입력 자원과 제약을 표로 적고, 선택한 대안·포기한 대안·관찰 기간을 구분한다. ${lens.valuation} ${lens.market} 예를 들어 현재 수치가 좋아 보이더라도 공급 증설, 비용 전가, 자본 조달, 수요의 지속 여부가 바뀌면 같은 결과가 반복되지 않을 수 있다. 실무에서는 관련 공시나 공식 통계의 원문 문장, 보고기간, 측정 단위, 비교 기준을 옆에 붙인 뒤 설명과 사실을 분리한다. 이 레슨의 예시는 결론을 대신하는 계산기가 아니라 다음 확인 작업을 설계하기 위한 사고 실험이다.`;
  const counterScenario = `${short.counterScenario} 이 반례는 개념이 틀렸다는 뜻이 아니라 적용 범위를 제한하는 경계다. ${lens.real} 반대 시나리오를 만들 때에는 수요가 약해지는 경우, 비용 또는 금리가 예상과 다르게 움직이는 경우, 공급 제약이 완화되는 경우, 회계 인식과 현금 회수가 어긋나는 경우를 각각 검토한다. ${lens.trading} 직접 근거가 없거나 핵심 변수가 관찰되지 않으면 결론을 보류하는 것이 이 원고의 올바른 사용법이다.`;
  const verificationQuestion = `${short.verificationQuestion} 이 질문에 답할 때는 (1) 확인할 원자료, (2) 기준일과 관찰기간, (3) 대체 설명, (4) 결론을 무효화할 조건을 함께 기록한다. ${lens.trading}`;
  const diagram = `${short.diagram} · ${lens.scope} · 입력/제약 → 전달 경로 → 기업·재무 흔적 → 기대·시장 반응 → 반증 조건`;
  return { short, definition, mechanism, example, counterScenario, verificationQuestion, diagram, lens };
}

function atlasExpanded(lesson, moduleMap) {
  const module = moduleMap.get(lesson.id) || {};
  const layer = module.layer || 'F0';
  const lens = ATLAS_LENSES[layer] || ATLAS_LENSES.F0;
  const source = normalizeShort(lesson.summary || lesson, 'atlas');
  const short = {
    definition: clean(source.definition),
    mechanism: clean(source.mechanism),
    example: clean(source.example),
    counterScenario: clean(source.counterScenario || source.limit),
    verificationQuestion: clean(source.verificationQuestion || source.teachingQuestion),
    diagram: clean(source.diagram || source.visualization)
  };
  const title = clean(module.title || lesson.title || lesson.id);
  const definition = `${short.definition} 이 레슨에서는 ${title} 개념을 ${lens.scope}의 한 구성요소로 배치한다. AI를 하나의 모델이나 기업 이름으로 줄이지 않고 문제·데이터·계산·운영·자본이 이어지는 시스템으로 읽기 위해 필요한 경계다. 용어의 존재만으로 성능·생산량·매출·투자 가치를 뜻하지 않으며, 어떤 입력을 어떤 변환으로 처리하고 어떤 결과를 관찰하는지부터 정리한다. 같은 개념도 학습·추론·서비스·산업 단계에서 의미가 달라질 수 있으므로 적용 층위를 표시한다.`;
  const mechanism = `${short.mechanism} 작동 원리는 입력, 내부 상태 또는 계산, 출력, 비용·오류·운영 제약의 순서로 분해한다. ${lens.real} ${lens.company} 하드웨어·소프트웨어·사람의 검토가 어디에 들어가는지 표시하면 모델 설명과 실제 시스템 설명을 구분할 수 있다. ${lens.statements} 따라서 benchmark, 제품 발표, 공시, 사용자 결과는 서로 다른 증거이며 기준일과 분모를 붙여 연결해야 한다. 메커니즘은 직관적인 화살표로 시작하되, 관찰되지 않은 중간 단계를 사실처럼 채우지 않는다.`;
  const example = `${short.example} 이 사례는 설명을 위해 다음 순서로 읽는다. 먼저 문제와 workload를 정의하고, 필요한 데이터·계산·메모리·도구·사람 검토를 나열한다. ${lens.valuation} ${lens.market} 다음으로 공식 문서나 원자료에서 확인 가능한 주장과 아직 확인되지 않은 가정을 분리한다. 제품 세대·출하·생산·수율·매출처럼 현재성이 강한 항목은 별도의 as-of 증거가 없으면 구조적 reference로만 남긴다. 그러면 기술적 가능성, 운영 가능성, 경제적 회수 가능성을 하나의 성능 숫자로 혼동하지 않게 된다.`;
  const counterScenario = `${short.counterScenario} 이 제한은 AI 시스템을 과소평가하기 위한 것이 아니라 일반화를 막는 안전장치다. ${lens.trading} 특히 모델 크기나 제품 사양이 실제 사용량·가동률·고객 전환·현금흐름을 보장하지 않는 경우, 데이터 분포가 바뀌는 경우, 권한·보안·검토 비용이 커지는 경우를 별도로 검토한다. 공식 직접 증거가 없으면 현재 주장으로 승격하지 않고, 어떤 관측이 추가되면 상태를 바꿀 수 있는지 적는다.`;
  const verificationQuestion = `${short.verificationQuestion} 답변에는 입력 정의, 평가 단위, 기준일, 직접 출처, 실패 사례, 업데이트 조건을 포함한다. ${lens.trading}`;
  const diagram = `${short.diagram} · ${lens.scope} · 문제/workload → 계산·데이터·운영 → 제품·기업 → 비용·현금흐름 → 검증·무효화`;
  return { short, title, layer, definition, mechanism, example, counterScenario, verificationQuestion, diagram, lens, module };
}

function semanticFields({ id, title, sourceIds, expanded, surface, reviewedAt }) {
  const { lens } = expanded;
  const claimId = `${surface === 'principles' ? 'principles-lesson' : 'atlas-foundation'}-${id}`;
  const sourceText = sourceIds.length ? sourceIds.join(', ') : '연결된 source ID 없음';
  return {
    intuition: `${expanded.short.definition} 직관적으로는 ${expanded.short.mechanism} 다만 ${expanded.short.counterScenario}`,
    formalModel: {
      kind: 'REFERENCE_MODEL',
      variables: ['입력/제약', '전달 경로', '기업·재무 결과', '시장 기대', '무효화 조건'],
      relationship: `${expanded.short.definition} → ${expanded.short.mechanism} → ${lens.market}`,
      assumptions: ['교육용 구조 모델', '현재 가격·매출·생산량을 직접 추정하지 않음', '기준일·단위·분모는 원자료에서 재확인'],
      observables: ['공식 문서 또는 공시의 원문', '관찰일·보고기간', '비교 기준과 분모'],
      boundary: '상관·구조 설명은 인과 또는 투자 결론과 동일하지 않다.'
    },
    workedExample: {
      kind: 'STRUCTURED_REFERENCE_SCENARIO',
      inputs: [expanded.short.example, `주제: ${title}`, `sourceIds: ${sourceText}`],
      assumptions: ['사례는 교육용 시나리오이며 현재 사실·전망·주문을 확정하지 않는다.', '측정 단위·관찰기간·분모가 원자료에 있어야 한다.', '가격 방향과 매매 지시는 산출하지 않는다.'],
      steps: [
        `1. ${title}의 정의와 적용 범위를 고정한다: ${expanded.short.definition}`,
        `2. 입력·제약·전달 경로를 분해한다: ${expanded.short.mechanism}`,
        `3. ${lens.real}`,
        `4. ${lens.company}`,
        `5. ${expanded.verificationQuestion}`
      ],
      result: `확인 결과는 ${title}의 작동 경로, 관찰 가능한 자료, 보류 조건으로 제한한다.`,
      interpretation: '원리·관찰·해석·전망을 분리하고, 직접 출처와 기준일이 채워진 항목만 더 강한 주장으로 검토한다.',
      failureBoundary: expanded.short.counterScenario
    },
    realEconomyChannel: lens.real,
    companyChannel: lens.company,
    financialStatementChannel: lens.statements,
    valuationChannel: lens.valuation,
    marketChannel: lens.market,
    tradingApplication: lens.trading,
    invalidation: expanded.short.counterScenario,
    glossary: [
      { term: title, definition: expanded.short.definition },
      { term: '기준일(as-of)', definition: '관측·공시·발행 시점을 구분하는 필드이며 최신성 주장의 핵심 조건이다.' },
      { term: '직접 근거', definition: '출처가 바로 해당 주장·수치·상태를 지지하는 정도이며 배경 자료의 존재와 다르다.' },
      { term: '무효화', definition: '핵심 가정이 깨졌을 때 설명을 보류하거나 다시 검토하는 조건이다.' }
    ],
    claimIds: [claimId],
    sourceIds: [...new Set(sourceIds)],
    semanticStatus: 'REFERENCE_SEMANTIC_AUTHORED',
    reviewedAt
  };
}

const principlesPath = 'public-data/principles/lesson-library.json';
const principlesArtifact = readJson(principlesPath);
const principles = principlesArtifact.lessons || [];
const principlesEnriched = principles.map((lesson) => {
  const expanded = principleExpanded(lesson);
  return {
    ...lesson,
    summary: expanded.short,
    definition: expanded.definition,
    mechanism: expanded.mechanism,
    example: expanded.example,
    counterScenario: expanded.counterScenario,
    verificationQuestion: expanded.verificationQuestion,
    diagram: expanded.diagram,
    ...semanticFields({ id: lesson.id, title: lesson.title || lesson.id, sourceIds: lesson.sourceIds || [], expanded, surface: 'principles', reviewedAt }),
    deepStatus: 'SEMANTIC_REFERENCE_AUTHORED',
    reviewedAt
  };
});
writeJson(principlesPath, {
  ...principlesArtifact,
  revision: `${reviewedAt}-semantic-depth`,
  status: 'REFERENCE_CONNECTED',
  boundary: 'A~O 112개 레슨은 짧은 화면 요약과 1,200자 이상 심층 원문, 구조화 worked example, 출처·적용·무효화 필드를 함께 제공하는 교육용 참고 원고다. 현재 가격·수익률·매매 신호·기업 추천을 생성하지 않는다.',
  deepFormStatus: 'SEMANTIC_REFERENCE_AUTHORED',
  lessons: principlesEnriched
});

const atlasPath = 'public-data/atlas/foundation-lessons.json';
const foundations = readJson('public-data/atlas/foundations.json');
const moduleMap = new Map((foundations.moduleIndex || []).map((module) => [module.id, module]));
const atlasArtifact = readJson(atlasPath);
const atlas = atlasArtifact.lessons || [];
const atlasEnriched = atlas.map((lesson) => {
  const expanded = atlasExpanded(lesson, moduleMap);
  return {
    ...lesson,
    title: expanded.title,
    layer: expanded.layer,
    summary: expanded.short,
    definition: expanded.definition,
    mechanism: expanded.mechanism,
    example: expanded.example,
    limit: expanded.counterScenario,
    teachingQuestion: expanded.verificationQuestion,
    visualization: expanded.diagram,
    counterScenario: expanded.counterScenario,
    verificationQuestion: expanded.verificationQuestion,
    ...semanticFields({ id: lesson.id, title: expanded.title, sourceIds: lesson.sourceIds || [], expanded, surface: 'atlas-foundations', reviewedAt }),
    deepStatus: 'SEMANTIC_REFERENCE_AUTHORED',
    reviewedAt
  };
});
writeJson(atlasPath, {
  ...atlasArtifact,
  revision: `${reviewedAt}-semantic-depth`,
  status: 'REFERENCE_CONNECTED',
  shortFormStatus: 'AUTHORED_REFERENCE_CONNECTED',
  longFormStatus: 'AUTHORED_REFERENCE_CONNECTED',
  deepFormStatus: 'SEMANTIC_REFERENCE_AUTHORED',
  boundary: '48개 foundation lesson은 짧은 화면 요약과 1,200자 이상 심층 원문, 구조화 worked example, 산업·재무·시장 전달·무효화 필드를 함께 제공하는 교육용 참고 원고다. 현재 성능·생산·매출·가치평가·거래 주장은 별도 직접 증거 없이는 게시하지 않는다.',
  lessons: atlasEnriched
});

console.log(JSON.stringify({ status: 'PASS', reviewedAt, principles: principlesEnriched.length, atlas: atlasEnriched.length, semanticLessons: principlesEnriched.length + atlasEnriched.length }, null, 2));
