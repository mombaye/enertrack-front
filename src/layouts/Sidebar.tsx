// src/layouts/Sidebar.tsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home, User, Menu, X, Receipt,
  ChevronLeft, ChevronRight, Settings2, ShieldCheck,
  Calculator, Zap, BarChart2, AlertTriangle, Server,
  Building2,TrendingUp
} from "lucide-react";
import camusatLogo from "@/assets/images/camusat-logo.png";
import { useAuth } from "@/auth/AuthContext";

type Section = "ANALYSE" | "FACTURATION" | "MODULES" | "ADMINISTRATION" | "RÉSEAU";
type LinkItem = {
  to: string; label: string; icon: React.ReactNode;
  adminOnly?: boolean; section?: Section; end?: boolean;
  comingSoon?: boolean;
};

const LINKS: LinkItem[] = [
  // ── ANALYSE ─────────────────────────────────────────────────────────────────
  { to: "/dashboard",              icon: <Home />,         label: "Dashboard",                  section: "ANALYSE",        end: true },

  // ── FACTURATION ──────────────────────────────────────────────────────────────
  { to: "/billing/suivi", icon: <TrendingUp />, label: "Suivi Facturation", section: "FACTURATION", end: true },
  { to: "/billing/sonatel",        icon: <Receipt />,      label: "Factures Sonatel",            section: "FACTURATION",    end: true },
  { to: "/certification",          icon: <ShieldCheck />,  label: "Certification",              section: "FACTURATION",    end: true },

  // ── MODULES ──────────────────────────────────────────────────────────────────
  { to: "/modules/estimation",              icon: <Calculator />,   label: "Estimation",                 section: "MODULES",        comingSoon: true },
  { to: "/modules/optimisation",           icon: <Zap />,          label: "Optim. Puissance & Tarif",   section: "MODULES",        comingSoon: true },
  { to: "/modules/suivi-conso",            icon: <BarChart2 />,    label: "Suivi Conso",                section: "MODULES",        comingSoon: true },
  { to: "/modules/suivi-penalites",        icon: <AlertTriangle />,label: "Suivi Pénalités",            section: "MODULES",        comingSoon: true },
  { to: "/modules/suivi-fms",             icon: <Server />,       label: "Suivi FMS",                  section: "MODULES",        comingSoon: true },

  // ── ADMINISTRATION ───────────────────────────────────────────────────────────
  { to: "/users",                  icon: <User />,         label: "Utilisateurs",               section: "ADMINISTRATION", adminOnly: true },
  { to: "/billing/sonatel/config", icon: <Settings2 />,    label: "Config Sonatel",             section: "ADMINISTRATION", adminOnly: true },
  { to: "/admin/sites", icon: <Building2 />, label: "Gestion des sites", section: "ADMINISTRATION", adminOnly: true },
];

const W  = 272;
const WC = 72;

// ─── Tooltip for collapsed items ──────────────────────────────────────────────
function Tip({ label, show }: { label: string; show: boolean }) {
  return (
    <span style={{
      position: "absolute",
      left: "calc(100% + 10px)",
      top: "50%",
      transform: `translateY(-50%) ${show ? "translateX(0)" : "translateX(-4px)"}`,
      background: "#0f172a",
      color: "#fff",
      fontSize: 12, fontWeight: 600,
      padding: "5px 10px", borderRadius: 8,
      whiteSpace: "nowrap",
      pointerEvents: "none",
      opacity: show ? 1 : 0,
      transition: "opacity .15s ease, transform .15s ease",
      zIndex: 100,
      boxShadow: "0 4px 16px rgba(0,0,0,.35)",
    }}>
      {label}
      <span style={{
        position: "absolute", right: "100%", top: "50%",
        transform: "translateY(-50%)",
        border: "5px solid transparent",
        borderRightColor: "#0f172a",
        borderLeft: "none",
      }}/>
    </span>
  );
}

