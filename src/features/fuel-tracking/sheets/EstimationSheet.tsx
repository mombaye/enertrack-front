// src/features/fuel-tracking/sheets/EstimationSheet.tsx
// Onglet Estimation commande — mois SUIVANT le dernier mois de consommation
// disponible (ex: données d'août → estimation pour septembre), calculée à
// partir de l'usage réel (Consommation + Stock), PAS de la commande décidée
// par Ops le mois précédent (voir CommandeSheet.tsx pour ça — les deux
// onglets répondent à des questions différentes : "qu'a décidé Ops" vs.
// "que dit la conso réelle pour le mois prochain"). Voir
// FuelCommandeEstimationView côté backend pour la méthodologie complète
// (moyenne pondérée récente en L/jour, plafond capacité de cuve, niveau de
// confiance par site).

import { useState, type CSSProperties } from "react";
import { AlertTriangle, Calculator, Fuel, Search, TrendingUp, Warehouse } from "lucide-react";
import type { FuelCommandeConfiance, FuelCommandeEstimationResponse } from "@/services/fuelTracking";
import { Card, EmptyState, KpiCard, Pill, Skeleton } from "../ui";
import { FT } from "../theme";
import { fmt, monthLabel } from "../helpers";

const th: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: FT.slateL,
  color: FT.text,
  fontSize: 10.5,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  textAlign: "center",
  padding: "9px 10px",
  borderBottom: `1px solid ${FT.borderStrong}`,
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  padding: "8px 10px",
  borderBottom: `1px solid ${FT.border}`,
  fontSize: 12.5,
  textAlign: "center",
  whiteSpace: "nowrap",
};

function NumCell({ value, digits = 0, tone }: { value: number; digits?: number; tone?: string }) {
  return (
    <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600, color: tone }}>
      {value.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}
    </span>
  );
}

const CONFIANCE_TONE: Record<FuelCommandeConfiance, "green" | "orange" | "red"> = {
  "Élevée": "green",
  "Moyenne": "orange",
  "Faible": "red",
};

const SOURCE_LABEL: Record<string, string> = {
  snowflake: "Mesurée (Snowflake)",
  gardiennage: "Mesurée (gardiennage)",
  cph: "Estimée (CPH)",
  fichier: "Estimée (fichier)",
};

export function EstimationSheet({
  data,
  loading,
  search,
  onSearchChange,
  stickyTop = 0,
}: {
  data: FuelCommandeEstimationResponse | undefined;
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  stickyTop?: number;
}) {
  if (loading) return <Skeleton h={520} />;

  const kpis = data?.kpis ?? null;

  if (!data?.target_month || !kpis) {
    return (
      <Card padded={false} style={{ padding: 20 }}>
        <EmptyState
          icon={<Calculator size={20} />}
          title="Estimation indisponible"
          subtitle="Pas assez de mois de consommation en base pour projeter le mois suivant."
        />
      </Card>
    );
  }

  const rows = data.sites.filter(
    (r) => !search || r.site_id.toLowerCase().includes(search.toLowerCase()) || (r.site_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          position: "sticky", top: stickyTop, zIndex: 9, background: FT.card, borderRadius: FT.radius,
          border: `1px solid ${FT.border}`, boxShadow: FT.shadow, padding: 14,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <KpiCard label="Commande estimée totale" value={`${fmt.format(kpis.total_commande_estimee_l)} L`} tone="blue" icon={<Calculator size={14} />} />
          <KpiCard label="Sites estimés" value={fmt.format(kpis.nb_sites)} tone="slate" icon={<Fuel size={14} />} />
          <KpiCard
            label="Rupture prévue"
            value={fmt.format(kpis.nb_sites_rupture_prevue)}
            sub="Stock final estimé négatif"
            tone={kpis.nb_sites_rupture_prevue > 0 ? "red" : "slate"}
            icon={<AlertTriangle size={14} />}
          />
          <KpiCard label="Confiance élevée" value={fmt.format(kpis.nb_sites_confiance_elevee)} tone="green" icon={<TrendingUp size={14} />} />
          <KpiCard label="Confiance faible" value={fmt.format(kpis.nb_sites_confiance_faible)} sub="À vérifier avant validation" tone="orange" icon={<AlertTriangle size={14} />} />
        </div>
      </div>

      <Card padded={false} style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: FT.blueL, display: "grid", placeItems: "center", color: FT.navy, flexShrink: 0 }}>
              <Calculator size={17} />
            </div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: FT.text }}>Estimation par site — {monthLabel(data.target_month)}</div>
              <div style={{ fontSize: 12.5, color: FT.textSub, marginTop: 3 }}>{fmt.format(rows.length)} site(s).</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px", minWidth: 220 }}>
            <Search size={14} color={FT.textSub} />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Site ID ou nom..."
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, flex: 1 }}
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<Fuel size={20} />} title="Aucun site" subtitle="Aucun résultat pour cette recherche." />
        ) : (
          <div style={{ overflow: "auto", maxHeight: 640, borderRadius: 12, border: `1px solid ${FT.border}` }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1180 }}>
              <thead>
                <tr>
                  <th style={th}>Site ID</th>
                  <th style={th}>Nom du site</th>
                  <th style={th}>Historique</th>
                  <th style={th}>Conso/jour pondérée (L)</th>
                  <th style={th}>Conso projetée (L)</th>
                  <th style={th}>Stock actuel (L)</th>
                  <th style={th}>Commande estimée (L)</th>
                  <th style={th}>Stock final estimé (L)</th>
                  <th style={th}>Confiance</th>
                  <th style={th}>Réf. Ops (L)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
                    <td style={{ ...td, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.site_id}</td>
                    <td style={td}>{r.site_name || "—"}</td>
                    <td style={td} title={r.sources_historique.map((s) => SOURCE_LABEL[s] || s).join(" · ")}>
                      {r.nb_mois_historique} mois
                    </td>
                    <td style={td}><NumCell value={r.conso_jour_ponderee_l} digits={1} /></td>
                    <td style={td}><NumCell value={r.conso_projetee_l} /></td>
                    <td style={td}>{r.stock_connu ? <NumCell value={r.stock_actuel_l ?? 0} /> : "—"}</td>
                    <td style={td}>
                      <NumCell value={r.commande_avec_marge_l} tone={r.commande_avec_marge_l > 0 ? FT.blue : undefined} />
                      {r.plafonnee_par_capacite && (
                        <span title="Plafonnée par la capacité de cuve disponible" style={{ marginLeft: 5 }}>
                          <Warehouse size={11} color={FT.gold} style={{ verticalAlign: "middle" }} />
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      <NumCell value={r.stock_final_estime_l} digits={1} tone={r.stock_final_estime_l < 0 ? FT.red : undefined} />
                    </td>
                    <td style={td}><Pill label={r.confiance} tone={CONFIANCE_TONE[r.confiance]} /></td>
                    <td style={td}>{r.commande_ops_reference_l != null ? <NumCell value={r.commande_ops_reference_l} tone={FT.textSub} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
