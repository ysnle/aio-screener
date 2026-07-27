---
verified_by: Codex
last_verified: 2026-07-27
confidence: high for code paths, reproduced UI behavior, scheduled provider runs, public Worker reachability, and measured boot behavior; blocked only where an authorized personal key or licensed provider is required
target_version: v53.52
status: IMPLEMENTED_LOCAL_UNVERIFIED
implementation_authorized: true
skills_used: bug-fix; bundled browser control not run per urgent no-test instruction
evidence_scope: repository code, deployed GitHub Pages UI, live save/reload/delete and no-route chat flows, GitHub Actions logs, public artifacts, public Worker probes, local boot/network measurements
---

# API·AI 채팅 신뢰성 집중 진단 및 구조 개편 핸드오프

> 이 문서는 2026-07-27 배포 사이트와 현재 저장소를 대상으로 한 집중 진단 결과와 실행 설계다.
> 코드 수정, 실제 키 입력, Worker 배포, 버전 변경, 커밋·배포는 수행하지 않았다.
> 테스트에는 실제 비밀 키가 아닌 명시적 가짜 키만 사용했고, 시험 종료 시 UI에서 삭제 후 새로고침 상태까지 확인했다.

## 0. 결론

현재 시스템은 “API 키 입력 UI와 호출 코드가 존재한다”는 수준은 충족하지만, 일반 사용자에게 안정적으로 동작하는 API·AI 운영 시스템이라고 확정할 수 없다.

핵심 원인은 다음 다섯 가지다.

1. 공개 사이트의 AI 채팅은 개인 Claude 키 또는 사용자 브라우저에 별도로 저장된 Worker URL이 없으면 호출 전에 차단된다.
2. 공개 사이트에는 모든 사용자가 자동으로 이용할 기본 Worker 채팅 경로가 주입되어 있지 않다.
3. 키 저장 UI가 저장 매체의 쓰기·재읽기 성공을 검증하지 않고 `저장됨` 또는 `✓`를 표시한다.
4. Claude·RSS2JSON·BOK·KOSIS 키의 저장·암호화·복원 계약이 서로 다르고 일부는 Vault 계약에서 빠져 있다.
5. 실제 AI 답변 정확도는 호출 경로가 열린 뒤에만 검증할 수 있는데, 현재 공개 무키 사용자 경로에서는 답변 자체가 생성되지 않는다. 따라서 “모든 기능이 정확한 답변을 제공한다”는 공개 인증은 미완료다.

현재 공개 판정은 다음과 같다.

| 영역 | 판정 | 이유 |
|---|---|---|
| Claude 개인 키 직접 호출 코드 | 조건부 가능 | 키가 `getApiKey()`에 정상 복원되어야 함 |
| 운영자 Worker 채팅 | 공개 기본 경로 없음 | Worker URL과 서버 모드가 사용자 저장소에 있어야 함 |
| 키 저장 성공 표시 | 신뢰 불가 | 저장 후 read-back 검증 없음 |
| Claude 삭제 | 저장소 삭제 코드는 있음 | 즉시 UI 상태와 성공 표시가 일관되지 않음 |
| 확장 API 키 | 조건부 가능 | 공급자별 연결 검증·상태 표시 없음 |
| Vault 암호화 | 일부 가능 | PIN 해제 상태에서 지정 키만 암호화 |
| 모든 키 암호화 | 거짓 | RSS2JSON 저장 경로와 BOK/KOSIS 목록 누락 |
| AI 답변 정확도 | 미인증 | 공개 무키 경로에서 실답변 생성 불가 |
| 공개 사용자 AI 채팅 | NO-GO | 기본 경로 부재와 저장 신뢰성 결함 |

## 1. 실제 라이브 재현 결과

검증 대상:

- URL: `https://ysnle.github.io/aio-screener/`
- 라이브 표시 버전: `v53.51`
- 검증일: 2026-07-27 KST

### 1.1 무키 사용자 채팅

라이브 AI 패널에서 다음 질문을 전송했다.

> 현재 화면의 S&P 500과 VIX 값, 각 값의 기준시각과 판단 가능 여부만 알려줘. 확인되지 않으면 확인 불가라고 답해.

실제 결과:

> AI 답변을 쓰려면 Claude 키를 저장하세요. 브리핑/번역은 운영자 서버키 가능, 채팅은 개인키 또는 Worker 서버키 모드 필요.

이 문구는 Anthropic API가 응답한 오류가 아니다. `index.html:26923-26927`의 사전 경로 검사에서 `_aioHasClaudeRoute(...)`가 false일 때 네트워크 요청 전에 생성된다.

따라서 이 화면의 정확한 의미는 다음과 같다.

- 현재 브라우저에서 유효한 개인 Claude 키를 읽지 못했다.
- 현재 브라우저에서 사용할 Worker URL도 읽지 못했다.
- 운영자 서버에 키가 존재하는지와 무관하게, 채팅 클라이언트가 그 서버 경로를 모른다.
- 이 상태에서는 AI 답변 품질·정확성 검증을 시작할 수조차 없다.

### 1.2 Claude 저장·새로고침·삭제

실제 비밀이 아닌 유효 형식의 시험 문자열로 다음을 확인했다.

1. 입력 후 저장 버튼은 `저장됨`으로 변경됐다.
2. 입력 요소에는 `data-secret-stored="true"`가 설정됐다.
3. 새로고침 후에는 저장 상태 표식이 복원되지 않았다.
4. 저장 직후 삭제 과정에서는 `data-secret-stored`가 남는 상태가 재현됐다.
5. 충분히 대기한 뒤 빈 값 저장을 다시 실행하면 `삭제됨`이 표시됐다.
6. 마지막 새로고침에서 저장 상태 표식이 없는 것을 확인하고 시험을 종료했다.

이 결과는 “모든 브라우저에서 localStorage가 항상 실패한다”는 뜻은 아니다. 확정할 수 있는 결론은 더 제한적이고 중요하다.

- 현재 UI의 `저장됨`은 영속 저장 성공 증명이 아니다.
- 저장 후 재읽기·새로고침 복원·실제 호출 준비 완료를 구분하지 않는다.
- 사용자는 저장 성공처럼 보이는 화면을 본 뒤에도 동일한 “키를 저장하세요” 메시지를 받을 수 있다.

### 1.3 라이브 데이터 상태와 AI 정확성 위험

동일 라이브 화면에서 다음 상태가 함께 관측됐다.

