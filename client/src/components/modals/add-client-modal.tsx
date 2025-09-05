import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertClientSchema, type InsertClient } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddClientModal({ open, onOpenChange }: AddClientModalProps) {
  const { toast } = useToast();

  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      phone: "",
      position: "",
    },
  });

  const createClientMutation = useMutation({
    mutationFn: (data: InsertClient) => apiRequest("POST", "/api/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onOpenChange(false);
      form.reset();
      toast({
        title: "Succès",
        description: "Client créé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la création du client",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertClient) => {
    createClientMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="add-client-modal">
        <DialogHeader>
          <DialogTitle>Nouveau Client</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau client à votre portefeuille
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nom du contact" 
                      {...field}
                      data-testid="input-client-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entreprise *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nom de l'entreprise" 
                      {...field}
                      data-testid="input-client-company"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="email@entreprise.com" 
                      {...field}
                      data-testid="input-client-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input 
                      type="tel" 
                      placeholder="+33 1 23 45 67 89" 
                      {...field}
                      value={field.value || ""}
                      data-testid="input-client-phone"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Poste</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Directeur, CEO, etc." 
                      {...field}
                      value={field.value || ""}
                      data-testid="input-client-position"
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
                data-testid="button-cancel-client"
              >
                Annuler
              </Button>
              <Button 
                type="submit" 
                disabled={createClientMutation.isPending}
                data-testid="button-create-client"
              >
                {createClientMutation.isPending ? "Création..." : "Créer Client"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
