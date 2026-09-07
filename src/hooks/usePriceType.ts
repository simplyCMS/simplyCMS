import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function usePriceType() {
  const { user } = useAuth();

  const { data: defaultPriceType } = useQuery({
    queryKey: ["default-price-type"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_types")
        .select("id")
        .eq("is_default", true)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: userPriceTypeId } = useQuery({
    queryKey: ["user-price-type", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("category:user_categories(price_type_id)")
        .eq("user_id", user.id)
        .single();
      if (error) return null;
      return (data?.category as any)?.price_type_id || null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const defaultPriceTypeId = defaultPriceType?.id || null;
  const priceTypeId = userPriceTypeId || defaultPriceTypeId;

  return { priceTypeId, defaultPriceTypeId };
}
