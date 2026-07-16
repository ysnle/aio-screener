---
verified_by: Codex
last_verified: 2026-07-16
target_version: v53.2
status: tracked-nonblocking
---

# AIO Screener — 남은 작업 원장

이 문서는 v52.61 작업·배포 후 남은 항목을 별도로 추적한다. 아래 항목은 현재 배포를 막는 장애가 아니다. 새 세션은 사용자가 명시적으로 요청한 항목만 착수하며, 자동으로 범위를 확장하지 않는다.

## 현재 릴리스 상태

- GitHub Pages v52.61 배포 대기(로컬 변경 검증 완료).
- 최종 로컬 게이트 23/23 PASS.
- 원격 CI `29177961370` 및 Pages deploy PASS.
- Worker `https://aio-proxy.zmfhd007.workers.dev` 실제 server-mode 호출 HTTP 200/`OK` 확인.
- `AIO_QUOTA`, `ANTHROPIC_API_KEY`, `ANTHROPIC_DAILY_CAP=300`, `ANTHROPIC_MAX_TOKENS=1500`, `AIO_APP_TOKEN=aio-screener-app-v1` 설정 확인.

## 남은 항목

| 항목 | 상태 | 담당/필요 조건 | 현재 배포 차단 여부 |
|---|---|---|---|
| H2-05 공개 Pages Portfolio Vault cross-reload·legacy migration 실브라우저 증거 | 완료 | 라이브 Chromium에서 PFE2-01~08 PASS | 아니오 |
| H2-09 22페이지 시각적 density·first-screen 최종 판단 | 사람 검토 대기 | Codex가 스크린샷/수치 근거를 만들고 사용자가 방향 승인 | 아니오 |
| H2-11 Firefox/WebKit/NVDA 핵심 흐름 | 외부 환경 대기 | Firefox/WebKit 바이너리 및 Windows NVDA 실제 환경 필요 | 아니오 |
| H2-12 13개 매매 핵심 입력 cross-surface provenance parity·lineage export | 완료 | runtime bundle ID를 score/UI/page-to-AI/normal chat context에 연결하고 T930/992 headless PASS | 아니오 |
| H2-13 Trading Score PIT/OOS/cost/calibration 연구 | 축소 검증 완료 | PIT 데이터·비용 가정·주장 수준 결정 필요 | 아니오 |
| H2-14 Factor Engine PIT/delisted/cost/adaptive-weight 검증 | 축소 검증 완료 | PIT universe·delisted·비용 데이터 필요 | 아니오 |
| H2-15 legacy storage/snapshot 전면 이전 | 부분 완료(안전한 1차 slice 완료) | portfolio storage/opt-out adapter slice 완료; legacy snapshot direct reads와 global writes는 별도 대규모 slice | 아니오 |

## 사용자가 직접 해야 하는 것

현재 필수 운영 작업은 없다. 다음은 공개 품질 또는 연구 주장을 확장할 때만 사용자 판단이 필요하다.

1. NVDA 실제 스크린리더 검증을 공개 게이트로 요구할지 결정한다.
2. H2-09의 시각적 density/정보량 방향을 승인한다.
3. H2-13/H2-14를 완전 검증할 PIT·delisted·거래비용 데이터와 연구 주장 수준을 결정한다.

Cloudflare 설정, Git 권한, Portfolio live cross-reload, 최종 테스트, commit/push, Pages 배포는 완료됐으며 사용자가 다시 수행할 필요가 없다.

H2-15의 남은 두 하위 slice는 사용자 확인이 필요한 항목이 아니라 코드베이스 구조를 크게 건드리는 장기 refactor다. 현재 상태에서는 기존 encrypted Vault 경로를 우회하지 않도록 portfolio slice까지만 안전하게 닫고, snapshot direct reads/global writes는 별도 커밋·회귀검증 단위로 남겨 두었다.

## 재개 규칙

