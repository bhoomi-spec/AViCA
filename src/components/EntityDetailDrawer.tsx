import React from 'react';
import { X, Database, Eye, ShieldCheck, Activity, Compass, ArrowUpRight } from 'lucide-react';
import { WorkingMemoryEntity, CandidateRegion } from '../types/avica';

interface EntityDetailDrawerProps {
  entity: WorkingMemoryEntity | null;
  candidate?: CandidateRegion | null;
  onClose: () => void;
}

export const EntityDetailDrawer: React.FC<EntityDetailDrawerProps> = ({
  entity,
  candidate,
  onClose,
}) => {
  if (!entity && !candidate) return null;

  const isTarget = entity?.isTarget || candidate?.status === 'CONFIRMED_TARGET';
  const label = entity?.label || candidate?.id || 'Entity';
  const confidence = entity ? Math.round(entity.confidence * 100) : candidate ? Math.round(candidate.targetProbability * 100) : 0;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md glass-surface-elevated border-l border-white/10 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${
                isTarget
                  ? 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]'
                  : entity?.isOccluded
                  ? 'bg-rose-400'
                  : 'bg-violet-400'
              }`}
            />
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                {label}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {entity ? `Memory Slot: ${entity.id}` : `Perceived Candidate: ${candidate?.id}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 my-5">
          <div className="rounded-xl glass-surface-subtle p-3.5">
            <span className="text-[11px] text-slate-400 block mb-1">Target Probability</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-semibold tracking-tight ${isTarget ? 'text-cyan-300' : 'text-slate-200'}`}>
                {confidence}%
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {isTarget ? 'Verified' : 'Hypothesis'}
              </span>
            </div>
          </div>

          <div className="rounded-xl glass-surface-subtle p-3.5">
            <span className="text-[11px] text-slate-400 block mb-1">Current State</span>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-slate-200">
                {entity?.isOccluded ? 'Occluded' : entity?.currentState || candidate?.status || 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Image-Derived Optical Features */}
        {candidate?.colorFeatures && (
          <div className="mb-5 rounded-xl glass-surface-subtle p-4">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-cyan-400" />
              <span>Image-Derived Optical Measurements</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
              <div className="bg-black/20 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Dominant Hue</span>
                <span className="font-semibold">{candidate.colorFeatures.hue}&deg;</span>
              </div>
              <div className="bg-black/20 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Saturation</span>
                <span className="font-semibold">{candidate.colorFeatures.saturation}</span>
              </div>
              {candidate.shapeFeatures && (
                <>
                  <div className="bg-black/20 p-2 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">Circularity (4&pi;A/P&sup2;)</span>
                    <span className="font-semibold">{candidate.shapeFeatures.circularity}</span>
                  </div>
                  <div className="bg-black/20 p-2 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">Aspect Ratio</span>
                    <span className="font-semibold">{candidate.shapeFeatures.aspectRatio}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Kinematic Coordinates */}
        {entity && (
          <div className="mb-5 rounded-xl glass-surface-subtle p-4">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-violet-400" />
              <span>Spatial Coordinates & Kinematics</span>
            </h4>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between bg-black/20 p-2 rounded-lg">
                <span className="text-slate-400">Position (X, Y, Z)</span>
                <span className="text-slate-200">
                  {entity.position.x.toFixed(3)}, {entity.position.y.toFixed(3)}, {entity.position.z.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between bg-black/20 p-2 rounded-lg">
                <span className="text-slate-400">Velocity Vector</span>
                <span className="text-slate-200">
                  &Delta; {Math.hypot(entity.velocity.x, entity.velocity.y).toFixed(4)} u/s
                </span>
              </div>
              <div className="flex justify-between bg-black/20 p-2 rounded-lg">
                <span className="text-slate-400">Observation Cycles</span>
                <span className="text-slate-200">{entity.observationCount} frames</span>
              </div>
            </div>
          </div>
        )}

        {/* 8-Dimensional Visual Embedding */}
        {entity && (
          <div className="rounded-xl glass-surface-subtle p-4">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
              <span>Feature Embedding Descriptor [8-D]</span>
            </h4>
            <div className="flex gap-1 h-10 items-end bg-black/30 p-2 rounded-lg mt-2">
              {entity.visualEmbedding.map((val, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div
                    className="w-full bg-cyan-400/80 rounded-t transition-all"
                    style={{ height: `${Math.max(12, Math.min(100, val * 100))}%` }}
                    title={`Dim ${idx}: ${val}`}
                  />
                  <span className="text-[8px] font-mono text-slate-500">{idx}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-white/5 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/15 transition-colors"
        >
          Close Inspector
        </button>
      </div>
    </div>
  );
};
