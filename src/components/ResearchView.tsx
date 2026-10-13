import React from 'react';
import {
  FileText,
  CheckCircle2,
  Layers,
  HelpCircle,
  Cpu,
  ShieldCheck,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { CV_LAYERS } from '../perception/cv_layer_registry';

export const ResearchView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Editorial Header */}
      <div className="pb-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400">
            RESEARCH MONOGRAPH &bull; AViCA V0.2
          </span>
        </div>
        <h1 className="text-2xl font-normal text-white tracking-tight leading-snug">
          Adaptive Visual Cognitive Architecture
        </h1>
        <p className="text-sm text-slate-400 font-light mt-1">
          An uncertainty-driven computational architecture for active visual perception, visual working memory, spatial reasoning, predictive perception, and reinforcement-learning-based visual attention.
        </p>
      </div>

      {/* 1. Core Research Question */}
      <section className="rounded-2xl glass-surface p-6 border border-white/[0.06]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2">
          Central Research Question
        </h2>
        <blockquote className="text-base text-slate-100 font-light italic border-l-2 border-cyan-400 pl-4 py-1 leading-relaxed">
          &ldquo;Can a visual agent improve perception efficiency and robustness by selectively attending to visual information, maintaining visual working memory, constructing a spatial world model, estimating uncertainty, predicting future visual states, and actively choosing what visual evidence to acquire next?&rdquo;
        </blockquote>
      </section>

      {/* 2. Core Hypotheses */}
      <section className="rounded-2xl glass-surface p-6 border border-white/[0.06]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4">
          Core Research Hypotheses
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-light text-slate-300">
          <div className="p-3.5 rounded-xl bg-black/20 border border-white/[0.04]">
            <strong className="text-white font-medium block mb-1">H1: Active Perception Efficiency</strong>
            An uncertainty-driven active visual agent achieves strong task performance requiring fewer unnecessary computations than passive pipelines.
          </div>
          <div className="p-3.5 rounded-xl bg-black/20 border border-white/[0.04]">
            <strong className="text-white font-medium block mb-1">H2: Temporal Consistency via VWM</strong>
            Explicit visual working memory improves temporal consistency across occlusion compared with frame-independent perception.
          </div>
          <div className="p-3.5 rounded-xl bg-black/20 border border-white/[0.04]">
            <strong className="text-white font-medium block mb-1">H3: Spatial World Modeling</strong>
            Explicit spatial and relative depth representations improve spatial reasoning compared with purely 2D representations.
          </div>
          <div className="p-3.5 rounded-xl bg-black/20 border border-white/[0.04]">
            <strong className="text-white font-medium block mb-1">H4: Uncertainty-Driven Evidence Gathering</strong>
            An uncertainty-driven agent actively acquires useful additional observations when initial visual evidence is ambiguous.
          </div>
          <div className="p-3.5 rounded-xl bg-black/20 border border-white/[0.04]">
            <strong className="text-white font-medium block mb-1">H5: RL Observation Policy</strong>
            A reinforcement-learning observation policy learns optimal visual attention strategies under computational budget constraints.
          </div>
          <div className="p-3.5 rounded-xl bg-black/20 border border-white/[0.04]">
            <strong className="text-white font-medium block mb-1">H6: Machine vs Human Attention Alignment</strong>
            Machine visual attention can be quantitatively compared with human visual attention without claiming psychological equivalence.
          </div>
        </div>
      </section>

      {/* 3. Six Cognitive Functions */}
      <section className="rounded-2xl glass-surface p-6 border border-white/[0.06]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4">
          Six Computational Cognitive Functions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
            <span className="text-cyan-300 font-semibold block mb-1">1. Selective Visual Attention</span>
            <span className="text-slate-400">&ldquo;What should I look at next?&rdquo;</span>
          </div>
          <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/20">
            <span className="text-violet-300 font-semibold block mb-1">2. Visual Working Memory</span>
            <span className="text-slate-400">&ldquo;What have I recently observed?&rdquo;</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
            <span className="text-emerald-300 font-semibold block mb-1">3. Spatial Reasoning</span>
            <span className="text-slate-400">&ldquo;Where are entities relative to each other?&rdquo;</span>
          </div>
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20">
            <span className="text-amber-300 font-semibold block mb-1">4. Predictive Perception</span>
            <span className="text-slate-400">&ldquo;What is likely to happen next?&rdquo;</span>
          </div>
          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20">
            <span className="text-rose-300 font-semibold block mb-1">5. Epistemic Uncertainty</span>
            <span className="text-slate-400">&ldquo;What do I not know?&rdquo;</span>
          </div>
          <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-500/20">
            <span className="text-sky-300 font-semibold block mb-1">6. Active Perception</span>
            <span className="text-slate-400">&ldquo;What observation reduces uncertainty?&rdquo;</span>
          </div>
        </div>
      </section>

      {/* 4. Strict Scientific Separation */}
      <section className="rounded-2xl glass-surface p-6 border border-emerald-500/20 bg-emerald-950/10">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            Scientific Integrity Guarantee: Strict Perception Boundary
          </h2>
        </div>
        <p className="text-xs text-slate-300 font-light leading-relaxed mb-4">
          The cognitive architecture receives strictly <strong>raw rendered image pixel buffers (ImageData)</strong>. Candidate regions, circularity ($4\pi A/P^2$), hue, and high-resolution ROI crops are computed exclusively by classical image processing. Ground truth state exists solely for the external evaluation subsystem post-hoc.
        </p>
        <div className="p-3 rounded-xl bg-black/40 font-mono text-[11px] text-slate-300 flex items-center justify-between overflow-x-auto">
          <span>SIMULATED WORLD</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-500 shrink-0 mx-2" />
          <span className="text-cyan-300">RAW IMAGE</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-500 shrink-0 mx-2" />
          <span className="text-sky-300">CLASSICAL CV</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-500 shrink-0 mx-2" />
          <span className="text-violet-300">COGNITION</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-500 shrink-0 mx-2" />
          <span className="text-emerald-300">EVALUATION</span>
        </div>
      </section>

      {/* 5. 9-Layer Computer Vision Mapping */}
      <section className="rounded-2xl glass-surface p-6 border border-white/[0.06]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <Layers className="h-4 w-4 text-cyan-400" />
          <span>Layered Computer Vision Syllabus Mapping</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-slate-500 text-[11px]">
                <th className="pb-2">Layer</th>
                <th className="pb-2">Topic</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Implementation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-slate-300 text-[11px]">
              {CV_LAYERS.map((l) => (
                <tr key={l.layer}>
                  <td className="py-2 text-cyan-300 font-semibold">L{l.layer}</td>
                  <td className="py-2 font-sans font-medium text-slate-200">{l.name}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-medium ${
                        l.status === 'ACTIVE_IN_PHASE1'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : 'bg-white/[0.05] text-slate-400'
                      }`}
                    >
                      {l.status === 'ACTIVE_IN_PHASE1' ? 'Active' : 'Queued P2'}
                    </span>
                  </td>
                  <td className="py-2 font-sans text-slate-400 font-light">{l.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Limitations & Roadmap */}
      <section className="rounded-2xl glass-surface p-6 border border-white/[0.06]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
          Roadmap & Responsible Research Limitations
        </h2>
        <ul className="space-y-2 text-xs text-slate-400 font-light">
          <li>&bull; <strong className="text-slate-200">Phase 2:</strong> Native Python / OpenCV backend integration for dense optical flow and pyramid scale-space.</li>
          <li>&bull; <strong className="text-slate-200">Phase 11:</strong> Human visual attention scanpath comparison dataset.</li>
          <li>&bull; <strong className="text-slate-200">Phase 12:</strong> OpenCV 5 on AWS Graviton with COOL hardware acceleration benchmarking.</li>
          <li>&bull; <strong className="text-slate-200">Responsible Research:</strong> AViCA is an experimental cognitive-inspired computational architecture. It makes no claims of human consciousness, sentience, or psychological equivalence.</li>
        </ul>
      </section>
    </div>
  );
};
