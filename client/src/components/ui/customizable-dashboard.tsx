import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Settings, 
  Eye, 
  EyeOff, 
  Plus, 
  GripVertical,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Euro,
  Calendar,
  Target,
  AlertTriangle,
  BarChart3,
  PieChart,
  Activity
} from "lucide-react";

interface Widget {
  id: string;
  type: string;
  title: string;
  size: "small" | "medium" | "large";
  position: { x: number; y: number };
  visible: boolean;
  config?: Record<string, any>;
}

interface DashboardStats {
  totalClients: number;
  totalQuotes: number;
  totalRevenue: number;
  conversionRate: number;
  pendingFollowUps: number;
  monthlyGrowth: number;
  averageQuoteValue: number;
  topPerformers: Array<{ name: string; value: number }>;
}

interface CustomizableDashboardProps {
  stats: DashboardStats;
  onStatsRefresh?: () => void;
}

const widgetTypes = {
  kpi_card: {
    name: "Carte KPI",
    icon: Activity,
    defaultSize: "small" as const,
    component: KpiCard,
  },
  revenue_chart: {
    name: "Graphique CA",
    icon: BarChart3,
    defaultSize: "large" as const,
    component: RevenueChart,
  },
  conversion_funnel: {
    name: "Entonnoir Conversion",
    icon: PieChart,
    defaultSize: "medium" as const,
    component: ConversionFunnel,
  },
  pending_actions: {
    name: "Actions en Attente",
    icon: AlertTriangle,
    defaultSize: "medium" as const,
    component: PendingActions,
  },
  top_performers: {
    name: "Top Performers",
    icon: TrendingUp,
    defaultSize: "medium" as const,
    component: TopPerformers,
  },
};

