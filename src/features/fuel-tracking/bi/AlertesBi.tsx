// Centre d'alertes (maquette suivi-carburant-v5) : une alerte par cause et par site.
// Source : les alertes déjà calculées par /bi/sites-table/ (mêmes règles et seuils que les tableaux par site).
// Aucune alerte n'est déduite ici : la page ne fait que regrouper, classer et formuler.
import { useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getSiteTable, type SiteTableAlerte, type SiteTableResponse, type SiteTableRow } from "@/services/fuelTracking";
import { monthLabel } from "../helpers";
import { FT } from "../theme";
import { Card } from "../ui";
import { BI, CARD, ChartCard, FilterBar, OpenSiteContext, Pill, StateBox, axisProps, fDec1, fL, fNum, fPct, fRatio, fSignedPct, tooltipStyle, type PillTone } from "./kit";

export type Sev = "crit" | "maj" | "info";
const SEV: Record<Sev, { label: string; color: string; tone: PillTone }> = {
  crit: { label: "Critique", color: "#D03B3B", tone: "crit" },
  maj: { label: "Majeure", color: "#EC835A", tone: "warn" },
  info: { label: "À surveiller", color: "#FAB219", tone: "mute" },
};
const SEV_ORDER: Record<Sev, number> = { crit: 0, maj: 1, info: 2 };

/** Gravité et action proposées par type d'alerte de la prod (choix d'affichage, à valider). */
const TYPES: Record<SiteTableAlerte, { sev: Sev; action: string; msg: (r: SiteTableRow) => string }> = {
  AUTONOMIE_3J: { sev: "crit", action: "Livrer en urgence",
    msg: (r) => `${fL(r.stock_l)} en cuve, environ ${fDec1(r.autonomie_j)} jour(s) d'autonomie à ${fDec1(r.l_jour)} L/j` },
  AU_DESSUS_TARGET: { sev: "maj", action: "Contrôle terrain : GE, fuite, vol",
    msg: (r) => `conso ${fL(r.conso_mesuree_l)} pour un target de ${fL(r.target_l)} (${fSignedPct(r.ecart_target_pct)})` },
  ECART_CPH: { sev: "maj", action: "Vérifier heures GE et type de GE",
    msg: (r) => `mesuré ${fL(r.conso_mesuree_l)} contre ${fL(r.conso_estimee_l)} estimés par le CPH (${fSignedPct(r.ecart_pct)})` },
  L_KWH_HAUT: { sev: "info", action: "Vérifier le compteur kWh et l'état du GE",
    msg: (r) => `${fRatio(r.l_kwh)} L/kWh` },
  SOUS_CHARGE: { sev: "info", action: "Vérifier le dimensionnement du GE",
    msg: (r) => `charge moyenne du GE ${fPct(r.charge_pct)}` },
  RELEVE_ANCIEN: { sev: "info", action: "Relancer le relevé de stock",
    msg: (r) => `dernier relevé il y a ${fNum(r.age_releve_j)} jours${r.source_stock ? ` (${r.source_stock})` : ""}` },
};

export type Alerte = { type: SiteTableAlerte; sev: Sev; row: SiteTableRow };
const PAGE = 200;

/** Toutes les alertes du mois et de la région. Les sites sont triés par nombre d'alertes : on lit les pages jusqu'au dernier site en alerte. */
export function useAlertes(month: string | null, zone: string) {
  return useQuery({
    queryKey: ["fuel-alertes", month, zone],
    queryFn: async () => {
      const rows: SiteTableRow[] = [];
      let first: SiteTableResponse | null = null;
      for (let page = 1; page <= 20; page++) {
        const d = await getSiteTable({ month: month ?? undefined, zone, sort: "nb_alertes", desc: "1", page: String(page), page_size: String(PAGE) });
        first ??= d;
        const withAl = d.rows.filter((r) => r.alertes.length > 0);
        rows.push(...withAl);
        if (withAl.length < d.rows.length || page * PAGE >= d.total) break;
      }
      const alertes: Alerte[] = rows.flatMap((row) => row.alertes.filter((t) => TYPES[t]).map((t) => ({ type: t, sev: TYPES[t].sev, row })))
        .sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev] || (b.row.conso_mesuree_l ?? 0) - (a.row.conso_mesuree_l ?? 0));
      return { alertes, labels: first?.filters.alertes, month: first?.month ?? month, nbSites: first?.total ?? 0 };
    },
    enabled: !!month,
    staleTime: 5 * 60_000,
    placeholderData: (p) => p,
  });
}