- 상단: `실시간 시세 대기 중`
- S&P 500: 판단용 실시간 값 미수신
- VIX: 값은 보이지만 일부 상태는 판단 제외·부분 데이터
- 여러 자산: 스냅샷 또는 미수신 상태
- BTC 등 일부 소스만 live

AI가 정상 호출되더라도 이 상태에서는 “정확한 모델”만으로 정확한 답을 보장할 수 없다. 모델에 전달되는 Evidence가 누락·지연·혼합 상태이면 응답도 반드시 `확인 불가`, `reference-only`, `asOf`를 보존해야 한다.

## 2. 근본 원인

### RC-01. 공개 채팅 경로가 사용자별 로컬 설정에 의존

관련 코드:

- `js/aio-chat.js:774-781` `_aioClaudeTarget`
- `js/aio-chat.js:792-795` `_aioHasClaudeRoute`
- `index.html:26923-26927` unified chat 사전 차단

현재 대상 선택 규칙:

1. 개인 키가 있으면 Anthropic 직접 호출
2. Worker URL이 있고 서버 모드이거나 개인 키가 없으면 `${Worker URL}/anthropic`
3. 둘 다 없으면 직접 Anthropic URL을 반환하지만 `_aioHasClaudeRoute`가 false여서 호출 전 차단

문제:

- Worker URL은 `aio_cf_worker_url`이라는 사용자 로컬 키에서만 읽는다.
- `aio_claude_server_mode`도 사용자 localStorage 설정인데 공개 UI에서 명확한 ON/OFF 제어가 보이지 않는다.
- 저장소에는 Worker 구현이 있지만 공개 사이트가 기본 Worker URL을 전달받는 설정 계층이 없다.
- “브리핑/번역은 운영자 서버키 가능”과 “채팅은 로컬 Worker 설정 필요”가 사용자 관점에서 한 AI 기능처럼 보이지만 실제 백엔드는 분리돼 있다.

### RC-02. Claude 저장 성공이 낙관적으로 표시됨

관련 코드:

- `index.html:12292-12320` `setApiKey`
- `index.html:12323-12346` `saveSidebarApiKey`

문제:

- `setApiKey()`는 성공 여부를 반환하지 않는다.
- Vault 경로의 `safeLS()`는 await되지 않는다.
- UI는 `setApiKey()` 호출 직후 무조건 `저장됨`을 표시한다.
- 쓰기 후 동일 저장소에서 read-back하지 않는다.
- Safari·스토리지 제한·비동기 암호화 실패·잘못된 저장소 선택을 성공과 구분할 수 없다.

### RC-03. 확장 API 저장도 성공 오판 가능

관련 코드:

- `js/aio-core.js:15870-15880` `safeLS`
- `js/aio-core.js:16005-16035` `_saveApiKey`

문제:

- `safeLS()`가 내부 catch에서 오류를 기록하고 정상 resolve한다.
- `_saveApiKey().then(...)`은 실제 저장 실패 후에도 성공 분기로 들어갈 수 있다.
- `_saveApiKey().catch(...)` 폴백은 `safeLS()`가 reject하지 않으므로 사실상 기대대로 작동하지 않는다.
- 저장 성공 뒤 공급자 연결 시험이 없다.

결과:

> `✓`는 “저장 함수가 끝났다”는 뜻에 가깝고, “키가 영속 저장됐고 공급자가 승인했다”는 뜻이 아니다.

### RC-04. Claude getter가 통합 저장소 계약을 우회

관련 코드:

- `index.html:12273-12290` `getApiKey`
- `js/aio-core.js:15964-15977` `_getApiKey`
- `js/aio-core.js:15848-15856` `_AioVault.getStorage`

문제:

- 확장 키는 `_getApiKey()`를 통해 public mode의 sessionStorage를 존중한다.
- Claude `getApiKey()`는 localStorage를 직접 읽는다.
- 공용 PC 모드의 저장소 정책이 Claude에 일관되게 적용되지 않는다.
- 암호화된 값은 Vault가 잠겨 있으면 빈 키로 처리된다.
- 사용자는 “저장됨”과 “현재 사용 가능”을 구분할 수 없다.

### RC-05. 삭제 UI 상태가 저장소 상태와 분리됨

관련 코드:

- `index.html:12335-12345` `saveSidebarApiKey`

문제:

- 키 저장 시 `data-secret-stored="true"`를 설정한다.
- 빈 값 삭제 시 input value만 비우고 해당 dataset을 명시적으로 제거하지 않는다.
- 버튼의 원래 텍스트를 실행 시점마다 다시 잡아 빠른 연속 조작에서 피드백 문구가 뒤섞일 수 있다.
- 삭제 후 read-back 검증이 없다.

### RC-06. RSS2JSON은 Vault 경로를 우회

관련 코드:

- `index.html:12354-12367` `saveRss2jsonKey`
- `js/aio-core.js:15863-15868` `_AIO_SENSITIVE_KEYS`

문제:

- RSS2JSON은 민감 키 목록에 포함돼 있다.
- 실제 저장 함수는 `safeLS()`가 아니라 localStorage를 직접 사용한다.
- PIN이 설정돼도 이 경로에서 암호화되지 않는다.
- 버튼 피드백도 성공·실패 의미를 전달하지 않는다.

### RC-07. BOK·KOSIS 키가 민감 키·복원·표시 목록에서 누락

관련 코드:

- `index.html:5501-5508` BOK/KOSIS UI
- `js/aio-core.js:15863-15868` 민감 키 목록
- `js/aio-ui.js:631-642` 초기 마스킹 복원 목록
- `js/aio-core.js:16068-16078` 키 snapshot/export 목록

문제:

- `aio_bok_key`, `aio_kosis_key`가 `_AIO_SENSITIVE_KEYS`에 없다.
- Vault PIN을 사용해도 평문 저장될 수 있다.
- 새로고침 시 “저장됨” 마스킹 복원 목록에도 없다.
- 백업·복원 인벤토리와 런타임 사용 키 인벤토리가 다르다.

### RC-08. 저장·인증·연결·데이터 수신 상태가 한 버튼에 혼합

현재 사용자에게 필요한 상태는 최소 다섯 가지다.

1. 입력 형식 유효
2. 브라우저 저장 성공
3. 새로고침 후 복원 성공
4. 공급자 인증 성공
5. 실제 데이터 엔드포인트 응답 성공

현재 UI는 대부분 `저장`, `저장됨`, `✓`만 제공한다. 그래서 사용자는 어느 단계에서 실패했는지 알 수 없다.

