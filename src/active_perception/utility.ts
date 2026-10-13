/**
 * Active Perception & Observation Utility Policy
 * Evaluates candidate actions using information gain minus computation and latency costs.
 * Utility = ExpectedInformationGain - ComputationCost - LatencyCost
 */

import {
  ActionType,
  AgentActionDecision,
  CandidateRegion,
  EpistemicUncertaintyState,
  WorkingMemoryEntity,
} from '../types/avica';

export interface ActionCostProfile {
  action: ActionType;
  computationCost: number; // in relative FLOPS/cost units (e.g. 0.5 to 8.0)
  latencyCost: number; // in relative latency penalty units
  baseInformationGain: number; // potential uncertainty reduction
}

export const ACTION_COST_TABLE: Record<ActionType, ActionCostProfile> = {
  PROCESS_FULL_FRAME: {
    action: 'PROCESS_FULL_FRAME',
    computationCost: 1.5,
    latencyCost: 1.0,
    baseInformationGain: 0.35,
  },
  INSPECT_ROI: {
    action: 'INSPECT_ROI',
    computationCost: 0.8,
    latencyCost: 0.5,
    baseInformationGain: 0.70,
  },
  ZOOM: {
    action: 'ZOOM',
    computationCost: 1.2,
    latencyCost: 0.9,
    baseInformationGain: 0.60,
  },
  INCREASE_FPS: {
    action: 'INCREASE_FPS',
    computationCost: 2.0,
    latencyCost: 0.4,
    baseInformationGain: 0.45,
  },
  DECREASE_FPS: {
    action: 'DECREASE_FPS',
    computationCost: 0.2,
    latencyCost: 0.1,
    baseInformationGain: 0.05,
  },
  TRACK_OBJECT: {
    action: 'TRACK_OBJECT',
    computationCost: 0.6,
    latencyCost: 0.3,
    baseInformationGain: 0.55,
  },
  RUN_EDGE_ANALYSIS: {
    action: 'RUN_EDGE_ANALYSIS',
    computationCost: 1.0,
    latencyCost: 0.7,
    baseInformationGain: 0.40,
  },
  RUN_SIFT: {
    action: 'RUN_SIFT',
    computationCost: 3.5,
    latencyCost: 2.2,
    baseInformationGain: 0.80,
  },
  RUN_FEATURE_MATCHING: {
    action: 'RUN_FEATURE_MATCHING',
    computationCost: 2.5,
    latencyCost: 1.5,
    baseInformationGain: 0.75,
  },
  RUN_SEGMENTATION: {
    action: 'RUN_SEGMENTATION',
    computationCost: 4.0,
    latencyCost: 2.5,
    baseInformationGain: 0.65,
  },
  RUN_DEPTH: {
    action: 'RUN_DEPTH',
    computationCost: 2.8,
    latencyCost: 1.8,
    baseInformationGain: 0.50,
  },
  RUN_OPTICAL_FLOW: {
    action: 'RUN_OPTICAL_FLOW',
    computationCost: 3.2,
    latencyCost: 2.0,
    baseInformationGain: 0.60,
  },
  QUERY_MEMORY: {
    action: 'QUERY_MEMORY',
    computationCost: 0.1,
    latencyCost: 0.05,
    baseInformationGain: 0.30,
  },
  QUERY_WORLD_MODEL: {
    action: 'QUERY_WORLD_MODEL',
    computationCost: 0.2,
    latencyCost: 0.1,
    baseInformationGain: 0.35,
  },
  REQUEST_SECOND_VIEW: {
    action: 'REQUEST_SECOND_VIEW',
    computationCost: 5.0,
    latencyCost: 4.0,
    baseInformationGain: 0.85,
  },
  REQUEST_HUMAN_REVIEW: {
    action: 'REQUEST_HUMAN_REVIEW',
    computationCost: 0.1,
    latencyCost: 10.0,
    baseInformationGain: 0.95,
  },
  WAIT: {
    action: 'WAIT',
    computationCost: 0.05,
    latencyCost: 0.05,
    baseInformationGain: 0.0,
  },
  STOP: {
    action: 'STOP',
    computationCost: 0.0,
    latencyCost: 0.0,
    baseInformationGain: 0.0,
  },
};

