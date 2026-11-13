// Tableau unique de Suivi Conso : un site par ligne, sur la même période et les mêmes filtres que les 4 KPIs.
//  - les 4 mesures (variation de stock, Closing, Snowflake, CPH complète) : mêmes chiffres que les KPIs (tableau « Consommations ») ;
//  - activité GE et stock actuel : tableau « par site » du mois de fin (L/kWh, stock, autonomie, alertes).
// Pas de colonnes d'écart entre mesures. Une valeur absente reste « — » (jamais 0).
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { downloadConsoExport, getConsommations, getSiteTable, type ConsoRow, type ConsoStatutBilan, type SiteTableRow } from "@/services/fuelTracking";
import { Card } from "../ui";
import { FT } from "../theme";
import { monthLabel } from "../helpers";
import { safeRow } from "../sheets/ConsoComparaisonSection";
import { ExportButton, SiteCell, StateBox, blocId, fDays, fDec1, fL, fNum, fPct, fRatio } from "./kit";

export const CONSO_TABLE_TITLE = "Consommation par site";
const PAGE_SIZE = 50;

const BILAN: Record<ConsoStatutBilan, { label: string; bg: string; fg: string }> = {
  PRET_A_CERTIFIER: { label: "Bilan OK", bg: "#E4F7EC", fg: "#12805C" },
  CONSOMMATION_REELLE_CERTIFIEE: { label: "Certifié", bg: "#E5EEFF", fg: "#1D4ED8" },
  ESTIMATION_AVEC_RESERVE: { label: "Avec réserve", bg: "#FFF1DD", fg: "#C2660A" },
  VARIATION_CALCULEE: { label: "À contrôler", bg: "#FDE8E8", fg: "#B42323" },
  NON_CALCULABLE: { label: "Non calculable", bg: "#EEF1F6", fg: "#5B6B82" },
};
const ALERTES: Record<string, string> = {
  ECART_CPH: "Écart CPH", L_KWH_HAUT: "L/kWh élevé", AU_DESSUS_TARGET: "Au-dessus du target",
  SOUS_CHARGE: "GE sous-chargé", AUTONOMIE_3J: "Autonomie < 3 j", RELEVE_ANCIEN: "Relevé ancien",
};

type Group = "mesures" | "ge" | "stock";
const GROUPS: Array<[Group, string]> = [["mesures", "Les 4 mesures"], ["ge", "Activité GE"], ["stock", "Stock et alertes"]];
type Col = { key: string; label: string; group: Group | "site"; title?: string; render: (r: ConsoRow, s: SiteTableRow | undefined) => ReactNode };

const muted = (t: ReactNode) => <span style={{ color: FT.textSub }}>{t}</span>;

