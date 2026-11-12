// src/features/fuel-tracking/sheets/ConfigurationSheet.tsx
// Rubrique Configuration : accès par code à 6 chiffres (vérifié par le serveur), puis envoi des fichiers
// sources (Closing initial, mises à jour, relevés gardiennage, target, modèles de cuves). Les fichiers sont
// archivés et traités par la même chaîne que le répertoire partagé : contrôle anti-doublon, lignes rejetées
// visibles, aucune valeur inventée.

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Lock, LogOut, ShieldCheck, Upload } from "lucide-react";
import {
  fetchConfigFiles,
  fetchConfigUploadState,
  requestConfigAccess,
  uploadConfigFile,
  type ConfigUploadState,
  type ConfigUploadType,
} from "@/services/fuelTracking";
import { FT } from "../theme";
import { Card, Pill, SheetTitle } from "../ui";
import { IMPORT_SOURCE_LABEL, StatusPill, tdStyle, thStyle } from "./stockRegistryUi";

const STORAGE_KEY = "fuel-config-token";
const TYPES: ConfigUploadType[] = ["CLOSING", "TARGET_FUEL", "SCSS", "LOLIFORCE", "TERRAIN_MENSUEL", "TANK_MODELS", "HISTORICAL_REFUELING"];

type Stored = { token: string; exp: number };

function readToken(): Stored | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

function writeToken(s: Stored | null) {
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible : l'accès reste valable pour cet onglet uniquement */
  }
}

/** Type proposé d'après le nom du fichier ; l'utilisateur confirme ou corrige. Aucun envoi sans choix explicite. */
export function guessType(name: string): ConfigUploadType | null {
  const n = name.toLowerCase();
  if (n.includes("loliforce")) return "LOLIFORCE";
  if (n.includes("remont") || n.includes("scss")) return "SCSS";
  if (n.includes("target")) return "TARGET_FUEL";
  if (n.includes("synth") || n.includes("closing")) return "CLOSING";
  if (n.includes("cuve") || n.includes("tank")) return "TANK_MODELS";
  if (n.includes("refuel") || n.includes("historique")) return "HISTORICAL_REFUELING";
  return null;
}

function apiError(e: unknown): { detail: string; status?: number; left?: number } {
  const r = (e as { response?: { status?: number; data?: { detail?: string; essais_restants?: number } } })?.response;
  return { detail: r?.data?.detail ?? "Serveur injoignable.", status: r?.status, left: r?.data?.essais_restants };
}

