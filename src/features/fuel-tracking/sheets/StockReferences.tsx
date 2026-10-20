// src/features/fuel-tracking/sheets/StockReferences.tsx
// Référentiels du registre : bibliothèque des modèles de cuves (calculateur de Steve) et classification
// administrable / versionnée des types d'opération ENOC. Repliés par défaut.

import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getEnocTypes, getTankModels, setEnocType } from "@/services/fuelTracking";
import { Card, Skeleton } from "../ui";
import { FT } from "../theme";
import { actionBtn, CATEGORY_LABEL, FAMILY_LABEL, Field, inputStyle, Num, PROFILE_LABEL, ReasonDialog, StatusPill, tdStyle, thStyle } from "./stockRegistryUi";

export function Collapsible({ title, subtitle, children, defaultOpen = false }: { title: string; subtitle?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", width: "100%" }}
      >
        {open ? <ChevronDown size={18} color={FT.textMid} /> : <ChevronRight size={18} color={FT.textMid} />}
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: FT.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: FT.textSub, marginTop: 2 }}>{subtitle}</div>}
        </div>
      </button>
      {open && <div style={{ marginTop: 14 }}>{children}</div>}
    </Card>
  );
}

export function TankModelLibrary() {
  const q = useQuery({ queryKey: ["stock-tank-models"], queryFn: getTankModels });
  return (
    <Collapsible
      title="Bibliothèque des modèles de cuves"
      subtitle="Calculateur universel de Steve (onglet Tank DB) : modèles et formules seulement — un modèle n'est jamais une cuve installée sur un site."
    >
      {q.isLoading && <Skeleton h={120} />}
      {q.isError && <div role="alert" style={{ fontSize: 12.5, color: FT.red }}>Bibliothèque indisponible (serveur API à mettre à jour ou erreur de chargement).</div>}
      {q.data && q.data.data.length === 0 && (
        <div style={{ fontSize: 12.5, color: FT.textMid }}>Aucun modèle importé : déposer le calculateur dans incoming/modeles_cuves ou l'importer (type « Modèles de cuves »).</div>
      )}
      {q.data && q.data.data.length > 0 && (
        <div style={{ overflow: "auto", borderRadius: 10, border: `1px solid ${FT.border}` }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1200 }}>
            <thead>
              <tr>
                {["Modèle", "Libellé", "Famille", "Cotes (cm)", "Fond", "Plaque", "Volume géométrique plein", "k", "Écart", "Statut", "Motif", "Sites liés", "Source"].map((h) => (
                  <th key={h} scope="col" style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data.data.map((m, i) => (
                <tr key={m.tank_model_id} style={{ background: i % 2 ? FT.cardAlt : "#fff" }}>
                  <th scope="row" style={{ ...tdStyle, fontFamily: "ui-monospace, Menlo, monospace" }}>{m.tank_model_id}</th>
                  <td style={tdStyle}>{m.source_label ?? "—"}</td>
                  <td style={tdStyle}>{FAMILY_LABEL[m.shape_code ?? ""] ?? m.shape_code ?? "—"}</td>
                  <td style={tdStyle}>{[m.dimension_1_cm, m.dimension_2_cm, m.dimension_3_cm].map((v) => (v ? v.toLocaleString("fr-FR") : "—")).join(" × ")}</td>
                  <td style={tdStyle}>{PROFILE_LABEL[m.bottom_profile ?? ""] ?? "—"}{m.bottom_z_cm ? ` (Z ${m.bottom_z_cm} cm)` : ""}</td>
                  <td style={tdStyle}><Num value={m.nominal_capacity_l} unit="L" /></td>
                  <td style={tdStyle}><Num value={m.geometric_full_l} unit="L" digits={1} /></td>
                  <td style={tdStyle}>{m.calibration_k?.toFixed(4) ?? "—"}</td>
                  <td style={tdStyle}>{m.plate_gap_pct !== null ? `${m.plate_gap_pct > 0 ? "+" : ""}${m.plate_gap_pct.toLocaleString("fr-FR")} %` : "—"}</td>
                  <td style={tdStyle}><StatusPill status={m.model_status} /></td>
                  <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: 220, textAlign: "left", fontSize: 11.5 }}>{m.status_reason}</td>
                  <td style={tdStyle}>{m.sites}</td>
                  <td style={{ ...tdStyle, fontSize: 11 }}>{m.source_sheet} · ligne {m.source_row}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11.5, color: FT.textSub, padding: 8 }}>Moteur {q.data.version_moteur} — au-delà de 5 % d'écart entre géométrie et plaque, le modèle est « à confirmer » (cotes à reprendre sur site).</div>
        </div>
      )}
    </Collapsible>
  );
}

