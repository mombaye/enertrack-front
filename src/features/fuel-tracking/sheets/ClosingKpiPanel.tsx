// src/features/fuel-tracking/sheets/ClosingKpiPanel.tsx
// KPI de synthèse « comme l'en-tête du fichier Closing » (même vocabulaire, même mise en forme).
// Mois de référence (septembre 2026) : valeurs lues dans le fichier. Autres mois : calculées par EnerTrack (formules du fichier).
import type { CSSProperties } from "react";
import type { ClosingKpis, ClosingKpiValue } from "@/services/fuelTracking";

const NAVY = "#1F3864";
const YELLOW = "#FFFF00";
const VAL = "#FFE36E";

const fmt = (k: string, v: ClosingKpiValue | undefined) => {
  if (!v || v.valeur === null || v.valeur === undefined) return "n.d.";
  const n = v.valeur;
  if (k === "conso_moyenne_jour_l") return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (k === "check_l" && Math.abs(n) < 0.5) return "-";
  const r = Math.round(n);
  return r < 0 ? `(${Math.abs(r).toLocaleString("fr-FR")})` : r.toLocaleString("fr-FR");
};

const LEFT: string[] = ["nb_sites_ge", "stock_initial_l", "appoint_initial_l", "commande_mois_suivant_l", "commande_non_livree_l", "livree_l", "autre_l"];
const MIDDLE: string[] = ["conso_moyenne_jour_l", "stock_final_l", "appoint_final_l", "conso_releves_l", "perdue_l", "check_l", "nb_sites"];
const RIGHT: Array<{ k: string; style?: "red" | "yellow" | "black" | "dim" }> = [
  { k: "nb_jours" }, { k: "ecart_theorique_l", style: "red" }, { k: "vol_probable_l", style: "red" },
  { k: "estimation_conso_mois_l", style: "yellow" }, { k: "estimation_conso_prec_l", style: "black" },
  { k: "estimation_stock_fin_l" }, { k: "estimation_stock_fin_prec_l", style: "dim" }, { k: "estimation_livraison_l" },
];

function Pair({ k, kpis }: { k: string; kpis: ClosingKpis["kpis"] }) {
  const v = kpis[k];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 10, alignItems: "baseline", padding: "3px 0" }}>
      <span style={{ textAlign: "right", color: VAL, fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: 13 }}>{fmt(k, v)}</span>
      <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{v?.libelle ?? k}</span>
    </div>
  );
}

export function ClosingKpiPanel({ data }: { data: ClosingKpis | null | undefined }) {
  if (!data) return null;
  const k = data.kpis;
  const fromFile = data.source === "FICHIER_CLOSING";
  const [y, m] = data.mois.split("-").map(Number);
  const mois = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();
  const dots: CSSProperties = { backgroundColor: NAVY, backgroundImage: "radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px)", backgroundSize: "6px 6px" };
  const proj = k.projection_mois_suivant_l;
  return (
    <section aria-label="KPI de synthèse du mois (format fichier Closing)" style={{ ...dots, borderRadius: 12, padding: 16, color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderBottom: "2px solid #fff", paddingBottom: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Synthèse conso fuel — {mois} · SENEGAL</div>
        <span title={data.note} style={{ background: fromFile ? "#E5EEFF" : "#E7F9F1", color: fromFile ? "#1D4ED8" : "#0F7A50", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>
          {fromFile ? `Valeurs du fichier Closing${data.fichier ? ` · ${data.fichier}` : ""}` : "Calculé par EnerTrack (formules du fichier Closing)"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "4px 24px" }}>
        <div>{LEFT.map((x) => <Pair key={x} k={x} kpis={k} />)}</div>
        <div>{MIDDLE.map((x) => <Pair key={x} k={x} kpis={k} />)}</div>
      </div>
      <div style={{ borderTop: "2px solid #fff", marginTop: 12, paddingTop: 10, display: "grid", gap: 4 }}>
        {RIGHT.map(({ k: key, style }) => {
          const v = k[key];
          const row: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 140px", gap: 16, alignItems: "center", padding: "5px 10px", borderRadius: 4 };
          const color = style === "red" ? "#FF3B3B" : style === "yellow" ? "#000" : style === "dim" ? "#C9A227" : style === "black" ? "#F5C518" : VAL;
          const bg = style === "yellow" ? YELLOW : style === "black" ? "#000" : "transparent";
          const lab = style === "red" ? "#FF3B3B" : style === "yellow" ? "#000" : style === "black" ? "#F5C518" : style === "dim" ? "#C9A227" : "#fff";
          return (
            <div key={key} style={{ ...row, background: bg }}>
              <span style={{ textAlign: "right", fontSize: 14, color: lab, fontWeight: style === "yellow" ? 700 : 600 }}>{v?.libelle ?? key}</span>
              <span style={{ textAlign: "right", fontSize: 18, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{fmt(key, v)}</span>
            </div>
          );
        })}
        {proj && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 16, alignItems: "center", padding: "7px 10px", borderRadius: 4, border: `2px dashed ${YELLOW}`, marginTop: 6 }}>
            <span style={{ textAlign: "right", fontSize: 14, fontWeight: 700 }}>
              {proj.libelle}
              <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,.75)" }}>
                Projection = Σ conso moyenne L/jour du mois par site × nb de jours du mois suivant (méthode du fichier Closing)
              </span>
            </span>
            <span style={{ textAlign: "right", fontSize: 18, fontWeight: 800, color: YELLOW, fontVariantNumeric: "tabular-nums" }}>{fmt("projection_mois_suivant_l", proj)}</span>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.75)", marginTop: 10 }}>
        {data.note} « n.d. » = donnée non disponible (jamais remplacée par 0).
      </div>
    </section>
  );
}
