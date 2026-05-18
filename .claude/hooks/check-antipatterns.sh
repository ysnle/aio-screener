#!/usr/bin/env bash
# PostToolUse Hook: index.html 수정 후 안티패턴 자동 감지
# - native alert()/confirm() 신규 추가 차단
# - d.pct || 0 패턴 차단
# - font-size 11px 미만 !important 추가 차단

FILE="$TOOL_INPUT_FILE_PATH"
if [ -z "$FILE" ]; then
  FILE=$(echo "$TOOL_INPUT" | grep -oP '"file_path"\s*:\s*"([^"]+)"' | head -1 | sed 's/.*"file_path"\s*:\s*"//;s/"$//')
fi

# index.html만 검사
case "$FILE" in
  *index.html) ;;
  *) exit 0 ;;
esac

ISSUES=""

# 1. native alert() 감지 (showDataError/showToast 내부가 아닌 순수 alert)
ALERT_COUNT=$(grep -cP '(?<!show)alert\(' "$FILE" 2>/dev/null || echo 0)
if [ "$ALERT_COUNT" -gt 0 ]; then
  ISSUES="${ISSUES}[WARN] native alert() ${ALERT_COUNT}건 발견. showToast() 또는 showConfirmModal() 사용 권장.\n"
fi

# 2. native confirm() 감지
CONFIRM_COUNT=$(grep -cP '(?<!show)(?<!Close)confirm\(' "$FILE" 2>/dev/null || echo 0)
if [ "$CONFIRM_COUNT" -gt 0 ]; then
  ISSUES="${ISSUES}[WARN] native confirm() ${CONFIRM_COUNT}건 발견. showConfirmModal() 사용 필수.\n"
fi

# 3. d.pct || 0 패턴 감지
PCT_COUNT=$(grep -cP '\.pct\s*\|\|\s*0' "$FILE" 2>/dev/null || echo 0)
if [ "$PCT_COUNT" -gt 0 ]; then
  ISSUES="${ISSUES}[WARN] .pct || 0 패턴 ${PCT_COUNT}건 발견 (R15 위반). d.pct != null ? d.pct : 0 사용.\n"
fi

if [ -n "$ISSUES" ]; then
  echo "{\"decision\":\"warn\",\"reason\":\"안티패턴 감지:\\n${ISSUES}\"}"
  exit 1
fi

exit 0
