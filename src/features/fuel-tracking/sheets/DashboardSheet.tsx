// src/features/fuel-tracking/sheets/DashboardSheet.tsx
// Onglet Dashboard — vue GLOBALE du module suivi-carburant, en 3 sections
// indépendantes :
//   1. Consommation (mesurée Snowflake/ENOC + estimée CPH) — seule section
//      pilotée par la plage "Du / à" du header (FuelTrackingPage), alimentée
//      par /fuel-tracking/consommation/dashboard/.
//   2. Stock — état ACTUEL (pas de notion de mois : FuelStockSnapshot est un
//      instantané par site, remplacé en totalité à chaque sync). Ne bouge
//      donc PAS quand on change la période du header — présenté séparément
//      pour ne pas laisser croire le contraire.
//   3. Commandes — aucune donnée réelle n'existe encore (pas de backend) :
//      un simple rappel, pas de chiffres inventés.
// Les courbes Consommation s'affichent toujours, même avec un seul mois ou
// des données vides (pas de graphique masqué conditionnellement).

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { AlertTriangle, Droplets, Fuel, Gauge, LayoutGrid, TrendingUp, Users, Warehouse } from "lucide-react";

import type { FuelConsommationDashboard, FuelStockResponse } from "@/services/fuelTracking";
import { Card, EmptyState, KpiCard, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { fmt, monthLabel } from "../helpers";
import { PlaceholderSheet } from "./PlaceholderSheet";

function ConsommationSection({ data }: { data: FuelConsommationDashboard }) {
  const multiMonth = data.months.length > 1;
  const first = data.months[0];
  const last = data.months[data.months.length - 1];
  const lastStats = data.monthly[data.monthly.length - 1];

  const totalConso = data.monthly.reduce((a, m) => a + m.total_conso_snowflake_l, 0);
  const totalEnoc = data.monthly.reduce((a, m) => a + m.total_enoc_qte_ajoutee_l, 0);
  const totalEnocDemandes = data.monthly.reduce((a, m) => a + m.total_enoc_nb_demandes, 0);
  const totalEnocSites = data.monthly.reduce((a, m) => a + m.nb_sites_enoc_ajoutee, 0);
  const totalCph = data.monthly.reduce((a, m) => a + m.total_conso_estimee_cph_l, 0);
  const couverture = lastStats && lastStats.nb_sites_ge > 0 ? Math.round((lastStats.nb_sites_avec_conso / lastStats.nb_sites_ge) * 100) : 0;
  const couvertureCph = lastStats && lastStats.nb_sites_ge > 0 ? Math.round((lastStats.nb_sites_avec_cph / lastStats.nb_sites_ge) * 100) : 0;

  const scopeLabel = multiMonth ? `${monthLabel(first)} → ${monthLabel(last)}` : monthLabel(first);

  const cph = data.cph_parameters;

  // "Aucune donnée" = ni Conso estimée ni Conso mesurée vue renseignées
  // (Running Time n'entre plus dans ce critère, demande explicite 2026-08)
  // — même définition que le filtre "Avec GE mais aucune donnée" de Suivis
  // Consommation (nb_sites_incomplet vient du backend avec exactement
  // cette même logique, voir _month_stats).
  const nbIncomplet = lastStats?.nb_sites_incomplet ?? 0;
  const nbComplet = Math.max(0, (lastStats?.nb_sites_ge ?? 0) - nbIncomplet);
  const totalGe = nbComplet + nbIncomplet;
  const coverageData = [
    { name: "Au moins une donnée disponible", value: nbComplet, pct: totalGe > 0 ? Math.round((nbComplet / totalGe) * 100) : 0, color: FT.green },
    { name: "Aucune donnée disponible", value: nbIncomplet, pct: totalGe > 0 ? Math.round((nbIncomplet / totalGe) * 100) : 0, color: FT.orange },
  ];

  return (
    <>
      <Card padded={false}>
        <div style={{ padding: "16px 18px 4px" }}>
          <SheetTitle
            icon={<Gauge size={16} />}
            title={`Consommation — ${scopeLabel}`}
            subtitle="Sites avec GE uniquement (seuls capables de consommer du fuel). Plage pilotée par le sélecteur du header."
            tone="gold"
          />
          <div style={{ marginTop: 8, fontSize: 11.5, color: FT.textSub }}>
            Fichier de paramètres GE (CPH) : <strong style={{ color: FT.textMid }}>{fmt.format(cph.sites_configures)} site(s) configuré(s)</strong>
            {cph.dernier_import
              ? ` — dernier import le ${new Date(cph.dernier_import).toLocaleDateString("fr-FR")}.`
              : " — aucun import effectué (conso estimée CPH vide tant qu'aucune fiche n'existe)."}
          </div>
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
            label="Conso estimée (CPH)"
            value={`${fmt.format(totalCph)} L`}
            sub={multiMonth ? `Cumulé sur ${data.months.length} mois` : `${fmt.format(lastStats.nb_sites_avec_cph)} site(s) concerné(s)`}
            tone="violet"
            icon={<Gauge size={14} />}
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
            label={multiMonth ? `Couverture CPH (${monthLabel(last)})` : "Couverture CPH"}
            value={`${couvertureCph}%`}
            sub={`${fmt.format(lastStats.nb_sites_avec_cph)} / ${fmt.format(lastStats.nb_sites_ge)} sites GE`}
            tone={couvertureCph > 0 ? "cyan" : "slate"}
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

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <Card padded={false} style={{ flex: "1 1 380px" }}>
          <div style={{ padding: "16px 18px 4px" }}>
            <SheetTitle
              icon={<Gauge size={16} />}
              title="Couverture des sites"
              subtitle={`Sur les ${fmt.format(lastStats.nb_sites_ge)} sites GE de ${monthLabel(last)} : combien n'ont NI Conso estimée NI Conso mesurée vue renseignées (voir Suivis Consommation, colonne Commentaire pour le détail par site).`}
            />
          </div>
          <div style={{ padding: "8px 18px 20px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <div style={{ width: 200, height: 200, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={coverageData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2} strokeWidth={0}>
                    {coverageData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${fmt.format(value)} site(s)`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {coverageData.map((d) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 999, background: d.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: FT.text, fontFamily: "ui-monospace, Menlo, monospace" }}>
                      {fmt.format(d.value)} <span style={{ fontSize: 11, fontWeight: 700, color: FT.textSub }}>({d.pct}%)</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: FT.textSub }}>{d.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card padded={false} style={{ flex: "1 1 460px" }}>
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
              <div style={{ overflowX: "auto" }}>
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
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function StockSection({ data, loading }: { data: FuelStockResponse | undefined; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <Skeleton h={160} />
      </Card>
    );
  }

  const kpis = data?.kpis;
  if (!kpis) {
    return (
      <Card padded={false} style={{ padding: 20 }}>
        <SheetTitle icon={<Warehouse size={16} />} title="Stock — état actuel" subtitle="À la date du dernier relevé — ne suit pas la période sélectionnée ci-dessus (le stock est un instantané, pas une série mensuelle)." />
        <EmptyState icon={<Warehouse size={20} />} title="Aucune donnée pour le moment" subtitle="Ce résumé s'alimente automatiquement dès que la synchro Stock (Snowflake + ENOC) a tourné." />
      </Card>
    );
  }

  const couverture = kpis.sites_avec_ge > 0 ? Math.round((kpis.sites_avec_stock_snowflake / kpis.sites_avec_ge) * 100) : 0;

  return (
    <Card padded={false}>
      <div style={{ padding: "16px 18px 4px" }}>
        <SheetTitle
          icon={<Warehouse size={16} />}
          title="Stock — état actuel"
          subtitle="À la date du dernier relevé — ne suit PAS la période sélectionnée ci-dessus (le stock est un instantané par site, remplacé à chaque synchronisation, pas une série mensuelle)."
          tone="navy"
        />
      </div>
      <div style={{ padding: "12px 18px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        <KpiCard
          label="Sites avec stock connu (Snowflake)"
          value={`${fmt.format(kpis.sites_avec_stock_snowflake)} / ${fmt.format(kpis.sites_avec_ge)}`}
          sub={`${couverture}% de couverture`}
          tone="blue"
          icon={<Users size={14} />}
        />
        <KpiCard label="Sites avec stock connu (ENOC)" value={fmt.format(kpis.sites_avec_stock_enoc)} sub="Relevés historiques" tone="green" icon={<Droplets size={14} />} />
        <KpiCard label="Cuves critiques (<15%)" value={fmt.format(kpis.sites_stock_critique)} sub="Sur les sites avec GE" tone={kpis.sites_stock_critique > 0 ? "red" : "slate"} icon={<AlertTriangle size={14} />} />
        <KpiCard label="Cuves en alerte (15-40%)" value={fmt.format(kpis.sites_stock_alerte)} sub="Sur les sites avec GE" tone={kpis.sites_stock_alerte > 0 ? "orange" : "slate"} icon={<AlertTriangle size={14} />} />
        <KpiCard label="Sites sans aucun stock connu" value={fmt.format(kpis.sites_sans_aucun_stock)} sub="Ni Snowflake, ni ENOC" tone={kpis.sites_sans_aucun_stock > 0 ? "orange" : "slate"} icon={<Warehouse size={14} />} />
      </div>
    </Card>
  );
}

export function DashboardSheet({
  data,
  loading,
  stockData,
  stockLoading = false,
}: {
  data: FuelConsommationDashboard | undefined;
  loading: boolean;
  stockData?: FuelStockResponse;
  stockLoading?: boolean;
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
        <SheetTitle icon={<LayoutGrid size={17} />} title="Dashboard" subtitle="Vue d'ensemble du module suivi-carburant." />
        <EmptyState
          icon={<Droplets size={20} />}
          title="Aucune donnée pour le moment"
          subtitle="Ce résumé s'alimente automatiquement dès que la synchro Consommation (Snowflake + ENOC) a tourné au moins un mois."
        />
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ConsommationSection data={data} />
      <StockSection data={stockData} loading={stockLoading} />
      <PlaceholderSheet
        icon={<Fuel size={17} />}
        title="Commandes"
        subtitle="Suivi automatisé des commandes carburant."
        emptyTitle="Pas encore automatisé"
        emptyMessage="Cette sous-partie n'a pas encore de données réelles — rien n'est affiché ici tant qu'elle n'est pas construite, plutôt que d'inventer des chiffres."
      />
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