export class ActiveObservationPolicy {
  private lambdaCompute = 0.25; // cost weight
  private lambdaLatency = 0.15; // latency weight

  /**
   * Evaluates available visual tools and selects the action that maximizes net utility:
   * NetUtility = ExpectedInfoGain - (lambdaCompute * Cost) - (lambdaLatency * Latency)
   *
   * Driven by real visual uncertainty and candidate state, NOT predetermined sequences.
   */
  public selectBestAction(
    uncertainty: EpistemicUncertaintyState,
    candidates: CandidateRegion[],
    targetEntity?: WorkingMemoryEntity,
    priorPlannedAction?: ActionType,
    priorActionResult?: {
      action: ActionType;
      success: boolean;
      evidenceSummary: string;
      candidateId?: string;
    }
  ): AgentActionDecision {
    // Collect uninspected and active candidates
    const uninspectedCandidates = candidates.filter(
      (c) => !c.isInspected && c.status !== 'REJECTED'
    );
    const confirmedCandidates = candidates.filter(
      (c) => c.status === 'CONFIRMED_TARGET'
    );
    const rejectedCandidates = candidates.filter(
      (c) => c.status === 'REJECTED'
    );

    // Case 1: Target is locked with sufficient evidence in working memory or steered by prior action -> TRACK_OBJECT
    if (
      targetEntity &&
      !targetEntity.isOccluded &&
      (priorPlannedAction === 'TRACK_OBJECT' ||
        uncertainty.isEvidenceSufficient ||
        targetEntity.confidence >= 0.70 ||
        confirmedCandidates.length > 0)
    ) {
      const profile = ACTION_COST_TABLE.TRACK_OBJECT;
      const expectedGain = 0.35;
      const netUtility =
        expectedGain -
        profile.computationCost * this.lambdaCompute -
        profile.latencyCost * this.lambdaLatency;

      return {
        action: 'TRACK_OBJECT',
        targetRoi: targetEntity.boundingBox,
        candidateId: confirmedCandidates[0]?.id || targetEntity.id,
        reasoning: `Target verified (confidence=${uncertainty.confidence.toFixed(
          2
        )}, prob=${uncertainty.targetProbability.toFixed(
          2
        )}). Locked spatial tracking maintains state at lowest computational cost (cost=${profile.computationCost}).`,
        expectedInfoGain: expectedGain,
        computationCost: profile.computationCost,
        latencyCost: profile.latencyCost,
        netUtility: Math.round(netUtility * 100) / 100,
      };
    }

    // Case 1.5: Target is in ACTIVE_SEARCH or PREDICTION with predicted re-emergence ROI -> INSPECT_ROI at search window
    if (
      targetEntity &&
      targetEntity.isOccluded &&
      (targetEntity.trackingLifecycleState === 'ACTIVE_SEARCH' ||
        targetEntity.trackingLifecycleState === 'PREDICTION') &&
      targetEntity.predictedReemergenceRoi
    ) {
      const inspectProfile = ACTION_COST_TABLE.INSPECT_ROI;
      const expectedGain = 0.85;
      const netUtility =
        expectedGain -
        inspectProfile.computationCost * this.lambdaCompute -
        inspectProfile.latencyCost * this.lambdaLatency;

      return {
        action: 'INSPECT_ROI',
        targetRoi: targetEntity.predictedReemergenceRoi,
        candidateId: targetEntity.id,
        reasoning: `Target in ACTIVE_SEARCH mode behind occluder. Foveating predicted re-emergence ROI [${(
          targetEntity.predictedReemergenceRoi.x * 100
        ).toFixed(0)}%, ${(targetEntity.predictedReemergenceRoi.y * 100).toFixed(
          0
        )}%] to recover visual lock upon exit.`,
        expectedInfoGain: expectedGain,
        computationCost: inspectProfile.computationCost,
        latencyCost: inspectProfile.latencyCost,
        netUtility: Math.round(netUtility * 100) / 100,
      };
    }

    // Case 2: Target is occluded or disappeared into background -> QUERY_WORLD_MODEL
    if (
      (targetEntity?.isOccluded || (targetEntity && candidates.length === 0)) &&
      uncertainty.missingEvidenceScore > 0.4
    ) {
      const profile = ACTION_COST_TABLE.QUERY_WORLD_MODEL;
      const expectedGain = 0.70;
      const netUtility =
        expectedGain -
        profile.computationCost * this.lambdaCompute -
        profile.latencyCost * this.lambdaLatency;

      return {
        action: 'QUERY_WORLD_MODEL',
        reasoning: `Visual disappearance/occlusion detected. Spatial world model kinematics invoked to extrapolate trajectory behind occluding boundary (expected gain=${expectedGain}).`,
        expectedInfoGain: expectedGain,
        computationCost: profile.computationCost,
        latencyCost: profile.latencyCost,
        netUtility: Math.round(netUtility * 100) / 100,
      };
    }

    // Case 3: Candidate ROIs exist and have not yet been foveated/inspected
    if (uninspectedCandidates.length > 0) {
      // Sort uninspected by target probability descending
      const sortedUninspected = [...uninspectedCandidates].sort(
        (a, b) => b.targetProbability - a.targetProbability
      );
      const topCandidate = sortedUninspected[0];

      // If prior action rejected another candidate, we are actively continuing search on the next best
      const wasPriorActionRejection =
        priorActionResult?.action === 'INSPECT_ROI' && !priorActionResult.success;

      // Evaluate INSPECT_ROI utility:
      // High information gain because sub-Mat contour + concentric ring analysis directly resolves ambiguity
      const inspectProfile = ACTION_COST_TABLE.INSPECT_ROI;
      const expectedInspectGain = Math.min(
        0.95,
        0.50 + uncertainty.ambiguityScore * 0.35 + topCandidate.targetProbability * 0.25
      );
      const inspectNetUtility =
        expectedInspectGain -
        inspectProfile.computationCost * this.lambdaCompute -
        inspectProfile.latencyCost * this.lambdaLatency;

      // Evaluate alternative tool: RUN_FEATURE_MATCHING (if multiple candidates have similar probabilities)
      const featProfile = ACTION_COST_TABLE.RUN_FEATURE_MATCHING;
      const expectedFeatGain = 0.55 + uncertainty.ambiguityScore * 0.25;
      const featNetUtility =
        expectedFeatGain -
        featProfile.computationCost * this.lambdaCompute -
        featProfile.latencyCost * this.lambdaLatency;

      // Evaluate alternative tool: RUN_EDGE_ANALYSIS (if edge structure is ambiguous)
      const edgeProfile = ACTION_COST_TABLE.RUN_EDGE_ANALYSIS;
      const expectedEdgeGain = 0.45;
      const edgeNetUtility =
        expectedEdgeGain -
        edgeProfile.computationCost * this.lambdaCompute -
        edgeProfile.latencyCost * this.lambdaLatency;

      // Tool comparison & selection based on Net Utility
      if (
        uncertainty.ambiguityScore > 0.65 &&
        sortedUninspected.length >= 2 &&
        Math.abs(sortedUninspected[0].targetProbability - sortedUninspected[1].targetProbability) < 0.15 &&
        featNetUtility > inspectNetUtility
      ) {
        return {
          action: 'RUN_FEATURE_MATCHING',
          targetRoi: topCandidate.box,
          candidateId: topCandidate.id,
          reasoning: `Equi-probable hypotheses between candidates. Running multi-channel feature correlation matching to discriminate visual embeddings before foveation.`,
          expectedInfoGain: Math.round(expectedFeatGain * 100) / 100,
          computationCost: featProfile.computationCost,
          latencyCost: featProfile.latencyCost,
          netUtility: Math.round(featNetUtility * 100) / 100,
        };
      }

      // Default optimal tool for uninspected high-saliency candidate is INSPECT_ROI
      const reasonDetail = wasPriorActionRejection
        ? `Previous inspection rejected distractor. Directing attention to next highest-probability candidate ${topCandidate.id} (P=${topCandidate.targetProbability.toFixed(2)}).`
        : `Epistemic ambiguity=${uncertainty.ambiguityScore.toFixed(2)}, missingEvidence=${uncertainty.missingEvidenceScore.toFixed(2)}. Foveating candidate ${topCandidate.id} for native-resolution sub-Mat OpenCV analysis.`;

      return {
        action: 'INSPECT_ROI',
        targetRoi: topCandidate.box,
        candidateId: topCandidate.id,
        reasoning: reasonDetail,
        expectedInfoGain: Math.round(expectedInspectGain * 100) / 100,
        computationCost: inspectProfile.computationCost,
        latencyCost: inspectProfile.latencyCost,
        netUtility: Math.round(inspectNetUtility * 100) / 100,
      };
    }

    // Case 4: All candidates inspected and rejected as distractors -> RUN_EDGE_ANALYSIS or PROCESS_FULL_FRAME
    if (candidates.length > 0 && uninspectedCandidates.length === 0 && confirmedCandidates.length === 0) {
      // If we just finished rejecting all blobs, run edge analysis to find boundaries that were missed
      if (priorPlannedAction === 'RUN_EDGE_ANALYSIS' || priorActionResult?.action === 'INSPECT_ROI') {
        const edgeProfile = ACTION_COST_TABLE.RUN_EDGE_ANALYSIS;
        const expectedGain = 0.50;
        const netUtility =
          expectedGain -
          edgeProfile.computationCost * this.lambdaCompute -
          edgeProfile.latencyCost * this.lambdaLatency;

        return {
          action: 'RUN_EDGE_ANALYSIS',
          reasoning: `All coarse candidate blobs rejected. Running OpenCV 5 Canny & Sobel gradient analysis to uncover faint or occluded structural boundaries.`,
          expectedInfoGain: expectedGain,
          computationCost: edgeProfile.computationCost,
          latencyCost: edgeProfile.latencyCost,
          netUtility: Math.round(netUtility * 100) / 100,
        };
      }
    }

    // Case 5: Default fall-through -> PROCESS_FULL_FRAME to refresh visual field
    const profile = ACTION_COST_TABLE.PROCESS_FULL_FRAME;
    const expectedGain = 0.30;
    const netUtility =
      expectedGain -
      profile.computationCost * this.lambdaCompute -
      profile.latencyCost * this.lambdaLatency;

    return {
      action: 'PROCESS_FULL_FRAME',
      reasoning: `Broad visual sensor scan executed to refresh whole-scene candidate proposals and update luminance background.`,
      expectedInfoGain: expectedGain,
      computationCost: profile.computationCost,
      latencyCost: profile.latencyCost,
      netUtility: Math.round(netUtility * 100) / 100,
    };
  }

