import { NextResponse } from "next/server";
import { resolveReleaseIdentity } from "@/lib/release-identity";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const identity = resolveReleaseIdentity();
    return NextResponse.json(
      {
        status: "ok",
        releaseId: identity.releaseId,
        commitSha: identity.commitSha,
        migrationFingerprint: identity.migrationFingerprint,
        compatibilityVersion: identity.compatibilityVersion,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { status: "error" },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
