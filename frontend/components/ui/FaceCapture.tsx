"use client";

/**
 * FaceCapture — webcam preview in a HUD frame.
 *  mode="capture": snapshot → compressed JPEG dataURL (register flow).
 *  mode="scan":    captures a live frame after scanDurationMs and passes it to onScanComplete(dataUrl).
 */

import { Camera, ImageUp, RefreshCw, ScanFace } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type CamStatus = "idle" | "requesting" | "live" | "denied" | "unsupported";

const MAX_EDGE = 360;
const JPEG_QUALITY = 0.82;

function downscaleToDataUrl(
  source: HTMLVideoElement | HTMLImageElement,
  w: number,
  h: number,
  maxEdge = MAX_EDGE,
): string {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export function FaceCapture({
  mode,
  onCapture,
  onScanComplete,
  autoStart = true,
  scanDurationMs = 1500,
  maxEdge = MAX_EDGE,
  onStatusChange,
  captureLabel = "Capture",
  className,
}: {
  mode: "capture" | "scan";
  onCapture?: (dataUrl: string) => void;
  onScanComplete?: (capturedDataUrl?: string) => void;
  autoStart?: boolean;
  scanDurationMs?: number;
  /** Longest edge of the emitted JPEG (face ID uses 360px; evidence more). */
  maxEdge?: number;
  onStatusChange?: (s: CamStatus) => void;
  captureLabel?: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatusRaw] = useState<CamStatus>("idle");
  const statusCb = useRef(onStatusChange);
  useEffect(() => {
    statusCb.current = onStatusChange;
  }, [onStatusChange]);
  const setStatus = useCallback((s: CamStatus) => {
    setStatusRaw(s);
    statusCb.current?.(s);
  }, []);
  const [shot, setShot] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scanned = useRef(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      (typeof window !== "undefined" && !window.isSecureContext)
    ) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setStatus("live");
    } catch {
      setStatus("denied");
    }
  }, [stop, setStatus]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (autoStart) void start();
    }, 0);
    return () => {
      clearTimeout(t);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // scan mode: capture a live JPEG frame once the stream can play
  const handleCanPlay = useCallback(() => {
    if (mode !== "scan" || scanned.current) return;
    scanned.current = true;
    setScanning(true);
    setTimeout(() => {
      const v = videoRef.current;
      let frameUrl: string | undefined;
      if (v && v.videoWidth > 0 && v.videoHeight > 0) {
        frameUrl = downscaleToDataUrl(v, v.videoWidth, v.videoHeight, maxEdge);
      }
      setScanning(false);
      stop();
      onScanComplete?.(frameUrl);
    }, scanDurationMs);
  }, [mode, scanDurationMs, onScanComplete, stop, maxEdge]);

  const capture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const url = downscaleToDataUrl(v, v.videoWidth, v.videoHeight, maxEdge);
    setShot(url);
    stop();
  }, [stop, maxEdge]);

  const confirmShot = useCallback(() => {
    if (shot) onCapture?.(shot);
  }, [shot, onCapture]);

  const retake = useCallback(() => {
    setShot(null);
    void start();
  }, [start]);

  const upload = useCallback(
    (file: File) => {
      const img = new Image();
      img.onload = () => {
        const url = downscaleToDataUrl(img, img.naturalWidth, img.naturalHeight, maxEdge);
        URL.revokeObjectURL(img.src);
        setShot(url);
        stop();
        if (mode === "scan") {
          scanned.current = true;
          onScanComplete?.(url);
        } else {
          onCapture?.(url);
        }
      };
      img.src = URL.createObjectURL(file);
    },
    [mode, onCapture, onScanComplete, stop, maxEdge],
  );

  return (
    <div className={`face-capture${className ? ` ${className}` : ""}`}>
      <div className="face-frame">
        {/* HUD corner reticle */}
        <span className="face-corner tl" aria-hidden />
        <span className="face-corner tr" aria-hidden />
        <span className="face-corner bl" aria-hidden />
        <span className="face-corner br" aria-hidden />

        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt="Captured face" className="face-media" />
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            onCanPlay={handleCanPlay}
            className="face-media"
            aria-label="Camera preview"
          />
        )}

        {(status === "requesting" || status === "idle") && (
          <div className="face-overlay">
            <Camera size={16} />
            <span className="micro-8">REQUESTING CAMERA…</span>
          </div>
        )}
        {(status === "denied" || status === "unsupported") && (
          <div className="face-overlay">
            <ScanFace size={16} style={{ color: "var(--status-urgent)" }} />
            <span className="micro-8">
              {status === "denied"
                ? "CAMERA DENIED — allow access or upload a photo"
                : "CAMERA UNAVAILABLE — upload a photo instead"}
            </span>
          </div>
        )}
        {scanning && (
          <div className="face-scanline" aria-hidden>
            <span className="micro-8 face-scan-label">IDENTIFYING…</span>
          </div>
        )}
      </div>

      <div className="face-actions">
        {mode === "capture" && !shot && status === "live" && (
          <Button type="button" onClick={capture}>
            <Camera size={12} /> {captureLabel}
          </Button>
        )}
        {shot && mode === "capture" && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={retake}>
              <RefreshCw size={11} /> Retake
            </Button>
            <Button type="button" onClick={confirmShot}>
              Use photo
            </Button>
          </>
        )}
        {mode === "capture" && !shot && status !== "live" && status !== "requesting" && (
          <Button type="button" variant="outline" size="sm" onClick={() => void start()}>
            <Camera size={11} /> Retry camera
          </Button>
        )}
        {mode === "capture" && (
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <ImageUp size={11} /> Upload
          </Button>
        )}
        {mode === "scan" && scanning && (
          <span className="micro-8">VISUAL ID · ANALYZING FACE</span>
        )}
        {mode === "scan" && !scanning && (
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <ImageUp size={11} /> Upload photo
          </Button>
        )}
        {mode === "scan" && (status === "denied" || status === "unsupported") && (
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => {
              scanned.current = true;
              stop();
              onScanComplete?.(undefined);
            }}
          >
            <ScanFace size={11} /> Login manually
          </Button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      <div className="micro-8" style={{ color: "var(--dim)" }}>
        {mode === "scan"
          ? "LOCAL BIOMETRIC ID — OpenCV YuNet + SFace matching"
          : "FACE EMBEDDING SAVED TO BACKEND FACE_CREDENTIALS"}
      </div>
    </div>
  );
}
