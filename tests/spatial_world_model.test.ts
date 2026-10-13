import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialWorldModelEngine } from '../src/spatial/spatial_world_model';
import { FeatureMatchingEngine } from '../src/spatial/feature_matching';
import { MultiViewReconstructionEngine } from '../src/spatial/multi_view_reconstruction';
import { WorkingMemoryEntity } from '../src/types/avica';
import { AvicaCognitiveEngine } from '../src/core/cognitive_loop';

describe('Spatial World Model Upgrade (Phase F)', () => {
  let engine: SpatialWorldModelEngine;

  const mockEntities: WorkingMemoryEntity[] = [
    {
      id: 'target-01',
      label: 'Target Cyan Disk',
      visualEmbedding: [0.6, 0.8, 0.1, 0.2, 0.9, 0.3, 0.4, 0.5],
      position: { x: 0.35, y: 0.5, z: 0.3 }, // x, y, relative depth z
      velocity: { x: 0.02, y: 0.01, z: 0.005 },
      boundingBox: { x: 0.31, y: 0.46, width: 0.08, height: 0.08 },
      confidence: 0.94,
      epistemicUncertainty: 0.06,
      previousState: 'INITIALIZING',
      currentState: 'TRACKING',
      trackingLifecycleState: 'TRACKING',
      observedAction: 'MOVE',
      relationships: [],
      firstObservedTimestamp: 1000,
      lastObservedTimestamp: 1200,
      observationCount: 10,
      decayRate: 0.05,
      isTarget: true,
      isOccluded: false,
    },
    {
      id: 'distractor-01',
      label: 'Distractor Sky Blue',
      visualEmbedding: [0.55, 0.75, 0.15, 0.2, 0.85, 0.35, 0.4, 0.5],
      position: { x: 0.65, y: 0.5, z: 0.6 }, // to the right, farther depth
      velocity: { x: -0.015, y: 0.005, z: 0 }, // converging horizontally toward target
      boundingBox: { x: 0.61, y: 0.46, width: 0.08, height: 0.08 },
      confidence: 0.88,
      epistemicUncertainty: 0.12,
      previousState: 'INITIALIZING',
      currentState: 'TRACKING',
      trackingLifecycleState: 'TRACKING',
      observedAction: 'MOVE',
      relationships: [],
      firstObservedTimestamp: 1000,
      lastObservedTimestamp: 1200,
      observationCount: 10,
      decayRate: 0.05,
      isTarget: false,
      isOccluded: false,
    },
    {
      id: 'occluder-01',
      label: 'Occluder Pillar',
      visualEmbedding: [0.1, 0.2, 0.3, 0.1, 0.2, 0.1, 0.1, 0.2],
      position: { x: 0.36, y: 0.5, z: 0.15 }, // same 2D position as target, but CLOSER (smaller z)
      velocity: { x: 0, y: 0, z: 0 },
      boundingBox: { x: 0.30, y: 0.42, width: 0.14, height: 0.16 },
      confidence: 0.95,
      epistemicUncertainty: 0.05,
      previousState: 'STATIC',
      currentState: 'STATIC',
      trackingLifecycleState: 'TRACKING',
      observedAction: 'STATIONARY',
      relationships: [],
      firstObservedTimestamp: 1000,
      lastObservedTimestamp: 1200,
      observationCount: 10,
      decayRate: 0.05,
      isTarget: false,
      isOccluded: false,
    },
  ];

  beforeEach(() => {
    engine = new SpatialWorldModelEngine();
  });

  describe('1. Explicit Modality Distinction (2D, Relative Depth, Metric Depth)', () => {
    it('strictly separates 2D position and relative monocular depth in uncalibrated monocular mode', () => {
      engine.setMultiViewEnabled(false);
      const model = engine.updateWorldModel(mockEntities, 2000);

      const target = model.entities['target-01'];
      expect(target).toBeDefined();

      // 1. 2D Position
      expect(target.position2D).toBeDefined();
      expect(target.position2D?.x).toBe(0.35);
      expect(target.position2D?.y).toBe(0.5);
      expect(target.position2D?.pixelX).toBe(Math.round(0.35 * 640));

      // 2. Relative Monocular Depth
      expect(target.relativeDepth).toBeDefined();
      expect(target.relativeDepth?.depth).toBe(0.3);
      expect(target.relativeDepth?.cueSource).toBe('SCALE_AND_GROUND_PLANE');
      expect(target.relativeDepth?.description).toContain('Monocular relative depth rank');

      // 3. True Metric Depth must NOT be claimed under monocular mode!
      expect(target.metricDepth).toBeDefined();
      expect(target.metricDepth?.isReconstructed).toBe(false);
      expect(target.metricDepth?.metricZ).toBeUndefined();
      expect(target.metricDepth?.method).toBe('NONE_MONOCULAR_UNCALIBRATED');
      expect(target.metricDepth?.statusExplanation).toContain('Metric depth NOT reconstructed');

      // Modality status check
      expect(model.depthModalityStatus?.has2DPositions).toBe(true);
      expect(model.depthModalityStatus?.hasRelativeMonocularDepth).toBe(true);
      expect(model.depthModalityStatus?.hasTrueMetricDepth).toBe(false);
      expect(model.depthModalityStatus?.activeMode).toBe('MONOCULAR');
    });

    it('claims true metric 3D ONLY when experimental multi-view stereo reconstruction is enabled', () => {
      engine.setMultiViewEnabled(true);
      const model = engine.updateWorldModel(mockEntities, 2000);

      const target = model.entities['target-01'];
      expect(target.metricDepth?.isReconstructed).toBe(true);
      expect(typeof target.metricDepth?.metricZ).toBe('number');
      expect(target.metricDepth?.metricZ).toBeGreaterThan(0);
      expect(target.metricDepth?.baselineMeters).toBe(0.25);
      expect(target.metricDepth?.method).toBe('STEREO_TRIANGULATION');
      expect(target.metricDepth?.reprojectionErrorPx).toBeDefined();

      // Spatial velocity should now include metric velocities (m/s)
      expect(target.spatialVelocity?.speedMetricMps).toBeDefined();
      expect(target.spatialVelocity?.speedMetricMps).toBeGreaterThan(0);

      expect(model.depthModalityStatus?.hasTrueMetricDepth).toBe(true);
      expect(model.depthModalityStatus?.activeMode).toBe('EXPERIMENTAL_MULTIVIEW');
    });
  });

  describe('2. Pairwise Spatial & Topological Relationships', () => {
    it('infers directional, depth ordering, occlusion, and converging kinematic predicates', () => {
      const model = engine.updateWorldModel(mockEntities, 2000);

      const rels = model.relationships;
      expect(rels.length).toBeGreaterThan(0);

      // Target (x=0.35) vs Distractor (x=0.65) -> Target is LEFT_OF distractor
      const leftRel = rels.find(
        (r) => r.sourceId === 'target-01' && r.targetId === 'distractor-01' && r.relation === 'LEFT_OF'
      );
      expect(leftRel).toBeDefined();
      expect(leftRel?.confidence).toBeGreaterThan(0.9);

      // Distractor (z=0.6) is FARTHER_THAN Target (z=0.3)
      const fartherRel = rels.find(
        (r) => r.sourceId === 'distractor-01' && r.targetId === 'target-01' && r.relation === 'FARTHER_THAN'
      );
      expect(fartherRel).toBeDefined();

      // Occluder (x=0.36, y=0.5, z=0.15) overlaps Target (x=0.35, y=0.5, z=0.30) with z < target.z -> OCCLUDING
      const occRel = rels.find(
        (r) => r.sourceId === 'occluder-01' && r.targetId === 'target-01' && r.relation === 'OCCLUDING'
      );
      expect(occRel).toBeDefined();
      expect(occRel?.explanation).toContain('occludes');

      // Target (vx=0.02) and Distractor (vx=-0.015) are moving toward each other -> APPROACHING
      const approachRel = rels.find(
        (r) => r.relation === 'APPROACHING' &&
               ((r.sourceId === 'target-01' && r.targetId === 'distractor-01') ||
                (r.sourceId === 'distractor-01' && r.targetId === 'target-01'))
      );
      expect(approachRel).toBeDefined();
      expect(approachRel?.relation).toBe('APPROACHING');
    });
  });

  describe('3. Multi-Object Spatial Reasoning Queries', () => {
    beforeEach(() => {
      engine.updateWorldModel(mockEntities, 2000);
    });

    it('answers Query 1: closest entity to target in 2D and 3D', () => {
      const res = engine.queryClosestToTarget();
      expect(res.entity).toBeDefined();
      expect(res.entity?.id).toBe('occluder-01'); // occluder is right next to target
      expect(res.distance2D).toBeLessThan(0.1);
      expect(res.distance3D).toBeLessThan(0.2);
    });

    it('answers Query 2: moving entities ranked by velocity', () => {
      const moved = engine.queryMovedObjects(0.01);
      expect(moved.length).toBeGreaterThanOrEqual(2);
      expect(moved[0].entity.id).toBe('target-01');
      expect(moved[0].speed2D).toBeGreaterThan(0.015);
      expect(moved[0].direction).toBeDefined();
    });

    it('answers Query 3: approaching pairs with time-to-closest-approach (TCA)', () => {
      const pairs = engine.queryApproachingPairs();
      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs[0].tcaFrames).toBeGreaterThan(0);
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(pairs[0].collisionRisk);
    });

    it('answers Query 4: occlusion chains', () => {
      const chains = engine.queryOcclusionChains();
      expect(chains.length).toBeGreaterThan(0);
      expect(chains[0].occluder).toBe('occluder-01');
      expect(chains[0].occluded).toBe('target-01');
    });

    it('answers Query 5: spatial clusters', () => {
      const clusters = engine.querySpatialClusters();
      expect(clusters.length).toBeGreaterThan(0);
      // Occluder and target should be clustered together due to high proximity
      const targetCluster = clusters.find((c) => c.members.includes('target-01'));
      expect(targetCluster).toBeDefined();
      expect(targetCluster?.members).toContain('occluder-01');
    });

    it('answers Query 6: entities between two objects', () => {
      // Create a test setup where entity C is between A and B
      const lineEntities: WorkingMemoryEntity[] = [
        { ...mockEntities[0], id: 'pointA', position: { x: 0.1, y: 0.5, z: 0.2 } },
        { ...mockEntities[1], id: 'pointMiddle', position: { x: 0.5, y: 0.5, z: 0.2 } },
        { ...mockEntities[2], id: 'pointB', position: { x: 0.9, y: 0.5, z: 0.2 } },
      ];
      engine.updateWorldModel(lineEntities, 2100);

      const between = engine.queryBetweenPairs('pointA', 'pointB');
      expect(between.length).toBe(1);
      expect(between[0].id).toBe('pointMiddle');
    });
  });

  describe('4. Feature Matching Engine', () => {
    it('extracts keypoints, computes 16-dim descriptors, and performs Lowe ratio test matching', () => {
      const featureMatcher = new FeatureMatchingEngine();
      const kpsA = featureMatcher.extractEntityKeypoints(
        'target-01',
        mockEntities[0].boundingBox,
        mockEntities[0].visualEmbedding,
        640,
        400
      );

      expect(kpsA.length).toBe(6);
      expect(kpsA[0].descriptor.length).toBe(16);

      // Slightly shifted bounding box (simulating temporal frame or stereo view)
      const shiftedBox = { ...mockEntities[0].boundingBox, x: mockEntities[0].boundingBox.x - 0.03 };
      const kpsB = featureMatcher.extractEntityKeypoints(
        'target-01',
        shiftedBox,
        mockEntities[0].visualEmbedding,
        640,
        400
      );

      const report = featureMatcher.matchKeypoints(kpsA, kpsB, true);
      expect(report.matches.length).toBe(6);
      expect(report.inlierMatches.length).toBeGreaterThan(0);
      expect(report.inlierRatio).toBeGreaterThan(0.5);
      expect(report.meanDisparityPx).toBeGreaterThan(0);
    });
  });

  describe('5. Experimental Multi-View Stereo Disparity Triangulation', () => {
    it('computes optical disparity and triangulates metric depth with low reprojection error', () => {
      const multiViewEngine = new MultiViewReconstructionEngine({
        cameraBaselineMeters: 0.25,
        focalLengthPx: 640,
      });

      // Default: disabled -> returns monocular report without metric claims
      multiViewEngine.setMultiViewEnabled(false);
      let report = multiViewEngine.reconstructScene(mockEntities, 1000);
      expect(report.isMetricReconstructed).toBe(false);
      expect(report.status).toBe('MONOCULAR_RELATIVE_ONLY');

      // Enabled: runs stereo feature matching and triangulation
      multiViewEngine.setMultiViewEnabled(true);
      report = multiViewEngine.reconstructScene(mockEntities, 1000);
      expect(report.isMetricReconstructed).toBe(true);
      expect(report.status).toBe('ACTIVE_STEREO_RECONSTRUCTED');
      expect(report.cameraBaselineMeters).toBe(0.25);

      const reconTarget = report.reconstructedEntities['target-01'];
      expect(reconTarget).toBeDefined();
      expect(reconTarget.metricZ).toBeGreaterThan(0.5); // physical depth in meters
      expect(reconTarget.metricZ).toBeLessThan(5.0);
      expect(reconTarget.disparityPx).toBeGreaterThan(10);
      expect(reconTarget.reprojectionErrorPx).toBeLessThan(2.0); // low subpixel residual
      expect(report.meanReprojectionErrorPx).toBeDefined();
    });
  });

  describe('6. Spatial World Model Benchmark Metrics', () => {
    it('tracks temporal depth consistency and spatial relationship counts', () => {
      engine.updateWorldModel(mockEntities, 1000);
      engine.updateWorldModel(mockEntities, 1033);

      const metrics = engine.getSpatialMetrics();
      expect(metrics.spatialRelationshipCount).toBeGreaterThan(0);
      expect(metrics.relativeDepthConsistency).toBe(100);
      expect(metrics.multiObjectReasoningLatencyMs).toBeGreaterThan(0);
    });
  });

  describe('7. End-to-End Integration in Cognitive Loop', () => {
    it('cognitive loop processes frames and updates spatial world model and telemetry', () => {
      const cognitiveEngine = new AvicaCognitiveEngine();
      cognitiveEngine.reset();

      // Create fake 640x400 ImageData
      const width = 640;
      const height = 400;
      const buffer = new Uint8ClampedArray(width * height * 4);
      // Fill background
      for (let i = 0; i < buffer.length; i += 4) {
        buffer[i] = 15;
        buffer[i + 1] = 23;
        buffer[i + 2] = 42;
        buffer[i + 3] = 255;
      }
      const imgData = {
        data: buffer,
        width,
        height,
        colorSpace: 'srgb' as PredefinedColorSpace,
      } as ImageData;

      const result = cognitiveEngine.processFrame(imgData);
      expect(result.worldModel).toBeDefined();
      expect(result.worldModel.depthModalityStatus).toBeDefined();
      expect(result.worldModel.depthModalityStatus?.has2DPositions).toBe(true);
      expect(result.worldModel.depthModalityStatus?.hasRelativeMonocularDepth).toBe(true);
      expect(result.metrics.spatialRelationshipCount).toBeDefined();
      expect(result.metrics.relativeDepthConsistency).toBeDefined();
    });
  });
});
