import { captureVisibility, assessVisibility, analyseVisibility, VISIBILITY_PROTOCOL } from './visibility-model.js';
import { reserveDiscoveryUsage } from './usage-guard.js';

const now = () => new Date().toISOString();
const runComplete = run => ['complete', 'partial', 'cancelled'].includes(run.status);
const keyFor = (run, index) => `sample:${run.id}:${index}`;
const validRef = value => /^[a-f0-9]{64}$/.test(value || '');
export function newStudyReference() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function studyRequest(env, reference, operation, data = {}) {
  if (!env.VISIBILITY_STUDIES) throw new Error('storage_not_configured');
  if (!validRef(reference)) throw new Error('study_not_found');
  const stub = env.VISIBILITY_STUDIES.get(env.VISIBILITY_STUDIES.idFromName(reference));
  const response = await stub.fetch(`https://signal-study.internal/${operation}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'study_unavailable');
  return result;
}

function failureCode(error) {
  const known = ['model_not_configured', 'provider_unavailable', 'incomplete_answer', 'search_not_completed',
    'missing_capture_evidence', 'invalid_assessment', 'unsupported_appearance', 'unsupported_source',
    'unsupported_absence', 'unsupported_analysis', 'identity_unverified'];
  return error?.name === 'AbortError' ? 'provider_timeout' : known.includes(error?.message) ? error.message : 'provider_or_evidence_error';
}

function counts(samples) {
  const complete = samples.filter(sample => sample.status === 'complete');
  const forKind = branded => {
    const selected = complete.filter(sample => (sample.kind === 'branded') === branded);
    return { checked: selected.length, mentioned: selected.filter(sample => ['mentioned', 'recommended'].includes(sample.assessment.appearance)).length,
      recommended: selected.filter(sample => sample.assessment.appearance === 'recommended').length,
      source_only: selected.filter(sample => sample.assessment.appearance === 'source_only').length,
      not_seen: selected.filter(sample => sample.assessment.appearance === 'not_seen').length };
  };
  return { completed: complete.length, failed: samples.filter(sample => sample.status === 'failed').length,
    pending: samples.filter(sample => ['pending', 'running'].includes(sample.status)).length,
    branded: forKind(true), unbranded: forKind(false) };
}

export function compareVisibility(study, baseline, rerun, before, after) {
  const bySlot = samples => new Map(samples.map(sample => [`${sample.question_id}:${sample.repetition}`, sample]));
  const beforeMap = bySlot(before), afterMap = bySlot(after);
  const pairs = [...beforeMap.entries()].map(([slot, sample]) => [sample, afterMap.get(slot)])
    .filter(([first, second]) => first.status === 'complete' && second?.status === 'complete');
  const models = new Set(pairs.flatMap(([first, second]) => [first.capture.model, second.capture.model]));
  const assessors = new Set(pairs.flatMap(([first, second]) => [first.assessment.assessor_model, second.assessment.assessor_model]));
  const incompatible = JSON.stringify(baseline.conditions) !== JSON.stringify(rerun.conditions) || models.size > 1 || assessors.size > 1;
  const unbranded = pairs.filter(([first]) => first.kind !== 'branded');
  const named = sample => ['mentioned', 'recommended'].includes(sample.assessment.appearance);
  const recommend = sample => sample.assessment.appearance === 'recommended';
  const metric = predicate => {
    const beforeCount = unbranded.filter(([first]) => predicate(first)).length;
    const afterCount = unbranded.filter(([, second]) => predicate(second)).length;
    return { before: beforeCount, after: afterCount, delta: afterCount - beforeCount, paired_samples: unbranded.length };
  };
  const mentions = metric(named), recommendations = metric(recommend);
  const completeCoverage = pairs.length === baseline.total && pairs.length === rerun.total;
  const outcome = incompatible || !completeCoverage || !unbranded.length ? 'inconclusive'
    : (mentions.delta > 0 && recommendations.delta >= 0) || (recommendations.delta > 0 && mentions.delta >= 0) ? 'observed_increase'
      : (mentions.delta < 0 && recommendations.delta <= 0) || (recommendations.delta < 0 && mentions.delta <= 0) ? 'observed_decrease'
        : mentions.delta === 0 && recommendations.delta === 0 ? 'no_clear_change' : 'mixed';
  const rows = study.questions.map(question => {
    const selected = pairs.filter(([sample]) => sample.question_id === question.id);
    return { question_id: question.id, question: question.question, kind: question.kind, paired_samples: selected.length,
      before_mentions: selected.filter(([sample]) => named(sample)).length,
      after_mentions: selected.filter(([, sample]) => named(sample)).length,
      before_recommendations: selected.filter(([sample]) => recommend(sample)).length,
      after_recommendations: selected.filter(([, sample]) => recommend(sample)).length };
  });
  return { baseline_run_id: baseline.id, rerun_id: rerun.id, intervention_id: rerun.intervention_id,
    outcome, comparable: !incompatible, complete_coverage: completeCoverage, paired_samples: pairs.length,
    missing_or_failed_pairs: baseline.total - pairs.length, mentions, recommendations, questions: rows,
    limitation: incompatible ? 'The model or test conditions changed. A visibility improvement conclusion is unavailable.'
      : 'This comparison records changes in repeated GPT API web-search samples. It does not establish consumer ChatGPT visibility, statistical significance, or that the intervention caused the change. Search indexes, competing pages and model behaviour may also change.' };
}

export class VisibilityStudy {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.fetchImpl = fetch; }

  async fetch(request) {
    if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    try {
      const operation = new URL(request.url).pathname.slice(1);
      const data = await request.json();
      const result = await this.ctx.blockConcurrencyWhile(() => this.operate(operation, data));
      return Response.json(result);
    } catch (error) {
      const messages = new Set(['study_not_found', 'study_exists', 'run_active', 'baseline_exists', 'baseline_required',
        'implemented_change_required', 'model_not_configured', 'too_many_runs', 'run_not_found', 'invalid_intervention',
        'too_many_interventions', 'unknown_sample', 'invalid_operation', 'run_not_complete', 'run_not_started', 'delete_failed',
        'request_conflict', 'retry_not_available', 'baseline_locked']);
      return Response.json({ error: messages.has(error?.message) ? error.message : 'study_unavailable' }, { status: 400 });
    }
  }

  async allSamples(run) {
    const values = await this.ctx.storage.get(Array.from({ length: run.total }, (_, index) => keyFor(run, index)));
    return Array.from({ length: run.total }, (_, index) => values.get(keyFor(run, index))).filter(Boolean);
  }

  async operate(operation, data) {
    let study = await this.ctx.storage.get('study');
    if (operation === 'create') {
      if (study) throw new Error('study_exists');
      study = { ...data, protocol: VISIBILITY_PROTOCOL, created_at: now(), runs: [], interventions: [] };
      await this.ctx.storage.put('study', study);
      return this.snapshot(study, {});
    }
    if (!study) throw new Error('study_not_found');
    if (operation === 'delete') {
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      return { deleted: true };
    }
    if (operation === 'start') {
      const existing = study.runs.find(run => run.request_key === data.request_key && run.phase === data.phase);
      if (existing) {
        if (existing.intervention_id !== (data.intervention_id || null)) throw new Error('request_conflict');
        return this.snapshot(study, { run_id: existing.id });
      }
      if (!this.env.OPENAI_API_KEY) throw new Error('model_not_configured');
      if (study.runs.some(run => !runComplete(run))) throw new Error('run_active');
      if (study.runs.length >= 8) throw new Error('too_many_runs');
      const baseline = study.runs.find(run => run.phase === 'baseline');
      let intervention = null;
      if (data.phase === 'baseline' && baseline) return this.snapshot(study, { run_id: baseline.id });
      if (data.phase === 'reassessment') {
        if (!baseline || !runComplete(baseline)) throw new Error('baseline_required');
        intervention = study.interventions.find(item => item.id === data.intervention_id && item.implemented_at);
        if (!intervention) throw new Error('implemented_change_required');
      }
      const run = { id: crypto.randomUUID(), phase: data.phase, request_key: data.request_key, conditions: structuredClone(study.conditions),
        intervention_id: intervention?.id || null, started_at: now(), completed_at: null, status: 'queued',
        total: study.questions.length * study.conditions.repetitions, analysis_status: 'pending', failure_count: 0 };
      // Keep each answer in its own storage record; a large study never exceeds the Durable Object value limit.
      const values = { study: { ...study, runs: [...study.runs, run] }, [`audit:${run.id}`]: data.run_audit || study.audit };
      let index = 0;
      for (let repetition = 1; repetition <= study.conditions.repetitions; repetition++) {
        for (const question of study.questions) {
          values[keyFor(run, index)] = { id: `${run.id}:${index}`, question_id: question.id, question: question.question,
            kind: question.kind, repetition, status: 'pending', attempts: 0, attempt_history: [], capture: null, assessment: null };
          index++;
        }
      }
      await this.ctx.storage.put(values);
      await this.ctx.storage.setAlarm(Date.now() + 100);
      return this.snapshot(values.study, { run_id: run.id });
    }
    if (operation === 'cancel') {
      const active = study.runs.find(run => run.id === data.run_id && !runComplete(run));
      if (!active) throw new Error('run_not_started');
      active.status = 'cancelled'; active.completed_at = now();
      await this.ctx.storage.put('study', study);
      await this.ctx.storage.deleteAlarm();
      return this.snapshot(study, { run_id: active.id });
    }
    if (operation === 'retry') {
      const run = study.runs.find(item => item.id === data.run_id);
      if (!run) throw new Error('run_not_found');
      if (!runComplete(run)) return this.snapshot(study, { run_id: run.id });
      if (run.status === 'cancelled') throw new Error('retry_not_available');
      if (run.phase === 'baseline' && study.interventions.some(item => item.implemented_at)) throw new Error('baseline_locked');
      const samples = await this.allSamples(run);
      const retryable = samples.filter(sample => sample.status === 'failed' && sample.attempts < 3);
      if (!retryable.length && run.analysis_status !== 'unavailable') throw new Error('retry_not_available');
      if ((run.retry_count || 0) >= 3) throw new Error('retry_not_available');
      const values = {};
      for (const sample of retryable) {
        sample.attempt_history.push({ attempt: sample.attempts, error: sample.error, recorded_at: now(), response_id: sample.capture?.response_id || null });
        sample.status = 'pending'; delete sample.error;
        values[keyFor(run, samples.indexOf(sample))] = sample;
      }
      run.retry_count = (run.retry_count || 0) + 1; run.status = 'queued'; run.completed_at = null; run.analysis_status = 'pending';
      values.study = study;
      await this.ctx.storage.put(values); await this.ctx.storage.setAlarm(Date.now() + 100);
      return this.snapshot(study, { run_id: run.id });
    }
    if (operation === 'intervention') {
      const baseline = study.runs.find(run => run.phase === 'baseline');
      if (!baseline || !runComplete(baseline)) throw new Error('baseline_required');
      if (data.implemented_at && (Date.parse(data.implemented_at) > Date.now() || Date.parse(data.implemented_at) < Date.parse(baseline.completed_at))) throw new Error('invalid_intervention');
      const samples = await this.allSamples(baseline);
      const ids = new Set(samples.filter(sample => sample.status === 'complete').map(sample => sample.id));
      if (data.sample_ids.some(id => !ids.has(id))) throw new Error('unknown_sample');
      if (data.implemented_at && !data.implementation_evidence_urls.length) throw new Error('invalid_intervention');
      const identical = study.interventions.find(item => Object.keys(data).filter(key => key !== 'intervention_id').every(key => JSON.stringify(item[key]) === JSON.stringify(data[key])));
      if (identical) return { ...await this.snapshot(study, {}), recorded_intervention_id: identical.id };
      const existing = data.intervention_id && study.interventions.find(item => item.id === data.intervention_id);
      if (data.intervention_id && !existing) throw new Error('invalid_intervention');
      if (existing?.implemented_at || study.runs.some(run => run.intervention_id === existing?.id)) throw new Error('invalid_intervention');
      if (!existing && study.interventions.length >= 10) throw new Error('too_many_interventions');
      const item = { ...data, id: existing?.id || crypto.randomUUID(), recorded_at: existing?.recorded_at || now(), updated_at: now() };
      delete item.intervention_id;
      study.interventions = existing ? study.interventions.map(old => old.id === existing.id ? item : old) : [...study.interventions, item];
      await this.ctx.storage.put('study', study);
      return { ...await this.snapshot(study, {}), recorded_intervention_id: item.id };
    }
    if (operation === 'get') return this.snapshot(study, data);
    if (operation === 'compare') {
      const baseline = study.runs.find(run => run.phase === 'baseline');
      const rerun = data.run_id ? study.runs.find(run => run.id === data.run_id) : study.runs.findLast(run => run.phase === 'reassessment');
      if (!baseline || !rerun || rerun.phase !== 'reassessment') throw new Error('run_not_found');
      if (!runComplete(baseline) || !runComplete(rerun)) throw new Error('run_not_complete');
      return { ...await this.snapshot(study, { run_id: rerun.id }), comparison: compareVisibility(study, baseline, rerun, await this.allSamples(baseline), await this.allSamples(rerun)) };
    }
    throw new Error('invalid_operation');
  }

  async snapshot(study, data) {
    const run = data.run_id ? study.runs.find(item => item.id === data.run_id) : study.runs.at(-1);
    if (data.run_id && !run) throw new Error('run_not_found');
    const samples = run ? await this.allSamples(run) : [];
    const offset = data.offset || 0, limit = data.limit || 5;
    const summary = counts(samples);
    return { business: study.business, website_url: study.website_url, created_at: study.created_at,
      protocol: study.protocol, conditions: study.conditions, questions: study.questions,
      public_context: study.public_context, audit: run ? await this.ctx.storage.get(`audit:${run.id}`) || study.audit : study.audit,
      status: run?.status || 'ready', run: run || null, runs: study.runs, counts: summary,
      sample_index: samples.map(sample => ({ id: sample.id, question_id: sample.question_id, repetition: sample.repetition,
        status: sample.status, appearance: sample.assessment?.appearance || null, error: sample.error || null })),
      samples: data.include_samples ? samples.slice(offset, offset + limit) : [],
      next_offset: data.include_samples && offset + limit < samples.length ? offset + limit : null,
      analysis: run ? await this.ctx.storage.get(`analysis:${run.id}`) || null : null,
      interventions: study.interventions,
      limitation: 'Independent GPT API searches with no chat history or personal memory supplied. The saved study reference controls access; keep it private. These samples do not reproduce consumer ChatGPT or prove why a company did not appear.' };
  }

  async alarm() {
    const study = await this.ctx.storage.get('study');
    const run = study?.runs.find(item => !runComplete(item));
    if (!run) return;
    const samples = await this.allSamples(run);
    const index = samples.findIndex(sample => ['pending', 'running'].includes(sample.status));
    if (index < 0) {
      await this.finish(study, run, samples);
      return;
    }
    const sample = samples[index];
    if (sample.status === 'running') {
      // Alarm recovery must never silently repeat an API request whose outcome is uncertain.
      sample.status = 'failed'; sample.error = 'interrupted_capture';
    } else {
      const usage = await reserveDiscoveryUsage(this.env, new URL(study.website_url).hostname, { visitor: study.visitor, bucket: 'signal' });
      if (!usage.allowed) {
        sample.status = 'failed'; sample.error = usage.reason;
      } else {
        run.status = 'running'; sample.status = 'running'; sample.attempts = (sample.attempts || 0) + 1;
        await this.ctx.storage.put({ study, [keyFor(run, index)]: sample });
        try {
          const question = study.questions.find(item => item.id === sample.question_id);
          // Explicitly requested assessment retries keep the original neutral answer.
          if (!sample.capture) sample.capture = await captureVisibility(question, run.conditions, this.env, this.fetchImpl);
          if (!await this.saveActiveSample(run, index, sample)) return;
          sample.assessment = await assessVisibility(sample.capture, study, this.env, this.fetchImpl);
          sample.status = 'complete';
        } catch (error) { sample.status = 'failed'; sample.error = failureCode(error); }
      }
    }
    if (!await this.saveActiveSample(run, index, sample)) return;
    // A cancelled/deleted study must not be recreated or restarted by an in-flight answer.
    const current = await this.ctx.storage.get('study');
    const active = current?.runs.find(item => item.id === run.id);
    if (active && !runComplete(active)) await this.ctx.storage.setAlarm(Date.now() + 100);
  }

  async finish(study, run, samples) {
    let analysis = await this.ctx.storage.get(`analysis:${run.id}`);
    if (run.analysis_status === 'running') {
      analysis = { status: 'unavailable', reasons: [], interventions: [], error: 'interrupted_analysis' };
    } else {
      run.analysis_status = 'running';
      await this.ctx.storage.put('study', study);
      try {
        if (!samples.some(sample => sample.status === 'complete')) throw new Error('no_completed_answers');
        const usage = await reserveDiscoveryUsage(this.env, new URL(study.website_url).hostname, { visitor: study.visitor, bucket: 'signal' });
        if (!usage.allowed) throw new Error('analysis_allowance_unavailable');
        const runAudit = await this.ctx.storage.get(`audit:${run.id}`) || study.audit;
        analysis = await analyseVisibility({ ...study, audit: runAudit }, samples.filter(sample => sample.status === 'complete').map(sample => ({ ...sample, ...sample.capture })), this.env, this.fetchImpl);
      }
      catch (error) { analysis = { status: 'unavailable', reasons: [], interventions: [], error: failureCode(error) }; }
    }
    const current = await this.ctx.storage.get('study');
    const active = current?.runs.find(item => item.id === run.id);
    if (!active || runComplete(active)) return;
    active.failure_count = samples.filter(sample => sample.status !== 'complete').length;
    active.status = active.failure_count ? 'partial' : 'complete'; active.completed_at = now();
    active.analysis_status = analysis.status;
    await this.ctx.storage.put({ study: current, [`analysis:${run.id}`]: analysis });
  }

  async saveActiveSample(run, index, sample) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const current = await this.ctx.storage.get('study');
      const active = current?.runs.find(item => item.id === run.id);
      if (!active || runComplete(active)) return false;
      await this.ctx.storage.put(keyFor(run, index), sample);
      return true;
    });
  }
}

export const STUDY_LIMITS = Object.freeze({ maxRuns: 8, maxQuestions: 10, maxRepetitions: 3, maxInterventions: 10 });
