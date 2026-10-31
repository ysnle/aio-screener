# PASS29 — 지식 출처·관계 그래프·학습 기록

2026-10-31 KST. 전체 직접 판독11파일: src/domain/knowledge/{learning-state,evidence,knowledge-cadence,graph,concept-surfaces,theme-research-links,atlas-relations,order,deferred-screen-terms}.js, src/app/knowledge-learning-state.js, src/ui/knowledge/learning-controls.js. scripts/ci-knowledge-corpus-check.mjs20–37 및 출처충돌 검사 위치 검색만 추가; 해당 대형gate 전체판독 아님.

reproduce-pass29.mjs→pass29-reproductions.json, exit0, 6개 반례 묶음. 외부 원문 사실검증·실사용 메모 접근 없음.

## P29-EVIDENCE-01 — 같은 출처 id의 정정·철회가 병합에서 사라짐

createEvidenceRegistry는 동일id/동일URL이면 conflict를 만들지 않고 기존verification/reviewedAt/publishedAt 등을 우선 유지한다. verified/2020와 revoked/2026이 들어와도 verified/2020, conflicts0 재현. allowedUse/sourceRole/publisher/title은 병합 갱신 대상조차 아니어서 뒤 catalog의 더 엄격한 제한이 없어질 수 있다. 입력catalog순서가 의미를 결정한다.

다른URL 충돌은 별도conflicts에 보존하고 첫값을 유지하는 보호가 있으며 knowledge-corpus gate가 conflicts0을 요구한다. 그러나 같은URL의 의미충돌은 이 gate에 잡히지 않는다. schema가 verification값을 제한한다면 fixture enum을 실제registry정의로 교체하여 검증하되 '동일URL이면 metadata충돌을검사하지않음' 자체는 source로 확인했다.

createClaimRegistry는 sourceIds=[]인 claim을 unresolved0으로 반환한다. 이것은 참조 해소 검사로서는 일관되지만 '근거충분' 인증은 아니다. duplicateclaim은기록하면서lastwins, URL conflict는firstwins라선택정책도상이하다. sourceIds가객체이면문자열화되므로타입오류와미등록id를구별할필요.

개편: 출처 identity와 개별검토revision을 분리, 충돌필드별변경이력/우선순위/검토상태를 명시. 허용용도는 임의로 넓히지 않고 충돌 시 보류. unresolved=false 대신 resolutionStatus와 evidenceSufficiency를 별도 발행. 출처연결은본문이주장을지지한다는뜻이아님을 계속 유지한다.

## P29-GRAPH-01 — 정규화 재검사에서 추정 흔적이 사라짐

normalizeKnowledgeEdge는누락값을추정하고inferredFields를기록한다. inspectKnowledgeGraph는그edge를다시normalize하여이미채워진값을명시입력으로읽으므로inferredEdges가0이되는반례. metadataOrigin='INFERRED'는남지만inspector는그필드를집계하지않는다. 명시검수와추정edge비율을보고할때과대완료위험.

동일from/to의RELATES_TO와CAUSES는기본id가같지만duplicateEdges키는from/to/type라중복id를잡지않는다(재현). slug가구두점을동일하게정리하는서로다른노드id도충돌후보. nodeIds를Set으로만들어중복nodeid를조용히지우는것도 별도계수필요.

개편: 원본field provenance를불변으로보존하고재정규화시합집합, id에는관계type/direction또는안정적명시id포함. duplicateId와duplicateRelation을별도검사. reviewedAt은존재만으로실제날짜/미래/기한검증을대체하지않는다. components는무방향연결성이고source/sink는방향성을쓰므로 인과경로연결성이나순환검증으로해석하면안된다.

## P29-RELATION-01 — 노출 관계가 경쟁으로 번역되고 조건·출처가 빠짐

