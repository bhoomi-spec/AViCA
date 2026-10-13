# AViCA AWS Graviton & Arm / COOL Benchmarking Layer

## 1. Workload Specification

The benchmark targets the core visual perception and cognitive reasoning loop of the **Adaptive Visual Cognitive Architecture (AViCA)**:
- **Input Stream**: 640x400 RGBA (32-bit pixel buffers, 1,024,000 bytes per frame)
- **Per-Frame Operations**:
  1. Dense Sobel gradient tensor computation & spatial stencil convolutions
  2. Blob contour extraction and multi-channel color-shape feature embeddings
  3. Epistemic uncertainty evaluation (Shannon entropy & missing evidence scoring)
  4. Active observation policy dispatch (Bellman Q-value maximization over 8 actions)
  5. Visual Working Memory (VWM) lifecycle management & Kalman tracking
  6. Spatial World Model reasoning (pairwise topological predicates & relative depth)
  7. Multi-step Kalman kinematics prediction across horizons $t+1$ through $t+4$
- **Isolation Guarantee**: Zero ground-truth leakage during perception. Ground truth is used strictly for offline accuracy verification.

---

## 2. Target Environments & Pricing Reference

| Metric | Target 1: x86 Baseline | Target 2: AWS Graviton / Arm | Target 3: AWS Graviton + COOL |
| :--- | :--- | :--- | :--- |
| **Instance Type** | `c6i.xlarge` | `c7g.xlarge` | `c7g.xlarge` (COOL Profile) |
| **Architecture** | `x86_64` (Intel Ice Lake) | `aarch64` (Graviton3 Neoverse-V1) | `aarch64` (Graviton3 Neoverse-V1) |
| **vCPUs / RAM** | 4 vCPU / 8 GiB DDR4 | 4 vCPU / 8 GiB DDR5 | 4 vCPU / 8 GiB DDR5 |
| **Hourly Rate (US-East-1)** | **$0.1700 / hr** | **$0.1445 / hr** (-15.0%) | **$0.1445 / hr** (-15.0%) |
| **Optimization Stack** | Standard V8 Baseline | ARM64 Neoverse V1 compilation | Thread-pinning (`numactl`), `jemalloc` arenas, V8 SIMD |

---

## 3. Deployment Instructions

### Option A: Local Testing & Verification
```bash
# Run local benchmark (measures on current machine architecture)
node scripts/run_graviton_benchmark.js --frames=200 --seed=101 --env=local
```

### Option B: Docker Compose Multi-Arch
```bash
cd deploy/aws
docker compose -f docker-compose.benchmark.yml up benchmark-x86
# On an ARM64/Graviton host:
docker compose -f docker-compose.benchmark.yml up benchmark-graviton
docker compose -f docker-compose.benchmark.yml up benchmark-graviton-cool
```

### Option C: Terraform Automated Provisioning
```bash
cd deploy/aws/terraform
terraform init
terraform apply -var="benchmark_frame_count=500"
```

---

## 4. Non-Fabrication Standard

Every reported metric must represent actual measured execution on the target hardware.
If an experiment has not been executed on real AWS hardware, the benchmark layer explicitly reports:
`PENDING AWS EXECUTION`
Estimated numbers must never be presented as empirical measurements.
