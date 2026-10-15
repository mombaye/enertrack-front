// src/features/fuel-tracking/sheets/StockRegistrySection.tsx
// Suivis Stock — registre unifié : une ligne par site (pagination serveur), stock RETENU
// (relevé validé, converti en litres avec une cuve validée, contrôlé contre la capacité),
// alertes, dernier mouvement validé, actions historique / valider / rejeter / corriger cuve.
// Vue simple par défaut (7 colonnes, « Que faire ? » en clair) ; vue détaillée = toutes les colonnes.
// Une valeur absente reste « — » avec son motif : jamais 0.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Search, Settings2, SlidersHorizontal, Warehouse } from "lucide-react";
import {
  decideStockObservation,
  getStockRegistry,
  getStockWorkQueueCounters,
  type RegistryStatut,
  type StockRegistryResponse,
  type StockRegistryRow,
} from "@/services/fuelTracking";
import { Card, EmptyState, Pager, SegmentedTabs, Skeleton } from "../ui";
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
import { EnocTypeConfig, TankModelLibrary } from "./StockReferences";
import { StockWorkQueue, type QueueTarget } from "./StockWorkQueue";

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
  "Site ID", "Nom site", "Pays", "Zone", "Typologie site", "Environnement", "Raccordement", "GE", "Solaire", "Profil énergétique",
  "Gardiennage attendu", "Stock retenu (L)", "Source retenue", "Date / heure", "Âge", "Niveau brut", "Unité brute", "Méthode de conversion",
  "Modèle de cuve", "Capacité cuve (L)", "Remplissage (%)", "Statut", "Alertes", "Dernier mouvement connu", "Statut mouvement",
  "Quantité", "Preuve", "Actions",
];

const MOVEMENT_STATUS: Record<string, string> = { DECLARED: "Déclaré", CLOSED: "Clôturé source", VALIDATED: "Validé", REJECTED: "Rejeté" };

function Profile({ v }: { v: string }) {
  return v === "Inconnu" ? <span style={{ color: FT.textSub, fontSize: 11.5 }} title="Source vide : jamais déduit de la typologie">Inconnu</span> : <>{v}</>;
}

type Decision = { row: StockRegistryRow; decision: "valider" | "rejeter" } | null;
type View = "SITES" | "QUEUE" | "SETTINGS";
type Quick = "TOUS" | "ACTION" | "RETENU" | "AUCUNE_DONNEE";

const ACTION_LABEL: Record<NonNullable<StockRegistryRow["prochaine_action_type"]>, string> = {
  OPEN_TANK: "Cuve",
  OPEN_HISTORY: "Ouvrir",
  VALIDATE_OBS: "Contrôler",
  SET_GUARD: "Gardiennage",
  MAP_ENOC: "Classifier",
};

/** Suivis Stock en 3 vues : « Stock des sites » (vue simple par défaut), « À traiter », « Imports & paramètres ».
 * Aucune fonctionnalité retirée : la vue détaillée (toutes les colonnes) reste à un clic. */
export function StockRegistrySection({ technical }: { technical?: ReactNode }) {
  const [view, setView] = useState<View>("SITES");
  const [history, setHistory] = useState<QueueTarget | null>(null);
  const [mapRequest, setMapRequest] = useState<string | null>(null);
  const counters = useQuery({ queryKey: ["stock-queue-counters"], queryFn: getStockWorkQueueCounters });
  const toTreat = (counters.data?.counters ?? []).reduce((a, c) => a + c.count, 0);
  const [canValidate, setCanValidate] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <SegmentedTabs<View>
          value={view}
          onChange={setView}
          options={[
            { key: "SITES", label: "Stock des sites", icon: <Warehouse size={14} /> },
            { key: "QUEUE", label: `À traiter${counters.data ? ` (${fmt.format(toTreat)})` : ""}`, icon: <ListChecks size={14} /> },
            { key: "SETTINGS", label: "Imports & paramètres", icon: <Settings2 size={14} /> },
          ]}
        />
        <span style={{ fontSize: 12, color: FT.textSub }}>
          {view === "SITES" && "1 ligne = 1 site. Cliquer sur une ligne pour voir tout son historique."}
          {view === "QUEUE" && "Choisir une catégorie : chaque ligne dit quoi corriger et comment."}
          {view === "SETTINGS" && "Fichiers reçus, modèles de cuves, types ENOC et sources techniques."}
        </span>
      </div>

      {view === "SITES" && <SitesView onOpen={setHistory} onCanValidate={setCanValidate} />}
      {view === "QUEUE" && (
        <StockWorkQueue onOpen={setHistory} onMapEnoc={(raw) => { setMapRequest(raw); setView("SETTINGS"); }} />
      )}
      {view === "SETTINGS" && (
        <>
          <StockImportsSection canValidate={canValidate} />
          <TankModelLibrary />
          <EnocTypeConfig mapRequest={mapRequest} onMapDone={() => setMapRequest(null)} />
          {technical}
        </>
      )}

      {history && <StockSiteHistory siteId={history.siteId} initialTab={history.tab} onClose={() => setHistory(null)} />}
    </div>
  );
}

