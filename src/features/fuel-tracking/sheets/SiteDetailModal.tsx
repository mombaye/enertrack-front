// src/features/fuel-tracking/sheets/SiteDetailModal.tsx
// Fiche site — vue rapide des attributs référentiel (zone, typologie, GE,
// cuves, RH...) partagée entre Journal et Conso Mensuelle.

import { X, MapPin, Zap, Fuel as FuelIcon, ShieldCheck, FileText, Gauge, Droplets } from "lucide-react";
import type { FuelMonthlyRow } from "@/services/fuelTracking";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FT } from "../theme";
import { Pill } from "../ui";
import {
  fmt2, fmtMaybeKva, fmtMaybeL, fmtMaybeNum, fmtNum, n,
  geBrand1, geBrand2, gePower1, gePower2, tankCapacity1, tankCapacity2,
  realTypology, siteConfig, siteLoad, siteTypology, consoRms, cphTargetLH,
  modernizedLabel, facteurCharge, consoTheoriqueLH, primaryGe,
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

export type SiteDetailRow = Partial<FuelMonthlyRow> & {
  site_id: string | null;
  site_name: string | null;
  zone?: string | null;
  ville?: string | null;
};

export function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 12, background: FT.slateL, border: `1px solid ${FT.border}` }}>
      <div style={{ fontSize: 9.5, fontWeight: 850, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: FT.text }}>{value ?? "—"}</div>
    </div>
  );
}

export function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: FT.blueL, color: FT.navy, display: "grid", placeItems: "center" }}>
          {icon}
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 900, color: FT.navy, textTransform: "uppercase", letterSpacing: ".04em" }}>{title}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function ConsoTheoriqueLhValue({ row }: { row: FuelMonthlyRow }) {
  const lh = consoTheoriqueLH(row);
  if (lh === null) return <>—</>;
  const confidence = primaryGe(row)?.fuel_curve?.confidence;
  const badge = confidence ? CURVE_CONFIDENCE_LABEL[confidence] : null;
  return (
    <span>
      {fmt2.format(lh)} L/h
      {badge && <Pill label={badge.label} tone={badge.tone} />}
    </span>
  );
}

