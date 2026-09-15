import { useState, useMemo, useEffect } from "react";

// Intentar importar invoke de Tauri (no disponible en dev browser)
let tauriInvoke: ((cmd: string) => Promise<unknown>) | null = null;
try {
  // @ts-ignore
  const tauri = await import("@tauri-apps/api/core");
  tauriInvoke = tauri.invoke;
} catch {
  tauriInvoke = null;
}

export interface GiftItem {
  id: string;
  name: string;
  coins: number;
  imageUrl?: string;
  region: string;
}

// Catálogo completo de regalos Colombia (seed de la Etapa 6)
export const GIFT_CATALOG: GiftItem[] = [
  { id:"7445", name:"Taza de café",         coins:1,     region:"CO" },
  { id:"6861", name:"Helado",               coins:1,     region:"CO" },
  { id:"6268", name:"Palomitas",            coins:1,     region:"CO" },
  { id:"5655", name:"Rosa",                 coins:1,     region:"CO" },
  { id:"6480", name:"Dedo pulgar",          coins:1,     region:"CO" },
  { id:"5657", name:"TikTok",              coins:1,     region:"CO" },
  { id:"6136", name:"Corazón me encanta",  coins:1,     region:"CO" },
  { id:"7022", name:"Osito abrazable",      coins:1,     region:"CO" },
  { id:"5888", name:"Manos de amor",        coins:5,     region:"CO" },
  { id:"6140", name:"Corazones rosas",      coins:5,     region:"CO" },
  { id:"6741", name:"Teléfono inteligente", coins:5,     region:"CO" },
  { id:"6488", name:"Globos de corazón",   coins:10,    region:"CO" },
  { id:"7333", name:"Chispa mágica",       coins:10,    region:"CO" },
  { id:"5904", name:"Perfume",              coins:20,    region:"CO" },
  { id:"7191", name:"Cohete espacial",      coins:20,    region:"CO" },
  { id:"6139", name:"Micrófono",           coins:25,    region:"CO" },
  { id:"7004", name:"Casco de fútbol",     coins:25,    region:"CO" },
  { id:"6748", name:"Coche deportivo",      coins:50,    region:"CO" },
  { id:"6407", name:"Trofeo",              coins:50,    region:"CO" },
  { id:"5662", name:"Palmas",              coins:99,    region:"CO" },
  { id:"7399", name:"Bombas de confeti",    coins:100,   region:"CO" },
  { id:"7221", name:"Casco americano",      coins:68,    region:"CO" },
  { id:"6738", name:"Micrófono de rap",    coins:88,    region:"CO" },
  { id:"7131", name:"Diadema gamer",        coins:155,   region:"CO" },
  { id:"6837", name:"Patineta",            coins:155,   region:"CO" },
  { id:"7219", name:"Pesas",               coins:198,   region:"CO" },
  { id:"7300", name:"Planeta",             coins:299,   region:"CO" },
  { id:"7406", name:"Bomba de fuego",       coins:299,   region:"CO" },
  { id:"6209", name:"Micrófono dorado",    coins:500,   region:"CO" },
  { id:"7128", name:"Corona de rey",        coins:500,   region:"CO" },
  { id:"7401", name:"Dragón volador",      coins:500,   region:"CO" },
  { id:"6383", name:"Barco pirata",         coins:1000,  region:"CO" },
  { id:"7411", name:"Universo",            coins:1000,  region:"CO" },
  { id:"7319", name:"Tormenta de nieve",    coins:1999,  region:"CO" },
  { id:"6492", name:"Fuegos artificiales",  coins:1999,  region:"CO" },
  { id:"7025", name:"Montaña rusa",        coins:3000,  region:"CO" },
  { id:"7296", name:"Ola del océano",      coins:3000,  region:"CO" },
  { id:"7103", name:"Ciudad nocturna",      coins:5000,  region:"CO" },
  { id:"6990", name:"Fénix",              coins:5000,  region:"CO" },
  { id:"7382", name:"Cohete interestelar",  coins:9999,  region:"CO" },
  { id:"7416", name:"Galaxia explosiva",    coins:9999,  region:"CO" },
  { id:"7130", name:"Avión privado",       coins:9999,  region:"CO" },
  { id:"7417", name:"Palacio dorado",       coins:9999,  region:"CO" },
  { id:"6216", name:"León",               coins:29999, region:"CO" },
  { id:"7389", name:"León dorado",        coins:29999, region:"CO" },
];

const COIN_RANGES = [
  { label:"Todos",          min:0,     max:999999 },
  { label:"1 – 9 🪙",       min:1,     max:9 },
  { label:"10 – 99 🪙",     min:10,    max:99 },
  { label:"100 – 499 🪙",   min:100,   max:499 },
  { label:"500 – 999 🪙",   min:500,   max:999 },
  { label:"1,000 – 9,999 🪙",min:1000,  max:9999 },
  { label:"10,000+ 🪙",     min:10000, max:999999 },
];

function coinColor(coins: number): string {
  if (coins >= 10000) return "#f59e0b";
  if (coins >= 1000)  return "#818cf8";
  if (coins >= 100)   return "#34d399";
  if (coins >= 10)    return "#60a5fa";
  return "#f472b6";
}

