// src/features/fuel-tracking/sheets/ControleCphSheet.tsx
// Onglet Contrôle CPH — instruction globale Suivi Carburant / CPH (abaque PRP
// 50 Hz). Calcul site/jour sur la plage EXACTE choisie, entièrement côté
// backend (fuel_tracking/services/cph_engine.py) : cet écran n'affiche que des
// valeurs traçables, une valeur absente reste « — » avec son motif.

import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, CalendarRange, Download, FileUp, Gauge, Info, Search } from "lucide-react";

import {
  approveCphCurve,
  exportCph,
  getCphPeriod,
  getCphReferentiel,
  getCphSiteDetail,
  importCphObservations,
  revokeCphCurve,
  unvalidateCphMapping,
  validateCphMapping,
  type CphFilters,
  type CphObservationImportResult,
  type CphReconciliation,
  type CphReconciliationStatus,
  type CphReferentielMapping,
  type CphSiteRow,
} from "@/services/fuelTracking";
import { Card, EmptyState, KpiCard, Modal, Pager, Skeleton } from "../ui";
import { FT } from "../theme";

// ─── Libellés ────────────────────────────────────────────────────────────────

const RUNTIME_SOURCE_LABELS: Record<string, string> = {
  DSE: "DSE",
  REDRESSEUR: "Redresseur",
  DAY_DG_ON: "Day DG On",
  COMPTEUR_TERRAIN: "Compteur terrain",
  AUCUNE: "Aucune source",
};

const POWER_SOURCE_LABELS: Record<string, string> = {
  PRODUCTION_GE: "Production GE",
  DC_REDRESSEUR: "P_DC / rendement",
  INDOOR_DC_PLUS_AC_HISTORIQUE: "Indoor : DC + AC historique",
  AUCUNE: "Aucune",
};

const STATUT_LABELS: Record<CphReconciliationStatus, string> = {
  OK: "OK",
  A_JUSTIFIER: "À justifier",
  A_INVESTIGUER: "À investiguer",
  DONNEES_INCOMPLETES: "Données incomplètes",
  CPH_NON_CALCULE: "CPH non calculé",
};

const STATUT_COLORS: Record<CphReconciliationStatus, string> = {
  OK: FT.green,
  A_JUSTIFIER: FT.orange,
  A_INVESTIGUER: FT.red,
  DONNEES_INCOMPLETES: FT.slate,
  CPH_NON_CALCULE: FT.violet,
};

const CPH_STATUS_LABELS: Record<string, string> = {
  COMPLET: "Complet",
  PARTIEL: "Partiel",
  NON_CALCULE: "Non calculé",
};

const DAY_STATUS_LABELS: Record<string, string> = {
  CPH_CALCULE: "CPH calculé",
  GE_A_L_ARRET: "GE à l'arrêt (0 h)",
  RUNTIME_ABSENT: "Runtime absent",
  PUISSANCE_ABSENTE: "Puissance absente",
  COURBE_ABSENTE: "Courbe absente",
  PUISSANCE_HORS_PLAFOND: "Puissance > 105 %",
  CPH_HORS_DOMAINE: "Hors domaine courbe",
};

// Bulles d'aide par mesure (instruction §9) : formule, unité SI, source.
const HELP: Record<string, string> = {
  runtime: "Runtime GE journalier (h). Priorité stricte : DSE (GENSET_REPORT.DG_RUNTIME_CONTROLLER, 0-24 h, 0 valide) > redresseur actif par créneaux 5 min (sites off-grid) > Day DG On (GENSET_REPORT.DG_RUNTIME_CALCULATED, contrôle de coalescence à 0) > compteur terrain (GFMS_DATA_TRACKER_NC). Une source n'est exploitable que si elle est disponible ≥ 50 % des jours de la période.",
  disponibilite: "Disponibilité d'une source (%) = jours avec une valeur non nulle ÷ jours de la période. Jamais de COALESCE à 0.",
  puissance: "Puissance GE retenue (kW), moyenne pondérée par le runtime des jours calculés. Outdoor : DG_PRODUCTION_KWH ÷ runtime DSE, sinon P_DC ÷ rendement redresseur (charge batterie non ajoutée). Indoor : P_DC pendant GE ÷ rendement + load AC historique (médiane des jours réseau sans GE, AC_METER.ACT_ACTIVE_POWER_AVG ÷ 1 000).",
  courbe: "Courbe CPH de l'abaque PRP 50 Hz, appliquée seulement si le mappage (libellé GE + kVA) est validé par le métier et que la courbe est VALIDÉ_CONSTRUCTEUR ou activée explicitement.",
  cph: "CPH (L/h) = a·x² + b·x + c, x = puissance GE retenue (kW) ÷ puissance PRP (kW). Refus au-delà de 105 % × kVA × cos φ ; une charge < 50 % est une extrapolation mathématique. Moyenne pondérée par le runtime.",
  conso: "Consommation théorique (L) = Σ runtime GE (h) × CPH (L/h) sur chaque jour de la plage. Affichée uniquement si TOUS les jours sont calculés ; sinon la somme partielle est indiquée à part.",
  stock: "Stocks et mouvements (L) issus du fichier d'observation standard. Une cellule vide reste vide, jamais 0.",
  livraisons: "Livraisons ENOC (L). Tant que la source ENOC réelle n'est pas raccordée, elles restent « à contrôler » et bloquent le rapprochement.",
  consoStock: "Consommation stock (L) = stock initial + livraisons + rajouts − retraits − vols − vidanges − stock final.",
  ecart: "Écart (L) = consommation stock − consommation théorique ; écart (%) = 100 × écart ÷ consommation théorique.",
  statut: "OK si |écart| ≤ max(100 L, 10 %) ; À justifier jusqu'à max(200 L, 20 %) ; À investiguer au-delà. Données incomplètes / CPH non calculé si un élément manque.",
};

// ─── Petits composants ───────────────────────────────────────────────────────

