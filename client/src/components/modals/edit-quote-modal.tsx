import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertQuoteSchema, type InsertQuote, type Client, type QuoteWithClient } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EditQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: QuoteWithClient | null;
}

export default function EditQuoteModal({ open, onOpenChange, quote }: EditQuoteModalProps) {
  const { toast } = useToast();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<InsertQuote>({
    resolver: zodResolver(insertQuoteSchema.partial()),
    defaultValues: {
      reference: quote?.reference || "",
      clientId: quote?.clientId || "",
      description: quote?.description || "",
      amount: quote?.amount || "",
      sentDate: quote?.sentDate || "",
      status: quote?.status || "Envoyé",
      notes: quote?.notes || "",
      plannedFollowUpDate: quote?.plannedFollowUpDate || "",
    },
  });

  useEffect(() => {
    if (quote) {
      form.reset({
        reference: quote.reference,
        clientId: quote.clientId,
        description: quote.description,
        amount: quote.amount,
        sentDate: quote.sentDate,
        status: quote.status,
        notes: quote.notes || "",
        plannedFollowUpDate: quote.plannedFollowUpDate || "",
      });
    }
  }, [quote, form]);

  const updateQuoteMutation = useMutation({
    mutationFn: (data: Partial<InsertQuote>) => apiRequest("PUT", `/api/quotes/${quote?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-follow-ups"] });
      onOpenChange(false);
      toast({
        title: "Succès",
        description: "Devis mis à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la mise à jour du devis",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertQuote) => {
    updateQuoteMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="edit-quote-modal">
        <DialogHeader>
          <DialogTitle>Modifier Devis</DialogTitle>
          <DialogDescription>
            Modifiez les informations du devis {quote?.reference}
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
                      <SelectTrigger data-testid="select-edit-client">
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
                      data-testid="input-edit-quote-reference"
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
                      data-testid="textarea-edit-quote-description"
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
                        data-testid="input-edit-quote-amount"
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
                        data-testid="input-edit-quote-date"
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
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-quote-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Envoyé">Envoyé</SelectItem>
                      <SelectItem value="En attente">En attente</SelectItem>
                      <SelectItem value="Relancé">Relancé</SelectItem>
                      <SelectItem value="Accepté">Accepté</SelectItem>
                      <SelectItem value="Refusé">Refusé</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="plannedFollowUpDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de relance planifiée</FormLabel>
                  <FormControl>
                    <Input 
                      type="date"
                      {...field}
                      value={field.value || ""}
                      data-testid="input-edit-planned-followup-date"
                    />
                  </FormControl>
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
                      value={field.value || ""}
                      data-testid="textarea-edit-quote-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4 pb-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit-quote"
              >
                Annuler
              </Button>
              <Button 
                type="submit" 
                disabled={updateQuoteMutation.isPending}
                data-testid="button-save-edit-quote"
              >
                {updateQuoteMutation.isPending ? "Mise à jour..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}