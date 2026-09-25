// src/features/estimation/EstimationPage.tsx

import { useMemo, useState, useEffect, useRef } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  Calculator, Play, RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, AlertTriangle, Download,
  Zap, Server, BarChart3, HelpCircle, Loader2,
  TrendingUp, Activity,
  Upload, ArrowLeftRight, FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "@/services/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import {
  EstimationBatch, EstimationResult,
  fetchBatches, fetchBatchStatus, fetchResults,
  HistoryImportResult, importEstimationHistory, launchBatch,
  ExternalImportResult, CompareData, importExternalEstimation, fetchComparison,
} from '@/features/estimation/api'




// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const fmtM = (v: string | number | null) => {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${fmt.format(Math.round(n / 1_000_000))} M`;
  if (Math.abs(n) >= 1_000) return `${fmt.format(Math.round(n / 1_000))} k`;
  return fmt.format(Math.round(n));
};
const money = (v: string | number | null) =>
  v === null || v === undefined || Number(v) === 0 ? "—" : `${fmt.format(Math.round(Number(v)))} F`;

function getMonthName(month: number) {
  return new Date(2024, month - 1, 1).toLocaleString("fr-FR", { month: "long" });
}

// ─── Source config ────────────────────────────────────────────────────────────
const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  ACM:        { label: "ACM",        color: "#059669", bg: "#f0fdf4", border: "#bbf7d0", icon: <Zap size={11}/> },
  GRID:       { label: "Grid",       color: "#0891b2", bg: "#f0f9ff", border: "#bae6fd", icon: <Server size={11}/> },
  HISTO:      { label: "Historique", color: "#7c3aed", bg: "#faf5ff", border: "#ddd6fe", icon: <BarChart3 size={11}/> },
  NC:         { label: "NC",         color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: <XCircle size={11}/> },
  HORS_SCOPE: { label: "Hors scope", color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0", icon: <HelpCircle size={11}/> },
  THEORIQUE:  { label: "Théorique",  color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: <Calculator size={11}/> },
  TARGET:     { label: "Target",     color: "#1e3a8a", bg: "#eff6ff", border: "#bfdbfe", icon: <TrendingUp size={11}/> },
};

function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG["NC"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 6, padding: "2px 8px",
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: EstimationBatch["status"] }) {
  const map = {
    PENDING: { label: "En attente", color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: <Clock size={11}/> },
    RUNNING: { label: "En cours",   color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", icon: <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }}/> },
    DONE:    { label: "Terminé",    color: "#059669", bg: "#f0fdf4", border: "#bbf7d0", icon: <CheckCircle2 size={11}/> },
    FAILED:  { label: "Échoué",     color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: <XCircle size={11}/> },
  };
  const cfg = map[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 6, padding: "2px 8px",
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── Fiabilité badge ──────────────────────────────────────────────────────────
function FiabBadge({ v }: { v: string }) {
  const map: Record<string, { label: string; color: string }> = {
    CORRECT:     { label: "✓ Correct",    color: "#059669" },
    NOT_CORRECT: { label: "✗ Incorrect",  color: "#dc2626" },
    MISSING:     { label: "Manquant",     color: "#d97706" },
    NA:          { label: "—",            color: "#94a3b8" },
  };
  const cfg = map[v] ?? { label: v, color: "#94a3b8" };
  return <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>;
}

// ─── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ done, total, color }: { done: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min((done / total) * 100, 100) : 0;
  return (
    <div style={{ height: 4, background: "#f1f5f9", borderRadius: 99, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width .4s" }}/>
    </div>
  );
}

// ─── Source donut (mini bars) ─────────────────────────────────────────────────
function SourceBreakdown({ batch }: { batch: EstimationBatch }) {
  const total = batch.total || 1;
  const sources = [
    { key: "count_acm",   label: "ACM",   color: "#059669", value: batch.count_acm },
    { key: "count_grid",  label: "Grid",  color: "#0891b2", value: batch.count_grid },
    { key: "count_histo", label: "Histo", color: "#7c3aed", value: batch.count_histo },
    { key: "count_nc",    label: "NC",    color: "#dc2626", value: batch.count_nc },
  ];
  return (
    <div style={{ display: "flex", gap: 3, height: 6, borderRadius: 99, overflow: "hidden", flex: 1 }}>
      {sources.map(s => (
        <div
          key={s.key}
          title={`${s.label}: ${s.value}`}
          style={{
            flex: s.value / total,
            background: s.color,
            minWidth: s.value > 0 ? 3 : 0,
            transition: "flex .4s",
          }}
        />
      ))}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportResults(results: EstimationResult[], batch: EstimationBatch) {
  const rows = results.map(r => ({
    "Site ID":           r.site_id,
    "Site Nom":          r.site_name,
    "N° Contrat":        r.numero_compte_contrat,
    "Source":            r.source_utilisee,
    "Conso estimée (kWh)": Number(r.conso_estimee_kwh) || "",
    "Montant estimé (FCFA)": Number(r.montant_estime) || "",
    "NRJ (FCFA)":        Number(r.montant_nrj) || "",
    "Abonnement (FCFA)": Number(r.montant_abonnement) || "",
    "Redevance (FCFA)":  Number(r.montant_redevance) || "",
    "TCO (FCFA)":        Number(r.montant_tco) || "",
    "ACM dispo":         r.acm_disponible ? "Oui" : "Non",
    "Grid dispo":        r.grid_disponible ? "Oui" : "Non",
    "Fiabilité Grid":    r.fiabilite_grid,
    "Ratio kWh/kVAh":    r.fiabilite_ratio ?? "",
    "Histo dispo":       r.histo_disponible ? "Oui" : "Non",
    "Histo conso 30j":   r.histo_conso_30j ?? "",
    "Nb mois histo":     r.histo_nb_mois ?? "",
    "Erreur":            r.error_message ?? "",
  }));

  const wb  = XLSX.utils.book_new();
  const ws  = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 14 }, { wch: 26 }, { wch: 18 }, { wch: 12 },
    { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 16 },
    { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    { wch: 12 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Estimations");
  XLSX.writeFile(wb, `estimation_${batch.label}.xlsx`);
}

// ─── Comparison export ───────────────────────────────────────────────────────
function exportComparaisonChoix(
  data: CompareData,
  choices: Record<string, "enertrack" | "external">,
  batch: EstimationBatch,
) {
  const f = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  const rows = data.rows.map(r => {
    const src = choices[r.site_id] ?? "enertrack";
    return {
      "Site ID":             r.site_id,
      "Site Nom":            r.site_name,
      "Source retenue":      src === "enertrack" ? "EnerTrack" : "Externe",
      "Conso retenue (kWh)": src === "enertrack" ? (r.enertrack_conso ?? "") : (r.external_conso ?? ""),
      "Montant retenu (F)":  src === "enertrack" ? (r.enertrack_montant ?? "") : (r.external_montant ?? ""),
      "EnerTrack conso":     r.enertrack_conso ?? "",
      "Externe conso":       r.external_conso ?? "",
      "Écart conso %":       r.ecart_conso_pct !== null ? `${r.ecart_conso_pct > 0 ? "+" : ""}${r.ecart_conso_pct.toFixed(1)}%` : "",
      "EnerTrack montant":   r.enertrack_montant ?? "",
      "Externe montant":     r.external_montant ?? "",
      "Match":               r.match ? "✓" : "✗",
    };
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws, "Comparaison");
  XLSX.writeFile(wb, `comparaison_${batch.label}.xlsx`);
}

// ─── Comparison tab ───────────────────────────────────────────────────────────
const fmtPct = (v: number | null) =>
  v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

function EcartBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: "#94a3b8" }}>—</span>;
  const abs = Math.abs(pct);
  const color = abs <= 5 ? "#059669" : abs <= 15 ? "#d97706" : "#dc2626";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color }}>
      {fmtPct(pct)}
    </span>
  );
}

function MatchBadge({ match }: { match: boolean }) {
  return match
    ? <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 5, padding: "2px 7px" }}>✓ OK</span>
    : <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 5, padding: "2px 7px" }}>✗ Écart</span>;
}

