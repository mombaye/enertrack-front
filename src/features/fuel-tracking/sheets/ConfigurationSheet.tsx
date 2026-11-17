// src/features/fuel-tracking/sheets/ConfigurationSheet.tsx
// Rubrique « Configuration » du Suivi Carburant : envoi des fichiers de clôture, tels que produits par l'équipe Ops —
// Closing (« Esco Senegal - Synthèse Conso Fuel <mois> », onglet « Synthese conso fuel ») ou Output App Fuel (onglet
// « Output »). Le serveur reconnaît le format, importe en arrière-plan puis recalcule les bilans des mois couverts.
// Suivi en direct : envoi (%) → en attente → import des données → recalcul des bilans (mois par mois) → résultat.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, FileUp, Loader2, Settings2, Trash2, XCircle } from "lucide-react";
import { getClosingUploads, uploadClosingFile, withdrawClosingFile, type ClosingUploadBatch, type ClosingUploadStatus } from "@/services/fuelTracking";
import { Card, EmptyState, Modal, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { actionBtn, Dash, fmtDateTime, StatusPill, tdStyle, thStyle } from "./stockRegistryUi";

const ACCEPT = ".xlsb,.xlsx,.xlsm";
const STEPS = ["Envoi du fichier", "En attente", "Import des données", "Recalcul des bilans", "Terminé"] as const;
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function sizeLabel(bytes: number | null | undefined) {
  if (!bytes) return null;
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(bytes / 1024)} Ko`;
}

function monthLabel(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS.at(m - 1) ?? m} ${y}`;
}

