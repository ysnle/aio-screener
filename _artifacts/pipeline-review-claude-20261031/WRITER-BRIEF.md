# 공통 작업 지침 — 파이프라인 검토 결함 수정 (2026-10-31, v59.44 → v59.45)

목표: Codex가 2026-10-24~31에 남긴 파이프라인 의미·정합성 검토(`_artifacts/pipeline-review-20261024/PASS*-HANDOFF.md`)의 결함을 현재 HEAD에서 다시 확인하고, 근본 원인에서 고친다. 같은 결함 클래스가 소유 파일 안 다른 곳에도 있으면 함께 찾아 고친다.

## 이미 확인된 사실
- 재현 스크립트 사본은 `_artifacts/pipeline-review-claude-20261031/reproduce-passN.mjs`, 현재 HEAD 실행 결과는 같은 폴더의 `reproduce-passN.out`. exit 0 = 스크립트의 결함 단언이 **아직 모두 성립**(즉 결함이 남아 있음). 스크립트는 결함이 있다고 단언하므로, 고친 뒤에는 해당 단언이 실패하는 것이 정상이다. Codex 원본 폴더(`pipeline-review-20261024`)의 파일은 고치지 않는다.
- 원래 12건(HANDOFF.md)과 PASS2 3건은 이미 v58.7x에 고쳐졌다. PASS4~PASS30은 거의 그대로 남아 있다.
- 문서와 코드가 어긋나면 코드를 기준으로 판단한다. 핸드오프는 맥락이지 증거가 아니다. 각 항목을 지금 코드에서 직접 확인한다.

## 항목별 판정
각 finding(하위 '기타 후보' 포함)에 하나를 붙인다.
- FIXED — 고쳤고 회귀 케이스가 있다.
- ALREADY-FIXED — 지금 코드에서 재현되지 않는다(근거: 파일:줄).
- NOT-A-DEFECT — 의도된 정책이거나 소비 경로가 없다(근거 필요; AGENTS.md 제품 결정과 일치하는지).
- CONSIDER — 가능성 낮은 경계 사례인데 고치려면 복잡도가 크다. 실패 양상·가능성·비용을 한 줄로 적고 구현하지 않는다.
- OWNER — 제품 결정이 필요하다(화면 의미를 바꾸거나 기능을 없앰). 제안만 적는다.
- OUT-OF-OWNERSHIP — 고쳐야 할 파일이 내 소유가 아니다. 파일:줄과 필요한 변경을 적는다(직접 고치지 않는다).

## 고치는 방식
- 가장 낮은 공통 원인에서 부분 패치한다. 전면 재작성 금지. 주변 코드의 이름·주석 밀도·관용을 따른다.
- 반복 클래스: 결측→0, 동률→1위/뒤처짐, 미래 관측→현재, 실패한 수집→이전 성공 자료 삭제, 일부 관측→전체 비율, 서로 다른 기간·통화·기준일 비교, 캐시 키가 내용 변경을 못 봄, 부분문자열 매칭. 같은 클래스가 여러 곳이면 도메인 안의 작은 공통 helper로 모은다(이미 있는 helper가 있으면 재사용 — 먼저 검색).
- 결측은 결측으로 남긴다: 화면은 '—'/'확인 안 됨'으로, 문장은 관측된 수와 분모를 함께 적거나 판정을 보류한다. 0으로 바꾸지 않는다.
- UI 문구는 한국어, 이모지 금지, 출처·URL 텍스트를 숫자 옆에 두지 않는다, 쉬운 말. 새 문구는 짧게.
- 앱이 종목·가격·규모·타이밍을 정하지 않는다(AGENTS.md). 
- Windows/Git Bash: JS는 Edit 도구로 고친다(sed·heredoc 금지). 고친 JS마다 `node --check <file>`.

## 회귀 케이스 (필수)
- 내 영역 파일 `scripts/fixtures/pipeline-semantics/<area>.mjs` 하나만 만든다(다른 영역 파일은 건드리지 않는다). 형식:
```js
// scripts/fixtures/pipeline-semantics/<area>.mjs — v59.45 pipeline review regressions (<한 줄 범위>)
import assert from 'node:assert/strict';
export const cases = [
  { id: 'P26-NAMES-01', name: '이동평균이 없는 종목은 50일선 위로 세지 않는다', run: async ({ load }) => {
      const { buildMyNames } = await load('src/domain/briefing/daily-diff.js');
      const out = buildMyNames({ /* 재현 입력 */ });
      assert.doesNotMatch(out.summary, /대부분은 아직 50일선 위/);
  } },
];
```
- 실제 함수를 작은 고정 입력으로 부른다. 네트워크·실제 사용자 저장소 금지(필요하면 메모리 mock). 실행: `node scripts/ci-pipeline-semantics-check.mjs --only <area>`.
- 기존 게이트도 돌린다: `node scripts/qa-runner.mjs affected --files a.js,b.js --explain`로 관련 게이트 목록을 보고, 브라우저가 아닌 게이트 스크립트를 직접 실행한다(예: `node scripts/ci-esm-core-unit-check.mjs`, `node scripts/ci-expect-output-check.mjs`). 의도한 문구 변화로 expect 출력이 바뀌면 `--update` 후 diff를 읽고 보고한다. text-pin 류 게이트가 의도한 변경으로 실패하면 그 게이트의 remedy를 따르고 보고한다. 브라우저 게이트와 `qa-runner affected`(전체 실행)는 돌리지 않는다.

## 금지
- CHANGELOG.md, `_context/**`, version.json, record-fix/bump-version 실행, `architecture/qa-pipeline.json`, 생성 파일(CURRENT-STATE, `.agents/**`, `*.expect.md`는 `--update`로만), `public-data/**` 손편집, 생산자의 실제 네트워크 실행.
- git commit/stash/checkout/reset/restore 금지. 다른 사람이 바꾼 파일을 되돌리지 않는다. 소유 파일 밖은 편집하지 않는다(다른 작업자가 동시에 고치고 있다).

## 반환 형식 (한국어, 900단어 이내)
1. 표: `id | 판정 | 근본 원인(한 줄) | 수정(파일:줄) | 회귀 케이스`
2. 같은 클래스로 추가로 찾아 고친 곳(파일:줄, 한 줄씩)
3. OUT-OF-OWNERSHIP·OWNER·CONSIDER 목록
4. 실행한 명령과 결과(통과/실패 그대로). 실패를 숨기지 않는다.
5. 원장 기록용 묶음 초안: 결함 클래스별로 묶어 `제목 / 증상(실제 예) / 근본 원인 / 수정 / 예방(게이트)` 각 한두 문장. CHANGELOG용 쉬운 한국어 한 줄도.
