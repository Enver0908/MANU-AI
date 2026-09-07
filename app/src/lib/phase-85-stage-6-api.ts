import { NextResponse } from "next/server";
import { AppAuthError, authErrorResponse } from "./auth-context";
import { AppDomainError, apiErrorBody, createApiRequestId, domainErrorResponse } from "./app-errors";
import {
  STAGE_6_API_CACHE_CONTROL,
  Stage6ContractError,
  mapStage6PersistenceError,
  stage6ErrorJson,
  type Stage6RevisionSource,
} from "./phase-85-stage-6-dashboard-contracts";

export function stage6JsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": STAGE_6_API_CACHE_CONTROL },
  });
}

export function stage6ErrorResponse(error: unknown, sourceType?: Stage6RevisionSource, currentRevision?: number) {
  const mapped = mapStage6PersistenceError(error, sourceType, currentRevision);
  if (mapped instanceof Stage6ContractError) {
    return NextResponse.json(stage6ErrorJson(mapped), {
      status: mapped.status,
      headers: { "Cache-Control": STAGE_6_API_CACHE_CONTROL },
    });
  }
  if (mapped instanceof AppAuthError) {
    return NextResponse.json(apiErrorBody(mapped.message, createApiRequestId()), {
      status: mapped.status,
      headers: { "Cache-Control": STAGE_6_API_CACHE_CONTROL },
    });
  }
  if (mapped instanceof AppDomainError) {
    return domainErrorResponse(mapped);
  }
  throw mapped;
}
