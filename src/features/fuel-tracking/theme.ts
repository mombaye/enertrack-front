// src/features/fuel-tracking/theme.ts
// Palette et tokens visuels du module Suivi Carburant — harmonisé avec l'identité
// bleu-900/blanc Camusat utilisée sur les modules Financial/BO/Facturation.

export const FT = {
  // Fond de page
  pageBg: "linear-gradient(180deg,#F8FAFC 0%,#EEF4FF 100%)",

  // Bannière d'en-tête
  headerGrad: "linear-gradient(135deg, #0B1F4D 0%, #123C8C 45%, #1A56C4 75%, #3272E0 100%)",

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
  navy: "#0B1F4D",
  navyDeep: "#081A3D",
  gold: "#1A56C4",
  goldL: "#E4EFFE",

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

  radius: 10,
  radiusSm: 7,
  shadow: "0 1px 2px rgba(15,23,42,.04), 0 1px 1px rgba(15,23,42,.03)",
  shadowLg: "0 4px 20px -8px rgba(11,31,77,.35)",
  borderCrisp: "1px solid #E4E9F0",
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
    gold: { fg: FT.gold, bg: FT.goldL, bd: "rgba(26,86,196,.22)" },
  };
  return map[tone];
}

// Palette des groupes de colonnes (en-têtes fusionnés façon Excel) — dégradé de
// bleus/neutres cohérent avec l'identité Camusat ; le rouge reste réservé aux
// groupes de contrôle/alerte pour garder un vrai signal visuel.
export const GROUP_PALETTE: Record<string, { fg: string; bg: string }> = {
  navy: { fg: "#0B1F4D", bg: "#E4EFFE" },
  gold: { fg: "#123C8C", bg: "#EAF1FE" },
  green: { fg: "#1A56C4", bg: "#F0F5FC" },
  violet: { fg: "#2464D6", bg: "#EEF4FE" },
  cyan: { fg: "#475569", bg: "#F1F5F9" },
  red: { fg: "#B91C1C", bg: FT.redL },
  slate: { fg: FT.textMid, bg: FT.slateL },
};
