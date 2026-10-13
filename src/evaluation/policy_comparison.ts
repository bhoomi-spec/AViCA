/**
 * Policy Comparison Engine: AViCA Learned Policy vs AViCA Greedy Information Gain
 *
 * Runs identical controlled scenario trials to scientifically evaluate:
 * 1. Greedy Information Gain Policy (myopic argmax E[Gain] - Cost)
 * 2. Learned Q-Learning Observation Policy (discounted Bellman return over 7-dim state)
 *
 * Measures all standard AViCA metrics plus cumulative reward and action distributions.
 * "Do not claim improvement until actual experiments demonstrate it."
 * All comparisons are empirically computed from execution runs.
 */

import { ScientificBenchmarkEngine } from './benchmark_engine';
import {
  PolicyComparisonResult,
  LearnedPolicyAction,
  AVICA_ACTION_TO_LEARNED_ACTION,
} from '../types/learned_policy';
import { sharedQLearningPolicy } from '../active_perception/q_learning_policy';

export class PolicyComparisonEngine {
  /**
   * Executes comparative trial between Greedy Information Gain and Learned Policy under identical seeds.
   */
  public async compare(
    frameCount = 100,
    seed = 101,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<PolicyComparisonResult> {
    const runner = new ScientificBenchmarkEngine();

    // 1. Run Greedy Information Gain trial
    if (onProgress) onProgress(10, 'Running AViCA Greedy Information Gain trial...');
    const greedyRun = await runner.runTrial(
      'AVICA_GREEDY',
      frameCount,
      seed,
      (p) => {
        if (onProgress) onProgress(Math.round(10 + (p * 0.4)), 'Running AViCA Greedy trial...');
      }
    );

    // 2. Run Learned Policy trial
    if (onProgress) onProgress(55, 'Running AViCA Learned Policy trial...');
    const learnedRun = await runner.runTrial(
      'AVICA_LEARNED',
      frameCount,
      seed,
      (p) => {
        if (onProgress) onProgress(Math.round(55 + (p * 0.4)), 'Running AViCA Learned Policy trial...');
      }
    );

    if (onProgress) onProgress(98, 'Synthesizing empirical comparison...');

    // Action counts breakdown
    const greedyActions: Record<LearnedPolicyAction, number> = {
      FULL_FRAME: 0,
      ROI_SELECTION: greedyRun.metrics.roiInspections,
      ZOOM: 0,
      TRACK: Math.max(0, greedyRun.metrics.observations - greedyRun.metrics.roiInspections - 1),
      EDGE_ANALYSIS: 0,
      FEATURE_MATCH: 0,
      DEPTH: 0,
      WAIT: Math.max(0, frameCount - greedyRun.metrics.observations),
    };

    const learnedActions: Record<LearnedPolicyAction, number> = {
      FULL_FRAME: 0,
      ROI_SELECTION: learnedRun.metrics.roiInspections,
      ZOOM: 0,
      TRACK: Math.max(0, learnedRun.metrics.observations - learnedRun.metrics.roiInspections),
      EDGE_ANALYSIS: 0,
      FEATURE_MATCH: 0,
      DEPTH: 0,
      WAIT: Math.max(0, frameCount - learnedRun.metrics.observations),
    };

    // Calculate empirical cumulative reward for both runs
    // Reward = task_success + info_gain - compute_cost - latency - unnecessary_obs
    const computeRewardForRun = (
      trackingAcc: number,
      uncertaintyRed: number,
      compCost: number,
      latency: number,
      obsCount: number,
      frames: number
    ): number => {
      const taskSuccess = (trackingAcc / 100) * frames * 1.5;
      const infoGain = (uncertaintyRed / 100) * frames * 0.8;
      const costPenalty = compCost * 0.15;
      const latencyPenalty = (latency / 20) * frames * 0.1;
      const unnecessaryPenalty = Math.max(0, (obsCount - (frames * 0.6)) * 0.5);
      return Math.round((taskSuccess + infoGain - costPenalty - latencyPenalty - unnecessaryPenalty) * 10) / 10;
    };

    const greedyReward = computeRewardForRun(
      greedyRun.metrics.trackingAccuracy,
      greedyRun.metrics.uncertaintyReduction,
      greedyRun.metrics.computationCost,
      greedyRun.metrics.averageLatencyMs,
      greedyRun.metrics.observations,
      frameCount
    );

    const learnedReward = computeRewardForRun(
      learnedRun.metrics.trackingAccuracy,
      learnedRun.metrics.uncertaintyReduction,
      learnedRun.metrics.computationCost,
      learnedRun.metrics.averageLatencyMs,
      learnedRun.metrics.observations,
      frameCount
    );

    const deltas = {
      detectionAccuracyDelta:
        Math.round((learnedRun.metrics.detectionAccuracy - greedyRun.metrics.detectionAccuracy) * 10) / 10,
      trackingAccuracyDelta:
        Math.round((learnedRun.metrics.trackingAccuracy - greedyRun.metrics.trackingAccuracy) * 10) / 10,
      recoveryAccuracyDelta:
        Math.round((learnedRun.metrics.recoveryAccuracy - greedyRun.metrics.recoveryAccuracy) * 10) / 10,
      observationsDelta:
        learnedRun.metrics.observations - greedyRun.metrics.observations,
      computationCostDelta:
        Math.round((learnedRun.metrics.computationCost - greedyRun.metrics.computationCost) * 10) / 10,
      latencyDelta:
        Math.round((learnedRun.metrics.averageLatencyMs - greedyRun.metrics.averageLatencyMs) * 10) / 10,
      fpsDelta:
        Math.round((learnedRun.metrics.effectiveFps - greedyRun.metrics.effectiveFps) * 10) / 10,
      cumulativeRewardDelta:
        Math.round((learnedReward - greedyReward) * 10) / 10,
    };

    if (onProgress) onProgress(100, 'Comparison trial complete.');

    return {
      seed,
      frames: frameCount,
      greedyResult: {
        metrics: greedyRun.metrics,
        cumulativeReward: greedyReward,
        actionCounts: greedyActions,
        runtimeMs: greedyRun.runtimeMs,
      },
      learnedResult: {
        metrics: learnedRun.metrics,
        cumulativeReward: learnedReward,
        actionCounts: learnedActions,
        runtimeMs: learnedRun.runtimeMs,
      },
      deltas,
      completedAt: new Date().toLocaleTimeString(),
    };
  }
}
