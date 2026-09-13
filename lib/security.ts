export function isLocalHost(host: string | null) {
  const hostname = (host || "").split(":")[0]?.replace(/^\[|\]$/g, "");
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function isTurnstileEnabledForRequest(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const allowLocal = process.env.TURNSTILE_ENABLE_LOCAL === "true";
  const hasKeys = Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);

  if (!hasKeys) return false;
  if (!allowLocal && isLocalHost(host)) return false;

  return true;
}
