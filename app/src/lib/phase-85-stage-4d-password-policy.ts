/**
 * Client-safe password policy shared by onboarding and account-security routes.
 * Keep this module free of Node crypto so browser auth forms can import it.
 */

const PASSWORD_COMPLEXITY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[A-Za-z\d\S]{12,128}$/;

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;

export class AccountSecurityValidationError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "AccountSecurityValidationError";
    this.code = code;
  }
}

export function validatePassword(value: unknown): string {
  if (typeof value !== "string") {
    throw new AccountSecurityValidationError("invalid_password");
  }
  const trimmed = value.trim();
  if (trimmed.length < 12 || trimmed.length > 128) {
    throw new AccountSecurityValidationError("invalid_password");
  }
  if (CONTROL_CHAR_PATTERN.test(trimmed)) {
    throw new AccountSecurityValidationError("invalid_password");
  }
  if (!PASSWORD_COMPLEXITY.test(trimmed)) {
    throw new AccountSecurityValidationError("weak_password");
  }
  return trimmed;
}

export function validatePasswordPair(password: unknown, passwordConfirmation: unknown): string {
  const normalizedPassword = validatePassword(password);
  if (typeof passwordConfirmation !== "string" || passwordConfirmation.trim() !== normalizedPassword) {
    throw new AccountSecurityValidationError("password_mismatch");
  }
  return normalizedPassword;
}

export function describePasswordPolicyError(code?: string) {
  switch (code) {
    case "weak_password":
    case "invalid_password":
      return "Parola en az 12 karakter olmalı; büyük harf, küçük harf, rakam ve sembol içermelidir.";
    case "password_mismatch":
      return "Parolalar eşleşmiyor.";
    default:
      return null;
  }
}
