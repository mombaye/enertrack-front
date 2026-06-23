// src/features/fuel-tracking/FuelTrackingPage.tsx

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DatabaseZap,
  Download,
  FileSpreadsheet,
  Fuel,
  Gauge,
  Layers3,
  ListChecks,
  RefreshCw,
  Search,
  Settings2,
  Truck,
  Warehouse,
} from "lucide-react";
import * as XLSX from "xlsx";

import {
  getFuelEnocJournal,
  getFuelMonthlyTracking,
  getFuelSyncRuns,
  getFuelSourceStatus,
  type FuelEnocMovement,
  type FuelMonthlyRow,
  type FuelStatusCode,
} from "@/services/fuelTracking";

const T = {
  blue: "#1B3FA0",
  blueL: "#EEF2FF",
  orange: "#D94F1E",
  orangeL: "#FFF1EC",
  red: "#C8202E",
  redL: "#FFF0F0",
  violet: "#6D28D9",
  violetL: "#F5F0FF",
  cyan: "#0E7490",
  cyanL: "#E0F7FA",
  green: "#10B981",
  greenL: "#ECFDF5",
  slate: "#64748B",
  slateL: "#F8FAFC",
  border: "rgba(15,23,42,.10)",
  text: "#0F172A",
  textMid: "#475569",
  textSub: "#94A3B8",
};

type SheetKey =
  | "DASHBOARD"
  | "JOURNAL_RAVITAILLEMENT"
  | "CONSO_MENSUELLE"
  | "STOCK_DEPOT"
  | "CPH"
  | "REF_SITES"
  | "LISTES";

const SHEETS: Array<{
  key: SheetKey;
  label: string;
  icon: ReactNode;
}> = [
  { key: "DASHBOARD", label: "Dashboard", icon: <BarChart3 size={14} /> },
  { key: "JOURNAL_RAVITAILLEMENT", label: "Journal ravitaillement", icon: <ClipboardList size={14} /> },
  { key: "CONSO_MENSUELLE", label: "Conso mensuelle", icon: <Fuel size={14} /> },
  { key: "STOCK_DEPOT", label: "Stock dépôt", icon: <Warehouse size={14} /> },
  { key: "CPH", label: "CPH", icon: <Gauge size={14} /> },
  { key: "REF_SITES", label: "Référentiel sites", icon: <Layers3 size={14} /> },
  { key: "LISTES", label: "Listes", icon: <ListChecks size={14} /> },
];

const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function n(value: unknown) {
  const v = Number(value || 0);
  return Number.isFinite(v) ? v : 0;
}

