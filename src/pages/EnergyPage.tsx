// ==========================
// src/pages/EnergyPage.tsx
// ==========================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Trash2, Search, RefreshCw, FileDown, X, PlusCircle } from "lucide-react";

import { 
    listEnergyStats,
    uploadEnergyFile,
    deleteEnergyStat,
    EnergyMonthlyStat,
    EnergyListParams, 
} from "@/services/energy";
import { toast } from "react-toastify";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/** ---------------- Helpers ---------------- */
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function classNames(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function toMonthLabel(m: number) {
  return months[(m - 1 + 12) % 12] || String(m);
}


// Helpers pour la table & les KPI
function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function Td({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) {
  return <td className={`px-3 py-2 text-slate-800 ${className}`}>{children}</td>;
}

/** ---------------- Page ---------------- */
export default function EnergyPage() {
  const [rows, setRows] = useState<EnergyMonthlyStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Upload state
  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const params: EnergyListParams = useMemo(() => ({
    page,
    page_size: pageSize,
    q: query || undefined,
    year: year || undefined,
  }), [page, pageSize, query, year]);

  async function reload() {
    setLoading(true);
    try {
      console.log("Loading with params", params);
      const res = await listEnergyStats(params);
      console.log("Loaded", res);
      setRows(res.items);
      setTotal(res.total);
    } catch (e: any) {
      toast.error(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, query, year]);

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const byMonth = [...rows].sort((a,b)=>a.month-b.month);
    const totalGrid = rows.reduce((s,r)=> s + (Number(r.grid_mwh)||0), 0);
    const totalSolar = rows.reduce((s,r)=> s + (Number(r.solar_mwh)||0), 0);
    const totalGen = rows.reduce((s,r)=> s + (Number(r.generators_mwh)||0), 0);
    const avgRER = rows.reduce((s,r)=> s + (Number(r.rer_pct)||0), 0) / rows.length;
    const avgLoad = rows.reduce((s,r)=> s + (Number(r.avg_telecom_load_mw)||0), 0) / rows.length;
    return { byMonth, totalGrid, totalSolar, totalGen, avgRER, avgLoad };
  }, [rows]);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.info("Choisissez un fichier");
      return;
    }
    try {
      setLoading(true);
      const payload: Record<string, string> = {};
      if (countryRef.current?.value) payload.country = countryRef.current.value;
      if (yearRef.current?.value) payload.year = yearRef.current.value;
      if (dateRef.current?.value) payload.report_date = dateRef.current.value;
      await uploadEnergyFile(file, payload);
      toast.success("Import terminé");
      setModalOpen(false);
      setFile(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'import");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    try {
      setDeletingId(id);
      await deleteEnergyStat(id);
      toast.success("Supprimé");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Échec suppression");
    } finally {
      setDeletingId(null);
    }
  }

  // Pagination helpers
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Title + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Énergie — Stats Mensuelles</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-900 px-4 py-2 text-white shadow-sm hover:bg-blue-800"
          >
            <Upload className="h-4 w-4" /> Importer
          </button>
          <button
            onClick={reload}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-blue-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Rechercher (mois, pays, %RER…)"
            value={query}
            onChange={(e)=>{ setPage(1); setQuery(e.target.value); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Année</label>
          <input type="number" inputMode="numeric"
            className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={year||""}
            placeholder="2025"
            onChange={(e)=>{ setPage(1); setYear(e.target.value || undefined); }}
          />
        </div>
        <div className="flex items-center gap-2 justify-end">
          <label className="text-sm text-slate-600">Page</label>
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2" value={page} onChange={(e)=>setPage(Number(e.target.value))}>
            {Array.from({length: totalPages}).map((_,i)=> (
              <option key={i} value={i+1}>{i+1}</option>
            ))}
          </select>
          <label className="text-sm text-slate-600">/ Taille</label>
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2" value={pageSize} onChange={(e)=>{setPage(1); setPageSize(Number(e.target.value));}}>
            {[6,12,24,50].map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total GRID (MWh)" value={stats ? stats.totalGrid.toFixed(0) : "—"} />
        <StatCard title="Total SOLAR (MWh)" value={stats ? stats.totalSolar.toFixed(0) : "—"} />
        <StatCard title="Total GENERATORS (MWh)" value={stats ? stats.totalGen.toFixed(0) : "—"} />
        <StatCard title="RER moyen (%)" value={stats ? stats.avgRER.toFixed(1) : "—"} />
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">RER% et GRID% par mois</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={(stats?.byMonth||[]).map(r=>({
              month: toMonthLabel(r.month),
              rer: Number(r.rer_pct)||0,
              grid: Number(r.grid_pct)||0,
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <RTooltip />
              <Legend />
              <Bar dataKey="rer" name="RER %" />
              <Bar dataKey="grid" name="GRID %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th>Année</th>
              <th>Mois</th>
              <th className="text-right">Sites (int)</th>
              <th className="text-right">Monitored</th>
              <th className="text-right">GRID MWh</th>
              <th className="text-right">SOLAR MWh</th>
              <th className="text-right">GEN MWh</th>
              <th className="text-right">Telecom MWh</th>
              <th className="text-right">GRID %</th>
              <th className="text-right">RER %</th>
              <th className="text-right">GEN %</th>
              <th className="text-right">Avg Load MW</th>
              <th>Fichier</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={14} className="p-6 text-center text-slate-500">Chargement…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={14} className="p-6 text-center text-slate-500">Aucune donnée</td>
              </tr>
            )}
            {!loading && rows.map(r => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <Td>{r.year}</Td>
                <Td>{toMonthLabel(r.month)}</Td>
                <Td className="text-right">{r.sites_integrated ?? ""}</Td>
                <Td className="text-right">{r.sites_monitored ?? ""}</Td>
                <Td className="text-right">{r.grid_mwh ?? ""}</Td>
                <Td className="text-right">{r.solar_mwh ?? ""}</Td>
                <Td className="text-right">{r.generators_mwh ?? ""}</Td>
                <Td className="text-right">{r.telecom_mwh ?? ""}</Td>
                <Td className="text-right">{r.grid_pct ?? ""}</Td>
                <Td className="text-right">{r.rer_pct ?? ""}</Td>
                <Td className="text-right">{r.generators_pct ?? ""}</Td>
                <Td className="text-right">{r.avg_telecom_load_mw ?? ""}</Td>
                <Td>{r.source_filename || "—"}</Td>
                <Td>
                  <button
                    onClick={() => onDelete(r.id)}
                    disabled={deletingId === r.id}
                    className={classNames(
                      "inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm",
                      deletingId===r.id ? "bg-slate-100 text-slate-400" : "bg-red-50 text-red-600 hover:bg-red-100"
                    )}
                    title="Supprimer la ligne"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingId===r.id ? "…" : "Supprimer"}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Upload modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={()=>setModalOpen(false)} />
          <div className="relative w-[95%] max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <button onClick={()=>setModalOpen(false)} className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Importer un fichier énergie</h3>
            <form className="space-y-4" onSubmit={onUpload}>
              <div>
                <label className="text-sm text-slate-600">Fichier (.xlsx ou .csv)</label>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e)=> setFile(e.target.files?.[0]||null)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-sm text-slate-600">Pays (optionnel)</label>
                  <input ref={countryRef} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="Senegal" />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Année (optionnel)</label>
                  <input ref={yearRef} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="2025" />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Date rapport (optionnel)</label>
                  <input type="datetime-local" ref={dateRef} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setModalOpen(false)} className="rounded-xl bg-white px-4 py-2 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Annuler</button>
                <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2 text-white hover:bg-blue-800">
                  <Upload className="h-4 w-4" /> Importer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


