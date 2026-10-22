# 과거 발견의 상태 연결

A01–A27은 누적 발견 전량이 아니다. 아래 항목은 과거 입증·정적 후보·의견을 보존하는 연결표이며 합산 결함 수로 쓰지 않는다. 최신 지속 여부를 확인하지 않은 항목은 해결로 간주하지 않는다. 문서 안의 세부 기각·미확정 후보는 원문의 판정을 따른다.

**10/22 후속:** C03/C04/C06은 현행 동일 SHA의 순수 모듈로 지속 재현, D4는 공급자 본문 중단 fixture에서 지속 재현, BND-01은 목록 전환/삭제/거절 대조로 지속 재현했다. C13은 고정/현행 fallback VM 반례를 재현했으나 일반 사용자 null 입력의 현재 도달성은 미인증이다. 아래 연결표는 통합 당시 역사적 상태를 보존하며, 이 항목들의 최신 상태는 [후속 핸드오프 표](./HANDOFF.md#1022-이어서-확인보강한-항목)와 [후속 마감](./reviews/remaining-20261022/CLOSEOUT.md)을 우선한다. 원래 JSON의 과거 판정을 소급 수정하지 않는다.

| 과거 ID | 내용 | 통합 상태 | 근거·경계 |
|---|---|---|---|
| C01 / F01 | 검색 clear 후 지연 응답 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261018/REPRODUCED.md) — 검색 clear race와 관심목록 저장 대상 race는 별개 |
| C02 | QA 의존 입력 | COVERED_BY_A06 | [원문](./evidence/20261018/REPRODUCED.md) — 현행 gate로 옮겨 재현 |
| C03 | NOT 입력 identity | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261018/REPRODUCED.md) — 결과와 입력 식별자 불일치 |
| C04 | 상수 팩터 독립성 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261018/REPRODUCED.md) — 분산0과 무상관 구별 |
| C05 | 미연결 regime hold 시계 | RETIRED_CODE | [원문](./evidence/20261018/REPRODUCED.md) — 후속에서 코드 삭제 확인 |
| C06 / D1 / F-FIN-01 | 가격 필드 정규화 누락 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261019/FINANCIAL.md) — PER·보유 평가의 같은 클래스 |
| C07 | 빈 이익의0% 표시 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261018/REPRODUCED.md) — 결측과 실제0 구별 |
| C08 | 상대 차트 날짜 결합 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261018/REPRODUCED.md) — 원가손익 기간 창작과 별개 |
| C09 | SW 타 앱 캐시 삭제 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261018/REPRODUCED.md) — 실제 피해는 미측정 |
| C10 | 숨김 텍스트 성공 판정 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261018/REPRODUCED.md) — 가시성 oracle |
| C11 | 실질금리 설명 부호 | COVERED_BY_A03 | [원문](./evidence/20261018/REPRODUCED.md) — A03로 포함 |
| C12 | 금리 결측 예외 | COVERED_BY_A02 | [원문](./evidence/20261018/REPRODUCED.md) — A02로 포함 |
| C13 | 차트 fallback null→0 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261018/REPRODUCED.md) — CDN 실패 격리 반례 |
| C14 / CI-C8 | CSP 수집 경로 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261018/REPRODUCED.md) — sink 수를 취약점 수로 확대 금지 |
| D2 | 테마 종가/live 혼합 | PAST_STATIC_RECHECK_NEEDED | [원문](./evidence/20261018/DATA-AI.md) — 당시 정적 caller 확인 |
| D3 | 유니버스 밖 종목의 세션 캐시 | PAST_STATIC_RECHECK_NEEDED | [원문](./evidence/20261018/DATA-AI.md) — 주기·revision 실효 경계 |
| D4 | relay 불확실 실패의 예약 해제 | PAST_STATIC_RECHECK_NEEDED | [원문](./evidence/20261018/DATA-AI.md) — OpenAI 월 예산과 별개 |
| D5 / D6 | 권리·허용 용도 전달 | POTENTIAL_REACHABILITY_OPEN | [원문](./evidence/20261018/DATA-AI.md) — 당시T3 차단·도달성 미확정 |
| M1 / M2 | 캐시 소유권·AI/UI 의존 | CONSIDER | [원문](./evidence/20261018/DATA-AI.md) — 유지보수 의견 |
| CI-C1..C7 | CI별 oracle·쓰기 부작용 | PAST_FINDINGS_RECHECK_NEEDED | [원문](./evidence/20261018/TOOLING-CI-1.md) — 60대상 중25 FULL로 정정 |
| UI-01 | 선수 레슨 소실 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261019/UI-PAGES.md) — D6의 D2/D3 연결 |
| UI-02 | 종목 손익의 통화 불일치 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261019/UI-PAGES.md) — domain E01 해소와 별개 UI |
| UI-03 | 스크리너 설명 signature | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261019/UI-PAGES.md) — A12 inspector와 별개 |
| UI-04 | 산업 지도 선택 소실 | PAST_BROWSER_RECHECK_NEEDED | [원문](./evidence/20261019/UI-PAGES.md) — 과거 브라우저와 최신 증거 구별 |
| UI-05 | 13F 혼합 분기 비교 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261019/UI-PAGES.md) — 같은 reportPeriod 비교 필요 |
| BND-01 | 비동기 관심목록 저장 대상 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261019/BOUNDARIES.md) — 검색 후보 표시 race와 별개 |
| LD-01 / LD-02 | 한국 결측·KST 실적 날짜 | COVERED_BY_A05_A04 | [원문](./evidence/20261019/LEGACY-DATA.md) — A05/A04로 포함 |
| M01 / M02 / M03 | 거시3건 | LAST_REPRO_V5852_RECHECK_NEEDED | [원문](./evidence/20261019/MACRO-MARKET.md) — 최종 재현v58.52, 최신 지속 재검증 |
| F-DELTA-01 | 지수 이익의 만료 계약 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261021/FINANCIAL-DELTA.md) — 현재 실제 stale 발생 미확인 |
| I01 | 과거 표본 충돌 유실 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261021/INTERPRETATION.md) — 요약·AI 경계 |
| I02 | 분기 개수의 비용 최적성 표현 | CONSIDER | [원문](./evidence/20261021/INTERPRETATION.md) — 의견/외부 실증 미검증 |
| trade-journal follow-up | 매매일지 손익·현금 설명 | PAST_REPRO_RECHECK_NEEDED | [원문](./evidence/20261021/UI-DELTA.md) — A09/A10과 다른 consumer |

이름이 비슷해도 서로 다른 producer/consumer의 오류는 합치지 않는다. 원장 오인증7행은 후속 정정 완료이며 R719 삭제 미검출 gate 결함은 별도 미해결이다. 관련 선행 자료 E01–E08은v57.98에서 해당 반례가 해소됐고, 실제 DOM/공급자/투자 정확도 인증은 아니다.