function nf(value: number | null | undefined, digits = 1, suffix = "") {
  if (value === null || value === undefined) return null;
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
}

/** Valeur numérique honnête : null → « — » avec motif, 0 reste 0. */
function Num({ value, digits = 1, suffix = "", reason }: { value: number | null | undefined; digits?: number; suffix?: string; reason?: string | null }) {
  const txt = nf(value, digits, suffix);
  if (txt === null) {
    return <span style={{ color: FT.textSub, cursor: reason ? "help" : undefined }} title={reason ?? undefined} aria-label={reason ? `non disponible : ${reason}` : "non disponible"}>—</span>;
  }
  return <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>{txt}</span>;
}

function HelpTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span style={{ position: "relative", display: "inline-flex", marginLeft: 4, verticalAlign: "middle" }}>
      <button
        type="button"
        aria-label={`Aide : ${label}`}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        style={{ border: "none", background: "transparent", padding: 0, cursor: "help", color: FT.textSub, display: "inline-flex" }}
      >
        <Info size={12} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", zIndex: 20,
            width: 300, padding: "9px 11px", borderRadius: 8, background: FT.navy, color: "#fff",
            fontSize: 11.5, fontWeight: 500, lineHeight: 1.45, textTransform: "none", letterSpacing: 0,
            textAlign: "left", whiteSpace: "normal", boxShadow: FT.shadowLg,
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

function StatutBadge({ statut }: { statut: CphReconciliationStatus }) {
  const color = STATUT_COLORS[statut];
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, color, background: `${color}1f`, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>
      {STATUT_LABELS[statut]}
    </span>
  );
}

function Tag({ children, tone = FT.slate }: { children: ReactNode; tone?: string }) {
  return (
    <span style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color: tone, background: `${tone}14`, border: `1px solid ${tone}33`, borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

const th: CSSProperties = {
  position: "sticky", top: 0, zIndex: 2, background: FT.slateL, color: FT.text, fontSize: 10.5, fontWeight: 800,
  textTransform: "uppercase", letterSpacing: ".04em", textAlign: "center", padding: "9px 10px",
  borderBottom: `1px solid ${FT.borderStrong}`, whiteSpace: "nowrap",
};
const td: CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${FT.border}`, fontSize: 12.5, textAlign: "center", whiteSpace: "nowrap" };
const control: CSSProperties = { border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px", fontSize: 12.5, color: FT.text, fontWeight: 700 };
const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${FT.border}`, background: FT.card, color: FT.text, cursor: "pointer", fontSize: 12, fontWeight: 800, borderRadius: 9, padding: "7px 12px" };

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultPeriod() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { start: isoDate(start), end: isoDate(end) };
}

function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function apiError(e: unknown) {
  const err = e as { response?: { data?: { detail?: string } }; message?: string };
  return err?.response?.data?.detail ?? err?.message ?? "Erreur inconnue";
}

// ─── Détail d'un site (jour par jour) ────────────────────────────────────────

