#!/usr/bin/env node
/**
 * AViCA Standalone AWS Graviton & x86 Benchmark Harness
 *
 * Runs the exact core perception-cognition workload headlessly and generates
 * standardized benchmark telemetry adhering to the AViCA non-fabrication standard.
 *
 * Usage:
 *   node scripts/run_graviton_benchmark.js [--frames=200] [--seed=101] [--env=graviton_c7g] [--out=results.json]
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
};

const frameCount = parseInt(getArg('frames', '200'), 10);
const seed = parseInt(getArg('seed', '101'), 10);
const envArg = getArg('env', 'local');
const outPath = getArg('out', path.join(process.cwd(), 'benchmark-telemetry.json'));

const ENV_SPECS = {
  x86_c6i: {
    environmentName: 'AWS x86 (c6i.xlarge)',
    instanceType: 'c6i.xlarge',
    architecture: 'x86_64',
    vCpuCount: 4,
    memoryGb: 8,
    hourlyCostUsd: 0.1700,
  },
  graviton_c7g: {
    environmentName: 'AWS Graviton (c7g.xlarge)',
    instanceType: 'c7g.xlarge',
    architecture: 'arm64_graviton',
    vCpuCount: 4,
    memoryGb: 8,
    hourlyCostUsd: 0.1445,
  },
  graviton_cool_c7g: {
    environmentName: 'AWS Graviton + COOL (c7g.xlarge)',
    instanceType: 'c7g.xlarge',
    architecture: 'arm64_graviton_cool',
    vCpuCount: 4,
    memoryGb: 8,
    hourlyCostUsd: 0.1445,
  },
  local: {
    environmentName: `Local Host (${os.arch()})`,
    instanceType: 'Local Machine',
    architecture: os.arch(),
    vCpuCount: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / 1024 / 1024 / 1024),
    hourlyCostUsd: 0.1700,
  },
};

const envConfig = ENV_SPECS[envArg] || ENV_SPECS.local;

console.log('='.repeat(70));
console.log('AViCA CORE WORKLOAD BENCHMARK HARNESS');
console.log('='.repeat(70));
console.log(`Target Environment : ${envConfig.environmentName}`);
console.log(`Architecture       : ${envConfig.architecture}`);
console.log(`Frame Count        : ${frameCount} frames`);
console.log(`Scenario Seed      : ${seed}`);
console.log(`Host CPU           : ${os.cpus()[0]?.model || 'Unknown'}`);
console.log(`Node Runtime       : ${process.version}`);
console.log(`Host OS / Arch     : ${os.platform()} ${os.release()} (${os.arch()})`);
console.log('-'.repeat(70));

// Dynamically import compiled or source core workload
async function run() {
  const { CoreWorkloadBenchmarkRunner } = await import('../src/benchmark/core_workload.ts');

  const runner = new CoreWorkloadBenchmarkRunner();
  console.log('Executing deterministic benchmark trial...');

  const startTime = performance.now();
  const result = await runner.execute({
    frameCount,
    seed,
    environmentName: envConfig.environmentName,
    instanceType: envConfig.instanceType,
    architecture: envConfig.architecture,
    hourlyCostUsd: envConfig.hourlyCostUsd,
    onProgress: (f, total, fps) => {
      process.stdout.write(`\rProgress: ${f}/${total} frames (${fps.toFixed(1)} FPS)...`);
    },
  });

  console.log('\nBenchmark execution completed successfully.\n');

  // Rigorous Environment Verification: Distinguish requested target vs actual hardware
  const actualArch = os.arch();
  const isTargetArm = envConfig.architecture.startsWith('arm64');
  const isTargetX86 = envConfig.architecture.startsWith('x86');
  const isAwsTarget = envArg === 'graviton_c7g' || envArg === 'graviton_cool_c7g' || envArg === 'x86_c6i';

  // Check if actually running on verified AWS instance (e.g. EC2 metadata token or AWS env vars)
  const isAwsInstance = Boolean(
    process.env.AWS_EXECUTION_ENV ||
    process.env.AWS_REGION ||
    process.env.ECS_CONTAINER_METADATA_URI_V4 ||
    (fs.existsSync('/sys/devices/virtual/dmi/id/bios_vendor') &&
      fs.readFileSync('/sys/devices/virtual/dmi/id/bios_vendor', 'utf-8').includes('Amazon EC2'))
  );

  let verifiedStatus = 'MEASURED_LOCAL';
  let invalidReason = null;

  if (envArg === 'local') {
    verifiedStatus = 'MEASURED_LOCAL';
  } else if (isTargetArm && actualArch !== 'arm64') {
    // Requested ARM64/Graviton but running on x64 machine!
    verifiedStatus = 'INVALID_TARGET_ENVIRONMENT';
    invalidReason = `Target environment requested '${envConfig.environmentName}' (${envConfig.architecture}), but host CPU architecture is actually '${actualArch}'. Cannot claim Graviton measurements on x64 host.`;
  } else if (isTargetX86 && actualArch !== 'x64') {
    verifiedStatus = 'INVALID_TARGET_ENVIRONMENT';
    invalidReason = `Target environment requested '${envConfig.environmentName}' (${envConfig.architecture}), but host CPU architecture is actually '${actualArch}'.`;
  } else if (isAwsTarget && !isAwsInstance) {
    // Host architecture matches, but not running on real AWS instance hardware
    verifiedStatus = 'MEASURED_LOCAL';
    invalidReason = `Architecture matches (${actualArch}), but execution occurred on local machine, not verified AWS EC2 hardware. Labeling as MEASURED_LOCAL.`;
  } else if (isAwsTarget && isAwsInstance) {
    verifiedStatus = 'MEASURED_AWS';
  }

  result.status = verifiedStatus;
  result.invalidTargetReason = invalidReason;
  result.executionHostInfo = {
    platform: os.platform(),
    release: os.release(),
    cpuModel: os.cpus()[0]?.model || 'Unknown',
    kernelArch: actualArch,
    nodeVersion: process.version,
    isVerifiedAwsEc2: isAwsInstance,
    coolActive: Boolean(process.env.COOL_OPTIMIZATION_ACTIVE || process.env.LD_PRELOAD?.includes('jemalloc')),
  };

  // Display results table
  console.log('='.repeat(70));
  console.log('ACTUAL MEASURED TELEMETRY (ZERO FABRICATED VALUES)');
  console.log('='.repeat(70));
  console.log(`Execution Status     : ${result.status}`);
  if (invalidReason) {
    console.log(`Environment Notice   : ${invalidReason}`);
  }
  console.log(`Total Frames         : ${result.totalFrames}`);
  console.log(`Duration             : ${result.totalDurationMs} ms`);
  console.log(`Effective FPS        : ${result.fps} frames/sec`);
  console.log(`Mean Latency         : ${result.latencyMeanMs} ms`);
  console.log(`P50 Latency          : ${result.latencyP50Ms} ms`);
  console.log(`P95 Latency          : ${result.latencyP95Ms} ms`);
  console.log(`P99 Latency          : ${result.latencyP99Ms} ms`);
  console.log(`Throughput           : ${result.throughputMpxPerSec} MPx/sec`);
  console.log(`CPU User Time        : ${result.cpuUserMs} ms`);
  console.log(`CPU System Time      : ${result.cpuSystemMs} ms`);
  console.log(`CPU Utilization      : ${result.cpuUtilizationPercent}%`);
  console.log(`Memory Heap Used     : ${result.memoryHeapUsedMb} MB`);
  console.log(`Memory RSS           : ${result.memoryRssMb} MB`);
  console.log(`Hourly Rate (AWS)    : $${result.hourlyCostUsd.toFixed(4)}/hr`);
  console.log(`Performance / Dollar : ${result.performancePerDollar} frames / $`);
  console.log('='.repeat(70));

  // Write telemetry output
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Saved telemetry JSON: ${outPath}`);
}

run().catch((err) => {
  console.error('\nBenchmark execution failed:', err);
  process.exit(1);
});
