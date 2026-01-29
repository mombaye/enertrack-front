import { Outlet, NavLink } from "react-router-dom";
import { cn } from "@/features/sonatelBilling/ui";

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "px-4 py-2 rounded-2xl border font-semibold transition",
          isActive ? "bg-blue-900 text-white border-blue-900" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        )
      }
    >
      {label}
    </NavLink>
  );
}

export default function SonatelConfigPage() {
  return (
    <div className="p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(2,6,23,0.06)]">
        <h1 className="text-2xl font-extrabold text-slate-900">Config Sonatel</h1>
        <p className="text-slate-500 mt-1">Tarifs • Mapping Contrat↔Site • Mise à jour statuts • Compute</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <TabLink to="/billing/sonatel/config/tariffs" label="Tarifs" />
          <TabLink to="/billing/sonatel/config/contract-sites" label="Mapping Contrat ↔ Site" />

          <TabLink to="/billing/sonatel/config/compute" label="Compute" />
      
          <TabLink to="/billing/sonatel/config/import-invoices" label="Import factures" />
          <TabLink to="/billing/sonatel/config/status-update" label="Maj statuts" />

        </div>
      </div>

      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  );
}
