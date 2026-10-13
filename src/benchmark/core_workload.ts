/**
 * AViCA Core Perception-Cognition Workload Specification & Benchmark Runner
 *
 * Exact core workload benchmarked across:
 * 1. x86_64
 * 2. AWS Graviton / Arm
 * 3. AWS Graviton + COOL
 *
 * Executes the complete visual cognitive loop per frame:
 * - Low-level OpenCV / Sobel gradient tensor computation & contour detection
 * - Multi-channel visual descriptor extraction (color histogram, aspect ratio, circularity, texture embeddings)
 * - Epistemic uncertainty evaluation (entropy, ambiguity, missing evidence)
 * - Active observation policy selection
 * - Visual working memory update & spatial world model reasoning (relative depth, spatial predicates)
 * - Multi-step Kalman prediction (horizons t+1 to t+4)
 *
 * Strict Isolation: No ground-truth state is passed to the perception pipeline.
 */

import { AvicaCognitiveEngine } from '../core/cognitive_loop';
import { AdversarialSceneSimulator } from '../simulation/adversarial_scene';
import { CoreWorkloadDefinition, WorkloadTelemetry } from '../types/cloud_benchmark';

export const CORE_WORKLOAD_SPEC: CoreWorkloadDefinition = {
  workloadName: 'AViCA-Core-Perception-Cognition-Suite',
  version: '1.0.0-graviton-eval',
  description:
    'Full-stack real-time computer vision and epistemic cognitive cycle under continuous adversarial occlusions and visual ambiguity.',
  inputSpecification: {
    resolution: '640x400',
    pixelFormat: 'RGBA (32-bit clamped, 4 channels)',
    bufferBytesPerFrame: 640 * 400 * 4, // 1,024,000 bytes
  },
  pipelineStages: [
    {
      stageNumber: 1,
      name: 'Sensory Pixel Acquisition & Sobel Gradient Tensor',
      computationalProfile: 'Dense memory-bandwidth bound & 2D stencil convolution',
      description:
        'Converts 1.02MB RGBA image to grayscale luminance and computes 3x3 horizontal and vertical Sobel spatial derivatives.',
    },
    {
      stageNumber: 2,
      name: 'Blob Contour Extraction & Feature Matching',
      computationalProfile: 'Branch-heavy spatial clustering & Euclidean embedding projection',
      description:
        'Identifies connected components, extracts bounding boxes, computes color-shape descriptors, and matches against memory templates.',
    },
    {
      stageNumber: 3,
      name: 'Epistemic Uncertainty Evaluation',
      computationalProfile: 'Entropy & probabilistic evidence aggregation',
      description:
        'Calculates Shannon ambiguity entropy, missing evidence score, and decision threshold gating.',
    },
    {
      stageNumber: 4,
      name: 'Active Observation Policy Dispatch (Q-Learning / Utility)',
      computationalProfile: 'State discretization & Bellman Q-value maximization',
      description:
        'Discretizes 7-dimensional continuous state vector and evaluates 8 candidate active sensory actions.',
    },
    {
      stageNumber: 5,
      name: 'Visual Working Memory (VWM) Association & Decay',
      computationalProfile: 'Associative memory lookup, Kalman tracking, & lifecycle transitions',
      description:
        'Associates candidates with existing visual tracks, updates Kalman state estimates, and propagates decay.',
    },
    {
      stageNumber: 6,
      name: 'Spatial World Model Reasoning & Relative Depth',
      computationalProfile: 'Pairwise topological predicate graph & monocular depth ordering',
      description:
        'Computes pairwise spatial relationships (LEFT_OF, ABOVE, CLOSER_THAN, OCCLUDING) and monocular depth cues.',
    },
    {
      stageNumber: 7,
      name: 'Multi-Step Predictive Perception (Kalman Horizons t+1..t+4)',
      computationalProfile: 'Matrix kinematics propagation & re-emergence ROI projection',
      description:
        'Projects target trajectories 1 to 4 steps into the future and forecasts occluder exit coordinates.',
    },
  ],
  syntheticSceneParameters: {
    entityCount: 5,
    distractorCount: 2,
    movingOccluderCount: 1,
    illuminationModulation: true,
  },
  executionConstraints: {
    groundTruthIsolation: true,
    deterministicSeed: 101,
  },
};

