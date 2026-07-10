import { NextResponse, type NextRequest } from "next/server";
import {
  createContextIntakeProposal,
  getFallbackState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { createSupabaseContextIntakeProposal, isSupabaseStoreConfigured } from "@/lib/supabase-store";
import type { ClientContextUpdateImportance, ClientContextUpdateSource } from "@/lib/types";

type ScopedContextIntakeRequest = {
  sourceText?: string;
  intakeSource?: ClientContextUpdateSource;
  occurredAt?: string | null;
  title?: string;
  summary?: string;
  details?: string;
  importance?: ClientContextUpdateImportance;
  rawSourceReference?: string | null;
  confirmFullName?: string;
  confirmPhoneE164?: string;
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as ScopedContextIntakeRequest;

  if (!body.sourceText?.trim() || !body.intakeSource || !body.confirmFullName?.trim() || !body.confirmPhoneE164?.trim()) {
    return NextResponse.json({ error: "context_intake_source_required" }, { status: 400 });
  }

  const resolution = {
    clientId: id,
    confirmFullName: body.confirmFullName,
    confirmPhoneE164: body.confirmPhoneE164,
  };
  const input = {
    sourceText: body.sourceText,
    intakeSource: body.intakeSource,
    occurredAt: body.occurredAt,
    title: body.title,
    summary: body.summary,
    details: body.details,
    importance: body.importance,
    rawSourceReference: body.rawSourceReference,
  };

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await createSupabaseContextIntakeProposal(resolution, input, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(saveFallbackState(createContextIntakeProposal(getFallbackState(), resolution, input)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
