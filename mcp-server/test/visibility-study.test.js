import test from 'node:test';
import assert from 'node:assert/strict';
import { VisibilityStudy, compareVisibility, newStudyReference, studyRequest } from '../src/visibility-study.js';
import { captureRequest, captureVisibility, validateAssessment, VISIBILITY_PROTOCOL } from '../src/visibility-model.js';
import { validateQuestions } from '../src/visibility-tools.js';
import { UsageGuard, reserveDiscoveryUsage } from '../src/usage-guard.js';

function memoryContext() {
  const map = new Map();
  let lock = Promise.resolve();
  const ctx = { map, alarm: null,
    storage: {
      get: async key => Array.isArray(key) ? new Map(key.filter(item => map.has(item)).map(item => [item, structuredClone(map.get(item))])) : structuredClone(map.get(key)),
      put: async (key, value) => { if (typeof key === 'object') { for (const [name, item] of Object.entries(key)) map.set(name, structuredClone(item)); } else map.set(key, structuredClone(value)); },
      setAlarm: async time => { ctx.alarm = time; }, deleteAlarm: async () => { ctx.alarm = null; }, deleteAll: async () => { map.clear(); }
    },
    blockConcurrencyWhile: fn => { const operation = lock.then(fn); lock = operation.catch(() => {}); return operation; }
  };
  return ctx;
}
const questions = [
  { id: 'q1', kind: 'branded', question: 'What does Test Co offer?' },
  { id: 'q2', kind: 'category', question: 'Which providers offer test services?' }
];
function studyInput(repetitions = 2) {
  return { business: 'Test Co', website_url: 'https://test.example/', visitor: 'visitor', questions,
    audit: { audit: { technical_readiness: 'clear' }, observations: [], gaps: [] },
    conditions: { model: 'gpt-5.4-mini', repetitions, location: { country: 'GB' }, protocol: VISIBILITY_PROTOCOL } };
}
function fixture(options = {}) {
  const ctx = memoryContext();
  const calls = [];
  let improved = false;
  const env = { OPENAI_API_KEY: 'test-only', USAGE_GUARD: {
    idFromName: name => name, get: () => ({ fetch: async () => Response.json({ allowed: options.quota !== false, reason: 'daily_limit' }) })
  } };
  const runner = new VisibilityStudy(ctx, env);
  runner.fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body); calls.push(body);
    const payload = value => Response.json({ id: 'response-test', status: 'completed', model: 'gpt-5.4-mini-2026-03-17',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value), annotations: [] }] }] });
    if (body.tools) {
      if (options.captureHook) await options.captureHook();
      if (options.captureFailure) return Response.json({ error: 'provider error with sensitive detail' }, { status: 503 });
      const named = body.input.includes('Test Co') || improved;
      const answer = named ? 'Test Co is worth considering for test services.' : 'Other Co offers test services.';
      return Response.json({ id: 'captured-response', status: 'completed', model: options.model || 'gpt-5.4-mini-2026-03-17',
        output: [ { type: 'web_search_call', status: 'completed', action: { sources: [{ url: named ? 'https://test.example/' : 'https://other.example/' }] } },
          { type: 'message', content: [{ type: 'output_text', text: answer, annotations: [{ type: 'url_citation', url: named ? 'https://test.example/' : 'https://other.example/' }] }] } ] });
    }
    if (body.text.format.name === 'signal_saved_answer_assessment') {
      const input = JSON.parse(body.input);
      const named = input.answer.includes('Test Co');
      return payload({ appearance: named ? 'recommended' : 'not_seen', quote: named ? input.answer : '',
        evidence_url: named ? 'https://test.example/' : null, explanation: 'Classification of the saved answer.', other_providers: [] });
    }
    const input = JSON.parse(body.input);
    return payload({ reasons: [{ reason: 'Independent coverage may be limited.', status: 'hypothesis',
      sample_ids: [input.samples[0].id], audit_ids: [], uncertainty: 'Absence does not establish its cause.', next_check: 'Review competing sources.' }],
      interventions: [{ title: 'Clarify service evidence', change: 'Add a clear service description with verifiable evidence.', rationale: 'Test whether better evidence helps.',
        sample_ids: [input.samples[0].id], audit_ids: [], question_ids: ['q2'], uncertainty: 'No effect is guaranteed.' }] });
  };
  const invoke = async (operation, data = {}) => {
    const response = await runner.fetch(new Request(`https://study.internal/${operation}`, { method: 'POST', body: JSON.stringify(data) }));
    return { status: response.status, ...await response.json() };
  };
  const complete = async () => {
    for (let step = 0; step < 40; step++) {
      const state = await invoke('get');
      if (['complete', 'partial', 'cancelled'].includes(state.status)) return state;
      await runner.alarm();
    }
    throw new Error('runner did not terminate');
  };
  return { runner, ctx, calls, invoke, complete, improve: () => { improved = true; } };
}

