"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  KeyRound,
  MessageSquare,
  RefreshCw,
  ScrollText,
  Shield,
  UserPlus,
  UserX,
} from "lucide-react";
import { Button, Card, CardBody, CardHeader, Field, TextInput } from "@/components/ui";
import type {
  CommercialAdminAuditListItem,
  CommercialOnboardingAuditListItem,
} from "@/lib/commercial-admin-store";
import type {
  CommercialAdminInviteListItem,
  CommercialAdminLedgerListItem,
  CommercialAdminSubscriptionSummary,
} from "@/lib/phase-83f-commercial-admin";
import type { CommercialLeadListItem } from "@/lib/phase-84c-contact-leads";
import {
  canAdminCancelStripeSubscription,
  canAdminRevokeAppAccess,
  describeCommercialBlockingReason,
  describeEntitlementStatusLabel,
} from "@/lib/phase-84g-subscription-operations";
import { authenticatedMutationFetch } from "@/lib/phase-85-stage-5-shell-authenticated-mutation";

type AdminView = "blocked" | "login" | "console";

type CommercialAdminConsoleVariant = "session" | "token";

type CreatedInviteResult = {
  invite: CommercialAdminInviteListItem;
  inviteToken: string;
};

type CommercialAdminHealthPayload = {
  healthy?: boolean;
  status?: string;
  blockingReasons?: string[];
  devFallbackStore?: boolean;
  supabaseUrlConfigured?: boolean;
  serviceRoleConfigured?: boolean;
  stripeSandboxConfigured?: boolean;
};

