import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, Plus, Edit, Eye, Trash2, Download, Mail, Archive } from "lucide-react";
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

  // Gestion des sélections en masse
  const bulkSelection = useBulkSelection([], (client: Client) => client.id);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients", { search, page, pageSize, filters: activeFilters }],
  });

  // Mettre à jour la sélection quand les clients changent
  useEffect(() => {
    bulkSelection.setSelectedItems(
      bulkSelection.selectedItems.filter(id => 
        clients.some(client => client.id === id)
      )
    );
  }, [clients]);

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

        {/* Clients Table */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Clients</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <Checkbox
                      checked={bulkSelection.allSelected}
                      onCheckedChange={bulkSelection.selectAll}
                      className={bulkSelection.someSelected ? "indeterminate" : ""}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Entreprise
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200" data-testid="clients-table">
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      {search ? "Aucun client trouvé pour cette recherche" : "Aucun client ajouté"}
                    </td>
                  </tr>
                ) : (
                  clients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Checkbox
                          checked={bulkSelection.isSelected(client.id)}
                          onCheckedChange={() => bulkSelection.selectItem(client.id)}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {getInitials(client.name)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-slate-900" data-testid={`client-name-${client.id}`}>
                              {client.name}
                            </div>
                            <div className="text-sm text-slate-500">{client.position}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900" data-testid={`client-company-${client.id}`}>
                        {client.company}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900" data-testid={`client-email-${client.id}`}>
                          {client.email}
                        </div>
                        {client.phone && (
                          <div className="text-sm text-slate-500" data-testid={`client-phone-${client.id}`}>
                            {client.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className="bg-green-100 text-green-800">Actif</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-700"
                            onClick={() => handleOpenEdit(client)}
                            data-testid={`button-edit-${client.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-slate-600 hover:text-slate-700"
                            data-testid={`button-view-${client.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteClient(client.id, client.name)}
                            disabled={deleteClientMutation.isPending}
                            data-testid={`button-delete-${client.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
        
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
