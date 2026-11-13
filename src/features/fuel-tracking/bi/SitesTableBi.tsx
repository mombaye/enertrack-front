// Données par site (un mois), en deux parties :
//  - vue « conso » (Suivi Conso)  : conso mesurée et conso estimée CPH (jamais additionnées), écart, activité GE, comparaisons ;
//  - vue « stock » (Suivi Stock)  : stock retenu (relevé le plus récent, toutes sources), autonomie, livraisons.
// Pagination et tri côté serveur ; export Excel de toutes les lignes.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { downloadBiExport, getSiteTable, type SiteTableAlerte, type SiteTableRow } from "@/services/fuelTracking";
import { Card } from "../ui";
import { FT } from "../theme";
import { BiKpi, FilterBar, FilterSelect, KpiRow, SiteCell, StateBox, blocId, fDays, fDec1, fL, fNum, fPct, fRatio, fSignedPct } from "./kit";
import { monthLabel } from "../helpers";

const TITLES = { conso: "Consommation par site", stock: "Stock par site" } as const;
type Vue = keyof typeof TITLES;
const PAGE_SIZE = 50;
type Group = "ge" | "conso" | "comp" | "stock" | "liv";
const GROUPS: Record<Vue, Array<[Group, string]>> = {
  conso: [["conso", "Conso"], ["ge", "Activité GE"], ["comp", "Comparaisons"]],
  stock: [["stock", "Stock"], ["liv", "Livraisons"]],
};
type Col = { key: string; label: string; group: Group | "site"; sort?: string; render: (r: SiteTableRow) => ReactNode; title?: string };

const muted = (t: ReactNode) => <span style={{ color: FT.textSub }}>{t}</span>;
const signed = (v: number | null, bad: number) => v == null ? "—" : <span style={{ color: Math.abs(v) > bad ? FT.red : FT.text, fontWeight: Math.abs(v) > bad ? 600 : 400 }}>{fSignedPct(v)}</span>;
const fDate = (iso: string | null) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "—");

