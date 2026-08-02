# 시장 원리 / 지식 그래프 구현 동결 기록

상태: `IMPLEMENTED_EXPANDED_REFERENCE`  
작성일: `2026-08-01`  
대상 버전: `v53.79`

## MP-00 / KG-00 결정

- canonical route: `#principles` / 사이드바 `시장 원리`
- 학습 IA: `Tree` 계층, `Graph` 인과·교차 연결, `Path` 입문 순서
- 현재 연결 범위: 희소성·생산성·돈·물가·신용·금리·채권·재정·기업·가격발견·사이클·리스크·산업 가치사슬·AI workload·계산·HBM·패키징·스토리지·전력·CAPEX·금융 조건
- 콘텐츠 성격: `REFERENCE` / 구조적 학습용. 실시간 가격, 목표가, 매매 신호를 생성하지 않음
- 그래프 방식: 수동 SVG 26개 노드 + 1-hop/2-hop 토글 + 모바일 텍스트 목록
- 출처 정책: 텔레그램·뉴스는 발견용. 공시·기관·표준 문서 링크를 구조 콘텐츠의 검토 출처로 표시
- 검토일: `2026-08-01`을 모든 카탈로그 노드·레슨에 부여
- 13F: 이 라우트에 혼합하지 않음. SEC EDGAR 기반 별도 `masters`/`gurus` 제품 경계로 유지

## 구현 표면

- `src/ui/pages/principles.js`: 카탈로그, Tree/Graph/Path 렌더러, 검색, 기존 페이지 딥링크
- `index.html`: 학습 메뉴와 `page-principles` 마운트, 반응형·접근성 스타일
- `src/app/routes.js`, `src/app/bootstrap.js`, `src/app/vertical-slices.js`: 18번째 네이티브 라우트 계약
- `js/aio-core.js`, `js/aio-data.js`: 레거시 호환 라우트·교육/출처 경계·정적 감사 계약
- `architecture/golden-routes.json`, `architecture/route-owners.json`, `sw.js`: 라우트·소유권·오프라인 셸 동기화

## 검증 경계

- 확인: 노드 26개, 레슨 21개, Path 4개, source/status/reviewedAt, 그래프 aria label, 텍스트 대체 표면
- 확인: `principles` 페이지에 `data-live-price`, 목표가, BUY/SELL 데이터 표면 없음
- 보류: Market Principles A~O 전체 99개 레슨·8개 path, AI 산업 Atlas 전 범위(L0~L6 player/product 전체), 실시간 1차 자료 재수집, SEC 13F security master/sector, 저충실도 승인(LF-6/LF-7)
