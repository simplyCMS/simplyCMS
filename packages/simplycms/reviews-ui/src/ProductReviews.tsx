import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, LogIn } from "lucide-react";
import { useAuth } from "@simplysoftua/core/hooks/useAuth";
import { useProductReviews } from "@simplysoftua/core/hooks/useProductReviews";
import { StarRating } from "./StarRating";
import { ReviewCard } from "./ReviewCard";
import { ReviewForm } from "./ReviewForm";

interface ProductReviewsProps {
  productId: string;
  /** Optional rich text editor to use in the review form */
  renderEditor?: (props: { content: string; onChange: (content: string) => void }) => React.ReactNode;
  /** Optional image upload component */
  renderImageUpload?: (props: { images: string[]; onImagesChange: (images: string[]) => void; bucket: string; folder: string; maxImages: number }) => React.ReactNode;
}

export function ProductReviews({ productId, renderEditor, renderImageUpload }: ProductReviewsProps) {
  const { user } = useAuth();
  const {
    reviews,
    approvedReviews,
    hasUserReview,
    avgRating,
    reviewCount,
    distribution,
    isLoading,
    submitReview,
    deleteReview,
  } = useProductReviews(productId);
  const [showForm, setShowForm] = useState(false);

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
            {reviewCount} {reviewCount === 1 ? "вiдгук" : reviewCount < 5 ? "вiдгуки" : "вiдгукiв"}
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
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
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
          <p className="text-sm text-muted-foreground">Ви вже залишили вiдгук на цей товар.</p>
        ) : showForm ? (
          <ReviewForm
            productId={productId}
            onSubmit={(data) => {
              submitReview.mutate(data, { onSuccess: () => setShowForm(false) });
            }}
            isSubmitting={submitReview.isPending}
            renderEditor={renderEditor}
            renderImageUpload={renderImageUpload}
          />
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
          >
            Написати вiдгук
          </button>
        )
      ) : (
        <div className="border rounded-lg p-4 text-center space-y-2">
          <p className="text-muted-foreground">Щоб залишити вiдгук, увiйдiть в свiй акаунт</p>
          <Link to="/auth" className="inline-flex items-center gap-2 px-4 py-2 border rounded-md text-sm">
            <LogIn className="h-4 w-4" />
            Увiйти або зареєструватись
          </Link>
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
        <p className="text-muted-foreground text-center py-4">Ще немає вiдгукiв. Будьте першим!</p>
      )}
    </div>
  );
}
