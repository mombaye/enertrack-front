// src/features/fuel-tracking/sheets/ControleCphSheet.tsx
// Onglet Contrôle CPH — instruction globale Suivi Carburant / CPH (abaque PRP
// 50 Hz). Calcul site/jour sur la plage EXACTE choisie, entièrement côté
// backend (fuel_tracking/services/cph_engine.py) : cet écran n'affiche que des
// valeurs traçables, une valeur absente reste « — » avec son motif.

import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, CalendarRange, CheckCircle2, ChevronRight, Columns3, Download, FileUp, Fuel, Gauge, HelpCircle, Info, ListChecks, Scale, Search, SlidersHorizontal, XCircle } from "lucide-react";

import {
  approveCphCurve,
  autoMatchCphMappings,
  exportCph,
  getCphPeriod,
  getCphReferentiel,
  getCphSiteDetail,
  importCphAbaque,
  importCphObservations,
  revokeCphCurve,
  unvalidateCphMapping,
  validateCphMapping,
  type CphAbaqueImportResult,
  type CphFilters,
  type CphMeta,
  type CphObservationImportResult,
  type CphReconciliation,
  type CphReconciliationStatus,
  type CphReferentielMapping,
  type CphSiteDetail,
  type CphSiteRow,
  type CphSynthesis,
} from "@/services/fuelTracking";
import { Card, EmptyState, KpiCard, Modal, Pager, Skeleton } from "../ui";
import { FT } from "../theme";
import { CorrespondanceCell, curveSourceCode, CurveStatusBadge, FreshnessWarning, GLOSSARY, HelpTip, MATCH_LABELS, MatchBadge, MOTIF_LABELS } from "./cphBadges";
import { AcReferencePanel, BlocageDiagnostic, CoverageKpis, PeriodeIncompleteBanner, POWER_METHOD_LABELS, PowerTrace, StatutCphBadge, StatutRapproBadge } from "./cphDiagnostics";

// ─── Libellés ────────────────────────────────────────────────────────────────

const RUNTIME_SOURCE_LABELS: Record<string, string> = {
  DSE: "DSE",
  REDRESSEUR: "Redresseur",
  DAY_DG_ON: "Day DG On",
  COMPTEUR_TERRAIN: "Compteur terrain",
  AUCUNE: "Aucune source",
};

const POWER_SOURCE_LABELS: Record<string, string> = {
  PRODUCTION_GE: "Production GE",
  DC_REDRESSEUR: "P_DC / rendement",
  ESTIMATION_HISTORIQUE_LOAD_AC: "ESTIMATION_HISTORIQUE_LOAD_AC (indoor)",
  AUCUNE: "Aucune",
};

const STATUT_LABELS: Record<CphReconciliationStatus, string> = {
  OK: "OK",
  A_JUSTIFIER: "À justifier",
  A_INVESTIGUER: "À investiguer",
  DONNEES_INCOMPLETES: "Données incomplètes",
  CPH_NON_CALCULE: "CPH non calculé",
};

const STATUT_COLORS: Record<CphReconciliationStatus, string> = {
  OK: FT.green,
  A_JUSTIFIER: FT.orange,
  A_INVESTIGUER: FT.red,
  DONNEES_INCOMPLETES: FT.slate,
  CPH_NON_CALCULE: FT.violet,
};

const CPH_STATUS_LABELS: Record<string, string> = {
  COMPLET: "Complet",
  PARTIEL: "Partiel",
  NON_CALCULE: "Non calculé",
};

const DAY_STATUS_LABELS: Record<string, string> = {
  CPH_CALCULE: "CPH calculé",
  GE_A_L_ARRET: "GE à l'arrêt (0 h)",
  RUNTIME_ABSENT: "Runtime absent",
  PUISSANCE_ABSENTE: "Puissance absente",
  COURBE_ABSENTE: "Courbe absente",
  PUISSANCE_HORS_PLAFOND: "Puissance > 105 %",
  CPH_HORS_DOMAINE: "Hors domaine courbe",
};

// Bulles d'aide par mesure (instruction §9) : formule, unité SI, source.
const HELP: Record<string, string> = {
  runtime: "Runtime GE journalier (h). Priorité stricte : DSE (GENSET_REPORT.DG_RUNTIME_CONTROLLER, 0-24 h, 0 valide) > redresseur actif par créneaux 5 min (sites off-grid) > Day DG On (GENSET_REPORT.DG_RUNTIME_CALCULATED, contrôle de coalescence à 0) > compteur terrain (GFMS_DATA_TRACKER_NC). Une source n'est exploitable que si elle est disponible ≥ 50 % des jours de la période.",
  disponibilite: "Disponibilité d'une source (%) = jours avec une valeur non nulle ÷ jours de la période. Jamais de COALESCE à 0.",
  puissance: GLOSSARY.puissance,
  courbe: "mapping_status (correspondance libellé GE Base GE + kVA → courbe de l'abaque PRP 50 Hz) : appliquée si AUTO_VALIDE_COMPATIBLE (candidat unique, score ≥ 70 %, sans contradiction) ou VALIDE_MANUELLEMENT. Le second badge est curve_source_status (VALIDE_CONSTRUCTEUR, HISTORIQUE_A_VALIDER, ARCHIVE, DISTRIBUTEUR), jamais modifié par le mapping.",
  cph: `${GLOSSARY.cph} ${GLOSSARY.charge} Une charge < 50 % est une extrapolation mathématique. Moyenne pondérée par le runtime.`,
  conso: "Consommation théorique (L) = Σ runtime GE (h) × CPH (L/h) sur chaque jour de la plage. Affichée uniquement si TOUS les jours sont calculés ; sinon la somme partielle est indiquée à part.",
  stock: "Stocks et mouvements (L) issus du fichier d'observation standard. Une cellule vide reste vide, jamais 0.",
  livraisons: "Livraisons ENOC (L). Tant que la source ENOC réelle n'est pas raccordée, elles restent « à contrôler » et bloquent le rapprochement.",
  consoStock: "Consommation stock (L) = stock initial + livraisons + rajouts − retraits − vols − vidanges − stock final.",
  ecart: "Écart (L) = consommation stock − consommation théorique ; écart (%) = 100 × écart ÷ consommation théorique.",
  statut: "OK si |écart| ≤ max(100 L, 10 %) ; À justifier jusqu'à max(200 L, 20 %) ; À investiguer au-delà. Données incomplètes / CPH non calculé si un élément manque.",
};

// ─── Petits composants ───────────────────────────────────────────────────────

function nf(value: number | null | undefined, digits = 1, suffix = "") {
  if (value === null || value === undefined) return null;
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
}

/** Valeur numérique honnête : null → « — » avec motif, 0 reste 0. */
function Num({ value, digits = 1, suffix = "", reason }: { value: number | null | undefined; digits?: number; suffix?: string; reason?: string | null }) {
  const txt = nf(value, digits, suffix);
  if (txt === null) {
    return <span style={{ color: FT.textSub, cursor: reason ? "help" : undefined }} title={reason ?? undefined} aria-label={reason ? `non disponible : ${reason}` : "non disponible"}>—</span>;
  }
  return <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>{txt}</span>;
}

function StatutBadge({ statut }: { statut: CphReconciliationStatus }) {
  const color = STATUT_COLORS[statut];
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, color, background: `${color}1f`, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>
      {STATUT_LABELS[statut]}
    </span>
  );
}

function Tag({ children, tone = FT.slate }: { children: ReactNode; tone?: string }) {
  return (
    <span style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color: tone, background: `${tone}14`, border: `1px solid ${tone}33`, borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

const th: CSSProperties = {
  position: "sticky", top: 0, zIndex: 2, background: FT.slateL, color: FT.text, fontSize: 10.5, fontWeight: 800,
  textTransform: "uppercase", letterSpacing: ".04em", textAlign: "center", padding: "9px 10px",
  borderBottom: `1px solid ${FT.borderStrong}`, whiteSpace: "nowrap",
};
const td: CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${FT.border}`, fontSize: 12.5, textAlign: "center", whiteSpace: "nowrap" };
const control: CSSProperties = { border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px", fontSize: 12.5, color: FT.text, fontWeight: 700 };
const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${FT.border}`, background: FT.card, color: FT.text, cursor: "pointer", fontSize: 12, fontWeight: 800, borderRadius: 9, padding: "7px 12px" };

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultPeriod() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { start: isoDate(start), end: isoDate(end) };
}

function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function apiError(e: unknown) {
  const err = e as { response?: { data?: { detail?: string } }; message?: string };
  return err?.response?.data?.detail ?? err?.message ?? "Erreur inconnue";
}

// ─── Détail d'un site (jour par jour) ────────────────────────────────────────

