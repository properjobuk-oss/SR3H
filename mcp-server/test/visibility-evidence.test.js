import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPublicWording, isTargetSource, summariseRepeatEvidence } from '../src/visibility-evidence.js';
import { assessVisibility, validateAssessment, captureRequest } from '../src/visibility-model.js';

const profile = 'https://mylegend.id/p/danny';
const assessment = (appearance, quote = '', evidence_url = null) => ({ appearance, quote, evidence_url, explanation: 'Saved evidence.', other_providers: [] });
const captured = (answer, urls) => ({ answer, sources: urls.map(url => ({ url })), citations: urls.map(url => ({ url })) });

test('profile identity distinguishes people, query IDs and subdomains while preserving business scope', () => {
  assert.equal(isTargetSource('https://mylegend.id/p/morgan', profile, 'profile'), false);
  assert.equal(isTargetSource('https://mylegend.id/', profile, 'profile'), false);
  assert.equal(isTargetSource('https://other.mylegend.id/p/danny', profile, 'profile'), false);
  assert.equal(isTargetSource('https://www.mylegend.id/p/danny/?utm_source=test#about', profile, 'profile'), true);
  assert.equal(isTargetSource('https://mylegend.id/profile?id=morgan', 'https://mylegend.id/profile?id=danny', 'profile'), false);
  assert.equal(isTargetSource('https://mylegend.id/p/morgan', profile), true);
});

test('a same-name person or shared platform cannot establish profile visibility', () => {
  const quote = 'Danny Griffin is a suitable contact.';
  const other = 'https://mylegend.id/p/other-danny';
  assert.throws(() => validateAssessment(assessment('recommended', quote, other), captured(quote, [other]), 'Danny Griffin', profile, 'profile'), /identity_unverified/);
  assert.throws(() => validateAssessment(assessment('recommended', quote, other), captured(quote, [profile, other]), 'Danny Griffin', profile, 'profile'), /identity_unverified/);
  assert.throws(() => validateAssessment(assessment('source_only', '', 'https://mylegend.id/'), captured('Profile platforms are available.', ['https://mylegend.id/']), 'Danny Griffin', profile, 'profile'), /unsupported_source/);
});

test('profile mentions, source-only evidence and absence use the exact person independently of card rendering', () => {
  const quote = 'Danny Griffin is a suitable contact.';
  assert.equal(validateAssessment(assessment('recommended', quote, profile), captured(quote, [profile]), 'Danny Griffin', profile, 'profile').appearance, 'recommended');
  assert.equal(validateAssessment(assessment('source_only', '', profile), captured('A relevant contact is available.', [profile]), 'Danny Griffin', profile, 'profile').appearance, 'source_only');
  assert.equal(validateAssessment(assessment('not_seen'), captured('Morgan has a MyLegend profile.', ['https://mylegend.id/p/morgan']), 'Danny Griffin', profile, 'profile').appearance, 'not_seen');
});

test('profile assessment remains after neutral capture and does not inject target identity into searches', async () => {
  const study = { target_type: 'profile', business: 'Danny Griffin', website_url: profile, conditions: { model: 'test' } };
  const request = captureRequest({ question: 'Which identity services offer public profiles?' }, study.conditions);
  assert.doesNotMatch(JSON.stringify(request), /Danny|mylegend|target_type/);
  let assessmentRequest;
  const result = await assessVisibility(captured('Morgan uses MyLegend.', ['https://mylegend.id/p/morgan']), study, { OPENAI_API_KEY: 'test' }, async (_, init) => {
    assessmentRequest = JSON.parse(init.body);
    return Response.json({ status: 'completed', model: 'test', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(assessment('source_only', '', 'https://mylegend.id/p/morgan')) }] }] });
  });
  assert.match(assessmentRequest.instructions, /exact profile URL/);
  assert.equal(result.appearance, 'not_seen');
});

