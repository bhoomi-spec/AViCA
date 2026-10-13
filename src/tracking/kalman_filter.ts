/**
 * 2D Kalman Filter for Visual Tracking & Kinematic State Estimation
 *
 * Implements a continuous-time white noise acceleration kinematic model:
 * State: [x, y, vx, vy]^T
 * Measurements: [x_meas, y_meas]^T
 *
 * Handles:
 * - Position smoothing
 * - Velocity estimation without differentiation noise
 * - Forward state propagation during occlusions / missing observations
 * - Monotonically increasing covariance during occlusion
 */

import { KalmanStateEstimate } from '../types/avica';

export class KalmanTrackingFilter {
  // State: [x, y, vx, vy]
  private state: [number, number, number, number];

  // 4x4 Covariance Matrix P
  private P: number[][];

  // Process acceleration noise spectral density
  private qAccel: number;

  // Default measurement noise variance
  private defaultMeasVar: number;

  private isInitialized = false;

  constructor(
    initialX = 0.5,
    initialY = 0.5,
    initialVx = 0.0,
    initialVy = 0.0,
    qAccel = 0.0008,
    measVar = 0.0004
  ) {
    this.state = [initialX, initialY, initialVx, initialVy];
    this.qAccel = qAccel;
    this.defaultMeasVar = measVar;

    // Initial covariance
    this.P = [
      [0.01, 0, 0, 0],
      [0, 0.01, 0, 0],
      [0, 0, 0.05, 0],
      [0, 0, 0, 0.05],
    ];
    this.isInitialized = true;
  }

  public reset(
    x: number,
    y: number,
    vx = 0,
    vy = 0,
    initialVariance = 0.01
  ): void {
    this.state = [x, y, vx, vy];
    this.P = [
      [initialVariance, 0, 0, 0],
      [0, initialVariance, 0, 0],
      [0, 0, initialVariance * 5, 0],
      [0, 0, 0, initialVariance * 5],
    ];
    this.isInitialized = true;
  }

  /**
   * Time update (predict step)
   * Propagates state forward by dt.
   * x_pred = F * x
   * P_pred = F * P * F^T + Q
   */
  public predict(dt = 1.0): KalmanStateEstimate {
    const [x, y, vx, vy] = this.state;

    // F * state
    const xPred = x + vx * dt;
    const yPred = y + vy * dt;
    const vxPred = vx;
    const vyPred = vy;

    // Construct Process Noise Q(dt)
    const dt2 = dt * dt;
    const dt3 = dt2 * dt;
    const dt4 = dt3 * dt;
    const q11 = (dt4 / 4) * this.qAccel;
    const q13 = (dt3 / 2) * this.qAccel;
    const q33 = dt2 * this.qAccel;

    const Q: number[][] = [
      [q11, 0, q13, 0],
      [0, q11, 0, q13],
      [q13, 0, q33, 0],
      [0, q13, 0, q33],
    ];

    // F * P * F^T
    // F = [[1, 0, dt, 0], [0, 1, 0, dt], [0, 0, 1, 0], [0, 0, 0, 1]]
    const P = this.P;
    const FP: number[][] = [
      [P[0][0] + dt * P[2][0], P[0][1] + dt * P[2][1], P[0][2] + dt * P[2][2], P[0][3] + dt * P[2][3]],
      [P[1][0] + dt * P[3][0], P[1][1] + dt * P[3][1], P[1][2] + dt * P[3][2], P[1][3] + dt * P[3][3]],
      [P[2][0], P[2][1], P[2][2], P[2][3]],
      [P[3][0], P[3][1], P[3][2], P[3][3]],
    ];

    const FPFt: number[][] = [
      [FP[0][0] + dt * FP[0][2], FP[0][1] + dt * FP[0][3], FP[0][2], FP[0][3]],
      [FP[1][0] + dt * FP[1][2], FP[1][1] + dt * FP[1][3], FP[1][2], FP[1][3]],
      [FP[2][0] + dt * FP[2][2], FP[2][1] + dt * FP[2][3], FP[2][2], FP[2][3]],
      [FP[3][0] + dt * FP[3][2], FP[3][1] + dt * FP[3][3], FP[3][2], FP[3][3]],
    ];

    // P_pred = FPFt + Q
    const PPred: number[][] = [
      [FPFt[0][0] + Q[0][0], FPFt[0][1], FPFt[0][2] + Q[0][2], FPFt[0][3]],
      [FPFt[1][0], FPFt[1][1] + Q[1][1], FPFt[1][2], FPFt[1][3] + Q[1][3]],
      [FPFt[2][0] + Q[2][0], FPFt[2][1], FPFt[2][2] + Q[2][2], FPFt[2][3]],
      [FPFt[3][0], FPFt[3][1] + Q[3][1], FPFt[3][2], FPFt[3][3] + Q[3][3]],
    ];

    this.state = [xPred, yPred, vxPred, vyPred];
    this.P = PPred;

    return this.getState();
  }

