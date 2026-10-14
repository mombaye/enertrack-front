// src/features/fuel-tracking/sheets/StockSiteHistory.tsx
// Panneau historique d'un site du registre de stock : relevés, mouvements, comparaisons
// Loliforce / SCSS, cuves (correction / validation tracée), gardiennage, corrections.

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createGuardScope,
  createStockTank,
  decideStockMovement,
  decideStockObservation,
  getStockSiteHistory,
  patchStockTank,
  type StockSiteHistory as StockSiteHistoryData,
  type StockTank,
  type TankShape,
} from "@/services/fuelTracking";
import { EmptyState, Modal, SegmentedTabs, Skeleton } from "../ui";
import { FT } from "../theme";
import {
  actionBtn,
  ageLabel,
  CONVERSION_LABEL,
  Dash,
  Field,
  fmtDateTime,
  inputStyle,
  METHOD_LABEL,
  MOVEMENT_LABEL,
  Num,
  ReasonDialog,
  SHAPE_LABEL,
  SOURCE_LABEL,
  StatusPill,
  tdStyle,
  thStyle,
} from "./stockRegistryUi";

type Tab = "RELEVES" | "MOUVEMENTS" | "COMPARAISONS" | "CUVES" | "CORRECTIONS";

type Pending = { kind: "obs" | "mv"; id: number; decision: "valider" | "rejeter"; label: string } | null;

