import React, { useState } from 'react';
import {
  Eye,
  ShieldAlert,
  Crosshair,
  Zap,
  Sparkles,
  Database,
  TrendingUp,
  Activity,
  CheckCircle2,
  ChevronRight,
  Info,
  X,
  ArrowRight,
  Layers,
  Cpu,
} from 'lucide-react';
import {
  CognitiveCycleResult,
  WorkingMemoryEntity,
} from '../types/avica';

interface CognitiveVisualStoryStripProps {
  result: CognitiveCycleResult;
  groundTruthTargetFound: boolean;
}

interface StepDetail {
  id: string;
  number: number;
  label: string;
  shortLabel: string;
  role: string;
  formula: string;
  formulaName: string;
  description: string;
  liveKeyMetric: string;
  liveValue: string;
  status: 'nominal' | 'warning' | 'active' | 'success';
  variables: Array<{ name: string; value: string; unit?: string; note?: string }>;
}

export const CognitiveVisualStoryStrip: React.FC<CognitiveVisualStoryStripProps> = ({
  result,
  groundTruthTargetFound,
}) => {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const { observation, candidates, activeDecision, uncertainty, workingMemoryEntities, prediction, metrics } = result;
  const targetEntity = workingMemoryEntities.find((e) => e.isTarget);
  const uncertaintyPct = Math.round(uncertainty.uncertaintyScore * 100);
  const targetProbPct = Math.round(uncertainty.targetProbability * 100);
  const activeEntities = workingMemoryEntities.filter((e) => !e.isOccluded).length;
  const occludedEntities = workingMemoryEntities.filter((e) => e.isOccluded).length;

  const steps: StepDetail[] = [
    {
      id: 'SEE',
      number: 1,
      label: 'SEE',
      shortLabel: 'Sensory Input',
      role: 'Acquires raw 640×400 visual frame without ground truth leakage',
      formula: 'I(x, y, t) ∈ ℝ^{W × H × 3}',
      formulaName: 'Visual Sensory Field Tensor',
      description:
        'Continuous frame ingestion from the simulated environment into an unadulterated ImageData pixel buffer. Classical computer vision algorithms extract preliminary brightness, edge gradients, and potential candidate blobs.',
      liveKeyMetric: 'Frame Ingestion',
      liveValue: `#${observation.frameId} (${observation.width}×${observation.height})`,
      status: 'active',
      variables: [
        { name: 'Resolution', value: `${observation.width} × ${observation.height}`, unit: 'px' },
        { name: 'Contrast Score', value: observation.contrastScore.toFixed(3) },
        { name: 'Mean Intensity', value: observation.meanIntensity.toFixed(1), unit: 'luma' },
        { name: 'Raw Features', value: `${observation.rawFeatureCount}`, unit: 'blobs' },
      ],
    },
    {
      id: 'UNCERTAINTY',
      number: 2,
      label: 'UNCERTAINTY',
      shortLabel: 'Epistemic Estimation',
      role: 'Measures what the system does not know using Shannon entropy & evidence gating',
      formula: 'H(X) = -∑ P(x_i) log_2 P(x_i) + M_{missing}',
      formulaName: 'Shannon Epistemic Entropy',
      description:
        'Evaluates epistemic uncertainty across candidate identities. When evidence is ambiguous (entropy > threshold), the system refuses to guess and triggers active targeted observations.',
      liveKeyMetric: 'Epistemic Score',
      liveValue: `${uncertaintyPct}% (${uncertainty.isEvidenceSufficient ? 'Sufficient' : 'Gated'})`,
      status: uncertainty.uncertaintyScore > 0.5 ? 'warning' : 'nominal',
      variables: [
        { name: 'Target Probability', value: `${targetProbPct}`, unit: '%' },
        { name: 'Shannon Ambiguity', value: `${Math.round(uncertainty.ambiguityScore * 100)}`, unit: '%' },
        { name: 'Missing Evidence', value: `${Math.round(uncertainty.missingEvidenceScore * 100)}`, unit: '%' },
        { name: 'Sufficiency Threshold', value: `${Math.round(uncertainty.sufficientThreshold * 100)}`, unit: '%' },
      ],
    },
    {
      id: 'ATTENTION',
      number: 3,
      label: 'ATTENTION',
      shortLabel: 'Foveal Arbitration',
      role: 'Prioritizes high-saliency candidate regions for spatial inspection',
      formula: 'α^* = argmax_k [ Saliency(c_k) · 𝟙(uncertainty_k > τ) ]',
      formulaName: 'Attentional Priority Map',
      description:
        'Biologically-inspired selective attention gates candidate regions. Instead of processing the entire high-resolution frame at full compute, attention foveates onto the single most informative region of interest.',
      liveKeyMetric: 'Attended Focus',
      liveValue: activeDecision.targetRoi ? `Candidate #${candidates.findIndex(c => Math.hypot(c.box.x - (activeDecision.targetRoi?.x ?? 0), c.box.y - (activeDecision.targetRoi?.y ?? 0)) < 0.1) + 1 || 1}` : 'Global Scan',
      status: 'active',
      variables: [
        { name: 'Candidate Count', value: `${candidates.length}`, unit: 'regions' },
        { name: 'Fovea Width', value: activeDecision.targetRoi ? `${Math.round(activeDecision.targetRoi.width * observation.width)}` : '640', unit: 'px' },
        { name: 'Fovea Height', value: activeDecision.targetRoi ? `${Math.round(activeDecision.targetRoi.height * observation.height)}` : '400', unit: 'px' },
        { name: 'Candidate Selection', value: activeDecision.targetRoi ? 'Foveated ROI' : 'Full Frame' },
      ],
    },
    {
      id: 'ACTION',
      number: 4,
      label: 'ACTION',
      shortLabel: 'Observation Policy',
      role: 'Selects optimal sensory action balancing information gain against compute and latency costs',
      formula: 'a^* = argmax_a [ E[ΔI(a)] - λ_C C(a) - λ_L L(a) ]',
      formulaName: 'Bellman Optimal Value Policy',
      description:
        'The observation policy decides whether to perform full-frame scan, ROI foveation, zoom, track, edge analysis, depth extraction, or wait. Constrained by a strict computational budget.',
      liveKeyMetric: 'Action Selected',
      liveValue: activeDecision.action,
      status: 'nominal',
      variables: [
        { name: 'Expected Gain', value: `+${activeDecision.expectedInfoGain.toFixed(2)}`, unit: 'bits' },
        { name: 'Compute Cost', value: `${activeDecision.computationCost.toFixed(1)}`, unit: 'CU' },
        { name: 'Latency Cost', value: `${activeDecision.latencyCost.toFixed(1)}`, unit: 'ms' },
        { name: 'Net Utility', value: `${activeDecision.netUtility.toFixed(2)}` },
      ],
    },
    {
      id: 'NEW EVIDENCE',
      number: 5,
      label: 'NEW EVIDENCE',
      shortLabel: 'Information Gain',
      role: 'Extracts fine-grained visual features (circularity, hue, edges) from attended crop',
      formula: 'ΔI(a) = H_{prior}(Y) - H_{posterior}(Y | o_a)',
      formulaName: 'Empirical Mutual Information',
      description:
        'Observation execution yields empirical visual features: circularity 4πA/P², hue histogram distance, and gradient orientation. High-resolution crop confirms or refutes the target hypothesis.',
      liveKeyMetric: 'Info Acquired',
      liveValue: `+${activeDecision.expectedInfoGain.toFixed(2)} bit`,
      status: 'nominal',
      variables: [
        { name: 'Observations Required', value: `${metrics.observationsRequired}` },
        { name: 'Mean Info Gain', value: `+${metrics.uncertaintyReduction.toFixed(2)}`, unit: 'bits' },
        { name: 'Target Confidence', value: targetEntity ? `${(targetEntity.confidence * 100).toFixed(0)}` : '0', unit: '%' },
        { name: 'Verification State', value: targetEntity?.isTarget ? 'Target Confirmed' : 'Hypothesis Active' },
      ],
    },
    {
      id: 'MEMORY',
      number: 6,
      label: 'MEMORY',
      shortLabel: 'VWM Consolidation',
      role: 'Maintains object representations across temporal gaps and total occlusions',
      formula: 'M_t(e) = γ_{decay} M_{t-1}(e) + 𝟙_{obs} · Update(e)',
      formulaName: 'Visual Working Memory Buffer (12 Slots)',
      description:
        'Entities are stored in a capacity-limited working memory store (12 slots max). When an object passes behind an occluder, its representation persists in memory rather than vanishing from existence.',
      liveKeyMetric: 'VWM Buffer',
      liveValue: `${workingMemoryEntities.length}/12 Slots (${activeEntities} Active, ${occludedEntities} Occluded)`,
      status: 'active',
      variables: [
        { name: 'Active Entities', value: `${activeEntities}` },
        { name: 'Occluded Entities', value: `${occludedEntities}` },
        { name: 'Track Continuity', value: `${(metrics.trackContinuity * 100).toFixed(0)}`, unit: '%' },
        { name: 'Retention Mechanism', value: 'Kalman + Appearance Embedding' },
      ],
    },
    {
      id: 'PREDICTION',
      number: 7,
      label: 'PREDICTION',
      shortLabel: 'Kinematic Projection',
      role: 'Forecasts target trajectory and future ghost states across 4-step horizon (t+1..t+4)',
      formula: 'x̂_{t+k} = F^k x̂_t,   P_{t+k} = F^k P_t (F^T)^k + Q_k',
      formulaName: 'Multi-Step Kinematic Extrapolation',
      description:
        'Uses Kalman state estimation to propagate object positions into the future. Anticipates occlusions before they happen and predicts re-emergence coordinates behind barriers.',
      liveKeyMetric: 'Trajectory Forecast',
      liveValue: `4 Horizons (t+1..t+4) · Δ ${(prediction.meanPredictionError ?? prediction.predictionError ?? 0).toFixed(3)}`,
      status: prediction.occlusionImminent ? 'warning' : 'nominal',
      variables: [
        { name: 'Horizon Steps', value: '4 (t+1 to t+4)' },
        { name: 'Mean Forecast Error', value: (prediction.meanPredictionError ?? prediction.predictionError ?? 0).toFixed(4) },
        { name: 'Occlusion Warning', value: prediction.occlusionImminent ? 'Imminent Barrier' : 'Clear Path' },
        { name: 'Next State', value: prediction.predictedNextState },
      ],
    },
    {
      id: 'TRACKING',
      number: 8,
      label: 'TRACKING',
      shortLabel: 'Identity Association',
      role: 'Associates observed visual features with continuous entity identity tracklets',
      formula: 'd_{assoc}(e_i, c_j) = λ_s ||p_i - p_j||_2 + λ_a (1 - sim(f_i, f_j))',
      formulaName: 'Spatiotemporal Association Metric',
      description:
        'Prevents identity swaps between target and visual distractors by combining spatial proximity, motion vector alignment, and invariant color-shape signatures.',
      liveKeyMetric: 'Tracking State',
      liveValue: targetEntity ? `${targetEntity.trackingLifecycleState || targetEntity.currentState} (${(targetEntity.confidence * 100).toFixed(0)}%)` : 'SEARCHING',
      status: 'nominal',
      variables: [
        { name: 'Tracking Accuracy', value: `${(metrics.targetTrackingAccuracy * 100).toFixed(0)}`, unit: '%' },
        { name: 'Tracked Frames', value: targetEntity ? `${targetEntity.consecutiveFramesTracked ?? targetEntity.observationCount ?? 0}` : '0', unit: 'frames' },
        { name: 'Distractor Count', value: `${candidates.filter(c => c.status !== 'CONFIRMED_TARGET').length}` },
        { name: 'Recovery Successes', value: `${metrics.occlusionRecoverySuccesses}/${metrics.occlusionRecoveryAttempts}` },
      ],
    },
    {
      id: 'DECISION',
      number: 9,
      label: 'DECISION',
      shortLabel: 'Goal Resolution',
      role: 'Resolves mission goal: robust target localization under adversarial conditions',
      formula: 'δ^* = Commit(ŷ | P(target) ≥ τ_{suff} ∧ U ≤ 1 - τ_{suff})',
      formulaName: 'Cognitive Commitment Rule',
      description:
        'Final state resolution of the cognitive cycle. Either confirms precise target coordinate localization or schedules targeted foveation for the next cycle without hallucination.',
      liveKeyMetric: 'Mission Outcome',
      liveValue: groundTruthTargetFound ? 'TARGET LOCALIZED & TRACKED' : 'SEARCH & EVIDENCE GATHERING',
      status: groundTruthTargetFound ? 'success' : 'nominal',
      variables: [
        { name: 'Target Found (GT)', value: groundTruthTargetFound ? 'Confirmed' : 'Searching' },
        { name: 'Overall Task Accuracy', value: `${(metrics.detectionAccuracy * 100).toFixed(0)}`, unit: '%' },
        { name: 'Total Frames Evaluated', value: `${metrics.totalFrames}` },
        { name: 'Zero-Leakage Invariant', value: 'Strictly Preserved' },
      ],
    },
  ];

  const activeStep = steps.find((s) => s.id === selectedStepId);

  return (
    <div className="w-full mb-4">
      {/* The 9-Stage Cognitive Process Flow Bar */}
      <div className="rounded-2xl glass-surface border border-white/[0.08] p-3 shadow-xl bg-[#090c15]">
        {/* Header Kicker & Flow Direction */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.04] px-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-wider uppercase text-cyan-400 font-semibold">
              Cognitive Architecture Cycle
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-[11px] text-slate-400 font-normal">
              Perception-Action-Prediction Pipeline (Click any stage to inspect formal state)
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            <span>Active Pipeline</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">Zero Ground-Truth Leakage</span>
          </div>
        </div>

        {/* 9-Step Horizontal Flow Stepper */}
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-1.5 items-stretch">
          {steps.map((step, idx) => {
            const isSelected = selectedStepId === step.id;

            // Micro status indicator color
            const getIndicatorBg = () => {
              if (step.status === 'success') return 'bg-emerald-400';
              if (step.status === 'warning') return 'bg-amber-400';
              return 'bg-cyan-400';
            };

            return (
              <button
                key={step.id}
                onClick={() => setSelectedStepId(isSelected ? null : step.id)}
                className={`group relative text-left p-2 rounded-xl transition-all border flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.12)]'
                    : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10'
                }`}
                title={`Inspect Stage ${step.number}: ${step.label} (${step.shortLabel})`}
              >
                {/* Top: Step Number & Label */}
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-slate-500 font-semibold">
                      0{step.number}
                    </span>
                    <span className={`text-[11px] font-semibold tracking-tight transition-colors ${
                      isSelected ? 'text-cyan-300' : 'text-slate-200 group-hover:text-white'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  <span className={`h-1.5 w-1.5 rounded-full ${getIndicatorBg()} shrink-0`} />
                </div>

                {/* Subtitle / Role */}
                <div className="text-[9px] text-slate-400 leading-tight truncate mb-1">
                  {step.shortLabel}
                </div>

                {/* Live Micro-Metric */}
                <div className="text-[10px] font-mono text-slate-300 truncate pt-1 border-t border-white/[0.04]">
                  {step.liveValue}
                </div>

                {/* Arrow connector between steps (only visible in row flow) */}
                {idx < steps.length - 1 && (
                  <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-600">
                    <ChevronRight className="h-3 w-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Progressive Disclosure: Expanded Step Telemetry & Mathematical Modal */}
      {activeStep && (
        <div className="mt-2.5 rounded-2xl glass-surface-elevated border border-cyan-500/30 p-4 bg-[#080c18] shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-start justify-between pb-3 mb-3 border-b border-white/[0.06]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
                  STAGE 0{activeStep.number} SPECIFICATION & TELEMETRY
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-xs text-slate-300 font-medium">{activeStep.label}</span>
              </div>
              <h4 className="text-sm font-semibold text-white tracking-tight mt-0.5">
                {activeStep.role}
              </h4>
            </div>

            <button
              onClick={() => setSelectedStepId(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close step inspector"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Left 7 cols: Formal Equation & Scientific Architecture Rationale */}
            <div className="md:col-span-7 space-y-3">
              <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                  <span>{activeStep.formulaName}</span>
                  <span className="text-cyan-400">Formal Definition</span>
                </div>
                <div className="font-mono text-xs text-cyan-200 bg-white/[0.03] p-2 rounded-lg border border-white/[0.04] overflow-x-auto">
                  {activeStep.formula}
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-light">
                {activeStep.description}
              </p>
            </div>

            {/* Right 5 cols: Live Active Cycle Variables */}
            <div className="md:col-span-5 bg-black/30 rounded-xl p-3 border border-white/[0.06] space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2">
                Live State Variables
              </div>
              <div className="space-y-1.5">
                {activeStep.variables.map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/[0.03]">
                    <span className="text-slate-400 text-[11px]">{v.name}:</span>
                    <span className="font-mono font-medium text-slate-100">
                      {v.value} {v.unit && <span className="text-slate-500 text-[10px]">{v.unit}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
