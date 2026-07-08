// src/features/fuel-tracking/sheets/JournalSheet.tsx
// Feuille JOURNAL_RAVITAILLEMENT — traçabilité des mouvements ENOC.

import { ClipboardList } from "lucide-react";
import type { FuelEnocMovement } from "@/services/fuelTracking";
import { ExcelGrid, type ExcelGroup } from "../ExcelGrid";
import { Card, Pill, SheetTitle } from "../ui";
import {
  balanceCheck,
  blGapLiters,
  blGapPercent,
  dash,
  fmt,
  fmt2,
  fmtDateTime,
  fmtMaybeL,
  journalRmsHourMeter,
  journalSource,
  n,
  operationTypeTone,
} from "../helpers";

export function JournalSheet({ rows, loading }: { rows: FuelEnocMovement[]; loading: boolean }) {
  const groups: ExcelGroup<FuelEnocMovement>[] = [
    {
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
      ],
    },
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
        { id: "qte_init", header: "Qté initiale site (L)", width: 140, align: "right", render: (r) => fmtMaybeL(r.level_before) },
        {
          id: "qte_transf",
          header: "Qté transférée (L)",
          width: 140,
          align: "right",
          emphasis: true,
          render: (r) => <span style={{ color: "#0F9D67", fontWeight: 800 }}>{fmtMaybeL(r.quantity_added_liters)}</span>,
        },
        {
          id: "qte_finale",
          header: "Qté finale site (L)",
          width: 140,
          align: "right",
          render: (r) => (r.level_after !== null && r.level_after !== undefined ? `${fmt.format(n(r.level_after))} ${r.level_after_unit || ""}` : "—"),
        },
        { id: "jaugeage", header: "Méthode Jaugeage", width: 150, render: (r) => r.gauging_method || "—" },
      ],
    },
    {
      id: "controleur",
      label: "Contrôleur / RMS",
      color: "violet",
      columns: [
        { id: "dg_rh", header: "DG RH lu contrôleur", width: 150, align: "right", render: (r) => (r.hour_meter_after ? fmt.format(n(r.hour_meter_after)) : "—") },
        { id: "rms_init", header: "Qté init. RMS (L)", width: 140, align: "right", render: (r) => fmtMaybeL(r.rms_level_before) },
        { id: "rms_fin", header: "Qté fin. RMS (L)", width: 140, align: "right", render: (r) => fmtMaybeL(r.rms_level_after) },
        { id: "rms_dg_rh", header: "RMS DG RH", width: 120, align: "right", render: (r) => dash(journalRmsHourMeter(r)) },
      ],
    },
    {
      id: "livraison",
      label: "Livraison BL",
      color: "cyan",
      columns: [
        { id: "bl_num", header: "N° Bon de Livraison", width: 150, render: (r) => r.delivery_note_number || "—" },
        { id: "bl_qte", header: "Qté BL (L)", width: 120, align: "right", render: (r) => fmtMaybeL(r.delivery_note_quantity_liters) },
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
          width: 140,
          align: "right",
          render: (r) => {
            const gap = blGapLiters(r);
            return <span style={{ fontWeight: 800, color: gap !== null && Math.abs(gap) > 1 ? "#D97706" : undefined }}>{gap === null ? "—" : fmtMaybeL(gap)}</span>;
          },
        },
        {
          id: "ecart_bl_pct",
          header: "Écart BL %",
          width: 110,
          align: "right",
          render: (r) => {
            const pct = blGapPercent(r);
            return pct === null ? "—" : `${fmt2.format(pct)}%`;
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

  return (
    <Card padded={false} style={{ padding: 20 }}>
      <SheetTitle
        icon={<ClipboardList size={17} />}
        title="JOURNAL_RAVITAILLEMENT — Dépotage / Transfert / Ajout"
        subtitle="Traçabilité des mouvements carburant ENOC avec BL, RMS, jaugeage et contrôles automatiques."
      />
      <div style={{ marginTop: 16 }}>
        <ExcelGrid
          groups={groups}
          rows={rows}
          rowKey={(r) => String(r.id)}
          loading={loading}
          pinnedCount={1}
          emptyIcon={<ClipboardList size={20} />}
          emptyTitle="Aucun mouvement ENOC"
          emptySubtitle="Aucun mouvement carburant enregistré sur cette période."
        />
      </div>
    </Card>
  );
}
