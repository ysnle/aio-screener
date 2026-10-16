# R 규칙별 검토표

본문을 읽은 항목의 판정은 해당 문맥에서의 의미 검토다. 구현 완료 인증이 아니다. 제목만 남은 항목은 본문 미확인으로 남긴다. 중복 ID는 제목과 line을 함께 본다. R1-A는 하위 정책으로 별도 대조한다. 이 표를 제품 지침으로 자동 적용하지 않는다.

| ID | line | 상태 | 판정 | 검토 근거 | 제목 |
|---|---:|---|---|---|---|
| R1 | 2234 | retained-body | 조건부 유지 | 코드 배포판의 버전 동기화 도구는 유지하되 데이터 revision·문서 편집과 분리하고 과거 7곳 목록을 현행 계약으로 읽지 않게 한다. | R1. 버전 동기화 (7곳 필수) |
| R1-A | 2260 | retained-body | 조건부 유지 | 배포 identity와 사용자 cache 갱신 확인은 필요하다. 강제 새로고침만으로 정상 복귀를 인증하지 말고 기존 SW/warm cache 사용자 경로도 검증한다. | GitHub 배포 후 브라우저 버전 확인 |
| R2 | 2273 | superseded | 역사 기록 | R475 대체 선언을 보존한다. 버전 표기법 자체는 제품 내부 약속이며 산업 표준이나 품질 근거가 아니다. | R2. 버전 체계 |
| R3 | 2278 | retained-body | 개정 | 중요 결함의 재현·원인·회귀 기록은 유지하되 모든 사소한 수정에 별도 P/다중 원장 확장을 강제하지 말고 원인별 배치 기록을 허용한다. | R3. 버그 수정 시 사후 분석 필수 |
| R4 | 2291 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R4. 동적 DOM 삽입 주의 |
| R5 | 2292 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R5. CSS overflow 3중 방어 |
| R6 | 2293 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R6. LLM 응답 렌더링 안전장치 |
| R7 | 2294 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R7. 한국어 텍스트 레이아웃 검증 (v31.9 추가) |
| R8 | 2295 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R8. 차트 카드 텍스트 폴백 필수 (v31.9 추가) |
| R9 | 2311 | retained-body | 개정 | 데이터 의존성에 따라 mount/갱신/dispose를 계약화한다. 모든 화면에 legacy pageShown/liveQuotes 리스너와 init 플래그를 강제할 이유는 없다. | R9. Dead Page 방지 — 페이지 3종 세트 + init 가드 리셋 필수 (v31.10 추가, v42.1 강화) |
| R10 | 2296 | retained-body | 개정 | issuer와 listing의 검증은 유지한다. Yahoo quote를 공식 회사명 확인으로 간주하거나 가격·시총 직감으로 신원을 확정하지 말고 거래소/SEC 식별자를 우선한다. | R10. 종목코드 입력 시 3중 검증 필수 (v35.6 추가) |
| R11 | 2302 | superseded | 역사 기록 | R10으로 대체된 중복 금지의 이력을 보존한다. | R11. 비상장 기업 코드 할당 금지 (v35.6 추가) |
| R12 | 2306 | retained-body | 유지 | 모회사·자회사와 유사 상호를 구분하는 것은 다른 자산 데이터 혼입을 막는다. 공식 issuer/listing 신원을 근거로 한다. | R12. 유사 이름 모자회사 구분 (v35.6 추가) |
| R13 | 2309 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R13. CHAT_CONTEXTS 이원화 필수 (v37.5 추가) |
| R14 | 2310 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R14. 뉴스 키워드 현행화 (v37.6 추가) |
| R15 | 2321 | retained-body | 조건부 유지 | 결측과 0의 구별은 유지한다. 필드별 필수성을 정하고 price/pct 동시존재·전 화면 liveQuotes 연결·grep 의식을 일반화하지 않는다. | R15. 데이터 미수신 vs 진짜 0% 구분 필수 (v38.3 추가, P25, v42.1 강화) |
| R16 | 2331 | retained-body | 개정 | 티커 귀속은 토픽명이 아니라 본문에서 입증된 issuer와 사건 관계로 판단한다. 관세·수출규제 뉴스도 직접 관련 회사가 있을 수 있다. | R16. 뉴스 티커 표시 규칙 (v39.0 추가, P30) |
| R17 | 2337 | retained-body | 개정 | 한영 최소 길이는 오탐 완화 휴리스틱이다. AI/QE/EV 등 유효 약어를 금지하지 말고 정확 토큰·문맥·반례 집합으로 검증한다. | R17. 뉴스 키워드 추가 시 길이 제한 (v39.0 추가, P28, v42.1 강화, v42.5 재정의) |
| R18 | 2345 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R18. 텔레그램 채널 관리 (v39.0 추가, P29) |
| R19 | 2346 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R19. _context/ 지식 정합성 린팅 (v40.4 추가) |
| R20 | 2347 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R20. 에이전트 산출물 검증 상태 관리 (v40.4 추가) |
| R21 | 2348 | retired | 역사 기록 | 고정 3일 만료 규칙의 퇴역을 유지한다. 원천별 발행 주기로 대체하는 방향이 타당하다. | R21. 하드코딩 차트 데이터 경과일 관리 (v40.4 추가, P31) |
| R22 | 2354 | retained-body | 개정 | 점수45/30·정치감점25·기사수 상한은 품질 보장이 아니다. 실제 관련성/지연/누락 사례로 조정하며 고정 부스트를 의미 근거로 쓰지 않는다. | R22. 뉴스 3곳 계층적 선별 체계 (v40.4 추가, P32) |
| R23 | 2360 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R23. 외국 기업(ADR) 재무 파싱 (v40.4 추가, P33) |
| R24 | 2361 | retained-body | 개정 | 문서 위치 인덱스는 유용하다. 10버전 차이를 노후 기준으로 삼지 말고 해당 계약·원천 변경 여부로 검토를 촉발한다. | R24. _context/ 인덱스 자동 관리 (v41.6 추가) |
| R25 | 2366 | retained-body | 개정 | 역참조는 유지하되 위반 3회만으로 더 강한 규칙을 자동 정당화하지 않는다. 영향도·재현성·방지 비용을 함께 판단한다. | R25. 버그 역참조 체계 (v41.6 추가) |
| R26 | 2372 | retained-body | 조건부 유지 | 반복 가치가 있는 인사이트만 연결해 저장한다. 모든 대화 발견을 원장으로 복제하면 검색 비용과 오래된 지식이 늘어난다. | R26. 기술 인사이트 환류 (v41.6 추가) |
| R27 | 2378 | retained-body | 개정 | 필요한 command 발견성과 미러 정합은 유지한다. wrapper 개수 일치는 기능 정합이 아니며 별개 CHAT_CONTEXTS 매핑은 registry 파생 대상으로 분리한다. | R27. Commands ↔ Skills 동기화 (v46.2 추가, P69 교훈) |
| R28 | 2385 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R28. 실제 클릭 테스트 필수 (v46.5 추가, P82 교훈) |
| R29 | 2386 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R29. AI 채팅 데이터 검증 태그 (v46.5 추가) |
| R30 | 2387 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R30. 지표 라벨/임계값 전역 통일 (v46.8 추가, P83~P104 교훈) |
| R31 | 2388 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R31. innerHTML XSS 전수 점검 (v46.8 추가, P100 교훈) |
| R32 | 2392 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R32. Event Delegation 의무화 — onclick 인라인 핸들러 금지 (v48.35 추가, P132 교훈) |
| R33 | 2389 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R33. 데이터 Freshness 추적 의무화 — DATE_ENGINE + _markFetch + _aioFeedHealth (v48.39 추가, P133 교훈) |
| R34 | 2489 | retained-body | 조건부 유지 | 테마 토큰 우선은 타당하다. Canvas 예외는 토큰을 계산된 색으로 변환해 전달하는 방식도 허용하며 흰색 rgba의 직접 복제를 권장하지 않는다. | R34. CSS 색상 토큰 우선 — rgba 하드코딩 금지 (v48.54 추가) |
| R35 | 2523 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R35. 신규 페이지 → CHAT_CONTEXTS 동시 생성 (v48.54 추가, P106 교훈) |
| R36 | 2524 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R36. Themes 페이지 종목 추가 → LIVE_SYMBOLS 동시 등록 (v48.54 추가) |
| R37 | 2525 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R37. data-snap 신규 추가 → 자동 렌더러 참여 (v48.54 추가, P108 교훈) |
| R38 | 2526 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R38. `on*` 인라인 이벤트 핸들러 금지 — 전체 확장 (R32 확장, v48.54 추가) |
| R39 | 2527 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R39. extractTickers → UI 노출 경로 필수 페어링 (v48.55 추가, P116/P121/P122/P125 교훈) |
| R40 | 2528 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R40. CHAT_CONTEXTS system() = persona + 메서드론만 (v48.55 추가) |
| R41 | 2529 | retired | 역사 기록 | 개인 FMP 심층 fetch 퇴역 이력이다. 공용 SEC 사실로 이전하는 방향은 운영 비용과 키 보호에 맞다. | R41. 기업 분석 맥락 ctx 전원 FMP 심층 활성 (v48.55 추가) |
| R42 | 2531 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R42. Agent 결과 실측 교차검증 의무 (v48.59 추가, Agent 오판 5회 누적) |
| R43 | 2532 | superseded | 역사 기록 | Canvas 예외가 R34에 통합됐으므로 독립 의무로 중복 적용하지 않는다. | R43. Canvas context는 CSS var 미해석 (R34 예외, v48.59 추가) |
| R44 | 2534 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R44. setTimeout 무한 재귀 종료 카운터 필수 (v48.59 추가, renderAllEtfGrid 교훈) |
| R45 | 2535 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R45. 페이지 전환 active 설정은 `dataset.arg` 기반 (v48.59 추가, v48.32 onclick 0건 후 잔존 버그) |
| R46 | 2536 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R46. HTML 외 JS 파일까지 sed 치환 범위 확대 (v48.61 추가) |
| R47 | 2537 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R47. CSS 변수 자기순환 참조 금지 (v48.61 추가, surface-1~5 교훈) |
| R48 | 2543 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R48. Canvas 렌더러 전역 변수 참조 시 실제 설정 위치 확인 (v48.61 추가, _pcRatio vs _putCallRatio 교훈) |
| R49 | 2538 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R49. 새 페이지 추가 시 결론 바 의무 (v48.62 추가) |
| R50 | 2539 | retired | 역사 기록 | 퇴역한 fb-estimated 배지의 이력이다. 현재 상태 계약과 합치지 않는다. | R50. fb-estimated 배지 사용 기준 (v48.62 추가) |
| R51 | 2541 | retained-body | 개정 | 12px 권장·10px 하한은 내부 가독성 기준이다. WCAG 적합성은 확대·reflow·대비·콘텐츠 손실을 포함하며 이 수치만으로 인증할 수 없다. | R51. 콘텐츠 카드 본문 폰트 최소 12px (v48.62 추가) |
| R52 | 2390 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R52. 외부 CDN 스크립트 SRI 의무 (v48.69 추가, P140 교훈, 구 R34 → R52 재번호) |
| R53 | 2391 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R53. 독립 병렬 fetch는 단일 실패 격리 (v48.69 추가, P143 교훈, 구 R35 → R53 재번호) |
| R54 | 2557 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R54. `data-aio-archive` 마킹 원칙 (v49.21 추가) |
| R55 | 2558 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R55. 동일 지표 multi-sink 단일화 (v49.24 추가, P216/P218 근본) |
| R56 | 2559 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R56. 임계값·라벨 단일 출처 — THRESHOLD_REGISTRY (v49.24 추가, P219 근본) |
| R57 | 2560 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R57. 정적 테이블 stale 감지 의무 (v49.24 추가, P217 근본) |
| R58 | 2561 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R58. DOM 인라인 vs DATA_SNAPSHOT 3-way 정합 (v49.24 추가, P213 근본) |
| R59 | 2562 | retained-body | 조건부 유지 | 참고 점수의 척도·기준일은 필요하다. 합산/letter 금지는 제품의 위험 통제이며 모든 0~100 수치가 부당하다는 일반 원리는 아니다. | R59. 점수 스케일 단일 정의 — SCORE_SCALES (v49.25 추가, L1 근본) |
| R60 | 2564 | retired | 역사 기록 | ATR 매매 지시 preset 퇴역을 유지한다. 수치 사실과 주문 지시는 구별한다. | R60. 매매 전략 권장값 단일 출처 — ATR_PRESETS (v49.25 추가, L4 근본) |
| R61 | 2566 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R61. 다중 신호 합의 알고리즘 — diagnoseBreadthConsensus (v49.25 추가, L3 근본) |
| R62 | 2567 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R62. 정량 지표 자동 채점 — PIOTROSKI_CHECKLIST (v49.25 추가, L7 근본) |
| R63 | 2568 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R63. 라벨 인라인 사용 자동 audit — getThresholdLabelAudit (v49.25 추가, R56 자동화) |
| R64 | 2569 | retired | 역사 기록 | 퇴역한 가중치 registry는 새 기능의 정본으로 부활시키지 않는다. | R64. 점수 가중치 단일 정의 — WEIGHT_REGISTRY (v49.26 추가, I2 근본) |
| R65 | 2571 | retired | 역사 기록 | 없어진 시각 위계 registry의 이력만 보존한다. | R65. 시각 위계 단일 정의 — CARD_HIERARCHY (v49.26 추가, I3 근본) |
| R66 | 2573 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R66. 중복 콘텐츠 자동 감사 — getDuplicateContentAudit (v49.26 추가, I4 근본) |
| R67 | 2574 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R67. 동적 판정 함수 단일화 — getCycleFromMacro (v49.26 추가, I7 근본) |
| R68 | 2575 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R68. 페이지 placeholder 표준 — 동적 검색 가이드 (v49.26 추가, I5/I6 근본) |
| R69 | 2576 | retained-body | 조건부 유지 | 밴드 경계와 관찰 문구의 중복 방지는 타당하다. ACTION_RULES라는 명칭은 행동 지시로 오인되지 않게 하며 임계값이 미래 성과를 보장하지 않는다. | R69. Action Item 단일 출처 — ACTION_RULES (v49.27 추가, E1/E2 근본) |
| R70 | 2578 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R70. 페이지 목적 단일 정의 — PAGE_PURPOSE_REGISTRY (v49.27 추가, E3/E4 근본) |
| R71 | 2579 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R71. 이론 vs 실행 비율 audit — getPagePurposeRatioAudit (v49.27 추가, E5 근본) |
| R72 | 2580 | retired | 역사 기록 | 보정되지 않은 시나리오 확률 stub의 퇴역은 유지한다. 다른 수치를 확률처럼 읽게 만들지 않는 별도 의미 검토는 필요하다. | R72. 시나리오 확률 시간 의존 — SCENARIO_REGISTRY (v49.27 추가, L6 근본) |
| R73 | 2582 | retained-body | 조건부 유지 | 사용하지 않는 registry를 추가하지 않는 원칙은 유용하다. 보안·이행용 기반 작업까지 같은 릴리스의 가시 위젯 생성을 강제할 이유는 없다. | R73. 인프라 추가 시 페이지 적용 동반 의무 (v49.28 추가, P239 메타 근본) |
| R74 | 2599 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R74. DOM 인라인 폴백 vs DATA_SNAPSHOT 동시 갱신 의무 (v49.30 추가, P252/M1 근본) |
| R75 | 2600 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R75. 정적 콘텐츠 lifecycle 메타 필수 (v49.30 추가, P253/M2 근본) |
| R75 | 2657 | retained-body | 개정 | 현재성 있는 사실과 역사 자료를 구분한다. 오래됐다는 이유만으로 인터뷰·방법론이 만료되는 것은 아니며 카드마다 stale span을 강제하지 않는다. | R75 보강 (v49.48, P316 근본 — Jensen hardcoded → 일반화) |
| R76 | 2601 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R76. 정치/관료 이름 NAMED_ENTITY_REGISTRY 경유 의무 (v49.30 추가, P254/M3 근본) |
| R77 | 2602 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R77. 거시지표 MACRO_CALENDAR 등록 + 자동 stale (v49.30 추가, P254/M4 근본) |
| R78 | 2603 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R78. KR 거시 KR_MACRO_RELEASE 등록 + 발표 캘린더 의무 (v49.30 추가, P255/M5 근본) |
| R79 | 2604 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R79. 지정학 시나리오 단일 출처 — GEOPOLITICAL_CONTEXT_REGISTRY (v49.31 추가, H3 근본) |
| R80 | 2605 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R80. 정적 데이터베이스 메타 의무 — SCREENER_DB_META (v49.31 추가, H1 근본) |
| R81 | 2606 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R81. 정기 발표 데이터 사용자 가시 마커 (v49.31 추가, H4 근본) |
| R82 | 2607 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R82. AI 채팅 가격 fetch 실패 시 Hard Guard 의무 (v49.32 추가, P263 근본) |
| R83 | 2608 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R83. 채팅 응답 post-hoc 가격 검증 의무 (v49.32 추가, P264 근본) |
| R84 | 2609 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R84. System 프롬프트 정량 수치 화이트리스트 (v49.32 추가, P262 근본) |
| R85 | 2610 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R85. 종목명-티커 단일 출처 — TICKER_NAME_REGISTRY (v49.32 추가, P266 근본) |
| R86 | 2611 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R86. 환각 패턴 자동 탐지 + 의심 점수 (v49.32 추가, P264 보강) |
| R87 | 2612 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R87. 종목별 데이터 무결성 통합 검증 (v49.32 확장, 사용자 추가 요청) |
| R88 | 2613 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R88. Fundamental 15 분석 기준 데이터 출처 매핑 (v49.32 확장) |
| R89 | 2614 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R89. AI 채팅 응답 자동 검증 통합 의무 (v49.33 추가, P269 근본) |
| R90 | 2615 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R90. 종목 정성 분석 출처 의무 — ANALYSIS_FRAMEWORK_REGISTRY (v49.34 추가, 사용자 지적) |
| R91 | 2616 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R91. 페이지 표시 분석 기준 registry 등록 + 가용성 가시화 의무 (v49.35 추가, P275 근본) |
| R92 | 2617 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R92. 페이지 표시 분석 기준 100% 커버 의무 (v49.36 추가, P278 근본) |
| R93 | 2618 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R93. 페이지 sequential audit 의무 (v49.37 추가, P282 메타 근본) |
| R94 | 2619 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R94. 페이지 인라인 임계값 표 REGISTRY 정합 의무 (v49.38 추가, P286 근본) |
| R95 | 2620 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R95. 페이지 간 동일 ticker 정합 의무 (v49.39 추가, P290 근본) |
| R96 | 2621 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R96. data-action 핸들러 등록 검증 (v49.39 추가, P291 근본) |
| R97 | 2674 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R97. data-snap 키 vs DATA_SNAPSHOT 시드 정합 (v49.41 추가, P301 근본) |
| R98 | 2622 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R98. JS 함수 내 var X + const/let X 충돌 자동 탐지 (v49.44 추가, P311 근본) |
| R99 | 2673 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R99. SW SHELL_ASSETS 자산 무결성 자동 검증 (v49.44 추가, P310 근본) |
| R100 | 2671 | retired | 역사 기록 | 개인 키 UI 퇴역 이력이다. 실제 제품에서 보관하는 다른 비밀까지 없다고 일반화하지 않는다. | R100. API 키 저장 2중화 + 백업/복원 UX 의무 (v49.45 추가, P312 근본) |
| R101 | 2656 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R101. DOM ticker vs LIVE_SYMBOLS coverage 의무 (v49.48 추가, P317 근본) |
| R102 | 2655 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R102. 페이지 cell-level audit 의무 (v49.48 추가, P318 근본) |
| R103 | 2654 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R103. SCR_KEYWORD_ALIASES 신규 테마 추가 시 AIO_TICKER_NAME_REGISTRY 등록 의무 (v49.57 추가, P316 근본) |
| R104 | 2653 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R104. _fetchTickerDataForChat 신규 fetch 추가 시 ABSOLUTE RULES 동기 확장 의무 (v49.57 추가, P317 근본) |
| R105 | 2652 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R105. 테마 페이지 진입 시 채팅 컨텍스트에 활성 테마 ticker 라이브 가격 주입 의무 (v49.57 추가, P316/P317 근본) |
| R106 | 2651 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R106. 새 페이지 CHAT_CONTEXTS 신규 시 window._currentXxxId 자동 주입 의무 (v49.58 추가, P319 근본) |
| R107 | 2650 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R107. 채팅 fetch는 반드시 Promise.allSettled + 개별 timeout 의무 (v49.58 추가, P321 근본) |
| R108 | 2648 | retained-body | 개정 | 감사 결과를 사용자에게 숨기는 것은 유지한다. 모든 감사 함수의 사이드바 row 생성은 불필요하므로 CLI·운영 이슈 등 적절한 소비처를 허용한다. | R108. Audit 함수 추가 시 사이드바 위젯에도 노출 의무 (v49.58 추가, P322 근본) |
| R109 | 2647 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R109. fxbond 한국 금리 스냅샷 시점 명시 의무 (v49.59 추가, P326 근본) |
| R110 | 2646 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R110. signal/breadth/sentiment context는 라이브 수치 자동 주입 의무 (v49.59 추가, P324 근본) |
| R112 | 2645 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R112. 모든 CHAT_CONTEXTS는 _getChatRules() 호출 의무 (v49.59 추가, P327 근본) |
| R114 | 2644 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R114. 외부 워크트리 통합 시 함수 존재 vs 페이지 실행 검증 분리 의무 (v49.63 추가, P331 근본) |
| R115 | 2643 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R115. 사용자 가시 placeholder 텍스트 표준 의무 (v49.64 추가, P334 근본) |
| R116 | 2642 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R116. 새 분석 관점 추가 시 4축 동시 갱신 의무 (v49.65 추가, P340 근본) |
| R117 | 2641 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R117. dataConfidence:low 분야 환각 차단 알림 의무 (v49.65 추가, P340 근본) |
| R118 | 2640 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R118. REGISTRY coveragePct와 실등록 카운트 분리 감사 의무 (v49.65 추가, P339 근본) |
| R119 | 2638 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R119. 3대 본질 정렬 감사 의무 (v49.65 추가, P346 근본) |
| R120 | 2639 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R120. 초보자 초기 상태 문구는 보이는 DOM 기준으로만 감사 (v49.65 추가, P347 근본) |
| R121 | 2637 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R121. AI 채팅 시스템 정의-호출 정합 의무 (v49.66 추가, P348~P351 근본) |
| R122 | 2636 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R122. AI 채팅 사용자 체감 품질 의무 (v49.67 추가, P352~P356 근본) |
| R123 | 2634 | retained-body | 조건부 유지 | 개발자 감사와 사용자 화면의 분리는 유지한다. 동일 문구가 R108/R177에 반복돼 정본 한 항목으로 통합할 수 있다. | R123. 사이드바 Audit row 의미 분리 표시 의무 (v49.67 추가, P357 근본) |
| R124 | 2676 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R124. DOM-first full surface audit required (v49.67 added, P358 root prevention) |
| R125 | 2675 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R125. Second/third-pass text, function, and data meaning audit required (v49.67 added, P359 root prevention) |
| R126 | 2633 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R126. AI 채팅 기관급 분석 프레임워크 8개 인용 의무 (v49.68 추가, P360 근본) |
| R127 | 2631 | superseded | 역사 기록 | 고정 Bull/Base/Bear 강제의 대체를 보존한다. 질문과 원천이 뒷받침하는 분기만 사용한다. | R127. AI 채팅 Bull/Base/Bear 3 시나리오 분기 강제 (v49.68 추가, P361 근본) |
| R128 | 2630 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R128. AI 채팅 시각 단서 표준 + 데이터 소스 우선순위 + 출처 타임스탬프 (v49.68 추가, P361~P363 근본) |
| R129 | 2629 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R129. AI 채팅 후속 질문 자동 제안 의무 (v49.69 추가, P365 근본) |
| R130 | 2628 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R130. AI 채팅 자동 페이지 이동 + 포트폴리오 동적 시뮬레이션 의무 (v49.69 추가, P366~P367 근본) |
| R131 | 2626 | retained-body | 조건부 유지 | 정확 별명 registry로 다른 issuer로 오매핑하지 않는 것은 타당하다. 미등록 입력은 사용자 확인·검색 후보로 처리하고 추정 가격을 붙이지 않는다. | R131. AI 채팅 거시 시나리오 동적 시뮬레이션 + 약어/별명 fuzzy 매칭 의무 (v49.69 추가, P368~P369 근본) |
| R132 | 2625 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R132. AI 채팅 사용자 투자 프로필 메모리 의무 (v49.70 추가, P371 근본) |
| R133 | 2624 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R133. AI 채팅 알람/임계값 트리거 의무 (v49.70 추가, P372 근본) |
| R134 | 2623 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R134. AI 채팅 데이터 다운로드 + 금액/% 시뮬레이션 의무 (v49.70 추가, P373~P374 근본) |
| R135 | 2195 | retained-body | 유지 | 감사 함수 PASS를 의미 검수로 바꾸지 않는 원칙을 유지한다. 필요한 비교의 깊이는 변경 위험과 실제 주장 범위에 비례시킨다. | R135. 4/5차는 감사 함수만으로 완료 금지 |
| R138 | 2192 | retired | 역사 기록 | 개인 FMP 7차트 강제의 퇴역 이력이다. 새 공용 차트의 숫자를 7개로 맞출 이유는 없다. | R138. fundamental 종목 검색 시 7 차트 자동 렌더 의무 (v49.72) |
| R139 | 2194 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R139. AI 채팅 답변에 종목 detect 시 "📊 차트 보기" 버튼 자동 삽입 의무 (v49.72) |
| R140 | 2188 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R140. AI 답변에서 정성 표현 사용 시 정량 근거 1개 이상 괄호 동반 의무 (v49.73) |
| R141 | 2189 | retained-body | 개정 | 분석 질문에는 결론/근거/조건부 분기/기회비용이 유용하다. 정의·오류 해결·단순 사실 질문까지 4구조를 강제하면 답변을 장황하게 만든다. | R141. AI 답변 표준 4 구조 강제 (결론/정량/시나리오/액션) (v49.73) |
| R142 | 2191 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R142. 모든 정량 인용 시 (출처 · 기준일) 괄호 필수 (v49.73) |
| R143 | 2185 | retained-body | 조건부 유지 | 8화면·한국 영역이 품질 평가에서 누락되지 않는 목표는 타당하다. 모든 수정 때 유료 AI 8회 호출을 강제하는 해석은 피한다. | R143. AI 답변 품질 audit는 11 페이지 평가 의무 (KR 4 페이지 포함) (v49.74) |
| R144 | 2187 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R144. AI 채팅 멀티턴 윈도잉 + 요약 prepend 의무 (v49.74) |
| R145 | 2182 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R145. AI 답변에 학습 데이터 자기 인용 + 시점 환각 절대 금지 (v49.74 hotfix) |
| R146 | 2183 | retired | 역사 기록 | home 별도 채팅 퇴역 이력이다. 단일 패널 결정은 제품 선호이며 법적 요구는 아니다. | R146. home 페이지 인라인 채팅 패널 의무 (v49.74 hotfix) |
| R147 | 2176 | superseded | 역사 기록 | R317 registry 파생 방식으로 대체한 이력을 보존한다. | R147. CHAT_CONTEXTS 등록은 DOM 패널과 항상 쌍 (Pattern A 일반화) (v49.75) |
| R148 | 2178 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R148. ABSOLUTE RULES는 system prompt 정의 + 답변 후처리 양쪽 의무 (Pattern B 일반화) (v49.75) |
| R149 | 2179 | retained-body | 유지 | 데이터 없음/지연 상태와 원인 상세를 보여 주는 원칙은 사용자 혼란과 공포 아이콘 남용을 줄인다. LKG가 있으면 날짜도 보존한다. | R149. 외부 fetch 실패는 사용자 ❌ 라벨로 surfacing 의무 (Pattern C 일반화) (v49.75) |
| R150 | 2181 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R150. AI 답변에 등장한 날짜 토큰은 세션 시각 대비 stale 자동 검출 (Pattern D 일반화) (v49.75) |
| R151 | 2174 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R151. 시세 데이터 ✗ 시 답변에 가격 수치 절대 금지 — HARD STOP (v49.76) |
| R152 | 2175 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R152. 모바일 채팅 레이아웃 100vw 비율 의무 (v49.76) |
| R153 | 2171 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R153. chatSend silent return 모든 경로 사용자 피드백 의무 (v49.77) |
| R154 | 2172 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R154. callClaude 최종 실패 시 friendly 안내 + 자가 진단 가이드 (v49.77) |
| R155 | 2173 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R155. 데이터 ✗ / 환각 검출 시 답변 위 액션 버튼 배너 의무 (v49.77) |
| R156 | 2167 | retained-body | 개정 | Promise.any 병렬 fallback도 항상 최선이 아니다. 비용·quota·권위·캐시·실패율에 따라 순차/제한적 hedge를 선택하고 패배 요청을 취소한다. | R156. 외부 fetch 폴백 chain은 sequential 금지, Promise.race 병렬 의무 (v49.78 코드 단위 진단) |
| R157 | 2169 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R157. innerHTML 호출 전 _aioSafeMD fallback chain 의무 (v49.78) |
| R158 | 2170 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R158. chatSend atomic streaming lock — 입력 검증 통과 직후 즉시 (v49.78) |
| R159 | 2159 | retained-body | 유지 | 선택 종목과 미수신 입력을 각각 가드하는 것은 잘못된 신원/결측 처리 예방에 타당하다. | R159. ticker / options context는 _currentTickerId null + _liveData 미수신 양쪽 가드 의무 (v49.79) |
| R160 | 2161 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R160. kr-macro 정적 데이터 / 시점 토큰 진입부 staleness 경고 의무 (v49.79) |
| R161 | 2162 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R161. localStorage QuotaExceededError 강화 처리 + 사용자 toast 의무 (v49.79) |
| R162 | 2163 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R162. 외부 fetch 결과 schema 검증 + graceful degrade 의무 (v49.79) |
| R163 | 2164 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R163. 멀티탭 localStorage storage 이벤트 리스너 의무 (v49.79) |
| R164 | 2165 | superseded | 역사 기록 | 클라이언트 토큰 추정 대신 공용 서버 비용 장부를 정본으로 삼는 대체 이력이다. | R164. Claude API 호출 토큰 사용량 누적 추적 + 비용 가시화 의무 (v49.79) |
| R165 | 2157 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R165. AIO_TICKER_NAME_REGISTRY 의미적 정확성 + 한글 별명 일관성 의무 (v49.80 Codex) |
| R166 | 2158 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R166. AIO_THEME_SEMANTIC_EXCLUSION_RULES 의미적 misfit 배제 의무 (v49.80 Codex) |
| R167 | 2677 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R167. innerHTML 삽입 시 모든 사용자/외부 변수에 escHtml() 의무 + 정규식 메타문자 이스케이프 (v49.81 added, P433~P435 root prevention) |
| R168 | 2678 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R168. vendor-prefix CSS 속성은 표준 속성과 동시 선언 + inline hover: 금지 (v49.81 added, P436~P437 root prevention) |
| R169 | 2679 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R169. 동일 함수 내 var/const/let 이름 충돌 금지 + 신규 코드 let/const 우선 (v49.81 added, P438 root prevention, P311 패턴 재발 방지) |
| R170 | 2680 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R170. 외부 작업본 통합 시 KR/외국 ticker 매핑 다중 위치 cross-check 의무 (v49.82 added, P439~P441 root prevention) |
| R172 | 2683 | retained-body | 개정 | 날짜가 지났다는 사실은 발표 결과 수신을 뜻하지 않는다. 공식 시간·예정/수신대기/수신완료 상태로 다음 일정을 고르며 sidebar 감사 의무는 제거 후보이다. | R172 — MACRO_CALENDAR auto-advance 의무: 발표 캘린더 entry는 일자 경과 시 자동 next event compute. `AIO._aioRecomputeMacroCalendar({ dryRun: true })` 사이드바 18축 노출 의무. |
| R173 | 2685 | retained-body | 폐기 | 전 서비스의 의무 기능으로서 30일 Pearson/regime matrix는 정당화되지 않는다. 실제 질문·정렬된 자료·표본 진단이 필요한 경우 선택 기능으로 재제안한다. | R173 — cross-asset correlation matrix 의무: 자산 간 30일 rolling Pearson correlation + regime classification 자동 산출. `AIO.computeCrossAssetCorrelation()` `_priceHistory` 활용. 사이드바 16축. |
| R174 | 2687 | retained-body | 개정 | 숫자 토큰 비율 폐지는 타당하다. typed claim/evidence coverage 또한 사실 정확성/함의 타당성을 보장하지 않으므로 독립 정답·반례 평가와 구별한다. | R174 — AI 답변 정량 비율 측정 의무: Answer quality is measured by typed claim/evidence coverage (R456), not by numeric-token ratio. (v57.79 rewrite) 이력: 채팅 답변에서 정량 토큰 비율 7%+ 권장. `AIO.assertQuantitativeRatioAudit()` 자동 측정 + 사이드바 17축. <4% 시 'fail' (정성 과다 환각 위험). |
| R175 | 2689 | retired | 역사 기록 | 개인 FMP transcript 강제 퇴역 이력을 보존한다. | R175 — earnings call transcript 통합 의무: Retired (v57.79): earnings-call transcripts came from personal FMP keys, removed in v57.76. 이력: 종목 분석 시 FMP /earning_call_transcript 자동 fetch + 시스템 프롬프트 [Earnings Call (Qx YYYY)] 라벨 주입. AlphaSense/Sentieo 대체 무료 옵션. |
| R176 | 2691 | retained-body | 개정 | 종목이 언급됐다는 이유로 30일 sparkline 3개를 강제하지 않는다. 가격 추세가 질문 이해에 도움되고 같은 기준 자료가 있을 때만 시각을 붙인다. | R176 — AI 답변 시각 자료 의무: 답변 종목 detect 시 30일 mini sparkline SVG 자동 인라인 삽입. `_aioBuildSparklineSvg` 활용. 양수 green / 음수 red. 최대 3 종목. |
| R177 | 2693 | retained-body | 조건부 유지 | 개발자 감사와 사용자 UX 분리는 유지한다. 같은 문구의 R108/R123과 통합한다. | R177 — 사이드바 audit 일반/개발자 mode 토글 의무: Audit rows render only in developer/QA mode (`body.aio-dev-mode`, `?aioAudit=1` or detailed mode); user surfaces show none and have no web_search toggle. (v57.79 rewrite) 이력: 18+ audit row metric은 일반 사용자에게 부담. `localStorage.aio_audit_mode = 'simple' \| 'detailed'` 토글 의무. |
| R178 | 2695 | retained-body | 개정 | 실패 우선순위는 유지할 수 있지만 모든 감사 row·2초 pulse·sidebar 3종 세트는 불필요하다. 심각도·조치 가능성·reduced-motion을 기준으로 한다. | R178 — audit failure status sticky top + pulse 의무: Audit rows, including failure ordering, render only in developer/QA mode; user surfaces show none. (v57.79 rewrite) 이력: ✗ failure rows는 자동 top sort + 빨간 border + 2s pulse animation. ⚠ warn = amber. 위기 시그널 즉각 가시. |
| R179 | 2701 | retired | 역사 기록 | 클라이언트 생산/서버 cron 금지의 퇴역 이력이다. 현재 생산 단일화와 충돌하는 구지침으로 실행하지 않는다. | R179. 클라이언트 접속 시 자동운영 모델 — 부팅 로더 명시 + 서버 cron 금지 (v49.88 added, P447 root) |
| R180 | 2703 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R180. 데이터 lineage 5단계 연결 의무 + 자동 audit (v49.89 added, P450 root) |
| R181 | 2704 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R181. 데이터 검증은 카테고리 + cell-level(개별 sink→source) 둘 다 (v49.90 added, P451 root) |
| R182 | 2705 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R182. cell-level은 연결 + 값 정확성 둘 다 / 텍스트 수치는 동적 참조 (v49.91 added, P452 root) |
| R183 | 2706 | retained-body | 조건부 유지 | 검색 수치의 자동 모델 입력 금지는 출처 오류에 대한 합리적 내부 방어다. 텍스트 인용 역시 출처/날짜/단위를 별도로 검증해야 안전하다. | R183. WebSearch 수치는 지표별 정상 band 검증 후 수용 (v49.92 added, P453 root) |
| R184 | 2708 | superseded | 역사 기록 | R289 동기화 계약으로 대체한 이력이다. 미러 자체의 필요성을 별도로 재검토할 수 있다. | R184. 동일 지표가 2개 저장소(DATA_SNAPSHOT 본체 + _fallback 미러)에 존재 시 정합 의무 (v49.96 added, P459 root) |
| R185 | 2710 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R185. 재발방지 audit은 pull이 아닌 push — 지속 운영 중 자동 surfacing 의무 (v49.96 added, P461 root) |
| R186 | 2711 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R186. 첫 접속/새로고침 시 진행률 로더 + 정적 콘텐츠 만료 시 동적 폴스루 의무 (v49.97 added, P462 root) |
| R187 | 2713 | retained-body | 개정 | 최신 게시 artifact 확인은 유지한다. 모든 진입에 무조건 reload하지 말고 게시 revision·ETag·발행 주기와 공유 cache를 사용한다. | R187. 매매 핵심 페이지(종합 5)는 진입 시 stale하면 즉시 재fetch 의무 (v49.98 added, P463 root) |
| R188 | 2715 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R188. 전체 데이터 최신화 진행률은 중앙 refresh state를 단일 진실 원천으로 표시한다 (v49.101 added, P464 root) |
| R189 | 2716 | retained-body | 개정 | R187과 사실상 동일한 문구이므로 단일 현재성 정책으로 통합하고 페이지별 data dependency를 명시한다. | R189. 5개 종합 페이지 개별 데이터는 page profile 심볼/태스크 union으로 최신화한다 (v49.102 added, P465 root) |
| R190 | 2718 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R190. 보이는 차트/지표/시세/수치/수식/텍스트 표면은 최신화 감사에 자동 편입한다 (v49.103 added, P466 root) |
| R191 | 2719 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R191. AI 채팅의 종목 답변은 strict preflight 후 최신 시세/기업 데이터 블록만 인용한다 (v49.104 added, P467 root) |
| R192 | 2720 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R192. `forceFresh` for AI stock answers must bypass every local freshness shortcut (v49.105 added, P468 root) |
| R193 | 2721 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R193. AI chat must vary answer structure by intent and use only injected current data for current claims (v49.106 added, P469 root) |
| R194 | 2722 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R194. Critical-10 refresh success must be followed by DOM binding verification (v49.107 added, P470 root) |
| R195 | 2723 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R195. Trading-use market data must pass DataTruthGate before decision use (v49.108 added, P471 root) |
| R196 | 2724 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R196. Trading-use quotes require independent cross-source validation when available (v49.109 added, P472 root) |
| R197 | 2725 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R197. Critical-10 freshness must audit visible market surface, not only refresh schedules (v49.110 added, P473 root) |
| R198 | 2726 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R198. Critical-10 page content must be compared with current market reference/regime before being trusted (v49.111 added, P474 root) |
| R199 | 2727 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R199. Critical-10 content checks must use a full evidence matrix, not representative samples (v49.112 added, P475 root) |
| R200 | 2712 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R200. v50 페이지 계약/데이터 증거/AI 답변/배포 게이트 4원칙 (v50.0 added, P476 root) |
| R201 | 2728 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R201. Trading decision logic must pass current evidence gate (v50.1 added, P477 root) |
| R202 | 2729 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R202. Runtime version uses one or two decimal digits only (v50.1 added) |
| R203 | 2730 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R203. News surfaces must use the shared evidence-style surface contract (v50.2 added, P478 root) |
| R204 | 2731 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R204. User-facing market text must pass the text surface contract (v50.3 added, P479 root) |
| R205 | 2732 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R205. Static market calendars must separate official releases from source-dependent topics (v50.4 added, P480 root) |
| R206 | 2733 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R206. 사용자 가시 텍스트에 개발자/버전 마커 금지 (v50.14 added, v50.13 UX audit root) |
| R207 | 2734 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R207. 접근성 WCAG AA 유지 — 접근 이름·최소 폰트·tap target (v50.14 added) |
| R208 | 2735 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R208. 분석 UI 상태·수량·정밀 주장·향후 일정은 증거 원천에서 파생 (v50.55 added, P500 root) |
| R209 | 2736 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R209. 계약 수·시간대·복합 가격 카드는 단일 진실 원천에서 파생 (v50.56 added, P501 root) |
| R210 | 2737 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R210. 런타임 scope·sink 소유권·증거 게이트 의미를 함께 검증 (v50.56 added, P502 root) |
| R211 | 2738 | retained-body | 조건부 유지 | 다양한 연구 후보와 근거·한계는 유용하다. 추천이 아니라는 이름만으로 실제 순위·선택 편향이 사라지지 않으므로 표현과 행태를 함께 평가한다. | R211. 넓은 AI 종목 추천은 분산 후보군을 먼저 만들고 반복 앵커를 감점 (v50.57 added, P503 root) |
| R212 | 2740 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R212. AI 채팅 정확성 가드는 사용자 의도별로 적용하고 답변력을 억제하지 않는다 (v50.58 added, P504 root) |
| R213 | 2741 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R213. AI 채팅 데이터 기능은 자연어 라우팅과 출처 레지스트리까지 연결해야 한다 (v50.59 added, P505 root) |
| R214 | 2742 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R214. AI 채팅은 AIO 전용 통합 답변 계약까지 주입해야 한다 (v50.60 added, P506 root) |
| R215 | 2743 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R215. Telegram/외부 정성 소스는 digest -> 화면 -> 스크리너 -> 채팅 -> 테스트까지 환류해야 한다 (v50.61 added, P507 root) |
| R216 | 2744 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R216. Data/news refresh must separate collection freshness from consumption coverage (v50.62 added, P508 root) |
| R217 | 2745 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R217. Scheduled data sources must close the collect -> artifact -> consume -> audit loop (v50.63 added, P509 root) |
| R218 | 2746 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R218. Runtime contract / share readiness gate is mandatory (v50.79) |
| R219 | 2747 | retained-body | 개정 | 의미 경로 검토 원칙은 유지한다. semantic gate가 감사 개수·shape-only 검사 수·영구 미인증을 강제하는 부분은 제거하고 실제 반례와 범위 증거를 검증한다. | R219. Audit/gate is not semantic review (v50.89, P513 root) |
| R220 | 2767 | retained-body | 조건부 유지 | 추가 전 삭제·통합과 얇은 entrypoint는 유지한다. 300줄/15KB·매문서변경 gate는 신호이지 의미 품질의 충분조건이 아니다. | R220. Workflow memory must be compacted before it is extended (v50.89, P514 root) |
| R221 | 2156 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R221. Telegram/news auto-refresh must close the ticker memo consumer path (v50.93) |
| R222 | 2149 | retained-body | 개정 | 수집→산출물→소비 경로 검증은 유지한다. 심볼70/뉴스10/Telegram100·2채널은 최소 경보 휴리스틱이며 자료 정확성/최신성/권리의 대리 인증이 아니다. | R222. Public-data pipelines require an Actions-to-consumer contract gate (v50.94) |
| R223 | 2148 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R223. News translation must degrade to Korean insight, not raw English-only context (v50.95) |
| R224 | 2147 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R224. Currentness and fallback data must be visible at the consumer surface (v50.96) |
| R225 | 2146 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R225. News surfaces must provide Korean market rewrite, not translation-only headlines (v50.97) |
| R226 | 2127 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R226. Server news backstop must rank by market impact, not arrival order (v50.98) |
| R227 | 2766 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R227. Recommendation verification must exercise the no-ticker screener path (v51.30, P526 root) |
| R228 | 2128 | retained-body | 개정 | 기본 경로의 정보 우선순위·실제 화면 검토는 유지한다. 호환 hidden sink 영구 유지와 고정 operator-note 최우선은 R705·현재 IA와 충돌할 수 있다. | R228. Default-route UX must remove collapsed noise and avoid empty grid tracks (v51.30, P529) |
| R229 | 2139 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R229. Scheduled workflow embedded scripts must be syntax-gated (v51.30, P530) |
| R230 | 2140 | retained-body | 개정 | 동일 ID가 숫자 렌더링과 뉴스 주기의 두 주제를 가리킨다. 숫자는 null을 먼저 구분해야 하며 뉴스 08시 고정 주기는 속보와 종가 읽기의 역할을 나눈다. | R230. Default-path numeric renderers must be partial-data safe (v51.42, P533) |
| R230 | 2781 | retained-body | 개정 | 동일 ID가 숫자 렌더링과 뉴스 주기의 두 주제를 가리킨다. 숫자는 null을 먼저 구분해야 하며 뉴스 08시 고정 주기는 속보와 종가 읽기의 역할을 나눈다. | R230. Dynamic news refresh must prove source quality and visible freshness (v51.30, P531 root) |
| R231 | 2119 | retained-body | 조건부 유지 | 가독성과 실제 화면의 위계는 유지한다. 특정 색·글자간격 금지는 제품 선택이고 DOM marker만으로 시각 이해를 인증하지 않는다. | R231. Visual hierarchy must not be locked to the old Bloomberg-terminal premise (v51.43, P534) |
| R232 | 2111 | retained-body | 유지 | 다른 단위의 원시 가격을 직접 횡단 순위화하지 않는 것과 backtest 한계 표시는 타당하다. 정규화만으로 예측력·통화/기간 정합이 입증되지는 않는다. | R232. Cross-asset trading factors must use comparable scales (v51.44, P535) |
| R233 | 2110 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R233. Ticker technical analysis must prioritize Minervini price/MA/volume/supply logic (v51.45, P536) |
| R234 | 2109 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R234. 신규 UI 블록은 검증 전까지 기본값 hidden (v51.64, P545 예방) |
| R235 | 2108 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R235. calcTechnicalSnapshot fields must close producer-consumer-artifact-gate together (v51.71, P548) |
| R236 | 2107 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R236. Skills, command wrappers, references, encoding sentinels, and any materialized local mirror must be contract-gated (v53.96, P894) |
| R237 | 2106 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R237. Skills must use one canonical router-plus-reference tree; assistant-specific roots are generated mirrors, never independent instructions (v53.96, P894) |
| R238 | 2105 | header-only | 본문 미확인 | 제목은 읽었으나 해당 R의 보존된 본문이 없다. 제목만으로 정당성·적용 범위·현재 구현을 승인하지 않았다. | R238. Page currentness must be source-capped before visible decisions (v51.74, P549) |
| R239 | 2103 | superseded | 역사 기록 | 공유 readiness의 개발자/CI 분리로 대체된 이력이다. 공개 홈의 개발자 감사판을 부활시키지 않는다. | R239. External-share readiness must be visible on the default home path (v51.76, P551) |
| R240 | 2102 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R240. User-supplied trader frameworks must be centralized as REFERENCE, not live levels (v51.77) |
| R241 | 2101 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R241. Public readiness must expose page-level source/asOf, not only aggregate status (v51.78) |
| R242 | 2100 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R242. Portfolio backtests must expose assumptions, monthly construction, drawdown recovery, and active risk (v51.79) |
| R243 | 2099 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R243. Portfolio UX must close input -> AI analysis -> journal reflection -> learning loop (v51.80) |
| R244 | 2098 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R244. A live-state value shown in multiple UI surfaces must not be computed independently per surface (v51.82) |
| R245 | 2090 | 현행 본문 검토 | 개정 | 선정된 기사까지 번역 품질을 보장하되 추가 AI 호출을 의무화하지 말고 예산·권리·실패 상태를 함께 제한한다. | R245. Prioritized/boosted content selection must guarantee its picks already ran through required enrichment (v51.82) |
| R246 | 2089 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R246. Version-bump commits must land atomically; never leave main in a partially-synced state (v51.82) |
| R247 | 2088 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R247. CDN/script load-failure detection must not race against `defer` (v51.82) |
| R248 | 2080 | 현행 본문 검토 | 조건부 유지 | 검증 산출물에 배포를 결속하되 모든 보고용 검사를 무조건 blocking으로 승격하지 말고 위험·비용을 평가한다. | R248. Deployment must be wired to the CI gate, not merely run alongside it (v51.82) |
| R249 | 2079 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R249. Externally-sourced text must be escaped at the pipeline entry point, not at each render call site (v51.83) |
| R250 | 2078 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R250. A shared cross-page renderer must resolve each page's own parameters, not one hardcoded default (v51.83) |
| R251 | 2077 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R251. XBRL/multi-source financial data must resolve to the freshest tag and validated period, and refresh handlers must have a real data source (v51.83) |
| R252 | 2076 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R252. A static/curated list overlaid with live per-item data must flag contradictions, not silently keep them (v51.83) |
| R253 | 2075 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R253. Multiple DOM bindings for the same metric must share one resolver, not independently-ordered fallback chains (v51.83) |
| R254 | 2074 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R254. External classification tags are not ground truth without independent keyword support, and AI prompts must verify tag-content consistency (v51.83) |
| R255 | 2073 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R255. Automated workflows pushing to a shared branch must rebase/retry on rejection, never push-once-and-drop (v51.83) |
| R256 | 2072 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R256. Every external data source in the fetch pipeline must track per-unit failures, not just an aggregate ok flag (v51.83) |
| R257 | 2071 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R257. Persisted-and-later-rendered free text needs both input-boundary validation and escaped render (v51.83) |
| R258 | 2070 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R258. A hardening measure added to one surface must be checked against equivalent surfaces (v51.83) |
| R259 | 2068 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R259. Re-registerable event listeners must guard against duplicate registration consistently across sibling elements (v51.83) |
| R260 | 2069 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R260. A function must never be redefined more than once at the same scope in the same file (v51.83) |
| R261 | 2061 | 현행 본문 검토 | 조건부 유지 | 같은 지표의 표시 일치는 타당하다. 수동 sink 목록 대신 현재 DOM·소유권 계약으로 누락을 검출한다. | R261. A "single responsibility" canonical updater must include every DOM sink for its metric (v51.83) |
| R262 | 2054 | 현행 본문 검토 | 개정 | cursor와 재시도 제한은 효율 원칙이다. 공개 mirror 접근·저장·AI 사용 권한의 증거로 취급하지 않는다. | R262. Scheduled scrapers/fetchers hitting external feeds must self-throttle with a persisted cursor, not stateless full re-scans (v51.83) |
| R263 | 2053 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R263. Every producer of deployable artifacts must actually trigger the deploy path, and the watchdog must verify the DEPLOYED surface, not just the repo (v51.84) |
| R264 | 2052 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R264. An API key in a URL must never be routed through a third-party proxy; a "sensitive URL" guard must block the egress, not just caching (v51.85) |
| R265 | 2051 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R265. Code that claims parity with a named external tool/methodology must match that source's exact definition, verified by recomputation (v51.86) |
| R266 | 2050 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R266. When a measured value and a proxy heuristic coexist, consumers must prefer the measurement — and fetchers must store measurements consumably (v51.88) |
| R267 | 2049 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R267. "Current"-labeled rolling aggregations must anchor windows to the newest observation (v51.88) |
| R268 | 2048 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R268. Combining sub-signals of different natural scale into one factor requires normalizing each first (v51.89) |
| R269 | 2047 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R269. A CI job that whitelists known-failing tests must classify each entry by cause, and adding to the whitelist is only valid right after a fresh, real measurement (v51.91) |
| R270 | 2046 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R270. A third-party data source's availability and symbol convention must be live-verified, never assumed from a report or general knowledge — and an integration must be scoped down to only the asset classes actually confirmed (v51.92) |
| R271 | 2044 | 현행 본문 검토 | 유지 | 기준 레지스트리 변경의 check와 producer write를 구분하는 현행 문구는 로컬 제약과 일치한다. | R271. After editing `SCREENER_DB` (js/aio-data.js), always re-run `scripts/sync-screener-universe.mjs` before committing (v51.94) |
| R272 | 2043 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R272. A bot/Action-authored push using the default `GITHUB_TOKEN` never triggers other `on: push` workflows — chain via `workflow_run` instead, not `[skip ci]` removal alone (v51.95) |
| R273 | 2042 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R273. A value that's supposed to mirror or track another value must be verified equal by evaluating both, not by eyeballing the diff — and duplicate/mirror fields must be named to be found (v51.96) |
| R274 | 2041 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R274. A live-fetch binding introduced for an existing labeled/thresholded field must fetch the exact same named indicator the label represents — not a same-topic substitute (v51.97) |
| R275 | 2040 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R275. A shared global object populated by multiple files must always be merged, never plainly overwritten — even if today's load order happens to make it safe (v51.99) |
| R276 | 2027 | 현행 본문 검토 | 개정 | 레거시 marketState에 모든 새 파생식을 추가하라는 의무를 폐지하고 현재 domain selector·종가 판정 owner로 연결한다. | R276. New code needing current market/risk/regime/breadth/cycle condition must consume `window.AIO.marketState`, not re-derive it independently (v52.3) |
| R277 | 2026 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R277. An external deploy/publish action known to fail transiently must retry once in the same job, not rely on the next scheduled cycle to self-heal (v52.4) |
| R278 | 2017 | 대체됨 | 역사 기록 | 대체 표시와 보존 본문을 읽었다. 이 과거 처방은 현행 승인 대상이 아니며 명시된 후속 규칙과 분리한다. | R278. A `workflow_run`-triggered job that needs the commit its trigger produced must checkout `head_branch`, not `head_sha` (v52.5) |
| R279 | 2008 | 현행 본문 검토 | 유지 | 변동 관측값 대신 불변조건을 검사한다. 단 고정 golden fixture 자체의 정확값 검증은 정당한 별도 사례다. | R279. A regression test must assert the structural property a value is supposed to satisfy, not the specific value/date/count observed when the test was written — that literal will itself go stale (v52.7, broadened v52.20) |
| R280 | 1999 | 현행 본문 검토 | 조건부 유지 | classic script의 전역 중복은 금지하되 ESM·지역 scope의 합법적 동명 함수까지 금지하지 않는다. | R280. A global function declared in more than one non-module `<script>` (inline or external) silently loses all but the last-loaded definition — with no error, no warning (v52.8, mechanically gated v52.19) |
| R281 | 2794 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R281. Live/browser QA must cover rendered route surfaces, not only prior static findings (v52.23, P633 root) |
| R282 | 2795 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R282. Assertive market-verdict/interpretation text must gate on live-sourced inputs — fallback/snapshot/blocked data may show numbers, but must not assert a directional or confidence-implying verdict (v52.24, P634/P635 root) |
| R283 | 2796 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R283. Interactive detail surfaces must be canonical, all registry entries must render, and same-screen metrics must share the same source (v52.27, P642 root) |
| R284 | 2797 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R284. Proxy responses, visible value slots, and browser QA matrices must be typed and executable (v52.28, P643 root) |
| R285 | 2798 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R285. Operational health labels and feed quality gates must distinguish sources and use accumulated evidence (v52.29, P644 root) |
| R286 | 2799 | 대체됨 | 역사 기록 | 대체 표시와 보존 본문을 읽었다. 이 과거 처방은 현행 승인 대상이 아니며 명시된 후속 규칙과 분리한다. | R286. AI chat key gates must test the effective Claude route, not only the personal-key field (v52.30, P645 root) |
| R287 | 2801 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R287. Market breadth color, label, and gauge bars must share the canonical breadth regime (v52.31, P646 root) |
| R288 | 2802 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R288. Route x viewport audits must include topbar clipping and SVG text geometry, not only page overflow (v52.32, P647 root) |
| R289 | 2803 | 제목만 보존 | 본문 미확인 | 현재 파일에는 제목만 있으며 과거 Git 전문을 열람하지 않았다. 제목 확인을 의미 검수 통과나 현행 재승인으로 계산하지 않는다. | R289. Live quote bridges must keep DATA_SNAPSHOT and `_fallback` mirrors synchronized (v52.33, P648 root) |
| R290 | 2804 | 현행 본문 검토 | 조건부 유지 | 배포 후 변화를 별도 관측하는 원칙은 타당하다. 일정·항목은 장애 탐지 효용과 외부 요청 비용으로 정한다. | R290. Live-deployed invariants must be re-verified on a schedule independent of new commits (v52.38, P653 root) |
| R291 | 2817 | 대체됨 | 역사 기록 | 대체 표시와 보존 본문을 읽었다. 이 과거 처방은 현행 승인 대상이 아니며 명시된 후속 규칙과 분리한다. | R291. Static page-education content must state invariant mechanisms only, never a current level/date/verdict, and must inherit the existing declutter/accessibility gates (v52.39, P654 root) |
| R292 | 2833 | 현행 본문 검토 | 폐기 | 지역 차단을 routing luck으로 재시도하는 처방은 공급자 지역 정책 준수의 대안이 아니다. 허용 경로를 확정한다. | R292. A client-side call routed through a region-unpinned shared edge proxy must auto-retry on the provider's own regional-block error signature, not just report it (v52.44, B8/P659 root) |
| R293 | 2890 | 현행 본문 검토 | 유지 | 실행 파일 손상 차단과 기존 문서 손상 래칫을 구분하는 예방책은 범위·비용에 비례한다. | R293. Every workflow YAML must be hard-gated for control-character corruption and parseability; other bot-written text gets a baseline-tracked regression gate (v52.45, WO-0/P660 root) |
| R294 | 2847 | 현행 본문 검토 | 유지 | 암호화 주장과 실제 접근 gate를 각각 행동으로 증명해야 한다는 원칙은 유지한다. | R294. A security/encryption UI claim and a lock gate are two separate things to verify — a settings screen existing is not proof its protection is wired into the actual read path (v52.46, WO-1A/P661 root) |
| R295 | 2861 | 현행 본문 검토 | 개정 | 경로마다 비용·크기·quota 경계를 적용하되 Origin 검사를 인증으로 취급하지 않는다. 현행 위협모형과 결속한다. | R295. A special-purpose route added to a shared edge proxy must pass through the same defenses as every other route on that proxy — a new route is a new perimeter, not an exception to the old one (v52.47, WO-1B/P662 root) |
| R296 | 2875 | 현행 본문 검토 | 유지 | 상대 경로·세션 소유 변경·무승인 자동 commit 금지는 공동 작업과 기존 dirty 보호에 부합한다. | R296. A session-scoped automation hook must not hardcode an absolute environment fact, and must scope its side effects to what changed during its own session, not whatever it finds lying around (v52.47, WO-5/P663 root) |
| R297 | 1990 | 현행 본문 검토 | 개정 | 입력 registry 완전성은 유지하되 고정 count 단언만으로 새 입력 누락을 잡는다는 주장은 틀리다. 실제 의존을 대조한다. | R297. A score's evidence/provenance registry must list every input the score function actually reads — not just the subset registered when the registry was first built (v52.49) |
| R298 | 1979 | 현행 본문 검토 | 개정 | 예측 주장에는 체제별 검증을 요구하되 관측형 경제 기준까지 미래 수익률 예측력으로 정당화하게 강제하지 않는다. | R298. A hand-tuned score using fixed absolute-level thresholds on a macro indicator must be re-validated against realized outcomes across a regime-shifting window before trusting its sign, not just its shape (v52.49) |
| R299 | 1970 | 현행 본문 검토 | 조건부 유지 | 표본·정의 차이를 밝히는 원칙은 유지한다. 문헌·통계 재계산은 해당 모델 변경 때 위험에 맞춰 수행한다. | R299. A factor backtest's universe composition and lookback window can flip the sign of a well-known factor — don't compare against academic-literature factor performance without matching sample characteristics (v52.51) |
| R300 | 1963 | 현행 본문 검토 | 유지 | 시험 환경이 만든 예상 실패와 실제 회귀를 원인별로 분리하며 broad ignore를 피한다. | R300. When turning on new error/warning signal collection inside a test harness that deliberately blocks network access, expect the app's own legitimate failure-detection code to surface through that same channel — trace it to source before allowlisting or failing on it (v52.52) |
| R301 | 1957 | 현행 본문 검토 | 개정 | 일반 부팅에서 전수 감사는 제외하되 2초·3초·2.5초 고정값은 사용자 행동과 장치별 측정에 근거한 성능예산으로 관리한다. | R301. 일반 사용자 부팅 경로에서는 배포·공유·전수 Evidence 감사를 실행하지 않는다 (v52.74) |
| R301 | 2904 | 현행 본문 검토 | 유지 | 관측·시각·용도 selector를 공유하고 stale snapshot을 현재 판정으로 몰래 올리지 않는 원칙은 타당하다. | R301. A current market metric must have one canonical selector and an explicit provenance state; a snapshot may render as reference but must never silently drive a decision (v52.55, H3-A/P671 root) |
| R302 | 2912 | 현행 본문 검토 | 개정 | 만료는 단일 age가 아니라 사건·출처 발행 주기로 정한다. 종가·역사 설명과 개인 행동 허가를 분리한다. | R302. Historical event context must expire before it can influence a current action; derived regimes need a missing-input quorum gate (v52.55, H3-B/C/P672 root) |
| R303 | 2920 | 현행 본문 검토 | 유지 | 표·캔버스의 읽기 가능성과 외부 실패의 명시적 종료 상태는 기능적 요구이며 유지한다. | R303. PC geometry and external-source failures must be explicit, bounded, and user-visible (v52.56, H3-D/E/P673 root) |
| R304 | 2928 | 현행 본문 검토 | 유지 | 외부 CDN 손실이 로컬 기본 기능 전체를 막지 않게 하는 progressive enhancement는 현재 배포에 적합하다. | R304. Third-party libraries are progressive enhancements and must never block the local route boot queue (v52.57, H3-F/P674 root) |
| R305 | 2936 | 현행 본문 검토 | 조건부 유지 | truthy library symbol만 믿지 않는 방어는 유효하다. 이미 퇴역한 initializer를 영구 보존할 이유는 없다. | R305. Partial third-party chart stubs must be treated as unavailable before registry access (v52.58, P675 root) |
| R306 | 2942 | 현행 본문 검토 | 개정 | 자료의 상태와 권리를 직교 필드로 보존하되 action-strength·cautious-only는 현재 관측 중심 정책으로 대체한다. | R306. Typed provenance must separate evidence state from action strength (v52.59, P676 root) |
| R307 | 2948 | 현행 본문 검토 | 개정 | 10px 최소 글자와 단일 viewport 행렬은 WCAG 적합성 기준이 아니다. 대비·200% 확대·reflow·실제 작업을 포함한다. | R307. Full-route accessibility is a blocking local gate; assistive technology remains separate (v52.59, P676 root) |
| R308 | 2956 | 현행 본문 검토 | 유지 | 참고 snapshot과 현재 공급자의 시각을 억지로 같게 만들지 않는 원칙은 유지한다. | R308. Fallback/reference freshness must not be forced into live parity (v52.60, P677 root) |
| R309 | 2962 | 현행 본문 검토 | 유지 | 전역 문자열 교체가 제어 문법까지 바꾸지 않도록 변경 범위와 실행 반례를 확인한다. | R309. Bulk text-replacement scripts must not run blindly across JS string literals — check for characters doing double duty as logic markers before a global find-replace (v52.62, P678 root) |
| R310 | 1950 | 현행 본문 검토 | 개정 | 교육·베타 표시는 법적 면책이나 의미 검증이 아니다. 설명형 선택지와 개인 지시를 구분하고 실제 허용 범위를 밝힌다. | R310. 공개 AI는 렌더 경계까지 베타·교육/리서치 보조 정책을 강제하고, 검증되지 않은 자동 문장을 공개하지 않는다 (v52.75, P690) |
| R311 | 1944 | 현행 본문 검토 | 조건부 유지 | 공통 pipeline·요청 이력은 유효하나 번역·대화·자동 해설 각각 필요한 계약을 최소 형태로 적용한다. | R311. 공개 AI의 모든 진입점은 동일 요청 envelope·응답 pipeline·validator/block-policy 버전을 기록하고 retry는 같은 completion contract를 재사용한다 (v52.76, P691) |
| R312 | 1936 | 현행 본문 검토 | 개정 | 수치 tuple 일치는 유지한다. 모든 주장에 정확히 하나의 evidence ID만 강제하면 여러 자료를 결합한 파생 주장에 부적합하다. | R312. Structured current-sensitive AI claims must preserve typed Evidence identity and fail closed on mismatch (v52.77, P692) |
| R313 | 1814 | 현행 본문 검토 | 개정 | 의도별 검색과 예산 제한은 유지하되 한국어에서 chars/4 추정 ±10%와 고정 2K~6K를 보증하지 말고 실제 token·품질을 측정한다. | R313. AI reference retrieval must be intent-aware, top-k bounded, source-separated, and deterministically compacted (v52.78, P693) |
| R314 | 1822 | 현행 본문 검토 | 조건부 유지 | 외부 텍스트 비신뢰·포트폴리오 최소 전송은 유지한다. 세션 동의는 법적 근거·국외이전 검토의 대체물이 아니다. | R314. External AI inputs must be explicitly untrusted and portfolio data must be allowlisted (v52.79, P694) |
| R315 | 1830 | 대체됨 | 역사 기록 | 대체 표시와 보존 본문을 읽었다. 이 과거 처방은 현행 승인 대상이 아니며 명시된 후속 규칙과 분리한다. | R315. Personalized financial action permission must be evaluated once at the shared response boundary (v52.79, P694) |
| R316 | 1840 | 현행 본문 검토 | 유지 | 자동 해설·번역도 공개 산출물로 검증하고 원문과 fallback의 상태를 구분한다. | R316. Automated content must pass a publish audit and retain a deterministic fallback/source label (v52.80, P695) |
| R317 | 1848 | 현행 본문 검토 | 개정 | 라우트별 필요한 근거는 선언하되 모든 route의 beginner/expert 답변 양식을 강제하지 않고 실제 질문·사용자 요구에 맞춘다. | R317. AI page context contracts must be projected from the existing page registry (v52.80, P695) |
| R318 | 1920 | 현행 본문 검토 | 조건부 유지 | 비용·지연·정확성 회귀 증거는 필요하다. 고정 벤치마크 점수를 실제 사용 품질로 인증하지 않는다. | R318. AI operations and release claims require measured SLO, deterministic benchmark, and manifest-linked feedback (v52.81, P696) |
| R319 | 1928 | 현행 본문 검토 | 유지 | 현재 요청의 소유권과 금융 계산의 결정성·검증 근거를 분리해 보존한다. | R319. Conversation state and finance arithmetic must be deterministic, scoped, and auditable (v52.82, P697) |
| R320 | 1904 | 현행 본문 검토 | 조건부 유지 | 독성·철회 문서는 격리한다. 날짜가 지난 문서를 역사 질문에서도 배제하거나 단순 인코딩을 악성으로 단정하지 않는다. | R320. Retrieval documents require lifecycle metadata and poisoning quarantine before AI use (v52.83, P698) |
| R321 | 1912 | 현행 본문 검토 | 개정 | 법률·세무 단어의 일괄 차단은 피하되 자격이 필요한 맞춤 자문은 관할·공급자 계약·전문가 관여 조건으로 구분한다. | R321. Financial conduct classification must preserve P0, legal-review, and educational states (v52.83, P698) |
| R322 | 1888 | 현행 본문 검토 | 조건부 유지 | 재현 근거와 rollback은 유지한다. 비결정적 모델의 원문 동일성 대신 claim·정책·허용 오차로 replay를 평가한다. | R322. Model releases require replay provenance, approval, canary, and rollback evidence (v52.84, P699) |
| R323 | 1896 | 현행 본문 검토 | 개정 | 세션·종목·근거 격리는 유지하되 5인 서비스에 tenant 구조를 강제하지 않는다. 저장 정보는 필요한 범위로 제한한다. | R323. AI cache identity, idempotency, and stream completion must be tenant-safe and auditable (v52.84, P699) |
| R324 | 1872 | 현행 본문 검토 | 개정 | missing을 긍정 점수로 승격하지 않는다. 다만 missing을 neutral 관측값으로 바꾸지도 말고 unknown·측정 분모를 별도 표시한다. | R324. Coverage and exposure audits must neutralize missingness before recommendations (v52.85, P700) |
| R325 | 1880 | 현행 본문 검토 | 개정 | 실사용자·보조기기 증거는 필요하나 인원·서명 양식을 인증법처럼 고정하지 않는다. 실제 3~5인 반복 관찰부터 진행한다. | R325. Human chat claims require signed cross-mode evidence and explicit incomplete states (v52.85, P700) |
| R326 | 1856 | 현행 본문 검토 | 조건부 유지 | 읽기 전용 AI는 이 제품의 합리적 범위다. 모든 AI 제품의 법적 의무인 것처럼 일반화하지 않는다. | R326. Tool capabilities are read-only by default and mutation/unknown operations are denied (v52.86, P701) |
| R327 | 1864 | 현행 본문 검토 | 개정 | 권리 검토는 유지하되 source×operation×territory×retention별 허용표로 만든다. reference 상태는 별도 사용 허가가 아니다. | R327. Provider/data/output rights, retention, training, redistribution, and region require explicit registry approval (v52.86, P701) |
| R328 | 2968 | 현행 본문 검토 | 개정 | 시안은 검증할 가설이다. 결론·근거의 명료성을 우선하고 교육·무자료 상태를 시안 밖이라는 이유만으로 일괄 숨기지 않는다. | R328. 승인된 화면 시안은 장식층이 아니라 기본 정보구조이며, 접힌 레거시는 통합으로 간주하지 않는다 (v52.87, P702 root) |
| R329 | 2976 | 현행 본문 검토 | 조건부 유지 | 최종 비동기 DOM에도 정보 위계를 적용한다. 첫 화면 수·높이 제한은 관측된 사용성 근거로 조절한다. | R329. 시안 기본 경로 계약은 초기 HTML이 아니라 런타임 주입이 끝난 최종 화면에 적용한다 (v52.88, P703 root) |
| R330 | 2984 | 대체됨 | 역사 기록 | 대체 표시와 보존 본문을 읽었다. 이 과거 처방은 현행 승인 대상이 아니며 명시된 후속 규칙과 분리한다. | R330. 사용자 표면 수와 내부 QA 라우트 수를 분리하고, 시안 정보 위계를 모든 사용자 표면에 적용한다 (v52.89, P704 root) |
| R331 | 2994 | 현행 본문 검토 | 개정 | 유한 시간 내 정상·부분·실패 종료는 유지한다. 무자료 widget 숨김은 선택 기능만 적용하고 핵심 자료 부재는 설명한다. | R331. 시안의 최종 렌더 계약은 loaded/empty/degraded/closed 상태 전환과 종료 시간까지 포함한다 (v52.90, P705 root) |
| R332 | 3002 | 현행 본문 검토 | 유지 | 관측·수집·성공 시각과 발행 주기를 구분하고 missing·예측 미확인을 정직하게 표현한다. | R332. 데이터 파일 갱신시각·외부 관측시각·마지막 수집 성공시각을 분리하고 missing을 판단값으로 승격하지 않는다 (v52.91, P706 root) |
| R333 | 3010 | 현행 본문 검토 | 유지 | 실패 시 정상 artifact와 원 관측을 보존하며 대체 소스 존재를 권리·구현 완료와 구분한다. | R333. 핵심 수집 실패는 마지막 정상 산출물을 덮어쓰지 않으며 공급자 가용성과 구현 완료를 분리한다 (v52.92, P707 root) |
| R334 | 3018 | 현행 본문 검토 | 조건부 유지 | 무료 공식 원천 우선은 예산에 부합한다. 무료라는 이유로 취득·재배포·AI 사용권을 추정하지 않는다. | R334. 데이터 대체 계획은 독립 실행·행 단위 lineage·publish 전 의미 검사로 닫는다 (v52.93, P708 root) |
| R335 | 1796 | 현행 본문 검토 | 조건부 유지 | 공식 BLS의 단위·기간·발표 근거는 보존한다. 12시간 cache는 발행 일정·재시도 필요에 따라 조절한다. | R335. BLS 공식 macro evidence는 FRED 대체값이 아니라 typed primary producer로 보존한다 (v52.94) |
| R336 | 1802 | 현행 본문 검토 | 조건부 유지 | 완료 상태·금지 claim은 명시한다. 모든 batch에 같은 전체 QA 행렬을 강제하기보다 변경 위험으로 범위를 정한다. | R336. 모든 route의 page completeness는 producer failure와 reference fallback을 종결 상태로 노출한다 (v52.94) |
| R337 | 1808 | 현행 본문 검토 | 개정 | fixture 장애 override는 시험 환경에 격리한다. 운영자 flag를 실제 자료·공급자 건강성의 대체 증거로 쓰지 않는다. | R337. Runtime fixture override와 reference fallback drift의 의미를 테스트 계약에 고정한다 (v52.94, P709) |
| R338 | 1788 | 현행 본문 검토 | 조건부 유지 | artifact별 시각·원천·revision은 유지한다. 80% 등 임의 coverage 상한은 계산 목적·모집단별 근거가 필요하다. | R338. 데이터 artifact lineage는 정책별 timestamp와 반영 commit을 함께 검증하고, 다른 시각을 승격하지 않는다 (v52.96, P710) |
| R339 | 1780 | 현행 본문 검토 | 개정 | 증분 lineage와 capped 본문 분리는 유지하되 Telegram mirror 접근·본문 보관·AI 주입에는 별도 계약 검토를 선행한다. | R339. 증분 정성 피드는 전체 관측 lineage와 capped 소비 payload를 분리하고 현재 narrative를 재생성한다 (v52.97, P711) |
| R340 | 1772 | 현행 본문 검토 | 조건부 유지 | 동일 의미·기간·coverage와 결측 차단은 유지한다. 영향받는 주장 단위로 제한하고 무관한 화면까지 차단하지 않는다. | R340. 파생 시장 결론은 필수 관측 입력의 의미·기준일·coverage가 충족될 때만 표시한다 (v52.99, P712) |
| R341 | 1764 | 현행 본문 검토 | 조건부 유지 | 퇴역 코드를 실제 삭제하는 방향은 유지한다. 동적 export·외부 API 참조를 단순 grep 무참조로 오판하지 않는다. | R341. 퇴역 기능은 inert stub로 보존하지 않고 수직 경로와 공개 artifact에서 완전히 제거한다 (v53.3, P716) |
| R342 | 1754 | 현행 본문 검토 | 개정 | 현재 관측의 정적 합성은 금지한다. 유효한 날짜의 사례·공식 규칙·모델 상수까지 고정 텍스트 금지로 넓히지 않는다. | R342. 변동 데이터와 현재형 서술은 런타임 증거만 사용하고 결측을 정적 시드로 메우지 않는다 (v53.4, P717) |
| R343 | 1746 | 현행 본문 검토 | 개정 | HYG 가격과 credit spread를 혼동하지 않는다. FRED 단독 경로를 경제적 진리로 고정하지 말고 동등 OAS의 승인 원천을 허용한다. | R343. 신용 판정은 HYG 등 듀레이션 오염 가격이 아니라 FRED HY OAS(bp) 실측만 사용하고, 결측 시 null 사전 차단으로 0을 방지한다 (v53.7, P726) |
| R344 | 1738 | 현행 본문 검토 | 조건부 유지 | 퇴역 sink와 호출을 함께 정리한다. 이름 있는 timer registry는 현 구현 선택이며 라이브러리의 scope 소유 timer도 인정한다. | R344. 퇴역 UI의 렌더 경로와 주기 작업은 canonical owner 하나만 남기고 실행 가능한 게이트로 고정한다 (v53.8, P727) |
| R345 | 1730 | 현행 본문 검토 | 유지 | 고빈도 저장과 공통 DOM 작업을 분리하고 batch별 중복 전수 scan을 제한한다. | R345. 고빈도 데이터 batch는 Store 기록과 DOM 반영을 분리하고 전역 scan·rewrite를 batch당 한 번만 수행한다 (v53.9, P728) |
| R346 | 1722 | 현행 본문 검토 | 유지 | 실제 event target과 payload를 경계에서 정규화하는 원칙은 유지한다. | R346. Legacy event adapters must normalize the actual EventTarget and payload shape at the boundary (v53.9, P729) |
| R347 | 1714 | 현행 본문 검토 | 개정 | 빠른·느린 데이터와 권리 증거를 분리한다. 고정 7일 soak는 가족 pilot과 공개 확대의 서로 다른 수용 기준으로 재설계한다. | R347. Durable and fast data planes must expose independent revisions and fail closed until operator SLO evidence exists (v53.11, AR-07) |
| R348 | 1708 | 현행 본문 검토 | 유지 | 워크플로 프로그램과 검사기의 실제 ESM 실행 모드를 맞춘다. | R348. Workflow heredocs must declare the same Node module mode that their source syntax requires (v53.11, P732) |
| R349 | 1702 | 현행 본문 검토 | 유지 | module-mode heredoc에서 사용할 수 없는 전역 require를 남기지 않는다. | R349. Workflow module heredocs require an ESM runtime-import contract (v53.12, P733) |
| R350 | 1696 | 현행 본문 검토 | 유지 | 암호화 잠금과 뉴스 창의 의미를 실제 재로드·복구 경로에서 검증한다. | R350. Protected portfolio reloads and RSS backstops must fail closed at the visible boundary (v53.13, P734) |
| R351 | 1690 | 현행 본문 검토 | 유지 | 행 bucket 날짜가 필드 관측시각을 대체하지 않도록 provenance를 보존한다. | R351. History bucket dates must not replace field-level observation provenance (v53.14, P735) |
| R352 | 1646 | 현행 본문 검토 | 개정 | 실제 owner 이전·레거시 퇴역은 유지한다. batch마다 최소 한 개 삭제 의무와 장문의 과거 packet 처방은 현재 일반 계약에서 분리한다. | R352. Architecture migration must transfer an executable owner and monotonically retire legacy coupling (v53.15, P736) |
| R353 | 1640 | 현행 본문 검토 | 유지 | 이관 진척·소유권 수를 원본 registry에서 파생한다. | R353. route ownership 요약은 route별 선언에서 재계산한다 (v53.18, P781) |
| R354 | 1634 | 현행 본문 검토 | 유지 | 설치·대기·활성 SW 버전을 구분하고 reload loop를 막는다. | R354. 서비스워커 버전 표시는 현재 controller 전환을 따라야 한다 (v53.18, P782) |
| R355 | 1628 | 현행 본문 검토 | 개정 | artifact transport라는 이유로 모두 reference-only라 하지 않는다. 최신 공식 종가도 현재 관측이며 상태·권리를 별도로 판정한다. | R355. Durable snapshot은 reference readiness이며 client live enrichment의 outage gate다 (v53.18, P783) |
| R356 | 1500 | 현행 본문 검토 | 개정 | proxy health는 공유하되 종목 없음·payload 오류·망 장애를 구분한다. 모든 실패 3회 cooldown은 실측으로 보정한다. | R356. Yahoo chart proxy는 공통 health registry를 통해서만 실행해야 한다 (v53.19, P784) |
| R357 | 1506 | 퇴역 | 역사 기록 | 퇴역 표시와 보존 본문을 읽었다. 현행 규칙으로 재승인하지 않으며 사고 이력과 대체 경계만 보존한다. | R357. Native bounded technical surfaces must have one pure model and an explicit legacy writer fence (v53.20, P785) |
| R358 | 1514 | 퇴역 | 역사 기록 | 퇴역 표시와 보존 본문을 읽었다. 현행 규칙으로 재승인하지 않으며 사고 이력과 대체 경계만 보존한다. | R358. Signal primary text must derive from one Trading Score model and fence the legacy dashboard writer (v53.21, P786) |
| R359 | 1522 | 퇴역 | 역사 기록 | 퇴역 표시와 보존 본문을 읽었다. 현행 규칙으로 재승인하지 않으며 사고 이력과 대체 경계만 보존한다. | R359. Home aggregate primary text must reuse signal presentation and fence legacy summary writers (v53.22, P787) |
| R360 | 1530 | 현행 본문 검토 | 개정 | 단일 writer·명시 selection은 유지하되 영구적으로 legacy child가 채워져야 한다는 과거 이관 처방은 역사로 옮긴다. | R360. Derived theme-detail summary must use an explicit event/child boundary (v53.23, P788) |
| R361 | 1536 | 현행 본문 검토 | 개정 | normalized evidence는 유지한다. live quote만 없다는 이유로 유효한 완료 종가까지 무자료로 처리하지 않는다. | R361. Theme-detail composition/breadth must use normalized quote evidence and a fenced legacy writer (v53.24, P789) |
| R362 | 1542 | 현행 본문 검토 | 조건부 유지 | 리더 표시의 단일 writer·결측 상태는 유지한다. legacy 경계와 17-route 고정 수는 현재 registry로 바꾼다. | R362. Theme-detail leader cards must have one native writer and fail-closed quote display (v53.25, P790) |
| R363 | 1548 | 현행 본문 검토 | 개정 | 관측 근거에 따른 해석은 유지한다. 과거 child 이름·legacy body·온도 진단의 영구 의무는 기능 필요로 재평가한다. | R363. Theme-detail temperature narrative must derive from canonical performance and fence the legacy section (v53.26, P791) |
| R364 | 1554 | 현행 본문 검토 | 조건부 유지 | 관측된 변화만으로 spread를 계산한다. 2개는 산술 최소 수일 뿐 신뢰도·시장 대표성의 증명이 아니다. | R364. Theme-detail performance spread must rank only observed quote changes (v53.27, P792) |
| R365 | 1560 | 현행 본문 검토 | 개정 | 시장 폭의 측정 분모와 결측을 보존한다. 과거 legacy writer 경계를 현행 구조의 영구 의무로 두지 않는다. | R365. Theme-detail breadth-health narrative must use normalized breadth and fence the legacy section (v53.28, P793) |
| R366 | 1566 | 현행 본문 검토 | 조건부 유지 | 동일 기간·분모로 하위 테마 차이를 설명한다. 2개 관측은 설명 가능성만 보장하며 예측 신호가 아니다. | R366. Theme-detail subtheme-gap narrative must use normalized subtheme quote evidence and fence the legacy section (v53.29, P794) |
| R367 | 1622 | 현행 본문 검토 | 조건부 유지 | 테마와 benchmark의 동일 기준 비교는 유지한다. 현재 owner와 benchmark 정의에 맞춰 오래된 packet 계약은 갱신한다. | R367. Theme-detail benchmark narrative must use normalized theme/benchmark evidence and fence the legacy section (v53.30, P795) |
| R368 | 1572 | 퇴역 | 역사 기록 | 퇴역 표시와 보존 본문을 읽었다. 현행 규칙으로 재승인하지 않으며 사고 이력과 대체 경계만 보존한다. | R368. Home Quality must not reuse Trading Score and must fail closed without canonical inputs (v53.34, P821) |
| R369 | 1580 | 현행 본문 검토 | 폐기 | 퇴역한 technical candle text와 legacy canvas의 영구 분리 의무는 현재 native stock chart 구조에 맞지 않는다. 일반 lifetime 원칙으로 흡수한다. | R369. Technical candle text and legacy canvas lifecycle must remain separate (v53.34, P822) |
| R370 | 1586 | 현행 본문 검토 | 유지 | finite 검증을 거친 값만 정렬·서식화하여 sentinel·NaN 누출을 막는다. | R370. Theme-detail comparison formatters must reject non-finite quote percentages (v53.35, P823) |
| R371 | 1592 | 현행 본문 검토 | 조건부 유지 | native text의 단일 writer는 유지한다. 자료의 최신성 검사는 공통 selector에서 일관되게 수행한다. | R371. Shared currentness sanitizers must not rewrite native renderer-owned narrative sinks (v53.36, P824) |
| R372 | 1598 | 현행 본문 검토 | 개정 | 의미 있는 상태 알림을 조정하되 aria-live 전역 개수 상한은 폐기한다. 작업별 완료·오류·중복 읽기를 실제 평가한다. | R372. Dynamic detail panels must keep aria-live announcements intentionally scarce (v53.37, P825) |
| R373 | 1604 | 현행 본문 검토 | 유지 | 파생 뷰는 실제 canonical mount와 선택 맥락으로 재진입한다. | R373. Derived routes must replay through their canonical mount in compatibility navigation (v53.38, P826) |
| R374 | 1610 | 현행 본문 검토 | 개정 | normalized portfolio·단일 writer는 유지한다. 필요한 값이 다른 총평가·손익·섹터 집계를 하나의 결측 규칙으로 묶지 않는다. | R374. Portfolio summary cutovers must transfer the pure model and fence every legacy writer (v53.40, P831) |
| R375 | 1616 | 현행 본문 검토 | 유지 | 공시 정체성·회계기간·단위·원천을 지키고 추정·외부 관측을 공식 SEC 사실과 분리한다. | R375. Official SEC report surfaces must use one finite-safe projection and keep mixed-source sections separate (v53.41, P832) |
| R376 | 3025 | 현행 본문 검토 | 조건부 유지 | 카드 등록 없는 무료 운영 결정은 유지한다. 저장 기술 이름은 영구 제품 법칙이 아니라 승인된 비용 경계로 관리한다. | R376. Cloudflare fast quote plane의 R2는 승인된 optional durability layer이며 KV-only 배포에서는 R2 binding/secret을 요구하지 않는다 (v53.42, P833) |
| R377 | 3031 | 현행 본문 검토 | 개정 | 제공 자료의 날짜·출처·한계는 보존하되 모든 자료에 Q1~Q5와 특정 AI 산업 프레임을 강제하지 않는다. | R377. 사용자 제공 시장자료는 하나의 REFERENCE 프레임으로 통합하되 현재성 수치와 분리한다 (v53.43, P834) |
| R378 | 3039 | 현행 본문 검토 | 개정 | 모든 참고 문헌에 차트·행동 playbook을 생산시키지 않는다. 해당 자료가 실제 제공하는 설명·반례·관측 질문만 연결한다. | R378. Reference market material must expose reusable chart, behavior, and communication protocols (v53.44, P835) |
| R379 | 3047 | 현행 본문 검토 | 유지 | 미시도 후보가 반복 실패 때문에 굶지 않도록 queue와 cooldown을 관리한다. | R379. SEC refresh queues must rotate untried candidates before retrying known failures (v53.45, P836) |
| R380 | 3055 | 현행 본문 검토 | 조건부 유지 | 빈 초기 저장소와 장애는 구분한다. bootstrap 예외에는 종료 시점·다음 관측을 두어 영구 면제를 막는다. | R380. Fast-plane deploy smoke must distinguish bootstrap from failure (v53.46, P837) |
| R381 | 3061 | 현행 본문 검토 | 개정 | source 상태와 분석 용도를 구분한다. 역사·주간 자료도 기준일에 맞는 연구에는 유효하며 fresh/live만이 연구 입력은 아니다. | R381. Decision models must consume normalized decision evidence (v53.47, P838) |
| R382 | 3069 | 현행 본문 검토 | 유지 | 비동기 자원과 민감 저장의 lifetime·소유권을 명시한다. | R382. Route resources and sensitive-key persistence must be scope-owned (v53.48, P839) |
| R383 | 3077 | 현행 본문 검토 | 폐기 | 근거가 있으면 ticker action 언어를 허용한다는 전제는 현재 지시 금지와 맞지 않는다. 관측형 setup 계약으로 흡수한다. | R383. Ticker action narratives require entity evidence (v53.49, P840) |
| R384 | 3083 | 현행 본문 검토 | 유지 | 암호문 버전과 KDF 이행·구버전 복구를 명시적으로 검증한다. | R384. Vault ciphertext must be versioned and migrate legacy KDF values (v53.49, P840) |
| R385 | 3089 | 현행 본문 검토 | 조건부 유지 | 실행 가능한 route 계약은 유효하다. alias·파생 뷰와 실제 화면을 구분하고 전체 행렬은 위험에 맞춰 실행한다. | R385. Vertical slices must be executable route contracts (v53.50, P841) |
| R386 | 3095 | 현행 본문 검토 | 조건부 유지 | 반복 이동으로 누적 자원·늦은 응답을 검출한다. 3회 통과를 장기 운영 안정성 인증으로 부르지 않는다. | R386. Route/resource stability must be proven by a repeated blocking soak (v53.51, P843) |
| R387 | 3101 | 현행 본문 검토 | 개정 | 로컬·배포·권리·인수 증거는 분리한다. 공개 beta와 5인 pilot의 위험을 구분하고 30일을 보편 인증 조건으로 두지 않는다. | R387. Operational and public-readiness claims must remain revisioned and operator-explicit (v53.51, P843) |
| R388 | 3107 | 현행 본문 검토 | 유지 | 사용자에게 약속하는 기능·자동성·현재성은 실제 capability와 일치시킨다. | R388. Capability claims must be manifest-backed and fail closed (v53.51, P842) |
| R389 | 3113 | 현행 본문 검토 | 조건부 유지 | 정확한 저장·삭제·readback 상태는 유지하되 퇴역한 개인 공급자 키 경로를 보존하는 의무는 제거한다. | R389. Credential persistence must be registry-backed and readback-proven (v53.52, P844) |
| R390 | 3119 | 현행 본문 검토 | 유지 | endpoint 건강·인증·quota·이전 호출 성공을 서로 다른 상태로 보여준다. | R390. AI route readiness must be explicit and fail closed (v53.52, P844) |
| R391 | 3125 | 현행 본문 검토 | 개정 | 5차원 상태 분리는 유지하되 secret 구성·권리·건강성을 public 화면에 같은 상세도로 노출할 의무는 두지 않는다. | R391. AI/data operations must expose five readiness dimensions (v53.52, P844) |
| R392 | 3131 | 현행 본문 검토 | 유지 | 초기 호출 가능한 진입점이 아직 초기화되지 않은 lexical 상태를 직접 읽지 않게 한다. | R392. Compatibility entrypoints must be safe during initialization races (v53.53, P845) |
| R393 | 3137 | 현행 본문 검토 | 개정 | 유효한 공개 호출 계약은 보존하되 퇴역한 개인-key overload·provider 선택 경로의 영구 보존은 삭제한다. | R393. Compatibility exports must preserve global call contracts (v53.54, P846) |
| R394 | 3143 | 현행 본문 검토 | 개정 | typed 자료와 claim 연결은 필요조건이다. 근거 연결만으로 인과 설명·내용 진실이 검증됐다고 표시하지 않는다. | R394. Current-sensitive server prose requires typed metric and source evidence (v53.54, P847) |
| R395 | 3149 | 현행 본문 검토 | 조건부 유지 | 공통 planner와 dispatch owner는 현 구조에 적합하다. 대표 7case가 전체 질문 정확성 증거는 아니다. | R395. AI questions must enter through one typed QuestionPlan/Orchestrator (v53.55, P848) |
| R396 | 3155 | 현행 본문 검토 | 개정 | 현재 수치의 typed tuple은 유지하되 외부 응답의 JSON 형식 일치가 진실·완전성 인증은 아니다. 주장별 누락을 분리한다. | R396. Current-sensitive AI answers require MarketSessionEvidence and strict AnswerPlan/ClaimLedger (v53.55, P848) |
| R397 | 3161 | 현행 본문 검토 | 유지 | 상대 순위를 검증된 추천이나 상승 확률로 승격하지 않는다. | R397. Research-relative rankings must not become confirmed recommendations (v53.55, P848) |
| R398 | 3167 | 현행 본문 검토 | 유지 | 답변에서 차단된 의미를 후행 카드·칩이 다시 도입하지 않게 한다. | R398. AI post-processing must inherit the response policy (v53.55, P848) |
| R399 | 3173 | 현행 본문 검토 | 유지 | 계산은 실제 supplied input에서만 하며 미확인 원인·값·확률을 만들지 않는다. | R399. Domain analysis engines must be deterministic and evidence-bounded (v53.55, P849) |
| R400 | 3179 | 현행 본문 검토 | 유지 | routing corpus와 실제 모델 품질·live canary를 혼동하지 않는다. | R400. Model benchmark and operations status must not be overstated (v53.55, P849) |
| R401 | 3185 | 현행 본문 검토 | 개정 | 필요 근거와 공급 능력은 분리한다. 현재 자료 부재가 무관한 일반 개념 답변까지 금지하는 기준이 되어서는 안 된다. | R401. Research requirement and research capability must remain separate (v53.56, P850) |
| R402 | 3191 | 현행 본문 검토 | 유지 | quote를 동일 metric·값·단위·시각 tuple로 정규화하여 검증 경계에 전달한다. | R402. Chat quote evidence must cross the typed-claim boundary without lossy field mapping (v53.57, P851) |
| R403 | 3197 | 현행 본문 검토 | 개정 | 모든 현재 질문에 동일 출처 수·independent floor를 강제하지 않는다. 공식 단일 발표와 인과 가설은 서로 다른 입증을 요구한다. | R403. ResearchDecision/ResearchPlan must be the same evidence gate for every chat surface (v53.58, P852) |
| R404 | 3203 | 현행 본문 검토 | 유지 | 질문 계획과 시세 provenance는 요청에 결속하며 수신시각을 관측시각으로 바꾸지 않는다. | R404. Question plans and observation provenance are request-bound (v53.58, P852) |
| R405 | 3209 | 현행 본문 검토 | 유지 | 부분 성공 결과에도 원 query identity·source tier·문서 깊이를 유지한다. | R405. Partial research results retain their original sub-query identity (v53.58, P852) |
| R406 | 3215 | 현행 본문 검토 | 개정 | WCAG 2.2 AA의 24×24 CSS px와 spacing·inline·essential 등 예외를 실제 측정한다. 단순 24px 한 축 규칙은 불충분하다. | R406. Accessibility target warnings are blocking (v53.58, P852) |
| R407 | 3221 | 현행 본문 검토 | 유지 | 가격·변화·직전 종가·시각을 동일 producer envelope에서 선택한다. | R407. Quote price/change/previous-close fields must share one producer revision (v53.59, P853) |
| R408 | 3225 | 현행 본문 검토 | 유지 | 남은 quota가 실제 AI route 준비 완료를 뜻하지 않도록 분리한다. | R408. AI quota must not imply route capability (v53.59, P855) |
| R409 | 3229 | 현행 본문 검토 | 조건부 유지 | 배포 가능한 artifact의 revision 묶음은 맞춘다. 과거 실측의 revision을 현재 버전 문자열로 바꾸지는 않는다. | R409. Release data revisions must match the published snapshot (v53.59, P856) |
| R410 | 3233 | 현행 본문 검토 | 개정 | 성능 실패·미측정·과거 측정은 서로 다른 상태다. 같은 BLOCKED 문자열로 통합하거나 측정 창을 임의 조절하지 않는다. | R410. Public readiness must mirror measured boot-performance status (v53.60, P857) |
| R411 | 3237 | 현행 본문 검토 | 개정 | 비핵심 작업의 간섭은 줄이되 고정 2초 금지창보다 실제 사용자 입력·idle·deadline·요청 중요도로 스케줄한다. | R411. Secondary producers must declare a post-boot phase boundary (v53.62, P858) |
| R412 | 3243 | 현행 본문 검토 | 조건부 유지 | UI와 원천 자료 사이 native data 경계는 유지한다. 특정 파일명이 영구적 정답인 것은 아니다. | R412. Native data readers are the only route-provider boundary (v53.63, P833) |
| R413 | 3254 | 현행 본문 검토 | 조건부 유지 | 차트 lifetime·scope·결측 경계는 유지하되 Chart.js 전용 계약을 Lightweight Charts 등 현재 renderer에도 일반화한다. | R413. Native chart ownership requires a registry, marker, and legacy fence (v53.63, P834-P835) |
| R414 | 3265 | 현행 본문 검토 | 개정 | allowedUse decision flag만으로 의사결정 적합성이 생기지 않는다. 자료 권리·현재성·산식·예측 주장 검증을 각각 확인한다. | R414. Current decision scores require a typed decision-use grant (v53.64, P860) |
| R415 | 3276 | 현행 본문 검토 | 조건부 유지 | 날짜 없는 기사를 현재 score에 넣지 않는다. 날짜 미확인 자료의 archive·원문 열람까지 금지하지 않는다. | R415. Freshness-scoped news models require observable event time (v53.64, P861) |
| R416 | 3285 | 현행 본문 검토 | 개정 | 총평가·손익별 필수 입력을 정의한다. 부분 합계도 분모·제외액을 밝히면 유용하며 전체를 모두 unavailable로 만들 필요는 없다. | R416. Partial portfolio aggregates must remain partial (v53.64, P862) |
| R417 | 3294 | 현행 본문 검토 | 유지 | 현재 기간·데이터가 바뀔 때 scoped writer 하나가 성과 표면을 갱신한다. | R417. Native secondary theme performance surfaces need one scoped writer (v53.64, P859) |
| R418 | 3305 | 현행 본문 검토 | 조건부 유지 | 도달 가능·기능 준비·운영 관측은 분리한다. 7일은 고정 법적 인증값이 아니라 서비스 위험별 수용 기간이다. | R418. Worker reachability, capability, and soak are separate operations states (v53.64, P863) |
| R419 | 1464 | 현행 본문 검토 | 조건부 유지 | 현재 릴리스 선언은 일치시킨다. 측정 artifact의 실제 당시 revision·환경까지 일괄 bump하지 않는다. | R419. 릴리스 아키텍처 매니페스트는 R1 버전과 함께 동기화해야 한다 (v53.64, P864) |
| R420 | 1470 | 현행 본문 검토 | 유지 | 다음 공식 일정과 실제 발표 결과를 구분하고 추정 날짜를 공식 확정처럼 표시하지 않는다. | R420. 공식 일정의 완료 이벤트는 nextRelease로 남기지 않는다 (v53.64, P865) |
| R421 | 1476 | 현행 본문 검토 | 유지 | 데이터 변경과 그 데이터 revision 선언을 같은 배포 단위로 게시한다. | R421. 데이터 refresh 이후 릴리스 SSOT를 같은 revision tuple로 승격한다 (v53.64, P866) |
| R422 | 1482 | 현행 본문 검토 | 유지 | 이전 성공 값의 원시각을 보존하고 현재 인증·연결 성공으로 위장하지 않는다. | R422. LKG 값은 개인 공급자 재시도나 최신 성공시각으로 간주하지 않는다 (v53.65, P867) |
| R423 | 1488 | 현행 본문 검토 | 조건부 유지 | 일별 종가와 장중값을 구분한다. 각 거래소·24시간 자산의 실제 세션 정의를 따로 적용한다. | R423. 일별 시계열에는 완료된 시장 세션 값만 저장한다 (v53.65, P868) |
| R424 | 1494 | 현행 본문 검토 | 개정 | 모든 라우트에 동일 뉴스 24시간 컷을 강제하지 않는다. 종가·속보·월간 발표·13F의 자연 시계와 조사 맥락을 함께 보존한다. | R424. 모든 라우트의 현재시장 문맥은 하나의 서버 24시간 컷을 사용한다 (v53.65, P869) |
| R425 | 3317 | 현행 본문 검토 | 개정 | 완료 08시 브리핑과 연구 보관 창은 분리하되 뉴스의 08시 이후 새 사건을 current 표면에서 일괄 배제하지 않는다. | R425. Current news and research lanes are separate (v53.66, P870) |
| R426 | 3323 | 현행 본문 검토 | 폐기 | 모든 route에 자동 시장 decision header를 의무화하는 처방은 8화면 declutter와 정적 학습·공시 문맥에 맞지 않는다. | R426. Decision headers must be explicit mounted route elements (v53.67, P871) |
| R427 | 3329 | 현행 본문 검토 | 유지 | 공급자의 세션 hint보다 실제 거래소 달력·관측시각을 우선한다. | R427. Provider session hints must be reconciled with venue schedules (v53.68, P872) |
| R428 | 3335 | 현행 본문 검토 | 유지 | 갱신 데이터·매니페스트의 원자적 revision과 명시적 LKG 상태를 유지한다. | R428. Data refresh and release manifests must publish one atomic revision tuple (v53.68, P873) |
| R429 | 3341 | 현행 본문 검토 | 유지 | 운영 준비 상태는 자신이 주장하는 capability의 실제 성공 자료에서 파생한다. | R429. Operations status must derive from the capability it claims (v53.68, P874) |
| R430 | 3347 | 현행 본문 검토 | 유지 | 무동작 컨트롤을 기능처럼 보이지 않게 하며 참고 자료의 실제 기준·부재를 쉬운 문장으로 표현한다. | R430. Reference learning surfaces must expose real state and freshness (v53.78, P875) |
| R431 | 3353 | 현행 본문 검토 | 개정 | content unit의 의미 검수는 유지하되 모든 개념에 KPI·동일 인과사슬·동일 필드를 강제하지 않고 해당 없음 근거를 허용한다. | R431. Source-document coverage must be measured per content unit (v53.79, P876) |
| R432 | 3359 | 현행 본문 검토 | 개정 | 검증된 식별자 대조는 필요하다. 19/95/1102/1122·zero mapped 고정 수를 현재 진실로 고정하지 않는다. | R432. Domain expansion must preserve publication and normalization boundaries (v53.80, P877) |
| R433 | 3365 | 현행 본문 검토 | 개정 | 구조적 제품 정보와 현재 양산·매출 주장을 구분한다. 교육 자료라는 이유만으로 확인된 날짜까지 반드시 null로 두지 않는다. | R433. Educational player/product references require resolved evidence edges (v53.81, P881) |
| R434 | 3371 | 현행 본문 검토 | 개정 | 원고가 실제 renderer와 연결되는지 확인하되 고정 개수 통과를 내용·교육적 품질 승인으로 쓰지 않는다. | R434. Authored reference artifacts require renderer and coverage gates (v53.83, P884-P887) |
| R435 | 3377 | 현행 본문 검토 | 유지 | 웹페이지 확인·구조 매핑을 현재 생산·투자 사실로 승격하지 않고 검토 범위를 밝힌다. | R435. Reference currentness overlays must remain educational and status-labeled (v53.84, P888) |
| R436 | 3383 | 대체됨 | 역사 기록 | 대체 표시와 보존 본문을 읽었다. 이 과거 처방은 현행 승인 대상이 아니며 명시된 후속 규칙과 분리한다. | R436. 시장 휴장일 freshness 유예는 완전한 Tier-0 snapshot에만 허용한다 (v53.86, P889) |
| R437 | 3391 | 현행 본문 검토 | 조건부 유지 | 최신 공시가 없다는 사실과 수집 지연을 구분한다. 재확인은 SEC 발행 주기·필요도에 맞춘다. | R437. 최신 13F 없음과 지연 상태를 구분하는 SEC availability evidence를 기록한다 (v53.87, P890) |
| R438 | 3397 | 현행 본문 검토 | 개정 | 개별 설명·반례의 고유성은 유지하되 기본 tree·필드 수·111개 레슨을 사용성 정답으로 고정하지 않는다. | R438. 학습 지도는 의미 단위별 원고와 기본 공개 흐름을 함께 검증한다 (v53.88, P891) |
| R439 | 3403 | 현행 본문 검토 | 유지 | 실제 직전 공시를 비교하고 표·검색의 유한값·포커스·중첩 제어를 검증한다. | R439. 분기 비교는 실제 인접 공시와 유한한 사용자 표면을 함께 검증한다 (v53.89, P892) |
| R440 | 3409 | 현행 본문 검토 | 조건부 유지 | 공식·계측 근거 없는 현재 주장을 만들지 않는다. 자료 일부가 검증되면 해당 claim만 승격하고 나머지는 참고로 남긴다. | R440. 참고 자료의 셋업·전력·자료품질 프레임은 관찰용으로만 승격한다 (v53.91) |
| R441 | 3415 | 현행 본문 검토 | 개정 | secondary discovery·반복 전파의 한계는 유지한다. 공개 mirror·요약·reference가 플랫폼 AI·보관 계약의 허가가 되지는 않는다. | R441. Telegram 다채널 discovery는 source catalog·신선도·실패 상태를 함께 보존한다 (v53.92) |
| R442 | 3421 | 현행 본문 검토 | 유지 | 테스트 그룹의 실제 실행·완료 누락을 registry invariant로 검출한다. | R442. 브라우저 테스트 그룹은 registry·예외·planned/completed invariant를 하나의 release gate로 기록한다 (v53.96, P895) |
| R443 | 3426 | 현행 본문 검토 | 조건부 유지 | 예상 외 오류는 blocking한다. allowlist는 환경·원인별로 최소화하며 offline 차단을 서비스 성공으로 보지 않는다. | R443. 예상 외 브라우저 runtime 오류와 차단된 외부 네트워크는 서로 다른 상태로 분류한다 (v53.96, P895) |
| R444 | 3432 | 현행 본문 검토 | 개정 | evidence ID는 추적성이지 의미 검증 자체가 아니다. 주장별 지원 관계를 확인하고 raw ID가 사용자 본문에 노출되지 않게 한다. | R444. AI 시장 분석은 claim마다 canonical evidence ID를 가지며 provider 실패도 동일 schema fallback을 낸다 (v53.96, P895) |
| R445 | 3438 | 현행 본문 검토 | 조건부 유지 | 공용 예산의 원자 예약·중복 방지는 유지한다. origin·연결별 cap은 인증이나 실제 청구 상한이 아니다. | R445. Worker quota는 atomic reserve/release와 idempotency를 제공해야 하며 legacy KV는 fail-closed다 (v53.96, P895) |
| R446 | 3444 | 현행 본문 검토 | 유지 | 소유권의 비적용과 레거시를 구분하고 로컬·배포·실측 revision을 혼합하지 않는다. | R446. route ownership은 native/legacy/not-applicable를 구분하고 revision lanes를 혼합하지 않는다 (v53.96, P895) |
| R447 | 3450 | 현행 본문 검토 | 조건부 유지 | 달력 미확인 시 현재 세션을 단정하지 않는다. 날짜가 명시된 과거·참고 설명까지 중단하지 않는다. | R447. 시장 시간은 event/observed/collected/published와 exchange calendar를 분리하며 calendar 누락은 UNKNOWN이다 (v53.96, P895) |
| R448 | 3456 | 현행 본문 검토 | 개정 | 음수 이익·금리·현금흐름은 정상 관측일 수 있다. 음수라는 이유로 quarantine하지 말고 metric별 유효 범위·회계 의미를 검사한다. | R448. SEC fundamental anomaly는 quarantine하고 current/missing/not-applicable classification을 공개한다 (v53.96, P895) |
| R449 | 3462 | 현행 본문 검토 | 조건부 유지 | 예측 우위에는 PIT·비용·유동성·표본 검증이 필요하다. 설명형 순위·관측 통계에 같은 기관급 인증을 강제하지 않는다. | R449. 연구 모델은 PIT/walk-forward/holdout/cost/liquidity/parity 상태를 함께 공개하고 검증 전 research-only다 (v53.96, P895) |
| R450 | 3468 | 현행 본문 검토 | 조건부 유지 | 로컬 검사와 실제 edge 적용·운영 실측을 분리한다. 7/30일은 서비스 목적에 맞춘 자율 운영 기준이다. | R450. CSP·decomposition·operations gates는 local PASS와 live certification을 분리한다 (v53.96, P895) |
| R451 | 3474 | 현행 본문 검토 | 개정 | 필드 존재와 학습 품질을 분리한다. 분량 하한·모든 경제 전파·정량 예제 의무는 개념별 학습 목표와 해당 없음 근거로 바꾼다. | R451. 학습 필드 존재와 백과사전급 깊이를 분리해 인증한다 (v53.98, P896) |
| R452 | 3480 | 현행 본문 검토 | 유지 | 실제 consumer로 그래프·근거 참조·부분 실패를 검증하며 구조 통과를 의미·사람 검증으로 승격하지 않는다. | R452. 지식 그래프·출처·artifact 상태는 실제 consumer와 같은 해석기로 인증한다 (v53.99, P897) |
| R453 | 3486 | 현행 본문 검토 | 개정 | 실행 결과·실제 검색 준비 증거는 유지한다. 출처 수·snippet 제한은 질문의 주장 유형·원문 접근 범위에 맞춰 적용한다. | R453. AI Research는 하나의 실행 결과 계약과 관측된 capability 증거로만 공개한다 (v54.0, P898) |
| R454 | 3492 | 현행 본문 검토 | 조건부 유지 | SW fixture가 재로드 상태를 잘못 초기화하지 않아야 한다. 연속 두 실행은 특정 회귀 반례이지 보편 release 의무는 아니다. | R454. Service-worker takeover fixture는 1회 reload 전후 상태를 보존해 검증한다 (v54.0, P899) |
| R455 | 3498 | 현행 본문 검토 | 유지 | 실제 관측과 명시적 unavailable tuple의 일치를 확인하고 placeholder를 성공으로 세지 않는다. | R455. 변동 데이터 게이트는 실제 관측과 완전한 unavailable 튜플을 모두 실행 검증한다 (v54.1, P900) |
| R456 | 3504 | 현행 본문 검토 | 개정 | claim tuple·질문 의도·출력 지시 검사를 분리하는 원칙은 유지한다. 조건부 가격·비중 허용 문구는 최신 AGENTS 지시 금지와 정합화한다. | R456. AI 채팅은 단일 QuestionPlan→Evidence→AnswerPlan 계약으로 종단간 검증한다 (v54.2, P901) |
| R457 | 3510 | 현행 본문 검토 | 유지 | producer와 파생 산출물을 원자 발행하고 실제 staged 내용까지 검증한다. | R457. 변동 원본 artifact와 파생 인덱스는 producer가 원자적으로 발행하고 실제 Git index에서 검증한다 (v54.2, P902, v56.33 P1204) |
| R458 | 3516 | 현행 본문 검토 | 조건부 유지 | Pages와 AI Worker의 배포·준비 증거는 별도 확인한다. US DO는 선택한 계약 이행 설계이며 전세계 법적 의무는 아니다. | R458. AI edge Worker는 소스·배포·readiness를 하나의 릴리스 계약으로 닫는다 (v54.3, P903) |
| R459 | 3522 | 현행 본문 검토 | 조건부 유지 | jurisdiction은 DO의 실행·저장 범위를 보장한다. 전체 네트워크 egress·로그·수탁자 관할까지 보장한다고 확대하지 않는다. | R459. Provider 허용 지역은 location hint가 아니라 관할권 실행 증거로 고정한다 (v54.4, P904) |
| R460 | 3528 | 현행 본문 검토 | 개정 | 개념·조건부 설명을 살리되 자격이 필요한 맞춤 법률·세무 자문은 공급자 계약·관할·전문가 관여 조건을 따로 집행한다. | R460. 소수 사용자용 금융 안전 경계는 답변 범위와 실제 실행 위험을 분리한다 (v54.4, P905) |
| R461 | 3534 | 현행 본문 검토 | 유지 | 자료 장애는 영향받는 현재 주장만 보류하고 근거 있는 일반 설명까지 지우지 않는다. | R461. 공급자·근거 장애는 답변 전체가 아니라 영향받는 주장 범위만 저하시킨다 (v54.4, P906) |
| R462 | 3540 | 현행 본문 검토 | 유지 | 부분 성공을 구조적으로 유효한 degraded 상태로 다루고 성공률·원인을 숨기지 않는다. | R462. 다중 공급자 coverage 계약은 partial 상태를 성공·실패 lineage와 함께 보존한다 (v54.4, P907) |
| R463 | 3546 | 현행 본문 검토 | 유지 | 설정 존재가 아니라 실제 선택 endpoint의 건강·인증을 검증한다. | R463. AI readiness는 저장된 credential이 아니라 실제 선택된 endpoint를 검증한다 (v54.5, P908) |
| R464 | 1428 | 현행 본문 검토 | 조건부 유지 | canonical ID·alias는 유용하다. 표현이 비슷해도 의미·학습 목적이 다른 개념은 억지로 합치지 않는다. | R464. Knowledge concepts require one canonical namespace and explicit overlap equivalence (v54.6) |
| R465 | 1434 | 현행 본문 검토 | 유지 | 그래프의 방향·조건·근거를 명시하고 generic default로 의미를 발명하지 않는다. | R465. Knowledge graph edge metadata must be explicit before runtime consumption (v54.6) |
| R466 | 1440 | 현행 본문 검토 | 개정 | claim 직접성은 유지하되 출처 간 이견을 전부 build 실패로 만들지 않는다. 상충 근거·주장 범위·해결 상태를 병기한다. | R466. Evidence directness is a claim-level boundary (v54.6) |
| R467 | 1446 | 현행 본문 검토 | 개정 | scaffold를 완성 원고라 부르지 않는다. 내용 검토와 사용자·검색 검증을 단계별로 구분하며 모든 참고 문서에 대규모 인수 인증을 강제하지 않는다. | R467. Structured article drafts cannot be published as completed learning content (v54.6) |
| R468 | 1452 | 현행 본문 검토 | 유지 | 공유 route·학습 상태는 복구 가능하게 하고 부분 자료 실패가 전체 지식을 지우지 않게 한다. | R468. Knowledge route state and partial capability loading must fail soft (v54.6) |
| R469 | 1458 | 현행 본문 검토 | 개정 | 단위별 근거·고유 설명은 유지한다. 고정 corpus 수·모든 단위 별도 web dossier·전체 금융 전파를 절대 완료 조건으로 강제하지 않는다. | R469. 주식·경제·금융·기술 백과사전은 전체 corpus와 Web Research를 별도 인증한다 (v54.6, P910) |
| R470 | 1422 | active | 유지 | 구조·초안과 연구완료·현재성의 증거를 분리한다. | Knowledge research artifacts must preserve completion and currentness boundaries (v54.7) |
| R471 | 1416 | active | 조건부 유지 | 연구순위 계약은 타당하나 승격 체크리스트만으로 예측력을 증명하지 않는다. | Screener Workbench contracts must be the single lifecycle boundary (v54.12) |
| R472 | 1404 | active | 유지 | 부팅 지연 등록과 재진입 누수를 분리하는 측정 설계다. | Browser lifecycle gates must stabilize known boot-delayed timers before leak comparison (v54.12) |
| R473 | 1410 | active | 유지 | 신규 산출물의 계보 누락을 같은 변경에서 막는다. | New public-data artifacts require same-change lineage policy registration (v54.13) |
| R474 | 1382 | superseded | 역사 기록 | R669로 명시 대체되었으며 현재 제품 범위로 중복 집행하지 않는다. | Owner-approved desktop, mobile and tablet scope (v57.38, P1618) |
| R475 | 1398 | active | 조건부 유지 | 두 자리 버전 표기는 내부 명명 선호이며 외부 표준은 아니다. | Release versions use canonical major or two-digit patch notation (v54.17) |
| R476 | 1390 | superseded | 역사 기록 | 데스크톱 전용 전제가 철회되어 R669를 적용한다. | Retired mobile touch-target checks do not block desktop-only releases (v54.17) |
| R477 | 1376 | active | 개정 | 하나의 공통 완료 컷은 서로 다른 시장·발표주기에 성립하지 않으므로 호환 가능한 정보집합으로 한정한다. | Market-sensitive routes consume one evidence-derived market epoch (v54.18) |
| R478 | 1370 | active | 조건부 유지 | 타임라인 보존은 타당하나 서로 다른 시각을 무조건 혼합 리비전 오류로 보지 않는다. | Market-sensitive fields retain one machine-checkable timeline and direction basis (v54.19) |
| R479 | 1364 | active | 조건부 유지 | 필드별 시계는 유지하되 2일·4일·80%는 소스별 근거와 민감도를 가진 내부 정책이다. | Quant rows and rankings preserve separate source epochs and rendered-symbol refresh demand (v54.20) |
| R480 | 1358 | active | 조건부 유지 | 출처·제약 목록은 유용하지만 22개 및 일일 점검은 현재 운영 범위의 선택이다. | Every changing or hardcoded data category has a daily-audited source and limitation contract (v54.21) |
| R481 | 1352 | active | 조건부 유지 | PIT와 부분 구현의 구분은 타당하나 제출일만 아는 자료는 장중 가용성을 보장하지 않는다. | Professional data capabilities are promoted only by artifact-backed partial scopes (v54.22) |
| R482 | 1346 | active | 개정 | 런타임 캐시 등록과 원자 프리캐시를 구분해 R621과 같은 용어로 쓴다. | Runtime-imported modules must enter the service-worker shell in the same change (v54.22) |
| R483 | 1340 | active | 유지 | 모델 의미가 바뀌면 독립 소비자 검사를 함께 갱신해야 한다. | Versioned domain-contract changes update every independent golden gate atomically (v54.22) |
| R484 | 1334 | active | 개정 | 180일 재무 경계는 현재 FY 주기 정책과 충돌하며 픽스처가 옛 임계값을 고정해서는 안 된다. | Factor fixtures carry the same field-family observation epochs as production rows (v54.22) |
| R485 | 1328 | active | 조건부 유지 | 공식 무료 다운로드 활용은 합리적이나 무료·공식이라는 속성이 적합성·이용권을 보장하지 않는다. | Keyless official downloads close critical single-series gaps without relabeling access (v54.22) |
| R486 | 1322 | active | 조건부 유지 | 부팅과 라우트 비용 분리는 타당하나 2.5초·2초는 환경별 제품 예산이다. | Initial paint and synthetic route latency require a browser presentation boundary (v54.22) |
| R487 | 1316 | active | 조건부 유지 | 검증 대상이 실제 커밋과 같아야 하나 모든 문서 버전 갱신의 비용은 별도 평가한다. | Selective releases validate R1 surfaces from the staged tree (v54.22) |
| R488 | 1308 | superseded | 역사 기록 | 데스크톱 전용 집행은 R669로 대체되었다. | Scope gates validate their direct inputs from the committed tree (v54.22) |
| R489 | 1302 | active | 유지 | 브라우저 실행 전 대응 실행파일 설치는 필요한 실행 전제다. | Playwright workflow steps inherit an explicit browser-install prerequisite (v54.22) |
| R490 | 1296 | active | 유지 | 고정 대기보다 실제 비동기 완료 상태를 검증하는 것이 판별력이 높다. | Asynchronous artifact tests wait on runtime-owned settled state (v54.22) |
| R491 | 1290 | active | 조건부 유지 | 같은 커밋 검증 원칙은 타당하나 옛 특정 퀴즈 렌더 검증을 현재 정책으로 재사용하지 않는다. | Browser goldens and renderers are certified from the same committed tree (v54.22) |
| R492 | 1278 | active | 조건부 유지 | 예정일과 실측 발표를 분리하되 다음 일정 전진은 날짜뿐 아니라 발표시각·지연을 반영한다. | Official static release calendars must be date-advanced and source-verified (v54.23) |
| R493 | 1284 | active | 조건부 유지 | 후보 사실의 합집합은 필요하지만 서로 다른 회계 개념의 비교가능성을 먼저 검증한다. | SEC fallback concepts must be unioned before newest-observation selection (v54.24) |
| R494 | 3552 | active | 유지 | r* 추정과 기업 장기 목표를 관측된 현재 실적으로 바꾸지 않는다. | 관측 불가능한 경제변수와 기업 목표는 관계 지도에서도 시점·추정·반증 경계를 보존한다 (v54.25, P937) |
| R495 | 1272 | active | 조건부 유지 | 퀴즈·시뮬레이션 금지는 독자 선호이며 학습효과가 열등하다는 객관적 결론은 아니다. | Learner-first knowledge surfaces use declarative exploration, not quiz prompts (v54.33) |
| R496 | 1266 | active | 유지 | 선택한 개념과 무관한 관측을 근거처럼 연결하는 오류를 막는다. | Dated observations must be scoped to the selected knowledge node (v54.33) |
| R497 | 1260 | active | 조건부 유지 | 실제 소비자 응답 검증은 타당하나 안전한 정성 문장도 근거 없는 사실은 유지할 수 없다. | Public AI chat is certified as a fresh-browser consumer outcome (v54.37, P944) |
| R498 | 1254 | active | 조건부 유지 | 가격 팩터 없는 행을 구분하는 계약은 타당하나 80%가 대표성이나 정확성 기준은 아니다. | Screener factor rows cannot be created by fundamentals alone (v54.37, P945) |
| R499 | 1248 | active | 조건부 유지 | 공시 발견·정정 합성·보유와 거래 구분은 필요하며 법정 제출주기는 별도 확인한다. | Regulatory universes require discovery, fair access, amendment composition and last-known-good preservation (v54.38, P948) |
| R500 | 1242 | active | 유지 | 라우트 수명과 비동기 결과·사용자 입력을 결속하는 경계다. | Knowledge routes load by route-owned capability and preserve interaction state (v54.38, P948) |
| R501 | 1236 | active | 유지 | 원고 길이·구조를 사람 의미검수로 승격하지 않는다. | Structured knowledge depth is not human certification (v54.38, P948) |
| R502 | 1230 | active | 조건부 유지 | 같은 사용자 기능의 화면별 접근성 점검은 타당하나 고정 viewport만으로 전 환경을 인증하지 않는다. | Every golden route belongs to shared viewport and accessibility coverage (v54.38, P948) |
| R503 | 3558 | active | 유지 | 구조적 깊이·현재성·권리·의미 검증의 서로 다른 증거를 보존한다. | reference-depth·currentness·provider-review는 서로 다른 승격 단계로 보존한다 (v54.36, P943) |
| R504 | 1224 | active | 조건부 유지 | 요청 공유·취소 분리는 타당하나 콜드 바이트 예산은 실제 사용 환경으로 정한다. | Browser runtime data uses bounded shards and shared request coalescing (v54.39, P949) |
| R505 | 1218 | active | 유지 | 요약에 필요한 투영과 원문 검증 범위를 분리한다. | Summary-only surfaces consume compact projections, not completion corpora (v54.39, P949) |
| R506 | 1212 | active | 조건부 유지 | 상세 지연 로딩은 합리적 기본값이나 선제 로딩 금지는 측정 결과에 따라 달라질 수 있다. | Detail artifacts belong to the narrowest interaction and retain honest failure state (v54.40, P950) |
| R507 | 1206 | active | 유지 | 미관측·정책 차단·런타임 파생을 서로 다른 상태로 보고한다. | Refresh audits distinguish observed, policy-blocked and runtime-derived categories (v54.41, P951) |
| R508 | 1200 | active | 유지 | 연결 완전성·원고 검수·저장 지속성은 서로 대신하지 못한다. | Rendering, coverage, persistence and publication readiness are separate contracts (v54.42, P952) |
| R509 | 1134 | active | 조건부 유지 | 공시 의미 구분은 유지하고 서사 우선 화면 순서는 사용자 선호로 검증한다. | Learning pages require narrative order, destination consumption and filing-semantic labels (v54.43, P953) |
| R510 | 1140 | active | 유지 | 제공된 시장 해설을 검증된 현재 수치나 순위로 자동 승격하지 않는다. | User-supplied market commentary stays reference-only until a producer reconciles it (v54.44, P954) |
| R511 | 1146 | active | 유지 | 암묵적 대리지표 치환을 막고 필요한 변수의 부재를 드러낸다. | Missing macro transmission variables are blocked, not inferred from proxies (v54.44, P955) |
| R512 | 1152 | active | 조건부 유지 | 결측·리스너 종료 원칙은 유지하되 캐시 등록은 R621의 요청 기반 정책과 구분한다. | Missing numeric observations, news topic suppression and chart observers fail closed together (v54.45, P956) |
| R513 | 1194 | active | 유지 | EFFR·목표범위 및 SA·NSA와 미관측 상태를 구분한다. | Currentness, cancellation, source semantics and stale disclosure share one negative-control gate (v54.47, P957) |
| R514 | 1158 | active | 유지 | 취소 수명·포커스·자료별 coverage 분모를 각각 보존한다. | Cancellation, focus return and coverage denominators are one boundary (v54.48, P958) |
| R515 | 1164 | active | 조건부 유지 | 라우트별 작업 소유권은 합리적이나 공유 자료 선제 로딩의 타당성은 별도 측정한다. | Page hydration must follow route ownership (v54.49, P959) |
| R516 | 1170 | active | 조건부 유지 | 잘못된 보유 맥락 금지는 유지하되 초기 종목 미선택은 제품 흐름 선택이다. | Direct entity routes must start from neutral, accessible empty state (v54.50, P960) |
| R517 | 1176 | active | 조건부 유지 | 시점·결측 보존은 타당하나 macro 기사에서 명시된 실제 종목까지 일괄 제거해서는 안 된다. | Freshness, source precedence and missingness must remain visible across compatibility boundaries (v54.50, P961) |
| R518 | 1188 | active | 개정 | 실제 상장폐지·무가치 자산의 0 평가액까지 불가로 만들지 말고 무효 placeholder와 구분한다. | Portfolio financial values and cross-route detail controls fail closed (v54.54, P962) |
| R519 | 1182 | active | 유지 | 비동기 요청을 실제 사용자 행동에 결속하고 자원 경합을 측정과 구분한다. | Browser network assertions must correlate to the initiating user action (v54.55, P963) |
| R520 | 1104 | active | 조건부 유지 | 현재 사실의 단일 생성 원천은 타당하나 모든 문서 수치 중복 금지는 관리 비용과 비교한다. | Current workspace facts are generated once and historical ledgers are search-only (v54.57, P964) |
| R521 | 1110 | active | 유지 | 훅이 권한·커밋·배포 승인을 스스로 확대하지 않도록 한다. | Agent hooks are portable guardrails and never mutate repository authority state (v54.57, P964) |
| R522 | 1116 | active | 조건부 유지 | 미러 정합과 행동 평가 분리는 타당하나 최소 3개 프롬프트는 충분성 인증이 아니다. | Skills and agent profiles require generated parity plus observable eval inputs (v54.57, P964) |
| R523 | 1122 | active | 조건부 유지 | 드리프트 점검과 중복 알림 방지는 타당하나 모든 변경의 배포 차단 수준은 위험별로 정한다. | Workspace and knowledge drift are push gates with deduplicated operational escalation (v54.57, P964) |
| R524 | 1128 | active | 유지 | 정적 지식 연결성과 의미·원문·현재성 검증을 분리한다. | Structural knowledge completeness and semantic certification are separate state machines (v54.57, P964) |
| R525 | 1078 | active | 조건부 유지 | 실패 일괄 수집·영향 기반 검사는 합리적이나 정확한 필수 단계 수는 저장소 운영 선택이다. | QA는 영향 기반 manifest와 단계별 전수 실패 수집을 사용한다 (v54.58, P965) |
| R526 | 1084 | superseded | 역사 기록 | 가변 브랜치·버전 동등성 방식은 R536으로 대체되었다. | 앱 릴리스와 데이터-only 릴리스는 검증·checkout 경계를 공유하지 않는다 (v54.58, P965) |
| R527 | 1090 | active | 유지 | 설정의 존재와 시각이 붙은 운영 관측을 분리한다. | Endpoint 구성과 현재 운영 증거는 같은 파일에 저장하지 않는다 (v54.58, P965) |
| R528 | 1096 | superseded | 역사 기록 | 수동 전용 배포 전제는 R652로 명시 대체되었다. | Cloudflare 배포는 수동 권한·직렬 ownership·관측·smoke를 함께 가진다 (v54.58, P965) |
| R529 | 1072 | active | 유지 | 실행되지 않는 게이트를 검증망으로 오해하지 않도록 경로를 명시한다. | 모든 CI script는 실행 경로 또는 명시적 퇴역 원장을 가져야 한다 (v54.59, P966) |
| R530 | 1066 | active | 개정 | 허용 용도 단조성은 유지하되 권리·출처·품질·모델 유효성을 단일 등급으로 합치지 않는다. | Evidence allowedUse는 생성 이후 오직 더 제한적으로만 바뀐다 (v54.59, P967) |
| R531 | 1060 | active | 조건부 유지 | 암호화의 사실성은 유지하고 기본 저장 OFF는 개인정보 위험에 대한 제품 선택이다. | 민감 로컬 보존은 기본 OFF·최소화·암호화 정확성을 요구한다 (v54.59, P968) |
| R532 | 1054 | active | 조건부 유지 | 중복 과금 방지는 필요하지만 중복 요청 거부 대신 기존 결과 재사용도 유효한 설계다. | AI quota reservation과 upstream 실행은 하나의 idempotency 경계를 가진다 (v54.59, P969) |
| R533 | 1048 | active | 유지 | 측정 결과는 실제 환경과 리비전에 묶여야 한다. | 성능·운영 측정은 revision·commit·환경·명령·artifact에 묶는다 (v54.59, P970) |
| R534 | 1042 | active | 유지 | 타인의 dirty 변경과 작업 소유 변경의 검증 범위를 구분한다. | QA 영향 범위는 task baseline 또는 명시적 파일 목록으로 결정한다 (v54.59, P971) |
| R535 | 1036 | active | 조건부 유지 | 제품의 non-goal은 정당한 선택이지만 객관적 금융 진리나 법적 면책은 아니다. | 제품 범위·non-goal·trust plane은 구현보다 먼저 계약한다 (v54.59, P972) |
| R536 | 1030 | active | 유지 | 검증된 불변 커밋과 실제 배포 커밋을 일치시킨다. | Pages는 CI가 발행한 불변 SHA attestation만 배포한다 (v54.59, P973) |
| R537 | 1024 | active | 조건부 유지 | 자동·수동 증거 구분은 유지하되 자동화가 검사할 수 있는 대비·접근성 범위를 고정 단정하지 않는다. | 자동 접근성 PASS는 수동 접근성 인증을 대신하지 않는다 (v54.59, P972) |
| R538 | 1016 | superseded | 역사 기록 | 핵심 프리캐시 경계는 R621을 정본으로 사용한다. | Service worker 설치는 작은 핵심 셸만 원자적으로 precache한다 (v54.59, P972) |
| R539 | 1010 | active | 조건부 유지 | 실제 facade와 이관 목표 구분은 타당하며 개수 예산 자체는 내부 유지보수 정책이다. | Compatibility facade의 현재 표면과 목표 표면을 구분하고 확장을 ratchet한다 (v54.59, P972) |
| R540 | 1004 | active | 유지 | 언어에 맞는 경계와 실제 민감 입력으로 redaction을 확인한다. | 비ASCII 민감정보 단위는 ASCII `\b` 경계에 의존하지 않는다 (v54.59, P974) |
| R541 | 998 | active | 조건부 유지 | 비용·범위별 검증 분리는 타당하나 한 번 실행이라는 횟수보다 유효한 증거가 중요하다. | 런타임 상태 요약과 릴리스 전수 감사는 실행 경계와 비용 예산을 공유하지 않는다 (v54.60, P975) |
| R542 | 992 | active | 조건부 유지 | 리비전 간 자동 승격 금지는 타당하나 무관한 변경도 모든 실측 증거를 무조건 무효화할 필요는 없다. | 버전 범프는 revision-bound 실행 증거를 자동 승격하지 않고 무효화한다 (v54.60, P976) |
| R543 | 986 | active | 유지 | 소유권 이관·지연 로딩·레거시 제거는 서로 다른 성과다. | native ownership, lazy delivery, bulk retention은 독립적으로 증명한다 (v54.61, P977) |
| R544 | 980 | active | 조건부 유지 | 실패 그룹 재검사는 합리적이며 의존성 변경 시 기존 PASS도 다시 선택해야 한다. | 최초 browser lifecycle과 실패 group 재검사는 서로 다른 실행 단위다 (v54.61, P978) |
| R545 | 974 | active | 유지 | 실패·미실행·유효한 과거 관측은 다른 상태다. | 관측 생략·실패·유효기간 내 LKG를 서로 다른 운영 상태로 보존한다 (v54.61, P979) |
| R546 | 968 | active | 조건부 유지 | 알림과 복구의 동일 identity는 타당하며 SLO 기간·임계값은 운영 목적에 맞춰 정한다. | 운영 알림 임계값·dedupe·복구 증거는 같은 workflow identity로 수렴한다 (v54.61, P980) |
| R547 | 962 | active | 조건부 유지 | 실행 권한 차단은 필요하며 필요한 조사 실패와 전체 설명 금지는 구분한다. | AI 행동 권한은 모든 provider·quota·retrieval보다 앞선 단일 오케스트레이터 경계다 (v54.62, P981) |
| R548 | 956 | active | 조건부 유지 | 정보가 늘지 않은 소비자의 승격 금지는 타당하나 새 검증 증거를 통한 정당한 재분류는 허용한다. | freshness·LKG·readiness는 producer에서 UI까지 단조롭게 강등된다 (v54.62, P982) |
| R549 | 950 | active | 유지 | 안전 제약과 요청 identity를 캐시 경계에서 보존한다. | 실패 결과는 성공 TTL cache가 아니며 모든 안전 제약은 cache identity다 (v54.62, P983) |
| R550 | 944 | active | 유지 | 지연 생성되는 목적 화면이 선택 identity를 실제 소비해야 한다. | derived route의 선택 state는 owning lazy renderer가 소비할 때까지 보존한다 (v54.62, P984) |
| R551 | 938 | active | 조건부 유지 | 투자 수치의 출처·시점 표시는 유지하며 고정 예제·상수와 현재 주장은 구분한다. | 보이는 투자 숫자는 기준일·출처·허용 용도를 같은 표면에 둔다 (v54.62, P985) |
| R552 | 932 | active | 유지 | 마운트 전 상태 보존과 마운트 후 표시 증거는 다르다. | lazy mount 전 headless 상태 보존과 mount 후 브라우저 가시성을 분리한다 (v54.62, P986) |
| R553 | 926 | active | 조건부 유지 | 숨은 유료 호출 금지는 합리적이나 필요한 무료 자료의 자동 조회 금지는 제품 선택이다. | 기본 route와 정적 카드는 숨은 provider 호출·시점 없는 투자 숫자를 만들지 않는다 (v54.63, P987) |
| R554 | 920 | active | 개정 | 헤드라인 AI 전면 배제는 R617 귀속 허용과 충돌하며 발견·요약·인과 입증을 별도 목적별로 구분한다. | 헤드라인은 발견 근거이지 기사 수준 분석·인과 근거가 아니다 (v54.63, P988) |
| R555 | 914 | active | 유지 | NSA·SA와 동일 행의 가격·공시 출처 권한을 각각 보존한다. | 같은 지표명의 계절조정·비계절조정과 field별 권한을 합치지 않는다 (v54.63, P989) |
| R556 | 908 | active | 조건부 유지 | coverage와 수익확률 구분은 유지하되 모든 체크 충족이 예측적 타당성을 충분히 증명하지 않는다. | 팩터 순위의 confidence는 입력 근거 진단이며 수익확률·매매신호가 아니다 (v54.63, P990) |
| R557 | 902 | active | 조건부 유지 | 관측 health와 설정 구분은 타당하지만 일시 UNKNOWN만으로 전체 기능을 항상 없애는 것은 별도 운영 선택이다. | 공개 AI 경로와 bootstrap payload는 동일한 readiness·byte evidence에서 생성한다 (v54.63, P991) |
| R558 | 896 | active | 조건부 유지 | 공식 발표주기 반영은 타당하며 grace 길이는 실측 배포 지연·일정 변경에 근거한다. | 주간 데이터 freshness는 다음 공식 발표 가능 시각 전까지 release-aware로 계산한다 (v54.63, P992) |
| R559 | 890 | active | 조건부 유지 | 값·표시·발표 일정의 연결은 필요하며 당일 발표시간과 결과 수신 상태도 포함한다. | 새 화면 지표는 sink·source alias·발표 일정까지 같은 변경으로 닫는다 (v54.63, P993) |
| R560 | 884 | active | 유지 | 동시 독자의 불완전 JSON 읽기를 원자 교체로 막는다. | 병렬 검사에 노출된 generated JSON은 완성본 단위로 원자 교체한다 (v54.63, P994) |
| R561 | 878 | active | 조건부 유지 | 공식 자동 수집은 합리적이나 공식성은 해석·이용권·정확성을 자동 보장하지 않는다. | 공개 주기 데이터는 수동 숫자가 아니라 release-aware producer와 실패 가시성으로 닫는다 (v54.63, P995) |
| R562 | 872 | active | 유지 | 상태 승격이 선언·생산·검증의 실제 변화를 함께 반영해야 한다. | producer 자동화 상태와 lineage 회귀 계약은 같은 변경에서 이동한다 (v54.63, P996) |
| R563 | 866 | active | 조건부 유지 | 병합 후 생성과 동일 환경 검증은 타당하나 로컬 producer 금지 범위와 생성기 예외를 명시한다. | 자동 데이터 merge의 마지막 생성물은 current workspace state다 (v54.63, P997) |
| R564 | 860 | active | 유지 | 의미가 같은 체크아웃의 줄바꿈 차이를 크기 드리프트로 오인하지 않는다. | 생성 상태의 텍스트 크기는 checkout 줄바꿈과 무관해야 한다 (v54.63, P998) |
| R565 | 854 | active | 조건부 유지 | 텍스트 정규화 계약은 유효하나 실제 배포 바이트 digest와 정규화 의미 digest를 구분한다. | 텍스트 projection manifest의 digest·bytes는 checkout 줄바꿈에 독립적이어야 한다 (v54.63, P999) |
| R566 | 848 | active | 조건부 유지 | 전체 답변 대신 주장별 강등은 합리적이나 무근거 정성 사실도 유지 대상으로 보지 않는다. | AI 안전·검색·지식 결손은 답변 전체가 아니라 실제 위험·주장 범위에서만 강등한다 (v54.64, P1000) |
| R567 | 840 | superseded | 역사 기록 | 고빈도 refresh의 workspace 생성 결합은 R603으로 대체되었다. | 자동 refresh는 producer가 바꾼 모든 readiness와 generated evidence를 같은 커밋에 수렴시킨다 (v54.64, P1001) |
| R568 | 834 | active | 유지 | 정책 결과와 다음 공식 일정을 별개 근거로 갱신한다. | 출처 세부표시와 공식 발표 일정은 의미를 보존하며 함께 전진한다 (v54.65, P1002) |
| R569 | 828 | active | 유지 | 한 비동기 producer의 완료가 다른 producer의 완료를 보장하지 않는다. | 독립 hydration 경로는 각자의 완성 조건을 기다린다 (v54.65, P1003) |
| R570 | 822 | active | 유지 | 종목·주기·관측과 연구 활용·권리 인증의 차이를 보존한다. | 관측의 종목·주기·출처와 사용 범위를 소비자까지 보존한다 (v54.68, P1004) |
| R571 | 816 | active | 유지 | 시도·관측·실패·캐시·취소의 다른 의미를 유지한다. | 요청·캐시·수집 시도·실제 관측의 수명주기를 분리한다 (v54.69, P1006~P1009) |
| R572 | 810 | active | 유지 | 비교 정의와 숨겨진 정렬값·근거 없는 선물 롤 해석을 구분한다. | 표시·정렬·비교·복귀는 같은 관측과 실제 사용자 문맥을 사용한다 (v54.70, P1010) |
| R573 | 804 | active | 유지 | 순서 불변성과 가용시점·가격 경로를 실제 경계 입력으로 확인한다. | 계산 계약은 경계값·시점·상태 전이를 실제 실행으로 검증한다 (v54.73, P1011/P1012) |
| R574 | 796 | active | 유지 | coverage·개별 유효성·원자료 보존 재현은 서로 대신하지 못한다. | 집합 충족률·개별 유효성·표시·보관 재현을 서로 대신하지 않는다 (v54.74, P1013~P1016) |
| R575 | 790 | active | 유지 | 통화·단위·관측 시계가 다른 값을 암묵적으로 합성하지 않는다. | 금액·관측·근거 계약은 추정으로 빈칸을 채우지 않고 실제 소비 경계를 밝힌다 (v54.75, P1018~P1022) |
| R576 | 784 | active | 유지 | 탐색 관계와 인과·총수익과 순수익 등 서로 다른 의미를 보존한다. | 앱·지식·금융 계산의 경계는 종료·관계 의미·결측·비용 의미를 보존한다 (v54.76, P1023~P1025) |
| R577 | 778 | active | 개정 | 같은 시간창·출처·행 수는 인과 입증이 아니며 R617의 근거부재 공시 정책과 경계를 정리한다. | AI의 분석·검색·응답은 입력 모양이 아니라 추적 가능한 사용 계약으로 승격한다 (v54.76, P1026) |
| R578 | 772 | active | 유지 | API 불변성의 생산자 변경은 실제 소비자 경로까지 함께 이관해야 한다. | private index 전환은 모든 consumer를 resolver 또는 read-only adapter로 함께 이관한다 (v54.76, P1027) |
| R579 | 766 | active | 유지 | 정상 문구 하나의 존재가 모순 문구의 부재를 증명하지 않는다. | producer 상태 vocabulary와 사용자 문구를 같은 실제 렌더에서 검증한다 (v54.76, P1028) |
| R580 | 760 | active | 유지 | 화면과 검색이 같은 관계 식별자를 쓰되 관계 사실성을 별도로 검증한다. | 검색·필터는 렌더러와 동일한 canonical 관계 필드를 사용한다 (v54.76, P1029) |
| R581 | 754 | active | 개정 | cycle 완전성과 관측 현재성을 분리하고 weekend grace 표현을 R646의 liveness 구분과 맞춘다. | 발행 상태는 완전한 cycle tuple과 유효한 관측시각에서만 current가 된다 (v54.76 working tree, P1030) |
| R582 | 748 | active | 유지 | 비동기 늦은 결과·중첩 동작의 소유권을 명확히 한다. | 비동기 fallback·delegated action·route scheduler는 하나의 epoch와 owner를 사용한다 (v54.76 working tree, P1031) |
| R583 | 742 | active | 유지 | 현재 라우트·제품 화면 범위와 증거 수준을 분리해 검사한다. | 브라우저 QA는 canonical route·제품 viewport·settled paint를 검사하고 실행 자원을 분리한다 (v54.76 working tree, P1032) |
| R584 | 736 | active | 유지 | 통화·선택·결측과 실제 렌더 소유권을 소비 경로까지 보존한다. | 사용자 표면은 결측·선택·통화·렌더러 소유권을 producer 계약 그대로 보존한다 (v54.76 working tree, P1033) |
| R585 | 732 | active | 유지 | 외부 동결과 구독자 하나의 실패가 전체 상태 전달을 깨지 않게 한다. | 저장소 불변성과 구독 알림은 바깥 객체 상태나 한 구독자 실패에 의존하지 않는다 (v54.95, P1062) |
| R586 | 728 | active | 개정 | 결측 중립 대치는 금지하되 부분 팩터 재정규화가 다른 모형의 순위를 비교하게 만드는 편향을 다룬다. | 결측 팩터는 중립값이 아니며 순위 분모를 희석하지 않는다 (v54.95, P1063) |
| R587 | 724 | active | 개정 | 출처·시각 분리는 유지하고 1차성·이용권·정확성을 일렬 authority 등급으로 대체하지 않는다. | 출처 등급·관측시각·수집시각·revision은 서로 대신할 수 없다 (v54.95, P1064/P1065) |
| R588 | 720 | active | 유지 | 한 논리 이벤트와 파생 라우트가 하나의 정규화 경계를 사용한다. | 레거시 이벤트와 파생 route는 native 경계에서 한 번만 정규화한다 (v54.95, P1066) |
| R589 | 716 | active | 유지 | 캐시 fingerprint와 영향 범위가 실제 읽는 입력을 포함해야 한다. | QA gate의 실제 읽기·쓰기 범위는 manifest 입력·영향 규칙·격리 경로와 일치해야 한다 (v54.95, P1067) |
| R590 | 712 | active | 개정 | 기술 metadata의 VERIFIED를 사실·인과·투자 적합성 인증과 분리하고 R617과 충돌을 해소한다. | AI decision premise는 common evidence contract의 명시적 사용·권리·revision·freshness를 요구한다 (v54.96, P1068) |
| R591 | 708 | active | 조건부 유지 | 검증된 issuer identity는 필요하지만 기업의 자기 주장 자체를 중립적 사실로 인증하지 않는다. | company-primary 출처는 registry 검증된 issuer identity 없이는 승격하지 않는다 (v54.96, P1068) |
| R592 | 704 | active | 조건부 유지 | 불필요한 write 최소화는 타당하나 무료 한도·15분·상한 숫자는 외부 사양과 실제 경합으로 갱신한다. | fast data plane은 no-op publish와 liveness write를 분리하고 KV budget을 계약화한다 (v54.96, P1069) |
| R593 | 700 | active | 유지 | 같은 실패를 반복 알리지 않고 진단 증거를 유지한다. | 운영 실패 알림은 signature·failed gate·notification budget을 보존한다 (v54.96, P1071) |
| R594 | 696 | active | 조건부 유지 | 기계 PASS와 의미 검수 구분은 유지하나 행별 독해만으로 금융적 타당성 인증을 대신하지 않는다. | 자동 PASS와 line-by-line semantic coverage는 서로 다른 증거다 (v54.96, P1072) |
| R595 | 692 | active | 조건부 유지 | 발행 전 관련 검증·발행 후 같은 SHA 검증은 타당하나 원자 publication의 실제 경계를 명시한다. | Refresh producer는 push 전 fail-closed gate와 exact-SHA attestation을 함께 요구한다 (v54.96, P1073) |
| R596 | 688 | active | 조건부 유지 | 단위와 정본 어휘를 보존하되 바이트 원형 해시와 텍스트 정규화 정책을 별도로 이름 붙인다. | 바이트 계약·정본 어휘·단위 환산은 손 목록과 체크아웃 설정에 의존하지 않는다 (v54.98, P1074) |
| R597 | 684 | active | 유지 | 표시 소유권을 넘길 때 실제 값과 그 계보의 승계를 확인한다. | 값의 표시 소유자는 하나여야 하고, 소유권 이전은 승계 확인을 요구한다 (v54.98, P1074) |
| R598 | 680 | active | 조건부 유지 | 발견 가능한 핸드오프는 유용하나 모든 작은 변경의 중복 보고 비용은 줄일 수 있다. | 완료한 작업은 표준 진입점에서 발견 가능한 핸드오프 기록을 남긴다 (v54.98, P1074) |
| R599 | 676 | active | 유지 | 가드 대상을 질문의 표면 어휘만으로 누락시키지 않는다. | 가드의 스위치는 guard 대상 콘텐츠에서 파생한다 (v54.98, P1075) |
| R600 | 672 | active | 유지 | 자기 생성한 상태를 독립적 검증 증거로 오인하지 않는다. | 감사는 자기 부작용을 검증하지 않는다 (v54.98, P1076) |
| R601 | 668 | active | 유지 | 사용자 출력 주장은 실제 렌더된 결과에서 확인한다. | 사용자 출력 계약은 렌더된 결과로 단언한다 (v54.98, P1077) |
| R602 | 664 | active | 유지 | 같은 라벨의 상이한 계산 정의는 정리하거나 명시적으로 구분한다. | 같은 라벨이 두 정의를 가리키면 정의나 라벨을 하나로 만든다 (v54.98, P1078) |
| R603 | 660 | active | 유지 | 고빈도 휘발값을 안정적 현재상태 문서에 복제하지 않는다. | 생성물은 고빈도 데이터 refresh가 바꾸는 휘발값을 고정하지 않는다 (v54.98, P1079) |
| R604 | 656 | active | 개정 | 현재값처럼 보이는 수치는 금지하되 날짜가 명확한 역사 예제·검증 근거 주석까지 전면 삭제하지 않는다. | 정적 DB는 구성만 보관하고 시점 박힌 수치를 남기지 않는다 (v54.98, P1080) |
| R605 | 650 | active | 조건부 유지 | 주기별 구성 점검은 타당하나 월간·30/90일·일일 점검은 비용·변경빈도로 정당화한다. | 정적 DB는 data-refresh 주기에 맞춰 갱신하거나 명시적으로 보류한다 (v54.98, P1081) |
| R606 | 644 | active | 개정 | GitHub token 이벤트의 보편 명제는 공식 예외와 실행체인 증거를 구별하고 명시 handoff와 분리한다. | 봇이 유발한 이벤트는 워크플로 체인을 잇지 못한다 — 수렴을 명시적으로 구동한다 (v54.99, P1087) |
| R607 | 638 | active | 조건부 유지 | 무한 점유 방지 상한은 합리적이나 timeout 값은 실제 소요·장애 복구 목표로 결정한다. | 모든 워크플로 job은 실행 상한을 선언한다 (v54.99, P1088) |
| R608 | 632 | active | 개정 | 나이를 모르는 캐시를 예외 통과시키지 말고 unknown 시점의 참고자료로 분리한다. | 캐시 폴백은 읽기 시점에 스스로 나이를 판정한다 (v54.99, P1086) |
| R609 | 626 | active | 조건부 유지 | 실패 귀속과 발행 경계 분리는 타당하나 필수·선택 레인마다 발행 차단 목적을 정한다. | 레인 격리는 진단을 위한 것이고, 발행 경계는 fail-closed로 유지한다 (v54.99, P1085) |
| R610 | 620 | active | 유지 | 셸 확장으로 진단 코드와 문자열이 실행되는 위험을 줄인다. | 진단·요약 스텝은 셸 확장을 거치지 않는 파일에서 실행한다 (v54.99, P1083) |
| R611 | 614 | active | 조건부 유지 | 클라이언트별 payload fixture는 타당하며 지원 버전·형태의 범위를 함께 선언한다. | 클라이언트별 훅 페이로드는 각각 픽스처로 고정한다 (v54.99, P1084) |
| R612 | 608 | active | 유지 | 설정 이름·용도·결손 영향과 실제 provisioning 상태를 분리한다. | 운영자 프로비저닝 경계는 문서-계약으로 검사한다 (v54.99, P1089) |
| R613 | 602 | active | 개정 | 1차 출처가 살아 있다는 사실만으로 stale 해제는 불가하며 최신 발표의 값·시점 증거가 필요하다. | 발행 산출물은 값·단위·시각·어휘가 스스로 정합해야 한다 (v55.01, P1090~P1095) |
| R614 | 596 | active | 개정 | 비율의 분자≤분모는 부분/전체 비중에만 성립하며 부채/자본 등 일반 ratio에는 성립하지 않는다. | 발행 산출물의 의미 계약은 소비자·계보·만료까지 닫는다 (v55.02, P1096~P1108) |
| R615 | 590 | active | 조건부 유지 | 참조·측정면·만료 계약은 타당하나 새 측정면의 WARN 유예는 책임자·기한·위험별로 제한한다. | 참조·측정면·퇴역은 발행 시점에 함께 닫는다 (v55.03, P1109~P1114) |
| R616 | 584 | active | 유지 | 자기 정합 외에 실제 렌더 경로의 값·계보 정합을 요구한다. | 정합은 화면이 실제로 읽는 경로에서 성립한다 (v55.04, P1116~P1119) |
| R617 | 578 | active | 개정 | 명백한 오류뿐 아니라 필수 증거 부재도 해당 주장 보류 사유이며 귀속은 사실·인과 검증의 대체물이 아니다. | 사설 도구의 경계는 결과를 막지 않고 밝힌다 (v55.05, P1120~P1122) |
| R618 | 572 | active | 조건부 유지 | 재발 근거·기한은 유용하나 문서 인용과 기계 통과가 규칙의 객관적 타당성을 증명하지 않는다. | 원장 루프는 서술이 아니라 기계로 닫는다 (v55.06, P1123~P1125) |
| R619 | 566 | active | 조건부 유지 | 같은 의미의 재구현 축소는 합리적이나 줄 수 순증 금지가 올바른 설계를 막지 않게 한다. | 같은 의미의 구현은 하나만 둔다 (v55.07, P1126) |
| R620 | 560 | active | 개정 | LOC 래칫만으로 분해를 강제하면 압축·미세 모듈화를 유도하므로 비용·결합도·런타임 지표와 함께 본다. | 분해 압력은 벽이 아니라 래칫이다 (v55.08, P1127) |
| R621 | 554 | active | 조건부 유지 | 부팅 필수 프리캐시는 타당한 기본값이나 1~12개와 설치 실패확률 비례는 내부 예산·가정이다. | 프리캐시는 부트 필수분만, 나머지는 요청 기반 런타임 캐시다 (v55.15, P1134) |
| R622 | 548 | active | 조건부 유지 | 클래식 스크립트 실행순서 보존은 타당하며 module·async 전환은 별도 의미 변경으로 판단한다. | 인라인 코드의 추출은 실행 "위치"를 보존한다 (v55.16, P1135) |
| R623 | 542 | active | 유지 | 같은 식별자 집합의 정본과 의도적으로 다른 순서를 구분한다. | 같은 집합을 여러 곳에 손으로 적지 않는다 — 순서까지 파생시킨다 (v55.18, P1137) |
| R624 | 536 | active | 조건부 유지 | 함수 owner 단일화는 유용하며 의도된 확장·상태 공유와 같은 것으로 강제하지 않는다. | 전역은 하나의 구현만 가진다 — 그리고 로드 순서는 계약이다 (v55.19, P1138) |
| R625 | 530 | active | 유지 | 실제 언어 입력·양성 및 음성 대조가 검출기의 공백을 드러낸다. | 픽스처가 검출기의 언어를 대신 맞춰주면 그 검사는 아무것도 검사하지 않는다 (v55.20, P1139) |
| R626 | 524 | active | 개정 | 필드별 소유권 원칙은 유지하되 rebase 명령·자동 push 재시도 서술을 현재 main merge 흐름과 맞춘다. | 생성 산출물의 병합은 필드 소유권으로 결정한다 (v55.21, P1141) |
| R627 | 518 | active | 유지 | 설정·코드 존재와 실제 도달 가능한 기능 제공을 구분한다. | 선언된 자격증명·기능은 도달 가능한 경로가 증명되기 전까지 제공된 것으로 취급하지 않는다 (v56, P1151~P1155) |
| R628 | 512 | active | 조건부 유지 | 결측과 0 구분은 유지하며 NaN/null sentinel 선택과 모든 결측의 일괄 차단은 범위별 정책이다. | 결측은 조건도 구간도 관측값도 만족시키지 않는다 — 경계에서 `Number(null)===0`을 먼저 막는다 (v56.02, P1164) |
| R629 | 506 | active | 유지 | 미설정·무효·실측 0의 의미가 저장 경계에서 합쳐지지 않게 한다. | 미설정 입력을 0으로 직렬화하지 않는다 — 0이 값을 뜻하는 필드와 미설정 필드를 타입으로 구분한다 (v56.14, P1176) |
| R630 | 500 | active | 유지 | 정체성 해시는 실제 의존 입력을 반영하고 무관한 표시 갱신을 제외한다. | 식별자·정체성 해시는 그 대상의 입력에서 파생한다 — 표시·overlay 파생값을 넣지 않는다 (v56.15, P1177) |
| R631 | 494 | active | 개정 | 입력 선언 외에 의존성·표본오차·tail 안정성·추정법 가정을 포함하고 내부 점검 통과를 인증으로 부르지 않는다. | 성과·위험 결과는 측정 경로·분모·현금·RF·표본을 선언하지 않으면 인증하지 않는다 (v56.17, P1182) |
| R632 | 488 | active | 유지 | 선언 입력의 writer와 영구 저장 성공 확인이 실제 사용 경로에 있어야 한다. | 선언 입력에는 writer가 있어야 하고, 저장 경로는 durable ack를 버리지 않는다 (v56.19, P1187) |
| R633 | 482 | active | 개정 | 기사 5건이 대표성·유효 표본을 보장하지 않으므로 사건 중복·출처 편향과 추정 목적을 구분한다. | 뉴스 감성·위험은 최소 표본을 채우기 전 분석 결과로 발행하지 않는다 (v56.56, P1284) |
| R634 | 476 | active | 조건부 유지 | stale 우회 방지는 유지하되 hard FAIL은 관측 현재성·producer liveness·배포 위험을 구분해 적용한다. | live-core 신선도 감사에는 stale 데이터를 통과시키는 실행 모드가 없어야 한다 (v56.56, P1283) |
| R635 | 470 | active | 조건부 유지 | 다른 모델·소표본 결과를 현재 선으로 합치지 말고 과거 원자료는 버전과 함께 보존할 수 있다. | 저장 뉴스 점수 이력은 현재 모델의 충분한 표본 증거가 있어야 차트에 남는다 (v56.57, P1285) |
| R636 | 464 | active | 유지 | 실패 진단 전체와 민감정보 보호를 함께 보존한다. | 실패한 QA 출력은 비밀을 마스킹한 run별 전체 증거로 보존한다 (v56.57, P1286) |
| R637 | 456 | superseded | 역사 기록 | 휴장 SLA 예외 제거는 R641로 대체되었다. | live-core freshness는 시장 휴장으로 SLA를 넘겨 통과하지 않는다 (v56.58, P1287) |
| R638 | 450 | active | 개정 | 레거시와 같은 최소 수를 쓰는 것은 일관성이지 기사 5건의 통계적 충분성 근거는 아니다. | legacy 뉴스 의사결정 소비자도 공통 최소 표본을 강제한다 (v56.58, P1288) |
| R639 | 444 | active | 유지 | 실패 원인을 조사할 증거를 비밀 없이 제한된 형태로 남긴다. | 실패한 market-snapshot 주기는 비밀 없이 재진단 가능한 bounded artifact를 남긴다 (v56.59, P1289) |
| R640 | 438 | active | 조건부 유지 | publication 12시간은 서비스 생존 목표이며 관측의 시장상 현재성과 다른 필수성·비용을 가진다. | snapshot promotion requires a fresh published artifact in every market session (v56.60, P1290) |
| R641 | 432 | active | 조건부 유지 | 동일 liveness 정책 집행은 가능하나 휴일의 최신 종가 자체를 오래된 관측으로 오인하지 않는다. | browser decisions and operations status use the same strict live-core freshness boundary (v56.61, P1291) |
| R642 | 424 | superseded | 역사 기록 | 미래·무효 시각의 우선 분류는 R647로 대체되었다. | future snapshot timestamps never report current or pass promotion (v56.61, P1292) |
| R643 | 418 | active | 개정 | BOK 60일 고정 나이보다 실제 다음 결정·발표 일정에 따른 현재성 판정이 필요하다. | central-bank policy audit requires current Fed and BOK evidence together (v56.61, P1293) |
| R644 | 412 | active | 조건부 유지 | URL 보안과 읽을 수 있는 출처명 분리는 타당하나 공식 allowlist 자체가 내용 검증은 아니다. | macro calendar source labels are separate from safe official links (v56.61, P1294) |
| R645 | 404 | superseded | 역사 기록 | 미래 timestamp 처리는 R646을 정본으로 사용한다. | future generatedAt never makes browser market data fresh (v56.61, P1295) |
| R646 | 398 | active | 조건부 유지 | 12시간 liveness와 observation cadence를 분리한 수정은 타당하나 1ms 미래 차단에는 시계 신뢰 가정을 명시한다. | live-core freshness uses a fixed millisecond-precision 12-hour budget (v56.61, P1296) |
| R647 | 392 | active | 유지 | 강제 상태가 무효·미래 발행 시각을 성공으로 바꾸지 못하게 한다. | future and malformed timestamps outrank forced refresh audit statuses (v56.61, P1297) |
| R648 | 386 | active | 조건부 유지 | 공식 캘린더 근거는 필요하나 정확한 URL 문자열 일치만으로 실제 내용 일치를 인증하지 않는다. | FOMC schedule alignment requires the canonical official Fed calendar source (v56.61, P1298) |
| R649 | 272 | active | 유지 | 상태 sidecar의 성공 시각이 발행 산출물의 시각을 대신하지 못한다. | refresh freshness requires the published snapshot's own generatedAt (v56.61, P1300) |
| R650 | 278 | active | 유지 | 예정일이 지났다는 사실과 실제 발표의 관측은 논리적으로 다른 사건이다. | A passed macro schedule date is not evidence of a completed release (v56.62, P1301) |
| R651 | 284 | active | 유지 | 의존 producer와 소비자 순서가 한 번의 생성으로 수렴해야 한다. | Generated knowledge builders run before their downstream consumers (v56.68, P1306) |
| R652 | 290 | active | 유지 | 동일 CI 증거와 확인 가능한 복구 대상을 배포 경계에 둔다. | Worker auto-deploys require exact CI evidence and a verified rollback target (v56.69, P1307) |
| R653 | 296 | active | 조건부 유지 | 누적 변경·현재 배포 ancestry 검증은 타당하나 R691의 영향 없는 후속 main 허용과 용어를 맞춘다. | Worker auto-deploy must recover coalesced changes from the live source SHA (v56.70, P1308) |
| R654 | 302 | active | 조건부 유지 | 소유 공시와 분기 보유주기의 분리는 타당하며 월요일 정기 실행은 비용 최적화 정책이다. | SEC ownership polling and 13F row imports use separate, semantic cadences (v56.71, P1309) |
| R655 | 380 | active | 조건부 유지 | 격리 후보·사람 승인·계보는 타당하나 PR 전용 정책은 현재 main 작업 흐름과 함께 설명한다. | Generated knowledge candidates preserve exact provenance and require human review (v56.72, P1310) |
| R656 | 374 | active | 조건부 유지 | 검증 약화에 대체 검사를 요구하는 것은 타당하나 특정 6개 주간 묶음은 운영 선택이다. | CI meta-gate downgrades require a complete weekly backstop (v56.72) |
| R657 | 308 | active | 조건부 유지 | UNKNOWN을 복구로 보지 않는 것은 타당하나 2세션·24시간·80%는 서비스별 내부 경보 임계다. | Operator alerts preserve explicit evidence and fail closed (v56.73, P1311) |
| R658 | 314 | active | 조건부 유지 | 사용량의 별도 인증·공개 제한은 합리적이나 비공개 필드 범위와 32자는 위협모델 기반 정책이다. | Operator AI usage evidence stays authenticated and private (v56.74, P1312) |
| R659 | 320 | active | 유지 | 관측 소스·수신 목적·비밀의 전송 경계를 보존한다. | Operator alert collectors preserve source, market, and privacy boundaries (v56.75, P1313) |
| R660 | 326 | active | 조건부 유지 | 격리 checkout 외부 쓰기 차단은 타당하며 모든 symlink 금지는 더 강한 내부 안전 선택이다. | Knowledge candidate builders cannot follow symlinks outside their isolated copy (v56.76, P1314) |
| R661 | 332 | active | 유지 | 개인자료 백업의 포함 범위와 잠금·저장 성공 상태를 숨기지 않는다. | A personal-data export carries every personal section, or says what it omits (v56.77, P1316) |
| R662 | 338 | active | 유지 | 현재 소유자의 값·단위·방향 및 참고 문헌을 표시와 연결한다. | Visible facts are derived from their owner, not restated in static copy (v56.77, P1315) |
| R663 | 344 | active | 조건부 유지 | 정확한 등록 일치와 비추측은 유지하되 하나의 공급자식 문자열이 영구 instrument identity는 아니다. | One instrument, one canonical symbol across route, quote request and screener (v56.78, P1317) |
| R664 | 350 | active | 개정 | 필터도 선택 집합을 바꾸므로 의사결정과 무관하다고 단정하지 말고 reference 추정의 선택 편향을 밝힌다. | Reference-only filters use plausibility-checked reference values, not decision-grade gates (v56.78, P1318) |
| R665 | 368 | active | 조건부 유지 | 접근성 있는 설명은 필요하나 모든 요소에 같은 키동작·고정 viewport만 적용하는 것은 충분하지 않다. | Explanations are reachable by pointer and keyboard, fully on screen (v56.78, P1320) |
| R666 | 362 | active | 유지 | 퇴역한 페이지의 코드·연결도 함께 닫되 기존 링크 별칭을 보존한다. | A removed route is removed everywhere (v56.79, P1321) |
| R667 | 356 | active | 조건부 유지 | 메타데이터와 실행 증거 분리는 타당하며 400자 한도는 문서 관리 선호다. | Ledger frontmatter is metadata, not an evidence log (v56.79) |
| R668 | 266 | active | 개정 | 값 우선 고정 순서는 제품의 결론 우선 원칙과 충돌하며 요약 종류·독자 과제로 순서를 정한다. | First screen shows values before summaries; blocked summaries collapse and name the cause (v56.80, P1322) |
| R669 | 260 | active | 조건부 유지 | 동일 정보의 반응형 제공은 정당한 범위 선택이며 대표 해상도 PASS가 전 기기 인증은 아니다. | Responsive scope follows the current owner decision (v57.38, P1618) |
| R670 | 254 | active | 개정 | 직전 미국 종가는 미국 일봉 지표의 기준으로 한정하고 한국·선물·FX·암호자산의 고유 기준과 지연을 따로 정의한다. | Reference descriptions use the latest completed US regular close and say so (v56.81, P1328) |
| R671 | 248 | active | 조건부 유지 | 관측·달력 기반 현재성은 유지하되 5개 라벨은 제품 어휘이고 대표 관측 하나로 전 자료를 인증하지 않는다. | Currentness labels come from observations and the calendar, via one presenter (v56.81, P1326) |
| R672 | 242 | active | 조건부 유지 | 한국 테마의 사용자 기능 지위와 정본은 유지하되 수작업 소속이 객관적 노출량을 증명하지 않는다. | Korean themes are user content with one label owner (v56.81, P1327) |
| R673 | 236 | active | 조건부 유지 | QA와 사용자 코드 분리는 유용하지만 가벼운 제품 자체진단까지 일괄 금지할 필요는 없다. | QA and self-audit machinery stays out of the user runtime (v56.82, P1329) |
| R674 | 230 | active | 유지 | 배포 권한이 있는 실행은 출처 저장소·이벤트를 검증해야 한다. | Privileged workflow_run deploys act only on pushes to this repository (v56.83, P1334) |
| R675 | 224 | active | 유지 | 테스트가 직접 호출한다는 사실은 사용자 경로의 도달성 증거가 아니다. | Initializers are reachable from a route or event, not only from tests (v56.84, P1339) |
| R676 | 218 | active | 조건부 유지 | 소유자 결정의 공유 정본은 정당하나 객관적 사실·법·표준과 같은 불변 근거로 분류하지 않는다. | Owner decisions and the change flow are shared repository state (v56.85, P1343) |
| R677 | 212 | active | 유지 | 수집 버킷과 실제 관측 세션의 다른 정체성을 구분한다. | Observation identity precedes collection chronology (v56.87, P1349) |
| R678 | 206 | active | 유지 | 자료 잠금·비동기 수명·영구 저장과 평가 근거가 일관된 경계를 사용한다. | Financial security follows purpose and asynchronous lifetime (v56.87, P1350) |
| R679 | 200 | active | 유지 | coverage·상대강도·점수는 그 정의보다 강한 매매·경기 의미를 갖지 않는다. | Presentation cannot strengthen evidence meaning (v56.87, P1352) |
| R680 | 192 | superseded | 역사 기록 | 공유 예산 경계는 R681로 대체되었다. | Budget scope, reservation and invoice remain distinct (v56.87, P1353) |
| R681 | 186 | active | 개정 | 월 20달러는 소유자 예산이며 shared Worker 원칙과 무료 Workers AI 번역 예외를 함께 명시한다. | All AIO AI shares one metered server credential boundary (v57.06, P1421) |
| R682 | 178 | retired | 역사 기록 | 개인 provider key 경로가 퇴역했으므로 현재 기능의 요구사항으로 집행하지 않는다. | Distinguish operator artifacts from optional personal provider queries (v57.06, P1422) |
| R683 | 172 | active | 유지 | 기간·세션·가치 기준 라벨을 실제 계산 정의에서 파생한다. | 기간·기준일 라벨은 계산에서 파생 (v57.28, P1510) |
| R684 | 166 | active | 조건부 유지 | 본문·제목의 직접 근거는 필요하나 문맥상 명시된 기업과 사건을 단순 키워드 규칙으로 보장할 수 없다. | 내용 분류의 근거는 본문 텍스트 (v57.28, P1511) |
| R685 | 160 | active | 유지 | 표·결과 수·이어보기의 집합과 차이를 일관되게 표시한다. | 한 화면의 결과 수·표·다음 링크는 같은 집합 (v57.28, P1512) |
| R686 | 154 | active | 조건부 유지 | 같은 증권 비교는 단위 검증에 유용하나 주식종류·통화·옵션·공시 범위가 먼저 호환되어야 한다. | 공시 금액은 동일 증권 간 단위를 대조하고, 미연결은 0이 아니다 (v57.28, P1513) |
| R687 | 148 | active | 유지 | AI의 현재 수치가 화면과 같은 관측 정보집합을 사용해야 한다. | AI 문맥의 현재 수치는 화면과 같은 기준 (v57.28, P1514) |
| R688 | 142 | active | 조건부 유지 | 같은 제품 정의의 일관성은 필요하나 학문적 복수 정의는 이름·가정으로 구분할 수 있다. | 같은 개념은 레슨·노트·사전·도움말에서 한 정의 (v57.28, P1515) |
| R689 | 136 | active | 유지 | 관측과 가능한 해석을 분리해 다른 지표의 판정을 전이하지 않는다. | 관측 사실과 해석을 문장 안에서 분리 (v57.28, P1516) |
| R690 | 130 | active | 유지 | PASS의 실제 검사 범위와 검증한 커밋 내용을 결속한다. | QA 증명은 실제 검사 범위·내용과 커밋 전체 index에 결속 (v57.29, P1518) |
| R691 | 124 | active | 유지 | 배포 plane의 입력이 같으면 무관한 후속 main 변경은 별도로 판단한다. | A newer main is stale for a Worker plane only when it changes that plane's deployment inputs (v57.30, P1520) |
| R692 | 118 | active | 유지 | 보류 사유는 모든 금액 기반 소비자에 일관되게 적용해야 한다. | A figure that is withheld is withheld at every consumer (v57.30, P1522) |
| R693 | 112 | active | 조건부 유지 | 무근거 확률·지시 금지는 타당하나 인용의 존재만으로 확률·초과수익을 정당화하지 않는다. | Visible text states the observed condition, not an instruction or an unsourced probability (v57.30, P1523) |
| R694 | 106 | active | 개정 | 한 캘린더 원칙은 유지하고 미등록 연도 weekday 지연 계산과 R605 unknown 원칙의 적용 범위를 명시한다. | The domain layer sits below the AI layer, and one calendar answers every session count (v57.30, P1533) |
| R695 | 100 | active | 유지 | 같은 임계값의 소유자·사본 검증은 일관성 장치이며 임계값 유효성 증거는 별도로 둔다. | A threshold that drives an alert has one owner and pinned copies (v57.30, P1534) |
| R696 | 94 | active | 유지 | 엔진 토큰이 의도치 않은 사용자 의미로 렌더링되지 않게 한다. | An internal code is not reader text (v57.30, P1535) |
| R697 | 88 | active | 개정 | 기술적 검증이 개인화 지시를 허가하지 않으며 기술·서술 지표는 예측력 없이도 정의를 공개해 표시할 수 있다. | A reader sees measured conditions, never a grade, an unvalidated sum or an instruction (v57.30, P1538) |
| R698 | 82 | active | 조건부 유지 | 개인화 실행 지시 금지는 제품 경계이며 문장 단위 삭제 후 문맥·부정·조건 관계를 다시 확인한다. | An AI answer is filtered by sentence, and a personalized directive is never confirmed (v57.30, P1539) |
| R699 | 76 | active | 유지 | 인용한 원장 ID의 존재를 확인하되 존재 자체를 근거의 품질로 오인하지 않는다. | A cited ledger id must exist (v57.30, P1545) |
| R700 | 70 | active | 조건부 유지 | 한국어 조사 품질 규칙은 합리적이나 코드·약어의 발음 예외를 포함해야 한다. | 템플릿 슬롯 뒤 조사는 받침으로 고른다 (v57.31, P1592) |
| R701 | 64 | active | 유지 | 일부 필수 게이트 성공과 전체 서비스 정상은 별개 주장이다. | 운영 게이트와 전체 건강 상태 분리 (v57.32, P1596) |
| R702 | 58 | active | 조건부 유지 | 정정·원본 보존은 타당하나 재전송 기사가 통계적으로 독립된 사건이 되지는 않는다. | 뉴스 원본 식별·변경 이력 보존 (v57.33, P1601) |
| R703 | 52 | active | 유지 | 한 입력·한 owner와 테마 전환의 독립성을 보존한다. | 작은 UI 조작과 색 테마의 실행 계약 (v57.34, P1604) |
| R704 | 46 | active | 유지 | 선언한 사용자 표면이 실제 존재하는지 확인한다. | Declared native surfaces must exist (v57.47, P1667) |
| R705 | 40 | active | 조건부 유지 | 퇴역 writer 정리는 타당하며 공유·향후 도달 경로가 있는 코드는 소유 범위를 검토한다. | Retiring a surface retires its writers (v57.47, P1670) |
| R706 | 34 | active | 개정 | 10/30은 표시정책이며 비중첩도 독립성을 보장하지 않으므로 정밀도·의존성·선택과정·대조 분모를 추가한다. | Past frequencies need non-overlapping cases and a sample floor (v57.79, P1824) |
| R707 | 28 | active | 개정 | 2배 noise·5세션·고정 band는 경험칙이며 통계 유의성이나 경제적 최적 기준으로 승격하지 않는다. | A judgement needs a noise buffer, a recent-move check and its window (v57.81, P1829) |
| R708 | 22 | active | 개정 | 고정 VIX25·HY450·200일선 계약과 선정 급락창 재생은 자기 규칙 일관성 검사이며 임계값의 금융적 유효성·PIT·예측력 검증을 대체하지 않는다. | 판정 규칙은 급변 구간 재생을 통과한다 (v57.83, P1853) |
