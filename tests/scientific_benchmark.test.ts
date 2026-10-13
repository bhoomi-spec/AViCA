import { describe, it, expect, beforeEach } from 'vitest';
import { ScientificBenchmarkEngine, SYSTEM_DESCRIPTIONS } from '../src/evaluation/benchmark_engine';
import { ScientificEvaluationSubsystem } from '../src/evaluation/evaluation_subsystem';
import { BaselineMode } from '../src/types/avica';
import { AvicaCognitiveEngine } from '../src/core/cognitive_loop';
import { AdversarialSceneSimulator } from '../src/simulation/adversarial_scene';

describe('Scientific Benchmark System — 4 Comparable Systems', () => {
  const modes: BaselineMode[] = [
    'PASSIVE_VISION',
    'ATTENTION_VISION',
    'AVICA_GREEDY',
    'AVICA_LEARNED',
  ];

  it('verifies definition and descriptions for all 4 systems', () => {
    modes.forEach((mode) => {
      expect(SYSTEM_DESCRIPTIONS[mode]).toBeDefined();
      expect(SYSTEM_DESCRIPTIONS[mode].name).toBeTruthy();
      expect(SYSTEM_DESCRIPTIONS[mode].summary).toBeTruthy();
      expect(SYSTEM_DESCRIPTIONS[mode].color).toBeTruthy();
    });
  });

  it('runs deterministic simulation scenarios with identical seeds across all systems', () => {
    const simA = new AdversarialSceneSimulator(640, 400);
    simA.initializeScene(101);
    const gtA = simA.getGroundTruthState();

    const simB = new AdversarialSceneSimulator(640, 400);
    simB.initializeScene(101);
    const gtB = simB.getGroundTruthState();

    expect(gtA.entities.length).toBe(gtB.entities.length);
    expect(gtA.target?.position.x).toBeCloseTo(gtB.target?.position.x ?? 0, 5);
    expect(gtA.target?.position.y).toBeCloseTo(gtB.target?.position.y ?? 0, 5);
  });

  it('executes live benchmark trials for all 4 systems and measures all 12 metric dimensions', async () => {
    const engine = new ScientificBenchmarkEngine();

    // Run short 15-frame trials to test real evaluation execution
    for (const mode of modes) {
      const result = await engine.runTrial(mode, 15, 101);

      expect(result).toBeDefined();
      expect(result.mode).toBe(mode);
      expect(result.totalFrames).toBe(15);
      expect(result.runtimeMs).toBeGreaterThan(0);
      expect(result.completedAt).toBeTruthy();
      expect(result.seed).toBe(101);
      expect(result.timeSeries.length).toBeGreaterThan(0);

      // Verify all 12 requested metrics exist as actual numeric values:
      const m = result.metrics;
      expect(typeof m.detectionAccuracy).toBe('number');
      expect(typeof m.trackingAccuracy).toBe('number');
      expect(typeof m.recoveryAccuracy).toBe('number');
      expect(typeof m.trackContinuity).toBe('number');
      expect(typeof m.observations).toBe('number');
      expect(typeof m.roiInspections).toBe('number');
      expect(typeof m.latency).toBe('number');
      expect(typeof m.fps).toBe('number');
      expect(typeof m.predictionError).toBe('number');
      expect(typeof m.recoveryTime).toBe('number');
      expect(typeof m.uncertaintyReduction).toBe('number');
      expect(typeof m.computationCost).toBe('number');

      // Assert valid bounds
      expect(m.detectionAccuracy).toBeGreaterThanOrEqual(0);
      expect(m.detectionAccuracy).toBeLessThanOrEqual(100);
      expect(m.trackingAccuracy).toBeGreaterThanOrEqual(0);
      expect(m.trackingAccuracy).toBeLessThanOrEqual(100);
      expect(m.recoveryAccuracy).toBeGreaterThanOrEqual(0);
      expect(m.recoveryAccuracy).toBeLessThanOrEqual(100);
      expect(m.observations).toBe(15);
      expect(m.computationCost).toBeGreaterThan(0);
    }
  }, 30000);

  it('verifies AViCA systems significantly reduce computation cost compared with Passive Vision', async () => {
    const engine = new ScientificBenchmarkEngine();
    const resPassive = await engine.runTrial('PASSIVE_VISION', 12, 101);
    const resGreedy = await engine.runTrial('AVICA_GREEDY', 12, 101);
    const resLearned = await engine.runTrial('AVICA_LEARNED', 12, 101);

    // Passive Vision executes full-frame scan every frame at high cost multiplier
    expect(resPassive.metrics.computationCost).toBeGreaterThan(resGreedy.metrics.computationCost);
    expect(resPassive.metrics.computationCost).toBeGreaterThan(resLearned.metrics.computationCost);
  }, 20000);

  it('evaluates ground-truth isolation: cognitive engine receives only raw image data', () => {
    const cognitiveEngine = new AvicaCognitiveEngine();
    cognitiveEngine.setMode('AVICA_LEARNED');

    // Create a 100x100 dummy ImageData
    const buf = new Uint8ClampedArray(100 * 100 * 4);
    const imgData = {
      width: 100,
      height: 100,
      data: buf,
      colorSpace: 'srgb',
    } as unknown as ImageData;

    const cycle = cognitiveEngine.processFrame(imgData);

    expect(cycle).toBeDefined();
    expect(cycle.observation.width).toBe(100);
    expect(cycle.observation.height).toBe(100);
    // Ground truth target is false inside cognitive engine prior to evaluation
    expect(cycle.groundTruthTargetFound).toBe(false);
  });
});
