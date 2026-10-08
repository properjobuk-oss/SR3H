import { safeFetch } from './audit.js';
import { validatePublicUrl } from './url-safety.js';

export const DIAGNOSIS_VERSION = 'signal-evidence-review-1';
export const STAGES = ['access_indexing', 'identity', 'answer_fit', 'citations', 'card_rendering'];
export const FEATURES = ['crawl_access', 'indexing', 'identity', 'content', 'corroboration', 'structured_data', 'connection_guidance', 'card_rendering'];
const compact = value => String(value || '').replace(/\s+/g, ' ').trim();
const sameSite = (url, website) => {
  try {
    const host = validatePublicUrl(url).hostname.replace(/^www\./, '');
    const target = new URL(website).hostname.replace(/^www\./, '');
    return host === target || host.endsWith(`.${target}`);
  } catch { return false; }
};
const gapStage = id => ['noindex', 'oai_searchbot_blocked', 'https', 'canonical', 'sitemap'].includes(id) ? 'access_indexing' : 'answer_fit';
export const checkedDiagnosticGaps = study => (study.audit?.gaps || []).filter(gap => gap.id !== 'supplied_terms' &&
  !(study.audit.observations || []).some(item => item.id === gap.id && item.status === 'unverified'));

export function diagnosticEvidence(study, samples) {
  const documents = [];
  const add = (id, kind, text, url = null) => {
    if (compact(text)) documents.push({ id, kind, text: compact(text).slice(0, 4000), url });
  };
  for (const sample of samples) add(`answer:${sample.id}`, 'answer', sample.answer, null);
  for (const item of study.audit?.observations || []) add(`audit:${item.id}`, 'audit', item.evidence, item.source_url);
  for (const gap of checkedDiagnosticGaps(study)) {
    add(`gap:${gap.id}`, 'gap', gap.finding, (study.audit.observations || []).find(item => item.id === gap.id)?.source_url || study.website_url);
  }
  for (const [index, page] of (study.site_context?.pages || []).entries()) add(`page:${index + 1}`, 'page', page.text, page.url);
  return documents;
}

