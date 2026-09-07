const FORBIDDEN_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: "cookie-header", pattern: /set-cookie\s*:/i },
  { id: "authorization-header", pattern: /authorization\s*:\s*bearer\s+\S+/i },
  { id: "jwt", pattern: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/ },
  { id: "supabase-service-role", pattern: /supabase.{0,24}service.role/i },
  { id: "stripe-secret", pattern: /\bsk_(live|test)_[a-zA-Z0-9]+\b/ },
  { id: "gmail", pattern: /\b[a-z0-9._%+-]+@gmail\.com\b/i },
  { id: "raw-json-body", pattern: /"password"\s*:\s*"/i },
];

const ALLOWED_EMAIL_SUFFIX = "@example.com";
const ALLOWED_PHONE = "+15555550100";

export function scanArtifactPrivacy(text: string): string[] {
  const hits: string[] = [];
  for (const rule of FORBIDDEN_PATTERNS) {
    if (rule.pattern.test(text)) {
      hits.push(rule.id);
    }
  }
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  for (const email of emails) {
    if (!email.toLowerCase().endsWith(ALLOWED_EMAIL_SUFFIX)) {
      hits.push("non-synthetic-email");
    }
  }
  const phones = text.match(/\+[1-9]\d{7,14}/g) ?? [];
  for (const phone of phones) {
    if (phone !== ALLOWED_PHONE) {
      hits.push("non-synthetic-phone");
    }
  }
  return hits;
}

export function redactArtifactText(text: string): string {
  return text
    .replace(/\b[a-z0-9._%+-]+@gmail\.com\b/gi, "[redacted-email]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (email) =>
      email.toLowerCase().endsWith(ALLOWED_EMAIL_SUFFIX) ? email : "[redacted-email]",
    )
    .replace(/\+[1-9]\d{7,14}/g, (phone) => (phone === ALLOWED_PHONE ? phone : "[redacted-phone]"));
}

export function assertArtifactPrivacy(text: string, label: string) {
  const hits = scanArtifactPrivacy(text);
  if (hits.length > 0) {
    throw new Error(`Stage7 privacy scan failed for ${label}: ${hits.join(", ")}`);
  }
}
