type SupabaseAuthUser = {
  id: string;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
};

type SupabaseAuthUpdateAttributes = {
  email?: string;
  password?: string;
  name?: string;
  banDuration?: string;
};

type SupabaseAuthResult =
  | { ok: true; user: SupabaseAuthUser }
  | {
      ok: false;
      reason: "missing_config" | "invalid_credentials" | "duplicate" | "error";
      message?: string;
    };

function getSupabaseUrl() {
  return process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
}

function getPublishableKey() {
  return process.env.SUPABASE_PUBLISHABLE_KEY || "";
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function authHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}

async function readSupabaseError(response: Response) {
  const payload = await response.json().catch(() => null);
  return String(payload?.msg || payload?.message || payload?.error_description || payload?.error || "");
}

export function isSupabaseAuthConfigured() {
  return Boolean(getSupabaseUrl() && getPublishableKey() && getServiceRoleKey());
}

export async function signInWithSupabasePassword(email: string, password: string): Promise<SupabaseAuthResult> {
  const supabaseUrl = getSupabaseUrl();
  const publishableKey = getPublishableKey();
  if (!supabaseUrl || !publishableKey) return { ok: false, reason: "missing_config" };

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: authHeaders(publishableKey),
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const message = await readSupabaseError(response);
      return {
        ok: false,
        reason: response.status === 400 || response.status === 401 ? "invalid_credentials" : "error",
        message
      };
    }

    const payload = await response.json();
    return {
      ok: true,
      user: {
        id: String(payload?.user?.id || ""),
        email: payload?.user?.email,
        accessToken: payload?.access_token,
        refreshToken: payload?.refresh_token
      }
    };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Supabase Auth sign in failed"
    };
  }
}

export async function signUpWithSupabasePassword({
  email,
  password,
  name,
  redirectTo
}: {
  email: string;
  password: string;
  name: string;
  redirectTo?: string;
}): Promise<SupabaseAuthResult> {
  const supabaseUrl = getSupabaseUrl();
  const publishableKey = getPublishableKey();
  if (!supabaseUrl || !publishableKey) return { ok: false, reason: "missing_config" };

  const signupUrl = new URL(`${supabaseUrl}/auth/v1/signup`);
  if (redirectTo) signupUrl.searchParams.set("redirect_to", redirectTo);

  try {
    const response = await fetch(signupUrl, {
      method: "POST",
      headers: authHeaders(publishableKey),
      body: JSON.stringify({
        email,
        password,
        data: { name }
      })
    });

    if (!response.ok) {
      const message = await readSupabaseError(response);
      const normalizedMessage = message.toLowerCase();
      return {
        ok: false,
        reason: normalizedMessage.includes("already") || normalizedMessage.includes("registered") ? "duplicate" : "error",
        message
      };
    }

    const payload = await response.json();
    return {
      ok: true,
      user: {
        id: String(payload?.user?.id || payload?.id || ""),
        email: payload?.user?.email || payload?.email,
        accessToken: payload?.access_token,
        refreshToken: payload?.refresh_token
      }
    };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Supabase Auth sign up failed"
    };
  }
}

export async function createSupabaseAuthUser({
  email,
  password,
  name
}: {
  email: string;
  password: string;
  name: string;
}): Promise<SupabaseAuthResult> {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) return { ok: false, reason: "missing_config" };

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: authHeaders(serviceRoleKey),
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      })
    });

    if (!response.ok) {
      const message = await readSupabaseError(response);
      const normalizedMessage = message.toLowerCase();
      return {
        ok: false,
        reason: normalizedMessage.includes("already") || normalizedMessage.includes("registered") ? "duplicate" : "error",
        message
      };
    }

    const payload = await response.json();
    return {
      ok: true,
      user: {
        id: String(payload?.id || payload?.user?.id || ""),
        email: payload?.email || payload?.user?.email
      }
    };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Supabase Auth user creation failed"
    };
  }
}

export async function enrollSupabaseTotp(accessToken: string, friendlyName = "Watchlist Admin"): Promise<
  | {
      ok: true;
      factorId: string;
      qrCode: string;
      secret: string;
      uri: string;
    }
  | { ok: false; message: string }
> {
  const supabaseUrl = getSupabaseUrl();
  const publishableKey = getPublishableKey();
  if (!supabaseUrl || !publishableKey || !accessToken) return { ok: false, message: "Supabase MFA is not configured" };

  const response = await fetch(`${supabaseUrl}/auth/v1/factors`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      factor_type: "totp",
      friendly_name: friendlyName,
      issuer: "Watchlist"
    })
  });

  if (!response.ok) {
    return { ok: false, message: await readSupabaseError(response) };
  }

  const payload = await response.json();
  return {
    ok: true,
    factorId: String(payload?.id || ""),
    qrCode: String(payload?.totp?.qr_code || ""),
    secret: String(payload?.totp?.secret || ""),
    uri: String(payload?.totp?.uri || "")
  };
}

