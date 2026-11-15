"use client";

/**
 * /log — telemetry ingest & Tempus Pro telemedicine sync console (module E host).
 */

import { Radio, RefreshCw, Send } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import {
  Disclaimer,
  Eyebrow,
  StatusChip,
} from "@/components/ui/primitives";
import { TelemetryLogger } from "@/components/widgets/TelemetryLogger";
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
  const [crewId, setCrewId] = useState(params.get("crew") ?? "AST-01");

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
    <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Eyebrow>Telemetry log / ingest console</Eyebrow>
        <select
          className="ctx-select"
          style={{ marginLeft: "auto" }}
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

      {/* Tempus Pro Telemedicine Sync Queue (Postman #27 & #28) */}
      <div className="panel panel-pad">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Radio size={14} style={{ color: "var(--accent)" }} />
          <Eyebrow>Tempus Pro telemedicine sync queue (store-and-forward)</Eyebrow>
          <span style={{ flex: 1 }} />
          {queue && (
            <span className="micro-8">
              WINDOW {queue.comm_window_open ? "OPEN" : "BLACKOUT"} · LAT{" "}
              {queue.earth_comm_latency_sec}s · PENDING {queue.pending_count} ·
              TRANSMITTED {queue.transmitted_count}
            </span>
          )}
          <button
            className="btn"
            onClick={() => void loadQueue()}
            disabled={queueLoading || !provider}
          >
            <RefreshCw size={11} />
            Refresh Queue
          </button>
        </div>

        {queue && (
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            {technical ? queue.technical : queue.high_level}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <input
            type="text"
            aria-label="Ground station"
            value={groundStation}
            onChange={(e) => setGroundStation(e.target.value)}
            placeholder="MCC-Houston-DSN"
            style={{ width: 200 }}
          />
          <button
            className="btn btn-primary"
            disabled={flushing || !provider}
            onClick={() => void flushQueue(false)}
          >
            <Send size={11} />
            {flushing ? "Relaying…" : "Flush Pending (#28)"}
          </button>
          <button
            className="btn"
            disabled={flushing || !provider}
            onClick={() => void flushQueue(true)}
          >
            Force Flush (Override Blackout)
          </button>
        </div>

        {queueError && (
          <p className="micro" role="alert" style={{ marginTop: 10, color: "var(--status-critical)" }}>
            {queueError}
          </p>
        )}

        {flushResult && (
          <div className="callout" style={{ marginTop: 12 }} role="status">
            <div className="micro-8" style={{ color: "var(--status-nominal)" }}>
              FLUSH COMPLETE · {flushResult.flushed_count} PACKET(S) →{" "}
              {flushResult.ground_station} · REMAINING{" "}
              {flushResult.remaining_pending_count}
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              {technical ? flushResult.technical : flushResult.high_level}
            </p>
          </div>
        )}

        {queue && queue.packets.length > 0 ? (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="spec-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Crew</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Anomalies</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {queue.packets.slice(0, 12).map((pkt) => (
                  <tr key={pkt.packet_id}>
                    <td>#{pkt.packet_id}</td>
                    <td>{pkt.astronaut_id}</td>
                    <td>
                      <StatusChip
                        level={
                          pkt.priority === "CRITICAL"
                            ? "CRITICAL"
                            : pkt.priority === "HIGH"
                              ? "CAUTION"
                              : "NOMINAL"
                        }
                      />
                    </td>
                    <td>
                      <span
                        className="micro-8"
                        style={{
                          color:
                            pkt.transmission_status === "transmitted"
                              ? "var(--status-nominal)"
                              : "var(--status-caution)",
                        }}
                      >
                        {pkt.transmission_status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      {pkt.anomaly_flags.join(", ") || "Standard packet"}
                    </td>
                    <td>{new Date(pkt.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="micro-8" style={{ marginTop: 12, color: "var(--dim)" }}>
            {queueLoading ? "LOADING TELEMEDICINE QUEUE…" : "NO PACKETS IN QUEUE."}
          </p>
        )}

        <div style={{ marginTop: 12 }}>
          <Disclaimer>
            Off-nominal triage events enqueue automatically for Earth Mission
            Control store-and-forward delivery across high-latency/blackout links.
          </Disclaimer>
        </div>
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
