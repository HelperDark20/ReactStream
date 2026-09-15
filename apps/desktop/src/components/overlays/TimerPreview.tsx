export default function TimerPreview() {
  return (
    <div style={{ width:"100%", height:"100%", background:"#000", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
      <div style={{ fontSize:64, fontWeight:700, color:"#fff", letterSpacing:4, textShadow:"0 0 20px rgba(57,255,20,0.5)", fontFamily:"monospace" }}>
        03:47
      </div>
      <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", letterSpacing:2 }}>
        10 COINS = 1 SEGUNDO
      </div>
      <div style={{ width:200, height:4, background:"rgba(255,255,255,0.1)", borderRadius:2, marginTop:8, overflow:"hidden" }}>
        <div style={{ width:"62%", height:"100%", background:"var(--rs-green)", borderRadius:2, boxShadow:"0 0 8px var(--rs-green)" }} />
      </div>
    </div>
  );
}
