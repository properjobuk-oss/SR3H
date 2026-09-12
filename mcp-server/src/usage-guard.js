const DEFAULT_LIMITS = Object.freeze({ global: 20, visitor: 2, target: 2 });

function boundedLimit(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function limitsFromEnv(env = {}) {
  return {
    global: boundedLimit(env.DAILY_DISCOVERY_LIMIT, DEFAULT_LIMITS.global, 500),
    visitor: boundedLimit(env.DAILY_DISCOVERY_VISITOR_LIMIT, DEFAULT_LIMITS.visitor, 20),
    target: boundedLimit(env.DAILY_DISCOVERY_TARGET_LIMIT, DEFAULT_LIMITS.target, 20)
  };
}

function cleanKey(value, fallback) {
  const key = String(value || "").trim().toLowerCase();
  return /^[a-z0-9._:-]{1,180}$/.test(key) ? key : fallback;
}

export class UsageGuard {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ allowed: false, reason: "invalid_request" }, { status: 400 });
    }

    const day = /^\d{4}-\d{2}-\d{2}$/.test(body?.day || "") ? body.day : new Date().toISOString().slice(0, 10);
    const visitor = cleanKey(body?.visitor, "unknown");
    const target = cleanKey(body?.target, "invalid-target");
    const limits = limitsFromEnv(this.env);
    const stored = await this.ctx.storage.get("daily-usage");
    const usage = stored?.day === day
      ? stored
      : { day, global: 0, visitors: {}, targets: {} };
    const visitorCount = usage.visitors[visitor] || 0;
    const targetCount = usage.targets[target] || 0;

    let reason = null;
    if (usage.global >= limits.global) reason = "global_daily_limit";
    else if (visitorCount >= limits.visitor) reason = "visitor_daily_limit";
    else if (targetCount >= limits.target) reason = "target_daily_limit";

    if (reason) {
      return Response.json({ allowed: false, reason, limits });
    }

    usage.global += 1;
    usage.visitors[visitor] = visitorCount + 1;
    usage.targets[target] = targetCount + 1;
    await this.ctx.storage.put("daily-usage", usage);
    return Response.json({ allowed: true, remaining: {
      global: limits.global - usage.global,
      visitor: limits.visitor - usage.visitors[visitor],
      target: limits.target - usage.targets[target]
    } });
  }
}

async function visitorDigest(request, secret) {
  // Missing configuration shares a conservative quota; never hash with a public salt.
  if (!secret) return 'unknown';
  const ip = request?.headers?.get("cf-connecting-ip") || "unknown";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const material = encoder.encode(`${new Date().toISOString().slice(0, 10)}:${ip}`);
  const digest = await crypto.subtle.sign('HMAC', key, material);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function usageContext(request, env = {}) {
  return { visitor: await visitorDigest(request, env.ABUSE_HASH_SECRET) };
}

export async function reserveDiscoveryUsage(env, target, context = {}) {
  if (!env.USAGE_GUARD) return { allowed: false, reason: 'quota_unavailable' };
  try {
    const id = env.USAGE_GUARD.idFromName("aido-discovery-budget");
    const stub = env.USAGE_GUARD.get(id);
    const response = await stub.fetch("https://usage-guard.internal/reserve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        day: new Date().toISOString().slice(0, 10),
        visitor: context.visitor || "unknown",
        target
      })
    });
    if (!response.ok) return { allowed: false, reason: "quota_unavailable" };
    return await response.json();
  } catch {
    return { allowed: false, reason: "quota_unavailable" };
  }
}

export const USAGE_LIMITS = DEFAULT_LIMITS;
