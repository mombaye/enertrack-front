// src/features/fuel-tracking/sheets/DashboardSheet.tsx
// Onglet Dashboard — vue d'ensemble de la Consommation carburant (Grid/ACM/
// Solaire n'existent pas ici, uniquement Fuel). Alimenté par
// /fuel-tracking/consommation/dashboard/. La portée (1 ou plusieurs mois)
// est entièrement pilotée par la plage "Du / à" du header (FuelTrackingPage),
// initialisée aux 3 derniers mois disponibles par défaut — rien de local ici.
// Les courbes ne s'affichent que si la portée couvre plus d'un mois — un
// graphique à 1 point n'apporte rien ; les KPI + Top sites restent affichés
// dans tous les cas (les seuls chiffres bruts hors graphique).

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Droplets, Fuel, Gauge, LayoutGrid, TrendingUp } from "lucide-react";

import type { FuelConsommationDashboard } from "@/services/fuelTracking";
import { Card, EmptyState, KpiCard, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { fmt, monthLabel } from "../helpers";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${FT.border}`, borderRadius: 12, padding: "10px 12px", boxShadow: "0 16px 40px rgba(15,23,42,.14)", minWidth: 180 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: FT.text, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "grid", gap: 5 }}>
        {payload.filter((p: any) => p.value !== null && p.value !== undefined).map((p: any) => (
          <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", fontSize: 11.5 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: FT.textMid }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: p.color }} />
              {p.name}
            </span>
            <strong style={{ fontFamily: "ui-monospace, Menlo, monospace", color: FT.text }}>
              {typeof p.value === "number" ? fmt.format(p.value) : p.value}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSheet({
  data,
  loading,
}: {
  data: FuelConsommationDashboard | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <Skeleton h={320} />
      </Card>
    );
  }

  if (!data || data.months.length === 0) {
    return (
      <Card>
        <SheetTitle icon={<LayoutGrid size={17} />} title="Dashboard" subtitle="Résumé automatique de la Consommation carburant." />
        <EmptyState
          icon={<Droplets size={20} />}
          title="Aucune donnée pour le moment"
          subtitle="Ce résumé s'alimente automatiquement dès que la synchro Consommation (Snowflake + ENOC) a tourné au moins un mois."
        />
      </Card>
    );
  }

  const multiMonth = data.months.length > 1;
  const first = data.months[0];
  const last = data.months[data.months.length - 1];
  const lastStats = data.monthly[data.monthly.length - 1];

  const totalConso = data.monthly.reduce((a, m) => a + m.total_conso_snowflake_l, 0);
  const totalEnoc = data.monthly.reduce((a, m) => a + m.total_enoc_qte_ajoutee_l, 0);
  const totalEnocDemandes = data.monthly.reduce((a, m) => a + m.total_enoc_nb_demandes, 0);
  const totalEnocSites = data.monthly.reduce((a, m) => a + m.nb_sites_enoc_ajoutee, 0);
  const couverture = lastStats && lastStats.nb_sites_ge > 0 ? Math.round((lastStats.nb_sites_avec_conso / lastStats.nb_sites_ge) * 100) : 0;

  const scopeLabel = multiMonth ? `${monthLabel(first)} → ${monthLabel(last)}` : monthLabel(first);

  const chartData = data.monthly.map((m) => ({
    label: monthLabel(m.month_year),
    period: m.month_year,
    conso: m.total_conso_snowflake_l,
    enoc: m.total_enoc_qte_ajoutee_l,
    sitesGe: m.nb_sites_ge,
    sitesConso: m.nb_sites_avec_conso,
    sitesMonitored: m.nb_sites_monitored,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card padded={false}>
        <div style={{ padding: "16px 18px 4px" }}>
          <SheetTitle
            icon={<Gauge size={16} />}
            title={`Statistiques — ${scopeLabel}`}
            subtitle="Sites avec GE uniquement (seuls capables de consommer du fuel). Plage pilotée par le sélecteur du header."
            tone="gold"
          />
        </div>
        <div style={{ padding: "12px 18px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
          <KpiCard
            label="Conso mesurée"
            value={`${fmt.format(totalConso)} L`}
            sub={multiMonth ? `Cumulé sur ${data.months.length} mois` : `${fmt.format(lastStats.nb_sites_avec_conso)} site(s) concerné(s)`}
            tone="green"
            icon={<Droplets size={14} />}
          />
          <KpiCard
            label="ENOC ajouté"
            value={`${fmt.format(totalEnoc)} L`}
            sub={`${fmt.format(totalEnocDemandes)} demande(s), ${fmt.format(totalEnocSites)} site(s)${multiMonth ? " (cumulé)" : ""}`}
            tone="gold"
            icon={<Gauge size={14} />}
          />
          <KpiCard
            label={multiMonth ? `Couverture (${monthLabel(last)})` : "Couverture"}
            value={`${couverture}%`}
            sub={`${fmt.format(lastStats.nb_sites_avec_conso)} / ${fmt.format(lastStats.nb_sites_ge)} sites GE`}
            tone={couverture > 0 ? "cyan" : "slate"}
            icon={<TrendingUp size={14} />}
          />
          <KpiCard
            label={multiMonth ? `Sites MONITORED (${monthLabel(last)})` : "Sites MONITORED"}
            value={fmt.format(lastStats.nb_sites_monitored)}
            sub={`sur ${fmt.format(lastStats.nb_sites_ge)} sites GE`}
            tone="blue"
            icon={<Fuel size={14} />}
          />
        </div>
      </Card>

      <Card padded={false}>
        <div style={{ padding: "16px 18px 4px" }}>
          <SheetTitle
            icon={<Droplets size={16} />}
            title="Conso mesurée vs ENOC ajouté"
            subtitle={`Évolution mensuelle — ${scopeLabel}, sites avec GE uniquement — courbes indépendantes, jamais fusionnées (2 sources distinctes).`}
          />
        </div>
        <div style={{ padding: "8px 14px 18px", height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ftConsoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={FT.green} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={FT.green} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ftEnocGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={FT.gold} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={FT.gold} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={FT.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: FT.textSub }} axisLine={{ stroke: FT.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: FT.textSub }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => fmt.format(v)} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11.5, fontWeight: 700 }} />
              <Area type="monotone" dataKey="conso" name="Conso mesurée (L)" stroke={FT.green} fill="url(#ftConsoGrad)" strokeWidth={2.2} />
              <Area type="monotone" dataKey="enoc" name="ENOC ajouté (L)" stroke={FT.gold} fill="url(#ftEnocGrad)" strokeWidth={2.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card padded={false}>
        <div style={{ padding: "16px 18px 4px" }}>
          <SheetTitle
            icon={<Gauge size={16} />}
            title="Couverture des sites"
            subtitle="Nombre de sites avec GE, avec capteur MONITORED, et avec conso mesurée ce mois-là — pour situer l'écart entre 'instrumenté' et 'donnée effectivement produite'."
          />
        </div>
        <div style={{ padding: "8px 14px 18px", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={FT.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: FT.textSub }} axisLine={{ stroke: FT.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: FT.textSub }} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11.5, fontWeight: 700 }} />
              <Bar dataKey="sitesGe" name="Sites avec GE" fill={FT.slate} radius={[4, 4, 0, 0]} />
              <Bar dataKey="sitesMonitored" name="Sites MONITORED" fill={FT.blue} radius={[4, 4, 0, 0]} />
              <Bar dataKey="sitesConso" name="Sites avec conso mesurée" fill={FT.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card padded={false}>
        <div style={{ padding: "16px 18px 4px" }}>
          <SheetTitle
            icon={<TrendingUp size={16} />}
            title="Top 10 sites — conso mesurée cumulée"
            subtitle={`Somme de la conso mesurée — ${scopeLabel}.`}
          />
        </div>
        <div style={{ padding: "6px 0 12px" }}>
          {data.top_sites.length === 0 ? (
            <div style={{ padding: "24px 18px" }}>
              <EmptyState icon={<Droplets size={18} />} title="Aucun site avec conso mesurée sur la période" />
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={topTh}>#</th>
                  <th style={topTh}>Site ID</th>
                  <th style={topTh}>Nom du site</th>
                  <th style={topTh}>Conso mesurée cumulée (L)</th>
                  <th style={topTh}>Nb mois avec donnée</th>
                </tr>
              </thead>
              <tbody>
                {data.top_sites.map((s, i) => (
                  <tr key={s.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
                    <td style={topTd}>{i + 1}</td>
                    <td style={{ ...topTd, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{s.site_id}</td>
                    <td style={topTd}>{s.site_name || "—"}</td>
                    <td style={{ ...topTd, fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700 }}>{fmt.format(s.total_conso_l)}</td>
                    <td style={topTd}>{s.nb_mois_avec_conso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

const topTh = {
  fontSize: 10.5,
  fontWeight: 800,
  textTransform: "uppercase" as const,
  letterSpacing: ".04em",
  color: FT.textSub,
  textAlign: "left" as const,
  padding: "8px 18px",
  borderBottom: `1px solid ${FT.borderStrong}`,
};

const topTd = {
  fontSize: 12.5,
  padding: "8px 18px",
  borderBottom: `1px solid ${FT.border}`,
};
