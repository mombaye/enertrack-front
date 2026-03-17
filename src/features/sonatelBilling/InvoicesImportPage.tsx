// src/pages/InvoicesImportPage.tsx
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  UploadCloud, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, Clock, FileSpreadsheet, ChevronDown,
  ChevronUp, Loader2, Info, X,
} from "lucide-react";
import { DataTable, Col } from "@/components/DataTable";
import { cn } from "@/features/sonatelBilling/ui";
import { SeverityPill } from "./admin/ui";
import {
  getBatchIssues, listBatches, startImportInvoices, pollImportStatus,
  ImportBatch, ImportIssue, ImportResult, TaskStatus,
} from "./admin/importApi";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat("fr-FR");

function fmtRelative(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffS = Math.round(diffMs / 1000);
  if (diffS < 5) return "à l'instant";
  if (diffS < 60) return `il y a ${diffS}s`;
  const diffM = Math.round(diffS / 60);
  if (diffM < 60) return `il y a ${diffM} min`;
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = {
    PENDING:  { label: "En attente",  color: "#f59e0b", bg: "#fef3c7", Icon: Clock        },
    RUNNING:  { label: "En cours",    color: "#3b82f6", bg: "#eff6ff", Icon: Loader2      },
    SUCCESS:  { label: "Terminé",     color: "#10b981", bg: "#ecfdf5", Icon: CheckCircle2 },
    FAILURE:  { label: "Échec",       color: "#ef4444", bg: "#fef2f2", Icon: XCircle      },
  }[status];

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 99,
      background: cfg.bg, color: cfg.color,
      fontSize: 12, fontWeight: 700,
    }}>
      <cfg.Icon
        size={12}
        style={{ animation: status === "RUNNING" ? "spin 1s linear infinite" : "none" }}
      />
      {cfg.label}
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({
  progress, status, message,
}: { progress: number; status: TaskStatus; message: string }) {
  const color = status === "FAILURE" ? "#ef4444" : status === "SUCCESS" ? "#10b981" : "#3b82f6";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#64748b", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {message || "…"}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0, marginLeft: 12 }}>
          {progress}%
        </span>
      </div>
      <div style={{ height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${progress}%`,
          background: `linear-gradient(90deg, ${color}, ${color}bb)`,
          borderRadius: 99,
          transition: "width .4s ease",
          position: "relative",
          overflow: "hidden",
        }}>
          {status === "RUNNING" && (
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,.3) 50%, transparent 100%)",
              animation: "shimmerBar 1.4s ease infinite",
            }}/>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stat mini card ───────────────────────────────────────────────────────────
function Stat({ label, value, accent = "#1e3a8a" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{
      background: "white", borderRadius: 14, padding: "14px 16px",
      border: "1px solid rgba(15,23,42,.07)",
      boxShadow: "0 1px 4px rgba(15,23,42,.05)",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent, fontFamily: "'Syne', sans-serif" }}>
        {typeof value === "number" ? fmt.format(value) : value}
      </div>
    </div>
  );
}

// ─── Active import tracker (polling) ─────────────────────────────────────────
function ActiveImportPanel({
  batchId,
  onDone,
}: { batchId: number; onDone: (batch: ImportBatch) => void }) {
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const stop = pollImportStatus(batchId, (b) => {
      setBatch(b);
      if (b.task_status === "SUCCESS" || b.task_status === "FAILURE") {
        onDone(b);
        stop();
      }
    });
    stopRef.current = stop;
    return () => stop();
  }, [batchId]);

  if (!batch) return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#94a3b8", fontSize: 13 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }}/>
      Connexion au suivi…
    </div>
  );

  const meta = batch.task_meta as (ImportResult & { rows_processed?: number; total_rows?: number }) | null;

  return (
    <div style={{
      background: "#f8faff", borderRadius: 16,
      border: "1.5px solid rgba(59,130,246,.2)",
      padding: "18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileSpreadsheet size={15} color="#3b82f6"/>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#1e40af" }}>
            {batch.source_filename}
          </span>
        </div>
        <StatusBadge status={batch.task_status}/>
      </div>

      <ProgressBar
        progress={batch.task_progress}
        status={batch.task_status}
        message={batch.task_message}
      />

      {/* Stats temps réel */}
      {meta && (batch.task_status === "RUNNING" || batch.task_status === "SUCCESS") && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginTop: 14 }}>
          {meta.total_rows && (
            <Stat label="Lignes" value={`${meta.rows_processed ?? 0} / ${meta.total_rows}`} accent="#3b82f6"/>
          )}
          <Stat label="Créées" value={meta.created ?? meta.rows_created ?? 0} accent="#10b981"/>
          <Stat label="Mises à jour" value={meta.updated ?? meta.rows_updated ?? 0} accent="#0891b2"/>
          <Stat label="Issues" value={meta.issues ?? meta.issues_logged ?? 0} accent={meta.issues_logged ? "#f59e0b" : "#94a3b8"}/>
          {(meta.invoices_missing_site_count ?? meta.missing_site ?? 0) > 0 && (
            <Stat label="Sans site" value={meta.invoices_missing_site_count ?? meta.missing_site ?? 0} accent="#ef4444"/>
          )}
        </div>
      )}

      {/* Erreur */}
      {batch.task_status === "FAILURE" && (
        <div style={{
          marginTop: 12, padding: "10px 14px", borderRadius: 10,
          background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626",
          fontSize: 12, fontFamily: "monospace",
        }}>
          {batch.task_message}
        </div>
      )}
    </div>
  );
}

// ─── Batch history row ────────────────────────────────────────────────────────
function BatchRow({
  batch,
  isSelected,
  onClick,
}: { batch: ImportBatch; isSelected: boolean; onClick: () => void }) {
  const meta = batch.task_meta as ImportResult | null;

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        padding: "10px 14px", borderRadius: 10, textAlign: "left",
        background: isSelected ? "rgba(30,58,138,.06)" : "none",
        border: `1px solid ${isSelected ? "rgba(30,58,138,.2)" : "transparent"}`,
        cursor: "pointer", transition: "all .12s",
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "#f8faff";
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "none";
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {batch.source_filename}
          </span>
          <StatusBadge status={batch.task_status}/>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>
          {new Date(batch.imported_at).toLocaleString("fr-FR")}
          {meta?.rows_created !== undefined && (
            <span style={{ marginLeft: 8, color: "#64748b" }}>
              +{fmt.format(meta.rows_created)} / ↺{fmt.format(meta.rows_updated)}
            </span>
          )}
        </div>
      </div>
      {isSelected ? <ChevronUp size={14} color="#1e3a8a"/> : <ChevronDown size={14} color="#94a3b8"/>}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InvoicesImportPage() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [echeance, setEcheance] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  // Batch actif en cours de traitement
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null);
  const [doneBatch, setDoneBatch] = useState<ImportBatch | null>(null);

  // Batch sélectionné pour voir ses issues
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [severity, setSeverity] = useState<string>("");

  const batchesQ = useQuery({
    queryKey: ["sb-batches", { kind: "SENELEC_INVOICE" }],
    queryFn: () => listBatches({ kind: "SENELEC_INVOICE", page: 1, page_size: 30 }),
    refetchInterval: activeBatchId ? 5000 : false,
  });

  const issuesQ = useQuery({
    enabled: !!selectedBatchId,
    queryKey: ["sb-batch-issues", selectedBatchId, severity],
    queryFn: () => getBatchIssues(selectedBatchId!, severity ? { severity } : undefined),
  });

  const issuesCounts = useMemo(() => {
    const issues = issuesQ.data ?? [];
    return {
      ERROR: issues.filter(i => i.severity === "ERROR").length,
      WARN:  issues.filter(i => i.severity === "WARN").length,
      INFO:  issues.filter(i => i.severity === "INFO").length,
    };
  }, [issuesQ.data]);

  const handleImport = async () => {
    if (!file || !echeance) return;
    setIsUploading(true);
    setDoneBatch(null);
    try {
      const { batch } = await startImportInvoices(file, echeance);
      setActiveBatchId(batch.id);
      setSelectedBatchId(batch.id);
      toast.info(`Import démarré — batch #${batch.id}`);
      qc.invalidateQueries({ queryKey: ["sb-batches"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Impossible de lancer l'import");
    } finally {
      setIsUploading(false);
    }
  };

  const handleImportDone = useCallback((batch: ImportBatch) => {
    setDoneBatch(batch);
    setActiveBatchId(null);
    qc.invalidateQueries({ queryKey: ["sb-batches"] });
    qc.invalidateQueries({ queryKey: ["sb-invoices"] });
    qc.invalidateQueries({ queryKey: ["sb-monthly"] });
    qc.invalidateQueries({ queryKey: ["sb-contract-months"] });
    if (batch.task_status === "SUCCESS") {
      const meta = batch.task_meta as ImportResult | null;
      toast.success(
        `Import terminé — +${fmt.format(meta?.rows_created ?? 0)} / ↺${fmt.format(meta?.rows_updated ?? 0)} · ${fmt.format(meta?.issues_logged ?? 0)} issues`
      );
    } else {
      toast.error("L'import a échoué. Voir les détails ci-dessous.");
    }
  }, [qc]);

  const isReady = !!file && !!echeance && !isUploading && !activeBatchId;
  const lastBatches = batchesQ.data?.results ?? [];
  const issues = issuesQ.data ?? [];

  const issueCols: Col<ImportIssue>[] = useMemo(() => [
    { key: "sev",   title: "Niveau",  render: (r) => <SeverityPill v={r.severity}/> },
    { key: "row",   title: "Ligne",   render: (r) => r.row_number ?? "—", className: "whitespace-nowrap font-semibold" },
    { key: "field", title: "Champ",   render: (r) => r.field || "—",     className: "whitespace-nowrap" },
    { key: "msg",   title: "Message", render: (r) => <span className="text-xs">{r.message}</span> },
  ], []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmerBar {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── Upload card ───────────────────────────────────────────────────── */}
        <div style={{
          background: "white", borderRadius: 20,
          border: "1px solid rgba(15,23,42,.07)",
          boxShadow: "0 1px 3px rgba(15,23,42,.04), 0 8px 32px rgba(15,23,42,.05)",
          overflow: "hidden", position: "relative",
        }}>
          {/* Top accent bar */}
          <div style={{
            height: 3,
            background: "linear-gradient(90deg, #1e3a8a, #3b82f6, #0891b2)",
            position: "absolute", top: 0, left: 0, right: 0,
          }}/>

          <div style={{ padding: "24px 28px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0,
                }}>
                  Import Factures Sonatel
                </h2>
                <p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                  L'import est traité en arrière-plan — la progression s'affiche en temps réel.
                </p>
              </div>
              <button
                onClick={() => batchesQ.refetch()}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 10,
                  border: "1px solid rgba(15,23,42,.1)", background: "white",
                  fontSize: 12, fontWeight: 600, color: "#64748b", cursor: "pointer",
                }}
              >
                <RefreshCw size={13}/> Rafraîchir
              </button>
            </div>

            {/* Form */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 200px auto", gap: 12, alignItems: "end" }}>
              {/* File picker */}
              <label style={{
                display: "flex", flexDirection: "column", gap: 6,
                padding: "12px 16px", borderRadius: 12,
                border: `2px dashed ${file ? "#3b82f6" : "rgba(15,23,42,.12)"}`,
                background: file ? "rgba(59,130,246,.04)" : "#fafafa",
                cursor: "pointer", transition: "all .15s",
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Fichier Excel
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileSpreadsheet size={18} color={file ? "#3b82f6" : "#cbd5e1"}/>
                  <span style={{ fontSize: 13, color: file ? "#1e40af" : "#94a3b8", fontWeight: file ? 600 : 400 }}>
                    {file ? file.name : "Cliquer pour sélectionner…"}
                  </span>
                  {file && (
                    <button
                      onClick={e => { e.preventDefault(); setFile(null); }}
                      style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "grid", placeItems: "center" }}
                    >
                      <X size={13}/>
                    </button>
                  )}
                </div>
                <input
                  type="file" accept=".xlsx,.xls"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />
              </label>

              {/* Date échéance */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Date d'échéance
                </span>
                <input
                  type="date" value={echeance}
                  onChange={e => setEcheance(e.target.value)}
                  style={{
                    padding: "10px 12px", borderRadius: 10,
                    border: "1.5px solid rgba(15,23,42,.12)",
                    fontSize: 13, color: "#334155", outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Submit */}
              <button
                disabled={!isReady}
                onClick={handleImport}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "11px 24px", borderRadius: 12,
                  background: isReady ? "#1e3a8a" : "#94a3b8",
                  color: "white", border: "none",
                  fontSize: 13, fontWeight: 700, cursor: isReady ? "pointer" : "not-allowed",
                  boxShadow: isReady ? "0 4px 14px rgba(30,58,138,.3)" : "none",
                  transition: "all .15s", whiteSpace: "nowrap",
                  fontFamily: "inherit",
                }}
              >
                {isUploading ? (
                  <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> Envoi…</>
                ) : activeBatchId ? (
                  <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> En cours</>
                ) : (
                  <><UploadCloud size={15}/> Importer</>
                )}
              </button>
            </div>

            {/* Active import progress */}
            {activeBatchId && (
              <div style={{ marginTop: 16, animation: "fadeUp .3s ease both" }}>
                <ActiveImportPanel
                  batchId={activeBatchId}
                  onDone={handleImportDone}
                />
              </div>
            )}

            {/* Résultat final */}
            {doneBatch && !activeBatchId && (
              <div style={{ marginTop: 16, animation: "fadeUp .3s ease both" }}>
                {doneBatch.task_status === "SUCCESS" ? (
                  <div style={{
                    padding: "16px 20px", borderRadius: 14,
                    background: "#ecfdf5", border: "1.5px solid #6ee7b7",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <CheckCircle2 size={16} color="#10b981"/>
                      <span style={{ fontWeight: 700, color: "#065f46", fontSize: 14 }}>Import terminé avec succès</span>
                    </div>
                    {(() => {
                      const m = doneBatch.task_meta as ImportResult | null;
                      if (!m) return null;
                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                          <Stat label="Créées"      value={m.rows_created}               accent="#10b981"/>
                          <Stat label="Mises à jour" value={m.rows_updated}              accent="#0891b2"/>
                          <Stat label="Monthly"     value={m.monthly_rows_created}       accent="#1e3a8a"/>
                          <Stat label="Issues"      value={m.issues_logged}              accent={m.issues_logged ? "#f59e0b" : "#94a3b8"}/>
                          <Stat label="Sans site"   value={m.invoices_missing_site_count} accent={m.invoices_missing_site_count ? "#ef4444" : "#94a3b8"}/>
                          <Stat label="CM upsert"   value={m.contract_months_upserted}   accent="#7c3aed"/>
                        </div>
                      );
                    })()}
                    {(() => {
                      const m = doneBatch.task_meta as ImportResult | null;
                      if (!m?.invoices_missing_site_count) return null;
                      return (
                        <div style={{
                          marginTop: 10, padding: "8px 12px", borderRadius: 8,
                          background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e",
                          fontSize: 12,
                        }}>
                          <strong>Contrats sans site:</strong>{" "}
                          {m.invoices_missing_site_sample?.join(", ")}
                          {(m.invoices_missing_site_count ?? 0) > 20 && ` …et ${m.invoices_missing_site_count - 20} autres`}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div style={{
                    padding: "14px 18px", borderRadius: 14,
                    background: "#fef2f2", border: "1.5px solid #fca5a5",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <XCircle size={16} color="#ef4444"/>
                      <span style={{ fontWeight: 700, color: "#dc2626", fontSize: 14 }}>Import échoué</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#7f1d1d", margin: 0, fontFamily: "monospace" }}>
                      {doneBatch.task_message}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Historique + Issues ───────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, alignItems: "start" }}>

          {/* Historique batches */}
          <div style={{
            background: "white", borderRadius: 18,
            border: "1px solid rgba(15,23,42,.07)",
            boxShadow: "0 1px 3px rgba(15,23,42,.04)",
            padding: "18px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Historique
              </h3>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{lastBatches.length} imports</span>
            </div>

            {batchesQ.isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} style={{ height: 56, borderRadius: 10, background: "#f1f5f9", animation: "shimmerBar 1.5s infinite" }}/>
                ))}
              </div>
            ) : lastBatches.length === 0 ? (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>
                Aucun import
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {lastBatches.map(b => (
                  <BatchRow
                    key={b.id}
                    batch={b}
                    isSelected={selectedBatchId === b.id}
                    onClick={() => setSelectedBatchId(selectedBatchId === b.id ? null : b.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Issues */}
          <div style={{
            background: "white", borderRadius: 18,
            border: "1px solid rgba(15,23,42,.07)",
            boxShadow: "0 1px 3px rgba(15,23,42,.04)",
            padding: "18px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0, flex: 1 }}>
                Issues {selectedBatchId ? `— batch #${selectedBatchId}` : ""}
              </h3>

              {/* Severity count badges */}
              {issuesQ.data && (
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { k: "ERROR", color: "#ef4444", bg: "#fef2f2" },
                    { k: "WARN",  color: "#f59e0b", bg: "#fef3c7" },
                    { k: "INFO",  color: "#3b82f6", bg: "#eff6ff" },
                  ].map(({ k, color, bg }) => (
                    <span key={k} style={{
                      padding: "2px 8px", borderRadius: 99,
                      background: bg, color, fontSize: 11, fontWeight: 700,
                    }}>
                      {issuesCounts[k as keyof typeof issuesCounts]} {k}
                    </span>
                  ))}
                </div>
              )}

              <select
                value={severity}
                onChange={e => setSeverity(e.target.value)}
                style={{
                  padding: "6px 12px", borderRadius: 8,
                  border: "1px solid rgba(15,23,42,.12)", fontSize: 12,
                  background: "white", color: "#334155", fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                <option value="">Tous</option>
                <option value="ERROR">ERROR</option>
                <option value="WARN">WARN</option>
                <option value="INFO">INFO</option>
              </select>
            </div>

            <DataTable
              cols={issueCols}
              rows={issues}
              loading={issuesQ.isLoading}
              emptyText={selectedBatchId ? "Aucune issue pour ce batch 🎉" : "Sélectionnez un batch pour voir ses issues"}
            />
          </div>
        </div>
      </div>
    </>
  );
}