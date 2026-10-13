import { describe, it, expect, beforeEach } from 'vitest';
import { FacePerceptionEngine, STANDARD_FACE_CONNECTIONS } from '../src/perception/face_perception';

function makeImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  return {
    width,
    height,
    data,
    colorSpace: 'srgb',
  } as unknown as ImageData;
}

describe('FacePerceptionEngine', () => {
  let engine: FacePerceptionEngine;

  beforeEach(() => {
    engine = new FacePerceptionEngine();
  });

  it('strictly returns null on blank or non-face pixel frames without fabricating fake coordinates', () => {
    // Blank dark frame (640x400)
    const emptyData = makeImageData(640, 400);
    const result = engine.detectFace(emptyData, 1);
    expect(result).toBeNull();
  });

  it('detects face geometry and extracts biometric landmarks from skin-chrominance face region', () => {
    const width = 640;
    const height = 400;
    const imgData = makeImageData(width, height);
    const pixels = imgData.data;

    // Draw a synthetic face elliptical cluster centered at (320, 200) with skin chrominance
    // YCbCr skin tone: R=190, G=130, B=100 (Cb=110, Cr=148)
    const cx = 320;
    const cy = 200;
    const rx = 80;
    const ry = 110;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) {
          const idx = (y * width + x) * 4;
          pixels[idx] = 190;     // R
          pixels[idx + 1] = 130; // G
          pixels[idx + 2] = 100; // B
          pixels[idx + 3] = 255; // A
        }
      }
    }

    // Add dark pixels for left and right eyes inside upper bilateral quadrants
    // Left eye ~ (280, 165), Right eye ~ (360, 165)
    for (let ey = 160; ey <= 170; ey++) {
      for (let ex = 275; ex <= 285; ex++) {
        const idx = (ey * width + ex) * 4;
        pixels[idx] = 30;
        pixels[idx + 1] = 25;
        pixels[idx + 2] = 20;
      }
      for (let ex = 355; ex <= 365; ex++) {
        const idx = (ey * width + ex) * 4;
        pixels[idx] = 30;
        pixels[idx + 1] = 25;
        pixels[idx + 2] = 20;
      }
    }

    const face = engine.detectFace(imgData, 1);
    expect(face).not.toBeNull();
    if (!face) return;

    expect(face.isDetected).toBe(true);
    expect(face.boundingBox.width).toBeGreaterThan(0.1);
    expect(face.boundingBox.height).toBeGreaterThan(0.1);
    expect(face.landmarks.length).toBeGreaterThanOrEqual(15);
    expect(face.contour.length).toBeGreaterThanOrEqual(6);
    expect(face.connections).toEqual(STANDARD_FACE_CONNECTIONS);
    expect(face.poseEstimate).toBeDefined();
    expect(typeof face.poseEstimate.rollDeg).toBe('number');
    expect(typeof face.poseEstimate.yawDeg).toBe('number');
  });

  it('marks geometry as stale when live camera input halts', () => {
    const width = 640;
    const height = 400;
    const imgData = makeImageData(width, height);
    const pixels = imgData.data;

    // Synthetic face
    for (let y = 100; y < 300; y++) {
      for (let x = 240; x < 400; x++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = 190;
        pixels[idx + 1] = 130;
        pixels[idx + 2] = 100;
        pixels[idx + 3] = 255;
      }
    }

    const face = engine.detectFace(imgData, 1);
    expect(face).not.toBeNull();
    expect(face?.isStale).toBe(false);

    engine.markStale();
    const staleFace = engine.getLastFace();
    expect(staleFace?.isStale).toBe(true);
    expect(staleFace?.staleTimestamp).toBeGreaterThan(0);
  });
});