- 사용자가 특정 H2 항목을 요청할 때만 해당 항목을 별도 작업으로 시작한다.
- H2-13/H2-14의 미충족 연구 조건을 충족한 것으로 표현하지 않는다.
- Firefox/WebKit/NVDA 증거 없이 PUBLIC 게이트 PASS라고 표현하지 않는다.
- 남은 항목을 이유로 현재 v52.61 배포를 되돌리거나 재작업하지 않는다.


## 2026-07-16 배치(P713~P715, v53.0~v53.2) 이후 남은 작업 — 다음 세션 진입점

이번 배치에서 사용자가 AskUserQuestion으로 확정한 결정과 실행 결과는 CHANGELOG v53.0~v53.2, BUG-POSTMORTEM P713~P715, 메모리 `project_full_system_audit_2026-07-16` 참조. 아래는 **사용자가 이미 방향을 확정했으나 미착수/후속 확인이 남은 항목**이다.

### A. 다음 세션 최우선 (사용자 확정: "이번 배치 후 착수")
1. **전술 스코어 percentile/레짐 상대화 재설계** — 절대 임계값(vix<15, dxy>107, tnx>4.5 등)을 10년 롤링 percentile/z-score 기반으로 재설계 후 `scripts/backtest-trading-score-longrun.mjs`로 재백테스트. 통과(유의한 양의 IC) 못 하면 현행 "환경 설명값" 라벨 유지가 확정 정책. WO-2 원결과: 21일 rho=-0.165, 63일 -0.255.
2. **IA 잔여** — 첫화면(signal 히어로) 스코어 게이지 강등(숫자 크게 쓰지 않기), 첫 방문 온보딩(브리핑/시장/학습 3버튼). 사이드바 4그룹 재편은 v53.2에서 완료.

### B. 배포 후 확인 필요 (이번 배포의 후속 검증)
3. **다음 cron 산출물 검증** — refresh-data(시간당)·refresh-screener(6h)·telegram(주기) 크론이 patched producer로 재생성한 라이브 아티팩트에서: data.json `quotes===[]`+`meta.quotesPublished:false`, screener.json 행에 `price` 부재(validator가 차단), telegram-digest topItems/broadItems에 `text` 부재·`summary`만 존재를 curl로 확인. 실패 시 producer 경로/워크플로 로그 확인.
4. **KR 접힘 메뉴/정지 위젯의 실사용 피드백** — 지인 공유 후 한국 시장 접힘이 과한지 관찰(B1 소스 확보 시 상시 그룹 승격 + kr-home 스냅샷 카드 복원).

### C. 보류 확정 (착수하지 않기로 함 — 재론 시에만)
5. AI BYO-key: 현행(서버키+전역 캡 300/일) 유지 확정. 캡 도달 빈도가 높아지면 재론.
6. KR 유료 데이터 소스 도입 조사: "정지 위젯 정리"로 대체 확정. 재론 트리거 = 한국 사용자 핵심 니즈 피드백.
7. history.json 지수 종가(SPX/VIX 등 인덱스 레벨): 낮은 리스크 클래스로 유지 확정(개별 종목 아님, FRED 공식 대체 가능). 정식 공개(Gate 0 전체) 시 소스 라벨 교체 재검토.
8. TG digest 첫 방문 443KB→193KB로 축소됨. 추가 축소(부팅 lazy)는 ETag 304 구조상 실익 낮아 no-op 확정.

### D. 기존 장기 항목 (변동 없음)
- B1(KR 무료 소스 부재)·B4(히스토리 누적 대기)·B8(CF HKG 403 완화 상태)·B9(PIT 데이터/전면 provenance/인간 접근성 실사) — `DEFERRED-BLOCKS.md` 참조.
- 스크리너 fundamentals 커버리지 10.6%→80% 도달까지 value/quality 비활성(SEC 24종목/6h 배치 누적 중).
