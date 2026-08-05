// src/features/fuel-tracking/FuelTrackingPage.tsx
//
// Module suivi-carburant : toutes les données viennent d'un import manuel du
// fichier Excel mensuel "Commande FUEL ESCO SENEGAL <mois>" (bouton
// "Importer" ci-dessous). Plus de récupération automatique eFMS/ENOC/
// Snowflake — chaque futur onglet sera reconstruit un par un, sur le même
// principe (upload de sa propre feuille source), quand le mapping sera défini.
//
// Chaque import ne remplace que les lignes du mois qu'il couvre (voir
// fuel_tracking/services/commande_synthese_import.py côté backend) : les
// mois précédemment importés restent stockés et consultables via le filtre
// mois du header — si le mois choisi n'a pas encore été importé, le Dashboard
// l'indique clairement plutôt que d'afficher un tableau vide sans explication.
//
// Le mois concerné et le mois précédent (ex: Août / Juillet, tels qu'ils
// apparaissent dans le fichier) sont saisis par l'utilisateur au moment de
// l'upload — obligatoires, la détection automatique depuis le fichier s'est
// révélée peu fiable et n'est plus utilisée que par la commande CLI.

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { BarChart3, Calendar, FileSpreadsheet, Loader2, RefreshCw, Settings2, Upload } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getFuelCommandeSynthese, importFuelCommandeSynthese } from "@/services/fuelTracking";

import { FT } from "./theme";
import { Card, GLOBAL_STYLES } from "./ui";
import { shiftMonth } from "./helpers";
import { DashboardSheet } from "./sheets/DashboardSheet";

export default function FuelTrackingPage() {
  const [month, setMonth] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMonthYear, setImportMonthYear] = useState("");
  const [importPrevMonthYear, setImportPrevMonthYear] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const commandeSyntheseQ = useQuery({
    queryKey: ["fuel-commande-synthese", month],
    queryFn: () => getFuelCommandeSynthese({ month: month ?? undefined }),
    staleTime: 60_000,
  });

  // Premier chargement (month encore null) : on adopte le mois résolu par le
  // backend (le plus récent importé), pour que le champ mois affiche cette valeur.
  useEffect(() => {
    if (month === null && commandeSyntheseQ.data?.month_year) {
      setMonth(commandeSyntheseQ.data.month_year);
    }
  }, [month, commandeSyntheseQ.data?.month_year]);

  function openImportModal() {
    setImportFile(null);
    setImportMonthYear("");
    setImportPrevMonthYear("");
    setShowImportModal(true);
  }

  const canSubmitImport = !!importFile && !!importMonthYear && !!importPrevMonthYear && importMonthYear !== importPrevMonthYear;

  async function handleImportSubmit() {
    if (!importFile || !canSubmitImport) return;
    setImporting(true);
    try {
      const result = await importFuelCommandeSynthese(importFile, importMonthYear, importPrevMonthYear);
      toast.success(`${result.rows_imported} lignes importées pour ${result.month_year}.`);
      setMonth(result.month_year);
      queryClient.invalidateQueries({ queryKey: ["fuel-commande-synthese"] });
      setShowImportModal(false);
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
                  value={month ?? commandeSyntheseQ.data?.month_year ?? ""}
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

              <button
                onClick={openImportModal}
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
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <Upload size={13} />
                Importer
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

      {showImportModal && (
        <Dialog open onOpenChange={(next) => { if (!next && !importing) setShowImportModal(false); }}>
          <DialogContent className="p-0 gap-0 border-0" style={{ background: "white", borderRadius: 20, padding: 28, maxWidth: 460, width: "100%", boxShadow: "0 32px 80px rgba(0,0,0,.22)" }}>
            <DialogTitle asChild>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: FT.text, margin: "0 0 4px" }}>Importer la Synthèse Commande</h3>
            </DialogTitle>
            <p style={{ fontSize: 12.5, color: FT.textSub, margin: "0 0 20px" }}>
              Fichier "Commande FUEL ESCO SENEGAL" — précise les 2 mois concernés par ce fichier (ex: Août / Juillet), tels qu'ils apparaissent dans la feuille.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: FT.textMid, textTransform: "uppercase", letterSpacing: ".04em" }}>Mois concerné *</span>
                <input
                  type="month"
                  required
                  value={importMonthYear}
                  onChange={(e) => {
                    const v = e.target.value;
                    setImportMonthYear(v);
                    if (v && !importPrevMonthYear) setImportPrevMonthYear(shiftMonth(v, -1));
                  }}
                  style={{ border: `1px solid ${FT.border}`, borderRadius: 9, padding: "8px 10px", fontSize: 13, fontWeight: 700, color: FT.text }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: FT.textMid, textTransform: "uppercase", letterSpacing: ".04em" }}>Mois précédent *</span>
                <input
                  type="month"
                  required
                  value={importPrevMonthYear}
                  onChange={(e) => setImportPrevMonthYear(e.target.value)}
                  style={{ border: `1px solid ${FT.border}`, borderRadius: 9, padding: "8px 10px", fontSize: 13, fontWeight: 700, color: FT.text }}
                />
              </label>
            </div>

            {importMonthYear && importPrevMonthYear && importMonthYear === importPrevMonthYear && (
              <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 9, background: FT.redL, color: FT.red, fontSize: 12, fontWeight: 700 }}>
                Le mois concerné et le mois précédent doivent être différents.
              </div>
            )}

            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${importFile ? "rgba(15,157,103,.4)" : FT.border}`,
                borderRadius: 14,
                padding: "24px 18px",
                textAlign: "center",
                cursor: "pointer",
                background: importFile ? FT.greenL : FT.slateL,
                marginBottom: 18,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsb,.xlsx,.xlsm"
                style={{ display: "none" }}
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
              <FileSpreadsheet size={26} color={importFile ? FT.green : FT.textSub} style={{ marginBottom: 8 }} />
              {importFile ? (
                <div style={{ fontSize: 12.5, fontWeight: 700, color: FT.green }}>{importFile.name}</div>
              ) : (
                <div style={{ fontSize: 12.5, fontWeight: 700, color: FT.textMid }}>Cliquer pour choisir le fichier (.xlsb, .xlsx)</div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowImportModal(false)}
                disabled={importing}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${FT.border}`, background: "#fff", fontSize: 13, fontWeight: 700, color: FT.textMid, cursor: importing ? "not-allowed" : "pointer" }}
              >
                Annuler
              </button>
              <button
                onClick={handleImportSubmit}
                disabled={!canSubmitImport || importing}
                style={{
                  flex: 2,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background: canSubmitImport && !importing ? FT.navy : FT.slateL,
                  color: canSubmitImport && !importing ? "#fff" : FT.textSub,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: canSubmitImport && !importing ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                }}
              >
                {importing && <Loader2 size={14} className="ft-spin" />}
                {importing ? "Import en cours…" : "Importer"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
