// src/features/fuel-tracking/sheets/OtherSheets.tsx
// Feuilles STOCK_DÉPÔT, CPH et LISTES — structure conservée pour la V2.

import { Gauge, ListChecks, Warehouse } from "lucide-react";
import type { CphMatrixEngine } from "@/services/fuelTracking";
import { ExcelGrid, type ExcelGroup } from "../ExcelGrid";
import { Card, SheetTitle } from "../ui";
import { FT } from "../theme";

type StockRow = { id: string };

export function StockDepotSheet() {
  const groups: ExcelGroup<StockRow>[] = [
    {
      id: "stock",
      label: "Mouvements dépôt central",
      color: "slate",
      columns: [
        { id: "date", header: "Date", width: 120, render: () => "—" },
        { id: "fournisseur", header: "Fournisseur", width: 150, render: () => "—" },
        { id: "bl", header: "N° BL", width: 120, render: () => "—" },
        { id: "entree", header: "Entrée (L)", width: 110, render: () => "—" },
        { id: "sortie_vers", header: "Sortie vers site", width: 130, render: () => "—" },
        { id: "site_dest", header: "Site Destinataire", width: 150, render: () => "—" },
        { id: "qte_sortie", header: "Quantité sortie (L)", width: 150, render: () => "—" },
        { id: "solde_depot", header: "Solde Dépôt (L)", width: 140, render: () => "—" },
        { id: "solde_theo", header: "Solde Théorique (L)", width: 150, render: () => "—" },
        { id: "ecart_depot", header: "Écart Dépôt (L)", width: 140, render: () => "—" },
        { id: "responsable", header: "Responsable", width: 140, render: () => "—" },
        { id: "commentaire", header: "Commentaire", width: 180, render: () => "—" },
      ],
    },
  ];

  return (
    <Card padded={false} style={{ padding: 20 }}>
      <SheetTitle icon={<Warehouse size={17} />} title="STOCK_DÉPÔT — Entrées fournisseurs / sorties vers sites" subtitle="Structure de la feuille conservée pour préparer la V2." />
      <div style={{ marginTop: 16 }}>
        <ExcelGrid groups={groups} rows={[]} rowKey={(r) => r.id} pinnedCount={0} emptyIcon={<Warehouse size={20} />} emptyTitle="Module à venir" emptySubtitle="Le suivi du stock au dépôt central sera intégré après validation client." />
      </div>
    </Card>
  );
}

const CPH_STEPS = ["0", "0.1", "0.15", "0.2", "0.25", "0.3", "0.35", "0.4", "0.45", "0.5", "0.55", "0.6", "0.65", "0.7", "0.75", "0.8", "0.85", "0.9", "0.95", "1"];

type CphRow = { key: string; moteur: string; kva: number; values: Record<string, number> };

export function CphSheet({ data, loading }: { data: CphMatrixEngine[]; loading: boolean }) {
  const rows: CphRow[] = data.flatMap((engine) =>
    engine.rows.map((row) => ({
      key: `${engine.engine_family}-${row.dg_capacity_kva}`,
      moteur: engine.engine_family,
      kva: row.dg_capacity_kva,
      values: row.values,
    }))
  );

  const groups: ExcelGroup<CphRow>[] = [
    {
      id: "cph",
      label: "Matrice consommation horaire par % de charge",
      color: "navy",
      columns: [
        { id: "moteur", header: "Moteur", width: 130, emphasis: true, render: (r) => r.moteur },
        { id: "kva", header: "DGCapacity (KVA)", width: 140, align: "right", render: (r) => `${r.kva} kVA` },
        ...CPH_STEPS.map((s) => ({
          id: `s${s}`,
          header: s === "1" ? "100%" : `${Number(s) * 100}%`,
          width: 70,
          align: "right" as const,
          render: (r: CphRow) => (r.values[s] !== undefined ? r.values[s].toFixed(2) : "—"),
        })),
      ],
    },
  ];

  return (
    <Card padded={false} style={{ padding: 20 }}>
      <SheetTitle
        icon={<Gauge size={17} />}
        title="CPH — Matrice consommation horaire"
        subtitle="Import réel depuis le fichier Suivi Ravitaillement (feuille CPH). Seule la famille Perkins est renseignée à ce jour — les autres moteurs suivront quand la donnée sera disponible."
      />
      <div style={{ marginTop: 16 }}>
        <ExcelGrid
          groups={groups}
          rows={rows}
          rowKey={(r) => r.key}
          loading={loading}
          pinnedCount={1}
          showGroupHeader
          emptyIcon={<Gauge size={20} />}
          emptyTitle="Aucune matrice CPH importée"
        />
      </div>
    </Card>
  );
}

