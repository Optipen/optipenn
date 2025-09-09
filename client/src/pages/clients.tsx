import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, Plus, Edit, Eye, Trash2, Download, Mail, Archive, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AddClientModal from "@/components/modals/add-client-modal";
import EditClientModal from "@/components/modals/edit-client-modal";
import AdvancedFilters from "@/components/ui/advanced-filters";
import BulkOperations, { useBulkSelection, commonBulkActions } from "@/components/ui/bulk-operations";
import type { Client } from "@shared/schema";

// Configuration des filtres avancés pour les clients
const clientFilterFields = [
  { value: "name", label: "Nom", type: "text" },
  { value: "email", label: "Email", type: "text" },
  { value: "phone", label: "Téléphone", type: "text" },
  { value: "company", label: "Entreprise", type: "text" },
  { value: "createdAt", label: "Date de création", type: "date" },
  { value: "status", label: "Statut", type: "select" },
];

// Actions en masse pour les clients
const clientBulkActions = [
  commonBulkActions.export,
  {
    id: "send_newsletter",
    label: "Newsletter",
    icon: <Mail className="h-4 w-4" />,
    variant: "secondary" as const,
  },
  commonBulkActions.archive,
  commonBulkActions.delete,
];

export default function Clients() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeFilters, setActiveFilters] = useState<any[]>([]);
  const { toast } = useToast();

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients", { search, page, pageSize, filters: activeFilters }],
  });

  // Gestion des sélections en masse
  const bulkSelection = useBulkSelection(clients, (client: Client) => client.id);

  const deleteClientMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Succès",
        description: "Client supprimé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la suppression du client",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClient = (id: string, name: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le client "${name}" ?`)) {
      deleteClientMutation.mutate(id);
    }
  };

  const handleBulkAction = async (actionId: string, selectedIds: string[]) => {
    switch (actionId) {
      case "delete":
        // Suppression en masse avec confirmation déjà gérée par BulkOperations
        try {
          await Promise.all(selectedIds.map(id => 
            apiRequest("DELETE", `/api/clients/${id}`)
          ));
          queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
          bulkSelection.clearSelection();
          toast({
            title: "Succès",
            description: `${selectedIds.length} client(s) supprimé(s)`,
          });
        } catch (error) {
          toast({
            title: "Erreur",
            description: "Erreur lors de la suppression",
            variant: "destructive",
          });
        }
        break;

      case "export":
        try {
          const response = await fetch(`/api/clients/export?ids=${selectedIds.join(',')}`);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `clients-${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          toast({
            title: "Succès",
            description: `${selectedIds.length} client(s) exporté(s)`,
          });
        } catch (error) {
          toast({
            title: "Erreur",
            description: "Erreur lors de l'export",
            variant: "destructive",
          });
        }
        break;

      case "send_newsletter":
        toast({
          title: "Newsletter",
          description: `Newsletter envoyée à ${selectedIds.length} client(s)`,
        });
        break;

      case "archive":
        toast({
          title: "Succès",
          description: `${selectedIds.length} client(s) archivé(s)`,
        });
        break;
    }
  };

  const handleOpenEdit = (client: Client) => {
    setSelectedClient(client);
    setShowEditModal(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Pas de calcul de relance prévue dans Clients

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
    <div className="flex-1 overflow-auto" data-testid="clients-page">
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900" data-testid="page-title">
              Gestion des Clients
            </h2>
            <p className="text-slate-500 mt-1">Gérez votre portefeuille client</p>
          </div>
          <Button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2"
            data-testid="button-add-client"
            data-tour="add-client"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Client</span>
          </Button>
        </div>

        {/* Filtres avancés */}
        <div data-tour="advanced-filters">
          <AdvancedFilters
            availableFields={clientFilterFields}
            onFiltersChange={setActiveFilters}
            savedFilters={[
              { name: "Clients récents", filters: [{ id: "1", field: "createdAt", operator: "last_30_days", value: "" }] },
              { name: "Clients VIP", filters: [{ id: "2", field: "status", operator: "equals", value: "VIP" }] },
            ]}
          />
        </div>

        {/* Actions en masse */}
        <div data-tour="bulk-operations">
          <BulkOperations
            items={clients}
            selectedItems={bulkSelection.selectedItems}
            onSelectionChange={bulkSelection.setSelectedItems}
            onBulkAction={handleBulkAction}
            getItemId={(client) => client.id}
            getItemLabel={(client) => client.name}
            actions={clientBulkActions}
            className="mb-6"
          />
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Rechercher par nom ou entreprise..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-clients"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Button 
                  variant="outline" 
                  className="flex items-center space-x-2"
                  data-tour="export-button"
                >
                  <Download className="w-4 h-4" />
                  <span>Exporter</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clients Cards Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Liste des Clients</h3>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={bulkSelection.allSelected}
                onCheckedChange={bulkSelection.selectAll}
                className={bulkSelection.someSelected ? "indeterminate" : ""}
              />
              <span className="text-sm text-slate-600">Sélectionner tout</span>
            </div>
          </div>
          
          {clients.length === 0 ? (
            <Card className="p-12">
              <div className="text-center text-slate-500">
                <Users className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  {search ? "Aucun client trouvé" : "Aucun client ajouté"}
                </h3>
                <p className="text-slate-500">
                  {search 
                    ? "Essayez de modifier vos critères de recherche" 
                    : "Commencez par ajouter votre premier client"}
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="clients-table">
              {clients.map((client) => (
                <Card key={client.id} className="group hover:shadow-lg transition-all duration-200 border border-slate-200 hover:border-slate-300">
                  <CardContent className="p-6">
                    {/* Header avec checkbox et actions */}
                    <div className="flex items-start justify-between mb-4">
                      <Checkbox
                        checked={bulkSelection.isSelected(client.id)}
                        onCheckedChange={() => bulkSelection.selectItem(client.id)}
                        className="mt-1"
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="sr-only">Ouvrir le menu</span>
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="1"/>
                              <circle cx="12" cy="5" r="1"/>
                              <circle cx="12" cy="19" r="1"/>
                            </svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(client)} data-testid={`button-edit-${client.id}`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem data-testid={`button-view-${client.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Voir les détails
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDeleteClient(client.id, client.name)}
                            disabled={deleteClientMutation.isPending}
                            data-testid={`button-delete-${client.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Avatar et informations principales */}
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <span className="text-lg font-semibold text-white">
                            {getInitials(client.name)}
                          </span>
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-semibold text-slate-900 truncate" data-testid={`client-name-${client.id}`}>
                          {client.name}
                        </h4>
                        <p className="text-sm text-slate-500 truncate">{client.position}</p>
                      </div>
                    </div>

                    {/* Informations de l'entreprise */}
                    <div className="mb-4">
                      <div className="flex items-center text-sm text-slate-600 mb-1">
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 21h18"/>
                          <path d="M5 21V7l8-4v18"/>
                          <path d="M19 21V11l-6-4"/>
                        </svg>
                        <span className="font-medium" data-testid={`client-company-${client.id}`}>
                          {client.company}
                        </span>
                      </div>
                    </div>

                    {/* Informations de contact */}
                    <div className="space-y-2 mb-4">
                      <a 
                        href={`mailto:${client.email}`}
                        className="flex items-center text-sm text-blue-600 hover:text-blue-700 transition-colors"
                        data-testid={`client-email-${client.id}`}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        <span className="truncate">{client.email}</span>
                      </a>
                      {client.phone && (
                        <a 
                          href={`tel:${client.phone}`}
                          className="flex items-center text-sm text-blue-600 hover:text-blue-700 transition-colors"
                          data-testid={`client-phone-${client.id}`}
                        >
                          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                          </svg>
                          <span>{client.phone}</span>
                        </a>
                      )}
                    </div>

                    {/* Statut */}
                    <div className="flex items-center justify-between">
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                        Actif
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {client.createdAt ? new Date(client.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex justify-center mt-4">
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Précédent</Button>
          <span className="mx-3 text-sm text-slate-600">Page {page}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={clients.length < pageSize}>Suivant</Button>
        </div>
      </div>

      <AddClientModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal}
      />
      <EditClientModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        client={selectedClient}
      />
    </div>
  );
}
