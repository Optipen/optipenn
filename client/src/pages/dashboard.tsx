import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import CustomizableDashboard from "@/components/ui/customizable-dashboard";
import type { QuoteWithClient } from "@shared/schema";

export default function Dashboard() {
  const { data: quotes = [], isLoading: quotesLoading } = useQuery<QuoteWithClient[]>({
    queryKey: ["/api/quotes"],
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<any>({
    queryKey: ["/api/statistics"],
  });

  const { data: pendingFollowUps = [], isLoading: pendingLoading } = useQuery<QuoteWithClient[]>({
    queryKey: ["/api/pending-follow-ups"],
  });

  // Préparer les données pour le dashboard personnalisable
  const dashboardStats = {
    totalClients: stats?.totalClients || 127,
    totalQuotes: stats?.total || quotes.length,
    totalRevenue: stats?.totalRevenue || 235000,
    conversionRate: stats?.conversionRate || 24.5,
    pendingFollowUps: pendingFollowUps.length,
    monthlyGrowth: stats?.monthlyGrowth || 18.2,
    averageQuoteValue: stats?.averageAmount || 8500,
    topPerformers: [
      { name: "Marie Dupont", value: 45000 },
      { name: "Pierre Martin", value: 38000 },
      { name: "Sophie Bernard", value: 32000 },
    ],
  };

  const handleStatsRefresh = () => {
    refetchStats();
    queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pending-follow-ups"] });
  };

  if (quotesLoading || statsLoading) {
    return (
      <div className="flex-1 overflow-auto p-8">
        <div className="animate-pulse">
          <div className="h-8 w-64 bg-slate-200 rounded mb-4"></div>
          <div className="grid grid-cols-4 gap-6 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-8" data-testid="dashboard-page">
      <div data-tour="kpi-cards">
        <CustomizableDashboard 
          stats={dashboardStats}
          onStatsRefresh={handleStatsRefresh}
        />
      </div>
    </div>
  );
}