function GiftImage({ gift }: { gift: GiftItem }) {
  const [errored, setErrored] = useState(false);
  // Usar imageUrl del catálogo real (viene del Bridge) si está disponible
  const url = gift.imageUrl ?? null;
  if (!url || errored) {
    return (
      <div style={{ width:48, height:48, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(57,255,20,0.05)", borderRadius:8, fontSize:11, color:"rgba(255,255,255,0.2)", fontFamily:"monospace" }}>
        {gift.id}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={gift.name}
      width={48}
      height={48}
      style={{ objectFit:"contain", borderRadius:4 }}
      onError={() => setErrored(true)}
    />
  );
}

interface GiftPickerModalProps {
  onSelect: (gift: GiftItem) => void;
  onClose: () => void;
  selectedId?: string;
}

export default function GiftPickerModal({ onSelect, onClose, selectedId }: GiftPickerModalProps) {
  const [search, setSearch] = useState("");
  const [rangeIdx, setRangeIdx] = useState(0);
  const [catalog, setCatalog] = useState<GiftItem[]>(GIFT_CATALOG);
  const [loading, setLoading] = useState(false);

  // Intentar cargar el catálogo real desde Tauri (disponible tras conectarse a TikTok)
  useEffect(() => {
    if (!tauriInvoke) return;
    setLoading(true);
    tauriInvoke("get_gift_catalog")
      .then((items) => {
        const typed = items as Array<{ id: string; name: string; coins: number; imageUrl?: string }>;
        if (typed && typed.length > 0) {
          setCatalog(typed.map((g) => ({
            id: g.id,
            name: g.name,
            coins: g.coins,
            imageUrl: g.imageUrl,
            region: "CO",
          })));
        }
      })
      .catch(() => {}) // fallback al catálogo estático
      .finally(() => setLoading(false));
  }, []);

  const range = COIN_RANGES[rangeIdx] ?? COIN_RANGES[0]!;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return catalog.filter((g) => {
      const matchSearch = !q || g.name.toLowerCase().includes(q) || g.id.includes(q);
      const matchRange  = g.coins >= range.min && g.coins <= range.max;
      return matchSearch && matchRange;
    }).sort((a, b) => a.coins - b.coins);
  }, [search, rangeIdx, catalog]);

  return (
    <div
      onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width:580, maxHeight:"80vh", background:"#141414", border:"1px solid rgba(57,255,20,0.25)", borderRadius:14, display:"flex", flexDirection:"column", overflow:"hidden" }}
      >
        {/* Header */}
        <div style={{ padding:"14px 18px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700 }}>Seleccionar Regalo</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
              {loading ? "Cargando catálogo..." : `${filtered.length} regalos · ${catalog === GIFT_CATALOG ? "catálogo base (conecta TikTok para ver todos)" : "catálogo sincronizado con TikTok ✓"}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.5)", cursor:"pointer", fontSize:20, lineHeight:1, padding:4 }}>×</button>
        </div>

        {/* Search + Filtro */}
        <div style={{ padding:"12px 18px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", gap:10, flexShrink:0 }}>
          <div style={{ flex:1, position:"relative" }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"rgba(255,255,255,0.3)" }}>🔍</span>
            <input
              autoFocus
              type="text"
              placeholder="Buscar por nombre o ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width:"100%", paddingLeft:34, background:"#0a0a0a", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#fff", fontSize:13, padding:"8px 10px 8px 34px" }}
            />
          </div>
          <select
            value={rangeIdx}
            onChange={(e) => setRangeIdx(Number(e.target.value))}
            style={{ background:"#0a0a0a", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#fff", fontSize:12, padding:"8px 10px", cursor:"pointer", flexShrink:0 }}
          >
            {COIN_RANGES.map((r, i) => (
              <option key={i} value={i}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Grid de regalos */}
        <div style={{ flex:1, overflowY:"auto", padding:12, display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8 }}>
          {filtered.length === 0 && (
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:32, color:"rgba(255,255,255,0.3)", fontSize:13 }}>
              No se encontraron regalos con esos criterios
            </div>
          )}
          {filtered.map((gift) => {
            const isSelected = gift.id === selectedId;
            return (
              <button
                key={gift.id}
                onClick={() => { onSelect(gift); onClose(); }}
                style={{
                  background: isSelected ? "rgba(57,255,20,0.1)" : "rgba(255,255,255,0.03)",
                  border:`1px solid ${isSelected ? "rgba(57,255,20,0.5)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius:10, padding:"10px 8px", cursor:"pointer",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                  transition:"all 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(57,255,20,0.2)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)";
                  }
                }}
              >
                <GiftImage gift={gift} />
                <div style={{ fontSize:11, fontWeight:600, color:"#fff", textAlign:"center", lineHeight:1.3, wordBreak:"break-word" }}>
                  {gift.name}
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:coinColor(gift.coins) }}>
                  {gift.coins.toLocaleString()} 🪙
                </div>
                {isSelected && (
                  <div style={{ fontSize:9, color:"var(--rs-green)", fontWeight:700, letterSpacing:"0.05em" }}>SELECCIONADO</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
