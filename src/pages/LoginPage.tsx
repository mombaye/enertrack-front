import { useMemo, useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Eye, EyeOff, ArrowRight, TrendingUp, ShieldCheck, Zap } from "lucide-react";

import camusatLogo from "@/assets/images/camusat-logo.png";
import { useAuth } from "@/auth/AuthContext";
import { authApi } from "@/services/api";

type FormValues = { username: string; password: string };

async function loginUser(u: string, p: string) {
  const res = await authApi.post("/auth/login/", { username: u, password: p });
  return res.data as { access: string; refresh: string };
}

// ─── Animated counter ──────────────────────────────────────────────────────────
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef(false);
  useEffect(() => {
    if (ref.current) return;
    ref.current = true;
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * to));
      if (p < 1) requestAnimationFrame(tick);
    };
    const timeout = setTimeout(() => requestAnimationFrame(tick), 600);
    return () => clearTimeout(timeout);
  }, [to]);
  return <>{val.toLocaleString("fr-FR")}{suffix}</>;
}

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [focusedField, setFocused] = useState<string | null>(null);

  const fromPath = useMemo(
    () => (location.state as any)?.from?.pathname || "/dashboard",
    [location.state]
  );

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { username: "", password: "" },
  });

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (d: FormValues) => {
    setLoading(true);
    try {
      const res = await loginUser(d.username, d.password);
      login(res.access, res.refresh);
      navigate(fromPath, { replace: true });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail || "Identifiants invalides.",
        { autoClose: 4000 }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

        :root {
          --blue:    #1e3a8a;
          --blue-md: #2d55b3;
          --orange:  #E8401C;
          --orange2: #ff6340;
          --white:   #ffffff;
          --off:     #f7f9ff;
          --slate:   #64748b;
          --light:   #e8eeff;
        }

        .lp { font-family: 'DM Sans', sans-serif; }
        .lp .display { font-family: 'Outfit', sans-serif; }

        /* ── entry animations ──────────────── */
        @keyframes revealLeft {
          from { opacity:0; transform:translateX(-32px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes revealUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes revealFade {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes float {
          0%,100% { transform:translateY(0) rotate(0deg); }
          33%      { transform:translateY(-8px) rotate(1deg); }
          66%      { transform:translateY(-4px) rotate(-0.5deg); }
        }
        @keyframes pulse-dot {
          0%,100% { box-shadow:0 0 0 0 rgba(16,185,129,.5); }
          50%      { box-shadow:0 0 0 6px rgba(16,185,129,0); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        @keyframes spin { to { transform:rotate(360deg); } }

        .rl1{animation:revealLeft .65s cubic-bezier(.22,1,.36,1) .00s both}
        .rl2{animation:revealLeft .65s cubic-bezier(.22,1,.36,1) .10s both}
        .rl3{animation:revealLeft .65s cubic-bezier(.22,1,.36,1) .20s both}
        .rl4{animation:revealLeft .65s cubic-bezier(.22,1,.36,1) .30s both}
        .rl5{animation:revealLeft .65s cubic-bezier(.22,1,.36,1) .40s both}

        .ru1{animation:revealUp .6s cubic-bezier(.22,1,.36,1) .05s both}
        .ru2{animation:revealUp .6s cubic-bezier(.22,1,.36,1) .15s both}
        .ru3{animation:revealUp .6s cubic-bezier(.22,1,.36,1) .25s both}
        .ru4{animation:revealUp .6s cubic-bezier(.22,1,.36,1) .35s both}
        .ru5{animation:revealUp .6s cubic-bezier(.22,1,.36,1) .45s both}
        .ru6{animation:revealUp .6s cubic-bezier(.22,1,.36,1) .55s both}

        /* ── left panel background ──────────── */
        .panel-left {
          background: var(--blue);
          position: relative;
          overflow: hidden;
        }
        /* Grid texture */
        .panel-left::before {
          content:'';
          position:absolute; inset:0;
          background-image:
            linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse 90% 90% at 30% 50%, black 30%, transparent 100%);
        }

        /* Diagonal right edge */
        .panel-left::after {
          content:'';
          position:absolute;
          top:0; right:-1px; bottom:0;
          width:80px;
          background:white;
          clip-path: polygon(80px 0, 80px 100%, 0 100%);
        }

        /* ── stat pill ──────────────────────── */
        .stat-pill {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 16px;
          padding: 18px 20px;
          transition: all .25s ease;
          cursor: default;
        }
        .stat-pill:hover {
          background: rgba(255,255,255,.10);
          border-color: rgba(255,255,255,.18);
          transform: translateY(-2px);
        }

        /* ── form inputs ───────────────────── */
        .field-wrap {
          position:relative;
        }
        .field-wrap label {
          display:block;
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: .04em;
          color: var(--slate);
          margin-bottom: 7px;
          text-transform: uppercase;
        }
        .field {
          width:100%;
          font-family:'DM Sans',sans-serif;
          font-size:14.5px;
          color: var(--blue);
          background: var(--off);
          border: 1.5px solid #dce5f5;
          border-radius: 12px;
          padding: 13px 16px;
          outline:none;
          transition: all .2s ease;
        }
        .field::placeholder { color:#aab4cc; }
        .field:focus {
          background:#fff;
          border-color: var(--blue);
          box-shadow: 0 0 0 4px rgba(30,58,138,.09);
        }
        .field.has-error {
          border-color:#f87171;
          box-shadow:0 0 0 4px rgba(248,113,113,.10);
        }
        .field-icon {
          position:absolute;
          right:14px; top:50%;
          transform:translateY(-50%);
          background:none; border:none;
          cursor:pointer; padding:4px;
          color:#aab4cc;
          transition:color .15s;
          line-height:0;
        }
        .field-icon:hover { color:var(--blue); }

        /* ── CTA button ─────────────────────── */
        .btn-connect {
          position:relative;
          width:100%;
          font-family:'Outfit',sans-serif;
          font-size:15px;
          font-weight:700;
          letter-spacing:.01em;
          color:white;
          background: var(--blue);
          border:none;
          border-radius:12px;
          padding:14px 20px;
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:9px;
          overflow:hidden;
          transition: background .2s, transform .15s, box-shadow .2s;
        }
        .btn-connect::before {
          content:'';
          position:absolute; inset:0;
          background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.12) 50%,transparent 60%);
          background-size:400px 100%;
          background-position:-400px 0;
          transition:none;
        }
        .btn-connect:not(:disabled):hover {
          background: #1e40af;
          transform:translateY(-1px);
          box-shadow:0 8px 28px rgba(30,58,138,.28);
        }
        .btn-connect:not(:disabled):hover::before {
          animation:shimmer .6s ease forwards;
        }
        .btn-connect:not(:disabled):active { transform:translateY(0); }
        .btn-connect:disabled { opacity:.55; cursor:not-allowed; }

        /* Orange accent button strip */
        .btn-connect .orange-strip {
          position:absolute;
          bottom:0; left:20%; right:20%; height:2px;
          background:linear-gradient(90deg,transparent,var(--orange),transparent);
          border-radius:2px;
          opacity:0;
          transition:opacity .2s;
        }
        .btn-connect:not(:disabled):hover .orange-strip { opacity:.6; }

        /* ── live dot ───────────────────────── */
        .live-dot {
          width:8px; height:8px;
          border-radius:50%;
          background:#10b981;
          animation:pulse-dot 2s ease-in-out infinite;
        }

        /* ── floating decorative card ────────── */
        .deco-card {
          background:rgba(255,255,255,.08);
          border:1px solid rgba(255,255,255,.12);
          border-radius:14px;
          padding:14px 16px;
          display:flex;
          align-items:center;
          gap:10px;
          animation:float 6s ease-in-out infinite;
        }

        .spin { animation:spin .8s linear infinite; }
      `}</style>

      <div className="lp" style={{
        minHeight:"100vh",
        display:"flex",
        background:"white",
      }}>

        {/* ══════════════════════════════════════════
            LEFT PANEL — Blue 900 + diagonal cut
        ══════════════════════════════════════════ */}
        <div
          className="panel-left hidden lg:flex flex-col"
          style={{ width:"50%", flexShrink:0 }}
        >
          {/* Orange top accent */}
          <div style={{
            position:"absolute", top:0, left:0, zIndex:10,
            width:"calc(50% - 40px)", height:3,
            background:"linear-gradient(90deg,var(--orange),var(--orange2),transparent)",
          }}/>

          {/* Glow blob */}
          <div style={{
            position:"absolute",
            bottom:-120, left:-80,
            width:400, height:400,
            borderRadius:"50%",
            background:"radial-gradient(circle,rgba(232,64,28,.18) 0%,transparent 70%)",
            pointerEvents:"none",
          }}/>
          <div style={{
            position:"absolute",
            top:80, right:60,
            width:200, height:200,
            borderRadius:"50%",
            background:"radial-gradient(circle,rgba(255,255,255,.05) 0%,transparent 70%)",
            pointerEvents:"none",
          }}/>

          <div style={{
            position:"relative", zIndex:1,
            display:"flex", flexDirection:"column",
            height:"100%",
            padding:"44px 52px 44px 52px",
          }}>

            {/* Logo */}
            <div className="rl1">
              <img
                src={camusatLogo}
                alt="Camusat"
                style={{
                  height:32, width:"auto",
                  filter:"brightness(0) invert(1)",
                  opacity:.9,
                }}
              />
            </div>

            {/* Main heading — vertical center */}
            <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", paddingRight:40 }}>

              {/* Orange badge */}
              <div className="rl2" style={{
                display:"inline-flex", alignItems:"center", gap:8,
                background:"rgba(232,64,28,.15)",
                border:"1px solid rgba(232,64,28,.3)",
                borderRadius:100,
                padding:"5px 14px",
                marginBottom:24,
                width:"fit-content",
              }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#E8401C" }}/>
                <span className="display" style={{
                  fontSize:10.5, fontWeight:600,
                  letterSpacing:".12em", color:"#ffb39e",
                  textTransform:"uppercase",
                }}>
                  EnerTrack — Plateforme interne
                </span>
              </div>

              <h1 className="display rl3" style={{
                fontSize:42, fontWeight:900,
                lineHeight:1.1, letterSpacing:"-0.03em",
                color:"white", margin:0,
              }}>
                Maîtrisez<br/>
                <span style={{ color:"rgba(255,255,255,.38)" }}>chaque watt</span><br/>
                de votre réseau.
              </h1>

              <p className="rl4" style={{
                marginTop:18, fontSize:14, lineHeight:1.8,
                color:"rgba(255,255,255,.45)",
                maxWidth:320,
              }}>
                Certification automatique Sénélec × FMS,
                synthèses multi-sites et alertes en temps réel.
              </p>

              {/* Stats */}
              <div className="rl5" style={{
                display:"grid", gridTemplateColumns:"1fr 1fr 1fr",
                gap:10, marginTop:32,
              }}>
                {([
                  { n:1831, suffix:"",   label:"Sites",         icon:<ShieldCheck size={14}/> },
                  { n:94,   suffix:"%",  label:"Conformité",    icon:<TrendingUp size={14}/> },
                  { n:18,   suffix:"k",  label:"Factures/mois", icon:<Zap size={14}/> },
                ] as const).map(({ n, suffix, label, icon }) => (
                  <div key={label} className="stat-pill">
                    <div style={{ color:"rgba(255,255,255,.35)", marginBottom:8 }}>{icon}</div>
                    <div className="display" style={{
                      fontSize:22, fontWeight:800,
                      color:"white", letterSpacing:"-0.025em", lineHeight:1,
                    }}>
                      <Counter to={n} suffix={suffix}/>
                    </div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,.38)", marginTop:4 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom trust signals */}
            <div className="rl5" style={{
              borderTop:"1px solid rgba(255,255,255,.08)",
              paddingTop:20,
              display:"flex", alignItems:"center", gap:16,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div className="live-dot"/>
                <span style={{ fontSize:11, color:"rgba(255,255,255,.35)", fontWeight:500 }}>
                  Système opérationnel
                </span>
              </div>
              <div style={{ width:1, height:14, background:"rgba(255,255,255,.12)" }}/>
              <span style={{ fontSize:11, color:"rgba(255,255,255,.25)", fontFamily:"'Outfit',sans-serif", fontWeight:500, letterSpacing:".05em" }}>
                © 2026 CAMUSAT
              </span>
            </div>

          </div>
        </div>

        {/* ══════════════════════════════════════════
            RIGHT PANEL — White login form
        ══════════════════════════════════════════ */}
        <div style={{
          flex:1,
          display:"flex",
          flexDirection:"column",
          alignItems:"center",
          justifyContent:"center",
          padding:"40px 32px",
          background:"white",
          position:"relative",
          overflow:"hidden",
        }}>

          {/* Very subtle background decoration */}
          <div style={{
            position:"absolute",
            top:-100, right:-100,
            width:400, height:400,
            borderRadius:"50%",
            background:"radial-gradient(circle, rgba(30,58,138,.04) 0%, transparent 70%)",
            pointerEvents:"none",
          }}/>
          <div style={{
            position:"absolute",
            bottom:-80, left:-60,
            width:300, height:300,
            borderRadius:"50%",
            background:"radial-gradient(circle, rgba(232,64,28,.03) 0%, transparent 70%)",
            pointerEvents:"none",
          }}/>

          <div style={{ width:"100%", maxWidth:380, position:"relative" }}>

            {/* Mobile logo */}
            <div className="ru1 lg:hidden" style={{ textAlign:"center", marginBottom:32 }}>
              <img src={camusatLogo} alt="Camusat" style={{ height:28, width:"auto", margin:"0 auto" }}/>
            </div>

            {/* ── Eyebrow ── */}
            <div className="ru1 display" style={{
              fontSize:11, fontWeight:700,
              letterSpacing:".15em", textTransform:"uppercase",
              color:"var(--orange)",
              marginBottom:10,
            }}>
              Connexion
            </div>

            <h2 className="ru2 display" style={{
              fontSize:28, fontWeight:800,
              letterSpacing:"-0.025em",
              color:"var(--blue)",
              margin:"0 0 6px",
            }}>
              Bon retour 👋
            </h2>

            <p className="ru3" style={{
              fontSize:13.5, color:"var(--slate)",
              marginBottom:32, lineHeight:1.6,
            }}>
              Accède à ton espace d'analyse énergie.
            </p>

            {/* ── Form card ── */}
            <div className="ru4" style={{
              background:"white",
              borderRadius:20,
              padding:"28px 28px 24px",
              border:"1px solid #e8eeff",
              boxShadow:
                "0 1px 2px rgba(30,58,138,.04)," +
                "0 4px 16px rgba(30,58,138,.07)," +
                "0 24px 48px rgba(30,58,138,.05)",
            }}>

              <form onSubmit={handleSubmit(onSubmit)}>

                {/* Username */}
                <div className="field-wrap ru5" style={{ marginBottom:14 }}>
                  <label>Identifiant</label>
                  <input
                    className={`field${errors.username ? " has-error" : ""}`}
                    placeholder="prenom.nom"
                    autoComplete="username"
                    onFocus={() => setFocused("username")}
                    onBlur={() => setFocused(null)}
                    {...register("username", { required: "Identifiant requis" })}
                  />
                  {errors.username && (
                    <p style={{ margin:"5px 0 0", fontSize:11, color:"#f87171", display:"flex", gap:4, alignItems:"center" }}>
                      ⚠ {errors.username.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="field-wrap ru5" style={{ marginBottom:22 }}>
                  <label>Mot de passe</label>
                  <div style={{ position:"relative" }}>
                    <input
                      className={`field${errors.password ? " has-error" : ""}`}
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      style={{ paddingRight:44 }}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      {...register("password", { required: "Mot de passe requis" })}
                    />
                    <button
                      type="button"
                      className="field-icon"
                      onClick={() => setShowPw(v => !v)}
                      aria-label={showPw ? "Masquer" : "Afficher"}
                    >
                      {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                  {errors.password && (
                    <p style={{ margin:"5px 0 0", fontSize:11, color:"#f87171", display:"flex", gap:4, alignItems:"center" }}>
                      ⚠ {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading} className="btn-connect ru6">
                  <span className="orange-strip"/>
                  {loading ? (
                    <>
                      <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,.3)" strokeWidth="2.5"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                      Connexion...
                    </>
                  ) : (
                    <>
                      Se connecter
                      <ArrowRight size={15}/>
                    </>
                  )}
                </button>
              </form>

              {/* Footer */}
              <div style={{
                marginTop:20, paddingTop:16,
                borderTop:"1px solid #f1f5fe",
                display:"flex", alignItems:"center", justifyContent:"space-between",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <div className="live-dot" style={{ width:7, height:7 }}/>
                  <span style={{ fontSize:11, color:"#94a3b8", fontWeight:500 }}>
                    Serveur actif
                  </span>
                </div>
                <span style={{
                  fontFamily:"'Outfit',sans-serif",
                  fontSize:10, color:"#cbd5e1",
                  fontWeight:600, letterSpacing:".08em",
                }}>
                  v2.0 · 2026
                </span>
              </div>
            </div>

            {/* Tagline */}
            <p className="ru6" style={{
              marginTop:18, textAlign:"center",
              fontSize:12, color:"#94a3b8",
            }}>
              Accès réservé aux équipes Camusat
            </p>

          </div>
        </div>
      </div>
    </>
  );
}