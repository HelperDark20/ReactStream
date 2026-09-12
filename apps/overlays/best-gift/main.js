/**
 * Overlay: Best Gift (Sección 16)
 * Regla #31: muestra gift.coins (valor unitario), no totalCoins.
 * Regla #52-53: solo visualiza. Regla #54: reconecta y resync.
 */

const WS_URL = "ws://127.0.0.1:47821/overlay/best-gift";
const RECONNECT_DELAY_MS = 2000;

const container = document.getElementById("best-gift");
const statusEl = document.getElementById("status");
let ws = null;

function render(data) {
  if (!container) return;
  if (!data) { container.style.display = "none"; return; }
  container.style.display = "flex";
  container.innerHTML = `
    ${data.imageUrl ? `<img class="gift-img" src="${data.imageUrl}" alt="${data.giftName}" />` : ""}
    <div class="gift-info">
      <div class="gift-name">${data.giftName}</div>
      <div class="gift-coins">${data.coins.toLocaleString()} 🪙</div>
      <div class="gift-sender">de ${data.senderName}</div>
    </div>`;
}

function handleMessage(data) {
  switch (data.messageType) {
    case "best_gift_updated": render(data.payload); break;
    case "overlay_state":
      if (data.overlayId === "best-gift") render(data.payload); break;
    case "session_ended": render(null); break;
  }
}

function connect() {
  if (ws) ws.close();
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    if (statusEl) statusEl.style.display = "none";
    ws.send(JSON.stringify({ type: "resync", overlayId: "best-gift" }));
  };
  ws.onmessage = (e) => { try { handleMessage(JSON.parse(e.data)); } catch {} };
  ws.onclose = () => {
    if (statusEl) statusEl.style.display = "block";
    setTimeout(connect, RECONNECT_DELAY_MS);
  };
  ws.onerror = () => ws.close();
}

connect();
