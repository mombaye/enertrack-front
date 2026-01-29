import { LogOut } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();
  const roleLabel = user?.role === "admin" ? "Administrateur" : "Analyste";

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200">
      <div className="flex items-center justify-between px-4 py-3 md:px-8">
        <div className="md:hidden" />
        <div className="hidden md:block">
          <div className="text-slate-900 font-semibold">EnerTrack</div>
          <div className="text-xs text-slate-500">Analyse Énergie & Réseau</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="h-9 w-9 rounded-2xl bg-blue-900 text-white flex items-center justify-center font-semibold">
              {(user?.username || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">
                {user?.username || "Utilisateur"}
              </div>
              <div className="text-xs text-slate-500">{roleLabel}</div>
            </div>
          </div>

          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-900 text-white px-4 py-2
                       hover:bg-blue-950 transition shadow-sm"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm font-semibold">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
