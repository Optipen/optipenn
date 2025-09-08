import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, Percent, Euro, User, AlertTriangle, Calendar } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { QuoteWithClient } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  
  const { data: quotes = [], isLoading: quotesLoading } = useQuery<QuoteWithClient[]>({
    queryKey: ["/api/quotes"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/statistics"],
  });

  const { data: pendingFollowUps = [], isLoading: pendingLoading } = useQuery<QuoteWithClient[]>({
    queryKey: ["/api/pending-follow-ups"],
  });

  const followUpMutation = useMutation({
    mutationFn: ({ quoteId, comment }: { quoteId: string; comment: string }) =>
      apiRequest("POST", `/api/quotes/${quoteId}/follow-up`, {
        date: new Date().toISOString().split('T')[0],
        comment,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      toast({
        title: "Succès",
        description: "Relance effectuée avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la relance",
        variant: "destructive",
      });
    },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { plannedFollowUpDate: string } }) =>
      apiRequest("PUT", `/api/quotes/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-follow-ups"] });
      toast({
        title: "Succès",
        description: "Relance planifiée mise à jour",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de planifier la relance",
        variant: "destructive",
      });
    },
  });

  const handleFollowUp = (quote: QuoteWithClient) => {
    const comment = prompt(`Relance pour ${quote.client.company} - Commentaire (optionnel) :`);
    if (comment !== null) {
      followUpMutation.mutate({ 
        quoteId: quote.id, 
        comment: comment || `Relance automatique depuis le tableau de bord` 
      });
    }
  };

  const handlePlanFollowUp = (quote: QuoteWithClient) => {
    const current = quote.plannedFollowUpDate || "";
    const input = prompt(`Planifier relance pour ${quote.client.company} (YYYY-MM-DD)`, current);
    if (input === null) return;
    const trimmed = input.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      toast({ 
        title: "Format invalide", 
        description: "Utilisez le format YYYY-MM-DD", 
        variant: "destructive" 
      });
      return;
    }
    updateQuoteMutation.mutate({ id: quote.id, updates: { plannedFollowUpDate: trimmed } });
  };

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
                <span className="text-slate-500">Données en temps réel</span>
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
                <span className="text-slate-500 ml-2">en attente</span>
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
                <span className="text-slate-500">Calculé automatiquement</span>
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
                <span className="text-slate-500">Basé sur vos devis</span>
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
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                      <FileText className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 mb-2">Aucun devis pour le moment</p>
                    <p className="text-sm text-slate-400">Commencez par ajouter votre premier client et devis</p>
                  </div>
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
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                      <Clock className="w-8 h-8 text-green-400" />
                    </div>
                    <p className="text-slate-500 mb-2">Aucune relance en attente</p>
                    <p className="text-sm text-slate-400">Tous vos devis sont à jour</p>
                  </div>
                ) : (
                  urgentFollowUps.map((quote) => {
                    // Use planned follow-up date if available, otherwise calculate from last follow-up
                    let followUpDate: Date;
                    let isPlanned = false;
                    
                    if (quote.plannedFollowUpDate) {
                      followUpDate = new Date(quote.plannedFollowUpDate);
                      isPlanned = true;
                    } else {
                      followUpDate = quote.lastFollowUpDate ? new Date(quote.lastFollowUpDate) : new Date(quote.sentDate);
                    }
                    
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    followUpDate.setHours(0, 0, 0, 0);
                    
                    const daysDiff = Math.floor((today.getTime() - followUpDate.getTime()) / (1000 * 60 * 60 * 24));
                    const isUrgent = daysDiff > 0;
                    
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
                              {isPlanned ? (
                                isUrgent ? `En retard de ${daysDiff} jour${daysDiff > 1 ? 's' : ''}` : "À relancer aujourd'hui"
                              ) : (
                                isUrgent ? `En retard de ${daysDiff} jour${daysDiff > 1 ? 's' : ''}` : "À relancer aujourd'hui"
                              )}
                            </p>
                            {isPlanned && (
                              <p className="text-xs text-slate-400">
                                Planifiée pour le {new Date(quote.plannedFollowUpDate!).toLocaleDateString('fr-FR')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handlePlanFollowUp(quote)}
                            disabled={updateQuoteMutation.isPending}
                            data-testid={`plan-followup-${quote.id}`}
                          >
                            <Calendar className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant={isUrgent ? "destructive" : "default"}
                            onClick={() => handleFollowUp(quote)}
                            disabled={followUpMutation.isPending}
                            data-testid={`followup-${quote.id}`}
                          >
                            {isUrgent && <AlertTriangle className="w-4 h-4 mr-1" />}
                            {followUpMutation.isPending ? "..." : "Relancer"}
                          </Button>
                        </div>
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
