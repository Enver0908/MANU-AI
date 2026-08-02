import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildShellHomeActions,
  buildShellNavigation,
  collectForbiddenShellResponseKeys,
  compareShellVersions,
  formatShellBadgeDisplayCount,
  parseShellActiveClientIdParam,
  parseShellClientSearchQuery,
  parseShellPreferencesPatchBody,
  PHASE_85_STAGE_5_SHELL_CONTRACT_VERSION,
  resolveShellCapabilities,
  SHELL_API_RATE_LIMITS,
  SHELL_BOOTSTRAP_MAX_PAYLOAD_BYTES,
  SHELL_CLIENT_SEARCH_DEBOUNCE_MS,
  SHELL_COMPACT_BOTTOM_NAV_IDS,
  SHELL_DESTINATION_IDS,
  ShellApiError,
} from "./phase-85-stage-5-shell-contracts";
import { SHELL_API_NO_STORE_HEADERS } from "./phase-85-stage-5-shell-api";
import { resolveShellVersion } from "./phase-85-stage-5-shell-store";

const faz3MigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260802120000_phase_85_stage_5_shell_api_foundation.sql",
);

describe("phase-85-stage-5-shell-contracts", () => {
  it("locks destination ids and compact bottom nav contract", () => {
    expect(SHELL_DESTINATION_IDS).toEqual([
      "home",
      "clients",
      "messages",
      "alerts",
      "notifications",
      "simulator",
      "voice",
      "forms",
      "ai_chat",
      "settings",
      "more",
    ]);
    expect(SHELL_COMPACT_BOTTOM_NAV_IDS).toEqual(["home", "clients", "messages", "alerts", "more"]);
    expect(PHASE_85_STAGE_5_SHELL_CONTRACT_VERSION).toBe("p85-stage-5-shell-v1");
  });

  it("validates bootstrap and search query parsers", () => {
    expect(parseShellActiveClientIdParam("00000000-0000-4000-8000-000000000001")).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(() => parseShellActiveClientIdParam("not-a-uuid")).toThrow(
      new ShellApiError(400, "invalid_active_client_id"),
    );
    expect(parseShellClientSearchQuery(null)).toBeNull();
    expect(() => parseShellClientSearchQuery("a")).toThrow(new ShellApiError(400, "invalid_search_query"));
    expect(parseShellClientSearchQuery("ab")).toBe("ab");
  });

  it("requires requestId and expectedRevision for preferences patch", () => {
    expect(() => parseShellPreferencesPatchBody({})).toThrow(
      new ShellApiError(400, "invalid_request_id"),
    );
    expect(() =>
      parseShellPreferencesPatchBody({
        requestId: "req-12345678",
        expectedRevision: 0,
      }),
    ).toThrow(new ShellApiError(400, "preferences_patch_empty"));

    const patch = parseShellPreferencesPatchBody({
      requestId: "req-12345678",
      expectedRevision: 2,
      lastDestinationId: "messages",
    });
    expect(patch.expectedRevision).toBe(2);
    expect(patch.lastDestinationId).toBe("messages");
  });

  it("projects role-aware navigation and fixed-order home actions", () => {
    const badgeCounts = { alerts: 3, handoffs: 1, messages: 5, notifications: 2 };
    const navigation = buildShellNavigation("dietitian", badgeCounts);
    expect(navigation.find((item) => item.id === "messages")?.badgeCount).toBe(5);
    expect(navigation.find((item) => item.id === "ai_chat")?.enabled).toBe(false);

    const homeActions = buildShellHomeActions({
      badgeCounts,
      lastDestinationId: "clients",
      role: "dietitian",
    });
    expect(homeActions.map((action) => action.id)).toEqual([
      "alerts",
      "handoffs",
      "messages",
      "notifications",
      "resume_last_work",
    ]);
    expect(homeActions[0]?.destinationId).toBe("alerts");
    expect(homeActions[4]?.destinationId).toBe("clients");
  });

  it("limits assistant capabilities and disables auditor messages", () => {
    expect(resolveShellCapabilities("assistant")).toEqual(["read_app_state"]);
    const navigation = buildShellNavigation("auditor", {
      alerts: 0,
      handoffs: 0,
      messages: 4,
      notifications: 0,
    });
    expect(navigation.find((item) => item.id === "messages")).toMatchObject({
      enabled: false,
      disabledReason: "conversation_read_forbidden",
    });
  });

  it("compares client versions and formats badge display counts", () => {
    expect(compareShellVersions("1.2.0", "1.1.9")).toBe(1);
    expect(compareShellVersions("1.0.0", "1.0.1")).toBe(-1);
    expect(formatShellBadgeDisplayCount(120)).toBe("99+");
    expect(formatShellBadgeDisplayCount(12)).toBe("12");
  });

  it("exposes shell rate limits and search debounce contract", () => {
    expect(SHELL_API_RATE_LIMITS.bootstrap.limit).toBe(60);
    expect(SHELL_API_RATE_LIMITS.preferences.limit).toBe(30);
    expect(SHELL_API_RATE_LIMITS.sessionActivity.limit).toBe(12);
    expect(SHELL_API_RATE_LIMITS.clientSearch.limit).toBe(30);
    expect(SHELL_CLIENT_SEARCH_DEBOUNCE_MS).toBe(250);
  });

  it("keeps bootstrap fixture under 20 KB and free of forbidden PHI keys", () => {
    const fixture = {
      contractVersion: PHASE_85_STAGE_5_SHELL_CONTRACT_VERSION,
      displayName: "Dyt. Ada",
      uiLanguage: "tr",
      timezone: "Europe/Istanbul",
      role: "dietitian",
      capabilities: resolveShellCapabilities("dietitian"),
      navigation: buildShellNavigation("dietitian", {
        alerts: 2,
        handoffs: 1,
        messages: 4,
        notifications: 1,
      }),
      badgeCounts: { alerts: 2, handoffs: 1, messages: 4, notifications: 1 },
      homeActions: buildShellHomeActions({
        badgeCounts: { alerts: 2, handoffs: 1, messages: 4, notifications: 1 },
        lastDestinationId: "messages",
        role: "dietitian",
      }),
      activeClient: {
        id: "00000000-0000-4000-8000-000000000099",
        fullName: "Test Client",
        referenceShort: "01234567",
        riskLevel: "green",
        handoffState: "none",
        channelReadiness: "ready",
        aiMode: "copilot",
      },
      preferences: {
        revision: 1,
        activeClientId: "00000000-0000-4000-8000-000000000099",
        lastDestinationId: "messages",
        destinationState: {},
      },
      warnings: [],
      sessionExpiresAt: new Date().toISOString(),
    };

    const payload = Buffer.byteLength(JSON.stringify(fixture), "utf8");
    expect(payload).toBeLessThanOrEqual(SHELL_BOOTSTRAP_MAX_PAYLOAD_BYTES);
    expect(collectForbiddenShellResponseKeys(fixture)).toEqual([]);
  });

  it("resolves shell version contract from env defaults", () => {
    const version = resolveShellVersion("0.0.0-stage5");
    expect(version.updateRequired).toBe(false);
    expect(version.contractVersion).toBe(PHASE_85_STAGE_5_SHELL_CONTRACT_VERSION);
  });

  it("uses no-store cache headers for shell API responses", () => {
    expect(SHELL_API_NO_STORE_HEADERS["Cache-Control"]).toBe("no-store");
  });
});

describe("phase-85-stage-5-shell-api migration contract", () => {
  const sql = readFileSync(faz3MigrationPath, "utf8");

  it("defines bootstrap and client search RPCs with shell rate-limit scopes", () => {
    expect(sql).toContain("p85_stage_5_load_shell_bootstrap_v1");
    expect(sql).toContain("p85_stage_5_search_shell_clients_v1");
    expect(sql).toContain("p85_stage_5_project_shell_active_client_v1");
    expect(sql).toContain("'shell_bootstrap'");
    expect(sql).toContain("'shell_client_search'");
    expect(sql).toContain("shell_bootstrap_unavailable");
  });
});
