// src/features/fuel-tracking/sheets/SuiviCommandeSheet.tsx
// Feuille SUIVI COMMANDE — snapshot par site (≈3260 sites), limité aux
// colonnes mises en évidence en bleu dans la feuille "Suivis commande" du
// fichier Excel source. Import brut, sans recalcul (voir fuel_tracking/
// services/suivi_commande_import.py). Tableau simple, paginé côté serveur.

import type { CSSProperties } from "react";
import { Droplets, Fuel, Search, Users, Warehouse } from "lucide-react";
import type { FuelSuiviCommandeResponse } from "@/services/fuelTracking";
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

function NumCell({ value }: { value: number }) {
  if (value === 0) return <span style={{ color: FT.textSub }}>—</span>;
  return <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>{fmt.format(value)}</span>;
}

function formatL(value: number) {
  return `${fmt.format(value)} L`;
}

function SuiviCommandeKpis({ data, stickyTop }: { data: FuelSuiviCommandeResponse | undefined; stickyTop: number }) {
  const kpis = data?.kpis;
  if (!kpis) return null;

  const currentLabel = monthLabel(data?.month_year);

  return (
    <div
      style={{
        position: "sticky",
        top: stickyTop,
        zIndex: 9,
        background: FT.card,
        borderRadius: FT.radius,
        border: `1px solid ${FT.border}`,
        boxShadow: FT.shadow,
        padding: 14,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        <KpiCard label="Nombre de sites" value={fmt.format(kpis.total_sites)} sub={currentLabel} tone="blue" icon={<Users size={14} />} />
        <KpiCard label="Conso moy/jour (total)" value={formatL(kpis.total_conso_moy_jour_l)} tone="cyan" icon={<Droplets size={14} />} />
        <KpiCard label="Commande sans marge" value={formatL(kpis.total_commande_sans_marge_l)} tone="slate" icon={<Fuel size={14} />} />
        <KpiCard label="Commande avec marge" value={formatL(kpis.total_commande_avec_marge_l)} tone="gold" icon={<Fuel size={14} />} />
        <KpiCard label="Stock estimé fin de mois" value={formatL(kpis.total_estimation_stock_final_l)} tone="green" icon={<Warehouse size={14} />} />
      </div>
    </div>
  );
}

export function SuiviCommandeSheet({
  data,
  loading,
  search,
  onSearchChange,
  page,
  onPageChange,
  stickyTop = 0,
}: {
  data: FuelSuiviCommandeResponse | undefined;
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  page: number;
  onPageChange: (p: number) => void;
  stickyTop?: number;
}) {
  if (loading) return <Skeleton h={520} />;

  const rows = data?.data ?? [];
  const currentLabel = monthLabel(data?.month_year);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SuiviCommandeKpis data={data} stickyTop={stickyTop + 14} />

      <Card padded={false} style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: FT.blueL, display: "grid", placeItems: "center", color: FT.navy, flexShrink: 0 }}>
              <Users size={17} />
            </div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: FT.text }}>Suivi par site — {currentLabel}</div>
              <div style={{ fontSize: 12.5, color: FT.textSub, marginTop: 3 }}>
                Import brut des colonnes mises en bleu de la feuille "Suivis commande". Aucun recalcul.
                {data?.pagination && ` ${fmt.format(data.pagination.total)} site(s).`}
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
          <EmptyState icon={<Users size={20} />} title="Aucun site trouvé" subtitle={search ? "Aucun résultat pour cette recherche." : "Importe le fichier Excel mensuel via le bouton « Importer »."} />
        ) : (
          <>
            <div style={{ overflow: "auto", maxHeight: 600, borderRadius: 12, border: `1px solid ${FT.border}` }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1000 }}>
                <thead>
                  <tr>
                    <th style={th}>Site ID</th>
                    <th style={th}>Nom du site</th>
                    <th style={th}>Typologie contractuelle</th>
                    <th style={th}>Load commandé</th>
                    <th style={th}>Indoor / Outdoor</th>
                    <th style={th}>Batch</th>
                    <th style={th}>Conso moy/jour (L)</th>
                    <th style={th}>Commande sans marge (L)</th>
                    <th style={th}>Commande avec marge (L)</th>
                    <th style={th}>Stock estimé fin de mois (L)</th>
                    <th style={th}>Typo opérations</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
                      <td style={{ ...td, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.site_id}</td>
                      <td style={td}>{r.site_name || "—"}</td>
                      <td style={td}>{r.typologie_contractuelle || "—"}</td>
                      <td style={td}><NumCell value={r.load_commande} /></td>
                      <td style={td}>{r.indoor_outdoor || "—"}</td>
                      <td style={td}>{r.batch || "—"}</td>
                      <td style={td}><NumCell value={r.conso_moy_jour_l} /></td>
                      <td style={td}><NumCell value={r.commande_sans_marge_l} /></td>
                      <td style={td}><NumCell value={r.commande_avec_marge_l} /></td>
                      <td style={td}><NumCell value={r.estimation_stock_final_l} /></td>
                      <td style={td}>{r.typo_operations || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data?.pagination && (
              <Pager
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                hasPrev={data.pagination.hasPrev}
                hasNext={data.pagination.hasNext}
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
