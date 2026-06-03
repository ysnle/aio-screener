# /version-up — 버전 번호 올리기

AIO Screener 버전을 올리세요. 인자로 새 버전 번호를 받거나, 자동으로 +0.1 증가합니다.

## 절차
1. 현재 버전 확인 (`const APP_VERSION` 읽기)
2. 새 버전 계산 (R2 규칙: 소수점 1자리만. 38.9 → 39, 39 → 39.1)
3. **6곳 동시 업데이트**:
   - `<title>` 태그
   - `#app-version-badge` 인라인 텍스트
   - `const APP_VERSION` JS 상수
   - `version.json` → version + built + note
   - `CLAUDE.md` (루트) → 현재 버전
   - `_context/CLAUDE.md` → 현재 버전
4. CHANGELOG.md 최상단에 새 버전 헤더 추가
5. 6곳 동기화 검증 (`grep` 명령으로 확인)
6. 결과 보고

## 주의
- 절대 31.10 같은 2자리 소수점 금지 (R2)
- version.json의 built 필드는 현재 시각(KST)으로 갱신
