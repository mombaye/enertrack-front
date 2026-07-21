// src/features/fuel-tracking/FuelTrackingPage.tsx

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Fuel,
  Gauge,
  Layers3,
  ListChecks,
  MapPin,
  RefreshCw,
  Search,
  Settings2,
  Warehouse,
} from "lucide-react";

import { exportFuelTrackingWorkbook, getCphMatrix, getFuelEnocJournal, getFuelMonthlyTracking, getFuelSourceStatus, getFuelSyncRuns, type FuelStatusCode } from "@/services/fuelTracking";

import { FT, toneColors } from "./theme";
import { Card, GLOBAL_STYLES, Pager, Pill, SegmentedTabs } from "./ui";
import { currentMonth, fmtDateTime, fmtL } from "./helpers";
import { DashboardSheet } from "./sheets/DashboardSheet";
import { JournalSheet } from "./sheets/JournalSheet";
import { ConsoMensuelleSheet } from "./sheets/ConsoMensuelleSheet";
import { RefSitesSheet } from "./sheets/RefSitesSheet";
import { CphSheet, ListesSheet, StockDepotSheet } from "./sheets/OtherSheets";

type SheetKey = "DASHBOARD" | "JOURNAL_RAVITAILLEMENT" | "CONSO_MENSUELLE" | "STOCK_DEPOT" | "CPH" | "REF_SITES" | "LISTES";

const SHEETS: Array<{ key: SheetKey; label: string; icon: ReactNode }> = [
  { key: "DASHBOARD", label: "Dashboard", icon: <BarChart3 size={14} /> },
  { key: "JOURNAL_RAVITAILLEMENT", label: "Journal ravitaillement", icon: <ClipboardList size={14} /> },
  { key: "CONSO_MENSUELLE", label: "Conso mensuelle", icon: <Fuel size={14} /> },
  { key: "STOCK_DEPOT", label: "Stock dépôt", icon: <Warehouse size={14} /> },
  { key: "CPH", label: "CPH", icon: <Gauge size={14} /> },
  { key: "REF_SITES", label: "Référentiel sites", icon: <Layers3 size={14} /> },
  { key: "LISTES", label: "Listes", icon: <ListChecks size={14} /> },
];

const STATUS_META: Record<FuelStatusCode, { label: string; tone: Parameters<typeof toneColors>[0] }> = {
  ALL: { label: "Tous", tone: "blue" },
  OK: { label: "OK", tone: "green" },
  WARNING: { label: "À suivre", tone: "orange" },
  NOK: { label: "NOK", tone: "red" },
  EFMS_ONLY: { label: "eFMS seul", tone: "blue" },
  ENOC_ONLY: { label: "ENOC seul", tone: "violet" },
  NO_BASE: { label: "Base insuffisante", tone: "slate" },
  NO_DATA: { label: "Aucune donnée", tone: "slate" },
};

