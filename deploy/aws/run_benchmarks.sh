#!/usr/bin/env bash
# ==============================================================================
# AViCA AWS Graviton / x86 Benchmark Runner
# Standardized, non-fabricating execution harness
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RESULTS_DIR="${ROOT_DIR}/deploy/aws/results"
mkdir -p "${RESULTS_DIR}"

FRAMES="${1:-200}"
SEED="${2:-101}"

ARCH=$(uname -m)
echo "=============================================================================="
echo "AViCA Scientific Benchmarking Layer"
echo "Host Architecture Detected: ${ARCH}"
echo "Frames to Evaluate         : ${FRAMES}"
echo "Scenario Seed              : ${SEED}"
echo "=============================================================================="

if [[ "${ARCH}" == "x86_64" ]]; then
    echo "[x86_64 Mode] Executing standard baseline benchmark..."
    npx tsx "${ROOT_DIR}/scripts/run_graviton_benchmark.js" \
        --frames="${FRAMES}" \
        --seed="${SEED}" \
        --env="x86_c6i" \
        --out="${RESULTS_DIR}/x86_c6i_telemetry.json"

elif [[ "${ARCH}" == "aarch64" || "${ARCH}" == "arm64" ]]; then
    echo "[Arm64 Mode] Detected AWS Graviton hardware."
    
    echo "1/2 Running Standard Graviton3 benchmark..."
    npx tsx "${ROOT_DIR}/scripts/run_graviton_benchmark.js" \
        --frames="${FRAMES}" \
        --seed="${SEED}" \
        --env="graviton_c7g" \
        --out="${RESULTS_DIR}/graviton_c7g_telemetry.json"

    echo "2/2 Running Graviton3 + COOL optimized benchmark..."
    JEMALLOC_LIB=$(find /usr/lib -name "libjemalloc.so.2" 2>/dev/null | head -n 1 || true)
    
    if [[ -n "${JEMALLOC_LIB}" ]]; then
        export LD_PRELOAD="${JEMALLOC_LIB}"
        export MALLOC_CONF="narenas:4,background_thread:true"
    fi

    export NODE_OPTIONS="--experimental-wasm-simd --max-semi-space-size=128"
    
    if command -v numactl &>/dev/null; then
        numactl --physcpubind=0,1,2,3 --localalloc npx tsx "${ROOT_DIR}/scripts/run_graviton_benchmark.js" \
            --frames="${FRAMES}" \
            --seed="${SEED}" \
            --env="graviton_cool_c7g" \
            --out="${RESULTS_DIR}/graviton_cool_c7g_telemetry.json"
    else
        npx tsx "${ROOT_DIR}/scripts/run_graviton_benchmark.js" \
            --frames="${FRAMES}" \
            --seed="${SEED}" \
            --env="graviton_cool_c7g" \
            --out="${RESULTS_DIR}/graviton_cool_c7g_telemetry.json"
    fi
else
    echo "Unsupported or generic host architecture: ${ARCH}. Executing generic profile..."
    npx tsx "${ROOT_DIR}/scripts/run_graviton_benchmark.js" \
        --frames="${FRAMES}" \
        --seed="${SEED}" \
        --env="local" \
        --out="${RESULTS_DIR}/local_telemetry.json"
fi

echo "=============================================================================="
echo "Execution finished. All results saved to: ${RESULTS_DIR}"
echo "=============================================================================="
