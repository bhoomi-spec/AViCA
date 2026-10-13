import React from 'react';
import { Eye, Database, ShieldAlert, TrendingUp, Compass, Target } from 'lucide-react';
import {
  AgentActionDecision,
  EpistemicUncertaintyState,
  PredictionState,
  SpatialWorldModel,
  WorkingMemoryEntity,
} from '../types/avica';

interface CognitiveStateCardProps {
  decision: AgentActionDecision;
  uncertainty: EpistemicUncertaintyState;
  memoryEntities: WorkingMemoryEntity[];
  worldModel: SpatialWorldModel;
  prediction: PredictionState;
  groundTruthTargetFound: boolean;
}

export const CognitiveStateCard: React.FC<CognitiveStateCardProps> = ({
  decision,
  uncertainty,
  memoryEntities,
  worldModel,
  prediction,
  groundTruthTargetFound,
}) => {
  const targetEntity = memoryEntities.find((e) => e.isTarget);
  const attentionConfidence = targetEntity
    ? Math.round(targetEntity.confidence * 100)
    : Math.round(uncertainty.targetProbability * 100);

  const uncertaintyPct = Math.round(uncertainty.uncertaintyScore * 100);

  return (
    <div className="rounded-2xl glass-surface p-5 border border-white/[0.06] transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.04]">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
          Cognitive State
        </h3>
        <span className="text-[11px] font-mono text-cyan-400">
          Autonomous Loop Active
        </span>
      </div>

      <div className="space-y-4">
        {/* 1. Attention Focus */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-cyan-400" />
              <span>Attention Focus</span>
            </span>
            <span className="font-semibold text-cyan-300 font-mono">
              {attentionConfidence}%
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(8, attentionConfidence)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Action: <strong className="text-slate-200">{decision.action}</strong>
          </span>
        </div>

        {/* 2. Visual Working Memory */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-violet-400" />
              <span>Working Memory</span>
            </span>
            <span className="font-medium text-slate-200 font-mono">
              {memoryEntities.length} <span className="text-slate-500">/ 12 slots</span>
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full bg-violet-400 rounded-full transition-all duration-300"
              style={{ width: `${(memoryEntities.length / 12) * 100}%` }}
            />
          </div>
        </div>

        {/* 3. Epistemic Uncertainty */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
              <span>Epistemic Uncertainty</span>
            </span>
            <span className="font-semibold text-amber-300 font-mono">
              {uncertaintyPct}%
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                uncertaintyPct > 50 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.max(5, uncertaintyPct)}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-1 text-[10px]">
            <span className="text-slate-500">Evidence State:</span>
            <span
              className={`font-medium ${
                uncertainty.isEvidenceSufficient ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {uncertainty.isEvidenceSufficient ? 'Sufficient' : 'Insufficient (Active Gating)'}
            </span>
          </div>
        </div>

        {/* 4. Prediction Horizon */}
        <div className="pt-2 border-t border-white/[0.04]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
              <span>Prediction Horizon</span>
            </span>
            <span className="font-mono text-slate-200">
              +1.8 s <span className="text-slate-500">(&Delta; {prediction.predictionError.toFixed(3)})</span>
            </span>
          </div>
        </div>

        {/* 5. Spatial Model */}
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-emerald-400" />
              <span>Spatial Model</span>
            </span>
            <span className="font-mono text-slate-200">
              {worldModel.relationships.length} <span className="text-slate-500">relations</span>
            </span>
          </div>
        </div>

        {/* 6. Current Goal */}
        <div className="pt-2 border-t border-white/[0.04]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-cyan-400" />
              <span>Current Goal</span>
            </span>
            <span
              className={`text-xs font-medium font-mono ${
                groundTruthTargetFound
                  ? 'text-emerald-400'
                  : 'text-cyan-300'
              }`}
            >
              {groundTruthTargetFound ? 'Target Tracked' : 'Searching Target X'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
