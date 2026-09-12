/**
 * Overlay: Timer (Sección 14)
 * Regla #52-53: solo visualiza. Regla #54: reconecta y solicita resync.
 * Regla #55: solo acepta mensajes de localhost.
 */

const WS_URL = "ws://127.0.0.1:47821/overlay/timer";
const RECONNECT_DELAY_MS = 2000;

const display = document.getElementById("timer-display");
const statusEl = document.getElementById("status");

let ws = null;
let reconnectTimer = null;
let remainingSeconds = 0;
let running = false;
let tickInterval = null;

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function startLocalTick() {
  stopLocalTick();
  tickInterval = setInterval(() => {
    if (running && remainingSeconds > 0) {
      remainingSeconds--;
      render();
    }
  }, 1000);
}

function stopLocalTick() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function render() {
  if (!display) return;
  display.textContent = formatTime(remainingSeconds);
  display.classList.toggle("zero", remainingSeconds === 0);
}

function handleMessage(data) {
  switch (data.messageType) {
    case "timer_updated":
      remainingSeconds = data.payload.remainingSeconds ?? remainingSeconds;
      running = data.payload.running ?? running;
      if (running) startLocalTick();
      else stopLocalTick();
      render();
      break;
    case "timer_zero":
      remainingSeconds = 0;
      running = false;
      stopLocalTick();
      render();
      break;
    case "overlay_state":
      if (data.overlayId === "timer") {
        remainingSeconds = data.payload.remainingSeconds ?? 0;
        running = data.payload.running ?? false;
        if (running) startLocalTick();
        render();
      }
      break;
    case "session_ended":
      remainingSeconds = 0;
      running = false;
      stopLocalTick();
      render();
      break;
  }
}

function connect() {
  if (ws) ws.close();
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    if (statusEl) statusEl.style.display = "none";
    ws.send(JSON.stringify({ type: "resync", overlayId: "timer" }));
  };

  ws.onmessage = (e) => {
    try {
      handleMessage(JSON.parse(e.data));
    } catch {}
  };

  ws.onclose = () => {
    stopLocalTick();
    if (statusEl) statusEl.style.display = "block";
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
  };

  ws.onerror = () => ws.close();
}

connect();