type ListRow = {
  type_action: string;
  statut: string;
  causes: string;
  fournisseurs: string;
  methode_jauge: string;
  validateurs: string;
  conf: string;
  priorite: string;
};

const LISTES_ROWS: ListRow[] = [
  { type_action: "Dépotage", statut: "En cours", causes: "Automatisme GE", fournisseurs: "SAR", methode_jauge: "Toise", validateurs: "Chef Exploitation", conf: "IN", priorite: "P1" },
  { type_action: "Transfert inter-sites", statut: "Soldé", causes: "Carburant volé", fournisseurs: "TOTAL Sénégal", methode_jauge: "Capteur fuel", validateurs: "Superviseur", conf: "OD", priorite: "P2" },
  { type_action: "Ajout manuel", statut: "Partiel", causes: "Faible autonomie", fournisseurs: "TOUBA OIL", methode_jauge: "Jauge visuelle", validateurs: "Directeur Opérations", conf: "—", priorite: "P3" },
  { type_action: "Prélèvement", statut: "Annulé", causes: "Faible production solaire", fournisseurs: "Autre", methode_jauge: "Débitmètre", validateurs: "Contrôleur", conf: "—", priorite: "P4" },
  { type_action: "Correction", statut: "—", causes: "Mauvaise perf. solaire", fournisseurs: "—", methode_jauge: "—", validateurs: "—", conf: "—", priorite: "P5" },
];

export function ListesSheet() {
  const groups: ExcelGroup<ListRow>[] = [
    {
      id: "listes",
      label: "Valeurs de référence",
      color: "slate",
      columns: [
        { id: "type_action", header: "type_action", width: 170, emphasis: true, render: (r) => r.type_action },
        { id: "statut", header: "statut", width: 110, render: (r) => r.statut },
        { id: "causes", header: "causes", width: 220, render: (r) => r.causes },
        { id: "fournisseurs", header: "fournisseurs", width: 140, render: (r) => r.fournisseurs },
        { id: "methode_jauge", header: "methode_jauge", width: 140, render: (r) => r.methode_jauge },
        { id: "validateurs", header: "validateurs", width: 170, render: (r) => r.validateurs },
        { id: "conf", header: "conf", width: 80, render: (r) => r.conf },
        { id: "priorite", header: "priorite", width: 90, render: (r) => r.priorite },
      ],
    },
  ];

  return (
    <Card padded={false} style={{ padding: 20 }}>
      <SheetTitle icon={<ListChecks size={17} />} title="LISTES — Paramétrage" subtitle="Valeurs de référence du template Excel. Administrables en V2." />
      <div style={{ marginTop: 16 }}>
        <ExcelGrid groups={groups} rows={LISTES_ROWS} rowKey={(r) => r.type_action} pinnedCount={1} />
      </div>
      <div style={{ marginTop: 14, padding: "11px 13px", borderRadius: 10, background: FT.blueL, color: FT.navy, border: `1px solid rgba(37,99,235,.18)`, fontSize: 12, fontWeight: 700 }}>
        Ces listes deviendront administrables directement depuis l'interface en V2.
      </div>
    </Card>
  );
}
