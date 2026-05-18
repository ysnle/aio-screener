#!/bin/bash
# AIO Screener — 위험 명령 차단
# PreToolUse(Bash) hook: 파일 삭제, 위험한 git 명령 차단

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null)

# 파일 삭제 명령 차단 (R4: 파일 삭제 금지)
if echo "$CMD" | grep -qiE '\brm\b.*\.(html|js|json|md)'; then
  echo "Blocked: File deletion is forbidden (R4). Move to _archive/ instead." >&2
  exit 2
fi

if echo "$CMD" | grep -qiE 'rm\s+-rf'; then
  echo "Blocked: 'rm -rf' is too dangerous. Use more targeted commands." >&2
  exit 2
fi

# 위험한 git 명령 차단
if echo "$CMD" | grep -qiE 'git\s+reset\s+--hard'; then
  echo "Blocked: 'git reset --hard' can destroy work. Use 'git stash' instead." >&2
  exit 2
fi

if echo "$CMD" | grep -qiE 'git\s+push.*--force'; then
  echo "Blocked: Force push can overwrite remote history. Use --force-with-lease if needed." >&2
  exit 2
fi

exit 0
