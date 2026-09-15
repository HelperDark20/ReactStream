import { useEffect, useState } from "react";

interface Ball { id:number; left:number; size:number; color:string; bottom:number; }

const COLORS = ["#f59e0b","#39ff14","#f472b6","#818cf8","#34d399","#60a5fa"];

export default function JarPreview() {
  const [balls, setBalls] = useState<Ball[]>([]);
  let id = 0;

  useEffect(() => {
    const interval = setInterval(() => {
      const size = 10 + Math.random() * 22;
      setBalls((prev) => {
        const next = [...prev.slice(-18), {
          id: id++,
          left: 8 + Math.random() * 74,
          size,
          color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#39ff14",
          bottom: 5 + Math.random() * 55,
        }];
        return next;
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const fillPct = Math.min(balls.length * 5, 88);

  return (
    <div style={{ width:"100%", height:"100%", background:"transparent", display:"flex", alignItems:"flex-end", justifyContent:"center", paddingBottom:10 }}>
      <div style={{ position:"relative", width:110, height:170, border:"2px solid rgba(255,255,255,0.5)", borderTop:"none", borderRadius:"0 0 28px 28px", overflow:"hidden", background:"rgba(0,0,0,0.35)" }}>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${fillPct}%`, background:"linear-gradient(to top, rgba(57,255,20,0.18), transparent)", transition:"height 0.5s" }} />
        {balls.map((b) => (
          <div key={b.id} style={{ position:"absolute", left:`${b.left}%`, bottom:`${b.bottom}%`, width:b.size, height:b.size, borderRadius:"50%", background:b.color, boxShadow:`0 0 5px ${b.color}55`, transform:"translateX(-50%)", transition:"bottom 0.3s ease" }} />
        ))}
      </div>
    </div>
  );
}
