import React, { useState } from 'react';
import {
  RotateCw,
  Play,
  Sliders,
  Scissors,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingDown,
  Download,
} from 'lucide-react';
import { AblationCondition } from '../types/avica';
import {
  AvicaAblationEngine,
  AblationRunResult,
  ABLATION_CONDITIONS_META,
} from '../evaluation/ablation_engine';
import { AblationCharts } from './AblationCharts';
import { AblationTables } from './AblationTables';

interface AblationStudyViewProps {
  seed: number;
  frameCount?: number;
}

export const AblationStudyView: React.FC<AblationStudyViewProps> = ({
  seed = 101,
  frameCount = 100,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [activeCondition, setActiveCondition] = useState<AblationCondition | null>(null);
  const [trialProgress, setTrialProgress] = useState(0);
  const [selectedSubTab, setSelectedSubTab] = useState<'CARDS' | 'CHARTS' | 'TABLES'>('CARDS');

  const [ablationResults, setAblationResults] = useState<
    Record<AblationCondition, AblationRunResult | null>
  >({
    FULL_AVICA: null,
    AVICA_NO_MEMORY: null,
    AVICA_NO_UNCERTAINTY: null,
    AVICA_NO_ACTIVE_PERCEPTION: null,
    AVICA_NO_PREDICTION: null,
    AVICA_NO_SPATIAL_MODEL: null,
    AVICA_NO_LEARNED_POLICY: null,
  });

  const conditions: AblationCondition[] = [
    'FULL_AVICA',
    'AVICA_NO_MEMORY',
    'AVICA_NO_UNCERTAINTY',
    'AVICA_NO_ACTIVE_PERCEPTION',
    'AVICA_NO_PREDICTION',
    'AVICA_NO_SPATIAL_MODEL',
    'AVICA_NO_LEARNED_POLICY',
  ];

  const runSingleAblation = async (condition: AblationCondition) => {
    setIsRunning(true);
    setActiveCondition(condition);
    setTrialProgress(0);
    try {
      const engine = new AvicaAblationEngine();
      const res = await engine.runAblationTrial(condition, frameCount, seed, (p) => {
        setTrialProgress(p);
      });
      setAblationResults((prev) => ({
        ...prev,
        [condition]: res,
      }));
    } catch (err) {
      console.error('Ablation trial failure:', err);
    } finally {
      setIsRunning(false);
      setActiveCondition(null);
      setTrialProgress(0);
    }
  };

  const runAllAblations = async () => {
    setIsRunning(true);
    setTrialProgress(0);
    try {
      const engine = new AvicaAblationEngine();
      for (let i = 0; i < conditions.length; i++) {
        const cond = conditions[i];
        setActiveCondition(cond);
        const res = await engine.runAblationTrial(cond, frameCount, seed, (p) => {
          setTrialProgress(Math.round((i * (100 / conditions.length)) + (p / conditions.length)));
        });
        setAblationResults((prev) => ({
          ...prev,
          [cond]: res,
        }));
      }
    } catch (err) {
      console.error('Ablation suite error:', err);
    } finally {
      setIsRunning(false);
      setActiveCondition(null);
      setTrialProgress(0);
    }
  };

  const exportAblationMatrix = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      seed,
      frameCount,
      conditions: ABLATION_CONDITIONS_META,
      results: ablationResults,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avica_ablation_matrix_seed_${seed}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fullAvica = ablationResults.FULL_AVICA;
  const executedCount = conditions.filter((c) => ablationResults[c] !== null).length;

  return (
    <div className="space-y-6">
      {/* Ablation Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.04]">
        <div>
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-pink-400" />
            <h3 className="text-base font-semibold text-white tracking-tight">
              AViCA Component Ablation Framework
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-pink-500/10 text-pink-300 border border-pink-500/20">
              7 Rigorous Conditions
            </span>
          </div>
          <p className="text-xs text-slate-400 font-light mt-0.5">
            Systematically isolate each cognitive subsystem under identical adversarial seeds. Every metric calculated strictly from real execution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportAblationMatrix}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 transition-all"
            title="Export 7-condition ablation empirical matrix as JSON"
          >
            <Download className="h-3.5 w-3.5 text-pink-400" />
            <span>Export Matrix JSON</span>
          </button>

          <button
            onClick={runAllAblations}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-pink-500/25 to-purple-500/25 text-white border border-pink-500/40 hover:border-pink-400/60 disabled:opacity-40 transition-all shadow-lg shadow-pink-500/10"
          >
            {isRunning ? (
              <RotateCw className="h-4 w-4 animate-spin text-pink-400" />
            ) : (
              <Play className="h-4 w-4 text-pink-400" />
            )}
            <span>
              {isRunning
                ? `Ablating ${ABLATION_CONDITIONS_META[activeCondition!]?.name} (${trialProgress}%)`
                : 'Execute All 7 Ablation Trials'}
            </span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs for Ablation View */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedSubTab('CARDS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedSubTab === 'CARDS'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ablation Condition Cards
          </button>
          <button
            onClick={() => setSelectedSubTab('CHARTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedSubTab === 'CHARTS'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Publication-Quality Charts
          </button>
          <button
            onClick={() => setSelectedSubTab('TABLES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedSubTab === 'TABLES'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ablation Matrix Tables
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-400">
          Status: {executedCount} / 7 Executed &bull; Unexecuted display <span className="text-slate-300 font-bold">NOT RUN</span>
        </div>
      </div>

      {/* TAB 1: Ablation Condition Cards */}
      {selectedSubTab === 'CARDS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {conditions.map((cond) => {
              const meta = ABLATION_CONDITIONS_META[cond];
              const res = ablationResults[cond];
              const isFull = cond === 'FULL_AVICA';
              const isExecutingThis = activeCondition === cond;

              return (
                <div
                  key={cond}
                  className={`rounded-2xl p-4 border flex flex-col justify-between transition-all ${
                    isFull
                      ? 'glass-surface-elevated border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]'
                      : 'glass-surface border-white/[0.06]'
                  }`}
                >
                  <div>
                    {/* Header Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-medium">
                        {isFull ? 'REFERENCE BASELINE' : 'ABLATION'}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-medium"
                        style={{
                          backgroundColor: `${meta.color}15`,
                          color: meta.color,
                        }}
                      >
                        {isFull ? 'FULL' : 'ABLATED'}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-white mb-1">
                      {meta.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-light mb-3 leading-relaxed">
                      {meta.description}
                    </p>

                    <div className="text-[10px] text-slate-500 italic mb-4">
                      {meta.hypothesisTested}
                    </div>

                    {/* Metric Rows */}
                    <div className="space-y-2 pt-3 border-t border-white/[0.04] text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Tracking Acc:</span>
                        {res ? (
                          <span className="text-white font-semibold">{res.metrics.trackingAccuracy}%</span>
                        ) : (
                          <span className="text-slate-500">NOT RUN</span>
                        )}
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Compute Cost:</span>
                        {res ? (
                          <span
                            className={
                              cond === 'AVICA_NO_ACTIVE_PERCEPTION'
                                ? 'text-rose-400 font-bold'
                                : 'text-emerald-400 font-semibold'
                            }
                          >
                            {(res.metrics.computationCost || res.metrics.totalComputationCost).toFixed(0)} pts
                          </span>
                        ) : (
                          <span className="text-slate-500">NOT RUN</span>
                        )}
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Occlusion Recovery:</span>
                        {res ? (
                          <span
                            className={
                              res.metrics.recoveryAccuracy < 60
                                ? 'text-rose-400 font-semibold'
                                : 'text-slate-200'
                            }
                          >
                            {res.metrics.recoveryAccuracy}%
                          </span>
                        ) : (
                          <span className="text-slate-500">NOT RUN</span>
                        )}
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Pred Error:</span>
                        {res ? (
                          <span className="text-slate-300">{res.metrics.predictionError.toFixed(3)}</span>
                        ) : (
                          <span className="text-slate-500">NOT RUN</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.04]">
                    <button
                      onClick={() => runSingleAblation(cond)}
                      disabled={isRunning}
                      className="w-full py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40"
                      style={{
                        backgroundColor: `${meta.color}10`,
                        color: meta.color,
                        borderColor: `${meta.color}30`,
                      }}
                    >
                      {isExecutingThis ? `Running (${trialProgress}%)` : `Run Trial`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <AblationCharts results={ablationResults} />
          <AblationTables results={ablationResults} />
        </div>
      )}

      {/* TAB 2: Publication-Quality Charts */}
      {selectedSubTab === 'CHARTS' && (
        <AblationCharts results={ablationResults} />
      )}

      {/* TAB 3: Ablation Tables */}
      {selectedSubTab === 'TABLES' && (
        <AblationTables results={ablationResults} />
      )}
    </div>
  );
};
