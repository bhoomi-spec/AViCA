import React, { useState } from 'react';
import { PolicyTrainingCurvePoint, ALL_LEARNED_ACTIONS, LearnedPolicyAction } from '../types/learned_policy';
import {
  TrendingUp,
  Activity,
  Zap,
  Award,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface LearnedPolicyTrainingCurvesProps {
  curves: PolicyTrainingCurvePoint[];
}

export const LearnedPolicyTrainingCurves: React.FC<LearnedPolicyTrainingCurvesProps> = ({
  curves,
}) => {
  const [activeChart, setActiveChart] = useState<
    'REWARD' | 'INFO_COST' | 'TD_ERROR' | 'ACTIONS'
  >('REWARD');

  if (curves.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-10 text-center">
        <Activity className="h-10 w-10 text-slate-500 mx-auto mb-3 animate-pulse" />
        <h3 className="text-sm font-semibold text-white mb-1">
          No Training Curves Available
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
          The Q-learning policy has not recorded training episodes yet. Run the
          controlled simulator training above to produce empirical Bellman convergence
          curves.
        </p>
      </div>
    );
  }

  // Summary statistics from final episode
  const lastPoint = curves[curves.length - 1];
  const maxReward = Math.max(...curves.map((c) => c.cumulativeReward));
  const minReward = Math.min(...curves.map((c) => c.cumulativeReward));
  const rewardRange = Math.max(1, maxReward - minReward);

  const maxCost = Math.max(...curves.map((c) => c.totalComputeCost), 1);
  const maxInfo = Math.max(...curves.map((c) => c.totalInfoGain), 1);
  const maxTdError = Math.max(...curves.map((c) => c.tdError), 0.01);

  // SVG Chart dimensions
  const svgWidth = 800;
  const svgHeight = 220;
  const padding = { top: 20, right: 30, bottom: 30, left: 50 };
  const chartW = svgWidth - padding.left - padding.right;
  const chartH = svgHeight - padding.top - padding.bottom;

  const getX = (idx: number) =>
    padding.left + (idx / Math.max(1, curves.length - 1)) * chartW;

  const getYReward = (val: number) =>
    padding.top + chartH - ((val - minReward) / rewardRange) * chartH;

  const getYNorm = (val: number, max: number) =>
    padding.top + chartH - (Math.max(0, val) / max) * chartH;

  // Polyline points string
  const rewardPath = curves
    .map((c, i) => `${getX(i).toFixed(1)},${getYReward(c.cumulativeReward).toFixed(1)}`)
    .join(' ');

  const infoGainPath = curves
    .map((c, i) => `${getX(i).toFixed(1)},${getYNorm(c.totalInfoGain, maxInfo).toFixed(1)}`)
    .join(' ');

  const costPath = curves
    .map((c, i) => `${getX(i).toFixed(1)},${getYNorm(c.totalComputeCost, maxCost).toFixed(1)}`)
    .join(' ');

  const tdErrorPath = curves
    .map((c, i) => `${getX(i).toFixed(1)},${getYNorm(c.tdError, maxTdError).toFixed(1)}`)
    .join(' ');

  const actionColors: Record<LearnedPolicyAction, string> = {
    FULL_FRAME: '#ef4444',
    ROI_SELECTION: '#06b6d4',
    ZOOM: '#8b5cf6',
    TRACK: '#10b981',
    EDGE_ANALYSIS: '#f59e0b',
    FEATURE_MATCH: '#ec4899',
    DEPTH: '#3b82f6',
    WAIT: '#64748b',
  };

  return (
    <div className="space-y-4">
      {/* Telemetry Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Award className="h-3.5 w-3.5 text-amber-400" />
            <span>Latest Reward</span>
          </div>
          <div className="text-lg font-semibold text-white">
            {lastPoint.cumulativeReward.toFixed(1)}
          </div>
          <div className="text-[10px] text-slate-500">
            Peak: {maxReward.toFixed(1)}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            <span>Task Success</span>
          </div>
          <div className="text-lg font-semibold text-cyan-400">
            {lastPoint.taskSuccessRate}%
          </div>
          <div className="text-[10px] text-slate-500">Target maintained</div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span>TD Error (Loss)</span>
          </div>
          <div className="text-lg font-semibold text-emerald-400">
            {lastPoint.tdError.toFixed(4)}
          </div>
          <div className="text-[10px] text-slate-500">Bellman convergence</div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Activity className="h-3.5 w-3.5 text-violet-400" />
            <span>Exploration ε</span>
          </div>
          <div className="text-lg font-semibold text-violet-400">
            {lastPoint.epsilon.toFixed(3)}
          </div>
          <div className="text-[10px] text-slate-500">Decayed exploration</div>
        </div>
      </div>

      {/* Chart Selector Tabs */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setActiveChart('REWARD')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeChart === 'REWARD'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cumulative Reward
          </button>
          <button
            onClick={() => setActiveChart('INFO_COST')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeChart === 'INFO_COST'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Info Gain vs Compute Cost
          </button>
          <button
            onClick={() => setActiveChart('TD_ERROR')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeChart === 'TD_ERROR'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bellman TD Loss
          </button>
          <button
            onClick={() => setActiveChart('ACTIONS')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeChart === 'ACTIONS'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Action Distribution
          </button>
        </div>
        <span className="text-[11px] text-slate-400">
          {curves.length} Episodes Recorded
        </span>
      </div>

      {/* Main SVG Visualization */}
      <div className="rounded-xl border border-white/[0.06] bg-slate-950/40 p-3 overflow-x-auto">
        {activeChart === 'REWARD' && (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-2">
              <span className="text-amber-300 font-medium">
                Episode Reward: R = Success + InfoGain - Cost - Latency - RedundantObs
              </span>
              <span>Y-Axis: Total Return ({minReward.toFixed(1)} to {maxReward.toFixed(1)})</span>
            </div>
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-52">
              {/* Gridlines */}
              <line
                x1={padding.left}
                y1={padding.top}
                x2={svgWidth - padding.right}
                y2={padding.top}
                stroke="#334155"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={padding.left}
                y1={padding.top + chartH / 2}
                x2={svgWidth - padding.right}
                y2={padding.top + chartH / 2}
                stroke="#334155"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={padding.left}
                y1={padding.top + chartH}
                x2={svgWidth - padding.right}
                y2={padding.top + chartH}
                stroke="#334155"
                strokeWidth="1"
              />

              {/* Reward Path */}
              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                points={rewardPath}
              />

              {/* Data points */}
              {curves.map((c, i) => (
                <circle
                  key={i}
                  cx={getX(i)}
                  cy={getYReward(c.cumulativeReward)}
                  r="3"
                  fill="#f59e0b"
                  className="hover:r-5 transition-all"
                >
                  <title>
                    Episode {c.episode}: Reward = {c.cumulativeReward.toFixed(1)}, Success = {c.taskSuccessRate}%
                  </title>
                </circle>
              ))}

              {/* Axis labels */}
              <text x={padding.left - 5} y={padding.top + 5} fill="#94a3b8" fontSize="10" textAnchor="end">
                {maxReward.toFixed(0)}
              </text>
              <text x={padding.left - 5} y={padding.top + chartH} fill="#94a3b8" fontSize="10" textAnchor="end">
                {minReward.toFixed(0)}
              </text>
              <text x={padding.left} y={svgHeight - 8} fill="#94a3b8" fontSize="10">
                Ep 1
              </text>
              <text x={svgWidth - padding.right} y={svgHeight - 8} fill="#94a3b8" fontSize="10" textAnchor="end">
                Ep {curves.length}
              </text>
            </svg>
          </div>
        )}

        {activeChart === 'INFO_COST' && (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  Info Gain (Uncertainty Reduction)
                </span>
                <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  Compute Cost (FLOPS)
                </span>
              </div>
              <span>Tradeoff Progression</span>
            </div>
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-52">
              <line
                x1={padding.left}
                y1={padding.top + chartH}
                x2={svgWidth - padding.right}
                y2={padding.top + chartH}
                stroke="#334155"
                strokeWidth="1"
              />
              {/* Info Gain */}
              <polyline
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                points={infoGainPath}
              />
              {/* Compute Cost */}
              <polyline
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2"
                strokeDasharray="4 2"
                points={costPath}
              />
            </svg>
          </div>
        )}

        {activeChart === 'TD_ERROR' && (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-2">
              <span className="text-emerald-400 font-medium">
                Bellman TD Error |Q(s, a) - (r + γ max Q(s&apos;, a&apos;))|
              </span>
              <span>Convergence Measure (Lower is better)</span>
            </div>
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-52">
              <line
                x1={padding.left}
                y1={padding.top + chartH}
                x2={svgWidth - padding.right}
                y2={padding.top + chartH}
                stroke="#334155"
                strokeWidth="1"
              />
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                points={tdErrorPath}
              />
            </svg>
          </div>
        )}

        {activeChart === 'ACTIONS' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-2">
              <span className="text-slate-200 font-medium">
                Latest Episode Action Distribution
              </span>
              <span>Action Selection Frequency</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {ALL_LEARNED_ACTIONS.map((act) => {
                const count = lastPoint.actionCounts[act] || 0;
                const pct = lastPoint.totalSteps > 0
                  ? Math.round((count / lastPoint.totalSteps) * 100)
                  : 0;
                return (
                  <div
                    key={act}
                    className="p-2.5 rounded-lg border border-white/[0.04] bg-white/[0.02] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: actionColors[act] }}
                      />
                      <span className="text-xs font-mono text-slate-300">
                        {act}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-white">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
