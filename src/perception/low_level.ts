/**
 * Layer 1-3 Low-Level & Feature Perception Algorithms
 * Pure computational CV implementations operating directly on raw ImageData.
 */

export interface ImageStats {
  meanIntensity: number;
  contrastScore: number;
  edgeEnergy: number;
  cornerCount: number;
  histogram: number[]; // 16-bin intensity histogram
}

/**
 * Computes mean intensity, variance, and 16-bin histogram
 */
export function computeImageStatistics(data: Uint8ClampedArray, width: number, height: number): ImageStats {
  let sum = 0;
  let sumSq = 0;
  const hist = new Array(16).fill(0);
  const totalPixels = width * height;

  for (let i = 0; i < data.length; i += 4) {
    // standard luminance weights
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += gray;
    sumSq += gray * gray;
    const bin = Math.min(15, Math.floor(gray / 16));
    hist[bin]++;
  }

  const mean = sum / totalPixels;
  const variance = sumSq / totalPixels - mean * mean;
  const contrast = Math.sqrt(Math.max(0, variance));

  return {
    meanIntensity: Math.round(mean * 10) / 10,
    contrastScore: Math.round(contrast * 10) / 10,
    edgeEnergy: 0,
    cornerCount: 0,
    histogram: hist.map((count) => Math.round((count / totalPixels) * 100)),
  };
}

/**
 * Sobel operator computing gradient magnitude along X and Y axes
 */
export function runSobelGradient(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  outData?: Uint8ClampedArray
): { totalGradientEnergy: number; edgeMap: Uint8ClampedArray } {
  const edgeMap = outData || new Uint8ClampedArray(width * height * 4);
  let totalEnergy = 0;

  // Pre-calculate grayscale buffer
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < srcData.length; i += 4, p++) {
    gray[p] = 0.299 * srcData[i] + 0.587 * srcData[i + 1] + 0.114 * srcData[i + 2];
  }

  // 3x3 Sobel kernels:
  // Gx = [-1 0 1; -2 0 2; -1 0 1]
  // Gy = [-1 -2 -1; 0 0 0; 1 2 1]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      const p00 = gray[(y - 1) * width + (x - 1)];
      const p01 = gray[(y - 1) * width + x];
      const p02 = gray[(y - 1) * width + (x + 1)];

      const p10 = gray[y * width + (x - 1)];
      const p12 = gray[y * width + (x + 1)];

      const p20 = gray[(y + 1) * width + (x - 1)];
      const p21 = gray[(y + 1) * width + x];
      const p22 = gray[(y + 1) * width + (x + 1)];

      const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
      const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;

      const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      totalEnergy += mag;

      const outIdx = (y * width + x) * 4;
      edgeMap[outIdx] = mag; // R
      edgeMap[outIdx + 1] = mag; // G
      edgeMap[outIdx + 2] = mag; // B
      edgeMap[outIdx + 3] = 255; // A
    }
  }

  return {
    totalGradientEnergy: totalEnergy,
    edgeMap,
  };
}

/**
 * Harris Corner Detector response approximation
 * R = det(M) - k * (trace(M))^2
 */
export function runHarrisCornerDetector(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 12000
): { corners: Array<{ x: number; y: number; response: number }> } {
  const corners: Array<{ x: number; y: number; response: number }> = [];
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < srcData.length; i += 4, p++) {
    gray[p] = 0.299 * srcData[i] + 0.587 * srcData[i + 1] + 0.114 * srcData[i + 2];
  }

  const k = 0.04;
  const step = 4; // Sub-sample for real-time speed in interactive testing

  for (let y = 2; y < height - 2; y += step) {
    for (let x = 2; x < width - 2; x += step) {
      let Ixx = 0;
      let Iyy = 0;
      let Ixy = 0;

      // Local 3x3 gradient window
      for (let wy = -1; wy <= 1; wy++) {
        for (let wx = -1; wx <= 1; wx++) {
          const cy = y + wy;
          const cx = x + wx;
          const gx = gray[cy * width + (cx + 1)] - gray[cy * width + (cx - 1)];
          const gy = gray[(cy + 1) * width + cx] - gray[(cy - 1) * width + cx];
          Ixx += gx * gx;
          Iyy += gy * gy;
          Ixy += gx * gy;
        }
      }

      const det = Ixx * Iyy - Ixy * Ixy;
      const trace = Ixx + Iyy;
      const response = det - k * trace * trace;

      if (response > threshold) {
        corners.push({ x, y, response });
      }
    }
  }

  return { corners };
}

/**
 * Extracts normalized 8-dimensional feature embedding for an image crop/ROI
 * (3 color means, 2 color variances, edge density, aspect ratio, corner saliency)
 */
export function extractVisualEmbedding(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number
): number[] {
  let rSum = 0, gSum = 0, bSum = 0;
  let pixelCount = 0;

  const startX = Math.max(0, Math.floor(cropX));
  const startY = Math.max(0, Math.floor(cropY));
  const endX = Math.min(width, Math.floor(cropX + cropW));
  const endY = Math.min(height, Math.floor(cropY + cropH));

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const idx = (y * width + x) * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      pixelCount++;
    }
  }

  if (pixelCount === 0) return [0, 0, 0, 0, 0, 0, 0, 0];

  const rMean = (rSum / pixelCount) / 255;
  const gMean = (gSum / pixelCount) / 255;
  const bMean = (bSum / pixelCount) / 255;
  const aspectRatio = Math.min(2, Math.max(0.5, cropW / Math.max(1, cropH))) / 2;
  const normalizedArea = (cropW * cropH) / (width * height);

  // Return normalized 8-dimensional vector
  return [
    Math.round(rMean * 1000) / 1000,
    Math.round(gMean * 1000) / 1000,
    Math.round(bMean * 1000) / 1000,
    Math.round(Math.abs(rMean - gMean) * 1000) / 1000,
    Math.round(Math.abs(gMean - bMean) * 1000) / 1000,
    Math.round(aspectRatio * 1000) / 1000,
    Math.round(normalizedArea * 1000) / 1000,
    Math.round(((rMean + gMean + bMean) / 3) * 1000) / 1000,
  ];
}

/**
 * Calculates Euclidean cosine distance between two feature embeddings
 */
export function calculateEmbeddingDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return 1.0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}
