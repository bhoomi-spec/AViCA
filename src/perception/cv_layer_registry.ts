/**
 * Layered Computer Vision Foundation Registry (Layers 1-9)
 * Maps course concepts to computational implementation states and cost weights.
 */

import { CVLayerInfo } from '../types/avica';

export const CV_LAYERS: CVLayerInfo[] = [
  {
    layer: 1,
    name: 'Low-Level Perception',
    category: 'Spatial filtering, Histograms, RGB/HSI, Gradients',
    status: 'ACTIVE_IN_PHASE1',
    description: 'OpenCV 5 cv.cvtColor, cv.meanStdDev, cv.calcHist (16-bin), and cv.GaussianBlur spatial filtering.',
    computationalCost: 1.0,
  },
  {
    layer: 2,
    name: 'Geometric Perception',
    category: 'Camera model, Disparity, Relative Depth, Epipolar',
    status: 'ACTIVE_IN_PHASE1',
    description: 'OpenCV 5 cv.Sobel gradient intensity, perspective projection, monocular relative depth estimation.',
    computationalCost: 2.5,
  },
  {
    layer: 3,
    name: 'Feature Perception',
    category: 'Harris corners, DoG/LoG, Canny, SIFT descriptors',
    status: 'ACTIVE_IN_PHASE1',
    description: 'OpenCV 5 cv.Canny multi-stage edge detector, cv.moments spatial moments, cv.approxPolyDP polygonal approximation.',
    computationalCost: 3.8,
  },
  {
    layer: 4,
    name: 'Segmentation',
    category: 'Otsu threshold, Morphological ops, Region-growing',
    status: 'ACTIVE_IN_PHASE1',
    description: 'OpenCV 5 cv.morphologyEx (Opening/Closing), cv.findContours hierarchy, cv.contourArea, cv.boundingRect, cv.arcLength.',
    computationalCost: 4.2,
  },
  {
    layer: 5,
    name: 'Tracking & Temporal Association',
    category: 'Kalman filtering, Optical Flow approximation, Hungarian matching',
    status: 'ACTIVE_IN_PHASE1',
    description: 'Linear Kalman trajectory estimator, velocity estimation, identity persistence over occlusions.',
    computationalCost: 3.0,
  },
  {
    layer: 6,
    name: 'Deep Visual Perception',
    category: 'CNN features, Siamese embeddings, Metric distance',
    status: 'STUBBED_PHASE2',
    description: 'Feature descriptor vector space with Euclidean distance metric (Phase 2 will integrate PyTorch/OpenCV DNN).',
    computationalCost: 8.5,
  },
  {
    layer: 7,
    name: 'Attention Mechanisms',
    category: 'Saliency map, Query-Key-Value attention weights, Foveation',
    status: 'ACTIVE_IN_PHASE1',
    description: 'Foveated ROI selection, spatial uncertainty weighting, saliency prioritization.',
    computationalCost: 2.0,
  },
  {
    layer: 8,
    name: 'Adaptive Learning',
    category: 'Few-shot exemplar matching, online confidence adaptation',
    status: 'STUBBED_PHASE2',
    description: 'Target visual template adaptation with memory-guided drift compensation.',
    computationalCost: 5.0,
  },
  {
    layer: 9,
    name: 'Reinforcement Learning',
    category: 'Q-learning observation policy, Action-utility optimization',
    status: 'ACTIVE_IN_PHASE1',
    description: 'Tabular Q-learning & Utility-based action selection balancing information gain vs compute cost.',
    computationalCost: 1.5,
  },
];
