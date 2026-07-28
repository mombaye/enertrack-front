// src/features/fuel-tracking/sheets/StockDepotSheet.tsx
// Feuille STOCK_DÉPÔT — recoupement stock capteur (RMS) vs stock théorique
// calculé (mouvements ENOC + conso eFMS), PAR SITE, pas un entrepôt central
// séparé (aucune source de données ne modélise un dépôt physique distinct
// des sites — vérifié). Réutilise les données déjà chargées pour Conso
// Mensuelle, aucun appel Snowflake supplémentaire.

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp, SlidersHorizontal, Warehouse } from "lucide-react";
import type { FuelMonthlyRow } from "@/services/fuelTracking";
import { Card, EmptyState, Pill, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { fmtMaybeNum, n } from "../helpers";

function ravitaillementOf(r: FuelMonthlyRow): number {
  return n(r.enoc.refueling_liters) + n(r.enoc.ajout_in_liters);
}
function soldeTheoriqueClot(r: FuelMonthlyRow): number | null {
  if (r.stock.ouv_rms === null || r.stock.ouv_rms === undefined) return null;
  return n(r.stock.ouv_rms) + ravitaillementOf(r) - n(r.enoc.prelevement_out_liters) - n(r.efms.fuel_conso_l);
}
function ecartDepot(r: FuelMonthlyRow): number | null {
  const theo = soldeTheoriqueClot(r);
  if (theo === null || r.stock.clot_rms === null || r.stock.clot_rms === undefined) return null;
  return n(r.stock.clot_rms) - theo;
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
  {
    key: "ouv_rms", label: "Stock Ouv. (L)", align: "right", sortAccessor: (r) => n(r.stock.ouv_rms),
    render: (r) => fmtMaybeNum(r.stock.ouv_rms),
  },
  {
    key: "entree", label: "Entrée (L)", align: "right", sortAccessor: ravitaillementOf,
    render: (r) => {
      const v = ravitaillementOf(r);
      return v > 0 ? <span style={{ fontWeight: 800, color: FT.green, fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtMaybeNum(v)}</span> : <span style={{ color: FT.textSub }}>—</span>;
    },
  },
  {
    key: "sortie", label: "Sortie (L)", align: "right", sortAccessor: (r) => n(r.enoc.prelevement_out_liters),
    render: (r) => (r.enoc.prelevement_out_liters > 0 ? <span style={{ fontWeight: 800, color: FT.red, fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtMaybeNum(r.enoc.prelevement_out_liters)}</span> : <span style={{ color: FT.textSub }}>—</span>),
  },
  {
    key: "conso", label: "Conso (L)", align: "right", sortAccessor: (r) => n(r.efms.fuel_conso_l),
    render: (r) => <span style={{ fontWeight: 700, color: FT.orange, fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtMaybeNum(r.efms.fuel_conso_l)}</span>,
  },
  {
    key: "solde_theo", label: "Solde Théorique (L)", align: "right", sortAccessor: (r) => soldeTheoriqueClot(r) ?? 0,
    render: (r) => fmtMaybeNum(soldeTheoriqueClot(r)),
  },
  {
    key: "solde_depot", label: "Solde Dépôt — capteur (L)", align: "right", sortAccessor: (r) => n(r.stock.clot_rms),
    render: (r) => <span style={{ fontWeight: 700, fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtMaybeNum(r.stock.clot_rms)}</span>,
  },
  {
    key: "ecart", label: "Écart Dépôt (L)", align: "right", sortAccessor: (r) => ecartDepot(r) ?? 0,
    render: (r) => {
      const e = ecartDepot(r);
      if (e === null) return <span style={{ color: FT.textSub }}>—</span>;
      const suspect = Math.abs(e) > 0.1 * Math.max(1, Math.abs(soldeTheoriqueClot(r) ?? 0));
      return <Pill label={`${e >= 0 ? "+" : ""}${fmtMaybeNum(e)}`} tone={suspect ? "red" : "green"} />;
    },
  },
  // ── Colonnes avancées ────────────────────────────────────────────────────
  {
    key: "solde_reel", label: "Solde Clôt. — relevé technicien (L)", align: "right", advanced: true, sortAccessor: (r) => n(r.stock.clot_reel),
    render: (r) => fmtMaybeNum(r.stock.clot_reel),
  },
  {
    key: "ecart_capteur_reel", label: "Écart capteur vs technicien (L)", align: "right", advanced: true,
    sortAccessor: (r) => (r.stock.clot_rms !== null && r.stock.clot_reel !== null ? n(r.stock.clot_rms) - n(r.stock.clot_reel) : 0),
    render: (r) => {
      if (r.stock.clot_rms === null || r.stock.clot_reel === null) return <span style={{ color: FT.textSub }}>—</span>;
      const e = n(r.stock.clot_rms) - n(r.stock.clot_reel);
      return <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: Math.abs(e) > 50 ? FT.orange : FT.textMid }}>{e >= 0 ? "+" : ""}{fmtMaybeNum(e)}</span>;
    },
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

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return null;
  return dir === "asc" ? <ArrowUp size={11} style={{ marginLeft: 4 }} /> : <ArrowDown size={11} style={{ marginLeft: 4 }} />;
}

export function StockDepotSheet({ rows, loading }: { rows: FuelMonthlyRow[]; loading: boolean }) {
  const [sortKey, setSortKey] = useState("ecart");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAdvanced, setShowAdvanced] = useState(false);

  function sortBy(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const visibleColumns = useMemo(() => COLUMNS.filter((c) => showAdvanced || !c.advanced), [showAdvanced]);

  const withRms = useMemo(() => rows.filter((r) => r.stock.ouv_rms !== null || r.stock.clot_rms !== null), [rows]);

  const sortedRows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey);
    const acc = col?.sortAccessor;
    if (!acc) return withRms;
    return [...withRms].sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [withRms, sortKey, sortDir]);

  return (
    <Card padded={false} style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <SheetTitle
          icon={<Warehouse size={17} />}
          title="Stock Dépôt — capteur vs théorique, par site"
          subtitle="Solde théorique = Stock Ouv. (capteur) + Entrée − Sortie − Conso. Écart = Solde Dépôt (capteur, fin de mois) − Solde Théorique. Limité aux sites avec relevé capteur RMS ce mois."
        />
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          title="Afficher le relevé technicien (réel) en plus du capteur"
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
          <EmptyState
            icon={<Warehouse size={20} />}
            title="Aucun site avec relevé capteur ce mois"
            subtitle="Le Stock Dépôt ne peut être calculé que pour les sites équipés d'un capteur de niveau RMS ayant remonté au moins une lecture ce mois-ci."
          />
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
                  <tr key={r.site_id || r.site_name} style={{ borderBottom: `1px solid ${FT.border}` }}>
                    {visibleColumns.map((col) => (
                      <td key={col.key} style={{ padding: "11px 14px", textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left" }}>
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
        {sortedRows.length} site(s) avec relevé capteur — {rows.length - withRms.length} site(s) du mois sans lecture RMS (non affiché ici, voir Conso Mensuelle).
      </div>
    </Card>
  );
}
