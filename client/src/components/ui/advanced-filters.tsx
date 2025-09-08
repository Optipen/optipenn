import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Filter, X, Save, RotateCcw, Search } from "lucide-react";

interface FilterCriteria {
  field: string;
  operator: string;
  value: string;
  id: string;
}

interface AdvancedFiltersProps {
  onFiltersChange: (filters: FilterCriteria[]) => void;
  availableFields: Array<{ value: string; label: string; type: string }>;
  savedFilters?: Array<{ name: string; filters: FilterCriteria[] }>;
}

const operators = {
  text: [
    { value: "contains", label: "Contient" },
    { value: "equals", label: "Égal à" },
    { value: "starts_with", label: "Commence par" },
    { value: "ends_with", label: "Se termine par" },
  ],
  number: [
    { value: "equals", label: "Égal à" },
    { value: "greater_than", label: "Supérieur à" },
    { value: "less_than", label: "Inférieur à" },
    { value: "between", label: "Entre" },
  ],
  date: [
    { value: "equals", label: "Égal à" },
    { value: "after", label: "Après" },
    { value: "before", label: "Avant" },
    { value: "between", label: "Entre" },
    { value: "last_7_days", label: "7 derniers jours" },
    { value: "last_30_days", label: "30 derniers jours" },
    { value: "this_month", label: "Ce mois" },
    { value: "this_year", label: "Cette année" },
  ],
  select: [
    { value: "equals", label: "Égal à" },
    { value: "in", label: "Dans" },
    { value: "not_in", label: "Pas dans" },
  ],
};

export default function AdvancedFilters({ onFiltersChange, availableFields, savedFilters = [] }: AdvancedFiltersProps) {
  const [filters, setFilters] = useState<FilterCriteria[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filterName, setFilterName] = useState("");

  const addFilter = () => {
    const newFilter: FilterCriteria = {
      id: Date.now().toString(),
      field: "",
      operator: "",
      value: "",
    };
    setFilters([...filters, newFilter]);
  };

  const updateFilter = (id: string, updates: Partial<FilterCriteria>) => {
    const updatedFilters = filters.map(filter =>
      filter.id === id ? { ...filter, ...updates } : filter
    );
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters.filter(f => f.field && f.operator && f.value));
  };

  const removeFilter = (id: string) => {
    const updatedFilters = filters.filter(filter => filter.id !== id);
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters.filter(f => f.field && f.operator && f.value));
  };

  const clearAllFilters = () => {
    setFilters([]);
    onFiltersChange([]);
  };

  const loadSavedFilter = (savedFilter: { name: string; filters: FilterCriteria[] }) => {
    setFilters(savedFilter.filters);
    onFiltersChange(savedFilter.filters);
    setIsOpen(false);
  };

  const getOperatorsForField = (fieldValue: string) => {
    const field = availableFields.find(f => f.value === fieldValue);
    return field ? operators[field.type as keyof typeof operators] || operators.text : operators.text;
  };

  const activeFiltersCount = filters.filter(f => f.field && f.operator && f.value).length;

  if (!isOpen) {
    return (
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtres avancés
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
        
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Effacer tout
          </Button>
        )}

        {savedFilters.length > 0 && (
          <Select onValueChange={(value) => {
            const savedFilter = savedFilters.find(f => f.name === value);
            if (savedFilter) loadSavedFilter(savedFilter);
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtres sauvegardés" />
            </SelectTrigger>
            <SelectContent>
              {savedFilters.map((filter) => (
                <SelectItem key={filter.name} value={filter.name}>
                  {filter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres avancés
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filters.map((filter, index) => (
          <div key={filter.id} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
            {index > 0 && (
              <Badge variant="outline" className="shrink-0">
                ET
              </Badge>
            )}
            
            <Select
              value={filter.field}
              onValueChange={(value) => updateFilter(filter.id, { field: value, operator: "", value: "" })}
            >
              <SelectTrigger className="min-w-[150px]">
                <SelectValue placeholder="Champ" />
              </SelectTrigger>
              <SelectContent>
                {availableFields.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filter.operator}
              onValueChange={(value) => updateFilter(filter.id, { operator: value })}
              disabled={!filter.field}
            >
              <SelectTrigger className="min-w-[130px]">
                <SelectValue placeholder="Opérateur" />
              </SelectTrigger>
              <SelectContent>
                {getOperatorsForField(filter.field).map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Valeur"
              value={filter.value}
              onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
              disabled={!filter.operator}
              className="min-w-[150px]"
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeFilter(filter.id)}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addFilter}
              className="flex items-center gap-1"
            >
              <Filter className="h-4 w-4" />
              Ajouter un filtre
            </Button>
            
            {filters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Réinitialiser
              </Button>
            )}
          </div>

          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nom du filtre"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="w-40"
              />
              <Button
                size="sm"
                onClick={() => {
                  // Ici on sauvegarderait le filtre
                  console.log("Sauvegarde filtre:", { name: filterName, filters });
                  setFilterName("");
                }}
                disabled={!filterName.trim()}
              >
                <Save className="h-4 w-4 mr-1" />
                Sauvegarder
              </Button>
            </div>
          )}
        </div>

        {activeFiltersCount > 0 && (
          <>
            <Separator />
            <div className="text-sm text-muted-foreground">
              {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif{activeFiltersCount > 1 ? 's' : ''}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}