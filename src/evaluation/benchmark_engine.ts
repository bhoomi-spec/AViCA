/**
 * Scientific Benchmark Engine
 * Runs Baseline A (Passive Vision), Baseline B (Attention Vision), and Proposed AViCA
 * under identical deterministic seeds and collects real empirical metrics via ScientificEvaluationSubsystem.
 * Completely isolates the cognitive engine from ground-truth leakage.
 */

import { BaselineMode, BenchmarkMetrics } from '../types/avica';
import { AdversarialSceneSimulator } from '../simulation/adversarial_scene';
import { AvicaCognitiveEngine } from '../core/cognitive_loop';
import { ScientificEvaluationSubsystem } from './evaluation_subsystem';

export interface FrameMetricPoint {
  frameId: number;
  accuracy: number;
  cost: number;
  latencyMs: number;
  predictionError: number;
  uncertaintyReduction: number;
}

export interface ExperimentRunResult {
  mode: BaselineMode;
  systemName: string;
  totalFrames: number;
  runtimeMs: number;
  metrics: BenchmarkMetrics;
  completedAt: string;
  seed: number;
  timeSeries: FrameMetricPoint[];
}

export const SYSTEM_DESCRIPTIONS: Record<BaselineMode, { name: string; summary: string; color: string }> = {
  PASSIVE_VISION: {
    name: '1. Passive Vision',
    summary: 'Uniform full-frame processing at constant frame-rate without attention gating or memory persistence.',
    color: '#94a3b8',
  },
  ATTENTION_VISION: {
    name: '2. Attention Vision',
    summary: 'Greedy bottom-up saliency foveation without working memory persistence or trajectory prediction.',
    color: '#f59e0b',
  },
  AVICA_GREEDY: {
    name: '3. AViCA Greedy',
    summary: 'Uncertainty-driven active perception utility policy with visual working memory and Kalman tracking.',
    color: '#06b6d4',
  },
  AVICA_LEARNED: {
    name: '4. AViCA Learned Policy',
    summary: 'Reinforcement-learned policy network optimizing long-term information gain under compute constraints.',
    color: '#a855f7',
  },
  AVICA_ACTIVE: {
    name: '3. AViCA Greedy (Active)',
    summary: 'Uncertainty-driven active perception utility policy with visual working memory and Kalman tracking.',
    color: '#06b6d4',
  },
};

export class ScientificBenchmarkEngine {
  /**
   * Executes an automated controlled trial of N frames for a given mode
   * using an offscreen canvas and deterministic scene simulation.
   * Every metric comes strictly from real live execution.
   */
  public async runTrial(
    mode: BaselineMode,
    totalFrames = 100,
    seed = 101,
    onProgress?: (progress: number) => void
  ): Promise<ExperimentRunResult> {
    const simulator = new AdversarialSceneSimulator(640, 400);
    simulator.initializeScene(seed); // Fixed deterministic seed across all 4 systems

    const engine = new AvicaCognitiveEngine();
    engine.setMode(mode);
    engine.reset();

    const evaluator = new ScientificEvaluationSubsystem();
    evaluator.reset();

    // Create or mock offscreen canvas for rendering frames
    let ctx: CanvasRenderingContext2D | null = null;
    let fallbackBuffer: Uint8ClampedArray | null = null;

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = 640;
      offscreenCanvas.height = 400;
      ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }

    if (!ctx) {
      fallbackBuffer = new Uint8ClampedArray(640 * 400 * 4);
    }

    const timeSeries: FrameMetricPoint[] = [];
    const tStart = performance.now();

    for (let f = 0; f < totalFrames; f++) {
      // 1. Simulation step & rendering
      simulator.step(true); // with illumination shift and occluder drift

      let frameData: ImageData;
      if (ctx) {
        simulator.renderToCanvas(ctx);
        frameData = ctx.getImageData(0, 0, 640, 400);
      } else {
        // Headless Node environment: synthesize valid ImageData buffer from entities
        const buf = fallbackBuffer || new Uint8ClampedArray(640 * 400 * 4);
        buf.fill(12); // dark background
        const entities = simulator.getEntities();
        for (const ent of entities) {
          if (ent.isOccluded) continue;
          const cx = Math.floor(ent.x * 640);
          const cy = Math.floor(ent.y * 400);
          const r = Math.floor(ent.size / 2);
          for (let dy = -r; dy <= r; dy++) {
            const py = cy + dy;
            if (py < 0 || py >= 400) continue;
            for (let dx = -r; dx <= r; dx++) {
              const px = cx + dx;
              if (px < 0 || px >= 640) continue;
              if (dx * dx + dy * dy <= r * r) {
                const idx = (py * 640 + px) * 4;
                if (ent.isTarget) {
                  // Cyan target
                  buf[idx] = 6;
                  buf[idx + 1] = 182;
                  buf[idx + 2] = 212;
                  buf[idx + 3] = 255;
                } else {
                  buf[idx] = 200;
                  buf[idx + 1] = 150;
                  buf[idx + 2] = 50;
                  buf[idx + 3] = 255;
                }
              }
            }
          }
        }
        frameData = {
          width: 640,
          height: 400,
          data: buf,
          colorSpace: 'srgb',
        } as unknown as ImageData;
      }

      // 3. Cognitive Engine receives ONLY raw image data
      const tCycleStart = performance.now();
      const cognitiveResult = engine.processFrame(frameData);
      const cycleLatency = performance.now() - tCycleStart;

      // 4. Ground truth is acquired ONLY by the evaluation subsystem AFTER cognitive step
      const gtState = simulator.getGroundTruthState();
      const { metrics } = evaluator.evaluateCycle(cognitiveResult, gtState, cycleLatency);

      // Sample every 5 frames for time-series charts
      if (f % 5 === 0 || f === totalFrames - 1) {
        timeSeries.push({
          frameId: f + 1,
          accuracy: metrics.trackingAccuracy,
          cost: metrics.computationCost,
          latencyMs: metrics.latency,
          predictionError: metrics.predictionError,
          uncertaintyReduction: metrics.uncertaintyReduction,
        });
      }

      if (f % 10 === 0 && onProgress) {
        onProgress(Math.round(((f + 1) / totalFrames) * 100));
        // Yield microtask to keep UI responsive
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    const tEnd = performance.now();
    const finalMetrics = evaluator.getMetrics();

    return {
      mode,
      systemName: SYSTEM_DESCRIPTIONS[mode].name,
      totalFrames,
      runtimeMs: Math.round(tEnd - tStart),
      metrics: finalMetrics,
      completedAt: new Date().toISOString(),
      seed,
      timeSeries,
    };
  }

  /**
   * Runs all four systems through the identical scenario.
   */
  public async runFullSuite(
    totalFrames = 100,
    seed = 101,
    onProgress?: (system: BaselineMode, progress: number) => void
  ): Promise<Record<BaselineMode, ExperimentRunResult>> {
    const modes: BaselineMode[] = [
      'PASSIVE_VISION',
      'ATTENTION_VISION',
      'AVICA_GREEDY',
      'AVICA_LEARNED',
    ];

    const results = {} as Record<BaselineMode, ExperimentRunResult>;

    for (let i = 0; i < modes.length; i++) {
      const mode = modes[i];
      const res = await this.runTrial(mode, totalFrames, seed, (prog) => {
        if (onProgress) onProgress(mode, prog);
      });
      results[mode] = res;
    }

    return results;
  }
}
