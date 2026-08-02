# MASTERS PORTFOLIO / 13F PAGE DESIGN HANDOFF — 대가의 공개 포트폴리오

> 상태: **DESIGN_ONLY — 구현 미착수**  
> 작성일: 2026-08-01  
> 사용자 지시: 실제 코드·버전·테스트·배포를 수정하지 말고, 다른 에이전트가 구현할 수 있는 기획/설계 자료만 준비  
> 데이터 원칙: SEC EDGAR 원본을 1차 출처로 사용하고 제3자 데이터는 검증/보조로만 사용

---

## 0. 제품 결정

- 사이드바 라벨: **대가의 포트폴리오**
- hero 권장안: **공개 포트폴리오 — 무엇을 보유했는가보다 무엇이 달라졌는가**
- route 후보: `masters` 또는 `gurus`
- 핵심 사용자 가치: 투자 대가의 최근 보고 보유 내역, 전분기 변화, 집중도, 공통 보유를 한 화면에서 비교
- 갱신: 13F 공개 주기에 맞춘 분기 갱신
- 비역할: 실시간 포트폴리오, 대가의 개인 계좌, 전체 자산배분, 매수 추천

---

## 1. 가장 중요한 정확성 원칙

### 1-1. 인물과 신고주체는 다르다

화면의 제목은 인물이어도 데이터의 실제 owner는 SEC 신고주체다.

| 사용자에게 보이는 이름 | 신고주체 예시 | 화면 표기 원칙 |
|---|---|---|
| 워렌 버핏 | Berkshire Hathaway Inc | `Berkshire Hathaway 공개 13F · 워렌 버핏 관련` |
| 스탠리 드러켄밀러 | Duquesne Family Office LLC | `Duquesne Family Office 공개 13F` |
| 켄 피셔 | Fisher Asset Management LLC | `Fisher Asset Management 공개 13F` |
| 마크 미너비니 | 검증된 현재 신고주체 확인 필요 | 미확인 상태에서 포트폴리오를 생성하지 않음 |

`버핏의 포트폴리오`라는 대중적 제목을 쓸 수는 있지만, 세부 화면에는 반드시 법적 신고주체와 CIK를 표시한다.

### 1-2. 13F는 전체 포트폴리오가 아니다

화면 전체에 다음 의미를 유지한다.

- 분기 말 기준 보고된 Section 13(f) 증권
- 분기 말 이후 최대 45일 지연 가능
- 현금·대부분의 공매도·비상장 자산·일부 해외증권·전체 파생 포지션을 보여주지 않음
- put/call 보고가 있어도 실제 순노출을 완전히 설명하지 못함
- 시장가치 변화는 매매가 아니라 가격 변화일 수 있음
- `portfolio weight`는 `reported 13F value 내 비중`으로만 표현
- 원본 제출 오류·수정공시 가능성 존재

권장 고정 문구:

> 이 화면은 SEC 13F에 보고된 분기 말 보유 증권만 보여줍니다. 현재 보유·전체 자산·현금·공매도·비상장 투자를 의미하지 않습니다.

### 1-3. 매매 분류는 주식 수 기준

- `신규`: 전분기 0, 당분기 > 0
- `전량 매도`: 전분기 > 0, 당분기 0
- `확대`: 주식 수 증가
- `축소`: 주식 수 감소
- `유지`: 주식 수 변화가 허용 오차 이내
- 평가액 증감만으로 매수/매도 분류 금지
- 합병·분할·종목변경·CUSIP 변경은 corporate action 보정 전 `분류 보류`

---

## 2. 투자자 분류 체계

모든 대가를 13F 포트폴리오로 억지로 묶지 않는다.

### A. 현재 13F 기반 프로필

- 신고주체와 CIK가 검증됨
- 최근 분기 13F-HR 또는 13F-HR/A 존재
- 최소 2개 분기 비교 가능
- 상세 보유·분기 변화·섹터·비교 제공

후보:

