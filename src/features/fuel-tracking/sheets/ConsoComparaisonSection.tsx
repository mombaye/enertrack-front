// « Suivis Consommations » — UN seul tableau, UNE période exacte (jours entiers 00:00:00 → 23:59:59), une ligne = un site.
// Cinq mesures distinctes : variation de stock · Closing · instrumentée Snowflake · CPH (complète / partielle) · consommation réelle certifiée (vide avant validation).
import { useState, type CSSProperties, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, Eye, RefreshCw, CalendarDays } from "lucide-react";
import {
  downloadConsoExport, getConsoEvolution, getConsommations, getConsommationsPeriodes,
  type ConsoFilters, type ConsoFraicheur, type ConsoRow, type ConsoStatutBilan, type ConsoTargetStatut,
} from "@/services/fuelTracking";
import { Modal, Skeleton } from "../ui";
import { FT, type Tone } from "../theme";
import { HelpTip } from "./cphBadges";
import { CoverageKpis } from "./cphDiagnostics";
import { BalanceDetailModal } from "./StockPeriodBalance";
import { EvolutionChart, KpiCards, SectionTitle, StatusDonut, type OverviewCard } from "./ConsoOverview";
import { DataHealthPanel } from "./DataHealthPanel";
import { SiteDetailModal } from "./ControleCphSheet";

