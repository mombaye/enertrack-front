// src/features/fuel-tracking/sheets/ConsommationSheet.tsx
// Onglet SUIVIS CONSOMMATIONS — un seul tableau opérationnel : conso estimée CPH et
// conso mesurée par site sur les dates exactes (ConsoEstimeeSection). Au-dessus, les
// indicateurs mensuels de référence (fichier Stan, mesure capteur VW_FUEL_REPORT) et,
// à la demande, l'audit de détection GE Snowflake / ENOC. L'ancien tableau mensuel
// « Consommation par site » (filtres, pagination et compteurs propres) est supprimé.

import { useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Droplets, Fuel, Gauge, PieChart as PieChartIcon, Users } from "lucide-react";
import { type FuelConsommationResponse, type FuelGeDetectionFilter } from "@/services/fuelTracking";
import { KpiCard, Modal, Skeleton } from "../ui";
import { FT } from "../theme";
import { ConsoEstimeeSection } from "./ConsoEstimeeSection";
import { fmt, monthLabel } from "../helpers";

function ConsommationKpis({ data, stickyTop }: { data: FuelConsommationResponse | undefined; stickyTop: number }) {
  const kpis = data?.kpis;
  if (!kpis) return null;

  const currentLabel = monthLabel(data?.month_year);

  return (
    <div
      style={{
        position: "sticky",
        top: stickyTop,
        zIndex: 9,
        background: FT.card,
        borderRadius: FT.radius,
        border: `1px solid ${FT.border}`,
        boxShadow: FT.shadow,
        padding: 14,
      }}
    >
      {/* Stan KPIs — dénominateur officiel Ops (Facturation avec GE = Oui) */}
      {!kpis.stan_importe && (
        <div style={{ marginTop: 0, marginBottom: 10, padding: "8px 12px", borderRadius: 6, background: "#fffbe6", border: "1px solid #ffe58f", color: "#ad6800", fontSize: 12 }}>
          ⚠ Fichier Stan non importé pour {currentLabel} — lancez <code>import_facturation_par_site</code> pour afficher les KPIs de couverture GE officiels.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        <KpiCard label="Sites GE validés Stan" value={fmt.format(kpis.sites_ge_valides_stan)} sub="Facturation avec GE = Oui · référentiel Ops" tone="blue" icon={<Users size={14} />} />
        <KpiCard
          label="Sites avec conso mesurée (mois)"
          value={fmt.format(kpis.sites_avec_conso)}
          sub="mesure capteur, filtre strict : chute de niveau détectée (VW_FUEL_REPORT) — ce n'est pas une couverture CPH"
          tone="green"
          icon={<Fuel size={14} />}
        />
        <KpiCard
          label="Sites avec relevés bruts"
          value={fmt.format(kpis.sites_avec_donnees_brutes)}
          sub="au moins un relevé brut (raw_point_count > 0) ≈ Power BI"
          tone="cyan"
          icon={<Gauge size={14} />}
        />
        <KpiCard
          label="Conso mesurée totale"
          value={`${fmt.format(kpis.total_conso_snowflake_l)} L`}
          sub={`${currentLabel} · capteurs Snowflake`}
          tone="slate"
          icon={<Droplets size={14} />}
        />
      </div>
      <div style={{ marginTop: 10, fontSize: 11.5, color: FT.textSub }}>
        Indicateurs mensuels ({currentLabel}) de mesure capteur. Conso estimée CPH, couvertures distinctes et comparaison avec la
        conso mesurée : tableau ci-dessous, sur les dates exactes choisies. Audit jour par jour : onglet <strong>Contrôle CPH</strong>.
      </div>
    </div>
  );
}

export const DETECTION_LABELS: Record<FuelGeDetectionFilter, string> = {
  avec_ge: "Avec GE (Snowflake OU ENOC)",
  sans_ge: "Sans GE",
  avec_ge_snowflake: "Détectés par Snowflake (DG_COUNT>0)",
  avec_ge_enoc: "Détectés par ENOC",
  vus_seulement_enoc: "Vus seulement par ENOC",
  vus_seulement_snowflake: "Vus seulement par Snowflake",
  vus_par_les_deux: "Vus par les deux",
  sites_dans_fichier: "Sites dans le(s) fichier(s)",
  dans_fichier_et_ge: "Dans le fichier ET Snowflake/ENOC confirment GE",
  dans_fichier_sans_ge: "Dans le fichier mais Snowflake/ENOC ne voient pas de GE",
  ge_hors_fichier: "Snowflake/ENOC voient un GE, absent des fichiers",
};

type DonutSegment = { key: FuelGeDetectionFilter; label: string; value: number; color: string };

function DetectionDonut({
  title,
  segments,
  activeDetection,
  onToggle,
}: {
  title: string;
  segments: DonutSegment[];
  activeDetection: FuelGeDetectionFilter | null;
  onToggle: (key: FuelGeDetectionFilter) => void;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div style={{ flex: "1 1 260px", minWidth: 240 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ width: 140, height: 140, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={segments}
                dataKey="value"
                nameKey="label"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={2}
                strokeWidth={0}
                onClick={(entry: any) => onToggle(entry.payload?.key ?? entry.key)}
                cursor="pointer"
              >
                {segments.map((s) => (
                  <Cell
                    key={s.key}
                    fill={s.color}
                    opacity={activeDetection && activeDetection !== s.key && segments.some((seg) => seg.key === activeDetection) ? 0.35 : 1}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: number, _name: string, entry: any) => [`${fmt.format(value)} site(s)`, entry?.payload?.label]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 130 }}>
          {segments.map((s) => (
            <div
              key={s.key}
              onClick={() => onToggle(s.key)}
              title="Cliquer pour voir ces sites dans le tableau ci-dessous"
              style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                borderRadius: 7, padding: "3px 6px", margin: "-3px -6px",
                background: activeDetection === s.key ? FT.blueL : "transparent",
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 999, background: s.color, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: activeDetection === s.key ? FT.blue : FT.text, fontFamily: "ui-monospace, Menlo, monospace" }}>
                  {fmt.format(s.value)} <span style={{ fontSize: 10.5, fontWeight: 700, color: FT.textSub }}>({total > 0 ? Math.round((s.value / total) * 100) : 0}%)</span>
                </div>
                <div style={{ fontSize: 10.5, color: FT.textSub }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type BarDatum = { key: FuelGeDetectionFilter; label: string; value: number; color: string };

function DetectionBarChart({
  title,
  bars,
  activeDetection,
  onToggle,
}: {
  title: string;
  bars: BarDatum[];
  activeDetection: FuelGeDetectionFilter | null;
  onToggle: (key: FuelGeDetectionFilter) => void;
}) {
  return (
    <div style={{ flex: "1 1 240px", minWidth: 220 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ height: 132 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} layout="vertical" margin={{ top: 2, right: 16, bottom: 2, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 10.5, fill: FT.textMid }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value: number) => [`${fmt.format(value)} site(s)`, ""]} cursor={{ fill: FT.slateL }} />
            <Bar
              dataKey="value"
              radius={[0, 5, 5, 0]}
              barSize={20}
              onClick={(entry: any) => onToggle(entry.payload?.key ?? entry.key)}
              cursor="pointer"
              label={{ position: "right", fontSize: 11, fontWeight: 800, fill: FT.text, formatter: (v: any) => fmt.format(Number(v)) }}
            >
              {bars.map((b) => (
                <Cell key={b.key} fill={activeDetection === b.key ? FT.blue : b.color} opacity={activeDetection && activeDetection !== b.key ? 0.5 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GeDetectionPanel({
  detection,
  activeDetection,
  onDetectionChange,
}: {
  detection: FuelConsommationResponse["ge_detection"];
  activeDetection: FuelGeDetectionFilter | null;
  onDetectionChange: (key: FuelGeDetectionFilter | null) => void;
}) {
  if (!detection) return null;

  const toggle = (key: FuelGeDetectionFilter) => onDetectionChange(activeDetection === key ? null : key);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: FT.text }}>
          Détection GE — Snowflake / ENOC seuls (audit, avant correction Typo simple)
        </div>
        {activeDetection && (
          <button
            onClick={() => onDetectionChange(null)}
            style={{ border: "none", background: FT.slateL, color: FT.textMid, cursor: "pointer", fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "4px 10px" }}
          >
            Réinitialiser le filtre ×
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, color: FT.textSub, marginBottom: 14 }}>
        Ces chiffres reflètent uniquement Snowflake/ENOC, sans la règle Typo simple appliquée ailleurs sur cette page
        (où tout site du fichier dont Typo simple mentionne GE compte Avec GE, même si Snowflake/ENOC disent le contraire).
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10 }}>
        <DetectionDonut
          title={`Couverture GE — réseau (${fmt.format(detection.total_sites)} sites)`}
          segments={[
            { key: "avec_ge", label: DETECTION_LABELS.avec_ge, value: detection.avec_ge, color: FT.blue },
            { key: "sans_ge", label: DETECTION_LABELS.sans_ge, value: detection.sans_ge, color: FT.slate },
          ]}
          activeDetection={activeDetection}
          onToggle={toggle}
        />
        <DetectionDonut
          title={`Avec GE, par source (${fmt.format(detection.avec_ge)} sites)`}
          segments={[
            { key: "vus_seulement_enoc", label: DETECTION_LABELS.vus_seulement_enoc, value: detection.vus_seulement_enoc, color: FT.gold },
            { key: "vus_seulement_snowflake", label: DETECTION_LABELS.vus_seulement_snowflake, value: detection.vus_seulement_snowflake, color: FT.cyan },
            { key: "vus_par_les_deux", label: DETECTION_LABELS.vus_par_les_deux, value: detection.vus_par_les_deux, color: FT.green },
          ]}
          activeDetection={activeDetection}
          onToggle={toggle}
        />
      </div>

      <div style={{ borderTop: `1px solid ${FT.border}`, paddingTop: 14, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <DetectionDonut
          title={`Sites du fichier — vs avis Snowflake/ENOC (${fmt.format(detection.sites_dans_fichier)} sites)`}
          segments={[
            { key: "dans_fichier_et_ge", label: DETECTION_LABELS.dans_fichier_et_ge, value: detection.dans_fichier_et_ge, color: FT.green },
            { key: "dans_fichier_sans_ge", label: DETECTION_LABELS.dans_fichier_sans_ge, value: detection.dans_fichier_sans_ge, color: FT.orange },
          ]}
          activeDetection={activeDetection}
          onToggle={toggle}
        />
        <div style={{ flex: "1 1 260px", minWidth: 240 }}>
          <DetectionBarChart
            title="Totaux bruts (catégories non exclusives)"
            bars={[
              { key: "ge_hors_fichier", label: DETECTION_LABELS.ge_hors_fichier, value: detection.ge_hors_fichier, color: FT.red },
              { key: "avec_ge_snowflake", label: DETECTION_LABELS.avec_ge_snowflake, value: detection.avec_ge_snowflake, color: FT.cyan },
              { key: "avec_ge_enoc", label: DETECTION_LABELS.avec_ge_enoc, value: detection.avec_ge_enoc, color: FT.gold },
            ]}
            activeDetection={activeDetection}
            onToggle={toggle}
          />
          <div style={{ fontSize: 10.5, color: FT.textSub, lineHeight: 1.5, marginTop: 6 }}>
            Les {fmt.format(detection.dans_fichier_sans_ge)} sites « GE non confirmé » comptent quand même Avec GE partout ailleurs sur cette page (Typo simple mentionne GE pour les {fmt.format(detection.sites_dans_fichier)} sites du fichier).
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConsommationSheet({
  data,
  loading,
  stickyTop = 0,
}: {
  data: FuelConsommationResponse | undefined;
  loading: boolean;
  stickyTop?: number;
}) {
  const [showDetectionModal, setShowDetectionModal] = useState(false);
  const [activeDetection, setActiveDetection] = useState<FuelGeDetectionFilter | null>(null);
  if (loading) return <Skeleton h={520} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ConsommationKpis data={data} stickyTop={stickyTop + 14} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setShowDetectionModal(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`,
            background: FT.card, color: FT.text, cursor: "pointer", fontSize: 12.5, fontWeight: 800,
            borderRadius: 10, padding: "9px 14px", boxShadow: FT.shadow,
          }}
        >
          <PieChartIcon size={14} color={FT.blue} aria-hidden /> Voir informations Détection GE
        </button>
      </div>

      {showDetectionModal && (
        <Modal title="Détection GE — Snowflake / ENOC seuls" onClose={() => setShowDetectionModal(false)} maxWidth={900}>
          <GeDetectionPanel detection={data?.ge_detection} activeDetection={activeDetection} onDetectionChange={setActiveDetection} />
        </Modal>
      )}

      <ConsoEstimeeSection month={data?.month_year} />
    </div>
  );
}
