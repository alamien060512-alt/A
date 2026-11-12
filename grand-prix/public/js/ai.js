import * as THREE from '/vendor/three.module.js';

// Very small "follow the centerline" AI: looks ahead along the track samples,
// steers toward that point and backs off throttle for sharp upcoming corners.
export class AIDriver {
  constructor(track, seed = 0) {
    this.track = track;
    this.hint = 0;
    this.lookaheadBase = 14 + (seed % 5);
    this.skill = 0.75 + ((seed * 37) % 100) / 400; // 0.75 - 1.0
    this.laneOffset = (((seed * 53) % 100) / 100 - 0.5) * track.halfWidth * 0.9;
  }

  drive(car) {
    const { samples } = this.track;
    const n = samples.length;
    const proj = this.track.projectPoint(car.pos, this.hint);
    this.hint = proj.index;

    const speedFrac = Math.min(1, Math.abs(car.speed) / 40);
    const lookSteps = Math.round(this.lookaheadBase * (0.6 + speedFrac));
    const targetIdx = (proj.index + lookSteps) % n;
    const target = samples[targetIdx].pos.clone().addScaledVector(samples[targetIdx].right, this.laneOffset);

    const toTarget = target.clone().sub(car.pos);
    // steer = signed angle between car heading and vector-to-target, projected via cross/dot
    const fwd = new THREE.Vector3(Math.sin(car.yaw), 0, Math.cos(car.yaw));
    const right = new THREE.Vector3(Math.cos(car.yaw), 0, -Math.sin(car.yaw));
    const dot = toTarget.dot(fwd);
    const cross = toTarget.dot(right);
    const angle = Math.atan2(cross, Math.max(0.001, dot));
    const steer = Math.max(-1, Math.min(1, angle * 2.2));

    // estimate upcoming curvature to brake for corners
    const farIdx = (proj.index + lookSteps * 2) % n;
    const curveAngle = samples[proj.index].tangent.angleTo(samples[farIdx].tangent);
    const cornerSlow = Math.max(0.25, 1 - curveAngle * 1.3);
    const targetSpeedFrac = this.skill * cornerSlow;

    let throttle = 1;
    const curSpeedFrac = car.speed / 62;
    if (curSpeedFrac > targetSpeedFrac + 0.05) throttle = -0.6;
    else throttle = 1;

    return { throttle, steer };
  }
}