/** Mois calendaire précédent (AAAA-MM) : valeur proposée par défaut, le fichier de clôture couvre le mois écoulé. */
function previousMonth() {
  const d = new Date();
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function elapsed(fromIso: string | null | undefined, now: number) {
  if (!fromIso) return null;
  const s = Math.max(0, Math.round((now - new Date(fromIso).getTime()) / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

function errorMessage(e: unknown) {
  const r = (e as { response?: { status?: number; data?: { detail?: string } } })?.response;
  if (r?.status === 403) return "Envoi réservé aux rôles admin et manager.";
  if (r?.status === 413) return "Fichier trop volumineux pour le serveur (limite du proxy) : contacter l'administrateur.";
  return r?.data?.detail ?? "Envoi impossible : vérifier la connexion puis réessayer.";
}

const ACTIVE_STEPS = new Set(["IMPORT", "RECALCUL", "RETRAIT_RECALCUL"]);

/** Étape courante (index dans STEPS) et état d'un import suivi. */
function stepOf(uploadPct: number | null, fileName: string | null, data: ClosingUploadStatus | undefined) {
  if (uploadPct !== null) return { index: 0, failed: false, lot: undefined as ClosingUploadBatch | undefined };
  const lot = fileName ? data?.lots.find((b) => b.file_name === fileName) : undefined;
  if (!lot) return { index: 1, failed: false, lot };
  switch (lot.etape) {
    case "IMPORT":
      return { index: 2, failed: false, lot };
    case "RECALCUL":
      return { index: 3, failed: false, lot };
    case "ECHEC":
      return { index: lot.recalcul_bilans?.statut === "ECHEC" ? 3 : 2, failed: true, lot };
    default:
      return { index: 4, failed: false, lot };
  }
}

function ImportProgress({ fileName, uploadPct, data, now, onClose }: {
  fileName: string | null; uploadPct: number | null; data: ClosingUploadStatus | undefined; now: number; onClose: () => void;
}) {
  const { index, failed, lot } = stepOf(uploadPct, fileName, data);
  const done = index === 4;
  const recalc = lot?.recalcul_bilans;
  const detail: Record<number, string | null> = {
    0: uploadPct !== null ? `${uploadPct} %` : null,
    1: "le serveur prend le fichier en charge",
    2: lot ? `depuis ${elapsed(lot.received_at, now)}` : null,
    3: recalc?.mois_total ? `${recalc.mois_faits ?? 0} / ${recalc.mois_total} mois` : null,
    4: null,
  };
  return (
    <div role="status" aria-live="polite" style={{ marginTop: 16, padding: 16, borderRadius: FT.radius, border: `1px solid ${FT.border}`, background: FT.cardAlt }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13.5, color: FT.text }}>Suivi de l'import{fileName ? ` — ${fileName.replace(/^\d{8}_\d{6}_/, "")}` : ""}</strong>
        {(done || failed) && (
          <button type="button" onClick={onClose} style={{ ...actionBtn, padding: "4px 10px", fontSize: 12 }}>Fermer</button>
        )}
      </div>

      <ol style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "grid", gap: 8 }}>
        {STEPS.map((label, i) => {
          const state = failed && i === index ? "failed" : i < index || (done && i === index) ? "done" : i === index ? "active" : "todo";
          const color = state === "failed" ? FT.red : state === "done" ? FT.green : state === "active" ? FT.blue : FT.textSub;
          const Icon = state === "failed" ? XCircle : state === "done" ? CheckCircle2 : state === "active" ? Loader2 : Circle;
          return (
            <li key={label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: state === "todo" ? FT.textSub : FT.text }}>
              <Icon size={17} color={color} aria-hidden className={state === "active" ? "animate-spin" : undefined} />
              <span style={{ fontWeight: state === "active" ? 700 : 500 }}>{label}</span>
              {(state === "active" || state === "failed") && detail[i] && <span style={{ color: FT.textMid, fontSize: 12.5 }}>· {detail[i]}</span>}
              <span className="sr-only">{state === "done" ? "terminé" : state === "active" ? "en cours" : state === "failed" ? "en échec" : "à venir"}</span>
            </li>
          );
        })}
      </ol>

      {index === 0 && uploadPct !== null && (
        <div aria-hidden style={{ marginTop: 10, height: 6, borderRadius: 3, background: FT.border, overflow: "hidden" }}>
          <div style={{ width: `${uploadPct}%`, height: "100%", background: FT.blue, transition: "width .3s" }} />
        </div>
      )}

      {failed && lot && (
        <div role="alert" style={{ marginTop: 12, color: FT.red, fontSize: 13 }}>
          {recalc?.motif ?? lot.status_message ?? "Échec du traitement."}
        </div>
      )}

      {done && lot && (
        <div style={{ marginTop: 12, fontSize: 13, color: FT.text, display: "grid", gap: 6 }}>
          <div>
            <strong>{lot.format ?? "Closing"}</strong>
            {lot.etape === "DOUBLON" ? " — fichier déjà reçu : aucune donnée réimportée." : ""}
            {lot.stocks_importes !== null && lot.stocks_importes !== undefined ? ` — ${lot.stocks_importes} stocks importés` : ""}
            {lot.sites_inconnus ? `, ${lot.sites_inconnus} sites inconnus (absents de Gestion des sites)` : ""}.
          </div>
          {lot.mois && <div>Mois déclaré : <strong>{monthLabel(lot.mois)}</strong></div>}
          {lot.controle_mois?.avertissement && (
            <div role="alert" style={{ color: FT.orange }}>{lot.controle_mois.avertissement}</div>
          )}
          {recalc?.mois && recalc.mois.length > 0 && (
            <div>
              Bilans recalculés :{" "}
              {recalc.mois.map((m) => `${monthLabel(m.debut)} — ${m.calculables} calculables sur ${m.sites} sites`).join(" · ")}
            </div>
          )}
          {lot.etape === "IMPORTE" && <div style={{ color: FT.textMid }}>Bilans recalculés au prochain calcul automatique (chaque nuit).</div>}
        </div>
      )}
    </div>
  );
}

