import React, { useId } from 'react';
import { ExperimentRunResult, SYSTEM_DESCRIPTIONS } from '../evaluation/benchmark_engine';
import { BaselineMode } from '../types/avica';

interface BenchmarkChartsProps {
  results: Record<BaselineMode, ExperimentRunResult | null>;
}

export const BenchmarkCharts: React.FC<BenchmarkChartsProps> = ({ results }) => {
  const gradientIdAcc = useId();
  const gradientIdCost = useId();

  const activeResults = (
    ['PASSIVE_VISION', 'ATTENTION_VISION', 'AVICA_GREEDY', 'AVICA_LEARNED'] as BaselineMode[]
  )
    .map((mode) => results[mode])
    .filter((r): r is ExperimentRunResult => r !== null);

  if (activeResults.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
        <p className="text-xs text-slate-400">
          No benchmark execution data available yet. Click &quot;Execute Full Suite (All 4 Systems)&quot; above to run real controlled trials and render dynamic comparative charts.
        </p>
      </div>
    );
  }

  // 1. Radar / Multi-Metric Bar Data
  const systems = [
    { mode: 'PASSIVE_VISION' as BaselineMode, label: 'Passive Vision', color: '#94a3b8' },
    { mode: 'ATTENTION_VISION' as BaselineMode, label: 'Attention Vision', color: '#f59e0b' },
    { mode: 'AVICA_GREEDY' as BaselineMode, label: 'AViCA Greedy', color: '#06b6d4' },
    { mode: 'AVICA_LEARNED' as BaselineMode, label: 'AViCA Learned Policy', color: '#a855f7' },
  ];

  // Maximum compute cost among completed systems for normalized scaling
  const maxCost = Math.max(
    100,
    ...activeResults.map((r) => r.metrics.computationCost || r.metrics.totalComputationCost)
  );

  // Maximum latency
  const maxLatency = Math.max(10, ...activeResults.map((r) => r.metrics.latency || r.metrics.averageLatencyMs));

  // Determine maximum time-series length
  const longestTimeSeries = activeResults.reduce<ExperimentRunResult['timeSeries']>(
    (acc, r) => (r.timeSeries.length > acc.length ? r.timeSeries : acc),
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight">
            Scientific Empirical Visualizations & Multi-Metric Analysis
          </h3>
          <p className="text-xs text-slate-400 font-light">
            Dynamic charts computed strictly from frame-by-frame execution under identical scenario seeds ({activeResults[0]?.seed ?? 101}).
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          {systems.map((s) => (
            <div key={s.mode} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-slate-300">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid of Key Comparative Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Chart 1: Detection & Tracking Accuracy Comparison */}
        <div className="rounded-2xl glass-surface p-5 border border-white/[0.06] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Accuracy & Continuity (%)
              </h4>
              <span className="text-[10px] font-mono text-cyan-400">Higher = Better</span>
            </div>
            <p className="text-[11px] text-slate-400 font-light mb-4">
              Measures target detection accuracy, tracking accuracy (&lt;0.12 err), and unbroken continuity across occlusion.
            </p>

            <div className="space-y-4">
              {systems.map((sys) => {
                const res = results[sys.mode];
                const trackAcc = res?.metrics.trackingAccuracy ?? 0;
                const detectAcc = res?.metrics.detectionAccuracy ?? 0;
                const continuity = res?.metrics.trackContinuity ?? 0;

                return (
                  <div key={sys.mode} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium" style={{ color: sys.color }}>
                        {sys.label}
                      </span>
                      <span className="font-mono text-slate-300 font-semibold">
                        {res ? `${trackAcc}% trk / ${detectAcc}% det` : 'Not run'}
                      </span>
                    </div>
                    {/* Multi-tier bar */}
                    <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden flex">
                      <div
                        className="h-full rounded-l-full transition-all duration-500"
                        style={{
                          width: `${trackAcc}%`,
                          backgroundColor: sys.color,
                        }}
                        title={`Tracking Accuracy: ${trackAcc}%`}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Continuity: {res ? `${continuity}%` : '--'}</span>
                      <span>Recovery Acc: {res ? `${res.metrics.recoveryAccuracy}%` : '--'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chart 2: Cumulative Computation Cost vs Latency */}
        <div className="rounded-2xl glass-surface p-5 border border-white/[0.06] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Compute Cost vs Efficiency
              </h4>
              <span className="text-[10px] font-mono text-emerald-400">Lower Cost = Better</span>
            </div>
            <p className="text-[11px] text-slate-400 font-light mb-4">
              Cumulative tool FLOPS and average cycle latency (ms). Demonstrates how active perception eliminates blind full-frame wastage.
            </p>

            <div className="space-y-4">
              {systems.map((sys) => {
                const res = results[sys.mode];
                const cost = res ? (res.metrics.computationCost || res.metrics.totalComputationCost) : 0;
                const latency = res ? (res.metrics.latency || res.metrics.averageLatencyMs) : 0;
                const fps = res ? (res.metrics.fps || res.metrics.effectiveFps) : 0;
                const costPercent = Math.min(100, (cost / maxCost) * 100);

                return (
                  <div key={sys.mode} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium" style={{ color: sys.color }}>
                        {sys.label}
                      </span>
                      <span className="font-mono text-slate-300 font-semibold">
                        {res ? `${cost.toFixed(0)} cost (${latency}ms)` : 'Not run'}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${costPercent}%`,
                          backgroundColor: sys.mode === 'PASSIVE_VISION' ? '#f43f5e' : sys.color,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Effective FPS: {res ? `${fps} fps` : '--'}</span>
                      <span>ROI Inspections: {res ? res.metrics.roiInspections : '--'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chart 3: Prediction Error & Recovery Time */}
        <div className="rounded-2xl glass-surface p-5 border border-white/[0.06] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Prediction & Occlusion Recovery
              </h4>
              <span className="text-[10px] font-mono text-purple-400">Lower Error = Better</span>
            </div>
            <p className="text-[11px] text-slate-400 font-light mb-4">
              Mean Euclidean prediction error and recovery latency (number of frames to re-acquire target post-occlusion).
            </p>

            <div className="space-y-4">
              {systems.map((sys) => {
                const res = results[sys.mode];
                const predErr = res ? (res.metrics.predictionError || res.metrics.meanPredictionError) : 0;
                const recTime = res ? res.metrics.recoveryTime : 0;
                const uncertaintyRed = res ? (res.metrics.uncertaintyReduction || res.metrics.meanUncertaintyReduction) : 0;

                return (
                  <div key={sys.mode} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium" style={{ color: sys.color }}>
                        {sys.label}
                      </span>
                      <span className="font-mono text-slate-300 font-semibold">
                        {res ? `Err: ${predErr.toFixed(3)} | Rec: ${recTime}f` : 'Not run'}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(10, (1 - predErr) * 100))}%`,
                          backgroundColor: sys.color,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Info Gain: +{res ? uncertaintyRed.toFixed(2) : '--'}</span>
                      <span>Occlusion: {res ? `${res.metrics.occlusionRecoverySuccesses}/${res.metrics.occlusionRecoveryAttempts}` : '--'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* SVG Time-Series Chart: Dynamic Trajectory of Tracking & Cumulative Compute */}
      {longestTimeSeries.length > 0 && (
        <div className="rounded-2xl glass-surface p-5 border border-white/[0.06] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Empirical Execution Time-Series (Per-Frame Tracking Accuracy Curve)
              </h4>
              <p className="text-[11px] text-slate-400 font-light">
                Live sampled tracking accuracy curve across 100 frames. Note how AViCA maintains lock during occlusion events (frames ~30-50).
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-slate-400">100-Frame Scenario Time Series</span>
            </div>
          </div>

          <div className="relative h-48 w-full bg-black/40 rounded-xl border border-white/[0.04] p-3 overflow-hidden">
            {/* SVG Plot */}
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
              <defs>
                {/* Grid pattern */}
                <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                <line x1="0" y1="60" x2="500" y2="60" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                <line x1="0" y1="90" x2="500" y2="90" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              </defs>

              {/* Shaded Occlusion Band around center (approx frame 30 to 55) */}
              <rect
                x="150"
                y="5"
                width="120"
                height="110"
                fill="rgba(244,63,94,0.08)"
                stroke="rgba(244,63,94,0.2)"
                strokeDasharray="2 2"
              />
              <text x="210" y="20" fill="rgba(244,63,94,0.6)" fontSize="8" fontFamily="monospace" textAnchor="middle">
                OCCLUSION WINDOW
              </text>

              {/* Render polylines for each system */}
              {systems.map((sys) => {
                const res = results[sys.mode];
                if (!res || res.timeSeries.length < 2) return null;

                const points = res.timeSeries.map((pt, idx) => {
                  const x = (idx / (res.timeSeries.length - 1)) * 500;
                  // Invert Y: 100% accuracy = top (y = 15), 0% = bottom (y = 105)
                  const y = 105 - (pt.accuracy / 100) * 90;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(' ');

                return (
                  <g key={sys.mode}>
                    <polyline
                      fill="none"
                      stroke={sys.color}
                      strokeWidth={sys.mode.includes('AVICA') ? '2.5' : '1.5'}
                      strokeOpacity={sys.mode.includes('AVICA') ? '0.95' : '0.6'}
                      points={points}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Axis Labels */}
            <div className="absolute bottom-1 left-3 right-3 flex justify-between text-[9px] font-mono text-slate-500 pointer-events-none">
              <span>Frame 0</span>
              <span>Frame 25</span>
              <span>Frame 50 (Occlusion)</span>
              <span>Frame 75</span>
              <span>Frame 100</span>
            </div>
            <div className="absolute top-2 left-2 text-[9px] font-mono text-slate-500 pointer-events-none">
              100% Acc
            </div>
            <div className="absolute bottom-4 left-2 text-[9px] font-mono text-slate-500 pointer-events-none">
              0% Acc
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
