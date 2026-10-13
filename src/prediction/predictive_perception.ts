/**
 * Predictive Perception Engine
 *
 * Implements actual future-state prediction across multi-step horizons:
 * - Predicts target position and bounding box at t+1, t+2, t+3, t+4 (and up to configurable horizon)
 * - Computes step-wise prediction confidence via Kalman covariance propagation
 * - Generates visual prediction ghosts for each step
 * - Evaluates actual prediction errors against subsequent real visual observations as frames arrive
 * - Maintains real empirical horizon metrics (t+1, t+2, t+3, t+4) without fabricated data
 */

import {
  Vector3D,
  BoundingBox,
  PredictionState,
  PredictionStep,
  PredictionGhost,
  HorizonPredictionMetrics,
  WorkingMemoryEntity,
  SpatialRelationship,
} from '../types/avica';

export interface PendingPredictionRecord {
  predictedAtFrame: number;
  targetFrame: number;
  stepOffset: number; // 1..horizon
  predictedPos: Vector3D;
  predictedBox: BoundingBox;
  confidence: number;
  positionVariance: number;
}

export class PredictivePerceptionEngine {
  private horizon = 4; // Default 4 steps: t+1, t+2, t+3, t+4
  private pendingPredictions: PendingPredictionRecord[] = [];
  private maxHistoryPerHorizon = 60;

  // Running metrics per horizon step (1..4)
  private horizonMetrics: Record<number, HorizonPredictionMetrics> = {
    1: { stepOffset: 1, meanError: 0, sampleCount: 0, recentErrors: [], confidence: 1.0 },
    2: { stepOffset: 2, meanError: 0, sampleCount: 0, recentErrors: [], confidence: 0.85 },
    3: { stepOffset: 3, meanError: 0, sampleCount: 0, recentErrors: [], confidence: 0.72 },
    4: { stepOffset: 4, meanError: 0, sampleCount: 0, recentErrors: [], confidence: 0.60 },
  };

  private currentPrediction: PredictionState = {
    horizon: 4,
    steps: [],
    predictedTargetPos: null,
    actualTargetPos: null,
    predictionError: 0.0,
    meanPredictionError: 0.0,
    horizonMetrics: {},
    predictedTrajectory: [],
    predictedGhosts: [],
    predictedNextState: 'INITIALIZING',
    actualNextState: 'INITIALIZING',
    occlusionImminent: false,
  };

  private allMeasuredErrors: number[] = [];

  constructor(horizon = 4) {
    this.setHorizon(horizon);
  }

  public setHorizon(horizon: number): void {
    this.horizon = Math.max(1, Math.min(8, Math.round(horizon)));
    for (let k = 1; k <= this.horizon; k++) {
      if (!this.horizonMetrics[k]) {
        this.horizonMetrics[k] = {
          stepOffset: k,
          meanError: 0,
          sampleCount: 0,
          recentErrors: [],
          confidence: Math.max(0.1, 1.0 - (k - 1) * 0.12),
        };
      }
    }
  }

  public getHorizon(): number {
    return this.horizon;
  }

  public reset(): void {
    this.pendingPredictions = [];
    this.allMeasuredErrors = [];
    for (let k = 1; k <= this.horizon; k++) {
      this.horizonMetrics[k] = {
        stepOffset: k,
        meanError: 0,
        sampleCount: 0,
        recentErrors: [],
        confidence: Math.max(0.1, 1.0 - (k - 1) * 0.12),
      };
    }
    this.currentPrediction = {
      horizon: this.horizon,
      steps: [],
      predictedTargetPos: null,
      actualTargetPos: null,
      predictionError: 0.0,
      meanPredictionError: 0.0,
      horizonMetrics: { ...this.horizonMetrics },
      predictedTrajectory: [],
      predictedGhosts: [],
      predictedNextState: 'INITIALIZING',
      actualNextState: 'INITIALIZING',
      occlusionImminent: false,
    };
  }

