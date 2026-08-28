---
verified_by: product-charter-contract
last_verified: 2026-08-24
confidence: high
auto_refresh: false
target_version: version.json
---

# AIO 현재 제품·아키텍처 헌장

이 문서는 AIO Screener의 최초 설계 의도 자체를 다시 심사한 현재 기준이다. 과거 의도를 무조건 보존하는 문서가 아니라, 무엇을 유지하고 무엇을 재정의하거나 폐기해야 하는지 결정한다. 기계 판독 원본은 `architecture/product-charter.json`이며 이 문서는 판단 근거와 이행 순서를 설명한다.

## 객관적 판정

### 결론

AIO의 중심 명제는 유효하다. 가격·시장 폭·심리·거시·신용·테마·종목 증거를 한 연구 흐름에 묶고, 각 관측치의 출처·시점·신선도·사용 가능 범위를 노출하며, 불확실하면 닫히는 구조는 전문 투자 리서치 제품에 맞는 방향이다.

그러나 최초 방향은 서로 다른 신뢰 조건을 가진 여러 제품을 한 정적 브라우저 앱 안에서 동시에 완성하려 했다. 무료 공개 데이터, 브라우저 대량 fan-out, GitHub Pages 정적 배포, 실시간 전문 터미널 수준, 개인 포트폴리오, 범용 학습 시스템, 개인화 AI를 하나의 경계로 묶은 것은 기술·데이터 권리·운영·개인정보 측면에서 성립하지 않는다. 이 문제는 구현 완성도로 해결할 수 없는 제품 범위와 플랫폼 선택의 모순이다.

| 평가 축 | 점수 | 판정 |
|---|---:|---|
| 사용자 문제와 연구 흐름 | 8/10 | 여러 화면보다 “관찰→선별→비교→설명→기록” 흐름을 중심에 둔 점은 좋다. |
| 증거·출처·실패 폐쇄 철학 | 9/10 | AIO의 가장 강한 자산이며 유지해야 한다. |
| 범위 절제 | 3/10 | 시장 터미널·스크리너·포트폴리오·지식 플랫폼·AI·운영 플랫폼이 한 제품에 결합됐다. |
| 정적 플랫폼 적합성 | 4/10 | 빠른 개인 MVP에는 맞았지만 현재 데이터량·보안·동적 호출·관측성에는 맞지 않는다. |
| 데이터 권리와 실시간성 정합성 | 3/10 | 공개 best-effort 자료를 전문 실시간성과 혼동할 위험이 구조적으로 남았다. |
| AI 설계 의도 / 실제 집행 | 6/10 / 3/10 | 증거 기반 분석가라는 의도는 좋으나 정책이 provider 호출·출력 경계의 단일 강제점이 아니다. |
| 자동화 설계 / 운영 증거 | 7/10 / 4/10 | 게이트는 풍부하지만 실행 도달성·불변 SHA·측정 출처가 분리되지 않은 사례가 있었다. |
| 유지보수성 | 2/10 | 거대 legacy shell과 전역 호환 계층이 변경 비용과 회귀 표면을 지배한다. |
| 사용자 경험 | 6/10 | 정보 밀도와 기능 폭은 강하지만 초기 부팅·DOM·요청량·인지 부하가 크다. |

종합 판정은 “강한 연구 제품 명제, 잘못 결합된 범위와 플랫폼”이다. 비전을 버릴 이유는 없지만, 제품 정체성과 신뢰 평면을 먼저 좁혀야 한다.

## 현재 제품 정체성

AIO는 한국어 자기주도 투자자를 위한 **증거 기반 관찰·스크리닝·의사결정 보조 도구**다. 주문 실행기, 개인화 투자 지시 시스템, 라이선스 전문 실시간 단말, 범용 챗봇이 아니다.

핵심 사용자 작업은 다음 하나의 순환이다.

```text
시장 상태 관찰 → 기회/위험 선별 → 근거 비교 → 불확실성 설명 → 논지 기록 → 결과 복기
```

허용되는 결과는 관찰, 선별, 비교, 설명, 학습, 기록이다. 매수·매도·수량·시점의 개인화된 직접 지시는 적합성 정보와 현재 decision-grade 증거, 관할·제품 정책이 모두 충족되지 않으면 차단한다. 주문 실행은 제품 범위 밖이다.

## 유지·재정의·폐기

