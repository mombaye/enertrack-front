interface StatsCardsProps {
  avgMontant?: number; // ou string selon ton usage
  avgConso?: number;   // ou string si parfois vide
  count?: number;
  isLoading?: boolean;
}

export function StatsCards({ avgMontant, avgConso, count, isLoading }: StatsCardsProps) {
  return (
    <div className="flex gap-4 mb-2">
      <div className="bg-white rounded-xl shadow p-4 flex flex-col min-w-[150px] items-start">
        <span className="text-xs text-blue-900 opacity-60">Montant moyen</span>
        <span className="text-xl font-semibold text-blue-900">
          {isLoading ? <span className="animate-pulse">...</span> : `${avgMontant ?? "--"} FCFA`}
        </span>
      </div>
      <div className="bg-white rounded-xl shadow p-4 flex flex-col min-w-[150px] items-start">
        <span className="text-xs text-blue-900 opacity-60">Conso moyenne</span>
        <span className="text-xl font-semibold text-blue-900">
          {isLoading ? <span className="animate-pulse">...</span> : `${avgConso ?? "--"} kWh`}
        </span>
      </div>
      <div className="bg-white rounded-xl shadow p-4 flex flex-col min-w-[150px] items-start">
        <span className="text-xs text-blue-900 opacity-60">Nb factures</span>
        <span className="text-xl font-semibold text-blue-900">
          {isLoading ? <span className="animate-pulse">...</span> : count ?? "--"}
        </span>
      </div>
    </div>
  );
}