### RC-09. Worker 운영 요건은 코드에 있으나 공개 설정 계약이 없음

관련 코드:

- `cloudflare-worker-proxy.js:234-318`

Worker `/anthropic`가 실제로 작동하려면 다음이 모두 필요하다.

- 배포된 Worker URL
- `ANTHROPIC_API_KEY`
- `AIO_QUOTA` KV binding
- 허용 Origin
- 선택적 `AIO_APP_TOKEN` 일치
- kill switch 비활성
- 일일 한도·IP 한도 여유

현재 공개 클라이언트는 이 운영 상태를 자동 발견하지 못한다. Worker가 완벽히 배포돼도 URL이 사용자 브라우저에 없으면 채팅은 연결되지 않는다.

추가 운영 위험:

- 공유 Worker 기본 `max_tokens`는 1500이고 클라이언트는 일반 12000, thinking 16000을 요청한다. 공유 모드에서는 답변이 크게 축약될 수 있다.
- 일일 KV 카운터는 upstream 성공 전 증가하므로 실패 요청도 용량을 소모할 수 있다.
- Worker anycast 지역 403 재시도는 구현돼 있지만 실제 공개 Worker 경로가 없으면 의미가 없다.

### RC-10. API 키의 “로컬 저장” 설명이 불완전

정확한 계약은 다음이어야 한다.

- PIN 미설정: 대다수 키는 해당 브라우저의 localStorage에 평문 저장
- PIN 해제 상태: 민감 목록에 등록된 키만 AES-GCM 암호화 저장
- 공용 PC 모드: 통합 경로를 사용하는 키는 sessionStorage 사용
- Claude·RSS2JSON 등 일부 별도 경로는 통합 계약과 다르게 동작
- API 호출 시 키는 반드시 공급자에게 전송됨
- URL query 방식 API는 키가 요청 URL에 포함될 수 있음
- CF Worker를 사용하면 대상 API 키 또는 키 포함 URL이 해당 Worker를 경유할 수 있음

따라서 “서버에 저장하지 않는다”와 “네트워크로 전송하지 않는다”는 전혀 다른 문장이다. UI와 개인정보 설명에서 분리해야 한다.

## 3. 우선순위 이슈 원장

### P0 — 공개 기능을 막거나 성공으로 오인시키는 문제

| ID | 이슈 | 사용자 영향 | 완료 기준 |
|---|---|---|---|
| API-P0-01 | 공개 AI 채팅 기본 라우트 부재 | 무키 사용자는 항상 사전 차단 | 운영 정책에 따라 공유 Worker 기본 경로 또는 개인키 전용을 명확히 확정 |
| API-P0-02 | Claude `저장됨` 거짓 양성 | 저장했는데 계속 키 요구 | write → read-back → reload 계약 통과 후에만 저장 완료 |
| API-P0-03 | 확장 API `✓` 거짓 양성 | 여러 API가 저장된 것처럼 보이나 미작동 | `safeLS`가 결과를 반환하고 UI가 실제 결과를 표시 |
| API-P0-04 | Vault 잠금 상태와 키 미설정 상태 혼합 | 저장 키가 있어도 키 없음으로 보임 | `LOCKED`, `MISSING`, `READY`, `INVALID` 분리 |
| API-P0-05 | 실답변 정확도 공개 미인증 | 기능·정확성 주장 불가 | 실제 개인키/Worker 두 경로 golden corpus와 evidence 대조 통과 |
| API-P0-06 | 라이브 데이터 부분 장애가 AI 컨텍스트에 전파 | 그럴듯한 오답 위험 | blocked/stale/missing Evidence의 수치·행동 문장 출력 차단 |

### P1 — 보안·일관성·운영 신뢰성

| ID | 이슈 | 완료 기준 |
|---|---|---|
| API-P1-01 | Claude가 public mode 저장소 계약 우회 | 모든 키가 단일 KeyStore API 사용 |
| API-P1-02 | RSS2JSON Vault 우회 | PIN 상태에서 암호화·복원·삭제 시험 통과 |
| API-P1-03 | BOK/KOSIS 민감 목록·마스킹·백업 누락 | 단일 provider registry에서 자동 파생 |
| API-P1-04 | 삭제 시 dataset·aria·버튼 상태 잔존 | 즉시 UI와 reload 후 상태 모두 `MISSING` |
| API-P1-05 | 공급자별 키 형식·연결 시험 부재 | 각 공급자 최소 비용 health endpoint 검증 |
| API-P1-06 | Worker 상태 자동 발견 불가 | 공개 config + `/health` + 기능별 readiness |
| API-P1-07 | 공유 Worker 토큰 한도 불일치 | 클라이언트가 실제 cap을 알고 UI에 표시 |
| API-P1-08 | 실패 요청도 일일 quota 선점 가능 | 성공/청구 가능 응답에만 commit하거나 reservation rollback |
| API-P1-09 | URL query 키·프록시 경유 설명 부족 | 저장/전송/로그/운영자 가시성 계약 명시 |
| API-P1-10 | 런타임 20회와 정적 HTML 58회 drift | 단일 quota source로 렌더 |

### P2 — 진단성·UX·유지보수

| ID | 이슈 | 완료 기준 |
|---|---|---|
| API-P2-01 | 저장 상태와 연결 상태가 한 줄 | 저장·인증·최근 성공·최근 오류 분리 |
| API-P2-02 | 공급자 오류가 페이지별로 흩어짐 | ProviderStatusStore 단일 상태 |
| API-P2-03 | 실제 키 없이 CI가 저장 성공만 검증 | mock provider + operator live certification 이중화 |
| API-P2-04 | 사용자별 문제 재현 정보 부족 | 비밀값 없는 진단 리포트 export |
| API-P2-05 | AI 답변이 어떤 Evidence를 사용했는지 약함 | 답변별 asOf/source/evidenceId/blocked reason 노출 |

## 4. 목표 구조

### 4.1 단일 Provider Registry

각 공급자는 한 곳에만 정의한다.

```text
ProviderDefinition
  id
  displayName
  credentialKey
  credentialPolicy
  storagePolicy
  authTransport
  healthCheck
  capabilities[]
  quotaPolicy
  freshnessPolicy
  privacyNotice
```

이 registry에서 다음을 자동 파생해야 한다.

- UI 입력란
- 민감 키 목록
- 마스킹 복원 목록
- export/import allowlist
- 삭제 대상
- health check
- 시스템 자가진단
- 문서와 개인정보 설명

### 4.2 단일 KeyStore

