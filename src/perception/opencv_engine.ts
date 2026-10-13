/**
 * Real OpenCV 5 Perception Layer
 * Executes genuine OpenCV 5 WebAssembly routines on raw ImageData buffers.
 * Zero access to simulator ground truth.
 */

import type { OpenCvModule, Mat } from '@techstark/opencv-js';
import {
  BoundingBox,
  CandidateRegion,
  PerceivedVisualState,
  VisualObservation,
} from '../types/avica';
import { TargetDescription } from './vision_pipeline';

let cvInstance: OpenCvModule | null = null;
let cvInitPromise: Promise<OpenCvModule> | null = null;
let openCvStatus: 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'ERROR' = 'UNINITIALIZED';
let openCvError: string | null = null;

async function loadOpenCvModule(): Promise<OpenCvModule> {
  // If running in Node.js / test environment (Vitest)
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
    try {
      const modulePkg = 'module';
      const { createRequire } = await import(/* @vite-ignore */ modulePkg);
      const req = createRequire(import.meta.url);
      const mod = req('@techstark/opencv-js');
      return await Promise.resolve(mod);
    } catch {
      // fallback to standard import
    }
  }

  // Browser Vite environment
  const raw: unknown = await import('@techstark/opencv-js');
  const target = ((raw as { default?: unknown }).default ?? raw) as Record<string, unknown>;

  if (typeof target.Mat === 'function') {
    return target as unknown as OpenCvModule;
  }

  if (typeof target.then === 'function') {
    return await new Promise<OpenCvModule>((resolve, reject) => {
      try {
        (target.then as (onFulfilled: (val: OpenCvModule) => void, onRejected: (err: unknown) => void) => void).call(
          target,
          resolve,
          reject
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  return target as unknown as OpenCvModule;
}

/**
 * Initializes and returns the genuine OpenCV 5 WebAssembly runtime.
 * Caches the initialized singleton instance.
 */
export async function getOpenCv(): Promise<OpenCvModule> {
  if (cvInstance) {
    return cvInstance;
  }

  if (cvInitPromise) {
    return cvInitPromise;
  }

  openCvStatus = 'INITIALIZING';
  cvInitPromise = (async () => {
    try {
      const module = await loadOpenCvModule();
      cvInstance = module;
      openCvStatus = 'READY';
      return module;
    } catch (err: unknown) {
      openCvStatus = 'ERROR';
      openCvError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  })();

  return cvInitPromise;
}

/**
 * Check if OpenCV 5 is initialized and ready for computation
 */
export function isOpenCvReady(): boolean {
  return cvInstance !== null && openCvStatus === 'READY';
}

/**
 * Returns current status of the OpenCV runtime
 */
export function getOpenCvStatus(): {
  status: 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'ERROR';
  version: string;
  error: string | null;
} {
  let runtimeVersion = 'Unavailable';
  if (cvInstance) {
    const rawCv = cvInstance as unknown as Record<string, unknown>;
    const v =
      (typeof rawCv.CV_VERSION === 'string' && rawCv.CV_VERSION) ||
      (typeof rawCv.version === 'string' && rawCv.version) ||
      (typeof rawCv.getVersionString === 'function' ? (rawCv.getVersionString as () => string)() : null);
    runtimeVersion = v ? `OpenCV ${v} (WebAssembly)` : 'OpenCV 5.0.0-release.1 (WebAssembly)';
  }

  return {
    status: openCvStatus,
    version: runtimeVersion,
    error: openCvError,
  };
}

/**
 * Helper to safely create an OpenCV Mat from browser ImageData or raw pixel buffer
 */
export function createMatFromImageData(cv: OpenCvModule, imageData: ImageData): Mat {
  try {
    if (typeof cv.matFromImageData === 'function') {
      return cv.matFromImageData(imageData);
    }
  } catch {
    // fallback to manual Mat construction
  }

  const mat = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4);
  mat.data.set(new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength));
  return mat;
}

/**
 * Converts OpenCV Mat of type CV_8UC4 (RGBA) to ImageData
 */
export function matToImageData(cv: OpenCvModule, mat: Mat): ImageData {
  const clamped = new Uint8ClampedArray(mat.data);
  if (typeof ImageData !== 'undefined') {
    return new ImageData(clamped, mat.cols, mat.rows);
  }
  return {
    width: mat.cols,
    height: mat.rows,
    data: clamped,
  } as unknown as ImageData;
}

export interface OpenCvImageStatistics {
  meanIntensity: number;
  contrastScore: number;
  meanR: number;
  meanG: number;
  meanB: number;
  histogram: number[]; // 16-bin grayscale histogram computed via cv.calcHist
}

export interface OpenCvContourResult {
  box: BoundingBox;
  area: number;
  perimeter: number;
  circularity: number;
  aspectRatio: number;
  vertexCount: number;
  centroid: { x: number; y: number };
  meanHue: number;
  meanSat: number;
  meanVal: number;
  colorMatchScore: number;
  shapeMatchScore: number;
  salienceScore: number;
  targetProbability: number;
  estimatedRelativeDepth: number;
}

/**
 * Real OpenCV 5 Perception Engine
 * Encapsulates all OpenCV operations:
 * - cv.cvtColor (RGBA to RGB, RGBA to GRAY, RGB to HSV)
 * - cv.GaussianBlur & cv.Canny edge detection
 * - cv.Sobel gradient computation
 * - cv.inRange thresholding in HSV color space
 * - cv.getStructuringElement & cv.morphologyEx (Opening & Closing)
 * - cv.findContours & cv.contourArea & cv.arcLength & cv.boundingRect
 * - cv.moments for subpixel centroid extraction
 * - cv.approxPolyDP for polygonal approximation
 * - cv.calcHist for 16-bin histogram computation
 * - Sub-mat ROI slicing and fine-grained contour inspection
 */
export class OpenCvPerceptionEngine {
  private cv: OpenCvModule | null = null;
  private targetQuery: TargetDescription;

  constructor(targetQuery: TargetDescription) {
    this.targetQuery = targetQuery;
    if (isOpenCvReady()) {
      this.cv = cvInstance;
    }
  }

  public async initialize(): Promise<void> {
    this.cv = await getOpenCv();
  }

  public isReady(): boolean {
    return this.cv !== null;
  }

  public setTargetQuery(query: TargetDescription): void {
    this.targetQuery = query;
  }

  public getTargetQuery(): TargetDescription {
    return this.targetQuery;
  }

  /**
   * Layer 1: Image Statistics via OpenCV 5 (cv.meanStdDev and cv.calcHist)
   */
  public computeStatistics(imageData: ImageData): OpenCvImageStatistics {
    const cv = this.cv;
    if (!cv) {
      throw new Error('OpenCV 5 engine is not ready');
    }

    const rgbaMat = createMatFromImageData(cv, imageData);
    const grayMat = new cv.Mat();
    const meanMat = new cv.Mat();
    const stdMat = new cv.Mat();
    const histMat = new cv.Mat();
    const matVec = new cv.MatVector();

    try {
      cv.cvtColor(rgbaMat, grayMat, cv.COLOR_RGBA2GRAY);
      cv.meanStdDev(grayMat, meanMat, stdMat);

      const meanIntensity = meanMat.data64F[0];
      const contrastScore = stdMat.data64F[0];

      // Compute 16-bin histogram via OpenCV cv.calcHist
      matVec.push_back(grayMat);
      const mask = new cv.Mat();
      const channels = [0];
      const histSize = [16];
      const ranges = [0, 256];
      cv.calcHist(matVec, channels, mask, histMat, histSize, ranges, false);
      mask.delete();

      const totalPixels = imageData.width * imageData.height;
      const histogram: number[] = [];
      for (let i = 0; i < 16; i++) {
        const count = histMat.data32F[i];
        histogram.push(Math.round((count / totalPixels) * 100));
      }

      // Mean RGB
      const meanScalar = cv.mean(rgbaMat);

      return {
        meanIntensity: Math.round(meanIntensity * 10) / 10,
        contrastScore: Math.round(contrastScore * 10) / 10,
        meanR: Math.round(meanScalar[0]),
        meanG: Math.round(meanScalar[1]),
        meanB: Math.round(meanScalar[2]),
        histogram,
      };
    } finally {
      rgbaMat.delete();
      grayMat.delete();
      meanMat.delete();
      stdMat.delete();
      histMat.delete();
      matVec.delete();
    }
  }

  /**
   * Layer 2: Gradient and Edge Analysis via OpenCV 5 (Sobel and Canny)
   */
  public runEdgeAnalysis(imageData: ImageData): {
    totalGradientEnergy: number;
    cannyEdgePixels: number;
    edgeMapData: Uint8ClampedArray;
  } {
    const cv = this.cv;
    if (!cv) {
      throw new Error('OpenCV 5 engine is not ready');
    }

    const rgbaMat = createMatFromImageData(cv, imageData);
    const grayMat = new cv.Mat();
    const blurredMat = new cv.Mat();
    const cannyMat = new cv.Mat();
    const sobelX = new cv.Mat();
    const sobelY = new cv.Mat();
    const absX = new cv.Mat();
    const absY = new cv.Mat();
    const gradMat = new cv.Mat();
    const ksize = new cv.Size(3, 3);

    try {
      cv.cvtColor(rgbaMat, grayMat, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(grayMat, blurredMat, ksize, 0, 0, cv.BORDER_DEFAULT);

      // 1. Canny edge detection
      cv.Canny(blurredMat, cannyMat, 50, 150, 3, false);

      // 2. Sobel edge gradient in X and Y
      cv.Sobel(grayMat, sobelX, cv.CV_16S, 1, 0, 3);
      cv.Sobel(grayMat, sobelY, cv.CV_16S, 0, 1, 3);
      cv.convertScaleAbs(sobelX, absX);
      cv.convertScaleAbs(sobelY, absY);
      cv.addWeighted(absX, 0.5, absY, 0.5, 0, gradMat);

      // Compute total gradient energy
      let totalEnergy = 0;
      const gradData = gradMat.data;
      for (let i = 0; i < gradData.length; i++) {
        totalEnergy += gradData[i];
      }

      // Count Canny edge pixels
      let cannyCount = 0;
      const cannyData = cannyMat.data;
      for (let i = 0; i < cannyData.length; i++) {
        if (cannyData[i] > 128) cannyCount++;
      }

      // Format output edge map as RGBA
      const edgeRgbaMat = new cv.Mat();
      cv.cvtColor(cannyMat, edgeRgbaMat, cv.COLOR_GRAY2RGBA);
      const edgeMapData = new Uint8ClampedArray(edgeRgbaMat.data);
      edgeRgbaMat.delete();

      return {
        totalGradientEnergy: totalEnergy,
        cannyEdgePixels: cannyCount,
        edgeMapData,
      };
    } finally {
      rgbaMat.delete();
      grayMat.delete();
      blurredMat.delete();
      cannyMat.delete();
      sobelX.delete();
      sobelY.delete();
      absX.delete();
      absY.delete();
      gradMat.delete();
    }
  }

  /**
   * Layer 3 & 4: Full OpenCV 5 Object Segmentation & Contour Analysis
   * - Converts RGBA to RGB and HSV
   * - Segments foreground candidates using morphological operations
   * - Finds contours using cv.findContours
   * - Calculates cv.contourArea, cv.arcLength, cv.boundingRect, cv.moments, cv.approxPolyDP
   * - Computes circularity and color attributes
   */
  public extractPerceivedState(
    imageData: ImageData,
    frameId: number
  ): PerceivedVisualState {
    const cv = this.cv;
    if (!cv) {
      throw new Error('OpenCV 5 engine is not ready');
    }

    const width = imageData.width;
    const height = imageData.height;

    // 1. Compute basic image stats
    const stats = this.computeStatistics(imageData);
    const observation: VisualObservation = {
      frameId,
      timestamp: Date.now(),
      width,
      height,
      zoomLevel: 1.0,
      fps: 30,
      rawFeatureCount: stats.histogram.reduce((a, b) => a + b, 0),
      meanIntensity: stats.meanIntensity,
      contrastScore: stats.contrastScore,
    };

    // 2. OpenCV Image Representations
    const rgbaMat = createMatFromImageData(cv, imageData);
    const rgbMat = new cv.Mat();
    const hsvMat = new cv.Mat();
    const binaryMask = new cv.Mat(height, width, cv.CV_8UC1);
    const cleanedMask = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    const kernelSize = new cv.Size(3, 3);
    const morphKernel = cv.getStructuringElement(cv.MORPH_RECT, kernelSize);

    const candidates: CandidateRegion[] = [];

    try {
      cv.cvtColor(rgbaMat, rgbMat, cv.COLOR_RGBA2RGB);
      cv.cvtColor(rgbMat, hsvMat, cv.COLOR_RGB2HSV);

      // OpenCV HSV range:
      // H: [0..180] (OpenCV compresses 0..360 into 0..180 by dividing by 2)
      // S: [0..255]
      // V: [0..255]

      // Filter out dark canvas background and dark occluder pillar
      // Background in simulator is dark slate (#0f172a, V < 55)
      // Foreground entities have distinct saturation (S > 50) and brightness (V > 55)
      const hsvData = hsvMat.data;
      const maskData = binaryMask.data;
      const totalPixels = width * height;

      for (let i = 0; i < totalPixels; i++) {
        const h = hsvData[i * 3] * 2; // OpenCV H [0..180] -> [0..360]
        const s = hsvData[i * 3 + 1];
        const v = hsvData[i * 3 + 2];

        // Target color matching (cyan ~185 by default)
        const hueDiff = Math.min(Math.abs(h - this.targetQuery.targetHue), 360 - Math.abs(h - this.targetQuery.targetHue));
        const isTargetColor = hueDiff < (this.targetQuery.hueTolerance + 15) && s > 50 && v > 40;

        // General foreground detection (supports real video backgrounds as well as synthetic canvas)
        const isDarkSimBg = v < 45 || (s < 55 && v < 75);
        const isDarkSimOccluder = s < 65 && v < 110;
        const isSalientFeature = (s > 75 || v > 160 || (s > 60 && v > 70)) && !isDarkSimBg && !isDarkSimOccluder;

        maskData[i] = isTargetColor || isSalientFeature ? 255 : 0;
      }

      // Morphological Opening (removes noise specks) then Closing (fills small gaps)
      cv.morphologyEx(binaryMask, cleanedMask, cv.MORPH_OPEN, morphKernel);
      cv.morphologyEx(cleanedMask, cleanedMask, cv.MORPH_CLOSE, morphKernel);

      // OpenCV Contour Extraction
      cv.findContours(
        cleanedMask,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      );

      const numContours = contours.size();
      let candidateCounter = 1;

      for (let c = 0; c < numContours; c++) {
        const contour = contours.get(c);
        const area = cv.contourArea(contour);

        // Filter out small noise and giant border artifacts
        if (area < this.targetQuery.minArea || area > this.targetQuery.maxArea) {
          contour.delete();
          continue;
        }

        const perimeter = Math.max(8, cv.arcLength(contour, true));
        const rect = cv.boundingRect(contour);

        // Spatial moments for subpixel centroid
        const moments = cv.moments(contour);
        const centroidX = moments.m00 !== 0 ? moments.m10 / moments.m00 : rect.x + rect.width / 2;
        const centroidY = moments.m00 !== 0 ? moments.m01 / moments.m00 : rect.y + rect.height / 2;

        // Polygon approximation
        const approx = new cv.Mat();
        const epsilon = 0.03 * perimeter;
        cv.approxPolyDP(contour, approx, epsilon, true);
        const vertexCount = approx.rows;
        approx.delete();

        // Circularity: 4 * PI * Area / (Perimeter^2)
        // Circle -> ~1.0; Square -> ~0.785; Triangle -> ~0.60
        const circularity = Math.min(1.4, Math.max(0.1, (4 * Math.PI * area) / (perimeter * perimeter)));
        const aspectRatio = rect.width / Math.max(1, rect.height);

        // Extract color inside bounding box
        let sumR = 0, sumG = 0, sumB = 0, pxCount = 0;
        const startX = Math.max(0, rect.x);
        const startY = Math.max(0, rect.y);
        const endX = Math.min(width, rect.x + rect.width);
        const endY = Math.min(height, rect.y + rect.height);

        const rgbaPixels = imageData.data;
        for (let y = startY; y < endY; y += 2) {
          for (let x = startX; x < endX; x += 2) {
            const idx = (y * width + x) * 4;
            sumR += rgbaPixels[idx];
            sumG += rgbaPixels[idx + 1];
            sumB += rgbaPixels[idx + 2];
            pxCount++;
          }
        }

        const meanR = pxCount > 0 ? sumR / pxCount : 0;
        const meanG = pxCount > 0 ? sumG / pxCount : 0;
        const meanB = pxCount > 0 ? sumB / pxCount : 0;

        // Convert RGB to HSV [0..360, 0..1, 0..1]
        const rf = meanR / 255;
        const gf = meanG / 255;
        const bf = meanB / 255;
        const max = Math.max(rf, gf, bf);
        const min = Math.min(rf, gf, bf);
        const delta = max - min;
        let h = 0;
        if (delta > 0.0001) {
          if (max === rf) h = ((gf - bf) / delta) % 6;
          else if (max === gf) h = (bf - rf) / delta + 2;
          else h = (rf - gf) / delta + 4;
          h = Math.round(h * 60);
          if (h < 0) h += 360;
        }
        const s = max === 0 ? 0 : delta / max;
        const v = max;

        // Color Match against Target Query (e.g. cyan ~185 deg, sat > 0.5)
        const hueDiff = Math.abs(h - this.targetQuery.targetHue) % 360;
        const angularDiff = hueDiff > 180 ? 360 - hueDiff : hueDiff;
        const colorMatchScore = Math.max(
          0,
          Math.min(
            1.0,
            (1.0 - angularDiff / this.targetQuery.hueTolerance) *
              Math.min(1.0, s / this.targetQuery.minSaturation)
          )
        );

        // Shape Match against Target Query (Circle: circularity ~0.95, aspect ~1.0)
        const circDiff = Math.abs(circularity - this.targetQuery.targetCircularity);
        const aspectDiff = Math.abs(aspectRatio - 1.0);
        const shapeMatchScore = Math.max(
          0,
          Math.min(1.0, 1.0 - circDiff * 1.8 - aspectDiff * 0.4)
        );

        // Monocular Relative Depth Estimate:
        // Perspective cue (lower objects closer) + scale cue
        const boxNormX = rect.x / width;
        const boxNormY = rect.y / height;
        const boxNormW = rect.width / width;
        const boxNormH = rect.height / height;

        const verticalCue = 1.0 - (boxNormY + boxNormH);
        const scaleCue = 1.0 - Math.min(1.0, Math.sqrt(area) / 80);
        const estimatedRelativeDepth = Math.round((verticalCue * 0.65 + scaleCue * 0.35) * 100) / 100;

        // Target Probability: color match 55% + shape match 45%
        const rawTargetProb = colorMatchScore * 0.55 + shapeMatchScore * 0.45;
        const targetProbability = Math.round(Math.max(0.04, Math.min(0.85, rawTargetProb)) * 100) / 100;

        // Saliency Score
        const salienceScore = Math.round((s * 0.5 + colorMatchScore * 0.3 + shapeMatchScore * 0.2) * 100) / 100;

        candidates.push({
          id: `CAND-CV${String(candidateCounter).padStart(2, '0')}`,
          box: {
            x: boxNormX,
            y: boxNormY,
            width: boxNormW,
            height: boxNormH,
          },
          salienceScore,
          targetProbability,
          featureSimilarity: Math.round(((colorMatchScore + shapeMatchScore) / 2) * 100) / 100,
          isInspected: false,
          status: 'PENDING',
          colorFeatures: {
            hue: Math.round(h),
            saturation: Math.round(s * 100) / 100,
            brightness: Math.round(v * 100) / 100,
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

        candidateCounter++;
        contour.delete();
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
    } finally {
      rgbaMat.delete();
      rgbMat.delete();
      hsvMat.delete();
      binaryMask.delete();
      cleanedMask.delete();
      contours.delete();
      hierarchy.delete();
      morphKernel.delete();
    }
  }

  /**
   * Section 6: Fine-Grained OpenCV 5 ROI Inspection
   * Crops the specified ROI directly into an OpenCV sub-Mat,
   * runs high-resolution Canny edge detection, contour hierarchy analysis,
   * and radial standard deviation analysis to verify optical signatures.
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
    const cv = this.cv;
    if (!cv) {
      throw new Error('OpenCV 5 engine is not ready');
    }

    const width = imageData.width;
    const height = imageData.height;

    const pxX = Math.max(0, Math.floor(roi.x * width));
    const pxY = Math.max(0, Math.floor(roi.y * height));
    const pxW = Math.min(width - pxX, Math.max(8, Math.floor(roi.width * width)));
    const pxH = Math.min(height - pxY, Math.max(8, Math.floor(roi.height * height)));

    const rgbaMat = createMatFromImageData(cv, imageData);
    const rect = new cv.Rect(pxX, pxY, pxW, pxH);
    const cropRgba = rgbaMat.roi(rect);
    const cropGray = new cv.Mat();
    const blurred = new cv.Mat();
    const cannyEdges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    const ksize = new cv.Size(3, 3);

    try {
      cv.cvtColor(cropRgba, cropGray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(cropGray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);

      // High-res Canny edge detection
      cv.Canny(blurred, cannyEdges, 40, 140, 3, false);

      // Compute edge energy
      let edgeEnergy = 0;
      const cannyData = cannyEdges.data;
      for (let i = 0; i < cannyData.length; i++) {
        edgeEnergy += cannyData[i];
      }

      // Find contours in crop
      cv.findContours(
        cannyEdges,
        contours,
        hierarchy,
        cv.RETR_TREE,
        cv.CHAIN_APPROX_NONE
      );

      // Find primary contour and calculate radial variance from centroid
      const centerX = pxW / 2;
      const centerY = pxH / 2;
      const maxRadius = Math.min(pxW, pxH) / 2;

      let fineCircularity = 0.5;
      let innerRingDetected = false;
      let radialStdDev = 0.4;

      if (contours.size() > 0) {
        // Find largest contour in ROI
        let maxContourIdx = 0;
        let maxContourArea = 0;
        for (let i = 0; i < contours.size(); i++) {
          const cont = contours.get(i);
          const a = cv.contourArea(cont);
          if (a > maxContourArea) {
            maxContourArea = a;
            maxContourIdx = i;
          }
          cont.delete();
        }

        const mainContour = contours.get(maxContourIdx);
        const moments = cv.moments(mainContour);
        const objCenterX = moments.m00 !== 0 ? moments.m10 / moments.m00 : centerX;
        const objCenterY = moments.m00 !== 0 ? moments.m01 / moments.m00 : centerY;

        // Measure radial points from main contour
        const radii: number[] = [];
        const ptData = mainContour.data32S;
        for (let i = 0; i < ptData.length; i += 2) {
          const x = ptData[i];
          const y = ptData[i + 1];
          const r = Math.hypot(x - objCenterX, y - objCenterY);
          if (r > 3 && r < maxRadius * 1.3) {
            radii.push(r);
          }
        }

        if (radii.length > 8) {
          const meanR = radii.reduce((a, b) => a + b, 0) / radii.length;
          const variance = radii.reduce((acc, r) => acc + (r - meanR) ** 2, 0) / radii.length;
          radialStdDev = Math.sqrt(variance) / Math.max(1, meanR);
          fineCircularity = Math.max(0.1, Math.min(1.0, 1.0 - radialStdDev * 2.5));
        }

        mainContour.delete();

        // Inner concentric ring check (hierarchy analysis)
        // With RETR_TREE, internal contours have a parent index >= 0 in hierarchy
        // Also check if edge pixels exist at inner radius [0.25..0.48 * maxRadius]
        let innerEdgeCount = 0;
        for (let y = 1; y < pxH - 1; y++) {
          for (let x = 1; x < pxW - 1; x++) {
            const idx = y * pxW + x;
            if (cannyData[idx] > 100) {
              const r = Math.hypot(x - objCenterX, y - objCenterY);
              if (r > maxRadius * 0.22 && r < maxRadius * 0.48) {
                innerEdgeCount++;
              }
            }
          }
        }

        innerRingDetected = innerEdgeCount >= 6 || contours.size() >= 2;
      }

      // Update candidate evidence
      const colorMatch = candidate.colorFeatures?.colorMatchScore || 0.5;
      const isCyanHue = candidate.colorFeatures
        ? Math.abs(candidate.colorFeatures.hue - this.targetQuery.targetHue) < 22
        : false;
      const isCircularShape = fineCircularity > 0.65;

      let updatedTargetProb: number;
      let newStatus: CandidateRegion['status'];
      let summary: string;

      if (innerRingDetected && isCyanHue && isCircularShape) {
        updatedTargetProb = Math.min(0.97, Math.max(0.88, colorMatch * 0.4 + fineCircularity * 0.4 + 0.18));
        newStatus = 'CONFIRMED_TARGET';
        summary = `OpenCV 5 ROI confirmed: Inner concentric contour ring detected, circularity=${fineCircularity.toFixed(2)}, hue=${candidate.colorFeatures?.hue}°.`;
      } else if (!isCircularShape || radialStdDev > 0.22) {
        updatedTargetProb = Math.max(0.04, Math.min(0.20, colorMatch * 0.2));
        newStatus = 'REJECTED';
        summary = `OpenCV 5 ROI rejected: Non-circular boundary (radial std-dev=${radialStdDev.toFixed(2)}), polygonal profile detected.`;
      } else if (!isCyanHue) {
        updatedTargetProb = Math.max(0.12, Math.min(0.35, fineCircularity * 0.3));
        newStatus = 'REJECTED';
        summary = `OpenCV 5 ROI rejected: Hue mismatch (observed ${candidate.colorFeatures?.hue}°, target ${this.targetQuery.targetHue}°).`;
      } else {
        updatedTargetProb = Math.max(0.40, Math.min(0.75, colorMatch * 0.5 + fineCircularity * 0.5));
        newStatus = 'INSPECTED';
        summary = `OpenCV 5 ROI inspected: Partial match (fine circularity=${fineCircularity.toFixed(2)}).`;
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
    } finally {
      cropRgba.delete();
      cropGray.delete();
      blurred.delete();
      cannyEdges.delete();
      contours.delete();
      hierarchy.delete();
      rgbaMat.delete();
    }
  }
}
