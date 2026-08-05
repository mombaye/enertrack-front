// src/features/fuel-tracking/sheets/DashboardSheet.tsx
// Feuille DASHBOARD — réplique exacte de la feuille Excel "Synthèse Commande"
// (fichier mensuel "Commande FUEL ESCO SENEGAL <mois>.xlsb") : import brut,
// aucun recalcul côté frontend, les valeurs affichées sont celles importées
// telles quelles. Mise en page calquée sur le fichier source (en-têtes
// fusionnés bleu marine, bandes alternées, lignes TOTAL en surbrillance).

import type { CSSProperties, ReactNode } from "react";
import { Layers3, Tags } from "lucide-react";
import type { FuelCommandeSyntheseResponse, FuelCommandeSyntheseRow } from "@/services/fuelTracking";
import { Card, EmptyState, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { fmt } from "../helpers";

const NAVY = "#0B1F4D";
const BAND = "#EAF1FB";
const GOLD = "#FBBF24";

function monthLabel(yyyymm: string | null | undefined) {
  if (!yyyymm) return "—";
  const [y, m] = yyyymm.split("-");
  const names = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  const idx = Number(m) - 1;
  return `${names[idx] ?? m} ${y}`;
}

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

function Num({ value, bold, color }: { value: number; bold?: boolean; color?: string }) {
  if (value === 0) return <span style={{ color: "#B6C1D6" }}>—</span>;
  return <span style={{ fontWeight: bold ? 800 : 600, fontFamily: "ui-monospace, Menlo, monospace", color }}>{fmt.format(value)}</span>;
}

function EcartCell({ value }: { value: number }) {
  if (value === 0) {
    return (
      <td style={{ ...td, textAlign: "right", color: FT.textSub }}>
        —
      </td>
    );
  }
  const positive = value > 0;
  return (
    <td
      style={{
        ...td,
        textAlign: "right",
        background: positive ? "#DCFCE7" : "#FEE2E2",
        color: positive ? "#15803D" : "#B91C1C",
        fontWeight: 800,
        fontFamily: "ui-monospace, Menlo, monospace",
      }}
    >
      {fmt.format(value)}
    </td>
  );
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
            const isGrandTotal = r.label.toUpperCase() === "TOTAL COMMANDE";
            const numColor = r.is_total_row ? (isGrandTotal ? GOLD : "#fff") : undefined;
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
                {r.is_total_row ? (
                  <>
                    <td style={{ ...td, textAlign: "right" }}><Num value={r.ecart_sites} bold color={numColor} /></td>
                    <td style={{ ...td, textAlign: "right" }}><Num value={r.ecart_qte_l} bold color={numColor} /></td>
                  </>
                ) : (
                  <>
                    <EcartCell value={r.ecart_sites} />
                    <EcartCell value={r.ecart_qte_l} />
                  </>
                )}
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