test('public wording checks rendered markup text and excludes scripts, metadata and hidden templates', async () => {
  const expected = 'Public professional profile & owner approved answers';
  const read = body => checkPublicWording(profile, profile, expected, async () => new Response(body, { headers: { 'content-type': 'text/html' } }));
  assert.equal((await read('<main>Public <b>professional profile</b> &amp; owner approved answers</main>')).status, 'present');
  assert.equal((await read(`<head><title>${expected}</title></head><script>${expected}</script><template>${expected}</template>`)).status, 'not_found');
  assert.equal((await read('<main>Unchanged public profile.</main>')).status, 'not_found');
});

test('unreadable and oversized pages remain unknown without pretending a change is missing', async () => {
  for (const response of [new Response('missing', { status: 404 }), new Response('PDF', { headers: { 'content-type': 'application/pdf' } }),
    new Response('large', { headers: { 'content-length': '1000001', 'content-type': 'text/html' } })]) {
    assert.equal((await checkPublicWording(profile, profile, 'Expected public profile information', async () => response)).status, 'unavailable');
  }
});

test('public wording refuses private destinations and rejects cross-site redirects as evidence', async () => {
  let calls = 0;
  await assert.rejects(checkPublicWording(profile, 'http://127.0.0.1/', 'Expected public profile information', async () => { calls++; }), /publicly reachable/);
  await assert.rejects(checkPublicWording(profile, 'https://competitor.example/', 'Expected public profile information', async () => { calls++; }), /invalid_intervention/);
  assert.equal(calls, 0);
  const result = await checkPublicWording(profile, profile, 'Expected public profile information', async url => {
    calls++; assert.equal(String(url), profile);
    return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } });
  });
  assert.equal(result.status, 'unavailable'); assert.equal(calls, 1);
  const external = await checkPublicWording(profile, profile, 'Expected public profile information', async url => String(url) === profile ?
    new Response(null, { status: 302, headers: { location: 'https://competitor.example/' } }) : new Response('Expected public profile information', { headers: { 'content-type': 'text/plain' } }));
  assert.equal(external.status, 'unavailable');
  const homepage = await checkPublicWording(profile, profile, 'Expected public profile information', async url => String(url) === profile ?
    new Response(null, { status: 302, headers: { location: 'https://mylegend.id/' } }) : new Response('Expected public profile information', { headers: { 'content-type': 'text/plain' } }));
  assert.equal(homepage.status, 'unavailable');
});

const compared = (id, date, outcome = 'observed_increase', extra = {}) => ({ rerun_id: id, reassessment_completed_at: date,
  outcome, comparable: true, complete_coverage: true, mentions: { paired_samples: 2 }, recommendations: {}, ...extra });

test('repeat evidence distinguishes one check, same-date repetition and separate dates', () => {
  const first = compared('first', '2026-10-08T08:00:00Z'), sameDay = compared('second', '2026-10-08T16:00:00Z'), later = compared('third', '2026-10-10T08:00:00Z');
  assert.equal(summariseRepeatEvidence([first], 'first').status, 'single_check');
  assert.equal(summariseRepeatEvidence([first, sameDay], 'second').status, 'same_day_only');
  const summary = summariseRepeatEvidence([first, sameDay, later], 'third');
  assert.equal(summary.status, 'repeated_on_separate_dates'); assert.equal(summary.separate_increase_dates, 2);
  assert.match(summary.limitation, /not independent people or proof of causation/);
});

test('repeat evidence preserves reversals, missing coverage and incompatible models', () => {
  const first = compared('first', '2026-10-08T08:00:00Z');
  const reversal = compared('second', '2026-10-09T08:00:00Z', 'observed_decrease');
  const later = compared('third', '2026-10-10T08:00:00Z');
  assert.equal(summariseRepeatEvidence([first, reversal], 'second').status, 'increase_not_repeated');
  assert.equal(summariseRepeatEvidence([first, reversal, later], 'third').status, 'inconsistent');
  for (const extra of [{ complete_coverage: false }, { comparable: false }]) {
    const excluded = compared('partial', '2026-10-11T08:00:00Z', 'inconclusive', extra);
    const summary = summariseRepeatEvidence([first, excluded], 'partial');
    assert.equal(summary.status, 'inconclusive'); assert.equal(summary.excluded_runs, 1);
  }
});
