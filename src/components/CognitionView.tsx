import React from 'react';
import {
  Compass,
  TrendingUp,
  ShieldAlert,
  Search,
  ArrowRight,
  Database,
  Layers,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import {
  SpatialWorldModel,
  PredictionState,
  EpistemicUncertaintyState,
  WorkingMemoryEntity,
} from '../types/avica';
import { SpatialWorldModelEngine } from '../spatial/spatial_world_model';
import { VisualSpatialGraph } from './VisualSpatialGraph';

interface CognitionViewProps {
  worldModel: SpatialWorldModel;
  spatialEngine: SpatialWorldModelEngine;
  prediction: PredictionState;
  uncertainty: EpistemicUncertaintyState;
  memoryEntities: WorkingMemoryEntity[];
  onSelectEntity: (entity: WorkingMemoryEntity) => void;
  selectedEntityId?: string;
  onToggleMultiView?: (enabled: boolean) => void;
}

export const CognitionView: React.FC<CognitionViewProps> = ({
  worldModel,
  spatialEngine,
  prediction,
  uncertainty,
  memoryEntities,
  onSelectEntity,
  selectedEntityId,
  onToggleMultiView,
}) => {
  const targetEntity = memoryEntities.find((e) => e.isTarget);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.04]">
        <div>
          <h2 className="text-lg font-medium text-white tracking-tight">
            Cognitive State & Spatial World Model
          </h2>
          <p className="text-xs text-slate-400 font-light mt-0.5">
            Internal 3D geometric predicates, kinematic predictions, and epistemic uncertainty state.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="text-violet-300 font-semibold">{worldModel.relationships.length}</span>
          <span>active spatial relations</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Spatial World Graph & Multi-Object Reasoning */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          <VisualSpatialGraph
            worldModel={worldModel}
            spatialEngine={spatialEngine}
            onSelectEntity={onSelectEntity}
            selectedEntityId={selectedEntityId}
            onToggleMultiView={onToggleMultiView}
          />
        </div>

        {/* Right 5 Cols: Multi-Step Future Ghost Predictive Perception & Uncertainty */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Predictive Perception Multi-Step Future Ghost Card */}
          <div className="rounded-2xl glass-surface p-5 border border-white/[0.06]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Predictive Perception
                </h3>
              </div>
              <span className="text-[11px] font-mono text-amber-300">
                Multi-Step Horizon: t+1 &rarr; t+4
              </span>
            </div>

            <div className="space-y-3">
              {/* Multi-step future states table */}
              <div className="p-3.5 rounded-xl bg-black/20 border border-white/[0.04]">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-400">Kinematic State:</span>
                  <span className="font-semibold text-amber-300 font-mono">
                    {prediction.predictedNextState}
                  </span>
                </div>

                <div className="space-y-1.5 mt-2 border-t border-white/[0.05] pt-2">
                  <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-mono">
                    {[1, 2, 3, 4].map((step) => {
                      const stepData = prediction.steps?.find((s) => s.stepOffset === step);
                      const ghostData = prediction.predictedGhosts?.find((g) => g.step === step);
                      const conf = stepData?.confidence ?? ghostData?.confidence ?? Math.max(0.1, 0.95 - (step - 1) * 0.12);
                      const pos = stepData?.predictedPos ?? ghostData?.position;
                      const metric = prediction.horizonMetrics?.[step];

                      return (
                        <div key={step} className="p-1.5 rounded bg-white/[0.03] border border-white/[0.04]">
                          <div className="text-amber-300 font-bold">t+{step}</div>
                          <div className="text-[9px] text-slate-400">
                            {(conf * 100).toFixed(0)}% conf
                          </div>
                          <div className="text-[8px] text-slate-300 truncate mt-0.5">
                            {pos ? `[${pos.x.toFixed(2)},${pos.y.toFixed(2)}]` : '---'}
                          </div>
                          <div className="text-[8px] text-amber-400/90 font-semibold mt-0.5">
                            {metric && metric.sampleCount > 0 ? `Δ${metric.meanError.toFixed(3)}` : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Discrepancy Error */}
              <div className="rounded-xl glass-surface-subtle p-3.5">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-400">Mean Prediction Error (All Horizons)</span>
                  <span className="font-mono font-semibold text-amber-300">
                    {(prediction.meanPredictionError || prediction.predictionError).toFixed(4)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (prediction.meanPredictionError || prediction.predictionError) * 400)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Measured against subsequent visual observations across 4-step horizon.
                </span>
              </div>

              {prediction.occlusionImminent && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Approaching occluder barrier detected on trajectory.</span>
                </div>
              )}
            </div>
          </div>

          {/* Epistemic Uncertainty Breakdown */}
          <div className="rounded-2xl glass-surface p-5 border border-white/[0.06]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Epistemic Uncertainty Engine
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Metacognitive Metric
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl">
                <span className="text-slate-400">Shannon Entropy Ambiguity:</span>
                <span className="font-mono text-slate-200 font-semibold">
                  {(uncertainty.ambiguityScore * 100).toFixed(0)}%
                </span>
              </div>

              <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl">
                <span className="text-slate-400">Missing Evidence Score:</span>
                <span className="font-mono text-slate-200 font-semibold">
                  {(uncertainty.missingEvidenceScore * 100).toFixed(0)}%
                </span>
              </div>

              <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl">
                <span className="text-slate-400">Sufficient Evidence Threshold:</span>
                <span className="font-mono text-slate-200 font-semibold">
                  {(uncertainty.sufficientThreshold * 100).toFixed(0)}%
                </span>
              </div>

              <div className="pt-2 border-t border-white/[0.04]">
                <span className="text-[11px] text-slate-400 block mb-1">
                  Active Perception Rule:
                </span>
                <p className="text-[11px] text-slate-300 font-light leading-relaxed">
                  When evidence is insufficient, the policy favors high-information-gain actions (e.g. <strong className="text-cyan-300 font-medium">INSPECT_ROI</strong>) over passive tracking to reduce hypothesis entropy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
