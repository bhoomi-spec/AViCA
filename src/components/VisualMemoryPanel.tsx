import React from 'react';
import { Database, Clock, Layers, Zap } from 'lucide-react';
import { WorkingMemoryEntity } from '../types/avica';

interface VisualMemoryPanelProps {
  entities: WorkingMemoryEntity[];
}

export const VisualMemoryPanel: React.FC<VisualMemoryPanelProps> = ({ entities }) => {
  return (
    <div className="flex flex-col rounded-lg border border-slate-800 bg-[#070a12] p-3 text-xs shadow-md">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-indigo-400" />
          <span className="font-mono font-semibold text-slate-200">
            VISUAL WORKING MEMORY (VWM)
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-400">
          Capacity: <strong className="text-slate-200">{entities.length}</strong> / 12 slots
        </span>
      </div>

      {entities.length === 0 ? (
        <div className="flex h-36 items-center justify-center font-mono text-xs text-slate-500">
          No active entities retained in working memory
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {entities.map((entity) => {
            const isTarget = entity.isTarget;
            const confPct = Math.round(entity.confidence * 100);

            return (
              <div
                key={entity.id}
                className={`flex flex-col justify-between rounded border p-2 transition-all font-mono ${
                  isTarget
                    ? 'border-cyan-500/50 bg-cyan-950/20 shadow-sm'
                    : 'border-slate-800 bg-slate-900/50'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isTarget ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'
                      }`}
                    />
                    <span className="font-bold text-slate-200">{entity.id}</span>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.2 text-[9px] font-semibold ${
                      entity.trackingLifecycleState === 'RECOVERED'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                        : entity.trackingLifecycleState === 'ACTIVE_SEARCH'
                        ? 'bg-purple-950/80 text-purple-300 border border-purple-500/60'
                        : entity.trackingLifecycleState === 'MEMORY_RETAINED'
                        ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/60'
                        : entity.trackingLifecycleState === 'OCCLUDED' || entity.isOccluded
                        ? 'bg-rose-950/70 text-rose-300 border border-rose-800/40'
                        : entity.trackingLifecycleState === 'TRACKING'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                        : entity.trackingLifecycleState === 'DETECTED'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/40'
                        : isTarget
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {entity.trackingLifecycleState ?? (entity.isOccluded ? 'OCCLUDED' : entity.currentState)}
                  </span>
                </div>

                {/* Subtitle label */}
                <p className="truncate text-[10px] text-slate-400 mt-0.5">
                  {entity.label}
                  {entity.appearanceMemory ? ` • Hue ${entity.appearanceMemory.hue}°` : ''}
                </p>

                {/* Coordinates & Kinematics */}
                <div className="my-1.5 grid grid-cols-2 gap-1 rounded bg-slate-950/60 p-1 text-[10px] text-slate-400">
                  <div>
                    <span className="text-slate-500">Pos (X,Y): </span>
                    <span className="text-slate-300">
                      {entity.position.x.toFixed(2)}, {entity.position.y.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Vel: </span>
                    <span className="text-slate-300">
                      {Math.hypot(entity.velocity.x, entity.velocity.y).toFixed(3)}
                    </span>
                  </div>
                  {entity.kalmanState && (
                    <div className="col-span-2 text-[9px] text-slate-500 pt-0.5 border-t border-slate-900 flex justify-between">
                      <span>Kalman PosVar: <strong className="text-slate-300">{entity.kalmanState.positionVariance.toFixed(4)}</strong></span>
                      <span>CovTrace: <strong className="text-slate-300">{entity.kalmanState.covarianceTrace.toFixed(4)}</strong></span>
                    </div>
                  )}
                </div>

                {/* Visual Embedding Mini-Vector Display */}
                <div className="mb-1.5 flex items-center gap-1">
                  <span className="text-[9px] text-slate-500">EMB[8]:</span>
                  <div className="flex flex-1 gap-0.5 h-2 items-end bg-slate-950 p-0.5 rounded">
                    {entity.visualEmbedding.map((val, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-cyan-400/80 rounded-t"
                        style={{ height: `${Math.max(10, Math.min(100, val * 100))}%` }}
                        title={`dim ${idx}: ${val}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Confidence Decay Progress Bar */}
                <div>
                  <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                    <span>CONFIDENCE &bull; {confPct}%</span>
                    <span>Obs #{entity.observationCount}</span>
                  </div>
                  <div className="h-1.5 w-full rounded bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        confPct > 70
                          ? 'bg-emerald-500'
                          : confPct > 40
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${confPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
