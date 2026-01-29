import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  User,
  Menu,
  X,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Settings2,
} from "lucide-react";
import camusatLogo from "@/assets/images/camusat-logo.png";
import { useAuth } from "@/auth/AuthContext";

type Section = "ANALYSE" | "FACTURATION" | "ADMINISTRATION" | "RESEAU";

type LinkItem = {
  to: string;
  label: string;
  icon: JSX.Element;
  adminOnly?: boolean;
  section?: Section;
  end?: boolean; // ✅ active exact match
};

const LINKS: LinkItem[] = [
  // ✅ ANALYSE
  { to: "/dashboard", icon: <Home />, label: "Dashboard", section: "ANALYSE" },

  // ✅ FACTURATION
  // { to: "/invoices", icon: <FileText />, label: "Factures", section: "FACTURATION" },
  {
    to: "/billing/sonatel",
    icon: <Receipt />,
    label: "Billing Sonatel",
    section: "FACTURATION",
    end: true, // ✅ IMPORTANT: évite d'être "active" sur /billing/sonatel/config
  },

  // ✅ ADMINISTRATION (sous facturation)
  { to: "/users", icon: <User />, label: "Utilisateurs", adminOnly: true, section: "ADMINISTRATION" },
  {
    to: "/billing/sonatel/config", // ✅ root (App.tsx redirige index -> tariffs)
    icon: <Settings2 />,
    label: "Config Sonatel",
    adminOnly: true,
    section: "ADMINISTRATION",
  },
];

