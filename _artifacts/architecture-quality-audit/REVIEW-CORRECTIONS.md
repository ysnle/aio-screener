# 핸드오프 재검토·정정 기록

검토일: 2026-10-22 KST. 대상은 날짜별 Architecture 감사5개 폴더 및 연결된 선행 핸드오프다. 제품 전체의 재감사가 아니라 **보고 자료의 주장·근거·정합성·경로**를 점검했다. 동일 모델의 별도 맥락 검토3개와 root 통합 검증이므로 independence는 limited다.

## 바로잡은 내용

| 항목 | 확인한 문제 / 정리 | 상태 |
|---|---|---|
| 전문 검토 수 | 20261018 TOOLING의 ‘CI60개 전문’은 독립 TOOLING-CI-1 및 TSV의25 FULL/35 NOT_READ와 달랐다. ‘60대상 중25전문·35미독’으로 정정했다. | 문구 수정, 원본ZIP 보존 |
| 과거 발견 누락 오해 | 최신27개 묶음은 누적 전량이 아니다. 과거 C/D/UI/M/LD/I 및 도구 항목의 포함·별도 잔여·후보·의견·코드 은퇴를 연결했다. | FINDINGS-HISTORY 및 section index 작성 |
| 원장 오인증 | 과거 FULL 승격7행은 당시 문제였고 이미 후속에서 정정됐다. 새 미해결로 합산하지 않는다. | 정정 이력으로 유지 |
| 동일 원인 중복 | FY의 domain/UI/browser, 계좌β의 현금/FX 반례는 같은 원인 묶음으로 보존한다. 섹터 분모·원가 통화·30일 기간 창작은 다른 consumer/산출물이다. | 중복 합산 방지 |
| issuer 근거 | CIK 정본 불일치11개, 공식 다른 법인3개, consumer 재현HWM1개를 구별한다. 나머지8개를 확정 오연결로 올리지 않는다. | 주장 범위 명시 |
| 옛 해소 판정 | v57.98 E01–E08의 해당 반례 해소와 이후 다른 UI의 결함은 양립한다. E08은 실제 DOM 계좌 입력을 실행하지 않았다. | REF·consumer·증거 수준 보존 |
| 거시3건 | M01/M02/M03의 마지막 별도 재현은v58.52다. v58.59에서 새 실행한 것으로 올리지 않는다. M01을 전 앱 중단으로 확대하지 않는다. | 최신 지속 여부 재검증 필요 |
| 운영 상태 | v58.60 marketAnalysis verified가 과거blocked 관측을 대체한다. verified는 경제적 인과의 인증이 아니다. | 시점별 판정 유지 |
| 검사 결과 | 과거preflight14 PASS, helper41 syntax PASS, live/full의 시점별 PASS/FAIL을 합산해 전체PASS로 쓰지 않는다. | 당시 원시 보고 보존 |
| 과거 경로 | raw JSON/로그/TSV의 당시 명령·경로는 변경하지 않는다. 새 연결표와 루트 원장 view만 현재 경로로 해석한다. | 원본 바이트와 경로표 보존 |

## 이동과 실행 helper 검토

원본482개는 `originals.zip`의 각 entry SHA까지 대조했다. 비MD/MJS 원본325개는 새 위치에서도 바이트가 같다. MD40개는 역사 배너·링크를 갱신했고 위 TOOLING 문구1건을 정정했다. 실행 helper는 감사 폴더 경로 및 import 기준 위치를 보정했으며 변경 전후 SHA와 이유를 migration.json에 남겼다.

상대 참조107개 중 이동에 필요한90개를 보정했다. 현재 없는3개 참조는 모두 오래된 `reproduce-domain-contracts.mjs`의 은퇴한 `src/domain/screener/regime.js`다. 삭제 전 고정REF의 역사적 재현용이며 현재 checkout에서 그대로 재실행 가능한 것으로 인증하지 않는다. 임의 stub 생성이나 제품 모듈 복원은 하지 않았다.

독립 이동 검토에서 상대 import 보정 helper를 다시 실행하면 경로가 한 번 더 깊어질 위험이 지적됐다. 완료 영수증 존재 시 쓰기 전에 명시적으로 거부하도록 한 guard를 확인했다. 실제 guard 재실행의 거부·바이트 불변은 이번 verification 기록에 남긴다. 이 도구들은 일회성 이동 도구이며 재통합 명령으로 다시 돌리지 않는다.

## 실제 읽기 범위

Architecture 폴더의 Markdown40개와 관련 선행 Markdown9개를 분담해 전문으로 읽었다. 목록·원본 SHA·담당은 documentation-review.json에 기록한다. 별도로 새6개 receipt53행의 고유성/고정blob/최종원장SHA, 원장850행의 고유성과405/13/432 집계를 대조했다. 새6개 반례 JSON과 일부 browser 관측 JSON도 내용을 대조했다. 기록된 이미지·영상은 파일 존재·바이트 보존을 검사했으며 이번에 전부 다시 시각 검수한 것은 아니다.

선행 문서는 10/15 개편의 HANDOFF/REVIEW/CLOSEOUT, 10/16 internal·policy HANDOFF, exhaustive의 HANDOFF/LATEST-STATUS-v57.98/REVIEW-CORRECTIONS/CLOSEOUT다. 다른 날짜·다른 프로젝트의 모든 HANDOFF를 새로 완독했다고 주장하지 않는다.

## 검토 결론과 미검증

두 번째 correctness 검토는 주27행의 내용 변경0, 원장850행의 evidence 외 변경0, 역사 section index의 줄·제목 불일치0을 확인했다. 두 번째 이동 검토는 ZIP482개 SHA, raw325개 불변,482개 목적지의 감사 폴더 내부 경계를 독립 확인했다. 새 unresolved actionable은 남지 않았으며 과거 제품 결함을 수정한 것은 아니다.

전체 제품850개 전문 재독, 남은432개 코드 의미 검토, 모든 지식·데이터의 현재 지속 여부, 새 실브라우저/live/유료 AI/producer/배포는 이 요청의 검증 범위가 아니다. 기존 게이트가 통과한 사실과 내용의 진위·투자 우위는 구별한다.
