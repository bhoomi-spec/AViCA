import React, { useState } from 'react';
import {
  ALL_LEARNED_ACTIONS,
  LearnedPolicyAction,
  PolicyState,
} from '../types/learned_policy';
import { sharedQLearningPolicy } from '../active_perception/q_learning_policy';
import {
  Sliders,
  Sparkles,
  Zap,
  Info,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { ACTION_COST_TABLE } from '../active_perception/utility';

export const LearnedPolicyInspector: React.FC = () => {
  const [state, setState] = useState<PolicyState>({
    uncertainty: 0.15,
    candidateCount: 1,
    targetConfidence: 0.88,
    motion: 0.25,
    occlusionProbability: 0.05,
    memoryConfidence: 0.90,
    computeBudget: 0.80,
  });

  const evaluation = sharedQLearningPolicy.selectAction(state, 0.0);
  const qValues = evaluation.allQValues;
  const bestAction = evaluation.action;
  const maxQ = evaluation.qValue;

  const minQ = Math.min(...ALL_LEARNED_ACTIONS.map((a) => qValues[a]));
  const qRange = Math.max(0.5, maxQ - minQ);

  const setPreset = (presetName: string) => {
    switch (presetName) {
      case 'LOCKED_TRACK':
        setState({
          uncertainty: 0.10,
          candidateCount: 1,
          targetConfidence: 0.92,
          motion: 0.30,
          occlusionProbability: 0.05,
          memoryConfidence: 0.95,
          computeBudget: 0.85,
        });
        break;
      case 'IMMINENT_OCCLUSION':
        setState({
          uncertainty: 0.45,
          candidateCount: 1,
          targetConfidence: 0.70,
          motion: 0.40,
          occlusionProbability: 0.85,
          memoryConfidence: 0.80,
          computeBudget: 0.75,
        });
        break;
      case 'OCCLUDED_PREDICTION':
        setState({
          uncertainty: 0.65,
          candidateCount: 0,
          targetConfidence: 0.30,
          motion: 0.20,
          occlusionProbability: 0.95,
          memoryConfidence: 0.60,
          computeBudget: 0.70,
        });
        break;
      case 'CLUTTER_AMBIGUITY':
        setState({
          uncertainty: 0.75,
          candidateCount: 3,
          targetConfidence: 0.40,
          motion: 0.15,
          occlusionProbability: 0.10,
          memoryConfidence: 0.35,
          computeBudget: 0.80,
        });
        break;
      case 'LOW_BUDGET':
        setState({
          uncertainty: 0.20,
          candidateCount: 1,
          targetConfidence: 0.85,
          motion: 0.05,
          occlusionProbability: 0.05,
          memoryConfidence: 0.85,
          computeBudget: 0.15,
        });
        break;
      case 'BLIND_LOST':
        setState({
          uncertainty: 0.95,
          candidateCount: 0,
          targetConfidence: 0.05,
          motion: 0.00,
          occlusionProbability: 0.05,
          memoryConfidence: 0.05,
          computeBudget: 0.90,
        });
        break;
    }
  };

  const actionExplanations: Record<LearnedPolicyAction, string> = {
    FULL_FRAME: 'Scans entire visual sensor buffer; recommended when candidates are completely absent or lost.',
    ROI_SELECTION: 'Foveates sub-bounding-box around candidate or predicted emergence zone with high resolution.',
    ZOOM: 'Engages optical zoom on subtle candidate regions when budget permits.',
    TRACK: 'Maintains low-cost Kalman optical window on moving locked target.',
    EDGE_ANALYSIS: 'Runs Canny and Sobel edge boundary extraction to resolve faint shapes.',
    FEATURE_MATCH: 'Evaluates multi-channel color/shape descriptor correlation against reference memory template.',
    DEPTH: 'Calculates vertical ground-contact monocular depth and layering order.',
    WAIT: 'Conserves compute and sensor reads; holds target state in working memory without pixel capture.',
  };

  return (
    <div className="space-y-4">
      {/* Presets Bar */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          Archetype Presets:
        </span>
        <button
          onClick={() => setPreset('LOCKED_TRACK')}
          className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 transition-all border border-white/[0.06]"
        >
          Locked Tracking
        </button>
        <button
          onClick={() => setPreset('IMMINENT_OCCLUSION')}
          className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 transition-all border border-white/[0.06]"
        >
          Imminent Occlusion
        </button>
        <button
          onClick={() => setPreset('OCCLUDED_PREDICTION')}
          className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 transition-all border border-white/[0.06]"
        >
          Occluded Extrapolation
        </button>
        <button
          onClick={() => setPreset('CLUTTER_AMBIGUITY')}
          className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 transition-all border border-white/[0.06]"
        >
          Multi-Blob Ambiguity
        </button>
        <button
          onClick={() => setPreset('LOW_BUDGET')}
          className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 transition-all border border-white/[0.06]"
        >
          Budget Constrained
        </button>
        <button
          onClick={() => setPreset('BLIND_LOST')}
          className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 transition-all border border-white/[0.06]"
        >
          Target Lost (Reset)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* State Sliders (7 Dimensions) */}
        <div className="lg:col-span-5 space-y-3 rounded-xl border border-white/[0.06] bg-slate-900/40 p-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-cyan-400" />
              7-Dimensional Policy State
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              s = (u, c, tc, m, op, mc, cb)
            </span>
          </div>

          {/* 1. Uncertainty */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Epistemic Uncertainty</span>
              <span className="font-mono text-cyan-400">{state.uncertainty.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={state.uncertainty}
              onChange={(e) => setState({ ...state, uncertainty: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* 2. Candidate Count */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Candidate Count</span>
              <span className="font-mono text-cyan-400">{state.candidateCount}</span>
            </div>
            <input
              type="range"
              min="0"
              max="4"
              step="1"
              value={state.candidateCount}
              onChange={(e) => setState({ ...state, candidateCount: parseInt(e.target.value, 10) })}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* 3. Target Confidence */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Target Confidence</span>
              <span className="font-mono text-cyan-400">{state.targetConfidence.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={state.targetConfidence}
              onChange={(e) => setState({ ...state, targetConfidence: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* 4. Motion Dynamics */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Target Motion Velocity</span>
              <span className="font-mono text-cyan-400">{state.motion.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={state.motion}
              onChange={(e) => setState({ ...state, motion: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* 5. Occlusion Probability */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Occlusion Risk Probability</span>
              <span className="font-mono text-cyan-400">{state.occlusionProbability.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={state.occlusionProbability}
              onChange={(e) => setState({ ...state, occlusionProbability: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* 6. Memory Confidence */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Working Memory Confidence</span>
              <span className="font-mono text-cyan-400">{state.memoryConfidence.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={state.memoryConfidence}
              onChange={(e) => setState({ ...state, memoryConfidence: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* 7. Compute Budget */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Normalized Compute Budget</span>
              <span className="font-mono text-cyan-400">{state.computeBudget.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={state.computeBudget}
              onChange={(e) => setState({ ...state, computeBudget: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>
        </div>

        {/* Live Q-Values Visualization (8 Actions) */}
        <div className="lg:col-span-7 space-y-3 rounded-xl border border-white/[0.06] bg-slate-900/40 p-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              State-Action Q-Values Q(s, ·)
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <span>Selected Action:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-semibold border border-emerald-500/30">
                {bestAction}
              </span>
            </div>
          </div>

          {/* Q-Value Bars for all 8 actions */}
          <div className="space-y-2 pt-1">
            {ALL_LEARNED_ACTIONS.map((act) => {
              const q = qValues[act];
              const isBest = act === bestAction;
              const normalizedPct = Math.max(
                5,
                Math.min(100, ((q - minQ) / qRange) * 100)
              );

              return (
                <div key={act} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-xs ${
                          isBest ? 'text-emerald-400 font-bold' : 'text-slate-300'
                        }`}
                      >
                        {act}
                      </span>
                      {isBest && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400">
                          argmax
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono text-xs ${
                        isBest ? 'text-emerald-300 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {q > 0 ? `+${q.toFixed(2)}` : q.toFixed(2)}
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-white/[0.04] overflow-hidden flex items-center">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        isBest
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                          : 'bg-slate-600/70'
                      }`}
                      style={{ width: `${normalizedPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Winning Action Explanation */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Optimal Policy Decision: {bestAction} (Q = {maxQ.toFixed(2)})</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {actionExplanations[bestAction]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
