function isNonPublicIPv4(hostname) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return false;
  const [a, b, c, d] = hostname.split(".").map(Number);
  if ([a, b, c, d].some((part) => part > 255)) return true;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113);
}

function isPrivateIPv6(hostname) {
  const value = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return value === "::" || value === "::1" || value.startsWith("fc") ||
    value.startsWith("fd") || value.startsWith("fe8") ||
    value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb") ||
    value.startsWith("::ffff:") || value.startsWith("2001:db8:");
}

export function validatePublicUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete public website URL, including https:// or http://.");
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("Only public HTTP and HTTPS website URLs can be checked.");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not accepted.");
  }
  if (url.port) throw new Error('Only public HTTP and HTTPS websites on standard ports can be checked.');
  for (const name of url.searchParams.keys()) {
    if (/(?:token|password|secret|api[_-]?key|authorization|signature)/i.test(name)) {
      throw new Error('URLs containing credentials or access tokens are not accepted.');
    }
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const blockedName = hostname === "localhost" || hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") || hostname.endsWith(".internal") ||
    hostname.endsWith(".home") || !hostname.includes(".");
  const blockedAddress = isNonPublicIPv4(hostname) || isPrivateIPv6(hostname);

  if (blockedName || blockedAddress) {
    throw new Error("Only publicly reachable websites can be checked; local and private network addresses are blocked.");
  }

  url.hash = "";
  url.hostname = hostname;
  return url;
}
