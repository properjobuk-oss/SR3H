import { z } from 'zod';
import { auditWebsite } from './audit.js';
import { prepareExtendedResearch, RESEARCH_KINDS } from './extended-research.js';
import { newStudyReference, studyRequest } from './visibility-study.js';
import { DEFAULT_VISIBILITY_MODEL, VISIBILITY_PROTOCOL } from './visibility-model.js';
import { AIDO_REPORT_URI } from './aido-report-ui.js';
import { checkPublicWording, isTargetSource, PROFILE_IDENTITY_RULE } from './visibility-evidence.js';

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
  const analysisNotice = result.analysis?.review_status === 'unavailable' ? 'Recommendation review was unavailable. Unreviewed advice has been withheld.' : null;
  const interventions = result.analysis?.interventions || [];
  const recordedCheck = result.interventions?.find(item => item.id === result.recorded_intervention_id)?.implementation_check;
  const sources = [...new Set([...(result.audit?.observations || []).map(item => item.source_url),
    ...(result.samples || []).flatMap(item => (item.capture?.sources || []).map(source => source.url))].filter(Boolean))].slice(0, 10);
  return { report_type: compared ? 'visibility_comparison' : 'visibility_study', business_name: result.business,
    headline: result.start_error ? `The AI check for ${result.business} could not start` : compared ? headings[compared.outcome] : active ? `Checking ${result.business}` : result.status === 'ready' ? `Ready to check ${result.business}` : `${result.business}: visibility check ${result.status === 'complete' ? 'complete' : 'incomplete'}`,
    summary: compared ? 'The same questions were repeated after the recorded change.' : result.target_type === 'profile' ? `${progress}. Measures this person’s discovery; card operation requires a separate host test.` : progress,
    status: result.status === 'complete' ? 'complete' : 'incomplete',
    metrics: compared ? [
      { label: 'Unbranded mentions', value: `${compared.mentions.before} → ${compared.mentions.after}` },
      { label: 'Recommendations', value: `${compared.recommendations.before} → ${compared.recommendations.after}` },
      { label: 'Matched answers', value: `${compared.paired_samples} / ${result.run.total}` }
    ] : result.run && active && !counts.completed && !counts.failed ? [
      { label: 'AI searches', value: `${result.run.total} ${result.status === 'queued' ? 'queued' : 'running'}` },
      { label: 'Mentions', value: 'Awaiting answers' },
      { label: 'Recommendations', value: 'Awaiting answers' }
    ] : result.run ? [
      { label: 'AI answers saved', value: `${counts.captured} / ${result.run.total}` },
      { label: 'Validated answers', value: `${counts.completed} / ${result.run.total}` },
      { label: 'Unbranded mentions', value: `${counts.unbranded.mentioned} / ${counts.unbranded.checked}` },
      { label: 'Recommendations', value: `${counts.unbranded.recommended} / ${counts.unbranded.checked}` }
    ] : [{ label: 'Customer questions', value: String(result.questions.length) }, { label: 'Repeats per question', value: String(result.conditions.repetitions) }],
    highlights: result.start_error ? [errorMessages[result.start_error] || 'The runner could not be started. The study and questions are saved.'] : compared ? [compared.comparable ? 'The saved model and test settings match.' : 'The model or test settings changed.',
      compared.complete_coverage ? 'Every planned answer has a comparable result.' : `${compared.missing_or_failed_pairs} answer pairs are missing or failed.`,
      ...(compared.repeat_evidence ? [repeatSummary(compared.repeat_evidence)] : []),
      ...(compared.implementation_check ? [implementationSummary(compared.implementation_check)] : [])] : [
        ...(counts.capture_failed ? [`${counts.capture_failed} AI search answer(s) could not be saved.`] : []),
        ...(counts.assessment_failed ? [`${counts.assessment_failed} saved answer(s) could not be validated${counts.identity_unverified ? `; ${counts.identity_unverified} have unverified target identity or conflicting visibility evidence` : ''}. They do not count as absences.`] : []),
        ...(recordedCheck ? [implementationSummary(recordedCheck)] : []), ...(analysisNotice ? [analysisNotice] : []), ...reasons.slice(0, 3).map(item => `${item.status === 'hypothesis' ? 'Possible reason: ' : ''}${item.reason}`)],
    gaps: interventions.slice(0, 3).map(item => item.title),
    next_action: result.start_error ? 'Retain this study reference. Read get_visibility_study before retrying run_visibility_study with request_key baseline; do not create a replacement study.'
      : result.status === 'ready' ? 'Start the first visibility check.' : active ? 'The runner is working. Read get_visibility_study with this private study reference until the saved answers complete; do not start another study.'
      : compared ? 'Review the matched answers and competing explanations before deciding on another change.'
      : recordedCheck && recordedCheck.status !== 'present' ? 'Inspect the public page and its publication state before spending another search run.'
      : result.analysis?.status === 'unavailable' || result.analysis?.review_status === 'unavailable' ? 'Read the saved answers and request a retry of the reasoning review.'
        : result.analysis?.next_action || 'Review the evidence and choose one change to test.',
    recommendation_details: interventions.slice(0, 3).map(item => ({ title: item.title, change: item.change,
      target_url: item.target_url, rationale: item.rationale, success_measure: item.success_measure, retest_when: item.retest_when,
      question_ids: item.question_ids, evidence: (item.evidence || []).map(ref => ({ quote: ref.quote,
        url: result.analysis?.evidence?.find(doc => doc.id === ref.source_id)?.url || null })) })),
    finding_details: reasons.slice(0, 3).map(item => ({ reason: item.reason, next_check: item.next_check,
      evidence: (item.evidence || []).map(ref => ({ quote: ref.quote,
        url: result.analysis?.evidence?.find(doc => doc.id === ref.source_id)?.url || null })) })),
    limitations_note: compared?.limitation || 'These are fresh GPT API searches, with no personal chat history supplied. They measure this dated sample and do not establish consumer ChatGPT visibility or causes of non-appearance.',
    source_urls: [...new Set([...sources, ...(result.analysis?.evidence || []).map(item => item.url).filter(Boolean)])].slice(0, 10), checked_at: result.run?.completed_at || result.run?.started_at || result.created_at,
    attribution: 'Signal', about_url: 'https://sr3h.uk/signal.html',
    ...(compared ? { comparison_rows: compared.questions } : {}) };
}