| 최초 전제 | 결정 | 현재 의미 |
|---|---|---|
| All-in-one | 재정의 | 모든 기능이 아니라 하나의 연구 루프 안에서 필요한 증거를 연결한다. |
| 실시간 | 재정의 | 측정 지연·권리·관측 시점이 명시된 소스만 real-time이라 부른다. 나머지는 현재 참고 또는 지연 관측이다. |
| 무료 공개 데이터 | 유지하되 제한 | 교육·관찰·참고에는 쓰되 출처 권리가 decision use를 허용하지 않으면 승격하지 않는다. |
| 단일 정적 파일 | 폐기 | 초기 배포 전술이었다. 영구 아키텍처 원칙이 아니다. |
| 모든 것을 자동화 | 재정의 | 판정 가능한 반복 작업만 자동화하고, 권리·접근성 수동 평가·운영 승인은 명시적으로 남긴다. |
| novice/expert 이중 밀도 | 유지 | 같은 증거를 점진적으로 공개하되 서로 다른 진실을 만들지 않는다. |
| fail closed | 유지·강화 | missing≠0, stale/reference 자료의 decision 승격 금지, 불완전한 배포·측정 증거의 인증 금지로 확장한다. |
| 개인화 AI | 조건부 보류 | 증거 합성은 허용하지만 개인 직접 행동은 정책 엔진이 provider 호출 전과 출력 전 모두 차단해야 한다. |
| privacy vault | 보류 | 실제 암호화·키 수명·복구 경계가 증명되기 전에는 vault라고 부르거나 활성화하지 않는다. |

## 현재 구조의 역설계

현재 앱은 GitHub Pages 정적 셸 위에 native ESM strangler를 얹은 legacy-first 하이브리드다. 20개 라우트의 lifecycle·renderer·data 소유권은 native로 표시되지만 chart는 일부, narrative는 거의 전부 legacy이고 `fullNativeOwner`는 아직 없다. `window.AIO_ARCH`와 runtime reader는 여전히 legacy 전역을 읽으므로 native 표시는 완전한 writer retirement를 뜻하지 않는다.

현재 병목은 독립 결함이 아니라 하나의 연결된 구조다.

```text
거대 초기 HTML/JS/DOM
  → 모든 기능의 초기 로드·평가·서비스워커 precache
  → 느린 부팅과 긴 task
  → 브라우저 테스트 불안정·직렬화 비용
  → 작은 수정도 넓은 QA 영향 범위
  → 오류 하나를 고친 뒤 전체 재실행
```

동시에 대형 `public-data` 원본을 정적 배포물에 싣고 브라우저가 투영 작업을 수행한다. 이는 GitHub Pages를 UI 배포면, 데이터 저장소, 변환 엔진, 캐시로 동시에 사용하게 만든다. AI·개인 상태·Cloudflare 동적 호출은 별도의 신뢰 조건이 필요한데도 화면과 전역 상태 안에서 느슨하게 연결돼 있다.

## 목표 아키텍처

```text
제품 헌장 / 권리 / claim policy
                │
     immutable release manifest
                │
┌───────────────┼────────────────┐
│ GitHub Pages  │ Cloudflare     │ bulk artifact store │
│ shell/chunks  │ secrets/quota  │ history/shards      │
│ projections   │ dynamic proxy  │ retention           │
└───────┬───────┴───────┬────────┴──────────┬───────────┘
        │               │                   │
 source adapters → validation/rights/freshness → canonical evidence store
                                                   │
                              selectors/view models/route chunks
                                                   │
                                    evidence-bound AI orchestrator
```

신뢰 평면은 public shell, durable current data, fast market reference, research corpus, personal vault, AI synthesis, operations evidence로 분리한다. 각 평면은 소유자·허용 데이터·금지 데이터·승격 조건을 가진다.

라우트 전환 완료는 native wrapper의 존재가 아니라 legacy writer 제거, 전역 의존 제거, route 단위 lazy loading, 독립 테스트와 rollback 경계까지 포함한다. 브라우저에는 이미 투영되고 크기가 제한된 산출물만 전달한다.

## 전수 역설계 범위와 구현 상태

`AUDITED`는 구조·소유권·증거·실패 경계를 역설계했다는 뜻이며, 구현 완료를 뜻하지 않는다. 완료·부분·미이행·운영자 필요 상태를 한 단어로 뭉개지 않도록 기계 헌장의 `auditCoverage`와 아래 표를 함께 유지한다.

