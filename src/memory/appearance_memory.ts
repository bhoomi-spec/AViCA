/**
 * Appearance Memory Module
 *
 * Maintains multi-sample visual feature representation (appearance signature)
 * for tracked entities to preserve identity through temporal occlusions,
 * illumination variations, and distractor interference.
 */

import { CandidateRegion, AppearanceMemoryData } from '../types/avica';
import { calculateEmbeddingDistance } from '../perception/low_level';

export interface AppearanceMatchResult {
  matchScore: number; // 0..1 (1.0 = perfect appearance signature match)
  isMatch: boolean;
  embeddingDistance: number;
  hueDelta: number;
  shapeMatch: number;
  reason: string;
}

export class AppearanceMemory {
  private meanEmbedding: number[];
  private sampleHistory: number[][] = [];
  private maxSamples = 12;
  private primaryHue = 190; // Default target Cyan hue
  private meanCircularity = 0.85;
  private sampleCount = 0;
  private lastUpdated = 0;

  constructor(
    initialEmbedding: number[] = [],
    initialHue = 190,
    initialCircularity = 0.85
  ) {
    this.meanEmbedding = initialEmbedding.length > 0 ? [...initialEmbedding] : new Array(8).fill(0);
    this.primaryHue = initialHue;
    this.meanCircularity = initialCircularity;
    if (initialEmbedding.length > 0) {
      this.sampleHistory.push([...initialEmbedding]);
      this.sampleCount = 1;
    }
  }

  /**
   * Updates appearance signature with a newly verified observation sample
   */
  public update(
    embedding: number[],
    observedHue?: number,
    observedCircularity?: number,
    timestamp = Date.now()
  ): void {
    if (embedding.length === 0) return;

    if (this.sampleCount === 0 || this.meanEmbedding.every((v) => v === 0)) {
      this.meanEmbedding = [...embedding];
    } else {
      // Exponential moving average: 75% retained, 25% new observation
      this.meanEmbedding = this.meanEmbedding.map(
        (v, idx) => v * 0.75 + (embedding[idx] || 0) * 0.25
      );
    }

    if (observedHue !== undefined && observedHue >= 0) {
      // Handle circular hue blending
      let dHue = observedHue - this.primaryHue;
      if (dHue > 180) dHue -= 360;
      if (dHue < -180) dHue += 360;
      this.primaryHue = (this.primaryHue + dHue * 0.2 + 360) % 360;
    }

    if (observedCircularity !== undefined && observedCircularity > 0) {
      this.meanCircularity = this.meanCircularity * 0.8 + observedCircularity * 0.2;
    }

    this.sampleHistory.push([...embedding]);
    if (this.sampleHistory.length > this.maxSamples) {
      this.sampleHistory.shift();
    }

    this.sampleCount++;
    this.lastUpdated = timestamp;
  }

  /**
   * Compares candidate against stored appearance memory to verify entity identity
   */
  public evaluateCandidate(
    candidate: CandidateRegion,
    candidateEmbedding: number[]
  ): AppearanceMatchResult {
    // 1. Embedding distance
    const embDist = calculateEmbeddingDistance(candidateEmbedding, this.meanEmbedding);
    const embSim = Math.max(0, 1.0 - embDist);

    // 2. Hue match
    let hueDelta = 0;
    let hueScore = 0.8;
    if (candidate.colorFeatures) {
      const cU = candidate.colorFeatures.hue;
      let diff = Math.abs(cU - this.primaryHue);
      if (diff > 180) diff = 360 - diff;
      hueDelta = diff;
      hueScore = Math.max(0, 1.0 - hueDelta / 45.0); // 45 degree tolerance window
    }

    // 3. Shape profile match
    let shapeScore = 0.8;
    if (candidate.shapeFeatures) {
      const circ = candidate.shapeFeatures.circularity;
      const diffCirc = Math.abs(circ - this.meanCircularity);
      shapeScore = Math.max(0, 1.0 - diffCirc * 2.0);
    }

    // Combined appearance signature score: 40% embedding, 35% hue, 25% shape
    const combinedScore = embSim * 0.4 + hueScore * 0.35 + shapeScore * 0.25;
    const isMatch = combinedScore >= 0.62 && hueDelta < 35;

    let reason = '';
    if (isMatch) {
      reason = `Appearance signature match (score: ${combinedScore.toFixed(2)}, hueΔ: ${hueDelta.toFixed(0)}°, embSim: ${embSim.toFixed(2)})`;
    } else if (hueDelta >= 35) {
      reason = `Hue mismatch: candidate hue ${candidate.colorFeatures?.hue ?? 'N/A'}° differs by ${hueDelta.toFixed(0)}° from memory ${this.primaryHue.toFixed(0)}°`;
    } else {
      reason = `Appearance distance too high: combined score ${combinedScore.toFixed(2)} < 0.62 threshold`;
    }

    return {
      matchScore: Math.round(combinedScore * 100) / 100,
      isMatch,
      embeddingDistance: Math.round(embDist * 100) / 100,
      hueDelta: Math.round(hueDelta * 10) / 10,
      shapeMatch: Math.round(shapeScore * 100) / 100,
      reason,
    };
  }

  public getMeanEmbedding(): number[] {
    return [...this.meanEmbedding];
  }

  public getAppearanceData(): AppearanceMemoryData {
    return {
      meanEmbedding: [...this.meanEmbedding],
      sampleCount: this.sampleCount,
      hue: Math.round(this.primaryHue),
      circularity: Math.round(this.meanCircularity * 100) / 100,
      lastUpdated: this.lastUpdated,
    };
  }
}
