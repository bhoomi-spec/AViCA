/**
 * AViCA: Adaptive Visual Cognitive Architecture
 * Research-Grade Computer Vision & Cognitive Architecture Type System
 */

export type ActionType =
  | 'PROCESS_FULL_FRAME'
  | 'INSPECT_ROI'
  | 'ZOOM'
  | 'INCREASE_FPS'
  | 'DECREASE_FPS'
  | 'TRACK_OBJECT'
  | 'RUN_EDGE_ANALYSIS'
  | 'RUN_SIFT'
  | 'RUN_FEATURE_MATCHING'
  | 'RUN_SEGMENTATION'
  | 'RUN_DEPTH'
  | 'RUN_OPTICAL_FLOW'
  | 'QUERY_MEMORY'
  | 'QUERY_WORLD_MODEL'
  | 'REQUEST_SECOND_VIEW'
  | 'REQUEST_HUMAN_REVIEW'
  | 'WAIT'
  | 'STOP';

export type BaselineMode =
  | 'PASSIVE_VISION'
  | 'ATTENTION_VISION'
  | 'AVICA_GREEDY'
  | 'AVICA_LEARNED'
  | 'AVICA_ACTIVE';

export type AblationCondition =
  | 'FULL_AVICA'
  | 'AVICA_NO_MEMORY'
  | 'AVICA_NO_UNCERTAINTY'
  | 'AVICA_NO_ACTIVE_PERCEPTION'
  | 'AVICA_NO_PREDICTION'
  | 'AVICA_NO_SPATIAL_MODEL'
  | 'AVICA_NO_LEARNED_POLICY';

export interface AblationConfig {
  condition: AblationCondition;
  enableWorkingMemory: boolean;
  enableUncertainty: boolean;
  enableActivePerception: boolean;
  enablePrediction: boolean;
  enableSpatialModel: boolean;
  enableLearnedPolicy: boolean;
}

export interface BoundingBox {
  x: number; // 0..1 normalized or pixels
  y: number;
  width: number;
  height: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number; // relative depth metric
}

export interface VisualObservation {
  frameId: number;
  timestamp: number;
  width: number;
  height: number;
  sampledRoi?: BoundingBox;
  zoomLevel: number;
  fps: number;
  rawFeatureCount: number;
  meanIntensity: number;
  contrastScore: number;
}

export interface CandidateRegion {
  id: string;
  box: BoundingBox;
  salienceScore: number;
  targetProbability: number;
  featureSimilarity: number;
  isInspected: boolean;
  status: 'PENDING' | 'INSPECTED' | 'REJECTED' | 'CONFIRMED_TARGET';
  colorFeatures?: {
    hue: number;
    saturation: number;
    brightness: number;
    colorMatchScore: number;
  };
  shapeFeatures?: {
    circularity: number;
    aspectRatio: number;
    area: number;
    perimeter: number;
    shapeMatchScore: number;
  };
  estimatedRelativeDepth?: number;
}

export interface PerceivedVisualState {
  frameId: number;
  timestamp: number;
  width: number;
  height: number;
  observation: VisualObservation;
  candidates: CandidateRegion[];
}

export interface GroundTruthEntity {
  id: string;
  name: string;
  isTarget: boolean;
  isDistractor: boolean;
  position: Vector3D;
  size: number;
  isOccluded: boolean;
  box: BoundingBox;
}

export interface GroundTruthState {
  frameId: number;
  timestamp: number;
  target: GroundTruthEntity | null;
  entities: GroundTruthEntity[];
  occluder: BoundingBox;
}

export type TrackingLifecycleState =
  | 'INITIALIZED'
  | 'DETECTED'
  | 'TRACKING'
  | 'OCCLUDED'
  | 'MEMORY_RETAINED'
  | 'PREDICTION'
  | 'ACTIVE_SEARCH'
  | 'RECOVERED'
  | 'LOST';

export interface KalmanStateEstimate {
  x: number;
  y: number;
  vx: number;
  vy: number;
  covarianceTrace: number;
  positionVariance: number;
}

export interface AppearanceMemoryData {
  meanEmbedding: number[];
  sampleCount: number;
  hue: number;
  circularity: number;
  lastUpdated: number;
}

