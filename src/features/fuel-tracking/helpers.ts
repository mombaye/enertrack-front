// src/features/fuel-tracking/helpers.ts
// Fonctions pures de formatage — partagées entre le header et le Dashboard.

export const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
