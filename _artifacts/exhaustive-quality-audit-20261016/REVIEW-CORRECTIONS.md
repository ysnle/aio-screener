# 독립 리뷰와 반영

code-reviewer 읽기 전용 배치 리뷰에서46추적 원문·변경20·금융 sourceHashes·455dossier/280glossary/112worked 집계 일치를 확인했다. QA/브라우저/합성 재현은 새로 실행하지 않았고 부모 영수증을 대조했다.

1. **읽기 원문 고정 누락:** 용어 개수·ID만 같아도 정의가 바뀌면 예전 판정을 새 원문에 붙일 위험이 있었다. glossary와43fact 원문의 검토 hash를 worked/hash와 함께 고정하고 불일치 시 발행 전 중단하도록 수정했다. 별도 메모리 변조 probe 두 개는 ID를 그대로 두고 바이트만 바꿨으며, 둘 다 변경 거부·실제write0이었다. 현재 원문이 이미 바뀌었다는 지적은 아니었다.
2. **운영 상태 원인 혼합:** overall은 durable-only이고 quotes missingReason은 fast 기능의 별도 원인이다. BROWSER-LIVE에서 이를 분리했다. durable readiness의 값은 기록하되 overall의 정확한 원인 분기를 이 공개 snapshot만으로 인증하지 않는다. 권고성 검토/soak가 blocker로 남았다는 별도 정합성 지적은 유지했다.

리뷰 반영은 감사 자료·재현기에 한정했다. 제품 정책·상태 생산기·배포는 바꾸지 않았다.
