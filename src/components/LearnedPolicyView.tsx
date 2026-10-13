import React, { useState } from 'react';
import {
  Brain,
  Play,
  RotateCw,
  Sliders,
  TrendingUp,
  Scale,
  Sparkles,
  Layers,
  Activity,
  CheckCircle2,
  RefreshCcw,
  Download,
} from 'lucide-react';
import { PolicyTrainer } from '../active_perception/policy_trainer';
import { sharedQLearningPolicy } from '../active_perception/q_learning_policy';
import { PolicyTrainingCurvePoint } from '../types/learned_policy';
import { LearnedPolicyTrainingCurves } from './LearnedPolicyTrainingCurves';
import { LearnedPolicyInspector } from './LearnedPolicyInspector';
import { PolicyComparisonCard } from './PolicyComparisonCard';

interface LearnedPolicyViewProps {
  seed: number;
}

export const LearnedPolicyView: React.FC<LearnedPolicyViewProps> = ({ seed = 101 }) => {
  const [subTab, setSubTab] = useState<'TRAINING' | 'INSPECTOR' | 'COMPARISON'>('TRAINING');

  // Training state
  const [isTraining, setIsTraining] = useState(false);
  const [trainProgress, setTrainProgress] = useState(0);
  const [episodesCount, setEpisodesCount] = useState<number>(30);
  const [learningRate, setLearningRate] = useState<number>(0.15);
  const [discountFactor, setDiscountFactor] = useState<number>(0.90);
  const [trainingCurves, setTrainingCurves] = useState<PolicyTrainingCurvePoint[]>(() =>
    sharedQLearningPolicy.getTrainingCurves()
  );

  const runTraining = async () => {
    setIsTraining(true);
    setTrainProgress(0);

    try {
      const trainer = new PolicyTrainer(sharedQLearningPolicy);
      const points = await trainer.train(
        {
          episodes: episodesCount,
          stepsPerEpisode: 35,
          learningRate,
          discountFactor,
          initialEpsilon: 0.35,
          minEpsilon: 0.05,
          seed,
        },
        (p, point) => {
          setTrainProgress(p);
          setTrainingCurves(sharedQLearningPolicy.getTrainingCurves());
        }
      );
      setTrainingCurves(points);
    } catch (err) {
      console.error('Training error:', err);
    } finally {
      setIsTraining(false);
    }
  };

  const resetPolicy = () => {
    sharedQLearningPolicy.initializeDefaultPriors();
    sharedQLearningPolicy.clearTrainingCurves();
    setTrainingCurves([]);
  };

  const exportPolicyWeights = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      qTable: sharedQLearningPolicy.exportQTable(),
      trainingCurves: sharedQLearningPolicy.getTrainingCurves(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avica_qlearning_policy_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Brain className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold text-white">
              Experimental Learned Observation Policy
            </h2>
            <span className="text-slate-600">·</span>
            <span className="text-[11px] font-mono text-violet-300">
              Q-Learning Bellman Policy
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Reinforcement-learned sensory control over 7-dimensional epistemic states and 8 actions.
            Optimized via Bellman return: task success + information gain - computation cost - latency - unnecessary observations.
          </p>
        </div>

        {/* Sub-tab Pills */}
        <div className="flex items-center rounded-xl p-1 bg-white/[0.04] border border-white/[0.06] text-xs">
          <button
            onClick={() => setSubTab('TRAINING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              subTab === 'TRAINING'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Simulator Training & Curves</span>
          </button>
          <button
            onClick={() => setSubTab('INSPECTOR')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              subTab === 'INSPECTOR'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>7-State Q-Value Explorer</span>
          </button>
          <button
            onClick={() => setSubTab('COMPARISON')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              subTab === 'COMPARISON'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Learned vs. Greedy Evaluation</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Simulator Training */}
      {subTab === 'TRAINING' && (
        <div className="space-y-5">
          {/* Training Control Bar */}
          <div className="p-4 rounded-xl border border-white/[0.06] bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Episodes</label>
                <select
                  value={episodesCount}
                  onChange={(e) => setEpisodesCount(parseInt(e.target.value, 10))}
                  disabled={isTraining}
                  className="bg-slate-800 text-white border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-violet-500"
                >
                  <option value={15}>15 Episodes (Fast check)</option>
                  <option value={30}>30 Episodes (Standard)</option>
                  <option value={60}>60 Episodes (Deep convergence)</option>
                  <option value={100}>100 Episodes (Comprehensive)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Learning Rate (α)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="0.5"
                  value={learningRate}
                  onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                  disabled={isTraining}
                  className="w-20 bg-slate-800 text-white border border-white/[0.08] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Discount (γ)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="0.99"
                  value={discountFactor}
                  onChange={(e) => setDiscountFactor(parseFloat(e.target.value))}
                  disabled={isTraining}
                  className="w-20 bg-slate-800 text-white border border-white/[0.08] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportPolicyWeights}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] transition-all"
                title="Download serialized Q-table weights and training history as JSON"
              >
                <Download className="h-3 w-3 text-violet-400" />
                <span>Export Policy JSON</span>
              </button>

              <button
                onClick={resetPolicy}
                disabled={isTraining}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-slate-400 hover:text-slate-200 transition-all"
                title="Reset Q-table to heuristic priors"
              >
                <RefreshCcw className="h-3 w-3" />
                <span>Reset Priors</span>
              </button>

              <button
                onClick={runTraining}
                disabled={isTraining}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isTraining
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 cursor-not-allowed'
                    : 'bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-lg shadow-violet-500/20'
                }`}
              >
                {isTraining ? (
                  <>
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Training ({trainProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    <span>Train on Controlled Simulator</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Progress Bar during active training */}
          {isTraining && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-violet-300 font-medium">
                <span>Executing simulator episodes with dynamic occluders & distractors...</span>
                <span>{trainProgress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-violet-400 transition-all duration-300"
                  style={{ width: `${trainProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Training Curves Dashboard */}
          <LearnedPolicyTrainingCurves curves={trainingCurves} />
        </div>
      )}

      {/* Tab 2: 7-State Q-Value Explorer */}
      {subTab === 'INSPECTOR' && <LearnedPolicyInspector />}

      {/* Tab 3: Head-to-Head Comparison against Greedy Information Gain */}
      {subTab === 'COMPARISON' && (
        <PolicyComparisonCard seed={seed} frameCount={100} />
      )}
    </div>
  );
};
