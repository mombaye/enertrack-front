// Remontées terrain (maquette suivi-carburant-v5) : déposer un fichier terrain, voir le contrôle, importer.
// Réutilise les endpoints existants : /stock/imports/analyser/ (lecture seule, rien n'est enregistré),
// /stock/imports/ (import réel, mêmes règles que Suivi Stock → Imports), /stock/releves/ (relevés importés).
import { useContext, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  analyzeStockFile, downloadImportReport, getStockImports, getStockReadings, uploadStockImport,
  type FileAnalysis, type ImportSourceType, type StockImportBatch,
} from "@/services/fuelTracking";
import { FT } from "../theme";
import { Card } from "../ui";
import { guessType } from "../sheets/ConfigurationSheet";
import { CARD, FilterBar, OpenSiteContext, Pill, StateBox, TH, fNum, type PillTone } from "./kit";

type TerrainType = Extract<ImportSourceType, "SCSS" | "LOLIFORCE" | "HISTORICAL_REFUELING" | "TERRAIN_MENSUEL">;
const TYPES: Array<[TerrainType, string]> = [
  ["SCSS", "Remontée carburant SCSS : relevés de stock terrain"],
  ["LOLIFORCE", "Remontée carburant Loliforce : relevés de stock terrain"],
  ["HISTORICAL_REFUELING", "Suivi refueling (historique)"],
  ["TERRAIN_MENSUEL", "Remontées terrain mensuelles (complémentaire)"],
];
const SOURCE_SHORT: Record<string, string> = { SCSS: "SCSS", LOLIFORCE: "Loliforce", HISTORICAL_REFUELING: "Refueling", TERRAIN_MENSUEL: "Terrain mensuel",
  CLOSING: "Closing", TANK_MODELS: "Modèles de cuves", TARGET_FUEL: "Target fuel", ENOC: "ENOC" };
const STATUS: Record<string, [string, PillTone]> = {
  ACCEPTED: ["Intégré", "good"], VALIDATION_REQUIRED: ["Validation requise", "warn"], PROCESSING: ["En traitement", "mute"], RECEIVED: ["Reçu", "mute"],
  REJECTED: ["Rejeté", "crit"], FAILED: ["Échec technique", "crit"],
  AUTO_VALIDE: ["Pris en compte", "good"], VALIDE_MANUELLEMENT: ["Pris en compte (validé)", "good"], VALIDATED: ["Pris en compte", "good"],
  A_TRAITER: ["À traiter", "warn"], PENDING: ["À valider", "warn"], REJETE: ["Rejeté", "crit"], NON_EXPLOITABLE: ["Non exploitable", "mute"],
};
const statusPill = (s: string | null | undefined) => { const x = s ? STATUS[s] : null; return x ? <Pill tone={x[1]}>{x[0]}</Pill> : <Pill tone="mute">{s ?? "—"}</Pill>; };
const fDate = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const apiDetail = (e: unknown) => (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Opération impossible, réessayez.";
const td = { padding: "8px 10px", borderBottom: "1px solid #F0F2F6", fontSize: 12.5, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const };
const btn = (primary: boolean, off = false) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600,
  border: `1px solid ${primary ? "#1A56C4" : "#E6EAF0"}`, background: primary ? "#1A56C4" : "#fff", color: primary ? "#fff" : "#0B1220",
  cursor: off ? "not-allowed" : "pointer", opacity: off ? 0.45 : 1, fontFamily: "inherit",
});

