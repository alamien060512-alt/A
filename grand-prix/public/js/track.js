import * as THREE from '/vendor/three.module.js';

// Closed-loop Grand Prix circuit, defined as waypoints (x, z) in meters.
// Flows roughly clockwise starting/ending at the start/finish straight.
const WAYPOINTS = [
  [0, 0], [90, 0], [180, 0],              // long start/finish straight (heading +X)
  [230, 10], [270, 40], [290, 90],        // turn 1 (sweeping right-hander)
  [300, 150], [280, 200],                 // turn 2 (left-hander into the top)
  [220, 230], [240, 270],                 // chicane kink
  [180, 290], [100, 280],                 // top straight (heading -X)
  [40, 250], [0, 190],                    // turn 3 (left-hander down the side)
  [-30, 120], [-10, 60],                  // hairpin bulge
  [-20, 10],                              // final corner onto the main straight
];

export const TRACK_WIDTH = 18;
export const HALF_WIDTH = TRACK_WIDTH / 2;

function makeCanvasTexture(draw, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function asphaltTexture() {
  const tex = makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = '#2b2d33';
    ctx.fillRect(0, 0, s, s);
    // speckle noise
    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      const v = 20 + Math.random() * 25;
      ctx.fillStyle = `rgba(${v + 10},${v + 10},${v + 14},${0.15 + Math.random() * 0.2})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    // red/white rumble strips at edges (x in [0,s])
    const stripeH = s * 0.085;
    const segs = 10;
    for (let i = 0; i < segs; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#d81e1e' : '#eeeeee';
      ctx.fillRect((i * s) / segs, 0, s / segs, stripeH);
      ctx.fillRect((i * s) / segs, s - stripeH, s / segs, stripeH);
    }
    // center dashed line
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(s / 2 - s * 0.012, s * 0.15, s * 0.024, s * 0.7);
  }, 256);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function grassTexture() {
  const tex = makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = '#2f7d3a';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2500; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      const g = 95 + Math.random() * 60;
      ctx.fillStyle = `rgba(${g * 0.3},${g},${g * 0.35},${0.12 + Math.random() * 0.25})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }, 256);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function barrierTexture() {
  const tex = makeCanvasTexture((ctx, s) => {
    const segs = 8;
    for (let i = 0; i < segs; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#d81e1e' : '#f4f4f4';
      ctx.fillRect(0, (i * s) / segs, s, s / segs);
    }
  }, 64);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function crowdTexture() {
  const tex = makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = '#1c2230';
    ctx.fillRect(0, 0, s, s);
    const colors = ['#e63946', '#f1c453', '#2a9d8f', '#f4f4f4', '#457b9d'];
    for (let y = 0; y < s; y += 6) {
      for (let x = 0; x < s; x += 6) {
        if (Math.random() < 0.85) {
          ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
          ctx.fillRect(x + Math.random() * 2, y + Math.random() * 2, 4, 4);
        }
      }
    }
  }, 128);
  return tex;
}

function checkerTexture() {
  const tex = makeCanvasTexture((ctx, s) => {
    const n = 8;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#111' : '#fff';
        ctx.fillRect((x * s) / n, (y * s) / n, s / n, s / n);
      }
    }
  }, 128);
  return tex;
}

