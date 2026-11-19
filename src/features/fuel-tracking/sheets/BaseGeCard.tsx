// src/features/fuel-tracking/sheets/BaseGeCard.tsx
// Rubrique « Configuration » : import du fichier « Base GE » (type de GE par site, colonnes « Site ID » et « Type de GE »).
// Le type de GE de chaque site du Suivi Conso est repris de ce fichier (le dernier importé fait foi).

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu, FileUp } from "lucide-react";
import { getStockImports, uploadStockImport } from "@/services/fuelTracking";
import { Card, SheetTitle } from "../ui";
import { FT } from "../theme";
import { actionBtn, fmtDateTime, tdStyle, thStyle } from "./stockRegistryUi";

const STATUS: Record<string, { label: string; color: string }> = {
  ACCEPTED: { label: "Importé", color: FT.green },
  VALIDATION_REQUIRED: { label: "Importé (avertissements)", color: FT.orange },
  PROCESSING: { label: "En cours", color: FT.blue },
  RECEIVED: { label: "Reçu", color: FT.blue },
  REJECTED: { label: "Rejeté", color: FT.red },
  FAILED: { label: "Échec", color: FT.red },
};

function errorText(e: unknown) {
  const r = (e as { response?: { status?: number; data?: { detail?: string } } })?.response;
  if (r?.status === 403) return "Import réservé aux rôles admin et manager.";
  return r?.data?.detail ?? "Import impossible.";
}

export function BaseGeCard() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const lots = useQuery({ queryKey: ["stock-imports", "BASE_GE"], queryFn: () => getStockImports({ source_type: "BASE_GE", limit: 5 }) });
  const send = useMutation({
    mutationFn: (f: File) => uploadStockImport(f, "BASE_GE"),
    onSuccess: () => {
      setFile(null);
      if (input.current) input.current.value = "";
      qc.invalidateQueries({ queryKey: ["stock-imports"] });
      qc.invalidateQueries({ queryKey: ["consommations"] });   // le Suivi Conso relit le type de GE
    },
  });
  const last = send.data;
  const stats = (last?.summary ?? {}) as { stats?: Record<string, number> } & Record<string, unknown>;
  const s = (stats.stats ?? stats) as Record<string, number>;

  return (
    <Card>
      <SheetTitle
        icon={<Cpu size={17} />}
        title="Configuration — Base GE (type de GE par site)"
        subtitle="Importer le fichier « Base GE » : pour chaque site (colonne « Site ID »), le « Type de GE » est repris dans le Suivi Conso (bloc Estimation consommation fuel théorique). Le dernier fichier importé fait foi ; un site absent du fichier garde le type ENOC, sinon Snowflake."
      />
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <label htmlFor="base-ge-file" style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "16px", borderRadius: FT.radius,
          border: `1.5px dashed ${FT.borderStrong}`, background: FT.cardAlt, cursor: "pointer" }}>
          <FileUp size={22} color={FT.navy} />
          <span style={{ fontSize: 13.5, color: FT.text }}>{file ? <strong>{file.name}</strong> : <>Choisir le fichier Base GE (.xlsx, .xlsm)</>}</span>
          <input id="base-ge-file" ref={input} type="file" accept=".xlsx,.xlsm" aria-label="Fichier Base GE à importer"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); send.reset(); }}
            style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0 0 0 0)", border: 0 }} />
        </label>
        <div>
          <button type="button" style={{ ...actionBtn, opacity: !file || send.isPending ? 0.55 : 1 }} disabled={!file || send.isPending}
            onClick={() => file && send.mutate(file)}>
            {send.isPending ? "Import en cours…" : "Importer la Base GE"}
          </button>
        </div>
        {send.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>{errorText(send.error)}</div>}
        {last && (
          <div role="status" style={{ fontSize: 13, color: STATUS[last.status]?.color ?? FT.text }}>
            {STATUS[last.status]?.label ?? last.status} : {last.rows_total} ligne(s) lue(s)
            {typeof s.types === "number" ? `, ${s.types} type(s) de GE` : ""}
            {last.rows_warning ? `, ${last.rows_warning} avertissement(s) (site inconnu, doublon ou type vide)` : ""}.
            {last.status_message ? ` ${last.status_message}` : ""}
          </div>
        )}
        {(lots.data?.data ?? []).length > 0 && (
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
            <thead><tr>{["Fichier", "Reçu le", "Statut", "Lignes", "Avertissements"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {lots.data!.data.map((b, i) => (
                <tr key={b.id}>
                  <td style={tdStyle}>{b.file_name}{i === 0 && <span style={{ color: FT.green, marginLeft: 6, fontWeight: 700 }}>· en vigueur</span>}</td>
                  <td style={tdStyle}>{fmtDateTime(b.received_at)}</td>
                  <td style={{ ...tdStyle, color: STATUS[b.status]?.color }}>{STATUS[b.status]?.label ?? b.status}</td>
                  <td style={tdStyle}>{b.rows_total}</td>
                  <td style={tdStyle}>{b.rows_warning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
