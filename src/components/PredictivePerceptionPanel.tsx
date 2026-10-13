import React, { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Compass,
  Ghost,
  Target,
  BarChart2,
  Clock,
} from 'lucide-react';
import { PredictionState } from '../types/avica';

interface PredictivePerceptionPanelProps {
  prediction: PredictionState;
}

export const PredictivePerceptionPanel: React.FC<PredictivePerceptionPanelProps> = ({
  prediction,
}) => {
  const [selectedHorizonTab, setSelectedHorizonTab] = useState<number>(0); // 0 = all, 1 = t+1, 2 = t+2, etc.

  const horizonSteps = [1, 2, 3, 4];

  return (
    <div className="flex flex-col rounded-lg border border-slate-800 bg-[#070a12] p-3 text-xs shadow-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-2 mb-2 gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-amber-400" />
          <span className="font-mono font-semibold text-slate-200">
            PREDICTIVE PERCEPTION &amp; MULTI-STEP HORIZON
          </span>
          <span className="rounded bg-amber-950/70 border border-amber-800/50 px-1.5 py-0.5 text-[9px] font-mono text-amber-300">
            Horizon: t+1 &rarr; t+4
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-slate-500">Mean Pred Error: </span>
          <span className="font-bold text-amber-300">
            {(prediction.meanPredictionError || prediction.predictionError).toFixed(4)}
          </span>
        </div>
      </div>

      {/* Multi-Step Horizon Cards (t+1, t+2, t+3, t+4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 font-mono">
        {horizonSteps.map((step) => {
          const stepData = prediction.steps?.find((s) => s.stepOffset === step);
          const ghostData = prediction.predictedGhosts?.find((g) => g.step === step);
          const horizonMetric = prediction.horizonMetrics?.[step];

          const pos = stepData?.predictedPos ?? ghostData?.position;
          const confidence = stepData?.confidence ?? ghostData?.confidence ?? Math.max(0.1, 1 - step * 0.12);
          const measuredError = horizonMetric?.meanError ?? 0;
          const sampleCount = horizonMetric?.sampleCount ?? 0;

          return (
            <div
              key={step}
              onClick={() => setSelectedHorizonTab(step === selectedHorizonTab ? 0 : step)}
              className={`cursor-pointer rounded border p-2 transition-all ${
                selectedHorizonTab === step
                  ? 'border-amber-500 bg-amber-950/30'
                  : 'border-slate-800/90 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="font-bold text-amber-400 text-[11px]">t+{step}</span>
                <span className="flex items-center gap-0.5 text-[10px] text-slate-300">
                  <Ghost className="h-3 w-3 text-amber-400/80" />
                  Ghost
                </span>
              </div>

              {/* Projected position */}
              <div className="text-[10px] text-slate-300 mb-1">
                <span className="text-slate-500 block text-[9px]">PROJECTED POS:</span>
                <span className="font-semibold text-amber-200">
                  {pos ? `[${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}]` : 'Computing...'}
                </span>
              </div>

              {/* Confidence progress */}
              <div className="mb-1">
                <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                  <span>Confidence</span>
                  <span className="font-bold text-slate-200">{(confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full rounded bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all"
                    style={{ width: `${Math.min(100, confidence * 100)}%` }}
                  />
                </div>
              </div>

              {/* Measured error */}
              <div className="text-[9px] text-slate-400 flex justify-between items-center pt-1 border-t border-slate-800/60">
                <span>Obs Error:</span>
                <span className="font-bold text-amber-300 font-mono">
                  {sampleCount > 0 ? measuredError.toFixed(4) : '&mdash;'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trajectory & Empirical Discrepancy Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2 font-mono text-[11px]">
        {/* Forward Projected State */}
        <div className="rounded border border-slate-800 bg-slate-900/60 p-2">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span>PREDICTED TARGET STATE</span>
            <span className="text-amber-400 font-semibold">{prediction.predictedNextState}</span>
          </div>
          <div className="text-[10px] text-slate-300">
            Projected Pos (t+1):{' '}
            <strong className="text-amber-300">
              {prediction.predictedTargetPos
                ? `[${prediction.predictedTargetPos.x.toFixed(3)}, ${prediction.predictedTargetPos.y.toFixed(3)}, ${prediction.predictedTargetPos.z.toFixed(3)}]`
                : 'Awaiting observation'}
            </strong>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>Predicted Trajectory Horizon:</span>
            <span className="text-slate-300 font-semibold">
              {prediction.predictedTrajectory.length} steps ahead
            </span>
          </div>
        </div>

        {/* Actual Perceived State */}
        <div className="rounded border border-slate-800 bg-slate-900/60 p-2">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span>ACTUAL OBSERVED STATE</span>
            <span className="text-cyan-400 font-semibold">{prediction.actualNextState}</span>
          </div>
          <div className="text-[10px] text-slate-300">
            Observed Pos (t):{' '}
            <strong className="text-cyan-300">
              {prediction.actualTargetPos
                ? `[${prediction.actualTargetPos.x.toFixed(3)}, ${prediction.actualTargetPos.y.toFixed(3)}, ${prediction.actualTargetPos.z.toFixed(3)}]`
                : 'No lock'}
            </strong>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px]">
            {prediction.occlusionImminent ? (
              <span className="flex items-center gap-1 text-rose-400 font-semibold">
                <AlertTriangle className="h-3 w-3" />
                Occlusion collision predicted on trajectory!
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                No imminent occlusion hazard
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Empirical Horizon Error Profile */}
      <div className="rounded border border-slate-800 bg-slate-900/40 p-2 mb-2 font-mono">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
          <span className="flex items-center gap-1 font-semibold text-slate-300">
            <BarChart2 className="h-3.5 w-3.5 text-amber-400" />
            EMPIRICAL PREDICTION ERROR SCALING OVER HORIZON (t+1 &rarr; t+4)
          </span>
          <span className="text-[9px] text-slate-500">Real observation discrepancies</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-[9px]">
          {horizonSteps.map((step) => {
            const metric = prediction.horizonMetrics?.[step];
            const error = metric?.meanError ?? 0;
            const samples = metric?.sampleCount ?? 0;
            const barWidth = Math.min(100, Math.max(8, error * 400));

            return (
              <div key={step} className="rounded bg-slate-900/90 p-1.5 border border-slate-800/60">
                <div className="flex justify-between text-slate-400 mb-0.5">
                  <span className="font-bold text-amber-300">t+{step}</span>
                  <span className="text-slate-300">{samples > 0 ? error.toFixed(4) : 'Pending'}</span>
                </div>
                <div className="h-1.5 w-full rounded bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${
                      error < 0.05 ? 'bg-emerald-500' : error < 0.12 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${samples > 0 ? barWidth : 0}%` }}
                  />
                </div>
                <div className="mt-0.5 text-[8px] text-slate-500 text-right">
                  {samples} samples
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Discrepancy gauge bar */}
      <div>
        <div className="flex justify-between font-mono text-[9px] text-slate-400 mb-0.5">
          <span>SURPRISE / 1-STEP PREDICTION ERROR MAGNITUDE</span>
          <span>
            {prediction.predictionError < 0.05
              ? 'MINIMAL'
              : prediction.predictionError < 0.12
              ? 'NOMINAL'
              : 'HIGH DISCREPANCY'}
          </span>
        </div>
        <div className="h-2 w-full rounded bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all ${
              prediction.predictionError < 0.05
                ? 'bg-emerald-500'
                : prediction.predictionError < 0.12
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
            style={{ width: `${Math.min(100, prediction.predictionError * 500)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