- Berkshire Hathaway / Warren Buffett
- Duquesne Family Office / Stanley Druckenmiller
- Fisher Asset Management / Ken Fisher
- Bridgewater Associates
- Pershing Square Capital Management
- Scion Asset Management / Michael Burry
- Appaloosa Management / David Tepper
- Baupost Group / Seth Klarman
- Soros Fund Management
- Tiger Global Management
- Lone Pine Capital
- Greenlight Capital / David Einhorn
- Third Point / Daniel Loeb
- Akre Capital Management
- Pabrai Investment Funds 관련 검증된 신고주체가 있을 경우

### B. 역사 포트폴리오 프로필

- 현재 운용/공시가 없거나 개인이 사망/은퇴
- 특정 시점의 공식 공시·주주서한·펀드 자료만 제공
- `현재 포트폴리오`와 분리

예시:

- Charlie Munger 관련 역사 자료
- Peter Lynch의 Magellan 역사 사례
- Benjamin Graham의 역사적 보유/원칙

### C. 방법론 전용 프로필

- 검증 가능한 현재 13F가 없거나 13F가 방법론을 잘 대표하지 않음
- 보유 종목 표 대신 투자 원칙·체크리스트·대표 역사 사례 제공

예시:

- Mark Minervini
- William O'Neil
- Jesse Livermore
- Qullamaggie

이 분류를 사용하면 사용자가 원하는 미너비니를 페이지에 포함하면서도 존재하지 않거나 검증되지 않은 포트폴리오를 만들어내지 않는다.

---

## 3. 권장 초기 투자자 세트

### MVP 8명/기관 권장

| 순서 | 인물/기관 | 스타일 | 포함 이유 | 공개 데이터 형태 |
|---:|---|---|---|---|
| 1 | Warren Buffett / Berkshire | 집중 가치·퀄리티 | 인지도와 설명력 | 현재 13F |
| 2 | Stanley Druckenmiller / Duquesne | 매크로·성장·집중 | 자산/섹터 변화 관찰 | 현재 13F |
| 3 | Ken Fisher / Fisher Asset | 글로벌 주식·분산 | 대형 분산 포트폴리오 사례 | 현재 13F |
| 4 | Bill Ackman / Pershing Square | 집중·행동주의 | 소수 종목 변화가 명확 | 현재 13F |
| 5 | David Tepper / Appaloosa | 매크로·가치 | 경기·섹터 변화 | 현재 13F |
| 6 | Seth Klarman / Baupost | 가치·현금중시 | 13F 한계 교육에 적합 | 현재 13F |
| 7 | Michael Burry / Scion | 역발상·매크로 | 옵션/공매도 한계 설명 | 현재 13F, 강한 한계 경고 |
| 8 | Mark Minervini | 모멘텀·성장·리스크 | 사용자 명시 인물 | 방법론 전용 |

### 2차 확장 후보

- Bridgewater
- Soros Fund Management
- Tiger Global
- Lone Pine
- Third Point
- Greenlight
- Akre Capital
- Himalaya Capital 또는 Li Lu 관련 검증 가능한 공개 범위
- Pabrai 관련 검증 가능한 신고주체

### 선정 기준

1. 신고주체/CIK 검증 가능
2. 최소 8개 분기 역사 확보 가능
3. 전략 다양성
4. 사용자 인지도
5. 보유 내역이 교육적으로 의미 있음
6. 지나치게 큰 인덱스형 운용사만으로 구성하지 않음
7. 13F가 실제 전략의 일부라도 설명 가능한가

---

## 4. 페이지 정보구조

### 4-1. Landing

```text
대가의 포트폴리오
공개 포트폴리오 — 무엇을 보유했는가보다 무엇이 달라졌는가

[최신 보고분기: YYYY Qn] [13F 한계 알아보기]
[투자자 검색................................]

[집중 가치] [매크로] [성장] [행동주의] [방법론 전용]

투자자 카드 grid
```

투자자 카드 필드:

- 인물명
- 신고주체
- 스타일 태그
- 최신 보고분기
- 종목 수
- top-10 집중도
- 최신 핵심 변화 1문장
- 데이터 상태: CURRENT / PENDING / AMENDED / METHOD_ONLY / UNAVAILABLE