const nf = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "—" : v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const signed = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${nf(v, d)}`);
const mono: CSSProperties = { fontVariantNumeric: "tabular-nums" };
const dash = <span style={{ color: FT.textSub }}>—</span>;

const STATUT_META: Record<ConsoStatutBilan, { label: string; tone: Tone }> = {
  NON_CALCULABLE: { label: "Non calculable", tone: "slate" },
  VARIATION_CALCULEE: { label: "Variation calculée", tone: "red" },
  ESTIMATION_AVEC_RESERVE: { label: "Estimation avec réserve", tone: "orange" },
  PRET_A_CERTIFIER: { label: "Prêt à certifier", tone: "green" },
  CONSOMMATION_REELLE_CERTIFIEE: { label: "Réelle certifiée", tone: "blue" },
};
const TARGET_META: Record<ConsoTargetStatut, { label: string; tone: Tone }> = {
  SOUS_TARGET: { label: "Sous target", tone: "green" },
  DANS_TARGET: { label: "Dans target", tone: "green" },
  AU_DESSUS_TARGET: { label: "Au-dessus target", tone: "red" },
  TARGET_HISTORIQUE_A_CONFIRMER: { label: "Historique à confirmer", tone: "orange" },
  TARGET_INDISPONIBLE: { label: "Indisponible", tone: "slate" },
};
const TONE_COLORS: Record<Tone, { fg: string; bg: string }> = {
  green: { fg: FT.green, bg: FT.greenL }, orange: { fg: FT.orange, bg: FT.orangeL }, red: { fg: FT.red, bg: FT.redL },
  blue: { fg: FT.blue, bg: FT.slateL }, violet: { fg: FT.violet, bg: FT.slateL }, cyan: { fg: FT.slate, bg: FT.slateL },
  slate: { fg: FT.textMid, bg: FT.slateL }, gold: { fg: FT.orange, bg: FT.orangeL },
};

function Pill({ label, tone }: { label: string; tone: Tone }) {
  const c = TONE_COLORS[tone];
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, color: c.fg, background: c.bg, whiteSpace: "nowrap" }}>{label}</span>;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ── Colonnes du tableau (une définition par colonne : groupe, libellé, infobulle, rendu) ───────────────────────────────────────────────
type Col = { k: string; group: string; label: string; help?: string; left?: boolean; min?: number; render: (r: ConsoRow) => ReactNode };
const num = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? dash : nf(v, d));
const gap = (l: number | null, pct: number | null, na: string | null, which: "l" | "pct") => {
  if (l === null) return dash;
  if (which === "l") return <b style={mono}>{signed(l, 0)}</b>;
  return pct === null ? <span title={na ?? ""} style={{ color: FT.textMid, fontSize: 11 }}>n/a</span> : <span style={mono}>{signed(pct, 1)} %</span>;
};

function buildColsDef(A: Record<string, string>): Col[] {
  return [
    // Identification (colonnes figées : Site ID, Nom du site, Statut bilan)
    { k: "site", group: "Identification", label: "Site ID", left: true, render: (r) => <b>{r.site_id}</b> },
    { k: "name", group: "Identification", label: "Nom du site", left: true, render: (r) => r.site_name ?? "—" },
    { k: "statut", group: "Identification", label: "Statut bilan", left: true, help: "NON_CALCULABLE · VARIATION_CALCULEE (calculée mais anomalie, ex. négative) · ESTIMATION_AVEC_RESERVE · PRET_A_CERTIFIER · CONSOMMATION_REELLE_CERTIFIEE (validée par le Fuel Manager).",
      render: (r) => <Pill label={STATUT_META[r.stock.statut].label} tone={STATUT_META[r.stock.statut].tone} /> },
    { k: "pays", group: "Identification", label: "Pays", left: true, render: (r) => r.country ?? "—" },
    { k: "zone", group: "Identification", label: "Zone", left: true, render: (r) => r.zone ?? "—" },
    { k: "typo", group: "Identification", label: "Typologie site", left: true, render: (r) => r.typologie ?? "—" },
    { k: "typoe", group: "Identification", label: "Typologie énergie", left: true, help: "Indoor/outdoor, grid/off-grid, solaire/non solaire, hybride (référentiel du site).", render: (r) => r.typologie_energie ?? "—" },
    { k: "ge", group: "Identification", label: "Modèle GE", left: true, render: (r) => r.modele_ge ?? "—" },
    { k: "kva", group: "Identification", label: "Puissance nominale GE (kVA)", render: (r) => num(r.puissance_nominale_kva, 0) },
    { k: "psrc", group: "Identification", label: "Source puissance GE", left: true, render: (r) => r.source_puissance ?? "—" },
    // Période
    { k: "d1", group: "Période", label: "Date début", render: (r) => r.periode.debut.split("-").reverse().join("/") },
    { k: "d2", group: "Période", label: "Date fin", render: (r) => r.periode.fin.split("-").reverse().join("/") },
    { k: "nj", group: "Période", label: "Jours", render: (r) => r.periode.jours },
    // Stock
    { k: "si", group: "Stock", label: "Stock initial (L)", render: (r) => num(r.stock.initial_l) },
    { k: "ssi", group: "Stock", label: "Source stock initial", left: true, render: (r) => r.stock.source_initial ?? "—" },
    { k: "ent", group: "Stock", label: "Entrées carburant (L)", help: "Livraisons externes + Carte Total + Ponctions entrantes + rajouts.", render: (r) => num(r.stock.entrees_l) },
    { k: "ct", group: "Stock", label: "Carte Total (L)", render: (r) => num(r.stock.carte_total_l) },
    { k: "tr", group: "Stock", label: "Truck (L)", render: (r) => num(r.stock.truck_l) },
    { k: "pe", group: "Stock", label: "Ponctions entrantes (L)", render: (r) => num(r.stock.ponctions_entrantes_l) },
    { k: "ps", group: "Stock", label: "Ponctions sortantes (L)", render: (r) => num(r.stock.ponctions_sortantes_l) },
    { k: "ra", group: "Stock", label: "Rajouts (L)", render: (r) => num(r.stock.rajouts_l) },
    { k: "re", group: "Stock", label: "Retraits (L)", render: (r) => num(r.stock.retraits_l) },
    { k: "vo", group: "Stock", label: "Vols (L)", render: (r) => num(r.stock.vols_l) },
    { k: "vi", group: "Stock", label: "Vidanges (L)", render: (r) => num(r.stock.vidanges_l) },
    { k: "sf", group: "Stock", label: "Stock final (L)", render: (r) => num(r.stock.final_l) },
    { k: "ssf", group: "Stock", label: "Source stock final", left: true, render: (r) => r.stock.source_final ?? "—" },
    { k: "var", group: "Stock", label: "Variation de stock (L)", help: A.variation,
      render: (r) => (r.stock.variation_l === null ? dash : <b style={{ ...mono, color: r.stock.variation_l < 0 ? FT.red : FT.text }}>{nf(r.stock.variation_l)}</b>) },
    { k: "score", group: "Stock", label: "Score", render: (r) => r.stock.score ?? dash },
    { k: "motif", group: "Stock", label: "Réserve / motif", left: true, min: 300, render: (r) => r.stock.motif ?? "—" },
    { k: "action", group: "Stock", label: "Action attendue", left: true, min: 300, render: (r) => r.stock.action },
    // Comparaisons
    { k: "clo", group: "Comparaisons", label: "Consommation Closing (L)", help: A.closing, render: (r) => num(r.closing.conso_l) },
    { k: "cle", group: "Comparaisons", label: "Écart variation vs Closing (L)", help: `${A.ecart_closing ?? ""} Un écart nul n'est pas un contrôle indépendant quand les stocks et mouvements viennent eux-mêmes du Closing (mention « non indépendant »).`,
      render: (r) => (r.closing.ecart_l === null ? dash : <span>{gap(r.closing.ecart_l, r.closing.ecart_pct, r.closing.pct_na, "l")}{r.closing.controle_independant === false && <span title="Stocks et mouvements issus du Closing : écart mécanique, pas un contrôle indépendant" style={{ marginLeft: 4, fontSize: 10, color: FT.orange, fontWeight: 800 }}>non indép.</span>}</span>) },
    { k: "clp", group: "Comparaisons", label: "Écart variation vs Closing (%)", render: (r) => gap(r.closing.ecart_l, r.closing.ecart_pct, r.closing.pct_na, "pct") },
    { k: "tg", group: "Comparaisons", label: "Target fuel période (L)", help: A.target, render: (r) => num(r.target.periode_l) },
    { k: "tgs", group: "Comparaisons", label: "Source target", left: true, render: (r) => r.target.source ?? "—" },
    { k: "tgst", group: "Comparaisons", label: "Statut target", left: true, render: (r) => <Pill label={TARGET_META[r.target.statut].label} tone={TARGET_META[r.target.statut].tone} /> },
    { k: "tge", group: "Comparaisons", label: "Écart variation vs target (L)", help: A.ecart_target, render: (r) => gap(r.target.ecart_l, r.target.ecart_pct, r.target.pct_na, "l") },
    { k: "tgp", group: "Comparaisons", label: "Écart variation vs target (%)", render: (r) => gap(r.target.ecart_l, r.target.ecart_pct, r.target.pct_na, "pct") },
    { k: "in", group: "Comparaisons", label: "Consommation instrumentée Snowflake (L)", help: A.instrumentee, render: (r) => num(r.instrumentee.conso_l) },
    { k: "inc", group: "Comparaisons", label: "Couverture instrumentée (%)", render: (r) => (r.instrumentee.couverture_pct === null ? dash : <span title={`${r.instrumentee.jours_mesure} / ${r.instrumentee.jours} jours`}>{nf(r.instrumentee.couverture_pct, 0)} %</span>) },
    { k: "ine", group: "Comparaisons", label: "Écart variation vs instrumentée (L)", help: A.ecart_instrumentee, render: (r) => gap(r.instrumentee.ecart_l, r.instrumentee.ecart_pct, r.instrumentee.pct_na, "l") },
    { k: "inp", group: "Comparaisons", label: "Écart variation vs instrumentée (%)", render: (r) => gap(r.instrumentee.ecart_l, r.instrumentee.ecart_pct, r.instrumentee.pct_na, "pct") },
    { k: "cc", group: "Comparaisons", label: "CPH complète (L)", help: A.cph_complete, render: (r) => num(r.cph.complete_l) },
    { k: "cp", group: "Comparaisons", label: "CPH partielle (L)", help: A.cph_partielle, render: (r) => (r.cph.partielle_l === null ? dash : <span style={{ color: FT.orange }} title="Partielle : ne couvre pas toute la période">{nf(r.cph.partielle_l)}</span>) },
    { k: "ccv", group: "Comparaisons", label: "Couverture CPH (%)", render: (r) => (r.cph.couverture_pct === null ? dash : `${nf(r.cph.couverture_pct, 0)} %`) },
    { k: "cce", group: "Comparaisons", label: "Écart variation vs CPH complète (L)", help: A.ecart_cph, render: (r) => gap(r.cph.ecart_l, r.cph.ecart_pct, r.cph.pct_na, "l") },
    { k: "ccp", group: "Comparaisons", label: "Écart variation vs CPH complète (%)", render: (r) => gap(r.cph.ecart_l, r.cph.ecart_pct, r.cph.pct_na, "pct") },
    { k: "alc", group: "Comparaisons", label: "Alertes de comparaison", left: true, min: 220, help: "Écart extrême entre mesures (valeurs conservées, à investiguer) : INSTRUMENTEE_ECART_EXTREME, CPH_ECART_EXTREME, CPH_NULLE_VARIATION_POSITIVE. Seuils configurables (FUEL_COMPARE_EXTREME_RATIO, FUEL_COMPARE_EXTREME_MIN_L).",
      render: (r) => (r.stock.alertes_comparaison.length ? <span style={{ color: FT.red, fontWeight: 700 }}>{r.stock.alertes_comparaison.join(" · ")}</span> : dash) },
    // CPH
    { k: "rt", group: "CPH", label: "Runtime retenu (h)", render: (r) => num(r.cph.runtime_h, 1) },
    { k: "rts", group: "CPH", label: "Source runtime", left: true, render: (r) => r.cph.runtime_source ?? "—" },
    { k: "rtd", group: "CPH", label: "Disponibilité runtime", render: (r) => (r.cph.runtime_disponibilite === null ? dash : `${nf(r.cph.runtime_disponibilite * 100, 0)} %`) },
    { k: "pw", group: "CPH", label: "Source puissance GE", left: true, render: (r) => r.cph.power_source ?? "—" },
    { k: "nm", group: "CPH", label: "Niveau médiane", left: true, help: "MEDIANE_JOUR · MEDIANE_MOIS · MEDIANE_PERIODE_SELECTIONNEE (même site, jamais de données futures). Non encore renseigné : la cascade de médianes n'est pas activée.", render: (r) => r.cph.niveau_mediane ?? "—" },
    { k: "nb", group: "CPH", label: "Nombre de mesures", render: (r) => r.cph.nb_mesures ?? dash },
    { k: "tc", group: "CPH", label: "Taux de charge (%)", render: (r) => num(r.cph.charge_pct, 1) },
    { k: "cl", group: "CPH", label: "CPH retenu (L/h)", render: (r) => num(r.cph.cph_l_h, 2) },
    // Certification
    { k: "ce", group: "Certification", label: "Consommation réelle certifiée (L)", help: A.certifiee, render: (r) => (r.certification.valeur_l === null ? dash : <b style={mono}>{nf(r.certification.valeur_l)}</b>) },
    { k: "cp2", group: "Certification", label: "Validée par", left: true, render: (r) => r.certification.par ?? "—" },
    { k: "cd", group: "Certification", label: "Date validation", render: (r) => (r.certification.date ? new Date(r.certification.date).toLocaleDateString("fr-FR") : "—") },
    { k: "cc2", group: "Certification", label: "Commentaire certification", left: true, min: 220, render: (r) => r.certification.commentaire ?? "—" },
  ];
}