export function buildTrack(scene) {
  const points = WAYPOINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.45);
  const length = curve.getLength();

  const SAMPLE_COUNT = Math.max(360, Math.round(length / 2.2));
  const samples = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const u = i / SAMPLE_COUNT;
    const pos = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    samples.push({ u, pos, tangent, right });
  }

  const group = new THREE.Group();

  // ---------- Road ribbon ----------
  const roadGeo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const n = samples.length;
  const tileLength = 10;
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    const l = s.pos.clone().addScaledVector(s.right, -HALF_WIDTH);
    const r = s.pos.clone().addScaledVector(s.right, HALF_WIDTH);
    verts.push(l.x, l.y + 0.01, l.z, r.x, r.y + 0.01, r.z);
    const v = (i * (length / n)) / tileLength;
    uvs.push(0, v, 1, v);
  }
  const indices = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = i * 2 + 1;
    const c = ((i + 1) % n) * 2, d = ((i + 1) % n) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeo.setIndex(indices);
  roadGeo.computeVertexNormals();

  const roadTex = asphaltTexture();
  roadTex.repeat.set(1, 1);
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95, metalness: 0.02 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = true;
  group.add(road);

  // ---------- Barriers (inner + outer) ----------
  function buildBarrier(sideSign) {
    const bGeo = new THREE.BufferGeometry();
    const bVerts = []; const bUvs = [];
    const dist = HALF_WIDTH + 2.2;
    const barrierH = 1.1;
    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const base = s.pos.clone().addScaledVector(s.right, sideSign * dist);
      const bottom = base.clone();
      const top = base.clone(); top.y += barrierH;
      bVerts.push(bottom.x, bottom.y, bottom.z, top.x, top.y, top.z);
      const v = (i * (length / n)) / 6;
      bUvs.push(v, 0, v, 1);
    }
    const bIdx = [];
    for (let i = 0; i < n; i++) {
      const a = i * 2, b = i * 2 + 1;
      const c = ((i + 1) % n) * 2, d = ((i + 1) % n) * 2 + 1;
      bIdx.push(a, b, c, c, b, d);
    }
    bGeo.setAttribute('position', new THREE.Float32BufferAttribute(bVerts, 3));
    bGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bUvs, 2));
    bGeo.setIndex(bIdx);
    bGeo.computeVertexNormals();
    const tex = barrierTexture();
    tex.repeat.set(20, 1);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(bGeo, mat);
    mesh.castShadow = true;
    return mesh;
  }
  group.add(buildBarrier(1));
  group.add(buildBarrier(-1));

  // ---------- Ground (grass) ----------
  const grassTex = grassTexture();
  grassTex.repeat.set(80, 80);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  group.add(ground);

  // ---------- Start/finish gantry + checker strip ----------
  const startSample = samples[0];
  const checkerMat = new THREE.MeshBasicMaterial({ map: checkerTexture() });
  const checkerStrip = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_WIDTH, 4), checkerMat);
  checkerStrip.rotation.x = -Math.PI / 2;
  checkerStrip.position.copy(startSample.pos);
  checkerStrip.position.y = 0.02;
  const angle = Math.atan2(startSample.tangent.x, startSample.tangent.z);
  checkerStrip.rotation.z = angle;
  group.add(checkerStrip);

  const gantryMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.4 });
  const bannerMat = new THREE.MeshStandardMaterial({ color: 0xe10600, roughness: 0.6 });
  const pylonGeo = new THREE.BoxGeometry(1.2, 9, 1.2);
  for (const side of [-1, 1]) {
    const pylon = new THREE.Mesh(pylonGeo, gantryMat);
    const base = startSample.pos.clone().addScaledVector(startSample.right, side * (HALF_WIDTH + 3));
    pylon.position.set(base.x, 4.5, base.z);
    pylon.castShadow = true;
    group.add(pylon);
  }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH + 6, 2, 0.6), bannerMat);
  banner.position.copy(startSample.pos);
  banner.position.y = 8.5;
  banner.rotation.y = -angle;
  group.add(banner);

  // ---------- Grandstands near start ----------
  const standMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.9 });
  const crowdMat = new THREE.MeshStandardMaterial({ map: crowdTexture(), roughness: 1 });
  for (const side of [-1, 1]) {
    const grp = new THREE.Group();
    const structure = new THREE.Mesh(new THREE.BoxGeometry(34, 7, 8), standMat);
    structure.position.y = 3.5;
    structure.castShadow = true;
    grp.add(structure);
    const crowd = new THREE.Mesh(new THREE.PlaneGeometry(32, 5.5), crowdMat);
    crowd.position.set(0, 4.2, 4.05);
    grp.add(crowd);
    const base = startSample.pos.clone()
      .addScaledVector(startSample.right, side * (HALF_WIDTH + 14))
      .addScaledVector(startSample.tangent, -14);
    grp.position.set(base.x, 0, base.z);
    grp.rotation.y = -angle + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    group.add(grp);
  }

  // ---------- Scenery: trees ----------
  const treeTrunkGeo = new THREE.CylinderGeometry(0.25, 0.3, 1.6, 6);
  const treeTopGeo = new THREE.ConeGeometry(1.4, 2.6, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 1 });
  const treeCount = 90;
  const trunkInst = new THREE.InstancedMesh(treeTrunkGeo, trunkMat, treeCount);
  const leafInst = new THREE.InstancedMesh(treeTopGeo, leafMat, treeCount);
  trunkInst.castShadow = true; leafInst.castShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < treeCount; i++) {
    const s = samples[Math.floor((i / treeCount) * n)];
    const side = i % 2 === 0 ? 1 : -1;
    const dist = HALF_WIDTH + 8 + Math.random() * 18;
    const p = s.pos.clone().addScaledVector(s.right, side * dist);
    const scale = 0.8 + Math.random() * 0.7;
    dummy.position.set(p.x, 0.8 * scale, p.z);
    dummy.scale.setScalar(scale);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 2.2 * scale;
    dummy.updateMatrix();
    leafInst.setMatrixAt(i, dummy.matrix);
  }
  group.add(trunkInst, leafInst);

  scene.add(group);

  function projectPoint(point, hintIndex = 0) {
    let bestIdx = hintIndex;
    let bestDist = Infinity;
    const window = 25;
    for (let d = -window; d <= window; d++) {
      const idx = ((hintIndex + d) % n + n) % n;
      const s = samples[idx];
      const dist = s.pos.distanceToSquared(point);
      if (dist < bestDist) { bestDist = dist; bestIdx = idx; }
    }
    const s = samples[bestIdx];
    const rel = point.clone().sub(s.pos);
    const lateral = rel.dot(s.right);
    return { index: bestIdx, u: s.u, lateral, tangent: s.tangent, pos: s.pos };
  }

  return {
    group,
    curve,
    length,
    samples,
    halfWidth: HALF_WIDTH,
    startPos: startSample.pos.clone(),
    startAngle: angle,
    projectPoint,
  };
}
