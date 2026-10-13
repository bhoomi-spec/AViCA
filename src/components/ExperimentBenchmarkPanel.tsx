import React, { useState } from 'react';
import { FlaskConical, Play, CheckCircle2, BarChart3, AlertCircle, RefreshCw, Compass } from 'lucide-react';
import { BaselineMode, BenchmarkMetrics } from '../types/avica';
import {
  ScientificBenchmarkEngine,
  ExperimentRunResult,
  SYSTEM_DESCRIPTIONS,
} from '../evaluation/benchmark_engine';

interface ExperimentBenchmarkPanelProps {
  currentMetrics: BenchmarkMetrics;
  currentMode: BaselineMode;
}

export const ExperimentBenchmarkPanel: React.FC<ExperimentBenchmarkPanelProps> = ({
  currentMetrics,
  currentMode,
}) => {
  const [isRunningTrial, setIsRunningTrial] = useState(false);
  const [trialProgress, setTrialProgress] = useState(0);
  const [activeRunningMode, setActiveRunningMode] = useState<BaselineMode | null>(null);
  const [benchmarkResults, setBenchmarkResults] = useState<
    Record<BaselineMode, ExperimentRunResult | null>
  >({
    PASSIVE_VISION: null,
    ATTENTION_VISION: null,
    AVICA_GREEDY: null,
    AVICA_LEARNED: null,
    AVICA_ACTIVE: null,
  });

  const runControlledTrial = async (mode: BaselineMode) => {
    setIsRunningTrial(true);
    setActiveRunningMode(mode);
    setTrialProgress(0);
    try {
      const runner = new ScientificBenchmarkEngine();
      const result = await runner.runTrial(mode, 100, 101, (p) => setTrialProgress(p));
      setBenchmarkResults((prev) => ({
        ...prev,
        [mode]: result,
      }));
    } catch (err) {
      console.error('Benchmark trial failure:', err);
    } finally {
      setIsRunningTrial(false);
      setActiveRunningMode(null);
      setTrialProgress(0);
    }
  };

  const runAllTrials = async () => {
    setIsRunningTrial(true);
    setTrialProgress(0);
    try {
      const runner = new ScientificBenchmarkEngine();
      const modes: BaselineMode[] = [
        'PASSIVE_VISION',
        'ATTENTION_VISION',
        'AVICA_GREEDY',
        'AVICA_LEARNED',
      ];

      for (let i = 0; i < modes.length; i++) {
        const m = modes[i];
        setActiveRunningMode(m);
        const res = await runner.runTrial(m, 100, 101, (p) => {
          setTrialProgress(Math.round((i * 25) + (p * 0.25)));
        });
        setBenchmarkResults((prev) => ({
          ...prev,
          [m]: res,
        }));
      }
    } catch (err) {
      console.error('Benchmark suite failure:', err);
    } finally {
      setIsRunningTrial(false);
      setActiveRunningMode(null);
      setTrialProgress(0);
    }
  };

  const systems: BaselineMode[] = [
    'PASSIVE_VISION',
    'ATTENTION_VISION',
    'AVICA_GREEDY',
    'AVICA_LEARNED',
  ];

  return (
    <div className="flex flex-col rounded-lg border border-slate-800 bg-[#070a12] p-3 text-xs shadow-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-2 mb-2 gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-cyan-400" />
          <span className="font-mono font-semibold text-slate-200">
            SCIENTIFIC BENCHMARK HARNESS (4 COMPARABLE SYSTEMS &bull; IDENTICAL SCENARIO SEED 101)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAllTrials}
            disabled={isRunningTrial}
            className="flex items-center gap-1.5 rounded bg-cyan-600 px-2.5 py-1 font-mono text-[11px] font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
          >
            {isRunningTrial ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            <span>
              {isRunningTrial
                ? `Running ${SYSTEM_DESCRIPTIONS[activeRunningMode!]?.name} (${trialProgress}%)`
                : 'Run Comparative Suite (All 4)'}
            </span>
          </button>
        </div>
      </div>

      {/* Comparative Evaluation Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
              <th className="py-2 px-2.5">System Architecture</th>
              <th className="py-2 px-2.5">Tracking Acc.</th>
              <th className="py-2 px-2.5">Detection Acc.</th>
              <th className="py-2 px-2.5">Recovery Acc.</th>
              <th className="py-2 px-2.5">Continuity</th>
              <th className="py-2 px-2.5">Compute Cost</th>
              <th className="py-2 px-2.5">Avg Latency</th>
              <th className="py-2 px-2.5">Pred Error</th>
              <th className="py-2 px-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {systems.map((sysMode) => {
              const res = benchmarkResults[sysMode];
              const desc = SYSTEM_DESCRIPTIONS[sysMode];
              const isLearned = sysMode === 'AVICA_LEARNED';
              const isGreedy = sysMode === 'AVICA_GREEDY';

              return (
                <tr
                  key={sysMode}
                  className={`hover:bg-slate-900/40 ${
                    isLearned
                      ? 'bg-purple-950/20'
                      : isGreedy
                      ? 'bg-cyan-950/20'
                      : ''
                  }`}
                >
                  <td className="py-2 px-2.5">
                    <div className="font-semibold" style={{ color: desc.color }}>
                      {desc.name}
                    </div>
                    <div className="text-[9px] text-slate-500">{desc.summary}</div>
                  </td>
                  <td className="py-2 px-2.5">
                    {res ? (
                      <span className="font-bold" style={{ color: desc.color }}>
                        {res.metrics.trackingAccuracy}%
                      </span>
                    ) : (
                      <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                    )}
                  </td>
                  <td className="py-2 px-2.5">
                    {res ? (
                      <span>{res.metrics.detectionAccuracy}%</span>
                    ) : (
                      <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                    )}
                  </td>
                  <td className="py-2 px-2.5">
                    {res ? (
                      <span className="font-semibold text-emerald-400">
                        {res.metrics.recoveryAccuracy}% ({res.metrics.occlusionRecoverySuccesses}/{res.metrics.occlusionRecoveryAttempts})
                      </span>
                    ) : (
                      <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                    )}
                  </td>
                  <td className="py-2 px-2.5">
                    {res ? (
                      <span>{res.metrics.trackContinuity}%</span>
                    ) : (
                      <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                    )}
                  </td>
                  <td className="py-2 px-2.5">
                    {res ? (
                      <span
                        className={`font-semibold ${
                          sysMode === 'PASSIVE_VISION' ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {(res.metrics.computationCost || res.metrics.totalComputationCost).toFixed(0)} pts
                      </span>
                    ) : (
                      <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                    )}
                  </td>
                  <td className="py-2 px-2.5">
                    {res ? (
                      <span>{res.metrics.latency} ms ({res.metrics.fps} fps)</span>
                    ) : (
                      <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                    )}
                  </td>
                  <td className="py-2 px-2.5">
                    {res ? (
                      <span>{res.metrics.predictionError.toFixed(3)}</span>
                    ) : (
                      <span className="text-slate-500 font-mono text-[10px]">NOT RUN</span>
                    )}
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <button
                      onClick={() => runControlledTrial(sysMode)}
                      disabled={isRunningTrial}
                      className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                    >
                      Run Trial
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Multi-Step Predictive Horizon Benchmark Metrics */}
      <div className="mt-3 rounded border border-slate-800/90 bg-slate-900/40 p-2.5 font-mono">
        <div className="flex items-center justify-between text-[11px] text-slate-300 pb-1.5 mb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
            <span className="font-semibold text-slate-200">
              EMPIRICAL MULTI-STEP PREDICTION HORIZON BENCHMARKS (t+1, t+2, t+3, t+4)
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            Real observation error across horizons
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[10px]">
          {systems.map((s) => {
            const res = benchmarkResults[s];
            const desc = SYSTEM_DESCRIPTIONS[s];

            return (
              <div key={s} className="rounded border border-slate-800 bg-slate-950/60 p-2">
                <div className="font-semibold mb-1" style={{ color: desc.color }}>
                  {desc.name}
                </div>
                {res ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>Overall Err:</span>
                      <span className="font-bold text-slate-200">{res.metrics.predictionError.toFixed(4)}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-[9px] pt-1 border-t border-slate-800/60 text-slate-400">
                      <div>t+1: {res.metrics.predictionErrorT1?.toFixed(3) ?? '--'}</div>
                      <div>t+2: {res.metrics.predictionErrorT2?.toFixed(3) ?? '--'}</div>
                      <div>t+3: {res.metrics.predictionErrorT3?.toFixed(3) ?? '--'}</div>
                      <div>t+4: {res.metrics.predictionErrorT4?.toFixed(3) ?? '--'}</div>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500">Run trial to measure</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Spatial World Model & Depth Modality Benchmarks */}
      <div className="mt-3 rounded border border-slate-800/90 bg-slate-900/40 p-2.5 font-mono">
        <div className="flex items-center justify-between text-[11px] text-slate-300 pb-1.5 mb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-semibold text-slate-200">
              SPATIAL WORLD MODEL & DEPTH MODALITY BENCHMARKS
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            Relational predicates, depth consistency & metric 3D
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
          <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
            <span className="text-slate-400 block text-[9px]">Geometric Relations:</span>
            <span className="text-emerald-400 font-bold text-sm">
              {currentMetrics.spatialRelationshipCount ?? '--'}
            </span>
            <span className="text-slate-500 text-[9px] block">pairwise active</span>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
            <span className="text-slate-400 block text-[9px]">Relative Depth Consistency:</span>
            <span className="text-amber-400 font-bold text-sm">
              {currentMetrics.relativeDepthConsistency !== undefined ? `${currentMetrics.relativeDepthConsistency}%` : '--'}
            </span>
            <span className="text-slate-500 text-[9px] block">temporal rank preservation</span>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
            <span className="text-slate-400 block text-[9px]">Feature Matching Inliers:</span>
            <span className="text-cyan-400 font-bold text-sm">
              {currentMetrics.featureMatchInlierRate !== undefined ? `${currentMetrics.featureMatchInlierRate}%` : '--'}
            </span>
            <span className="text-slate-500 text-[9px] block">{currentMetrics.featureMatchCount ?? 0} matches</span>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
            <span className="text-slate-400 block text-[9px]">Metric 3D Status:</span>
            <span className={`font-bold text-xs ${currentMetrics.metricReconstructionActive ? 'text-cyan-300' : 'text-slate-400'}`}>
              {currentMetrics.metricReconstructionActive
                ? `ACTIVE (${currentMetrics.metricReprojectionErrorPx?.toFixed(2) ?? 0}px err)`
                : 'MONOCULAR (Relative)'}
            </span>
            <span className="text-slate-500 text-[9px] block">
              {currentMetrics.metricReconstructionActive ? 'triangulated stereo' : 'uncalibrated single-view'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-slate-400 font-mono space-y-0.5">
        <div>
          &bull; <strong>Strict Empirical Execution:</strong> Perception and cognitive engines receive <em>only</em> raw rendered image buffers. Ground truth is strictly isolated to this evaluation module.
        </div>
        <div className="text-slate-500">
          &bull; All 4 systems execute across an identical deterministic 100-frame seed with dynamic occluders and lighting shifts. No synthetic or invented numbers.
        </div>
      </div>
    </div>
  );
};
