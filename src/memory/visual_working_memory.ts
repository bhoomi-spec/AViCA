/**
 * Visual Working Memory (VWM) Module with Temporal Tracking & Kinematic Persistence
 *
 * Implements:
 * - Entity persistence across frames
 * - Multi-feature temporal association (spatial, Kalman innovation, appearance memory)
 * - Appearance memory preservation across occlusions
 * - 2D Kalman filter for continuous kinematic state estimation (position, velocity, covariance)
 * - Explicit tracking lifecycle machine:
 *   DETECTED → TRACKING → OCCLUDED → MEMORY_RETAINED → PREDICTION → ACTIVE_SEARCH → RECOVERED
 * - Memory decay and selective forgetting
 * - Predictive re-emergence ROI generation for active search
 */

import {
  WorkingMemoryEntity,
  Vector3D,
  BoundingBox,
  TrackingLifecycleState,
} from '../types/avica';
import { calculateEmbeddingDistance } from '../perception/low_level';
import { KalmanTrackingFilter } from '../tracking/kalman_filter';
import { AppearanceMemory } from './appearance_memory';

export interface VWMConfig {
  confidenceDecayRate: number; // e.g. 0.04 per unobserved frame
  forgettingThreshold: number; // e.g. 0.18 threshold for non-target removal
  maxMemoryCapacity: number; // maximum entity slots (e.g. 12)
  spatialMatchDistanceThreshold: number; // max normalized distance for matching
  featureSimilarityThreshold: number; // min feature cosine match
}

export const DEFAULT_VWM_CONFIG: VWMConfig = {
  confidenceDecayRate: 0.04,
  forgettingThreshold: 0.18,
  maxMemoryCapacity: 12,
  spatialMatchDistanceThreshold: 0.22,
  featureSimilarityThreshold: 0.48,
};

interface EntityInternals {
  kalman: KalmanTrackingFilter;
  appearance: AppearanceMemory;
}

export class VisualWorkingMemory {
  private entities: Map<string, WorkingMemoryEntity> = new Map();
  private entityInternals: Map<string, EntityInternals> = new Map();
  private config: VWMConfig;
  private memoryHistoryLogs: string[] = [];

  constructor(config: Partial<VWMConfig> = {}) {
    this.config = { ...DEFAULT_VWM_CONFIG, ...config };
  }

