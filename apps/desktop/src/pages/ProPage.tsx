import { useState } from "react";
import { CrownIcon, UIIcon } from "../components/icons";
import background from "../assets/reactstream-background.svg";

const FEATURES: { icon: "zap" | "film" | "audio" | "play" | "clock" | "check"; label: string }[] = [
  { icon: "zap",   label: "Automatizaciones ilimitadas" },
  { icon: "film",  label: "Todos los overlays" },
  { icon: "audio", label: "Biblioteca de sonidos" },
  { icon: "play",  label: "Modo simulación completo" },
  { icon: "clock", label: "Historial de sesiones" },
  { icon: "check", label: "Soporte prioritario" },
];

export default function ProPage() {
  const [licenseKey, setLicenseKey] = useState("");

  return (
    <section className="actions-module-shell">
      <img className="actions-module-background" src={background} alt="" draggable={false} />

      <header className="actions-module-header">
        <div className="actions-module-title-row">
          <CrownIcon className="actions-module-title-icon pro-title-icon" />
          <div>
            <h1>
              <span style={{ color: "#fff" }}>React</span>
              <span style={{ color: "var(--rs-green)" }}>Stream</span>
              {" "}<span style={{ color: "#f59e0b" }}>Pro</span>
            </h1>
            <p>Activa tu licencia para desbloquear todas las funciones avanzadas</p>
          </div>
        </div>
      </header>

      <div className="actions-module-card">
        <div className="actions-module-content pro-content">
          <div className="pro-inner">
            <div className="pro-features-grid">
              {FEATURES.map((f) => (
                <div key={f.label} className="pro-feature-item">
                  <span className="pro-feature-icon"><UIIcon name={f.icon} size={14} /></span>
                  {f.label}
                </div>
              ))}
            </div>

            <div className="pro-license-box">
              <div className="module-section-title" style={{ marginBottom: 14 }}>CLAVE DE LICENCIA</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  className="module-input pro-license-input"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                />
                <button className="module-green-button" disabled={!licenseKey.trim()}>
                  <UIIcon name="check" size={14} /> Activar
                </button>
              </div>
              <p className="module-help" style={{ marginTop: 10 }}>
                ¿No tienes una licencia? Visita{" "}
                <span style={{ color: "var(--rs-green)" }}>reactstream.app</span> para obtener una.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
