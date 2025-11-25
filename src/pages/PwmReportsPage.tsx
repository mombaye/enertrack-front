// src/pages/PwmReportsPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Search, RefreshCw, X } from "lucide-react";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { listPwmReports, uploadPwmFile, PwmReport, PwmListParams } from "@/services/pwm";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from "recharts";

const cls = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

function Card({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-800">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export default function PwmReportsPage() {
  const [rows, setRows] = useState<PwmReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [siteId, setSiteId] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const params: PwmListParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      q: q || undefined,
      country: country || undefined,
      site_id: siteId || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [page, pageSize, q, country, siteId, dateFrom, dateTo]
  );

  async function reload() {
    setLoading(true);
    try {
      const res = await listPwmReports(params);
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
  }, [page, pageSize, q, country, siteId, dateFrom, dateTo]);

  const kpis = useMemo(() => {
    if (!rows.length) return null;

    const sum = (fn: (r: PwmReport) => number) =>
      rows.reduce((s, r) => s + (fn(r) || 0), 0);

    const totalAvg = sum(r => Number(r.total_pwm_avg_w || 0));
    const totalPwc = sum(r => Number(r.total_pwc_avg_load_w || 0));
    const avgGridAvail =
      rows.length ? (sum(r => Number(r.grid_availability_pct || 0)) / rows.length) : 0;
    const avgUptime =
      rows.length ? (sum(r => Number(r.dc_pwm_avg_uptime_pct || 0)) / rows.length) : 0;

    // top 12 par charge moyenne
    const bySite = [...rows]
      .sort((a, b) => (Number(b.total_pwm_avg_w) || 0) - (Number(a.total_pwm_avg_w) || 0))
      .slice(0, 12)
      .map(r => ({
        site: r.site?.site_id ?? "",
        pwm_avg_w: Number(r.total_pwm_avg_w) || 0,
        pwc_avg_w: Number(r.total_pwc_avg_load_w) || 0,
      }));

    return { totalAvg, totalPwc, avgGridAvail, avgUptime, bySite };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.info("Choisissez un fichier");
      return;
    }
    try {
      setLoading(true);
      await uploadPwmFile(file);
      toast.success("Import terminé");
      setModalOpen(false);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'import");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">PWM — Reports</h1>
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

      {/* Filtres */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Rechercher (site id, nom)…"
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
          />
        </div>
        <input
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
          placeholder="Pays"
          value={country}
          onChange={(e) => { setPage(1); setCountry(e.target.value); }}
        />
        <input
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
          placeholder="Site ID"
          value={siteId}
          onChange={(e) => { setPage(1); setSiteId(e.target.value); }}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
            value={dateFrom}
            onChange={(e) => { setPage(1); setDateFrom(e.target.value); }}
          />
          <input
            type="date"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
            value={dateTo}
            onChange={(e) => { setPage(1); setDateTo(e.target.value); }}
          />
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Total PWM moyen (W)" value={kpis ? Math.round(kpis.totalAvg).toLocaleString() : "—"} />
        <Card title="PWC — charge moyenne (W)" value={kpis ? Math.round(kpis.totalPwc).toLocaleString() : "—"} />
        <Card title="Uptime DC PWM (%)" value={kpis ? kpis.avgUptime.toFixed(1) : "—"} />
        <Card title="Grid availability (%)" value={kpis ? kpis.avgGridAvail.toFixed(1) : "—"} />
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Top 12 — Charge moyenne par site</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={kpis?.bySite || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="site" />
              <YAxis />
              <RTooltip />
              <Legend />
              <Bar dataKey="pwm_avg_w" name="PWM moyen (W)" />
              <Bar dataKey="pwc_avg_w" name="PWC moyen (W)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Pays</th>
              <th className="px-3 py-2">Site</th>
              <th className="px-3 py-2">Début</th>
              <th className="px-3 py-2">Fin</th>
              <th className="px-3 py-2 text-right">PWM moyen (W)</th>
              <th className="px-3 py-2 text-right">PWC moyen (W)</th>
              <th className="px-3 py-2 text-right">Uptime DC PWM (%)</th>
              <th className="px-3 py-2 text-right">Grid avail. (%)</th>
              <th className="px-3 py-2 text-right">Cuts</th>
              <th className="px-3 py-2">Fichier</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-slate-500">Chargement…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-slate-500">Aucune donnée</td>
              </tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-3 py-2">{r.country?.name}</td>
                <td className="px-3 py-2">{r.site?.site_id}</td>
                <td className="px-3 py-2">{r.period_start ? format(new Date(r.period_start), "yyyy-MM-dd") : ""}</td>
                <td className="px-3 py-2">{r.period_end ? format(new Date(r.period_end), "yyyy-MM-dd") : ""}</td>
                <td className="px-3 py-2 text-right">{r.total_pwm_avg_w ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.total_pwc_avg_load_w ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.dc_pwm_avg_uptime_pct ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.grid_availability_pct ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.number_grid_cuts ?? ""}</td>
                <td className="px-3 py-2">{r.source_filename || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-slate-600">Page</span>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2"
          value={page}
          onChange={(e) => setPage(Number(e.target.value))}
        >
          {Array.from({ length: totalPages }).map((_, i) => (
            <option key={i} value={i + 1}>{i + 1}</option>
          ))}
        </select>
        <span className="text-sm text-slate-600">/ Taille</span>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2"
          value={pageSize}
          onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}
        >
          {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Upload modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setModalOpen(false)} />
          <div className="relative w-[95%] max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Importer un fichier PWM</h3>
            <form className="space-y-4" onSubmit={onUpload}>
              <div>
                <label className="text-sm text-slate-600">Fichier (.xlsx / .csv)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl bg-white px-4 py-2 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2 text-white hover:bg-blue-800"
                >
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
