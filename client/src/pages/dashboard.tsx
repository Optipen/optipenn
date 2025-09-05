import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, Percent, Euro, User, AlertTriangle } from "lucide-react";
import type { QuoteWithClient } from "@shared/schema";

export default function Dashboard() {
  const { data: quotes = [], isLoading: quotesLoading } = useQuery<QuoteWithClient[]>({
    queryKey: ["/api/quotes"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/statistics"],
  });

  const { data: pendingFollowUps = [], isLoading: pendingLoading } = useQuery<QuoteWithClient[]>({
    queryKey: ["/api/pending-follow-ups"],
  });

  if (quotesLoading || statsLoading || pendingLoading) {
    return (
      <div className="flex-1 overflow-auto p-8">
        <div className="animate-pulse">
          <div className="h-8 w-64 bg-slate-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-slate-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const recentQuotes = quotes.slice(0, 5);
  const urgentFollowUps = pendingFollowUps.slice(0, 5);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Accepté":
        return "bg-green-100 text-green-800";
      case "En attente":
        return "bg-amber-100 text-amber-800";
      case "Relancé":
        return "bg-orange-100 text-orange-800";
      case "Refusé":
        return "bg-red-100 text-red-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex-1 overflow-auto" data-testid="dashboard-page">
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900" data-testid="page-title">
              Tableau de bord
            </h2>
            <p className="text-slate-500 mt-1">Vue d'ensemble de vos devis et relances</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-sm text-slate-500">
              Dernière mise à jour: <span className="font-medium">Il y a 2 min</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" data-testid="stats-cards">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Devis</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="total-quotes">
                    {stats?.total ?? 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileText className="text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-green-600 font-medium">+12%</span>
                <span className="text-slate-500 ml-2">par rapport au mois dernier</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">En Attente</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="pending-quotes">
                    {stats?.byStatus?.["En attente"] ?? 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="text-amber-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-amber-600 font-medium" data-testid="pending-followups-count">
                  {pendingFollowUps.length} à relancer
                </span>
                <span className="text-slate-500 ml-2">cette semaine</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Taux Conversion</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="conversion-rate">
                    {stats?.conversionRate ? `${stats.conversionRate.toFixed(1)}%` : "0%"}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Percent className="text-green-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-green-600 font-medium">+5%</span>
                <span className="text-slate-500 ml-2">ce mois-ci</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Montant Moyen</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="average-amount">
                    €{stats?.averageAmount ? Math.round(stats.averageAmount).toLocaleString() : "0"}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Euro className="text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-blue-600 font-medium">€156K</span>
                <span className="text-slate-500 ml-2">acceptés ce mois</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Quotes */}
          <Card>
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Devis Récents</h3>
            </div>
            <CardContent className="p-6">
              <div className="space-y-4" data-testid="recent-quotes">
                {recentQuotes.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">Aucun devis trouvé</p>
                ) : (
                  recentQuotes.map((quote) => (
                    <div key={quote.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-slate-600">
                            {getInitials(quote.client.company)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{quote.client.company}</p>
                          <p className="text-sm text-slate-500">{quote.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-slate-900">€{parseFloat(quote.amount).toLocaleString()}</p>
                        <Badge className={getStatusVariant(quote.status)}>
                          {quote.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Follow-ups */}
          <Card>
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Relances à Effectuer</h3>
                {urgentFollowUps.length > 0 && (
                  <Badge className="bg-red-100 text-red-800">
                    {urgentFollowUps.length} urgentes
                  </Badge>
                )}
              </div>
            </div>
            <CardContent className="p-6">
              <div className="space-y-4" data-testid="pending-followups">
                {urgentFollowUps.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">Aucune relance en attente</p>
                ) : (
                  urgentFollowUps.map((quote) => {
                    const lastDate = quote.lastFollowUpDate ? new Date(quote.lastFollowUpDate) : new Date(quote.sentDate);
                    const daysPassed = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                    const isUrgent = daysPassed > 10;
                    
                    return (
                      <div 
                        key={quote.id} 
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          isUrgent ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-2 h-2 rounded-full ${isUrgent ? "bg-red-500" : "bg-amber-500"}`}></div>
                          <div>
                            <p className="font-medium text-slate-900">{quote.client.company}</p>
                            <p className="text-sm text-slate-500">
                              {isUrgent ? `En retard de ${daysPassed - 7} jours` : "À relancer aujourd'hui"}
                            </p>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant={isUrgent ? "destructive" : "default"}
                          data-testid={`followup-${quote.id}`}
                        >
                          {isUrgent && <AlertTriangle className="w-4 h-4 mr-1" />}
                          Relancer
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
