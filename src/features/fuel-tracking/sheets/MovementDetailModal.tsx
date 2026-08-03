// src/features/fuel-tracking/sheets/MovementDetailModal.tsx
// Fiche mouvement ENOC — détail complet d'un mouvement carburant (mesures,
// contrôleur/RMS, livraison BL, validation, contrôle auto). Ouverte au clic
// sur une ligne du Journal Ravitaillement.

import { X, MapPin, Gauge, Truck, FileCheck2, ShieldAlert } from "lucide-react";
import type { FuelEnocMovement } from "@/services/fuelTracking";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FT } from "../theme";
import { Pill } from "../ui";
import { InfoTile, Section } from "./SiteDetailModal";
import {
  balanceCheck, blGapLiters, blGapPercent, dash, fmt2, fmtDateTime,
  fmtMaybeNum, journalRmsHourMeter, journalSource, operationTypeTone,
} from "../helpers";

export default function MovementDetailModal({ row, onClose, onViewSite }: { row: FuelEnocMovement; onClose: () => void; onViewSite: () => void }) {
  const balance = balanceCheck(row);
  const gapL = blGapLiters(row);
  const gapPct = blGapPercent(row);

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        className="p-0 gap-0 border-0"
        style={{
          width: "100%",
          maxWidth: 880,
          maxHeight: "calc(100vh - 48px)",
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(2,6,23,.28)",
        }}
      >
        <div style={{ background: "#fff", borderBottom: `1px solid ${FT.border}`, padding: "18px 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", background: FT.blueL, border: `1px solid ${FT.border}`, borderRadius: 6, fontSize: 10, fontWeight: 700, marginBottom: 8, color: FT.navy }}>
                <Truck size={11} /> Mouvement ENOC
              </div>
              <DialogTitle asChild>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.01em", fontFamily: "ui-monospace, Menlo, monospace", color: "#0f172a" }}>{row.request_code || row.site_id || "—"}</div>
              </DialogTitle>
              <div style={{ fontSize: 12.5, color: FT.textSub, marginTop: 2 }}>{row.site_id} — {row.site_name}</div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.slateL, color: FT.textMid, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <X size={15} />
            </button>
          </div>
          <button
            onClick={onViewSite}
            style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${FT.border}`, background: FT.slateL, color: FT.textMid, borderRadius: 7, padding: "6px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
          >
            <MapPin size={12} /> Voir la fiche site complète
          </button>
        </div>

        <div className="ft-scroll" style={{ flex: 1, overflowY: "auto", padding: 20, display: "grid", gap: 20 }}>
          <Section icon={<Truck size={13} />} title="Traçabilité">
            <InfoTile label="Type d'action" value={<Pill label={row.operation_type || "—"} tone={operationTypeTone(row.operation_type)} />} />
            <InfoTile label="Date" value={fmtDateTime(row.operation_date)} />
            <InfoTile label="Responsable" value={row.done_by || row.created_by || row.technician_name || "—"} />
            <InfoTile label="Source (Site/Dépôt)" value={journalSource(row)} />
          </Section>

          <Section icon={<Gauge size={13} />} title="Mesures physiques">
            <InfoTile label="Qté initiale site" value={fmtMaybeNum(row.level_before) !== "—" ? `${fmtMaybeNum(row.level_before)} L` : "—"} />
            <InfoTile label="Qté transférée" value={<span style={{ color: FT.green }}>{fmtMaybeNum(row.quantity_added_liters)} L</span>} />
            <InfoTile label="Qté finale site" value={row.level_after !== null && row.level_after !== undefined ? `${fmtMaybeNum(row.level_after)} L` : "—"} />
            <InfoTile label="Méthode jaugeage" value={row.gauging_method || "—"} />
          </Section>

          <Section icon={<Gauge size={13} />} title="Contrôleur / RMS">
            <InfoTile label="DG RH lu contrôleur" value={row.hour_meter_after ? `${fmt2.format(Number(row.hour_meter_after))} h` : "—"} />
            <InfoTile label="Qté init. RMS" value={fmtMaybeNum(row.rms_level_before) !== "—" ? `${fmtMaybeNum(row.rms_level_before)} L` : "—"} />
            <InfoTile label="Qté fin. RMS" value={fmtMaybeNum(row.rms_level_after) !== "—" ? `${fmtMaybeNum(row.rms_level_after)} L` : "—"} />
            <InfoTile label="RMS DG RH" value={`${dash(journalRmsHourMeter(row))}${journalRmsHourMeter(row) !== null ? " h" : ""}`} />
          </Section>

          <Section icon={<FileCheck2 size={13} />} title="Livraison BL">
            <InfoTile label="N° Bon de Livraison" value={row.delivery_note_number || "—"} />
            <InfoTile label="Qté BL" value={fmtMaybeNum(row.delivery_note_quantity_liters) !== "—" ? `${fmtMaybeNum(row.delivery_note_quantity_liters)} L` : "—"} />
          </Section>

          <Section icon={<ShieldAlert size={13} />} title="Validation & contrôle auto">
            <InfoTile label="Validé par" value={row.validated_by || "—"} />
            <InfoTile label="Statut" value={<Pill label={row.status || "—"} tone={row.status === "done" ? "green" : "slate"} />} />
            <InfoTile label="Écart BL/Mesuré" value={gapL === null ? "—" : `${fmtMaybeNum(gapL)} L`} />
            <InfoTile label="Écart BL (%)" value={gapPct === null ? "—" : `${fmt2.format(gapPct)}%`} />
            <InfoTile label="Balance Check" value={<Pill label={balance} tone={balance === "OK" ? "green" : balance === "Écart" ? "orange" : "slate"} />} />
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
