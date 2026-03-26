// src/features/financial/FinancialAccessGate.tsx
//
// Code d'accès défini dans .env :
//   VITE_FINANCIAL_ACCESS_CODE=032626
//
// Unlock = sessionStorage : re-saisie à la fermeture de l'onglet.
//
import { useState, useRef, useEffect, useCallback } from "react";
import { Lock, TrendingUp, X, RefreshCw, ShieldCheck } from "lucide-react";

// ─── Env ──────────────────────────────────────────────────────────────────────
const EXPECTED_CODE = import.meta.env.VITE_FINANCIAL_ACCESS_CODE as string | undefined;
const SESSION_KEY   = "enertrack_financial_unlocked";

if (!EXPECTED_CODE) {
  console.error(
    "[FinancialAccessGate] ⚠ VITE_FINANCIAL_ACCESS_CODE non défini dans .env — " +
    "redémarrez le serveur de dev après avoir ajouté la variable."
  );
}

export function isFinancialUnlocked() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}
export function financialUnlock() {
  sessionStorage.setItem(SESSION_KEY, "1");
}
export function financialLock() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── PIN input ─────────────────────────────────────────────────────────────────
interface PinInputProps {
  length?: number;
  onComplete: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
}

function PinInput({ length = 6, onComplete, error, disabled }: PinInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(""));
  const refs      = useRef<(HTMLInputElement | null)[]>([]);
  // Empêche les doubles appels (onChange + onPaste simultanés)
  const completed = useRef(false);

  // Reset complet sur erreur
  useEffect(() => {
    if (error) {
      completed.current = false;
      setDigits(Array(length).fill(""));
      setTimeout(() => refs.current[0]?.focus(), 50);
    }
  }, [error, length]);

  // Focus initial
  useEffect(() => { refs.current[0]?.focus(); }, []);

  const tryComplete = useCallback(
    (value: string) => {
      if (completed.current) return;
      completed.current = true;
      onComplete(value);
    },
    [onComplete]
  );

  const handle = (i: number, val: string) => {
    const v = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < length - 1) refs.current[i + 1]?.focus();
    if (next.every(d => d !== "")) tryComplete(next.join(""));
  };

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      completed.current = false; // Permet une nouvelle tentative après effacement
      if (!digits[i] && i > 0) {
        refs.current[i - 1]?.focus();
        const next = [...digits]; next[i - 1] = ""; setDigits(next);
      } else {
        const next = [...digits]; next[i] = ""; setDigits(next);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!text) return;
    const next = Array(length).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    // Focus sur la dernière case remplie (ou la dernière)
    refs.current[Math.min(text.length, length) - 1]?.focus();
    if (text.length === length) tryComplete(text);
  };

  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => (refs.current[i] = el)}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={e => handle(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          style={{
            width: 48, height: 56, borderRadius: 14,
            border: `2px solid ${error ? "#ef4444" : d ? "#1e3a8a" : "rgba(30,58,138,.18)"}`,
            background: error ? "rgba(239,68,68,.06)" : d ? "rgba(30,58,138,.04)" : "rgba(255,255,255,.8)",
            fontSize: 22, fontWeight: 700, textAlign: "center", color: "#0f172a",
            outline: "none", transition: "border-color .18s, background .18s, box-shadow .18s",
            boxShadow: error
              ? "0 0 0 4px rgba(239,68,68,.12)"
              : d && !error
                ? "0 0 0 4px rgba(30,58,138,.08)"
                : "0 2px 8px rgba(0,0,0,.06)",
            cursor: disabled ? "not-allowed" : "text",
          }}
        />
      ))}
    </div>
  );
}

// ─── Reset modal ───────────────────────────────────────────────────────────────
function ResetModal({ onClose }: { onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const confirmed = typed.toUpperCase() === "CONFIRMER";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(15,23,42,.65)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "white", borderRadius: 24, padding: 32, maxWidth: 400, width: "100%",
        boxShadow: "0 32px 80px rgba(0,0,0,.22)",
        animation: "slideUp .22s cubic-bezier(.34,1.4,.64,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: "linear-gradient(135deg,#fef2f2,#fee2e2)",
            border: "1px solid #fecaca",
            display: "grid", placeItems: "center",
          }}>
            <RefreshCw size={19} color="#dc2626" />
          </div>
          <button onClick={onClose} style={{
            background: "rgba(0,0,0,.06)", border: "none", borderRadius: 9,
            padding: 6, cursor: "pointer", color: "#64748b",
            display: "grid", placeItems: "center",
          }}>
            <X size={15} />
          </button>
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
          Verrouiller la session
        </h3>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 18px", lineHeight: 1.5 }}>
          La session sera verrouillée et le code sera demandé à nouveau.
          Le code d'accès est configuré via{" "}
          <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 5, fontSize: 11 }}>
            .env → VITE_FINANCIAL_ACCESS_CODE
          </code>.
          Tapez <strong>CONFIRMER</strong> pour verrouiller.
        </p>

        <input
          autoFocus
          placeholder="CONFIRMER"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          style={{
            width: "100%", padding: "9px 13px", borderRadius: 11,
            border: `2px solid ${confirmed ? "#1e3a8a" : "rgba(0,0,0,.1)"}`,
            fontSize: 13, fontWeight: 600, letterSpacing: ".06em",
            outline: "none", marginBottom: 16, boxSizing: "border-box",
            background: confirmed ? "rgba(30,58,138,.03)" : "white",
            transition: "border-color .18s",
          }}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "9px 0", borderRadius: 11,
            border: "1.5px solid rgba(0,0,0,.1)", background: "white",
            fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
          }}>
            Annuler
          </button>
          <button
            disabled={!confirmed}
            onClick={() => { financialLock(); window.location.reload(); }}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 11, border: "none",
              background: confirmed
                ? "linear-gradient(135deg,#dc2626,#b91c1c)"
                : "rgba(220,38,38,.25)",
              fontSize: 13, fontWeight: 600, color: "white",
              cursor: confirmed ? "pointer" : "not-allowed",
              transition: "background .18s",
            }}
          >
            Verrouiller
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main gate ────────────────────────────────────────────────────────────────
interface FinancialAccessGateProps {
  onUnlock: () => void;
}

