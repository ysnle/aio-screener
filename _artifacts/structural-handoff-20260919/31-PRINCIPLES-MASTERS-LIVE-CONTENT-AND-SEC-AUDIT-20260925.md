# Principles·Masters 본문과 SEC 해석 심층 감사 — 2026-09-25

> 공개 배포 `v56.33`의 새 `sourceSha=65dd6aa00845acf9c6365c3dbb9b60751574726f`(배포 표기 2026-09-25T12:53:05.326Z)를 기준으로 다시 열었다. [29](29-SECOND-PASS-LIVE-CONTENT-AUDIT-20260925.md)·[30](30-ATLAS-GUIDE-PORTFOLIO-LIVE-DEPTH-AUDIT-20260925.md)의 주된 브라우저 컷은 같은 버전 표시의 **이전 SHA** `be3b131bc2ccc2683a82629b9c9579afe9492b5a`이다. 아래의 `B/I`는 새 배포의 화면/조작, `C`는 별개인 로컬 dirty v56.47 코드, `E`는 명시한 SEC 원문에 한한다. 이전 SHA의 항목별 본문 해시가 없어 두 배포의 112개 원고 동등성은 인증하지 않는다. 이 감사에서 제품 코드는 수정하지 않았다.

## 1. Principles: 화면 전수 열람과 의미 깊이

`#principles`의 세부 레슨 **112/112개 원고를 실제로 펼쳤다**. 6페이지별 20·20·20·20·20·12개가 열렸고 남은 로딩·실패는 0개, 자동 구조화/사람 검토·출처 직접성 미완료 경고는 112개 모두에 있었다. 이것은 렌더 성공과 각 문장의 사실 검증을 구분하는 긍정적인 경계다. 원고는 `정의 → 작동 원리 → 관찰 적용 → 무효화 조건 → 사례·근거 전개` 순서이나, 정의·작동·무효화·사례 상당 부분은 짧은 카드의 내용을 다시 서술한다. 관찰 질문은 일부 가치가 있다. A1은 기회비용을 금액/시간/생산량 중 어떤 단위로 볼지 묻고, B2는 상대가격과 일반 물가를 분리하고 원인 후보의 근거를 찾게 한다. **112개를 펼쳤다는 사실로 112개의 독립 심층 설명이 작성됐다고 표현하지 않는다.**

출처 단위에서도 차이가 있다. A1에 보이는 OECD 생산성·연준 교육의 상위 자료는 주제 관련 배경이지 원고의 개별 문장까지 직접 지지하는 위치 정보가 아니다. D6은 뉴욕 연은 r* 자료·2026년 6월 SEP처럼 더 직접적인 원천을 제시하지만, 한 카드의 개선이 나머지 원고의 검증을 대신하지 않는다. [29](29-SECOND-PASS-LIVE-CONTENT-AUDIT-20260925.md)의 D6 역사 숫자 대사는 이전 컷의 제한된 외부 확인이며 새 원고 전체로 확장하지 않는다. 8개 학습 경로의 첫 단계 대표 확인 이외 **새 SHA의 경로별 뒷단 진입은 0/8**이다.

**LC-83 — `카드 → 확장 원고 → 출처 → 현재 관측`의 품질 단계와 중복 원고 (`B+I+C`, 높은 우선순위).** 12개 이야기 장·15개 자료실 장·60개 개념·8개 경로·112개 세부 레슨은 서로 더하는 콘텐츠 총량이 아니다. `conceptId`, `lessonId`, `placementId`, `claimId`, `sourceId`, `source section`, `reviewedAt`, `depthStatus`, `currentObservationId`, `allowedUse`를 갖는 정본으로 종류와 상호 연결을 정의한다. 짧은 카드에서 확장 원고를 누르면 실제로 새로 얻는 설명/반례/계산 예시가 무엇인지 편집 기준을 둔다. 반복만 있는 확장 원고는 별도 깊이 배지를 제거하거나 짧은 카드에 통합한다. 사람 검토·개별 주장에 닿는 원전·날짜 있는 사례가 없는 동안 `심층 원문/검증됨`을 게시하지 않는다. `src/ui/knowledge/lesson.js`, Principles 원고 자료, `src/ui/pages/principles.js`, Guide/Glossary/AI 재생산 경로를 한 claim 정본으로 묶고 중복 하드코딩을 퇴역한다. 인수: 112개에서 각 claim의 원전 위치/반례/최종 검토자와 화면의 깊이 배지가 일치하고, 8경로의 첫·중간·끝 단계/뒤로가기/재진입을 실제로 수행한다. 전수 열람은 원전 정확도나 사용자 이해도 인증이 아니다.

## 2. Masters: 기본 프로필 순회와 최신 컷의 상세

