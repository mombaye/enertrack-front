// src/pages/GridOutagesPage.tsx
import { useState } from "react";
import { CloudUpload, FileSpreadsheet, BellRing } from "lucide-react";
import { toast } from "react-toastify";
import {
  importGridOutageDaily,
  importGridOutageAlarms,
} from "@/services/gridOutages";

export default function GridOutagesPage() {
  const [dailyFile, setDailyFile] = useState<File | null>(null);
  const [alarmFile, setAlarmFile] = useState<File | null>(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingAlarms, setLoadingAlarms] = useState(false);

  const handleDailyImport = async () => {
    if (!dailyFile) {
      toast.warn("Merci de sélectionner un fichier Daily (file 1).");
      return;
    }
    try {
      setLoadingDaily(true);
      const res = await importGridOutageDaily(dailyFile);
      toast.success(
        `Daily import: ${res.created} ajoutés, ${res.updated} mis à jour.`
      );
    } catch (err: any) {
      console.error(err);
      toast.error("Échec de l'import des données journalières.");
    } finally {
      setLoadingDaily(false);
    }
  };

  const handleAlarmsImport = async () => {
    if (!alarmFile) {
      toast.warn("Merci de sélectionner un fichier Alarms (file 2).");
      return;
    }
    try {
      setLoadingAlarms(true);
      const res = await importGridOutageAlarms(alarmFile);
      toast.success(
        `Alarms import: ${res.created} ajoutés, ${res.updated} mis à jour.`
      );
    } catch (err: any) {
      console.error(err);
      toast.error("Échec de l'import des alarmes.");
    } finally {
      setLoadingAlarms(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6 md:px-10 md:py-8">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-blue-900">
            Grid Outages
          </h1>
          <p className="text-sm text-slate-500">
            Suivi des coupures réseau (daily KPIs & alarmes FMS) – EnerTrack ESCO.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs md:text-sm">
          <span className="inline-flex items-center rounded-full bg-blue-900 text-white px-3 py-1 font-medium shadow-sm">
            <CloudUpload className="mr-2 h-4 w-4" />
            Imports CSV
          </span>
        </div>
      </header>

      {/* Zone Import */}
      <section className="grid gap-5 md:grid-cols-2">
        {/* Daily file card */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-900 text-white p-2">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-blue-900">
                Import Daily Grid Outage
              </h2>
              <p className="text-xs text-slate-500">
                Fichier 1 – valeurs agrégées par site et par jour
                (Country, Site ID, Param Name, Param Value, Measure, Date).
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 flex flex-col gap-3">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) =>
                setDailyFile(e.target.files ? e.target.files[0] : null)
              }
              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-blue-800 cursor-pointer"
            />
            {dailyFile && (
              <p className="text-xs text-slate-500">
                Fichier sélectionné :{" "}
                <span className="font-medium text-blue-900">
                  {dailyFile.name}
                </span>
              </p>
            )}
            <button
              onClick={handleDailyImport}
              disabled={loadingDaily}
              className="mt-1 inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingDaily ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Import en cours...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CloudUpload className="h-4 w-4" />
                  Lancer l'import Daily
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Alarms file card */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-500 text-white p-2">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-blue-900">
                Import Grid Outage Alarms
              </h2>
              <p className="text-xs text-slate-500">
                Fichier 2 – alarmes FMS{" "}
                <span className="font-medium">Grid Outage [P]</span>
                &nbsp;avec IDs, dates de début/fin et tickets.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 flex flex-col gap-3">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) =>
                setAlarmFile(e.target.files ? e.target.files[0] : null)
              }
              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-blue-800 cursor-pointer"
            />
            {alarmFile && (
              <p className="text-xs text-slate-500">
                Fichier sélectionné :{" "}
                <span className="font-medium text-blue-900">
                  {alarmFile.name}
                </span>
              </p>
            )}
            <button
              onClick={handleAlarmsImport}
              disabled={loadingAlarms}
              className="mt-1 inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingAlarms ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Import en cours...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CloudUpload className="h-4 w-4" />
                  Lancer l'import Alarms
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Placeholder pour futur tableau / stats */}
      <section className="mt-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-1">
          Vue synthèse (à venir)
        </h3>
        <p className="text-xs text-slate-500">
          Tu pourras ici ajouter un tableau des coupures par site, des KPIs
          (durée moyenne, top sites impactés, corrélation Daily vs Alarms,
          etc.). Pour l’instant, cette section sert de placeholder.
        </p>
      </section>
    </div>
  );
}