function CodeGate({ onGranted }: { onGranted: (s: Stored) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setErr("Le code comporte 6 chiffres.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await requestConfigAccess(code);
      onGranted({ token: r.token, exp: Date.now() + r.expires_in * 1000 });
    } catch (x) {
      setErr(apiError(x).detail);
      setCode("");
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ maxWidth: 420, margin: "40px auto", textAlign: "center" }}>
      <div style={{ width: 46, height: 46, borderRadius: 13, background: FT.blueL, color: FT.navy, display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
        <Lock size={20} aria-hidden />
      </div>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: FT.text }}>Accès Configuration</h2>
      <p style={{ margin: "6px 0 16px", fontSize: 12.5, color: FT.textMid }}>Saisissez le code à 6 chiffres pour gérer les fichiers sources du module.</p>
      <form onSubmit={submit}>
        <label htmlFor="cfg-code" style={{ position: "absolute", left: -9999 }}>Code à 6 chiffres</label>
        <input
          id="cfg-code"
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          aria-invalid={!!err}
          aria-describedby={err ? "cfg-code-err" : undefined}
          style={{ width: "100%", boxSizing: "border-box", textAlign: "center", fontSize: 24, letterSpacing: ".5em", fontWeight: 800, padding: "10px 12px", borderRadius: 10, border: `1px solid ${err ? FT.red : FT.borderStrong}`, outline: "none", color: FT.text }}
        />
        {err && <div id="cfg-code-err" role="alert" style={{ marginTop: 8, fontSize: 12, color: FT.red, fontWeight: 700 }}>{err}</div>}
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          style={{ marginTop: 14, width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", background: FT.navy, color: "#fff", fontWeight: 800, fontSize: 13, cursor: busy || code.length !== 6 ? "not-allowed" : "pointer", opacity: busy || code.length !== 6 ? 0.55 : 1 }}
        >
          {busy ? "Vérification…" : "Déverrouiller"}
        </button>
      </form>
      <p style={{ margin: "12px 0 0", fontSize: 11, color: FT.textSub }}>5 essais faux bloquent l'accès 15 minutes. L'accès expire après 2 heures.</p>
    </Card>
  );
}

function UploadZone({ token, busyElsewhere, onSent, onExpired }: { token: string; busyElsewhere: boolean; onSent: (s: ConfigUploadState) => void; onExpired: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<ConfigUploadType | "">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    setFile(f);
    setErr(null);
    if (f) setType(guessType(f.name) ?? "");
  };

  const send = async () => {
    if (!file || !type) return;
    setBusy(true);
    setErr(null);
    try {
      onSent(await uploadConfigFile(token, file, type));
      setFile(null);
      setType("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (x) {
      const e = apiError(x);
      if (e.status === 403) onExpired();
      setErr(e.detail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div style={{ fontSize: 13.5, fontWeight: 900, color: FT.text, marginBottom: 10 }}>Ajouter un fichier</div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Choisir un fichier Excel"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0] ?? null); }}
        style={{ border: `2px dashed ${drag ? FT.gold : FT.borderStrong}`, background: drag ? FT.goldL : FT.cardAlt, borderRadius: 12, padding: "22px 14px", textAlign: "center", cursor: "pointer" }}
      >
        <FileUp size={22} color={FT.gold} aria-hidden style={{ display: "block", margin: "0 auto" }} />
        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: FT.text }}>{file ? file.name : "Déposez le fichier ici ou cliquez pour le choisir"}</div>
        <div style={{ marginTop: 3, fontSize: 11.5, color: FT.textSub }}>
          {file ? `${(file.size / 1024 / 1024).toFixed(2)} Mo` : "Excel .xlsx, .xlsm ou .xlsb — 50 Mo maximum"}
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xlsb" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label htmlFor="cfg-type" style={{ fontSize: 12, fontWeight: 800, color: FT.textMid }}>Type de fichier</label>
        <select
          id="cfg-type"
          value={type}
          onChange={(e) => setType(e.target.value as ConfigUploadType | "")}
          style={{ flex: "1 1 260px", minWidth: 0, padding: "8px 10px", borderRadius: 9, border: `1px solid ${FT.borderStrong}`, fontSize: 12.5, color: FT.text, background: "#fff" }}
        >
          <option value="">— Choisir —</option>
          {TYPES.map((t) => <option key={t} value={t}>{IMPORT_SOURCE_LABEL[t] ?? t}</option>)}
        </select>
        <button
          type="button"
          onClick={send}
          disabled={!file || !type || busy || busyElsewhere}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: FT.navy, color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: !file || !type || busy || busyElsewhere ? "not-allowed" : "pointer", opacity: !file || !type || busy || busyElsewhere ? 0.55 : 1 }}
        >
          <Upload size={14} aria-hidden /> {busy ? "Envoi…" : "Importer"}
        </button>
      </div>
      {file && type && guessType(file.name) === type && (
        <div style={{ marginTop: 6, fontSize: 11, color: FT.textSub }}>Type proposé d'après le nom du fichier : vérifiez avant d'importer.</div>
      )}
      {err && <div role="alert" style={{ marginTop: 10, fontSize: 12, color: FT.red, fontWeight: 700 }}>{err}</div>}
    </Card>
  );
}

function ResultCard({ s }: { s: ConfigUploadState }) {
  const b = s.batch;
  if (s.etat === "EN_COURS") {
    return (
      <Card style={{ borderLeft: `4px solid ${FT.blue}` }}>
        <div role="status" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 13, color: FT.text }}>{s.file_name}</strong>
          <Pill label="Contrôle en cours…" tone="blue" />
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: FT.textMid }}>
          Le fichier est reçu et contrôlé ligne par ligne. Un gros Closing peut prendre 2 à 3 minutes ; vous pouvez quitter la page, le traitement continue.
        </div>
      </Card>
    );
  }
  if (s.etat === "ECHEC" || !b) {
    return (
      <Card style={{ borderLeft: `4px solid ${FT.red}` }}>
        <div role="alert" style={{ fontSize: 13, color: FT.text }}><strong>{s.file_name}</strong> — {s.detail ?? "Échec du traitement."}</div>
      </Card>
    );
  }
  const dup = b.duplicate_of != null;
  return (
    <Card style={{ borderLeft: `4px solid ${b.status === "FAILED" || (b.status === "REJECTED" && !dup) ? FT.red : dup ? FT.slate : FT.green}` }}>
      <div role="status" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13, color: FT.text }}>{b.file_name}</strong>
        <StatusPill status={b.status} />
        {dup && <Pill label={`Déjà reçu (lot n° ${b.duplicate_of}) : rien de réimporté`} tone="slate" />}
      </div>
      {!dup && (
        <div style={{ marginTop: 6, fontSize: 12, color: FT.textMid }}>
          {b.rows_total} ligne(s) lue(s) · {b.rows_accepted} acceptée(s) · {b.rows_warning} en alerte · {b.rows_pending} à valider · {b.rows_rejected} rejetée(s)
        </div>
      )}
      {b.status_message && <div style={{ marginTop: 4, fontSize: 11.5, color: FT.textSub }}>{b.status_message}</div>}
    </Card>
  );
}

