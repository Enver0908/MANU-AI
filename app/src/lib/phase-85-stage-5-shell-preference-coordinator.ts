import type {
  ShellDestinationId,
  ShellPreferencesPatchResultDto,
} from "./phase-85-stage-5-shell-contracts";
import {
  SIRIUSAI_CLIENT_VERSION_HEADER,
  SIRIUSAI_MUTATION_KIND_HEADER,
} from "./phase-85-stage-5-shell-pwa";

export type ShellPreferenceIntent = {
  activeClientId?: string | null;
  lastDestinationId?: ShellDestinationId | null;
};

export type ShellPreferenceCoordinatorOptions = {
  getRevision: () => number | null;
  createRequestId: () => string;
  getClientBuildVersion: () => string;
  refreshBootstrap: () => void;
  fetchImpl?: typeof fetch;
};

type QueueEntry = {
  intent: ShellPreferenceIntent;
  resolvers: Array<(value: ShellPreferencesPatchResultDto | null) => void>;
};

export class ShellPreferenceCoordinator {
  private inFlight = false;
  private pending: QueueEntry | null = null;

  constructor(private readonly options: ShellPreferenceCoordinatorOptions) {}

  update(intent: ShellPreferenceIntent): Promise<ShellPreferencesPatchResultDto | null> {
    if (Object.keys(intent).length === 0) return Promise.resolve(null);
    return new Promise((resolve) => {
      if (this.pending) {
        this.pending.intent = { ...this.pending.intent, ...intent };
        this.pending.resolvers.push(resolve);
      } else {
        this.pending = { intent: { ...intent }, resolvers: [resolve] };
      }
      void this.flush();
    });
  }

  private async flush() {
    if (this.inFlight || !this.pending) return;
    this.inFlight = true;
    const entry = this.pending;
    this.pending = null;
    const result = await this.sendWithSingleConflictRetry(entry.intent);
    entry.resolvers.forEach((resolve) => resolve(result));
    this.inFlight = false;
    if (this.pending) {
      void this.flush();
    }
  }

  private async sendWithSingleConflictRetry(intent: ShellPreferenceIntent) {
    const first = await this.sendOnce(intent);
    if (first.status !== 409) return first.result;
    this.options.refreshBootstrap();
    const second = await this.sendOnce(intent);
    return second.result;
  }

  private async sendOnce(intent: ShellPreferenceIntent): Promise<{
    status: number;
    result: ShellPreferencesPatchResultDto | null;
  }> {
    const expectedRevision = this.options.getRevision();
    if (expectedRevision === null) return { status: 409, result: null };

    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl("/api/shell/preferences", {
      method: "PATCH",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        [SIRIUSAI_CLIENT_VERSION_HEADER]: this.options.getClientBuildVersion(),
        [SIRIUSAI_MUTATION_KIND_HEADER]: "save",
      },
      body: JSON.stringify({
        requestId: this.options.createRequestId(),
        expectedRevision,
        ...intent,
      }),
    });

    if (!response.ok) return { status: response.status, result: null };
    const payload = (await response.json().catch(() => null)) as ShellPreferencesPatchResultDto | null;
    if (!payload || typeof payload.revision !== "number") {
      return { status: 502, result: null };
    }
    return { status: response.status, result: payload };
  }
}
