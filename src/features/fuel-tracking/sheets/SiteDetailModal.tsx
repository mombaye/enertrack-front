// src/features/fuel-tracking/sheets/SiteDetailModal.tsx
// Fiche site — vue rapide des attributs référentiel (zone, typologie, GE,
// cuves, RH...) partagée entre Journal et Conso Mensuelle.

import { X, MapPin, Zap, Fuel as FuelIcon, ShieldCheck, FileText } from "lucide-react";
import type { FuelMonthlyRow } from "@/services/fuelTracking";
import { FT } from "../theme";
import { Pill } from "../ui";
import {
  fmt2, fmtMaybeKva, fmtMaybeL, n,
  geBrand1, geBrand2, gePower1, gePower2, tankCapacity1, tankCapacity2,
  realTypology, siteConfig, siteLoad, siteTypology,
} from "../helpers";

export type SiteDetailRow = Partial<FuelMonthlyRow> & {
  site_id: string | null;
  site_name: string | null;
  zone?: string | null;
  ville?: string | null;
};

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 12, background: FT.slateL, border: `1px solid ${FT.border}` }}>
      <div style={{ fontSize: 9.5, fontWeight: 850, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: FT.text }}>{value ?? "—"}</div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
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

export default function SiteDetailModal({ row, onClose }: { row: SiteDetailRow; onClose: () => void }) {
  const siteId = row.site_id || "—";
  const siteName = row.site_name || "—";
  const zone = row.zone_label || row.zone || row.enoc_site_ref?.region || "—";

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(2,6,23,.6)", backdropFilter: "blur(7px)", display: "flex", justifyContent: "flex-end" }}
    >
      <div style={{ width: "min(560px, 100vw)", height: "100vh", background: "#fff", boxShadow: "-24px 0 70px rgba(2,6,23,.28)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* En-tête */}
        <div style={{ background: FT.headerGrad, color: "#fff", padding: "20px 22px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.24)", borderRadius: 999, fontSize: 10, fontWeight: 900, marginBottom: 8 }}>
                <MapPin size={11} /> Fiche site
              </div>
              <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: "-.02em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{siteId}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.72)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{siteName}</div>
            </div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 11, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="ft-scroll" style={{ flex: 1, overflowY: "auto", padding: 20, display: "grid", gap: 20 }}>
          <Section icon={<MapPin size={13} />} title="Identification">
            <InfoTile label="Zone / Région" value={zone} />
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

          {row.efms ? (
            <Section icon={<ShieldCheck size={13} />} title="Ce mois">
              <InfoTile label="RH Final" value={row.efms.rh_hours !== null ? `${fmt2.format(n(row.efms.rh_hours))} h` : "—"} />
              <InfoTile label="RH Mois Précédent" value={row.efms.rh_initial_hours !== null ? `${fmt2.format(n(row.efms.rh_initial_hours))} h` : "—"} />
              <InfoTile
                label="Statut"
                value={row.gaps?.status ? <Pill label={row.gaps.status.label} tone={row.gaps.status.tone === "violet" ? "violet" : (row.gaps.status.tone as any)} /> : "—"}
              />
            </Section>
          ) : null}

          <Section icon={<FileText size={13} />} title="Contrat">
            <InfoTile label="N° Contrat" value={row.site_ref?.contract_number || "—"} />
            <InfoTile label="N° Compteur" value={row.site_ref?.meter_number || "—"} />
            <InfoTile label="Scope" value={row.site_ref?.scope_status || row.enoc_site_ref?.scope_initial || "—"} />
          </Section>
        </div>
      </div>
    </div>
  );
}
