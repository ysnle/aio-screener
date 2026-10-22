# 10/22 후속 감사 — 검증 경계와 잔여

MODE: review · VERDICT: FAIL(검토한 제품 범위에 보완 필요), 전체 전수 감사 IN_PROGRESS.

## 이번 완료 범위

4개 읽기 원장에서 고정REF 전문 읽기28행을 직접 확인했고 SHA·선언한1-N 범위를 Git blob과 대조했다. 이전 FULL4개 재독을 제외한 순증24개로 원장은 **429 FULL /13 mirror /408부분·미검토**, 총850개다. 새 helper가 읽은 import 의존성은 전문 수에 더하지 않았다. 셸 현행은 고정 전문+전체 버전 치환14줄을 대조했고 나머지27개는 검토 시점 현행 SHA도 같았다. 같은 SHA는 소스 지속 근거이며 전체 앱 실행의 인증이 아니다.

확정 새 반례4묶음(SCR04,SEC02,LEGACY02,LEGACY03), 기존6항목(C03,C04,C06,D4,BND01,C13)의 근거 보강, 현재 연결되지 않은 조건부 통계 계약SCR05를 구분한다. 원래A01–A27은 그대로 보존했다. 모든 제품 finding은 REF 이전부터 존재하는 PRE-EXISTING이며 운영자/이전 작성자 탓으로 판정하지 않는다.

## 검증과 증거 단계

- `screener-probe.mjs`: pinned pure ESM 합성 입력, NOT identity·상수 팩터·valuation·문장 parser·중복 관측 대조.17개 의존 SHA 현행 동일. 원시 결과는 [JSON](./screener-probe-result.json).
- `security-probe-boundaries.mjs`: relay 공급자 본문 중단 및 publication plan/fallback 대조. 공급자 요청은 fake key의 exact URL stub이고 나머지 fetch는 금지. [보안 결과](./security-probe-boundaries.json).
- `worker/openai-contract.test.mjs`: 전문 검토 후 모든 fetch를 stub/deny한 기존158 assertions PASS. 이것은 실제 Cloudflare/공급자 청구/최신 가격 검증이 아니다.
- legacy: 실제 함수·renderer의 VM과 합성 DOM/관측 fixture. assembler·이력·listing 응답은 통제했으며 전체 앱·실계좌·live 한국 데이터가 아니다. 네트워크 차단 isolated Chromium 실행은 담당자의 기록이며 root의 실제 브라우저 세션과 합치지 않는다. [원시 결과](./legacy-probe-runtime.json).
- shell: inline3개×고정/현행 VM syntax 및 CDN실패 stub의 Chart fallback 실행. 실제 CDN 장애를 발생시키거나 화면에서 null을 확인한 결과가 아니다.
- **실브라우저 추가:** CUA로 실제 Pages v58.60 스크리너에 OR 문장과 PER 미만 입력을 적용해 의미 변화 확인. DOM/screenshot 보존 후 임시 조건을 UI로 모두 지우고904개 조건 없음 상태 확인. 저장/AI 전송/계좌 변경 없음. 배포 byte SHA·전체8개 화면·반응형 전수 재검증은 하지 않았다.

반례 helper의 exit0은 제품 정상 PASS가 아니다. 문서 검증·QA 최종 결과는 [verification.json](../../verification.json)과 이 폴더의 qa-closeout.json/log를 따른다. 같은 모델의 다른 문맥을 이용한 독립 렌즈이므로 모델 독립성은 limited다.

최종 선택 QA: `node .cache/audit-remaining-20261022/qa-closeout.mjs` → 명시47개 경로/preflight14개, **14 PASS /0 CACHED /0 FAIL /0 SKIP**,40.3초, `--no-cache`. [명령·범위](./qa-closeout.json), [로그](./qa-closeout.log), [선택 목록](./qa-owned-files.json). 이 선택에 포함되지 않은 오전 workspace 체크를 밤의 새 실행으로 중복 보고하지 않는다. `git diff --check` exit0이며 감사 폴더 밖 기준선3,632개 파일의 SHA 변경0이다([보존 결과](./source-preservation.json)). 기존 dirty 제품 수정의 소유권은 주장하지 않는다.

