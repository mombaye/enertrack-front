// src/features/fuel-tracking/sheets/JournalSheet.tsx
// Feuille JOURNAL_RAVITAILLEMENT — traçabilité des mouvements ENOC.

import { useMemo, useState } from "react";
import { ClipboardList, Eye } from "lucide-react";
import type { FuelEnocMovement, FuelMonthlyRow } from "@/services/fuelTracking";
import { ExcelGrid, type ExcelGroup } from "../ExcelGrid";
import { Card, GroupToggleBar, Pill, SheetTitle } from "../ui";
import { FT } from "../theme";
import SiteDetailModal, { type SiteDetailRow } from "./SiteDetailModal";
import {
  balanceCheck,
  blGapLiters,
  blGapPercent,
  dash,
  fmt2,
  fmtDateTime,
  fmtMaybeNum,
  journalRmsHourMeter,
  journalSource,
  operationTypeTone,
} from "../helpers";

const GROUP_IDS = ["identification", "tracabilite", "mesures", "controleur", "livraison", "validation", "controle_auto"];

// "Contrôleur / RMS" et "Livraison BL" masqués par défaut — colonnes secondaires
// consultées ponctuellement, pas à chaque lecture du journal.
const DEFAULT_HIDDEN_GROUPS = ["controleur", "livraison"];
const HIDDEN_GROUPS_STORAGE_KEY = "ft-journal-hidden-groups";

function loadHiddenGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_GROUPS_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // localStorage indisponible — on retombe sur le défaut.
  }
  return new Set(DEFAULT_HIDDEN_GROUPS);
}

