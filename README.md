# AViCA — Adaptive Visual Cognitive Architecture

> A Research-Grade Active Perception & Visual Cognition System with Honest Hardware Profiling.

## 1. Project Overview & Research Question

Traditional artificial vision systems operate in open-loop, passively processing exhaustive video frames with fixed tensor pipelines. In contrast, biological visual cognition is inherently **active**: agents deploy selective attention, maintain spatial working memory, estimate epistemic uncertainty, and execute targeted saccades to gather maximal information per unit of computational energy.

**Core Research Question:**
*Can an active cognitive architecture achieve superior tracking continuity, faster occlusion recovery, and lower computational cost compared to passive and greedy vision baselines under continuous adversarial conditions (dynamic occluders, illumination shifts, distractors), while strictly preserving epistemic honesty on modern cloud hardware?*

AViCA evaluates this hypothesis through:
1. **Real OpenCV 5 WebAssembly execution** on raw pixel buffers without simulated ground-truth leaks.
2. **Epistemic Uncertainty Engine** computing Shannon ambiguity entropy $H(S)$ and missing evidence.
3. **Active Perception Policy** comparing Utility Information Gain against Bellman Q-Learning $\max_{a'} Q(s', a')$.
4. **Visual Working Memory (VWM)** with dynamic decay and qualitative spatial calculi.
5. **Multi-Step Kinematic Prediction** ($t+1 \dots t+4$) evaluated against subsequent real visual evidence.
6. **Honest Cloud Profiling**: Strict demarcation between verified local hardware (`MEASURED_LOCAL`) and unexecuted cloud targets (`PENDING AWS EXECUTION`).

---

## 2. Architecture & The 9-Stage Cognitive Loop

The Observe instrument visualizes the complete cognitive cycle:

$$\text{SEE} \longrightarrow \text{UNCERTAINTY} \longrightarrow \text{ATTENTION} \longrightarrow \text{ACTION} \longrightarrow \text{NEW EVIDENCE} \longrightarrow \text{MEMORY} \longrightarrow \text{PREDICTION} \longrightarrow \text{TRACKING} \longrightarrow \text{DECISION}$$

| Phase | Module | Operation & Theoretical Grounding |
| :--- | :--- | :--- |
| **1. SEE** | `OpenCvPerceptionEngine` | Raw ImageData ingestion, grayscale conversion, Sobel gradient tensors, 16-bin histogram calculation, and initial blob contour discovery. |
| **2. UNCERTAINTY** | `EpistemicUncertaintyEngine` | Shannon ambiguity entropy $H(p) = -\sum p_i \log_2(p_i)$ and missing evidence metrics. Calibrates confidence without ground-truth cheating. |
| **3. ATTENTION** | `ActiveObservationPolicy` | Computes expected information gain $E[\Delta U]$ across 8 discrete sensory actions against computational cost. |
| **4. ACTION** | Tool Dispatcher | Executes real OpenCV operations: `INSPECT_ROI` (sub-Mat crop + radial circularity analysis), `RUN_EDGE_ANALYSIS` (Canny edges), `TRACK_OBJECT` (optical flow). |
| **5. NEW EVIDENCE** | `ClassicalVisionPipeline` | Integrates structural verification from the active tool, updating candidate probabilities and rejecting false distractors. |
| **6. MEMORY** | `VisualWorkingMemory` | 5-slot bounded capacity with exponential recency decay $c_t = c_0 \cdot e^{-\lambda \Delta t}$, appearance histograms, and lifecycle state management. |
| **7. PREDICTION** | `PredictivePerceptionEngine` | 4-step kinematic projection ($t+1 \dots t+4$) forecasting target trajectory and spawning ghost candidate representations. |
| **8. TRACKING** | `SpatialWorldModelEngine` | Qualitative spatial calculi (Directional, Distance, Topological) and relative monocular depth ordering without uncalibrated metric claims. |
| **9. DECISION** | `AvicaCognitiveEngine` | Resolves target identification status and selects the next epistemic goal. |

---

## 3. Installation & Runtime Requirements

### Prerequisites
- Node.js >= 20.x or 22.x LTS
- npm or bun
- Modern evergreen browser supporting WebAssembly with SharedArrayBuffer / SIMD primitives

### Setup
```bash
# Clone and install dependencies
npm install

# Start development server on port 3000
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## 4. Verification & Testing

AViCA features comprehensive verification across 9 automated test suites with 64 deterministic test cases:

```bash
# Run unit, integration, and integrity tests
npm test

# Type checking and lint validation
npm run lint

# Production build verification
npm run build
```

### Verified Test Suites
1. `tests/opencv_perception.test.ts`: Real OpenCV 5 WebAssembly initialization, Mat creation, Sobel gradients, Canny edge detection, sub-Mat ROI inspection, and fallback labeling.
2. `tests/agentic_perception.test.ts`: The complete non-linear cognitive loop, verifying that tool actions execute on selected ROIs and update cognitive state.
3. `tests/ablation_framework.test.ts`: 7 ablation conditions under identical seeds and metrics calculation.
4. `tests/scientific_benchmark.test.ts`: 4-system empirical evaluation across 12 metric dimensions.
5. `tests/learned_observation_policy.test.ts`: Tabular Q-learning Bellman updates, state discretization, and head-to-head empirical comparison.
6. `tests/predictive_perception.test.ts`: Multi-step horizons ($t+1 \dots t+4$), covariance growth, and error evaluation against real visual observations.
7. `tests/graviton_benchmark.test.ts`: Strict environment verification, rejecting false AWS claims on local machines.
8. `tests/spatial_world_model.test.ts`: Qualitative spatial calculi, topological relations, and monocular depth distinctions.
9. `tests/temporal_vwm_tracking.test.ts`: Visual Working Memory entity lifecycle, memory decay, and occlusion recovery.

---

## 5. Benchmarks & Policy Training

### Running Local Workload Benchmark
```bash
# Runs the core perception-cognition suite headlessly on the local CPU
npm run benchmark:local
```

### Running Graviton & COOL Profiles
```bash
# Evaluates environment integrity; marks PENDING AWS EXECUTION or INVALID_TARGET_ENVIRONMENT if run on non-AWS hosts
npm run benchmark:graviton
npm run benchmark:cool
```

---

## 6. AWS Deployment Configuration

The repository includes reproducible deployment manifests under `deploy/aws/`:
- `Dockerfile.graviton`: Optimized ARM64 container for AWS Graviton3/4 (`c7g.xlarge`).
- `Dockerfile.graviton-cool`: Container Optimization & Orchestration Layer incorporating jemalloc multi-arena allocation, V8 WASM-SIMD flags, and CPU core affinity (`numactl`).
- `ecs-task-graviton.json`: Amazon ECS task definition for automated cloud evaluation.
- `terraform/`: Infrastructure-as-Code for provisioning Graviton benchmark worker instances.

### Hardware Transparency
In compliance with scientific integrity standards:
- Local executions are explicitly reported as `MEASURED_LOCAL`.
- Unexecuted AWS Graviton and COOL profiles are labeled as `PENDING AWS EXECUTION`.
- No benchmark results are fabricated.

---

## 7. Known Limitations & Research Boundaries

1. **Uncalibrated Monocular Vision**: Without multi-camera calibrated baseline disparity, depth is strictly represented as relative monocular rank-depth $[0, 1]$. True metric 3D is not claimed.
2. **Tabular Discretization**: The active perception Q-learning policy employs 7-dimensional discretized state bins. While highly interpretable and fast, high-dimensional continuous representations require deep Q-networks (DQN) for complex continuous state spaces.
3. **Controlled Synthetic Scenarios**: Simulation scenarios provide reproducible seeds and controlled visual challenges (occlusions, distractors, lighting shifts) for rigorous benchmarking.

---

## 8. License & Attribution

AViCA is developed for research and educational purposes under the MIT License.
"# AViCA" 
