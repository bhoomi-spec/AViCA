/**
 * Adversarial Visual Search + Tracking Simulation Scene
 * Section 12 initial research task environment.
 * Synthesizes dynamic scenes with ground-truth target, distractors, occluders, and illumination shifts.
 */

import { BoundingBox, Vector3D, GroundTruthState, GroundTruthEntity } from '../types/avica';

export interface SimulatedEntity {
  id: string;
  name: string;
  isTarget: boolean;
  isDistractor: boolean;
  color: string;
  shape: 'circle' | 'square' | 'triangle' | 'star';
  x: number; // 0..1
  y: number; // 0..1
  z: number; // 0..1 (depth)
  vx: number;
  vy: number;
  size: number;
  isOccluded: boolean;
}

export interface SimulationState {
  frameId: number;
  illumination: number; // 0.2 (dim) to 1.0 (bright)
  cameraJitter: { x: number; y: number };
  entities: SimulatedEntity[];
  occluder: {
    x: number;
    y: number;
    width: number;
    height: number;
    vx: number;
  };
}

export class AdversarialSceneSimulator {
  private state: SimulationState;
  private width: number;
  private height: number;
  private targetId = 'TARGET-ALPHA';

  constructor(width = 640, height = 400) {
    this.width = width;
    this.height = height;
    this.state = this.initializeScene();
  }

  public initializeScene(seed = 42): SimulationState {
    const entities: SimulatedEntity[] = [
      // 1. True Target Object (Cyan/Teal with Star/Circle signature)
      {
        id: this.targetId,
        name: 'Target Alpha (Signal)',
        isTarget: true,
        isDistractor: false,
        color: '#06b6d4', // Cyan
        shape: 'circle',
        x: 0.25,
        y: 0.45,
        z: 0.35,
        vx: 0.003,
        vy: 0.002,
        size: 28,
        isOccluded: false,
      },
      // 2. Visually Similar Distractor 1 (Close color: Sky blue)
      {
        id: 'DISTRACTOR-1',
        name: 'Distractor A (Sky Blue)',
        isTarget: false,
        isDistractor: true,
        color: '#38bdf8', // Similar sky blue
        shape: 'circle',
        x: 0.45,
        y: 0.3,
        z: 0.4,
        vx: -0.0025,
        vy: 0.0015,
        size: 26,
        isOccluded: false,
      },
      // 3. Visually Similar Distractor 2 (Similar shape: Teal Square)
      {
        id: 'DISTRACTOR-2',
        name: 'Distractor B (Teal Square)',
        isTarget: false,
        isDistractor: true,
        color: '#14b8a6', // Teal
        shape: 'square',
        x: 0.7,
        y: 0.65,
        z: 0.38,
        vx: 0.002,
        vy: -0.003,
        size: 28,
        isOccluded: false,
      },
      // 4. Irrelevant Object 1 (Amber diamond/triangle)
      {
        id: 'IRRELEVANT-1',
        name: 'Irrelevant Clutter (Amber)',
        isTarget: false,
        isDistractor: false,
        color: '#f59e0b',
        shape: 'triangle',
        x: 0.15,
        y: 0.75,
        z: 0.6,
        vx: 0.001,
        vy: -0.002,
        size: 22,
        isOccluded: false,
      },
      // 5. Irrelevant Object 2 (Rose shape)
      {
        id: 'IRRELEVANT-2',
        name: 'Irrelevant Clutter (Rose)',
        isTarget: false,
        isDistractor: false,
        color: '#f43f5e',
        shape: 'square',
        x: 0.8,
        y: 0.2,
        z: 0.55,
        vx: -0.0015,
        vy: 0.001,
        size: 20,
        isOccluded: false,
      },
    ];

    return {
      frameId: 0,
      illumination: 0.9,
      cameraJitter: { x: 0, y: 0 },
      entities,
      occluder: {
        x: 0.45,
        y: 0.2,
        width: 0.16,
        height: 0.6,
        vx: 0.002, // drifts slowly back and forth across target trajectory
      },
    };
  }

  public step(illuminationShift = false): SimulationState {
    this.state.frameId++;

    // Update occluder drift
    const occ = this.state.occluder;
    occ.x += occ.vx;
    if (occ.x > 0.75 || occ.x < 0.2) occ.vx *= -1;

    // Illumination modulation if active
    if (illuminationShift) {
      this.state.illumination = 0.55 + 0.4 * Math.sin(this.state.frameId * 0.05);
    }

    // Step entities
    for (const ent of this.state.entities) {
      ent.x += ent.vx;
      ent.y += ent.vy;

      // Bounce boundaries
      if (ent.x < 0.08 || ent.x > 0.92) ent.vx *= -1;
      if (ent.y < 0.08 || ent.y > 0.92) ent.vy *= -1;

      // Check occlusion with occluder pillar
      const inOccX = ent.x > occ.x && ent.x < occ.x + occ.width;
      const inOccY = ent.y > occ.y && ent.y < occ.y + occ.height;
      ent.isOccluded = inOccX && inOccY;
    }

    return this.state;
  }

