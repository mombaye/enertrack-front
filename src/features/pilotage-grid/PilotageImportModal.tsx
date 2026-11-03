// Mise à jour des données Pilotage Grid : import d'un fichier (nouvelle version en base), historique, restauration, export.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, History, RotateCcw, Upload } from "lucide-react";
import { Modal } from "@/features/fuel-tracking/ui";
import { exportPgDataset, importPgDataset, listPgVersions, pgApiError, restorePgVersion, type PgDatasetMeta } from "@/services/pilotageGrid";
import { DATASET_KEYS, DATASET_LABELS, type PgDatasetKey } from "./sections";

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "—");
const fmtSize = (n?: number) => (n === undefined ? "—" : n > 1e6 ? `${(n / 1e6).toFixed(1)} Mo` : `${Math.round(n / 1e3)} Ko`);

export function PilotageImportModal({ metas, canImport, defaultKey, onClose, onChanged }: {
  metas: PgDatasetMeta[];
  canImport: boolean;
  defaultKey: PgDatasetKey;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [key, setKey] = useState<PgDatasetKey>(defaultKey);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const meta = metas.find((m) => m.key === key);
  const versions = useQuery({ queryKey: ["pg-versions", key], queryFn: () => listPgVersions(key) });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["pg-versions", key] }); onChanged(); };

  const submit = async () => {
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const r = await importPgDataset(key, file, note.trim() || undefined);
      setMsg({ ok: true, text: r.unchanged ? "Aucun changement : le fichier est identique à la version active." : `Version ${r.dataset.version} enregistrée en base et activée.` });
      setFile(null); setNote("");
      if (!r.unchanged) refresh();
    } catch (e) {
      setMsg({ ok: false, text: pgApiError(e) });
    } finally { setBusy(false); }
  };

  const restore = async (v: number) => {
    setBusy(true); setMsg(null);
    try {
      const d = await restorePgVersion(key, v);
      setMsg({ ok: true, text: `Version ${v} restaurée (nouvelle version active : ${d.version}).` });
      refresh();
    } catch (e) { setMsg({ ok: false, text: pgApiError(e) }); } finally { setBusy(false); }
  };

  const box = { border: "1px solid #D3DCD9", borderRadius: 10, padding: 12, background: "#fff" } as const;

  return (
    <Modal title="Mettre à jour les données — Pilotage Grid" onClose={onClose} maxWidth={760}>
      <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
        <label style={{ display: "grid", gap: 4, fontWeight: 700 }}>
          Jeu de données
          <select value={key} onChange={(e) => { setKey(e.target.value as PgDatasetKey); setMsg(null); setFile(null); }} style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid #D3DCD9" }}>
            {DATASET_KEYS.map((k) => <option key={k} value={k}>{DATASET_LABELS[k]}</option>)}
          </select>
        </label>

        <div style={box}>
          <strong>Version active :</strong>{" "}
          {meta?.disponible
            ? <>v{meta.version} · importée le {fmtDate(meta.created_at)} par {meta.imported_by || "—"} · {fmtSize(meta.size_bytes)} · source : {meta.source_file || meta.source}</>
            : "aucune donnée en base — importez le fichier initial."}
          {meta?.disponible && meta.row_counts && (
            <div style={{ color: "#5A6B73", marginTop: 4 }}>{Object.entries(meta.row_counts).map(([k, n]) => `${k} : ${n.toLocaleString("fr-FR")}`).join(" · ")}</div>
          )}
        </div>

        {canImport ? (
          <div style={{ ...box, display: "grid", gap: 8 }}>
            <strong>Importer une nouvelle version</strong>
            <div style={{ color: "#5A6B73" }}>
              Le contenu est stocké en base comme nouvelle version : l'ancienne reste consultable et restaurable. Format accepté pour l'instant : fichier <code>.json</code> (export de la base).
              L'import des fichiers Excel sources sera ajouté avec les fichiers initiaux.
            </div>
            <input type="file" accept=".json,application/json" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setMsg(null); }} aria-label="Fichier à importer" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (facultatif) : ex. mise à jour du 03/11/2026" maxLength={500} style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid #D3DCD9" }} />
            <button type="button" onClick={submit} disabled={!file || busy} style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: !file || busy ? "#9AA4A9" : "#1E5B8E", color: "#fff", fontWeight: 800, cursor: !file || busy ? "not-allowed" : "pointer" }}>
              <Upload size={14} aria-hidden /> {busy ? "Import en cours…" : "Importer"}
            </button>
          </div>
        ) : (
          <div style={{ ...box, color: "#5A6B73" }}>La mise à jour des données est réservée aux rôles admin et manager.</div>
        )}

        {msg && <div role={msg.ok ? "status" : "alert"} style={{ padding: "8px 12px", borderRadius: 8, background: msg.ok ? "#E7F4EC" : "#FBEAEE", color: msg.ok ? "#2E7D5B" : "#B0425A", fontWeight: 700 }}>{msg.text}</div>}

        <div style={box}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><History size={14} aria-hidden /> Historique des versions</strong>
            <button type="button" onClick={() => exportPgDataset(key).catch((e) => setMsg({ ok: false, text: pgApiError(e) }))} disabled={!meta?.disponible} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, border: "1px solid #D3DCD9", background: "#fff", fontWeight: 700, cursor: meta?.disponible ? "pointer" : "not-allowed" }}>
              <Download size={13} aria-hidden /> Exporter ce jeu (JSON)
            </button>
          </div>
          {versions.isLoading ? "Chargement…" : (versions.data ?? []).length === 0 ? "Aucune version." : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ textAlign: "left", color: "#5A6B73" }}><th>Version</th><th>Date</th><th>Par</th><th>Source</th><th>Taille</th><th /></tr></thead>
              <tbody>
                {(versions.data ?? []).map((v) => (
                  <tr key={v.version} style={{ borderTop: "1px solid #E4EBE9" }}>
                    <td style={{ padding: "5px 4px", fontWeight: 800 }}>v{v.version}{v.is_active ? " (active)" : ""}</td>
                    <td>{fmtDate(v.created_at)}</td>
                    <td>{v.imported_by || "—"}</td>
                    <td title={v.note}>{v.source_file || v.source}</td>
                    <td>{fmtSize(v.size_bytes)}</td>
                    <td style={{ textAlign: "right" }}>
                      {canImport && !v.is_active && (
                        <button type="button" onClick={() => restore(v.version!)} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 7, border: "1px solid #D3DCD9", background: "#fff", cursor: "pointer", fontWeight: 700 }}>
                          <RotateCcw size={12} aria-hidden /> Restaurer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
