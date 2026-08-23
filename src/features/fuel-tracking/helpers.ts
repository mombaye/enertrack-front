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

// Seuils Stock — partagés entre StockSheet (FillBar/DateCell) et le
// Dashboard, pour ne pas dupliquer les mêmes nombres à 3 endroits.
export const STOCK_FILL_CRITICAL = 15; // % — en dessous : cuve critique
export const STOCK_FILL_WARNING = 40;  // % — en dessous : alerte
export const STOCK_AGING_DAYS = 7;     // jours — au-delà : relevé qui vieillit
export const STOCK_STALE_DAYS = 15;    // jours — au-delà : relevé considéré périmé