/** Ligne d'alerte de la maquette : barre de gravité, pastille, type, site, constat, action. */
export function AlerteRow({ a, label, compact = false }: { a: Alerte; label: string; compact?: boolean }) {
  const openSite = useContext(OpenSiteContext);
  const s = SEV[a.sev];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "4px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "10px 12px 10px 0", border: "1px solid #E6EAF0", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
      <span aria-hidden style={{ alignSelf: "stretch", background: s.color }} />
      <span style={{ fontSize: 13, minWidth: 0 }}>
        <Pill tone={s.tone}>{s.label}</Pill>{" "}
        <b style={{ fontWeight: 700 }}>{label}</b> · <b style={{ fontWeight: 700 }}>{a.row.site_id}</b>{" "}
        <span style={{ fontSize: 12, color: "#7D889B" }}>{[a.row.site_name, a.row.zone].filter(Boolean).join(" · ")}</span>
        <br /><span style={{ color: "#4B5768" }}>{TYPES[a.type].msg(a.row)}</span>
        {!compact && <><br /><span style={{ fontSize: 12, color: "#7D889B" }}>Action : {TYPES[a.type].action}</span></>}
      </span>
      {openSite && (
        <button type="button" onClick={() => openSite(a.row.site_id)}
          style={{ border: "1px solid #E6EAF0", background: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Voir</button>
      )}
    </div>
  );
}

const SHOW = 40;

export function AlertesBi({ toMonth, zone }: { toMonth: string | null; zone: string }) {
  const q = useAlertes(toMonth, zone);
  const [sev, setSev] = useState<Sev | "">("");
  const [type, setType] = useState<SiteTableAlerte | "">("");
  const [all, setAll] = useState(false);
  const d = q.data;
  const alertes = d?.alertes ?? [];
  const label = (t: SiteTableAlerte) => d?.labels?.[t] ?? t;
  const list = alertes.filter((a) => (!sev || a.sev === sev) && (!type || a.type === type));
  const counts = { "": alertes.length, crit: 0, maj: 0, info: 0 } as Record<Sev | "", number>;
  alertes.forEach((a) => counts[a.sev]++);
  const byType = (Object.keys(TYPES) as SiteTableAlerte[]).map((t) => ({ t, label: label(t), n: alertes.filter((a) => a.type === t).length, color: SEV[TYPES[t].sev].color })).filter((x) => x.n > 0);
  const pick = (f: () => void) => { f(); setAll(false); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <FilterBar title="Centre d'alertes"
        note={`une alerte par cause et par site · mêmes seuils que les tableaux par site${d?.month ? ` · ${monthLabel(d.month)}` : ""}`} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))", gap: 12 }}>
        {([["", "Toutes", "#0B1220"], ["crit", "Critiques", SEV.crit.color], ["maj", "Majeures", SEV.maj.color], ["info", "À surveiller", "#9A6200"]] as Array<[Sev | "", string, string]>).map(([k, l, c]) => (
          <button key={l} type="button" aria-pressed={sev === k} onClick={() => pick(() => setSev(k))}
            style={{ all: "unset", cursor: "pointer", border: "1px solid #E6EAF0", borderRadius: 12, padding: "12px 14px", display: "grid", gap: 2, background: "#fff",
              boxShadow: CARD.boxShadow, outline: sev === k ? "2px solid #0B1220" : undefined }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: c }}>{l}</span>
            <span style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{q.isLoading ? "…" : fNum(counts[k])}</span>
          </button>
        ))}
      </div>

      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>Alertes indisponibles (erreur de chargement). Réessayez avec le bouton Rafraîchir.</div>}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", alignItems: "start" }}>
        <Card style={{ ...CARD, gridColumn: "span 1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0B1220" }}>{q.isLoading ? "Alertes" : `${fNum(list.length)} alertes`}</div>
            <select aria-label="Type d'alerte" value={type} onChange={(e) => pick(() => setType(e.target.value as SiteTableAlerte | ""))}
              style={{ marginLeft: "auto", height: 32, border: `1px solid ${type ? "#1A56C4" : "#E6EAF0"}`, background: type ? "#EAF1FD" : "#fff", color: type ? "#1A56C4" : "#0B1220", borderRadius: 8, padding: "0 8px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit" }}>
              <option value="">Tous les types</option>
              {(Object.keys(TYPES) as SiteTableAlerte[]).map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {q.isLoading ? <StateBox height={200} text="Chargement…" />
              : !list.length ? <StateBox height={160} text="Aucune alerte pour ces filtres." />
              : (all ? list : list.slice(0, SHOW)).map((a) => <AlerteRow key={`${a.type}-${a.row.site_id}`} a={a} label={label(a.type)} />)}
          </div>
          {!all && list.length > SHOW && (
            <button type="button" onClick={() => setAll(true)}
              style={{ marginTop: 10, border: "1px solid #E6EAF0", background: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              Afficher les {fNum(list.length - SHOW)} autres
            </button>
          )}
        </Card>

        <ChartCard title="Par type" sub="nombre de sites" height={Math.max(220, byType.length * 44 + 30)} loading={q.isLoading} error={q.isError} empty={!byType.length}>
          <ResponsiveContainer>
            <BarChart data={byType} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BI.grid} horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="label" {...axisProps} width={170} tick={{ fill: "#0B1220", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${fNum(v as number)} sites`, "Alertes"]} />
              <Bar dataKey="n" radius={[0, 4, 4, 0]} maxBarSize={22} cursor="pointer"
                onClick={(x) => { const t = (x as unknown as { t?: SiteTableAlerte }).t; if (t) pick(() => setType(t)); }}>
                {byType.map((b) => <Cell key={b.t} fill={b.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
