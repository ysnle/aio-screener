#!/bin/bash
# AIO Screener — Stop Hook: 세션 종료 시 미커밋 작업 자동 저장
# 목적: /deploy 없이 세션이 끝나도 변경사항 보존 (워크트리 브랜치에 커밋)
# v52.47 WO-5: git add -A가 이번 세션과 무관한, 세션 시작 이전부터 dirty했던 파일까지
# 함께 커밋해버리던 문제(실측 사례: 이전 세션의 미커밋 진단 문서+INDEX.md 혼입) 수정 —
# session-start-snapshot.sh(SessionStart 훅)가 남긴 스냅샷과 대조해 "이번 세션 중 새로
# dirty해진 경로"만 스테이징한다. 스냅샷이 없으면(훅 배선 전 시작된 세션 등) 기존 동작으로
# 안전하게 폴백한다.

SNAPSHOT=".claude/.session-start-snapshot"

# 스테이징되지 않은 변경사항 또는 미추적 파일이 있는지 확인
if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null && [ -z "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
  # 변경사항 없음 — 아무 것도 하지 않음
  rm -f "$SNAPSHOT" 2>/dev/null
  exit 0
fi

TIMESTAMP=$(date +"%Y-%m-%dT%H:%M")

if [ -f "$SNAPSHOT" ]; then
  # 경로만 비교(상태 코드는 무시) — 세션 시작 시점에 이미 dirty했던 경로는 이번 세션이 손대지
  # 않았어도 계속 dirty 상태로 남는 게 정상이므로, "새로 나타난" 경로만 이번 커밋 대상.
  NEW_PATHS=$(comm -13 \
    <(cut -c4- "$SNAPSHOT" 2>/dev/null | sort) \
    <(git status --porcelain 2>/dev/null | cut -c4- | sort))
  if [ -n "$NEW_PATHS" ]; then
    while IFS= read -r path; do
      [ -n "$path" ] && git add -- "$path" 2>/dev/null
    done <<< "$NEW_PATHS"
  fi
else
  # 스냅샷 없음(예: 이 훅이 배선되기 전에 시작된 세션) — 기존 동작으로 폴백
  git add -A 2>/dev/null
fi

# 스테이징된 변경사항이 있을 때만 커밋 (스냅샷 대조 결과 이번 세션이 새로 건드린 게 없을 수 있음)
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "WIP: auto-save on session end [$TIMESTAMP] — run /deploy to publish" 2>/dev/null
fi

rm -f "$SNAPSHOT" 2>/dev/null
exit 0
