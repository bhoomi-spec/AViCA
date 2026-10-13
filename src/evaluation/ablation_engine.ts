/**
 * AViCA Ablation Study Engine
 * Systematically tests component contributions under identical adversarial scenario seeds.
 *
 * Conditions:
 * 1. FULL AViCA: All cognitive subsystems active
 * 2. AViCA - Memory: Visual working memory ablated (purely frame-by-frame memoryless)
 * 3. AViCA - Uncertainty: Epistemic uncertainty estimation ablated (static blind confidence)
 * 4. AViCA - Active Perception: Active perception utility policy ablated (full-frame scan every cycle)
 * 5. AViCA - Prediction: Multi-step predictive perception and Kalman ghost projection ablated
 * 6. AViCA - Spatial Model: Ground-relative depth, pairwise predicates, and multi-object reasoning ablated
 * 7. AViCA - Learned Policy: Deep value/policy network ablated (falls back to greedy one-step utility)
 */

import {
  AblationCondition,
  AblationConfig,
  BenchmarkMetrics,
} from '../types/avica';
import { AdversarialSceneSimulator } from '../simulation/adversarial_scene';
import { AvicaCognitiveEngine } from '../core/cognitive_loop';
import { ScientificEvaluationSubsystem } from './evaluation_subsystem';
import { FrameMetricPoint } from './benchmark_engine';

export interface AblationRunResult {
  condition: AblationCondition;
  conditionName: string;
  ablationDescription: string;
  config: AblationConfig;
  totalFrames: number;
  runtimeMs: number;
  metrics: BenchmarkMetrics;
  completedAt: string;
  seed: number;
  timeSeries: FrameMetricPoint[];
}

export const ABLATION_CONDITIONS_META: Record<
  AblationCondition,
  {
    name: string;
    description: string;
    hypothesisTested: string;
    color: string;
    config: AblationConfig;
  }
> = {
  FULL_AVICA: {
    name: 'FULL AViCA',
    description: 'All cognitive components active (Active Perception + VWM + Uncertainty + Spatial Model + Prediction + Learned Policy).',
    hypothesisTested: 'Upper baseline reference performance combining all active and cognitive faculties.',
    color: '#06b6d4', // Cyan
    config: {
      condition: 'FULL_AVICA',
      enableWorkingMemory: true,
      enableUncertainty: true,
      enableActivePerception: true,
      enablePrediction: true,
      enableSpatialModel: true,
      enableLearnedPolicy: true,
    },
  },
  AVICA_NO_MEMORY: {
    name: 'AViCA - Memory',
    description: 'Visual Working Memory ablated. Transient frame-only perception without entity persistence or historical tracks.',
    hypothesisTested: 'H2: Proves VWM is mandatory for temporal continuity and post-occlusion identity retention.',
    color: '#ec4899', // Pink
    config: {
      condition: 'AVICA_NO_MEMORY',
      enableWorkingMemory: false,
      enableUncertainty: true,
      enableActivePerception: true,
      enablePrediction: true,
      enableSpatialModel: false, // Spatial relations require memory entities
      enableLearnedPolicy: true,
    },
  },
  AVICA_NO_UNCERTAINTY: {
    name: 'AViCA - Uncertainty',
    description: 'Epistemic uncertainty quantification ablated. System operates with uncalibrated static confidence (0.5).',
    hypothesisTested: 'H4: Proves epistemic uncertainty drives selective evidence acquisition and prevents overconfident false locks.',
    color: '#f97316', // Orange
    config: {
      condition: 'AVICA_NO_UNCERTAINTY',
      enableWorkingMemory: true,
      enableUncertainty: false,
      enableActivePerception: true,
      enablePrediction: true,
      enableSpatialModel: true,
      enableLearnedPolicy: true,
    },
  },
  AVICA_NO_ACTIVE_PERCEPTION: {
    name: 'AViCA - Active Perception',
    description: 'Active observation utility policy ablated. Reverts to uniform full-frame processing every single frame.',
    hypothesisTested: 'H1: Proves active foveation drastically reduces redundant FLOPS without sacrificing task accuracy.',
    color: '#ef4444', // Red
    config: {
      condition: 'AVICA_NO_ACTIVE_PERCEPTION',
      enableWorkingMemory: true,
      enableUncertainty: true,
      enableActivePerception: false,
      enablePrediction: true,
      enableSpatialModel: true,
      enableLearnedPolicy: false,
    },
  },
  AVICA_NO_PREDICTION: {
    name: 'AViCA - Prediction',
    description: 'Multi-step kinematic trajectory extrapolation and Kalman ghost projections ablated.',
    hypothesisTested: 'Proves predictive perception enables smooth pursuit and preemptive gaze allocation to occlusion exit windows.',
    color: '#eab308', // Amber
    config: {
      condition: 'AVICA_NO_PREDICTION',
      enableWorkingMemory: true,
      enableUncertainty: true,
      enableActivePerception: true,
      enablePrediction: false,
      enableSpatialModel: true,
      enableLearnedPolicy: true,
    },
  },
  AVICA_NO_SPATIAL_MODEL: {
    name: 'AViCA - Spatial Model',
    description: 'Spatial topological graph, ground-relative monocular depth, and multi-object relational reasoning ablated.',
    hypothesisTested: 'H3: Proves explicit spatial depth order resolves foreground occluder versus target depth ambiguity.',
    color: '#3b82f6', // Blue
    config: {
      condition: 'AVICA_NO_SPATIAL_MODEL',
      enableWorkingMemory: true,
      enableUncertainty: true,
      enableActivePerception: true,
      enablePrediction: true,
      enableSpatialModel: false,
      enableLearnedPolicy: true,
    },
  },
  AVICA_NO_LEARNED_POLICY: {
    name: 'AViCA - Learned Policy',
    description: 'Reinforcement-learned policy network ablated. Falls back to purely myopic one-step greedy utility maximization.',
    hypothesisTested: 'H5: Proves learned policy achieves foresight and long-term amortized compute scheduling over greedy heuristics.',
    color: '#8b5cf6', // Violet
    config: {
      condition: 'AVICA_NO_LEARNED_POLICY',
      enableWorkingMemory: true,
      enableUncertainty: true,
      enableActivePerception: true,
      enablePrediction: true,
      enableSpatialModel: true,
      enableLearnedPolicy: false,
    },
  },
};

