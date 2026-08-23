// src/features/fuel-tracking/sheets/StockSheet.tsx
// Onglet Suivis Stock — automatisé (pas d'upload) : jointure Snowflake
// (VW_FUEL_REPORT, dernier relevé de niveau de cuve physiquement valide par
// site sur une fenêtre glissante de 30 jours) + ENOC (fuel_level_readings,
// dernier relevé), voir fuel_tracking/services/fuel_stock_snowflake.py et
// enoc_mongo_service.py::fetch_stock_readings. Contrairement à Consommation,
// pas de notion de mois : le stock est un état à un instant T, remplacé en
// totalité à chaque sync (sync_fuel_stock) — 2 sources indépendantes,
// jamais fusionnées.

import type { CSSProperties } from "react";
import { Droplets, Fuel, Gauge, Search, Users, Warehouse } from "lucide-react";
import type { FuelStockResponse } from "@/services/fuelTracking";
import { Card, EmptyState, KpiCard, Pager, Skeleton } from "../ui";
import { FT } from "../theme";
import { fmt, STOCK_AGING_DAYS, STOCK_FILL_CRITICAL, STOCK_FILL_WARNING, STOCK_STALE_DAYS } from "../helpers";

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

function EmptyCell({ reason }: { reason?: string }) {
  return (
    <span style={{ color: FT.textSub, cursor: reason ? "help" : undefined }} title={reason}>—</span>
  );
}

function NumCell({ value, digits = 0, emptyReason }: { value: number | null; digits?: number; emptyReason?: string }) {
  if (value === null || value === undefined) return <EmptyCell reason={emptyReason} />;
  return (
    <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>
      {value.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}
    </span>
  );
}

/** Date d'un relevé + badge d'ancienneté (>7 jours = orange, >15 jours = rouge)
 * — un stock affiché sans son âge peut laisser croire à tort qu'il est du jour même. */
function DateCell({ date }: { date: string | null }) {
  if (!date) return <EmptyCell />;
  const d = new Date(date);
  const ageDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const tone = ageDays > STOCK_STALE_DAYS ? { bg: FT.redL, fg: FT.red } : ageDays > STOCK_AGING_DAYS ? { bg: FT.orangeL, fg: FT.orange } : { bg: FT.greenL, fg: FT.green };
  return (
    <span
      title={`Relevé du ${d.toLocaleDateString("fr-FR")} — ${ageDays} jour(s)`}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2 }}
    >
      <span style={{ fontSize: 11.5, fontWeight: 700 }}>{d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</span>
      <span style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 999, background: tone.bg, color: tone.fg }}>
        {ageDays === 0 ? "aujourd'hui" : `${ageDays}j`}
      </span>
    </span>
  );
}

/** Barre de remplissage — vert >40%, orange 15-40%, rouge <15% (seuils de
 * réserve carburant courants, à ajuster si le métier en donne d'autres). */
