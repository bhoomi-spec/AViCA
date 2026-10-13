import React from 'react';
import { AblationCondition } from '../types/avica';
import { AblationRunResult, ABLATION_CONDITIONS_META } from '../evaluation/ablation_engine';
import { TrendingDown, Zap, Eye, Database, Brain, Sparkles, AlertTriangle } from 'lucide-react';

interface AblationChartsProps {
  results: Record<AblationCondition, AblationRunResult | null>;
}

export const AblationCharts: React.FC<AblationChartsProps> = ({ results }) => {
  const conditions: AblationCondition[] = [
    'FULL_AVICA',
    'AVICA_NO_MEMORY',
    'AVICA_NO_UNCERTAINTY',
    'AVICA_NO_ACTIVE_PERCEPTION',
    'AVICA_NO_PREDICTION',
    'AVICA_NO_SPATIAL_MODEL',
    'AVICA_NO_LEARNED_POLICY',
  ];

  const fullAvica = results.FULL_AVICA;

  const activeResults = conditions
    .map((c) => results[c])
    .filter((r): r is AblationRunResult => r !== null);

  // Maximum compute cost among all completed runs
  const maxCost = Math.max(
    100,
    ...activeResults.map((r) => r.metrics.computationCost || r.metrics.totalComputationCost)
  );

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/[0.06] pb-3 gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight">
            Component Ablation Analysis & Impact Curves
          </h3>
          <p className="text-xs text-slate-400 font-light">
            Empirically isolates the individual contribution of each cognitive faculty against FULL AViCA under identical conditions.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span>Completed: {activeResults.length} / 7 Experiments</span>
        </div>
      </div>

      {/* Grid of Key Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Chart 1: Tracking Accuracy & Degradation */}
        <div className="rounded-2xl glass-surface p-5 border border-white/[0.06] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Tracking Accuracy (%)
              </h4>
              <span className="text-[10px] font-mono text-cyan-400">Task Performance</span>
            </div>
            <p className="text-[11px] text-slate-400 font-light mb-4">
              Shows how removing each module degrades sustained target tracking (&lt;0.12 error threshold).
            </p>

            <div className="space-y-3">
              {conditions.map((cond) => {
                const meta = ABLATION_CONDITIONS_META[cond];
                const res = results[cond];
                const acc = res?.metrics.trackingAccuracy ?? 0;
                const isFull = cond === 'FULL_AVICA';

                // Delta vs full AViCA
                const delta = fullAvica && res ? acc - fullAvica.metrics.trackingAccuracy : null;

                return (
                  <div key={cond} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className={`font-medium ${isFull ? 'text-white' : 'text-slate-300'}`}>
                        {meta.name}
                      </span>
                      <div className="flex items-center gap-1.5 font-mono">
                        {res ? (
                          <>
                            <span className="text-white font-semibold">{acc}%</span>
                            {delta !== null && delta !== 0 && (
                              <span
                                className={`text-[10px] ${
                                  delta < 0 ? 'text-rose-400' : 'text-emerald-400'
                                }`}
                              >
                                ({delta > 0 ? `+${delta}` : delta}%)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                        )}
                      </div>
                    </div>

                    <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden">
                      {res ? (
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${acc}%`,
                            backgroundColor: meta.color,
                          }}
                        />
                      ) : (
                        <div className="h-full bg-transparent" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chart 2: Cumulative Compute Cost Impact */}
        <div className="rounded-2xl glass-surface p-5 border border-white/[0.06] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Computation Cost (FLOPS)
              </h4>
              <span className="text-[10px] font-mono text-emerald-400">Lower = Better</span>
            </div>
            <p className="text-[11px] text-slate-400 font-light mb-4">
              Ablating Active Perception causes massive compute ballooning due to continuous blind full-frame execution.
            </p>

            <div className="space-y-3">
              {conditions.map((cond) => {
                const meta = ABLATION_CONDITIONS_META[cond];
                const res = results[cond];
                const cost = res ? (res.metrics.computationCost || res.metrics.totalComputationCost) : 0;
                const costPercent = Math.min(100, (cost / maxCost) * 100);
                const isAblatedAP = cond === 'AVICA_NO_ACTIVE_PERCEPTION';

                return (
                  <div key={cond} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-300">{meta.name}</span>
                      <span className="font-mono text-slate-300">
                        {res ? (
                          <span
                            className={
                              isAblatedAP
                                ? 'text-rose-400 font-semibold'
                                : 'text-emerald-400 font-semibold'
                            }
                          >
                            {cost.toFixed(0)} pts
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">NOT RUN</span>
                        )}
                      </span>
                    </div>

                    <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden">
                      {res ? (
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${costPercent}%`,
                            backgroundColor: isAblatedAP ? '#f43f5e' : meta.color,
                          }}
                        />
                      ) : (
                        <div className="h-full bg-transparent" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chart 3: Post-Occlusion Recovery Accuracy */}
        <div className="rounded-2xl glass-surface p-5 border border-white/[0.06] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Occlusion Recovery (%)
              </h4>
              <span className="text-[10px] font-mono text-purple-400">Memory & Prediction</span>
            </div>
            <p className="text-[11px] text-slate-400 font-light mb-4">
              Demonstrates that Visual Working Memory and Predictive trajectory estimation are critical to survive occlusion.
            </p>

            <div className="space-y-3">
              {conditions.map((cond) => {
                const meta = ABLATION_CONDITIONS_META[cond];
                const res = results[cond];
                const recAcc = res?.metrics.recoveryAccuracy ?? 0;
                const isNoMemory = cond === 'AVICA_NO_MEMORY';

                return (
                  <div key={cond} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-300">{meta.name}</span>
                      <span className="font-mono text-slate-300">
                        {res ? (
                          <span
                            className={
                              isNoMemory || recAcc < 50
                                ? 'text-rose-400 font-semibold'
                                : 'text-emerald-400 font-semibold'
                            }
                          >
                            {recAcc}%
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">NOT RUN</span>
                        )}
                      </span>
                    </div>

                    <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden">
                      {res ? (
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${recAcc}%`,
                            backgroundColor: isNoMemory ? '#f43f5e' : meta.color,
                          }}
                        />
                      ) : (
                        <div className="h-full bg-transparent" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* SVG Time-Series Comparative Chart across Ablation Conditions */}
      {activeResults.length > 0 && (
        <div className="rounded-2xl glass-surface p-5 border border-white/[0.06] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Comparative Ablation Trajectory (100-Frame Controlled Run)
              </h4>
              <p className="text-[11px] text-slate-400 font-light">
                Frame-by-frame tracking curves under identical scenario seeds. Notice catastrophic track loss when Memory or Active Perception is removed.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
              {conditions.map((cond) => {
                const meta = ABLATION_CONDITIONS_META[cond];
                const hasRun = results[cond] !== null;
                return (
                  <div
                    key={cond}
                    className={`flex items-center gap-1.5 ${hasRun ? 'opacity-100' : 'opacity-30'}`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                    <span className="text-slate-300 text-[10px]">{meta.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative h-52 w-full bg-black/40 rounded-xl border border-white/[0.04] p-3 overflow-hidden">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
              <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <line x1="0" y1="60" x2="500" y2="60" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />

              {/* Occlusion Window */}
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

              {/* Render curves */}
              {conditions.map((cond) => {
                const res = results[cond];
                const meta = ABLATION_CONDITIONS_META[cond];
                if (!res || res.timeSeries.length < 2) return null;

                const points = res.timeSeries
                  .map((pt, idx) => {
                    const x = (idx / (res.timeSeries.length - 1)) * 500;
                    const y = 105 - (pt.accuracy / 100) * 90;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ');

                return (
                  <g key={cond}>
                    <polyline
                      fill="none"
                      stroke={meta.color}
                      strokeWidth={cond === 'FULL_AVICA' ? '3' : '1.5'}
                      strokeOpacity={cond === 'FULL_AVICA' ? '1' : '0.75'}
                      points={points}
                    />
                  </g>
                );
              })}
            </svg>

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
