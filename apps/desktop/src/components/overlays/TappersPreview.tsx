const MOCK = [
  { rank:1, name:"carlos_x", likes:12840 },
  { rank:2, name:"sofia_m", likes:8200 },
  { rank:3, name:"pedro_g", likes:5100 },
  { rank:4, name:"lucia_v", likes:3200 },
  { rank:5, name:"diego_r", likes:1800 },
];

export default function TappersPreview() {
  return (
    <div style={{ width:"100%", height:"100%", background:"transparent", padding:12, display:"flex", flexDirection:"column", gap:6 }}>
      {MOCK.map((t) => (
        <div key={t.rank} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(0,0,0,0.7)", borderRadius:8, padding:"6px 10px", border:"1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#f472b6", width:20 }}>#{t.rank}</span>
          <div style={{ width:26, height:26, borderRadius:"50%", background:"rgba(244,114,182,0.15)", border:"1px solid rgba(244,114,182,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#f472b6", fontWeight:700 }}>
            {t.name[0]?.toUpperCase()}
          </div>
          <span style={{ flex:1, fontSize:13, color:"#fff", fontWeight:500 }}>{t.name}</span>
          <span style={{ fontSize:13, color:"#f472b6", fontWeight:700 }}>{t.likes.toLocaleString()} ❤️</span>
        </div>
      ))}
    </div>
  );
}
