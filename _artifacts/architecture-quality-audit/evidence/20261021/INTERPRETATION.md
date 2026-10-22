> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 해석·기준·원칙 감사

MODE: review | VERDICT: FAIL | REF: d36bb256ddf60468d6c7a134628053c5796be6be (v58.52)

ACT ON 1건(medium), CONSIDER 1건(해석 강도·설계 한계). correctness / source-of-evidence / partial-state lens, 검토자 financial_current_delta, independence limited(동일 모델 팀). 일반적인 조건부 선택지 설명은 R698의 허용 범위로 다뤘다. 가족·지인용 무료 도구에 유료 서비스 심사나 정식 사용자 연구를 새 완료 조건으로 만들지 않았다.

## 범위와 증거

`guide/lessons.js`, `guide/market-guide.js`, `interpretation/concepts.js`, `interpretation/market-interpretation.js`, `data/selectors/interpretation.js`, `rules/thresholds.js` 6개 고정 REF 전문을 읽었다. 원장 `interpretation-reading.tsv`에 전문과 4개 부분 caller/evidence source를 분리하고 BASE/REF SHA256를 기록했다. 모든 제품 소스와 probe 의존성은 Git 고정 원문으로 읽었으며 현재 workspace 소스 import는 없다.

실행: `node --experimental-vm-modules _artifacts/architecture-quality-audit-20261021/interpretation-probe.mjs` → exit0. 실제 함수 반환값·사용자 문장을 `interpretation-probe-result.json`에 저장했다. 외부 API/producer/브라우저/유료 AI 호출은 없다. 아래 사례는 재현된 모델 출력이며 실브라우저 증거가 아니다.

## I01 — [ACT ON][medium] 알려진 과거 표본 충돌이 가이드 요약에서 사라짐

- 위치: `src/domain/guide/market-guide.js:131`(보조 lesson만 선택), `:141`~`:153`(AI 문장에 live path의 pastConflict를 출력하지 않음). 직접 사용자 surface는 `src/ui/components/market-guide.js`의 headline/choiceTable/stance/lessons 소비다.
- Trigger: 중심 시나리오가 wait/defend를 유리하다고 서술하지만 pastConflict가 있는 상태이며, 두 개 이상의 다른 trap lesson이 먼저 선택된다. 추세 부담과 동반 약세는 cheap-after-fall / one-day-move를 활성화하므로 흔한 조합이다.
- Failure: crossroads 모델은 `pastConflict`/`pastBridge`로 반대 근거를 명시하지만 guide는 lesson 수 제한에 따라 충돌 설명을 잃는다. 화면은 ‘비용이 작은 쪽은 관망’, 지향/지양을 강조하면서 그 결론에 반대되는 과거 근거를 남기지 않는다. AI에서 ‘마음가짐’, ‘전략’ 같은 질문은 guide block만 포함될 수 있어 상세 crossroads block이 이를 항상 복구하지 않는다.
- 측정 proof: 실제 registry aibust를 기반으로 합법적인 past={n:100,up:90,baseUpPct:50,horizon:20}을 입력했다. 실제 `pastConflict`가 defensive/90%/base50을 반환하고 `guide.direction.live[0].pastConflict`도 존재한다. 하지만 선택 lesson은 survive-first, waiting-is-a-choice, know-when-wrong, watch-participation, cheap-after-fall, one-day-move, trust-credit이며, renderMarketGuideContext에는 90%나 ‘과거 표본과 어긋남’이 전혀 없다(conflictPrinted=false). home renderer도 direction.live의 pastConflict/evidence를 렌더하지 않는다.
- 판단 경계: 현재 체크인 aibust의 과거 표본이 실제로 위 충돌 조건이라고 주장하지 않는다. 공개 producer가 표현하는 정상 pastConflict 상태가 요약 경로에서 유실되는 결함이다. 과거 표본 충돌이 선택지를 기계적으로 반전해야 한다는 주장도 아니다.
- 최소 대안: 중심 또는 집계에 포함된 live branch의 알려진 충돌은 선택형 교육 lesson과 분리해 가이드 근거 옆 한 문장으로 항상 남긴다. 기존 일반적 선택지·이유는 유지하면서 ‘이 선택은 조건부 비용 가설이며 과거 표본은 반대’라는 제한을 화면/AI 양쪽에 보존한다.

## I02 — [CONSIDER] 편집된 분기 개수 순위를 최소비용 판단으로 올릴 근거가 없음

