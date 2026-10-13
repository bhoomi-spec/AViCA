import React, { useRef, useEffect, useState } from 'react';
import {
  Eye,
  Crosshair,
  Compass,
  Database,
  Layers,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Activity,
  Zap,
} from 'lucide-react';
import {
  AgentActionDecision,
  CandidateRegion,
  PredictionState,
  WorkingMemoryEntity,
  CognitiveCycleResult,
} from '../types/avica';
import { CognitiveStateCard } from './CognitiveStateCard';
import { VWMConstellation } from './VWMConstellation';
import { CognitiveTimeline } from './CognitiveTimeline';
import { CognitiveVisualStoryStrip } from './CognitiveVisualStoryStrip';

import { VideoInputMode } from './VideoSource';

interface ObserveViewProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  result: CognitiveCycleResult;
  onSelectEntity: (entity: WorkingMemoryEntity) => void;
  onSelectCandidate: (candidate: CandidateRegion) => void;
  selectedEntityId?: string;
  groundTruthTargetFound: boolean;
  inputMode?: VideoInputMode;
  isCameraStreaming?: boolean;
  cameraError?: string | null;
}

export const ObserveView: React.FC<ObserveViewProps> = ({
  canvasRef,
  result,
  onSelectEntity,
  onSelectCandidate,
  selectedEntityId,
  groundTruthTargetFound,
  inputMode = 'SIMULATOR',
  isCameraStreaming = false,
  cameraError = null,
}) => {
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetEntity = result.workingMemoryEntities.find((e) => e.isTarget);
  const { candidates, activeDecision, prediction, uncertainty } = result;

  // Progressive Disclosure: Active Instrument in Right Sidebar
  const [activeInstrumentTab, setActiveInstrumentTab] = useState<'STATE' | 'MEMORY' | 'POLICY' | 'ALL'>('STATE');
  const [showTimeline, setShowTimeline] = useState<boolean>(true);

  // Dedicated Real-Time Face-Aligned Biometric Visualization Canvas
  // Active when inputMode is 'WEBCAM' or 'VIDEO_FILE'
  // Raw camera preview is NEVER painted to screen — strictly geometric & topological graph
  useEffect(() => {
    if (inputMode === 'SIMULATOR') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. Deep Obsidian Scientific Background
    ctx.fillStyle = '#06080f';
    ctx.fillRect(0, 0, w, h);

    // 2. High-precision sensor coordinate grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let x = 0; x <= w; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Polar center crosshair
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)';
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const face = result.detectedFaceGeometry;

    if (face && face.isDetected) {
      const isStale = !!face.isStale;

      // 3a. Trajectory history path of face centroid (past 20 frames)
      if (face.trackingTrajectory && face.trackingTrajectory.length > 1) {
        ctx.beginPath();
        face.trackingTrajectory.forEach((pt, i) => {
          const px = pt.x * w;
          const py = pt.y * h;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = isStale ? 'rgba(251, 191, 36, 0.25)' : 'rgba(34, 211, 238, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 3b. Outer Biometric Facial Contour Wireframe
      if (face.contour && face.contour.length > 2) {
        ctx.beginPath();
        face.contour.forEach((pt, idx) => {
          const px = pt.x * w;
          const py = pt.y * h;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.strokeStyle = isStale ? 'rgba(251, 191, 36, 0.55)' : 'rgba(34, 211, 238, 0.65)';
        ctx.lineWidth = 1.5;
        if (isStale) ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = isStale ? 'rgba(251, 191, 36, 0.03)' : 'rgba(34, 211, 238, 0.04)';
        ctx.fill();
      }

      // 3c. Face Bounding Box Corner Brackets
      const bx = face.boundingBox.x * w;
      const by = face.boundingBox.y * h;
      const bw = face.boundingBox.width * w;
      const bh = face.boundingBox.height * h;
      const brLen = 14;

      ctx.strokeStyle = isStale ? 'rgba(251, 191, 36, 0.7)' : 'rgba(34, 211, 238, 0.8)';
      ctx.lineWidth = 1.5;
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(bx, by + brLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + brLen, by);
      ctx.stroke();
      // Top-Right
      ctx.beginPath();
      ctx.moveTo(bx + bw - brLen, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + brLen);
      ctx.stroke();
      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(bx + bw, by + bh - brLen);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw - brLen, by + bh);
      ctx.stroke();
      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(bx + brLen, by + bh);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx, by + bh - brLen);
      ctx.stroke();

      // Bounding Box Metadata Tag
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillStyle = isStale ? '#fbbf24' : '#22d3ee';
      ctx.fillText(
        `FACE_ROI [${Math.round(bw)}x${Math.round(bh)}px]`,
        bx,
        Math.max(14, by - 6)
      );

      // 3d. Mesh Connections between supported landmarks
      const landmarkMap = new Map<string, { x: number; y: number; pixelX: number; pixelY: number }>();
      face.landmarks.forEach((lm) => landmarkMap.set(lm.id, lm));

      if (face.connections) {
        face.connections.forEach((conn) => {
          const p1 = landmarkMap.get(conn.fromId);
          const p2 = landmarkMap.get(conn.toId);
          if (!p1 || !p2) return;

          ctx.beginPath();
          ctx.moveTo(p1.x * w, p1.y * h);
          ctx.lineTo(p2.x * w, p2.y * h);

          let strokeColor = 'rgba(255, 255, 255, 0.2)';
          if (conn.zone === 'EYES') strokeColor = 'rgba(56, 189, 248, 0.75)';
          else if (conn.zone === 'BROWS') strokeColor = 'rgba(192, 132, 252, 0.75)';
          else if (conn.zone === 'NOSE') strokeColor = 'rgba(34, 211, 238, 0.85)';
          else if (conn.zone === 'MOUTH') strokeColor = 'rgba(244, 63, 94, 0.8)';
          else if (conn.zone === 'JAW') strokeColor = 'rgba(14, 165, 233, 0.7)';

          ctx.strokeStyle = isStale ? 'rgba(251, 191, 36, 0.4)' : strokeColor;
          ctx.lineWidth = conn.zone === 'TRIANGULATION' ? 0.75 : 1.25;
          ctx.stroke();
        });
      }

      // 3e. Landmark Nodes, Halo Rings & Labels
      face.landmarks.forEach((lm) => {
        const lx = lm.x * w;
        const ly = lm.y * h;

        let nodeColor = '#38bdf8';
        if (lm.zone === 'BROWS') nodeColor = '#c084fc';
        else if (lm.zone === 'NOSE') nodeColor = '#22d3ee';
        else if (lm.zone === 'MOUTH') nodeColor = '#f43f5e';
        else if (lm.zone === 'JAW') nodeColor = '#38bdf8';
        else if (lm.zone === 'CONTOUR') nodeColor = '#a855f7';

        if (isStale) nodeColor = '#fbbf24';

        // Outer Target Ring
        ctx.strokeStyle = `${nodeColor}55`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(lx, ly, 5.5, 0, Math.PI * 2);
        ctx.stroke();

        // Inner Solid Node
        ctx.fillStyle = nodeColor;
        ctx.beginPath();
        ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Selective labels for major anatomical landmarks
        if (['L_EYE', 'R_EYE', 'NOSE_TIP', 'MOUTH_L', 'MOUTH_R', 'CHIN'].includes(lm.id)) {
          ctx.font = '9px JetBrains Mono, monospace';
          ctx.fillStyle = `${nodeColor}cc`;
          ctx.fillText(
            `${lm.id} (${(lm.confidence * 100).toFixed(0)}%)`,
            lx + 7,
            ly + 3
          );
        }

        // Instantaneous Motion Vector Arrow (Velocity)
        if (lm.motionVector && (Math.abs(lm.motionVector.dx) > 5 || Math.abs(lm.motionVector.dy) > 5)) {
          const vx = (lm.motionVector.dx / w) * 15;
          const vy = (lm.motionVector.dy / h) * 15;
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + vx, ly + vy);
          ctx.stroke();
        }
      });

      // 3f. Centroid Velocity Vector
      if (face.motionVector && face.motionVector.speed > 5) {
        const cx = face.centroid.x * w;
        const cy = face.centroid.y * h;
        const vvx = (face.motionVector.dx / w) * 25;
        const vvy = (face.motionVector.dy / h) * 25;
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + vvx, cy + vvy);
        ctx.stroke();
      }

      // 3g. Biometric Head Pose HUD (Top-Right)
      const hudX = w - 195;
      const hudY = 12;
      ctx.fillStyle = 'rgba(7, 10, 18, 0.9)';
      ctx.strokeStyle = isStale ? 'rgba(251, 191, 36, 0.35)' : 'rgba(34, 211, 238, 0.3)';
      ctx.lineWidth = 1;
      ctx.fillRect(hudX, hudY, 185, 110);
      ctx.strokeRect(hudX, hudY, 185, 110);

      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillStyle = isStale ? '#fbbf24' : '#22d3ee';
      ctx.fillText(isStale ? 'FACE GEOMETRY (STALE)' : 'BIOMETRIC HEAD POSE', hudX + 10, hudY + 16);

      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`STATUS: ${isStale ? 'STALE / FROZEN' : 'LIVE DETECTED'}`, hudX + 10, hudY + 30);
      ctx.fillText(`YAW:    ${face.poseEstimate.yawDeg > 0 ? '+' : ''}${face.poseEstimate.yawDeg}°`, hudX + 10, hudY + 44);
      ctx.fillText(`PITCH:  ${face.poseEstimate.pitchDeg > 0 ? '+' : ''}${face.poseEstimate.pitchDeg}°`, hudX + 10, hudY + 58);
      ctx.fillText(`ROLL:   ${face.poseEstimate.rollDeg > 0 ? '+' : ''}${face.poseEstimate.rollDeg}°`, hudX + 10, hudY + 72);
      ctx.fillText(`SPEED:  ${isStale ? '0.0' : face.motionVector.speed.toFixed(1)} px/s`, hudX + 10, hudY + 86);
      ctx.fillText(`CONF:   ${(face.overallConfidence * 100).toFixed(0)}% (${face.landmarks.length} pts)`, hudX + 10, hudY + 100);

      // Stale Watermark if camera is disconnected
      if (isStale) {
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('STALE / LAST OBSERVED FRAME', 16, 28);
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillStyle = '#94a3b8';
        const staleTime = face.staleTimestamp ? new Date(face.staleTimestamp).toLocaleTimeString() : new Date(face.timestamp).toLocaleTimeString();
        ctx.fillText(`Camera halted · Geometry frozen at ${staleTime}`, 16, 42);
      }
    } else {
      // No face detected or camera waiting for input
      if (isCameraStreaming) {
        // Camera is active, genuine frames are processing, but no face is in frame
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 110, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = 'bold 13px JetBrains Mono, monospace';
        ctx.fillStyle = '#22d3ee';
        ctx.textAlign = 'center';
        ctx.fillText('NO FACE DETECTED', w / 2, h / 2 - 14);
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Processing genuine camera frames · No subject in sensory cone', w / 2, h / 2 + 8);
        ctx.fillText('Biometric landmarks will lock onto face once subject is present', w / 2, h / 2 + 24);
        ctx.textAlign = 'left';
      } else {
        // Camera disconnected / waiting for input
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(w / 2 - 200, h / 2 - 55, 400, 110);
        ctx.fillStyle = 'rgba(10, 14, 24, 0.9)';
        ctx.fillRect(w / 2 - 200, h / 2 - 55, 400, 110);

        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillStyle = cameraError ? '#f87171' : '#f87171';
        ctx.textAlign = 'center';
        ctx.fillText(cameraError ? 'CAMERA ACCESS DENIED' : 'CAMERA DISCONNECTED / WAITING FOR LIVE INPUT', w / 2, h / 2 - 22);
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Camera is currently disabled · No frames are being fabricated', w / 2, h / 2);
        ctx.fillText('Click "LIVE WEBCAM" in navigation header to engage background camera', w / 2, h / 2 + 18);
        ctx.fillText('Raw camera preview remains hidden · Aligned face graph will render live', w / 2, h / 2 + 34);
        ctx.textAlign = 'left';
      }
    }
  }, [inputMode, isCameraStreaming, cameraError, result.detectedFaceGeometry, canvasRef]);

  // Synced High-Precision Attention Overlay Canvas
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Subtle, non-intrusive presentation for passive/unattended candidates
    for (const c of candidates) {
      const isAttended =
        activeDecision.targetRoi &&
        Math.hypot(c.box.x - activeDecision.targetRoi.x, c.box.y - activeDecision.targetRoi.y) < 0.08;

      if (!isAttended) {
        const bx = c.box.x * w;
        const by = c.box.y * h;
        const bw = c.box.width * w;
        const bh = c.box.height * h;

        // Whisper-thin corner brackets
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1;

        const bl = 5;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(bx, by + bl);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + bl, by);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(bx + bw - bl, by + bh);
        ctx.lineTo(bx + bw, by + bh);
        ctx.lineTo(bx + bw, by + bh - bl);
        ctx.stroke();
      }
    }

    // 2. Focused Attention Ring & Halo on currently attended ROI
    if (activeDecision.targetRoi) {
      const rx = activeDecision.targetRoi.x * w;
      const ry = activeDecision.targetRoi.y * h;
      const rw = activeDecision.targetRoi.width * w;
      const rh = activeDecision.targetRoi.height * h;
      const cx = rx + rw / 2;
      const cy = ry + rh / 2;
      const radius = Math.max(rw, rh) / 1.5;

      // Soft Confidence / Uncertainty Halo
      const haloGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius * 1.8);
      if (uncertainty.uncertaintyScore > 0.5) {
        // High uncertainty: diffuse amber halo
        haloGrad.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
        haloGrad.addColorStop(0.6, 'rgba(251, 191, 36, 0.06)');
        haloGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      } else {
        // Low uncertainty: tight cyan halo
        haloGrad.addColorStop(0, 'rgba(34, 211, 238, 0.3)');
        haloGrad.addColorStop(0.5, 'rgba(34, 211, 238, 0.08)');
        haloGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
      }
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Soft Focus Ring (Apple Vision Pro style)
      ctx.strokeStyle = uncertainty.uncertaintyScore > 0.5 ? '#fbbf24' : '#22d3ee';
      ctx.lineWidth = 1.75;
      ctx.shadowColor = uncertainty.uncertaintyScore > 0.5 ? 'rgba(251, 191, 36, 0.5)' : 'rgba(34, 211, 238, 0.5)';
      ctx.shadowBlur = 8;

      const corner = 8;
      // Draw smooth rounded corner focus bracket
      ctx.beginPath();
      // Top-left
      ctx.moveTo(rx, ry + corner);
      ctx.arcTo(rx, ry, rx + corner, ry, corner);
      ctx.lineTo(rx + corner * 1.5, ry);
      // Top-right
      ctx.moveTo(rx + rw - corner * 1.5, ry);
      ctx.arcTo(rx + rw, ry, rx + rw, ry + corner, corner);
      ctx.lineTo(rx + rw, ry + corner * 1.5);
      // Bottom-right
      ctx.moveTo(rx + rw, ry + rh - corner * 1.5);
      ctx.arcTo(rx + rw, ry + rh, rx + rw - corner, ry + rh, corner);
      ctx.lineTo(rx + rw - corner * 1.5, ry + rh);
      // Bottom-left
      ctx.moveTo(rx + corner * 1.5, ry + rh);
      ctx.arcTo(rx, ry + rh, rx, ry + rh - corner, corner);
      ctx.lineTo(rx, ry + rh - corner * 1.5);
      ctx.stroke();

      ctx.shadowBlur = 0; // Reset

      // Center cross reticle
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy);
      ctx.lineTo(cx + 4, cy);
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx, cy + 4);
      ctx.stroke();
    }

    // 3. Multi-Step Predicted Trajectory & Future Prediction Ghosts (t+1, t+2, t+3, t+4)
    if (prediction.predictedTrajectory.length > 0 && targetEntity) {
      // 3a. Trajectory spline / polyline
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(targetEntity.position.x * w, targetEntity.position.y * h);
      for (const pt of prediction.predictedTrajectory) {
        ctx.lineTo(pt.x * w, pt.y * h);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 3b. Render Prediction Ghosts for each horizon step (t+1, t+2, t+3, t+4)
      const ghosts =
        prediction.predictedGhosts && prediction.predictedGhosts.length > 0
          ? prediction.predictedGhosts
          : prediction.predictedTrajectory.slice(0, 4).map((pt, i) => ({
              step: i + 1,
              position: pt,
              boundingBox: {
                x: pt.x - 0.04,
                y: pt.y - 0.04,
                width: 0.08,
                height: 0.08,
              },
              confidence: Math.max(0.1, 0.95 - i * 0.12),
              label: `t+${i + 1}`,
              variance: 0.005 + (i + 1) * 0.003,
            }));

      ghosts.forEach((ghost) => {
        const gx = ghost.position.x * w;
        const gy = ghost.position.y * h;
        const gbx = ghost.boundingBox.x * w;
        const gby = ghost.boundingBox.y * h;
        const gbw = ghost.boundingBox.width * w;
        const gbh = ghost.boundingBox.height * h;

        const alpha = Math.max(0.12, ghost.confidence * 0.6);
        const fillAlpha = Math.max(0.04, ghost.confidence * 0.15);

        // Ghost bounding box with dashed styling
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
        ctx.fillStyle = `rgba(245, 158, 11, ${fillAlpha})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(gbx, gby, gbw, gbh);
        ctx.fillRect(gbx, gby, gbw, gbh);
        ctx.setLineDash([]);

        // Ghost center node
        ctx.fillStyle = `rgba(245, 158, 11, ${alpha + 0.2})`;
        ctx.beginPath();
        ctx.arc(gx, gy, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Ghost label tag with confidence
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillStyle = `rgba(251, 191, 36, ${Math.min(1.0, alpha + 0.3)})`;
        ctx.fillText(
          `${ghost.label} (${(ghost.confidence * 100).toFixed(0)}%)`,
          gbx,
          Math.max(10, gby - 3)
        );
      });
    }
  }, [candidates, activeDecision, prediction, uncertainty, targetEntity]);

  return (
    <div className="space-y-4">
      {/* 1. Primary Visual Story: SEE -> UNCERTAINTY -> ATTENTION -> ACTION -> NEW EVIDENCE -> MEMORY -> PREDICTION -> TRACKING -> DECISION */}
      <CognitiveVisualStoryStrip
        result={result}
        groundTruthTargetFound={groundTruthTargetFound}
      />

      {/* 2. Workspace: Dominant Visual Scene Focal Point (Left 68%) + Progressive Telemetry (Right 32%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Dominant Primary Focal Point: The Visual Scene & Current Attention */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="relative rounded-2xl glass-surface overflow-hidden border border-white/[0.08] shadow-2xl bg-[#070911]">
            {/* Clean, Non-Pill Scientific Masthead Strip */}
            <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-white/[0.04] text-xs">
              <div className="flex items-center gap-2">
                {inputMode === 'WEBCAM' ? (
                  isCameraStreaming ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-medium text-slate-200">Visual Sensory Field</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        LIVE CAMERA SENSOR (HIDDEN PREVIEW)
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-[11px] font-mono text-slate-400">Frame #{result.observation.frameId}</span>
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      <span className="font-medium text-slate-200">Visual Sensory Field</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                        CAMERA DISCONNECTED / WAITING FOR LIVE INPUT
                      </span>
                      {result.detectedFaceGeometry?.isStale && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="text-[11px] font-mono text-amber-400">
                            Frame #{result.observation.frameId} (STALE / LAST OBSERVED)
                          </span>
                        </>
                      )}
                    </>
                  )
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    <span className="font-medium text-slate-200">Visual Sensory Field</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-[11px] font-mono text-slate-400">640 × 400 ImageData Buffer</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-[11px] font-mono text-slate-400">Frame #{result.observation.frameId}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                {activeDecision.targetRoi ? (
                  <>
                    <span className="text-cyan-300 font-medium">
                      Attended ROI: {activeDecision.action}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>Net Utility: {activeDecision.netUtility.toFixed(2)}</span>
                  </>
                ) : (
                  <span>Full Field Mode</span>
                )}
              </div>
            </div>

            {/* Dominant Canvas Viewport */}
            <div className="relative aspect-[16/10] w-full bg-[#05070c] flex items-center justify-center overflow-hidden">
              {/* Underlying Camera / Simulator Canvas */}
              <canvas
                ref={canvasRef}
                width={640}
                height={400}
                className="absolute inset-0 h-full w-full object-contain"
              />

              {/* Attention & Kinematic Ghost Overlay */}
              <canvas
                ref={overlayCanvasRef}
                width={640}
                height={400}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              />

              {/* Dynamic Floating Attention Reticle Annotation */}
              {activeDecision.targetRoi && (
                <div
                  className="absolute z-20 pointer-events-none transition-all duration-300"
                  style={{
                    left: `${Math.min(75, Math.max(10, (activeDecision.targetRoi.x + activeDecision.targetRoi.width / 2) * 100))}%`,
                    top: `${Math.min(75, Math.max(12, (activeDecision.targetRoi.y - 0.08) * 100))}%`,
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  <div className="glass-surface-elevated px-3 py-1.5 rounded-xl border border-white/15 flex items-center gap-2.5 shadow-2xl backdrop-blur-md">
                    <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
                        {uncertainty.isEvidenceSufficient ? (
                          <>
                            <span className="text-slate-300">Target Hypothesis</span>
                            <span className="text-cyan-300 font-mono font-bold">
                              {(uncertainty.targetProbability * 100).toFixed(0)}%
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-amber-300 font-semibold">Evidence Gated</span>
                            <span className="text-slate-400 font-mono text-[9px]">
                              ({(uncertainty.uncertaintyScore * 100).toFixed(0)}% U)
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-white tracking-tight flex items-center gap-1">
                        <span className="text-slate-400 text-[10px]">Action:</span>
                        <span className={activeDecision.action === 'INSPECT_ROI' ? 'text-cyan-300' : 'text-slate-200'}>
                          {activeDecision.action}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Minimalist Anchored Legend */}
              <div className="absolute bottom-3 left-3 flex items-center gap-3 px-3 py-1.5 rounded-xl glass-surface-subtle text-[11px] text-slate-400 border border-white/[0.04]">
                {inputMode === 'WEBCAM' || inputMode === 'VIDEO_FILE' ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      <span>Face Wireframe</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-400" />
                      <span>Landmarks (Eyes/Mouth/Jaw)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-3 rounded-full bg-emerald-400" />
                      <span>Motion Vectors</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      <span>Target X</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-sky-400/70" />
                      <span>Distractor Blobs</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-3 rounded-full bg-amber-400/80" />
                      <span>Prediction Ghosts (t+1..t+4)</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Progressive Disclosure: Cognitive Timeline Accordion */}
          <div className="rounded-2xl glass-surface border border-white/[0.06] overflow-hidden">
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="w-full flex items-center justify-between p-3.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-cyan-400" />
                <span className="uppercase tracking-wider font-semibold text-[11px]">
                  Cognitive Execution Trace
                </span>
                <span className="text-slate-500 font-mono text-[10px]">
                  ({result.traceSteps.length} recorded events)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                <span>{showTimeline ? 'Collapse Trace' : 'Expand Trace'}</span>
                {showTimeline ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </div>
            </button>

            {showTimeline && (
              <div className="border-t border-white/[0.04] p-4 pt-1">
                <CognitiveTimeline traceSteps={result.traceSteps} />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Progressive Disclosure Instrument Console (Right 32%) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Instrument Sub-Selector Tabs */}
          <div className="rounded-2xl glass-surface p-1.5 border border-white/[0.06] flex items-center gap-1">
            <button
              onClick={() => setActiveInstrumentTab('STATE')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium transition-all text-center ${
                activeInstrumentTab === 'STATE'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cognitive State
            </button>
            <button
              onClick={() => setActiveInstrumentTab('MEMORY')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium transition-all text-center ${
                activeInstrumentTab === 'MEMORY'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              VWM Memory
            </button>
            <button
              onClick={() => setActiveInstrumentTab('POLICY')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium transition-all text-center ${
                activeInstrumentTab === 'POLICY'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Observation Policy
            </button>
            <button
              onClick={() => setActiveInstrumentTab('ALL')}
              className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-all text-center ${
                activeInstrumentTab === 'ALL'
                  ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Expand all research instruments"
            >
              All
            </button>
          </div>

          {/* Instrument 1: Cognitive State Card */}
          {(activeInstrumentTab === 'STATE' || activeInstrumentTab === 'ALL') && (
            <CognitiveStateCard
              decision={activeDecision}
              uncertainty={uncertainty}
              memoryEntities={result.workingMemoryEntities}
              worldModel={result.worldModel}
              prediction={prediction}
              groundTruthTargetFound={groundTruthTargetFound}
            />
          )}

          {/* Instrument 2: Visual Working Memory Constellation */}
          {(activeInstrumentTab === 'MEMORY' || activeInstrumentTab === 'ALL') && (
            <VWMConstellation
              entities={result.workingMemoryEntities}
              onSelectEntity={onSelectEntity}
              selectedEntityId={selectedEntityId}
            />
          )}

          {/* Instrument 3: Active Perception Policy Utility Card */}
          {(activeInstrumentTab === 'POLICY' || activeInstrumentTab === 'ALL') && (
            <div className="rounded-2xl glass-surface p-5 border border-white/[0.06]">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.04]">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Active Observation Policy
                </h4>
                <span className="text-[11px] font-mono text-cyan-400">
                  {result.currentMode}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4 font-light">
                {activeDecision.reasoning}
              </p>
              <div className="grid grid-cols-3 gap-2.5 text-[10px] font-mono text-slate-400 bg-black/30 p-3 rounded-xl border border-white/[0.04]">
                <div>
                  <span className="text-slate-500 block mb-0.5">Exp. Gain</span>
                  <span className="text-emerald-400 font-semibold text-xs">
                    +{activeDecision.expectedInfoGain.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Compute Cost</span>
                  <span className="text-slate-200 text-xs">
                    {activeDecision.computationCost.toFixed(1)} CU
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Net Utility</span>
                  <span className="text-cyan-300 font-semibold text-xs">
                    {activeDecision.netUtility.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
