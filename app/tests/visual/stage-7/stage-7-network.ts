import type { BrowserContext, Page } from "@playwright/test";
import { STAGE7_CLIENTS, STAGE7_SYNTHETIC, type Stage7FixtureProfile } from "./stage-7-fixtures";

const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost"]);

export type Stage7NetworkSession = {
  blockedExternal: string[];
  escapedExternal: string[];
  unhandledLocalApi: string[];
};

function json(route: { fulfill: (info: { status: number; contentType: string; body: string }) => Promise<void> }, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function fixtureStatus(profile: Stage7FixtureProfile, path: string): number | null {
  if (profile === "auth-invalid" && path.includes("/api/auth/")) return 422;
  if (profile === "auth-rate-limited" && path.includes("/api/auth/")) return 429;
  if (profile === "auth-service-error" && path.includes("/api/")) return 500;
  if (profile === "admin-unauthorized" && path.includes("/api/")) return 401;
  if ((profile === "admin-non-allowlisted" || profile === "dashboard-forbidden" || profile.includes("ineligible") || profile.includes("revoked")) && path.includes("/api/")) {
    return 403;
  }
  if (profile.includes("error") && path.includes("/api/")) return 500;
  if (profile === "dashboard-conflict" && /\/api\/(clients|app-state)/.test(path)) return 409;
  if ((profile.includes("invalid") || profile.includes("expired") || profile.includes("consumed") || profile.includes("duplicate")) && path.includes("/api/")) {
    return 422;
  }
  if (path.includes("missing") || path.includes("stage7-missing")) return 404;
  return null;
}

function appStatePayload(profile: Stage7FixtureProfile): unknown {
  if (profile === "dashboard-empty") return { clients: [], conversations: [], alerts: [], notifications: [] };
  return {
    clients: STAGE7_CLIENTS,
    conversations: STAGE7_CLIENTS.map((client) => ({ id: `conversation-${client.id}`, clientId: client.id })),
    alerts: [],
    notifications: [],
  };
}

function payloadFor(profile: Stage7FixtureProfile, path: string): unknown | null {
  if (path.includes("/api/contact/leads")) {
    if (profile === "public-default") return { accepted: true };
    return { error: "contact_failed" };
  }
  if (path.includes("/api/auth/")) {
    if (profile === "auth-sent") return { sent: true };
    if (profile === "auth-invalid") return { sent: false, error: "invalid_email" };
    if (profile === "auth-rate-limited") return { error: "rate_limited" };
    if (profile === "auth-service-error") return { error: "service_unavailable" };
  }
  if (path.includes("/api/commercial/invite-status") || path.includes("/api/commercial/checkout")) {
    if (profile === "purchase-valid") return { eligible: true, normalizedEmail: STAGE7_SYNTHETIC.dietitianEmail };
    if (profile === "purchase-invalid") return { eligible: false, blockingReasons: ["invite not found"] };
    if (profile === "purchase-expired") return { eligible: false, blockingReasons: ["expired"] };
    if (profile === "purchase-consumed") return { eligible: false, blockingReasons: ["status must be active"] };
    if (profile === "purchase-pending") return { eligible: false, blockingReasons: ["pending review"] };
  }
  if (path.includes("/api/commercial/onboarding/status")) {
    if (profile === "onboarding-claimable") return { authenticated: true, claimable: true, alreadyClaimed: false };
    if (profile === "onboarding-incomplete") return { authenticated: true, claimable: false, blockingReasons: ["profile_incomplete"] };
    if (profile === "onboarding-duplicate") return { authenticated: true, claimable: false, alreadyClaimed: false, blockingReasons: ["duplicate_claim"] };
    if (profile === "onboarding-already-claimed") return { authenticated: true, claimable: false, alreadyClaimed: true };
    if (profile === "onboarding-pending") return { authenticated: true, claimable: false, blockingReasons: ["pending"] };
    if (profile === "onboarding-error") return { error: "onboarding_status_failed" };
  }
  if (path.includes("/api/auth-state")) {
    return { authenticated: true, hasMembership: true, hasDietitianProfile: true, hasActiveEntitlement: true };
  }
  if (path.includes("/api/demo-login") || path.includes("/api/demo-logout") || path.includes("/api/session/activity")) {
    return { ok: true };
  }
  if (path.includes("/api/shell/bootstrap")) {
    return {
      tenantId: STAGE7_SYNTHETIC.tenantId,
      actor: { id: "actor-stage7", role: "dietitian" },
      clients: STAGE7_CLIENTS,
    };
  }
  if (path.includes("/api/shell/clients")) {
    return { clients: STAGE7_CLIENTS };
  }
  if (path.includes("/api/shell/version")) {
    return { version: "stage7", updateAvailable: false };
  }
  if (path.includes("/api/shell/preferences")) {
    return { compactMode: true, locale: "tr" };
  }
  if (path.includes("/api/app-state")) {
    return appStatePayload(profile);
  }
  if (path.includes("/api/clients")) {
    return appStatePayload(profile);
  }
  if (path.includes("/api/conversations")) {
    return { conversations: STAGE7_CLIENTS.map((client) => ({ id: `conversation-${client.id}`, clientId: client.id })), messages: [] };
  }
  if (path.includes("/api/messages")) {
    return { messages: [], draft: null };
  }
  if (path.includes("/api/alerts")) {
    return { alerts: [] };
  }
  if (path.includes("/api/notifications")) {
    return { notifications: [] };
  }
  if (path.includes("/api/account/")) {
    return { tenantId: STAGE7_SYNTHETIC.tenantId, members: [], profile: { email: STAGE7_SYNTHETIC.dietitianEmail } };
  }
  if (path.includes("/api/client-form-schemas")) {
    return { schemas: [] };
  }
  if (path.includes("/api/dietitian/")) {
    return { ok: true, preferences: {}, samples: [] };
  }
  if (path.includes("/api/ai-chat/")) {
    return { conversations: [], messages: [], runs: [], attachments: [] };
  }
  if (path.includes("/api/simulator")) {
    return { ok: true, result: "synthetic" };
  }
  if (path.includes("/api/internal-copilot/")) {
    return { messages: [] };
  }
  return null;
}

export function resolveStage7ApiFixture(
  profile: Stage7FixtureProfile,
  path: string,
): { status: number; body: unknown } | null {
  const status = fixtureStatus(profile, path);
  if (status) {
    return { status, body: payloadFor(profile, path) };
  }
  const body = payloadFor(profile, path);
  if (body === null) return null;
  return { status: 200, body };
}

export async function installStage7NetworkGuard(
  context: BrowserContext,
  options: { allowedOrigin: string; fixtureId: Stage7FixtureProfile; mockApi: boolean },
): Promise<Stage7NetworkSession> {
  const allowedOrigin = new URL(options.allowedOrigin);
  const session: Stage7NetworkSession = { blockedExternal: [], escapedExternal: [], unhandledLocalApi: [] };

  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isAllowedHost = ALLOWED_HOSTS.has(url.hostname) && (url.port === allowedOrigin.port || url.port === "");
    if (!isAllowedHost) {
      session.blockedExternal.push(request.url());
      await route.abort("blockedbyclient");
      return;
    }

    if (options.mockApi && url.pathname.startsWith("/api/")) {
      if (options.fixtureId === "dashboard-dense" && url.pathname.includes("/api/app-state") && request.method() === "GET") {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const fixture = resolveStage7ApiFixture(options.fixtureId, url.pathname);
      if (fixture) {
        return json(route, fixture.status, fixture.body);
      }
      session.unhandledLocalApi.push(`${request.method()} ${url.pathname}`);
      return json(route, 599, { error: "stage7_unhandled_local_api", path: url.pathname });
    }
    return route.continue();
  });

  context.on("requestfinished", (request) => {
    const url = new URL(request.url());
    if (!ALLOWED_HOSTS.has(url.hostname)) {
      session.escapedExternal.push(request.url());
    }
  });

  return session;
}

export async function delayNextApiCall(page: Page, match: string, delayMs: number) {
  await page.route(`**${match}`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}