function QuickFilter({ active, label, count, tone, onClick, hint }: { active: boolean; label: string; count: string; tone: string; onClick: () => void; hint: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={hint}
      style={{
        textAlign: "left", borderRadius: 12, padding: "10px 14px", cursor: "pointer", flex: "1 1 170px",
        border: `2px solid ${active ? tone : FT.border}`, background: active ? FT.card : FT.slateL,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, color: tone, fontFamily: "ui-monospace, Menlo, monospace" }}>{count}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: FT.text }}>{label}</div>
      <div style={{ fontSize: 11, color: FT.textSub, marginTop: 2 }}>{hint}</div>
    </button>
  );
}

function SitesView({ onOpen, onCanValidate }: { onOpen: (t: QueueTarget) => void; onCanValidate: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<Quick>("TOUS");
  const [alerte, setAlerte] = useState("");
  const [gardiennage, setGardiennage] = useState("");
  const [moreFilters, setMoreFilters] = useState(false);
  const [detailed, setDetailed] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [decision, setDecision] = useState<Decision>(null);
  const debounced = useDebounced(search);

  useEffect(() => setPage(1), [debounced, quick, alerte, gardiennage, limit]);

  const statut: RegistryStatut | "" = quick === "RETENU" || quick === "AUCUNE_DONNEE" ? quick : "";
  const q = useQuery({
    queryKey: ["stock-registry", debounced, quick, alerte, gardiennage, detailed, page, limit],
    queryFn: () => getStockRegistry({ search: debounced, statut, alerte, gardiennage, action_requise: quick === "ACTION" || undefined, tri: detailed ? undefined : "priorite", page, limit }),
    placeholderData: (p) => p,
  });
  const d = q.data;
  const k = d?.kpis;
  useEffect(() => { if (d) onCanValidate(d.can_validate); }, [d, onCanValidate]);

  const act = (r: StockRegistryRow) => {
    const t = r.prochaine_action_type;
    onOpen({ siteId: r.site_id, tab: t === "OPEN_TANK" || t === "SET_GUARD" ? "CUVES" : "RELEVES" });
  };

  return (
    <>
      {k && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", background: FT.card, padding: 8, borderRadius: FT.radius, border: `1px solid ${FT.border}`, boxShadow: FT.shadow }}>
          <QuickFilter active={quick === "TOUS"} onClick={() => setQuick("TOUS")} tone={FT.navy} label="Tous les sites" count={fmt.format(k.sites_total)} hint={k.denominateur} />
          <QuickFilter active={quick === "RETENU"} onClick={() => setQuick("RETENU")} tone={FT.green} label="Stock connu" count={fmt.format(k.sites_stock_retenu)}
                       hint="Relevé validé, converti avec une cuve validée" />
          <QuickFilter active={quick === "ACTION"} onClick={() => setQuick("ACTION")} tone={FT.orange} label="Action requise" count={fmt.format(k.sites_action_requise)}
                       hint="Un relevé existe mais quelque chose bloque" />
          <QuickFilter active={quick === "AUCUNE_DONNEE"} onClick={() => setQuick("AUCUNE_DONNEE")} tone={FT.textSub} label="Aucun relevé" count={fmt.format(k.sites_sans_donnee)}
                       hint="Aucun relevé reçu pour ce site" />
        </div>
      )}

      <Card padded={false} style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "0 10px", height: 34, minWidth: 240 }}>
            <Search size={14} color={FT.textSub} aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un site (ID ou nom)…"
              aria-label="Rechercher un site"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: FT.text, flex: 1 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {d && <span style={{ fontSize: 12, color: FT.textSub }}>{fmt.format(d.pagination.total)} site(s)</span>}
            <button type="button" aria-expanded={moreFilters} onClick={() => setMoreFilters(!moreFilters)} style={actionBtn("blue")}>
              <SlidersHorizontal size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Plus de filtres
            </button>
            <button type="button" aria-pressed={detailed} onClick={() => setDetailed(!detailed)} style={actionBtn(detailed ? "violet" : "blue")}>
              {detailed ? "Vue simple" : "Vue détaillée (toutes les colonnes)"}
            </button>
          </div>
        </div>
        {moreFilters && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
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
        )}

        {q.isLoading && <Skeleton h={420} />}
        {q.isError && (
          <div role="alert" style={{ color: FT.red, fontSize: 13, padding: 12, background: FT.redL, borderRadius: 8 }}>
            Registre indisponible (erreur de chargement). Réessayer dans un instant.
          </div>
        )}
        {d && d.data.length === 0 && <EmptyState icon={<Warehouse size={20} />} title="Aucun site pour ces filtres" />}
        {d && d.data.length > 0 && (
          <>
            {detailed
              ? <FullTable d={d} isFetching={q.isFetching} onHistory={onOpen} onDecision={setDecision} />
              : <CompactTable d={d} isFetching={q.isFetching} onOpen={onOpen} onAct={act} />}
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
    </>
  );
}

