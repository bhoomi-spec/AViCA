import { describe, it, expect, beforeEach } from 'vitest';
import { PredictivePerceptionEngine } from '../src/prediction/predictive_perception';
import { WorkingMemoryEntity, SpatialRelationship } from '../src/types/avica';
import { AvicaCognitiveEngine } from '../src/core/cognitive_loop';
import { ScientificEvaluationSubsystem } from '../src/evaluation/evaluation_subsystem';
import { AdversarialSceneSimulator } from '../src/simulation/adversarial_scene';

describe('Predictive Perception Engine (Phase E)', () => {
  let engine: PredictivePerceptionEngine;

  const mockTarget: WorkingMemoryEntity = {
    id: 'target-01',
    label: 'Target Cyan Disk',
    visualEmbedding: [0.5, 0.8, 0.2, 0.1, 0.9, 0.3, 0.4, 0.6],
    position: { x: 0.3, y: 0.4, z: 1.0 },
    velocity: { x: 0.05, y: -0.02, z: 0 },
    boundingBox: { x: 0.26, y: 0.36, width: 0.08, height: 0.08 },
    confidence: 0.92,
    epistemicUncertainty: 0.08,
    previousState: 'INITIALIZING',
    currentState: 'TRACKING',
    trackingLifecycleState: 'TRACKING',
    kalmanState: {
      x: 0.3,
      y: 0.4,
      vx: 0.05,
      vy: -0.02,
      covarianceTrace: 0.012,
      positionVariance: 0.004,
    },
    observedAction: 'MOVE',
    relationships: [],
    firstObservedTimestamp: 1000,
    lastObservedTimestamp: 1100,
    observationCount: 8,
    consecutiveFramesTracked: 8,
    consecutiveFramesOccluded: 0,
    decayRate: 0.05,
    isTarget: true,
    isOccluded: false,
  };

  beforeEach(() => {
    engine = new PredictivePerceptionEngine(4);
    engine.reset();
  });

  it('predicts target position across multi-step horizon: t+1, t+2, t+3, t+4', () => {
    const relationships: SpatialRelationship[] = [];
    const prediction = engine.generatePrediction(mockTarget, relationships, 10);

    expect(prediction.steps).toBeDefined();
    expect(prediction.steps!).toHaveLength(4);
    expect(prediction.horizon).toBe(4);

    // Verify step offsets are exactly 1, 2, 3, 4
    const offsets = prediction.steps!.map((s) => s.stepOffset);
    expect(offsets).toEqual([1, 2, 3, 4]);

    // Verify target frame scheduling: 11, 12, 13, 14
    const targetFrames = prediction.steps!.map((s) => s.targetFrame);
    expect(targetFrames).toEqual([11, 12, 13, 14]);

    // Verify positions follow constant-velocity kinematic projection: x + k * vx
    const p1 = prediction.steps![0].predictedPos;
    const p2 = prediction.steps![1].predictedPos;
    const p3 = prediction.steps![2].predictedPos;
    const p4 = prediction.steps![3].predictedPos;

    expect(p1.x).toBeCloseTo(0.3 + 1 * 0.05, 3);
    expect(p1.y).toBeCloseTo(0.4 + 1 * -0.02, 3);

    expect(p2.x).toBeCloseTo(0.3 + 2 * 0.05, 3);
    expect(p2.y).toBeCloseTo(0.4 + 2 * -0.02, 3);

    expect(p3.x).toBeCloseTo(0.3 + 3 * 0.05, 3);
    expect(p3.y).toBeCloseTo(0.4 + 3 * -0.02, 3);

    expect(p4.x).toBeCloseTo(0.3 + 4 * 0.05, 3);
    expect(p4.y).toBeCloseTo(0.4 + 4 * -0.02, 3);
  });

  it('generates prediction ghosts with bounding boxes and step labels', () => {
    const prediction = engine.generatePrediction(mockTarget, [], 10);

    expect(prediction.predictedGhosts).toBeDefined();
    expect(prediction.predictedGhosts!).toHaveLength(4);

    prediction.predictedGhosts!.forEach((ghost, idx) => {
      const stepNum = idx + 1;
      expect(ghost.step).toBe(stepNum);
      expect(ghost.label).toBe(`t+${stepNum}`);
      expect(ghost.position).toBeDefined();
      expect(ghost.boundingBox).toBeDefined();
      expect(ghost.boundingBox.width).toBeGreaterThan(0);
      expect(ghost.boundingBox.height).toBeGreaterThan(0);
      expect(ghost.confidence).toBeGreaterThan(0);
      expect(ghost.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  it('propagates Kalman covariance and causes monotonic confidence decay over horizon (t+1 > t+2 > t+3 > t+4)', () => {
    const prediction = engine.generatePrediction(mockTarget, [], 10);
    expect(prediction.steps).toBeDefined();

    const c1 = prediction.steps![0].confidence;
    const c2 = prediction.steps![1].confidence;
    const c3 = prediction.steps![2].confidence;
    const c4 = prediction.steps![3].confidence;

    // Confidence must decay monotonically with distance into future
    expect(c1).toBeGreaterThan(c2);
    expect(c2).toBeGreaterThan(c3);
    expect(c3).toBeGreaterThan(c4);

    // Propagated variance must strictly increase
    const v1 = prediction.steps![0].positionVariance;
    const v2 = prediction.steps![1].positionVariance;
    const v3 = prediction.steps![2].positionVariance;
    const v4 = prediction.steps![3].positionVariance;

    expect(v1).toBeLessThan(v2);
    expect(v2).toBeLessThan(v3);
    expect(v3).toBeLessThan(v4);
  });

  it('calculates genuine prediction error against subsequent actual visual observations', () => {
    // Frame 10: system predicts positions for frame 11 (t+1), 12 (t+2), 13 (t+3), 14 (t+4)
    engine.generatePrediction(mockTarget, [], 10);

    // Frame 11 arrives: Target moves with slight deviation from linear path
    const actualPosFrame11 = { x: 0.352, y: 0.379, z: 1.0 }; // pred was (0.35, 0.38)
    const eval11 = engine.evaluatePredictionErrorAgainstObservation(11, actualPosFrame11);

    expect(eval11.t1Error).toBeDefined();
    expect(eval11.t1Error).toBeGreaterThan(0);
    // Real distance: sqrt((0.352-0.35)^2 + (0.379-0.38)^2) = sqrt(0.000004 + 0.000001) = 0.002236
    expect(eval11.t1Error).toBeCloseTo(0.0022, 3);
    expect(eval11.evaluatedSteps[1]).toBeCloseTo(0.0022, 3);

    // Frame 11 also schedules new predictions for 12, 13, 14, 15
    const updatedTarget: WorkingMemoryEntity = {
      ...mockTarget,
      position: actualPosFrame11,
    };
    engine.generatePrediction(updatedTarget, [], 11);

    // Frame 12 arrives: Target deviates further
    const actualPosFrame12 = { x: 0.408, y: 0.355, z: 1.0 };
    const eval12 = engine.evaluatePredictionErrorAgainstObservation(12, actualPosFrame12);

    // Frame 12 evaluates BOTH the t+2 prediction from frame 10 and the t+1 prediction from frame 11!
    expect(eval12.evaluatedSteps[1]).toBeDefined(); // t+1 prediction from frame 11
    expect(eval12.evaluatedSteps[2]).toBeDefined(); // t+2 prediction from frame 10

    // Ensure real non-zero empirical measurement
    expect(eval12.evaluatedSteps[1]).toBeGreaterThan(0);
    expect(eval12.evaluatedSteps[2]).toBeGreaterThan(0);
  });

  it('demonstrates that prediction error scales realistically with horizon step (t+4 >= t+1 for curved trajectory)', () => {
    // Generate prediction at frame 0 for constant velocity
    engine.generatePrediction(mockTarget, [], 0);

    // Simulate accelerating/curving real trajectory where higher horizons have larger error
    // Frame 1 (t+1): small delta
    const actual1 = { x: 0.351, y: 0.38, z: 1.0 };
    const eval1 = engine.evaluatePredictionErrorAgainstObservation(1, actual1);

    // Frame 4 (t+4): target accelerates and turns, so pred was (0.50, 0.32), actual is (0.54, 0.28)
    const actual4 = { x: 0.54, y: 0.28, z: 1.0 };
    const eval4 = engine.evaluatePredictionErrorAgainstObservation(4, actual4);

    expect(eval1.evaluatedSteps[1]).toBeDefined();
    expect(eval4.evaluatedSteps[4]).toBeDefined();

    // t+4 error should be strictly greater than t+1 error under nonlinear trajectory
    expect(eval4.evaluatedSteps[4]).toBeGreaterThan(eval1.evaluatedSteps[1]);
  });

  it('supports configurable prediction horizon (e.g. 1 to 6 steps)', () => {
    engine.setHorizon(6);
    expect(engine.getHorizon()).toBe(6);

    const prediction = engine.generatePrediction(mockTarget, [], 20);
    expect(prediction.steps).toBeDefined();
    expect(prediction.steps!).toHaveLength(6);
    expect(prediction.predictedGhosts).toHaveLength(6);
    expect(prediction.predictedTrajectory).toHaveLength(6);
    expect(prediction.steps![5].stepOffset).toBe(6);
  });

function createTestImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  return {
    width,
    height,
    data,
    colorSpace: 'srgb',
  } as unknown as ImageData;
}

function renderBlob(
  img: ImageData,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number
) {
  const data = img.data;
  const w = img.width;
  const h = img.height;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(w - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(h - 1, Math.ceil(cy + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= radius) {
        const idx = (y * w + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
  }
}

  it('integrates cleanly with the cognitive loop and scientific evaluation subsystem', () => {
    const cognitiveEngine = new AvicaCognitiveEngine();
    cognitiveEngine.setMode('AVICA_ACTIVE');
    cognitiveEngine.reset();

    const evaluationSubsystem = new ScientificEvaluationSubsystem();
    evaluationSubsystem.reset();

    // Run 10 frames with moving target blob
    for (let f = 0; f < 10; f++) {
      const frameData = createTestImage(640, 400);
      // Moving cyan target (r:0, g:220, b:240)
      const targetX = 200 + f * 10;
      const targetY = 150 + f * 5;
      renderBlob(frameData, targetX, targetY, 18, 0, 220, 240);

      const cycleResult = cognitiveEngine.processFrame(frameData);
      const gt = {
        frameId: f + 1,
        target: {
          id: 'target_0',
          name: 'Target Object',
          isTarget: true,
          isDistractor: false,
          position: { x: targetX / 640, y: targetY / 400, z: 1.0 },
          size: 0.05,
          isOccluded: false,
          box: { x: (targetX - 18) / 640, y: (targetY - 18) / 400, width: 36 / 640, height: 36 / 400 },
        },
        occluder: { x: 0.5, y: 0.2, width: 0.15, height: 0.6 },
        entities: [],
        timestamp: Date.now(),
      };

      const evalResult = evaluationSubsystem.evaluateCycle(cycleResult, gt, 5.0);

      expect(cycleResult.prediction).toBeDefined();
      expect(cycleResult.prediction.horizon).toBe(4);
      expect(cycleResult.prediction.predictedGhosts).toBeDefined();

      if (f >= 3 && cycleResult.workingMemoryEntities.some((e) => e.isTarget)) {
        expect(cycleResult.prediction.steps).toBeDefined();
        expect(cycleResult.prediction.steps!.length).toBeGreaterThan(0);
        expect(evalResult.metrics.predictionHorizon).toBe(4);
      }
    }

    const finalMetrics = evaluationSubsystem.getMetrics();
    expect(finalMetrics.totalFrames).toBe(10);
    expect(finalMetrics.predictionHorizon).toBe(4);
  });
});
