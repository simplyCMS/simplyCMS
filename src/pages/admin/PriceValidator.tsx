import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, CheckCircle, XCircle, Info, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { resolvePrice } from "@/lib/priceUtils";
import { resolveDiscount, type DiscountGroup, type DiscountContext } from "@/lib/discountEngine";

export default function PriceValidator() {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedModificationId, setSelectedModificationId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [cartTotal, setCartTotal] = useState<number>(0);
  const [result, setResult] = useState<any>(null);

  // Load users (profiles)
  const { data: users = [] } = useQuery({
    queryKey: ["validator-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, category_id, user_categories(id, name, price_type_id, price_types(id, name))")
        .order("email")
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  // Load products
  const { data: products = [] } = useQuery({
    queryKey: ["validator-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, section_id, has_modifications")
        .eq("is_active", true)
        .order("name")
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Load modifications for selected product
  const { data: modifications = [] } = useQuery({
    queryKey: ["validator-modifications", selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) return [];
      const { data, error } = await supabase
        .from("product_modifications")
        .select("id, name")
        .eq("product_id", selectedProductId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProductId,
  });

  // Load default price type
  const { data: defaultPriceType } = useQuery({
    queryKey: ["default-price-type"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_types")
        .select("id, name")
        .eq("is_default", true)
        .single();
      if (error) return null;
      return data;
    },
  });

  const validate = async () => {
    if (!selectedProductId) return;

    const steps: any[] = [];
    const product = products.find((p: any) => p.id === selectedProductId);

    // Step 1: Determine price type
    let priceTypeId: string | null = null;
    let priceTypeName = "";
    let priceTypeReason = "";

    const user = users.find((u: any) => u.user_id === selectedUserId);
    if (user && user.user_categories) {
      const cat = user.user_categories as any;
      if (cat.price_type_id && cat.price_types) {
        priceTypeId = cat.price_type_id;
        priceTypeName = cat.price_types.name;
        priceTypeReason = `Категорія "${cat.name}" → Вид ціни "${priceTypeName}"`;
      }
    }

    if (!priceTypeId && defaultPriceType) {
      priceTypeId = defaultPriceType.id;
      priceTypeName = defaultPriceType.name;
      priceTypeReason = selectedUserId
        ? `Користувач без категорії → За замовчуванням "${priceTypeName}"`
        : `Гість → За замовчуванням "${priceTypeName}"`;
    }

    steps.push({
      title: "Вид ціни",
      value: priceTypeName || "Не визначено",
      reason: priceTypeReason || "Не знайдено жодного виду ціни",
      status: priceTypeId ? "ok" : "error",
    });

    // Step 2: Get base price
    const { data: prices } = await supabase
      .from("product_prices")
      .select("price_type_id, price, old_price, modification_id")
      .eq("product_id", selectedProductId);

    const modId = selectedModificationId || null;
    const resolved = resolvePrice(
      (prices || []) as any,
      priceTypeId,
      defaultPriceType?.id || null,
      modId
    );

    steps.push({
      title: "Базова ціна",
      value: resolved.price !== null ? `${resolved.price} грн` : "Не знайдено",
      reason: resolved.price !== null
        ? `product_prices (price_type: "${priceTypeName}", ${modId ? "modification" : "product"})`
        : "Немає ціни для цього виду ціни",
      status: resolved.price !== null ? "ok" : "error",
      oldPrice: resolved.oldPrice,
    });

    // Step 3: Calculate discounts
    if (resolved.price !== null && priceTypeId) {
      // Load discounts for this price type
      const { data: dbDiscounts } = await supabase
        .from("discounts")
        .select("*, discount_targets(*), discount_conditions(*)")
        .eq("price_type_id", priceTypeId)
        .eq("is_active", true);

      if (!dbDiscounts?.length) {
        steps.push({
          title: "Скидки",
          value: "Немає",
          reason: "Жодна скидка не знайдена для цього виду ціни",
          status: "info",
          applied: [],
          rejected: [],
        });
        steps.push({
          title: "Фінальна ціна",
          value: `${resolved.price.toFixed(2)} грн`,
          reason: `Без знижки: ${resolved.price} грн`,
          status: "ok",
        });
        setResult(steps);
        return;
      }

      // Load groups for these discounts
      const groupIds = [...new Set(dbDiscounts.map((d: any) => d.group_id))];
      const { data: dbGroups } = await supabase
        .from("discount_groups")
        .select("*")
        .in("id", groupIds)
        .eq("is_active", true);

      // Build tree
      const allGroups = dbGroups || [];
      const groupMap = new Map<string, DiscountGroup>();
      for (const g of allGroups) {
        groupMap.set(g.id, {
          id: g.id,
          name: g.name,
          description: g.description,
          operator: g.operator as any,
          is_active: g.is_active,
          priority: g.priority,
          starts_at: g.starts_at,
          ends_at: g.ends_at,
          discounts: [],
          children: [],
        });
      }

      for (const d of dbDiscounts) {
        const group = groupMap.get(d.group_id);
        if (group) {
          group.discounts.push({
            id: d.id,
            name: d.name,
            description: d.description,
            discount_type: d.discount_type,
            discount_value: Number(d.discount_value),
            priority: d.priority,
            is_active: d.is_active,
            starts_at: d.starts_at,
            ends_at: d.ends_at,
            targets: d.discount_targets || [],
            conditions: d.discount_conditions || [],
          });
        }
      }

      // Build parent-child
      const roots: DiscountGroup[] = [];
      for (const g of allGroups) {
        const node = groupMap.get(g.id)!;
        if (g.parent_group_id && groupMap.has(g.parent_group_id)) {
          groupMap.get(g.parent_group_id)!.children.push(node);
        } else {
          roots.push(node);
        }
      }

      const ctx: DiscountContext = {
        userId: selectedUserId || null,
        userCategoryId: user?.category_id || null,
        quantity,
        cartTotal: cartTotal || resolved.price * quantity,
        productId: selectedProductId,
        modificationId: modId,
        sectionId: product?.section_id || null,
        isLoggedIn: !!selectedUserId,
      };

      const discountResult = resolveDiscount(resolved.price, roots, ctx);

      steps.push({
        title: "Скидки",
        value: discountResult.totalDiscount > 0
          ? `-${discountResult.totalDiscount.toFixed(2)} грн`
          : "Немає",
        reason: discountResult.appliedDiscounts.length > 0
          ? `Застосовано ${discountResult.appliedDiscounts.length} скидок`
          : "Жодна скидка не підходить",
        status: "info",
        applied: discountResult.appliedDiscounts,
        rejected: discountResult.rejectedDiscounts,
      });

      steps.push({
        title: "Фінальна ціна",
        value: `${discountResult.finalPrice.toFixed(2)} грн`,
        reason: discountResult.totalDiscount > 0
          ? `${resolved.price} - ${discountResult.totalDiscount.toFixed(2)} = ${discountResult.finalPrice.toFixed(2)}`
          : `Без знижки: ${resolved.price} грн`,
        status: "ok",
      });
    }

    setResult(steps);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Валідатор цін</h1>
        <p className="text-muted-foreground mt-1">
          Перевірте ланцюжок ціноутворення для конкретного користувача та товару
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметри перевірки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Користувач</Label>
              <Select value={selectedUserId || "__guest__"} onValueChange={(v) => setSelectedUserId(v === "__guest__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Гість (без авторизації)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__guest__">Гість</SelectItem>
                  {users.map((u: any) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.first_name || ""} {u.last_name || ""} ({u.email || "без email"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Товар</Label>
              <Select value={selectedProductId} onValueChange={(v) => { setSelectedProductId(v); setSelectedModificationId(""); }}>
                <SelectTrigger><SelectValue placeholder="Оберіть товар" /></SelectTrigger>
                <SelectContent>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {modifications.length > 0 && (
            <div className="space-y-2">
              <Label>Модифікація</Label>
              <Select value={selectedModificationId || "__none__"} onValueChange={(v) => setSelectedModificationId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Без модифікації" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Без модифікації</SelectItem>
                  {modifications.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Кількість</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Сума кошика (грн)</Label>
              <Input type="number" min={0} value={cartTotal} onChange={(e) => setCartTotal(Number(e.target.value))} />
            </div>
          </div>

          <Button onClick={validate} disabled={!selectedProductId}>
            <Search className="h-4 w-4 mr-2" /> Перевірити
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Результат аналізу</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.map((step: any, idx: number) => (
              <div key={idx}>
                <div className="flex items-start gap-3">
                  {step.status === "ok" && <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />}
                  {step.status === "error" && <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />}
                  {step.status === "info" && <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />}

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{idx + 1}.</span>
                      <span className="font-medium">{step.title}:</span>
                      <span className="font-bold">{step.value}</span>
                      {step.oldPrice && (
                        <span className="text-sm text-muted-foreground line-through">{step.oldPrice} грн</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{step.reason}</p>

                    {/* Applied discounts */}
                    {step.applied && step.applied.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {step.applied.map((d: any) => (
                          <div key={d.id} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-xs">
                              Застосовано
                            </Badge>
                            <span>
                              {d.type === "percent" ? `-${d.value}%` : d.type === "fixed_amount" ? `-${d.value} грн` : `= ${d.value} грн`}
                            </span>
                            <span className="text-muted-foreground">"{d.name}"</span>
                            <span className="text-muted-foreground">({d.groupName})</span>
                            <span className="font-medium">= -{d.calculatedAmount.toFixed(2)} грн</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Rejected discounts */}
                    {step.rejected && step.rejected.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {step.rejected.map((d: any) => (
                          <div key={d.id} className="flex items-center gap-2 text-sm">
                            <XCircle className="h-3.5 w-3.5 text-red-400" />
                            <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-xs">
                              Відхилено
                            </Badge>
                            <span className="text-muted-foreground">"{d.name}"</span>
                            <span className="text-muted-foreground">({d.groupName})</span>
                            <ChevronRight className="h-3 w-3" />
                            <span className="text-sm text-red-600 dark:text-red-400">{d.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {idx < result.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
