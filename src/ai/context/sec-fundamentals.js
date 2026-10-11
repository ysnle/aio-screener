import { deriveSecReport } from '../../domain/fundamental/sec-report.js';

// P1607: reuse the public annual facts without inventing a paid-provider/TTM shape.
export function formatSecResearchEvidence(record, now = Date.now()) {
  if (!record || !Number.isFinite(now)) return '';
  const availability = [record.availableAt, record.acceptedAt, record.effectiveAt, record.filedAt].filter(value => value != null);
  if (!availability.length || availability.some(value => !Number.isFinite(Date.parse(value)) || Date.parse(value) > now)) return '';
  const report = deriveSecReport(record);
  if (report.status !== 'current' || !report.metrics.length) return '';
  const units = { currency: 'USD', percent: '%', shares: '주', multiple: '배' };
  const lines = report.metrics.map(metric => `${metric.label}: ${metric.value} (${units[metric.unit] || metric.unit})`);
  return ['【공용 SEC 공시 재무 자료 · 참고】',
    `종목: ${report.symbol || '미확인'} · 기간: ${report.periodType || '미확인'} · 관측: ${report.observedAt || '미확인'} · 공시: ${report.filedAt || '미확인'}`,
    `출처: ${report.source} · ${report.filingUrl || '공시 링크 없음'}`,
    ...lines,
    '연간 공시 수치는 TTM·실시간 지표가 아니다. 위에 없는 항목(현금흐름·세그먼트·추정치 등)은 미제공이며 0으로 간주하거나 추정하지 않는다.'
  ].join('\n') + '\n';
}
