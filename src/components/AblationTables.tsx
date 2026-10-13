import React from 'react';
import { AblationCondition } from '../types/avica';
import { AblationRunResult, ABLATION_CONDITIONS_META } from '../evaluation/ablation_engine';
import { Check, X, Minus } from 'lucide-react';

interface AblationTablesProps {
  results: Record<AblationCondition, AblationRunResult | null>;
}

export const AblationTables: React.FC<AblationTablesProps> = ({ results }) => {
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

  return (
    <div className="space-y-6">
      {/* Primary Ablation Comparative Table */}
      <div className="rounded-2xl glass-surface p-5 border border-white/[0.06] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-white/[0.06] gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Ablation Study Empirical Data Matrix (All 7 Conditions)
            </h3>
            <p className="text-xs text-slate-400 font-light">
              Direct component ablation under identical seed conditions. Missing results display <strong className="text-slate-300">NOT RUN</strong> without synthetic interpolation.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-300 border border-white/[0.06]">
            Strict Empirical Measurement
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400">
                <th className="py-2.5 px-3 font-sans font-medium">Ablation Condition</th>
                <th className="py-2.5 px-3">Tracking Acc.</th>
                <th className="py-2.5 px-3">Detection Acc.</th>
                <th className="py-2.5 px-3">Recovery Acc.</th>
                <th className="py-2.5 px-3">Continuity</th>
                <th className="py-2.5 px-3">Compute Cost</th>
                <th className="py-2.5 px-3">Latency (ms)</th>
                <th className="py-2.5 px-3">Pred Error</th>
                <th className="py-2.5 px-3">Info Gain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-slate-300">
              {conditions.map((cond) => {
                const meta = ABLATION_CONDITIONS_META[cond];
                const res = results[cond];
                const isFull = cond === 'FULL_AVICA';

                return (
                  <tr
                    key={cond}
                    className={`hover:bg-white/[0.02] ${
                      isFull ? 'bg-cyan-500/[0.04]' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-sans">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className={`font-semibold ${isFull ? 'text-cyan-300' : 'text-slate-200'}`}>
                          {meta.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-light block pl-4">
                        {meta.description}
                      </span>
                    </td>

                    {/* Tracking Accuracy */}
                    <td className="py-2 px-3">
                      {res ? (
                        <span
                          className={`font-semibold ${
                            isFull ? 'text-cyan-300 font-bold' : 'text-slate-200'
                          }`}
                        >
                          {res.metrics.trackingAccuracy}%
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                      )}
                    </td>

                    {/* Detection Accuracy */}
                    <td className="py-2 px-3">
                      {res ? (
                        <span>{res.metrics.detectionAccuracy}%</span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                      )}
                    </td>

                    {/* Recovery Accuracy */}
                    <td className="py-2 px-3">
                      {res ? (
                        <span
                          className={
                            res.metrics.recoveryAccuracy < 60
                              ? 'text-rose-400 font-semibold'
                              : 'text-emerald-400 font-semibold'
                          }
                        >
                          {res.metrics.recoveryAccuracy}%
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                      )}
                    </td>

                    {/* Track Continuity */}
                    <td className="py-2 px-3">
                      {res ? (
                        <span>{res.metrics.trackContinuity}%</span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                      )}
                    </td>

                    {/* Compute Cost */}
                    <td className="py-2 px-3">
                      {res ? (
                        <span
                          className={
                            cond === 'AVICA_NO_ACTIVE_PERCEPTION'
                              ? 'text-rose-400 font-bold'
                              : 'text-emerald-400'
                          }
                        >
                          {(res.metrics.computationCost || res.metrics.totalComputationCost).toFixed(0)} pts
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                      )}
                    </td>

                    {/* Latency */}
                    <td className="py-2 px-3">
                      {res ? (
                        <span>{res.metrics.latency} ms</span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                      )}
                    </td>

                    {/* Prediction Error */}
                    <td className="py-2 px-3">
                      {res ? (
                        <span>{res.metrics.predictionError.toFixed(3)}</span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                      )}
                    </td>

                    {/* Info Gain / Uncertainty Reduction */}
                    <td className="py-2 px-3">
                      {res ? (
                        <span className="text-purple-300">
                          +{res.metrics.uncertaintyReduction.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Component Configuration Matrix */}
      <div className="rounded-2xl glass-surface p-5 border border-white/[0.06] overflow-hidden">
        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
          Component Ablation Subsystem Matrix
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400">
                <th className="py-2 px-3 font-sans">Condition</th>
                <th className="py-2 px-2.5 text-center">Working Memory</th>
                <th className="py-2 px-2.5 text-center">Uncertainty</th>
                <th className="py-2 px-2.5 text-center">Active Perception</th>
                <th className="py-2 px-2.5 text-center">Prediction</th>
                <th className="py-2 px-2.5 text-center">Spatial Model</th>
                <th className="py-2 px-2.5 text-center">Learned Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-slate-300">
              {conditions.map((cond) => {
                const meta = ABLATION_CONDITIONS_META[cond];
                const cfg = meta.config;

                return (
                  <tr key={cond} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 font-sans font-medium text-slate-200">
                      {meta.name}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      {cfg.enableWorkingMemory ? (
                        <span className="text-emerald-400 font-bold">&#10003;</span>
                      ) : (
                        <span className="text-rose-400 font-bold">&#10007;</span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      {cfg.enableUncertainty ? (
                        <span className="text-emerald-400 font-bold">&#10003;</span>
                      ) : (
                        <span className="text-rose-400 font-bold">&#10007;</span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      {cfg.enableActivePerception ? (
                        <span className="text-emerald-400 font-bold">&#10003;</span>
                      ) : (
                        <span className="text-rose-400 font-bold">&#10007;</span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      {cfg.enablePrediction ? (
                        <span className="text-emerald-400 font-bold">&#10003;</span>
                      ) : (
                        <span className="text-rose-400 font-bold">&#10007;</span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      {cfg.enableSpatialModel ? (
                        <span className="text-emerald-400 font-bold">&#10003;</span>
                      ) : (
                        <span className="text-rose-400 font-bold">&#10007;</span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      {cfg.enableLearnedPolicy ? (
                        <span className="text-emerald-400 font-bold">&#10003;</span>
                      ) : (
                        <span className="text-rose-400 font-bold">&#10007;</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
