// « Suivis Consommations » — UN seul tableau métier, UNE période exacte (jours entiers 00:00:00 → 23:59:59).
// Une ligne = un site : consommation réelle stock · instrumentée Snowflake · théorique CPH, écarts, statut global, motif, action.
// Les détails techniques CPH (runtime, puissance, courbe, jour par jour) restent dans « Contrôle CPH » et le bouton « Voir le détail ».
import { useState, type CSSProperties } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, Eye } from "lucide-react";
import {
  downloadConsoExport, getConsommations, getConsommationsPeriodes,
  type ConsoFilters, type ConsoFraicheur, type ConsoGap, type ConsoGlobalStatus, type ConsoRealStatus, type ConsoRow,
} from "@/services/fuelTracking";
import { KpiCard, Modal, Skeleton } from "../ui";
import { FT, type Tone } from "../theme";
import { HelpTip } from "./cphBadges";
import { CoverageKpis } from "./cphDiagnostics";
import { BalanceDetailModal } from "./StockPeriodBalance";
import { SiteDetailModal } from "./ControleCphSheet";

const nf = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "—" : v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const signed = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${nf(v, d)}`);
const mono: CSSProperties = { fontVariantNumeric: "tabular-nums" };

const HELP = {
  reel: "Consommation obtenue à partir du bilan physique des stocks et mouvements validés. Une donnée absente reste vide, jamais 0.",
  instr: "Consommation déduite des capteurs / niveaux de cuve Snowflake. Ce n'est PAS la consommation réelle certifiée.",
  theo: "Estimation à partir du runtime GE qualifié, de la puissance qualifiée et de la courbe CPH. Vide si l'un des trois manque.",
  livraison: "Livraison externe (L) : carburant livré par un camion / fournisseur sur la période (source ENOC Truck ou Closing).",
  total: "Carte Total (L) : carburant acheté par carte Total et versé dans la cuve.",
  transfert: "Transfert entrant / sortant (L) : carburant échangé avec un autre site (Ponction). Impact global nul sur le réseau.",
  reserve: "Estimation avec réserve : valeur calculée mais comportant une source ou une conversion non certifiée.",
  nc: "Non calculable : prérequis insuffisants, aucune valeur n'est affichée.",
  ecartI: "Instrumentée − réelle. Positif : le capteur voit plus de consommation que le bilan de stock.",
  ecartT: "Théorique CPH − réelle. Positif : le CPH attend plus de consommation que le bilan de stock.",
};

const REAL_META: Record<ConsoRealStatus, { label: string; tone: Tone }> = {
  CERTIFIABLE: { label: "Certifiable", tone: "green" },
  ESTIMATION_AVEC_RESERVE: { label: "Estimation avec réserve", tone: "orange" },
  A_CONTROLER: { label: "À contrôler", tone: "red" },
  DONNEES_INCOMPLETES: { label: "Données incomplètes", tone: "orange" },
  NON_CALCULABLE: { label: "Non calculable", tone: "slate" },
};
const GLOBAL_META: Record<ConsoGlobalStatus, { label: string; tone: Tone }> = {
  COHERENT: { label: "Cohérent", tone: "green" },
  A_JUSTIFIER: { label: "À justifier", tone: "orange" },
  A_INVESTIGUER: { label: "À investiguer", tone: "red" },
  ESTIMATION_AVEC_RESERVE: { label: "Estimation avec réserve", tone: "orange" },
  DONNEES_INCOMPLETES: { label: "Données incomplètes", tone: "slate" },
  CPH_NON_CALCULE: { label: "CPH non calculé", tone: "slate" },
  MESURE_INSTRUMENTEE_ABSENTE: { label: "Mesure instrumentée absente", tone: "slate" },
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

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function GapCell({ g }: { g: ConsoGap }) {
  if (g.l === null) return <span style={{ color: FT.textSub }}>—</span>;
  const color = g.statut === "A_INVESTIGUER" ? FT.red : g.statut === "A_JUSTIFIER" ? FT.orange : FT.text;
  return <span style={{ color, fontWeight: 700, ...mono }}>{signed(g.l)}</span>;
}
function GapPct({ g }: { g: ConsoGap }) {
  if (g.l === null) return <span style={{ color: FT.textSub }}>—</span>;
  if (g.pct === null) return <span title="Pourcentage non applicable : référence trop faible" style={{ color: FT.textMid, fontSize: 11 }}>{g.pct_na ?? "n/a"}</span>;
  return <span style={mono}>{signed(g.pct, 1)} %</span>;
}

const th: CSSProperties = { padding: "8px 10px", fontSize: 10.5, fontWeight: 800, color: FT.text, textTransform: "uppercase", letterSpacing: ".03em", background: FT.slateL, borderBottom: `1px solid ${FT.border}`, textAlign: "right", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2 };
const td: CSSProperties = { padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${FT.border}`, textAlign: "right", whiteSpace: "nowrap", background: FT.card };
const left: CSSProperties = { textAlign: "left" };
// Colonnes figées : Site ID · Nom du site · Statut global (restent visibles au défilement horizontal).
const W1 = 110, W2 = 190;
const stick = (leftPx: number, extra: CSSProperties = {}): CSSProperties => ({ position: "sticky", left: leftPx, zIndex: 3, ...extra });

