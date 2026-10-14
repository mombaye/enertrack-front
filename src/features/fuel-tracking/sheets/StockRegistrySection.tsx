// src/features/fuel-tracking/sheets/StockRegistrySection.tsx
// Suivis Stock — registre unifié : une ligne par site (pagination serveur), stock RETENU
// (relevé validé, converti en litres avec une cuve validée, contrôlé contre la capacité),
// alertes, dernier mouvement validé, actions historique / valider / rejeter / corriger cuve.
// Une valeur absente reste « — » avec son motif : jamais 0.

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ClipboardCheck, Database, Gauge, Search, ShieldCheck, Warehouse } from "lucide-react";
import { decideStockObservation, getStockRegistry, type RegistryStatut, type StockRegistryRow } from "@/services/fuelTracking";
import { Card, EmptyState, KpiCard, Pager, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { fmt, STOCK_FILL_CRITICAL, STOCK_FILL_WARNING } from "../helpers";
import {
  actionBtn,
  AlertPills,
  ageLabel,
  CONVERSION_LABEL,
  Dash,
  fmtDateTime,
  inputStyle,
  METHOD_LABEL,
  MOVEMENT_LABEL,
  Num,
  ReasonDialog,
  SOURCE_LABEL,
  STATUT_LABEL,
  StatusPill,
  tdStyle,
  thStyle,
} from "./stockRegistryUi";
import { StockSiteHistory } from "./StockSiteHistory";
import { StockImportsSection } from "./StockImportsSection";

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Fill({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return <Dash reason="Nécessite un stock retenu et une capacité de cuve validée." />;
  const tone = pct < STOCK_FILL_CRITICAL ? FT.red : pct < STOCK_FILL_WARNING ? FT.orange : FT.green;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 90 }} aria-label={`Remplissage ${pct} %`}>
      <div style={{ flex: 1, height: 7, borderRadius: 999, background: FT.slateL, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", background: tone }} />
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: tone, fontFamily: "ui-monospace, Menlo, monospace" }}>{pct}%</span>
    </div>
  );
}

const HEAD = [
  "Site ID", "Nom", "Typologie", "Gardiennage attendu", "Stock retenu", "Source", "Date / heure", "Âge", "Niveau brut", "Unité",
  "Méthode", "Capacité", "Remplissage", "Statut", "Alertes", "Dernier mouvement validé", "Quantité", "Preuve", "Actions",
];

type Decision = { row: StockRegistryRow; decision: "valider" | "rejeter" } | null;

