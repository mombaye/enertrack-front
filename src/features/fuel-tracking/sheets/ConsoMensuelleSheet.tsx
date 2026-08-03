// src/features/fuel-tracking/sheets/ConsoMensuelleSheet.tsx
// Feuille CONSO_MENSUELLE — suivi consommation mensuelle par site.
//
// Table compacte : identité site + statut + RH (précédent/courant) +
// ravitaillement/ponction + conso + écart visibles par défaut ; le reste
// (GE, cuves, cibles, CPH, stock RMS) en colonnes optionnelles (bouton
// "Colonnes avancées") ou dans la fiche site complète au clic sur une ligne.

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight, Fuel, SlidersHorizontal } from "lucide-react";
import type { FuelMonthlyRow } from "@/services/fuelTracking";
import { Card, EmptyState, Pill, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import SiteDetailModal from "./SiteDetailModal";
import { consoRms, fmt2, fmtMaybeNum, fmtNum, n, siteConfig, siteTypology, statusTone } from "../helpers";

const RH_SOURCE_LABEL: Record<string, string> = {
  SNOWFLAKE_DSE_COUNTER: "DSE",
  SNOWFLAKE_GE_STATUS: "GE status",
  SNOWFLAKE_RECTIFIER_STATUS: "Redresseur",
  ENOC_HOUR_METER: "ENOC",
  NO_DATA: "—",
};

type SortDir = "asc" | "desc";

function regionOf(r: FuelMonthlyRow): string {
  return r.zone_label || r.zone || r.enoc_site_ref?.region || "Non renseigné";
}
function rhFinalOf(r: FuelMonthlyRow): number {
  return r.efms.rh_hours ?? n(r.efms.ge_working_hours) ?? 0;
}
function ravitaillementOf(r: FuelMonthlyRow): number {
  return n(r.enoc.refueling_liters) + n(r.enoc.ajout_in_liters);
}

function HoursValue({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span style={{ color: FT.textSub }}>—</span>;
  return <span style={{ fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{fmt2.format(n(value))}</span>;
}

function SourcePill({ source }: { source?: string | null }) {
  if (!source || source === "NO_DATA") return <span style={{ color: FT.textSub }}>—</span>;
  return <Pill label={RH_SOURCE_LABEL[source] || source} tone={source === "SNOWFLAKE_DSE_COUNTER" ? "green" : "cyan"} />;
}

interface Col {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  advanced?: boolean;
  sortAccessor?: (r: FuelMonthlyRow) => string | number;
  render: (r: FuelMonthlyRow) => ReactNode;
}

const COLUMNS: Col[] = [
  {
    key: "site", label: "Site", sortAccessor: (r) => r.site_id || r.site_name || "",
    render: (r) => (
      <>
        <div style={{ fontWeight: 800, color: FT.text, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5 }}>{r.site_id || "—"}</div>
        <div style={{ fontSize: 11.5, color: FT.textSub, marginTop: 1, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.site_name || "—"}</div>
      </>
    ),
  },
  { key: "region", label: "Zone / Région", sortAccessor: regionOf, render: (r) => regionOf(r) },
  { key: "typo", label: "Typologie", sortAccessor: (r) => siteTypology(r), render: (r) => siteTypology(r) },
  {
    key: "statut", label: "Statut", align: "center", sortAccessor: (r) => r.gaps.status.code,
    render: (r) => <Pill label={r.gaps.status.label} tone={statusTone(r.gaps.status.code)} />,
  },
  {
    key: "rh_prev", label: "RH Mois Préc. (h)", align: "right", sortAccessor: (r) => n(r.efms.rh_initial_hours),
    render: (r) => <HoursValue value={r.efms.rh_initial_hours} />,
  },
  {
    key: "rh_prev_source", label: "Source RH Préc.", align: "center", sortAccessor: (r) => RH_SOURCE_LABEL[r.efms.rh_initial_source || ""] || r.efms.rh_initial_source || "",
    render: (r) => <SourcePill source={r.efms.rh_initial_source} />,
  },
  {
    key: "rh_final", label: "RH Final (h)", align: "right", sortAccessor: rhFinalOf,
    render: (r) => <HoursValue value={r.efms.rh_hours ?? (n(r.efms.ge_working_hours) || null)} />,
  },
  {
    key: "rh_final_source", label: "Source RH Final", align: "center", sortAccessor: (r) => RH_SOURCE_LABEL[r.efms.rh_source || ""] || r.efms.rh_source || "",
    render: (r) => <SourcePill source={r.efms.rh_source} />,
  },
  {
    key: "ravitaillement", label: "Ravitaillement (L)", align: "right", sortAccessor: ravitaillementOf,
    render: (r) => {
      const total = ravitaillementOf(r);
      return total > 0 ? <span style={{ fontWeight: 800, color: FT.green, fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtNum(total)}</span> : <span style={{ color: FT.textSub }}>—</span>;
    },
  },
  {
    key: "ponction", label: "Ponction (L)", align: "right", sortAccessor: (r) => n(r.enoc.prelevement_out_liters),
    render: (r) => (r.enoc.prelevement_out_liters > 0 ? <span style={{ fontWeight: 800, color: FT.red, fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtNum(r.enoc.prelevement_out_liters)}</span> : <span style={{ color: FT.textSub }}>—</span>),
  },
  {
    key: "conso", label: "Conso Réelle (L)", align: "right", sortAccessor: (r) => n(r.efms.fuel_conso_l),
    render: (r) => <span style={{ fontWeight: 800, color: FT.orange, fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtNum(r.efms.fuel_conso_l)}</span>,
  },
  {
    key: "ecart", label: "Écart vs Target", align: "right", sortAccessor: (r) => (r.gaps.deli_vs_enoc_l === null ? 0 : Math.abs(n(r.gaps.deli_vs_enoc_l))),
    render: (r) =>
      r.gaps.deli_vs_enoc_l === null ? (
        <span style={{ color: FT.textSub }}>—</span>
      ) : (
        <span style={{ fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace", color: Math.abs(n(r.gaps.deli_vs_enoc_l)) > 0 ? FT.orange : FT.green }}>
          {fmtNum(r.gaps.deli_vs_enoc_l)} L
          {r.gaps.deli_vs_enoc_pct !== null && <span style={{ color: FT.textSub, fontWeight: 600, marginLeft: 5 }}>({fmt2.format(n(r.gaps.deli_vs_enoc_pct))}%)</span>}
        </span>
      ),
  },
  // ── Colonnes avancées (optionnelles) ─────────────────────────────────────
  { key: "batch", label: "Batch", advanced: true, sortAccessor: (r) => r.site_ref?.batch_operational || "", render: (r) => r.site_ref?.batch_operational || r.enoc_site_ref?.batch_operational || r.enoc_site_ref?.batch || "—" },
  { key: "config", label: "Configuration", advanced: true, sortAccessor: (r) => siteConfig(r), render: (r) => siteConfig(r) },
  {
    key: "conso_theorique", label: "Conso Théorique (L)", align: "right", advanced: true, sortAccessor: (r) => n(r.efms.fuel_deli_l),
    render: (r) => <span style={{ fontWeight: 700, color: FT.blue, fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtNum(r.efms.fuel_deli_l)}</span>,
  },
  {
    key: "conso_rms", label: "Conso RMS (L)", align: "right", advanced: true, sortAccessor: (r) => consoRms(r) ?? 0,
    render: (r) => { const v = consoRms(r); return v === null ? <span style={{ color: FT.textSub }}>—</span> : <span style={{ fontWeight: 700, fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtNum(v)}</span>; },
  },
  {
    key: "cph_reel", label: "CPH Réel (L/h)", align: "right", advanced: true, sortAccessor: (r) => n(r.efms.cph_l_per_hour),
    render: (r) => <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{fmt2.format(n(r.efms.cph_l_per_hour))}</span>,
  },
  {
    key: "stock_ouv_rms", label: "Stock Ouv. RMS (L)", align: "right", advanced: true, sortAccessor: (r) => n(r.stock.ouv_rms),
    render: (r) => fmtMaybeNum(r.stock.ouv_rms),
  },
  {
    key: "stock_clot_rms", label: "Stock Clôt. RMS (L)", align: "right", advanced: true, sortAccessor: (r) => n(r.stock.clot_rms),
    render: (r) => fmtMaybeNum(r.stock.clot_rms),
  },
];

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

export function ConsoMensuelleSheet({ rows, loading, stickyTop = 0 }: { rows: FuelMonthlyRow[]; loading: boolean; stickyTop?: number }) {
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [detailRow, setDetailRow] = useState<FuelMonthlyRow | null>(null);
  const [sortKey, setSortKey] = useState("ecart");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const titleRowRef = useRef<HTMLDivElement | null>(null);
  const [titleRowHeight, setTitleRowHeight] = useState(0);

  useLayoutEffect(() => {
    const el = titleRowRef.current;
    if (!el) return;
    setTitleRowHeight(el.getBoundingClientRect().height);
    const ro = new ResizeObserver(() => {
      setTitleRowHeight(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const GAP = 16;
  const tableStickyTop = stickyTop + titleRowHeight + GAP;

  function sortBy(key: string) {
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

  const visibleColumns = useMemo(() => COLUMNS.filter((c) => showAdvanced || !c.advanced), [showAdvanced]);

  const sortedRows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey);
    const acc = col?.sortAccessor;
    if (!acc) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortKey, sortDir]);

  return (
    <Card padded={false} style={{ padding: 20 }}>
      <div
        ref={titleRowRef}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          position: "sticky",
          top: stickyTop,
          zIndex: 9,
          background: FT.card,
        }}
      >
        <SheetTitle
          icon={<Fuel size={17} />}
          title="Conso mensuelle — suivi carburant par site"
          subtitle="Identité, statut, RH mois précédent/courant, ravitaillement/ponction et conso — clique une ligne pour la fiche site complète."
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            title="Afficher des colonnes supplémentaires (batch, config, CPH, stock RMS...)"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: `1px solid ${showAdvanced ? FT.gold : FT.border}`,
              background: showAdvanced ? FT.goldL : FT.card,
              color: showAdvanced ? FT.gold : FT.textMid,
              borderRadius: 999,
              padding: "7px 13px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <SlidersHorizontal size={13} />
            Colonnes avancées
          </button>
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
      </div>

      <div
        style={{
          marginTop: GAP,
          border: `1px solid ${FT.border}`,
          borderRadius: FT.radius,
          overflow: "hidden",
          position: "sticky",
          top: tableStickyTop,
          background: FT.card,
          zIndex: 8,
        }}
      >
        {loading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            {[...Array(6)].map((_, i) => <Skeleton key={i} h={44} />)}
          </div>
        ) : sortedRows.length === 0 ? (
          <EmptyState icon={<Fuel size={20} />} title={anomaliesOnly ? "Aucune anomalie sur la période" : "Aucune donnée sur la période"} />
        ) : (
          <div className="ft-scroll" style={{ maxHeight: 640, overflowX: "auto", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {visibleColumns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortAccessor && sortBy(col.key)}
                      style={{ ...TH_STYLE, textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left" }}
                    >
                      {col.label}
                      {col.sortAccessor && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                    </th>
                  ))}
                  <th style={{ ...TH_STYLE, textAlign: "center", cursor: "default" }} />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.key} onClick={() => setDetailRow(r)} className="ft-row" style={{ cursor: "pointer", borderBottom: `1px solid ${FT.border}` }}>
                    {visibleColumns.map((col) => (
                      <td key={col.key} style={{ padding: "11px 14px", textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left", color: FT.textMid }}>
                        {col.render(r)}
                      </td>
                    ))}
                    <td style={{ padding: "11px 14px", textAlign: "center", color: FT.textSub }}>
                      <ChevronRight size={15} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 11.5, color: FT.textSub, fontWeight: 700 }}>
        {sortedRows.length} site(s) affiché(s) — {visibleColumns.length} colonne(s)
      </div>

      {detailRow ? <SiteDetailModal row={detailRow} onClose={() => setDetailRow(null)} /> : null}
    </Card>
  );
}
