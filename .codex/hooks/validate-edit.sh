#!/bin/bash
# AIO Screener — 코드 수정 후 div 균형 자동 검증
# PostToolUse(Edit|Write) hook: index.html 수정 시 div 열림/닫힘 균형 체크

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null)

if [[ "$FILE" != *"index.html"* ]]; then
  exit 0
fi

OPEN=$(grep -o '<div' "$FILE" 2>/dev/null | wc -l)
CLOSE=$(grep -o '</div' "$FILE" 2>/dev/null | wc -l)

if [[ "$OPEN" -ne "$CLOSE" ]]; then
  echo "WARNING: div balance broken! open=$OPEN close=$CLOSE (diff=$((OPEN - CLOSE))). Fix before continuing." >&2
  exit 1
fi

exit 0
