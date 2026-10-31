# PASS27 — 개인 데이터 저장·백업·복원·원장

2026-10-31 KST. 직접 전체 판독: src/data/{portfolio-assumptions,portfolio-backup,portfolio-cash,portfolio-declarations-store,portfolio-ledger,watchlist-store,shell-prefs,stock-subject-store}.js (8파일). js/aio-workspace.js 260–345/1360–1450의 입력·복원 소비자 부분 판독. 실사용 localStorage/Vault는 접근·변경하지 않았다.

증거: reproduce-pass27.mjs → pass27-reproductions.json, exit0, 8개 반례 묶음. 순수 함수와 주입 저장소, shell에서 복원 조정 함수 하나만 추출한 VM으로 실행. shell 전체나 실제 브라우저를 실행하지 않았다.

## P27-RESTORE-01 — 관심목록 실패를 전체 가져오기 성공으로 보고

_pfRestoreBackupSections는 saveWatchlists(c.watchlists)의 false 반환을 버린다. setActiveWatchlistId는 내부 예외를 삼킨다. 최종 acks에는 ledger/FX/trades만 들어간다. saveWatchlists=false, 나머지 성공인 주입 환경에서 반환 acks가 전부 ok인 반례 재현. importPortfolio는 positions ack와 이를 합쳐 every(ok)이면 '전체 백업 가져오기 완료'를 표시하므로 실제 데이터 일부가 복원되지 않아도 완료로 읽힌다. 별도 관심목록 실패 toast가 먼저 나와도 최종 성공 문구가 이를 덮는 의미 불일치다.

복원은 positions→assumptions→cash→journal→watchlists→ledger/FX 순으로 부분 변경될 수 있다. 앞부분 성공 후 뒷부분 실패 시 기존 데이터로 자동 원복하는 계약은 없고, 전체 실패 문구도 어떤 섹션이 새 데이터인지 알려주지 않는다. PIN/저장공간 실패에서 재시도 시 무엇이 남는지 판단하기 어렵다.

개편: 각 섹션의 준비·검증·memoryApplied·persisted를 모아 결과표로 표시. 모든 섹션 검증을 먼저 끝내고, 가능하면 이전 스냅샷/복원저널로 원복 또는 재시도. 브라우저 저장소의 다중 key 원자성을 가정하지 말 것. 회귀: 각 단계 개별 실패, quota, Vault거부, watchlist false, active id실패, 새로고침 후 값, 중복 재시도.

## P27-IMPORT-01 — 불량 행을 고쳐 쓰거나 누락시키면서 내용 손실을 알리지 않음

sanitizePositions는 cost='nonsense'를0으로 바꿔 유효한 보유행으로 남긴다. 빈값/null도0으로 변환된다. 비용자료 미확인과 실제0원 취득을 같게 만들면 손익표의 의미가 달라진다. qty 불량은0→행 제거. 사용자 확인에는 정상화 후 count만 나오므로 원본과 달라진 내용이 보이지 않는다.

normalizeLedger는 불량 transaction을 제거해도 coverage=true를 그대로 유지한다(PASS22의 누락입출금→과대수익 위험과 연결). cleanDate는 YYYY-MM-DD 모양만 검사하여2/30도 유지된다. fixture에서 불량amount행은 삭제,2/30은 유지, 모든coverage는complete. cleanAmount>0은 평가액0도 제거한다. 계좌가 실제0으로 소진되거나 완전인출된 경계의 성과를 별도 정의해야 한다.

sanitizeJournal은 ts가 유한수이면 허용하지만 JS Date 범위를 넘는1e20에서 toISOString이 throw한다. parsePortfolioBackup의 catch는 JSON.parse만 감싸므로 정형 JSON이어도 결과 ok:false 대신 전체 예외가 난다. 복원 확인 전 실패하는 경계지만 UI 오류 메시지 일관성이 깨진다.

개편: 원본값을 보존하고 valid/rejected/changed를 별도 보고. 잘못된 원가는 결측으로, 손실된 원장행은 coverage hold로 전파. 날짜 실존·지원연도·timestamp 범위 검사. 입력1건 오류로 나머지를 조용히 잃지 않도록 명시적 선택/미리보기. 통화 문자열3글자는 ISO/지원FX 보증이 아니므로 unknown 통화는 합계 hold.

## P27-LEDGER-01 — '추가'가 같은 날 같은 종류 거래를 대체

appendLedgerTransaction은 date+kind가 같은 기존 행을 모두 제거 후 새 행을 넣는다. 같은날 deposit100 다음deposit200이면 총300이 아니라200만 남는 반례. 실제 addLedgerEntry는 '입금 거래를 저장'이라 표시하고 입력을 지우며 교체 사실은 알리지 않는다. 하루 순입금 합계를 입력하라는 계약이라면 UI에도 그 의미를 명시해야 한다. 개별 거래 추가라면 id를 갖고 누적, 합계는 별도 파생해야 한다.

