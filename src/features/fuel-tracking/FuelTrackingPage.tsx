// src/features/fuel-tracking/FuelTrackingPage.tsx

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  Download,
  Fuel,
  Gauge,
  Layers3,
  ListChecks,
  MapPin,
  RefreshCw,
  Search,
  Settings2,
  Upload,
  Warehouse,
} from "lucide-react";

import { exportFuelTrackingWorkbook, getCphMatrix, getFuelCommandeSynthese, getFuelEnocJournal, getFuelMonthlyTracking, getFuelSourceStatus, getFuelSyncRuns, importFuelCommandeSynthese } from "@/services/fuelTracking";

import { FT } from "./theme";
import { Card, GLOBAL_STYLES, Pager, Pill, SegmentedTabs } from "./ui";
import { currentMonth, fmtDateTime, fmtL } from "./helpers";
import { DashboardSheet } from "./sheets/DashboardSheet";
import { JournalSheet } from "./sheets/JournalSheet";
import { ConsoMensuelleSheet } from "./sheets/ConsoMensuelleSheet";
import { RefSitesSheet } from "./sheets/RefSitesSheet";
import { StockDepotSheet } from "./sheets/StockDepotSheet";
import { CphSheet, ListesSheet } from "./sheets/OtherSheets";

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

export default function FuelTrackingPage() {
  const [activeSheet, setActiveSheet] = useState<SheetKey>("CONSO_MENSUELLE");
  const [month, setMonth] = useState(currentMonth());
  const [site, setSite] = useState("");
  const [zone, setZone] = useState("");
  const [operationType, setOperationType] = useState("ALL");
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [journalPage, setJournalPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    setHeaderHeight(el.getBoundingClientRect().height);
    const ro = new ResizeObserver(() => {
      setHeaderHeight(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function changePageSize(n: number) {
    setPageSize(n);
    setMonthlyPage(1);
    setJournalPage(1);
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportFuelTrackingWorkbook({ month });
    } finally {
      setExporting(false);
    }
  }

  const queryClient = useQueryClient();

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const result = await importFuelCommandeSynthese(file);
      toast.success(`${result.rows_imported} lignes importées pour ${result.month_year}.`);
      setActiveSheet("DASHBOARD");
      setMonth(result.month_year);
      queryClient.invalidateQueries({ queryKey: ["fuel-commande-synthese"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Échec de l'import du fichier.");
    } finally {
      setImporting(false);
    }
  }

  const sourceStatusQ = useQuery({
    queryKey: ["fuel-source-status", month],
    queryFn: () => getFuelSourceStatus({ country: "Senegal", month }),
    staleTime: 60_000,
  });

  const monthlyQ = useQuery({
    queryKey: ["fuel-monthly-template", month, site, zone, monthlyPage, pageSize],
    queryFn: () => getFuelMonthlyTracking({ month, site, zone, page: monthlyPage, limit: pageSize }),
    staleTime: 60_000,
  });

  const journalQ = useQuery({
    queryKey: ["fuel-journal-template", month, site, zone, operationType, journalPage, pageSize],
    queryFn: () => getFuelEnocJournal({ month, site, zone, operation_type: operationType, page: journalPage, limit: pageSize }),
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

  const commandeSyntheseQ = useQuery({
    queryKey: ["fuel-commande-synthese", month],
    queryFn: () => getFuelCommandeSynthese({ month }),
    enabled: activeSheet === "DASHBOARD",
    staleTime: 60_000,
  });

  const rows = monthlyQ.data?.data ?? [];
  const journalRows = journalQ.data?.data ?? [];
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
        {/* ── En-tête (fixe) ──────────────────────────────────────────────── */}
        <div
          ref={headerRef}
          className="ft-fade"
          style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", border: `1px solid ${FT.border}`, borderRadius: FT.radius, boxShadow: FT.shadow, padding: "20px 24px" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, color: "#0f172a", fontSize: 22, lineHeight: 1.25, fontWeight: 900, letterSpacing: "-.03em" }}>
                {SHEETS.find((s) => s.key === activeSheet)?.label}
              </h1>
              <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>{sheetSubtitle}</p>
            </div>

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

              <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px", minWidth: 190 }}>
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

              <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px", minWidth: 140 }}>
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
                  commandeSyntheseQ.refetch();
                }}
                title="Rafraîchir"
                style={{ width: 33, height: 33, borderRadius: 9, border: `1px solid ${FT.border}`, background: FT.slateL, display: "grid", placeItems: "center", cursor: "pointer", color: FT.textMid, flexShrink: 0 }}
              >
                <RefreshCw size={14} className={monthlyQ.isFetching || journalQ.isFetching ? "ft-spin" : ""} />
              </button>

              <Pill
                label={sourceStatusQ.data?.efms.latest_month ? `eFMS jusqu'à ${sourceStatusQ.data.efms.latest_month}` : "eFMS indisponible"}
                tone={sourceStatusQ.data?.efms.available ? "green" : "red"}
              />
              <span title={`Dernière sync ENOC : ${fmtDateTime(enoc?.started_at)}`}>
                <Pill
                  label={sourceStatusQ.data?.enoc.latest_operation_date ? `ENOC ${sourceStatusQ.data.enoc.total_movements} mouvement(s)` : "ENOC indisponible"}
                  tone={sourceStatusQ.data?.enoc.available ? "green" : "red"}
                />
              </span>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsb,.xlsx,.xlsm"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleImportFile(file);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 14px",
                  borderRadius: 9,
                  border: `1px solid ${FT.border}`,
                  background: FT.card,
                  color: FT.text,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: importing ? "not-allowed" : "pointer",
                  opacity: importing ? 0.7 : 1,
                  flexShrink: 0,
                }}
              >
                <Upload size={13} className={importing ? "ft-spin" : ""} />
                {importing ? "Import…" : "Importer"}
              </button>

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
                  flexShrink: 0,
                }}
              >
                <Download size={13} className={exporting ? "ft-spin" : ""} />
                {exporting ? "Export…" : "Export classeur"}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${FT.border}`, display: "flex", justifyContent: "center" }}>
            <SegmentedTabs options={SHEETS} value={activeSheet} onChange={setActiveSheet} />
          </div>

          {activeSheet === "JOURNAL_RAVITAILLEMENT" && (
            <div className="ft-fade" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "12px 14px", background: FT.slateL, border: `1px solid ${FT.border}`, borderRadius: 14 }}>
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
        </div>

        {/* ── Contenu de la feuille active ───────────────────────────────── */}
        <div className="ft-fade">
          {activeSheet === "DASHBOARD" && <DashboardSheet data={commandeSyntheseQ.data} loading={commandeSyntheseQ.isLoading} />}

          {activeSheet === "JOURNAL_RAVITAILLEMENT" && (
            <>
              <JournalSheet rows={journalRows} loading={journalQ.isLoading} monthlyRows={rows} />
              {journalQ.data && (
                <Pager
                  page={journalQ.data.pagination.page}
                  totalPages={journalQ.data.pagination.totalPages}
                  hasPrev={journalQ.data.pagination.hasPrev}
                  hasNext={journalQ.data.pagination.hasNext}
                  onPrev={() => setJournalPage((p) => Math.max(1, p - 1))}
                  onNext={() => setJournalPage((p) => p + 1)}
                  pageSize={pageSize}
                  onPageSizeChange={changePageSize}
                />
              )}
            </>
          )}

          {activeSheet === "CONSO_MENSUELLE" && (
            <>
              <ConsoMensuelleSheet rows={rows} loading={monthlyQ.isLoading} stickyTop={headerHeight} />
              {monthlyQ.data && (
                <Pager
                  page={monthlyQ.data.pagination.page}
                  totalPages={monthlyQ.data.pagination.totalPages}
                  hasPrev={monthlyQ.data.pagination.hasPrev}
                  hasNext={monthlyQ.data.pagination.hasNext}
                  onPrev={() => setMonthlyPage((p) => Math.max(1, p - 1))}
                  onNext={() => setMonthlyPage((p) => p + 1)}
                  pageSize={pageSize}
                  onPageSizeChange={changePageSize}
                />
              )}
            </>
          )}

          {activeSheet === "STOCK_DEPOT" && (
            <>
              <StockDepotSheet rows={rows} loading={monthlyQ.isLoading} />
              {monthlyQ.data && (
                <Pager
                  page={monthlyQ.data.pagination.page}
                  totalPages={monthlyQ.data.pagination.totalPages}
                  hasPrev={monthlyQ.data.pagination.hasPrev}
                  hasNext={monthlyQ.data.pagination.hasNext}
                  onPrev={() => setMonthlyPage((p) => Math.max(1, p - 1))}
                  onNext={() => setMonthlyPage((p) => p + 1)}
                  pageSize={pageSize}
                  onPageSizeChange={changePageSize}
                />
              )}
            </>
          )}
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
