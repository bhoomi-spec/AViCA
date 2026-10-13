/**
 * Types & Interfaces for AViCA Learned Observation Policy (Q-Learning)
 *
 * State Dimensions:
 * 1. uncertainty: [0, 1] epistemic uncertainty score
 * 2. candidate count: integer (0, 1, 2, 3+)
 * 3. target confidence: [0, 1] target confidence
 * 4. motion: [0, 1] velocity magnitude / dynamics
 * 5. occlusion probability: [0, 1] occlusion risk / overlap
 * 6. memory confidence: [0, 1] working memory track stability
 * 7. compute budget: [0, 1] normalized budget availability
 *
 * Action Set:
 * 1. FULL_FRAME
 * 2. ROI_SELECTION
 * 3. ZOOM
 * 4. TRACK
 * 5. EDGE_ANALYSIS
 * 6. FEATURE_MATCH
 * 7. DEPTH
 * 8. WAIT
 *
 * Reward:
 * task success + information gain - computation cost - latency - unnecessary observations
 */

import { ActionType, BenchmarkMetrics } from './avica';

export type LearnedPolicyAction =
  | 'FULL_FRAME'
  | 'ROI_SELECTION'
  | 'ZOOM'
  | 'TRACK'
  | 'EDGE_ANALYSIS'
  | 'FEATURE_MATCH'
  | 'DEPTH'
  | 'WAIT';

export const ALL_LEARNED_ACTIONS: LearnedPolicyAction[] = [
  'FULL_FRAME',
  'ROI_SELECTION',
  'ZOOM',
  'TRACK',
  'EDGE_ANALYSIS',
  'FEATURE_MATCH',
  'DEPTH',
  'WAIT',
];

/**
 * Mapping between LearnedPolicyAction and core AViCA ActionType
 */
export const LEARNED_ACTION_TO_AVICA_ACTION: Record<LearnedPolicyAction, ActionType> = {
  FULL_FRAME: 'PROCESS_FULL_FRAME',
  ROI_SELECTION: 'INSPECT_ROI',
  ZOOM: 'ZOOM',
  TRACK: 'TRACK_OBJECT',
  EDGE_ANALYSIS: 'RUN_EDGE_ANALYSIS',
  FEATURE_MATCH: 'RUN_FEATURE_MATCHING',
  DEPTH: 'RUN_DEPTH',
  WAIT: 'WAIT',
};

export const AVICA_ACTION_TO_LEARNED_ACTION: Record<ActionType, LearnedPolicyAction> = {
  PROCESS_FULL_FRAME: 'FULL_FRAME',
  INSPECT_ROI: 'ROI_SELECTION',
  ZOOM: 'ZOOM',
  TRACK_OBJECT: 'TRACK',
  RUN_EDGE_ANALYSIS: 'EDGE_ANALYSIS',
  RUN_FEATURE_MATCHING: 'FEATURE_MATCH',
  RUN_DEPTH: 'DEPTH',
  WAIT: 'WAIT',
  // Fallbacks for specialized actions
  RUN_SIFT: 'FEATURE_MATCH',
  RUN_SEGMENTATION: 'EDGE_ANALYSIS',
  RUN_OPTICAL_FLOW: 'TRACK',
  INCREASE_FPS: 'TRACK',
  DECREASE_FPS: 'WAIT',
  QUERY_MEMORY: 'WAIT',
  QUERY_WORLD_MODEL: 'WAIT',
  REQUEST_SECOND_VIEW: 'DEPTH',
  REQUEST_HUMAN_REVIEW: 'FULL_FRAME',
  STOP: 'WAIT',
};

/**
 * 7-Dimensional Continuous / Observable State
 */
export interface PolicyState {
  uncertainty: number; // 0..1 epistemic uncertainty
  candidateCount: number; // 0, 1, 2, 3+
  targetConfidence: number; // 0..1 confidence in target
  motion: number; // 0..1 target velocity magnitude
  occlusionProbability: number; // 0..1 occlusion risk / overlap
  memoryConfidence: number; // 0..1 visual working memory stability
  computeBudget: number; // 0..1 normalized frame budget
}

/**
 * Discretized State representation for tabular Q-learning
 */
export interface DiscretizedPolicyState {
  uncertaintyBin: number; // 0: low (<0.3), 1: med (0.3-0.7), 2: high (>0.7)
  candidateCountBin: number; // 0: 0, 1: 1, 2: 2, 3: >=3
  targetConfidenceBin: number; // 0: low (<0.4), 1: med (0.4-0.75), 2: high (>=0.75)
  motionBin: number; // 0: static (<0.1), 1: moderate (0.1-0.35), 2: rapid (>0.35)
  occlusionBin: number; // 0: clear (<0.2), 1: partial (0.2-0.6), 2: occluded (>0.6)
  memoryConfidenceBin: number; // 0: low (<0.3), 1: moderate (0.3-0.75), 2: solid (>=0.75)
  computeBudgetBin: number; // 0: constrained (<0.35), 1: medium (0.35-0.7), 2: abundant (>=0.7)
  key: string; // concise serialized key for tabular lookup
}

/**
 * Reward decomposition matching the scientific requirement:
 * task success + information gain - computation cost - latency - unnecessary observations
 */
export interface RewardBreakdown {
  taskSuccess: number;
  informationGain: number;
  computationCost: number;
  latency: number;
  unnecessaryObservations: number;
  netReward: number;
}

/**
 * Single Episode Training Curve Telemetry Point
 */
export interface PolicyTrainingCurvePoint {
  episode: number;
  totalSteps: number;
  cumulativeReward: number;
  averageRewardPerStep: number;
  totalInfoGain: number;
  totalComputeCost: number;
  averageLatency: number;
  taskSuccessRate: number; // 0..100%
  tdError: number; // mean Bellman TD loss
  epsilon: number;
  actionCounts: Record<LearnedPolicyAction, number>;
}

/**
 * Training Hyperparameters
 */
export interface PolicyTrainingConfig {
  episodes: number;
  stepsPerEpisode: number;
  learningRate: number; // alpha
  discountFactor: number; // gamma
  initialEpsilon: number;
  minEpsilon: number;
  epsilonDecay: number;
  seed: number;
}

/**
 * Head-to-Head Comparison Result: AViCA Learned Policy vs AViCA Greedy
 */
export interface PolicyComparisonResult {
  seed: number;
  frames: number;
  greedyResult: {
    metrics: BenchmarkMetrics;
    cumulativeReward: number;
    actionCounts: Record<LearnedPolicyAction, number>;
    runtimeMs: number;
  };
  learnedResult: {
    metrics: BenchmarkMetrics;
    cumulativeReward: number;
    actionCounts: Record<LearnedPolicyAction, number>;
    runtimeMs: number;
  };
  deltas: {
    detectionAccuracyDelta: number; // learned - greedy
    trackingAccuracyDelta: number;
    recoveryAccuracyDelta: number;
    observationsDelta: number;
    computationCostDelta: number;
    latencyDelta: number;
    fpsDelta: number;
    cumulativeRewardDelta: number;
  };
  completedAt: string;
}
