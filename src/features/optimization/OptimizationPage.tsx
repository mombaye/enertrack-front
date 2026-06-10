import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Loader2,
  Play,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  Wallet,
} from "lucide-react";

import {
  listOptimizationBatchesApi,
  listOptimizationResultsApi,
  runPowerOptimizationApi,
  type OptimizationBatch,
  type OptimizationResult,
} from "./api";

type ViewMode = "opportunities" | "all" | "errors";

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

function num(value: unknown, digits = 0) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: digits,
  }).format(asNumber(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getSiteCode(row: OptimizationResult) {
  return row.site_id || row.site_code || "-";
}

function getGain(row: OptimizationResult) {
  return asNumber(row.best_gain || row.gain_power);
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "blue" | "green" | "amber" | "red";
}) {
  const styles = {
    default: "border-slate-200 bg-slate-50 text-slate-600",
    blue: "border-blue-100 bg-blue-50 text-blue-900",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    red: "border-red-100 bg-red-50 text-red-700",
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
  tone?: "blue" | "green" | "slate";
}) {
  const iconStyles = {
    blue: "bg-blue-50 text-blue-900",
    green: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
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
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconStyles[tone]}`}
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

export default function OptimizationPage() {
  const queryClient = useQueryClient();

  const [referenceDate, setReferenceDate] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("opportunities");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const batchesQuery = useQuery({
    queryKey: ["optimization-batches"],
    queryFn: listOptimizationBatchesApi,
    staleTime: 20_000,
  });

  const latestBatch: OptimizationBatch | undefined = batchesQuery.data?.[0];

  useEffect(() => {
    setPage(1);
  }, [search, viewMode, pageSize, latestBatch?.id]);

  const resultsQuery = useQuery({
    queryKey: [
      "optimization-results",
      latestBatch?.id,
      search,
      viewMode,
      page,
      pageSize,
    ],
    queryFn: () =>
      listOptimizationResultsApi({
        batch: latestBatch?.id,
        search: search || undefined,
        gain_only: viewMode === "opportunities",
        status: viewMode === "errors" ? "ERROR" : undefined,
        page,
        page_size: pageSize,
      }),
    enabled: Boolean(latestBatch?.id),
    staleTime: 15_000,
  });

  const topOpportunitiesQuery = useQuery({
    queryKey: ["optimization-top-opportunities", latestBatch?.id],
    queryFn: () =>
      listOptimizationResultsApi({
        batch: latestBatch?.id,
        gain_only: true,
        page: 1,
        page_size: 5,
      }),
    enabled: Boolean(latestBatch?.id),
    staleTime: 20_000,
  });

  const runMutation = useMutation({
    mutationFn: () =>
      runPowerOptimizationApi({
        eligible: eligibleOnly,
        ref_date: referenceDate || undefined,
      }),
    onSuccess: async () => {
      toast.success("Optimisation puissance lancée avec succès.");
      await queryClient.invalidateQueries({ queryKey: ["optimization-batches"] });
      await queryClient.invalidateQueries({ queryKey: ["optimization-results"] });
      await queryClient.invalidateQueries({
        queryKey: ["optimization-top-opportunities"],
      });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Erreur pendant le lancement de l’optimisation.";
      toast.error(msg);
    },
  });

  const rows = resultsQuery.data?.rows || [];
  const totalRows = resultsQuery.data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const topRows = topOpportunitiesQuery.data?.rows || [];

  const optimizationRate = useMemo(() => {
    const analyzed = asNumber(latestBatch?.contracts_analyzed);
    const optimized = asNumber(latestBatch?.optimizable_power_count);
    if (!analyzed) return 0;
    return (optimized / analyzed) * 100;
  }, [latestBatch]);

  const averageGain = useMemo(() => {
    const count = asNumber(latestBatch?.optimizable_power_count);
    const total = asNumber(latestBatch?.total_power_gain);
    if (!count) return 0;
    return total / count;
  }, [latestBatch]);

  return (
    <div className="min-h-screen bg-[#F5F7FB] px-4 py-4 lg:px-6">
      <div className="mx-auto max-w-[1540px] space-y-4">
        {/* Header */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-900">
                <ShieldCheck size={14} />
                Module 3
              </div>

              <h1 className="mt-3 text-[26px] font-extrabold tracking-tight text-blue-900">
                Optimisation Puissance & Tarif
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Analyse globale du parc éligible, identification des contrats à
                optimiser et estimation des gains annuels sur la puissance
                souscrite.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:w-[360px]">
              <div className="rounded-2xl bg-blue-900 px-4 py-3 text-white">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-100">
                  Dernier batch
                </p>
                <p className="mt-1 text-2xl font-extrabold">
                  {latestBatch?.id ? `#${latestBatch.id}` : "—"}
                </p>
                <p className="text-xs text-blue-100">
                  {latestBatch?.status || "Aucun lancement"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Dernier calcul
                </p>
                <p className="mt-1 text-sm font-extrabold text-slate-950">
                  {formatDateTime(
                    latestBatch?.finished_at || latestBatch?.launched_at
                  )}
                </p>
                <p className="text-xs text-slate-500">optimisation puissance</p>
              </div>
            </div>
          </div>
        </div>

       
        {/* Launch */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-start">
            <div className="pt-5 xl:pt-6">
              <SectionTitle
                title="Lancement global"
                subtitle="Le calcul parcourt les contrats éligibles et sauvegarde les résultats dans un batch."
              />

              <p className="mt-3 max-w-4xl text-[12px] leading-5 text-slate-500">
                Aktivco uniquement = sites dont le mode de facturation contient
                “Aktivco” et dont le grid fee est activé. Si la date est vide, chaque
                contrat utilise sa dernière date de fin de facture.
              </p>
            </div>

            <div className="grid w-full gap-3 md:grid-cols-[220px_180px_260px] xl:w-auto xl:items-end">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Date de référence
                </label>

                <div className="relative">
                  <CalendarDays
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="date"
                    value={referenceDate}
                    onChange={(e) => setReferenceDate(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Périmètre
                </label>

                <button
                  onClick={() => setEligibleOnly((v) => !v)}
                  className={`h-11 w-full rounded-xl border px-3 text-sm font-bold transition ${
                    eligibleOnly
                      ? "border-blue-900 bg-blue-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {eligibleOnly ? "Aktivco uniquement" : "Tous contrats"}
                </button>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-transparent">
                  Action
                </label>

                <button
                  onClick={() => runMutation.mutate()}
                  disabled={runMutation.isPending}
                  className="h-11 w-full rounded-xl bg-blue-900 px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex items-center justify-center gap-2">
                    {runMutation.isPending ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Play size={17} />
                    )}
                    Lancer optimisation puissance
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KPI */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-1">
            <KpiCard
              label="Analysés"
              value={num(latestBatch?.contracts_analyzed)}
              helper={`${num(latestBatch?.contracts_skipped)} ignoré(s)`}
              icon={<BarChart3 size={18} />}
            />
          </div>

          <div className="xl:col-span-1">
            <KpiCard
              label="Opportunités"
              value={num(latestBatch?.optimizable_power_count)}
              helper={`${num(optimizationRate, 2)}% du parc`}
              icon={<Target size={18} />}
              tone="green"
            />
          </div>

          <div className="xl:col-span-2">
            <KpiCard
              label="Gain puissance total"
              value={`${money(latestBatch?.total_power_gain)} FCFA`}
              helper="gain potentiel annuel"
              icon={<TrendingDown size={18} />}
              tone="green"
            />
          </div>

          <div className="xl:col-span-1">
            <KpiCard
              label="Gain moyen"
              value={`${money(averageGain)} FCFA`}
              helper="par opportunité"
              icon={<Gauge size={18} />}
            />
          </div>

          <div className="xl:col-span-1">
            <KpiCard
              label="Gain retenu"
              value={`${money(latestBatch?.total_best_gain)} FCFA`}
              helper="scénario courant"
              icon={<Wallet size={18} />}
            />
          </div>
        </div>

        {/* Top opportunities */}
        {topRows.length > 0 ? (
          <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <SectionTitle
                title="Top opportunités"
                subtitle="Contrats avec les gains estimés les plus élevés."
              />
              <Badge tone="green">
                <Sparkles size={12} className="mr-1" />
                {num(topOpportunitiesQuery.data?.count)} opportunité(s)
              </Badge>
            </div>

            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
              {topRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold text-slate-950">
                        {getSiteCode(row)}
                      </p>
                      <p className="mt-0.5 max-w-[160px] truncate text-xs text-slate-500">
                        {row.site_name || row.numero_compte_contrat}
                      </p>
                    </div>
                    <Badge tone="green">{row.tariff_current || "-"}</Badge>
                  </div>

                  <p className="mt-4 text-xl font-extrabold text-emerald-700">
                    {money(getGain(row))} FCFA
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <p className="text-slate-400">PS</p>
                      <p className="font-bold text-slate-900">
                        {num(row.ps_current, 1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Pmax</p>
                      <p className="font-bold text-slate-900">
                        {num(row.pmax_avg, 1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Optim.</p>
                      <p className="font-bold text-blue-900">
                        {num(row.ps_optimized, 1)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Results */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
            <SectionTitle
              title="Résultats de l’optimisation puissance"
              subtitle="Affichage paginé du dernier batch."
            />

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                {[
                  ["opportunities", "Opportunités"],
                  ["all", "Tous"],
                  ["errors", "Erreurs"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setViewMode(key as ViewMode)}
                    className={`h-8 rounded-lg px-3 text-xs font-extrabold transition ${
                      viewMode === key
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
                  placeholder="Contrat, site..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 md:w-[260px]"
                />
              </div>

              <button
                onClick={() => {
                  queryClient.invalidateQueries({
                    queryKey: ["optimization-results"],
                  });
                  queryClient.invalidateQueries({
                    queryKey: ["optimization-top-opportunities"],
                  });
                }}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCcw size={15} />
                Actualiser
              </button>
            </div>
          </div>

          {!latestBatch?.id ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-900">
                <Target size={20} />
              </div>
              <h3 className="mt-4 text-base font-extrabold text-slate-950">
                Aucun batch disponible
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Lance une optimisation puissance pour générer les résultats.
              </p>
            </div>
          ) : resultsQuery.isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <Loader2 size={18} className="animate-spin text-blue-900" />
                Chargement des résultats...
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
              <CheckCircle2 size={28} className="text-slate-400" />
              <h3 className="mt-3 text-base font-extrabold text-slate-950">
                Aucun résultat à afficher
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Change la vue ou modifie la recherche.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1220px]">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      <th className="border-b border-slate-200 px-4 py-3">
                        Contrat
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3">
                        Site
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3">
                        Tarif
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-right">
                        PS
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-right">
                        Pmax moy.
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-right">
                        PS optim.
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-right">
                        Facture réf.
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-right">
                        Facture optim.
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-right">
                        Gain
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-right">
                        Statut
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => {
                      const gain = getGain(row);
                      const hasGain = gain > 0;

                      return (
                        <tr
                          key={row.id}
                          className={`text-sm text-slate-700 transition hover:bg-slate-50 ${
                            hasGain ? "bg-emerald-50/30" : ""
                          }`}
                        >
                          <td className="border-b border-slate-200 px-4 py-3">
                            <div className="font-extrabold text-slate-950">
                              {row.numero_compte_contrat}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-400">
                              {row.period_start || "-"} → {row.period_end || "-"}
                            </div>
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3">
                            <div className="font-extrabold text-slate-950">
                              {getSiteCode(row)}
                            </div>
                            <div className="mt-0.5 max-w-[230px] truncate text-xs text-slate-400">
                              {row.site_name || "-"}
                            </div>
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Badge tone="blue">
                                {row.tariff_current || "-"}
                              </Badge>
                              <Badge>{row.tariff_family || "UNKNOWN"}</Badge>
                            </div>
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3 text-right font-medium">
                            {num(row.ps_current, 1)}
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3 text-right font-medium">
                            {num(row.pmax_avg, 1)}
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3 text-right font-extrabold text-blue-900">
                            {num(row.ps_optimized, 1)}
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3 text-right font-medium">
                            {money(row.facture_reference)}
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3 text-right font-medium">
                            {money(row.facture_power_optimized)}
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3 text-right">
                            <span
                              className={`font-extrabold ${
                                hasGain ? "text-emerald-700" : "text-slate-400"
                              }`}
                            >
                              {money(gain)} FCFA
                            </span>
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3 text-right">
                            {row.status === "ERROR" ? (
                              <Badge tone="red">Erreur</Badge>
                            ) : row.status === "SKIPPED" ? (
                              <Badge tone="amber">Ignoré</Badge>
                            ) : hasGain ? (
                              <Badge tone="green">Gain</Badge>
                            ) : (
                              <Badge>Aucun gain</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <p className="text-xs font-medium text-slate-500">
                  {num(totalRows)} résultat(s) — page {page} / {totalPages}
                </p>

                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value={10}>10 lignes</option>
                    <option value={25}>25 lignes</option>
                    <option value={50}>50 lignes</option>
                    <option value={100}>100 lignes</option>
                  </select>

                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {latestBatch?.status === "FAILED" || latestBatch?.error_message ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 text-red-600" />
              <div>
                <h3 className="text-sm font-extrabold text-red-900">
                  Dernier batch en erreur
                </h3>
                <p className="mt-1 text-sm text-red-800">
                  {latestBatch?.error_message || "Erreur inconnue."}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}