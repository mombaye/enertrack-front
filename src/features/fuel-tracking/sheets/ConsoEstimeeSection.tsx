// src/features/fuel-tracking/sheets/ConsoEstimeeSection.tsx
// « Suivis Consommations » — tableau UNIQUE de l'onglet : conso estimée (runtime GE × CPH)
// par site sur les dates EXACTES choisies (calcul site × jour puis agrégation), comparée à la
// conso mesurée vue (capteur, VW_FUEL_REPORT) quand elle existe. Calcul 100 % backend
// (GET /fuel-tracking/cph/) ; une valeur absente reste « — » avec son motif, jamais 0.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarRange, Download, Gauge, ListChecks, Search, SlidersHorizontal } from "lucide-react";

import {
  exportCph, getCphPeriod,
  type CphConsoStatus, type CphCurveSourceStatus, type CphFilters, type CphMatchStatus, type CphMotifCode, type CphPowerMethod, type CphSiteRow,
} from "@/services/fuelTracking";
import { Card, EmptyState, Pager, Skeleton } from "../ui";
import { FT } from "../theme";
import {
  CONSO_STATUS_COLORS, CONSO_STATUS_LABELS, ConsoStatusBadge, CurveStatusBadge, CURVE_SOURCE_LABELS, GLOSSARY, HelpTip,
  FreshnessWarning, MATCH_LABELS, MatchBadge, MOTIF_LABELS, RUNTIME_SOURCE_LABELS,
} from "./cphBadges";
import {
  BlocageDiagnostic, CoverageKpis, PeriodeIncompleteBanner, POWER_METHOD_FORMULAS, POWER_METHOD_LABELS, STATUT_CPH_LABELS,
  STATUT_RAPPRO_LABELS, StatutCphBadge,
} from "./cphDiagnostics";

const th: CSSProperties = {
  position: "sticky", top: 0, zIndex: 2, background: FT.slateL, color: FT.text, fontSize: 10.5, fontWeight: 800,
  textTransform: "uppercase", letterSpacing: ".04em", textAlign: "center", padding: "9px 10px",
  borderBottom: `1px solid ${FT.borderStrong}`, whiteSpace: "nowrap",
};
const td: CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${FT.border}`, fontSize: 12.5, textAlign: "center", whiteSpace: "nowrap", verticalAlign: "top" };
const sub: CSSProperties = { fontSize: 11, color: FT.textSub };
const control: CSSProperties = { border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px", fontSize: 12.5, color: FT.text, fontWeight: 700 };
const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${FT.border}`, background: FT.card, color: FT.text, cursor: "pointer", fontSize: 12, fontWeight: 800, borderRadius: 9, padding: "7px 12px" };

const KIND_LABELS: Record<string, string> = { INDOOR: "Indoor", OUTDOOR: "Outdoor", INCONNUE: "Inconnue" };

function nf(v: number | null | undefined, digits = 1) {
  if (v === null || v === undefined) return null;
  return v.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** null → « — » avec motif (jamais 0) ; 0 reste 0. */
function Val({ v, digits = 1, suffix = "", reason }: { v: number | null | undefined; digits?: number; suffix?: string; reason?: string | null }) {
  const t = nf(v, digits);
  if (t === null) return <span style={{ color: FT.textSub, cursor: reason ? "help" : undefined }} title={reason ?? undefined} aria-label={reason ? `non disponible : ${reason}` : "non disponible"}>—</span>;
  return <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>{t}{suffix}</span>;
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Mois « YYYY-MM » → du 1er au dernier jour, borné à hier (jamais de jour futur). */
function monthPeriod(month: string | null | undefined) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const [y, m] = (month ?? isoDate(yesterday).slice(0, 7)).split("-").map(Number);
  const last = new Date(y, m, 0);
  const end = last > yesterday ? yesterday : last;
  return { start: isoDate(new Date(y, m - 1, 1)), end: isoDate(end) };
}

function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
}

function apiError(e: unknown) {
  const err = e as { response?: { data?: { detail?: string } }; message?: string };
  return err?.response?.data?.detail ?? err?.message ?? "Erreur inconnue";
}

