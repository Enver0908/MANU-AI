import { NextResponse, type NextRequest } from "next/server";
import { evaluateCommercialAdminAccess } from "@/lib/commercial-admin-access";
import {
  createCommercialAdminInvite,
  isCommercialAdminStoreConfigured,
  listCommercialAdminInvites,
  revokeCommercialAdminInvite,
} from "@/lib/commercial-admin-store";
import { getSupabaseAdminClient } from "@/lib/supabase";

type CreateInviteBody = {
  email?: string;
  inviteToken?: string;
  tenantName?: string;
  expiresAt?: string | null;
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
  const invites = await listCommercialAdminInvites(admin, { limit: Number.isFinite(limit) ? limit : 50 });
  return NextResponse.json({ invites });
}

export async function POST(request: NextRequest) {
  const access = await evaluateCommercialAdminAccess(request);
  if (!access.allowed) {
    return adminUnauthorized(access.blockingReasons);
  }
  if (!isCommercialAdminStoreConfigured()) {
    return adminUnavailable();
  }

  let body: CreateInviteBody;
  try {
    body = (await request.json()) as CreateInviteBody;
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

  try {
    const created = await createCommercialAdminInvite(admin, {
      email: body.email,
      inviteToken: body.inviteToken,
      tenantName: body.tenantName,
      expiresAt: body.expiresAt ?? null,
      actorSummary: access.actorSummary ?? undefined,
    });

    return NextResponse.json({
      invite: created.invite,
      inviteToken: created.inviteToken,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invite_create_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await evaluateCommercialAdminAccess(request);
  if (!access.allowed) {
    return adminUnauthorized(access.blockingReasons);
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
