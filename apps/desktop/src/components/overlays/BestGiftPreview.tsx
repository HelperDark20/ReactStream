export default function BestGiftPreview() {
  return (
    <div style={{ width:"100%", height:"100%", background:"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, background:"rgba(0,0,0,0.75)", border:"1px solid rgba(245,158,11,0.4)", borderRadius:14, padding:"12px 20px", boxShadow:"0 0 20px rgba(245,158,11,0.15)" }}>
        <div style={{ width:56, height:56, borderRadius:10, background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>
          🦁
        </div>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:"#fff" }}>León</div>
          <div style={{ fontSize:15, color:"#f59e0b", fontWeight:700 }}>29,999 🪙</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginTop:2 }}>de alice_live</div>
        </div>
      </div>
    </div>
  );
}
