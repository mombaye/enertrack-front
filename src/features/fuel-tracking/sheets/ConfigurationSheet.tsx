// src/features/fuel-tracking/sheets/ConfigurationSheet.tsx
// Rubrique « Configuration » du Suivi Carburant : envoi du fichier de clôture (Closing), le même fichier que celui
// produit par l'équipe Ops (« Esco Senegal - Synthèse Conso Fuel <mois> »). Le serveur l'importe en arrière-plan
// (stocks initial / final par site, conso déclarée), puis recalcule les bilans des mois couverts.

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Settings2 } from "lucide-react";
import { getClosingUploads, uploadClosingFile, type ClosingUploadBatch } from "@/services/fuelTracking";
import { Card, EmptyState, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { actionBtn, Dash, fmtDateTime, StatusPill, tdStyle, thStyle } from "./stockRegistryUi";

const ACCEPT = ".xlsb,.xlsx,.xlsm";

function sizeLabel(bytes: number | null | undefined) {
  if (!bytes) return null;
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(bytes / 1024)} Ko`;
}

function errorMessage(e: unknown) {
  const r = (e as { response?: { status?: number; data?: { detail?: string } } })?.response;
  if (r?.status === 403) return "Envoi réservé aux rôles admin et manager.";
  if (r?.status === 413) return "Fichier trop volumineux pour le serveur (limite du proxy) : contacter l'administrateur.";
  return r?.data?.detail ?? "Envoi impossible : vérifier la connexion puis réessayer.";
}

export function ConfigurationSheet() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["fuel-configuration-closing"],
    queryFn: getClosingUploads,
    // Rafraîchit tant qu'un fichier attend ou qu'un lot est en traitement.
    refetchInterval: (query) => {
      const d = query.state.data;
      return d && (d.en_attente.length || d.lots.some((b) => b.status === "PROCESSING" || b.status === "RECEIVED")) ? 5000 : false;
    },
  });

  const send = useMutation({
    mutationFn: (f: File) => uploadClosingFile(f),
    onSuccess: (res) => {
      setInfo(res.message);
      setFile(null);
      if (input.current) input.current.value = "";
      qc.invalidateQueries({ queryKey: ["fuel-configuration-closing"] });
      qc.invalidateQueries({ queryKey: ["stock-imports"] });
    },
    onError: () => setInfo(null),
  });

  const canSend = q.data?.peut_envoyer ?? false;
  const pending = q.data?.en_attente ?? [];
  const lots = q.data?.lots ?? [];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <SheetTitle
          icon={<Settings2 size={17} />}
          title="Configuration — fichier de clôture (Closing)"
          subtitle="Importer le Closing mensuel tel qu'il est produit par l'équipe Ops (onglet « Synthese conso fuel »). Il fournit le stock initial historique de chaque site et la conso déclarée, utilisée en contrôle."
        />

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <label
            htmlFor="closing-file"
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "18px 16px", borderRadius: FT.radius,
              border: `1.5px dashed ${FT.borderStrong}`, background: FT.cardAlt, cursor: canSend ? "pointer" : "not-allowed",
            }}
          >
            <FileUp size={22} color={FT.navy} />
            <span style={{ fontSize: 13.5, color: FT.text }}>
              {file ? (
                <>
                  <strong>{file.name}</strong> · {sizeLabel(file.size)}
                </>
              ) : (
                <>Choisir le fichier Closing ({ACCEPT.replace(/,/g, ", ")})</>
              )}
            </span>
            <input
              id="closing-file"
              ref={input}
              type="file"
              accept={ACCEPT}
              disabled={!canSend || send.isPending}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setInfo(null);
                send.reset();
              }}
              aria-label="Fichier Closing à importer"
              // Masqué visuellement mais atteignable au clavier (la zone en pointillés est son libellé).
              style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0 0 0 0)", border: 0 }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              style={{ ...actionBtn, opacity: !file || !canSend || send.isPending ? 0.55 : 1 }}
              disabled={!file || !canSend || send.isPending}
              onClick={() => file && send.mutate(file)}
            >
              {send.isPending ? "Envoi en cours…" : "Importer le Closing"}
            </button>
            {!canSend && q.data && <span style={{ fontSize: 12.5, color: FT.textMid }}>Envoi réservé aux rôles admin et manager.</span>}
          </div>

          {send.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>{errorMessage(send.error)}</div>}
          {info && <div role="status" style={{ color: FT.green, fontSize: 13 }}>{info}</div>}

          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: FT.textMid, lineHeight: 1.6 }}>
            <li>Le traitement se fait en arrière-plan (quelques minutes pour un Closing complet) ; cette page se met à jour seule.</li>
            <li>Les bilans des mois couverts par le fichier sont recalculés automatiquement juste après l'import.</li>
            <li>Un fichier identique déjà reçu n'est jamais réimporté (empreinte du fichier) ; le renvoyer relance seulement le recalcul.</li>
          </ul>
        </div>
      </Card>

      <Card>
        <SheetTitle icon={<FileUp size={17} />} title="Closing reçus" subtitle="Les 10 derniers fichiers de clôture importés et leur résultat." />
        {q.isLoading && <Skeleton h={140} />}
        {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 13, marginTop: 12 }}>Liste indisponible.</div>}

        {pending.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: FT.orange }}>
            En attente de traitement : {pending.map((p) => p.file_name).join(", ")}
          </div>
        )}

        {q.data && lots.length === 0 && pending.length === 0 && (
          <EmptyState icon={<FileUp size={20} />} title="Aucun Closing importé" subtitle="Le premier fichier envoyé apparaîtra ici." />
        )}

        {lots.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Fichier</th>
                  <th style={thStyle}>Reçu le</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>Stocks importés</th>
                  <th style={thStyle}>Sites inconnus</th>
                  <th style={thStyle}>Formule incohérente</th>
                  <th style={thStyle}>Message</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((b: ClosingUploadBatch) => (
                  <tr key={b.id}>
                    <td style={{ ...tdStyle, textAlign: "left", maxWidth: 280, wordBreak: "break-word" }}>{b.file_name}</td>
                    <td style={tdStyle}>{fmtDateTime(b.received_at, true) ?? <Dash />}</td>
                    <td style={tdStyle}>
                      {b.duplicate_of ? <StatusPill status="DUPLICATE" map={{ DUPLICATE: { label: "Déjà reçu", tone: "slate" } }} /> : <StatusPill status={b.status} />}
                    </td>
                    <td style={tdStyle}>{b.stocks_importes ?? <Dash reason="Pas encore traité ou aucun stock lu." />}</td>
                    <td style={tdStyle}>{b.sites_inconnus ?? <Dash />}</td>
                    <td style={tdStyle}>{b.formule_incoherente ?? <Dash />}</td>
                    <td style={{ ...tdStyle, textAlign: "left", color: FT.textMid }}>{b.status_message ?? <Dash />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
