// src/features/sonatelBilling/StatusUpdateAdminPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Page d'import de mise à jour des statuts factures.
// • Upload du fichier facturation Sonatel (format standard).
// • Polling Celery → barre de progression.
// • Visualisation : résumé + tables non-trouvées / hors-site / erreurs.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { api } from "@/services/api";
import {
  Upload, FileUp, X, CheckCircle2, XCircle, AlertCircle,
  Loader2, ChevronDown, ChevronUp, Search, RefreshCw, Eye,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TargetStatus = "CREATED" | "VALIDATED" | "CONTESTED";

interface BatchPoll {
  id: number;
  task_id: string | null;
  task_status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILURE";
  task_progress: number;
  task_message: string;
  task_meta: TaskMeta | null;
  source_filename: string;
}

interface NotFoundRow {
  row: number;
  contrat: string;
  facture: string;
  date_debut: string;
  date_fin: string;
  target_status: string;
  reason: string;
}

interface NoSiteRow {
  row: number;
  contrat: string;
  facture: string;
  date_debut: string;
  date_fin: string;
  reason: string;
}

interface ErrorRow {
  row: number;
  error: string;
  raw?: { contrat?: string; facture?: string };
}

interface TaskMeta {
  total_rows?: number;
  updated?: number;
  not_found?: number;
  no_site?: number;
  errors?: number;
  default_status?: string;
  not_found_rows?: NotFoundRow[];
  no_site_rows?: NoSiteRow[];
  error_rows?: ErrorRow[];
  // progression partielle (en cours)
  rows_processed?: number;
}

// ─── Column detection ─────────────────────────────────────────────────────────

const _PAYMENT_NORMS = ["payee", "paye", "impayee", "hors scope", "annule", "annulee"];
const _CERT_NORMS    = ["validee", "valide", "contestee", "conteste", "creee", "cree",
                        "sites certif", "pas ok", "numero de contrat"];

function _normVal(v: string): string {
  return v.trim().toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

type ColType = "cert" | "payment" | "mixed" | "unknown";

interface DetectedCol {
  colName: string;
  type: ColType;
  valueCounts: Record<string, number>;
}

interface DetectedColumns {
  statut: DetectedCol | null;
  statutPaiement: DetectedCol | null;
}

function _classifyValues(valueCounts: Record<string, number>): ColType {
  let hasCert = false;
  let hasPayment = false;
  for (const v of Object.keys(valueCounts)) {
    const n = _normVal(v);
    if (_PAYMENT_NORMS.some(p => n.includes(p))) hasPayment = true;
    if (_CERT_NORMS.some(p => n.includes(p)))    hasCert = true;
  }
  if (hasCert && hasPayment) return "mixed";
  if (hasCert)    return "cert";
  if (hasPayment) return "payment";
  return "unknown";
}

function detectStatusColumns(preview: FilePreview): DetectedColumns {
  const result: DetectedColumns = { statut: null, statutPaiement: null };
  for (let ci = 0; ci < preview.headers.length; ci++) {
    const norm = _normVal(preview.headers[ci]);
    const isStatut = norm === "statut";
    const isStatutPay = norm === "statut paiement" || norm === "statut_paiement";
    if (!isStatut && !isStatutPay) continue;

    const valueCounts: Record<string, number> = {};
    for (const row of preview.rows) {
      const v = row[ci];
      if (v == null) continue;
      const s = String(v).trim();
      if (s) valueCounts[s] = (valueCounts[s] ?? 0) + 1;
    }

    const col: DetectedCol = {
      colName: preview.headers[ci],
      type: _classifyValues(valueCounts),
      valueCounts,
    };
    if (isStatut) result.statut = col;
    else result.statutPaiement = col;
  }
  return result;
}

// ─── File preview ─────────────────────────────────────────────────────────────

interface FilePreview {
  headers: string[];
  rows: (string | number | null)[][];
  total: number;
}

async function parseFilePreview(file: File): Promise<FilePreview> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    blankrows: false,
  }) as any;
  if (!raw.length) return { headers: [], rows: [], total: 0 };
  const headers = (raw[0] as any[]).map((h) => (h == null ? "" : String(h)));
  const dataRows = raw.slice(1).map((r: any[]) =>
    headers.map((_, ci) => {
      const v = r[ci];
      if (v == null) return null;
      if (v instanceof Date) return v.toLocaleDateString("fr-FR");
      return String(v);
    })
  );
  return { headers, rows: dataRows, total: dataRows.length };
}

