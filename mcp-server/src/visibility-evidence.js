import { safeFetch } from './audit.js';
import { validatePublicUrl } from './url-safety.js';

export const compactText = value => String(value || '').replace(/\s+/g, ' ').trim();
export const PROFILE_IDENTITY_RULE = 'exact-profile-url-2';

export function isTargetSource(value, website, targetType = 'business', identityRule = 'exact-profile-url-1') {
  try {
    const source = validatePublicUrl(value), target = validatePublicUrl(website);
    const host = url => url.hostname.replace(/^www\./, '').toLowerCase();
    if (targetType !== 'profile') return host(source) === host(target) || host(source).endsWith(`.${host(target)}`);
    const identity = url => {
      const copy = new URL(url);
      for (const key of [...copy.searchParams.keys()]) if (/^utm_|^(gclid|fbclid)$/i.test(key)) copy.searchParams.delete(key);
      copy.searchParams.sort();
      return `${host(copy)}:${copy.port}${copy.pathname.replace(/\/$/, '')}${copy.search}`;
    };
    if (identity(source) === identity(target)) return true;
    // MyLegend publishes the same approved person at a profile and its rich-card
    // route. Accept only that known pair, never arbitrary child pages or people.
    // Saved studies using the first identity rule keep their original URL scope.
    if (identityRule !== PROFILE_IDENTITY_RULE || host(source) !== 'mylegend.id' || host(target) !== 'mylegend.id') return false;
    const profile = url => {
      const copy = new URL(url);
      const path = copy.pathname.replace(/\/$/, '');
      if (!/^\/people\/[a-z0-9-]+(?:\/card)?$/.test(path)) return null;
      copy.pathname = path.replace(/\/card$/, '');
      return identity(copy);
    };
    const targetProfile = profile(target);
    return targetProfile !== null && profile(source) === targetProfile;
  } catch { return false; }
}

export function answerIdentifiesTarget(answer, business, website, targetType = 'business') {
  const lower = String(answer).toLowerCase();
  if (lower.includes(business.toLowerCase())) return true;
  return lower.includes(targetType === 'profile' ? website.toLowerCase() : new URL(website).hostname.replace(/^www\./, '').toLowerCase());
}

export async function checkPublicWording(website, targetUrl, expected, fetchImpl = fetch) {
  const target = validatePublicUrl(targetUrl);
  if (!isTargetSource(target.href, website)) throw new Error('invalid_intervention');
  const result = { target_url: target.href, expected_public_text: expected, checked_at: new Date().toISOString(),
    status: 'unavailable', limitation: 'Checks public page wording only. It does not verify every part of the change or search-index updates.' };
  try {
    const page = await safeFetch(target.href, fetchImpl, { maxBytes: 1_000_000 });
    // A different page on the same site cannot verify wording on the requested page.
    if (!isTargetSource(page.finalUrl.href, target.href, 'profile') || !page.response.ok) return result;
    const type = page.response.headers.get('content-type') || '';
    if (!/text\/(html|plain)/i.test(type)) return result;
    const body = await page.response.text();
    const text = /text\/html/i.test(type) ? body
      .replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&nbsp;/gi, ' ')
      .replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => {
        const number = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
        return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : ' ';
      }) : body;
    const present = compactText(text).includes(compactText(expected));
    return { ...result, status: present ? 'present' : 'not_found', final_url: page.finalUrl.href,
      quote: present ? compactText(expected) : null };
  } catch { return result; }
}

export function summariseRepeatEvidence(comparisons, selectedRunId) {
  const selected = comparisons.find(item => item.rerun_id === selectedRunId);
  const comparable = comparisons.filter(item => item.comparable && item.complete_coverage && item.mentions.paired_samples > 0);
  const increased = comparable.filter(item => item.outcome === 'observed_increase');
  const dates = new Set(increased.map(item => item.reassessment_completed_at?.slice(0, 10)).filter(Boolean));
  const status = !selected || !comparable.some(item => item.rerun_id === selectedRunId) ? 'inconclusive'
    : selected.outcome !== 'observed_increase' ? 'increase_not_repeated'
      : comparable.length < 2 ? 'single_check'
        : increased.length !== comparable.length ? 'inconsistent'
          : dates.size < 2 ? 'same_day_only' : 'repeated_on_separate_dates';
  return { status, checked_runs: comparisons.length, comparable_runs: comparable.length,
    increased_runs: increased.length, separate_increase_dates: dates.size,
    excluded_runs: comparisons.length - comparable.length,
    limitation: 'Repeated checks share a baseline and are not independent people or proof of causation.',
    runs: comparisons.map(item => ({ run_id: item.rerun_id, completed_at: item.reassessment_completed_at,
      outcome: item.outcome, comparable: item.comparable, complete_coverage: item.complete_coverage,
      mentions: item.mentions, recommendations: item.recommendations })) };
}
