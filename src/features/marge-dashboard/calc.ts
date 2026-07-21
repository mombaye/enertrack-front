// src/features/marge-dashboard/calc.ts
// Moteur de calcul pur (sans dépendance React) — §3 à §6 du CDC Dashboard
// Marge Grid : sélecteur de périmètre (4 modes), base de marge, filtres
// transverses, indicateurs agrégés, regroupements pour les graphiques.
import type { MargeRow } from "./api";

export type ScopeMode = "portfolio" | "family" | "exact" | "multi";
export type BaseMode = "estimee" | "reelle";

export interface Filters {
  region: string;
  batch: string;
  categorieBo: string;
  owner: string;
  search: string;
}

export const EMPTY_FILTERS: Filters = { region: "", batch: "", categorieBo: "", owner: "", search: "" };

export function typoFamily(typo: string): string {
  const idx = typo.indexOf(" ");
  return idx === -1 ? typo : typo.slice(0, idx);
}
function normTypo(t: string): string {
  return (t || "").trim().toLowerCase();
}

export function typoExactOptions(rows: MargeRow[]): string[] {
  const map = new Map<string, string>();
  for (const r of rows) if (r.typo_facturee) map.set(normTypo(r.typo_facturee), r.typo_facturee);
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}
export function typoFamilyOptions(rows: MargeRow[]): string[] {
  const map = new Map<string, string>();
  for (const r of rows) {
    const fam = typoFamily(r.typo_facturee);
    if (fam) map.set(normTypo(fam), fam);
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

// ── §3 — Sélecteur de périmètre (4 modes : + multi-sélection libre) ────────
export function applyScope(
  rows: MargeRow[],
  mode: ScopeMode,
  value: string,
  multiValues: string[]
): MargeRow[] {
  if (mode === "portfolio") return rows;
  if (mode === "multi") {
    if (!multiValues.length) return rows;
    const set = new Set(multiValues.map(normTypo));
    return rows.filter((r) => set.has(normTypo(r.typo_facturee)));
  }
  if (!value) return rows;
  const v = normTypo(value);
  if (mode === "exact") return rows.filter((r) => normTypo(r.typo_facturee) === v);
  return rows.filter((r) => normTypo(r.typo_facturee).startsWith(v)); // family
}

// ── Annotation avec base de marge active (§4) ──────────────────────────────
export interface AnnotatedRow extends MargeRow {
  margeActive: number | null;
  margePrevActive: number | null;
  statutActive: "OK" | "NOK" | "RAS";
}
export function annotateBase(rows: MargeRow[], base: BaseMode): AnnotatedRow[] {
  const est = base === "estimee";
  return rows.map((r) => ({
    ...r,
    margeActive: est ? r.marge_juin_est : r.marge_reelle,
    margePrevActive: est ? r.marge_mai_est : null,
    statutActive: est ? r.statut_est : r.statut_reelle,
  }));
}

// ── §6 — Filtres transverses ────────────────────────────────────────────────
export function applyFilters(rows: AnnotatedRow[], f: Filters): AnnotatedRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.region && r.region !== f.region) return false;
    if (f.batch && r.batch !== f.batch) return false;
    if (f.categorieBo && r.categorie_bo !== f.categorieBo) return false;
    if (f.owner && r.owner !== f.owner) return false;
    if (q) {
      const hay = `${r.site_id} ${r.site_name} ${r.commentaire} ${r.comment_bo}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ── §5 — Indicateurs agrégés ─────────────────────────────────────────────────
export interface Kpis {
  total: number;
  nokCount: number;
  nokPct: number;
  sumNok: number;
  avgNok: number;
  sumOk: number;
  net: number;
  rasCount: number;
}
export function computeKpis(rows: AnnotatedRow[]): Kpis {
  const nok = rows.filter((r) => r.statutActive === "NOK");
  const ok = rows.filter((r) => r.statutActive === "OK");
  const ras = rows.filter((r) => r.statutActive === "RAS");
  const sumNok = nok.reduce((s, r) => s + (r.margeActive || 0), 0);
  const sumOk = ok.reduce((s, r) => s + (r.margeActive || 0), 0);
  return {
    total: rows.length,
    nokCount: nok.length,
    nokPct: rows.length ? (nok.length / rows.length) * 100 : 0,
    sumNok,
    avgNok: nok.length ? sumNok / nok.length : 0,
    sumOk,
    net: sumNok + sumOk,
    rasCount: ras.length,
  };
}

export interface GroupAgg {
  label: string;
  count: number;
  sum: number;
  totalGroup: number;
  pct: number;
}
function groupBy<T>(rows: T[], keyFn: (r: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyFn(r) || "Non renseigné";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  return map;
}
export function groupSumNok(rows: AnnotatedRow[], keyFn: (r: AnnotatedRow) => string): GroupAgg[] {
  const nok = rows.filter((r) => r.statutActive === "NOK");
  const grouped = groupBy(nok, keyFn);
  const totalGrouped = groupBy(rows, keyFn);
  const out: GroupAgg[] = [];
  for (const [label, items] of grouped.entries()) {
    const totalGroup = (totalGrouped.get(label) || []).length;
    out.push({
      label,
      count: items.length,
      sum: items.reduce((s, r) => s + (r.margeActive || 0), 0),
      totalGroup,
      pct: totalGroup ? (items.length / totalGroup) * 100 : 0,
    });
  }
  return out.sort((a, b) => a.sum - b.sum);
}
export function groupCount(rows: AnnotatedRow[], keyFn: (r: AnnotatedRow) => string): { label: string; count: number }[] {
  const map = groupBy(rows, keyFn);
  return Array.from(map.entries()).map(([label, items]) => ({ label, count: items.length }));
}

// ── §7.3 — Diagnostic rapide ────────────────────────────────────────────────
export interface Insight {
  label: string;
  big: string;
  sub: string;
}
export function computeInsights(rows: AnnotatedRow[], base: BaseMode): Insight[] {
  const byRegion = groupSumNok(rows, (r) => r.region);
  const byCat = groupSumNok(rows, (r) => r.categorie_bo);
  const topRegion = byRegion[0] || null;
  const topCat = byCat[0] || null;

  let coverage: Insight;
  if (base === "estimee") {
    const worse = rows.filter((r) => r.statutActive === "NOK" && (r.margePrevActive ?? 0) >= 0).length;
    coverage = {
      label: "Sites passés OK → NOK entre Mai et Juin",
      big: worse.toLocaleString("fr-FR"),
      sub: "Dégradation récente à investiguer en priorité",
    };
  } else {
    const pending = rows.filter((r) => r.statutActive === "RAS" && r.statut_est !== "RAS").length;
    coverage = {
      label: "Sites en attente de facture réelle",
      big: pending.toLocaleString("fr-FR"),
      sub: "Statut estimé connu, facture Sénélec pas encore rapprochée",
    };
  }

  return [
    {
      label: "Région la plus impactée",
      big: topRegion ? topRegion.label : "—",
      sub: topRegion ? `${topRegion.count.toLocaleString("fr-FR")} sites NOK · ${fmtXofExact(topRegion.sum)}` : "Aucun site NOK",
    },
    {
      label: "Cause racine dominante",
      big: topCat ? topCat.label : "—",
      sub: topCat ? `${topCat.count.toLocaleString("fr-FR")} sites NOK · ${fmtXofExact(topCat.sum)}` : "Aucune catégorie renseignée",
    },
    coverage,
  ];
}

// ── §4.3 — Comparaison estimation vs réel ──────────────────────────────────
export function reliabilityBuckets(rows: AnnotatedRow[]): { label: string; count: number }[] {
  const worse = rows.filter((r) => r.marge_reelle !== null && r.marge_juin_est !== null && r.marge_reelle - r.marge_juin_est < -50000).length;
  const aligned = rows.filter((r) => r.marge_reelle !== null && r.marge_juin_est !== null && Math.abs(r.marge_reelle - r.marge_juin_est) <= 50000).length;
  const better = rows.filter((r) => r.marge_reelle !== null && r.marge_juin_est !== null && r.marge_reelle - r.marge_juin_est > 50000).length;
  return [
    { label: "Réel pire que prévu (< -50k)", count: worse },
    { label: "Aligné (± 50k)", count: aligned },
    { label: "Réel meilleur (> +50k)", count: better },
  ];
}
export function trendBuckets(rows: AnnotatedRow[]): { label: string; count: number }[] {
  const worse = rows.filter((r) => r.statutActive === "NOK" && (r.margePrevActive ?? 0) >= 0).length;
  const stable = rows.filter((r) => r.statutActive === "NOK" && (r.margePrevActive ?? 0) < 0).length;
  const better = rows.filter((r) => (r.margePrevActive ?? 0) < 0 && r.statutActive !== "NOK").length;
  return [
    { label: "Aggravation (OK/RAS→NOK)", count: worse },
    { label: "Stable (NOK→NOK)", count: stable },
    { label: "Amélioration (NOK→OK)", count: better },
  ];
}
export function transitionMatrix(rows: AnnotatedRow[]): { label: string; count: number }[] {
  const trajectories: [string, string][] = [
    ["OK", "OK"], ["OK", "NOK"], ["NOK", "OK"], ["NOK", "NOK"], ["OK", "RAS"], ["NOK", "RAS"],
  ];
  return trajectories.map(([from, to]) => ({
    label: `${from}→${to}`,
    count: rows.filter((r) => r.statut_est === from && r.statut_reelle === to).length,
  }));
}
export function coverageSplit(rows: AnnotatedRow[]): { label: string; count: number }[] {
  const covered = rows.filter((r) => r.statut_reelle !== "RAS").length;
  const pending = rows.filter((r) => r.statut_reelle === "RAS" && r.statut_est !== "RAS").length;
  const outOfScope = rows.filter((r) => r.statut_est === "RAS" && r.statut_reelle === "RAS").length;
  return [
    { label: "Facture rapprochée", count: covered },
    { label: "En attente de facture", count: pending },
    { label: "Hors périmètre (RAS)", count: outOfScope },
  ];
}

// ── §7.7 — Distribution de magnitude ────────────────────────────────────────
const MAGNITUDE_BUCKETS: [string, (v: number) => boolean][] = [
  ["0 à -50k", (v) => v >= -50000],
  ["-50k à -100k", (v) => v >= -100000 && v < -50000],
  ["-100k à -250k", (v) => v >= -250000 && v < -100000],
  ["-250k à -500k", (v) => v >= -500000 && v < -250000],
  ["-500k à -1M", (v) => v >= -1000000 && v < -500000],
  ["< -1M", (v) => v < -1000000],
];
export function magnitudeBuckets(rows: AnnotatedRow[]): { label: string; count: number }[] {
  const nok = rows.filter((r) => r.statutActive === "NOK");
  return MAGNITUDE_BUCKETS.map(([label, test]) => ({
    label,
    count: nok.filter((r) => test(r.margeActive || 0)).length,
  }));
}

// ── Formatage ────────────────────────────────────────────────────────────
export function fmtXof(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(2).replace(/\.00$/, "") + " M";
  if (abs >= 1000) return (v / 1000).toFixed(0) + " k";
  return v.toLocaleString("fr-FR");
}
export function fmtXofExact(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("fr-FR") + " XOF";
}
export function fmtPct(v: number, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toFixed(digits) + "%";
}
