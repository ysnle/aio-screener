# 내용의 질·정의·추론 심층 검토

전편 독서는 source 원문 자체가 옳다는 인증이 아니다. [생성 원고160행](./article-review.tsv), [실제 원리112행](./active-lessons-review.tsv), [분석노트59·칼럼12행](./active-notes-review.tsv), [신규claim114행](./claim-new-review.tsv), [도메인19행](./domain-review.tsv)을 개별 판정으로 남겼다. 중복된 내용을 합산해 고유 검토 건수를 부풀리지 않는다. claims의 원고와 같은160개는 definition+공백+mechanism equality로 재사용하되 원고의 fact 연결 문제를 claim statement 오류로 기계 승계하지 않는다.

## 바로 고칠 수 있는 내용 문제

**C01 · M8 PUE와 IT 경계.** lesson-library.json:4331/4366의 정의·story는 network를 시설부하에 넣거나 PUE 분모를 서버 전력으로 좁힌다. 시설120kW·서버80·기타IT20이면 본문식1.5와 올바른 IT기준1.2가 달라진다. The Green Grid WP49 표2(인쇄19쪽)는 network devices를 IT equipment에 둔다. [공식 백서의 LBNL 보관본](https://datacenters.lbl.gov/sites/default/files/WP49-PUE%20A%20Comprehensive%20Examination%20of%20the%20Metric_v6.pdf). 실제 v57.87 배포 M8 본문에서도 서버 분모 문장을 확인했다. 최신 로컬에도 같은 문장이 있어 단순 생성 artifact 문제로 한정되지 않는다. 모든 데이터센터 간 효율을 PUE 하나로 순위화하라는 제안은 아니다.

**C02 · N10 CAC 회수.** lesson-library.json:4990의 고객 매출을 CAC와 직접 비교하면 서비스 원가를 누락한다. 매출100·원가90·CAC50이면 회수에 기여하는 금액은10이다. 기간과 매출총이익/공헌이익 기준을 명시해야 한다. 다른 실제 software 분석노트는 총이익 LTV를 사용해 같은 프로젝트 내부에서도 기준이 다르다.

**C03 · G4 발행자·구주매출.** lesson-library.json:1880 및 생성 원고의 ‘기존 주주가 새 증권을 발행’ 정의는 신주모집·구주매출을 혼동한다. 기존주주의 매각은 회사 주식수·현금을 반드시 늘리지 않는다. [SEC Investor.gov의 primary market 정의](https://www.investor.gov/introduction-investing/investing-basics/glossary/primary-market)는 신규발행과 발행사 대금 수령을 구분한다. 기존주주의 증권 매각 참여와 발행자 역할을 분리하면 된다.

**C04 · 노동 예제의 인원 원장·단위.** packet-20261016-x-bookmarks.js:395/398의 LF1000/U40→LF980/U30은 고용960→950인데 구직포기10명·고용불변이라고 설명한다. 불변 예라면 LF990이어야 한다. V/U도 구인율÷실업률은 서로 다른 분모여서 빈일자리건수÷실업자건수와 같지 않다. [BLS CPS 정의](https://www.bls.gov/cps/definitions.htm)를 기준으로 인원 대사부터 맞춰야 한다. 실제 고용시장 수치 오류가 아니라 가상 계산 예의 오류다.

**C05 · 사모대출의 신용·통화 혼동.** concept-core.js와 concept-stories.js의 ‘사모대출은 신용을 새로 만들지 않는다’는 대출채권·채무 생성과 은행 예금통화 창출을 혼동한다. 비은행 펀드도 신규 대출을 제공하고 기존 대출을 대체·차환할 수 있다. [Fed의 private credit 설명](https://www.federalreserve.gov/econres/notes/feds-notes/private-credit-characteristics-and-risks-20240223.html). 비은행 대출이 같은 방식으로 요구불예금을 생성하지 않는다는 경계로 바꾸고 은행 차입·레버리지 연결을 따로 설명해야 한다.

**C06 · 회계이익·ROIC·CAPEX의 축.** G1 mechanism은 일반 이익에서 자본비용을 빼지만 실제 story는 회계 순이익을 설명한다. domain-ai-economics-claim-3은 요구수익률 변화가 ROIC 자체를 바꾸는 것처럼 읽힌다. NOPAT80·투하자본1000이 같으면 요구수익률9→12%여도 ROIC8%는 같고 경제적 spread가 달라진다. CAPEX는 현금지출, 감가상각은 비현금 손익 비용이라는 연결을 유지해야 한다. core capex-roic의 첫해ROIC와5년NPV 분리 개선은 계산이 맞아 긍정적으로 평가한다.

**C07 · ATR 배수·마진 민감도.** packet16:285/288에서 종가120·이평100·ATR%4%(종가분모)이면 ATR4.8, 실제거리/ATR=20/4.8≈4.17배다. 이평괴리율20%를 그냥4%로 나누면5배가 되어 분모가 다르다. packet14:62의 고마진일수록 단가하락 타격이 크다는 방향도 조건을 고정하면 반대다. 매출100·이익60은 가격10% 하락 시 이익−16.7%, 이익10은 전액 소멸한다. 물량·비용·계약이 변하면 민감도는 다시 계산해야 한다.

**C08 · 관계 존재와 의미 연결.** narrative-journey의 기업현금 칼럼은 현재 H1주문장/H2기대/H4군중/I1경기/I3유동성으로, AI CAPEX는 M1전기/M3가격/M7저장/M9원전으로 연결된다. ID는 존재하나 핵심 설명을 가르치지 않는다. COLUMN_FRAME_LINKS는 별도로 주제에 맞아 두 연결 체계가 어긋난다. 도메인 generator는 topic의 모든 branch를 모든 anchor 도메인에 붙여 방산에Artemis·우주에방산 branch를 direct로 둔다. 제품 mapped-to 역시 is-a/uses/enables/관련학습을 구분하지 않는다. 이 문제를 실제 기업 공급능력 허위 주장으로 곧바로 승격하지 말고 관계 종류·이유를 보완해야 한다.

## 추론을 조건화해야 하는 내용

TGA 완충은 RRP 잔고가 아니라 실제 RRP 감소와 다른 자산·부채 흐름으로 판단해야 한다. 다른 항목 일정 시 TGA+100/RRP변화0이면 준비금−100, TGA+100/RRP−100이면 준비금0이다. 상태의존 문장 보완은 있었지만 잔고를 충분조건처럼 읽게 하는 본문은 남았다. 앞선 Fed balance-sheet 원문 대조 근거를 이어 사용한다.

환매 자동이월은 상품 계약 조건이다. 요청12·지급5 뒤 다음분기 신규8을 무조건 대기7+8로 합치지 않는다. NAV95면5% 한도도4.75로 변할 수 있다. 고정NAV·자동이월 가정이면 예제가 성립하므로 가정을 쓰고 다른 계약을 함께 설명하면 된다. NAV할인은 시장평가 손실이며 매도 전 실현손실과 같지 않다.

주식↓·금↓·명목금리↑·달러↑만으로 실질금리 충격을 확정하거나 유가premium10달러에서 위기 지속기간을 역산할 수 없다. 일관되는 가설과 유일하게 식별된 원인을 구분해야 한다. 명목금리와 기대인플레가 같은 폭 상승하면 실질금리가 그대로인 반례가 있다. 공급손실 크기·수요·재고·포지션을 추가해 조건부 설명으로 유지한다.

term premium을 명목금리에서 관측 실질금리와 BEI를 빼 남는 항목으로 설명하면 이중계산할 수 있다. [Fed 모델 정의](https://www.federalreserve.gov/data/three-factor-nominal-term-structure-model.htm)는 만기금리와 기대 평균 단기금리의 차이를 사용하며 추정 불확실성·모형 의존을 명시한다. TIPS 실질금리·BEI 분해와 정책기대·기간premium 분해는 같은 축이 아니다.

3·4번째 베이스의66%/80% 실패율은 문헌 귀속·AIO미재현 경계가 추가됐다. 그러나 정의·실패기간·유니버스·표본수·기저율이 없어 검증 가능한 빈도로 평가할 수 없다. 수치가 거짓이라고 인증한 것은 아니다. 정확한 원문·방법을 확보하기 전에는 질적 경험칙으로 표시하는 편이 낫다.

K4의 뒤공정 검사 강화, F2의 완전고용 지출은 물가·금리만 상승, B2의 임금 전이가 있어야 ‘비로소’ 정책 대응, bank의 모든 차입 담보 대부분 채권, policy-floor의 정책은 이익전망을 못 바꿈 같은 문장은 관찰된 일부 경로를 필요조건·보편법칙으로 확대한다. 각각 조기불량검출, 장기 공급능력 투자, 사전 대응, 예금·무담보 조달, 정책의 매출/비용 영향이라는 반례가 있다. 반론을 접힌 상세에만 두기보다 핵심 문장부터 조건화해야 한다.

## 읽었으나 인증하지 않은 것

모든199 external source 전문, 455개 조사 dossier의 외부 claim별 지지, 실제시장·정책·기업·의료·세무 수치의 전편 원문 대조는 완료하지 않았다. 160 draft와112 story와59 note와300 concept/node를 서로 독립 완료편으로 합산하지 않는다. 개별 읽기 ledger는 누락·중복을 검증하는 도구이며 참이라는 점수표가 아니다. sourceRole·DIRECT 메타데이터를 실증적 입증으로 올리지 않고 각 출처의 출판시점·지지범위·반대근거를 별도로 확인해야 한다.