평가액은 하루1개 교체를 코드가 명시하지만 normalizeLedger(import)는 중복평가액을 보존하므로 입력과 가져오기 결과도 달라질 수 있다. normalizeLedger와 setFlowTiming은 unknown을 end-of-period로 기본 처리한다. 사용자 선언 없이는 가정하지 않는 portfolio-assumptions 정책과 원장 기본값 정책의 차이를 명시하거나 통합. remove kind/index 역시 잘못된kind를 transactions로 간주하므로 구조화 id 기반 삭제 권장.

## P27-WATCHLIST-01 — 저장 성공·마이그레이션·불량 형태의 계약 부족

writeLists는 storage?.setItem을 호출해 storage=null이어도true를 반환한다. toggleWatchlistSymbol(null,'TEST')→ok:true인데 읽은목록[] 반례. 실제 정상 브라우저에서는 storage가 있지만 거부/어댑터 환경의 성공 계약은 잘못됐다.

readWatchlists는 불량tickers를[]로 보정한다고 하지만 먼저 foldLegacyStars가 (list.tickers||[]).map을 호출한다. 구형star가 남고 tickers={}면 보정 전 throw 재현. readWatchlistSymbols/toggle도 truthy 비배열에 직접forEach/filter를 호출. 구형JSON parse실패를[]로 보고 legacy key를 삭제하는 경로는 손상 원본을 잃을 수 있다. migration은 신규key write readback 없이 legacy를 지운다. cash migration의 readback 보호와 불일치.

개편: 한 normalizer가 읽기·쓰기·마이그레이션에 공통 사용되되 불량원본을 별도 보존. 저장소 존재/쓰기 ack/readback 확인 후 legacy 삭제. 심볼trim/uppercase/dedup와 list id중복, 빈배열을 명시적으로 정의. 현재 unstar가 모든리스트에서 종목을 지우는 동작은 주석으로 명시되어 있어 임의 결함으로 판정하지 않으며 UX에 범위를 알려줄 개선후보.

## 현금·선언·기타 저장 경로

- normalizeCashBalances는 같은 통화 중 마지막값만 남긴다. USD100/200 입력은200. '한통화한잔액' 정책이면 중복을 정정으로 볼지 합산으로 볼지 복원 미리보기에 명시해야 한다. invalid row는 제거되며 {}도 known:true/empty라 손상과 의도적 전체삭제를 구분 못한다.
- writeCashBalances는 신규값 readback을 확인한 뒤 legacy를 지워 보호한다. 다만 'failed write leaves earlier new-model untouched' 주석은 write성공 후 readback실패일 때 보장되지 않는다(rollback없음). 실브라우저의 정상set/get에서는 같은값이 읽히므로 동시탭/어댑터 실패 위험으로 한정.
- createDeclarationsStore는 memoryApplied와 durable결과를 분리해 보고하는 정상 설계다. secureSet이 동기 throw/Promise가 아닌 반환이면 체인이 깨지는 후보이나 현재 shell주입은 safeLS Promise다. cache가없는 plain storage성공도 전체okfalse이므로 memory상태와 reload생존을 UI에서 따로 설명할 필요. optedOut일 때 read는 cache를 건너뛰는데 write는 cache갱신여부를ok필수로 삼는 계약도 함께 검토.
- backup reminder는 holdingCount>0일 때만 켜져 현금/원장/일지/관심목록만 있는 사용자에게는 백업 권유가 없다. 다운로드click시각이 lastBackupAt이며 파일이 디스크에 보존됐다는 검증은 아니다. '백업 요청'과 '복구 가능한 파일 보유'를 구분할 것.
- bundle에 누락된 sections는 대부분 empty/null로 정규화되어 전체 복원에서 지워지고 trades만 null이면 기존값유지다. API 주석은 'each section it declares'와 'every section replaced'가 공존한다. absent/explicitnull/empty의 버전별 의미를 명문화하고 차이 미리보기 필요.
- buildPortfolioBackup은 positions/watchlists/journal을 참조로 보관하지만 즉시JSON.stringify하는 현재caller에는 비동기 변경시간이 없다. 이를 현재 유실결함으로 확대하지 않는다. backup이 API키/PIN을 명시적으로 export하지 않고 잠긴암호화section을 확인하는 정상보호는 유지한다.
- shell-prefs는 실패해도sidebar기본펼침으로 읽는 낮은위험. stock-subject-store는 저장시넓게받고 읽을때대문자티커형만 허용하며 ^index/=FX는 복원되지 않는다. 종목이외심볼을 route가받는지연결확인 필요. recentSymbols는 기존배열원소형검증 없이 반환하는 후보.

## 상태

제품 변경·개인정보 읽기·실제 백업 가져오기 없음. 함수/격리조정자 재현과 소스추적으로만 판정. 실제 Vault/브라우저 재시작 검증과 전체파일 감사 완료 아님. commit/push/deploy 없음.