이전 브라우저 감사에서 **38/38개 기본 프로필**을 선택했다(13F 연결 37, Mark Minervini 방법론 전용 1). 당시 `sourceSha`를 기록하지 못했으므로 새 컷의 전수 증거로 승격하지 않는다. 새 SHA에서는 T. Rowe Price·Duquesne·FMR/Fidelity·Wellington을 다시 열고 T. Rowe의 8개 상세 뷰를 조작했다. `Core changes`는 공시 행의 전 분기 비교이며 거래 재구성이 아니다. `Whole holdings`는 T. Rowe **4,722행 중 200행 웹 투영**, 25행 페이지와 투영 내 검색만 제공한다. `Sector`는 매핑된 10행의 **$76,191,347** 및 그 부분집합 내 참고 비중이지 전체 포트폴리오 비중이 아니다. `Quarter trend`는 12기간 목표에 대해 T. Rowe 두 기간만 보이고 CUSIP 다분기 원장은 `NOT_CONNECTED`였다. `Investor comparison`의 동분기 공통 증권 2개는 공동 행동을 뜻하지 않는다. `Investment principles`는 T. Rowe 직접 원문 미연결, `13D/G`는 2024년 11–12월 과거 9건, `Original filing`은 SEC 링크 제공/인라인 원문 미리보기 없음으로 읽었다.

37개 공시 프로필의 **이전 컷 상태 집계는 EXACT 34, MISMATCH 2, EXCEPTION_DISCLOSED 1**이었다. 새 SHA에서 전 37개를 재계산하지 않았으므로 이 숫자를 새 SHA의 상태라고 쓰지 않는다. 새 컷 대표 대사는 아래와 같다.

