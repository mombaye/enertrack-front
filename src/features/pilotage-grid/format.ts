// Formats et couleurs communs Pilotage Grid (mêmes règles d'affichage que l'interface d'origine).
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export const fmtN = (v: number) => Math.round(v).toLocaleString("fr-FR");
export const f1 = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
export const signed1 = (v: number) => `${v > 0 ? "+" : ""}${f1(v)}`;

export function money(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Md`;
  if (a >= 1e6) return `${f1(v / 1e6)} M`;
  if (a >= 1e3) return `${fmtN(v / 1e3)} k`;
  return fmtN(v);
}

export const energy = (v: number) => (v >= 1e6 ? `${f1(v / 1e6)} GWh` : v >= 1e3 ? `${f1(v / 1e3)} MWh` : `${fmtN(v)} kWh`);

export function ml(month: string): string {
  const [y, m] = month.split("-");
  return `${MOIS[Number(m) - 1]} ${y.slice(2)}`;
}

export const dfr = (s: string) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "");

export const ST_COLOR = ["#2E7D5B", "#9AA4A9", "#D08A1E", "#B0425A", "#5B5FC7"];
export const POR_COLOR: Record<string, string> = {
  AKTIVCO: "#1E5B8E", SONATEL: "#E0741A", "SONATEL & AKTIVCO": "#7A9A3A", "SONATEL / SONATEL & AKTIVCO": "#8E8E8E", "Sans porteur": "#C3CACD", "Non renseigné": "#C3CACD",
};
export const INK = "#16262E";
export const MUTED = "#5A6B73";
export const RULE = "#D3DCD9";
export const K1 = "#1E5B8E";
export const K2 = "#E0741A";