export function StockSiteHistory({ siteId, initialTab = "RELEVES", onClose }: { siteId: string; initialTab?: Tab; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pending, setPending] = useState<Pending>(null);
  const q = useQuery({ queryKey: ["stock-registry-site", siteId], queryFn: () => getStockSiteHistory(siteId) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock-registry-site", siteId] });
    qc.invalidateQueries({ queryKey: ["stock-registry"] });
  };
  const d = q.data;
  const can = !!d?.can_validate;

  return (
    <Modal title={`Historique stock — ${siteId}${d?.site?.name ? ` · ${d.site.name}` : ""}`} onClose={onClose} maxWidth={1180}>
      {q.isLoading && <Skeleton h={320} />}
      {q.isError && (
        <div role="alert" style={{ color: FT.red, fontSize: 13 }}>
          Historique indisponible (erreur de chargement).
        </div>
      )}
      {d && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <RetainedSummary d={d} />
          <SegmentedTabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { key: "RELEVES", label: `Relevés (${d.observations.length})` },
              { key: "MOUVEMENTS", label: `Mouvements (${d.mouvements.length})` },
              { key: "COMPARAISONS", label: `Comparaisons (${d.comparaisons.length})` },
              { key: "CUVES", label: `Cuves & gardiennage (${d.cuves.length})` },
              { key: "CORRECTIONS", label: `Corrections (${d.corrections.length})` },
            ]}
          />

          {tab === "RELEVES" && (
            <Table
              empty="Aucun relevé pour ce site."
              head={["Date", "Source", "Cuve", "Niveau brut", "Litres", "Méthode", "Conversion", "Statut", "Motif / contrôles", "Saisi par", "Preuve", "Actions"]}
              rows={d.observations.map((o) => [
                fmtDateTime(o.observation_datetime, o.source_type === "ENOC") ?? <Dash />,
                SOURCE_LABEL[o.source_type] ?? o.source_type,
                o.tank_id ?? <Dash reason="Cuve non précisée" />,
                o.level_raw ? `${o.level_raw}${o.level_unit && !/[a-z]/i.test(o.level_raw) ? ` ${o.level_unit === "CM" ? "cm" : "L"}` : ""}` : <Dash />,
                <Num value={o.level_liters} reason={o.conversion_message} />,
                METHOD_LABEL[o.conversion_method] ?? o.conversion_method,
                <StatusPill status={o.conversion_status} map={CONVERSION_LABEL} />,
                <StatusPill status={o.validation_status} />,
                <Wrap>{[o.validation_reason, o.conversion_message].filter(Boolean).join(" · ") || "—"}</Wrap>,
                o.validated_by ? `${o.source_user ?? "—"} (validé par ${o.validated_by})` : o.source_user ?? <Dash />,
                o.proof_reference ? <ProofLink value={o.proof_reference} /> : <Dash reason="Aucune preuve" />,
                can ? (
                  <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                    <button
                      type="button"
                      disabled={o.validation_status === "VALIDATED" || o.level_liters === null}
                      title={o.level_liters === null ? "Relevé non converti en litres : référencer / valider la cuve d'abord." : undefined}
                      onClick={() => setPending({ kind: "obs", id: o.id, decision: "valider", label: `relevé #${o.id}` })}
                      style={actionBtn("green", o.validation_status === "VALIDATED" || o.level_liters === null)}
                    >
                      Valider
                    </button>
                    <button
                      type="button"
                      disabled={o.validation_status === "REJECTED"}
                      onClick={() => setPending({ kind: "obs", id: o.id, decision: "rejeter", label: `relevé #${o.id}` })}
                      style={actionBtn("red", o.validation_status === "REJECTED")}
                    >
                      Rejeter
                    </button>
                  </div>
                ) : <Dash reason="Réservé aux rôles admin et manager" />,
              ])}
            />
          )}

          {tab === "MOUVEMENTS" && (
            <Table
              empty="Aucun mouvement pour ce site."
              head={["Date", "Source", "Type", "Qté demandée", "Qté réalisée", "Fournisseur", "Ticket / bon", "Preuve", "Niveaux avant → après", "Statut", "Alertes", "Actions"]}
              rows={d.mouvements.map((m) => [
                fmtDateTime(m.movement_datetime) ?? <Dash />,
                SOURCE_LABEL[m.source_type] ?? m.source_type,
                m.movement_type ? MOVEMENT_LABEL[m.movement_type] ?? m.movement_type : <Dash reason="Type non déterminé" />,
                <Num value={m.requested_quantity_l} unit="L" />,
                <Num value={m.quantity_l} unit="L" reason="Quantité réalisée non déclarée" />,
                m.supplier ?? <Dash />,
                [m.ticket_reference, m.delivery_note].filter(Boolean).join(" / ") || <Dash reason="Sans ticket ni bon" />,
                m.proof_reference ? <ProofLink value={m.proof_reference} /> : <Dash reason="Aucune preuve" />,
                `${m.level_before_raw ?? "—"} → ${m.level_after_raw ?? "—"}`,
                <StatusPill status={m.status} />,
                <Wrap>{m.alerts.map((a) => a.message).join(" · ") || "—"}</Wrap>,
                can ? (
                  <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                    <button
                      type="button"
                      disabled={m.status === "VALIDATED" || m.quantity_l === null || !m.movement_type}
                      title={m.quantity_l === null ? "Quantité réalisée inconnue : validation impossible." : undefined}
                      onClick={() => setPending({ kind: "mv", id: m.id, decision: "valider", label: `mouvement #${m.id}` })}
                      style={actionBtn("green", m.status === "VALIDATED" || m.quantity_l === null || !m.movement_type)}
                    >
                      Valider
                    </button>
                    <button
                      type="button"
                      disabled={m.status === "REJECTED"}
                      onClick={() => setPending({ kind: "mv", id: m.id, decision: "rejeter", label: `mouvement #${m.id}` })}
                      style={actionBtn("red", m.status === "REJECTED")}
                    >
                      Rejeter
                    </button>
                  </div>
                ) : <Dash reason="Réservé aux rôles admin et manager" />,
              ])}
            />
          )}

          {tab === "COMPARAISONS" && (
            <>
              <Note>
                Loliforce / SCSS : même site et même cuve, deux relevés en litres à moins de 48 h, capacité validée. Écart ≤ max(100 L, 10 % de la capacité)
                → cohérent ; sinon conflit : les deux relevés repassent « à valider ». Aucune moyenne, aucun choix automatique.
              </Note>
              <Table
                empty="Aucune paire Loliforce / SCSS à moins de 48 h pour ce site."
                head={["Cuve", "Loliforce", "SCSS", "Écart", "Tolérance", "Résultat", "Motif"]}
                rows={d.comparaisons.map((c) => [
                  c.tank_id ?? <Dash />,
                  <>{fmtDateTime(c.loliforce.datetime) ?? "—"} · <Num value={c.loliforce.level_l} unit="L" /></>,
                  <>{fmtDateTime(c.scss.datetime) ?? "—"} · <Num value={c.scss.level_l} unit="L" /></>,
                  <Num value={c.ecart_l} unit="L" />,
                  <Num value={c.tolerance_l} unit="L" />,
                  <StatusPill
                    status={c.status}
                    map={{ COHERENT: { label: "Cohérent", tone: "green" }, STOCK_CONFLICT: { label: "Conflit", tone: "red" }, NOT_COMPARABLE: { label: "Non comparable", tone: "slate" } }}
                  />,
                  <Wrap>{c.reason ?? "—"}</Wrap>,
                ])}
              />
            </>
          )}

          {tab === "CUVES" && <TanksPanel siteId={d.site.site_id} tanks={d.cuves} scopes={d.gardiennage} can={can} onChanged={refresh} />}

          {tab === "CORRECTIONS" && (
            <Table
              empty="Aucune correction tracée."
              head={["Date", "Objet", "Action", "Champ", "Ancienne valeur", "Nouvelle valeur", "Motif", "Auteur"]}
              rows={d.corrections.map((c) => [
                fmtDateTime(c.created_at, true) ?? "—",
                `${c.entity} #${c.entity_id}`,
                c.action,
                c.field ?? "—",
                <Wrap>{c.old_value ?? "∅"}</Wrap>,
                <Wrap>{c.new_value ?? "∅"}</Wrap>,
                <Wrap>{c.reason}</Wrap>,
                c.author ?? "—",
              ])}
            />
          )}
        </div>
      )}

      {pending && (
        <ReasonDialog
          title={`${pending.decision === "valider" ? "Valider" : "Rejeter"} le ${pending.label}`}
          confirmLabel={pending.decision === "valider" ? "Valider" : "Rejeter"}
          tone={pending.decision === "valider" ? "green" : "red"}
          onClose={() => setPending(null)}
          onConfirm={async (reason) => {
            if (pending.kind === "obs") await decideStockObservation(pending.id, pending.decision, reason);
            else await decideStockMovement(pending.id, pending.decision, reason);
            refresh();
          }}
        />
      )}
    </Modal>
  );
}

