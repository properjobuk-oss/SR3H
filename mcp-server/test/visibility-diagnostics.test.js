import test from 'node:test';
import assert from 'node:assert/strict';
import { collectVisibilityDiagnostics, validateFindings, applyEvidenceReview } from '../src/visibility-diagnostics.js';
import { analyseVisibility } from '../src/visibility-model.js';

const website = 'https://test.example/';
const blocked = 'The checked page asks search engines not to index it.';
const answer = 'Other Co provides an owner-controlled public profile.';
function evidenceFixture() {
  const study = { business: 'Test Co', website_url: website, conditions: { model: 'test-model' },
    questions: [{ id: 'q1', kind: 'category', question: 'Which services provide public profiles?' },
      { id: 'q2', kind: 'problem', question: 'How can I show an interactive card in an AI chat?' }],
    audit: { audit: { checked_at: '2026-10-08T10:00:00Z' },
      observations: [{ id: 'indexing', status: 'blocked', evidence: blocked, source_url: website },
        { id: 'structured_data', status: 'clear', evidence: 'Structured data found: Organization, ProfilePage. Parse errors: 0.', source_url: website },
        { id: 'mcp', status: 'clear', evidence: 'A public MCP reference is present on the connection page.', source_url: `${website}connect` }],
      gaps: [{ id: 'noindex', finding: blocked, action: 'Remove noindex on this intended public profile page.' }] },
    site_context: { pages: [{ url: `${website}connect`, text: 'Connect this existing app to ChatGPT and display a public profile card.', references: { mcp: `${website}mcp` } }] } };
  const samples = [{ id: 'saved-1', question_id: 'q1', status: 'complete', kind: 'category', answer,
    sources: [{ url: 'https://other.example/' }], citations: [{ url: 'https://other.example/' }],
    assessment: { appearance: 'not_seen', other_providers: [{ evidence_url: 'https://other.example/' }] } }];
  const reason = { id: 'r1', stage: 'access_indexing', status: 'observed_gap', reason: blocked,
    sample_ids: ['saved-1'], audit_ids: ['noindex'], evidence: [{ source_id: 'gap:noindex', quote: blocked }],
    uncertainty: 'This does not explain every saved absence.', next_check: 'Verify the public page after removing its noindex directive.' };
  const intervention = { id: 'i1', reason_id: 'r1', feature: 'indexing', operation: 'correct', priority: 'high',
    title: 'Allow the public profile to be indexed', target_url: website, change: 'Remove noindex from this intended public profile page.',
    rationale: 'The checked page explicitly requests exclusion from search indexes.', sample_ids: ['saved-1'], audit_ids: ['noindex'],
    evidence: reason.evidence, question_ids: ['q1'], expected_effect: 'The page becomes eligible to be indexed.',
    success_measure: 'Confirm indexing eligibility, then compare unbranded mentions using the frozen question.',
    retest_when: 'Check the directive after deployment; measure discovery after a confirmed recrawl.', uncertainty: 'Indexing and visibility are not guaranteed.' };
  return { study, samples, reason, intervention };
}
const readSource = async () => new Response('<html><body>Other Co publishes public profiles and a verified live example.</body></html>', { headers: { 'content-type': 'text/html' } });
const modelResponse = value => Response.json({ status: 'completed', model: 'test-model', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });

test('known indexing issue retains a specific repair with quoted evidence and a frozen retest', async () => {
  const f = evidenceFixture(), diagnostics = await collectVisibilityDiagnostics(f.study, f.samples, readSource);
  const valid = validateFindings({ reasons: [f.reason], interventions: [f.intervention] }, f.study, f.samples, diagnostics);
  assert.equal(valid.reasons.length, 1); assert.equal(valid.interventions.length, 1);
  assert.equal(valid.interventions[0].target_url, website);
  assert.deepEqual(valid.interventions[0].question_ids, ['q1']);
  assert.equal(diagnostics.checks.find(item => item.id === 'index_coverage').status, 'unknown');
  assert.equal(diagnostics.checks.find(item => item.id === 'host_rendering').status, 'unknown');
});

test('invented quotes and quotes from a different sample cannot substantiate a recommendation', async () => {
  const f = evidenceFixture(), diagnostics = await collectVisibilityDiagnostics(f.study, f.samples, readSource);
  for (const evidence of [[{ source_id: 'gap:noindex', quote: 'Google has already removed this website from its index.' }],
    [{ source_id: 'answer:saved-1', quote: answer }]]) {
    const reason = { ...f.reason, sample_ids: [], evidence };
    assert.equal(validateFindings({ reasons: [reason], interventions: [f.intervention] }, f.study, f.samples, diagnostics).reasons.length, 0);
  }
});