| 제출자/접수번호 | 새 화면의 cover·행 합계 | 직접 확인한 원문과 남은 한계 |
|---|---|---|
| T. Rowe `0000080255-26-000519` | 4,722행, $999,124,702, EXACT | [SEC index](https://www.sec.gov/Archives/edgar/data/80255/000008025526000519/0000080255-26-000519-index.html)·[cover](https://www.sec.gov/Archives/edgar/data/80255/000008025526000519/xslForm13F_X02/primary_doc.xml)에서 행수/총액 및 nearest-dollar 단위를 확인. NVDA 개별 셀의 SEC 원문 대사는 미완료. |
| Duquesne `0001536411-26-000006` | 95행, cover $5,210,860 / 파싱 $5,210,856, −$4 MISMATCH | [SEC index](https://www.sec.gov/Archives/edgar/data/1536411/000153641126000006/0001536411-26-000006-index.html)·[cover](https://www.sec.gov/Archives/edgar/data/1536411/000153641126000006/xslForm13F_X02/primary_doc.xml)의 cover를 확인. 행별 경제적 단위는 미확정. |
| FMR/Fidelity `0000315066-26-002260` | 13,978행, cover $2,303,878,429,728 / 파싱 $2,303,878,429,723, −$5 MISMATCH | [SEC index](https://www.sec.gov/Archives/edgar/data/315066/000031506626002260/0000315066-26-002260-index.html)·[cover](https://www.sec.gov/Archives/edgar/data/315066/000031506626002260/xslForm13F_X02/primary_doc.xml)를 확인. 전 행 외부 대사는 미완료. |
| Wellington `0000902219-26-000311` | 7,448행, cover $580,172,687,616 / 파싱 $580,172,687,615, −$1 EXCEPTION_DISCLOSED | [SEC index](https://www.sec.gov/Archives/edgar/data/902219/000090221926000311/0000902219-26-000311-index.html); 새 컷의 primary XML 재열람은 미완료. |

[SEC Form 13F FAQ Q36](https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f)은 2023-01-03 이후 cover/행 값의 **가장 가까운 달러** 보고를 설명한다. 행마다 반올림한 합계와 별도로 반올림한 cover는 달라질 수 있다. N행일 때 대략 `(N+1)/2`달러의 최악 경계 내 차이는 반올림으로 *설명 가능*할 뿐 원문 진실성 인증이 아니다. 현재 로컬 `src/ui/pages/masters.js`와 `scripts/ci-masters-contract-check.mjs`가 둘 다 `|delta|≤1`을 예외 경계로 되풀이한다. QA가 제품 구현의 같은 상수를 따라가므로 독립적인 값 대사 oracle이 약하다. SEC의 접수 성공도 내용의 정확성을 보증하지 않는다는 [FAQ Q30](https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f)을 별도로 따른다.

**LC-84 — 행 수 검증과 금액 대사 및 반올림 사유를 별도 표기 (`B+I+C+E 일부`).** `VERIFIED_ROWS`/`행 검증 완료`는 cover의 **행 수**와 로드 행 수의 일치로 좁혀 `cover 행 수 일치`처럼 게시한다. `valueReconciliation`은 `EXACT / EXPLAINABLE_ROUNDING_CANDIDATE / UNEXPLAINED_DELTA / NOT_REPORTED`와 *원시 delta*·N·단위·접수번호를 함께 저장한다. 반올림 후보도 발행자 정정/중복행/원문 파싱을 점검하기 전에는 인증 배지가 아니다. 테스트는 고정 ±1 구현을 반복하지 말고 SEC 원문 cover/정보표에서 독립 기대값을 산출하고 오류·정상 양쪽 fixture를 갖는다. Duquesne −4, FMR −5, Wellington −1, 정확 일치 및 범위 초과를 사용자 문구까지 검사한다.

새 화면의 T. Rowe NVDA는 $73,999,242 / 369,829,781주(표시값 기준 약 **$0.20/주**), Duquesne Natera는 $864,923 / 3,186,306주(약 **$0.27/주**), Amazon은 $129,085 / 541,600주(약 **$0.24/주**)다. 이는 주당 가격의 경제적 타당성을 검토할 강한 **후보**이나 해당 개별 SEC XML 값·보고일의 조정 주가/기업행동·증권 종류·제출자 정정 여부를 모두 대사하지 못했다. FMR NVDA 한 행은 약 $200/주로 이 후보와 다른 규모다. 자동으로 1,000배 보정하거나 제출자 오류로 확정하지 않는다.

**LC-85 — 13F 단위·증권 정체성·투영 범위의 검증 분리 (`B+I+C+E 일부`).** 파서는 accession/CIK/보고분기/제출·정정 시각/XML 단위와 원시 행 값·주식수·PUT/CALL·CUSIP를 보존한다. 검증기는 ① 원문 필드/행 수, ② cover-합계 및 반올림 후보, ③ 동일 증권·시점의 독립 가격을 이용한 경제적 타당성 경고, ④ 종목/섹터 crosswalk 검증, ⑤ 현재 200행 projection과 full 원장의 검색 가능 범위를 **독립 상태**로 발행한다. 이상 후보는 수치를 조용히 고치지 않고 `단위 검토 필요`로 보류한다. `전체 보유`·`전체 보유 검색`은 전체 4,722/13,978행을 실제 탐색하게 만들거나 `웹 투영 200행 내 검색`으로 이름을 고친다. NVDA 역조회가 T. Rowe 행을 포함하지 않는 현재 참조용 색인의 범위·누락을 헤더에서 명확히 보여준다. 저장/AI/원문 화면이 같은 accession·period·scope를 사용해야 한다.

## 3. 구조 이전과 사용자 인수

1. **원문 대조 파일럿:** D6과 A1처럼 출처 직접성이 다른 학습 주장 각 하나, SEC EXACT/반올림 후보/단위 이상 후보 각 하나를 선택한다. 원문 절/접수번호 → 정규화 관측 → claim/result ID → Principles/Masters/AI 표시를 관통하고 링크를 눌러 같은 정보를 찾는다.
2. **코드 축소:** Principles 원고의 반복 템플릿·공통 출처 링크 복제와 Masters의 `VERIFIED_ROWS` 오해 배지를 정본 콘텐츠/검증 결과로 교체한 뒤 옛 renderer 분기와 문자열 상수·시험 전용 seam을 삭제한다. `index.html` 문구, `js/aio-chat.js` 재서술, native ESM, 생산 스크립트, QA의 중복 owner를 한 변경 세트에서 추적한다. 새 래퍼만 추가하고 옛 계산/표기를 남기면 미완료다.
3. **사용자 과업:** 초보 사용자는 12/15/112/60/8의 관계와 짧은 원고/직접 출처의 차이를 설명하고, 숙련 사용자는 공시 분기·200행 투영·행 수 대사·금액 대사·가격 이상 후보를 구별한다. 13F를 오늘의 전체 포트폴리오나 거래 기록으로 해석하면 실패다. 화면 리더와 320/390/768 폭에서 같은 근거에 도달할 수 있어야 한다.

## 열린 증거

- 새 SHA의 112개 원고 펼침 성공은 확인됐지만 이전 SHA와 개별 본문 동일성, 112개 원전의 문장별 직접성/정확성, 8개 경로 뒷단, 실제 사람 이해도는 미검증이다.
- 38개 프로필 기본 순회는 SHA 불명 이전 컷이며 새 SHA의 37개 모든 SEC 정보표 원행·총액·행 가격의 독립 대사는 미완료다. 대표 SEC cover 대사 결과를 전수 인증으로 확장하지 않는다.
- 로컬 v56.47의 코드 경계는 새 원격 SHA와 동일한 구현이라는 증거가 없으며, 후속 배포에서 sourceSha·data publication·SW 세대를 묶어 재검증한다.
