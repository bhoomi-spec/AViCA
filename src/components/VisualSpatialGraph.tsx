import React, { useState, useMemo } from 'react';
import {
  Compass,
  Layers,
  Network,
  Eye,
  Sliders,
  Target,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Maximize2,
  RefreshCw,
  Activity,
  ArrowRight,
  ShieldAlert,
  Boxes,
} from 'lucide-react';
import {
  SpatialWorldModel,
  WorkingMemoryEntity,
  SpatialRelationship,
  FeatureMatchingReport,
  MultiViewReconstructionReport,
} from '../types/avica';
import { SpatialWorldModelEngine } from '../spatial/spatial_world_model';

interface VisualSpatialGraphProps {
  worldModel: SpatialWorldModel;
  spatialEngine: SpatialWorldModelEngine;
  onSelectEntity?: (entity: WorkingMemoryEntity) => void;
  selectedEntityId?: string;
  onToggleMultiView?: (enabled: boolean) => void;
}

export type GraphProjectionMode = 'TOP_DOWN_XZ' | 'FRONTAL_XY' | 'RELATIONAL_TOPOLOGY' | 'STEREO_FEATURE_MATCHES';

export const VisualSpatialGraph: React.FC<VisualSpatialGraphProps> = ({
  worldModel,
  spatialEngine,
  onSelectEntity,
  selectedEntityId,
  onToggleMultiView,
}) => {
  const [projection, setProjection] = useState<GraphProjectionMode>('TOP_DOWN_XZ');
  const [activeQuery, setActiveQuery] = useState<'closest' | 'moved' | 'deltas' | 'approaching' | 'occlusion_chains' | 'clusters'>('closest');
  const [relationFilter, setRelationFilter] = useState<'ALL' | 'KINEMATIC' | 'OCCLUSION' | 'DEPTH'>('ALL');
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

  const entities = Object.values(worldModel.entities);
  const isMultiViewActive = Boolean(worldModel.depthModalityStatus?.hasTrueMetricDepth);
  const multiViewReport = worldModel.multiViewReconstruction;
  const featureReport = worldModel.featureMatching;

  // Run live multi-object reasoning queries
  const closestResult = useMemo(() => spatialEngine.queryClosestToTarget(), [worldModel, spatialEngine]);
  const movedResult = useMemo(() => spatialEngine.queryMovedObjects(0.015), [worldModel, spatialEngine]);
  const deltasResult = useMemo(() => spatialEngine.queryObservationDeltas(), [worldModel, spatialEngine]);
  const approachingResult = useMemo(() => spatialEngine.queryApproachingPairs(), [worldModel, spatialEngine]);
  const occlusionChains = useMemo(() => spatialEngine.queryOcclusionChains(), [worldModel, spatialEngine]);
  const clustersResult = useMemo(() => spatialEngine.querySpatialClusters(), [worldModel, spatialEngine]);
  const spatialMetrics = useMemo(() => spatialEngine.getSpatialMetrics(), [worldModel, spatialEngine]);

  // Filtered relationships
  const filteredRelationships = useMemo(() => {
    return worldModel.relationships.filter((r) => {
      if (relationFilter === 'KINEMATIC') return r.relation === 'APPROACHING' || r.relation === 'RECEDING';
      if (relationFilter === 'OCCLUSION') return r.relation === 'OCCLUDING' || r.relation === 'OCCLUDED_BY';
      if (relationFilter === 'DEPTH') return r.relation === 'CLOSER_THAN' || r.relation === 'FARTHER_THAN' || r.relation === 'EQUIDISTANT';
      return true;
    });
  }, [worldModel.relationships, relationFilter]);

  // Highlighted entity IDs based on active query
  const highlightedEntityIds = useMemo(() => {
    const ids = new Set<string>();
    if (activeQuery === 'closest' && closestResult.entity) {
      ids.add(closestResult.entity.id);
      if (worldModel.targetId) ids.add(worldModel.targetId);
    } else if (activeQuery === 'moved') {
      movedResult.forEach((m) => ids.add(m.entity.id));
    } else if (activeQuery === 'approaching') {
      approachingResult.forEach((a) => {
        ids.add(a.source);
        ids.add(a.target);
      });
    } else if (activeQuery === 'occlusion_chains') {
      occlusionChains.forEach((o) => {
        ids.add(o.occluder);
        ids.add(o.occluded);
      });
    }
    return ids;
  }, [activeQuery, closestResult, movedResult, approachingResult, occlusionChains, worldModel.targetId]);

  const activeEntity = entities.find((e) => e.id === (hoveredEntityId || selectedEntityId)) || entities[0];

  return (
    <div className="flex flex-col rounded-2xl glass-surface border border-white/[0.08] p-4 text-xs font-sans shadow-xl">
      {/* 1. Header with Depth Modality Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-mono text-xs font-bold text-slate-100 tracking-wide uppercase">
              Spatial World Model & Visual Spatial Graph
            </h3>
            <p className="text-[11px] text-slate-400 font-light">
              Grounded geometric relationships & multi-object topological reasoning
            </p>
          </div>
        </div>

        {/* Multi-View Stereo Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const nextState = !spatialEngine.isMultiViewEnabled();
              spatialEngine.setMultiViewEnabled(nextState);
              if (onToggleMultiView) onToggleMultiView(nextState);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all shadow-sm ${
              isMultiViewActive
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                : 'bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:text-white hover:bg-white/[0.08]'
            }`}
            title="Toggle experimental dual-camera stereo reconstruction"
          >
            <Boxes className="h-3.5 w-3.5" />
            <span>Stereo Triangulation: {isMultiViewActive ? 'ACTIVE (Metric 3D)' : 'OFF (Relative Depth Only)'}</span>
          </button>
        </div>
      </div>

      {/* 2. Clear Modality Distinction Warning / Status Bar */}
      <div className={`mb-3 rounded-xl p-2.5 font-mono text-[11px] border transition-colors ${
        isMultiViewActive
          ? 'bg-cyan-950/30 border-cyan-800/60 text-cyan-200'
          : 'bg-slate-900/60 border-amber-900/40 text-amber-300/90'
      }`}>
        <div className="flex items-start gap-2">
          <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${isMultiViewActive ? 'text-cyan-400' : 'text-amber-400'}`} />
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold tracking-wider">DEPTH MODALITY CONTRACT:</span>
              <span className="px-1.5 py-0.2 rounded bg-black/40 text-[10px] text-emerald-300 border border-emerald-500/30">
                1. 2D Position: [x, y] in Camera Image Plane
              </span>
              <span className="px-1.5 py-0.2 rounded bg-black/40 text-[10px] text-amber-300 border border-amber-500/30">
                2. Relative Monocular Depth: z_rel in [0..1] (Scale & Ground Prior)
              </span>
              <span className={`px-1.5 py-0.2 rounded bg-black/40 text-[10px] border ${
                isMultiViewActive
                  ? 'text-cyan-300 border-cyan-500/40 font-bold'
                  : 'text-slate-400 border-slate-700'
              }`}>
                3. True Metric Depth: {isMultiViewActive ? 'RECONSTRUCTED (m)' : 'UNRECONSTRUCTED (Not Claimed)'}
              </span>
            </div>
            <p className="text-[10px] font-sans font-light text-slate-300">
              {worldModel.depthModalityStatus?.explanation ?? 'Spatial world model initialized.'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Controls: Projections & Relational Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        {/* Projection Mode Switcher */}
        <div className="flex items-center gap-1 rounded-xl bg-black/30 p-1 border border-white/[0.04]">
          <button
            onClick={() => setProjection('TOP_DOWN_XZ')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
              projection === 'TOP_DOWN_XZ'
                ? 'bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Top-Down X-Z (Bird's Eye)
          </button>
          <button
            onClick={() => setProjection('FRONTAL_XY')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
              projection === 'FRONTAL_XY'
                ? 'bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Frontal X-Y (Camera)
          </button>
          <button
            onClick={() => setProjection('RELATIONAL_TOPOLOGY')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
              projection === 'RELATIONAL_TOPOLOGY'
                ? 'bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Topology Graph
          </button>
          <button
            onClick={() => setProjection('STEREO_FEATURE_MATCHES')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
              projection === 'STEREO_FEATURE_MATCHES'
                ? 'bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Stereo Feature Matches
          </button>
        </div>

        {/* Relationship Filters */}
        <div className="flex items-center gap-1 text-[11px] font-mono">
          <span className="text-slate-500 mr-1 text-[10px]">Filter:</span>
          {(['ALL', 'KINEMATIC', 'OCCLUSION', 'DEPTH'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setRelationFilter(mode)}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                relationFilter === mode
                  ? 'bg-slate-700 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200 bg-white/[0.02]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Main Visual Graph Canvas / SVG Viewport */}
      <div className="relative h-64 w-full rounded-xl bg-black/40 border border-white/[0.06] overflow-hidden select-none">
        {/* Coordinate Background Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/40 via-black/40 to-black/80" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/[0.04]" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/[0.04]" />

        {/* A. Top-Down Bird's Eye View (X-Z Plane) */}
        {projection === 'TOP_DOWN_XZ' && (
          <div className="absolute inset-0 p-4">
            {/* Camera Optical Center & FOV Frustum */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
              <div className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <span className="text-[9px] font-mono text-cyan-300 mt-0.5">CAMERA [Z=0]</span>
            </div>

            {/* Frustum Cone Lines */}
            <svg className="absolute inset-0 h-full w-full pointer-events-none">
              <line x1="50%" y1="92%" x2="5%" y2="8%" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="50%" y1="92%" x2="95%" y2="8%" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              {/* Depth distance rings */}
              <circle cx="50%" cy="92%" r="28%" fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
              <circle cx="50%" cy="92%" r="56%" fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
              <circle cx="50%" cy="92%" r="80%" fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />

              {/* Pairwise Relational Edges */}
              {filteredRelationships.map((rel, idx) => {
                const src = worldModel.entities[rel.sourceId];
                const tgt = worldModel.entities[rel.targetId];
                if (!src || !tgt) return null;

                const x1 = Math.max(8, Math.min(92, src.position.x * 100));
                // In X-Z top-down view, Y-axis represents depth Z (closer objects near bottom)
                const y1 = Math.max(12, Math.min(84, 88 - src.position.z * 72));
                const x2 = Math.max(8, Math.min(92, tgt.position.x * 100));
                const y2 = Math.max(12, Math.min(84, 88 - tgt.position.z * 72));

                let strokeColor = 'rgba(255,255,255,0.1)';
                let strokeWidth = 1;
                let dash = undefined;

                if (rel.relation === 'OCCLUDING') {
                  strokeColor = 'rgba(244,63,94,0.6)';
                  strokeWidth = 2;
                } else if (rel.relation === 'APPROACHING') {
                  strokeColor = 'rgba(245,158,11,0.7)';
                  strokeWidth = 2;
                  dash = '3 3';
                } else if (rel.relation === 'CLOSER_THAN') {
                  strokeColor = 'rgba(6,182,212,0.4)';
                }

                return (
                  <line
                    key={`edge_${idx}`}
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dash}
                  />
                );
              })}
            </svg>

            {/* Depth Axis Labels */}
            <div className="absolute right-2 top-2 text-[9px] font-mono text-slate-500 flex flex-col items-end gap-1 pointer-events-none">
              <span>Far (z=1.0)</span>
              <span>Mid (z=0.5)</span>
              <span>Near (z=0.1)</span>
            </div>

            {/* Entity Nodes in X-Z Space */}
            {entities.map((ent) => {
              const isTarget = ent.isTarget;
              const isSelected = ent.id === selectedEntityId;
              const isHighlighted = highlightedEntityIds.has(ent.id);
              const left = Math.max(8, Math.min(92, ent.position.x * 100));
              const top = Math.max(12, Math.min(84, 88 - ent.position.z * 72));

              return (
                <div
                  key={ent.id}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform cursor-pointer group ${
                    isSelected ? 'scale-125 z-30' : isHighlighted ? 'scale-115 z-20' : 'hover:scale-125 z-10'
                  }`}
                  onClick={() => onSelectEntity && onSelectEntity(ent)}
                  onMouseEnter={() => setHoveredEntityId(ent.id)}
                  onMouseLeave={() => setHoveredEntityId(null)}
                >
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                      isTarget
                        ? 'bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.9)] ring-2 ring-cyan-200 animate-pulse'
                        : ent.isOccluded
                        ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] ring-1 ring-rose-300'
                        : 'bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.6)] ring-1 ring-violet-300'
                    }`}
                  >
                    <span className="text-[9px] font-mono font-bold text-black">
                      {isTarget ? 'T' : ent.id.slice(-2)}
                    </span>
                  </div>

                  {/* Velocity Vector Arrow */}
                  {Math.hypot(ent.velocity.x, ent.velocity.z) > 0.002 && (
                    <div
                      style={{
                        transform: `rotate(${Math.atan2(-ent.velocity.z, ent.velocity.x) * (180 / Math.PI)}deg)`,
                      }}
                      className="absolute top-1/2 left-1/2 w-7 h-0.5 bg-amber-400 origin-left pointer-events-none opacity-80"
                    />
                  )}

                  {/* Micro label */}
                  <div className="absolute left-1/2 -top-5 -translate-x-1/2 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-200 whitespace-nowrap border border-white/10 pointer-events-none">
                    {isTarget ? 'TARGET' : ent.id}
                    <span className="ml-1 text-slate-400">
                      {isMultiViewActive && ent.metricDepth?.metricZ !== undefined
                        ? `${ent.metricDepth.metricZ.toFixed(2)}m`
                        : `z:${ent.position.z.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* B. Frontal Camera Projection (X-Y Plane) */}
        {projection === 'FRONTAL_XY' && (
          <div className="absolute inset-0 p-4">
            <svg className="absolute inset-0 h-full w-full pointer-events-none">
              {filteredRelationships.map((rel, idx) => {
                const src = worldModel.entities[rel.sourceId];
                const tgt = worldModel.entities[rel.targetId];
                if (!src || !tgt) return null;

                const x1 = Math.max(8, Math.min(92, src.position.x * 100));
                const y1 = Math.max(8, Math.min(92, src.position.y * 100));
                const x2 = Math.max(8, Math.min(92, tgt.position.x * 100));
                const y2 = Math.max(8, Math.min(92, tgt.position.y * 100));

                return (
                  <line
                    key={`front_edge_${idx}`}
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke={rel.relation === 'OCCLUDING' ? 'rgba(244,63,94,0.7)' : 'rgba(255,255,255,0.1)'}
                    strokeWidth={rel.relation === 'OCCLUDING' ? 2 : 1}
                  />
                );
              })}
            </svg>

            {entities.map((ent) => {
              const isTarget = ent.isTarget;
              const isSelected = ent.id === selectedEntityId;
              const isHighlighted = highlightedEntityIds.has(ent.id);
              const left = Math.max(8, Math.min(92, ent.position.x * 100));
              const top = Math.max(8, Math.min(92, ent.position.y * 100));

              return (
                <div
                  key={ent.id}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform group ${
                    isSelected ? 'scale-125 z-30' : isHighlighted ? 'scale-115 z-20' : 'hover:scale-125 z-10'
                  }`}
                  onClick={() => onSelectEntity && onSelectEntity(ent)}
                  onMouseEnter={() => setHoveredEntityId(ent.id)}
                  onMouseLeave={() => setHoveredEntityId(null)}
                >
                  <div
                    className={`h-6 w-6 rounded-lg flex items-center justify-center transition-all ${
                      isTarget
                        ? 'bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.9)] ring-2 ring-cyan-200 animate-pulse'
                        : ent.isOccluded
                        ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] ring-1 ring-rose-300'
                        : 'bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.6)] ring-1 ring-violet-300'
                    }`}
                  >
                    <span className="text-[9px] font-mono font-bold text-black">
                      {isTarget ? 'T' : ent.id.slice(-2)}
                    </span>
                  </div>

                  <span className="absolute left-1/2 -top-5 -translate-x-1/2 bg-black/80 px-1 rounded text-[9px] font-mono text-slate-200 pointer-events-none whitespace-nowrap">
                    {ent.id} [{ent.position.x.toFixed(2)}, {ent.position.y.toFixed(2)}]
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* C. Relational Semantic Topology Graph */}
        {projection === 'RELATIONAL_TOPOLOGY' && (
          <div className="absolute inset-0 p-4">
            <svg className="absolute inset-0 h-full w-full pointer-events-none">
              {filteredRelationships.slice(0, 16).map((rel, idx) => {
                const srcIdx = entities.findIndex((e) => e.id === rel.sourceId);
                const tgtIdx = entities.findIndex((e) => e.id === rel.targetId);
                if (srcIdx < 0 || tgtIdx < 0) return null;

                const total = Math.max(1, entities.length);
                const angle1 = (srcIdx / total) * 2 * Math.PI;
                const angle2 = (tgtIdx / total) * 2 * Math.PI;

                const cx = 50;
                const cy = 50;
                const radius = 34;

                const x1 = cx + radius * Math.cos(angle1);
                const y1 = cy + radius * Math.sin(angle1);
                const x2 = cx + radius * Math.cos(angle2);
                const y2 = cy + radius * Math.sin(angle2);

                return (
                  <g key={`topo_edge_${idx}`}>
                    <line
                      x1={`${x1}%`}
                      y1={`${y1}%`}
                      x2={`${x2}%`}
                      y2={`${y2}%`}
                      stroke={
                        rel.relation === 'APPROACHING'
                          ? 'rgba(245,158,11,0.6)'
                          : rel.relation === 'OCCLUDING'
                          ? 'rgba(244,63,94,0.6)'
                          : 'rgba(56,189,248,0.3)'
                      }
                      strokeWidth={1.5}
                      strokeDasharray={rel.relation === 'APPROACHING' ? '3 3' : undefined}
                    />
                  </g>
                );
              })}
            </svg>

            {entities.map((ent, idx) => {
              const total = Math.max(1, entities.length);
              const angle = (idx / total) * 2 * Math.PI;
              const cx = 50;
              const cy = 50;
              const radius = 34;
              const left = cx + radius * Math.cos(angle);
              const top = cy + radius * Math.sin(angle);
              const isTarget = ent.isTarget;

              return (
                <div
                  key={ent.id}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  onClick={() => onSelectEntity && onSelectEntity(ent)}
                  onMouseEnter={() => setHoveredEntityId(ent.id)}
                  onMouseLeave={() => setHoveredEntityId(null)}
                >
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center font-mono text-[9px] font-bold ${
                      isTarget
                        ? 'bg-cyan-400 text-black shadow-[0_0_14px_rgba(34,211,238,0.9)] animate-pulse'
                        : 'bg-slate-800 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {isTarget ? 'TGT' : ent.id.slice(-2)}
                  </div>
                  <span className="absolute left-1/2 -top-5 -translate-x-1/2 bg-black/80 px-1 rounded text-[9px] font-mono text-slate-200 pointer-events-none whitespace-nowrap">
                    {ent.id}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* D. Stereo Feature Matches (Dual-Camera View Correspondence) */}
        {projection === 'STEREO_FEATURE_MATCHES' && (
          <div className="absolute inset-0 p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 border-b border-white/[0.04] pb-1">
              <span className="text-cyan-400 font-bold">VIEW A (Primary Left Optical Center)</span>
              <span className="text-emerald-400 font-bold">
                VIEW B (Displaced Right Baseline B=0.25m)
              </span>
            </div>

            {/* Split Screen Stereo Keypoint Lines */}
            <div className="relative flex-1 my-1 flex">
              <div className="w-1/2 h-full border-r border-white/[0.1] bg-cyan-950/10 flex items-center justify-center">
                <span className="text-[10px] font-mono text-cyan-300/40">Camera 1 (Left)</span>
              </div>
              <div className="w-1/2 h-full bg-emerald-950/10 flex items-center justify-center">
                <span className="text-[10px] font-mono text-emerald-300/40">Camera 2 (Right)</span>
              </div>

              {/* Matched Feature Vectors */}
              <svg className="absolute inset-0 h-full w-full pointer-events-none">
                {featureReport &&
                  featureReport.inlierMatches.slice(0, 14).map((m, idx) => {
                    // Left view ptA mapped to [0..50% width]
                    const x1 = m.ptA.x * 50;
                    const y1 = m.ptA.y * 100;
                    // Right view ptB mapped to [50%..100% width]
                    const x2 = 50 + m.ptB.x * 50;
                    const y2 = m.ptB.y * 100;

                    return (
                      <g key={`feat_${idx}`}>
                        <circle cx={`${x1}%`} cy={`${y1}%`} r={2} fill="#06b6d4" />
                        <circle cx={`${x2}%`} cy={`${y2}%`} r={2} fill="#10b981" />
                        <line
                          x1={`${x1}%`}
                          y1={`${y1}%`}
                          x2={`${x2}%`}
                          y2={`${y2}%`}
                          stroke="rgba(34,211,238,0.5)"
                          strokeWidth={1}
                        />
                      </g>
                    );
                  })}
              </svg>
            </div>

            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 bg-black/40 px-2 py-1 rounded">
              <span>Matched Pairs: <strong className="text-cyan-300">{featureReport?.matches.length ?? 0}</strong></span>
              <span>Inliers: <strong className="text-emerald-300">{featureReport?.inlierMatches.length ?? 0} ({featureReport ? Math.round(featureReport.inlierRatio * 100) : 0}%)</strong></span>
              <span>Mean Disparity: <strong className="text-amber-300">{featureReport?.meanDisparityPx ?? 0} px</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Natural Multi-Object Reasoning Terminal */}
      <div className="mt-3 rounded-xl bg-black/30 border border-white/[0.04] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] pb-2 mb-2">
          <span className="font-mono text-[10px] uppercase font-bold text-slate-300">
            Multi-Object Spatial Reasoning Queries
          </span>
          <div className="flex flex-wrap gap-1 font-mono text-[10px]">
            <button
              onClick={() => setActiveQuery('closest')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeQuery === 'closest'
                  ? 'bg-emerald-500/30 text-emerald-300 font-bold'
                  : 'text-slate-400 hover:text-white bg-white/[0.02]'
              }`}
            >
              Q1: Closest Object
            </button>
            <button
              onClick={() => setActiveQuery('moved')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeQuery === 'moved'
                  ? 'bg-emerald-500/30 text-emerald-300 font-bold'
                  : 'text-slate-400 hover:text-white bg-white/[0.02]'
              }`}
            >
              Q2: Moving Entities
            </button>
            <button
              onClick={() => setActiveQuery('approaching')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeQuery === 'approaching'
                  ? 'bg-emerald-500/30 text-emerald-300 font-bold'
                  : 'text-slate-400 hover:text-white bg-white/[0.02]'
              }`}
            >
              Q3: Approaching Pairs & TCA
            </button>
            <button
              onClick={() => setActiveQuery('occlusion_chains')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeQuery === 'occlusion_chains'
                  ? 'bg-emerald-500/30 text-emerald-300 font-bold'
                  : 'text-slate-400 hover:text-white bg-white/[0.02]'
              }`}
            >
              Q4: Occlusion Chains
            </button>
            <button
              onClick={() => setActiveQuery('clusters')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeQuery === 'clusters'
                  ? 'bg-emerald-500/30 text-emerald-300 font-bold'
                  : 'text-slate-400 hover:text-white bg-white/[0.02]'
              }`}
            >
              Q5: Spatial Clusters
            </button>
            <button
              onClick={() => setActiveQuery('deltas')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeQuery === 'deltas'
                  ? 'bg-emerald-500/30 text-emerald-300 font-bold'
                  : 'text-slate-400 hover:text-white bg-white/[0.02]'
              }`}
            >
              Q6: Observation Deltas
            </button>
          </div>
        </div>

        {/* Live Evaluated Query Answers */}
        <div className="font-mono text-[11px] text-slate-300">
          {activeQuery === 'closest' && (
            <div>
              <span className="text-slate-400">Query: </span>
              <span className="text-emerald-300 font-semibold">Which entity is currently closest in relative/metric space to Target?</span>
              <div className="mt-1">
                {closestResult.entity ? (
                  <div className="space-y-0.5">
                    <p>
                      &bull; Entity <strong className="text-white">{closestResult.entity.id}</strong> ({closestResult.entity.label})
                    </p>
                    <p className="text-slate-400 text-[10px]">
                      2D image distance: <strong className="text-slate-200">{(closestResult.distance2D * 100).toFixed(1)}% FOV</strong> |
                      Relative 3D distance: <strong className="text-slate-200">{closestResult.distance3D.toFixed(3)}</strong>
                      {closestResult.metricDistanceMeters !== undefined && (
                        <span className="text-cyan-300 font-bold ml-1">
                          | Reconstructed Metric Distance: {closestResult.metricDistanceMeters}m
                        </span>
                      )}
                    </p>
                  </div>
                ) : (
                  <span className="text-slate-500">Target entity is currently occluded or unconfirmed.</span>
                )}
              </div>
            </div>
          )}

          {activeQuery === 'moved' && (
            <div>
              <span className="text-slate-400">Query: </span>
              <span className="text-emerald-300 font-semibold">Which objects exhibit non-zero velocity across frames?</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {movedResult.length > 0 ? (
                  movedResult.map((m) => (
                    <span key={m.entity.id} className="rounded bg-black/50 border border-white/10 px-2 py-0.5 text-[10px]">
                      {m.entity.id}: 2D speed={m.speed2D.toFixed(3)} heading={m.direction}
                      {m.speedMetricMps !== undefined && (
                        <strong className="text-cyan-300 ml-1">({m.speedMetricMps.toFixed(2)} m/s)</strong>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500">All entities currently stationary.</span>
                )}
              </div>
            </div>
          )}

          {activeQuery === 'approaching' && (
            <div>
              <span className="text-slate-400">Query: </span>
              <span className="text-emerald-300 font-semibold">Which entity pairs have converging relative velocity vectors?</span>
              <div className="mt-1 space-y-1">
                {approachingResult.length > 0 ? (
                  approachingResult.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <span className="text-amber-400 font-bold">{p.source} &rarr; {p.target}</span>
                      <span className="text-slate-400">Dist: {(p.distance2D * 100).toFixed(1)}% FOV</span>
                      <span className="text-slate-400">TCA: {p.tcaFrames} frames</span>
                      <span className={`px-1 rounded text-[9px] font-bold ${
                        p.collisionRisk === 'HIGH' ? 'bg-rose-500/30 text-rose-300' : 'bg-amber-500/30 text-amber-300'
                      }`}>
                        {p.collisionRisk} RISK
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-500">No convergent collision/occlusion vectors detected.</span>
                )}
              </div>
            </div>
          )}

          {activeQuery === 'occlusion_chains' && (
            <div>
              <span className="text-slate-400">Query: </span>
              <span className="text-emerald-300 font-semibold">Multi-hop directional occlusion graph along line of sight</span>
              <div className="mt-1 space-y-1">
                {occlusionChains.length > 0 ? (
                  occlusionChains.map((c, i) => (
                    <div key={i} className="text-[10px] flex items-center gap-2">
                      <span className="text-rose-400 font-semibold">{c.occluder}</span>
                      <span className="text-slate-400">&rarr; occludes &rarr;</span>
                      <span className="text-slate-200">{c.occluded}</span>
                      <span className="text-slate-500">(rel depth gap: {c.depthGap.toFixed(2)})</span>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-500">No active multi-hop occlusion overlap currently present.</span>
                )}
              </div>
            </div>
          )}

          {activeQuery === 'clusters' && (
            <div>
              <span className="text-slate-400">Query: </span>
              <span className="text-emerald-300 font-semibold">Spatial clusters / object groupings in visual field</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {clustersResult.length > 0 ? (
                  clustersResult.map((c) => (
                    <div key={c.clusterId} className="rounded bg-black/50 border border-white/10 px-2 py-1 text-[10px]">
                      <span className="text-emerald-400 font-bold">Cluster #{c.clusterId}:</span>{' '}
                      <span className="text-slate-300">{c.members.join(', ')}</span>{' '}
                      <span className="text-slate-500">centroid=({c.centroid.x.toFixed(2)}, {c.centroid.y.toFixed(2)})</span>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-500">No spatial groupings detected.</span>
                )}
              </div>
            </div>
          )}

          {activeQuery === 'deltas' && (
            <div>
              <span className="text-slate-400">Query: </span>
              <span className="text-emerald-300 font-semibold">Topological changes between consecutive observation cycles</span>
              <div className="mt-1 space-y-0.5">
                {deltasResult.length > 0 ? (
                  deltasResult.map((d, i) => <div key={i} className="text-[10px]">&bull; {d}</div>)
                ) : (
                  <span className="text-slate-500">No topological transitions in current cycle.</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Active Entity Modal / Modality Breakdown Card */}
      {activeEntity && (
        <div className="mt-3 rounded-xl bg-slate-900/50 border border-white/[0.06] p-3">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 mb-2">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${activeEntity.isTarget ? 'bg-cyan-400 animate-pulse' : 'bg-violet-400'}`} />
              <span className="font-mono font-bold text-slate-200">
                Selected Entity: {activeEntity.id} ({activeEntity.label})
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400">
              Confidence: <strong className="text-emerald-300">{Math.round(activeEntity.confidence * 100)}%</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono text-[10px]">
            {/* Column 1: 2D Position */}
            <div className="rounded bg-black/40 p-2 border border-emerald-500/20">
              <span className="text-emerald-400 font-bold block mb-1">1. 2D IMAGE PLANE</span>
              <p className="text-slate-300">Norm: [{activeEntity.position.x.toFixed(3)}, {activeEntity.position.y.toFixed(3)}]</p>
              <p className="text-slate-400">Pixels: [{Math.round(activeEntity.position.x * 640)}, {Math.round(activeEntity.position.y * 400)}] px</p>
              <p className="text-slate-400">Box: {Math.round(activeEntity.boundingBox.width * 640)}x{Math.round(activeEntity.boundingBox.height * 400)} px</p>
            </div>

            {/* Column 2: Relative Monocular Depth */}
            <div className="rounded bg-black/40 p-2 border border-amber-500/20">
              <span className="text-amber-400 font-bold block mb-1">2. RELATIVE MONOCULAR DEPTH</span>
              <p className="text-slate-300">Relative Depth: <strong className="text-amber-300">{activeEntity.position.z.toFixed(3)}</strong> [0..1]</p>
              <p className="text-slate-400">Source: Scale + Ground Contact Prior</p>
              <p className="text-slate-500 text-[9px]">Unitless rank-based depth only.</p>
            </div>

            {/* Column 3: True Metric Depth */}
            <div className={`rounded p-2 border ${
              isMultiViewActive && activeEntity.metricDepth?.isReconstructed
                ? 'bg-cyan-950/40 border-cyan-500/40'
                : 'bg-black/40 border-slate-700/40'
            }`}>
              <span className={`font-bold block mb-1 ${
                isMultiViewActive && activeEntity.metricDepth?.isReconstructed ? 'text-cyan-400' : 'text-slate-400'
              }`}>
                3. TRUE METRIC DEPTH
              </span>
              {isMultiViewActive && activeEntity.metricDepth?.isReconstructed ? (
                <>
                  <p className="text-cyan-200">
                    X={activeEntity.metricDepth.metricX}m, Y={activeEntity.metricDepth.metricY}m
                  </p>
                  <p className="text-cyan-200 font-bold">
                    Z (Depth) = {activeEntity.metricDepth.metricZ} m
                  </p>
                  <p className="text-slate-400 text-[9px]">
                    Disparity: {activeEntity.metricDepth.disparityPx}px | Reproj Err: {activeEntity.metricDepth.reprojectionErrorPx}px
                  </p>
                </>
              ) : (
                <>
                  <p className="text-slate-400">NOT RECONSTRUCTED</p>
                  <p className="text-slate-500 text-[9px]">
                    Monocular uncalibrated camera. Metric 3D is not claimed.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. Bottom Benchmark Metrics Strip */}
      <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-slate-400">
        <div>
          Active Predicates: <strong className="text-slate-200">{spatialMetrics.spatialRelationshipCount}</strong>
        </div>
        <div>
          Depth Consistency: <strong className="text-emerald-400">{spatialMetrics.relativeDepthConsistency}%</strong>
        </div>
        <div>
          Reasoning Latency: <strong className="text-slate-200">{spatialMetrics.multiObjectReasoningLatencyMs} ms</strong>
        </div>
        <div>
          Feature Matches: <strong className="text-cyan-400">{spatialMetrics.featureMatchCount} ({spatialMetrics.featureMatchInlierRate}% inliers)</strong>
        </div>
        <div>
          Metric 3D Status:{' '}
          <strong className={isMultiViewActive ? 'text-cyan-300' : 'text-slate-500'}>
            {isMultiViewActive ? `ACTIVE (Err: ${spatialMetrics.metricReprojectionErrorPx ?? 0}px)` : 'MONOCULAR (Relative)'}
          </strong>
        </div>
      </div>
    </div>
  );
};
