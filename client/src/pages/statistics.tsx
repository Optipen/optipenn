import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, Clock, Euro, Send } from "lucide-react";
import StatusChart from "@/components/charts/status-chart";
import RevenueChart from "@/components/charts/revenue-chart";
import FollowupChart from "@/components/charts/followup-chart";
import type { QuoteWithClient } from "@shared/schema";

export default function Statistics() {
  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/statistics"],
  });

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<QuoteWithClient[]>({
    queryKey: ["/api/quotes"],
  });

  if (statsLoading || quotesLoading) {
    return (
      <div className="flex-1 overflow-auto p-8">
        <div className="animate-pulse">
          <div className="h-8 w-64 bg-slate-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-slate-200 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-96 bg-slate-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Calculate top clients by revenue
  const topClients = quotes.reduce((acc: any, quote) => {
    const clientId = quote.clientId;
    if (!acc[clientId]) {
      acc[clientId] = {
        client: quote.client,
        totalQuotes: 0,
        acceptedQuotes: 0,
        totalRevenue: 0,
      };
    }
    
    acc[clientId].totalQuotes += 1;
    if (quote.status === "Accepté") {
      acc[clientId].acceptedQuotes += 1;
      acc[clientId].totalRevenue += parseFloat(quote.amount);
    }
    
    return acc;
  }, {});

  const sortedTopClients = Object.values(topClients)
    .filter((client: any) => client.totalRevenue > 0) // Only show clients with revenue
    .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  // Calculate average response time for accepted quotes
  const acceptedQuotes = quotes.filter(quote => quote.status === "Accepté");
  const avgResponseTime = acceptedQuotes.length > 0 
    ? acceptedQuotes.reduce((sum, quote) => {
        const sentDate = new Date(quote.sentDate);
        const acceptedDate = new Date(); // Assuming accepted today for simplicity
        const daysDiff = Math.floor((acceptedDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
        return sum + daysDiff;
      }, 0) / acceptedQuotes.length
    : null;

  // Calculate follow-up effectiveness
  const totalQuotes = quotes.length;
  const quotesWithFollowUps = quotes.filter(quote => quote.lastFollowUpDate).length;
  const followUpEffectiveness = totalQuotes > 0 ? (quotesWithFollowUps / totalQuotes) * 100 : 0;

  return (
    <div className="min-h-full" data-testid="statistics-page">
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900" data-testid="page-title">
              Statistiques
            </h2>
            <p className="text-slate-500 mt-1">Analysez vos performances et conversions</p>
          </div>
          <div className="flex items-center space-x-4">
            <Select defaultValue="30-days">
              <SelectTrigger className="w-48" data-testid="select-time-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30-days">30 derniers jours</SelectItem>
                <SelectItem value="3-months">3 derniers mois</SelectItem>
                <SelectItem value="6-months">6 derniers mois</SelectItem>
                <SelectItem value="year">Année en cours</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="flex items-center space-x-2" data-testid="button-export-pdf" onClick={() => window.open("/api/export/quotes.pdf", "_blank")}>
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" data-testid="key-metrics">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-500">Taux de Conversion</h3>
                <TrendingUp className="text-green-600 w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mb-2" data-testid="conversion-rate">
                {stats?.conversionRate ? `${stats.conversionRate.toFixed(1)}%` : "0%"}
              </div>
              <div className="flex items-center text-sm">
                <span className="text-slate-500">Calculé en temps réel</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-500">Temps Moyen de Réponse</h3>
                <Clock className="text-blue-600 w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mb-2" data-testid="avg-response-time">
                {avgResponseTime ? `${avgResponseTime.toFixed(1)} jours` : "N/A"}
              </div>
              <div className="flex items-center text-sm">
                <span className="text-slate-500">
                  {avgResponseTime ? "Basé sur les devis acceptés" : "Aucun devis accepté"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-500">Montant Moyen</h3>
                <Euro className="text-amber-600 w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mb-2" data-testid="average-amount">
                €{stats?.averageAmount ? Math.round(stats.averageAmount).toLocaleString() : "0"}
              </div>
              <div className="flex items-center text-sm">
                <span className="text-slate-500">Basé sur vos devis</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-500">Relances Efficaces</h3>
                <Send className="text-purple-600 w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mb-2" data-testid="followup-effectiveness">
                {followUpEffectiveness.toFixed(0)}%
              </div>
              <div className="flex items-center text-sm">
                <span className="text-slate-500">
                  {quotesWithFollowUps} relances sur {totalQuotes} devis
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Status Distribution Chart */}
          <Card data-testid="status-chart">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Répartition par Statut</h3>
            </div>
            <CardContent className="p-6">
              <div className="chart-container">
                <StatusChart data={stats?.byStatus || {}} />
              </div>
            </CardContent>
          </Card>

          {/* Revenue Trend Chart */}
          <Card data-testid="revenue-chart">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Évolution du CA</h3>
            </div>
            <CardContent className="p-6">
              <div className="chart-container">
                <RevenueChart data={stats?.monthlyRevenue || []} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversion Funnel and Follow-up Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Conversion Funnel */}
          <Card data-testid="conversion-funnel">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Entonnoir de Conversion</h3>
            </div>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span className="font-medium text-slate-900">Devis Envoyés</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{stats?.total || 0}</div>
                    <div className="text-sm text-slate-500">100%</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-amber-500 rounded"></div>
                    <span className="font-medium text-slate-900">En Négociation</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">
                      {(stats?.byStatus?.["En attente"] || 0) + (stats?.byStatus?.["Relancé"] || 0)}
                    </div>
                    <div className="text-sm text-slate-500">
                      {stats?.total ? Math.round((((stats.byStatus["En attente"] || 0) + (stats.byStatus["Relancé"] || 0)) / stats.total) * 100) : 0}%
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="font-medium text-slate-900">Acceptés</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{stats?.byStatus?.["Accepté"] || 0}</div>
                    <div className="text-sm text-slate-500">
                      {stats?.total ? Math.round((stats.byStatus["Accepté"] / stats.total) * 100) : 0}%
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Follow-up Performance */}
          <Card data-testid="followup-chart">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Performance des Relances</h3>
            </div>
            <CardContent className="p-6">
              <div className="chart-container">
                <FollowupChart data={{}} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Performing Clients Table */}
        <Card className="mt-8" data-testid="top-clients">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Top Clients (CA)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Devis
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Acceptés
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Taux
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    CA Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedTopClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      Aucune données disponibles
                    </td>
                  </tr>
                ) : (
                  sortedTopClients.map((clientData: any, index) => (
                    <tr key={clientData.client.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-xs font-medium text-blue-600">
                              {getInitials(clientData.client.company)}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-slate-900">
                              {clientData.client.company}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {clientData.totalQuotes}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {clientData.acceptedQuotes}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {clientData.totalQuotes > 0 
                          ? Math.round((clientData.acceptedQuotes / clientData.totalQuotes) * 100)
                          : 0}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        €{clientData.totalRevenue.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