### 4-2. 투자자 상세

상단:

- 인물/기관
- 법적 신고주체
- CIK
- report period
- filing date
- accession link
- `분기 말 기준 · N일 지연 공시` 배지
- 13F coverage warning

핵심 지표:

- reported value
- positions
- top-5/top-10 concentration
- 신규 편입 수
- 전량 매도 수
- 확대/축소 수
- 전분기 대비 turnover proxy

탭:

1. `핵심 변화`
2. `전체 보유`
3. `섹터 구성`
4. `분기 추이`
5. `투자 원칙`
6. `원본 공시`

### 4-3. 핵심 변화 탭

- 신규 편입 top N
- 비중 확대 top N
- 비중 축소 top N
- 전량 매도
- 상위 보유 변화
- 전분기와 현재의 concentration 비교
- `이 변화가 실제 매매로 확정되는가?` corporate action/unknown badge

### 4-4. 전체 보유 탭

필수 열:

| 열 | 의미 |
|---|---|
| ticker/name | 사용자 친화 표시; 원본 issuer/CUSIP 유지 |
| class | common/ADR/ETF/option 등 |
| reported weight | 해당 13F 보고가치 내 비중 |
| shares | 보고 주식 수 또는 principal amount |
| reported value | 원본 단위 명시 |
| QoQ shares | 전분기 대비 수량 변화 |
| action | 신규/확대/유지/축소/전량매도/보류 |
| rank | 당분기 비중 순위와 전분기 순위 |
| source | 원본 row/filing 연결 |

UX:

- 기본 상위 25개만 표시
- 검색·정렬·필터
- `더 보기`로 점진 공개
- Fisher처럼 수백 종목인 경우 전체 초기 DOM 생성 금지
- sold positions는 별도 toggle
- unknown ticker도 issuer/CUSIP로 표시하고 숨기지 않음

### 4-5. 섹터 구성

- SEC issuer명만으로 추정하지 않고 검증된 ticker/security master 기반 sector 사용
- GICS 등 분류체계와 기준일 명시
- sector unknown 별도 유지
- donut 하나보다 horizontal bar가 기본
- 현재분기 vs 전분기 비교
- `보고 13F 내 섹터 비중`으로 표기

### 4-6. 분기 추이

- 최소 8분기, 권장 12분기
- positions count
- reported value
- top-10 concentration
- 신규/전량매도 수
- 선택 종목의 shares history
- 가격 변화와 주식 수 변화를 분리

### 4-7. 투자자 비교

2~4명 선택:

- 공통 보유 종목
- 각 운용자의 reported weight
- 같은 분기 신규 편입 공통 종목
- 같은 방향 확대/축소
- sector overlap
- concentration 비교
- 스타일/원칙 비교

금지:

- 공통 보유를 추천 신호로 표현
- 서로 다른 report period를 같은 시점처럼 비교
- 운용 규모가 다른 reported value 자체를 우열로 해석

### 4-8. 투자 원칙

- 대가의 책·주주서한·공식 인터뷰·펀드 문서에 근거한 요약
- 긴 직접 인용 금지
- `공개 보유에서 관찰되는 패턴`과 `본인이 말한 원칙` 분리
- 1번 시장 원리 페이지의 관련 lesson 연결
- Minervini 같은 METHOD_ONLY 프로필의 주 화면

---

## 5. 데이터 모델

```text
public-data/masters/
├─ index.json
├─ managers.json
├─ security-master.json
├─ periods.json
├─ berkshire-hathaway/
│  ├─ profile.json
│  ├─ 2026-q1.json
│  ├─ 2025-q4.json
│  └─ history-summary.json
├─ duquesne-family-office/
│  └─ ...
└─ mark-minervini/
   └─ profile.json   # METHOD_ONLY
```

### manager profile

