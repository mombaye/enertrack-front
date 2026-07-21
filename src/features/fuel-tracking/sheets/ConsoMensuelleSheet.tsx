// src/features/fuel-tracking/sheets/ConsoMensuelleSheet.tsx
// Feuille CONSO_MENSUELLE — suivi consommation mensuelle par site.
//
// Table compacte (colonnes essentielles, scroll vertical uniquement) — le
// détail complet (référentiel, GE, cuves, cibles, stock, CPH) est dans la
// fiche site (SiteDetailModal), ouverte au clic sur une ligne. Ancienne
// version : ExcelGrid à ~40 colonnes avec scroll horizontal + vertical.

import { useMemo, useState, type CSSProperties } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight, Fuel } from "lucide-react";
import type { FuelMonthlyRow } from "@/services/fuelTracking";
import { Card, EmptyState, Pill, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import SiteDetailModal from "./SiteDetailModal";
import { fmt2, fmtNum, n, statusTone } from "../helpers";

const RH_SOURCE_LABEL: Record<string, string> = {
  SNOWFLAKE_DSE_COUNTER: "DSE",
  SNOWFLAKE_GE_STATUS: "GE status",
  SNOWFLAKE_RECTIFIER_STATUS: "Redresseur",
  ENOC_HOUR_METER: "ENOC",
  NO_DATA: "—",
};

type SortKey = "site" | "region" | "statut" | "rh" | "conso" | "ecart";
type SortDir = "asc" | "desc";

function regionOf(r: FuelMonthlyRow): string {
  return r.zone_label || r.zone || r.enoc_site_ref?.region || "Non renseigné";
}
function rhOf(r: FuelMonthlyRow): number {
  return r.efms.rh_hours ?? n(r.efms.ge_working_hours) ?? 0;
}

const SORT_ACCESSORS: Record<SortKey, (r: FuelMonthlyRow) => string | number> = {
  site: (r) => r.site_id || r.site_name || "",
  region: (r) => regionOf(r),
  statut: (r) => r.gaps.status.code,
  rh: rhOf,
  conso: (r) => n(r.efms.fuel_conso_l),
  ecart: (r) => (r.gaps.deli_vs_enoc_l === null ? 0 : Math.abs(n(r.gaps.deli_vs_enoc_l))),
};

const TH_STYLE: CSSProperties = {
  position: "sticky",
  top: 0,
  background: FT.slateL,
  textAlign: "left",
  padding: "11px 14px",
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: ".05em",
  color: FT.textSub,
  borderBottom: `1px solid ${FT.borderStrong}`,
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontWeight: 800,
  userSelect: "none",
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return null;
  return dir === "asc" ? <ArrowUp size={11} style={{ marginLeft: 4 }} /> : <ArrowDown size={11} style={{ marginLeft: 4 }} />;
}

export function ConsoMensuelleSheet({ rows, loading }: { rows: FuelMonthlyRow[]; loading: boolean }) {
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [detailRow, setDetailRow] = useState<FuelMonthlyRow | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ecart");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function sortBy(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filteredRows = useMemo(
    () => (anomaliesOnly ? rows.filter((r) => (r.efms.anomaly_flags?.length ?? 0) > 0) : rows),
    [rows, anomaliesOnly]
  );

  const sortedRows = useMemo(() => {
    const acc = SORT_ACCESSORS[sortKey];
    return [...filteredRows].sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortKey, sortDir]);

  const columns: Array<{ key: SortKey | null; label: string; align?: "left" | "right" | "center" }> = [
    { key: "site", label: "Site" },
    { key: "region", label: "Région" },
    { key: "statut", label: "Statut", align: "center" },
    { key: "rh", label: "RH Final (h)", align: "right" },
    { key: "conso", label: "Conso Réelle (L)", align: "right" },
    { key: "ecart", label: "Écart vs Target", align: "right" },
    { key: null, label: "", align: "center" },
  ];

  return (
    <Card padded={false} style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <SheetTitle
          icon={<Fuel size={17} />}
          title="Conso mensuelle — suivi carburant par site"
          subtitle="Colonnes essentielles ci-dessous — clique une ligne pour la fiche site complète (référentiel, GE, cuves, cibles, stock, CPH)."
        />
        <button
          onClick={() => setAnomaliesOnly((v) => !v)}
          title="N'afficher que les sites avec au moins une anomalie détectée"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: `1px solid ${anomaliesOnly ? FT.red : FT.border}`,
            background: anomaliesOnly ? FT.redL : FT.card,
            color: anomaliesOnly ? FT.red : FT.textMid,
            borderRadius: 999,
            padding: "7px 13px",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <AlertTriangle size={13} />
          Avec anomalies uniquement
        </button>
      </div>

      <div style={{ marginTop: 16, border: `1px solid ${FT.border}`, borderRadius: FT.radius, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            {[...Array(6)].map((_, i) => <Skeleton key={i} h={44} />)}
          </div>
        ) : sortedRows.length === 0 ? (
          <EmptyState icon={<Fuel size={20} />} title={anomaliesOnly ? "Aucune anomalie sur la période" : "Aucune donnée sur la période"} />
        ) : (
          <div className="ft-scroll" style={{ maxHeight: 620, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.label || "action"}
                      onClick={() => col.key && sortBy(col.key)}
                      style={{ ...TH_STYLE, textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left", cursor: col.key ? "pointer" : "default" }}
                    >
                      {col.label}
                      {col.key && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => {
                  const rh = r.efms.rh_hours ?? (n(r.efms.ge_working_hours) || null);
                  return (
                    <tr
                      key={r.key}
                      onClick={() => setDetailRow(r)}
                      className="ft-row"
                      style={{ cursor: "pointer", borderBottom: `1px solid ${FT.border}` }}
                    >
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ fontWeight: 800, color: FT.text, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5 }}>{r.site_id || "—"}</div>
                        <div style={{ fontSize: 11.5, color: FT.textSub, marginTop: 1, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.site_name || "—"}</div>
                      </td>
                      <td style={{ padding: "11px 14px", color: FT.textMid }}>{regionOf(r)}</td>
                      <td style={{ padding: "11px 14px", textAlign: "center" }}>
                        <Pill label={r.gaps.status.label} tone={statusTone(r.gaps.status.code)} />
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "right" }}>
                        {rh === null ? (
                          <span style={{ color: FT.textSub }}>—</span>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                            <span style={{ fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{fmt2.format(n(rh))}</span>
                            {r.efms.rh_source && r.efms.rh_source !== "NO_DATA" && (
                              <Pill label={RH_SOURCE_LABEL[r.efms.rh_source] || r.efms.rh_source} tone={r.efms.rh_source === "SNOWFLAKE_DSE_COUNTER" ? "green" : "cyan"} />
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 800, color: FT.orange, fontFamily: "ui-monospace, Menlo, monospace" }}>
                        {fmtNum(r.efms.fuel_conso_l)}
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "right" }}>
                        {r.gaps.deli_vs_enoc_l === null ? (
                          <span style={{ color: FT.textSub }}>—</span>
                        ) : (
                          <span style={{ fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace", color: Math.abs(n(r.gaps.deli_vs_enoc_l)) > 0 ? FT.orange : FT.green }}>
                            {fmtNum(r.gaps.deli_vs_enoc_l)} L
                            {r.gaps.deli_vs_enoc_pct !== null && <span style={{ color: FT.textSub, fontWeight: 600, marginLeft: 5 }}>({fmt2.format(n(r.gaps.deli_vs_enoc_pct))}%)</span>}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "center", color: FT.textSub }}>
                        <ChevronRight size={15} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 11.5, color: FT.textSub, fontWeight: 700 }}>
        {sortedRows.length} site(s) affiché(s)
      </div>

      {detailRow ? <SiteDetailModal row={detailRow} onClose={() => setDetailRow(null)} /> : null}
    </Card>
  );
}
