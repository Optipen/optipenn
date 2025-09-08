import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Trash2, 
  Edit, 
  Download, 
  Send, 
  Archive, 
  MoreHorizontal,
  CheckSquare,
  Square,
  ChevronDown
} from "lucide-react";

interface BulkAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant?: "default" | "destructive" | "secondary" | "outline";
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
}

interface BulkOperationsProps<T> {
  items: T[];
  selectedItems: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onBulkAction: (actionId: string, selectedIds: string[]) => void;
  getItemId: (item: T) => string;
  getItemLabel: (item: T) => string;
  actions: BulkAction[];
  className?: string;
}

export default function BulkOperations<T>({
  items,
  selectedItems,
  onSelectionChange,
  onBulkAction,
  getItemId,
  getItemLabel,
  actions,
  className = "",
}: BulkOperationsProps<T>) {
  const [confirmAction, setConfirmAction] = useState<{
    action: BulkAction;
    selectedIds: string[];
  } | null>(null);

  const allSelected = items.length > 0 && selectedItems.length === items.length;
  const someSelected = selectedItems.length > 0 && selectedItems.length < items.length;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(items.map(getItemId));
    }
  };

  const handleItemSelect = (itemId: string) => {
    if (selectedItems.includes(itemId)) {
      onSelectionChange(selectedItems.filter(id => id !== itemId));
    } else {
      onSelectionChange([...selectedItems, itemId]);
    }
  };

  const handleBulkAction = (action: BulkAction) => {
    if (action.requiresConfirmation) {
      setConfirmAction({ action, selectedIds: selectedItems });
    } else {
      onBulkAction(action.id, selectedItems);
    }
  };

  const executeConfirmedAction = () => {
    if (confirmAction) {
      onBulkAction(confirmAction.action.id, confirmAction.selectedIds);
      setConfirmAction(null);
    }
  };

  const getSelectedItemsPreview = () => {
    if (selectedItems.length <= 3) {
      return selectedItems
        .map(id => {
          const item = items.find(item => getItemId(item) === id);
          return item ? getItemLabel(item) : id;
        })
        .join(", ");
    }
    return `${selectedItems.length} éléments sélectionnés`;
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className={`bg-background border rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-between">
          {/* Selection Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Sélectionner tout"
                className={someSelected ? "indeterminate" : ""}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Sélection</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onSelectionChange(items.map(getItemId))}>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Tout sélectionner
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSelectionChange([])}>
                    <Square className="mr-2 h-4 w-4" />
                    Tout désélectionner
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {selectedItems.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  {selectedItems.length} sur {items.length}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {getSelectedItemsPreview()}
                </span>
              </div>
            )}
          </div>

          {/* Bulk Actions */}
          {selectedItems.length > 0 && (
            <div className="flex items-center gap-2">
              {/* Primary Actions */}
              {actions.slice(0, 3).map((action) => (
                <Button
                  key={action.id}
                  variant={action.variant || "outline"}
                  size="sm"
                  onClick={() => handleBulkAction(action)}
                  className="flex items-center gap-1"
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}

              {/* More Actions */}
              {actions.length > 3 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Plus d'actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {actions.slice(3).map((action) => (
                      <DropdownMenuItem
                        key={action.id}
                        onClick={() => handleBulkAction(action)}
                        className="flex items-center gap-2"
                      >
                        {action.icon}
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>

        {/* Selection Summary */}
        {selectedItems.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="text-xs text-muted-foreground">
              Actions disponibles : {actions.map(a => a.label).join(", ")}
            </div>
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action.confirmationTitle || "Confirmer l'action"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action.confirmationDescription ||
                `Êtes-vous sûr de vouloir effectuer cette action sur ${confirmAction?.selectedIds.length} élément(s) ?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={executeConfirmedAction}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Hook pour gérer facilement les sélections
export function useBulkSelection<T>(items: T[], getItemId: (item: T) => string) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const selectItem = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const selectAll = () => {
    setSelectedItems(items.map(getItemId));
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  const isSelected = (itemId: string) => selectedItems.includes(itemId);

  return {
    selectedItems,
    setSelectedItems,
    selectItem,
    selectAll,
    clearSelection,
    isSelected,
    selectedCount: selectedItems.length,
    allSelected: items.length > 0 && selectedItems.length === items.length,
    someSelected: selectedItems.length > 0 && selectedItems.length < items.length,
  };
}

// Exemples d'actions prédéfinies
export const commonBulkActions = {
  delete: {
    id: "delete",
    label: "Supprimer",
    icon: <Trash2 className="h-4 w-4" />,
    variant: "destructive" as const,
    requiresConfirmation: true,
    confirmationTitle: "Supprimer les éléments",
    confirmationDescription: "Cette action est irréversible. Tous les éléments sélectionnés seront supprimés définitivement.",
  },
  export: {
    id: "export",
    label: "Exporter",
    icon: <Download className="h-4 w-4" />,
    variant: "outline" as const,
  },
  archive: {
    id: "archive",
    label: "Archiver",
    icon: <Archive className="h-4 w-4" />,
    variant: "outline" as const,
    requiresConfirmation: true,
    confirmationTitle: "Archiver les éléments",
    confirmationDescription: "Les éléments archivés ne seront plus visibles dans la liste principale.",
  },
  sendEmail: {
    id: "send_email",
    label: "Envoyer email",
    icon: <Send className="h-4 w-4" />,
    variant: "outline" as const,
  },
};