  /**
   * Associates an image-perceived candidate observation with existing working memory slots
   * using Kalman-predicted spatial distance and appearance memory similarity.
   * Strictly decoupled from simulator ground truth.
   */
  public associateObservation(
    observedBox: BoundingBox,
    embedding: number[],
    estimatedDepth: number,
    frameTimestamp: number,
    perceivedLabel: string,
    perceivedIsTarget: boolean,
    candidateHue?: number,
    candidateCircularity?: number
  ): { entityId: string; wasNew: boolean; matchDistance: number; isRecovery: boolean } {
    let bestMatchId: string | null = null;
    let lowestDistance = Infinity;

    const obsCenter = {
      x: observedBox.x + observedBox.width / 2,
      y: observedBox.y + observedBox.height / 2,
      z: estimatedDepth,
    };

    // Attempt temporal association using Kalman prediction and appearance memory
    for (const [id, entity] of this.entities.entries()) {
      const internals = this.entityInternals.get(id);

      // Compare against Kalman state if available, otherwise last position
      const refX = entity.kalmanState?.x ?? entity.position.x;
      const refY = entity.kalmanState?.y ?? entity.position.y;

      const spatialDist = Math.hypot(obsCenter.x - refX, obsCenter.y - refY);

      // Appearance comparison
      let featDist = 0.5;
      if (internals) {
        const appEval = internals.appearance.evaluateCandidate(
          {
            id: 'temp',
            box: observedBox,
            salienceScore: 0.8,
            featureSimilarity: perceivedIsTarget ? 0.9 : 0.4,
            isInspected: true,
            targetProbability: perceivedIsTarget ? 0.9 : 0.4,
            status: perceivedIsTarget ? 'CONFIRMED_TARGET' : 'PENDING',
            colorFeatures: candidateHue !== undefined ? { hue: candidateHue, saturation: 80, brightness: 75, colorMatchScore: 0.8 } : undefined,
            shapeFeatures: candidateCircularity !== undefined ? { circularity: candidateCircularity, aspectRatio: 1.0, area: 400, perimeter: 80, shapeMatchScore: 0.8 } : undefined,
          },
          embedding
        );
        featDist = 1.0 - appEval.matchScore;
      } else {
        featDist = calculateEmbeddingDistance(embedding, entity.visualEmbedding);
      }

      // If target is occluded, expand spatial tolerance up to 0.35 if appearance is a strong match
      const maxSpatialDist = entity.isOccluded
        ? this.config.spatialMatchDistanceThreshold * 1.8
        : this.config.spatialMatchDistanceThreshold;

      const totalDist = spatialDist * 0.55 + featDist * 0.45;

      if (
        spatialDist < maxSpatialDist &&
        featDist < this.config.featureSimilarityThreshold &&
        totalDist < lowestDistance
      ) {
        lowestDistance = totalDist;
        bestMatchId = id;
      }
    }

    if (bestMatchId) {
      // Entity matched: update existing working memory slot
      const existing = this.entities.get(bestMatchId)!;
      let internals = this.entityInternals.get(bestMatchId);
      if (!internals) {
        internals = {
          kalman: new KalmanTrackingFilter(existing.position.x, existing.position.y),
          appearance: new AppearanceMemory(existing.visualEmbedding, candidateHue, candidateCircularity),
        };
        this.entityInternals.set(bestMatchId, internals);
      }

      // Kalman filter measurement update with observed centroid
      const kalmanState = internals.kalman.update(obsCenter.x, obsCenter.y);

      // Appearance memory update
      internals.appearance.update(embedding, candidateHue, candidateCircularity, frameTimestamp);

      // Check if this is an occlusion recovery event!
      let isRecovery = false;
      const wasOccluded =
        existing.isOccluded ||
        existing.trackingLifecycleState === 'OCCLUDED' ||
        existing.trackingLifecycleState === 'MEMORY_RETAINED' ||
        existing.trackingLifecycleState === 'PREDICTION' ||
        existing.trackingLifecycleState === 'ACTIVE_SEARCH';

      if (existing.isTarget && wasOccluded) {
        isRecovery = true;
        existing.trackingLifecycleState = 'RECOVERED';
        this.logEvent(`[LIFECYCLE] Target ${bestMatchId} RECOVERED via fresh visual evidence! (dist=${lowestDistance.toFixed(3)})`);
      } else if (existing.isTarget) {
        const consecutiveTracked = (existing.consecutiveFramesTracked ?? 0) + 1;
        existing.consecutiveFramesTracked = consecutiveTracked;
        if (consecutiveTracked >= 2) {
          existing.trackingLifecycleState = 'TRACKING';
        } else {
          existing.trackingLifecycleState = 'DETECTED';
        }
      }

      const previousState = existing.currentState;
      const currentState =
        Math.hypot(kalmanState.vx, kalmanState.vy) > 0.001 ? 'TRACKING' : 'STATIONARY';

      existing.previousState = previousState;
      existing.currentState = currentState;
      // Use Kalman smoothed position and velocity
      existing.position = { x: kalmanState.x, y: kalmanState.y, z: estimatedDepth };
      existing.velocity = { x: kalmanState.vx, y: kalmanState.vy, z: 0 };
      existing.boundingBox = observedBox;
      existing.visualEmbedding = internals.appearance.getMeanEmbedding();
      existing.kalmanState = kalmanState;
      existing.appearanceMemory = internals.appearance.getAppearanceData();

      // Reinforce confidence
      existing.confidence = Math.min(1.0, existing.confidence + 0.35);
      existing.epistemicUncertainty = 1.0 - existing.confidence;
      existing.lastObservedTimestamp = frameTimestamp;
      existing.observationCount += 1;
      existing.consecutiveFramesOccluded = 0;
      existing.isOccluded = false;
      existing.predictedReemergenceRoi = undefined;
      if (perceivedIsTarget) existing.isTarget = true;

      this.logEvent(`Updated entity ${bestMatchId} (conf: ${existing.confidence.toFixed(2)}, state: ${existing.trackingLifecycleState ?? existing.currentState})`);
      return { entityId: bestMatchId, wasNew: false, matchDistance: lowestDistance, isRecovery };
    }

    // No match: Allocate new working memory slot
    const newId = `ENT-${Math.floor(1000 + Math.random() * 9000)}`;
    const kalman = new KalmanTrackingFilter(obsCenter.x, obsCenter.y);
    const appearance = new AppearanceMemory(embedding, candidateHue, candidateCircularity);

    const initialKalmanState = kalman.getState();
    const initialAppearanceData = appearance.getAppearanceData();

    const initialLifecycle: TrackingLifecycleState = perceivedIsTarget ? 'DETECTED' : 'INITIALIZED';

    const newEntity: WorkingMemoryEntity = {
      id: newId,
      label: perceivedLabel,
      visualEmbedding: [...embedding],
      position: obsCenter,
      velocity: { x: 0, y: 0, z: 0 },
      boundingBox: observedBox,
      confidence: 0.88,
      epistemicUncertainty: 0.12,
      previousState: 'INITIALIZED',
      currentState: perceivedIsTarget ? 'DETECTED' : 'INITIALIZED',
      trackingLifecycleState: initialLifecycle,
      kalmanState: initialKalmanState,
      appearanceMemory: initialAppearanceData,
      observedAction: 'ENTERED_FOV',
      relationships: [],
      firstObservedTimestamp: frameTimestamp,
      lastObservedTimestamp: frameTimestamp,
      observationCount: 1,
      consecutiveFramesTracked: 1,
      consecutiveFramesOccluded: 0,
      decayRate: this.config.confidenceDecayRate,
      isTarget: perceivedIsTarget,
      isOccluded: false,
    };

    // If at capacity, evict the entity with lowest confidence (never evict target)
    if (this.entities.size >= this.config.maxMemoryCapacity) {
      let lowestConfId: string | null = null;
      let minConf = Infinity;
      for (const [id, ent] of this.entities.entries()) {
        if (!ent.isTarget && ent.confidence < minConf) {
          minConf = ent.confidence;
          lowestConfId = id;
        }
      }
      if (lowestConfId) {
        this.entities.delete(lowestConfId);
        this.entityInternals.delete(lowestConfId);
        this.logEvent(`Memory capacity limit reached: Evicted ${lowestConfId}`);
      }
    }

    this.entities.set(newId, newEntity);
    this.entityInternals.set(newId, { kalman, appearance });
    this.logEvent(`Constructed new entity representation: ${newId} (lifecycle: ${initialLifecycle})`);
    return { entityId: newId, wasNew: true, matchDistance: 0, isRecovery: false };
  }

