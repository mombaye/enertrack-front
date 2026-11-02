// src/features/fuel-tracking/sheets/CommandeSheet.tsx
// Onglet Commandes — automatisé (pas d'upload sur cette page) : la commande
// carburant est décidée mensuellement par l'équipe Ops dans un fichier
// Excel ("Commande FUEL ESCO SENEGAL <mois>.xlsb"), importé derrière (voir
// fuel_tracking/management/commands/import_commande_fuel.py — le fichier
// est commité dans data_imports/ et l'import rejoué à chaque déploiement,
// même principe que Base GE.xlsx). Cette page est donc en lecture seule :
// aucune commande n'est décidée ici, on affiche celle déjà prise par Ops.
// Voir EstimationSheet.tsx (onglet séparé) pour l'estimation du mois
// SUIVANT calculée à partir de la conso/du stock, indépendante de ce fichier.

import type { CSSProperties } from "react";
import { AlertTriangle, Fuel, Search, TrendingUp, Warehouse } from "lucide-react";
import type { FuelCommandeResponse, FuelCommandeSyntheseRow } from "@/services/fuelTracking";
import { Card, EmptyState, KpiCard, Pager, Skeleton } from "../ui";
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

function EcartCell({ value }: { value: number }) {
  if (value === 0) return <NumCell value={value} tone={FT.textSub} />;
  return <NumCell value={value} tone={value > 0 ? FT.green : FT.red} />;
}

/** Tableau Synthèse (par catégorie ou par typologie) — mois courant vs
 * précédent + écart, tel que déjà calculé dans le fichier source (import
 * brut, aucun recalcul ici). */
