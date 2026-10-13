/**
 * Test Suite: Temporal Visual Working Memory + Tracking
 *
 * Verifies:
 * 1. Entity persistence across frames
 * 2. Multi-feature temporal association (Kalman innovation + appearance memory)
 * 3. 2D Kalman filter kinematic state estimation & forward propagation during occlusion
 * 4. Optical flow motion vector estimation from consecutive raw pixel buffers
 * 5. Appearance memory maintenance and distractor rejection
 * 6. Demonstration of the 7-stage tracking lifecycle:
 *    DETECTED → TRACKING → OCCLUDED → MEMORY_RETAINED → PREDICTION → ACTIVE_SEARCH → RECOVERED
 * 7. Recovery strictly dependent on actual new visual evidence (no recovery without matching evidence)
 * 8. Benchmark metrics & occlusion recovery accounting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VisualWorkingMemory } from '../src/memory/visual_working_memory';
import { KalmanTrackingFilter } from '../src/tracking/kalman_filter';
import { AppearanceMemory } from '../src/memory/appearance_memory';
import { OpticalFlowEstimator } from '../src/tracking/optical_flow';
import { AvicaCognitiveEngine } from '../src/core/cognitive_loop';
import { ScientificEvaluationSubsystem } from '../src/evaluation/evaluation_subsystem';
import { BoundingBox, GroundTruthState } from '../src/types/avica';

describe('Temporal Visual Working Memory & Tracking Subsystem', () => {
  let vwm: VisualWorkingMemory;

  beforeEach(() => {
    vwm = new VisualWorkingMemory({
      confidenceDecayRate: 0.05,
      forgettingThreshold: 0.20,
      spatialMatchDistanceThreshold: 0.20,
      featureSimilarityThreshold: 0.50,
    });
  });

  describe('1. 2D Kalman Filter State Estimation', () => {
    it('accurately estimates velocity from sequential position measurements', () => {
      const kalman = new KalmanTrackingFilter(0.2, 0.3);

      // Simulate linear motion with dx = 0.02, dy = 0.01 per step
      let trueX = 0.2;
      let trueY = 0.3;
      const vxTrue = 0.02;
      const vyTrue = 0.01;

      for (let step = 1; step <= 8; step++) {
        trueX += vxTrue;
        trueY += vyTrue;
        kalman.predict(1.0);
        kalman.update(trueX, trueY);
      }

      const state = kalman.getState();
      expect(state.x).toBeCloseTo(trueX, 1);
      expect(state.y).toBeCloseTo(trueY, 1);
      // Velocity should converge near true values
      expect(state.vx).toBeGreaterThan(0.01);
      expect(state.vy).toBeGreaterThan(0.005);
      expect(state.positionVariance).toBeLessThan(0.01);
    });

    it('expands positional uncertainty covariance during missing observations', () => {
      const kalman = new KalmanTrackingFilter(0.4, 0.5, 0.01, 0.005);
      kalman.update(0.4, 0.5);

      const varBefore = kalman.getState().positionVariance;

      // Simulate 5 occlusion steps (predict only, no measurements)
      for (let i = 0; i < 5; i++) {
        kalman.predict(1.0);
      }

      const varAfter = kalman.getState().positionVariance;
      // Positional variance must monotonically increase during occlusion
      expect(varAfter).toBeGreaterThan(varBefore);

      // Trajectory projection horizon
      const traj = kalman.projectTrajectory(4, 1.0);
      expect(traj.length).toBe(4);
      expect(traj[3].variance).toBeGreaterThan(traj[0].variance);
    });
  });

  describe('2. Appearance Memory & Distractor Rejection', () => {
    it('maintains running appearance signature and matches target while rejecting distractors', () => {
      const targetEmbedding = [0.1, 0.8, 0.9, 0.2, 0.1, 0.0, 0.4, 0.7];
      const targetHue = 192; // Cyan
      const targetCircularity = 0.88;

      const appMem = new AppearanceMemory(targetEmbedding, targetHue, targetCircularity);

      // Update with matching sample
      appMem.update(targetEmbedding, 190, 0.86);

      // Evaluate matching candidate
      const matchCandidate = {
        id: 'cand-target',
        box: { x: 0.3, y: 0.4, width: 0.06, height: 0.06 },
        salienceScore: 0.9,
        featureSimilarity: 0.88,
        isInspected: true,
        targetProbability: 0.85,
        status: 'CONFIRMED_TARGET' as const,
        colorFeatures: { hue: 191, saturation: 85, brightness: 80, colorMatchScore: 0.9 },
        shapeFeatures: { circularity: 0.87, aspectRatio: 1.0, area: 400, perimeter: 80, shapeMatchScore: 0.9 },
      };

      const matchRes = appMem.evaluateCandidate(matchCandidate, targetEmbedding);
      expect(matchRes.isMatch).toBe(true);
      expect(matchRes.matchScore).toBeGreaterThan(0.70);

      // Evaluate distractor with mismatched hue (e.g. amber clutter hue 40°)
      const distractorCandidate = {
        id: 'cand-distractor',
        box: { x: 0.3, y: 0.4, width: 0.06, height: 0.06 },
        salienceScore: 0.9,
        featureSimilarity: 0.25,
        isInspected: true,
        targetProbability: 0.3,
        status: 'REJECTED' as const,
        colorFeatures: { hue: 42, saturation: 90, brightness: 80, colorMatchScore: 0.2 },
        shapeFeatures: { circularity: 0.4, aspectRatio: 1.0, area: 400, perimeter: 80, shapeMatchScore: 0.3 },
      };
      const distractorEmbedding = [0.9, 0.2, 0.1, 0.0, 0.8, 0.5, 0.1, 0.2];

      const distRes = appMem.evaluateCandidate(distractorCandidate, distractorEmbedding);
      expect(distRes.isMatch).toBe(false);
      expect(distRes.matchScore).toBeLessThan(0.55);
    });
  });

  describe('3. Optical Flow Motion Vector Estimation', () => {
    it('computes differential optical flow from consecutive raw pixel buffers', () => {
      const flow = new OpticalFlowEstimator();
      const width = 80;
      const height = 80;

      // Frame 1: uniform background with high-contrast square at x=30..45, y=30..45
      const frame1 = new Uint8ClampedArray(width * height * 4);
      for (let y = 30; y < 45; y++) {
        for (let x = 30; x < 45; x++) {
          const idx = (y * width + x) * 4;
          frame1[idx] = 255;
          frame1[idx + 1] = 255;
          frame1[idx + 2] = 255;
          frame1[idx + 3] = 255;
        }
      }

      // Frame 2: square translated right by 2 pixels (x=32..47)
      const frame2 = new Uint8ClampedArray(width * height * 4);
      for (let y = 30; y < 45; y++) {
        for (let x = 32; x < 47; x++) {
          const idx = (y * width + x) * 4;
          frame2[idx] = 255;
          frame2[idx + 1] = 255;
          frame2[idx + 2] = 255;
          frame2[idx + 3] = 255;
        }
      }

      const roi: BoundingBox = { x: 0.3, y: 0.3, width: 0.3, height: 0.3 };

      // Initialize with frame 1
      flow.estimateFlowInRoi(frame1, width, height, roi);

      // Estimate motion on frame 2
      const res = flow.estimateFlowInRoi(frame2, width, height, roi);

      // Horizontal displacement u should be positive (moved right)
      expect(res.u).toBeGreaterThan(0);
      expect(res.confidence).toBeGreaterThan(0.2);
    });
  });

  describe('4. Complete 7-Stage Tracking Lifecycle Demonstration', () => {
    it('executes DETECTED → TRACKING → OCCLUDED → MEMORY_RETAINED → PREDICTION → ACTIVE_SEARCH → RECOVERED', () => {
      const targetBox: BoundingBox = { x: 0.25, y: 0.40, width: 0.05, height: 0.05 };
      const targetEmbedding = [0.1, 0.9, 0.9, 0.1, 0.2, 0.0, 0.5, 0.7];
      const targetHue = 190;
      const targetCircularity = 0.85;

      // -------------------------------------------------------------
      // STAGE 1: DETECTED (First acquisition)
      // -------------------------------------------------------------
      const res1 = vwm.associateObservation(
        targetBox,
        targetEmbedding,
        0.35,
        1000,
        'TARGET_CANDIDATE',
        true,
        targetHue,
        targetCircularity
      );
      expect(res1.wasNew).toBe(true);

      const ent1 = vwm.getTargetEntity();
      expect(ent1).toBeDefined();
      expect(ent1!.trackingLifecycleState).toBe('DETECTED');
      expect(ent1!.confidence).toBeGreaterThan(0.8);
      expect(ent1!.kalmanState).toBeDefined();

      // -------------------------------------------------------------
      // STAGE 2: TRACKING (Consistent observations across frames)
      // -------------------------------------------------------------
      const targetBox2: BoundingBox = { x: 0.27, y: 0.41, width: 0.05, height: 0.05 };
      const res2 = vwm.associateObservation(
        targetBox2,
        targetEmbedding,
        0.35,
        1033,
        'TARGET_CANDIDATE',
        true,
        targetHue,
        targetCircularity
      );
      expect(res2.wasNew).toBe(false);

      const ent2 = vwm.getTargetEntity();
      expect(ent2!.trackingLifecycleState).toBe('TRACKING');
      expect(ent2!.consecutiveFramesTracked).toBe(2);
      expect(ent2!.isOccluded).toBe(false);

      // -------------------------------------------------------------
      // STAGE 3: OCCLUDED (First frame target disappears behind barrier)
      // -------------------------------------------------------------
      // No active observation matching target in this cycle
      vwm.applyTemporalDecay(1066, new Set<string>());

      const ent3 = vwm.getTargetEntity();
      expect(ent3).toBeDefined();
      expect(ent3!.isOccluded).toBe(true);
      expect(ent3!.trackingLifecycleState).toBe('OCCLUDED');
      expect(ent3!.consecutiveFramesOccluded).toBe(1);

      // -------------------------------------------------------------
      // STAGE 4: MEMORY_RETAINED (Persistent slot maintained, Kalman propagated)
      // -------------------------------------------------------------
      vwm.applyTemporalDecay(1100, new Set<string>());

      const ent4 = vwm.getTargetEntity();
      expect(ent4).toBeDefined();
      expect(ent4!.trackingLifecycleState).toBe('MEMORY_RETAINED');
      expect(ent4!.consecutiveFramesOccluded).toBe(2);
      // Position propagated via Kalman filter
      expect(ent4!.position.x).toBeGreaterThan(0.27);

      // -------------------------------------------------------------
      // STAGE 5: PREDICTION (Predictive trajectory + re-emergence ROI generation)
      // -------------------------------------------------------------
      vwm.applyTemporalDecay(1133, new Set<string>());

      const ent5 = vwm.getTargetEntity();
      expect(ent5).toBeDefined();
      expect(ent5!.trackingLifecycleState).toBe('PREDICTION');
      expect(ent5!.predictedReemergenceRoi).toBeDefined();
      expect(ent5!.predictedReemergenceRoi!.width).toBeGreaterThan(0.1);

      // -------------------------------------------------------------
      // STAGE 6: ACTIVE_SEARCH (Foveation window directed at predicted exit)
      // -------------------------------------------------------------
      vwm.applyTemporalDecay(1166, new Set<string>());

      const ent6 = vwm.getTargetEntity();
      expect(ent6).toBeDefined();
      expect(ent6!.trackingLifecycleState).toBe('ACTIVE_SEARCH');
      expect(ent6!.searchAttempts).toBeGreaterThanOrEqual(1);

      // -------------------------------------------------------------
      // STAGE 7: RECOVERED (Actual fresh visual evidence matches appearance)
      // -------------------------------------------------------------
      // Target re-emerges near predicted exit coordinates
      const reemergedBox: BoundingBox = {
        x: ent6!.position.x + 0.02,
        y: ent6!.position.y + 0.01,
        width: 0.05,
        height: 0.05,
      };

      const resRecovered = vwm.associateObservation(
        reemergedBox,
        targetEmbedding,
        0.35,
        1200,
        'TARGET_CANDIDATE',
        true,
        targetHue,
        targetCircularity
      );

      expect(resRecovered.isRecovery).toBe(true);
      expect(resRecovered.entityId).toBe(ent1!.id);

      const entRecovered = vwm.getTargetEntity();
      expect(entRecovered!.trackingLifecycleState).toBe('RECOVERED');
      expect(entRecovered!.isOccluded).toBe(false);
      expect(entRecovered!.confidence).toBeGreaterThan(0.85);
      expect(entRecovered!.consecutiveFramesOccluded).toBe(0);
    });

    it('strictly DOES NOT recover if incoming visual evidence is absent or mismatched', () => {
      // Initialize target in active search
      const targetBox: BoundingBox = { x: 0.25, y: 0.40, width: 0.05, height: 0.05 };
      const targetEmbedding = [0.1, 0.9, 0.9, 0.1, 0.2, 0.0, 0.5, 0.7];

      vwm.associateObservation(targetBox, targetEmbedding, 0.35, 1000, 'TARGET', true, 190, 0.85);
      vwm.associateObservation(targetBox, targetEmbedding, 0.35, 1033, 'TARGET', true, 190, 0.85);

      // Advance into occlusion & active search
      vwm.applyTemporalDecay(1066, new Set<string>()); // OCCLUDED
      vwm.applyTemporalDecay(1100, new Set<string>()); // MEMORY_RETAINED
      vwm.applyTemporalDecay(1133, new Set<string>()); // PREDICTION
      vwm.applyTemporalDecay(1166, new Set<string>()); // ACTIVE_SEARCH

      expect(vwm.getTargetLifecycleState()).toBe('ACTIVE_SEARCH');

      // Attempt association with distractor (different hue 45°, different embedding)
      const distractorBox: BoundingBox = { x: 0.75, y: 0.20, width: 0.05, height: 0.05 };
      const distractorEmbedding = [0.9, 0.1, 0.0, 0.8, 0.2, 0.6, 0.1, 0.1];

      const res = vwm.associateObservation(
        distractorBox,
        distractorEmbedding,
        0.6,
        1200,
        'DISTRACTOR',
        false,
        45, // Distractor amber hue
        0.4
      );

      // Distractor should allocate its own new entity slot, NOT recover the target!
      expect(res.isRecovery).toBe(false);
      expect(res.wasNew).toBe(true);

      // Target must still remain in ACTIVE_SEARCH because no genuine target evidence was observed
      expect(vwm.getTargetLifecycleState()).toBe('ACTIVE_SEARCH');
    });
  });

  describe('5. Cognitive Loop & Scientific Evaluation Subsystem Accounting', () => {
    it('records occlusion recovery metrics correctly in ScientificEvaluationSubsystem', () => {
      const evaluator = new ScientificEvaluationSubsystem();
      evaluator.reset();

      const engine = new AvicaCognitiveEngine();
      engine.reset();

      // Mock cycle with target localized
      const mockResultVisible = {
        observation: {
          frameId: 1,
          timestamp: 1,
          width: 640,
          height: 400,
          zoomLevel: 1.0,
          fps: 30,
          rawFeatureCount: 4,
          meanIntensity: 120,
          contrastScore: 40,
          dominantColor: 'cyan',
          backgroundLuminance: 'normal' as const,
          motionDetected: false,
        },
        candidates: [],
        activeDecision: { action: 'TRACK_OBJECT' as const, reasoning: 'track', expectedInfoGain: 0.3, computationCost: 1.0, latencyCost: 0.5, netUtility: 0.2 },
        uncertainty: { targetProbability: 0.9, confidence: 0.85, uncertaintyScore: 0.15, ambiguityScore: 0.1, missingEvidenceScore: 0.1, isEvidenceSufficient: true, sufficientThreshold: 0.7, lastUpdatedFrame: 1 },
        workingMemoryEntities: [{
          id: 'T1',
          label: 'TARGET',
          visualEmbedding: [0.1, 0.8, 0.9],
          position: { x: 0.25, y: 0.45, z: 0.35 },
          velocity: { x: 0.01, y: 0.0, z: 0.0 },
          boundingBox: { x: 0.22, y: 0.42, width: 0.06, height: 0.06 },
          confidence: 0.9,
          epistemicUncertainty: 0.1,
          previousState: 'INITIALIZED',
          currentState: 'TRACKING',
          trackingLifecycleState: 'TRACKING' as const,
          observedAction: 'TRACK',
          relationships: [],
          firstObservedTimestamp: 1000,
          lastObservedTimestamp: 1000,
          observationCount: 3,
          decayRate: 0.04,
          isTarget: true,
          isOccluded: false,
        }],
        worldModel: { timestamp: 1, entities: {}, relationships: [], targetId: 'T1', sceneBounds: { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 } },
        prediction: { predictedTargetPos: null, actualTargetPos: null, predictionError: 0.02, predictedTrajectory: [], predictedNextState: 'TRACKING', actualNextState: 'TRACKING', occlusionImminent: false },
        traceSteps: [],
        currentMode: 'AVICA_ACTIVE' as const,
        groundTruthTargetFound: true,
        metrics: engine.getMetrics(),
      };

      const gtVisible: GroundTruthState = {
        frameId: 1,
        timestamp: 1000,
        target: { id: 'GT1', name: 'Target', isTarget: true, isDistractor: false, position: { x: 0.25, y: 0.45, z: 0.35 }, size: 28, isOccluded: false, box: { x: 0.22, y: 0.42, width: 0.06, height: 0.06 } },
        entities: [],
        occluder: { x: 0.5, y: 0.2, width: 0.15, height: 0.6 },
      };

      // 1. Visible frame
      evaluator.evaluateCycle(mockResultVisible, gtVisible, 12);
      expect(evaluator.getMetrics().targetTrackingAccuracy).toBe(100);

      // 2. Occluded frame (GT target is occluded)
      const gtOccluded: GroundTruthState = {
        ...gtVisible,
        frameId: 2,
        target: { ...gtVisible.target!, isOccluded: true },
      };
      evaluator.evaluateCycle(mockResultVisible, gtOccluded, 12);

      // 3. Recovery frame (GT target emerges, system localizes target)
      const gtRecovered: GroundTruthState = {
        ...gtVisible,
        frameId: 3,
        target: { ...gtVisible.target!, isOccluded: false },
      };
      const eval3 = evaluator.evaluateCycle(mockResultVisible, gtRecovered, 12);

      // Must record an occlusion recovery attempt and success
      expect(eval3.report.occlusionRecoveryEvent).toBe(true);
      expect(eval3.report.occlusionRecoverySuccess).toBe(true);
      expect(evaluator.getMetrics().occlusionRecoveryAttempts).toBe(1);
      expect(evaluator.getMetrics().occlusionRecoverySuccesses).toBe(1);
      expect(evaluator.getMetrics().occlusionRecoveryRate).toBe(100);
    });
  });
});