  /**
   * Applies temporal confidence decay to entities not observed in the current timestep.
   * Advances Kalman filter forward projection during occlusion.
   * Manages tracking lifecycle states:
   * TRACKING → OCCLUDED → MEMORY_RETAINED → PREDICTION → ACTIVE_SEARCH
   */
  public applyTemporalDecay(currentTimestamp: number, activeObservedIds: Set<string>): void {
    const toRemove: string[] = [];

    for (const [id, entity] of this.entities.entries()) {
      if (!activeObservedIds.has(id)) {
        const internals = this.entityInternals.get(id);

        // Forward propagation via Kalman Filter prediction step
        if (internals) {
          const projected = internals.kalman.predict(1.0);
          entity.position.x = projected.x;
          entity.position.y = projected.y;
          entity.velocity.x = projected.vx;
          entity.velocity.y = projected.vy;
          entity.kalmanState = projected;
        } else {
          entity.position.x += entity.velocity.x;
          entity.position.y += entity.velocity.y;
        }

        // Apply decay
        entity.confidence = Math.max(0.05, entity.confidence - entity.decayRate);
        entity.epistemicUncertainty = 1.0 - entity.confidence;
        entity.isOccluded = true;
        entity.currentState = 'OCCLUDED_OR_ABSENT';
        entity.consecutiveFramesOccluded = (entity.consecutiveFramesOccluded ?? 0) + 1;
        entity.consecutiveFramesTracked = 0;

        // Lifecycle state progression for target during occlusion
        if (entity.isTarget) {
          const occFrames = entity.consecutiveFramesOccluded;
          if (occFrames === 1) {
            entity.trackingLifecycleState = 'OCCLUDED';
            this.logEvent(`[LIFECYCLE] Target ${id} entered OCCLUDED state.`);
          } else if (occFrames === 2) {
            entity.trackingLifecycleState = 'MEMORY_RETAINED';
            this.logEvent(`[LIFECYCLE] Target ${id} MEMORY_RETAINED despite absent visual evidence (Kalman covariance expanding).`);
          } else if (occFrames === 3) {
            entity.trackingLifecycleState = 'PREDICTION';
            // Compute projected re-emergence ROI
            this.computeReemergenceRoi(entity, internals);
            this.logEvent(`[LIFECYCLE] Target ${id} PREDICTION generated re-emergence ROI.`);
          } else {
            entity.trackingLifecycleState = 'ACTIVE_SEARCH';
            this.computeReemergenceRoi(entity, internals);
            entity.searchAttempts = (entity.searchAttempts ?? 0) + 1;
          }
        } else {
          // Non-target entity forgetting
          if (entity.confidence <= this.config.forgettingThreshold) {
            toRemove.push(id);
          }
        }
      }
    }

    for (const id of toRemove) {
      this.entities.delete(id);
      this.entityInternals.delete(id);
      this.logEvent(`Entity ${id} forgotten due to confidence decay (<${this.config.forgettingThreshold})`);
    }
  }

