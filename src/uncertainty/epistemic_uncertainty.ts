/**
 * Epistemic Uncertainty Engine
 * Computes confidence, epistemic uncertainty, ambiguity entropy across candidate matches,
 * and determines evidence sufficiency for action branching.
 */

import { CandidateRegion, EpistemicUncertaintyState } from '../types/avica';

export interface UncertaintyParams {
  sufficientEvidenceThreshold: number; // e.g. 0.82
  maxEntropyAmbiguity: number; // e.g. 0.70
}

export const DEFAULT_UNCERTAINTY_PARAMS: UncertaintyParams = {
  sufficientEvidenceThreshold: 0.82,
  maxEntropyAmbiguity: 0.70,
};

export class EpistemicUncertaintyEngine {
  private currentState: EpistemicUncertaintyState = {
    targetProbability: 0.0,
    confidence: 0.0,
    uncertaintyScore: 1.0,
    ambiguityScore: 1.0,
    missingEvidenceScore: 1.0,
    isEvidenceSufficient: false,
    sufficientThreshold: DEFAULT_UNCERTAINTY_PARAMS.sufficientEvidenceThreshold,
    lastUpdatedFrame: 0,
  };

  /**
   * Updates uncertainty evaluation given current visual candidates and target match hypotheses
   */
  public evaluate(
    candidates: CandidateRegion[],
    targetConfirmedInMemory: boolean,
    targetTrackedConfidence: number,
    frameId: number
  ): EpistemicUncertaintyState {
    if (candidates.length === 0) {
      if (targetConfirmedInMemory) {
        // Occlusion or missed detection
        this.currentState = {
          targetProbability: targetTrackedConfidence * 0.7,
          confidence: targetTrackedConfidence * 0.5,
          uncertaintyScore: 1.0 - targetTrackedConfidence * 0.5,
          ambiguityScore: 0.3,
          missingEvidenceScore: 0.9,
          isEvidenceSufficient: false,
          sufficientThreshold: DEFAULT_UNCERTAINTY_PARAMS.sufficientEvidenceThreshold,
          lastUpdatedFrame: frameId,
        };
        return this.currentState;
      }

      this.currentState = {
        targetProbability: 0.0,
        confidence: 0.0,
        uncertaintyScore: 1.0,
        ambiguityScore: 0.0,
        missingEvidenceScore: 1.0,
        isEvidenceSufficient: false,
        sufficientThreshold: DEFAULT_UNCERTAINTY_PARAMS.sufficientEvidenceThreshold,
        lastUpdatedFrame: frameId,
      };
      return this.currentState;
    }

    // Sort candidates by target probability descending
    const sorted = [...candidates].sort((a, b) => b.targetProbability - a.targetProbability);
    const topCandidate = sorted[0];

    // Compute normalized Shannon entropy among candidate probabilities (Ambiguity)
    let sumProb = 0;
    for (const c of sorted) sumProb += Math.max(0.001, c.targetProbability);

    let entropy = 0;
    for (const c of sorted) {
      const p = Math.max(0.001, c.targetProbability) / sumProb;
      entropy -= p * Math.log2(p);
    }
    // Normalize entropy by max possible log2(N)
    const maxEntropy = sorted.length > 1 ? Math.log2(sorted.length) : 1;
    const normalizedAmbiguity = Math.min(1.0, Math.max(0.0, entropy / (maxEntropy || 1)));

    // Missing evidence: if candidate was only seen in coarse low-res full frame without ROI inspection
    const missingEvidenceScore = topCandidate.isInspected ? 0.15 : 0.65;

    // Confidence derived from top candidate prob discounted by ambiguity and missing evidence
    const rawConfidence = topCandidate.targetProbability * (1.0 - normalizedAmbiguity * 0.4) * (1.0 - missingEvidenceScore * 0.3);
    const confidence = Math.min(1.0, Math.max(0.05, rawConfidence));
    const uncertaintyScore = 1.0 - confidence;

    const isEvidenceSufficient =
      topCandidate.targetProbability >= DEFAULT_UNCERTAINTY_PARAMS.sufficientEvidenceThreshold &&
      uncertaintyScore < 0.25;

    this.currentState = {
      targetProbability: Math.round(topCandidate.targetProbability * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      uncertaintyScore: Math.round(uncertaintyScore * 100) / 100,
      ambiguityScore: Math.round(normalizedAmbiguity * 100) / 100,
      missingEvidenceScore: Math.round(missingEvidenceScore * 100) / 100,
      isEvidenceSufficient,
      sufficientThreshold: DEFAULT_UNCERTAINTY_PARAMS.sufficientEvidenceThreshold,
      lastUpdatedFrame: frameId,
    };

    return this.currentState;
  }

  public getState(): EpistemicUncertaintyState {
    return this.currentState;
  }
}
