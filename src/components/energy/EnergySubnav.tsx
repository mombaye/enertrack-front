// src/components/energy/EnergySubnav.tsx
import { NavLink } from "react-router-dom";

export default function EnergySubnav() {
  const linkBase =
    "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors";
  return (
    <div className="flex items-center gap-2">
      <NavLink
        to="/energy"
        end
        className={({ isActive }) =>
          isActive
            ? `${linkBase} bg-blue-900 text-white`
            : `${linkBase} bg-white text-blue-900 ring-1 ring-slate-200 hover:bg-slate-50`
        }
      >
        Vue globale
      </NavLink>
      <NavLink
        to="/energy/sites"
        className={({ isActive }) =>
          isActive
            ? `${linkBase} bg-blue-900 text-white`
            : `${linkBase} bg-white text-blue-900 ring-1 ring-slate-200 hover:bg-slate-50`
        }
      >
        Sites energy
      </NavLink>
    </div>
  );
}
