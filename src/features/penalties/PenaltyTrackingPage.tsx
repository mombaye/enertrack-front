import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  Gauge,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";

import {
  getImpactedSitesApi,
  type ImpactedSiteRow,
  type PenaltyFilter,
} from "./api";

type Row = Omit<ImpactedSiteRow, "cosphi_kind"> & {
  period: string;
  cosphi_penalty: number;
  cosphi_bonus: number;
  prime_penalty: number;
  total_penalty: number;
  net_impact: number;
  cosphi_kind: "MALUS" | "BONUS" | "NEUTRAL";
};

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function defaultRange() {
  const now = new Date();
  return {
    start: fmtDate(new Date(now.getFullYear(), 0, 1)),
    end: fmtDate(now),
  };
}

function asNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(asNumber(value));
}

function percent(value: unknown) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(asNumber(value));
}


function getCosphiKind(value: unknown): "MALUS" | "BONUS" | "NEUTRAL" {
  const n = asNumber(value);

  if (n > 0) return "MALUS";
  if (n < 0) return "BONUS";

  return "NEUTRAL";
}

function getCosphiLabel(value: unknown) {
  const kind = getCosphiKind(value);

  if (kind === "MALUS") return "Malus";
  if (kind === "BONUS") return "Bonus";

  return "Neutre";
}



