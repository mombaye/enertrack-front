// src/features/fuel-tracking/sheets/ConsoEstimeeSection.tsx
// « Suivis Consommations » — résultat principal du calcul CPH : conso estimée
// (runtime GE × CPH) par site sur les dates EXACTES choisies, puis comparaison avec
// la conso mesurée vue (capteur, VW_FUEL_REPORT) quand elle existe. Calcul 100 % backend
// (GET /fuel-tracking/cph/) ; une valeur absente reste « — » avec son motif, jamais 0.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarRange, Download, Droplets, Fuel, Gauge, Scale, Search, SlidersHorizontal } from "lucide-react";

import {
  exportCph, getCphPeriod,
  type CphConsoStatus, type CphCurveSourceStatus, type CphFilters, type CphMatchStatus, type CphMotifCode, type CphSiteRow,
} from "@/services/fuelTracking";
import { Card, EmptyState, KpiCard, Pager, Skeleton } from "../ui";
import { FT } from "../theme";
import {
  CONSO_STATUS_COLORS, CONSO_STATUS_LABELS, ConsoStatusBadge, CurveStatusBadge, CURVE_SOURCE_LABELS, GLOSSARY, HelpTip,
  MATCH_LABELS, MatchBadge, MOTIF_LABELS, POWER_SOURCE_LABELS, RUNTIME_SOURCE_LABELS,
} from "./cphBadges";

const th: CSSProperties = {
  position: "sticky", top: 0, zIndex: 2, background: FT.slateL, color: FT.text, fontSize: 10.5, fontWeight: 800,
  textTransform: "uppercase", letterSpacing: ".04em", textAlign: "center", padding: "9px 10px",
  borderBottom: `1px solid ${FT.borderStrong}`, whiteSpace: "nowrap",
};
const td: CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${FT.border}`, fontSize: 12.5, textAlign: "center", whiteSpace: "nowrap", verticalAlign: "top" };
const sub: CSSProperties = { fontSize: 11, color: FT.textSub };
const control: CSSProperties = { border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px", fontSize: 12.5, color: FT.text, fontWeight: 700 };
const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${FT.border}`, background: FT.card, color: FT.text, cursor: "pointer", fontSize: 12, fontWeight: 800, borderRadius: 9, padding: "7px 12px" };

const CPH_STATUS_LABELS: Record<string, string> = { COMPLET: "Complet", PARTIEL: "Partiel", NON_CALCULE: "Non calculé" };
const RAPPROCHEMENT_LABELS: Record<string, string> = {
  OK: "OK", A_JUSTIFIER: "À justifier", A_INVESTIGUER: "À investiguer", DONNEES_INCOMPLETES: "Données incomplètes", CPH_NON_CALCULE: "CPH non calculé",
};

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
  if (m) parts.push(`${MOTIF_LABELS[m.code] ?? m.code}${m.jours && r.cph_status !== "NON_CALCULE" ? ` (${m.jours}/${r.days} j)` : ""}${m.detail ? ` — ${m.detail}` : ""}`);
  if (c && c.statut !== "CONSO_ESTIMEE_NON_CALCULEE" && c.motif) parts.push(c.motif);
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
type Filters = Omit<CphFilters, "start" | "end" | "site">;
const ADVANCED: Array<keyof Filters> = ["country", "zone", "runtime_source", "dispo_runtime", "power_source", "correspondance", "curve_source_status", "cph_status", "statut"];

