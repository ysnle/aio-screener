export const SOURCE_PRESERVED_STATUS = 'RECONSTRUCTION_REQUIRED';
export const SEMANTIC_REFERENCE_STATUS = 'SEMANTIC_REFERENCE_AUTHORED';
export const REFERENCE_PUBLICATION = 'EDUCATIONAL_REFERENCE_ONLY';

const SOURCE_PRESERVED_SUMMARY_FIELDS = ['definition', 'mechanism', 'example', 'counterScenario', 'visualization'];
const AUTHORING_STATUSES = new Set([SOURCE_PRESERVED_STATUS, SEMANTIC_REFERENCE_STATUS]);

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const hasItems = (value) => Array.isArray(value) && value.length > 0;
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function sourceFieldMap(surface) {
  if (surface === 'principles') return {
    definition: ['definition', 'definition'],
    mechanism: ['mechanism', 'mechanism'],
    example: ['example', 'example'],
    counterScenario: ['counterScenario', 'counterScenario'],
    verificationQuestion: ['verificationQuestion', 'verificationQuestion'],
    visualization: ['diagram', 'diagram']
  };
  if (surface === 'atlas-foundations') return {
    definition: ['definition', 'definition'],
    mechanism: ['mechanism', 'mechanism'],
    example: ['example', 'example'],
    counterScenario: ['limit', 'counterScenario'],
    verificationQuestion: ['teachingQuestion', 'verificationQuestion'],
    visualization: ['visualization', 'diagram']
  };
  throw new Error(`unknown knowledge authoring surface: ${surface}`);
}

export function sourceSummaryFor(surface, source, failures = [], label = source?.id || 'source') {
  const map = sourceFieldMap(surface);
  const summary = source?.summary;
  const result = {};
  for (const [key, [sourceKey, summaryKey]] of Object.entries(map)) {
    const original = source?.[sourceKey];
    const summarized = summary?.[summaryKey];
    if (!hasText(original)) failures.push(`${label}: missing source ${sourceKey}`);
    if (!hasText(summarized)) failures.push(`${label}: missing source summary ${summaryKey}`);
    if (hasText(original) && hasText(summarized) && original !== summarized) failures.push(`${label}: source summary identity mismatch for ${key}`);
    result[key] = original;
  }
  return result;
}

function authoringMode(artifact, lessons, failures) {
  const statuses = [artifact?.deepFormStatus, ...(lessons || []).map((lesson) => lesson?.deepStatus)];
  if (!statuses.length || statuses.some((status) => !AUTHORING_STATUSES.has(status))) {
    failures.push('authoring depth status is missing or unsupported');
    return null;
  }
  if (statuses.every((status) => status === SEMANTIC_REFERENCE_STATUS)) return SEMANTIC_REFERENCE_STATUS;
  if (statuses.every((status) => status === SOURCE_PRESERVED_STATUS)) return SOURCE_PRESERVED_STATUS;
  failures.push('authoring depth status mixes source-preserved and semantic modes');
  return null;
}

function validateSemanticLesson(surface, lesson, label, failures) {
  const required = [
    ['summary.definition', lesson?.summary?.definition],
    ['formalModel.variables', lesson?.formalModel?.variables],
    ['workedExample.inputs', lesson?.workedExample?.inputs],
    ['workedExample.steps', lesson?.workedExample?.steps],
    ['workedExample.result', lesson?.workedExample?.result],
    ['workedExample.failureBoundary', lesson?.workedExample?.failureBoundary],
    ['realEconomyChannel', lesson?.realEconomyChannel],
    ['companyChannel', lesson?.companyChannel],
    ['financialStatementChannel', lesson?.financialStatementChannel],
    ['valuationChannel', lesson?.valuationChannel],
    ['marketChannel', lesson?.marketChannel],
    ['tradingApplication', lesson?.tradingApplication],
    ['invalidation', lesson?.invalidation],
    ['glossary', lesson?.glossary],
    ['claimIds', lesson?.claimIds]
  ];
  for (const [field, value] of required) {
    const valid = ['formalModel.variables', 'workedExample.inputs', 'workedExample.steps', 'glossary', 'claimIds'].includes(field)
      ? hasItems(value)
      : hasText(value);
    if (!valid) failures.push(`${label}: semantic field ${field} is incomplete`);
  }
  if (!['principles', 'atlas-foundations'].includes(surface)) failures.push(`${label}: unknown semantic surface`);
}

