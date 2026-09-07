import { createHash } from "node:crypto";
import {
  normalizeCommercialEmail,
  validateNormalizedCommercialEmail,
  type CommercialInvite,
  type CommercialInviteStatus,
} from "./phase-83b-commercial-entitlement-model";

const DEFAULT_INVITE_PEPPER = "manu-local-invite-pepper-v1";

export function resolveCommercialInvitePepper(pepper = process.env.MANU_COMMERCIAL_INVITE_PEPPER) {
  return pepper && pepper.trim().length >= 16 ? pepper.trim() : DEFAULT_INVITE_PEPPER;
}

export function hashCommercialInviteToken(token: string, pepper = resolveCommercialInvitePepper()) {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new Error("invite_token_required");
  }
  return createHash("sha256").update(`${pepper}:${normalizedToken}`).digest("hex");
}

export function buildCommercialInviteRecord(input: {
  id: string;
  email: string;
  inviteToken: string;
  tenantSeedMetadata?: Record<string, unknown>;
  tenantId?: string | null;
  status?: CommercialInviteStatus;
  expiresAt?: string | null;
  now?: string;
  pepper?: string;
}): CommercialInvite {
  const normalizedEmail = normalizeCommercialEmail(input.email);
  const validation = validateNormalizedCommercialEmail(normalizedEmail);
  if (!validation.valid) {
    throw new Error(validation.blockingReasons[0] ?? "invalid_email");
  }

  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id,
    normalizedEmail,
    inviteTokenHash: hashCommercialInviteToken(input.inviteToken, input.pepper),
    status: input.status ?? "active",
    tenantSeedMetadata: input.tenantSeedMetadata ?? {},
    tenantId: input.tenantId ?? null,
    revokedAt: null,
    expiresAt: input.expiresAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function matchesCommercialInviteToken(input: {
  invite: Pick<CommercialInvite, "inviteTokenHash" | "status" | "expiresAt">;
  inviteToken: string;
  pepper?: string;
  now?: string;
}) {
  const blockingReasons: string[] = [];
  if (input.invite.status !== "active") {
    blockingReasons.push(`invite status must be active (current: ${input.invite.status})`);
  }
  if (input.invite.expiresAt) {
    const now = input.now ?? new Date().toISOString();
    if (new Date(input.invite.expiresAt).getTime() <= new Date(now).getTime()) {
      blockingReasons.push("invite has expired");
    }
  }

  const candidateHash = hashCommercialInviteToken(input.inviteToken, input.pepper);
  if (candidateHash !== input.invite.inviteTokenHash) {
    blockingReasons.push("invite token does not match");
  }

  return {
    allowed: blockingReasons.length === 0,
    blockingReasons,
  };
}
