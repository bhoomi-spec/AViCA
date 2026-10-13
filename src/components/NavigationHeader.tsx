import React from 'react';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Sun,
  Activity,
  Layers,
  FlaskConical,
  Eye,
  Brain,
  FileText,
  EyeOff,
  Download,
  Camera,
  CameraOff,
  Upload,
  Video,
} from 'lucide-react';
import { BaselineMode } from '../types/avica';
import { VideoInputMode } from './VideoSource';

export type NavTab = 'OBSERVE' | 'COGNITION' | 'EXPERIMENTS' | 'RESEARCH';

interface NavigationHeaderProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  mode: BaselineMode;
  onModeChange: (m: BaselineMode) => void;
  isRunning: boolean;
  onToggleRun: () => void;
  onStep: () => void;
  onReset: () => void;
  fps: number;
  latencyMs: number;
  illuminationShift: boolean;
  onToggleIllumination: () => void;
  onTriggerOcclusion?: () => void;
  onExportSnapshot?: () => void;
  inputMode: VideoInputMode;
  onSetInputMode: (mode: VideoInputMode) => void;
  onUploadVideoClick?: () => void;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  activeTab,
  onTabChange,
  mode,
  onModeChange,
  isRunning,
  onToggleRun,
  onStep,
  onReset,
  fps,
  latencyMs,
  illuminationShift,
  onToggleIllumination,
  onTriggerOcclusion,
  onExportSnapshot,
  inputMode,
  onSetInputMode,
  onUploadVideoClick,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#08090e]/85 backdrop-blur-xl px-5 py-3">
      <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
            <span className="font-semibold text-xs tracking-wider">A</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium tracking-tight text-white text-sm">
                AViCA
              </span>
              <span className="h-1 w-1 rounded-full bg-cyan-400" />
              <span className="text-xs text-slate-400 font-normal">
                Adaptive Visual Cognitive Architecture
              </span>
            </div>
          </div>
        </div>

        {/* Central Segmented Navigation Tabs */}
        <nav className="flex items-center rounded-xl p-1 bg-white/[0.04] border border-white/[0.06]">
          <button
            onClick={() => onTabChange('OBSERVE')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'OBSERVE'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="h-3.5 w-3.5 text-cyan-400" />
            <span>Observe</span>
          </button>

          <button
            onClick={() => onTabChange('COGNITION')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'COGNITION'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="h-3.5 w-3.5 text-violet-400" />
            <span>Cognition</span>
          </button>

          <button
            onClick={() => onTabChange('EXPERIMENTS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'EXPERIMENTS'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5 text-amber-400" />
            <span>Experiments</span>
          </button>

          <button
            onClick={() => onTabChange('RESEARCH')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'RESEARCH'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5 text-slate-300" />
            <span>Research</span>
          </button>
        </nav>

        {/* Right Controls & Telemetry */}
        <div className="flex items-center gap-3">
          {/* 4 Systems Mode Selector */}
          <div className="hidden md:flex rounded-xl p-0.5 bg-white/[0.04] border border-white/[0.06] text-xs">
            <button
              onClick={() => onModeChange('PASSIVE_VISION')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                mode === 'PASSIVE_VISION'
                  ? 'bg-slate-700/60 text-slate-100 font-medium border border-slate-600/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="System 1: Passive Vision (Blind full frame)"
            >
              Passive
            </button>
            <button
              onClick={() => onModeChange('ATTENTION_VISION')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                mode === 'ATTENTION_VISION'
                  ? 'bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="System 2: Attention Vision (Greedy saliency, no VWM)"
            >
              Attention
            </button>
            <button
              onClick={() => onModeChange('AVICA_GREEDY')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                mode === 'AVICA_GREEDY'
                  ? 'bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="System 3: AViCA Greedy (Active perception + VWM)"
            >
              AViCA Greedy
            </button>
            <button
              onClick={() => onModeChange('AVICA_LEARNED')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                mode === 'AVICA_LEARNED'
                  ? 'bg-violet-500/20 text-violet-200 font-medium border border-violet-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="System 4: AViCA Learned Policy (Deep Q-value policy)"
            >
              AViCA Learned
            </button>
          </div>

          {/* Stepping and Play Controls */}
          <div className="flex items-center gap-1 rounded-xl p-1 bg-white/[0.04] border border-white/[0.06]">
            <button
              onClick={onToggleRun}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                isRunning
                  ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                  : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
              }`}
            >
              {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              <span>{isRunning ? 'Pause' : 'Play'}</span>
            </button>

            <button
              onClick={onStep}
              disabled={isRunning}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
              title="Step forward one cognitive frame"
            >
              <StepForward className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={onReset}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Reset scene and memory"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* LIVE WEBCAM Background Sensor Toggle */}
          <button
            onClick={() => onSetInputMode(inputMode === 'WEBCAM' ? 'SIMULATOR' : 'WEBCAM')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-medium transition-all ${
              inputMode === 'WEBCAM'
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                : 'bg-white/[0.04] border-white/[0.06] text-slate-400 hover:text-white hover:border-white/20'
            }`}
            title="Toggle Live Background Camera Sensor (MediaDevices getUserMedia)"
          >
            {inputMode === 'WEBCAM' ? (
              <>
                <CameraOff className="h-3.5 w-3.5 text-rose-400" />
                <span className="text-[11px] font-semibold tracking-wide">WEBCAM LIVE</span>
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              </>
            ) : (
              <>
                <Camera className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold tracking-wide">LIVE WEBCAM</span>
              </>
            )}
          </button>

          {/* Illumination Shift Toggle (Enabled only in simulator) */}
          <button
            onClick={onToggleIllumination}
            disabled={inputMode !== 'SIMULATOR'}
            className={`p-1.5 rounded-xl border text-xs transition-colors ${
              illuminationShift && inputMode === 'SIMULATOR'
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-white/[0.04] border-white/[0.06] text-slate-400 hover:text-white disabled:opacity-30'
            }`}
            title={inputMode === 'SIMULATOR' ? "Toggle dynamic illumination drift in simulator" : "Illumination drift disabled for optical feeds"}
          >
            <Sun className="h-3.5 w-3.5" />
          </button>

          {/* Induce Target Occlusion Button */}
          {onTriggerOcclusion && (
            <button
              onClick={onTriggerOcclusion}
              className="p-1.5 rounded-xl border border-white/[0.06] bg-white/[0.04] text-slate-400 hover:text-rose-300 hover:border-rose-500/30 text-xs transition-colors"
              title="Induce Target Occlusion (Demonstrate VWM Kinematic Continuity)"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Export Cognitive State JSON */}
          {onExportSnapshot && (
            <button
              onClick={onExportSnapshot}
              className="p-1.5 rounded-xl border border-white/[0.06] bg-white/[0.04] text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30 text-xs transition-colors"
              title="Export Current Cognitive Cycle Snapshot (JSON)"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Live Telemetry */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/[0.08] text-xs">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRunning ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            </span>
            <span className="font-mono text-slate-300 text-[11px]">{fps} <span className="text-slate-500">FPS</span></span>
            <span className="text-slate-600">&bull;</span>
            <span className="font-mono text-slate-400 text-[11px]">{latencyMs} <span className="text-slate-500">ms</span></span>
          </div>
        </div>
      </div>
    </header>
  );
};
