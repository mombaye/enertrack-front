// src/layouts/Header.tsx
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { LogOut, Bell, ChevronDown } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";

// ─── Page title resolver ──────────────────────────────────────────────────────
const PAGE_META: Record<string, { title: string; sub: string }> = {
  "/dashboard":              { title: "Dashboard",          sub: "Vue d'ensemble" },
  "/billing/sonatel":        { title: "Billing Sonatel",    sub: "Factures & synthèses" },
  "/certification":          { title: "Certification",      sub: "Validation Sénélec × FMS" },
  "/users":                  { title: "Utilisateurs",       sub: "Gestion des accès" },
  "/billing/sonatel/config": { title: "Config Sonatel",     sub: "Paramètres & tarifs" },
};

function usePageMeta() {
  const { pathname } = useLocation();
  const key = Object.keys(PAGE_META)
    .sort((a, b) => b.length - a.length)
    .find(k => pathname.startsWith(k));
  return key ? PAGE_META[key] : { title: "EnerTrack", sub: "Énergie & Réseau" };
}

// ─── Main header ─────────────────────────────────────────────────────────────
export default function Header() {
  const { user, logout } = useAuth();
  const meta = usePageMeta();
  const [menuOpen, setMenuOpen] = useState(false);
  const roleLabel = user?.role === "admin" ? "Administrateur" : "Analyste";
  const initial = (user?.username || "U").slice(0, 1).toUpperCase();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&display=swap');

        .hdr-root {
          position: sticky; top: 0; z-index: 30;
          height: 60px;
          display: flex; align-items: center;
          padding: 0 24px;
          background: rgba(255,255,255,.92);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(30,58,138,.08);
          box-shadow: 0 1px 0 rgba(30,58,138,.05), 0 4px 16px rgba(30,58,138,.04);
        }

        /* Orange accent line on top */
        .hdr-root::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #E8401C 0%, #ff7350 40%, transparent 100%);
          opacity: .7;
        }

        .hdr-title {
          font-family: 'Outfit', sans-serif;
          font-size: 16px; font-weight: 800;
          color: #1e3a8a;
          letter-spacing: -.025em;
          line-height: 1.2;
        }
        .hdr-sub {
          font-size: 11px; color: #94a3b8;
          font-weight: 500; margin-top: 1px;
        }

        /* breadcrumb dot separator */
        .hdr-dot {
          width: 3px; height: 3px;
          border-radius: 50%;
          background: #E8401C;
          margin: 0 8px;
          flex-shrink: 0;
        }

        /* user dropdown */
        .usr-card {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 10px 5px 5px;
          border-radius: 12px;
          border: 1px solid rgba(30,58,138,.1);
          background: white;
          cursor: pointer;
          transition: border-color .15s, box-shadow .15s, background .15s;
          position: relative;
          box-shadow: 0 1px 4px rgba(30,58,138,.06);
        }
        .usr-card:hover {
          border-color: rgba(30,58,138,.22);
          box-shadow: 0 2px 10px rgba(30,58,138,.1);
          background: #f8faff;
        }

        .usr-avatar {
          width: 32px; height: 32px;
          border-radius: 9px;
          background: linear-gradient(135deg,#E8401C,#ff6340);
          display: grid; place-items: center;
          font-size: 13px; font-weight: 800; color: white;
          box-shadow: 0 2px 6px rgba(232,64,28,.22);
          flex-shrink: 0;
        }

        .usr-name {
          font-size: 13px; font-weight: 600;
          color: #1e3a8a; line-height: 1.2;
          white-space: nowrap;
        }
        .usr-role {
          font-size: 10.5px; color: #94a3b8; font-weight: 500;
        }

        /* dropdown menu */
        .usr-dropdown {
          position: absolute;
          top: calc(100% + 8px); right: 0;
          background: white;
          border: 1px solid rgba(30,58,138,.1);
          border-radius: 14px;
          box-shadow: 0 8px 32px rgba(30,58,138,.14), 0 2px 8px rgba(0,0,0,.06);
          min-width: 180px;
          overflow: hidden;
          z-index: 100;
        }

        .usr-dropdown-item {
          display: flex; align-items: center; gap: 9px;
          padding: 10px 14px;
          font-size: 13px; font-weight: 600;
          color: #ef4444;
          cursor: pointer;
          transition: background .14s;
          background: none; border: none; width: 100%;
          text-align: left;
        }
        .usr-dropdown-item:hover { background: #fef2f2; }

        /* notification bell */
        .notif-btn {
          width: 38px; height: 38px;
          border-radius: 11px;
          border: 1px solid rgba(30,58,138,.1);
          background: white;
          display: grid; place-items: center;
          cursor: pointer;
          color: #94a3b8;
          transition: all .15s;
          box-shadow: 0 1px 4px rgba(30,58,138,.05);
          position: relative;
        }
        .notif-btn:hover { border-color: rgba(30,58,138,.2); color: #1e3a8a; background: #f8faff; }

        @keyframes hdr-in {
          from { opacity:0; transform:translateY(4px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .hdr-root { animation: hdr-in .4s ease both; }
      `}</style>

      <header className="hdr-root">

        {/* Mobile spacer (hamburger button takes left space) */}
        <div className="md:hidden" style={{ width: 44, flexShrink: 0 }} />

        {/* ── Left: page identity */}
        <div className="hidden md:flex items-center gap-0" style={{ flex: 1 }}>
          {/* Camusat label */}
          <span style={{
            fontFamily: "'Outfit',sans-serif",
            fontSize: 11, fontWeight: 700,
            letterSpacing: ".1em",
            color: "#E8401C",
            textTransform: "uppercase",
            opacity: .8,
          }}>
            Camusat
          </span>
          <span className="hdr-dot"/>
          <div>
            <div className="hdr-title">{meta.title}</div>
            <div className="hdr-sub">{meta.sub}</div>
          </div>
        </div>

        {/* Mobile: page title centered */}
        <div className="md:hidden flex-1 flex justify-center">
          <div style={{ textAlign: "center" }}>
            <div className="hdr-title" style={{ fontSize: 14 }}>{meta.title}</div>
          </div>
        </div>

        {/* ── Right: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

          {/* Notification bell (decorative) */}
          <button className="notif-btn hidden sm:grid" aria-label="Notifications">
            <Bell size={16} />
          </button>

          {/* User card + dropdown */}
          <div style={{ position: "relative" }}>
            <div
              className="usr-card"
              onClick={() => setMenuOpen(v => !v)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === "Enter" && setMenuOpen(v => !v)}
            >
              <div className="usr-avatar">{initial}</div>
              <div className="hidden sm:block">
                <div className="usr-name">{user?.username || "Utilisateur"}</div>
                <div className="usr-role">{roleLabel}</div>
              </div>
              <ChevronDown
                size={13}
                className="hidden sm:block"
                style={{
                  color: "#94a3b8",
                  marginLeft: 2,
                  transition: "transform .2s",
                  transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </div>

            {menuOpen && (
              <>
                {/* Backdrop to close */}
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 99 }}
                  onClick={() => setMenuOpen(false)}
                />
                <div className="usr-dropdown">
                  {/* User info inside dropdown */}
                  <div style={{
                    padding: "12px 14px 10px",
                    borderBottom: "1px solid #f1f5ff",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a8a" }}>
                      {user?.username || "Utilisateur"}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      {roleLabel}
                    </div>
                  </div>
                  <button
                    className="usr-dropdown-item"
                    onClick={() => { setMenuOpen(false); logout(); }}
                  >
                    <LogOut size={14} />
                    Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}