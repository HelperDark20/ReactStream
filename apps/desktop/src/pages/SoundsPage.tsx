import { useState } from "react";
import GiftPickerModal, { type GiftItem } from "../components/GiftPickerModal";

const TRIGGERS = [
  { id: "none", icon: "—", label: "Sin trigger" },
  { id: "gift", icon: "🎁", label: "Regalo específico" },
  { id: "like", icon: "❤️", label: "Likes" },
  { id: "follow", icon: "➕", label: "Nuevo follow" },
  { id: "comment", icon: "💬", label: "Comentario" },
  { id: "share", icon: "🔗", label: "Compartida" },
  { id: "member", icon: "👤", label: "Nuevo miembro" },
  { id: "superfan", icon: "⭐", label: "Super Fan" },
];

interface Sound {
  id: string;
  name: string;
  filename: string;
  volume: number;
  enabled: boolean;
  trigger: string;
  giftFilter: string;
}

const MOCK: Sound[] = [
  { id: "1", name: "Bienvenida", filename: "welcome.mp3", volume: 80, enabled: true, trigger: "follow", giftFilter: "" },
  { id: "2", name: "Rosa especial", filename: "rose_special.mp3", volume: 90, enabled: true, trigger: "gift", giftFilter: "Rosa" },
  { id: "3", name: "León épico", filename: "lion_epic.mp3", volume: 100, enabled: true, trigger: "gift", giftFilter: "León" },
  { id: "4", name: "Mega likes", filename: "mega_likes.mp3", volume: 75, enabled: false, trigger: "like", giftFilter: "" },
];

