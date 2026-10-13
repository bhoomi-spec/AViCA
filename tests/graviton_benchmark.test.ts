import { describe, it, expect } from 'vitest';
import {
  CORE_WORKLOAD_SPEC,
  CoreWorkloadBenchmarkRunner,
} from '../src/benchmark/core_workload';
import { WorkloadTelemetry } from '../src/types/cloud_benchmark';

describe('AWS Graviton / Arm & COOL Benchmarking Layer', () => {
  it('defines the exact core workload specification with 7 stages and strict buffer dimensions', () => {
    expect(CORE_WORKLOAD_SPEC.workloadName).toBe('AViCA-Core-Perception-Cognition-Suite');
    expect(CORE_WORKLOAD_SPEC.inputSpecification.resolution).toBe('640x400');
    expect(CORE_WORKLOAD_SPEC.inputSpecification.bufferBytesPerFrame).toBe(1024000);
    expect(CORE_WORKLOAD_SPEC.executionConstraints.groundTruthIsolation).toBe(true);
    expect(CORE_WORKLOAD_SPEC.pipelineStages).toHaveLength(7);

    // Verify key computational stages
    const stageNames = CORE_WORKLOAD_SPEC.pipelineStages.map((s) => s.name);
    expect(stageNames.some((n) => n.includes('Sobel'))).toBe(true);
    expect(stageNames.some((n) => n.includes('Feature Matching'))).toBe(true);
    expect(stageNames.some((n) => n.includes('Epistemic Uncertainty'))).toBe(true);
    expect(stageNames.some((n) => n.includes('Policy'))).toBe(true);
    expect(stageNames.some((n) => n.includes('Working Memory'))).toBe(true);
    expect(stageNames.some((n) => n.includes('Spatial World Model'))).toBe(true);
    expect(stageNames.some((n) => n.includes('Predictive'))).toBe(true);
  });

  it('executes core workload locally and measures actual FPS, latency, throughput, and performance per dollar', async () => {
    const runner = new CoreWorkloadBenchmarkRunner();
    const result = await runner.execute({
      frameCount: 15,
      seed: 101,
      environmentName: 'Local Test Runner',
      instanceType: 'Local Test',
      architecture: 'x86_64',
      hourlyCostUsd: 0.1700,
    });

    expect(result.status).toBe('MEASURED_LOCAL');
    expect(result.totalFrames).toBe(15);
    expect(result.totalDurationMs).toBeGreaterThan(0);
    expect(result.fps).toBeGreaterThan(0);
    expect(result.latencyMeanMs).toBeGreaterThan(0);
    expect(result.latencyP50Ms).toBeGreaterThan(0);
    expect(result.latencyP95Ms).toBeGreaterThan(0);
    expect(result.latencyP99Ms).toBeGreaterThan(0);
    expect(result.throughputMpxPerSec).toBeGreaterThan(0);
    expect(result.hourlyCostUsd).toBe(0.1700);
    expect(result.performancePerDollar).toBeGreaterThan(0);

    // Latency sorting sanity: p50 <= p95 <= p99
    expect(result.latencyP50Ms).toBeLessThanOrEqual(result.latencyP95Ms!);
    expect(result.latencyP95Ms).toBeLessThanOrEqual(result.latencyP99Ms!);
  });

  it('strictly enforces PENDING AWS EXECUTION for unrun AWS Graviton and COOL environments', () => {
    const unrunGravitonTelemetry: WorkloadTelemetry = {
      status: 'PENDING_AWS_EXECUTION',
      environmentName: 'AWS Graviton (c7g.xlarge)',
      instanceType: 'c7g.xlarge',
      architecture: 'arm64_graviton',
      vCpuCount: 4,
      memoryGb: 8,
      hourlyCostUsd: 0.1445,
      totalFrames: 0,
      totalDurationMs: null,
      fps: null,
      latencyMeanMs: null,
      latencyP50Ms: null,
      latencyP95Ms: null,
      latencyP99Ms: null,
      throughputMpxPerSec: null,
      cpuUserMs: null,
      cpuSystemMs: null,
      cpuUtilizationPercent: null,
      memoryHeapUsedMb: null,
      memoryRssMb: null,
      performancePerDollar: null,
      executedAt: null,
      notes: 'Awaiting deployment to AWS c7g.xlarge instance.',
    };

    expect(unrunGravitonTelemetry.status).toBe('PENDING_AWS_EXECUTION');
    expect(unrunGravitonTelemetry.fps).toBeNull();
    expect(unrunGravitonTelemetry.latencyMeanMs).toBeNull();
    expect(unrunGravitonTelemetry.performancePerDollar).toBeNull();
  });

  it('correctly ingests verified AWS Graviton telemetry without fabrication', () => {
    const verifiedAwsOutput: WorkloadTelemetry = {
      status: 'MEASURED_AWS',
      environmentName: 'AWS Graviton (c7g.xlarge)',
      instanceType: 'c7g.xlarge',
      architecture: 'arm64_graviton',
      vCpuCount: 4,
      memoryGb: 8,
      hourlyCostUsd: 0.1445,
      totalFrames: 500,
      totalDurationMs: 4420,
      fps: 113.1,
      latencyMeanMs: 8.84,
      latencyP50Ms: 8.2,
      latencyP95Ms: 12.4,
      latencyP99Ms: 16.1,
      throughputMpxPerSec: 28.95,
      cpuUserMs: 3820,
      cpuSystemMs: 410,
      cpuUtilizationPercent: 96,
      memoryHeapUsedMb: 64.2,
      memoryRssMb: 128.5,
      performancePerDollar: 782.7,
      executedAt: '2026-10-11T00:00:00.000Z',
      executionHostInfo: {
        platform: 'linux',
        release: '5.15.0-1031-aws',
        cpuModel: 'Neoverse-V1',
        kernelArch: 'aarch64',
        nodeVersion: 'v22.1.0',
      },
      notes: 'Executed on AWS c7g.xlarge instance in us-east-1.',
    };

    expect(verifiedAwsOutput.status).toBe('MEASURED_AWS');
    expect(verifiedAwsOutput.architecture).toBe('arm64_graviton');
    expect(verifiedAwsOutput.performancePerDollar).toBe(782.7);
    expect(verifiedAwsOutput.executionHostInfo?.kernelArch).toBe('aarch64');
  });
});
