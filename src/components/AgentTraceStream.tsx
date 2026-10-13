import React from 'react';
import { Terminal, ArrowRight, Zap, ShieldAlert, Database, Eye } from 'lucide-react';
import { AgentTraceStep } from '../types/avica';

interface AgentTraceStreamProps {
  traceSteps: AgentTraceStep[];
}

export const AgentTraceStream: React.FC<AgentTraceStreamProps> = ({ traceSteps }) => {
  const getPhaseBadgeColor = (phase: AgentTraceStep['phase']) => {
    switch (phase) {
      case 'OBSERVE':
        return 'border-sky-500/40 bg-sky-950/40 text-sky-300';
      case 'DECIDE':
        return 'border-purple-500/40 bg-purple-950/40 text-purple-300';
      case 'ACTION':
        return 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300';
      case 'RESULT':
        return 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300';
      case 'UNCERTAINTY':
        return 'border-rose-500/40 bg-rose-950/40 text-rose-300';
      case 'UPDATE':
      case 'MEMORY_UPDATE':
        return 'border-indigo-500/40 bg-indigo-950/40 text-indigo-300';
      case 'NEXT_ACTION':
        return 'border-amber-500/40 bg-amber-950/40 text-amber-300';
    }
  };

  return (
    <div className="flex flex-col rounded-lg border border-slate-800 bg-[#070a12] p-3 text-xs shadow-md">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-400" />
          <span className="font-mono font-semibold text-slate-200">
            COMPUTATIONAL AGENT TRACE STREAM
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-500">
          NON-LINEAR COGNITIVE LOOP
        </span>
      </div>

      <div className="max-h-56 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-1">
        {traceSteps.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            Awaiting first execution step...
          </div>
        ) : (
          traceSteps.map((step) => (
            <div
              key={step.stepId}
              className="flex items-start gap-2 rounded border border-slate-900 bg-slate-950/60 p-1.5 transition-colors hover:border-slate-800"
            >
              <div className="flex items-center gap-1 min-w-[110px]">
                <span className="text-[10px] text-slate-500">#{step.frameId}</span>
                <span
                  className={`rounded border px-1.5 py-0.2 text-[9px] font-bold ${getPhaseBadgeColor(
                    step.phase
                  )}`}
                >
                  {step.phase === 'NEXT_ACTION' ? 'NEXT ACTION' : step.phase}
                </span>
              </div>
              <p className="flex-1 text-slate-300 leading-tight">
                {step.details}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
