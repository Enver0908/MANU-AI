export const SUPPORTED_LANGUAGES = [
  { code: "tr", label: "Turkish" },
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "cs", label: "Czech" },
];

export const DEFAULT_LANGUAGE = "tr";

const supportedLanguageCodes = new Set(SUPPORTED_LANGUAGES.map((language) => language.code));

export function normalizeLanguageCode(value) {
  return supportedLanguageCodes.has(value) ? value : DEFAULT_LANGUAGE;
}

export function languageLabel(code) {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code)?.label || "Turkish";
}
