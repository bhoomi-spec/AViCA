/**
 * Learned Policy Network for AViCA Active Perception
 *
 * Exposes LearnedActivePerceptionPolicy powered by the underlying QLearningObservationPolicy.
 * Evaluates the 7-dimensional state:
 * - uncertainty [0..1]
 * - candidateCount [0, 1, 2, 3+]
 * - targetConfidence [0..1]
 * - motion dynamics [0..1]
 * - occlusionProbability [0..1]
 * - memoryConfidence [0..1]
 * - computeBudget [0..1]
 *
 * Over the 8 candidate actions:
 * - FULL_FRAME
 * - ROI_SELECTION
 * - ZOOM
 * - TRACK
 * - EDGE_ANALYSIS
 * - FEATURE_MATCH
 * - DEPTH
 * - WAIT
 *
 * Reward:
 * task success + information gain - computation cost - latency - unnecessary observations
 */

import {
  AgentActionDecision,
  CandidateRegion,
  EpistemicUncertaintyState,
  WorkingMemoryEntity,
} from '../types/avica';
import { QLearningObservationPolicy, sharedQLearningPolicy } from './q_learning_policy';

export class LearnedActivePerceptionPolicy {
  private qPolicy: QLearningObservationPolicy;

  constructor(policy: QLearningObservationPolicy = sharedQLearningPolicy) {
    this.qPolicy = policy;
  }

  /**
   * Evaluates the learned policy network and selects the utility-optimal action.
   */
  public selectBestAction(
    uncertainty: EpistemicUncertaintyState,
    candidates: CandidateRegion[],
    targetEntity?: WorkingMemoryEntity,
    _priorPlannedAction?: string,
    _priorActionResult?: {
      action: string;
      success: boolean;
      evidenceSummary: string;
      candidateId?: string;
    },
    computeBudget = 1.0
  ): AgentActionDecision {
    return this.qPolicy.selectBestAction(
      uncertainty,
      candidates,
      targetEntity,
      computeBudget
    );
  }

  public getUnderlyingQPolicy(): QLearningObservationPolicy {
    return this.qPolicy;
  }
}
