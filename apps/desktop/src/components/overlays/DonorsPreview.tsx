const MOCK = [
  { rank:1, name:"alice_live", coins:30499, color:"#f59e0b" },
  { rank:2, name:"bob_gamer", coins:10000, color:"#94a3b8" },
  { rank:3, name:"maria_r", coins:5821, color:"#b45309" },
  { rank:4, name:"juan_d", coins:2000, color:"rgba(255,255,255,0.5)" },
  { rank:5, name:"carlos_x", coins:890, color:"rgba(255,255,255,0.5)" },
];

export default function DonorsPreview() {
  return (
    <div style={{ width:"100%", height:"100%", background:"transparent", padding:12, display:"flex", flexDirection:"column", gap:6 }}>
      {MOCK.map((d) => (
        <div key={d.rank} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(0,0,0,0.7)", borderRadius:8, padding:"6px 10px", border:"1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ fontSize:13, fontWeight:700, color:d.color, width:20 }}>#{d.rank}</span>
          <div style={{ width:26, height:26, borderRadius:"50%", background:"rgba(57,255,20,0.15)", border:"1px solid rgba(57,255,20,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"var(--rs-green)", fontWeight:700 }}>
            {d.name[0]?.toUpperCase()}
          </div>
          <span style={{ flex:1, fontSize:13, color:"#fff", fontWeight:500 }}>{d.name}</span>
          <span style={{ fontSize:13, color:d.color, fontWeight:700 }}>{d.coins.toLocaleString()} 🪙</span>
        </div>
      ))}
    </div>
  );
}
