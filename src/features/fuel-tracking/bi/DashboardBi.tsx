// Dashboard (vue d'ensemble d'un mois) : mise en page de la maquette validée (suivi-carburant-v5).
// Chaque chiffre vient d'un endpoint existant ; un bloc sans source en production est affiché « non disponible », jamais inventé.
import { useContext } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getBiClosingSynthese, getBiConso, getBiConsoSources, getBiStock } from "@/services/fuelTracking";
import { DEBUT_SUIVI, monthLabel } from "../helpers";
import { FT } from "../theme";
import { ConsoSources } from "./ConsoBi";
import { AlerteRow, useAlertes } from "./AlertesBi";
import { BI, BiKpi, ChartCard, FilterBar, KpiRow, OpenSiteContext, StateBox, axisProps, fL, fNum, fPct, fShort, tooltipStyle, CARD } from "./kit";
import { Card } from "../ui";

// Couleurs catégorielles de la maquette, attribuées à la région dans l'ordre alphabétique (stables quand un filtre s'applique).
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#7b61c9", "#0e9bb0"];

const prevMonthOf = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const sumOf = <T,>(rows: T[], f: (r: T) => number | null | undefined) => rows.reduce((a, r) => a + (f(r) ?? 0), 0);

export function DashboardBi({ fromMonth, toMonth, zone, onTab }: { fromMonth?: string | null; toMonth: string | null; zone: string; onTab?: (t: "ALERTES") => void }) {
  const openSite = useContext(OpenSiteContext);
  const month = toMonth ?? undefined;
  // Période affichée = celle de Suivi conso (du … au …) : le Closing du mois comptable vaut pour toute période qui le contient.
  const from = fromMonth && toMonth && fromMonth <= toMonth ? fromMonth : month;
  const prev = from ? prevMonthOf(from) : null;   // comparaison avec la période qui précède le début de la période affichée
  const prevOk = !!prev && prev >= DEBUT_SUIVI && from === month;   // comparaison seulement pour un mois isolé (pas de période de longueur différente)

  const conso = useQuery({
    queryKey: ["fuel-dash-conso", toMonth, zone],
    queryFn: () => getBiConso({ from_month: month, to_month: month, month, zone }),
    enabled: !!toMonth, staleTime: 60_000, placeholderData: (p) => p,
  });
  // Même clé que le bloc des 4 mesures : une seule requête pour les deux.
  const src = useQuery({
    queryKey: ["fuel-bi-conso-sources", from, month, undefined, zone, undefined, undefined],
    queryFn: () => getBiConsoSources({ from_month: from, to_month: month, zone }),
    enabled: !!toMonth, staleTime: 5 * 60_000, retry: false,
  });
  const srcPrev = useQuery({
    queryKey: ["fuel-bi-conso-sources", prev, prev, undefined, zone, undefined, undefined],
    queryFn: () => getBiConsoSources({ from_month: prev!, to_month: prev!, zone }),
    enabled: prevOk, staleTime: 5 * 60_000, retry: false,
  });
  const stock = useQuery({
    queryKey: ["fuel-bi-stock", zone, toMonth],
    queryFn: () => getBiStock({ zone, month }),
    staleTime: 60_000, placeholderData: (p) => p,
  });
  const alertes = useAlertes(toMonth, zone);
  // Fichier Closing du mois : target, vols, statuts, variation de stock — chiffres du fichier, avec le motif précis quand il manque.
  const syn = useQuery({ queryKey: ["fuel-closing-synthese", from, toMonth], queryFn: () => getBiClosingSynthese(from!, toMonth!), enabled: !!toMonth, staleTime: 5 * 60_000, retry: false });
  const sy = syn.data?.disponible ? syn.data : null;
  const noClosing = syn.data && !syn.data.disponible ? syn.data : null;
  const manque = (what: string) => syn.isError ? `${what} : chargement impossible (réessayez)` : sy?.ancien_import ? `${what} : ${sy.motif}` : noClosing ? `${what} : ${noClosing.motif ?? "aucun Closing importé pour ce mois"}` : "…";

  const c = conso.data;
  const k = c?.kpis;

  // Consommation du mois : Closing (comme la maquette), comparée au mois précédent seulement dans la période de suivi.
  const closing = src.data?.disponible ? src.data.kpis.closing?.total_l ?? null : null;
  const closingPrev = prevOk && srcPrev.data?.disponible ? srcPrev.data.kpis.closing?.total_l ?? null : null;
  const deltaPct = closing != null && closingPrev ? (closing - closingPrev) / closingPrev * 100 : null;

  const sk = stock.data?.kpis;
  const srcDist = stock.data?.distribution_source;
  const nbEstime = srcDist?.find((b) => b.label === "Estimation")?.nb_sites ?? 0;
  const nbSans = srcDist?.find((b) => b.label === "Aucun relevé")?.nb_sites ?? 0;
  const pctMesure = srcDist && sk?.nb_sites ? (sk.nb_sites - nbEstime - nbSans) / sk.nb_sites * 100 : null;

  // Graphiques : uniquement des données réellement présentes (fichier Closing du mois), sans target ni Snowflake absents.
  const parRegion = sy?.par_region ?? [];
  const topSites = sy?.top_sites ?? [];
  const flux = sy?.stock ? [
    { label: "Stock initial", v: sy.stock.initial_l, color: "#2a78d6" },
    { label: "Livraisons", v: sy.stock.livraisons_l, color: "#1baf7a" },
    { label: "Vols", v: sy.vols?.total_l ?? null, color: "#D03B3B" },
    { label: "Vidange/écart", v: sy.vidange_fuite_ecart?.total_l ?? null, color: "#eda100" },
    { label: "Consommation", v: sy.conso_closing?.total_l ?? null, color: "#0B1F4D" },
    { label: "Stock final", v: sy.stock.final_l, color: "#7b61c9" },
  ].filter((f): f is { label: string; v: number; color: string } => f.v != null) : [];

  const crit = (alertes.data?.alertes ?? []).filter((a) => a.sev === "crit");
  const alLabels = alertes.data?.labels;
  const mois = toMonth ? (from && from !== toMonth ? `${monthLabel(from)} → ${monthLabel(toMonth)}` : monthLabel(toMonth)) : "—";
  const moisCourt = toMonth ? mois.split(" ")[0] : "—";
  const moisPrev = prev ? monthLabel(prev).split(" ")[0] : "";
  const loading = conso.isLoading;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <FilterBar title={`Vue d'ensemble · ${mois}`} note={k ? `${fNum(k.nb_sites)} sites avec groupe électrogène${zone ? ` · ${zone}` : ""}` : undefined} />

      {conso.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Chargement de la consommation impossible. Réessayez avec le bouton Rafraîchir.</div>}

      <ConsoSources compact enabled={!!toMonth} params={{ from_month: from, to_month: month, zone }} />

            {(noClosing || (sy?.controle && !sy.controle.ok) || (sy?.lignes && sy.lignes.id_non_reconnus > 0)) && (
        <div role={noClosing || (sy?.controle && !sy.controle.ok) ? "alert" : "note"} style={{ padding: "10px 14px", borderRadius: 8, background: "#FFF6E5", border: "1px solid #F3D9A4", fontSize: 12.5, color: "#5b4300", display: "grid", gap: 4 }}>
          {noClosing && <span><strong>Fichier Closing absent.</strong> {noClosing.motif} <Link to="/modules/suivi-carburant/stock" style={{ color: "#1D5FE0", fontWeight: 700 }}>{noClosing.action?.libelle ?? "Importer le Closing"} →</Link></span>}
          {sy?.controle && !sy.controle.ok && <span><strong>Contrôle d'import :</strong> {sy.controle.avertissement} ({sy.controle.totaux.filter((t) => !t.ok).map((t) => `${t.libelle} : fichier ${fNum(t.lu_fichier_l)} L, importé ${fNum(t.importe_l)} L`).join(" ; ")})</span>}
          {sy?.lignes && sy.lignes.id_non_reconnus > 0 && <span>{fNum(sy.lignes.id_non_reconnus)} ligne(s) du fichier sur {fNum(sy.lignes.lues)} ont un identifiant absent de Gestion des sites : elles sont comptées dans la consommation Closing (comme dans le fichier) mais sans fiche site. {fNum(sy.lignes.id_en_double)} identifiant(s) en double et {fNum(sy.lignes.sans_region)} ligne(s) sans région conservés tels quels.</span>}
        </div>
      )}

      <KpiRow>
        <BiKpi label="Consommation du mois" value={src.isLoading ? "…" : fNum(closing)} unit="L"
          explain={src.data?.disponible && src.data.explain.closing ? { ...src.data.explain.closing, titre: "Consommation du mois (Closing)" } : null}
          sub={from !== month ? `Closing du fichier · ${sy?.mois_avec_closing?.length ? sy.mois_avec_closing.map((m) => monthLabel(m)).join(", ") : "période choisie"}${sy?.mois_sans_closing?.length ? ` · sans fichier : ${sy.mois_sans_closing.map((m) => monthLabel(m)).join(", ")}` : ""}`
            : !prevOk ? "Closing · début du suivi, pas de comparaison"
            : closingPrev == null ? "Closing · mois précédent non disponible"
            : `${fNum(closingPrev)} L en ${moisPrev}${deltaPct != null ? ` · ${deltaPct > 0 ? "+" : ""}${fPct(deltaPct)}` : ""}`} />
        <BiKpi label="Réalisé sur target" value={sy?.target?.atteinte_pct == null ? "—" : fPct(sy.target.atteinte_pct).replace(" %", "")} unit="%"
          alert={sy?.target?.atteinte_pct != null && sy.target.atteinte_pct > 110 ? "bad" : null}
          sub={sy?.target?.sites_comparables ? `${fNum(sy.target.conso_comparable_l)} L sur ${fNum(sy.target.target_comparable_l)} L prévus · ${fNum(sy.target.sites_comparables)} sites · fichier Closing`
            : sy ? "aucun site avec conso et target dans le fichier" : manque("Target")} />
        <BiKpi label="Couverture stock" value={sk?.couverture_j == null ? "—" : fNum(sk.couverture_j)} unit="jours" explain={stock.data?.explain?.couverture_j}
          sub={sk ? `${fNum(sk.stock_total_l)} L en cuve aujourd'hui` : undefined} />
        <BiKpi label="Sites en surconsommation" value={sy?.target ? `${fNum(sy.target.sites_au_dessus)}` : "—"} unit={sy?.target ? `/ ${fNum(sy.target.sites_comparables)}` : undefined}
          alert={sy?.target?.sites_au_dessus ? "warn" : null} explain={c?.explain?.ecart_target_pct}
          sub={sy?.target ? `plus de ${fNum(sy.target.tolerance_pct)} % au-dessus du target (fichier Closing)` : manque("Target")} />
        <BiKpi label="Vols déclarés" value={sy?.vols ? fNum(sy.vols.total_l) : "—"} unit={sy?.vols ? "L" : undefined} alert={sy?.vols?.total_l ? "warn" : null}
          sub={sy?.vols ? `${fNum(sy.vols.sites_concernes)} site(s) · « Qté volée » du fichier · fuite / vidange / écart : ${fNum(sy.vidange_fuite_ecart?.total_l)} L` : manque("Vols")} />
        <BiKpi label="Stocks mesurés" value={pctMesure == null ? "—" : fNum(pctMesure)} unit="%"
          sub={srcDist ? `${fNum(nbEstime)} estimés · ${fNum(nbSans)} sans relevé` : undefined} />
      </KpiRow>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))" }}>
        <ChartCard title="Flux de carburant du mois" sub="litres · totaux du fichier Closing" height={300} loading={syn.isLoading}
          empty={!flux.length}>
          <ResponsiveContainer>
            <BarChart data={flux} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval={0} />
              <YAxis {...axisProps} width={56} tickFormatter={(v: number) => fNum(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fL(v as number), "Volume"]} />
              <Bar dataKey="v" radius={[4, 4, 0, 0]} maxBarSize={44}>
                {flux.map((f) => <Cell key={f.label} fill={f.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Consommation par région" sub="litres · fichier Closing" height={300} loading={syn.isLoading}
          empty={!parRegion.length} legend={parRegion.map((z, i) => ({ label: z.region, color: PALETTE[i % PALETTE.length] }))}>
          <ResponsiveContainer>
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fL(v as number), n as string]} />
              <Pie data={parRegion} dataKey="conso_l" nameKey="region" innerRadius="58%" outerRadius="90%" stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                {parRegion.map((z, i) => <Cell key={z.region} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 20, fontWeight: 700, fill: "#0B1220" }}>{fShort(sumOf(parRegion, (z) => z.conso_l))}</text>
              <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: "#7D889B" }}>litres</text>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Statut des bilans" sub="Analysis #1 à #9 du fichier · sites à vérifier" height={300}>
          {sy?.statuts ? (
            <div style={{ display: "grid", gap: 6, fontSize: 12, overflow: "auto", maxHeight: 300 }} role="list" aria-label="Analyses du fichier Closing">
              {sy.statuts.map((a) => (
                <div key={a.code} role="listitem" title={a.valeurs.map((v) => `${v.valeur} : ${v.nb}`).join(" · ")} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ color: "#3b4658" }}>#{a.code} {a.libelle}</span>
                  <strong style={{ color: a.a_verifier ? "#B26A00" : "#0CA30C", whiteSpace: "nowrap" }}>{a.a_verifier ? `${fNum(a.a_verifier)} à vérifier` : "RAS"}</strong>
                </div>
              ))}
            </div>
          ) : <StateBox height={300} text={manque("Statuts des bilans")} />}
        </ChartCard>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))" }}>
        <ChartCard title="Top 10 des plus gros consommateurs" sub="litres · fichier Closing" height={320} loading={syn.isLoading} empty={!topSites.length}>
          <ResponsiveContainer>
            <BarChart data={topSites} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={(v: number) => fNum(v)} />
              <YAxis type="category" dataKey="site" {...axisProps} width={86} tick={{ fill: "#0B1220", fontSize: 11, fontWeight: 600 }} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(id) => { const t = topSites.find((x) => x.site === id); return t ? `${t.site} (${t.region ?? "sans région"})` : String(id); }}
                formatter={(v) => [fL(v as number), "Conso Closing"]} />
              <Bar dataKey="conso_l" fill="#0B1F4D" radius={[0, 4, 4, 0]} maxBarSize={18} cursor={openSite ? "pointer" : undefined} onClick={(d: { site?: string }) => d?.site && openSite?.(d.site)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card style={{ ...CARD, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0B1220" }}>Alertes critiques</div>
            {onTab && <button type="button" onClick={() => onTab("ALERTES")} style={{ all: "unset", marginLeft: "auto", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#1A56C4" }}>tout voir →</button>}
          </div>
          <div style={{ marginTop: 10, overflowY: "auto", maxHeight: 340, display: "grid", gap: 8 }}>
            {alertes.isLoading ? <StateBox height={120} text="Chargement…" />
              : alertes.isError ? <StateBox height={120} tone="red" text="Alertes indisponibles (erreur de chargement)." />
              : !crit.length ? <span style={{ fontSize: 12, color: "#7D889B" }}>Aucune alerte critique.</span>
              : crit.slice(0, 6).map((a) => <AlerteRow key={`${a.type}-${a.row.site_id}`} a={a} label={alLabels?.[a.type] ?? a.type} compact />)}
          </div>
        </Card>
      </div>
    </div>
  );
}
