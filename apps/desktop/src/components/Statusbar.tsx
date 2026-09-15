import { useAppStore } from "../stores/app.store";

export default function Statusbar() {
  const { tiktokStatus, sessionActive, version } = useAppStore();

  const statusText = sessionActive
    ? "LIVE activo · Automation Engine corriendo"
    : tiktokStatus === "CONNECTED"
    ? "Conectado a TikTok · Esperando inicio del LIVE"
    : tiktokStatus === "CONNECTING"
    ? "Conectando con TikTok..."
    : "Tu live, más interactivo.";

  const dotColor = sessionActive ? "green" : tiktokStatus === "CONNECTED" ? "green" : tiktokStatus === "CONNECTING" ? "yellow" : "gray";

  return (
    <div className="rs-statusbar" style={{
      height: "var(--rs-statusbar-height)",
      background: "rgba(5,7,6,.96)",
      borderTop: "1px solid var(--rs-border)",
      display: "flex",
      alignItems: "center",
      padding: "0 26px",
      justifyContent: "space-between",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className={`status-dot ${dotColor}`} />
        <span style={{ fontSize: 12, color: "var(--rs-text-secondary)" }}>{statusText}</span>
      </div>
      <span style={{ fontSize: 11, color: "var(--rs-text-muted)", letterSpacing: "0.08em" }}>
        REACTSTREAM APP v{version}
      </span>
    </div>
  );
}
