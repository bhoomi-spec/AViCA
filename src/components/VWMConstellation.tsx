import React from 'react';
import { Database, Sparkles, ChevronRight } from 'lucide-react';
import { WorkingMemoryEntity } from '../types/avica';

interface VWMConstellationProps {
  entities: WorkingMemoryEntity[];
  onSelectEntity: (entity: WorkingMemoryEntity) => void;
  selectedEntityId?: string;
}

export const VWMConstellation: React.FC<VWMConstellationProps> = ({
  entities,
  onSelectEntity,
  selectedEntityId,
}) => {
  const activeCount = entities.filter((e) => !e.isOccluded).length;
  const occludedCount = entities.filter((e) => e.isOccluded).length;
  const targetEntity = entities.find((e) => e.isTarget);

  return (
    <div className="rounded-2xl glass-surface p-4 border border-white/[0.06] transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-violet-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Visual Working Memory
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {entities.length} / 12 slots
        </span>
      </div>

      {/* Summary Chips */}
      <div className="flex items-center gap-2 mb-3 text-[11px]">
        <span className="text-slate-400">
          <strong className="text-white font-medium">{entities.length}</strong> retained
        </span>
        <span className="text-slate-600">&bull;</span>
        <span className="text-slate-400">
          <strong className="text-cyan-300 font-medium">{activeCount}</strong> in FOV
        </span>
        {occludedCount > 0 && (
          <>
            <span className="text-slate-600">&bull;</span>
            <span className="text-rose-400 font-medium">
              {occludedCount} occluded
            </span>
          </>
        )}
      </div>

      {/* Constellation Canvas / Visual Field */}
      <div className="relative h-32 w-full rounded-xl bg-black/30 border border-white/[0.04] p-3 flex items-center justify-center overflow-hidden">
        {/* Subtle coordinate crosshair */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/[0.03]" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/[0.03]" />

        {entities.length === 0 ? (
          <span className="text-xs text-slate-500 font-light">Memory field initialized</span>
        ) : (
          entities.map((entity) => {
            const isTarget = entity.isTarget;
            const isSelected = entity.id === selectedEntityId;
            // Position normalized coordinates into container
            const leftPct = Math.max(10, Math.min(90, entity.position.x * 100));
            const topPct = Math.max(15, Math.min(85, entity.position.y * 100));

            return (
              <button
                key={entity.id}
                onClick={() => onSelectEntity(entity)}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                className={`group absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all focus:outline-none ${
                  isSelected ? 'scale-125 z-20' : 'hover:scale-125 z-10'
                }`}
                title={`${entity.label} (Confidence: ${Math.round(entity.confidence * 100)}%)`}
              >
                {/* Node Ring & Glow */}
                <div
                  className={`h-4 w-4 rounded-full flex items-center justify-center transition-all ${
                    isTarget
                      ? 'bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.9)] animate-pulse'
                      : entity.isOccluded
                      ? 'bg-rose-400/80 shadow-[0_0_8px_rgba(251,113,133,0.5)]'
                      : 'bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.6)]'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                </div>

                {/* Micro hover annotation */}
                <span className="pointer-events-none absolute left-1/2 -top-6 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-white whitespace-nowrap border border-white/10">
                  {isTarget ? 'TARGET' : entity.currentState}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Target status snippet */}
      {targetEntity && (
        <div
          onClick={() => onSelectEntity(targetEntity)}
          className="mt-3 flex items-center justify-between p-2 rounded-xl bg-cyan-950/20 border border-cyan-500/20 cursor-pointer hover:bg-cyan-950/30 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-200 font-medium">Tracked Target</span>
            <span className="text-[11px] text-cyan-400/80 font-mono">
              ({Math.round(targetEntity.confidence * 100)}% conf)
            </span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-cyan-400" />
        </div>
      )}
    </div>
  );
};