Claude 전용 `getApiKey/setApiKey`, RSS2JSON 전용 함수, 확장 `_saveApiKey`를 하나의 계약으로 통합한다.

```text
KeyStore.save(providerId, secret) -> SaveResult
KeyStore.read(providerId) -> KeyState
KeyStore.remove(providerId) -> RemoveResult
KeyStore.unlock(pin) -> UnlockResult
KeyStore.verifyPersistence(providerId) -> PersistenceResult
```

필수 상태:

- `MISSING`
- `READY_PLAINTEXT`
- `READY_ENCRYPTED`
- `LOCKED`
- `INVALID_FORMAT`
- `STORAGE_DENIED`
- `PERSISTENCE_FAILED`

비밀 원문은 DOM·로그·진단 export에 절대 포함하지 않는다.

### 4.3 저장과 연결을 분리

각 공급자 UI는 다음을 따로 보여준다.

| 상태 | 예시 |
|---|---|
| 브라우저 저장 | 암호화 저장됨 / 세션 저장됨 / 저장 실패 |
| 인증 | 인증 성공 / 401 / 아직 확인 안 함 |
| 연결 | 정상 / CORS / rate limit / timeout |
| 최근 성공 | 2026-07-27 17:10 KST |
| 사용 기능 | 실시간 시세, 매크로, 뉴스, AI 채팅 |

### 4.4 AI Gateway

모든 AI 표면은 동일한 gateway를 사용한다.

```text
Chat / Briefing / Translation / Market Analysis
                    |
              AIGateway.route()
                    |
       Personal Anthropic | Shared Worker
                    |
           Response Contract Pipeline
```

필수 규칙:

- 어떤 표면도 별도 키 판정 문구를 만들지 않는다.
- `NO_ROUTE`, `VAULT_LOCKED`, `AUTH_FAILED`, `WORKER_NOT_READY`, `RATE_LIMIT`, `REGION_BLOCK`, `TIMEOUT`을 구분한다.
- 공유 Worker가 없으면 “운영자 서버키 가능”이라는 모호한 문구를 노출하지 않는다.
- 현재 실제 사용 가능한 경로만 표시한다.

### 4.5 AI Answer Contract

답변 정확도는 모델 인상 평가가 아니라 claim 단위로 검증한다.

```text
AnswerClaim
  metric
  value
  unit
  direction
  asOf
  source
  evidenceId
  evidenceState
  confidence
  allowedUse
```

차단 규칙:

- current 질문에 stale/reference-only 값을 현재값처럼 답변 금지
- missing 값을 0 또는 중립으로 답변 금지
- source/asOf 없는 구체 수치 금지
- 화면과 Evidence가 불일치하면 `확인 불가`
- 계산은 승인된 deterministic calculator 결과만 사용
- 부분 데이터에서는 매수·매도·목표가 등 행동 문장 금지

## 5. 실행 패킷

### Wave 0 — 운영 정책과 공개 경로 확정

전문가 직접 수행:

1. 공개 AI를 개인키 전용으로 할지, 운영자 공유 Worker도 제공할지 결정
2. 공유 시 Worker URL을 공개 config로 전달하는 방식 결정
3. Worker secrets, KV, Origin, cap, kill switch 운영표 작성
4. 채팅·번역·브리핑의 백엔드 정책 통일

산출물:

- `ai-provider-policy.json`
- `public-config.json`
- Worker readiness endpoint 계약
- 사용자 비용·개인정보 문구

### Wave 1 — KeyStore 통합

전문가 직접 수행:

1. Claude/RSS2JSON/확장 키 저장 경로 통합
2. read-back 검증
3. Vault/public mode/locked 상태 모델
4. 삭제 원자성
5. 민감 키 registry 단일화

하위 에이전트 가능:

- 입력란·상태 배지 UI 반영
- aria-label 및 안내 문구 정리
- provider registry에서 마스킹 목록 생성
- mock storage 테스트 케이스 작성

Wave gate:

- 각 공급자 save → read → reload → remove → reload
- localStorage 차단, quota exceeded, private mode, wrong PIN
- 비밀값 DOM/console/snapshot 누출 0

### Wave 2 — 공급자 연결 진단

전문가 직접 수행:

1. 공급자별 최소 health check 정의
2. CORS/401/403/429/timeout/invalid payload 정규화
3. ProviderStatusStore 도입
4. API별 최근 성공과 freshness 연결

하위 에이전트 가능:

- Alpha Vantage, Finnhub, FRED, Twelve Data, FMP, NewsData, BOK, KOSIS 상태 카드
- 오류 도움말과 키 발급 링크
- mock provider fixture

Wave gate:

- 키가 없는 상태
- 형식이 틀린 상태
- 저장됐지만 인증 실패
- 인증됐지만 데이터 endpoint 실패
- quota 소진
- CORS 또는 proxy 실패

### Wave 3 — AI Gateway와 Worker

전문가 직접 수행:

1. unified/per-page/briefing/translation 호출 경로 단일화
2. 공개 Worker config 로딩
3. `/health`와 `/anthropic` readiness 연동
4. 실패 quota rollback 또는 성공 commit
5. 실제 server cap 전달
6. 경로·모델·프롬프트·validator 버전 감사 로그

Wave gate:

- 개인키 직접 호출
- 공유 Worker 호출
- 개인키 우선 정책
- Worker 장애 시 명확한 전환 또는 차단
- 401/403/429/503/timeout/stream abort
- Haiku/Sonnet/Thinking 선택과 실제 model ID 일치

### Wave 4 — 실제 답변 정확도 인증

전문가 직접 수행:

1. 시장·기술·거시·포트폴리오·한국시장 golden corpus 작성
2. 수치 claim을 화면 Evidence와 자동 대조
3. stale/missing/conflict 반례 테스트
4. novice/expert 응답 가독성 평가
5. 개인키와 Worker 결과 차이 평가

최소 golden corpus:

- 현재 화면 S&P/VIX 값·기준시각·판단 가능 여부
- F&G와 VIX 단위·방향
- 미국 10년물과 DXY의 최신성
- KOSPI/KOSDAQ 휴장·장중·장후 상태
- breadth missing과 neutral 구분
- bp와 %, FX 역수, 양수·음수 방향
- stale snapshot을 current로 오인하지 않기
- 상충 출처에서 확정 답변 금지
- 포트폴리오 미입력 시 개인화 판단 금지
- 구체 매매 지시 차단

합격 기준:

