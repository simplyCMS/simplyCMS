import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { usePriceType } from "./usePriceType";
import { resolveDiscount, type DiscountGroup, type DiscountContext, type DiscountResult } from "@/lib/discountEngine";

/** Loads all active discount groups for the given price type, with nested discounts/targets/conditions */
export function useDiscountGroups() {
  const { priceTypeId } = usePriceType();

  return useQuery({
    queryKey: ["discount-groups-active", priceTypeId],
    queryFn: async (): Promise<DiscountGroup[]> => {
      if (!priceTypeId) return [];

      // Fetch discounts for this price type, with their groups
      const { data: dbDiscounts, error: dErr } = await supabase
        .from("discounts")
        .select("*, discount_targets(*), discount_conditions(*)")
        .eq("price_type_id", priceTypeId)
        .eq("is_active", true);
      if (dErr) throw dErr;
      if (!dbDiscounts?.length) return [];

      // Collect group ids from discounts
      const groupIds = [...new Set(dbDiscounts.map((d: any) => d.group_id))];

      const { data: dbGroups, error: gErr } = await supabase
        .from("discount_groups")
        .select("*")
        .in("id", groupIds)
        .eq("is_active", true);
      if (gErr) throw gErr;
      if (!dbGroups?.length) return [];

      // Also load parent groups that might not have discounts for this price type
      const parentIds = dbGroups
        .map((g: any) => g.parent_group_id)
        .filter((id: any) => id && !groupIds.includes(id));
      
      let allGroups = [...dbGroups];
      if (parentIds.length > 0) {
        const { data: parents } = await supabase
          .from("discount_groups")
          .select("*")
          .in("id", parentIds)
          .eq("is_active", true);
        if (parents) allGroups = [...allGroups, ...parents];
      }

      // Build tree
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
            discount_type: d.discount_type as any,
            discount_value: Number(d.discount_value),
            priority: d.priority,
            is_active: d.is_active,
            starts_at: d.starts_at,
            ends_at: d.ends_at,
            targets: (d as any).discount_targets || [],
            conditions: (d as any).discount_conditions || [],
          });
        }
      }

      const roots: DiscountGroup[] = [];
      for (const g of allGroups) {
        const node = groupMap.get(g.id)!;
        if (g.parent_group_id && groupMap.has(g.parent_group_id)) {
          groupMap.get(g.parent_group_id)!.children.push(node);
        } else {
          roots.push(node);
        }
      }

      return roots;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!priceTypeId,
  });
}

/** Returns user context for discount evaluation */
export function useDiscountContext() {
  const { user } = useAuth();

  const { data: userCategoryId } = useQuery({
    queryKey: ["user-category-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("category_id")
        .eq("user_id", user.id)
        .single();
      return data?.category_id || null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    userId: user?.id || null,
    userCategoryId: userCategoryId || null,
    isLoggedIn: !!user,
  };
}

/** Applies discounts to a single product price */
export function applyDiscount(
  basePrice: number,
  groups: DiscountGroup[],
  context: Omit<DiscountContext, "now">
): DiscountResult {
  if (!groups.length || basePrice <= 0) {
    return {
      finalPrice: basePrice,
      totalDiscount: 0,
      appliedDiscounts: [],
      rejectedDiscounts: [],
    };
  }
  return resolveDiscount(basePrice, groups, { ...context, now: new Date() });
}
