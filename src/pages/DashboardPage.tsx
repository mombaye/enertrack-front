// pages/DashboardPage.tsx
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  BarChart3,
  LineChart,
  PieChart,
  Receipt,
  Settings2,
  ArrowRight,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "amber" | "slate" }) {
  const toneCls =
    tone === "blue"
      ? "bg-blue-900/10 text-blue-900 border-blue-900/15"
      : tone === "amber"
      ? "bg-amber-500/10 text-amber-900 border-amber-500/20"
      : "bg-slate-900/5 text-slate-700 border-slate-900/10";
  return <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", toneCls)}>{children}</span>;
}

function Card({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5",
        "shadow-[0_18px_60px_rgba(2,6,23,0.06)]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon ? <div className="text-slate-500">{icon}</div> : null}
          <div className="text-sm font-extrabold text-slate-900">{title}</div>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role || "analyst";
  const isAdmin = role === "admin";

  const roadmap = useMemo(
    () => [
      { icon: <BarChart3 className="h-4 w-4" />, title: "KPIs globaux", desc: "Totaux HT/TTC, NRJ, Abonnement, PenPrime par période." },
      { icon: <LineChart className="h-4 w-4" />, title: "Évolution", desc: "Courbes mensuelles et comparaisons multi-sites." },
      { icon: <PieChart className="h-4 w-4" />, title: "Répartition", desc: "Parts NRJ / CosPhi / Pénalité / Abonnement." },
      { icon: <Receipt className="h-4 w-4" />, title: "Anomalies & suivi", desc: "Factures contestées, manquantes, sites non mappés." },
      ...(isAdmin
        ? [{ icon: <Settings2 className="h-4 w-4" />, title: "Admin", desc: "Tarifs, mapping contrat↔site, compute & imports." }]
        : []),
    ],
    [isAdmin]
  );

  return (
    <div className="px-6 py-6">
      {/* Hero */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-slate-200 bg-white",
          "shadow-[0_18px_60px_rgba(2,6,23,0.06)]"
        )}
      >
        {/* soft background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-20 h-80 w-80 rounded-full bg-blue-900/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-slate-900/5 blur-3xl" />
        </div>

        <div className="relative p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="blue">
                  <Sparkles className="h-3.5 w-3.5" />
                  Coming soon
                </Pill>
                <Pill tone="slate">
                  <Clock className="h-3.5 w-3.5" />
                  Dashboard en préparation
                </Pill>
                {isAdmin ? (
                  <Pill tone="amber">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mode admin activé
                  </Pill>
                ) : null}
              </div>

              <h1 className="mt-4 text-2xl md:text-3xl font-extrabold text-slate-900">
                Bonjour {user?.username || "👋"} — le Dashboard arrive.
              </h1>
              <p className="mt-2 text-slate-600">
                On finalise une vue <span className="font-semibold">pro</span> avec KPIs, tendances, répartition et alertes
                pour suivre la facturation Sonatel et l’analyse énergie. En attendant, tu peux déjà tout piloter depuis les écrans Facturation.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/billing/sonatel"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-4 py-3 font-extrabold",
                    "bg-blue-900 text-white border border-blue-900 hover:opacity-95"
                  )}
                >
                  Aller sur Billing Sonatel <ArrowRight className="h-4 w-4" />
                </Link>

                {isAdmin ? (
                  <Link
                    to="/billing/sonatel/config"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl px-4 py-3 font-extrabold",
                      "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    Ouvrir Config Sonatel <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>
            </div>

            {/* status box */}
            <div className="w-full md:w-[360px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold tracking-wide text-slate-500">STATUT</div>
              <div className="mt-2 text-lg font-extrabold text-slate-900">En cours de construction</div>
              <div className="mt-1 text-sm text-slate-600">
                Prochaine étape : <span className="font-semibold">KPIs + filtres</span> puis <span className="font-semibold">graphiques</span>.
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <span className="text-sm font-semibold text-slate-800">Base</span>
                  <span className="text-xs font-semibold text-slate-500">OK</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <span className="text-sm font-semibold text-slate-800">KPIs</span>
                  <span className="text-xs font-semibold text-slate-500">Soon</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <span className="text-sm font-semibold text-slate-800">Charts</span>
                  <span className="text-xs font-semibold text-slate-500">Soon</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Roadmap cards */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {roadmap.map((r) => (
          <Card key={r.title} title={r.title} icon={r.icon}>
            <div className="text-sm text-slate-600">{r.desc}</div>
          </Card>
        ))}
      </div>

      {/* Tip */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(2,6,23,0.06)]">
        <div className="text-sm font-extrabold text-slate-900">Astuce</div>
        <div className="mt-1 text-sm text-slate-600">
          Pour une expérience “Dashboard-like” dès maintenant : ouvre <span className="font-semibold">Billing Sonatel</span> → onglet{" "}
          <span className="font-semibold">Stats</span> et utilise la période du parent.
        </div>
      </div>
    </div>
  );
}
