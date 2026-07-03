"use client";

import { useState } from "react";
import { AlertTriangle, Clock3 } from "lucide-react";
import type { ManuAppState } from "@/lib/types";
import { Badge, EmptyState, SelectInput, TextareaInput, removeKey } from "./shared";

export function HandoffsPanel({
  state,
  onSelectClient,
  onResolveHandoff,
  onResolveAndReactivateHandoff,
  onDismissHandoff,
}: {
  state: ManuAppState;
  onSelectClient: (clientId: string) => void;
  onResolveHandoff: (handoffId: string) => Promise<ManuAppState>;
  onResolveAndReactivateHandoff: (
    handoffId: string,
    input: { reactivationReason: string; aiMode: "copilot" | "autopilot" },
  ) => Promise<ManuAppState>;
  onDismissHandoff: (handoffId: string) => Promise<ManuAppState>;
}) {
  const [reactivationReasons, setReactivationReasons] = useState<Record<string, string>>({});
  const [reactivationModes, setReactivationModes] = useState<Record<string, "copilot" | "autopilot">>({});
  const handoffs = state.handoffCases.filter((handoff) => handoff.status === "open" || handoff.status === "assigned");

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Devir kuyruğu</h3>
          <p className="mt-1 text-sm text-stone-600">Kırmızı ve koruma tarafından engellenen akışlar diyetisyen incelemesi için buraya düşer.</p>
        </div>
        <Badge label={`${handoffs.length} açık`} tone={handoffs.length > 0 ? "red" : "emerald"} />
      </div>

      <div className="mt-5 space-y-3">
        {handoffs.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Açık devir yok"
            message="Kırmızı veya engellenmiş akışlar burada görünür."
          />
        ) : (
          handoffs.map((handoff) => {
            const client = state.clients.find((item) => item.id === handoff.clientId);
            const isRedRiskLocked =
              client?.redRiskLock.status === "locked" && client.redRiskLock.handoffId === handoff.id;
            const reason = reactivationReasons[handoff.id] || "";
            const aiMode = reactivationModes[handoff.id] || "copilot";
            return (
              <div
                key={handoff.id}
                className="w-full rounded-lg border border-stone-200 p-4 text-left"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge label={handoff.urgency} tone={handoff.urgency === "urgent" ? "red" : "amber"} />
                      <span className="font-semibold">{client?.fullName || handoff.clientId}</span>
                    </div>
                    <p className="mt-2 text-sm text-stone-700">{handoff.reasons.join(", ") || handoff.risk}</p>
                    <p className="mt-2 text-sm text-stone-600">{handoff.recommendedAction}</p>
                    {isRedRiskLocked && (
                      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-red-950">
                          <AlertTriangle size={16} />
                          Kırmızı risk reaktivasyon kilidi
                        </div>
                        <p className="mt-2 text-sm leading-6 text-red-900">
                          Bu devir açıkça çözülüp yeniden etkinleştirilene kadar AI pasif kalır.
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                          <TextareaInput
                            label="Çözüm gerekçesi"
                            value={reason}
                            onChange={(value) =>
                              setReactivationReasons((current) => ({ ...current, [handoff.id]: value }))
                            }
                            rows={3}
                          />
                          <SelectInput
                            label="AI modu"
                            value={aiMode}
                            onChange={(value) =>
                              setReactivationModes((current) => ({
                                ...current,
                                [handoff.id]: value === "autopilot" ? "autopilot" : "copilot",
                              }))
                            }
                            options={[
                              ["copilot", "Copilot"],
                              ["autopilot", "Autopilot"],
                            ]}
                          />
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => onSelectClient(handoff.clientId)}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                        type="button"
                      >
                        Danışanı aç
                      </button>
                      {isRedRiskLocked ? (
                        <button
                          onClick={async () => {
                            await onResolveAndReactivateHandoff(handoff.id, {
                              reactivationReason: reason,
                              aiMode,
                            });
                            setReactivationReasons((current) => removeKey(current, handoff.id));
                            setReactivationModes((current) => removeKey(current, handoff.id));
                          }}
                          disabled={!reason.trim()}
                          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-stone-400"
                          type="button"
                        >
                          Çöz + yeniden etkinleştir
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => onResolveHandoff(handoff.id)}
                            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
                            type="button"
                          >
                            Çöz
                          </button>
                          <button
                            onClick={() => onDismissHandoff(handoff.id)}
                            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-stone-200 px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-300"
                            type="button"
                          >
                            Kapat
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <Clock3 size={18} className="text-stone-400" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
