# /deploy — 버전 업 + 커밋 + GitHub Pages 배포

AIO Screener 배포 워크플로우를 실행하세요:

1. **버전 동기화 검증** (6곳):
   - `<title>` 태그
   - `#app-version-badge` 인라인 텍스트
   - `const APP_VERSION` JS 상수
   - `version.json` → version 필드
   - `CLAUDE.md` (루트) → 현재 버전
   - `CHANGELOG.md` → 최상단 항목

2. **div 균형 확인**: `grep -o '<div' index.html | wc -l` vs `grep -o '</div' index.html | wc -l`

3. **Claude Preview 스크린샷**: 로컬 서버에서 렌더링 정상 확인

4. **Git 커밋**: 변경 파일 스테이징 + 커밋 메시지 작성

5. **GitHub push**: `git push origin main`

6. 배포 URL 안내: https://ysnle.github.io/aio-screener/

문제 발견 시 배포 중단하고 보고하세요.