function FilePreviewTable({ preview }: { preview: FilePreview }) {
  const PREVIEW_LIMIT = 30;
  const shown = preview.rows.slice(0, PREVIEW_LIMIT);

  return (
    <div style={{
      marginTop: 16, borderRadius: 14, border: "1.5px solid rgba(30,58,138,.12)",
      background: "rgba(248,250,252,1)", overflow: "hidden",
      animation: "fadeIn .2s ease",
    }}>
      {/* header bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", borderBottom: "1px solid rgba(30,58,138,.08)",
        background: "rgba(30,58,138,.04)",
      }}>
        <Eye size={13} color="#1e3a8a"/>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1e3a8a" }}>
          Aperçu du fichier
        </span>
        <span style={{
          marginLeft: "auto", fontSize: 11, color: "#94a3b8",
        }}>
          {preview.total} ligne{preview.total > 1 ? "s" : ""} détectée{preview.total > 1 ? "s" : ""}
          {preview.total > PREVIEW_LIMIT ? ` — affichage des ${PREVIEW_LIMIT} premières` : ""}
        </span>
      </div>

      {/* columns badge row */}
      <div style={{
        padding: "8px 14px", borderBottom: "1px solid rgba(0,0,0,.05)",
        display: "flex", gap: 6, flexWrap: "wrap",
      }}>
        {preview.headers.map((h, i) => (
          <span key={i} style={{
            padding: "2px 9px", borderRadius: 100, fontSize: 10.5, fontWeight: 600,
            background: "rgba(30,58,138,.08)", color: "#1e3a8a",
          }}>
            {h || `Col ${i + 1}`}
          </span>
        ))}
      </div>

      {/* table */}
      <div style={{ overflowX: "auto", maxHeight: 300 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(0,0,0,.07)" }}>
              <th style={{
                padding: "7px 10px", textAlign: "left",
                fontWeight: 700, color: "#94a3b8", fontSize: 10.5,
                position: "sticky", top: 0, background: "white",
                minWidth: 36,
              }}>
                #
              </th>
              {preview.headers.map((h, i) => (
                <th key={i} style={{
                  padding: "7px 10px", textAlign: "left",
                  fontWeight: 700, color: "#374151", fontSize: 10.5,
                  whiteSpace: "nowrap",
                  position: "sticky", top: 0, background: "white",
                }}>
                  {h || `Col ${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, ri) => (
              <tr key={ri} style={{
                borderBottom: "1px solid rgba(0,0,0,.04)",
                background: ri % 2 === 0 ? "white" : "rgba(248,250,252,.7)",
              }}>
                <td style={{ padding: "6px 10px", color: "#94a3b8", fontSize: 10.5 }}>
                  {ri + 1}
                </td>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: "6px 10px", color: cell == null ? "#cbd5e1" : "#0f172a",
                    fontStyle: cell == null ? "italic" : "normal",
                    whiteSpace: "nowrap", maxWidth: 200,
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Detected columns display ─────────────────────────────────────────────────

function DetectedColumnsInfo({ detected }: { detected: DetectedColumns }) {
  const { statut, statutPaiement } = detected;
  if (!statut && !statutPaiement) return null;

  const typeLabel: Record<ColType, { label: string; color: string; bg: string }> = {
    payment: { label: "Statut Paiement",      color: "#059669", bg: "rgba(5,150,105,.08)"  },
    cert:    { label: "Statut Certification", color: "#1e3a8a", bg: "rgba(30,58,138,.08)"  },
    mixed:   { label: "Types mixtes",         color: "#f59e0b", bg: "rgba(245,158,11,.08)" },
    unknown: { label: "Non classifié",        color: "#94a3b8", bg: "rgba(148,163,184,.08)"},
  };

  function ColBadge({ col }: { col: DetectedCol }) {
    const info = typeLabel[col.type];
    const topValues = Object.entries(col.valueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    return (
      <div style={{
        padding: "10px 14px", borderRadius: 12,
        background: info.bg, border: `1.5px solid ${info.color}33`,
        display: "flex", flexDirection: "column", gap: 6, flex: 1,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{
            padding: "2px 9px", borderRadius: 100,
            fontSize: 10.5, fontWeight: 700,
            background: info.color, color: "white",
          }}>
            {info.label}
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#0f172a" }}>
            ← {col.colName}
          </span>
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {topValues.map(([v, n]) => (
            <span key={v} style={{
              padding: "1px 8px", borderRadius: 100,
              fontSize: 10.5, fontWeight: 600,
              background: "rgba(255,255,255,.7)",
              border: `1px solid ${info.color}44`,
              color: "#374151",
            }}>
              {v} <span style={{ color: "#94a3b8" }}>×{n}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: 12, padding: "12px 14px", borderRadius: 12,
      background: "rgba(248,250,252,1)",
      border: "1.5px solid rgba(30,58,138,.1)",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#64748b",
        textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8,
      }}>
        Colonnes détectées
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {statut && <ColBadge col={statut}/>}
        {statutPaiement && <ColBadge col={statutPaiement}/>}
      </div>
    </div>
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function importStatusUpdate(
  file: File,
  targetStatus: TargetStatus,
): Promise<{ batch: BatchPoll; task_id: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("status", targetStatus);
  const { data } = await api.post(
    "/sonatel-billing/batches/import-status-update/",
    fd,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

async function pollBatch(batchId: number): Promise<BatchPoll> {
  const { data } = await api.get(
    `/sonatel-billing/batches/${batchId}/task-status/`,
  );
  return data;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  value, label, color, bg,
}: {
  value: number | string;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <div style={{
      padding: "14px 18px", borderRadius: 14,
      background: bg, border: `1px solid ${color}22`,
      minWidth: 110,
    }}>
      <div style={{
        fontSize: 24, fontWeight: 800, color,
        fontFamily: "'Outfit',sans-serif", lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color, opacity: .75, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function CollapsibleTable({
  title, rows, color, bg, columns, renderRow,
  searchable = true,
}: {
  title: string;
  rows: any[];
  color: string;
  bg: string;
  columns: string[];
  renderRow: (row: any, i: number) => React.ReactNode;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState("");

  const filtered = searchable && search
    ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
    : rows;

  if (!rows.length) return null;

  return (
    <div style={{
      background: "white", borderRadius: 16,
      border: `1.5px solid rgba(0,0,0,.07)`,
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,.04)",
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px", cursor: "pointer",
          background: bg, borderBottom: open ? `1px solid ${color}22` : "none",
          userSelect: "none",
        }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: "50%", background: color,
          flexShrink: 0,
        }}/>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", flex: 1 }}>
          {title}
        </span>
        <span style={{
          padding: "2px 9px", borderRadius: 100, fontSize: 11, fontWeight: 700,
          background: color, color: "white",
        }}>
          {rows.length}
        </span>
        {open ? <ChevronUp size={15} color="#94a3b8"/> : <ChevronDown size={15} color="#94a3b8"/>}
      </div>

      {open && (
        <>
          {searchable && rows.length > 5 && (
            <div style={{ padding: "10px 18px 0", display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
                <Search size={12} color="#94a3b8" style={{
                  position: "absolute", left: 9, top: "50%",
                  transform: "translateY(-50%)",
                }}/>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filtrer…"
                  style={{
                    width: "100%", padding: "6px 10px 6px 28px",
                    borderRadius: 9, border: "1.5px solid rgba(0,0,0,.09)",
                    fontSize: 12, outline: "none", boxSizing: "border-box",
                    color: "#0f172a", background: "rgba(248,250,252,1)",
                  }}
                />
              </div>
              {search && (
                <span style={{ fontSize: 11.5, color: "#94a3b8", alignSelf: "center" }}>
                  {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
          <div style={{ overflowX: "auto", padding: "0 0 4px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                  {columns.map(col => (
                    <th key={col} style={{
                      padding: "9px 14px", textAlign: "left",
                      fontWeight: 700, color: "#64748b",
                      fontSize: 11, whiteSpace: "nowrap",
                      background: "rgba(248,250,252,.7)",
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((row, i) => renderRow(row, i))}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <p style={{
                fontSize: 11.5, color: "#94a3b8", padding: "8px 14px",
                margin: 0, fontStyle: "italic",
              }}>
                … et {filtered.length - 200} ligne(s) supplémentaires. Exportez le batch pour tout voir.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, status }: { pct: number; status: string }) {
  const isRunning = status === "RUNNING" || status === "PENDING";
  const isSuccess = status === "SUCCESS";
  const isFailure = status === "FAILURE";

  const barColor = isFailure
    ? "#dc2626"
    : isSuccess
      ? "#059669"
      : "#1e3a8a";

  return (
    <div style={{ width: "100%" }}>
      <div style={{
        height: 6, borderRadius: 100, background: "rgba(0,0,0,.06)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 100,
          width: `${pct}%`,
          background: barColor,
          transition: "width .4s ease, background .3s",
          ...(isRunning && pct < 100 ? {
            backgroundImage: `linear-gradient(
              90deg, ${barColor}, ${barColor}aa, ${barColor}
            )`,
            backgroundSize: "200% 100%",
            animation: "shimmer 1.6s linear infinite",
          } : {}),
        }}/>
      </div>
    </div>
  );
}

// ─── File drop zone ───────────────────────────────────────────────────────────

function DropZone({
  file, onFile, disabled,
}: {
  file: File | null;
  onFile: (f: File) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault(); setDragging(false);
        if (!disabled && e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border: `2px dashed ${
          dragging ? "#1e3a8a"
          : file ? "rgba(5,150,105,.4)"
          : "rgba(30,58,138,.2)"
        }`,
        borderRadius: 14, padding: "24px 20px",
        textAlign: "center", cursor: disabled ? "not-allowed" : "pointer",
        background: dragging
          ? "rgba(30,58,138,.04)"
          : file ? "rgba(5,150,105,.03)"
          : "rgba(248,250,252,1)",
        transition: "all .18s",
        opacity: disabled ? .55 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        disabled={disabled}
        style={{ display: "none" }}
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <FileUp size={24} color={file ? "#059669" : "#94a3b8"} style={{ marginBottom: 8 }}/>
      {file ? (
        <>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#059669", margin: "0 0 2px" }}>
            {file.name}
          </p>
          <p style={{ fontSize: 11.5, color: "#94a3b8", margin: 0 }}>
            {(file.size / 1024).toFixed(1)} KB
          </p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 2px" }}>
            Glisser-déposer ou cliquer
          </p>
          <p style={{ fontSize: 11.5, color: "#94a3b8", margin: 0 }}>
            Fichier facturation Sonatel .xlsx / .xls
          </p>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StatusUpdateAdminPage() {
  const [file,          setFile]          = useState<File | null>(null);
  const [preview,       setPreview]       = useState<FilePreview | null>(null);
  const [previewErr,    setPreviewErr]    = useState<string | null>(null);
  const [detected,      setDetected]      = useState<DetectedColumns | null>(null);
  const [targetStatus,  setTargetStatus]  = useState<TargetStatus>("VALIDATED");
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [batch,         setBatch]         = useState<BatchPoll | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Polling ────────────────────────────────────────────────────────────────
  const poll = useCallback(async (batchId: number) => {
    try {
      const b = await pollBatch(batchId);
      setBatch(b);
      if (b.task_status === "RUNNING" || b.task_status === "PENDING") {
        pollRef.current = setTimeout(() => poll(batchId), 1500);
      }
    } catch { /* ignore poll errors */ }
  }, []);

  useEffect(() => () => {
    if (pollRef.current) clearTimeout(pollRef.current);
  }, []);

  // ── File selection with preview ────────────────────────────────────────────
  async function onFileSelected(f: File) {
    setFile(f);
    setBatch(null);
    setError(null);
    setPreview(null);
    setPreviewErr(null);
    setDetected(null);
    try {
      const p = await parseFilePreview(f);
      setPreview(p);
      setDetected(detectStatusColumns(p));
    } catch (e: any) {
      setPreviewErr(e?.message || "Impossible de lire le fichier.");
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function onSubmit() {
    if (!file) return;
    if (pollRef.current) clearTimeout(pollRef.current);
    setSubmitting(true);
    setError(null);
    setBatch(null);
    try {
      const { batch: b } = await importStatusUpdate(file, targetStatus);
      setBatch(b);
      // Démarrer le polling
      pollRef.current = setTimeout(() => poll(b.id), 800);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Erreur lors du lancement.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isRunning  = batch?.task_status === "RUNNING" || batch?.task_status === "PENDING";
  const isSuccess  = batch?.task_status === "SUCCESS";
  const isFailure  = batch?.task_status === "FAILURE";
  const meta       = batch?.task_meta ?? null;

  const STATUS_OPTIONS: { value: TargetStatus; label: string; color: string }[] = [
    { value: "VALIDATED",  label: "Validée",   color: "#059669" },
    { value: "CREATED",    label: "Créée",     color: "#1e3a8a" },
    { value: "CONTESTED",  label: "Contestée", color: "#dc2626" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <style>{`
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { from{background-position:200% 0} to{background-position:-200% 0} }
        @keyframes spin    { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg,#1e3a8a,#2d52b8)",
            display: "grid", placeItems: "center",
            boxShadow: "0 4px 14px rgba(30,58,138,.22)",
          }}>
            <Upload size={16} color="white"/>
          </div>
          <h1 style={{
            fontSize: 19, fontWeight: 800, color: "#0f172a",
            letterSpacing: "-.03em", margin: 0,
            fontFamily: "'Outfit',sans-serif",
          }}>
            Mise à jour des statuts
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Importez le fichier facturation Sonatel pour marquer les factures correspondantes.
          Les factures non trouvées en base sont listées pour analyse.
        </p>
      </div>

      {/* ── Form card ── */}
      <div style={{
        background: "white", borderRadius: 18,
        border: "1.5px solid rgba(0,0,0,.07)",
        padding: "20px 22px", marginBottom: 20,
        boxShadow: "0 1px 6px rgba(0,0,0,.04)",
      }}>
        <DropZone file={file} onFile={onFileSelected} disabled={isRunning || submitting}/>

        {/* Preview d'erreur de lecture */}
        {previewErr && (
          <div style={{
            marginTop: 12, padding: "9px 14px", borderRadius: 11,
            background: "rgba(220,38,38,.05)", border: "1px solid rgba(220,38,38,.15)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <XCircle size={13} color="#dc2626"/>
            <span style={{ fontSize: 12, color: "#dc2626" }}>
              Impossible de lire le fichier : {previewErr}
            </span>
          </div>
        )}

        {/* Aperçu des données */}
        {preview && !previewErr && <FilePreviewTable preview={preview}/>}

        {/* Colonnes détectées */}
        {detected && !previewErr && <DetectedColumnsInfo detected={detected}/>}

        {/* Statut cible (fallback) */}
        {(() => {
          const hasAutoDetect = detected?.statut != null || detected?.statutPaiement != null;
          const label = hasAutoDetect
            ? "Statut certification de secours"
            : "Statut de certification à appliquer";
          const hint = hasAutoDetect
            ? "Utilisé uniquement si la colonne « Statut » du fichier contient des valeurs de certification non reconnues."
            : "Aucune colonne « Statut » détectée — ce statut sera appliqué à toutes les factures trouvées.";
          return (
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 8 }}>
                {label}
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    disabled={isRunning || submitting}
                    onClick={() => setTargetStatus(opt.value)}
                    style={{
                      padding: "6px 16px", borderRadius: 100, border: "none",
                      cursor: isRunning || submitting ? "not-allowed" : "pointer",
                      fontSize: 12.5, fontWeight: 600, transition: "all .15s",
                      background: targetStatus === opt.value ? opt.color : "rgba(0,0,0,.05)",
                      color: targetStatus === opt.value ? "white" : "#64748b",
                      boxShadow: targetStatus === opt.value
                        ? `0 2px 8px ${opt.color}44` : "none",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11.5, color: "#94a3b8", margin: "6px 0 0" }}>
                {hint}
              </p>
            </div>
          );
        })()}

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 14, padding: "10px 14px", borderRadius: 11,
            background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.15)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <XCircle size={14} color="#dc2626"/>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#dc2626" }}>{error}</span>
          </div>
        )}

        {/* Submit */}
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          {file && !isRunning && (
            <button
              onClick={() => { setFile(null); setBatch(null); setError(null); setPreview(null); setPreviewErr(null); setDetected(null); }}
              style={{
                padding: "9px 16px", borderRadius: 11,
                border: "1.5px solid rgba(0,0,0,.1)", background: "white",
                fontSize: 12.5, fontWeight: 600, color: "#64748b", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <X size={13}/> Effacer
            </button>
          )}
          <button
            disabled={!file || isRunning || submitting}
            onClick={onSubmit}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 11, border: "none",
              background:
                !file || isRunning || submitting
                  ? "rgba(30,58,138,.25)"
                  : "linear-gradient(135deg,#1e3a8a,#2d52b8)",
              fontSize: 13, fontWeight: 600, color: "white",
              cursor: !file || isRunning || submitting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              boxShadow: !file || isRunning || submitting
                ? "none" : "0 3px 12px rgba(30,58,138,.22)",
            }}
          >
            {(submitting || isRunning) && (
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/>
            )}
            {submitting ? "Lancement…" : isRunning ? "Traitement en cours…" : "Lancer la mise à jour"}
          </button>
        </div>
      </div>

      {/* ── Progression ── */}
      {batch && (
        <div style={{
          background: "white", borderRadius: 18,
          border: "1.5px solid rgba(0,0,0,.07)",
          padding: "18px 22px", marginBottom: 20,
          boxShadow: "0 1px 6px rgba(0,0,0,.04)",
          animation: "fadeIn .25s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            {isSuccess && <CheckCircle2 size={17} color="#059669"/>}
            {isFailure && <XCircle size={17} color="#dc2626"/>}
            {isRunning && <Loader2 size={17} color="#1e3a8a" style={{ animation: "spin 1s linear infinite" }}/>}
            <div style={{ flex: 1 }}>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: isSuccess ? "#059669" : isFailure ? "#dc2626" : "#1e3a8a",
              }}>
                {batch.task_message || "…"}
              </span>
              <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>
                {batch.source_filename}
              </span>
            </div>
            {(isSuccess || isFailure) && (
              <button
                onClick={() => { setBatch(null); setFile(null); }}
                style={{
                  background: "rgba(0,0,0,.05)", border: "none",
                  borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                  fontSize: 11.5, fontWeight: 600, color: "#64748b",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <RefreshCw size={11}/> Nouvel import
              </button>
            )}
          </div>
          <ProgressBar pct={batch.task_progress} status={batch.task_status}/>

          {/* Progression partielle (en cours) */}
          {isRunning && meta?.rows_processed != null && (
            <div style={{
              marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap",
            }}>
              {[
                { label: "Lignes traitées", v: `${meta.rows_processed} / ${meta.total_rows ?? "?"}` },
                { label: "Mises à jour", v: meta.updated ?? 0 },
                { label: "Non trouvées", v: meta.not_found ?? 0 },
                { label: "Hors site", v: meta.no_site ?? 0 },
                { label: "Erreurs", v: meta.errors ?? 0 },
              ].map(s => (
                <div key={s.label}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{s.label} </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{s.v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Résultats (après SUCCESS) ── */}
      {isSuccess && meta && (
        <div style={{ animation: "fadeIn .3s ease" }}>

          {/* Summary cards */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            <StatCard
              value={meta.updated ?? 0}
              label="Mises à jour"
              color="#059669"
              bg="rgba(5,150,105,.07)"
            />
            <StatCard
              value={meta.not_found ?? 0}
              label="Non trouvées en base"
              color="#f59e0b"
              bg="rgba(245,158,11,.07)"
            />
            <StatCard
              value={meta.no_site ?? 0}
              label="Contrat hors site"
              color="#0891b2"
              bg="rgba(8,145,178,.07)"
            />
            <StatCard
              value={meta.errors ?? 0}
              label="Erreurs de parsing"
              color="#dc2626"
              bg="rgba(220,38,38,.07)"
            />
            <StatCard
              value={meta.total_rows ?? 0}
              label="Total lignes fichier"
              color="#6366f1"
              bg="rgba(99,102,241,.07)"
            />
          </div>

          {/* Note d'explication */}
          {(meta.not_found ?? 0) > 0 && (
            <div style={{
              padding: "12px 16px", borderRadius: 12, marginBottom: 16,
              background: "rgba(245,158,11,.06)",
              border: "1px solid rgba(245,158,11,.2)",
              display: "flex", gap: 10, alignItems: "flex-start",
            }}>
              <AlertCircle size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }}/>
              <div>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: "#92400e", margin: "0 0 2px" }}>
                  {meta.not_found} facture(s) du fichier sont absentes de la base.
                </p>
                <p style={{ fontSize: 12, color: "#b45309", margin: 0 }}>
                  Ces lignes n'ont pas pu être mises à jour.
                  Lancez d'abord un import standard pour les créer, puis relancez la mise à jour de statut.
                </p>
              </div>
            </div>
          )}

          {/* Table : Non trouvées */}
          <CollapsibleTable
            title="Factures non trouvées en base"
            rows={meta.not_found_rows ?? []}
            color="#f59e0b"
            bg="rgba(245,158,11,.04)"
            columns={["#", "Contrat", "N° Facture", "Début période", "Fin période", "Statut cible", "Raison"]}
            renderRow={(row: NotFoundRow, i) => (
              <tr key={i} style={{
                borderBottom: "1px solid rgba(0,0,0,.04)",
                background: i % 2 === 0 ? "white" : "rgba(248,250,252,.6)",
              }}>
                <td style={{ padding: "8px 14px", color: "#94a3b8", fontSize: 11 }}>{row.row}</td>
                <td style={{ padding: "8px 14px", fontWeight: 600, color: "#0f172a" }}>{row.contrat}</td>
                <td style={{ padding: "8px 14px", color: "#374151" }}>{row.facture}</td>
                <td style={{ padding: "8px 14px", color: "#64748b", whiteSpace: "nowrap" }}>
                  {row.date_debut?.slice(0, 10)}
                </td>
                <td style={{ padding: "8px 14px", color: "#64748b", whiteSpace: "nowrap" }}>
                  {row.date_fin?.slice(0, 10)}
                </td>
                <td style={{ padding: "8px 14px" }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 100, fontSize: 10.5, fontWeight: 700,
                    background:
                      row.target_status === "VALIDATED" ? "rgba(5,150,105,.1)"
                      : row.target_status === "CONTESTED" ? "rgba(220,38,38,.1)"
                      : "rgba(30,58,138,.1)",
                    color:
                      row.target_status === "VALIDATED" ? "#059669"
                      : row.target_status === "CONTESTED" ? "#dc2626"
                      : "#1e3a8a",
                  }}>
                    {row.target_status}
                  </span>
                </td>
                <td style={{ padding: "8px 14px", fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}>
                  {row.reason}
                </td>
              </tr>
            )}
          />

          {/* Table : Hors site */}
          <div style={{ marginTop: 14 }}>
            <CollapsibleTable
              title="Contrats non liés à un site Aktivco"
              rows={meta.no_site_rows ?? []}
              color="#0891b2"
              bg="rgba(8,145,178,.04)"
              columns={["#", "Contrat", "N° Facture", "Début période", "Fin période", "Raison"]}
              renderRow={(row: NoSiteRow, i) => (
                <tr key={i} style={{
                  borderBottom: "1px solid rgba(0,0,0,.04)",
                  background: i % 2 === 0 ? "white" : "rgba(248,250,252,.6)",
                }}>
                  <td style={{ padding: "8px 14px", color: "#94a3b8", fontSize: 11 }}>{row.row}</td>
                  <td style={{ padding: "8px 14px", fontWeight: 600, color: "#0f172a" }}>{row.contrat}</td>
                  <td style={{ padding: "8px 14px", color: "#374151" }}>{row.facture}</td>
                  <td style={{ padding: "8px 14px", color: "#64748b", whiteSpace: "nowrap" }}>
                    {row.date_debut?.slice(0, 10)}
                  </td>
                  <td style={{ padding: "8px 14px", color: "#64748b", whiteSpace: "nowrap" }}>
                    {row.date_fin?.slice(0, 10)}
                  </td>
                  <td style={{ padding: "8px 14px", fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}>
                    {row.reason}
                  </td>
                </tr>
              )}
            />
          </div>

          {/* Table : Erreurs */}
          <div style={{ marginTop: 14 }}>
            <CollapsibleTable
              title="Erreurs de parsing"
              rows={meta.error_rows ?? []}
              color="#dc2626"
              bg="rgba(220,38,38,.04)"
              searchable={false}
              columns={["#", "Contrat", "N° Facture", "Erreur"]}
              renderRow={(row: ErrorRow, i) => (
                <tr key={i} style={{
                  borderBottom: "1px solid rgba(0,0,0,.04)",
                  background: i % 2 === 0 ? "white" : "rgba(248,250,252,.6)",
                }}>
                  <td style={{ padding: "8px 14px", color: "#94a3b8", fontSize: 11 }}>{row.row}</td>
                  <td style={{ padding: "8px 14px", color: "#374151" }}>{row.raw?.contrat ?? "—"}</td>
                  <td style={{ padding: "8px 14px", color: "#374151" }}>{row.raw?.facture ?? "—"}</td>
                  <td style={{
                    padding: "8px 14px", fontSize: 12, color: "#dc2626",
                    fontFamily: "monospace",
                  }}>
                    {row.error}
                  </td>
                </tr>
              )}
            />
          </div>
        </div>
      )}

      {/* ── Failure detail ── */}
      {isFailure && batch?.task_meta && (
        <div style={{
          background: "rgba(220,38,38,.04)", borderRadius: 14,
          border: "1px solid rgba(220,38,38,.15)",
          padding: "16px 18px", animation: "fadeIn .25s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <XCircle size={15} color="#dc2626"/>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
              Erreur lors de l'exécution de la tâche
            </span>
          </div>
          <pre style={{
            fontSize: 11, color: "#7f1d1d",
            background: "rgba(220,38,38,.04)", borderRadius: 8,
            padding: "10px 12px", overflowX: "auto",
            margin: 0, maxHeight: 200, whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}>
            {(batch.task_meta as any).traceback ?? batch.task_message}
          </pre>
        </div>
      )}
    </div>
  );
}