#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKET_PRINCIPLES_CATALOG } from '../src/ui/pages/principles.js';
import { atomicWriteFileSync } from './lib/atomic-write.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reviewedAt = process.env.KNOWLEDGE_MANIFEST_DATE || '2026-08-11';
const profiles = {
  '분해': ['CAUSES', '이 상위 개념을 구성 요소로 분해하는 교육 경로일 때'],
  '핵심 축': ['CAUSES', '시스템을 설명하는 구조적 축으로 연결될 때'],
  '검증': ['EVIDENCES', '하위 개념의 설명이나 주장을 점검하는 검증 경로일 때'],
  '요구': ['REQUIRES', '앞 단계의 workload 또는 조건이 뒤 단계의 자원을 요구할 때'],
  '구현': ['ENABLES', '앞 단계의 capability가 뒤 단계의 구현 선택지를 열 때'],
  '병목 이동': ['CONSTRAINS', '제약이 다음 계층의 병목 또는 비용으로 이동할 때'],
  '소비': ['REQUIRES', '계산 workload가 전력·냉각 자원을 요구할 때'],
  '확장 조건': ['REQUIRES', '물리적 확장이 공급·운영 조건을 충족해야 할 때'],
  '공급망': ['CONSTRAINS', '공급망의 가용성·수율·리드타임이 경제성을 제약할 때'],
  '수요 단서': ['MEASURES', '관찰된 수요 단서가 다음 판단의 측정 입력으로 사용될 때'],
  '매출 연결': ['ENABLES', '인프라 투자가 고객 가치 또는 매출 경로를 열 때'],
  '자금 조달': ['FUNDS', '자금 조달 조건이 투자를 가능하게 하거나 제한할 때'],
  '조건 변화': ['CONSTRAINS', '거시 조건이 금융·산업 선택의 제약을 바꿀 때'],
  '할인·위험': ['PRICES', '금융 조건이 할인율·위험 프리미엄으로 가격에 반영될 때'],
  '바탕이 된다': ['REQUIRES', '기초 원리가 이후 시스템과 선택의 전제일 때'],
  '선택과 산출': ['CAUSES', '선택이 산출과 생산성의 경로를 바꿀 때'],
  '제도와 투자': ['ENABLES', '제도와 소유·계약이 재투자 경로를 열 때'],
  '교환과 계산': ['ENABLES', '화폐 기능이 교환·계산·저장 경로를 가능하게 할 때'],
  '구매력 변화': ['CAUSES', '가격 수준 변화가 실질 구매력으로 전달될 때'],
  '신용 조건': ['CONSTRAINS', '신용 조건이 차입·지출·투자 능력을 바꿀 때'],
  '자금 가격': ['PRICES', '금리가 시간·위험·유동성의 자금 가격이 될 때'],
  '금융 전달': ['ENABLES', '채권·환율 조건이 자본 이동으로 전달될 때'],
  '국가 자금': ['FUNDS', '재정·국가 차입이 수요와 프로젝트 자금으로 이어질 때'],
  '기업 환경': ['CONSTRAINS', '재정·정책 조건이 기업의 운영·자금조달 환경을 바꿀 때'],
  '기대와 가격': ['PRICES', '기업의 현금흐름 기대가 시장 가격에 반영될 때'],
  '시간축': ['MEASURES', '경기·이익·유동성의 시간축을 구분해 관찰할 때'],
  '배분과 생존': ['CONSTRAINS', '리스크 관리가 자산배분과 생존 가능성을 제한할 때'],
  '분석 단위': ['MEASURES', '산업 가치사슬이 분석 단위와 이익 풀을 정의할 때'],
  'AI 산업 연결': ['ENABLES', '산업 구조가 AI workload의 수요·병목으로 연결될 때'],
  '할인율·자금비용': ['PRICES', '금융 조건이 기업의 할인율과 자금비용을 바꿀 때'],
  '이익 풀·투자': ['FUNDS', '산업의 이익 풀이 CAPEX와 투자 선택으로 전달될 때'],
  '인지 입력': ['REQUIRES', '물리 시스템이 센서·인지 입력을 요구할 때'],
  '상태 추정': ['CAUSES', '인지 결과가 상태 추정과 다음 행동 판단을 만든다'],
  '행동 계획': ['ENABLES', '상태 추정이 행동 계획과 제어 선택을 가능하게 할 때'],
  '가동·유지비': ['MEASURES', '운영 성과가 가동률·유지비·단위경제성으로 측정될 때'],
  '임무 자동화': ['ENABLES', '기술 capability가 임무 수행과 자동화를 가능하게 할 때'],
  '조달 검증': ['EVIDENCES', '조달 조건이 기술 성능과 운용 적합성을 검증할 때'],
  '우주 가치사슬': ['ENABLES', '발사·시스템 단계가 우주 가치사슬로 이어질 때'],
  '정부 고객': ['FUNDS', '정부 수요·조달이 시스템 투자와 매출의 고객 경로가 될 때'],
  '업무 적용': ['ENABLES', '기술이 실제 기업 workflow에 적용될 때'],
  '도입 비용': ['CONSTRAINS', '도입 비용과 전환 부담이 사용·ROI를 제약할 때'],
  '성과 검증': ['EVIDENCES', '도입 성과를 기준선과 관찰 지표로 검증할 때'],
  '소재 가치사슬': ['ENABLES', '원재료가 정제·제품·고객 가치사슬로 이어질 때'],
  '정제·인증': ['REQUIRES', '순도·수율·고객 인증이 판매 가능한 공급의 조건일 때'],
  '정책 경계': ['CONSTRAINS', '정책과 공급망 규칙이 소재 선택과 투자를 제약할 때'],
  '메모리 시스템': ['CONSTRAINS', '메모리 시스템 병목이 처리량·전력·비용을 제약할 때'],
  '패키지 연결': ['ENABLES', '패키지 연결이 시스템 대역폭과 통합을 가능하게 할 때'],
  '패키지 비용': ['CONSTRAINS', '패키지 비용·열·수율이 시스템 경제성을 제약할 때'],
  '인접 연산': ['ENABLES', '인접 연산 방식이 대체·보완 가능성을 탐색하게 할 때'],
  '클러스터 광 연결': ['ENABLES', '분산 workload의 통신 요구가 광 연결 선택을 가능하게 할 때'],
  '자금·임차': ['FUNDS', '임차·계약·금융비용이 데이터센터 투자 구조로 전달될 때']
};

