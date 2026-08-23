// src/features/fuel-tracking/sheets/ConsommationSheet.tsx
// Onglet CONSOMMATION — automatisé (pas d'upload) : jointure Snowflake
// (DB_GFMS_PROD.GOLD, conso mesurée par capteur) + ENOC (quantités validées
// par le fuel manager, lues directement depuis la base MongoDB d'ENOC —
// l'API REST est bloquée par filtrage IP côté ENOC, voir
// fuel_tracking/services/enoc_mongo_service.py). Les fichiers gardiens
// rejoindront ce tableau plus tard, une fois leur format défini.

import { useState, type CSSProperties } from "react";
import { Droplets, Fuel, Gauge, Search, Users } from "lucide-react";
import type { FuelConsommationResponse } from "@/services/fuelTracking";
import { Card, EmptyState, KpiCard, Modal, Pager, Skeleton } from "../ui";
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

function EmptyCell({ reason }: { reason?: string }) {
  return (
    <span style={{ color: FT.textSub, cursor: reason ? "help" : undefined }} title={reason}>—</span>
  );
}

function NumCell({ value, digits = 0, suffix, emptyReason }: { value: number | null; digits?: number; suffix?: string; emptyReason?: string }) {
  if (value === null || value === undefined) return <EmptyCell reason={emptyReason} />;
  if (value === 0) return <EmptyCell reason={emptyReason} />;
  return (
    <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>
      {value.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}
      {suffix ? ` ${suffix}` : ""}
    </span>
  );
}

function formatL(value: number) {
  return `${fmt.format(value)} L`;
}

// Détail énergie CPH (télémétrie GFMS_DATA_TRACKER_NC, agrégat mensuel des
// jours OK/OVER_CAPACITY de FuelCphGeDaily) — seule source pour Énergie
// site/Batterie DC/Batterie AC/Énergie GE, absentes de Base GE.xlsx. "Sans
// donnée inventée" — vide avec une raison précise tant qu'une des
// conditions de qualité du pipeline CPH n'est pas remplie.
function cphEnergyEmptyReason(status: string | null): string {
  switch (status) {
    case "MISSING_PARAMETER":
      return "Aucune fiche de paramètres GE (PGE_KVA, cos φ, rendement redresseur, SPC) chargée pour ce site sur cette période.";
    case "BATTERY_DATA_NOT_READY":
      return "Moins de 95% des intervalles de fonctionnement GE ont une mesure batterie fiable ce mois-ci.";
    case "NO_VALID_RUNTIME":
    case "RUNTIME_NOT_VALIDATED_FOR_INTERVAL_CPH":
      return "Le temps de marche déduit de la télémétrie ne correspond pas (ou n'a pas pu être comparé) au runtime du contrôleur DSE.";
    case "MISSING_LOAD_POWER":
      return "Aucun intervalle de fonctionnement du groupe électrogène détecté ce mois-ci.";
    default:
      return "Aucune donnée de télémétrie CPH disponible ce mois-ci pour ce site.";
  }
}

// Running Time / Conso estimée — exclusivement le pipeline CPH Snowflake
// (télémétrie GFMS_DATA_TRACKER_NC), demande explicite : "pour les [colonnes
// calculées], respecter les informations de Snowflake". Base GE.xlsx n'est
// PAS utilisé pour ces 2 colonnes : ses colonnes Running Time/Conso estimée
// ne sont renseignées que pour 5 des 469 sites (valeurs 2,3,4,5,6h,
// manifestement des lignes d'exemple laissées dans le fichier).
const SOURCE_LABELS: Record<string, string> = {
  cph_snowflake: "pipeline CPH Snowflake (télémétrie GFMS_DATA_TRACKER_NC)",
  snowflake_tracker_5min: "compteur télémétrie 5 min (GFMS_DATA_TRACKER_NC)",
  snowflake_dse_controller: "contrôleur DSE (GENSET_REPORT) — repli",
  snowflake_dg_on_calculated: "DG-On calculé (GENSET_REPORT) — dernier repli",
  snowflake: "capteur automatisé Snowflake (VW_FUEL_REPORT)",
  gardiennage: "relevé manuel de gardiennage (jauge physique) — repli, pas de capteur Snowflake fiable",
};

function sourceTitle(source: string | null): string | undefined {
  if (!source) return "Aucune source disponible (pipeline CPH Snowflake sans résultat) pour ce site ce mois-ci.";
  return `Source : ${SOURCE_LABELS[source] || source}.`;
}


type GeFilter = "all" | "true" | "false" | "incomplete";

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
    { key: "incomplete", label: `Avec GE mais aucune donnée${kpis ? ` (${fmt.format(kpis.sites_avec_ge_incomplet)})` : ""}` },
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
        <KpiCard label="Sites avec estimation" value={fmt.format(kpis.sites_avec_estimation)} sub="delta de niveau de cuve" tone="gold" icon={<Droplets size={14} />} />
        <KpiCard label="Qté ajoutée (ENOC validé)" value={formatL(kpis.total_enoc_qte_ajoutee_l)} tone="green" icon={<Fuel size={14} />} />
        <KpiCard label="Demandes ENOC" value={fmt.format(kpis.total_enoc_nb_demandes)} tone="blue" icon={<Gauge size={14} />} />
      </div>
    </div>
  );
}

function DetectionStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 800, color: FT.text, fontFamily: "ui-monospace, Menlo, monospace" }}>{fmt.format(value)}</div>
      <div style={{ fontSize: 11, color: FT.textSub, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function GeDetectionPanel({ detection }: { detection: FuelConsommationResponse["ge_detection"] }) {
  if (!detection) return null;
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: FT.text, marginBottom: 4 }}>
        Détection GE — Snowflake / ENOC seuls (audit, avant correction Typo simple)
      </div>
      <div style={{ fontSize: 11, color: FT.textSub, marginBottom: 12 }}>
        Ces chiffres reflètent uniquement Snowflake/ENOC, sans la règle Typo simple appliquée ailleurs sur cette page
        (où tout site du fichier dont Typo simple mentionne GE compte Avec GE, même si Snowflake/ENOC disent le contraire).
        Le total « Avec GE » réellement utilisé par les filtres/KPI de cette page est donc plus élevé que la ligne
        « Avec GE (Snowflake OU ENOC) » ci-dessous.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 14 }}>
        <DetectionStat label="Total sites (réseau)" value={detection.total_sites} />
        <DetectionStat label="Avec GE (Snowflake OU ENOC)" value={detection.avec_ge} />
        <DetectionStat label="Sans GE" value={detection.sans_ge} />
        <DetectionStat label="Détectés par Snowflake (DG_COUNT>0)" value={detection.avec_ge_snowflake} />
        <DetectionStat label="Détectés par ENOC" value={detection.avec_ge_enoc} />
        <DetectionStat label="Vus seulement par ENOC" value={detection.vus_seulement_enoc} />
        <DetectionStat label="Vus seulement par Snowflake" value={detection.vus_seulement_snowflake} />
        <DetectionStat label="Vus par les deux" value={detection.vus_par_les_deux} />
      </div>
      <div style={{ borderTop: `1px solid ${FT.border}`, paddingTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>
          Sites des fichiers (Base GE.xlsx / Base août 26 validée) vs avis Snowflake/ENOC
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
          <DetectionStat label="Sites dans le(s) fichier(s)" value={detection.sites_dans_fichier} />
          <DetectionStat label="Dans le fichier ET Snowflake/ENOC confirment GE" value={detection.dans_fichier_et_ge} />
          <DetectionStat label="Dans le fichier mais Snowflake/ENOC ne voient pas de GE" value={detection.dans_fichier_sans_ge} />
          <DetectionStat label="Snowflake/ENOC voient un GE, absent des fichiers" value={detection.ge_hors_fichier} />
        </div>
        <div style={{ fontSize: 11, color: FT.textSub, marginTop: 10 }}>
          Les {fmt.format(detection.dans_fichier_sans_ge)} sites de la 3ᵉ case comptent quand même Avec GE partout ailleurs sur cette page (Typo simple mentionne GE pour les {fmt.format(detection.sites_dans_fichier)} sites du fichier).
        </div>
      </div>
    </Card>
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
  const [activeComment, setActiveComment] = useState<{ siteId: string; siteName: string | null; text: string } | null>(null);

  if (loading) return <Skeleton h={520} />;

  const rows = data?.data ?? [];
  const currentLabel = monthLabel(data?.month_year);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ConsommationKpis data={data} stickyTop={stickyTop + 14} />

      <GeDetectionPanel detection={data?.ge_detection} />

      <Card padded={false} style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: FT.blueL, display: "grid", placeItems: "center", color: FT.navy, flexShrink: 0 }}>
              <Droplets size={17} />
            </div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: FT.text }}>Consommation par site — {currentLabel}</div>
              <div style={{ fontSize: 12.5, color: FT.textSub, marginTop: 3 }}>
                Automatisé — Snowflake (conso mesurée par capteur + estimation CPH par télémétrie). Aucun upload nécessaire.
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
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 2400 }}>
                <thead>
                  <tr>
                    <th style={th}>Site ID</th>
                    <th style={th}>Nom du site</th>
                    <th style={th}>Typologie réelle</th>
                    <th style={th}>Typologie simple</th>
                    <th style={th}>Type de site</th>
                    <th style={th}>Type de GE</th>
                    <th style={th}>Running Time (h)</th>
                    <th style={th}>Énergie site (kWh)</th>
                    <th style={th}>Batterie DC (kWh)</th>
                    <th style={th}>Batterie AC (kWh)</th>
                    <th style={th}>Énergie GE (kWh)</th>
                    <th style={th}>Puissance GE (kW)</th>
                    <th style={th}>Charge GE</th>
                    <th style={th}>CPH (L/h)</th>
                    <th style={th}>Conso estimée (L)</th>
                    <th style={th}>Conso mesurée vue (L)</th>
                    <th style={th}>Écart (L)</th>
                    <th style={th}>Écart (%)</th>
                    <th style={{ ...th, textAlign: "left" }}>Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
                      <td style={{ ...td, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.site_id}</td>
                      <td style={td}>{r.site_name || "—"}</td>
                      <td style={td}>{r.typology || "—"}</td>
                      <td style={td}>{r.typologie_simple || "—"}</td>
                      <td style={td}>{r.site_type || "—"}</td>
                      <td style={td}>{r.type_ge || <EmptyCell reason="Type de GE non trouvé (Base GE.xlsx ni Snowflake SITE_DG) pour ce site." />}</td>
                      <td style={td} title={r.ge_runtime_fichier_h !== null ? sourceTitle(r.ge_runtime_source) : undefined}>
                        <NumCell
                          value={r.ge_runtime_fichier_h}
                          digits={1}
                          emptyReason={sourceTitle(r.ge_runtime_source)}
                        />
                      </td>
                      <td style={td}>
                        <NumCell
                          value={r.cph_site_load_energy_kwh}
                          digits={1}
                          emptyReason={cphEnergyEmptyReason(r.cph_calculation_status)}
                        />
                      </td>
                      <td style={td}>
                        <NumCell
                          value={r.cph_battery_dc_energy_kwh}
                          digits={1}
                          emptyReason={cphEnergyEmptyReason(r.cph_calculation_status)}
                        />
                      </td>
                      <td style={td}>
                        <NumCell
                          value={r.cph_battery_ac_energy_kwh}
                          digits={1}
                          emptyReason={cphEnergyEmptyReason(r.cph_calculation_status)}
                        />
                      </td>
                      <td style={td}>
                        <NumCell
                          value={r.cph_total_ge_energy_kwh}
                          digits={1}
                          emptyReason={cphEnergyEmptyReason(r.cph_calculation_status)}
                        />
                      </td>
                      <td style={td}>
                        <NumCell
                          value={r.pge_kva_fichier}
                          digits={1}
                          emptyReason="Puissance nominale du GE non renseignée dans le fichier de référence (Base GE.xlsx) pour ce site."
                        />
                      </td>
                      <td style={td}>
                        <NumCell
                          value={r.ge_load_pct_fichier}
                          digits={1}
                          suffix="%"
                          emptyReason="Charge GE non renseignée dans le fichier de référence (Base GE.xlsx) pour ce site."
                        />
                      </td>
                      <td style={td}>
                        <NumCell
                          value={r.cph_lph_fichier}
                          digits={2}
                          emptyReason="CPH (L/h) non renseigné dans le fichier de référence (Base GE.xlsx) pour ce site."
                        />
                      </td>
                      <td style={td} title={r.conso_estimee_fichier_l !== null ? sourceTitle(r.conso_estimee_source) : undefined}>
                        <NumCell
                          value={r.conso_estimee_fichier_l}
                          digits={1}
                          emptyReason={sourceTitle(r.conso_estimee_source)}
                        />
                      </td>
                      <td style={td} title={r.conso_mesuree_source === "gardiennage" && r.gardien_statut ? `Statut gardiennage : ${r.gardien_statut}` : undefined}>
                        <NumCell
                          value={r.conso_mesuree_fichier_l}
                          digits={1}
                          emptyReason={r.conso_mesuree_source ? sourceTitle(r.conso_mesuree_source) : "Aucune baisse de niveau de cuve fiable détectée ce mois-ci (Snowflake VW_FUEL_REPORT), et aucun relevé de gardiennage disponible pour ce site ce mois-ci."}
                        />
                      </td>
                      <td style={td}>
                        <NumCell
                          value={r.ecart_fichier_l}
                          digits={1}
                          emptyReason="Nécessite à la fois une consommation estimée ET une consommation mesurée dans le fichier de référence pour ce site."
                        />
                      </td>
                      <td style={td}>
                        <NumCell
                          value={r.ecart_fichier_pct}
                          digits={1}
                          suffix="%"
                          emptyReason="Nécessite à la fois une consommation estimée ET une consommation mesurée dans le fichier de référence pour ce site."
                        />
                      </td>
                      <td style={{ ...td, textAlign: "left", maxWidth: 260 }}>
                        {r.commentaire ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5, color: FT.textSub, minWidth: 0 }}>
                              {r.commentaire}
                            </span>
                            <button
                              onClick={() => setActiveComment({ siteId: r.site_id, siteName: r.site_name, text: r.commentaire! })}
                              style={{ flexShrink: 0, border: "none", background: "transparent", color: FT.blue, fontSize: 11, fontWeight: 800, cursor: "pointer", padding: 0, textDecoration: "underline" }}
                            >
                              Voir plus
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: FT.green, fontSize: 11.5 }}>Toutes les données disponibles.</span>
                        )}
                      </td>
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

      {activeComment && (
        <Modal title={`${activeComment.siteId}${activeComment.siteName ? ` — ${activeComment.siteName}` : ""}`} onClose={() => setActiveComment(null)}>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: FT.text, margin: 0, whiteSpace: "pre-wrap" }}>{activeComment.text}</p>
        </Modal>
      )}
    </div>
  );
}