// Blocs absents ou incomplets dans une réponse du serveur : valeurs vides (jamais de plantage de l'écran, jamais de 0 inventé).
const EMPTY_GAP = { ecart_l: null, ecart_pct: null, pct_na: null };
function safeRow(r: ConsoRow): ConsoRow {
  const x = r as Partial<ConsoRow>;
  return {
    ...r,
    periode: x.periode ?? { debut: "", fin: "", jours: 0 },
    stock: { reserves: [], alertes: [], alertes_comparaison: [], statut: "NON_CALCULABLE", action: "—", ...(x.stock ?? {}) } as ConsoRow["stock"],
    closing: { conso_l: null, controle_independant: null, ...EMPTY_GAP, ...(x.closing ?? {}) },
    target: { periode_l: null, mensuel_l: null, source: null, statut: "TARGET_INDISPONIBLE", position: null, annee_reference: null, ...EMPTY_GAP, ...(x.target ?? {}) } as ConsoRow["target"],
    instrumentee: { conso_l: null, jours_mesure: 0, jours: 0, couverture_pct: null, disponible: false, ...EMPTY_GAP, ...(x.instrumentee ?? {}) },
    cph: { complete_l: null, partielle_l: null, statut: null, jours_cph: null, couverture_pct: null, motif_code: null, runtime_h: null, runtime_source: null, runtime_disponibilite: null, power_source: null, charge_pct: null, cph_l_h: null, niveau_mediane: null, nb_mesures: null, ...EMPTY_GAP, ...(x.cph ?? {}) },
    certification: { valeur_l: null, par: null, date: null, commentaire: null, niveau: null, ...(x.certification ?? {}) },
  };
}

const GROUP_BG: Record<string, string> = { Identification: FT.navy, Période: "#475569", Stock: "#0F7A52", Comparaisons: "#1A56C4", CPH: "#6D28D9", Certification: "#B45309" };
const GROUP_H = 26;
const thGroup: CSSProperties = { padding: "5px 10px", fontSize: 10.5, fontWeight: 800, color: "#fff", textAlign: "center", position: "sticky", top: 0, zIndex: 2, borderLeft: "1px solid rgba(255,255,255,.25)", height: GROUP_H, boxSizing: "border-box" };
const th: CSSProperties = { padding: "8px 10px", fontSize: 10.5, fontWeight: 800, color: FT.text, textTransform: "uppercase", letterSpacing: ".03em", background: FT.slateL, borderBottom: `1px solid ${FT.border}`, textAlign: "right", whiteSpace: "nowrap", position: "sticky", top: GROUP_H, zIndex: 2 };
const td: CSSProperties = { padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${FT.border}`, textAlign: "right", whiteSpace: "nowrap" };
const clamp2: CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "normal", lineHeight: 1.35 };
const W1 = 110, W2 = 190;
const STICKY = [0, W1, W1 + W2];                                  // positions des 3 colonnes figées

function DataQualityNotice({ f }: { f: ConsoFraicheur | undefined }) {
  if (!f || (!f.perime && !f.periode_incomplete && !f.synchro_en_echec)) return null;
  const fr = (d: string) => d.split("-").reverse().join("/");
  const lines: string[] = [];
  if (f.snowflake_derniere_date === null) lines.push("Aucune donnée Snowflake synchronisée : consommation instrumentée et CPH indisponibles.");
  else if (f.perime) lines.push(`Données Snowflake à jour jusqu'au ${fr(f.snowflake_derniere_date)} (${f.age_jours} j de retard, seuil ${f.seuil_jours} j).`);
  if (f.periode_incomplete && f.snowflake_derniere_date) lines.push(`${f.jours_non_couverts} jour(s) de la période ne sont pas couverts : l'instrumentée et la CPH ne portent que sur les jours disponibles (la variation de stock n'est pas concernée).`);
  if (f.synchro_en_echec) lines.push(`Dernière synchronisation Snowflake en échec${f.erreur_synchro ? ` : ${f.erreur_synchro}` : ""}.`);
  return (
    <div role="status" style={{ padding: "9px 14px", borderRadius: FT.radius, background: FT.orangeL, border: "1px solid rgba(217,119,6,.3)", color: FT.text, fontSize: 12.5, display: "grid", gap: 2 }}>
      <strong style={{ color: FT.orange }}>Qualité des données Snowflake</strong>
      {lines.map((l) => <span key={l}>{l}</span>)}
    </div>
  );
}