function fmtL(value: unknown) {
  const v = n(value);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";

  if (abs >= 1_000_000) return `${sign}${fmt1.format(abs / 1_000_000)} ML`;
  if (abs >= 1_000) return `${sign}${fmt1.format(abs / 1_000)} kL`;
  return `${fmt.format(v)} L`;
}

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toneColor(tone?: string) {
  if (tone === "green") return { bg: T.greenL, fg: T.green, bd: "rgba(16,185,129,.25)" };
  if (tone === "orange") return { bg: T.orangeL, fg: T.orange, bd: "rgba(217,79,30,.25)" };
  if (tone === "red") return { bg: T.redL, fg: T.red, bd: "rgba(200,32,46,.25)" };
  if (tone === "violet") return { bg: T.violetL, fg: T.violet, bd: "rgba(109,40,217,.25)" };
  if (tone === "blue") return { bg: T.blueL, fg: T.blue, bd: "rgba(27,63,160,.25)" };
  return { bg: T.slateL, fg: T.slate, bd: T.border };
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 14,
        border: `1px solid ${T.border}`,
        boxShadow: "0 1px 3px rgba(15,23,42,.05)",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Skeleton({ h }: { h: number }) {
  return <div className="fuel-skel" style={{ height: h, borderRadius: 12 }} />;
}

function SheetTitle({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: T.blueL,
          display: "grid",
          placeItems: "center",
          color: T.blue,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: T.textSub, marginTop: 3 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function Pill({
  label,
  tone = "slate",
}: {
  label: React.ReactNode;
  tone?: "green" | "orange" | "red" | "blue" | "violet" | "slate";
}) {
  const styles = {
    green: { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
    orange: { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
    red: { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
    blue: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    violet: { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe" },
    slate: { bg: "#f8fafc", color: "#475569", border: "#e2e8f0" },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "5px 10px",
        fontSize: 12,
        fontWeight: 800,
        background: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function ComingCell() {
  return <Pill label="À venir" tone="slate" />;
}

function KpiBox({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "blue" | "orange" | "green" | "red" | "violet" | "slate";
}) {
  const c = toneColor(tone);
  return (
    <div
      style={{
        border: `1px solid ${c.bd}`,
        background: c.bg,
        borderRadius: 12,
        padding: "13px 14px",
      }}
    >
      <div
        style={{
          color: T.textSub,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ color: c.fg, fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: T.textMid, fontSize: 11, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
      <span style={{ fontSize: 12, color: T.textSub, fontWeight: 700 }}>
        Page {page} / {totalPages}
      </span>
      <button disabled={!hasPrev} onClick={onPrev} style={pagerStyle(!hasPrev)}>
        <ChevronLeft size={13} />
        Précédent
      </button>
      <button disabled={!hasNext} onClick={onNext} style={pagerStyle(!hasNext)}>
        Suivant
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

function pagerStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 9,
    border: `1px solid ${T.border}`,
    background: disabled ? "#F1F5F9" : "white",
    color: disabled ? T.textSub : T.text,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    fontWeight: 800,
  };
}

const thBase: CSSProperties = {
  padding: "9px 10px",
  border: `1px solid ${T.border}`,
  color: T.text,
  fontSize: 11,
  fontWeight: 800,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tdBase: CSSProperties = {
  padding: "9px 10px",
  border: `1px solid ${T.border}`,
  color: T.textMid,
  fontSize: 12,
  whiteSpace: "nowrap",
};

function GroupHeader({
  label,
  span,
  color = T.blue,
  bg = T.blueL,
}: {
  label: string;
  span: number;
  color?: string;
  bg?: string;
}) {
  return (
    <th
      colSpan={span}
      style={{
        ...thBase,
        background: bg,
        color,
        textAlign: "center",
        textTransform: "uppercase",
        letterSpacing: ".06em",
        fontSize: 10,
      }}
    >
      {label}
    </th>
  );
}

function statusTone(code?: string) {
  if (code === "OK") return "green";
  if (code === "WARNING") return "orange";
  if (code === "NOK") return "red";
  if (code === "EFMS_ONLY") return "blue";
  if (code === "ENOC_ONLY") return "violet";
  return "slate";
}

function sourceLabel(source: FuelMonthlyRow["source"]) {
  if (source === "EFMS_ENOC") return "eFMS + ENOC";
  if (source === "EFMS_ONLY") return "eFMS seul";
  if (source === "ENOC_ONLY") return "ENOC seul";
  return "—";
}

function operationTypeTone(type?: string | null) {
  if (type === "PONCTION") return "violet";
  if (type === "TRUCK") return "blue";
  if (type === "TOTAL_CARD") return "orange";
  return "slate";
}

function DashboardSheet({
  rows,
  kpis,
  loading,
}: {
  rows: FuelMonthlyRow[];
  kpis: any;
  loading: boolean;
}) {
  if (loading) return <Skeleton h={420} />;

  const topRows = [...rows]
    .sort((a, b) => n(b.enoc.quantity_added_liters) - n(a.enoc.quantity_added_liters))
    .slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <SheetTitle
          icon={<BarChart3 size={16} />}
          title="DASHBOARD — Synthèse mensuelle globale"
          subtitle="Vue de contrôle inspirée de la feuille DASHBOARD du fichier Excel."
        />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
        <KpiBox label="Target BOQ Total" value="À venir" sub="Après validation client" tone="slate" />
        <KpiBox label="Target Aktivco Total" value="À venir" sub="Après import REF_SITES" tone="slate" />
        <KpiBox label="Consommation ENOC" value={fmtL(kpis?.enoc_quantity_added_liters)} sub="Opérations terrain" tone="green" />
        <KpiBox label="eFMS livré" value={fmtL(kpis?.fuel_deli_l)} sub="Données eFMS mensuelles" tone="blue" />
        <KpiBox label="Écart total" value={fmtL(kpis?.gap_deli_vs_enoc_l)} sub="ENOC réel - eFMS livré" tone="orange" />
        <KpiBox label="Sites OK" value={fmt.format(kpis?.ok ?? 0)} sub="Rapprochés" tone="green" />
        <KpiBox label="Sites NOK" value={fmt.format(kpis?.nok ?? 0)} sub={`${fmt.format(kpis?.warning ?? 0)} à suivre`} tone="red" />
        <KpiBox label="Stock critique" value="À venir" sub="Stock réel/RMS" tone="slate" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 12 }}>
        <Card>
          <SheetTitle
            icon={<Fuel size={15} />}
            title="Top sites — volume réel ENOC"
            subtitle="Classement des sites ayant des opérations terrain sur le mois."
          />

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {topRows.length === 0 && (
              <div style={{ color: T.textSub, fontSize: 13, padding: "30px 0", textAlign: "center" }}>
                Aucune donnée ENOC sur le mois.
              </div>
            )}

            {topRows.map((row, index) => {
              const max = Math.max(...topRows.map((x) => n(x.enoc.quantity_added_liters)), 1);
              const pct = (n(row.enoc.quantity_added_liters) / max) * 100;

              return (
                <div key={row.key} style={{ display: "grid", gridTemplateColumns: "30px 1fr 90px", gap: 10, alignItems: "center" }}>
                  <div style={{ color: T.textSub, fontSize: 12, fontWeight: 800, textAlign: "right" }}>{index + 1}</div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                      <strong style={{ fontSize: 12, color: T.text }}>{row.site_id || row.site_name}</strong>
                      <span style={{ fontSize: 12, color: T.textSub }}>{row.enoc.movements_count} mouv.</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: "#F1F5F9", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: T.green, borderRadius: 99 }} />
                    </div>
                  </div>
                  <strong style={{ color: T.green, fontSize: 12, textAlign: "right" }}>{fmtL(row.enoc.quantity_added_liters)}</strong>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <SheetTitle
            icon={<AlertTriangle size={15} />}
            title="Causes surconsommation"
            subtitle="Rubrique présente dans le template, à arbitrer avec le client."
          />

          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            {[
              "Automatisme GE",
              "Carburant volé",
              "Faible autonomie",
              "Faible production solaire",
              "Mauvaise perf. solaire",
              "Besoin spare",
              "Coupure Grid",
              "Données erronées",
              "Sous investigation",
              "Autre",
            ].map((cause) => (
              <div
                key={cause}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 9,
                  border: `1px solid ${T.border}`,
                  background: T.slateL,
                }}
              >
                <span style={{ fontSize: 12, color: T.textMid, fontWeight: 700 }}>{cause}</span>
                <ComingCell />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function JournalSheet({
  rows,
  loading,
}: {
  rows: FuelEnocMovement[];
  loading: boolean;
}) {
  if (loading) return <Skeleton h={420} />;

  return (
    <Card>
      <SheetTitle
        icon={<ClipboardList size={16} />}
        title="JOURNAL_RAVITAILLEMENT — Dépotage / Transfert / Ajout"
        subtitle="Traçabilité des mouvements carburant ENOC avec BL, RMS, jaugeage et contrôles automatiques."
      />

      <div style={{ marginTop: 16, overflow: "auto", borderRadius: 12, border: `1px solid ${T.border}` }}>
        <table style={{ borderCollapse: "collapse", minWidth: 2100, width: "100%" }}>
          <thead>
            <tr>
              <GroupHeader label="Identification" span={3} color={T.blue} bg={T.blueL} />
              <GroupHeader label="Traçabilité" span={3} color={T.orange} bg={T.orangeL} />
              <GroupHeader label="Mesures physiques" span={4} color={T.green} bg={T.greenL} />
              <GroupHeader label="Contrôleur / RMS" span={4} color={T.violet} bg={T.violetL} />
              <GroupHeader label="Livraison BL" span={2} color={T.cyan} bg={T.cyanL} />
              <GroupHeader label="Validation" span={2} color={T.blue} bg={T.blueL} />
              <GroupHeader label="Contrôle auto" span={3} color={T.red} bg={T.redL} />
            </tr>

            <tr style={{ background: T.slateL }}>
              {[
                "Site ID",
                "N° Ticket FMS",
                "Type d'action",
                "Date",
                "Responsable",
                "Source (Site/Dépôt)",
                "Qté initiale site (L)",
                "Qté transférée (L)",
                "Qté finale site (L)",
                "Méthode Jaugeage",
                "DG RH lu contrôleur",
                "Qté init. RMS (L)",
                "Qté fin. RMS (L)",
                "RMS DG RH",
                "N° Bon de Livraison",
                "Qté BL (L)",
                "Validé Par",
                "Statut",
                "Écart BL/Mesuré (L)",
                "Écart BL %",
                "Balance Check",
              ].map((h) => (
                <th key={h} style={thBase}>{h}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={21} style={{ ...tdBase, textAlign: "center", padding: 32, color: T.textSub }}>
                  Aucun mouvement ENOC sur la période.
                </td>
              </tr>
            )}

            {rows.map((r, index) => {
              const gap = blGapLiters(r);
              const gapPct = blGapPercent(r);
              const check = balanceCheck(r);

              return (
                <tr key={r.id} style={{ background: index % 2 === 0 ? "white" : "#FCFCFD" }}>
                  <td style={{ ...tdBase, fontWeight: 800, color: T.text }}>{r.site_id || "—"}</td>
                  <td style={{ ...tdBase, fontWeight: 800, color: T.blue }}>{r.request_code || "—"}</td>

                  <td style={tdBase}>
                    <Pill label={r.operation_type || "—"} tone={operationTypeTone(r.operation_type) as any} />
                  </td>

                  <td style={tdBase}>{fmtDateTime(r.operation_date)}</td>
                  <td style={tdBase}>{r.done_by || r.created_by || r.technician_name || "—"}</td>
                  <td style={tdBase}>{journalSource(r)}</td>

                  <td style={tdBase}>{fmtMaybeL(r.level_before)}</td>
                  <td style={{ ...tdBase, fontWeight: 800, color: T.green }}>{fmtL(r.quantity_added_liters)}</td>
                  <td style={tdBase}>
                    {r.level_after !== null && r.level_after !== undefined
                      ? `${fmt.format(n(r.level_after))} ${r.level_after_unit || ""}`
                      : "—"}
                  </td>

                  <td style={tdBase}>{r.gauging_method || "—"}</td>
                  <td style={tdBase}>{r.hour_meter_after ? fmt.format(n(r.hour_meter_after)) : "—"}</td>
                  <td style={tdBase}>{fmtMaybeL(r.rms_level_before)}</td>
                  <td style={tdBase}>{fmtMaybeL(r.rms_level_after)}</td>
                  <td style={tdBase}>{dash(journalRmsHourMeter(r))}</td>

                  <td style={tdBase}>{r.delivery_note_number || "—"}</td>
                  <td style={tdBase}>{fmtMaybeL(r.delivery_note_quantity_liters)}</td>

                  <td style={tdBase}>{r.validated_by || "—"}</td>

                  <td style={tdBase}>
                    <Pill label={r.status || "—"} tone={r.status === "done" ? "green" : "slate"} />
                  </td>

                  <td style={{ ...tdBase, fontWeight: 800, color: gap !== null && Math.abs(gap) > 1 ? T.orange : T.textMid }}>
                    {gap === null ? "—" : fmtL(gap)}
                  </td>

                  <td style={tdBase}>
                    {gapPct === null ? "—" : `${fmt2.format(gapPct)}%`}
                  </td>

                  <td style={tdBase}>
                    <Pill
                      label={check}
                      tone={check === "OK" ? "green" : check === "Écart" ? "orange" : "slate"}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function dash(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function maybeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtMaybeL(value: unknown) {
  const parsed = maybeNumber(value);
  return parsed === null ? "—" : fmtL(parsed);
}

function fmtMaybeKva(value: unknown) {
  const parsed = maybeNumber(value);
  return parsed === null ? "—" : `${fmt1.format(parsed)} KVA`;
}

function modernizedLabel(row: FuelMonthlyRow) {
  if (row.site_ref?.modernized === true) return "Modernisé";
  if (row.site_ref?.modernized === false) return "Existant";
  if (row.enoc_site_ref?.modernised_date) return "Modernisé";
  return "—";
}

function siteTypology(row: FuelMonthlyRow) {
  return (
    row.site_ref?.billing_typology ||
    row.enoc_site_ref?.typology_contractual ||
    row.enoc_site_ref?.new_typo ||
    row.enoc_site_ref?.typo_simple ||
    "—"
  );
}

function realTypology(row: FuelMonthlyRow) {
  return (
    row.site_ref?.installed_typology ||
    row.enoc_site_ref?.new_typo ||
    row.enoc_site_ref?.typo_simple ||
    "—"
  );
}

function siteConfig(row: FuelMonthlyRow) {
  return (
    row.site_ref?.configuration ||
    row.enoc_site_ref?.ongrid_offgrid ||
    row.enoc_site_ref?.indoor_outdoor_after_passive ||
    "—"
  );
}

function siteLoad(row: FuelMonthlyRow) {
  return (
    row.site_ref?.analysis_load ??
    row.enoc_site_ref?.new_load_contract_v2 ??
    row.enoc_site_ref?.new_load ??
    row.enoc_site_ref?.load ??
    null
  );
}

function primaryGe(row: FuelMonthlyRow) {
  return row.ge_ref?.primary_asset || row.ge_ref?.assets?.[0] || null;
}

function secondGe(row: FuelMonthlyRow) {
  return row.ge_ref?.assets?.[1] || null;
}

function geBrand1(row: FuelMonthlyRow) {
  return primaryGe(row)?.brand || row.ge_snapshot?.ge_brand || "—";
}

function geBrand2(row: FuelMonthlyRow) {
  return secondGe(row)?.brand || "—";
}

function gePower1(row: FuelMonthlyRow) {
  return (
    primaryGe(row)?.power_kva ??
    row.ge_snapshot?.ge_power_kva ??
    row.enoc_site_ref?.ge1_power_kva ??
    null
  );
}

function gePower2(row: FuelMonthlyRow) {
  return secondGe(row)?.power_kva ?? row.enoc_site_ref?.ge2_power_kva ?? null;
}

function tankCapacity1(row: FuelMonthlyRow) {
  return (
    primaryGe(row)?.tank_capacity_liters ??
    row.ge_snapshot?.tank_capacity_liters ??
    row.enoc_site_ref?.fuel_tank_capacity_liters ??
    null
  );
}

function tankCapacity2(row: FuelMonthlyRow) {
  return secondGe(row)?.tank_capacity_liters ?? null;
}

function tankType(value: unknown) {
  if (value === true) return "Connectée";
  if (value === false) return "Non connectée";

  const raw = String(value ?? "").toLowerCase().trim();

  if (["true", "oui", "yes", "1", "connected"].includes(raw)) return "Connectée";
  if (["false", "non", "no", "0", "not_connected"].includes(raw)) return "Non connectée";

  return "—";
}

function journalSource(r: FuelEnocMovement) {
  return (
    r.ponction?.source_site_name ||
    r.raw_payload?.ponction?.source_site_name ||
    r.raw_payload?.site_context?.site_name ||
    r.site_name ||
    "—"
  );
}

function journalRmsHourMeter(r: FuelEnocMovement) {
  return (
    r.raw_payload?.rms_hour_meter ||
    r.raw_payload?.rms_ge_hour_meter ||
    r.raw_payload?.site_context?.rms_hour_meter ||
    null
  );
}

function blGapLiters(r: FuelEnocMovement) {
  const bl = maybeNumber(r.delivery_note_quantity_liters);
  const measured = maybeNumber(r.quantity_added_liters);

  if (bl === null || measured === null) return null;

  return bl - measured;
}

function blGapPercent(r: FuelEnocMovement) {
  const bl = maybeNumber(r.delivery_note_quantity_liters);
  const gap = blGapLiters(r);

  if (bl === null || bl === 0 || gap === null) return null;

  return (gap / bl) * 100;
}

function balanceCheck(r: FuelEnocMovement) {
  const gap = blGapLiters(r);

  if (gap === null) return "—";

  if (Math.abs(gap) <= 1) return "OK";

  return "Écart";
}

function ConsoMonthlySheet({
  rows,
  loading,
}: {
  rows: FuelMonthlyRow[];
  loading: boolean;
}) {
  if (loading) return <Skeleton h={460} />;

  return (
    <Card>
      <SheetTitle
        icon={<Fuel size={16} />}
        title="CONSO_MENSUELLE — Suivi consommation mensuelle par site"
        subtitle="Reproduction de la feuille Excel avec groupes de colonnes. Les données disponibles viennent de eFMS et ENOC."
      />

      <div style={{ marginTop: 16, overflow: "auto", borderRadius: 12, border: `1px solid ${T.border}` }}>
        <table style={{ borderCollapse: "collapse", minWidth: 3600, width: "100%" }}>
          <thead>
            <tr>
              <GroupHeader label="Référentiel site" span={22} color={T.blue} bg={T.blueL} />
              <GroupHeader label="Cibles" span={3} color={T.orange} bg={T.orangeL} />
              <GroupHeader label="Données mois précédent" span={6} color={T.violet} bg={T.violetL} />
              <GroupHeader label="Données mois en cours" span={7} color={T.green} bg={T.greenL} />
              <GroupHeader label="Consommation calculée" span={3} color={T.cyan} bg={T.cyanL} />
              <GroupHeader label="CPH réel" span={2} color={T.blue} bg={T.blueL} />
              <GroupHeader label="Écarts & alertes" span={3} color={T.red} bg={T.redL} />
              <GroupHeader label="Stock" span={5} color={T.slate} bg={T.slateL} />
            </tr>

            <tr style={{ background: T.slateL }}>
              {[
                "Site ID",
                "Site Name",
                "Région",
                "Neuf/Existant",
                "Batch",
                "Typo Facturée",
                "Typo Réelle",
                "Conf",
                "Priorité",
                "Puissance (W)",
                "GE Facturé",
                "GE Exist",
                "Cap. Cuve (L)",
                "Marque GE 1",
                "Capacité (KVA)",
                "Capacité Cuve (L)",
                "Type Cuve",
                "Marque GE 2",
                "Capacité (KVA)",
                "Capacité Cuve (L)",
                "Type Cuve",
                "Fuel sensor existing",
                "Target BOQ",
                "Target Aktivco",
                "Facteur Charge",
                "RH Initial",
                "Stock Ouv. RMS",
                "Stock Ouv. Réel",
                "Refueling",
                "Prélèvement Out",
                "Ajout In",
                "RH Final",
                "Stock Clôt. RMS",
                "Stock Clôt. Réel",
                "RH Contrôleur Final",
                "Stock Réel",
                "RH Delta",
                "Stock Delta RMS",
                "Conso Réelle",
                "Conso RMS",
                "Conso Théorique",
                "CPH Réel",
                "CPH Target Aktivco",
                "Écart vs Target",
                "Écart vs Target %",
                "Statut NOK/OK",
                "Taux Remplissage",
                "Alerte Stock",
                "Écart RMS/Réel",
                "Écart RMS/Réel %",
                "Alerte RMS",
              ].map((h) => (
                <th key={h} style={thBase}>{h}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={51} style={{ ...tdBase, textAlign: "center", padding: 32, color: T.textSub }}>
                  Aucune donnée sur la période.
                </td>
              </tr>
            )}

            {rows.map((r, index) => {
              const status = r.gaps.status;
              const tone = statusTone(status.code) as any;

              return (
                <tr key={r.key} style={{ background: index % 2 === 0 ? "white" : "#FCFCFD" }}>
                  <td style={{ ...tdBase, fontWeight: 900, color: T.text }}>{r.site_id || "—"}</td>
                  <td style={{ ...tdBase, minWidth: 190 }}>{r.site_name || "—"}</td>
                  <td style={tdBase}>{r.zone_label || r.zone || r.enoc_site_ref?.region || "—"}</td>

                  <td style={tdBase}>{modernizedLabel(r)}</td>
                  <td style={tdBase}>{r.site_ref?.batch_operational || r.enoc_site_ref?.batch_operational || r.enoc_site_ref?.batch || "—"}</td>
                  <td style={tdBase}>{siteTypology(r)}</td>
                  <td style={tdBase}>{realTypology(r)}</td>
                  <td style={tdBase}>{siteConfig(r)}</td>
                  <td style={tdBase}>{r.enoc_site_ref?.priority || "—"}</td>
                  <td style={tdBase}>{siteLoad(r) !== null ? fmt.format(n(siteLoad(r))) : "—"}</td>

                  <td style={tdBase}>{r.enoc_site_ref?.nb_ge || "—"}</td>
                  <td style={tdBase}>{r.ge_ref?.assets_count || r.enoc_site_ref?.nb_ge || "—"}</td>
                  <td style={tdBase}>{fmtMaybeL(tankCapacity1(r))}</td>

                  <td style={tdBase}>{geBrand1(r)}</td>
                  <td style={tdBase}>{fmtMaybeKva(gePower1(r))}</td>
                  <td style={tdBase}>{fmtMaybeL(tankCapacity1(r))}</td>
                  <td style={tdBase}>{tankType(primaryGe(r)?.tank_connected)}</td>

                  <td style={tdBase}>{geBrand2(r)}</td>
                  <td style={tdBase}>{fmtMaybeKva(gePower2(r))}</td>
                  <td style={tdBase}>{fmtMaybeL(tankCapacity2(r))}</td>
                  <td style={tdBase}>{tankType(secondGe(r)?.tank_connected)}</td>

                  <td style={tdBase}>{r.enoc_site_ref?.rms_installed || "—"}</td>

                  <td style={tdBase}><ComingCell /></td>
                  <td style={tdBase}>
                    {r.enoc.target_status ? (
                      <Pill
                        label={r.enoc.target_status}
                        tone={r.enoc.target_status === "exceeded" ? "red" : "green"}
                      />
                    ) : (
                      <ComingCell />
                    )}
                  </td>
                  <td style={tdBase}><ComingCell /></td>

                  <td style={tdBase}><ComingCell /></td>
                  <td style={tdBase}><ComingCell /></td>
                  <td style={tdBase}><ComingCell /></td>

                  <td style={{ ...tdBase, fontWeight: 900, color: T.green }}>{fmtL(r.enoc.quantity_added_liters)}</td>

                  <td style={tdBase}><ComingCell /></td>
                  <td style={tdBase}><ComingCell /></td>

                  <td style={{ ...tdBase, fontWeight: 800 }}>{fmt2.format(n(r.efms.ge_working_hours))} h</td>

                  <td style={tdBase}><ComingCell /></td>
                  <td style={tdBase}><ComingCell /></td>
                  <td style={tdBase}>{r.enoc.last_request_code || "—"}</td>
                  <td style={tdBase}><ComingCell /></td>

                  <td style={{ ...tdBase, fontWeight: 800 }}>{fmt2.format(n(r.efms.ge_working_hours))} h</td>
                  <td style={tdBase}><ComingCell /></td>

                  <td style={{ ...tdBase, fontWeight: 900, color: T.orange }}>{fmtL(r.efms.fuel_conso_l)}</td>
                  <td style={tdBase}><ComingCell /></td>
                  <td style={{ ...tdBase, fontWeight: 900, color: T.blue }}>{fmtL(r.efms.fuel_deli_l)}</td>

                  <td style={{ ...tdBase, fontWeight: 900 }}>{fmt2.format(n(r.efms.cph_l_per_hour))}</td>
                  <td style={tdBase}><ComingCell /></td>

                  <td style={{ ...tdBase, fontWeight: 900, color: Math.abs(n(r.gaps.deli_vs_enoc_l)) > 0 ? T.orange : T.green }}>
                    {r.gaps.deli_vs_enoc_l === null ? "—" : fmtL(r.gaps.deli_vs_enoc_l)}
                  </td>

                  <td style={tdBase}>
                    {r.gaps.deli_vs_enoc_pct === null ? "—" : `${fmt2.format(n(r.gaps.deli_vs_enoc_pct))}%`}
                  </td>

                  <td style={tdBase}><Pill label={status.label} tone={tone} /></td>

                  <td style={tdBase}><ComingCell /></td>
                  <td style={tdBase}><ComingCell /></td>
                  <td style={tdBase}><ComingCell /></td>
                  <td style={tdBase}><ComingCell /></td>
                  <td style={tdBase}><ComingCell /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PlaceholderSheet({
  icon,
  title,
  subtitle,
  columns,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  columns: string[];
}) {
  return (
    <Card>
      <SheetTitle icon={icon} title={title} subtitle={subtitle} />

      <div style={{ marginTop: 16, overflow: "auto", borderRadius: 12, border: `1px solid ${T.border}` }}>
        <table style={{ borderCollapse: "collapse", minWidth: Math.max(900, columns.length * 150), width: "100%" }}>
          <thead>
            <tr style={{ background: T.slateL }}>
              {columns.map((c) => (
                <th key={c} style={thBase}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {columns.map((c) => (
                <td key={c} style={tdBase}><ComingCell /></td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: "11px 13px",
          borderRadius: 10,
          background: T.orangeL,
          color: T.orange,
          border: "1px solid rgba(217,79,30,.22)",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Cette rubrique est prévue dans le template et sera complétée après arbitrage client.
      </div>
    </Card>
  );
}

function RefSitesSheet({
  rows,
  loading,
}: {
  rows: FuelMonthlyRow[];
  loading: boolean;
}) {
  if (loading) return <Skeleton h={420} />;

  const headers = [
    "Site ID",
    "Site Name",
    "Région",
    "Batch",
    "Typo Facturée",
    "Typo Réelle",
    "Conf",
    "Priorité",
    "Load",
    "Nb GE",
    "GE Exist",
    "Marque GE1",
    "KVA GE1",
    "Cuve GE1",
    "RMS",
    "Catégorie",
    "Scope",
    "Contrat",
    "Compteur",
  ];

  return (
    <Card>
      <SheetTitle
        icon={<Layers3 size={16} />}
        title="REF_SITES — Référentiel sites"
        subtitle="Référentiel enrichi depuis Site EnerTrack, Site ENOC et GE ENOC."
      />

      <div style={{ marginTop: 16, overflow: "auto", borderRadius: 12, border: `1px solid ${T.border}` }}>
        <table style={{ borderCollapse: "collapse", minWidth: 2200, width: "100%" }}>
          <thead>
            <tr style={{ background: T.slateL }}>
              {headers.map((h) => (
                <th key={h} style={thBase}>{h}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length} style={{ ...tdBase, textAlign: "center", padding: 32, color: T.textSub }}>
                  Aucun référentiel disponible pour ce filtre.
                </td>
              </tr>
            )}

            {rows.map((r, index) => (
              <tr key={r.key} style={{ background: index % 2 === 0 ? "white" : "#FCFCFD" }}>
                <td style={{ ...tdBase, fontWeight: 900 }}>{r.site_id || "—"}</td>
                <td style={tdBase}>{r.site_name || "—"}</td>
                <td style={tdBase}>{r.zone_label || r.zone || r.enoc_site_ref?.region || "—"}</td>
                <td style={tdBase}>{r.site_ref?.batch_operational || r.enoc_site_ref?.batch_operational || r.enoc_site_ref?.batch || "—"}</td>
                <td style={tdBase}>{siteTypology(r)}</td>
                <td style={tdBase}>{realTypology(r)}</td>
                <td style={tdBase}>{siteConfig(r)}</td>
                <td style={tdBase}>{r.enoc_site_ref?.priority || "—"}</td>
                <td style={tdBase}>{siteLoad(r) !== null ? fmt.format(n(siteLoad(r))) : "—"}</td>
                <td style={tdBase}>{r.enoc_site_ref?.nb_ge || "—"}</td>
                <td style={tdBase}>{r.ge_ref?.assets_count || r.enoc_site_ref?.nb_ge || "—"}</td>
                <td style={tdBase}>{geBrand1(r)}</td>
                <td style={tdBase}>{fmtMaybeKva(gePower1(r))}</td>
                <td style={tdBase}>{fmtMaybeL(tankCapacity1(r))}</td>
                <td style={tdBase}>{r.enoc_site_ref?.rms_installed || "—"}</td>
                <td style={tdBase}>{r.enoc_site_ref?.category || "—"}</td>
                <td style={tdBase}>{r.site_ref?.scope_status || r.enoc_site_ref?.scope_initial || "—"}</td>
                <td style={tdBase}>{r.site_ref?.contract_number || "—"}</td>
                <td style={tdBase}>{r.site_ref?.meter_number || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ListsSheet() {
  const rows = [
    ["Dépotage", "En cours", "Automatisme GE", "SAR", "Toise", "Chef Exploitation", "IN", "P1"],
    ["Transfert inter-sites", "Soldé", "Carburant volé", "TOTAL Sénégal", "Capteur fuel", "Superviseur", "OD", "P2"],
    ["Ajout manuel", "Partiel", "Faible autonomie", "TOUBA OIL", "Jauge visuelle", "Directeur Opérations", "—", "P3"],
    ["Prélèvement", "Annulé", "Faible production solaire", "Autre", "Débitmètre", "Contrôleur", "—", "P4"],
    ["Correction", "—", "Mauvaise perf. solaire", "—", "—", "—", "—", "P5"],
  ];

  const headers = ["type_action", "statut", "causes", "fournisseurs", "methode_jauge", "validateurs", "conf", "priorite"];

  return (
    <Card>
      <SheetTitle
        icon={<ListChecks size={16} />}
        title="LISTES — Paramétrage"
        subtitle="Valeurs de référence du template Excel. Les listes pourront devenir administrables en V2."
      />

      <div style={{ marginTop: 16, overflow: "auto", borderRadius: 12, border: `1px solid ${T.border}` }}>
        <table style={{ borderCollapse: "collapse", minWidth: 1000, width: "100%" }}>
          <thead>
            <tr style={{ background: T.slateL }}>
              {headers.map((h) => (
                <th key={h} style={thBase}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, index) => (
              <tr key={index} style={{ background: index % 2 === 0 ? "white" : "#FCFCFD" }}>
                {r.map((v, i) => (
                  <td key={`${index}-${i}`} style={tdBase}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SyncStrip({ syncQ }: { syncQ: any }) {
  const enoc = syncQ.data?.enoc?.[0];
  const efms = syncQ.data?.efms?.[0];

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <Pill
        label={`eFMS : ${efms?.status || "—"}`}
        tone={efms?.status === "SUCCESS" ? "green" : efms?.status === "FAILED" ? "red" : "slate"}
      />
      <Pill
        label={`ENOC : ${enoc?.status || "—"}`}
        tone={enoc?.status === "SUCCESS" ? "green" : enoc?.status === "FAILED" ? "red" : "slate"}
      />
      <span style={{ color: T.textSub, fontSize: 12 }}>
        Dernière sync ENOC : {fmtDateTime(enoc?.started_at)}
      </span>
    </div>
  );
}

function buildSheetRowsConso(rows: FuelMonthlyRow[]) {
  return rows.map((r) => ({
    "Site ID": r.site_id,
    "Site Name": r.site_name,
    "Région": r.zone_label || r.zone || r.enoc_site_ref?.region,
    "Neuf/Existant": modernizedLabel(r),
    "Batch": r.site_ref?.batch_operational || r.enoc_site_ref?.batch_operational || r.enoc_site_ref?.batch,
    "Typo Facturée": siteTypology(r),
    "Typo Réelle": realTypology(r),
    "Conf": siteConfig(r),
    "Priorité": r.enoc_site_ref?.priority,
    "Puissance / Load": siteLoad(r),
    "GE Facturé": r.enoc_site_ref?.nb_ge,
    "GE Exist": r.ge_ref?.assets_count || r.enoc_site_ref?.nb_ge,
    "Cap. Cuve (L)": tankCapacity1(r),
    "Marque GE 1": geBrand1(r),
    "Capacité GE1 (KVA)": gePower1(r),
    "Capacité Cuve GE1 (L)": tankCapacity1(r),
    "Type Cuve GE1": tankType(primaryGe(r)?.tank_connected),
    "Marque GE 2": geBrand2(r),
    "Capacité GE2 (KVA)": gePower2(r),
    "Capacité Cuve GE2 (L)": tankCapacity2(r),
    "Type Cuve GE2": tankType(secondGe(r)?.tank_connected),
    "Fuel sensor existing": r.enoc_site_ref?.rms_installed,

    "Target BOQ (L/mois)": "",
    "Target Aktivco / statut ENOC": r.enoc.target_status || "",
    "Facteur Charge (%)": "",

    "RH Initial (h)": "",
    "Stock Ouv. RMS (L)": "",
    "Stock Ouv. Réel (L)": "",
    "Refueling ENOC (L)": r.enoc.quantity_added_liters,
    "Prélevement Out (L)": "",
    "Ajout In (L)": "",
    "RH Final eFMS (h)": r.efms.ge_working_hours,
    "Stock Clôt. RMS (L)": "",
    "Stock Clôt. Réel (L)": "",
    "Dernier ticket": r.enoc.last_request_code || "",
    "Stock Réel (L)": "",
    "RH Delta eFMS (h)": r.efms.ge_working_hours,
    "Stock Delta RMS (L)": "",
    "Conso Réelle / eFMS conso (L)": r.efms.fuel_conso_l,
    "Conso RMS (L)": "",
    "Conso Théorique / eFMS livré (L)": r.efms.fuel_deli_l,
    "CPH Réel eFMS (L/h)": r.efms.cph_l_per_hour,
    "CPH Target Aktivco (L/h)": "",
    "Écart livré vs ENOC (L)": r.gaps.deli_vs_enoc_l,
    "Écart livré vs ENOC (%)": r.gaps.deli_vs_enoc_pct,
    "Statut NOK/OK": r.gaps.status.label,
    "Taux Remplissage (%)": "",
    "Alerte Stock": "",
    "Écart RMS/Réel (L)": "",
    "Écart RMS/Réel (%)": "",
    "Alerte RMS": "",
  }));
}

function buildSheetRowsJournal(rows: FuelEnocMovement[]) {
  return rows.map((r) => ({
    "Site ID": r.site_id,
    "N° Ticket FMS": r.request_code,
    "Type d'action": r.operation_type,
    "Date": r.operation_date,
    "Responsable": r.done_by || r.created_by || r.technician_name,
    "Source (Site/Dépôt)": journalSource(r),
    "Qté initiale site (L)": r.level_before || "",
    "Qté transférée (L)": r.quantity_added_liters,
    "Qté finale site (L)": r.level_after || "",
    "Méthode Jaugeage": r.gauging_method || "",
    "DG RH lu contrôleur": r.hour_meter_after || "",
    "Qté init. RMS (L)": r.rms_level_before || "",
    "Qté fin. RMS (L)": r.rms_level_after || "",
    "RMS DG RH": journalRmsHourMeter(r) || "",
    "N° Bon de Livraison": r.delivery_note_number || "",
    "Qté BL (L)": r.delivery_note_quantity_liters || "",
    "Validé Par": r.validated_by,
    "Statut": r.status,
    "Écart BL/Mesuré (L)": blGapLiters(r) ?? "",
    "Écart BL %": blGapPercent(r) ?? "",
    "Balance Check": balanceCheck(r),
  }));
}

function exportWorkbook({
  month,
  monthlyRows,
  journalRows,
  kpis,
}: {
  month: string;
  monthlyRows: FuelMonthlyRow[];
  journalRows: FuelEnocMovement[];
  kpis: any;
}) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Indicateur: "Target BOQ Total", Valeur: "" },
      { Indicateur: "Target Aktivco Total", Valeur: "" },
      { Indicateur: "Consommation ENOC", Valeur: n(kpis?.enoc_quantity_added_liters) },
      { Indicateur: "eFMS livré", Valeur: n(kpis?.fuel_deli_l) },
      { Indicateur: "eFMS conso", Valeur: n(kpis?.fuel_conso_l) },
      { Indicateur: "Écart livré vs ENOC", Valeur: n(kpis?.gap_deli_vs_enoc_l) },
      { Indicateur: "Sites OK", Valeur: n(kpis?.ok) },
      { Indicateur: "Sites NOK", Valeur: n(kpis?.nok) },
      { Indicateur: "Stock critique", Valeur: "À venir" },
      { Indicateur: "Alertes RMS", Valeur: "À venir" },
    ]),
    "DASHBOARD"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(buildSheetRowsJournal(journalRows)),
    "JOURNAL_RAVITAILLEMENT"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(buildSheetRowsConso(monthlyRows)),
    "CONSO_MENSUELLE"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Date: "",
        Fournisseur: "",
        "N° BL": "",
        "Entrée (L)": "",
        "Sortie vers site": "",
        "Site Destinataire": "",
        "Quantité sortie (L)": "",
        "Solde Dépôt (L)": "",
        "Solde Théorique (L)": "",
        "Écart Dépôt (L)": "",
        Responsable: "",
        Commentaire: "À venir",
      },
    ]),
    "STOCK_DÉPÔT"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        "Moteur": "Perkins",
        "DGCapacity in KVA": "",
        "Facteur charge": "",
        "CPH attendu": "À venir",
      },
      {
        "Moteur": "Kohler",
        "DGCapacity in KVA": "",
        "Facteur charge": "",
        "CPH attendu": "À venir",
      },
    ]),
    "CPH"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      monthlyRows.map((r) => ({
        "Site ID": r.site_id,
        "Site Name": r.site_name,
        "Région": r.zone_label || r.zone || r.enoc_site_ref?.region,
        "Site Neuf/Existant": modernizedLabel(r),
        "Batch": r.site_ref?.batch_operational || r.enoc_site_ref?.batch_operational || r.enoc_site_ref?.batch,
        "Typo Facturée": siteTypology(r),
        "Typo Réelle": realTypology(r),
        "Conf": siteConfig(r),
        "Priorité": r.enoc_site_ref?.priority,
        "Puissance / Load": siteLoad(r),
        "GE Facturé": r.enoc_site_ref?.nb_ge,
        "GE Exist": r.ge_ref?.assets_count || r.enoc_site_ref?.nb_ge,
        "Commentaire": r.site_ref?.energy_desk_comment || "",
        "Marque GE1": geBrand1(r),
        "KVA GE1": gePower1(r),
        "Cap. Cuve GE1": tankCapacity1(r),
        "Type Cuve GE1": tankType(primaryGe(r)?.tank_connected),
        "Marque GE2": geBrand2(r),
        "KVA GE2": gePower2(r),
        "Cap. Cuve GE2": tankCapacity2(r),
        "Type Cuve GE2": tankType(secondGe(r)?.tank_connected),
        "Fuel Sensor / RMS": r.enoc_site_ref?.rms_installed,
        "Catégorie": r.enoc_site_ref?.category,
        "Scope": r.site_ref?.scope_status || r.enoc_site_ref?.scope_initial,
        "Contrat": r.site_ref?.contract_number,
        "Compteur": r.site_ref?.meter_number,
      }))
    ),
    "REF_SITES"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        type_action: "Dépotage",
        statut: "En cours",
        causes: "Automatisme GE",
        fournisseurs: "SAR",
        methode_jauge: "Toise",
        validateurs: "Chef Exploitation",
        conf: "IN",
        priorite: "P1",
      },
      {
        type_action: "Transfert inter-sites",
        statut: "Soldé",
        causes: "Carburant volé",
        fournisseurs: "TOTAL Sénégal",
        methode_jauge: "Capteur fuel",
        validateurs: "Superviseur",
        conf: "OD",
        priorite: "P2",
      },
      {
        type_action: "Ajout manuel",
        statut: "Partiel",
        causes: "Faible autonomie",
        fournisseurs: "TOUBA OIL",
        methode_jauge: "Jauge visuelle",
        validateurs: "Directeur Opérations",
        conf: "",
        priorite: "P3",
      },
    ]),
    "LISTES"
  );

  XLSX.writeFile(wb, `Suivi_Carburant_${month}.xlsx`);
}

export default function FuelTrackingPage() {
  const [activeSheet, setActiveSheet] = useState<SheetKey>("CONSO_MENSUELLE");
  const [month, setMonth] = useState(currentMonth());
  const [site, setSite] = useState("");
  const [status, setStatus] = useState<FuelStatusCode>("ALL");
  const [operationType, setOperationType] = useState("ALL");
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [journalPage, setJournalPage] = useState(1);


  const sourceStatusQ = useQuery({
    queryKey: ["fuel-source-status", month],
    queryFn: () => getFuelSourceStatus({ country: "Senegal", month }),
    staleTime: 60_000,
  });

  const monthlyQ = useQuery({
    queryKey: ["fuel-monthly-template", month, site, status, monthlyPage],
    queryFn: () =>
      getFuelMonthlyTracking({
        month,
        site,
        status,
        page: monthlyPage,
        limit: 50,
      }),
    staleTime: 60_000,
  });

  const journalQ = useQuery({
    queryKey: ["fuel-journal-template", month, site, operationType, journalPage],
    queryFn: () =>
      getFuelEnocJournal({
        month,
        site,
        operation_type: operationType,
        page: journalPage,
        limit: 50,
      }),
    staleTime: 60_000,
  });

  const syncQ = useQuery({
    queryKey: ["fuel-sync-runs-template"],
    queryFn: getFuelSyncRuns,
    staleTime: 60_000,
  });

  const rows = monthlyQ.data?.data ?? [];
  const journalRows = journalQ.data?.data ?? [];
  const kpis = monthlyQ.data?.kpis;

  const statusMeta: Record<FuelStatusCode, { label: string; tone: "green" | "orange" | "red" | "blue" | "violet" | "slate" }> = {
    ALL: { label: "Tous", tone: "blue" },
    OK: { label: "OK", tone: "green" },
    WARNING: { label: "À suivre", tone: "orange" },
    NOK: { label: "NOK", tone: "red" },
    EFMS_ONLY: { label: "eFMS seul", tone: "blue" },
    ENOC_ONLY: { label: "ENOC seul", tone: "violet" },
    NO_BASE: { label: "Base insuffisante", tone: "slate" },
    NO_DATA: { label: "Aucune donnée", tone: "slate" },
  };

  const sheetSubtitle = useMemo(() => {
    if (activeSheet === "DASHBOARD") return "Synthèse globale mensuelle.";
    if (activeSheet === "JOURNAL_RAVITAILLEMENT") return "Traçabilité des mouvements ENOC.";
    if (activeSheet === "CONSO_MENSUELLE") return "Suivi mensuel par site, format template Excel.";
    if (activeSheet === "STOCK_DEPOT") return "Entrées fournisseurs et sorties dépôt.";
    if (activeSheet === "CPH") return "Matrice CPH moteurs.";
    if (activeSheet === "REF_SITES") return "Référentiel sites et targets.";
    return "Listes de paramétrage.";
  }, [activeSheet]);

  return (
    <>
      <style>{`
        .fuelbook,
        .fuelbook * {
          box-sizing: border-box;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          font-style: normal !important;
        }

        @keyframes fuelFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fuelSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes fuelShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .fuel-fade {
          animation: fuelFadeUp .28s ease-out both;
        }

        .fuel-skel {
          background: linear-gradient(90deg, #F1F5F9 25%, #E8EFF6 50%, #F1F5F9 75%);
          background-size: 200% 100%;
          animation: fuelShimmer 1.3s infinite;
        }

        .fuel-spin {
          animation: fuelSpin .75s linear infinite;
        }

        .fuelbook input,
        .fuelbook select,
        .fuelbook button {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        }
      `}</style>

      <div className="fuelbook" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          className="fuel-fade"
          style={{
            background: "white",
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            boxShadow: "0 1px 3px rgba(15,23,42,.05)",
            overflow: "hidden",
          }}
        >
          <div style={{ height: 3, background: `linear-gradient(90deg, ${T.blue}, ${T.orange}, transparent)` }} />

          <div style={{ padding: "20px 22px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: T.orangeL,
                    color: T.orange,
                    border: "1px solid rgba(217,79,30,.20)",
                    fontSize: 11,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                    marginBottom: 8,
                  }}
                >
                  <FileSpreadsheet size={13} />
                  Classeur suivi carburant
                </div>

                <h1 style={{ margin: 0, color: T.text, fontSize: 22, lineHeight: 1.2, fontWeight: 850 }}>
                  Suivi Carburant — format template Excel
                </h1>

                <p style={{ margin: "5px 0 0", color: T.textSub, fontSize: 13 }}>
                  Rubrique active : <strong style={{ color: T.textMid }}>{SHEETS.find((s) => s.key === activeSheet)?.label}</strong> · {sheetSubtitle}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    border: `1px solid ${T.border}`,
                    background: T.slateL,
                    borderRadius: 10,
                    padding: "8px 11px",
                  }}
                >
                  <Calendar size={14} color={T.textSub} />
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => {
                      setMonth(e.target.value);
                      setMonthlyPage(1);
                      setJournalPage(1);
                    }}
                    style={{
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: 13,
                      color: T.text,
                      fontWeight: 800,
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    border: `1px solid ${T.border}`,
                    background: "white",
                    borderRadius: 10,
                    padding: "8px 11px",
                    minWidth: 250,
                  }}
                >
                  <Search size={14} color={T.textSub} />
                  <input
                    value={site}
                    onChange={(e) => {
                      setSite(e.target.value);
                      setMonthlyPage(1);
                      setJournalPage(1);
                    }}
                    placeholder="Site ID, nom ou ticket..."
                    style={{
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: 13,
                      color: T.text,
                      flex: 1,
                    }}
                  />
                </div>

                <button
                  onClick={() => {
                    monthlyQ.refetch();
                    journalQ.refetch();
                    syncQ.refetch();
                  }}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: "white",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    color: T.textMid,
                  }}
                  title="Rafraîchir"
                >
                  <RefreshCw size={15} className={monthlyQ.isFetching || journalQ.isFetching ? "fuel-spin" : ""} />
                </button>

                <button
                  onClick={() => exportWorkbook({ month, monthlyRows: rows, journalRows, kpis })}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "9px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: T.blue,
                    color: "white",
                    fontSize: 13,
                    fontWeight: 850,
                    cursor: "pointer",
                    boxShadow: `0 5px 14px ${T.blue}30`,
                  }}
                >
                  <Download size={14} />
                  Export classeur
                </button>
              </div>
            </div>

            <div style={{ marginTop: 15, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {SHEETS.map((sheet) => {
                  const active = activeSheet === sheet.key;

                  return (
                    <button
                      key={sheet.key}
                      onClick={() => setActiveSheet(sheet.key)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "8px 11px",
                        borderRadius: 10,
                        border: `1px solid ${active ? "rgba(27,63,160,.35)" : T.border}`,
                        background: active ? T.blue : "white",
                        color: active ? "white" : T.textMid,
                        fontSize: 12,
                        fontWeight: 850,
                        cursor: "pointer",
                        boxShadow: active ? `0 5px 14px ${T.blue}25` : "none",
                      }}
                    >
                      {sheet.icon}
                      {sheet.label}
                    </button>
                  );
                })}
              </div>

              <SyncStrip syncQ={syncQ} />
            </div>
          </div>
        </div>

        <Card style={{ padding: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 850, color: T.text, fontSize: 14 }}>
                Disponibilité des sources
              </div>

              <div style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>
                EnerTrack consolide les données mensuelles eFMS et les mouvements terrain ENOC.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill
                label={
                  sourceStatusQ.data?.efms.latest_month
                    ? `eFMS jusqu'à ${sourceStatusQ.data.efms.latest_month}`
                    : "eFMS indisponible"
                }
                tone={sourceStatusQ.data?.efms.available ? "green" : "red"}
              />

              <Pill
                label={
                  sourceStatusQ.data?.enoc.latest_operation_date
                    ? `ENOC ${sourceStatusQ.data.enoc.total_movements} mouvement(s)`
                    : "ENOC indisponible"
                }
                tone={sourceStatusQ.data?.enoc.available ? "green" : "red"}
              />

              {sourceStatusQ.data?.requested_month?.status === "EFMS_ENOC" && (
                <Pill label={`${month} : eFMS + ENOC`} tone="green" />
              )}

              {sourceStatusQ.data?.requested_month?.status === "EFMS_ONLY" && (
                <Pill label={`${month} : eFMS seul`} tone="blue" />
              )}

              {sourceStatusQ.data?.requested_month?.status === "ENOC_ONLY" && (
                <Pill label={`${month} : ENOC seul / eFMS non disponible`} tone="orange" />
              )}

              {sourceStatusQ.data?.requested_month?.status === "NO_DATA" && (
                <Pill label={`${month} : aucune donnée`} tone="slate" />
              )}
            </div>
          </div>
        </Card>

        {(activeSheet === "DASHBOARD" || activeSheet === "CONSO_MENSUELLE") && (
          <div
            className="fuel-fade"
            style={{
              display: "flex",
              gap: 7,
              flexWrap: "wrap",
              alignItems: "center",
              padding: "11px 13px",
              background: "white",
              border: `1px solid ${T.border}`,
              borderRadius: 14,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 850, color: T.textSub, textTransform: "uppercase", letterSpacing: ".07em" }}>
              Statut
            </span>
            {(Object.keys(statusMeta) as FuelStatusCode[]).map((s) => {
              const meta = statusMeta[s];
              const c = toneColor(meta.tone);
              const active = status === s;

              return (
                <button
                  key={s}
                  onClick={() => {
                    setStatus(s);
                    setMonthlyPage(1);
                  }}
                  style={{
                    border: `1px solid ${active ? c.fg : T.border}`,
                    background: active ? c.fg : "white",
                    color: active ? "white" : T.textMid,
                    borderRadius: 999,
                    padding: "5px 10px",
                    fontSize: 11,
                    fontWeight: 850,
                    cursor: "pointer",
                  }}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        )}

        {activeSheet === "JOURNAL_RAVITAILLEMENT" && (
          <div
            className="fuel-fade"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              padding: "11px 13px",
              background: "white",
              border: `1px solid ${T.border}`,
              borderRadius: 14,
            }}
          >
            <div style={{ color: T.textSub, fontSize: 12, fontWeight: 700 }}>
              {journalQ.data?.summary.total_movements ?? 0} mouvement(s) · {fmtL(journalQ.data?.summary.total_quantity_added_liters ?? 0)}
            </div>

            <select
              value={operationType}
              onChange={(e) => {
                setOperationType(e.target.value);
                setJournalPage(1);
              }}
              style={{
                height: 34,
                borderRadius: 9,
                border: `1px solid ${T.border}`,
                background: "white",
                color: T.text,
                padding: "0 10px",
                fontSize: 12,
                fontWeight: 800,
                outline: "none",
              }}
            >
              <option value="ALL">Tous types</option>
              <option value="TRUCK">TRUCK</option>
              <option value="TOTAL_CARD">TOTAL_CARD</option>
              <option value="PONCTION">PONCTION</option>
            </select>
          </div>
        )}

        <div className="fuel-fade">
          {activeSheet === "DASHBOARD" && (
            <DashboardSheet rows={rows} kpis={kpis} loading={monthlyQ.isLoading} />
          )}

          {activeSheet === "JOURNAL_RAVITAILLEMENT" && (
            <>
              <JournalSheet rows={journalRows} loading={journalQ.isLoading} />
              {journalQ.data && journalQ.data.pagination.totalPages > 1 && (
                <Pager
                  page={journalQ.data.pagination.page}
                  totalPages={journalQ.data.pagination.totalPages}
                  hasPrev={journalQ.data.pagination.hasPrev}
                  hasNext={journalQ.data.pagination.hasNext}
                  onPrev={() => setJournalPage((p) => Math.max(1, p - 1))}
                  onNext={() => setJournalPage((p) => p + 1)}
                />
              )}
            </>
          )}

          {activeSheet === "CONSO_MENSUELLE" && (
            <>
              <ConsoMonthlySheet rows={rows} loading={monthlyQ.isLoading} />
              {monthlyQ.data && monthlyQ.data.pagination.totalPages > 1 && (
                <Pager
                  page={monthlyQ.data.pagination.page}
                  totalPages={monthlyQ.data.pagination.totalPages}
                  hasPrev={monthlyQ.data.pagination.hasPrev}
                  hasNext={monthlyQ.data.pagination.hasNext}
                  onPrev={() => setMonthlyPage((p) => Math.max(1, p - 1))}
                  onNext={() => setMonthlyPage((p) => p + 1)}
                />
              )}
            </>
          )}

          {activeSheet === "STOCK_DEPOT" && (
            <PlaceholderSheet
              icon={<Warehouse size={16} />}
              title="STOCK_DÉPÔT — Entrées fournisseurs / sorties vers sites"
              subtitle="Structure de la feuille conservée pour préparer la V2."
              columns={[
                "Date",
                "Fournisseur",
                "N° BL",
                "Entrée (L)",
                "Sortie vers site",
                "Site Destinataire",
                "Quantité sortie (L)",
                "Solde Dépôt (L)",
                "Solde Théorique (L)",
                "Écart Dépôt (L)",
                "Responsable",
                "Commentaire",
              ]}
            />
          )}

          {activeSheet === "CPH" && (
            <PlaceholderSheet
              icon={<Gauge size={16} />}
              title="CPH — Matrice consommation horaire"
              subtitle="La matrice CPH Perkins/Kohler sera intégrée après validation client."
              columns={[
                "Moteur",
                "DGCapacity in KVA",
                "0",
                "0.1",
                "0.15",
                "0.2",
                "0.25",
                "0.3",
                "0.35",
                "0.4",
                "0.45",
                "0.5",
                "0.55",
                "0.6",
                "0.65",
                "0.7",
                "0.75",
                "0.8",
                "0.85",
                "0.9",
                "0.95",
                "1",
              ]}
            />
          )}

          {activeSheet === "REF_SITES" && (
            <RefSitesSheet rows={rows} loading={monthlyQ.isLoading} />
          )}

          {activeSheet === "LISTES" && <ListsSheet />}
        </div>

        <Card style={{ background: T.slateL }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "white",
                display: "grid",
                placeItems: "center",
                color: T.orange,
                flexShrink: 0,
              }}
            >
              <Settings2 size={16} />
            </div>
            <div>
              <div style={{ color: T.text, fontSize: 14, fontWeight: 850 }}>
                Périmètre V1
              </div>
              <div style={{ color: T.textSub, fontSize: 12.5, lineHeight: 1.6, marginTop: 3 }}>
                Le module reprend toutes les feuilles du template. Les données eFMS et ENOC sont actives.
                Les champs stock réel/RMS, BL, dépôt, jaugeage, causes d’analyse, CPH complet et REF_SITES complet
                restent visibles mais marqués “À venir”.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}