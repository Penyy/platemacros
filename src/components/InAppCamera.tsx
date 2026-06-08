import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function InAppCamera({ open, onClose, onCapture }: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  // Always release camera
  const stop = () => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* noop */
    }
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
    setReady(false);
  };

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    if (!navigator?.mediaDevices?.getUserMedia) {
      toast.error(t("scan.cameraUnavail"));
      onClose();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.setAttribute("playsinline", "true");
          v.setAttribute("webkit-playsinline", "true");
          v.muted = true;
          v.srcObject = stream;
          try {
            await v.play();
          } catch {
            /* noop */
          }
        }
        // Best-effort advanced constraints — never crash on iOS
        const track = stream.getVideoTracks()[0];
        if (track) {
          try {
            await track.applyConstraints({
              advanced: [
                { focusMode: "continuous" } as unknown as MediaTrackConstraintSet,
              ],
            });
          } catch {
            /* unsupported */
          }
        }
        setReady(true);
      } catch (e: unknown) {
        const err = e as { name?: string };
        if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
          toast.error(t("scan.permission"));
        } else if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
          toast.error(t("scan.errNotFoundCam"));
        } else if (err?.name === "NotReadableError") {
          toast.error(t("scan.errNotReadable"));
        } else {
          toast.error(t("scan.errGeneric"));
        }
        onClose();
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleShutter = async () => {
    if (busy) return;
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    setBusy(true);
    try {
      const maxDim = 1280;
      const scale = Math.min(1, maxDim / Math.max(v.videoWidth, v.videoHeight));
      const w = Math.round(v.videoWidth * scale);
      const h = Math.round(v.videoHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setBusy(false);
        return;
      }
      ctx.drawImage(v, 0, 0, w, h);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8),
      );
      if (!blob) {
        setBusy(false);
        return;
      }
      const file = new File([blob], `photo-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      onCapture(file);
      stop();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => {
            stop();
            onClose();
          }}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"
          aria-label={t("scan.closeCamera")}
        >
          <X size={20} />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {!ready && (
          <div className="absolute inset-0 grid place-items-center text-white/80 text-sm">
            …
          </div>
        )}
      </div>
      <div
        className="flex items-center justify-center px-4 py-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <button
          type="button"
          onClick={handleShutter}
          disabled={!ready || busy}
          className="grid h-20 w-20 place-items-center rounded-full bg-white text-black disabled:opacity-40"
          aria-label={t("scan.shutter")}
        >
          <Camera size={28} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
