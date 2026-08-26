export type CommercialEmail = string;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeCommercialEmail(input: string): CommercialEmail {
  return input.trim().toLowerCase();
}

export function validateNormalizedCommercialEmail(normalizedEmail: string) {
  const blockingReasons: string[] = [];
  if (!normalizedEmail) {
    blockingReasons.push("email is required");
  } else if (normalizedEmail !== normalizeCommercialEmail(normalizedEmail)) {
    blockingReasons.push("email must already be normalized");
  } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
    blockingReasons.push("email format is invalid");
  }
  return {
    valid: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function isAllowedCommercialEmail(email: string, allowedDomains: readonly string[]): boolean {
  const normalizedEmail = normalizeCommercialEmail(email);
  if (!validateNormalizedCommercialEmail(normalizedEmail).valid) {
    return false;
  }
  const domain = normalizedEmail.slice(normalizedEmail.lastIndexOf("@") + 1);
  const allowed = new Set(allowedDomains.map((value) => value.trim().toLowerCase()).filter(Boolean));
  return allowed.has(domain);
}
