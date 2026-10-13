import React, { useRef, useEffect } from 'react';
import {
  Eye,
  Crosshair,
  Maximize2,
  Layers,
  ShieldAlert,
  Compass,
} from 'lucide-react';
import {
  AgentActionDecision,
  CandidateRegion,
  PredictionState,
  WorkingMemoryEntity,
} from '../types/avica';

interface LiveSceneViewportProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  candidates: CandidateRegion[];
  activeDecision: AgentActionDecision;
  targetEntity?: WorkingMemoryEntity;
  prediction: PredictionState;
  showAttentionOverlay: boolean;
  onToggleOverlay: () => void;
  showTrajectories: boolean;
  onToggleTrajectories: () => void;
}

export const LiveSceneViewport: React.FC<LiveSceneViewportProps> = ({
  canvasRef,
  candidates,
  activeDecision,
  targetEntity,
  prediction,
  showAttentionOverlay,
  onToggleOverlay,
  showTrajectories,
  onToggleTrajectories,
}) => {
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Synchronize overlay rendering (ROI boxes, saccades, prediction vectors)
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!showAttentionOverlay) return;

    // 1. Draw candidate regions and status
    for (const c of candidates) {
      const bx = c.box.x * w;
      const by = c.box.y * h;
      const bw = c.box.width * w;
      const bh = c.box.height * h;

      ctx.lineWidth = 1.5;
      if (c.status === 'CONFIRMED_TARGET') {
        ctx.strokeStyle = '#06b6d4'; // Cyan
        ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
      } else if (c.status === 'REJECTED') {
        ctx.strokeStyle = '#ef4444'; // Red
        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
      } else {
        ctx.strokeStyle = '#eab308'; // Amber
        ctx.fillStyle = 'rgba(234, 179, 8, 0.05)';
      }

      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      // Label tag
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(
        `${c.status === 'CONFIRMED_TARGET' ? 'TARGET' : 'CAND'} P:${(c.targetProbability * 100).toFixed(0)}%`,
        bx,
        Math.max(10, by - 4)
      );
    }

    // 2. Active Saccade / Foveated Inspection ROI
    if (activeDecision.targetRoi) {
      const rx = activeDecision.targetRoi.x * w;
      const ry = activeDecision.targetRoi.y * h;
      const rw = activeDecision.targetRoi.width * w;
      const rh = activeDecision.targetRoi.height * h;

      // Foveation bracket corners
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;

      const cornerLen = 10;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(rx, ry + cornerLen);
      ctx.lineTo(rx, ry);
      ctx.lineTo(rx + cornerLen, ry);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(rx + rw - cornerLen, ry);
      ctx.lineTo(rx + rw, ry);
      ctx.lineTo(rx + rw, ry + cornerLen);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(rx, ry + rh - cornerLen);
      ctx.lineTo(rx, ry + rh);
      ctx.lineTo(rx + cornerLen, ry + rh);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(rx + rw - cornerLen, ry + rh);
      ctx.lineTo(rx + rw, ry + rh);
      ctx.lineTo(rx + rw, ry + rh - cornerLen);
      ctx.stroke();

      // Fovea center reticle
      const cx = rx + rw / 2;
      const cy = ry + rh / 2;
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.stroke();

      // Inspection pulse badge
      ctx.fillStyle = '#0891b2';
      ctx.fillRect(rx, ry + rh + 4, 90, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText('INSPECT_ROI ACT', rx + 4, ry + rh + 14);
    }

    // 3. Multi-Step Predicted Trajectory Horizon & Future Ghosts (t+1, t+2, t+3, t+4)
    if (showTrajectories && prediction.predictedTrajectory.length > 0 && targetEntity) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(targetEntity.position.x * w, targetEntity.position.y * h);

      for (const pt of prediction.predictedTrajectory) {
        ctx.lineTo(pt.x * w, pt.y * h);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Render prediction ghosts at each horizon step
      const ghosts = prediction.predictedGhosts && prediction.predictedGhosts.length > 0
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

        const alpha = Math.max(0.15, ghost.confidence * 0.7);
        const fillAlpha = Math.max(0.05, ghost.confidence * 0.18);

        // Ghost bounding box
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
        ctx.fillStyle = `rgba(245, 158, 11, ${fillAlpha})`;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(gbx, gby, gbw, gbh);
        ctx.fillRect(gbx, gby, gbw, gbh);
        ctx.setLineDash([]);

        // Ghost center node reticle
        ctx.fillStyle = `rgba(245, 158, 11, ${alpha + 0.15})`;
        ctx.beginPath();
        ctx.arc(gx, gy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Ghost label tag with confidence %
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillStyle = `rgba(251, 191, 36, ${Math.min(1.0, alpha + 0.35)})`;
        ctx.fillText(
          `${ghost.label} (${(ghost.confidence * 100).toFixed(0)}%)`,
          gbx,
          Math.max(10, gby - 4)
        );
      });
    }

    // 4. Active Re-emergence Search Window (during occlusion)
    if (showAttentionOverlay && targetEntity?.predictedReemergenceRoi && targetEntity.isOccluded) {
      const sroi = targetEntity.predictedReemergenceRoi;
      const sx = sroi.x * w;
      const sy = sroi.y * h;
      const sw = sroi.width * w;
      const sh = sroi.height * h;

      ctx.strokeStyle = '#a855f7'; // Purple / Violet
      ctx.setLineDash([5, 3]);
      ctx.lineWidth = 1.8;
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
      ctx.fillRect(sx, sy, sw, sh);

      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillStyle = '#c084fc';
      ctx.fillText('RE-EMERGENCE SEARCH ROI', sx + 4, Math.max(12, sy - 4));
    }
  }, [candidates, activeDecision, targetEntity, prediction, showAttentionOverlay, showTrajectories]);

  return (
    <div className="relative flex flex-col rounded-lg border border-slate-800 bg-[#070a12] overflow-hidden shadow-lg">
      {/* Viewport Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-cyan-400" />
          <span className="font-mono font-semibold tracking-wide text-slate-200">
            VIEWPORT 01: CONTROLLED SYNTHETIC BENCHMARK ENVIRONMENT
          </span>
          <span className="rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.2 font-mono text-[9px]">
            INPUT: RAW IMAGE PIXELS ONLY
          </span>
          <span className="rounded bg-slate-800 px-1.5 py-0.2 font-mono text-[10px] text-slate-400">
            640 &times; 400
          </span>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleOverlay}
            className={`flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] transition-colors ${
              showAttentionOverlay
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                : 'text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Crosshair className="h-3 w-3" />
            <span>Attention Overlay</span>
          </button>
          <button
            onClick={onToggleTrajectories}
            className={`flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] transition-colors ${
              showTrajectories
                ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                : 'text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Compass className="h-3 w-3" />
            <span>Predicted Trajectory</span>
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="relative aspect-[16/10] w-full bg-[#0a0f1d] flex items-center justify-center overflow-hidden">
        {/* Underlying Simulation Canvas */}
        <canvas
          ref={canvasRef}
          width={640}
          height={400}
          className="absolute inset-0 h-full w-full object-contain"
        />

        {/* Active Attention & HUD Overlay Canvas */}
        <canvas
          ref={overlayCanvasRef}
          width={640}
          height={400}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />

        {/* Legend Overlay at bottom */}
        <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-2 rounded border border-slate-800/80 bg-slate-950/80 px-2 py-1 font-mono text-[10px] backdrop-blur-sm">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
            <span className="text-slate-300">Target X</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-400"></span>
            <span className="text-slate-400">Distractors</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 bg-slate-600"></span>
            <span className="text-slate-400">Dynamic Occluder</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="border border-cyan-400 px-0.5 text-[8px] text-cyan-300">[+]</span>
            <span className="text-cyan-300">Foveated ROI</span>
          </div>
        </div>
      </div>
    </div>
  );
};