function getCosphiTone(value: unknown): "default" | "red" | "green" {
  const kind = getCosphiKind(value);

  if (kind === "MALUS") return "red";
  if (kind === "BONUS") return "green";

  return "default";
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "blue" | "red" | "amber" | "green";
}) {
  const styles = {
    default: "border-slate-200 bg-slate-50 text-slate-600",
    blue: "border-blue-100 bg-blue-50 text-blue-900",
    red: "border-red-100 bg-red-50 text-red-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function KpiCard({
  label,
  value,
  helper,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  helper?: string;
  icon: React.ReactNode;
  tone?: "blue" | "red" | "amber" | "green";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-900",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>
          <p className="mt-1.5 text-[22px] font-extrabold tracking-tight text-slate-950">
            {value}
          </p>
          {helper ? (
            <p className="mt-1 text-xs font-medium text-slate-500">{helper}</p>
          ) : null}
        </div>

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${styles[tone]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className="text-[15px] font-extrabold text-slate-950">{title}</h2>
      {subtitle ? (
        <p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

export default function PenaltyTrackingPage() {
  const def = useMemo(() => defaultRange(), []);

  const [start, setStart] = useState(def.start);
  const [end, setEnd] = useState(def.end);
  const [filter, setFilter] = useState<PenaltyFilter>("both");
  const [minAmount, setMinAmount] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"total" | "cosphi" | "penalty">("total");

  const q = useQuery({
    queryKey: ["penalties-impacted-sites", start, end, filter, minAmount],
    queryFn: () =>
      getImpactedSitesApi({
        start,
        end,
        filter,
        min_amount: minAmount,
      }),
    staleTime: 20_000,
  });

  const rows: Row[] = useMemo(() => {
    const all =
      q.data?.by_month.flatMap((month) =>
        month.sites.map((site) => {
          const cosphi = asNumber(site.montant_cosphi);
            const penalty = asNumber(site.penalite_prime);

            const cosphiPenalty = cosphi > 0 ? cosphi : 0;
            const cosphiBonus = cosphi < 0 ? Math.abs(cosphi) : 0;
            const primePenalty = penalty > 0 ? penalty : 0;

            return {
              ...site,
              period: month.period,

              cosphi_kind: getCosphiKind(cosphi),
              cosphi_penalty: cosphiPenalty,
              cosphi_bonus: cosphiBonus,
              prime_penalty: primePenalty,

          
              // Total des malus Cos Phi + pénalités Prime Fixe
              total_penalty: cosphiPenalty + primePenalty,

              
              // Impact net après prise en compte du bonus Cos Phi
              net_impact: cosphiPenalty + primePenalty - cosphiBonus,
          };
        })
      ) || [];

    const s = search.trim().toLowerCase();

    const filtered = !s
      ? all
      : all.filter(
          (row) =>
            row.site_id?.toLowerCase().includes(s) ||
            row.site_name?.toLowerCase().includes(s) ||
            row.numero_compte_contrat?.toLowerCase().includes(s) ||
            row.period?.toLowerCase().includes(s)
        );

    return [...filtered].sort((a, b) => {
      if (sortBy === "cosphi") {
        return Math.abs(asNumber(b.montant_cosphi)) - Math.abs(asNumber(a.montant_cosphi));
      }

      if (sortBy === "penalty") {
        return asNumber(b.penalite_prime) - asNumber(a.penalite_prime);
      }

      return b.total_penalty - a.total_penalty;
    });
  }, [q.data, search, sortBy]);

  const topRows = rows.slice(0, 5);

  const totalPenalty = asNumber(q.data?.summary.total_penalty);

  const totalCosphiPenalty = rows.reduce(
    (sum, row) => sum + row.cosphi_penalty,
    0
  );

  const totalCosphiBonus = rows.reduce(
    (sum, row) => sum + row.cosphi_bonus,
    0
  );

  const totalImpact = totalCosphiPenalty + totalPenalty - totalCosphiBonus;

  return (
    <div className="min-h-screen bg-[#F5F7FB] px-4 py-4 lg:px-6">
      <div className="mx-auto max-w-[1540px] space-y-4">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-900">
                <ShieldAlert size={14} />
                Module dédié
              </div>

              <h1 className="mt-3 text-[26px] font-extrabold tracking-tight text-blue-900">
                Suivi Pénalités
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Analyse des bonus/malus Cos Phi et des pénalités Prime Fixe par site, contrat et mois.
                Les montants sont issus des synthèses mensuelles de facturation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:w-[420px]">
              <div className="rounded-2xl bg-blue-900 px-4 py-3 text-white">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-100">
                  Impact total
                </p>
                <p className="mt-1 text-xl font-extrabold">
                  {money(totalImpact)} FCFA
                </p>
                <p className="text-xs text-blue-100">sur la période</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Sites impactés
                </p>
                <p className="mt-1 text-xl font-extrabold text-slate-950">
                  {rows.length}
                </p>
                <p className="text-xs text-slate-500">lignes affichées</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <SectionTitle
              title="Filtres d’analyse"
              subtitle="Sélectionne la période, le type de pénalité et le seuil minimum."
            />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[170px_170px_190px_150px_160px]">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Début
                </label>
                <div className="relative">
                  <CalendarDays
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Fin
                </label>
                <div className="relative">
                  <CalendarDays
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Type
                </label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as PenaltyFilter)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="both">Cos Phi + Prime Fixe</option>
                  <option value="cosphi">Cos Phi Bonus / Malus</option>
                  <option value="penalty">Prime Fixe uniquement</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Montant min.
                </label>
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(Number(e.target.value || 0))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <button
                onClick={() => q.refetch()}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-900 px-4 text-sm font-extrabold text-white transition hover:bg-blue-800"
              >
                {q.isFetching ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCcw size={16} />
                )}
                Actualiser
              </button>
            </div>
          </div>
        </div>

        {/* KPI */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Malus Cos Phi"
            value={`${money(totalCosphiPenalty)} FCFA`}
            helper="montants Cos Phi positifs"
            icon={<Gauge size={18} />}
            tone="red"
          />

          <KpiCard
            label="Bonus Cos Phi"
            value={`${money(totalCosphiBonus)} FCFA`}
            helper="montants Cos Phi négatifs"
            icon={<TrendingUp size={18} />}
            tone="green"
          />

          <KpiCard
            label="Pénalité Prime"
            value={`${money(totalPenalty)} FCFA`}
            helper={`${q.data?.summary.sites_penalty_count || 0} site(s) concerné(s)`}
            icon={<AlertTriangle size={18} />}
            tone="amber"
          />

          <KpiCard
            label="Impact net"
            value={`${money(totalImpact)} FCFA`}
            helper="malus + pénalités prime - bonus"
            icon={<Wallet size={18} />}
            tone={totalImpact >= 0 ? "blue" : "green"}
          />
        </div>

        {/* Top cards */}
        {topRows.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <SectionTitle
                title="Top impacts"
                subtitle="Les sites avec les impacts Cos Phi et Prime Fixe les plus élevés."
              />

              <Badge tone="blue">
                <Zap size={12} className="mr-1" />
                Top {topRows.length}
              </Badge>
            </div>

            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
              {topRows.map((row, idx) => (
                <div
                  key={`${row.period}-${row.site_id}-${row.numero_compte_contrat}-${idx}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-slate-950">
                        {row.site_id}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                        {row.site_name || row.numero_compte_contrat}
                      </p>
                    </div>
                    <Badge tone="blue">{row.period}</Badge>
                  </div>

                  <p className="mt-4 text-xl font-extrabold text-blue-900">
                    {money(row.total_penalty)} FCFA
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-xl bg-white p-2">
                      <p className="text-slate-400">Bonus / Malus Cos Phi</p>
                      <p className="font-extrabold text-amber-700">
                        {money(row.montant_cosphi)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white p-2">
                      <p className="text-slate-400">Prime</p>
                      <p className="font-extrabold text-red-700">
                        {money(row.penalite_prime)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
            <SectionTitle
              title="Détail des sites impactés"
              subtitle="Vue par mois, site et compte contrat."
            />

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                {[
                  ["total", "Impact total"],
                  ["cosphi", "Cos Phi"],
                  ["penalty", "Prime Fixe"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key as "total" | "cosphi" | "penalty")}
                    className={`h-8 rounded-lg px-3 text-xs font-extrabold transition ${
                      sortBy === key
                        ? "bg-blue-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Site, contrat, mois..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 md:w-[280px]"
                />
              </div>
            </div>
          </div>

          {q.isLoading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <Loader2 size={18} className="animate-spin text-blue-900" />
                Chargement des pénalités...
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <SlidersHorizontal size={20} />
              </div>
              <h3 className="mt-4 text-base font-extrabold text-slate-950">
                Aucun site impacté
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Ajuste la période, le type de pénalité ou le montant minimum.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px]">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    <th className="border-b border-slate-200 px-4 py-3">Mois</th>
                    <th className="border-b border-slate-200 px-4 py-3">Site</th>
                    <th className="border-b border-slate-200 px-4 py-3">Contrat</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right">Cos Phi</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right">Prime Fixe</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right">Impact total</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right">Montant HT</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right">% Cos Phi</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right">% Prime</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, idx) => {
                    const cosphi = asNumber(row.montant_cosphi);
                    const prime = asNumber(row.penalite_prime);

                    return (
                      <tr
                        key={`${row.period}-${row.site_id}-${row.numero_compte_contrat}-${idx}`}
                        className="text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        <td className="border-b border-slate-200 px-4 py-3">
                          <Badge tone="blue">{row.period}</Badge>
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3">
                          <div className="font-extrabold text-slate-950">
                            {row.site_id}
                          </div>
                          <div className="mt-0.5 max-w-[240px] truncate text-xs text-slate-400">
                            {row.site_name || "-"}
                          </div>
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3 font-semibold">
                          {row.numero_compte_contrat}
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Badge tone={getCosphiTone(row.montant_cosphi)}>
                              {getCosphiLabel(row.montant_cosphi)}
                            </Badge>

                            <span
                              className={`font-extrabold ${
                                asNumber(row.montant_cosphi) > 0
                                  ? "text-red-700"
                                  : asNumber(row.montant_cosphi) < 0
                                  ? "text-emerald-700"
                                  : "text-slate-400"
                              }`}
                            >
                              {money(row.montant_cosphi)}
                            </span>
                          </div>
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3 text-right">
                          <span
                            className={`font-extrabold ${
                              prime > 0 ? "text-red-700" : "text-slate-400"
                            }`}
                          >
                            {money(prime)}
                          </span>
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3 text-right font-extrabold text-blue-900">
                          {money(row.total_penalty)}
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3 text-right font-medium">
                          {money(row.montant_hors_tva)}
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3 text-right font-medium">
                          {percent(row.pct_cosphi_sur_ht)}%
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3 text-right font-medium">
                          {percent(row.pct_penalty_sur_ht)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}