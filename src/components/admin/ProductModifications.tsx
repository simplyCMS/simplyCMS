import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Image, ArrowUp, ArrowDown, ChevronDown, ChevronUp } from "lucide-react";
import { ImageUpload } from "./ImageUpload";
import { ProductPropertyValues } from "./ProductPropertyValues";
import { StockStatusSelect } from "./StockStatusSelect";
import { StockByPointManager } from "./StockByPointManager";
import { ProductPricesEditor } from "./ProductPricesEditor";
import type { Tables } from "@/integrations/supabase/types";
import type { StockStatus } from "@/hooks/useStock";

type ProductModification = Tables<"product_modifications">;

interface ProductModificationsProps {
  productId: string;
  sectionId: string | null;
}

export function ProductModifications({ productId, sectionId }: ProductModificationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingModification, setEditingModification] = useState<ProductModification | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [stockStatus, setStockStatus] = useState<StockStatus>("in_stock");
  const [stockOpen, setStockOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [pricesOpen, setPricesOpen] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: modifications, isLoading } = useQuery({
    queryKey: ["product-modifications", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_modifications")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch default prices for table display
  const { data: modPrices } = useQuery({
    queryKey: ["modification-default-prices", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_prices")
        .select("modification_id, price, old_price, price_types!inner(is_default)")
        .eq("product_id", productId)
        .not("modification_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const getDefaultPrice = (modId: string) => {
    const entry = modPrices?.find((p: any) => p.modification_id === modId && (p.price_types as any)?.is_default);
    return entry;
  };

  const createMutation = useMutation({
    mutationFn: async (data: Partial<ProductModification>) => {
      // Get max sort_order
      const maxSortOrder = modifications?.reduce((max, m) => Math.max(max, m.sort_order), -1) ?? -1;
      
      const { error } = await supabase
        .from("product_modifications")
        .insert([{ ...data, product_id: productId, sort_order: maxSortOrder + 1 } as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-modifications", productId] });
      closeDialog();
      toast({ title: "Модифікацію створено" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductModification> }) => {
      const { error } = await supabase
        .from("product_modifications")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-modifications", productId] });
      closeDialog();
      toast({ title: "Модифікацію оновлено" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_modifications")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-modifications", productId] });
      toast({ title: "Модифікацію видалено" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      if (!modifications) return;

      const currentIndex = modifications.findIndex((m) => m.id === id);
      if (currentIndex === -1) return;

      const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (swapIndex < 0 || swapIndex >= modifications.length) return;

      const currentMod = modifications[currentIndex];
      const swapMod = modifications[swapIndex];

      // Use index-based sort_order to handle cases where all values are the same
      // Assign new unique sort_order values based on their new positions
      const newCurrentSortOrder = swapIndex;
      const newSwapSortOrder = currentIndex;

      await supabase
        .from("product_modifications")
        .update({ sort_order: newCurrentSortOrder })
        .eq("id", currentMod.id);

      await supabase
        .from("product_modifications")
        .update({ sort_order: newSwapSortOrder })
        .eq("id", swapMod.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-modifications", productId] });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка зміни порядку", description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      name: formData.get("name") as string,
      slug: formData.get("slug") as string,
      sku: (formData.get("sku") as string) || null,
      stock_status: stockStatus,
      is_default: formData.get("is_default") === "on",
      images: images,
    };

    if (editingModification) {
      updateMutation.mutate({ id: editingModification.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (modification: ProductModification) => {
    setEditingModification(modification);
    const existingImages = Array.isArray(modification.images) ? modification.images as string[] : [];
    setImages(existingImages);
    setStockStatus(modification.stock_status as StockStatus || "in_stock");
    setStockOpen(true);
    setPropertiesOpen(true);
    setIsOpen(true);
  };

  const openCreate = () => {
    setEditingModification(null);
    setImages([]);
    setStockStatus("in_stock");
    setStockOpen(true);
    setPropertiesOpen(true);
    setIsOpen(true);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setEditingModification(null);
    setImages([]);
    setStockStatus("in_stock");
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
    }).format(price);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "in_stock":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            В наявності
          </span>
        );
      case "out_of_stock":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            Немає
          </span>
        );
      case "on_order":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            Під замовлення
          </span>
        );
      default:
        return null;
    }
  };

  const handleRowClick = (mod: ProductModification, e: React.MouseEvent) => {
    // Don't trigger if clicking on action buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    openEdit(mod);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Модифікації товару</CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" />
                Додати
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingModification ? "Редагувати модифікацію" : "Нова модифікація"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mod-name">Назва *</Label>
                    <Input id="mod-name" name="name" defaultValue={editingModification?.name || ""} placeholder="Наприклад: 100W, Синій" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mod-slug">URL (slug) *</Label>
                    <Input id="mod-slug" name="slug" defaultValue={editingModification?.slug || ""} placeholder="100w" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mod-sku">Артикул (SKU)</Label>
                  <Input id="mod-sku" name="sku" defaultValue={editingModification?.sku || ""} placeholder="SP-100W-BLK" />
                </div>

                <StockStatusSelect value={stockStatus} onChange={setStockStatus} />

                <div className="flex items-center gap-2">
                  <Switch id="mod-default" name="is_default" defaultChecked={editingModification?.is_default ?? false} />
                  <Label htmlFor="mod-default">За замовчуванням</Label>
                </div>

                {/* Images section */}
                <div className="space-y-2">
                  <Label>Зображення</Label>
                  <ImageUpload images={images} onImagesChange={setImages} folder={`modifications/${editingModification?.id || 'new'}`} maxImages={10} />
                </div>

                {/* Prices editor for existing modifications */}
                {editingModification && (
                  <Collapsible open={pricesOpen} onOpenChange={setPricesOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" type="button" className="flex w-full justify-between p-3 border rounded-lg hover:bg-muted/50">
                        <span className="font-medium">Ціни за видами</span>
                        {pricesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <ProductPricesEditor productId={productId} modificationId={editingModification.id} />
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Stock by point for existing modifications */}
                {editingModification && (
                  <Collapsible open={stockOpen} onOpenChange={setStockOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" type="button" className="flex w-full justify-between p-3 border rounded-lg hover:bg-muted/50">
                        <span className="font-medium">Залишки по складах</span>
                        {stockOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <StockByPointManager modificationId={editingModification.id} showCard={false} />
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Properties section for existing modifications */}
                {editingModification && sectionId && (
                  <Collapsible open={propertiesOpen} onOpenChange={setPropertiesOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" type="button" className="flex w-full justify-between p-3 border rounded-lg hover:bg-muted/50">
                        <span className="font-medium">Властивості модифікації</span>
                        {propertiesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <ProductPropertyValues modificationId={editingModification.id} sectionId={sectionId} />
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={closeDialog}>Скасувати</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingModification ? "Зберегти" : "Створити"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {modifications && modifications.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Порядок</TableHead>
                <TableHead className="w-12"></TableHead>
                <TableHead>Назва</TableHead>
                <TableHead>Артикул</TableHead>
                <TableHead>Ціна</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modifications.map((mod, index) => {
                const modImages = Array.isArray(mod.images) ? mod.images as string[] : [];
                const defaultPrice = getDefaultPrice(mod.id);
                return (
                  <TableRow
                    key={mod.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={(e) => handleRowClick(mod, e)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0 || reorderMutation.isPending}
                          onClick={(e) => { e.stopPropagation(); reorderMutation.mutate({ id: mod.id, direction: "up" }); }}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === modifications.length - 1 || reorderMutation.isPending}
                          onClick={(e) => { e.stopPropagation(); reorderMutation.mutate({ id: mod.id, direction: "down" }); }}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {modImages.length > 0 ? (
                        <img src={modImages[0]} alt="" className="h-8 w-8 object-cover rounded"
                          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                      ) : (
                        <div className="h-8 w-8 bg-muted rounded flex items-center justify-center">
                          <Image className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {mod.name}
                      {mod.is_default && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">За замовч.</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{mod.sku || "—"}</TableCell>
                    <TableCell>
                      {defaultPrice ? (
                        <div className="flex flex-col">
                          <span className="font-medium">{formatPrice(Number(defaultPrice.price))}</span>
                          {defaultPrice.old_price && (
                            <span className="text-xs text-muted-foreground line-through">
                              {formatPrice(Number(defaultPrice.old_price))}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(mod.stock_status)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(mod.id); }} disabled={deleteMutation.isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Модифікацій ще немає. Додайте першу модифікацію товару.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