export interface WorkingMemoryEntity {
  id: string;
  label: string;
  visualEmbedding: number[]; // e.g. 8-dim color/shape descriptor
  position: Vector3D;
  velocity: Vector3D;
  boundingBox: BoundingBox;
  confidence: number; // 0..1
  epistemicUncertainty: number; // 0..1
  previousState: string;
  currentState: string;
  trackingLifecycleState?: TrackingLifecycleState;
  kalmanState?: KalmanStateEstimate;
  appearanceMemory?: AppearanceMemoryData;
  observedAction: string;
  relationships: string[];
  firstObservedTimestamp: number;
  lastObservedTimestamp: number;
  observationCount: number;
  consecutiveFramesTracked?: number;
  consecutiveFramesOccluded?: number;
  decayRate: number; // per frame
  isTarget: boolean;
  isOccluded: boolean;
  predictedReemergenceRoi?: BoundingBox;
  searchAttempts?: number;
  position2D?: Position2D;
  relativeDepth?: RelativeMonocularDepth;
  metricDepth?: TrueMetricDepth;
  spatialVelocity?: SpatialVelocity;
}

export interface Position2D {
  x: number; // 0..1 normalized image-plane coordinates
  y: number; // 0..1 normalized image-plane coordinates
  pixelX?: number; // pixel coords in viewport
  pixelY?: number;
}

export interface RelativeMonocularDepth {
  depth: number; // 0..1 unitless rank/relative depth (0 = closest, 1 = farthest)
  confidence: number; // 0..1 confidence in depth cues
  cueSource: 'SCALE_AND_GROUND_PLANE' | 'OCCLUSION_ORDER' | 'LINEAR_PERSPECTIVE';
  description: string; // explicit distinction statement
}

export interface TrueMetricDepth {
  isReconstructed: boolean; // TRUE only if multi-view/stereo triangulation was actually performed
  metricX?: number; // metric X in meters relative to camera
  metricY?: number; // metric Y in meters relative to camera
  metricZ?: number; // metric depth in meters relative to camera
  baselineMeters?: number; // stereo baseline (e.g. 0.25m)
  focalLengthPx?: number; // focal length in pixels (e.g. 640px)
  disparityPx?: number; // disparity between matched features
  reprojectionErrorPx?: number; // reprojection error residual
  method: 'STEREO_TRIANGULATION' | 'NONE_MONOCULAR_UNCALIBRATED';
  statusExplanation: string; // clear distinction warning/notice
}

export interface SpatialVelocity {
  vx2D: number; // normalized horizontal image velocity per sec
  vy2D: number; // normalized vertical image velocity per sec
  speed2D: number;
  vzRelative: number; // rate of change in relative depth per sec
  // Metric velocities (meters/sec) - populated ONLY when true metric depth is reconstructed:
  vxMetric?: number;
  vyMetric?: number;
  vzMetric?: number;
  speedMetricMps?: number;
}

export interface FeatureKeypoint {
  id: string;
  x: number; // 0..1
  y: number; // 0..1
  pixelX: number;
  pixelY: number;
  response: number;
  descriptor: number[]; // 16-dim normalized intensity/spatial gradient descriptor
  entityId?: string;
}

export interface FeatureMatch {
  indexA: number;
  indexB: number;
  ptA: { x: number; y: number; pixelX: number; pixelY: number };
  ptB: { x: number; y: number; pixelX: number; pixelY: number };
  distance: number;
  ratio: number; // Lowe's ratio test: d1 / d2
  isInlier: boolean; // passed epipolar consistency check
  disparityPx: number;
  entityId?: string;
}

export interface FeatureMatchingReport {
  keypointsViewA: FeatureKeypoint[];
  keypointsViewB: FeatureKeypoint[];
  matches: FeatureMatch[];
  inlierMatches: FeatureMatch[];
  inlierRatio: number;
  meanDisparityPx: number;
  meanDescriptorDistance: number;
  timestamp: number;
}

export interface ReconstructedEntityMetric3D {
  id: string;
  label: string;
  x2D: number;
  y2D: number;
  relativeMonocularDepth: number;
  disparityPx: number;
  metricX: number; // in meters
  metricY: number;
  metricZ: number; // in meters
  reprojectionErrorPx: number;
  confidence: number;
}

export interface MultiViewReconstructionReport {
  status: 'ACTIVE_STEREO_RECONSTRUCTED' | 'MONOCULAR_RELATIVE_ONLY';
  isMetricReconstructed: boolean;
  cameraBaselineMeters: number; // 0.25m
  focalLengthPx: number; // 640px
  principalPoint: { cx: number; cy: number };
  reconstructedEntities: Record<string, ReconstructedEntityMetric3D>;
  meanReprojectionErrorPx?: number;
  featureReport?: FeatureMatchingReport;
  distinctionNotice: string;
}