function FillBar({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return <EmptyCell reason="Nécessite un stock ET une capacité de cuve connus (Snowflake)." />;
  const tone = pct < STOCK_FILL_CRITICAL ? FT.red : pct < STOCK_FILL_WARNING ? FT.orange : FT.green;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 90 }}>
      <div style={{ flex: 1, height: 7, borderRadius: 999, background: FT.slateL, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", background: tone, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: tone, fontFamily: "ui-monospace, Menlo, monospace", minWidth: 34, textAlign: "right" }}>{pct}%</span>
    </div>
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

function GeFilterButtons({ value, onChange, kpis }: { value: GeFilter; onChange: (v: GeFilter) => void; kpis: FuelStockResponse["kpis"] | undefined }) {
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

function StockKpis({ data, stickyTop }: { data: FuelStockResponse | undefined; stickyTop: number }) {
  const kpis = data?.kpis;
  if (!kpis) return null;
  const couverture = kpis.sites_avec_ge > 0 ? Math.round((kpis.sites_avec_stock_snowflake / kpis.sites_avec_ge) * 100) : 0;

  return (
    <div
      style={{
        position: "sticky", top: stickyTop, zIndex: 9, background: FT.card, borderRadius: FT.radius,
        border: `1px solid ${FT.border}`, boxShadow: FT.shadow, padding: 14,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        <KpiCard label="Sites avec GE" value={fmt.format(kpis.sites_avec_ge)} sub="Seuls capables de stocker du fuel" tone="gold" icon={<Fuel size={14} />} />
        <KpiCard label="Sites avec stock connu (Snowflake)" value={`${fmt.format(kpis.sites_avec_stock_snowflake)} / ${fmt.format(kpis.sites_avec_ge)}`} sub={`${couverture}% de couverture`} tone="blue" icon={<Users size={14} />} />
        <KpiCard label="Sites avec stock connu (ENOC)" value={fmt.format(kpis.sites_avec_stock_enoc)} sub="Relevés historiques" tone="green" icon={<Droplets size={14} />} />
        <KpiCard label="Sites sans GE" value={fmt.format(kpis.sites_sans_ge)} tone="slate" icon={<Fuel size={14} />} />
      </div>
    </div>
  );
}

export function StockSheet({
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
  data: FuelStockResponse | undefined;
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StockKpis data={data} stickyTop={stickyTop + 14} />

      <Card padded={false} style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: FT.blueL, display: "grid", placeItems: "center", color: FT.navy, flexShrink: 0 }}>
              <Warehouse size={17} />
            </div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: FT.text }}>Stock carburant actuel par site</div>
              <div style={{ fontSize: 12.5, color: FT.textSub, marginTop: 3 }}>
                Automatisé — Snowflake (dernier relevé de cuve, fenêtre 30j) + ENOC (dernier relevé historique). Aucun upload nécessaire.
                {data?.pagination && ` ${fmt.format(data.pagination.total)} site(s).`}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <GeFilterButtons value={geFilter} onChange={onGeFilterChange} kpis={data?.kpis} />
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
          <EmptyState icon={<Warehouse size={20} />} title="Aucune donnée" subtitle="La synchronisation automatique n'a pas encore tourné." />
        ) : (
          <>
            <div style={{ overflow: "auto", maxHeight: 600, borderRadius: 12, border: `1px solid ${FT.border}` }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1300 }}>
                <thead>
                  <tr>
                    <th style={th}>Site ID</th>
                    <th style={th}>Nom du site</th>
                    <th style={th}>Typologie</th>
                    <th style={th}>Source GE</th>
                    <th style={th}>Stock Snowflake (L)</th>
                    <th style={th}>Capacité (L)</th>
                    <th style={th}>% plein</th>
                    <th style={th}>Relevé Snowflake</th>
                    <th style={th}>Stock ENOC (L)</th>
                    <th style={th}>Relevé ENOC</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
                      <td style={{ ...td, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.site_id}</td>
                      <td style={td}>{r.site_name || "—"}</td>
                      <td style={td}>{r.typology || "—"}</td>
                      <td style={td}><GeSourceBadge snowflake={r.has_genset_snowflake} enoc={r.has_genset_enoc} /></td>
                      <td style={td}>
                        <NumCell
                          value={r.stock_snowflake_l}
                          emptyReason="Aucun relevé de niveau de cuve physiquement valide sur les 30 derniers jours pour ce site (Snowflake VW_FUEL_REPORT)."
                        />
                      </td>
                      <td style={td}><NumCell value={r.capacity_snowflake_l} /></td>
                      <td style={td}><FillBar pct={r.stock_snowflake_pct} /></td>
                      <td style={td}><DateCell date={r.stock_snowflake_date} /></td>
                      <td style={td}>
                        <NumCell
                          value={r.stock_enoc_l}
                          emptyReason="Aucun relevé ENOC exploitable pour ce site (collecte historique ponctuelle, pas un flux continu)."
                        />
                      </td>
                      <td style={td}><DateCell date={r.stock_enoc_date} /></td>
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
