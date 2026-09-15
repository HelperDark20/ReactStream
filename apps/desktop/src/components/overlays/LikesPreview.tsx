import { useEffect, useState } from "react";

interface Heart { id: number; left: number; name: string; }

export default function LikesPreview() {
  const [hearts, setHearts] = useState<Heart[]>([]);

  useEffect(() => {
    const names = ["carlos", "sofia", "pedro", "lucia", "diego"];
    let id = 0;
    const interval = setInterval(() => {
      setHearts((prev) => [
        ...prev.slice(-8),
        {
          id: id++,
          left: 15 + Math.random() * 70,
          name: names[Math.floor(Math.random() * names.length)] ?? "user",
        },
      ]);
    }, 700);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width:"100%", height:"100%", background:"transparent", position:"relative", overflow:"hidden" }}>
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1);        opacity: 1; }
          100% { transform: translateY(-120px) scale(0.5); opacity: 0; }
        }
      `}</style>
      {hearts.map((h) => (
        <div key={h.id} style={{ position:"absolute", bottom:"15%", left:`${h.left}%`, animation:"floatUp 2.5s ease-out forwards", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(244,114,182,0.2)", border:"2px solid #f472b6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
            ❤️
          </div>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.6)", whiteSpace:"nowrap" }}>{h.name}</span>
        </div>
      ))}
    </div>
  );
}