function StateBadge({ r }: { r: StockRegistryRow }) {
  // Un stock retenu reste « Stock connu » même s'il reste d'autres relevés à contrôler (indiqué dans « Que faire ? »).
  const [label, bg, fg] = r.statut === "AUCUNE_DONNEE"
    ? ["Aucun relevé", FT.slateL, FT.textSub]
    : r.statut === "RETENU"
      ? ["Stock connu", FT.greenL, FT.green]
      : ["Action requise", FT.orangeL, FT.orange];
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: bg, color: fg, whiteSpace: "nowrap" }}>{label}</span>;
}

function CompactTable({ d, isFetching, onOpen, onAct }: {
  d: StockRegistryResponse; isFetching: boolean; onOpen: (t: QueueTarget) => void; onAct: (r: StockRegistryRow) => void;
}) {
  const cell: CSSProperties = { ...tdStyle, textAlign: "left", whiteSpace: "normal", verticalAlign: "middle", padding: "10px 12px" };
  return (
    <div style={{ overflow: "auto", maxHeight: 620, borderRadius: 12, border: `1px solid ${FT.border}`, opacity: isFetching ? 0.7 : 1 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1040 }}>
        <thead>
          <tr>
            {["Site", "Stock", "Dernier relevé", "État", "Que faire ?", "Dernier mouvement", ""].map((h, i) => (
              <th key={i} scope="col" style={{ ...thStyle, textAlign: "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.data.map((r, i) => {
            const mv = r.last_movement;
            return (
              <tr
                key={r.site_id}
                onClick={() => onOpen({ siteId: r.site_id })}
                style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt, cursor: "pointer" }}
              >
                <th scope="row" style={{ ...cell, minWidth: 150 }}>
                  <div style={{ fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.site_id}</div>
                  <div style={{ fontSize: 11.5, color: FT.textSub, fontWeight: 500 }}>{r.site_name ?? "—"}{r.zone ? ` · ${r.zone}` : ""}</div>
                </th>
                <td style={{ ...cell, minWidth: 170 }}>
                  {r.stock_l !== null ? (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 800 }}><Num value={r.stock_l} unit="L" /></div>
                      {r.capacity_l !== null && <div style={{ fontSize: 11, color: FT.textSub, marginBottom: 3 }}>sur <Num value={r.capacity_l} unit="L" /></div>}
                      {r.fill_pct !== null && <Fill pct={r.fill_pct} />}
                    </>
                  ) : (
                    <span style={{ color: FT.textSub, fontSize: 12 }} title={r.unavailable_reason ?? undefined}>— non retenu</span>
                  )}
                </td>
                <td style={{ ...cell, minWidth: 140 }}>
                  {r.observation_datetime ? (
                    <>
                      <div style={{ fontWeight: 700 }}>{fmtDateTime(r.observation_datetime)}</div>
                      <div style={{ fontSize: 11, color: FT.textSub }}>
                        {r.source ? SOURCE_LABEL[r.source] : ""}{ageLabel(r.age_hours) ? ` · ${ageLabel(r.age_hours)}` : ""}{r.level_raw ? ` · lu : ${r.level_raw}${r.level_unit === "CM" && /^[\d.,\s]+$/.test(r.level_raw) ? " cm" : ""}` : ""}
                      </div>
                    </>
                  ) : <Dash reason="Aucun relevé reçu" />}
                </td>
                <td style={cell}><StateBadge r={r} /></td>
                <td style={{ ...cell, minWidth: 230 }}>
                  {r.prochaine_action ? (
                    <>
                      <div style={{ fontSize: 11.5, color: FT.orange, fontWeight: 700 }}>{r.anomalie}</div>
                      <div style={{ fontWeight: 700 }}>{r.prochaine_action}</div>
                    </>
                  ) : r.statut === "AUCUNE_DONNEE" ? (
                    <span style={{ color: FT.textSub, fontSize: 12 }}>En attente d'un relevé (Loliforce, SCSS ou ENOC)</span>
                  ) : (
                    <span style={{ color: FT.green, fontSize: 12 }}>Rien à faire</span>
                  )}
                </td>
                <td style={{ ...cell, minWidth: 160 }}>
                  {mv ? (
                    <>
                      <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{MOVEMENT_LABEL[mv.movement_type ?? ""] ?? "Type non classifié"}</div>
                      <div style={{ fontSize: 11, color: FT.textSub }}>
                        {fmtDateTime(mv.movement_datetime) ?? "—"} · {mv.status === "VALIDATED" ? "validé" : "non validé"}
                      </div>
                    </>
                  ) : <Dash reason="Aucun mouvement" />}
                </td>
                <td style={{ ...cell, whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 5 }}>
                    {d.can_validate && r.prochaine_action_type && (
                      <button type="button" onClick={() => onAct(r)} style={actionBtn("violet")} title={r.prochaine_action ?? undefined} aria-label={`${r.prochaine_action ?? ACTION_LABEL[r.prochaine_action_type]} — ${r.site_id}`}>
                        {ACTION_LABEL[r.prochaine_action_type]}
                      </button>
                    )}
                    {!(d.can_validate && r.prochaine_action_type) && (
                      <button type="button" onClick={() => onOpen({ siteId: r.site_id })} style={actionBtn("blue")} aria-label={`Historique ${r.site_id}`}>
                        Détail
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FullTable({ d, isFetching, onHistory, onDecision }: {
  d: StockRegistryResponse; isFetching: boolean; onHistory: (t: QueueTarget) => void; onDecision: (x: Decision) => void;
}) {
  const setHistory = onHistory;
  const setDecision = onDecision;
  const q = { isFetching };
  return (
    <>
            <div style={{ overflow: "auto", maxHeight: 620, borderRadius: 12, border: `1px solid ${FT.border}`, opacity: q.isFetching ? 0.7 : 1 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 3300 }}>
                <thead>
                  <tr>
                    {HEAD.map((h) => (
                      <th key={h} scope="col" style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.data.map((r, i) => {
                    const mv = r.last_movement;
                    const canAct = d.can_validate && r.observation_id !== null;
                    const canValidateObs = canAct && r.validation_status !== "VALIDATED"
                      && (r.conversion_status === "VALID" || (r.conversion_status === "GEOMETRIC_ONLY" && r.volume_geometric_l !== null));
                    return (
                      <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
                        <th scope="row" style={{ ...tdStyle, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.site_id}</th>
                        <td style={tdStyle}>{r.site_name ?? <Dash />}</td>
                        <td style={tdStyle}>{r.pays ?? <Dash />}</td>
                        <td style={tdStyle}>{r.zone ?? <Dash />}</td>
                        <td style={tdStyle}>{r.typologie ?? <Dash />}</td>
                        <td style={tdStyle}><Profile v={r.environnement} /></td>
                        <td style={tdStyle}><Profile v={r.raccordement} /></td>
                        <td style={tdStyle}><Profile v={r.ge} /></td>
                        <td style={tdStyle}><Profile v={r.solaire} /></td>
                        <td style={tdStyle}>{r.profil_energetique.startsWith("Incomplet") ? <span style={{ color: FT.textSub, fontSize: 11.5 }}>{r.profil_energetique}</span> : r.profil_energetique}</td>
                        <td style={tdStyle}>{r.gardiennage_attendu ?? <span style={{ color: FT.textSub, fontSize: 11.5 }}>Non configuré</span>}</td>
                        <td style={{ ...tdStyle, fontWeight: 800 }}><Num value={r.stock_l} unit="L" reason={r.unavailable_reason} /></td>
                        <td style={tdStyle}>{r.source ? SOURCE_LABEL[r.source] : <Dash />}</td>
                        <td style={tdStyle}>{fmtDateTime(r.observation_datetime, r.source === "ENOC") ?? <Dash />}</td>
                        <td style={tdStyle}>{ageLabel(r.age_hours) ?? <Dash />}</td>
                        <td style={tdStyle}>{r.level_raw ?? <Dash />}</td>
                        <td style={tdStyle}>{r.level_unit ? (r.level_unit === "CM" ? "cm" : "L") : <Dash />}</td>
                        <td style={tdStyle} title={r.conversion_rule ?? undefined}>
                          {r.conversion_method ? METHOD_LABEL[r.conversion_method] : <Dash />}
                          {r.conversion_status && r.conversion_status !== "VALID" && (
                            <div><StatusPill status={r.conversion_status} map={CONVERSION_LABEL} /></div>
                          )}
                        </td>
                        <td style={tdStyle}>{r.modele_cuve ?? <Dash reason="Aucun modèle de la bibliothèque relié" />}{r.modele_statut === "PROPOSED" && <div style={{ fontSize: 10.5, color: FT.violet, fontWeight: 700 }}>proposé</div>}</td>
                        <td style={tdStyle}><Num value={r.capacity_l} unit="L" reason="Capacité de cuve non validée" /></td>
                        <td style={tdStyle}><Fill pct={r.fill_pct} /></td>
                        <td style={tdStyle} title={r.unavailable_reason ?? undefined}>
                          <StatusPill status={r.statut} map={STATUT_LABEL} />
                          {r.statut_releve && <div style={{ marginTop: 3 }}><StatusPill status={r.statut_releve} /></div>}
                          {r.pending_count > 0 && <div style={{ fontSize: 10.5, color: FT.orange, fontWeight: 700, marginTop: 3 }}>{r.pending_count} relevé(s) à traiter</div>}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: 200 }}><AlertPills alerts={r.alerts} labels={d.alert_labels} /></td>
                        <td style={tdStyle}>
                          {mv ? `${MOVEMENT_LABEL[mv.movement_type ?? ""] ?? "Type non classifié"} · ${fmtDateTime(mv.movement_datetime) ?? "—"}` : <Dash reason="Aucun mouvement" />}
                        </td>
                        <td style={tdStyle}>{mv ? MOVEMENT_STATUS[mv.status] ?? mv.status : <Dash />}</td>
                        <td style={tdStyle}>
                          {mv ? (mv.quantity_l !== null ? <Num value={mv.quantity_l} unit="L" /> : mv.requested_quantity_l !== null
                            ? <span title="Quantité réalisée non déclarée">demandée <Num value={mv.requested_quantity_l} unit="L" /></span> : <Dash reason="Quantité non déclarée" />) : <Dash />}
                        </td>
                        <td style={tdStyle}>{mv?.proof_reference ? "Photo / pièce" : mv?.ticket_reference ? `Ticket ${mv.ticket_reference}` : <Dash reason="Aucune preuve" />}</td>
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
                                  title={canAct && !canValidateObs && r.validation_status !== "VALIDATED" ? "Relevé non convertible en litres : traiter la cuve d'abord (Corriger cuve)." : undefined}
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
    </>
  );
}
