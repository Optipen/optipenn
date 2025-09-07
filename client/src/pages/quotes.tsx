import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Plus, Edit, Eye, Trash2, Send, AlertTriangle, Calendar } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AddQuoteModal from "@/components/modals/add-quote-modal";
import type { QuoteWithClient } from "@shared/schema";

export default function Quotes() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast } = useToast();

  const { data: quotes = [], isLoading } = useQuery<QuoteWithClient[]>({
    queryKey: ["/api/quotes", { status: statusFilter === "all" ? "" : statusFilter, page, pageSize }],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/statistics"],
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/quotes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      toast({
        title: "Succès",
        description: "Devis supprimé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la suppression du devis",
        variant: "destructive",
      });
    },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<QuoteWithClient, "plannedFollowUpDate">> }) =>
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

  const followUpMutation = useMutation({
    mutationFn: ({ quoteId, comment }: { quoteId: string; comment: string }) =>
      apiRequest("POST", `/api/quotes/${quoteId}/follow-up`, {
        date: new Date().toISOString().split('T')[0],
        comment,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-follow-ups"] });
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

  const handleDeleteQuote = (id: string, reference: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le devis "${reference}" ?`)) {
      deleteQuoteMutation.mutate(id);
    }
  };

  const handleFollowUp = (quoteId: string) => {
    const comment = prompt("Commentaire de relance (optionnel) :");
    if (comment !== null) {
      followUpMutation.mutate({ quoteId, comment: comment || "Relance automatique" });
    }
  };

  const handlePlanFollowUp = (quoteId: string, current?: string | null) => {
    const input = prompt("Date de relance planifiée (YYYY-MM-DD)", current || "");
    if (input === null) return;
    const trimmed = input.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      toast({ title: "Format invalide", description: "Utilisez YYYY-MM-DD", variant: "destructive" });
      return;
    }
    updateQuoteMutation.mutate({ id: quoteId, updates: { plannedFollowUpDate: trimmed } as any });
  };

  const handleExportCSV = () => {
    window.open("/api/export/quotes", "_blank");
  };

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

  const isOverdue = (quote: QuoteWithClient) => {
    if (quote.status === "Accepté" || quote.status === "Refusé") return false;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // If planned date exists, overdue = today > planned
    if (quote.plannedFollowUpDate) {
      const planned = new Date(quote.plannedFollowUpDate);
      planned.setHours(0, 0, 0, 0);
      return todayStart.getTime() > planned.getTime();
    }

    // Else fallback: >7 jours depuis dernière relance ou date d'envoi
    const lastDate = quote.lastFollowUpDate ? new Date(quote.lastFollowUpDate) : new Date(quote.sentDate);
    const daysPassed = Math.floor((todayStart.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysPassed > 7;
  };

  const getPlannedFollowUpBadge = (quote: QuoteWithClient) => {
    if (!quote.plannedFollowUpDate) return <span className="text-slate-400">—</span>;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const planned = new Date(quote.plannedFollowUpDate);
    planned.setHours(0, 0, 0, 0);

    let className = "bg-green-100 text-green-800";
    if (planned.getTime() < today.getTime()) className = "bg-red-100 text-red-800";
    else if (planned.getTime() === today.getTime()) className = "bg-amber-100 text-amber-800";

    return (
      <Badge className={className} data-testid={`quote-planned-followup-${quote.id}`}>
        {planned.toLocaleDateString('fr-FR')}
      </Badge>
    );
  };

  // Filter quotes based on search
  const filteredQuotes = quotes.filter(quote => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      quote.reference.toLowerCase().includes(searchLower) ||
      quote.client.name.toLowerCase().includes(searchLower) ||
      quote.client.company.toLowerCase().includes(searchLower) ||
      quote.description.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-8">
        <div className="animate-pulse">
          <div className="h-8 w-64 bg-slate-200 rounded mb-4"></div>
          <div className="h-40 bg-slate-200 rounded mb-6"></div>
          <div className="h-96 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto" data-testid="quotes-page">
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900" data-testid="page-title">
              Gestion des Devis
            </h2>
            <p className="text-slate-500 mt-1">Suivez et gérez vos devis et relances</p>
          </div>
          <Button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2"
            data-testid="button-add-quote"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Devis</span>
          </Button>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Rechercher par client ou référence..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-quotes"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="Envoyé">Envoyé</SelectItem>
                    <SelectItem value="En attente">En attente</SelectItem>
                    <SelectItem value="Relancé">Relancé</SelectItem>
                    <SelectItem value="Accepté">Accepté</SelectItem>
                    <SelectItem value="Refusé">Refusé</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  onClick={handleExportCSV}
                  className="flex items-center space-x-2"
                  data-testid="button-export-csv"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-center mt-4">
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Précédent</Button>
          <span className="mx-3 text-sm text-slate-600">Page {page}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={quotes.length < pageSize}>Suivant</Button>
        </div>

        {/* Status Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6" data-testid="status-overview">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600" data-testid="status-count-envoyé">
                {stats?.byStatus?.["Envoyé"] || 0}
              </div>
              <div className="text-sm text-slate-500">Envoyés</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600" data-testid="status-count-en-attente">
                {stats?.byStatus?.["En attente"] || 0}
              </div>
              <div className="text-sm text-slate-500">En attente</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600" data-testid="status-count-relancé">
                {stats?.byStatus?.["Relancé"] || 0}
              </div>
              <div className="text-sm text-slate-500">Relancés</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600" data-testid="status-count-accepté">
                {stats?.byStatus?.["Accepté"] || 0}
              </div>
              <div className="text-sm text-slate-500">Acceptés</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600" data-testid="status-count-refusé">
                {stats?.byStatus?.["Refusé"] || 0}
              </div>
              <div className="text-sm text-slate-500">Refusés</div>
            </CardContent>
          </Card>
        </div>

        {/* Quotes Table */}
        <Card>
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Liste des Devis</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Référence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Relance prévue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200" data-testid="quotes-table">
                {filteredQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      {search ? "Aucun devis trouvé pour cette recherche" : "Aucun devis ajouté"}
                    </td>
                  </tr>
                ) : (
                  filteredQuotes.map((quote) => {
                    const overdue = isOverdue(quote);
                    return (
                      <tr 
                        key={quote.id} 
                        className={`transition-colors ${
                          overdue ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900" data-testid={`quote-reference-${quote.id}`}>
                          {quote.reference}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900" data-testid={`quote-client-${quote.id}`}>
                            {quote.client.company}
                          </div>
                          <div className="text-sm text-slate-500">{quote.client.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-900" data-testid={`quote-description-${quote.id}`}>
                            {quote.description}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900" data-testid={`quote-amount-${quote.id}`}>
                          €{parseFloat(quote.amount).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900" data-testid={`quote-date-${quote.id}`}>
                          {new Date(quote.sentDate).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getPlannedFollowUpBadge(quote)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getStatusVariant(quote.status)} data-testid={`quote-status-${quote.id}`}>
                            {quote.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            {quote.status !== "Accepté" && quote.status !== "Refusé" && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-amber-600 hover:text-amber-700"
                                onClick={() => handlePlanFollowUp(quote.id, quote.plannedFollowUpDate as any)}
                                disabled={updateQuoteMutation.isPending}
                                data-testid={`button-planfollowup-${quote.id}`}
                              >
                                <Calendar className="w-4 h-4" />
                              </Button>
                            )}
                            {quote.status !== "Accepté" && quote.status !== "Refusé" && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className={`${overdue ? "text-red-600 hover:text-red-700" : "text-blue-600 hover:text-blue-700"}`}
                                onClick={() => handleFollowUp(quote.id)}
                                disabled={followUpMutation.isPending}
                                data-testid={`button-followup-${quote.id}`}
                              >
                                {overdue ? <AlertTriangle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-blue-600 hover:text-blue-700"
                              data-testid={`button-edit-${quote.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-slate-600 hover:text-slate-700"
                              data-testid={`button-view-${quote.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteQuote(quote.id, quote.reference)}
                              disabled={deleteQuoteMutation.isPending}
                              data-testid={`button-delete-${quote.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <AddQuoteModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal}
      />
    </div>
  );
}