export async function collectVisibilityDiagnostics(study, samples, fetchImpl = fetch) {
  const documents = diagnosticEvidence(study, samples);
  const checks = [];
  for (const gap of checkedDiagnosticGaps(study)) {
    checks.push({ id: `gap:${gap.id}`, stage: gapStage(gap.id), status: 'issue', finding: gap.finding, next_check: gap.action });
  }
  const ambiguous = samples.filter(item => item.error === 'identity_unverified');
  if (ambiguous.length) checks.push({ id: 'identity', stage: 'identity', status: 'issue',
    finding: `${ambiguous.length} saved answer(s) could not be tied to the official domain. This is an identity-verification failure, not a verified mention.`,
    next_check: 'Inspect the named service and its cited domain to distinguish a different business from missing corroboration.' });
  // Permission to index is not evidence of actual inclusion in a search index.
  checks.push({ id: 'index_coverage', stage: 'access_indexing', status: 'unknown',
    finding: 'Actual search-index coverage and the indexed page version have not been verified.',
    next_check: 'Inspect the relevant public page in Search Console: indexing status, selected canonical and last crawl.' });
  if (study.questions.some(item => /\b(?:card|cards|inline|interactive|widget|render)\b/i.test(item.question))) checks.push({
    id: 'host_rendering', stage: 'card_rendering', status: 'unknown',
    finding: 'API text answers do not verify an interactive card in the intended platform.',
    next_check: 'Connect the app in the intended platform, invoke its profile tool and test a public question inside the rendered card.' });

  // Investigate only pages actually cited in saved answers, never arbitrary model-proposed URLs.
  const candidates = new Map();
  for (const sample of samples) {
    const cited = new Set((sample.citations || []).map(item => item.url));
    const preferred = (sample.assessment?.other_providers || []).map(item => item.evidence_url);
    const urls = [...preferred, ...(sample.sources || []).map(item => item.url)];
    for (const url of urls) {
      try {
        const safe = validatePublicUrl(url).href;
        if (!cited.has(url) || sameSite(safe, study.website_url)) continue;
        const entry = candidates.get(safe) || { url: safe, sample_ids: [], question_ids: [], provider_source: false };
        entry.provider_source ||= preferred.includes(url);
        if (!entry.sample_ids.includes(sample.id)) entry.sample_ids.push(sample.id);
        if (!entry.question_ids.includes(sample.question_id)) entry.question_ids.push(sample.question_id);
        candidates.set(safe, entry);
      } catch { /* Reject private and credential-bearing source URLs before fetching. */ }
    }
  }
  const ordered = [...candidates.values()].sort((a, b) => Number(b.provider_source) - Number(a.provider_source) ||
    Number(/developers\.|\/docs\//.test(b.url)) - Number(/developers\.|\/docs\//.test(a.url)) || b.sample_ids.length - a.sample_ids.length);
  const selected = [];
  // Cover different questions before spending all three checks on the first answer.
  for (const question of study.questions) {
    const source = ordered.find(item => item.question_ids.includes(question.id) && !selected.includes(item));
    if (source && selected.length < 3) selected.push(source);
  }
  for (const source of ordered) if (selected.length < 3 && !selected.includes(source)) selected.push(source);
  const source_checks = await Promise.all(selected.map(async (entry, index) => {
    const id = `source:${index + 1}`;
    try {
      const page = await safeFetch(entry.url, fetchImpl, { maxBytes: 1_000_000 });
      const type = page.response.headers.get('content-type') || '';
      if (!page.response.ok || !/text\/(?:html|plain)/i.test(type)) throw new Error('unreadable_source');
      const body = await page.response.text();
      const content = body.match(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/i)?.[1] || body.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i)?.[1] || body;
      const text = compact(content.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/g, "'"));
      if (text.length < 30) throw new Error('unreadable_source');
      documents.push({ id, kind: 'source', text: text.slice(0, 4000), url: page.finalUrl.href });
      return { ...entry, id, status: 'checked', final_url: page.finalUrl.href, checked_at: new Date().toISOString() };
    } catch {
      return { ...entry, id, status: 'unavailable', checked_at: new Date().toISOString() };
    }
  }));
  const observations = study.audit?.observations || [];
  const existing_features = [];
  if (observations.some(item => item.id === 'structured_data' && item.status === 'clear')) existing_features.push('structured_data');
  if ((study.site_context?.pages || []).some(page => page.references?.mcp && /connect|setup|integrat/i.test(`${page.url} ${page.text}`))) existing_features.push('connection_guidance');
  return { version: DIAGNOSIS_VERSION, checked_at: new Date().toISOString(), checks, source_checks, existing_features, documents };
}

