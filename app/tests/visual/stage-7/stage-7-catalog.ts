import {
  parseStage7Scenario,
  type Stage7BrowserTier,
  type Stage7Locale,
  type Stage7PwaMode,
  type Stage7Role,
  type Stage7Scenario,
  type Stage7SnapshotKind,
  type Stage7ViewportTier,
} from "./stage-7-schema";
import { pairwiseCombinations } from "./stage-7-pairwise";

type ScenarioSeed = {
  surface: string;
  route: string;
  state: string;
  fixtureId: string;
  snapshotKind: Stage7SnapshotKind;
  requiredAssertions: string[];
  accessibilityChecks?: string[];
  performanceEligible?: boolean;
  critical?: boolean;
};

const DEFAULT_ASSERTIONS = ["visible-root", "geometry", "axe-a-aa"];
const DEFAULT_A11Y = ["axe-wcag-a-aa", "keyboard-tab", "aria-roles"];

const CORE_SEEDS: ScenarioSeed[] = [
  { surface: "public", route: "/#contact", state: "contact-empty", fixtureId: "public-default", snapshotKind: "page", requiredAssertions: DEFAULT_ASSERTIONS, critical: true },
  { surface: "public", route: "/#contact", state: "contact-invalid", fixtureId: "public-default", snapshotKind: "state", requiredAssertions: ["validation-message", "geometry"] },
  { surface: "public", route: "/#contact", state: "contact-submitting", fixtureId: "public-default", snapshotKind: "state", requiredAssertions: ["busy-state"] },
  { surface: "public", route: "/#contact", state: "contact-success", fixtureId: "public-default", snapshotKind: "state", requiredAssertions: ["success-status"] },
  { surface: "public", route: "/#contact", state: "contact-error", fixtureId: "public-default", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "auth", route: "/login", state: "login-idle", fixtureId: "public-default", snapshotKind: "page", requiredAssertions: DEFAULT_ASSERTIONS, critical: true },
  { surface: "auth", route: "/login", state: "login-sent", fixtureId: "auth-sent", snapshotKind: "state", requiredAssertions: ["success-status"] },
  { surface: "auth", route: "/login", state: "login-invalid", fixtureId: "auth-invalid", snapshotKind: "state", requiredAssertions: ["validation-message"] },
  { surface: "auth", route: "/login", state: "login-rate-limited", fixtureId: "auth-rate-limited", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "auth", route: "/login", state: "login-service-error", fixtureId: "auth-service-error", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "purchase", route: "/purchase", state: "purchase-valid", fixtureId: "purchase-valid", snapshotKind: "state", requiredAssertions: ["eligible-cta"], critical: true },
  { surface: "purchase", route: "/purchase", state: "purchase-invalid", fixtureId: "purchase-invalid", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "purchase", route: "/purchase", state: "purchase-expired", fixtureId: "purchase-expired", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "purchase", route: "/purchase", state: "purchase-consumed", fixtureId: "purchase-consumed", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "purchase", route: "/purchase", state: "purchase-pending", fixtureId: "purchase-pending", snapshotKind: "state", requiredAssertions: ["pending-status"] },
  { surface: "purchase", route: "/purchase/cancel", state: "purchase-cancelled", fixtureId: "public-default", snapshotKind: "page", requiredAssertions: DEFAULT_ASSERTIONS },
  { surface: "purchase", route: "/purchase/success?session_id=cs_test_stage7_0001", state: "purchase-success", fixtureId: "public-default", snapshotKind: "page", requiredAssertions: DEFAULT_ASSERTIONS },
  { surface: "onboarding", route: "/onboarding", state: "onboarding-unauthenticated", fixtureId: "public-default", snapshotKind: "page", requiredAssertions: ["login-redirect-or-gate"] },
  { surface: "onboarding", route: "/onboarding?session_id=cs_test_stage7_0001", state: "onboarding-claimable", fixtureId: "onboarding-claimable", snapshotKind: "state", requiredAssertions: ["claim-cta"] },
  { surface: "onboarding", route: "/onboarding?session_id=cs_test_stage7_0001", state: "onboarding-incomplete", fixtureId: "onboarding-incomplete", snapshotKind: "state", requiredAssertions: ["incomplete-status"] },
  { surface: "onboarding", route: "/onboarding?session_id=cs_test_stage7_0001", state: "onboarding-duplicate", fixtureId: "onboarding-duplicate", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "onboarding", route: "/onboarding?session_id=cs_test_stage7_0001", state: "onboarding-already-claimed", fixtureId: "onboarding-already-claimed", snapshotKind: "state", requiredAssertions: ["already-claimed"] },
  { surface: "onboarding", route: "/onboarding?session_id=cs_test_stage7_0001", state: "onboarding-pending", fixtureId: "onboarding-pending", snapshotKind: "state", requiredAssertions: ["pending-status"] },
  { surface: "onboarding", route: "/onboarding?session_id=cs_test_stage7_0001", state: "onboarding-error", fixtureId: "onboarding-error", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "install", route: "/app-install", state: "install-eligible", fixtureId: "install-eligible", snapshotKind: "state", requiredAssertions: ["install-guidance"] },
  { surface: "install", route: "/app-install", state: "install-ineligible", fixtureId: "install-ineligible", snapshotKind: "state", requiredAssertions: ["blocked-status"] },
  { surface: "install", route: "/app-install", state: "install-installed", fixtureId: "install-installed", snapshotKind: "state", requiredAssertions: ["installed-or-settings"] },
  { surface: "install", route: "/app-install", state: "install-non-installable", fixtureId: "install-non-installable", snapshotKind: "state", requiredAssertions: ["blocked-status"] },
  { surface: "install", route: "/app-install", state: "install-revoked", fixtureId: "install-revoked", snapshotKind: "state", requiredAssertions: ["blocked-status"] },
  { surface: "admin", route: "/admin", state: "admin-login", fixtureId: "public-default", snapshotKind: "page", requiredAssertions: DEFAULT_ASSERTIONS, critical: true },
  { surface: "admin", route: "/admin?error=admin_access_denied", state: "admin-non-allowlisted", fixtureId: "admin-non-allowlisted", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "admin", route: "/admin", state: "admin-unauthorized", fixtureId: "admin-unauthorized", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "admin", route: "/admin", state: "admin-empty", fixtureId: "admin-empty", snapshotKind: "locator", requiredAssertions: ["empty-state"] },
  { surface: "admin", route: "/admin", state: "admin-dense", fixtureId: "admin-dense", snapshotKind: "locator", requiredAssertions: ["dense-table", "geometry"] },
  { surface: "admin", route: "/admin", state: "admin-error", fixtureId: "admin-error", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "emergency-admin", route: "/commercial-admin/emergency", state: "emergency-secondary-visible", fixtureId: "public-default", snapshotKind: "page", requiredAssertions: DEFAULT_ASSERTIONS },
  { surface: "emergency-admin", route: "/commercial-admin/emergency", state: "emergency-invalid-token", fixtureId: "admin-unauthorized", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "emergency-admin", route: "/commercial-admin/emergency", state: "emergency-secure-failure", fixtureId: "admin-error", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "dashboard-shell", route: "/dashboard", state: "shell-bootstrap", fixtureId: "dashboard-dense", snapshotKind: "page", requiredAssertions: DEFAULT_ASSERTIONS, critical: true, performanceEligible: true },
  { surface: "dashboard-shell", route: "/dashboard", state: "shell-no-active-client", fixtureId: "dashboard-empty", snapshotKind: "state", requiredAssertions: ["empty-or-prompt"] },
  { surface: "dashboard-shell", route: "/dashboard", state: "shell-offline", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["offline-blocker"] },
  { surface: "dashboard-shell", route: "/dashboard", state: "shell-session-expired", fixtureId: "dashboard-error", snapshotKind: "state", requiredAssertions: ["session-gate"] },
  { surface: "dashboard-shell", route: "/dashboard", state: "shell-update-ready", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["update-banner-or-note"] },
  { surface: "dashboard-shell", route: "/dashboard", state: "shell-dirty-guard", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["dirty-dialog"] },
  { surface: "dashboard-overview", route: "/dashboard?section=overview", state: "overview-no-active-client", fixtureId: "dashboard-empty", snapshotKind: "page", requiredAssertions: DEFAULT_ASSERTIONS },
  { surface: "dashboard-overview", route: "/dashboard?section=overview", state: "overview-empty-queues", fixtureId: "dashboard-empty", snapshotKind: "locator", requiredAssertions: ["empty-state"] },
  { surface: "dashboard-overview", route: "/dashboard?section=overview", state: "overview-dense-queues", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["dense-list", "geometry"] },
  { surface: "dashboard-clients", route: "/dashboard?section=clients", state: "clients-empty", fixtureId: "dashboard-empty", snapshotKind: "locator", requiredAssertions: ["empty-state"] },
  { surface: "dashboard-clients", route: "/dashboard?section=clients", state: "clients-dense", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["dense-list", "geometry"], critical: true },
  { surface: "dashboard-clients", route: "/dashboard?section=clients&clientId=client-stage7-missing", state: "clients-inaccessible-deeplink", fixtureId: "dashboard-forbidden", snapshotKind: "state", requiredAssertions: ["forbidden-or-missing"] },
  { surface: "dashboard-clients", route: "/dashboard?section=clients", state: "clients-active-switch", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["active-client"] },
  { surface: "dashboard-forms", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=forms", state: "forms-loading", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["loading-state"] },
  { surface: "dashboard-forms", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=forms", state: "forms-dirty", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["dirty-state"] },
  { surface: "dashboard-forms", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=forms", state: "forms-validation", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["validation-message"] },
  { surface: "dashboard-forms", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=forms", state: "forms-save", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["save-ack"] },
  { surface: "dashboard-forms", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=forms", state: "forms-error", fixtureId: "dashboard-error", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "dashboard-forms", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=forms", state: "forms-revision-conflict", fixtureId: "dashboard-conflict", snapshotKind: "state", requiredAssertions: ["conflict-status"] },
  { surface: "dashboard-nutrition", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=food_rules", state: "nutrition-search", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["search-field"] },
  { surface: "dashboard-nutrition", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=food_rules", state: "nutrition-dense-catalog", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["dense-list", "geometry"] },
  { surface: "dashboard-nutrition", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=food_rules", state: "nutrition-allow-forbid-conflict", fixtureId: "dashboard-conflict", snapshotKind: "state", requiredAssertions: ["conflict-status"] },
  { surface: "dashboard-nutrition", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=food_rules", state: "nutrition-save-error", fixtureId: "dashboard-error", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "dashboard-menu", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=menu", state: "menu-draft", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["draft-state"] },
  { surface: "dashboard-menu", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=menu", state: "menu-active", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["active-state"] },
  { surface: "dashboard-menu", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=menu", state: "menu-archive", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["archive-or-list"] },
  { surface: "dashboard-menu", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=menu", state: "menu-conflict", fixtureId: "dashboard-conflict", snapshotKind: "state", requiredAssertions: ["conflict-status"] },
  { surface: "dashboard-menu", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=menu", state: "menu-export-eligible", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["export-enabled"] },
  { surface: "dashboard-menu", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=menu", state: "menu-export-ineligible", fixtureId: "dashboard-empty", snapshotKind: "state", requiredAssertions: ["export-disabled"] },
  { surface: "dashboard-menu", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=menu", state: "menu-dirty", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["dirty-state"] },
  { surface: "dashboard-ai", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=ai_assistant", state: "ai-inactive", fixtureId: "dashboard-empty", snapshotKind: "locator", requiredAssertions: ["inactive-state"] },
  { surface: "dashboard-ai", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=ai_assistant", state: "ai-active", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["active-state"] },
  { surface: "dashboard-ai", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=ai_assistant", state: "ai-blocker", fixtureId: "dashboard-error", snapshotKind: "state", requiredAssertions: ["blocker-status"] },
  { surface: "dashboard-ai", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=ai_assistant", state: "ai-takeover", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["takeover-status"] },
  { surface: "dashboard-ai", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=ai_assistant", state: "ai-readonly", fixtureId: "dashboard-forbidden", snapshotKind: "state", requiredAssertions: ["readonly-or-hidden"] },
  { surface: "dashboard-ai", route: "/dashboard?section=clients&clientId=client-stage7-001&clientTask=ai_assistant", state: "ai-stale-revision", fixtureId: "dashboard-conflict", snapshotKind: "state", requiredAssertions: ["stale-status"] },
  { surface: "dashboard-messaging", route: "/dashboard?section=messages", state: "messaging-empty", fixtureId: "dashboard-empty", snapshotKind: "locator", requiredAssertions: ["empty-state"] },
  { surface: "dashboard-messaging", route: "/dashboard?section=messages", state: "messaging-dense", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["dense-list", "geometry"], critical: true },
  { surface: "dashboard-messaging", route: "/dashboard?section=messages", state: "messaging-unread", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["unread-marker"] },
  { surface: "dashboard-messaging", route: "/dashboard?section=messages", state: "messaging-text", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["message-body"] },
  { surface: "dashboard-messaging", route: "/dashboard?section=messages", state: "messaging-image", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["media-containment"] },
  { surface: "dashboard-messaging", route: "/dashboard?section=messages", state: "messaging-audio", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["media-containment"] },
  { surface: "dashboard-messaging", route: "/dashboard?section=messages", state: "messaging-yellow", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["risk-yellow"] },
  { surface: "dashboard-messaging", route: "/dashboard?section=messages", state: "messaging-red", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["risk-red"] },
  { surface: "dashboard-messaging", route: "/dashboard?section=messages", state: "messaging-manual", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["manual-state"] },
  { surface: "dashboard-messaging", route: "/dashboard?section=messages", state: "messaging-pagination", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["pagination"] },
  { surface: "dashboard-messaging", route: "/dashboard?section=messages", state: "messaging-delivery-error", fixtureId: "dashboard-error", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "dashboard-messaging", route: "/dashboard?section=messages&conversationId=missing", state: "messaging-inaccessible", fixtureId: "dashboard-forbidden", snapshotKind: "state", requiredAssertions: ["forbidden-or-missing"] },
  { surface: "dashboard-alerts", route: "/dashboard?section=alerts", state: "alerts-empty", fixtureId: "dashboard-empty", snapshotKind: "locator", requiredAssertions: ["empty-state"] },
  { surface: "dashboard-alerts", route: "/dashboard?section=alerts", state: "alerts-dense", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["dense-list"] },
  { surface: "dashboard-alerts", route: "/dashboard?section=alerts", state: "alerts-filters", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["filters"] },
  { surface: "dashboard-alerts", route: "/dashboard?section=alerts", state: "alerts-pagination", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["pagination"] },
  { surface: "dashboard-alerts", route: "/dashboard?section=alerts", state: "alerts-mutation-pending", fixtureId: "dashboard-dense", snapshotKind: "state", requiredAssertions: ["pending-status"] },
  { surface: "dashboard-alerts", route: "/dashboard?section=alerts", state: "alerts-mutation-error", fixtureId: "dashboard-error", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "dashboard-alerts", route: "/dashboard?section=notifications", state: "alerts-stale", fixtureId: "dashboard-conflict", snapshotKind: "state", requiredAssertions: ["stale-status"] },
  { surface: "dashboard-simulator", route: "/dashboard?section=simulator", state: "simulator-normal", fixtureId: "dashboard-dense", snapshotKind: "page", requiredAssertions: DEFAULT_ASSERTIONS },
  { surface: "dashboard-simulator", route: "/dashboard?section=simulator", state: "simulator-empty", fixtureId: "dashboard-empty", snapshotKind: "state", requiredAssertions: ["empty-state"] },
  { surface: "dashboard-simulator", route: "/dashboard?section=simulator", state: "simulator-error", fixtureId: "dashboard-error", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "dashboard-simulator", route: "/dashboard?section=simulator", state: "simulator-long-content", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["geometry"] },
  { surface: "dashboard-simulator", route: "/dashboard?section=simulator", state: "simulator-restricted-role", fixtureId: "dashboard-forbidden", snapshotKind: "state", requiredAssertions: ["readonly-or-hidden"] },
  { surface: "dashboard-ai-chat", route: "/dashboard/ai-chat", state: "ai-chat-normal", fixtureId: "dashboard-dense", snapshotKind: "page", requiredAssertions: DEFAULT_ASSERTIONS, critical: true },
  { surface: "dashboard-ai-chat", route: "/dashboard/ai-chat", state: "ai-chat-empty", fixtureId: "dashboard-empty", snapshotKind: "state", requiredAssertions: ["empty-state"] },
  { surface: "dashboard-ai-chat", route: "/dashboard/ai-chat", state: "ai-chat-error", fixtureId: "dashboard-error", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "dashboard-ai-chat", route: "/dashboard/ai-chat", state: "ai-chat-long-content", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["geometry"] },
  { surface: "dashboard-ai-chat", route: "/dashboard/ai-chat", state: "ai-chat-restricted-role", fixtureId: "dashboard-forbidden", snapshotKind: "state", requiredAssertions: ["readonly-or-hidden"] },
  { surface: "dashboard-voice", route: "/dashboard?section=voice", state: "voice-normal", fixtureId: "dashboard-dense", snapshotKind: "page", requiredAssertions: DEFAULT_ASSERTIONS },
  { surface: "dashboard-voice", route: "/dashboard?section=voice", state: "voice-empty", fixtureId: "dashboard-empty", snapshotKind: "state", requiredAssertions: ["empty-state"] },
  { surface: "dashboard-voice", route: "/dashboard?section=voice", state: "voice-error", fixtureId: "dashboard-error", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "dashboard-voice", route: "/dashboard?section=voice", state: "voice-long-content", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["geometry"] },
  { surface: "dashboard-voice", route: "/dashboard?section=voice", state: "voice-restricted-role", fixtureId: "dashboard-forbidden", snapshotKind: "state", requiredAssertions: ["readonly-or-hidden"] },
  { surface: "dashboard-forms-library", route: "/dashboard?section=forms", state: "forms-library-normal", fixtureId: "dashboard-dense", snapshotKind: "page", requiredAssertions: DEFAULT_ASSERTIONS },
  { surface: "dashboard-forms-library", route: "/dashboard?section=forms", state: "forms-library-empty", fixtureId: "dashboard-empty", snapshotKind: "state", requiredAssertions: ["empty-state"] },
  { surface: "dashboard-forms-library", route: "/dashboard?section=forms", state: "forms-library-error", fixtureId: "dashboard-error", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "dashboard-forms-library", route: "/dashboard?section=forms", state: "forms-library-long-content", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["geometry"] },
  { surface: "dashboard-forms-library", route: "/dashboard?section=forms", state: "forms-library-restricted-role", fixtureId: "dashboard-forbidden", snapshotKind: "state", requiredAssertions: ["readonly-or-hidden"] },
  { surface: "dashboard-settings", route: "/dashboard/settings", state: "settings-normal", fixtureId: "dashboard-dense", snapshotKind: "page", requiredAssertions: DEFAULT_ASSERTIONS, critical: true },
  { surface: "dashboard-settings", route: "/dashboard/settings", state: "settings-empty", fixtureId: "dashboard-empty", snapshotKind: "state", requiredAssertions: ["empty-or-defaults"] },
  { surface: "dashboard-settings", route: "/dashboard/settings", state: "settings-error", fixtureId: "dashboard-error", snapshotKind: "state", requiredAssertions: ["error-status"] },
  { surface: "dashboard-settings", route: "/dashboard/settings", state: "settings-long-content", fixtureId: "dashboard-dense", snapshotKind: "locator", requiredAssertions: ["geometry"] },
  { surface: "dashboard-settings", route: "/dashboard/settings", state: "settings-restricted-role", fixtureId: "dashboard-forbidden", snapshotKind: "state", requiredAssertions: ["readonly-or-hidden"] },
  { surface: "pwa", route: "/dashboard", state: "pwa-installed-shell", fixtureId: "pwa-fallback", snapshotKind: "page", requiredAssertions: ["pwa-shell"], critical: true },
  { surface: "pwa", route: "/dashboard", state: "pwa-offline-lock", fixtureId: "pwa-fallback", snapshotKind: "state", requiredAssertions: ["offline-blocker"] },
  { surface: "pwa", route: "/dashboard", state: "pwa-update", fixtureId: "pwa-fallback", snapshotKind: "state", requiredAssertions: ["update-banner-or-note"] },
];

const BROWSER_VIEWPORTS: Record<Stage7BrowserTier, { viewportTier: Stage7ViewportTier; project: string }> = {
  "chromium-desktop": { viewportTier: "desktop-1440", project: "stage-7-chromium-desktop" },
  "chromium-desktop-xl": { viewportTier: "desktop-1728", project: "stage-7-chromium-desktop-xl" },
  "chromium-tablet": { viewportTier: "tablet-768", project: "stage-7-chromium-tablet" },
  "chromium-android": { viewportTier: "android-390", project: "stage-7-chromium-android" },
  "chromium-reflow-320": { viewportTier: "reflow-320", project: "stage-7-chromium-reflow" },
  "chromium-mobile-landscape": { viewportTier: "mobile-landscape", project: "stage-7-chromium-landscape" },
  "webkit-iphone": { viewportTier: "iphone-390", project: "stage-7-webkit-iphone" },
  "webkit-ipad": { viewportTier: "ipad-pro-11", project: "stage-7-webkit-ipad" },
  "firefox-desktop": { viewportTier: "desktop-1440", project: "stage-7-firefox-desktop" },
};

function scenarioId(parts: string[]): string {
  return parts.join(".");
}

function makeScenario(seed: ScenarioSeed, overlay: {
  tenantRole: Stage7Role;
  locale: Stage7Locale;
  browserTier: Stage7BrowserTier;
  pwaMode?: Stage7PwaMode;
}): Stage7Scenario {
  const viewport = BROWSER_VIEWPORTS[overlay.browserTier];
  return parseStage7Scenario({
    id: scenarioId([seed.surface, seed.state, overlay.tenantRole, overlay.locale, overlay.browserTier]),
    surface: seed.surface,
    route: seed.route,
    state: seed.state,
    tenantRole: overlay.tenantRole,
    assignmentAccess: overlay.tenantRole === "auditor" ? "viewer" : "care_team",
    locale: overlay.locale,
    browserTier: overlay.browserTier,
    viewportTier: viewport.viewportTier,
    pwaMode: overlay.pwaMode ?? (seed.surface === "pwa" ? "service_worker_enabled" : "service_worker_blocked"),
    fixtureId: seed.fixtureId,
    requiredAssertions: seed.requiredAssertions,
    snapshotKind: seed.snapshotKind,
    accessibilityChecks: seed.accessibilityChecks ?? DEFAULT_A11Y,
    performanceEligible: Boolean(seed.performanceEligible),
  });
}

export function buildStage7Scenarios(): Stage7Scenario[] {
  const scenarios: Stage7Scenario[] = [];
  const seen = new Set<string>();
  const add = (scenario: Stage7Scenario) => {
    if (seen.has(scenario.id)) return;
    seen.add(scenario.id);
    scenarios.push(scenario);
  };

  for (const seed of CORE_SEEDS) {
    add(makeScenario(seed, { tenantRole: "dietitian", locale: "tr", browserTier: "chromium-desktop" }));
  }

  const criticalSeeds = CORE_SEEDS.filter((seed) => seed.critical);
  const pairwise = pairwiseCombinations({
    tenantRole: ["owner", "admin", "assistant", "auditor"],
    locale: ["en", "de", "pt", "es", "fr", "ar"],
    browserTier: ["chromium-android", "webkit-iphone", "firefox-desktop", "chromium-reflow-320"],
  });

  for (let index = 0; index < pairwise.length; index += 1) {
    const combo = pairwise[index] as {
      tenantRole: Stage7Role;
      locale: Stage7Locale;
      browserTier: Stage7BrowserTier;
    };
    const seed = criticalSeeds[index % criticalSeeds.length];
    add(makeScenario(seed, combo));
  }

  const extraBrowsers: Stage7BrowserTier[] = [
    "chromium-desktop-xl",
    "chromium-tablet",
    "chromium-mobile-landscape",
    "webkit-ipad",
  ];
  for (const browserTier of extraBrowsers) {
    for (const seed of criticalSeeds.slice(0, 8)) {
      add(makeScenario(seed, { tenantRole: "dietitian", locale: "tr", browserTier }));
    }
  }

  add(makeScenario(CORE_SEEDS.find((seed) => seed.state === "pwa-installed-shell")!, {
    tenantRole: "dietitian",
    locale: "tr",
    browserTier: "chromium-android",
    pwaMode: "service_worker_enabled",
  }));

  return scenarios;
}

export function scenariosForProject(projectName: string): Stage7Scenario[] {
  const scenarios = buildStage7Scenarios();
  if (projectName === "stage-7-pwa") {
    return scenarios.filter((scenario) => scenario.pwaMode === "service_worker_enabled");
  }
  return scenarios.filter((scenario) => BROWSER_VIEWPORTS[scenario.browserTier].project === projectName);
}

export function listMandatoryStates(): string[] {
  return CORE_SEEDS.map((seed) => `${seed.surface}:${seed.state}`);
}

export { CORE_SEEDS, BROWSER_VIEWPORTS };


