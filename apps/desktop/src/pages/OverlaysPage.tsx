import { useState } from "react";
import { LayersIcon, UIIcon } from "../components/icons";
import TimerPreview from "../components/overlays/TimerPreview";
import DonorsPreview from "../components/overlays/DonorsPreview";
import TappersPreview from "../components/overlays/TappersPreview";
import BestGiftPreview from "../components/overlays/BestGiftPreview";
import LikesPreview from "../components/overlays/LikesPreview";
import JarPreview from "../components/overlays/JarPreview";
import background from "../assets/reactstream-background.svg";

type OverlayId = "timer" | "donors" | "tappers" | "best-gift" | "likes" | "jar";

interface OverlayConfig {
  id: OverlayId;
  icon: string;
  name: string;
  desc: string;
  url: string;
  settings: Record<string, unknown>;
}

const OVERLAYS: OverlayConfig[] = [
  { id: "timer",     icon: "⏱",  name: "Timer",           desc: "Cuenta regresiva alimentada por coins",   url: "http://localhost:47820/overlay/timer.html",     settings: { initialSeconds: 300, coinsPerSecond: 10, reactivateOnZero: true } },
  { id: "donors",    icon: "🏆", name: "Top Donors",      desc: "Ranking de donadores por monedas",        url: "http://localhost:47820/overlay/donors.html",    settings: { topN: 10 } },
  { id: "tappers",   icon: "❤️", name: "Top Tap Tap",     desc: "Ranking por cantidad de likes",           url: "http://localhost:47820/overlay/tappers.html",   settings: { topN: 10 } },
  { id: "best-gift", icon: "👑", name: "Mejor Regalo",    desc: "Regalo de mayor valor unitario",          url: "http://localhost:47820/overlay/best-gift.html", settings: {} },
  { id: "likes",     icon: "💚", name: "Likes / Tap Tap", desc: "Corazones flotantes con avatar",          url: "http://localhost:47820/overlay/likes.html",     settings: { cooldownPerUserMs: 10000 } },
  { id: "jar",       icon: "🫙", name: "Gift Jar",        desc: "Frasco con regalos, tamaño proporcional", url: "http://localhost:47820/overlay/jar.html",       settings: { maxGifts: 50 } },
];

