// src/features/fuel-tracking/sheets/cphBadges.tsx
// Badges de traçabilité CPH, partagés par « Suivis Consommations » et « Contrôle CPH ».
// Deux familles DISTINCTES : la correspondance plaque → courbe, et la qualité / origine
// de la courbe. Une correspondance automatique ne change jamais la qualité de la courbe.

import type { CphConsoStatus, CphCorrespondance, CphMatchStatus } from "@/services/fuelTracking";
import { FT } from "../theme";

export const MATCH_LABELS: Record<CphMatchStatus, string> = {
  AUTO_VALIDE_COMPATIBLE: "Correspondance unique et compatible (score ≥ 70 %), activée automatiquement",
  VALIDE_MANUELLEMENT: "Correspondance choisie par un validateur",
  A_VALIDER: "Candidat unique mais incompatible ou score insuffisant : validation requise",
  COURBE_CPH_MANQUANTE: "Aucune courbe CPH pour ce type de GE dans l'abaque",
  MODELE_AMBIGU: "Plusieurs courbes candidates comparables : choix manuel requis",
  SITE_MULTI_GE: "Site multi-GE : une courbe par GE n'est pas encore gérée",
  GE_INCONNU: "Type de GE absent de la Base GE",
};

const MATCH_TONES: Record<CphMatchStatus, string> = {
  AUTO_VALIDE_COMPATIBLE: FT.green,
  VALIDE_MANUELLEMENT: FT.blue,
  A_VALIDER: FT.orange,
  COURBE_CPH_MANQUANTE: FT.red,
  MODELE_AMBIGU: FT.violet,
  SITE_MULTI_GE: FT.slate,
  GE_INCONNU: FT.slate,
};

export const CURVE_STATUS_SHORT: Record<string, string> = {
  "VALIDÉ_CONSTRUCTEUR": "VALIDÉ_CONSTRUCTEUR",
  HISTORIQUE_A_VALIDER: "HISTORIQUE_A_VALIDER",
  FICHE_ARCHIVEE_A_VALIDER: "ARCHIVÉ",
  FICHE_DISTRIBUTEUR_A_VALIDER: "DISTRIBUTEUR",
};

const CURVE_STATUS_HELP: Record<string, string> = {
  "VALIDÉ_CONSTRUCTEUR": "Courbe issue d'une fiche constructeur validée",
  HISTORIQUE_A_VALIDER: "Courbe historique (base ESCO), à confirmer par fiche constructeur",
  FICHE_ARCHIVEE_A_VALIDER: "Fiche constructeur archivée, à confirmer",
  FICHE_DISTRIBUTEUR_A_VALIDER: "Fiche distributeur, à confirmer",
};

function Badge({ text, tone, title }: { text: string; tone: string; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: ".02em", color: tone,
        background: `${tone}14`, border: `1px solid ${tone}40`, borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export function MatchBadge({ statut, title }: { statut: CphMatchStatus | string | null | undefined; title?: string }) {
  if (!statut) return <span style={{ color: FT.textSub }}>—</span>;
  const s = statut as CphMatchStatus;
  return <Badge text={s} tone={MATCH_TONES[s] ?? FT.slate} title={title ?? MATCH_LABELS[s]} />;
}

export function CurveStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const tone = status === "VALIDÉ_CONSTRUCTEUR" ? FT.green : FT.slate;
  return <Badge text={CURVE_STATUS_SHORT[status] ?? status} tone={tone} title={`Qualité de la courbe : ${CURVE_STATUS_HELP[status] ?? status}`} />;
}

/** Correspondance + courbe : deux badges distincts, score et méthode en infobulle. */
export function CorrespondanceCell({ c, fallbackCurveId }: { c: CphCorrespondance | null | undefined; fallbackCurveId?: string | null }) {
  if (!c) return <span style={{ color: FT.textSub }}>—</span>;
  const tip = [
    MATCH_LABELS[c.statut],
    c.score !== null && c.score !== undefined ? `score ${c.score} %` : null,
    c.methode ? `méthode ${c.methode}` : null,
    c.valide_par ? `par ${c.valide_par}` : null,
    c.date ? `le ${new Date(c.date).toLocaleDateString("fr-FR")}` : null,
    c.motif,
  ].filter(Boolean).join(" · ");
  const curveId = c.courbe_id ?? fallbackCurveId;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
      <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
        <MatchBadge statut={c.statut} title={tip} />
        {c.score !== null && c.score !== undefined && <span style={{ fontSize: 10.5, color: FT.textSub }}>{c.score} %</span>}
      </span>
      {curveId && (
        <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontFamily: "ui-monospace, Menlo, monospace", color: FT.textMid }}>{curveId}</span>
          <CurveStatusBadge status={c.courbe_statut} />
        </span>
      )}
    </div>
  );
}

export const CONSO_STATUS_LABELS: Record<CphConsoStatus, string> = {
  CONSO_ESTIMEE_NON_CALCULEE: "Conso estimée non calculée",
  MESURE_ABSENTE: "Mesure absente",
  COHERENT: "Cohérent",
  ECART_A_JUSTIFIER: "Écart à justifier",
  ECART_A_INVESTIGUER: "Écart à investiguer",
};

export const CONSO_STATUS_COLORS: Record<CphConsoStatus, string> = {
  CONSO_ESTIMEE_NON_CALCULEE: FT.violet,
  MESURE_ABSENTE: FT.slate,
  COHERENT: FT.green,
  ECART_A_JUSTIFIER: FT.orange,
  ECART_A_INVESTIGUER: FT.red,
};

export function ConsoStatusBadge({ statut }: { statut: CphConsoStatus }) {
  const color = CONSO_STATUS_COLORS[statut] ?? FT.slate;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, color, background: `${color}1f`, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>
      {CONSO_STATUS_LABELS[statut] ?? statut}
    </span>
  );
}
