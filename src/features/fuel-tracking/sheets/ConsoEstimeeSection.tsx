// src/features/fuel-tracking/sheets/ConsoEstimeeSection.tsx
// « Suivis Consommations » — résultat principal du calcul CPH : conso estimée
// (runtime GE × CPH) par site sur les dates EXACTES choisies, puis comparaison avec
// la conso mesurée (capteur, VW_FUEL_REPORT) quand elle existe. Calcul 100 % backend
// (GET /fuel-tracking/cph/) ; une valeur absente reste « — » avec son motif, jamais 0.

import { useEffect, useState, type CSSProperties } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarRange, Download, Droplets, Fuel, Gauge, Scale, Search } from "lucide-react";

import { exportCph, getCphPeriod, type CphConsoStatus, type CphFilters, type CphMatchStatus, type CphSiteRow } from "@/services/fuelTracking";
import { Card, EmptyState, KpiCard, Pager, Skeleton } from "../ui";
import { FT } from "../theme";
import { CONSO_STATUS_COLORS, CONSO_STATUS_LABELS, ConsoStatusBadge, CorrespondanceCell, MATCH_LABELS } from "./cphBadges";

const RUNTIME_SOURCE_LABELS: Record<string, string> = {
  DSE: "DSE", REDRESSEUR: "Redresseur", DAY_DG_ON: "Day DG On", COMPTEUR_TERRAIN: "Compteur terrain",
};
const POWER_SOURCE_LABELS: Record<string, string> = {
  PRODUCTION_GE: "Production GE", DC_REDRESSEUR: "P_DC / rendement", INDOOR_DC_PLUS_AC_HISTORIQUE: "Indoor : DC + AC historique",
};

const th: CSSProperties = {
  position: "sticky", top: 0, zIndex: 2, background: FT.slateL, color: FT.text, fontSize: 10.5, fontWeight: 800,
  textTransform: "uppercase", letterSpacing: ".04em", textAlign: "center", padding: "9px 10px",
  borderBottom: `1px solid ${FT.borderStrong}`, whiteSpace: "nowrap",
};
const td: CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${FT.border}`, fontSize: 12.5, textAlign: "center", whiteSpace: "nowrap", verticalAlign: "top" };
const sub: CSSProperties = { fontSize: 11, color: FT.textSub };
const control: CSSProperties = { border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px", fontSize: 12.5, color: FT.text, fontWeight: 700 };
const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${FT.border}`, background: FT.card, color: FT.text, cursor: "pointer", fontSize: 12, fontWeight: 800, borderRadius: 9, padding: "7px 12px" };

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

function motifFor(r: CphSiteRow): string | null {
  const c = r.comparaison;
  if (!c) return null;
  if (c.statut === "CONSO_ESTIMEE_NON_CALCULEE") {
    if (r.blocage && r.blocage.etape === "cph") return `${r.blocage.label}${r.blocage.detail ? ` — ${r.blocage.detail}` : ""}`;
    return r.curve_reason ?? r.motifs[0] ?? c.motif;
  }
  const partial = r.conso_theorique_l === null && r.conso_partielle_l !== null ? ` · conso estimée partielle (${r.conso_days}/${r.days} j)` : "";
  // Aucun jour avec CPH (seuls des jours GE à l'arrêt à 0 L) : on dit pourquoi le CPH manque.
  const noCph = r.cph_days === 0 && r.blocage?.etape === "cph" ? `CPH non calculé : ${r.blocage.label} · ` : "";
  return `${noCph}${c.motif ?? ""}${partial}`;
}

const CONSO_FILTERS: Array<CphConsoStatus | ""> = ["", "COHERENT", "ECART_A_JUSTIFIER", "ECART_A_INVESTIGUER", "MESURE_ABSENTE", "CONSO_ESTIMEE_NON_CALCULEE"];

