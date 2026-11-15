"use client";

/**
 * /log — telemetry ingest & Tempus Pro telemedicine sync console (module E host).
 */

import { Radio, RefreshCw, Send } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { StatusChip } from "@/components/ui/primitives";
import { TelemetryLogger } from "@/components/widgets/TelemetryLogger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useCrew } from "@/hooks/useCrew";
import { useProvider } from "@/hooks/useProvider";
import { useAppStore } from "@/stores/app-store";
import type {
  TelemedicineFlushResponse,
  TelemedicineSyncQueueResponse,
} from "@/types/health";

function LogInner() {
  const params = useSearchParams();
  const provider = useProvider();
  const viewMode = useAppStore((s) => s.viewMode);
  const { crew } = useCrew();
  const { activeUser } = useCheckIn();
  const [crewId, setCrewId] = useState(
    params.get("crew") ?? activeUser?.astronautId ?? "",
  );

  const [queue, setQueue] = useState<TelemedicineSyncQueueResponse | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [flushResult, setFlushResult] =
    useState<TelemedicineFlushResponse | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [groundStation, setGroundStation] = useState("MCC-Houston-DSN");

  const loadQueue = useCallback(async () => {
    if (!provider) return;
    setQueueLoading(true);
    setQueueError(null);
    try {
      setQueue(await provider.getTelemedicineQueue());
    } catch (e) {
      setQueueError(
        e instanceof Error ? e.message : "Failed to load telemedicine queue.",
      );
    } finally {
      setQueueLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    if (!provider) return;
    let cancelled = false;
    provider.getTelemedicineQueue().then(
      (data) => {
        if (!cancelled) {
          setQueue(data);
          setQueueError(null);
        }
      },
      (e) => {
        if (!cancelled) {
          setQueueError(
            e instanceof Error
              ? e.message
              : "Failed to load telemedicine queue.",
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const flushQueue = async (forceFlush: boolean) => {
    if (!provider) return;
    setFlushing(true);
    setQueueError(null);
    try {
      const res = await provider.flushTelemedicineQueue({
        force_flush: forceFlush,
        ground_station: groundStation.trim() || "MCC-Houston-DSN",
      });
      setFlushResult(res);
      await loadQueue();
    } catch (e) {
      setQueueError(
        e instanceof Error ? e.message : "Telemedicine flush failed.",
      );
    } finally {
      setFlushing(false);
    }
  };

  const technical = viewMode === "technical";

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="medbay-display text-xl tracking-widest">Telemetry log</h1>
        <span className="medbay-micro text-foreground/60">ingest console</span>
        <select
          className="ml-auto flex h-9 border border-input bg-black px-3 text-sm"
          aria-label="Subject"
          value={crewId}
          onChange={(e) => setCrewId(e.target.value)}
        >
          {(crew.length ? crew : [{ id: crewId } as never]).map((c) => (
            <option key={(c as { id: string }).id} value={(c as { id: string }).id}>
              {(c as { callsign?: string }).callsign ?? (c as { id: string }).id}
            </option>
          ))}
        </select>
      </div>

      <TelemetryLogger crewId={crewId} onSubmitted={() => void loadQueue()} />

      {/* Tempus Pro Telemedicine Sync Queue */}
      <div className="border border-input p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Radio size={14} className="text-state" />
          <span className="medbay-micro">Tempus Pro telemedicine sync queue (store-and-forward)</span>
          <span className="flex-1" />
          {queue && (
            <span className="medbay-micro text-foreground/60">
              Window {queue.comm_window_open ? "OPEN" : "BLACKOUT"} · lat{" "}
              {queue.earth_comm_latency_sec}s · pending {queue.pending_count} ·
              transmitted {queue.transmitted_count}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => void loadQueue()} disabled={queueLoading || !provider}>
            <RefreshCw size={11} />
            Refresh queue
          </Button>
        </div>

        {queue && (
          <p className="mt-2 text-[13px] text-foreground/70">
            {technical ? queue.technical : queue.high_level}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            type="text"
            aria-label="Ground station"
            value={groundStation}
            onChange={(e) => setGroundStation(e.target.value)}
            placeholder="MCC-Houston-DSN"
            className="w-52"
          />
          <Button disabled={flushing || !provider} onClick={() => void flushQueue(false)}>
            <Send size={11} />
            {flushing ? "Relaying…" : "Flush pending"}
          </Button>
          <Button variant="outline" disabled={flushing || !provider} onClick={() => void flushQueue(true)}>
            Force flush (override blackout)
          </Button>
        </div>

        {queueError && (
          <p className="medbay-micro mt-3 text-risk" role="alert">{queueError}</p>
        )}

        {flushResult && (
          <div className="mt-3 border border-ok p-3" role="status">
            <div className="medbay-micro text-ok">
              Flush complete · {flushResult.flushed_count} packet(s) →{" "}
              {flushResult.ground_station} · remaining {flushResult.remaining_pending_count}
            </div>
            <p className="mt-1 text-[12px] text-foreground/70">
              {technical ? flushResult.technical : flushResult.high_level}
            </p>
          </div>
        )}

        {queue && queue.packets.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="medbay-copy w-full text-[13px]">
              <thead>
                <tr className="medbay-micro text-foreground/60">
                  <th className="pb-2 text-left font-normal">ID</th>
                  <th className="pb-2 text-left font-normal">Crew</th>
                  <th className="pb-2 text-left font-normal">Priority</th>
                  <th className="pb-2 text-left font-normal">Status</th>
                  <th className="pb-2 text-left font-normal">Anomalies</th>
                  <th className="pb-2 text-left font-normal">Time</th>
                </tr>
              </thead>
              <tbody>
                {queue.packets.slice(0, 12).map((pkt) => (
                  <tr key={pkt.packet_id} className="border-t border-input">
                    <td className="py-2">#{pkt.packet_id}</td>
                    <td className="py-2">{pkt.astronaut_id}</td>
                    <td className="py-2">
                      <StatusChip
                        level={
                          pkt.priority === "CRITICAL" ? "CRITICAL" : pkt.priority === "HIGH" ? "CAUTION" : "NOMINAL"
                        }
                      />
                    </td>
                    <td className="py-2">
                      <span className={cn("medbay-micro", pkt.transmission_status === "transmitted" ? "text-ok" : "text-risk")}>
                        {pkt.transmission_status.toUpperCase()}
                      </span>
                    </td>
                    <td className="max-w-[320px] py-2">{pkt.anomaly_flags.join(", ") || "Standard packet"}</td>
                    <td className="py-2">{new Date(pkt.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="medbay-micro mt-3 text-foreground/50">
            {queueLoading ? "Loading telemedicine queue…" : "No packets in queue."}
          </p>
        )}

        <p className="medbay-micro mt-3 text-foreground/45">
          Off-nominal triage events enqueue automatically for Earth Mission
          Control store-and-forward delivery across high-latency/blackout links.
        </p>
      </div>
    </div>
  );
}

export default function LogPage() {
  return (
    <Suspense fallback={<div className="empty-state mono">LOADING…</div>}>
      <LogInner />
    </Suspense>
  );
}