export default function SiteDetailModal({ row, onClose }: { row: SiteDetailRow; onClose: () => void }) {
  const siteId = row.site_id || "—";
  const siteName = row.site_name || "—";
  const zone = row.zone_label || row.zone || row.enoc_site_ref?.region || "—";

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        className="p-0 gap-0 border-0"
        style={{
          width: "100%",
          maxWidth: 920,
          maxHeight: "calc(100vh - 48px)",
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(2,6,23,.28)",
        }}
      >
        {/* En-tête — même interface que la page (fond blanc, texte foncé) */}
        <div style={{ background: "#fff", borderBottom: `1px solid ${FT.border}`, padding: "20px 22px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", background: FT.blueL, border: `1px solid ${FT.border}`, borderRadius: 999, fontSize: 10, fontWeight: 900, marginBottom: 8, color: FT.navy }}>
                <MapPin size={11} /> Fiche site
              </div>
              <DialogTitle asChild>
                <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: "-.02em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#0f172a" }}>{siteId}</div>
              </DialogTitle>
              <div style={{ fontSize: 13, color: FT.textSub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{siteName}</div>
            </div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 11, border: `1px solid ${FT.border}`, background: FT.slateL, color: FT.textMid, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="ft-scroll" style={{ flex: 1, overflowY: "auto", padding: 20, display: "grid", gap: 20 }}>
          <Section icon={<MapPin size={13} />} title="Identification">
            <InfoTile label="Zone / Région" value={zone} />
            <InfoTile label="Batch" value={row.site_ref?.batch_operational || row.enoc_site_ref?.batch_operational || row.enoc_site_ref?.batch || "—"} />
            <InfoTile label="Neuf / Existant" value={row.site_ref || row.enoc_site_ref ? modernizedLabel(row as FuelMonthlyRow) : "—"} />
            <InfoTile label="Typo facturée" value={row.site_ref || row.enoc_site_ref ? siteTypology(row as FuelMonthlyRow) : "—"} />
            <InfoTile label="Typo réelle" value={row.site_ref || row.enoc_site_ref ? realTypology(row as FuelMonthlyRow) : "—"} />
            <InfoTile label="Configuration" value={row.site_ref || row.enoc_site_ref ? siteConfig(row as FuelMonthlyRow) : "—"} />
            <InfoTile label="Priorité" value={row.enoc_site_ref?.priority || "—"} />
            <InfoTile label="Catégorie" value={row.enoc_site_ref?.category || "—"} />
          </Section>

          <Section icon={<Zap size={13} />} title="Groupes électrogènes">
            <InfoTile label="Nb GE" value={row.enoc_site_ref?.nb_ge ?? "—"} />
            <InfoTile label="Puissance" value={siteLoad(row as FuelMonthlyRow) !== null ? `${fmt2.format(n(siteLoad(row as FuelMonthlyRow)))} W` : "—"} />
            <InfoTile label="Marque GE1" value={geBrand1(row as FuelMonthlyRow)} />
            <InfoTile label="Capacité GE1" value={fmtMaybeKva(gePower1(row as FuelMonthlyRow)) !== "—" ? `${fmtMaybeKva(gePower1(row as FuelMonthlyRow))} KVA` : "—"} />
            <InfoTile label="Marque GE2" value={geBrand2(row as FuelMonthlyRow)} />
            <InfoTile label="Capacité GE2" value={fmtMaybeKva(gePower2(row as FuelMonthlyRow)) !== "—" ? `${fmtMaybeKva(gePower2(row as FuelMonthlyRow))} KVA` : "—"} />
          </Section>

          <Section icon={<FuelIcon size={13} />} title="Cuves & RMS">
            <InfoTile label="Cuve GE1" value={fmtMaybeL(tankCapacity1(row as FuelMonthlyRow)) !== "—" ? `${fmtMaybeL(tankCapacity1(row as FuelMonthlyRow))} L` : "—"} />
            <InfoTile label="Cuve GE2" value={fmtMaybeL(tankCapacity2(row as FuelMonthlyRow)) !== "—" ? `${fmtMaybeL(tankCapacity2(row as FuelMonthlyRow))} L` : "—"} />
            <InfoTile label="RMS / Fuel sensor" value={row.enoc_site_ref?.rms_installed || "—"} />
          </Section>

          {row.enoc ? (
            <Section icon={<Gauge size={13} />} title="Cibles">
              <InfoTile
                label="Target Aktivco"
                value={
                  row.enoc.monthly_target_liters ? (
                    <span>
                      {fmtNum(row.enoc.monthly_target_liters)} L/mois
                      {row.enoc.target_status && <Pill label={row.enoc.target_status} tone={row.enoc.target_status === "exceeded" ? "red" : "green"} />}
                    </span>
                  ) : "—"
                }
              />
              <InfoTile label="Facteur Charge" value={facteurCharge(row as FuelMonthlyRow) !== null ? `${fmt2.format(facteurCharge(row as FuelMonthlyRow)!)}%` : "—"} />
              <InfoTile label="Conso Théorique" value={<ConsoTheoriqueLhValue row={row as FuelMonthlyRow} />} />
            </Section>
          ) : null}

          {row.efms ? (
            <Section icon={<ShieldCheck size={13} />} title="Consommation & RH — ce mois">
              <InfoTile
                label="RH Final"
                value={
                  row.efms.rh_hours !== null ? (
                    <span>
                      {fmt2.format(n(row.efms.rh_hours))} h
                      {row.efms.rh_source && row.efms.rh_source !== "NO_DATA" && (
                        <Pill label={RH_SOURCE_LABEL[row.efms.rh_source] || row.efms.rh_source} tone={row.efms.rh_source === "SNOWFLAKE_DSE_COUNTER" ? "green" : "cyan"} />
                      )}
                    </span>
                  ) : "—"
                }
              />
              <InfoTile label="RH Mois Précédent" value={row.efms.rh_initial_hours !== null ? `${fmt2.format(n(row.efms.rh_initial_hours))} h` : "—"} />
              <InfoTile label="RH Delta" value={row.efms.rh_delta_hours !== null && row.efms.rh_delta_hours !== undefined ? `${fmt2.format(n(row.efms.rh_delta_hours))} h` : "—"} />
              <InfoTile label="Conso Réelle" value={`${fmtNum(row.efms.fuel_conso_l)} L`} />
              <InfoTile label="Conso RMS" value={fmtMaybeNum(consoRms(row as FuelMonthlyRow)) !== "—" ? `${fmtMaybeNum(consoRms(row as FuelMonthlyRow))} L` : "—"} />
              <InfoTile label="Conso Théorique" value={`${fmtNum(row.efms.fuel_deli_l)} L`} />
              <InfoTile label="CPH Réel" value={`${fmt2.format(n(row.efms.cph_l_per_hour))} L/h`} />
              <InfoTile label="CPH Target" value={cphTargetLH(row as FuelMonthlyRow) !== null ? `${fmt2.format(cphTargetLH(row as FuelMonthlyRow)!)} L/h` : "—"} />
              <InfoTile
                label="Statut"
                value={row.gaps?.status ? <Pill label={row.gaps.status.label} tone={row.gaps.status.tone === "violet" ? "violet" : (row.gaps.status.tone as any)} /> : "—"}
              />
            </Section>
          ) : null}

          {row.stock || row.enoc ? (
            <Section icon={<Droplets size={13} />} title="Ravitaillement & stock">
              <InfoTile label="Ravitaillement" value={row.enoc ? `${fmtNum(n(row.enoc.refueling_liters) + n(row.enoc.ajout_in_liters))} L` : "—"} />
              <InfoTile label="Ponction" value={row.enoc?.prelevement_out_liters ? `${fmtNum(row.enoc.prelevement_out_liters)} L` : "—"} />
              <InfoTile label="Stock Ouv. RMS" value={fmtMaybeNum(row.stock?.ouv_rms) !== "—" ? `${fmtMaybeNum(row.stock?.ouv_rms)} L` : "—"} />
              <InfoTile label="Stock Clôt. RMS" value={fmtMaybeNum(row.stock?.clot_rms) !== "—" ? `${fmtMaybeNum(row.stock?.clot_rms)} L` : "—"} />
              <InfoTile label="Stock Ouv. Réel" value={fmtMaybeNum(row.stock?.ouv_reel) !== "—" ? `${fmtMaybeNum(row.stock?.ouv_reel)} L` : "—"} />
              <InfoTile label="Stock Clôt. Réel" value={fmtMaybeNum(row.stock?.clot_reel) !== "—" ? `${fmtMaybeNum(row.stock?.clot_reel)} L` : "—"} />
              <InfoTile label="Stock Réel" value={fmtMaybeNum(row.stock?.reel) !== "—" ? `${fmtMaybeNum(row.stock?.reel)} L` : "—"} />
              <InfoTile
                label="Stock Delta RMS"
                value={
                  row.stock?.delta_rms !== null && row.stock?.delta_rms !== undefined ? (
                    <span style={{ color: row.stock.delta_rms < 0 ? FT.orange : FT.green }}>{fmtNum(row.stock.delta_rms)} L</span>
                  ) : "—"
                }
              />
            </Section>
          ) : null}

          {row.gaps ? (
            <Section icon={<Gauge size={13} />} title="Écarts vs target">
              <InfoTile label="Écart (L)" value={row.gaps.deli_vs_enoc_l !== null ? fmtNum(row.gaps.deli_vs_enoc_l) : "—"} />
              <InfoTile label="Écart (%)" value={row.gaps.deli_vs_enoc_pct !== null ? `${fmt2.format(n(row.gaps.deli_vs_enoc_pct))}%` : "—"} />
            </Section>
          ) : null}

          <Section icon={<FileText size={13} />} title="Contrat">
            <InfoTile label="N° Contrat" value={row.site_ref?.contract_number || "—"} />
            <InfoTile label="N° Compteur" value={row.site_ref?.meter_number || "—"} />
            <InfoTile label="Scope" value={row.site_ref?.scope_status || row.enoc_site_ref?.scope_initial || "—"} />
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