export interface BenchmarkRunOptions {
  frameCount?: number;
  seed?: number;
  environmentName?: string;
  instanceType?: string;
  architecture?: string;
  hourlyCostUsd?: number;
  onProgress?: (frame: number, total: number, currentFps: number) => void;
}

export class CoreWorkloadBenchmarkRunner {
  /**
   * Executes the exact core workload in the current runtime environment.
   */
  public async execute(options: BenchmarkRunOptions = {}): Promise<WorkloadTelemetry> {
    const frameCount = options.frameCount ?? 150;
    const seed = options.seed ?? 101;
    const environmentName = options.environmentName ?? 'Local Host (Current Container)';
    const instanceType = options.instanceType ?? 'Current Host Container';
    const architecture = options.architecture ?? (typeof process !== 'undefined' ? process.arch : 'browser');
    const hourlyCostUsd = options.hourlyCostUsd ?? 0.1700; // baseline reference

    const simulator = new AdversarialSceneSimulator(640, 400);
    simulator.initializeScene(seed);

    const cognitiveEngine = new AvicaCognitiveEngine();
    cognitiveEngine.setMode('AVICA_LEARNED');

    // Canvas / image buffer setup
    let offscreenCanvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    let fallbackBuffer: Uint8ClampedArray | null = null;

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      try {
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = 640;
        offscreenCanvas.height = 400;
        ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
      } catch {
        ctx = null;
      }
    }

    if (!ctx) {
      fallbackBuffer = new Uint8ClampedArray(640 * 400 * 4);
    }

    const makeImageData = (buffer: Uint8ClampedArray, w: number, h: number): ImageData => {
      if (typeof ImageData !== 'undefined') {
        return new ImageData(buffer as unknown as Uint8ClampedArray<ArrayBuffer>, w, h);
      }
      return {
        data: buffer,
        width: w,
        height: h,
        colorSpace: 'srgb',
      } as unknown as ImageData;
    };

    const frameLatenciesMs: number[] = [];
    const tBenchmarkStart = performance.now();

    // CPU profiling in Node if available
    let startCpuUsage: { user: number; system: number } | null = null;
    if (typeof process !== 'undefined' && typeof process.cpuUsage === 'function') {
      startCpuUsage = process.cpuUsage();
    }