export function ConsoEstimeeSection({ month }: { month: string | null | undefined }) {
  const [period, setPeriod] = useState(() => monthPeriod(month));
  const [filters, setFilters] = useState<Pick<CphFilters, "statut_conso" | "correspondance">>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [exporting, setExporting] = useState(false);
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

  const setFilter = (k: keyof typeof filters, v: string) => { setFilters((f) => ({ ...f, [k]: v || undefined })); setPage(1); };
  const choose = (start: string, end: string) => { setPeriod({ start, end }); setPage(1); };

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await exportCph("controle", params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conso_estimee_vs_mesuree_${period.start}_${period.end}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(apiError(e));
    } finally {
      setExporting(false);
    }
  }

  const count = (n: number | undefined) => (n === undefined ? "" : ` (${n.toLocaleString("fr-FR")})`);
  const fmtL = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v).toLocaleString("fr-FR")} L`);

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
              Conso estimée = runtime GE × CPH de la courbe, jour par jour sur les dates exactes ; comparée à la mesure capteur quand elle existe.
              {data?.pagination && ` ${data.pagination.total.toLocaleString("fr-FR")} site(s) avec GE.`}
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
          <KpiCard label="Conso estimée calculée" value={`${conso.sites_estimee_complete.toLocaleString("fr-FR")} site(s)`}
            sub={`tous les jours calculés · ${conso.sites_estimee_partielle} partiel(s) · ${conso.sites_estimee_non_calculee} non calculé(s)`} tone="violet" icon={<Gauge size={14} />} />
          <KpiCard label="Conso estimée totale" value={fmtL(conso.total_estimee_complete_l)} sub="sites à conso estimée complète" tone="cyan" icon={<Fuel size={14} />} />
          <KpiCard label="Conso mesurée totale" value={fmtL(conso.total_mesuree_l)} sub={`${conso.sites_mesure} site(s) avec mesure capteur`} tone="slate" icon={<Droplets size={14} />} />
          <KpiCard label="Estimée vs mesurée comparées" value={`${conso.sites_compares.toLocaleString("fr-FR")} site(s)`}
            sub={`${conso.statuts.COHERENT ?? 0} cohérents · ${conso.statuts.ECART_A_JUSTIFIER ?? 0} à justifier · ${conso.statuts.ECART_A_INVESTIGUER ?? 0} à investiguer`} tone="green" icon={<Scale size={14} />} />
        </div>
      ) : q.isLoading ? <div style={{ marginBottom: 14 }}><Skeleton h={96} /></div> : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
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
        <select aria-label="Correspondance plaque → courbe" value={filters.correspondance ?? ""} onChange={(e) => setFilter("correspondance", e.target.value)} style={{ ...control, cursor: "pointer", maxWidth: 300 }}>
          <option value="">Correspondance : toutes</option>
          {(Object.keys(MATCH_LABELS) as CphMatchStatus[]).map((k) => (
            <option key={k} value={k}>{k}{s?.correspondances ? ` (${s.correspondances[k] ?? 0})` : ""}</option>
          ))}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 7, ...control, minWidth: 200, flex: "0 1 240px" }}>
          <Search size={14} color={FT.textSub} aria-hidden />
          <input aria-label="Rechercher un site" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Site ID ou nom..." style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 12.5, minWidth: 0 }} />
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={handleExport} disabled={exporting || !!periodError} style={{ ...btn, opacity: exporting ? 0.6 : 1 }} title="Export CSV site × jour (runtime, puissance, CPH, conso estimée, conso mesurée, écart, statuts)">
          <Download size={13} color={FT.blue} aria-hidden /> {exporting ? "Export…" : "Exporter (CSV)"}
        </button>
      </div>
      {exportError && <div role="alert" style={{ color: FT.red, fontSize: 12.5, marginBottom: 10 }}>Export impossible : {exportError}</div>}

      {q.isLoading ? (
        <Skeleton h={420} />
      ) : q.isError ? (
        <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Calcul impossible : {apiError(q.error)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Gauge size={20} />} title="Aucun site" subtitle={filters.statut_conso || filters.correspondance || search ? "Aucun site ne correspond à ces filtres." : "Aucun site avec GE, ou les données Snowflake ne sont pas encore synchronisées pour ces dates."} />
      ) : (
        <>
          <div style={{ overflow: "auto", maxHeight: 620, borderRadius: 12, border: `1px solid ${FT.border}`, opacity: q.isFetching ? 0.6 : 1 }} aria-busy={q.isFetching}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1640 }}>
              <caption className="sr-only">Conso estimée par le calcul CPH et conso mesurée, par site</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ ...th, textAlign: "left" }}>Site</th>
                  <th scope="col" style={{ ...th, textAlign: "left" }}>Correspondance / courbe</th>
                  <th scope="col" style={th} title="Runtime GE retenu, source principale et sa disponibilité sur la période">Runtime GE (h)</th>
                  <th scope="col" style={th}>Puissance GE (kW)</th>
                  <th scope="col" style={th}>Charge GE (%)</th>
                  <th scope="col" style={th}>CPH (L/h)</th>
                  <th scope="col" style={th} title="Runtime GE × CPH, sommé jour par jour ; affichée seulement si tous les jours sont calculés">Conso estimée (L)</th>
                  <th scope="col" style={th} title="Capteur de cuve, VW_FUEL_REPORT (QUALITY_STATUS = OK, ≥ 2 points valides)">Conso mesurée (L)</th>
                  <th scope="col" style={th} title="Conso mesurée − conso estimée, sur les jours où les deux existent">Écart (L)</th>
                  <th scope="col" style={th}>Écart (%)</th>
                  <th scope="col" style={{ ...th, textAlign: "left" }}>Statut et motif</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const c = r.comparaison;
                  const motif = motifFor(r);
                  return (
                    <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
                      <td style={{ ...td, textAlign: "left" }}>
                        <div style={{ fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.site_id}</div>
                        <div style={sub}>{r.site_name ?? "—"} · {r.kind === "INDOOR" ? "Indoor" : r.kind === "OUTDOOR" ? "Outdoor" : "type ?"}</div>
                        <div style={sub}>{r.ge_label ?? "GE inconnu"}</div>
                      </td>
                      <td style={{ ...td, textAlign: "left" }}><CorrespondanceCell c={r.correspondance} fallbackCurveId={r.curve?.curve_id} /></td>
                      <td style={td}>
                        <Val v={r.runtime_total_h} reason="Aucune source de runtime ne passe les contrôles sur la période." />
                        <div style={sub}>
                          {r.runtime_source_main ? `${RUNTIME_SOURCE_LABELS[r.runtime_source_main] ?? r.runtime_source_main} · dispo ${nf(r.runtime_source_availability_pct, 0) ?? "—"} %` : "aucune source"}
                        </div>
                        <div style={sub}>{r.runtime_days}/{r.days} j</div>
                      </td>
                      <td style={td}>
                        <Val v={r.p_ge_moy_kw} digits={2} reason="Aucun jour avec puissance GE qualifiée et CPH calculé." />
                        <div style={sub}>{r.power_source_main ? POWER_SOURCE_LABELS[r.power_source_main] ?? r.power_source_main : "—"}</div>
                      </td>
                      <td style={td}>
                        <Val v={r.charge_moy_pct} digits={0} suffix=" %" reason="Charge non calculée (pas de CPH)." />
                        {r.extrapolated_days > 0 && <div style={{ ...sub, color: FT.orange }}>{r.extrapolated_days} j &lt; 50 %</div>}
                      </td>
                      <td style={td}><Val v={r.cph_moy_l_h} digits={2} reason={r.curve ? "Aucun jour avec runtime et puissance GE." : r.curve_reason} /></td>
                      <td style={td}>
                        {r.conso_theorique_l !== null ? <Val v={r.conso_theorique_l} digits={0} /> : r.conso_partielle_l !== null ? (
                          <span title="Somme partielle : certains jours n'ont pas de conso estimée">
                            <span style={{ color: FT.textSub }}>—</span>
                            <div style={{ ...sub, color: FT.orange }}>partielle {nf(r.conso_partielle_l, 0)} L ({r.conso_days}/{r.days} j)</div>
                          </span>
                        ) : <Val v={null} reason={motif} />}
                      </td>
                      <td style={td}>
                        <Val v={c?.conso_mesuree_l} digits={0} reason="Aucune mesure capteur exploitable sur la période." />
                        {c && c.jours_mesure > 0 && <div style={sub}>{c.jours_mesure}/{r.days} j mesurés</div>}
                      </td>
                      <td style={td}>
                        <Val v={c?.ecart_l} digits={0} reason={c?.motif} />
                        {c && c.jours_communs > 0 && <div style={sub}>sur {c.jours_communs} j communs</div>}
                      </td>
                      <td style={td}><Val v={c?.ecart_pct} digits={1} suffix=" %" reason={c?.motif} /></td>
                      <td style={{ ...td, textAlign: "left", whiteSpace: "normal", minWidth: 240, maxWidth: 360 }}>
                        {c && <ConsoStatusBadge statut={c.statut} />}
                        {motif && <div style={{ fontSize: 11.5, color: FT.textMid, marginTop: 3 }}>{motif}</div>}
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
