import React from 'react';
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Cpu,
  Layers,
  FlaskConical,
  Sun,
  ShieldAlert,
} from 'lucide-react';
import { BaselineMode } from '../types/avica';

interface HeaderProps {
  mode: BaselineMode;
  onModeChange: (m: BaselineMode) => void;
  isRunning: boolean;
  onToggleRun: () => void;
  onStep: () => void;
  onReset: () => void;
  fps: number;
  latencyMs: number;
  frameCount: number;
  illuminationShift: boolean;
  onToggleIllumination: () => void;
  onOpenRoadmap: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onModeChange,
  isRunning,
  onToggleRun,
  onStep,
  onReset,
  fps,
  latencyMs,
  frameCount,
  illuminationShift,
  onToggleIllumination,
  onOpenRoadmap,
}) => {
  return (
    <header className="border-b border-slate-800 bg-[#090d16] px-4 py-2.5 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded border border-cyan-500/40 bg-cyan-950/40 text-cyan-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold tracking-wider text-slate-100">
                AViCA
              </span>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                SCIENTIFIC INTEGRITY: STRICT PERCEPTION BOUNDARY
              </span>
              <span className="text-xs text-slate-500">|</span>
              <span className="font-mono text-xs text-slate-400">
                Adaptive Visual Cognitive Architecture
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              <span className="text-slate-500">Pipeline: </span>
              <strong className="text-slate-300">SIMULATION</strong> &rarr;{' '}
              <strong className="text-cyan-400">RENDERED IMAGE</strong> &rarr;{' '}
              <strong className="text-sky-400">CLASSICAL CV</strong> &rarr;{' '}
              <strong className="text-indigo-400">COGNITION</strong> &rarr;{' '}
              <strong className="text-emerald-400">POST-HOC EVALUATION</strong>
            </p>
          </div>
        </div>

        {/* Mode Selector & Execution Controls */}
        <div className="flex items-center gap-2">
          {/* Baseline Mode Toggle */}
          <div className="flex rounded border border-slate-800 bg-slate-900/90 p-0.5 text-xs">
            <button
              onClick={() => onModeChange('PASSIVE_VISION')}
              className={`rounded px-2.5 py-1 font-mono transition-colors ${
                mode === 'PASSIVE_VISION'
                  ? 'bg-slate-700 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="System 1: Passive Vision"
            >
              Passive
            </button>
            <button
              onClick={() => onModeChange('ATTENTION_VISION')}
              className={`rounded px-2.5 py-1 font-mono transition-colors ${
                mode === 'ATTENTION_VISION'
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="System 2: Attention Vision"
            >
              Attention
            </button>
            <button
              onClick={() => onModeChange('AVICA_GREEDY')}
              className={`rounded px-2.5 py-1 font-mono transition-colors ${
                mode === 'AVICA_GREEDY'
                  ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="System 3: AViCA Greedy"
            >
              AViCA Greedy
            </button>
            <button
              onClick={() => onModeChange('AVICA_LEARNED')}
              className={`rounded px-2.5 py-1 font-mono transition-colors ${
                mode === 'AVICA_LEARNED'
                  ? 'bg-purple-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="System 4: AViCA Learned Policy"
            >
              AViCA Learned
            </button>
          </div>

          {/* Stepping and Play Controls */}
          <div className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900/90 p-1">
            <button
              onClick={onToggleRun}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-mono font-medium transition-colors ${
                isRunning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isRunning ? 'Pause' : 'Run'}</span>
            </button>
            <button
              onClick={onStep}
              disabled={isRunning}
              className="flex items-center rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"
              title="Single Cognitive Cycle Step"
            >
              <StepForward className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onReset}
              className="flex items-center rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              title="Reset Scene and Memory"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Disturbance test toggle */}
          <button
            onClick={onToggleIllumination}
            className={`flex items-center gap-1 rounded border px-2 py-1 text-xs font-mono transition-colors ${
              illuminationShift
                ? 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle dynamic illumination drift to test adversarial robustness"
          >
            <Sun className="h-3.5 w-3.5" />
            <span>Illum. Drift: {illuminationShift ? 'ON' : 'OFF'}</span>
          </button>

          {/* Architecture Roadmap Modal Trigger */}
          <button
            onClick={onOpenRoadmap}
            className="flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-950/20 px-2.5 py-1 text-xs font-mono text-cyan-300 hover:bg-cyan-900/30"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            <span>Phase 1 Spec</span>
          </button>
        </div>

        {/* Live Empirical Telemetry */}
        <div className="flex items-center gap-3 border-l border-slate-800 pl-3 font-mono text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500">FRAME</span>
            <span className="font-semibold text-slate-300">#{frameCount}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500">LATENCY</span>
            <span className="font-semibold text-cyan-400">{latencyMs} ms</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500">RATE</span>
            <span className="font-semibold text-emerald-400">{fps} FPS</span>
          </div>
        </div>
      </div>
    </header>
  );
};
