/**
 * Overlay: Gift Jar (Sección 18)
 * Regla #52-53: solo visualiza. Regla #54: reconecta y resync.
 * Tamaño proporcional al valor en coins. Caída y acumulación sencilla.
 */

const WS_URL = "ws://127.0.0.1:47821/overlay/jar";
const RECONNECT_DELAY_MS = 2000;
const MAX_GIFTS_IN_JAR = 50;

const jar = document.getElementById("jar-fill");
const giftArea = document.getElementById("gift-area");
const statusEl = document.getElementById("status");
let ws = null;
let totalCoins = 0;

function coinToSize(coins) {
  if (coins >= 10000) return 52;
  if (coins >= 1000)  return 40;
  if (coins >= 100)   return 30;
  if (coins >= 10)    return 22;
  return 14;
}

function coinToColor(coins) {
  if (coins >= 10000) return "#f59e0b";
  if (coins >= 1000)  return "#818cf8";
  if (coins >= 100)   return "#34d399";
  if (coins >= 10)    return "#60a5fa";
  return "#f472b6";
}

function addGiftToJar(giftName, coins, qty) {
  if (!giftArea) return;
  const size = coinToSize(coins);
  const color = coinToColor(coins);
  for (let i = 0; i < Math.min(qty, 5); i++) {
    const el = document.createElement("div");
    el.className = "gift-ball";
    el.style.cssText = `width:${size}px;height:${size}px;background:${color};left:${10 + Math.random() * 75}%;animation-delay:${i * 0.15}s`;
    el.title = `${giftName} (${coins} 🪙)`;
    giftArea.appendChild(el);
    if (giftArea.children.length > MAX_GIFTS_IN_JAR) {
      giftArea.removeChild(giftArea.firstChild);
    }
  }
  totalCoins += coins * qty;
  updateFill();
}

function updateFill() {
  if (!jar) return;
  const pct = Math.min((giftArea?.children.length ?? 0) / MAX_GIFTS_IN_JAR * 100, 100);
  jar.style.height = `${pct}%`;
}

function handleMessage(data) {
  switch (data.messageType) {
    case "gift_received":
      addGiftToJar(data.payload.giftName, data.payload.coins, data.payload.quantity ?? 1);
      break;
    case "session_ended":
      if (giftArea) giftArea.innerHTML = "";
      totalCoins = 0;
      updateFill();
      break;
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