test('neutral capture contains only the question and frozen settings, with API storage disabled', () => {
  const request = captureRequest(questions[1], studyInput().conditions);
  assert.equal(request.input, questions[1].question);
  assert.equal(request.store, false);
  assert.equal('previous_response_id' in request, false);
  assert.equal('conversation' in request, false);
  assert.equal(JSON.stringify(request).includes('Test Co'), false);
  assert.equal(JSON.stringify(request).includes('test.example'), false);
  assert.deepEqual(request.tools, [{ type: 'web_search', user_location: { type: 'approximate', country: 'GB' } }]);
  assert.deepEqual(request.include, ['web_search_call.action.sources']);
});

test('persists raw answers before analysis and completes a real before/change/after contract', async () => {
  const f = fixture();
  await f.invoke('create', studyInput());
  const started = await f.invoke('start', { phase: 'baseline', request_key: 'baseline' });
  assert.equal(started.status, 'queued');
  const same = await f.invoke('start', { phase: 'baseline', request_key: 'baseline' });
  assert.equal(same.run.id, started.run.id);
  const baseline = await f.complete();
  assert.equal(baseline.status, 'complete');
  assert.equal(baseline.counts.completed, 4);
  assert.equal(baseline.counts.branded.recommended, 2);
  assert.equal(baseline.counts.unbranded.mentioned, 0);
  assert.equal(baseline.analysis.status, 'complete');
  const full = await f.invoke('get', { include_samples: true, limit: 1 });
  assert.equal(full.samples[0].capture.answer, 'Test Co is worth considering for test services.');
  assert.equal(full.next_offset, 1);
  assert.equal(f.calls.filter(call => call.tools).length, 4);
  for (const call of f.calls.filter(call => call.tools && !call.input.includes('Test Co'))) assert.doesNotMatch(JSON.stringify(call), /Test Co|test\.example/);
  assert.equal((await f.invoke('start', { phase: 'reassessment', request_key: 'after' })).error, 'implemented_change_required');
  const intervention = await f.invoke('intervention', { title: 'Clearer service page', change: 'Added clearer service wording and evidence.',
    rationale: 'The unbranded question did not name the company.', sample_ids: [baseline.sample_index[1].id], expected_effect: 'More relevant mentions',
    implemented_at: new Date().toISOString(), implementation_evidence_urls: ['https://test.example/'], concurrent_changes: 'None reported' });
  assert.ok(intervention.recorded_intervention_id);
  f.improve();
  const after = await f.invoke('start', { phase: 'reassessment', request_key: 'after', intervention_id: intervention.recorded_intervention_id });
  await f.complete();
  const compared = await f.invoke('compare', { run_id: after.run.id });
  assert.equal(compared.comparison.outcome, 'observed_increase');
  assert.deepEqual(compared.comparison.mentions, { before: 0, after: 2, delta: 2, paired_samples: 2 });
  assert.match(compared.comparison.limitation, /does not establish.*caused/);
  assert.equal((await f.invoke('start', { phase: 'reassessment', request_key: 'after', intervention_id: intervention.recorded_intervention_id })).run.id, after.run.id);
});

test('provider failures remain failures, never zero-visibility evidence', async () => {
  const f = fixture({ captureFailure: true });
  await f.invoke('create', studyInput(1)); await f.invoke('start', { phase: 'baseline', request_key: 'first' });
  const result = await f.complete();
  assert.equal(result.status, 'partial'); assert.equal(result.counts.failed, 2); assert.equal(result.counts.unbranded.checked, 0);
  assert.equal(result.analysis.status, 'unavailable');
  assert.equal(f.calls.some(call => call.text), false);
  assert.equal(JSON.stringify(result).includes('sensitive detail'), false);
});

