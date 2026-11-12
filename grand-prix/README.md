# Apex Circuit — Grand Prix

A browser-based 3D Grand Prix racing game with LAN multiplayer, built with
Three.js on the client and a small Node/WebSocket server for syncing players.

## Running it

```bash
cd grand-prix
npm install   # first time only
npm start
```

The terminal will print something like:

```
🏁 Grand Prix server running!
Local:    http://localhost:3000
Network:  http://192.168.1.23:3000   <-- share this with other players on your LAN
```

- Open the **Local** link yourself.
- Anyone else on the same Wi‑Fi/LAN opens the **Network** link in their own
  browser to join the grid. No install needed on their side — just a browser.

## Playing

1. Pick a driver name, car number, and livery color (or a quick swatch) on the
   main menu, then **Join Grid**.
2. In the lobby you'll see everyone who has joined. Anyone can hit
   **Start Race** once people are in.
3. Drive with **WASD** or **Arrow keys** (or the on-screen touch pad on
   phones/tablets).
4. First to complete the lap count wins. Live standings, a minimap, lap
   timer and speed are all shown in the HUD.
5. After the race, **Back to Lobby** to run it back with the same group.

Toggle **Add AI traffic** in the lobby to fill the grid with practice bots
when racing solo.

## Notes

- Your name/number/livery are remembered in the browser (localStorage) for
  next time.
- The game needs one machine on the LAN running `npm start` as the host;
  everyone else just needs a browser pointed at that machine's address.
- If other devices can't connect, check that your firewall allows inbound
  connections on port 3000 (or set `PORT=xxxx npm start` to use another port).
