import * as THREE from '/vendor/three.module.js';
import { buildTrack } from './track.js';
import { createCarMesh, CarPhysics, forwardVector, MAX_SPEED } from './car.js';
import { AIDriver } from './ai.js';
import { Network } from './network.js';
import { LIVERY_SWATCHES, formatTime, showScreen, toast, renderLobbyList, renderStandings, renderResults } from './ui.js';

const TOTAL_LAPS_DEFAULT = 3;
const AI_COUNT = 3;

// ----------------------------------------------------------------------
// DOM references
// ----------------------------------------------------------------------
const dom = {
  menu: document.getElementById('menu'),
  lobby: document.getElementById('lobby'),
  results: document.getElementById('results'),
  countdown: document.getElementById('countdown'),
  countdownNum: document.getElementById('countdownNum'),
  hud: document.getElementById('hud'),
  nameInput: document.getElementById('nameInput'),
  numberInput: document.getElementById('numberInput'),
  colorInput: document.getElementById('colorInput'),
  swatches: document.getElementById('swatches'),
  joinBtn: document.getElementById('joinBtn'),
  connStatus: document.getElementById('connStatus'),
  carPreview: document.getElementById('carPreview'),
  serverAddr: document.getElementById('serverAddr'),
  lobbyList: document.getElementById('lobbyList'),
  aiToggle: document.getElementById('aiToggle'),
  readyBtn: document.getElementById('readyBtn'),
  startBtn: document.getElementById('startBtn'),
  lapChip: document.getElementById('lapChip'),
  posChip: document.getElementById('posChip'),
  timeChip: document.getElementById('timeChip'),
  standings: document.getElementById('standings'),
  minimap: document.getElementById('minimap'),
  speedValue: document.getElementById('speedValue'),
  offtrackWarning: document.getElementById('offtrackWarning'),
  resultsList: document.getElementById('resultsList'),
  rematchBtn: document.getElementById('rematchBtn'),
  btnGas: document.getElementById('btnGas'),
  btnBrake: document.getElementById('btnBrake'),
  btnLeft: document.getElementById('btnLeft'),
  btnRight: document.getElementById('btnRight'),
  scene: document.getElementById('scene'),
};

// ----------------------------------------------------------------------
// Profile persistence
// ----------------------------------------------------------------------
const profile = JSON.parse(localStorage.getItem('gp_profile') || 'null') || {
  name: 'Driver', color: '#e10600', number: 7,
};
dom.nameInput.value = profile.name;
dom.colorInput.value = profile.color;
dom.numberInput.value = profile.number;

LIVERY_SWATCHES.forEach((c) => {
  const sw = document.createElement('div');
  sw.className = 'swatch';
  sw.style.background = c;
  sw.addEventListener('click', () => {
    dom.colorInput.value = c;
    updatePreviewColor(c);
  });
  dom.swatches.appendChild(sw);
});

function saveProfile() {
  profile.name = dom.nameInput.value.trim() || 'Driver';
  profile.color = dom.colorInput.value;
  profile.number = Math.max(1, Math.min(99, parseInt(dom.numberInput.value, 10) || 1));
  localStorage.setItem('gp_profile', JSON.stringify(profile));
}

// ----------------------------------------------------------------------
// Mini car-preview renderer (menu screen)
// ----------------------------------------------------------------------
const previewRenderer = new THREE.WebGLRenderer({ canvas: dom.carPreview, antialias: true, alpha: true });
previewRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const previewScene = new THREE.Scene();
const previewCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
previewCamera.position.set(3.2, 2.2, 4.2);
previewCamera.lookAt(0, 0.4, 0);
previewScene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.2));
const previewLight = new THREE.DirectionalLight(0xffffff, 1.2);
previewLight.position.set(3, 5, 2);
previewScene.add(previewLight);
let previewCar = createCarMesh(profile.color, profile.number);
previewScene.add(previewCar.group);

function updatePreviewColor(color) {
  previewScene.remove(previewCar.group);
  previewCar = createCarMesh(color, dom.numberInput.value || 1);
  previewScene.add(previewCar.group);
}
dom.colorInput.addEventListener('input', () => updatePreviewColor(dom.colorInput.value));
dom.numberInput.addEventListener('input', () => updatePreviewColor(dom.colorInput.value));

function resizePreview() {
  const w = dom.carPreview.clientWidth || 300;
  const h = dom.carPreview.clientHeight || 120;
  previewRenderer.setSize(w, h, false);
  previewCamera.aspect = w / h;
  previewCamera.updateProjectionMatrix();
}
new ResizeObserver(resizePreview).observe(dom.carPreview);
resizePreview();