  public triggerTargetOcclusion(): void {
    const target = this.state.entities.find((e) => e.isTarget);
    if (target) {
      this.state.occluder.x = Math.max(0.1, Math.min(0.7, target.x - this.state.occluder.width / 2));
      this.state.occluder.y = Math.max(0.05, Math.min(0.35, target.y - this.state.occluder.height / 2));
      target.isOccluded = true;
    }
  }

  /**
   * Renders the simulated scene onto a canvas context
   */
  public renderToCanvas(ctx: CanvasRenderingContext2D): void {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    // Background with scientific grid lines
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Depth shadows
    for (const ent of this.state.entities) {
      const px = ent.x * w;
      const py = ent.y * h;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(px + 4, py + 12, ent.size / 2, ent.size / 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render entities
    for (const ent of this.state.entities) {
      // If occluded behind occluder, don't draw (or draw faint silhouette if partially visible)
      if (ent.isOccluded) continue;

      const px = ent.x * w;
      const py = ent.y * h;

      ctx.save();
      ctx.translate(px, py);

      // Apply illumination scale
      ctx.fillStyle = ent.color;
      ctx.shadowColor = ent.color;
      ctx.shadowBlur = ent.isTarget ? 10 : 3;

      if (ent.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, ent.size / 2, 0, Math.PI * 2);
        ctx.fill();
        // Inner signature ring for target
        if (ent.isTarget) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, ent.size / 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (ent.shape === 'square') {
        ctx.fillRect(-ent.size / 2, -ent.size / 2, ent.size, ent.size);
      } else if (ent.shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(0, -ent.size / 2);
        ctx.lineTo(ent.size / 2, ent.size / 2);
        ctx.lineTo(-ent.size / 2, ent.size / 2);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    // Render Occluder Barrier (e.g. concrete / carbon pillar in front layer)
    const occ = this.state.occluder;
    const occX = occ.x * w;
    const occY = occ.y * h;
    const occW = occ.width * w;
    const occH = occ.height * h;

    const occGrad = ctx.createLinearGradient(occX, 0, occX + occW, 0);
    occGrad.addColorStop(0, '#1e293b');
    occGrad.addColorStop(0.5, '#334155');
    occGrad.addColorStop(1, '#0f172a');

    ctx.fillStyle = occGrad;
    ctx.fillRect(occX, occY, occW, occH);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(occX, occY, occW, occH);

    // Hatching lines on occluder to indicate visual obstacle
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1;
    for (let i = -occH; i < occW; i += 16) {
      ctx.beginPath();
      ctx.moveTo(occX + i, occY);
      ctx.lineTo(occX + i + occH, occY + occH);
      ctx.stroke();
    }

    // Lighting veil overlay
    if (this.state.illumination < 0.8) {
      const darkFactor = 1.0 - this.state.illumination;
      ctx.fillStyle = `rgba(3, 7, 18, ${darkFactor * 0.6})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  public getGroundTruthState(): GroundTruthState {
    const targetSim = this.state.entities.find((e) => e.isTarget);
    const w = this.width;
    const h = this.height;

    const mapSimToGt = (e: SimulatedEntity): GroundTruthEntity => {
      const normW = (e.size * 1.4) / w;
      const normH = (e.size * 1.4) / h;
      return {
        id: e.id,
        name: e.name,
        isTarget: e.isTarget,
        isDistractor: e.isDistractor,
        position: { x: e.x, y: e.y, z: e.z },
        size: e.size,
        isOccluded: e.isOccluded,
        box: {
          x: Math.max(0, e.x - normW / 2),
          y: Math.max(0, e.y - normH / 2),
          width: normW,
          height: normH,
        },
      };
    };

    return {
      frameId: this.state.frameId,
      timestamp: Date.now(),
      target: targetSim ? mapSimToGt(targetSim) : null,
      entities: this.state.entities.map(mapSimToGt),
      occluder: {
        x: this.state.occluder.x,
        y: this.state.occluder.y,
        width: this.state.occluder.width,
        height: this.state.occluder.height,
      },
    };
  }

  public getGroundTruthTarget(): SimulatedEntity | undefined {
    return this.state.entities.find((e) => e.isTarget);
  }

  public getEntities(): SimulatedEntity[] {
    return this.state.entities;
  }

  public getState(): SimulationState {
    return this.state;
  }
}