function Precheck({ a }: { a: FileAnalysis }) {
  const c = a.controle_lignes;
  const cov = a.couverture_sites;
  const motifs = Object.entries(c?.motifs_rejet ?? {}).sort((x, y) => y[1] - x[1]).slice(0, 4);
  return (
    <div style={{ border: "1px solid #E6EAF0", borderRadius: 10, padding: "10px 12px", display: "grid", gap: 6, fontSize: 12.5 }}>
      <div><b style={{ fontWeight: 700 }}>Contrôle du fichier</b> <span style={{ color: "#7D889B" }}>(lecture seule, rien n'est encore enregistré)</span></div>
      <div style={{ color: "#4B5768" }}>
        Format reconnu : <b style={{ fontWeight: 600 }}>{a.libelle_source ?? a.source_detectee ?? "non reconnu"}</b>
        {a.periode_detectee ? ` · période du ${fDate(a.periode_detectee[0])} au ${fDate(a.periode_detectee[1])}` : ""}
      </div>
      {c ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Pill tone="mute">{fNum(c.lignes_lues)} lignes lues</Pill>
          <Pill tone="good">{fNum(c.lignes_acceptees)} acceptées</Pill>
          {c.lignes_rejetees > 0 && <Pill tone="crit">{fNum(c.lignes_rejetees)} rejetées</Pill>}
          {c.releves_en_cm > 0 && <Pill tone="warn">{fNum(c.releves_en_cm)} relevés en cm</Pill>}
          {cov && <Pill tone={cov.inconnus ? "warn" : "good"}>{fNum(cov.reconnus)} sites reconnus{cov.inconnus ? ` · ${fNum(cov.inconnus)} inconnus` : ""}</Pill>}
        </div>
      ) : <div style={{ color: "#7D889B" }}>Pas de contrôle ligne à ligne pour ce format : il sera fait à l'import.</div>}
      {motifs.length > 0 && <div style={{ color: "#7D889B" }}>Motifs de rejet : {motifs.map(([m, n]) => `${m} (${fNum(n)})`).join(" · ")}</div>}
    </div>
  );
}

function Importer({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<TerrainType | "">("");
  const [drag, setDrag] = useState(false);
  const [result, setResult] = useState<StockImportBatch | null>(null);
  const analyse = useMutation({ mutationFn: ({ f, t }: { f: File; t: string }) => analyzeStockFile(f, t || undefined) });
  const imp = useMutation({
    mutationFn: () => uploadStockImport(file!, type as TerrainType),
    onSuccess: (b) => { setResult(b); onImported(); },
  });
  const pick = (f: File | null) => {
    if (!f) return;
    const g = guessType(f.name);
    const t = TYPES.some(([k]) => k === g) ? (g as TerrainType) : type;
    setFile(f); setType(t); setResult(null); imp.reset();
    analyse.mutate({ f, t });
  };
  const changeType = (t: TerrainType | "") => { setType(t); if (file) analyse.mutate({ f: file, t }); };

  return (
    <Card style={{ ...CARD, display: "grid", gap: 12, alignContent: "start" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0B1220" }}>Importer</div>
        <span style={{ fontSize: 12, color: "#7D889B" }}>.xlsx, .xlsm, .xlsb · 50 Mo maximum</span>
      </div>
      <div role="button" tabIndex={0} aria-label="Choisir un fichier terrain"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0] ?? null); }}
        style={{ border: `2px dashed ${drag ? "#1A56C4" : "#CBD3DF"}`, background: drag ? "#EAF1FD" : "#F6F8FB", borderRadius: 12, padding: "20px 14px", textAlign: "center", cursor: "pointer", display: "grid", gap: 6, justifyItems: "center" }}>
        <b style={{ fontWeight: 700 }}>{file ? file.name : "Glissez le fichier ici"}</b>
        <span style={{ fontSize: 12, color: "#7D889B" }}>{file ? `${(file.size / 1024 / 1024).toFixed(2)} Mo` : "Formats reconnus : Remontée carburant SCSS / Loliforce · Suivi refueling"}</span>
        <span style={btn(true)}>Choisir un fichier</span>
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xlsb" hidden onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
      </div>
      <label style={{ display: "grid", gap: 2 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#7D889B", textTransform: "uppercase", letterSpacing: ".05em" }}>Type de fichier</span>
        <select value={type} onChange={(e) => changeType(e.target.value as TerrainType | "")}
          style={{ height: 34, border: "1px solid #E6EAF0", borderRadius: 8, padding: "0 8px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: "#fff" }}>
          <option value="">— Choisir —</option>
          {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      {analyse.isPending && <span style={{ fontSize: 12, color: "#7D889B" }}>Contrôle du fichier…</span>}
      {analyse.isError && <span role="alert" style={{ fontSize: 12, color: FT.red }}>Contrôle impossible : {apiDetail(analyse.error)}</span>}
      {analyse.data && !analyse.isPending && <Precheck a={analyse.data} />}
      {!file && <span style={{ fontSize: 12, color: "#7D889B" }}>Le fichier est d'abord seulement contrôlé ; il n'est enregistré qu'au clic sur « Importer et recalculer ».</span>}
      <button type="button" disabled={!file || !type || imp.isPending || analyse.isPending} onClick={() => imp.mutate()}
        style={{ ...btn(true, !file || !type || imp.isPending || analyse.isPending), justifySelf: "start" }}>
        {imp.isPending ? "Import en cours…" : "Importer et recalculer"}
      </button>
      {imp.isError && <span role="alert" style={{ fontSize: 12, color: FT.red, fontWeight: 600 }}>{apiDetail(imp.error)}</span>}
      {result && (
        <div role="status" style={{ fontSize: 12.5, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {statusPill(result.status)} Lot n° {result.id}{result.status_message ? ` · ${result.status_message}` : ""}
          {result.duplicate_of != null && <Pill tone="mute">déjà reçu : rien n'est réimporté</Pill>}
        </div>
      )}
    </Card>
  );
}

const READ_PAGE = 50;

export function RemonteesBi() {
  const qc = useQueryClient();
  const openSite = useContext(OpenSiteContext);
  const [page, setPage] = useState(1);
  const [src, setSrc] = useState("");
  const hist = useQuery({ queryKey: ["fuel-remontees-imports"], queryFn: () => getStockImports({ page: 1, limit: 20 }), staleTime: 30_000 });
  const rel = useQuery({
    queryKey: ["fuel-remontees-releves", page, src],
    queryFn: () => getStockReadings({ page, limit: READ_PAGE, source: src || undefined }),
    staleTime: 60_000, placeholderData: (p) => p,
  });
  const batches = hist.data?.data ?? [];
  const rows = rel.data?.data ?? [];
  const total = rel.data?.pagination?.total ?? null;
  const pages = total ? Math.max(1, Math.ceil(total / READ_PAGE)) : 1;
  const thL = { ...TH, textAlign: "left" as const }, thR = { ...TH, textAlign: "right" as const };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <FilterBar title="Remontées terrain" note="déposez le fichier : contrôle, import et recalcul automatiques" />

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(480px, 100%), 1fr))", alignItems: "start" }}>
        <Importer onImported={() => { qc.invalidateQueries({ queryKey: ["fuel-remontees-imports"] }); qc.invalidateQueries({ queryKey: ["fuel-remontees-releves"] }); }} />
        <Card style={CARD}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0B1220", marginBottom: 10 }}>Ensuite, sans intervention</div>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, fontSize: 13, color: "#4B5768" }}>
            <li>Contrôle des colonnes, des sites, des unités et des quantités, ligne par ligne.</li>
            <li>Anti-doublon : un fichier déjà reçu est reconnu par son empreinte, rien n'est réimporté.</li>
            <li>Niveaux en litres → relevés de stock ; niveaux en cm convertis quand la cuve du site est validée.</li>
            <li>Lignes rejetées conservées avec leur motif, consultables dans le rapport du lot.</li>
            <li>Stock, bilans et alertes recalculés par les tâches automatiques.</li>
          </ol>
        </Card>
      </div>

      <Card style={{ ...CARD, padding: 0 }}>
        <div style={{ padding: "14px 16px 10px", fontSize: 13.5, fontWeight: 700, color: "#0B1220" }}>Historique des imports <span style={{ fontSize: 12, fontWeight: 400, color: "#7D889B" }}>20 derniers fichiers, toutes sources</span></div>
        <div style={{ overflowX: "auto" }}>
          {hist.isLoading ? <StateBox height={120} text="Chargement…" />
            : hist.isError ? <StateBox height={120} tone="red" text={`Historique indisponible : ${apiDetail(hist.error)}`} />
            : !batches.length ? <StateBox height={100} text="Aucun fichier reçu pour l'instant." />
            : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={thL}>Reçu le</th><th style={thL}>Fichier</th><th style={thL}>Source</th><th style={thL}>Période</th>
                  <th style={thR}>Lignes</th><th style={thR}>Intégrées</th><th style={thR}>Rejetées</th><th style={thL}>Détail</th>
                </tr></thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td style={td}>{fDate(b.received_at)}</td>
                      <td style={{ ...td, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }} title={b.file_name}>{b.file_name}</td>
                      <td style={td}>{SOURCE_SHORT[b.source_type] ?? b.source_type}</td>
                      <td style={td}>{b.declared_period_start ? `${fDate(b.declared_period_start)} → ${fDate(b.declared_period_end)}` : "—"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fNum(b.rows_total)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fNum(b.rows_accepted + b.rows_warning)}</td>
                      <td style={{ ...td, textAlign: "right", color: b.rows_rejected ? FT.red : undefined }}>{fNum(b.rows_rejected)}</td>
                      <td style={td}>
                        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          {statusPill(b.status)}{b.duplicate_of != null && <Pill tone="mute">doublon</Pill>}
                          <button type="button" onClick={() => downloadImportReport(b.id)} style={{ ...btn(false), padding: "3px 9px", fontSize: 11.5 }}>Rapport</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </Card>

      <Card style={{ ...CARD, padding: 0 }}>
        <div style={{ padding: "14px 16px 10px", display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0B1220" }}>Relevés terrain importés</div>
          {total != null && <span style={{ fontSize: 12, color: "#7D889B" }}>{fNum(total)} relevés · hors capteur Snowflake</span>}
          <select aria-label="Source des relevés" value={src} onChange={(e) => { setSrc(e.target.value); setPage(1); }}
            style={{ marginLeft: "auto", height: 32, border: `1px solid ${src ? "#1A56C4" : "#E6EAF0"}`, background: src ? "#EAF1FD" : "#fff", color: src ? "#1A56C4" : "#0B1220", borderRadius: 8, padding: "0 8px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit" }}>
            <option value="">Toutes les sources importées</option>
            {TYPES.map(([k]) => <option key={k} value={k}>{SOURCE_SHORT[k]}</option>)}
          </select>
        </div>
        <div style={{ overflow: "auto", maxHeight: 620 }}>
          {rel.isLoading ? <StateBox height={160} text="Chargement…" />
            : rel.isError ? <StateBox height={120} tone="red" text={`Relevés indisponibles : ${apiDetail(rel.error)}`} />
            : !rows.length ? <StateBox height={100} text="Aucun relevé terrain importé." />
            : (
              <table style={{ width: "100%", borderCollapse: "collapse", opacity: rel.isFetching ? 0.6 : 1 }}>
                <thead><tr>
                  <th style={{ ...thL, position: "sticky", top: 0, left: 0, zIndex: 2 }}>Site</th><th style={{ ...thL, position: "sticky", top: 0 }}>Date</th>
                  <th style={{ ...thL, position: "sticky", top: 0 }}>Source</th><th style={{ ...thR, position: "sticky", top: 0 }}>Niveau (cm)</th>
                  <th style={{ ...thR, position: "sticky", top: 0 }}>Niveau (L)</th>
                  <th style={{ ...thR, position: "sticky", top: 0 }} title="Pas encore lu dans les fichiers terrain en production.">Compteur (h)</th>
                  <th style={{ ...thL, position: "sticky", top: 0 }}>Prise en compte</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const litres = r.litres_directs ?? r.litres_calcules;
                    return (
                      <tr key={r.id}>
                        <td style={{ ...td, position: "sticky", left: 0, background: "#fff", boxShadow: "1px 0 0 #E6EAF0" }}>
                          {openSite ? <button type="button" onClick={() => openSite(r.site_id)} style={{ all: "unset", cursor: "pointer", fontWeight: 700, color: "#1A56C4" }}>{r.site_id}</button>
                            : <b style={{ fontWeight: 700 }}>{r.site_id}</b>} <span style={{ fontSize: 12, color: "#7D889B" }}>{r.site_name ?? ""}</span>
                        </td>
                        <td style={td}>{fDate(r.date)}</td>
                        <td style={td}>{SOURCE_SHORT[r.source] ?? r.source}</td>
                        <td style={{ ...td, textAlign: "right" }}>{r.niveau_cm == null ? "—" : fNum(r.niveau_cm)}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {litres == null ? (r.unite === "CM" ? <Pill tone="warn">à convertir</Pill> : "—") : fNum(litres)}
                          {r.litres_directs == null && r.litres_calcules != null && <span style={{ fontSize: 11, color: "#7D889B" }}> (converti)</span>}
                        </td>
                        <td style={{ ...td, textAlign: "right", color: "#7D889B", fontStyle: "italic" }}>non disponible</td>
                        <td style={td} title={r.motif ?? undefined}>{statusPill(r.statut_validation)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
        {pages > 1 && (
          <nav aria-label="Pages des relevés" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "10px 14px", fontSize: 12.5, color: "#4B5768" }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} style={btn(false, page <= 1)}>Précédent</button>
            <span>Page {page} / {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} style={btn(false, page >= pages)}>Suivant</button>
          </nav>
        )}
      </Card>
    </div>
  );
}
