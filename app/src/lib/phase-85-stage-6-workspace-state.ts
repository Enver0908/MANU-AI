import { AppRequestError } from "./app-errors";

export type Stage6EditorFailure = {
  kind: "conflict" | "error";
  code: string;
};

export function buildStage6WorkspaceOwnerKey(
  tenantId: string | null,
  clientId: string | null,
  domain: string,
) {
  return `${tenantId ?? "none"}:${clientId ?? "none"}:${domain}`;
}

export function isStage6RevisionConflict(error: unknown) {
  if (!(error instanceof AppRequestError) || error.status !== 409) return false;
  return (
    error.code === "revision_conflict" ||
    error.code.endsWith("_revision_conflict") ||
    error.code.startsWith("stale_") ||
    error.code.includes("_stale_") ||
    error.code === "profile_stale_recreate_required" ||
    error.code === "concurrent_state_update" ||
    error.code.startsWith("reactivation_conflict_")
  );
}

export function classifyStage6EditorFailure(error: unknown, fallbackCode: string): Stage6EditorFailure {
  if (isStage6RevisionConflict(error)) {
    return { kind: "conflict", code: (error as AppRequestError).code };
  }
  return {
    kind: "error",
    code:
      error instanceof AppRequestError
        ? error.code
        : typeof navigator !== "undefined" && navigator.onLine === false
          ? "offline"
          : fallbackCode,
  };
}

export function stage6EditorFailureMessage(failure: Stage6EditorFailure) {
  if (failure.kind === "conflict") {
    return "Sunucudaki kayıt siz düzenlerken değişti. Taslağınız korundu. Güncel kaydı açmak için değişikliklerden vazgeçip görevi yeniden açın.";
  }
  if (failure.code === "offline") {
    return "İnternet bağlantısı yok. Taslağınız bu ekranda korunuyor; bağlantı gelmeden kayıt yapılamaz.";
  }
  return `Kayıt başarısız: ${failure.code}`;
}
