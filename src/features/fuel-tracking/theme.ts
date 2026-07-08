// src/features/fuel-tracking/theme.ts
// Palette et tokens visuels du module Suivi Carburant — cohérent avec l'identité
// Camusat (navy #0c295a) utilisée ailleurs dans l'app (SuiviConsoPage, thème global).

export const FT = {
  // Fond de page
  pageBg: "linear-gradient(180deg,#F7F9FC 0%,#EEF3FB 100%)",

  // Bannière d'en-tête
  headerGrad: "linear-gradient(120deg,#08183A 0%,#0F2C63 45%,#153E8A 100%)",

  // Surfaces
  card: "#FFFFFF",
  cardAlt: "#FAFBFD",
  border: "rgba(15,23,42,.09)",
  borderStrong: "rgba(15,23,42,.14)",

  // Texte
  text: "#0B1220",
  textMid: "#4B5768",
  textSub: "#94A0B4",
  textOnDark: "#EAF0FE",
  textOnDarkSub: "rgba(234,240,254,.68)",

  // Marque
  navy: "#0F2C63",
  navyDeep: "#08183A",
  gold: "#E08A2C",
  goldL: "#FFF4E6",

  // Sémantique
  green: "#0F9D67",
  greenL: "#E7F9F1",
  orange: "#D97706",
  orangeL: "#FFF6E9",
  red: "#DC2626",
  redL: "#FEF0F0",
  violet: "#7C3AED",
  violetL: "#F4EEFF",
  blue: "#2563EB",
  blueL: "#EBF2FF",
  cyan: "#0891B2",
  cyanL: "#E5F8FB",
  slate: "#64748B",
  slateL: "#F5F7FA",

  radius: 16,
  radiusSm: 10,
  shadow: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.10)",
  shadowLg: "0 8px 30px -8px rgba(8,24,58,.22)",
} as const;

export type Tone = "green" | "orange" | "red" | "blue" | "violet" | "cyan" | "slate" | "gold";

export function toneColors(tone: Tone = "slate") {
  const map: Record<Tone, { fg: string; bg: string; bd: string }> = {
    green: { fg: FT.green, bg: FT.greenL, bd: "rgba(15,157,103,.25)" },
    orange: { fg: FT.orange, bg: FT.orangeL, bd: "rgba(217,119,6,.25)" },
    red: { fg: FT.red, bg: FT.redL, bd: "rgba(220,38,38,.22)" },
    blue: { fg: FT.blue, bg: FT.blueL, bd: "rgba(37,99,235,.22)" },
    violet: { fg: FT.violet, bg: FT.violetL, bd: "rgba(124,58,237,.22)" },
    cyan: { fg: FT.cyan, bg: FT.cyanL, bd: "rgba(8,145,178,.22)" },
    slate: { fg: FT.slate, bg: FT.slateL, bd: FT.border },
    gold: { fg: FT.gold, bg: FT.goldL, bd: "rgba(224,138,44,.25)" },
  };
  return map[tone];
}

// Palette des groupes de colonnes (en-têtes fusionnés façon Excel)
export const GROUP_PALETTE: Record<string, { fg: string; bg: string }> = {
  navy: { fg: FT.navy, bg: FT.blueL },
  gold: { fg: "#9A5B10", bg: FT.goldL },
  green: { fg: "#0B7A50", bg: FT.greenL },
  violet: { fg: "#5B21B6", bg: FT.violetL },
  cyan: { fg: "#0E6B80", bg: FT.cyanL },
  red: { fg: "#B91C1C", bg: FT.redL },
  slate: { fg: FT.textMid, bg: FT.slateL },
};
