import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Play, 
  SkipForward,
  CheckCircle,
  Circle,
  Lightbulb,
  Target,
  Rocket
} from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  content: string;
  target: string; // Sélecteur CSS de l'élément à cibler
  position: "top" | "bottom" | "left" | "right" | "center";
  action?: {
    type: "click" | "input" | "wait";
    description: string;
    element?: string;
  };
  category: "basics" | "advanced" | "tips";
}

interface OnboardingTourProps {
  steps?: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  autoStart?: boolean;
  showProgress?: boolean;
}

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Bienvenue dans Optipenn CRM !",
    content: "Découvrons ensemble les fonctionnalités principales qui vont vous faire gagner du temps.",
    target: "body",
    position: "center",
    category: "basics"
  },
  {
    id: "sidebar",
    title: "Navigation principale",
    content: "Utilisez cette barre latérale pour accéder rapidement à toutes les sections : Dashboard, Clients, Devis et Statistiques.",
    target: "[data-tour='sidebar']",
    position: "right",
    category: "basics"
  },
  {
    id: "global-search",
    title: "Recherche globale",
    content: "Trouvez instantanément n'importe quelle information dans votre CRM. Tapez simplement 2 caractères pour commencer.",
    target: "[data-tour='global-search']",
    position: "bottom",
    action: {
      type: "input",
      description: "Essayez de taper quelques caractères"
    },
    category: "basics"
  },
  {
    id: "dashboard-kpi",
    title: "Indicateurs de performance",
    content: "Vos KPIs les plus importants sont affichés ici. Ils se mettent à jour automatiquement.",
    target: "[data-tour='kpi-cards']",
    position: "bottom",
    category: "basics"
  },
  {
    id: "add-client",
    title: "Ajouter un client",
    content: "Cliquez ici pour créer un nouveau client. Le formulaire guide vos étapes avec validation automatique.",
    target: "[data-tour='add-client']",
    position: "left",
    action: {
      type: "click",
      description: "Cliquez pour ouvrir le formulaire"
    },
    category: "basics"
  },
  {
    id: "bulk-operations",
    title: "Actions en masse",
    content: "Sélectionnez plusieurs éléments pour les traiter en une fois : suppression, export, envoi d'emails...",
    target: "[data-tour='bulk-operations']",
    position: "top",
    category: "advanced"
  },
  {
    id: "advanced-filters",
    title: "Filtres avancés",
    content: "Créez des filtres complexes et sauvegardez-les pour retrouver rapidement les données importantes.",
    target: "[data-tour='advanced-filters']",
    position: "bottom",
    category: "advanced"
  },
  {
    id: "export-data", 
    title: "Export de données",
    content: "Exportez vos données en CSV ou PDF avec mise en forme professionnelle, compatible Excel.",
    target: "[data-tour='export-button']",
    position: "top",
    category: "advanced"
  },
  {
    id: "keyboard-shortcuts",
    title: "Raccourcis clavier",
    content: "Utilisez Ctrl+K pour la recherche rapide, Ctrl+N pour créer, Échap pour fermer les modales.",
    target: "body",
    position: "center",
    category: "tips"
  },
  {
    id: "customization",
    title: "Personnalisation",
    content: "Personnalisez votre dashboard en ajoutant/supprimant des widgets selon vos besoins.",
    target: "[data-tour='dashboard-settings']",
    position: "left",
    category: "tips"
  }
];