let menuVisible = true;
function previewLoop() {
  requestAnimationFrame(previewLoop);
  if (!menuVisible) return;
  previewCar.group.rotation.y += 0.012;
  previewRenderer.render(previewScene, previewCamera);
}
previewLoop();

// ----------------------------------------------------------------------
// Main 3D scene
// ----------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas: dom.scene, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc6ff);
scene.fog = new THREE.FogExp2(0xbcdcff, 0.0022);

const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 20, -30);

// sky dome (vertical gradient)
{
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x4a90d9) },
      bottom: { value: new THREE.Color(0xdcf0ff) },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vPos; uniform vec3 top; uniform vec3 bottom;
      void main(){ float h = clamp(normalize(vPos).y * 1.2 + 0.15, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x3a6b35, 1.0));
const sun = new THREE.DirectionalLight(0xfff3dd, 1.5);
sun.position.set(150, 190, 90);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -220;
sun.shadow.camera.right = 220;
sun.shadow.camera.top = 220;
sun.shadow.camera.bottom = -220;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 500;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

const track = buildTrack(scene);

function resizeMain() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeMain);
resizeMain();

// ----------------------------------------------------------------------
// Minimap
// ----------------------------------------------------------------------
const mmCtx = dom.minimap.getContext('2d');
let mmBounds = null;
function computeMinimapBounds() {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of track.samples) {
    minX = Math.min(minX, s.pos.x); maxX = Math.max(maxX, s.pos.x);
    minZ = Math.min(minZ, s.pos.z); maxZ = Math.max(maxZ, s.pos.z);
  }
  mmBounds = { minX, maxX, minZ, maxZ };
}
computeMinimapBounds();

function drawMinimap(carsForMap) {
  const w = dom.minimap.width = dom.minimap.clientWidth * devicePixelRatio;
  const h = dom.minimap.height = dom.minimap.clientHeight * devicePixelRatio;
  mmCtx.clearRect(0, 0, w, h);
  const pad = 10 * devicePixelRatio;
  const { minX, maxX, minZ, maxZ } = mmBounds;
  const sx = (w - pad * 2) / (maxX - minX);
  const sz = (h - pad * 2) / (maxZ - minZ);
  const scale = Math.min(sx, sz);
  const toScreen = (x, z) => [
    pad + (x - minX) * scale,
    pad + (z - minZ) * scale,
  ];
  mmCtx.strokeStyle = 'rgba(255,255,255,0.65)';
  mmCtx.lineWidth = 3 * devicePixelRatio;
  mmCtx.beginPath();
  track.samples.forEach((s, i) => {
    const [x, y] = toScreen(s.pos.x, s.pos.z);
    if (i === 0) mmCtx.moveTo(x, y); else mmCtx.lineTo(x, y);
  });
  mmCtx.closePath();
  mmCtx.stroke();

  for (const c of carsForMap) {
    const [x, y] = toScreen(c.pos.x, c.pos.z);
    mmCtx.beginPath();
    mmCtx.fillStyle = c.color;
    mmCtx.arc(x, y, c.self ? 6 * devicePixelRatio : 4.5 * devicePixelRatio, 0, Math.PI * 2);
    mmCtx.fill();
    if (c.self) {
      mmCtx.strokeStyle = '#fff';
      mmCtx.lineWidth = 1.5 * devicePixelRatio;
      mmCtx.stroke();
    }
  }
}

// ----------------------------------------------------------------------
// Networking
// ----------------------------------------------------------------------
const network = new Network();
const playersMeta = new Map(); // id -> {name,color,number,ready,lap,bestLap,finished,finishTime}
const remoteVisual = new Map(); // id -> {carMesh, curPos, curYaw, curSpeed, tPos, tYaw, tSpeed}

function upsertMeta(p) {
  playersMeta.set(p.id, { ...(playersMeta.get(p.id) || {}), ...p });
}

function ensureRemoteVisual(id) {
  if (remoteVisual.has(id)) return remoteVisual.get(id);
  const meta = playersMeta.get(id) || { color: '#999999', number: 0 };
  const carMesh = createCarMesh(meta.color, meta.number);
  scene.add(carMesh.group);
  const v = {
    carMesh,
    curPos: new THREE.Vector3().copy(track.startPos),
    curYaw: track.startAngle,
    curSpeed: 0,
    tPos: new THREE.Vector3().copy(track.startPos),
    tYaw: track.startAngle,
    tSpeed: 0,
  };
  remoteVisual.set(id, v);
  return v;
}