export function ConfigurationSheet() {
  const qc = useQueryClient();
  const [access, setAccess] = useState<Stored | null>(() => readToken());
  const [last, setLast] = useState<ConfigUploadState | null>(null);

  // Expiration côté client : on revient à l'écran du code sans attendre une erreur serveur.
  useEffect(() => {
    if (!access) return;
    const t = window.setTimeout(() => { writeToken(null); setAccess(null); }, Math.max(0, access.exp - Date.now()));
    return () => window.clearTimeout(t);
  }, [access]);

  const lock = () => { writeToken(null); setAccess(null); setLast(null); };

  const filesQ = useQuery({
    queryKey: ["fuel-config-files", access?.token],
    queryFn: () => fetchConfigFiles(access!.token),
    enabled: !!access,
    retry: false,
  });
  const pollQ = useQuery({
    queryKey: ["fuel-config-upload", last?.ticket],
    queryFn: () => fetchConfigUploadState(access!.token, last!.ticket),
    enabled: !!access && last?.etat === "EN_COURS",
    refetchInterval: 3000,
    retry: false,
  });
  useEffect(() => {
    if (pollQ.data && pollQ.data.etat !== "EN_COURS") {
      setLast(pollQ.data);
      qc.invalidateQueries({ queryKey: ["fuel-config-files"] });
      qc.invalidateQueries({ queryKey: ["fuel-stock"] });
    }
  }, [pollQ.data, qc]);

  useEffect(() => {
    if ((filesQ.error as { response?: { status?: number } } | null)?.response?.status === 403) lock();
  }, [filesQ.error]);

  if (!access) {
    return (
      <CodeGate onGranted={(s) => { writeToken(s); setAccess(s); }} />
    );
  }

  const stockage = filesQ.data?.stockage;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <SheetTitle icon={<ShieldCheck size={17} />} title="Configuration" subtitle="Fichiers sources du module : Closing initial, mises à jour mensuelles, relevés gardiennage, target fuel, modèles de cuves." />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {stockage && (
              <Pill tone={stockage === "VOLUME_PLATEFORME" ? "blue" : "green"} label={stockage === "VOLUME_PLATEFORME" ? "Stockage : plateforme" : "Stockage : répertoire partagé"} />
            )}
            <button type="button" onClick={lock} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9, border: `1px solid ${FT.border}`, background: FT.slateL, color: FT.textMid, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
              <LogOut size={13} aria-hidden /> Verrouiller
            </button>
          </div>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: FT.textMid }}>
          Chaque fichier est archivé tel quel puis contrôlé ligne par ligne. Un fichier déjà reçu n'est pas réimporté. Les lignes non conformes restent visibles dans Suivi Stock → Imports, rien n'est complété ni inventé.
        </p>
      </Card>

      <UploadZone
        token={access.token}
        onExpired={lock}
        busyElsewhere={last?.etat === "EN_COURS"}
        onSent={(st) => { setLast(st); qc.invalidateQueries({ queryKey: ["fuel-config-files"] }); }}
      />

      {last && <ResultCard s={last} />}

      <Card padded={false}>
        <div style={{ padding: "14px 16px 8px", fontSize: 13.5, fontWeight: 900, color: FT.text }}>Derniers fichiers reçus</div>
        {filesQ.isLoading && <div style={{ padding: 16, fontSize: 12.5, color: FT.textSub }}>Chargement…</div>}
        {filesQ.isError && <div role="alert" style={{ padding: 16, fontSize: 12.5, color: FT.red }}>Liste indisponible : {apiError(filesQ.error).detail}</div>}
        {filesQ.data && filesQ.data.data.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: FT.textSub }}>Aucun fichier reçu pour l'instant.</div>}
        {filesQ.data && filesQ.data.data.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Reçu le</th>
                  <th style={thStyle}>Fichier</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Origine</th>
                  <th style={thStyle}>Statut</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Lignes</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Rejetées</th>
                  <th style={thStyle}>Par</th>
                </tr>
              </thead>
              <tbody>
                {filesQ.data.data.map((b) => (
                  <tr key={b.id}>
                    <td style={tdStyle}>{new Date(b.received_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td style={{ ...tdStyle, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.file_name}>{b.file_name}</td>
                    <td style={tdStyle}>{b.source_type}</td>
                    <td style={tdStyle}>{b.origin === "UPLOAD" ? "Configuration" : b.origin === "FOLDER" ? "Répertoire" : b.origin}</td>
                    <td style={tdStyle}><StatusPill status={b.status} />{b.duplicate_of != null && <span style={{ marginLeft: 6, fontSize: 11, color: FT.textSub }}>doublon</span>}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{b.rows_total}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: b.rows_rejected ? FT.red : undefined }}>{b.rows_rejected}</td>
                    <td style={tdStyle}>{b.received_by ?? "—"}</td>
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
