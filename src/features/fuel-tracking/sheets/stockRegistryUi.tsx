// src/features/fuel-tracking/sheets/stockRegistryUi.tsx
// Libellés, badges et boîte de dialogue « motif obligatoire » du registre de stock.

import { useState, type CSSProperties, type ReactNode } from "react";
import { Modal, Pill } from "../ui";
import { FT, type Tone } from "../theme";

export const SOURCE_LABEL: Record<string, string> = {
  ENOC: "ENOC",
  LOLIFORCE: "Loliforce",
  SCSS: "SCSS",
  SNOWFLAKE: "Snowflake (technique)",
  CLOSING: "Closing",
  HISTORICAL_REFUELING: "Historique refueling",
};

export const METHOD_LABEL: Record<string, string> = {
  DIRECT_LITERS: "Relevé direct (L)",
  TANK_CURVE: "Abaque cuve",
  GEOMETRIC_CALCULATION: "Calcul géométrique",
  NONE: "Aucune",
};

export const CONVERSION_LABEL: Record<string, { label: string; tone: Tone }> = {
  VALID: { label: "Conversion valide", tone: "green" },
  PENDING_TANK_MAPPING: { label: "Cuve à référencer", tone: "orange" },
  INVALID: { label: "Invalide", tone: "red" },
};

export const VALIDATION_LABEL: Record<string, { label: string; tone: Tone }> = {
  VALIDATED: { label: "Validé", tone: "green" },
  PENDING: { label: "À valider", tone: "orange" },
  REJECTED: { label: "Rejeté", tone: "red" },
  DECLARED: { label: "Déclaré", tone: "slate" },
  CLOSED: { label: "Clôturé source", tone: "blue" },
  ACCEPTED: { label: "Accepté", tone: "green" },
  WARNING: { label: "Alerte", tone: "orange" },
  RECEIVED: { label: "Reçu", tone: "slate" },
  PROCESSING: { label: "En traitement", tone: "blue" },
  VALIDATION_REQUIRED: { label: "Validation requise", tone: "orange" },
  FAILED: { label: "Échec technique", tone: "red" },
};

export const STATUT_LABEL: Record<string, { label: string; tone: Tone }> = {
  RETENU: { label: "Stock retenu", tone: "green" },
  INDISPONIBLE: { label: "Indisponible", tone: "orange" },
  AUCUNE_DONNEE: { label: "Aucune donnée", tone: "slate" },
};

export const MOVEMENT_LABEL: Record<string, string> = {
  DELIVERY_EYDON: "Livraison Eydon",
  DELIVERY_TOTAL_CARD: "Livraison carte Total",
  ADD: "Appoint",
  TRANSFER_IN: "Transfert entrant",
  TRANSFER_OUT: "Transfert sortant",
  WITHDRAWAL: "Retrait",
  THEFT: "Vol",
  DRAIN: "Vidange",
  CORRECTION: "Correction",
};

export const SHAPE_LABEL: Record<string, string> = {
  HORIZONTAL_CYLINDER: "Cylindre horizontal",
  VERTICAL_CYLINDER: "Cylindre vertical",
  RECTANGULAR: "Parallélépipède",
  HORIZONTAL_ELLIPTICAL: "Elliptique horizontal",
  CUSTOM_CURVE: "Abaque",
};

const ALERT_TONE: Record<string, Tone> = {
  STOCK_CONFLICT: "red",
  LOW_STOCK_CRITICAL: "red",
  LOW_STOCK: "orange",
  STALE: "orange",
  PENDING_VALIDATION: "orange",
  MULTI_TANK_WITHOUT_ID: "orange",
  TANK_PENDING: "violet",
  TANK_NOT_REFERENCED: "slate",
  GUARD_NOT_CONFIGURED: "slate",
  NOT_RETAINED: "slate",
  NO_DATA: "slate",
};