test('quota exhaustion makes no paid provider calls and leaves explicit missing evidence', async () => {
  const f = fixture({ quota: false });
  await f.invoke('create', studyInput(1)); await f.invoke('start', { phase: 'baseline', request_key: 'first' });
  const result = await f.complete();
  assert.equal(f.calls.length, 0); assert.equal(result.counts.failed, 2); assert.equal(result.sample_index[0].error, 'daily_limit');
});

test('unsupported classifications cannot count as mentions, recommendations or absences', () => {
  const capture = { answer: 'Other Co is an option.', sources: [{ url: 'https://other.example/' }] };
  assert.throws(() => validateAssessment({ appearance: 'recommended', quote: 'Test Co is ideal.', evidence_url: 'https://other.example/', explanation: '' }, capture, 'Test Co', 'https://test.example'), /unsupported/);
  assert.throws(() => validateAssessment({ appearance: 'source_only', quote: '', evidence_url: 'https://other.example/', explanation: '' }, capture, 'Test Co', 'https://test.example'), /unsupported/);
  assert.throws(() => validateAssessment({ appearance: 'not_seen', quote: '', evidence_url: null, explanation: '' }, { ...capture, answer: 'Test Co is an option.' }, 'Test Co', 'https://test.example'), /unsupported/);
});

test('model drift and missing pairs prevent an improvement conclusion', () => {
  const sample = (model, appearance) => ({ question_id: 'q2', kind: 'category', repetition: 1, status: 'complete', capture: { model }, assessment: { appearance } });
  const run = { id: 'run', total: 1, conditions: studyInput().conditions };
  const changed = compareVisibility(studyInput(), run, run, [sample('one', 'not_seen')], [sample('two', 'recommended')]);
  assert.equal(changed.outcome, 'inconclusive'); assert.equal(changed.comparable, false);
  assert.equal(compareVisibility(studyInput(), run, run, [sample('one', 'not_seen')], []).outcome, 'inconclusive');
  assert.equal(compareVisibility(studyInput(), run, run, [sample('one', 'recommended')], [sample('one', 'not_seen')]).outcome, 'observed_decrease');
  assert.equal(compareVisibility(studyInput(), run, run, [sample('one', 'not_seen')], [sample('one', 'not_seen')]).outcome, 'no_clear_change');
});

test('deleting while a capture is in flight does not recreate study or answer records', async () => {
  let release, entered;
  const waiting = new Promise(resolve => { release = resolve; });
  const began = new Promise(resolve => { entered = resolve; });
  const f = fixture({ captureHook: async () => { entered(); await waiting; } });
  await f.invoke('create', studyInput(1)); await f.invoke('start', { phase: 'baseline', request_key: 'first' });
  const alarm = f.runner.alarm(); await began;
  assert.equal((await f.invoke('delete')).deleted, true);
  release(); await alarm;
  assert.equal(f.ctx.map.size, 0); assert.equal(f.ctx.alarm, null);
});

test('alarm recovery marks an interrupted request failed instead of paying to repeat it', async () => {
  const f = fixture(); await f.invoke('create', studyInput(1));
  const first = await f.invoke('start', { phase: 'baseline', request_key: 'first' });
  const key = `sample:${first.run.id}:0`, sample = f.ctx.map.get(key); sample.status = 'running'; f.ctx.map.set(key, sample);
  await f.runner.alarm();
  assert.equal(f.calls.length, 0); assert.equal(f.ctx.map.get(key).error, 'interrupted_capture');
});

test('private study references are random and invalid references fail before accessing storage', async () => {
  const first = newStudyReference(), second = newStudyReference();
  assert.match(first, /^[a-f0-9]{64}$/); assert.notEqual(first, second);
  await assert.rejects(studyRequest({ VISIBILITY_STUDIES: {} }, 'invalid', 'get'), /study_not_found/);
});