const rows = MARKET_PRINCIPLES_CATALOG.edges.map((edge, index) => {
  const profile = profiles[edge.relation] || ['CAUSES', '교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다'];
  return [
    `edge-${String(index + 1).padStart(3, '0')}`,
    { type: profile[0], direction: 'DIRECTED', kind: 'PRINCIPLE', strength: 'CORE', polarity: 'CONDITIONAL', conditions: [profile[1]], sourceIds: [], reviewedAt, reviewStatus: 'STRUCTURAL_REFERENCE_REVIEWED', sourceStatus: 'EVIDENCE_REGISTRY_PENDING' }
  ];
});

// Edge IDs are stable by endpoint, so source edits cannot silently reassign a
// semantic review to another relation.
const semantics = Object.fromEntries(MARKET_PRINCIPLES_CATALOG.edges.map((edge, index) => {
  const profile = profiles[edge.relation] || ['CAUSES', '교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다'];
  return [`${edge.from}->${edge.to}`, { id: `principle-edge-${String(index + 1).padStart(3, '0')}`, type: profile[0], direction: 'DIRECTED', kind: 'PRINCIPLE', strength: 'CORE', polarity: 'CONDITIONAL', conditions: [profile[1]], sourceIds: [], reviewedAt, reviewStatus: 'STRUCTURAL_REFERENCE_REVIEWED', sourceStatus: 'EVIDENCE_REGISTRY_PENDING' }];
}));
const target = path.join(root, 'src/domain/knowledge/principles-edge-semantics.js');
atomicWriteFileSync(target, `// Generated from the exported Principles catalog; edit the relation profile and regenerate.\nexport const PRINCIPLE_EDGE_SEMANTICS = Object.freeze(${JSON.stringify(semantics, null, 2)});\n`, 'utf8');
console.log(JSON.stringify({ status: 'PASS', edges: rows.length, target }, null, 2));
