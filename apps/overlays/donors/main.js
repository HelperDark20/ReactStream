/**
 * Overlay: Top Donors (Sección 20)
 * Regla #52-53: solo visualiza. Regla #54: reconecta y resync.
 */

const WS_URL = "ws://127.0.0.1:47821/overlay/donors";
const RECONNECT_DELAY_MS = 2000;

const list = document.getElementById("donor-list");
const statusEl = document.getElementById("status");
let ws = null;

function render(donors) {
  if (!list) return;
  list.innerHTML = donors
    .map(
      (d, i) => `
    <div class="donor-entry">
      <span class="rank">#${i + 1}</span>
      ${d.avatarUrl ? `<img class="avatar" src="${d.avatarUrl}" alt="" />` : ""}
      <span class="name">${d.displayName}</span>
      <span class="coins">${d.coins.toLocaleString()} 🪙</span>
    </div>`
    )
    .join("");
}

function handleMessage(data) {
  switch (data.messageType) {
    case "ranking_updated":
      if (data.overlayId === "donors") render(data.payload.donors ?? []);
      break;
    case "overlay_state":
      if (data.overlayId === "donors") render(data.payload.donors ?? []);
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
    ws.send(JSON.stringify({ type: "resync", overlayId: "donors" }));
  };
  ws.onmessage = (e) => { try { handleMessage(JSON.parse(e.data)); } catch {} };
  ws.onclose = () => {
    if (statusEl) statusEl.style.display = "block";
    setTimeout(connect, RECONNECT_DELAY_MS);
  };
  ws.onerror = () => ws.close();
}

connect();