function repeatSummary(evidence) {
  const labels = { single_check: 'One comparable reassessment; persistence has not been tested.',
    same_day_only: 'Increases repeated within one UTC date; persistence across dates has not been tested.',
    repeated_on_separate_dates: `Increases observed in ${evidence.increased_runs} comparable checks across ${evidence.separate_increase_dates} UTC dates.`,
    inconsistent: 'The increase was not consistent across comparable reassessments.',
    increase_not_repeated: 'This reassessment did not show an increase.', inconclusive: 'Persistence cannot be assessed for this reassessment.' };
  return labels[evidence.status] + (evidence.excluded_runs ? ` ${evidence.excluded_runs} incomplete or incompatible check(s) excluded.` : '');
}

function implementationSummary(check) {
  return check.status === 'present' ? check.baseline_presence === 'present' ? 'Requested wording is public, but it was already present in the saved baseline.'
    : check.baseline_presence === 'absent' ? 'Requested wording is public and was absent from the saved baseline excerpt.'
      : 'Requested wording is public; its prior presence is unknown.'
    : check.status === 'not_found' ? 'Requested wording was not found on the public page. Implementation remains user-confirmed.'
      : 'Public wording could not be checked. Implementation remains user-confirmed.';
}

export function validateQuestions(questions, business, website) {
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const name = normalize(business), domain = normalize(new URL(website).hostname.replace(/^www\./, ''));
  if (new Set(questions.map(item => item.id)).size !== questions.length || new Set(questions.map(item => normalize(item.question))).size !== questions.length ||
      !questions.some(item => item.kind !== 'branded') || questions.some(item => item.kind !== 'branded' &&
        ((name.length > 2 && normalize(item.question).includes(name)) || normalize(item.question).includes(domain)))) throw new Error('invalid_questions');
}

