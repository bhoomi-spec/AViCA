/**
 * Classical Computer Vision Perception Pipeline
 * Extracts visual candidates and features strictly from raw image pixel buffers.
 * Completely decoupled from the simulation ground truth.
 */

import {
  BoundingBox,
  CandidateRegion,
  PerceivedVisualState,
  VisualObservation,
} from '../types/avica';
import { computeImageStatistics, runSobelGradient } from './low_level';
import {
  OpenCvPerceptionEngine,
  isOpenCvReady,
} from './opencv_engine';

export interface TargetDescription {
  description: string;
  targetHue: number; // 0..360 (Cyan = ~185)
  hueTolerance: number; // Degrees
  minSaturation: number; // 0..1
  targetCircularity: number; // 1.0 = circle, 0.78 = square, 0.6 = triangle
  circularityTolerance: number;
  minArea: number; // Pixels
  maxArea: number; // Pixels
}

export const DEFAULT_TARGET_QUERY: TargetDescription = {
  description: 'Find the cyan circular object.',
  targetHue: 185,
  hueTolerance: 30,
  minSaturation: 0.50,
  targetCircularity: 0.95,
  circularityTolerance: 0.22,
  minArea: 100,
  maxArea: 8000,
};

/**
 * Converts RGB [0..255] to HSV (H: [0..360), S: [0..1], V: [0..1])
 */
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;

  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const delta = max - min;

  let h = 0;
  if (delta > 0.0001) {
    if (max === rf) {
      h = ((gf - bf) / delta) % 6;
    } else if (max === gf) {
      h = (bf - rf) / delta + 2;
    } else {
      h = (rf - gf) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
}

/**
 * Calculates angular difference in degrees between two hue angles on the color wheel [0..180]
 */
export function angularHueDiff(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export class ClassicalVisionPipeline {
  private targetQuery: TargetDescription;
  private opencvEngine: OpenCvPerceptionEngine;

  constructor(targetQuery: TargetDescription = DEFAULT_TARGET_QUERY) {
    this.targetQuery = targetQuery;
    this.opencvEngine = new OpenCvPerceptionEngine(targetQuery);
    // Asynchronously bootstrap OpenCV 5 WebAssembly runtime
    this.opencvEngine.initialize().catch((err) => {
      console.warn('OpenCV 5 initialization deferred, using fallback pipeline:', err);
    });
  }

  public setTargetQuery(query: TargetDescription): void {
    this.targetQuery = query;
    this.opencvEngine.setTargetQuery(query);
  }

  public getTargetQuery(): TargetDescription {
    return this.targetQuery;
  }

  public isOpenCvActive(): boolean {
    return this.opencvEngine.isReady();
  }

  public getBackendName(): string {
    return this.opencvEngine.isReady()
      ? 'OpenCV 5.0.0 (WebAssembly)'
      : 'Classical CV (CPU)';
  }

  public getOpenCvEngine(): OpenCvPerceptionEngine {
    return this.opencvEngine;
  }

  /**
   * Primary Image-Derived Perception Step:
   * When OpenCV 5 WebAssembly is ready, delegates to genuine OpenCV 5 operations
   * (cv.cvtColor, cv.inRange, cv.morphologyEx, cv.findContours, cv.moments, cv.calcHist).
   * Otherwise falls back to pure JavaScript image processing.
   */
  public extractPerceivedState(
    imageData: ImageData,
    frameId: number
  ): PerceivedVisualState {
    if (this.opencvEngine.isReady()) {
      try {
        return this.opencvEngine.extractPerceivedState(imageData, frameId);
      } catch (err) {
        console.warn('OpenCV extraction failed, falling back:', err);
      }
    }

    const width = imageData.width;
    const height = imageData.height;
    const pixels = imageData.data;

    // 1. Image Statistics (Layer 1)
    const imgStats = computeImageStatistics(pixels, width, height);
    const observation: VisualObservation = {
      frameId,
      timestamp: Date.now(),
      width,
      height,
      zoomLevel: 1.0,
      fps: 30,
      rawFeatureCount: imgStats.histogram.reduce((a, b) => a + b, 0),
      meanIntensity: imgStats.meanIntensity,
      contrastScore: imgStats.contrastScore,
    };

    // 2. Foreground Mask Segmentation (Layer 4)
    // Identify non-background pixels: Background in our testbed is dark slate (#0f172a, R<40, G<50, B<70)
    // Foreground entities have distinct color saturation or higher luminance.
    const step = 2; // 2x2 grid stride for real-time < 5ms processing
    const gridW = Math.floor(width / step);
    const gridH = Math.floor(height / step);
    const fgMask = new Uint8Array(gridW * gridH);

    for (let gy = 0; gy < gridH; gy++) {
      const y = gy * step;
      for (let gx = 0; gx < gridW; gx++) {
        const x = gx * step;
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];

        const { h, s, v } = rgbToHsv(r, g, b);

        // Discard dark background canvas and occluder pillar in simulation
        // In real camera or video frames, detect high-contrast, saturated, or salient color objects
        const isSimBackground = v < 0.20 || (s < 0.22 && v < 0.32);
        const isSimOccluder = s < 0.28 && v < 0.45;
        
        // Target query color affinity bonus (allows target-like colors to pass through even under low light)
        const targetColorNear = angularHueDiff(h, this.targetQuery.targetHue) < (this.targetQuery.hueTolerance + 15) && s > 0.25;

        // Salient edge / color presence
        const isSalientFeature = s > 0.32 || v > 0.65 || (v > 0.28 && s > 0.28) || targetColorNear;

        if (targetColorNear || (isSalientFeature && !isSimBackground && !isSimOccluder)) {
          fgMask[gy * gridW + gx] = 1;
        }
      }
    }

    // 3. Connected Components Labeling (Union-Find)
    const labels = new Int32Array(gridW * gridH);
    let nextLabel = 1;
    const parent = [0];

    const findRoot = (i: number): number => {
      let root = i;
      while (parent[root] !== root) root = parent[root];
      let curr = i;
      while (curr !== root) {
        const nxt = parent[curr];
        parent[curr] = root;
        curr = nxt;
      }
      return root;
    };

    const unionLabels = (i: number, j: number) => {
      const rootI = findRoot(i);
      const rootJ = findRoot(j);
      if (rootI !== rootJ) parent[rootI] = rootJ;
    };

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const idx = gy * gridW + gx;
        if (fgMask[idx] === 0) continue;

        // Check West and North neighbors
        const west = gx > 0 && fgMask[idx - 1] === 1 ? labels[idx - 1] : 0;
        const north = gy > 0 && fgMask[idx - gridW] === 1 ? labels[idx - gridW] : 0;

        if (west === 0 && north === 0) {
          labels[idx] = nextLabel;
          parent[nextLabel] = nextLabel;
          nextLabel++;
        } else if (west !== 0 && north === 0) {
          labels[idx] = west;
        } else if (west === 0 && north !== 0) {
          labels[idx] = north;
        } else {
          labels[idx] = west;
          unionLabels(west, north);
        }
      }
    }

    // Second pass: flatten roots and compute blob properties
    interface BlobAccumulator {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      pixelCount: number;
      edgeCount: number;
      sumR: number;
      sumG: number;
      sumB: number;
    }

    const blobs = new Map<number, BlobAccumulator>();

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const idx = gy * gridW + gx;
        if (fgMask[idx] === 0) continue;

        const root = findRoot(labels[idx]);
        labels[idx] = root;

        let blob = blobs.get(root);
        if (!blob) {
          blob = {
            minX: gx,
            maxX: gx,
            minY: gy,
            maxY: gy,
            pixelCount: 0,
            edgeCount: 0,
            sumR: 0,
            sumG: 0,
            sumB: 0,
          };
          blobs.set(root, blob);
        }

        blob.minX = Math.min(blob.minX, gx);
        blob.maxX = Math.max(blob.maxX, gx);
        blob.minY = Math.min(blob.minY, gy);
        blob.maxY = Math.max(blob.maxY, gy);
        blob.pixelCount++;

        // Edge pixel check (if adjacent neighbor is background)
        const isEdge =
          gx === 0 ||
          gx === gridW - 1 ||
          gy === 0 ||
          gy === gridH - 1 ||
          fgMask[idx - 1] === 0 ||
          fgMask[idx + 1] === 0 ||
          fgMask[idx - gridW] === 0 ||
          fgMask[idx + gridW] === 0;
        if (isEdge) blob.edgeCount++;

        // Accumulate original RGB
        const pxIdx = (gy * step * width + gx * step) * 4;
        blob.sumR += pixels[pxIdx];
        blob.sumG += pixels[pxIdx + 1];
        blob.sumB += pixels[pxIdx + 2];
      }
    }

    // 4. Generate Candidates & Shape/Color Analysis (Layers 3 & 4)
    const candidates: CandidateRegion[] = [];
    let candidateIndex = 1;

    for (const [rootId, b] of blobs.entries()) {
      // Scale back to original pixel coordinates
      const area = b.pixelCount * (step * step);
      const perimeter = Math.max(8, b.edgeCount * step);

      // Filter out small noise and giant background structures
      if (area < this.targetQuery.minArea || area > this.targetQuery.maxArea) continue;

      const pxMinX = Math.max(0, b.minX * step - 4);
      const pxMaxX = Math.min(width, (b.maxX + 1) * step + 4);
      const pxMinY = Math.max(0, b.minY * step - 4);
      const pxMaxY = Math.min(height, (b.maxY + 1) * step + 4);

      const boxW = (pxMaxX - pxMinX) / width;
      const boxH = (pxMaxY - pxMinY) / height;
      const boxX = pxMinX / width;
      const boxY = pxMinY / height;

      // Color extraction
      const meanR = b.sumR / b.pixelCount;
      const meanG = b.sumG / b.pixelCount;
      const meanB = b.sumB / b.pixelCount;
      const { h: meanHue, s: meanSat, v: meanVal } = rgbToHsv(meanR, meanG, meanB);

      // Shape extraction
      // Circularity: 4 * PI * Area / (Perimeter^2)
      // Circle -> ~1.0; Square -> ~0.785; Triangle -> ~0.60
      const circularity = Math.min(1.4, Math.max(0.2, (4 * Math.PI * area) / (perimeter * perimeter)));
      const aspectRatio = (pxMaxX - pxMinX) / Math.max(1, pxMaxY - pxMinY);

      // Color Match against Target Query ("cyan": ~185 deg, sat > 0.5)
      const hueDiff = angularHueDiff(meanHue, this.targetQuery.targetHue);
      const colorMatchScore = Math.max(
        0,
        Math.min(1.0, (1.0 - hueDiff / this.targetQuery.hueTolerance) * Math.min(1.0, meanSat / this.targetQuery.minSaturation))
      );

      // Shape Match against Target Query (Circle: circularity ~0.95, aspect ~1.0)
      const circDiff = Math.abs(circularity - this.targetQuery.targetCircularity);
      const aspectDiff = Math.abs(aspectRatio - 1.0);
      const shapeMatchScore = Math.max(
        0,
        Math.min(1.0, 1.0 - circDiff * 1.8 - aspectDiff * 0.4)
      );

      // Monocular Relative Depth Estimate (Section 7)
      // Perspective vertical cue (objects lower down are closer) + scale cue
      const verticalCue = 1.0 - (boxY + boxH); // 0 (bottom/near) to 1 (top/far)
      const scaleCue = 1.0 - Math.min(1.0, Math.sqrt(area) / 80);
      const estimatedRelativeDepth = Math.round((verticalCue * 0.65 + scaleCue * 0.35) * 100) / 100;

      // Initial full-frame target probability:
      // Weight color match 55% + shape match 45%
      const rawTargetProb = colorMatchScore * 0.55 + shapeMatchScore * 0.45;
      const targetProbability = Math.round(Math.max(0.04, Math.min(0.85, rawTargetProb)) * 100) / 100;

      // Salience: high saturation and contrast against mean intensity
      const salienceScore = Math.round((meanSat * 0.5 + colorMatchScore * 0.3 + shapeMatchScore * 0.2) * 100) / 100;

      const candId = `CAND-V${String(candidateIndex).padStart(2, '0')}`;
      candidateIndex++;

      candidates.push({
        id: candId,
        box: { x: boxX, y: boxY, width: boxW, height: boxH },
        salienceScore,
        targetProbability,
        featureSimilarity: Math.round(((colorMatchScore + shapeMatchScore) / 2) * 100) / 100,
        isInspected: false,
        status: 'PENDING',
        colorFeatures: {
          hue: Math.round(meanHue),
          saturation: Math.round(meanSat * 100) / 100,
          brightness: Math.round(meanVal * 100) / 100,
          colorMatchScore: Math.round(colorMatchScore * 100) / 100,
        },
        shapeFeatures: {
          circularity: Math.round(circularity * 100) / 100,
          aspectRatio: Math.round(aspectRatio * 100) / 100,
          area: Math.round(area),
          perimeter: Math.round(perimeter),
          shapeMatchScore: Math.round(shapeMatchScore * 100) / 100,
        },
        estimatedRelativeDepth,
      });
    }

    // Sort by salience score descending
    candidates.sort((a, b) => b.salienceScore - a.salienceScore);

    return {
      frameId,
      timestamp: Date.now(),
      width,
      height,
      observation,
      candidates,
    };
  }

  /**
   * Section 6: ROI Fine-Grained Inspection Step
   * Actually crops the selected bounding box from the raw image buffer,
   * performs high-resolution Sobel edge analysis, radial circularity verification,
   * and searches for the concentric inner signature ring.
   * Modifies candidate evidence purely from image pixels.
   */
  public inspectRoiCrop(
    imageData: ImageData,
    roi: BoundingBox,
    candidate: CandidateRegion
  ): {
    inspectedCandidate: CandidateRegion;
    edgeEnergy: number;
    fineCircularity: number;
    innerRingDetected: boolean;
    evidenceSummary: string;
  } {
    if (this.opencvEngine.isReady()) {
      try {
        return this.opencvEngine.inspectRoiCrop(imageData, roi, candidate);
      } catch (err) {
        console.warn('OpenCV ROI inspection failed, falling back:', err);
      }
    }

    const width = imageData.width;
    const height = imageData.height;
    const pixels = imageData.data;

    const pxX = Math.max(0, Math.floor(roi.x * width));
    const pxY = Math.max(0, Math.floor(roi.y * height));
    const pxW = Math.min(width - pxX, Math.max(8, Math.floor(roi.width * width)));
    const pxH = Math.min(height - pxY, Math.max(8, Math.floor(roi.height * height)));

    // Extract crop buffer
    const cropBuffer = new Uint8ClampedArray(pxW * pxH * 4);
    for (let y = 0; y < pxH; y++) {
      for (let x = 0; x < pxW; x++) {
        const srcIdx = ((pxY + y) * width + (pxX + x)) * 4;
        const dstIdx = (y * pxW + x) * 4;
        cropBuffer[dstIdx] = pixels[srcIdx];
        cropBuffer[dstIdx + 1] = pixels[srcIdx + 1];
        cropBuffer[dstIdx + 2] = pixels[srcIdx + 2];
        cropBuffer[dstIdx + 3] = pixels[srcIdx + 3];
      }
    }

    // 1. High-resolution Sobel Edge Analysis on Crop
    const sobel = runSobelGradient(cropBuffer, pxW, pxH);
    const edgeEnergy = sobel.totalGradientEnergy;

    // 2. High-precision Radial Distance and Circularity Variance
    // Find centroid in crop
    let sumX = 0, sumY = 0, count = 0;
    const centerX = pxW / 2;
    const centerY = pxH / 2;

    for (let y = 0; y < pxH; y++) {
      for (let x = 0; x < pxW; x++) {
        const idx = (y * pxW + x) * 4;
        const r = cropBuffer[idx];
        const g = cropBuffer[idx + 1];
        const b = cropBuffer[idx + 2];
        const { s, v } = rgbToHsv(r, g, b);
        if (s > 0.3 && v > 0.3) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }

    const objCenterX = count > 0 ? sumX / count : centerX;
    const objCenterY = count > 0 ? sumY / count : centerY;
    const maxRadius = Math.min(pxW, pxH) / 2;

    // Radial distance variance of boundary edge pixels
    // Circles have low standard deviation of radius to edge; squares have high variance
    const radii: number[] = [];
    const edgeMap = sobel.edgeMap;

    for (let y = 1; y < pxH - 1; y++) {
      for (let x = 1; x < pxW - 1; x++) {
        const edgeIdx = (y * pxW + x) * 4;
        if (edgeMap[edgeIdx] > 120) {
          const r = Math.hypot(x - objCenterX, y - objCenterY);
          if (r > 3 && r < maxRadius * 1.2) {
            radii.push(r);
          }
        }
      }
    }

    let radialStdDev = 0.5;
    if (radii.length > 8) {
      const meanR = radii.reduce((a, b) => a + b, 0) / radii.length;
      const variance = radii.reduce((acc, r) => acc + (r - meanR) ** 2, 0) / radii.length;
      radialStdDev = Math.sqrt(variance) / Math.max(1, meanR);
    }

    // Low radial std dev (< 0.12) strongly indicates a circle!
    // High radial std dev (> 0.20) indicates square corners or polygonal edges.
    const fineCircularity = Math.max(0.1, Math.min(1.0, 1.0 - radialStdDev * 2.5));

    // 3. Inner Concentric Ring Feature Detection
    // The target entity Alpha in the scene simulator features a characteristic inner white ring
    // with radius = size / 4. Check for high edge response at inner radius [0.25..0.45 * maxRadius]
    let innerEdgeCount = 0;
    for (let y = 1; y < pxH - 1; y++) {
      for (let x = 1; x < pxW - 1; x++) {
        const edgeIdx = (y * pxW + x) * 4;
        if (edgeMap[edgeIdx] > 110) {
          const r = Math.hypot(x - objCenterX, y - objCenterY);
          if (r > maxRadius * 0.2 && r < maxRadius * 0.48) {
            innerEdgeCount++;
          }
        }
      }
    }
    const innerRingDetected = innerEdgeCount >= 6;

    // 4. Update Candidate Evidence purely from Image Processing
    const colorMatch = candidate.colorFeatures?.colorMatchScore || 0.5;
    const isCyanHue = candidate.colorFeatures ? Math.abs(candidate.colorFeatures.hue - this.targetQuery.targetHue) < 22 : false;
    const isCircularShape = fineCircularity > 0.65;

    let updatedTargetProb: number;
    let newStatus: CandidateRegion['status'];
    let summary: string;

    if (innerRingDetected && isCyanHue && isCircularShape) {
      // Confirmed optical signature matches target query!
      updatedTargetProb = Math.min(0.97, Math.max(0.88, colorMatch * 0.4 + fineCircularity * 0.4 + 0.18));
      newStatus = 'CONFIRMED_TARGET';
      summary = `High-res ROI confirmed: Inner concentric signature detected, circularity=${fineCircularity.toFixed(2)}, hue=${candidate.colorFeatures?.hue}°.`;
    } else if (!isCircularShape || radialStdDev > 0.22) {
      // Shape is polygonal/square (e.g., Distractor B or Clutter)
      updatedTargetProb = Math.max(0.04, Math.min(0.20, colorMatch * 0.2));
      newStatus = 'REJECTED';
      summary = `High-res ROI rejected: Non-circular boundary (radial std-dev=${radialStdDev.toFixed(2)}), corner profiles detected.`;
    } else if (!isCyanHue) {
      // Circular but incorrect hue (e.g., Distractor A: sky-blue instead of cyan)
      updatedTargetProb = Math.max(0.12, Math.min(0.35, fineCircularity * 0.3));
      newStatus = 'REJECTED';
      summary = `High-res ROI rejected: Hue mismatch (observed ${candidate.colorFeatures?.hue}°, target ${this.targetQuery.targetHue}°).`;
    } else {
      // Moderate evidence
      updatedTargetProb = Math.max(0.40, Math.min(0.75, colorMatch * 0.5 + fineCircularity * 0.5));
      newStatus = 'INSPECTED';
      summary = `High-res ROI inspected: Partial match (circularity=${fineCircularity.toFixed(2)}).`;
    }

    const inspectedCandidate: CandidateRegion = {
      ...candidate,
      isInspected: true,
      targetProbability: Math.round(updatedTargetProb * 100) / 100,
      status: newStatus,
      shapeFeatures: candidate.shapeFeatures
        ? {
            ...candidate.shapeFeatures,
            shapeMatchScore: Math.round(fineCircularity * 100) / 100,
          }
        : undefined,
    };

    return {
      inspectedCandidate,
      edgeEnergy,
      fineCircularity,
      innerRingDetected,
      evidenceSummary: summary,
    };
  }
}