| 영역 | 검토 | 현재 구현 판정 | 핵심 결론 |
|---|---|---|---|
| 제품 의도·전략 | AUDITED | 방향 교정 완료 | 연구 루프와 증거 철학은 유지하고 실시간 단말·주문·범용 AI 범위는 제외했다. |
| 전체 시스템·신뢰 평면 | AUDITED | 가드레일 완료, 이행 중 | Pages·Cloudflare·데이터·지식·개인정보·AI·운영 증거를 일곱 평면으로 분리했다. |
| 프런트엔드 레이어·라우트·런타임 소유권 | AUDITED | 구조 이행 필요 | 20개 라우트에 native 표시는 있으나 `fullNativeOwner`는 0이고 legacy writer/facade가 남았다. |
| 디자인·UI·UX·정보 구조 | AUDITED | 자동 증거 부분 완료, 사용자 검증 필요 | 정보 밀도와 연구 흐름은 강하지만 초기 인지 부하·거대 DOM·실사용자 검증이 남았다. |
| 데이터·출처·신선도·권리 | AUDITED | 가드레일 완료, projection 이행 필요 | allowedUse 단조 제한과 missing/stale 경계는 강화했고 대형 원본의 브라우저 전달은 분리해야 한다. |
| AI·개인정보·보안 | AUDITED | 가드레일 완료, 운영 검토 필요 | provider 전/출력 전 정책과 암호화 경계를 세웠지만 권리·관할·실서비스 관측은 별도다. |
| 성능·부팅·수명주기 | AUDITED | 근본 원인 확정, 이행 필요 | 거대 셸·전역 평가·inactive DOM·browser fan-out이 사용자 성능과 QA 비용을 함께 만든다. |
| 접근성 | AUDITED | 자동 검사 완료, 수동 검사 미완료 | 20-route 자동 계약은 있으나 screen reader·contrast·200% reflow·focus-return은 수동 증거가 필요하다. |
| 검사·검증·테스트 경제성 | AUDITED | 증분 구조로 재설계 | task baseline·phase barrier·failure batch·exact retry를 도입했고 runtime summary와 release deep audit를 분리했다. |
| 내부 자동화 루프 | AUDITED | source 계약 완료, 원격 관측 필요 | 생성→검사→attestation→배포→watchdog 경계를 연결했지만 source PASS는 실제 실행 성공이 아니다. |
| 지식 베이스·MD·스킬·작업환경 | AUDITED | 구조 계약 완료, 사람 의미 검토 미완료 | 생성 원본·catalog·sync·lint·eval fixture를 연결했고 과거 손상 문서 2개와 사람 의미 인증은 남겼다. |
| GitHub CI·Pages 전달 | AUDITED | source 재설계, 배포 수렴 필요 | exact-SHA attestation 경로는 구성됐지만 명시적 push/deploy 전에는 live 동작을 인증할 수 없다. |
| Cloudflare edge·provider | AUDITED | source 계약 완료, live revision 불일치 | 두 plane 건강 상태는 관측했지만 proxy 배포 revision은 로컬 source보다 뒤처져 있다. |
| 릴리스·운영·외부 피드백 | AUDITED | 증거 경계 완료, SLO·운영자 승격 필요 | 로컬·repository·deployed·provider 상태를 분리하며 30일 SLO와 public promotion은 아직 열려 있다. |

여기서 파일 전수는 repository inventory와 owner/registry, generated parity, lint, contract, changed-surface gate로 모든 파일 유형을 추적했다는 뜻이다. 모든 역사 문서·지식 문장·시장 데이터 행을 사람이 한 줄씩 의미 인증했다는 뜻은 아니다. 현재 파일·문서·라우트·스킬·workflow 수는 `_context/CURRENT-STATE.md`에서 파생하며, 두 손상 역사 문서와 사람 semantic/UX review는 명시적 미완료다.

따라서 “모든 영역을 검토했는가”에는 예라고 답할 수 있지만, “모든 구조 개편이 끝났는가”에는 아니라고 답해야 한다. 현재 완료된 것은 진실·정책·검증·배포 계약의 Phase 0이고, 거대 legacy shell 분해와 데이터 배포면 분리는 후속 구조 migration이다.

## 외부 비교와 전문 기준

