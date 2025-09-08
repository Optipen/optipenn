import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Bell, 
  BellOff, 
  Check, 
  CheckCheck, 
  Trash2, 
  Settings,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  User,
  FileText,
  Euro,
  Calendar,
  Mail
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Notification {
  id: string;
  type: "info" | "warning" | "success" | "error" | "reminder";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  category: "system" | "client" | "quote" | "follow_up" | "user";
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

interface NotificationCenterProps {
  className?: string;
}

const notificationIcons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: AlertTriangle,
  reminder: Clock,
};

const notificationColors = {
  info: "text-blue-500",
  warning: "text-orange-500", 
  success: "text-green-500",
  error: "text-red-500",
  reminder: "text-purple-500",
};

const categoryIcons = {
  system: Settings,
  client: User,
  quote: FileText,
  follow_up: Calendar,
  user: User,
};

export default function NotificationCenter({ className = "" }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  // Charger les notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000, // Actualiser toutes les 30 secondes
  });

  // Marquer comme lu
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest("PATCH", `/api/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  // Marquer toutes comme lues
  const markAllAsReadMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", "/api/notifications/mark-all-read"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  // Supprimer notification
  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest("DELETE", `/api/notifications/${notificationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case "unread": return !notification.read;
      case "read": return notification.read;
      default: return true;
    }
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { 
      addSuffix: true, 
      locale: fr 
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`relative ${className}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAllAsReadMutation.mutate()}
                    className="text-xs"
                  >
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Tout lire
                  </Button>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Filtrer</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setFilter("all")}>
                      Toutes ({notifications.length})
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilter("unread")}>
                      Non lues ({unreadCount})
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilter("read")}>
                      Lues ({notifications.length - unreadCount})
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {unreadCount > 0 && (
              <div className="text-sm text-muted-foreground">
                {unreadCount} notification{unreadCount > 1 ? "s" : ""} non lue{unreadCount > 1 ? "s" : ""}
              </div>
            )}
          </CardHeader>

          <Separator />

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground">
                Chargement des notifications...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-6 text-center">
                <BellOff className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {filter === "unread" 
                    ? "Aucune notification non lue" 
                    : "Aucune notification"}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-96">
                {filteredNotifications.map((notification, index) => {
                  const NotificationIcon = notificationIcons[notification.type];
                  const CategoryIcon = categoryIcons[notification.category];
                  const iconColor = notificationColors[notification.type];

                  return (
                    <div key={notification.id}>
                      <div
                        className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                          !notification.read ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <div className="relative">
                              <NotificationIcon className={`h-5 w-5 ${iconColor}`} />
                              <CategoryIcon className="h-3 w-3 absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 text-muted-foreground" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <h4 className={`text-sm font-medium ${
                                !notification.read ? "font-semibold" : ""
                              }`}>
                                {notification.title}
                              </h4>
                              
                              <div className="flex items-center gap-1 ml-2">
                                {!notification.read && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                )}
                                
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Settings className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    {!notification.read && (
                                      <DropdownMenuItem 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          markAsReadMutation.mutate(notification.id);
                                        }}
                                      >
                                        <Check className="h-4 w-4 mr-2" />
                                        Marquer comme lu
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteNotificationMutation.mutate(notification.id);
                                      }}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Supprimer
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {notification.message}
                            </p>

                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-muted-foreground">
                                {formatTimeAgo(notification.createdAt)}
                              </span>
                              
                              {notification.actionLabel && (
                                <Badge variant="outline" className="text-xs">
                                  {notification.actionLabel}
                                </Badge>
                              )}
                            </div>

                            {notification.metadata && (
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                {notification.metadata.clientName && (
                                  <span>Client: {notification.metadata.clientName}</span>
                                )}
                                {notification.metadata.amount && (
                                  <span>Montant: {notification.metadata.amount}€</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {index < filteredNotifications.length - 1 && <Separator />}
                    </div>
                  );
                })}
              </ScrollArea>
            )}
          </CardContent>

          {filteredNotifications.length > 0 && (
            <>
              <Separator />
              <div className="p-3 text-center">
                <Button variant="ghost" size="sm" className="text-xs">
                  Voir toutes les notifications
                </Button>
              </div>
            </>
          )}
        </Card>
      </PopoverContent>
    </Popover>
  );
}

// Hook pour créer des notifications
export function useNotifications() {
  const createNotification = useMutation({
    mutationFn: (notification: Omit<Notification, "id" | "createdAt" | "read">) =>
      apiRequest("POST", "/api/notifications", notification),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const createQuickNotification = (
    type: Notification["type"],
    title: string,
    message: string,
    category: Notification["category"] = "system"
  ) => {
    createNotification.mutate({
      type,
      title,
      message,
      category,
    });
  };

  return {
    createNotification: createNotification.mutate,
    createQuickNotification,
    isCreating: createNotification.isPending,
  };
}

// Exemples de notifications prédéfinies
export const notificationTemplates = {
  clientCreated: (clientName: string) => ({
    type: "success" as const,
    title: "Client créé",
    message: `Le client ${clientName} a été créé avec succès.`,
    category: "client" as const,
    actionUrl: "/clients",
    actionLabel: "Voir client",
  }),
  
  quoteCreated: (quoteName: string, amount: number) => ({
    type: "info" as const,
    title: "Nouveau devis",
    message: `Le devis ${quoteName} d'un montant de ${amount}€ a été créé.`,
    category: "quote" as const,
    actionUrl: "/quotes",
    actionLabel: "Voir devis",
    metadata: { amount },
  }),

  followUpReminder: (clientName: string, quoteId: string) => ({
    type: "reminder" as const,
    title: "Relance à effectuer",
    message: `Il est temps de relancer le client ${clientName} pour son devis.`,
    category: "follow_up" as const,
    actionUrl: `/quotes/${quoteId}`,
    actionLabel: "Relancer",
    metadata: { clientName },
  }),

  systemUpdate: (version: string) => ({
    type: "info" as const,
    title: "Mise à jour système",
    message: `Optipenn CRM a été mis à jour vers la version ${version}.`,
    category: "system" as const,
  }),

  dataExported: (format: string, count: number) => ({
    type: "success" as const,
    title: "Export terminé",
    message: `${count} éléments ont été exportés au format ${format}.`,
    category: "system" as const,
  }),
};