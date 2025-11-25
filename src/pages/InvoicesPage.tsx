import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import DateRangePicker from "@/components/ui/DateRangePicker";
import DatePicker from "@/components/ui/DatePicker";
import { Upload } from "lucide-react";
import { fetchImportStatus, fetchInvoices, fetchInvoicesKPI, fetchInvoiceStats, importInvoicesExcel, importInvoicesExcelAsync } from "@/services/invoices";
import InvoicesTable from "@/components/invoices/InvoicesTable";
import StatsTable from "@/components/invoices/StatsTable";
import { toast } from "react-toastify";

import ImportProgressBar from "@/components/utils/ImportProgressBar";
import KPIPageTab from "@/components/invoices/KPIPageTab";

const now = new Date();
const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
const startOfYear = new Date(now.getFullYear(), 0, 1);

export default function InvoicesPage() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | null>({
    from: threeMonthsAgo,
    to: now,
  });
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  // Calcul stats globales
  const avgMontantGlobal = stats.length ? Math.round(stats.reduce((a, s) => a + (Number(s.avg_montant_ht) || 0), 0) / stats.length) : 0;
  const avgConsoGlobal = stats.length ? Math.round(stats.reduce((a, s) => a + (Number(s.avg_consommation) || 0), 0) / stats.length) : 0;
  const countGlobal = stats.reduce((a, s) => a + (Number(s.count) || 0), 0);

  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(threeMonthsAgo);
  const [endDate, setEndDate] = useState<Date | null>(now);
  const [activeTab, setActiveTab] = useState("factures");
  const [kpi, setKpi] = useState<any[]>([]);
  const [loadingKPI, setLoadingKPI] = useState(false);
  


  useEffect(() => {
    if (!startDate || !endDate) return;

    setLoading(true);
    const start = startDate.toISOString().slice(0, 10);
    const end = endDate.toISOString().slice(0, 10);

    Promise.all([
      fetchInvoices({ startDate: start, endDate: end }),
      fetchInvoiceStats({ startDate: start, endDate: end }),
    ])
      .then(([invoicesRes, statsRes]) => {
        setInvoices(invoicesRes);
        setStats(statsRes);
      })
      .catch(() => toast.error("Erreur lors du chargement"))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);


  useEffect(() => {
  if (activeTab === "kpi" && kpi.length === 0) {
    setLoadingKPI(true);
    fetchInvoicesKPI()
      .then(setKpi)
      .catch(() => toast.error("Erreur lors du chargement des KPI"))
      .finally(() => setLoadingKPI(false));
  }
}, [activeTab, kpi.length]);

  function pollImportStatus(taskId: string) {
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        const { status, result } = await fetchImportStatus(taskId);

        if (status === "SUCCESS") {
          clearInterval(interval);
          setImportProgress(100);
          setTimeout(() => setImportProgress(null), 800);
          setImportLoading(false);

          toast.success(result.message);
          if (result.skipped) toast.warn(`${result.skipped} ligne(s) ignorée(s)`);
          if (result.errors?.length)
            toast.info(`${result.errors.length} erreur(s) — voir console`);

          console.log("Erreurs d'import :", result.errors);

          // Refresh data
          if (dateRange) {
            fetchInvoices({
              startDate: dateRange.from.toISOString().slice(0, 10),
              endDate: dateRange.to.toISOString().slice(0, 10),
            }).then(setInvoices);
          }
        }

        if (status === "FAILURE") {
          clearInterval(interval);
          setImportLoading(false);
          setImportProgress(null);
          toast.error("Erreur serveur pendant l'import");
        }

        attempts += 1;
        if (attempts >= 30) {
          clearInterval(interval);
          setImportLoading(false);
          setImportProgress(null);
          toast.error("Import trop long ou inactif");
        } else {
          // Barre de progression fictive
          setImportProgress((prev) => Math.min((prev || 10) + 5, 95));
        }
      } catch {
        clearInterval(interval);
        setImportLoading(false);
        setImportProgress(null);
        toast.error("Erreur lors du suivi d'import");
      }
    }, 2000);
  }

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportProgress(10); // démarrage fictif

    try {
      const { task_id } = await importInvoicesExcelAsync(file);
      pollImportStatus(task_id);
    } catch (err) {
      toast.error("Échec de lancement de l’import");
      setImportLoading(false);
      setImportProgress(null);
    }
  }




  return (
    <div>
      <div className="flex flex-wrap gap-2 items-end justify-between sticky top-0 z-30 bg-blue-50 pb-4 pt-2 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900 mb-1">Factures énergie</h1>
          <div className="text-blue-900/60 text-sm font-medium mb-2">
            Visualisez, importez et analysez vos factures d’énergie par site, période ou globalement.
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
         <div className="flex gap-2 items-center">
          <div>
            <div className="text-sm font-medium text-blue-900 mb-1">Date de début</div>
            <DatePicker value={startDate} onChange={setStartDate} />
          </div>
          <div>
            <div className="text-sm font-medium text-blue-900 mb-1">Date de fin</div>
            <DatePicker value={endDate} onChange={setEndDate} />
          </div>
        </div>


          <label className="inline-flex items-center cursor-pointer relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              hidden
              disabled={importLoading}
            />
            <Button
              variant="outline"
              className="gap-2 min-w-[150px]"
              disabled={importLoading}
              asChild
            >
              <span>
                {importLoading ? (
                  <svg className="animate-spin inline h-5 w-5 mr-2 text-blue-900" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : (
                  <Upload size={18} className="inline mr-2" />
                )}
                Importer Excel
              </span>
            </Button>
          </label>
        </div>
      </div>

      <Tabs defaultValue="factures" onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="factures">📄 Historique</TabsTrigger>
          <TabsTrigger value="stats">📊 Stats moyennes par site</TabsTrigger>
           <TabsTrigger value="kpi">📈 KPI par site</TabsTrigger>
        </TabsList>
       
        <TabsContent value="factures" className="mt-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-7 w-7 text-blue-900" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          ) : (
            <InvoicesTable invoices={invoices} />
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-8">
          <div className="bg-blue-800 text-white rounded-2xl p-4 mb-6 flex gap-12 items-center shadow-lg">
            <div>
              <div className="text-lg font-semibold">Montant moyen global</div>
              <div className="text-2xl font-bold">{avgMontantGlobal ? avgMontantGlobal.toLocaleString() + " FCFA" : "--"}</div>
            </div>
            <div>
              <div className="text-lg font-semibold">Conso moyenne globale</div>
              <div className="text-2xl font-bold">{avgConsoGlobal ? avgConsoGlobal.toLocaleString() + " kWh" : "--"}</div>
            </div>
            <div>
              <div className="text-lg font-semibold">Factures analysées</div>
              <div className="text-2xl font-bold">{countGlobal || "--"}</div>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-7 w-7 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          ) : (
            <StatsTable stats={stats} />
          )}
        </TabsContent>

        
        {/* ... */}
        <TabsContent value="kpi" className="mt-8">
          <KPIPageTab kpi={kpi} loading={loadingKPI} />
        </TabsContent>
      
      </Tabs>

      {importProgress !== null && <ImportProgressBar progress={importProgress} />}



    </div>
  );
}