test('existing schema and connection guidance reject duplicate additions', async () => {
  const f = evidenceFixture(), diagnostics = await collectVisibilityDiagnostics(f.study, f.samples, readSource);
  for (const feature of ['structured_data', 'connection_guidance']) {
    const value = validateFindings({ reasons: [f.reason], interventions: [{ ...f.intervention, operation: 'add', feature }] }, f.study, f.samples, diagnostics);
    assert.equal(value.interventions.length, 0);
  }
});

test('untested card rendering cannot justify a card repair', async () => {
  const f = evidenceFixture(), diagnostics = await collectVisibilityDiagnostics(f.study, f.samples, readSource);
  assert.equal(validateFindings({ reasons: [f.reason], interventions: [{ ...f.intervention, feature: 'card_rendering' }] }, f.study, f.samples, diagnostics).interventions.length, 0);
  const reason = { ...f.reason, stage: 'card_rendering', status: 'observed_gap' };
  assert.equal(validateFindings({ reasons: [reason], interventions: [] }, f.study, f.samples, diagnostics).reasons.length, 0);
});

test('unbranded absence alone cannot substantiate identity confusion', async () => {
  const f = evidenceFixture(), diagnostics = await collectVisibilityDiagnostics(f.study, f.samples, readSource);
  const reason = { ...f.reason, stage: 'identity', status: 'hypothesis', audit_ids: [], evidence: [{ source_id: 'answer:saved-1', quote: answer }] };
  const result = validateFindings({ reasons: [reason], interventions: [] }, f.study, f.samples, diagnostics);
  assert.equal(result.reasons.length, 0); assert.equal(result.rejections[0].reason, 'identity_not_investigated');
});

test('unverified sitemap retrieval cannot become a confirmed missing sitemap', async () => {
  const f = evidenceFixture();
  f.study.audit.gaps = [{ id: 'sitemap', finding: 'No readable XML sitemap was found.' }];
  f.study.audit.observations = [{ id: 'sitemap', status: 'unverified', evidence: 'The sitemap could not be read.' }];
  const diagnostics = await collectVisibilityDiagnostics(f.study, f.samples, readSource);
  assert.equal(diagnostics.documents.some(doc => doc.id === 'gap:sitemap'), false);
  assert.equal(diagnostics.checks.some(item => item.id === 'gap:sitemap'), false);
});

test('interventions cannot change a competitor page, use invented retest questions or use only failed evidence', async () => {
  const f = evidenceFixture(), diagnostics = await collectVisibilityDiagnostics(f.study, f.samples, readSource);
  for (const intervention of [{ ...f.intervention, target_url: 'https://other.example/' }, { ...f.intervention, question_ids: ['q9'] },
    { ...f.intervention, success_measure: '' }]) {
    assert.equal(validateFindings({ reasons: [f.reason], interventions: [intervention] }, f.study, f.samples, diagnostics).interventions.length, 0);
  }
  f.samples[0].status = 'failed';
  assert.equal(validateFindings({ reasons: [f.reason], interventions: [f.intervention] }, f.study, f.samples, diagnostics).interventions.length, 0);
});

test('source investigation is restricted to actual citations, capped at three and removes executable page content', async () => {
  const f = evidenceFixture();
  const urls = Array.from({ length: 6 }, (_, i) => `https://source${i}.example/`);
  f.samples[0].sources = urls.map(url => ({ url }));
  f.samples[0].citations = urls.slice(0, 5).map(url => ({ url }));
  const calls = [];
  const diagnostics = await collectVisibilityDiagnostics(f.study, f.samples, async url => {
    calls.push(String(url));
    return new Response('<html><script>steal secrets</script><body>A public source explains the working service and its verified example.</body></html>', { headers: { 'content-type': 'text/html' } });
  });
  assert.equal(calls.length, 3); assert.equal(calls.includes(urls[5]), false);
  assert.equal(diagnostics.source_checks.filter(item => item.status === 'checked').length, 3);
  assert.equal(diagnostics.documents.some(doc => doc.text.includes('steal secrets')), false);
});

test('private sources and redirects are blocked while unavailable sources stay unknown', async () => {
  const f = evidenceFixture();
  f.samples[0].sources.push({ url: 'http://127.0.0.1/private' }); f.samples[0].citations.push({ url: 'http://127.0.0.1/private' });
  const calls = [];
  const diagnostics = await collectVisibilityDiagnostics(f.study, f.samples, async url => {
    calls.push(String(url)); return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } });
  });
  assert.deepEqual(calls, ['https://other.example/']);
  assert.equal(diagnostics.source_checks[0].status, 'unavailable');
  assert.equal(diagnostics.documents.some(item => item.kind === 'source'), false);
});