function removeRemoteVisual(id) {
  const v = remoteVisual.get(id);
  if (v) { scene.remove(v.carMesh.group); remoteVisual.delete(id); }
}

let totalLaps = TOTAL_LAPS_DEFAULT;

network.on('welcome', (msg) => {
  totalLaps = msg.totalLaps || TOTAL_LAPS_DEFAULT;
  playersMeta.clear();
  for (const p of msg.players) upsertMeta(p);
  renderLobbyUI();
});
network.on('playerJoined', (msg) => { upsertMeta(msg.player); renderLobbyUI(); toast(`${msg.player.name} joined the grid`); });
network.on('playerLeft', (msg) => { playersMeta.delete(msg.id); removeRemoteVisual(msg.id); renderLobbyUI(); });
network.on('lobby', (msg) => { for (const p of msg.players) upsertMeta(p); renderLobbyUI(); });
network.on('standings', (msg) => { for (const p of msg.players) upsertMeta(p); });
network.on('state', (msg) => {
  const v = ensureRemoteVisual(msg.id);
  v.tPos.set(msg.pos[0], msg.pos[1], msg.pos[2]);
  v.tYaw = msg.rot;
  v.tSpeed = msg.speed;
});
network.on('countdown', (msg) => { beginCountdown(msg.seconds); });
network.on('go', (msg) => { totalLaps = msg.totalLaps; startRace(); });
network.on('raceOver', (msg) => { for (const p of msg.players) upsertMeta(p); showResults(); });
network.on('disconnected', () => { toast('Disconnected from server.'); });

dom.connStatus.textContent = 'Connecting to server…';
network.connect().then(() => {
  dom.connStatus.textContent = 'Connected ✓';
  dom.joinBtn.disabled = false;
}).catch(() => {
  dom.connStatus.textContent = 'Could not reach the server. Is node server.js running?';
});
dom.joinBtn.disabled = true;

function renderLobbyUI() {
  const list = Array.from(playersMeta.values());
  renderLobbyList(dom.lobbyList, list, network.id);
  const me = playersMeta.get(network.id);
  dom.readyBtn.textContent = me && me.ready ? 'Cancel Ready' : 'Ready Up';
}

// ----------------------------------------------------------------------
// UI wiring
// ----------------------------------------------------------------------
dom.serverAddr.textContent = `${location.protocol}//${location.host}`;

dom.joinBtn.addEventListener('click', () => {
  saveProfile();
  dom.nameInput.value = profile.name;
  network.join(profile.name, profile.color, profile.number);
  menuVisible = false;
  showScreen(dom.lobby);
  renderLobbyUI();
});

dom.readyBtn.addEventListener('click', () => {
  const me = playersMeta.get(network.id);
  const next = !(me && me.ready);
  network.setReady(next);
});

dom.startBtn.addEventListener('click', () => {
  network.requestStart();
});

dom.rematchBtn.addEventListener('click', () => {
  network.requestRestart();
  showScreen(dom.lobby);
  clearRaceObjects();
  renderLobbyUI();
});

// ----------------------------------------------------------------------
// Input
// ----------------------------------------------------------------------
const keys = { up: false, down: false, left: false, right: false };
window.addEventListener('keydown', (e) => setKey(e.code, true));
window.addEventListener('keyup', (e) => setKey(e.code, false));
function setKey(code, val) {
  if (code === 'KeyW' || code === 'ArrowUp') keys.up = val;
  if (code === 'KeyS' || code === 'ArrowDown') keys.down = val;
  if (code === 'KeyA' || code === 'ArrowLeft') keys.left = val;
  if (code === 'KeyD' || code === 'ArrowRight') keys.right = val;
}
function bindTouch(el, onDown, onUp) {
  const down = (e) => { e.preventDefault(); onDown(); };
  const up = (e) => { e.preventDefault(); onUp(); };
  el.addEventListener('touchstart', down, { passive: false });
  el.addEventListener('touchend', up, { passive: false });
  el.addEventListener('touchcancel', up, { passive: false });
  el.addEventListener('mousedown', down);
  el.addEventListener('mouseup', up);
  el.addEventListener('mouseleave', up);
}
bindTouch(dom.btnGas, () => (keys.up = true), () => (keys.up = false));
bindTouch(dom.btnBrake, () => (keys.down = true), () => (keys.down = false));
bindTouch(dom.btnLeft, () => (keys.left = true), () => (keys.left = false));
bindTouch(dom.btnRight, () => (keys.right = true), () => (keys.right = false));

