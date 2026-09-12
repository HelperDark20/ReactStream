/**
 * Overlay: Top Tap Tap (Sección 20)
 * Regla #52-53: solo visualiza. Regla #54: reconecta y resync.
 */

const WS_URL = "ws://127.0.0.1:47821/overlay/tappers";
const RECONNECT_DELAY_MS = 2000;

const list = document.getElementById("tapper-list");
const statusEl = document.getElementById("status");
let ws = null;

function render(tappers) {
  if (!list) return;
  list.innerHTML = tappers
    .map(
      (t, i) => `
    <div class="tapper-entry">
      <span class="rank">#${i + 1}</span>
      ${t.avatarUrl ? `<img class="avatar" src="${t.avatarUrl}" alt="" />` : ""}
      <span class="name">${t.displayName}</span>
      <span class="likes">${t.likes.toLocaleString()} ❤️</span>
    </div>`
    )
    .join("");
}

function handleMessage(data) {
  switch (data.messageType) {
    case "ranking_updated":
      if (data.overlayId === "tappers") render(data.payload.tappers ?? []);
      break;
    case "overlay_state":
      if (data.overlayId === "tappers") render(data.payload.tappers ?? []);
      break;
    case "session_ended":
      render([]);
      break;
  }
}

function connect() {
  if (ws) ws.close();
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    if (statusEl) statusEl.style.display = "none";
    ws.send(JSON.stringify({ type: "resync", overlayId: "tappers" }));
  };
  ws.onmessage = (e) => { try { handleMessage(JSON.parse(e.data)); } catch {} };
  ws.onclose = () => {
    if (statusEl) statusEl.style.display = "block";
    setTimeout(connect, RECONNECT_DELAY_MS);
  };
  ws.onerror = () => ws.close();
}

connect();
