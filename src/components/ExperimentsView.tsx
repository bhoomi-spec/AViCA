import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  RotateCw,
  BarChart3,
  Sliders,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Award,
  Sparkles,
} from 'lucide-react';
import { BaselineMode, BenchmarkMetrics } from '../types/avica';
import {
  ScientificBenchmarkEngine,
  ExperimentRunResult,
  SYSTEM_DESCRIPTIONS,
} from '../evaluation/benchmark_engine';
import { BenchmarkCharts } from './BenchmarkCharts';
import { BenchmarkTables } from './BenchmarkTables';
import { AblationStudyView } from './AblationStudyView';
import { LearnedPolicyView } from './LearnedPolicyView';
import { GravitonBenchmarkView } from './GravitonBenchmarkView';
import { Scissors, Brain, Server, Download } from 'lucide-react';

interface ExperimentsViewProps {
  currentMetrics: BenchmarkMetrics;
  currentMode: BaselineMode;
}

export const ExperimentsView: React.FC<ExperimentsViewProps> = ({
  currentMetrics,
  currentMode,
}) => {
  const [isRunningTrial, setIsRunningTrial] = useState(false);
  const [trialProgress, setTrialProgress] = useState(0);
  const [activeRunningMode, setActiveRunningMode] = useState<BaselineMode | null>(null);
  const [selectedSeed, setSelectedSeed] = useState<number>(101);
  const [trialFrameCount, setTrialFrameCount] = useState<number>(100);
  const [activeTab, setActiveTab] = useState<'GRAVITON_BENCHMARK' | 'LEARNED_POLICY' | 'ABLATIONS' | 'OVERVIEW' | 'CHARTS' | 'TABLES'>('GRAVITON_BENCHMARK');

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
      const result = await runner.runTrial(mode, trialFrameCount, selectedSeed, (p) =>
        setTrialProgress(p)
      );
      setBenchmarkResults((prev) => ({
        ...prev,
        [mode]: result,
      }));
    } catch (err) {
      console.error('Benchmark trial error:', err);
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
        const res = await runner.runTrial(m, trialFrameCount, selectedSeed, (p) => {
          setTrialProgress(Math.round((i * 25) + (p * 0.25)));
        });
        setBenchmarkResults((prev) => ({
          ...prev,
          [m]: res,
        }));
      }
    } catch (err) {
      console.error('Benchmark suite error:', err);
    } finally {
      setIsRunningTrial(false);
      setActiveRunningMode(null);
      setTrialProgress(0);
    }
  };

  const exportBenchmarkSuiteResults = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      seed: selectedSeed,
      frameCount: trialFrameCount,
      results: benchmarkResults,
      currentLiveMetrics: currentMetrics,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avica_benchmark_suite_seed_${selectedSeed}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const systems: BaselineMode[] = [
    'PASSIVE_VISION',
    'ATTENTION_VISION',
    'AVICA_GREEDY',
    'AVICA_LEARNED',
  ];

  return (
    <div className="space-y-6">
      {/* View Header & Scenario Config */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.04]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium text-white tracking-tight">
              Scientific Benchmark System
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              4 Comparable Architectures
            </span>
          </div>
          <p className="text-xs text-slate-400 font-light mt-0.5">
            Strict empirical benchmarking under identical deterministic scenarios. Every value computed live via offscreen canvas execution.
          </p>
        </div>

        {/* Controls & Seed Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 text-xs">
            <Sliders className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-400">Scenario Seed:</span>
            <select
              value={selectedSeed}
              onChange={(e) => setSelectedSeed(Number(e.target.value))}
              disabled={isRunningTrial}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value={101} className="bg-slate-900 text-slate-200">
                Seed 101 (Adversarial Occlusion)
              </option>
              <option value={202} className="bg-slate-900 text-slate-200">
                Seed 202 (High Clutter & Jitter)
              </option>
              <option value={303} className="bg-slate-900 text-slate-200">
                Seed 303 (Rapid Illumination Shifts)
              </option>
            </select>
          </div>

          <button
            onClick={exportBenchmarkSuiteResults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 transition-all"
            title="Export full 4-system benchmark evaluation suite as JSON"
          >
            <Download className="h-3.5 w-3.5 text-cyan-400" />
            <span>Export Suite JSON</span>
          </button>

          <button
            onClick={runAllTrials}
            disabled={isRunningTrial}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30 hover:border-cyan-400/50 disabled:opacity-40 transition-all shadow-lg shadow-cyan-500/10"
          >
            {isRunningTrial ? (
              <RotateCw className="h-4 w-4 animate-spin text-cyan-400" />
            ) : (
              <Play className="h-4 w-4 text-cyan-400" />
            )}
            <span>
              {isRunningTrial
                ? `Running ${SYSTEM_DESCRIPTIONS[activeRunningMode!]?.name} (${trialProgress}%)`
                : 'Execute Full Suite (All 4 Systems)'}
            </span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation: System Overview vs Charts vs Tables */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('GRAVITON_BENCHMARK')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'GRAVITON_BENCHMARK'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="h-3 w-3 text-cyan-400" />
            <span>AWS Graviton / Arm & COOL</span>
          </button>
          <button
            onClick={() => setActiveTab('LEARNED_POLICY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'LEARNED_POLICY'
                ? 'bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="h-3 w-3 text-violet-400" />
            <span>Learned Policy (Q-Learning)</span>
          </button>
          <button
            onClick={() => setActiveTab('ABLATIONS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'ABLATIONS'
                ? 'bg-pink-500/20 text-pink-300 font-semibold border border-pink-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scissors className="h-3 w-3 text-pink-400" />
            <span>Ablation Framework (7 Conditions)</span>
          </button>
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'OVERVIEW'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            4-System Benchmark Cards
          </button>
          <button
            onClick={() => setActiveTab('CHARTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'CHARTS'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Comparative Visual Charts
          </button>
          <button
            onClick={() => setActiveTab('TABLES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'TABLES'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            12-Metric Empirical Matrix
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          Evaluator: ScientificEvaluationSubsystem (Ground-Truth Isolated)
        </div>
      </div>

      {/* TAB 1: System Comparison Cards */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {systems.map((modeKey) => {
              const info = SYSTEM_DESCRIPTIONS[modeKey];
              const result = benchmarkResults[modeKey];
              const isProposed = modeKey.includes('AVICA');
              const isLearned = modeKey === 'AVICA_LEARNED';

              return (
                <div
                  key={modeKey}
                  className={`rounded-2xl p-5 border flex flex-col justify-between transition-all ${
                    isLearned
                      ? 'glass-surface-elevated border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.08)]'
                      : isProposed
                      ? 'glass-surface-elevated border-cyan-500/25 shadow-[0_0_15px_rgba(6,182,212,0.05)]'
                      : 'glass-surface border-white/[0.06]'
                  }`}
                >
                  <div>
                    {/* Header Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-medium">
                        {modeKey.replace('_', ' ')}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-medium"
                        style={{
                          backgroundColor: `${info.color}15`,
                          color: info.color,
                          borderColor: `${info.color}30`,
                        }}
                      >
                        {modeKey === 'PASSIVE_VISION' && 'Baseline 1'}
                        {modeKey === 'ATTENTION_VISION' && 'Baseline 2'}
                        {modeKey === 'AVICA_GREEDY' && 'System 3'}
                        {modeKey === 'AVICA_LEARNED' && 'System 4 (RL)'}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-white mb-1">
                      {info.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-light mb-4 leading-relaxed">
                      {info.summary}
                    </p>

                    {/* Key Empirical Metrics */}
                    <div className="space-y-2.5 pt-3 border-t border-white/[0.04] text-xs">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Tracking Accuracy</span>
                          <span className="font-mono text-slate-200 font-semibold">
                            {result ? `${result.metrics.trackingAccuracy}%` : '--'}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${result?.metrics.trackingAccuracy || 0}%`,
                              backgroundColor: info.color,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Detection Accuracy</span>
                        <span className="font-mono text-slate-300">
                          {result ? `${result.metrics.detectionAccuracy}%` : '--'}
                        </span>
                      </div>

                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Compute Cost</span>
                        <span
                          className={`font-mono font-semibold ${
                            modeKey === 'PASSIVE_VISION'
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {result ? `${(result.metrics.computationCost || result.metrics.totalComputationCost).toFixed(0)} pts` : '--'}
                        </span>
                      </div>

                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Recovery Rate</span>
                        <span className="font-mono text-slate-300">
                          {result
                            ? `${result.metrics.occlusionRecoverySuccesses} / ${result.metrics.occlusionRecoveryAttempts} (${result.metrics.recoveryAccuracy}%)`
                            : '--'}
                        </span>
                      </div>

                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Avg Latency / FPS</span>
                        <span className="font-mono text-slate-300">
                          {result ? `${result.metrics.latency}ms / ${result.metrics.fps}fps` : '--'}
                        </span>
                      </div>

                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Prediction Error</span>
                        <span className="font-mono text-slate-300">
                          {result ? result.metrics.predictionError.toFixed(3) : '--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/[0.04]">
                    <button
                      onClick={() => runControlledTrial(modeKey)}
                      disabled={isRunningTrial}
                      className="w-full py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40"
                      style={{
                        backgroundColor: `${info.color}10`,
                        color: info.color,
                        borderColor: `${info.color}30`,
                      }}
                    >
                      Run 100-Frame Trial
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Charts Preview */}
          <BenchmarkCharts results={benchmarkResults} />
          <BenchmarkTables results={benchmarkResults} />
        </div>
      )}

      {/* TAB 0: AWS Graviton / Arm & COOL Benchmarking */}
      {activeTab === 'GRAVITON_BENCHMARK' && (
        <GravitonBenchmarkView />
      )}

      {/* TAB 1: AViCA Learned Observation Policy */}
      {activeTab === 'LEARNED_POLICY' && (
        <LearnedPolicyView seed={selectedSeed} />
      )}

      {/* TAB 2: AViCA Component Ablation Framework */}
      {activeTab === 'ABLATIONS' && (
        <AblationStudyView seed={selectedSeed} frameCount={trialFrameCount} />
      )}

      {/* TAB 2: Comparative Visual Charts */}
      {activeTab === 'CHARTS' && (
        <BenchmarkCharts results={benchmarkResults} />
      )}

      {/* TAB 3: 12-Metric Empirical Matrix */}
      {activeTab === 'TABLES' && (
        <BenchmarkTables results={benchmarkResults} />
      )}
    </div>
  );
};
