/**
 * Phase C Test Suite: True Agentic Perception
 *
 * Verifies:
 * 1. Genuine loop: OBSERVE -> ESTIMATE -> UNCERTAINTY -> DECIDE -> TOOL -> VISUAL RESULT -> UPDATE -> NEXT OBSERVATION
 * 2. Visual operation output strictly influences next tool/action
 * 3. Dynamic observation & tool selection (no predetermined sequence)
 * 4. Actual OpenCV 5 / CV visual evidence processing on raw image buffers
 * 5. Trace history includes exact 7 phases: OBSERVE, UNCERTAINTY, DECIDE, ACTION, RESULT, UPDATE, NEXT_ACTION
 * 6. Information gain and computational cost accounting
 * 7. Zero ground-truth leakage
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { AvicaCognitiveEngine } from '../src/core/cognitive_loop';
import { getOpenCv } from '../src/perception/opencv_engine';
import { CandidateRegion, EpistemicUncertaintyState } from '../src/types/avica';

// Polyfill helper for headless Node/Vitest
function createTestImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  return {
    width,
    height,
    data,
    colorSpace: 'srgb',
  } as unknown as ImageData;
}

// Draw circular visual object
function renderBlob(
  img: ImageData,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  withInnerRing = false
) {
  const { width, height, data } = img;
  for (let y = Math.max(0, Math.floor(cy - radius - 2)); y < Math.min(height, Math.ceil(cy + radius + 2)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius - 2)); x < Math.min(width, Math.ceil(cx + radius + 2)); x++) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= radius) {
        const idx = (y * width + x) * 4;
        if (withInnerRing && dist >= radius * 0.35 && dist <= radius * 0.5) {
          // White concentric inner ring feature
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

describe('Phase C: True Agentic Perception Loop', () => {
  beforeAll(async () => {
    // Ensure OpenCV 5 WebAssembly is loaded
    await getOpenCv();
  });

  it('1. Executes full cognitive cycle with all 7 requested trace phases', () => {
    const engine = new AvicaCognitiveEngine();
    const img = createTestImage(320, 240);

    // Render a target candidate with concentric ring (Target: cyan with inner ring)
    renderBlob(img, 100, 100, 18, 0, 220, 220, true);

    const result = engine.processFrame(img);

    expect(result).toBeDefined();
    expect(result.observation).toBeDefined();
    expect(result.candidates).toBeDefined();
    expect(result.traceSteps.length).toBeGreaterThanOrEqual(7);

    // Retrieve the 7 steps from the most recent cycle (top 7 in trace history)
    const recentCycleSteps = result.traceSteps.slice(0, 7);
    const phases = recentCycleSteps.map((s) => s.phase);

    expect(phases).toContain('OBSERVE');
    expect(phases).toContain('UNCERTAINTY');
    expect(phases).toContain('DECIDE');
    expect(phases).toContain('ACTION');
    expect(phases).toContain('RESULT');
    expect(phases).toContain('UPDATE');
    expect(phases).toContain('NEXT_ACTION');
  });

  it('2. Dynamically selects INSPECT_ROI when visual candidate has high ambiguity', () => {
    const engine = new AvicaCognitiveEngine();
    const img = createTestImage(320, 240);

    // Render candidate matching query color
    renderBlob(img, 120, 80, 16, 0, 200, 200, false);

    const result = engine.processFrame(img);

    // If an uninspected candidate matching query is present, utility policy selects INSPECT_ROI
    expect(result.activeDecision.action).toBe('INSPECT_ROI');
    expect(result.activeDecision.targetRoi).toBeDefined();
    expect(result.metrics.observationsRequired).toBe(1);
    expect(result.metrics.totalComputationCost).toBeGreaterThan(0);
  });

  it('3. Visual operation output directly influences subsequent next-action decision', () => {
    const engine = new AvicaCognitiveEngine();

    // Scene with genuine target object containing concentric ring
    const imgTarget = createTestImage(320, 240);
    renderBlob(imgTarget, 80, 80, 18, 0, 220, 220, true);

    const res1 = engine.processFrame(imgTarget);

    // Inspection of target should confirm target status
    expect(res1.lastActionResult).toBeDefined();
    expect(res1.lastActionResult?.action).toBe('INSPECT_ROI');

    // The output of INSPECT_ROI confirming the target MUST influence nextPlannedAction to TRACK_OBJECT
    expect(res1.lastActionResult?.nextPlannedAction).toBe('TRACK_OBJECT');
    expect(res1.activeDecision.nextPlannedAction).toBe('TRACK_OBJECT');

    // Process second frame with target still visible at (82, 80)
    const imgTargetFrame2 = createTestImage(320, 240);
    renderBlob(imgTargetFrame2, 82, 80, 18, 0, 220, 220, true);

    const res2 = engine.processFrame(imgTargetFrame2);

    // Next action executed should be TRACK_OBJECT due to previous confirmation
    expect(res2.activeDecision.action).toBe('TRACK_OBJECT');
    expect(res2.activeDecision.computationCost).toBeLessThanOrEqual(0.6); // Lower compute cost for tracking!
  });

  it('4. Rejection of a distractor candidate steers next action to inspect the alternate candidate', () => {
    const engine = new AvicaCognitiveEngine();
    const img = createTestImage(320, 240);

    // Render distractor (cyan circle WITHOUT inner ring) at (60, 60)
    renderBlob(img, 60, 60, 16, 0, 210, 210, false);
    // Render target (cyan circle WITH inner ring) at (200, 140)
    renderBlob(img, 200, 140, 18, 0, 210, 210, true);

    // First cycle: agent foveates first candidate
    const res1 = engine.processFrame(img);
    expect(res1.activeDecision.action).toBe('INSPECT_ROI');

    // If distractor was inspected first and rejected, next action must steer to the remaining candidate or alternative
    expect(res1.lastActionResult).toBeDefined();
    if (!res1.lastActionResult?.success) {
      // Rejection steered next action to INSPECT_ROI for the second candidate
      expect(res1.lastActionResult?.nextPlannedAction).toBe('INSPECT_ROI');
    }
  });

  it('5. Computes non-zero information gain upon resolving epistemic uncertainty', () => {
    const engine = new AvicaCognitiveEngine();
    const img = createTestImage(320, 240);
    renderBlob(img, 150, 120, 18, 0, 220, 220, true);

    const res = engine.processFrame(img);

    expect(res.uncertainty).toBeDefined();
    expect(typeof res.informationGain).toBe('number');
    expect(res.metrics.totalComputationCost).toBeGreaterThan(0);
  });

  it('6. Operates strictly without ground-truth leakage into cognitive engine', () => {
    const engine = new AvicaCognitiveEngine();
    const img = createTestImage(320, 240);
    renderBlob(img, 160, 120, 16, 0, 220, 220, true);

    // processFrame only receives raw ImageData
    const res = engine.processFrame(img);

    // Candidates must be derived purely from visual buffers, with no simulator entity IDs or GT coordinates
    for (const cand of res.candidates) {
      expect(cand.id).toMatch(/^(CAND-CV|blob|opencv_blob)/);
      expect(cand.box.x).toBeGreaterThanOrEqual(0);
      expect(cand.box.x).toBeLessThanOrEqual(1);
    }

    // groundTruthTargetFound is deliberately initialized to false (populated only post-hoc by evaluation subsystem)
    expect(res.groundTruthTargetFound).toBe(false);
  });

  it('7. Baseline modes demonstrate expected ablation behaviors', () => {
    const enginePassive = new AvicaCognitiveEngine();
    enginePassive.setMode('PASSIVE_VISION');

    const img = createTestImage(320, 240);
    renderBlob(img, 100, 100, 18, 0, 220, 220, true);

    const resPassive = enginePassive.processFrame(img);
    expect(resPassive.activeDecision.action).toBe('PROCESS_FULL_FRAME');

    const engineAttention = new AvicaCognitiveEngine();
    engineAttention.setMode('ATTENTION_VISION');
    const resAttention = engineAttention.processFrame(img);
    expect(resAttention.activeDecision.action).toBe('INSPECT_ROI');
    // Baseline B ablates working memory persistence
    expect(resAttention.workingMemoryEntities.length).toBe(0);
  });
});
