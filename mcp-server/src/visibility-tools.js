import { z } from 'zod';
import { auditWebsite } from './audit.js';
import { prepareExtendedResearch, RESEARCH_KINDS } from './extended-research.js';
import { newStudyReference, studyRequest } from './visibility-study.js';
import { DEFAULT_VISIBILITY_MODEL, VISIBILITY_PROTOCOL } from './visibility-model.js';
import { AIDO_REPORT_URI } from './aido-report-ui.js';

const reference = z.string().regex(/^[a-f0-9]{64}$/).describe('Private study reference returned by create_visibility_study. Use only the reference belonging to this user’s study; never expose it in public reports.');
const runId = z.string().uuid();
const question = z.object({ id: z.string().regex(/^q(?:[1-9]|10)$/), kind: z.enum(RESEARCH_KINDS), question: z.string().trim().min(8).max(280) }).strict();
const resultSchema = z.object({ study_id: z.string(), business: z.string().optional(), status: z.string().optional() }).passthrough();
const annotations = (title, readOnly, openWorld = false, destructive = false, idempotent = true) => ({ title, readOnlyHint: readOnly, destructiveHint: destructive, idempotentHint: idempotent, openWorldHint: openWorld });
const commonMeta = { ui: { resourceUri: AIDO_REPORT_URI }, 'openai/outputTemplate': AIDO_REPORT_URI };
const errorMessages = {
  storage_not_configured: 'Saved research is not configured yet. The website check remains available.',
  model_not_configured: 'The search runner is not configured yet. Your study and questions are saved.',
  study_not_found: 'This study could not be found. Use the private reference from its creation result.',
  run_active: 'A check is already running. Read its progress before starting another.',
  baseline_required: 'Complete the first visibility check before recording a change or checking again.',
  implemented_change_required: 'Record the chosen change and its actual implementation date before checking again.',
  run_not_complete: 'The check is still running. Compare it once the saved answers are complete.',
  invalid_intervention: 'Check the change details and date. Implemented records cannot be overwritten.',
  unknown_sample: 'Use evidence IDs from completed answers in this study’s first check.',
  too_many_runs: 'This study has reached its eight-run limit. Create a new study for further research.',
  too_many_interventions: 'This study has reached its ten-change limit.',
  run_not_found: 'The selected check was not found in this study.',
  run_not_started: 'The selected check is not running.',
  invalid_questions: 'Use distinct questions with IDs q1–q10. Unbranded questions must not name the target business or website.',
  request_conflict: 'That run label already belongs to a different change. Use a new label for this requested reassessment.',
  retry_not_available: 'There are no eligible incomplete answers to retry, or this check has reached its retry limit.',
  baseline_locked: 'The first check cannot be changed after an intervention is implemented. Its original evidence is retained.',
  invalid_url: 'Use a publicly reachable HTTP or HTTPS website.'
};

