import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductPricesEditorProps {
  productId: string;
  modificationId?: string | null;
}

export function ProductPricesEditor({ productId, modificationId = null }: ProductPricesEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: priceTypes } = useQuery({
    queryKey: ["price-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_types")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: existingPrices, isLoading } = useQuery({
    queryKey: ["product-prices-editor", productId, modificationId],
    queryFn: async () => {
      let query = supabase
        .from("product_prices")
        .select("*")
        .eq("product_id", productId);

      if (modificationId) {
        query = query.eq("modification_id", modificationId);
      } else {
        query = query.is("modification_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const [prices, setPrices] = useState<Record<string, { price: string; old_price: string }>>({});

  useEffect(() => {
    if (priceTypes && existingPrices) {
      const initial: Record<string, { price: string; old_price: string }> = {};
      priceTypes.forEach((pt) => {
        const existing = existingPrices.find((ep) => ep.price_type_id === pt.id);
        initial[pt.id] = {
          price: existing?.price?.toString() || "",
          old_price: existing?.old_price?.toString() || "",
        };
      });
      setPrices(initial);
    }
  }, [priceTypes, existingPrices]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [priceTypeId, values] of Object.entries(prices)) {
        const priceVal = parseFloat(values.price);
        const existing = existingPrices?.find((ep) => ep.price_type_id === priceTypeId);

        if (isNaN(priceVal) || values.price === "") {
          if (existing) {
            await supabase.from("product_prices").delete().eq("id", existing.id);
          }
          continue;
        }

        const oldPriceVal = values.old_price ? parseFloat(values.old_price) : null;

        if (existing) {
          await supabase
            .from("product_prices")
            .update({ price: priceVal, old_price: oldPriceVal })
            .eq("id", existing.id);
        } else {
          await supabase.from("product_prices").insert({
            price_type_id: priceTypeId,
            product_id: productId,
            modification_id: modificationId || null,
            price: priceVal,
            old_price: oldPriceVal,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-prices-editor", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-prices"] });
      toast({ title: "Ціни збережено" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Ціни за видами</CardTitle>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Зберегти ціни
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Вид ціни</TableHead>
              <TableHead>Ціна</TableHead>
              <TableHead>Стара ціна</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceTypes?.map((pt) => (
              <TableRow key={pt.id}>
                <TableCell className="font-medium">
                  {pt.name}
                  {pt.is_default && (
                    <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      За замовч.
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prices[pt.id]?.price || ""}
                    onChange={(e) =>
                      setPrices((prev) => ({
                        ...prev,
                        [pt.id]: { ...prev[pt.id], price: e.target.value },
                      }))
                    }
                    placeholder="0"
                    className="w-32"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prices[pt.id]?.old_price || ""}
                    onChange={(e) =>
                      setPrices((prev) => ({
                        ...prev,
                        [pt.id]: { ...prev[pt.id], old_price: e.target.value },
                      }))
                    }
                    placeholder="0"
                    className="w-32"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