atlas-relations의CROSS_TYPE은EXPOSES_TO→substitute, REQUIRES→complement로변환한다. EXPOSES_TO인fixture가'대체·경쟁관계'라는상호관계가되는반례. 노출은대체관계와같지않고REQUIRES의의존방향은대칭보완으로약해진다. typedRelations는sourceIds/conditions/reviewedAt도출력하지않고knownid의CROSS_TEXT나빈text만남긴다. upstream원문이조건부임을담고있어도소비자가그정보를복구할수없다.

개편: 관계vocabulary를손실없이보존하고UI용label은분리. EXPOSES_TO의노출방향, REQUIRES의필요방향을정의하고조건/출처를details로전달. RELATION_TYPES의물리component와basis/learning구분은정상보강이며목록순서를공급망으로그리지않는보호를유지한다. 특정산업의실제경쟁/공급사실은이번코드감사에서외부검증한것이아니다.

일부정적edge의type/text도내부의미가다름: cloud-ai-service→cloud-utilization을measures로두지만text는서비스수익성이가동률에달린다는설명. '측정대상'화살표와의존조건을구분해전수편집검수필요. relationGroups는같은type/label/id중첫값만남겨서서로다른조건은합쳐지지않는다.

## P29-LEARNING-01 — 탭간 학습 기록 덮어쓰기

createLearningState는생성시한번읽고전체state를매번저장한다. 같은storage의독립인스턴스A/B를만든뒤A메모저장→B메모저장이면A메모가사라지는반례. 정상화면의단일instance에서는문제없으나독립탭이열릴수있는브라우저환경의데이터유실경로다. storage event/version merge가없다.

개편: 항목별revision/updatedAt을병합하거나저장직전최신스냅샷과3-way대조. 충돌메모는자동선택하지말고양쪽보존. 현재memory-only상태를UI가명확히표시하고북마크재렌더동안draft를유지하는보호는정상이다. draft100개초과시가장오래된draft를버리는정책은개인메모보존한계로알릴후보. note UI max1000자지만domain에는상한없어외부import/직접호출시quota문제가능;일상사용증거없는보강후보로만기록.

savedstate의progress/notes는entry를얕게복제하므로nested object는snapshot/Object.freeze를넘어참조가공유될수있다. 현재UI는평문note와scalar progress라즉시문제는미확인. safeRead가잘못된schema/JSON을empty로보면다음저장이이전원본을덮는다. 손상원본보존·export설계권장. portfolio '전체백업'에는학습메모가포함되지않으므로전체앱데이터백업으로오해하지않도록범위표시필요.

## 갱신 주기·연결 레지스트리

- isOverdue는미래2099observation을overdue=false로반환한다(재현). unknownkind도false, principle은날짜없이false. 원리의무기한정책은의도적이지만미래/불량/unknown을최신과구분해야한다. observation45일고정은실적·시장수치의개별cadence를보장하지못한다.
- registryCadenceSummary는동일asOf로기업역할365일과productionstatus90일을판정한다. 역할검토일을갱신하며생산상태까지재검토한것처럼되는것을막기위해field별reviewedAt/발표일권장.
- concept-surfaces는교육surface와실측route를구분, theme-research-links는US테마↔분석note/domain양방향연결을한registry로관리한다. shallowfreeze의하위배열변경가능성은후보이며실제mutation은미확인. routealias자체는retiredroute와같지않으므로존재만으로결함처리하지않음.
- deferred-screen-terms는숫자조건/용어설명의교재이며현재예측으로승격하지않는문구가있다. '팔사람이대부분팔았다'와같은직접관측불가능한설명은징후/추정수준임을명확히할편집후보. 해당외부금융개념사실검증은아님.
- compareStableText는host locale비의존UTF-16순서라는설계와구현이일치. 생성물순서안정화에유효하다.

## 상태

지식기반전체본문/원문/회사별자료의전수검증완료아님. 여기서는11파일과명시한소비연결을직접읽고반례를검증했다. 제품수정·사용자메모읽기·생산자실행·commit/push/deploy없음.
