> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 공식 원문 대조 — issuer와 회계연도

2026-10-21 root가 공개 SEC 원문을 읽었다. 아래는 투자 판단이 아니라 코드가 가리킨 법인/공시 기간의 동일성 확인이다. 외부에서 받은 숫자를 제품 데이터에 쓰지 않았다.

| 요청 | legacy CIK | 공식 확인 | 판정 |
|---|---:|---|---|
| HWM |1645590|[Howmet CIK4281](https://www.sec.gov/Archives/edgar/data/4281/000000428126000025/0000004281-26-000025-index.htm), [HPE CIK1645590](https://www.sec.gov/Archives/edgar/data/1645590/000164559026000072/0001645590-26-000072-index.htm)|다른 법인. 실제 함수+chat consumer의 격리 실행에서 잘못된 법인 응답을 수락함.|
| AAOI |1070235|[Applied Optoelectronics CIK1158114](https://www.sec.gov/Archives/edgar/data/1158114/000110465924086288/0001104659-24-086288-index.htm), [BlackBerry의 CIK1070235 공시](https://www.sec.gov/Archives/edgar/data/1070235/000107023526000029/bbry-20260409.htm)|매핑 불일치가 다른 법인임을 확인. 실제 AAOI AI답변/외부 submissions 요청은 실행하지 않음.|
| AFRM |1820302|[Affirm CIK1820953](https://www.sec.gov/Archives/edgar/data/1820953/000162828026059279/0001628280-26-059279-index.html), [Bakkt CIK1820302](https://www.sec.gov/Archives/edgar/data/1820302/000162828026054892/0001628280-26-054892-index.html)|매핑 불일치가 다른 법인임을 확인. 실제 AFRM AI답변은 실행하지 않음.|

LEGACY-CORE.md의180개 대조는 저장소 정본 비교다. 그중11개가 다르고1개가 정본에 없었다. 위3개 외8개의 불일치는 기업 재편·CIK 변경 등을 공식 대조하기 전까지 미확정으로 남긴다. APP/IREN 일부 검색에서 정확한 legacy 법인을 확인하지 못했으며 검색 결과 부재를 없는 법인/오류 증거로 쓰지 않는다. 같은 issuer 정본을 소비하고 반환된 CIK/등록 종목을 검증하는 경계가 필요하다.

LDOS의 [2026-01-02 마감 10-K](https://www.sec.gov/Archives/edgar/data/1336920/000133692026000030/ldos-20260102.htm) Reporting Periods는 fiscal2025가2026-01-02에 끝났다고 명시한다. 기존 FY2025 helper와 기업 요약이 이 원문에 부합하고 새 FY2026 substring 표시는 부합하지 않는다. 모든1월 말 사업자를 전년 회계연도로 일괄 추정하자는 뜻은 아니다. 장기적으로 issuer의 실제 fiscalYear label을 보존하는 것이 날짜 휴리스틱보다 정확하다.
