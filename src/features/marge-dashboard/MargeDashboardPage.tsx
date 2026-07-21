// src/features/marge-dashboard/MargeDashboardPage.tsx
// Dashboard d'Analyse de Marge Grid — Focus Sites en Marge Négative (CDC v1.0)
// Sélecteur de périmètre (portefeuille / famille / typologie exacte / multi-
// sélection libre), sélecteur de base de marge (estimée / réelle), filtres
// transverses — tout se recalcule côté client, sans rechargement.
import { useMemo, useState, type ReactNode, type CSSProperties } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingDown, TrendingUp, Percent, Scale, Search, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useMargeDashboard, type MargeRow, type MargePeriod } from "./api";
import {
  applyScope, annotateBase, applyFilters, computeKpis, computeInsights, groupSumNok,
  groupCount, reliabilityBuckets, trendBuckets, transitionMatrix, coverageSplit,
  magnitudeBuckets, typoFamily, typoExactOptions, typoFamilyOptions, fmtXof, fmtXofExact,
  fmtPct, EMPTY_FILTERS, type ScopeMode, type BaseMode, type Filters, type AnnotatedRow,
} from "./calc";

// ─── Design tokens Camusat (identiques aux autres modules EnerTrack) ──────────
const C = {
  blue: { 950: "#0B1F4D", 900: "#0F235A", 800: "#123C8C", 700: "#1A56C4", 600: "#2464D6", 500: "#3272E0", 300: "#91B9F8", 100: "#E4EFFE", 50: "#F2F6FE" },
  slate: { 900: "#0F172A", 800: "#1E293B", 700: "#334155", 600: "#475569", 500: "#64748B", 400: "#94A3B8", 300: "#CBD5E1", 200: "#E2E8F0", 100: "#F1F5F9", 50: "#F8FAFC" },
  ok: { main: "#059669", light: "#D1FAE5", dark: "#065F46" },
  nok: { main: "#DC2626", light: "#FEE2E2", dark: "#991B1B" },
  warn: { main: "#D97706", light: "#FEF3C7", dark: "#92400E" },
  ras: { main: "#64748B", light: "#F1F5F9", dark: "#334155" },
};
const HDR = "linear-gradient(135deg, #0B1F4D 0%, #123C8C 45%, #1A56C4 75%, #3272E0 100%)";
const PAGE_BG = "linear-gradient(180deg,#F8FAFC 0%,#EEF4FF 100%)";
const PIE_COLORS = [C.blue[700], C.blue[950], C.warn.main, C.nok.main, C.ok.main, C.slate[400]];
const PAGE_SIZE = 100;
const MONTH_LABELS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const RADIUS = 10;
const CARD_SHADOW = "0 1px 2px rgba(15,23,42,.04), 0 1px 1px rgba(15,23,42,.03)";
const CARD_BORDER = "1px solid #E4E9F0";

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
  return <h3 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", color: C.slate[500], margin: "0 0 14px", fontWeight: 700 }}>{children}</h3>;
}
function KpiCard({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: ReactNode; accent: string }) {
  return (
    <div style={{ position: "relative", background: "#fff", borderRadius: RADIUS, border: CARD_BORDER, borderLeft: `3px solid ${accent}`, boxShadow: CARD_SHADOW, padding: "15px 16px 16px", minHeight: 104, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: C.slate[500], letterSpacing: ".06em", textTransform: "uppercase", lineHeight: 1.3 }}>{label}</div>
        <div style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${accent}35`, color: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 21, fontWeight: 700, color: C.slate[900], letterSpacing: "-.01em", fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      {sub ? <div style={{ fontSize: 11.5, color: C.slate[500], marginTop: "auto", paddingTop: 7 }}>{sub}</div> : null}
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
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: CARD_BORDER, borderRadius: 8, padding: "8px 12px", boxShadow: "0 4px 16px rgba(15,23,42,.10)", fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: C.slate[800], marginBottom: 2 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || C.slate[600] }}>{p.name ?? "Valeur"} : {typeof p.value === "number" && Math.abs(p.value) > 1000 ? fmtXofExact(p.value) : p.value}</div>
      ))}
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
};

const CURRENT_YEAR = new Date().getFullYear();

export default function MargeDashboardPage() {
  // undefined = laisse le backend choisir par défaut (dernière période de
  // l'année en cours, ou la plus récente disponible sinon) ; une fois les
  // données chargées, le sélecteur affiche la période réellement résolue.
  const [period, setPeriod] = useState<MargePeriod | undefined>(undefined);
  const { data, isLoading, isError } = useMargeDashboard(period);

  const [scopeMode, setScopeMode] = useState<ScopeMode>("family");
  const [scopeValue, setScopeValue] = useState("A_Ax_GG");
  const [multiValues, setMultiValues] = useState<string[]>([]);
  const [base, setBase] = useState<BaseMode>("estimee");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState("marge_juin_est");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const rows = data?.rows ?? [];

  const typoFamilies = useMemo(() => typoFamilyOptions(rows), [rows]);
  const typoExacts = useMemo(() => typoExactOptions(rows), [rows]);

  const scoped = useMemo(() => {
    const filtered = applyScope(rows, scopeMode, scopeValue, multiValues);
    return annotateBase(filtered, base);
  }, [rows, scopeMode, scopeValue, multiValues, base]);

  // Filtres transverses : options dynamiquement bornées au périmètre actif
  const regionOptions = useMemo(() => Array.from(new Set(scoped.map((r) => r.region))).sort(), [scoped]);
  const batchOptions = useMemo(() => Array.from(new Set(scoped.map((r) => r.batch))).sort(), [scoped]);
  const catOptions = useMemo(() => Array.from(new Set(scoped.map((r) => r.categorie_bo))).sort(), [scoped]);
  const ownerOptions = useMemo(() => Array.from(new Set(scoped.map((r) => r.owner))).sort(), [scoped]);

  const filtered = useMemo(() => applyFilters(scoped, filters), [scoped, filters]);
  const kpis = useMemo(() => computeKpis(scoped), [scoped]);
  const insights = useMemo(() => computeInsights(scoped, base), [scoped, base]);

  const byRegion = useMemo(() => groupSumNok(scoped, (r) => r.region), [scoped]);
  const byCategorie = useMemo(() => groupSumNok(scoped, (r) => r.categorie_bo), [scoped]);
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

  const statutPie = useMemo(() => {
    const nok = scoped.filter((r) => r.statutActive === "NOK").length;
    const ok = scoped.filter((r) => r.statutActive === "OK").length;
    const ras = scoped.filter((r) => r.statutActive === "RAS").length;
    return [
      { label: "NOK", count: nok },
      { label: "OK", count: ok },
      { label: "RAS", count: ras },
    ];
  }, [scoped]);

  const reliabilityData = useMemo(() => (base === "estimee" ? trendBuckets(scoped) : reliabilityBuckets(scoped)), [scoped, base]);
  const transitions = useMemo(() => transitionMatrix(scoped), [scoped]);
  const coverage = useMemo(() => coverageSplit(scoped), [scoped]);

  const nokScoped = useMemo(() => scoped.filter((r) => r.statutActive === "NOK"), [scoped]);
  const ioPie = useMemo(() => groupCount(nokScoped, (r) => r.indoor_outdoor), [nokScoped]);
  const modPie = useMemo(() => groupCount(nokScoped, (r) => r.modernise), [nokScoped]);
  const ownerPie = useMemo(() => groupCount(nokScoped, (r) => r.owner), [nokScoped]);
  const buckets = useMemo(() => magnitudeBuckets(scoped), [scoped]);

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
    setScopeValue(mode === "family" ? typoFamilies[0] ?? "" : mode === "exact" ? typoExacts[0] ?? "" : "");
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
    return <div style={{ minHeight: "100vh", background: PAGE_BG, display: "grid", placeItems: "center", color: C.slate[500] }}>Chargement du Dashboard Marge…</div>;
  }
  if (isError || !data) {
    return <div style={{ minHeight: "100vh", background: PAGE_BG, display: "grid", placeItems: "center", color: C.nok.main }}>Erreur de chargement des données.</div>;
  }

  const meta = data.meta;
  const scopeLabel = scopeMode === "portfolio" ? "Portefeuille entier" : scopeMode === "family" ? "Famille de typologie" : scopeMode === "exact" ? "Typologie exacte" : "Sélection de typologies";

  return (
    <div style={{ minHeight: "100vh", background: PAGE_BG }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 24px 70px" }}>

        <header style={{ background: HDR, borderRadius: RADIUS, padding: "24px 26px 22px", color: "#fff", boxShadow: "0 4px 20px -8px rgba(11,31,77,.35)", marginBottom: 22 }}>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "#BFD4FA", marginBottom: 8 }}>
            Aktivco · Grid &amp; Energy Manager · Module Évaluation Financière
          </div>
          <h1 style={{ fontSize: 23, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-.01em" }}>Dashboard d'Analyse de Marge Grid — Focus Sites en Marge Négative</h1>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.82)", maxWidth: 760, lineHeight: 1.5 }}>
            Comparaison {meta.month_a_label} → {meta.month_b_label} {meta.year} — {scopeLabel}
            {scopeMode !== "portfolio" && scopeValue ? <> · <span style={{ fontFamily: "ui-monospace, Menlo, monospace", background: "rgba(255,255,255,.16)", padding: "2px 8px", borderRadius: 20 }}>{scopeValue}</span></> : null}
            {" — "}<strong>{kpis.total.toLocaleString("fr-FR")} sites</strong>
          </div>
        </header>

        {/* ── Sélecteurs §1/§2 ─────────────────────────────────────────── */}
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
                    <button
                      key={t}
                      onClick={() => { setMultiValues((prev) => checked ? prev.filter((x) => x !== t) : [...prev, t]); setPage(1); }}
                      style={{
                        padding: "5px 11px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                        border: `1px solid ${checked ? C.blue[700] : C.slate[200]}`,
                        background: checked ? C.blue[50] : "#fff", color: checked ? C.blue[700] : C.slate[600],
                      }}
                    >
                      {t}
                    </button>
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
            <select
              value={`${meta.reelle_year}-${meta.reelle_month}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                setPeriod({ year: y, month: m });
              }}
              style={{ width: "100%", background: C.slate[50], border: `1px solid ${C.slate[200]}`, color: C.slate[800], borderRadius: 10, padding: "10px 12px", fontSize: 12.5, cursor: "pointer", fontWeight: 700 }}
            >
              {meta.available_periods.map((p) => (
                <option key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>
                  {MONTH_LABELS[p.month - 1]} {p.year}{p.year === CURRENT_YEAR ? " · année en cours" : ""}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: C.slate[400], marginTop: 9, lineHeight: 1.4 }}>
              Seuls {meta.available_periods.length} mois ont une facture Sénélec rapprochée à ce jour — choisis-en un pour voir la marge réelle.
            </div>
          </Card>
        </div>

        {/* ── §7.2 KPI ─────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 10 }}>
          <KpiCard label="Sites NOK" value={kpis.nokCount.toLocaleString("fr-FR")} sub={`${fmtPct(kpis.nokPct)} du périmètre`} icon={<TrendingDown size={17} />} accent={C.nok.main} />
          <KpiCard label="Marge négative cumulée" value={fmtXof(kpis.sumNok)} sub={fmtXofExact(kpis.sumNok)} icon={<TrendingDown size={17} />} accent={C.nok.main} />
          <KpiCard label="Marge nég. moy. / site NOK" value={fmtXof(kpis.avgNok)} sub={fmtXofExact(kpis.avgNok)} icon={<Percent size={17} />} accent={C.warn.main} />
          <KpiCard label="Marge positive cumulée" value={fmtXof(kpis.sumOk)} sub={fmtXofExact(kpis.sumOk)} icon={<TrendingUp size={17} />} accent={C.ok.main} />
          <KpiCard label="Solde net · RAS" value={fmtXof(kpis.net)} sub={`${kpis.rasCount.toLocaleString("fr-FR")} sites hors calcul`} icon={<Scale size={17} />} accent={C.blue[700]} />
        </div>

        {/* ── Diagnostic rapide ────────────────────────────────────────── */}
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

        {/* ── §7.4 Répartition & fiabilité ──────────────────────────────── */}
        <SectionTitle num="7.4" desc="Statut de marge sur le périmètre actif">Répartition et fiabilité</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
          <Card>
            <CardH3>Statut marge</CardH3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statutPie} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={62} outerRadius={92} paddingAngle={2}>
                  {statutPie.map((s, i) => <Cell key={i} fill={s.label === "NOK" ? C.nok.main : s.label === "OK" ? C.ok.main : C.ras.main} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <CardH3>{base === "estimee" ? "Tendance sites NOK — Mai → Juin" : "Fiabilité du modèle — Écart Réel vs Estimation"}</CardH3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={reliabilityData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: C.slate[500] }} />
                <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11, fill: C.slate[600] }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Sites" radius={[0, 4, 4, 0]}>
                  {reliabilityData.map((_, i) => <Cell key={i} fill={[C.nok.main, C.warn.main, C.ok.main][i] ?? C.blue[700]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ── §4.3 Transition (uniquement base réelle) ─────────────────── */}
        {base === "reelle" && (
          <>
            <SectionTitle num="4.3" desc="Comment le statut modèle évolue une fois la facture réelle disponible">Transition de statut — estimation → réel</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
              <Card>
                <CardH3>Sites par trajectoire de statut (estimé → réel)</CardH3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={transitions} margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[600] }} />
                    <YAxis tick={{ fontSize: 11, fill: C.slate[500] }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Sites" radius={[4, 4, 0, 0]}>
                      {transitions.map((t, i) => <Cell key={i} fill={t.label.endsWith("NOK") ? C.nok.main : t.label.endsWith("OK") ? C.ok.main : C.ras.main} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <CardH3>Couverture des factures réelles</CardH3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={coverage} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={2}>
                      {coverage.map((_, i) => <Cell key={i} fill={[C.blue[700], C.warn.main, C.ras.main][i]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </>
        )}

        {/* ── §7.5 Sous-catégorie ───────────────────────────────────────── */}
        <SectionTitle num="7.5" desc={scopeMode === "family" ? "Variantes au sein de la famille sélectionnée" : "Vague de déploiement / commissioning"}>
          {scopeMode === "family" ? "Marge négative par sous-typologie" : "Marge négative par batch opérationnel"}
        </SectionTitle>
        <Card>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bySubcat} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[600] }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: C.slate[500] }} tickFormatter={(v) => fmtXof(v)} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="sum" name="Marge négative cumulée" fill={C.blue[950]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ── §7.6 Localisation & causes ────────────────────────────────── */}
        <SectionTitle num="7.6" desc="Région O&M · catégorie BO">Localisation et causes racines</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Card>
            <CardH3>Marge négative cumulée par région</CardH3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byRegion} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: C.slate[500] }} tickFormatter={(v) => fmtXof(v)} />
                <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11, fill: C.slate[600] }} />
                <Tooltip content={<ChartTooltip />} formatter={(v: any) => fmtXofExact(v)} />
                <Bar dataKey="sum" name="Marge négative" fill={C.nok.main} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <CardH3>Catégorie BO (cause identifiée)</CardH3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byCategorie} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: C.slate[500] }} tickFormatter={(v) => fmtXof(v)} />
                <YAxis type="category" dataKey="label" width={190} tick={{ fontSize: 10.5, fill: C.slate[600] }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="sum" name="Marge négative" fill={C.warn.main} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ── §7.7 Paramètres essentiels ────────────────────────────────── */}
        <SectionTitle num="7.7" desc="Configuration site · propriétaire d'action · magnitude">Paramètres essentiels à l'analyse</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          <Card>
            <CardH3>Indoor vs Outdoor (sites NOK)</CardH3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={ioPie} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                  {ioPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <CardH3>Statut de modernisation (sites NOK)</CardH3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={modPie} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                  {modPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <CardH3>Owner d'action assigné (sites NOK)</CardH3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={ownerPie} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                  {ownerPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
        <Card style={{ marginTop: 14 }}>
          <CardH3>Distribution de la magnitude de marge négative (XOF)</CardH3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={buckets} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.slate[100]} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.slate[600] }} />
              <YAxis tick={{ fontSize: 11, fill: C.slate[500] }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Sites" fill={C.nok.main} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ── §7.8 Tableau détaillé ─────────────────────────────────────── */}
        <SectionTitle num="7.8" desc="Triable, filtrable, recherche libre">Détail des sites en marge négative</SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <div style={{ position: "relative", minWidth: 230 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: C.slate[400] }} />
              <input
                type="text" placeholder="Rechercher site, ID, commentaire..."
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
                    ["categorie_bo", "Catégorie BO"], ["owner", "Owner"],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      onClick={() => sortBy(key)}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 12, fontSize: 12, color: C.slate[500] }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ display: "flex", alignItems: "center", gap: 4, background: C.slate[50], border: `1px solid ${C.slate[200]}`, borderRadius: 8, padding: "7px 14px", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1, fontWeight: 700, color: C.blue[950] }}>
              <ChevronLeft size={13} /> Précédent
            </button>
            <span>Page {page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ display: "flex", alignItems: "center", gap: 4, background: C.slate[50], border: `1px solid ${C.slate[200]}`, borderRadius: 8, padding: "7px 14px", cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1, fontWeight: 700, color: C.blue[950] }}>
              Suivant <ChevronRight size={13} />
            </button>
          </div>
        </Card>

        <footer style={{ marginTop: 36, paddingTop: 16, borderTop: `1px solid ${C.slate[200]}`, fontSize: 11, color: C.slate[400], fontFamily: "ui-monospace, Menlo, monospace", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span>Aktivco Grid &amp; Energy Manager — Module Évaluation Financière</span>
          <span>Marge estimée = redevance grid − estimation consommation · Marge réelle = redevance grid − facture Sénélec</span>
        </footer>
      </div>
    </div>
  );
}