- 수치 claim 근거 일치 100%
- 단위·방향 오류 0
- stale/current 혼동 0
- missing/zero 혼동 0
- 금지 행동 문장 0
- 비근거 고유명사·이벤트 생성 0

### Wave 5 — 공개 운영 인증

1. 24시간 API 상태 수집
2. 7일 공급자별 성공률·지연·429·fallback 통계
3. 데스크톱·모바일·시크릿·스토리지 제한 브라우저 점검
4. 신규 사용자·기존 키 사용자·Vault 사용자·공용 PC 사용자 점검
5. 실제 Pages와 Worker 버전·config·secret readiness 일치 확인

최종 공개 gate:

- 키 저장 성공률
- provider 인증 성공률
- 채팅 성공률
- p50/p95 첫 토큰 지연
- stream 중단률
- stale Evidence 답변 차단률
- 사용자에게 노출된 거짓 `저장됨` 0

## 6. 테스트 실행 전략

사용자 요구대로 작은 수정마다 전체 테스트를 반복하지 않는다.

### 작업 중

- 파일 단위 syntax/lint
- 변경 함수의 contract test
- 관련 provider 또는 route smoke test

### 큰 작업 단위 종료 시

- Wave 1 종료: KeyStore/Vault 전체
- Wave 2 종료: 모든 provider mock matrix
- Wave 3 종료: 개인키/Worker/오류 matrix
- Wave 4 종료: AI golden corpus/claim validator

### 전체 작업 종료 시

- 전체 headless
- 22 route
- viewport/accessibility/security
- Worker contract
- 실제 Pages live
- 실제 Worker live
- 장시간 soak

즉, `소규모 변경마다 전체 회귀`가 아니라 `국소 검증 → Wave gate → 최종 전체 검증` 순서다.

## 7. 파일별 작업 지도

| 파일 | 핵심 대상 |
|---|---|
| `index.html` | Claude/RSS2JSON UI, unified chat 사전 검사, 저장·삭제 피드백 |
| `js/aio-core.js` | KeyStore, Vault, 민감 키 registry, `_saveApiKey`, 오류 계약 |
| `js/aio-ui.js` | 저장 상태 복원, provider status UI, quota 단일 렌더 |
| `js/aio-chat.js` | AI route, 직접/Worker 호출, stream/error 계약 |
| `js/aio-data.js` | 공급자 호출, 번역·브리핑 경로, provider status 기록 |
| `cloudflare-worker-proxy.js` | `/health`, `/anthropic`, quota commit, cap/readiness |
| `worker/wrangler*.toml` | KV·secret·환경별 binding 계약 |
| `scripts/ci-worker-anthropic-check.mjs` | Worker failure matrix |
| `scripts/ci-runtime-contract-check.mjs` | registry/KeyStore/AI route 정적 계약 |
| `js/aio-tests.js` | 저장·복원·삭제·claim accuracy 회귀 |

## 8. 사용자 화면 개편안

Claude 영역 예시:

```text
Claude AI
경로: 개인 키 직접 호출
브라우저 저장: 암호화됨
Vault: 해제됨
인증: 정상
최근 성공: 17:10 KST
[연결 시험] [키 교체] [삭제]
```

Worker 영역 예시:

```text
운영자 AI 서버
상태: 사용 불가
원인: 공개 Worker 경로 미설정
채팅: 불가
브리핑: 최근 서버 생성본 사용 가능
번역: 조건부 가능
```

API별 예시:

```text
FRED
저장: 완료
인증: 정상
최근 수신: 16:55 KST
다음 갱신: 17:55 KST
사용 기능: 거시경제
```

사용자에게 금지할 모호한 표시:

- 저장됨
- 연결됨
- 정상
- 실시간

각 문구는 무엇이 저장·연결·정상·실시간인지 대상과 시각을 함께 표시해야 한다.

## 9. 최종 인수 체크리스트

### 키

- [ ] Claude 포함 모든 키가 단일 registry에 존재
- [ ] PIN 사용 시 모든 민감 키 암호화
- [ ] public mode에서 모든 키가 탭 종료 후 제거
- [ ] 저장 후 read-back과 reload 복원 확인
- [ ] 삭제 후 DOM·메모리·storage·reload에서 모두 제거
- [ ] 원문 키가 DOM·console·export·오류에 노출되지 않음

### API

- [ ] 각 공급자별 인증/연결/최근 성공 상태
- [ ] 401/403/429/CORS/timeout 구분
- [ ] 키 없는 fallback이 어떤 데이터인지 표시
- [ ] stale 데이터가 current로 표시되지 않음
- [ ] Worker 경유 시 전송·로그 정책 표시

### AI

- [ ] 무키 공개 정책이 화면과 실제 동작에서 일치
- [ ] 개인키와 Worker 양쪽 실제 호출 성공
- [ ] 모든 AI 표면이 동일 gateway와 error contract 사용
- [ ] 답변 수치가 Evidence와 일치
- [ ] source/asOf/evidence state 표시
- [ ] missing·stale·conflict에서 확정 답변 차단
- [ ] 실제 모델·토큰 cap·quota가 UI와 일치

### 운영

- [ ] Pages 공개 config와 Worker 배포 버전 일치
- [ ] Worker secrets/KV/Origin readiness 확인
- [ ] 공급자별 7일 SLO 확보
- [ ] 실제 사용자 브라우저 저장 제한 시나리오 통과
- [ ] 최종 전체 검증은 모든 Wave 완료 뒤 1회 수행

## 10. 다음 작업자가 가장 먼저 할 일

1. API-P0-01 정책 결정: 개인키 전용 또는 공유 Worker 제공
2. 현재 공개 Worker URL·KV·secret·Origin 실재 여부 운영자 확인
3. API-P0-02/03을 막는 단일 `KeyStore.save()` 결과 계약 설계
4. Claude/RSS2JSON/BOK/KOSIS를 통합 registry에 편입
5. 저장·reload·삭제 browser contract를 먼저 만든 뒤 구현
6. AI route가 열린 후에만 실제 답변 정확도 golden corpus 실행

이 순서를 바꾸면 저장 성공처럼 보이는 상태와 공개 경로 부재를 그대로 둔 채 프롬프트·모델·화면만 고치게 된다. 현재 가장 먼저 해결해야 할 것은 모델 품질이 아니라 `자격 증명 상태의 진실성`과 `실제로 도달 가능한 AI 경로`다.

## 11. 추가 실증: 자동화 운영·공개 경로·초기 로딩 성능

