// src/features/fuel-tracking/sheets/DashboardSheet.tsx
// Onglet Dashboard — vue GLOBALE du module suivi-carburant :
//   - OverviewCircles : 4 anneaux de synthèse (Consommation/Stock/Commandes/
//     Estimation), un pourcentage porteur de sens par module + le volume
//     total au centre. Cliquer sur un anneau bascule directement sur
//     l'onglet correspondant (voir onNavigateTab). C'est la seule vue de
//     Stock et d'Estimation sur ce Dashboard — leurs grilles de chiffres
//     détaillées ont été retirées (redondantes avec l'anneau), le détail
//     complet reste sur leurs onglets dédiés.
//   - ConsommationSection : détail (donut couverture, top 10 sites,
//     détection GE) — seule section pilotée par la plage "Du / à" du header
//     (FuelTrackingPage), alimentée par /fuel-tracking/consommation/dashboard/.
//   - CommandeSection : graphes commande par catégorie/typologie (fichier Ops,
//     import mensuel brut) — pas de notion de plage, toujours le dernier
//     mois importé.
// Les courbes Consommation s'affichent toujours, même avec un seul mois ou
// des données vides (pas de graphique masqué conditionnellement).

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calculator, Droplets, Fuel, Gauge, LayoutGrid, TrendingUp, Warehouse } from "lucide-react";

import type { FuelCommandeEstimationResponse, FuelCommandeResponse, FuelConsommationDashboard, FuelStockResponse } from "@/services/fuelTracking";
import { Card, EmptyState, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { fmt, monthLabel } from "../helpers";
import { DETECTION_LABELS } from "./ConsommationSheet";

function ConsommationSection({ data }: { data: FuelConsommationDashboard }) {
  const multiMonth = data.months.length > 1;
  const first = data.months[0];
  const last = data.months[data.months.length - 1];
  const lastStats = data.monthly[data.monthly.length - 1];

  const scopeLabel = multiMonth ? `${monthLabel(first)} → ${monthLabel(last)}` : monthLabel(first);

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

      <GeDetectionSummary detection={data.ge_detection} />
    </>
  );
}

