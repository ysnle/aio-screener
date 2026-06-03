#!/bin/bash
# AIO Screener — 백업 파일/이전 버전 보호
# PreToolUse(Edit|Write) hook: 이전 버전 파일 덮어쓰기 차단

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null)

# 이전 버전 백업 파일 보호 (aio_ui_prototype_v*.html)
if echo "$FILE" | grep -qE 'aio_ui_prototype_v[0-9]'; then
  echo "Blocked: '$FILE' is a version backup file. Create a new version file instead of overwriting." >&2
  exit 2
fi

# _backup/ 폴더 내 파일 보호
if echo "$FILE" | grep -qE '_backup/'; then
  echo "Blocked: '$FILE' is in _backup/ directory. Backup files must not be modified." >&2
  exit 2
fi

# _archive/ 폴더 내 파일 보호
if echo "$FILE" | grep -qE '_archive/'; then
  echo "Blocked: '$FILE' is in _archive/ directory. Archived files must not be modified." >&2
  exit 2
fi

exit 0