function ReconciliationBlock({ r }: { r: CphReconciliation }) {
  return (
    <div style={{ border: `1px solid ${FT.border}`, borderRadius: 9, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <strong style={{ fontSize: 12.5 }}>Observation {fmtDate(r.observation_start)} → {fmtDate(r.observation_end)}</strong>
        <StatutBadge statut={r.statut} />
        {r.livraisons_statut === "LIVRAISONS_ENOC_A_CONTROLER" && <Tag tone={FT.orange}>Livraisons ENOC à contrôler</Tag>}
        <span style={{ fontSize: 11, color: FT.textSub }}>Fichier : {r.import_file ?? "—"} · statut observation : {r.observation_status ?? "—"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, fontSize: 12 }}>
        {([
          ["Stock initial", r.stock_initial_l], ["Livraisons", r.livraisons_l], ["Rajouts", r.rajouts_l],
          ["Retraits", r.retraits_l], ["Vols", r.vols_l], ["Vidanges", r.vidanges_l], ["Stock final", r.stock_final_l],
          ["Conso théorique", r.conso_theorique_l], ["Conso stock", r.conso_stock_l], ["Écart", r.ecart_l],
        ] as Array<[string, number | null]>).map(([label, v]) => (
          <div key={label}>
            <div style={{ color: FT.textSub, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
            <Num value={v} digits={1} suffix=" L" />
          </div>
        ))}
        <div>
          <div style={{ color: FT.textSub, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>Écart %</div>
          <Num value={r.ecart_pct} digits={1} suffix=" %" />
        </div>
      </div>
      <div style={{ fontSize: 11, color: FT.textSub, marginTop: 6 }}>
        Conso théorique calculée sur {r.jours_conso_calculee}/{r.jours_observation} jour(s).
      </div>
      {r.motifs.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 11.5, color: FT.textMid }}>
          {r.motifs.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
    </div>
  );
}

function SiteDetailModal({ siteId, start, end, onClose }: { siteId: string; start: string; end: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ["cph-site", siteId, start, end], queryFn: () => getCphSiteDetail(siteId, { start, end }) });
  const d = q.data;
  return (
    <Modal title={`${siteId} — détail du ${fmtDate(start)} au ${fmtDate(end)}`} onClose={onClose} maxWidth={1180}>
      {q.isLoading && <Skeleton h={320} />}
      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Impossible de charger le détail : {apiError(q.error)}</div>}
      {d && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12.5 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <div><strong>Site</strong> : {d.site_name ?? "—"} · {d.zone ?? "zone —"} · {d.country ?? "—"}</div>
            <div><strong>Type</strong> : {d.kind ?? "inconnu"}{d.kind_source ? ` (${d.kind_source})` : ""} · réseau : {d.grid_supply ?? "inconnu"}</div>
            <div><strong>GE inventaire</strong> : {d.ge_label ?? "—"} · DG_COUNT {d.dg_count ?? "—"}</div>
            <div>
              <strong>Courbe</strong> :{" "}
              {d.curve ? (
                <>
                  {d.curve.curve_id} {d.curve.label} — PRP {nf(d.curve.prp_kva, 0)} kVA / {nf(d.curve.prp_kw, 1)} kW, cos φ {nf(d.curve.power_factor, 2)} ·
                  a={d.curve.a} b={d.curve.b} c={d.curve.c} <Tag tone={FT.green}>{d.curve.status}</Tag>
                </>
              ) : (
                <span style={{ color: FT.orange }}>aucune — {d.curve_reason}</span>
              )}
            </div>
          </div>
          {d.data_issue && <div role="alert" style={{ color: FT.red }}>{d.data_issue}</div>}

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Sources de runtime sur la période <HelpTip label="disponibilité" text={HELP.disponibilite} /></div>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th scope="col" style={th}>Priorité</th><th scope="col" style={th}>Source</th><th scope="col" style={th}>Disponibilité</th>
                  <th scope="col" style={th}>Jours valides</th><th scope="col" style={th}>Exploitable</th><th scope="col" style={{ ...th, textAlign: "left" }}>Motif de rejet</th>
                </tr>
              </thead>
              <tbody>
                {(["DSE", "REDRESSEUR", "DAY_DG_ON", "COMPTEUR_TERRAIN"] as const).map((s, i) => {
                  const ev = d.sources[s];
                  return (
                    <tr key={s}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>{RUNTIME_SOURCE_LABELS[s]}</td>
                      <td style={td}><Num value={ev.availability_pct} digits={0} suffix=" %" /></td>
                      <td style={td}>{ev.days_valid}/{d.days}</td>
                      <td style={td}>{ev.exploitable ? <Tag tone={FT.green}>Oui</Tag> : <Tag tone={FT.slate}>Non</Tag>}</td>
                      <td style={{ ...td, textAlign: "left", whiteSpace: "normal" }}>{ev.rejection ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {d.ac_reference && (
            <div style={{ border: `1px solid ${FT.border}`, borderRadius: 9, padding: 12 }}>
              <strong>Load AC historique (indoor)</strong> :{" "}
              {d.ac_reference.p_ac_aux_kw !== null ? `${nf(d.ac_reference.p_ac_aux_kw, 3)} kW — médiane de ${d.ac_reference.reference_dates.length} jour(s) réseau sans GE` : <span style={{ color: FT.orange }}>{d.ac_reference.reason}</span>}
              {d.ac_reference.reference_dates.length > 0 && (
                <div style={{ fontSize: 11.5, color: FT.textSub, marginTop: 4 }}>
                  Dates de référence : {d.ac_reference.reference_dates.map(fmtDate).join(", ")}
                </div>
              )}
            </div>
          )}

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Rapprochement stock</div>
            {d.reconciliations.length === 0
              ? <div style={{ color: FT.textSub }}>Aucune observation de stock entièrement incluse dans la période — statut Données incomplètes.</div>
              : d.reconciliations.map((r) => <ReconciliationBlock key={`${r.observation_start}-${r.observation_end}`} r={r} />)}
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Détail jour par jour</div>
            <div style={{ overflow: "auto", maxHeight: 420, border: `1px solid ${FT.border}`, borderRadius: 9 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1250 }}>
                <thead>
                  <tr>
                    <th scope="col" style={th}>Date</th>
                    <th scope="col" style={th}>Runtime (h)</th>
                    <th scope="col" style={th}>Source</th>
                    <th scope="col" style={th}>Brut DSE / Redr. / DG On / Compteur (h)</th>
                    <th scope="col" style={th}>P GE (kW)</th>
                    <th scope="col" style={th}>Source puissance</th>
                    <th scope="col" style={th}>Charge</th>
                    <th scope="col" style={th}>CPH (L/h)</th>
                    <th scope="col" style={th}>Conso (L)</th>
                    <th scope="col" style={th}>Statut</th>
                    <th scope="col" style={{ ...th, textAlign: "left" }}>Détail / motifs</th>
                  </tr>
                </thead>
                <tbody>
                  {d.daily.map((day) => (
                    <tr key={day.date}>
                      <td style={td}>{fmtDate(day.date)}</td>
                      <td style={td}><Num value={day.runtime_h} digits={2} reason={day.runtime_h === null ? day.motifs[0] : null} /></td>
                      <td style={td}>{day.runtime_source ? RUNTIME_SOURCE_LABELS[day.runtime_source] : "—"}</td>
                      <td style={{ ...td, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5 }}>
                        {(["DSE", "REDRESSEUR", "DAY_DG_ON", "COMPTEUR_TERRAIN"] as const).map((s) => nf(day.raw[s], 2) ?? "—").join(" / ")}
                      </td>
                      <td style={td}><Num value={day.p_ge_kw} digits={2} /></td>
                      <td style={td}>{day.power_source ? POWER_SOURCE_LABELS[day.power_source] : "—"}</td>
                      <td style={td}>
                        <Num value={day.charge_pct} digits={1} suffix=" %" />
                        {day.extrapolated && <> <Tag tone={FT.orange}>&lt; 50 % extrapolé</Tag></>}
                      </td>
                      <td style={td}><Num value={day.cph_l_h} digits={2} /></td>
                      <td style={td}><Num value={day.conso_l} digits={1} /></td>
                      <td style={td}><Tag tone={day.status === "CPH_CALCULE" || day.status === "GE_A_L_ARRET" ? FT.green : FT.slate}>{DAY_STATUS_LABELS[day.status] ?? day.status}</Tag></td>
                      <td style={{ ...td, textAlign: "left", whiteSpace: "normal", minWidth: 280, fontSize: 11.5, color: FT.textMid }}>
                        {[day.power_detail, ...day.motifs].filter(Boolean).join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Import du fichier d'observation ─────────────────────────────────────────

const OBSERVATION_COLUMNS = "country, site_id, site_name, observation_start, observation_end, opening_fuel_l, closing_fuel_l, fuel_deliveries_l, fuel_transfer_in_l, fuel_transfer_out_l, fuel_theft_l, fuel_drain_l, observation_status, comment, justificatif";

function ObservationImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CphObservationImportResult | null>(null);
  const mut = useMutation({
    mutationFn: (f: File) => importCphObservations(f),
    onSuccess: (r) => { setResult(r); onImported(); },
  });
  const inputId = useId();
  return (
    <Modal title="Importer un fichier d'observation stock" onClose={onClose} maxWidth={640}>
      <p style={{ fontSize: 12.5, color: FT.textMid, marginTop: 0 }}>
        Format standard (.xlsx ou .csv), colonnes : <code style={{ fontSize: 11.5 }}>{OBSERVATION_COLUMNS}</code>.
        Une cellule vide reste vide (jamais 0) ; une valeur illisible rejette la ligne. Le fichier, l'utilisateur, la date et la version de règle sont conservés.
      </p>
      <label htmlFor={inputId} style={{ fontSize: 12, fontWeight: 800 }}>Fichier</label>
      <input id={inputId} type="file" accept=".xlsx,.csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} style={{ display: "block", margin: "6px 0 12px" }} />
      <button type="button" disabled={!file || mut.isPending} onClick={() => file && mut.mutate(file)} style={{ ...btn, background: FT.navy, color: "#fff", opacity: !file || mut.isPending ? 0.5 : 1 }}>
        <FileUp size={13} /> {mut.isPending ? "Import…" : "Importer"}
      </button>
      {mut.isError && <div role="alert" style={{ color: FT.red, fontSize: 12.5, marginTop: 10 }}>{apiError(mut.error)}</div>}
      {result && (
        <div role="status" style={{ marginTop: 12, fontSize: 12.5 }}>
          <strong>{result.rows_imported}</strong> ligne(s) importée(s), <strong>{result.rows_rejected}</strong> rejetée(s) sur {result.rows_total} — règle {result.rule_version}.
          {result.errors.length > 0 && (
            <ul style={{ fontSize: 11.5, color: FT.red, paddingLeft: 18 }}>
              {result.errors.map((e) => <li key={`${e.line}-${e.error}`}>Ligne {e.line} ({e.site_id ?? "site ?"}) : {e.error}</li>)}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Référentiel : courbes et mappages (validation métier) ──────────────────

function MappingRow({ m, canValidate, onChanged }: { m: CphReferentielMapping; canValidate: boolean; onChanged: () => void }) {
  const [curveId, setCurveId] = useState(m.candidates.find((c) => c.is_usable)?.curve_id ?? m.candidates[0]?.curve_id ?? "");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const validate = useMutation({ mutationFn: () => validateCphMapping(m.id, curveId, comment), onSuccess: () => { setError(null); onChanged(); }, onError: (e) => setError(apiError(e)) });
  const unvalidate = useMutation({ mutationFn: () => unvalidateCphMapping(m.id), onSuccess: onChanged, onError: (e) => setError(apiError(e)) });
  return (
    <tr>
      <td style={{ ...td, textAlign: "left" }}><strong>{m.inventory_label}</strong></td>
      <td style={td}>{nf(m.inventory_kva, 0) ?? "—"}</td>
      <td style={td}>{m.site_count ?? "—"}</td>
      <td style={td}><Tag>{m.abaque_status}</Tag></td>
      <td style={{ ...td, textAlign: "left", whiteSpace: "normal", minWidth: 220 }}>
        {m.candidates.length === 0 ? "—" : m.candidates.map((c) => (
          <div key={c.curve_id} style={{ fontSize: 11.5 }}>
            {c.curve_id} {c.manufacturer} {c.model} ({nf(c.prp_kva, 0)} kVA / {nf(c.prp_kw, 1)} kW){" "}
            <Tag tone={c.is_usable ? FT.green : FT.orange}>{c.status}{c.business_approved ? " · activée" : ""}</Tag>
          </div>
        ))}
      </td>
      <td style={{ ...td, textAlign: "left", whiteSpace: "normal", minWidth: 260 }}>
        {m.validated_curve_id ? (
          <div style={{ fontSize: 11.5 }}>
            <Tag tone={FT.green}>Validé : {m.validated_curve_id}</Tag> par {m.validated_by ?? "—"} le {m.validated_at ? new Date(m.validated_at).toLocaleDateString("fr-FR") : "—"}
            <div style={{ color: FT.textSub }}>{m.validation_comment}</div>
            {canValidate && <button type="button" onClick={() => unvalidate.mutate()} style={{ ...btn, padding: "3px 8px", marginTop: 4 }}>Retirer la validation</button>}
          </div>
        ) : canValidate && m.candidates.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <select aria-label={`Courbe pour ${m.inventory_label}`} value={curveId} onChange={(e) => setCurveId(e.target.value)} style={{ ...control, padding: "4px 8px" }}>
              {m.candidates.map((c) => <option key={c.curve_id} value={c.curve_id}>{c.curve_id} — {c.model}{c.is_usable ? "" : " (non activée)"}</option>)}
            </select>
            <input aria-label={`Commentaire de validation pour ${m.inventory_label}`} placeholder="Référence plaque signalétique…" value={comment} onChange={(e) => setComment(e.target.value)} style={{ ...control, padding: "4px 8px" }} />
            <button type="button" disabled={!comment.trim() || validate.isPending} onClick={() => validate.mutate()} style={{ ...btn, padding: "4px 8px", opacity: !comment.trim() ? 0.5 : 1 }}>Valider le mappage</button>
          </div>
        ) : (
          <span style={{ fontSize: 11.5, color: FT.textSub }}>{m.candidates.length === 0 ? "Courbe manquante dans l'abaque" : "Non validé"}</span>
        )}
        {error && <div role="alert" style={{ color: FT.red, fontSize: 11.5 }}>{error}</div>}
      </td>
    </tr>
  );
}

function ReferentielModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cph-referentiel"], queryFn: getCphReferentiel });
  const [filter, setFilter] = useState("");
  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [approveComment, setApproveComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["cph-referentiel"] }); qc.invalidateQueries({ queryKey: ["cph-period"] }); };
  const approve = useMutation({ mutationFn: () => approveCphCurve(approveTarget!, approveComment), onSuccess: () => { setApproveTarget(null); setApproveComment(""); setError(null); refresh(); }, onError: (e) => setError(apiError(e)) });
  const revoke = useMutation({ mutationFn: (id: string) => revokeCphCurve(id), onSuccess: refresh, onError: (e) => setError(apiError(e)) });
  const data = q.data;
  const mappings = (data?.mappings ?? []).filter((m) => !filter || m.inventory_label.toLowerCase().includes(filter.toLowerCase()));
  const nonConstructor = (data?.curves ?? []).filter((c) => c.status !== "VALIDÉ_CONSTRUCTEUR" && (!filter || `${c.curve_id} ${c.manufacturer} ${c.model}`.toLowerCase().includes(filter.toLowerCase())));
  return (
    <Modal title="Référentiel courbes CPH PRP 50 Hz — validation métier" onClose={onClose} maxWidth={1180}>
      {q.isLoading && <Skeleton h={300} />}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 12.5, color: FT.textMid }}>
            Un CPH n'est calculé pour un site que si son libellé GE (Base GE, avec son kVA) est <strong>validé</strong> vers une courbe utilisable :
            VALIDÉ_CONSTRUCTEUR, ou courbe historique / archivée / distributeur <strong>activée explicitement</strong>.
            {!data.can_validate && " Validation réservée aux rôles admin et manager."}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, ...control, maxWidth: 320 }}>
            <Search size={14} color={FT.textSub} />
            <input aria-label="Filtrer le référentiel" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Libellé, modèle ou ID courbe…" style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 12.5 }} />
          </div>
          {error && <div role="alert" style={{ color: FT.red, fontSize: 12.5 }}>{error}</div>}
          <div style={{ overflow: "auto", maxHeight: 380, border: `1px solid ${FT.border}`, borderRadius: 9 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1000 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ ...th, textAlign: "left" }}>Libellé inventaire</th><th scope="col" style={th}>kVA</th><th scope="col" style={th}>Sites</th>
                  <th scope="col" style={th}>Statut abaque</th><th scope="col" style={{ ...th, textAlign: "left" }}>Courbes candidates</th><th scope="col" style={{ ...th, textAlign: "left" }}>Validation métier</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => <MappingRow key={m.id} m={m} canValidate={data.can_validate} onChanged={refresh} />)}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 12.5, marginBottom: 6 }}>Courbes non constructeur ({nonConstructor.length}) — activation métier</div>
            <div style={{ overflow: "auto", maxHeight: 260, border: `1px solid ${FT.border}`, borderRadius: 9 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
                <thead>
                  <tr>
                    <th scope="col" style={th}>ID</th><th scope="col" style={{ ...th, textAlign: "left" }}>Modèle</th><th scope="col" style={th}>PRP</th>
                    <th scope="col" style={th}>50 / 75 / 100 % (L/h)</th><th scope="col" style={th}>Statut</th><th scope="col" style={{ ...th, textAlign: "left" }}>Activation</th>
                  </tr>
                </thead>
                <tbody>
                  {nonConstructor.map((c) => (
                    <tr key={c.curve_id}>
                      <td style={td}>{c.curve_id}</td>
                      <td style={{ ...td, textAlign: "left" }}>{c.manufacturer} {c.model} {c.variant}</td>
                      <td style={td}>{nf(c.prp_kva, 0)} kVA / {nf(c.prp_kw, 1)} kW · cos φ {nf(c.power_factor, 2) ?? "—"}</td>
                      <td style={td}>{nf(c.conso_50_l_h, 1)} / {nf(c.conso_75_l_h, 1)} / {nf(c.conso_100_l_h, 1)}</td>
                      <td style={td}><Tag tone={FT.orange}>{c.status}</Tag></td>
                      <td style={{ ...td, textAlign: "left" }}>
                        {c.business_approved ? (
                          <span style={{ fontSize: 11.5 }}>
                            <Tag tone={FT.green}>Activée</Tag> par {c.business_approved_by ?? "—"}
                            {data.can_validate && <button type="button" onClick={() => revoke.mutate(c.curve_id)} style={{ ...btn, padding: "3px 8px", marginLeft: 6 }}>Désactiver</button>}
                          </span>
                        ) : data.can_validate ? (
                          approveTarget === c.curve_id ? (
                            <span style={{ display: "inline-flex", gap: 4 }}>
                              <input aria-label={`Justification d'activation ${c.curve_id}`} autoFocus value={approveComment} onChange={(e) => setApproveComment(e.target.value)} placeholder="Justification métier…" style={{ ...control, padding: "3px 8px" }} />
                              <button type="button" disabled={!approveComment.trim()} onClick={() => approve.mutate()} style={{ ...btn, padding: "3px 8px" }}>Confirmer</button>
                              <button type="button" onClick={() => setApproveTarget(null)} style={{ ...btn, padding: "3px 8px" }}>Annuler</button>
                            </span>
                          ) : (
                            <button type="button" onClick={() => { setApproveTarget(c.curve_id); setApproveComment(""); }} style={{ ...btn, padding: "3px 8px" }}>Activer…</button>
                          )
                        ) : "Non activée"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Onglet ──────────────────────────────────────────────────────────────────

export function ControleCphSheet() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState(defaultPeriod);
  const [filters, setFilters] = useState<Omit<CphFilters, "start" | "end">>({});
  const [siteInput, setSiteInput] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [detailSite, setDetailSite] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showReferentiel, setShowReferentiel] = useState(false);
  const [exporting, setExporting] = useState<null | "controle" | "anomalies">(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const nbDays = daysBetween(period.start, period.end);
  const periodError = !period.start || !period.end ? "Dates requises." : nbDays < 1 ? "La date de fin précède la date de début." : nbDays > 92 ? "Période limitée à 92 jours." : null;
  const params: CphFilters = { ...period, ...filters, site: siteInput.trim() || undefined };

  const q = useQuery({
    queryKey: ["cph-period", params, page, limit],
    queryFn: () => getCphPeriod({ ...params, page, limit }),
    enabled: !periodError,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
    setPage(1);
  };

  async function handleExport(kind: "controle" | "anomalies") {
    setExporting(kind);
    setExportError(null);
    try {
      const blob = await exportCph(kind, params);
      downloadBlob(blob, `${kind === "controle" ? "controle_complet_cph" : "anomalies_fuel"}_${period.start}_${period.end}.csv`);
    } catch (e) {
      setExportError(apiError(e));
    } finally {
      setExporting(null);
    }
  }

  const data = q.data;
  const s = data?.synthesis;
  const meta = data?.meta;
  const rows = data?.data ?? [];
  const sortedRuntimeSources = useMemo(() => data?.filters.runtime_sources ?? [], [data?.filters.runtime_sources]);

  const kpi = (label: string, value: number | undefined, tone: Parameters<typeof KpiCard>[0]["tone"], sub?: string, statut?: string) => (
    <button
      type="button"
      onClick={() => statut !== undefined && setFilter("statut", filters.statut === statut ? "" : statut)}
      disabled={statut === undefined}
      aria-pressed={statut !== undefined ? filters.statut === statut : undefined}
      style={{ border: "none", padding: 0, background: "transparent", textAlign: "left", cursor: statut !== undefined ? "pointer" : "default", outline: filters.statut && filters.statut === statut ? `2px solid ${FT.blue}` : "none", borderRadius: FT.radius }}
    >
      <KpiCard label={label} value={value === undefined ? "—" : value.toLocaleString("fr-FR")} tone={tone} sub={sub} />
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: FT.blueL, display: "grid", placeItems: "center", color: FT.navy }}><Gauge size={17} /></div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: FT.text }}>Contrôle CPH — consommation théorique et rapprochement</h2>
              <div style={{ fontSize: 12, color: FT.textSub, marginTop: 3 }}>
                Calcul site/jour sur les dates exactes choisies · abaque PRP 50 Hz · {meta ? `règle ${meta.rule_version}` : "…"}
                {meta?.facts_last_date && ` · faits Snowflake jusqu'au ${fmtDate(meta.facts_last_date)}`}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, ...control }}>
              <CalendarRange size={14} color={FT.textSub} />
              <label htmlFor="cph-start" style={{ fontSize: 11.5, color: FT.textSub }}>Du</label>
              <input id="cph-start" type="date" value={period.start} max={period.end} onChange={(e) => { setPeriod((p) => ({ ...p, start: e.target.value })); setPage(1); }} style={{ border: "none", background: "transparent", fontWeight: 700, color: FT.text }} />
              <label htmlFor="cph-end" style={{ fontSize: 11.5, color: FT.textSub }}>au</label>
              <input id="cph-end" type="date" value={period.end} min={period.start} onChange={(e) => { setPeriod((p) => ({ ...p, end: e.target.value })); setPage(1); }} style={{ border: "none", background: "transparent", fontWeight: 700, color: FT.text }} />
              <span style={{ fontSize: 11.5, color: FT.textSub }}>({nbDays > 0 ? nbDays : 0} j)</span>
            </div>
            <button type="button" onClick={() => setShowReferentiel(true)} style={btn}><BookOpen size={13} color={FT.blue} /> Référentiel courbes</button>
            <button type="button" onClick={() => setShowImport(true)} style={btn}><FileUp size={13} color={FT.blue} /> Importer observations</button>
          </div>
        </div>
        {periodError && <div role="alert" style={{ marginTop: 10, color: FT.red, fontSize: 12.5 }}>{periodError}</div>}
        {meta && !meta.enoc_deliveries_connected && (
          <div role="note" style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 12px", borderRadius: 8, background: FT.orangeL, color: FT.orange, fontSize: 12.5 }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span><strong>LIVRAISONS_ENOC_A_CONTROLER</strong> — les livraisons ENOC réelles ne sont pas encore raccordées : aucun rapprochement ne peut conclure OK / À justifier / À investiguer tant que ce raccordement n'est pas fait.</span>
          </div>
        )}
        {meta && meta.mappings_validated === 0 && (
          <div role="note" style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 12px", borderRadius: 8, background: FT.redL, color: FT.red, fontSize: 12.5 }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Aucun mappage GE → courbe n'est encore validé ({meta.mappings_total} à traiter, {meta.curves_usable}/{meta.curves_total} courbes utilisables) : aucun CPH ne peut être calculé. Ouvrez « Référentiel courbes » pour valider les plaques signalétiques.</span>
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        {kpi("Sites avec GE", s?.sites, "blue", "inventaire SITE_ESCO_CURRENT")}
        {kpi("CPH calculés", s?.cph_calcules, "green", "sites avec ≥ 1 jour de CPH")}
        {kpi("Conso théorique complète", s?.conso_theorique_complete, "cyan", "tous les jours calculés")}
        {kpi("CPH non calculé", s?.cph_non_calcule, "slate", "aucun jour calculé")}
        {kpi("Rapprochements calculés", s?.rapprochements_calcules, "violet")}
        {kpi("OK", s?.ok, "green", undefined, "OK")}
        {kpi("À justifier", s?.a_justifier, "orange", undefined, "A_JUSTIFIER")}
        {kpi("À investiguer", s?.a_investiguer, "red", undefined, "A_INVESTIGUER")}
        {kpi("Données incomplètes", s?.donnees_incompletes, "slate", undefined, "DONNEES_INCOMPLETES")}
        {kpi("Rappr. CPH non calculé", s?.rapprochement_cph_non_calcule, "violet", undefined, "CPH_NON_CALCULE")}
      </div>

      <Card padded={false} style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <select aria-label="Pays" value={filters.country ?? ""} onChange={(e) => setFilter("country", e.target.value)} style={control}>
            <option value="">Pays : tous</option>
            {(data?.filters.countries ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select aria-label="Zone" value={filters.zone ?? ""} onChange={(e) => setFilter("zone", e.target.value)} style={control}>
            <option value="">Zone : toutes</option>
            {(data?.filters.zones ?? []).map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <select aria-label="Source runtime" value={filters.runtime_source ?? ""} onChange={(e) => setFilter("runtime_source", e.target.value)} style={control}>
            <option value="">Source runtime : toutes</option>
            {sortedRuntimeSources.map((r) => <option key={r} value={r}>{RUNTIME_SOURCE_LABELS[r] ?? r}</option>)}
          </select>
          <select aria-label="Source puissance" value={filters.power_source ?? ""} onChange={(e) => setFilter("power_source", e.target.value)} style={control}>
            <option value="">Source puissance : toutes</option>
            {(data?.filters.power_sources ?? []).map((p) => <option key={p} value={p}>{POWER_SOURCE_LABELS[p] ?? p}</option>)}
          </select>
          <select aria-label="Statut rapprochement" value={filters.statut ?? ""} onChange={(e) => setFilter("statut", e.target.value)} style={control}>
            <option value="">Statut : tous</option>
            {(Object.keys(STATUT_LABELS) as CphReconciliationStatus[]).map((k) => <option key={k} value={k}>{STATUT_LABELS[k]}</option>)}
          </select>
          <select aria-label="Statut CPH" value={filters.cph_status ?? ""} onChange={(e) => setFilter("cph_status", e.target.value)} style={control}>
            <option value="">CPH : tous</option>
            {Object.entries(CPH_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 7, ...control, minWidth: 200 }}>
            <Search size={14} color={FT.textSub} />
            <input aria-label="Rechercher un site" value={siteInput} onChange={(e) => { setSiteInput(e.target.value); setPage(1); }} placeholder="Site ID ou nom…" style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 12.5 }} />
          </div>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => handleExport("controle")} disabled={!!exporting || !!periodError} style={{ ...btn, opacity: exporting ? 0.6 : 1 }}>
            <Download size={13} color={FT.blue} /> {exporting === "controle" ? "Export…" : "Contrôle complet"}
          </button>
          <button type="button" onClick={() => handleExport("anomalies")} disabled={!!exporting || !!periodError} style={{ ...btn, color: FT.red, borderColor: FT.redL, opacity: exporting ? 0.6 : 1 }}>
            <Download size={13} /> {exporting === "anomalies" ? "Export…" : "Anomalies Fuel"}
          </button>
        </div>
        {exportError && <div role="alert" style={{ color: FT.red, fontSize: 12.5, marginBottom: 10 }}>Export impossible : {exportError}</div>}

        {q.isLoading ? (
          <Skeleton h={420} />
        ) : q.isError ? (
          <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Calcul impossible : {apiError(q.error)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Gauge size={20} />} title="Aucun site" subtitle="Aucun site avec GE ne correspond à ces filtres, ou les faits Snowflake n'ont pas encore été synchronisés (sync_fuel_daily_facts)." />
        ) : (
          <>
            <div style={{ overflow: "auto", maxHeight: 620, borderRadius: 12, border: `1px solid ${FT.border}`, opacity: q.isFetching ? 0.6 : 1 }} aria-busy={q.isFetching}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 2050 }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ ...th, textAlign: "left" }}>Site</th>
                    <th scope="col" style={th}>Dates</th>
                    <th scope="col" style={th}>Runtime (h)<HelpTip label="runtime" text={HELP.runtime} /></th>
                    <th scope="col" style={th}>Source runtime<HelpTip label="disponibilité" text={HELP.disponibilite} /></th>
                    <th scope="col" style={th}>Puissance (kW)<HelpTip label="puissance" text={HELP.puissance} /></th>
                    <th scope="col" style={th}>Courbe<HelpTip label="courbe" text={HELP.courbe} /></th>
                    <th scope="col" style={th}>CPH (L/h)<HelpTip label="CPH" text={HELP.cph} /></th>
                    <th scope="col" style={th}>Conso théorique (L)<HelpTip label="consommation théorique" text={HELP.conso} /></th>
                    <th scope="col" style={th}>Stock initial (L)<HelpTip label="stocks" text={HELP.stock} /></th>
                    <th scope="col" style={th}>Livraisons (L)<HelpTip label="livraisons" text={HELP.livraisons} /></th>
                    <th scope="col" style={th}>Rajouts / retraits / vols / vidanges (L)</th>
                    <th scope="col" style={th}>Stock final (L)</th>
                    <th scope="col" style={th}>Conso stock (L)<HelpTip label="consommation stock" text={HELP.consoStock} /></th>
                    <th scope="col" style={th}>Écart (L / %)<HelpTip label="écart" text={HELP.ecart} /></th>
                    <th scope="col" style={th}>Statut<HelpTip label="statut" text={HELP.statut} /></th>
                    <th scope="col" style={{ ...th, textAlign: "left" }}>Motifs</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: CphSiteRow, i) => {
                    const rec = r.rapprochement;
                    const motifs = [r.data_issue, ...(r.curve ? [] : [r.curve_reason]), ...r.motifs, ...(rec?.motifs ?? []), ...(!rec ? ["Aucune observation de stock sur la période"] : [])].filter(Boolean) as string[];
                    const moves = rec ? [rec.rajouts_l, rec.retraits_l, rec.vols_l, rec.vidanges_l].map((v) => nf(v, 0) ?? "—").join(" / ") : null;
                    return (
                      <tr key={r.site_id} style={{ background: i % 2 === 0 ? "#fff" : FT.cardAlt }}>
                        <td style={{ ...td, textAlign: "left" }}>
                          <button type="button" onClick={() => setDetailSite(r.site_id)} aria-label={`Détail jour par jour de ${r.site_id}`} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", color: FT.blue, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace", textDecoration: "underline" }}>
                            {r.site_id}
                          </button>
                          <div style={{ fontSize: 11, color: FT.textSub }}>{r.site_name ?? "—"} · {r.kind ?? "type ?"} · {r.zone ?? "zone ?"}</div>
                        </td>
                        <td style={td}>{fmtDate(r.start)} → {fmtDate(r.end)}<div style={{ fontSize: 11, color: FT.textSub }}>{r.days} j</div></td>
                        <td style={td}>
                          <Num value={r.runtime_total_h} digits={1} reason="Aucune source de runtime ne passe les contrôles sur la période." />
                          <div style={{ fontSize: 11, color: FT.textSub }}>{r.runtime_days}/{r.days} j</div>
                        </td>
                        <td style={td} title={Object.entries(r.sources).map(([k, v]) => `${RUNTIME_SOURCE_LABELS[k]} : ${v.availability_pct} %${v.rejection ? ` — ${v.rejection}` : ""}`).join("\n")}>
                          {r.runtime_source_main ? RUNTIME_SOURCE_LABELS[r.runtime_source_main] : "—"}
                          <div style={{ fontSize: 11, color: FT.textSub }}>
                            {(["DSE", "REDRESSEUR", "DAY_DG_ON", "COMPTEUR_TERRAIN"] as const).map((k) => `${k === "COMPTEUR_TERRAIN" ? "Cpt" : k === "DAY_DG_ON" ? "DGOn" : k === "REDRESSEUR" ? "Red" : "DSE"} ${r.sources[k]?.availability_pct ?? 0}%`).join(" · ")}
                          </div>
                        </td>
                        <td style={td}>
                          <Num value={r.p_ge_moy_kw} digits={2} reason="Aucun jour avec puissance GE qualifiée et CPH calculé." />
                          <div style={{ fontSize: 11, color: FT.textSub }}>{r.power_source_main ? POWER_SOURCE_LABELS[r.power_source_main] : "—"}</div>
                        </td>
                        <td style={td} title={r.curve ? `${r.curve.label} · a=${r.curve.a} b=${r.curve.b} c=${r.curve.c}` : r.curve_reason ?? undefined}>
                          {r.curve ? <Tag tone={FT.green}>{r.curve.curve_id}</Tag> : <Tag tone={FT.orange}>Aucune</Tag>}
                          <div style={{ fontSize: 11, color: FT.textSub }}>{r.ge_label ?? "GE inconnu"}</div>
                        </td>
                        <td style={td}>
                          <Num value={r.cph_moy_l_h} digits={2} reason="Aucun jour avec runtime, puissance et courbe validée." />
                          {r.extrapolated_days > 0 && <div><Tag tone={FT.orange}>{r.extrapolated_days} j &lt; 50 %</Tag></div>}
                        </td>
                        <td style={td}>
                          {r.conso_theorique_l !== null ? (
                            <Num value={r.conso_theorique_l} digits={1} />
                          ) : r.conso_partielle_l !== null ? (
                            <span title="Somme partielle : certains jours n'ont pas de consommation calculée">
                              <span style={{ color: FT.textSub }}>—</span>
                              <div style={{ fontSize: 11, color: FT.orange }}>partiel {nf(r.conso_partielle_l, 1)} L ({r.conso_days}/{r.days} j)</div>
                            </span>
                          ) : (
                            <Num value={null} reason="Aucun jour calculé." />
                          )}
                          <div style={{ fontSize: 11, color: FT.textSub }}>{CPH_STATUS_LABELS[r.cph_status]}</div>
                        </td>
                        <td style={td}><Num value={rec?.stock_initial_l} digits={0} reason={rec ? "Absent du fichier d'observation." : "Aucune observation."} /></td>
                        <td style={td}>
                          <Num value={rec?.livraisons_l} digits={0} reason={rec ? "Absent du fichier d'observation." : "Aucune observation."} />
                          {rec?.livraisons_statut === "LIVRAISONS_ENOC_A_CONTROLER" && <div><Tag tone={FT.orange}>à contrôler</Tag></div>}
                        </td>
                        <td style={td}>{moves ?? <Num value={null} reason="Aucune observation." />}</td>
                        <td style={td}><Num value={rec?.stock_final_l} digits={0} reason={rec ? "Absent du fichier d'observation." : "Aucune observation."} /></td>
                        <td style={td}><Num value={rec?.conso_stock_l} digits={0} reason="Rapprochement non effectué (voir motifs)." /></td>
                        <td style={td}>
                          <Num value={rec?.ecart_l} digits={0} reason="Rapprochement non effectué (voir motifs)." />
                          <div style={{ fontSize: 11 }}><Num value={rec?.ecart_pct} digits={1} suffix=" %" /></div>
                        </td>
                        <td style={td}><StatutBadge statut={r.rapprochement_statut} /></td>
                        <td style={{ ...td, textAlign: "left", whiteSpace: "normal", minWidth: 280, maxWidth: 420, fontSize: 11.5, color: FT.textMid }}>
                          {motifs.length === 0 ? "—" : motifs.slice(0, 3).join(" · ")}
                          {motifs.length > 3 && (
                            <button type="button" onClick={() => setDetailSite(r.site_id)} style={{ border: "none", background: "transparent", color: FT.blue, cursor: "pointer", fontSize: 11, fontWeight: 800, padding: 0, marginLeft: 4 }}>
                              +{motifs.length - 3}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data && (
              <Pager
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                hasPrev={data.pagination.hasPrev}
                hasNext={data.pagination.hasNext}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
                pageSize={limit}
                onPageSizeChange={(n) => { setLimit(n); setPage(1); }}
                pageSizeOptions={[25, 50, 100, 200]}
              />
            )}
          </>
        )}
      </Card>

      {detailSite && <SiteDetailModal siteId={detailSite} start={period.start} end={period.end} onClose={() => setDetailSite(null)} />}
      {showImport && <ObservationImportModal onClose={() => setShowImport(false)} onImported={() => qc.invalidateQueries({ queryKey: ["cph-period"] })} />}
      {showReferentiel && <ReferentielModal onClose={() => setShowReferentiel(false)} />}
    </div>
  );
}
