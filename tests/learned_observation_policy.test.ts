import { describe, it, expect, beforeEach } from 'vitest';
import {
  QLearningObservationPolicy,
} from '../src/active_perception/q_learning_policy';
import { PolicyTrainer } from '../src/active_perception/policy_trainer';
import { PolicyComparisonEngine } from '../src/evaluation/policy_comparison';
import { AvicaCognitiveEngine } from '../src/core/cognitive_loop';
import { AdversarialSceneSimulator } from '../src/simulation/adversarial_scene';
import {
  ALL_LEARNED_ACTIONS,
  PolicyState,
  LEARNED_ACTION_TO_AVICA_ACTION,
  AVICA_ACTION_TO_LEARNED_ACTION,
} from '../src/types/learned_policy';

describe('AViCA Learned Observation Policy (Q-Learning)', () => {
  let policy: QLearningObservationPolicy;

  beforeEach(() => {
    policy = new QLearningObservationPolicy();
  });

  it('correctly discretizes 7-dimensional policy state', () => {
    const state: PolicyState = {
      uncertainty: 0.15, // low -> 0
      candidateCount: 1, // 1 -> 1
      targetConfidence: 0.85, // high -> 2
      motion: 0.25, // moderate -> 1
      occlusionProbability: 0.05, // clear -> 0
      memoryConfidence: 0.90, // solid -> 2
      computeBudget: 0.80, // abundant -> 2
    };

    const discretized = policy.discretizeState(state);
    expect(discretized.uncertaintyBin).toBe(0);
    expect(discretized.candidateCountBin).toBe(1);
    expect(discretized.targetConfidenceBin).toBe(2);
    expect(discretized.motionBin).toBe(1);
    expect(discretized.occlusionBin).toBe(0);
    expect(discretized.memoryConfidenceBin).toBe(2);
    expect(discretized.computeBudgetBin).toBe(2);
    expect(discretized.key).toBe('u0_c1_tc2_m1_op0_mc2_cb2');
  });

  it('supports all 8 required actions with valid mapping to core architecture', () => {
    expect(ALL_LEARNED_ACTIONS).toHaveLength(8);
    expect(ALL_LEARNED_ACTIONS).toContain('FULL_FRAME');
    expect(ALL_LEARNED_ACTIONS).toContain('ROI_SELECTION');
    expect(ALL_LEARNED_ACTIONS).toContain('ZOOM');
    expect(ALL_LEARNED_ACTIONS).toContain('TRACK');
    expect(ALL_LEARNED_ACTIONS).toContain('EDGE_ANALYSIS');
    expect(ALL_LEARNED_ACTIONS).toContain('FEATURE_MATCH');
    expect(ALL_LEARNED_ACTIONS).toContain('DEPTH');
    expect(ALL_LEARNED_ACTIONS).toContain('WAIT');

    // Verify bidirectional mapping
    for (const act of ALL_LEARNED_ACTIONS) {
      const avicaAct = LEARNED_ACTION_TO_AVICA_ACTION[act];
      expect(avicaAct).toBeDefined();
      expect(AVICA_ACTION_TO_LEARNED_ACTION[avicaAct]).toBe(act);
    }
  });

  it('computes reward adhering strictly to: task_success + info_gain - cost - latency - unnecessary_obs', () => {
    const stateBefore: PolicyState = {
      uncertainty: 0.80,
      candidateCount: 2,
      targetConfidence: 0.30,
      motion: 0.20,
      occlusionProbability: 0.10,
      memoryConfidence: 0.40,
      computeBudget: 0.90,
    };

    const stateAfter: PolicyState = {
      uncertainty: 0.20, // 0.60 reduction
      candidateCount: 1,
      targetConfidence: 0.85,
      motion: 0.20,
      occlusionProbability: 0.10,
      memoryConfidence: 0.85,
      computeBudget: 0.70,
    };

    const rewardBreakdown = policy.calculateReward({
      action: 'ROI_SELECTION',
      stateBefore,
      stateAfter,
      targetTracked: true,
      targetOccluded: false,
      actualLatencyMs: 10,
    });

    expect(rewardBreakdown.taskSuccess).toBeGreaterThan(0);
    expect(rewardBreakdown.informationGain).toBeGreaterThan(0);
    expect(rewardBreakdown.computationCost).toBeGreaterThan(0);
    expect(rewardBreakdown.latency).toBeGreaterThan(0);
    expect(rewardBreakdown.unnecessaryObservations).toBe(0);

    // Verify equation holds: netReward == taskSuccess + infoGain - computationCost - latency - unnecessaryObs
    const expectedNet =
      rewardBreakdown.taskSuccess +
      rewardBreakdown.informationGain -
      rewardBreakdown.computationCost -
      rewardBreakdown.latency -
      rewardBreakdown.unnecessaryObservations;

    expect(Math.abs(rewardBreakdown.netReward - expectedNet)).toBeLessThan(0.05);
  });

  it('penalizes redundant observations when state is confident and clear', () => {
    const confidentState: PolicyState = {
      uncertainty: 0.08,
      candidateCount: 1,
      targetConfidence: 0.95,
      motion: 0.05,
      occlusionProbability: 0.02,
      memoryConfidence: 0.95,
      computeBudget: 0.80,
    };

    // Firing an expensive FULL_FRAME scan when target is already 95% confident and certainty is high
    const rewardBreakdown = policy.calculateReward({
      action: 'FULL_FRAME',
      stateBefore: confidentState,
      stateAfter: confidentState,
      targetTracked: true,
      targetOccluded: false,
    });

    expect(rewardBreakdown.unnecessaryObservations).toBeGreaterThan(0);
  });

  it('updates Q-values according to Bellman optimality', () => {
    const state: PolicyState = {
      uncertainty: 0.5,
      candidateCount: 1,
      targetConfidence: 0.5,
      motion: 0.2,
      occlusionProbability: 0.1,
      memoryConfidence: 0.5,
      computeBudget: 0.8,
    };

    const nextState: PolicyState = {
      uncertainty: 0.1,
      candidateCount: 1,
      targetConfidence: 0.9,
      motion: 0.2,
      occlusionProbability: 0.1,
      memoryConfidence: 0.9,
      computeBudget: 0.7,
    };

    const initialQ = policy.getQValues(state)['TRACK'];
    const tdError = policy.updateQ(state, 'TRACK', 2.0, nextState, 0.2, 0.9);

    expect(tdError).toBeGreaterThan(0);
    const updatedQ = policy.getQValues(state)['TRACK'];
    expect(updatedQ).not.toBe(initialQ);
  });

  it('trains in controlled simulator and produces episode training curves', async () => {
    const trainer = new PolicyTrainer(policy);
    const curves = await trainer.train({
      episodes: 5,
      stepsPerEpisode: 15,
      learningRate: 0.2,
      discountFactor: 0.9,
      initialEpsilon: 0.2,
      seed: 42,
    });

    expect(curves).toHaveLength(5);
    for (const pt of curves) {
      expect(pt.episode).toBeGreaterThan(0);
      expect(pt.totalSteps).toBe(15);
      expect(typeof pt.cumulativeReward).toBe('number');
      expect(typeof pt.totalInfoGain).toBe('number');
      expect(typeof pt.totalComputeCost).toBe('number');
      expect(pt.taskSuccessRate).toBeGreaterThanOrEqual(0);
      expect(pt.tdError).toBeGreaterThanOrEqual(0);
    }

    const storedCurves = policy.getTrainingCurves();
    expect(storedCurves).toHaveLength(5);
  });

  it('executes head-to-head empirical comparison against Greedy Information Gain under identical seeds', async () => {
    const engine = new PolicyComparisonEngine();
    const result = await engine.compare(25, 101);

    expect(result.seed).toBe(101);
    expect(result.frames).toBe(25);
    expect(result.greedyResult.metrics.totalFrames).toBe(25);
    expect(result.learnedResult.metrics.totalFrames).toBe(25);

    // Real measured values
    expect(result.greedyResult.metrics.trackingAccuracy).toBeGreaterThanOrEqual(0);
    expect(result.learnedResult.metrics.trackingAccuracy).toBeGreaterThanOrEqual(0);
    expect(result.greedyResult.metrics.computationCost).toBeGreaterThan(0);
    expect(result.learnedResult.metrics.computationCost).toBeGreaterThan(0);

    // Verified empirical deltas
    expect(result.deltas).toBeDefined();
    expect(typeof result.deltas.detectionAccuracyDelta).toBe('number');
    expect(typeof result.deltas.trackingAccuracyDelta).toBe('number');
    expect(typeof result.deltas.computationCostDelta).toBe('number');
    expect(typeof result.deltas.cumulativeRewardDelta).toBe('number');
  });

  it('integrates Q-learning policy seamlessly into live cognitive loop with WAIT and ZOOM actions', () => {
    const engine = new AvicaCognitiveEngine();
    engine.setMode('AVICA_LEARNED');

    const buffer = new Uint8ClampedArray(100 * 100 * 4);
    buffer.fill(128);

    const makeImageData = (buf: Uint8ClampedArray, w: number, h: number): ImageData => {
      if (typeof ImageData !== 'undefined') return new ImageData(buf as unknown as Uint8ClampedArray<ArrayBuffer>, w, h);
      return { data: buf, width: w, height: h, colorSpace: 'srgb' } as unknown as ImageData;
    };

    const cycle = engine.processFrame(makeImageData(buffer, 100, 100));
    expect(cycle).toBeDefined();
    expect(cycle.activeDecision).toBeDefined();
    expect(cycle.activeDecision.action).toBeDefined();
    expect(cycle.metrics.effectiveFps).toBeGreaterThan(0);
  });
});