export async function verifySupabaseTotpFactor(accessToken: string, factorId: string, code: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabaseUrl = getSupabaseUrl();
  const publishableKey = getPublishableKey();
  if (!supabaseUrl || !publishableKey || !accessToken) return { ok: false, message: "Supabase MFA is not configured" };

  const headers = {
    apikey: publishableKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  };
  const challenge = await fetch(`${supabaseUrl}/auth/v1/factors/${factorId}/challenge`, {
    method: "POST",
    headers
  });

  if (!challenge.ok) {
    return { ok: false, message: await readSupabaseError(challenge) };
  }

  const challengePayload = await challenge.json();
  const challengeId = String(challengePayload?.id || "");
  const verification = await fetch(`${supabaseUrl}/auth/v1/factors/${factorId}/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      challenge_id: challengeId,
      code
    })
  });

  if (!verification.ok) {
    return { ok: false, message: await readSupabaseError(verification) };
  }

  return { ok: true };
}

export async function updateSupabasePasswordWithAccessToken(accessToken: string, password: string): Promise<SupabaseAuthResult> {
  const supabaseUrl = getSupabaseUrl();
  const publishableKey = getPublishableKey();
  if (!supabaseUrl || !publishableKey || !accessToken) return { ok: false, reason: "missing_config" };

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });

    if (!response.ok) {
      const message = await readSupabaseError(response);
      return { ok: false, reason: "error", message };
    }

    const payload = await response.json();
    return {
      ok: true,
      user: {
        id: String(payload?.id || payload?.user?.id || ""),
        email: payload?.email || payload?.user?.email
      }
    };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Supabase password update failed"
    };
  }
}

export async function getSupabaseUserWithAccessToken(accessToken: string): Promise<SupabaseAuthResult> {
  const supabaseUrl = getSupabaseUrl();
  const publishableKey = getPublishableKey();
  if (!supabaseUrl || !publishableKey || !accessToken) return { ok: false, reason: "missing_config" };

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const message = await readSupabaseError(response);
      return { ok: false, reason: "error", message };
    }

    const payload = await response.json();
    return {
      ok: true,
      user: {
        id: String(payload?.id || payload?.user?.id || ""),
        email: payload?.email || payload?.user?.email
      }
    };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Supabase user lookup failed"
    };
  }
}

export async function updateSupabaseAuthUserById(
  uid: string | null | undefined,
  attributes: SupabaseAuthUpdateAttributes
): Promise<SupabaseAuthResult> {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey || !uid) return { ok: false, reason: "missing_config" };

  const body: Record<string, unknown> = {};
  if (attributes.email) body.email = attributes.email;
  if (attributes.password) body.password = attributes.password;
  if (attributes.name) body.user_metadata = { name: attributes.name };
  if (attributes.banDuration) body.ban_duration = attributes.banDuration;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${uid}`, {
      method: "PUT",
      headers: authHeaders(serviceRoleKey),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const message = await readSupabaseError(response);
      return { ok: false, reason: "error", message };
    }

    const payload = await response.json();
    return {
      ok: true,
      user: {
        id: String(payload?.id || payload?.user?.id || uid),
        email: payload?.email || payload?.user?.email
      }
    };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Supabase Auth user update failed"
    };
  }
}

export async function sendSupabasePasswordReset(email: string, redirectTo?: string): Promise<SupabaseAuthResult> {
  const supabaseUrl = getSupabaseUrl();
  const publishableKey = getPublishableKey();
  if (!supabaseUrl || !publishableKey) return { ok: false, reason: "missing_config" };

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: authHeaders(publishableKey),
      body: JSON.stringify({
        email,
        ...(redirectTo ? { redirect_to: redirectTo } : {})
      })
    });

    if (!response.ok) {
      const message = await readSupabaseError(response);
      return { ok: false, reason: "error", message };
    }

    return {
      ok: true,
      user: { id: "", email }
    };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Supabase password reset failed"
    };
  }
}

export async function deleteSupabaseAuthUserById(uid: string | null | undefined): Promise<SupabaseAuthResult> {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey || !uid) return { ok: false, reason: "missing_config" };

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${uid}`, {
      method: "DELETE",
      headers: authHeaders(serviceRoleKey)
    });

    if (!response.ok) {
      const message = await readSupabaseError(response);
      return { ok: false, reason: "error", message };
    }

    return { ok: true, user: { id: uid } };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Supabase Auth user deletion failed"
    };
  }
}
