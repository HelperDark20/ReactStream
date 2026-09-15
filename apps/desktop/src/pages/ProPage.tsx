export default function ProPage() {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {/* Ícono */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "rgba(245,158,11,0.1)", border: "2px solid rgba(245,158,11,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, margin: "0 auto 20px",
        }}>
          👑
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          <span style={{ color: "#fff" }}>React</span>
          <span style={{ color: "var(--rs-green)" }}>Stream</span>
          {" "}<span style={{ color: "#f59e0b" }}>Pro</span>
        </h2>
        <p style={{ fontSize: 14, color: "var(--rs-text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
          Activa tu licencia para desbloquear todas las funciones avanzadas de ReactStream.
        </p>

        {/* Features */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28, textAlign: "left" }}>
          {[
            "✅ Automatizaciones ilimitadas",
            "✅ Todos los overlays",
            "✅ Biblioteca de sonidos",
            "✅ Modo simulación completo",
            "✅ Historial de sesiones",
            "✅ Soporte prioritario",
          ].map((f) => (
            <div key={f} style={{ fontSize: 13, color: "var(--rs-text-secondary)", padding: "8px 12px", background: "var(--rs-bg-card)", border: "1px solid var(--rs-border)", borderRadius: 8 }}>
              {f}
            </div>
          ))}
        </div>

        {/* Activar licencia */}
        <div style={{ background: "var(--rs-bg-card)", border: "1px solid var(--rs-border)", borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--rs-text-secondary)", marginBottom: 8 }}>Clave de licencia</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" placeholder="XXXX-XXXX-XXXX-XXXX" style={{ flex: 1, fontFamily: "monospace", letterSpacing: "0.1em" }} />
            <button className="btn-green">Activar</button>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--rs-text-muted)" }}>
          ¿No tienes una licencia? Visita <span style={{ color: "var(--rs-green)" }}>reactstream.app</span> para obtener una.
        </p>
      </div>
    </div>
  );
}