function buildAdminHeaders(token?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function summarizeAdminHealth(payload: CommercialAdminHealthPayload | null) {
  if (!payload) {
    return "commercial_admin_health_unavailable";
  }

  const reasons = payload.blockingReasons ?? [];
  if (reasons.some((reason) => reason.includes("supabase_project_unreachable"))) {
    return "Supabase project host is unreachable. Check NEXT_PUBLIC_SUPABASE_URL, project status, DNS, and VPS/network egress.";
  }
  if (reasons.some((reason) => reason.includes("commercial_admin_migrations_pending"))) {
    return "Commercial admin tables are missing. Apply app/supabase/migrations before using this panel.";
  }
  if (reasons.some((reason) => reason.includes("supabase_service_role_invalid"))) {
    return "Supabase service role key is invalid or does not have admin access. Rotate/update SUPABASE_SERVICE_ROLE_KEY.";
  }
  if (reasons.includes("supabase_url_missing") || reasons.includes("supabase_service_role_missing")) {
    return "Supabase admin environment is incomplete. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.";
  }
  if (payload.devFallbackStore) {
    return "MANU_DEV_FALLBACK_STORE=true is enabled, but commercial admin requires a reachable Supabase admin store.";
  }

  return reasons[0] ?? "commercial_admin_store_unhealthy";
}

export function CommercialAdminConsole(props: {
  initiallyConfigured: boolean;
  variant?: CommercialAdminConsoleVariant;
  sessionEmail?: string | null;
}) {
  const variant = props.variant ?? "token";
  const isSessionMode = variant === "session";
  const [view, setView] = useState<AdminView>(() => {
    if (isSessionMode) {
      return props.sessionEmail ? "console" : "blocked";
    }
    return props.initiallyConfigured ? "login" : "blocked";
  });
  const [adminToken, setAdminToken] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(() => isSessionMode && Boolean(props.sessionEmail));
  const [error, setError] = useState<string | null>(null);
  const [healthSummary, setHealthSummary] = useState<string | null>(null);
  const [healthPayload, setHealthPayload] = useState<CommercialAdminHealthPayload | null>(null);
  const [invites, setInvites] = useState<CommercialAdminInviteListItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<CommercialAdminSubscriptionSummary[]>([]);
  const [ledger, setLedger] = useState<CommercialAdminLedgerListItem[]>([]);
  const [leads, setLeads] = useState<CommercialLeadListItem[]>([]);
  const [adminAudit, setAdminAudit] = useState<CommercialAdminAuditListItem[]>([]);
  const [onboardingAudit, setOnboardingAudit] = useState<CommercialOnboardingAuditListItem[]>([]);
  const [createdInvite, setCreatedInvite] = useState<CreatedInviteResult | null>(null);
  const [pendingRevokeTenantId, setPendingRevokeTenantId] = useState<string | null>(null);
  const [pendingCancelTenantId, setPendingCancelTenantId] = useState<string | null>(null);

  const [createEmail, setCreateEmail] = useState("");
  const [createTenantName, setCreateTenantName] = useState("");
  const [createInviteToken, setCreateInviteToken] = useState("");
  const [createExpiresAt, setCreateExpiresAt] = useState("");
  const [manualInviteId, setManualInviteId] = useState("");
  const [manualAction, setManualAction] = useState<"activate" | "renew">("activate");
  const [manualPaymentReference, setManualPaymentReference] = useState("");
  const [manualPaidThrough, setManualPaidThrough] = useState("");
  const [manualRequestId, setManualRequestId] = useState("");

  const activeToken = isSessionMode ? null : sessionToken;
  const canOperate = isSessionMode || Boolean(activeToken);
  const stripeSandboxConfigured = Boolean(healthPayload?.stripeSandboxConfigured);
  const requestHeaders = useCallback(
    () => buildAdminHeaders(isSessionMode ? null : activeToken),
    [activeToken, isSessionMode],
  );

  const loadHealthSummary = useCallback(async (token?: string | null) => {
    const response = await fetch("/api/commercial/admin/health", { headers: buildAdminHeaders(token) });
    const payload = (await response.json().catch(() => null)) as CommercialAdminHealthPayload | null;
    setHealthPayload(payload);
    return summarizeAdminHealth(payload);
  }, []);

  const loadOperations = useCallback(
    async (token?: string | null) => {
      const headers = buildAdminHeaders(token);
      const [inviteRes, subscriptionRes, ledgerRes, leadsRes, auditRes, healthRes] = await Promise.all([
        fetch("/api/commercial/admin/invites", { headers }),
        fetch("/api/commercial/admin/subscriptions", { headers }),
        fetch("/api/commercial/admin/ledger?limit=25", { headers }),
        fetch("/api/commercial/admin/leads?limit=50", { headers }),
        fetch("/api/commercial/admin/audit?limit=50", { headers }),
        fetch("/api/commercial/admin/health", { headers }),
      ]);

      const invitePayload = await inviteRes.json().catch(() => ({}));
      const subscriptionPayload = await subscriptionRes.json().catch(() => ({}));
      const ledgerPayload = await ledgerRes.json().catch(() => ({}));
      const leadsPayload = await leadsRes.json().catch(() => ({}));
      const auditPayload = await auditRes.json().catch(() => ({}));
      const healthJson = (await healthRes.json().catch(() => null)) as CommercialAdminHealthPayload | null;
      setHealthPayload(healthJson);

      if (!inviteRes.ok || !subscriptionRes.ok || !ledgerRes.ok || !leadsRes.ok || !auditRes.ok) {
        const blockingReasons = [
          ...(invitePayload.blockingReasons ?? []),
          ...(subscriptionPayload.blockingReasons ?? []),
          ...(ledgerPayload.blockingReasons ?? []),
          ...(leadsPayload.blockingReasons ?? []),
          ...(auditPayload.blockingReasons ?? []),
        ];
        throw new Error(
          blockingReasons[0] ??
            invitePayload.error ??
            subscriptionPayload.error ??
            ledgerPayload.error ??
            leadsPayload.error ??
            auditPayload.error ??
            "commercial_admin_load_failed",
        );
      }

      setInvites(invitePayload.invites ?? []);
      setSubscriptions(subscriptionPayload.subscriptions ?? []);
      setLedger(ledgerPayload.entries ?? []);
      setLeads(leadsPayload.leads ?? []);
      setAdminAudit(auditPayload.adminAudit ?? []);
      setOnboardingAudit(auditPayload.onboardingAudit ?? []);
    },
    [],
  );

  useEffect(() => {
    if (!isSessionMode || !props.sessionEmail) {
      return;
    }
    let cancelled = false;
    // Session console hydrates operation data after allowlist auth on mount.
    void loadOperations()
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "commercial_admin_load_failed");
        void loadHealthSummary().then((summary) => {
          if (!cancelled) {
            setHealthSummary(summary);
          }
        });
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isSessionMode, props.sessionEmail, loadOperations, loadHealthSummary]);

  async function onConnect(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setHealthSummary(null);
    setBusy(true);
    try {
      await loadOperations(adminToken.trim());
      setSessionToken(adminToken.trim());
      setView("console");
      setAdminToken("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "commercial_admin_login_failed");
      setHealthSummary(await loadHealthSummary(adminToken.trim()).catch(() => "commercial_admin_health_unavailable"));
    } finally {
      setBusy(false);
    }
  }

  async function onRefresh() {
    if (!canOperate) {
      return;
    }
    setError(null);
    setHealthSummary(null);
    setBusy(true);
    try {
      await loadOperations(activeToken);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "commercial_admin_refresh_failed");
      setHealthSummary(await loadHealthSummary(activeToken).catch(() => "commercial_admin_health_unavailable"));
    } finally {
      setBusy(false);
    }
  }

  async function onCreateInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!canOperate) {
      return;
    }
    setError(null);
    setBusy(true);
    setCreatedInvite(null);
    try {
      const response = await authenticatedMutationFetch("/api/commercial/admin/invites", {
        method: "POST",
        mutationKind: "other",
        headers: requestHeaders(),
        body: JSON.stringify({
          email: createEmail.trim(),
          tenantName: createTenantName.trim() || undefined,
          inviteToken: createInviteToken.trim() || undefined,
          expiresAt: createExpiresAt.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "invite_create_failed");
      }
      setCreatedInvite(payload as CreatedInviteResult);
      setCreateEmail("");
      setCreateTenantName("");
      setCreateInviteToken("");
      setCreateExpiresAt("");
      await loadOperations(activeToken);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "invite_create_failed");
    } finally {
      setBusy(false);
    }
  }

  async function onApplyManualEntitlement(event: React.FormEvent) {
    event.preventDefault();
    if (!canOperate) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const response = await authenticatedMutationFetch("/api/commercial/admin/manual-entitlements", {
        method: "POST",
        mutationKind: "other",
        headers: requestHeaders(),
        body: JSON.stringify({
          action: manualAction,
          inviteId: manualInviteId.trim(),
          paymentReference: manualPaymentReference.trim(),
          paidThrough: manualPaidThrough.trim(),
          requestId: manualRequestId.trim() || `manual-${crypto.randomUUID()}`,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "manual_entitlement_failed");
      }
      setManualInviteId("");
      setManualPaymentReference("");
      setManualPaidThrough("");
      setManualRequestId("");
      await loadOperations(activeToken);
    } catch (manualError) {
      setError(manualError instanceof Error ? manualError.message : "manual_entitlement_failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRevokeInvite(inviteId: string) {
    if (!canOperate) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const response = await authenticatedMutationFetch("/api/commercial/admin/invites", {
        method: "PATCH",
        mutationKind: "other",
        headers: requestHeaders(),
        body: JSON.stringify({ inviteId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "invite_revoke_failed");
      }
      await loadOperations(activeToken);
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "invite_revoke_failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRevokeEntitlement(tenantId: string, confirmed = false) {
    if (!canOperate) {
      return;
    }
    if (!confirmed) {
      setPendingRevokeTenantId(tenantId);
      setPendingCancelTenantId(null);
      return;
    }
    setPendingRevokeTenantId(null);
    setError(null);
    setBusy(true);
    try {
      const response = await authenticatedMutationFetch("/api/commercial/admin/entitlements/revoke", {
        method: "POST",
        mutationKind: "other",
        headers: requestHeaders(),
        body: JSON.stringify({ tenantId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          describeCommercialBlockingReason(payload.error ?? payload.blockingReasons?.[0] ?? "entitlement_revoke_failed"),
        );
      }
      await loadOperations(activeToken);
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "entitlement_revoke_failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCancelStripeSubscription(tenantId: string, confirmed = false) {
    if (!canOperate) {
      return;
    }
    if (!confirmed) {
      setPendingCancelTenantId(tenantId);
      setPendingRevokeTenantId(null);
      return;
    }
    setPendingCancelTenantId(null);
    setError(null);
    setBusy(true);
    try {
      const response = await authenticatedMutationFetch("/api/commercial/admin/subscriptions/cancel", {
        method: "POST",
        mutationKind: "other",
        headers: requestHeaders(),
        body: JSON.stringify({ tenantId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          describeCommercialBlockingReason(payload.error ?? payload.blockingReasons?.[0] ?? "stripe_subscription_cancel_failed"),
        );
      }
      await loadOperations(activeToken);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "stripe_subscription_cancel_failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUpdateLeadStatus(leadId: string, status: CommercialLeadListItem["status"]) {
    if (!canOperate) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const response = await authenticatedMutationFetch("/api/commercial/admin/leads", {
        method: "PATCH",
        mutationKind: "other",
        headers: requestHeaders(),
        body: JSON.stringify({ leadId, status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "lead_update_failed");
      }
      await loadOperations(activeToken);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "lead_update_failed");
    } finally {
      setBusy(false);
    }
  }

  const activeInviteCount = useMemo(
    () => invites.filter((invite) => invite.status === "active").length,
    [invites],
  );

  const newLeadCount = useMemo(
    () => leads.filter((lead) => lead.status === "new").length,
    [leads],
  );

  if (view === "blocked" && !isSessionMode) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader
          title="Ticari yönetim kapalı"
          description="Acil durum token paneli yalnızca MANU_ALLOW_COMMERCIAL_ADMIN=true ve geçerli MANU_COMMERCIAL_ADMIN_TOKEN ile açılır. Normal operasyonlar için /admin kullanın."
          icon={Shield}
        />
        <CardBody>
          <p className="text-sm text-stone-600">
            Production pilot hâlâ NO-GO. Bu panel invite/abonelik operasyonları içindir; klinik GO veya
            production billing aktivasyonu sağlamaz.
          </p>
        </CardBody>
      </Card>
    );
  }

  if (view === "login" && !isSessionMode) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader
          title="Acil durum token girişi"
          description="Sandbox invite, abonelik durumu ve billing ledger operasyonları. Normal akış için /admin oturumunu kullanın."
          icon={KeyRound}
        />
        <CardBody>
          <form className="space-y-4" onSubmit={onConnect}>
            <Field label="Yönetim token" htmlFor="commercial-admin-token">
              <TextInput
                id="commercial-admin-token"
                type="password"
                autoComplete="off"
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                placeholder="MANU_COMMERCIAL_ADMIN_TOKEN"
                required
              />
            </Field>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {healthSummary ? (
              <p className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm text-ink-muted">
                {healthSummary}
              </p>
            ) : null}
            <Button type="submit" disabled={busy || !adminToken.trim()} fullWidth icon={Shield}>
              Operasyon paneline bağlan
            </Button>
          </form>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Ticari yönetim</h1>
          <p className="mt-1 text-sm text-stone-600">
            Invite yönetimi, abonelik durumu, billing ledger inceleme ve mobil kurulum erişimi iptali.
          </p>
          {isSessionMode && props.sessionEmail ? (
            <p className="mt-1 text-xs text-stone-500">Oturum: {props.sessionEmail}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={RefreshCw} disabled={busy} onClick={() => void onRefresh()}>
            Yenile
          </Button>
          {isSessionMode ? (
            <form action="/api/demo-logout" method="post">
              <Button type="submit" variant="ghost" disabled={busy}>
                Oturumu kapat
              </Button>
            </form>
          ) : (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setSessionToken(null);
                setInvites([]);
                setSubscriptions([]);
                setLedger([]);
                setLeads([]);
                setAdminAudit([]);
                setOnboardingAudit([]);
                setCreatedInvite(null);
                setHealthSummary(null);
                setHealthPayload(null);
                setView("login");
              }}
            >
              Oturumu kapat
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <span>{healthSummary ?? error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardBody className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-stone-500">Aktif davet</p>
            <p className="text-2xl font-semibold text-stone-900">{activeInviteCount}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-stone-500">Yeni lead</p>
            <p className="text-2xl font-semibold text-stone-900">{newLeadCount}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-stone-500">Abonelik kaydı</p>
            <p className="text-2xl font-semibold text-stone-900">{subscriptions.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-stone-500">Ledger kaydı</p>
            <p className="text-2xl font-semibold text-stone-900">{ledger.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-stone-500">Sistem sağlığı</p>
            <p className="text-2xl font-semibold text-stone-900">
              {healthPayload?.healthy ? "Sağlıklı" : healthPayload ? "Kontrol gerekli" : "—"}
            </p>
            {healthPayload?.status ? (
              <p className="text-xs text-stone-500">{healthPayload.status}</p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="İletişim talepleri"
          description="Public site form kayıtları; durum güncellemeleri operasyon takibi içindir."
          icon={MessageSquare}
        />
        <CardBody className="space-y-3">
          {leads.length === 0 ? (
            <p className="text-sm text-stone-600">Henüz lead kaydı yok.</p>
          ) : (
            leads.map((lead) => (
              <div key={lead.id} className="rounded-lg border border-stone-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900">
                      {lead.contactName}
                      {lead.clinicName ? (
                        <span className="font-normal text-stone-500"> · {lead.clinicName}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-stone-500">{lead.normalizedEmail}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{lead.message}</p>
                    <p className="mt-2 text-xs text-stone-500">
                      Durum: {lead.status} · Kaynak: {lead.sourcePath} · {formatTimestamp(lead.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lead.status !== "contacted" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void onUpdateLeadStatus(lead.id, "contacted")}
                      >
                        İletişim kuruldu
                      </Button>
                    ) : null}
                    {lead.status !== "closed" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void onUpdateLeadStatus(lead.id, "closed")}
                      >
                        Kapat
                      </Button>
                    ) : null}
                    {lead.status !== "new" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void onUpdateLeadStatus(lead.id, "new")}
                      >
                        Yeniden aç
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Yeni davet oluştur" description="Token yalnızca oluşturma anında gösterilir." icon={UserPlus} />
          <CardBody>
            <form className="space-y-4" onSubmit={onCreateInvite}>
              <Field label="E-posta" htmlFor="create-invite-email">
                <TextInput
                  id="create-invite-email"
                  type="email"
                  value={createEmail}
                  onChange={(event) => setCreateEmail(event.target.value)}
                  required
                />
              </Field>
              <Field label="Klinik adı (opsiyonel)" htmlFor="create-invite-tenant">
                <TextInput
                  id="create-invite-tenant"
                  value={createTenantName}
                  onChange={(event) => setCreateTenantName(event.target.value)}
                />
              </Field>
              <Field label="Davet kodu (opsiyonel)" htmlFor="create-invite-token">
                <TextInput
                  id="create-invite-token"
                  value={createInviteToken}
                  onChange={(event) => setCreateInviteToken(event.target.value)}
                  placeholder="Boş bırakılırsa otomatik üretilir"
                />
              </Field>
              <Field label="Son geçerlilik (opsiyonel)" htmlFor="create-invite-expires">
                <TextInput
                  id="create-invite-expires"
                  type="datetime-local"
                  value={createExpiresAt}
                  onChange={(event) => setCreateExpiresAt(event.target.value)}
                />
              </Field>
              <Button type="submit" disabled={busy || !createEmail.trim()} icon={UserPlus}>
                Davet oluştur
              </Button>
            </form>
            {createdInvite ? (
              <div className="mt-4 rounded-lg border border-sage/30 bg-sage/10 p-4 text-sm text-ink" role="status">
                <p className="font-medium">Davet oluşturuldu</p>
                <p className="mt-2 break-all">
                  E-posta: <span className="font-mono">{createdInvite.invite.normalizedEmail}</span>
                </p>
                <p className="mt-1 break-all">
                  Davet kodu: <span className="font-mono">{createdInvite.inviteToken}</span>
                </p>
              </div>
            ) : null}
          </CardBody>
        </Card>

        {isSessionMode ? (
          <Card>
            <CardHeader
              title="Havale ile erişim"
              description="Stripe'sız aktivasyon veya yenileme. Ödeme belgesi depolanmaz."
              icon={Banknote}
            />
            <CardBody>
              <form className="space-y-4" onSubmit={onApplyManualEntitlement}>
                <Field label="Davet" htmlFor="manual-entitlement-invite">
                  <select
                    id="manual-entitlement-invite"
                    className="min-h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    value={manualInviteId}
                    onChange={(event) => setManualInviteId(event.target.value)}
                    required
                  >
                    <option value="">Davet seç</option>
                    {invites.map((invite) => (
                      <option key={invite.id} value={invite.id}>
                        {invite.normalizedEmail} · {invite.status}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="İşlem" htmlFor="manual-entitlement-action">
                  <select
                    id="manual-entitlement-action"
                    className="min-h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    value={manualAction}
                    onChange={(event) => setManualAction(event.target.value === "renew" ? "renew" : "activate")}
                  >
                    <option value="activate">Aktive et</option>
                    <option value="renew">Yenile</option>
                  </select>
                </Field>
                <Field label="Ödeme referansı" htmlFor="manual-payment-reference">
                  <TextInput
                    id="manual-payment-reference"
                    value={manualPaymentReference}
                    onChange={(event) => setManualPaymentReference(event.target.value)}
                    placeholder="BANK-2026-0001"
                    required
                  />
                </Field>
                <Field label="Erişim bitişi" htmlFor="manual-paid-through">
                  <TextInput
                    id="manual-paid-through"
                    type="datetime-local"
                    value={manualPaidThrough}
                    onChange={(event) => setManualPaidThrough(event.target.value)}
                    required
                  />
                </Field>
                <Field label="İstek id (opsiyonel)" htmlFor="manual-request-id">
                  <TextInput
                    id="manual-request-id"
                    value={manualRequestId}
                    onChange={(event) => setManualRequestId(event.target.value)}
                    placeholder="Boş bırakılırsa otomatik üretilir"
                  />
                </Field>
                <Button
                  type="submit"
                  disabled={busy || !manualInviteId || !manualPaymentReference.trim() || !manualPaidThrough}
                  icon={Banknote}
                >
                  Havale erişimini uygula
                </Button>
              </form>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Davet listesi" description="Hash/token depolanmaz; yalnızca operasyon metadata." icon={Shield} />
          <CardBody className="space-y-3">
            {invites.length === 0 ? (
              <p className="text-sm text-stone-600">Henüz davet kaydı yok.</p>
            ) : (
              invites.map((invite) => (
                <div key={invite.id} className="rounded-lg border border-stone-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-stone-900">{invite.normalizedEmail}</p>
                      <p className="text-xs text-stone-500">
                        Durum: {invite.status} · Oluşturma: {formatTimestamp(invite.createdAt)}
                      </p>
                      {invite.checkoutStartedAt ? (
                        <p className="text-xs text-stone-500">
                          Checkout: {formatTimestamp(invite.checkoutStartedAt)}
                        </p>
                      ) : null}
                    </div>
                    {invite.status === "active" ? (
                      <Button
                        size="sm"
                        variant="danger"
                        icon={UserX}
                        disabled={busy}
                        onClick={() => void onRevokeInvite(invite.id)}
                      >
                        İptal et
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Abonelik durumu"
            description="Uygulama erişimi (entitlement) ile Stripe sandbox aboneliği ayrı yönetilir."
            icon={Shield}
          />
          <CardBody className="space-y-3">
            {subscriptions.length === 0 ? (
              <p className="text-sm text-stone-600">Henüz abonelik kaydı yok.</p>
            ) : (
              subscriptions.map((subscription) => (
                <div key={subscription.tenantId} className="rounded-lg border border-stone-200 p-3">
                  <p className="font-medium text-stone-900">
                    {subscription.normalizedEmail ?? subscription.tenantId}
                  </p>
                  <p className="text-xs text-stone-500">
                    Uygulama erişimi: {describeEntitlementStatusLabel(subscription.entitlementStatus)} ·
                    Davet: {subscription.inviteStatus ?? "—"}
                  </p>
                  <p className="text-xs text-stone-500">
                    Ödeme: {subscription.billingMethod ?? "—"} · Bitiş: {formatTimestamp(subscription.paidThrough)} ·
                    Revizyon: {subscription.revision ?? "—"}
                  </p>
                  <p className="text-xs text-stone-500">
                    Stripe müşteri: {subscription.stripeCustomerId ?? "—"}
                  </p>
                  <p className="text-xs text-stone-500">
                    Stripe abonelik: {subscription.stripeSubscriptionId ?? "—"}
                  </p>
                  <div className="mt-3 space-y-2">
                    {canAdminRevokeAppAccess(subscription.entitlementStatus) ? (
                      pendingRevokeTenantId === subscription.tenantId ? (
                        <div className="rounded-lg border border-line bg-surface-muted p-3 text-sm text-ink">
                          <p className="font-medium">Erişimi kapat</p>
                          <p className="mt-1">
                            Dashboard ve mobil/PWA erişimi entitlement üzerinden kapanır. Stripe aboneliği
                            devam edebilir.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy}
                              onClick={() => void onRevokeEntitlement(subscription.tenantId, true)}
                            >
                              Erişimi kapat
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setPendingRevokeTenantId(null)}
                            >
                              Vazgeç
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => void onRevokeEntitlement(subscription.tenantId)}
                        >
                          Erişimi kapat
                        </Button>
                      )
                    ) : null}
                    {canAdminCancelStripeSubscription({
                      entitlementStatus: subscription.entitlementStatus,
                      stripeSubscriptionId: subscription.stripeSubscriptionId,
                      stripeSandboxConfigured,
                    }) ? (
                      pendingCancelTenantId === subscription.tenantId ? (
                        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-800">
                          <p className="font-medium">Stripe aboneliğini iptal et</p>
                          <p className="mt-1">
                            Yalnızca sandbox Stripe aboneliği iptal edilir. Webhook entitlement durumunu
                            günceller; uygulama erişimi ayrıca kapatılmadıysa açık kalabilir.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => void onCancelStripeSubscription(subscription.tenantId, true)}
                            >
                              Stripe aboneliğini iptal et
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setPendingCancelTenantId(null)}
                            >
                              Vazgeç
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void onCancelStripeSubscription(subscription.tenantId)}
                        >
                          Stripe aboneliğini iptal et
                        </Button>
                      )
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Billing ledger" description="Webhook ve checkout olay özeti." icon={Shield} />
          <CardBody className="space-y-3">
            {ledger.length === 0 ? (
              <p className="text-sm text-stone-600">Henüz ledger kaydı yok.</p>
            ) : (
              ledger.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-stone-200 p-3">
                  <p className="font-medium text-stone-900">{entry.eventType}</p>
                  <p className="text-xs text-stone-500">
                    {entry.stripeEventId} · {formatTimestamp(entry.processedAt)}
                  </p>
                  <p className="text-xs text-stone-500">Tenant: {entry.tenantId ?? "—"}</p>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Denetim izi"
          description="Admin operasyonları ve onboarding olayları."
          icon={ScrollText}
        />
        <CardBody className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-medium text-stone-900">Admin audit</p>
            {adminAudit.length === 0 ? (
              <p className="text-sm text-stone-600">Henüz admin audit kaydı yok.</p>
            ) : (
              adminAudit.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-stone-200 p-3">
                  <p className="font-medium text-stone-900">{entry.eventType}</p>
                  <p className="text-xs text-stone-500">
                    Aktör: {entry.actorSummary} · {formatTimestamp(entry.createdAt)}
                  </p>
                  {entry.targetTenantId ? (
                    <p className="text-xs text-stone-500">Tenant: {entry.targetTenantId}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-stone-900">Onboarding audit</p>
            {onboardingAudit.length === 0 ? (
              <p className="text-sm text-stone-600">Henüz onboarding audit kaydı yok.</p>
            ) : (
              onboardingAudit.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-stone-200 p-3">
                  <p className="font-medium text-stone-900">{entry.eventType}</p>
                  <p className="text-xs text-stone-500">
                    {entry.normalizedEmail} · {formatTimestamp(entry.createdAt)}
                  </p>
                  {entry.checkoutSessionId ? (
                    <p className="text-xs text-stone-500">Checkout: {entry.checkoutSessionId}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
