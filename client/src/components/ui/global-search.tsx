import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  User, 
  FileText, 
  TrendingUp, 
  Clock, 
  ExternalLink,
  Loader2,
  X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SearchResult {
  id: string;
  type: "client" | "quote" | "user";
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: Record<string, any>;
  url?: string;
}

interface GlobalSearchProps {
  onResultSelect?: (result: SearchResult) => void;
  placeholder?: string;
  className?: string;
}

const resultTypeConfig = {
  client: {
    icon: User,
    label: "Client",
    color: "bg-blue-500",
  },
  quote: {
    icon: FileText,
    label: "Devis",
    color: "bg-green-500",
  },
  user: {
    icon: TrendingUp,
    label: "Utilisateur",
    color: "bg-purple-500",
  },
};

export default function GlobalSearch({ onResultSelect, placeholder = "Rechercher partout...", className = "" }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Recherche avec debounce
  const { data: results = [], isLoading } = useQuery<SearchResult[]>({
    queryKey: ["/api/search/global", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      return apiRequest("GET", `/api/search/global?q=${encodeURIComponent(query)}`);
    },
    enabled: query.length >= 2,
  });

  // Grouper les résultats par type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  // Navigation au clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            handleResultSelect(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Fermer lors du clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(0);
    setIsOpen(value.length >= 2);
  };

  const handleResultSelect = (result: SearchResult) => {
    if (onResultSelect) {
      onResultSelect(result);
    } else if (result.url) {
      window.location.href = result.url;
    }
    setIsOpen(false);
    setQuery("");
  };

  const clearSearch = () => {
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, "gi");
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div className={`relative ${className}`} ref={resultsRef}>
      {/* Input de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Résultats de recherche */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-lg border">
          <CardContent className="p-0">
            {query.length < 2 && (
              <div className="p-4 text-center text-muted-foreground">
                Tapez au moins 2 caractères pour rechercher
              </div>
            )}

            {query.length >= 2 && results.length === 0 && !isLoading && (
              <div className="p-4 text-center text-muted-foreground">
                Aucun résultat trouvé pour "{query}"
              </div>
            )}

            {results.length > 0 && (
              <ScrollArea className="max-h-96">
                {Object.entries(groupedResults).map(([type, typeResults], groupIndex) => {
                  const TypeIcon = resultTypeConfig[type as keyof typeof resultTypeConfig]?.icon || Search;
                  const typeLabel = resultTypeConfig[type as keyof typeof resultTypeConfig]?.label || type;
                  const typeColor = resultTypeConfig[type as keyof typeof resultTypeConfig]?.color || "bg-gray-500";

                  return (
                    <div key={type}>
                      {groupIndex > 0 && <Separator />}
                      
                      {/* En-tête de groupe */}
                      <div className="flex items-center gap-2 px-4 py-2 bg-muted/50">
                        <div className={`w-2 h-2 rounded-full ${typeColor}`} />
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          {typeLabel} ({typeResults.length})
                        </span>
                      </div>

                      {/* Résultats du groupe */}
                      {typeResults.map((result, index) => {
                        const globalIndex = results.findIndex(r => r.id === result.id);
                        const isSelected = globalIndex === selectedIndex;

                        return (
                          <div
                            key={result.id}
                            className={`px-4 py-3 cursor-pointer transition-colors border-l-2 ${
                              isSelected 
                                ? "bg-muted border-l-primary" 
                                : "border-l-transparent hover:bg-muted/50"
                            }`}
                            onClick={() => handleResultSelect(result)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-medium truncate">
                                    {highlightMatch(result.title, query)}
                                  </h4>
                                  {result.metadata?.status && (
                                    <Badge variant="outline" className="text-xs">
                                      {result.metadata.status}
                                    </Badge>
                                  )}
                                </div>
                                
                                {result.subtitle && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {highlightMatch(result.subtitle, query)}
                                  </p>
                                )}
                                
                                {result.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {highlightMatch(result.description, query)}
                                  </p>
                                )}

                                {result.metadata && (
                                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    {result.metadata.date && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {result.metadata.date}
                                      </div>
                                    )}
                                    {result.metadata.amount && (
                                      <div className="font-medium">
                                        {result.metadata.amount}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <ExternalLink className="h-3 w-3 text-muted-foreground ml-2 flex-shrink-0" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </ScrollArea>
            )}

            {results.length > 0 && (
              <>
                <Separator />
                <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30">
                  Utilisez ↑↓ pour naviguer, Entrée pour sélectionner, Échap pour fermer
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}