  /**
   * Generates genuine future-state predictions for t+1, t+2, t+3, t+4
   * based on the target entity's current visual/kinematic state.
   */
  public generatePrediction(
    target: WorkingMemoryEntity | undefined,
    relationships: SpatialRelationship[],
    currentFrame = 0
  ): PredictionState {
    if (!target) {
      this.currentPrediction = {
        horizon: this.horizon,
        steps: [],
        predictedTargetPos: null,
        actualTargetPos: null,
        predictionError: this.currentPrediction.predictionError,
        meanPredictionError: this.getMeanError(),
        horizonMetrics: { ...this.horizonMetrics },
        predictedTrajectory: [],
        predictedGhosts: [],
        predictedNextState: 'UNKNOWN',
        actualNextState: 'UNKNOWN',
        occlusionImminent: false,
      };
      return this.currentPrediction;
    }

    // Kinematic parameters from target (using Kalman filtered velocity if available)
    const dt = 1.0;
    const vx = target.kalmanState?.vx ?? target.velocity.x;
    const vy = target.kalmanState?.vy ?? target.velocity.y;
    const vz = target.velocity.z ?? 0;

    const baseVariance = target.kalmanState?.positionVariance ?? 0.005;
    const processNoiseGrowth = 0.0035; // variance expansion per step
    const baseConfidence = Math.max(0.1, Math.min(1.0, target.confidence));

    const steps: PredictionStep[] = [];
    const ghosts: PredictionGhost[] = [];
    const trajectory: Vector3D[] = [];

    const bw = target.boundingBox?.width ?? 0.08;
    const bh = target.boundingBox?.height ?? 0.08;

    for (let k = 1; k <= this.horizon; k++) {
      // Kinematic projection at step k
      const projX = Math.max(0.04, Math.min(0.96, target.position.x + vx * dt * k));
      const projY = Math.max(0.04, Math.min(0.96, target.position.y + vy * dt * k));
      const projZ = target.position.z + vz * dt * k;

      const predictedPos: Vector3D = {
        x: Math.round(projX * 10000) / 10000,
        y: Math.round(projY * 10000) / 10000,
        z: Math.round(projZ * 10000) / 10000,
      };

      const predictedBox: BoundingBox = {
        x: Math.max(0, predictedPos.x - bw / 2),
        y: Math.max(0, predictedPos.y - bh / 2),
        width: bw,
        height: bh,
      };

      // Propagate variance over horizon: Var(k) = Var_0 + k * Q
      const propagatedVariance = baseVariance + k * processNoiseGrowth;

      // Physically grounded confidence decay based on propagated variance:
      // Monotonically decreases with horizon step k: C(t+1) > C(t+2) > C(t+3) > C(t+4)
      const varianceExpansion = Math.sqrt(Math.max(0, propagatedVariance - baseVariance));
      const stepConfidence = Math.max(
        0.05,
        Math.min(
          1.0,
          Math.round(
            (baseConfidence / (1.0 + 2.2 * varianceExpansion) * Math.pow(0.92, k - 1)) * 1000
          ) / 1000
        )
      );

      // Update horizon confidence metric
      if (this.horizonMetrics[k]) {
        this.horizonMetrics[k].confidence = stepConfidence;
      }

      const targetFrame = currentFrame + k;

      const step: PredictionStep = {
        stepOffset: k,
        targetFrame,
        predictedPos,
        predictedBox,
        confidence: stepConfidence,
        positionVariance: Math.round(propagatedVariance * 10000) / 10000,
        evaluated: false,
      };
      steps.push(step);

      // Prediction Ghost for rendering
      ghosts.push({
        step: k,
        position: predictedPos,
        boundingBox: predictedBox,
        confidence: stepConfidence,
        label: `t+${k}`,
        variance: propagatedVariance,
      });

      trajectory.push(predictedPos);

      // Enqueue pending prediction record to be evaluated when currentFrame reaches targetFrame
      this.pendingPredictions.push({
        predictedAtFrame: currentFrame,
        targetFrame,
        stepOffset: k,
        predictedPos,
        predictedBox,
        confidence: stepConfidence,
        positionVariance: propagatedVariance,
      });
    }

    // Cull old pending predictions that were never matched (older than 30 frames)
    if (this.pendingPredictions.length > 200) {
      this.pendingPredictions = this.pendingPredictions.filter(
        (p) => p.targetFrame >= currentFrame - 10
      );
    }

    // Check if any relationship indicates imminent occlusion
    const isApproachingOccluder = relationships.some(
      (r) =>
        r.targetId === target.id &&
        (r.relation === 'OCCLUDING' || (r.relation === 'APPROACHING' && r.distance2D < 0.12))
    );

    let predictedState = isApproachingOccluder ? 'APPROACHING_OCCLUSION' : 'TRAJECTORY_FOLLOWING';
    if (target.trackingLifecycleState === 'OCCLUDED' || target.trackingLifecycleState === 'MEMORY_RETAINED') {
      predictedState = 'OCCLUDED_KINEMATIC_PROPAGATION';
    } else if (target.trackingLifecycleState === 'PREDICTION' || target.trackingLifecycleState === 'ACTIVE_SEARCH') {
      predictedState = 'RE_EMERGENCE_SEARCH';
    } else if (target.trackingLifecycleState === 'RECOVERED') {
      predictedState = 'TARGET_RECOVERED_TRACKING';
    }

    this.currentPrediction = {
      horizon: this.horizon,
      steps,
      predictedTargetPos: steps.length > 0 ? steps[0].predictedPos : null, // t+1 pos
      actualTargetPos: target.position,
      predictionError: this.currentPrediction.predictionError,
      meanPredictionError: this.getMeanError(),
      horizonMetrics: { ...this.horizonMetrics },
      predictedTrajectory: trajectory,
      predictedGhosts: ghosts,
      predictedNextState: predictedState,
      actualNextState: target.trackingLifecycleState ?? target.currentState,
      occlusionImminent: isApproachingOccluder || target.isOccluded,
    };

    return this.currentPrediction;
  }