export default function FuelTrackingPage() {
  const [activeSheet, setActiveSheet] = useState<SheetKey>("CONSO_MENSUELLE");
  const [month, setMonth] = useState(currentMonth());
  const [site, setSite] = useState("");
  const [zone, setZone] = useState("");
  const [status, setStatus] = useState<FuelStatusCode>("ALL");
  const [operationType, setOperationType] = useState("ALL");
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [journalPage, setJournalPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await exportFuelTrackingWorkbook({ month });
    } finally {
      setExporting(false);
    }
  }

  const sourceStatusQ = useQuery({
    queryKey: ["fuel-source-status", month],
    queryFn: () => getFuelSourceStatus({ country: "Senegal", month }),
    staleTime: 60_000,
  });

  const monthlyQ = useQuery({
    queryKey: ["fuel-monthly-template", month, site, zone, status, monthlyPage],
    queryFn: () => getFuelMonthlyTracking({ month, site, zone, status, page: monthlyPage, limit: 50 }),
    staleTime: 60_000,
  });

  const journalQ = useQuery({
    queryKey: ["fuel-journal-template", month, site, zone, operationType, journalPage],
    queryFn: () => getFuelEnocJournal({ month, site, zone, operation_type: operationType, page: journalPage, limit: 50 }),
    staleTime: 60_000,
  });

  const syncQ = useQuery({
    queryKey: ["fuel-sync-runs-template"],
    queryFn: getFuelSyncRuns,
    staleTime: 60_000,
  });

  const cphMatrixQ = useQuery({
    queryKey: ["fuel-cph-matrix"],
    queryFn: getCphMatrix,
    enabled: activeSheet === "CPH",
    staleTime: 5 * 60_000,
  });

  const rows = monthlyQ.data?.data ?? [];
  const journalRows = journalQ.data?.data ?? [];
  const kpis = monthlyQ.data?.kpis;
  const efms = syncQ.data?.efms?.[0];
  const enoc = syncQ.data?.enoc?.[0];

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
      <style>{GLOBAL_STYLES}</style>

      <div className="fuelbook" style={{ display: "flex", flexDirection: "column", gap: 14, background: FT.pageBg, margin: -20, padding: 20 }}>
        {/* ── En-tête ──────────────────────────────────────────────────────── */}
        <div className="ft-fade" style={{ background: FT.headerGrad, borderRadius: FT.radius, boxShadow: FT.shadowLg, padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "3px 10px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,.12)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,.22)",
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  marginBottom: 9,
                }}
              >
                <FileSpreadsheet size={11} />
                Suivi Carburant
              </div>
              <h1 style={{ margin: 0, color: "#FFFFFF", fontSize: 21, lineHeight: 1.25, fontWeight: 700, letterSpacing: "-.01em" }}>
                {SHEETS.find((s) => s.key === activeSheet)?.label}
              </h1>
              <p style={{ margin: "5px 0 0", color: FT.textOnDarkSub, fontSize: 12.5 }}>{sheetSubtitle}</p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Pill label={`eFMS : ${efms?.status || "—"}`} tone={efms?.status === "SUCCESS" ? "green" : efms?.status === "FAILED" ? "red" : "slate"} />
              <Pill label={`ENOC : ${enoc?.status || "—"}`} tone={enoc?.status === "SUCCESS" ? "green" : enoc?.status === "FAILED" ? "red" : "slate"} />
              <span style={{ color: FT.textOnDarkSub, fontSize: 11 }}>Sync ENOC : {fmtDateTime(enoc?.started_at)}</span>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <SegmentedTabs options={SHEETS} value={activeSheet} onChange={setActiveSheet} />
          </div>
        </div>

        {/* ── Barre de filtres ─────────────────────────────────────────────── */}
        <Card style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px" }}>
                <Calendar size={14} color={FT.textSub} />
                <input
                  type="month"
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    setMonthlyPage(1);
                    setJournalPage(1);
                  }}
                  style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, fontWeight: 700 }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px", minWidth: 210 }}>
                <Search size={14} color={FT.textSub} />
                <input
                  value={site}
                  onChange={(e) => {
                    setSite(e.target.value);
                    setMonthlyPage(1);
                    setJournalPage(1);
                  }}
                  placeholder="Site ID, nom ou ticket..."
                  style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, flex: 1 }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px", minWidth: 150 }}>
                <MapPin size={14} color={FT.textSub} />
                <input
                  value={zone}
                  onChange={(e) => {
                    setZone(e.target.value);
                    setMonthlyPage(1);
                    setJournalPage(1);
                  }}
                  placeholder="Zone / région..."
                  style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, flex: 1 }}
                />
              </div>

              <button
                onClick={() => {
                  monthlyQ.refetch();
                  journalQ.refetch();
                  syncQ.refetch();
                }}
                title="Rafraîchir"
                style={{ width: 33, height: 33, borderRadius: 9, border: `1px solid ${FT.border}`, background: FT.slateL, display: "grid", placeItems: "center", cursor: "pointer", color: FT.textMid }}
              >
                <RefreshCw size={14} className={monthlyQ.isFetching || journalQ.isFetching ? "ft-spin" : ""} />
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Pill label={sourceStatusQ.data?.efms.latest_month ? `eFMS jusqu'à ${sourceStatusQ.data.efms.latest_month}` : "eFMS indisponible"} tone={sourceStatusQ.data?.efms.available ? "green" : "red"} />
              <Pill label={sourceStatusQ.data?.enoc.latest_operation_date ? `ENOC ${sourceStatusQ.data.enoc.total_movements} mouvement(s)` : "ENOC indisponible"} tone={sourceStatusQ.data?.enoc.available ? "green" : "red"} />
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 14px",
                  borderRadius: 9,
                  border: "none",
                  background: FT.navy,
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: exporting ? "not-allowed" : "pointer",
                  opacity: exporting ? 0.7 : 1,
                }}
              >
                <Download size={13} className={exporting ? "ft-spin" : ""} />
                {exporting ? "Export…" : "Export classeur"}
              </button>
            </div>
          </div>
        </Card>

        {/* ── Filtres contextuels ────────────────────────────────────────── */}
        {(activeSheet === "DASHBOARD" || activeSheet === "CONSO_MENSUELLE") && (
          <div className="ft-fade" style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", padding: "12px 14px", background: FT.card, border: `1px solid ${FT.border}`, borderRadius: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 850, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".07em" }}>Statut</span>
            {(Object.keys(STATUS_META) as FuelStatusCode[]).map((s) => {
              const meta = STATUS_META[s];
              const c = toneColors(meta.tone);
              const active = status === s;
              return (
                <button
                  key={s}
                  onClick={() => {
                    setStatus(s);
                    setMonthlyPage(1);
                  }}
                  style={{
                    border: `1px solid ${active ? c.fg : FT.border}`,
                    background: active ? c.fg : FT.card,
                    color: active ? "white" : FT.textMid,
                    borderRadius: 999,
                    padding: "5px 11px",
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
          <div className="ft-fade" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "12px 14px", background: FT.card, border: `1px solid ${FT.border}`, borderRadius: 14 }}>
            <div style={{ color: FT.textSub, fontSize: 12, fontWeight: 700 }}>
              {journalQ.data?.summary.total_movements ?? 0} mouvement(s) · {fmtL(journalQ.data?.summary.total_quantity_added_liters ?? 0)}
            </div>
            <select
              value={operationType}
              onChange={(e) => {
                setOperationType(e.target.value);
                setJournalPage(1);
              }}
              style={{ height: 34, borderRadius: 9, border: `1px solid ${FT.border}`, background: "white", color: FT.text, padding: "0 10px", fontSize: 12, fontWeight: 800, outline: "none" }}
            >
              <option value="ALL">Tous types</option>
              <option value="TRUCK">TRUCK</option>
              <option value="TOTAL_CARD">TOTAL_CARD</option>
              <option value="PONCTION">PONCTION</option>
            </select>
          </div>
        )}

        {/* ── Contenu de la feuille active ───────────────────────────────── */}
        <div className="ft-fade">
          {activeSheet === "DASHBOARD" && <DashboardSheet rows={rows} kpis={kpis} loading={monthlyQ.isLoading} />}

          {activeSheet === "JOURNAL_RAVITAILLEMENT" && (
            <>
              <JournalSheet rows={journalRows} loading={journalQ.isLoading} monthlyRows={rows} />
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
              <ConsoMensuelleSheet rows={rows} loading={monthlyQ.isLoading} />
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

          {activeSheet === "STOCK_DEPOT" && <StockDepotSheet />}
          {activeSheet === "CPH" && <CphSheet data={cphMatrixQ.data?.data ?? []} loading={cphMatrixQ.isLoading} />}
          {activeSheet === "REF_SITES" && <RefSitesSheet rows={rows} loading={monthlyQ.isLoading} />}
          {activeSheet === "LISTES" && <ListesSheet />}
        </div>

        <Card style={{ background: FT.slateL }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "white", display: "grid", placeItems: "center", color: FT.gold, flexShrink: 0 }}>
              <Settings2 size={16} />
            </div>
            <div>
              <div style={{ color: FT.text, fontSize: 14, fontWeight: 850 }}>Périmètre V1</div>
              <div style={{ color: FT.textSub, fontSize: 12.5, lineHeight: 1.6, marginTop: 3 }}>
                Le module reprend toutes les feuilles du template. Les données eFMS, ENOC et Snowflake (RH) sont actives. Les champs stock réel/RMS,
                dépôt, jaugeage, cibles carburant et CPH complet restent visibles mais marqués "à venir".
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
