// v59.40 (roadmap 11, layer 5 score/ranking): the screener trader profiles moved out of js/aio-data.js unchanged — a
// profile is a requested weight vector that src/domain/screener/factor-weights.js deriveFactorWeights normalizes; balanced
// carries no weights and takes the model default. Weight changes need the owner (2026-10-27 factor backtest review).
export const TRADER_PROFILES = {
  balanced: { label:'균형', desc:'고정 균형 가중 (시장 국면 자동 조정은 검증 전이라 미적용)', weights:null },
  momentum: { label:'모멘텀', desc:'단기 추세 추종, 1~4주 보유', weights:{momentum:0.40,trend:0.25,lowvol:0.08,size:0.05,value:0.06,quality:0.06,kalman:0.10} },
  swing: { label:'스윙', desc:'중기 기술적 매매, 2~8주 보유', weights:{momentum:0.30,trend:0.28,lowvol:0.12,size:0.07,value:0.07,quality:0.07,kalman:0.09} },
  value: { label:'가치', desc:'저평가 장기 투자, 3~12개월 보유', weights:{momentum:0.12,trend:0.15,lowvol:0.15,size:0.08,value:0.30,quality:0.15,kalman:0.05} },
  lowrisk: { label:'저리스크', desc:'방어적 저변동 우선, 하락방어 포커스', weights:{momentum:0.10,trend:0.15,lowvol:0.38,size:0.05,value:0.12,quality:0.15,kalman:0.05} }
};
