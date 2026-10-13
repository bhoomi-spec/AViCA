import React from 'react';
import { SpatialWorldModel } from '../types/avica';
import { SpatialWorldModelEngine } from '../spatial/spatial_world_model';
import { VisualSpatialGraph } from './VisualSpatialGraph';

interface SpatialWorldModelPanelProps {
  worldModel: SpatialWorldModel;
  spatialEngine: SpatialWorldModelEngine;
  onSelectEntity?: (entity: any) => void;
  selectedEntityId?: string;
  onToggleMultiView?: (enabled: boolean) => void;
}

export const SpatialWorldModelPanel: React.FC<SpatialWorldModelPanelProps> = ({
  worldModel,
  spatialEngine,
  onSelectEntity,
  selectedEntityId,
  onToggleMultiView,
}) => {
  return (
    <VisualSpatialGraph
      worldModel={worldModel}
      spatialEngine={spatialEngine}
      onSelectEntity={onSelectEntity}
      selectedEntityId={selectedEntityId}
      onToggleMultiView={onToggleMultiView}
    />
  );
};