function currentThrottle() { return (keys.up ? 1 : 0) + (keys.down ? -1 : 0); }
function currentSteer() { return (keys.right ? 1 : 0) + (keys.left ? -1 : 0); }

// ----------------------------------------------------------------------
// Race lifecycle
// ----------------------------------------------------------------------
let localCar = null;
let localCarMesh = null;
let aiEntities = [];
let raceState = 'menu'; // menu | lobby | countdown | racing | results
let raceStartTime = 0;
let networkSendAccum = 0;
let hasFinished = false;

function gridSlots(count) {
  const slots = [];
  const s0 = track.samples[0];
  for (let i = 0; i < count; i++) {
    const lane = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const back = row * 6 + 5;
    const pos = s0.pos.clone()
      .addScaledVector(s0.tangent, -back)
      .addScaledVector(s0.right, lane * 3.4);
    slots.push(pos);
  }
  return slots;
}

function clearRaceObjects() {
  if (localCarMesh) { scene.remove(localCarMesh.group); localCarMesh = null; }
  localCar = null;
  for (const a of aiEntities) scene.remove(a.mesh.group);
  aiEntities = [];
  hasFinished = false;
}

function beginCountdown(seconds) {
  raceState = 'countdown';
  showScreen(null);
  dom.hud.classList.add('hidden');
  dom.countdown.classList.remove('hidden');
  dom.countdownNum.textContent = seconds > 0 ? String(seconds) : 'GO!';
  dom.countdownNum.style.animation = 'none';
  void dom.countdownNum.offsetWidth;
  dom.countdownNum.style.animation = 'pop .5s ease-out';
}

function startRace() {
  raceState = 'racing';
  dom.countdown.classList.add('hidden');
  dom.hud.classList.remove('hidden');
  clearRaceObjects();

  const order = Array.from(playersMeta.keys()).sort((a, b) => a - b);
  const useAI = dom.aiToggle.checked;
  const slotCount = order.length + (useAI ? AI_COUNT : 0);
  const slots = gridSlots(slotCount);

  const myIndex = order.indexOf(network.id);
  const myMeta = playersMeta.get(network.id) || profile;
  localCar = new CarPhysics(slots[myIndex] || track.startPos, track.startAngle);
  localCar.lapStartTime = performance.now();
  localCarMesh = createCarMesh(myMeta.color, myMeta.number);
  scene.add(localCarMesh.group);

  // remote cars snap to grid slots too
  order.forEach((id, i) => {
    if (id === network.id) return;
    const v = ensureRemoteVisual(id);
    v.curPos.copy(slots[i]);
    v.tPos.copy(slots[i]);
    v.curYaw = track.startAngle;
    v.tYaw = track.startAngle;
  });

  if (useAI) {
    for (let i = 0; i < AI_COUNT; i++) {
      const slot = slots[order.length + i];
      const colors = ['#777777', '#2b2d33', '#5a6472'];
      const mesh = createCarMesh(colors[i % colors.length], 90 + i);
      scene.add(mesh.group);
      const physics = new CarPhysics(slot, track.startAngle);
      physics.lapStartTime = performance.now();
      aiEntities.push({ mesh, physics, driver: new AIDriver(track, i * 17 + 3) });
    }
  }

  raceStartTime = performance.now();
  hasFinished = false;
}

function showResults() {
  raceState = 'results';
  dom.hud.classList.add('hidden');
  const rows = Array.from(playersMeta.values())
    .slice()
    .sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return (b.lap || 0) - (a.lap || 0);
    });
  renderResults(dom.resultsList, rows);
  showScreen(dom.results);
}

// ----------------------------------------------------------------------
// Camera follow
// ----------------------------------------------------------------------
const camPos = new THREE.Vector3(0, 20, -30);
const camLook = new THREE.Vector3();
function updateCamera(car, dt) {
  const fwd = forwardVector(car.yaw);
  const desired = car.pos.clone().addScaledVector(fwd, -9.5);
  desired.y += 4.6;
  const look = car.pos.clone().addScaledVector(fwd, 6);
  look.y += 1.2;
  const t = 1 - Math.pow(0.001, dt);
  camPos.lerp(desired, t);
  camLook.lerp(look, t);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// ----------------------------------------------------------------------
// Visual helpers
// ----------------------------------------------------------------------
function applyCarTransform(mesh, pos, yaw, steerAngle, wheelSpin) {
  mesh.group.position.copy(pos);
  mesh.group.rotation.y = yaw;
  if (steerAngle != null) {
    mesh.wheels.fl.rotation.y = steerAngle;
    mesh.wheels.fr.rotation.y = steerAngle;
  }
  if (wheelSpin != null) {
    for (const w of Object.values(mesh.wheels)) {
      w.children[0].rotation.x = wheelSpin;
      w.children[1].rotation.x = wheelSpin;
    }
  }
}

// ----------------------------------------------------------------------
// Live standings (progress-based ranking)
// ----------------------------------------------------------------------
function liveStandingsRows() {
  const rows = [];
  for (const [id, meta] of playersMeta) {
    let u = 0, lap = meta.lap || 0, finished = !!meta.finished, finishTime = meta.finishTime;
    if (id === network.id && localCar) { u = localCar.u; lap = localCar.lap; finished = hasFinished; }
    else {
      const v = remoteVisual.get(id);
      if (v) {
        const proj = track.projectPoint(v.curPos, 0);
        u = proj.u;
      }
    }
    rows.push({ id, name: meta.name, color: meta.color, lap, u, finished, finishTime });
  }
  rows.sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return (b.lap + b.u) - (a.lap + a.u);
  });
  return rows;
}

