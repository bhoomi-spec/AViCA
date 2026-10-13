/**
 * AViCA Q-Learning Observation Policy
 *
 * Implements tabular Q-learning with discretized state features and Bellman optimality updates:
 * Q(s, a) <- Q(s, a) + alpha * [ r + gamma * max_a' Q(s', a') - Q(s, a) ]
 *
 * State Dimensions:
 * - uncertainty [0..1]
 * - candidateCount [0, 1, 2, 3+]
 * - targetConfidence [0..1]
 * - motion [0..1]
 * - occlusionProbability [0..1]
 * - memoryConfidence [0..1]
 * - computeBudget [0..1]
 *
 * Actions:
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
import {
  ALL_LEARNED_ACTIONS,
  DiscretizedPolicyState,
  LEARNED_ACTION_TO_AVICA_ACTION,
  LearnedPolicyAction,
  PolicyState,
  PolicyTrainingCurvePoint,
  RewardBreakdown,
} from '../types/learned_policy';
import { ACTION_COST_TABLE } from './utility';

export class QLearningObservationPolicy {
  // Tabular Q-values: state key -> Record<LearnedPolicyAction, number>
  private qTable: Map<string, Record<LearnedPolicyAction, number>> = new Map();

  // Training curves historical log
  private trainingCurves: PolicyTrainingCurvePoint[] = [];

  // Default hyperparameters
  private learningRate = 0.15; // alpha
  private discountFactor = 0.90; // gamma

  constructor() {
    this.initializeDefaultPriors();
  }

  /**
   * Initializes baseline cognitive priors across characteristic state archetypes.
   * Ensures that prior to training, the policy operates with principled CV heuristics,
   * which are then systematically refined through Q-learning simulator experience.
   */
  public initializeDefaultPriors(): void {
    this.qTable.clear();

    // Iterate representative discretizations and populate inductive priors
    for (let u = 0; u < 3; u++) {
      for (let c = 0; c < 4; c++) {
        for (let tc = 0; tc < 3; tc++) {
          for (let m = 0; m < 3; m++) {
            for (let op = 0; op < 3; op++) {
              for (let mc = 0; mc < 3; mc++) {
                for (let cb = 0; cb < 3; cb++) {
                  const key = `u${u}_c${c}_tc${tc}_m${m}_op${op}_mc${mc}_cb${cb}`;
                  const values: Record<LearnedPolicyAction, number> = {
                    FULL_FRAME: 0.0,
                    ROI_SELECTION: 0.0,
                    ZOOM: 0.0,
                    TRACK: 0.0,
                    EDGE_ANALYSIS: 0.0,
                    FEATURE_MATCH: 0.0,
                    DEPTH: 0.0,
                    WAIT: 0.0,
                  };

                  // 1. FULL_FRAME: valuable when candidates are 0 and uncertainty is high
                  values.FULL_FRAME =
                    (u === 2 ? 1.4 : u === 1 ? 0.4 : -0.8) +
                    (c === 0 ? 1.6 : c === 1 ? -0.4 : -1.2) +
                    (cb === 0 ? -1.0 : cb === 2 ? 0.3 : 0.0) -
                    0.6; // cost penalty

                  // 2. ROI_SELECTION: valuable when candidates exist and need inspection
                  values.ROI_SELECTION =
                    (c >= 1 ? 1.5 : -2.0) +
                    (tc < 2 ? 1.2 : 0.2) +
                    (u >= 1 ? 1.0 : -0.2) +
                    (cb === 0 ? -0.4 : 0.2);

                  // 3. ZOOM: valuable when high uncertainty on faint candidate and abundant budget
                  values.ZOOM =
                    (c >= 1 ? 0.8 : -1.5) +
                    (u === 2 ? 1.1 : 0.1) +
                    (cb === 2 ? 0.8 : -1.2) -
                    0.5;

                  // 4. TRACK: optimal when target confidence is high, uncertainty low, target in motion
                  values.TRACK =
                    (tc === 2 ? 2.5 : tc === 1 ? 0.8 : -1.5) +
                    (u === 0 ? 1.8 : u === 1 ? 0.4 : -1.0) +
                    (m >= 1 ? 1.2 : 0.2) +
                    (op === 2 ? -2.0 : 0.4);

                  // 5. EDGE_ANALYSIS: helps when boundary evidence is missing and candidates are weak
                  values.EDGE_ANALYSIS =
                    (u >= 1 ? 0.9 : -0.5) +
                    (c <= 1 ? 1.0 : 0.0) +
                    (cb === 0 ? -0.8 : 0.1) -
                    0.4;

                  // 6. FEATURE_MATCH: resolves ambiguity when multiple candidates present
                  values.FEATURE_MATCH =
                    (c >= 2 ? 2.2 : c === 1 ? 0.9 : -2.0) +
                    (u >= 1 ? 1.1 : -0.2) +
                    (cb === 0 ? -1.1 : 0.3) -
                    0.8;

                  // 7. DEPTH: valuable when occlusion probability is moderate/high to resolve layering
                  values.DEPTH =
                    (op >= 1 ? 2.0 : -0.5) +
                    (c >= 1 ? 0.8 : -0.5) +
                    (cb === 0 ? -0.9 : 0.2) -
                    0.7;

                  // 8. WAIT: optimal when target is confident, stationary or predictable, and budget low
                  values.WAIT =
                    (tc === 2 && u === 0 ? 2.4 : -1.0) +
                    (m === 0 ? 1.2 : m === 1 ? 0.4 : -1.2) +
                    (cb === 0 ? 1.5 : 0.0) +
                    (mc === 2 ? 1.0 : -0.8);

                  this.qTable.set(key, values);
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Discretizes continuous 7-dimensional policy state into discrete bins
   */
  public discretizeState(state: PolicyState): DiscretizedPolicyState {
    // 1. uncertainty: low (<0.30), med (0.30-0.70), high (>0.70)
    const uBin = state.uncertainty < 0.3 ? 0 : state.uncertainty <= 0.7 ? 1 : 2;

    // 2. candidateCount: 0, 1, 2, >=3
    const cBin = Math.min(3, Math.max(0, Math.round(state.candidateCount)));

    // 3. targetConfidence: low (<0.40), med (0.40-0.75), high (>=0.75)
    const tcBin =
      state.targetConfidence < 0.4 ? 0 : state.targetConfidence < 0.75 ? 1 : 2;

    // 4. motion: static (<0.10), moderate (0.10-0.35), rapid (>0.35)
    const mBin = state.motion < 0.1 ? 0 : state.motion <= 0.35 ? 1 : 2;

    // 5. occlusionProbability: clear (<0.20), partial/approaching (0.20-0.60), occluded (>0.60)
    const opBin =
      state.occlusionProbability < 0.2
        ? 0
        : state.occlusionProbability <= 0.6
        ? 1
        : 2;

    // 6. memoryConfidence: low (<0.30), moderate (0.30-0.75), solid (>=0.75)
    const mcBin =
      state.memoryConfidence < 0.3 ? 0 : state.memoryConfidence < 0.75 ? 1 : 2;

    // 7. computeBudget: constrained (<0.35), medium (0.35-0.70), abundant (>=0.70)
    const cbBin =
      state.computeBudget < 0.35 ? 0 : state.computeBudget <= 0.7 ? 1 : 2;

    const key = `u${uBin}_c${cBin}_tc${tcBin}_m${mBin}_op${opBin}_mc${mcBin}_cb${cbBin}`;

    return {
      uncertaintyBin: uBin,
      candidateCountBin: cBin,
      targetConfidenceBin: tcBin,
      motionBin: mBin,
      occlusionBin: opBin,
      memoryConfidenceBin: mcBin,
      computeBudgetBin: cbBin,
      key,
    };
  }

  /**
   * Retrieves or initializes Q-values for a given state
   */
  public getQValues(state: PolicyState): Record<LearnedPolicyAction, number> {
    const { key } = this.discretizeState(state);
    let values = this.qTable.get(key);
    if (!values) {
      values = {
        FULL_FRAME: 0.0,
        ROI_SELECTION: 0.0,
        ZOOM: 0.0,
        TRACK: 0.0,
        EDGE_ANALYSIS: 0.0,
        FEATURE_MATCH: 0.0,
        DEPTH: 0.0,
        WAIT: 0.0,
      };
      this.qTable.set(key, values);
    }
    return values;
  }

  /**
   * Selects an action using Epsilon-Greedy policy
   */
  public selectAction(
    state: PolicyState,
    epsilon = 0.0
  ): {
    action: LearnedPolicyAction;
    qValue: number;
    allQValues: Record<LearnedPolicyAction, number>;
  } {
    const qValues = this.getQValues(state);

    // Epsilon-exploration: pick random action
    if (epsilon > 0 && Math.random() < epsilon) {
      const randomIdx = Math.floor(Math.random() * ALL_LEARNED_ACTIONS.length);
      const randomAction = ALL_LEARNED_ACTIONS[randomIdx];
      return {
        action: randomAction,
        qValue: qValues[randomAction],
        allQValues: { ...qValues },
      };
    }

    // Greedy: argmax_a Q(s, a)
    let bestAction: LearnedPolicyAction = 'FULL_FRAME';
    let maxQ = -Infinity;

    for (const act of ALL_LEARNED_ACTIONS) {
      const q = qValues[act];
      if (q > maxQ) {
        maxQ = q;
        bestAction = act;
      }
    }

    return {
      action: bestAction,
      qValue: maxQ,
      allQValues: { ...qValues },
    };
  }

  /**
   * Evaluates reward strictly according to the required formula:
   * reward = task success + information gain - computation cost - latency - unnecessary observations
   */
  public calculateReward(params: {
    action: LearnedPolicyAction;
    stateBefore: PolicyState;
    stateAfter: PolicyState;
    targetTracked: boolean;
    targetOccluded: boolean;
    targetPredictedCorrectly?: boolean;
    actualLatencyMs?: number;
  }): RewardBreakdown {
    const {
      action,
      stateBefore,
      stateAfter,
      targetTracked,
      targetOccluded,
      targetPredictedCorrectly,
      actualLatencyMs,
    } = params;

    const avicaAction = LEARNED_ACTION_TO_AVICA_ACTION[action];
    const costProfile = ACTION_COST_TABLE[avicaAction];

    // 1. Task Success:
    // +1.8 if target is actively locked / tracked
    // +1.0 if target is occluded but successfully anticipated via predictive re-emergence
    // 0.0 if target is completely lost
    let taskSuccess = 0.0;
    if (targetTracked) {
      taskSuccess = 1.8;
    } else if (targetOccluded && targetPredictedCorrectly) {
      taskSuccess = 1.0;
    } else if (stateAfter.targetConfidence > 0.65) {
      taskSuccess = 1.2;
    } else {
      taskSuccess = 0.0;
    }

    // 2. Information Gain:
    // Uncertainty reduction between stateBefore and stateAfter
    const uncertaintyDelta = stateBefore.uncertainty - stateAfter.uncertainty;
    const informationGain = Math.max(0, uncertaintyDelta) * 2.5;

    // 3. Computation Cost:
    // Scaled penalty proportional to FLOPS
    const computationCost = costProfile.computationCost * 0.4;

    // 4. Latency Penalty:
    const latencyPenalty = actualLatencyMs
      ? (actualLatencyMs / 25.0) * 0.3
      : costProfile.latencyCost * 0.25;

    // 5. Unnecessary Observations:
    // Penalize high-cost sensory actions when uncertainty is already near 0,
    // confidence is high, and target is clear.
    let unnecessaryObservations = 0.0;

    const isHighCostAction =
      action === 'FULL_FRAME' ||
      action === 'ZOOM' ||
      action === 'FEATURE_MATCH' ||
      action === 'EDGE_ANALYSIS';

    if (
      isHighCostAction &&
      stateBefore.uncertainty < 0.20 &&
      stateBefore.targetConfidence > 0.80 &&
      stateBefore.occlusionProbability < 0.20
    ) {
      // Unneeded expensive observation! WAIT or TRACK was sufficient.
      unnecessaryObservations = 0.8;
    } else if (
      action === 'WAIT' &&
      stateBefore.uncertainty > 0.70 &&
      stateBefore.targetConfidence < 0.35 &&
      !targetTracked
    ) {
      // Inaction penalty when urgent visual observation is required.
      unnecessaryObservations = 0.6;
    }

    // Net reward: task success + information gain - computation cost - latency - unnecessary observations
    const netReward =
      taskSuccess +
      informationGain -
      computationCost -
      latencyPenalty -
      unnecessaryObservations;

    return {
      taskSuccess: Math.round(taskSuccess * 100) / 100,
      informationGain: Math.round(informationGain * 100) / 100,
      computationCost: Math.round(computationCost * 100) / 100,
      latency: Math.round(latencyPenalty * 100) / 100,
      unnecessaryObservations: Math.round(unnecessaryObservations * 100) / 100,
      netReward: Math.round(netReward * 100) / 100,
    };
  }

  /**
   * Bellman Q-Learning Update:
   * Q(s, a) <- Q(s, a) + alpha * [ r + gamma * max_a' Q(s', a') - Q(s, a) ]
   */
  public updateQ(
    state: PolicyState,
    action: LearnedPolicyAction,
    reward: number,
    nextState: PolicyState,
    customAlpha?: number,
    customGamma?: number
  ): number {
    const alpha = customAlpha ?? this.learningRate;
    const gamma = customGamma ?? this.discountFactor;

    const { key } = this.discretizeState(state);
    const qValues = this.getQValues(state);
    const currentQ = qValues[action];

    // max_a' Q(s', a')
    const nextQValues = this.getQValues(nextState);
    let maxNextQ = -Infinity;
    for (const act of ALL_LEARNED_ACTIONS) {
      if (nextQValues[act] > maxNextQ) {
        maxNextQ = nextQValues[act];
      }
    }

    // TD target and Bellman TD error
    const tdTarget = reward + gamma * maxNextQ;
    const tdError = tdTarget - currentQ;

    // Q-value update
    qValues[action] = currentQ + alpha * tdError;
    this.qTable.set(key, qValues);

    return Math.abs(tdError);
  }

  /**
   * Translates the Q-learning choice into a full AgentActionDecision for the cognitive loop.
   */
  public selectBestAction(
    uncertainty: EpistemicUncertaintyState,
    candidates: CandidateRegion[],
    targetEntity?: WorkingMemoryEntity,
    computeBudget = 1.0
  ): AgentActionDecision {
    // 1. Extract 7-dimensional policy state
    const targetConfidence = targetEntity ? targetEntity.confidence : 0;
    const motion = targetEntity?.velocity
      ? Math.min(1.0, Math.hypot(targetEntity.velocity.x, targetEntity.velocity.y) * 2.5)
      : 0;

    const occlusionProbability = targetEntity?.isOccluded
      ? 1.0
      : targetEntity?.relationships?.some(
          (r) => r.includes('OCCLUDING') || r.includes('OCCLUDED_BY')
        )
      ? 0.75
      : 0.05;

    const memoryConfidence = targetEntity
      ? targetEntity.trackingLifecycleState === 'TRACKING' ||
        targetEntity.trackingLifecycleState === 'RECOVERED'
        ? 0.9
        : 0.4
      : 0.0;

    const policyState: PolicyState = {
      uncertainty: uncertainty.uncertaintyScore,
      candidateCount: candidates.length,
      targetConfidence,
      motion,
      occlusionProbability,
      memoryConfidence,
      computeBudget,
    };

    const { action, qValue, allQValues } = this.selectAction(policyState, 0.0);
    const avicaAction = LEARNED_ACTION_TO_AVICA_ACTION[action];
    const costProfile = ACTION_COST_TABLE[avicaAction];

    // Determine target bounding box / candidate target
    let targetRoi = targetEntity?.boundingBox;
    let candidateId = targetEntity?.id;

    const uninspected = candidates.filter(
      (c) => !c.isInspected && c.status !== 'REJECTED'
    );
    const sorted = [...candidates].sort(
      (a, b) => b.targetProbability - a.targetProbability
    );
    const topCandidate = sorted[0];

    if (action === 'ROI_SELECTION' || action === 'ZOOM') {
      if (targetEntity?.isOccluded && targetEntity.predictedReemergenceRoi) {
        targetRoi = targetEntity.predictedReemergenceRoi;
      } else if (uninspected.length > 0) {
        targetRoi = uninspected[0].box;
        candidateId = uninspected[0].id;
      } else if (topCandidate) {
        targetRoi = topCandidate.box;
        candidateId = topCandidate.id;
      }
    } else if (action === 'FEATURE_MATCH' && topCandidate) {
      targetRoi = topCandidate.box;
      candidateId = topCandidate.id;
    } else if (action === 'TRACK' && targetEntity) {
      targetRoi = targetEntity.boundingBox;
      candidateId = targetEntity.id;
    }

    const expectedGain = Math.max(0.1, Math.min(0.95, (qValue + 2.0) / 4.0));
    const netUtility = expectedGain - costProfile.computationCost * 0.25 - costProfile.latencyCost * 0.15;

    const sortedActions = ALL_LEARNED_ACTIONS.map((a) => ({
      action: a,
      q: allQValues[a],
    })).sort((a, b) => b.q - a.q);

    const runnerUp = sortedActions[1];
    const margin = runnerUp ? (qValue - runnerUp.q).toFixed(2) : '0';

    return {
      action: avicaAction,
      targetRoi,
      candidateId,
      reasoning: `Learned Q-Policy evaluated state [U=${policyState.uncertainty.toFixed(2)}, C=${policyState.candidateCount}, TC=${policyState.targetConfidence.toFixed(2)}, M=${policyState.motion.toFixed(2)}, OP=${policyState.occlusionProbability.toFixed(2)}]. Action ${action} selected (Q=${qValue.toFixed(2)}, margin over ${runnerUp?.action || 'none'}: +${margin}).`,
      expectedInfoGain: Math.round(expectedGain * 100) / 100,
      computationCost: costProfile.computationCost,
      latencyCost: costProfile.latencyCost,
      netUtility: Math.round(netUtility * 100) / 100,
    };
  }

  /**
   * Adds an episode point to stored training curves
   */
  public recordTrainingCurvePoint(point: PolicyTrainingCurvePoint): void {
    this.trainingCurves.push(point);
  }

  /**
   * Returns copy of historical training curves
   */
  public getTrainingCurves(): PolicyTrainingCurvePoint[] {
    return [...this.trainingCurves];
  }

  /**
   * Clears training curves
   */
  public clearTrainingCurves(): void {
    this.trainingCurves = [];
  }

  /**
   * Returns current Q-table size (number of observed discrete states)
   */
  public getObservedStateCount(): number {
    return this.qTable.size;
  }

  /**
   * Exports Q-table serialization
   */
  public exportQTable(): Record<string, Record<LearnedPolicyAction, number>> {
    const exported: Record<string, Record<LearnedPolicyAction, number>> = {};
    for (const [key, values] of this.qTable.entries()) {
      exported[key] = { ...values };
    }
    return exported;
  }

  /**
   * Imports Q-table serialization
   */
  public importQTable(data: Record<string, Record<LearnedPolicyAction, number>>): void {
    this.qTable.clear();
    for (const [key, values] of Object.entries(data)) {
      this.qTable.set(key, { ...values });
    }
  }
}

// Global singleton instance for shared execution across simulator and cognitive loop
export const sharedQLearningPolicy = new QLearningObservationPolicy();
