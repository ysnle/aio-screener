import re

with open('_context/BUG-POSTMORTEM.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix frontmatter
content = content.replace('latest_P_number: P212', 'latest_P_number: P215', 1)
content = content.replace('next: P213', 'next: P216', 1)
content = content.replace('total: 211', 'total: 214', 1)

new_p213 = (
    '\n\n---\n\n'
    '## P213 \xb7 v49.22 \xb7 DATA_SNAPSHOT KR 필드 vs DOM 인라인 불일치\n\n'
    '- **증상**: applyDataSnapshot 전 pre-JS 상태에서 신용잔고 31.7조원(DOM) vs 19.8조원(DATA_SNAPSHOT) 불일치 노옶\n'
    '- **원인**: v48.61 P125에서 DATA_SNAPSHOT krCreditBalance\xb7krDeposit 등 보충 시 DOM 인라인 fallback 동기화 누락\n'
    '- **수정**: DATA_SNAPSHOT 값 갱신(2026-05-16 기준) + DOM 인라인 일치화 + snap-dates 6곣 2026-04-17→2026-05-16\n'
    '- **파일**: `index.html` L10481~10535 \xb7 `js/aio-core.js` DATA_SNAPSHOT L6012~6019\n'
    '- **violated_rule**: R25(BUG-POSTMORTEM 기록) \xb7 R54(data-snap 보유 섹션 snap-date 갱신 시 DATA_SNAPSHOT 동시 갱신)\n'
    '- **prevention**: snap-date 갱신 시 DATA_SNAPSHOT 해당 키와 DOM 인라인을 3-way 검증(snap-date/DATA_SNAPSHOT/DOM inline)\n'
)

new_p214 = (
    '\n\n---\n\n'
    '## P214 \xb7 v49.22 \xb7 options 스냅샷 4곣 2026-04-17 (29일 경과)\n\n'
    '- **증상**: options 페이지 IV Rank/Skew/Flow/Greeks 4섹션 data-snap-date="option-snapshot" 모두 2026-04-17 → 29일 경과\n'
    '- **원인**: "주간 수동 갱신" 정송이나 snap-date 자체 갱신 누락\n'
    '- **수정**: 4곣 snap-dates → 2026-05-16 \xb7 skew 해석 텍스트 현재 시장 환경 반영\n'
    '- **파일**: `index.html` L9613/9738/9794/9885\n'
    '- **violated_rule**: static_snapshot FRESHNESS_POLICY(1d fresh/3d stale/7d hardStale) → 29일 경과 hardStale\n'
    '- **prevention**: options 페이지 주간 갱신 체크리스트에 snap-date 갱신 포함\n'
)

new_p215 = (
    '\n\n---\n\n'
    '## P215 \xb7 v49.22 \xb7 signal/kr-macro 시점 의존 지정학 시나리오 (3개월+ 경과)\n\n'
    '- **증상**: 이란 재협상, 호르무즈 해협 등 3개월+ 경과 시나리오 텍스트 3건 잔존\n'
    '- **원인**: R54 제정 전 서술 텍스트에 data-snap 없어 freshness audit 미적용 영역\n'
    '- **수정**: signal L5013/L5169 → 관세 협상 일반화 \xb7 kr-macro L11213 → 에너지 공급 텍스트 + WTI/Brent 현재값\n'
    '- **파일**: `index.html` L5013, L5169, L11213\n'
    '- **violated_rule**: R54(data-snap 없는 서술 텍스트는 개발자가 주기 검토) \xb7 P215 신규\n'
    '- **prevention**: data-snap 없는 서술 텍스트 섹션은 AIO.getStaticDataGovernanceAudit()에 live-like 키워드(국명/인명/가격) 추가 탐지\n'
)

content = content.rstrip() + new_p213 + new_p214 + new_p215 + '\n'

with open('_context/BUG-POSTMORTEM.md', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
print('P213 check:', 'P213' in content)
print('P214 check:', 'P214' in content)
print('P215 check:', 'P215' in content)
