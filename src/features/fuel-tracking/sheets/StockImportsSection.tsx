// src/features/fuel-tracking/sheets/StockImportsSection.tsx
// Imports Stock : lots reçus (répertoire partagé ou upload), lignes brutes et contrôles,
// relance tracée. Aucun chemin serveur n'est affiché : seulement les sous-dossiers de dépôt.

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, FolderInput } from "lucide-react";
import {
  getStockImportRows,
  getStockImports,
  relaunchStockImport,
  uploadStockImport,
  type ImportSourceType,
  type StockImportBatch,
} from "@/services/fuelTracking";
import { Card, EmptyState, Modal, Pager, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { actionBtn, Dash, Field, fmtDateTime, inputStyle, ReasonDialog, SOURCE_LABEL, StatusPill, tdStyle, thStyle } from "./stockRegistryUi";

const UPLOAD_TYPES: Array<{ key: Exclude<ImportSourceType, "ENOC">; label: string }> = [
  { key: "LOLIFORCE", label: "Loliforce (relevés)" },
  { key: "SCSS", label: "SCSS (relevés)" },
  { key: "CLOSING", label: "Closing (référentiel cuves)" },
  { key: "HISTORICAL_REFUELING", label: "Historique refueling" },
  { key: "TANK_MODELS", label: "Modèles de cuves (calculateur)" },
];

export function StockImportsSection({ canValidate }: { canValidate: boolean }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [rowsOf, setRowsOf] = useState<StockImportBatch | null>(null);
  const [relaunchOf, setRelaunchOf] = useState<StockImportBatch | null>(null);
  const q = useQuery({ queryKey: ["stock-imports", page], queryFn: () => getStockImports({ page, limit: 10 }), placeholderData: (p) => p });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock-imports"] });
    qc.invalidateQueries({ queryKey: ["stock-registry"] });
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 14 }}>
        <SheetTitle
          icon={<FolderInput size={17} />}
          title="Imports Stock"
          subtitle={
            q.data
              ? q.data.repertoire.monte
                ? `Répertoire partagé monté — dépôt dans ${q.data.repertoire.sous_dossiers.join(", ")} (traitement automatique toutes les 15 min). Un fichier déjà reçu n'est jamais réimporté.`
                : "Répertoire partagé non monté sur le serveur : seul l'upload ci-contre est disponible."
              : "Lots reçus, contrôles ligne à ligne, relance tracée."
          }
        />
        {canValidate && <UploadForm onDone={refresh} />}
      </div>

      {q.isLoading && <Skeleton h={180} />}
      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Liste des imports indisponible.</div>}
      {q.data && q.data.data.length === 0 && <EmptyState icon={<FileUp size={20} />} title="Aucun import" subtitle="Aucun fichier reçu pour l'instant." />}
      {q.data && q.data.data.length > 0 && (
        <>
          <div style={{ overflow: "auto", borderRadius: 10, border: `1px solid ${FT.border}` }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1100 }}>
              <thead>
                <tr>
                  {["Lot", "Reçu le", "Type", "Fichier", "Origine", "Statut", "Lignes", "Acceptées", "Alertes", "À valider", "Rejetées", "Doublons", "Message", "Actions"].map((h) => (
                    <th key={h} scope="col" style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.data.data.map((b, i) => (
                  <tr key={b.id} style={{ background: i % 2 ? FT.cardAlt : "#fff" }}>
                    <td style={tdStyle}>#{b.id}</td>
                    <td style={tdStyle}>{fmtDateTime(b.received_at, true)}</td>
                    <td style={tdStyle}>{SOURCE_LABEL[b.source_type] ?? b.source_type}</td>
                    <td style={{ ...tdStyle, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }} title={b.file_name}>{b.file_name}</td>
                    <td style={tdStyle}>{b.origin}</td>
                    <td style={tdStyle}><StatusPill status={b.status} /></td>
                    <td style={tdStyle}>{b.rows_total}</td>
                    <td style={tdStyle}>{b.rows_accepted}</td>
                    <td style={tdStyle}>{b.rows_warning}</td>
                    <td style={tdStyle}>{b.rows_pending}</td>
                    <td style={tdStyle}>{b.rows_rejected}</td>
                    <td style={tdStyle}>{b.rows_duplicate}</td>
                    <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: 220, textAlign: "left", fontSize: 11.5, color: FT.textMid }}>
                      {b.status_message ?? <Dash />}
                      {b.relaunch_of ? ` (relance du lot #${b.relaunch_of} : ${b.relaunch_reason})` : ""}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                        <button type="button" onClick={() => setRowsOf(b)} style={actionBtn("blue")} aria-label={`Lignes du lot ${b.id}`}>
                          Lignes
                        </button>
                        {canValidate && b.source_type !== "ENOC" && (
                          <button type="button" onClick={() => setRelaunchOf(b)} style={actionBtn("orange")} aria-label={`Relancer le lot ${b.id}`}>
                            Relancer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            page={q.data.pagination.page}
            totalPages={q.data.pagination.totalPages}
            hasPrev={q.data.pagination.hasPrev}
            hasNext={q.data.pagination.hasNext}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </>
      )}

      {rowsOf && <BatchRows batch={rowsOf} onClose={() => setRowsOf(null)} />}
      {relaunchOf && (
        <ReasonDialog
          title={`Relancer le lot #${relaunchOf.id}`}
          description="Le fichier archivé est retraité dans un nouveau lot lié (les lignes déjà importées restent des doublons, rien n'est écrasé)."
          confirmLabel="Relancer"
          tone="orange"
          onClose={() => setRelaunchOf(null)}
          onConfirm={async (reason) => {
            await relaunchStockImport(relaunchOf.id, reason);
            refresh();
          }}
        />
      )}
    </Card>
  );
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const [type, setType] = useState<Exclude<ImportSourceType, "ENOC">>("LOLIFORCE");
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const m = useMutation({
    mutationFn: (file: File) => uploadStockImport(file, type),
    onSuccess: (b) => {
      setResult(`Lot #${b.id} : ${b.status_message ?? b.status}`);
      onDone();
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setResult(detail ?? "Import impossible.");
    },
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Field label="Type de fichier">
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} style={inputStyle}>
            {UPLOAD_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </Field>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xlsm,.xlsb"
          aria-label="Fichier à importer"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) m.mutate(f);
            e.target.value = "";
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={m.isPending} style={{ ...actionBtn("blue", m.isPending), height: 32 }}>
          {m.isPending ? "Traitement…" : "Importer un fichier"}
        </button>
      </div>
      {result && <div role="status" style={{ fontSize: 11.5, color: FT.textMid, maxWidth: 420, textAlign: "right" }}>{result}</div>}
    </div>
  );
}

function BatchRows({ batch, onClose }: { batch: StockImportBatch; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [statut, setStatut] = useState("");
  const q = useQuery({
    queryKey: ["stock-import-rows", batch.id, page, statut],
    queryFn: () => getStockImportRows(batch.id, { page, limit: 50, statut }),
    placeholderData: (p) => p,
  });
  return (
    <Modal title={`Lot #${batch.id} — ${batch.file_name}`} onClose={onClose} maxWidth={1100}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10 }}>
        <Field label="Statut des lignes">
          <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }} style={inputStyle}>
            <option value="">Toutes</option>
            <option value="REJECTED">Rejetées</option>
            <option value="PENDING">À valider</option>
            <option value="WARNING">Avec alerte</option>
            <option value="ACCEPTED">Acceptées</option>
          </select>
        </Field>
        {batch.summary && (
          <div style={{ fontSize: 11.5, color: FT.textMid }}>
            {Object.entries((batch.summary as { codes?: Record<string, number> }).codes ?? {})
              .map(([k, v]) => `${k} : ${v}`)
              .join(" · ")}
          </div>
        )}
      </div>
      {q.isLoading && <Skeleton h={200} />}
      {q.data && (
        <>
          <div style={{ overflow: "auto", maxHeight: 460, borderRadius: 10, border: `1px solid ${FT.border}` }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {["Feuille", "Ligne", "Site (brut)", "Site", "Date", "Statut", "Contrôles"].map((h) => (
                    <th key={h} scope="col" style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.data.data.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 ? FT.cardAlt : "#fff" }}>
                    <td style={tdStyle}>{r.sheet_name ?? "—"}</td>
                    <td style={tdStyle}>{r.row_number}</td>
                    <td style={tdStyle}>{r.site_id_raw ?? "—"}</td>
                    <td style={tdStyle}>{r.site_id_resolved ?? <Dash reason="Site non reconnu" />}</td>
                    <td style={tdStyle}>{fmtDateTime(r.event_datetime) ?? <Dash />}</td>
                    <td style={tdStyle}><StatusPill status={r.validation_status} /></td>
                    <td style={{ ...tdStyle, whiteSpace: "normal", textAlign: "left", minWidth: 320, fontSize: 11.5, color: FT.textMid }}>
                      {r.messages.length ? r.messages.map((m) => m.message).join(" · ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            page={q.data.pagination.page}
            totalPages={q.data.pagination.totalPages}
            hasPrev={q.data.pagination.hasPrev}
            hasNext={q.data.pagination.hasNext}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </>
      )}
    </Modal>
  );
}