export function validateFindings(value, study, samples, diagnostics) {
  if (!Array.isArray(value?.reasons) || !Array.isArray(value?.interventions)) throw new Error('unsupported_analysis');
  const documents = new Map(diagnostics.documents.map(item => [item.id, item]));
  const sampleIds = new Set(samples.map(item => item.id));
  const completeIds = new Set(samples.filter(item => item.status === 'complete').map(item => item.id));
  const auditIds = new Set([...(study.audit?.observations || []), ...(study.audit?.gaps || [])].map(item => item.id).filter(id => id !== 'supplied_terms'));
  const gaps = new Set(checkedDiagnosticGaps(study).map(item => item.id));
  const questions = new Set(study.questions.map(item => item.id));
  const rejections = [];
  const reject = (item, reason) => { rejections.push({ id: item.id || null, reason }); return false; };
  const linked = item => Array.isArray(item.sample_ids) && Array.isArray(item.audit_ids) &&
    item.sample_ids.every(id => sampleIds.has(id)) && item.audit_ids.every(id => auditIds.has(id)) &&
    (item.sample_ids.length || item.audit_ids.length);
  const quoted = item => Array.isArray(item.evidence) && item.evidence.length > 0 && item.evidence.length <= 4 && item.evidence.every(ref => {
    const doc = documents.get(ref.source_id), quote = compact(ref.quote);
    if (!doc || quote.length < 20 || quote.length > 700 || !doc.text.includes(quote)) return false;
    if (doc.kind === 'answer') return item.sample_ids.includes(doc.id.slice(7));
    if (doc.kind === 'audit' || doc.kind === 'gap') return item.audit_ids.includes(doc.id.split(':')[1]);
    if (doc.kind === 'source') return diagnostics.source_checks.find(source => source.id === doc.id)?.sample_ids.some(id => item.sample_ids.includes(id));
    return true;
  });
  const valid = item => linked(item) && quoted(item);
  const seenReasons = new Set();
  const reasons = value.reasons.filter(item => {
    if (!/^r[1-5]$/.test(item.id || '') || seenReasons.has(item.id) || !STAGES.includes(item.stage) ||
      !['observed_gap', 'hypothesis'].includes(item.status) || !compact(item.reason) || compact(item.next_check).length < 15) return reject(item, 'invalid_diagnosis');
    if (!linked(item)) return reject(item, 'invalid_or_missing_evidence_links');
    if (!quoted(item)) return reject(item, 'quote_missing_mismatched_or_unlinked');
    if (item.stage === 'identity' && !samples.some(sample => item.sample_ids.includes(sample.id) &&
      (sample.kind === 'branded' || sample.error === 'identity_unverified')) &&
      !item.evidence.some(ref => ['page', 'audit', 'source'].includes(documents.get(ref.source_id)?.kind))) return reject(item, 'identity_not_investigated');
    if (compact(item.reason).length > 360 || compact(item.next_check).length > 300) return reject(item, 'overlong_diagnosis');
    if (item.status === 'observed_gap' && !item.evidence.some(ref => ref.source_id.startsWith('gap:') && gaps.has(ref.source_id.slice(4)))) return reject(item, 'no_confirmed_gap');
    if (item.stage === 'card_rendering' && item.status !== 'hypothesis') return reject(item, 'host_not_tested');
    seenReasons.add(item.id); return true;
  });
  const seenInterventions = new Set();
  const interventions = value.interventions.filter(item => {
    const reason = reasons.find(reason => reason.id === item.reason_id);
    if (!/^i[1-3]$/.test(item.id || '') || seenInterventions.has(item.id) || !reason || !valid(item) ||
      !FEATURES.includes(item.feature) || !['add', 'correct'].includes(item.operation) ||
      !['high', 'medium', 'low'].includes(item.priority) || !sameSite(item.target_url, study.website_url) ||
      !Array.isArray(item.question_ids) || !item.question_ids.length || !item.question_ids.every(id => questions.has(id)) ||
      !item.sample_ids.some(id => completeIds.has(id)) ||
      ['title', 'change', 'rationale', 'expected_effect', 'success_measure', 'retest_when'].some(key => compact(item[key]).length < 8)) return reject(item, 'unsupported_or_incomplete_intervention');
    if (compact(item.title).length > 110 || compact(item.change).length > 420 || compact(item.rationale).length > 420 ||
      compact(item.expected_effect).length > 250 || compact(item.success_measure).length > 300 || compact(item.retest_when).length > 250) return reject(item, 'overlong_intervention');
    // A text API capture cannot justify repairing a host UI that has never been tested.
    if (item.feature === 'card_rendering') return reject(item, 'host_not_tested');
    if (item.operation === 'add' && diagnostics.existing_features.includes(item.feature)) return reject(item, 'feature_already_present');
    if (reason.stage === 'card_rendering') return reject(item, 'host_not_tested');
    seenInterventions.add(item.id); return true;
  });
  return { reasons, interventions, rejections, discarded: value.reasons.length + value.interventions.length - reasons.length - interventions.length };
}

export function applyEvidenceReview(findings, review) {
  const approved = (items, reviews) => items.filter(item => {
    const matches = (reviews || []).filter(entry => entry.id === item.id);
    return matches.length === 1 && matches[0].verdict === 'supported' && compact(matches[0].explanation).length >= 10;
  });
  const reasons = approved(findings.reasons, review?.reason_reviews);
  const interventions = approved(findings.interventions, review?.intervention_reviews).filter(item => reasons.some(reason => reason.id === item.reason_id))
    .sort((a, b) => ['high', 'medium', 'low'].indexOf(a.priority) - ['high', 'medium', 'low'].indexOf(b.priority)).slice(0, 3);
  return { reasons, interventions, discarded: findings.discarded + findings.reasons.length + findings.interventions.length - reasons.length - interventions.length };
}
