// src/features/fuel-tracking/sheets/StockMvpViews.tsx
// MVP Suivi carburant (onglet Stock) : Relevés de stock, Cuves à traiter, Priorités de fiabilisation, Analyse de fichier.
// Règle d'affichage : valeur absente = « — » (jamais 0) ; litres estimés toujours séparés des litres directs / calculés.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSearch, ListOrdered, Search, Table2, Warehouse } from "lucide-react";
import {
  analyzeStockFile,
  getPriorities,
  getStockReadings,
  getTanksToProcess,
  type FileAnalysis,
  type StockReadingsParams,
  type TankToProcessRow,
} from "@/services/fuelTracking";
import { Card, EmptyState, Pager, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { Dash, fmtDateTime, IMPORT_SOURCE_LABEL, inputStyle, Num, SOURCE_LABEL, tdStyle, thStyle } from "./stockRegistryUi";

const cell: CSSProperties = { ...tdStyle, textAlign: "left", whiteSpace: "normal", verticalAlign: "top", padding: "8px 10px" };

const QUALITY_LABEL: Record<string, string> = {
  LITRE_DIRECT: "Litre direct", CM_CONVERTI_CUVE_VALIDEE: "cm converti (cuve validée)",
  CM_CONVERTI_CUVE_GEOMETRIQUE_RESERVE: "cm estimé (cuve géométrique sans plaque)", CM_CONVERTI_CUVE_PROPOSEE_RESERVE: "cm estimé (cuve proposée)",
  CM_SANS_CUVE: "cm sans cuve (aucun litre)", SITE_NON_RECONNU: "Site non reconnu", UNITE_INCONNUE: "Unité inconnue",
  VALEUR_INVALIDE: "Valeur invalide", DOUBLON_POTENTIEL: "Doublon potentiel",
};
const qualityColor = (q: string | null) =>
  !q ? FT.textSub : q === "LITRE_DIRECT" || q === "CM_CONVERTI_CUVE_VALIDEE" ? FT.green : q.endsWith("_RESERVE") ? FT.orange : FT.red;

const TANK_CAT: Record<string, string> = {
  VALIDEE: "Validée", PROPOSEE: "Proposée", SANS_PLAQUE: "Sans plaque", INCOHERENTE: "Plaque incohérente", GEOMETRIE_ABSENTE: "Géométrie absente",
};
const USAGE_LABEL: Record<string, { label: string; color: string }> = {
  CONVERSION_CERTIFIABLE: { label: "Conversion certifiable", color: FT.green },
  ESTIMATION_GEOMETRIQUE: { label: "Estimation géométrique (réserve)", color: FT.orange },
  ESTIMATION_GEOMETRIQUE_DESACTIVEE: { label: "Estimation géométrique désactivée (paramètre)", color: FT.red },
  ESTIMATION_CUVE_PROPOSEE: { label: "Estimation cuve proposée (réserve)", color: FT.orange },
  AUCUN_LITRE: { label: "Aucun litre calculé", color: FT.red },
};

function Chip({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
            style={{ border: `1px solid ${active ? FT.navy : FT.border}`, background: active ? FT.slateL : "#fff", borderRadius: 999, padding: "4px 11px",
                     fontSize: 12, fontWeight: 800, cursor: "pointer", color: FT.text }}>
      {label}{count !== undefined ? ` (${count.toLocaleString("fr-FR")})` : ""}
    </button>
  );
}

function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

// ── Relevés de stock ─────────────────────────────────────────────────────────────────────────────────
export function StockReadings() {
  const [p, setP] = useState<StockReadingsParams>({ page: 1, limit: 50 });
  const [search, setSearch] = useState("");
  const site = useDebounced(search);
  const params = { ...p, site: site || undefined };
  const rejected = p.vue === "rejetes";
  const q = useQuery({ queryKey: ["stock-readings", params], queryFn: () => getStockReadings(params), placeholderData: (x) => x });
  const d = q.data;
  const set = (patch: Partial<StockReadingsParams>) => setP((x) => ({ ...x, ...patch, page: 1 }));

  return (
    <Card padded={false} style={{ padding: 18 }}>
      <SheetTitle icon={<Table2 size={17} />} title="Relevés de stock"
        subtitle="Mesures brutes conservées. Litres directs, calculés (cuve validée) et ESTIMÉS (cuve sans plaque / proposée) sont toujours distingués ; un cm sans cuve ne donne aucun litre." />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "0 10px", height: 32, minWidth: 200 }}>
          <Search size={14} color={FT.textSub} aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Site…" aria-label="Rechercher un site"
                 style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, flex: 1 }} />
        </div>
        <select aria-label="Source" value={p.source ?? ""} onChange={(e) => set({ source: e.target.value || undefined })} style={inputStyle}>
          <option value="">Source : toutes</option>
          {Object.keys(d?.totaux_source ?? {}).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s] ?? s}</option>)}
        </select>
        <select aria-label="Unité" value={p.unite ?? ""} onChange={(e) => set({ unite: e.target.value || undefined })} style={inputStyle}>
          <option value="">Unité : toutes</option><option value="L">Litres</option><option value="CM">cm</option>
        </select>
        <select aria-label="Confiance" value={p.confiance ?? ""} onChange={(e) => set({ confiance: e.target.value || undefined })} style={inputStyle}>
          <option value="">Confiance : toutes</option><option value="HAUTE">Haute</option><option value="MOYENNE">Moyenne</option><option value="FAIBLE">Faible</option>
        </select>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Du <input type="date" value={p.debut ?? ""} onChange={(e) => set({ debut: e.target.value || undefined })} style={inputStyle} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>au <input type="date" value={p.fin ?? ""} onChange={(e) => set({ fin: e.target.value || undefined })} style={inputStyle} /></label>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <Chip active={!rejected && !p.qualite && !p.estimes} label="Tous" onClick={() => setP((x) => ({ ...x, vue: undefined, qualite: undefined, estimes: false, page: 1 }))} />
        {Object.entries(QUALITY_LABEL).filter(([k]) => !["SITE_NON_RECONNU", "UNITE_INCONNUE", "VALEUR_INVALIDE"].includes(k)).map(([k, l]) => (
          <Chip key={k} active={!rejected && p.qualite === k} label={l} count={d?.totaux_qualite?.[k]}
                onClick={() => setP((x) => ({ ...x, vue: undefined, qualite: x.qualite === k ? undefined : k, page: 1 }))} />
        ))}
        <Chip active={rejected} label="Lignes rejetées (site / unité / valeur)" onClick={() => setP((x) => ({ ...x, vue: rejected ? undefined : "rejetes", qualite: undefined, page: 1 }))} />
      </div>

      {q.isLoading && <Skeleton h={300} />}
      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Relevés indisponibles (serveur API à mettre à jour ou erreur de chargement).</div>}
      {d && d.data.length === 0 && <EmptyState icon={<Table2 size={20} />} title="Aucun relevé pour ces filtres" />}
      {d && d.data.length > 0 && (
        <>
          <div style={{ overflow: "auto", maxHeight: 600, borderRadius: 12, border: `1px solid ${FT.border}`, opacity: q.isFetching ? 0.7 : 1 }}>
            {rejected ? (
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
                <thead><tr>{["Lot", "Feuille / ligne", "Site (brut)", "Motif de rejet", "Détail"].map((h) => <th key={h} scope="col" style={{ ...thStyle, textAlign: "left" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {d.data.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 ? FT.cardAlt : "#fff" }}>
                      <td style={cell}>#{r.lot}</td>
                      <td style={cell}>{r.feuille ?? "—"} · ligne {r.ligne}</td>
                      <td style={cell}>{r.site_brut ?? <Dash reason="Site absent" />}</td>
                      <td style={{ ...cell, color: FT.red, fontWeight: 800 }}>{d.libelles[r.qualite] ?? r.qualite}</td>
                      <td style={cell}>{r.motif || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1500 }}>
                <thead>
                  <tr>{["Date", "Site", "Source", "Brut", "Litres directs", "Litres calculés", "Litres estimés", "Cuve", "Confiance", "Qualité du relevé", "Statut", "Lot"].map((h) =>
                    <th key={h} scope="col" style={{ ...thStyle, textAlign: "left" }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {d.data.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 ? FT.cardAlt : "#fff" }}>
                      <td style={cell}>{fmtDateTime(r.date, true)}</td>
                      <td style={cell}><b>{r.site_id}</b><div style={{ fontSize: 11, color: FT.textSub }}>{[r.site_name, r.zone].filter(Boolean).join(" · ")}</div></td>
                      <td style={cell}>{SOURCE_LABEL[r.source] ?? r.source}</td>
                      <td style={cell}>{r.niveau_brut ?? "—"}</td>
                      <td style={cell}><Num value={r.litres_directs} unit="L" reason="Relevé non fourni en litres" /></td>
                      <td style={cell}><Num value={r.litres_calcules} unit="L" reason={r.unite === "CM" ? "Aucune conversion certifiable" : "Relevé en litres"} /></td>
                      <td style={cell}>
                        {r.litres_estimes !== null
                          ? <><b style={{ color: FT.orange, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.litres_estimes.toLocaleString("fr-FR")} L</b><div style={{ fontSize: 10, fontWeight: 800, color: FT.orange }}>ESTIMÉ — avec réserve</div></>
                          : <Dash reason="Aucune estimation" />}
                      </td>
                      <td style={cell}>{r.cuve ?? "—"}{r.modele_cuve ? <div style={{ fontSize: 10.5, color: FT.textSub }}>{r.modele_cuve}</div> : null}</td>
                      <td style={cell}>{r.confiance ?? "—"}</td>
                      <td style={{ ...cell, color: qualityColor(r.qualite), fontWeight: 800 }}>{QUALITY_LABEL[r.qualite ?? ""] ?? r.qualite ?? "—"}
                        {r.doublon_de ? <div style={{ fontSize: 10, color: FT.textSub }}>doublon du relevé #{r.doublon_de}</div> : null}</td>
                      <td style={cell}>{r.statut_validation}</td>
                      <td style={cell}>{r.lot ? `#${r.lot}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Pager page={d.pagination.page} totalPages={d.pagination.totalPages} hasPrev={d.pagination.hasPrev} hasNext={d.pagination.hasNext}
                 onPrev={() => setP((x) => ({ ...x, page: Math.max(1, (x.page ?? 1) - 1) }))} onNext={() => setP((x) => ({ ...x, page: (x.page ?? 1) + 1 }))} />
        </>
      )}
    </Card>
  );
}

// ── Cuves à traiter ──────────────────────────────────────────────────────────────────────────────────
export function TanksToProcess() {
  const [p, setP] = useState<{ categorie?: string; usage?: string; page: number }>({ page: 1 });
  const [search, setSearch] = useState("");
  const site = useDebounced(search);
  const q = useQuery({ queryKey: ["stock-tanks-to-process", p, site], queryFn: () => getTanksToProcess({ ...p, site: site || undefined, limit: 50 }), placeholderData: (x) => x });
  const d = q.data;
  const set = (patch: Partial<typeof p>) => setP((x) => ({ ...x, ...patch, page: 1 }));
  return (
    <Card padded={false} style={{ padding: 18 }}>
      <SheetTitle icon={<Warehouse size={17} />} title="Cuves à traiter"
        subtitle="Classées par impact sur les bilans. Une cuve proposée n'est jamais validée automatiquement : seule une estimation (confiance faible, avec réserve) est possible au-dessus du seuil de compatibilité." />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "0 10px", height: 32, minWidth: 180 }}>
          <Search size={14} color={FT.textSub} aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Site…" aria-label="Rechercher un site" style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, flex: 1 }} />
        </div>
        <Chip active={!p.categorie} label="Toutes" onClick={() => set({ categorie: undefined })} />
        {Object.entries(TANK_CAT).map(([k, l]) => <Chip key={k} active={p.categorie === k} label={l} count={d?.totaux_categories[k]} onClick={() => set({ categorie: p.categorie === k ? undefined : k })} />)}
      </div>
      {d && (
        <div style={{ fontSize: 11.5, color: FT.textSub, marginBottom: 8 }}>
          Usage : {Object.entries(d.totaux_usage).map(([k, n]) => `${USAGE_LABEL[k]?.label ?? k} ${n}`).join(" · ") || "—"} · seuil de compatibilité pour une cuve proposée : {d.seuil_score_proposee}/100
        </div>
      )}
      {q.isLoading && <Skeleton h={260} />}
      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Cuves indisponibles (serveur API à mettre à jour ou erreur de chargement).</div>}
      {d && d.data.length === 0 && <EmptyState icon={<Warehouse size={20} />} title="Aucune cuve pour ces filtres" />}
      {d && d.data.length > 0 && (
        <>
          <div style={{ overflow: "auto", maxHeight: 600, borderRadius: 12, border: `1px solid ${FT.border}`, opacity: q.isFetching ? 0.7 : 1 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1400 }}>
              <thead><tr>{["Site / cuve", "Catégories", "Forme et cotes (cm)", "Plaque", "Géométrie", "Score compatibilité", "Utilisation actuelle", "Relevés bloqués", "Relevés estimés", "Bilans impactés", "Action"].map((h) =>
                <th key={h} scope="col" style={{ ...thStyle, textAlign: "left" }}>{h}</th>)}</tr></thead>
              <tbody>
                {d.data.map((r: TankToProcessRow, i) => (
                  <tr key={r.id} style={{ background: i % 2 ? FT.cardAlt : "#fff" }}>
                    <td style={cell}><b>{r.site_id}</b>{r.prioritaire_demande && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: FT.violet ?? FT.navy }}>PRIORITÉ MÉTIER</span>}
                      <div style={{ fontSize: 11, color: FT.textSub }}>cuve {r.cuve} · {r.statut}</div></td>
                    <td style={cell}>{r.categories.map((c) => TANK_CAT[c] ?? c).join(" · ")}</td>
                    <td style={cell}>{r.forme ?? "—"}{r.cotes_cm.some((x) => x !== null) ? ` · ${r.cotes_cm.map((x) => x ?? "—").join(" / ")}` : ""}</td>
                    <td style={cell}><Num value={r.plaque_l} unit="L" reason="Plaque absente" /></td>
                    <td style={cell}><Num value={r.geometrie_l} unit="L" reason="Géométrie absente" />{r.ecart_plaque_pct !== null && <div style={{ fontSize: 10.5, color: Math.abs(r.ecart_plaque_pct) > 5 ? FT.red : FT.textSub }}>{r.ecart_plaque_pct > 0 ? "+" : ""}{r.ecart_plaque_pct} % vs plaque</div>}</td>
                    <td style={cell}>{r.score_compatibilite ?? "—"}</td>
                    <td style={{ ...cell, fontWeight: 800, color: USAGE_LABEL[r.usage]?.color }}>{USAGE_LABEL[r.usage]?.label ?? r.usage}</td>
                    <td style={cell}>{r.releves_bloques.toLocaleString("fr-FR")}</td>
                    <td style={cell}>{r.releves_estimes.toLocaleString("fr-FR")}</td>
                    <td style={cell}>{r.bilans_impactes}</td>
                    <td style={{ ...cell, minWidth: 220 }}>{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={d.pagination.page} totalPages={d.pagination.totalPages} hasPrev={d.pagination.hasPrev} hasNext={d.pagination.hasNext}
                 onPrev={() => setP((x) => ({ ...x, page: Math.max(1, x.page - 1) }))} onNext={() => setP((x) => ({ ...x, page: x.page + 1 }))} />
        </>
      )}
    </Card>
  );
}

// ── Priorités de fiabilisation ───────────────────────────────────────────────────────────────────────
export function StockPriorities() {
  const [p, setP] = useState<{ categorie?: string; page: number }>({ page: 1 });
  const q = useQuery({ queryKey: ["stock-priorities", p], queryFn: () => getPriorities({ ...p, limit: 50 }), placeholderData: (x) => x });
  const d = q.data;
  return (
    <Card padded={false} style={{ padding: 18 }}>
      <SheetTitle icon={<ListOrdered size={17} />} title="Priorités de fiabilisation"
        subtitle="Actions classées par impact en litres : ce qui, une fois corrigé, rend le plus de consommation certifiable." />
      {d?.periode.debut && <div style={{ fontSize: 12, color: FT.textSub, margin: "8px 0" }}>Période du dernier bilan : {fmtDateTime(d.periode.debut, true)} → {fmtDateTime(d.periode.fin, true)}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
        <Chip active={!p.categorie} label="Toutes" onClick={() => setP({ page: 1 })} />
        {Object.entries(d?.libelles ?? {}).map(([k, l]) => <Chip key={k} active={p.categorie === k} label={l} count={d?.totaux[k]} onClick={() => setP({ categorie: p.categorie === k ? undefined : k, page: 1 })} />)}
      </div>
      {q.isLoading && <Skeleton h={240} />}
      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Priorités indisponibles (serveur API à mettre à jour ou erreur de chargement).</div>}
      {d && d.data.length === 0 && <EmptyState icon={<ListOrdered size={20} />} title="Aucune priorité" subtitle="Calculer un bilan de stock pour faire apparaître les priorités." />}
      {d && d.data.length > 0 && (
        <>
          <div style={{ overflow: "auto", maxHeight: 600, borderRadius: 12, border: `1px solid ${FT.border}`, opacity: q.isFetching ? 0.7 : 1 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1000 }}>
              <thead><tr>{["#", "Catégorie", "Site", "Impact", "Motif", "Action"].map((h) => <th key={h} scope="col" style={{ ...thStyle, textAlign: "left" }}>{h}</th>)}</tr></thead>
              <tbody>
                {d.data.map((r, i) => (
                  <tr key={`${r.rang}-${r.categorie}`} style={{ background: i % 2 ? FT.cardAlt : "#fff" }}>
                    <td style={cell}>{r.rang}</td>
                    <td style={{ ...cell, fontWeight: 800 }}>{r.libelle_categorie}</td>
                    <td style={cell}><b>{r.site_id}</b>{r.cuve ? ` · cuve ${r.cuve}` : ""}{r.reference ? ` · ${r.reference}` : ""}</td>
                    <td style={cell}>{r.impact_l === null ? <Dash reason="Impact non quantifiable" /> : `${r.impact_l.toLocaleString("fr-FR")} ${r.impact_unite ?? "L"}`}</td>
                    <td style={{ ...cell, minWidth: 240 }}>{r.motif}</td>
                    <td style={{ ...cell, minWidth: 240 }}>{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={d.pagination.page} totalPages={d.pagination.totalPages} hasPrev={d.pagination.hasPrev} hasNext={d.pagination.hasNext}
                 onPrev={() => setP((x) => ({ ...x, page: Math.max(1, x.page - 1) }))} onNext={() => setP((x) => ({ ...x, page: x.page + 1 }))} />
        </>
      )}
    </Card>
  );
}

// ── Analyse préalable d'un fichier (lecture seule, aucun import) ─────────────────────────────────────
export function FileAnalysisCard() {
  const ref = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<FileAnalysis | null>(null);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    setRes(null);
    try {
      setRes(await analyzeStockFile(f, source || undefined));
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Analyse impossible.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <Card padded={false} style={{ padding: 18 }}>
      <SheetTitle icon={<FileSearch size={17} />} title="Analyser un fichier avant import"
        subtitle="Lecture seule : feuilles, colonnes reconnues / non reconnues, plage de dates et couverture des sites. Aucune donnée n'est enregistrée." />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "12px 0" }}>
        <select aria-label="Type de fichier" value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle}>
          <option value="">Type : détection automatique</option>
          {["CLOSING", "LOLIFORCE", "SCSS", "HISTORICAL_REFUELING", "TANK_MODELS"].map((s) => <option key={s} value={s}>{IMPORT_SOURCE_LABEL[s] ?? s}</option>)}
        </select>
        <input ref={ref} type="file" accept=".xlsx,.xlsm,.xlsb" aria-label="Fichier à analyser" onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
        {busy && <span role="status" style={{ fontSize: 12 }}>Analyse en cours…</span>}
      </div>
      {error && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>{error}</div>}
      {res && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
          <div>
            <b>{res.fichier}</b> · source : <b>{res.libelle_source ?? (res.source_detectee ? IMPORT_SOURCE_LABEL[res.source_detectee] ?? res.source_detectee : "non détectée")}</b> · version du mapping : <b>{res.version_mapping ?? "—"}</b>
            <div>
              Feuille(s) retenue(s) : <b>{(res.feuilles_retenues ?? []).join(", ") || "—"}</b> · période détectée : <b>{res.periode_detectee ? `${res.periode_detectee[0]} → ${res.periode_detectee[1]}` : "—"}</b> · lignes de données : <b>{res.lignes_total ?? "—"}</b>
            </div>
            {res.couverture_sites && <div>Sites : reconnus <b>{res.couverture_sites.reconnus}</b>, non reconnus <b style={{ color: res.couverture_sites.inconnus ? FT.red : FT.green }}>{res.couverture_sites.inconnus}</b></div>}
          </div>
          {res.controle_lignes && (
            <div style={{ border: `1px solid ${FT.border}`, borderRadius: 10, padding: 10 }}>
              <div>
                Unité détectée : <b>{res.controle_lignes.unite_detectee ?? "—"}</b> · relevés en litres <b>{res.controle_lignes.releves_en_litres}</b> · relevés en cm <b>{res.controle_lignes.releves_en_cm}</b>
                {res.controle_lignes.lignes_avec_deux_unites ? ` · lignes avec deux unités ${res.controle_lignes.lignes_avec_deux_unites}` : ""}
              </div>
              <div>
                Lignes : lues <b>{res.controle_lignes.lignes_lues}</b>, acceptées <b>{res.controle_lignes.lignes_acceptees}</b>, rejetées <b style={{ color: res.controle_lignes.lignes_rejetees ? FT.red : FT.green }}>{res.controle_lignes.lignes_rejetees}</b>
              </div>
              {Object.keys(res.controle_lignes.motifs_rejet).length > 0 && (
                <div>Motifs de rejet : {Object.entries(res.controle_lignes.motifs_rejet).map(([k, n]) => `${k} (${n})`).join(" · ")}</div>
              )}
              {res.controle_lignes.exemples_rejets.length > 0 && (
                <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12 }}>
                  {res.controle_lignes.exemples_rejets.slice(0, 5).map((x) => <li key={`${x.feuille}-${x.ligne}`}>{x.feuille} · ligne {x.ligne} · {x.site} : {x.motifs.join(" | ")}</li>)}
                </ul>
              )}
              <div style={{ fontSize: 11.5, color: FT.textSub, marginTop: 4 }}>Aperçu de contrôle : rien n'est importé tant que le fichier n'est pas déposé / envoyé dans « Imports stock ».</div>
            </div>
          )}
          <div style={{ overflow: "auto", borderRadius: 10, border: `1px solid ${FT.border}` }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 800 }}>
              <thead><tr>{["Feuille", "Lignes", "Plage de dates", "Colonnes reconnues", "Colonnes non reconnues"].map((h) => <th key={h} scope="col" style={{ ...thStyle, textAlign: "left" }}>{h}</th>)}</tr></thead>
              <tbody>
                {res.feuilles.map((s) => (
                  <tr key={s.feuille}>
                    <td style={cell}><b>{s.feuille}</b>{s.ignoree && <div style={{ color: FT.orange, fontSize: 11 }}>ignorée{s.motif_ignoree ? ` : ${s.motif_ignoree}` : ""}</div>}</td>
                    <td style={cell}>{s.lignes_de_donnees ?? "—"}</td>
                    <td style={cell}>{s.plage_dates ? `${s.plage_dates[0]} → ${s.plage_dates[1]}` : "—"}</td>
                    <td style={cell}>{Object.entries(s.colonnes_mappees ?? {}).map(([k, v]) => `${k} → ${v}`).join(" · ") || "—"}</td>
                    <td style={cell}>{(s.colonnes_non_reconnues ?? []).join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
