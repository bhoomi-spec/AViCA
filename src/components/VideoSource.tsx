import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CameraOff,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

export type VideoInputMode = 'SIMULATOR' | 'WEBCAM' | 'VIDEO_FILE';

interface VideoSourceProps {
  mode: VideoInputMode;
  onFrame: (source: HTMLVideoElement, isLive: boolean) => void;
  onError?: (error: Error) => void;
  onModeChange?: (mode: VideoInputMode) => void;
  onStreamActiveChange?: (isActive: boolean) => void;
}

export const VideoSource: React.FC<VideoSourceProps> = ({
  mode,
  onFrame,
  onError,
  onModeChange,
  onStreamActiveChange,
}) => {
  // Processing video element ref & MediaStream reference
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Concurrency & session identifiers to prevent race conditions & AbortError
  const activeSessionIdRef = useRef<number>(0);
  const isInitializingRef = useRef<boolean>(false);

  // Keep latest callbacks in refs so effects and async tasks never trigger re-execution loops
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onModeChangeRef = useRef(onModeChange);
  onModeChangeRef.current = onModeChange;
  const onStreamActiveChangeRef = useRef(onStreamActiveChange);
  onStreamActiveChangeRef.current = onStreamActiveChange;

  // Visual status states
  const [webcamStreaming, setWebcamStreaming] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasReceivedFrames, setHasReceivedFrames] = useState<boolean>(false);

  // Tracking flags in refs to prevent triggering React state updates on every frame
  const hasReceivedFramesRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const lastProcessTimeRef = useRef<number>(0);
  const targetFrameIntervalMs = 1000 / 30; // 30 FPS processing target

  // Clean and safe stream shutdown helper
  const stopWebcam = useCallback(() => {
    // Invalidate any in-flight initialization attempts
    activeSessionIdRef.current++;
    isInitializingRef.current = false;

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const wasActive = streamRef.current !== null || hasReceivedFramesRef.current;

    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }

    if (webcamVideoRef.current) {
      try {
        webcamVideoRef.current.pause();
        webcamVideoRef.current.srcObject = null;
      } catch {
        // ignore
      }
    }

    hasReceivedFramesRef.current = false;

    // Only update states if they were actually true to prevent unnecessary re-renders
    setWebcamStreaming((prev) => (prev ? false : prev));
    setHasReceivedFrames((prev) => (prev ? false : prev));

    if (wasActive) {
      onStreamActiveChangeRef.current?.(false);
    }
  }, []);

  // Request & initialize webcam MediaStream via getUserMedia
  const startWebcam = useCallback(async () => {
    // Prevent overlapping initialization attempts
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    // Increment session ID to cancel any prior asynchronous operations
    const sessionId = ++activeSessionIdRef.current;

    // Tear down any existing stream before initiating new one
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }

    setCameraError(null);
    setPermissionDenied(false);

    if (!navigator?.mediaDevices?.getUserMedia) {
      isInitializingRef.current = false;
      const err = new Error('MediaDevices getUserMedia API is not supported in this browser.');
      setCameraError(err.message);
      onErrorRef.current?.(err);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 400 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Check if session was superseded or cancelled while awaiting getUserMedia
      if (activeSessionIdRef.current !== sessionId) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
        isInitializingRef.current = false;
        return;
      }

      streamRef.current = stream;

      const video = webcamVideoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
        isInitializingRef.current = false;
        return;
      }

      video.srcObject = stream;

      // Wait for loadedmetadata event before attempting play() to prevent AbortError
      await new Promise<void>((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          resolve();
        } else {
          const onMeta = () => {
            video.removeEventListener('loadedmetadata', onMeta);
            resolve();
          };
          video.addEventListener('loadedmetadata', onMeta, { once: true });
        }
      });

      if (activeSessionIdRef.current !== sessionId) {
        isInitializingRef.current = false;
        return;
      }

      try {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
      } catch (playErr: unknown) {
        const err = playErr instanceof Error ? playErr : new Error(String(playErr));
        if (err.name === 'AbortError') {
          // Harmless play interruption by newer load request or navigation
          isInitializingRef.current = false;
          return;
        }
        throw err;
      }

      if (activeSessionIdRef.current !== sessionId) {
        isInitializingRef.current = false;
        return;
      }

      setWebcamStreaming(true);
    } catch (err: unknown) {
      if (activeSessionIdRef.current !== sessionId) {
        isInitializingRef.current = false;
        return;
      }

      const error = err instanceof Error ? err : new Error(String(err));

      if (error.name === 'AbortError') {
        isInitializingRef.current = false;
        return;
      }

      console.warn('Webcam stream acquisition failed:', error);

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setCameraError('Camera access was denied. Enable camera permissions to use live perception.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraError('No camera hardware device found on this system.');
      } else {
        setCameraError(error.message || 'Camera acquisition failed.');
      }

      onErrorRef.current?.(error);
    } finally {
      if (activeSessionIdRef.current === sessionId) {
        isInitializingRef.current = false;
      }
    }
  }, []);

  // Stable lifecycle effect: depends strictly on mode
  useEffect(() => {
    if (mode === 'WEBCAM') {
      startWebcam();
    } else {
      stopWebcam();
      setCameraError(null);
      setPermissionDenied(false);
    }

    return () => {
      stopWebcam();
    };
  }, [mode, startWebcam, stopWebcam]);

  // Frame capture loop: drops stale frames, runs at 30 FPS, and handles frame exceptions cleanly
  useEffect(() => {
    if (mode !== 'WEBCAM' || !webcamStreaming) return;

    let active = true;

    const pumpWebcamFrame = (timestamp: number) => {
      if (!active) return;

      const video = webcamVideoRef.current;
      if (
        video &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        const elapsed = timestamp - lastProcessTimeRef.current;
        if (elapsed >= targetFrameIntervalMs && !isProcessingRef.current) {
          isProcessingRef.current = true;
          lastProcessTimeRef.current = timestamp;

          if (!hasReceivedFramesRef.current) {
            hasReceivedFramesRef.current = true;
            setHasReceivedFrames(true);
            onStreamActiveChangeRef.current?.(true);
          }

          try {
            onFrameRef.current(video, true);
          } catch (frameErr) {
            console.warn('Error processing optical frame in AViCA loop:', frameErr);
          } finally {
            isProcessingRef.current = false;
          }
        }
      }

      if (active) {
        animFrameRef.current = requestAnimationFrame(pumpWebcamFrame);
      }
    };

    animFrameRef.current = requestAnimationFrame(pumpWebcamFrame);

    return () => {
      active = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [mode, webcamStreaming, targetFrameIntervalMs]);

  return (
    <div className="relative">
      {/* Hidden processing video element - NEVER rendered into visual UI, no autoPlay attribute */}
      <video
        ref={webcamVideoRef}
        playsInline
        muted
        className="hidden pointer-events-none absolute w-0 h-0 opacity-0 -z-50"
      />

      {/* Small status banner ABOVE the existing cognitive architecture and workspace */}
      {/* State 1: Permission Denied */}
      {mode === 'WEBCAM' && permissionDenied && (
        <div className="mb-4 px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-950/20 text-xs text-rose-200 flex flex-wrap items-center justify-between gap-3 shadow-md backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-semibold text-rose-300 uppercase tracking-wide text-[11px]">
                CAMERA ACCESS DENIED
              </span>
              <span className="text-slate-300 text-[11px]">
                Enable camera permissions to use live perception.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => startWebcam()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium border border-rose-500/30 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Retry Camera
            </button>
            <button
              onClick={() => onModeChangeRef.current?.('SIMULATOR')}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition-colors"
            >
              Use Simulator
            </button>
          </div>
        </div>
      )}

      {/* State 2: Camera Hardware or Generic Error */}
      {mode === 'WEBCAM' && !permissionDenied && cameraError && (
        <div className="mb-4 px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-950/20 text-xs text-rose-200 flex flex-wrap items-center justify-between gap-3 shadow-md backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-semibold text-rose-300 uppercase tracking-wide text-[11px]">
                CAMERA ERROR
              </span>
              <span className="text-slate-300 text-[11px]">{cameraError}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => startWebcam()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium border border-rose-500/30 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Retry Camera
            </button>
            <button
              onClick={() => onModeChangeRef.current?.('SIMULATOR')}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition-colors"
            >
              Use Simulator
            </button>
          </div>
        </div>
      )}

      {/* State 3: Stream running and frames actively being captured */}
      {mode === 'WEBCAM' && webcamStreaming && hasReceivedFrames && !cameraError && (
        <div className="mb-4 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs flex flex-wrap items-center justify-between gap-3 shadow-md backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-semibold text-slate-200 tracking-wide uppercase text-[11px]">
                LIVE CAMERA SENSOR ACTIVE
              </span>
              <span className="text-slate-400 text-[11px]">
                Processing real camera frames through the AViCA perception pipeline.
              </span>
            </div>
          </div>
          <button
            onClick={() => onModeChangeRef.current?.('SIMULATOR')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-medium"
          >
            <CameraOff className="h-3 w-3 text-slate-400" />
            <span>Switch to Simulator</span>
          </button>
        </div>
      )}
    </div>
  );
};
