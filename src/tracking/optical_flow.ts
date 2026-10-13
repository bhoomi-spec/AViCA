/**
 * Optical Flow Motion Estimator
 *
 * Estimates 2D velocity vectors (dx, dy) directly from consecutive raw ImageData buffers
 * using differential Lucas-Kanade optical flow formulation:
 * [ \sum Ix^2   \sum Ix*Iy ] [ u ] = - [ \sum Ix*It ]
 * [ \sum Ix*Iy  \sum Iy^2  ] [ v ]     [ \sum Iy*It ]
 *
 * Zero ground-truth access. Operates purely on raw intensity gradients.
 */

import { BoundingBox } from '../types/avica';

export interface OpticalFlowResult {
  u: number; // horizontal displacement (normalized -1..1 per frame)
  v: number; // vertical displacement (normalized -1..1 per frame)
  confidence: number; // 0..1 based on gradient structure tensor conditioning
  samplePointsUsed: number;
}

export class OpticalFlowEstimator {
  private prevGrayBuffer: Uint8ClampedArray | null = null;
  private prevWidth = 0;
  private prevHeight = 0;

  /**
   * Resets the previous buffer state
   */
  public reset(): void {
    this.prevGrayBuffer = null;
    this.prevWidth = 0;
    this.prevHeight = 0;
  }

  /**
   * Converts RGBA pixel buffer to 8-bit grayscale intensity
   */
  private toGrayscale(rgba: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      // Rec. 601 luma weights
      gray[i] = Math.round(
        rgba[idx] * 0.299 + rgba[idx + 1] * 0.587 + rgba[idx + 2] * 0.114
      );
    }
    return gray;
  }

  /**
   * Computes optical flow motion vector within a region of interest between
   * previous frame and current frame.
   */
  public estimateFlowInRoi(
    currentRgba: Uint8ClampedArray,
    width: number,
    height: number,
    roi: BoundingBox
  ): OpticalFlowResult {
    const currentGray = this.toGrayscale(currentRgba, width, height);

    if (
      !this.prevGrayBuffer ||
      this.prevWidth !== width ||
      this.prevHeight !== height
    ) {
      // First frame: store buffer and return zero flow with zero confidence
      this.prevGrayBuffer = currentGray;
      this.prevWidth = width;
      this.prevHeight = height;
      return { u: 0, v: 0, confidence: 0.0, samplePointsUsed: 0 };
    }

    const prevGray = this.prevGrayBuffer;

    // Convert normalized bounding box to pixel coordinates
    const startX = Math.max(2, Math.floor(roi.x * width));
    const endX = Math.min(width - 3, Math.ceil((roi.x + roi.width) * width));
    const startY = Math.max(2, Math.floor(roi.y * height));
    const endY = Math.min(height - 3, Math.ceil((roi.y + roi.height) * height));

    let sumIx2 = 0;
    let sumIy2 = 0;
    let sumIxIy = 0;
    let sumIxIt = 0;
    let sumIyIt = 0;
    let validSamples = 0;

    // Sample across the ROI window
    const step = 2; // sample every 2nd pixel for speed and stability
    for (let y = startY; y < endY; y += step) {
      for (let x = startX; x < endX; x += step) {
        const currIdx = y * width + x;

        // Spatial gradients in current frame: Ix, Iy
        const ix = (currentGray[currIdx + 1] - currentGray[currIdx - 1]) / 2.0;
        const iy = (currentGray[currIdx + width] - currentGray[currIdx - width]) / 2.0;

        // Temporal gradient: It = I(t) - I(t-1)
        const it = currentGray[currIdx] - prevGray[currIdx];

        // Discard low-gradient flat regions (aperture problem avoidance)
        if (Math.abs(ix) + Math.abs(iy) > 4) {
          sumIx2 += ix * ix;
          sumIy2 += iy * iy;
          sumIxIy += ix * iy;
          sumIxIt += ix * it;
          sumIyIt += iy * it;
          validSamples++;
        }
      }
    }

    // Update stored previous buffer for next iteration
    this.prevGrayBuffer = currentGray;
    this.prevWidth = width;
    this.prevHeight = height;

    if (validSamples < 12) {
      return { u: 0, v: 0, confidence: 0.1, samplePointsUsed: validSamples };
    }

    // Structure tensor: [sumIx2, sumIxIy; sumIxIy, sumIy2]
    // Determinant
    const det = sumIx2 * sumIy2 - sumIxIy * sumIxIy;
    const trace = sumIx2 + sumIy2;

    if (det < 1e-4 || trace < 1e-3) {
      return { u: 0, v: 0, confidence: 0.0, samplePointsUsed: validSamples };
    }

    // Minimum eigenvalue proxy (Harris-style condition metric)
    const minEigenvalue = (trace - Math.sqrt(Math.max(0, trace * trace - 4 * det))) / 2;
    const condScore = Math.min(1.0, minEigenvalue / (validSamples * 12));

    // Solve [u, v]^T = - [sumIx2 sumIxIy; sumIxIy sumIy2]^-1 * [sumIxIt; sumIyIt]
    const inv00 = sumIy2 / det;
    const inv01 = -sumIxIy / det;
    const inv10 = -sumIxIy / det;
    const inv11 = sumIx2 / det;

    const uPx = -(inv00 * sumIxIt + inv01 * sumIyIt);
    const vPx = -(inv10 * sumIxIt + inv11 * sumIyIt);

    // Clamp extreme outlier spikes (beyond 30 pixels per frame)
    const clampedUPx = Math.max(-30, Math.min(30, uPx));
    const clampedVPx = Math.max(-30, Math.min(30, vPx));

    // Convert pixel displacements to normalized screen coordinates [0..1]
    const uNorm = clampedUPx / width;
    const vNorm = clampedVPx / height;

    const confidence = Math.max(0.1, Math.min(0.95, condScore));

    return {
      u: uNorm,
      v: vNorm,
      confidence: Math.round(confidence * 100) / 100,
      samplePointsUsed: validSamples,
    };
  }
}