// ─── Section divider ───────────────────────────────────────────────────────────
function SectionLabel({ title, collapsed }: { title: string; collapsed: boolean }) {
  if (collapsed) return <div style={{ height: 8 }} />;
  return (
    <div style={{
      padding: "14px 4px 5px",
      fontSize: 9, fontWeight: 700,
      letterSpacing: ".15em",
      color: "rgba(255,255,255,.25)",
      textTransform: "uppercase",
      userSelect: "none",
    }}>
      {title}
    </div>
  );
}

// ─── Single nav link ───────────────────────────────────────────────────────────
function NavItem({ to, icon, label, collapsed, adminOnly, end, comingSoon }: {
  to: string; icon: React.ReactNode; label: string;
  collapsed: boolean; adminOnly?: boolean; end?: boolean; comingSoon?: boolean;
}) {
  const [hov, setHov] = useState(false);

  return (
    <li style={{ listStyle: "none", position: "relative" }}>
      <NavLink
        to={to} end={end}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={({ isActive }) => ({
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: collapsed ? "9px 0" : "8px 10px",
          borderRadius: 12,
          justifyContent: collapsed ? "center" : "flex-start",
          textDecoration: "none",
          position: "relative",
          transition: "background .18s, box-shadow .18s",
          background: isActive
            ? "rgba(255,255,255,.95)"
            : hov ? "rgba(255,255,255,.07)" : "transparent",
          boxShadow: isActive ? "0 4px 20px rgba(0,0,0,.2)" : "none",
          opacity: comingSoon ? 0.7 : 1,
        })}
      >
        {({ isActive }) => (
          <>
            {/* Orange left bar when active */}
            <span style={{
              position: "absolute",
              left: 0, top: "18%", bottom: "18%", width: 3,
              borderRadius: "0 3px 3px 0",
              background: isActive ? "#E8401C" : "transparent",
              transition: "background .18s",
            }}/>

            {/* Icon box */}
            <span style={{
              width: 34, height: 34, borderRadius: 9,
              display: "grid", placeItems: "center", flexShrink: 0,
              background: isActive
                ? "rgba(30,58,138,.08)"
                : hov ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.06)",
              border: `1px solid ${isActive ? "rgba(30,58,138,.1)" : "rgba(255,255,255,.07)"}`,
              color: isActive ? "#1e3a8a" : "rgba(255,255,255,.72)",
              transition: "all .18s",
            }}>
              <span className="[&_svg]:h-[17px] [&_svg]:w-[17px]">{icon}</span>
            </span>

            {/* Label */}
            {!collapsed && (
              <span style={{
                fontSize: 13.5, fontWeight: 600, flex: 1,
                color: isActive ? "#1e3a8a" : "rgba(255,255,255,.78)",
                letterSpacing: "-.01em",
                transition: "color .18s",
              }}>
                {label}
              </span>
            )}

            {/* Admin pill */}
            {!collapsed && adminOnly && (
              <span style={{
                fontSize: 9, fontWeight: 700,
                padding: "2px 6px", borderRadius: 100,
                background: isActive ? "rgba(30,58,138,.09)" : "rgba(255,255,255,.09)",
                color: isActive ? "#1e3a8a" : "rgba(255,255,255,.45)",
                letterSpacing: ".07em", textTransform: "uppercase",
              }}>Admin</span>
            )}

            {/* Coming Soon pill */}
            {!collapsed && comingSoon && !isActive && (
              <span style={{
                fontSize: 8.5, fontWeight: 700,
                padding: "2px 6px", borderRadius: 100,
                background: "rgba(232,64,28,0.15)",
                border: "1px solid rgba(232,64,28,0.25)",
                color: "#ff7a5c",
                letterSpacing: ".06em", textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>Soon</span>
            )}

            {collapsed && <Tip label={label} show={hov} />}
          </>
        )}
      </NavLink>
    </li>
  );
}

// ─── Inner content ─────────────────────────────────────────────────────────────
function Inner({
  collapsed, setCollapsed, onClose, mode,
}: {
  collapsed: boolean;
  setCollapsed?: (v: (p: boolean) => boolean) => void;
  onClose?: () => void;
  mode: "desktop" | "mobile";
}) {
  const { user } = useAuth();
  const role = user?.role || "analyst";
  const isCol = mode === "desktop" ? collapsed : false;

  const visible = useMemo(
    () => LINKS.filter(l => !l.adminOnly || role === "admin"),
    [role]
  );

  const groups = useMemo(() => {
    const m: Record<Section, LinkItem[]> = {
      ANALYSE: [], FACTURATION: [], MODULES: [], ADMINISTRATION: [], RÉSEAU: [],
    };
    for (const l of visible) m[(l.section || "ANALYSE") as Section].push(l);
    return m;
  }, [visible]);

  const sections: Section[] = ["ANALYSE", "FACTURATION", "MODULES", "ADMINISTRATION", "RÉSEAU"];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>

      {/* ── Header */}
      <div style={{
        padding: isCol ? "18px 10px 14px" : "18px 14px 14px",
        borderBottom: "1px solid rgba(255,255,255,.07)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: "rgba(255,255,255,.1)",
            border: "1px solid rgba(255,255,255,.12)",
            display: "grid", placeItems: "center",
            boxShadow: "0 4px 14px rgba(0,0,0,.18)",
          }}>
            <img src={camusatLogo} alt="Camusat" style={{ height: 20, width: "auto" }} />
          </div>

          {!isCol && (
            <>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontFamily: "'Outfit',sans-serif",
                  fontSize: 14.5, fontWeight: 800,
                  color: "white", letterSpacing: "-.025em", lineHeight: 1.2,
                }}>
                  EnerTrack
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.38)", marginTop: 1.5 }}>
                  Énergie & Réseau
                </div>
              </div>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 0 3px rgba(16,185,129,.18)",
                flexShrink: 0,
              }}/>
            </>
          )}

          {mode === "mobile" && (
            <button onClick={onClose} style={{
              marginLeft: isCol ? 0 : "auto",
              background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 9, padding: 6, color: "rgba(255,255,255,.7)",
              cursor: "pointer", display: "grid", placeItems: "center",
            }}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Collapse btn (desktop) */}
      {mode === "desktop" && setCollapsed && (
        <div style={{ padding: "6px 8px 0", display: "flex", justifyContent: isCol ? "center" : "flex-end" }}>
          <button
            onClick={() => setCollapsed(v => !v)}
            title={isCol ? "Déplier" : "Réduire"}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 7px", borderRadius: 7,
              background: "none", border: "none",
              color: "rgba(255,255,255,.25)", cursor: "pointer",
              fontSize: 10, fontWeight: 600, letterSpacing: ".04em",
              transition: "color .15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,.6)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,.25)")}
          >
            {!isCol && <span>Réduire</span>}
            {isCol ? <ChevronRight size={12}/> : <ChevronLeft size={12}/>}
          </button>
        </div>
      )}

      {/* ── Nav */}
      <nav style={{
        flex: 1, overflowY: "auto", padding: "4px 8px 8px",
        scrollbarWidth: "none",
      }}>
        {sections.map(sec => {
          const items = groups[sec];
          if (!items.length) return null;
          return (
            <div key={sec}>
              <SectionLabel title={sec} collapsed={isCol} />
              <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                {items.map(l => (
                  <NavItem
                    key={l.to} to={l.to} icon={l.icon} label={l.label}
                    collapsed={isCol} adminOnly={l.adminOnly} end={l.end}
                    comingSoon={l.comingSoon}
                  />
                ))}
              </ul>
              <div style={{ height: 1, background: "rgba(255,255,255,.05)", margin: "8px 2px 0" }}/>
            </div>
          );
        })}
      </nav>

      {/* ── User footer */}
      <div style={{ padding: isCol ? "10px 8px" : "10px" }}>
        <div style={{
          borderRadius: 13,
          background: "rgba(0,0,0,.2)",
          border: "1px solid rgba(255,255,255,.07)",
          padding: isCol ? "9px 0" : "10px 12px",
          display: "flex", alignItems: "center",
          justifyContent: isCol ? "center" : "flex-start",
          gap: 9, overflow: "hidden", position: "relative",
        }}>
          <div style={{
            position: "absolute", top: -18, right: -18, width: 55, height: 55,
            borderRadius: "50%", background: "rgba(255,255,255,.04)", pointerEvents: "none",
          }}/>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: "linear-gradient(135deg,#E8401C,#ff6340)",
            display: "grid", placeItems: "center",
            fontSize: 12.5, fontWeight: 800, color: "white",
            boxShadow: "0 3px 8px rgba(232,64,28,.22)",
          }}>
            {(user?.username || "U").slice(0, 1).toUpperCase()}
          </div>
          {!isCol && (
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 12.5, fontWeight: 600, color: "white",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {user?.username || "Utilisateur"}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", marginTop: 1 }}>
                {role === "admin" ? "Administrateur" : "Analyste"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.style.setProperty("--sbw", collapsed ? `${WC}px` : `${W}px`);
  }, [collapsed]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const base: React.CSSProperties = {
    position: "fixed", top: 0, left: 0, bottom: 0,
    background: "linear-gradient(175deg,#1e3a8a 0%,#162d6e 40%,#0d1f50 100%)",
    borderRight: "1px solid rgba(255,255,255,.07)",
    boxShadow: "4px 0 24px rgba(0,0,0,.18)",
    zIndex: 40, overflow: "hidden",
  };

  const grid: React.CSSProperties = {
    position: "absolute", inset: 0, pointerEvents: "none",
    backgroundImage:
      "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px)," +
      "linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)",
    backgroundSize: "32px 32px",
  };

  const glow: React.CSSProperties = {
    position: "absolute", top: -50, left: "50%", transform: "translateX(-50%)",
    width: 240, height: 160, pointerEvents: "none",
    background: "radial-gradient(circle,rgba(255,255,255,.07) 0%,transparent 70%)",
  };

  return (
    <>
      {/* Desktop */}
      <aside
        className="hidden md:block"
        style={{
          ...base,
          width: collapsed ? WC : W,
          transition: "width .22s cubic-bezier(.4,0,.2,1)",
        }}
      >
        <div style={grid}/><div style={glow}/>
        <div style={{ position: "relative", height: "100%" }}>
          <Inner collapsed={collapsed} setCollapsed={setCollapsed} mode="desktop" />
        </div>
      </aside>

      {/* Mobile hamburger */}
      <button
        className="md:hidden"
        onClick={() => setMobileOpen(true)}
        style={{
          position: "fixed", top: 14, left: 14, zIndex: 50,
          background: "#1e3a8a", border: "1px solid rgba(255,255,255,.14)",
          borderRadius: 11, padding: 9, color: "white",
          cursor: "pointer", boxShadow: "0 4px 14px rgba(30,58,138,.3)",
          display: "grid", placeItems: "center",
        }}
        aria-label="Menu"
      >
        <Menu size={19} />
      </button>

      {/* Mobile drawer */}
      <aside
        className="md:hidden"
        style={{
          ...base, width: W, zIndex: 50,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform .24s cubic-bezier(.4,0,.2,1)",
        }}
      >
        <div style={grid}/><div style={glow}/>
        <div style={{ position: "relative", height: "100%" }}>
          <Inner collapsed={false} onClose={() => setMobileOpen(false)} mode="mobile" />
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="md:hidden"
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 45,
            background: "rgba(0,0,0,.38)",
            backdropFilter: "blur(3px)",
          }}
        />
      )}
    </>
  );
}