- 위치: `src/domain/guide/market-guide.js:58`~`:70`의 score=favoredIn.length−costlyIn.length, `:133`~`:136`의 ‘비용이 작은 쪽’ headline. live가 없을 때도 `:67`에서 분할·조건부 접근이 ‘틀렸을 때 비용이 작다’고 일반화한다.
- 측정 proof: `buildDirection`에 실제 BRANCHES.softland / oilshock의 favored/costly를 그대로 전달하면 hold score1, wait0 → robust=hold다. 관측·조건·손익을 바꾸지 않고 oilshock 서술을 ID만 달리 두 번 더 복제하면 wait score2, hold1 → robust=wait로 바뀐다. 두 경우 split=false로 동률 문제가 아니다. 기존 코드의 값은 그대로이며, 새 시장 사실을 한 개도 추가하지 않았다.
- 의미: 분기 건수는 사람이 원인을 몇 개로 나눠 썼는지에도 의존한다. 데이터에 분기별 발생 확률, 선택지별 손실 크기, 겹치는 원인의 독립성·배타성이 없으므로 이 산술은 최소 기대비용도 최소 최악비용도 증명하지 않는다. 유가·금리·달러처럼 서로 연결된 원인을 별도 표로 쓸수록 같은 방향 표가 늘 수 있다. ‘확률 아님’ 표기만으로 비용 최소화라는 더 강한 결론이 따라오지는 않는다.
- 규칙과 실제 출력의 차이: thresholds.js는 관례이고 검증된 예측값이 아니라고 명시한다. 개별 crossroads AI 문장은 이미 ‘비용 가설 — 과거 성과로 검증한 우위 아님’이라고 한계를 붙인다. guide headline은 이를 ‘비용이 작은 쪽’으로 압축해 해석 강도를 다시 올린다. 주석의 ‘favored somewhere and costly nowhere’도 구현과 다르다. 예시 after는 wait가 costly인 branch가 하나 있어도 robust로 뽑힌다.
- 최소 대안: 집계와 일반적 선택지 설명은 유지하되 headline은 ‘현재 작성된 분기 중 상대적 유리가 더 많이 표시된 선택’으로 한정하고, 각 분기의 조건·비용 가설·반대 근거를 함께 보여 준다. score를 최적 전략처럼 부르지 않는다. 분기 묶음이 늘어날 때 중복 원인에 민감한지 확인하면 충분하며 가족용 도구에 새로운 거래 모델·유료 데이터·공식 승인을 요구할 필요는 없다. 정책상 robust 선택을 계속 쓸지, 단순 설명표로 둘지는 소유자 판단 사항이다.

## ‘모든 기준과 원칙이 최선인가’에 대한 코드 근거의 범위

- [measured source] RULES는 공식 목표/정의(예: 물가 목표, Sahm 구조), 전통적 관례(이동평균·RSI·VIX·OAS 구간), 자체 휴리스틱(버퍼·확인 개수·리더십/초단기 움직임), 최근 표본의 흔들림 완화(hysteresis)를 한 레지스트리에 모은다. 같은 단어가 화면마다 다른 임계값을 뜻하는 위험을 줄이는 설계다. concepts.js의 신용 안정/방어 업종 공유, native rows의 typed field 접근, 부분 stage 실패의 errors/null 경계도 실제 소스에서 확인했다.
- [inferred limitation] 일관된 임계값이라는 사실은 예측적 최적성의 증거가 아니다. 주석의 2026-06~10 97세션에서 flip 19→9는 문장/상태의 안정성 근거이며 이후 수익·손실·기회비용 개선을 측정하지 않는다. 임계값별 사건회상·표준편차 비례도 노이즈 수준 근거이고 수익 우위 검증과 다르다. 따라서 지금 코드만으로 ‘최선의 기준’이라고 인증할 수 없다.
- [CONSIDER editorial strength] lesson의 ‘거래량 없는 돌파는 실패하기 쉽다’, ‘주봉 방향과 같을 때 더 믿을 만하다’, ‘신용 쪽을 더 무겁게 본다’, ‘가격은 평균선으로 되돌아가려는 경향’은 학파별·조건부 경험칙이다. 코드에는 이 원칙별 표본·반례·검증 링크가 없다. 합리적 교육 자료로 남길 수 있지만 보편 법칙으로 검증한 것처럼 표현하지 않도록 ‘이 접근에서는/그럴 수 있음/이 조건일 때’를 구분하는 편이 낫다. 이번에는 외부 문헌을 조회하지 않았으므로 각 금융 명제의 진위·우위는 UNVERIFIED다. 새 수치나 대체 투자기법을 추천하지 않는다.
- [DISMISSED] ‘조건 충족 수를 쓰면 안 된다’, ‘일반적 기다림·분할·보유·방어 설명 자체가 금지다’, ‘유료 서비스 수준의 승인 없이는 가족용 앱을 운영하면 안 된다’는 결론을 내리지 않는다. R697/R698의 개수 표기와 조건부 선택지 설명은 존중한다. 필요한 변화는 관측·관례·가설·성과 검증의 층위를 문장에서도 유지하는 것이다.
- [UNVERIFIED] 휴장표/거시 목표 수치의 최신 공식 원문, 기술적 경험칙의 외부 실증, 임계값의 out-of-sample 비교, 실제 사용자 이해도, 브라우저/배포에서의 안내 문장은 이번 코드/격리 실행으로 인증하지 않았다. 공식 원문 확인이 필요한 항목은 root의 별도 출처 점검과 구분한다. ERP 수식 자체의 금융 정의는 root가 공식 Fed/NYFed 문헌으로 검토 중이며 이 검토자가 근거 없이 오류로 올리지 않았다.

## 안전 사실과 상태

SAFETY FACT: 같은 입력 파이프라인을 공유한다는 구조는 소스에서 확인했고, 새 guide의 과거충돌 보존은 DISPROVED(실제함수 probe). 비용 최적성은 UNPROVEN, 편집 분기 수에 따른 선택 변화는 PROVED(실제함수 probe).

소유 산출물만 작성했다. 제품/데이터 수정, producer 실행, 외부 네트워크, 유료 AI, Git mutation, commit/push/deploy 없음. 이 보고서를 기존 20261019 감사 완료 근거로 소급하지 않는다.
