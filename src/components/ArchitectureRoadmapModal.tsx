import React from 'react';
import { X, CheckCircle2, Clock, AlertCircle, Cpu, Layers, BookOpen } from 'lucide-react';
import { CV_LAYERS } from '../perception/cv_layer_registry';

interface ArchitectureRoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureRoadmapModal: React.FC<ArchitectureRoadmapModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-xl border border-slate-700 bg-[#0b0f19] p-6 text-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                AViCA RESEARCH ARCHITECTURE & IMPLEMENTATION STATUS
              </h2>
              <p className="text-[11px] text-slate-400">
                Rigorous scientific audit: What is functional in Phase 1 vs Phase 2 Roadmap
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Phase 1 Verification Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>REAL & FUNCTIONAL (SCIENTIFIC INTEGRITY ENFORCED)</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li>&bull; <strong>Strict Boundary:</strong> Cognitive engine receives <em>only</em> raw rendered image data (ImageData pixel buffer). Zero simulator entity coordinates, IDs, or ground-truth states leak into perception.</li>
              <li>&bull; <strong>Real Image-Derived Perception:</strong> Connected components labeling, foreground segmentation, aspect ratio, circularity metric ($4\pi A / P^2$), and color HSV extraction run directly on pixels.</li>
              <li>&bull; <strong>High-Resolution ROI Inspection:</strong> Crops actual pixel regions on demand, computing radial boundary variance and inner concentric signatures to modulate evidence without simulator checks.</li>
              <li>&bull; <strong>Visual Working Memory:</strong> Multi-slot representation with temporal centroid association, continuous velocity vectors, confidence decay, and occlusion inference.</li>
              <li>&bull; <strong>Spatial World Model:</strong> 3D relative coordinate graph with derived geometric relationships (left/right, closer/farther, approaching, occluding) and 4 callable query types.</li>
              <li>&bull; <strong>Epistemic Uncertainty:</strong> Real Shannon entropy ambiguity across candidate hypotheses, missing evidence scoring, and confidence thresholds.</li>
              <li>&bull; <strong>Observation Utility:</strong> Expected Information Gain minus computation & latency cost table.</li>
              <li>&bull; <strong>Predictive Perception:</strong> Multi-step kinematic trajectory projection, surprise error logging, and occlusion hazard warnings.</li>
              <li>&bull; <strong>Post-Hoc Scientific Evaluation:</strong> External evaluator compares cognitive outputs against GroundTruthState to compute localization error and tracking accuracy objectively.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-2">
              <Clock className="h-4 w-4" />
              <span>STUBBED / PLANNED FOR PHASE 2+</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li>&bull; <strong>Layer 6 Deep Vision:</strong> Currently uses 8-dim color/aspect feature descriptor vector. Phase 2 will integrate PyTorch / OpenCV DNN embeddings.</li>
              <li>&bull; <strong>Layer 8 Adaptive Learning:</strong> Few-shot online template drift compensation.</li>
              <li>&bull; <strong>OpenCV Python Backend:</strong> Real-time Python/C++ OpenCV binding server for high-throughput video streams.</li>
              <li>&bull; <strong>OpenCV 5 + AWS Graviton + COOL:</strong> Hardware accelerator optimization and benchmark harness (scheduled for Phase 12).</li>
              <li>&bull; <strong>Human Gaze Integration:</strong> Fixation scanpath alignment (scheduled for Phase 11).</li>
            </ul>
          </div>
        </div>

        {/* 9 Computer Vision Layers Table */}
        <div>
          <h3 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-cyan-400" />
            <span>9-LAYER COMPUTER VISION FOUNDATION MAPPING</span>
          </h3>
          <div className="overflow-x-auto rounded border border-slate-800">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                  <th className="py-1.5 px-2">Layer</th>
                  <th className="py-1.5 px-2">Name & Syllabus Topics</th>
                  <th className="py-1.5 px-2">Current Status</th>
                  <th className="py-1.5 px-2">Implementation Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {CV_LAYERS.map((l) => (
                  <tr key={l.layer} className="hover:bg-slate-900/40">
                    <td className="py-1.5 px-2 font-bold text-cyan-300">L{l.layer}</td>
                    <td className="py-1.5 px-2">
                      <div className="text-slate-200 font-semibold">{l.name}</div>
                      <div className="text-[10px] text-slate-500">{l.category}</div>
                    </td>
                    <td className="py-1.5 px-2">
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                          l.status === 'ACTIVE_IN_PHASE1'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                            : 'bg-amber-950 text-amber-400 border border-amber-800/60'
                        }`}
                      >
                        {l.status === 'ACTIVE_IN_PHASE1' ? 'ACTIVE (P1)' : 'QUEUED (P2)'}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-[10px] text-slate-400">
                      {l.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t border-slate-800 pt-3">
          <button
            onClick={onClose}
            className="rounded bg-slate-800 px-4 py-1.5 font-semibold text-slate-200 hover:bg-slate-700"
          >
            Close Specification
          </button>
        </div>
      </div>
    </div>
  );
};
