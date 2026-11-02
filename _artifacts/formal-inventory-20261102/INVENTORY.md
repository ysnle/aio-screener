# AIO 상태 기계 목록과 검증 대상 순위 (2026-11-02)

전체 코드베이스에서 "여러 사건이 어떤 순서로 겹쳐도 지켜야 하는 약속"을 가진 상태 기계를 평면별로 모은 목록이다. 조사는 읽기 전용 서브에이전트 3개(배포·파이프라인, 클라이언트 런타임, 생산자·운영)가 코드를 직접 열어 했고, 실패 집계는 `gh run list`로 직접 셌다. "가설"은 코드만 읽고 재현하지 않은 것이다.

## 1. 지난 7일 Actions 실패 (10/26~11/02, 실패 85 · 성공 894)

| 워크플로 | 실패 | 원인 유형 |
|---|---:|---|
| Data freshness watchdog | 57 | 하위 실패의 반영: AI 키 만료(11/02 401), Put/Call 원천 11.5일 정체, 배포 실패 |
| Deploy GitHub Pages | 9 | 배포 직후 라이브 검사가 Pages의 HTTP 503(`src/chunks/*.js`, `public-config.json`)을 만남. 배포→라이브 반영 사이 공백 |
| Refresh market data · scheduler | 9 | `data-refresh` 게이트: Put/Call(Cboe) 10/22 이후 갱신 없음 → CRITICAL |
| Deploy AI proxy | 3 | OpenAI 키 무효화·만료(코드 아님, 13:55Z 해결) |
| Refresh screener and SEC fundamentals | 3 | SEC 런타임 투영이 1 MiB 초과 |
| CI | 2 | 뉴스 선별 감사 고정값, 화면 텍스트 예산 |

## 2. 평면별 후보 (약속 · 피해 · 지금 검사)

### 배포·데이터 파이프라인
| # | 상태 기계 | 약속 | 지금 검사 | 사고 |
|---|---|---|---|---|
| P1 | SEC 원장 data-store 발행 ↔ main manifest (`sec-fundamentals-store.mjs`, `refresh-screener.yml:268-292`) | main이 가리키는 digest는 data-store에 존재했던 것 | 문자열 순서만. 발행 뒤 push 실패 겹침 없음 | P1757, P1900 |
| P2 | 릴리스 게이트: CI 증명 → Pages 배포 → 라이브 검사 | CI가 증명한 그 SHA만, 그때의 main head일 때만 공개 | SHA 일치 한 장면 | P1351, P1308, P2112, P1952 |
| P3 | 축소 범위 릴리스의 "직전 전체 검증" 요건 | 축소 검증 커밋 아래 항상 전체 검증 통과 코드 | 문자열 계약 | P1952 |
| P4 | main 쓰기 경합: refresh-data·screener core(같은 그룹), extended·event-briefs(다른 그룹), 사람 push | 검증된 후보와 다른 트리는 push되지 않음 | 충돌 해소 한 장면 | P564, P2050, R626 |
| P5 | Worker 수렴 → 배포 → 스모크 → 롤백 | 더 새 라이브를 되돌리지 않고, 실패 배포는 정확히 복원 | 결정 표 단위 | P1335, P1341, P1433, P1520 |
| P6 | 라이브 수렴 드라이버(`ensure-live-convergence.mjs`) | 멱등, 증명된 리비전만 배포 요청 | 한 장면 | R606(13.4시간 정체) |
| P7 | 감시·경보 래치(`operations-alert.yml`) | 실패 2연속에 한 번 열고 성공 2연속에 닫음 | 장면 몇 개 | P2102, P2161, P2205 |