export default function OnboardingTour({ 
  steps = tourSteps, 
  onComplete, 
  onSkip, 
  autoStart = false,
  showProgress = true 
}: OnboardingTourProps) {
  const [isActive, setIsActive] = useState(autoStart);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [highlightElement, setHighlightElement] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Démarrer le tour
  const startTour = () => {
    setIsActive(true);
    setCurrentStep(0);
    setCompletedSteps(new Set());
  };

  // Arrêter le tour
  const stopTour = () => {
    setIsActive(false);
    setHighlightElement(null);
    if (onComplete) onComplete();
  };

  // Ignorer le tour
  const skipTour = () => {
    setIsActive(false);
    setHighlightElement(null);
    if (onSkip) onSkip();
  };

  // Navigation
  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCompletedSteps(prev => new Set([...Array.from(prev), steps[currentStep].id]));
      setCurrentStep(prev => prev + 1);
    } else {
      setCompletedSteps(prev => new Set([...Array.from(prev), steps[currentStep].id]));
      stopTour();
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Effet pour gérer l'affichage du tour
  useEffect(() => {
    if (!isActive || currentStep >= steps.length) {
      setHighlightElement(null);
      return;
    }

    const step = steps[currentStep];
    const target = document.querySelector(step.target) as HTMLElement;
    
    if (target) {
      setHighlightElement(target);
      
      // Scroll vers l'élément si nécessaire
      target.scrollIntoView({ 
        behavior: "smooth", 
        block: "center",
        inline: "center" 
      });
    }
  }, [isActive, currentStep, steps]);

  // Position du tooltip
  const getTooltipPosition = () => {
    if (!highlightElement || !tooltipRef.current) return {};

    const rect = highlightElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const step = steps[currentStep];

    let style: React.CSSProperties = {
      position: "fixed",
      zIndex: 1001,
    };

    switch (step.position) {
      case "top":
        style.left = rect.left + (rect.width - tooltipRect.width) / 2;
        style.top = rect.top - tooltipRect.height - 10;
        break;
      case "bottom":
        style.left = rect.left + (rect.width - tooltipRect.width) / 2;
        style.top = rect.bottom + 10;
        break;
      case "left":
        style.left = rect.left - tooltipRect.width - 10;
        style.top = rect.top + (rect.height - tooltipRect.height) / 2;
        break;
      case "right":
        style.left = rect.right + 10;
        style.top = rect.top + (rect.height - tooltipRect.height) / 2;
        break;
      case "center":
        style.left = (window.innerWidth - tooltipRect.width) / 2;
        style.top = (window.innerHeight - tooltipRect.height) / 2;
        break;
    }

    // Ajustements pour rester dans la viewport
    if (style.left && style.left < 10) style.left = 10;
    if (style.top && style.top < 10) style.top = 10;
    if (style.left && style.left + tooltipRect.width > window.innerWidth - 10) {
      style.left = window.innerWidth - tooltipRect.width - 10;
    }

    return style;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "basics": return <Circle className="h-4 w-4" />;
      case "advanced": return <Target className="h-4 w-4" />;
      case "tips": return <Lightbulb className="h-4 w-4" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "basics": return "bg-blue-500";
      case "advanced": return "bg-purple-500";
      case "tips": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  // Bouton de démarrage du tour
  if (!isActive) {
    return (
      <Button
        onClick={startTour}
        className="fixed bottom-4 right-4 z-50 shadow-lg flex items-center gap-2"
        size="lg"
      >
        <Rocket className="h-5 w-5" />
        Démarrer le tour guidé
      </Button>
    );
  }

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <>
      {/* Overlay sombre */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/50 z-1000"
        style={{ zIndex: 1000 }}
      >
        {/* Highlight de l'élément */}
        {highlightElement && (
          <div
            className="absolute border-2 border-primary rounded-lg bg-white/10"
            style={{
              left: highlightElement.getBoundingClientRect().left - 4,
              top: highlightElement.getBoundingClientRect().top - 4,
              width: highlightElement.getBoundingClientRect().width + 8,
              height: highlightElement.getBoundingClientRect().height + 8,
            }}
          />
        )}
      </div>

      {/* Tooltip du tour */}
      <Card
        ref={tooltipRef}
        className="w-96 shadow-xl border-2"
        style={getTooltipPosition()}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getCategoryColor(currentStepData.category)}`} />
              <Badge variant="outline" className="text-xs">
                {getCategoryIcon(currentStepData.category)}
                <span className="ml-1 capitalize">{currentStepData.category}</span>
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={skipTour}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <CardTitle className="text-lg">{currentStepData.title}</CardTitle>
          
          {showProgress && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Étape {currentStep + 1} sur {steps.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1" />
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">{currentStepData.content}</p>

          {currentStepData.action && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Play className="h-4 w-4 text-primary" />
                <span className="font-medium">Action suggérée :</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {currentStepData.action.description}
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentStep 
                      ? "bg-primary" 
                      : completedSteps.has(step.id)
                      ? "bg-green-500"
                      : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTour}
                className="text-muted-foreground"
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Ignorer
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={previousStep}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Précédent
              </Button>
              
              <Button
                size="sm"
                onClick={nextStep}
                className="flex items-center gap-1"
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Terminer
                  </>
                ) : (
                  <>
                    Suivant
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// Hook pour gérer l'état du tour
export function useOnboardingTour() {
  const [hasSeenTour, setHasSeenTour] = useState(() => {
    return localStorage.getItem("optipenn-tour-completed") === "true";
  });

  const markTourCompleted = () => {
    localStorage.setItem("optipenn-tour-completed", "true");
    setHasSeenTour(true);
  };

  const resetTour = () => {
    localStorage.removeItem("optipenn-tour-completed");
    setHasSeenTour(false);
  };

  return {
    hasSeenTour,
    markTourCompleted,
    resetTour,
    shouldShowTour: !hasSeenTour,
  };
}