// src/features/fuel-tracking/sheets/CommandeSyntheseChart.tsx
// Vue graphique d'un bloc du Dashboard (Par catégorie/batch ou Par typologie
// facturée) — mêmes données brutes que le tableau (FuelCommandeSynthese),
// juste une autre façon de les visualiser : TOTAL (L) par ligne, mois
// courant vs mois précédent. Les lignes TOTAL/sous-totaux sont exclues du
// graphe (échelle trop différente des lignes détail, rendrait les autres
// barres illisibles) mais restent visibles dans la vue Tableau.

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";
import type { FuelCommandeSyntheseRow } from "@/services/fuelTracking";
import { EmptyState } from "../ui";
import { FT } from "../theme";
import { fmt } from "../helpers";

export function GroupBarChart({ rows, currentLabel, prevLabel }: { rows: FuelCommandeSyntheseRow[]; currentLabel: string; prevLabel: string }) {
  const detailRows = rows.filter((r) => !r.is_total_row);

  if (detailRows.length === 0) {
    return <EmptyState icon={<BarChart3 size={20} />} title="Rien à représenter" subtitle="Aucune ligne détail pour ce mois." />;
  }

  const data = detailRows.map((r) => ({ label: r.label, [currentLabel]: r.total_l, [prevLabel]: r.total_prev_l }));

  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 70 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={FT.border} vertical={false} />
        <XAxis dataKey="label" angle={-35} textAnchor="end" interval={0} height={90} tick={{ fontSize: 10.5, fill: FT.textMid }} />
        <YAxis tick={{ fontSize: 11, fill: FT.textMid }} tickFormatter={(v) => fmt.format(v)} />
        <Tooltip formatter={(v: number) => `${fmt.format(v)} L`} contentStyle={{ fontSize: 12.5, borderRadius: 10, border: `1px solid ${FT.border}` }} />
        <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
        <Bar dataKey={currentLabel} fill={FT.navy} radius={[4, 4, 0, 0]} />
        <Bar dataKey={prevLabel} fill={FT.blue} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