export default function SoundsPage() {
  const [sounds, setSounds] = useState<Sound[]>(MOCK);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [showGiftPicker, setShowGiftPicker] = useState(false);

  const cfg = sounds.find((s) => s.id === selected);

  function update(patch: Partial<Sound>) {
    setSounds((prev) => prev.map((s) => s.id === selected ? { ...s, ...patch } : s));
  }

  function toggleEnabled(id: string) {
    setSounds((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }

  function previewSound(id: string) {
    setPlaying(id);
    setTimeout(() => setPlaying(null), 2000);
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Lista izquierda */}
      <div style={{ width: 280, borderRight: "1px solid var(--rs-border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--rs-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--rs-text-secondary)", letterSpacing: "0.08em" }}>SONIDOS</span>
          <button className="btn-green" style={{ padding: "4px 10px", fontSize: 11 }}>+ Importar MP3</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {sounds.map((s) => {
            const trig = TRIGGERS.find((t) => t.id === s.trigger);
            const isSelected = selected === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setSelected(s.id)}
                style={{
                  padding: "10px 12px",
                  background: isSelected ? "rgba(57,255,20,0.08)" : "rgba(12,16,14,0.72)",
                  border: `1px solid ${isSelected ? "var(--rs-border-green)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 10, cursor: "pointer", opacity: s.enabled ? 1 : 0.5,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Preview button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); previewSound(s.id); }}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
                      background: playing === s.id ? "var(--rs-green)" : "rgba(57,255,20,0.1)",
                      color: playing === s.id ? "#000" : "var(--rs-green)", fontSize: 11,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {playing === s.id ? "▐▐" : "▶"}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--rs-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: "var(--rs-text-muted)", fontFamily: "monospace" }}>{s.filename}</div>
                  </div>
                  {/* Toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleEnabled(s.id); }}
                    style={{ width: 30, height: 17, borderRadius: 9, border: "none", cursor: "pointer", background: s.enabled ? "var(--rs-green)" : "#333", flexShrink: 0 }}
                  />
                </div>
                {s.trigger !== "none" && (
                  <div style={{ fontSize: 11, color: "var(--rs-text-muted)", marginTop: 4, marginLeft: 36 }}>
                    {trig?.icon} {trig?.label}{s.giftFilter ? ` · ${s.giftFilter}` : ""} · {s.volume}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel derecho */}
      {!cfg ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 40 }}>♪</span>
          <span style={{ color: "var(--rs-text-muted)", fontSize: 14 }}>Selecciona un sonido para configurarlo</span>
          <span style={{ fontSize: 12, color: "var(--rs-text-muted)" }}>Máximo 5 sonidos simultáneos · MP3 únicamente</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>

          <Section title="Nombre">
            <input value={cfg.name} onChange={(e) => update({ name: e.target.value })} style={{ width: "100%" }} />
          </Section>

          <Section title="Archivo">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1, padding: "7px 12px", background: "var(--rs-bg-input)", border: "1px solid var(--rs-border)", borderRadius: 8, fontFamily: "monospace", fontSize: 12, color: "var(--rs-text-secondary)" }}>
                {cfg.filename}
              </div>
              <button className="btn-ghost" style={{ fontSize: 12 }}>Cambiar</button>
            </div>
          </Section>

          <Section title="Volumen">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 16 }}>🔇</span>
              <input
                type="range" min={0} max={100} value={cfg.volume}
                onChange={(e) => update({ volume: Number(e.target.value) })}
                style={{ flex: 1, accentColor: "var(--rs-green)" }}
              />
              <span style={{ fontSize: 16 }}>🔊</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--rs-green)", width: 38, textAlign: "right" }}>{cfg.volume}%</span>
            </div>
          </Section>

          <Section title="Reproducción de prueba">
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", background: "rgba(5,7,6,0.9)", border: "1px solid var(--rs-border)", borderRadius: 10 }}>
              <button
                onClick={() => previewSound(cfg.id)}
                style={{
                  width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: playing === cfg.id ? "var(--rs-green)" : "rgba(57,255,20,0.1)",
                  color: playing === cfg.id ? "#000" : "var(--rs-green)", fontSize: 18,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                {playing === cfg.id ? "▐▐" : "▶"}
              </button>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{cfg.name}</div>
                <div style={{ fontSize: 12, color: "var(--rs-text-secondary)" }}>
                  {playing === cfg.id ? "Reproduciendo..." : `Volumen: ${cfg.volume}%`}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Trigger — cuándo suena este sonido">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {TRIGGERS.map((t) => (
                <button key={t.id} onClick={() => update({ trigger: t.id, giftFilter: "" })} style={{
                  padding: "6px 12px", borderRadius: 8,
                  border: `1px solid ${cfg.trigger === t.id ? "var(--rs-border-green)" : "var(--rs-border)"}`,
                  background: cfg.trigger === t.id ? "rgba(57,255,20,0.08)" : "transparent",
                  color: cfg.trigger === t.id ? "var(--rs-green)" : "var(--rs-text-secondary)",
                  cursor: "pointer", fontSize: 12, fontWeight: cfg.trigger === t.id ? 700 : 400,
                }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {cfg.trigger === "gift" && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: "var(--rs-text-secondary)", marginBottom: 6 }}>
                  Filtro de regalo
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <div
                    onClick={() => setShowGiftPicker(true)}
                    style={{ flex:1, padding:"8px 12px", background:"rgba(5,7,6,0.9)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:13, color: cfg.giftFilter ? "#fff" : "rgba(255,255,255,0.3)", cursor:"pointer" }}
                  >
                    {cfg.giftFilter || "Seleccionar regalo..."}
                  </div>
                  {cfg.giftFilter && (
                    <button className="btn-ghost" style={{ fontSize:12, padding:"6px 10px", color:"#ef4444", borderColor:"rgba(239,68,68,0.3)" }}
                      onClick={() => update({ giftFilter: "" })}>
                      ✕
                    </button>
                  )}
                  <button className="btn-green" style={{ fontSize:12, padding:"7px 14px" }}
                    onClick={() => setShowGiftPicker(true)}>
                    🎁 Elegir
                  </button>
                </div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:5 }}>
                  Vacío = suena con cualquier regalo
                </div>
                {showGiftPicker && (
                  <GiftPickerModal
                    selectedId={cfg.giftFilter}
                    onSelect={(gift: GiftItem) => { update({ giftFilter: gift.id }); setShowGiftPicker(false); }}
                    onClose={() => setShowGiftPicker(false)}
                  />
                )}
              </div>
            )}
            {cfg.trigger === "none" && (
              <div style={{ fontSize: 12, color: "var(--rs-text-muted)", padding: "8px 12px", background: "rgba(5,7,6,0.6)", borderRadius: 8 }}>
                Este sonido solo se reproducirá manualmente o desde el editor de automatizaciones.
              </div>
            )}
          </Section>

          <Section title="Estado">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => update({ enabled: !cfg.enabled })}
                style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: cfg.enabled ? "var(--rs-green)" : "#333", transition: "background 0.2s" }}
              />
              <span style={{ fontSize: 13, color: cfg.enabled ? "var(--rs-green)" : "var(--rs-text-muted)" }}>
                {cfg.enabled ? "Activo — suena cuando se dispara el trigger" : "Desactivado — no suena aunque se dispare"}
              </span>
            </div>
          </Section>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button className="btn-ghost" style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}>Eliminar</button>
            <button className="btn-green">Guardar cambios</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--rs-text-muted)", letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" }}>
        {title}
      </div>
      {children}
    </div>
  );
}