export default function OverlaysPage() {
  const [selected, setSelected] = useState<OverlayId>("timer");
  const ov = OVERLAYS.find((o) => o.id === selected)!;

  return (
    <section className="actions-module-shell">
      <img className="actions-module-background" src={background} alt="" draggable={false} />

      <header className="actions-module-header">
        <div className="actions-module-title-row">
          <LayersIcon className="actions-module-title-icon" />
          <div>
            <h1>Overlays</h1>
            <p>Configura y previsualiza los overlays para TikTok Studio</p>
          </div>
        </div>
      </header>

      <div className="actions-module-card">
        <div className="actions-module-content">
          <div className="keystroke-workspace">
            {/* Lista izquierda */}
            <aside className="keystroke-list-panel">
              <div className="keystroke-list-head">
                <span>OVERLAYS</span>
              </div>
              <div className="keystroke-list-scroll">
                {OVERLAYS.map((o) => {
                  const active = selected === o.id;
                  return (
                    <button
                      key={o.id}
                      className={`keystroke-list-item ${active ? "active" : ""}`}
                      onClick={() => setSelected(o.id)}
                    >
                      <span className="keystroke-item-icon overlay-emoji-icon">{o.icon}</span>
                      <span className="keystroke-item-copy">
                        <strong>{o.name}</strong>
                        <small>{o.desc}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Panel derecho */}
            <div className="overlay-right-panel">
              <div className="overlay-panel-header">
                <span className="overlay-emoji-title">{ov.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{ov.name}</span>
                <span style={{ fontSize: 12, color: "var(--rs-text-muted)", flex: 1 }}>{ov.desc}</span>
                <button className="module-ghost-button" onClick={() => navigator.clipboard.writeText(ov.url)}>
                  <UIIcon name="copy" size={14} /> Copiar URL
                </button>
                <button className="module-green-button">
                  <UIIcon name="check" size={14} /> Guardar config
                </button>
              </div>

              <div className="overlay-content-split">
                {/* Vista previa */}
                <div className="overlay-preview-area">
                  <div className="overlay-preview-label">
                    <span>VISTA PREVIA (datos de ejemplo)</span>
                    <span style={{ fontSize: 10, color: "var(--rs-text-muted)" }}>Animación real en OBS durante el LIVE</span>
                  </div>
                  <div className="overlay-preview-canvas">
                    {ov.id === "timer"     && <TimerPreview />}
                    {ov.id === "donors"    && <DonorsPreview />}
                    {ov.id === "tappers"   && <TappersPreview />}
                    {ov.id === "best-gift" && <BestGiftPreview />}
                    {ov.id === "likes"     && <LikesPreview />}
                    {ov.id === "jar"       && <JarPreview />}
                  </div>
                </div>

                {/* Configuración */}
                <div className="overlay-settings-panel">
                  <section className="module-section">
                    <div className="module-section-title">CONFIGURACIÓN</div>
                    <OverlaySettings overlay={ov} />
                  </section>

                  <section className="module-section">
                    <div className="module-section-title">URL PARA TIKTOK STUDIO</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div className="overlay-url-box" style={{ flex: 1 }}>{ov.url}</div>
                      <button className="module-ghost-button" onClick={() => navigator.clipboard.writeText(ov.url)}>
                        <UIIcon name="copy" size={14} /> Copiar
                      </button>
                    </div>
                    <p className="module-help" style={{ marginTop: 6 }}>
                      En TikTok Studio → <span style={{ color: "var(--rs-green)" }}>Escena → Fuente → Navegador → URL</span>.
                      También funciona en OBS Studio → Sources → Browser Source.
                    </p>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OverlaySettings({ overlay }: { overlay: OverlayConfig }) {
  const [settings, setSettings] = useState(overlay.settings);

  function update(key: string, value: unknown) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (overlay.id === "timer") {
    return (
      <div className="overlay-settings-fields">
        <SettingField label="Tiempo inicial (seg)" frozen>
          <input type="number" className="module-input" value={settings["initialSeconds"] as number}
            onChange={(e) => update("initialSeconds", Number(e.target.value))} />
        </SettingField>
        <SettingField label="Coins por segundo" frozen>
          <input type="number" className="module-input" value={settings["coinsPerSecond"] as number}
            onChange={(e) => update("coinsPerSecond", Number(e.target.value))} />
        </SettingField>
        <SettingField label="Reactivar al llegar a cero" frozen>
          <span
            role="switch"
            aria-checked={settings["reactivateOnZero"] as boolean}
            className={`module-toggle ${settings["reactivateOnZero"] ? "on" : ""}`}
            style={{ cursor: "pointer" }}
            onClick={() => update("reactivateOnZero", !settings["reactivateOnZero"])}
          >
            <span />
          </span>
        </SettingField>
      </div>
    );
  }

  if (overlay.id === "donors" || overlay.id === "tappers") {
    return (
      <div className="overlay-settings-fields">
        <SettingField label="Cantidad en el ranking (Top N)">
          <select className="module-input" value={settings["topN"] as number}
            onChange={(e) => update("topN", Number(e.target.value))}>
            {[2, 3, 5, 10, 20].map((n) => <option key={n} value={n}>Top {n}</option>)}
          </select>
        </SettingField>
      </div>
    );
  }

  if (overlay.id === "likes") {
    return (
      <div className="overlay-settings-fields">
        <SettingField label="Cooldown por usuario (ms)">
          <input type="number" className="module-input" value={settings["cooldownPerUserMs"] as number}
            onChange={(e) => update("cooldownPerUserMs", Number(e.target.value))} />
        </SettingField>
      </div>
    );
  }

  if (overlay.id === "jar") {
    return (
      <div className="overlay-settings-fields">
        <SettingField label="Máximo de regalos en el frasco">
          <input type="number" className="module-input" value={settings["maxGifts"] as number}
            onChange={(e) => update("maxGifts", Number(e.target.value))} />
        </SettingField>
      </div>
    );
  }

  return <p className="module-help">Sin configuración adicional para este overlay.</p>;
}

function SettingField({ label, frozen, children }: { label: string; frozen?: boolean; children: React.ReactNode }) {
  return (
    <div className="overlay-setting-field">
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "var(--rs-text-secondary)" }}>{label}</span>
        {frozen && <span className="frozen-badge">Congelado en LIVE</span>}
      </div>
      {children}
    </div>
  );
}
