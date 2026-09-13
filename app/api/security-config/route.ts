import { isTurnstileEnabledForRequest } from "@/lib/security";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const enabled = isTurnstileEnabledForRequest(request);

  return Response.json({
    turnstile: {
      enabled,
      siteKey: enabled ? process.env.TURNSTILE_SITE_KEY : ""
    }
  });
}
