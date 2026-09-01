import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyShellServiceWorkerRequest,
  isClientUpdateRequired,
  isClientVersionCheckExemptPath,
  isLegacyShellCacheName,
  isShellMutationAllowed,
  listAllowedShellCacheNames,
  resolveAuthenticatedMutationPolicy,
  resolveShellMutationUpdateGate,
  shouldBlockOptionalPwaReload,
  shouldServiceWorkerCachePath,
  SHELL_LEGACY_CACHE_PREFIX,
  SHELL_STATIC_CACHE_MAX_ENTRIES,
  SHELL_SW_CACHE_VERSION,
} from "./phase-85-stage-5-shell-pwa";
import { reduceShellProviderState, createInitialShellProviderState, createFallbackShellBootstrap } from "./phase-85-stage-5-shell-provider-state";

describe("phase-85-stage-5-shell-pwa", () => {
  it("never caches navigation HTML, RSC routes, or API paths", () => {
    expect(classifyShellServiceWorkerRequest({ pathname: "/dashboard", mode: "navigate" })).toBe(
      "network_only",
    );
    expect(classifyShellServiceWorkerRequest({ pathname: "/dashboard", mode: "cors" })).toBe(
      "network_only",
    );
    expect(classifyShellServiceWorkerRequest({ pathname: "/api/app-state" })).toBe("network_only");
    expect(classifyShellServiceWorkerRequest({ pathname: "/_next/static/chunks/main.js" })).toBe(
      "cache_first_static",
    );
    expect(classifyShellServiceWorkerRequest({ pathname: "/manifest.webmanifest" })).toBe(
      "stale_while_revalidate_asset",
    );
    expect(classifyShellServiceWorkerRequest({ pathname: "/icons/aiya-192.png" })).toBe(
      "stale_while_revalidate_asset",
    );
    expect(classifyShellServiceWorkerRequest({ pathname: "/icons/siriusai-192.png" })).toBe(
      "stale_while_revalidate_asset",
    );
    expect(shouldServiceWorkerCachePath("/dashboard")).toBe(false);
    expect(shouldServiceWorkerCachePath("/api/clients")).toBe(false);
  });

  it("deletes legacy manu-ai-shell caches and keeps siriusai allowlist", () => {
    expect(isLegacyShellCacheName(`${SHELL_LEGACY_CACHE_PREFIX}v2`)).toBe(true);
    const swSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
    const swMatch = swSource.match(/const SW_CACHE_VERSION = "([^"]+)"/);
    const swVersion = swMatch?.[1] ?? SHELL_SW_CACHE_VERSION;
    expect(listAllowedShellCacheNames()).toEqual([
      "siriusai-static-" + SHELL_SW_CACHE_VERSION,
      "siriusai-assets-" + SHELL_SW_CACHE_VERSION,
    ]);
    expect(swVersion).toBeTruthy();
    expect(swVersion).not.toBe("stage5-remediation-v3");
    expect(swSource).toContain(SHELL_LEGACY_CACHE_PREFIX);
    expect(swSource).toContain("SKIP_WAITING");
    expect(swSource).toContain("STATIC_CACHE_MAX_ENTRIES = 100");
    expect(SHELL_STATIC_CACHE_MAX_ENTRIES).toBe(100);
    expect(swSource).not.toContain("BackgroundSync");
    expect(swSource).not.toContain("periodicsync");
    expect(swSource).not.toContain("syncmanager");
  });

  it("exempts webhooks auth logout and session activity from client-version enforcement", () => {
    expect(isClientVersionCheckExemptPath("/api/whatsapp/webhook")).toBe(true);
    expect(isClientVersionCheckExemptPath("/api/commercial/webhook")).toBe(true);
    expect(isClientVersionCheckExemptPath("/api/auth/reauthenticate")).toBe(true);
    expect(isClientVersionCheckExemptPath("/api/demo-logout")).toBe(true);
    expect(isClientVersionCheckExemptPath("/api/session/activity")).toBe(true);
    expect(isClientVersionCheckExemptPath("/api/app-state")).toBe(false);
    expect(resolveAuthenticatedMutationPolicy("/api/contact/leads", "POST")).toBe("public_exempt");
    expect(resolveAuthenticatedMutationPolicy("/api/commercial/mobile-install-audit", "POST")).toBe("public_exempt");
    expect(resolveAuthenticatedMutationPolicy("/api/session/activity", "POST")).toBe("session_exempt");
    expect(resolveAuthenticatedMutationPolicy("/api/clients/forms", "POST")).toBe("save_allowed_when_outdated");
    expect(resolveAuthenticatedMutationPolicy("/api/shell/preferences", "PATCH")).toBe("blocked_when_outdated");
    expect(resolveAuthenticatedMutationPolicy("/api/ai-chat/conversations", "POST")).toBe("blocked_when_outdated");
  });

  it("marks clients below min version as update-required", () => {
    expect(
      isClientUpdateRequired("0.0.0", {
        SIRIUSAI_SHELL_MIN_CLIENT_VERSION: "1.0.0",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isClientUpdateRequired("1.0.0", {
        SIRIUSAI_SHELL_MIN_CLIENT_VERSION: "1.0.0",
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it("blocks optional reload when dirty and keeps save-only gate for required updates", () => {
    expect(shouldBlockOptionalPwaReload({ dirty: true, updateRequired: false })).toBe(true);
    expect(shouldBlockOptionalPwaReload({ dirty: true, updateRequired: true })).toBe(false);
    expect(resolveShellMutationUpdateGate({ updateRequired: true, optionalUpdateWaiting: false })).toBe(
      "save_only",
    );
    expect(isShellMutationAllowed("save_only", "save")).toBe(true);
    expect(isShellMutationAllowed("save_only", "other")).toBe(false);
  });

  it("keeps Stage 5 remediation guards wired through shell-controlled clients", () => {
    const proxySource = readFileSync(join(process.cwd(), "src", "proxy.ts"), "utf8");
    const mutationHelperSource = readFileSync(
      join(process.cwd(), "src", "lib", "phase-85-stage-5-shell-authenticated-mutation.ts"),
      "utf8",
    );
    const aiChatPageSource = readFileSync(
      join(process.cwd(), "src", "components", "ai-chat", "ai-chat-page-client.tsx"),
      "utf8",
    );
    const aiChatComposerSource = readFileSync(
      join(process.cwd(), "src", "components", "ai-chat", "ai-chat-composer.tsx"),
      "utf8",
    );
    const aiChatWorkspaceSource = readFileSync(
      join(process.cwd(), "src", "components", "ai-chat", "ai-chat-workspace.tsx"),
      "utf8",
    );

    expect(proxySource).toContain("client_version_required");
    expect(proxySource).not.toContain("SIRIUSAI_MUTATION_KIND_HEADER");
    expect(mutationHelperSource).toContain("requestInit.body instanceof FormData");
    expect(mutationHelperSource).toContain('headers.delete("content-type")');
    expect(aiChatPageSource).toContain("requestHrefNavigation");
    expect(aiChatPageSource).not.toContain("router.push");
    expect(aiChatComposerSource).toContain("authenticatedMutationFetch(\"/api/ai-chat/attachments\"");
    expect(aiChatComposerSource).toContain("attachments.length > 0");
    expect(aiChatComposerSource).toContain("cleanupRecording");
    expect(aiChatComposerSource).toContain("onAttachmentsChange([])");
    expect(aiChatWorkspaceSource).toContain("authenticatedMutationFetch");
    expect(aiChatWorkspaceSource).toContain("ai-chat-attachment-review");
  });

  it("clears bootstrap on offline and preserves bootstrap on required update failure", () => {
    let state = createInitialShellProviderState("live");
    state = reduceShellProviderState(state, {
      type: "bootstrap_succeeded",
      sequence: 1,
      bootstrap: createFallbackShellBootstrap({ displayName: "Ada" }),
    });
    state = reduceShellProviderState(state, { type: "go_offline" });
    expect(state.runtime).toBe("offline");
    expect(state.bootstrap).toBeNull();

    state = reduceShellProviderState(state, {
      type: "bootstrap_succeeded",
      sequence: 2,
      bootstrap: createFallbackShellBootstrap({ displayName: "Ada" }),
    });
    state = reduceShellProviderState(state, {
      type: "bootstrap_failed",
      sequence: 3,
      runtime: "update_required",
      error: "client_update_required",
    });
    expect(state.runtime).toBe("update_required");
    expect(state.updateRequired).toBe(true);
    expect(state.bootstrap?.displayName).toBe("Ada");
  });
});