test('source checks cover separate questions and extract article content ahead of navigation', async () => {
  const f = evidenceFixture(), urls = ['https://first.example/', 'https://second.example/', 'https://third.example/'];
  f.samples[0].sources = urls.map(url => ({ url })); f.samples[0].citations = urls.map(url => ({ url }));
  f.samples[0].assessment.other_providers = [];
  f.samples.push({ ...f.samples[0], id: 'saved-2', question_id: 'q2', sources: [{ url: 'https://sdk.example/' }], citations: [{ url: 'https://sdk.example/' }] });
  const calls = [];
  const diagnostics = await collectVisibilityDiagnostics(f.study, f.samples, async url => {
    calls.push(String(url));
    return new Response(`<html><div>${'Navigation noise '.repeat(1000)}</div><article>The profile card requires a connected host to load its widget resource.</article></html>`, { headers: { 'content-type': 'text/html' } });
  });
  assert.equal(calls.length, 3); assert.equal(calls.includes('https://sdk.example/'), true);
  assert.equal(diagnostics.documents.filter(doc => doc.kind === 'source').every(doc => doc.text.startsWith('The profile card')), true);
});

test('independent review rejects a causal claim despite its real quote and valid IDs', () => {
  const f = evidenceFixture();
  const result = applyEvidenceReview({ reasons: [f.reason], interventions: [f.intervention], discarded: 0 }, {
    reason_reviews: [{ id: 'r1', verdict: 'unsupported', explanation: 'This quote does not establish the claimed cause of all non-appearance.' }],
    intervention_reviews: [{ id: 'i1', verdict: 'supported', explanation: 'The repair would otherwise be relevant.' }] });
  assert.equal(result.reasons.length, 0); assert.equal(result.interventions.length, 0);
});

test('missing and duplicate review verdicts fail closed', () => {
  const f = evidenceFixture(), findings = { reasons: [f.reason], interventions: [f.intervention], discarded: 0 };
  const verdict = { id: 'r1', verdict: 'supported', explanation: 'The checked directive supports this exact observation.' };
  assert.equal(applyEvidenceReview(findings, {}).reasons.length, 0);
  assert.equal(applyEvidenceReview(findings, { reason_reviews: [verdict, verdict] }).reasons.length, 0);
});

test('review-provider failure withholds advice, preserves evidence and never starts another search', async () => {
  const f = evidenceFixture(), before = structuredClone(f.samples), calls = [];
  const result = await analyseVisibility(f.study, f.samples, { OPENAI_API_KEY: 'test-only' }, async (url, init) => {
    if (String(url) !== 'https://api.openai.com/v1/responses') return readSource();
    const request = JSON.parse(init.body); calls.push(request);
    if (request.text.format.name === 'signal_evidence_review') return new Response('', { status: 503 });
    return modelResponse({ reasons: [f.reason], interventions: [f.intervention] });
  });
  assert.equal(result.review_status, 'unavailable'); assert.deepEqual(result.interventions, []); assert.deepEqual(result.reasons, []);
  assert.equal(calls.length, 2); assert.equal(calls.some(call => call.tools), false);
  assert.deepEqual(f.samples, before);
});

test('review reserves its own allowance and makes no call when exhausted', async () => {
  const f = evidenceFixture(), calls = [];
  const result = await analyseVisibility(f.study, f.samples, { OPENAI_API_KEY: 'test-only' }, async (url, init) => {
    if (String(url) !== 'https://api.openai.com/v1/responses') return readSource();
    calls.push(JSON.parse(init.body)); return modelResponse({ reasons: [f.reason], interventions: [f.intervention] });
  }, { reserveReview: async () => ({ allowed: false }) });
  assert.equal(calls.length, 1); assert.equal(result.review_status, 'unavailable'); assert.deepEqual(result.interventions, []);
});

test('evidence ID enums cannot leak into quotes, diagnosis text or different reference fields', async () => {
  const f = evidenceFixture(); let schema;
  await analyseVisibility(f.study, f.samples, { OPENAI_API_KEY: 'test-only' }, async (url, init) => {
    if (String(url) !== 'https://api.openai.com/v1/responses') return readSource();
    schema = JSON.parse(init.body).text.format.schema;
    return modelResponse({ reasons: [], interventions: [] });
  });
  const reasons = schema.properties.reasons.items.properties, interventions = schema.properties.interventions.items.properties;
  assert.equal(reasons.reason.enum, undefined); assert.equal(reasons.next_check.enum, undefined);
  assert.equal(reasons.evidence.items.properties.quote.enum, undefined);
  assert.equal(interventions.change.enum, undefined); assert.equal(interventions.success_measure.enum, undefined);
  assert.deepEqual(reasons.id.enum, ['r1', 'r2', 'r3', 'r4', 'r5']);
  assert.deepEqual(reasons.sample_ids.items.enum, ['saved-1']);
  assert.equal(reasons.audit_ids.items.enum.includes('indexing'), true);
  assert.deepEqual(interventions.question_ids.items.enum, ['q1', 'q2']);
  assert.equal(reasons.evidence.items.properties.source_id.enum.includes('gap:noindex'), true);
});