function presentation(result) {
  const compared = result.comparison;
  const counts = result.counts;
  const progress = result.run ? `${counts.completed + counts.failed} of ${result.run.total} answers processed` : `${result.questions.length} questions ready`;
  const headings = { observed_increase: 'Visibility increased in this sample', observed_decrease: 'Visibility decreased in this sample',
    no_clear_change: 'No clear change in visibility', mixed: 'Visibility results were mixed', inconclusive: 'The comparison is inconclusive' };
  const active = ['queued', 'running'].includes(result.status);
  const reasons = result.analysis?.reasons || [];
  const interventions = result.analysis?.interventions || [];
  const sources = [...new Set([...(result.audit?.observations || []).map(item => item.source_url),
    ...(result.samples || []).flatMap(item => (item.capture?.sources || []).map(source => source.url))].filter(Boolean))].slice(0, 10);
  return { report_type: compared ? 'visibility_comparison' : 'visibility_study', business_name: result.business,
    headline: compared ? headings[compared.outcome] : active ? `Checking ${result.business}` : result.status === 'ready' ? `Ready to check ${result.business}` : `${result.business}: visibility check ${result.status === 'complete' ? 'complete' : 'incomplete'}`,
    summary: compared ? 'The same questions were repeated after the recorded change.' : progress,
    status: result.status === 'complete' ? 'complete' : 'incomplete',
    metrics: compared ? [
      { label: 'Unbranded mentions', value: `${compared.mentions.before} → ${compared.mentions.after}` },
      { label: 'Recommendations', value: `${compared.recommendations.before} → ${compared.recommendations.after}` },
      { label: 'Matched answers', value: `${compared.paired_samples} / ${result.run.total}` }
    ] : result.run ? [
      { label: 'Answers saved', value: `${counts.completed} / ${result.run.total}` },
      { label: 'Unbranded mentions', value: `${counts.unbranded.mentioned} / ${counts.unbranded.checked}` },
      { label: 'Recommendations', value: `${counts.unbranded.recommended} / ${counts.unbranded.checked}` },
      { label: 'Failed captures', value: String(counts.failed) }
    ] : [{ label: 'Customer questions', value: String(result.questions.length) }, { label: 'Repeats per question', value: String(result.conditions.repetitions) }],
    highlights: compared ? [compared.comparable ? 'The saved model and test settings match.' : 'The model or test settings changed.',
      compared.complete_coverage ? 'Every planned answer has a comparable result.' : `${compared.missing_or_failed_pairs} answer pairs are missing or failed.`] : reasons.slice(0, 3).map(item => `${item.status === 'hypothesis' ? 'Possible reason: ' : ''}${item.reason}`),
    gaps: interventions.slice(0, 3).map(item => item.title),
    next_action: result.status === 'ready' ? 'Start the first visibility check.' : active ? 'The runner is working. Read the saved progress shortly.'
      : compared ? 'Review the matched answers and competing explanations before deciding on another change.'
        : result.analysis?.status === 'unavailable' ? 'Read the saved answers and request a retry of the reasoning review.' : 'Review the evidence and choose one change to test.',
    limitations_note: compared?.limitation || 'These are fresh GPT API searches, with no personal chat history supplied. They measure this dated sample and do not establish consumer ChatGPT visibility or causes of non-appearance.',
    source_urls: sources, checked_at: result.run?.completed_at || result.run?.started_at || result.created_at,
    attribution: 'Signal', about_url: 'https://sr3h.uk/signal.html',
    ...(compared ? { comparison_rows: compared.questions } : {}) };
}

export function validateQuestions(questions, business, website) {
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const name = normalize(business), domain = normalize(new URL(website).hostname.replace(/^www\./, ''));
  if (new Set(questions.map(item => item.id)).size !== questions.length || new Set(questions.map(item => normalize(item.question))).size !== questions.length ||
      !questions.some(item => item.kind !== 'branded') || questions.some(item => item.kind !== 'branded' &&
        ((name.length > 2 && normalize(item.question).includes(name)) || normalize(item.question).includes(domain)))) throw new Error('invalid_questions');
}