export class AvicaAblationEngine {
  /**
   * Executes a controlled ablation trial of N frames under a specified condition and seed.
   * Every metric is measured from actual live execution.
   */
  public async runAblationTrial(
    condition: AblationCondition,
    totalFrames = 100,
    seed = 101,
    onProgress?: (progress: number) => void
  ): Promise<AblationRunResult> {
    const meta = ABLATION_CONDITIONS_META[condition];
    const simulator = new AdversarialSceneSimulator(640, 400);
    simulator.initializeScene(seed); // Identical deterministic scene conditions

    const engine = new AvicaCognitiveEngine();
    engine.setMode('AVICA_LEARNED');
    engine.setAblationConfig(meta.config);
    engine.reset();

    const evaluator = new ScientificEvaluationSubsystem();
    evaluator.reset();

    // Canvas / Headless rendering buffer
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
      simulator.step(true);

      let frameData: ImageData;
      if (ctx) {
        simulator.renderToCanvas(ctx);
        frameData = ctx.getImageData(0, 0, 640, 400);
      } else {
        const buf = fallbackBuffer || new Uint8ClampedArray(640 * 400 * 4);
        buf.fill(12);
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

      const tCycleStart = performance.now();
      const cognitiveResult = engine.processFrame(frameData);
      const cycleLatency = performance.now() - tCycleStart;

      const gtState = simulator.getGroundTruthState();
      const { metrics } = evaluator.evaluateCycle(cognitiveResult, gtState, cycleLatency);

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
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    const tEnd = performance.now();
    const finalMetrics = evaluator.getMetrics();

    return {
      condition,
      conditionName: meta.name,
      ablationDescription: meta.description,
      config: meta.config,
      totalFrames,
      runtimeMs: Math.round(tEnd - tStart),
      metrics: finalMetrics,
      completedAt: new Date().toISOString(),
      seed,
      timeSeries,
    };
  }
}