function KpiStrip({ cells }: { cells: Array<{ tone: Tone; label: string; value: string; sub: string; help?: string }> }) {
  return (
    <div role="group" aria-label="Indicateurs de la période" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", border: FT.borderCrisp, borderRadius: FT.radius, background: FT.card, boxShadow: FT.shadow, overflow: "hidden" }}>
      {cells.map((c, i) => (
        <div key={c.label} style={{ padding: "12px 14px", borderLeft: i === 0 ? "none" : `1px solid ${FT.border}`, borderTop: `3px solid ${TONE_COLORS[c.tone].fg}`, display: "grid", alignContent: "start", gap: 4, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".04em", lineHeight: 1.25 }}>{c.label}{c.help && <HelpTip text={c.help} label={c.label} />}</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: FT.text, ...mono }}>{c.value}</div>
          <div style={{ fontSize: 11, color: FT.textMid, lineHeight: 1.35 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

export function ConsoComparaisonSection({ extra }: { extra?: ReactNode }) {
  const [debut, setDebut] = useState<string>("");
  const [fin, setFin] = useState<string>("");
  const [f, setF] = useState<ConsoFilters>({});
  const [site, setSite] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<{ row: ConsoRow; tab: "hub" | "stock" | "cph" } | null>(null);
  const [more, setMore] = useState(false);
  const [full, setFull] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const params: ConsoFilters = { ...f, site: site || undefined, date_debut: debut || undefined, date_fin: fin || undefined, page, page_size: 50 };
  const periods = useQuery({ queryKey: ["conso-periods"], queryFn: getConsommationsPeriodes, staleTime: 60_000 });
  const q = useQuery({ queryKey: ["consommations", params], queryFn: () => getConsommations(params), placeholderData: keepPreviousData });
  const evo = useQuery({ queryKey: ["conso-evolution"], queryFn: getConsoEvolution, staleTime: 60_000 });
  const d = q.data;
  const per = d?.periode ?? null;
  const A = d?.aide ?? {};
  const set = (k: keyof ConsoFilters, v: string) => { setF((o) => ({ ...o, [k]: v || undefined })); setPage(1); };
  const cols = buildColsDef(A);

  const exportCsv = async (kind: "controle_complet" | "anomalies_fuel" | "priorites_donnees" | "rapport_imports") => {
    setBusy(kind); setMsg(null);
    try {
      const r = await downloadConsoExport(kind, { ...params, page: undefined, page_size: undefined });
      setMsg(`${r.name} téléchargé${Number.isFinite(r.rows) ? ` (${r.rows} ligne${r.rows > 1 ? "s" : ""})` : ""}.`);
    } catch {
      setMsg("Export impossible pour cette période.");
    } finally { setBusy(null); }
  };

  const sel = (k: keyof ConsoFilters, label: string, opts: string[] | undefined, fmtOpt?: (o: string) => string) => (
    <label style={{ display: "grid", gap: 3, fontSize: 10.5, fontWeight: 800, color: FT.textSub, textTransform: "uppercase" }}>
      {label}
      <select value={(f[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, color: FT.text, fontWeight: 600 }}>
        <option value="">Tous</option>
        {(opts ?? []).map((o) => <option key={o} value={o}>{fmtOpt ? fmtOpt(o) : o}</option>)}
      </select>
    </label>
  );
  const dateIn = (label: string, v: string, on: (s: string) => void) => (
    <label style={{ display: "grid", gap: 3, fontSize: 10.5, fontWeight: 800, color: FT.textSub, textTransform: "uppercase" }}>
      {label}
      <input type="date" value={v} onChange={(e) => { on(e.target.value); setPage(1); }} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 8, border: `1px solid ${FT.border}`, color: FT.text }} />
    </label>
  );

  if (q.isLoading) return <Skeleton h={420} />;
  // Interface plus récente que l'API : message clair au lieu d'une page blanche (le serveur doit être redémarré sur la même version).
  if (d && (!d.kpis || !(d.kpis as { variation?: unknown }).variation || (d.rows[0] && !(d.rows[0] as { stock?: unknown }).stock))) {
    return <div role="alert" style={{ padding: 16, borderRadius: FT.radius, background: FT.orangeL, color: FT.text, fontSize: 13.5 }}>
      <strong>Version de l'API incompatible.</strong> Le serveur renvoie l'ancien format de « Suivis Consommations ». Redémarrez le backend (conteneur web) sur la dernière version, puis rechargez la page.
    </div>;
  }
  const k = d?.kpis;
  const totalPages = d ? Math.max(1, Math.ceil(d.total / d.page_size)) : 1;
  const noBilan = !per || !per.bilan_disponible;
  const groups: Array<{ name: string; n: number }> = [];
  cols.forEach((c) => { const last = groups[groups.length - 1]; if (last && last.name === c.group) last.n += 1; else groups.push({ name: c.group, n: 1 }); });
  const stickyStyle = (i: number, z = 3): CSSProperties => (i < 3 ? { position: "sticky", left: STICKY[i], zIndex: z } : {});

  return (
    <section aria-label="Suivis Consommations" style={{ display: "grid", gap: 14 }}>
      <SectionTitle title="Suivis Consommations" subtitle="Analyse et suivi de la consommation de carburant par période et par site"
        right={per && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 12, border: FT.borderCrisp, background: FT.card, boxShadow: FT.shadow, fontWeight: 800, fontSize: 13 }}>
            <CalendarDays size={16} aria-hidden /> {new Date(per.debut).toLocaleDateString("fr-FR")} → {new Date(per.fin).toLocaleDateString("fr-FR")}
          </div>
        )} />
      <div style={{ border: FT.borderCrisp, background: FT.card, borderRadius: FT.radius, boxShadow: FT.shadow, padding: "12px 14px", display: "grid", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: 3, fontSize: 10.5, fontWeight: 800, color: FT.textSub, textTransform: "uppercase" }}>
            Périodes avec bilan
            <select aria-label="Périodes avec bilan" value="" onChange={(e) => { const p = periods.data?.periodes[Number(e.target.value)]; if (p) { setDebut(p.debut); setFin(p.fin); setPage(1); } }} style={{ fontSize: 12, padding: "7px 8px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, color: FT.text, fontWeight: 600, minWidth: 200 }}>
              <option value="">Choisir…</option>
              {(periods.data?.periodes ?? []).map((p, i) => <option key={`${p.debut}-${p.fin}`} value={i}>{p.libelle} — {p.calculables}/{p.sites} calculables</option>)}
            </select>
          </label>
          {dateIn("Date début", debut || per?.debut || "", setDebut)}
          {dateIn("Date fin", fin || per?.fin || "", setFin)}
          <label style={{ display: "grid", gap: 3, fontSize: 10.5, fontWeight: 800, color: FT.textSub, textTransform: "uppercase" }}>
            Site / nom
            <input value={site} onChange={(e) => { setSite(e.target.value); setPage(1); }} placeholder="ID ou nom" style={{ fontSize: 12, padding: "7px 8px", borderRadius: 8, border: `1px solid ${FT.border}`, minWidth: 150 }} />
          </label>
          {sel("typologie", "Typologie site", d?.facettes.typologies)}
          <button type="button" onClick={() => { const t = new Date(); const e = new Date(t.getFullYear(), t.getMonth(), 0); setDebut(iso(new Date(e.getFullYear(), e.getMonth(), 1))); setFin(iso(e)); setPage(1); }} style={{ fontSize: 12, fontWeight: 700, padding: "8px 10px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: "pointer" }}>Mois précédent</button>
          <button type="button" onClick={() => { setDebut(""); setFin(""); setPage(1); }} style={{ fontSize: 12, fontWeight: 700, padding: "8px 10px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: "pointer" }}>Période par défaut</button>
          <button type="button" onClick={() => { void q.refetch(); void evo.refetch(); }} disabled={q.isFetching} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, padding: "9px 16px", borderRadius: 10, border: "none", background: FT.blue, color: "#fff", cursor: "pointer" }}>
            <RefreshCw size={14} aria-hidden /> {q.isFetching ? "Actualisation…" : "Actualiser"}
          </button>
        </div>
        {per && <div style={{ fontSize: 11.5, color: FT.textMid }}>Période exacte {per.libelle}{per.par_defaut ? " (dernière période complète avec bilan)" : ""} · {per.sites_calculables.toLocaleString("fr-FR")} site(s) avec variation de stock calculable sur {per.sites_avec_bilan.toLocaleString("fr-FR")} bilans — {per.jours} jour(s).</div>}
        <hr aria-hidden style={{ border: 0, borderTop: `1px solid ${FT.border}`, margin: "2px 0" }} />
        <div role="group" aria-label="Vues rapides" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {([["Tous", {}], ["Prêts à certifier", { statut_bilan: "PRET_A_CERTIFIER" }], ["Avec réserve", { statut_bilan: "ESTIMATION_AVEC_RESERVE" }], ["Non calculables", { statut_bilan: "NON_CALCULABLE" }],
            ["Variation à contrôler", { statut_bilan: "VARIATION_CALCULEE" }], ["Certifiés", { statut_bilan: "CONSOMMATION_REELLE_CERTIFIEE" }]] as Array<[string, Partial<ConsoFilters>]>).map(([label, patch]) => {
            const active = Object.keys(patch).length === 0 ? !f.statut_bilan : f.statut_bilan === patch.statut_bilan;
            return (
              <button key={label} type="button" aria-pressed={active} onClick={() => { setF((o) => ({ ...o, statut_bilan: undefined, ...patch })); setPage(1); }}
                style={{ fontSize: 12, fontWeight: 800, padding: "6px 12px", borderRadius: 999, border: `1px solid ${active ? FT.navy : FT.border}`, background: active ? FT.navy : FT.card, color: active ? "#fff" : FT.text, cursor: "pointer" }}>{label}</button>
            );
          })}
        </div>
        <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)} style={{ justifySelf: "start", fontSize: 12, fontWeight: 800, background: "none", border: "none", color: FT.blue, cursor: "pointer", padding: 0 }}>
          {more ? "Moins de filtres ▲" : "Plus de filtres (pays, zone, typologie énergie, certification, sources, qualité, tri) ▼"}
        </button>
        {more && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {sel("pays", "Pays", d?.facettes.pays)}
            {sel("zone", "Zone", d?.facettes.zones)}
            {sel("typologie_energie", "Typologie énergie", d?.facettes.typologies_energie)}
            {sel("statut_bilan", "Statut bilan", d?.facettes.statuts_bilan, (o) => STATUT_META[o as ConsoStatutBilan]?.label ?? o)}
            {sel("statut_certification", "Statut certification", ["certifie", "non_certifie"], (o) => (o === "certifie" ? "Certifié" : "Non certifié"))}
            {sel("source_stock", "Source stock", d?.facettes.sources_stock)}
            {sel("source_runtime", "Source runtime", d?.facettes.sources_runtime)}
            {sel("source_puissance", "Source puissance", d?.facettes.sources_puissance)}
            {sel("source_target", "Source target", d?.facettes.sources_target)}
            {sel("correspondance", "Base Closing", ["avec", "sans"], (o) => (o === "avec" ? "Présents dans le Closing" : "Absents du Closing (non utilisés)"))}
            {sel("qualite", "Qualité / réserve", ["reserve", "sans_reserve", "anomalie"], (o) => (o === "reserve" ? "Avec réserve" : o === "sans_reserve" ? "Sans réserve" : "Anomalie"))}
            {sel("tri", "Tri", ["gravite", "variation", "ecart_target"], (o) => (o === "gravite" ? "Gravité" : o === "variation" ? "Plus grosse variation" : "Plus gros écart vs target"))}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {([["controle_complet", "Contrôle complet"], ["anomalies_fuel", "Anomalies Fuel"], ["priorites_donnees", "Priorités données"], ["rapport_imports", "Rapport imports"]] as const).map(([kind, label]) => (
            <button key={kind} type="button" disabled={busy !== null || (noBilan && kind !== "rapport_imports")} onClick={() => exportCsv(kind)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, padding: "7px 12px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>
              <Download size={13} aria-hidden /> {busy === kind ? "Export…" : label}
            </button>
          ))}
          {msg && <span role="status" style={{ fontSize: 12, color: FT.textMid }}>{msg}</span>}
        </div>
      </div>

      {d?.detail && !per && <div role="alert" style={{ padding: 12, borderRadius: FT.radius, background: FT.orangeL, color: FT.orange, fontWeight: 700, fontSize: 13 }}>{d.detail}</div>}
      {per && noBilan && (
        <div role="alert" style={{ padding: 12, borderRadius: FT.radius, background: FT.orangeL, color: FT.text, fontSize: 13 }}>
          Aucun bilan de stock enregistré pour cette période exacte ({per.libelle}). Choisissez une période de la liste « Périodes avec bilan ».
        </div>
      )}
      <DataQualityNotice f={d?.fraicheur} />
      <DataHealthPanel />
      {(d?.kpis.sans_correspondance?.sites ?? 0) > 0 && (
        <div role="note" style={{ padding: 10, borderRadius: FT.radius, background: FT.orangeL, fontSize: 12.5 }}>
          {d!.kpis.sans_correspondance!.sites} site(s) absent(s) du fichier Closing : affichés dans le tableau mais exclus des totaux et indicateurs (filtre « Base Closing »).
        </div>
      )}
      {q.isError && <div role="alert" style={{ padding: 12, borderRadius: FT.radius, background: FT.redL, color: FT.red, fontWeight: 700, fontSize: 13 }}>Impossible de charger les consommations (erreur serveur).</div>}

      {k && (() => {
        const ps = evo.data?.periodes ?? [];
        const i = per ? ps.findIndex((x) => x.fin === per.fin && x.debut === per.debut) : -1;
        const trendOf = (key: "variation_l" | "closing_l"): { trend: number | null; trendNote: string } => {
          const cur = i >= 0 ? ps[i][key] : null, prev = i > 0 ? ps[i - 1][key] : null;
          if (cur === null || prev === null || prev === 0) return { trend: null, trendNote: "pas de période précédente comparable" };
          return { trend: ((cur - prev) / Math.abs(prev)) * 100, trendNote: "" };
        };
        const cards: OverviewCard[] = [
          { key: "var", label: "Variation de stock", help: A.variation, value: k.variation.total_l, icon: "sigma", color: "#2563EB", bg: "#E8F0FE", series: ps.map((x) => x.variation_l),
            sub: `${nf(k.variation.sites)} sites calculables${k.variation.negatives ? ` · ${nf(k.variation.negatives)} négative(s)` : ""}`, ...trendOf("variation_l") },
          { key: "clo", label: "Consommation Closing", help: A.closing, value: k.closing.total_l, icon: "closing", color: "#16A34A", bg: "#E6F7EC", series: ps.map((x) => x.closing_l),
            sub: `${nf(k.closing.sites)} sites · référence de contrôle`, ...trendOf("closing_l") },
          { key: "ins", label: "Instrumentée Snowflake", help: A.instrumentee, value: k.instrumentee.total_l, icon: "snow", color: "#EA7A0C", bg: "#FFF1E0", sub: `${nf(k.instrumentee.sites)} sites couverts · mesure capteur` },
          { key: "cph", label: "CPH complète", help: A.cph_complete, value: k.cph_complete.total_l, icon: "cph", color: "#7C3AED", bg: "#F1EAFE",
            sub: `${nf(k.cph_complete.sites)} sites complets · partielle ${k.cph_partielle.total_l === null ? "—" : `${nf(k.cph_partielle.total_l)} L`} (${nf(k.cph_partielle.sites)} sites)` },
        ];
        const b = k.bilans;
        const donut = [
          { label: "Prêt à certifier", n: b.prets, color: "#16A34A" }, { label: "Avec réserve", n: b.avec_reserve, color: "#EA7A0C" },
          { label: "Variation à contrôler", n: b.variation_calculee, color: "#DC2626" }, { label: "Non calculable", n: b.non_calculables, color: "#94A3B8" },
          { label: "Certifié", n: b.certifies, color: "#2563EB" },
        ];
        return (
          <>
            <KpiCards cards={cards} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: "2 1 460px", minWidth: 0 }}><EvolutionChart evo={evo.data} loading={evo.isLoading} error={evo.isError} /></div>
              <div style={{ flex: "1 1 340px", minWidth: 0 }}><StatusDonut items={donut} total={donut.reduce((t, x) => t + x.n, 0)} /></div>
            </div>
          </>
        );
      })()}

      <details style={{ border: FT.borderCrisp, borderRadius: FT.radius, background: FT.card, padding: "9px 14px" }}>
        <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 800, color: FT.text }}>Tous les indicateurs (certifiée, target) · bilans · qualité du calcul CPH{extra ? " et couverture GE officielle" : ""}</summary>
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          {k && (
        <KpiStrip cells={[
          { tone: "green", label: "Variation de stock (L)", help: A.variation, value: k.variation.total_l === null ? "—" : `${nf(k.variation.total_l)} L`,
            sub: `${nf(k.variation.sites)} sites calculables · ${nf(k.bilans.prets)} prêts · ${nf(k.bilans.avec_reserve)} avec réserve${k.variation.negatives ? ` · ${nf(k.variation.negatives)} négative(s)` : ""}` },
          { tone: "blue", label: "Consommation réelle certifiée (L)", help: A.certifiee, value: k.certifiee.total_l === null ? "—" : `${nf(k.certifiee.total_l)} L`, sub: `${nf(k.bilans.certifies)} bilan(s) certifié(s) par le Fuel Manager` },
          { tone: "slate", label: "Consommation Closing (L)", help: A.closing, value: k.closing.total_l === null ? "—" : `${nf(k.closing.total_l)} L`, sub: `${nf(k.closing.sites)} sites · référence de contrôle` },
          { tone: "cyan", label: "Instrumentée Snowflake (L)", help: A.instrumentee, value: k.instrumentee.total_l === null ? "—" : `${nf(k.instrumentee.total_l)} L`, sub: `${nf(k.instrumentee.sites)} sites couverts · mesure capteur` },
          { tone: "violet", label: "CPH complète (L)", help: A.cph_complete, value: k.cph_complete.total_l === null ? "—" : `${nf(k.cph_complete.total_l)} L`,
            sub: `${nf(k.cph_complete.sites)} sites complets · partielle ${k.cph_partielle.total_l === null ? "—" : `${nf(k.cph_partielle.total_l)} L`} (${nf(k.cph_partielle.sites)} sites)` },
          { tone: "orange", label: "Target fuel période (L)", help: A.target, value: k.target.total_periode_l === null ? "—" : `${nf(k.target.total_periode_l)} L`,
            sub: `${nf(k.target.sites_avec_target)} sites avec target (${nf(k.target.couverture_pct, 0)} %) · écart variation vs target ${k.target.ecart_global_l === null ? "—" : `${signed(k.target.ecart_global_l)} L`}${k.target.ecart_global_pct === null ? "" : ` (${signed(k.target.ecart_global_pct, 1)} %)`}` },
        ]} />
          )}
          {k && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, fontSize: 12.5, color: FT.text }}>
              <div><b>Target</b> : moyen/site couvert {nf(k.target.target_moyen_site_l)} L · variation moyenne/site couvert {nf(k.target.variation_moyenne_site_l)} L · {nf(k.target.sites_sans_target)} site(s) sans target · {nf(k.target.a_confirmer)} à confirmer.</div>
              <div><b>Bilans</b> : {nf(k.bilans.prets)} prêts · {nf(k.bilans.avec_reserve)} avec réserve · {nf(k.bilans.variation_calculee)} variation à contrôler · {nf(k.bilans.non_calculables)} non calculables · {nf(k.bilans.certifies)} certifiés.</div>
              <div><b>Couvertures</b> : CPH complète {nf(k.couverture_cph_pct, 0)} % · target {nf(k.target.couverture_pct, 0)} %.</div>
              <div title={k.ponctions.note}><b>Ponctions (périmètre affiché)</b> : entrantes {nf(k.ponctions.entrantes_l)} L · sortantes {nf(k.ponctions.sortantes_l)} L · écart {signed(k.ponctions.ecart_perimetre_l)} L (contrepartie hors périmètre ; impact global ENOC = 0 L).</div>
              <div><b>Alertes</b> : {nf(k.alertes.stock_identique_suspect)} stock(s) identique(s) suspect(s) · {nf(k.alertes.instrumentee_ecart_extreme)} instrumentée à investiguer · {nf(k.alertes.cph_ecart_extreme + k.alertes.cph_nulle_variation_positive)} CPH à investiguer · {nf(k.alertes.closing_non_independant)} écart(s) Closing non indépendant(s).</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", marginBottom: 6 }}>Qualité du calcul CPH</div>
            <CoverageKpis items={d?.qualite_cph} />
          </div>
          {extra}
        </div>
      </details>

      <section aria-label="Suivis par site" style={{ border: FT.borderCrisp, background: FT.card, borderRadius: FT.radius, boxShadow: FT.shadow, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>{full ? "Tous les résultats — vue détaillée" : "Suivis par site"}</h3>
          <button type="button" onClick={() => setFull((v) => !v)} style={{ fontSize: 12.5, fontWeight: 800, padding: "7px 14px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: "pointer" }}>
            {full ? "← Vue simplifiée" : "Voir tous les résultats →"}
          </button>
        </div>
        {!full && (
          <div style={{ overflow: "auto" }}>
            <table aria-label="Aperçu des suivis par site" style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F1F5FA", textAlign: "left", color: FT.textMid, fontSize: 12 }}>
                  {["Site ID", "Nom du site", "Statut bilan", "Pays", "Zone", "Typologie site", "Variation (L)", "Closing (L)", "Écart vs Closing (L)", ""].map((h) => <th key={h} scope="col" style={{ padding: "10px 12px", fontWeight: 700 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {(d?.rows ?? []).slice(0, 8).map(safeRow).map((r) => (
                  <tr key={r.site_id} style={{ borderTop: `1px solid ${FT.border}` }}>
                    <td style={{ padding: "10px 12px", fontWeight: 800 }}>{r.site_id}</td>
                    <td style={{ padding: "10px 12px" }}>{r.site_name ?? "—"}{r.correspondance && !r.correspondance.utilise && <span title={r.correspondance.motif ?? ""} style={{ marginLeft: 6, fontSize: 10, color: FT.orange, fontWeight: 800 }}>hors Closing</span>}</td>
                    <td style={{ padding: "10px 12px" }}><span style={{ fontWeight: 700, color: TONE_COLORS[STATUT_META[r.stock.statut].tone].fg }}>{STATUT_META[r.stock.statut].label}</span></td>
                    <td style={{ padding: "10px 12px" }}>{r.country ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{r.zone ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{r.typologie ?? "—"}</td>
                    <td style={{ padding: "10px 12px", ...mono }}>{nf(r.stock.variation_l)}</td>
                    <td style={{ padding: "10px 12px", ...mono }}>{nf(r.closing.conso_l)}</td>
                    <td style={{ padding: "10px 12px", ...mono }}>{signed(r.closing.ecart_l)}</td>
                    <td style={{ padding: "6px 12px" }}>
                      <button type="button" onClick={() => setDetail({ row: r, tab: "hub" })} aria-label={`Voir le détail du site ${r.site_id}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 800, padding: "5px 9px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: "pointer" }}><Eye size={12} aria-hidden /> Détail</button>
                    </td>
                  </tr>
                ))}
                {d && d.rows.length === 0 && <tr><td colSpan={10} style={{ padding: 24, color: FT.textMid }}>Aucun site ne correspond aux filtres pour cette période.</td></tr>}
              </tbody>
            </table>
            <div style={{ padding: "8px 16px", fontSize: 12, color: FT.textMid }}>{Math.min(8, d?.rows.length ?? 0)} premiers sites sur {nf(d?.total ?? 0)} — « Voir tous les résultats » pour le tableau complet (cinq mesures, écarts, sources, pagination).</div>
          </div>
        )}
      </section>

      {full && (
      <div style={{ border: FT.borderCrisp, background: FT.card, borderRadius: FT.radius, boxShadow: FT.shadow, overflow: "hidden" }}>
        <div style={{ overflow: "auto", maxHeight: "70vh" }} tabIndex={0} aria-label="Tableau des consommations par site">
          <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "max-content", minWidth: "100%" }}>
            <thead>
              <tr>
                {groups.map((g, i) => (
                  <th key={g.name} colSpan={g.n} scope="colgroup" style={{ ...thGroup, background: GROUP_BG[g.name], ...(i === 0 ? { position: "sticky", left: 0, zIndex: 5, textAlign: "left" } : {}) }}>{g.name}</th>
                ))}
                <th style={{ ...thGroup, background: FT.navy }} />
              </tr>
              <tr>
                {cols.map((c, i) => (
                  <th key={c.k} scope="col" style={{ ...th, ...(c.left ? { textAlign: "left" } : {}), ...stickyStyle(i, 4) }}>
                    {c.label}{c.help && <HelpTip text={c.help} label={c.label} />}
                  </th>
                ))}
                <th style={th}><span className="sr-only">Détail</span></th>
              </tr>
            </thead>
            <tbody>
              {(d?.rows ?? []).map(safeRow).map((r, idx) => {
                const bg = idx % 2 ? "#F8FAFD" : FT.card;
                return (
                  <tr key={r.site_id} style={{ background: bg }}>
                    {cols.map((c, i) => (
                      <td key={c.k} title={c.k === "motif" ? r.stock.motif ?? "" : c.k === "action" ? r.stock.action : undefined}
                        style={{ ...td, background: bg, ...(c.left ? { textAlign: "left" } : {}), ...(i === 0 ? { minWidth: W1 } : i === 1 ? { minWidth: W2, maxWidth: W2, overflow: "hidden", textOverflow: "ellipsis" } : {}), ...(i === 2 ? { boxShadow: "2px 0 0 rgba(15,23,42,.06)" } : {}), ...stickyStyle(i, 1), ...(c.min ? { minWidth: c.min, maxWidth: c.min } : {}) }}>
                        {c.min ? <div style={{ ...clamp2, fontSize: 11.5 }}>{c.render(r)}</div> : c.render(r)}
                      </td>
                    ))}
                    <td style={{ ...td, background: bg }}>
                      <button type="button" onClick={() => setDetail({ row: r, tab: "hub" })} aria-label={`Voir le détail du site ${r.site_id}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 800, padding: "5px 9px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: "pointer" }}>
                        <Eye size={12} aria-hidden /> Voir le détail
                      </button>
                    </td>
                  </tr>
                );
              })}
              {d && d.rows.length === 0 && (
                <tr><td colSpan={cols.length + 1} style={{ ...td, textAlign: "left", padding: 24, color: FT.textMid }}>Aucun site ne correspond aux filtres pour cette période.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", fontSize: 12, color: FT.textMid }}>
          <span>{nf(d?.total ?? 0)} site(s) · page {page} / {totalPages}</span>
          <span style={{ display: "inline-flex", gap: 6 }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: page <= 1 ? "not-allowed" : "pointer" }}>Précédent</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: page >= totalPages ? "not-allowed" : "pointer" }}>Suivant</button>
          </span>
        </div>
      </div>
      )}

      {detail && per && detail.tab === "hub" && <DetailHub row={detail.row} periode={per.libelle} A={A} onClose={() => setDetail(null)} onPick={(tab) => setDetail({ row: detail.row, tab })} />}
      {detail && per && detail.tab === "stock" && detail.row.stock.bilan_id !== null && (
        <BalanceDetailModal id={detail.row.stock.bilan_id} onClose={() => setDetail({ row: detail.row, tab: "hub" })} />
      )}
      {detail && per && detail.tab === "cph" && (
        <SiteDetailModal siteId={detail.row.site_id} start={per.debut} end={per.fin} onClose={() => setDetail({ row: detail.row, tab: "hub" })} />
      )}
    </section>
  );
}

function DetailHub({ row: r, periode, A, onClose, onPick }: { row: ConsoRow; periode: string; A: Record<string, string>; onClose: () => void; onPick: (t: "stock" | "cph") => void }) {
  const line = (label: string, v: string, help?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: `1px solid ${FT.border}`, fontSize: 13 }}>
      <span style={{ color: FT.textMid }}>{label}{help && <HelpTip text={help} label={label} />}</span><strong style={mono}>{v}</strong>
    </div>
  );
  const g = (l: number | null, p: number | null, na: string | null) => (l === null ? "—" : `${signed(l)} L (${p === null ? na ?? "n/a" : `${signed(p, 1)} %`})`);
  const s = r.stock;
  return (
    <Modal title={`${r.site_id} — ${r.site_name ?? ""}`} onClose={onClose} maxWidth={680}>
      <div style={{ fontSize: 12, color: FT.textMid, marginBottom: 8 }}>Période : {periode} (identique pour toutes les mesures)</div>
      {line("Variation de stock (L)", s.variation_l === null ? "— (non calculable)" : `${nf(s.variation_l)} L`, A.variation)}
      {line("Statut du bilan", STATUT_META[s.statut].label)}
      {line("Consommation réelle certifiée (L)", r.certification.valeur_l === null ? "— (non certifiée)" : `${nf(r.certification.valeur_l)} L`, A.certifiee)}
      {line("Consommation Closing (L)", r.closing.conso_l === null ? "—" : `${nf(r.closing.conso_l)} L`, A.closing)}
      {line("Écart variation vs Closing", g(r.closing.ecart_l, r.closing.ecart_pct, r.closing.pct_na), A.ecart_closing)}
      {r.correspondance && !r.correspondance.utilise && <div role="note" style={{ margin: "6px 0", padding: 8, borderRadius: 8, background: FT.orangeL, fontSize: 12.5 }}>{r.correspondance.motif}</div>}
      {r.closing.explication && r.closing.explication.ecart_l !== null && (
        <div style={{ margin: "8px 0", padding: 10, borderRadius: 8, border: `1px solid ${FT.border}`, fontSize: 12.5 }}>
          <strong>Ce qui explique l'écart avec le Closing ({signed(r.closing.explication.ecart_l)} L)</strong>
          <ul style={{ margin: "6px 0 0 18px" }}>
            {r.closing.explication.items.map((it) => <li key={it.code + it.label}><strong>{it.label}</strong>{it.montant_l !== null && <> : <span style={mono}>{signed(it.montant_l)} L</span></>} — {it.detail}</li>)}
          </ul>
          <div style={{ marginTop: 6, color: FT.textMid }}>
            {r.closing.explication.quantifiable
              ? <>Expliqué : {signed(r.closing.explication.explique_l ?? 0)} L · résiduel non expliqué : {signed(r.closing.explication.residuel_l ?? 0)} L</>
              : "Décomposition chiffrée impossible : stocks ou mouvements du Closing non disponibles (aucune valeur inventée)."}
          </div>
        </div>
      )}
      {line("Target fuel période (L)", r.target.periode_l === null ? "—" : `${nf(r.target.periode_l)} L · ${TARGET_META[r.target.statut].label}`, A.target)}
      {line("Écart variation vs target", g(r.target.ecart_l, r.target.ecart_pct, r.target.pct_na), A.ecart_target)}
      {line("Consommation instrumentée Snowflake (L)", r.instrumentee.conso_l === null ? "—" : `${nf(r.instrumentee.conso_l)} L`, A.instrumentee)}
      {line("CPH complète (L)", r.cph.complete_l === null ? "—" : `${nf(r.cph.complete_l)} L`, A.cph_complete)}
      {line("CPH partielle (L)", r.cph.partielle_l === null ? "—" : `${nf(r.cph.partielle_l)} L (partielle)`, A.cph_partielle)}
      {s.reserves.length > 0 && <div style={{ marginTop: 8, fontSize: 12.5 }}><strong>Réserves :</strong><ul style={{ margin: "4px 0 0 18px" }}>{s.reserves.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      <div style={{ marginTop: 8, fontSize: 12.5 }}><strong>Motif :</strong> {s.motif ?? "—"}</div>
      <div style={{ marginTop: 4, fontSize: 12.5 }}><strong>Action attendue :</strong> {s.action}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" disabled={s.bilan_id === null} onClick={() => onPick("stock")} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.navy, color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: s.bilan_id === null ? "not-allowed" : "pointer", opacity: s.bilan_id === null ? 0.5 : 1 }}>Détail du bilan de stock et certification</button>
        <button type="button" onClick={() => onPick("cph")} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>Détail technique CPH (jour par jour)</button>
      </div>
    </Modal>
  );
}