export interface SpatialRelationship {
  sourceId: string;
  targetId: string;
  relation:
    | 'LEFT_OF'
    | 'RIGHT_OF'
    | 'ABOVE'
    | 'BELOW'
    | 'CLOSER_THAN'
    | 'FARTHER_THAN'
    | 'EQUIDISTANT'
    | 'APPROACHING'
    | 'RECEDING'
    | 'OCCLUDING'
    | 'OCCLUDED_BY'
    | 'ADJACENT'
    | 'COLLINEAR';
  distance2D: number;
  distance3D: number; // relative Euclidean distance (or metric Euclidean distance if reconstructed)
  confidence: number;
  deltaDepthRelative?: number;
  deltaDepthMetric?: number; // only if metric reconstructed
  explanation?: string;
}

export interface DepthModalityStatus {
  has2DPositions: boolean;
  hasRelativeMonocularDepth: boolean;
  hasTrueMetricDepth: boolean;
  activeMode: 'MONOCULAR' | 'EXPERIMENTAL_MULTIVIEW';
  explanation: string;
}

export interface SpatialWorldModel {
  timestamp: number;
  entities: Record<string, WorkingMemoryEntity>;
  relationships: SpatialRelationship[];
  targetId: string | null;
  sceneBounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  depthModalityStatus?: DepthModalityStatus;
  multiViewReconstruction?: MultiViewReconstructionReport;
  featureMatching?: FeatureMatchingReport;
  occlusionChains?: Array<{ occluderId: string; occludedId: string; depthGap: number }>;
  spatialClusters?: Array<{ clusterId: number; entityIds: string[]; centroid: Vector3D }>;
}

export interface EpistemicUncertaintyState {
  targetProbability: number; // 0..1
  confidence: number; // 0..1
  uncertaintyScore: number; // 1 - confidence
  ambiguityScore: number; // entropy among top candidate visual matches
  missingEvidenceScore: number; // missing fine-grained edge/descriptor confirmation
  isEvidenceSufficient: boolean; // threshold comparison
  sufficientThreshold: number;
  lastUpdatedFrame: number;
}

export interface PredictionStep {
  stepOffset: number; // 1, 2, 3, 4 (representing t+1, t+2, t+3, t+4)
  targetFrame: number; // frameId + stepOffset
  predictedPos: Vector3D;
  predictedBox: BoundingBox;
  confidence: number; // 0..1, calculated based on Kalman covariance propagation
  positionVariance: number; // propagated Kalman variance
  actualObservedPos?: Vector3D | null; // filled when targetFrame is observed
  predictionError?: number | null; // Euclidean distance ||actual - predicted||
  evaluated: boolean;
}

export interface PredictionGhost {
  step: number; // 1, 2, 3, 4
  position: Vector3D;
  boundingBox: BoundingBox;
  confidence: number;
  label: string; // "t+1", "t+2", etc.
  variance: number;
}

export interface HorizonPredictionMetrics {
  stepOffset: number; // 1, 2, 3, 4
  meanError: number; // running MAE of prediction error
  sampleCount: number;
  recentErrors: number[];
  confidence: number;
}

export interface PredictionState {
  horizon?: number; // e.g. 4 (predicts t+1, t+2, t+3, t+4)
  steps?: PredictionStep[]; // multi-step predictions for t+1, t+2, t+3, t+4
  predictedTargetPos: Vector3D | null; // t+1 pos for backward compatibility
  actualTargetPos: Vector3D | null;
  predictionError: number; // most recent t+1 prediction error
  meanPredictionError?: number; // overall mean error
  horizonMetrics?: Record<number, HorizonPredictionMetrics>; // metrics per horizon step (1..4)
  predictedTrajectory: Vector3D[];
  predictedGhosts?: PredictionGhost[];
  predictedNextState: string;
  actualNextState: string;
  occlusionImminent: boolean;
}

export interface AgentActionDecision {
  action: ActionType;
  targetRoi?: BoundingBox;
  candidateId?: string;
  reasoning: string;
  expectedInfoGain: number;
  computationCost: number;
  latencyCost: number;
  netUtility: number;
  actualInfoGain?: number;
  nextPlannedAction?: ActionType;
  nextActionRationale?: string;
}

export type TracePhase =
  | 'OBSERVE'
  | 'UNCERTAINTY'
  | 'DECIDE'
  | 'ACTION'
  | 'RESULT'
  | 'UPDATE'
  | 'NEXT_ACTION'
  | 'MEMORY_UPDATE';

