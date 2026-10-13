/**
 * Types and Interfaces for AWS Graviton / Arm and COOL Benchmarking Layer
 *
 * Environments:
 * 1. x86_64 (e.g. AWS c6i.xlarge: 4 vCPU, 8GB RAM, Intel Xeon Ice Lake @ $0.1700/hr)
 * 2. AWS Graviton / Arm (e.g. AWS c7g.xlarge: 4 vCPU, 8GB RAM, Graviton3 Neoverse-V1 @ $0.1445/hr)
 * 3. AWS Graviton + COOL (c7g.xlarge with Container Optimization & Orchestration Layer)
 *
 * Metrics measured:
 * - FPS (frames processed per second)
 * - latency (mean, p50, p95, p99 in milliseconds)
 * - throughput (megapixels per second & frames/sec)
 * - CPU (user time, system time, utilization percentage)
 * - memory (heap used, RSS in MB)
 * - cost ($/hour on-demand AWS pricing)
 * - performance per dollar (FPS / $/hr -> frames processed per dollar)
 *
 * Non-Fabrication Rule:
 * If an environment has not been executed on real AWS hardware, status must be PENDING AWS EXECUTION.
 */

export type TargetArchitecture = 'x86_64' | 'arm64_graviton' | 'arm64_graviton_cool';

export type BenchmarkExecutionStatus =
  | 'MEASURED_LOCAL'
  | 'MEASURED_AWS'
  | 'PENDING_AWS_EXECUTION'
  | 'INVALID_TARGET_ENVIRONMENT'
  | 'FAILED'
  | 'NOT_RUN';

export interface WorkloadTelemetry {
  status: BenchmarkExecutionStatus;
  environmentName: string;
  instanceType: string;
  architecture: string;
  vCpuCount: number;
  memoryGb: number;
  hourlyCostUsd: number;
  totalFrames: number;
  totalDurationMs: number | null;
  // Performance dimensions
  fps: number | null;
  latencyMeanMs: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  latencyP99Ms: number | null;
  throughputMpxPerSec: number | null;
  // Resource consumption
  cpuUserMs: number | null;
  cpuSystemMs: number | null;
  cpuUtilizationPercent: number | null;
  memoryHeapUsedMb: number | null;
  memoryRssMb: number | null;
  // Cost efficiency
  performancePerDollar: number | null; // FPS / ($/hr) = frames per dollar
  // Execution metadata
  executedAt: string | null;
  executionHostInfo?: {
    platform: string;
    release: string;
    cpuModel: string;
    kernelArch: string;
    nodeVersion: string;
  };
  notes: string;
}

export interface CoreWorkloadDefinition {
  workloadName: string;
  version: string;
  description: string;
  inputSpecification: {
    resolution: string; // e.g. 640x400
    pixelFormat: string; // RGBA 8-bit
    bufferBytesPerFrame: number; // 1,024,000 bytes
  };
  pipelineStages: Array<{
    stageNumber: number;
    name: string;
    computationalProfile: string;
    description: string;
  }>;
  syntheticSceneParameters: {
    entityCount: number;
    distractorCount: number;
    movingOccluderCount: number;
    illuminationModulation: boolean;
  };
  executionConstraints: {
    groundTruthIsolation: boolean;
    deterministicSeed: number;
  };
}

export interface DeploymentArtifact {
  id: string;
  name: string;
  targetEnv: string;
  filename: string;
  language: string;
  description: string;
  content: string;
}
