// src/features/fuel-tracking/sheets/ConsommationSheet.tsx
// Onglet CONSOMMATION — automatisé (pas d'upload) : jointure Snowflake
// (DB_GFMS_PROD.GOLD, conso mesurée par capteur) + ENOC (quantités validées
// par le fuel manager, lues directement depuis la base MongoDB d'ENOC —
// l'API REST est bloquée par filtrage IP côté ENOC, voir
// fuel_tracking/services/enoc_mongo_service.py). Les fichiers gardiens
// rejoindront ce tableau plus tard, une fois leur format défini.

import type { CSSProperties } from "react";
import { Droplets, Fuel, Gauge, Search, Users } from "lucide-react";
import type { FuelConsommationResponse } from "@/services/fuelTracking";
import { Card, EmptyState, KpiCard, Pager, Skeleton } from "../ui";
import { FT } from "../theme";
import { fmt, monthLabel } from "../helpers";

const th: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: FT.slateL,
  color: FT.text,
  fontSize: 10.5,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  textAlign: "center",
  padding: "9px 10px",
  borderBottom: `1px solid ${FT.borderStrong}`,
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  padding: "8px 10px",
  borderBottom: `1px solid ${FT.border}`,
  fontSize: 12.5,
  textAlign: "center",
  whiteSpace: "nowrap",
};

function NumCell({ value, digits = 0 }: { value: number | null; digits?: number }) {
  if (value === null || value === undefined) return <span style={{ color: FT.textSub }}>—</span>;
  if (value === 0) return <span style={{ color: FT.textSub }}>—</span>;
  return (
    <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>
      {value.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}
    </span>
  );
}

function formatL(value: number) {
  return `${fmt.format(value)} L`;
}

/** Conso ESTIMÉE (pas mesurée) — déduite de relevés de niveau de cuve ENOC
 * issus d'un import historique ponctuel, jamais au même niveau de confiance
 * que la conso Snowflake. Style visuellement distinct (italique, ton
 * différent) + info-bulle rappelant explicitement la réserve. */
function EstimatedCell({ value, nbReleves }: { value: number | null; nbReleves: number | null }) {
  if (value === null || value === undefined) return <span style={{ color: FT.textSub }}>—</span>;
  return (
    <span
      title={`Estimation à partir de ${nbReleves ?? "?"} relevé(s) de niveau de cuve ENOC (import historique ponctuel, pas une mesure en continu) — à prendre avec réserve.`}
      style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600, fontStyle: "italic", color: FT.gold, cursor: "help" }}
    >
      ≈ {value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: FT.textSub }}>—</span>;
  const ok = status === "MONITORED";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 999,
        fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em",
        background: ok ? FT.greenL : FT.redL, color: ok ? FT.green : FT.red,
      }}
    >
      {status}
    </span>
  );
}