  /**
   * Projects re-emergence ROI based on Kalman trajectory and positional uncertainty
   */
  private computeReemergenceRoi(
    entity: WorkingMemoryEntity,
    internals?: EntityInternals
  ): void {
    let projectedX = entity.position.x;
    let projectedY = entity.position.y;
    let variance = 0.04;

    if (internals) {
      const traj = internals.kalman.projectTrajectory(4, 1.0);
      const endPoint = traj[traj.length - 1];
      if (endPoint) {
        projectedX = endPoint.x;
        projectedY = endPoint.y;
        variance = endPoint.variance;
      }
    }

    // Size of search window proportional to uncertainty variance
    const roiSize = Math.max(0.12, Math.min(0.28, Math.sqrt(variance) * 2.5 + 0.10));

    entity.predictedReemergenceRoi = {
      x: Math.max(0.01, Math.min(0.99 - roiSize, projectedX - roiSize / 2)),
      y: Math.max(0.01, Math.min(0.99 - roiSize, projectedY - roiSize / 2)),
      width: roiSize,
      height: roiSize,
    };
  }

  public getEntities(): WorkingMemoryEntity[] {
    return Array.from(this.entities.values());
  }

  public getEntity(id: string): WorkingMemoryEntity | undefined {
    return this.entities.get(id);
  }

  public getTargetEntity(): WorkingMemoryEntity | undefined {
    for (const entity of this.entities.values()) {
      if (entity.isTarget) return entity;
    }
    return undefined;
  }

  public getTargetLifecycleState(): TrackingLifecycleState {
    const target = this.getTargetEntity();
    return target?.trackingLifecycleState ?? 'INITIALIZED';
  }

  public getSearchRoi(): BoundingBox | undefined {
    const target = this.getTargetEntity();
    return target?.predictedReemergenceRoi;
  }

  public setTargetLifecycleState(state: TrackingLifecycleState): void {
    const target = this.getTargetEntity();
    if (target) {
      target.trackingLifecycleState = state;
    }
  }

  public clear(): void {
    this.entities.clear();
    this.entityInternals.clear();
    this.memoryHistoryLogs = [];
  }

  public getLogs(): string[] {
    return [...this.memoryHistoryLogs];
  }

  private logEvent(msg: string) {
    this.memoryHistoryLogs.unshift(`[VWM] ${msg}`);
    if (this.memoryHistoryLogs.length > 60) this.memoryHistoryLogs.pop();
  }
}