```json
{
  "id": "duquesne-family-office",
  "displayName": "Stanley Druckenmiller",
  "filerName": "Duquesne Family Office LLC",
  "cik": "0001536411",
  "form13fFileNumber": "028-14660",
  "profileType": "LIVE_13F",
  "strategyTags": ["macro", "growth", "concentrated"],
  "sourceUrls": [],
  "reviewedAt": "YYYY-MM-DD"
}
```

### filing artifact

```json
{
  "schemaVersion": "masters-13f.v1",
  "managerId": "duquesne-family-office",
  "reportPeriod": "2026-03-31",
  "filedAt": "2026-05-15",
  "formType": "13F-HR",
  "amendmentType": null,
  "accession": "...",
  "sourceUrl": "https://www.sec.gov/...",
  "summary": {
    "entryTotal": 70,
    "reportedValueThousands": 3376827
  },
  "holdings": [],
  "quality": {},
  "generatedAt": "..."
}
```

### holding row

- issuerNameRaw
- titleOfClassRaw
- cusipRaw
- tickerNormalized nullable
- securityNameNormalized nullable
- sharesOrPrincipal
- shareType
- valueThousands
- putCall nullable
- investmentDiscretion
- votingAuthority
- sector nullable
- mappingConfidence
- sourceRowKey
- previousShares nullable
- changeShares nullable
- changePct nullable
- action
- actionConfidence
- corporateActionFlag

---

## 6. SEC 수집·정규화 파이프라인

현재 `fetchSEC13F(ticker)`는 종목 검색용 URL 안내 성격이므로 매니저 중심 수집 파이프라인을 별도로 설계한다.

### 단계

1. `managers.json`의 CIK allowlist 로드
2. SEC submissions/filings에서 최신 13F 계열 조회
3. report period별 13F-HR/13F-HR/A/13F-NT 분류
4. cover page와 information table XML 다운로드
5. 원본 row 파싱
6. summary entry count/value와 대조
7. amendment 의미 해석
8. CUSIP/security master 정규화
9. 이전 분기와 shares 기준 비교
10. corporate action 탐지
11. sector/industry enrichment
12. quality report 생성
13. manager별 JSON atomic write
14. index/period summary 갱신

### SEC 접근 원칙

- User-Agent 요구 준수
- 요청 속도 제한
- 동일 filing cache
- 실패 시 기존 정상 artifact 유지
- HTML 화면 scraping보다 XML/structured source 우선
- SEC 원문 accession URL 보존
- source response를 임의 보정하지 않고 raw 필드 유지

### amendment 처리

- `restatement`: 해당 분기의 이전 artifact를 대체하되 superseded accession 기록
- `adds new holdings entries`: 원 filing과 병합하되 amendment type 기록
- 의미가 불명확하거나 row reconcile 실패: `AMENDMENT_REVIEW_REQUIRED`
- 화면에 `수정 공시 반영` 배지
- amendment 수신 후 이전 비교도 재계산

### notice/combination report

- 13F-NT는 holdings가 다른 manager report에 포함될 수 있으므로 빈 포트폴리오로 표시 금지
- combination report는 included managers를 추적
- 중복 합산 방지
- MVP에서 안전하게 처리할 수 없으면 해당 manager를 `PARTIAL`로 표시

---

## 7. 정규화와 계산

### 7-1. ticker mapping

- 원본 식별자는 CUSIP/issuer/class다.
- ticker는 사용자 편의를 위한 파생값이다.
- ticker mapping 실패는 데이터 실패가 아니다.
- 유사 회사명 fuzzy match만으로 ticker 확정 금지.
- share class/ADR/ordinary share를 분리한다.
- CUSIP 변경·합병·분할 이력 필요.

### 7-2. weights

```text
reportedWeight = holding.valueThousands / filing.summary.reportedValueThousands
```

- denominator가 유효하고 reconcile된 경우만 계산
- option row는 일반 주식과 분리 가능
- negative weight 금지
- 합계가 100%를 크게 벗어나면 fail

### 7-3. concentration

- top-5 / top-10 reported weight 합
- 동일 issuer의 여러 class 통합 여부를 toggle할 수 있으나 기본은 security row 기준
- issuer aggregate는 별도 파생값