자료 verifier는 원본482개·raw325개 바이트 보존, 당시49개 문서 재검토 기록 유지, 전문429/mirror13/잔여408의 근거 일치, Markdown 경로·JSON parse·helper syntax를 확인했다. relative import는 현재 helper128개의 바이트를 해시로 묶어 재분석했고 새 누락0, 은퇴 모듈의 기존 미해소3개는 역사적 한계로 남겼다. syntax/링크/JSON의 최종 개수는 verification.json을 따른다. 배포/제품 전체의 정상 판정이 아니다.

## 감사 도구 재검토

원래 통합 generator를 다시 실행하면 최신 후속 내용을405/13/432로 덮을 수 있어 continuation이 있으면 실행을 거부하도록 했다. 새 `tools/continue-review.mjs`는 역사 원장/폴더를 바꾸지 않고 matching 전문 영수증만 반영한다. `tools/verify.mjs`는 별도로 고정 ref/원본 blob/해시/1-N 범위/영수증 경로/원장 counts와 original↔migration 일대일 결속을 확인한다. 보정 marker가 없으면 repair child를 실행하지 않고 실패로 기록한다. verifier는 documentation-review.json과 verification.json을 생성하는 도구이며 읽기 전용 명령이라고 설명하지 않는다.

[원장 도구 독립 재검토](./LEDGER-REVIEW.md), [root 스크리너 결과 재검토](./ROOT-REVIEW.md)를 함께 읽는다. 검증기를 보강한 것이 모든 제품 QA의 신뢰성을 인증한 것은 아니다. 원본482개·raw325개는 기존 SHA로 계속 검증한다.

배치 종료 시 별도 code-reviewer가 [마감 재검토](./BATCH-REVIEW.md)를 작성했다. 집계·원장·현행 동일성·A01–A27 보존·원본 해시를 읽기 전용으로 재계산했고 수정이 필요한 구체 문제0건/PASS+NOTES였다. 이 독립 검토도 같은 모델의 별도 문맥이며 제품 전체 PASS가 아니다.

## 유지할 결정과 바꿀 우선순위

가족·친구 규모의 정적 셸/native ESM, 순수 도메인과 producer 분리, 정확한 법인·공시 정본, 결측 보류, AI 공통 원장과 promotion 검토 경계는 유지할 근거가 있다. 파일 길이만으로 전면 재작성하거나 작은 helper를 전부 합치는 방식은 권하지 않는다. 우선은 다음과 같다.

1. **사용자가 다른 사실을 보게 되는 경계:** 기존 A01/A08/A20과 새 자연어 조건SCR04, 무근거 AI fallback SEC02. canonical 의미·날짜·가격·법인 보존부터 수정 후보를 정한다.
2. **비동기 상태 보존:** BND01과LEGACY03은 목록ID/구성ID/요청epoch의 최소 보완으로 접근한다. 한국 필터도 상태를 별도로 보존하고 재렌더 뒤 일관되게 적용한다. 단순 파일 이동은 이 문제를 해결하지 않는다.
3. **허위 근거를 줄이는 통계와 QA:** C04의 독립정보 문구, A11 통계 소비, A25/A26 retry, A06 dependency 입력을 우선한다. 통과한 문자열 assertion을 의미 정확성으로 바꾸지 않는다.
4. **남은 전문 읽기408개:** factor-ranks/price-factors, 대형 SEC/report 정규화, macro/read/crossroads, portfolio backtest/risk/surface 및 아직남은 CI·도구 파일은 원장에 남아 있다. 이어서 작은 고정 묶음으로 전문과 consumer를 대조한다. 이름만 나열했다고 이 파일들을 전문 검토한 것은 아니다. 구체 파일 상태는 root reading-ledger.tsv를 따른다.
5. **과거 발견의 미재검증:** C01/C07/C08/C09/C10/C14, D2/D3/D5/D6, M01–M03, UI-03–05, F-DELTA-01, I01 및 매매일지 consumer 등은 과거 상태를 보존한다. 이번 보완6항목을 제외한 최신 지속/해소를 임의로 확정하지 않는다.
6. **별도 콘텐츠/데이터 품질:** 850 실행·설정 소스의 FULL 수가455개 지식 단위·160기사·시장 데이터 각 값·실제 투자 유용성의 전수 인증은 아니다. 원문 인용·출처·의미·시계열/법인/통화 정합성을 별도 범위로 유지한다.

제품 수정·버전 변경·commit/push/deploy 없음. 실제 paid AI·producer·외부 메시지·공개 게시도 실행하지 않았다. 작업은 감사 산출물과 감사 자체 도구에 한정했다.
