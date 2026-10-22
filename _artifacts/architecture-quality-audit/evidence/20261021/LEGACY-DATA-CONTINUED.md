> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# Legacy data 계속 읽기 및 최신 반례 검증

MODE: review | VERDICT: PASS+NOTES | REF: d36bb256ddf60468d6c7a134628053c5796be6be (v58.52)

기존 미해결 2건 재현, 이번 aio-data.js 잔여 전문 검토에서 추가로 확정한 실사용 결함은 0건이다. PASS+NOTES는 이 담당 범위의 검토 완료 표시이며 기존 결함이 해결됐다는 뜻이 아니다. 한 리뷰어/동일 모델의 후속 검토이므로 independence: limited.

## 읽기 증거와 범위

- `git show <REF>:js/aio-data.js`로 읽었다. UTF-8 SHA256 `899a41c2bacbdf6cc687fa72bc4224ac30380d9b4fec498837eb99bb4e6c8a2a`, UTF16 805793자.
- 이전 df6f0b33 원문은 806316자, SHA256 `9cf7bfc1423726daf379cec1ba2383f0140c9b3b62cbf4e0ca15268fe76bd6da`이며 19폴더 `legacy-data-reading.tsv`와 정확히 일치한다. 부모가 인계한 이전 [0,384000) 의미검토를 재사용했다. TSV의 더 넓은 [0,496000) 기록에는 의존하지 않았다.
- `git diff df6f0b33 <REF> -- js/aio-data.js` 전체를 검토했다. 변경은 inline style의 CSS class 이동과 `_aioApplyNewsBackstop`의 `verification: unconfirmed` 보존이다. 변경된 전체 hunk를 읽었으므로 앞부분의 변경을 누락하지 않았다.
- 최신 원문 [384000,805793)을 순차 읽었다: 384000–416000, 416000–452000, 430000–456000, 456000–488000, 488000–520000, 520000–552000, 552000–584000, 584000–616000, 616000–648000, 648000–680000, 680000–712000, 712000–744000, 744000–776000, 776000–805793. 416000–452000 출력의 중간 잘림은 430000–456000 겹침 재독으로 복구했다.
- 앞부분 변경으로 UTF16 offset이 줄어든 경계도 따로 검증했다: 이전 383700 anchor가 최신 383455에서 발견되었다. 최신 [382000,384000)을 추가 재독하여 이전 prefix와 최신 tail 사이 빈틈을 없앴다.
- 전문 의미검토 대상은 keyword registry, news scoring/selection/verification, 번역 queue/cache/재시도, RSS/TG fetch와 backstop, 요청별 시세 범위와 batch/rescue, KR Naver와 일봉, atomic quote selection/PriceStore 연동, KRX 전일종가 검증, DOM binding/ownership fence, quote 저장/복원, Yahoo→FRED bridge, MA/F&G/PCR/HY 경계다.

## 최신 재현 결과

실행: `node _artifacts/architecture-quality-audit-20261021/reproduce-legacy-latest.mjs`

모든 검사는 고정 SHA의 실제 함수 본문을 Node VM에서 실행한다. DOM·저장 snapshot만 stub으로 제공하고 네트워크와 producer는 사용하지 않는다. 이는 브라우저 검증이 아니다. 결과 원본은 `legacy-latest-repro.json`.

### LD-01 [PRE-EXISTING][medium] KR 시세 미수신 상세의 0%·하락 우세 오표시 — 유지

위치 `js/aio-kr-data.js:379`, `:400`, `:455–481`. `_liveData={}`에서 실제 `showKrThemeDetail` 및 `_buildKrThemeDeepAnalysis`를 실행했다. `시세 미수신`과 `+0.00%`, `하락 종목(0개)이 상승 종목(0개)보다 많습니다`가 같은 HTML에 들어감을 assert했다. 입력 테마는 실제 방산 심볼 012450을 쓰는 한 종목 최소 fixture이며, 결측 분기를 재현하기 위한 격리 입력이다. 전체 실제 테마/브라우저 증거는 부모가 보유한 20폴더 v58.50 자료와 구분한다.

### LD-02 [PRE-EXISTING][medium] KST 오전 실적 캘린더 날짜 열 불일치 — 유지

위치 `js/aio-pages.js:305–311`, `:353–367`. 최신 CSS class가 반영된 실제 `loadEarningsCalendar`, `_renderEarningsCalendarWeekly`, `_renderEarnSection`를 실행했다. TZ=Asia/Seoul, 2026-10-19 08:00에서 제목은 월19/화20/…/금23이나 월19 이벤트는 두 번째 화20 열에 있고 금23 이벤트는 5열 밖으로 빠진다. 상태도 10-18~10-22를 표시한다. 09:00 대조군에서는 월19 이벤트가 첫 열, 금23 이벤트가 마지막 열에 올바르게 배치된다. class 문자열 변경에 의한 harness 실패가 아니라 최신 renderer의 날짜 계산 반례임을 확인했다.

## 후보를 추가 finding으로 올리지 않은 이유

- Yahoo DX-Y.NYB를 FRED DTWEXBGS에 넣는 bridge는 단위/지수 정의가 다르다는 구조 문제다. 그러나 고정 SHA에서 DTWEXBGS의 실사용 native/DOM/AI 읽기 경로는 확인하지 못했다(선언, bridge write, validator만 발견). 실사용 오류라고 주장하지 않는다.
- `_aioNewsVerificationStatus`의 contract 생략 호출은 진단 audit 경로다. 실제 native 뉴스 모델 대체 여부를 무시한 product finding으로 올리지 않았다.
- PCR equity/index의 null→0 저장 후보는 실제 표시 소비처를 확인하지 못했다. retired options 화면을 근거로 삼지 않았다.
- 최신 시세 source timestamp·missing pct 후보는 실제 `PriceStore.set`이 관측 시각을 보존하고 pct=null로 대체하며 canonical DOM pass가 뒤따르는 경계까지 읽었다. 임의로 실시간/등락률 오류를 확정하지 않았다.
- MA 자동 갱신은 native runtime-readers의 evidence 검증 경계가 별도로 있어 raw `_spxMA`만 보고 decision 영향이 있다고 주장하지 않았다.

## 한계

정적 전문/고정 소스 VM 증거다. 외부 공급자의 현재 응답, 배포 서비스, 브라우저 수명주기를 새로 인증하지 않았다. 이 보고서는 전체 저장소 PASS 또는 데이터 최신성 인증이 아니다. 제품·데이터 수정, producer, 외부 API, 유료 AI, Git mutation, commit/push/deploy 없음. 이 담당자가 쓴 파일은 21폴더의 보고·receipt·격리 재현뿐이다.
