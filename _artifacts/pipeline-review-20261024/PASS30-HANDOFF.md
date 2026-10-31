# PASS30 — 지식 artifact 로드·캐시·검색·리서치 저장본

2026-10-31 KST. 전체 직접 판독6파일: src/data/knowledge/load-capabilities.js, src/data/artifact-cache.js, src/data/research-snapshots.js, src/ui/knowledge/{safe-external-link,capability-loader,knowledge-search}.js. 관련 corpus/검색 정규화 전체는 이번 범위에 포함하지 않는다.

reproduce-pass30.mjs→pass30-reproductions.json, exit0, 6개 반례/계약경계 묶음. fetch는모두주입함수, 외부네트워크나사용자저장소접근없음.

## P30-LOAD-01 — 검증 실패한 artifact가 캐시에 남아 재시도도 실패

loadKnowledgeCapabilities는loadJsonArtifact가parsedJSON을cache한뒤validate를실행한다. validation실패는상위에서fallback이되지만캐시는무효화하지않는다. 첫응답invalid,다음네트워크응답은corrected가될주입fetch에서두번째load도같은invalidcache를읽어fallback,fetch총1회인반례. clearArtifactCache후만다음정상응답을받았다. 기본TTL15분동안사용자재시도가서버수정본을받지못할수있다.

개편: validation/스키마버전을artifact수용계약에포함하거나검증실패시해당key만폐기. 실패재시도정책에force/refetch를연결하고다른정상artifact캐시를전부삭제하지않는다. 부재/파싱실패/shape실패/사용자취소를fallback한단어로뭉개지않고상태와다음시도조건을보존. validator는현재동기함수를전제하므로async추가시await계약을명확히할것.

createKnowledgeCapabilityBatchLoader는state[key]!=null이면새load를건너뛴다. 한번connected된값은artifactTTL과무관하게같은page state수명동안다시읽지않는다(재현). 정적지식자료의lazyload로는의도된최적화이나같은날정정/장기탭최신성보장은아니다. entry revision이변경될때만교체할경로제안. 중복definitions key는loading등록전필터에서모두통과하여최종Object.fromEntries의lastwins가된다. definition중복검사후호출.

## P30-CACHE-01 — 공유 cache 값은 immutable 계약이 아님

loadJsonArtifact가반환한객체를소비자에서수정하면다음소비자에게그대로99가전달되는반례. clone/freeze없음. 이전PASS28 selector는'아티팩트는교체되고변경되지않음'을가정해참조동일성으로cache하므로공급층과소비층의불변계약이명시적으로이어져있지않다. 실제어떤caller가원본을mutate하는지는별도추적대상이며이반례만으로실제오염발생을확정하지않는다.

정상보호: root별stablefetchidentity, integrity와maxBytes를key에포함, consumer별abort와마지막consumer이탈시sharedrequestabort, 성공값LRU, rawtext SHA256검사. force는resolved를무시하되기존inflight는공유한다;manualrefresh가이미진행중인요청보다더새revision을보증하는의미는아니다. abortInFlight=false clear도진행중완료값이cache를다시채울수있음.

maxBytes는Content-Length선검사또는body전체텍스트를읽은뒤확인한다. 큰stream의메모리할당을중간에막는hardlimit은아니다. stall과header timeout은별도이며정상적으로조금씩오는stream은전체timeout이없다. 콘텐츠길이·다운로드전체시간정책은데이터별크기예산과맞출필요. 이것을현재배포장애나공격증거로주장하지않는다.

## P30-SNAPSHOT-01 — 내용 hash와 근거 revision의 의미 구분 필요

research-snapshots는저장된id가64hex이고savedAt이parse되면읽으며내용hash를재계산하지않는다. 임의id와수정된content를persistent로읽는반례. 현재로컬저장본의immutable은런타임deepfreeze/복제보장이지저장소변조탐지보장이아니다. 데이터정직성상'검증된스냅샷'으로확대해설명하지말것. 외부import나공유증거로쓸경우실제digest검증필요.

capture는content에대해서만hash하여publishedAt/sourceRevision이달라도기존record를반환한다. 동일관측본문r1→r2가r1로남는반례. 내용주소화정책으로는정상설계지만재확인시점·근거revision의기록을사용자가기대하면다르다. content identity는유지하되capture observations목록을별도로기록할안. 현재조건에서는같은내용중복저장을막는장점도유지.

정상보호:allowlist로보유/계좌값을직접캡처하지않음,unreadable저장소는삭제/새저장보류,최대60개에서자동삭제안함,1단계삭제되돌리기,공유recorddeepfreeze. 다중탭whole-stateoverwrite는learning-state와같은구조. 사용자가source/note에개인정보를직접적는것까지allowlist가방지한다는뜻은아니다. 빈/잘못된factsrow는projection에서예외가능,날짜는실존날짜보다형식검사위주인후보.

## 링크·검색 경계

- safeExternalHref는HTTPS protocol만검사하여credential포함URL도safe를반환한다(재현). 예시publisher.example@other.example의실제host는other.example다. 안전명칭의뜻은javascript/data등실행scheme차단이지공식publisher인증이아님. 다른company-analysis의no-credential검사와통일할후보. rel=noopener noreferrer와invalidlinkhref제거는정상.
- searchKnowledgeIndex는generatedindex에최신localLESSONS를덮어써Actions생성전에도분석note가검색되게한다. 이전keys와새keys를합치므로삭제한옛alias는index재생성전까지남는다. 검색본문은answer앞240자여서후반핵심개념이검색되지않을수있으며이는정한scope라전체본문검색이라부르지않는다.
- 한글자검색은제외,frame/column5점가점,동률localeCompare정렬은의도된검색정책. 빈/비배열entries나keys/title이부적합하면render경로에서예외가능하므로upstreamvalidator계약검토대상. 비교안정성이필요한생성물용compareStableText와UI검색정렬의목적은다르므로localeCompare존재만으로결함이라하지않는다.

## 상태

이번6파일직접판독과함수/주입transport검증완료. 전체codebase검토완료아님. 실브라우저로딩·네트워크·보존데이터복구검증미실시. 제품개선·producer실행·commit/push/deploy없음.