function RetainedSummary({ d }: { d: StockSiteHistoryData }) {
  const r = d.retenu;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
      <Info label="Stock retenu">
        {r?.stock_l !== null && r?.stock_l !== undefined ? <Num value={r.stock_l} unit="L" /> : <span style={{ color: FT.orange, fontWeight: 700 }}>Indisponible</span>}
      </Info>
      <Info label="Source · date">{r?.source_type ? `${SOURCE_LABEL[r.source_type]} · ${fmtDateTime(r.observation_datetime) ?? "—"} (${ageLabel(r.age_hours) ?? "—"})` : "—"}</Info>
      <Info label="Méthode">{r?.conversion_method ? METHOD_LABEL[r.conversion_method] : "—"}</Info>
      <Info label="Capacité · remplissage">
        {r?.capacity_l ? `${r.capacity_l.toLocaleString("fr-FR")} L · ${r.fill_pct ?? "—"} %` : "Capacité non validée"}
      </Info>
      <Info label="Snowflake (technique)">
        {d.snowflake_technique?.stock_l !== null && d.snowflake_technique?.stock_l !== undefined
          ? `${d.snowflake_technique.stock_l.toLocaleString("fr-FR")} L · ${fmtDateTime(d.snowflake_technique.date) ?? "—"}`
          : "—"}
        <div style={{ fontSize: 10.5, color: FT.textSub, fontWeight: 500 }}>Jamais retenu comme stock</div>
      </Info>
      {r?.unavailable_reason && (
        <div style={{ gridColumn: "1 / -1", fontSize: 12, color: FT.orange, background: FT.orangeL, borderRadius: 8, padding: "8px 10px" }}>
          {r.unavailable_reason}
        </div>
      )}
    </div>
  );
}

