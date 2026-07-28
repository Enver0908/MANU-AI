import type { CommercialEntitlementStatus } from "./phase-83b-commercial-entitlement-model";
import type { SupportedLanguageCode } from "./languages";
import type { TenantRole } from "./types";

export const PHASE_85_STAGE_4D_SETTINGS_CONTRACTS_VERSION = "p85-stage-4d-settings-contracts-v1";

export const SETTINGS_ROOT_PATH = "/dashboard/settings";

export const SETTINGS_TABS = [
  "profile",
  "security",
  "workspace",
  "billing",
  "application",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export type SettingsRuntimeMode = "configured" | "fallback";

export type SettingsAccountReadModel = {
  runtime: {
    mode: SettingsRuntimeMode;
    identityActionsAvailable: boolean;
    billingActionsAvailable: boolean;
    pwaActionsAvailable: boolean;
  };
  profile: {
    displayName: string;
    uiLanguage: SupportedLanguageCode;
  };
  security: {
    available: boolean;
    emailMasked: string | null;
    emailVerified: boolean | null;
    lastSignInAt: string | null;
  };
  workspace: {
    name: string;
    role: TenantRole | "member";
    membershipActive: boolean;
  };
  billing: {
    /** Owner/admin see subscription status; other roles only see workspace-access-active. */
    visibility: "subscription_status" | "workspace_access_active" | "unavailable";
    entitlementStatus: CommercialEntitlementStatus | null;
    workspaceAccessActive: boolean;
  };
  application: {
    available: boolean;
    installReady: boolean;
    installState: "ready" | "blocked" | "unavailable";
  };
};

const SETTINGS_TAB_SET = new Set<string>(SETTINGS_TABS);

export function resolveSettingsTab(value: string | null | undefined): SettingsTab {
  if (typeof value === "string" && SETTINGS_TAB_SET.has(value)) {
    return value as SettingsTab;
  }
  return "profile";
}

export function buildSettingsHref(tab: SettingsTab = "profile"): string {
  if (tab === "profile") {
    return SETTINGS_ROOT_PATH;
  }
  return `${SETTINGS_ROOT_PATH}?tab=${tab}`;
}

export function canViewSubscriptionStatus(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function maskEmailForSettings(email: string | null | undefined): string | null {
  const value = String(email || "").trim();
  if (!value || !value.includes("@")) {
    return null;
  }
  const [local, domain] = value.split("@");
  if (!local || !domain) {
    return null;
  }
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function projectBillingVisibility(input: {
  role: string | null | undefined;
  entitlementStatus: CommercialEntitlementStatus | null;
  mode: SettingsRuntimeMode;
}): SettingsAccountReadModel["billing"] {
  if (input.mode === "fallback") {
    return {
      visibility: "unavailable",
      entitlementStatus: null,
      workspaceAccessActive: false,
    };
  }

  const workspaceAccessActive = input.entitlementStatus === "active";
  if (canViewSubscriptionStatus(input.role)) {
    return {
      visibility: "subscription_status",
      entitlementStatus: input.entitlementStatus,
      workspaceAccessActive,
    };
  }

  return {
    visibility: "workspace_access_active",
    entitlementStatus: null,
    workspaceAccessActive,
  };
}

export function buildFallbackSettingsAccountReadModel(
  uiLanguage: SupportedLanguageCode = "tr",
): SettingsAccountReadModel {
  return {
    runtime: {
      mode: "fallback",
      identityActionsAvailable: false,
      billingActionsAvailable: false,
      pwaActionsAvailable: false,
    },
    profile: {
      displayName: "Demo Diyetisyen",
      uiLanguage,
    },
    security: {
      available: false,
      emailMasked: null,
      emailVerified: null,
      lastSignInAt: null,
    },
    workspace: {
      name: "Demo Çalışma Alanı",
      role: "dietitian",
      membershipActive: true,
    },
    billing: projectBillingVisibility({
      role: "dietitian",
      entitlementStatus: null,
      mode: "fallback",
    }),
    application: {
      available: false,
      installReady: false,
      installState: "unavailable",
    },
  };
}

export function assertSettingsReadModelHasNoInternalIds(model: SettingsAccountReadModel): void {
  const serialized = JSON.stringify(model);
  const forbidden = [
    /"tenantId"/i,
    /"userId"/i,
    /"dietitianId"/i,
    /"membershipId"/i,
    /"stripeCustomerId"/i,
    /"stripeSubscriptionId"/i,
    /"auth_user_id"/i,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(serialized)) {
      throw new Error(`settings_read_model_leaked_internal_id:${pattern.source}`);
    }
  }
}
