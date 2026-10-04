// P1449 (이전 P948/R499의 확장): 13F 분기 합성의 단일 정책 · 단일 구현.
// 같은 분기의 13F-HR / 13F-HR/A를 filedAt 순으로 합성한다.
//  - 원본(ORIGINAL): effective의 기점.
//  - RESTATEMENT: 지금까지의 합성을 완전히 대체한다(전체 행 교체).
//  - NEW HOLDINGS(행 추가형 정정): 원본/현재 effective에 행을 추가하고 cover 총계를 더한다.
//  - 분류되지 않은 정정은 예외로 실패하며, 호출자는 해당 분기를 REVIEW_REQUIRED로 닫는다
//    (부분 정정행을 분기 전체처럼 발행하지 않는다).
// reference(현재·직전 분기) 수집기와 history(장기 이력) 수집기가 이 구현을 함께 사용한다.

export function composeAmendmentChain(bundles) {
  let effective = null;
  let provenance = [];
  const amendmentChain = [];
  for (const bundle of bundles || []) {
    const amended = bundle.filing.isAmendment || /\/A$/.test(String(bundle.filing.form || '')) || String(bundle.cover.isAmendment).toLowerCase() === 'true';
    const type = String(bundle.cover.amendmentType || '').trim().toUpperCase();
    if (!amended) {
      effective = { ...bundle, rows: [...bundle.rows] };
      provenance = bundle.rows.map(() => ({ accession: bundle.filing.accession, role: 'ORIGINAL' }));
      amendmentChain.push({ accession: bundle.filing.accession, type: 'ORIGINAL', role: 'ORIGINAL', rows: bundle.rows.length });
    } else if (/RESTATEMENT/.test(type)) {
      effective = { ...bundle, rows: [...bundle.rows] };
      provenance = bundle.rows.map(() => ({ accession: bundle.filing.accession, role: 'RESTATEMENT' }));
      amendmentChain.push({ accession: bundle.filing.accession, type: 'RESTATEMENT', role: 'RESTATEMENT', rows: bundle.rows.length });
    } else if (/NEW HOLDINGS/.test(type) && effective) {
      const existingValue = Number(effective.cover.tableValueTotal ?? effective.rows.reduce((sum, row) => sum + row.value, 0));
      const addedValue = Number(bundle.cover.tableValueTotal ?? bundle.rows.reduce((sum, row) => sum + row.value, 0));
      effective = {
        ...bundle,
        rows: [...effective.rows, ...bundle.rows],
        cover: {
          ...bundle.cover,
          tableEntryTotal: Number(effective.cover.tableEntryTotal ?? effective.rows.length) + Number(bundle.cover.tableEntryTotal ?? bundle.rows.length),
          tableValueTotal: existingValue + addedValue,
          compositeAmendment: true
        }
      };
      provenance = [
        ...provenance,
        ...bundle.rows.map(() => ({ accession: bundle.filing.accession, role: 'NEW_HOLDINGS_ADD' }))
      ];
      amendmentChain.push({ accession: bundle.filing.accession, type: 'NEW HOLDINGS', role: 'NEW_HOLDINGS_ADD', rows: bundle.rows.length });
    } else {
      throw new Error(`Unsupported 13F amendment semantics for ${bundle.filing.accession}: ${type || 'UNCLASSIFIED'}`);
    }
  }
  if (!effective) throw new Error(`No effective 13F holdings rows for ${bundles?.[0]?.filing?.accession || 'unknown filing'}`);
  // P1449: 합성된 행의 출처(A(authorisor)·role)를 행 순서에 맞춰 함께 돌려준다 — 행 수집기가
  // 각 행에 accession / filingRole을 붙이는 데 사용한다.
  return { ...effective, amendmentChain, rowProvenance: provenance };
}

// 합성된 분기의 표준 라벨(UI가 표시하고 게이트가 어서션한다).
export function describeComposition(amendmentChain) {
  const roles = (amendmentChain || []).map((entry) => entry.role || entry.type || null).filter(Boolean);
  const composite = roles.length > 1;
  const label = composite ? '원본+정정행 합성' : roles[0] === 'RESTATEMENT' ? '정정(전체 교체)' : roles[0] === 'NEW_HOLDINGS_ADD' ? '정정(신규 행 추가)' : '원본';
  return { composite, label, roles };
}