async function researchAudit(input, fetchImpl) {
  const audit = await auditWebsite(input, fetchImpl, { includeAnalysisContext: true });
  // Limit stored, model-visible excerpts independently of the broader website checker.
  audit._analysis_context.pages = audit._analysis_context.pages.map(page => ({ ...page, text: page.text.slice(0, 4000) }));
  audit._analysis_context.checked_at = audit.audit.checked_at;
  audit._analysis_context.audit_evidence = { audit: audit.audit, observations: audit.observations, gaps: audit.gaps };
  return audit;
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
    title: 'Prepare or start an AI visibility check',
    description: 'Primary entry for actual AI visibility checks. Save isolated research for a user-confirmed business or public profile. Set start_now true when the user asks to run AI searches: creates the study and queues the baseline in one call. Otherwise prepares questions for review without searches. Follow get_visibility_study until completion; queued is not a final result. Keep the returned reference and do not create another study to poll or retry. Business default: ten questions, three repeats. Profiles require exact URL, name as business_name and explicit questions.',
    inputSchema: { website_url: z.string().url().max(2048), business_name: z.string().trim().min(2).max(120),
      target_type: z.enum(['business', 'profile']).default('business').describe('Use profile only for one named person at their exact public profile URL. Supply their name as business_name and explicit questions; shared-domain appearances do not count.'),
      priority_services: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
      location_or_service_area: z.string().trim().min(1).max(160).optional(), target_customer: z.string().trim().min(1).max(300).optional(),
      questions: z.array(question).min(2).max(10).optional(), repetitions: z.number().int().min(1).max(3).default(3),
      start_now: z.boolean().default(false).describe('Set true for a user-requested AI visibility check: prepare and queue its baseline immediately. Leave false only for a requested question review or preparation.'),
      search_location: z.object({ country: z.string().regex(/^[A-Z]{2}$/), city: z.string().trim().min(1).max(80).optional(), region: z.string().trim().min(1).max(80).optional() }).strict().optional() },
    outputSchema: resultSchema, annotations: annotations('Prepare or start an AI visibility check', false, true, false, false), _meta: commonMeta
  }, wrap(async input => {
    if (!env.VISIBILITY_STUDIES) throw new Error('storage_not_configured');
    if (input.target_type === 'profile' && !input.questions) throw new Error('invalid_questions');
    const audit = await researchAudit(input, fetchImpl);
    if (input.target_type === 'profile' && !isTargetSource(audit.audit.final_url, input.website_url, 'profile')) throw new Error('invalid_url');
    const pack = await prepareExtendedResearch(input, audit);
    const questions = input.questions || pack.questions;
    validateQuestions(questions, input.business_name, audit.audit.final_url);
    const study_id = newStudyReference();
    const result = await studyRequest(env, study_id, 'create', { business: input.business_name, website_url: audit.audit.final_url,
      target_type: input.target_type, questions, audit, public_context: { website_url: audit.audit.final_url, business_name: input.business_name,
        priority_services: input.priority_services, ...(input.location_or_service_area ? { location_or_service_area: input.location_or_service_area } : {}),
        ...(input.target_customer ? { target_customer: input.target_customer } : {}) }, visitor: context.visitor || 'unknown',
      conditions: { protocol: VISIBILITY_PROTOCOL, model: env.OPENAI_VISIBILITY_MODEL || env.OPENAI_DISCOVERY_MODEL || DEFAULT_VISIBILITY_MODEL,
        repetitions: input.repetitions, location: input.search_location || null, max_tool_calls: 2, personal_context_supplied: false,
        capture_instructions_version: VISIBILITY_PROTOCOL, surface: 'gpt_api_web_search',
        ...(input.target_type === 'profile' ? { identity_rule: PROFILE_IDENTITY_RULE } : {}) } });
    if (!input.start_now) return { ...result, study_id };
    try {
      const started = await studyRequest(env, study_id, 'start', { phase: 'baseline', request_key: 'baseline', run_audit: audit });
      return { ...started, study_id };
    } catch (error) {
      // If the start response was lost, recover its committed run instead of starting another.
      try {
        const recovered = await studyRequest(env, study_id, 'get');
        if (recovered.runs.some(run => run.phase === 'baseline')) return { ...recovered, study_id };
      } catch { /* The original private reference still allows subsequent recovery. */ }
      return { ...result, study_id, start_error: error.message === 'model_not_configured' ? error.message : 'runner_start_unavailable' };
    }
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
    try { run_audit = await researchAudit(saved.public_context || { website_url: saved.website_url, business_name: saved.business }, fetchImpl); }
    catch {
      run_audit = { audit: { checked_at: new Date().toISOString(), final_url: saved.website_url, technical_readiness: 'partial' },
        observations: [], gaps: [], unknowns: ['The fresh website check was unavailable for this run.'] };
    }
    return stored('start', { ...input, run_audit });
  }));
  server.registerTool('get_visibility_study', {
    title: 'Read Signal results and evidence',
    description: 'Read saved research progress, exact branded and unbranded counts, targeted public-source checks and independently reviewed diagnoses. Up to three interventions include a target page, quoted evidence, success measure and retest timing. No new searches or paid calls. Include samples to inspect full raw answers, citations and assessments; paginate with next_offset. Unknown index coverage or host rendering requires a diagnostic check, not an invented repair. Never claim a permanent rank or demand from sample counts.',
    inputSchema: { study_id: reference, run_id: runId.optional(), include_samples: z.boolean().default(false), offset: z.number().int().min(0).max(30).default(0), limit: z.number().int().min(1).max(5).default(5) },
    outputSchema: resultSchema, annotations: annotations('Read Signal results and evidence', true), _meta: commonMeta
  }, wrap(input => stored('get', input)));
  server.registerTool('record_visibility_intervention', {
    title: 'Record the chosen visibility change',
    description: 'Save a user-selected change tied to baseline answer IDs. This tool does not change or publish a website. Record implemented_at only when the user confirms completion, with evidence URLs and concurrent changes. Optional expected_public_text checks exact wording on target_url and retains whether it is public, missing or unavailable; it does not verify indexing or rendering. A proposal alone cannot unlock reassessment. Implemented records are immutable.',
    inputSchema: { study_id: reference, intervention_id: z.string().uuid().optional(), title: z.string().trim().min(3).max(160),
      change: z.string().trim().min(10).max(2000), rationale: z.string().trim().min(10).max(1600),
      sample_ids: z.array(z.string().min(1).max(90)).min(1).max(30), expected_effect: z.string().trim().min(5).max(800),
      recommendation_id: z.string().regex(/^i[1-3]$/).optional().describe('Selected baseline recommendation. Signal retains its target page, success measure and frozen question IDs.'),
      target_url: z.string().url().max(2048).optional(), success_measure: z.string().trim().min(8).max(800).optional(),
      expected_public_text: z.string().trim().min(20).max(600).optional().describe('Optional exact new public wording to check on target_url when recording a completed change. Checks public text only; rendering and indexing remain separate.'),
      retest_when: z.string().trim().min(8).max(800).optional(), question_ids: z.array(z.string().regex(/^q(?:[1-9]|10)$/)).min(1).max(10).optional(),
      implemented_at: z.string().datetime().nullable().default(null), implementation_evidence_urls: z.array(z.string().url().max(2048)).max(8).default([]),
      concurrent_changes: z.string().trim().max(1200).default('Not supplied') },
    outputSchema: resultSchema, annotations: annotations('Record the chosen visibility change', false, true), _meta: commonMeta
  }, wrap(async input => {
    if (!input.expected_public_text || !input.implemented_at) return stored('intervention', input);
    const saved = await stored('get', { study_id: input.study_id });
    const target = input.recommendation_id ? saved.runs.find(run => run.phase === 'baseline') : null;
    const baseline = target ? await stored('get', { study_id: input.study_id, run_id: target.id }) : null;
    const targetUrl = input.recommendation_id ? baseline?.analysis?.interventions?.find(item => item.id === input.recommendation_id)?.target_url : input.target_url;
    if (!targetUrl) throw new Error('invalid_intervention');
    // A repeated record request retains its original check and never changes an immutable record.
    const existing = saved.interventions.find(item => item.implemented_at && (!input.intervention_id || item.id === input.intervention_id) &&
      Object.keys(input).filter(key => !['study_id', 'intervention_id'].includes(key)).every(key => JSON.stringify(item[key]) === JSON.stringify(input[key])));
    if (existing) return { ...saved, recorded_intervention_id: existing.id };
    const implementation_check = await checkPublicWording(saved.website_url, targetUrl, input.expected_public_text, fetchImpl);
    return stored('intervention', { ...input, implementation_check });
  }));
  server.registerTool('compare_visibility_runs', {
    title: 'Compare before and after visibility',
    description: 'Compare a saved baseline and completed reassessment using frozen questions, repeats and settings. Match sample slots and actual models; count mentions and recommendations separately. Failures make the outcome inconclusive. Summarise prior completed reassessments of this same change up to the selected run: single check, same-day repeats, inconsistent results or increases across UTC dates. No additional searches. Repeats share a baseline and do not prove statistical significance or causation.',
    inputSchema: { study_id: reference, run_id: runId.optional() }, outputSchema: resultSchema,
    annotations: annotations('Compare before and after visibility', true), _meta: commonMeta
  }, wrap(input => stored('compare', input)));
  server.registerTool('retry_visibility_run', {
    title: 'Review or retry Signal results',
    description: 'Retry failed answers or unavailable analysis only when the user requests recovery. Set review_analysis to true for an explicitly requested diagnosis review; it retains every saved answer and assessment, including failures, and makes no new searches. Refreshes bounded public-page evidence, checks up to three previously cited external pages and independently verifies useful recommendations. Uses up to two reasoning calls from the configured API allowance. At most three requested retries. A baseline is locked after any implemented change. Never use retries to replace an unfavourable valid answer.',
    inputSchema: { study_id: reference, run_id: runId, review_analysis: z.boolean().optional().describe('Review reasoning using refreshed public evidence without retrying any captured answers or assessments. Only when the user requests a review.') }, outputSchema: resultSchema,
    annotations: annotations('Review or retry Signal results', false, true, false, false), _meta: commonMeta
  }, wrap(async input => {
    const saved = await studyRequest(env, input.study_id, 'get');
    let analysis_context;
    try { analysis_context = (await researchAudit(saved.public_context || { website_url: saved.website_url, business_name: saved.business }, fetchImpl))._analysis_context; } catch { /* Saved evidence remains available. */ }
    return stored('retry', { ...input, analysis_context });
  }));
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