export function StatusPill({ status, map = VALIDATION_LABEL }: { status: string | null | undefined; map?: Record<string, { label: string; tone: Tone }> }) {
  if (!status) return <Dash />;
  const s = map[status] ?? { label: status, tone: "slate" as Tone };
  return <Pill label={s.label} tone={s.tone} />;
}

export function AlertPills({ alerts, labels }: { alerts: string[]; labels: Record<string, string> }) {
  if (!alerts.length) return <span style={{ color: FT.green, fontSize: 11.5, fontWeight: 700 }}>Aucune</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
      {alerts.map((a) => (
        <Pill key={a} label={labels[a] ?? a} tone={ALERT_TONE[a] ?? "slate"} />
      ))}
    </div>
  );
}

export function Dash({ reason }: { reason?: string | null }) {
  return (
    <span style={{ color: FT.textSub, cursor: reason ? "help" : undefined }} title={reason ?? undefined} aria-label={reason ?? "non renseigné"}>
      —
    </span>
  );
}

export function Num({ value, unit, digits = 0, reason }: { value: number | null | undefined; unit?: string; digits?: number; reason?: string | null }) {
  if (value === null || value === undefined) return <Dash reason={reason} />;
  return (
    <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>
      {value.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

export function fmtDateTime(v: string | null | undefined, withTime = false) {
  if (!v) return null;
  const d = new Date(v);
  return withTime
    ? d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR");
}

export function ageLabel(hours: number | null | undefined) {
  if (hours === null || hours === undefined) return null;
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.floor(hours / 24)} j`;
}

export const thStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: FT.slateL,
  color: FT.text,
  fontSize: 10.5,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  textAlign: "center",
  padding: "9px 10px",
  borderBottom: `1px solid ${FT.borderStrong}`,
  whiteSpace: "nowrap",
};

export const tdStyle: CSSProperties = {
  padding: "8px 10px",
  borderBottom: `1px solid ${FT.border}`,
  fontSize: 12.5,
  textAlign: "center",
  whiteSpace: "nowrap",
};

export function actionBtn(tone: Tone = "blue", disabled = false): CSSProperties {
  const color = { blue: FT.blue, green: FT.green, red: FT.red, orange: FT.orange, violet: FT.violet, slate: FT.slate, cyan: FT.cyan, gold: FT.gold }[tone];
  return {
    border: `1px solid ${disabled ? FT.border : color}`,
    background: disabled ? FT.slateL : "#fff",
    color: disabled ? FT.textSub : color,
    borderRadius: 7,
    padding: "4px 9px",
    fontSize: 11.5,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
  };
}

export const inputStyle: CSSProperties = {
  height: 32,
  borderRadius: 8,
  border: `1px solid ${FT.border}`,
  background: "#fff",
  color: FT.text,
  padding: "0 9px",
  fontSize: 12.5,
  outline: "none",
};

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 700, color: FT.textMid }}>
      {label}
      {children}
    </label>
  );
}

/** Dialogue « motif obligatoire » : toute validation, tout rejet et toute correction sont tracés avec un motif. */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  tone = "blue",
  onConfirm,
  onClose,
}: {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  tone?: Tone;
  onConfirm: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!reason.trim()) {
      setError("Le motif est obligatoire (piste d'audit).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Action impossible.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose} maxWidth={460}>
      {description && <div style={{ fontSize: 12.5, color: FT.textMid, marginBottom: 12, lineHeight: 1.5 }}>{description}</div>}
      <Field label="Motif (obligatoire)">
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          style={{ ...inputStyle, height: "auto", padding: 8, resize: "vertical" }}
        />
      </Field>
      {error && (
        <div role="alert" style={{ color: FT.red, fontSize: 12, marginTop: 8 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onClose} style={actionBtn("slate")}>
          Annuler
        </button>
        <button type="button" onClick={submit} disabled={busy} style={actionBtn(tone, busy)}>
          {busy ? "…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