export function registerVisibilityTools(server, env = {}, fetchImpl = fetch, context = {}) {
  const wrap = handler => async input => {
    try {
      const result = await handler(input);
      const data = result.deleted ? result : { ...result, presentation: presentation(result) };
      return { structuredContent: data, content: [{ type: 'text', text: result.deleted ? 'The saved study and its answers have been deleted.'
        : `${data.presentation.headline}\n${data.presentation.summary}\n${data.presentation.next_action}\n${data.presentation.limitations_note}` }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: errorMessages[error?.message] || 'Signal could not complete this step. Your saved evidence is retained; check the study before trying again.' }] };
    }
  };
  const stored = (operation, input) => {
    const { study_id, ...data } = input;
    return studyRequest(env, study_id, operation, data).then(result => ({ ...result, study_id }));
  };
  server.registerTool('create_visibility_study', {
    title: 'Prepare a Signal visibility study',
    description: 'Prepare and save an isolated visibility study for a user-confirmed public business and service. Checks the site, freezes neutral customer questions and test settings, and returns a private study reference. No GPT searches run yet. Default: ten questions, three repeats each. Use custom questions for a focused test. Saved references control access; keep them private.',
    inputSchema: { website_url: z.string().url().max(2048), business_name: z.string().trim().min(2).max(120),
      priority_services: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
      location_or_service_area: z.string().trim().min(1).max(160).optional(), target_customer: z.string().trim().min(1).max(300).optional(),
      questions: z.array(question).min(2).max(10).optional(), repetitions: z.number().int().min(1).max(3).default(3),
      search_location: z.object({ country: z.string().regex(/^[A-Z]{2}$/), city: z.string().trim().min(1).max(80).optional(), region: z.string().trim().min(1).max(80).optional() }).strict().optional() },
    outputSchema: resultSchema, annotations: annotations('Prepare a Signal visibility study', false, true, false, false), _meta: commonMeta
  }, wrap(async input => {
    if (!env.VISIBILITY_STUDIES) throw new Error('storage_not_configured');
    const audit = await auditWebsite(input, fetchImpl);
    const pack = await prepareExtendedResearch(input, audit);
    const questions = input.questions || pack.questions;
    validateQuestions(questions, input.business_name, audit.audit.final_url);
    const study_id = newStudyReference();
    const result = await studyRequest(env, study_id, 'create', { business: input.business_name, website_url: audit.audit.final_url,
      questions, audit, public_context: { website_url: audit.audit.final_url, business_name: input.business_name,
        priority_services: input.priority_services, ...(input.location_or_service_area ? { location_or_service_area: input.location_or_service_area } : {}),
        ...(input.target_customer ? { target_customer: input.target_customer } : {}) }, visitor: context.visitor || 'unknown',
      conditions: { protocol: VISIBILITY_PROTOCOL, model: env.OPENAI_VISIBILITY_MODEL || env.OPENAI_DISCOVERY_MODEL || DEFAULT_VISIBILITY_MODEL,
        repetitions: input.repetitions, location: input.search_location || null, max_tool_calls: 2, personal_context_supplied: false,
        capture_instructions_version: VISIBILITY_PROTOCOL, surface: 'gpt_api_web_search' } });
    return { ...result, study_id };
  }));
  server.registerTool('run_visibility_study', {
    title: 'Run Signal visibility searches',
    description: 'Start the background runner for a saved baseline or reassessment. Each answer is a fresh GPT API web search with no target briefing, chat history or personal memory. Signal saves the raw answer before assessing it. Uses SR3H’s configured API allowance. Reassess only after the user confirms a chosen change is implemented. Reuse request_key on retries to avoid duplicate runs; read get_visibility_study for progress.',
    inputSchema: { study_id: reference, phase: z.enum(['baseline', 'reassessment']), intervention_id: z.string().uuid().optional(),
      request_key: z.string().trim().min(1).max(80).describe('Stable run label, such as baseline or reassessment-2026-10-08. Reuse exactly on retries; a new label requests a new run.') },
    outputSchema: resultSchema, annotations: annotations('Run Signal visibility searches', false, true), _meta: commonMeta
  }, wrap(async input => {
    const saved = await studyRequest(env, input.study_id, 'get');
    if (saved.runs.some(run => run.request_key === input.request_key && run.phase === input.phase)) return stored('start', input);
    let run_audit;
    try { run_audit = await auditWebsite(saved.public_context || { website_url: saved.website_url, business_name: saved.business }, fetchImpl); }
    catch {
      run_audit = { audit: { checked_at: new Date().toISOString(), final_url: saved.website_url, technical_readiness: 'partial' },
        observations: [], gaps: [], unknowns: ['The fresh website check was unavailable for this run.'] };
    }
    return stored('start', { ...input, run_audit });
  }));
  server.registerTool('get_visibility_study', {
    title: 'Read Signal results and evidence',
    description: 'Read saved research progress, exact branded and unbranded counts, evidence-linked possible reasons and proposed interventions. No new searches or paid calls. Include samples to inspect full raw answers, citations and assessments; paginate with next_offset. Distinguish checked gaps from hypotheses about why a business did not surface. Never claim a permanent rank or demand from sample counts.',
    inputSchema: { study_id: reference, run_id: runId.optional(), include_samples: z.boolean().default(false), offset: z.number().int().min(0).max(30).default(0), limit: z.number().int().min(1).max(5).default(5) },
    outputSchema: resultSchema, annotations: annotations('Read Signal results and evidence', true), _meta: commonMeta
  }, wrap(input => stored('get', input)));
  server.registerTool('record_visibility_intervention', {
    title: 'Record the chosen visibility change',
    description: 'Save a user-selected change tied to baseline answer IDs. This tool does not change or publish a website. Record implemented_at only when the user confirms the change was actually completed, with evidence URLs and concurrent changes. A proposal alone cannot unlock reassessment. Implemented change records are immutable; save a new change when needed.',
    inputSchema: { study_id: reference, intervention_id: z.string().uuid().optional(), title: z.string().trim().min(3).max(160),
      change: z.string().trim().min(10).max(2000), rationale: z.string().trim().min(10).max(1600),
      sample_ids: z.array(z.string().min(1).max(90)).min(1).max(30), expected_effect: z.string().trim().min(5).max(800),
      implemented_at: z.string().datetime().nullable().default(null), implementation_evidence_urls: z.array(z.string().url().max(2048)).max(8).default([]),
      concurrent_changes: z.string().trim().max(1200).default('Not supplied') },
    outputSchema: resultSchema, annotations: annotations('Record the chosen visibility change', false), _meta: commonMeta
  }, wrap(input => stored('intervention', input)));
  server.registerTool('compare_visibility_runs', {
    title: 'Compare before and after visibility',
    description: 'Compare a saved baseline and completed reassessment using the same questions, repeats and settings. Match sample slots, verify actual models, and count mentions and recommendations separately. Failures remain visible and make the outcome inconclusive. Report observed increase, decrease, mixed results or no clear change. These samples alone do not prove statistical significance or that the change caused improvement.',
    inputSchema: { study_id: reference, run_id: runId.optional() }, outputSchema: resultSchema,
    annotations: annotations('Compare before and after visibility', true), _meta: commonMeta
  }, wrap(input => stored('compare', input)));
  server.registerTool('retry_visibility_run', {
    title: 'Retry incomplete Signal answers',
    description: 'Retry failed answers or unavailable analysis only when the user requests recovery. Uses the configured API allowance. Existing completed answers and failure history are retained; saved raw answers are reassessed without a new search. At most three requested retries. A baseline is locked after any implemented change. Never use retries to replace an unfavourable valid answer.',
    inputSchema: { study_id: reference, run_id: runId }, outputSchema: resultSchema,
    annotations: annotations('Retry incomplete Signal answers', false, true, false, false), _meta: commonMeta
  }, wrap(input => stored('retry', input)));
  server.registerTool('cancel_visibility_run', {
    title: 'Stop a Signal visibility check',
    description: 'Stop the selected active check at the user’s request. Already saved answers remain available. An in-flight paid request may already have started; stopping does not reverse its cost. This tool never starts another run.',
    inputSchema: { study_id: reference, run_id: runId }, outputSchema: resultSchema,
    annotations: annotations('Stop a Signal visibility check', false), _meta: commonMeta
  }, wrap(input => stored('cancel', input)));
  server.registerTool('delete_visibility_study', {
    title: 'Delete a saved Signal study',
    description: 'Permanently delete this saved study, raw answers, analysis and recorded changes, and stop its runner. Use only when the user explicitly requests deletion. This cannot be undone.',
    inputSchema: { study_id: reference }, outputSchema: resultSchema,
    annotations: annotations('Delete a saved Signal study', false, false, true)
  }, wrap(input => stored('delete', input)));
}