function validateReferenceBoundary(artifact, article, label, failures) {
  if (article?.publication !== REFERENCE_PUBLICATION) failures.push(`${label}: publication boundary drifted`);
  if (artifact?.publication !== REFERENCE_PUBLICATION) failures.push(`${label}: source publication boundary drifted`);
  if (article?.quality?.semanticReview !== 'REQUIRED') failures.push(`${label}: semantic review boundary drifted`);
  if (article?.quality?.sourceDirectnessReview !== 'REQUIRED') failures.push(`${label}: source directness review boundary drifted`);
  if (article?.quality?.userValidation !== 'NOT_CONDUCTED') failures.push(`${label}: user validation boundary drifted`);
}

function validateSourcePreservedArticle(surface, source, article, artifact, label, failures) {
  const expected = sourceSummaryFor(surface, source, failures, `${label}:source`);
  const articleSummary = article?.summary;
  for (const field of SOURCE_PRESERVED_SUMMARY_FIELDS) {
    if (articleSummary?.[field] !== expected[field]) failures.push(`${label}: summary ${field} altered or padded`);
  }

  const body = article?.article;
  if (body?.intuition !== expected.definition) failures.push(`${label}: definition altered or padded`);
  if (body?.formalModelOrRationale?.text !== expected.mechanism) failures.push(`${label}: mechanism altered or padded`);
  if (!sameJson(body?.workedExampleOrRationale?.inputs, [expected.example])) failures.push(`${label}: example altered or padded`);
  if (body?.invalidation !== expected.counterScenario) failures.push(`${label}: counter scenario altered or padded`);
  if (body?.tradingApplication !== expected.verificationQuestion) failures.push(`${label}: verification question altered or padded`);
  if (!sameJson(article?.deepArticle?.uniqueDraftSeed, expected)) failures.push(`${label}: unique source draft seed drifted`);

  const sourceIds = source?.sourceIds || [];
  const claimIds = source?.claimIds || [];
  if (!hasItems(sourceIds) || !hasItems(body?.sourceIds) || !sourceIds.every((id) => body.sourceIds.includes(id))) failures.push(`${label}: source claim IDs lost or changed`);
  if (!hasItems(claimIds) || !hasItems(body?.claimIds) || !claimIds.every((id) => body.claimIds.includes(id))) failures.push(`${label}: claim IDs lost or changed`);
  if (article?.deepArticle?.status !== SOURCE_PRESERVED_STATUS) failures.push(`${label}: source-preserved article promoted without reconstruction`);
  if (article?.quality?.contentForm !== 'SOURCE_SUMMARY') failures.push(`${label}: source-preserved content form drifted`);
  if (article?.authoringStatus !== 'STRUCTURED_REFERENCE_DRAFT') failures.push(`${label}: source-preserved authoring status drifted`);
  if (!Array.isArray(article?.deepArticle?.progressiveDisclosure) || article.deepArticle.progressiveDisclosure.length < 2) failures.push(`${label}: source-preserved progressive disclosure is incomplete`);
  if (article?.deepArticle?.progressiveDisclosure?.includes('5-minute-core-article')) failures.push(`${label}: inflated reading promise`);

  const worked = body?.workedExampleOrRationale;
  if (!Array.isArray(worked?.assumptions) || worked.assumptions.length !== 0 || !Array.isArray(worked?.steps) || worked.steps.length !== 0 || worked.result !== '' || worked.interpretation !== '' || worked.failureBoundary !== '') {
    failures.push(`${label}: source-preserved worked example contains unreviewed deep padding`);
  }
  validateReferenceBoundary(artifact, article, label, failures);
}

function validateSemanticArticle(article, label, failures) {
  if (article?.publication !== REFERENCE_PUBLICATION) failures.push(`${label}: publication boundary drifted`);
  if (article?.deepArticle?.status !== SEMANTIC_REFERENCE_STATUS) failures.push(`${label}: semantic article status drifted`);
  if (!hasItems(article?.article?.claimIds)) failures.push(`${label}: semantic article claim IDs missing`);
}