- OpenBB의 core/extension/provider 분리는 데이터 provider와 사용자 인터페이스를 한 전역 런타임에 결합하지 않아야 한다는 근거다. AIO도 provider adapter와 canonical evidence contract를 UI 밖에 둬야 한다. [OpenBB 개발자 가이드](https://docs.openbb.co/platform/developer_guide), [Provider extension](https://docs.openbb.co/odp/python/developer/extension_types/provider)
- QuantConnect LEAN은 데이터의 시간 흐름을 알고리즘 시간과 결합해 미래 정보 누출을 막는다. AIO의 `observedAt`·snapshot·freshness도 표시용 메타데이터가 아니라 계산과 action permission의 입력이어야 한다. [LEAN 시간 모델](https://www.quantconnect.com/docs/v1/key-concepts/understanding-time)
- TradingView Lightweight Charts는 차트 엔진이며 시장 데이터를 제공하지 않는다. 시각화 품질과 데이터 권리·신선도를 분리해야 한다. [Lightweight Charts](https://tradingview.github.io/lightweight-charts/docs), [제품 비교](https://tradingview.com/charting-library-docs/latest/getting_started/product-comparison/)
- GitHub Pages custom workflow는 빌드 산출물을 artifact로 업로드한 뒤 deploy job에서 그 artifact를 게시하도록 설계한다. mutable branch를 다시 checkout해 테스트되지 않은 동시 상태를 배포하면 안 된다. [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- Workbox는 precache 목록과 새 service worker 배포 시점을 명시적으로 관리한다. 모든 도달 가능 파일을 무조건 precache하는 것은 route chunking의 이점을 없앤다. [Service worker deployment](https://developer.chrome.com/docs/workbox/service-worker-deployment), [Workbox precaching](https://developer.chrome.com/docs/workbox/modules/workbox-precaching)
- 웹 성능 기준은 route별 code splitting과 긴 task 축소를 권한다. AIO의 거대 초기 평가 비용은 기능별 분리 없이는 테스트 최적화만으로 해결되지 않는다. [Code splitting](https://web.dev/articles/reduce-javascript-payloads-with-code-splitting), [Long tasks](https://web.dev/articles/script-evaluation-and-long-tasks)
- Cloudflare Workers 관측성은 로그·trace와 request 단위 속성을 제공한다. 로컬 계약 통과를 실서비스 quota·provider 건강성으로 승격하지 말고 edge 관측 증거로 닫아야 한다. [Workers observability](https://developers.cloudflare.com/workers/observability/), [Workers logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)

## 단계별 구조 개편

### 0. 진실·거버넌스 복구

- 제품 헌장, non-goal, trust plane, claim policy를 기계 계약으로 만든다.
- 데이터 `allowedUse`는 source rights·freshness·명시적 ceiling 중 가장 제한적인 값만 가진다.
- QA manifest 밖의 고아 gate와 실행되지 않는 workflow 검사를 금지한다.
- 측정치는 app revision·commit·환경·명령·artifact에 결합하고 버전 문자열로 승격하지 않는다.
- 민감 로컬 보존은 기본 OFF, 명시 동의, 최소화·redaction, 비활성화 시 삭제를 강제한다.

### 1. 단일 소유권과 호환 계층 축소

- route·source·QA·claim·release 결정을 각각 하나의 machine registry에서 파생한다.
- `AIO_ARCH` facade를 최소 read-only snapshot/event API로 줄이고 mutable global projection을 제거한다.
- `fullNativeOwner`가 없는 상태에서는 native migration 완료를 주장하지 않는다.
- deep link를 URL→route→substate로 정식 모델링한다.

### 2. 수직 slice와 초기 부팅 분해

- route renderer·chart·narrative를 실제 동적 import로 분리한다.
- legacy inline CSS/JS를 추출하고 route 단위 entry와 asset budget을 둔다.
- 서비스워커는 app shell과 critical route만 precache하고 나머지는 runtime cache 정책으로 분리한다.
- DOM은 inactive page를 모두 보존하지 않고 route mount/unmount 수명주기를 따른다.

### 3. 데이터 배포면 분리

- 대형 master/history 원본은 브라우저 전달 전에 schema별 작은 projection과 content-addressed shard로 만든다.
- Pages는 bounded public projection만 게시한다.
- 빠른 관측은 edge proxy, bulk history는 retention 가능한 object store, 연구 corpus는 별도 버전으로 분리한다.

### 4. AI·개인정보 경계 재구축

- planner→evidence retrieval→policy→provider→citation validation→publication의 상태 머신을 하나의 실행 경로로 만든다.
- action permission은 provider 호출 전과 렌더 전 모두 집행한다.
- 암호화 저장소·키 수명·export/delete가 검증되기 전 native personal vault는 비활성 상태로 유지한다.

### 5. 불변 배포와 운영 승격

- refresh가 만든 검증 산출물을 workflow artifact로 고정하고, Pages는 정확한 SHA/산출물만 배포한다.
- GitHub Pages와 Cloudflare는 독립 배포·rollback·revision 증거를 갖고 release manifest가 둘을 연결한다.
- 30일 SLO, live revision, provider rights, edge header, 실제 접근성 수동 증거가 닫힐 때만 public beta로 승격한다.

## 완료의 정의

“파일이 분리됐다”, “게이트가 통과했다”, “native adapter가 생겼다”는 완료가 아니다. 제품 헌장과 구현이 일치하고, legacy writer가 퇴역하며, 현재 revision에 묶인 브라우저·운영 증거가 있고, 실제 live 배포와 provider 권리가 별도로 확인된 경우에만 해당 경계를 완료로 본다.

이 헌장은 설계 방향을 고정하되 구현 세부를 고정하지 않는다. 프레임워크 교체보다 신뢰 평면·소유권·증거 승격 규칙을 먼저 바로잡는다.