이 절은 최초 진단에서 실증하지 못했던 운영 자동화와 성능 범위를 2026-07-27에 추가 확인한 결과다. 코드 수정이나 배포 없이 공개 엔드포인트, GitHub Actions 실행 기록, 현재 공개 산출물, 저장소 제공 부팅 검사를 사용했다.

### 11.1 무엇이 실제로 작동했고 무엇이 아직 작동하지 않는가

| 항목 | 실제 증거 | 판정 |
|---|---|---|
| 정기 시장 데이터 갱신 | 최신 `Refresh market data` 성공, 시세 78/78, 생성 시각 2026-07-27 16:52 KST | 작동 |
| FRED 거시 데이터 | 실행 환경에 키 존재, 수집 성공, 공개 산출물에 27개 키 | 작동 |
| 서버 Claude 시장 분석 | 실제 `claude-haiku-4-5` 생성 성공, `marketAnalysisOk=true` | 작동 |
| Fear & Greed·뉴스 | F&G 39, 뉴스 40개 생성 | 작동 |
| BLS | 6개 계열 cached-fresh | 조건부 작동 |
| SEC 펀더멘털 | 539건, 커버리지 74.3% | 부분 작동 |
| 빠른 시세 Worker | 공개 `/health` 성공, watchdog 16/16 | 작동 |
| 공개 Claude 채팅 Worker | 빠른 시세 Worker의 `/anthropic`이 404, 별도 공개 URL 미구성 | 작동하지 않음 |
| 개인 Claude 키 실호출 | 사용자의 실제 비밀 키를 읽거나 대신 사용하지 않음 | 미실증 |
| FMP | 저장소 Secret 이름은 존재하나 `refresh-data.yml`이 전달하지 않고 CI도 미전달을 강제 | 파이프라인 비활성 |
| Twelve Data | 워크플로 입력은 있으나 현재 Secret 미등록, Yahoo 실패 시 폴백 불가 | 비활성 |
| 유료 심리·한국 거래소 일부 | 라이선스·공급자 권한 미확보 | 차단 |

중요한 구분은 다음과 같다.

- GitHub Actions의 Anthropic 키는 “정기 시장 분석문 생성”이 실제 동작한다는 증거다.
- 이것은 브라우저의 대화형 채팅 Worker가 동작한다는 증거가 아니다.
- 현재 공개 빠른 시세 Worker는 시세 전용이며 Claude 프록시가 아니다.
- Secret 이름이 저장소에 존재하는 것과 해당 워크플로가 그 Secret을 전달하고 실제 호출하는 것은 별개의 상태다.

따라서 AI 전체를 하나의 “작동/비작동”으로 표시하면 안 된다. 최소한 `서버 정기 분석`, `브라우저 개인키 채팅`, `공유 Worker 채팅`을 서로 다른 capability와 SLO로 관리해야 한다.

### 11.2 데이터 자동화 상태의 객관적 판정

최신 watchdog은 다음을 실제 확인했다.

- `data.json` age 6분
- 핵심 시세 78/78
- 시장 스냅샷 16/16
- 빠른 시세 plane 16/16
- FRED·Fear & Greed 정상
- 텔레그램 1,574건·3개 채널
- 스크리너 845/870

그러나 공개 운영 상태 산출물은 동시에 다음을 표시했다.

- `operations-status.json`: `overall=OPERATOR_REQUIRED`
- durable plane: `CURRENT`
- fast plane: `OPERATOR_REQUIRED`
- `reconciliation-status.json`: `PARTIAL`
- 22개 카테고리 중 `MATCH 3`, `PARTIAL 14`, `BLOCKED 5`

이는 실제 빠른 plane 16/16 성공과 운영 상태 문서가 서로 다른 시점 또는 판정 기준을 사용한다는 뜻이다. 자동 수집 자체는 상당 부분 작동하지만, “현재 운영 상태를 사용자와 운영자에게 정확히 설명하는 제어면”은 아직 일치하지 않는다.

필수 개편:

1. watchdog의 런타임 성공 결과가 `operations-status.json`의 fast-plane readiness로 환류되어야 한다.
2. `Secret configured`, `workflow wired`, `last call succeeded`, `data current`, `licensed for use`를 서로 다른 필드로 둔다.
3. 데이터 카테고리의 `MATCH/PARTIAL/BLOCKED`가 사용자 화면의 값·배지·판단 가능 여부에 직접 연결되어야 한다.
4. 서버 정기 분석 성공을 공개 채팅 가능으로 오해하지 않도록 AI capability 상태를 분리한다.

### 11.3 초기 접속 성능 실측

저장소의 실제 부팅 검사 결과:

```json
{
  "fcpMs": 1644,
  "dclMs": 694,
  "loadMs": 2685,
  "maxLongTaskMs": 867,
  "totalLongTaskMs": 3662,
  "longTaskCount": 19,
  "domNodes": 6938,
  "routeMs": 900,
  "wallMs": 8112
}
```

부팅 네트워크 검사 결과:

```json
{
  "totalExternalRequests": 209,
  "quoteRequests": 83,
  "quoteRequestCeiling": 100
}
```

현재 주요 운영 파일의 전송·실행 부담:

| 묶음 | 압축 전 | gzip 전송량 |
|---|---:|---:|
| `index.html` + core/data/ui/chat | 약 5.0 MB | 약 1.38 MB |
| 초기 DOM | 약 6,938 nodes | 해당 없음 |
| `src/` 모듈 | 108개, 약 459 KB | 별도 요청·파싱 |

주요 정적 복잡도 신호:

- `_aioRegisterTimer(...)` 21곳
- `new Chart(...)` 23곳
- `DOMContentLoaded` 64곳
- `MutationObserver(...)` 3곳
- Service Worker가 초기 shell에 광범위한 `src/` 모듈을 pre-cache

현재 CI는 이 결과를 통과시킨다. 그러나 `maxLongTaskMs <= 2500`, `quoteRequests <= 100`이라는 한계는 “동작 불능 방지” 수준이지 쾌적한 사용자 경험의 합격선이 아니다. 특히 장기 작업 누적 3.66초는 아예 실패 조건에 포함되지 않는다.

### 11.4 구형 노트북에서 더 느린가

그렇다. 구형 CPU·적은 메모리·느린 저장장치에서는 다음 비용이 더 크게 증폭된다.

- 약 5 MB JavaScript/HTML의 압축 해제·파싱·컴파일·실행
- 약 6,938개 DOM의 스타일 계산과 레이아웃
- 23개 차트 후보와 다수 초기화 소유자의 실행
- 83개 시세 요청을 포함한 209개 외부 요청의 경쟁
- 19개 long task 동안 입력·스크롤·탭 전환이 밀리는 현상

