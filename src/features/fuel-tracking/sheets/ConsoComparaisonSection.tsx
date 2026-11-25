// « Suivis Consommations » — UN seul tableau, UNE période exacte (jours entiers 00:00:00 → 23:59:59), une ligne = un site.
// Cinq mesures distinctes : variation de stock · Closing · instrumentée Snowflake · CPH (complète / partielle) · consommation réelle certifiée (vide avant validation).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, Download, Eye, Layers, List, MapPin, RefreshCw, Tag, XCircle } from "lucide-react";
import {
  downloadConsoExport, getConsommations, getConsommationsPeriodes,
  type ConsoFilters, type ConsoFraicheur, type ConsoRow, type ConsoStatutBilan, type ConsoTargetStatut,
} from "@/services/fuelTracking";
import { Modal, Skeleton } from "../ui";
import { FT, type Tone } from "../theme";
import { HelpTip } from "./cphBadges";
import { CoverageKpis } from "./cphDiagnostics";
import { BalanceDetailModal } from "./StockPeriodBalance";
import { SectionTitle } from "./ConsoOverview";
import { KpiSynthese } from "./KpiSynthese";
import { OutputFormatTable } from "./OutputFormatTable";
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
  REFERENCE_CLOSING: { label: "Référence Closing", tone: "blue" },
  CONSOMMATION_REELLE_CERTIFIEE: { label: "Réelle certifiée", tone: "blue" },
};
const STATUT_PILL: Record<ConsoStatutBilan, { label: string; bg: string; fg: string; icon: typeof CheckCircle2 }> = {
  PRET_A_CERTIFIER: { label: "Bilan OK", bg: "#E4F7EC", fg: "#12805C", icon: CheckCircle2 },
  REFERENCE_CLOSING: { label: "Fichier Closing", bg: "#E5EEFF", fg: "#1D4ED8", icon: CheckCircle2 },
  CONSOMMATION_REELLE_CERTIFIEE: { label: "Certifié", bg: "#E5EEFF", fg: "#1D4ED8", icon: CheckCircle2 },
  ESTIMATION_AVEC_RESERVE: { label: "Avec réserve", bg: "#FFF1DD", fg: "#C2660A", icon: AlertTriangle },
  VARIATION_CALCULEE: { label: "À contrôler", bg: "#FDE8E8", fg: "#B42323", icon: XCircle },
  NON_CALCULABLE: { label: "Non calculable", bg: "#EEF1F6", fg: "#5B6B82", icon: XCircle },
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
    { k: "statut", group: "Identification", label: "Statut bilan", left: true, help: "NON_CALCULABLE · VARIATION_CALCULEE (calculée mais anomalie, ex. négative) · ESTIMATION_AVEC_RESERVE · PRET_A_CERTIFIER · REFERENCE_CLOSING (mois de référence : ligne du fichier Closing telle quelle) · CONSOMMATION_REELLE_CERTIFIEE (validée par le Fuel Manager).",
      render: (r) => <Pill label={STATUT_META[r.stock.statut].label} tone={STATUT_META[r.stock.statut].tone} /> },
    { k: "raison", group: "Identification", label: "Pourquoi non calculé", left: true, min: 280,
      render: (r) => (r.stock.raison_non_calcul ? <span style={{ color: r.stock.statut === "VARIATION_CALCULEE" ? "#B42323" : FT.text }}>{r.stock.raison_non_calcul}</span> : "—") },
    { k: "pays", group: "Identification", label: "Pays", left: true, render: (r) => r.country ?? "—" },
    { k: "zone", group: "Identification", label: "Zone", left: true, render: (r) => r.zone ?? "—" },
    { k: "typo", group: "Identification", label: "Typologie site", left: true, render: (r) => r.typologie ?? "—" },
    { k: "typoe", group: "Identification", label: "Typologie énergie", left: true, help: "Indoor/outdoor, grid/off-grid, solaire/non solaire, hybride (référentiel du site).", render: (r) => r.typologie_energie ?? "—" },
    { k: "ge", group: "Identification", label: "Modèle GE", left: true, render: (r) => r.modele_ge ?? "—" },
    { k: "kva", group: "Identification", label: "Puissance nominale GE (kVA)", render: (r) => num(r.puissance_nominale_kva, 0) },
    { k: "psrc", group: "Identification", label: "Source puissance GE", left: true, render: (r) => r.source_puissance ?? "—" },
    // Période
    // Dates EXACTES des relevés de stock retenus (celles du fichier), jamais les bornes du mois : le bilan va du relevé initial au relevé final.
    { k: "d1", group: "Période", label: "Date début", help: "Date du relevé de stock initial retenu (date du fichier de clôture), pas le 1er du mois.",
      render: (r) => (r.stock.date_initial ? r.stock.date_initial.split("-").reverse().join("/") : "—") },
    { k: "d2", group: "Période", label: "Date fin", help: "Date du relevé de stock final retenu (date du fichier de clôture), pas le dernier jour du mois.",
      render: (r) => (r.stock.date_final ? r.stock.date_final.split("-").reverse().join("/") : "—") },
    { k: "nj", group: "Période", label: "Jours", help: "Nombre de jours entre le relevé initial et le relevé final.", render: (r) => r.stock.jours ?? "—" },
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

const pagerBtn = (disabled: boolean): CSSProperties => ({
  padding: "5px 10px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
});

export function ConsoComparaisonSection({ extra, period }: { extra?: ReactNode; period?: { debut: string; fin: string } }) {
  const debut = period?.debut ?? "", fin = period?.fin ?? "";
  const [showQ, setShowQ] = useState(false);
  const [f, setF] = useState<ConsoFilters>({});
  const [site, setSite] = useState("");
  const [siteInput, setSiteInput] = useState("");
  // saisie libre : recherche lancée 300 ms après la dernière frappe (plus de calcul à chaque lettre)
  useEffect(() => {
    const t = setTimeout(() => { if (siteInput !== site) { setSite(siteInput); setPage(1); } }, 300);
    return () => clearTimeout(t);
  }, [siteInput]); // eslint-disable-line react-hooks/exhaustive-deps
  const [page, setPage] = useState(1);
  // 50 par page par défaut ; « Tous » = toute la liste en une seule page (borne serveur : 1000)
  const [pageSize, setPageSize] = useState(50);
  const tableTop = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [detail, setDetail] = useState<{ row: ConsoRow; tab: "hub" | "stock" | "cph" } | null>(null);
  const [more, setMore] = useState(false);
  const [adv, setAdv] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const params: ConsoFilters = { ...f, site: site || undefined, date_debut: debut || undefined, date_fin: fin || undefined, page, page_size: pageSize };
  const periods = useQuery({ queryKey: ["conso-periods"], queryFn: getConsommationsPeriodes, staleTime: 60_000 });
  // Une seule nouvelle tentative (plus de relances en boucle) ; tant que des valeurs FMS / ENOC sont lues en tâche de fond,
  // la page se relance seule toutes les 3 s (au plus 2 min) : les valeurs arrivent sans action ni écran bloqué.
  const pendingSince = useRef<number | null>(null);
  const q = useQuery({
    queryKey: ["consommations", params], queryFn: () => getConsommations(params), placeholderData: keepPreviousData,
    retry: 1, staleTime: 60_000,
    refetchInterval: (query) => {
      const n = query.state.data?.sources_en_attente ?? 0;
      if (!n) { pendingSince.current = null; return false; }
      pendingSince.current ??= Date.now();
      return Date.now() - pendingSince.current < 120_000 ? 3000 : false;
    },
  });
  useEffect(() => { setPage(1); }, [debut, fin]);
  const d = q.data;
  // Page suivante préchargée : le clic sur « Suivant » affiche ses sites sans attente.
  const nextParams: ConsoFilters = { ...params, page: page + 1 };
  const hasNext = !!d && page * pageSize < d.total && pageSize <= 100;   // pas de préchargement des grandes pages (charge serveur)
  useEffect(() => {
    if (hasNext) void qc.prefetchQuery({ queryKey: ["consommations", nextParams], queryFn: () => getConsommations(nextParams), staleTime: 60_000 });
  }, [hasNext, JSON.stringify(nextParams)]); // eslint-disable-line react-hooks/exhaustive-deps
  const goPage = (n: number) => { setPage(n); tableTop.current?.scrollIntoView({ block: "nearest" }); };
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
  const totalPages = d ? Math.max(1, Math.ceil(d.total / pageSize)) : 1;
  // Tant que la page demandée n'est pas arrivée, l'ancienne liste reste affichée : on le signale au lieu de la présenter comme la nouvelle page.
  const pageLoading = q.isFetching && (q.isPlaceholderData || (d?.page ?? page) !== page);
  const shownPage = d?.page ?? page;
  const first = d && d.total ? (shownPage - 1) * pageSize + 1 : 0;
  const last = d ? Math.min(d.total, (shownPage - 1) * pageSize + (d.rows?.length ?? 0)) : 0;
  const noBilan = !per || !per.bilan_disponible;
  const groups: Array<{ name: string; n: number }> = [];
  cols.forEach((c) => { const last = groups[groups.length - 1]; if (last && last.name === c.group) last.n += 1; else groups.push({ name: c.group, n: 1 }); });
  const stickyStyle = (i: number, z = 3): CSSProperties => (i < 3 ? { position: "sticky", left: STICKY[i], zIndex: z } : {});

  const alertCount = (d?.fraicheur && (d.fraicheur.perime || d.fraicheur.synchro_en_echec || d.fraicheur.periode_incomplete) ? 1 : 0) + ((d?.kpis.sans_correspondance?.sites ?? 0) > 0 ? 1 : 0);

  const cnt = d?.facettes.statuts_compte ?? {};
  const cntTotal = Object.values(cnt).reduce((t, n) => t + n, 0);
  const box: CSSProperties = { display: "flex", alignItems: "center", gap: 6, border: `1px solid ${FT.border}`, borderRadius: 9, padding: "6px 10px", background: FT.card };
  const selStyle: CSSProperties = { border: "none", outline: "none", fontSize: 13, fontWeight: 600, background: "transparent", color: FT.text };

  return (
    <section aria-label="Suivis Consommations" style={{ display: "grid", gap: 14 }}>
      {d?.detail && !per && <div role="alert" style={{ padding: 12, borderRadius: FT.radius, background: FT.orangeL, color: FT.orange, fontWeight: 700, fontSize: 13 }}>{d.detail}</div>}
      {per && noBilan && (
        <div role="alert" style={{ padding: 12, borderRadius: FT.radius, background: FT.orangeL, color: FT.text, fontSize: 13 }}>
          Aucun bilan de stock enregistré pour cette période ({per.libelle}). Choisissez un mois dans le sélecteur de période de l'en-tête.
        </div>
      )}
      {q.isError && (
        <div role="alert" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: 12, borderRadius: FT.radius, background: FT.redL, color: FT.red, fontWeight: 700, fontSize: 13 }}>
          {d ? "Le serveur n'a pas répondu à temps : la dernière liste chargée reste affichée." : "Impossible de charger les consommations (erreur serveur)."}
          <button type="button" onClick={() => void q.refetch()} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${FT.red}`, background: FT.card, color: FT.red, fontWeight: 700, cursor: "pointer" }}>Réessayer</button>
          {pageSize > 50 && <button type="button" onClick={() => { setPageSize(50); goPage(1); }} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, color: FT.text, fontWeight: 700, cursor: "pointer" }}>Revenir à 50 par page</button>}
        </div>
      )}

      {/* 1. Synthèse du mois : mêmes KPI que l'en-tête du fichier Closing, tous calculés par EnerTrack, valeurs cliquables. */}
      <KpiSynthese data={d?.kpis_closing} />

      {/* 2. Tableau de tous les sites, avec ses filtres */}
      <section aria-label="Sites" style={{ border: FT.borderCrisp, background: FT.card, borderRadius: 14, boxShadow: FT.shadow, overflow: "hidden" }}>
        <div style={{ padding: "10px 12px", display: "grid", gap: 8, borderBottom: `1px solid ${FT.border}` }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <label style={{ ...box, flex: "1 1 240px" }}>
              <MapPin size={14} color={FT.textSub} aria-hidden />
              <input aria-label="Rechercher un site" list="conso-sites" value={siteInput} placeholder="Rechercher un site (ID ou nom)"
                onChange={(e) => {
                  const v = e.target.value;
                  setSiteInput(v);
                  // site choisi dans la liste de suggestions : affiché tout de suite
                  if ((d?.facettes.sites ?? []).some((o) => o.id === v)) { setSite(v); setPage(1); }
                }}
                style={{ border: "none", outline: "none", fontSize: 13, width: "100%", background: "transparent" }} />
              <datalist id="conso-sites">
                {(d?.facettes.sites ?? []).map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
              </datalist>
              {siteInput && <button type="button" aria-label="Effacer la recherche" onClick={() => { setSiteInput(""); setSite(""); setPage(1); }}
                style={{ border: "none", background: "none", cursor: "pointer", color: FT.textSub, fontSize: 14 }}>×</button>}
            </label>
            <label style={box}>
              <CheckCircle2 size={14} color={FT.textSub} aria-hidden />
              <select aria-label="Statut du bilan" value={f.statut_bilan ?? ""} onChange={(e) => set("statut_bilan", e.target.value)} style={selStyle}>
                <option value="">Tous les statuts ({nf(cntTotal)})</option>
                {(d?.facettes.statuts_bilan ?? []).filter((o) => (cnt[o] ?? 0) > 0 || f.statut_bilan === o).map((o) => (
                  <option key={o} value={o}>{STATUT_PILL[o as ConsoStatutBilan]?.label ?? o} ({nf(cnt[o] ?? 0)})</option>
                ))}
              </select>
            </label>
            <label style={box}>
              <Tag size={14} color={FT.textSub} aria-hidden />
              <select aria-label="Typologie site" value={f.typologie ?? ""} onChange={(e) => set("typologie", e.target.value)} style={selStyle}>
                <option value="">Toutes typologies</option>{(d?.facettes.typologies ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <button type="button" aria-expanded={adv} onClick={() => setAdv((v) => !v)} style={{ fontSize: 12.5, fontWeight: 700, background: "none", border: "none", color: FT.blue, cursor: "pointer" }}>
              {adv ? "Masquer filtres et exports ▲" : "Filtres et exports ▼"}
            </button>
            <button type="button" aria-expanded={showQ} onClick={() => setShowQ((v) => !v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, padding: "6px 10px", borderRadius: 9, cursor: "pointer",
                border: `1px solid ${alertCount > 0 ? FT.orange : FT.border}`, background: alertCount > 0 ? FT.orangeL : FT.card, color: FT.text }}>
              <AlertTriangle size={14} aria-hidden color={alertCount > 0 ? FT.orange : FT.textSub} /> Qualité des données{alertCount > 0 ? ` (${alertCount})` : ""}
            </button>
          </div>
        {adv && (
          <div style={{ display: "grid", gap: 10, borderTop: `1px solid ${FT.border}`, paddingTop: 10 }}>
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
          {more ? "Moins de filtres ▲" : "Plus de filtres (pays, zone, typologie énergie, certification, sources, GE, qualité, tri) ▼"}
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
            {sel("fabricant_ge", "Fabriquant GE", d?.facettes.fabricants_ge, (o) => (o === "AUCUN" ? "n.d. (non renseigné)" : o))}
            {sel("type_ge", "Type de GE", d?.facettes.types_ge, (o) => (o === "AUCUN" ? "n.d. (non renseigné)" : o))}
            {sel("source_ge", "Source de donnée GE", d?.facettes.sources_ge, (o) => (o === "AUCUN" ? "n.d. (non renseigné)" : o))}
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
        )}
          {showQ && (
            <div style={{ display: "grid", gap: 10, borderTop: `1px solid ${FT.border}`, paddingTop: 10 }}>
              <DataQualityNotice f={d?.fraicheur} />
              <DataHealthPanel mois={per?.debut ? per.debut.slice(0, 7) : undefined} />
              {extra}
              {(d?.kpis.sans_correspondance?.sites ?? 0) > 0 && (
                <div role="note" style={{ padding: 10, borderRadius: FT.radius, background: FT.orangeL, fontSize: 12.5 }}>
                  {d!.kpis.sans_correspondance!.sites} site(s) hors périmètre de suivi (ni GE dans Snowflake, ni stock dans les fichiers) : affichés pour information, exclus des totaux et des indicateurs.
                </div>
              )}
            </div>
          )}
        </div>
      <div ref={tableTop}>
        {d?.avertissement_sources && <div role="note" style={{ padding: "6px 12px", fontSize: 12, background: FT.orangeL }}>{d.avertissement_sources}</div>}
        {!pageLoading && (d?.sources_en_attente ?? 0) > 0 && (
          <div role="status" style={{ padding: "6px 12px", fontSize: 12, fontWeight: 700, background: FT.blueL, color: FT.text }}>
            Lecture des valeurs Fuel Sensor FMS et relevés de gardien ENOC pour {d!.sources_en_attente} site(s)… elles s'affichent automatiquement (cases « n.d. » en attendant).
          </div>
        )}
        {pageLoading && (
          <div role="status" style={{ padding: "6px 12px", fontSize: 12, fontWeight: 700, background: FT.blueL, color: FT.text }}>
            Chargement {pageSize >= 1000 ? "de tous les sites" : `de la page ${page} (${pageSize} sites)`}…
          </div>
        )}
        <div style={{ opacity: pageLoading ? 0.45 : 1, transition: "opacity .15s", pointerEvents: pageLoading ? "none" : undefined }} aria-busy={pageLoading}>
          <OutputFormatTable rows={(d?.rows ?? []).map(safeRow)} onDetail={(r) => setDetail({ row: r, tab: "hub" })} totaux={d?.totaux} nbSites={d?.total} />
        </div>
        <nav aria-label="Pagination des sites" style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center", padding: "8px 12px", fontSize: 12, color: FT.textMid }}>
          <span>
            {d && d.total > 0 ? <>Sites <strong>{nf(first)}–{nf(last)}</strong> sur <strong>{nf(d.total)}</strong></> : `${nf(d?.total ?? 0)} site(s)`}
            {pageSize < 1000 && <> · page {shownPage} / {totalPages}</>}
          </span>
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <label style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
              Afficher
              <select aria-label="Nombre de sites par page" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); goPage(1); }}
                style={{ fontSize: 12, padding: "4px 6px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, color: FT.text }}>
                {[50, 100, 200].map((n) => <option key={n} value={n}>{n} par page</option>)}
                <option value={1000}>Tous les sites</option>
              </select>
            </label>
            {pageSize < 1000 && totalPages > 1 && (<>
              {([["«", 1, "Première page"], ["Précédent", page - 1, "Page précédente"]] as const).map(([t, n, a]) => (
                <button key={t} type="button" aria-label={a} disabled={page <= 1} onClick={() => goPage(n)} style={pagerBtn(page <= 1)}>{t}</button>
              ))}
              <label style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                Page
                <select aria-label="Aller à la page" value={page} onChange={(e) => goPage(Number(e.target.value))}
                  style={{ fontSize: 12, padding: "4px 6px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, color: FT.text }}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              {([["Suivant", page + 1, "Page suivante"], ["»", totalPages, "Dernière page"]] as const).map(([t, n, a]) => (
                <button key={t} type="button" aria-label={a} disabled={page >= totalPages} onClick={() => goPage(n)} style={pagerBtn(page >= totalPages)}>{t}</button>
              ))}
            </>)}
          </span>
        </nav>
      </div>
      </section>

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
      {s.raison_non_calcul && <div role="note" style={{ margin: "6px 0", padding: 8, borderRadius: 8, background: s.statut === "VARIATION_CALCULEE" ? FT.redL : FT.orangeL, fontSize: 12.5 }}><strong>Pourquoi non calculé : </strong>{s.raison_non_calcul}</div>}
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
