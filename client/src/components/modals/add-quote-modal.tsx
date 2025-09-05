import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertQuoteSchema, type InsertQuote, type Client } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddQuoteModal({ open, onOpenChange }: AddQuoteModalProps) {
  const { toast } = useToast();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<InsertQuote>({
    resolver: zodResolver(insertQuoteSchema),
    defaultValues: {
      reference: "",
      clientId: "",
      description: "",
      amount: "",
      sentDate: new Date().toISOString().split('T')[0],
      status: "Envoyé",
      notes: "",
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: (data: InsertQuote) => apiRequest("POST", "/api/quotes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      onOpenChange(false);
      form.reset();
      toast({
        title: "Succès",
        description: "Devis créé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la création du devis",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertQuote) => {
    createQuoteMutation.mutate(data);
  };

  // Generate reference number
  const generateReference = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `DEV-${year}-${random}`;
  };

  // Auto-generate reference when modal opens
  if (open && !form.getValues('reference')) {
    form.setValue('reference', generateReference());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="add-quote-modal">
        <DialogHeader>
          <DialogTitle>Nouveau Devis</DialogTitle>
          <DialogDescription>
            Créez un nouveau devis pour un client
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-client">
                        <SelectValue placeholder="Sélectionner un client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.company} - {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Référence *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="DEV-2024-001" 
                      {...field}
                      data-testid="input-quote-reference"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Description du projet"
                      rows={3}
                      {...field}
                      data-testid="textarea-quote-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant (€) *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        placeholder="15000"
                        {...field}
                        data-testid="input-quote-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date d'envoi *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date"
                        {...field}
                        data-testid="input-quote-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut initial</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-quote-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Envoyé">Envoyé</SelectItem>
                      <SelectItem value="En attente">En attente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Notes internes..."
                      rows={2}
                      {...field}
                      data-testid="textarea-quote-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-quote"
              >
                Annuler
              </Button>
              <Button 
                type="submit" 
                disabled={createQuoteMutation.isPending}
                data-testid="button-create-quote"
              >
                {createQuoteMutation.isPending ? "Création..." : "Créer Devis"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