function StaticDonut({ title, segments }: { title: string; segments: Array<{ label: string; value: number; color: string }> }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div style={{ flex: "1 1 240px", minWidth: 220 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ width: 120, height: 120, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={segments} dataKey="value" nameKey="label" innerRadius={34} outerRadius={56} paddingAngle={2} strokeWidth={0}>
                {segments.map((s) => (
                  <Cell key={s.label} fill={s.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number, _name: string, entry: any) => [`${fmt.format(value)} site(s)`, entry?.payload?.label]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 120 }}>
          {segments.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: s.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: FT.text, fontFamily: "ui-monospace, Menlo, monospace" }}>
                  {fmt.format(s.value)} <span style={{ fontSize: 10, fontWeight: 700, color: FT.textSub }}>({total > 0 ? Math.round((s.value / total) * 100) : 0}%)</span>
                </div>
                <div style={{ fontSize: 10.5, color: FT.textSub }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StaticBarChart({
  title,
  bars,
  height = 132,
  unit = "site(s)",
  minWidth = 240,
}: {
  title: string;
  bars: Array<{ label: string; value: number; color: string }>;
  height?: number;
  unit?: string;
  minWidth?: number;
}) {
  return (
    <div style={{ flex: "1 1 260px", minWidth }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} layout="vertical" margin={{ top: 2, right: 16, bottom: 2, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 10.5, fill: FT.textMid }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value: number) => [`${fmt.format(value)} ${unit}`, ""]} cursor={{ fill: FT.slateL }} />
            <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={18} label={{ position: "right", fontSize: 11, fontWeight: 800, fill: FT.text, formatter: (v: any) => fmt.format(Number(v)) }}>
              {bars.map((b) => (
                <Cell key={b.label} fill={b.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const BAR_PALETTE = [FT.blue, FT.green, FT.gold, FT.cyan, FT.violet, FT.orange, FT.red, FT.slate];

function GeDetectionSummary({ detection }: { detection: FuelConsommationDashboard["ge_detection"] }) {
  if (!detection) return null;
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: FT.text, marginBottom: 4 }}>
        Détection GE — Snowflake / ENOC seuls (audit, avant correction Typo simple)
      </div>
      <div style={{ fontSize: 11, color: FT.textSub, marginBottom: 14 }}>
        Détail par site disponible sur l'onglet Suivis Consommations (mêmes graphes, cliquables pour filtrer le tableau).
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 14 }}>
        <StaticDonut
          title={`Couverture GE — réseau (${fmt.format(detection.total_sites)} sites)`}
          segments={[
            { label: DETECTION_LABELS.avec_ge, value: detection.avec_ge, color: FT.blue },
            { label: DETECTION_LABELS.sans_ge, value: detection.sans_ge, color: FT.slate },
          ]}
        />
        <StaticDonut
          title={`Avec GE, par source (${fmt.format(detection.avec_ge)} sites)`}
          segments={[
            { label: DETECTION_LABELS.vus_seulement_enoc, value: detection.vus_seulement_enoc, color: FT.gold },
            { label: DETECTION_LABELS.vus_seulement_snowflake, value: detection.vus_seulement_snowflake, color: FT.cyan },
            { label: DETECTION_LABELS.vus_par_les_deux, value: detection.vus_par_les_deux, color: FT.green },
          ]}
        />
      </div>
      <div style={{ borderTop: `1px solid ${FT.border}`, paddingTop: 14, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <StaticDonut
          title={`Sites du fichier — vs avis Snowflake/ENOC (${fmt.format(detection.sites_dans_fichier)} sites)`}
          segments={[
            { label: DETECTION_LABELS.dans_fichier_et_ge, value: detection.dans_fichier_et_ge, color: FT.green },
            { label: DETECTION_LABELS.dans_fichier_sans_ge, value: detection.dans_fichier_sans_ge, color: FT.orange },
          ]}
        />
        <StaticBarChart
          title="Totaux bruts (catégories non exclusives)"
          bars={[
            { label: DETECTION_LABELS.ge_hors_fichier, value: detection.ge_hors_fichier, color: FT.red },
            { label: DETECTION_LABELS.avec_ge_snowflake, value: detection.avec_ge_snowflake, color: FT.cyan },
            { label: DETECTION_LABELS.avec_ge_enoc, value: detection.avec_ge_enoc, color: FT.gold },
          ]}
        />
      </div>
    </Card>
  );
}

function CommandeSection({ data, loading }: { data: FuelCommandeResponse | undefined; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <Skeleton h={160} />
      </Card>
    );
  }

  const kpis = data?.sites.kpis;
  if (!data?.month_year || !kpis) {
    return (
      <Card padded={false} style={{ padding: 20 }}>
        <SheetTitle icon={<Fuel size={16} />} title="Commandes" subtitle="Import mensuel du fichier de commande Ops — ne suit pas la période sélectionnée ci-dessus." />
        <EmptyState icon={<Fuel size={20} />} title="Aucune donnée pour le moment" subtitle="Ce résumé s'alimente dès que le fichier de commande mensuel a été importé (voir onglet Commandes)." />
      </Card>
    );
  }

  const totalCategorie = data.synthese.categorie.find((r) => r.label.toUpperCase().includes("TOTAL COMMANDE")) ?? data.synthese.categorie.find((r) => r.is_total_row);

  // Barres "Commande (L)" par catégorie/typologie — lignes hors TOTAL
  // uniquement (sinon un TOTAL écraserait l'échelle des autres barres),
  // triées décroissant pour repérer les plus grosses commandes d'un coup d'œil.
  const categorieBars = data.synthese.categorie
    .filter((r) => !r.is_total_row && r.total_l !== 0)
    .sort((a, b) => b.total_l - a.total_l)
    .map((r, i) => ({ label: r.label, value: r.total_l, color: BAR_PALETTE[i % BAR_PALETTE.length] }));
  const typologieBars = data.synthese.typologie
    .filter((r) => !r.is_total_row && r.total_l !== 0)
    .sort((a, b) => b.total_l - a.total_l)
    .map((r, i) => ({ label: r.label, value: r.total_l, color: BAR_PALETTE[i % BAR_PALETTE.length] }));

  return (
    <Card padded={false}>
      <div style={{ padding: "16px 18px 4px" }}>
        <SheetTitle
          icon={<Fuel size={16} />}
          title={`Commandes — ${monthLabel(data.month_year)}`}
          subtitle="Import mensuel du fichier de commande Ops (pas de recalcul) — ne suit PAS la période sélectionnée ci-dessus, toujours le dernier mois importé."
          tone="gold"
        />
      </div>
      {(categorieBars.length > 0 || typologieBars.length > 0) && (
        <div style={{ borderTop: `1px solid ${FT.border}`, padding: "14px 18px 18px", display: "flex", gap: 24, flexWrap: "wrap" }}>
          {categorieBars.length > 0 && (
            <StaticBarChart
              title={`Commande (L) par catégorie/batch — ${monthLabel(data.month_year)}`}
              bars={categorieBars}
              unit="L"
              minWidth={280}
              height={Math.max(132, categorieBars.length * 26)}
            />
          )}
          {typologieBars.length > 0 && (
            <StaticBarChart
              title={`Commande (L) par typologie facturée — ${monthLabel(data.month_year)}`}
              bars={typologieBars}
              unit="L"
              minWidth={280}
              height={Math.max(132, typologieBars.length * 26)}
            />
          )}
        </div>
      )}
      {totalCategorie && (
        <div style={{ padding: "0 18px 16px", fontSize: 11.5, color: FT.textSub }}>
          {totalCategorie.label} : {fmt.format(totalCategorie.total_l)} L (vs {fmt.format(totalCategorie.total_prev_l)} L le mois précédent, écart {totalCategorie.ecart_qte_l >= 0 ? "+" : ""}{fmt.format(totalCategorie.ecart_qte_l)} L) — détail complet sur l'onglet Commandes.
        </div>
      )}
    </Card>
  );
}

/** Anneau de synthèse (% + valeur au centre) — vue "à la volée" d'un des 3
 * modules du dashboard (Consommation/Commandes/Estimation), chacun résumé
 * par un seul pourcentage porteur de sens pour ce module plutôt qu'une
 * grille de chiffres. Le détail complet reste disponible juste en dessous
 * (sections existantes) et sur l'onglet dédié à chaque module. */
function RingStat({
  title,
  pct,
  centerValue,
  centerSub,
  caption,
  color,
  icon,
  onClick,
}: {
  title: string;
  pct: number;
  centerValue: string;
  centerSub: string;
  caption: string;
  color: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const ringData = [
    { name: "value", value: clamped },
    { name: "rest", value: 100 - clamped },
  ];
  return (
    <button
      onClick={onClick}
      title={onClick ? "Voir le détail" : undefined}
      style={{
        flex: "1 1 220px", minWidth: 210, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        background: "none", border: "none", padding: 6, borderRadius: 12, cursor: onClick ? "pointer" : "default",
        transition: "background .15s",
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = FT.slateL; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: FT.text }}>
        {icon} {title}
      </div>
      <div style={{ position: "relative", width: 148, height: 148 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={ringData} dataKey="value" innerRadius={54} outerRadius={70} startAngle={90} endAngle={-270} paddingAngle={0} strokeWidth={0} isAnimationActive={false}>
              <Cell fill={color} />
              <Cell fill={FT.border} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: FT.text, fontFamily: "ui-monospace, Menlo, monospace", lineHeight: 1.1 }}>
            {centerValue}
          </div>
          <div style={{ fontSize: 10, color: FT.textSub, marginTop: 2, textAlign: "center", maxWidth: 110 }}>{centerSub}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: FT.textSub, textAlign: "center" }}>{caption}</div>
    </button>
  );
}

function OverviewCircles({
  data,
  stockData,
  commandeData,
  estimationData,
  onNavigateTab,
}: {
  data: FuelConsommationDashboard;
  stockData: FuelStockResponse | undefined;
  commandeData: FuelCommandeResponse | undefined;
  estimationData: FuelCommandeEstimationResponse | undefined;
  onNavigateTab?: (tab: "CONSOMMATION" | "STOCK" | "COMMANDE" | "ESTIMATION") => void;
}) {
  const last = data.months[data.months.length - 1];
  const lastStats = data.monthly[data.monthly.length - 1];
  const totalConso = data.monthly.reduce((a, m) => a + m.total_conso_snowflake_l, 0);
  const couverture = lastStats && lastStats.nb_sites_ge > 0 ? Math.round((lastStats.nb_sites_avec_conso / lastStats.nb_sites_ge) * 100) : 0;

  const stockKpis = stockData?.kpis;
  const pctStockConnu = stockKpis && stockKpis.sites_avec_ge > 0 ? Math.round((stockKpis.sites_avec_stock_snowflake / stockKpis.sites_avec_ge) * 100) : 0;

  const commandeKpis = commandeData?.sites.kpis;
  const pctSitesCommande = commandeKpis && commandeKpis.total_sites > 0 ? Math.round((commandeKpis.nb_sites_commande_positive / commandeKpis.total_sites) * 100) : 0;

  const estimKpis = estimationData?.kpis;
  const pctConfianceElevee = estimKpis && estimKpis.nb_sites > 0 ? Math.round((estimKpis.nb_sites_confiance_elevee / estimKpis.nb_sites) * 100) : 0;

  return (
    <Card padded={false} style={{ padding: "20px 18px" }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "space-around" }}>
        <RingStat
          title={`Consommation — ${monthLabel(last)}`}
          pct={couverture}
          centerValue={`${fmt.format(totalConso)} L`}
          centerSub={`${couverture}% couverture`}
          caption={`${fmt.format(lastStats?.nb_sites_avec_conso ?? 0)} / ${fmt.format(lastStats?.nb_sites_ge ?? 0)} sites GE avec donnée`}
          color={FT.green}
          icon={<Droplets size={15} />}
          onClick={onNavigateTab ? () => onNavigateTab("CONSOMMATION") : undefined}
        />
        <RingStat
          title="Stock — état actuel"
          pct={pctStockConnu}
          centerValue={`${fmt.format(stockKpis?.sites_avec_stock_snowflake ?? 0)} / ${fmt.format(stockKpis?.sites_avec_ge ?? 0)}`}
          centerSub={`${pctStockConnu}% stock connu`}
          caption={`${fmt.format(stockKpis?.sites_stock_critique ?? 0)} cuve(s) critique(s) (<15%)`}
          color={FT.cyan}
          icon={<Warehouse size={15} />}
          onClick={onNavigateTab ? () => onNavigateTab("STOCK") : undefined}
        />
        <RingStat
          title={commandeData?.month_year ? `Commandes — ${monthLabel(commandeData.month_year)}` : "Commandes"}
          pct={pctSitesCommande}
          centerValue={`${fmt.format(commandeKpis?.total_commande_avec_marge_l ?? 0)} L`}
          centerSub={`${pctSitesCommande}% des sites`}
          caption={`${fmt.format(commandeKpis?.nb_sites_commande_positive ?? 0)} / ${fmt.format(commandeKpis?.total_sites ?? 0)} sites avec commande`}
          color={FT.gold}
          icon={<Fuel size={15} />}
          onClick={onNavigateTab ? () => onNavigateTab("COMMANDE") : undefined}
        />
        <RingStat
          title={estimationData?.target_month ? `Estimation commande — ${monthLabel(estimationData.target_month)}` : "Estimation commande"}
          pct={pctConfianceElevee}
          centerValue={`${fmt.format(estimKpis?.total_commande_estimee_l ?? 0)} L`}
          centerSub={`${pctConfianceElevee}% confiance élevée`}
          caption={`${fmt.format(estimKpis?.nb_sites_confiance_elevee ?? 0)} / ${fmt.format(estimKpis?.nb_sites ?? 0)} sites en confiance élevée`}
          color={FT.navy}
          icon={<Calculator size={15} />}
          onClick={onNavigateTab ? () => onNavigateTab("ESTIMATION") : undefined}
        />
      </div>
    </Card>
  );
}

export function DashboardSheet({
  data,
  loading,
  stockData,
  stockLoading = false,
  commandeData,
  commandeLoading = false,
  estimationData,
  estimationLoading = false,
  onNavigateTab,
}: {
  data: FuelConsommationDashboard | undefined;
  loading: boolean;
  stockData?: FuelStockResponse;
  stockLoading?: boolean;
  commandeData?: FuelCommandeResponse;
  commandeLoading?: boolean;
  estimationData?: FuelCommandeEstimationResponse;
  estimationLoading?: boolean;
  onNavigateTab?: (tab: "CONSOMMATION" | "STOCK" | "COMMANDE" | "ESTIMATION") => void;
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
      <OverviewCircles data={data} stockData={stockData} commandeData={commandeData} estimationData={estimationData} onNavigateTab={onNavigateTab} />
      <ConsommationSection data={data} />
      <CommandeSection data={commandeData} loading={commandeLoading} />
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
