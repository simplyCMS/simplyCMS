import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProductReviews } from "@/hooks/useProductReviews";
import { StarRating } from "./StarRating";
import { ReviewCard } from "./ReviewCard";
import { ReviewForm } from "./ReviewForm";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, LogIn } from "lucide-react";
import { Link } from "react-router-dom";

interface ProductReviewsProps {
  productId: string;
}

export function ProductReviews({ productId }: ProductReviewsProps) {
  const { user } = useAuth();
  const {
    reviews,
    approvedReviews,
    userReview,
    hasUserReview,
    avgRating,
    reviewCount,
    distribution,
    isLoading,
    submitReview,
    deleteReview,
  } = useProductReviews(productId);
  const [showForm, setShowForm] = useState(false);

  // Reviews to display: approved + user's own pending/rejected
  const visibleReviews = user
    ? reviews.filter((r) => r.status === "approved" || r.user_id === user.id)
    : approvedReviews;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rating summary */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex flex-col items-center justify-center min-w-[140px]">
          <span className="text-4xl font-bold">{avgRating > 0 ? avgRating : "—"}</span>
          <StarRating value={avgRating} readonly size="md" />
          <span className="text-sm text-muted-foreground mt-1">
            {reviewCount} {reviewCount === 1 ? "відгук" : reviewCount < 5 ? "відгуки" : "відгуків"}
          </span>
        </div>

        {reviewCount > 0 && (
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution[star] || 0;
              const pct = reviewCount > 0 ? (count / reviewCount) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-3 text-right">{star}</span>
                  <StarRating value={star} readonly size="sm" />
                  <Progress value={pct} className="flex-1 h-2" />
                  <span className="w-6 text-right text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Write review section */}
      {user ? (
        hasUserReview ? (
          <p className="text-sm text-muted-foreground">Ви вже залишили відгук на цей товар.</p>
        ) : showForm ? (
          <ReviewForm
            productId={productId}
            onSubmit={(data) => {
              submitReview.mutate(data, { onSuccess: () => setShowForm(false) });
            }}
            isSubmitting={submitReview.isPending}
          />
        ) : (
          <Button onClick={() => setShowForm(true)}>Написати відгук</Button>
        )
      ) : (
        <div className="border rounded-lg p-4 text-center space-y-2">
          <p className="text-muted-foreground">Щоб залишити відгук, увійдіть в свій акаунт</p>
          <Button asChild variant="outline">
            <Link to="/auth"><LogIn className="h-4 w-4 mr-2" />Увійти або зареєструватись</Link>
          </Button>
        </div>
      )}

      {/* Reviews list */}
      {visibleReviews.length > 0 ? (
        <div className="space-y-4">
          {visibleReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onDelete={(id) => deleteReview.mutate(id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-4">Ще немає відгуків. Будьте першим!</p>
      )}
    </div>
  );
}