export function StockRegistrySection({ stickyTop = 0 }: { stickyTop?: number }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState<RegistryStatut | "">("");
  const [alerte, setAlerte] = useState("");
  const [gardiennage, setGardiennage] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [history, setHistory] = useState<{ siteId: string; tab?: "RELEVES" | "CUVES" } | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const debounced = useDebounced(search);

  useEffect(() => setPage(1), [debounced, statut, alerte, gardiennage, limit]);

  const q = useQuery({
    queryKey: ["stock-registry", debounced, statut, alerte, gardiennage, page, limit],
    queryFn: () => getStockRegistry({ search: debounced, statut, alerte, gardiennage, page, limit }),
    placeholderData: (p) => p,
  });
  const d = q.data;
  const k = d?.kpis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {k && (
        <div style={{ position: "sticky", top: stickyTop, zIndex: 9, background: FT.card, borderRadius: FT.radius, border: `1px solid ${FT.border}`, boxShadow: FT.shadow, padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 12 }}>
            <KpiCard label="Sites avec stock retenu" value={`${fmt.format(k.sites_stock_retenu)} / ${fmt.format(k.sites_total)}`} sub="Relevé validé, en litres, capacité contrôlée" tone="green" icon={<ShieldCheck size={14} />} />
            <KpiCard label="Sites sans stock retenu" value={fmt.format(k.sites_indisponible + k.sites_sans_donnee)} sub={`${fmt.format(k.sites_indisponible)} à traiter · ${fmt.format(k.sites_sans_donnee)} sans relevé`} tone="orange" icon={<Gauge size={14} />} />
            <KpiCard label="Relevés à valider" value={fmt.format(k.releves_a_valider)} sub={`${fmt.format(k.sites_conflit)} site(s) en conflit Loliforce / SCSS`} tone="violet" icon={<ClipboardCheck size={14} />} />
            <KpiCard label="Cuves validées" value={`${fmt.format(k.cuves_validees)} / ${fmt.format(k.cuves_validees + k.cuves_a_valider)}`} sub="Conversion cm → L impossible sans cuve validée" tone="blue" icon={<Database size={14} />} />
            <KpiCard label="Imports à valider" value={fmt.format(k.imports_a_valider)} tone="slate" icon={<AlertTriangle size={14} />} />
          </div>
        </div>
      )}

      <Card padded={false} style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 14 }}>
          <SheetTitle
            icon={<Warehouse size={17} />}
            title="Registre de stock — une ligne par site"
            subtitle={`Stock retenu : relevé validé (ENOC, Loliforce ou SCSS) le plus récent, converti avec une cuve validée et contrôlé contre sa capacité (tolérance ${d?.regles.tolerance_capacite_pct ?? 5} %). Snowflake reste une information technique.${d ? ` ${fmt.format(d.pagination.total)} site(s).` : ""}`}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "0 10px", height: 32, minWidth: 200 }}>
              <Search size={14} color={FT.textSub} aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Site ID ou nom…"
                aria-label="Rechercher un site"
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, flex: 1 }}
              />
            </div>
            <select aria-label="Filtrer par statut" value={statut} onChange={(e) => setStatut(e.target.value as RegistryStatut | "")} style={inputStyle}>
              <option value="">Tous les statuts</option>
              <option value="RETENU">Stock retenu</option>
              <option value="INDISPONIBLE">Indisponible</option>
              <option value="AUCUNE_DONNEE">Aucune donnée</option>
            </select>
            <select aria-label="Filtrer par alerte" value={alerte} onChange={(e) => setAlerte(e.target.value)} style={inputStyle}>
              <option value="">Toutes les alertes</option>
              {Object.entries(d?.alert_labels ?? {}).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            <select aria-label="Filtrer par gardiennage" value={gardiennage} onChange={(e) => setGardiennage(e.target.value)} style={inputStyle}>
              <option value="">Tout gardiennage</option>
              <option value="LOLIFORCE">Loliforce</option>
              <option value="SCSS">SCSS</option>
              <option value="NON_CONFIGURE">Non configuré</option>
            </select>
          </div>
        </div>

        {q.isLoading && <Skeleton h={420} />}
        {q.isError && (
          <div role="alert" style={{ color: FT.red, fontSize: 13, padding: 12, background: FT.redL, borderRadius: 8 }}>
            Registre indisponible (erreur de chargement). Les sources techniques restent consultables plus bas.
          </div>
        )}
        {d && d.data.length === 0 && <EmptyState icon={<Warehouse size={20} />} title="Aucun site pour ces filtres" />}
        {d && d.data.length > 0 && (
          <>
            <div style={{ overflow: "auto", maxHeight: 620, borderRadius: 12, border: `1px solid ${FT.border}`, opacity: q.isFetching ? 0.7 : 1 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 2200 }}>
                <thead>
                  <tr>
                    {HEAD.map((h) => (
                      <th key={h} scope="col" style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.data.map((r, i) => {
                    const mv = r.last_validated_movement;
                    const canAct = d.can_validate && r.observation_id !== null;
                    const canValidateObs = canAct && r.validation_status !== "VALIDATED" && r.conversion_status === "VALID";
                    return (
                      <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
                        <th scope="row" style={{ ...tdStyle, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.site_id}</th>
                        <td style={tdStyle}>{r.site_name ?? <Dash />}</td>
                        <td style={tdStyle}>{r.typologie ?? <Dash />}</td>
                        <td style={tdStyle}>{r.gardiennage_attendu ?? <span style={{ color: FT.textSub, fontSize: 11.5 }}>Non configuré</span>}</td>
                        <td style={{ ...tdStyle, fontWeight: 800 }}><Num value={r.stock_l} unit="L" reason={r.unavailable_reason} /></td>
                        <td style={tdStyle}>{r.source ? SOURCE_LABEL[r.source] : <Dash />}</td>
                        <td style={tdStyle}>{fmtDateTime(r.observation_datetime, r.source === "ENOC") ?? <Dash />}</td>
                        <td style={tdStyle}>{ageLabel(r.age_hours) ?? <Dash />}</td>
                        <td style={tdStyle}>{r.level_raw ?? <Dash />}</td>
                        <td style={tdStyle}>{r.level_unit ? (r.level_unit === "CM" ? "cm" : "L") : <Dash />}</td>
                        <td style={tdStyle}>
                          {r.conversion_method ? METHOD_LABEL[r.conversion_method] : <Dash />}
                          {r.conversion_status && r.conversion_status !== "VALID" && (
                            <div><StatusPill status={r.conversion_status} map={CONVERSION_LABEL} /></div>
                          )}
                        </td>
                        <td style={tdStyle}><Num value={r.capacity_l} unit="L" reason="Capacité de cuve non validée" /></td>
                        <td style={tdStyle}><Fill pct={r.fill_pct} /></td>
                        <td style={tdStyle} title={r.unavailable_reason ?? undefined}>
                          <StatusPill status={r.statut} map={STATUT_LABEL} />
                          {r.pending_count > 0 && <div style={{ fontSize: 10.5, color: FT.orange, fontWeight: 700, marginTop: 3 }}>{r.pending_count} à valider</div>}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: 200 }}><AlertPills alerts={r.alerts} labels={d.alert_labels} /></td>
                        <td style={tdStyle}>
                          {mv ? `${MOVEMENT_LABEL[mv.movement_type ?? ""] ?? mv.movement_type ?? "—"} · ${fmtDateTime(mv.movement_datetime) ?? "—"}` : (
                            <Dash reason={r.last_movement ? `Dernier mouvement non validé : ${MOVEMENT_LABEL[r.last_movement.movement_type ?? ""] ?? "type inconnu"} du ${fmtDateTime(r.last_movement.movement_datetime) ?? "—"} (${r.last_movement.status})` : "Aucun mouvement"} />
                          )}
                        </td>
                        <td style={tdStyle}><Num value={mv?.quantity_l} unit="L" /></td>
                        <td style={tdStyle}>{mv?.proof_reference || mv?.ticket_reference ? (mv.proof_reference ? "Photo / pièce" : `Ticket ${mv.ticket_reference}`) : <Dash />}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                            <button type="button" onClick={() => setHistory({ siteId: r.site_id })} style={actionBtn("blue")} aria-label={`Historique ${r.site_id}`}>
                              Historique
                            </button>
                            {d.can_validate && (
                              <>
                                <button
                                  type="button"
                                  disabled={!canValidateObs}
                                  title={canAct && r.conversion_status !== "VALID" ? "Relevé non converti en litres : référencer / valider la cuve d'abord (Corriger cuve)." : undefined}
                                  onClick={() => setDecision({ row: r, decision: "valider" })}
                                  style={actionBtn("green", !canValidateObs)}
                                  aria-label={`Valider le relevé affiché pour ${r.site_id}`}
                                >
                                  Valider
                                </button>
                                <button
                                  type="button"
                                  disabled={!canAct || r.validation_status === "REJECTED"}
                                  onClick={() => setDecision({ row: r, decision: "rejeter" })}
                                  style={actionBtn("red", !canAct || r.validation_status === "REJECTED")}
                                  aria-label={`Rejeter le relevé affiché pour ${r.site_id}`}
                                >
                                  Rejeter
                                </button>
                                <button type="button" onClick={() => setHistory({ siteId: r.site_id, tab: "CUVES" })} style={actionBtn("violet")} aria-label={`Corriger la cuve de ${r.site_id}`}>
                                  Corriger cuve
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager
              page={d.pagination.page}
              totalPages={d.pagination.totalPages}
              hasPrev={d.pagination.hasPrev}
              hasNext={d.pagination.hasNext}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
              pageSize={limit}
              onPageSizeChange={setLimit}
              pageSizeOptions={[25, 50, 100]}
            />
          </>
        )}
      </Card>

      <StockImportsSection canValidate={!!d?.can_validate} />

      {history && <StockSiteHistory siteId={history.siteId} initialTab={history.tab} onClose={() => setHistory(null)} />}
      {decision && decision.row.observation_id !== null && (
        <ReasonDialog
          title={`${decision.decision === "valider" ? "Valider" : "Rejeter"} le relevé de ${decision.row.site_id}`}
          description={`Relevé ${decision.row.source ? SOURCE_LABEL[decision.row.source] : ""} du ${fmtDateTime(decision.row.observation_datetime) ?? "—"} : ${decision.row.level_raw ?? "—"}. ${decision.row.unavailable_reason ?? ""}`}
          confirmLabel={decision.decision === "valider" ? "Valider" : "Rejeter"}
          tone={decision.decision === "valider" ? "green" : "red"}
          onClose={() => setDecision(null)}
          onConfirm={async (reason) => {
            await decideStockObservation(decision.row.observation_id!, decision.decision, reason);
            qc.invalidateQueries({ queryKey: ["stock-registry"] });
          }}
        />
      )}
    </div>
  );
}
