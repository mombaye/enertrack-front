// src/features/fuel-tracking/sheets/ConsoMensuelleSheet.tsx
// Feuille CONSO_MENSUELLE — suivi consommation mensuelle par site.

import { useMemo, useState } from "react";
import { AlertTriangle, Fuel } from "lucide-react";
import type { FuelMonthlyRow } from "@/services/fuelTracking";
import { ExcelGrid, type ExcelGroup } from "../ExcelGrid";
import { Card, ComingCell, GroupToggleBar, Pill, SheetTitle } from "../ui";
import { FT } from "../theme";
import {
  consoRms,
  consoTheoriqueLH,
  facteurCharge,
  fmt2,
  fmtL,
  fmtMaybeKva,
  fmtMaybeL,
  geBrand1,
  geBrand2,
  gePower1,
  gePower2,
  modernizedLabel,
  n,
  primaryGe,
  realTypology,
  secondGe,
  siteConfig,
  siteLoad,
  siteTypology,
  statusTone,
  tankCapacity1,
  tankCapacity2,
  tankType,
} from "../helpers";

const RH_SOURCE_LABEL: Record<string, string> = {
  SNOWFLAKE_DSE_COUNTER: "DSE",
  SNOWFLAKE_GE_STATUS: "GE status",
  SNOWFLAKE_RECTIFIER_STATUS: "Redresseur",
  ENOC_HOUR_METER: "ENOC",
  NO_DATA: "—",
};

const CURVE_CONFIDENCE_LABEL: Record<string, { label: string; tone: "green" | "cyan" | "orange" }> = {
  MODEL_EXACT: { label: "Modèle", tone: "green" },
  MODEL_FUZZY: { label: "Modèle ~", tone: "cyan" },
  MODEL_EXACT_AMBIGUOUS_AVERAGED: { label: "Modèle (moy.)", tone: "orange" },
  MODEL_FUZZY_AMBIGUOUS_AVERAGED: { label: "Modèle ~ (moy.)", tone: "orange" },
  KVA_EXACT: { label: "kVA", tone: "cyan" },
  KVA_NEAREST: { label: "kVA proche", tone: "orange" },
  KVA_EXACT_AMBIGUOUS_AVERAGED: { label: "kVA (moy.)", tone: "orange" },
  KVA_NEAREST_AMBIGUOUS_AVERAGED: { label: "kVA proche (moy.)", tone: "orange" },
};

function HoursCell({ value, source }: { value: number | null | undefined; source?: string | null }) {
  if (value === null || value === undefined) return <ComingCell />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
      <span style={{ fontWeight: 800 }}>{fmt2.format(n(value))} h</span>
      {source && source !== "NO_DATA" && (
        <Pill label={RH_SOURCE_LABEL[source] || source} tone={source === "SNOWFLAKE_DSE_COUNTER" ? "green" : "cyan"} />
      )}
    </div>
  );
}

function RhCell({ row }: { row: FuelMonthlyRow }) {
  const value = row.efms.rh_hours ?? (n(row.efms.ge_working_hours) || null);
  return <HoursCell value={value} source={row.efms.rh_source} />;
}

const GROUP_IDS = ["referentiel", "cibles", "mois_precedent", "mois_courant", "conso_calculee", "cph", "ecarts", "stock"];

// "Stock" masqué par défaut : 100% de colonnes "à venir", aucune info perdue,
// et ça retire d'emblée 5 colonnes du scroll horizontal.
const DEFAULT_HIDDEN_GROUPS = ["stock"];
const HIDDEN_GROUPS_STORAGE_KEY = "ft-conso-mensuelle-hidden-groups";

function loadHiddenGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_GROUPS_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // localStorage indisponible (mode privé, etc.) — on retombe sur le défaut.
  }
  return new Set(DEFAULT_HIDDEN_GROUPS);
}

