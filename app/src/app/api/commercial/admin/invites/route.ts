import { NextResponse, type NextRequest } from "next/server";
import {
  evaluateCommercialAdminAccess,
  evaluateCommercialAdminAllowlistSessionAccess,
} from "@/lib/commercial-admin-access";
import {
  inviteCommercialAdminCustomer,
  isCommercialAdminStoreConfigured,
  listCommercialAdminCustomers,
  listCommercialAdminInvites,
  requestCommercialAdminPasswordRecovery,
  revokeCommercialAdminInvite,
} from "@/lib/commercial-admin-store";
import {
  isCommercialAdminSameOriginRequest,
} from "@/lib/phase-83f-commercial-admin";
import { getSupabaseAdminClient } from "@/lib/supabase";

type InviteMutationBody = {
  command?: string;
  email?: string;
  tenantName?: string;
  paidThrough?: string | null;
  expiresAt?: string | null;
  inviteToken?: string;
  sendPasswordRecovery?: boolean;
};

function adminUnauthorized(blockingReasons: string[]) {
  return NextResponse.json(
    { error: "commercial_admin_unauthorized", blockingReasons },
    { status: 401 },
  );
}

function adminUnavailable() {
  return NextResponse.json({ error: "commercial_admin_not_configured" }, { status: 503 });
}

function originForbidden() {
  return NextResponse.json(
    { error: "origin_mismatch", blockingReasons: ["same_origin_required"] },
    { status: 403 },
  );
}

export async function GET(request: NextRequest) {
  const access = await evaluateCommercialAdminAccess(request);
  if (!access.allowed) {
    return adminUnauthorized(access.blockingReasons);
  }
  if (!isCommercialAdminStoreConfigured()) {
    return adminUnavailable();
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return adminUnavailable();
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const email = request.nextUrl.searchParams.get("email");
  const safeLimit = Number.isFinite(limit) ? limit : 50;
  const [invites, customers] = await Promise.all([
    listCommercialAdminInvites(admin, { limit: safeLimit }),
    listCommercialAdminCustomers(admin, { email, limit: safeLimit }),
  ]);
  return NextResponse.json({ invites, customers });
}

export async function POST(request: NextRequest) {
  const access = await evaluateCommercialAdminAllowlistSessionAccess(request);
  if (!access.allowed) {
    return adminUnauthorized(access.blockingReasons);
  }
  if (
    !isCommercialAdminSameOriginRequest({
      origin: request.headers.get("origin"),
      host: request.headers.get("host"),
    })
  ) {
    return originForbidden();
  }
  if (!isCommercialAdminStoreConfigured()) {
    return adminUnavailable();
  }

  let body: InviteMutationBody;
  try {
    body = (await request.json()) as InviteMutationBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.email?.trim()) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return adminUnavailable();
  }

  const command =
    body.command === "send_password_recovery" || body.sendPasswordRecovery === true
      ? "send_password_recovery"
      : "invite_customer";

  try {
    if (command === "send_password_recovery") {
      const result = await requestCommercialAdminPasswordRecovery(admin, {
        email: body.email,
        actorSummary: access.actorSummary ?? undefined,
      });
      return NextResponse.json(result);
    }

    const created = await inviteCommercialAdminCustomer(admin, {
      email: body.email,
      tenantName: body.tenantName,
      paidThrough: body.paidThrough ?? null,
      expiresAt: body.expiresAt ?? null,
      actorSummary: access.actorSummary ?? undefined,
    });

    return NextResponse.json({
      created: created.created,
      resent: created.resent,
      inviteId: created.inviteId,
      email: created.email,
      paidThrough: created.paidThrough,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invite_create_failed";
    const status =
      message.includes("conflict") || message === "ambiguous_tenant_match"
        ? 409
        : message.includes("existing_") || message.includes("duplicate") || message.includes("open_invite")
          ? 409
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await evaluateCommercialAdminAllowlistSessionAccess(request);
  if (!access.allowed) {
    return adminUnauthorized(access.blockingReasons);
  }
  if (
    !isCommercialAdminSameOriginRequest({
      origin: request.headers.get("origin"),
      host: request.headers.get("host"),
    })
  ) {
    return originForbidden();
  }
  if (!isCommercialAdminStoreConfigured()) {
    return adminUnavailable();
  }

  let body: { inviteId?: string };
  try {
    body = (await request.json()) as { inviteId?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.inviteId?.trim()) {
    return NextResponse.json({ error: "invite_id_required" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return adminUnavailable();
  }

  try {
    const result = await revokeCommercialAdminInvite(admin, {
      inviteId: body.inviteId.trim(),
      actorSummary: access.actorSummary ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invite_revoke_failed";
    const status = message === "invite_not_found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