function ReconciliationBlock({ r }: { r: CphReconciliation }) {
  return (
    <div style={{ border: `1px solid ${FT.border}`, borderRadius: 9, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <strong style={{ fontSize: 12.5 }}>Observation {fmtDate(r.observation_start)} → {fmtDate(r.observation_end)}</strong>
        <StatutBadge statut={r.statut} />
        {r.livraisons_statut === "LIVRAISONS_ENOC_A_CONTROLER" && <Tag tone={FT.orange}>Livraisons ENOC à contrôler</Tag>}
        <span style={{ fontSize: 11, color: FT.textSub }}>Fichier : {r.import_file ?? "—"} · statut observation : {r.observation_status ?? "—"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, fontSize: 12 }}>
        {([
          ["Stock initial", r.stock_initial_l], ["Livraisons", r.livraisons_l], ["Rajouts", r.rajouts_l],
          ["Retraits", r.retraits_l], ["Vols", r.vols_l], ["Vidanges", r.vidanges_l], ["Stock final", r.stock_final_l],
          ["Conso théorique", r.conso_theorique_l], ["Conso stock", r.conso_stock_l], ["Écart", r.ecart_l],
        ] as Array<[string, number | null]>).map(([label, v]) => (
          <div key={label}>
            <div style={{ color: FT.textSub, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
            <Num value={v} digits={1} suffix=" L" />
          </div>
        ))}
        <div>
          <div style={{ color: FT.textSub, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>Écart %</div>
          <Num value={r.ecart_pct} digits={1} suffix=" %" />
        </div>
      </div>
      <div style={{ fontSize: 11, color: FT.textSub, marginTop: 6 }}>
        Conso théorique calculée sur {r.jours_conso_calculee}/{r.jours_observation} jour(s).
      </div>
      {r.motifs.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 11.5, color: FT.textMid }}>
          {r.motifs.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
    </div>
  );
}

// ─── Chaîne de calcul d'un site (résumé lisible en tête du détail) ──────────

function CalculationChain({ d }: { d: CphSiteDetail }) {
  const rec = d.rapprochement;
  const steps: Array<{ label: string; value: string | null; sub: string; reason: string | null }> = [
    {
      label: "Heures de marche", value: nf(d.runtime_total_h, 1, " h"),
      sub: `${d.runtime_days}/${d.days} j${d.runtime_source_main ? ` · ${RUNTIME_SOURCE_LABELS[d.runtime_source_main]}` : ""}`,
      reason: "Aucune source fiable",
    },
    {
      label: "Puissance GE", value: nf(d.p_ge_moy_kw, 2, " kW"),
      sub: d.power_source_main ? POWER_SOURCE_LABELS[d.power_source_main] : "—", reason: "Non disponible",
    },
    { label: "Courbe", value: d.curve ? d.curve.curve_id : null, sub: d.curve ? d.curve.label : d.ge_label ?? "GE inconnu", reason: d.curve_reason ? `Pas de courbe : ${d.curve_reason}` : "Pas de courbe" },
    { label: "CPH", value: nf(d.cph_moy_l_h, 2, " L/h"), sub: `${d.cph_days}/${d.days} j calculés`, reason: "Non calculé" },
    {
      label: "Conso théorique", value: nf(d.conso_theorique_l, 0, " L"),
      sub: d.conso_partielle_l !== null ? `partiel ${nf(d.conso_partielle_l, 0, " L")} (${d.conso_days}/${d.days} j)` : CPH_STATUS_LABELS[d.cph_status] ?? "",
      reason: d.conso_partielle_l !== null ? "Période incomplète" : "Non calculée",
    },
    { label: "Conso stock", value: nf(rec?.conso_stock_l, 0, " L"), sub: rec ? `relevé ${fmtDate(rec.observation_start)} → ${fmtDate(rec.observation_end)}` : "aucun relevé", reason: rec ? "Non calculée — voir le verdict" : "Aucun relevé" },
    { label: "Écart", value: nf(rec?.ecart_l, 0, " L"), sub: rec?.ecart_pct !== null && rec?.ecart_pct !== undefined ? nf(rec.ecart_pct, 1, " %") ?? "" : STATUT_LABELS[d.rapprochement_statut], reason: "Pas de comparaison" },
  ];
  return (
    <section aria-label="Chaîne de calcul du site">
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "stretch" }}>
        {steps.map((st, i) => {
          const ok = st.value !== null;
          return (
            <li key={st.label} style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 130px", minWidth: 0 }}>
              <div style={{ flex: 1, minWidth: 0, border: `1px solid ${FT.border}`, borderTop: `3px solid ${ok ? FT.green : FT.slate}`, borderRadius: 9, padding: "7px 9px", background: ok ? FT.card : FT.slateL, height: "100%" }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: FT.textSub, textTransform: "uppercase" }}>{i + 1}. {st.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: ok ? FT.text : FT.textSub }}>{st.value ?? "—"}</div>
                <div style={{ fontSize: 10.5, color: ok ? FT.textMid : FT.orange, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={ok ? st.sub : st.reason ?? undefined}>
                  {ok ? st.sub : st.reason}
                </div>
              </div>
              {i < steps.length - 1 && <ChevronRight size={14} color={FT.textSub} aria-hidden style={{ flexShrink: 0 }} />}
            </li>
          );
        })}
      </ol>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap", fontSize: 12.5 }}>
        <strong>Correspondance :</strong>
        <MatchBadge statut={d.correspondance?.statut} />
        {d.correspondance?.score !== null && d.correspondance?.score !== undefined && <span style={{ fontSize: 11.5, color: FT.textSub }}>score {d.correspondance.score} % · {d.correspondance.methode}</span>}
        {(d.correspondance?.courbe_statut || d.curve?.status) && <>
          <strong style={{ marginLeft: 6 }}>Qualité courbe :</strong> <CurveStatusBadge status={d.correspondance?.courbe_statut ?? d.curve?.status} />
        </>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap", fontSize: 12.5 }}>
        <strong>Calcul CPH :</strong> <StatutCphBadge statut={d.statut_cph} />
        <span style={{ fontSize: 11.5, color: FT.textSub }}>{d.conso_days}/{d.days} j calculés</span>
        <strong style={{ marginLeft: 6 }}>Stock :</strong> <StatutRapproBadge statut={d.statut_rapprochement_calcul} />
        <strong style={{ marginLeft: 6 }}>Verdict :</strong> <StatutBadge statut={d.rapprochement_statut} />
        {d.blocage && (
          <span style={{ color: d.blocage.etape === "cph" ? FT.violet : FT.orange }}>
            Point bloquant : <strong>{d.blocage.label}</strong>{d.blocage.detail ? ` — ${d.blocage.detail}` : ""}
          </span>
        )}
      </div>
    </section>
  );
}

function SiteDetailModal({ siteId, start, end, onClose }: { siteId: string; start: string; end: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ["cph-site", siteId, start, end], queryFn: () => getCphSiteDetail(siteId, { start, end }) });
  const d = q.data;
  return (
    <Modal title={`${siteId} — détail du ${fmtDate(start)} au ${fmtDate(end)}`} onClose={onClose} maxWidth={1180}>
      {q.isLoading && <Skeleton h={320} />}
      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Impossible de charger le détail : {apiError(q.error)}</div>}
      {d && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12.5 }}>
          <CalculationChain d={d} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <div><strong>Site</strong> : {d.site_name ?? "—"} · {d.zone ?? "zone —"} · {d.country ?? "—"}</div>
            <div><strong>Type</strong> : {d.kind ?? "inconnu"}{d.kind_source ? ` (${d.kind_source})` : ""} · réseau : {d.grid_supply ?? "inconnu"}</div>
            <div><strong>GE inventaire</strong> : {d.ge_label ?? "—"} · DG_COUNT {d.dg_count ?? "—"}</div>
            <div>
              <strong>Courbe</strong> :{" "}
              {d.curve ? (
                <>
                  {d.curve.curve_id} {d.curve.label} — PRP {nf(d.curve.prp_kva, 0)} kVA / {nf(d.curve.prp_kw, 1)} kW, cos φ {nf(d.curve.power_factor, 2)} ·
                  a={d.curve.a} b={d.curve.b} c={d.curve.c} <Tag tone={FT.green}>{d.curve.status}</Tag>
                </>
              ) : (
                <span style={{ color: FT.orange }}>aucune — {d.curve_reason}</span>
              )}
            </div>
          </div>
          {d.data_issue && <div role="alert" style={{ color: FT.red }}>{d.data_issue}</div>}

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Sources de runtime sur la période <HelpTip label="disponibilité" text={HELP.disponibilite} /></div>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th scope="col" style={th}>Priorité</th><th scope="col" style={th}>Source</th><th scope="col" style={th}>Disponibilité</th>
                  <th scope="col" style={th}>Jours valides</th><th scope="col" style={th}>Exploitable</th><th scope="col" style={{ ...th, textAlign: "left" }}>Motif de rejet</th>
                </tr>
              </thead>
              <tbody>
                {(["DSE", "REDRESSEUR", "DAY_DG_ON", "COMPTEUR_TERRAIN"] as const).map((s, i) => {
                  const ev = d.sources[s];
                  return (
                    <tr key={s}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>{RUNTIME_SOURCE_LABELS[s]}</td>
                      <td style={td}><Num value={ev.availability_pct} digits={0} suffix=" %" /></td>
                      <td style={td}>{ev.days_valid}/{d.days}</td>
                      <td style={td}>{ev.exploitable ? <Tag tone={FT.green}>Oui</Tag> : <Tag tone={FT.slate}>Non</Tag>}</td>
                      <td style={{ ...td, textAlign: "left", whiteSpace: "normal" }}>{ev.rejection ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PeriodeIncompleteBanner periode={d.periode} />
          {d.ac_reference && (
            <div style={{ border: `1px solid ${FT.border}`, borderRadius: 9, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Load AC historique (indoor) — jours réseau sans GE</div>
              <AcReferencePanel ac={d.ac_reference} />
            </div>
          )}
          <div style={{ fontSize: 11.5, color: FT.textSub }}>{d.batterie ?? "BATTERIE_NON_INTEGREE — validation du sens énergétique requise"} : aucune puissance batterie n'est ajoutée à P_DC.</div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Rapprochement stock</div>
            {d.reconciliations.length === 0
              ? <div style={{ color: FT.textSub }}>Aucune observation de stock entièrement incluse dans la période — statut Données incomplètes.</div>
              : d.reconciliations.map((r) => <ReconciliationBlock key={`${r.observation_start}-${r.observation_end}`} r={r} />)}
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Détail jour par jour</div>
            <div style={{ overflow: "auto", maxHeight: 420, border: `1px solid ${FT.border}`, borderRadius: 9 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1250 }}>
                <thead>
                  <tr>
                    <th scope="col" style={th}>Date</th>
                    <th scope="col" style={th}>Runtime (h)</th>
                    <th scope="col" style={th}>Source</th>
                    <th scope="col" style={th}>Brut DSE / Redr. / DG On / Compteur (h)</th>
                    <th scope="col" style={th}>P GE (kW)</th>
                    <th scope="col" style={th}>Source puissance</th>
                    <th scope="col" style={th}>Charge</th>
                    <th scope="col" style={th}>CPH (L/h)</th>
                    <th scope="col" style={th}>Conso (L)</th>
                    <th scope="col" style={th}>Statut</th>
                    <th scope="col" style={{ ...th, textAlign: "left" }}>Détail / motifs</th>
                  </tr>
                </thead>
                <tbody>
                  {d.daily.map((day) => (
                    <tr key={day.date}>
                      <td style={td}>{fmtDate(day.date)}</td>
                      <td style={td}><Num value={day.runtime_h} digits={2} reason={day.runtime_h === null ? day.motifs[0] : null} /></td>
                      <td style={td}>{day.runtime_source ? RUNTIME_SOURCE_LABELS[day.runtime_source] : "—"}</td>
                      <td style={{ ...td, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5 }}>
                        {(["DSE", "REDRESSEUR", "DAY_DG_ON", "COMPTEUR_TERRAIN"] as const).map((s) => nf(day.raw[s], 2) ?? "—").join(" / ")}
                      </td>
                      <td style={td}><Num value={day.p_ge_kw} digits={2} /></td>
                      <td style={td}>{day.power_method ? POWER_METHOD_LABELS[day.power_method] : day.power_source ? POWER_SOURCE_LABELS[day.power_source] : "—"}</td>
                      <td style={td}>
                        <Num value={day.charge_pct} digits={1} suffix=" %" />
                        {day.extrapolated && <> <Tag tone={FT.orange}>&lt; 50 % extrapolé</Tag></>}
                      </td>
                      <td style={td}><Num value={day.cph_l_h} digits={2} /></td>
                      <td style={td}><Num value={day.conso_l} digits={1} /></td>
                      <td style={td}>
                        <Tag tone={day.status === "CPH_CALCULE" || day.status === "GE_A_L_ARRET" ? FT.green : FT.slate}>{DAY_STATUS_LABELS[day.status] ?? day.status}</Tag>
                        {day.motif_code && <div style={{ fontSize: 10.5, color: FT.violet, fontFamily: "ui-monospace, Menlo, monospace" }}>{day.motif_code}</div>}
                      </td>
                      <td style={{ ...td, textAlign: "left", whiteSpace: "normal", minWidth: 280, fontSize: 11.5, color: FT.textMid }}>
                        {day.power_trace ? (
                          <details>
                            <summary style={{ cursor: "pointer" }}>{[day.power_detail, ...day.motifs].filter(Boolean).join(" · ") || "Méthodes de puissance tentées"}</summary>
                            <div style={{ marginTop: 6 }}><PowerTrace day={day} /></div>
                          </details>
                        ) : [day.power_detail, ...day.motifs].filter(Boolean).join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Préparation des données : ce qui doit être prêt avant de lire les résultats ─

type PrepItem = { key: string; title: string; short: string; ready: boolean; partial?: boolean; pending?: boolean; status: ReactNode; actions?: ReactNode };
type PrepHandlers = { onAbaque: () => void; onReferentiel: () => void; onObservations: () => void };

function prepTone(item: PrepItem) {
  return item.ready ? (item.partial ? FT.orange : FT.green) : item.pending ? FT.orange : FT.red;
}

function prepItems(meta: CphMeta, h: PrepHandlers): PrepItem[] {
  const primary: CSSProperties = { ...btn, background: FT.navy, color: "#fff", borderColor: FT.navy };
  const hasAbaque = meta.curves_total > 0;
  const obs = meta.observations_last_import;
  const sync = meta.facts_last_sync;
  return [
    {
      key: "snowflake", title: "Données Snowflake (heures de marche, puissance)", ready: !!meta.facts_last_date && !meta.facts_stale && !meta.last_sync_failed,
      short: meta.facts_last_date ? `Snowflake jusqu'au ${fmtDate(meta.facts_last_date)}` : "Snowflake : aucune donnée",
      status: meta.facts_last_date
        ? <>Disponibles jusqu'au <strong>{fmtDate(meta.facts_last_date)}</strong> · mise à jour automatique toutes les heures.</>
        : <>Aucune donnée synchronisée{sync ? ` (dernier essai : ${sync.status}${sync.error ? ` — ${sync.error}` : ""})` : " — la synchronisation n'a encore jamais tourné"}.</>,
    },
    {
      key: "abaque", title: "Abaque CPH (courbes des GE)", ready: hasAbaque,
      short: hasAbaque ? `Abaque : ${meta.curves_usable}/${meta.curves_total} courbes` : "Abaque non importé",
      status: hasAbaque
        ? <>{meta.curves_usable}/{meta.curves_total} courbes utilisables · {meta.abaque_file ?? "abaque"}{meta.abaque_imported_at ? `, importé le ${new Date(meta.abaque_imported_at).toLocaleDateString("fr-FR")}` : ""}</>
        : "Non importé : aucun CPH ne peut être calculé.",
      actions: <button type="button" onClick={h.onAbaque} style={hasAbaque ? btn : primary}><FileUp size={13} aria-hidden /> {hasAbaque ? "Mettre à jour" : "Importer l'abaque CPH"}</button>,
    },
    {
      key: "plaques", title: "Correspondances plaque → courbe", ready: meta.mappings_validated > 0, partial: meta.mappings_validated < meta.mappings_total,
      short: `Correspondances : ${meta.mappings_validated}/${meta.mappings_total} actives`,
      status: !hasAbaque ? "Disponible après l'import de l'abaque."
        : <>
            <strong>{meta.mappings_validated}</strong>/{meta.mappings_total} types de GE avec une courbe appliquée
            ({meta.mappings_by_status?.AUTO_VALIDE_COMPATIBLE ?? 0} auto, {meta.mappings_by_status?.VALIDE_MANUELLEMENT ?? 0} manuelles).
            À traiter : {meta.mappings_by_status?.A_VALIDER ?? 0} à valider, {meta.mappings_by_status?.MODELE_AMBIGU ?? 0} ambiguës, {meta.mappings_by_status?.COURBE_CPH_MANQUANTE ?? 0} sans courbe.
          </>,
      actions: <button type="button" onClick={h.onReferentiel} disabled={!hasAbaque} style={{ ...(hasAbaque && meta.mappings_validated === 0 ? primary : btn), opacity: hasAbaque ? 1 : 0.5, cursor: hasAbaque ? "pointer" : "not-allowed" }}><BookOpen size={13} aria-hidden /> Traiter les exceptions</button>,
    },
    {
      key: "obs", title: "Relevés de stock (fichier d'observation)", ready: !!obs,
      short: obs ? `Relevés : ${obs.file_name}` : "Aucun relevé de stock",
      status: obs
        ? <>{obs.file_name} · {obs.rows_imported} ligne(s){obs.rows_rejected ? `, ${obs.rows_rejected} rejetée(s)` : ""} · {new Date(obs.at).toLocaleDateString("fr-FR")}</>
        : "Aucun relevé importé : pas de comparaison avec le stock.",
      actions: <>
        <button type="button" onClick={h.onObservations} style={obs ? btn : primary}><FileUp size={13} aria-hidden /> Importer les relevés</button>
        <button type="button" onClick={downloadObservationTemplate} style={btn}><Download size={13} aria-hidden /> Modèle</button>
      </>,
    },
    {
      key: "enoc", title: "Livraisons ENOC", ready: meta.enoc_deliveries_connected, pending: true,
      short: meta.enoc_deliveries_connected ? "Livraisons ENOC raccordées" : "Livraisons ENOC à contrôler",
      status: meta.enoc_deliveries_connected
        ? "Raccordées : les rapprochements peuvent conclure."
        : <>Non raccordées : les rapprochements restent <strong>« à contrôler »</strong> (aucun verdict OK / À justifier / À investiguer).</>,
    },
  ];
}

function PrepIcon({ item, size = 15 }: { item: PrepItem; size?: number }) {
  const Icon = item.ready && !item.partial ? CheckCircle2 : item.ready || item.pending ? AlertTriangle : XCircle;
  return <Icon size={size} color={prepTone(item)} aria-hidden style={{ flexShrink: 0 }} />;
}

function PrepTile({ item }: { item: PrepItem }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, border: `1px solid ${FT.border}`, borderTop: `3px solid ${prepTone(item)}`, borderRadius: 10, padding: "10px 12px", background: FT.card, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <PrepIcon item={item} />
        <h4 style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: FT.text }}>{item.title}</h4>
      </div>
      <div style={{ fontSize: 11.5, color: FT.textMid, flex: 1, overflowWrap: "anywhere" }}>{item.status}</div>
      {item.actions && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{item.actions}</div>}
    </div>
  );
}

function PreparationModal({ meta, handlers, onClose }: { meta: CphMeta; handlers: PrepHandlers; onClose: () => void }) {
  const items = prepItems(meta, handlers);
  const group = (title: string, list: PrepItem[]) => (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
        {list.map((i) => <PrepTile key={i.key} item={i} />)}
      </div>
    </div>
  );
  return (
    <Modal title={`Préparation des données — ${items.filter((i) => i.ready).length}/${items.length} prêtes`} onClose={onClose} maxWidth={900}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {group("Pour calculer la consommation théorique", items.slice(0, 3))}
        {group("Pour comparer avec le stock", items.slice(3))}
      </div>
    </Modal>
  );
}

// ─── Comment le contrôle est calculé ─────────────────────────────────────────

function FBox({ title, sub, tone }: { title: string; sub: string; tone: string }) {
  return (
    <div style={{ border: `1px solid ${tone}40`, background: `${tone}0d`, borderRadius: 9, padding: "7px 10px", minWidth: 150, flex: "1 1 150px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: tone }}>{title}</div>
      <div style={{ fontSize: 11, color: FT.textMid }}>{sub}</div>
    </div>
  );
}

const op: CSSProperties = { fontSize: 18, fontWeight: 800, color: FT.textSub, padding: "0 2px" };

function HowItWorksModal({ onClose, ruleVersion }: { onClose: () => void; ruleVersion?: string }) {
  return (
    <Modal title="Comment le contrôle est-il calculé ?" onClose={onClose} maxWidth={860}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <FBox title="Heures de marche GE" sub="DSE en priorité, sinon sources de secours contrôlées" tone={FT.blue} />
          <span style={op} aria-label="multiplié par">×</span>
          <FBox title="CPH (L/h)" sub="courbe du GE (abaque) à la charge observée" tone={FT.violet} />
          <span style={op} aria-label="égal">=</span>
          <FBox title="Conso théorique (L)" sub="ce que le GE aurait dû consommer, jour par jour" tone={FT.cyan} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <FBox title="Conso stock (L)" sub="stock initial + livraisons ± mouvements − stock final" tone={FT.slate} />
          <span style={op} aria-label="moins">−</span>
          <FBox title="Conso théorique (L)" sub="calculée ci-dessus" tone={FT.cyan} />
          <span style={op} aria-label="égal">=</span>
          <FBox title="Écart (L)" sub="positif : plus de gasoil sorti du stock que prévu" tone={FT.orange} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 11.5, color: FT.textMid }}>
          Verdict : <StatutBadge statut="OK" /> écart ≤ max(100 L ; 10 %) · <StatutBadge statut="A_JUSTIFIER" /> ≤ max(200 L ; 20 %) · <StatutBadge statut="A_INVESTIGUER" /> au-delà.
        </div>
        <div style={{ fontSize: 11.5, color: FT.textMid }}>
          Une donnée absente reste « — » : elle n'est jamais remplacée par 0 ni estimée. La consommation théorique n'est affichée que si <strong>tous</strong> les jours de la période sont calculés.
          {ruleVersion && <> Règle {ruleVersion}.</>}
        </div>
      </div>
    </Modal>
  );
}

// ─── Blocages : pourquoi des sites n'ont pas de verdict ─────────────────────

const BLOCAGE_ACTIONS: Record<string, { label: string; target: "referentiel" | "abaque" | "observations" }> = {
  MAPPAGE_NON_VALIDE: { label: "Valider la correspondance", target: "referentiel" },
  MAPPAGE_AMBIGU: { label: "Choisir la courbe", target: "referentiel" },
  COURBE_CPH_MANQUANTE: { label: "Compléter l'abaque", target: "abaque" },
  OBSERVATION_ABSENTE: { label: "Importer les relevés", target: "observations" },
  OBSERVATION_INCOMPLETE: { label: "Corriger les relevés", target: "observations" },
};

function BlocagesModal({ s, active, onSelect, onAction, onClose, activeDiag, onDiag }: {
  s: CphSynthesis; active?: string; onSelect: (code: string) => void; activeDiag?: string; onDiag: (code: string) => void;
  onAction: (target: "referentiel" | "abaque" | "observations") => void; onClose: () => void;
}) {
  const list = s.blocages ?? [];
  const max = Math.max(1, ...list.map((b) => b.sites));
  const section = (etape: "cph" | "rapprochement", title: string) => {
    const items = list.filter((b) => b.etape === etape);
    if (items.length === 0) return null;
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".05em", margin: "10px 0 6px" }}>{title}</div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((b) => {
            const isActive = active === b.code;
            const action = BLOCAGE_ACTIONS[b.code];
            return (
              <li key={b.code} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => { onSelect(isActive ? "" : b.code); onClose(); }}
                  title="Afficher ces sites dans le tableau"
                  style={{ flex: "1 1 260px", minWidth: 0, textAlign: "left", cursor: "pointer", border: `1px solid ${isActive ? FT.blue : FT.border}`, background: isActive ? FT.blueL : FT.card, borderRadius: 8, padding: "7px 10px" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, fontWeight: 700, color: FT.text }}>
                    <span>{b.label}</span>
                    <span style={{ fontWeight: 800 }}>{b.sites.toLocaleString("fr-FR")} site{b.sites > 1 ? "s" : ""}</span>
                  </div>
                  <div aria-hidden style={{ height: 5, borderRadius: 3, background: FT.slateL, marginTop: 5, overflow: "hidden" }}>
                    <div style={{ width: `${(100 * b.sites) / max}%`, height: "100%", background: etape === "cph" ? FT.violet : FT.orange }} />
                  </div>
                </button>
                {action && (
                  <button type="button" onClick={() => { onClose(); onAction(action.target); }} style={{ ...btn, padding: "6px 10px", fontSize: 11.5 }}>
                    {action.label} <ChevronRight size={12} aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };
  return (
    <Modal title="Pourquoi des sites n'ont pas de verdict ?" onClose={onClose} maxWidth={960}>
      <div style={{ fontSize: 12.5, color: FT.textMid }}>
        Premier point bloquant de chaque site, dans l'ordre du calcul. Cliquez sur une ligne pour afficher ces sites dans le tableau.
      </div>
      {list.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12.5, color: FT.green }}>
          <CheckCircle2 size={16} aria-hidden /> {s.sites > 0 ? "Aucun blocage : tous les sites ont un verdict." : "Aucun site sur ce périmètre."}
        </div>
      ) : (
        <>
          {section("cph", "Calcul de la consommation théorique")}
          {section("rapprochement", "Comparaison avec le stock")}
        </>
      )}
      <div style={{ fontSize: 11, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".05em", margin: "16px 0 6px" }}>
        Synthèse détaillée des blocages (chaque méthode échouée compte)
      </div>
      <BlocageDiagnostic items={s.diagnostic_blocages} active={activeDiag} onSelect={(code) => { onDiag(code ?? ""); onClose(); }} />
    </Modal>
  );
}

// ─── Import du fichier d'observation ─────────────────────────────────────────

const OBSERVATION_COLUMNS = ["country", "site_id", "site_name", "observation_start", "observation_end", "opening_fuel_l", "closing_fuel_l", "fuel_deliveries_l", "fuel_transfer_in_l", "fuel_transfer_out_l", "fuel_theft_l", "fuel_drain_l", "observation_status", "comment", "justificatif"];

function downloadObservationTemplate() {
  downloadBlob(new Blob([`\ufeff${OBSERVATION_COLUMNS.join(";")}\r\n`], { type: "text/csv;charset=utf-8" }), "modele_observation_stock.csv");
}

const linkBtn: CSSProperties = { border: "none", background: "transparent", color: FT.blue, fontWeight: 800, textDecoration: "underline", cursor: "pointer", padding: 0, fontSize: "inherit" };

function ObservationImportModal({ onClose, onImported, onOpenAbaque }: { onClose: () => void; onImported: () => void; onOpenAbaque: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CphObservationImportResult | null>(null);
  const mut = useMutation({
    mutationFn: (f: File) => importCphObservations(f),
    onSuccess: (r) => { setResult(r); onImported(); },
  });
  const inputId = useId();
  const looksLikeAbaque = !!file && /abaque/i.test(file.name);
  const errorText = mut.isError ? apiError(mut.error) : null;
  return (
    <Modal title="Importer les observations stock (inventaires de cuve)" onClose={onClose} maxWidth={680}>
      <p style={{ fontSize: 12.5, color: FT.textMid, marginTop: 0 }}>
        Relevés de cuve par site et par période (stock initial / final, livraisons, transferts, vols, vidanges) servant au rapprochement.
        Une cellule vide reste vide (jamais 0) ; une valeur illisible rejette la ligne.
      </p>
      <div role="note" style={{ fontSize: 12, padding: "8px 11px", borderRadius: 8, background: FT.blueL, color: FT.navy, marginBottom: 12 }}>
        Vous voulez charger l'abaque <code>ABAQUE_CPH_GE_PRP_50HZ.xlsx</code> (courbes CPH) ?{" "}
        <button type="button" onClick={onOpenAbaque} style={linkBtn}>Utilisez « Importer l'abaque CPH »</button>.
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 5 }}>Colonnes attendues en 1<sup>re</sup> ligne (.xlsx ou .csv)</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {OBSERVATION_COLUMNS.map((c) => <code key={c} style={{ fontSize: 11, background: FT.slateL, border: `1px solid ${FT.border}`, borderRadius: 5, padding: "1px 5px" }}>{c}</code>)}
      </div>
      <button type="button" onClick={downloadObservationTemplate} style={{ ...btn, marginBottom: 14 }}><Download size={13} color={FT.blue} /> Télécharger le modèle (.csv)</button>
      <label htmlFor={inputId} style={{ display: "block", fontSize: 12, fontWeight: 800 }}>Fichier d'observation</label>
      <input id={inputId} type="file" accept=".xlsx,.csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); mut.reset(); }} style={{ display: "block", margin: "6px 0 10px" }} />
      {looksLikeAbaque && (
        <div role="alert" style={{ fontSize: 12.5, color: FT.orange, background: FT.orangeL, padding: "8px 11px", borderRadius: 8, marginBottom: 10 }}>
          « {file?.name} » ressemble à l'abaque CPH, pas à un fichier d'observation.{" "}
          <button type="button" onClick={onOpenAbaque} style={{ ...linkBtn, color: FT.orange }}>Importer ce fichier comme abaque</button>
        </div>
      )}
      <button type="button" disabled={!file || mut.isPending} onClick={() => file && mut.mutate(file)} style={{ ...btn, background: FT.navy, color: "#fff", opacity: !file || mut.isPending ? 0.5 : 1 }}>
        <FileUp size={13} /> {mut.isPending ? "Import…" : "Importer les observations"}
      </button>
      {errorText && (
        <div role="alert" style={{ color: FT.red, fontSize: 12.5, marginTop: 10 }}>
          {errorText}
          {/abaque/i.test(errorText) && <> <button type="button" onClick={onOpenAbaque} style={{ ...linkBtn, color: FT.red }}>Ouvrir l'import de l'abaque</button></>}
          {/modèle|Colonnes manquantes/i.test(errorText) && <> <button type="button" onClick={downloadObservationTemplate} style={{ ...linkBtn, color: FT.red }}>Télécharger le modèle</button></>}
        </div>
      )}
      {result && (
        <div role="status" style={{ marginTop: 12, fontSize: 12.5 }}>
          <strong>{result.rows_imported}</strong> ligne(s) importée(s), <strong>{result.rows_rejected}</strong> rejetée(s) sur {result.rows_total} — règle {result.rule_version}.
          {result.errors.length > 0 && (
            <ul style={{ fontSize: 11.5, color: FT.red, paddingLeft: 18 }}>
              {result.errors.map((e) => <li key={`${e.line}-${e.error}`}>Ligne {e.line} ({e.site_id ?? "site ?"}) : {e.error}</li>)}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Référentiel : courbes et mappages (validation métier) ──────────────────

function MappingRow({ m, canValidate, onChanged }: { m: CphReferentielMapping; canValidate: boolean; onChanged: () => void }) {
  const [curveId, setCurveId] = useState(m.validated_curve_id ?? m.candidates[0]?.curve_id ?? "");
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validate = useMutation({ mutationFn: () => validateCphMapping(m.id, curveId, comment), onSuccess: () => { setError(null); setEditing(false); setComment(""); onChanged(); }, onError: (e) => setError(apiError(e)) });
  const unvalidate = useMutation({ mutationFn: () => unvalidateCphMapping(m.id, comment), onSuccess: () => { setComment(""); onChanged(); }, onError: (e) => setError(apiError(e)) });
  const [showHistory, setShowHistory] = useState(false);
  const applied = m.candidates.find((c) => c.curve_id === m.validated_curve_id);
  const showForm = canValidate && m.candidates.length > 0 && (editing || !m.validated_curve_id);
  return (
    <tr>
      <td style={{ ...td, textAlign: "left" }}><strong>{m.inventory_label}</strong></td>
      <td style={td}>{nf(m.inventory_kva, 0) ?? "—"}</td>
      <td style={td}>{m.site_count ?? "—"}</td>
      <td style={{ ...td, textAlign: "left", whiteSpace: "normal", minWidth: 250 }}>
        <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
          <MatchBadge statut={m.match_status} />
          {m.match_score !== null && m.match_score !== undefined && <span style={{ fontSize: 10.5, color: FT.textSub }}>score {m.match_score} %</span>}
        </span>
        <div style={{ fontSize: 10.5, color: FT.textSub, marginTop: 2 }}>
          {m.match_method || "—"}{m.matched_at ? ` · ${new Date(m.matched_at).toLocaleDateString("fr-FR")}` : ""}{m.validated_by ? ` · ${m.validated_by}` : ""}
        </div>
        {(m.match_reasons ?? []).length > 0 && (
          <ul style={{ margin: "3px 0 0", paddingLeft: 16, fontSize: 11, color: FT.textMid }}>
            {(m.match_reasons ?? []).slice(0, 4).map((r) => <li key={r}>{r}</li>)}
          </ul>
        )}
        {(m.history ?? []).length > 0 && (
          <div style={{ marginTop: 4 }}>
            <button type="button" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)} style={{ border: "none", background: "transparent", color: FT.blue, fontSize: 11, fontWeight: 800, cursor: "pointer", padding: 0 }}>
              {showHistory ? "Masquer l'historique" : `Historique (${m.history!.length})`}
            </button>
            {showHistory && (
              <ol style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 10.5, color: FT.textMid }}>
                {m.history!.map((h, i) => (
                  <li key={`${h.changed_at}-${i}`} style={{ marginBottom: 3 }}>
                    <strong>{new Date(h.changed_at).toLocaleString("fr-FR")}</strong> · {h.old_status || "∅"} → {h.new_status}
                    {(h.old_curve_id || h.new_curve_id) && ` · courbe ${h.old_curve_id || "∅"} → ${h.new_curve_id || "∅"}`}
                    {h.score !== null && ` · score ${h.score} %`} · {h.changed_by ?? "automatique"}
                    <div style={{ color: FT.textSub }}>{h.rule}{h.comment ? ` — ${h.comment}` : ""}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </td>
      <td style={{ ...td, textAlign: "left", whiteSpace: "normal", minWidth: 220 }}>
        {m.candidates.length === 0 ? <span style={{ fontSize: 11.5, color: FT.textSub }}>Aucune courbe dans l'abaque</span> : m.candidates.map((c) => (
          <div key={c.curve_id} style={{ fontSize: 11.5, marginBottom: 2 }}>
            <strong style={{ fontWeight: c.curve_id === m.validated_curve_id ? 800 : 500 }}>{c.curve_id}</strong> {c.manufacturer} {c.model} ({nf(c.prp_kva, 0)} kVA / {nf(c.prp_kw, 1)} kW){" "}
            <CurveStatusBadge status={c.status} />
          </div>
        ))}
      </td>
      <td style={{ ...td, textAlign: "left", whiteSpace: "normal", minWidth: 260 }}>
        {applied && !editing && (
          <div style={{ fontSize: 11.5 }}>
            Courbe appliquée : <strong>{applied.curve_id}</strong> <CurveStatusBadge status={applied.status} />
            {m.validation_comment && <div style={{ color: FT.textSub }}>{m.validation_comment}</div>}
            {canValidate && (
              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setEditing(true)} style={{ ...btn, padding: "3px 8px" }}>Corriger</button>
                <button type="button" onClick={() => unvalidate.mutate()} style={{ ...btn, padding: "3px 8px", color: FT.red }} title="Statut REJETE : l'automatique ne le réactivera plus ; une validation manuelle reste possible">Rejeter</button>
              </div>
            )}
          </div>
        )}
        {showForm && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <select aria-label={`Courbe pour ${m.inventory_label}`} value={curveId} onChange={(e) => setCurveId(e.target.value)} style={{ ...control, padding: "4px 8px" }}>
              {m.candidates.map((c) => <option key={c.curve_id} value={c.curve_id}>{c.curve_id} — {c.manufacturer} {c.model} ({curveSourceCode(c.status)})</option>)}
            </select>
            <input aria-label={`Commentaire de validation pour ${m.inventory_label}`} placeholder="Référence plaque signalétique…" value={comment} onChange={(e) => setComment(e.target.value)} style={{ ...control, padding: "4px 8px" }} />
            <span style={{ display: "flex", gap: 4 }}>
              <button type="button" disabled={!comment.trim() || validate.isPending} onClick={() => validate.mutate()} style={{ ...btn, padding: "4px 8px", opacity: !comment.trim() ? 0.5 : 1 }}>Valider manuellement</button>
              {editing && <button type="button" onClick={() => setEditing(false)} style={{ ...btn, padding: "4px 8px" }}>Annuler</button>}
            </span>
          </div>
        )}
        {!applied && !showForm && <span style={{ fontSize: 11.5, color: FT.textSub }}>{m.candidates.length === 0 ? "Compléter l'abaque" : "Validation réservée admin / manager"}</span>}
        {error && <div role="alert" style={{ color: FT.red, fontSize: 11.5 }}>{error}</div>}
      </td>
    </tr>
  );
}

function AbaqueImport({ onImported }: { onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CphAbaqueImportResult | null>(null);
  const inputId = useId();
  const mut = useMutation({
    mutationFn: (f: File) => importCphAbaque(f),
    onSuccess: (r) => { setResult(r); onImported(); },
  });
  return (
    <div style={{ border: `1px solid ${FT.border}`, borderRadius: 9, padding: 12 }}>
      <label htmlFor={inputId} style={{ fontSize: 12.5, fontWeight: 800 }}>Importer / mettre à jour l'abaque (ABAQUE_CPH_GE_PRP_50HZ.xlsx)</label>
      <div style={{ fontSize: 11.5, color: FT.textSub, margin: "3px 0 8px" }}>
        Feuilles « Abaque CPH » et « Mappage inventaire ». Après l'import, les correspondances fiables sont activées automatiquement (AUTO_VALIDE_COMPATIBLE) ; les corrections manuelles déjà saisies sont conservées.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input id={inputId} type="file" accept=".xlsx,.xlsm" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
        <button type="button" disabled={!file || mut.isPending} onClick={() => file && mut.mutate(file)} style={{ ...btn, background: FT.navy, color: "#fff", opacity: !file || mut.isPending ? 0.5 : 1 }}>
          <FileUp size={13} /> {mut.isPending ? "Import…" : "Importer l'abaque"}
        </button>
      </div>
      {mut.isError && <div role="alert" style={{ color: FT.red, fontSize: 12, marginTop: 8 }}>{apiError(mut.error)}</div>}
      {result && (
        <div role="status" style={{ fontSize: 12, marginTop: 8 }}>
          {result.curves} courbes ({Object.entries(result.status_counts).map(([k, v]) => `${k} : ${v}`).join(", ")}) et {result.mappings} mappages importés depuis {result.file_name}.
          {result.warnings.length > 0 && <div style={{ color: FT.orange }}>Avertissements : {result.warnings.join(" · ")}</div>}
          {result.validations_reset.length > 0 && <div style={{ color: FT.orange }}>Validations annulées (courbe plus candidate) : {result.validations_reset.join(", ")}</div>}
        </div>
      )}
    </div>
  );
}

function AbaqueImportModal({ onClose, canValidate, onOpenReferentiel }: { onClose: () => void; canValidate: boolean; onOpenReferentiel: () => void }) {
  const qc = useQueryClient();
  const [done, setDone] = useState(false);
  const refresh = () => { setDone(true); qc.invalidateQueries({ queryKey: ["cph-referentiel"] }); qc.invalidateQueries({ queryKey: ["cph-period"] }); };
  return (
    <Modal title="Importer l'abaque CPH (courbes PRP 50 Hz)" onClose={onClose} maxWidth={640}>
      <p style={{ fontSize: 12.5, color: FT.textMid, marginTop: 0 }}>
        Fichier de référence des courbes de consommation des GE (<code>ABAQUE_CPH_GE_PRP_50HZ.xlsx</code>). Après l'import, les correspondances
        fiables sont activées automatiquement ; les exceptions (à valider, ambiguës, sans courbe) se traitent dans le référentiel.
      </p>
      {canValidate ? <AbaqueImport onImported={refresh} /> : (
        <div role="note" style={{ fontSize: 12.5, color: FT.orange, background: FT.orangeL, padding: "8px 11px", borderRadius: 8 }}>
          Import réservé aux rôles admin et manager : demandez-leur de charger l'abaque.
        </div>
      )}
      {done && (
        <button type="button" onClick={onOpenReferentiel} style={{ ...btn, marginTop: 12 }}>
          <BookOpen size={13} color={FT.blue} /> Étape suivante : voir les correspondances et les exceptions
        </button>
      )}
    </Modal>
  );
}

function ReferentielModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cph-referentiel"], queryFn: getCphReferentiel });
  const [filter, setFilter] = useState("");
  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [approveComment, setApproveComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["cph-referentiel"] }); qc.invalidateQueries({ queryKey: ["cph-period"] }); };
  const rerun = useMutation({ mutationFn: () => autoMatchCphMappings(false), onSuccess: () => { setError(null); refresh(); }, onError: (e) => setError(apiError(e)) });
  const approve = useMutation({ mutationFn: () => approveCphCurve(approveTarget!, approveComment), onSuccess: () => { setApproveTarget(null); setApproveComment(""); setError(null); refresh(); }, onError: (e) => setError(apiError(e)) });
  const revoke = useMutation({ mutationFn: (id: string) => revokeCphCurve(id), onSuccess: refresh, onError: (e) => setError(apiError(e)) });
  const data = q.data;
  const mappings = (data?.mappings ?? []).filter((m) => (!filter || m.inventory_label.toLowerCase().includes(filter.toLowerCase())) && (!statusFilter || m.match_status === statusFilter));
  const byStatus = (data?.mappings ?? []).reduce<Record<string, number>>((acc, m) => { const k = m.match_status ?? "A_VALIDER"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
  const nonConstructor = (data?.curves ?? []).filter((c) => c.status !== "VALIDÉ_CONSTRUCTEUR" && (!filter || `${c.curve_id} ${c.manufacturer} ${c.model}`.toLowerCase().includes(filter.toLowerCase())));
  return (
    <Modal title="Référentiel courbes CPH PRP 50 Hz — correspondances plaque → courbe" onClose={onClose} maxWidth={1180}>
      {q.isLoading && <Skeleton h={300} />}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 12.5, color: FT.textMid }}>
            Les correspondances fiables sont activées automatiquement (<strong>AUTO_VALIDE_COMPATIBLE</strong> : candidat unique, score ≥ 70 %, sans contradiction de modèle, marque, puissance ou fréquence).
            Les exceptions restent à traiter ici ; une correction manuelle (<strong>VALIDE_MANUELLEMENT</strong>) prime toujours sur l'automatique.
            Le statut d'origine de la courbe (VALIDE_CONSTRUCTEUR, HISTORIQUE_A_VALIDER, ARCHIVE, DISTRIBUTEUR) est affiché à part et n'est jamais modifié par un mapping.
            Tolérance puissance : 15 % entre le kVA inventaire et le kVA de la courbe (configurable). Rejet : statut REJETE, jamais réactivé automatiquement ; chaque changement est historisé.
            {!data.can_validate && " Import de l'abaque et corrections réservés aux rôles admin et manager."}
          </div>
          {data.can_validate && <AbaqueImport onImported={refresh} />}
          {data.curves.length === 0 && (
            <div role="note" style={{ color: FT.red, fontSize: 12.5 }}>
              Aucune courbe en base : l'abaque n'a pas encore été importé{data.can_validate ? " — utilisez l'import ci-dessus." : " — demandez à un admin ou manager de l'importer."}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, ...control, maxWidth: 320, flex: "1 1 220px" }}>
              <Search size={14} color={FT.textSub} aria-hidden />
              <input aria-label="Filtrer le référentiel" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Libellé, modèle ou ID courbe…" style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 12.5, minWidth: 0 }} />
            </div>
            <select aria-label="Statut de correspondance" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...control, cursor: "pointer" }}>
              <option value="">Correspondance : toutes ({data.mappings.length})</option>
              {Object.entries(byStatus).map(([k, n]) => <option key={k} value={k}>{k} ({n})</option>)}
            </select>
            {data.can_validate && (
              <button type="button" onClick={() => rerun.mutate()} disabled={rerun.isPending} style={btn} title="Réévalue les mappages non traités par un humain">
                {rerun.isPending ? "Correspondance en cours…" : "Relancer la correspondance automatique"}
              </button>
            )}
          </div>
          {error && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>{error}</div>}
          <div style={{ overflow: "auto", maxHeight: 380, border: `1px solid ${FT.border}`, borderRadius: 9 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1000 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ ...th, textAlign: "left" }}>Libellé inventaire</th><th scope="col" style={th}>kVA</th><th scope="col" style={th}>Sites</th>
                  <th scope="col" style={{ ...th, textAlign: "left" }}>Correspondance (score, méthode, motifs)</th><th scope="col" style={{ ...th, textAlign: "left" }}>Courbes candidates (qualité)</th><th scope="col" style={{ ...th, textAlign: "left" }}>Courbe appliquée / correction</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => <MappingRow key={m.id} m={m} canValidate={data.can_validate} onChanged={refresh} />)}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 12.5, marginBottom: 6 }}>Courbes non constructeur ({nonConstructor.length}) — vérification métier (information de qualité, sans effet sur le calcul)</div>
            <div style={{ overflow: "auto", maxHeight: 260, border: `1px solid ${FT.border}`, borderRadius: 9 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
                <thead>
                  <tr>
                    <th scope="col" style={th}>ID</th><th scope="col" style={{ ...th, textAlign: "left" }}>Modèle</th><th scope="col" style={th}>PRP</th>
                    <th scope="col" style={th}>50 / 75 / 100 % (L/h)</th><th scope="col" style={th}>Statut</th><th scope="col" style={{ ...th, textAlign: "left" }}>Vérification</th>
                  </tr>
                </thead>
                <tbody>
                  {nonConstructor.map((c) => (
                    <tr key={c.curve_id}>
                      <td style={td}>{c.curve_id}</td>
                      <td style={{ ...td, textAlign: "left" }}>{c.manufacturer} {c.model} {c.variant}</td>
                      <td style={td}>{nf(c.prp_kva, 0)} kVA / {nf(c.prp_kw, 1)} kW · cos φ {nf(c.power_factor, 2) ?? "—"}</td>
                      <td style={td}>{nf(c.conso_50_l_h, 1)} / {nf(c.conso_75_l_h, 1)} / {nf(c.conso_100_l_h, 1)}</td>
                      <td style={td}><CurveStatusBadge status={c.status} /></td>
                      <td style={{ ...td, textAlign: "left" }}>
                        {c.business_approved ? (
                          <span style={{ fontSize: 11.5 }}>
                            <Tag tone={FT.green}>Vérifiée</Tag> par {c.business_approved_by ?? "—"}
                            {data.can_validate && <button type="button" onClick={() => revoke.mutate(c.curve_id)} style={{ ...btn, padding: "3px 8px", marginLeft: 6 }}>Retirer</button>}
                          </span>
                        ) : data.can_validate ? (
                          approveTarget === c.curve_id ? (
                            <span style={{ display: "inline-flex", gap: 4 }}>
                              <input aria-label={`Justification de vérification ${c.curve_id}`} autoFocus value={approveComment} onChange={(e) => setApproveComment(e.target.value)} placeholder="Justification métier…" style={{ ...control, padding: "3px 8px" }} />
                              <button type="button" disabled={!approveComment.trim()} onClick={() => approve.mutate()} style={{ ...btn, padding: "3px 8px" }}>Confirmer</button>
                              <button type="button" onClick={() => setApproveTarget(null)} style={{ ...btn, padding: "3px 8px" }}>Annuler</button>
                            </span>
                          ) : (
                            <button type="button" onClick={() => { setApproveTarget(c.curve_id); setApproveComment(""); }} style={{ ...btn, padding: "3px 8px" }}>Marquer vérifiée…</button>
                          )
                        ) : "Non vérifiée"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Tableaux ────────────────────────────────────────────────────────────────

function SimpleTable({ rows, onDetail }: { rows: CphSiteRow[]; onDetail: (siteId: string) => void }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1280 }}>
      <caption className="sr-only">Contrôle CPH par site : résultat, consommation théorique et comparaison au stock</caption>
      <thead>
        <tr>
          <th scope="col" style={{ ...th, textAlign: "left" }}>Site</th>
          <th scope="col" style={{ ...th, textAlign: "left" }}>Résultat</th>
          <th scope="col" style={{ ...th, textAlign: "left" }}>Correspondance / courbe<HelpTip label="correspondance" text={HELP.courbe} /></th>
          <th scope="col" style={th}>Heures GE<HelpTip label="heures de marche" text={HELP.runtime} /></th>
          <th scope="col" style={th}>CPH (L/h)<HelpTip label="CPH" text={HELP.cph} /></th>
          <th scope="col" style={th}>Conso théorique (L)<HelpTip label="consommation théorique" text={HELP.conso} /></th>
          <th scope="col" style={th}>Conso stock (L)<HelpTip label="consommation stock" text={HELP.consoStock} /></th>
          <th scope="col" style={th}>Écart<HelpTip label="écart" text={HELP.ecart} /></th>
          <th scope="col" style={th}><span className="sr-only">Détail</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const rec = r.rapprochement;
          return (
            <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
              <td style={{ ...td, textAlign: "left" }}>
                <div style={{ fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.site_id}</div>
                <div style={{ fontSize: 11, color: FT.textSub }}>{r.site_name ?? "—"} · {r.kind === "INDOOR" ? "Indoor" : r.kind === "OUTDOOR" ? "Outdoor" : "type ?"} · {r.ge_label ?? "GE inconnu"}</div>
              </td>
              <td style={{ ...td, textAlign: "left", whiteSpace: "normal", minWidth: 240, maxWidth: 340 }}>
                <StatutBadge statut={r.rapprochement_statut} />
                {r.blocage && (
                  <div style={{ fontSize: 11.5, color: r.blocage.etape === "cph" ? FT.violet : FT.orange, marginTop: 3, fontWeight: 700 }} title={r.blocage.detail ?? undefined}>
                    {r.blocage.label}
                  </div>
                )}
              </td>
              <td style={{ ...td, textAlign: "left" }}><CorrespondanceCell c={r.correspondance} fallbackCurveId={r.curve?.curve_id} /></td>
              <td style={td}>
                <Num value={r.runtime_total_h} digits={1} reason="Aucune source d'heures de marche fiable sur la période." />
                <div style={{ fontSize: 11, color: FT.textSub }}>{r.runtime_days}/{r.days} j{r.runtime_source_main ? ` · ${RUNTIME_SOURCE_LABELS[r.runtime_source_main]}` : ""}</div>
              </td>
              <td style={td}>
                <Num value={r.cph_moy_l_h} digits={2} reason={r.motif_cph ? `${r.motif_cph.code}${r.motif_cph.detail ? ` — ${r.motif_cph.detail}` : ""}` : null} />
                {r.cph_moy_l_h === null && r.motif_cph && <div style={{ fontSize: 10.5, color: FT.violet, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.motif_cph.code}</div>}
                <div style={{ fontSize: 11, color: FT.textSub }}>{r.charge_moy_pct !== null && r.charge_moy_pct !== undefined ? `charge ${nf(r.charge_moy_pct, 0)} %` : "—"}</div>
              </td>
              <td style={td}>
                {r.conso_theorique_l !== null ? <Num value={r.conso_theorique_l} digits={0} /> : r.conso_partielle_l !== null ? (
                  <span title="Somme partielle : certains jours ne sont pas calculés">
                    <span style={{ color: FT.textSub }}>—</span>
                    <div style={{ fontSize: 11, color: FT.orange }}>partiel {nf(r.conso_partielle_l, 0)} L ({r.conso_days}/{r.days} j)</div>
                  </span>
                ) : <Num value={null} reason="Aucun jour calculé." />}
              </td>
              <td style={td}><Num value={rec?.conso_stock_l} digits={0} reason={rec ? "Non calculée : voir le résultat." : "Aucun relevé de stock sur la période."} /></td>
              <td style={td}>
                <Num value={rec?.ecart_l} digits={0} suffix=" L" reason="Pas de comparaison possible (voir le résultat)." />
                {rec?.ecart_pct !== null && rec?.ecart_pct !== undefined && <div style={{ fontSize: 11, color: FT.textSub }}>{nf(rec.ecart_pct, 1, " %")}</div>}
              </td>
              <td style={td}>
                <button type="button" onClick={() => onDetail(r.site_id)} aria-label={`Voir le détail de ${r.site_id}`} style={{ ...btn, padding: "5px 9px", fontSize: 11.5 }}>
                  Détail <ChevronRight size={12} aria-hidden />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LegacyTable({ rows, onDetail }: { rows: CphSiteRow[]; onDetail: (siteId: string) => void }) {
  const setDetailSite = onDetail;
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 2050 }}>
      <thead>
        <tr>
          <th scope="col" style={{ ...th, textAlign: "left" }}>Site</th>
          <th scope="col" style={th}>Dates</th>
          <th scope="col" style={th}>Runtime (h)<HelpTip label="runtime" text={HELP.runtime} /></th>
          <th scope="col" style={th}>Source runtime<HelpTip label="disponibilité" text={HELP.disponibilite} /></th>
          <th scope="col" style={th}>Puissance (kW)<HelpTip label="puissance" text={HELP.puissance} /></th>
          <th scope="col" style={th}>Courbe<HelpTip label="courbe" text={HELP.courbe} /></th>
          <th scope="col" style={th}>CPH (L/h)<HelpTip label="CPH" text={HELP.cph} /></th>
          <th scope="col" style={th}>Conso théorique (L)<HelpTip label="consommation théorique" text={HELP.conso} /></th>
          <th scope="col" style={th}>Stock initial (L)<HelpTip label="stocks" text={HELP.stock} /></th>
          <th scope="col" style={th}>Livraisons (L)<HelpTip label="livraisons" text={HELP.livraisons} /></th>
          <th scope="col" style={th}>Rajouts / retraits / vols / vidanges (L)</th>
          <th scope="col" style={th}>Stock final (L)</th>
          <th scope="col" style={th}>Conso stock (L)<HelpTip label="consommation stock" text={HELP.consoStock} /></th>
          <th scope="col" style={th}>Écart (L / %)<HelpTip label="écart" text={HELP.ecart} /></th>
          <th scope="col" style={th}>Statut<HelpTip label="statut" text={HELP.statut} /></th>
          <th scope="col" style={{ ...th, textAlign: "left" }}>Motifs</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r: CphSiteRow, i) => {
          const rec = r.rapprochement;
          const motifs = [r.data_issue, ...(r.curve ? [] : [r.curve_reason]), ...r.motifs, ...(rec?.motifs ?? []), ...(!rec ? ["Aucune observation de stock sur la période"] : [])].filter(Boolean) as string[];
          const moves = rec ? [rec.rajouts_l, rec.retraits_l, rec.vols_l, rec.vidanges_l].map((v) => nf(v, 0) ?? "—").join(" / ") : null;
          return (
            <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
              <td style={{ ...td, textAlign: "left" }}>
                <button type="button" onClick={() => setDetailSite(r.site_id)} aria-label={`Détail jour par jour de ${r.site_id}`} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", color: FT.blue, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace", textDecoration: "underline" }}>
                  {r.site_id}
                </button>
                <div style={{ fontSize: 11, color: FT.textSub }}>{r.site_name ?? "—"} · {r.kind ?? "type ?"} · {r.zone ?? "zone ?"}</div>
              </td>
              <td style={td}>{fmtDate(r.start)} → {fmtDate(r.end)}<div style={{ fontSize: 11, color: FT.textSub }}>{r.days} j</div></td>
              <td style={td}>
                <Num value={r.runtime_total_h} digits={1} reason="Aucune source de runtime ne passe les contrôles sur la période." />
                <div style={{ fontSize: 11, color: FT.textSub }}>{r.runtime_days}/{r.days} j</div>
              </td>
              <td style={td} title={Object.entries(r.sources).map(([k, v]) => `${RUNTIME_SOURCE_LABELS[k]} : ${v.availability_pct} %${v.rejection ? ` — ${v.rejection}` : ""}`).join("\n")}>
                {r.runtime_source_main ? RUNTIME_SOURCE_LABELS[r.runtime_source_main] : "—"}
                <div style={{ fontSize: 11, color: FT.textSub }}>
                  {(["DSE", "REDRESSEUR", "DAY_DG_ON", "COMPTEUR_TERRAIN"] as const).map((k) => `${k === "COMPTEUR_TERRAIN" ? "Cpt" : k === "DAY_DG_ON" ? "DGOn" : k === "REDRESSEUR" ? "Red" : "DSE"} ${r.sources[k]?.availability_pct ?? 0}%`).join(" · ")}
                </div>
              </td>
              <td style={td}>
                <Num value={r.p_ge_moy_kw} digits={2} reason="Aucun jour avec puissance GE qualifiée et CPH calculé." />
                <div style={{ fontSize: 11, color: FT.textSub }}>{r.power_source_main ? POWER_SOURCE_LABELS[r.power_source_main] : "—"}</div>
              </td>
              <td style={td} title={r.curve ? `${r.curve.label} · a=${r.curve.a} b=${r.curve.b} c=${r.curve.c}` : r.curve_reason ?? undefined}>
                <CorrespondanceCell c={r.correspondance} fallbackCurveId={r.curve?.curve_id} />
                <div style={{ fontSize: 11, color: FT.textSub }}>{r.ge_label ?? "GE inconnu"}</div>
              </td>
              <td style={td}>
                <Num value={r.cph_moy_l_h} digits={2} reason="Aucun jour avec runtime, puissance et courbe validée." />
                {r.extrapolated_days > 0 && <div><Tag tone={FT.orange}>{r.extrapolated_days} j &lt; 50 %</Tag></div>}
              </td>
              <td style={td}>
                {r.conso_theorique_l !== null ? (
                  <Num value={r.conso_theorique_l} digits={1} />
                ) : r.conso_partielle_l !== null ? (
                  <span title="Somme partielle : certains jours n'ont pas de consommation calculée">
                    <span style={{ color: FT.textSub }}>—</span>
                    <div style={{ fontSize: 11, color: FT.orange }}>partiel {nf(r.conso_partielle_l, 1)} L ({r.conso_days}/{r.days} j)</div>
                  </span>
                ) : (
                  <Num value={null} reason="Aucun jour calculé." />
                )}
                <div style={{ fontSize: 11, color: FT.textSub }}>{CPH_STATUS_LABELS[r.cph_status]}</div>
              </td>
              <td style={td}><Num value={rec?.stock_initial_l} digits={0} reason={rec ? "Absent du fichier d'observation." : "Aucune observation."} /></td>
              <td style={td}>
                <Num value={rec?.livraisons_l} digits={0} reason={rec ? "Absent du fichier d'observation." : "Aucune observation."} />
                {rec?.livraisons_statut === "LIVRAISONS_ENOC_A_CONTROLER" && <div><Tag tone={FT.orange}>à contrôler</Tag></div>}
              </td>
              <td style={td}>{moves ?? <Num value={null} reason="Aucune observation." />}</td>
              <td style={td}><Num value={rec?.stock_final_l} digits={0} reason={rec ? "Absent du fichier d'observation." : "Aucune observation."} /></td>
              <td style={td}><Num value={rec?.conso_stock_l} digits={0} reason="Rapprochement non effectué (voir motifs)." /></td>
              <td style={td}>
                <Num value={rec?.ecart_l} digits={0} reason="Rapprochement non effectué (voir motifs)." />
                <div style={{ fontSize: 11 }}><Num value={rec?.ecart_pct} digits={1} suffix=" %" /></div>
              </td>
              <td style={td}><StatutBadge statut={r.rapprochement_statut} /></td>
              <td style={{ ...td, textAlign: "left", whiteSpace: "normal", minWidth: 280, maxWidth: 420, fontSize: 11.5, color: FT.textMid }}>
                {motifs.length === 0 ? "—" : motifs.slice(0, 3).join(" · ")}
                {motifs.length > 3 && (
                  <button type="button" onClick={() => setDetailSite(r.site_id)} style={{ border: "none", background: "transparent", color: FT.blue, cursor: "pointer", fontSize: 11, fontWeight: 800, padding: 0, marginLeft: 4 }}>
                    +{motifs.length - 3}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Écran principal ─────────────────────────────────────────────────────────

function periodPresets() {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const back = (n: number) => { const d = new Date(y); d.setDate(d.getDate() - n); return isoDate(d); };
  return [
    { label: "Mois en cours", start: isoDate(new Date(y.getFullYear(), y.getMonth(), 1)), end: isoDate(y) },
    { label: "Mois précédent", start: isoDate(new Date(y.getFullYear(), y.getMonth() - 1, 1)), end: isoDate(new Date(y.getFullYear(), y.getMonth(), 0)) },
    { label: "7 derniers jours", start: back(6), end: isoDate(y) },
    { label: "30 derniers jours", start: back(29), end: isoDate(y) },
  ];
}

const pill: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.card, color: FT.text,
  cursor: "pointer", fontSize: 12.5, fontWeight: 800, borderRadius: 10, padding: "9px 14px", boxShadow: FT.shadow,
};

function VerdictButtons({ value, onChange, s }: { value: string; onChange: (v: string) => void; s: CphSynthesis | undefined }) {
  const n = (v: number | undefined) => (v === undefined ? "" : ` (${v.toLocaleString("fr-FR")})`);
  const options: Array<{ key: string; label: string }> = [
    { key: "", label: `Tous${n(s?.sites)}` },
    { key: "OK", label: `OK${n(s?.ok)}` },
    { key: "A_JUSTIFIER", label: `À justifier${n(s?.a_justifier)}` },
    { key: "A_INVESTIGUER", label: `À investiguer${n(s?.a_investiguer)}` },
    { key: "DONNEES_INCOMPLETES", label: `Données incomplètes${n(s?.donnees_incompletes)}` },
    { key: "CPH_NON_CALCULE", label: `CPH non calculé${n(s?.rapprochement_cph_non_calcule)}` },
  ];
  return (
    <div role="group" aria-label="Verdict du rapprochement" style={{ display: "inline-flex", flexWrap: "wrap", gap: 3, padding: 4, borderRadius: 10, background: FT.slateL, border: `1px solid ${FT.border}` }}>
      {options.map((opt) => {
        const active = opt.key === value;
        const dot = opt.key ? STATUT_COLORS[opt.key as CphReconciliationStatus] : null;
        return (
          <button
            key={opt.key || "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 7, border: "none",
              background: active ? "#fff" : "transparent", color: active ? FT.navy : FT.textMid,
              boxShadow: active ? FT.shadow : "none", fontSize: 11.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {dot && <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: dot }} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function CphKpis({ s, meta, onPreparation, handlers }: { s: CphSynthesis | undefined; meta: CphMeta | undefined; onPreparation: () => void; handlers: PrepHandlers }) {
  if (!s || !meta) return <Skeleton h={150} />;
  const pct = (v: number) => (s.sites > 0 ? `${Math.round((100 * v) / s.sites)} %` : "—");
  const sansVerdict = s.donnees_incompletes + s.rapprochement_cph_non_calcule;
  const items = prepItems(meta, handlers);
  const warnStyle: CSSProperties = { marginBottom: 10, padding: "8px 12px", borderRadius: 6, background: "#fffbe6", border: "1px solid #ffe58f", color: "#ad6800", fontSize: 12 };
  const warnLink: CSSProperties = { ...linkBtn, color: "#ad6800" };
  return (
    <div style={{ background: FT.card, borderRadius: FT.radius, border: `1px solid ${FT.border}`, boxShadow: FT.shadow, padding: 14 }}>
      {meta.curves_total === 0 ? (
        <div role="note" style={warnStyle}>⚠ Abaque CPH non importé — aucun CPH ne peut être calculé. <button type="button" onClick={handlers.onAbaque} style={warnLink}>Importer l'abaque</button></div>
      ) : meta.mappings_validated === 0 ? (
        <div role="note" style={warnStyle}>⚠ Aucune correspondance plaque → courbe active — aucun CPH ne peut être calculé. <button type="button" onClick={handlers.onReferentiel} style={warnLink}>Ouvrir le référentiel</button></div>
      ) : null}
      <FreshnessWarning meta={meta} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        <KpiCard label="Sites avec GE" value={s.sites.toLocaleString("fr-FR")} sub="inventaire Snowflake (DG_COUNT > 0)" tone="blue" icon={<Fuel size={14} />} />
        <KpiCard label="CPH calculé" value={s.cph_calcules.toLocaleString("fr-FR")} sub={`${pct(s.cph_calcules)} des sites · ${s.conso_theorique_complete.toLocaleString("fr-FR")} complets sur la période`} tone="violet" icon={<Gauge size={14} />} />
        <KpiCard label="Comparés au stock" value={s.rapprochements_calcules.toLocaleString("fr-FR")} sub={`${s.ok} OK · ${s.a_justifier} à justifier · ${s.a_investiguer} à investiguer`} tone="green" icon={<Scale size={14} />} />
        <KpiCard label="Sans verdict" value={sansVerdict.toLocaleString("fr-FR")} sub={`${s.donnees_incompletes} données incomplètes · ${s.rapprochement_cph_non_calcule} CPH non calculé`} tone="slate" icon={<HelpCircle size={14} />} />
      </div>
      {s.couvertures && <div style={{ marginTop: 12 }}><CoverageKpis items={s.couvertures} /></div>}
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 11.5, color: FT.textSub }}>
        <span>Préparation :</span>
        {items.map((i) => (
          <button key={i.key} type="button" onClick={onPreparation} title={`${i.title} — ouvrir la préparation des données`}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${FT.border}`, background: FT.cardAlt, borderRadius: 999, padding: "3px 9px", fontSize: 11.5, fontWeight: 700, color: FT.textMid, cursor: "pointer" }}>
            <PrepIcon item={i} size={12} /> {i.short}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ControleCphSheet() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState(defaultPeriod);
  const [filters, setFilters] = useState<Omit<CphFilters, "start" | "end">>({});
  const [siteInput, setSiteInput] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [detailSite, setDetailSite] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "import" | "referentiel" | "abaque" | "preparation" | "blocages" | "how">(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [detailedView, setDetailedView] = useState(false);
  const [exporting, setExporting] = useState<null | "controle" | "anomalies">(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const nbDays = daysBetween(period.start, period.end);
  const periodError = !period.start || !period.end ? "Dates requises." : nbDays < 1 ? "La date de fin précède la date de début." : nbDays > 92 ? "Période limitée à 92 jours." : null;
  const params: CphFilters = { ...period, ...filters, site: siteInput.trim() || undefined };
  const presets = useMemo(periodPresets, []);

  const q = useQuery({
    queryKey: ["cph-period", params, page, limit],
    queryFn: () => getCphPeriod({ ...params, page, limit }),
    enabled: !periodError,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
    setPage(1);
  };
  const choosePeriod = (start: string, end: string) => { setPeriod({ start, end }); setPage(1); };

  async function handleExport(kind: "controle" | "anomalies") {
    setExporting(kind);
    setExportError(null);
    try {
      const blob = await exportCph(kind, params);
      downloadBlob(blob, `${kind === "controle" ? "controle_complet_cph" : "anomalies_fuel"}_${period.start}_${period.end}.csv`);
    } catch (e) {
      setExportError(apiError(e));
    } finally {
      setExporting(null);
    }
  }

  const handlers: PrepHandlers = {
    onAbaque: () => setModal("abaque"),
    onReferentiel: () => setModal("referentiel"),
    onObservations: () => setModal("import"),
  };

  const data = q.data;
  const s = data?.synthesis;
  const meta = data?.meta;
  const rows = data?.data ?? [];
  const sortedRuntimeSources = useMemo(() => data?.filters.runtime_sources ?? [], [data?.filters.runtime_sources]);
  const advancedCount = [filters.country, filters.zone, filters.runtime_source, filters.power_source, filters.cph_status].filter(Boolean).length;
  const presetActive = presets.find((p) => p.start === period.start && p.end === period.end)?.label ?? "";
  const blocages = s?.blocages ?? [];
  const sansVerdict = s ? s.donnees_incompletes + s.rapprochement_cph_non_calcule : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <CphKpis s={s} meta={meta} onPreparation={() => setModal("preparation")} handlers={handlers} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setModal("blocages")} disabled={!s} style={pill}>
          <HelpCircle size={14} color={FT.blue} aria-hidden /> Pourquoi des sites sans verdict ?{sansVerdict !== undefined ? ` (${sansVerdict.toLocaleString("fr-FR")})` : ""}
        </button>
        <button type="button" onClick={() => setModal("preparation")} disabled={!meta} style={pill}>
          <ListChecks size={14} color={FT.blue} aria-hidden /> Préparation des données{meta ? ` (${prepItems(meta, handlers).filter((i) => i.ready).length}/5)` : ""}
        </button>
        <button type="button" onClick={() => setModal("how")} style={pill}>
          <Info size={14} color={FT.blue} aria-hidden /> Comment c'est calculé ?
        </button>
      </div>

      <Card padded={false} style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: FT.blueL, display: "grid", placeItems: "center", color: FT.navy, flexShrink: 0 }}>
              <Gauge size={17} aria-hidden />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: FT.text }}>Contrôle CPH par site — {fmtDate(period.start)} → {fmtDate(period.end)}</h2>
              <div style={{ fontSize: 12.5, color: FT.textSub, marginTop: 3 }}>
                Conso théorique (heures de marche × CPH de la courbe du GE) comparée au stock.
                {data?.pagination && ` ${data.pagination.total.toLocaleString("fr-FR")} site(s).`}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select aria-label="Période" value={presetActive} onChange={(e) => { const p = presets.find((x) => x.label === e.target.value); if (p) choosePeriod(p.start, p.end); }} style={{ ...control, cursor: "pointer" }}>
              {presets.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
              <option value="" disabled>Personnalisée</option>
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 7, ...control }}>
              <CalendarRange size={14} color={FT.textSub} aria-hidden />
              <label htmlFor="cph-start" className="sr-only">Date de début</label>
              <input id="cph-start" type="date" value={period.start} max={period.end} onChange={(e) => choosePeriod(e.target.value, period.end)} style={{ border: "none", background: "transparent", fontWeight: 700, color: FT.text }} />
              <span aria-hidden style={{ color: FT.textSub }}>→</span>
              <label htmlFor="cph-end" className="sr-only">Date de fin</label>
              <input id="cph-end" type="date" value={period.end} min={period.start} onChange={(e) => choosePeriod(period.start, e.target.value)} style={{ border: "none", background: "transparent", fontWeight: 700, color: FT.text }} />
            </div>
          </div>
        </div>
        {periodError && <div role="alert" style={{ marginBottom: 10, color: FT.red, fontSize: 12.5 }}>{periodError}</div>}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <VerdictButtons value={filters.statut ?? ""} onChange={(v) => setFilter("statut", v)} s={s} />
          <select aria-label="Point bloquant" value={filters.blocage ?? ""} onChange={(e) => setFilter("blocage", e.target.value)} style={{ ...control, cursor: "pointer", maxWidth: 300 }}>
            <option value="">Point bloquant : tous</option>
            {blocages.map((b) => <option key={b.code} value={b.code}>{b.label} ({b.sites})</option>)}
            {filters.blocage && !blocages.some((b) => b.code === filters.blocage) && <option value={filters.blocage}>{filters.blocage}</option>}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 7, ...control, minWidth: 200, flex: "0 1 240px" }}>
            <Search size={14} color={FT.textSub} aria-hidden />
            <input aria-label="Rechercher un site" value={siteInput} onChange={(e) => { setSiteInput(e.target.value); setPage(1); }} placeholder="Site ID ou nom..." style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 12.5, minWidth: 0 }} />
          </div>
          <div style={{ flex: 1 }} />
          <button type="button" aria-expanded={showMoreFilters || advancedCount > 0} aria-controls="cph-more-filters" onClick={() => setShowMoreFilters((v) => !v)} style={btn} title="Pays, zone, sources, calcul CPH">
            <SlidersHorizontal size={13} aria-hidden /> Filtres{advancedCount > 0 ? ` (${advancedCount})` : ""}
          </button>
          <button type="button" aria-pressed={detailedView} onClick={() => setDetailedView((v) => !v)} style={{ ...btn, ...(detailedView ? { background: FT.navy, color: "#fff", borderColor: FT.navy } : {}) }}>
            <Columns3 size={13} aria-hidden /> {detailedView ? "Vue simple" : "Toutes les colonnes"}
          </button>
          <button type="button" onClick={() => handleExport("controle")} disabled={!!exporting || !!periodError} style={{ ...btn, opacity: exporting ? 0.6 : 1 }} title="Export CSV du contrôle complet">
            <Download size={13} color={FT.blue} aria-hidden /> {exporting === "controle" ? "Export…" : "Contrôle complet"}
          </button>
          <button type="button" onClick={() => handleExport("anomalies")} disabled={!!exporting || !!periodError} style={{ ...btn, color: FT.red, borderColor: FT.redL, opacity: exporting ? 0.6 : 1 }} title="Export CSV des anomalies">
            <Download size={13} aria-hidden /> {exporting === "anomalies" ? "Export…" : "Anomalies Fuel"}
          </button>
        </div>
        {(showMoreFilters || advancedCount > 0) && (
          <div id="cph-more-filters" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12, padding: 10, borderRadius: 10, background: FT.cardAlt, border: `1px solid ${FT.border}` }}>
            <select aria-label="Pays" value={filters.country ?? ""} onChange={(e) => setFilter("country", e.target.value)} style={control}>
              <option value="">Pays : tous</option>
              {(data?.filters.countries ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select aria-label="Zone" value={filters.zone ?? ""} onChange={(e) => setFilter("zone", e.target.value)} style={control}>
              <option value="">Zone : toutes</option>
              {(data?.filters.zones ?? []).map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <select aria-label="Source des heures de marche" value={filters.runtime_source ?? ""} onChange={(e) => setFilter("runtime_source", e.target.value)} style={control}>
              <option value="">Source heures de marche : toutes</option>
              {sortedRuntimeSources.map((r) => <option key={r} value={r}>{RUNTIME_SOURCE_LABELS[r] ?? r}</option>)}
            </select>
            <select aria-label="Source de la puissance" value={filters.power_source ?? ""} onChange={(e) => setFilter("power_source", e.target.value)} style={control}>
              <option value="">Source puissance : toutes</option>
              {(data?.filters.power_sources ?? []).map((p) => <option key={p} value={p}>{POWER_SOURCE_LABELS[p] ?? p}</option>)}
            </select>
            <select aria-label="Calcul du CPH" value={filters.cph_status ?? ""} onChange={(e) => setFilter("cph_status", e.target.value)} style={control}>
              <option value="">Calcul CPH : tous</option>
              {Object.entries(CPH_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select aria-label="Disponibilité runtime" value={filters.dispo_runtime ?? ""} onChange={(e) => setFilter("dispo_runtime", e.target.value)} style={control}>
              <option value="">Disponibilité runtime : toutes</option>
              <option value="90+">≥ 90 %</option><option value="50+">≥ 50 %</option><option value="lt50">&lt; 50 %</option><option value="aucune">aucune source retenue</option>
            </select>
            <select aria-label="Statut mapping" value={filters.correspondance ?? ""} onChange={(e) => setFilter("correspondance", e.target.value)} style={control}>
              <option value="">Statut mapping : tous</option>
              {Object.keys(MATCH_LABELS).map((k) => <option key={k} value={k}>{k}{s?.correspondances ? ` (${s.correspondances[k as keyof typeof MATCH_LABELS] ?? 0})` : ""}</option>)}
            </select>
            <select aria-label="Statut courbe" value={filters.curve_source_status ?? ""} onChange={(e) => setFilter("curve_source_status", e.target.value)} style={control}>
              <option value="">Statut courbe : tous</option>
              {["VALIDE_CONSTRUCTEUR", "HISTORIQUE_A_VALIDER", "ARCHIVE", "DISTRIBUTEUR"].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <select aria-label="Motif CPH" value={filters.motif_cph ?? ""} onChange={(e) => setFilter("motif_cph", e.target.value)} style={control}>
              <option value="">Motif CPH : tous</option>
              {Object.keys(MOTIF_LABELS).map((k) => <option key={k} value={k}>{k}{s?.motifs_cph ? ` (${s.motifs_cph[k as keyof typeof MOTIF_LABELS] ?? 0})` : ""}</option>)}
            </select>
          </div>
        )}
        {exportError && <div role="alert" style={{ color: FT.red, fontSize: 12.5, marginBottom: 10 }}>Export impossible : {exportError}</div>}

        {q.isLoading ? (
          <Skeleton h={420} />
        ) : q.isError ? (
          <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Calcul impossible : {apiError(q.error)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Gauge size={20} />} title="Aucun site" subtitle={filters.statut || filters.blocage || advancedCount || siteInput ? "Aucun site ne correspond à ces filtres." : "Aucun site avec GE sur ce périmètre, ou les données Snowflake ne sont pas encore synchronisées."} />
        ) : (
          <>
            <div style={{ overflow: "auto", maxHeight: 620, borderRadius: 12, border: `1px solid ${FT.border}`, opacity: q.isFetching ? 0.6 : 1 }} aria-busy={q.isFetching}>
              {detailedView ? <LegacyTable rows={rows} onDetail={setDetailSite} /> : <SimpleTable rows={rows} onDetail={setDetailSite} />}
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

      {detailSite && <SiteDetailModal siteId={detailSite} start={period.start} end={period.end} onClose={() => setDetailSite(null)} />}
      {modal === "preparation" && meta && <PreparationModal meta={meta} handlers={handlers} onClose={() => setModal(null)} />}
      {modal === "blocages" && s && (
        <BlocagesModal s={s} active={filters.blocage} onSelect={(v) => setFilter("blocage", v)} activeDiag={filters.diag} onDiag={(v) => setFilter("diag", v)} onAction={(t) => setModal(t === "observations" ? "import" : t)} onClose={() => setModal(null)} />
      )}
      {modal === "how" && <HowItWorksModal onClose={() => setModal(null)} ruleVersion={meta?.rule_version} />}
      {modal === "import" && (
        <ObservationImportModal
          onClose={() => setModal(null)}
          onImported={() => qc.invalidateQueries({ queryKey: ["cph-period"] })}
          onOpenAbaque={() => setModal("abaque")}
        />
      )}
      {modal === "abaque" && (
        <AbaqueImportModal
          onClose={() => setModal(null)}
          canValidate={meta?.can_validate ?? true}
          onOpenReferentiel={() => setModal("referentiel")}
        />
      )}
      {modal === "referentiel" && <ReferentielModal onClose={() => setModal(null)} />}
    </div>
  );
}