export function ConsoMensuelleSheet({ rows, loading }: { rows: FuelMonthlyRow[]; loading: boolean }) {
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(loadHiddenGroups);
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);

  function toggleGroup(id: string) {
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Ne jamais masquer le dernier groupe visible — la grille aurait 0 colonne.
        if (next.size >= GROUP_IDS.length - 1) return prev;
        next.add(id);
      }
      try {
        localStorage.setItem(HIDDEN_GROUPS_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }

  function showAllGroups() {
    setHiddenGroups(new Set());
    try {
      localStorage.setItem(HIDDEN_GROUPS_STORAGE_KEY, JSON.stringify([]));
    } catch {
      // ignore
    }
  }

  const groups: ExcelGroup<FuelMonthlyRow>[] = [
    {
      id: "referentiel",
      label: "Référentiel site",
      color: "navy",
      columns: [
        { id: "site_id", header: "Site ID", width: 110, emphasis: true, render: (r) => r.site_id || "—" },
        { id: "site_name", header: "Site Name", width: 190, render: (r) => r.site_name || "—" },
        { id: "region", header: "Région", width: 110, render: (r) => r.zone_label || r.zone || r.enoc_site_ref?.region || "—" },
        { id: "neuf", header: "Neuf/Existant", width: 110, render: modernizedLabel },
        { id: "batch", header: "Batch", width: 130, render: (r) => r.site_ref?.batch_operational || r.enoc_site_ref?.batch_operational || r.enoc_site_ref?.batch || "—" },
        { id: "typo_facturee", header: "Typo Facturée", width: 130, render: siteTypology },
        { id: "typo_reelle", header: "Typo Réelle", width: 130, render: realTypology },
        { id: "conf", header: "Conf", width: 70, render: siteConfig },
        { id: "priorite", header: "Priorité", width: 85, render: (r) => r.enoc_site_ref?.priority || "—" },
        { id: "puissance", header: "Puissance (W)", width: 110, align: "right", render: (r) => (siteLoad(r) !== null ? fmt2.format(n(siteLoad(r))) : "—") },
        { id: "ge_facture", header: "GE Facturé", width: 100, align: "right", render: (r) => r.enoc_site_ref?.nb_ge || "—" },
        { id: "ge_exist", header: "GE Exist", width: 90, align: "right", render: (r) => r.ge_ref?.assets_count || r.enoc_site_ref?.nb_ge || "—" },
        { id: "cap_cuve", header: "Cap. Cuve (L)", width: 120, align: "right", render: (r) => fmtMaybeL(tankCapacity1(r)) },
        { id: "marque_ge1", header: "Marque GE 1", width: 110, render: geBrand1 },
        { id: "kva1", header: "Capacité (KVA)", width: 110, align: "right", render: (r) => fmtMaybeKva(gePower1(r)) },
        { id: "cuve1", header: "Capacité Cuve (L)", width: 130, align: "right", render: (r) => fmtMaybeL(tankCapacity1(r)) },
        { id: "type_cuve1", header: "Type Cuve", width: 110, render: (r) => tankType(primaryGe(r)?.tank_connected, primaryGe(r)?.tank_shape) },
        { id: "marque_ge2", header: "Marque GE 2", width: 110, render: geBrand2 },
        { id: "kva2", header: "Capacité (KVA)", width: 110, align: "right", render: (r) => fmtMaybeKva(gePower2(r)) },
        { id: "cuve2", header: "Capacité Cuve (L)", width: 130, align: "right", render: (r) => fmtMaybeL(tankCapacity2(r)) },
        { id: "type_cuve2", header: "Type Cuve", width: 110, render: (r) => tankType(secondGe(r)?.tank_connected, secondGe(r)?.tank_shape) },
        { id: "fuel_sensor", header: "Fuel sensor existing", width: 140, render: (r) => r.enoc_site_ref?.rms_installed || "—" },
      ],
    },
    {
      id: "cibles",
      label: "Cibles",
      color: "gold",
      columns: [
        { id: "target_boq", header: "Target BOQ", width: 110, align: "right", render: () => <ComingCell /> },
        {
          id: "target_aktivco",
          header: "Target Aktivco",
          width: 160,
          align: "right",
          render: (r) =>
            r.enoc.monthly_target_liters ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                <span style={{ fontWeight: 800 }}>{fmtL(r.enoc.monthly_target_liters)}</span>
                {r.enoc.target_status && <Pill label={r.enoc.target_status} tone={r.enoc.target_status === "exceeded" ? "red" : "green"} />}
              </div>
            ) : (
              <ComingCell />
            ),
        },
        {
          id: "facteur_charge",
          header: "Facteur Charge",
          width: 120,
          align: "right",
          render: (r) => {
            const pct = facteurCharge(r);
            return pct === null ? <ComingCell /> : `${fmt2.format(pct)}%`;
          },
        },
        {
          id: "conso_theorique_lh",
          header: "Conso L/h Théorique",
          width: 170,
          align: "right",
          render: (r) => {
            const lh = consoTheoriqueLH(r);
            if (lh === null) return <ComingCell />;
            const confidence = primaryGe(r)?.fuel_curve?.confidence;
            const badge = confidence ? CURVE_CONFIDENCE_LABEL[confidence] : null;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                <span style={{ fontWeight: 800 }}>{fmt2.format(lh)} L/h</span>
                {badge && <Pill label={badge.label} tone={badge.tone} />}
              </div>
            );
          },
        },
      ],
    },
    {
      id: "mois_precedent",
      label: "Données mois précédent",
      color: "violet",
      columns: [
        {
          id: "rh_initial",
          header: "RH Initial",
          width: 150,
          align: "right",
          render: (r) => <HoursCell value={r.efms.rh_initial_hours} source={r.efms.rh_initial_source} />,
        },
        { id: "stock_ouv_rms", header: "Stock Ouv. RMS", width: 130, align: "right", render: (r) => fmtMaybeL(r.stock.ouv_rms) },
        { id: "stock_ouv_reel", header: "Stock Ouv. Réel", width: 130, align: "right", render: (r) => fmtMaybeL(r.stock.ouv_reel) },
        {
          id: "refueling",
          header: "Refueling",
          width: 120,
          align: "right",
          emphasis: true,
          render: (r) => (r.enoc.refueling_liters > 0 ? <span style={{ color: "#0F9D67", fontWeight: 800 }}>{fmtL(r.enoc.refueling_liters)}</span> : <ComingCell />),
        },
        {
          id: "prelevement_out",
          header: "Prélèvement Out",
          width: 130,
          align: "right",
          render: (r) => (r.enoc.prelevement_out_liters > 0 ? <span style={{ color: "#DC2626", fontWeight: 800 }}>{fmtL(r.enoc.prelevement_out_liters)}</span> : <ComingCell />),
        },
        {
          id: "ajout_in",
          header: "Ajout In",
          width: 110,
          align: "right",
          render: (r) => (r.enoc.ajout_in_liters > 0 ? fmtL(r.enoc.ajout_in_liters) : <ComingCell />),
        },
      ],
    },
    {
      id: "mois_courant",
      label: "Données mois en cours",
      color: "green",
      columns: [
        { id: "rh_final", header: "RH Final", width: 150, align: "right", render: (r) => <RhCell row={r} /> },
        { id: "stock_clot_rms", header: "Stock Clôt. RMS", width: 130, align: "right", render: (r) => fmtMaybeL(r.stock.clot_rms) },
        { id: "stock_clot_reel", header: "Stock Clôt. Réel", width: 130, align: "right", render: (r) => fmtMaybeL(r.stock.clot_reel) },
        {
          id: "rh_controleur",
          header: "RH Contrôleur Final",
          width: 160,
          align: "right",
          render: (r) =>
            r.efms.rh_source === "SNOWFLAKE_DSE_COUNTER" && r.efms.rh_hours !== null ? (
              <span style={{ fontWeight: 800 }}>{fmt2.format(n(r.efms.rh_hours))} h</span>
            ) : (
              <ComingCell />
            ),
        },
        { id: "stock_reel", header: "Stock Réel", width: 110, align: "right", render: (r) => fmtMaybeL(r.stock.reel) },
        {
          id: "rh_delta",
          header: "RH Delta",
          width: 150,
          align: "right",
          render: (r) => <HoursCell value={r.efms.rh_delta_hours} />,
        },
        {
          id: "stock_delta_rms",
          header: "Stock Delta RMS",
          width: 140,
          align: "right",
          render: (r) => {
            const d = r.stock.delta_rms;
            return d === null || d === undefined ? (
              <ComingCell />
            ) : (
              <span style={{ fontWeight: 800, color: d < 0 ? "#D97706" : "#0F9D67" }}>{fmtL(d)}</span>
            );
          },
        },
      ],
    },
    {
      id: "conso_calculee",
      label: "Consommation calculée",
      color: "cyan",
      columns: [
        {
          id: "conso_reelle",
          header: "Conso Réelle",
          width: 130,
          align: "right",
          emphasis: true,
          render: (r) => <span style={{ color: "#D97706", fontWeight: 800 }}>{fmtL(r.efms.fuel_conso_l)}</span>,
        },
        {
          id: "conso_rms",
          header: "Conso RMS",
          width: 120,
          align: "right",
          render: (r) => {
            const v = consoRms(r);
            return v === null ? <ComingCell /> : <span style={{ fontWeight: 800, color: v < 0 ? "#D97706" : undefined }}>{fmtL(v)}</span>;
          },
        },
        {
          id: "conso_theorique",
          header: "Conso Théorique",
          width: 140,
          align: "right",
          emphasis: true,
          render: (r) => <span style={{ color: "#2563EB", fontWeight: 800 }}>{fmtL(r.efms.fuel_deli_l)}</span>,
        },
      ],
    },
    {
      id: "cph",
      label: "CPH réel",
      color: "navy",
      columns: [
        { id: "cph_reel", header: "CPH Réel", width: 100, align: "right", emphasis: true, render: (r) => fmt2.format(n(r.efms.cph_l_per_hour)) },
        { id: "cph_target", header: "CPH Target Aktivco", width: 150, render: () => <ComingCell /> },
      ],
    },
    {
      id: "ecarts",
      label: "Écarts & alertes",
      color: "red",
      columns: [
        {
          id: "ecart_target",
          header: "Écart vs Target",
          width: 130,
          align: "right",
          render: (r) => (
            <span style={{ fontWeight: 800, color: Math.abs(n(r.gaps.deli_vs_enoc_l)) > 0 ? "#D97706" : "#0F9D67" }}>
              {r.gaps.deli_vs_enoc_l === null ? "—" : fmtL(r.gaps.deli_vs_enoc_l)}
            </span>
          ),
        },
        {
          id: "ecart_target_pct",
          header: "Écart vs Target %",
          width: 130,
          align: "right",
          render: (r) => (r.gaps.deli_vs_enoc_pct === null ? "—" : `${fmt2.format(n(r.gaps.deli_vs_enoc_pct))}%`),
        },
        {
          id: "statut_nok",
          header: "Statut NOK/OK",
          width: 130,
          render: (r) => <Pill label={r.gaps.status.label} tone={statusTone(r.gaps.status.code)} />,
        },
      ],
    },
    {
      id: "stock",
      label: "Stock",
      color: "slate",
      columns: [
        { id: "taux_remplissage", header: "Taux Remplissage", width: 140, render: () => <ComingCell /> },
        { id: "alerte_stock", header: "Alerte Stock", width: 120, render: () => <ComingCell /> },
        { id: "ecart_rms_reel", header: "Écart RMS/Réel", width: 130, render: () => <ComingCell /> },
        { id: "ecart_rms_reel_pct", header: "Écart RMS/Réel %", width: 140, render: () => <ComingCell /> },
        { id: "alerte_rms", header: "Alerte RMS", width: 110, render: () => <ComingCell /> },
      ],
    },
  ];

  const visibleGroups = useMemo(() => groups.filter((g) => !hiddenGroups.has(g.id)), [groups, hiddenGroups]);

  const filteredRows = useMemo(
    () => (anomaliesOnly ? rows.filter((r) => (r.efms.anomaly_flags?.length ?? 0) > 0) : rows),
    [rows, anomaliesOnly]
  );

  const visibleColCount = visibleGroups.reduce((s, g) => s + g.columns.length, 0);
  const totalColCount = groups.reduce((s, g) => s + g.columns.length, 0);

  return (
    <Card padded={false} style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <SheetTitle
          icon={<Fuel size={17} />}
          title="CONSO_MENSUELLE — Suivi consommation mensuelle par site"
          subtitle="Reproduction du template Excel. RH calculé via la cascade Snowflake (DSE / redresseur / GE status), secours ENOC."
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
            fontWeight: 850,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <AlertTriangle size={13} />
          Avec anomalies uniquement
        </button>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          padding: "10px 12px",
          background: FT.slateL,
          border: `1px solid ${FT.border}`,
          borderRadius: 12,
        }}
      >
        <GroupToggleBar groups={groups} hidden={hiddenGroups} onToggle={toggleGroup} onShowAll={showAllGroups} />
        <span style={{ fontSize: 11, color: FT.textSub, fontWeight: 700, whiteSpace: "nowrap" }}>
          {visibleColCount} / {totalColCount} colonnes affichées
        </span>
      </div>

      <div style={{ marginTop: 12 }}>
        <ExcelGrid
          groups={visibleGroups}
          rows={filteredRows}
          rowKey={(r) => r.key}
          loading={loading}
          pinnedCount={1}
          maxHeight={620}
          emptyIcon={<Fuel size={20} />}
          emptyTitle={anomaliesOnly ? "Aucune anomalie sur la période" : "Aucune donnée sur la période"}
        />
      </div>
    </Card>
  );
}