### 7-4. turnover proxy

13F만으로 실제 매매 turnover를 완전히 알 수 없으므로 `turnover`가 아니라 `quarterly change proxy`로 명명한다.

가능한 기본식:

```text
sum(abs(currentWeight - previousWeight)) / 2
```

단, 가격변화가 섞이므로 화면에 한계를 표시한다. shares 기반 별도 change count를 함께 제공한다.

### 7-5. action confidence

- HIGH: 동일 CUSIP/class, corporate action 없음, shares 직접 비교
- MEDIUM: 정규화된 issuer 동일이나 CUSIP 변경 가능성 있음
- LOW: option/class/ticker mapping 불명확
- REVIEW_REQUIRED: 분할·합병·amendment reconcile 문제

LOW/REVIEW_REQUIRED는 강한 매수·매도 동사 금지.

---

## 8. 갱신 주기

사용자의 판단대로 2번 페이지도 상시 갱신할 필요가 없다.

### 데이터별 cadence

| 데이터 | 주기 |
|---|---|
| manager profile | 연 1회 또는 운용사 변화 시 |
| 투자 원칙/약력 | 연 1회 또는 공식 자료 추가 시 |
| 13F holdings | 분기별 |
| amendment | 신규 수정공시 감지 시 |
| ticker/security master | 월 1회 또는 mapping 실패 시 |
| sector classification | 분기별 |
| 원본 링크/CIK | 반기 검토 |

### 권장 자동화

- 분기 마감 후 매일 돌릴 필요 없음
- 13F 제출 window에서만 일별 또는 2~3일 간격으로 확인
- 마감 후 1주 동안 amendment/지연 filing 추가 확인
- 그 이후 월 1회 amendment check
- 새 분기가 완성되지 않았으면 이전 분기를 유지하고 `다음 공시 대기` 표시

### UI 상태

- CURRENT: 최신 예상 분기 확보
- PENDING: 분기 종료 후 아직 filing 없음
- PARTIAL: 일부 report/manager 포함 문제
- AMENDED: 수정공시 반영
- STALE: 예상 filing window가 지났으나 갱신 실패
- METHOD_ONLY: 포트폴리오 데이터 없음, 원칙만 제공
- UNAVAILABLE: 검증된 공개 데이터 없음

---

## 9. 출처와 신뢰도

### 1차 출처

- SEC EDGAR filing cover page
- SEC information table XML
- SEC official Form 13F datasets/FAQ

### 2차 출처

- 공식 운용사 사이트
- 주주서한/펀드 레터
- 공식 인터뷰/책
- 회사 IR

### 3차 출처

- WhaleWisdom 등은 mapping/교차검증에만 사용 가능
- 3차 출처의 holdings 숫자를 SEC 원본 대신 SSOT로 사용하지 않음
- 라이선스·재배포 권리 확인 전 artifact에 원문 대량 저장 금지

---

## 10. UI 문구 계약

권장:

- `보고된 보유`
- `13F 보고가치 내 비중`
- `분기 말 기준`
- `전분기 대비 보고 주식 수`
- `수정공시 반영`
- `현재 보유와 다를 수 있음`
- `방법론 프로필 — 공개 13F 미확인`

금지:

- `현재 버핏이 보유 중`
- `대가가 방금 매수`
- `확실한 매수 신호`
- `전체 포트폴리오`
- `현금 비중 0%`
- 공매도/옵션을 13F long table만으로 추론

---

## 11. 후속 구현 에이전트 작업 패킷

### MF-00. 사용자 결정 동결
- 초기 투자자 목록
- METHOD_ONLY 허용 여부
- history 분기 수
- 옵션 row 기본 표시 정책
- 자동화 수준
- **승인 전 코드 수정 금지**

### MF-01. manager registry
- 인물↔신고주체↔CIK 수동 검증
- profileType 분류
- 중복/이름 변형 처리