### 클라이언트 런타임
| # | 상태 기계 | 약속 | 지금 검사 | 사고 |
|---|---|---|---|---|
| C1 | 자동 갱신 스케줄러의 숨김 일시정지 플래그(`refresh-scheduler.js:37,488-496,759-842`) | 보이는 탭의 자동 갱신은 숨김·복귀·수동 새로고침이 겹쳐도 살아 있음 | 없음(정규식 존재만) | 없음 — **가설: 숨김 중 시작한 실행의 finally가 플래그를 되돌려 갱신이 조용히 멈춤** |
| C2 | 포트폴리오 다중 탭 저장(`aio-workspace.js:86-130`) | 두 탭이 같은 키를 고쳐도 조용히 덮지 않음 | 한 탭 e2e, 다중 탭은 수동 | P2095, P2106, P2129 |
| C3 | 아티팩트 로더 강제 갱신 vs 진행 중 요청(`artifact-cache.js:107-175`) | 강제 갱신 뒤 읽기는 갱신 이후 출발한 응답만 봄 | 개별 장면 | P1518 — **가설: 클리어 전 출발한 응답이 다시 캐시에 씀** |
| C4 | 서비스워커 인수 중 신·구 코드 혼합 | 인수 뒤 혼합 상태 없음, 리로드 정확히 1회 | 모의 컨트롤러 한 장면 | P2120, P1901 |
| C5 | AI 채팅 요청 수명주기(`aio-chat.js:863-990`) | 활성 run 최대 1, 취소·교체된 답은 화면에 안 닿음 | 개별 장면 | P2171, P2139, P2182 |
| C6 | 라우터 전환·지연 로드·마운트 소유권 | 떠난 화면의 비동기 결과는 화면에 닿지 않음 | 17개 라우트 3바퀴 | P1518, P2204 |
| C7 | 화면 간 일회성 대기 상태(`_aioOpenThemeDetailOnThemes` 등) | 요청한 이동에만 속하고 소비·이탈 시 지워짐 | 한 순서 | P2204, P2210 (반복) |

### 생산자·운영
| # | 상태 기계 | 약속 | 지금 검사 | 사고 |
|---|---|---|---|---|
| D1 | 시세 세션 분류 `deriveMarketSession`(`build-market-snapshot.mjs:86-244`) | 완료 종가와 장중 값을 서로 잘못 읽지 않음 | 2주×10분 훑기지만 8개 심볼·`REGULAR`만, KR 휴장 없음 | P2162, P2159, P2098 (실패 16건) |
| D2 | 이전 종가 선택(`quotes.mjs:52-260`) | 등락률 기준은 직전 세션 확정 종가, 없으면 비움 | 예시 단위 | P1799, P2065, P2073, P545 |
| D3 | 회전(RRG) 확정 세션 재사용(`rotation-history.mjs`) | 종가 120분 뒤 수집분만 재사용 | 한 장면 | P2208 |
| D4 | 레인 격리 수명주기(`lane-quarantine.mjs`) | 격리는 첫 실패 시각 유지, 24시간 넘으면 드러남 | 한 장면 | P1975, P1977, P1982 |
| D5 | 랠리 시도/FTD 상태기계(`rally-attempt.js`) | 상태는 거래일 순서에만 의존, 재실행해도 같은 값 | 합성 한 장면 | v59.57 신규 |
| D6 | 운영 신선도·건강 증거 재사용(`build-operations-status.mjs:354-390`) | 신선도는 관측 시점 판정 | 미확인 | **가설: 실패한 관측이 24시간 fresh로 재표시** |
| D7 | Worker 시세 평면 전일가(`worker/data-plane.js:156`) | P545/P1799와 같은 기준 | 없음 | 잠복(fast plane 비활성) |

### 이미 모델 검사가 있는 것
AI 예산 원장(`ai-ledger-model`), history 세션(`history-session-model`), AI 시황 수명주기(`narrative-lifecycle-model`).

## 3. 순위와 이번 회차 계획

기준: 깨지면 피해(돈·사용자 입력·틀린 숫자·라이브 정체) × 순서 겹침이 원인인 정도 × 지금 검사가 순서를 못 보는 정도 × 실제 사고.

| 순위 | 대상 | 도구 | 이유 |
|---|---|---|---|
| 1 | P1+P2+P4+P6 릴리스 파이프라인 전체 | TLA+ + `/pstack:statechart` | 여러 워크플로·브랜치·배포가 얽힌 순서 문제라 코드 한 파일로는 안 보임. 사고 최다 |
| 2 | D1 시세 세션 분류 | 실제 코드 전수 검사 | 매 실행 게이트이고 반복 파손. 지금 훑기에서 빠진 심볼·세션 분기가 큼 |
| 3 | C1 스케줄러 일시정지 | 실제 코드 전수 검사 | 게이트도 사고 기록도 없는 가설 결함, 피해가 조용함 |
| 4 | C3 아티팩트 강제 갱신 | 실제 코드 전수 검사 | 새로고침 뒤 옛 자료 가설 |
| 5 | C2 포트폴리오 다중 탭 | 실제 코드 전수 검사 | 사용자 입력 손실 |
| 이후 | P5, P7, D2~D7, C4~C7 | 다음 회차 | |

