> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# UI 후속 전문 읽기

2026-10-20 이어읽기. 기존 읽기/재현 재사용. atlas 새 구간 76–555 완독. 다음 556–642. 추가 입증 결함 없음. 기준 source hash는 기존 ledger와 동일한지 종료 시 대조.

체크포인트: atlas 미독 76–642까지 완료(전체938줄 FULL 가능). masters 추가116–815 완료, 다음816–1120. 분기별 표는 원본행 전체 미확인시 count/value null 처리와 시각 gap을 분리하며, 신고가치를 수익률/AUM으로 명명하지 않는 계약을 확인했다. lookup은 latest reportPeriod를 manager별 선택한 뒤 모든 운용사 impliedPrice median을 비교하므로 서로 다른 분기를 혼합할 가능성을 후보로 보류(현행 artifact 도달성 미검증).

체크포인트: atlas/masters 전문 완료 및 ledger FULL 갱신. themes 추가1–565 완료; 다음566–1044. RRG 사분면·절대기간등락 분리, 경계 band·역방향 최근움직임 설명, null 성과와 datum 없는 섹션 처리 확인. 추가 확정 finding 없음.

체크포인트: themes 미독1–1044 완료, 기존1045–1386과 합쳐 FULL. 신규 확정 finding 없음. detailQuote→subtheme composite는 부분 가중치 재정규화를 쓰며 데이터 적격 분모는 detail model이 제공한 계약을 따름. 이 분모의 모델 정확성은 본 담당 도메인 전체 감사 범위 밖. screener 미독111–265 완료, 다음266.

고정 revision 보정: 작업 트리가143f4c6e(v58.50)로 변경된 사실 확인. 이후 출력은 git show df6f0b33:path로 고정한다. 후속 masters 스타일2줄과 themes1–1035/screener111–825에서 먼저 읽은 최신본은 baseline diff의 제거 원문을 별도로 완독해 원문 차이를 보정했다. themes baseline1036–1044도 읽어 line shift 공백을 메웠다. 판정·sha256의 대상은 계속 df6f0b33이며 최신 제품 인증 아님. screener baseline826–1175 완료, 다음1176–1435.

체크포인트: screener baseline1176–1435,1546–1760,1981–2340 완료. 남은2341–2845. Why drawer appliedWeights가 active replay snapshot이 아니라 현재 store.metadata를 읽는 후보를 확인했다. 보관 실행 재현은 과거 snapshot rows를 표시하므로 추후 profile변경→replay→Why에서 저장 계산과 현재 weights를 혼용할 가능성이 있다(후속 action path 읽기 전 후보).


최종 checkpoint: baseline 미독 atlas76–642, masters116–1120, themes1–1044, screener111–1435/1546–1760/1981–2845 모두 완료. 원장30개 FULL. 원장 SHA256을 git show df6f0b33 blob bytes와 직접 비교: 30/30 일치. 현재 작업트리와 다른 파일 11개이며 최신 버전 재검증 주장은 하지 않는다.