### MF-02. SEC collector
- rate limit/User-Agent/cache
- submissions→filing→XML
- raw artifact/normalized artifact 분리

### MF-03. parser/reconcile
- cover summary
- information table
- value unit
- entries/value reconciliation
- amendment/notice/combination

### MF-04. security master/diff
- CUSIP/ticker/class mapping
- corporate actions
- shares-based action classification
- confidence

### MF-05. page shell/render
- landing/investor detail
- tabs/table/filter
- loading/error/partial/method-only states
- mobile/a11y

### MF-06. comparison/history
- common holdings
- sector overlap
- shares history
- period alignment

### MF-07. principles profiles
- 공식 출처 기반 원칙 요약
- 시장 원리 페이지 lesson 연결
- Minervini METHOD_ONLY 구현

### MF-08. automation
- quarterly schedule
- amendment follow-up
- atomic write/LKG
- failure report

### MF-09. tests/gates/docs
- fixture filings
- amendment/corporate action/ticker unknown
- full-route a11y
- no-current-holding claim
- version/docs sync only after implementation authorization

---

## 12. 인수 조건

### 데이터
- 모든 LIVE_13F manager에 검증된 CIK가 있다.
- filing period/filedAt/accession/source URL이 있다.
- summary entry count/value가 원본과 reconcile된다.
- 이전 분기 비교는 동일 기간 규칙을 사용한다.
- ticker unknown row를 버리지 않는다.
- amendment 처리 결과가 추적 가능하다.

### 의미
- 인물과 신고주체를 동일시하지 않는다.
- 13F가 전체 포트폴리오라고 주장하지 않는다.
- 평가액 증가를 매수로 오판하지 않는다.
- 현재 보유라고 표현하지 않는다.
- METHOD_ONLY 인물에게 가짜 holdings를 만들지 않는다.

### UX
- 사용자가 latest period와 filed date를 즉시 알 수 있다.
- 상위 변화와 전체 보유를 분리한다.
- 대형 포트폴리오도 초기 화면이 과밀하지 않다.
- 모바일에서 보유표를 읽을 수 있다.
- 원본 SEC filing으로 이동할 수 있다.

---

## 13. 사용자에게 필요한 결정

### 꼭 필요한 결정

1. **초기 투자자 목록**
   - 권장 MVP 8명/기관은 §3 참조
   - 사용자가 반드시 넣고 싶은 인물과 제외할 인물 필요

2. **미너비니 처리 방식**
   - 권장: 방법론 전용 프로필로 포함, 검증된 신고주체가 확인될 때만 holdings 활성화
   - 대안: 페이지에서 제외

3. **페이지의 중심**
   - 권장: holdings 70% + 투자 원칙 30%
   - 대안: 인물 스토리/철학 중심

4. **과거 분기 범위**
   - 권장: 12분기
   - 경량 대안: 8분기

5. **옵션 표기**
   - 권장: 기본 holdings에서 분리하고 `옵션 보고` 탭/필터 제공
   - 이유: 일반 주식과 합치면 순노출 오해 가능

### 기본값으로 처리 가능한 결정

- SEC 원본 SSOT
- 분기 자동 갱신
- manager JSON 지연 로드
- 초기 상위 25종목
- 수정공시 자동 재처리
- 비중은 reported 13F value 기준
- 인물사진 대신 모노그램 사용 가능
- 매수 추천 문구 금지

---

## 14. 후속 에이전트 시작 프롬프트

```text
_context/MASTERS-PORTFOLIO-13F-PAGE-DESIGN-HANDOFF-2026-08-01.md를 디자인 SSOT로 읽어라.
이 문서는 DESIGN_ONLY이며 구현 완료를 뜻하지 않는다.
MF-00 사용자 결정과 현행 RULES/CODE-MAP/SEC 관련 기존 함수를 먼저 대조하라.
사람 이름을 SEC 신고주체로 추정하지 말고 CIK와 filing을 직접 검증하라.
13F를 현재/전체 포트폴리오로 표현하지 마라.
구현 승인 후 MF-01→MF-09 순서로 진행하라.
```
