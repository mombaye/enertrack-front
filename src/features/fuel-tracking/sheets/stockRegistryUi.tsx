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
  CLOSING: "Closing mensuel",
  HISTORICAL_REFUELING: "Historique refueling",
  TANK_MODELS: "Modèles de cuves (calculateur)",
  MANUAL: "Saisie manuelle",
};

/** Libellés des fichiers d'import (le Closing n'est PAS un référentiel de cuves). */
export const IMPORT_SOURCE_LABEL: Record<string, string> = {
  CLOSING: "Closing mensuel — stocks et mouvements de période",
  LOLIFORCE: "Loliforce — relevés de stock terrain",
  SCSS: "SCSS — relevés de stock terrain",
  HISTORICAL_REFUELING: "Historique refueling — source historique",
  TANK_MODELS: "Modèles de cuves — calculateur et conversion cm vers litres",
  ENOC: "ENOC (lu par eGrid)",
};

export const METHOD_LABEL: Record<string, string> = {
  DIRECT_LITERS: "Relevé direct (L)",
  TANK_CURVE: "Abaque cuve",
  GEOMETRIC_CALCULATION: "Volume géométrique",
  CALIBRATED: "Volume calibré (plaque)",
  NONE: "Aucune",
};

export const CONVERSION_LABEL: Record<string, { label: string; tone: Tone }> = {
  VALID: { label: "Conversion valide", tone: "green" },
  GEOMETRIC_ONLY: { label: "Géométrique seul (plaque à confirmer)", tone: "orange" },
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
  NON_EXPLOITABLE: { label: "Non exploitable", tone: "slate" },
  // Statuts affichés d'un relevé
  AUTO_VALIDE: { label: "Auto-validé", tone: "green" },
  VALIDE_MANUELLEMENT: { label: "Validé manuellement", tone: "blue" },
  A_TRAITER: { label: "À traiter", tone: "orange" },
  REJETE: { label: "Rejeté", tone: "red" },
  // Statuts d'affectation d'une cuve site
  VALIDEE: { label: "Cuve validée", tone: "green" },
  PROPOSEE: { label: "Cuve proposée", tone: "violet" },
  A_CONFIRMER: { label: "Cuve à confirmer", tone: "orange" },
  INCOMPLETE: { label: "Cuve incomplète", tone: "slate" },
  PLUSIEURS_CUVES_A_IDENTIFIER: { label: "Plusieurs cuves à identifier", tone: "orange" },
  REJETEE: { label: "Cuve rejetée", tone: "red" },
  // Modèles de la bibliothèque
  COMPLET: { label: "Modèle complet", tone: "green" },
  INCOMPLET: { label: "Modèle incomplet", tone: "slate" },
  PROPOSED: { label: "Modèle proposé", tone: "violet" },
  CONFIRMED: { label: "Modèle confirmé", tone: "green" },
};

export const STATUT_LABEL: Record<string, { label: string; tone: Tone }> = {
  RETENU: { label: "Stock retenu", tone: "green" },
  INDISPONIBLE: { label: "Indisponible", tone: "orange" },
  AUCUNE_DONNEE: { label: "Aucune donnée", tone: "slate" },
};

export const MOVEMENT_LABEL: Record<string, string> = {
  DELIVERY: "Livraison confirmée",
  DELIVERY_EYDON: "Livraison Eydon",
  DELIVERY_TOTAL_CARD: "Carte Total (contrôle)",
  ADD: "Appoint",
  TRANSFER_IN: "Transfert entrant",
  TRANSFER_OUT: "Transfert sortant",
  TRANSFERT_INTERSITE_SORTANT: "Ponction sortante (transfert inter-sites)",
  TRANSFERT_INTERSITE_ENTRANT: "Ponction entrante (transfert inter-sites)",
  TRANSFERT_INTERSITE: "Transfert inter-sites",
  WITHDRAWAL: "Retrait",
  THEFT: "Vol",
  DRAIN: "Vidange",
  CORRECTION: "Correction",
};

export const CATEGORY_LABEL: Record<string, string> = {
  RELEVE_STOCK: "Relevé de stock",
  LIVRAISON_CONFIRMEE: "Livraison confirmée",
  DEMANDE_LIVRAISON: "Demande de livraison",
  AJOUT: "Ajout",
  TRANSFERT_ENTRANT: "Transfert entrant",
  TRANSFERT_SORTANT: "Transfert sortant",
  RETRAIT: "Retrait",
  VOL: "Vol",
  VIDANGE: "Vidange",
  CARTE_TOTAL: "Carte Total (contrôle)",
  LIVRAISON_DECLAREE: "Livraison déclarée (à rapprocher)",
  INCONNU: "Inconnu",
};

export const FAMILY_LABEL: Record<string, string> = {
  "h-circ": "Horizontale circulaire",
  "h-elli": "Horizontale elliptique",
  "h-oblo": "Horizontale oblongue",
  "v-cyl": "Verticale cylindrique",
  "v-tronc": "Verticale tronconique",
  rect: "Rectangulaire",
};

/** Cotes attendues par famille (calculateur universel) : libellé ou null si non utilisée. */
export const FAMILY_DIMS: Record<string, [string | null, string | null, string | null]> = {
  "h-circ": ["D · diamètre intérieur", null, "L · longueur de virole"],
  "h-elli": ["W · largeur", "H · hauteur", "L · longueur de virole"],
  "h-oblo": ["W · largeur", "H · hauteur", "L · longueur de virole"],
  "v-cyl": ["D · diamètre", "Hv · hauteur de virole", null],
  "v-tronc": ["D1 · diamètre au fond", "D2 · diamètre au sommet", "H · hauteur"],
  rect: ["A · largeur", "B · hauteur", "L · longueur"],
};

export const PROFILE_LABEL: Record<string, string> = {
  plat: "Plat",
  ellip: "Bombé ellipsoïdal",
  toris: "Bombé torisphérique",
  cap: "Calotte sphérique",
  hemi: "Hémisphérique",
  cone: "Conique",
  klop: "Klöpper",
  korb: "Korbbogen",
};

export const SHAPE_LABEL: Record<string, string> = {
  HORIZONTAL_CYLINDER: "Cylindre horizontal",
  VERTICAL_CYLINDER: "Cylindre vertical",
  RECTANGULAR: "Parallélépipède",
  HORIZONTAL_ELLIPTICAL: "Elliptique horizontal",
  CUSTOM_CURVE: "Abaque",
};

const ALERT_TONE: Record<string, Tone> = {
  TANK_INCOMPLETE: "slate",
  PLATE_MISSING: "orange",
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