/** Motif / commentaire : d'abord pourquoi le CPH manque (code précis), puis la comparaison. */
function motifFor(r: CphSiteRow): { code: CphMotifCode | null; text: string | null } {
  const m = r.motif_cph;
  const c = r.comparaison;
  const parts: string[] = [];
  if (m) parts.push(`${MOTIF_LABELS[m.code] ?? m.code}${m.jours && r.statut_cph !== "CPH_NON_CALCULE" ? ` (${m.jours}/${r.days} j)` : ""}${m.detail ? ` — ${m.detail}` : ""}`);
  if (c && c.statut !== "CONSO_ESTIMEE_NON_CALCULEE" && c.motif) parts.push(c.motif);
  for (const a of r.conso_specifique?.alertes ?? []) parts.push(`⚠ ${a}`);
  return { code: m?.code ?? null, text: parts.join(" · ") || null };
}

function Th({ children, tip, label, left }: { children: ReactNode; tip?: string; label?: string; left?: boolean }) {
  return (
    <th scope="col" style={{ ...th, textAlign: left ? "left" : "center" }}>
      {children}{tip && <HelpTip text={tip} label={label ?? String(children)} />}
    </th>
  );
}

const CONSO_FILTERS: Array<CphConsoStatus | ""> = ["", "COHERENT", "ECART_A_JUSTIFIER", "ECART_A_INVESTIGUER", "MESURE_ABSENTE", "CONSO_ESTIMEE_NON_CALCULEE"];
const PERIMETRES: Array<["" | "GE" | "SANS_GE", string]> = [["", "Tout le parc"], ["GE", "Avec GE (calculés)"], ["SANS_GE", "Sans GE confirmé (hors calcul)"]];
type Filters = Omit<CphFilters, "start" | "end" | "site">;
const ADVANCED: Array<keyof Filters> = [
  "country", "zone", "configuration", "runtime_source", "dispo_runtime", "power_method", "correspondance", "curve_source_status",
  "statut_cph", "statut_rapprochement_calcul", "diag", "alerte_sfc",
];

