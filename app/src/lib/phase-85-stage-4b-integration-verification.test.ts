import { describe, expect, it } from "vitest";
import type { AppTenantContext } from "./auth-context";
import { createInitialState } from "./seed-data";
import {
  buildClinicalAlertsListResponse,
  buildSystemNotificationsListResponse,
  STAGE_4B_DEFAULT_PAGE_SIZE,
} from "./phase-85-stage-4b-api";
import {
  assertClinicalAlertListDtoSafety,
  assertSystemNotificationListDtoSafety,
  CLINICAL_ALERT_LIST_DTO_KEYS,
  createStage4BScaleState,
  evaluateStage4BBoundedInboxEvidence,
  evaluateStage4BDataGovernanceEvidence,
  PHASE_85_STAGE_4B_INTEGRATION_VERSION,
  runStage4BChannelIntegrationChecks,
  runStage4BIntegrationRehearsalFull,
  runStage4BIntegrationRehearsalSample,
  STAGE_4B_SCALE_TARGETS,
  STAGE_4B_SENSITIVE_DTO_PATTERNS,
  SYSTEM_NOTIFICATION_LIST_DTO_KEYS,
} from "./phase-85-stage-4b-integration-verification";
import { projectClinicalAlertsFromState } from "./phase-85-stage-4b-alerts";

const runFullScale = process.env.STAGE_4B_FULL_SCALE === "1";
const fullScaleIt = runFullScale ? it : it.skip;

function ownerContextFor(state: ReturnType<typeof createInitialState>): AppTenantContext {
  return {
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    userId: "user-owner",
    role: "owner",
  };
}

describe("phase 85 stage 4b integration verification", () => {
  it("enforces clinical alert list DTO allowlist on seed state", () => {
    const state = createInitialState();
    const response = buildClinicalAlertsListResponse(state, ownerContextFor(state), [], {
      generatedAt: "2026-07-12T12:00:00.000Z",
    });
    for (const item of response.items) {
      assertClinicalAlertListDtoSafety(item);
    }
    expect(CLINICAL_ALERT_LIST_DTO_KEYS).toHaveLength(16);
    expect(STAGE_4B_SENSITIVE_DTO_PATTERNS.test(JSON.stringify(response.items))).toBe(false);
  });

  it("enforces system notification list DTO allowlist on seed state", () => {
    const state = createInitialState();
    const response = buildSystemNotificationsListResponse(state, ownerContextFor(state), [], {
      status: "active",
      generatedAt: "2026-07-12T12:00:00.000Z",
    });
    for (const item of response.items) {
      assertSystemNotificationListDtoSafety(item);
    }
    expect(SYSTEM_NOTIFICATION_LIST_DTO_KEYS).toHaveLength(18);
    expect(STAGE_4B_SENSITIVE_DTO_PATTERNS.test(JSON.stringify(response.items))).toBe(false);
  });

  it("keeps bounded inbox pages on scale fixture without full-state fetch", () => {
    const state = createStage4BScaleState({ clientCount: 400, notificationCount: 1200 });
    const evidence = evaluateStage4BBoundedInboxEvidence(state);
    expect(evidence.ready).toBe(true);
    expect(evidence.failures).toEqual([]);
    expect(evidence.alertPageSize).toBeLessThanOrEqual(STAGE_4B_DEFAULT_PAGE_SIZE);
    expect(evidence.notificationPageSize).toBeLessThanOrEqual(STAGE_4B_DEFAULT_PAGE_SIZE);
    expect(evidence.alertFilteredTotal).toBeGreaterThan(0);
    expect(evidence.notificationFilteredTotal).toBeGreaterThan(STAGE_4B_DEFAULT_PAGE_SIZE);
  });

  it("projects active red and yellow alerts on scale fixture", () => {
    const state = createStage4BScaleState({ clientCount: 300, notificationCount: 600 });
    const projected = projectClinicalAlertsFromState(state, {
      now: "2026-07-12T12:00:00.000Z",
      visibleClientIds: new Set(state.clients.map((client) => client.id)),
    });
    expect(projected.some((alert) => alert.severity === "red")).toBe(true);
    expect(projected.some((alert) => alert.severity === "yellow")).toBe(true);
  });

  it("passes data governance checks on seed and scale fixtures", () => {
    const seedGovernance = evaluateStage4BDataGovernanceEvidence(createInitialState());
    const scaleState = createStage4BScaleState();
    const scaleGovernance = evaluateStage4BDataGovernanceEvidence(scaleState);
    expect(seedGovernance.ready).toBe(true);
    expect(scaleGovernance.ready).toBe(true);
    expect(seedGovernance.failures).toEqual([]);
    expect(scaleGovernance.failures).toEqual([]);
  });

  it("fails closed for assistant without client assignments on list APIs", () => {
    const state = createStage4BScaleState({ clientCount: 50, notificationCount: 80 });
    const assistantContext: AppTenantContext = {
      tenantId: state.tenant.id,
      dietitianId: "dietitian-assistant-unassigned",
      userId: "user-assistant",
      role: "assistant",
    };
    const alerts = buildClinicalAlertsListResponse(state, assistantContext, [], {});
    const notifications = buildSystemNotificationsListResponse(state, assistantContext, [], { status: "active" });
    expect(alerts.items).toEqual([]);
    expect(notifications.items).toEqual([]);
    expect(alerts.filteredTotal).toBe(0);
    expect(notifications.filteredTotal).toBe(0);
  });

  it("runs channel integration checks without provider calls", async () => {
    const channel = await runStage4BChannelIntegrationChecks();
    expect(channel.ready).toBe(true);
    expect(channel.failures).toEqual([]);
    expect(channel.safeReplyNotificationId).toBeTruthy();
    expect(channel.redAlertCount).toBeGreaterThan(0);
  });

  it("passes sample Stage 4B integration rehearsal", async () => {
    const metrics = await runStage4BIntegrationRehearsalSample();
    expect(metrics.phase).toBe(PHASE_85_STAGE_4B_INTEGRATION_VERSION);
    expect(metrics.status).toBe("pass");
    expect(metrics.production_pilot_go).toBe(false);
    expect(metrics.failures).toEqual([]);
    expect(metrics.client_count).toBeGreaterThan(0);
    expect(metrics.notification_count).toBeGreaterThan(0);
    expect(metrics.red_projection_count).toBeGreaterThan(0);
    expect(metrics.yellow_projection_count).toBeGreaterThan(0);
  });

  fullScaleIt(
    "runs full 5,000 client / 10,000 notification Stage 4B scale rehearsal",
    async () => {
      const metrics = await runStage4BIntegrationRehearsalFull();
      expect(metrics.status).toBe("pass");
      expect(metrics.client_count).toBe(STAGE_4B_SCALE_TARGETS.clientCount);
      expect(metrics.notification_count).toBe(STAGE_4B_SCALE_TARGETS.notificationCount);
      expect(metrics.alert_page_size).toBeLessThanOrEqual(STAGE_4B_SCALE_TARGETS.defaultPageSize);
      expect(metrics.notification_page_size).toBeLessThanOrEqual(STAGE_4B_SCALE_TARGETS.defaultPageSize);
      expect(metrics.red_projection_count).toBeGreaterThan(0);
      expect(metrics.yellow_projection_count).toBeGreaterThan(0);
      expect(metrics.failures).toEqual([]);
    },
    120_000,
  );
});
