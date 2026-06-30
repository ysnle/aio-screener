#!/bin/bash
# AIO Screener — R1 버전 7곳 동기화 자동 검증
# PostToolUse(Edit|Write) hook: index.html, version.json, CLAUDE.md, CHANGELOG.md 수정 시
# 6곳의 버전 번호가 일치하는지 자동 체크

# 수정된 파일 경로 추출
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"//')

# 관련 파일만 체크 (index.html, version.json, CLAUDE.md, CHANGELOG.md)
case "$FILE_PATH" in
  *index.html*|*version.json*|*CLAUDE.md*|*CHANGELOG.md*)
    ;;
  *)
    exit 0
    ;;
esac

# 프로젝트 루트 탐색
ROOT=$(pwd)
if [ ! -f "$ROOT/index.html" ]; then
  exit 0
fi

# 6곳에서 버전 추출
VER_TITLE=$(grep "<title>" "$ROOT/index.html" | grep -o 'v[0-9][0-9]*\.[0-9]' | head -1)
VER_APP=$(grep "APP_VERSION" "$ROOT/index.html" | grep -o 'v[0-9][0-9]*\.[0-9]' | head -1)
VER_JSON=$(grep '"version"' "$ROOT/version.json" 2>/dev/null | grep -o 'v[0-9][0-9]*\.[0-9]' | head -1)
VER_CLAUDE=$(grep '현재 버전' "$ROOT/CLAUDE.md" 2>/dev/null | grep -o 'v[0-9][0-9]*\.[0-9]' | head -1)

# 모든 값이 있고 일치하는지 확인
if [ -n "$VER_TITLE" ] && [ -n "$VER_APP" ] && [ -n "$VER_JSON" ] && [ -n "$VER_CLAUDE" ]; then
  if [ "$VER_TITLE" != "$VER_APP" ] || [ "$VER_TITLE" != "$VER_JSON" ] || [ "$VER_TITLE" != "$VER_CLAUDE" ]; then
    echo "{\"result\":\"warn\",\"message\":\"R1 버전 불일치 감지! title=$VER_TITLE APP_VERSION=$VER_APP version.json=$VER_JSON CLAUDE.md=$VER_CLAUDE — /version-up 실행 필요\"}"
  fi
fi