test('custom questions reject target leakage, duplicate questions and duplicate identities', () => {
  validateQuestions(questions, 'Test Co', 'https://test.example');
  assert.throws(() => validateQuestions([{ ...questions[1], question: 'Which Test Co services are best?' }, questions[0]], 'Test Co', 'https://test.example'), /invalid_questions/);
  assert.throws(() => validateQuestions([questions[1], questions[1]], 'Test Co', 'https://test.example'), /invalid_questions/);
});

test('isolated research uses a separate durable allowance without changing website budgets', async () => {
  const ctx = memoryContext(), guard = new UsageGuard(ctx, {});
  const bindingNames = [];
  const env = { USAGE_GUARD: { idFromName: name => { bindingNames.push(name); return name; }, get: () => ({ fetch: (url, init) => guard.fetch(new Request(url, init)) }) } };
  assert.equal((await reserveDiscoveryUsage(env, 'test.example', { visitor: 'visitor', bucket: 'signal' })).allowed, true);
  assert.equal(bindingNames[0], 'signal-research-budget');
  for (let index = 1; index < 80; index++) assert.equal((await reserveDiscoveryUsage(env, 'test.example', { visitor: 'visitor', bucket: 'signal' })).allowed, true);
  assert.equal((await reserveDiscoveryUsage(env, 'test.example', { visitor: 'visitor', bucket: 'signal' })).reason, 'global_daily_limit');
});

test('captures without an actually completed web search cannot become measurements', async () => {
  await assert.rejects(captureVisibility(questions[1], studyInput().conditions, { OPENAI_API_KEY: 'test-only' }, async () => Response.json({
    status: 'completed', model: 'test', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Unsupported answer.' }] }]
  })), /search_not_completed/);
});

test('an explicitly requested retry recovers only failures and retains their history', async () => {
  const options = { quota: false }, f = fixture(options);
  await f.invoke('create', studyInput(1)); const started = await f.invoke('start', { phase: 'baseline', request_key: 'first' });
  await f.complete(); options.quota = true;
  assert.equal((await f.invoke('retry', { run_id: started.run.id })).status, 'queued');
  const recovered = await f.complete();
  assert.equal(recovered.status, 'complete'); assert.equal(recovered.counts.completed, 2);
  const answers = await f.invoke('get', { include_samples: true });
  assert.equal(answers.samples[0].attempt_history[0].error, 'daily_limit');
  assert.equal(f.calls.filter(call => call.tools).length, 2);
  assert.equal((await f.invoke('retry', { run_id: started.run.id })).error, 'retry_not_available');
});

test('a confirmed implemented change locks the baseline against later recovery', async () => {
  const f = fixture(); await f.invoke('create', studyInput(1)); const started = await f.invoke('start', { phase: 'baseline', request_key: 'first' });
  const baseline = await f.complete();
  const change = await f.invoke('intervention', { title: 'Clarify scope', change: 'Added public, verifiable service scope.', rationale: 'A missed question needs clearer evidence.',
    sample_ids: [baseline.sample_index[1].id], expected_effect: 'More appropriate appearances', implemented_at: new Date().toISOString(), implementation_evidence_urls: ['https://test.example/'], concurrent_changes: 'None' });
  assert.ok(change.recorded_intervention_id);
  assert.equal((await f.invoke('retry', { run_id: started.run.id })).error, 'baseline_locked');
});

test('assessment model drift also prevents an improvement conclusion', () => {
  const sample = (assessor_model, appearance) => ({ question_id: 'q2', kind: 'category', repetition: 1, status: 'complete', capture: { model: 'same-capture-model' }, assessment: { assessor_model, appearance } });
  const run = { id: 'run', total: 1, conditions: studyInput().conditions };
  assert.equal(compareVisibility(studyInput(), run, run, [sample('one', 'not_seen')], [sample('two', 'recommended')]).outcome, 'inconclusive');
});


test('a same-name business on another domain cannot count as target visibility', () => {
  const capture = { answer: 'Test Co offers video editing.', sources: [{ url: 'https://other.example/' }], citations: [{ url: 'https://other.example/' }] };
  assert.throws(() => validateAssessment({ appearance: 'mentioned', quote: capture.answer, evidence_url: 'https://other.example/', explanation: '' }, capture, 'Test Co', 'https://test.example'), /identity_unverified/);
});