export interface AgentTraceStep {
  stepId: number;
  frameId: number;
  timestamp: number;
  phase: TracePhase;
  details: string;
  actionExecuted?: ActionType;
  uncertaintyBefore?: number;
  uncertaintyAfter?: number;
  roi?: BoundingBox;
}

export interface BenchmarkMetrics {
  totalFrames: number;
  // Specific measured metrics required by scientific benchmark specification:
  detectionAccuracy: number; // 0..100% ground-truth target detection rate across frames
  trackingAccuracy: number; // 0..100% continuous tracking accuracy (<0.12 threshold)
  recoveryAccuracy: number; // 0..100% successful re-acquisition upon post-occlusion reemergence
  trackContinuity: number; // 0..100% preservation of unbroken track across time
  observations: number; // count of visual sensor/pipeline operations
  roiInspections: number; // count of fine-grained foveated ROI inspections
  latency: number; // average processing latency in milliseconds
  fps: number; // effective frames per second
  predictionError: number; // mean Euclidean prediction error across horizons
  recoveryTime: number; // average recovery time in frames following occlusion
  uncertaintyReduction: number; // mean epistemic uncertainty reduction (information gain)
  computationCost: number; // total accumulated computation cost units

  // Legacy/Extended metric aliases & spatial world model telemetry:
  observationsRequired: number;
  totalComputationCost: number;
  averageLatencyMs: number;
  effectiveFps: number;
  targetTrackingAccuracy: number;
  temporalConsistencyScore: number;
  meanPredictionError: number;
  predictionErrorT1?: number;
  predictionErrorT2?: number;
  predictionErrorT3?: number;
  predictionErrorT4?: number;
  predictionHorizon?: number;
  occlusionRecoverySuccesses: number;
  occlusionRecoveryAttempts: number;
  occlusionRecoveryRate?: number;
  meanTrackingConfidence?: number;
  meanUncertaintyReduction: number;
  spatialRelationshipCount?: number;
  relativeDepthConsistency?: number;
  multiObjectReasoningLatencyMs?: number;
  featureMatchCount?: number;
  featureMatchInlierRate?: number;
  metricReconstructionActive?: boolean;
  metricReprojectionErrorPx?: number;
}

export interface CognitiveCycleResult {
  observation: VisualObservation;
  candidates: CandidateRegion[];
  activeDecision: AgentActionDecision;
  uncertainty: EpistemicUncertaintyState;
  workingMemoryEntities: WorkingMemoryEntity[];
  worldModel: SpatialWorldModel;
  prediction: PredictionState;
  traceSteps: AgentTraceStep[];
  currentMode: BaselineMode;
  groundTruthTargetFound: boolean;
  metrics: BenchmarkMetrics;
  informationGain?: number;
  trackingLifecycle?: TrackingLifecycleState;
  detectedFaceGeometry?: DetectedFaceGeometry | null;
  lastActionResult?: {
    action: ActionType;
    success: boolean;
    evidenceSummary: string;
    actualInfoGain: number;
    computationCost: number;
    nextPlannedAction: ActionType;
  };
}

export interface FacialLandmarkPoint {
  id: string;
  label: string;
  zone: 'EYES' | 'NOSE' | 'MOUTH' | 'JAW' | 'BROWS' | 'CONTOUR';
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  pixelX: number;
  pixelY: number;
  confidence: number;
  motionVector?: { dx: number; dy: number };
}

export interface LandmarkConnection {
  fromId: string;
  toId: string;
  zone: 'EYES' | 'NOSE' | 'MOUTH' | 'JAW' | 'BROWS' | 'CONTOUR' | 'TRIANGULATION';
}

export interface DetectedFaceGeometry {
  isDetected: boolean;
  timestamp: number;
  frameId: number;
  boundingBox: BoundingBox;
  contour: Array<{ x: number; y: number }>;
  landmarks: FacialLandmarkPoint[];
  connections: LandmarkConnection[];
  centroid: { x: number; y: number };
  motionVector: { dx: number; dy: number; speed: number };
  trackingTrajectory: Array<{ x: number; y: number; timestamp: number }>;
  poseEstimate: {
    yawDeg: number;
    pitchDeg: number;
    rollDeg: number;
  };
  overallConfidence: number;
  isStale?: boolean;
  staleTimestamp?: number;
}

export interface CVLayerInfo {
  layer: number;
  name: string;
  category: string;
  status: 'ACTIVE_IN_PHASE1' | 'STUBBED_PHASE2' | 'READY_FOR_EVAL';
  description: string;
  computationalCost: number; // abstract cost weight
}
