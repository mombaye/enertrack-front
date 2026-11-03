// Barre de filtres commune : région, porteur, catégorie tarifaire, tension, période. L'état est porté par l'URL (lien partageable).
import type { PgFacets, PgFilterState } from "@/services/pilotageGrid";
import { ml } from "./format";
import { RULE, MUTED, INK } from "./format";

const sel = { padding: "6px 8px", borderRadius: 8, border: `1px solid ${RULE}`, background: "#fff", fontSize: 12.5, color: INK, fontWeight: 600 } as const;
const lab = { display: "grid", gap: 3, fontSize: 11.5, color: MUTED } as const;

export function PgFilterBar({ facets, value, onChange }: { facets: PgFacets | undefined; value: PgFilterState; onChange: (v: PgFilterState) => void }) {
  const set = (k: keyof PgFilterState, v: string) => onChange({ ...value, [k]: v || undefined });
  const from = value.from ?? facets?.default_from ?? "";
  const to = value.to ?? facets?.default_to ?? "";
  const opt = (list: string[] | undefined) => (list ?? []).map((o) => <option key={o} value={o}>{o}</option>);
  return (
    <div role="search" aria-label="Filtres" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", padding: "6px 2px" }}>
      <label style={lab}>Région<select value={value.region ?? ""} onChange={(e) => set("region", e.target.value)} style={sel}><option value="">Toutes</option>{opt(facets?.regions)}</select></label>
      <label style={lab}>Porteur<select value={value.porteur ?? ""} onChange={(e) => set("porteur", e.target.value)} style={sel}><option value="">Tous</option>{opt(facets?.porteurs)}</select></label>
      <label style={lab}>Catégorie tarifaire<select value={value.tarif ?? ""} onChange={(e) => set("tarif", e.target.value)} style={sel}><option value="">Toutes</option>{opt(facets?.tarifs)}</select></label>
      <label style={lab}>Tension<select value={value.tension ?? ""} onChange={(e) => set("tension", e.target.value)} style={sel}><option value="">Toutes</option><option>BT</option><option>MT</option></select></label>
      <label style={lab}>Période, de
        <select value={from} onChange={(e) => set("from", e.target.value)} style={sel}>{(facets?.months ?? []).map((m) => <option key={m} value={m}>{ml(m)}</option>)}</select>
      </label>
      <label style={lab}>à
        <select value={to} onChange={(e) => set("to", e.target.value)} style={sel}>{(facets?.months ?? []).map((m) => <option key={m} value={m}>{ml(m)}</option>)}</select>
      </label>
      <button type="button" onClick={() => onChange({})} style={{ ...sel, cursor: "pointer", fontWeight: 700 }}>Réinitialiser les filtres</button>
    </div>
  );
}
