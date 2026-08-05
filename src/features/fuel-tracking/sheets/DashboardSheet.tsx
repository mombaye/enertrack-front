// src/features/fuel-tracking/sheets/DashboardSheet.tsx
// Feuille DASHBOARD — réplique exacte de la feuille Excel "Synthèse Commande"
// (fichier mensuel "Commande FUEL ESCO SENEGAL <mois>.xlsb") : import brut,
// aucun recalcul côté frontend, les valeurs affichées sont celles importées
// telles quelles. Mise en page calquée sur le fichier source (en-têtes
// fusionnés bleu marine, bandes alternées, lignes TOTAL en surbrillance).

import type { CSSProperties, ReactNode } from "react";
import { CalendarX2, Layers3, Tags } from "lucide-react";
import type { FuelCommandeSyntheseResponse, FuelCommandeSyntheseRow } from "@/services/fuelTracking";
import { Card, EmptyState, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { fmt, monthLabel } from "../helpers";

const NAVY = "#0B1F4D";
const BAND = "#EAF1FB";

const th: CSSProperties = {
  background: NAVY,
  color: "#fff",
  fontSize: 10.5,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  textAlign: "center",
  padding: "7px 8px",
  border: "1px solid rgba(255,255,255,.16)",
  whiteSpace: "nowrap",
};

/**
 * Format identique au fichier Excel source : zéro affiché "—", négatif entre
 * parenthèses sans signe moins (convention comptable utilisée dans le
 * fichier). Aucune coloration ajoutée ici — on n'a pas accès à la mise en
 * forme conditionnelle du fichier (elle n'est pas toujours cohérente avec le
 * simple signe de la valeur), donc on ne l'invente pas : les données sont
 * sensibles, on affiche la valeur telle quelle plutôt qu'une interprétation.
 */
function Num({ value, bold, color }: { value: number; bold?: boolean; color?: string }) {
  if (value === 0) return <span style={{ color: color ?? "#B6C1D6" }}>—</span>;
  const text = value < 0 ? `(${fmt.format(Math.abs(value))})` : fmt.format(value);
  return <span style={{ fontWeight: bold ? 800 : 600, fontFamily: "ui-monospace, Menlo, monospace", color }}>{text}</span>;
}

const td: CSSProperties = {
  padding: "7px 10px",
  border: `1px solid ${FT.border}`,
  fontSize: 12.5,
};

function SyntheseTable({
  labelHeader,
  currentLabel,
  prevLabel,
  rows,
  emptyIcon,
  emptyTitle,
}: {
  labelHeader: string;
  currentLabel: string;
  prevLabel: string;
  rows: FuelCommandeSyntheseRow[];
  emptyIcon: ReactNode;
  emptyTitle: string;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} subtitle="Importe le fichier Excel mensuel via le bouton « Importer »." />;
  }

  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${FT.border}` }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1100 }}>
        <thead>
          <tr>
            <th rowSpan={3} style={{ ...th, textAlign: "left", minWidth: 190 }}>{labelHeader}</th>
            <th colSpan={10} style={th}>COMMANDE (L)</th>
            <th rowSpan={3} style={{ ...th, minWidth: 200 }}>COMMENTAIRES</th>
          </tr>
          <tr>
            <th colSpan={4} style={th}>{currentLabel}</th>
            <th colSpan={4} style={th}>{prevLabel}</th>
            <th colSpan={2} style={th}>ECART</th>
          </tr>
          <tr>
            <th style={th}>Nbre de Site</th>
            <th style={th}>Commande Normale</th>
            <th style={th}>Commande Saison Hivernale</th>
            <th style={th}>TOTAL</th>
            <th style={th}>Nbre de Site</th>
            <th style={th}>Commande Normale</th>
            <th style={th}>Commande Saison Hivernale</th>
            <th style={th}>TOTAL</th>
            <th style={th}>Site</th>
            <th style={th}>Qté</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const numColor = r.is_total_row ? "#fff" : undefined;
            const rowStyle: CSSProperties = r.is_total_row
              ? { background: NAVY, color: "#fff" }
              : { background: i % 2 === 0 ? BAND : "#fff" };
            return (
              <tr key={`${r.label}-${i}`} style={rowStyle}>
                <td style={{ ...td, fontWeight: r.is_total_row ? 800 : 700, color: r.is_total_row ? "#fff" : FT.text }}>{r.label}</td>
                <td style={{ ...td, textAlign: "right" }}><Num value={r.nb_sites} bold={r.is_total_row} color={numColor} /></td>
                <td style={{ ...td, textAlign: "right" }}><Num value={r.commande_normale_l} bold={r.is_total_row} color={numColor} /></td>
                <td style={{ ...td, textAlign: "right" }}><Num value={r.commande_hivernale_l} bold={r.is_total_row} color={numColor} /></td>
                <td style={{ ...td, textAlign: "right" }}><Num value={r.total_l} bold color={numColor} /></td>
                <td style={{ ...td, textAlign: "right" }}><Num value={r.nb_sites_prev} bold={r.is_total_row} color={numColor} /></td>
                <td style={{ ...td, textAlign: "right" }}><Num value={r.commande_normale_prev_l} bold={r.is_total_row} color={numColor} /></td>
                <td style={{ ...td, textAlign: "right" }}><Num value={r.commande_hivernale_prev_l} bold={r.is_total_row} color={numColor} /></td>
                <td style={{ ...td, textAlign: "right" }}><Num value={r.total_prev_l} bold color={numColor} /></td>
                <td style={{ ...td, textAlign: "right" }}><Num value={r.ecart_sites} bold={r.is_total_row} color={numColor} /></td>
                <td style={{ ...td, textAlign: "right" }}><Num value={r.ecart_qte_l} bold={r.is_total_row} color={numColor} /></td>
                <td style={{ ...td, color: r.is_total_row ? "#fff" : FT.textMid }}>{r.commentaires || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardSheet({ data, loading }: { data: FuelCommandeSyntheseResponse | undefined; loading: boolean }) {
  if (loading) return <Skeleton h={520} />;

  const currentLabel = monthLabel(data?.month_year);
  const prevLabel = monthLabel(data?.prev_month_year);

  const hasNoDataForMonth = !!data?.month_year && data.categorie.length === 0 && data.typologie.length === 0;

  if (hasNoDataForMonth) {
    return (
      <Card padded={false} style={{ padding: 20 }}>
        <EmptyState
          icon={<CalendarX2 size={22} />}
          title={`Aucune donnée importée pour ${currentLabel}`}
          subtitle={`Le fichier "Commande FUEL ESCO SENEGAL" n'a pas encore été importé pour ce mois. Utilise le bouton « Importer » du header, ou choisis un autre mois dans le filtre.`}
        />
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card padded={false} style={{ padding: 20 }}>
        <SheetTitle
          icon={<Layers3 size={17} />}
          title="Par catégorie / batch"
          subtitle={`Import brut de la feuille "Synthèse Commande" — ${currentLabel} vs ${prevLabel}. Aucun recalcul, valeurs identiques au fichier source.`}
        />
        <div style={{ marginTop: 16 }}>
          <SyntheseTable
            labelHeader="CATEGORIE"
            currentLabel={currentLabel}
            prevLabel={prevLabel}
            rows={data?.categorie ?? []}
            emptyIcon={<Layers3 size={20} />}
            emptyTitle="Aucune synthèse commande importée"
          />
        </div>
      </Card>

      <Card padded={false} style={{ padding: 20 }}>
        <SheetTitle
          icon={<Tags size={17} />}
          title="Par typologie facturée"
          subtitle={`Import brut de la feuille "Synthèse Commande" — ${currentLabel} vs ${prevLabel}. Aucun recalcul, valeurs identiques au fichier source.`}
        />
        <div style={{ marginTop: 16 }}>
          <SyntheseTable
            labelHeader="Typologie facturée"
            currentLabel={currentLabel}
            prevLabel={prevLabel}
            rows={data?.typologie ?? []}
            emptyIcon={<Tags size={20} />}
            emptyTitle="Aucune synthèse commande importée"
          />
        </div>
      </Card>
    </div>
  );
}