화면·콘텐츠(8개 화면, 용어 사전, AI 패널, 셸)는 순서 문제가 아니라 "지금 보이는 것이 맞는가"의 문제라 formal이 아니라 `verify-aio` 기능 맵(`maintain-verification-skill`)과 전 기능 drive로 본다.

## 4. 결과 1 — 릴리스 파이프라인 TLA+ (`/pstack:statechart`)

모델: `Release.tla`(세션 스크래치, 아래 재실행 명령). 행동은 refresh-screener의 복원·수집·저장소 발행·main push·포기, 다른 작성자 push, CI 검증·취소, Pages 배포. 상수 커밋 4개·원장 digest 3개, 2,944 상태 전수.

| 규칙 | 소유자 문장 | 결과 |
|---|---|---|
| StoreNeverBehindMain | main이 가리키는 원장은 저장소에 항상 있거나 더 새 것이 있다 | 지킴 |
| LiveIsAttested | 사이트에는 CI가 끝난 커밋만 올라간다 | 지킴 |
| LiveNeverGoesBack | 사이트가 더 옛 커밋으로 되돌아가지 않는다 | 지킴 |
| LiveCheckedAgainstFullLedger | 사이트의 커밋은 그 커밋이 가리키는 전체 원장으로 검증됐다 | **깨짐**: 발행 → 확장 스크리너·이벤트 브리프·사람이 main에 커밋 → CI가 digest 불일치로 전체 원장 검사를 건너뜀(P1757 SKIP) → 배포 |
| HeadVerifiableBetweenRuns | 스크리너 실행 사이에는 main 최신 커밋을 정확한 원장으로 검증할 수 있다 | **깨짐**: 복원 → 수집 → 저장소에 새 원장 발행 → main push 실패(포기) → 다음 스크리너 실행까지 저장소가 main보다 앞섬 |

모델이 실패할 수 있는지: 고장 변형 3개를 TLC가 모두 잡음 — push 뒤 발행(P1757 이전 순서) → StoreNeverBehindMain 위반, Pages의 main head 재확인 제거 → LiveNeverGoesBack 위반, CI 대기 중 배포 → LiveIsAttested 위반.

실제 코드 재현(과거 실행 로그): 실행 38854259134(10/16 05:15Z)에서 `publish`가 `{"published":true,"reason":"replaced","sha256":"f065a81b…"}`를 찍은 뒤 rebase 충돌(history.json·operations-status.json)로 exit 1 → 저장소가 main보다 앞선 채 남음. 38241555138(10/12)도 같은 충돌. 두 번째 깨짐(발행~push 사이 다른 작성자 커밋)은 같은 기제의 짧은 창이라 별도 재현 없이 코드 순서(`refresh-screener.yml` 발행 → commit → `until git push`, `ci.yml` restore `continue-on-error`)로 확인.

피해: 그 창 동안 main에 들어간 커밋은 SEC 전체 원장 게이트가 "SKIP" 라벨로 통과하고 공개된다. 틀린 숫자가 나간다는 뜻은 아니고, 검증 공백이 조용히 생긴다는 뜻. 고치려면(제품 결정) 저장소에 직전 digest 한 칸을 더 보관하거나, CI가 manifest digest를 못 찾으면 "SKIP"이 아니라 다음 스크리너 실행 뒤 재검증을 예약하는 방식이 있다.

모델이 빼놓은 것: 원장 내용(digest를 숫자로만 셈), 확장 스크리너의 자체 원장 쓰기, Pages 재시도·30초 대기, 라이브 수렴 드라이버의 Worker 쪽, 동시에 두 스크리너 실행(같은 concurrency 그룹이라 제외). 차트는 복원·수집·CI 취소 단계를 숨김.

별도 발견(모델 밖, 로그로 확인): Pages 실패 9건은 배포 직후 `ci-live-invariant-check`가 Pages의 HTTP 503을 만나는 것. 앞 단계 `ci-external-pipeline-check`는 재시도(`AIO_EXTERNAL_RETRY_MS`)하지만 이 검사는 재시도가 없다.

