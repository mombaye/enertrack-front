import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
} from "recharts";
import { AlertTriangle, BarChart3, LineChart as LineChartIcon, PieChart as PieIcon } from "lucide-react";

import { cn, money, num } from "@/features/sonatelBilling/ui";
import { getSonatelBillingStats, SonatelBillingStats } from "@/features/sonatelBilling/api";

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function clampLabel(s: string, max = 10) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
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
    <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_rgba(2,6,23,0.06)]", className)}>
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-2">
          {icon ? <div className="text-slate-500">{icon}</div> : null}
          <div className="text-sm font-extrabold text-slate-900">{title}</div>
        </div>
      </div>
      <div className="px-5 pb-5 pt-4">{children}</div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(2,6,23,0.06)]">
      <div className="text-xs font-semibold tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

function StickyTable({
  rows,
  mode,
}: {
  rows: Array<any>;
  mode: "CONSO_VS_MONTANT" | "COSPHI" | "PEN_PRIME" | "ABONNEMENT";
}) {
  const headers =
    mode === "CONSO_VS_MONTANT"
      ? ["#", "Site", "Conso", "Montant HT"]
      : mode === "COSPHI"
      ? ["#", "Site", "Montant Cos Phi", "Montant HT"]
      : mode === "PEN_PRIME"
      ? ["#", "Site", "Pénalité prime", "Montant HT"]
      : ["#", "Site", "Abonnement", "Montant HT"];

  const getV = (r: any) => {
    if (mode === "CONSO_VS_MONTANT") return { a: num(r.conso), b: money(r.montant_ht) };
    if (mode === "COSPHI") return { a: money(r.montant_cosphi), b: money(r.montant_ht) };
    if (mode === "PEN_PRIME") return { a: money(r.penalite_prime), b: money(r.montant_ht) };
    return { a: money(r.abonnement), b: money(r.montant_ht) };
  };

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200">
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-slate-300 px-3 py-2 text-left text-xs font-extrabold tracking-wide text-slate-600"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const v = getV(r);
            return (
              <tr key={`${r.site_id}-${idx}`} className="hover:bg-slate-50/60">
                <td className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                  {idx + 1}
                </td>
                <td className="border-b border-slate-200 px-3 py-2">
                  <div className="font-semibold text-slate-900">{r.site_id || "—"}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[320px]">{r.site_name || ""}</div>
                </td>
                <td className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 whitespace-nowrap">
                  {v.a}
                </td>
                <td className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 whitespace-nowrap">
                  {v.b}
                </td>
              </tr>
            );
          })}
          {!rows.length ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
                Aucune donnée
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export default function SonatelBillingStatsTab({ start, end }: { start: string; end: string }) {
  const [topMode, setTopMode] = useState<"CONSO_VS_MONTANT" | "COSPHI" | "PEN_PRIME" | "ABONNEMENT">("CONSO_VS_MONTANT");

  const statsQ = useQuery<SonatelBillingStats>({
    queryKey: ["sb-stats", { start, end }],
    queryFn: () => getSonatelBillingStats({ start, end }),
    placeholderData: keepPreviousData,
  });

  const data = statsQ.data;

  const distribution = useMemo(() => {
    const parts = data?.distribution_ht?.parts ?? [];
    return parts.map((p) => ({
      key: p.key,
      label: p.label,
      value: toNum(p.value),
      percent: toNum(p.percent),
    }));
  }, [data]);

  const evo = useMemo(() => {
    const rows = data?.evolution ?? [];
    return rows.map((r) => ({
      period: r.period,
      invoices: r.invoices ?? 0,
      montant_ht: toNum(r.montant_ht),
      montant_ttc: toNum(r.montant_ttc),
      nrj: toNum(r.nrj),
      abonnement: toNum(r.abonnement),
      penalite_prime: toNum(r.penalite_prime),
      cosphi: toNum(r.cosphi),
    }));
  }, [data]);

  const topRows = useMemo(() => {
    const top = data?.top;
    if (!top) return [];

    const raw =
      topMode === "CONSO_VS_MONTANT"
        ? top.conso_vs_montant
        : topMode === "COSPHI"
        ? top.cosphi
        : topMode === "PEN_PRIME"
        ? top.pen_prime
        : top.abonnement;

    return (raw ?? []).map((r: any) => ({
      site_id: r.site_id,
      site_name: r.site_name,
      conso: toNum(r.conso),
      montant_ht: toNum(r.montant_ht),
      montant_cosphi: toNum(r.montant_cosphi),
      penalite_prime: toNum(r.penalite_prime),
      abonnement: toNum(r.abonnement),
      // conserve aussi les strings pour affichage money() si tu préfères
      _raw: r,
    }));
  }, [data, topMode]);

  const totals = useMemo(() => {
    const d = data?.distribution_ht;
    if (!d) return null;

    const find = (k: string) => d.parts?.find((p: any) => p.key === k)?.value ?? "0";
    return {
      totalHT: d.total_ht ?? "0",
      nrj: find("NRJ"),
      cosphi: find("COSPHI"),
      penPrime: find("PEN_PRIME"),
      abonnement: find("ABONNEMENT"),
    };
  }, [data]);

  const palette = ["#1e40af", "#0ea5e9", "#f59e0b", "#64748b"]; // sobre / pro

  return (
    <div className="space-y-4">
      {/* Top header + KPIs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(2,6,23,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-wide text-slate-500">Période</div>
            <div className="mt-1 text-lg font-extrabold text-slate-900">
              {data?.range?.start ?? start} → {data?.range?.end ?? end}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Synthèse: répartition HT, évolution mensuelle, top 20 par métrique.
            </div>
          </div>
          {statsQ.isFetching ? (
            <div className="text-sm font-semibold text-slate-500">Actualisation…</div>
          ) : null}
        </div>

        {totals ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <MetricCard label="Total HT" value={money(totals.totalHT)} />
            <MetricCard label="NRJ (HT)" value={money(totals.nrj)} />
            <MetricCard label="Cos Phi" value={money(totals.cosphi)} />
            <MetricCard label="Pénalité Prime" value={money(totals.penPrime)} />
            <MetricCard label="Abonnement" value={money(totals.abonnement)} />
          </div>
        ) : null}

        {statsQ.isError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Erreur chargement stats
            </div>
            <div className="mt-1 text-sm text-rose-800">
              {(statsQ.error as any)?.response?.data?.detail || (statsQ.error as any)?.message || "Erreur inconnue"}
            </div>
          </div>
        ) : null}
      </div>

      {/* Row: Pie distribution + Evolution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Répartition du montant HT (%)" icon={<PieIcon className="h-4 w-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(v: any, name: any, p: any) => {
                      const percent = p?.payload?.percent ?? 0;
                      return [`${money(String(v))} • ${percent.toFixed?.(1) ?? percent}%`, p?.payload?.label ?? name];
                    }}
                  />
                  <Pie
                    data={distribution}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                  >
                    {distribution.map((_, i) => (
                      <Cell key={i} fill={palette[i % palette.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {(data?.distribution_ht?.parts ?? []).map((p: any, i: number) => (
                <div key={p.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ backgroundColor: palette[i % palette.length] }}
                    />
                    <div className="text-sm font-semibold text-slate-900">{p.label}</div>
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 whitespace-nowrap">
                    {Number(p.percent ?? 0).toFixed(1)}%
                  </div>
                </div>
              ))}
              <div className="text-xs text-slate-500">
                Base: Montant HT total sur la période.
              </div>
            </div>
          </div>
        </Card>

        <Card title="Évolution mensuelle (HT / NRJ / CosPhi / Pénalité / Abonnement)" icon={<LineChartIcon className="h-4 w-4" />}>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evo} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v: any, name: any) => {
                    // toutes les métriques ici sont des montants
                    return [money(String(v)), name];
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="montant_ht" name="HT" stroke="#1e40af" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="nrj" name="NRJ" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cosphi" name="CosPhi" stroke="#64748b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="penalite_prime" name="PenPrime" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="abonnement" name="Abonnement" stroke="#334155" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Astuce : si une ligne “écrase” les autres, on peut ajouter un sélecteur pour afficher 2–3 séries à la fois.
          </div>
        </Card>
      </div>

      {/* Top 20 */}
      <Card title="Top 20 sites" icon={<BarChart3 className="h-4 w-4" />}>
        <div className="flex flex-wrap gap-2">
          {[
            { k: "CONSO_VS_MONTANT", label: "Conso vs Montant HT" },
            { k: "COSPHI", label: "Montant Cos Phi" },
            { k: "PEN_PRIME", label: "Pénalité prime" },
            { k: "ABONNEMENT", label: "Abonnement" },
          ].map((x) => (
            <button
              key={x.k}
              onClick={() => setTopMode(x.k as any)}
              className={cn(
                "px-4 py-2 rounded-2xl border font-semibold transition",
                topMode === x.k
                  ? "bg-blue-900 text-white border-blue-900"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="h-[360px] rounded-2xl border border-slate-200 p-3">
            <ResponsiveContainer width="100%" height="100%">
              {topMode === "CONSO_VS_MONTANT" ? (
                <ComposedChart data={topRows} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="site_id"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={70}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => clampLabel(String(v), 10)}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: any, name: any) => {
                      if (name === "Conso") return [num(String(v)), name];
                      return [money(String(v)), name];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="montant_ht" name="Montant HT" fill="#1e40af" radius={[8, 8, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="conso" name="Conso" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </ComposedChart>
              ) : (
                <BarChart data={topRows} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="site_id"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={70}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => clampLabel(String(v), 10)}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any, name: any) => [money(String(v)), name]} />
                  <Legend />
                  <Bar
                    dataKey={
                      topMode === "COSPHI"
                        ? "montant_cosphi"
                        : topMode === "PEN_PRIME"
                        ? "penalite_prime"
                        : "abonnement"
                    }
                    name={
                      topMode === "COSPHI"
                        ? "Montant Cos Phi"
                        : topMode === "PEN_PRIME"
                        ? "Pénalité prime"
                        : "Abonnement"
                    }
                    fill="#1e40af"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <StickyTable
            rows={(data?.top
              ? topMode === "CONSO_VS_MONTANT"
                ? data.top.conso_vs_montant
                : topMode === "COSPHI"
                ? data.top.cosphi
                : topMode === "PEN_PRIME"
                ? data.top.pen_prime
                : data.top.abonnement
              : []) as any[]}
            mode={topMode}
          />
        </div>
      </Card>
    </div>
  );
}
