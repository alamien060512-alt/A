export class Network {
  constructor() {
    this.ws = null;
    this.id = null;
    this.handlers = {};
    this.connected = false;
  }

  on(type, fn) { this.handlers[type] = fn; }

  connect() {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${location.host}`;
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => { this.connected = true; resolve(); };
      ws.onerror = (e) => { if (!this.connected) reject(e); };
      ws.onclose = () => {
        this.connected = false;
        if (this.handlers.disconnected) this.handlers.disconnected();
      };
      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.type === 'welcome') this.id = msg.id;
        const fn = this.handlers[msg.type];
        if (fn) fn(msg);
      };
    });
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  join(name, color, number) { this.send({ type: 'join', name, color, number }); }
  setReady(ready) { this.send({ type: 'ready', ready }); }
  requestStart() { this.send({ type: 'startRequest' }); }
  sendState(pos, rot, speed) { this.send({ type: 'state', pos, rot, speed }); }
  sendLap(lap, lapTime) { this.send({ type: 'lap', lap, lapTime }); }
  sendFinish(time) { this.send({ type: 'finish', time }); }
  requestRestart() { this.send({ type: 'restartRequest' }); }
}
