// src/features/marge-dashboard/MargeDashboardPage.tsx
import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react";
import * as XLSX from "xlsx";
import {
  TrendingDown, TrendingUp, Percent, Scale, Search, ChevronLeft, ChevronRight,
  Download, Upload, X, CheckCircle, AlertCircle,
} from "lucide-react";
import { useMargeDashboard, importMargeDashboard, type MargeRow, type MargePeriod, type ImportResult } from "./api";
import {
  applyScope, annotateBase, applyFilters, computeKpis, computeInsights, groupSumNok,
  groupCount, reliabilityBuckets, trendBuckets, transitionMatrix, coverageSplit,
  magnitudeBuckets, typoFamily, typoExactOptions, typoFamilyOptions, fmtXof, fmtXofExact,
  fmtPct, EMPTY_FILTERS, CLIENT_FAMILIES, clientFamilyLabel,
  type ScopeMode, type BaseMode, type Filters, type AnnotatedRow,
} from "./calc";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  blue: { 950: "#0B1F4D", 900: "#0F235A", 800: "#123C8C", 700: "#1A56C4", 600: "#2464D6", 500: "#3272E0", 300: "#91B9F8", 100: "#E4EFFE", 50: "#F2F6FE" },
  slate: { 900: "#0F172A", 800: "#1E293B", 700: "#334155", 600: "#475569", 500: "#64748B", 400: "#94A3B8", 300: "#CBD5E1", 200: "#E2E8F0", 100: "#F1F5F9", 50: "#F8FAFC" },
  ok: { main: "#059669", light: "#D1FAE5", dark: "#065F46" },
  nok: { main: "#DC2626", light: "#FEE2E2", dark: "#991B1B" },
  warn: { main: "#D97706", light: "#FEF3C7", dark: "#92400E" },
  ras: { main: "#64748B", light: "#F1F5F9", dark: "#334155" },
};
const PAGE_SIZE = 100;
const MONTH_LABELS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const RADIUS = 10;
const CARD_SHADOW = "0 1px 2px rgba(15,23,42,.04), 0 1px 1px rgba(15,23,42,.03)";
const CARD_BORDER = "1px solid #E4E9F0";

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: "#fff", borderRadius: RADIUS, border: CARD_BORDER, boxShadow: CARD_SHADOW, padding: 20, ...style }}>
      {children}
    </div>
  );
}
function SectionTitle({ num, children, desc }: { num?: string; children: ReactNode; desc?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 9, margin: "32px 0 13px", flexWrap: "wrap" }}>
      {num ? <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, color: C.blue[700], background: C.blue[50], padding: "2px 7px", borderRadius: 4, fontWeight: 700, border: `1px solid ${C.blue[100]}` }}>{num}</span> : null}
      <h2 style={{ fontSize: 13.5, fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: ".03em", color: C.blue[950] }}>{children}</h2>
      {desc ? <span style={{ fontSize: 12, color: C.slate[400] }}>— {desc}</span> : null}
      <div style={{ flex: 1, height: 1, background: C.slate[200], minWidth: 24 }} />
    </div>
  );
}
function CardH3({ children }: { children: ReactNode }) {
  return <h3 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", color: C.slate[500], margin: "0 0 12px", fontWeight: 700 }}>{children}</h3>;
}
function KpiCard({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: ReactNode; accent: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: CARD_BORDER, boxShadow: CARD_SHADOW, padding: "18px 20px", minHeight: 104, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.slate[400], letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}15`, color: accent, display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, color: C.slate[900], letterSpacing: "-.02em", fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: C.slate[400] }}>{sub}</div> : null}
    </div>
  );
}
function RadioPill({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 13px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "background .12s, color .12s, border-color .12s",
        border: `1px solid ${checked ? C.blue[950] : "#E4E9F0"}`,
        background: checked ? C.blue[950] : "#fff", color: checked ? "#fff" : C.slate[600],
      }}
    >
      {children}
    </button>
  );
}
function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", background: C.slate[50], border: `1px solid #E4E9F0`, color: C.slate[800], borderRadius: 7, padding: "9px 11px", fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── Petit tableau brut réutilisable ──────────────────────────────────────────
function RawTable({ headers, rows, alignRight }: {
  headers: string[];
  rows: (string | number | null)[][];
  alignRight?: number[]; // indices de colonnes à aligner à droite
}) {
  const rightSet = new Set(alignRight ?? []);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.slate[200]}` }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "8px 10px", textAlign: rightSet.has(i) ? "right" : "left", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.slate[500], fontWeight: 800, whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: `1px solid ${C.slate[100]}`, background: ri % 2 === 0 ? "#fff" : C.slate[50] }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "8px 10px", textAlign: rightSet.has(ci) ? "right" : "left", color: C.slate[700], fontFamily: typeof cell === "number" ? "ui-monospace, Menlo, monospace" : undefined, whiteSpace: "nowrap" }}>
                  {cell === null || cell === undefined ? "—" : cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} style={{ padding: "20px 10px", textAlign: "center", color: C.slate[400], fontSize: 12 }}>Aucune donnée</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const SORT_ACCESSORS: Record<string, (r: AnnotatedRow) => string | number> = {
  site_id: (r) => r.site_id,
  site_name: (r) => r.site_name,
  region: (r) => r.region,
  batch: (r) => r.batch,
  marge_juin_est: (r) => r.marge_juin_est ?? 0,
  marge_reelle: (r) => r.marge_reelle ?? 0,
  ecart: (r) => (r.marge_reelle !== null && r.marge_juin_est !== null ? r.marge_reelle - r.marge_juin_est : 0),
  categorie_bo: (r) => r.categorie_bo,
  owner: (r) => r.owner,
  load_senelec_w: (r) => r.load_senelec_w ?? -1,
};

const CURRENT_YEAR = new Date().getFullYear();

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ── Export client-side XLSX ────────────────────────────────────────────────
function buildExcel(
  rows: MargeRow[],
  scoped: AnnotatedRow[],
  filtered: AnnotatedRow[],
  kpis: import("./calc").Kpis,
  base: BaseMode,
  scopeLabel: string,
  periodLabel: string,
) {
  const wb = XLSX.utils.book_new();

  const allRows = rows.map((r) => ({
    "Site ID": r.site_id,
    "Nom du site": r.site_name,
    "Région": r.region,
    "Batch": r.batch,
    "Typo facturée": r.typo_facturee,
    "Indoor/Outdoor": r.indoor_outdoor,
    "Modernisé": r.modernise,
    "Load Sénélec (W)": r.load_senelec_w ?? "",
    "Redevance Mai (XOF)": r.redevance_mai ?? "",
    "Redevance Juin (XOF)": r.redevance_juin ?? "",
    "Conso Mai (XOF)": r.conso_mai_xof ?? "",
    "Conso Juin (XOF)": r.conso_juin_xof ?? "",
    "Marge Est. Mai (XOF)": r.marge_mai_est ?? "",
    "Marge Est. Juin (XOF)": r.marge_juin_est ?? "",
    "Statut estimé": r.statut_est,
    "Factures réelles (XOF)": r.factures_reelles ?? "",
    "Marge réelle (XOF)": r.marge_reelle ?? "",
    "Statut réel": r.statut_reelle,
    "Catégorie BO": r.categorie_bo,
    "Commentaire BO": r.comment_bo,
    "Owner": r.owner,
    "Commentaire": r.commentaire,
  }));
  const ws1 = XLSX.utils.json_to_sheet(allRows);
  XLSX.utils.book_append_sheet(wb, ws1, "Tous les sites");

  const nokRows = filtered
    .filter((r) => r.statutActive === "NOK")
    .map((r) => {
      const ecart = r.marge_reelle !== null && r.marge_juin_est !== null ? r.marge_reelle - r.marge_juin_est : null;
      return {
        "Site ID": r.site_id,
        "Nom du site": r.site_name,
        "Région": r.region,
        "Batch": r.batch,
        "Typo facturée": r.typo_facturee,
        "Indoor/Outdoor": r.indoor_outdoor,
        "Modernisé": r.modernise,
        "Owner": r.owner,
        "Catégorie BO": r.categorie_bo,
        "Commentaire BO": r.comment_bo,
        "Commentaire": r.commentaire,
        "Load Sénélec (W)": r.load_senelec_w ?? "",
        "Redevance Juin (XOF)": r.redevance_juin ?? "",
        "Marge Est. Juin (XOF)": r.marge_juin_est ?? "",
        "Marge réelle (XOF)": r.marge_reelle ?? "",
        "Marge active (XOF)": r.margeActive ?? "",
        "Écart Réel−Est. (XOF)": ecart ?? "",
        "Statut estimé": r.statut_est,
        "Statut réel": r.statut_reelle,
      };
    });
  const ws2 = XLSX.utils.json_to_sheet(nokRows);
  XLSX.utils.book_append_sheet(wb, ws2, "Sites NOK");

  const kpiRows = [
    { "Indicateur": "Périmètre actif", "Valeur": scopeLabel },
    { "Indicateur": "Base de marge", "Valeur": base === "estimee" ? "Estimée (modèle catalogue)" : "Réelle (facture Sénélec)" },
    { "Indicateur": "Période", "Valeur": periodLabel },
    { "Indicateur": "Total sites périmètre", "Valeur": kpis.total },
    { "Indicateur": "Sites NOK", "Valeur": kpis.nokCount },
    { "Indicateur": "% sites NOK", "Valeur": kpis.nokPct.toFixed(2) + "%" },
    { "Indicateur": "Marge négative cumulée (XOF)", "Valeur": kpis.sumNok },
    { "Indicateur": "Marge nég. moy./site NOK (XOF)", "Valeur": Math.round(kpis.avgNok) },
    { "Indicateur": "Marge positive cumulée (XOF)", "Valeur": kpis.sumOk },
    { "Indicateur": "Solde net (XOF)", "Valeur": kpis.net },
    { "Indicateur": "Sites RAS (hors calcul)", "Valeur": kpis.rasCount },
  ];
  const ws3 = XLSX.utils.json_to_sheet(kpiRows);
  XLSX.utils.book_append_sheet(wb, ws3, "KPIs résumé");

  const nokScoped = scoped.filter((r) => r.statutActive === "NOK");
  const byRegionMap = new Map<string, { nok: number; sum: number; total: number }>();
  for (const r of scoped) {
    const key = r.region || "Non renseigné";
    const e = byRegionMap.get(key) ?? { nok: 0, sum: 0, total: 0 };
    e.total++;
    if (r.statutActive === "NOK") { e.nok++; e.sum += r.margeActive || 0; }
    byRegionMap.set(key, e);
  }
  const regionRows = Array.from(byRegionMap.entries())
    .sort((a, b) => a[1].sum - b[1].sum)
    .map(([label, v]) => ({
      "Région": label,
      "Sites total": v.total,
      "Sites NOK": v.nok,
      "% NOK": v.total ? (v.nok / v.total * 100).toFixed(1) + "%" : "—",
      "Marge négative cumulée (XOF)": v.sum,
    }));
  const ws4 = XLSX.utils.json_to_sheet(regionRows);
  XLSX.utils.book_append_sheet(wb, ws4, "Par région");

  const byCatMap = new Map<string, { nok: number; sum: number; total: number }>();
  for (const r of scoped) {
    const key = r.categorie_bo || "Non renseigné";
    const e = byCatMap.get(key) ?? { nok: 0, sum: 0, total: 0 };
    e.total++;
    if (r.statutActive === "NOK") { e.nok++; e.sum += r.margeActive || 0; }
    byCatMap.set(key, e);
  }
  const catRows = Array.from(byCatMap.entries())
    .sort((a, b) => a[1].sum - b[1].sum)
    .map(([label, v]) => ({
      "Catégorie BO": label,
      "Sites total": v.total,
      "Sites NOK": v.nok,
      "% NOK": v.total ? (v.nok / v.total * 100).toFixed(1) + "%" : "—",
      "Marge négative cumulée (XOF)": v.sum,
    }));
  const ws5 = XLSX.utils.json_to_sheet(catRows);
  XLSX.utils.book_append_sheet(wb, ws5, "Par catégorie BO");

  const byBatchMap = new Map<string, { nok: number; sum: number; total: number }>();
  for (const r of scoped) {
    const key = r.batch || "Non renseigné";
    const e = byBatchMap.get(key) ?? { nok: 0, sum: 0, total: 0 };
    e.total++;
    if (r.statutActive === "NOK") { e.nok++; e.sum += r.margeActive || 0; }
    byBatchMap.set(key, e);
  }
  const batchRows = Array.from(byBatchMap.entries())
    .sort((a, b) => a[1].sum - b[1].sum)
    .map(([label, v]) => ({
      "Batch": label,
      "Sites total": v.total,
      "Sites NOK": v.nok,
      "% NOK": v.total ? (v.nok / v.total * 100).toFixed(1) + "%" : "—",
      "Marge négative cumulée (XOF)": v.sum,
    }));
  const ws6 = XLSX.utils.json_to_sheet(batchRows);
  XLSX.utils.book_append_sheet(wb, ws6, "Par batch");

  const MAG: [string, (v: number) => boolean][] = [
    ["0 à -50k", (v) => v >= -50000],
    ["-50k à -100k", (v) => v >= -100000 && v < -50000],
    ["-100k à -250k", (v) => v >= -250000 && v < -100000],
    ["-250k à -500k", (v) => v >= -500000 && v < -250000],
    ["-500k à -1M", (v) => v >= -1000000 && v < -500000],
    ["< -1M", (v) => v < -1000000],
  ];
  const magRows = MAG.map(([label, test]) => {
    const sites = nokScoped.filter((r) => test(r.margeActive || 0));
    return {
      "Tranche de marge négative": label,
      "Nombre de sites NOK": sites.length,
      "Marge cumulée (XOF)": sites.reduce((s, r) => s + (r.margeActive || 0), 0),
    };
  });
  const ws7 = XLSX.utils.json_to_sheet(magRows);
  XLSX.utils.book_append_sheet(wb, ws7, "Distribution magnitude");

  const annotationRows = rows.map((r) => ({
    "site_id": r.site_id,
    "site_name": r.site_name,
    "region": r.region,
    "batch": r.batch,
    "typo_facturee": r.typo_facturee,
    "marge_juin_est": r.marge_juin_est ?? "",
    "marge_reelle": r.marge_reelle ?? "",
    "statut_est": r.statut_est,
    "statut_reelle": r.statut_reelle,
    "categorie_bo": r.categorie_bo,
    "comment_bo": r.comment_bo,
    "owner": r.owner,
    "commentaire": r.commentaire,
  }));
  const ws8 = XLSX.utils.json_to_sheet(annotationRows);
  XLSX.utils.book_append_sheet(wb, ws8, "Annotations (import)");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `marge_dashboard_${date}.xlsx`);
}

export default function MargeDashboardPage() {
  const [period, setPeriod] = useState<MargePeriod | undefined>(undefined);
  const { data, isLoading, isError } = useMargeDashboard(period);

  const [dateFrom, setDateFrom] = useState(`${CURRENT_YEAR}-01-01`);
  const [dateTo, setDateTo] = useState(todayIso());

  const filteredPeriods = useMemo(() => {
    const all = data?.meta?.available_periods ?? [];
    const fromKey = dateFrom.slice(0, 7);
    const toKey = dateTo.slice(0, 7);
    return all.filter((p) => {
      const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
      return key >= fromKey && key <= toKey;
    });
  }, [data?.meta?.available_periods, dateFrom, dateTo]);

  useEffect(() => {
    const meta = data?.meta;
    if (!meta) return;
    const stillValid = filteredPeriods.some((p) => p.year === meta.reelle_year && p.month === meta.reelle_month);
    if (!stillValid && filteredPeriods.length) {
      const latest = filteredPeriods[filteredPeriods.length - 1];
      setPeriod({ year: latest.year, month: latest.month });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPeriods]);

  const [scopeMode, setScopeMode] = useState<ScopeMode>("family");
  const [scopeValue, setScopeValue] = useState(CLIENT_FAMILIES[0].key);
  const [multiValues, setMultiValues] = useState<string[]>([]);
  const [base, setBase] = useState<BaseMode>("estimee");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState("marge_juin_est");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    setImportError(null);
    try {
      const result = await importMargeDashboard(file);
      setImportResult(result);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erreur lors de l'import.";
      setImportError(msg);
    } finally {
      setImportLoading(false);
    }
  }

  const rows = data?.rows ?? [];
  const typoFamilies = useMemo(() => typoFamilyOptions(rows), [rows]);
  const typoExacts = useMemo(() => typoExactOptions(rows), [rows]);

  const scoped = useMemo(() => {
    const filtered = applyScope(rows, scopeMode, scopeValue, multiValues);
    return annotateBase(filtered, base);
  }, [rows, scopeMode, scopeValue, multiValues, base]);

  const regionOptions = useMemo(() => Array.from(new Set(scoped.map((r) => r.region))).sort(), [scoped]);
  const batchOptions = useMemo(() => Array.from(new Set(scoped.map((r) => r.batch))).sort(), [scoped]);
  const catOptions = useMemo(() => Array.from(new Set(scoped.map((r) => r.categorie_bo))).sort(), [scoped]);
  const ownerOptions = useMemo(() => Array.from(new Set(scoped.map((r) => r.owner))).sort(), [scoped]);

  const filtered = useMemo(() => applyFilters(scoped, filters), [scoped, filters]);
  const kpis = useMemo(() => computeKpis(scoped), [scoped]);
  const insights = useMemo(() => computeInsights(scoped, base), [scoped, base]);

  const bySubcat = useMemo(() => {
    if (scopeMode === "family" && scopeValue) {
      return groupSumNok(scoped, (r) => {
        const fam = typoFamily(r.typo_facturee);
        const suffix = r.typo_facturee.slice(fam.length).trim();
        return suffix || fam;
      });
    }
    return groupSumNok(scoped, (r) => r.batch);
  }, [scoped, scopeMode, scopeValue]);

  const reliabilityData = useMemo(() => (base === "estimee" ? trendBuckets(scoped) : reliabilityBuckets(scoped)), [scoped, base]);
  const transitions = useMemo(() => transitionMatrix(scoped), [scoped]);
  const coverage = useMemo(() => coverageSplit(scoped), [scoped]);

  const nokScoped = useMemo(() => scoped.filter((r) => r.statutActive === "NOK"), [scoped]);
  const ioPie = useMemo(() => groupCount(nokScoped, (r) => r.indoor_outdoor), [nokScoped]);
  const modPie = useMemo(() => groupCount(nokScoped, (r) => r.modernise), [nokScoped]);
  const ownerPie = useMemo(() => groupCount(nokScoped, (r) => r.owner), [nokScoped]);
  const buckets = useMemo(() => magnitudeBuckets(scoped), [scoped]);

  // Données brutes par région / catégorie BO
  const byRegionFull = useMemo(() => {
    const map = new Map<string, { nok: number; sum: number; total: number }>();
    for (const r of scoped) {
      const key = r.region || "Non renseigné";
      const e = map.get(key) ?? { nok: 0, sum: 0, total: 0 };
      e.total++;
      if (r.statutActive === "NOK") { e.nok++; e.sum += r.margeActive || 0; }
      map.set(key, e);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].sum - b[1].sum)
      .map(([label, v]) => ({ label, ...v }));
  }, [scoped]);

  const byCatFull = useMemo(() => {
    const map = new Map<string, { nok: number; sum: number; total: number }>();
    for (const r of scoped) {
      const key = r.categorie_bo || "Non renseigné";
      const e = map.get(key) ?? { nok: 0, sum: 0, total: 0 };
      e.total++;
      if (r.statutActive === "NOK") { e.nok++; e.sum += r.margeActive || 0; }
      map.set(key, e);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].sum - b[1].sum)
      .map(([label, v]) => ({ label, ...v }));
  }, [scoped]);

  const nokFiltered = useMemo(() => filtered.filter((r) => r.statutActive === "NOK"), [filtered]);
  const sorted = useMemo(() => {
    const acc = SORT_ACCESSORS[sortKey] ?? SORT_ACCESSORS.marge_reelle;
    return [...nokFiltered].sort((a, b) => {
      const av = acc(a), bv = acc(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [nokFiltered, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function changeScope(mode: ScopeMode) {
    setScopeMode(mode);
    setScopeValue(mode === "family" ? CLIENT_FAMILIES[0].key : mode === "exact" ? typoExacts[0] ?? "" : "");
    setMultiValues([]);
    setPage(1);
  }
  function changeBase(b: BaseMode) {
    setBase(b);
    setSortKey(b === "estimee" ? "marge_juin_est" : "marge_reelle");
    setSortDir("asc");
    setPage(1);
  }
  function sortBy(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  if (isLoading) {
    return <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: C.slate[500] }}>Chargement du Dashboard Marge…</div>;
  }
  if (isError || !data) {
    return <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: C.nok.main }}>Erreur de chargement des données.</div>;
  }

  const meta = data.meta;
  const scopeLabel = scopeMode === "portfolio" ? "Portefeuille entier" : scopeMode === "family" ? "Famille de typologie" : scopeMode === "exact" ? "Typologie exacte" : "Sélection de typologies";
  const periodLabel = `${MONTH_LABELS[meta.reelle_month - 1]} ${meta.reelle_year}`;

  // ─── Données tableau répartition statut ──────────────────────────────────
  const nok = scoped.filter((r) => r.statutActive === "NOK").length;
  const ok  = scoped.filter((r) => r.statutActive === "OK").length;
  const ras = scoped.filter((r) => r.statutActive === "RAS").length;
  const statutRows: (string | number)[][] = [
    ["NOK", nok, scoped.length ? (nok / scoped.length * 100).toFixed(1) + " %" : "—"],
    ["OK",  ok,  scoped.length ? (ok  / scoped.length * 100).toFixed(1) + " %" : "—"],
    ["RAS", ras, scoped.length ? (ras / scoped.length * 100).toFixed(1) + " %" : "—"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <header style={{ background: "#fff", borderRadius: 20, padding: "22px 24px 20px", boxShadow: CARD_SHADOW, border: CARD_BORDER, marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.blue[700], marginBottom: 8 }}>
              Aktivco · Grid &amp; Energy Manager · Module Évaluation Financière
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 6px", letterSpacing: "-.03em", color: "#0f172a" }}>Dashboard d'Analyse de Marge Grid — Focus Sites en Marge Négative</h1>
            <div style={{ fontSize: 13, color: "#64748b", maxWidth: 760, lineHeight: 1.5 }}>
              Comparaison {meta.month_a_label} → {meta.month_b_label} {meta.year} — {scopeLabel}
              {scopeMode !== "portfolio" && scopeValue ? <> · <span style={{ fontFamily: "ui-monospace, Menlo, monospace", background: C.blue[50], color: C.blue[700], padding: "2px 8px", borderRadius: 20, border: `1px solid ${C.blue[100]}` }}>{clientFamilyLabel(scopeValue) ?? scopeValue}</span></> : null}
              {" — "}<strong style={{ color: "#0f172a" }}>{kpis.total.toLocaleString("fr-FR")} sites</strong>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0, alignItems: "center" }}>
            <button
              onClick={() => buildExcel(rows, scoped, filtered, kpis, base, scopeLabel + (scopeValue ? ` · ${clientFamilyLabel(scopeValue) ?? scopeValue}` : ""), periodLabel)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1px solid ${C.blue[100]}`, background: C.blue[50], color: C.blue[800], transition: "opacity .12s" }}
              aria-label="Exporter en Excel"
            >
              <Download size={15} /> Exporter
            </button>
            <button
              onClick={() => { setImportOpen(true); setImportResult(null); setImportError(null); }}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1px solid ${C.blue[950]}`, background: C.blue[950], color: "#fff", transition: "opacity .12s" }}
              aria-label="Importer un fichier Excel"
            >
              <Upload size={15} /> Importer
            </button>
          </div>
        </div>
      </header>

      {/* ── Modal Import ─────────────────────────────────────────────────── */}
      {importOpen && (
        <div role="dialog" aria-modal="true" aria-label="Import fichier Excel"
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setImportOpen(false); }}
        >
          <div style={{ background: "#fff", borderRadius: 18, padding: "28px 30px 24px", width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(15,23,42,.22)", position: "relative" }}>
            <button onClick={() => setImportOpen(false)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: C.slate[400], padding: 4, lineHeight: 0 }} aria-label="Fermer">
              <X size={18} />
            </button>
            <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.blue[700], marginBottom: 6 }}>Import Excel</div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 6px", color: C.slate[900] }}>Importer les annotations</h2>
            <p style={{ fontSize: 13, color: C.slate[500], margin: "0 0 20px", lineHeight: 1.5 }}>
              Sélectionnez un fichier Excel exporté depuis cette page, renseignez les colonnes Catégorie BO, Owner, Commentaire, puis importez.
            </p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls"
              style={{ display: "block", width: "100%", padding: "10px 12px", border: `1px solid ${C.slate[200]}`, borderRadius: 8, fontSize: 13, marginBottom: 16, boxSizing: "border-box" }}
              aria-label="Choisir un fichier Excel"
              onChange={() => { setImportResult(null); setImportError(null); }}
            />
            {importError && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: C.nok.light, borderRadius: 8, marginBottom: 14, fontSize: 13, color: C.nok.dark }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />{importError}
              </div>
            )}
            {importResult && (
              <div style={{ padding: "12px 14px", background: importResult.errors.length ? C.warn.light : C.ok.light, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: importResult.errors.length ? C.warn.dark : C.ok.dark, marginBottom: importResult.errors.length ? 8 : 0 }}>
                  <CheckCircle size={16} style={{ flexShrink: 0 }} />
                  {importResult.updated} ligne{importResult.updated !== 1 ? "s" : ""} mise{importResult.updated !== 1 ? "s" : ""} à jour · {importResult.skipped} ignorée{importResult.skipped !== 1 ? "s" : ""}
                </div>
                {importResult.errors.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 18, color: C.warn.dark }}>
                    {importResult.errors.map((e, i) => <li key={i} style={{ marginBottom: 3 }}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setImportOpen(false)} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: `1px solid ${C.slate[200]}`, background: "#fff", color: C.slate[700], cursor: "pointer" }}>Fermer</button>
              <button onClick={handleImport} disabled={importLoading}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: importLoading ? "default" : "pointer", border: `1px solid ${C.blue[950]}`, background: C.blue[950], color: "#fff", opacity: importLoading ? .6 : 1 }}
              >
                <Upload size={14} />{importLoading ? "Import en cours…" : "Valider l'import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sélecteurs §1/§2/§3 ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr .7fr", gap: 14, marginBottom: 22 }}>
        <Card>
          <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".08em", color: C.slate[400], fontWeight: 800, marginBottom: 10 }}>① Sélecteur de périmètre typologique</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <RadioPill checked={scopeMode === "portfolio"} onClick={() => changeScope("portfolio")}>Portefeuille entier</RadioPill>
            <RadioPill checked={scopeMode === "family"} onClick={() => changeScope("family")}>Famille de typologie</RadioPill>
            <RadioPill checked={scopeMode === "exact"} onClick={() => changeScope("exact")}>Typologie exacte</RadioPill>
            <RadioPill checked={scopeMode === "multi"} onClick={() => changeScope("multi")}>Sélection de typologies</RadioPill>
          </div>
          {scopeMode === "family" && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: C.slate[400], fontWeight: 800, marginBottom: 7 }}>Secteurs</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {CLIENT_FAMILIES.map((f) => {
                  const checked = scopeValue === f.key;
                  return (
                    <button key={f.key} onClick={() => { setScopeValue(f.key); setPage(1); }}
                      style={{ padding: "6px 13px", borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: "pointer", border: `1px solid ${checked ? C.blue[700] : C.slate[200]}`, background: checked ? C.blue[700] : "#fff", color: checked ? "#fff" : C.slate[600] }}
                    >{f.label}</button>
                  );
                })}
              </div>
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: C.slate[400], fontWeight: 800, marginBottom: 7 }}>Autre famille</div>
              <Select value={scopeValue} onChange={(v) => { setScopeValue(v); setPage(1); }} options={typoFamilies} placeholder="— Choisir une famille —" />
            </div>
          )}
          {scopeMode === "exact" && (
            <div style={{ marginTop: 12 }}>
              <Select value={scopeValue} onChange={(v) => { setScopeValue(v); setPage(1); }} options={typoExacts} placeholder="— Choisir une typologie —" />
            </div>
          )}
          {scopeMode === "multi" && (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 110, overflowY: "auto" }}>
              {typoExacts.map((t) => {
                const checked = multiValues.includes(t);
                return (
                  <button key={t} onClick={() => { setMultiValues((prev) => checked ? prev.filter((x) => x !== t) : [...prev, t]); setPage(1); }}
                    style={{ padding: "5px 11px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, cursor: "pointer", border: `1px solid ${checked ? C.blue[700] : C.slate[200]}`, background: checked ? C.blue[50] : "#fff", color: checked ? C.blue[700] : C.slate[600] }}
                  >{t}</button>
                );
              })}
            </div>
          )}
        </Card>
        <Card>
          <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".08em", color: C.slate[400], fontWeight: 800, marginBottom: 10 }}>② Sélecteur de base de marge</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <RadioPill checked={base === "estimee"} onClick={() => changeBase("estimee")}>Marge estimée (modèle catalogue)</RadioPill>
            <RadioPill checked={base === "reelle"} onClick={() => changeBase("reelle")}>Marge réelle (facture Sénélec)</RadioPill>
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".08em", color: C.slate[400], fontWeight: 800, marginBottom: 10 }}>③ Période (marge réelle)</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: C.slate[400], fontWeight: 700, marginBottom: 3 }}>Du</div>
              <input type="date" value={dateFrom} max={dateTo} onChange={(e) => e.target.value && setDateFrom(e.target.value)}
                style={{ width: "100%", background: C.slate[50], border: `1px solid ${C.slate[200]}`, color: C.slate[800], borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 700 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: C.slate[400], fontWeight: 700, marginBottom: 3 }}>Au</div>
              <input type="date" value={dateTo} min={dateFrom} onChange={(e) => e.target.value && setDateTo(e.target.value)}
                style={{ width: "100%", background: C.slate[50], border: `1px solid ${C.slate[200]}`, color: C.slate[800], borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 700 }} />
            </div>
          </div>
          <select
            value={filteredPeriods.some((p) => p.year === meta.reelle_year && p.month === meta.reelle_month) ? `${meta.reelle_year}-${meta.reelle_month}` : ""}
            onChange={(e) => { const [y, m] = e.target.value.split("-").map(Number); setPeriod({ year: y, month: m }); }}
            style={{ width: "100%", background: C.slate[50], border: `1px solid ${C.slate[200]}`, color: C.slate[800], borderRadius: 10, padding: "10px 12px", fontSize: 12.5, cursor: "pointer", fontWeight: 700 }}
          >
            {!filteredPeriods.length && <option value="">— Aucun mois dans cette plage —</option>}
            {filteredPeriods.map((p) => (
              <option key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>
                {MONTH_LABELS[p.month - 1]} {p.year}{p.year === CURRENT_YEAR ? " · année en cours" : ""}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: C.slate[400], marginTop: 9, lineHeight: 1.4 }}>
            {filteredPeriods.length} mois avec facture Sénélec rapprochée dans la plage choisie (sur {meta.available_periods.length} au total).
          </div>
        </Card>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 10 }}>
        <KpiCard label="Sites NOK" value={kpis.nokCount.toLocaleString("fr-FR")} sub={`${fmtPct(kpis.nokPct)} du périmètre`} icon={<TrendingDown size={17} />} accent={C.nok.main} />
        <KpiCard label="Marge négative cumulée" value={fmtXof(kpis.sumNok)} sub={fmtXofExact(kpis.sumNok)} icon={<TrendingDown size={17} />} accent={C.nok.main} />
        <KpiCard label="Marge nég. moy. / site NOK" value={fmtXof(kpis.avgNok)} sub={fmtXofExact(kpis.avgNok)} icon={<Percent size={17} />} accent={C.warn.main} />
        <KpiCard label="Marge positive cumulée" value={fmtXof(kpis.sumOk)} sub={fmtXofExact(kpis.sumOk)} icon={<TrendingUp size={17} />} accent={C.ok.main} />
        <KpiCard label="Solde net · RAS" value={fmtXof(kpis.net)} sub={`${kpis.rasCount.toLocaleString("fr-FR")} sites hors calcul`} icon={<Scale size={17} />} accent={C.blue[700]} />
      </div>

      {/* ── Détail des sites en marge négative (EN HAUT) ─────────────────── */}
      <SectionTitle desc="Triable, filtrable, recherche libre">Détail des sites en marge négative</SectionTitle>
      <Card>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <div style={{ position: "relative", minWidth: 230 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: C.slate[400] }} />
            <input type="text" placeholder="Rechercher site, ID, commentaire..."
              value={filters.search}
              onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setPage(1); }}
              style={{ width: "100%", padding: "8px 12px 8px 30px", borderRadius: 8, border: `1px solid ${C.slate[200]}`, fontSize: 12.5, background: C.slate[50] }}
            />
          </div>
          <div style={{ minWidth: 150 }}><Select value={filters.region} onChange={(v) => { setFilters((f) => ({ ...f, region: v })); setPage(1); }} options={regionOptions} placeholder="Toutes régions" /></div>
          <div style={{ minWidth: 150 }}><Select value={filters.batch} onChange={(v) => { setFilters((f) => ({ ...f, batch: v })); setPage(1); }} options={batchOptions} placeholder="Tous batchs" /></div>
          <div style={{ minWidth: 190 }}><Select value={filters.categorieBo} onChange={(v) => { setFilters((f) => ({ ...f, categorieBo: v })); setPage(1); }} options={catOptions} placeholder="Toutes catégories BO" /></div>
          <div style={{ minWidth: 150 }}><Select value={filters.owner} onChange={(v) => { setFilters((f) => ({ ...f, owner: v })); setPage(1); }} options={ownerOptions} placeholder="Tous owners" /></div>
          <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5, color: C.blue[700], background: C.blue[50], border: `1px solid ${C.blue[100]}`, borderRadius: 20, padding: "6px 13px", fontWeight: 700 }}>
            {sorted.length.toLocaleString("fr-FR")} / {kpis.nokCount.toLocaleString("fr-FR")} sites NOK
          </span>
        </div>

        <div style={{ overflowX: "auto", border: `1px solid ${C.slate[200]}`, borderRadius: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr>
                {[
                  ["site_id", "Site ID"], ["site_name", "Nom du site"], ["region", "Région"], ["batch", "Batch"],
                  ["marge_juin_est", "Marge Estimée (XOF)"], ["marge_reelle", "Marge Réelle (XOF)"], ["ecart", "Écart Réel−Est."],
                  ["categorie_bo", "Catégorie BO"], ["owner", "Owner"], ["load_senelec_w", "Load Senelec (W)"],
                ].map(([key, label]) => (
                  <th key={key} onClick={() => sortBy(key)}
                    style={{ position: "sticky", top: 0, background: C.slate[50], textAlign: "left", padding: "10px 13px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: sortKey === key ? C.blue[700] : C.slate[500], borderBottom: `1px solid ${C.slate[200]}`, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 800 }}
                  >
                    {label}{sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => {
                const ecart = r.marge_reelle !== null && r.marge_juin_est !== null ? r.marge_reelle - r.marge_juin_est : null;
                return (
                  <tr key={r.site_id} style={{ borderBottom: `1px solid ${C.slate[100]}` }}>
                    <td style={{ padding: "9px 13px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>{r.site_id}</td>
                    <td style={{ padding: "9px 13px", fontWeight: 700, color: C.slate[800], maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.site_name}>{r.site_name}</td>
                    <td style={{ padding: "9px 13px", color: C.slate[600] }}>{r.region}</td>
                    <td style={{ padding: "9px 13px", color: C.slate[600] }}>{r.batch}</td>
                    <td style={{ padding: "9px 13px", fontFamily: "ui-monospace, Menlo, monospace", color: C.nok.main, fontWeight: 700 }}>{fmtXofExact(r.marge_juin_est)}</td>
                    <td style={{ padding: "9px 13px", fontFamily: "ui-monospace, Menlo, monospace", color: C.nok.main, fontWeight: 700 }}>{fmtXofExact(r.marge_reelle)}</td>
                    <td style={{ padding: "9px 13px", fontFamily: "ui-monospace, Menlo, monospace", color: C.slate[700] }}>{ecart === null ? "—" : (ecart >= 0 ? "+" : "") + ecart.toLocaleString("fr-FR")}</td>
                    <td style={{ padding: "9px 13px", color: C.slate[600], maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.categorie_bo}>{r.categorie_bo}</td>
                    <td style={{ padding: "9px 13px", color: C.slate[600] }}>{r.owner}</td>
                    <td style={{ padding: "9px 13px", fontFamily: "ui-monospace, Menlo, monospace", color: C.slate[700] }}>{r.load_senelec_w === null ? "—" : Math.round(r.load_senelec_w).toLocaleString("fr-FR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 12, fontSize: 12, color: C.slate[500] }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            style={{ display: "flex", alignItems: "center", gap: 4, background: C.slate[50], border: `1px solid ${C.slate[200]}`, borderRadius: 8, padding: "7px 14px", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1, fontWeight: 700, color: C.blue[950] }}
          ><ChevronLeft size={13} /> Précédent</button>
          <span>Page {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            style={{ display: "flex", alignItems: "center", gap: 4, background: C.slate[50], border: `1px solid ${C.slate[200]}`, borderRadius: 8, padding: "7px 14px", cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1, fontWeight: 700, color: C.blue[950] }}
          >Suivant <ChevronRight size={13} /></button>
        </div>
      </Card>

      {/* ── Diagnostic rapide ────────────────────────────────────────────── */}
      <SectionTitle>Diagnostic rapide</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: RADIUS, border: CARD_BORDER, borderLeft: `3px solid ${C.blue[700]}`, boxShadow: CARD_SHADOW, padding: "16px 18px" }}>
            <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 17, fontWeight: 700, color: C.blue[950], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ins.big}</div>
            <div style={{ fontSize: 12, color: C.slate[600], marginTop: 8, fontWeight: 700, lineHeight: 1.45 }}>
              {ins.label}<br /><span style={{ color: C.slate[400], fontWeight: 500 }}>{ins.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Répartition du statut & fiabilité ────────────────────────────── */}
      <SectionTitle desc="Statut de marge sur le périmètre actif">Répartition et fiabilité</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card>
          <CardH3>Statut marge — périmètre actif ({scoped.length.toLocaleString("fr-FR")} sites)</CardH3>
          <RawTable
            headers={["Statut", "Sites", "% du périmètre"]}
            rows={statutRows}
            alignRight={[1, 2]}
          />
        </Card>
        <Card>
          <CardH3>{base === "estimee" ? "Tendance sites NOK — Mai → Juin" : "Fiabilité du modèle — Écart Réel vs Estimation"}</CardH3>
          <RawTable
            headers={["Bucket", "Sites"]}
            rows={reliabilityData.map((d) => [d.label, d.count])}
            alignRight={[1]}
          />
        </Card>
      </div>

      {/* ── Transition de statut (base réelle uniquement) ─────────────────── */}
      {base === "reelle" && (
        <>
          <SectionTitle desc="Comment le statut modèle évolue une fois la facture réelle disponible">Transition de statut — estimation → réel</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Card>
              <CardH3>Sites par trajectoire (estimé → réel)</CardH3>
              <RawTable
                headers={["Trajectoire", "Sites"]}
                rows={transitions.map((t) => [t.label, t.count])}
                alignRight={[1]}
              />
            </Card>
            <Card>
              <CardH3>Couverture des factures réelles</CardH3>
              <RawTable
                headers={["Couverture", "Sites"]}
                rows={coverage.map((c) => [c.label, c.count])}
                alignRight={[1]}
              />
            </Card>
          </div>
        </>
      )}

      {/* ── Localisation & causes racines ────────────────────────────────── */}
      <SectionTitle desc="Région O&M · catégorie BO">Localisation et causes racines</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card>
          <CardH3>Marge négative cumulée par région</CardH3>
          <RawTable
            headers={["Région", "Total", "NOK", "% NOK", "Marge nég. cumulée (XOF)"]}
            rows={byRegionFull.map((v) => [
              v.label,
              v.total.toLocaleString("fr-FR"),
              v.nok.toLocaleString("fr-FR"),
              v.total ? (v.nok / v.total * 100).toFixed(1) + " %" : "—",
              fmtXofExact(v.sum),
            ])}
            alignRight={[1, 2, 3, 4]}
          />
        </Card>
        <Card>
          <CardH3>Catégorie BO (cause identifiée)</CardH3>
          <RawTable
            headers={["Catégorie BO", "Total", "NOK", "% NOK", "Marge nég. cumulée (XOF)"]}
            rows={byCatFull.map((v) => [
              v.label,
              v.total.toLocaleString("fr-FR"),
              v.nok.toLocaleString("fr-FR"),
              v.total ? (v.nok / v.total * 100).toFixed(1) + " %" : "—",
              fmtXofExact(v.sum),
            ])}
            alignRight={[1, 2, 3, 4]}
          />
        </Card>
      </div>

      {/* ── Par sous-typo / batch ─────────────────────────────────────────── */}
      <SectionTitle desc={scopeMode === "family" ? "Variantes au sein de la famille sélectionnée" : "Vague de déploiement / commissioning"}>
        {scopeMode === "family" ? "Marge négative par sous-typologie" : "Marge négative par batch opérationnel"}
      </SectionTitle>
      <Card>
        <RawTable
          headers={[scopeMode === "family" ? "Sous-typologie" : "Batch", "Marge nég. cumulée (XOF)"]}
          rows={bySubcat.map((d) => [d.label, fmtXofExact(d.sum)])}
          alignRight={[1]}
        />
      </Card>

      {/* ── Paramètres essentiels ─────────────────────────────────────────── */}
      <SectionTitle desc="Configuration site · propriétaire d'action · magnitude">Paramètres essentiels à l'analyse</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        <Card>
          <CardH3>Indoor vs Outdoor (sites NOK)</CardH3>
          <RawTable
            headers={["Type", "Sites NOK"]}
            rows={ioPie.map((d) => [d.label, d.count.toLocaleString("fr-FR")])}
            alignRight={[1]}
          />
        </Card>
        <Card>
          <CardH3>Statut de modernisation (sites NOK)</CardH3>
          <RawTable
            headers={["Modernisé", "Sites NOK"]}
            rows={modPie.map((d) => [d.label, d.count.toLocaleString("fr-FR")])}
            alignRight={[1]}
          />
        </Card>
        <Card>
          <CardH3>Owner d'action assigné (sites NOK)</CardH3>
          <RawTable
            headers={["Owner", "Sites NOK"]}
            rows={ownerPie.map((d) => [d.label, d.count.toLocaleString("fr-FR")])}
            alignRight={[1]}
          />
        </Card>
      </div>
      <Card style={{ marginTop: 14 }}>
        <CardH3>Distribution de la magnitude de marge négative</CardH3>
        <RawTable
          headers={["Tranche (XOF)", "Sites NOK", "% des NOK", "Marge cumulée (XOF)"]}
          rows={buckets.map((b) => [
            b.label,
            b.count.toLocaleString("fr-FR"),
            kpis.nokCount ? (b.count / kpis.nokCount * 100).toFixed(1) + " %" : "—",
            fmtXofExact((b as any).sum ?? 0),
          ])}
          alignRight={[1, 2, 3]}
        />
      </Card>

      <footer style={{ marginTop: 36, paddingTop: 16, borderTop: `1px solid ${C.slate[200]}`, fontSize: 11, color: C.slate[400], fontFamily: "ui-monospace, Menlo, monospace", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span>Aktivco Grid &amp; Energy Manager — Module Évaluation Financière</span>
        <span>Marge estimée = redevance grid − estimation consommation · Marge réelle = redevance grid − facture Sénélec</span>
      </footer>
    </div>
  );
}