  /**
   * Measurement update (correct step)
   * Uses real visual observation [measX, measY].
   * K = P * H^T * (H * P * H^T + R)^-1
   * state = state + K * (z - H * state)
   * P = (I - K * H) * P
   */
  public update(measX: number, measY: number, measurementVariance?: number): KalmanStateEstimate {
    const Rvar = measurementVariance ?? this.defaultMeasVar;

    // Innovation residual: y = z - H * x
    const y0 = measX - this.state[0];
    const y1 = measY - this.state[1];

    // S = H * P * H^T + R (2x2 matrix)
    const S00 = this.P[0][0] + Rvar;
    const S01 = this.P[0][1];
    const S10 = this.P[1][0];
    const S11 = this.P[1][1] + Rvar;

    // Invert S (det = S00 * S11 - S01 * S10)
    const det = Math.max(1e-9, S00 * S11 - S01 * S10);
    const invS00 = S11 / det;
    const invS01 = -S01 / det;
    const invS10 = -S10 / det;
    const invS11 = S00 / det;

    // P * H^T (4x2 matrix): since H = [[1, 0, 0, 0], [0, 1, 0, 0]]
    // PHt is column 0 and column 1 of P
    const PHt: [number, number][] = [
      [this.P[0][0], this.P[0][1]],
      [this.P[1][0], this.P[1][1]],
      [this.P[2][0], this.P[2][1]],
      [this.P[3][0], this.P[3][1]],
    ];

    // Kalman Gain K = PHt * invS (4x2 matrix)
    const K: [number, number][] = [];
    for (let i = 0; i < 4; i++) {
      const k0 = PHt[i][0] * invS00 + PHt[i][1] * invS10;
      const k1 = PHt[i][0] * invS01 + PHt[i][1] * invS11;
      K.push([k0, k1]);
    }

    // State update: x = x + K * y
    this.state[0] += K[0][0] * y0 + K[0][1] * y1;
    this.state[1] += K[1][0] * y0 + K[1][1] * y1;
    this.state[2] += K[2][0] * y0 + K[2][1] * y1;
    this.state[3] += K[3][0] * y0 + K[3][1] * y1;

    // Covariance update: P = (I - K * H) * P
    // I_KH = [[1 - K[0][0], -K[0][1], 0, 0], [-K[1][0], 1 - K[1][1], 0, 0], [-K[2][0], -K[2][1], 1, 0], [-K[3][0], -K[3][1], 0, 1]]
    const PNew: number[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        let sum = this.P[r][c];
        sum -= K[r][0] * this.P[0][c];
        sum -= K[r][1] * this.P[1][c];
        PNew[r][c] = sum;
      }
    }

    // Enforce symmetry and positive-definiteness on diagonal
    for (let r = 0; r < 4; r++) {
      PNew[r][r] = Math.max(1e-8, PNew[r][r]);
      for (let c = r + 1; c < 4; c++) {
        const avg = (PNew[r][c] + PNew[c][r]) / 2;
        PNew[r][c] = avg;
        PNew[c][r] = avg;
      }
    }

    this.P = PNew;
    return this.getState();
  }

  /**
   * Projects future trajectory up to N steps ahead based on current state and covariance
   */
  public projectTrajectory(
    steps = 5,
    dt = 1.0
  ): Array<{ x: number; y: number; variance: number }> {
    const trajectory: Array<{ x: number; y: number; variance: number }> = [];
    const [x, y, vx, vy] = this.state;
    const baseVar = (this.P[0][0] + this.P[1][1]) / 2;

    for (let i = 1; i <= steps; i++) {
      const stepDt = i * dt;
      trajectory.push({
        x: Math.max(0.02, Math.min(0.98, x + vx * stepDt)),
        y: Math.max(0.02, Math.min(0.98, y + vy * stepDt)),
        // Positional variance grows with prediction horizon stepDt^2
        variance: baseVar + 0.5 * (stepDt * stepDt) * this.qAccel,
      });
    }

    return trajectory;
  }

  public getState(): KalmanStateEstimate {
    const posVar = Math.max(0, (this.P[0][0] + this.P[1][1]) / 2);
    const trace = this.P[0][0] + this.P[1][1] + this.P[2][2] + this.P[3][3];

    return {
      x: this.state[0],
      y: this.state[1],
      vx: this.state[2],
      vy: this.state[3],
      positionVariance: Math.round(posVar * 100000) / 100000,
      covarianceTrace: Math.round(trace * 100000) / 100000,
    };
  }

  public isReady(): boolean {
    return this.isInitialized;
  }
}
