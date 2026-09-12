/**
 * Overlay: Likes / Tap Tap (Sección 19)
 * Regla #52-53: solo visualiza. Regla #54: reconecta y resync.
 * Mismo avatar máximo una vez cada 10 segundos.
 */

const WS_URL = "ws://127.0.0.1:47821/overlay/likes";
const RECONNECT_DELAY_MS = 2000;
const AVATAR_COOLDOWN_MS = 10_000;
const HEART_DURATION_MS = 2500;

const container = document.getElementById("hearts-container");
const statusEl = document.getElementById("status");
let ws = null;
const lastSeen = new Map();

function spawnHearts(user, count) {
  const now = Date.now();
  const lastTime = lastSeen.get(user.userId) ?? 0;
  if (now - lastTime < AVATAR_COOLDOWN_MS) return;
  lastSeen.set(user.userId, now);

  const amount = Math.min(count, 10);
  for (let i = 0; i < amount; i++) {
    setTimeout(() => {
      const el = document.createElement("div");
      el.className = "heart-wrap";
      el.style.left = `${10 + Math.random() * 80}%`;
      el.innerHTML = user.avatarUrl
        ? `<img class="avatar-heart" src="${user.avatarUrl}" alt="" />`
        : `<span class="heart">❤️</span>`;
      container?.appendChild(el);
      setTimeout(() => el.remove(), HEART_DURATION_MS);
    }, i * 120);
  }
}

function handleMessage(data) {
  if (data.messageType === "likes_received") {
    spawnHearts(data.payload, data.payload.count ?? 1);
  }
}

function connect() {
  if (ws) ws.close();
  ws = new WebSocket(WS_URL);
  ws.onopen = () => { if (statusEl) statusEl.style.display = "none"; };
  ws.onmessage = (e) => { try { handleMessage(JSON.parse(e.data)); } catch {} };
  ws.onclose = () => {
    if (statusEl) statusEl.style.display = "block";
    setTimeout(connect, RECONNECT_DELAY_MS);
  };
  ws.onerror = () => ws.close();
}

connect();
