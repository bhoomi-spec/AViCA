/**
 * AViCA Policy Trainer for Learned Observation Policy
 *
 * Trains the Q-Learning observation policy using the controlled AdversarialSceneSimulator.
 * Refines the state-action value table Q(s, a) across diverse scenarios containing:
 * - Dynamic target trajectories
 * - Visually similar distractors
 * - Dynamic moving occluders (full and partial occultation)
 * - Illumination shifts
 *
 * Reward Function (strict specification compliance):
 * R = task_success + information_gain - computation_cost - latency - unnecessary_observations
 *
 * Stores full episode training curves (reward, info gain, compute, TD loss, epsilon, action distribution).
 */

import { AdversarialSceneSimulator } from '../simulation/adversarial_scene';
import { AvicaCognitiveEngine } from '../core/cognitive_loop';
import {
  ALL_LEARNED_ACTIONS,
  LearnedPolicyAction,
  PolicyState,
  PolicyTrainingConfig,
  PolicyTrainingCurvePoint,
} from '../types/learned_policy';
import { QLearningObservationPolicy, sharedQLearningPolicy } from './q_learning_policy';

export class PolicyTrainer {
  private qPolicy: QLearningObservationPolicy;

  constructor(policy: QLearningObservationPolicy = sharedQLearningPolicy) {
    this.qPolicy = policy;
  }

  /**
   * Executes a batch of training episodes on the controlled simulator.
   */
  public async train(
    config: Partial<PolicyTrainingConfig> = {},
    onProgress?: (progress: number, point: PolicyTrainingCurvePoint) => void
  ): Promise<PolicyTrainingCurvePoint[]> {
    const episodes = config.episodes ?? 50;
    const stepsPerEpisode = config.stepsPerEpisode ?? 40;
    const alpha = config.learningRate ?? 0.15;
    const gamma = config.discountFactor ?? 0.90;
    let epsilon = config.initialEpsilon ?? 0.35;
    const minEpsilon = config.minEpsilon ?? 0.05;
    const epsilonDecay = config.epsilonDecay ?? 0.96;
    const baseSeed = config.seed ?? 101;

    const newCurvePoints: PolicyTrainingCurvePoint[] = [];

    // Headless-compatible offscreen canvas for trial rendering
    let offscreenCanvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    let fallbackBuffer: Uint8ClampedArray | null = null;

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      try {
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = 640;
        offscreenCanvas.height = 400;
        ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
      } catch {
        ctx = null;
      }
    }

    if (!ctx) {
      fallbackBuffer = new Uint8ClampedArray(640 * 400 * 4);
    }

    const makeImageData = (buffer: Uint8ClampedArray, w: number, h: number): ImageData => {
      if (typeof ImageData !== 'undefined') {
        return new ImageData(buffer as unknown as Uint8ClampedArray<ArrayBuffer>, w, h);
      }
      return {
        data: buffer,
        width: w,
        height: h,
        colorSpace: 'srgb',
      } as unknown as ImageData;
    };