다만 “구형 노트북이라서 어쩔 수 없다”가 결론은 아니다. 현재 측정치는 현대 장비에서도 메인 스레드 누적 차단과 과도한 요청 fan-out이 존재함을 보여 준다. 구형 장비는 기존 구조적 비용을 더 크게 드러낼 뿐이다. CPU가 2~4배 느리면 동일 JavaScript 작업도 대략 그 폭으로 늘 수 있지만, 이 수치는 장치별 실측이 아닌 합리적 추정이며 인증 수치로 사용하면 안 된다.

### 11.5 라이브 화면에서 느림으로 인식되는 별도 원인

캐시를 완전히 제거한 냉간 실험은 아니지만, 새 라이브 탭에서 다음을 관찰했다.

- 최초 이동 약 4.6초
- 약 30초 이후에도 헤더에 `실시간 시세 대기 중`
- 같은 시점에 기준 시세 스냅샷 16개와 시장 점수는 이미 표시
- S&P 500·NASDAQ 등 핵심 카드 값은 실시간 직접 수신 실패 정책 때문에 `—`
- 사용 가능한 기준 스냅샷이 있어도 화면 전체가 계속 미완료처럼 보임

이는 실제 성능 문제와 상태 표현 문제가 겹친 결과다. 백그라운드 실시간 갱신이 실패하거나 지연돼도 검증된 기준 스냅샷은 이미 사용 가능하다. 그럼에도 최상단 상태가 계속 “대기 중”이고 핵심 카드가 비어 있으면 사용자는 전체 로딩이 끝나지 않았다고 느낀다.

상태 계약은 다음처럼 바꿔야 한다.

```text
초기 HTML
  → 같은 출처 기준 스냅샷 즉시 표시
  → "기준 시세 표시 중 · 실시간 갱신 중"
  → 빠른 plane 단일 배치 갱신
  → 성공: "실시간 · 기준시각"
  → 실패: 기준값 유지 + "실시간 갱신 지연"
```

판단에서 stale 값을 제외하는 정책은 유지하되, 값 자체를 숨기는 것과 판단에 사용하지 않는 것을 분리해야 한다.

### 11.6 성능 근본 개편안

#### PERF-P0-01 — 초기 요청 폭발 제거

- 첫 화면은 빠른 plane의 Tier-0 16개를 한 번의 배치 요청으로 받는다.
- 나머지 67개 이상 시세와 페이지별 데이터는 해당 페이지 진입 또는 idle 시점까지 지연한다.
- 목표: 초기 외부 요청 25개 이하, 시세 요청 1개 배치 또는 최대 16개.

#### PERF-P0-02 — 초기 실행 코드와 DOM 축소

- 첫 화면에 필요한 DOM만 생성하고 21개 나머지 페이지는 route 진입 시 mount한다.
- chat·glossary·portfolio·RRG·screener·상세 차트 코드를 dynamic import한다.
- 대형 legacy core/data의 즉시 실행 부작용을 bootstrap 명령으로 옮긴다.
- 목표: 초기 DOM 2,500개 이하, 초기 decoded JavaScript 1.5 MB 이하.

#### PERF-P0-03 — 메인 스레드 장기 작업 제거

- 초기 작업을 50ms 이하 단위로 분할하고 `requestIdleCallback` 또는 scheduler/yield 계층으로 넘긴다.
- 비활성 페이지 차트는 생성하지 않고 페이지 이탈 시 반드시 destroy한다.
- 64개 `DOMContentLoaded` 소유자와 21개 등록 타이머를 단일 lifecycle scheduler로 수렴한다.
- 목표: 최대 long task 200ms 이하, 누적 long task 1초 이하.

#### PERF-P1-04 — snapshot-first 상태 표현

- 기준 스냅샷을 첫 의미 있는 화면으로 사용한다.
- `대기 중`, `기준값 표시`, `실시간`, `지연`, `실패`를 단일 상태 기계로 관리한다.
- 값의 표시 가능성과 투자 판단 사용 가능성을 별도 필드로 둔다.

#### PERF-P1-05 — 캐시 전략

- HTML과 `version.json`은 재검증 중심으로 유지한다.
- 버전/해시가 붙은 JS·CSS는 장기 immutable cache로 전환한다.
- 현재 주요 JS 응답의 `Cache-Control: max-age=600`만으로는 재방문 비용 절감이 제한적이다.
- Service Worker install에서 모든 route 모듈을 선제 다운로드하지 말고 core shell과 route chunk를 분리한다.

#### PERF-P1-06 — 저사양 성능 인증 게이트

큰 작업 Wave 종료 시 다음 프로필을 자동 검사한다.

| 프로필 | CPU/네트워크 | 핵심 목표 |
|---|---|---|
| 표준 | 일반 desktop, broadband | FCP ≤ 2.0s, 상호작용 ≤ 3.5s |
| 저사양 | 4× CPU slowdown, Fast 3G | FCP ≤ 3.0s, 상호작용 ≤ 6.0s |
| 재방문 | cache warm | 의미 있는 화면 ≤ 1.5s |

공통 실패 조건:

- 초기 외부 요청 > 25
- 초기 시세 요청이 배치 1건 또는 상한 16건 초과
- 최대 long task > 200ms
- 누적 long task > 1,000ms
- 초기 DOM > 2,500
- 10초 이후 `실시간 시세 대기 중`이 그대로 남음
- 기준 스냅샷이 있는데 핵심 카드가 이유 없이 `—`

### 11.7 검증 실행 순서

사용자가 요청한 테스트 비용 정책을 유지한다.

1. 각 구현 작업 중에는 변경 영역의 빠른 계약 검사만 수행한다.
2. PERF-P0 단위가 끝날 때 표준·저사양 부팅 검사와 화면 smoke를 1회 수행한다.
3. API/AI Wave가 끝날 때 실제 경로별 계약·오류·정확도 검사를 1회 수행한다.
4. 모든 Wave가 끝난 뒤 전체 회귀·22페이지·데이터 파이프라인·접근성·성능 검사를 최종 1회 수행한다.

매 작은 패치마다 전체 검증을 반복하지 않는다. 대신 P0 경계에서 다음 Wave로 넘어가기 전에 실패를 닫는다.

### Codex 실행 결과 — v53.52 (2026-07-27)

이번 요청에서 코드로 닫을 수 있는 Wave 1~3 일부를 반영했다.

