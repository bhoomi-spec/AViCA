import React from 'react';
import {
  Eye,
  Database,
  Compass,
  TrendingUp,
  ShieldAlert,
  Target,
  Zap,
} from 'lucide-react';
import {
  AgentActionDecision,
  EpistemicUncertaintyState,
  PredictionState,
  SpatialWorldModel,
  WorkingMemoryEntity,
} from '../types/avica';

interface CognitiveStateBarProps {
  decision: AgentActionDecision;
  uncertainty: EpistemicUncertaintyState;
  memoryEntities: WorkingMemoryEntity[];
  worldModel: SpatialWorldModel;
  prediction: PredictionState;
  groundTruthTargetFound: boolean;
}

export const CognitiveStateBar: React.FC<CognitiveStateBarProps> = ({
  decision,
  uncertainty,
  memoryEntities,
  worldModel,
  prediction,
  groundTruthTargetFound,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 border-b border-slate-800 bg-[#0d121f] text-xs">
      {/* 1. Selective Visual Attention */}
      <div className="border-r border-slate-800/80 p-2.5 flex flex-col justify-between">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Eye className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">1. Attention Focus</span>
        </div>
        <div className="mt-1">
          <span className="font-mono font-bold text-cyan-300 text-xs">
            {decision.action}
          </span>
          <p className="truncate text-[10px] text-slate-400 mt-0.5">
            {decision.targetRoi ? 'Foveated candidate ROI' : 'Full-field scan'}
          </p>
        </div>
      </div>

      {/* 2. Visual Working Memory */}
      <div className="border-r border-slate-800/80 p-2.5 flex flex-col justify-between">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Database className="h-3.5 w-3.5 text-indigo-400" />
          <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">2. Working Memory</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <div>
            <span className="font-mono font-bold text-slate-200">
              {memoryEntities.length}
            </span>
            <span className="text-[10px] text-slate-500"> / 12 slots</span>
          </div>
          <span className="font-mono text-[10px] text-indigo-300">
            {memoryEntities.filter((e) => !e.isOccluded).length} active
          </span>
        </div>
      </div>

      {/* 3. Spatial Reasoning */}
      <div className="border-r border-slate-800/80 p-2.5 flex flex-col justify-between">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Compass className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">3. Spatial Model</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-mono font-bold text-emerald-300">
            {worldModel.relationships.length} relations
          </span>
          <span className="text-[10px] text-slate-400">
            {worldModel.targetId ? 'Target registered' : 'No target'}
          </span>
        </div>
      </div>

      {/* 4. Predictive Perception */}
      <div className="border-r border-slate-800/80 p-2.5 flex flex-col justify-between">
        <div className="flex items-center gap-1.5 text-slate-400">
          <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">4. Prediction Error</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-mono font-bold text-amber-300">
            &Delta; {prediction.predictionError.toFixed(3)}
          </span>
          <span className={`text-[10px] font-mono ${prediction.occlusionImminent ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
            {prediction.occlusionImminent ? 'Occlusion Warn' : 'Nominal'}
          </span>
        </div>
      </div>

      {/* 5. Epistemic Uncertainty */}
      <div className="border-r border-slate-800/80 p-2.5 flex flex-col justify-between">
        <div className="flex items-center gap-1.5 text-slate-400">
          <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
          <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">5. Uncertainty</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-mono font-bold text-rose-300">
            {(uncertainty.uncertaintyScore * 100).toFixed(0)}%
          </span>
          <span className={`text-[10px] font-mono px-1 rounded ${
            uncertainty.isEvidenceSufficient
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
              : 'bg-rose-950 text-rose-400 border border-rose-800/60'
          }`}>
            {uncertainty.isEvidenceSufficient ? 'Sufficient' : 'Seeking'}
          </span>
        </div>
      </div>

      {/* 6. Active Perception Utility / Goal */}
      <div className="p-2.5 flex flex-col justify-between bg-cyan-950/20">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Target className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">6. Current Goal</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-mono font-bold text-slate-200 truncate">
            Find & Track X
          </span>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
            groundTruthTargetFound
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          }`}>
            {groundTruthTargetFound ? 'LOCKED' : 'SEARCHING'}
          </span>
        </div>
      </div>
    </div>
  );
};