export function validateKnowledgeAuthoringCorpus({ surface, artifact, articles = [] }) {
  const failures = [];
  const lessons = artifact?.lessons || [];
  const mode = authoringMode(artifact, lessons, failures);
  if (artifact?.status !== 'REFERENCE_CONNECTED') failures.push(`${surface}: source artifact status drifted`);
  if (artifact?.publication !== REFERENCE_PUBLICATION) failures.push(`${surface}: source artifact publication boundary drifted`);

  const lessonsById = new Map();
  for (const lesson of lessons) {
    if (!lesson?.id || lessonsById.has(lesson.id)) failures.push(`${surface}: duplicate or missing source lesson ID`);
    lessonsById.set(lesson?.id, lesson);
    const label = `${surface}:${lesson?.id || 'missing'}`;
    const expected = sourceSummaryFor(surface, lesson, failures, label);
    if (!hasItems(lesson?.sourceIds)) failures.push(`${label}: source IDs missing`);
    if (!hasItems(lesson?.claimIds)) failures.push(`${label}: claim IDs missing`);
    if (mode === SEMANTIC_REFERENCE_STATUS) validateSemanticLesson(surface, lesson, label, failures);
    if (mode === SOURCE_PRESERVED_STATUS && !sameJson(lesson?.summary, {
      definition: expected.definition,
      mechanism: expected.mechanism,
      example: expected.example,
      counterScenario: expected.counterScenario,
      verificationQuestion: expected.verificationQuestion,
      diagram: expected.visualization
    })) failures.push(`${label}: source summary identity drifted`);
  }

  if (articles.length !== lessons.length) failures.push(`${surface}: generated article coverage ${articles.length}/${lessons.length}`);
  const articleIds = new Set();
  for (const article of articles) {
    const label = `${article?.articleId || `${surface}:${article?.lessonId || 'missing'}`}`;
    if (articleIds.has(article?.articleId)) failures.push(`${label}: duplicate generated article ID`);
    articleIds.add(article?.articleId);
    const source = lessonsById.get(article?.lessonId);
    if (!source) {
      failures.push(`${label}: source lesson missing`);
      continue;
    }
    if (article.surface !== surface || article.articleId !== `${surface}:${article.lessonId}`) failures.push(`${label}: article identity drifted`);
    if (mode === SOURCE_PRESERVED_STATUS) validateSourcePreservedArticle(surface, source, article, artifact, label, failures);
    if (mode === SEMANTIC_REFERENCE_STATUS) validateSemanticArticle(article, label, failures);
  }
  return { mode, failures };
}

function fixtureSource() {
  return {
    id: 'F1',
    definition: 'definition',
    mechanism: 'mechanism',
    example: 'example',
    counterScenario: 'counter',
    verificationQuestion: 'question',
    diagram: 'diagram',
    sourceIds: ['SOURCE-1'],
    claimIds: ['CLAIM-1'],
    summary: { definition: 'definition', mechanism: 'mechanism', example: 'example', counterScenario: 'counter', verificationQuestion: 'question', diagram: 'diagram' },
    deepStatus: SOURCE_PRESERVED_STATUS
  };
}

function fixtureArticle(source) {
  return {
    schemaVersion: 'knowledge-article.v1',
    articleId: 'principles:F1',
    lessonId: 'F1',
    surface: 'principles',
    authoringStatus: 'STRUCTURED_REFERENCE_DRAFT',
    publication: REFERENCE_PUBLICATION,
    summary: { definition: source.definition, mechanism: source.mechanism, example: source.example, counterScenario: source.counterScenario, visualization: source.diagram },
    article: {
      intuition: source.definition,
      formalModelOrRationale: { text: source.mechanism },
      workedExampleOrRationale: { inputs: [source.example], assumptions: [], steps: [], result: '', interpretation: '', failureBoundary: '' },
      tradingApplication: source.verificationQuestion,
      invalidation: source.counterScenario,
      sourceIds: [...source.sourceIds],
      claimIds: [...source.claimIds]
    },
    quality: { contentForm: 'SOURCE_SUMMARY', semanticReview: 'REQUIRED', sourceDirectnessReview: 'REQUIRED', userValidation: 'NOT_CONDUCTED' },
    deepArticle: { status: SOURCE_PRESERVED_STATUS, progressiveDisclosure: ['source-summary', 'research-evidence'], uniqueDraftSeed: { definition: source.definition, mechanism: source.mechanism, example: source.example, counterScenario: source.counterScenario, verificationQuestion: source.verificationQuestion, visualization: source.diagram } }
  };
}

export function runKnowledgeAuthoringNegativeFixtures() {
  const source = fixtureSource();
  const artifact = { status: 'REFERENCE_CONNECTED', publication: REFERENCE_PUBLICATION, deepFormStatus: SOURCE_PRESERVED_STATUS, lessons: [source] };
  const cases = [
    ['false-promotion', (article) => ({ ...article, deepArticle: { ...article.deepArticle, status: SEMANTIC_REFERENCE_STATUS } }), /promoted without reconstruction/],
    ['source-mismatch', (article) => ({ ...article, summary: { ...article.summary, definition: 'tampered' } }), /summary definition altered/],
    ['field-deletion', (article) => ({ ...article, article: { ...article.article, sourceIds: [] } }), /source claim IDs lost/]
  ];
  const unexpected = [];
  for (const [name, mutate, expected] of cases) {
    const article = mutate(fixtureArticle(source));
    const result = validateKnowledgeAuthoringCorpus({ surface: 'principles', artifact, articles: [article] });
    if (!result.failures.some((failure) => expected.test(failure))) unexpected.push(`${name} fixture did not fail closed`);
  }
  return unexpected;
}
