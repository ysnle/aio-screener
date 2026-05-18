#!/bin/bash
# AIO Screener — Stop Hook: 세션 종료 시 미커밋 작업 자동 저장
# 목적: /deploy 없이 세션이 끝나도 변경사항 보존 (워크트리 브랜치에 커밋)

# 스테이징되지 않은 변경사항 또는 미추적 파일이 있는지 확인
if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null && [ -z "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
  # 변경사항 없음 — 아무 것도 하지 않음
  exit 0
fi

# 변경사항 있음 → 자동 커밋
TIMESTAMP=$(date +"%Y-%m-%dT%H:%M")
git add -A 2>/dev/null
git commit -m "WIP: auto-save on session end [$TIMESTAMP] — run /deploy to publish" 2>/dev/null

exit 0
