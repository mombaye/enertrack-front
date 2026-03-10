// src/features/coming-soon/ComingSoonPage.tsx
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface ComingSoonPageProps {
  moduleName: string;
  description?: string;
  icon?: React.ReactNode;
}

// ── Particle canvas ─────────────────────────────────────────────────────────
function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 38 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.4,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.4 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}

// ── Animated ring ────────────────────────────────────────────────────────────
function Ring({ delay = 0, size = 200, opacity = 0.06 }: {
  delay?: number; size?: number; opacity?: number;
}) {
  return (
    <div style={{
      position: "absolute",
      width: size, height: size,
      borderRadius: "50%",
      border: "1px solid rgba(255,255,255,0.15)",
      top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      animation: `ping ${2.5 + delay}s ease-out infinite`,
      animationDelay: `${delay}s`,
      opacity,
      pointerEvents: "none",
    }}/>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ComingSoonPage({
  moduleName,
  description,
  icon,
}: ComingSoonPageProps) {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(150deg, #0f1f54 0%, #162d6e 40%, #1a1040 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      fontFamily: "'Outfit', 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @keyframes ping {
          0%   { transform: translate(-50%, -50%) scale(1); opacity: 0.15; }
          100% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
      `}</style>

      {/* Particles */}
      <ParticleCanvas />

      {/* Blurred glow blobs */}
      <div style={{
        position: "absolute", top: "15%", left: "20%",
        width: 320, height: 320, borderRadius: "50%",
        background: "rgba(232,64,28,0.08)", filter: "blur(80px)",
        pointerEvents: "none",
      }}/>
      <div style={{
        position: "absolute", bottom: "20%", right: "15%",
        width: 260, height: 260, borderRadius: "50%",
        background: "rgba(30,58,138,0.25)", filter: "blur(70px)",
        pointerEvents: "none",
      }}/>

      {/* Rings */}
      <Ring delay={0}   size={160} />
      <Ring delay={0.8} size={240} />
      <Ring delay={1.6} size={320} />

      {/* Card */}
      <div style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
        animation: "fadeUp .6s ease both",
        padding: "0 24px",
        maxWidth: 520,
        width: "100%",
        textAlign: "center",
      }}>

        {/* Icon container */}
        <div style={{
          animation: "float 3.5s ease-in-out infinite",
        }}>
          <div style={{
            width: 88, height: 88, borderRadius: 24,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(10px)",
            display: "grid", placeItems: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
            fontSize: 38,
          }}>
            {icon ?? "🔧"}
          </div>
        </div>

        {/* Badge */}
        <div style={{
          padding: "5px 14px", borderRadius: 100,
          background: "rgba(232,64,28,0.15)",
          border: "1px solid rgba(232,64,28,0.3)",
          fontSize: 10.5, fontWeight: 700,
          letterSpacing: ".14em", textTransform: "uppercase",
          color: "#ff7a5c",
          animation: "fadeUp .6s .1s ease both",
          opacity: 0,
        }}>
          En cours de développement
        </div>

        {/* Title */}
        <div style={{ animation: "fadeUp .6s .2s ease both", opacity: 0 }}>
          <h1 style={{
            margin: 0,
            fontSize: "clamp(28px, 5vw, 42px)",
            fontWeight: 800,
            letterSpacing: "-.03em",
            lineHeight: 1.1,
            background: "linear-gradient(135deg, #ffffff 30%, rgba(255,255,255,0.55) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            {moduleName}
          </h1>
        </div>

        {/* Description */}
        <p style={{
          margin: 0,
          fontSize: 15,
          color: "rgba(255,255,255,0.45)",
          lineHeight: 1.65,
          fontWeight: 400,
          animation: "fadeUp .6s .3s ease both",
          opacity: 0,
        }}>
          {description ?? `Le module ${moduleName} est en cours de développement et sera disponible très prochainement. Revenez bientôt !`}
        </p>

        {/* Divider */}
        <div style={{
          width: 48, height: 2, borderRadius: 2,
          background: "linear-gradient(90deg, transparent, rgba(232,64,28,0.6), transparent)",
          animation: "fadeUp .6s .35s ease both",
          opacity: 0,
        }}/>

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 22px", borderRadius: 12,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.7)",
            fontSize: 13.5, fontWeight: 600,
            cursor: "pointer",
            transition: "all .18s",
            animation: "fadeUp .6s .4s ease both",
            opacity: 0,
            letterSpacing: "-.01em",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(255,255,255,0.12)";
            e.currentTarget.style.color      = "rgba(255,255,255,0.95)";
            e.currentTarget.style.transform  = "translateY(-1px)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(255,255,255,0.07)";
            e.currentTarget.style.color      = "rgba(255,255,255,0.7)";
            e.currentTarget.style.transform  = "translateY(0)";
          }}
        >
          <ArrowLeft size={15} />
          Retour
        </button>
      </div>

      {/* Bottom watermark */}
      <div style={{
        position: "absolute", bottom: 24,
        fontSize: 11, color: "rgba(255,255,255,0.15)",
        letterSpacing: ".06em", fontWeight: 500,
        zIndex: 10,
      }}>
        EnerTrack · Camusat
      </div>
    </div>
  );
}