export function EnocTypeDialog({ rawValue, categories, onClose, onSaved }: {
  rawValue: string; categories: Array<{ key: string; label: string }>; onClose: () => void; onSaved: () => void;
}) {
  const [category, setCategory] = useState("INCONNU");
  return (
    <ReasonDialog
      title={`Classifier le type ENOC « ${rawValue} »`}
      confirmLabel="Enregistrer (nouvelle version)"
      description={
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>Une demande n'est jamais une livraison réelle ; une Carte Total validée avec quantité et date est intégrée au stock (qualité indiquée). La classification précédente est conservée en historique.</div>
          <Field label="Catégorie">
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
        </div>
      }
      onClose={onClose}
      onConfirm={async (reason) => {
        await setEnocType(rawValue, category, reason);
        onSaved();
      }}
    />
  );
}

export function EnocTypeConfig({ mapRequest, onMapDone }: { mapRequest: string | null; onMapDone: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["stock-enoc-types"], queryFn: getEnocTypes });
  const [editing, setEditing] = useState<string | null>(null);
  const target = editing ?? mapRequest;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock-enoc-types"] });
    qc.invalidateQueries({ queryKey: ["stock-queue-counters"] });
    qc.invalidateQueries({ queryKey: ["stock-queue"] });
    qc.invalidateQueries({ queryKey: ["stock-registry"] });
  };
  return (
    <>
      <Collapsible
        title="Classification des types d'opération ENOC"
        subtitle="Dictionnaire réel des valeurs ENOC (connecteur existant), classification administrable et versionnée. Un type non configuré reste « Inconnu » et n'est jamais un mouvement réel."
      >
        {q.isLoading && <Skeleton h={100} />}
        {q.isError && <div role="alert" style={{ fontSize: 12.5, color: FT.red }}>Classification indisponible (serveur API à mettre à jour ou erreur de chargement).</div>}
        {q.data && (
          <>
            <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 12, color: FT.textMid }}>
              {q.data.regles.map((r) => <li key={r}>{r}</li>)}
            </ul>
            {q.data.data.length === 0 ? (
              <div style={{ fontSize: 12.5, color: FT.textMid }}>Aucun mouvement ENOC synchronisé pour l'instant.</div>
            ) : (
              <div style={{ overflow: "auto", borderRadius: 10, border: `1px solid ${FT.border}` }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {["Valeur ENOC brute", "Occurrences", "Statuts ENOC", "Avec opération", "Classification", "Version", "Suggestion (non appliquée)", "Exemples", "Action"].map((h) => (
                        <th key={h} scope="col" style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.data.map((r, i) => (
                      <tr key={r.raw_value} style={{ background: i % 2 ? FT.cardAlt : "#fff" }}>
                        <th scope="row" style={{ ...tdStyle, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.raw_value}</th>
                        <td style={tdStyle}>{r.count}</td>
                        <td style={tdStyle}>{Object.entries(r.statuts).map(([k, v]) => `${k} : ${v}`).join(" · ") || "—"}</td>
                        <td style={tdStyle}>{r.avec_operation}</td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 800, color: r.configure ? FT.green : FT.orange }}>{CATEGORY_LABEL[r.categorie] ?? r.categorie}</span>
                        </td>
                        <td style={tdStyle}>{r.version ? `v${r.version}` : "—"}</td>
                        <td style={tdStyle}>{r.suggestion ? CATEGORY_LABEL[r.suggestion] ?? r.suggestion : "—"}</td>
                        <td style={{ ...tdStyle, fontSize: 11 }}>{r.exemples.join(", ")}</td>
                        <td style={tdStyle}>
                          {q.data.can_validate ? (
                            <button type="button" style={actionBtn("violet")} onClick={() => setEditing(r.raw_value)}>Classifier</button>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Collapsible>
      {target && q.data && (
        <EnocTypeDialog
          rawValue={target}
          categories={q.data.categories}
          onClose={() => { setEditing(null); onMapDone(); }}
          onSaved={refresh}
        />
      )}
    </>
  );
}