function ComparisonTab({
  data, isLoading, isError, onRequestImport,
  chosenSource, onChoose, onChooseAll, onExportChoices,
}: {
  data: CompareData | null;
  isLoading: boolean;
  isError: boolean;
  onRequestImport: () => void;
  chosenSource: Record<string, "enertrack" | "external">;
  onChoose: (siteId: string, src: "enertrack" | "external") => void;
  onChooseAll: (src: "enertrack" | "external") => void;
  onExportChoices: () => void;
}) {
  const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

  if (isLoading) return (
    <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
      <Loader2 size={20} style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 8px" }}/>
      Chargement de la comparaison…
    </div>
  );

  if (isError) return (
    <div style={{ padding: "40px", textAlign: "center", color: "#dc2626", fontSize: 13 }}>
      Erreur lors du chargement.
    </div>
  );

  if (!data || !data.has_external) return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <ArrowLeftRight size={40} style={{ display: "block", margin: "0 auto 12px", opacity: .2 }}/>
      <p style={{ fontSize: 14, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
        Aucun fichier externe importé pour cette période
      </p>
      <p style={{ fontSize: 12.5, color: "#64748b", marginBottom: 18 }}>
        Importez un fichier déjà estimé via le bouton <strong>Import fichier estimé</strong> pour comparer les résultats.
      </p>
      <button
        onClick={onRequestImport}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "10px 20px", borderRadius: 10,
          background: "#0891b2", color: "white", border: "none",
          fontSize: 13, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 4px 12px rgba(8,145,178,.25)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <FileSpreadsheet size={14}/> Importer maintenant
      </button>
    </div>
  );

  const s = data.score;
  const nEnertrack = data.rows.filter(r => (chosenSource[r.site_id] ?? "enertrack") === "enertrack").length;
  const nExternal  = data.rows.length - nEnertrack;

  return (
    <div>
      {/* Score cards */}
      <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(30,58,138,.07)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
          {[
            { label: "Sites EnerTrack",   value: s.total_enertrack, color: "#7c3aed" },
            { label: "Sites fichier ext.", value: s.total_external,  color: "#0891b2" },
            { label: "Comparables",        value: s.comparable,      color: "#334155" },
            { label: "Correspondances",    value: s.matched,         color: "#059669" },
          ].map(k => (
            <div key={k.label} style={{
              background: "#f8faff", borderRadius: 12, padding: "12px 14px",
              border: "1px solid rgba(30,58,138,.07)",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>
                {k.label}
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, color: k.color }}>
                {k.value.toLocaleString("fr-FR")}
              </div>
            </div>
          ))}
        </div>
        {/* Score bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, background: s.match_pct >= 90 ? "#f0fdf4" : s.match_pct >= 70 ? "#fffbeb" : "#fef2f2", border: `1px solid ${s.match_pct >= 90 ? "#bbf7d0" : s.match_pct >= 70 ? "#fde68a" : "#fecaca"}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ height: 8, background: "rgba(0,0,0,.06)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${s.match_pct}%`, borderRadius: 99, background: s.match_pct >= 90 ? "#059669" : s.match_pct >= 70 ? "#d97706" : "#dc2626", transition: "width .4s" }}/>
            </div>
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800, color: s.match_pct >= 90 ? "#059669" : s.match_pct >= 70 ? "#d97706" : "#dc2626", flexShrink: 0 }}>
            {s.match_pct.toFixed(1)}%
          </div>
          <div style={{ fontSize: 11.5, color: "#64748b", flexShrink: 0 }}>
            de correspondance (seuil ±{s.threshold_pct}% conso)
          </div>
        </div>
      </div>

      {/* Selection toolbar */}
      {data.rows.length > 0 && (
        <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(30,58,138,.07)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginRight: 2 }}>Sélection :</span>
          {(["enertrack", "external"] as const).map(src => (
            <button
              key={src}
              onClick={() => onChooseAll(src)}
              style={{
                padding: "5px 12px", borderRadius: 8, border: "1.5px solid",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: "white",
                color: src === "enertrack" ? "#7c3aed" : "#0891b2",
                borderColor: src === "enertrack" ? "#7c3aed" : "#0891b2",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Tout {src === "enertrack" ? "EnerTrack" : "Externe"}
            </button>
          ))}
          <div style={{ flex: 1 }}/>
          <span style={{ fontSize: 11, color: "#64748b" }}>
            <span style={{ fontWeight: 700, color: "#7c3aed" }}>{nEnertrack}</span> EnerTrack ·{" "}
            <span style={{ fontWeight: 700, color: "#0891b2" }}>{nExternal}</span> Externe
          </span>
          <button
            onClick={onExportChoices}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8, border: "none",
              background: "#7c3aed", color: "white",
              fontSize: 11.5, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 3px 8px rgba(124,58,237,.25)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <Download size={12}/> Exporter les choix
          </button>
        </div>
      )}

      {/* Comparison table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8faff", borderBottom: "1px solid rgba(30,58,138,.07)" }}>
              {["Site", "EnerTrack conso", "Fichier ext. conso", "Écart conso", "EnerTrack montant", "Fichier ext. montant", "Écart montant", "Match", "Source retenue"].map(h => (
                <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: h === "Source retenue" ? "#7c3aed" : "#64748b", textTransform: "uppercase", letterSpacing: ".06em", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: "32px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Aucune donnée</td></tr>
            ) : (
              data.rows.map(r => {
                const chosen = chosenSource[r.site_id] ?? "enertrack";
                return (
                  <tr key={r.site_id} className="ep-row" style={{ borderBottom: "1px solid rgba(30,58,138,.05)" }}>
                    <td style={{ padding: "9px 12px", minWidth: 130 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0f172a" }}>{r.site_id}</div>
                      <div style={{ fontSize: 10.5, color: "#94a3b8", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.site_name}</div>
                      {r.enertrack_source && <SourceBadge source={r.enertrack_source} />}
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: chosen === "enertrack" ? "#7c3aed" : "#94a3b8", opacity: chosen === "enertrack" ? 1 : 0.45 }}>
                      {r.enertrack_conso !== null ? `${fmt.format(Math.round(r.enertrack_conso))} kWh` : <span style={{ color: "#94a3b8", fontFamily: "'DM Sans'" }}>—</span>}
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: chosen === "external" ? "#0891b2" : "#94a3b8", opacity: chosen === "external" ? 1 : 0.45 }}>
                      {r.external_conso !== null ? `${fmt.format(Math.round(r.external_conso))} kWh` : <span style={{ color: "#94a3b8", fontFamily: "'DM Sans'" }}>—</span>}
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                      <EcartBadge pct={r.ecart_conso_pct} />
                      {r.ecart_conso !== null && (
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{r.ecart_conso > 0 ? "+" : ""}{fmt.format(Math.round(r.ecart_conso))} kWh</div>
                      )}
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: chosen === "enertrack" ? "#7c3aed" : "#94a3b8", opacity: chosen === "enertrack" ? 1 : 0.45 }}>
                      {r.enertrack_montant !== null ? `${fmt.format(Math.round(r.enertrack_montant))} F` : <span style={{ color: "#94a3b8", fontFamily: "'DM Sans'" }}>—</span>}
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: chosen === "external" ? "#0891b2" : "#94a3b8", opacity: chosen === "external" ? 1 : 0.45 }}>
                      {r.external_montant !== null ? `${fmt.format(Math.round(r.external_montant))} F` : <span style={{ color: "#94a3b8", fontFamily: "'DM Sans'" }}>—</span>}
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                      <EcartBadge pct={r.ecart_montant_pct} />
                      {r.ecart_montant !== null && (
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{r.ecart_montant > 0 ? "+" : ""}{fmt.format(Math.round(r.ecart_montant))} F</div>
                      )}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <MatchBadge match={r.match} />
                    </td>
                    {/* Source choice toggle */}
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {(["enertrack", "external"] as const).map(src => (
                          <button
                            key={src}
                            onClick={() => onChoose(r.site_id, src)}
                            style={{
                              padding: "4px 9px", borderRadius: 7,
                              border: `1.5px solid ${src === "enertrack" ? "#7c3aed" : "#0891b2"}`,
                              fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                              fontFamily: "'DM Sans', sans-serif",
                              transition: "all .12s",
                              background: chosen === src ? (src === "enertrack" ? "#7c3aed" : "#0891b2") : "white",
                              color: chosen === src ? "white" : (src === "enertrack" ? "#7c3aed" : "#0891b2"),
                            }}
                          >
                            {src === "enertrack" ? "ET" : "Ext"}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EstimationPage() {
  const qc = useQueryClient();

  const now   = new Date();
  const [launchYear,  setLaunchYear]  = useState(now.getFullYear());
  const [launchMonth, setLaunchMonth] = useState(now.getMonth() + 1);
  const [selectedBatch, setSelectedBatch] = useState<EstimationBatch | null>(null);
  const [resultPage,  setResultPage]  = useState(1);
  const [filterSource, setFilterSource] = useState("");

  const [showImport,    setShowImport]    = useState(false);
  const [importFile,    setImportFile]    = useState<File | null>(null);
  const [importing,     setImporting]     = useState(false);
  const [importPct,     setImportPct]     = useState(0);
  const [importResult,  setImportResult]  = useState<HistoryImportResult | null>(null);
  const [importError,   setImportError]   = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"resultats" | "comparaison">("resultats");
  const [chosenSource, setChosenSource] = useState<Record<string, "enertrack" | "external">>({});

  const [showExternalImport,    setShowExternalImport]    = useState(false);
  const [externalImportFile,    setExternalImportFile]    = useState<File | null>(null);
  const [externalImporting,     setExternalImporting]     = useState(false);
  const [externalImportResult,  setExternalImportResult]  = useState<ExternalImportResult | null>(null);
  const [externalImportError,   setExternalImportError]   = useState<string | null>(null);
  const externalImportInputRef = useRef<HTMLInputElement>(null);

  async function handleExternalImport() {
    if (!externalImportFile) return;
    setExternalImporting(true);
    setExternalImportError(null);
    setExternalImportResult(null);
    try {
      const res = await importExternalEstimation(externalImportFile);
      setExternalImportResult(res);
      qc.invalidateQueries({ queryKey: ["estimation-compare"] });
    } catch (e: any) {
      setExternalImportError(e?.response?.data?.detail || "Erreur lors de l'import.");
    } finally {
      setExternalImporting(false);
    }
  }

  async function handleImportHistory() {
    if (!importFile) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    setImportPct(0);
    try {
      const res = await importEstimationHistory(importFile, setImportPct);
      setImportResult(res);
      qc.invalidateQueries({ queryKey: ["estimation-compare"] });
      const fresh = await batchesQ.refetch();
      const relaunched = fresh.data?.results?.find(b => b.id === res.relaunched.batch_id);
      if (relaunched) {
        setSelectedBatch(relaunched);
        setResultPage(1);
        setFilterSource("");
        setChosenSource({});
        setActiveTab("comparaison");
      }
    } catch (e: any) {
      setImportError(e?.response?.data?.detail || "Erreur lors de l'import.");
    } finally {
      setImporting(false);
    }
  }
 

  // ── Queries
  const batchesQ = useQuery({
    queryKey: ["estimation-batches"],
    queryFn:  fetchBatches,
    refetchInterval: (q) => {
      const inProgress = q.state.data?.results?.some(b => b.status === "RUNNING" || b.status === "PENDING");
      return inProgress ? 3000 : false;
    },
  });

  const batches = batchesQ.data?.results ?? [];

  // Polling automatique si le batch sélectionné est en attente ou en cours
  const selectedInProgress = !!selectedBatch && (selectedBatch.status === "RUNNING" || selectedBatch.status === "PENDING");
  const statusQ = useQuery({
    queryKey: ["estimation-batch-status", selectedBatch?.id],
    queryFn:  () => fetchBatchStatus(selectedBatch!.id),
    enabled:  selectedInProgress,
    refetchInterval: 3000,
  });

  // /status/ renvoie un résumé (sans id/year/month) : on relit le batch depuis la liste.
  useEffect(() => {
    if (statusQ.data && statusQ.data.status !== "RUNNING" && statusQ.data.status !== "PENDING") {
      qc.invalidateQueries({ queryKey: ["estimation-batches"] });
      qc.invalidateQueries({ queryKey: ["estimation-compare"] });
    }
  }, [statusQ.data]);

  // Mettre à jour selectedBatch depuis la liste
  useEffect(() => {
    if (selectedBatch && batches.length) {
      const updated = batches.find(b => b.id === selectedBatch.id);
      if (updated) setSelectedBatch(updated);
    }
  }, [batches]);

  const resultsQ = useQuery({
    queryKey: ["estimation-results", selectedBatch?.id, resultPage, filterSource],
    queryFn:  () => fetchResults(selectedBatch!.id, resultPage, filterSource || undefined),
    enabled:  !!selectedBatch && selectedBatch.status === "DONE",
    placeholderData: keepPreviousData,
  });

  const compareQ = useQuery({
    queryKey: ["estimation-compare", selectedBatch?.year, selectedBatch?.month],
    queryFn:  () => fetchComparison(selectedBatch!.year, selectedBatch!.month),
    enabled:  !!selectedBatch && selectedBatch.status === "DONE" && activeTab === "comparaison",
    staleTime: 30 * 1000,
  });

  // Auto-init choices when comparison data loads (default: all EnerTrack)
  useEffect(() => {
    if (compareQ.data?.rows) {
      setChosenSource(prev => {
        const next: Record<string, "enertrack" | "external"> = {};
        compareQ.data!.rows.forEach(r => {
          next[r.site_id] = prev[r.site_id] ?? "enertrack";
        });
        return next;
      });
    }
  }, [compareQ.data]);

  // Export : charger toutes les pages
  const [exporting, setExporting] = useState(false);
  async function handleExport() {
    if (!selectedBatch) return;
    setExporting(true);
    try {
      let all: EstimationResult[] = [];
      let p = 1;
      while (true) {
        const res = await fetchResults(selectedBatch.id, p, undefined);
        all = [...all, ...res.results];
        if (all.length >= res.count) break;
        p++;
      }
      exportResults(all, selectedBatch);
    } catch (e) {
      toast.error("Export échoué");
    } finally {
      setExporting(false);
    }
  }

  // ── Launch mutation
  const launchMut = useMutation({
    mutationFn: launchBatch,
    onSuccess: (res) => {
      toast.success(`Estimation ${res.label} lancée`);
      qc.invalidateQueries({ queryKey: ["estimation-batches"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Erreur au lancement"),
  });

  const results  = resultsQ.data?.results ?? [];
  const totalRes = resultsQ.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRes / 25));

  const inputStyle: React.CSSProperties = {
    background: "#f8faff", border: "1.5px solid #dde5ff",
    borderRadius: 8, padding: "8px 12px",
    fontSize: 13, color: "#1e3a8a",
    fontFamily: "'DM Sans', sans-serif", outline: "none",
  };

  // ── Résumé du batch sélectionné
  const batchKpis = useMemo(() => {
    if (!selectedBatch || !selectedBatch.total) return null;
    const t = selectedBatch.total;
    return [
      { label: "ACM",        value: selectedBatch.count_acm,   color: "#059669", pct: selectedBatch.count_acm / t * 100 },
      { label: "Grid",       value: selectedBatch.count_grid,  color: "#0891b2", pct: selectedBatch.count_grid / t * 100 },
      { label: "Historique", value: selectedBatch.count_histo, color: "#7c3aed", pct: selectedBatch.count_histo / t * 100 },
      { label: "NC",         value: selectedBatch.count_nc,    color: "#dc2626", pct: selectedBatch.count_nc / t * 100 },
    ];
  }, [selectedBatch]);

  const montantTotal = useMemo(() =>
    results.reduce((a, r) => a + (Number(r.montant_estime) || 0), 0),
    [results]
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
        .ep * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ep-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .ep-card { animation: ep-in .4s cubic-bezier(.22,1,.36,1) both; }
        .ep-card:nth-child(1) { animation-delay: .04s; }
        .ep-card:nth-child(2) { animation-delay: .08s; }
        .ep-card:nth-child(3) { animation-delay: .12s; }
        .ep-row { transition: background .12s; }
        .ep-row:hover { background: #f8faff !important; }
        .ep input:focus, .ep select:focus {
          outline: none; border-color: #1e3a8a !important;
          box-shadow: 0 0 0 3px rgba(30,58,138,.09) !important;
        }
      `}</style>

      <div className="ep" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="ep-card" style={{
          background: "white", borderRadius: 20,
          border: "1px solid rgba(30,58,138,.08)",
          boxShadow: "0 1px 3px rgba(30,58,138,.04), 0 8px 32px rgba(30,58,138,.06)",
          overflow: "hidden", position: "relative",
        }}>
          <div style={{ height: 3, background: "linear-gradient(90deg,#7c3aed,#a78bfa,#E8401C,transparent)", position: "absolute", top: 0, left: 0, right: 0 }}/>
          <div style={{ padding: "22px 28px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(124,58,237,.08)", border: "1px solid rgba(124,58,237,.18)", borderRadius: 100, padding: "3px 10px", marginBottom: 8 }}>
                <Calculator size={11} color="#7c3aed"/>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: "#7c3aed", textTransform: "uppercase" }}>Estimation</span>
              </div>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 23, fontWeight: 800, color: "#0f172a", letterSpacing: "-.03em", margin: 0, lineHeight: 1.2 }}>
                Provisions mensuelles
              </h1>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 5, margin: "5px 0 0" }}>
                Estimation de la consommation et du montant pour chaque site actif — sources ACM, Grid, Historique Sénélec.
              </p>
            </div>

            {/* Launch form */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <select
                value={launchMonth}
                onChange={e => setLaunchMonth(Number(e.target.value))}
                style={{ ...inputStyle, width: 130 }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{getMonthName(m)}</option>
                ))}
              </select>
              <select
                value={launchYear}
                onChange={e => setLaunchYear(Number(e.target.value))}
                style={{ ...inputStyle, width: 90 }}
              >
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button
                onClick={() => launchMut.mutate({ year: launchYear, month: launchMonth })}
                disabled={launchMut.isPending}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "9px 20px", borderRadius: 10,
                  background: launchMut.isPending ? "#94a3b8" : "#7c3aed",
                  color: "white", border: "none",
                  fontSize: 13, fontWeight: 700,
                  cursor: launchMut.isPending ? "not-allowed" : "pointer",
                  boxShadow: launchMut.isPending ? "none" : "0 4px 12px rgba(124,58,237,.3)",
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "all .18s",
                }}
              >
                {launchMut.isPending
                  ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/>
                  : <Play size={14}/>
                }
                Lancer
              </button>

              <button
                onClick={() => { setShowImport(true); setImportFile(null); setImportResult(null); setImportError(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "9px 16px", borderRadius: 10,
                  background: "white",
                  color: "#475569", border: "1.5px solid rgba(0,0,0,.1)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <Upload size={14} />
                Importer historique
              </button>

              <button
                onClick={() => { setShowExternalImport(true); setExternalImportFile(null); setExternalImportResult(null); setExternalImportError(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "9px 16px", borderRadius: 10,
                  background: "white",
                  color: "#0891b2", border: "1.5px solid rgba(8,145,178,.25)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <FileSpreadsheet size={14} />
                Import fichier estimé
              </button>

              <button
                onClick={() => {
                  if (!selectedBatch || selectedBatch.status !== "DONE") {
                    const latest = batches.find(b => b.status === "DONE");
                    if (latest) { setSelectedBatch(latest); setResultPage(1); setFilterSource(""); setChosenSource({}); }
                  }
                  setActiveTab("comparaison");
                }}
                disabled={!batches.some(b => b.status === "DONE")}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "9px 18px", borderRadius: 10,
                  background: batches.some(b => b.status === "DONE")
                    ? "linear-gradient(135deg,#7c3aed,#0891b2)"
                    : "#e2e8f0",
                  color: batches.some(b => b.status === "DONE") ? "white" : "#94a3b8",
                  border: "none",
                  fontSize: 13, fontWeight: 700, cursor: batches.some(b => b.status === "DONE") ? "pointer" : "not-allowed",
                  boxShadow: batches.some(b => b.status === "DONE") ? "0 4px 12px rgba(124,58,237,.28)" : "none",
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "all .18s",
                }}
              >
                <ArrowLeftRight size={14} />
                Comparaison
              </button>

            </div>
          </div>
        </div>

        {/* ── Body : liste batches + détail ────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14 }}>

          {/* Colonne gauche : liste des batchs */}
          <div className="ep-card" style={{
            background: "white", borderRadius: 16,
            border: "1px solid rgba(30,58,138,.08)",
            boxShadow: "0 1px 3px rgba(30,58,138,.04)",
            overflow: "hidden", display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(30,58,138,.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: ".07em" }}>
                Batchs
              </span>
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ["estimation-batches"] })}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "grid", placeItems: "center" }}
              >
                <RefreshCw size={13} style={{ animation: batchesQ.isFetching ? "spin 1s linear infinite" : "none" }}/>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
              {batchesQ.isLoading ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                  Chargement…
                </div>
              ) : batches.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                  Aucun batch.<br/>Lancez une estimation ci-dessus.
                </div>
              ) : (
                batches.map(b => {
                  const isSelected = selectedBatch?.id === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => { setSelectedBatch(b); setResultPage(1); setFilterSource(""); setChosenSource({}); }}
                      style={{
                        padding: "11px 12px", borderRadius: 12, marginBottom: 4,
                        cursor: "pointer", transition: "all .15s",
                        background: isSelected ? "#f0f4ff" : "transparent",
                        border: `1px solid ${isSelected ? "rgba(30,58,138,.2)" : "transparent"}`,
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#f8faff"; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                          {getMonthName(b.month)} {b.year}
                        </span>
                        <StatusBadge status={b.status} />
                      </div>

                      {b.status === "DONE" && b.total > 0 && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <SourceBreakdown batch={b} />
                            <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>{b.total} sites</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {[
                              { label: "ACM", value: b.count_acm, color: "#059669" },
                              { label: "Grid", value: b.count_grid, color: "#0891b2" },
                              { label: "Histo", value: b.count_histo, color: "#7c3aed" },
                              { label: "NC", value: b.count_nc, color: "#dc2626" },
                            ].filter(s => s.value > 0).map(s => (
                              <span key={s.label} style={{ fontSize: 10, fontWeight: 700, color: s.color }}>
                                {s.label}: {s.value}
                              </span>
                            ))}
                          </div>
                        </>
                      )}

                      {b.status === "RUNNING" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <ProgressBar done={b.count_acm + b.count_grid + b.count_histo + b.count_nc} total={b.total || 1} color="#7c3aed" />
                          <span style={{ fontSize: 10, color: "#7c3aed", flexShrink: 0 }}>
                            {b.count_acm + b.count_grid + b.count_histo + b.count_nc} / {b.total || "?"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Colonne droite : détail du batch */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {!selectedBatch ? (
              <div className="ep-card" style={{
                background: "white", borderRadius: 16,
                border: "1px solid rgba(30,58,138,.08)",
                padding: "60px 24px", textAlign: "center",
                color: "#94a3b8",
              }}>
                <Calculator size={36} style={{ margin: "0 auto 12px", display: "block", opacity: .3 }}/>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Sélectionnez un batch pour voir les résultats</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Ou lancez une nouvelle estimation pour le mois souhaité</div>
              </div>
            ) : (
              <>
                {/* KPI cards source breakdown */}
                {batchKpis && (
                  <div className="ep-card" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                    {batchKpis.map(k => (
                      <div key={k.label} style={{
                        background: "white", borderRadius: 14, padding: "14px 16px",
                        border: "1px solid rgba(30,58,138,.08)",
                        boxShadow: "0 1px 3px rgba(30,58,138,.04)",
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
                          {k.label}
                        </div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, color: k.color }}>
                          {k.value}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                          <ProgressBar done={k.value} total={selectedBatch.total} color={k.color} />
                          <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>{k.pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Running state */}
                {(selectedBatch.status === "RUNNING" || selectedBatch.status === "PENDING") && (
                  <div className="ep-card" style={{
                    background: "#eff6ff", borderRadius: 14,
                    border: "1px solid #bfdbfe", padding: "16px 20px",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <Loader2 size={18} color="#2563eb" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}/>
                    <div>
                      <div role="status" style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>
                        {selectedBatch.status === "PENDING" ? "Estimation en attente de démarrage…" : "Estimation en cours…"}
                      </div>
                      <div style={{ fontSize: 12, color: "#3b82f6" }}>
                        {selectedBatch.count_acm + selectedBatch.count_grid + selectedBatch.count_histo + selectedBatch.count_nc} sites traités
                        {selectedBatch.total > 0 ? ` sur ${selectedBatch.total}` : ""}
                        {activeTab === "comparaison" && " — la comparaison avec le fichier s'affichera à la fin."}
                      </div>
                    </div>
                  </div>
                )}

                {/* Résultats */}
                {selectedBatch.status === "DONE" && (
                  <div className="ep-card" style={{
                    background: "white", borderRadius: 16,
                    border: "1px solid rgba(30,58,138,.08)",
                    boxShadow: "0 1px 3px rgba(30,58,138,.04)",
                    overflow: "hidden",
                  }}>
                    {/* Tab bar */}
                    <div style={{ padding: "0 18px", borderBottom: "1px solid rgba(30,58,138,.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 0 }}>
                        {([
                          { key: "resultats",   label: "Résultats EnerTrack", icon: <BarChart3 size={13}/> },
                          { key: "comparaison", label: "Comparaison", icon: <ArrowLeftRight size={13}/> },
                        ] as const).map(tab => (
                          <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                              display: "flex", alignItems: "center", gap: 6,
                              padding: "13px 16px", border: "none", background: "none",
                              fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                              color: activeTab === tab.key ? "#7c3aed" : "#64748b",
                              borderBottom: activeTab === tab.key ? "2px solid #7c3aed" : "2px solid transparent",
                              fontFamily: "'DM Sans', sans-serif",
                              transition: "color .15s",
                            }}
                          >
                            {tab.icon} {tab.label}
                          </button>
                        ))}
                      </div>
                      {/* Toolbar actions — only for Résultats tab */}
                      {activeTab === "resultats" && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0" }}>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>{totalRes} sites</span>
                        {montantTotal > 0 && (
                          <span style={{
                            fontSize: 12, fontWeight: 700, color: "#7c3aed",
                            background: "#faf5ff", border: "1px solid #ddd6fe",
                            borderRadius: 6, padding: "2px 8px",
                          }}>
                            {money(montantTotal)}
                          </span>
                        )}
                        <select
                          value={filterSource}
                          onChange={e => { setFilterSource(e.target.value); setResultPage(1); }}
                          style={{ ...inputStyle, width: 130, padding: "6px 10px" }}
                        >
                          <option value="">Toutes sources</option>
                          {["ACM", "GRID", "HISTO", "NC", "HORS_SCOPE"].map(s => (
                            <option key={s} value={s}>{SOURCE_CONFIG[s]?.label ?? s}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleExport}
                          disabled={exporting}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "7px 14px", borderRadius: 9,
                            background: exporting ? "#94a3b8" : "#7c3aed",
                            color: "white", border: "none",
                            fontSize: 12, fontWeight: 700, cursor: exporting ? "not-allowed" : "pointer",
                            boxShadow: exporting ? "none" : "0 4px 10px rgba(124,58,237,.25)",
                            fontFamily: "'DM Sans', sans-serif",
                            transition: "all .15s",
                          }}
                        >
                          {exporting
                            ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }}/>
                            : <Download size={12}/>
                          }
                          Exporter
                        </button>
                      </div>
                      )}
                    </div>

                    {/* ── Onglet Résultats ─────────────────────────────── */}
                    {activeTab === "resultats" && <div style={{ overflowX: "auto" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#f8faff", borderBottom: "1px solid rgba(30,58,138,.07)" }}>
                            {["Site", "Source", "Conso estimée", "Montant estimé", "Fiabilité Grid", "Histo", "Erreur"].map(h => (
                              <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".07em", whiteSpace: "nowrap" }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {resultsQ.isLoading ? (
                            <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Chargement…</td></tr>
                          ) : results.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Aucun résultat</td></tr>
                          ) : (
                            results.map(r => (
                              <tr key={r.id} className="ep-row" style={{ borderBottom: "1px solid rgba(30,58,138,.05)" }}>
                                {/* Site */}
                                <td style={{ padding: "10px 14px", minWidth: 160 }}>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{r.site_id}</div>
                                  <div style={{ fontSize: 11, color: "#94a3b8", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.site_name}</div>
                                </td>
                                {/* Source */}
                                <td style={{ padding: "10px 14px" }}>
                                  <SourceBadge source={r.source_utilisee} />
                                </td>
                                {/* Conso */}
                                <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                  {r.conso_estimee_kwh
                                    ? <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{fmt.format(Math.round(Number(r.conso_estimee_kwh)))} kWh</span>
                                    : <span style={{ color: "#94a3b8" }}>—</span>
                                  }
                                </td>
                                {/* Montant */}
                                <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                  {r.montant_estime
                                    ? <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: "#7c3aed" }}>{money(r.montant_estime)}</span>
                                    : <span style={{ color: "#94a3b8" }}>—</span>
                                  }
                                </td>
                                {/* Fiabilité grid */}
                                <td style={{ padding: "10px 14px" }}>
                                  <div><FiabBadge v={r.fiabilite_grid} /></div>
                                  {r.fiabilite_ratio && (
                                    <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}>
                                      ratio: {Number(r.fiabilite_ratio).toFixed(3)}
                                    </div>
                                  )}
                                </td>
                                {/* Histo */}
                                <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                  {r.histo_disponible && r.histo_conso_30j
                                    ? <span style={{ fontSize: 12, color: "#7c3aed" }}>{fmt.format(Math.round(Number(r.histo_conso_30j)))} kWh/30j <span style={{ color: "#94a3b8" }}>({r.histo_nb_mois} mois)</span></span>
                                    : <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                                  }
                                </td>
                                {/* Erreur */}
                                <td style={{ padding: "10px 14px", maxWidth: 220 }}>
                                  {r.error_message
                                    ? <span style={{ fontSize: 11, color: "#dc2626", overflow: "hidden", textOverflow: "ellipsis", display: "block", whiteSpace: "nowrap" }} title={r.error_message}>{r.error_message}</span>
                                    : <span style={{ color: "#94a3b8" }}>—</span>
                                  }
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(30,58,138,.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        Page <strong>{resultPage}</strong> / {totalPages} · <strong>{totalRes}</strong> résultats
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[
                          { icon: <ChevronLeft size={14}/>, disabled: resultPage <= 1,          fn: () => setResultPage(p => p - 1) },
                          { icon: <ChevronRight size={14}/>, disabled: resultPage >= totalPages, fn: () => setResultPage(p => p + 1) },
                        ].map(({ icon, disabled, fn }, i) => (
                          <button key={i} disabled={disabled} onClick={fn} style={{
                            width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(30,58,138,.12)",
                            background: "white", cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? .4 : 1, color: "#1e3a8a",
                            display: "grid", placeItems: "center",
                          }}>
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                    </div>}

                    {/* ── Onglet Comparaison ────────────────────────────── */}
                    {activeTab === "comparaison" && (
                      <ComparisonTab
                        data={compareQ.data ?? null}
                        isLoading={compareQ.isLoading}
                        isError={compareQ.isError}
                        onRequestImport={() => { setShowExternalImport(true); setExternalImportFile(null); setExternalImportResult(null); setExternalImportError(null); }}
                        chosenSource={chosenSource}
                        onChoose={(siteId, src) => setChosenSource(prev => ({ ...prev, [siteId]: src }))}
                        onChooseAll={(src) => {
                          if (!compareQ.data) return;
                          const next: Record<string, "enertrack" | "external"> = {};
                          compareQ.data.rows.forEach(r => { next[r.site_id] = src; });
                          setChosenSource(next);
                        }}
                        onExportChoices={() => {
                          if (compareQ.data && selectedBatch) exportComparaisonChoix(compareQ.data, chosenSource, selectedBatch);
                        }}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

            {showImport && (
      <Dialog open onOpenChange={(next) => { if (!next && !importing) setShowImport(false); }}>
        <DialogContent
          className="p-0 gap-0 border-0"
          style={{
            background: "white", borderRadius: 24, padding: 32,
            maxWidth: 500, width: "100%",
            boxShadow: "0 32px 80px rgba(0,0,0,.22)",
          }}
        >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <DialogTitle asChild>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
                    Importer l'historique des provisions
                  </h3>
                </DialogTitle>
                <p style={{ fontSize: 12.5, color: "#64748b", margin: 0 }}>
                  Fichier <strong>Provisions_GRID_Conso.xlsx</strong> — colonnes :
                  site_ID · Site_Name · Conso_Kwh · Montant · Source · Mois
                </p>
              </div>
            </div>

            {!importResult ? (
              <>
                {/* Drop zone */}
                <div
                  onClick={() => importInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${importFile ? "rgba(5,150,105,.4)" : "rgba(124,58,237,.2)"}`,
                    borderRadius: 16, padding: "28px 20px", textAlign: "center",
                    cursor: "pointer",
                    background: importFile ? "rgba(5,150,105,.03)" : "rgba(248,250,252,1)",
                    marginBottom: 16,
                  }}
                >
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={e => e.target.files?.[0] && setImportFile(e.target.files[0])}
                  />
                  <Upload size={28} color={importFile ? "#059669" : "#94a3b8"} style={{ marginBottom: 10 }} />
                  {importFile ? (
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#059669", margin: "0 0 2px" }}>
                        {importFile.name}
                      </p>
                      <p style={{ fontSize: 11.5, color: "#94a3b8", margin: 0 }}>
                        {(importFile.size / 1024 / 1024).toFixed(1)} Mo
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 2px" }}>
                        Glisser-déposer ou cliquer
                      </p>
                      <p style={{ fontSize: 11.5, color: "#94a3b8", margin: 0 }}>.xlsx — Feuil1 requis</p>
                    </div>
                  )}
                </div>
 
                {/* Déroulé */}
                <div style={{
                  padding: "10px 14px", borderRadius: 12, marginBottom: 14,
                  background: "rgba(124,58,237,.05)",
                  border: "1px solid rgba(124,58,237,.12)",
                  fontSize: 11.5, color: "#5b21b6", lineHeight: 1.55,
                }}>
                  <strong>Après l'import :</strong> les valeurs du fichier deviennent la référence de comparaison
                  (sans écraser les résultats du programme), l'estimation est relancée pour le mois le plus récent
                  du fichier, puis l'onglet <strong>Comparaison</strong> s'ouvre.
                </div>

                {/* Progress */}
                {importing && importPct > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Upload en cours…</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed" }}>{importPct}%</span>
                    </div>
                    <div style={{ height: 4, background: "#f1f5f9", borderRadius: 99 }}>
                      <div style={{ height: "100%", width: `${importPct}%`, background: "#7c3aed", borderRadius: 99, transition: "width .2s" }} />
                    </div>
                  </div>
                )}
 
                {importing && importPct === 100 && (
                  <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 14px", borderRadius: 12,
                    background: "rgba(124,58,237,.05)", border: "1px solid rgba(124,58,237,.12)" }}>
                    <Loader2 size={14} color="#7c3aed" style={{ animation: "spin 1s linear infinite" }}/>
                    <span style={{ fontSize: 12.5, color: "#7c3aed", fontWeight: 600 }}>
                      Import en cours (67k lignes, ~20s)…
                    </span>
                  </div>
                )}
 
                {importError && (
                  <div style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 14,
                    background: "rgba(220,38,38,.07)", border: "1px solid rgba(220,38,38,.15)",
                    fontSize: 12.5, color: "#dc2626", fontWeight: 500 }}>
                    ⚠ {importError}
                  </div>
                )}
 
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowImport(false)} disabled={importing}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 12,
                      border: "1.5px solid rgba(0,0,0,.1)", background: "white",
                      fontSize: 13, fontWeight: 600, color: "#374151",
                      cursor: importing ? "not-allowed" : "pointer" }}>
                    Annuler
                  </button>
                  <button
                    disabled={!importFile || importing}
                    onClick={handleImportHistory}
                    style={{ flex: 2, padding: "9px 0", borderRadius: 12, border: "none",
                      background: importFile && !importing ? "#7c3aed" : "rgba(124,58,237,.25)",
                      fontSize: 13, fontWeight: 600, color: "white",
                      cursor: importFile && !importing ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    }}>
                    {importing && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                    {importing ? "Import en cours…" : "Importer"}
                  </button>
                </div>
              </>
            ) : (
              /* Résultat */
              <div>
                <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
                  <CheckCircle2 size={40} color="#059669" style={{ marginBottom: 10 }} />
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
                    Import terminé
                  </h4>
                  <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 16px" }}>
                    {importResult.periods.length} période(s) importée(s)
                    {importResult.periods.length > 0 && ` (${importResult.periods[0]} → ${importResult.periods[importResult.periods.length - 1]})`}
                    {" · "}{importResult.total_parsed.toLocaleString("fr-FR")} lignes
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                    {[
                      { label: "Lignes de référence", value: importResult.imported,              color: "#7c3aed" },
                      { label: "Sites inconnus",      value: importResult.skipped_unknown_sites, color: "#f59e0b" },
                      { label: "Dates invalides",     value: importResult.skipped_invalid_dates, color: "#94a3b8" },
                    ].map(s => (
                      <div key={s.label} style={{ padding: "8px 10px", borderRadius: 10,
                        background: "rgba(0,0,0,.03)", border: "1px solid rgba(0,0,0,.06)" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: s.color,
                          fontFamily: "'Outfit', sans-serif" }}>{s.value.toLocaleString("fr-FR")}</div>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: "#94a3b8" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div role="status" style={{ padding: "10px 14px", borderRadius: 12, textAlign: "left",
                    background: "rgba(37,99,235,.06)", border: "1px solid rgba(37,99,235,.15)",
                    fontSize: 12.5, color: "#1e40af" }}>
                    {importResult.relaunched.already_running
                      ? <>Une estimation <strong>{importResult.relaunched.label}</strong> était déjà en cours : la comparaison utilisera son résultat.</>
                      : <>Estimation <strong>{importResult.relaunched.label}</strong> relancée. La comparaison s'affichera dès la fin du calcul.</>}
                  </div>
                </div>
                <button onClick={() => setShowImport(false)}
                  style={{ width: "100%", padding: "10px 0", borderRadius: 12, border: "none",
                    background: "#7c3aed", fontSize: 13, fontWeight: 600, color: "white",
                    cursor: "pointer" }}>
                  Voir la comparaison
                </button>
              </div>
            )}
        </DialogContent>
      </Dialog>
      )}

      {/* External import modal */}
      {showExternalImport && (
        <Dialog open onOpenChange={(next) => { if (!next && !externalImporting) setShowExternalImport(false); }}>
          <DialogContent
            className="p-0 gap-0 border-0"
            style={{
              background: "white", borderRadius: 24, padding: 32,
              maxWidth: 500, width: "100%",
              boxShadow: "0 32px 80px rgba(0,0,0,.22)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <DialogTitle asChild>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
                    Importer un fichier déjà estimé
                  </h3>
                </DialogTitle>
                <p style={{ fontSize: 12.5, color: "#64748b", margin: 0 }}>
                  Fichier avec colonnes : site_ID · Conso_Kwh · Montant · Source · Mois
                </p>
              </div>
            </div>

            {!externalImportResult ? (
              <>
                <div
                  onClick={() => externalImportInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${externalImportFile ? "rgba(8,145,178,.4)" : "rgba(8,145,178,.2)"}`,
                    borderRadius: 16, padding: "28px 20px", textAlign: "center",
                    cursor: "pointer",
                    background: externalImportFile ? "rgba(8,145,178,.03)" : "#f8fafc",
                    marginBottom: 16,
                  }}
                >
                  <input
                    ref={externalImportInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={e => e.target.files?.[0] && setExternalImportFile(e.target.files[0])}
                  />
                  <FileSpreadsheet size={28} color={externalImportFile ? "#0891b2" : "#94a3b8"} style={{ marginBottom: 10 }} />
                  {externalImportFile ? (
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0891b2", margin: "0 0 2px" }}>
                        {externalImportFile.name}
                      </p>
                      <p style={{ fontSize: 11.5, color: "#94a3b8", margin: 0 }}>
                        {(externalImportFile.size / 1024 / 1024).toFixed(1)} Mo
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 2px" }}>
                        Glisser-déposer ou cliquer
                      </p>
                      <p style={{ fontSize: 11.5, color: "#94a3b8", margin: 0 }}>.xlsx — Feuil1 requis</p>
                    </div>
                  )}
                </div>

                <div style={{
                  padding: "10px 14px", borderRadius: 12, marginBottom: 14,
                  background: "rgba(8,145,178,.05)",
                  border: "1px solid rgba(8,145,178,.15)",
                  fontSize: 11.5, color: "#0e7490",
                }}>
                  Les données seront comparées avec les résultats du programme EnerTrack pour la même période.
                  Chaque import remplace les données externes du même mois.
                </div>

                {externalImportError && (
                  <div style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 14,
                    background: "rgba(220,38,38,.07)", border: "1px solid rgba(220,38,38,.15)",
                    fontSize: 12.5, color: "#dc2626", fontWeight: 500 }}>
                    ⚠ {externalImportError}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowExternalImport(false)} disabled={externalImporting}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 12,
                      border: "1.5px solid rgba(0,0,0,.1)", background: "white",
                      fontSize: 13, fontWeight: 600, color: "#374151",
                      cursor: externalImporting ? "not-allowed" : "pointer" }}>
                    Annuler
                  </button>
                  <button
                    disabled={!externalImportFile || externalImporting}
                    onClick={handleExternalImport}
                    style={{ flex: 2, padding: "9px 0", borderRadius: 12, border: "none",
                      background: externalImportFile && !externalImporting ? "#0891b2" : "rgba(8,145,178,.25)",
                      fontSize: 13, fontWeight: 600, color: "white",
                      cursor: externalImportFile && !externalImporting ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    }}>
                    {externalImporting && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                    {externalImporting ? "Import en cours…" : "Importer pour comparaison"}
                  </button>
                </div>
              </>
            ) : (
              <div>
                <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
                  <CheckCircle2 size={40} color="#0891b2" style={{ marginBottom: 10 }} />
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
                    Fichier importé
                  </h4>
                  <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 16px" }}>
                    {externalImportResult.imported.toLocaleString("fr-FR")} sites sur {externalImportResult.periods.join(", ")}
                  </p>
                  <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
                    Ouvrez l'onglet <strong>Comparaison</strong> d'un batch pour voir les écarts.
                  </p>
                </div>
                <button onClick={() => { setShowExternalImport(false); setActiveTab("comparaison"); }}
                  style={{ width: "100%", padding: "10px 0", borderRadius: 12, border: "none",
                    background: "#0891b2", fontSize: 13, fontWeight: 600, color: "white",
                    cursor: "pointer" }}>
                  Voir la comparaison
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}