import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  content: string | null;
  images: string[];
  status: string;
  admin_comment: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}

export function useProductReviews(productId: string | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reviewsQuery = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from("product_reviews")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for all user_ids
      const userIds = [...new Set((data || []).map((r: any) => r.user_id))];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, avatar_url")
          .in("user_id", userIds);
        profiles?.forEach((p: any) => {
          profilesMap[p.user_id] = p;
        });
      }

      return (data || []).map((r: any) => ({
        ...r,
        images: Array.isArray(r.images) ? r.images : [],
        profile: profilesMap[r.user_id] || null,
      })) as ProductReview[];
    },
    enabled: !!productId,
    staleTime: 60000,
  });

  const reviews = reviewsQuery.data || [];
  const approvedReviews = reviews.filter((r) => r.status === "approved");
  const userReview = user ? reviews.find((r) => r.user_id === user.id) : null;
  const hasUserReview = !!userReview;

  // Rating stats (only approved)
  const reviewCount = approvedReviews.length;
  const avgRating = reviewCount > 0
    ? Math.round((approvedReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10
    : 0;

  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  approvedReviews.forEach((r) => {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1;
  });

  const submitReview = useMutation({
    mutationFn: async (data: {
      rating: number;
      title?: string;
      content?: string;
      images?: string[];
    }) => {
      if (!user || !productId) throw new Error("Не авторизовано");
      const { error } = await supabase.from("product_reviews").insert({
        product_id: productId,
        user_id: user.id,
        rating: data.rating,
        title: data.title || null,
        content: data.content || null,
        images: data.images || [],
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
      toast({ title: "Відгук надіслано", description: "Він з'явиться після модерації" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Помилка", description: err.message });
    },
  });

  const deleteReview = useMutation({
    mutationFn: async (reviewId: string) => {
      // Get review images first
      const review = reviews.find((r) => r.id === reviewId);
      if (review?.images?.length) {
        const paths = review.images.map((url: string) => {
          try {
            const u = new URL(url);
            const match = u.pathname.match(/\/review-images\/(.+)$/);
            return match ? match[1] : null;
          } catch { return null; }
        }).filter(Boolean) as string[];
        if (paths.length > 0) {
          await supabase.storage.from("review-images").remove(paths);
        }
      }
      const { error } = await supabase.from("product_reviews").delete().eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
      toast({ title: "Відгук видалено" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Помилка", description: err.message });
    },
  });

  return {
    reviews,
    approvedReviews,
    userReview,
    hasUserReview,
    avgRating,
    reviewCount,
    distribution,
    isLoading: reviewsQuery.isLoading,
    submitReview,
    deleteReview,
  };
}

export function useProductRatings(productIds: string[]) {
  return useQuery({
    queryKey: ["product-ratings", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return {};
      const { data, error } = await supabase.rpc("get_product_ratings", {
        product_ids: productIds,
      });
      if (error) throw error;
      const map: Record<string, { avgRating: number; reviewCount: number }> = {};
      (data || []).forEach((r: any) => {
        map[r.product_id] = {
          avgRating: Number(r.avg_rating),
          reviewCount: r.review_count,
        };
      });
      return map;
    },
    enabled: productIds.length > 0,
    staleTime: 60000,
  });
}