export default function FinancialAccessGate({ onUnlock }: FinancialAccessGateProps) {
  const [error,     setError]     = useState(false);
  const [errMsg,    setErrMsg]    = useState("");
  const [shake,     setShake]     = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [attempts,  setAttempts]  = useState(0);
  const [showReset, setShowReset] = useState(false);

  // ⚠ Si la variable d'env est absente, on bloque totalement l'accès
  // au lieu de laisser passer n'importe quel code.
  const noEnv = !EXPECTED_CODE;

  const triggerError = (msg: string) => {
    setError(true);
    setErrMsg(msg);
    setShake(true);
    setAttempts(a => a + 1);
    // Shake puis reset des états visuels (le PinInput se réinitialise via error=true)
    setTimeout(() => {
      setShake(false);
      // On laisse error=true encore un instant pour que PinInput le détecte
      setTimeout(() => setError(false), 100);
    }, 600);
  };

  const handleComplete = useCallback(async (code: string) => {
    // ⚠ FIX : si EXPECTED_CODE absent → on bloque, pas on déverrouille
    if (noEnv) {
      triggerError("Configuration manquante — contactez votre administrateur.");
      return;
    }

    setLoading(true);
    // Légère pause pour l'UX (évite le flash instantané)
    await new Promise(r => setTimeout(r, 320));
    setLoading(false);

    if (code === EXPECTED_CODE) {
      // Bonne réponse → déverrouillage
      onUnlock();
    } else {
      // Mauvaise réponse → message contextuel selon le nombre de tentatives
      if (attempts >= 4) {
        triggerError("Trop de tentatives. Contactez votre administrateur.");
      } else if (attempts >= 2) {
        triggerError(`Code incorrect — ${5 - attempts} tentative(s) restante(s).`);
      } else {
        triggerError("Code incorrect. Réessayez.");
      }
    }
  }, [onUnlock, attempts, noEnv]);

  return (
    <>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes float   { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-5px); } }
        @keyframes shake   { 0%,100% { transform:translateX(0); } 20% { transform:translateX(-9px); } 40% { transform:translateX(9px); } 60% { transform:translateX(-5px); } 80% { transform:translateX(5px); } }
        @keyframes blink   { 0%,100% { opacity:1; } 50% { opacity:.35; } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={{
        minHeight: "calc(100vh - 64px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 20px",
        background: "linear-gradient(140deg, #eef2ff 0%, #e8f0fe 50%, #f0f4ff 100%)",
        position: "relative", overflow: "hidden",
      }}>
        {/* BG blobs */}
        <div style={{ position:"absolute", top:-100, right:-100, width:420, height:420, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(30,58,138,.07) 0%,transparent 70%)", pointerEvents:"none" }}/>
        <div style={{ position:"absolute", bottom:-120, left:-80, width:360, height:360, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(232,64,28,.05) 0%,transparent 70%)", pointerEvents:"none" }}/>

        {/* Card */}
        <div style={{
          position: "relative",
          background: "rgba(255,255,255,.88)", backdropFilter: "blur(24px)",
          borderRadius: 28, padding: "44px 40px 40px",
          maxWidth: 400, width: "100%",
          boxShadow: "0 1px 1px rgba(0,0,0,.03), 0 6px 24px rgba(0,0,0,.05), 0 24px 64px rgba(30,58,138,.1)",
          border: "1px solid rgba(255,255,255,.85)",
          animation: "slideUp .38s cubic-bezier(.34,1.15,.64,1)",
        }}>
          {/* Top accent */}
          <div style={{
            position:"absolute", top:0, left:48, right:48, height:3,
            borderRadius:"0 0 6px 6px",
            background:"linear-gradient(90deg,transparent,#1e3a8a 30%,#E8401C 70%,transparent)",
            opacity:.4,
          }}/>

          {/* Icon */}
          <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}>
            <div style={{
              width:68, height:68, borderRadius:20,
              background: error
                ? "linear-gradient(135deg,#dc2626,#b91c1c)"
                : "linear-gradient(135deg,#1e3a8a 0%,#2d52b8 100%)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow: error
                ? "0 8px 28px rgba(220,38,38,.3)"
                : "0 8px 28px rgba(30,58,138,.28)",
              animation: shake ? "shake .5s ease" : "float 3.2s ease-in-out infinite",
              position:"relative",
              transition: "background .3s, box-shadow .3s",
            }}>
              <Lock size={28} color="white" strokeWidth={2.2}/>
              <div style={{
                position:"absolute", top:-4, right:-4,
                width:15, height:15, borderRadius:"50%",
                background: error
                  ? "linear-gradient(135deg,#fbbf24,#f59e0b)"
                  : "linear-gradient(135deg,#E8401C,#ff6340)",
                border:"2.5px solid white",
                boxShadow: error
                  ? "0 2px 6px rgba(251,191,36,.5)"
                  : "0 2px 6px rgba(232,64,28,.4)",
                animation:"blink 2s ease-in-out infinite",
                transition: "background .3s",
              }}/>
            </div>
          </div>

          {/* Badge */}
          <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:5,
              padding:"4px 11px", borderRadius:100,
              background:"rgba(30,58,138,.07)", border:"1px solid rgba(30,58,138,.11)",
            }}>
              <TrendingUp size={10} color="#1e3a8a"/>
              <span style={{ fontSize:10, fontWeight:700, color:"#1e3a8a",
                letterSpacing:".09em", textTransform:"uppercase" }}>
                Évaluation Financière
              </span>
            </div>
          </div>

          {/* Title */}
          <h2 style={{
            textAlign:"center", fontSize:21, fontWeight:800, color:"#0f172a",
            letterSpacing:"-.03em", margin:"0 0 6px",
            fontFamily:"'Outfit', sans-serif",
          }}>
            Accès restreint
          </h2>
          <p style={{ textAlign:"center", fontSize:13, color:"#64748b", margin:"0 0 28px", lineHeight:1.55 }}>
            {noEnv
              ? "⚠️ VITE_FINANCIAL_ACCESS_CODE non configuré — redémarrez le serveur"
              : "Entrez le code d'accès à 6 chiffres pour continuer"}
          </p>

          {/* PIN */}
          <div style={{ animation: shake ? "shake .5s ease" : "none" }}>
            <PinInput
              key={attempts}         // recrée le composant à chaque tentative échouée
              onComplete={handleComplete}
              error={error}
              disabled={loading || noEnv}
            />
          </div>

          {/* Zone de feedback — hauteur fixe pour éviter les sauts de layout */}
          <div style={{ textAlign:"center", minHeight:28, marginTop:14, display:"flex",
            alignItems:"center", justifyContent:"center" }}>
            {loading && (
              <span style={{ fontSize:12.5, color:"#94a3b8", fontWeight:500,
                display:"flex", alignItems:"center", gap:6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  style={{ animation:"spin 1s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Vérification…
              </span>
            )}
            {error && !loading && (
              <div style={{
                display:"inline-flex", alignItems:"center", gap:6,
                padding:"6px 14px", borderRadius:100,
                background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.18)",
                animation:"fadeIn .2s ease",
              }}>
                <span style={{ fontSize:14 }}>⚠</span>
                <span style={{ fontSize:12.5, fontWeight:600, color:"#dc2626" }}>
                  {errMsg}
                </span>
              </div>
            )}
          </div>

          {/* Indication visuelle du nombre de tentatives */}
          {attempts > 0 && !loading && (
            <div style={{ display:"flex", justifyContent:"center", gap:5, marginTop:10 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{
                  width:6, height:6, borderRadius:"50%",
                  background: i < attempts ? "#ef4444" : "rgba(0,0,0,.1)",
                  transition:"background .2s",
                }}/>
              ))}
            </div>
          )}

          {/* Security note */}
          <p style={{
            textAlign:"center", fontSize:11.5, color:"#94a3b8",
            margin:"20px 0 0", lineHeight:1.5,
            display:"flex", alignItems:"center", justifyContent:"center", gap:5,
          }}>
            <ShieldCheck size={12}/>
            Données financières sensibles — accès restreint
          </p>

          {/* Lock link */}
          <div style={{ textAlign:"center", marginTop:14 }}>
            <button
              onClick={() => setShowReset(true)}
              style={{
                background:"none", border:"none", cursor:"pointer",
                fontSize:11.5, color:"#94a3b8", fontWeight:500,
                textDecoration:"underline",
                textDecorationColor:"rgba(148,163,184,.3)",
                transition:"color .15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#64748b")}
              onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
            >
              Verrouiller la session
            </button>
          </div>
        </div>
      </div>

      {showReset && <ResetModal onClose={() => setShowReset(false)} />}

      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </>
  );
}