const SIDEBAR_W = 288;
const SIDEBAR_W_COLLAPSED = 96;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SectionTitle({ title, collapsed }: { title: string; collapsed: boolean }) {
  if (collapsed) return <div className="h-4" />;
  return (
    <div className="px-4 pt-5 pb-2 text-[11px] font-semibold tracking-widest text-white/55">
      {title}
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  collapsed,
  adminOnly,
  end,
}: {
  to: string;
  icon: JSX.Element;
  label: string;
  collapsed: boolean;
  adminOnly?: boolean;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
          isActive
            ? "active bg-white/95 text-blue-900 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
            : "text-white/80 hover:text-white hover:bg-white/10"
        )
      }
    >
      {/* Active indicator bar */}
      <span
        className={cn(
          "absolute left-0 top-2 bottom-2 w-1 rounded-r-full opacity-0 transition-opacity",
          "bg-gradient-to-b from-white/90 to-white/40",
          "group-[.active]:opacity-100"
        )}
      />

      {/* Icon chip */}
      <span
        className={cn(
          "grid place-items-center h-10 w-10 rounded-2xl border transition-all",
          "border-white/10 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
          "group-hover:bg-white/15 group-hover:border-white/15",
          "group-[.active]:bg-blue-900/10 group-[.active]:border-blue-900/10"
        )}
      >
        <span className="[&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      </span>

      {!collapsed ? (
        <>
          <span className="truncate text-[14px] font-semibold">{label}</span>
          {adminOnly ? (
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-blue-900/10 text-blue-900 font-semibold">
              Admin
            </span>
          ) : null}
        </>
      ) : null}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const role = user?.role || "analyst";

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const location = useLocation();

  const visibleLinks = useMemo(
    () => LINKS.filter((l) => !l.adminOnly || role === "admin"),
    [role]
  );

  const groups = useMemo(() => {
    const bySection: Record<Section, LinkItem[]> = {
      ANALYSE: [],
      FACTURATION: [],
      ADMINISTRATION: [],
      RESEAU: [],
    };
    for (const l of visibleLinks) bySection[l.section || "ANALYSE"].push(l);
    return bySection;
  }, [visibleLinks]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  useEffect(() => {
    const w = collapsed ? `${SIDEBAR_W_COLLAPSED}px` : `${SIDEBAR_W}px`;
    document.documentElement.style.setProperty("--sbw", w);
  }, [collapsed]);

  const SideContent = ({ mode }: { mode: "desktop" | "mobile" }) => {
    const isCollapsed = mode === "desktop" ? collapsed : false;

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className={cn("px-4 py-4", isCollapsed ? "px-3" : "px-4")}>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-11 w-11 rounded-2xl border border-white/10 bg-white/10",
                "shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
                "grid place-items-center"
              )}
            >
              <img src={camusatLogo} alt="Camusat" className="h-6 w-auto" />
            </div>

            {!isCollapsed ? (
              <div className="min-w-0">
                <div className="text-white font-semibold leading-tight">EnerTrack</div>
                <div className="text-white/55 text-xs truncate">Analyse Énergie & Réseau</div>
              </div>
            ) : null}

            {mode === "mobile" ? (
              <button
                className="ml-auto rounded-2xl p-2 text-white/75 hover:text-white hover:bg-white/10 transition"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>

          <div className={cn("mt-4 h-px bg-white/10", isCollapsed ? "mx-1" : "mx-0")} />
        </div>

        {/* Collapse toggle (desktop only) */}
        {mode === "desktop" ? (
          <div className="px-3">
            <button
              onClick={() => setCollapsed((v) => !v)}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-2xl",
                "border border-white/10 bg-white/5 hover:bg-white/10 transition",
                "px-3 py-2 text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              )}
              title={collapsed ? "Déplier" : "Réduire"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              {!collapsed ? <span className="text-sm font-semibold">Réduire</span> : null}
            </button>
          </div>
        ) : null}

        {/* Nav */}
        <nav className="mt-2 flex-1 overflow-y-auto px-3 pb-4">
          {/* ANALYSE */}
          {groups.ANALYSE.length > 0 ? (
            <>
              <SectionTitle title="ANALYSE" collapsed={isCollapsed} />
              <ul className="space-y-1">
                {groups.ANALYSE.map((link) => (
                  <li key={link.to}>
                    <NavItem
                      to={link.to}
                      icon={link.icon}
                      label={link.label}
                      adminOnly={link.adminOnly}
                      collapsed={isCollapsed}
                      end={link.end}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {/* FACTURATION */}
          {groups.FACTURATION.length > 0 ? (
            <>
              <div className="mt-4 h-px bg-white/10 mx-1" />
              <SectionTitle title="FACTURATION" collapsed={isCollapsed} />
              <ul className="space-y-1">
                {groups.FACTURATION.map((link) => (
                  <li key={link.to}>
                    <NavItem
                      to={link.to}
                      icon={link.icon}
                      label={link.label}
                      adminOnly={link.adminOnly}
                      collapsed={isCollapsed}
                      end={link.end}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {/* ADMINISTRATION */}
          {groups.ADMINISTRATION.length > 0 ? (
            <>
              <div className="mt-4 h-px bg-white/10 mx-1" />
              <SectionTitle title="ADMINISTRATION" collapsed={isCollapsed} />
              <ul className="space-y-1">
                {groups.ADMINISTRATION.map((link) => (
                  <li key={link.to}>
                    <NavItem
                      to={link.to}
                      icon={link.icon}
                      label={link.label}
                      adminOnly={link.adminOnly}
                      collapsed={isCollapsed}
                      end={link.end}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {/* RESEAU (si tu ajoutes plus tard) */}
          {groups.RESEAU.length > 0 ? (
            <>
              <div className="mt-4 h-px bg-white/10 mx-1" />
              <SectionTitle title="RÉSEAU" collapsed={isCollapsed} />
              <ul className="space-y-1">
                {groups.RESEAU.map((link) => (
                  <li key={link.to}>
                    <NavItem
                      to={link.to}
                      icon={link.icon}
                      label={link.label}
                      adminOnly={link.adminOnly}
                      collapsed={isCollapsed}
                      end={link.end}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </nav>

        {/* Footer user card */}
        <div className={cn("px-4 pb-4", isCollapsed ? "px-3" : "px-4")}>
          <div
            className={cn(
              "rounded-2xl border border-white/10 bg-white/5 p-3",
              "shadow-[0_14px_40px_rgba(0,0,0,0.25)]",
              "relative overflow-hidden"
            )}
          >
            <div className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

            {!isCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 grid place-items-center text-white font-semibold">
                  {(user?.username || "U").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-white text-sm font-semibold truncate">
                    {user?.username || "Utilisateur"}
                  </div>
                  <div className="text-white/55 text-xs truncate">
                    {role === "admin" ? "Administrateur" : "Analyste"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 grid place-items-center text-white font-semibold">
                  {(user?.username || "U").slice(0, 1).toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          "hidden md:block fixed left-0 top-0 h-screen z-40",
          "bg-gradient-to-b from-blue-900 via-[#071a3a] to-[#05152e]",
          "border-r border-white/10",
          "shadow-[0_30px_90px_rgba(0,0,0,0.35)]",
          "transition-[width] duration-200",
          collapsed ? "w-[96px]" : "w-[288px]"
        )}
      >
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.10),transparent_55%)]" />
        <div className="relative h-full">
          <SideContent mode="desktop" />
        </div>
      </aside>

      {/* Mobile toggle */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 rounded-2xl p-2.5 bg-blue-900 text-white shadow-lg border border-white/10"
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile drawer */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 h-full w-[288px] z-50",
          "bg-gradient-to-b from-blue-900 via-[#071a3a] to-[#05152e]",
          "border-r border-white/10",
          "shadow-[0_30px_90px_rgba(0,0,0,0.45)]",
          "transform transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.10),transparent_55%)]" />
        <div className="relative h-full">
          <SideContent mode="mobile" />
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen ? (
        <div className="md:hidden fixed inset-0 z-40 bg-black/35" onClick={() => setMobileOpen(false)} />
      ) : null}
    </>
  );
}