// ----------------------------------------------------------------------
// Main loop
// ----------------------------------------------------------------------
let lastTime = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 0.05);

  if (raceState === 'racing' && localCar) {
    const throttle = currentThrottle();
    const steer = currentSteer();
    localCar.update(throttle, steer, dt, track, now);
    const spin = (localCar.speed / 0.46) * dt;
    applyCarTransform(localCarMesh, localCar.pos, localCar.yaw, localCar.steerAngle, (localCarMesh.group.userData.spin = (localCarMesh.group.userData.spin || 0) + spin));

    if (!hasFinished && localCar.lap >= totalLaps) {
      hasFinished = true;
      const finishTime = now - raceStartTime;
      localCar.finished = true;
      localCar.finishTime = finishTime;
      network.sendFinish(finishTime);
      toast('Finished! Waiting for other drivers…', 4000);
    }
    if (localCar.lastLapTime != null && localCar._lapSent !== localCar.lap) {
      localCar._lapSent = localCar.lap;
      network.sendLap(localCar.lap, localCar.lastLapTime);
    }

    networkSendAccum += dt;
    if (networkSendAccum > 1 / 18) {
      networkSendAccum = 0;
      network.sendState([localCar.pos.x, localCar.pos.y, localCar.pos.z], localCar.yaw, localCar.speed);
    }

    for (const a of aiEntities) {
      const input = a.driver.drive(a.physics);
      a.physics.update(input.throttle, input.steer, dt, track, now);
      const spinA = (a.physics.speed / 0.46) * dt;
      a.mesh.group.userData.spin = (a.mesh.group.userData.spin || 0) + spinA;
      applyCarTransform(a.mesh, a.physics.pos, a.physics.yaw, a.physics.steerAngle, a.mesh.group.userData.spin);
    }

    for (const [, v] of remoteVisual) {
      const lerpT = 1 - Math.pow(0.0005, dt);
      v.curPos.lerp(v.tPos, lerpT);
      let dYaw = v.tYaw - v.curYaw;
      dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
      v.curYaw += dYaw * lerpT;
      v.curSpeed += (v.tSpeed - v.curSpeed) * lerpT;
      const spinR = (v.curSpeed / 0.46) * dt;
      v.carMesh.group.userData.spin = (v.carMesh.group.userData.spin || 0) + spinR;
      applyCarTransform(v.carMesh, v.curPos, v.curYaw, 0, v.carMesh.group.userData.spin);
    }

    updateCamera(localCar, dt);

    // HUD
    dom.lapChip.textContent = `LAP ${Math.min(localCar.lap + 1, totalLaps)} / ${totalLaps}`;
    const kmh = Math.round(Math.abs(localCar.speed) * 3.6);
    dom.speedValue.textContent = String(kmh);
    dom.timeChip.textContent = formatTime(now - raceStartTime);
    dom.offtrackWarning.classList.toggle('hidden', !localCar.offtrack);

    const rows = liveStandingsRows();
    const myRank = rows.findIndex((r) => r.id === network.id) + 1;
    dom.posChip.textContent = `P${myRank || 1}`;
    renderStandings(dom.standings, rows, network.id);

    const mapCars = rows.map((r) => {
      if (r.id === network.id) return { pos: localCar.pos, color: r.color, self: true };
      const v = remoteVisual.get(r.id);
      return { pos: v ? v.curPos : track.startPos, color: r.color, self: false };
    });
    for (const a of aiEntities) mapCars.push({ pos: a.physics.pos, color: '#aaaaaa', self: false });
    drawMinimap(mapCars);
  }

  renderer.render(scene, camera);
}
loop();