    for (let ep = 0; ep < episodes; ep++) {
      const episodeSeed = baseSeed + ep * 13;
      const simulator = new AdversarialSceneSimulator(640, 400);
      simulator.initializeScene(episodeSeed);

      const cognitiveEngine = new AvicaCognitiveEngine();
      cognitiveEngine.setMode('AVICA_LEARNED');

      let epReward = 0;
      let epInfoGain = 0;
      let epComputeCost = 0;
      let epTotalLatency = 0;
      let epSuccessSteps = 0;
      let epTdErrorSum = 0;

      const actionCounts: Record<LearnedPolicyAction, number> = {
        FULL_FRAME: 0,
        ROI_SELECTION: 0,
        ZOOM: 0,
        TRACK: 0,
        EDGE_ANALYSIS: 0,
        FEATURE_MATCH: 0,
        DEPTH: 0,
        WAIT: 0,
      };

      for (let step = 0; step < stepsPerEpisode; step++) {
        // Step simulator with periodic illumination shift
        const simState = simulator.step(step > 15 && step < 30);
        const gtState = simulator.getGroundTruthState();

        // Render synthetic frame
        let frameImageData: ImageData;
        if (ctx && offscreenCanvas) {
          simulator.renderToCanvas(ctx);
          frameImageData = ctx.getImageData(0, 0, 640, 400);
        } else {
          // Synthetic fallback
          if (!fallbackBuffer) fallbackBuffer = new Uint8ClampedArray(640 * 400 * 4);
          fallbackBuffer.fill(22);
          for (const ent of simState.entities) {
            if (ent.isOccluded) continue;
            const cx = Math.floor(ent.x * 640);
            const cy = Math.floor(ent.y * 400);
            const rad = Math.floor(ent.size / 2);
            for (let dy = -rad; dy <= rad; dy++) {
              for (let dx = -rad; dx <= rad; dx++) {
                const px = cx + dx;
                const py = cy + dy;
                if (px >= 0 && px < 640 && py >= 0 && py < 400) {
                  const idx = (py * 640 + px) * 4;
                  fallbackBuffer[idx] = ent.isTarget ? 6 : 56;
                  fallbackBuffer[idx + 1] = ent.isTarget ? 182 : 189;
                  fallbackBuffer[idx + 2] = ent.isTarget ? 212 : 248;
                  fallbackBuffer[idx + 3] = 255;
                }
              }
            }
          }
          frameImageData = makeImageData(fallbackBuffer, 640, 400);
        }

        // Target simulation & ground truth info
        const targetSim = simState.entities.find((e) => e.isTarget);
        const targetIsOccluded = targetSim ? targetSim.isOccluded : false;

        // Current memory and uncertainty state before cycle
        const existingTarget = cognitiveEngine.getTargetEntity();
        const currentUncertainty = cognitiveEngine.getUncertaintyState();

        const motion = targetSim
          ? Math.min(1.0, Math.hypot(targetSim.vx, targetSim.vy) * 20.0)
          : 0;

        const occlusionProb = targetIsOccluded
          ? 1.0
          : targetSim &&
            Math.abs(targetSim.x - simState.occluder.x) < 0.15
          ? 0.70
          : 0.05;

        const memoryConf = existingTarget
          ? existingTarget.trackingLifecycleState === 'TRACKING' ||
            existingTarget.trackingLifecycleState === 'RECOVERED'
            ? 0.9
            : 0.4
          : 0.0;

        // Construct 7-dimensional policy state before action
        const stateBefore: PolicyState = {
          uncertainty: currentUncertainty.uncertaintyScore,
          candidateCount: existingTarget ? 1 : 2,
          targetConfidence: existingTarget ? existingTarget.confidence : 0.0,
          motion,
          occlusionProbability: occlusionProb,
          memoryConfidence: memoryConf,
          computeBudget: Math.max(0.2, 1.0 - (step % 5) * 0.15),
        };

        // Select action via epsilon-greedy
        const { action } = this.qPolicy.selectAction(stateBefore, epsilon);
        actionCounts[action]++;

        // Execute cycle with cognitive loop
        const startTime = performance.now();
        const cycleResult = cognitiveEngine.processFrame(frameImageData);
        const actualLatency = performance.now() - startTime;

        // State after cycle
        const nextTarget = cognitiveEngine.getTargetEntity();
        const nextUncertainty = cycleResult.uncertainty;

        const isTargetLocked =
          !targetIsOccluded &&
          nextTarget !== undefined &&
          nextTarget.confidence >= 0.65;

        if (isTargetLocked || (targetIsOccluded && nextTarget?.isOccluded)) {
          epSuccessSteps++;
        }

        const stateAfter: PolicyState = {
          uncertainty: nextUncertainty.uncertaintyScore,
          candidateCount: nextTarget ? 1 : 0,
          targetConfidence: nextTarget ? nextTarget.confidence : 0.0,
          motion,
          occlusionProbability: targetIsOccluded ? 1.0 : 0.1,
          memoryConfidence: nextTarget ? 0.85 : 0.2,
          computeBudget: 1.0,
        };

        // Calculate Reward matching specification:
        // task success + information gain - computation cost - latency - unnecessary observations
        const rewardBreakdown = this.qPolicy.calculateReward({
          action,
          stateBefore,
          stateAfter,
          targetTracked: isTargetLocked,
          targetOccluded: targetIsOccluded,
          targetPredictedCorrectly:
            targetIsOccluded && !!nextTarget?.predictedReemergenceRoi,
          actualLatencyMs: actualLatency,
        });

        // Bellman Q-Update
        const tdError = this.qPolicy.updateQ(
          stateBefore,
          action,
          rewardBreakdown.netReward,
          stateAfter,
          alpha,
          gamma
        );

        epReward += rewardBreakdown.netReward;
        epInfoGain += rewardBreakdown.informationGain;
        epComputeCost += rewardBreakdown.computationCost;
        epTotalLatency += actualLatency;
        epTdErrorSum += tdError;
      }

      // Decay epsilon exploration rate
      epsilon = Math.max(minEpsilon, epsilon * epsilonDecay);

      const curvePoint: PolicyTrainingCurvePoint = {
        episode: ep + 1,
        totalSteps: stepsPerEpisode,
        cumulativeReward: Math.round(epReward * 100) / 100,
        averageRewardPerStep: Math.round((epReward / stepsPerEpisode) * 100) / 100,
        totalInfoGain: Math.round(epInfoGain * 100) / 100,
        totalComputeCost: Math.round(epComputeCost * 100) / 100,
        averageLatency: Math.round((epTotalLatency / stepsPerEpisode) * 10) / 10,
        taskSuccessRate: Math.round((epSuccessSteps / stepsPerEpisode) * 100),
        tdError: Math.round((epTdErrorSum / stepsPerEpisode) * 1000) / 1000,
        epsilon: Math.round(epsilon * 1000) / 1000,
        actionCounts,
      };

      this.qPolicy.recordTrainingCurvePoint(curvePoint);
      newCurvePoints.push(curvePoint);

      if (onProgress) {
        const progress = Math.round(((ep + 1) / episodes) * 100);
        onProgress(progress, curvePoint);
      }

      // Yield event loop every few episodes to maintain browser responsiveness
      if (ep % 4 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return newCurvePoints;
  }
}
