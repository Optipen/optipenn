import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Eye, 
  Trash2, 
  Download, 
  Mail, 
  Archive, 
  Phone, 
  MapPin,
  Building,
  MoreVertical,
  Users
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AddClientModal from "@/components/modals/add-client-modal";
import EditClientModal from "@/components/modals/edit-client-modal";
import AdvancedFilters from "@/components/ui/advanced-filters";
import BulkOperations, { useBulkSelection, commonBulkActions } from "@/components/ui/bulk-operations";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  // useEffect(() => {
  //   bulkSelection.setSelectedItems(
  //     bulkSelection.selectedItems.filter(id => 
  //       clients.some(client => client.id === id)
  //     )
  //   );
  // }, [clients]);

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

  const getCompanyInitials = (company: string) => {
    return company
      .split(" ")
      .map(word => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Client Card Component
  const ClientCard = ({ client }: { client: Client }) => (
    <Card className="hover:shadow-lg transition-all duration-200 border-0 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {/* <Checkbox
              checked={bulkSelection.isSelected(client.id)}
              onCheckedChange={() => bulkSelection.selectItem(client.id)}
              className="mt-1"
            /> */}
            <div className="flex items-center space-x-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${client.name}`} />
                <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold">
                  {getInitials(client.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">{client.name}</h3>
                <p className="text-sm text-gray-600">{client.position}</p>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleOpenEdit(client)}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Eye className="h-4 w-4 mr-2" />
                Voir détails
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDeleteClient(client.id, client.name)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Company Information */}
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Building className="w-4 h-4 text-gray-600" />
            </div>
            <span className="font-medium text-gray-900">{client.company}</span>
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Mail className="w-4 h-4" />
            <a href={`mailto:${client.email}`} className="hover:text-blue-600 transition-colors">
              {client.email}
            </a>
          </div>
          {client.phone && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Phone className="w-4 h-4" />
              <a href={`tel:${client.phone}`} className="hover:text-blue-600 transition-colors">
                {client.phone}
              </a>
            </div>
          )}
        </div>

        {/* Status and Actions */}
        <div className="flex items-center justify-between">
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Actif
          </Badge>
          <div className="flex space-x-1">
            <Button 
              variant="ghost" 
              size="sm"
              className="h-8 w-8 p-0 text-gray-600 hover:text-blue-600"
              onClick={() => window.open(`mailto:${client.email}`)}
            >
              <Mail className="h-4 w-4" />
            </Button>
            {client.phone && (
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 w-8 p-0 text-gray-600 hover:text-green-600"
                onClick={() => window.open(`tel:${client.phone}`)}
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
    <div className="flex-1 overflow-auto bg-gray-50" data-testid="clients-page">
      <div className="p-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border-0 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Gestion des Clients
              </h2>
              <p className="text-gray-600 mt-1">Gérez votre portefeuille client ({clients.length} clients)</p>
            </div>
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              data-testid="button-add-client"
              data-tour="add-client"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Client
            </Button>
          </div>
        </div>

        {/* Filtres avancés - Temporarily disabled */}
        {/* <div className="mb-6" data-tour="advanced-filters">
          <AdvancedFilters
            availableFields={clientFilterFields}
            onFiltersChange={setActiveFilters}
            savedFilters={[
              { name: "Clients récents", filters: [{ id: "1", field: "createdAt", operator: "last_30_days", value: "" }] },
              { name: "Clients VIP", filters: [{ id: "2", field: "status", operator: "equals", value: "VIP" }] },
            ]}
          />
        </div> */}

        {/* Search and Bulk Operations */}
        <div className="bg-white rounded-xl shadow-sm border-0 p-6 mb-6">
          <div className="flex flex-col space-y-4">
            {/* Search */}
            <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Rechercher par nom ou entreprise..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    data-testid="input-search-clients"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  className="border-gray-200 text-gray-700 hover:bg-gray-50"
                  data-tour="export-button"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exporter
                </Button>
              </div>
            </div>

            {/* Bulk Operations - Temporarily disabled */}
            {/* <div data-tour="bulk-operations">
              <BulkOperations
                items={clients}
                selectedItems={bulkSelection.selectedItems}
                onSelectionChange={bulkSelection.setSelectedItems}
                onBulkAction={handleBulkAction}
                getItemId={(client) => client.id}
                getItemLabel={(client) => client.name}
                actions={clientBulkActions}
                className=""
              />
            </div> */}
          </div>
        </div>

        {/* Clients Grid */}
        {clients.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {search ? "Aucun client trouvé" : "Aucun client ajouté"}
              </h3>
              <p className="text-gray-600 mb-4">
                {search 
                  ? "Essayez de modifier vos critères de recherche" 
                  : "Commencez par ajouter votre premier client"
                }
              </p>
              {!search && (
                <Button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un client
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-testid="clients-grid">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {clients.length > 0 && (
          <div className="flex justify-center mt-8">
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(Math.max(1, page - 1))} 
                disabled={page === 1}
                className="border-gray-200"
              >
                Précédent
              </Button>
              <span className="px-4 py-2 text-sm text-gray-600 bg-white rounded-md border border-gray-200">
                Page {page}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(page + 1)} 
                disabled={clients.length < pageSize}
                className="border-gray-200"
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
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
