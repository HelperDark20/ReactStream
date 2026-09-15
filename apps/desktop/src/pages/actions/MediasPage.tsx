import { useState } from "react";
import GiftPickerModal, { type GiftItem } from "../../components/GiftPickerModal";

const TRIGGERS = [
  { id: "gift", icon: "🎁", label: "Regalo" },
  { id: "like", icon: "❤️", label: "Like" },
  { id: "follow", icon: "➕", label: "Follow" },
  { id: "comment", icon: "💬", label: "Comentario" },
  { id: "share", icon: "🔗", label: "Compartida" },
  { id: "member", icon: "👤", label: "Nuevo miembro" },
  { id: "superfan", icon: "⭐", label: "Super Fan" },
];

type MediaType = "image" | "audio" | "animation" | "gift_overlay";

interface MediaAction {
  id: string;
  name: string;
  trigger: string;
  giftFilter: string;
  mediaType: MediaType;
  url: string;
  durationMs: number;
  enabled: boolean;
}

const MOCK: MediaAction[] = [
  { id: "m1", name: "Explosión Rosa", trigger: "gift", giftFilter: "Rosa", mediaType: "animation", url: "http://127.0.0.1:47821/overlay/effects/rose-explosion", durationMs: 3000, enabled: true },
  { id: "m2", name: "Foto León", trigger: "gift", giftFilter: "León", mediaType: "image", url: "http://127.0.0.1:47821/overlay/effects/lion-image", durationMs: 5000, enabled: true },
  { id: "m3", name: "Confetti Follow", trigger: "follow", giftFilter: "", mediaType: "animation", url: "http://127.0.0.1:47821/overlay/effects/confetti", durationMs: 2000, enabled: false },
];

const MEDIA_ICONS: Record<MediaType, string> = {
  image: "🖼",
  audio: "🔊",
  animation: "✨",
  gift_overlay: "🎁",
};

const MEDIA_LABELS: Record<MediaType, string> = {
  image: "Imagen",
  audio: "Audio",
  animation: "Animación",
  gift_overlay: "Overlay de regalo",
};