export function JournalSheet({ rows, loading, monthlyRows = [] }: { rows: FuelEnocMovement[]; loading: boolean; monthlyRows?: FuelMonthlyRow[] }) {
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(loadHiddenGroups);
  const [detailSite, setDetailSite] = useState<SiteDetailRow | null>(null);

  function toggleGroup(id: string) {
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
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

  function openDetail(r: FuelEnocMovement) {
    const match = monthlyRows.find((m) => m.site_id === r.site_id);
    setDetailSite(match || { site_id: r.site_id, site_name: r.site_name, zone: r.zone, ville: r.ville });
  }

  const identityGroup: ExcelGroup<FuelEnocMovement> = {
    id: "identification",
    label: "Identification",
    color: "navy",
    columns: [
      { id: "site_id", header: "Site ID", width: 110, emphasis: true, render: (r) => r.site_id || "—" },
      { id: "ticket", header: "N° Ticket FMS", width: 130, emphasis: true, render: (r) => r.request_code || "—" },
      {
        id: "type_action",
        header: "Type d'action",
        width: 150,
        render: (r) => <Pill label={r.operation_type || "—"} tone={operationTypeTone(r.operation_type)} />,
      },
      {
        id: "detail",
        header: "",
        width: 70,
        align: "center",
        render: (r) => (
          <button
            onClick={() => openDetail(r)}
            title="Voir la fiche site"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${FT.border}`, background: FT.blueL, color: FT.navy, borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
          >
            <Eye size={12} />
          </button>
        ),
      },
    ],
  };

  const groups: ExcelGroup<FuelEnocMovement>[] = [
    {
      id: "tracabilite",
      label: "Traçabilité",
      color: "gold",
      columns: [
        { id: "date", header: "Date", width: 130, render: (r) => fmtDateTime(r.operation_date) },
        { id: "responsable", header: "Responsable", width: 160, render: (r) => r.done_by || r.created_by || r.technician_name || "—" },
        { id: "source", header: "Source (Site/Dépôt)", width: 160, render: journalSource },
      ],
    },
    {
      id: "mesures",
      label: "Mesures physiques",
      color: "green",
      columns: [
        { id: "qte_init", header: "Qté initiale site (L)", width: 150, align: "right", render: (r) => fmtMaybeNum(r.level_before) },
        {
          id: "qte_transf",
          header: "Qté transférée (L)",
          width: 150,
          align: "right",
          emphasis: true,
          render: (r) => <span style={{ color: FT.green, fontWeight: 800 }}>{fmtMaybeNum(r.quantity_added_liters)}</span>,
        },
        {
          id: "qte_finale",
          header: "Qté finale site (L)",
          width: 150,
          align: "right",
          render: (r) => (r.level_after !== null && r.level_after !== undefined ? fmtMaybeNum(r.level_after) : "—"),
        },
        { id: "jaugeage", header: "Méthode Jaugeage", width: 150, render: (r) => r.gauging_method || "—" },
      ],
    },
    {
      id: "controleur",
      label: "Contrôleur / RMS",
      color: "violet",
      columns: [
        { id: "dg_rh", header: "DG RH lu contrôleur (h)", width: 170, align: "right", render: (r) => (r.hour_meter_after ? fmt2.format(Number(r.hour_meter_after)) : "—") },
        { id: "rms_init", header: "Qté init. RMS (L)", width: 150, align: "right", render: (r) => fmtMaybeNum(r.rms_level_before) },
        { id: "rms_fin", header: "Qté fin. RMS (L)", width: 150, align: "right", render: (r) => fmtMaybeNum(r.rms_level_after) },
        { id: "rms_dg_rh", header: "RMS DG RH (h)", width: 130, align: "right", render: (r) => dash(journalRmsHourMeter(r)) },
      ],
    },
    {
      id: "livraison",
      label: "Livraison BL",
      color: "cyan",
      columns: [
        { id: "bl_num", header: "N° Bon de Livraison", width: 150, render: (r) => r.delivery_note_number || "—" },
        { id: "bl_qte", header: "Qté BL (L)", width: 130, align: "right", render: (r) => fmtMaybeNum(r.delivery_note_quantity_liters) },
      ],
    },
    {
      id: "validation",
      label: "Validation",
      color: "navy",
      columns: [
        { id: "valide_par", header: "Validé Par", width: 140, render: (r) => r.validated_by || "—" },
        {
          id: "statut",
          header: "Statut",
          width: 110,
          render: (r) => <Pill label={r.status || "—"} tone={r.status === "done" ? "green" : "slate"} />,
        },
      ],
    },
    {
      id: "controle_auto",
      label: "Contrôle auto",
      color: "red",
      columns: [
        {
          id: "ecart_bl",
          header: "Écart BL/Mesuré (L)",
          width: 150,
          align: "right",
          render: (r) => {
            const gap = blGapLiters(r);
            return <span style={{ fontWeight: 800, color: gap !== null && Math.abs(gap) > 1 ? FT.orange : undefined }}>{gap === null ? "—" : fmtMaybeNum(gap)}</span>;
          },
        },
        {
          id: "ecart_bl_pct",
          header: "Écart BL (%)",
          width: 120,
          align: "right",
          render: (r) => {
            const pct = blGapPercent(r);
            return pct === null ? "—" : fmt2.format(pct);
          },
        },
        {
          id: "balance_check",
          header: "Balance Check",
          width: 130,
          render: (r) => {
            const check = balanceCheck(r);
            return <Pill label={check} tone={check === "OK" ? "green" : check === "Écart" ? "orange" : "slate"} />;
          },
        },
      ],
    },
  ];

  const visibleGroups = useMemo(() => [identityGroup, ...groups.filter((g) => !hiddenGroups.has(g.id))], [hiddenGroups, monthlyRows]);
  const visibleColCount = visibleGroups.reduce((s, g) => s + g.columns.length, 0);
  const totalColCount = identityGroup.columns.length + groups.reduce((s, g) => s + g.columns.length, 0);

  return (
    <Card padded={false} style={{ padding: 20 }}>
      <SheetTitle
        icon={<ClipboardList size={17} />}
        title="JOURNAL_RAVITAILLEMENT — Dépotage / Transfert / Ajout"
        subtitle="Traçabilité des mouvements carburant ENOC avec BL, RMS, jaugeage et contrôles automatiques."
      />

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
          rows={rows}
          rowKey={(r) => String(r.id)}
          loading={loading}
          pinnedCount={identityGroup.columns.length}
          emptyIcon={<ClipboardList size={20} />}
          emptyTitle="Aucun mouvement ENOC"
          emptySubtitle="Aucun mouvement carburant enregistré sur cette période."
        />
      </div>

      {detailSite ? <SiteDetailModal row={detailSite} onClose={() => setDetailSite(null)} /> : null}
    </Card>
  );
}