function SyntheseTable({ title, rows, currentLabel, prevLabel }: { title: string; rows: FuelCommandeSyntheseRow[]; currentLabel: string; prevLabel: string }) {
  return (
    <Card padded={false}>
      <div style={{ padding: "14px 16px 10px", fontSize: 13, fontWeight: 800, color: FT.text }}>{title}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Libellé</th>
              <th style={th}>{`Sites (${currentLabel})`}</th>
              <th style={th}>{`Commande (${currentLabel})`}</th>
              <th style={th}>{`Sites (${prevLabel})`}</th>
              <th style={th}>{`Commande (${prevLabel})`}</th>
              <th style={th}>Écart sites</th>
              <th style={th}>Écart qté (L)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.label}-${i}`} style={{ background: r.is_total_row ? FT.slateL : i % 2 === 0 ? "#fff" : FT.cardAlt, fontWeight: r.is_total_row ? 800 : 400 }}>
                <td style={{ ...td, textAlign: "left" }}>{r.label}</td>
                <td style={td}><NumCell value={r.nb_sites} /></td>
                <td style={td}><NumCell value={r.total_l} digits={0} /></td>
                <td style={td}><NumCell value={r.nb_sites_prev} /></td>
                <td style={td}><NumCell value={r.total_prev_l} digits={0} /></td>
                <td style={td}><EcartCell value={r.ecart_sites} /></td>
                <td style={td}><EcartCell value={r.ecart_qte_l} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CommandeKpis({ data, stickyTop }: { data: FuelCommandeResponse | undefined; stickyTop: number }) {
  const kpis = data?.sites.kpis;
  if (!kpis) return null;
  return (
    <div
      style={{
        position: "sticky", top: stickyTop, zIndex: 9, background: FT.card, borderRadius: FT.radius,
        border: `1px solid ${FT.border}`, boxShadow: FT.shadow, padding: 14,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        <KpiCard label="Sites du fichier" value={fmt.format(kpis.total_sites)} tone="slate" icon={<Fuel size={14} />} />
        <KpiCard label="Commande avec marge" value={`${fmt.format(kpis.total_commande_avec_marge_l)} L`} tone="blue" icon={<TrendingUp size={14} />} />
        <KpiCard label="Commande sans marge" value={`${fmt.format(kpis.total_commande_sans_marge_l)} L`} tone="gold" icon={<TrendingUp size={14} />} />
        <KpiCard label="Sites avec commande" value={fmt.format(kpis.nb_sites_commande_positive)} sub="Commande avec marge > 0 L" tone="green" icon={<Fuel size={14} />} />
        <KpiCard
          label="Rupture de stock prévue"
          value={fmt.format(kpis.nb_sites_stock_negatif)}
          sub="Stock final estimé négatif"
          tone={kpis.nb_sites_stock_negatif > 0 ? "red" : "slate"}
          icon={<AlertTriangle size={14} />}
        />
      </div>
    </div>
  );
}

export function CommandeSheet({
  data,
  loading,
  search,
  onSearchChange,
  page,
  onPageChange,
  stickyTop = 0,
}: {
  data: FuelCommandeResponse | undefined;
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  page: number;
  onPageChange: (p: number) => void;
  stickyTop?: number;
}) {
  if (loading) return <Skeleton h={520} />;

  const rows = data?.sites.data ?? [];
  const currentLabel = monthLabel(data?.month_year ?? null);
  const prevLabel = monthLabel(data?.prev_month_year ?? null);

  if (!data?.month_year) {
    return (
      <Card padded={false} style={{ padding: 20 }}>
        <EmptyState icon={<Fuel size={20} />} title="Aucune donnée" subtitle="Le fichier de commande mensuel n'a pas encore été importé." />
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <CommandeKpis data={data} stickyTop={stickyTop + 14} />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 480px", minWidth: 420 }}>
          <SyntheseTable title="Synthèse par catégorie / batch" rows={data.synthese.categorie} currentLabel={currentLabel} prevLabel={prevLabel} />
        </div>
        <div style={{ flex: "1 1 480px", minWidth: 420 }}>
          <SyntheseTable title="Synthèse par typologie facturée" rows={data.synthese.typologie} currentLabel={currentLabel} prevLabel={prevLabel} />
        </div>
      </div>

      <Card padded={false} style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: FT.blueL, display: "grid", placeItems: "center", color: FT.navy, flexShrink: 0 }}>
              <Warehouse size={17} />
            </div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: FT.text }}>Commande par site — {currentLabel}</div>
              <div style={{ fontSize: 12.5, color: FT.textSub, marginTop: 3 }}>
                Détail du fichier "Suivis commande" (12 colonnes retenues sur 136).
                {data.sites.pagination && ` ${fmt.format(data.sites.pagination.total)} site(s).`}
              </div>
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
          <>
            <div style={{ overflow: "auto", maxHeight: 600, borderRadius: 12, border: `1px solid ${FT.border}` }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1500 }}>
                <thead>
                  <tr>
                    <th style={th}>Site ID</th>
                    <th style={th}>Nom du site</th>
                    <th style={th}>Typologie contractuelle</th>
                    <th style={th}>Type de site</th>
                    <th style={th}>Batch</th>
                    <th style={th}>Typologie facturée</th>
                    <th style={th}>Typo opérations</th>
                    <th style={th}>Conso moy/jour (L)</th>
                    <th style={th}>Commande sans marge (L)</th>
                    <th style={th}>Commande avec marge (L)</th>
                    <th style={th}>Stock final estimé (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
                      <td style={{ ...td, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.site_id}</td>
                      <td style={td}>{r.site_name || "—"}</td>
                      <td style={td}>{r.typologie_contractuelle || "—"}</td>
                      <td style={td}>{r.indoor_outdoor || "—"}</td>
                      <td style={td}>{r.batch || "—"}</td>
                      <td style={td}>{r.typologie_facturee || "—"}</td>
                      <td style={td}>{r.typo_operations || "—"}</td>
                      <td style={td}><NumCell value={r.conso_moy_jour_l} digits={1} /></td>
                      <td style={td}><NumCell value={r.commande_sans_marge_l} /></td>
                      <td style={td}><NumCell value={r.commande_avec_marge_l} tone={r.commande_avec_marge_l > 0 ? FT.blue : undefined} /></td>
                      <td style={td}>
                        <NumCell value={r.estimation_stock_final_l} digits={1} tone={r.estimation_stock_final_l < 0 ? FT.red : undefined} />
                        {r.estimation_stock_final_l < 0 && (
                          <span title="Rupture de stock prévue" style={{ marginLeft: 5 }}>
                            <AlertTriangle size={12} color={FT.red} style={{ verticalAlign: "middle" }} />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.sites.pagination && (
              <Pager
                page={data.sites.pagination.page}
                totalPages={data.sites.pagination.totalPages}
                hasPrev={data.sites.pagination.hasPrev}
                hasNext={data.sites.pagination.hasNext}
                onPrev={() => onPageChange(Math.max(1, page - 1))}
                onNext={() => onPageChange(page + 1)}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
