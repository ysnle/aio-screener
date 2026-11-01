# X 북마크 — 주제 밖 7건 평가 (2026-11-01)

원본 목록: 프로젝트 파일 `x-bookmarks-20261101/off-topic-bookmarks.md`. 행별 판단은 `ledger.json`.

## 읽은 방법과 한계

이 클라우드 컨테이너에서는 x.com과 api.fxtwitter.com이 막혀 있고(robots 거부·프록시 403), 소유자 Chrome 확장도 끊겨 있었다. 그래서 검색엔진에 잡힌 x.com 본문 조각, 글이 가리키는 원 자료(benji.org/stageshow, cursor/plugins PR #741·#776·#794, ai-design-skills SKILL.md), 다른 사람의 소개 글로 읽었다. **댓글과 인용글은 직접 열지 못했다.** #4(kunchenguid)와 #7(emilkowalski)은 본문을 찾지 못했다.

## 판단

| # | 자료 | 판단 | 근거 |
|---|---|---|---|
| 1 | Stageshow (benjitaylor) | 보류 | 마케팅 페이지용 가짜 UI·데모 영상 스킬. AIO에는 소개 페이지가 없고, 글자 넘침·프레임 튐 검사는 기존 글자 폭 게이트·화면 상태 매트릭스와 겹친다 |
| 2 | 웹폰트 최적화 프롬프트 (shuding) | 이미 반영 | Pretendard unicode-range 동적 부분집합(P1756), 저속·데이터 절약 회선은 시스템 글꼴(F01). 남은 선택지: 부분집합 CSS 자가 호스팅으로 jsdelivr 연결 제거 — 픽셀 diff로 증명 필요, 미구현 |
| 3·6 | statechart·형식 검증 (poteto, 해설) | 이미 반영 | v58.72 model-check-kit이 실제 함수를 돌리고, 코드 지문으로 낡은 모델을 막고, 고의 결함 변형으로 실패를 증명하고, Mermaid 상태도를 그린다. #794는 TLA+가 아닌 검사는 대상 밖이라고 명시 |
| 5 | ai-design-skills 규칙 (lucas_flatwhite) | UI 개편 스레드로 넘김 | 랜딩 페이지용 규칙이라 데이터 터미널에 그대로 맞지 않는다. 대조 수치(46b3ba8): font-weight 900 22곳, italic 2곳, 그라디언트 23곳, Material 아이콘 0 |
| 4, 7 | kunchenguid, emilkowalski | 다시 읽기 필요 | Chrome 연결 또는 본문 붙여넣기 필요 |

코드 변경 없음. 그래서 record-fix 항목도 만들지 않았다.
