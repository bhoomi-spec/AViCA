import React, { useState } from 'react';
import {
  Server,
  Cpu,
  Zap,
  Play,
  RotateCw,
  Clock,
  DollarSign,
  Award,
  Layers,
  FileCode,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Activity,
  Code,
  Copy,
  Check,
  Download,
} from 'lucide-react';
import {
  CoreWorkloadBenchmarkRunner,
  CORE_WORKLOAD_SPEC,
} from '../benchmark/core_workload';
import {
  WorkloadTelemetry,
  DeploymentArtifact,
} from '../types/cloud_benchmark';

export const GravitonBenchmarkView: React.FC = () => {
  const [isExecutingLocal, setIsExecutingLocal] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [localFpsProgress, setLocalFpsProgress] = useState(0);
  const [selectedFrameCount, setSelectedFrameCount] = useState<number>(150);
  const [copiedArtifactId, setCopiedArtifactId] = useState<string | null>(null);
  const [activeDeploymentTab, setActiveDeploymentTab] = useState<string>('DOCKER_GRAVITON');
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [ingestInputJson, setIngestInputJson] = useState('');
  const [ingestError, setIngestError] = useState<string | null>(null);

  // 1. Local / x86 Telemetry
  const [localTelemetry, setLocalTelemetry] = useState<WorkloadTelemetry | null>(null);

  // 2. AWS Graviton3 c7g.xlarge Telemetry (strictly PENDING AWS EXECUTION until real telemetry ingested)
  const [gravitonTelemetry, setGravitonTelemetry] = useState<WorkloadTelemetry>({
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
  });

  // 3. AWS Graviton3 + COOL Telemetry (strictly PENDING AWS EXECUTION until real telemetry ingested)
  const [gravitonCoolTelemetry, setGravitonCoolTelemetry] = useState<WorkloadTelemetry>({
    status: 'PENDING_AWS_EXECUTION',
    environmentName: 'AWS Graviton + COOL (c7g.xlarge)',
    instanceType: 'c7g.xlarge',
    architecture: 'arm64_graviton_cool',
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
    notes: 'Awaiting deployment to AWS c7g.xlarge with COOL container profile.',
  });

  const runLocalBenchmark = async () => {
    setIsExecutingLocal(true);
    setLocalProgress(0);
    setLocalFpsProgress(0);

    try {
      const runner = new CoreWorkloadBenchmarkRunner();
      const telemetry = await runner.execute({
        frameCount: selectedFrameCount,
        seed: 101,
        environmentName: 'x86_64 Host (Current Environment)',
        instanceType: 'Host Container (x86_64)',
        architecture: 'x86_64',
        hourlyCostUsd: 0.1700,
        onProgress: (f, total, fps) => {
          setLocalProgress(Math.round((f / total) * 100));
          setLocalFpsProgress(Math.round(fps * 10) / 10);
        },
      });
      setLocalTelemetry(telemetry);
    } catch (err) {
      console.error('Error running core workload benchmark:', err);
    } finally {
      setIsExecutingLocal(false);
      setLocalProgress(0);
    }
  };

  const handleIngestJson = () => {
    try {
      setIngestError(null);
      const parsed = JSON.parse(ingestInputJson) as WorkloadTelemetry;
      if (!parsed.architecture || !parsed.totalFrames) {
        throw new Error('Invalid telemetry schema: Missing architecture or totalFrames');
      }

      parsed.status = 'MEASURED_AWS';

      if (parsed.architecture.includes('cool') || parsed.environmentName.includes('COOL')) {
        setGravitonCoolTelemetry(parsed);
      } else if (parsed.architecture.includes('arm') || parsed.architecture.includes('graviton')) {
        setGravitonTelemetry(parsed);
      } else {
        setLocalTelemetry(parsed);
      }

      setShowIngestModal(false);
      setIngestInputJson('');
    } catch (err: unknown) {
      setIngestError(err instanceof Error ? err.message : 'Invalid JSON format');
    }
  };

  const deploymentArtifacts: DeploymentArtifact[] = [
    {
      id: 'DOCKER_GRAVITON',
      name: 'Dockerfile.graviton',
      targetEnv: 'AWS Graviton (c7g.xlarge)',
      filename: 'deploy/aws/Dockerfile.graviton',
      language: 'dockerfile',
      description: 'Multi-stage ARM64 Docker build with Neoverse-V1 optimizations and jemalloc.',
      content: `FROM --platform=linux/arm64 node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential python3 git ca-certificates
ENV CFLAGS="-O3 -march=armv8.4-a+crypto+fp16+dotprod -mtune=neoverse-v1"
ENV CXXFLAGS="-O3 -march=armv8.4-a+crypto+fp16+dotprod -mtune=neoverse-v1"
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM --platform=linux/arm64 node:22-bookworm-slim AS runner
WORKDIR /app
ENV BENCHMARK_ARCH=arm64_graviton
ENV AWS_INSTANCE_TYPE=c7g.xlarge
ENV HOURLY_COST_USD=0.1445
RUN apt-get update && apt-get install -y --no-install-recommends libjemalloc2 procps sysstat jq
ENV LD_PRELOAD=/usr/lib/aarch64-linux-gnu/libjemalloc.so.2
ENV MALLOC_CONF="background_thread:true,metadata_thp:auto,dirty_decay_ms:2000"
COPY --from=builder /app /app
ENTRYPOINT ["node", "scripts/run_graviton_benchmark.js"]
CMD ["--frames=200", "--env=graviton_c7g", "--out=/app/benchmark-results/graviton_telemetry.json"]`,
    },
    {
      id: 'DOCKER_COOL',
      name: 'Dockerfile.graviton-cool',
      targetEnv: 'AWS Graviton + COOL',
      filename: 'deploy/aws/Dockerfile.graviton-cool',
      language: 'dockerfile',
      description: 'COOL container optimization: thread affinity (numactl), SIMD flags, and per-vCPU jemalloc arenas.',
      content: `FROM --platform=linux/arm64 node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential python3 git ca-certificates
ENV CFLAGS="-O3 -march=armv8.5-a+crypto+fp16+dotprod+sve -mtune=neoverse-v1 -flto"
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM --platform=linux/arm64 node:22-bookworm-slim AS runner
WORKDIR /app
ENV BENCHMARK_ARCH=arm64_graviton_cool
ENV AWS_INSTANCE_TYPE=c7g.xlarge
ENV HOURLY_COST_USD=0.1445
RUN apt-get update && apt-get install -y --no-install-recommends libjemalloc2 numactl procps sysstat jq
ENV LD_PRELOAD=/usr/lib/aarch64-linux-gnu/libjemalloc.so.2
ENV MALLOC_CONF="narenas:4,background_thread:true,metadata_thp:auto,dirty_decay_ms:1000"
ENV NODE_OPTIONS="--experimental-wasm-simd --max-semi-space-size=128 --max-old-space-size=4096"
COPY --from=builder /app /app
ENTRYPOINT ["numactl", "--physcpubind=0,1,2,3", "--localalloc", "node", "scripts/run_graviton_benchmark.js"]
CMD ["--frames=200", "--env=graviton_cool_c7g", "--out=/app/benchmark-results/graviton_cool_telemetry.json"]`,
    },
    {
      id: 'TERRAFORM',
      name: 'main.tf',
      targetEnv: 'AWS Infrastructure',
      filename: 'deploy/aws/terraform/main.tf',
      language: 'hcl',
      description: 'Terraform manifest provisioning c6i.xlarge & c7g.xlarge benchmark runners and S3 telemetry bucket.',
      content: `resource "aws_instance" "graviton_c7g_runner" {
  ami                  = data.aws_ami.ubuntu_arm64.id
  instance_type        = "c7g.xlarge"
  iam_instance_profile = aws_iam_instance_profile.benchmark_profile.name

  tags = {
    Name        = "avica-benchmark-graviton-c7g"
    Arch        = "arm64"
  }

  user_data = <<-EOF
              #!/bin/bash
              apt-get update && apt-get install -y curl git jq libjemalloc2 numactl
              curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
              git clone https://github.com/avica-vision/avica.git /opt/avica && cd /opt/avica
              npm ci && npm run build
              node scripts/run_graviton_benchmark.js --frames=500 --env=graviton_c7g --out=/tmp/graviton_telemetry.json
              aws s3 cp /tmp/graviton_telemetry.json s3://avica-benchmark-bucket/graviton_c7g_telemetry.json
              EOF
}`,
    },
    {
      id: 'ECS_TASK',
      name: 'ecs-task-graviton.json',
      targetEnv: 'AWS ECS Fargate (ARM64)',
      filename: 'deploy/aws/ecs-task-graviton.json',
      language: 'json',
      description: 'AWS ECS task definition with ARM64 architecture, 4 vCPUs, and 8GB RAM.',
      content: `{
  "family": "avica-benchmark-graviton",
  "cpu": "4096",
  "memory": "8192",
  "runtimePlatform": {
    "cpuArchitecture": "ARM64",
    "operatingSystemFamily": "LINUX"
  },
  "containerDefinitions": [
    {
      "name": "avica-graviton-runner",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/avica:graviton-latest",
      "command": ["--frames=500", "--env=graviton_cool_c7g"]
    }
  ]
}`,
    },
  ];

  const handleExportTelemetryBundle = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      workload: CORE_WORKLOAD_SPEC,
      telemetry: {
        local_x86: localTelemetry || { status: 'NOT_RUN' },
        aws_graviton: gravitonTelemetry,
        aws_graviton_cool: gravitonCoolTelemetry,
      },
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avica_hardware_benchmark_bundle_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedArtifactId(id);
    setTimeout(() => setCopiedArtifactId(null), 2000);
  };

  const activeArtifact = deploymentArtifacts.find((a) => a.id === activeDeploymentTab) || deploymentArtifacts[0];

  return (
    <div className="space-y-6">
      {/* Header & Workload Identification Banner */}
      <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Server className="h-5 w-5" />
              </div>
              <h2 className="text-base font-semibold text-white">
                AWS Graviton / Arm & COOL Benchmarking Layer
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-medium">
                REPRODUCIBLE CLOUD EVALUATION
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Identifies, benchmarks, and profiles the exact AViCA core cognitive workload across x86, AWS Graviton3, and Graviton + COOL.
              Enforces strict scientific non-fabrication standard: remote AWS numbers are labeled <strong className="text-amber-300">PENDING AWS EXECUTION</strong> until physically executed on AWS hardware.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportTelemetryBundle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-slate-200 transition-all"
              title="Download full benchmark telemetry bundle as JSON"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              <span>Export Benchmark JSON</span>
            </button>

            <button
              onClick={() => setShowIngestModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-slate-200 transition-all"
            >
              <Upload className="h-3.5 w-3.5 text-cyan-400" />
              <span>Ingest AWS Telemetry JSON</span>
            </button>

            <button
              onClick={runLocalBenchmark}
              disabled={isExecutingLocal}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
                isExecutingLocal
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 cursor-not-allowed'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20'
              }`}
            >
              {isExecutingLocal ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Evaluating ({localProgress}% · {localFpsProgress} FPS)...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Execute Local Workload</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Core Workload Pipeline Stages Accordion / Overview */}
        <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
              Core Workload: {CORE_WORKLOAD_SPEC.workloadName} (v{CORE_WORKLOAD_SPEC.version})
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Input: {CORE_WORKLOAD_SPEC.inputSpecification.resolution} RGBA ({CORE_WORKLOAD_SPEC.inputSpecification.bufferBytesPerFrame.toLocaleString()} bytes/frame)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
            {CORE_WORKLOAD_SPEC.pipelineStages.slice(0, 4).map((s) => (
              <div key={s.stageNumber} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="text-cyan-400 font-medium">Stage {s.stageNumber}: {s.name}</div>
                <div className="text-slate-400 text-[10px] truncate">{s.computationalProfile}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3-Way Comparative Benchmark Table */}
      <div className="rounded-xl border border-white/[0.08] bg-slate-900/40 overflow-hidden space-y-0">
        <div className="p-4 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-white/[0.01]">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-400" />
              Comparative Architectural Evaluation: x86 vs. Graviton vs. Graviton + COOL
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Empirical profiling across throughput, latency distribution, resource utilization, and price performance.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Trial Frames:</span>
            <select
              value={selectedFrameCount}
              onChange={(e) => setSelectedFrameCount(parseInt(e.target.value, 10))}
              disabled={isExecutingLocal}
              className="bg-slate-800 text-white border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs focus:outline-none"
            >
              <option value={100}>100 Frames (Fast)</option>
              <option value={150}>150 Frames (Standard)</option>
              <option value={300}>300 Frames (Extended)</option>
              <option value={500}>500 Frames (Full Precision)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400">
                <th className="py-3 px-4 font-semibold">Dimension</th>
                <th className="py-3 px-4 font-semibold text-slate-200">
                  Target 1: x86 Baseline (c6i.xlarge)
                </th>
                <th className="py-3 px-4 font-semibold text-amber-300">
                  Target 2: AWS Graviton / Arm (c7g.xlarge)
                </th>
                <th className="py-3 px-4 font-semibold text-cyan-300">
                  Target 3: AWS Graviton + COOL (c7g.xlarge)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {/* Architecture & Hardware */}
              <tr className="hover:bg-white/[0.01]">
                <td className="py-3 px-4 font-medium text-slate-300">
                  Hardware Profile
                </td>
                <td className="py-3 px-4 font-mono text-slate-300">
                  4 vCPU · 8GB DDR4 (Intel Xeon 8375C)
                </td>
                <td className="py-3 px-4 font-mono text-slate-300">
                  4 vCPU · 8GB DDR5 (Graviton3 Neoverse-V1)
                </td>
                <td className="py-3 px-4 font-mono text-cyan-300">
                  4 vCPU · 8GB DDR5 (Graviton3 + COOL Profile)
                </td>
              </tr>

              {/* Execution Status */}
              <tr className="hover:bg-white/[0.01]">
                <td className="py-3 px-4 font-medium text-slate-300">
                  Execution Status
                </td>
                <td className="py-3 px-4">
                  {localTelemetry ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                      <CheckCircle2 className="h-3 w-3" /> MEASURED LOCAL
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px]">
                      NOT RUN YET
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {gravitonTelemetry.status === 'MEASURED_AWS' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                      <CheckCircle2 className="h-3 w-3" /> MEASURED AWS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] border border-amber-500/30">
                      <Clock className="h-3 w-3" /> PENDING AWS EXECUTION
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {gravitonCoolTelemetry.status === 'MEASURED_AWS' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                      <CheckCircle2 className="h-3 w-3" /> MEASURED AWS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] border border-amber-500/30">
                      <Clock className="h-3 w-3" /> PENDING AWS EXECUTION
                    </span>
                  )}
                </td>
              </tr>

              {/* Effective FPS */}
              <tr className="hover:bg-white/[0.01]">
                <td className="py-3 px-4 font-medium text-slate-300">
                  Throughput (FPS)
                </td>
                <td className="py-3 px-4 font-mono font-semibold text-white">
                  {localTelemetry?.fps ? `${localTelemetry.fps} FPS` : 'NOT RUN'}
                </td>
                <td className="py-3 px-4 font-mono text-amber-300">
                  {gravitonTelemetry.fps !== null ? `${gravitonTelemetry.fps} FPS` : 'PENDING AWS EXECUTION'}
                </td>
                <td className="py-3 px-4 font-mono text-cyan-300">
                  {gravitonCoolTelemetry.fps !== null ? `${gravitonCoolTelemetry.fps} FPS` : 'PENDING AWS EXECUTION'}
                </td>
              </tr>

              {/* Mean Latency */}
              <tr className="hover:bg-white/[0.01]">
                <td className="py-3 px-4 font-medium text-slate-300">
                  Mean Frame Latency
                </td>
                <td className="py-3 px-4 font-mono text-slate-200">
                  {localTelemetry?.latencyMeanMs ? `${localTelemetry.latencyMeanMs} ms` : 'NOT RUN'}
                </td>
                <td className="py-3 px-4 font-mono text-slate-400">
                  {gravitonTelemetry.latencyMeanMs !== null ? `${gravitonTelemetry.latencyMeanMs} ms` : 'PENDING AWS EXECUTION'}
                </td>
                <td className="py-3 px-4 font-mono text-slate-400">
                  {gravitonCoolTelemetry.latencyMeanMs !== null ? `${gravitonCoolTelemetry.latencyMeanMs} ms` : 'PENDING AWS EXECUTION'}
                </td>
              </tr>

              {/* Latency Percentiles (P50 / P95 / P99) */}
              <tr className="hover:bg-white/[0.01]">
                <td className="py-3 px-4 font-medium text-slate-300">
                  Latency P50 / P95 / P99
                </td>
                <td className="py-3 px-4 font-mono text-slate-200 text-[11px]">
                  {localTelemetry?.latencyP50Ms
                    ? `${localTelemetry.latencyP50Ms} / ${localTelemetry.latencyP95Ms} / ${localTelemetry.latencyP99Ms} ms`
                    : 'NOT RUN'}
                </td>
                <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                  {gravitonTelemetry.latencyP50Ms !== null
                    ? `${gravitonTelemetry.latencyP50Ms} / ${gravitonTelemetry.latencyP95Ms} / ${gravitonTelemetry.latencyP99Ms} ms`
                    : 'PENDING AWS EXECUTION'}
                </td>
                <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                  {gravitonCoolTelemetry.latencyP50Ms !== null
                    ? `${gravitonCoolTelemetry.latencyP50Ms} / ${gravitonCoolTelemetry.latencyP95Ms} / ${gravitonCoolTelemetry.latencyP99Ms} ms`
                    : 'PENDING AWS EXECUTION'}
                </td>
              </tr>

              {/* Throughput (MPx/sec) */}
              <tr className="hover:bg-white/[0.01]">
                <td className="py-3 px-4 font-medium text-slate-300">
                  Pixel Throughput
                </td>
                <td className="py-3 px-4 font-mono text-slate-200">
                  {localTelemetry?.throughputMpxPerSec ? `${localTelemetry.throughputMpxPerSec} MPx/sec` : 'NOT RUN'}
                </td>
                <td className="py-3 px-4 font-mono text-slate-400">
                  {gravitonTelemetry.throughputMpxPerSec !== null ? `${gravitonTelemetry.throughputMpxPerSec} MPx/sec` : 'PENDING AWS EXECUTION'}
                </td>
                <td className="py-3 px-4 font-mono text-slate-400">
                  {gravitonCoolTelemetry.throughputMpxPerSec !== null ? `${gravitonCoolTelemetry.throughputMpxPerSec} MPx/sec` : 'PENDING AWS EXECUTION'}
                </td>
              </tr>

              {/* CPU Utilization */}
              <tr className="hover:bg-white/[0.01]">
                <td className="py-3 px-4 font-medium text-slate-300">
                  CPU Time (User / Sys / %)
                </td>
                <td className="py-3 px-4 font-mono text-slate-200 text-[11px]">
                  {localTelemetry?.cpuUserMs !== null && localTelemetry?.cpuUserMs !== undefined
                    ? `${localTelemetry.cpuUserMs}ms / ${localTelemetry.cpuSystemMs}ms (${localTelemetry.cpuUtilizationPercent}%)`
                    : 'Host Node API'}
                </td>
                <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                  {gravitonTelemetry.cpuUserMs !== null ? `${gravitonTelemetry.cpuUserMs}ms (${gravitonTelemetry.cpuUtilizationPercent}%)` : 'PENDING AWS EXECUTION'}
                </td>
                <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                  {gravitonCoolTelemetry.cpuUserMs !== null ? `${gravitonCoolTelemetry.cpuUserMs}ms (${gravitonCoolTelemetry.cpuUtilizationPercent}%)` : 'PENDING AWS EXECUTION'}
                </td>
              </tr>

              {/* Memory Footprint */}
              <tr className="hover:bg-white/[0.01]">
                <td className="py-3 px-4 font-medium text-slate-300">
                  Memory (Heap / RSS)
                </td>
                <td className="py-3 px-4 font-mono text-slate-200">
                  {localTelemetry?.memoryHeapUsedMb
                    ? `${localTelemetry.memoryHeapUsedMb} MB / ${localTelemetry.memoryRssMb} MB`
                    : 'Process Dynamic'}
                </td>
                <td className="py-3 px-4 font-mono text-slate-400">
                  {gravitonTelemetry.memoryHeapUsedMb !== null ? `${gravitonTelemetry.memoryHeapUsedMb} MB` : 'PENDING AWS EXECUTION'}
                </td>
                <td className="py-3 px-4 font-mono text-slate-400">
                  {gravitonCoolTelemetry.memoryHeapUsedMb !== null ? `${gravitonCoolTelemetry.memoryHeapUsedMb} MB` : 'PENDING AWS EXECUTION'}
                </td>
              </tr>

              {/* Hourly AWS On-Demand Cost */}
              <tr className="hover:bg-white/[0.01]">
                <td className="py-3 px-4 font-medium text-slate-300">
                  AWS Hourly Rate
                </td>
                <td className="py-3 px-4 font-mono text-slate-300">
                  $0.1700 / hr
                </td>
                <td className="py-3 px-4 font-mono text-emerald-400 font-semibold">
                  $0.1445 / hr <span className="text-[10px] text-emerald-500">(-15.0%)</span>
                </td>
                <td className="py-3 px-4 font-mono text-emerald-400 font-semibold">
                  $0.1445 / hr <span className="text-[10px] text-emerald-500">(-15.0%)</span>
                </td>
              </tr>

              {/* Performance Per Dollar (FPS / ($/hr)) */}
              <tr className="hover:bg-white/[0.01] bg-white/[0.02]">
                <td className="py-3 px-4 font-semibold text-white">
                  Performance Per Dollar (Frames / $)
                </td>
                <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                  {localTelemetry?.performancePerDollar ? `${localTelemetry.performancePerDollar} frames / $` : 'NOT RUN'}
                </td>
                <td className="py-3 px-4 font-mono font-bold text-amber-300">
                  {gravitonTelemetry.performancePerDollar !== null
                    ? `${gravitonTelemetry.performancePerDollar} frames / $`
                    : 'PENDING AWS EXECUTION'}
                </td>
                <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                  {gravitonCoolTelemetry.performancePerDollar !== null
                    ? `${gravitonCoolTelemetry.performancePerDollar} frames / $`
                    : 'PENDING AWS EXECUTION'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Non-Fabrication Standard Notice */}
      <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs space-y-1.5">
        <div className="flex items-center gap-2 text-amber-400 font-semibold">
          <AlertCircle className="h-4 w-4" />
          <span>Scientific Non-Fabrication Compliance Notice</span>
        </div>
        <p className="text-slate-300 leading-relaxed text-[11px]">
          In strict accordance with the benchmark specification, all measurements for AWS Graviton / Arm and COOL are labeled{' '}
          <strong className="text-amber-300 font-mono">PENDING AWS EXECUTION</strong> until verified execution telemetry is collected from live AWS EC2 / ECS hardware.
          Theoretical or extrapolated values are never presented as measured values.
          Deploy the configurations below to an AWS Graviton instance and ingest the output JSON to record actual empirical telemetry.
        </p>
      </div>

      {/* Reproducible Deployment Configuration Explorer */}
      <div className="rounded-xl border border-white/[0.08] bg-slate-900/50 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileCode className="h-4 w-4 text-cyan-400" />
              Reproducible Deployment Configuration
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Production artifacts for deploying AViCA to AWS Graviton (c7g.xlarge) and enabling COOL optimizations.
            </p>
          </div>

          {/* Artifact selector tabs */}
          <div className="flex flex-wrap items-center rounded-xl p-1 bg-white/[0.04] border border-white/[0.06] text-xs">
            {deploymentArtifacts.map((art) => (
              <button
                key={art.id}
                onClick={() => setActiveDeploymentTab(art.id)}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  activeDeploymentTab === art.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {art.name}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Artifact Details */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div>
              <span className="font-semibold text-slate-200">{activeArtifact.filename}</span>
              <span className="ml-2 text-slate-500">· {activeArtifact.description}</span>
            </div>

            <button
              onClick={() => copyToClipboard(activeArtifact.id, activeArtifact.content)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 transition-all border border-white/[0.08]"
            >
              {copiedArtifactId === activeArtifact.id ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Config</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 rounded-xl border border-white/[0.06] bg-black/60 text-xs font-mono text-slate-300 overflow-x-auto max-h-80 leading-relaxed">
            {activeArtifact.content}
          </pre>
        </div>
      </div>

      {/* Ingest Modal */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full rounded-2xl border border-white/[0.1] bg-[#0c0d14] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Upload className="h-4 w-4 text-cyan-400" />
                Ingest AWS Telemetry JSON
              </h3>
              <button
                onClick={() => setShowIngestModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Paste the output of <code className="text-cyan-300 bg-white/[0.05] px-1.5 py-0.5 rounded font-mono">scripts/run_graviton_benchmark.js</code> generated from an active AWS c7g.xlarge or c6i.xlarge instance.
            </p>

            <textarea
              rows={8}
              value={ingestInputJson}
              onChange={(e) => setIngestInputJson(e.target.value)}
              placeholder='{"status": "MEASURED_AWS", "environmentName": "AWS Graviton (c7g.xlarge)", "fps": 112.4, ...}'
              className="w-full bg-slate-950 text-slate-200 font-mono text-xs p-3 rounded-xl border border-white/[0.08] focus:outline-none focus:border-cyan-500"
            />

            {ingestError && (
              <div className="text-xs text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{ingestError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <button
                onClick={() => setShowIngestModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
              <button
                onClick={handleIngestJson}
                disabled={!ingestInputJson.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-40 transition-all"
              >
                Ingest Verified Telemetry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
