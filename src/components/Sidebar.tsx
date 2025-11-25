// Sidebar.tsx
import { useState } from "react";
import { Home, Building2, FileText, User, Menu, Zap, Activity, Gauge, BarChart3, Receipt, AlertTriangle } from "lucide-react";
import { NavLink } from "react-router-dom";

const sidebarLinks = [
  { to: "/dashboard", icon: <Home className="h-5 w-5" />, label: "Dashboard" },
  { to: "/sites",     icon: <Building2 className="h-5 w-5" />, label: "Sites" },
  { to: "/invoices",  icon: <FileText className="h-5 w-5" />, label: "Factures" },
  { to: "/users",     icon: <User className="h-5 w-5" />, label: "Utilisateurs", adminOnly: true },
  { to: "/energy",    icon: <Zap className="h-5 w-5" />, label: "Énergie" },
  { to: "/rectifiers", icon: <Activity className="h-5 w-5" />,  label: "Rectifiers" }, // ✅ nouveau
  { to: "/power-quality", icon: <Gauge className="h-5 w-5" />,   label: "Power Quality" }, //
  { to: "/pwm", icon: <BarChart3 className="h-5 w-5" />, label: "PWM Reports" }, // ⬅️ nouveau
  { to: "/billing/sonatel", icon: <Receipt className="h-5 w-5" />, label: "Billing Sonatel" },
  {
    to: "/grid-outages",
    icon: <AlertTriangle className="h-5 w-5" />,
    label: "Grid Outages",          // ⬅️ nouveau menu
  },
];

export default function Sidebar({ userRole = "analyst" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col bg-white text-blue-900 w-64 h-screen fixed left-0 top-0 z-40 border-r border-slate-200">
        <div className="px-6 py-4 font-bold text-xl tracking-wider text-blue-900">
          EnerTrack
        </div>
        <nav className="flex-1">
          <ul className="space-y-2 mt-2">
            {sidebarLinks.map(
              (link) =>
                (!link.adminOnly || userRole === "admin") && (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      className={({ isActive }) =>
                        [
                          "group flex items-center gap-3 px-6 py-2 rounded-xl transition-colors",
                          isActive
                            ? "bg-blue-800 text-white"
                            : "text-blue-900 hover:bg-blue-50"
                        ].join(" ")
                      }
                    >
                      {/* lucide utilise currentColor → suit la couleur du texte */}
                      <span className="shrink-0">{link.icon}</span>
                      <span className="truncate">{link.label}</span>
                    </NavLink>
                  </li>
                )
            )}
          </ul>
        </nav>
      </aside>

      {/* Mobile toggle */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-blue-900 rounded-full p-2 text-white"
        onClick={() => setOpen(!open)}
      >
        <Menu size={28} />
      </button>

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-blue-900 text-white z-50 transform ${
          open ? "translate-x-0" : "-translate-x-full"
        } transition-transform md:hidden`}
      >
        <div className="px-6 py-4 font-bold text-xl tracking-wider flex justify-between items-center">
          EnerTrack
          <button className="text-white" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <nav className="flex-1">
          <ul className="space-y-2 mt-2">
            {sidebarLinks.map(
              (link) =>
                (!link.adminOnly || userRole === "admin") && (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        [
                          "group flex items-center gap-3 px-6 py-2 rounded-xl transition-colors",
                          isActive
                            ? "bg-white/15 text-white"
                            : "text-white hover:bg-white/10"
                        ].join(" ")
                      }
                    >
                      <span className="shrink-0">{link.icon}</span>
                      <span className="truncate">{link.label}</span>
                    </NavLink>
                  </li>
                )
            )}
          </ul>
        </nav>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
