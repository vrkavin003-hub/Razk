import { Camera, CameraOff, RefreshCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { attendanceWatermarkLines } from "../utils/attendancePhoto";
import { getDeviceInfo } from "../utils/device";
import Button from "./Button";

const MAX_CAPTURE_DIMENSION = 1280;
const CAMERA_JPEG_QUALITY = 0.82;

const canvasFile = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to capture attendance photo"));
          return;
        }
        resolve(new File([blob], `attendance-capture-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      CAMERA_JPEG_QUALITY
    );
  });

export default function AttendanceCamera({
  disabled = false,
  location,
  onChange,
  photo,
  site = ""
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fallbackInputRef = useRef(null);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const liveTimestampRef = useRef(new Date());
  const [open, setOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [starting, setStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [liveTimestamp, setLiveTimestamp] = useState(liveTimestampRef.current);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const closeCamera = () => {
    requestRef.current += 1;
    stopCamera();
    setOpen(false);
    setStarting(false);
    setCapturing(false);
  };

  const startCamera = async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setCameraError("");
    setStarting(true);
    liveTimestampRef.current = new Date();
    setLiveTimestamp(liveTimestampRef.current);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Direct camera access is not supported. Use the device camera fallback.");
      setStarting(false);
      return;
    }

    try {
      setOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "user" } }
      });
      if (!mountedRef.current || requestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
    } catch {
      if (mountedRef.current && requestRef.current === requestId) {
        setOpen(false);
        setCameraError("Camera permission was denied or the camera is unavailable. Use the device camera fallback.");
      }
    } finally {
      if (mountedRef.current && requestRef.current === requestId) setStarting(false);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError("Camera is not ready. Please try again.");
      return;
    }
    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, MAX_CAPTURE_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to prepare camera capture");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const file = await canvasFile(canvas);
      if (mountedRef.current) {
        onChange({
          capturedAt: new Date(liveTimestampRef.current),
          file,
          location
        });
        closeCamera();
      }
    } catch (error) {
      setCameraError(error.message || "Unable to capture attendance photo");
      setCapturing(false);
    }
  };

  const useFallbackFile = (event) => {
    const file = event.target.files?.[0];
    if (file && !file.type?.startsWith("image/")) {
      setCameraError("Attendance photo must be an image.");
    } else if (file && file.size > 5 * 1024 * 1024) {
      setCameraError("Attendance photo must be below 5 MB.");
    } else if (file) {
      setCameraError("");
      onChange({ capturedAt: new Date(), file, location });
    }
    event.target.value = "";
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      stopCamera();
    };
  }, []);
  useEffect(() => {
    if (open && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [open, starting]);
  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setInterval(() => {
      liveTimestampRef.current = new Date();
      setLiveTimestamp(liveTimestampRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const watermarkLines = attendanceWatermarkLines({
    capturedAt: liveTimestamp,
    deviceName: getDeviceInfo().deviceName,
    location,
    site
  });

  return (
    <>
      <input
        ref={fallbackInputRef}
        accept="image/*"
        capture="user"
        className="hidden"
        disabled={disabled}
        type="file"
        onChange={useFallbackFile}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={disabled || starting} icon={photo ? RefreshCcw : Camera} onClick={startCamera} variant="secondary">
          {starting ? "Opening Camera..." : photo ? "Retake Photo" : "Take Attendance Photo"}
        </Button>
        <Button disabled={disabled} icon={CameraOff} onClick={() => fallbackInputRef.current?.click()} variant="ghost">
          Camera Fallback
        </Button>
        {photo ? (
          <Button icon={X} onClick={() => onChange(null)} variant="ghost">
            Remove
          </Button>
        ) : null}
      </div>
      {photo?.file ? <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-300">Photo captured and ready for check-in.</p> : null}
      {cameraError ? <p className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-200">{cameraError}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4">
          <section className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-950 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-white">Attendance Camera</h2>
                <p className="text-xs font-semibold text-slate-300">Position your face clearly, then capture the photo.</p>
              </div>
              <Button icon={X} onClick={closeCamera} size="icon" variant="ghost" aria-label="Close camera" />
            </div>
            {starting ? (
              <div className="grid h-64 place-items-center rounded-lg bg-black text-sm font-semibold text-slate-300">
                Waiting for camera permission...
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-lg bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="max-h-[65vh] w-full scale-x-[-1] object-contain"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2 text-left text-[11px] font-bold leading-4 text-white sm:px-4 sm:py-3 sm:text-xs sm:leading-5">
                  {watermarkLines.map((line) => <p key={line}>{line}</p>)}
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button disabled={capturing} onClick={closeCamera} variant="secondary">Cancel</Button>
              <Button disabled={starting || capturing} icon={Camera} onClick={capture}>
                {capturing ? "Capturing..." : "Capture"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
