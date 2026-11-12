import * as THREE from '/vendor/three.module.js';

export const CAR_LENGTH = 4.4;
export const CAR_WIDTH = 2.0;
export const WHEELBASE = 2.7;
export const MAX_SPEED = 62;
export const CAR_RADIUS = 1.5;

export function forwardVector(yaw, out = new THREE.Vector3()) {
  return out.set(Math.sin(yaw), 0, Math.cos(yaw));
}

function numberTexture(number, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), 64, 70);
  return new THREE.CanvasTexture(canvas);
}

export function createCarMesh(color = '#e10600', number = 1) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.4, metalness: 0.5 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.8 });

  // Main body (tapered via scale tricks using boxes)
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH * 0.78, 0.5, CAR_LENGTH * 0.62), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH * 0.42, 0.42, CAR_LENGTH * 0.3), accentMat);
  cockpit.position.set(0, 0.86, 0.05);
  cockpit.castShadow = true;
  group.add(cockpit);

  // nose cone (front = +Z)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(CAR_WIDTH * 0.26, CAR_LENGTH * 0.42, 8), bodyMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.42, CAR_LENGTH * 0.48);
  nose.castShadow = true;
  group.add(nose);

  // front wing
  const frontWing = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH * 1.05, 0.08, 0.5), accentMat);
  frontWing.position.set(0, 0.22, CAR_LENGTH * 0.62);
  frontWing.castShadow = true;
  group.add(frontWing);

  // rear wing
  const rearWingPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), accentMat);
  rearWingPost.position.set(0, 0.85, -CAR_LENGTH * 0.46);
  group.add(rearWingPost);
  const rearWing = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH * 0.95, 0.1, 0.55), bodyMat);
  rearWing.position.set(0, 1.12, -CAR_LENGTH * 0.46);
  rearWing.castShadow = true;
  group.add(rearWing);

  // halo
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 6, 12, Math.PI), accentMat);
  halo.rotation.x = Math.PI / 2;
  halo.rotation.z = Math.PI;
  halo.position.set(0, 1.05, 0.1);
  group.add(halo);

  // driver number decal on nose top
  const decal = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 16),
    new THREE.MeshBasicMaterial({ map: numberTexture(number, color) })
  );
  decal.rotation.x = -Math.PI / 2;
  decal.position.set(0, 0.82, 0.3);
  group.add(decal);

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.42, 14);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.44, 8);
  function makeWheel() {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    w.add(tire, rim);
    return w;
  }
  const flWheel = makeWheel(), frWheel = makeWheel(), rlWheel = makeWheel(), rrWheel = makeWheel();
  const wx = CAR_WIDTH * 0.56, wy = 0.46;
  flWheel.position.set(-wx, wy, WHEELBASE / 2);
  frWheel.position.set(wx, wy, WHEELBASE / 2);
  rlWheel.position.set(-wx, wy, -WHEELBASE / 2);
  rrWheel.position.set(wx, wy, -WHEELBASE / 2);
  group.add(flWheel, frWheel, rlWheel, rrWheel);

  // nameplate on rear wing (color accent stripe)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH * 0.8, 0.08, 0.2), new THREE.MeshStandardMaterial({ color: 0xffce00 }));
  stripe.position.set(0, 0.6, -CAR_LENGTH * 0.2);
  group.add(stripe);

  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return {
    group,
    wheels: { fl: flWheel, fr: frWheel, rl: rlWheel, rr: rrWheel },
    body,
  };
}

export class CarPhysics {
  constructor(position, yaw) {
    this.pos = position.clone();
    this.yaw = yaw;
    this.speed = 0;
    this.steerAngle = 0;
    this.offtrack = false;
    this.trackHint = 0;
    this.lap = 0;
    this.u = 0;
    this.prevU = 0;
    this.lapStartTime = 0;
    this.startCrossed = false;
    this.lastLapTime = null;
    this.bestLapTime = null;
    this.finished = false;
    this.finishTime = null;
  }

  update(throttle, steer, dt, track, now) {
    const maxSteer = 0.58;
    const targetSteer = steer * maxSteer;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, dt * 9);

    const topSpeed = this.offtrack ? MAX_SPEED * 0.55 : MAX_SPEED;

    if (throttle > 0) {
      if (this.speed < 0) this.speed += throttle * 40 * dt;
      else this.speed += throttle * 22 * dt;
    } else if (throttle < 0) {
      if (this.speed > 0) this.speed += throttle * 42 * dt;
      else this.speed += throttle * 12 * dt;
    } else {
      const drag = 10 * dt;
      if (Math.abs(this.speed) < drag) this.speed = 0;
      else this.speed -= Math.sign(this.speed) * drag;
    }
    // rolling resistance / drag proportional to speed^2 (air resistance feel)
    this.speed -= Math.sign(this.speed) * (this.speed * this.speed) * 0.00028 * dt * 60;
    this.speed = Math.max(-16, Math.min(topSpeed, this.speed));

    if (Math.abs(this.speed) > 0.05) {
      const turnRate = (this.speed / WHEELBASE) * Math.tan(this.steerAngle);
      this.yaw += turnRate * dt;
    }

    const fwd = forwardVector(this.yaw);
    this.pos.addScaledVector(fwd, this.speed * dt);

    if (track) {
      const proj = track.projectPoint(this.pos, this.trackHint);
      this.trackHint = proj.index;
      this.prevU = this.u;
      this.u = proj.u;
      const limit = track.halfWidth;
      this.offtrack = Math.abs(proj.lateral) > limit;

      const hardLimit = track.halfWidth + 1.9;
      if (Math.abs(proj.lateral) > hardLimit) {
        const over = Math.abs(proj.lateral) - hardLimit;
        const sign = Math.sign(proj.lateral);
        const right = new THREE.Vector3().crossVectors(proj.tangent, new THREE.Vector3(0, 1, 0)).normalize();
        this.pos.addScaledVector(right, -sign * over);
        this.speed *= 0.55;
      }

      // lap detection (forward crossing of start/finish).
      // Cars start staged slightly behind the line, so the very first
      // crossing just marks the true start of lap 1 rather than a completed lap.
      if (this.prevU > 0.85 && this.u < 0.15 && this.lapStartTime > 0) {
        if (!this.startCrossed) {
          this.startCrossed = true;
          this.lapStartTime = now;
        } else {
          const lapTime = now - this.lapStartTime;
          this.lapStartTime = now;
          this.lastLapTime = lapTime;
          if (this.bestLapTime == null || lapTime < this.bestLapTime) this.bestLapTime = lapTime;
          this.lap += 1;
        }
      }
    }

    return { offtrack: this.offtrack };
  }
}
