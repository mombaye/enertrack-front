// src/features/fuel-tracking/sheets/MissingSitesBanner.tsx
// Sites connus du Suivi Carburant (Snowflake, fichiers) mais absents de « Gestion des sites » : liste et création en un clic
// (identifiant + nom seulement ; typologies à compléter ensuite avec l'import Ops « Proposition de load »).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createMissingSites, getMissingSites } from "@/services/fuelTracking";
import { Modal } from "../ui";
import { FT } from "../theme";

export function MissingSitesBanner() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sites-manquants"], queryFn: getMissingSites, staleTime: 60_000 });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const n = q.data?.total ?? 0;
  if (!n && !msg) return null;
  const create = async () => {
    setBusy(true);
    try {
      const r = await createMissingSites();
      setMsg(`${r.crees} site(s) créé(s) dans Gestion des sites. ${r.note}`);
      setOpen(false);
      await qc.invalidateQueries();
    } catch {
      setMsg("Création impossible (droits Fuel Manager requis ou erreur serveur).");
    } finally { setBusy(false); }
  };
  return (
    <div role="status" style={{ padding: "8px 12px", borderRadius: 8, background: FT.blueL, border: `1px solid ${FT.blue}40`, color: FT.navy, fontSize: 12.5, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {msg ? <span>{msg}</span> : (
        <>
          <span><strong>{n.toLocaleString("fr-FR")} site(s)</strong> connus de Snowflake ou des fichiers Ops ne figurent pas dans <strong>Gestion des sites</strong>.</span>
          <button type="button" onClick={() => setOpen(true)} style={{ fontSize: 12.5, fontWeight: 800, padding: "5px 10px", borderRadius: 8, border: "none", background: FT.navy, color: "#fff", cursor: "pointer" }}>
            Voir et créer ces sites
          </button>
        </>
      )}
      {open && (
        <Modal title={`${n} site(s) absents de Gestion des sites`} onClose={() => setOpen(false)} maxWidth={720}>
          <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
            <div>Ils seront créés avec <b>leur identifiant et leur nom seulement</b> (aucune typologie inventée). Complétez ensuite typologies et
              configuration avec l'import Ops « Proposition de load » (Gestion des sites → Import Sites). Pour les lignes rejetées d'un fichier de
              clôture, retirez puis réimportez le fichier dans Configuration.</div>
            <div style={{ maxHeight: 320, overflow: "auto", border: `1px solid ${FT.border}`, borderRadius: 8 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
                <thead><tr style={{ background: FT.slateL, textAlign: "left" }}><th style={{ padding: 6 }}>Site</th><th style={{ padding: 6 }}>Nom</th><th style={{ padding: 6 }}>Connu de</th></tr></thead>
                <tbody>
                  {(q.data?.sites ?? []).map((s) => (
                    <tr key={s.site_id} style={{ borderTop: `1px solid ${FT.border}` }}>
                      <td style={{ padding: 6, fontWeight: 700 }}>{s.site_id}</td><td style={{ padding: 6 }}>{s.nom ?? "—"}</td><td style={{ padding: 6, color: FT.textMid }}>{s.sources.join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setOpen(false)} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${FT.border}`, background: FT.card, cursor: "pointer" }}>Annuler</button>
              <button type="button" disabled={busy} onClick={create} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: FT.navy, color: "#fff", fontWeight: 800, cursor: "pointer" }}>
                {busy ? "Création…" : `Créer les ${n} site(s)`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
