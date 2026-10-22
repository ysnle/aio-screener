> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 입력·갱신·수명주기·비용 경계 독립 감사

MODE: review | VERDICT: PASS+NOTES (지정 이관 diff) | REF: df6f0b33abd1c15c268d818efcbfc3c5547ed9b0
FINDINGS: 신규 ACT ON 0건, PRE-EXISTING warning 1건.

범위는 `8baf2f0f072e6da8d70cb086e5dbb4fba799165b..HEAD` 및 명시된 현재 파일이다. 전문 읽기와 판정은 별개다. 소유 9개 중 7개 FULL, 2개 PARTIAL이며, 추가 caller 및 데이터의 범위는 `boundary-reading.tsv`에 남겼다. legacy `js/aio-data.js`는 1,415줄 diff를 모두 읽었지만 14,063줄 원문 전문은 읽지 않았다. Worker도 변경 diff 전체와 비용 caller 구간을 읽었으며 파일 전체 보안 감사로 승격하지 않는다.

## BND-01 — [PRE-EXISTING][warning] 비동기 심볼 확인 중 목록을 바꾸면 다른 관심목록에 저장됨

- 위치: `js/aio-workspace.js:1885` (원래 대상 읽기 1876, 재호출 이후 대상 결정 1886–1895).
- Trigger: 관심목록 A를 선택하고, AIO가 아직 모르는 상장 심볼(예: 현재 목록 밖인 UFPT)을 추가한다. 첫 listing 로드가 끝나기 전에 목록 B로 전환한다.
- Failure: 확인 콜백이 `addToWatchlist(..., true)`를 재호출하고 `getActiveWatchlistId()`를 다시 읽어 B에 저장한다. A에는 추가되지 않고 사용자가 선택하지 않은 B의 내용이 바뀐다. 입력란도 B 화면에서 지워진다.
- Call chain: `index.html:5604–5606` 추가/Enter → `addToWatchlist` → `compatibility-globals.js:210–216` `_aioAcceptSymbol` → 176–178의 `checkListed` → `us-listings.js:60–78` `loadUsListings`의 비동기 artifact load → workspace 1885 재귀 → 현재 활성 목록 저장. 목록 선택은 `index.html:5593` → workspace 1867–1872 `switchWatchlist`가 요청 중에도 바꿀 수 있다.
- Proof: `node _artifacts/architecture-quality-audit-20261019/reproduce-boundaries.mjs` → `REPRODUCED watchlist async target drift: requested list A, persisted list B (deferred symbol UFPT)`. 실제 함수 본문을 VM에 로드하고 listing Promise만 지연한 순수 fixture이다. UFPT는 현재 `public-data/us-listings.json`에 있고 screener-universe에는 없다. 실제 UI 경로는 소스로 확인했으며 브라우저 재현은 하지 않았다.
- 반론/한계: 이미 알려진 심볼은 즉시 resolve되어 전환할 시간 창이 거의 없다. 첫 목록 로드나 느린 연결에서 미등록 상장 심볼이면 실제 대기 경계가 있다. UFPT는 aio-core의 이름 registry 원문 검색에도 없고, 실제 known 검사(resolve-name.js 34–38)는 entries/KRX/universe membership만 사용한다. 다만 그 세션에서 이미 listing으로 확인해 listedSeen에 들어갔다면 즉시 처리된다.
- 기존 여부: 기준 commit의 workspace에도 동일 재귀 콜백이 존재함을 `git show 8baf2f0f072e6da8d70cb086e5dbb4fba799165b:js/aio-workspace.js`로 확인했다. 최근 이관이 새로 만든 결함이 아니다.
- 최소 대안: 최초 `activeId`를 비동기 확인 이후까지 유지해 그 목록을 갱신하거나, 응답 시 활성 목록이 달라졌으면 추가를 취소하고 알린다. 파일 구조 재작성은 필요 없다.

## 확인한 경계와 증거

- `server-data.js`는 fetch/reconciliation/cycle 판단을 소유하고 legacy loader가 기존 snapshot/evidence 투영을 유지한다. `_aioLoadServerData` 4689–4909 및 bridge 79–82를 확인했다. fixture에서 미래 시각/미발행 cycle은 eligible=false, revision 불일치는 stale이다. 두 파일 fetch의 atomic publication을 증명한 것은 아니며, mismatch가 current로 승격되지 않는 것이 확인한 안전 사실이다.
- `server-macro.js`와 loader 4765–4817에서 매크로 projection, HY sentiment ingest, Treasury projection의 분리를 추적했다. fixture에서 NSA를 선언하지 않은 CPI가 canonical cpi에 승격되지 않았다. source 날짜의 의미나 모든 생산 숫자의 정확성을 별도로 인증하지 않는다.
- `server-market-analysis.js`와 loader 4872–4887은 typed evidence/semantic/publish 결과에 따라 prose sink를 게시한다. fixture에서 evidence 없는 분석은 null이었다. 기존 `validatePublish` callback 미설치 시 기본 허용 분기는 추출 전에도 같아서 신규 결함으로 올리지 않았다.
- `page-completeness.js` → bridge 71–76 → readonly `AIO_ARCH.getScreenerState(path)`의 실제 dot-path 분기를 확인했다. `data.json` 로더가 screener 상태를 다시 쓰던 경로는 제거되었다. fixture에서 오래된 universe는 partial이다.
- `bootstrap.js` 전문에서 refresh queue의 scope 교체, refresh:true의 우선 시작, latest-generation 결과만 commit하는 screener orchestrator의 31–41, stop()의 listener 해제/dispose를 추적했다. 오래된 scope의 결과가 store에 게시된다는 후보는 callee의 generation/isCurrent guard 때문에 확정 finding에서 제외했다. 정지 뒤 대기 queue가 provider를 부를 가능성은 있으나 실제 product teardown에 의한 사용자 실패는 입증하지 못했으므로 finding으로 만들지 않았다.
- Worker의 변경된 clientSpend 경계는 browser → `handleOpenAi` 1255–1284(Origin/app-token/automation 분기와 HMAC key) → DO proxy 1133–1150(서버 budget 재계산) → dispatch 1179–1215(reserve → start → upstream) → `mutateQuota` 939–1113으로 추적했다. authenticated automation은 connection cap을 받지 않지만 global month/day 경계는 같은 곳을 지난다. Origin/app-token이 사용자 인증이라는 주장은 하지 않는다.
- 실제 `AIOQuotaDurableObject` class를 fake serialized storage와 함께 실행한 fixture: 같은 connection의 270,000 microUSD 예약 100개를 동시에 요청해 3개/810,000만 허용; settle 시 차액 반환, 미시작 release 반환, started release 유지 PASS. 이는 DO 코드의 로컬 동작 증거이며 Cloudflare 배포·위치·실제 요금·실제 동시 요청의 live 증거가 아니다. 월 $20에 이르는 모든 모델/토큰 가격 산식은 이번 전문 범위 밖이다.

## 최종 상태

제품 코드/데이터 변경, producer/외부 API/유료 AI 실행, commit/push/deploy 없음. 독립 검토자는 부모와 같은 모델이므로 independence: limited. 기존 감사 결론과 저자 reasoning은 재사용하지 않았다. fixture, 이 보고서, reading TSV만 감사 폴더에 작성했다. 최종 소스 18개 SHA-256을 HEAD와 대조해 전부 동일함을 확인했고, 처음 저장한 native 5개 hash도 최초 값과 동일했다. 전체 제품 PASS, deployed PASS 또는 미완독 Worker/legacy 파일의 전문 완료를 주장하지 않는다.