function GeSourceBadge({ snowflake, enoc }: { snowflake: boolean; enoc: boolean }) {
  if (!snowflake && !enoc) return <span style={{ color: FT.textSub }}>—</span>;
  const label = snowflake && enoc ? "Snowflake + ENOC" : snowflake ? "Snowflake" : "ENOC";
  const tone = snowflake && enoc ? { bg: FT.blueL, fg: FT.navy } : snowflake ? { bg: FT.cyanL, fg: FT.cyan } : { bg: FT.greenL, fg: FT.green };
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 999,
        fontSize: 10, fontWeight: 800, background: tone.bg, color: tone.fg, whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

type GeFilter = "all" | "true" | "false";

function GeFilterButtons({
  value,
  onChange,
  kpis,
}: {
  value: GeFilter;
  onChange: (v: GeFilter) => void;
  kpis: FuelConsommationResponse["kpis"];
}) {
  const options: Array<{ key: GeFilter; label: string }> = [
    { key: "all", label: `Tous${kpis ? ` (${fmt.format(kpis.sites_avec_ge + kpis.sites_sans_ge)})` : ""}` },
    { key: "true", label: `Avec GE${kpis ? ` (${fmt.format(kpis.sites_avec_ge)})` : ""}` },
    { key: "false", label: `Sans GE${kpis ? ` (${fmt.format(kpis.sites_sans_ge)})` : ""}` },
  ];

  return (
    <div style={{ display: "inline-flex", gap: 3, padding: 4, borderRadius: 10, background: FT.slateL, border: `1px solid ${FT.border}` }}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              padding: "6px 11px", borderRadius: 7, border: "none",
              background: active ? "#fff" : "transparent", color: active ? FT.navy : FT.textMid,
              boxShadow: active ? FT.shadow : "none", fontSize: 11.5, fontWeight: 800, cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ConsommationKpis({ data, stickyTop }: { data: FuelConsommationResponse | undefined; stickyTop: number }) {
  const kpis = data?.kpis;
  if (!kpis) return null;

  const currentLabel = monthLabel(data?.month_year);
  const couverture = kpis.total_sites > 0 ? Math.round((kpis.sites_avec_conso / kpis.total_sites) * 100) : 0;

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        <KpiCard label="Sites avec données" value={`${fmt.format(kpis.sites_avec_conso)} / ${fmt.format(kpis.total_sites)}`} sub={`${currentLabel} · ${couverture}% de couverture`} tone="blue" icon={<Users size={14} />} />
        <KpiCard label="Sites avec GE" value={fmt.format(kpis.sites_avec_ge)} sub={`dont ${fmt.format(kpis.sites_ge_enoc_only)} vus uniquement par ENOC`} tone="gold" icon={<Fuel size={14} />} />
        <KpiCard label="Sites sans GE" value={fmt.format(kpis.sites_sans_ge)} tone="slate" icon={<Fuel size={14} />} />
        <KpiCard label="Conso mesurée (Snowflake)" value={formatL(kpis.total_conso_snowflake_l)} tone="cyan" icon={<Droplets size={14} />} />
        <KpiCard label="Qté ajoutée (ENOC validé)" value={formatL(kpis.total_enoc_qte_ajoutee_l)} tone="green" icon={<Fuel size={14} />} />
        <KpiCard label="Demandes ENOC" value={fmt.format(kpis.total_enoc_nb_demandes)} tone="blue" icon={<Gauge size={14} />} />
      </div>
    </div>
  );
}

export function ConsommationSheet({
  data,
  loading,
  search,
  onSearchChange,
  geFilter,
  onGeFilterChange,
  page,
  onPageChange,
  stickyTop = 0,
}: {
  data: FuelConsommationResponse | undefined;
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  geFilter: GeFilter;
  onGeFilterChange: (v: GeFilter) => void;
  page: number;
  onPageChange: (p: number) => void;
  stickyTop?: number;
}) {
  if (loading) return <Skeleton h={520} />;

  const rows = data?.data ?? [];
  const currentLabel = monthLabel(data?.month_year);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ConsommationKpis data={data} stickyTop={stickyTop + 14} />

      <Card padded={false} style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: FT.blueL, display: "grid", placeItems: "center", color: FT.navy, flexShrink: 0 }}>
              <Droplets size={17} />
            </div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: FT.text }}>Consommation par site — {currentLabel}</div>
              <div style={{ fontSize: 12.5, color: FT.textSub, marginTop: 3 }}>
                Automatisé — Snowflake (conso mesurée par capteur) + ENOC (quantités validées par le fuel manager). Aucun upload nécessaire.
                {data?.pagination && ` ${fmt.format(data.pagination.total)} site(s).`}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <GeFilterButtons value={geFilter} onChange={onGeFilterChange} kpis={data?.kpis ?? null} />
            <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px", minWidth: 220 }}>
              <Search size={14} color={FT.textSub} />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Site ID ou nom..."
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, flex: 1 }}
              />
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<Droplets size={20} />} title="Aucune donnée" subtitle="La synchronisation automatique n'a pas encore tourné pour ce mois." />
        ) : (
          <>
            <div style={{ overflow: "auto", maxHeight: 600, borderRadius: 12, border: `1px solid ${FT.border}` }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1350 }}>
                <thead>
                  <tr>
                    <th style={th}>Site ID</th>
                    <th style={th}>Nom du site</th>
                    <th style={th}>Typologie</th>
                    <th style={th}>Type de site</th>
                    <th style={th}>Source GE</th>
                    <th style={th}>Alimentation</th>
                    <th style={th}>Conso mesurée (L)</th>
                    <th style={th} title="Estimation à partir des relevés de niveau de cuve ENOC — pas une mesure, à prendre avec réserve (voir info-bulle des valeurs).">Conso estimée (L)</th>
                    <th style={th}>Conso spécifique (L/kWh)</th>
                    <th style={th}>Statut capteur</th>
                    <th style={th}>Qté ajoutée ENOC (L)</th>
                    <th style={th}>Nb demandes ENOC</th>
                    <th style={th}>Écart conso vs ENOC (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
                      <td style={{ ...td, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.site_id}</td>
                      <td style={td}>{r.site_name || "—"}</td>
                      <td style={td}>{r.typology || "—"}</td>
                      <td style={td}>{r.site_type || "—"}</td>
                      <td style={td}><GeSourceBadge snowflake={r.has_genset_snowflake} enoc={r.has_genset_enoc} /></td>
                      <td style={td}>{r.power_supply || "—"}</td>
                      <td style={td}><NumCell value={r.conso_snowflake_l} /></td>
                      <td style={td}><EstimatedCell value={r.conso_estimee_enoc_l} nbReleves={r.conso_estimee_nb_releves} /></td>
                      <td style={td}><NumCell value={r.conso_specifique_moy_l_kwh} digits={3} /></td>
                      <td style={td}><StatusBadge status={r.sensor_status} /></td>
                      <td style={td}><NumCell value={r.enoc_qte_ajoutee_l} /></td>
                      <td style={td}>{r.enoc_nb_demandes || "—"}</td>
                      <td style={td}><NumCell value={r.ecart_conso_vs_enoc_l} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data?.pagination && (
              <Pager
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                hasPrev={data.pagination.hasPrev}
                hasNext={data.pagination.hasNext}
                onPrev={() => onPageChange(Math.max(1, page - 1))}
                onNext={() => onPageChange(page + 1)}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
