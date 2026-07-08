// src/features/fuel-tracking/sheets/DashboardSheet.tsx
// Feuille DASHBOARD — synthèse mensuelle globale.

import { AlertTriangle, BarChart3, Droplets, Fuel, Gauge, ShieldCheck, ShieldX, Truck } from "lucide-react";
import type { FuelMonthlyRow } from "@/services/fuelTracking";
import { FT } from "../theme";
import { Card, ComingCell, KpiCard, Skeleton } from "../ui";
import { fmt, fmtL, n } from "../helpers";

export function DashboardSheet({ rows, kpis, loading }: { rows: FuelMonthlyRow[]; kpis: any; loading: boolean }) {
  if (loading) return <Skeleton h={420} />;

  const topRows = [...rows].sort((a, b) => n(b.enoc.quantity_added_liters) - n(a.enoc.quantity_added_liters)).slice(0, 8);
  const maxTop = Math.max(...topRows.map((x) => n(x.enoc.quantity_added_liters)), 1);

  const causes = [
    "Automatisme GE",
    "Carburant volé",
    "Faible autonomie",
    "Faible production solaire",
    "Mauvaise perf. solaire",
    "Besoin spare",
    "Coupure Grid",
    "Données erronées",
    "Sous investigation",
    "Autre",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <KpiCard label="Target BOQ Total" value="À venir" tone="slate" icon={<Gauge size={14} />} />
        <KpiCard label="Target Aktivco Total" value="À venir" sub="Après import REF_SITES" tone="slate" icon={<Gauge size={14} />} />
        <KpiCard label="Consommation ENOC" value={fmtL(kpis?.enoc_quantity_added_liters)} sub="Opérations terrain" tone="green" icon={<Truck size={14} />} />
        <KpiCard label="eFMS livré" value={fmtL(kpis?.fuel_deli_l)} sub="Données eFMS mensuelles" tone="blue" icon={<Fuel size={14} />} />
        <KpiCard label="Écart total" value={fmtL(kpis?.gap_deli_vs_enoc_l)} sub="ENOC réel − eFMS livré" tone="orange" icon={<Droplets size={14} />} />
        <KpiCard label="Sites OK" value={fmt.format(kpis?.ok ?? 0)} sub="Rapprochés" tone="green" icon={<ShieldCheck size={14} />} />
        <KpiCard label="Sites NOK" value={fmt.format(kpis?.nok ?? 0)} sub={`${fmt.format(kpis?.warning ?? 0)} à suivre`} tone="red" icon={<ShieldX size={14} />} />
        <KpiCard label="Stock critique" value="À venir" tone="slate" icon={<AlertTriangle size={14} />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr .7fr", gap: 14 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: FT.greenL, display: "grid", placeItems: "center", color: FT.green }}>
              <BarChart3 size={16} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: FT.text }}>Top sites — volume réel ENOC</div>
              <div style={{ fontSize: 12, color: FT.textSub }}>Classement des sites ayant des opérations terrain sur le mois.</div>
            </div>
          </div>

          {topRows.length === 0 ? (
            <div style={{ color: FT.textSub, fontSize: 13, padding: "30px 0", textAlign: "center" }}>Aucune donnée ENOC sur le mois.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topRows.map((row, index) => {
                const pct = (n(row.enoc.quantity_added_liters) / maxTop) * 100;
                return (
                  <div key={row.key} style={{ display: "grid", gridTemplateColumns: "26px 1fr 90px", gap: 10, alignItems: "center" }}>
                    <div style={{ color: FT.textSub, fontSize: 12, fontWeight: 800, textAlign: "right" }}>{index + 1}</div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                        <strong style={{ fontSize: 12.5, color: FT.text }}>{row.site_id || row.site_name}</strong>
                        <span style={{ fontSize: 11.5, color: FT.textSub }}>{row.enoc.movements_count} mouv.</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 99, background: FT.slateL, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${FT.green}, #34D399)`, borderRadius: 99 }} />
                      </div>
                    </div>
                    <strong style={{ color: FT.green, fontSize: 12.5, textAlign: "right" }}>{fmtL(row.enoc.quantity_added_liters)}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: FT.orangeL, display: "grid", placeItems: "center", color: FT.orange }}>
              <AlertTriangle size={16} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: FT.text }}>Causes surconsommation</div>
              <div style={{ fontSize: 12, color: FT.textSub }}>Rubrique du template, à arbitrer avec le client.</div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {causes.map((cause) => (
              <div
                key={cause}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "9px 11px",
                  borderRadius: 10,
                  border: `1px solid ${FT.border}`,
                  background: FT.slateL,
                }}
              >
                <span style={{ fontSize: 12, color: FT.textMid, fontWeight: 700 }}>{cause}</span>
                <ComingCell />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
