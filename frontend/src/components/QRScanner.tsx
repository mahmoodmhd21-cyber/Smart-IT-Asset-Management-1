import { useEffect, useId, useRef, useState } from "react";
import { Camera, Square } from "lucide-react";

type Scanner = InstanceType<(typeof import("html5-qrcode"))["Html5Qrcode"]>;
type Session = {
  cancelled: boolean;
  decoded: boolean;
  started: boolean;
  element: HTMLDivElement | null;
  width: number;
  ready: Promise<void>;
  scanner?: Scanner;
  cleanup?: Promise<void>;
};

export default function QRScanner({ onDecode }: { onDecode: (value: string) => Promise<void> }) {
  const id = `qr-reader-${useId().replace(/:/g, "")}`;
  const host = useRef<HTMLDivElement>(null);
  const session = useRef<Session | null>(null);
  const mounted = useRef(false);
  const [phase, setPhase] = useState<"off" | "starting" | "running" | "stopping">("off");
  const [error, setError] = useState("");

  // Serialize cleanup behind startup: stop() throws while permission/start is pending.
  function dispose(current: Session) {
    current.cancelled = true;
    if (!current.cleanup) {
      const element = current.element;
      // Keep an in-flight video render attached until the library finishes starting.
      // This is an imperative child, never a node owned by React.
      if (element && !element.isConnected) {
        Object.assign(element.style, { position: "fixed", left: "-10000px", width: `${current.width}px` });
        document.body.appendChild(element);
      }
      current.cleanup = (async () => {
        await current.ready.catch(() => undefined);
        try {
          // start() can resolve before the first video frame sets isScanning.
          if (current.started) await current.scanner?.stop();
        } finally {
          // Release any remaining stream even if library DOM cleanup fails.
          element?.querySelectorAll("video").forEach(video => {
            (video.srcObject as MediaStream | null)?.getTracks().forEach(track => track.stop());
          });
          try { current.scanner?.clear(); } catch { /* Host may already be unmounted. */ }
          element?.remove();
        }
      })().catch(() => undefined);
    }
    return current.cleanup;
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (session.current) void dispose(session.current);
    };
  }, []);

  async function stop() {
    const current = session.current;
    if (!current) return;
    setPhase("stopping");
    await dispose(current);
    if (session.current === current) session.current = null;
    if (mounted.current) setPhase("off");
  }

  async function start() {
    if (session.current) return;
    const element = document.createElement("div");
    element.id = id;
    element.style.height = "100%";
    host.current?.appendChild(element);
    const current: Session = { cancelled: false, decoded: false, started: false, element, width: element.clientWidth || 300, ready: Promise.resolve() };
    session.current = current;
    setError("");
    setPhase("starting");
    current.ready = (async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access requires a supported browser and HTTPS (or localhost).");
      const { Html5Qrcode } = await import("html5-qrcode");
      if (current.cancelled) return;
      const scanner = new Html5Qrcode(id);
      current.scanner = scanner;
      await scanner.start({ facingMode: "environment" }, { fps: 10 }, value => {
        if (current.cancelled || current.decoded) return;
        current.decoded = true;
        // A decoder can report the same label every frame; only look it up once.
        void stop().then(() => {
          if (mounted.current) return onDecode(value);
        }).catch(err => {
          if (mounted.current) setError(String(err));
        });
      }, () => undefined);
      current.started = true;
      // html5-qrcode does not await video.play(); stopping earlier rejects its promise.
      const video = element.querySelector("video");
      if (video && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        await new Promise<void>(resolve => {
          const finish = () => {
            clearTimeout(timer);
            video.removeEventListener("playing", finish);
            video.removeEventListener("error", finish);
            resolve();
          };
          const timer = window.setTimeout(finish, 2000);
          video.addEventListener("playing", finish, { once: true });
          video.addEventListener("error", finish, { once: true });
        });
      }
    })();
    try {
      await current.ready;
      if (!current.cancelled && mounted.current) setPhase("running");
    } catch (err) {
      const cancelled = current.cancelled;
      await dispose(current);
      if (session.current === current) session.current = null;
      if (mounted.current && !cancelled) {
        setPhase("off");
        setError(`Camera could not start: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return <>
    <div className="relative w-full min-w-0 min-h-[280px] overflow-hidden rounded-lg bg-gray-950 text-white" style={{ aspectRatio: "16 / 9" }}>
      {/* Only html5-qrcode owns this element's children. React's overlay is a sibling. */}
      <div ref={host} className="absolute inset-0 w-full [&_video]:!w-full [&_video]:!h-full [&_video]:object-contain" />
      {phase !== "running" && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-gray-950 text-gray-400" role="status">
        <Camera className="mb-3" size={42} strokeWidth={1.4} />
        <p className="text-sm">{phase === "off" ? "Camera is off" : phase === "starting" ? "Starting camera..." : "Stopping camera..."}</p>
      </div>}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <div className="mt-4 flex gap-2">
      {phase === "off" ? <button onClick={() => void start()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"><Camera size={16} />Start camera</button>
        : <button onClick={() => void stop()} disabled={phase === "stopping"} className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Square size={15} />Stop camera</button>}
    </div>
  </>;
}