export function ConsoSitesBi({ period, zone, typology, site, onSingleSite }: {
  /** Période exacte (mêmes dates que les 4 KPIs) et mois de fin (activité GE, stock). */
  period: { debut: string; fin: string; label: string; month: string; multiMonth: boolean };
  zone: string; typology: string; site: string;
  /** Site unique correspondant à la recherche (les KPIs passent alors sur ce site), sinon null. */
  onSingleSite: (siteId: string | null) => void;
}) {
  const [tri, setTri] = useState("site");
  const [page, setPage] = useState(1);
  const [hidden, setHidden] = useState<Group[]>([]);
  useEffect(() => { setPage(1); }, [period.debut, period.fin, zone, typology, site, tri]);

  const params = {
    perimetre: "senegal", date_debut: period.debut, date_fin: period.fin, zone: zone || undefined, site: site || undefined,
    typology: typology || undefined, tri, page, page_size: PAGE_SIZE,
  };
  const q = useQuery({ queryKey: ["conso-sites-unique", params], queryFn: () => getConsommations(params), placeholderData: keepPreviousData });
  const d = q.data;
  // Blocs absents dans une réponse : valeurs vides, jamais de plantage ni de 0 inventé.
  const rows = (d?.rows ?? []).map(safeRow);
  const ids = rows.map((r) => r.site_id);
  // Colonnes « activité GE / stock » : uniquement les sites de la page affichée, mois de fin de période.
  const extra = useQuery({
    queryKey: ["conso-sites-unique-extra", period.month, ids.join(",")],
    queryFn: () => getSiteTable({ vue: "conso", month: period.month, sites: ids.join(","), page_size: "200" }),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
  const byId = new Map((extra.data?.rows ?? []).map((r) => [r.site_id.toUpperCase(), r]));

  const single = site && d && d.total === 1 ? rows[0]?.site_id ?? null : null;
  useEffect(() => { onSingleSite(single); }, [single, onSingleSite]);

  const m = period.multiMonth ? ` · ${monthLabel(period.month)}` : "";
  const cols: Col[] = [
    { key: "site", label: "Site", group: "site", render: (r) => (
      <span style={{ display: "block", maxWidth: 230 }}>
        <SiteCell id={r.site_id} name={r.site_name} />
        <span style={{ display: "block", fontSize: 11, color: FT.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {[r.zone, r.typologie, r.puissance_nominale_kva != null ? `${fDec1(r.puissance_nominale_kva)} kVA` : null].filter(Boolean).join(" · ") || "—"}
        </span>
        {r.correspondance && !r.correspondance.utilise && <span title={r.correspondance.motif ?? ""} style={{ fontSize: 10.5, color: "#9A6200" }}>hors fichier Closing</span>}
      </span>) },
    { key: "bilan", label: "Bilan", group: "site", render: (r) => {
      const b = BILAN[r.stock.statut];
      return b ? <span title={r.stock.motif ?? undefined} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, background: b.bg, color: b.fg, fontWeight: 600, whiteSpace: "nowrap" }}>{b.label}</span> : "—";
    } },
    { key: "var", label: "Variation de stock", group: "mesures", title: "Stock début + entrées − stock fin", render: (r) => r.stock.variation_l == null ? "—" : <>
      <b style={{ fontWeight: 600, color: r.stock.variation_l < 0 ? FT.red : FT.text }}>{fL(r.stock.variation_l)}</b><br />
      {r.stock.initial_l != null || r.stock.final_l != null ? muted(`${fNum(r.stock.initial_l)} → ${fNum(r.stock.final_l)} L`) : null}</> },
    { key: "clo", label: "Consommation Closing", group: "mesures", render: (r) => fL(r.closing.conso_l) },
    { key: "sf", label: "Consommation Snowflake", group: "mesures", title: "Capteur de niveau (VW_FUEL_REPORT)", render: (r) => r.instrumentee.conso_l == null ? "—" : <>
      {fL(r.instrumentee.conso_l)}<br />{muted(`${r.instrumentee.jours_mesure} / ${r.instrumentee.jours} j mesurés`)}</> },
    { key: "cph", label: "Conso estimée (CPH)", group: "mesures", title: "CPH × heures de marche. Seule la CPH complète entre dans le KPI « CPH complète ».",
      render: (r) => r.cph.complete_l != null ? <>{fL(r.cph.complete_l)}<br />{muted("complète")}</>
        : r.cph.partielle_l != null ? <>{fL(r.cph.partielle_l)}<br /><span style={{ fontSize: 11, color: "#9A6200" }}>partielle, non comptée</span></> : "—" },
    { key: "rt", label: "Running time", group: "ge", render: (r) => r.cph.runtime_h == null ? "—" : <>{fNum(r.cph.runtime_h)} h<br />
      {muted(r.periode.jours ? `${fDec1(r.cph.runtime_h / r.periode.jours)} h/j` : "")}</> },
    { key: "cphl", label: "CPH", group: "ge", title: "Consommation horaire du GE (L/h)", render: (r) => r.cph.cph_l_h == null ? "—" : `${fRatio(r.cph.cph_l_h)} L/h` },
    { key: "charge", label: "Charge", group: "ge", render: (r) => fPct(r.cph.charge_pct) },
    { key: "lkwh", label: `L/kWh${m}`, group: "ge", title: "Litres mesurés ÷ kWh produits (sites ≥ 100 kWh)", render: (_r, s) => s?.l_kwh == null ? "—" : fRatio(s.l_kwh) },
    { key: "stock", label: "Stock actuel", group: "stock", render: (_r, s) => s?.stock_l == null ? "—" : <>{fL(s.stock_l)}<br />
      {muted(s.date_stock ? new Date(s.date_stock + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "")}</> },
    { key: "auto", label: "Autonomie", group: "stock", render: (_r, s) => s?.autonomie_j == null ? "—"
      : <span style={{ color: s.autonomie_j < 3 ? FT.red : FT.text, fontWeight: s.autonomie_j < 3 ? 600 : 400 }}>{fDays(s.autonomie_j)}</span> },
    { key: "al", label: `Alertes${m}`, group: "stock", render: (_r, s) => !s?.alertes.length ? muted("—") : (
      <span style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {s.alertes.map((a) => <span key={a} style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 4, background: "#FDECEC", color: "#A42B2B", whiteSpace: "nowrap" }}>{ALERTES[a] ?? a}</span>)}
      </span>) },
  ];
  const shown = cols.filter((c) => c.group === "site" || !hidden.includes(c.group));
  const pages = d ? Math.max(1, Math.ceil(d.total / (d.page_size || PAGE_SIZE))) : 1;
  const th: CSSProperties = { padding: "8px 10px", fontSize: 11.5, fontWeight: 600, color: FT.textMid, borderBottom: "1px solid #E4E9F0", whiteSpace: "nowrap", background: "#F7F9FC", position: "sticky", top: 0, zIndex: 1 };
  const td: CSSProperties = { padding: "7px 10px", fontSize: 12.5, borderBottom: "1px solid #EEF1F5", verticalAlign: "top", fontVariantNumeric: "tabular-nums", lineHeight: 1.4 };

  return (
    <Card id={blocId(CONSO_TABLE_TITLE)} style={{ padding: 0, borderRadius: 6, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", flexWrap: "wrap", borderBottom: "1px solid #E4E9F0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: FT.text }}>{CONSO_TABLE_TITLE}</div>
        <div style={{ fontSize: 12, color: FT.textSub }}>{d ? `${fNum(d.total)} sites · ${period.label}` : period.label}</div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: FT.textMid }}>
          Trier par
          <select value={tri} onChange={(e) => setTri(e.target.value)} style={{ border: "1px solid #CBD3DF", borderRadius: 4, padding: "3px 6px", fontSize: 12 }}>
            <option value="site">Site</option>
            <option value="variation">Variation de stock</option>
            <option value="gravite">Bilan à contrôler d'abord</option>
          </select>
        </label>
        <div role="group" aria-label="Colonnes affichées" style={{ marginLeft: "auto", display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {GROUPS.map(([g, label]) => {
            const on = !hidden.includes(g);
            return (
              <button key={g} type="button" aria-pressed={on} onClick={() => setHidden(on ? [...hidden, g] : hidden.filter((h) => h !== g))}
                style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 4, cursor: "pointer", border: `1px solid ${on ? "#123C8C" : "#CBD3DF"}`, background: on ? "#EEF3FB" : "#fff", color: on ? "#123C8C" : FT.textSub }}>
                {label}
              </button>
            );
          })}
          <ExportButton onExport={async () => { await downloadConsoExport("controle_complet", { ...params, page: undefined, page_size: undefined }); }} />
        </div>
      </div>
      {period.multiMonth && (
        <div style={{ padding: "6px 14px", fontSize: 11.5, color: FT.textSub, borderBottom: "1px solid #EEF1F5" }}>
          Les 4 mesures, le running time, le CPH et la charge portent sur {period.label} ; L/kWh, stock, autonomie et alertes sur {monthLabel(period.month)}.
        </div>
      )}
      <div style={{ overflow: "auto", maxHeight: 640 }}>
        {q.isLoading ? <StateBox height={240} text="Chargement…" />
          : q.isError ? <StateBox height={160} tone="red" text="Données indisponibles (erreur de chargement)." />
          : !rows.length ? <StateBox height={160} text="Aucun site pour cette période et ces filtres." />
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000, opacity: q.isFetching ? 0.6 : 1 }}>
              <thead>
                <tr>
                  {shown.map((c, i) => (
                    <th key={c.key} scope="col" title={c.title} style={{ ...th, ...(i === 0 ? { left: 0, zIndex: 2 } : null), textAlign: c.group === "site" ? "left" : "right" }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const s = byId.get(row.site_id.toUpperCase());
                  const bg = ri % 2 ? "#FAFBFD" : "#fff";
                  return (
                    <tr key={row.site_id} style={{ background: bg }}>
                      {shown.map((c, i) => (
                        <td key={c.key} style={{ ...td, textAlign: c.group === "site" ? "left" : "right", ...(i === 0 ? { position: "sticky", left: 0, background: bg } : null), ...(c.key === "al" ? { minWidth: 150 } : null) }}>
                          {c.render(row, s)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>
      {extra.isError && <div role="alert" style={{ padding: "6px 14px", fontSize: 12, color: FT.red }}>L/kWh, stock, autonomie et alertes indisponibles pour le moment ; les autres colonnes restent valables.</div>}
      {d && d.total > (d.page_size || PAGE_SIZE) && (
        <nav aria-label="Pages" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "10px 14px", fontSize: 12.5, color: FT.textMid }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} style={pagerBtn(page <= 1)}>Précédent</button>
          <span>Page {page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} style={pagerBtn(page >= pages)}>Suivant</button>
        </nav>
      )}
    </Card>
  );
}

const pagerBtn = (off: boolean): CSSProperties => ({ border: "1px solid #CBD3DF", background: "#fff", borderRadius: 4, padding: "4px 10px", fontSize: 12.5, cursor: off ? "default" : "pointer", opacity: off ? 0.5 : 1 });