const COLS: Array<{ k: string; label: string; help?: string }> = [
  { k: "site", label: "Site ID" }, { k: "name", label: "Nom du site" }, { k: "global", label: "Statut global" },
  { k: "pays", label: "Pays" }, { k: "zone", label: "Zone" }, { k: "typo", label: "Typologie site" }, { k: "conf", label: "Configuration énergétique" },
  { k: "reel", label: "Consommation réelle stock (L)", help: HELP.reel }, { k: "qual", label: "Statut / qualité conso réelle", help: `${HELP.reserve} ${HELP.nc}` },
  { k: "src", label: "Source conso réelle" },
  { k: "instr", label: "Consommation instrumentée Snowflake (L)", help: HELP.instr }, { k: "instrdisp", label: "Disponibilité instrumentée" },
  { k: "theo", label: "Consommation théorique CPH (L)", help: HELP.theo }, { k: "theodisp", label: "Disponibilité CPH" },
  { k: "ei", label: "Écart réel vs instrumentée (L)", help: HELP.ecartI }, { k: "eip", label: "Écart réel vs instrumentée (%)" },
  { k: "et", label: "Écart réel vs théorique (L)", help: HELP.ecartT }, { k: "etp", label: "Écart réel vs théorique (%)" },
  { k: "motif", label: "Motif" }, { k: "action", label: "Action attendue" }, { k: "detail", label: "" },
];

function DataQualityNotice({ f }: { f: ConsoFraicheur | undefined }) {
  if (!f || (!f.perime && !f.periode_incomplete && !f.synchro_en_echec)) return null;
  const fr = (d: string) => d.split("-").reverse().join("/");
  const lines: string[] = [];
  if (f.snowflake_derniere_date === null) lines.push("Aucune donnée Snowflake synchronisée : consommation instrumentée et théorique indisponibles.");
  else if (f.perime) lines.push(`Données Snowflake à jour jusqu'au ${fr(f.snowflake_derniere_date)} (${f.age_jours} j de retard, seuil ${f.seuil_jours} j).`);
  if (f.periode_incomplete && f.snowflake_derniere_date) lines.push(`${f.jours_non_couverts} jour(s) de la période ne sont pas couverts : l'instrumentée et la théorique ne portent que sur les jours disponibles (la consommation réelle stock n'est pas concernée).`);
  if (f.synchro_en_echec) lines.push(`Dernière synchronisation Snowflake en échec${f.erreur_synchro ? ` : ${f.erreur_synchro}` : ""}.`);
  return (
    <div role="status" style={{ padding: "9px 14px", borderRadius: FT.radius, background: FT.orangeL, border: "1px solid rgba(217,119,6,.3)", color: FT.text, fontSize: 12.5, display: "grid", gap: 2 }}>
      <strong style={{ color: FT.orange }}>Qualité des données Snowflake</strong>
      {lines.map((l) => <span key={l}>{l}</span>)}
    </div>
  );
}

