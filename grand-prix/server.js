const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules/three/build')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ---- Room state ----
// players: id -> { id, name, color, number, ready, lap, bestLap, lastLapTime, raceTime, finished, finishTime, pos, rot, speed }
const players = new Map();
let nextId = 1;
const TOTAL_LAPS = 3;

let raceState = 'lobby'; // 'lobby' | 'countdown' | 'racing' | 'finished'
let countdownTimer = null;
let raceStartedAt = null;

function broadcast(obj, exceptId) {
  const msg = JSON.stringify(obj);
  for (const [id, p] of players) {
    if (id === exceptId) continue;
    if (p.ws.readyState === p.ws.OPEN) p.ws.send(msg);
  }
}

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function publicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    number: p.number,
    ready: p.ready,
    lap: p.lap,
    bestLap: p.bestLap,
    finished: p.finished,
    finishTime: p.finishTime,
    pos: p.pos,
    rot: p.rot,
    speed: p.speed,
  };
}

function lobbyList() {
  return Array.from(players.values()).map(publicPlayer);
}

function resetRace() {
  raceState = 'lobby';
  raceStartedAt = null;
  for (const p of players.values()) {
    p.ready = false;
    p.lap = 0;
    p.bestLap = null;
    p.lastLapAt = null;
    p.finished = false;
    p.finishTime = null;
  }
}

function tryStartCountdown(requesterId) {
  if (raceState !== 'lobby') return;
  if (players.size === 0) return;
  raceState = 'countdown';
  let n = 3;
  broadcast({ type: 'countdown', seconds: n }, null);
  countdownTimer = setInterval(() => {
    n -= 1;
    if (n > 0) {
      broadcast({ type: 'countdown', seconds: n }, null);
    } else {
      clearInterval(countdownTimer);
      raceState = 'racing';
      raceStartedAt = Date.now();
      broadcast({ type: 'go', totalLaps: TOTAL_LAPS, startedAt: raceStartedAt }, null);
    }
  }, 1000);
}

wss.on('connection', (ws) => {
  const id = nextId++;
  let joined = false;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'join') {
      joined = true;
      const name = String(msg.name || 'Driver').slice(0, 16) || 'Driver';
      const color = /^#[0-9a-fA-F]{6}$/.test(msg.color) ? msg.color : '#e10600';
      const number = Math.max(1, Math.min(99, parseInt(msg.number, 10) || id));
      const player = {
        id, ws, name, color, number,
        ready: false, lap: 0, bestLap: null, lastLapAt: null,
        finished: false, finishTime: null,
        pos: [0, 0, 0], rot: 0, speed: 0,
      };
      players.set(id, player);
      send(ws, {
        type: 'welcome',
        id,
        totalLaps: TOTAL_LAPS,
        raceState,
        players: lobbyList(),
        startedAt: raceStartedAt,
      });
      broadcast({ type: 'playerJoined', player: publicPlayer(player) }, id);
      return;
    }

    if (!joined) return;
    const p = players.get(id);
    if (!p) return;

    switch (msg.type) {
      case 'ready': {
        p.ready = !!msg.ready;
        broadcast({ type: 'lobby', players: lobbyList() }, null);
        break;
      }
      case 'startRequest': {
        tryStartCountdown(id);
        break;
      }
      case 'state': {
        p.pos = msg.pos;
        p.rot = msg.rot;
        p.speed = msg.speed;
        broadcast({ type: 'state', id, pos: msg.pos, rot: msg.rot, speed: msg.speed }, id);
        break;
      }
      case 'lap': {
        p.lap = msg.lap;
        if (msg.lapTime != null) {
          if (p.bestLap == null || msg.lapTime < p.bestLap) p.bestLap = msg.lapTime;
        }
        broadcast({ type: 'standings', players: lobbyList() }, null);
        break;
      }
      case 'finish': {
        if (!p.finished) {
          p.finished = true;
          p.finishTime = msg.time;
        }
        broadcast({ type: 'standings', players: lobbyList() }, null);
        // if everyone finished, end race
        const all = Array.from(players.values());
        if (all.length > 0 && all.every((pl) => pl.finished)) {
          raceState = 'finished';
          broadcast({ type: 'raceOver', players: lobbyList() }, null);
        }
        break;
      }
      case 'restartRequest': {
        resetRace();
        broadcast({ type: 'lobby', players: lobbyList() }, null);
        break;
      }
      case 'chat': {
        const text = String(msg.text || '').slice(0, 140);
        broadcast({ type: 'chat', id, name: p.name, text }, null);
        break;
      }
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ type: 'playerLeft', id }, null);
    if (players.size === 0) {
      resetRace();
      if (countdownTimer) clearInterval(countdownTimer);
    }
  });
});

function getLanIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

server.listen(PORT, () => {
  console.log('');
  console.log('  🏁 Grand Prix server running!');
  console.log(`  Local:    http://localhost:${PORT}`);
  for (const ip of getLanIPs()) {
    console.log(`  Network:  http://${ip}:${PORT}   <-- share this with other players on your LAN`);
  }
  console.log('');
});