export function ConsoEstimeeSection({ month }: { month: string | null | undefined }) {
  const [period, setPeriod] = useState(() => monthPeriod(month));
  const [filters, setFilters] = useState<Filters>({});
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [exporting, setExporting] = useState<null | "controle" | "anomalies">(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Le sélecteur de mois de l'en-tête propose le mois ; les dates exactes restent modifiables.
  useEffect(() => { setPeriod(monthPeriod(month)); setPage(1); }, [month]);

  const nbDays = daysBetween(period.start, period.end);
  const periodError = !period.start || !period.end ? "Dates requises." : nbDays < 1 ? "La date de fin précède la date de début." : nbDays > 92 ? "Période limitée à 92 jours." : null;
  const params: CphFilters = { ...period, ...filters, site: search.trim() || undefined };

  const q = useQuery({
    queryKey: ["cph-period", params, page, limit],
    queryFn: () => getCphPeriod({ ...params, page, limit }),
    enabled: !periodError,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const data = q.data;
  const s = data?.synthesis;
  const conso = s?.conso;
  const diagLabel = s?.diagnostic_blocages?.find((b) => b.code === filters.diag)?.label;
  const rows = data?.data ?? [];
  const advancedCount = ADVANCED.filter((k) => filters[k]).length;

  const setFilter = (k: keyof Filters, v: string) => { setFilters((f) => ({ ...f, [k]: v || undefined })); setPage(1); };
  const choose = (start: string, end: string) => { setPeriod({ start, end }); setPage(1); };

  async function handleExport(kind: "controle" | "anomalies") {
    setExporting(kind);
    setExportError(null);
    try {
      const blob = await exportCph(kind, params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kind === "controle" ? "controle_complet_cph" : "anomalies_fuel"}_${period.start}_${period.end}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(apiError(e));
    } finally {
      setExporting(null);
    }
  }

  const count = (n: number | undefined) => (n === undefined ? "" : ` (${n.toLocaleString("fr-FR")})`);
  const fmtL = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v).toLocaleString("fr-FR")} L`);
  const sel = (key: keyof Filters, label: string, options: Array<[string, string]>) => (
    <select aria-label={label} value={(filters[key] as string) ?? ""} onChange={(e) => setFilter(key, e.target.value)} style={{ ...control, cursor: "pointer" }}>
      <option value="">{label} : tous</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <Card padded={false} style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: FT.blueL, display: "grid", placeItems: "center", color: FT.navy, flexShrink: 0 }}>
            <Gauge size={17} aria-hidden />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: FT.text }}>
              Consommation estimée CPH et consommation mesurée — {fmtDate(period.start)} au {fmtDate(period.end)}
            </h2>
            <div style={{ fontSize: 12.5, color: FT.textSub, marginTop: 3 }}>
              Calcul site × jour (runtime GE × CPH) agrégé sur les dates exactes, comparé à la conso mesurée vue quand elle existe.
              {data?.pagination && ` ${data.pagination.total.toLocaleString("fr-FR")} site(s).`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, ...control }}>
          <CalendarRange size={14} color={FT.textSub} aria-hidden />
          <label htmlFor="ce-start" className="sr-only">Date de début</label>
          <input id="ce-start" type="date" value={period.start} max={period.end} onChange={(e) => choose(e.target.value, period.end)} style={{ border: "none", background: "transparent", fontWeight: 700, color: FT.text }} />
          <span aria-hidden style={{ color: FT.textSub }}>→</span>
          <label htmlFor="ce-end" className="sr-only">Date de fin</label>
          <input id="ce-end" type="date" value={period.end} min={period.start} onChange={(e) => choose(period.start, e.target.value)} style={{ border: "none", background: "transparent", fontWeight: 700, color: FT.text }} />
          <span style={{ fontSize: 11.5, color: FT.textSub }}>({nbDays > 0 ? nbDays : 0} j)</span>
        </div>
      </div>
      {periodError && <div role="alert" style={{ marginBottom: 10, color: FT.red, fontSize: 12.5 }}>{periodError}</div>}
      <FreshnessWarning meta={data?.meta} />

      <PeriodeIncompleteBanner periode={data?.periode} />

      {s?.couvertures ? (
        <div style={{ marginBottom: 14 }}>
          <CoverageKpis items={s.couvertures} />
          {s.sites_sans_ge !== undefined && s.sites_sans_ge > 0 && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: FT.textSub }}>
              Indicateurs calculés sur les {s.sites.toLocaleString("fr-FR")} sites avec GE confirmé par Snowflake. Les {s.sites_sans_ge.toLocaleString("fr-FR")} autres
              sites du parc ({s.sites_total?.toLocaleString("fr-FR")} au total) sont listés hors calcul, sans valeur ni 0 L
              {s.sites_ge_a_confirmer ? `, dont ${s.sites_ge_a_confirmer} avec un GE déclaré par Ops à confirmer` : ""}.
            </div>
          )}
          {conso && (
            <div style={{ marginTop: 8, fontSize: 12, color: FT.textMid, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span>Conso estimée (sites complets) : <strong>{fmtL(conso.total_estimee_complete_l)}</strong> · {conso.sites_estimee_complete} complet(s) · {s.statuts_cph?.CPH_PARTIEL ?? 0} partiel(s) · {s.statuts_cph?.CPH_NON_CALCULE ?? 0} non calculé(s)</span>
              <span>Conso mesurée vue : <strong>{fmtL(conso.total_mesuree_l)}</strong> ({conso.sites_mesure} site(s))</span>
              <span>Estimée vs mesurée comparées : <strong>{conso.sites_compares}</strong> site(s)</span>
            </div>
          )}
        </div>
      ) : q.isLoading ? <div style={{ marginBottom: 14 }}><Skeleton h={96} /></div> : null}

      <div role="group" aria-label="Périmètre des sites" style={{ display: "inline-flex", flexWrap: "wrap", gap: 3, padding: 4, borderRadius: 10, background: FT.slateL, border: `1px solid ${FT.border}`, marginBottom: 10 }}>
        {PERIMETRES.map(([k, label]) => {
          const active = (filters.perimetre ?? "") === k;
          const n = k === "" ? s?.sites_total : k === "GE" ? s?.sites : s?.sites_sans_ge;
          return (
            <button key={k || "all"} type="button" aria-pressed={active} onClick={() => setFilter("perimetre", k)}
              title={k === "SANS_GE" ? `DG_COUNT Snowflake ≤ 0 ou absent : affichés sans calcul ni 0 L.${s?.sites_ge_a_confirmer ? ` Dont ${s.sites_ge_a_confirmer} avec GE déclaré par Ops à confirmer.` : ""}` : undefined}
              style={{ padding: "6px 11px", borderRadius: 7, border: "none", background: active ? "#fff" : "transparent", color: active ? FT.navy : FT.textMid, boxShadow: active ? FT.shadow : "none", fontSize: 11.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
              {label}{n !== undefined ? ` (${n.toLocaleString("fr-FR")})` : ""}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <div role="group" aria-label="Statut de la comparaison" style={{ display: "inline-flex", flexWrap: "wrap", gap: 3, padding: 4, borderRadius: 10, background: FT.slateL, border: `1px solid ${FT.border}` }}>
          {CONSO_FILTERS.map((k) => {
            const active = (filters.statut_conso ?? "") === k;
            return (
              <button key={k || "all"} type="button" aria-pressed={active} onClick={() => setFilter("statut_conso", k)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 7, border: "none", background: active ? "#fff" : "transparent", color: active ? FT.navy : FT.textMid, boxShadow: active ? FT.shadow : "none", fontSize: 11.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                {k && <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: CONSO_STATUS_COLORS[k] }} />}
                {k ? CONSO_STATUS_LABELS[k] : "Tous"}{k ? count(conso?.statuts[k] ?? (conso ? 0 : undefined)) : count(data?.pagination.total)}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, ...control, minWidth: 200, flex: "0 1 240px" }}>
          <Search size={14} color={FT.textSub} aria-hidden />
          <input aria-label="Rechercher un site" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Site ID ou nom..." style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 12.5, minWidth: 0 }} />
        </div>
        <button type="button" aria-expanded={showFilters || advancedCount > 0} aria-controls="ce-filters" onClick={() => setShowFilters((v) => !v)} style={btn}>
          <SlidersHorizontal size={13} aria-hidden /> Filtres{advancedCount > 0 ? ` (${advancedCount})` : ""}
        </button>
        <button type="button" aria-expanded={showDiag} aria-controls="ce-diag" onClick={() => setShowDiag((v) => !v)} style={btn}>
          <ListChecks size={13} aria-hidden /> Synthèse des blocages
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => handleExport("controle")} disabled={!!exporting || !!periodError} style={{ ...btn, opacity: exporting ? 0.6 : 1 }} title="Toutes les colonnes, sources, statuts et motifs (site × jour)">
          <Download size={13} color={FT.blue} aria-hidden /> {exporting === "controle" ? "Export…" : "Contrôle complet"}
        </button>
        <button type="button" onClick={() => handleExport("anomalies")} disabled={!!exporting || !!periodError} style={{ ...btn, color: FT.red, borderColor: FT.redL, opacity: exporting ? 0.6 : 1 }} title="Seulement les lignes non OK ou non calculées">
          <Download size={13} aria-hidden /> {exporting === "anomalies" ? "Export…" : "Anomalies Fuel"}
        </button>
      </div>
      {(showFilters || advancedCount > 0) && (
        <div id="ce-filters" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10, padding: 10, borderRadius: 10, background: FT.cardAlt, border: `1px solid ${FT.border}` }}>
          {sel("country", "Pays", (data?.filters.countries ?? []).map((c) => [c, c]))}
          {sel("zone", "Zone", (data?.filters.zones ?? []).map((z) => [z, z]))}
          {sel("runtime_source", "Source runtime", (data?.filters.runtime_sources ?? []).map((r) => [r, RUNTIME_SOURCE_LABELS[r] ?? r]))}
          {sel("dispo_runtime", "Disponibilité runtime", [["90+", "≥ 90 %"], ["50+", "≥ 50 %"], ["lt50", "< 50 %"], ["aucune", "aucune source retenue"]])}
          {sel("configuration", "Configuration", [["INDOOR", "Indoor"], ["OUTDOOR", "Outdoor"], ["INCONNUE", "Inconnue"]])}
          {sel("power_method", "Source puissance", (data?.filters.power_methods ?? []).map((p) => [p, POWER_METHOD_LABELS[p as CphPowerMethod] ?? "Aucune puissance qualifiée"]))}
          {sel("correspondance", "Statut mapping", (Object.keys(MATCH_LABELS) as CphMatchStatus[]).map((k) => [k, `${k}${s?.correspondances ? ` (${s.correspondances[k] ?? 0})` : ""}`]))}
          {sel("curve_source_status", "Statut courbe", (Object.keys(CURVE_SOURCE_LABELS) as CphCurveSourceStatus[]).map((k) => [k, `${k}${s?.courbes_appliquees ? ` (${s.courbes_appliquees[k] ?? 0})` : ""}`]))}
          {sel("statut_cph", "Statut CPH", Object.entries(STATUT_CPH_LABELS).map(([k, l]) => [k, `${l}${s?.statuts_cph ? ` (${s.statuts_cph[k as keyof typeof s.statuts_cph] ?? 0})` : ""}`]))}
          {sel("statut_rapprochement_calcul", "Statut stock", Object.entries(STATUT_RAPPRO_LABELS).map(([k, l]) => [k, `${l}${s?.statuts_rapprochement_calcul ? ` (${s.statuts_rapprochement_calcul[k as keyof typeof s.statuts_rapprochement_calcul] ?? 0})` : ""}`]))}
          {sel("diag", "Motif de blocage", (s?.diagnostic_blocages ?? []).filter((b) => b.sites > 0).map((b) => [b.code, `${b.label} (${b.sites})`]))}
          {sel("alerte_sfc", "Alerte L/kWh", [["1", `hors plage${s?.alertes_sfc ? ` (${s.alertes_sfc.estimee} estimée · ${s.alertes_sfc.mesuree} mesurée)` : ""}`]])}
        </div>
      )}
      {filters.diag && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, background: FT.blueL, color: FT.blue, borderRadius: 999, padding: "4px 10px", fontSize: 11.5, fontWeight: 800 }}>
          Blocage : {diagLabel ?? filters.diag}
          <button type="button" aria-label="Retirer le filtre de blocage" onClick={() => setFilter("diag", "")} style={{ border: "none", background: "transparent", color: FT.blue, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0, fontWeight: 900 }}>×</button>
        </div>
      )}
      {showDiag && (
        <div id="ce-diag" style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: FT.cardAlt, border: `1px solid ${FT.border}` }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: FT.text, marginBottom: 8 }}>
            Synthèse des blocages — {fmtDate(period.start)} au {fmtDate(period.end)}
            <span style={{ fontWeight: 500, color: FT.textSub, marginLeft: 6 }}>(un jour non calculé compte dans chaque méthode qui a échoué)</span>
          </div>
          <BlocageDiagnostic items={s?.diagnostic_blocages} active={filters.diag} onSelect={(code) => setFilter("diag", code ?? "")} />
        </div>
      )}
      {exportError && <div role="alert" style={{ color: FT.red, fontSize: 12.5, marginBottom: 10 }}>Export impossible : {exportError}</div>}

      {q.isLoading ? (
        <Skeleton h={420} />
      ) : q.isError ? (
        <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Calcul impossible : {apiError(q.error)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Gauge size={20} />} title="Aucun site" subtitle={filters.statut_conso || advancedCount || search ? "Aucun site ne correspond à ces filtres." : "Aucun site avec GE, ou les données Snowflake ne sont pas encore synchronisées pour ces dates."} />
      ) : (
        <>
          <div style={{ overflow: "auto", maxHeight: 620, borderRadius: 12, border: `1px solid ${FT.border}`, opacity: q.isFetching ? 0.6 : 1 }} aria-busy={q.isFetching}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 3000 }}>
              <caption className="sr-only">Consommation estimée par le calcul CPH et consommation mesurée vue, par site sur la période</caption>
              <thead>
                <tr>
                  <Th left>Site ID</Th>
                  <Th left>Nom du site</Th>
                  <Th left>Pays</Th>
                  <Th left>Zone</Th>
                  <Th left tip={GLOSSARY.typeSite} label="type de site">Type de site</Th>
                  <Th tip={GLOSSARY.configuration} label="configuration">Configuration</Th>
                  <Th tip={GLOSSARY.factureGe} label="facturé avec GE">Facturé avec GE</Th>
                  <Th left>Type de GE</Th>
                  <Th tip={GLOSSARY.kva} label="puissance nominale">Puissance nominale GE (kVA)</Th>
                  <Th left tip={GLOSSARY.mapping} label="statut mapping">Statut mapping GE → courbe</Th>
                  <Th tip={GLOSSARY.score} label="score mapping">Score compatibilité (%)</Th>
                  <Th left tip={GLOSSARY.origineCourbe} label="origine de courbe">Qualité / origine courbe</Th>
                  <Th tip={GLOSSARY.runtime} label="runtime">Runtime GE (h)</Th>
                  <Th>Source runtime</Th>
                  <Th tip={GLOSSARY.dispo} label="disponibilité runtime">Disponibilité runtime (%)</Th>
                  <Th tip={GLOSSARY.puissance} label="puissance GE">Puissance GE retenue (kW)</Th>
                  <Th tip={GLOSSARY.sourcePuissance} label="source puissance">Source puissance</Th>
                  <Th tip={GLOSSARY.charge} label="charge GE">Charge GE (%)</Th>
                  <Th tip={GLOSSARY.cph} label="CPH">CPH (L/h)</Th>
                  <Th tip={GLOSSARY.consoEstimee} label="conso estimée">Conso estimée (L)</Th>
                  <Th tip={GLOSSARY.consoMesuree} label="conso mesurée vue">Conso mesurée vue (L)</Th>
                  <Th tip={GLOSSARY.ecart} label="écart conso">Écart conso (L)</Th>
                  <Th tip={GLOSSARY.ecart} label="écart conso en pourcentage">Écart conso (%)</Th>
                  <Th left>Statut de comparaison</Th>
                  <Th left>Motif / commentaire</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const c = r.comparaison;
                  const motif = motifFor(r);
                  const corr = r.correspondance;
                  const kind = r.configuration ?? r.kind ?? null;
                  const method = r.power_method_main ?? null;
                  const partial = r.statut_cph === "CPH_PARTIEL";
                  const methodDays = Object.entries(r.power_method_days ?? {}).map(([m, n]) => `${POWER_METHOD_LABELS[m as CphPowerMethod] ?? m} : ${n} j`).join(" · ");
                  return (
                    <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
                      <td style={{ ...td, textAlign: "left", fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.site_id}</td>
                      <td style={{ ...td, textAlign: "left" }}>{r.site_name ?? "—"}</td>
                      <td style={{ ...td, textAlign: "left" }}>{r.country ?? "—"}</td>
                      <td style={{ ...td, textAlign: "left" }}>{r.zone ?? "—"}</td>
                      <td style={{ ...td, textAlign: "left" }}>
                        {r.site_type ?? (r.off_grid === true ? "Off-Grid" : r.off_grid === false ? "On-Grid" : <Val v={null} reason="Type de site absent de la Base GE et de Snowflake." />)}
                      </td>
                      <td style={td} title={r.kind_source ? `Source : ${r.kind_source}${r.configuration_fichier ? ` · fichier facturation : ${r.configuration_fichier}` : ""}` : "Configuration inconnue : méthode redresseur non applicable"}>
                        {kind ? KIND_LABELS[kind] : <span style={{ color: FT.orange, fontWeight: 700 }}>Inconnue</span>}
                      </td>
                      <td style={td}>
                        {r.facture_avec_ge === true ? <span style={{ fontWeight: 800, color: FT.green }}>Oui</span>
                          : r.facture_avec_ge === false ? <span style={{ fontWeight: 800, color: FT.textSub }}>Non</span>
                            : <Val v={null} reason="Site absent du fichier ESCO SN Facturation par site." />}
                      </td>
                      <td style={{ ...td, textAlign: "left" }}>{r.ge_label ?? <Val v={null} reason="Type de GE absent de la Base GE." />}</td>
                      <td style={td}><Val v={r.ge_kva} digits={0} reason="Puissance nominale absente de la Base GE." /></td>
                      <td style={{ ...td, textAlign: "left" }}>
                        <MatchBadge statut={corr?.statut} title={[corr?.statut ? MATCH_LABELS[corr.statut] : null, corr?.methode, corr?.motif].filter(Boolean).join(" · ")} />
                      </td>
                      <td style={td}><Val v={corr?.score} digits={0} suffix=" %" reason="Pas de score (type de GE absent, multi-GE ou aucune courbe candidate)." /></td>
                      <td style={{ ...td, textAlign: "left" }}>
                        {(corr?.curve_source_status ?? corr?.courbe_statut) ? <CurveStatusBadge status={corr?.curve_source_status ?? corr?.courbe_statut} /> : <Val v={null} reason={r.curve_reason ?? "Aucune courbe appliquée."} />}
                        {(r.curve?.curve_id ?? corr?.courbe_id) && <div style={{ ...sub, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.curve?.curve_id ?? corr?.courbe_id}</div>}
                      </td>
                      <td style={td}>
                        <Val v={r.runtime_total_h} reason="Aucune source de runtime qualifiée sur la période." />
                        <div style={sub}>{r.runtime_days}/{r.days} j</div>
                      </td>
                      <td style={td}>{r.runtime_source_main ? RUNTIME_SOURCE_LABELS[r.runtime_source_main] ?? r.runtime_source_main : <span style={{ color: FT.textSub }}>—</span>}</td>
                      <td style={td}><Val v={r.runtime_source_availability_pct} digits={0} suffix=" %" reason="Aucune source retenue." /></td>
                      <td style={td}><Val v={r.p_ge_moy_kw} digits={2} reason="Aucun jour avec puissance GE qualifiée et CPH calculé." /></td>
                      <td style={td} title={method ? `${POWER_METHOD_FORMULAS[method]}${methodDays ? ` — ${methodDays}` : ""}` : undefined}>
                        {method ? POWER_METHOD_LABELS[method] : <Val v={null} reason="Aucune méthode de puissance n'a abouti (voir Synthèse des blocages / Contrôle CPH)." />}
                        {method && r.running_days ? <div style={sub}>{r.power_method_days?.[method] ?? 0}/{r.running_days} j en marche</div> : null}
                      </td>
                      <td style={td}>
                        <Val v={r.charge_moy_pct} digits={0} suffix=" %" reason="Charge non calculée." />
                        {r.extrapolated_days > 0 && <div style={{ ...sub, color: FT.orange }}>{r.extrapolated_days} j &lt; 50 %</div>}
                      </td>
                      <td style={td}>
                        <Val v={r.cph_moy_l_h} digits={2} reason={motif.text} />
                        {r.conso_specifique?.estimee_l_kwh !== null && r.conso_specifique?.estimee_l_kwh !== undefined && (
                          <div style={{ ...sub, color: r.conso_specifique.alerte_estimee ? FT.orange : FT.textSub }} title={GLOSSARY.sfc}>
                            {nf(r.conso_specifique.estimee_l_kwh, 2)} L/kWh{r.conso_specifique.alerte_estimee ? " ⚠" : ""}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        {r.conso_theorique_l !== null ? <Val v={r.conso_theorique_l} digits={0} /> : partial && r.conso_partielle_l !== null ? (
                          <span title="Somme des seuls jours calculés : ce n'est pas la consommation complète de la période (motif à droite)">
                            <Val v={r.conso_partielle_l} digits={0} />
                            <div style={{ ...sub, color: FT.orange, fontWeight: 800 }}>PÉRIODE INCOMPLÈTE</div>
                            <div style={{ ...sub, color: FT.orange }}>{r.conso_days}/{r.days} j calculés</div>
                          </span>
                        ) : <Val v={null} reason={motif.text} />}
                      </td>
                      <td style={td}>
                        <Val v={c?.conso_mesuree_l} digits={0} reason="Aucune mesure fuel exploitable sur la période." />
                        {c && c.jours_mesure > 0 && <div style={sub}>{c.jours_mesure}/{r.days} j mesurés</div>}
                        {r.conso_specifique?.mesuree_l_kwh !== null && r.conso_specifique?.mesuree_l_kwh !== undefined && (
                          <div style={{ ...sub, color: r.conso_specifique.alerte_mesuree ? FT.red : FT.textSub }} title={GLOSSARY.sfc}>
                            {nf(r.conso_specifique.mesuree_l_kwh, 2)} L/kWh{r.conso_specifique.alerte_mesuree ? " ⚠" : ""}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <Val v={c?.ecart_l} digits={0} reason={c?.motif} />
                        {c && c.ecart_l !== null && c.jours_communs > 0 && <div style={sub}>sur {c.jours_communs} j communs</div>}
                      </td>
                      <td style={td}><Val v={c?.ecart_pct} digits={1} suffix=" %" reason={c?.motif} /></td>
                      <td style={{ ...td, textAlign: "left" }}>
                        {c ? <ConsoStatusBadge statut={c.statut} /> : null}
                        <div style={{ marginTop: 3 }}><StatutCphBadge statut={r.statut_cph} /></div>
                        {motif.code && <div style={{ ...sub, fontFamily: "ui-monospace, Menlo, monospace", marginTop: 3 }}>{motif.code}</div>}
                      </td>
                      <td style={{ ...td, textAlign: "left", whiteSpace: "normal", minWidth: 260, maxWidth: 380, fontSize: 11.5, color: FT.textMid }}>
                        {motif.text ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data && (
            <Pager
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              hasPrev={data.pagination.hasPrev}
              hasNext={data.pagination.hasNext}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
              pageSize={limit}
              onPageSizeChange={(n) => { setLimit(n); setPage(1); }}
              pageSizeOptions={[25, 50, 100, 200]}
            />
          )}
        </>
      )}
    </Card>
  );
}
