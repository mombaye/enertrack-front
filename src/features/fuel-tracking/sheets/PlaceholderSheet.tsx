// src/features/fuel-tracking/sheets/PlaceholderSheet.tsx
// Rendu partagé pour les sous-parties pas encore automatisées (Dashboard en
// attendant que Consommation/Stock/Commande soient toutes alimentées, Stock
// et Commande en attendant leur propre chantier) — garde le même habillage
// visuel (Card + en-tête) que les onglets actifs, sans données.

import type { ReactNode } from "react";
import { Card, EmptyState, SheetTitle } from "../ui";
import { FT } from "../theme";

export function PlaceholderSheet({
  icon,
  title,
  subtitle,
  emptyTitle,
  emptyMessage,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyMessage: string;
}) {
  return (
    <Card padded={false} style={{ padding: 20 }}>
      <SheetTitle icon={icon} title={title} subtitle={subtitle} />
      <div style={{ marginTop: 8, borderTop: `1px solid ${FT.border}` }}>
        <EmptyState icon={icon} title={emptyTitle} subtitle={emptyMessage} />
      </div>
    </Card>
  );
}
