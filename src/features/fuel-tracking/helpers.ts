// src/features/fuel-tracking/helpers.ts
// Fonctions pures de formatage — partagées entre le header et le Dashboard.

export const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

const MONTH_NAMES = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export function monthLabel(yyyymm: string | null | undefined) {
  if (!yyyymm) return "—";
  const [y, m] = yyyymm.split("-");
  const idx = Number(m) - 1;
  return `${MONTH_NAMES[idx] ?? m} ${y}`;
}

/** Décale un mois "YYYY-MM" de `delta` mois (négatif pour reculer). */
export function shiftMonth(yyyymm: string, delta: number) {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