function TanksPanel({
  siteId,
  tanks,
  scopes,
  can,
  onChanged,
}: {
  siteId: string;
  tanks: StockTank[];
  scopes: Array<{ id: number; provider: string; active_from: string; active_to: string | null; comment: string | null }>;
  can: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<StockTank | "new" | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Note>
        Conversion cm → L uniquement avec une cuve <b>validée</b> : abaque validé, sinon géométrie (dimensions validées). Aucun coefficient générique.
        Toute correction est tracée et reconvertit les relevés du site.
      </Note>
      <Table
        empty="Aucune cuve référencée pour ce site : les relevés en cm ne peuvent pas être convertis."
        head={["Cuve", "Forme", "L × l × H / Ø (m)", "Capacité", "Capacité géométrique", "Hauteur physique", "Source", "Statut", "Commentaire", "Actions"]}
        rows={tanks.map((t) => [
          t.tank_id,
          t.shape ? SHAPE_LABEL[t.shape] : <Dash reason="Forme manquante" />,
          [t.length_m, t.width_m, t.height_m].map((v) => v ?? "—").join(" × ") + (t.diameter_m ? ` / Ø ${t.diameter_m}` : ""),
          <Num value={t.capacity_l} unit="L" />,
          <Num value={t.geometric_capacity_l} unit="L" reason="Dimensions incomplètes" />,
          <Num value={t.physical_height_cm} unit="cm" />,
          t.source_type,
          <StatusPill status={t.validation_status} />,
          <Wrap>{t.comment ?? "—"}</Wrap>,
          can ? (
            <button type="button" onClick={() => setEditing(t)} style={actionBtn("violet")}>
              Corriger / valider
            </button>
          ) : <Dash reason="Réservé aux rôles admin et manager" />,
        ])}
      />
      {can && (
        <div>
          <button type="button" onClick={() => setEditing("new")} style={actionBtn("blue")}>
            + Ajouter une cuve
          </button>
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 800, color: FT.text, marginTop: 6 }}>Périmètre de gardiennage</div>
      <Table
        empty="Périmètre non configuré : les relevés Loliforce / SCSS de ce site restent « à valider » (aucun site n'est supposé Loliforce par défaut)."
        head={["Prestataire", "Du", "Au", "Commentaire"]}
        rows={scopes.map((s) => [s.provider, fmtDateTime(s.active_from) ?? "—", fmtDateTime(s.active_to) ?? "en cours", s.comment ?? "—"])}
      />
      {can && (
        <div>
          <button type="button" onClick={() => setScopeOpen(true)} style={actionBtn("blue")}>
            + Affecter un prestataire
          </button>
        </div>
      )}

      {editing && <TankEditor siteId={siteId} tank={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={onChanged} />}
      {scopeOpen && <ScopeEditor siteId={siteId} onClose={() => setScopeOpen(false)} onSaved={onChanged} />}
    </div>
  );
}

function numOrNull(v: string) {
  const s = v.trim().replace(",", ".");
  return s === "" ? null : Number(s);
}

function TankEditor({ siteId, tank, onClose, onSaved }: { siteId: string; tank: StockTank | null; onClose: () => void; onSaved: () => void }) {
  const [tankId, setTankId] = useState(tank?.tank_id ?? "");
  const [shape, setShape] = useState<TankShape | "">(tank?.shape ?? "");
  const [dims, setDims] = useState({
    length_m: tank?.length_m?.toString() ?? "",
    width_m: tank?.width_m?.toString() ?? "",
    height_m: tank?.height_m?.toString() ?? "",
    diameter_m: tank?.diameter_m?.toString() ?? "",
    capacity_l: tank?.capacity_l?.toString() ?? "",
  });
  const [comment, setComment] = useState(tank?.comment ?? "");
  const [validate, setValidate] = useState<"" | "true" | "false">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error("Le motif est obligatoire.");
      const body = {
        shape: (shape || null) as TankShape | null,
        length_m: numOrNull(dims.length_m),
        width_m: numOrNull(dims.width_m),
        height_m: numOrNull(dims.height_m),
        diameter_m: numOrNull(dims.diameter_m),
        capacity_l: numOrNull(dims.capacity_l),
        comment: comment || null,
        reason: reason.trim(),
        ...(validate ? { validate: validate === "true" } : {}),
      };
      if (tank) return patchStockTank(tank.id, body);
      if (!tankId.trim()) throw new Error("Identifiant de cuve obligatoire.");
      return createStockTank({ ...body, site_id: siteId, tank_id: tankId.trim() });
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? (e as Error).message ?? "Enregistrement impossible.");
    },
  });
  return (
    <Modal title={tank ? `Cuve ${tank.tank_id} — correction / validation` : "Nouvelle cuve"} onClose={onClose} maxWidth={560}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {!tank && (
          <Field label="Identifiant de cuve (1, 2…)">
            <input value={tankId} onChange={(e) => setTankId(e.target.value)} style={inputStyle} />
          </Field>
        )}
        <Field label="Forme">
          <select value={shape} onChange={(e) => setShape(e.target.value as TankShape)} style={inputStyle}>
            <option value="">—</option>
            {Object.entries(SHAPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        {(
          [
            ["length_m", "Longueur (m)"],
            ["width_m", "Largeur (m)"],
            ["height_m", "Hauteur (m)"],
            ["diameter_m", "Diamètre (m)"],
            ["capacity_l", "Capacité (L)"],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label}>
            <input inputMode="decimal" value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: e.target.value })} style={inputStyle} />
          </Field>
        ))}
        <Field label="Validation">
          <select value={validate} onChange={(e) => setValidate(e.target.value as "" | "true" | "false")} style={inputStyle}>
            <option value="">Inchangée ({tank?.validation_status ?? "à valider"})</option>
            <option value="true">Valider la cuve</option>
            <option value="false">Rejeter la cuve</option>
          </select>
        </Field>
      </div>
      <div style={{ marginTop: 10 }}>
        <Field label="Commentaire">
          <input value={comment} onChange={(e) => setComment(e.target.value)} style={inputStyle} />
        </Field>
      </div>
      <div style={{ marginTop: 10 }}>
        <Field label="Motif (obligatoire, tracé)">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ ...inputStyle, height: "auto", padding: 8 }} />
        </Field>
      </div>
      {error && (
        <div role="alert" style={{ color: FT.red, fontSize: 12, marginTop: 8 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onClose} style={actionBtn("slate")}>Annuler</button>
        <button type="button" onClick={() => { setError(null); m.mutate(); }} disabled={m.isPending} style={actionBtn("violet", m.isPending)}>
          {m.isPending ? "…" : "Enregistrer"}
        </button>
      </div>
    </Modal>
  );
}

function ScopeEditor({ siteId, onClose, onSaved }: { siteId: string; onClose: () => void; onSaved: () => void }) {
  const [provider, setProvider] = useState<"LOLIFORCE" | "SCSS">("LOLIFORCE");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  return (
    <ReasonDialog
      title={`Gardiennage — ${siteId}`}
      confirmLabel="Enregistrer"
      description={
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <Field label="Prestataire">
            <select value={provider} onChange={(e) => setProvider(e.target.value as "LOLIFORCE" | "SCSS")} style={inputStyle}>
              <option value="LOLIFORCE">Loliforce</option>
              <option value="SCSS">SCSS</option>
            </select>
          </Field>
          <Field label="Du">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Au (optionnel)">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          </Field>
        </div>
      }
      onClose={onClose}
      onConfirm={async (reason) => {
        await createGuardScope({ site_id: siteId, provider, active_from: from, active_to: to || undefined, reason });
        onSaved();
      }}
    />
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) {
  if (!rows.length) return <EmptyState icon={<span aria-hidden>∅</span>} title={empty} />;
  return (
    <div style={{ overflow: "auto", maxHeight: 420, borderRadius: 10, border: `1px solid ${FT.border}` }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 ? FT.cardAlt : "#fff" }}>
              {r.map((c, j) => (
                <td key={j} style={tdStyle}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Wrap({ children }: { children: ReactNode }) {
  return <div style={{ whiteSpace: "normal", minWidth: 180, maxWidth: 320, textAlign: "left", fontSize: 11.5, color: FT.textMid }}>{children}</div>;
}

function Note({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: FT.textMid, background: FT.blueL, borderRadius: 8, padding: "8px 11px", lineHeight: 1.5 }}>{children}</div>;
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ border: `1px solid ${FT.border}`, borderRadius: 9, padding: "9px 11px", background: FT.cardAlt }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: FT.text }}>{children}</div>
    </div>
  );
}

function ProofLink({ value }: { value: string }) {
  const first = value.split(",")[0].trim();
  if (/^https?:\/\//.test(first)) {
    return (
      <a href={first} target="_blank" rel="noreferrer" style={{ color: FT.blue, fontWeight: 700 }}>
        Voir
      </a>
    );
  }
  return <span title={value}>{value.length > 18 ? `${value.slice(0, 18)}…` : value}</span>;
}