export function SitesTableBi({ toMonth, vue, zone }: { toMonth: string | null; vue: Vue; zone: string }) {
  const TITLE = TITLES[vue];
  const [alerte, setAlerte] = useState("");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(vue === "stock" ? "autonomie_j" : "nb_alertes");
  const [desc, setDesc] = useState(vue !== "stock");
  const [page, setPage] = useState(1);
  const [hidden, setHidden] = useState<Group[]>([]);
  useEffect(() => { const t = setTimeout(() => { setQ(text.trim()); setPage(1); }, 250); return () => clearTimeout(t); }, [text]);
  useEffect(() => { setPage(1); }, [zone]);

  const params = { vue, month: toMonth ?? undefined, zone, q, alerte, sort, desc: desc ? "1" : "0", page: String(page), page_size: String(PAGE_SIZE) };
  const r = useQuery({
    queryKey: ["fuel-bi-sites-table", params],
    queryFn: () => getSiteTable(params),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const d = r.data;
  const k = d?.kpis;
  const x = d?.explain;
  const alertLabels = d?.filters.alertes;
  const s = d?.seuils;
  const pages = d ? Math.max(1, Math.ceil(d.total / (d.page_size || PAGE_SIZE))) : 1;

  const cols: Col[] = [
    { key: "site", label: "Site", group: "site", sort: "site_id", render: (r) => (
      <span style={{ display: "block", maxWidth: 230 }}>
        <SiteCell id={r.site_id} name={r.site_name} />
        <span style={{ display: "block", fontSize: 11, color: FT.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {[r.zone, r.configuration, r.energie, r.ge_kva != null ? `${fDec1(r.ge_kva)} kVA` : null].filter(Boolean).join(" · ") || "—"}
        </span>
      </span>) },
    { key: "mes", label: "Conso mesurée", group: "conso", sort: "conso_mesuree_l", render: (r) => r.conso_mesuree_l == null ? "—" : <><b style={{ fontWeight: 600 }}>{fL(r.conso_mesuree_l)}</b><br />{muted(`${fDec1(r.l_jour)} L/j · ${r.jours_mesures ?? 0} j`)}</> },
    { key: "est", label: "Conso estimée (CPH)", group: "conso", sort: "conso_estimee_l", render: (r) => r.conso_estimee_l == null ? <span title={r.motif_cph ?? undefined}>{muted("—")}</span> : fL(r.conso_estimee_l) },
    { key: "ecart", label: "Écart mesuré / estimé", group: "conso", sort: "ecart_pct", render: (r) => r.ecart_pct == null ? "—" : <>{signed(r.ecart_pct, s?.ecart_pct ?? 20)}<br />{muted(`${r.ecart_l! > 0 ? "+" : ""}${fL(r.ecart_l)}`)}</> },
    { key: "lkwh", label: "L/kWh", group: "conso", sort: "l_kwh", render: (r) => r.l_kwh == null ? "—" : <span style={{ color: s && r.l_kwh > s.l_kwh ? FT.red : FT.text }}>{fRatio(r.l_kwh)}</span> },
    { key: "rt", label: "Running time", group: "ge", sort: "runtime_h", render: (r) => r.runtime_h == null ? "—" : <>{fNum(r.runtime_h)} h<br />{muted(`${fDec1(r.h_jour)} h/j`)}</> },
    { key: "cph", label: "CPH", group: "ge", sort: "cph_l_h", title: "Consommation horaire du GE (L/h)", render: (r) => r.cph_l_h == null ? <span title={r.motif_cph ?? undefined}>{muted("—")}</span> : `${fRatio(r.cph_l_h)} L/h` },
    { key: "charge", label: "Charge", group: "ge", sort: "charge_pct", render: (r) => r.charge_pct == null ? "—" : <><span style={{ color: s && r.charge_pct < s.sous_charge_pct ? "#9A6200" : FT.text }}>{fPct(r.charge_pct)}</span><br />{muted(r.ge_prod_kwh != null ? `${fNum(r.ge_prod_kwh)} kWh` : "")}</> },
    { key: "evo", label: "vs mois préc.", group: "comp", sort: "evolution_pct", title: "Évolution de la conso mesurée par jour", render: (r) => r.evolution_pct == null ? "—" : <>{fSignedPct(r.evolution_pct)}<br />{muted(fL(r.conso_prec_l))}</> },
    { key: "tgt", label: "vs target", group: "comp", sort: "ecart_target_pct", render: (r) => r.ecart_target_pct == null ? "—" : <>{signed(r.ecart_target_pct, s?.tolerance_target_pct ?? 10)}<br />{muted(fL(r.target_l))}</> },
    { key: "stock", label: "Stock", group: "stock", sort: "stock_l", render: (r) => r.stock_l == null ? "—" : <>{fL(r.stock_l)}{r.stock_estime && <span style={{ marginLeft: 4, fontSize: 10.5, color: "#9A6200" }}>estimé</span>}<br />{muted(`${r.source_stock ?? ""} · ${fDate(r.date_stock)}${r.remplissage_pct != null ? ` · ${fPct(r.remplissage_pct)}` : ""}`)}</> },
    { key: "ljs", label: "Conso / jour", group: "stock", sort: "l_jour", title: "Conso mesurée moyenne par jour du mois", render: (r) => r.l_jour == null ? "—" : `${fDec1(r.l_jour)} L/j` },
    { key: "auto", label: "Autonomie", group: "stock", sort: "autonomie_j", render: (r) => r.autonomie_j == null ? "—" : <span style={{ color: r.autonomie_j < 3 ? FT.red : FT.text, fontWeight: r.autonomie_j < 3 ? 600 : 400 }}>{fDays(r.autonomie_j)}</span> },
    { key: "enoc", label: "Livré ENOC", group: "liv", sort: "enoc_livre_l", render: (r) => r.enoc_livre_l == null ? "—" : <>{fL(r.enoc_livre_l)}<br />{muted(`${r.nb_livraisons} livraison${r.nb_livraisons > 1 ? "s" : ""}`)}</> },
    { key: "al", label: "Alertes", group: "site", sort: "nb_alertes", render: (r) => r.alertes.length === 0 ? muted("—") : (
      <span style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {r.alertes.map((a) => <span key={a} style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 4, background: "#FDECEC", color: "#A42B2B", whiteSpace: "nowrap" }}>{alertLabels?.[a] ?? a}</span>)}
      </span>) },
  ];
  const groups = GROUPS[vue];
  const shown = cols.filter((c) => c.group === "site" || (groups.some(([g]) => g === c.group) && !hidden.includes(c.group)));
  const sortBy = (key?: string) => {
    if (!key) return;
    if (key === sort) setDesc(!desc); else { setSort(key); setDesc(key !== "site_id" && key !== "zone"); }
    setPage(1);
  };
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const th: CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 11.5, fontWeight: 600, color: FT.textMid, borderBottom: `1px solid #E4E9F0`, whiteSpace: "nowrap", background: "#F7F9FC", position: "sticky", top: 0, zIndex: 1 };
  const td: CSSProperties = { padding: "7px 10px", fontSize: 12.5, borderBottom: `1px solid #EEF1F5`, verticalAlign: "top", fontVariantNumeric: "tabular-nums", lineHeight: 1.4 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FilterBar
        note={d?.month ? `Sénégal · sites GE · ${monthLabel(d.month)}${d.cph_disponible === false ? " · moteur CPH indisponible : conso estimée absente" : ""}` : undefined}
        onExport={() => downloadBiExport("sites", { ...params, page: undefined, page_size: undefined }, `${vue === "stock" ? "stock" : "conso"}_par_site_${d?.month ?? ""}.xlsx`)}
      >
        <FilterSelect label="Alerte" value={alerte} options={Object.keys(alertLabels ?? {})} onChange={reset(setAlerte)} allLabel="Toutes"
          format={(o) => alertLabels?.[o as SiteTableAlerte] ?? o} />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: FT.textMid }}>
          Site
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="identifiant ou nom" aria-label="Filtrer les sites"
            style={{ border: "1px solid #CBD3DF", borderRadius: 4, padding: "5px 8px", fontSize: 12.5, width: 150 }} />
        </label>
      </FilterBar>

      {r.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Chargement impossible. Réessayez avec le bouton Rafraîchir.</div>}

      {vue === "conso" && (
    <KpiRow>
          <BiKpi label="Conso estimée (CPH)" detail={TITLE} detailLabel="Voir par site" value={fNum(k?.conso_estimee_l)} unit="L" explain={x?.conso_estimee_l}
            sub={k ? `running time × CPH · ${fNum(k.nb_sites_estime)} sites` : undefined} />
          <BiKpi label="Écart mesuré / estimé" detail={TITLE} detailLabel="Voir les sites en écart" value={k?.ecart_pct == null ? "—" : fSignedPct(k.ecart_pct)} explain={x?.ecart_pct}
            alert={k && k.nb_ecart_cph ? "warn" : null} sub={k ? `${fNum(k.nb_sites_comparables)} sites comparables · ${fNum(k.nb_ecart_cph)} au-delà de ${s?.ecart_pct ?? 20} %` : undefined} />
          <BiKpi label="Running time GE" detail={TITLE} detailLabel="Voir par site" value={fNum(k?.runtime_total_h)} unit="h" explain={x?.runtime_total_h}
            sub={k?.h_site_jour != null ? `${fDec1(k.h_site_jour)} h par site et par jour` : undefined} />
          <BiKpi label="CPH moyen" detail={TITLE} detailLabel="Voir par site" value={k?.cph_moyen_l_h == null ? "—" : fRatio(k.cph_moyen_l_h)} unit="L/h" explain={x?.cph_moyen_l_h}
            sub="pondéré par les heures de marche" />
          <BiKpi label="Sites en alerte" detail={TITLE} detailLabel="Voir les sites" value={fNum(k?.nb_sites_alerte)} explain={x?.nb_sites_alerte}
            alert={k?.nb_sites_alerte ? "bad" : null} sub={k ? `sur ${fNum(k.nb_sites)} sites GE` : undefined} />
        </KpiRow>
      )}

      <Card id={blocId(TITLE)} style={{ padding: 0, borderRadius: 6, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", flexWrap: "wrap", borderBottom: "1px solid #E4E9F0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: FT.text }}>{TITLE}</div>
          <div style={{ fontSize: 12, color: FT.textSub }}>{d ? `${fNum(d.total)} sites · trié par ${cols.find((c) => c.sort === sort)?.label.toLowerCase() ?? sort}` : ""}</div>
          <div role="group" aria-label="Colonnes affichées" style={{ marginLeft: "auto", display: "flex", gap: 4, flexWrap: "wrap" }}>
            {groups.length > 1 && groups.map(([g, label]) => {
              const on = !hidden.includes(g);
              return (
                <button key={g} type="button" aria-pressed={on} onClick={() => setHidden(on ? [...hidden, g] : hidden.filter((h) => h !== g))}
                  style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 4, cursor: "pointer", border: `1px solid ${on ? "#123C8C" : "#CBD3DF"}`, background: on ? "#EEF3FB" : "#fff", color: on ? "#123C8C" : FT.textSub }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ overflow: "auto", maxHeight: 640 }}>
          {r.isLoading ? <StateBox height={240} text="Chargement…" />
            : r.isError ? <StateBox height={160} tone="red" text="Données indisponibles (erreur de chargement)." />
            : !d?.rows.length ? <StateBox height={160} text="Aucun site pour ce mois et ces filtres." />
            : (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900, opacity: r.isFetching ? 0.6 : 1 }}>
                <thead>
                  <tr>
                    {shown.map((c, i) => (
                      <th key={c.key} scope="col" title={c.title} aria-sort={c.sort === sort ? (desc ? "descending" : "ascending") : undefined}
                        style={{ ...th, ...(i === 0 ? { left: 0, zIndex: 2 } : null), textAlign: c.group === "site" ? "left" : "right" }}>
                        {c.sort ? (
                          <button type="button" onClick={() => sortBy(c.sort)} style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
                            {c.label}{c.sort === sort && (desc ? <ChevronDown size={12} aria-hidden /> : <ChevronUp size={12} aria-hidden />)}
                          </button>
                        ) : c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((row, ri) => (
                    <tr key={row.site_id} style={{ background: ri % 2 ? "#FAFBFD" : "#fff" }}>
                      {shown.map((c, i) => (
                        <td key={c.key} style={{ ...td, textAlign: c.group === "site" ? "left" : "right", ...(i === 0 ? { position: "sticky", left: 0, background: ri % 2 ? "#FAFBFD" : "#fff", zIndex: 0 } : null), ...(c.key === "al" ? { minWidth: 150 } : null) }}>
                          {c.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
        {d && d.total > (d.page_size || PAGE_SIZE) && (
          <nav aria-label="Pages" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "10px 14px", fontSize: 12.5, color: FT.textMid }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} style={pagerBtn(page <= 1)}>Précédent</button>
            <span>Page {page} / {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} style={pagerBtn(page >= pages)}>Suivant</button>
          </nav>
        )}
      </Card>
    </div>
  );
}

const pagerBtn = (off: boolean): CSSProperties => ({ border: "1px solid #CBD3DF", background: "#fff", borderRadius: 4, padding: "4px 10px", fontSize: 12.5, cursor: off ? "default" : "pointer", opacity: off ? 0.5 : 1 });
