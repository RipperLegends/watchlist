import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv();

function readLinkedProjectRef() {
  const refPath = path.resolve(process.cwd(), "supabase/.temp/project-ref");
  if (!fs.existsSync(refPath)) return "";
  return fs.readFileSync(refPath, "utf8").trim();
}

function requireEnv(name, fallback = "") {
  const value = String(process.env[name] || fallback).trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function emailDomain(email) {
  return email.split("@")[1]?.toLowerCase() || "";
}

async function getResendDomains(apiKey) {
  const response = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.message || body?.error || `Resend API rejected the key with status ${response.status}`;
    throw new Error(message);
  }

  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function configureSupabaseSmtp() {
  const projectRef = requireEnv("SUPABASE_PROJECT_REF", readLinkedProjectRef());
  const accessToken = requireEnv("SUPABASE_ACCESS_TOKEN");
  const resendApiKey = requireEnv("RESEND_API_KEY");
  const fromEmail = requireEnv("SUPABASE_SMTP_FROM_EMAIL");
  const senderName = String(process.env.SUPABASE_SMTP_SENDER_NAME || "Watchlist").trim();
  const smtpPort = Number(process.env.SUPABASE_SMTP_PORT || 587);

  const domains = await getResendDomains(resendApiKey);
  const fromDomain = emailDomain(fromEmail);
  const verifiedDomain = domains.find((domain) => domain?.name?.toLowerCase() === fromDomain && domain?.status === "verified");

  if (fromEmail !== "onboarding@resend.dev" && !verifiedDomain) {
    throw new Error(
      `Resend sender domain "${fromDomain}" is not verified. Verify it in Resend first, then rerun this script.`
    );
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      external_email_enabled: true,
      mailer_secure_email_change_enabled: true,
      mailer_autoconfirm: false,
      smtp_admin_email: fromEmail,
      smtp_host: "smtp.resend.com",
      smtp_port: smtpPort,
      smtp_user: "resend",
      smtp_pass: resendApiKey,
      smtp_sender_name: senderName
    })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.message || body?.error || `Supabase Management API failed with status ${response.status}`;
    throw new Error(message);
  }

  console.log(`Supabase Auth SMTP configured for ${projectRef} using Resend sender ${fromEmail}.`);
}

configureSupabaseSmtp().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed to configure Supabase SMTP.");
  process.exit(1);
});
