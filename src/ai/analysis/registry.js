import { buildCausalAttribution } from './causal.js';
import { buildSectorDecomposition } from './sector.js';
import { buildCompanyAssessment } from './company.js';
import { buildTechnicalConditions } from './technical.js';
import { buildMacroFxTransmission } from './macro-fx.js';

export const AI_DOMAIN_ANALYSIS_REGISTRY_VERSION = 'domain-analysis-registry.v1';

export function createDomainAnalysisRegistry() {
  const analyze = (questionPlan = {}, inputs = {}) => {
    const intent = questionPlan?.intent?.primary || questionPlan?.intent || 'UNKNOWN';
    if (intent === 'MARKET_CAUSAL') return buildCausalAttribution(inputs);
    if (intent === 'SECTOR_ANALYSIS') return buildSectorDecomposition(inputs);
    if (intent === 'ENTITY_ANALYSIS' || intent === 'ENTITY_FACT') return buildCompanyAssessment(inputs);
    if (intent === 'TECHNICAL_ANALYSIS' || intent === 'OUTLOOK') return buildTechnicalConditions(inputs);
    if (intent === 'MACRO_ANALYSIS' || intent === 'FX_ANALYSIS') return buildMacroFxTransmission(inputs);
    return Object.freeze({ schemaVersion: AI_DOMAIN_ANALYSIS_REGISTRY_VERSION, status: 'not-applicable', intent });
  };
  return Object.freeze({ version: AI_DOMAIN_ANALYSIS_REGISTRY_VERSION, analyze });
}
