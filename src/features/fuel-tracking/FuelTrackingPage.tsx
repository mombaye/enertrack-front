// src/features/fuel-tracking/FuelTrackingPage.tsx
//
// Module suivi-carburant : toutes les données viennent d'un import manuel du
// fichier Excel mensuel "Commande FUEL ESCO SENEGAL <mois>" (bouton
// "Importer" ci-dessous). Plus de récupération automatique eFMS/ENOC/
// Snowflake — chaque futur onglet sera reconstruit un par un, sur le même
// principe (upload de sa propre feuille source), quand le mapping sera défini.

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { BarChart3, Calendar, RefreshCw, Settings2, Upload } from "lucide-react";

import { getFuelCommandeSynthese, importFuelCommandeSynthese } from "@/services/fuelTracking";

import { FT } from "./theme";
import { Card, GLOBAL_STYLES } from "./ui";
import { currentMonth } from "./helpers";
import { DashboardSheet } from "./sheets/DashboardSheet";

export default function FuelTrackingPage() {
  const [month, setMonth] = useState(currentMonth());
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const commandeSyntheseQ = useQuery({
    queryKey: ["fuel-commande-synthese", month],
    queryFn: () => getFuelCommandeSynthese({ month }),
    staleTime: 60_000,
  });

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const result = await importFuelCommandeSynthese(file);
      toast.success(`${result.rows_imported} lignes importées pour ${result.month_year}.`);
      setMonth(result.month_year);
      queryClient.invalidateQueries({ queryKey: ["fuel-commande-synthese"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Échec de l'import du fichier.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      <div className="fuelbook" style={{ display: "flex", flexDirection: "column", gap: 14, background: FT.pageBg, margin: -20, padding: 20 }}>
        <div
          className="ft-fade"
          style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", border: `1px solid ${FT.border}`, borderRadius: FT.radius, boxShadow: FT.shadow, padding: "20px 24px" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: FT.blueL, display: "grid", placeItems: "center", color: FT.gold }}>
                <BarChart3 size={16} />
              </div>
              <div>
                <h1 style={{ margin: 0, color: "#0f172a", fontSize: 22, lineHeight: 1.25, fontWeight: 900, letterSpacing: "-.03em" }}>Suivi Carburant</h1>
                <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>Synthèse mensuelle importée depuis le fichier Excel "Commande FUEL ESCO SENEGAL".</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px" }}>
                <Calendar size={14} color={FT.textSub} />
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, fontWeight: 700 }}
                />
              </div>

              <button
                onClick={() => commandeSyntheseQ.refetch()}
                title="Rafraîchir"
                style={{ width: 33, height: 33, borderRadius: 9, border: `1px solid ${FT.border}`, background: FT.slateL, display: "grid", placeItems: "center", cursor: "pointer", color: FT.textMid, flexShrink: 0 }}
              >
                <RefreshCw size={14} className={commandeSyntheseQ.isFetching ? "ft-spin" : ""} />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsb,.xlsx,.xlsm"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleImportFile(file);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 14px",
                  borderRadius: 9,
                  border: "none",
                  background: FT.navy,
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: importing ? "not-allowed" : "pointer",
                  opacity: importing ? 0.7 : 1,
                  flexShrink: 0,
                }}
              >
                <Upload size={13} className={importing ? "ft-spin" : ""} />
                {importing ? "Import…" : "Importer"}
              </button>
            </div>
          </div>
        </div>

        <div className="ft-fade">
          <DashboardSheet data={commandeSyntheseQ.data} loading={commandeSyntheseQ.isLoading} />
        </div>

        <Card style={{ background: FT.slateL }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "white", display: "grid", placeItems: "center", color: FT.gold, flexShrink: 0 }}>
              <Settings2 size={16} />
            </div>
            <div>
              <div style={{ color: FT.text, fontSize: 14, fontWeight: 850 }}>Module en reconstruction</div>
              <div style={{ color: FT.textSub, fontSize: 12.5, lineHeight: 1.6, marginTop: 3 }}>
                La récupération automatique eFMS / ENOC / Snowflake a été retirée. Seul le Dashboard (import du fichier "Commande FUEL ESCO SENEGAL") est actif pour le moment ;
                les autres onglets (Journal ravitaillement, Conso mensuelle, Stock dépôt, CPH, Référentiel sites, Listes) seront reconstruits un par un, chacun sur la base d'un fichier importé.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
