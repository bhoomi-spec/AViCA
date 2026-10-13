/**
 * Comprehensive Test Suite for OpenCV 5 Perception Layer
 * Tests actual OpenCV 5 WebAssembly execution on image buffers.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  getOpenCv,
  isOpenCvReady,
  OpenCvPerceptionEngine,
  createMatFromImageData,
} from '../src/perception/opencv_engine';
import {
  ClassicalVisionPipeline,
  DEFAULT_TARGET_QUERY,
} from '../src/perception/vision_pipeline';
import { AvicaCognitiveEngine } from '../src/core/cognitive_loop';

// Polyfill ImageData for headless test environment if needed
function makeImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  return {
    width,
    height,
    data,
    colorSpace: 'srgb',
  } as unknown as ImageData;
}

// Helper to draw a synthetic circle into an image buffer
function drawCircle(
  img: ImageData,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  hasInnerRing = false
) {
  const { width, height, data } = img;
  for (let y = Math.max(0, Math.floor(cy - radius - 2)); y < Math.min(height, Math.ceil(cy + radius + 2)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius - 2)); x < Math.min(width, Math.ceil(cx + radius + 2)); x++) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= radius) {
        const idx = (y * width + x) * 4;
        if (hasInnerRing && dist >= radius * 0.3 && dist <= radius * 0.45) {
          // White concentric inner ring
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 255;
        } else {
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
    }
  }
}

// Helper to draw a synthetic rectangle/square into an image buffer
function drawRect(
  img: ImageData,
  x0: number,
  y0: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number
) {
  const { width, height, data } = img;
  for (let y = Math.max(0, y0); y < Math.min(height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(width, x0 + w); x++) {
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
}

describe('OpenCV 5 WebAssembly Perception Layer', () => {
  beforeAll(async () => {
    // Ensure OpenCV 5 runtime initializes before running test suite
    await getOpenCv();
  }, 15000);

  it('initializes genuine OpenCV 5 WebAssembly module and verifies version', async () => {
    const cv = await getOpenCv();
    expect(cv).toBeDefined();
    expect(typeof cv.Mat).toBe('function');
    expect(typeof cv.cvtColor).toBe('function');
    expect(typeof cv.Canny).toBe('function');
    expect(typeof cv.findContours).toBe('function');
    expect(isOpenCvReady()).toBe(true);

    const buildInfo = cv.getBuildInformation ? cv.getBuildInformation() : '';
    expect(buildInfo).toContain('OpenCV 5.0.0');
  });

  it('allocates and manages OpenCV Mats without memory leaks', async () => {
    const cv = await getOpenCv();
    const mat = new cv.Mat(64, 64, cv.CV_8UC4);
    expect(mat.rows).toBe(64);
    expect(mat.cols).toBe(64);
    expect(mat.channels()).toBe(4);

    // Verify sub-Mat ROI slicing
    const rect = new cv.Rect(10, 10, 20, 20);
    const roiMat = mat.roi(rect);
    expect(roiMat.rows).toBe(20);
    expect(roiMat.cols).toBe(20);

    // Delete Mats safely
    roiMat.delete();
    mat.delete();
  });

  it('computes Layer 1 image statistics via cv.meanStdDev and cv.calcHist (16 bins)', async () => {
    const engine = new OpenCvPerceptionEngine(DEFAULT_TARGET_QUERY);
    await engine.initialize();
    expect(engine.isReady()).toBe(true);

    const img = makeImageData(200, 150);
    // Fill half background with dark slate (#0f172a: ~15, 23, 42)
    // and draw bright cyan square
    drawRect(img, 20, 20, 60, 60, 6, 182, 212);

    const stats = engine.computeStatistics(img);
    expect(stats.meanIntensity).toBeGreaterThan(0);
    expect(stats.contrastScore).toBeGreaterThan(0);
    expect(stats.histogram).toHaveLength(16);
    expect(stats.histogram.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it('executes Layer 2 Canny and Sobel edge gradient analysis on synthetic scene', async () => {
    const engine = new OpenCvPerceptionEngine(DEFAULT_TARGET_QUERY);
    await engine.initialize();

    const img = makeImageData(200, 150);
    drawCircle(img, 100, 75, 25, 6, 182, 212); // Bright cyan circle

    const edgeResult = engine.runEdgeAnalysis(img);
    expect(edgeResult.totalGradientEnergy).toBeGreaterThan(100);
    expect(edgeResult.cannyEdgePixels).toBeGreaterThan(20);
    expect(edgeResult.edgeMapData.length).toBe(200 * 150 * 4);
  });

  it('extracts perceived candidates via cv.findContours, cv.moments, and cv.approxPolyDP', async () => {
    const engine = new OpenCvPerceptionEngine(DEFAULT_TARGET_QUERY);
    await engine.initialize();

    const img = makeImageData(320, 240);
    // 1. Target candidate: Cyan circle with radius 16 at (80, 80)
    // Cyan color: ~6, 182, 212 (hue ~188 deg)
    drawCircle(img, 80, 80, 16, 6, 182, 212, true);

    // 2. Distractor candidate: Amber square at (220, 140)
    // Amber color: ~245, 158, 11 (hue ~38 deg)
    drawRect(img, 200, 120, 32, 32, 245, 158, 11);

    const state = engine.extractPerceivedState(img, 1);
    expect(state.candidates.length).toBeGreaterThanOrEqual(2);

    // Find the circle candidate near (80/320, 80/240) = (0.25, 0.33)
    const circleCand = state.candidates.find(
      (c) => Math.hypot(c.box.x - 80 / 320, c.box.y - 80 / 240) < 0.15
    );
    expect(circleCand).toBeDefined();
    expect(circleCand?.shapeFeatures?.circularity).toBeGreaterThan(0.75); // Circle has high circularity
    expect(circleCand?.colorFeatures?.hue).toBeGreaterThan(170); // Cyan hue
    expect(circleCand?.colorFeatures?.hue).toBeLessThan(205);
    expect(circleCand?.targetProbability).toBeGreaterThan(0.60);

    // Find the square candidate near (200/320, 120/240) = (0.625, 0.5)
    const squareCand = state.candidates.find(
      (c) => Math.hypot(c.box.x - 200 / 320, c.box.y - 120 / 240) < 0.15
    );
    expect(squareCand).toBeDefined();
    // Amber hue should mismatch target cyan query
    expect(squareCand?.colorFeatures?.colorMatchScore).toBeLessThan(0.3);
  });

  it('performs fine-grained OpenCV ROI inspection with sub-Mat cropping and signature verification', async () => {
    const engine = new OpenCvPerceptionEngine(DEFAULT_TARGET_QUERY);
    await engine.initialize();

    const img = makeImageData(320, 240);
    // Draw target with concentric signature ring
    drawCircle(img, 100, 100, 20, 6, 182, 212, true);

    const state = engine.extractPerceivedState(img, 1);
    const targetCand = state.candidates[0];
    expect(targetCand).toBeDefined();

    const inspection = engine.inspectRoiCrop(img, targetCand.box, targetCand);
    expect(inspection.edgeEnergy).toBeGreaterThan(0);
    expect(inspection.fineCircularity).toBeGreaterThan(0.70);
    expect(inspection.innerRingDetected).toBe(true);
    expect(inspection.inspectedCandidate.status).toBe('CONFIRMED_TARGET');
    expect(inspection.inspectedCandidate.targetProbability).toBeGreaterThan(0.85);
  });

  it('rejects square distractor during fine-grained OpenCV ROI inspection', async () => {
    const engine = new OpenCvPerceptionEngine(DEFAULT_TARGET_QUERY);
    await engine.initialize();

    const img = makeImageData(320, 240);
    // Draw cyan square distractor (same color, wrong polygonal geometry)
    drawRect(img, 90, 90, 40, 40, 6, 182, 212);

    const state = engine.extractPerceivedState(img, 1);
    const squareCand = state.candidates[0];
    expect(squareCand).toBeDefined();

    const inspection = engine.inspectRoiCrop(img, squareCand.box, squareCand);
    // Radial std dev on square boundary is high, so fine circularity is low
    expect(inspection.fineCircularity).toBeLessThan(0.65);
    expect(inspection.inspectedCandidate.status).toBe('REJECTED');
  });

  it('integrates ClassicalVisionPipeline seamlessly with OpenCV 5 backend', async () => {
    const pipeline = new ClassicalVisionPipeline(DEFAULT_TARGET_QUERY);
    // Wait for internal OpenCV initialization
    await pipeline.getOpenCvEngine().initialize();
    expect(pipeline.isOpenCvActive()).toBe(true);
    expect(pipeline.getBackendName()).toContain('OpenCV 5.0.0');

    const img = makeImageData(320, 240);
    drawCircle(img, 160, 120, 18, 6, 182, 212, true);

    const result = pipeline.extractPerceivedState(img, 42);
    expect(result.frameId).toBe(42);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.observation.width).toBe(320);
  });

  it('executes active cognitive loop cycle strictly on raw ImageData via OpenCV 5', async () => {
    const engine = new AvicaCognitiveEngine();
    // Ensure pipeline has initialized OpenCV
    await engine.getVisionPipeline().getOpenCvEngine().initialize();

    const img = makeImageData(640, 400);
    drawCircle(img, 200, 180, 22, 6, 182, 212, true); // Target
    drawRect(img, 400, 250, 36, 36, 239, 68, 68); // Red square distractor

    const cycle = engine.processFrame(img);

    // Verify cognitive loop outputs
    expect(cycle.observation.width).toBe(640);
    expect(cycle.observation.height).toBe(400);
    expect(cycle.candidates.length).toBeGreaterThan(0);
    expect(cycle.activeDecision).toBeDefined();
    expect(cycle.uncertainty).toBeDefined();
    expect(cycle.worldModel).toBeDefined();
    expect(cycle.traceSteps.length).toBeGreaterThan(0);

    // Verify trace reports OpenCV 5 execution
    const observeStep = cycle.traceSteps.find((s) => s.phase === 'OBSERVE');
    expect(observeStep?.details).toContain('OpenCV 5.0.0');

    // Verify working memory contains perceived entities
    expect(cycle.workingMemoryEntities.length).toBeGreaterThan(0);
  });
});