export function ConfigurationSheet() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [tracked, setTracked] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [mois, setMois] = useState(previousMonth);
  const [toWithdraw, setToWithdraw] = useState<ClosingUploadBatch | null>(null);
  const [motif, setMotif] = useState("");
  const [withdrawInfo, setWithdrawInfo] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["fuel-configuration-closing"],
    queryFn: getClosingUploads,
    // Rafraîchit toutes les 3 s tant qu'un fichier attend ou qu'un import / recalcul est en cours.
    refetchInterval: (query) => {
      const d = query.state.data;
      const tracking = tracked && !d?.lots.some((b) => b.file_name === tracked && !ACTIVE_STEPS.has(b.etape ?? ""));
      return d && (tracking || d.en_attente.length || d.lots.some((b) => ACTIVE_STEPS.has(b.etape ?? ""))) ? 3000 : false;
    },
  });

  // Après un rechargement de page : reprend le suivi d'un import encore en cours.
  useEffect(() => {
    if (!tracked && uploadPct === null && q.data) {
      const running = q.data.lots.find((b) => ACTIVE_STEPS.has(b.etape ?? ""));
      if (running) setTracked(running.file_name);
    }
  }, [q.data, tracked, uploadPct]);

  // Horloge pour la durée affichée pendant l'import.
  const active = uploadPct !== null || (tracked && stepOf(null, tracked, q.data).index < 4 && !stepOf(null, tracked, q.data).failed);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const send = useMutation({
    mutationFn: (f: File) => uploadClosingFile(f, mois, setUploadPct),
    onMutate: () => {
      setUploadPct(0);
      setTracked(null);
    },
    onSuccess: (res) => {
      setInfo(res.message);
      setTracked(res.fichier);
      setUploadPct(null);
      setFile(null);
      if (input.current) input.current.value = "";
      qc.invalidateQueries({ queryKey: ["fuel-configuration-closing"] });
      qc.invalidateQueries({ queryKey: ["stock-imports"] });
    },
    onError: () => {
      setInfo(null);
      setUploadPct(null);
    },
  });

  const withdraw = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => withdrawClosingFile(id, reason),
    onSuccess: (res) => {
      setWithdrawInfo(
        `Fichier retiré : ${res.stocks_supprimes} stock(s) supprimé(s)` +
          (res.mois.length ? `, bilans de ${res.mois.map(monthLabel).join(" et ")} en cours de recalcul.` : ".") +
          (res.avertissement ? ` ${res.avertissement}` : ""),
      );
      setToWithdraw(null);
      setMotif("");
      qc.invalidateQueries({ queryKey: ["fuel-configuration-closing"] });
      qc.invalidateQueries({ queryKey: ["stock-imports"] });
    },
  });

  const canSend = q.data?.peut_envoyer ?? false;
  const pending = q.data?.en_attente ?? [];
  const lots = q.data?.lots ?? [];
  const showProgress = uploadPct !== null || tracked !== null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <SheetTitle
          icon={<Settings2 size={17} />}
          title="Configuration — fichiers de clôture"
          subtitle="Importer tel quel le Closing mensuel (onglet « Synthese conso fuel ») ou le fichier Output App Fuel (onglet « Output ») : le format est reconnu automatiquement. Ils fournissent les stocks de début et de fin de mois, les livraisons déclarées et les courbes CPH (onglet GENSET DB du Closing)."
        />

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <label
            htmlFor="closing-file"
            style={{
              position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "18px 16px", borderRadius: FT.radius,
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
                <>Choisir le fichier Closing ou Output App Fuel ({ACCEPT.replace(/,/g, ", ")})</>
              )}
            </span>
            <input
              id="closing-file"
              ref={input}
              type="file"
              accept={ACCEPT}
              disabled={!canSend || send.isPending}
              aria-label="Fichier de clôture à importer"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setInfo(null);
                send.reset();
              }}
              style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0 0 0 0)", border: 0 }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label htmlFor="closing-month" style={{ fontSize: 13, color: FT.text, fontWeight: 600 }}>Mois couvert par le fichier</label>
            <input
              id="closing-month"
              type="month"
              value={mois}
              max={currentMonth()}
              required
              disabled={!canSend || send.isPending}
              onChange={(e) => setMois(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: FT.radiusSm, border: `1px solid ${FT.borderStrong}`, fontSize: 13, color: FT.text }}
            />
            <button
              type="button"
              style={{ ...actionBtn, opacity: !file || !mois || !canSend || send.isPending ? 0.55 : 1 }}
              disabled={!file || !mois || !canSend || send.isPending}
              onClick={() => file && send.mutate(file)}
            >
              {send.isPending ? "Envoi en cours…" : "Importer le fichier"}
            </button>
            {!canSend && q.data && <span style={{ fontSize: 12.5, color: FT.textMid }}>Envoi réservé aux rôles admin et manager.</span>}
          </div>

          {send.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>{errorMessage(send.error)}</div>}
          {info && !showProgress && <div role="status" style={{ color: FT.green, fontSize: 13 }}>{info}</div>}

          {showProgress && (
            <ImportProgress fileName={tracked} uploadPct={uploadPct} data={q.data} now={now} onClose={() => { setTracked(null); setInfo(null); }} />
          )}

          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: FT.textMid, lineHeight: 1.6 }}>
            <li>Le traitement se fait en arrière-plan (quelques minutes pour un fichier complet) ; le suivi se met à jour seul, même si vous quittez la page.</li>
            <li>Les bilans des mois couverts par le fichier sont recalculés automatiquement juste après l'import.</li>
            <li>Un fichier identique déjà reçu n'est jamais réimporté (empreinte du fichier) ; le renvoyer relance seulement le recalcul.</li>
          </ul>
        </div>
      </Card>

      <Card>
        <SheetTitle icon={<FileUp size={17} />} title="Fichiers reçus" subtitle="Les 10 derniers fichiers de clôture importés et leur résultat." />
        {q.isLoading && <Skeleton h={140} />}
        {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 13, marginTop: 12 }}>Liste indisponible.</div>}
        {withdrawInfo && <div role="status" style={{ color: FT.green, fontSize: 13, marginTop: 12 }}>{withdrawInfo}</div>}

        {pending.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: FT.orange }}>
            En attente de traitement : {pending.map((p) => p.file_name.replace(/^\d{8}_\d{6}_/, "")).join(", ")}
          </div>
        )}

        {q.data && lots.length === 0 && pending.length === 0 && (
          <EmptyState icon={<FileUp size={20} />} title="Aucun fichier importé" subtitle="Le premier fichier envoyé apparaîtra ici." />
        )}

        {lots.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Fichier</th>
                  <th style={thStyle}>Format</th>
                  <th style={thStyle}>Mois</th>
                  <th style={thStyle}>Reçu le</th>
                  <th style={thStyle}>Étape</th>
                  <th style={thStyle}>Stocks importés</th>
                  <th style={thStyle}>Sites inconnus</th>
                  <th style={thStyle}>Bilans recalculés</th>
                  <th style={thStyle}>Message</th>
                  {canSend && <th style={thStyle}><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {lots.map((b: ClosingUploadBatch) => (
                  <tr key={b.id}>
                    <td style={{ ...tdStyle, textAlign: "left", maxWidth: 260, wordBreak: "break-word" }}>{b.file_name.replace(/^\d{8}_\d{6}_/, "")}</td>
                    <td style={tdStyle}>{b.format ?? "Closing"}</td>
                    <td style={tdStyle}>
                      {b.mois ? monthLabel(b.mois) : <Dash reason="Fichier déposé sans mois déclaré (dépôt direct dans le partage)." />}
                      {b.controle_mois?.avertissement && (
                        <span title={b.controle_mois.avertissement} aria-label={b.controle_mois.avertissement} style={{ color: FT.orange, marginLeft: 4, cursor: "help" }}>⚠</span>
                      )}
                    </td>
                    <td style={tdStyle}>{fmtDateTime(b.received_at, true) ?? <Dash />}</td>
                    <td style={tdStyle}><StatusPill status={b.etape ?? b.status} map={STEP_LABEL} /></td>
                    <td style={tdStyle}>{b.stocks_importes ?? <Dash reason="Pas encore traité ou aucun stock lu." />}</td>
                    <td style={tdStyle}>{b.sites_inconnus ?? <Dash />}</td>
                    <td style={{ ...tdStyle, textAlign: "left" }}>
                      {b.recalcul_bilans?.mois?.length
                        ? b.recalcul_bilans.mois.map((m) => `${monthLabel(m.debut)} : ${m.calculables}/${m.sites}`).join(" · ")
                        : <Dash reason={b.etape === "IMPORTE" ? "Recalcul au calcul automatique de nuit." : undefined} />}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "left", color: FT.textMid }}>{b.recalcul_bilans?.motif ?? b.status_message ?? <Dash />}</td>
                    {canSend && (
                      <td style={tdStyle}>
                        {!b.annulation && !ACTIVE_STEPS.has(b.etape ?? "") && b.etape !== "DOUBLON" && (
                          <button
                            type="button"
                            onClick={() => { setToWithdraw(b); setMotif(""); withdraw.reset(); }}
                            aria-label={`Retirer le fichier ${b.file_name.replace(/^\d{8}_\d{6}_/, "")}`}
                            style={{ ...actionBtn, padding: "4px 10px", fontSize: 12, color: FT.red, display: "inline-flex", alignItems: "center", gap: 6 }}
                          >
                            <Trash2 size={14} aria-hidden /> Retirer
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {toWithdraw && (
        <Modal title="Retirer ce fichier ?" onClose={() => setToWithdraw(null)} maxWidth={520}>
          <div style={{ display: "grid", gap: 12, fontSize: 13, color: FT.text }}>
            <div>
              <strong>{toWithdraw.file_name.replace(/^\d{8}_\d{6}_/, "")}</strong>
              {toWithdraw.mois ? ` — ${monthLabel(toWithdraw.mois)}` : ""}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, color: FT.textMid }}>
              <li>Les <strong>{toWithdraw.stocks_importes ?? 0} stock(s)</strong> importés par ce fichier seront supprimés, ainsi que ses targets.</li>
              <li>Les bilans des mois concernés seront recalculés ; un bilan certifié qui change passera « à recertifier ».</li>
              <li>Le fichier reste archivé et la trace du retrait est conservée (qui, quand, motif). Il pourra être réimporté.</li>
            </ul>
            <label htmlFor="withdraw-motif" style={{ fontWeight: 600 }}>Motif (facultatif)</label>
            <input
              id="withdraw-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="ex. mauvais mois, fichier remplacé par une nouvelle version"
              style={{ padding: "8px 10px", borderRadius: FT.radiusSm, border: `1px solid ${FT.borderStrong}`, fontSize: 13 }}
            />
            {withdraw.isError && <div role="alert" style={{ color: FT.red }}>{errorMessage(withdraw.error)}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={() => setToWithdraw(null)} style={{ ...actionBtn }}>Annuler</button>
              <button
                type="button"
                disabled={withdraw.isPending}
                onClick={() => withdraw.mutate({ id: toWithdraw.id, reason: motif })}
                style={{ ...actionBtn, background: FT.red, color: "#fff", borderColor: FT.red, opacity: withdraw.isPending ? 0.6 : 1 }}
              >
                {withdraw.isPending ? "Retrait…" : "Retirer le fichier"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const STEP_LABEL: Record<string, { label: string; tone: "green" | "orange" | "red" | "blue" | "slate" }> = {
  IMPORT: { label: "Import en cours", tone: "blue" },
  RECALCUL: { label: "Recalcul des bilans", tone: "blue" },
  TERMINE: { label: "Terminé", tone: "green" },
  IMPORTE: { label: "Importé", tone: "green" },
  DOUBLON: { label: "Déjà reçu", tone: "slate" },
  ECHEC: { label: "Échec", tone: "red" },
  RETRAIT_RECALCUL: { label: "Retiré — recalcul en cours", tone: "orange" },
  RETIRE: { label: "Retiré", tone: "slate" },
};