- Provider credential registry를 단일화하고 `safeLS` 저장 결과·readback·삭제 결과를 확인하도록 변경했다. Claude/RSS2JSON/BOK/KOSIS를 동일한 민감 키·복원·백업 경로에 포함했다.
- AI 채팅/브리핑/번역의 라우트 확인을 개인 키 또는 명시적 Worker로 통일하고 `NO_ROUTE`, `VAULT_LOCKED`, `WORKER_NOT_READY`를 구분했다. 공개 기본 설정에는 실제 Worker URL을 넣지 않았다.
- Worker에 비밀을 노출하지 않는 `/health` 응답, 실제 `max_tokens` 응답 헤더, 실패 요청 quota rollback을 추가했다.
- `operations-status.json`에 비밀 설정·워크플로 연결·최근 호출 성공·데이터 최신성·사용 권한을 분리한 readiness와 예약 분석/공개 채팅 분리를 추가했다. 부트 성능 측정값과 목표는 `architecture/operations-slo.json`에 기록했다.
- 로컬 브라우저, 실제 Claude 키, 공개 Worker URL/KV, 공급자 라이선스, FMP/Twelve Data secret, 저사양 성능 검증은 긴급 실행 지시에 따라 수행하지 않았다. 따라서 이 실행 결과는 `IMPLEMENTED_LOCAL_UNVERIFIED`이며 공개 AI 품질/실시간 운영 성공을 인증하지 않는다.

### 11.8 남아 있는 실증 불가 범위와 해소 조건

| 범위 | 현재 못 한 이유 | 해소 조건 |
|---|---|---|
| 개인 Claude 키 실제 답변 | 실제 사용자 비밀 키 사용 권한 없음 | 시험 전용 키와 비용 한도 제공 |
| 공개 Worker 채팅 답변 | 공개 Worker 경로 자체가 없음 | Worker 배포·URL 주입·KV/quota 설정 |
| FMP 실제 enrichment | 현재 workflow가 Secret을 전달하지 않도록 구성 | 정책 결정 후 별도 승인된 실행 |
| Twelve Data 폴백 | Secret 미등록 | 키 등록 후 Yahoo 의도적 실패 fixture |
| AAII/NAAIM/II 원문 | 라이선스·재배포 권한 미확보 | 적법한 공급 계약 |
| 저사양 장치 절대 체감 시간 | 동일 장치 실측 없음 | 4× throttle CI와 실제 저사양 장치 표본 |

이 범위는 막연한 “미확인”이 아니다. 각 항목의 차단 조건과 다음 인증 방법이 특정되어 있다. 현재 증거만으로 확정 가능한 결론은 다음과 같다.

> 데이터 자동화의 핵심 서버 경로는 실제 작동하지만 완전하지 않고, 공개 AI 채팅 경로는 실제로 열려 있지 않다. 초기 로딩 지연은 저사양 장비에서 더 심해지지만 원인은 장비만이 아니라 과도한 초기 코드·DOM·요청·상태 표현을 포함한 앱 구조에도 있다.

## 12. Web Research·핵심 데이터 추가 재감사

상세 실행 계약은 `WEB-RESEARCH-CRITICAL-DATA-REMEDIATION-HANDOFF-2026-07-27.md`를 따른다. 이 절은 API/Worker/운영 관점의 필수 연결점만 요약한다.

### 12.1 경로 존재와 Research 준비 완료를 분리

현재 AI route readiness만으로 Web Research readiness를 증명할 수 없다.

```text
ChatRouteReady
WebSearchToolReady
ExternalSearchProviderReady
PrimarySourceAdaptersReady
CitationPipelineReady
```

각 상태는 별도로 운영해야 한다.

- 개인 Claude 키가 유효해도 조직·모델·tool 설정에 따라 native search가 실패할 수 있다.
- Worker `/anthropic`이 동작해도 web-search tool을 실제로 지원·호출·인용하는지는 별도 probe가 필요하다.
- Perplexity/Google 키가 저장돼도 인증·quota·검색 결과 품질은 별도 상태다.
- 검색 호출 실패 후 일반 답변을 계속 생성하는 현재 경로는 최신·원인 질문에서 fail-open이다.

### 12.2 Worker health 확장

비밀을 노출하지 않고 최소 다음을 제공한다.

```text
ai:
  chatReady
  model
  maxTokens
webResearch:
  nativeToolConfigured
  nativeToolVersion
  modelSupported
  quotaReady
  lastProbeStatus
  lastSuccessfulAt
```

외부 개인키 검색은 브라우저 진단 상태로 분리한다.

```text
perplexity: MISSING | LOCKED | SAVED_UNVERIFIED | READY | AUTH_FAILED | RATE_LIMITED
googleCse:  MISSING | PARTIAL_CONFIG | SAVED_UNVERIFIED | READY | AUTH_FAILED | RATE_LIMITED
```

### 12.3 운영 artifact의 새 필수 지표

- screener 행별 `observedAt` 분포와 mixed revision
- market snapshot의 session `UNKNOWN` 수
- previous-close expected와 unexpected stale 수
- 필드별 fundamental coverage
- freshness-weighted filing coverage
- 뉴스 source-tier·content-depth 분포
- 검색 provider·tool별 최근 성공과 오류
- required research 실패 후 차단된 claim 수
- claim-source binding 통과율

단순 `16/16`, `845/870`, `74.3%`, `웹검색 ✓`는 운영 준비 완료 지표로 사용하지 않는다.

### 12.4 추가 P0

| ID | 이슈 | 완료 기준 |
|---|---|---|
| API-P0-07 | 필수 Web Research가 키·route 부재로 조용히 미실행 | `RESEARCH_REQUIRED_BUT_UNAVAILABLE` 및 current/causal claim 차단 |
| API-P0-08 | 검색 실패 후 일반 답변 진행 | 필수 검색 실패가 Answerability를 낮추고 사용자에게 표시 |
| API-P0-09 | AI/검색 readiness 혼합 | Chat·native tool·external provider·citation readiness 분리 |
| API-P0-10 | 단일 데이터 coverage가 준비 완료로 오인 | 질문별 다차원 DataReadiness와 field/freshness/session 공개 |
| API-P0-11 | 서버 AI metric 혼동도 semantic verified 통과 | metric identity·value·unit·asOf·source·causal claim validator |

이 P0와 기존 공개 Chat route·KeyStore P0는 병렬로 닫되, 실제 모델 품질 인증은 두 경로와 데이터 readiness가 모두 열린 뒤 수행한다.