  /**
   * Next-Action Decision:
   * Derives how the visual outcome of the just-executed operation directly influences the NEXT tool/action.
   * "The output of one visual operation MUST influence the next tool/action."
   */
  public determineNextAction(
    actionExecuted: ActionType,
    actionResult: {
      success: boolean;
      evidenceSummary: string;
      candidateId?: string;
      targetConfirmed?: boolean;
    },
    updatedUncertainty: EpistemicUncertaintyState,
    updatedCandidates: CandidateRegion[],
    targetEntity?: WorkingMemoryEntity
  ): {
    nextAction: ActionType;
    rationale: string;
    targetRoi?: CandidateRegion['box'];
  } {
    // 1. If INSPECT_ROI was executed:
    if (actionExecuted === 'INSPECT_ROI') {
      if (actionResult.targetConfirmed || actionResult.success) {
        // Target confirmed -> Influence: next action switches to TRACK_OBJECT
        return {
          nextAction: 'TRACK_OBJECT',
          rationale: `Target verified via inner ring & fine contour circularity. Next action transitioned to TRACK_OBJECT at reduced computational cost.`,
          targetRoi: targetEntity?.boundingBox,
        };
      } else {
        // Candidate rejected as distractor -> Influence: next action inspects the NEXT candidate or refreshes
        const remainingUninspected = updatedCandidates.filter(
          (c) => !c.isInspected && c.status !== 'REJECTED'
        );
        if (remainingUninspected.length > 0) {
          const nextCand = remainingUninspected.sort(
            (a, b) => b.targetProbability - a.targetProbability
          )[0];
          return {
            nextAction: 'INSPECT_ROI',
            rationale: `Candidate ${actionResult.candidateId || ''} rejected (evidence: ${actionResult.evidenceSummary}). Next action steered to INSPECT_ROI on candidate ${nextCand.id} (P=${nextCand.targetProbability.toFixed(2)}).`,
            targetRoi: nextCand.box,
          };
        } else {
          return {
            nextAction: 'RUN_EDGE_ANALYSIS',
            rationale: `All available candidate blobs rejected. Next action steered to RUN_EDGE_ANALYSIS to locate subtle edge gradients across the scene.`,
          };
        }
      }
    }

    // 2. If TRACK_OBJECT was executed:
    if (actionExecuted === 'TRACK_OBJECT') {
      if (targetEntity && !targetEntity.isOccluded && updatedUncertainty.isEvidenceSufficient) {
        return {
          nextAction: 'TRACK_OBJECT',
          rationale: `Continuous visual lock maintained with low epistemic uncertainty (${updatedUncertainty.uncertaintyScore.toFixed(2)}). Continue high-efficiency tracking.`,
          targetRoi: targetEntity.boundingBox,
        };
      } else {
        return {
          nextAction: 'QUERY_WORLD_MODEL',
          rationale: `Tracking degraded or target entered occluding zone. Next action steered to QUERY_WORLD_MODEL for kinematic extrapolation.`,
        };
      }
    }

    // 3. If RUN_EDGE_ANALYSIS was executed:
    if (actionExecuted === 'RUN_EDGE_ANALYSIS') {
      const topCand = updatedCandidates.filter((c) => c.status !== 'REJECTED')[0];
      if (topCand) {
        return {
          nextAction: 'INSPECT_ROI',
          rationale: `Edge gradient map computed. Next action steered to INSPECT_ROI on the salient edge region of candidate ${topCand.id}.`,
          targetRoi: topCand.box,
        };
      } else {
        return {
          nextAction: 'PROCESS_FULL_FRAME',
          rationale: `Edge analysis complete with no discrete candidate clusters. Next action steered to PROCESS_FULL_FRAME.`,
        };
      }
    }

    // 4. If RUN_FEATURE_MATCHING was executed:
    if (actionExecuted === 'RUN_FEATURE_MATCHING') {
      const topCand = updatedCandidates.filter((c) => c.status !== 'REJECTED')[0];
      return {
        nextAction: 'INSPECT_ROI',
        rationale: `Feature descriptor correlation matched. Next action steered to INSPECT_ROI to confirm microscopic structural details.`,
        targetRoi: topCand?.box,
      };
    }

    // 5. If QUERY_WORLD_MODEL was executed:
    if (actionExecuted === 'QUERY_WORLD_MODEL') {
      return {
        nextAction: 'INSPECT_ROI',
        rationale: `World model extrapolated target trajectory. Next action steered to foveate the predicted exit zone.`,
        targetRoi: targetEntity?.boundingBox,
      };
    }

    // 6. Default
    const uninspected = updatedCandidates.filter((c) => !c.isInspected);
    if (uninspected.length > 0) {
      return {
        nextAction: 'INSPECT_ROI',
        rationale: `Discovered ${uninspected.length} candidate blobs from wide frame scan. Next action steered to foveate top candidate.`,
        targetRoi: uninspected[0].box,
      };
    }

    return {
      nextAction: 'PROCESS_FULL_FRAME',
      rationale: `Full-frame observation completed. Maintaining wide-field monitoring policy.`,
    };
  }
}
