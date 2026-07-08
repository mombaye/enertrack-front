// src/features/fuel-tracking/sheets/RefSitesSheet.tsx
// Feuille REF_SITES — référentiel enrichi Site EnerTrack / Site ENOC / GE ENOC.

import { Layers3 } from "lucide-react";
import type { FuelMonthlyRow } from "@/services/fuelTracking";
import { ExcelGrid, type ExcelGroup } from "../ExcelGrid";
import { Card, SheetTitle } from "../ui";
import { fmt2, fmtMaybeKva, fmtMaybeL, geBrand1, gePower1, n, realTypology, siteConfig, siteLoad, siteTypology, tankCapacity1 } from "../helpers";

export function RefSitesSheet({ rows, loading }: { rows: FuelMonthlyRow[]; loading: boolean }) {
  const groups: ExcelGroup<FuelMonthlyRow>[] = [
    {
      id: "ref",
      label: "Référentiel",
      color: "navy",
      columns: [
        { id: "site_id", header: "Site ID", width: 110, emphasis: true, render: (r) => r.site_id || "—" },
        { id: "site_name", header: "Site Name", width: 190, render: (r) => r.site_name || "—" },
        { id: "region", header: "Région", width: 120, render: (r) => r.zone_label || r.zone || r.enoc_site_ref?.region || "—" },
        { id: "batch", header: "Batch", width: 130, render: (r) => r.site_ref?.batch_operational || r.enoc_site_ref?.batch_operational || r.enoc_site_ref?.batch || "—" },
        { id: "typo_facturee", header: "Typo Facturée", width: 130, render: siteTypology },
        { id: "typo_reelle", header: "Typo Réelle", width: 130, render: realTypology },
        { id: "conf", header: "Conf", width: 80, render: siteConfig },
        { id: "priorite", header: "Priorité", width: 90, render: (r) => r.enoc_site_ref?.priority || "—" },
        { id: "load", header: "Load", width: 100, align: "right", render: (r) => (siteLoad(r) !== null ? fmt2.format(n(siteLoad(r))) : "—") },
        { id: "nb_ge", header: "Nb GE", width: 90, align: "right", render: (r) => r.enoc_site_ref?.nb_ge || "—" },
        { id: "ge_exist", header: "GE Exist", width: 100, align: "right", render: (r) => r.ge_ref?.assets_count || r.enoc_site_ref?.nb_ge || "—" },
        { id: "marque_ge1", header: "Marque GE1", width: 120, render: geBrand1 },
        { id: "kva1", header: "KVA GE1", width: 100, align: "right", render: (r) => fmtMaybeKva(gePower1(r)) },
        { id: "cuve1", header: "Cuve GE1", width: 120, align: "right", render: (r) => fmtMaybeL(tankCapacity1(r)) },
        { id: "rms", header: "RMS", width: 100, render: (r) => r.enoc_site_ref?.rms_installed || "—" },
        { id: "categorie", header: "Catégorie", width: 120, render: (r) => r.enoc_site_ref?.category || "—" },
        { id: "scope", header: "Scope", width: 120, render: (r) => r.site_ref?.scope_status || r.enoc_site_ref?.scope_initial || "—" },
        { id: "contrat", header: "Contrat", width: 140, render: (r) => r.site_ref?.contract_number || "—" },
        { id: "compteur", header: "Compteur", width: 140, render: (r) => r.site_ref?.meter_number || "—" },
      ],
    },
  ];

  return (
    <Card padded={false} style={{ padding: 20 }}>
      <SheetTitle icon={<Layers3 size={17} />} title="REF_SITES — Référentiel sites" subtitle="Référentiel enrichi depuis Site EnerTrack, Site ENOC et GE ENOC." />
      <div style={{ marginTop: 16 }}>
        <ExcelGrid groups={groups} rows={rows} rowKey={(r) => r.key} loading={loading} pinnedCount={1} showGroupHeader={false} emptyIcon={<Layers3 size={20} />} emptyTitle="Aucun référentiel disponible" />
      </div>
    </Card>
  );
}