export default function MediasPage() {
  const [medias, setMedias] = useState<MediaAction[]>(MOCK);
  const [selected, setSelected] = useState<string | null>(MOCK[0]?.id ?? null);
  const [showGiftPicker, setShowGiftPicker] = useState(false);

  const cfg = medias.find((m) => m.id === selected);

  function updateCfg(patch: Partial<MediaAction>) {
    setMedias((prev) => prev.map((m) => m.id === selected ? { ...m, ...patch } : m));
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).catch(() => {});
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Lista izquierda */}
      <div style={{ width: 260, borderRight: "1px solid var(--rs-border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--rs-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--rs-text-secondary)", letterSpacing: "0.08em" }}>MEDIOS Y OVERLAYS</span>
          <button className="btn-green" style={{ padding: "4px 10px", fontSize: 11 }}>+ Nuevo</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {medias.map((m) => {
            const trig = TRIGGERS.find((t) => t.id === m.trigger);
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                style={{
                  width: "100%", textAlign: "left", padding: "10px 12px",
                  background: selected === m.id ? "rgba(57,255,20,0.08)" : "rgba(12,16,14,0.72)",
                  border: `1px solid ${selected === m.id ? "var(--rs-border-green)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 10, cursor: "pointer", opacity: m.enabled ? 1 : 0.5, transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 16 }}>{MEDIA_ICONS[m.mediaType]}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--rs-text-primary)", flex: 1 }}>{m.name}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--rs-text-muted)" }}>
                  {trig?.icon} {trig?.label} · {MEDIA_LABELS[m.mediaType]} · {m.durationMs / 1000}s
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel derecho */}
      {!cfg ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 32 }}>🎬</span>
          <span style={{ color: "var(--rs-text-muted)", fontSize: 14 }}>Selecciona un medio para editarlo</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>

          <Section title="Nombre">
            <input value={cfg.name} onChange={(e) => updateCfg({ name: e.target.value })} style={{ width: "100%" }} />
          </Section>

          <Section title="Trigger">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TRIGGERS.map((t) => (
                <button key={t.id} onClick={() => updateCfg({ trigger: t.id })} style={{
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
          </Section>

          {cfg.trigger === "gift" && (
            <Section title="Filtro de regalo">
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <div
                  onClick={() => setShowGiftPicker(true)}
                  style={{ flex:1, padding:"8px 12px", background:"rgba(5,7,6,0.9)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:13, color: cfg.giftFilter ? "#fff" : "rgba(255,255,255,0.3)", cursor:"pointer" }}
                >
                  {cfg.giftFilter || "Seleccionar regalo..."}
                </div>
                {cfg.giftFilter && (
                  <button className="btn-ghost" style={{ fontSize:12, padding:"6px 10px", color:"#ef4444", borderColor:"rgba(239,68,68,0.3)" }}
                    onClick={() => updateCfg({ giftFilter: "" })}>✕</button>
                )}
                <button className="btn-green" style={{ fontSize:12, padding:"7px 14px" }}
                  onClick={() => setShowGiftPicker(true)}>
                  🎁 Elegir
                </button>
              </div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:5 }}>
                Vacío = se activa con cualquier regalo
              </div>
              {showGiftPicker && (
                <GiftPickerModal
                  selectedId={cfg.giftFilter}
                  onSelect={(gift: GiftItem) => { updateCfg({ giftFilter: gift.id }); setShowGiftPicker(false); }}
                  onClose={() => setShowGiftPicker(false)}
                />
              )}
            </Section>
          )}

          <Section title="Tipo de medio">
            <div style={{ display: "flex", gap: 8 }}>
              {(Object.keys(MEDIA_ICONS) as MediaType[]).map((type) => (
                <button key={type} onClick={() => updateCfg({ mediaType: type })} style={{
                  padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                  border: `1px solid ${cfg.mediaType === type ? "var(--rs-border-green)" : "var(--rs-border)"}`,
                  background: cfg.mediaType === type ? "rgba(57,255,20,0.08)" : "transparent",
                  color: cfg.mediaType === type ? "var(--rs-green)" : "var(--rs-text-secondary)",
                  fontWeight: cfg.mediaType === type ? 700 : 400,
                }}>
                  {MEDIA_ICONS[type]} {MEDIA_LABELS[type]}
                </button>
              ))}
            </div>
          </Section>

          <Section title="URL del medio (Browser Source de OBS)">
            <div style={{ display: "flex", gap: 8 }}>
              <input value={cfg.url} onChange={(e) => updateCfg({ url: e.target.value })} style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }} placeholder="http://127.0.0.1:47821/overlay/..." />
              <button className="btn-ghost" onClick={() => copyUrl(cfg.url)}>📋 Copiar</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--rs-text-muted)", marginTop: 6 }}>
              Agrega esta URL como Browser Source en OBS. ReactStream enviará la señal cuando se dispare el trigger.
            </div>
          </Section>

          <Section title="Duración de visualización">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="number" min={500} max={30000} value={cfg.durationMs} onChange={(e) => updateCfg({ durationMs: Number(e.target.value) })} style={{ width: 100 }} />
              <span style={{ fontSize: 12, color: "var(--rs-text-secondary)" }}>ms ({cfg.durationMs / 1000}s)</span>
            </div>
          </Section>

          <Section title="Estado">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => updateCfg({ enabled: !cfg.enabled })}
                style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: cfg.enabled ? "var(--rs-green)" : "#333", position: "relative" }}
              />
              <span style={{ fontSize: 13, color: cfg.enabled ? "var(--rs-green)" : "var(--rs-text-muted)" }}>
                {cfg.enabled ? "Activo" : "Desactivado"}
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
