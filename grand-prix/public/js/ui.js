export const LIVERY_SWATCHES = [
  '#e10600', '#1e5bc6', '#ffce00', '#00a86b',
  '#ff8700', '#8a2be2', '#111111', '#f4f4f4',
];

export function formatTime(ms) {
  if (ms == null) return '--:--.---';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msPart = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(msPart).padStart(3, '0')}`;
}

export function showScreen(el) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
  if (el) el.classList.remove('hidden');
}

let toastTimer = null;
export function toast(text, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.classList.add('hidden'), 300);
  }, ms);
}

export function renderLobbyList(container, players, selfId) {
  container.innerHTML = '';
  for (const p of players) {
    const row = document.createElement('div');
    row.className = 'lobby-row';
    row.innerHTML = `
      <div class="lobby-dot" style="background:${p.color};color:${p.color}"></div>
      <div class="lobby-name">${escapeHtml(p.name)} #${p.number}${p.id === selfId ? ' (you)' : ''}</div>
      <div class="lobby-tag ${p.ready ? 'ready' : ''}">${p.ready ? 'Ready' : 'Not ready'}</div>
    `;
    container.appendChild(row);
  }
  if (players.length === 0) {
    container.innerHTML = '<div class="hint">No one here yet — waiting for drivers to join…</div>';
  }
}

export function renderStandings(container, rows, selfId) {
  container.innerHTML = '';
  rows.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'standing-row' + (r.id === selfId ? ' me' : '');
    row.innerHTML = `
      <div class="standing-pos">P${i + 1}</div>
      <div class="standing-dot" style="background:${r.color}"></div>
      <div class="standing-name">${escapeHtml(r.name)}</div>
      <div class="standing-lap">L${r.lap}${r.finished ? ' ✓' : ''}</div>
    `;
    container.appendChild(row);
  });
}

export function renderResults(container, rows) {
  container.innerHTML = '';
  rows.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'result-row' + (i === 0 ? ' p1' : '');
    row.innerHTML = `
      <div class="result-pos">P${i + 1}</div>
      <div class="result-dot" style="background:${r.color}"></div>
      <div class="result-name">${escapeHtml(r.name)}</div>
      <div class="result-time">${r.finishTime != null ? formatTime(r.finishTime) : 'DNF'}</div>
    `;
    container.appendChild(row);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