  /**
   * Evaluates prediction error against subsequent actual visual observation
   * at currentFrame.
   *
   * Finds all predictions that were scheduled for this frame (t+1 from f-1,
   * t+2 from f-2, t+3 from f-3, t+4 from f-4) and measures real Euclidean error.
   */
  public evaluatePredictionErrorAgainstObservation(
    currentFrame: number,
    actualPos: Vector3D
  ): {
    evaluatedSteps: Record<number, number>;
    t1Error: number | null;
    meanError: number;
  } {
    const evaluatedSteps: Record<number, number> = {};
    let t1Error: number | null = null;

    // Find pending predictions scheduled for this exact frame
    const matchedIndices: number[] = [];
    for (let i = 0; i < this.pendingPredictions.length; i++) {
      const pending = this.pendingPredictions[i];
      if (pending.targetFrame === currentFrame) {
        matchedIndices.push(i);

        const dx = actualPos.x - pending.predictedPos.x;
        const dy = actualPos.y - pending.predictedPos.y;
        const dz = actualPos.z - pending.predictedPos.z;
        const error = Math.round(Math.hypot(dx, dy, dz) * 10000) / 10000;

        evaluatedSteps[pending.stepOffset] = error;

        // Record into horizon-specific metrics
        const metric = this.horizonMetrics[pending.stepOffset];
        if (metric) {
          metric.recentErrors.push(error);
          if (metric.recentErrors.length > this.maxHistoryPerHorizon) {
            metric.recentErrors.shift();
          }
          metric.sampleCount++;
          const sum = metric.recentErrors.reduce((a, b) => a + b, 0);
          metric.meanError = Math.round((sum / metric.recentErrors.length) * 10000) / 10000;
        }

        this.allMeasuredErrors.push(error);
        if (this.allMeasuredErrors.length > 200) {
          this.allMeasuredErrors.shift();
        }

        if (pending.stepOffset === 1) {
          t1Error = error;
        }
      }
    }

    // Remove matched pending predictions
    if (matchedIndices.length > 0) {
      const matchSet = new Set(matchedIndices);
      this.pendingPredictions = this.pendingPredictions.filter((_, idx) => !matchSet.has(idx));
    }

    if (t1Error !== null) {
      this.currentPrediction.actualTargetPos = actualPos;
      this.currentPrediction.predictionError = t1Error;
    }
    this.currentPrediction.meanPredictionError = this.getMeanError();
    this.currentPrediction.horizonMetrics = { ...this.horizonMetrics };

    return {
      evaluatedSteps,
      t1Error,
      meanError: this.currentPrediction.meanPredictionError,
    };
  }

  /**
   * Backward-compatible 1-step error evaluation
   */
  public evaluatePredictionError(actualPos: Vector3D): number {
    if (!this.currentPrediction.predictedTargetPos) return 0;

    const dx = actualPos.x - this.currentPrediction.predictedTargetPos.x;
    const dy = actualPos.y - this.currentPrediction.predictedTargetPos.y;
    const dz = actualPos.z - this.currentPrediction.predictedTargetPos.z;
    const error = Math.round(Math.hypot(dx, dy, dz) * 10000) / 10000;

    this.currentPrediction.actualTargetPos = actualPos;
    this.currentPrediction.predictionError = error;

    const metric = this.horizonMetrics[1];
    if (metric) {
      metric.recentErrors.push(error);
      if (metric.recentErrors.length > this.maxHistoryPerHorizon) metric.recentErrors.shift();
      metric.sampleCount++;
      const sum = metric.recentErrors.reduce((a, b) => a + b, 0);
      metric.meanError = Math.round((sum / metric.recentErrors.length) * 10000) / 10000;
    }

    this.allMeasuredErrors.push(error);
    if (this.allMeasuredErrors.length > 200) this.allMeasuredErrors.shift();
    this.currentPrediction.meanPredictionError = this.getMeanError();

    return error;
  }

  public getPrediction(): PredictionState {
    return this.currentPrediction;
  }

  public getMeanError(): number {
    if (this.allMeasuredErrors.length === 0) return 0;
    const sum = this.allMeasuredErrors.reduce((a, b) => a + b, 0);
    return Math.round((sum / this.allMeasuredErrors.length) * 10000) / 10000;
  }

  public getHorizonMetrics(): Record<number, HorizonPredictionMetrics> {
    return { ...this.horizonMetrics };
  }

  public getMeanErrorForStep(step: number): number {
    return this.horizonMetrics[step]?.meanError ?? 0;
  }
}