function Disp({ pct, ok, jours, total }: { pct: number | null; ok: boolean; jours: number | null; total: number }) {
  if (pct === null) return <span style={{ color: FT.textSub }}>—</span>;
  return <span title={`${jours ?? 0} / ${total} jours`} style={{ color: ok ? FT.text : FT.orange, ...mono }}>{nf(pct, 0)} %</span>;
}

export function ConsoComparaisonSection() {
  const [debut, setDebut] = useState<string>("");
  const [fin, setFin] = useState<string>("");
  const [f, setF] = useState<ConsoFilters>({});
  const [site, setSite] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<{ row: ConsoRow; tab: "hub" | "stock" | "cph" } | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const params: ConsoFilters = { ...f, site: site || undefined, date_debut: debut || undefined, date_fin: fin || undefined, page, page_size: 50 };
  const periods = useQuery({ queryKey: ["conso-periods"], queryFn: getConsommationsPeriodes, staleTime: 60_000 });
  const q = useQuery({ queryKey: ["consommations", params], queryFn: () => getConsommations(params), placeholderData: keepPreviousData });
  const d = q.data;
  const per = d?.periode ?? null;
  const set = (k: keyof ConsoFilters, v: string) => { setF((o) => ({ ...o, [k]: v || undefined })); setPage(1); };

  const exportCsv = async (kind: "controle_complet" | "anomalies_fuel" | "bilan_certification") => {
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
  const k = d?.kpis;
  const totalPages = d ? Math.max(1, Math.ceil(d.total / d.page_size)) : 1;
  const noBilan = !per || !per.bilan_disponible;

  return (
    <section aria-label="Suivis Consommations" style={{ display: "grid", gap: 14 }}>
      <div style={{ border: FT.borderCrisp, background: FT.card, borderRadius: FT.radius, boxShadow: FT.shadow, padding: "12px 14px", display: "grid", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: FT.textSub, textTransform: "uppercase" }}>Période exacte (commune aux trois consommations)</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: FT.text, ...mono }}>{per?.libelle ?? "—"}{per?.par_defaut ? <span style={{ marginLeft: 8, fontSize: 11, color: FT.textMid, fontWeight: 600 }}>(dernière période complète avec bilan)</span> : null}</div>
          </div>
          <label style={{ display: "grid", gap: 3, fontSize: 10.5, fontWeight: 800, color: FT.textSub, textTransform: "uppercase" }}>
            Périodes avec bilan
            <select aria-label="Périodes avec bilan" value="" onChange={(e) => { const p = periods.data?.periodes[Number(e.target.value)]; if (p) { setDebut(p.debut); setFin(p.fin); setPage(1); } }} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, color: FT.text, fontWeight: 600 }}>
              <option value="">Choisir…</option>
              {(periods.data?.periodes ?? []).map((p, i) => <option key={`${p.debut}-${p.fin}`} value={i}>{p.libelle} — {p.calculables}/{p.sites} calculables</option>)}
            </select>
          </label>
          {dateIn("Date début", debut || per?.debut || "", setDebut)}
          {dateIn("Date fin", fin || per?.fin || "", setFin)}
          <button type="button" onClick={() => { const t = new Date(); const e = new Date(t.getFullYear(), t.getMonth(), 0); setDebut(iso(new Date(e.getFullYear(), e.getMonth(), 1))); setFin(iso(e)); setPage(1); }} style={{ fontSize: 12, fontWeight: 700, padding: "7px 10px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: "pointer" }}>Mois précédent</button>
          <button type="button" onClick={() => { setDebut(""); setFin(""); setPage(1); }} style={{ fontSize: 12, fontWeight: 700, padding: "7px 10px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: "pointer" }}>Période par défaut</button>
        </div>
        {per && <div style={{ fontSize: 11.5, color: FT.textMid }}>{per.sites_calculables.toLocaleString("fr-FR")} site(s) à consommation réelle calculable sur {per.sites_avec_bilan.toLocaleString("fr-FR")} bilans — {per.jours} jour(s).</div>}
      </div>

      {d?.detail && !per && <div role="alert" style={{ padding: 12, borderRadius: FT.radius, background: FT.orangeL, color: FT.orange, fontWeight: 700, fontSize: 13 }}>{d.detail}</div>}
      {per && noBilan && (
        <div role="alert" style={{ padding: 12, borderRadius: FT.radius, background: FT.orangeL, color: FT.text, fontSize: 13 }}>
          Aucun bilan de stock enregistré pour cette période exacte ({per.libelle}). Les consommations instrumentée et théorique sont affichées sans comparaison ; choisissez une période de la liste « Périodes avec bilan ».
        </div>
      )}
      <DataQualityNotice f={d?.fraicheur} />
      {q.isError && <div role="alert" style={{ padding: 12, borderRadius: FT.radius, background: FT.redL, color: FT.red, fontWeight: 700, fontSize: 13 }}>Impossible de charger les consommations (erreur serveur).</div>}

      {k && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10 }}>
          <KpiCard tone="green" label="Consommation réelle stock (L)" value={k.reel.total_l === null ? "—" : `${nf(k.reel.total_l)} L`}
            sub={`${nf(k.reel.sites_calculables)} sites calculables · ${nf(k.reel.sites_certifiables)} certifiables · ${nf(k.reel.sites_avec_reserve)} avec réserve`} />
          <KpiCard tone="blue" label="Consommation instrumentée Snowflake (L)" value={k.instrumentee.total_l === null ? "—" : `${nf(k.instrumentee.total_l)} L`}
            sub={`${nf(k.instrumentee.sites_couverts)} sites couverts · mesure capteur, non certifiée réelle`} />
          <KpiCard tone="violet" label="Consommation théorique CPH (L)" value={k.theorique.total_l === null ? "—" : `${nf(k.theorique.total_l)} L`}
            sub={`${nf(k.theorique.sites_complets)} complets · ${nf(k.theorique.sites_partiels)} partiels · estimation`} />
          <KpiCard tone="orange" label="Écart réel vs instrumentée" value={k.ecart_instrumentee.ecart_l === null ? "—" : `${signed(k.ecart_instrumentee.ecart_l)} L`}
            sub={`${k.ecart_instrumentee.ecart_pct === null ? "% n/a" : `${signed(k.ecart_instrumentee.ecart_pct, 1)} %`} · ${nf(k.ecart_instrumentee.sites_comparables)} sites comparables`} />
          <KpiCard tone="orange" label="Écart réel vs théorique" value={k.ecart_theorique.ecart_l === null ? "—" : `${signed(k.ecart_theorique.ecart_l)} L`}
            sub={`${k.ecart_theorique.ecart_pct === null ? "% n/a" : `${signed(k.ecart_theorique.ecart_pct, 1)} %`} · ${nf(k.ecart_theorique.sites_comparables)} sites comparables`} />
          <KpiCard tone="red" label="Sites à traiter" value={nf(k.a_traiter.sites_non_calculables)}
            sub={`${nf(k.a_traiter.sites_donnees_incompletes)} incomplets/non calculables · ${nf(k.a_traiter.conflits_enoc_closing)} conflits · ${nf(k.a_traiter.sites_avec_reserve)} réserves`} />
        </div>
      )}

      <div style={{ border: FT.borderCrisp, background: FT.card, borderRadius: FT.radius, boxShadow: FT.shadow, padding: "12px 14px", display: "grid", gap: 10 }}>
        <div role="group" aria-label="Vues rapides" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {([["Tous", {}], ["Certifiables", { qualite_reel: "CERTIFIABLE" }], ["Avec réserve", { qualite_reel: "ESTIMATION_AVEC_RESERVE" }], ["À contrôler", { qualite_reel: "A_CONTROLER" }], ["Non calculables", { qualite_reel: "NON_CALCULABLE" }], ["À investiguer", { statut_global: "A_INVESTIGUER" }]] as Array<[string, Partial<ConsoFilters>]>).map(([label, patch]) => {
            const active = Object.keys(patch).length === 0 ? !f.qualite_reel && !f.statut_global : Object.entries(patch).every(([key, v]) => (f as Record<string, unknown>)[key] === v);
            return (
              <button key={label} type="button" aria-pressed={active} onClick={() => { setF((o) => ({ ...o, qualite_reel: undefined, statut_global: undefined, ...patch })); setPage(1); }}
                style={{ fontSize: 12, fontWeight: 800, padding: "6px 12px", borderRadius: 999, border: `1px solid ${active ? FT.navy : FT.border}`, background: active ? FT.navy : FT.card, color: active ? "#fff" : FT.text, cursor: "pointer" }}>{label}</button>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {sel("pays", "Pays", d?.facettes.pays)}
          {sel("zone", "Zone", d?.facettes.zones)}
          <label style={{ display: "grid", gap: 3, fontSize: 10.5, fontWeight: 800, color: FT.textSub, textTransform: "uppercase" }}>
            Site / nom
            <input value={site} onChange={(e) => { setSite(e.target.value); setPage(1); }} placeholder="ID ou nom" style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: `1px solid ${FT.border}` }} />
          </label>
          {sel("statut_global", "Statut global", d?.facettes.statuts_globaux, (o) => GLOBAL_META[o as ConsoGlobalStatus]?.label ?? o)}
        </div>
        <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)} style={{ justifySelf: "start", fontSize: 12, fontWeight: 800, background: "none", border: "none", color: FT.blue, cursor: "pointer", padding: 0 }}>
          {more ? "Moins de filtres ▲" : "Plus de filtres (typologie, configuration, sources, statut CPH, tri) ▼"}
        </button>
        {more && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {sel("typologie", "Typologie", d?.facettes.typologies)}
            {sel("configuration", "Configuration énergétique", d?.facettes.configurations)}
            {sel("qualite_reel", "Qualité conso réelle", d?.facettes.qualites_reel, (o) => REAL_META[o as ConsoRealStatus]?.label ?? o)}
            {sel("source_runtime", "Source runtime", d?.facettes.sources_runtime)}
            {sel("source_puissance", "Source puissance", d?.facettes.sources_puissance)}
            {sel("statut_cph", "Statut CPH", d?.facettes.statuts_cph)}
            {sel("tri", "Tri", ["gravite", "reel", "ecart"], (o) => (o === "gravite" ? "Gravité" : o === "reel" ? "Consommation réelle" : "Plus gros écart"))}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {([["controle_complet", "Contrôle complet"], ["anomalies_fuel", "Anomalies Fuel"], ["bilan_certification", "Bilan certification"]] as const).map(([kind, label]) => (
            <button key={kind} type="button" disabled={busy !== null || noBilan} onClick={() => exportCsv(kind)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, padding: "7px 12px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: busy || noBilan ? "not-allowed" : "pointer", opacity: busy || noBilan ? 0.6 : 1 }}>
              <Download size={13} aria-hidden /> {busy === kind ? "Export…" : label}
            </button>
          ))}
          {msg && <span role="status" style={{ fontSize: 12, color: FT.textMid }}>{msg}</span>}
        </div>
      </div>

      <div style={{ border: FT.borderCrisp, background: FT.card, borderRadius: FT.radius, boxShadow: FT.shadow, overflow: "hidden" }}>
        <div style={{ overflow: "auto", maxHeight: "70vh" }} tabIndex={0} aria-label="Tableau des consommations par site">
          <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: 2400, width: "100%" }}>
            <thead>
              <tr>
                {COLS.map((c, i) => (
                  <th key={c.k} scope="col" style={{ ...th, ...(i < 2 ? left : {}), ...(i === 0 ? stick(0, { zIndex: 4 }) : i === 1 ? stick(W1, { zIndex: 4 }) : i === 2 ? stick(W1 + W2, { zIndex: 4, ...left }) : {}) }}>
                    {c.label}{c.help && <HelpTip text={c.help} label={c.label} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d?.rows ?? []).map((r) => {
                const rm = REAL_META[r.reel.statut]; const gm = GLOBAL_META[r.statut_global];
                return (
                  <tr key={r.site_id}>
                    <td style={{ ...td, ...left, ...stick(0), fontWeight: 800, minWidth: W1 }}>{r.site_id}</td>
                    <td style={{ ...td, ...left, ...stick(W1), minWidth: W2, maxWidth: W2, overflow: "hidden", textOverflow: "ellipsis" }} title={r.site_name ?? ""}>{r.site_name ?? "—"}</td>
                    <td style={{ ...td, ...left, ...stick(W1 + W2), boxShadow: "2px 0 0 rgba(15,23,42,.06)" }}><Pill label={gm.label} tone={gm.tone} /></td>
                    <td style={{ ...td, ...left }}>{r.country ?? "—"}</td>
                    <td style={{ ...td, ...left }}>{r.zone ?? "—"}</td>
                    <td style={{ ...td, ...left }}>{r.typologie ?? "—"}</td>
                    <td style={{ ...td, ...left }}>{r.configuration ?? "—"}</td>
                    <td style={{ ...td, fontWeight: 800, ...mono }}>{r.reel.conso_l === null ? <span style={{ color: FT.textSub }} title={HELP.nc}>—</span> : nf(r.reel.conso_l)}</td>
                    <td style={{ ...td, ...left }} title={r.reel.reserves[0] ?? ""}><Pill label={rm.label} tone={rm.tone} /></td>
                    <td style={{ ...td, ...left, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }} title={r.reel.source ?? ""}>{r.reel.source ?? "—"}</td>
                    <td style={{ ...td, ...mono }}>{r.instrumentee.conso_l === null ? <span style={{ color: FT.textSub }}>—</span> : nf(r.instrumentee.conso_l)}</td>
                    <td style={td}><Disp pct={r.instrumentee.couverture_pct} ok={r.instrumentee.disponible} jours={r.instrumentee.jours_mesure} total={r.instrumentee.jours} /></td>
                    <td style={{ ...td, ...mono }}>{r.theorique.conso_l === null ? <span style={{ color: FT.textSub }} title={r.theorique.partielle_l !== null ? "CPH partiel : aucun total affiché" : ""}>—</span> : nf(r.theorique.conso_l)}</td>
                    <td style={td}><Disp pct={r.theorique.couverture_pct} ok={r.theorique.disponible} jours={r.theorique.jours_cph} total={r.instrumentee.jours} /></td>
                    <td style={td}><GapCell g={r.ecart_instrumentee} /></td>
                    <td style={td}><GapPct g={r.ecart_instrumentee} /></td>
                    <td style={td}><GapCell g={r.ecart_theorique} /></td>
                    <td style={td}><GapPct g={r.ecart_theorique} /></td>
                    <td style={{ ...td, ...left, whiteSpace: "normal", minWidth: 280, fontSize: 11.5 }}>{r.motif ?? "—"}</td>
                    <td style={{ ...td, ...left, whiteSpace: "normal", minWidth: 280, fontSize: 11.5 }}>{r.action}</td>
                    <td style={td}>
                      <button type="button" onClick={() => setDetail({ row: r, tab: "hub" })} aria-label={`Voir le détail du site ${r.site_id}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 800, padding: "5px 9px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: "pointer" }}>
                        <Eye size={12} aria-hidden /> Voir le détail
                      </button>

                    </td>
                  </tr>
                );
              })}
              {d && d.rows.length === 0 && (
                <tr><td colSpan={COLS.length} style={{ ...td, ...left, padding: 24, color: FT.textMid }}>Aucun site ne correspond aux filtres pour cette période.</td></tr>
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

      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: FT.text, textTransform: "uppercase", letterSpacing: ".04em", margin: "4px 0 8px" }}>Qualité du calcul CPH</div>
        <CoverageKpis items={d?.qualite_cph} />
      </div>

      {detail && per && detail.tab === "hub" && <DetailHub row={detail.row} periode={per.libelle} onClose={() => setDetail(null)} onPick={(tab) => setDetail({ row: detail.row, tab })} />}
      {detail && per && detail.tab === "stock" && detail.row.reel.bilan_id !== null && (
        <BalanceDetailModal id={detail.row.reel.bilan_id} onClose={() => setDetail({ row: detail.row, tab: "hub" })} />
      )}
      {detail && per && detail.tab === "cph" && (
        <SiteDetailModal siteId={detail.row.site_id} start={per.debut} end={per.fin} onClose={() => setDetail({ row: detail.row, tab: "hub" })} />
      )}
    </section>
  );
}

function DetailHub({ row: r, periode, onClose, onPick }: { row: ConsoRow; periode: string; onClose: () => void; onPick: (t: "stock" | "cph") => void }) {
  const line = (label: string, v: string, help?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: `1px solid ${FT.border}`, fontSize: 13 }}>
      <span style={{ color: FT.textMid }}>{label}{help && <HelpTip text={help} label={label} />}</span><strong style={mono}>{v}</strong>
    </div>
  );
  const gap = (g: ConsoGap) => (g.l === null ? "—" : `${signed(g.l)} L (${g.pct === null ? g.pct_na ?? "n/a" : `${signed(g.pct, 1)} %`})`);
  return (
    <Modal title={`${r.site_id} — ${r.site_name ?? ""}`} onClose={onClose} maxWidth={640}>
      <div style={{ fontSize: 12, color: FT.textMid, marginBottom: 8 }}>Période : {periode} (identique pour les trois consommations)</div>
      {line("Consommation réelle stock (L)", r.reel.conso_l === null ? "— (non calculable)" : `${nf(r.reel.conso_l)} L`, HELP.reel)}
      {line("Qualité de la consommation réelle", REAL_META[r.reel.statut].label)}
      {line("Source", r.reel.source ?? "—")}
      {line("Consommation instrumentée Snowflake (L)", r.instrumentee.conso_l === null ? "—" : `${nf(r.instrumentee.conso_l)} L`, HELP.instr)}
      {line("Consommation théorique CPH (L)", r.theorique.conso_l === null ? "—" : `${nf(r.theorique.conso_l)} L`, HELP.theo)}
      {line("Écart réel vs instrumentée", gap(r.ecart_instrumentee), HELP.ecartI)}
      {line("Écart réel vs théorique", gap(r.ecart_theorique), HELP.ecartT)}
      {line("Statut global", GLOBAL_META[r.statut_global].label)}
      {r.reel.reserves.length > 0 && <div style={{ marginTop: 8, fontSize: 12.5 }}><strong>Réserves :</strong><ul style={{ margin: "4px 0 0 18px" }}>{r.reel.reserves.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      <div style={{ marginTop: 8, fontSize: 12.5 }}><strong>Motif :</strong> {r.motif ?? "—"}</div>
      <div style={{ marginTop: 4, fontSize: 12.5 }}><strong>Action attendue :</strong> {r.action}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" disabled={r.reel.bilan_id === null} onClick={() => onPick("stock")} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.navy, color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: r.reel.bilan_id === null ? "not-allowed" : "pointer", opacity: r.reel.bilan_id === null ? 0.5 : 1 }}>Détail du bilan de stock (composantes, sources)</button>
        <button type="button" onClick={() => onPick("cph")} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>Détail technique CPH (jour par jour)</button>
      </div>
    </Modal>
  );
}
