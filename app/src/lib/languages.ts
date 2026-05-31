export const SUPPORTED_LANGUAGES = [
  { code: "tr", label: "Turkish", nativeLabel: "Turkce" },
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "fr", label: "French", nativeLabel: "Francais" },
  { code: "es", label: "Spanish", nativeLabel: "Espanol" },
  { code: "pt", label: "Portuguese", nativeLabel: "Portugues" },
  { code: "cs", label: "Czech", nativeLabel: "Cestina" },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: SupportedLanguageCode = "tr";

const supportedLanguageCodes = new Set<string>(SUPPORTED_LANGUAGES.map((language) => language.code));

export function isSupportedLanguageCode(value: unknown): value is SupportedLanguageCode {
  return typeof value === "string" && supportedLanguageCodes.has(value);
}

export function normalizeLanguageCode(value: unknown): SupportedLanguageCode {
  return isSupportedLanguageCode(value) ? value : DEFAULT_LANGUAGE;
}

export function languageLabel(code: SupportedLanguageCode) {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code)?.label || "Turkish";
}

export function normalizeE164Phone(value: unknown) {
  const raw = String(value || "").trim().replace(/[()\s-]/g, "");
  if (!raw) return null;
  return /^\+[1-9]\d{7,14}$/.test(raw) ? raw : null;
}
