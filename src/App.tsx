/**
 * AViCA: Adaptive Visual Cognitive Architecture
 * Research Instrument Mode UI Entry Point
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavigationHeader, NavTab } from './components/NavigationHeader';
import { ObserveView } from './components/ObserveView';
import { CognitionView } from './components/CognitionView';
import { ExperimentsView } from './components/ExperimentsView';
import { ResearchView } from './components/ResearchView';
import { EntityDetailDrawer } from './components/EntityDetailDrawer';
import { VideoSource, VideoInputMode } from './components/VideoSource';

import {
  BaselineMode,
  CognitiveCycleResult,
  WorkingMemoryEntity,
  CandidateRegion,
  BenchmarkMetrics,
} from './types/avica';
import { AdversarialSceneSimulator } from './simulation/adversarial_scene';
import { AvicaCognitiveEngine } from './core/cognitive_loop';
import { SpatialWorldModelEngine } from './spatial/spatial_world_model';
import { ScientificEvaluationSubsystem } from './evaluation/evaluation_subsystem';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputTriggerRef = useRef<HTMLInputElement | null>(null);

  // Architecture and simulation instances
  const simulatorRef = useRef<AdversarialSceneSimulator | null>(null);
  const engineRef = useRef<AvicaCognitiveEngine | null>(null);
  const spatialEngineRef = useRef<SpatialWorldModelEngine | null>(null);
  const evaluatorRef = useRef<ScientificEvaluationSubsystem | null>(null);

  // Navigation and view state
  const [activeTab, setActiveTab] = useState<NavTab>('OBSERVE');
  const [selectedEntity, setSelectedEntity] = useState<WorkingMemoryEntity | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRegion | null>(null);

  // Execution state
  const [mode, setMode] = useState<BaselineMode>('AVICA_LEARNED');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [illuminationShift, setIlluminationShift] = useState<boolean>(true);
  const [inputMode, setInputMode] = useState<VideoInputMode>('SIMULATOR');
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [isCameraStreaming, setIsCameraStreaming] = useState<boolean>(false);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Central cycle result container
  const [cycleResult, setCycleResult] = useState<CognitiveCycleResult>({
    observation: {
      frameId: 0,
      timestamp: Date.now(),
      width: 640,
      height: 400,
      zoomLevel: 1,
      fps: 30,
      rawFeatureCount: 0,
      meanIntensity: 0,
      contrastScore: 0,
    },
    candidates: [],
    activeDecision: {
      action: 'PROCESS_FULL_FRAME',
      reasoning: 'Initializing visual sensory field.',
      expectedInfoGain: 0.3,
      computationCost: 1.5,
      latencyCost: 1.0,
      netUtility: 0.2,
    },
    uncertainty: {
      targetProbability: 0,
      confidence: 0,
      uncertaintyScore: 1,
      ambiguityScore: 1,
      missingEvidenceScore: 1,
      isEvidenceSufficient: false,
      sufficientThreshold: 0.82,
      lastUpdatedFrame: 0,
    },
    workingMemoryEntities: [],
    worldModel: {
      timestamp: 0,
      entities: {},
      relationships: [],
      targetId: null,
      sceneBounds: { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 },
      depthModalityStatus: {
        has2DPositions: true,
        hasRelativeMonocularDepth: true,
        hasTrueMetricDepth: false,
        activeMode: 'MONOCULAR',
        explanation:
          'Monocular single-view uncalibrated vision: scale ambiguity prevents metric 3D recovery. Depth is strictly relative monocular depth [0..1]. Metric 3D is not claimed.',
      },
    },
    prediction: {
      horizon: 4,
      steps: [],
      predictedTargetPos: null,
      actualTargetPos: null,
      predictionError: 0,
      meanPredictionError: 0,
      horizonMetrics: {
        1: { stepOffset: 1, meanError: 0, sampleCount: 0, recentErrors: [], confidence: 1.0 },
        2: { stepOffset: 2, meanError: 0, sampleCount: 0, recentErrors: [], confidence: 0.85 },
        3: { stepOffset: 3, meanError: 0, sampleCount: 0, recentErrors: [], confidence: 0.72 },
        4: { stepOffset: 4, meanError: 0, sampleCount: 0, recentErrors: [], confidence: 0.60 },
      },
      predictedTrajectory: [],
      predictedGhosts: [],
      predictedNextState: 'INITIALIZING',
      actualNextState: 'INITIALIZING',
      occlusionImminent: false,
    },
    traceSteps: [],
    currentMode: 'AVICA_LEARNED',
    groundTruthTargetFound: false,
    metrics: {
      totalFrames: 0,
      detectionAccuracy: 0,
      trackingAccuracy: 0,
      recoveryAccuracy: 100,
      trackContinuity: 0,
      observations: 0,
      roiInspections: 0,
      latency: 0,
      fps: 0,
      predictionError: 0,
      recoveryTime: 0,
      uncertaintyReduction: 0,
      computationCost: 0,
      observationsRequired: 0,
      totalComputationCost: 0,
      averageLatencyMs: 0,
      effectiveFps: 0,
      targetTrackingAccuracy: 0,
      temporalConsistencyScore: 0,
      meanPredictionError: 0,
      predictionErrorT1: 0,
      predictionErrorT2: 0,
      predictionErrorT3: 0,
      predictionErrorT4: 0,
      predictionHorizon: 4,
      occlusionRecoverySuccesses: 0,
      occlusionRecoveryAttempts: 0,
      meanUncertaintyReduction: 0,
    },
  });

  // Telemetry derived directly from latest cycleResult (eliminates 3 redundant setState dispatches per frame)
  const fps = cycleResult.metrics.effectiveFps || 30;
  const latencyMs = cycleResult.metrics.averageLatencyMs || 0;
  const groundTruthTargetFound = cycleResult.groundTruthTargetFound;

  // Stable refs for values needed in high-frequency frame loops without triggering re-binds
  const inputModeRef = useRef(inputMode);
  inputModeRef.current = inputMode;
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  // Initialize simulation and cognitive engines
  useEffect(() => {
    simulatorRef.current = new AdversarialSceneSimulator(640, 400);
    const engine = new AvicaCognitiveEngine();
    engineRef.current = engine;
    spatialEngineRef.current = engine.getSpatialEngine();
    evaluatorRef.current = new ScientificEvaluationSubsystem();
  }, []);

  // Sync mode changes to engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setMode(mode);
    }
  }, [mode]);

  // Helper: process a raw ImageData frame through the AViCA cognitive engine
  // Atomically commits cycle result in a single unified state update
  const processFrameBuffer = useCallback((imgData: ImageData, isRealCamera: boolean = false) => {
    const engine = engineRef.current;
    if (!engine) return;

    const tCycleStart = performance.now();
    const result = engine.processFrame(imgData, isRealCamera);
    const cycleLatency = performance.now() - tCycleStart;

    let effectiveMetrics = result.metrics;
    let targetFound = false;

    if (isRealCamera) {
      // In real camera mode, evaluate online telemetry without synthetic simulator ground truth
      const bestEntity = result.workingMemoryEntities.find((e) => e.isTarget);
      targetFound = !!bestEntity && bestEntity.confidence > 0.45;
      effectiveMetrics = {
        ...result.metrics,
        averageLatencyMs: cycleLatency,
        effectiveFps: cycleLatency > 0 ? Math.min(60, Math.round(1000 / cycleLatency)) : 30,
      };
    } else {
      // In simulator mode, evaluate post-hoc with synthetic ground truth
      const simulator = simulatorRef.current;
      if (simulator && evaluatorRef.current) {
        const gtState = simulator.getGroundTruthState();
        const evalOutcome = evaluatorRef.current.evaluateCycle(result, gtState, cycleLatency);
        effectiveMetrics = evalOutcome.metrics;
        targetFound = evalOutcome.report.targetCorrectlyLocalized;
      }
    }

    setCycleResult({
      ...result,
      groundTruthTargetFound: targetFound,
      metrics: effectiveMetrics,
    });
  }, []);

  // Callback invoked from VideoSource for optical frames (webcam or uploaded video)
  // CRITICAL: Raw camera/video frame is drawn ONLY to memory-backed offscreen canvas
  // The user-visible canvasRef is reserved for face-aligned scientific visualization
  const handleSensoryFrame = useCallback((source: HTMLVideoElement | HTMLCanvasElement, isLive: boolean) => {
    if (inputModeRef.current === 'SIMULATOR' || !isRunningRef.current) return;

    if (!offscreenCanvasRef.current) {
      const oc = document.createElement('canvas');
      oc.width = 640;
      oc.height = 400;
      offscreenCanvasRef.current = oc;
    }

    const oc = offscreenCanvasRef.current;
    const offCtx = oc.getContext('2d', { willReadFrequently: true });
    if (!offCtx) return;

    // Draw frame silently to offscreen canvas (NEVER painted to visible UI canvas)
    offCtx.drawImage(source, 0, 0, oc.width, oc.height);

    // Extract raw pixel buffer
    const imgData = offCtx.getImageData(0, 0, oc.width, oc.height);

    // Send into genuine AViCA cognitive loop & Face Perception Engine
    processFrameBuffer(imgData, isLive);
  }, [processFrameBuffer]);

  // Stable callbacks for VideoSource stream events
  const handleSensoryError = useCallback((err: Error) => {
    setWebcamError((prev) => (prev === err.message ? prev : err.message));
    setIsCameraStreaming((prev) => (prev ? false : prev));
    engineRef.current?.markFaceStale();
    setCycleResult((prev) => {
      if (!prev.detectedFaceGeometry || prev.detectedFaceGeometry.isStale) return prev;
      return {
        ...prev,
        detectedFaceGeometry: {
          ...prev.detectedFaceGeometry,
          isStale: true,
          staleTimestamp: prev.detectedFaceGeometry.staleTimestamp || Date.now(),
          motionVector: { dx: 0, dy: 0, speed: 0 },
        },
      };
    });
  }, []);

  const handleModeChange = useCallback((newMode: VideoInputMode) => {
    setInputMode((prev) => (prev === newMode ? prev : newMode));
    if (newMode !== 'WEBCAM') {
      setIsCameraStreaming((prev) => (prev ? false : prev));
    }
  }, []);

  const handleStreamActiveChange = useCallback((active: boolean) => {
    setIsCameraStreaming((prev) => (prev === active ? prev : active));
    if (!active) {
      engineRef.current?.markFaceStale();
      setCycleResult((prev) => {
        if (!prev.detectedFaceGeometry || prev.detectedFaceGeometry.isStale) return prev;
        return {
          ...prev,
          detectedFaceGeometry: {
            ...prev.detectedFaceGeometry,
            isStale: true,
            staleTimestamp: prev.detectedFaceGeometry.staleTimestamp || Date.now(),
            motionVector: { dx: 0, dy: 0, speed: 0 },
          },
        };
      });
    }
  }, []);

  // Execute a single cognitive step from simulator
  const executeStep = useCallback(() => {
    if (inputMode !== 'SIMULATOR') return; // Optical feeds stream continuously via handleSensoryFrame

    const simulator = simulatorRef.current;
    const canvas = canvasRef.current;
    if (!simulator || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // 1. Step simulation physics & draw onto canvas
    simulator.step(illuminationShift);
    simulator.renderToCanvas(ctx);

    // 2. Acquire raw rendered ImageData (Canvas pixel buffer)
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 3. Cognitive Engine processes raw image buffer
    processFrameBuffer(imgData, false);
  }, [inputMode, illuminationShift, processFrameBuffer]);

  // Main animation / perception loop (for simulator mode)
  useEffect(() => {
    if (inputMode !== 'SIMULATOR') return; // Handled by VideoSource frame pumping

    let animId: number;
    let lastTime = 0;
    const targetInterval = 1000 / 30; // 30 FPS target for visual cognitive stability

    const loop = (currentTime: number) => {
      if (isRunning) {
        if (currentTime - lastTime >= targetInterval) {
          executeStep();
          lastTime = currentTime;
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, inputMode, executeStep]);

  const handleReset = () => {
    if (simulatorRef.current) {
      simulatorRef.current.initializeScene(42);
    }
    if (engineRef.current) {
      engineRef.current.reset();
    }
    if (evaluatorRef.current) {
      evaluatorRef.current.reset();
    }
    executeStep();
  };

  const handleTriggerOcclusion = () => {
    if (simulatorRef.current) {
      simulatorRef.current.triggerTargetOcclusion();
      executeStep();
    }
  };

  const handleExportSnapshot = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      architecture: 'AViCA v1.0.0',
      activeMode: mode,
      cycleResult,
      groundTruth: simulatorRef.current?.getGroundTruthState() || null,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avica_snapshot_frame_${cycleResult.observation.frameId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Refined Navigation Masthead */}
      <NavigationHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        mode={mode}
        onModeChange={setMode}
        isRunning={isRunning}
        onToggleRun={() => setIsRunning(!isRunning)}
        onStep={executeStep}
        onReset={handleReset}
        fps={fps}
        latencyMs={latencyMs}
        illuminationShift={illuminationShift}
        onToggleIllumination={() => setIlluminationShift(!illuminationShift)}
        onTriggerOcclusion={handleTriggerOcclusion}
        onExportSnapshot={handleExportSnapshot}
        inputMode={inputMode}
        onSetInputMode={(newMode) => {
          setInputMode(newMode);
          setWebcamError(null);
        }}
        onUploadVideoClick={() => {
          setInputMode('VIDEO_FILE');
          // Programmatically click input file in VideoSource if needed
          const inputEl = document.querySelector('input[type="file"]') as HTMLInputElement | null;
          inputEl?.click();
        }}
      />

      {/* Main Workspace Router */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-5">
        {/* Sensory Media Stream Component (Webcam + Video File Upload) */}
        <VideoSource
          mode={inputMode}
          onFrame={handleSensoryFrame}
          onError={handleSensoryError}
          onModeChange={handleModeChange}
          onStreamActiveChange={handleStreamActiveChange}
        />

        {/* OBSERVE VIEW (Default Primary Home) */}
        <div className={activeTab === 'OBSERVE' ? 'block' : 'hidden'}>
          <ObserveView
            canvasRef={canvasRef}
            result={cycleResult}
            onSelectEntity={(ent) => {
              setSelectedEntity(ent);
              setSelectedCandidate(null);
            }}
            onSelectCandidate={(cand) => {
              setSelectedCandidate(cand);
              setSelectedEntity(null);
            }}
            selectedEntityId={selectedEntity?.id}
            groundTruthTargetFound={groundTruthTargetFound}
            inputMode={inputMode}
            isCameraStreaming={isCameraStreaming}
            cameraError={webcamError}
          />
        </div>

        {/* COGNITION VIEW */}
        {activeTab === 'COGNITION' && spatialEngineRef.current && (
          <CognitionView
            worldModel={cycleResult.worldModel}
            spatialEngine={spatialEngineRef.current}
            prediction={cycleResult.prediction}
            uncertainty={cycleResult.uncertainty}
            memoryEntities={cycleResult.workingMemoryEntities}
            onSelectEntity={(ent) => {
              setSelectedEntity(ent);
              setSelectedCandidate(null);
            }}
            selectedEntityId={selectedEntity?.id}
            onToggleMultiView={(enabled) => {
              if (spatialEngineRef.current) {
                spatialEngineRef.current.setMultiViewEnabled(enabled);
              }
            }}
          />
        )}

        {/* EXPERIMENTS VIEW */}
        {activeTab === 'EXPERIMENTS' && (
          <ExperimentsView
            currentMetrics={cycleResult.metrics}
            currentMode={mode}
          />
        )}

        {/* RESEARCH VIEW */}
        {activeTab === 'RESEARCH' && <ResearchView />}
      </main>

      {/* Progressive Disclosure: Entity Detail Drawer */}
      <EntityDetailDrawer
        entity={selectedEntity}
        candidate={selectedCandidate}
        onClose={() => {
          setSelectedEntity(null);
          setSelectedCandidate(null);
        }}
      />
    </div>
  );
}
