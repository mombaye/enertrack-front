
import { useState } from "react";
import { Home, Building2, FileText, User, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";

const sidebarLinks = [
  { to: "/", icon: <Home />, label: "Dashboard" },
  { to: "/sites", icon: <Building2 />, label: "Sites" },
  { to: "/invoices", icon: <FileText />, label: "Factures" },
  { to: "/users", icon: <User />, label: "Utilisateurs", adminOnly: true },
];

export default function Sidebar({ userRole = "analyst" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col bg-white text-white w-64 h-screen fixed left-0 top-0 z-40">
        <div className="px-6 py-4 font-bold text-xl tracking-wider">EnerTrack</div>
        <nav className="flex-1">
          <ul className="space-y-2 mt-4">
            {sidebarLinks.map(
              link =>
                (!link.adminOnly || userRole === "admin") && (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      className={({ isActive }) =>
                        `flex items-center px-6 py-2 text-base rounded-xl transition-all ${
                          isActive ? "bg-blue-800" : "hover:bg-blue-700"
                        }`
                      }
                    >
                      <span className="mr-3">{link.icon}</span>
                      {link.label}
                    </NavLink>
                  </li>
                )
            )}
          </ul>
        </nav>
      </aside>
      {/* Mobile sidebar */}
      <button className="md:hidden fixed top-4 left-4 z-50 bg-blue-900 rounded-full p-2 text-white" onClick={() => setOpen(!open)}>
        <Menu size={28} />
      </button>
      <aside className={`fixed top-0 left-0 h-full w-64 bg-primary text-white z-50 transform ${open ? "translate-x-0" : "-translate-x-full"} transition-transform md:hidden`}>
        <div className="px-6 py-4 font-bold text-xl tracking-wider flex justify-between items-center">
          EnerTrack
          <button className="text-white" onClick={() => setOpen(false)}>✕</button>
        </div>
        <nav className="flex-1">
          <ul className="space-y-2 mt-4">
            {sidebarLinks.map(
              link =>
                (!link.adminOnly || userRole === "admin") && (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center px-6 py-2 text-base rounded-xl transition-all ${
                          isActive ? "bg-blue-800" : "hover:bg-blue-700"
                        }`
                      }
                    >
                      <span className="mr-3">{link.icon}</span>
                      {link.label}
                    </NavLink>
                  </li>
                )
            )}
          </ul>
        </nav>
      </aside>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setOpen(false)}></div>}
    </>
  );
}