## 5. 결과 2 — 코드 단위 모델 검사 3개 (실제 함수 구동, `/model-check`에 등록)

| 게이트 (qa 그룹) | 대상 | 범위 | 결과 |
|---|---|---|---|
| `market-session-model` (data) | D1 `deriveMarketSession` + 시장 달력 | 2026-11-16~30, 12-21~01-06, 2027-02-04~13을 10분 간격, 지수 7개 × 공급자 표기 3종, 116,446 판정 | **결함 2건(KNOWN 고정)** |
| `refresh-scheduler-model` (core) | C1 `installRefreshScheduler` | 숨김·복귀·갱신 요청·응답·타이머의 모든 순서, 깊이 6, 5,372 순서 | **결함 1건(KNOWN 고정)** — 가설 확인 |
| `artifact-cache-model` (core) | C3 `loadJsonArtifact`/`clearArtifactCache` | 읽기·강제 읽기·수동 새로고침·새 파일 게시·응답, 깊이 6, 19,180 순서 | **결함 1건(KNOWN 고정, 피해 낮음)** — 가설 확인 |

각 게이트의 고장 변형(가드 하나씩 제거)이 모두 KNOWN 밖 위반을 냄 = 실패할 수 있는 검사. KNOWN은 "장면" 단위라, 같은 종목이라도 다른 장면에서 깨지면 게이트가 실패한다. 고치면 "KNOWN finding no longer occurs"로 알려 준다.

발견 (코드 용어로):
1. **SMH, 미국 반일장·휴장** — `scheduledSession`이 SMH를 평일 09:30~16:00 고정으로 보고, `isLatestUsRegularClose`는 현금 지수만 본다. 11-27(13:00 마감) 13:00~16:00에 확정 종가가 "장중"으로, 그 뒤엔 STALE_UNEXPECTED로 분류된다. 12-25 휴장일엔 12-24 반일장 종가가 24시간을 넘자마자 STALE_UNEXPECTED. 피해: 그 시간 refresh-data의 history 대조가 SMH 전일가·당일가를 바꿔 비교하거나 근거 행이 빠진다. 다음 발생: 11-27(금) 오후.
2. **KOSPI·KOSDAQ 월요일 09:00~09:20 KST** — 두 지수는 20분 지연이라(11-02 00:21Z 스냅숏이 00:01Z 값) 개장 뒤 20분간 금요일 종가를 들고 있는데, 장중 24시간 한도에 걸려 STALE_UNEXPECTED. v59.49에서 ^RUT로 고친 것과 같은 결함의 한국판. 크론 :17 실행이 09:17 KST에 걸리면 스냅숏 품질 게이트가 막힌다(지금까지는 실행이 09:20 넘어 시작해 비켜 감 — 11-02 00:20Z, 10-26 00:20Z 성공). 휴일 다음 날·수능일 10:00~10:20도 같음.
3. **자동 갱신 스케줄러 정지** — 최단 경로: 숨김 → 갱신 요청(포트폴리오·스크리너 4초 재시도, AI ensure-fresh가 숨김 중에 부를 수 있음) → 복귀 → 응답. `runScheduledRefresh`가 시작 시점의 일시정지 값(true)을 `finally`에서 되돌려, 보이는 탭이 "일시정지" 상태로 남고 모든 타이머가 재예약 없이 끝난다. 피해: 탭을 다시 숨겼다 열 때까지 자동 갱신이 조용히 멈춤.
4. **수동 새로고침 직전 출발한 요청** — 읽기 → 새 파일 게시 → 수동 새로고침 → 읽기: `clearArtifactCache({abortInFlight:false})`가 보관 사본만 비우고 진행 중 요청은 살려 두어, 새로고침 뒤 읽기가 그 옛 요청에 합류하고 6시간 보관된다. 피해 낮음(요청은 최대 15초 전 출발 — 그 사이 배포가 있어야 함).

모델 밖: D1은 FX·선물(기존 평일 훑기), VIX/TNX/IRX 시간외, 도쿄·홍콩, PRE/POST 표기; C1은 페이지 진입 갱신·지터 값; C3은 무결성·바이트 한도·정체·시간 초과·축출. C2(포트폴리오 다중 탭)·P5·P7·D2~D7·C4~C7은 다음 회차.
