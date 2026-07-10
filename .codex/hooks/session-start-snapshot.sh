#!/bin/bash
# AIO Screener — SessionStart Hook: 세션 시작 시점 git 상태 스냅샷
# v52.47 WO-5: auto-commit-on-stop.sh가 세션 시작 이전부터 있던 무관한 변경사항까지
# git add -A로 함께 쓸어담던 문제(실제 관찰 사례: 이전 세션의 미커밋 진단 문서+INDEX.md가
# 이번 세션의 WIP 커밋에 섞여 들어감) 방지 — 시작 시점 상태를 기록해 Stop 훅이 "이번 세션에
# 새로 dirty해진 경로"만 골라 스테이징할 수 있게 한다.
git status --porcelain > .codex/.session-start-snapshot 2>/dev/null
exit 0