export function ConsoEstimeeSection({ month }: { month: string | null | undefined }) {
  const [period, setPeriod] = useState(() => monthPeriod(month));
  const [filters, setFilters] = useState<Filters>({});
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
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
              Conso estimée (CPH) et conso mesurée — {fmtDate(period.start)} → {fmtDate(period.end)}
            </h2>
            <div style={{ fontSize: 12.5, color: FT.textSub, marginTop: 3 }}>
              Conso estimée = runtime GE × CPH, jour par jour sur les dates exactes ; comparée à la conso mesurée vue quand elle existe.
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

      {conso ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 14 }}>
          <KpiCard label="CPH calculé" value={`${(s?.cph_calcules ?? 0).toLocaleString("fr-FR")} site(s)`}
            sub={`${conso.sites_estimee_complete} complet(s) · ${conso.sites_estimee_partielle} partiel(s) · ${conso.sites_estimee_non_calculee} non calculé(s)`} tone="violet" icon={<Gauge size={14} />} />
          <KpiCard label="Conso estimée totale" value={fmtL(conso.total_estimee_complete_l)} sub="sites à conso estimée complète" tone="cyan" icon={<Fuel size={14} />} />
          <KpiCard label="Conso mesurée vue totale" value={fmtL(conso.total_mesuree_l)} sub={`${conso.sites_mesure} site(s) avec mesure fuel`} tone="slate" icon={<Droplets size={14} />} />
          <KpiCard label="Estimée vs mesurée comparées" value={`${conso.sites_compares.toLocaleString("fr-FR")} site(s)`}
            sub={`${conso.statuts.COHERENT ?? 0} cohérents · ${conso.statuts.ECART_A_JUSTIFIER ?? 0} à justifier · ${conso.statuts.ECART_A_INVESTIGUER ?? 0} à investiguer`} tone="green" icon={<Scale size={14} />} />
        </div>
      ) : q.isLoading ? <div style={{ marginBottom: 14 }}><Skeleton h={96} /></div> : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <div role="group" aria-label="Statut de la comparaison" style={{ display: "inline-flex", flexWrap: "wrap", gap: 3, padding: 4, borderRadius: 10, background: FT.slateL, border: `1px solid ${FT.border}` }}>
          {CONSO_FILTERS.map((k) => {
            const active = (filters.statut_conso ?? "") === k;
            return (
              <button key={k || "all"} type="button" aria-pressed={active} onClick={() => setFilter("statut_conso", k)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 7, border: "none", background: active ? "#fff" : "transparent", color: active ? FT.navy : FT.textMid, boxShadow: active ? FT.shadow : "none", fontSize: 11.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                {k && <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: CONSO_STATUS_COLORS[k] }} />}
                {k ? CONSO_STATUS_LABELS[k] : "Tous"}{k ? count(conso?.statuts[k] ?? (conso ? 0 : undefined)) : count(s?.sites)}
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
          {sel("power_source", "Source puissance", (data?.filters.power_sources ?? []).map((p) => [p, POWER_SOURCE_LABELS[p] ?? p]))}
          {sel("correspondance", "Statut mapping", (Object.keys(MATCH_LABELS) as CphMatchStatus[]).map((k) => [k, `${k}${s?.correspondances ? ` (${s.correspondances[k] ?? 0})` : ""}`]))}
          {sel("curve_source_status", "Statut courbe", (Object.keys(CURVE_SOURCE_LABELS) as CphCurveSourceStatus[]).map((k) => [k, `${k}${s?.courbes_appliquees ? ` (${s.courbes_appliquees[k] ?? 0})` : ""}`]))}
          {sel("cph_status", "Statut CPH", Object.entries(CPH_STATUS_LABELS))}
          {sel("statut", "Statut rapprochement", Object.entries(RAPPROCHEMENT_LABELS))}
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
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 2350 }}>
              <caption className="sr-only">Conso estimée par le calcul CPH et conso mesurée vue, par site</caption>
              <thead>
                <tr>
                  <Th left>Site ID</Th>
                  <Th left>Nom du site</Th>
                  <Th left>Pays / zone</Th>
                  <Th left>Type de site / configuration</Th>
                  <Th left tip={GLOSSARY.mapping} label="type de GE et mapping">Type de GE</Th>
                  <Th tip={GLOSSARY.kva} label="puissance nominale">Puissance nominale GE (kVA)</Th>
                  <Th tip={GLOSSARY.runtime} label="runtime">Runtime GE (h)</Th>
                  <Th>Source runtime</Th>
                  <Th tip={GLOSSARY.dispo} label="disponibilité runtime">Disponibilité runtime (%)</Th>
                  <Th tip={GLOSSARY.puissance} label="puissance GE">Puissance GE retenue (kW)</Th>
                  <Th>Source puissance</Th>
                  <Th tip={GLOSSARY.charge} label="charge GE">Charge GE (%)</Th>
                  <Th tip={GLOSSARY.cph} label="CPH">CPH (L/h)</Th>
                  <Th tip={GLOSSARY.consoEstimee} label="conso estimée">Conso estimée (L)</Th>
                  <Th tip={GLOSSARY.consoMesuree} label="conso mesurée vue">Conso mesurée vue (L)</Th>
                  <Th tip={GLOSSARY.ecart} label="écart conso">Écart conso (L)</Th>
                  <Th tip={GLOSSARY.ecart} label="écart conso en pourcentage">Écart conso (%)</Th>
                  <Th left>Statut</Th>
                  <Th left>Motif / commentaire</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const c = r.comparaison;
                  const motif = motifFor(r);
                  const corr = r.correspondance;
                  const noCph = r.cph_moy_l_h === null;
                  return (
                    <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
                      <td style={{ ...td, textAlign: "left", fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.site_id}</td>
                      <td style={{ ...td, textAlign: "left" }}>{r.site_name ?? "—"}</td>
                      <td style={{ ...td, textAlign: "left" }}>{r.country ?? "—"}<div style={sub}>{r.zone ?? "zone —"}</div></td>
                      <td style={{ ...td, textAlign: "left" }}>
                        {r.kind === "INDOOR" ? "Indoor" : r.kind === "OUTDOOR" ? "Outdoor" : "—"}
                        <div style={sub}>{r.off_grid === true ? "off-grid" : r.off_grid === false ? "on-grid" : (r.grid_supply ?? "réseau inconnu")}</div>
                      </td>
                      <td style={{ ...td, textAlign: "left" }}>
                        <div>{r.ge_label ?? "—"}</div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                          <MatchBadge statut={corr?.statut} title={[corr?.statut ? MATCH_LABELS[corr.statut] : null, corr?.score !== null && corr?.score !== undefined ? `score ${corr.score} %` : null, corr?.methode, corr?.motif].filter(Boolean).join(" · ")} />
                          {corr?.score !== null && corr?.score !== undefined && <span style={sub}>{corr.score} %</span>}
                          <CurveStatusBadge status={corr?.curve_source_status ?? corr?.courbe_statut} />
                        </div>
                      </td>
                      <td style={td}><Val v={r.ge_kva} digits={0} reason="Puissance nominale absente de la Base GE." /></td>
                      <td style={td}>
                        <Val v={r.runtime_total_h} reason="Aucune source de runtime qualifiée sur la période." />
                        <div style={sub}>{r.runtime_days}/{r.days} j</div>
                      </td>
                      <td style={td}>{r.runtime_source_main ? RUNTIME_SOURCE_LABELS[r.runtime_source_main] ?? r.runtime_source_main : <span style={{ color: FT.textSub }}>—</span>}</td>
                      <td style={td}><Val v={r.runtime_source_availability_pct} digits={0} suffix=" %" reason="Aucune source retenue." /></td>
                      <td style={td}><Val v={r.p_ge_moy_kw} digits={2} reason="Aucun jour avec puissance GE qualifiée et CPH calculé." /></td>
                      <td style={td}>{r.power_source_main ? POWER_SOURCE_LABELS[r.power_source_main] ?? r.power_source_main : <span style={{ color: FT.textSub }}>—</span>}</td>
                      <td style={td}>
                        <Val v={r.charge_moy_pct} digits={0} suffix=" %" reason="Charge non calculée." />
                        {r.extrapolated_days > 0 && <div style={{ ...sub, color: FT.orange }}>{r.extrapolated_days} j &lt; 50 %</div>}
                      </td>
                      <td style={td}><Val v={r.cph_moy_l_h} digits={2} reason={motif.text} /></td>
                      <td style={td}>
                        {r.conso_theorique_l !== null ? <Val v={r.conso_theorique_l} digits={0} /> : r.conso_partielle_l !== null && !noCph ? (
                          <span title="Somme des jours calculés : certains jours n'ont pas de CPH (motif à droite)">
                            <Val v={r.conso_partielle_l} digits={0} />
                            <div style={{ ...sub, color: FT.orange }}>partielle ({r.conso_days}/{r.days} j)</div>
                          </span>
                        ) : <Val v={null} reason={motif.text} />}
                      </td>
                      <td style={td}>
                        <Val v={c?.conso_mesuree_l} digits={0} reason="Aucune mesure fuel exploitable sur la période." />
                        {c && c.jours_mesure > 0 && <div style={sub}>{c.jours_mesure}/{r.days} j mesurés</div>}
                      </td>
                      <td style={td}>
                        <Val v={c?.ecart_l} digits={0} reason={c?.motif} />
                        {c && c.ecart_l !== null && c.jours_communs > 0 && <div style={sub}>sur {c.jours_communs} j communs</div>}
                      </td>
                      <td style={td}><Val v={c?.ecart_pct} digits={1} suffix=" %" reason={c?.motif} /></td>
                      <td style={{ ...td, textAlign: "left" }}>
                        {noCph ? (
                          <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, color: FT.violet, background: `${FT.violet}1f`, border: `1px solid ${FT.violet}44` }}>CPH non calculé</span>
                        ) : c ? <ConsoStatusBadge statut={c.statut} /> : null}
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