// Composants de widgets
function KpiCard({ widget, stats }: { widget: Widget; stats: DashboardStats }) {
  const kpiConfig = {
    clients: { 
      label: "Clients Total", 
      value: stats.totalClients, 
      icon: Users, 
      color: "text-blue-600",
      trend: "+12%"
    },
    quotes: { 
      label: "Devis Total", 
      value: stats.totalQuotes, 
      icon: FileText, 
      color: "text-green-600",
      trend: "+8%"
    },
    revenue: { 
      label: "CA Total", 
      value: `${stats.totalRevenue.toLocaleString()}€`, 
      icon: Euro, 
      color: "text-purple-600",
      trend: "+15%"
    },
    conversion: { 
      label: "Taux Conversion", 
      value: `${stats.conversionRate}%`, 
      icon: Target, 
      color: "text-orange-600",
      trend: "+3%"
    },
  };

  const kpiType = widget.config?.kpiType || "clients";
  const kpi = kpiConfig[kpiType as keyof typeof kpiConfig];
  const KpiIcon = kpi.icon;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-bold">{kpi.value}</p>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">{kpi.trend}</span> vs mois dernier
            </p>
          </div>
          <KpiIcon className={`h-8 w-8 ${kpi.color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueChart({ widget, stats }: { widget: Widget; stats: DashboardStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Évolution du Chiffre d'Affaires
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          [Graphique CA - Intégration Recharts]
        </div>
      </CardContent>
    </Card>
  );
}

function ConversionFunnel({ widget, stats }: { widget: Widget; stats: DashboardStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          Entonnoir de Conversion
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm">Prospects</span>
            <span className="font-semibold">150</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Devis envoyés</span>
            <span className="font-semibold">89</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Clients convertis</span>
            <span className="font-semibold">27</span>
          </div>
          <div className="pt-2 text-center">
            <Badge variant="secondary">
              Taux: {stats.conversionRate}%
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingActions({ widget, stats }: { widget: Widget; stats: DashboardStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Actions en Attente
          <Badge variant="destructive">{stats.pendingFollowUps}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Relances à faire</span>
            <Badge variant="outline">{stats.pendingFollowUps}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Devis en attente</span>
            <Badge variant="outline">12</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Rappels planifiés</span>
            <Badge variant="outline">8</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopPerformers({ widget, stats }: { widget: Widget; stats: DashboardStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-500" />
          Top Performers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stats.topPerformers.map((performer, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  index === 0 ? "bg-yellow-500" : 
                  index === 1 ? "bg-gray-400" : 
                  "bg-orange-500"
                }`} />
                <span className="text-sm">{performer.name}</span>
              </div>
              <span className="font-semibold">{performer.value.toLocaleString()}€</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomizableDashboard({ stats, onStatsRefresh }: CustomizableDashboardProps) {
  const [widgets, setWidgets] = useState<Widget[]>([
    {
      id: "kpi-clients",
      type: "kpi_card",
      title: "Clients Total",
      size: "small",
      position: { x: 0, y: 0 },
      visible: true,
      config: { kpiType: "clients" }
    },
    {
      id: "kpi-quotes",
      type: "kpi_card", 
      title: "Devis Total",
      size: "small",
      position: { x: 1, y: 0 },
      visible: true,
      config: { kpiType: "quotes" }
    },
    {
      id: "kpi-revenue",
      type: "kpi_card",
      title: "CA Total",
      size: "small", 
      position: { x: 2, y: 0 },
      visible: true,
      config: { kpiType: "revenue" }
    },
    {
      id: "kpi-conversion",
      type: "kpi_card",
      title: "Taux Conversion",
      size: "small",
      position: { x: 3, y: 0 },
      visible: true,
      config: { kpiType: "conversion" }
    },
    {
      id: "revenue-chart",
      type: "revenue_chart",
      title: "Évolution CA",
      size: "large",
      position: { x: 0, y: 1 },
      visible: true,
    },
    {
      id: "conversion-funnel", 
      type: "conversion_funnel",
      title: "Entonnoir",
      size: "medium",
      position: { x: 2, y: 1 },
      visible: true,
    },
    {
      id: "pending-actions",
      type: "pending_actions", 
      title: "Actions en Attente",
      size: "medium",
      position: { x: 0, y: 2 },
      visible: true,
    },
    {
      id: "top-performers",
      type: "top_performers",
      title: "Top Performers", 
      size: "medium",
      position: { x: 2, y: 2 },
      visible: true,
    },
  ]);

  const [isEditMode, setIsEditMode] = useState(false);

  const toggleWidgetVisibility = (widgetId: string) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    ));
  };

  const addWidget = (type: string) => {
    const newWidget: Widget = {
      id: `${type}-${Date.now()}`,
      type,
      title: widgetTypes[type as keyof typeof widgetTypes].name,
      size: widgetTypes[type as keyof typeof widgetTypes].defaultSize,
      position: { x: 0, y: 999 }, // Sera repositionné automatiquement
      visible: true,
    };
    setWidgets(prev => [...prev, newWidget]);
  };

  const getGridClass = (size: string) => {
    switch (size) {
      case "small": return "col-span-1";
      case "medium": return "col-span-2"; 
      case "large": return "col-span-4";
      default: return "col-span-1";
    }
  };

  const visibleWidgets = widgets.filter(w => w.visible);

  return (
    <div className="space-y-6">
      {/* Barre d'outils */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tableau de Bord</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble de votre activité commerciale
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onStatsRefresh}
            className="flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            Actualiser
          </Button>
          
          <Button
            variant={isEditMode ? "default" : "outline"}
            onClick={() => setIsEditMode(!isEditMode)}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            {isEditMode ? "Terminer" : "Personnaliser"}
          </Button>
        </div>
      </div>

      {/* Mode édition */}
      {isEditMode && (
        <Card>
          <CardHeader>
            <CardTitle>Personnalisation du Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Gestion de la visibilité */}
            <div>
              <h4 className="font-semibold mb-2">Widgets visibles</h4>
              <div className="flex flex-wrap gap-2">
                {widgets.map(widget => (
                  <Button
                    key={widget.id}
                    variant={widget.visible ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleWidgetVisibility(widget.id)}
                    className="flex items-center gap-2"
                  >
                    {widget.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {widget.title}
                  </Button>
                ))}
              </div>
            </div>

            {/* Ajouter des widgets */}
            <div>
              <h4 className="font-semibold mb-2">Ajouter un widget</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(widgetTypes).map(([type, config]) => {
                  const IconComponent = config.icon;
                  return (
                    <Button
                      key={type}
                      variant="outline" 
                      size="sm"
                      onClick={() => addWidget(type)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      <IconComponent className="h-4 w-4" />
                      {config.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grille de widgets */}
      <div className="grid grid-cols-4 gap-6">
        {visibleWidgets.map(widget => {
          const WidgetComponent = widgetTypes[widget.type as keyof typeof widgetTypes]?.component;
          
          if (!WidgetComponent) return null;

          return (
            <div
              key={widget.id}
              className={`${getGridClass(widget.size)} ${isEditMode ? "border-2 border-dashed border-primary/50 rounded-lg p-2" : ""}`}
            >
              {isEditMode && (
                <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GripVertical className="h-4 w-4" />
                    {widget.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleWidgetVisibility(widget.id)}
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <WidgetComponent widget={widget} stats={stats} />
            </div>
          );
        })}
      </div>

      {visibleWidgets.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun widget visible</h3>
            <p className="text-muted-foreground mb-4">
              Activez le mode personnalisation pour ajouter des widgets à votre dashboard.
            </p>
            <Button onClick={() => setIsEditMode(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Personnaliser
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}