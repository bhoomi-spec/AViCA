import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, Clock, Info } from 'lucide-react';
import { AgentTraceStep } from '../types/avica';

interface CognitiveTimelineProps {
  traceSteps: AgentTraceStep[];
}

export const CognitiveTimeline: React.FC<CognitiveTimelineProps> = ({ traceSteps }) => {
  const [expandedStepId, setExpandedStepId] = useState<number | null>(null);

  const getMarkerColor = (phase: AgentTraceStep['phase']) => {
    switch (phase) {
      case 'OBSERVE':
        return 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]';
      case 'DECIDE':
        return 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.7)]';
      case 'ACTION':
        return 'bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.7)]';
      case 'RESULT':
        return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]';
      case 'UNCERTAINTY':
        return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]';
      case 'UPDATE':
      case 'MEMORY_UPDATE':
        return 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.7)]';
      case 'NEXT_ACTION':
        return 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]';
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  return (
    <div className="rounded-2xl glass-surface p-5 border border-white/[0.06]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Cognitive Timeline
          </h3>
        </div>
        <span className="text-[11px] text-slate-500">
          Click any step to inspect technical trace details
        </span>
      </div>

      {/* Stream */}
      <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
        {traceSteps.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 font-light">
            Cognitive loop awaiting input...
          </div>
        ) : (
          traceSteps.slice(0, 30).map((step) => {
            const isExpanded = expandedStepId === step.stepId;

            return (
              <div
                key={step.stepId}
                onClick={() => setExpandedStepId(isExpanded ? null : step.stepId)}
                className={`group rounded-xl p-2.5 transition-all cursor-pointer ${
                  isExpanded
                    ? 'bg-white/[0.06] border border-white/10'
                    : 'hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Semantic Marker Dot */}
                    <span className={`h-2 w-2 rounded-full ${getMarkerColor(step.phase)}`} />

                    {/* Timestamp */}
                    <span className="text-[11px] font-mono text-slate-400">
                      {formatTimestamp(step.timestamp)}
                    </span>

                    {/* Phase Badge */}
                    <span className="text-[11px] font-medium text-slate-200 tracking-tight">
                      {step.phase === 'NEXT_ACTION' ? 'NEXT ACTION' : step.phase}
                    </span>

                    {/* Brief description */}
                    <span className="text-xs text-slate-300 font-light truncate max-w-md">
                      {step.details}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500">
                      #{step.frameId}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-300" />
                    )}
                  </div>
                </div>

                {/* Progressive Disclosure: Technical Inspection Drawer */}
                {isExpanded && (
                  <div className="mt-2.5 pt-2 border-t border-white/[0.06] text-xs font-mono text-slate-300 grid grid-cols-2 gap-2 bg-black/20 p-2.5 rounded-lg">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Action Executed</span>
                      <span>{step.actionExecuted || 'Nominal Step'}</span>
                    </div>
                    {step.uncertaintyBefore !== undefined && (
                      <div>
                        <span className="text-slate-500 block text-[10px]">Uncertainty Level</span>
                        <span>{(step.uncertaintyBefore * 100).toFixed(1)}%</span>
                      </div>
                    )}
                    {step.roi && (
                      <div className="col-span-2">
                        <span className="text-slate-500 block text-[10px]">Sampled ROI Coordinates</span>
                        <span>
                          [{step.roi.x.toFixed(3)}, {step.roi.y.toFixed(3)}, {step.roi.width.toFixed(3)} &times; {step.roi.height.toFixed(3)}]
                        </span>
                      </div>
                    )}
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-[10px]">Full Technical Trace</span>
                      <span className="text-[11px] text-slate-400 font-sans">{step.details}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
