// src/features/fuel-tracking/sheets/JournalSheet.tsx
// Feuille JOURNAL_RAVITAILLEMENT — traçabilité des mouvements ENOC.
//
// Table : identité + type + technicien + niveau + compteur horaire + quantité
// + % target + balance visibles par défaut ; le reste (zone, provenance
// ponction, RMS, bon de livraison, validation, commentaire) en colonnes
// optionnelles ("Colonnes avancées") ou dans la fiche mouvement complète
// (MovementDetailModal), ouverte au clic sur une ligne.

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronRight, ClipboardList, SlidersHorizontal } from "lucide-react";
import type { FuelEnocMovement, FuelMonthlyRow } from "@/services/fuelTracking";
import { Card, EmptyState, Pill, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import SiteDetailModal, { type SiteDetailRow } from "./SiteDetailModal";
import MovementDetailModal from "./MovementDetailModal";
import {
  balanceCheck,
  blGapLiters,
  blGapPercent,
  fmtDateTime,
  fmtMaybeNum,
  journalSource,
  maybeNumber,
  operationTypeTone,
} from "../helpers";

function fmtLevel(value: unknown, unit?: string | null) {
  const n = maybeNumber(value);
  if (n === null) return "—";
  return `${fmtMaybeNum(n)} ${(unit || "L").toLowerCase()}`;
}

function targetTone(status?: string | null) {
  if (status === "exceeded" || status === "no_target_consumed") return "red";
  if (status === "warning") return "orange";
  if (status === "ok") return "green";
  return "slate";
}

interface Col {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  advanced?: boolean;
  sortAccessor?: (r: FuelEnocMovement) => string | number;
  render: (r: FuelEnocMovement) => ReactNode;
}

const COLUMNS: Col[] = [
  {
    key: "site", label: "Site", sortAccessor: (r) => r.site_id || r.site_name || "",
    render: (r) => (
      <>
        <div style={{ fontWeight: 800, color: FT.text, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5 }}>{r.site_id || "—"}</div>
        <div style={{ fontSize: 11.5, color: FT.textSub, marginTop: 1 }}>{r.request_code || r.site_name || "—"}</div>
      </>
    ),
  },
  {
    key: "date", label: "Date", sortAccessor: (r) => (r.operation_date ? new Date(r.operation_date).getTime() : 0),
    render: (r) => <span style={{ whiteSpace: "nowrap" }}>{fmtDateTime(r.operation_date)}</span>,
  },
  {
    key: "type", label: "Type d'action", sortAccessor: (r) => r.operation_type || "",
    render: (r) => <Pill label={r.operation_type || "—"} tone={operationTypeTone(r.operation_type)} />,
  },
  {
    key: "technicien", label: "Technicien", sortAccessor: (r) => r.technician_name || "",
    render: (r) => (
      <>
        <div style={{ fontWeight: 700, color: FT.text }}>{r.technician_name || "—"}</div>
        {r.team && <div style={{ fontSize: 11, color: FT.textSub, marginTop: 1 }}>{r.team}</div>}
      </>
    ),
  },
  {
    key: "niveau", label: "Niveau avant → après", align: "right", sortAccessor: (r) => maybeNumber(r.level_after) ?? 0,
    render: (r) => (
      <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: FT.textMid }}>
        {fmtLevel(r.level_before, r.level_before_unit)} <span style={{ color: FT.textSub }}>→</span> {fmtLevel(r.level_after, r.level_after_unit)}
      </span>
    ),
  },
  {
    key: "compteur", label: "Compteur horaire (h)", align: "right", sortAccessor: (r) => maybeNumber(r.hour_meter_after) ?? 0,
    render: (r) => (
      <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: FT.textMid }}>
        {fmtMaybeNum(r.hour_meter_before)} <span style={{ color: FT.textSub }}>→</span> {fmtMaybeNum(r.hour_meter_after)}
      </span>
    ),
  },
  {
    key: "qte", label: "Qté transférée (L)", align: "right", sortAccessor: (r) => Number(r.quantity_added_liters) || 0,
    render: (r) => (
      <span style={{ fontWeight: 800, color: FT.green, fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtMaybeNum(r.quantity_added_liters)}</span>
    ),
  },
  {
    key: "target", label: "% Target", align: "center", sortAccessor: (r) => maybeNumber(r.target_percent_after) ?? -1,
    render: (r) => {
      const pct = maybeNumber(r.target_percent_after);
      return pct === null ? <span style={{ color: FT.textSub }}>—</span> : <Pill label={`${fmtMaybeNum(pct)}%`} tone={targetTone(r.target_status)} />;
    },
  },
  {
    key: "balance", label: "Balance", align: "center", sortAccessor: balanceCheck,
    render: (r) => {
      const balance = balanceCheck(r);
      return <Pill label={balance} tone={balance === "OK" ? "green" : balance === "Écart" ? "orange" : "slate"} />;
    },
  },
  // ── Colonnes avancées (optionnelles) ─────────────────────────────────────
  {
    key: "zone", label: "Zone / Ville", advanced: true, sortAccessor: (r) => r.zone || "",
    render: (r) => (
      <>
        <div>{r.zone || "—"}</div>
        {r.ville && <div style={{ fontSize: 11, color: FT.textSub, marginTop: 1 }}>{r.ville}</div>}
      </>
    ),
  },
  {
    key: "provenance", label: "Provenance (ponction)", advanced: true, sortAccessor: journalSource,
    render: (r) => (r.operation_type === "PONCTION" ? journalSource(r) : <span style={{ color: FT.textSub }}>—</span>),
  },
  {
    key: "rms", label: "RMS avant → après (L)", align: "right", advanced: true, sortAccessor: (r) => maybeNumber(r.rms_level_after) ?? 0,
    render: (r) => (
      <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
        {fmtMaybeNum(r.rms_level_before)} <span style={{ color: FT.textSub }}>→</span> {fmtMaybeNum(r.rms_level_after)}
      </span>
    ),
  },
  {
    key: "bl", label: "BL (n° · qté · écart)", advanced: true, sortAccessor: (r) => r.delivery_note_number || "",
    render: (r) => {
      if (!r.delivery_note_number && r.delivery_note_quantity_liters == null) return <span style={{ color: FT.textSub }}>—</span>;
      const gapL = blGapLiters(r);
      const gapPct = blGapPercent(r);
      return (
        <>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{r.delivery_note_number || "—"} · {fmtMaybeNum(r.delivery_note_quantity_liters)} L</div>
          {gapL !== null && (
            <div style={{ fontSize: 11, color: Math.abs(gapL) > 1 ? FT.orange : FT.textSub, marginTop: 1 }}>
              Écart {fmtMaybeNum(gapL)} L{gapPct !== null ? ` (${fmtMaybeNum(gapPct)}%)` : ""}
            </div>
          )}
        </>
      );
    },
  },
  {
    key: "validated_by", label: "Validé par", advanced: true, sortAccessor: (r) => r.validated_by || "",
    render: (r) => r.validated_by || <span style={{ color: FT.textSub }}>—</span>,
  },
  {
    key: "comment", label: "Commentaire", advanced: true, sortAccessor: (r) => r.comment || "",
    render: (r) => (
      <span style={{ maxWidth: 220, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.comment || undefined}>
        {r.comment || <span style={{ color: FT.textSub }}>—</span>}
      </span>
    ),
  },
  { key: "chevron", label: "", align: "center", render: () => <ChevronRight size={15} /> },
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

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return null;
  return dir === "asc" ? <ArrowUp size={11} style={{ marginLeft: 4 }} /> : <ArrowDown size={11} style={{ marginLeft: 4 }} />;
}

export function JournalSheet({ rows, loading, monthlyRows = [] }: { rows: FuelEnocMovement[]; loading: boolean; monthlyRows?: FuelMonthlyRow[] }) {
  const [detailMovement, setDetailMovement] = useState<FuelEnocMovement | null>(null);
  const [detailSite, setDetailSite] = useState<SiteDetailRow | null>(null);
  const [sortKey, setSortKey] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAdvanced, setShowAdvanced] = useState(false);

  function sortBy(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function openSite(r: FuelEnocMovement) {
    const match = monthlyRows.find((m) => m.site_id === r.site_id);
    setDetailSite(match || { site_id: r.site_id, site_name: r.site_name, zone: r.zone, ville: r.ville });
  }

  const visibleColumns = useMemo(() => COLUMNS.filter((c) => showAdvanced || !c.advanced), [showAdvanced]);

  const sortedRows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey);
    const acc = col?.sortAccessor;
    if (!acc) return rows;
    return [...rows].sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  return (
    <Card padded={false} style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <SheetTitle
          icon={<ClipboardList size={17} />}
          title="Journal ravitaillement — mouvements ENOC"
          subtitle="Identité, type, technicien, niveau, compteur horaire, quantité et % target — clique une ligne pour le détail complet."
        />
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          title="Afficher des colonnes supplémentaires (zone, provenance, RMS, BL, validation, commentaire...)"
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
      </div>

      <div style={{ marginTop: 16, border: `1px solid ${FT.border}`, borderRadius: FT.radius, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            {[...Array(6)].map((_, i) => <Skeleton key={i} h={44} />)}
          </div>
        ) : sortedRows.length === 0 ? (
          <EmptyState icon={<ClipboardList size={20} />} title="Aucun mouvement ENOC" subtitle="Aucun mouvement carburant enregistré sur cette période." />
        ) : (
          <div className="ft-scroll" style={{ maxHeight: 620, overflowX: "auto", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {visibleColumns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortAccessor && sortBy(col.key)}
                      style={{ ...TH_STYLE, textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left", cursor: col.sortAccessor ? "pointer" : "default" }}
                    >
                      {col.label}
                      {col.sortAccessor && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.id} onClick={() => setDetailMovement(r)} className="ft-row" style={{ cursor: "pointer", borderBottom: `1px solid ${FT.border}` }}>
                    {visibleColumns.map((col) => (
                      <td key={col.key} style={{ padding: "11px 14px", textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left", color: col.align ? undefined : FT.textMid }}>
                        {col.render(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 11.5, color: FT.textSub, fontWeight: 700 }}>
        {sortedRows.length} mouvement(s) affiché(s)
      </div>

      {detailMovement ? (
        <MovementDetailModal
          row={detailMovement}
          onClose={() => setDetailMovement(null)}
          onViewSite={() => {
            openSite(detailMovement);
            setDetailMovement(null);
          }}
        />
      ) : null}
      {detailSite ? <SiteDetailModal row={detailSite} onClose={() => setDetailSite(null)} /> : null}
    </Card>
  );
}
