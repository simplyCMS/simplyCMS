import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Loader2 } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  has_modifications: boolean | null;
  images: unknown;
}

interface AddProductToOrderProps {
  onAddProduct: (product: {
    name: string;
    price: number;
    quantity: number;
    product_id: string | null;
    modification_id: string | null;
  }) => void;
  isAdding?: boolean;
}

export function AddProductToOrder({ onAddProduct, isAdding }: AddProductToOrderProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["admin-search-products", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, has_modifications, images")
        .or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
        .limit(20);
      if (error) throw error;
      return data as Product[];
    },
    enabled: search.length >= 2,
  });

  // Fetch modifications and their prices for the selected product
  const { data: modifications, isLoading: modificationsLoading } = useQuery({
    queryKey: ["admin-product-modifications-with-prices", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct?.id) return [];
      const [{ data: mods, error: modsError }, { data: prices, error: pricesError }] = await Promise.all([
        supabase.from("product_modifications").select("id, name, sku, product_id").eq("product_id", selectedProduct.id).order("sort_order"),
        supabase.from("product_prices").select("modification_id, price, price_types!inner(is_default)").eq("product_id", selectedProduct.id),
      ]);
      if (modsError) throw modsError;
      if (pricesError) throw pricesError;

      const defaultPrices = prices?.filter((p: any) => (p.price_types as any)?.is_default) || [];
      return (mods || []).map((mod) => {
        const priceEntry = defaultPrices.find((p: any) => p.modification_id === mod.id);
        return { ...mod, price: priceEntry?.price ?? 0 };
      });
    },
    enabled: !!selectedProduct?.id && !!selectedProduct?.has_modifications,
  });

  // Fetch default price for simple product
  const { data: simpleProductPrice } = useQuery({
    queryKey: ["admin-simple-product-price", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct?.id) return null;
      const { data, error } = await supabase
        .from("product_prices")
        .select("price, price_types!inner(is_default)")
        .eq("product_id", selectedProduct.id)
        .is("modification_id", null);
      if (error) throw error;
      const defaultEntry = data?.find((p: any) => (p.price_types as any)?.is_default);
      return defaultEntry?.price ?? 0;
    },
    enabled: !!selectedProduct?.id && !selectedProduct?.has_modifications,
  });

  const handleSelectProduct = (product: Product) => {
    if (product.has_modifications) {
      setSelectedProduct(product);
    } else {
      setSelectedProduct(product);
    }
  };

  // When simple product is selected and price loaded, add it
  const handleAddSimpleProduct = () => {
    if (!selectedProduct || simpleProductPrice === null || simpleProductPrice === undefined) return;
    onAddProduct({
      name: selectedProduct.name,
      price: simpleProductPrice,
      quantity: 1,
      product_id: selectedProduct.id,
      modification_id: null,
    });
    handleClose();
  };

  const handleSelectModification = (mod: { id: string; name: string; price: number }) => {
    onAddProduct({
      name: `${selectedProduct?.name} - ${mod.name}`,
      price: mod.price,
      quantity: 1,
      product_id: selectedProduct?.id || null,
      modification_id: mod.id,
    });
    handleClose();
  };

  const handleClose = () => {
    setOpen(false);
    setSearch("");
    setSelectedProduct(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={isAdding}>
          {isAdding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Додати товар
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {selectedProduct
              ? selectedProduct.has_modifications
                ? `Оберіть модифікацію: ${selectedProduct.name}`
                : `Додати: ${selectedProduct.name}`
              : "Додати товар до замовлення"}
          </DialogTitle>
        </DialogHeader>

        {!selectedProduct ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Пошук за назвою або артикулом..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" autoFocus />
            </div>
            <ScrollArea className="h-[300px]">
              {productsLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : search.length < 2 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Введіть мінімум 2 символи для пошуку</p>
              ) : products?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Товари не знайдено</p>
              ) : (
                <div className="space-y-1">
                  {products?.map((product) => (
                    <button key={product.id} onClick={() => handleSelectProduct(product)} className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground flex gap-4">
                        {product.sku && <span>Арт: {product.sku}</span>}
                        {product.has_modifications && <span className="text-primary">Є модифікації</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : selectedProduct.has_modifications ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}>← Назад до пошуку</Button>
            <ScrollArea className="h-[300px]">
              {modificationsLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : modifications?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Модифікації не знайдено</p>
              ) : (
                <div className="space-y-1">
                  {modifications?.map((mod) => (
                    <button key={mod.id} onClick={() => handleSelectModification(mod)} className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors">
                      <div className="font-medium">{mod.name}</div>
                      <div className="text-sm text-muted-foreground flex gap-4">
                        {mod.sku && <span>Арт: {mod.sku}</span>}
                        <span>{mod.price.toLocaleString()} ₴</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}>← Назад до пошуку</Button>
            <div className="text-center py-4">
              <p className="mb-4">Ціна: {simpleProductPrice !== null && simpleProductPrice !== undefined ? `${simpleProductPrice.toLocaleString()} ₴` : "Завантаження..."}</p>
              <Button onClick={handleAddSimpleProduct} disabled={simpleProductPrice === null || simpleProductPrice === undefined}>
                Додати до замовлення
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
