"use client";

import { languageLabel } from "@/lib/languages";
import type { SupportedLanguageCode } from "@/lib/languages";
import type { DashboardMessageKey } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { SettingsAccountReadModel, SettingsTab } from "@/lib/phase-85-stage-4d-settings-contracts";
import { SettingsProfileForm } from "@/components/settings/settings-profile-form";
import { SettingsSecurityForm } from "@/components/settings/settings-security-form";
import { Card, CardBody, CardHeader } from "@/components/ui";

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-b border-line py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-sm font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-ink sm:text-right">{value}</dd>
    </div>
  );
}

function roleLabel(uiLanguage: SupportedLanguageCode, role: SettingsAccountReadModel["workspace"]["role"]) {
  const key = `settingsRole_${role}` as DashboardMessageKey;
  return t(uiLanguage, key);
}

function entitlementLabel(
  uiLanguage: SupportedLanguageCode,
  status: SettingsAccountReadModel["billing"]["entitlementStatus"],
) {
  if (!status) {
    return t(uiLanguage, "settingsEntitlement_unknown");
  }
  const key = `settingsEntitlement_${status}` as DashboardMessageKey;
  return t(uiLanguage, key);
}

function formatTimestamp(uiLanguage: SupportedLanguageCode, value: string | null) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(uiLanguage, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function SettingsProfileSection({
  model,
  uiLanguage,
}: {
  model: SettingsAccountReadModel;
  uiLanguage: SupportedLanguageCode;
}) {
  const editable = model.runtime.mode === "configured" && model.runtime.identityActionsAvailable;

  return (
    <div data-testid="settings-section-profile">
      <Card>
        <CardHeader
          title={t(uiLanguage, "settingsProfileHeading")}
          description={
            editable ? t(uiLanguage, "settingsProfileEditableHint") : t(uiLanguage, "settingsProfileReadOnlyHint")
          }
        />
        <CardBody>
          {editable ? (
            <SettingsProfileForm
              key={`${model.profile.displayName}:${model.profile.uiLanguage}`}
              model={model}
              uiLanguage={uiLanguage}
            />
          ) : (
            <dl>
              <FactRow label={t(uiLanguage, "settingsProfileDisplayName")} value={model.profile.displayName} />
              <FactRow
                label={t(uiLanguage, "settingsProfileLanguage")}
                value={languageLabel(model.profile.uiLanguage)}
              />
            </dl>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export function SettingsSecuritySection({
  model,
  uiLanguage,
}: {
  model: SettingsAccountReadModel;
  uiLanguage: SupportedLanguageCode;
}) {
  const editable = model.runtime.mode === "configured" && model.runtime.identityActionsAvailable;

  return (
    <div data-testid="settings-section-security">
      <Card>
        <CardHeader
          title={t(uiLanguage, "settingsSecurityHeading")}
          description={
            editable ? t(uiLanguage, "settingsSecurityEditableHint") : t(uiLanguage, "settingsSecurityReadOnlyHint")
          }
        />
        <CardBody>
          {!model.security.available ? (
            <p className="text-sm leading-6 text-ink-muted" role="status">
              {t(uiLanguage, "settingsSecurityUnavailable")}
            </p>
          ) : editable ? (
            <SettingsSecurityForm model={model} uiLanguage={uiLanguage} />
          ) : (
            <dl>
              <FactRow label={t(uiLanguage, "settingsSecurityEmail")} value={model.security.emailMasked || "—"} />
              <FactRow
                label={t(uiLanguage, "settingsSecurityVerified")}
                value={
                  model.security.emailVerified
                    ? t(uiLanguage, "settingsSecurityVerified")
                    : t(uiLanguage, "settingsSecurityUnverified")
                }
              />
              <FactRow
                label={t(uiLanguage, "settingsSecurityLastSignIn")}
                value={formatTimestamp(uiLanguage, model.security.lastSignInAt)}
              />
            </dl>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export function SettingsWorkspaceSection({
  model,
  uiLanguage,
}: {
  model: SettingsAccountReadModel;
  uiLanguage: SupportedLanguageCode;
}) {
  return (
    <div data-testid="settings-section-workspace">
      <Card>
        <CardHeader title={t(uiLanguage, "settingsWorkspaceHeading")} description={t(uiLanguage, "settingsWorkspaceReadOnlyHint")} />
        <CardBody>
          <dl>
            <FactRow label={t(uiLanguage, "settingsWorkspaceName")} value={model.workspace.name} />
            <FactRow label={t(uiLanguage, "settingsWorkspaceRole")} value={roleLabel(uiLanguage, model.workspace.role)} />
            <FactRow
              label={t(uiLanguage, "settingsWorkspaceMembershipActive")}
              value={
                model.workspace.membershipActive
                  ? t(uiLanguage, "settingsWorkspaceMembershipActive")
                  : t(uiLanguage, "settingsWorkspaceMembershipInactive")
              }
            />
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

export function SettingsBillingSection({
  model,
  uiLanguage,
}: {
  model: SettingsAccountReadModel;
  uiLanguage: SupportedLanguageCode;
}) {
  let body: string;
  if (model.billing.visibility === "unavailable") {
    body = t(uiLanguage, "settingsBillingUnavailable");
  } else if (model.billing.visibility === "subscription_status") {
    body = `${t(uiLanguage, "settingsBillingStatus")}: ${entitlementLabel(uiLanguage, model.billing.entitlementStatus)}`;
  } else {
    body = model.billing.workspaceAccessActive
      ? t(uiLanguage, "settingsBillingWorkspaceAccessActive")
      : t(uiLanguage, "settingsBillingWorkspaceAccessInactive");
  }

  return (
    <div data-testid="settings-section-billing">
      <Card>
        <CardHeader title={t(uiLanguage, "settingsBillingHeading")} description={t(uiLanguage, "settingsBillingReadOnlyHint")} />
        <CardBody>
          <p className="text-sm leading-6 text-ink" role="status">
            {body}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

export function SettingsApplicationSection({
  model,
  uiLanguage,
}: {
  model: SettingsAccountReadModel;
  uiLanguage: SupportedLanguageCode;
}) {
  let body: string;
  if (!model.application.available || model.application.installState === "unavailable") {
    body = t(uiLanguage, "settingsApplicationUnavailable");
  } else if (model.application.installReady) {
    body = t(uiLanguage, "settingsApplicationInstallReady");
  } else {
    body = t(uiLanguage, "settingsApplicationInstallBlocked");
  }

  return (
    <div data-testid="settings-section-application">
      <Card>
        <CardHeader
          title={t(uiLanguage, "settingsApplicationHeading")}
          description={t(uiLanguage, "settingsApplicationReadOnlyHint")}
        />
        <CardBody>
          <p className="text-sm leading-6 text-ink" role="status">
            {body}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

export function SettingsActiveSection({
  tab,
  model,
  uiLanguage,
}: {
  tab: SettingsTab;
  model: SettingsAccountReadModel;
  uiLanguage: SupportedLanguageCode;
}) {
  switch (tab) {
    case "security":
      return <SettingsSecuritySection model={model} uiLanguage={uiLanguage} />;
    case "workspace":
      return <SettingsWorkspaceSection model={model} uiLanguage={uiLanguage} />;
    case "billing":
      return <SettingsBillingSection model={model} uiLanguage={uiLanguage} />;
    case "application":
      return <SettingsApplicationSection model={model} uiLanguage={uiLanguage} />;
    case "profile":
    default:
      return <SettingsProfileSection model={model} uiLanguage={uiLanguage} />;
  }
}