    for (let f = 0; f < frameCount; f++) {
      // 1. Advance simulation
      const simState = simulator.step(f > 20 && f < 50);

      // 2. Render frame
      let frameImageData: ImageData;
      if (ctx && offscreenCanvas) {
        simulator.renderToCanvas(ctx);
        frameImageData = ctx.getImageData(0, 0, 640, 400);
      } else {
        if (!fallbackBuffer) fallbackBuffer = new Uint8ClampedArray(640 * 400 * 4);
        fallbackBuffer.fill(18);
        for (const ent of simState.entities) {
          if (ent.isOccluded) continue;
          const cx = Math.floor(ent.x * 640);
          const cy = Math.floor(ent.y * 400);
          const rad = Math.floor(ent.size / 2);
          for (let dy = -rad; dy <= rad; dy++) {
            for (let dx = -rad; dx <= rad; dx++) {
              const px = cx + dx;
              const py = cy + dy;
              if (px >= 0 && px < 640 && py >= 0 && py < 400) {
                const idx = (py * 640 + px) * 4;
                fallbackBuffer[idx] = ent.isTarget ? 6 : 56;
                fallbackBuffer[idx + 1] = ent.isTarget ? 182 : 189;
                fallbackBuffer[idx + 2] = ent.isTarget ? 212 : 248;
                fallbackBuffer[idx + 3] = 255;
              }
            }
          }
        }
        frameImageData = makeImageData(fallbackBuffer, 640, 400);
      }

      // 3. Measure core cycle execution time (Zero ground-truth passed to engine)
      const tCycleStart = performance.now();
      cognitiveEngine.processFrame(frameImageData);
      const cycleTime = performance.now() - tCycleStart;

      frameLatenciesMs.push(cycleTime);

      if (options.onProgress && f % 10 === 0) {
        const elapsed = (performance.now() - tBenchmarkStart) / 1000;
        const currentFps = elapsed > 0 ? (f + 1) / elapsed : 0;
        options.onProgress(f + 1, frameCount, currentFps);
      }

      // Small event-loop yield in browser
      if (f % 25 === 0 && typeof window !== 'undefined') {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const tBenchmarkEnd = performance.now();
    const totalDurationMs = tBenchmarkEnd - tBenchmarkStart;
    const durationSeconds = totalDurationMs / 1000;

    // Latency distribution
    frameLatenciesMs.sort((a, b) => a - b);
    const sum = frameLatenciesMs.reduce((acc, v) => acc + v, 0);
    const latencyMeanMs = Math.round((sum / frameCount) * 100) / 100;
    const latencyP50Ms = Math.round(frameLatenciesMs[Math.floor(frameCount * 0.50)] * 100) / 100;
    const latencyP95Ms = Math.round(frameLatenciesMs[Math.floor(frameCount * 0.95)] * 100) / 100;
    const latencyP99Ms = Math.round(frameLatenciesMs[Math.floor(frameCount * 0.99)] * 100) / 100;

    const fps = Math.round((frameCount / durationSeconds) * 10) / 10;
    const mpxPerFrame = (640 * 400) / 1_000_000; // 0.256 MPx
    const throughputMpxPerSec = Math.round(fps * mpxPerFrame * 100) / 100;

    // CPU usage calculation
    let cpuUserMs: number | null = null;
    let cpuSystemMs: number | null = null;
    let cpuUtilizationPercent: number | null = null;

    if (startCpuUsage && typeof process !== 'undefined' && typeof process.cpuUsage === 'function') {
      const diff = process.cpuUsage(startCpuUsage);
      cpuUserMs = Math.round(diff.user / 1000);
      cpuSystemMs = Math.round(diff.system / 1000);
      const totalCpuMs = cpuUserMs + cpuSystemMs;
      cpuUtilizationPercent = Math.min(100, Math.round((totalCpuMs / totalDurationMs) * 100));
    }

    // Memory usage
    let memoryHeapUsedMb: number | null = null;
    let memoryRssMb: number | null = null;
    if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
      const mem = process.memoryUsage();
      memoryHeapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10;
      memoryRssMb = Math.round((mem.rss / 1024 / 1024) * 10) / 10;
    }

    // Performance per dollar: FPS / ($/hour)
    // Example: 85 FPS / $0.1445/hr = 588.2 frames/dollar
    const performancePerDollar =
      hourlyCostUsd > 0 ? Math.round((fps / hourlyCostUsd) * 10) / 10 : null;

    return {
      status: 'MEASURED_LOCAL',
      environmentName,
      instanceType,
      architecture,
      vCpuCount: typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 2,
      memoryGb: 4,
      hourlyCostUsd,
      totalFrames: frameCount,
      totalDurationMs: Math.round(totalDurationMs),
      fps,
      latencyMeanMs,
      latencyP50Ms,
      latencyP95Ms,
      latencyP99Ms,
      throughputMpxPerSec,
      cpuUserMs,
      cpuSystemMs,
      cpuUtilizationPercent,
      memoryHeapUsedMb,
      memoryRssMb,
      performancePerDollar,
      executedAt: new Date().toISOString(),
      notes: `Executed on local runtime environment (${architecture}). Ground truth isolated.`,
    };
  }
}
