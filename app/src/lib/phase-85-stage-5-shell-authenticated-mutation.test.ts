import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authenticatedMutationFetch,
  buildAuthenticatedMutationHeaders,
  setShellMutationUpdateGate,
} from "./phase-85-stage-5-shell-authenticated-mutation";
import {
  SIRIUSAI_CLIENT_VERSION_HEADER,
  SIRIUSAI_MUTATION_KIND_HEADER,
} from "./phase-85-stage-5-shell-pwa";

describe("phase-85-stage-5-shell-authenticated-mutation", () => {
  afterEach(() => {
    setShellMutationUpdateGate("open");
    vi.restoreAllMocks();
  });

  it("adds client version and mutation kind headers for JSON mutations", () => {
    const headers = buildAuthenticatedMutationHeaders(undefined, { mutationKind: "other" });
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get(SIRIUSAI_CLIENT_VERSION_HEADER)).toBeTruthy();
    expect(headers.get(SIRIUSAI_MUTATION_KIND_HEADER)).toBe("other");
    expect(headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not force a multipart content-type when the mutation body is FormData", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    const form = new FormData();
    form.set("file", new Blob(["stage-5"]), "stage-5.txt");

    await authenticatedMutationFetch("/api/simulator/visual", {
      method: "POST",
      mutationKind: "other",
      body: form,
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = new Headers(init?.headers);
    expect(headers.has("content-type")).toBe(false);
    expect(headers.get(SIRIUSAI_CLIENT_VERSION_HEADER)).toBeTruthy();
  });

  it("rejects offline mutations before fetch", async () => {
    const previousOnline = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    try {
      await expect(
        authenticatedMutationFetch("/api/app-state", { method: "POST", mutationKind: "other" }),
      ).rejects.toMatchObject({ code: "offline_mutation_rejected" });
    } finally {
      if (previousOnline) {
        Object.defineProperty(navigator, "onLine", previousOnline);
      }
    }
  });
});
