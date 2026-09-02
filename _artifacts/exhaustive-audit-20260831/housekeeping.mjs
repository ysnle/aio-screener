import fs from 'node:fs';
const version = JSON.parse(fs.readFileSync('version.json', 'utf8'));
version.note = 'v54.74 — 전수 감사 진행: 관측/계산 분리, 사용자 실행 보관·재현, 팩터·취소·저장·화면 조건 수정 (P1013~P1017); 전수 의미 검토 및 배포 인증 미완료';
fs.writeFileSync('version.json', JSON.stringify(version) + '\n');
let map = fs.readFileSync('_context/CODE-MAP.md', 'utf8');
map = map.replace('v54.57 (P761~P964 현행)', 'v54.57 당시 기록 (P761~P964)').replace('상단 current 표와 `rg -n` 결과를 우선한다.', '생성된 CURRENT-STATE와 현재 `rg -n` 결과를 우선한다.');
fs.writeFileSync('_context/CODE-MAP.md', map);
